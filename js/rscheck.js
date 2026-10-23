/*
 * IoT Guardian — «compile» για τη Rust: μαζεύει τα items (fn, struct, enum, impl, use, const) και κάνει
 * τους πιο διδακτικούς ελέγχους του rustc πριν τρέξει οτιδήποτε:
 *   E0384 ανάθεση σε μη-mut · E0596 δανεισμός &mut από μη-mut · E0382 χρήση τιμής που μετακινήθηκε (move)
 *   E0308 ασύμβατοι τύποι (π.χ. String / &str, ακέραιος / δεκαδικός, ξεχασμένο ; στο return)
 *   E0277 ακέραιος + δεκαδικός, ? σε συνάρτηση που δεν επιστρέφει Result · E0004 match που δεν καλύπτει τα πάντα
 *   E0425 / E0433 / E0432 άγνωστα ονόματα και imports · προειδοποιήσεις: αχρησιμοποίητη μεταβλητή, περιττό mut,
 *   Result που αγνοήθηκε.
 * Ο έλεγχος είναι συντηρητικός: όταν δεν ξέρει τον τύπο κάποιας τιμής, δεν βγάζει λάθος.
 */
(function (root) {
  'use strict';

  const { CodeError } = root.IoTInterp;
  const { parse } = root.IoTRustParse;
  const RT = root.IoTRustRT;
  const { INT_RANGE, isIntTy, LIB, BOARD_HINT, useHint, nameHint } = RT;

  const rerr = (code, msg, line, hint) => new CodeError(`error${code ? `[${code}]` : ''}: ${msg}`, line, hint || '');

  // όλα τα «modules» που υπάρχουν (προθέματα των LIB)
  function modulePaths() {
    const out = new Set(['std', 'std::thread', 'std::time', 'std::error', 'std::process', 'std::cmp', 'rppal', 'rppal::gpio', 'rppal::i2c', 'ssd1306', 'ssd1306::prelude', 'embedded_graphics', 'embedded_graphics::prelude', 'embedded_graphics::mono_font', 'embedded_graphics::mono_font::ascii', 'embedded_graphics::pixelcolor', 'embedded_graphics::text', 'embedded_graphics::geometry', 'esp_idf_svc', 'esp_idf_svc::hal', 'esp_idf_svc::hal::gpio', 'esp_idf_svc::hal::delay', 'esp_idf_svc::hal::peripherals', 'esp_idf_svc::sys', 'esp_idf_svc::log', 'anyhow', 'log', 'esp_idf_svc::hal::prelude']);
    return out;
  }
  const MACRO_IMPORTS = new Set(['log::info', 'log::warn', 'log::error', 'log::debug', 'anyhow::anyhow', 'anyhow::bail']);
  const crateBoard = p => (p.startsWith('rppal') || p.startsWith('ssd1306') || p.startsWith('embedded_graphics') ? 'pi' : p.startsWith('esp_idf_svc') || p.startsWith('esp_idf_hal') ? 'esp32' : null);
  const normPath = p => p.replace(/^esp_idf_hal::/, 'esp_idf_svc::hal::').replace(/^esp_idf_hal$/, 'esp_idf_svc::hal').replace(/^esp_idf_sys::/, 'esp_idf_svc::sys::');

  // ------------------------------------------------------------ τύποι (ως κείμενο)
  function tyStr(t) {
    if (!t) return null;
    switch (t.k) {
      case 'path': {
        const name = t.segs[t.segs.length - 1];
        if (name === 'Self') return 'Self';
        const args = (t.args || []).map(tyStr);
        if (name === 'Box' && t.args[0] && t.args[0].k === 'dyn') return 'Box<dyn Error>';
        if (name === 'Result' && t.segs[0] === 'anyhow') return `Result<${args[0] || '()'}, anyhow::Error>`;
        return args.length ? `${name}<${args.join(', ')}>` : name;
      }
      case 'ref': return `&${t.mut ? 'mut ' : ''}${tyStr(t.of)}`;
      case 'unit': return '()';
      case 'never': return '!';
      case 'tuple': return `(${t.items.map(tyStr).join(', ')})`;
      case 'array': return `[${tyStr(t.of)}; _]`;
      case 'slice': return `[${tyStr(t.of)}]`;
      case 'dyn': return `dyn ${tyStr(t.path)}`;
    }
    return null;
  }
  const isIntish = t => t === '{int}' || isIntTy(t);
  const isFloatish = t => t === '{float}' || t === 'f32' || t === 'f64';
  const generic = (t, name) => (t && t.startsWith(name + '<') ? splitArgs(t.slice(name.length + 1, -1)) : null);
  function splitArgs(s) {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const c of s) {
      if (c === '<' || c === '(' || c === '[') depth++;
      if (c === '>' || c === ')' || c === ']') depth--;
      if (c === ',' && !depth) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  const strip = t => (t && t.startsWith('&') ? t.replace(/^&(mut )?/, '') : t);

  // ------------------------------------------------------------ compile
  function compile(src, opts) {
    opts = opts || {};
    const target = opts.board || (opts.consts && opts.consts.BOARD) || 'esp32';
    const ast = parse(src);
    const prog = {
      target, fns: new Map(), structs: new Map(), enums: new Map(), methods: new Map(), consts: [], imports: new Map(), globs: [],
      resolve(segs) {
        const first = segs[0];
        if (this.imports.has(first)) return normPath([this.imports.get(first)].concat(segs.slice(1)).join('::'));
        for (const g of this.globs) if (LIB[`${g}::${first}`]) return [g, first].concat(segs.slice(1)).join('::');
        return normPath(segs.join('::'));
      }
    };
    const warnings = [];
    const warn = (line, text, hint) => warnings.push({ line, text, hint: hint || '' });
    const mods = modulePaths();

    // 1. items
    for (const it of ast.items) {
      if (it.k === 'use') {
        for (const u of it.items) {
          const full = normPath(u.path.join('::'));
          const board = crateBoard(full);
          if (board && board !== target) throw rerr('E0432', `unresolved import \`${u.path[0]}\``, u.line, BOARD_HINT[target]);
          if (u.path[u.path.length - 1] === '*') { prog.globs.push(normPath(u.path.slice(0, -1).join('::'))); continue; }
          if (u.path[u.path.length - 1] === 'self') { const p = u.path.slice(0, -1); prog.imports.set(u.alias || p[p.length - 1], normPath(p.join('::'))); continue; }
          if (!(full in LIB) && !mods.has(full) && !MACRO_IMPORTS.has(full) && !/^std::(fmt|io|collections|cmp|convert|str)(::|$)/.test(full)) {
            const crate = u.path[0];
            const known = ['std', 'rppal', 'esp_idf_svc', 'esp_idf_hal', 'anyhow', 'log', 'core', 'ssd1306', 'embedded_graphics'].includes(crate);
            throw rerr('E0432', `unresolved import \`${u.path.join('::')}\``, u.line, known ? `Το «${u.path[u.path.length - 1]}» δεν υπάρχει εκεί. Έλεγξε την ορθογραφία (κεφαλαία/μικρά).` : `Η βιβλιοθήκη «${crate}» δεν είναι διαθέσιμη σε αυτή την προσομοίωση. ${BOARD_HINT[target === 'pi' ? 'esp32' : 'pi'].split('.').pop()}`);
          }
          const name = u.alias || u.path[u.path.length - 1];
          if (name !== '_') prog.imports.set(name, full);
        }
      } else if (it.k === 'fn') {
        if (prog.fns.has(it.name)) throw rerr('E0428', `the name \`${it.name}\` is defined multiple times`, it.line, `Υπάρχουν δύο συναρτήσεις με το όνομα ${it.name}. Δώσε διαφορετικό όνομα στη μία.`);
        prog.fns.set(it.name, it);
      } else if (it.k === 'struct' || it.k === 'enum') {
        const derives = new Set();
        for (const a of it.attrs || []) { const mm = /^derive\((.*)\)$/.exec(a.text); if (mm) mm[1].split(',').forEach(x => derives.add(x.trim())); }
        it.derives = derives;
        if (derives.has('Copy') && !derives.has('Clone')) throw rerr('E0277', `the trait bound \`${it.name}: Clone\` is not satisfied`, it.line, 'Το Copy θέλει και Clone: #[derive(Clone, Copy)].');
        (it.k === 'struct' ? prog.structs : prog.enums).set(it.name, it);
      } else if (it.k === 'impl') {
        if (!prog.methods.has(it.name)) prog.methods.set(it.name, new Map());
        for (const f of it.fns) { f.implFor = it.name; prog.methods.get(it.name).set(f.name, f); }
      } else if (it.k === 'const') prog.consts.push(it);
    }
    const main = prog.fns.get('main');
    if (!main) throw rerr('E0601', '`main` function not found in crate', 1, 'Κάθε πρόγραμμα Rust ξεκινά από τη fn main() { … }.');
    if (main.params.length) throw rerr('E0580', '`main` function has wrong type', main.line, 'Η main δεν παίρνει παραμέτρους: fn main() { … }.');
    for (const [name, m] of prog.methods) if (!prog.structs.has(name) && !prog.enums.has(name)) throw rerr('E0412', `cannot find type \`${name}\` in this scope`, [...m.values()][0].line, `Το impl ${name} χρειάζεται struct ή enum με το ίδιο όνομα.`);

    // 2. έλεγχος σωμάτων
    const ck = new Checker(prog, warn);
    for (const c of prog.consts) ck.constCheck(c);
    for (const f of prog.fns.values()) ck.fn(f);
    for (const m of prog.methods.values()) for (const f of m.values()) ck.fn(f);
    return { program: prog, warnings };
  }

  // ------------------------------------------------------------ Checker
  const MUT_METHODS = {
    String: new Set(['push', 'push_str', 'pop', 'clear', 'insert', 'remove', 'truncate']),
    Vec: new Set(['push', 'pop', 'clear', 'insert', 'remove', 'sort', 'sort_unstable', 'reverse', 'truncate', 'swap', 'iter_mut', 'retain', 'dedup']),
    OutputPin: new Set(['set_high', 'set_low', 'toggle', 'write', 'set_pwm', 'set_pwm_frequency', 'clear_pwm']),
    PinDriver: new Set(['set_high', 'set_low', 'toggle', 'set_level', 'set_pull']),
    Option: new Set(['take', 'insert', 'replace'])
  };
  const SELF_METHODS = new Set(['into_output', 'into_output_low', 'into_output_high', 'into_input', 'into_input_pullup', 'into_input_pulldown', 'unwrap', 'expect', 'unwrap_or', 'unwrap_or_default', 'into_iter', 'ok', 'err', 'ok_or', 'into']);

  class Checker {
    constructor(prog, warn) { this.prog = prog; this.warn = warn; }

    isCopyTy(t) {
      if (!t) return true;
      if (isIntish(t) || isFloatish(t) || ['bool', 'char', '()', 'Duration', 'Instant', 'Level', '&str', '!'].includes(t)) return true;
      if (t.startsWith('&mut ')) return false;
      if (t.startsWith('&')) return true;
      if (t === 'String' || t.startsWith('Vec<') || /^(OutputPin|InputPin|Pin|Gpio\d*|PinDriver|Peripherals|Pins|Box)/.test(t)) return false;
      const opt = generic(t, 'Option');
      if (opt) return this.isCopyTy(opt[0]);
      const res = generic(t, 'Result');
      if (res) return false;
      if (t.startsWith('(')) return splitArgs(t.slice(1, -1)).every(x => this.isCopyTy(x));
      const def = this.prog.structs.get(t) || this.prog.enums.get(t);
      if (def) return def.derives.has('Copy');
      return true;
    }
    resolveTy(t, self) { return t === 'Self' ? self : t; }

    constCheck(c) {
      const ty = tyStr(c.type);
      const scope = this.newFnScope(null);
      const vt = this.ty(c.value, scope);
      this.compat(ty, vt, c.line, c.value);
    }

    newFnScope(fn) { return { fn, blocks: [new Map()], loops: [], ret: fn ? this.resolveTy(tyStr(fn.ret), fn.implFor) : null }; }
    push(sc) { sc.blocks.push(new Map()); }
    pop(sc) { const b = sc.blocks.pop(); for (const r of b.values()) this.finish(r); }
    finish(r) {
      if (r.isParam === 'self') return;
      if (!r.used && !r.name.startsWith('_')) this.warn(r.line, `unused variable: \`${r.name}\``, `Η μεταβλητή «${r.name}» δεν χρησιμοποιείται πουθενά. Αν δεν τη χρειάζεσαι, γράψε _${r.name}.`);
      else if (r.mut && !r.mutated && !r.name.startsWith('_')) this.warn(r.line, 'variable does not need to be mutable', `Η «${r.name}» δεν αλλάζει ποτέ, άρα δεν χρειάζεται mut.`);
    }
    find(sc, name) { for (let i = sc.blocks.length - 1; i >= 0; i--) { const r = sc.blocks[i].get(name); if (r) return r; } return null; }
    declare(sc, name, o) {
      const r = Object.assign({ name, used: false, mutated: false, moved: null, init: true, loopDepth: sc.loops.length }, o);
      sc.blocks[sc.blocks.length - 1].set(name, r);
      return r;
    }

    fn(f) {
      const sc = this.newFnScope(f);
      for (const p of f.params) {
        if (p.self) this.declare(sc, 'self', { mut: p.mut, ty: p.ref ? `&${p.mut ? 'mut ' : ''}${f.implFor}` : f.implFor, line: p.line, used: true, isParam: 'self', mutated: true });
        else if (p.name !== '_') this.declare(sc, p.name, { mut: p.mut, ty: this.resolveTy(tyStr(p.type), f.implFor), line: p.line, isParam: true });
      }
      const ret = sc.ret;
      const t = this.block(f.body, sc, true);
      // ξεχασμένο ; στην τελευταία γραμμή μιας συνάρτησης που επιστρέφει τιμή
      if (ret && ret !== '()' && ret !== '!' && !f.body.tail && !this.diverges(f.body)) {
        const last = f.body.stmts[f.body.stmts.length - 1];
        const hint = last && last.k === 'expr' && last.semi ? `Η συνάρτηση ${f.name} επιστρέφει ${ret}, αλλά η τελευταία γραμμή τελειώνει με ;. Σβήσε το ; για να γίνει αυτή η τιμή επιστροφής (ή γράψε return …;).` : `Η συνάρτηση ${f.name} πρέπει να επιστρέφει ${ret}. Γράψε την τιμή στο τέλος χωρίς ; (ή return …;).`;
        throw rerr('E0308', `mismatched types: expected \`${ret}\`, found \`()\``, (last && last.line) || f.line, hint);
      }
      if (f.body.tail && ret) this.compat(ret, t, f.body.tail.line || f.endLine, f.body.tail, true);
    }
    diverges(b) {
      const last = b.stmts[b.stmts.length - 1];
      if (!last || last.k !== 'expr') return false;
      const e = last.e;
      if (e.k === 'return' || (e.k === 'macro' && ['panic', 'unreachable', 'todo', 'unimplemented', 'bail'].includes(e.name))) return true;
      if (e.k === 'loop') return !hasBreak(e.body);
      return false;
    }

    block(b, sc, fnBody) {
      this.push(sc);
      for (const st of b.stmts) this.stmt(st, sc);
      const t = b.tail ? this.ty(b.tail, sc, 'move') : (this.diverges(b) ? '!' : '()');
      this.pop(sc);
      return t;
    }

    stmt(st, sc) {
      if (st.k === 'let') {
        const declTy = st.type ? this.resolveTy(tyStr(st.type), sc.fn && sc.fn.implFor) : null;
        let t = null;
        if (st.init) {
          sc.expect = declTy;
          t = this.ty(st.init, sc, 'move');
          sc.expect = null;
          if (declTy) this.compat(declTy, t, st.line, st.init);
          if (declTy && st.init.k === 'lit' && st.init.v.t === 'int' && isIntTy(declTy)) {
            const r = INT_RANGE[declTy];
            if (st.init.v.v < r[0] || st.init.v.v > r[1]) throw rerr('', `literal out of range for \`${declTy}\``, st.line, `Ο τύπος ${declTy} χωράει από ${r[0]} έως ${r[1]}.`);
          }
        }
        let ty = declTy || t;
        if (ty === '{int}') ty = 'i32';
        if (ty === '{float}') ty = 'f64';
        this.bindPat(st.pat, ty, sc, st.line, !st.init);
        return;
      }
      if (st.k === 'expr') {
        const t = this.ty(st.e, sc, 'drop');
        if (st.semi && t && t.startsWith('Result<') && !['assign'].includes(st.e.k)) {
          this.warn(st.line, `unused \`Result\` that must be used`, 'Αυτή η κλήση επιστρέφει Result (μπορεί να αποτύχει) και το αγνοείς. Γράψε ? στο τέλος (π.χ. led.set_high()?;) για να περάσει το λάθος στη main.');
        }
        return;
      }
    }

    bindPat(pat, ty, sc, line, uninit) {
      switch (pat.k) {
        case 'bind': this.declare(sc, pat.name, { mut: pat.mut, ty, line, init: !uninit }); return;
        case 'tuple': { const parts = ty && ty.startsWith('(') ? splitArgs(ty.slice(1, -1)) : []; pat.items.forEach((p, i) => this.bindPat(p, parts[i] || null, sc, line)); return; }
        case 'wild': return;
        default: this.patBind(pat, ty, sc, line);
      }
    }
    // δέσιμο μεταβλητών μέσα σε μοτίβα match / if let
    patBind(pat, ty, sc, line) {
      switch (pat.k) {
        case 'bind': this.declare(sc, pat.name, { mut: pat.mut, ty, line, used: false }); if (pat.sub) this.patBind(pat.sub, ty, sc, line); return;
        case 'or': pat.alts.forEach(a => this.patBind(a, ty, sc, line)); return;
        case 'tuple': { const parts = ty && ty.startsWith('(') ? splitArgs(ty.slice(1, -1)) : []; pat.items.forEach((p, i) => this.patBind(p, parts[i] || null, sc, line)); return; }
        case 'variant': {
          if (!pat.items) {
            const name = pat.segs[pat.segs.length - 1];
            if (pat.segs.length === 2) this.checkVariant(pat.segs, line);
            if (pat.segs.length === 1 && !['None', 'Some', 'Ok', 'Err'].includes(name) && !this.prog.consts.some(c => c.name === name)) {
              const owner = [...this.prog.enums.values()].find(en => en.variants.some(v => v.name === name));
              if (owner) throw rerr('E0170', `pattern binding \`${name}\` is named the same as one of the variants of the type \`${owner.name}\``, line, `Γράψε ${owner.name}::${name}.`);
            }
            return;
          }
          const name = pat.segs[pat.segs.length - 1];
          let inner = [];
          const o = generic(ty, 'Option');
          const r = generic(ty, 'Result');
          if (name === 'Some' && o) inner = [o[0]];
          else if (name === 'Ok' && r) inner = [r[0]];
          else if (name === 'Err' && r) inner = [r[1]];
          else if (pat.segs.length === 2) { const en = this.prog.enums.get(pat.segs[0]); const v = en && en.variants.find(x => x.name === name); if (v && v.types) inner = v.types.map(tyStr); this.checkVariant(pat.segs, line); }
          pat.items.forEach((p, i) => this.patBind(p, inner[i] || null, sc, line));
          return;
        }
        case 'structpat': {
          const def = this.prog.structs.get(pat.segs[pat.segs.length - 1]);
          pat.fields.forEach(f => { const fd = def && def.fields.find(x => x.name === f.name); this.patBind(f.pat, fd ? tyStr(fd.type) : null, sc, line); });
        }
      }
    }
    checkVariant(segs, line) {
      const en = this.prog.enums.get(segs[0]);
      if (en && !en.variants.some(v => v.name === segs[1])) throw rerr('E0599', `no variant named \`${segs[1]}\` found for enum \`${en.name}\``, line, `Το enum ${en.name} έχει: ${en.variants.map(v => v.name).join(', ')}.`);
    }

    // σημειώνει χρήση μεταβλητής· σε θέση «move» μετακινεί την τιμή (αν δεν είναι Copy)
    usePath(e, sc, mode) {
      const name = e.segs[0];
      const r = this.find(sc, name);
      if (!r) return null;
      r.used = true;
      if (!r.init && mode !== 'assign') throw rerr('E0381', `used binding \`${name}\` isn't initialized`, e.line, `Η «${name}» δηλώθηκε χωρίς τιμή. Δώσε της τιμή πριν τη χρησιμοποιήσεις.`);
      if (r.moved) {
        const verb = mode === 'move' ? 'use' : 'borrow';
        const prevIter = r.moved.inLoop;
        throw rerr('E0382', `${verb} of moved value: \`${name}\``, e.line,
          prevIter ? `Η «${name}» μετακινήθηκε (move) μέσα στον βρόχο στη γραμμή ${r.moved.line}, άρα στον επόμενο γύρο δεν υπάρχει πια. Χρησιμοποίησε &${name} (δανεισμό) ή ${name}.clone().`
            : `Στη γραμμή ${r.moved.line} η τιμή της «${name}» μετακινήθηκε (move) και δεν της ανήκει πια. Αν τη χρειάζεσαι κι εδώ: δάνεισέ τη με &${name}, ή φτιάξε αντίγραφο με ${name}.clone().`);
      }
      if (mode === 'move' && !this.isCopyTy(r.ty)) {
        const inLoop = sc.loops.length > r.loopDepth;
        r.moved = { line: e.line, inLoop };
        if (inLoop && !sc.loops[sc.loops.length - 1].exitsAfterMove) {
          throw rerr('E0382', `use of moved value: \`${name}\``, e.line, `Η «${name}» μετακινείται (move) εδώ, μέσα σε βρόχο: στον επόμενο γύρο δεν θα υπάρχει πια. Χρησιμοποίησε &${name} (δανεισμό) ή ${name}.clone().`);
        }
      }
      return r;
    }
    // πεδίο σε move: peripherals.pins.gpio2 (μερικό move)
    fieldPath(e) {
      const parts = [];
      let x = e;
      while (x.k === 'field') { parts.unshift(x.name); x = x.e; }
      if (x.k !== 'path' || x.segs.length !== 1) return null;
      return { root: x.segs[0], key: [x.segs[0]].concat(parts).join('.') };
    }

    // ---------------------------------------------------------- τύπος έκφρασης (null = άγνωστος)
    ty(e, sc, mode) {
      mode = mode || 'borrow';
      switch (e.k) {
        case 'lit': {
          const v = e.v;
          if (v.t === 'int') return v.ty || (sc.expect && isIntTy(sc.expect) ? sc.expect : '{int}');
          if (v.t === 'float') return v.ty || '{float}';
          if (v.t === 'bool') return 'bool';
          if (v.t === 'char') return 'char';
          if (v.t === 'str') return '&str';
          return '()';
        }
        case 'paren': return this.ty(e.e, sc, mode);
        case 'path': {
          if (e.segs.length === 1) {
            const r = this.usePath(e, sc, mode);
            if (r) return r.ty;
            const c = this.prog.consts.find(x => x.name === e.segs[0]);
            if (c) return tyStr(c.type);
            if (this.prog.fns.has(e.segs[0])) return 'fn';
            if (['None'].includes(e.segs[0])) return 'Option<_>';
            const full = this.prog.resolve(e.segs);
            if (full in LIB) return null;
            throw rerr('E0425', `cannot find value \`${e.segs[0]}\` in this scope`, e.line, nameHint(e.segs[0]));
          }
          return this.pathTy(e.segs, e.line, sc);
        }
        case 'block': return this.block(e, sc);
        case 'tuple': return `(${e.items.map(x => this.ty(x, sc, 'move') || '_').join(', ')})`;
        case 'array': { let t = null; for (const x of e.items) t = this.ty(x, sc, 'move') || t; return `[${t || '_'}; _]`; }
        case 'arrayRepeat': return `[${this.ty(e.e, sc, 'move') || '_'}; _]`;
        case 'structlit': {
          const name = e.segs[e.segs.length - 1] === 'Self' ? sc.fn && sc.fn.implFor : e.segs[e.segs.length - 1];
          const def = this.prog.structs.get(name);
          if (!def) throw rerr('E0422', `cannot find struct, variant or union type \`${name}\` in this scope`, e.line);
          for (const f of e.fields) {
            const fd = def.fields.find(x => x.name === f.name);
            const t = this.ty(f.value, sc, 'move');
            if (fd) this.compat(tyStr(fd.type), t, f.line, f.value);
          }
          return name;
        }
        case 'ref': {
          if (e.mut) {
            const root = this.rootVar(e.e, sc);
            if (root && !root.mut && !(root.ty || '').startsWith('&mut')) throw rerr('E0596', `cannot borrow \`${root.name}\` as mutable, as it is not declared as mutable`, e.line, `Για να δανείσεις την «${root.name}» με &mut, πρέπει να δηλωθεί με let mut ${root.name}.`);
            if (root) root.mutated = true;
          }
          const t = this.ty(e.e, sc, 'borrow');
          return t ? `&${e.mut ? 'mut ' : ''}${t}` : null;
        }
        case 'deref': { const t = this.ty(e.e, sc, 'borrow'); return t ? strip(t) : null; }
        case 'neg': { const t = this.ty(e.e, sc, 'borrow'); if (t && t[0] === 'u' && isIntTy(t)) throw rerr('E0600', `cannot apply unary operator \`-\` to type \`${t}\``, e.line, 'Οι τύποι χωρίς πρόσημο (u8, u32…) δεν παίρνουν αρνητικές τιμές.'); return t; }
        case 'not': return this.ty(e.e, sc, 'borrow');
        case 'bin': return this.binTy(e, sc);
        case 'cast': this.ty(e.e, sc, 'borrow'); return tyStr(e.type);
        case 'assign': this.assign(e, sc); return '()';
        case 'range': { const a = e.lo ? this.ty(e.lo, sc) : null; if (e.hi) this.ty(e.hi, sc); return `Range<${a || '_'}>`; }
        case 'if': {
          const c = this.ty(e.cond, sc, 'borrow');
          if (c && c !== 'bool' && c !== '!') throw rerr('E0308', `mismatched types: expected \`bool\`, found \`${c}\``, e.line, isIntish(c) ? 'Στη Rust η συνθήκη πρέπει να είναι bool. Γράψε σύγκριση, π.χ. if x != 0 { … }.' : 'Η συνθήκη του if πρέπει να είναι true ή false.');
          const branches = [];
          const snap = this.snapMoves(sc);
          branches.push(this.block(e.then, sc));
          const afterThen = this.snapMoves(sc);
          this.restoreMoves(sc, snap);
          if (e.els) branches.push(e.els.k === 'block' ? this.block(e.els, sc) : this.ty(e.els, sc, mode));
          this.mergeMoves(sc, afterThen);
          return e.els ? (branches[0] === '!' ? branches[1] : branches[0]) : '()';
        }
        case 'iflet': {
          const t = this.ty(e.e, sc, 'borrow');
          this.push(sc);
          this.patBind(e.pat, t, sc, e.line);
          for (const r of sc.blocks[sc.blocks.length - 1].values()) r.used = true;
          const snap = this.snapMoves(sc);
          const a = this.block(e.then, sc);
          this.pop(sc);
          const afterThen = this.snapMoves(sc);
          this.restoreMoves(sc, snap);
          if (e.els) e.els.k === 'block' ? this.block(e.els, sc) : this.ty(e.els, sc);
          this.mergeMoves(sc, afterThen);
          return e.els ? a : '()';
        }
        case 'match': return this.matchTy(e, sc, mode);
        case 'loop': {
          sc.loops.push({ exitsAfterMove: false });
          this.loopBody(e.body, sc);
          sc.loops.pop();
          return hasBreak(e.body) ? null : '!';
        }
        case 'while': {
          const c = this.ty(e.cond, sc, 'borrow');
          if (c && c !== 'bool') throw rerr('E0308', `mismatched types: expected \`bool\`, found \`${c}\``, e.line, 'Η συνθήκη του while πρέπει να είναι true ή false.');
          sc.loops.push({ exitsAfterMove: false });
          this.loopBody(e.body, sc);
          sc.loops.pop();
          return '()';
        }
        case 'whilelet': {
          const t = this.ty(e.e, sc, 'borrow');
          sc.loops.push({ exitsAfterMove: false });
          this.push(sc);
          this.patBind(e.pat, t, sc, e.line);
          for (const r of sc.blocks[sc.blocks.length - 1].values()) r.used = true;
          this.loopBody(e.body, sc);
          this.pop(sc);
          sc.loops.pop();
          return '()';
        }
        case 'for': {
          let it = this.ty(e.iter, sc, e.iter.k === 'path' ? 'move' : 'borrow');
          let el = null;
          if (it && it.startsWith('Range<')) el = it.slice(6, -1);
          else if (it && (generic(strip(it), 'Vec'))) el = (it.startsWith('&') ? '&' : '') + generic(strip(it), 'Vec')[0];
          if (el === '{int}') el = 'i32';
          sc.loops.push({ exitsAfterMove: false });
          this.push(sc);
          this.bindPat(e.pat, el === '_' ? null : el, sc, e.line);
          for (const r of sc.blocks[sc.blocks.length - 1].values()) r.loopDepth = sc.loops.length;
          this.loopBody(e.body, sc);
          this.pop(sc);
          sc.loops.pop();
          return '()';
        }
        case 'break': if (e.e) this.ty(e.e, sc, 'move'); return '!';
        case 'continue': return '!';
        case 'return': {
          const t = e.e ? this.ty(e.e, sc, 'move') : '()';
          if (sc.ret) this.compat(sc.ret, t, e.line, e.e, true);
          return '!';
        }
        case 'try': {
          const t = this.ty(e.e, sc, 'move');
          const ret = sc.ret;
          const retOk = ret && (ret.startsWith('Result<') || ret.startsWith('Option<'));
          if (!retOk) throw rerr('E0277', `the \`?\` operator can only be used in a function that returns \`Result\` or \`Option\``, e.line,
            sc.fn && sc.fn.name === 'main' ? (this.prog.target === 'pi' ? 'Για να χρησιμοποιήσεις ? στη main, γράψε: fn main() -> Result<(), Box<dyn Error>> { … Ok(()) }' : 'Για να χρησιμοποιήσεις ? στη main, γράψε: fn main() -> anyhow::Result<()> { … }') : `Η ${sc.fn ? sc.fn.name : 'συνάρτηση'} πρέπει να επιστρέφει Result για να χρησιμοποιήσει ?.`);
          const r = generic(t, 'Result');
          if (r) return r[0];
          const o = generic(t, 'Option');
          if (o) return o[0];
          if (t && !t.startsWith('Result') && !t.startsWith('Option') && t !== '_' && !t.includes('_')) throw rerr('E0277', `the \`?\` operator can only be applied to values that implement \`Try\``, e.line, `Το ? μπαίνει μόνο μετά από Result ή Option, όχι μετά από ${t}.`);
          return null;
        }
        case 'field': {
          if (mode === 'move') {
            const fp = this.fieldPath(e);
            if (fp) {
              const r = this.find(sc, fp.root);
              if (r) {
                r.used = true;
                r.partial = r.partial || new Map();
                if (r.partial.has(fp.key)) throw rerr('E0382', `use of moved value: \`${fp.key}\``, e.line, `Το ${fp.key} το έχεις ήδη δώσει (move) στη γραμμή ${r.partial.get(fp.key)}. Κάθε pin μπορεί να έχει έναν μόνο ιδιοκτήτη: φτιάξε έναν driver και χρησιμοποίησέ τον παντού.`);
                if (/^gpio\d+$/.test(e.name) || r.ty && !this.isCopyTy(this.fieldTy(r.ty, e.name))) r.partial.set(fp.key, e.line);
                return this.fieldTy(r.ty, e.name);
              }
            }
          }
          const bt = this.ty(e.e, sc, 'borrow');
          return this.fieldTy(bt, e.name, e.line);
        }
        case 'index': {
          const bt = this.ty(e.e, sc, 'borrow');
          const it = this.ty(e.idx, sc, 'borrow');
          if (it && isIntTy(it) && it !== 'usize') throw rerr('E0277', `the type \`[${(generic(strip(bt) || '', 'Vec') || ['_'])[0]}]\` cannot be indexed by \`${it}\``, e.line, 'Οι θέσεις σε Vec και πίνακες είναι τύπου usize. Γράψε v[i as usize] ή δήλωσε i: usize.');
          if (it && it.startsWith('Range')) return bt;
          if (strip(bt) === 'String' || strip(bt) === '&str' || bt === '&str') throw rerr('E0277', 'the type `str` cannot be indexed by `{integer}`', e.line, 'Στη Rust δεν γράφεις s[0] σε κείμενο (οι χαρακτήρες έχουν διαφορετικό μέγεθος σε bytes). Χρησιμοποίησε s.chars().nth(0).');
          const v = bt && (generic(strip(bt), 'Vec') || (/^\[(.*); _\]$/.exec(strip(bt)) || [])[1] && [/^\[(.*); _\]$/.exec(strip(bt))[1]]);
          return v ? v[0] : null;
        }
        case 'call': return this.callTy(e, sc);
        case 'method': return this.methodTy(e, sc);
        case 'macro': return this.macroTy(e, sc);
      }
      return null;
    }

    loopBody(body, sc) {
      // αν μέσα στον βρόχο, αμέσως μετά από ένα move ακολουθεί break/return, δεν υπάρχει «επόμενος γύρος»
      const loop = sc.loops[sc.loops.length - 1];
      this.push(sc);
      for (let i = 0; i < body.stmts.length; i++) {
        const nx = body.stmts[i + 1] || (body.tail ? { k: 'expr', e: body.tail } : null);
        loop.exitsAfterMove = !!(nx && nx.k === 'expr' && (nx.e.k === 'break' || nx.e.k === 'return'));
        this.stmt(body.stmts[i], sc);
      }
      loop.exitsAfterMove = false;
      if (body.tail) this.ty(body.tail, sc, 'drop');
      this.pop(sc);
    }

    snapMoves(sc) { const m = new Map(); for (const b of sc.blocks) for (const r of b.values()) m.set(r, r.moved); return m; }
    restoreMoves(sc, snap) { for (const [r, mv] of snap) r.moved = mv; }
    mergeMoves(sc, other) { for (const [r, mv] of other) if (mv && !r.moved) r.moved = mv; }

    rootVar(e, sc) {
      let x = e;
      while (x.k === 'field' || x.k === 'index' || x.k === 'paren') x = x.e;
      if (x.k === 'deref') return null;
      if (x.k === 'path' && x.segs.length === 1) return this.find(sc, x.segs[0]);
      return null;
    }

    assign(e, sc) {
      const rt = this.ty(e.value, sc, 'move');
      const t = e.target;
      if (t.k === 'path' && t.segs.length === 1) {
        const r = this.find(sc, t.segs[0]);
        if (!r) {
          if (this.prog.consts.some(c => c.name === t.segs[0])) throw rerr('E0070', 'invalid left-hand side of assignment', e.line, `Η ${t.segs[0]} είναι σταθερά (const) και δεν αλλάζει.`);
          throw rerr('E0425', `cannot find value \`${t.segs[0]}\` in this scope`, e.line, `Η μεταβλητή «${t.segs[0]}» πρέπει πρώτα να δηλωθεί με let mut ${t.segs[0]} = …;`);
        }
        if (!r.init && e.op === '=') { r.init = true; r.used = r.used || false; if (!r.ty) r.ty = rt === '{int}' ? 'i32' : rt; return; }
        if (!r.mut) throw rerr('E0384', `cannot assign twice to immutable variable \`${r.name}\``, e.line, `Η «${r.name}» δεν είναι mut, άρα η τιμή της δεν αλλάζει. Γράψε let mut ${r.name} = … εκεί που τη δηλώνεις (γραμμή ${r.line}).`);
        r.mutated = true;
        if (e.op !== '=') { r.used = true; this.arithCheck(e.op.slice(0, -1), r.ty, rt, e.line); }
        else this.compat(r.ty, rt, e.line, e.value);
        r.moved = null;
        r.partial = null;
        return;
      }
      if (t.k === 'deref') {
        const r = this.rootVar(t.e, sc);
        if (r) { r.used = true; if (r.ty && r.ty.startsWith('&') && !r.ty.startsWith('&mut')) throw rerr('E0594', `cannot assign to \`*${r.name}\`, which is behind a \`&\` reference`, e.line, `Η «${r.name}» είναι απλός δανεισμός (&). Για να αλλάξεις την τιμή χρειάζεται &mut.`); }
        return;
      }
      const r = this.rootVar(t, sc);
      if (r) {
        r.used = true;
        const viaRef = r.ty && r.ty.startsWith('&mut');
        if (r.ty && r.ty.startsWith('&') && !viaRef) throw rerr('E0594', `cannot assign to data in a \`&\` reference`, e.line, `Η «${r.name}» είναι απλός δανεισμός (&). Για να αλλάξεις κάτι μέσα της χρειάζεται &mut.`);
        if (!r.mut && !viaRef) throw rerr('E0594', `cannot assign to \`${exprText(t)}\`, as \`${r.name}\` is not declared as mutable`, e.line, `Για να αλλάξεις κάτι μέσα στην «${r.name}», δήλωσέ τη με let mut ${r.name}.`);
        r.mutated = true;
      }
      this.ty(t, sc, 'borrow');
    }

    binTy(e, sc) {
      const op = e.op;
      if (op === '&&' || op === '||') {
        const a = this.ty(e.l, sc, 'borrow');
        const b = this.ty(e.r, sc, 'borrow');
        for (const x of [a, b]) if (x && x !== 'bool') throw rerr('E0308', `mismatched types: expected \`bool\`, found \`${x}\``, e.line, `Το ${op} ενώνει συνθήκες (true/false).`);
        return 'bool';
      }
      const lmode = op === '+' ? 'move' : 'borrow';
      const lt0 = this.ty(e.l, sc, 'borrow');
      if (op === '+' && lt0 === 'String' && e.l.k === 'path') this.usePath(e.l, sc, 'move');
      const rt = this.ty(e.r, sc, 'borrow');
      const lt = lt0;
      if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
        if (lt && rt && ((isIntish(lt) && isFloatish(rt)) || (isFloatish(lt) && isIntish(rt)))) throw rerr('E0308', `mismatched types: expected \`${lt}\`, found \`${rt}\``, e.line, 'Συγκρίνεις ακέραιο με δεκαδικό. Γράψε τον αριθμό με τελεία (π.χ. 20.0) ή μετάτρεψε με as.');
        if (lt && rt && isIntTy(lt) && isIntTy(rt) && lt !== rt) throw rerr('E0308', `mismatched types: expected \`${lt}\`, found \`${rt}\``, e.line, `Μετάτρεψε τη μία τιμή: x as ${lt}.`);
        return 'bool';
      }
      if (op === '+' && (lt === 'String' || lt === '&str')) {
        if (lt === '&str') throw rerr('E0369', 'cannot add `&str` to `&str`', e.line, 'Δύο &str δεν προστίθενται. Γράψε String::from("…") + "…" ή format!("{}{}", a, b).');
        if (rt === 'String') throw rerr('E0308', 'mismatched types: expected `&str`, found `String`', e.line, 'Στο String + … το δεξί πρέπει να είναι &str: γράψε a + &b.');
        return 'String';
      }
      void lmode;
      return this.arithCheck(op, lt, rt, e.line);
    }
    arithCheck(op, lt, rt, line) {
      if (!lt || !rt) return lt || rt;
      if ((isIntish(lt) && isFloatish(rt)) || (isFloatish(lt) && isIntish(rt))) {
        const words = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '%': 'calculate the remainder of' };
        throw rerr('E0277', `cannot ${words[op] || 'combine'} \`${rt}\` ${op === '+' ? 'to' : op === '-' ? 'from' : 'by'} \`${lt}\``, line, 'Η Rust δεν ανακατεύει ακεραίους και δεκαδικούς. Μετάτρεψε τον ακέραιο με as (π.χ. x as f32) ή γράψε τον αριθμό με τελεία (2.0).');
      }
      if (isIntTy(lt) && isIntTy(rt) && lt !== rt && op !== '<<' && op !== '>>') throw rerr('E0308', `mismatched types: expected \`${lt}\`, found \`${rt}\``, line, `Οι δύο αριθμοί έχουν διαφορετικό τύπο (${lt} και ${rt}). Μετάτρεψε τον έναν: (y as ${lt}).`);
      if ((lt === 'f32' && rt === 'f64') || (lt === 'f64' && rt === 'f32')) throw rerr('E0308', `mismatched types: expected \`${lt}\`, found \`${rt}\``, line, `Μετάτρεψε: (y as ${lt}).`);
      if (lt === 'Instant' && rt === 'Instant') return 'Duration';
      return lt === '{int}' || lt === '{float}' ? rt : lt;
    }

    // συμβατότητα τύπου που περιμένουμε με τύπο που βρήκαμε (μόνο όταν είμαστε σίγουροι)
    compat(want, got, line, expr, isReturn) {
      if (!want || !got || want === got || got === '!' || want === '_' || got.includes('_') || want.includes('_')) return;
      want = want.replace(/^Self$/, want);
      if (isIntTy(want) && got === '{int}') return;
      if (isFloatish(want) && got === '{float}') return;
      if ((want === 'f32' || want === 'f64') && got === '{int}') throw rerr('E0308', `mismatched types: expected \`${want}\`, found integer`, line, `Για δεκαδικό γράψε τον αριθμό με τελεία, π.χ. ${expr && expr.k === 'lit' ? expr.v.v : 20}.0.`);
      if (isIntTy(want) && got === '{float}') throw rerr('E0308', `mismatched types: expected \`${want}\`, found floating-point number`, line, `Ο τύπος ${want} κρατά μόνο ακεραίους. Για δεκαδικούς χρησιμοποίησε f32.`);
      const simple = t => isIntTy(t) || isFloatish(t) || ['bool', 'char', '&str', 'String', '&String', '()'].includes(t);
      if (want === '&str' && got === '&String') return;
      if (want === 'String' && got === '&str') throw rerr('E0308', 'mismatched types: expected `String`, found `&str`', line, 'Το "…" είναι &str. Για String γράψε "…".to_string() ή String::from("…").');
      if ((want === '&str' || want === '&String') && got === 'String') throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`String\``, line, `Η συνάρτηση θέλει δανεισμό, όχι την ίδια την τιμή. Βάλε & μπροστά: &${expr && expr.k === 'path' ? expr.segs[0] : 'x'}.`);
      if (want.startsWith('&') && !got.startsWith('&') && strip(want) === got) throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`${got}\``, line, `Βάλε ${want.startsWith('&mut') ? '&mut ' : '&'} μπροστά από την τιμή για να τη δανείσεις.`);
      if (!want.startsWith('&') && got.startsWith('&') && strip(got) === want && !this.isCopyTy(want)) throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`${got}\``, line, 'Εδώ χρειάζεται η ίδια η τιμή, όχι δανεισμός. Αφαίρεσε το & ή γράψε .clone().');
      if (simple(want) && simple(got) && strip(want) !== strip(got)) {
        if (isIntTy(want) && isIntTy(got)) throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`${got}\``, line, `Μετάτρεψε την τιμή: (… as ${want}).`);
        throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`${got}\``, line, isReturn ? `Η συνάρτηση δηλώνει ότι επιστρέφει ${want}.` : '');
      }
      if (simple(want) && want !== '()' && (got.startsWith('Result<') || got.startsWith('Option<'))) {
        throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`${got}\``, line, got.startsWith('Result<')
          ? 'Η τιμή είναι Result (μπορεί να είναι λάθος). Βγάλε την τιμή με ? (μέσα σε συνάρτηση που επιστρέφει Result) ή με match.'
          : 'Η τιμή είναι Option (μπορεί να λείπει). Βγάλε την τιμή με match, if let ή ?.');
      }
      const wo = generic(want, 'Option');
      const go = generic(got, 'Option');
      if (wo && go) this.compat(wo[0], go[0], line, null, isReturn);
      if (wo && !go && simple(got)) throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`${got}\``, line, `Περιμένει Option. Τύλιξε την τιμή: Some(…), ή γράψε None.`);
      if (want.startsWith('Result<') && simple(got) && got !== '()') throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`${got}\``, line, 'Περιμένει Result. Τύλιξε την τιμή: Ok(…).');
      if (want.startsWith('Result<') && got === '()' && isReturn) throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`()\``, line, 'Η συνάρτηση επιστρέφει Result. Στο τέλος γράψε Ok(()) χωρίς ;.');
      const ws = this.prog.structs.has(want) || this.prog.enums.has(want);
      const gs = this.prog.structs.has(got) || this.prog.enums.has(got);
      if ((ws || gs) && want !== got && (simple(got) || simple(want) || (ws && gs))) throw rerr('E0308', `mismatched types: expected \`${want}\`, found \`${got}\``, line);
    }

    fieldTy(bt, name, line) {
      const t = strip(bt);
      if (!t) return null;
      if (t === 'Peripherals' && name === 'pins') return 'Pins';
      if (t === 'Pins') return /^gpio\d+$/.test(name) ? `Gpio${name.slice(4)}` : null;
      if (t.startsWith('(')) return splitArgs(t.slice(1, -1))[Number(name)] || null;
      const def = this.prog.structs.get(t);
      if (def) {
        const f = def.fields.find(x => x.name === name);
        if (!f && line) throw rerr('E0609', `no field \`${name}\` on type \`${t}\``, line, `Τα πεδία του ${t}: ${def.fields.map(x => x.name).join(', ')}.`);
        return f ? tyStr(f.type) : null;
      }
      return null;
    }

    pathTy(segs, line, sc) {
      const last = segs[segs.length - 1];
      const head = segs[0] === 'Self' && sc.fn ? sc.fn.implFor : segs[0];
      if (segs.length === 2 && this.prog.enums.has(head)) { this.checkVariant([head, last], line); return head; }
      if (segs.length === 2 && (isIntTy(head) || head === 'f32' || head === 'f64') && (last === 'MAX' || last === 'MIN')) return head;
      const full = this.prog.resolve(segs);
      const typeFull = this.prog.resolve(segs.slice(0, -1));
      const lib = LIB[full] || LIB[typeFull];
      const libFull = LIB[full] ? full : typeFull;
      if (lib) {
        if (lib.board && lib.board !== this.prog.target) throw rerr('E0433', `failed to resolve: could not find \`${segs[0]}\``, line, BOARD_HINT[this.prog.target]);
        return LIB_TYPES[`${libFull}${LIB[full] ? '' : '::' + last}`] || (libFull.endsWith('Level') ? 'Level' : null);
      }
      if (segs.length === 2 && (this.prog.methods.get(head) || new Map()).has(last)) return 'fn';
      if (['String', 'Vec', 'Box', 'Some', 'None', 'Ok', 'Err', 'std', 'core', 'f32', 'f64', 'i32', 'u8', 'u32', 'u64', 'usize', 'i64', 'u16', 'i16', 'i8', 'u128'].includes(segs[0])) return null;
      if (this.prog.structs.has(head)) throw rerr('E0599', `no function or associated item named \`${last}\` found for struct \`${head}\` in the current scope`, line, `Πρόσθεσε fn ${last}(…) μέσα στο impl ${head} { … }.`);
      throw rerr('E0433', `failed to resolve: use of undeclared type \`${segs[0]}\``, line, useHint(segs[0], this.prog.target));
    }

    callTy(e, sc) {
      const f = e.fn;
      if (f.k === 'path') {
        const name = f.segs[f.segs.length - 1];
        // Option / Result / box
        if (f.segs.length === 1 && (name === 'Some' || name === 'Ok' || name === 'Err')) {
          const inner = e.args.length ? this.ty(e.args[0], sc, 'move') : '()';
          const fix = t => (t === '{int}' ? 'i32' : t === '{float}' ? 'f64' : t);
          if (name === 'Some') return `Option<${fix(inner) || '_'}>`;
          if (name === 'Ok') return `Result<${fix(inner) || '_'}, _>`;
          return `Result<_, ${fix(inner) || '_'}>`;
        }
        // συνάρτηση του χρήστη
        let def = null;
        if (f.segs.length === 1) {
          if (this.find(sc, name)) throw rerr('E0618', `expected function, found local variable \`${name}\``, e.line);
          def = this.prog.fns.get(name);
          if (!def) {
            const full = this.prog.resolve(f.segs);
            if (!(full in LIB)) {
              e.args.forEach(a => this.ty(a, sc, 'move'));
              throw rerr('E0425', `cannot find function \`${name}\` in this scope`, e.line, name === 'println' || name === 'print' ? `Το ${name} είναι μακροεντολή: ${name}!("…").` : name === 'sleep' ? 'Γράψε thread::sleep(Duration::from_millis(…)) με use std::thread;' : 'Έλεγξε την ορθογραφία ή ότι η συνάρτηση ορίζεται με fn.');
            }
          }
        } else if (f.segs.length === 2) {
          const tyName = f.segs[0] === 'Self' && sc.fn ? sc.fn.implFor : f.segs[0];
          const m = this.prog.methods.get(tyName);
          if (m && m.has(name)) def = m.get(name);
          else if (this.prog.enums.has(tyName)) { this.checkVariant([tyName, name], e.line); e.args.forEach(a => this.ty(a, sc, 'move')); return tyName; }
        }
        if (def) {
          const params = def.params.filter(p => !p.self);
          if (def.params[0] && def.params[0].self && f.segs.length === 2) params.unshift({ name: 'self', type: null });
          if (params.length !== e.args.length) throw rerr('E0061', `this function takes ${params.length} argument${params.length === 1 ? '' : 's'} but ${e.args.length} argument${e.args.length === 1 ? ' was' : 's were'} supplied`, e.line, `Η ${def.name}() θέλει ${params.length} τιμ${params.length === 1 ? 'ή' : 'ές'} μέσα στις παρενθέσεις, χωρισμένες με κόμμα.`);
          e.args.forEach((a, i) => {
            const pt = params[i].type ? this.resolveTy(tyStr(params[i].type), def.implFor) : null;
            const saved = sc.expect;
            sc.expect = pt;
            const at = this.ty(a, sc, 'move');
            sc.expect = saved;
            if (pt) this.compat(pt, at, a.line || e.line, a);
          });
          const rt = this.resolveTy(tyStr(def.ret), def.implFor);
          return rt;
        }
        e.args.forEach(a => this.ty(a, sc, 'move'));
        const pt = this.pathTy(f.segs, e.line, sc);
        if (pt === 'fn') return null;
        const full = this.prog.resolve(f.segs);
        const known = LIB_TYPES[full] || LIB_TYPES[normPath(full)] || pt;
        if (known === 'Vec<_>' && sc.expect && sc.expect.startsWith('Vec<')) return sc.expect;
        return known;
      }
      e.args.forEach(a => this.ty(a, sc, 'move'));
      return null;
    }

    methodTy(e, sc) {
      const name = e.name;
      // παραλήπτης: δανεισμός, εκτός από μεθόδους που «καταναλώνουν» την τιμή (into_output, unwrap…)
      let rt = this.ty(e.e, sc, 'borrow');
      const base = strip(rt);
      const consumes = SELF_METHODS.has(name) && e.e.k === 'path';
      const userDef = base && this.prog.methods.get(base) && this.prog.methods.get(base).get(name);
      if (consumes && !this.isCopyTy(rt)) this.usePath(e.e, sc, 'move');
      // &mut self
      const mutating = userDef ? !!(userDef.params[0] && userDef.params[0].self && userDef.params[0].mut && userDef.params[0].ref)
        : base && Object.entries(MUT_METHODS).some(([k, set]) => (base === k || base.startsWith(k + '<')) && set.has(name));
      if (mutating) {
        const root = this.rootVar(e.e, sc);
        if (root) {
          const viaRef = root.ty && root.ty.startsWith('&mut');
          if (root.ty && root.ty.startsWith('&') && !viaRef && e.e.k === 'path') throw rerr('E0596', `cannot borrow \`*${root.name}\` as mutable, as it is behind a \`&\` reference`, e.line, `Η «${root.name}» είναι απλός δανεισμός (&). Για να καλέσεις την .${name}() χρειάζεται &mut: άλλαξε τον τύπο της παραμέτρου σε &mut ${strip(root.ty)}.`);
          if (!root.mut && !viaRef && !(root.ty || '').startsWith('&')) throw rerr('E0596', `cannot borrow \`${root.name}\` as mutable, as it is not declared as mutable`, e.line, `Η .${name}() αλλάζει την «${root.name}», άρα πρέπει να δηλωθεί με let mut ${root.name} = …;`);
          root.mutated = true;
        }
      } else if (name === 'next' || name === 'nth') {
        // iterator.next() αλλάζει τον iterator (π.χ. let mut parts = s.split_whitespace();): το mut χρειάζεται
        const root = this.rootVar(e.e, sc);
        if (root) root.mutated = true;
      }
      if (userDef) {
        const params = userDef.params.slice(1);
        if (params.length !== e.args.length) throw rerr('E0061', `this method takes ${params.length} argument${params.length === 1 ? '' : 's'} but ${e.args.length} argument${e.args.length === 1 ? ' was' : 's were'} supplied`, e.line);
        e.args.forEach((a, i) => { const pt = this.resolveTy(tyStr(params[i].type), base); const at = this.ty(a, sc, 'move'); this.compat(pt, at, e.line, a); });
        if (userDef.params[0] && userDef.params[0].self && !userDef.params[0].ref && e.e.k === 'path' && !this.isCopyTy(base)) this.usePath(e.e, sc, 'move');
        return this.resolveTy(tyStr(userDef.ret), base);
      }
      if (base && (this.prog.structs.has(base) || this.prog.enums.has(base)) && !['clone', 'eq', 'to_string'].includes(name)) {
        throw rerr('E0599', `no method named \`${name}\` found for ${this.prog.structs.has(base) ? 'struct' : 'enum'} \`${base}\` in the current scope`, e.line, `Πρόσθεσε fn ${name}(&self) μέσα στο impl ${base} { … }.`);
      }
      const argTys = e.args.map(a => this.ty(a, sc, ['push', 'insert'].includes(name) ? 'move' : 'borrow'));
      if (base === 'String' && name === 'push_str' && argTys[0] === 'String') throw rerr('E0308', 'mismatched types: expected `&str`, found `String`', e.line, `Δάνεισε το κείμενο: .push_str(&${e.args[0].k === 'path' ? e.args[0].segs[0] : 'x'}).`);
      if (base === '&str' && ['push', 'push_str', 'clear'].includes(name)) throw rerr('E0599', `no method named \`${name}\` found for reference \`&str\` in the current scope`, e.line, 'Ένα "…" (&str) δεν αλλάζει. Για κείμενο που μεγαλώνει φτιάξε String: let mut s = String::from("…");');
      // let n: u32 = s.parse()?; / .unwrap(): ο τύπος του parse έρχεται από τη δήλωση, όπως στο rustc
      const ex = sc.expect;
      if (name === 'parse' && !e.turbofish && ex && (base === 'String' || base === '&str' || base === 'str') && (isIntTy(ex) || ex === 'f32' || ex === 'f64' || ex === 'bool')) {
        return `Result<${ex}, ${ex === 'bool' ? 'ParseBoolError' : isFloatish(ex) ? 'ParseFloatError' : 'ParseIntError'}>`;
      }
      return methodRet(base, name, e, argTys);
    }

    matchTy(e, sc, mode) {
      const t = this.ty(e.e, sc, 'borrow');
      let out = null;
      const before = this.snapMoves(sc);
      const after = [];
      for (const arm of e.arms) {
        this.restoreMoves(sc, before);
        this.push(sc);
        this.patBind(arm.pat, strip(t), sc, arm.line);
        for (const r of sc.blocks[sc.blocks.length - 1].values()) r.used = true;
        if (arm.guard) this.ty(arm.guard, sc, 'borrow');
        const bt = this.ty(arm.body, sc, 'move');
        if (bt && bt !== '!' && !out) out = bt;
        this.pop(sc);
        after.push(this.snapMoves(sc));
      }
      this.restoreMoves(sc, before);
      for (const a of after) this.mergeMoves(sc, a);
      this.exhaustive(e, strip(t));
      return out;
    }
    exhaustive(e, t) {
      const arms = e.arms.filter(a => !a.guard);
      const catchAll = p => p.k === 'wild' || (p.k === 'bind' && !p.sub) || (p.k === 'or' && p.alts.some(catchAll));
      // warning: unreachable pattern — σκέλος που το καλύπτει ήδη ένα προηγούμενο (π.χ. 0..=49 πριν από 0..=19)
      const span = p => {
        const num = x => (x && typeof x.v === 'number' ? x.v : null);
        if (p.k === 'lit' && num(p.v) !== null) return [num(p.v), num(p.v)];
        if (p.k === 'range') {
          const lo = p.lo ? num(p.lo) : -Infinity;
          const hi = p.hi ? num(p.hi) - (p.incl ? 0 : 1) : Infinity;
          return lo === null || hi === null ? null : [lo, hi];
        }
        return null;
      };
      const seen = [];
      for (const a of arms) {
        const sp = span(a.pat);
        if (seen.some(x => x === 'all') || (sp && seen.some(x => x !== 'all' && x[0] <= sp[0] && sp[1] <= x[1]))) {
          this.warn(a.line, 'unreachable pattern', 'Αυτό το σκέλος δεν θα τρέξει ποτέ: ένα προηγούμενο σκέλος πιάνει ήδη αυτές τις τιμές. Το match δοκιμάζει τα σκέλη με τη σειρά, από πάνω προς τα κάτω.');
        }
        if (catchAll(a.pat)) seen.push('all');
        else if (sp) seen.push(sp);
      }
      if (arms.some(a => catchAll(a.pat))) return;
      const names = new Set();
      const nested = new Map();   // Ok(Command::LedOn), Ok(Command::Blink(n)) …: εσωτερικά patterns ανά παραλλαγή
      const add = p => {
        if (p.k === 'or') p.alts.forEach(add);
        else if (p.k === 'variant' && (!p.items || p.items.every(catchAll))) names.add(p.segs[p.segs.length - 1]);
        else if (p.k === 'variant' && p.items.length === 1) {
          const n = p.segs[p.segs.length - 1];
          if (!nested.has(n)) nested.set(n, []);
          nested.get(n).push(p.items[0]);
        } else if (p.k === 'lit' && p.v.t === 'bool') names.add(String(p.v.v));
      };
      arms.forEach(a => add(a.pat));
      for (const [n, pats] of nested) if (!names.has(n) && this.covers(pats, this.innerTy(t, n))) names.add(n);
      let need = null;
      if (t && t.startsWith('Option<')) need = ['Some', 'None'];
      else if (t && t.startsWith('Result<')) need = ['Ok', 'Err'];
      else if (t === 'bool') need = ['true', 'false'];
      else if (t === 'Level') need = ['High', 'Low'];
      else if (t && this.prog.enums.has(t)) need = this.prog.enums.get(t).variants.map(v => v.name);
      if (need) {
        const missing = need.filter(n => !names.has(n));
        if (missing.length) {
          const show = missing.map(n => (t && this.prog.enums.has(t) ? `\`${t}::${n}\`` : n === 'Some' || n === 'Ok' || n === 'Err' ? `\`${n}(_)\`` : `\`${n}\``));
          throw rerr('E0004', `non-exhaustive patterns: ${show.join(', ')} not covered`, e.line, `Το match πρέπει να καλύπτει κάθε περίπτωση. Λείπει: ${missing.join(', ')}. Πρόσθεσε σκέλος για ${missing.length > 1 ? 'αυτές' : 'αυτή'} ή ένα _ => … στο τέλος.`);
        }
        return;
      }
      if (t && (isIntTy(t) || t === '{int}' || t === 'char' || t === '&str' || t === 'String' || isFloatish(t))) {
        throw rerr('E0004', 'non-exhaustive patterns: `_` not covered', e.line, 'Ένας αριθμός ή ένα κείμενο έχει άπειρες πιθανές τιμές. Πρόσθεσε στο τέλος ένα σκέλος _ => … για «όλα τα άλλα».');
      }
    }

    // ο τύπος μέσα σε μια παραλλαγή: Some(T), Ok(T), Err(E), Enum::V(T)
    innerTy(t, name) {
      if (!t) return null;
      const o = generic(t, 'Option');
      if (o) return name === 'Some' ? o[0] : null;
      const r = generic(t, 'Result');
      if (r) return name === 'Ok' ? r[0] : name === 'Err' ? (r[1] || null) : null;
      const def = this.prog.enums.get(t);
      const v = def && def.variants.find(x => x.name === name);
      return v && v.types && v.types.length === 1 ? tyStr(v.types[0]) : null;
    }
    // Καλύπτουν αυτά τα patterns όλες τις τιμές του τύπου t; (άγνωστος τύπος → ναι, για να μη βγει ψεύτικο λάθος)
    covers(pats, t) {
      const catchAll = p => p.k === 'wild' || (p.k === 'bind' && !p.sub) || (p.k === 'or' && p.alts.some(catchAll));
      if (pats.some(catchAll)) return true;
      t = strip(t);
      if (!t) return true;
      const flat = [];
      const add = p => { if (p.k === 'or') p.alts.forEach(add); else flat.push(p); };
      pats.forEach(add);
      let need = null;
      if (t.startsWith('Option<')) need = ['Some', 'None'];
      else if (t.startsWith('Result<')) need = ['Ok', 'Err'];
      else if (t === 'bool') return ['true', 'false'].every(b => flat.some(p => p.k === 'lit' && String(p.v.v) === b));
      else if (this.prog.enums.has(t)) need = this.prog.enums.get(t).variants.map(v => v.name);
      if (!need) return false;
      return need.every(n => {
        const mine = flat.filter(p => p.k === 'variant' && p.segs[p.segs.length - 1] === n);
        if (mine.some(p => !p.items || p.items.every(catchAll))) return true;
        const subs = mine.filter(p => p.items && p.items.length === 1).map(p => p.items[0]);
        return subs.length > 0 && this.covers(subs, this.innerTy(t, n));
      });
    }

    macroTy(e, sc) {
      const name = e.name;
      const fmtMacros = ['println', 'print', 'eprintln', 'eprint', 'format', 'panic', 'info', 'warn', 'error', 'debug', 'anyhow', 'bail', 'unreachable', 'todo', 'unimplemented'];
      if (fmtMacros.includes(name)) {
        if (['info', 'warn', 'error', 'debug'].includes(name) && !this.prog.imports.has(name) && this.prog.target !== 'esp32') {
          throw rerr('', `cannot find macro \`${name}\` in this scope`, e.line, `Πρόσθεσε use log::${name}; ή χρησιμοποίησε println!.`);
        }
        const [first, ...rest] = e.args;
        if (first && (first.k !== 'lit' || first.v.t !== 'str')) {
          if (name === 'println' || name === 'print' || name === 'format') throw rerr('', 'format argument must be a string literal', e.line, `Το πρώτο όρισμα είναι πάντα κείμενο σε "…" με {} για τις τιμές, π.χ. ${name}!("{}", x).`);
        }
        if (first && first.k === 'lit') {
          // ονόματα μέσα στο κείμενο: println!("{x}")
          const re = /\{([A-Za-z_][A-Za-z0-9_]*)(?::[^}]*)?\}/g;
          const txt = first.v.v.replace(/\{\{|\}\}/g, '');
          let mm;
          while ((mm = re.exec(txt))) {
            const r = this.find(sc, mm[1]);
            if (r) this.usePath({ segs: [mm[1]], line: e.line }, sc, 'borrow');
            else if (!this.prog.consts.some(c => c.name === mm[1])) throw rerr('E0425', `cannot find value \`${mm[1]}\` in this scope`, e.line, nameHint(mm[1]));
          }
          const holes = (txt.match(/\{(?![A-Za-z_])[^}]*\}/g) || []).filter(h => !/^\{\d/.test(h)).length;
          if (holes !== rest.length && !/\{\d/.test(txt)) {
            if (holes > rest.length) throw rerr('', `${holes} positional argument${holes > 1 ? 's' : ''} in format string, but there ${rest.length === 1 ? 'is' : 'are'} ${rest.length} argument${rest.length === 1 ? '' : 's'}`, e.line, 'Κάθε {} θέλει μία τιμή μετά το κείμενο, χωρισμένη με κόμμα.');
            throw rerr('', rest.length - holes === 1 ? 'argument never used' : 'multiple unused formatting arguments', e.line, 'Δίνεις περισσότερες τιμές από όσα {} έχει το κείμενο.');
          }
        }
        for (const a of rest) {
          const t = this.ty(a, sc, 'borrow');
          const hole = first && first.k === 'lit' ? null : null;
          void hole;
          void t;
        }
        if (first && first.k === 'lit') this.displayCheck(first.v.v, rest, sc, e.line);
        return name === 'format' ? 'String' : name === 'anyhow' ? 'anyhow::Error' : ['panic', 'bail', 'unreachable', 'todo', 'unimplemented'].includes(name) ? '!' : '()';
      }
      if (name === 'vec') {
        let t = null;
        for (const a of e.repeat ? [e.args[0]] : e.args) t = this.ty(a, sc, 'move') || t;
        if (e.repeat) this.ty(e.args[1], sc, 'borrow');
        if (t === '{int}') t = sc.expect && generic(sc.expect, 'Vec') ? generic(sc.expect, 'Vec')[0] : 'i32';
        if (t === '{float}') t = 'f64';
        return `Vec<${t || '_'}>`;
      }
      if (['assert', 'assert_eq', 'assert_ne', 'matches', 'debug_assert'].includes(name)) { e.args.forEach(a => this.ty(a, sc, 'borrow')); return '()'; }
      throw rerr('', `cannot find macro \`${name}\` in this scope`, e.line, name === 'printf' ? 'Στη Rust γράφεις println!("…").' : 'Διαθέσιμες: println!, print!, format!, vec!, panic!, assert!, assert_eq!.');
    }
    // {} θέλει Display: struct/enum/Vec/Option δεν έχουν
    displayCheck(fmt, args, sc, line) {
      const txt = fmt.replace(/\{\{|\}\}/g, '');
      const holes = txt.match(/\{[^}]*\}/g) || [];
      let i = 0;
      for (const h of holes) {
        const inner = h.slice(1, -1);
        const [arg, spec = ''] = inner.split(':');
        let t = null;
        if (arg === '') { const a = args[i++]; t = a ? this.peekTy(a, sc) : null; }
        else if (/^[A-Za-z_]/.test(arg)) { const r = this.find(sc, arg); t = r ? r.ty : null; }
        if (spec.includes('?')) {
          const b = strip(t);
          const def = b && (this.prog.structs.get(b) || this.prog.enums.get(b));
          if (def && !def.derives.has('Debug')) throw rerr('E0277', `\`${b}\` doesn't implement \`Debug\``, line, `Πρόσθεσε #[derive(Debug)] ακριβώς πάνω από τον ορισμό του ${b}.`);
          continue;
        }
        const b = strip(t);
        if (!b) continue;
        if (b === '()' || b.startsWith('Vec<') || b.startsWith('Option<') || b.startsWith('Result<') || b.startsWith('[') || b.startsWith('(') || this.prog.structs.has(b) || this.prog.enums.has(b)) {
          throw rerr('E0277', `\`${b}\` doesn't implement \`std::fmt::Display\``, line, `Το {} δείχνει μόνο απλές τιμές. Για ${b} γράψε {:?}${this.prog.structs.has(b) || this.prog.enums.has(b) ? ` και βάλε #[derive(Debug)] πάνω από το ${b}` : ''}.`);
        }
      }
    }
    // τύπος χωρίς να «χρησιμοποιηθεί» ξανά (έχει ήδη ελεγχθεί)
    peekTy(a, sc) {
      if (a.k === 'path' && a.segs.length === 1) { const r = this.find(sc, a.segs[0]); return r ? r.ty : null; }
      if (a.k === 'ref') return this.peekTy(a.e, sc);
      if (a.k === 'lit') return a.v.t === 'str' ? '&str' : null;
      if (a.k === 'field') { const fp = this.fieldPath(a); if (fp) { const r = this.find(sc, fp.root); if (r) { let t = r.ty; for (const part of fp.key.split('.').slice(1)) t = this.fieldTy(t, part); return t; } } }
      return null;
    }
  }

  // τύποι που επιστρέφουν οι συναρτήσεις της «βιβλιοθήκης»
  const LIB_TYPES = {
    'std::time::Duration::from_millis': 'Duration', 'std::time::Duration::from_secs': 'Duration', 'std::time::Duration::from_micros': 'Duration',
    'std::time::Duration::from_secs_f32': 'Duration', 'std::time::Duration::from_secs_f64': 'Duration', 'std::time::Instant::now': 'Instant',
    'std::thread::sleep': '()', 'String::new': 'String', 'String::from': 'String', 'String::with_capacity': 'String', 'Vec::new': 'Vec<_>', 'Vec::with_capacity': 'Vec<_>',
    'rppal::gpio::Gpio::new': 'Result<Gpio, rppal::gpio::Error>', 'rppal::i2c::I2c::new': 'Result<I2c, rppal::i2c::Error>',
    'esp_idf_svc::hal::peripherals::Peripherals::take': 'Result<Peripherals, EspError>',
    'esp_idf_svc::hal::gpio::PinDriver::output': 'Result<PinDriver<Output>, EspError>', 'esp_idf_svc::hal::gpio::PinDriver::input': 'Result<PinDriver<Input>, EspError>',
    'esp_idf_svc::hal::delay::FreeRtos::delay_ms': '()', 'esp_idf_svc::hal::delay::Ets::delay_us': '()', 'esp_idf_svc::sys::link_patches': '()'
  };
  function methodRet(base, name, e, argTys) {
    const tf = e.turbofish ? tyStr(e.turbofish) : null;
    if (!base) {
      if (['len', 'count'].includes(name)) return 'usize';
      if (name.startsWith('is_') || ['contains', 'starts_with', 'ends_with'].includes(name)) return 'bool';
      if (['to_string', 'to_uppercase', 'to_lowercase', 'format'].includes(name)) return 'String';
      return null;
    }
    if (base === 'Gpio' && name === 'get') return 'Result<Pin, rppal::gpio::Error>';
    if (base === 'Pin' && name.startsWith('into_output')) return 'OutputPin';
    if (base === 'Pin' && name.startsWith('into_input')) return 'InputPin';
    if ((base === 'OutputPin' || base === 'InputPin') && (name.startsWith('is_'))) return 'bool';
    if (base === 'OutputPin') return ['set_pwm', 'set_pwm_frequency', 'clear_pwm'].includes(name) ? 'Result<(), rppal::gpio::Error>' : '()';
    if (base === 'InputPin' && name === 'read') return 'Level';
    if (base.startsWith('PinDriver')) return name.startsWith('is_') ? 'bool' : name === 'get_level' ? 'Level' : 'Result<(), EspError>';
    if (base === 'Instant') return name === 'elapsed' || name === 'duration_since' ? 'Duration' : null;
    if (base === 'Duration') return { as_millis: 'u128', as_micros: 'u128', as_secs: 'u64', as_secs_f32: 'f32', as_secs_f64: 'f64', subsec_millis: 'u32' }[name] || null;
    if (base === 'String' || base === '&str' || base === 'str') {
      if (name === 'len') return 'usize';
      if (['to_string', 'to_owned', 'to_uppercase', 'to_lowercase', 'replace', 'repeat', 'clone'].includes(name)) return name === 'clone' ? base : 'String';
      if (['trim', 'as_str', 'trim_start', 'trim_end'].includes(name)) return '&str';
      if (name.startsWith('is_') || ['contains', 'starts_with', 'ends_with'].includes(name)) return 'bool';
      if (name === 'parse') return `Result<${tf || '_'}, ${tf && (tf === 'f32' || tf === 'f64') ? 'ParseFloatError' : 'ParseIntError'}>`;
      if (['push', 'push_str', 'clear'].includes(name)) return '()';
      if (name === 'pop') return 'Option<char>';
      return null;
    }
    const v = generic(base, 'Vec') || (/^\[(.*); _\]$/.exec(base) || [])[1] && [/^\[(.*); _\]$/.exec(base)[1]];
    if (v) {
      if (name === 'len') return 'usize';
      if (name === 'is_empty' || name === 'contains') return 'bool';
      if (name === 'get' || name === 'first' || name === 'last') return `Option<&${v[0]}>`;
      if (name === 'pop') return `Option<${v[0]}>`;
      if (name === 'clone') return base;
      if (name === 'iter') return `Iter<${v[0]}>`;
      if (['push', 'clear', 'insert', 'sort', 'reverse', 'truncate'].includes(name)) return '()';
      if (name === 'remove') return v[0];
      return null;
    }
    if (base.startsWith('Iter<')) {
      const el = base.slice(5, -1);
      if (name === 'sum') return tf || el;
      if (name === 'count') return 'usize';
      if (name === 'max' || name === 'min') return `Option<&${el}>`;
      return null;
    }
    const o = generic(base, 'Option');
    if (o) {
      if (['unwrap', 'expect', 'unwrap_or', 'unwrap_or_default'].includes(name)) return o[0];
      if (name === 'is_some' || name === 'is_none') return 'bool';
      if (name === 'copied' || name === 'cloned') return `Option<${strip(o[0])}>`;
      return null;
    }
    const r = generic(base, 'Result');
    if (r) {
      if (['unwrap', 'expect', 'unwrap_or', 'unwrap_or_default'].includes(name)) return r[0];
      if (name === 'is_ok' || name === 'is_err') return 'bool';
      if (name === 'ok') return `Option<${r[0]}>`;
      return null;
    }
    if (isIntTy(base) || base === '{int}') {
      if (name.startsWith('checked_')) return `Option<${base}>`;
      if (['abs', 'pow', 'min', 'max', 'clamp', 'saturating_add', 'saturating_sub', 'saturating_mul', 'wrapping_add', 'wrapping_sub', 'wrapping_mul', 'signum'].includes(name)) return base;
      if (name === 'to_string') return 'String';
      if (name.startsWith('is_')) return 'bool';
    }
    if (isFloatish(base)) {
      if (['abs', 'sqrt', 'round', 'floor', 'ceil', 'trunc', 'min', 'max', 'clamp', 'powi', 'powf'].includes(name)) return base;
      if (name === 'to_string') return 'String';
      if (name.startsWith('is_')) return 'bool';
    }
    if (name === 'clone') return base;
    return null;
  }
  function hasBreak(b) {
    let found = false;
    (function walk(x, depth) {
      if (!x || typeof x !== 'object' || found) return;
      if (Array.isArray(x)) { x.forEach(y => walk(y, depth)); return; }
      if (x.k === 'break' && (depth === 0 || x.label)) { found = true; return; }
      if (x.k === 'return') { found = true; return; }
      const nested = x.k === 'loop' || x.k === 'while' || x.k === 'for' || x.k === 'whilelet';
      for (const key of Object.keys(x)) if (key !== 'line' && key !== 'k') walk(x[key], nested ? depth + 1 : depth);
    })(b, 0);
    return found;
  }
  function exprText(e) {
    if (e.k === 'path') return e.segs.join('::');
    if (e.k === 'field') return `${exprText(e.e)}.${e.name}`;
    if (e.k === 'index') return `${exprText(e.e)}[…]`;
    return '…';
  }

  root.IoTRust = { compile, Machine: RT.RustMachine, display: RT.show, tyStr };
})(typeof window !== 'undefined' ? window : globalThis);
