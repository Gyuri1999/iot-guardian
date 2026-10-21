/*
 * IoT Guardian — εκτέλεση του υποσυνόλου της Rust (μετά τον parser του rsinterp.js και τον έλεγχο του rscheck.js).
 *
 * Τιμές (αντικείμενα JS):
 *   { t: 'int', ty: 'i32'|'u8'|…, v }   { t: 'float', ty: 'f32'|'f64', v }   { t: 'bool', v }   { t: 'char', v }
 *   { t: 'str', v, owned }  (owned: String, αλλιώς &str)   { t: 'unit' }   { t: 'tuple', v: [] }
 *   { t: 'vec', v: [], arr }   { t: 'opt', some, v }   { t: 'res', ok, v }   { t: 'struct', name, f: {} }
 *   { t: 'enum', name, variant, v: [] }   { t: 'range', lo, hi, incl }   { t: 'ref', mut, get, set }
 *   { t: 'dur', us }   { t: 'inst', us }   { t: 'obj', cls, … } (πλακέτα)   { t: 'fn', def }
 */
(function (root) {
  'use strict';

  const { CodeError } = root.IoTInterp;
  const { parse } = root.IoTRustParse;
  const STEP_US = 2;
  const CHUNK_US = 10000;

  // ------------------------------------------------------------ ακέραιοι
  const INT_RANGE = {
    i8: [-128, 127], i16: [-32768, 32767], i32: [-2147483648, 2147483647], i64: [-9223372036854775808, 9223372036854775807],
    isize: [-9223372036854775808, 9223372036854775807], i128: [-1.7e38, 1.7e38],
    u8: [0, 255], u16: [0, 65535], u32: [0, 4294967295], u64: [0, 18446744073709551615], usize: [0, 18446744073709551615], u128: [0, 3.4e38]
  };
  const isIntTy = ty => !!INT_RANGE[ty];
  const I = (v, ty) => ({ t: 'int', ty: ty || null, v });
  const F = (v, ty) => ({ t: 'float', ty: ty || null, v: ty === 'f32' ? Math.fround(v) : v });
  const B = v => ({ t: 'bool', v: !!v });
  const S = (v, owned) => ({ t: 'str', v: String(v), owned: !!owned });
  const UNIT = { t: 'unit' };
  const SOME = v => ({ t: 'opt', some: true, v });
  const NONE = { t: 'opt', some: false, v: null };
  const OK = v => ({ t: 'res', ok: true, v });
  const ERR = v => ({ t: 'res', ok: false, v });

  class RustPanic extends Error {
    constructor(msg, line) { super(msg); this.panicMsg = msg; this.line = line; }
  }
  const panic = (msg, line) => { throw new RustPanic(msg, line); };
  const rerr = (code, msg, line, hint) => new CodeError(`error${code ? `[${code}]` : ''}: ${msg}`, line, hint || '');

  function checkRange(v, ty, op, line) {
    const r = INT_RANGE[ty || 'i32'];
    if (!Number.isFinite(v) || v < r[0] || v > r[1]) {
      const words = { '+': 'add', '-': 'subtract', '*': 'multiply', neg: 'negate', pow: 'multiply' };
      panic(`attempt to ${words[op] || 'add'} with overflow`, line);
    }
    return v;
  }

  // ------------------------------------------------------------ εμφάνιση (Display / Debug)
  function fmtFloat(v, ty) {
    if (Number.isNaN(v)) return 'NaN';
    if (v === Infinity) return 'inf';
    if (v === -Infinity) return '-inf';
    if (ty === 'f32') {
      for (let pcs = 1; pcs <= 9; pcs++) {
        const s = Number(v.toPrecision(pcs));
        if (Math.fround(s) === v) return String(s).includes('e') ? s.toFixed(Math.max(0, -Math.floor(Math.log10(Math.abs(s))) + pcs)) : String(s);
      }
    }
    const s = String(v);
    if (s.includes('e')) return v.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  function display(v, line) {
    switch (v.t) {
      case 'int': return String(v.v);
      case 'float': return fmtFloat(v.v, v.ty);
      case 'bool': return v.v ? 'true' : 'false';
      case 'char': return v.v;
      case 'str': return v.v;
      case 'ref': return display(v.get(), line);
      case 'dur': return debug(v);
      case 'err': return v.msg;
      case 'level': return v.v ? 'High' : 'Low';
    }
    const what = v.t === 'vec' ? `Vec<${elemTy(v)}>` : v.t === 'opt' ? 'Option<…>' : v.t === 'res' ? 'Result<…>' : v.t === 'unit' ? '()' : v.t === 'struct' || v.t === 'enum' ? v.name : v.t === 'tuple' ? '(…)' : v.cls || v.t;
    throw rerr('E0277', `\`${what}\` doesn't implement \`std::fmt::Display\``, line, `Το {} δείχνει μόνο απλές τιμές (αριθμούς, κείμενο, bool). Για ${what} γράψε {:?}${v.t === 'struct' || v.t === 'enum' ? ' (και #[derive(Debug)] πάνω από τον ορισμό του)' : ''}.`);
  }
  function elemTy(v) { const x = v.v[0]; return x ? (x.ty || x.t) : '_'; }
  function debug(v, pretty, depth) {
    depth = depth || 0;
    const ind = n => '    '.repeat(n);
    switch (v.t) {
      case 'int': return String(v.v);
      case 'float': { const s = fmtFloat(v.v, v.ty); return /^-?\d+$/.test(s) ? s + '.0' : s; }
      case 'bool': return v.v ? 'true' : 'false';
      case 'char': return `'${v.v === "'" ? "\\'" : v.v === '\n' ? '\\n' : v.v}'`;
      case 'str': return JSON.stringify(v.v);
      case 'unit': return '()';
      case 'ref': return debug(v.get(), pretty, depth);
      case 'tuple': return `(${v.v.map(x => debug(x, pretty, depth)).join(', ')}${v.v.length === 1 ? ',' : ''})`;
      case 'vec':
        if (pretty && v.v.length) return `[\n${v.v.map(x => ind(depth + 1) + debug(x, pretty, depth + 1) + ',').join('\n')}\n${ind(depth)}]`;
        return `[${v.v.map(x => debug(x, pretty, depth)).join(', ')}]`;
      case 'opt': return v.some ? `Some(${debug(v.v, pretty, depth)})` : 'None';
      case 'res': return `${v.ok ? 'Ok' : 'Err'}(${debug(v.v, pretty, depth)})`;
      case 'struct': {
        if (v.def && !v.def.derives.has('Debug')) throw rerr('E0277', `\`${v.name}\` doesn't implement \`Debug\``, null, `Πρόσθεσε #[derive(Debug)] ακριβώς πάνω από το struct ${v.name}.`);
        const keys = Object.keys(v.f);
        if (v.def && v.def.tuple) return `${v.name}(${keys.map(k => debug(v.f[k], pretty, depth)).join(', ')})`;
        if (!keys.length) return v.name;
        if (pretty) return `${v.name} {\n${keys.map(k => `${ind(depth + 1)}${k}: ${debug(v.f[k], pretty, depth + 1)},`).join('\n')}\n${ind(depth)}}`;
        return `${v.name} { ${keys.map(k => `${k}: ${debug(v.f[k], pretty, depth)}`).join(', ')} }`;
      }
      case 'enum':
        if (v.def && !v.def.derives.has('Debug')) throw rerr('E0277', `\`${v.name}\` doesn't implement \`Debug\``, null, `Πρόσθεσε #[derive(Debug)] ακριβώς πάνω από το enum ${v.name}.`);
        return v.v.length ? `${v.variant}(${v.v.map(x => debug(x, pretty, depth)).join(', ')})` : v.variant;
      case 'range': return `${v.lo ? debug(v.lo) : ''}${v.incl ? '..=' : '..'}${v.hi ? debug(v.hi) : ''}`;
      case 'dur': {
        const us = v.us;
        if (us >= 1e6) return `${fmtFloat(us / 1e6)}s`;
        if (us >= 1e3) return `${fmtFloat(us / 1e3)}ms`;
        return `${fmtFloat(us)}µs`;
      }
      case 'inst': return `Instant { t: ${fmtFloat(v.us / 1e6)}s }`;
      case 'err': return v.debug || JSON.stringify(v.msg);
      case 'level': return v.v ? 'High' : 'Low';
      case 'obj': return v.debug ? v.debug() : v.cls;
      case 'fn': return `fn ${v.def.name}`;
    }
    return v.t;
  }
  // Για τον πίνακα μεταβλητών: σύντομη μορφή σαν {:?}
  function show(v) {
    try { return v.t === 'obj' && v.short ? v.short() : debug(v); } catch (e) { return v.t === 'struct' || v.t === 'enum' ? `${v.name}${v.variant ? '::' + v.variant : ''}` : v.t; }
  }
  function typeOfVal(v) {
    switch (v.t) {
      case 'int': return v.ty || 'i32';
      case 'float': return v.ty || 'f64';
      case 'str': return v.owned ? 'String' : '&str';
      case 'vec': return v.arr ? `[${v.v[0] ? typeOfVal(v.v[0]) : '_'}; ${v.v.length}]` : `Vec<${v.v[0] ? typeOfVal(v.v[0]) : '_'}>`;
      case 'opt': return `Option<${v.some ? typeOfVal(v.v) : '_'}>`;
      case 'res': return `Result<${v.ok ? typeOfVal(v.v) : '_'}, ${v.ok ? '_' : typeOfVal(v.v)}>`;
      case 'unit': return '()';
      case 'tuple': return `(${v.v.map(typeOfVal).join(', ')})`;
      case 'struct': case 'enum': return v.name;
      case 'ref': return `&${v.mut ? 'mut ' : ''}${typeOfVal(v.get())}`;
      case 'dur': return 'Duration';
      case 'inst': return 'Instant';
      case 'obj': return v.cls;
      case 'err': return v.ty || 'Error';
      case 'level': return 'Level';
      case 'range': return 'Range';
    }
    return v.t;
  }

  // Μορφοποίηση των format!, println!: {} {:?} {:#?} {name} {0} {:.2} {:>6} {:<6} {:^6} {:05} {:+}
  function format(fmtStr, args, lookup, line) {
    let out = '';
    let auto = 0;
    let i = 0;
    const used = new Set();
    while (i < fmtStr.length) {
      const c = fmtStr[i];
      if (c === '{' && fmtStr[i + 1] === '{') { out += '{'; i += 2; continue; }
      if (c === '}' && fmtStr[i + 1] === '}') { out += '}'; i += 2; continue; }
      if (c === '}') throw rerr('', 'invalid format string: unmatched `}` found', line, 'Αν θέλεις να τυπώσεις }, γράψε }}.');
      if (c !== '{') { out += c; i++; continue; }
      const end = fmtStr.indexOf('}', i);
      if (end < 0) throw rerr('', "invalid format string: expected `'}'` but string was terminated", line, 'Κάθε { μέσα στο κείμενο κλείνει με }. Για να τυπώσεις {, γράψε {{.');
      const spec = fmtStr.slice(i + 1, end);
      i = end + 1;
      const [argPart, fmtPart = ''] = spec.split(':');
      let val;
      const a = argPart.trim();
      if (a === '') {
        if (auto >= args.length) throw rerr('', `${auto + 1} positional argument${auto ? 's' : ''} in format string, but there ${args.length === 1 ? 'is' : 'are'} ${args.length} argument${args.length === 1 ? '' : 's'}`, line, 'Κάθε {} θέλει μία τιμή μετά το κείμενο, χωρισμένη με κόμμα.');
        used.add(auto);
        val = args[auto++];
      } else if (/^\d+$/.test(a)) {
        if (Number(a) >= args.length) throw rerr('', `invalid reference to positional argument ${a}`, line);
        used.add(Number(a));
        val = args[Number(a)];
      } else {
        val = lookup(a);
      }
      const m = /^([^<>^]?[<>^])?(\+)?(#)?(0)?(\d+)?(?:\.(\d+))?(\?)?$/.exec(fmtPart);
      if (!m) throw rerr('', `invalid format string: unknown format spec \`${fmtPart}\``, line);
      const [, alignPart, plus, alt, zero, widthS, precS, dbg] = m;
      let s;
      let v = val;
      while (v.t === 'ref') v = v.get();
      if (dbg) s = debug(v, !!alt);
      else if (precS !== undefined && (v.t === 'float' || v.t === 'int')) s = Number(v.v).toFixed(Number(precS));
      else if (precS !== undefined && v.t === 'str') s = v.v.slice(0, Number(precS));
      else s = display(v, line);
      if (plus && (v.t === 'int' || v.t === 'float') && v.v >= 0) s = '+' + s;
      const width = widthS ? Number(widthS) : 0;
      const len = [...s].length;
      if (width > len) {
        if (zero && !alignPart) {
          const neg = s[0] === '-' || s[0] === '+';
          s = (neg ? s[0] : '') + '0'.repeat(width - len) + (neg ? s.slice(1) : s);
        } else {
          const align = alignPart ? alignPart[alignPart.length - 1] : (v.t === 'int' || v.t === 'float' ? '>' : '<');
          const fill = alignPart && alignPart.length === 2 ? alignPart[0] : ' ';
          const pad = width - len;
          if (align === '>') s = fill.repeat(pad) + s;
          else if (align === '<') s = s + fill.repeat(pad);
          else s = fill.repeat(Math.floor(pad / 2)) + s + fill.repeat(Math.ceil(pad / 2));
        }
      }
      out += s;
    }
    if (args.length > used.size) {
      throw rerr('', `${args.length - used.size === 1 ? 'argument never used' : 'multiple unused formatting arguments'}`, line, 'Δίνεις περισσότερες τιμές από όσα {} έχει το κείμενο. Πρόσθεσε {} ή σβήσε την τιμή που περισσεύει.');
    }
    return out;
  }

  // ------------------------------------------------------------ περιβάλλον
  class Env {
    constructor(parent, frame) { this.vars = new Map(); this.parent = parent; this.frame = frame || (parent && parent.frame); }
    find(name) { for (let e = this; e; e = e.parent) { const r = e.vars.get(name); if (r) return r; } return null; }
  }

  // Αντιγραφή τιμών Copy (κάθε «ανάγνωση» μιας μεταβλητής Copy δίνει δικό της αντίγραφο).
  function isCopy(v) {
    switch (v.t) {
      case 'int': case 'float': case 'bool': case 'char': case 'unit': case 'dur': case 'inst': case 'level': case 'fn': return true;
      case 'str': return !v.owned;
      case 'ref': return !v.mut;
      case 'tuple': return v.v.every(isCopy);
      case 'vec': return !!v.arr && v.v.every(isCopy);
      case 'opt': return !v.some || isCopy(v.v);
      case 'struct': case 'enum': return !!(v.def && v.def.derives.has('Copy'));
    }
    return false;
  }
  function clone(v) {
    switch (v.t) {
      case 'str': return S(v.v, v.owned);
      case 'vec': return { t: 'vec', v: v.v.map(clone), arr: v.arr };
      case 'tuple': return { t: 'tuple', v: v.v.map(clone) };
      case 'opt': return v.some ? SOME(clone(v.v)) : NONE;
      case 'res': return v.ok ? OK(clone(v.v)) : ERR(clone(v.v));
      case 'struct': { const f = {}; for (const k of Object.keys(v.f)) f[k] = clone(v.f[k]); return { t: 'struct', name: v.name, def: v.def, f }; }
      case 'enum': return { t: 'enum', name: v.name, def: v.def, variant: v.variant, v: v.v.map(clone) };
    }
    return v;
  }
  const deref = v => { while (v && v.t === 'ref') v = v.get(); return v; };

  function eqVal(a, b) {
    a = deref(a); b = deref(b);
    if (a.t !== b.t) return false;
    switch (a.t) {
      case 'int': case 'float': case 'bool': case 'char': case 'str': case 'level': return a.v === b.v;
      case 'unit': return true;
      case 'tuple': case 'vec': return a.v.length === b.v.length && a.v.every((x, i) => eqVal(x, b.v[i]));
      case 'opt': return a.some === b.some && (!a.some || eqVal(a.v, b.v));
      case 'res': return a.ok === b.ok && eqVal(a.v, b.v);
      case 'enum': return a.name === b.name && a.variant === b.variant && a.v.every((x, i) => eqVal(x, b.v[i]));
      case 'struct': return a.name === b.name && Object.keys(a.f).every(k => eqVal(a.f[k], b.f[k]));
      case 'dur': case 'inst': return a.us === b.us;
    }
    return a === b;
  }
  function cmpVal(a, b) {
    a = deref(a); b = deref(b);
    if (a.t === 'dur' || a.t === 'inst') return a.us - b.us;
    if (a.t === 'str' || a.t === 'char') return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
    if (a.t === 'bool') return Number(a.v) - Number(b.v);
    if (a.t === 'tuple' || a.t === 'vec') { for (let i = 0; i < Math.min(a.v.length, b.v.length); i++) { const c = cmpVal(a.v[i], b.v[i]); if (c) return c; } return a.v.length - b.v.length; }
    if (a.t === 'enum' && a.def) return a.def.variants.findIndex(x => x.name === a.variant) - a.def.variants.findIndex(x => x.name === b.variant);
    return a.v - b.v;
  }

  // ------------------------------------------------------------ πλακέτα
  const PI_MAP = { 17: 'LED', 27: 'BUTTON', 4: 'PIR', 23: 'TRIG', 24: 'ECHO', 16: 'RED', 20: 'YELLOW', 21: 'GREEN' };
  const ESP_MAP = { 2: 'LED', 15: 'BUTTON', 4: 'PIR', 5: 'TRIG', 18: 'ECHO', 25: 'RED', 26: 'YELLOW', 27: 'GREEN' };
  const PIN_WORD = { LED: 'το LED', BUTTON: 'το κουμπί', PIR: 'ο αισθητήρας κίνησης PIR', TRIG: 'το TRIG του HC-SR04', ECHO: 'το ECHO του HC-SR04', RED: 'το κόκκινο φως', YELLOW: 'το κίτρινο φως', GREEN: 'το πράσινο φως' };

  // ------------------------------------------------------------ Machine
  class RustMachine {
    constructor(program, board, opts) {
      opts = opts || {};
      this.lang = 'rust';
      this.prog = program;
      this.board = board;
      this.target = opts.board || program.target || 'esp32';
      this.consts = opts.consts || {};
      this.globals = new Map();
      this.frames = [];
      this.stepLimit = opts.stepLimit || 200000;
      this.stepsInCall = 0;
      this.changeCounter = 0;
      this.phase = 'script';
      this.loopIndex = 0;
      this.loopLog = [];
      this.currentLine = null;
      this.lastBranch = null;
      this.finished = false;
      this.inMainLoop = false;
      this.usedPins = new Set();
      this.peripheralsTaken = false;
      board.serialStarted = true;
      this.PINS = root.IoTDevice.PINS;
      this.display = show;
    }

    // ---------------------------------------------------------- μεταβλητές για το UI
    mkVar(name, value, line, mut, kind) {
      return { name, value, prev: null, line, mut, kind, type: typeOfVal(value), isConst: false, stamp: ++this.changeCounter, moved: false };
    }
    setVar(rec, value, line) {
      rec.prev = rec.value;
      rec.value = value;
      rec.type = typeOfVal(value);
      rec.line = line;
      rec.stamp = ++this.changeCounter;
      rec.moved = false;
    }
    visibleVars() {
      const fr = this.frames[this.frames.length - 1];
      if (!fr) return [...this.globals.values()];
      const out = [];
      const seen = new Set();
      for (let e = fr.env; e; e = e.parent) {
        for (const r of [...e.vars.values()].reverse()) if (!seen.has(r.name) && !r.moved) { seen.add(r.name); out.unshift(r); }
      }
      return out.map(r => Object.assign(r, { kind: fr.isMain ? 'global' : 'local' }));
    }
    loopVarNames() {
      const fr = this.frames[0];
      if (!fr) return [];
      const out = [];
      for (let e = fr.loopEnv || fr.env; e; e = e.parent) for (const r of e.vars.values()) if (r.value.t !== 'obj' && !out.includes(r.name)) out.push(r.name);
      return out;
    }
    snapshotGlobals() {
      const out = {};
      const fr = this.frames[0];
      if (!fr) return out;
      for (let e = fr.loopEnv || fr.env; e; e = e.parent) for (const [k, r] of e.vars) if (!(k in out) && !r.moved) out[k] = show(r.value);
      return out;
    }

    // ---------------------------------------------------------- χρόνος
    *tick(line) {
      this.currentLine = line;
      this.stepsInCall++;
      this.board.advanceMicros(STEP_US);
      if (this.stepsInCall > this.stepLimit) {
        throw new CodeError(`Ο κώδικας έκανε ${this.stepLimit.toLocaleString('el-GR')} βήματα χωρίς καμία αναμονή.`, line,
          this.target === 'pi' ? 'Μάλλον υπάρχει βρόχος που δεν σταματά ποτέ, ή ένα loop { } χωρίς thread::sleep(…) μέσα του.' : 'Μάλλον υπάρχει βρόχος που δεν σταματά ποτέ, ή ένα loop { } χωρίς FreeRtos::delay_ms(…) μέσα του. Στο ESP32 αυτό ενεργοποιεί και τον watchdog.');
      }
      yield { kind: 'line', line };
    }
    *wait(us) {
      const end = this.board.micros + Math.round(us);
      this.stepsInCall = 0;
      while (this.board.micros < end) {
        this.board.advanceMicros(Math.max(1, Math.min(CHUNK_US, end - this.board.micros)));
        yield { kind: 'waiting' };
      }
    }
    beginIteration(fr) {
      this.phase = 'loop';
      this.loopIndex++;
      this.stepsInCall = 0;
      this.loopInputs = Object.assign({}, this.board.inputs);
      this.loopSerialStart = this.board.seq;
      fr.loopEnv = fr.env;
      return { kind: 'loopStart', index: this.loopIndex };
    }
    endIteration() {
      this.board.advanceMicros(10);
      const output = this.board.serial.filter(l => l.id > this.loopSerialStart).map(l => l.text);
      this.loopLog.push({ index: this.loopIndex, inputs: this.loopInputs, vars: this.snapshotGlobals(), output });
      if (this.loopLog.length > 60) this.loopLog.shift();
      return { kind: 'loopEnd', index: this.loopIndex };
    }

    // ---------------------------------------------------------- εκτέλεση
    *main() {
      const fn = this.prog.fns.get('main');
      for (const c of this.prog.consts) {
        const env = new Env(null, null);
        const v = yield* this.ev(c.value, env);
        this.globals.set(c.name, Object.assign(this.mkVar(c.name, this.coerce(v, c.type, c.line), c.line, false, 'global'), { isConst: true }));
      }
      try {
        const r = yield* this.call(fn, [], fn.line, true);
        const rv = deref(r);
        if (rv && rv.t === 'res' && !rv.ok) {
          this.board.serialWrite(`Error: ${debug(rv.v)}`, true, fn.endLine);
          this.board.warnOnce('mainerr', fn.endLine, 'Η main επέστρεψε Err: το πρόγραμμα τερματίστηκε με κωδικό 1.', 'Δες το μήνυμα «Error: …» στο τερματικό για να καταλάβεις ποιο ? σταμάτησε το πρόγραμμα.');
        }
      } catch (e) {
        if (e instanceof RustPanic) {
          const where = `src/main.rs:${e.line || '?'}:5`;
          this.board.serialWrite(`thread 'main' panicked at ${where}:`, true, e.line);
          this.board.serialWrite(e.panicMsg, true, e.line);
          if (this.target === 'esp32') this.board.serialWrite('abort() was called · Rebooting...', true, e.line);
          throw new CodeError(`panic: ${e.panicMsg}`, e.line, panicHint(e.panicMsg, this.target));
        }
        if (e && e.signal) throw new CodeError(`error[E0268]: \`${e.signal}\` outside of a loop`, e.line);
        throw e;
      }
      this.phase = 'τέλος';
      this.finished = true;
    }

    *call(fn, args, line, isMain) {
      const env = new Env(null, { fn, isMain: !!isMain });
      const frame = { fn, env, isMain: !!isMain };
      env.frame = frame;
      if (this.frames.length > 200) panic('thread \'main\' has overflowed its stack', line);
      fn.params.forEach((pr, i) => {
        if (pr.self) env.vars.set('self', this.mkVar('self', args[i], line, pr.mut, 'local'));
        else if (pr.name !== '_') env.vars.set(pr.name, this.mkVar(pr.name, this.coerce(args[i], pr.type, line), line, pr.mut, 'local'));
      });
      this.frames.push(frame);
      const saved = this.stepsInCall;
      try {
        const r = yield* this.block(fn.body, env, { fnBody: true, frame });
        return this.coerce(r, fn.ret, fn.endLine);
      } catch (e) {
        if (e && e.signal === 'return') return this.coerce(e.value, fn.ret, e.line);
        throw e;
      } finally {
        this.frames.pop();
        if (this.stepsInCall < saved) this.stepsInCall = saved;
      }
    }

    // Προσαρμογή τιμής στον δηλωμένο τύπο (ακέραια λεκτικά χωρίς τύπο, έλεγχος ορίων).
    coerce(v, type, line) {
      if (!type || !v) return v;
      const tn = type.k === 'path' ? type.name : null;
      if (v.t === 'int' && tn && isIntTy(tn)) {
        if (!v.ty) { checkLiteral(v.v, tn, line); return I(v.v, tn); }
        return v;
      }
      if (v.t === 'int' && !v.ty && tn && (tn === 'f32' || tn === 'f64')) return v;
      if (v.t === 'float' && tn && (tn === 'f32' || tn === 'f64') && !v.ty) return F(v.v, tn);
      if (v.t === 'int' && !v.ty) return I(v.v, 'i32');
      if (v.t === 'float' && !v.ty) return F(v.v, 'f64');
      if (v.t === 'vec' && type.k === 'path' && type.args && type.args[0]) { v.v = v.v.map(x => this.coerce(x, type.args[0], line)); return v; }
      if (v.t === 'vec' && type.k === 'array' && type.of) {
        // let a: [usize; 4] = [0, 2, 7, 1]; → τα λεκτικά παίρνουν τον τύπο της δήλωσης (ο rscheck ελέγχει τα υπόλοιπα)
        const of = type.of.k === 'path' ? type.of.name : null;
        v.v = v.v.map(x => (x.t === 'int' && of && isIntTy(of) && x.ty !== of ? (checkLiteral(x.v, of, line), I(x.v, of)) : this.coerce(x, type.of, line)));
        return v;
      }
      if (v.t === 'opt' && v.some && type.k === 'path' && type.name === 'Option' && type.args[0]) return SOME(this.coerce(v.v, type.args[0], line));
      if (v.t === 'res' && type.k === 'path' && type.name === 'Result' && type.args.length) return v.ok ? OK(this.coerce(v.v, type.args[0], line)) : v;
      return v;
    }
    settle(v) {
      if (v.t === 'int' && !v.ty) return I(v.v, 'i32');
      if (v.t === 'float' && !v.ty) return F(v.v, 'f64');
      return v;
    }

    *block(blk, parent, opts) {
      opts = opts || {};
      const env = new Env(parent);
      for (const st of blk.stmts) {
        if (opts.fnBody && opts.frame && opts.frame.isMain && st.k === 'expr' && st.e.k === 'loop' && !this.inMainLoop) {
          // Ο κύριος βρόχος της main: κάθε γύρος του loop { … } είναι μία «επανάληψη» για τα πάνελ.
          this.inMainLoop = true;
          const r = yield* this.mainLoop(st.e, env, opts.frame);
          if (r && r.brk) continue;
          return r;
        }
        yield* this.stmt(st, env);
      }
      if (blk.tail) {
        if (opts.fnBody && opts.frame && opts.frame.isMain && blk.tail.k === 'loop' && !this.inMainLoop) {
          this.inMainLoop = true;
          return yield* this.mainLoop(blk.tail, env, opts.frame);
        }
        return yield* this.ev(blk.tail, env);
      }
      return UNIT;
    }
    *mainLoop(loop, env, frame) {
      for (;;) {
        yield this.beginIteration(frame);
        try {
          yield* this.block(loop.body, env);
        } catch (e) {
          if (e && e.signal === 'break' && (!e.label || e.label === loop.label)) { yield this.endIteration(); this.phase = 'script'; return e.value || UNIT; }
          if (e && e.signal === 'continue' && (!e.label || e.label === loop.label)) { yield this.endIteration(); continue; }
          throw e;
        }
        yield this.endIteration();
      }
    }

    *stmt(st, env) {
      switch (st.k) {
        case 'let': {
          yield* this.tick(st.line);
          if (!st.init) { this.bindPattern(st.pat, null, env, st.line, st.type); return; }
          // let n: u32 = s.parse()?; → το parse χωρίς ::<T> παίρνει τον τύπο της δήλωσης
          const savedHint = this.hintParse;
          const tn = st.type && st.type.k === 'path' ? st.type.name : null;
          if (tn && (isIntTy(tn) || tn === 'f32' || tn === 'f64' || tn === 'bool')) this.hintParse = tn;
          let v;
          try { v = yield* this.ev(st.init, env); } finally { this.hintParse = savedHint; }
          v = this.take(st.init, v, env);
          v = st.type ? this.coerce(v, st.type, st.line) : this.settle(v);
          this.bindPattern(st.pat, v, env, st.line, st.type);
          return;
        }
        case 'expr': {
          if (!BLOCKISH.has(st.e.k)) yield* this.tick(st.line);
          yield* this.ev(st.e, env);
          return;
        }
        case 'use': case 'const': return;
      }
    }

    // Όταν μια μεταβλητή «μετακινείται» (move), σημειώνεται· την ελέγχει κυρίως ο rscheck, αυτό είναι δίχτυ ασφαλείας.
    take(expr, v, env) {
      if (expr.k === 'path' && expr.segs.length === 1 && v && !isCopy(v)) {
        const rec = env.find(expr.segs[0]);
        if (rec) rec.moved = true;
      }
      return isCopy(v) && (v.t === 'struct' || v.t === 'vec' || v.t === 'tuple') ? clone(v) : v;
    }

    bindPattern(pat, v, env, line, type) {
      switch (pat.k) {
        case 'bind':
          env.vars.set(pat.name, this.mkVar(pat.name, v === null ? { t: 'uninit' } : v, line, pat.mut, 'local'));
          if (v !== null) env.vars.get(pat.name).type = type ? typeName(type) : typeOfVal(v);
          return;
        case 'wild': return;
        case 'tuple': {
          const d = deref(v);
          pat.items.forEach((p, i) => this.bindPattern(p, d.v[i], env, line));
          return;
        }
        default:
          if (!this.match(pat, v, env, line)) throw rerr('E0005', 'refutable pattern in local binding', line, 'Στο let το μοτίβο πρέπει να ταιριάζει πάντα. Για Option/Result χρησιμοποίησε if let ή match.');
      }
    }

    // Ταίριασμα μοτίβου (match, if let): δένει μεταβλητές στο env αν ταιριάξει.
    match(pat, v, env, line) {
      const d = deref(v);
      switch (pat.k) {
        case 'wild': return true;
        case 'bind':
          if (pat.sub && !this.match(pat.sub, v, env, line)) return false;
          env.vars.set(pat.name, this.mkVar(pat.name, v, line, pat.mut, 'local'));
          return true;
        case 'lit': return eqVal(d, litVal(pat.v));
        case 'range': {
          const x = d.t === 'char' ? d.v.codePointAt(0) : d.v;
          const lo = pat.lo ? (pat.lo.t === 'char' ? pat.lo.v.codePointAt(0) : pat.lo.v) : -Infinity;
          const hi = pat.hi ? (pat.hi.t === 'char' ? pat.hi.v.codePointAt(0) : pat.hi.v) : Infinity;
          return x >= lo && (pat.incl ? x <= hi : x < hi);
        }
        case 'or': return pat.alts.some(a => this.match(a, v, env, line));
        case 'tuple': return d.t === 'tuple' && pat.items.every((p, i) => this.match(p, d.v[i], env, line));
        case 'variant': {
          const name = pat.segs[pat.segs.length - 1];
          const inner = pat.items || [];
          if (d.t === 'opt') {
            if (name === 'None') return !d.some;
            if (name === 'Some') return d.some && (!inner.length || this.match(inner[0], d.v, env, line));
          }
          if (d.t === 'res') {
            if (name === 'Ok') return d.ok && (!inner.length || this.match(inner[0], d.v, env, line));
            if (name === 'Err') return !d.ok && (!inner.length || this.match(inner[0], d.v, env, line));
          }
          if (d.t === 'level') return (name === 'High') === d.v;
          if (d.t === 'enum') return d.variant === name && inner.every((p, i) => this.match(p, d.v[i], env, line));
          if (d.t === 'bool') return false;
          // σταθερά (const) ως μοτίβο
          const c = this.globals.get(name);
          if (c) return eqVal(d, c.value);
          return false;
        }
        case 'structpat':
          return d.t === 'struct' && pat.fields.every(f => this.match(f.pat, d.f[f.name], env, line));
      }
      return false;
    }

    // ---------------------------------------------------------- εκφράσεις
    *ev(e, env) {
      switch (e.k) {
        case 'lit': return e.v.t === 'str' ? S(e.v.v, false) : litVal(e.v);
        case 'paren': return yield* this.ev(e.e, env);
        case 'path': return this.path(e, env);
        case 'block': return yield* this.block(e, env);
        case 'tuple': { const v = []; for (const x of e.items) v.push(this.settle(this.take(x, yield* this.ev(x, env), env))); return { t: 'tuple', v }; }
        case 'array': { const v = []; for (const x of e.items) v.push(this.take(x, yield* this.ev(x, env), env)); unifyInts(v); return { t: 'vec', v, arr: true }; }
        case 'arrayRepeat': { const x = yield* this.ev(e.e, env); const n = deref(yield* this.ev(e.len, env)).v; return { t: 'vec', v: Array.from({ length: n }, () => clone(x)), arr: true }; }
        case 'structlit': return yield* this.structLit(e, env);
        case 'ref': {
          const pl = yield* this.place(e.e, env, e.mut);
          if (pl) return { t: 'ref', mut: e.mut, get: pl.get, set: pl.set, name: pl.name };
          const v = yield* this.ev(e.e, env);
          return { t: 'ref', mut: e.mut, get: () => v, set: nv => { Object.assign(v, nv); } };
        }
        case 'deref': {
          const v = yield* this.ev(e.e, env);
          return v.t === 'ref' ? v.get() : v;
        }
        case 'neg': {
          const v = deref(yield* this.ev(e.e, env));
          if (v.t === 'int') { if (v.ty && v.ty[0] === 'u') throw rerr('E0600', `cannot apply unary operator \`-\` to type \`${v.ty}\``, e.line, 'Οι τύποι u8, u16, u32… δεν έχουν αρνητικούς αριθμούς.'); return I(checkRange(-v.v, v.ty || 'i32', 'neg', e.line), v.ty); }
          if (v.t === 'float') return F(-v.v, v.ty);
          throw rerr('E0600', `cannot apply unary operator \`-\` to type \`${typeOfVal(v)}\``, e.line);
        }
        case 'not': {
          const v = deref(yield* this.ev(e.e, env));
          if (v.t === 'bool') return B(!v.v);
          if (v.t === 'int') return I(v.ty && v.ty[0] === 'u' ? INT_RANGE[v.ty][1] - v.v : ~v.v, v.ty);
          throw rerr('E0600', `cannot apply unary operator \`!\` to type \`${typeOfVal(v)}\``, e.line);
        }
        case 'bin': return yield* this.binary(e, env);
        case 'cast': return this.cast(deref(yield* this.ev(e.e, env)), e.type, e.line);
        case 'assign': yield* this.assign(e, env); return UNIT;
        case 'range': {
          const lo = e.lo ? this.settleLike(deref(yield* this.ev(e.lo, env))) : null;
          const hi = e.hi ? deref(yield* this.ev(e.hi, env)) : null;
          return { t: 'range', lo, hi: hi && lo && hi.t === 'int' && !hi.ty ? I(hi.v, lo.ty) : hi, incl: e.incl };
        }
        case 'if': return yield* this.ifExpr(e, env, 'if');
        case 'iflet': {
          yield* this.tick(e.line);
          const v = yield* this.ev(e.e, env);
          const inner = new Env(env);
          if (this.match(e.pat, v, inner, e.line)) return yield* this.block(e.then, inner);
          if (e.els) return e.els.k === 'block' ? yield* this.block(e.els, env) : yield* this.ev(e.els, env);
          return UNIT;
        }
        case 'match': return yield* this.matchExpr(e, env);
        case 'loop': return yield* this.loop(e, env);
        case 'while': {
          for (;;) {
            yield* this.tick(e.line);
            const c = deref(yield* this.ev(e.cond, env));
            if (c.t !== 'bool') throw rerr('E0308', 'mismatched types', e.line, 'Η συνθήκη του while πρέπει να είναι bool (true/false).');
            if (!c.v) return UNIT;
            const r = yield* this.loopBody(e, env);
            if (r === 'break') return UNIT;
          }
        }
        case 'whilelet': {
          for (;;) {
            yield* this.tick(e.line);
            const v = yield* this.ev(e.e, env);
            const inner = new Env(env);
            if (!this.match(e.pat, v, inner, e.line)) return UNIT;
            const r = yield* this.loopBody(e, inner);
            if (r === 'break') return UNIT;
          }
        }
        case 'for': return yield* this.forLoop(e, env);
        case 'break': { const v = e.e ? yield* this.ev(e.e, env) : null; throw { signal: 'break', label: e.label, value: v, line: e.line }; }
        case 'continue': throw { signal: 'continue', label: e.label, line: e.line };
        case 'return': { const v = e.e ? this.take(e.e, yield* this.ev(e.e, env), env) : UNIT; throw { signal: 'return', value: v, line: e.line }; }
        case 'try': {
          const v = deref(yield* this.ev(e.e, env));
          if (v.t === 'res') { if (v.ok) return v.v; throw { signal: 'return', value: ERR(v.v), line: e.line }; }
          if (v.t === 'opt') { if (v.some) return v.v; throw { signal: 'return', value: NONE, line: e.line }; }
          throw rerr('E0277', `the \`?\` operator can only be applied to values that implement \`Try\``, e.line, 'Το ? μπαίνει μόνο μετά από Result ή Option.');
        }
        case 'field': {
          const base = deref(yield* this.ev(e.e, env));
          return this.field(base, e.name, e.line);
        }
        case 'index': {
          const base = deref(yield* this.ev(e.e, env));
          const idx = deref(yield* this.ev(e.idx, env));
          return this.index(base, idx, e.line);
        }
        case 'call': return yield* this.callExpr(e, env);
        case 'method': return yield* this.method(e, env);
        case 'macro': return yield* this.macro(e, env);
      }
      throw new CodeError(`Η έκφραση «${e.k}» δεν υποστηρίζεται.`, e.line);
    }
    settleLike(v) { return v.t === 'int' && !v.ty ? I(v.v, 'i32') : v; }

    path(e, env) {
      const name = e.segs[0];
      if (e.segs.length === 1) {
        const rec = env.find(name);
        if (rec) {
          if (rec.value.t === 'uninit') throw rerr('E0381', `used binding \`${name}\` isn't initialized`, e.line, `Η «${name}» δηλώθηκε αλλά δεν πήρε τιμή πριν τη χρησιμοποιήσεις.`);
          if (rec.moved) throw rerr('E0382', `borrow of moved value: \`${name}\``, e.line, `Η τιμή της «${name}» μετακινήθηκε (move) σε άλλη μεταβλητή ή συνάρτηση, άρα δεν της ανήκει πια. Αν τη χρειάζεσαι και εδώ, δάνεισέ τη με &${name} ή φτιάξε αντίγραφο με ${name}.clone().`);
          return isCopy(rec.value) && (rec.value.t === 'struct' || rec.value.t === 'vec' || rec.value.t === 'tuple') ? clone(rec.value) : rec.value;
        }
        const g = this.globals.get(name);
        if (g) return g.value;
        const fn = this.prog.fns.get(name);
        if (fn) return { t: 'fn', def: fn };
      }
      return this.resolvePath(e.segs, e.line, e);
    }

    resolvePath(segs, line, e) {
      const full = this.prog.resolve(segs);
      const last = segs[segs.length - 1];
      // enum του χρήστη: Light::Red
      const en = this.prog.enums.get(segs[segs.length - 2] === 'Self' && this.frames.length ? this.selfType() : segs[segs.length - 2]);
      if (en && segs.length >= 2) {
        const vdef = en.variants.find(v => v.name === last);
        if (!vdef) throw rerr('E0599', `no variant or associated item named \`${last}\` found for enum \`${en.name}\``, line, `Το enum ${en.name} έχει: ${en.variants.map(v => v.name).join(', ')}.`);
        if (vdef.types) return { t: 'ctor', make: args => ({ t: 'enum', name: en.name, def: en, variant: last, v: args }) };
        return { t: 'enum', name: en.name, def: en, variant: last, v: [] };
      }
      // Option / Result
      if (last === 'None' && segs.length <= 2) return NONE;
      if (last === 'Some' || last === 'Ok' || last === 'Err') return { t: 'ctor', make: args => (last === 'Some' ? SOME(args[0]) : last === 'Ok' ? OK(args[0]) : ERR(args[0])) };
      // σταθερές τύπων: u8::MAX, i32::MIN, f32::MAX
      if ((last === 'MAX' || last === 'MIN') && segs.length === 2 && (isIntTy(segs[0]) || segs[0] === 'f32' || segs[0] === 'f64')) {
        if (isIntTy(segs[0])) return I(INT_RANGE[segs[0]][last === 'MAX' ? 1 : 0], segs[0]);
        return F(last === 'MAX' ? (segs[0] === 'f32' ? 3.4028235e38 : Number.MAX_VALUE) : (segs[0] === 'f32' ? -3.4028235e38 : -Number.MAX_VALUE), segs[0]);
      }
      if (segs[0] === 'std' && segs[1] === 'f32' || segs[0] === 'f32' && segs[1] === 'consts') { if (last === 'PI') return F(Math.PI, 'f32'); }
      const lib = LIB[full];
      if (lib !== undefined) {
        if (lib.board && lib.board !== this.target) throw rerr('E0433', `failed to resolve: could not find \`${segs[0]}\``, line, BOARD_HINT[this.target]);
        return typeof lib.value === 'function' ? lib.value(this) : lib.value;
      }
      // συνάρτηση συσχετισμένη με struct: Counter::new
      if (segs.length === 2) {
        const tyName = segs[0] === 'Self' ? this.selfType() : segs[0];
        const m = this.prog.methods.get(tyName);
        if (m && m.has(last)) return { t: 'fn', def: m.get(last) };
        if (this.prog.structs.has(tyName) || this.prog.enums.has(tyName)) throw rerr('E0599', `no function or associated item named \`${last}\` found for struct \`${tyName}\` in the current scope`, line);
      }
      if (segs.length === 1) {
        throw rerr('E0425', `cannot find value \`${last}\` in this scope`, line, nameHint(last, this));
      }
      throw rerr('E0433', `failed to resolve: use of undeclared type \`${segs[0]}\``, line, useHint(segs[0], this.target));
    }
    selfType() {
      for (let i = this.frames.length - 1; i >= 0; i--) if (this.frames[i].fn.implFor) return this.frames[i].fn.implFor;
      return null;
    }

    *structLit(e, env) {
      const name = e.segs[e.segs.length - 1] === 'Self' ? this.selfType() : e.segs[e.segs.length - 1];
      const def = this.prog.structs.get(name);
      if (!def) throw rerr('E0422', `cannot find struct, variant or union type \`${name}\` in this scope`, e.line);
      const f = {};
      for (const fl of e.fields) {
        const fd = def.fields.find(x => x.name === fl.name);
        if (!fd) throw rerr('E0560', `struct \`${name}\` has no field named \`${fl.name}\``, fl.line, `Τα πεδία του ${name}: ${def.fields.map(x => x.name).join(', ')}.`);
        f[fl.name] = this.coerce(this.take(fl.value, yield* this.ev(fl.value, env), env), fd.type, fl.line);
      }
      const missing = def.fields.filter(x => !(x.name in f)).map(x => `\`${x.name}\``);
      if (missing.length) throw rerr('E0063', `missing field${missing.length > 1 ? 's' : ''} ${missing.join(', ')} in initializer of \`${name}\``, e.line, 'Όταν φτιάχνεις ένα struct, δίνεις τιμή σε όλα τα πεδία του.');
      const ordered = {};
      for (const fd of def.fields) ordered[fd.name] = f[fd.name];
      return { t: 'struct', name, def, f: ordered };
    }

    field(base, name, line) {
      if (base.t === 'struct') {
        if (!(name in base.f)) throw rerr('E0609', `no field \`${name}\` on type \`${base.name}\``, line, `Τα πεδία του ${base.name}: ${Object.keys(base.f).join(', ')}.`);
        return base.f[name];
      }
      if (base.t === 'tuple') {
        if (!/^\d+$/.test(name) || Number(name) >= base.v.length) throw rerr('E0609', `no field \`${name}\` on type \`${typeOfVal(base)}\``, line);
        return base.v[Number(name)];
      }
      if (base.t === 'obj' && base.fields && name in base.fields) return base.fields[name];
      throw rerr('E0609', `no field \`${name}\` on type \`${typeOfVal(base)}\``, line, base.t === 'obj' ? '' : 'Μήπως ήθελες να καλέσεις μέθοδο; Τότε χρειάζονται παρενθέσεις: .όνομα().');
    }

    index(base, idx, line) {
      if (base.t === 'vec') {
        if (idx.t === 'range') {
          const lo = idx.lo ? idx.lo.v : 0;
          const hi = idx.hi ? idx.hi.v + (idx.incl ? 1 : 0) : base.v.length;
          if (hi > base.v.length) panic(`range end index ${hi} out of range for slice of length ${base.v.length}`, line);
          return { t: 'vec', v: base.v.slice(lo, hi), arr: true };
        }
        if (idx.t !== 'int') throw rerr('E0277', `the type \`[${elemTy(base)}]\` cannot be indexed by \`${typeOfVal(idx)}\``, line, 'Ο δείκτης πρέπει να είναι ακέραιος usize, π.χ. v[0].');
        if (idx.ty && idx.ty !== 'usize') throw rerr('E0277', `the type \`[${elemTy(base)}]\` cannot be indexed by \`${idx.ty}\``, line, `Οι δείκτες είναι τύπου usize. Γράψε v[i as usize] ή δήλωσε το i ως usize.`);
        if (idx.v < 0 || idx.v >= base.v.length) panic(`index out of bounds: the len is ${base.v.length} but the index is ${idx.v}`, line);
        return base.v[idx.v];
      }
      if (base.t === 'str') {
        if (idx.t === 'range') {
          const bytes = utf8(base.v);
          const lo = idx.lo ? idx.lo.v : 0;
          const hi = idx.hi ? idx.hi.v + (idx.incl ? 1 : 0) : bytes.length;
          if (hi > bytes.length) panic(`byte index ${hi} is out of bounds of \`${base.v}\``, line);
          const s = fromUtf8(bytes.slice(lo, hi));
          if (s === null) panic(`byte index ${lo} is not a char boundary; it is inside a character of \`${base.v}\``, line);
          return S(s, false);
        }
        throw rerr('E0277', 'the type `str` cannot be indexed by `{integer}`', line, 'Στη Rust δεν γράφεις s[0] σε κείμενο. Χρησιμοποίησε s.chars().nth(0).');
      }
      throw rerr('E0608', `cannot index into a value of type \`${typeOfVal(base)}\``, line);
    }

    // Θέση (place) για ανάθεση ή &mut: μεταβλητή, πεδίο, στοιχείο Vec, *ref.
    *place(e, env, wantMut) {
      if (e.k === 'paren') return yield* this.place(e.e, env, wantMut);
      if (e.k === 'path' && e.segs.length === 1) {
        const rec = env.find(e.segs[0]);
        if (!rec) return null;
        if (rec.moved) throw rerr('E0382', `borrow of moved value: \`${rec.name}\``, e.line, `Η τιμή της «${rec.name}» έχει μετακινηθεί και δεν μπορείς να τη δανειστείς.`);
        return { name: rec.name, rec, get: () => rec.value, set: (v, ln) => this.setVar(rec, v, ln || e.line) };
      }
      if (e.k === 'field') {
        const basePl = yield* this.place(e.e, env, wantMut);
        const base = basePl ? deref(basePl.get()) : deref(yield* this.ev(e.e, env));
        if (base.t === 'struct') {
          if (!(e.name in base.f)) throw rerr('E0609', `no field \`${e.name}\` on type \`${base.name}\``, e.line);
          return { name: e.name, get: () => base.f[e.name], set: v => { base.f[e.name] = this.coerceLike(v, base.f[e.name]); if (basePl && basePl.rec) basePl.rec.stamp = ++this.changeCounter; } };
        }
        if (base.t === 'tuple') return { name: e.name, get: () => base.v[Number(e.name)], set: v => { base.v[Number(e.name)] = v; } };
        return null;
      }
      if (e.k === 'index') {
        const basePl = yield* this.place(e.e, env, wantMut);
        const base = basePl ? deref(basePl.get()) : deref(yield* this.ev(e.e, env));
        const idx = deref(yield* this.ev(e.idx, env));
        this.index(base, idx, e.line);
        return { name: 'item', get: () => base.v[idx.v], set: v => { base.v[idx.v] = this.coerceLike(v, base.v[idx.v]); if (basePl && basePl.rec) basePl.rec.stamp = ++this.changeCounter; } };
      }
      if (e.k === 'deref') {
        const r = yield* this.ev(e.e, env);
        if (r.t !== 'ref') return null;
        return { name: r.name, get: r.get, set: v => r.set(this.coerceLike(v, r.get())) };
      }
      return null;
    }
    coerceLike(v, old) {
      if (old && v.t === 'int' && !v.ty && old.t === 'int') return I(checkRange(v.v, old.ty || 'i32', '+', null), old.ty);
      if (old && v.t === 'float' && !v.ty && old.t === 'float') return F(v.v, old.ty);
      return v;
    }

    *assign(e, env) {
      yield* this.tick(e.line);
      const pl = yield* this.place(e.target, env, true);
      if (!pl) throw rerr('E0070', 'invalid left-hand side of assignment', e.line, 'Αριστερά από το = μπαίνει μια μεταβλητή, ένα πεδίο (p.x) ή ένα στοιχείο (v[0]).');
      let rhs = this.take(e.value, yield* this.ev(e.value, env), env);
      if (e.op !== '=') {
        const cur = deref(pl.get());
        rhs = this.arith(e.op.slice(0, -1), cur, deref(rhs), e.line);
      } else if (pl.rec && pl.rec.value.t === 'uninit') rhs = this.settle(rhs);
      else rhs = this.coerceLike(rhs, pl.get());
      pl.set(rhs, e.line);
    }

    *binary(e, env) {
      if (e.op === '&&' || e.op === '||') {
        const l = deref(yield* this.ev(e.l, env));
        if (l.t !== 'bool') throw rerr('E0308', 'mismatched types', e.line, `Το ${e.op} θέλει bool και από τις δύο μεριές.`);
        if (e.op === '&&' ? !l.v : l.v) return l;
        const r = deref(yield* this.ev(e.r, env));
        if (r.t !== 'bool') throw rerr('E0308', 'mismatched types', e.line, `Το ${e.op} θέλει bool και από τις δύο μεριές.`);
        return r;
      }
      const lv = yield* this.ev(e.l, env);
      const rv = yield* this.ev(e.r, env);
      if (e.op === '+' && deref(lv).t === 'str') {
        const l = deref(lv);
        const r = deref(rv);
        if (!l.owned) throw rerr('E0369', 'cannot add `&str` to `&str`', e.line, 'Για να ενώσεις κείμενα, το αριστερό πρέπει να είναι String: String::from("…") + "…", ή χρησιμοποίησε format!("{}{}", a, b).');
        if (r.t !== 'str' || (r.owned && rv.t !== 'ref')) throw rerr('E0308', 'mismatched types', e.line, 'Στο String + … το δεξί πρέπει να είναι &str. Γράψε a + &b.');
        this.take(e.l, lv, env);
        return S(l.v + r.v, true);
      }
      return this.arith(e.op, deref(lv), deref(rv), e.line);
    }

    arith(op, l, r, line) {
      if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
        if (l.t !== r.t && !(l.t === 'str' && r.t === 'str')) throw rerr('E0308', 'mismatched types', line, `Συγκρίνεις ${typeOfVal(l)} με ${typeOfVal(r)}. Στη Rust συγκρίνονται μόνο τιμές ίδιου τύπου.`);
        if (l.t === 'int' && r.t === 'int' && l.ty && r.ty && l.ty !== r.ty) throw rerr('E0308', `mismatched types: expected \`${l.ty}\`, found \`${r.ty}\``, line, `Μετάτρεψε τη μία τιμή με as, π.χ. x as ${l.ty}.`);
        if (op === '==') return B(eqVal(l, r));
        if (op === '!=') return B(!eqVal(l, r));
        const c = cmpVal(l, r);
        return B(op === '<' ? c < 0 : op === '>' ? c > 0 : op === '<=' ? c <= 0 : c >= 0);
      }
      if (l.t === 'dur' && r.t === 'dur') {
        if (op === '+') return { t: 'dur', us: l.us + r.us };
        if (op === '-') { if (r.us > l.us) panic('overflow when subtracting durations', line); return { t: 'dur', us: l.us - r.us }; }
      }
      if (l.t === 'dur' && r.t === 'int' && (op === '*' || op === '/')) return { t: 'dur', us: op === '*' ? l.us * r.v : Math.floor(l.us / r.v) };
      if (l.t === 'inst' && r.t === 'inst' && op === '-') return { t: 'dur', us: Math.max(0, l.us - r.us) };
      if (l.t === 'inst' && r.t === 'dur') return { t: 'inst', us: op === '+' ? l.us + r.us : l.us - r.us };
      if (l.t === 'int' && r.t === 'int') {
        let ty = l.ty || r.ty;
        if (l.ty && r.ty && l.ty !== r.ty && op !== '<<' && op !== '>>') throw rerr('E0308', `mismatched types: expected \`${l.ty}\`, found \`${r.ty}\``, line, `Στη Rust δεν ανακατεύονται τύποι ακεραίων. Μετάτρεψε τη μία τιμή: (x as ${l.ty}).`);
        const keep = !l.ty && !r.ty ? null : ty;
        ty = ty || 'i32';
        const a = l.v;
        const b = r.v;
        switch (op) {
          case '+': return I(checkRange(a + b, ty, '+', line), keep);
          case '-': return I(checkRange(a - b, ty, '-', line), keep);
          case '*': return I(checkRange(a * b, ty, '*', line), keep);
          case '/': if (b === 0) panic('attempt to divide by zero', line); return I(Math.trunc(a / b), keep);
          case '%': if (b === 0) panic('attempt to calculate the remainder with a divisor of zero', line); return I(a % b, keep);
          case '&': return I(a & b, keep);
          case '|': return I(a | b, keep);
          case '^': return I(a ^ b, keep);
          case '<<': return I(checkRange(a * Math.pow(2, b), ty, '*', line), keep);
          case '>>': return I(Math.floor(a / Math.pow(2, b)), keep);
        }
      }
      if ((l.t === 'float' || l.t === 'int') && (r.t === 'float' || r.t === 'int')) {
        if (l.t !== r.t) {
          const lt = l.t === 'int' ? (l.ty || '{integer}') : (l.ty || '{float}');
          const rt = r.t === 'int' ? (r.ty || '{integer}') : (r.ty || '{float}');
          const words = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '%': 'calculate the remainder of' };
          throw rerr('E0277', `cannot ${words[op] || op} \`${rt}\` ${op === '+' ? 'to' : op === '-' ? 'from' : 'by'} \`${lt}\``, line, `Η Rust δεν ανακατεύει ακεραίους και δεκαδικούς. Μετάτρεψε τον ακέραιο: (x as f32), ή γράψε τον αριθμό με τελεία, π.χ. 2.0.`);
        }
        if (l.ty && r.ty && l.ty !== r.ty) throw rerr('E0308', `mismatched types: expected \`${l.ty}\`, found \`${r.ty}\``, line, `Μετάτρεψε με as ${l.ty}.`);
        const ty = l.ty || r.ty;
        const a = l.v;
        const b = r.v;
        const res = { '+': a + b, '-': a - b, '*': a * b, '/': a / b, '%': a % b }[op];
        if (res === undefined) throw rerr('E0369', `no implementation for \`{float} ${op} {float}\``, line);
        return F(res, ty);
      }
      throw rerr('E0369', `cannot apply binary operator \`${op}\` to type \`${typeOfVal(l)}\``, line, l.t === 'str' ? 'Για να ενώσεις κείμενα χρησιμοποίησε format!("{}{}", a, b) ή String + &str.' : '');
    }

    cast(v, type, line) {
      const tn = type.k === 'path' ? type.name : null;
      if (isIntTy(tn)) {
        let x;
        if (v.t === 'int') x = v.v;
        else if (v.t === 'float') x = Number.isNaN(v.v) ? 0 : Math.trunc(v.v);
        else if (v.t === 'bool') x = v.v ? 1 : 0;
        else if (v.t === 'char') x = v.v.codePointAt(0);
        else throw rerr('E0605', `non-primitive cast: \`${typeOfVal(v)}\` as \`${tn}\``, line, v.t === 'str' ? 'Για να κάνεις κείμενο αριθμό χρησιμοποίησε .parse::<i32>().' : '');
        const [lo, hi] = INT_RANGE[tn];
        if (v.t === 'float') x = Math.min(hi, Math.max(lo, x)); // οι μετατροπές από δεκαδικό «κόβουν» στα όρια
        else if (x < lo || x > hi) { const span = hi - lo + 1; x = ((((x - lo) % span) + span) % span) + lo; } // αναδίπλωση
        return I(x, tn);
      }
      if (tn === 'f32' || tn === 'f64') {
        if (v.t === 'int' || v.t === 'float') return F(v.v, tn);
        throw rerr('E0605', `non-primitive cast: \`${typeOfVal(v)}\` as \`${tn}\``, line);
      }
      if (tn === 'char' && v.t === 'int' && v.ty === 'u8') return { t: 'char', v: String.fromCharCode(v.v) };
      if (tn === 'bool') throw rerr('E0054', `cannot cast \`${typeOfVal(v)}\` as \`bool\``, line, 'Γράψε σύγκριση, π.χ. x != 0.');
      throw rerr('E0605', `non-primitive cast: \`${typeOfVal(v)}\` as \`${typeName(type)}\``, line);
    }

    *ifExpr(e, env) {
      yield* this.tick(e.line);
      const c = deref(yield* this.ev(e.cond, env));
      if (c.t !== 'bool') throw rerr('E0308', `mismatched types: expected \`bool\`, found \`${typeOfVal(c)}\``, e.line, 'Η συνθήκη του if πρέπει να είναι true/false. Για αριθμό γράψε σύγκριση, π.χ. if x != 0.');
      this.recordBranch(e, env, c.v);
      if (c.v) return yield* this.block(e.then, env);
      if (e.els) {
        if (e.els.k === 'if') return yield* this.ifExpr(e.els, env);
        if (e.els.k === 'iflet') return yield* this.ev(e.els, env);
        this.lastBranch = Object.assign({}, this.lastBranch, { branch: 'else', range: { from: e.els.line, to: e.els.endLine } });
        return yield* this.block(e.els, env);
      }
      return UNIT;
    }
    recordBranch(e, env, result) {
      const names = [];
      (function walk(x) {
        if (!x || typeof x !== 'object') return;
        if (x.k === 'path' && x.segs.length === 1 && !names.includes(x.segs[0])) names.push(x.segs[0]);
        for (const k of ['l', 'r', 'e', 'cond']) walk(x[k]);
        if (x.args) x.args.forEach(walk);
      })(e.cond);
      const vars = names.map(n => { const r = env.find(n); return r ? { name: n, value: show(r.value) } : null; }).filter(Boolean);
      const prev = this.lastBranch;
      const chained = prev && prev.chainLine === e.line;
      this.lastBranch = {
        line: e.line, lang: 'rust', kw: chained ? 'else if' : 'if', cond: e.cond.src || '', vars, result,
        branch: result ? (chained ? 'elif' : 'if') : 'none',
        range: result ? { from: e.then.line, to: e.then.endLine } : null,
        chainLine: e.els && e.els.k === 'if' ? e.els.line : null
      };
    }

    *matchExpr(e, env) {
      yield* this.tick(e.line);
      const v = yield* this.ev(e.e, env);
      for (const arm of e.arms) {
        const inner = new Env(env);
        if (!this.match(arm.pat, v, inner, arm.line)) continue;
        if (arm.guard) {
          const g = deref(yield* this.ev(arm.guard, inner));
          if (!g.v) continue;
        }
        if (arm.body.k !== 'block') yield* this.tick(arm.line);
        return yield* this.ev(arm.body, inner);
      }
      throw rerr('E0004', `non-exhaustive patterns: \`${debug(deref(v))}\` not covered`, e.line, 'Το match πρέπει να καλύπτει κάθε δυνατή τιμή. Πρόσθεσε ένα σκέλος _ => … στο τέλος.');
    }

    *loopBody(e, env) {
      try {
        yield* this.block(e.body, env);
      } catch (x) {
        if (x && x.signal === 'break' && (!x.label || x.label === e.label)) { this.breakValue = x.value; return 'break'; }
        if (x && x.signal === 'continue' && (!x.label || x.label === e.label)) return 'continue';
        throw x;
      }
      return null;
    }
    *loop(e, env) {
      for (;;) {
        yield* this.tick(e.line);
        const r = yield* this.loopBody(e, env);
        if (r === 'break') { const v = this.breakValue || UNIT; this.breakValue = null; return v; }
      }
    }
    *forLoop(e, env) {
      yield* this.tick(e.line);
      const it = yield* this.ev(e.iter, env);
      const items = this.iterate(it, e.line, e.iter, env);
      for (const x of items) {
        const inner = new Env(env);
        this.bindPattern(e.pat, x, inner, e.line);
        yield* this.tick(e.line);
        const r = yield* this.loopBody(e, inner);
        if (r === 'break') return UNIT;
      }
      return UNIT;
    }
    iterate(v, line, expr, env) {
      const d = deref(v);
      if (d.t === 'range') {
        if (!d.lo || !d.hi) throw new CodeError('Ένα for πάνω σε περιοχή χρειάζεται αρχή και τέλος, π.χ. 0..10.', line);
        if (d.lo.t !== 'int') throw rerr('E0277', `the trait bound \`${typeOfVal(d.lo)}: Step\` is not satisfied`, line, 'Το for … in a..b δουλεύει μόνο με ακεραίους.');
        const out = [];
        const end = d.hi.v + (d.incl ? 1 : 0);
        const ty = d.lo.ty || d.hi.ty || 'i32';
        if (end - d.lo.v > 100000) throw new CodeError('Ο βρόχος for έχει υπερβολικά πολλές επαναλήψεις για την προσομοίωση.', line);
        for (let i = d.lo.v; i < end; i++) out.push(I(i, ty));
        return out;
      }
      if (d.t === 'iter') return d.items;
      if (d.t === 'vec') {
        if (v.t !== 'ref' && expr && !d.arr) this.take(expr, v, env);
        return v.t === 'ref' ? d.v.map((x, i) => ({ t: 'ref', mut: v.mut, get: () => d.v[i], set: nv => { d.v[i] = nv; } })) : d.v.slice();
      }
      if (d.t === 'opt') return d.some ? [d.v] : [];
      throw rerr('E0277', `\`${typeOfVal(d)}\` is not an iterator`, line, 'Το for δουλεύει με περιοχές (0..10), Vec και πίνακες.');
    }

    // ---------------------------------------------------------- κλήσεις
    *callExpr(e, env) {
      const f = e.fn.k === 'path' ? this.path(e.fn, env) : yield* this.ev(e.fn, env);
      const args = [];
      for (const a of e.args) args.push(this.take(a, yield* this.ev(a, env), env));
      if (f.t === 'ctor') return f.make(args.map(x => this.settle(x)));
      if (f.t === 'fn') {
        const def = f.def;
        const want = def.params.length;
        if (args.length !== want) throw rerr('E0061', `this function takes ${want} argument${want === 1 ? '' : 's'} but ${args.length} argument${args.length === 1 ? ' was' : 's were'} supplied`, e.line, `Η ${def.name}() θέλει ${want} τιμ${want === 1 ? 'ή' : 'ές'} μέσα στις παρενθέσεις.`);
        yield* this.tick(e.line);
        return yield* this.call(def, args, e.line);
      }
      if (f.t === 'builtin') {
        const r = f.call(args, e.line, this);
        if (r && typeof r.next === 'function') return yield* r;
        return r;
      }
      throw rerr('E0618', `expected function, found \`${typeOfVal(f)}\``, e.line);
    }

    *method(e, env) {
      // παραλήπτης: για μεθόδους &mut self χρειαζόμαστε «θέση», ώστε οι αλλαγές να μένουν
      const pl = yield* this.place(e.e, env, true);
      let recv = pl ? pl.get() : yield* this.ev(e.e, env);
      const args = [];
      for (const a of e.args) args.push(this.take(a, yield* this.ev(a, env), env));
      const d = deref(recv);
      if (d.t === 'uninit') throw rerr('E0381', 'used binding isn\'t initialized', e.line);
      // μέθοδοι χρήστη (impl)
      const name = e.name;
      const userTy = d.t === 'struct' || d.t === 'enum' ? d.name : null;
      if (userTy) {
        const m = this.prog.methods.get(userTy);
        if (m && m.has(name)) {
          const def = m.get(name);
          const sp = def.params[0];
          if (!sp || !sp.self) throw rerr('E0599', `no method named \`${name}\` found for struct \`${userTy}\``, e.line, `Η ${userTy}::${name} δεν παίρνει self: κάλεσέ τη ως ${userTy}::${name}(…).`);
          const want = def.params.length - 1;
          if (args.length !== want) throw rerr('E0061', `this method takes ${want} argument${want === 1 ? '' : 's'} but ${args.length} argument${args.length === 1 ? ' was' : 's were'} supplied`, e.line);
          let self;
          if (sp.ref) self = { t: 'ref', mut: sp.mut, get: () => deref(pl ? pl.get() : recv), set: v => (pl ? pl.set(v) : Object.assign(d, v)) };
          else { self = this.take(e.e, recv, env); if (isCopy(d)) self = clone(d); }
          yield* this.tick(e.line);
          const r = yield* this.call(def, [self].concat(args), e.line);
          if (pl && pl.rec) pl.rec.stamp = ++this.changeCounter;
          return r;
        }
      }
      yield* this.tick(e.line);
      const r = this.builtinMethod(d, name, args, e, recv, pl, env);
      if (pl && pl.rec && MUTATING.has(name)) pl.rec.stamp = ++this.changeCounter;
      if (r && typeof r.next === 'function') return yield* r;
      return r;
    }

    // ---------------------------------------------------------- μακροεντολές
    *macro(e, env) {
      const name = e.name;
      const evalArgs = function* (self, list) { const out = []; for (const a of list) out.push(yield* self.ev(a, env)); return out; };
      const fmtCall = function* (self, list, line) {
        if (!list.length) return '';
        if (list[0].k !== 'lit' || list[0].v.t !== 'str') throw rerr('', 'format argument must be a string literal', line, `Το πρώτο όρισμα του ${name}! είναι κείμενο σε "…", π.χ. ${name}!("x = {}", x).`);
        const args = yield* evalArgs(self, list.slice(1));
        return format(list[0].v.v, args, n => {
          const r = env.find(n) || self.globals.get(n);
          if (!r) throw rerr('E0425', `cannot find value \`${n}\` in this scope`, line, nameHint(n, self));
          if (r.moved) throw rerr('E0382', `borrow of moved value: \`${n}\``, line);
          return r.value;
        }, line);
      };
      switch (name) {
        case 'println': case 'print': case 'eprintln': case 'eprint': {
          yield* this.tick(e.line);
          const text = yield* fmtCall(this, e.args, e.line);
          const nl = name.endsWith('ln');
          const parts = text.split('\n');
          parts.forEach((part, i) => {
            const last = i === parts.length - 1;
            if (last && !nl) { if (part) this.board.serialWrite(part, false, e.line); return; }
            this.board.serialWrite(part, true, e.line);
          });
          return UNIT;
        }
        case 'info': case 'warn': case 'error': case 'debug': {
          yield* this.tick(e.line);
          const text = yield* fmtCall(this, e.args, e.line);
          const lv = { info: 'I', warn: 'W', error: 'E', debug: 'D' }[name];
          this.board.serialWrite(`${lv} (${Math.floor(this.board.micros / 1000)}) app: ${text}`, true, e.line);
          return UNIT;
        }
        case 'format': return S(yield* fmtCall(this, e.args, e.line), true);
        case 'panic': case 'unreachable': case 'todo': case 'unimplemented': {
          const text = e.args.length ? yield* fmtCall(this, e.args, e.line) : { panic: 'explicit panic', unreachable: 'internal error: entered unreachable code', todo: 'not yet implemented', unimplemented: 'not implemented' }[name];
          panic(name === 'unreachable' && e.args.length ? `internal error: entered unreachable code: ${text}` : text, e.line);
          break;
        }
        case 'assert': {
          const c = deref(yield* this.ev(e.args[0], env));
          if (!c.v) panic(e.args.length > 1 ? yield* fmtCall(this, e.args.slice(1), e.line) : 'assertion failed', e.line);
          return UNIT;
        }
        case 'assert_eq': case 'assert_ne': {
          const a = deref(yield* this.ev(e.args[0], env));
          const b = deref(yield* this.ev(e.args[1], env));
          const same = eqVal(a, b);
          if (same !== (name === 'assert_eq')) panic(`assertion \`left ${name === 'assert_eq' ? '==' : '!='} right\` failed\n  left: ${debug(a)}\n right: ${debug(b)}`, e.line);
          return UNIT;
        }
        case 'vec': {
          if (e.repeat) {
            const x = this.settle(yield* this.ev(e.args[0], env));
            const n = deref(yield* this.ev(e.args[1], env)).v;
            if (n > 100000) throw new CodeError('Το Vec είναι υπερβολικά μεγάλο για την προσομοίωση.', e.line);
            return { t: 'vec', v: Array.from({ length: n }, () => clone(x)) };
          }
          const v = [];
          for (const a of e.args) v.push(this.take(a, yield* this.ev(a, env), env));
          unifyInts(v);
          return { t: 'vec', v };
        }
        case 'anyhow': {
          const text = yield* fmtCall(this, e.args, e.line);
          return { t: 'err', msg: text, debug: text, ty: 'anyhow::Error' };
        }
        case 'bail': {
          const text = yield* fmtCall(this, e.args, e.line);
          throw { signal: 'return', value: ERR({ t: 'err', msg: text, debug: text, ty: 'anyhow::Error' }), line: e.line };
        }
        case 'matches': {
          const v = yield* this.ev(e.args[0], env);
          throw rerr('', 'matches! is not supported in this version', e.line, 'Χρησιμοποίησε match ή if let.') || v;
        }
      }
      throw rerr('', `cannot find macro \`${name}\` in this scope`, e.line, name === 'printf' ? 'Στη Rust γράφεις println!("…").' : 'Οι διαθέσιμες μακροεντολές: println!, print!, format!, vec!, panic!, assert!, assert_eq!.');
    }
  }
  const BLOCKISH = new Set(['if', 'loop', 'while', 'for', 'match', 'block', 'iflet', 'whilelet']);
  const MUTATING = new Set(['push', 'push_str', 'pop', 'insert', 'remove', 'clear', 'sort', 'reverse', 'truncate', 'set_high', 'set_low', 'toggle', 'write', 'set_pull', 'set_level', 'retain', 'extend', 'dedup']);

  function litVal(v) {
    switch (v.t) {
      case 'int': return I(v.v, v.ty);
      case 'float': return F(v.v, v.ty);
      case 'bool': return B(v.v);
      case 'char': return { t: 'char', v: v.v };
      case 'str': return S(v.v, false);
      case 'unit': return UNIT;
    }
    return v;
  }
  function checkLiteral(v, ty, line) {
    const r = INT_RANGE[ty];
    if (r && (v < r[0] || v > r[1])) throw rerr('', `literal out of range for \`${ty}\``, line, `Ο τύπος ${ty} χωράει τιμές από ${r[0]} έως ${r[1]}. Διάλεξε μεγαλύτερο τύπο (π.χ. ${ty[0] === 'u' ? 'u32' : 'i32'}).`);
  }
  function unifyInts(arr) {
    const ty = (arr.find(x => (x.t === 'int' || x.t === 'float') && x.ty) || {}).ty;
    arr.forEach((x, i) => { if (x.t === 'int' && !x.ty) arr[i] = I(x.v, ty && isIntTy(ty) ? ty : 'i32'); if (x.t === 'float' && !x.ty) arr[i] = F(x.v, ty === 'f32' ? 'f32' : 'f64'); });
  }
  function typeName(t) {
    if (!t) return '_';
    switch (t.k) {
      case 'path': return t.segs.join('::') + (t.args && t.args.length ? `<${t.args.map(typeName).join(', ')}>` : '');
      case 'ref': return `&${t.mut ? 'mut ' : ''}${typeName(t.of)}`;
      case 'unit': return '()';
      case 'tuple': return `(${t.items.map(typeName).join(', ')})`;
      case 'array': return `[${typeName(t.of)}; …]`;
      case 'slice': return `[${typeName(t.of)}]`;
      case 'never': return '!';
      case 'dyn': return `dyn ${typeName(t.path)}`;
    }
    return '_';
  }
  function utf8(s) { return Array.from(unescape(encodeURIComponent(s))).map(c => c.charCodeAt(0)); }
  function fromUtf8(bytes) { try { return decodeURIComponent(escape(String.fromCharCode(...bytes))); } catch (e) { return null; } }

  function panicHint(msg, target) {
    const reboot = target === 'esp32' ? ' Στο ESP32 ένα panic κάνει την πλακέτα να ξεκινήσει από την αρχή (reboot).' : '';
    if (/overflow/.test(msg)) return 'Το αποτέλεσμα δεν χωρά στον τύπο της μεταβλητής, και η Rust σταματά το πρόγραμμα αντί να δώσει λάθος αριθμό. Χρησιμοποίησε μεγαλύτερο τύπο ή checked_add / saturating_add.' + reboot;
    if (/index out of bounds/.test(msg)) return 'Ζήτησες στοιχείο που δεν υπάρχει. Οι θέσεις ξεκινούν από 0, άρα η τελευταία είναι len() - 1. Το v.get(i) επιστρέφει None αντί για panic.' + reboot;
    if (/unwrap\(\)` on a `None`/.test(msg)) return 'Το unwrap() σε None σταματά το πρόγραμμα. Χρησιμοποίησε match, if let ή unwrap_or(…).' + reboot;
    if (/unwrap\(\)` on an `Err`/.test(msg)) return 'Το unwrap() σε Err σταματά το πρόγραμμα. Χειρίσου το λάθος με match ή με ?.' + reboot;
    if (/divide by zero|remainder/.test(msg)) return 'Διαίρεση με το μηδέν. Έλεγξε τον διαιρέτη πριν διαιρέσεις.' + reboot;
    return 'Το πρόγραμμα σταμάτησε με panic.' + reboot;
  }
  const BOARD_HINT = {
    pi: 'Αυτή η βιβλιοθήκη είναι για ESP32. Στο Raspberry Pi χρησιμοποιείς το rppal: use rppal::gpio::Gpio;',
    esp32: 'Αυτή η βιβλιοθήκη είναι για Raspberry Pi. Στο ESP32 χρησιμοποιείς το esp_idf_svc::hal.'
  };
  function useHint(name, target) {
    const map = {
      Gpio: 'use rppal::gpio::Gpio;', Duration: 'use std::time::Duration;', Instant: 'use std::time::Instant;', thread: 'use std::thread;',
      Level: target === 'pi' ? 'use rppal::gpio::Level;' : 'use esp_idf_svc::hal::gpio::Level;',
      Peripherals: 'use esp_idf_svc::hal::peripherals::Peripherals;', PinDriver: 'use esp_idf_svc::hal::gpio::PinDriver;',
      Pull: 'use esp_idf_svc::hal::gpio::Pull;', FreeRtos: 'use esp_idf_svc::hal::delay::FreeRtos;', Ets: 'use esp_idf_svc::hal::delay::Ets;'
    };
    return map[name] ? `Πρόσθεσε στην αρχή: ${map[name]}` : `Ο τύπος ${name} δεν έχει οριστεί. Έλεγξε την ορθογραφία (κεφαλαία/μικρά) ή αν λείπει ένα use.`;
  }
  function nameHint(name, m) {
    if (name === 'True' || name === 'False') return `Στη Rust γράφεται ${name.toLowerCase()}, με μικρά.`;
    if (name === 'null' || name === 'nil' || name === 'NULL') return 'Η Rust δεν έχει null. Για «καμία τιμή» χρησιμοποιείται Option: None.';
    if (name === 'print' || name === 'println') return `Το ${name} είναι μακροεντολή: γράφεται ${name}!("…").`;
    return 'Έλεγξε την ορθογραφία (κεφαλαία/μικρά) και ότι η μεταβλητή δηλώθηκε με let πριν από αυτή τη γραμμή, μέσα στο ίδιο μπλοκ { }.';
  }

  root.IoTRustRT = { RustMachine, RustPanic, I, F, B, S, UNIT, SOME, NONE, OK, ERR, INT_RANGE, isIntTy, checkRange, panic, rerr, display, debug, show, format, isCopy, clone, deref, eqVal, cmpVal, typeOfVal, typeName, utf8, PI_MAP, ESP_MAP, PIN_WORD, BOARD_HINT, useHint, nameHint, fmtFloat, LIB: {} };
  const LIB = root.IoTRustRT.LIB;
})(typeof window !== 'undefined' ? window : globalThis);
