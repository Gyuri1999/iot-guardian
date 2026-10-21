/*
 * IoT Guardian — εκπαιδευτικός interpreter για υποσύνολο της Rust (ESP32 με esp-idf-svc και Raspberry Pi με rppal).
 *
 * Όπως οι άλλοι interpreters: ο κώδικας του μαθητή ΔΕΝ εκτελείται με eval() ή new Function().
 * tokenizer → parser (AST) → έλεγχος σαν του rustc (mut, move, τύποι) → εκτέλεση με generator, μία εντολή τη φορά.
 *
 * Τα λάθη έχουν το αγγλικό κείμενο του πραγματικού rustc (π.χ. error[E0382]: borrow of moved value: `s`)
 * και από κάτω ελληνική εξήγηση. Οι panics εμφανίζονται όπως στην πραγματική Rust.
 *
 * Υποστηρίζονται: fn, let / let mut, const, if / else, loop, while, for … in, match, if let / while let,
 * struct + impl, enum, String, Vec, Option, Result, ?, ακέραιοι με έλεγχο υπερχείλισης, f32 / f64,
 * println! / print! / format! / vec! / panic!, thread::sleep, Duration, Instant,
 * rppal::gpio (Raspberry Pi) και esp_idf_svc::hal (ESP32).
 */
(function (root) {
  'use strict';

  const { CodeError } = root.IoTInterp;

  // ================================================================== Tokenizer

  const KEYWORDS = new Set(['as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'false', 'fn', 'for', 'if', 'impl', 'in',
    'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct', 'super', 'trait',
    'true', 'type', 'unsafe', 'use', 'where', 'while', 'dyn', 'extern']);
  const OPS = ['..=', '...', '<<=', '>>=', '::', '->', '=>', '==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '^=', '&=', '|=',
    '<<', '>>', '..', '+', '-', '*', '/', '%', '^', '!', '&', '|', '=', '<', '>', '@', '.', ',', ';', ':', '#', '$', '?', '(', ')', '[', ']', '{', '}', '_'];
  const INT_SUFFIX = /^(i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize)$/;
  const FLOAT_SUFFIX = /^(f32|f64)$/;

  function err(code, msg, line, hint) {
    return new CodeError(`error${code ? `[${code}]` : ''}: ${msg}`, line, hint || '');
  }

  function tokenize(src) {
    const s = String(src).replace(/\r\n?/g, '\n');
    const toks = [];
    let i = 0;
    let line = 1;
    const push = (k, v, extra) => toks.push(Object.assign({ k, v, line, pos: tokStart }, extra || {}));
    let tokStart = 0;
    while (i < s.length) {
      tokStart = i;
      const c = s[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (c === '/' && s[i + 1] === '*') {
        const start = line;
        let depth = 1;
        i += 2;
        while (i < s.length && depth) {
          if (s[i] === '\n') line++;
          if (s[i] === '/' && s[i + 1] === '*') { depth++; i += 2; continue; }
          if (s[i] === '*' && s[i + 1] === '/') { depth--; i += 2; continue; }
          i++;
        }
        if (depth) throw err('', 'unterminated block comment', start, 'Ένα σχόλιο /* δεν έκλεισε με */.');
        continue;
      }
      // αριθμοί
      if (/[0-9]/.test(c)) {
        let j = i;
        let text = '';
        let isFloat = false;
        let base = 10;
        if (c === '0' && /[xob]/.test(s[i + 1] || '')) {
          base = { x: 16, o: 8, b: 2 }[s[i + 1]];
          j = i + 2;
          while (j < s.length && /[0-9a-fA-F_]/.test(s[j]) && !(base !== 16 && /[a-fA-F]/.test(s[j]) && /^[iu]/.test(s.slice(j)))) j++;
          text = s.slice(i + 2, j).replace(/_/g, '');
        } else {
          while (j < s.length && /[0-9_]/.test(s[j])) j++;
          if (s[j] === '.' && /[0-9]/.test(s[j + 1] || '')) { isFloat = true; j++; while (j < s.length && /[0-9_]/.test(s[j])) j++; }
          else if (s[j] === '.' && s[j + 1] !== '.' && !/[A-Za-z_]/.test(s[j + 1] || '')) { isFloat = true; j++; }
          if (/[eE]/.test(s[j] || '') && /[0-9+-]/.test(s[j + 1] || '')) { isFloat = true; j += 2; while (j < s.length && /[0-9_]/.test(s[j])) j++; }
          text = s.slice(i, j).replace(/_/g, '');
        }
        let suffix = null;
        const m = /^[a-z][a-z0-9]*/.exec(s.slice(j));
        if (m && (INT_SUFFIX.test(m[0]) || FLOAT_SUFFIX.test(m[0]))) { suffix = m[0]; j += m[0].length; }
        else if (m) throw err('', `invalid suffix \`${m[0]}\` for number literal`, line, 'Μετά από έναν αριθμό μπορεί να ακολουθεί μόνο τύπος, π.χ. 5u8 ή 2.5f32.');
        if (suffix && FLOAT_SUFFIX.test(suffix)) isFloat = true;
        if (isFloat) push('float', parseFloat(text), { suffix });
        else push('int', base === 10 ? Number(text) : parseInt(text, base), { suffix });
        i = j;
        continue;
      }
      // αναγνωριστικά, λέξεις-κλειδιά, μακροεντολές
      if (/[A-Za-z_Ͱ-Ͽ]/.test(c)) {
        let j = i + 1;
        while (j < s.length && /[A-Za-z0-9_Ͱ-Ͽ]/.test(s[j])) j++;
        const w = s.slice(i, j);
        i = j;
        if (w === '_' ) { push('op', '_'); continue; }
        if (/[Ͱ-Ͽ]/.test(w)) throw err('', `unknown start of token: ${w[0]}`, line, 'Τα ονόματα στη Rust γράφονται με λατινικούς χαρακτήρες. Τα ελληνικά επιτρέπονται μόνο μέσα σε "…" και σε σχόλια.');
        if (s[i] === '!' && s[i + 1] !== '=' && /^\s*[([{]/.test(s.slice(i + 1))) { push('macro', w); i++; continue; }
        push(KEYWORDS.has(w) ? 'kw' : 'id', w);
        continue;
      }
      // συμβολοσειρές
      if (c === '"' || (c === 'b' && s[i + 1] === '"')) {
        const start = line;
        let j = c === 'b' ? i + 2 : i + 1;
        let out = '';
        while (j < s.length && s[j] !== '"') {
          if (s[j] === '\\') {
            const e = s[j + 1];
            if (e === 'n') out += '\n'; else if (e === 't') out += '\t'; else if (e === 'r') out += '\r';
            else if (e === '0') out += '\0'; else if (e === '\\') out += '\\'; else if (e === '"') out += '"'; else if (e === "'") out += "'";
            else if (e === '\n') { line++; j += 2; while (/\s/.test(s[j] || '')) { if (s[j] === '\n') line++; j++; } continue; }
            else if (e === 'u') { const m = /^\{([0-9a-fA-F]+)\}/.exec(s.slice(j + 2)); if (!m) throw err('', 'invalid unicode character escape', line); out += String.fromCodePoint(parseInt(m[1], 16)); j += 2 + m[0].length; continue; }
            else throw err('', `unknown character escape: \`${e}\``, line, 'Μέσα σε "…" οι επιτρεπτές ακολουθίες με \\ είναι \\n, \\t, \\\\ και \\".');
            j += 2;
            continue;
          }
          if (s[j] === '\n') line++;
          out += s[j];
          j++;
        }
        if (j >= s.length) throw err('E0765', 'unterminated double quote string', start, 'Λείπει το " που κλείνει το κείμενο.');
        push('str', out, { line: start });
        i = j + 1;
        continue;
      }
      if (c === 'r' && s[i + 1] === '"') {
        const end = s.indexOf('"', i + 2);
        if (end < 0) throw err('E0748', 'unterminated raw string', line);
        const v = s.slice(i + 2, end);
        push('str', v);
        line += (v.match(/\n/g) || []).length;
        i = end + 1;
        continue;
      }
      // χαρακτήρες και lifetimes
      if (c === "'") {
        const m = /^'(\\u\{[0-9a-fA-F]+\}|\\.|[^\\'])'/u.exec(s.slice(i));
        if (m) {
          let v = m[1];
          if (v.startsWith('\\u')) v = String.fromCodePoint(parseInt(v.slice(3, -1), 16));
          else if (v[0] === '\\') v = { n: '\n', t: '\t', r: '\r', 0: '\0', '\\': '\\', "'": "'", '"': '"' }[v[1]];
          push('char', v);
          i += m[0].length;
          continue;
        }
        const lt = /^'[A-Za-z_]\w*/.exec(s.slice(i));
        if (lt) { push('lifetime', lt[0]); i += lt[0].length; continue; }
        throw err('', 'unterminated character literal', line, "Ένας χαρακτήρας γράφεται με μονά εισαγωγικά, π.χ. 'a'. Για κείμενο χρησιμοποίησε διπλά: \"κείμενο\".");
      }
      const op = OPS.find(o => s.startsWith(o, i));
      if (op) { push('op', op); i += op.length; continue; }
      throw err('', `unknown start of token: ${c}`, line, c === '`' ? 'Το ` δεν χρησιμοποιείται στη Rust. Για κείμενο γράψε "…".' : '');
    }
    tokStart = s.length;
    push('eof', null);
    return toks;
  }

  // ================================================================== Parser

  function parse(src) {
    const T = tokenize(src);
    const SRC = String(src).replace(/\r\n?/g, '\n');
    const textFrom = (a, b) => SRC.slice(T[a].pos, T[b].pos).replace(/\s+/g, ' ').trim();
    let p = 0;
    const peek = (n) => T[p + (n || 0)];
    const next = () => T[p++];
    const isOp = (v, n) => { const t = peek(n); return t.k === 'op' && t.v === v; };
    const isKw = (v, n) => { const t = peek(n); return t.k === 'kw' && t.v === v; };
    const describe = t => (t.k === 'eof' ? 'end of file' : t.k === 'str' ? 'literal' : `\`${t.v}\``);
    function fail(msg, t, hint, code) { throw err(code || '', msg, (t || peek()).line, hint); }
    function expectOp(v, hint) {
      if (isOp(v)) return next();
      const t = peek();
      // Το πιο συχνό λάθος: λείπει το ; στο τέλος της προηγούμενης γραμμής.
      if (v === ';') fail(`expected \`;\`, found ${describe(t)}`, T[p - 1], hint || 'Κάθε εντολή τελειώνει με ;. Πρόσθεσε ; στο τέλος αυτής της γραμμής.');
      fail(`expected \`${v}\`, found ${describe(t)}`, t, hint || (v === '}' ? 'Μάλλον λείπει ένα } που κλείνει ένα μπλοκ.' : v === ')' ? 'Μάλλον λείπει μια ) που κλείνει παρένθεση.' : ''));
    }
    function expectId(what) {
      const t = peek();
      if (t.k === 'id' || (t.k === 'kw' && (t.v === 'self' || t.v === 'Self' || t.v === 'crate' || t.v === 'super'))) return next().v;
      if (t.k === 'kw') fail(`expected ${what || 'identifier'}, found keyword \`${t.v}\``, t, `Το «${t.v}» είναι δεσμευμένη λέξη της Rust και δεν μπορεί να γίνει όνομα.`);
      return fail(`expected ${what || 'identifier'}, found ${describe(t)}`, t);
    }

    // ---------------------------------------------------------- τύποι
    function parseType() {
      const t = peek();
      if (isOp('&')) {
        next();
        if (peek().k === 'lifetime') next();
        const mut = isKw('mut') ? (next(), true) : false;
        return { k: 'ref', mut, of: parseType() };
      }
      if (isOp('&&')) { next(); const mut = isKw('mut') ? (next(), true) : false; return { k: 'ref', mut: false, of: { k: 'ref', mut, of: parseType() } }; }
      if (isOp('(')) {
        next();
        const items = [];
        while (!isOp(')')) { items.push(parseType()); if (!isOp(')')) expectOp(','); }
        next();
        return items.length ? { k: 'tuple', items } : { k: 'unit' };
      }
      if (isOp('[')) {
        next();
        const of = parseType();
        let len = null;
        if (isOp(';')) { next(); len = parseExpr(); }
        expectOp(']');
        return len ? { k: 'array', of, len } : { k: 'slice', of };
      }
      if (isOp('!')) { next(); return { k: 'never' }; }
      if (isOp('_')) { next(); return { k: 'infer' }; }
      if (isKw('dyn') || isKw('impl')) { next(); const path = parsePathType(); return { k: 'dyn', path }; }
      if (isKw('fn')) fail('function pointer types are not supported here', t, 'Οι τύποι συναρτήσεων δεν υποστηρίζονται σε αυτή την εκπαιδευτική έκδοση.');
      return parsePathType();
    }
    function parsePathType() {
      const segs = [expectId('type')];
      let args = [];
      for (;;) {
        if (isOp('::') && peek(1).k !== 'op') { next(); segs.push(expectId('type')); continue; }
        if (isOp('::') && isOp('<', 1)) next();
        if (isOp('<')) {
          next();
          args = [];
          while (!isOp('>') && !isOp('>>')) {
            if (peek().k === 'lifetime') next(); else args.push(parseType());
            if (isOp(',')) next();
          }
          if (isOp('>>')) { T[p] = Object.assign({}, T[p], { v: '>' }); } else next();
          continue;
        }
        break;
      }
      return { k: 'path', name: segs[segs.length - 1], segs, args };
    }

    // ---------------------------------------------------------- items
    function parseAttrs() {
      const out = [];
      while (isOp('#')) {
        const line = next().line;
        const inner = isOp('!') ? (next(), true) : false;
        expectOp('[');
        let depth = 1;
        let text = '';
        while (depth && peek().k !== 'eof') {
          const t = next();
          if (t.k === 'op' && t.v === '[') depth++;
          if (t.k === 'op' && t.v === ']') { depth--; if (!depth) break; }
          text += t.k === 'str' ? `"${t.v}"` : t.v;
        }
        out.push({ text, inner, line });
      }
      return out;
    }

    function parseUse() {
      const line = next().line;
      const items = [];
      function tree(prefix) {
        if (isOp('{')) {
          next();
          while (!isOp('}')) { tree(prefix.slice()); if (!isOp('}')) expectOp(','); }
          next();
          return;
        }
        if (isOp('*')) { next(); items.push({ path: prefix.concat('*'), alias: null, line }); return; }
        const seg = expectId('module name');
        const path = prefix.concat(seg);
        if (isOp('::')) { next(); tree(path); return; }
        let alias = null;
        if (isKw('as')) { next(); alias = isOp('_') ? (next(), '_') : expectId(); }
        items.push({ path, alias, line });
      }
      if (isOp('::')) next();
      tree([]);
      expectOp(';');
      return { k: 'use', items, line };
    }

    function parseParams() {
      expectOp('(');
      const params = [];
      while (!isOp(')')) {
        const line = peek().line;
        // self, &self, &mut self, mut self
        if (isKw('self') || (isOp('&') && (isKw('self', 1) || (isKw('mut', 1) && isKw('self', 2)))) || (isKw('mut') && isKw('self', 1))) {
          let ref = false; let mut = false;
          if (isOp('&')) { next(); ref = true; }
          if (isKw('mut')) { next(); mut = true; }
          next();
          params.push({ self: true, ref, mut, line });
        } else {
          const mut = isKw('mut') ? (next(), true) : false;
          const name = isOp('_') ? (next(), '_') : expectId('parameter name');
          expectOp(':', `Κάθε παράμετρος χρειάζεται τύπο: ${name}: i32`);
          params.push({ name, mut, type: parseType(), line });
        }
        if (!isOp(')')) expectOp(',');
      }
      next();
      return params;
    }

    function parseFn(attrs) {
      const line = next().line;
      const name = expectId('function name');
      if (isOp('<')) fail('generic functions are not supported in this version', peek(), 'Οι γενικές (generic) συναρτήσεις δεν υποστηρίζονται σε αυτή την εκπαιδευτική έκδοση. Γράψε συγκεκριμένους τύπους.');
      const params = parseParams();
      let ret = { k: 'unit' };
      if (isOp('->')) { next(); ret = parseType(); }
      if (isKw('where')) fail('`where` clauses are not supported', peek());
      const body = parseBlock();
      return { k: 'fn', name, params, ret, body, line, attrs: attrs || [], endLine: T[p - 1].line };
    }

    function parseStruct() {
      const line = next().line;
      const name = expectId('struct name');
      if (isOp(';')) { next(); return { k: 'struct', name, fields: [], unit: true, line }; }
      if (isOp('(')) {
        next();
        const fields = [];
        let i = 0;
        while (!isOp(')')) { if (isKw('pub')) next(); fields.push({ name: String(i++), type: parseType() }); if (!isOp(')')) expectOp(','); }
        next();
        expectOp(';');
        return { k: 'struct', name, fields, tuple: true, line };
      }
      expectOp('{');
      const fields = [];
      while (!isOp('}')) {
        parseAttrs();
        if (isKw('pub')) next();
        const fl = peek().line;
        const fname = expectId('field name');
        expectOp(':');
        fields.push({ name: fname, type: parseType(), line: fl });
        if (!isOp('}')) expectOp(',');
      }
      next();
      return { k: 'struct', name, fields, line };
    }

    function parseEnum() {
      const line = next().line;
      const name = expectId('enum name');
      expectOp('{');
      const variants = [];
      while (!isOp('}')) {
        parseAttrs();
        const vl = peek().line;
        const vname = expectId('variant name');
        let types = null;
        if (isOp('(')) {
          next();
          types = [];
          while (!isOp(')')) { types.push(parseType()); if (!isOp(')')) expectOp(','); }
          next();
        } else if (isOp('{')) fail('struct-like enum variants are not supported', peek(), 'Γράψε τις παραλλαγές χωρίς πεδία ή με τιμές σε παρενθέσεις, π.χ. Red ή Temp(f32).');
        if (isOp('=')) { next(); parseExpr(); }
        variants.push({ name: vname, types, line: vl });
        if (!isOp('}')) expectOp(',');
      }
      next();
      return { k: 'enum', name, variants, line };
    }

    function parseImpl() {
      const line = next().line;
      if (isOp('<')) fail('generic impl blocks are not supported', peek());
      let name = expectId('type name');
      let trait = null;
      if (isKw('for')) { next(); trait = name; name = expectId('type name'); }
      expectOp('{');
      const fns = [];
      while (!isOp('}')) {
        const attrs = parseAttrs();
        if (isKw('pub')) next();
        if (!isKw('fn')) fail(`expected \`fn\`, found ${describe(peek())}`, peek(), 'Μέσα σε impl γράφεις μόνο συναρτήσεις (fn).');
        fns.push(parseFn(attrs));
      }
      next();
      return { k: 'impl', name, trait, fns, line };
    }

    function parseConst() {
      const t = next();
      const name = expectId('constant name');
      expectOp(':', `Οι σταθερές χρειάζονται τύπο: ${t.v} ${name}: u32 = …;`);
      const type = parseType();
      expectOp('=');
      const value = parseExpr();
      expectOp(';');
      return { k: 'const', name, type, value, line: t.line, isStatic: t.v === 'static' };
    }

    function parseItem() {
      const attrs = parseAttrs();
      if (isKw('pub')) { next(); if (isOp('(')) { next(); while (!isOp(')')) next(); next(); } }
      if (isKw('fn')) return parseFn(attrs);
      if (isKw('use')) return parseUse();
      if (isKw('struct')) return Object.assign(parseStruct(), { attrs });
      if (isKw('enum')) return Object.assign(parseEnum(), { attrs });
      if (isKw('impl')) return parseImpl();
      if (isKw('const') || isKw('static')) return parseConst();
      if (isKw('extern')) { next(); if (isKw('crate')) { next(); expectId(); expectOp(';'); return null; } }
      if (isKw('mod')) fail('modules are not supported in this version', peek(), 'Γράψε όλο τον κώδικα σε ένα αρχείο, χωρίς mod.');
      if (isKw('trait')) fail('defining traits is not supported in this version', peek(), 'Οι traits δεν υποστηρίζονται σε αυτή την εκπαιδευτική έκδοση. Γράψε μεθόδους μέσα σε impl.');
      if (attrs.length && peek().k === 'eof') return null;
      if (isKw('let')) fail('expected item, found keyword `let`', peek(), 'Το let γράφεται μέσα σε συνάρτηση, π.χ. μέσα στη fn main() { … }.');
      return fail(`expected item, found ${describe(peek())}`, peek(), 'Έξω από συναρτήσεις γράφεις μόνο use, const, fn, struct, enum και impl. Οι εντολές μπαίνουν μέσα σε fn main() { … }.');
    }

    // ---------------------------------------------------------- μπλοκ και εντολές
    function parseBlock() {
      const open = expectOp('{', 'Εδώ πρέπει να ανοίξει μπλοκ με {.');
      const stmts = [];
      let tail = null;
      while (!isOp('}')) {
        if (peek().k === 'eof') fail('this file contains an unclosed delimiter', open, 'Κάποιο { δεν έκλεισε ποτέ με }. Μέτρησε τα { και τα }.');
        if (isOp(';')) { next(); continue; }
        const line = peek().line;
        if (isKw('let')) { stmts.push(parseLet()); continue; }
        if (isKw('fn') || isKw('use') || isKw('const') || isKw('struct') || isKw('enum') || isOp('#')) {
          if (isOp('#')) { parseAttrs(); continue; }
          if (isKw('use')) { stmts.push(parseUse()); continue; }
          if (isKw('const')) { stmts.push(parseConst()); continue; }
          fail('nested items are not supported here', peek(), 'Γράψε τις συναρτήσεις, τα struct και τα enum έξω από τη main, όχι μέσα της.');
        }
        const e = parseExpr({ stmt: true });
        if (isOp(';')) { next(); stmts.push({ k: 'expr', e, semi: true, line }); continue; }
        if (isOp('}')) { tail = e; break; }
        if (BLOCKLIKE.has(e.k)) { stmts.push({ k: 'expr', e, semi: false, line }); continue; }
        expectOp(';');
      }
      const close = next();
      return { k: 'block', stmts, tail, line: open.line, endLine: close.line };
    }
    const BLOCKLIKE = new Set(['if', 'loop', 'while', 'for', 'match', 'block', 'iflet', 'whilelet']);

    function parseLet() {
      const line = next().line;
      const pat = parsePattern();
      let type = null;
      if (isOp(':')) { next(); type = parseType(); }
      let init = null;
      if (isOp('=')) { next(); init = parseExpr(); }
      if (isKw('else')) fail('let-else is not supported in this version', peek());
      expectOp(';');
      return { k: 'let', pat, type, init, line };
    }

    // ---------------------------------------------------------- patterns
    function parsePattern() {
      const first = parsePatternOne();
      if (!isOp('|')) return first;
      const alts = [first];
      while (isOp('|')) { next(); alts.push(parsePatternOne()); }
      return { k: 'or', alts, line: first.line };
    }
    function parsePatternOne() {
      const t = peek();
      const line = t.line;
      if (isOp('_')) { next(); return { k: 'wild', line }; }
      if (isOp('&')) { next(); return parsePatternOne(); }
      if (isOp('(')) {
        next();
        const items = [];
        while (!isOp(')')) { items.push(parsePattern()); if (!isOp(')')) expectOp(','); }
        next();
        return items.length ? { k: 'tuple', items, line } : { k: 'lit', v: { t: 'unit' }, line };
      }
      if (isKw('ref')) next();
      if (isKw('mut')) { next(); return { k: 'bind', name: expectId(), mut: true, line }; }
      // λεκτικά και περιοχές
      const litStart = t.k === 'int' || t.k === 'float' || t.k === 'str' || t.k === 'char' || isKw('true') || isKw('false') || (isOp('-') && (peek(1).k === 'int' || peek(1).k === 'float'));
      if (litStart) {
        const lo = parseLitPat();
        if (isOp('..=') || isOp('...')) { next(); return { k: 'range', lo, hi: parseLitPat(), incl: true, line }; }
        if (isOp('..')) { next(); if (isOp('=>') || isOp(',') || isOp('|')) return { k: 'range', lo, hi: null, incl: false, line }; return { k: 'range', lo, hi: parseLitPat(), incl: false, line }; }
        return { k: 'lit', v: lo, line };
      }
      if (isOp('..=')) { next(); return { k: 'range', lo: null, hi: parseLitPat(), incl: true, line }; }
      if (t.k === 'id' || isKw('Self') || isKw('crate')) {
        const segs = [next().v];
        while (isOp('::')) { next(); segs.push(expectId()); }
        if (isOp('(')) {
          next();
          const items = [];
          while (!isOp(')')) { items.push(parsePattern()); if (!isOp(')')) expectOp(','); }
          next();
          return { k: 'variant', segs, items, line };
        }
        if (isOp('{')) {
          next();
          const fields = [];
          while (!isOp('}')) {
            if (isOp('..')) { next(); continue; }
            const fname = expectId();
            let pat = { k: 'bind', name: fname, mut: false, line };
            if (isOp(':')) { next(); pat = parsePattern(); }
            fields.push({ name: fname, pat });
            if (!isOp('}')) expectOp(',');
          }
          next();
          return { k: 'structpat', segs, fields, line };
        }
        // Ένα όνομα με κεφαλαίο πρώτο γράμμα ή με :: είναι παραλλαγή/σταθερά· αλλιώς δέσιμο σε μεταβλητή.
        if (segs.length > 1 || /^[A-Z]/.test(segs[0])) {
          if (segs.length === 1 && isOp('@')) fail('`@` patterns are not supported', peek());
          return { k: 'variant', segs, items: null, line };
        }
        if (isOp('@')) { next(); const sub = parsePatternOne(); return { k: 'bind', name: segs[0], mut: false, sub, line }; }
        return { k: 'bind', name: segs[0], mut: false, line };
      }
      return fail(`expected pattern, found ${describe(t)}`, t);
    }
    function parseLitPat() {
      let neg = false;
      if (isOp('-')) { next(); neg = true; }
      const t = next();
      if (t.k === 'int') return { t: 'int', v: neg ? -t.v : t.v, ty: t.suffix || null };
      if (t.k === 'float') return { t: 'float', v: neg ? -t.v : t.v, ty: t.suffix || null };
      if (t.k === 'str') return { t: 'str', v: t.v };
      if (t.k === 'char') return { t: 'char', v: t.v };
      if (t.k === 'kw' && (t.v === 'true' || t.v === 'false')) return { t: 'bool', v: t.v === 'true' };
      return fail(`expected literal, found ${describe(t)}`, t);
    }

    // ---------------------------------------------------------- εκφράσεις (Pratt)
    const BIN = {
      '||': [3, 'or'], '&&': [4, 'and'],
      '==': [5, 'cmp'], '!=': [5, 'cmp'], '<': [5, 'cmp'], '>': [5, 'cmp'], '<=': [5, 'cmp'], '>=': [5, 'cmp'],
      '|': [6], '^': [7], '&': [8], '<<': [9], '>>': [9], '+': [10], '-': [10], '*': [11], '/': [11], '%': [11]
    };
    const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=', '^=', '&=', '|=', '<<=', '>>=']);

    function parseExpr(opts) {
      opts = opts || {};
      const lhs = parseRange(opts);
      if (peek().k === 'op' && ASSIGN.has(peek().v)) {
        const t = next();
        const rhs = parseExpr({ noStruct: opts.noStruct });
        return { k: 'assign', op: t.v, target: lhs, value: rhs, line: t.line };
      }
      return lhs;
    }
    function parseRange(opts) {
      if (isOp('..') || isOp('..=')) {
        const t = next();
        const hi = startsExpr() ? parseBin(0, opts) : null;
        return { k: 'range', lo: null, hi, incl: t.v === '..=', line: t.line };
      }
      const lo = parseBin(0, opts);
      if (isOp('..') || isOp('..=')) {
        const t = next();
        const hi = startsExpr() && !(opts.noStruct && isOp('{')) ? parseBin(0, opts) : null;
        return { k: 'range', lo, hi, incl: t.v === '..=', line: t.line };
      }
      return lo;
    }
    function startsExpr() {
      const t = peek();
      if (t.k === 'eof') return false;
      if (t.k === 'op') return ['(', '[', '-', '!', '&', '*', '|'].includes(t.v);
      return !(t.k === 'kw' && ['as', 'else'].includes(t.v));
    }
    function parseBin(minPrec, opts) {
      let left = parseUnary(opts);
      for (;;) {
        const t = peek();
        if (t.k === 'kw' && t.v === 'as') {
          if (12 < minPrec) break;
          next();
          left = { k: 'cast', e: left, type: parseType(), line: t.line };
          continue;
        }
        if (t.k !== 'op' || !BIN[t.v]) break;
        const [prec] = BIN[t.v];
        if (prec < minPrec) break;
        next();
        const right = parseBin(prec + 1, opts);
        left = { k: 'bin', op: t.v, l: left, r: right, line: t.line };
        if (BIN[t.v][1] === 'cmp' && peek().k === 'op' && BIN[peek().v] && BIN[peek().v][1] === 'cmp') {
          fail('comparison operators cannot be chained', peek(), 'Στη Rust δεν γράφεται a < b < c. Γράψε a < b && b < c.');
        }
      }
      return left;
    }
    function parseUnary(opts) {
      const t = peek();
      if (isOp('-')) { next(); return { k: 'neg', e: parseUnary(opts), line: t.line }; }
      if (isOp('!')) { next(); return { k: 'not', e: parseUnary(opts), line: t.line }; }
      if (isOp('*')) { next(); return { k: 'deref', e: parseUnary(opts), line: t.line }; }
      if (isOp('&') || isOp('&&')) {
        next();
        const mut = isKw('mut') ? (next(), true) : false;
        const inner = { k: 'ref', mut, e: parseUnary(opts), line: t.line };
        return t.v === '&&' ? { k: 'ref', mut: false, e: inner, line: t.line } : inner;
      }
      return parsePostfix(parsePrimary(opts), opts);
    }
    function parseArgs(close) {
      const args = [];
      while (!isOp(close)) { args.push(parseExpr()); if (!isOp(close)) expectOp(','); }
      next();
      return args;
    }
    function parsePostfix(e, opts) {
      for (;;) {
        const t = peek();
        if (isOp('?')) { next(); e = { k: 'try', e, line: t.line }; continue; }
        if (isOp('(')) { next(); e = { k: 'call', fn: e, args: parseArgs(')'), line: t.line }; continue; }
        if (isOp('[')) { next(); const idx = parseExpr(); expectOp(']'); e = { k: 'index', e, idx, line: t.line }; continue; }
        if (isOp('.')) {
          next();
          const nt = peek();
          if (nt.k === 'int') { next(); e = { k: 'field', e, name: String(nt.v), line: nt.line }; continue; }
          if (nt.k === 'float') { next(); const parts = String(nt.v).split('.'); e = { k: 'field', e: { k: 'field', e, name: parts[0], line: nt.line }, name: parts[1], line: nt.line }; continue; }
          if (nt.k === 'kw' && nt.v === 'await') fail('async is not supported', nt);
          const name = expectId('field or method name');
          let turbofish = null;
          if (isOp('::')) { next(); expectOp('<'); turbofish = parseType(); expectOp('>'); }
          if (isOp('(')) { next(); e = { k: 'method', e, name, args: parseArgs(')'), turbofish, line: nt.line }; continue; }
          e = { k: 'field', e, name, line: nt.line };
          continue;
        }
        break;
      }
      return e;
    }
    function parsePathExpr() {
      const t = peek();
      const segs = [next().v];
      let generic = null;
      while (isOp('::')) {
        next();
        if (isOp('<')) { next(); generic = parseType(); while (isOp(',')) { next(); parseType(); } expectOp('>'); continue; }
        segs.push(expectId());
      }
      return { k: 'path', segs, generic, line: t.line };
    }
    function parsePrimary(opts) {
      const t = peek();
      const line = t.line;
      switch (t.k) {
        case 'int': next(); return { k: 'lit', v: { t: 'int', v: t.v, ty: t.suffix || null }, line };
        case 'float': next(); return { k: 'lit', v: { t: 'float', v: t.v, ty: t.suffix || null }, line };
        case 'str': next(); return { k: 'lit', v: { t: 'str', v: t.v }, line };
        case 'char': next(); return { k: 'lit', v: { t: 'char', v: t.v }, line };
        case 'macro': return parseMacro();
        case 'lifetime': {
          // ετικέτα βρόχου: 'outer: loop { … }
          next();
          expectOp(':');
          const loop = parsePrimary(opts);
          if (!['loop', 'while', 'for', 'whilelet'].includes(loop.k)) fail('labels can only be used on loops', t);
          loop.label = t.v;
          return loop;
        }
        case 'kw':
          switch (t.v) {
            case 'true': case 'false': next(); return { k: 'lit', v: { t: 'bool', v: t.v === 'true' }, line };
            case 'if': return parseIf();
            case 'loop': next(); return { k: 'loop', body: parseBlock(), line };
            case 'while': {
              next();
              if (isKw('let')) {
                next();
                const pat = parsePattern();
                expectOp('=');
                const e = parseExpr({ noStruct: true });
                return { k: 'whilelet', pat, e, body: parseBlock(), line };
              }
              const cond = parseExpr({ noStruct: true });
              return { k: 'while', cond, body: parseBlock(), line };
            }
            case 'for': {
              next();
              const pat = parsePattern();
              if (!isKw('in')) fail(`expected \`in\`, found ${describe(peek())}`, peek(), 'Γράφεται: for i in 0..10 { … }');
              next();
              const iter = parseExpr({ noStruct: true });
              return { k: 'for', pat, iter, body: parseBlock(), line };
            }
            case 'match': return parseMatch();
            case 'return': next(); return { k: 'return', e: startsExpr() && !isOp('}') && !isOp(';') ? parseExpr() : null, line };
            case 'break': {
              next();
              const label = peek().k === 'lifetime' ? next().v : null;
              return { k: 'break', label, e: startsExpr() && !isOp('}') && !isOp(';') && !isOp(',') ? parseExpr() : null, line };
            }
            case 'continue': { next(); const label = peek().k === 'lifetime' ? next().v : null; return { k: 'continue', label, line }; }
            case 'unsafe': next(); fail('`unsafe` is not needed (and not supported) in these exercises', t, 'Όλος ο κώδικας εδώ είναι ασφαλής Rust. Δεν χρειάζεται unsafe.');
            // falls through
            case 'self': case 'Self': case 'crate': case 'super': return parseMaybeStruct(parsePathExpr(), opts);
            case 'move': fail('closures are not supported in this version', t, 'Οι closures (|x| …) δεν υποστηρίζονται σε αυτή την εκπαιδευτική έκδοση. Γράψε μια κανονική fn.');
          }
          return fail(`expected expression, found keyword \`${t.v}\``, t);
        case 'id': return parseMaybeStruct(parsePathExpr(), opts);
        case 'op':
          if (t.v === '(') {
            next();
            if (isOp(')')) { next(); return { k: 'lit', v: { t: 'unit' }, line }; }
            const first = parseExpr();
            if (isOp(')')) { next(); return { k: 'paren', e: first, line }; }
            const items = [first];
            while (isOp(',')) { next(); if (isOp(')')) break; items.push(parseExpr()); }
            expectOp(')');
            return { k: 'tuple', items, line };
          }
          if (t.v === '[') {
            next();
            if (isOp(']')) { next(); return { k: 'array', items: [], line }; }
            const first = parseExpr();
            if (isOp(';')) { next(); const len = parseExpr(); expectOp(']'); return { k: 'arrayRepeat', e: first, len, line }; }
            const items = [first];
            while (isOp(',')) { next(); if (isOp(']')) break; items.push(parseExpr()); }
            expectOp(']');
            return { k: 'array', items, line };
          }
          if (t.v === '{') return parseBlock();
          if (t.v === '|' || t.v === '||') fail('closures are not supported in this version', t, 'Οι closures (|x| …) δεν υποστηρίζονται σε αυτή την εκπαιδευτική έκδοση. Γράψε μια κανονική fn ή έναν βρόχο for.');
          break;
      }
      return fail(`expected expression, found ${describe(t)}`, t);
    }
    function parseMaybeStruct(path, opts) {
      if (!opts.noStruct && isOp('{') && /^[A-Z]/.test(path.segs[path.segs.length - 1]) && (peek(1).k === 'id' && (isOp(':', 2) || isOp(',', 2) || isOp('}', 2)) || isOp('}', 1))) {
        next();
        const fields = [];
        while (!isOp('}')) {
          const fl = peek().line;
          const name = expectId('field name');
          let value = { k: 'path', segs: [name], line: fl };
          if (isOp(':')) { next(); value = parseExpr(); }
          fields.push({ name, value, line: fl });
          if (!isOp('}')) expectOp(',');
        }
        next();
        return { k: 'structlit', segs: path.segs, fields, line: path.line };
      }
      return path;
    }
    function parseIf() {
      const line = next().line;
      if (isKw('let')) {
        next();
        const pat = parsePattern();
        expectOp('=');
        const e = parseExpr({ noStruct: true });
        const then = parseBlock();
        let els = null;
        if (isKw('else')) { next(); els = isKw('if') ? parseIf() : parseBlock(); }
        return { k: 'iflet', pat, e, then, els, line };
      }
      const c0 = p;
      const cond = parseExpr({ noStruct: true });
      cond.src = textFrom(c0, p);
      if (!isOp('{')) fail(`expected \`{\`, found ${describe(peek())}`, peek(), 'Μετά τη συνθήκη του if ανοίγει μπλοκ με {. Στη Rust η συνθήκη δεν χρειάζεται παρενθέσεις.');
      const then = parseBlock();
      let els = null;
      if (isKw('else')) { next(); els = isKw('if') ? parseIf() : parseBlock(); }
      return { k: 'if', cond, then, els, line };
    }
    function parseMatch() {
      const line = next().line;
      const e = parseExpr({ noStruct: true });
      expectOp('{');
      const arms = [];
      while (!isOp('}')) {
        const al = peek().line;
        const pat = parsePattern();
        let guard = null;
        if (isKw('if')) { next(); guard = parseExpr(); }
        expectOp('=>', 'Σε κάθε σκέλος του match: μοτίβο => τι κάνεις,');
        const body = parseExpr();
        arms.push({ pat, guard, body, line: al });
        if (isOp(',')) next();
        else if (!isOp('}') && !BLOCKLIKE.has(body.k)) expectOp(',', 'Τα σκέλη του match χωρίζονται με κόμμα.');
      }
      const close = next();
      return { k: 'match', e, arms, line, endLine: close.line };
    }
    function parseMacro() {
      const t = next();
      const name = t.v;
      const open = next();
      const close = open.v === '(' ? ')' : open.v === '[' ? ']' : '}';
      if (name === 'vec') {
        if (isOp(close)) { next(); return { k: 'macro', name, args: [], line: t.line }; }
        const first = parseExpr();
        if (isOp(';')) { next(); const len = parseExpr(); expectOp(close); return { k: 'macro', name, repeat: true, args: [first, len], line: t.line }; }
        const args = [first];
        while (isOp(',')) { next(); if (isOp(close)) break; args.push(parseExpr()); }
        expectOp(close);
        return { k: 'macro', name, args, line: t.line };
      }
      return { k: 'macro', name, args: parseArgs(close), line: t.line };
    }

    const items = [];
    while (peek().k !== 'eof') {
      const it = parseItem();
      if (it) items.push(it);
    }
    return { items };
  }

  root.IoTRustParse = { tokenize, parse, err };
})(typeof window !== 'undefined' ? window : globalThis);
