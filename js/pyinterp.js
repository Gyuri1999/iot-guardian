/*
 * IoT Guardian — εκπαιδευτικός interpreter για υποσύνολο της Python (Raspberry Pi).
 *
 * Όπως και ο interpreter της C++: ο κώδικας του μαθητή ΔΕΝ εκτελείται με eval() ή new Function().
 * tokenizer (με εσοχές) → parser (AST) → εκτέλεση με generator, μία εντολή τη φορά.
 * Ο κώδικας βλέπει μόνο τα modules που ορίζονται εδώ: time, json, random, math, datetime,
 * gpiozero, signal, paho.mqtt.client και config (οι ρυθμίσεις της άσκησης).
 *
 * Τα μηνύματα λάθους έχουν το αγγλικό κείμενο της πραγματικής Python (αυτό θα δει ο μαθητής στο αληθινό Pi)
 * και από κάτω ελληνική εξήγηση.
 */
(function (root) {
  'use strict';

  const { CodeError } = root.IoTInterp;

  // ================================================================== Tokenizer

  const KEYWORDS = new Set(['False', 'None', 'True', 'and', 'as', 'break', 'continue', 'def', 'elif', 'else', 'except', 'finally', 'for', 'from',
    'global', 'if', 'import', 'in', 'is', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
    'with', 'lambda', 'class', 'yield', 'assert', 'del', 'nonlocal', 'async', 'await']);
  const UNSUPPORTED_KW = {
    with: 'Η εντολή with δεν υποστηρίζεται ακόμα σε αυτή την εκπαιδευτική έκδοση.',
    lambda: 'Οι συναρτήσεις lambda δεν υποστηρίζονται. Γράψε μια κανονική συνάρτηση με def.',
    class: 'Οι κλάσεις (class) δεν υποστηρίζονται σε αυτή την εκπαιδευτική έκδοση.',
    yield: 'Τα generators (yield) δεν υποστηρίζονται.',
    assert: 'Το assert δεν υποστηρίζεται. Χρησιμοποίησε if.',
    del: 'Το del δεν υποστηρίζεται. Για λίστες χρησιμοποίησε .pop() ή .remove().',
    nonlocal: 'Το nonlocal δεν υποστηρίζεται.',
    async: 'Το async δεν υποστηρίζεται.',
    await: 'Το await δεν υποστηρίζεται.'
  };
  const OPS = ['**=', '//=', '**', '//', '==', '!=', '<=', '>=', '+=', '-=', '*=', '/=', '%=', '->', '&&', '||', '++', '--',
    '+', '-', '*', '/', '%', '<', '>', '=', '(', ')', '[', ']', '{', '}', ',', ':', '.', ';', '!', '&', '|', '^', '~', '@'];
  const ID_START = /[A-Za-z_\u0370-\u03ff\u1f00-\u1fff]/;
  const ID_REST = /^[A-Za-z0-9_\u0370-\u03ff\u1f00-\u1fff]*/;

  function tokenize(src) {
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const toks = [];
    const indents = [0];
    const openers = [];
    let indentChar = null;
    let cont = false;
    const push = (k, v, line, col) => toks.push({ k, v, line, col });
    for (let li = 0; li < lines.length; li++) {
      const n = li + 1;
      const line = lines[li];
      let i = 0;
      if (!openers.length && !cont) {
        const lead = /^[ \t]*/.exec(line)[0];
        const rest = line.slice(lead.length);
        if (!rest || rest.startsWith('#')) continue;
        if (lead.includes('\t') && lead.includes(' ')) {
          throw new CodeError('TabError: inconsistent use of tabs and spaces in indentation', n, 'Η εσοχή αυτής της γραμμής ανακατεύει Tab και κενά. Χρησιμοποίησε μόνο κενά (4 για κάθε επίπεδο).');
        }
        if (lead) {
          const ch = lead[0];
          if (indentChar && ch !== indentChar) throw new CodeError('TabError: inconsistent use of tabs and spaces in indentation', n, 'Κάποιες γραμμές έχουν εσοχή με Tab και άλλες με κενά. Χρησιμοποίησε παντού κενά.');
          indentChar = ch;
        }
        const width = lead.replace(/\t/g, '    ').length;
        const top = indents[indents.length - 1];
        if (width > top) { indents.push(width); push('indent', width, n, 0); }
        else if (width < top) {
          while (width < indents[indents.length - 1]) { indents.pop(); push('dedent', width, n, 0); }
          if (width !== indents[indents.length - 1]) {
            throw new CodeError('IndentationError: unindent does not match any outer indentation level', n, 'Η εσοχή αυτής της γραμμής δεν ταιριάζει με καμία από τις προηγούμενες. Κάθε μπλοκ πρέπει να ξεκινά ακριβώς στην ίδια στήλη (συνήθως 4 κενά ανά επίπεδο).');
          }
        }
        i = lead.length;
      }
      cont = false;
      let had = false;
      while (i < line.length) {
        const c = line[i];
        const rest = line.slice(i);
        if (c === ' ' || c === '\t') { i++; continue; }
        if (c === '#') break;
        if (c === '\\' && rest.trim() === '\\') { cont = true; i = line.length; break; }
        let m;
        if ((m = /^([fFrRbB]{0,2})("""|'''|"|')/.exec(rest))) {
          const prefix = m[1].toLowerCase();
          const q = m[2];
          if (q.length === 3) throw new CodeError('Τα κείμενα με τριπλά εισαγωγικά δεν υποστηρίζονται.', n, 'Για σχόλια γράψε # στην αρχή της γραμμής. Για κείμενο χρησιμοποίησε "…" σε μία γραμμή.');
          let j = i + m[0].length;
          let val = '';
          let raw = '';
          for (;;) {
            if (j >= line.length) throw new CodeError('SyntaxError: unterminated string literal', n, `Το κείμενο που ξεκινά με ${q} δεν κλείνει σε αυτή τη γραμμή. Πρόσθεσε ${q} στο τέλος του.`);
            const ch = line[j];
            if (ch === q) { j++; break; }
            if (ch === '\\' && prefix.indexOf('r') < 0) {
              const nx = line[j + 1];
              const map = { n: '\n', t: '\t', '\\': '\\', "'": "'", '"': '"', r: '\r', '0': '\0' };
              if (nx === 'u' && /^[0-9a-fA-F]{4}$/.test(line.slice(j + 2, j + 6))) { val += String.fromCharCode(parseInt(line.slice(j + 2, j + 6), 16)); raw += line.slice(j, j + 6); j += 6; continue; }
              if (nx in map) { val += map[nx]; raw += ch + nx; j += 2; continue; }
              val += ch; raw += ch; j++; continue;
            }
            val += ch; raw += ch; j++;
          }
          const isF = prefix.indexOf('f') >= 0;
          const isB = prefix.indexOf('b') >= 0;
          push(isF ? 'fstr' : isB ? 'bytes' : 'str', isF ? raw : val, n, i);
          i = j; had = true; continue;
        }
        if ((m = /^(\d[\d_]*\.?[\d_]*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)/.exec(rest))) {
          const txt = m[0].replace(/_/g, '');
          push('num', { v: Number(txt), float: /[.eE]/.test(txt) }, n, i);
          i += m[0].length; had = true; continue;
        }
        if (ID_START.test(c)) {
          const w = c + ID_REST.exec(rest.slice(1))[0];
          if (/^_{2,}$/.test(w)) push('blank', w, n, i);
          else push(KEYWORDS.has(w) ? 'kw' : 'name', w, n, i);
          i += w.length; had = true; continue;
        }
        const op = OPS.find(o => rest.startsWith(o));
        if (!op) throw new CodeError(`SyntaxError: invalid character '${c}'`, n, `Ο χαρακτήρας «${c}» δεν έχει νόημα εδώ. Μήπως αντιγράφηκε από κείμενο με «έξυπνα» εισαγωγικά; Χρησιμοποίησε " ή '.`);
        const BAD = {
          '&&': 'Στην Python το «και» γράφεται and, όχι && όπως στη C++.',
          '||': 'Στην Python το «ή» γράφεται or, όχι || όπως στη C++.',
          '++': 'Η Python δεν έχει τον τελεστή ++. Γράψε x += 1.',
          '--': 'Η Python δεν έχει τον τελεστή --. Γράψε x -= 1.',
          '!': 'Στην Python το «όχι» γράφεται not, π.χ. if not ok:. Το != (διάφορο) υπάρχει κανονικά.'
        };
        if (BAD[op]) {
          // Το σφάλμα αναφέρεται όταν ο parser φτάσει σε αυτό το σημείο, ώστε τα λάθη να βγαίνουν με τη σειρά του κώδικα.
          push('bad', new CodeError(`SyntaxError: invalid syntax ('${op}')`, n, BAD[op]), n, i);
          i += op.length; had = true; continue;
        }
        if ('([{'.includes(op)) openers.push({ op, line: n });
        if (')]}'.includes(op)) {
          const o = openers.pop();
          const want = { ')': '(', ']': '[', '}': '{' }[op];
          if (!o) throw new CodeError(`SyntaxError: unmatched '${op}'`, n, `Περισσεύει ένα «${op}»: δεν υπάρχει αντίστοιχο «${want}» πριν από αυτό.`);
          if (o.op !== want) throw new CodeError(`SyntaxError: closing parenthesis '${op}' does not match opening parenthesis '${o.op}'`, n, `Το «${o.op}» της γραμμής ${o.line} κλείνει με λάθος σύμβολο.`);
        }
        push('op', op, n, i);
        i += op.length; had = true;
      }
      if (had && !openers.length && !cont) push('nl', null, n, line.length);
    }
    if (openers.length) {
      const o = openers[openers.length - 1];
      const blockBrace = o.op === '{' && /\{\s*(#.*)?$/.test(lines[o.line - 1]);
      throw new CodeError(`SyntaxError: '${o.op}' was never closed`, o.line, blockBrace
        ? 'Στην Python τα μπλοκ δεν ανοίγουν με { όπως στη C++. Σβήσε το { (και το } που κλείνει), βάλε : στο τέλος της γραμμής και γράψε το περιεχόμενο με εσοχή 4 κενών.'
        : `Το «${o.op}» αυτής της γραμμής δεν κλείνει ποτέ. Πρόσθεσε «${{ '(': ')', '[': ']', '{': '}' }[o.op]}».`);
    }
    const last = lines.length;
    while (indents.length > 1) { indents.pop(); push('dedent', 0, last, 0); }
    push('eof', null, last, 0);
    return toks;
  }

  // ================================================================== Parser

  const BLOCK_KW = new Set(['if', 'elif', 'else', 'while', 'for', 'def', 'try', 'except', 'finally']);

  function parse(tokens) {
    let p = 0;
    const peek = (o = 0) => tokens[p + o];
    const next = () => { if (tokens[p].k === 'bad') throw tokens[p].v; return tokens[p++]; };
    const isOp = (v, o = 0) => peek(o).k === 'op' && peek(o).v === v;
    const isKw = (v, o = 0) => peek(o).k === 'kw' && peek(o).v === v;
    const fail = (msg, t, hint) => {
      if (peek().k === 'bad') throw peek().v;
      throw new CodeError(msg, (t || peek()).line, hint);
    };
    const desc = t => (t.k === 'nl' ? 'το τέλος της γραμμής' : t.k === 'eof' ? 'το τέλος του κώδικα' : t.k === 'indent' ? 'εσοχή' : t.k === 'dedent' ? 'λιγότερη εσοχή' : `«${t.k === 'num' ? t.v.v : t.k === 'str' ? '"' + t.v + '"' : t.v}»`);
    function expectOp(v, hint) {
      if (isOp(v)) return next();
      const t = peek();
      if (v === ':' && t.k === 'op' && t.v === '{') fail("SyntaxError: expected ':'", t, 'Στην Python τα μπλοκ δεν γράφονται με { }. Βάλε : στο τέλος της γραμμής και γράψε το περιεχόμενο από κάτω με εσοχή 4 κενών.');
      if (v === ':') fail("SyntaxError: expected ':'", t, hint || 'Λείπει η άνω-κάτω τελεία «:» στο τέλος αυτής της γραμμής. Στην Python κάθε if, elif, else, while, for, def και try τελειώνει με «:».');
      fail(`SyntaxError: expected '${v}'`, t, hint || `Περίμενα «${v}» αλλά βρήκα ${desc(t)}.`);
    }
    function expectName(what) {
      const t = peek();
      if (t.k === 'name') return next().v;
      if (t.k === 'blank') fail('Συμπλήρωσε το κενό ____.', t, 'Αντικατέστησε το ____ με τον κώδικα που λείπει.');
      if (t.k === 'kw') fail(`SyntaxError: invalid syntax`, t, `Το «${t.v}» είναι δεσμευμένη λέξη της Python και δεν μπορεί να είναι ${what}.`);
      return fail('SyntaxError: invalid syntax', t, `Περίμενα ${what} αλλά βρήκα ${desc(t)}.`);
    }
    function endStmt() {
      if (isOp(';')) { next(); if (peek().k === 'nl') { next(); return; } return 'more'; }
      const t = peek();
      if (t.k === 'nl') { next(); return; }
      if (t.k === 'eof' || t.k === 'dedent') return;
      if (t.k === 'op' && t.v === '{') fail('SyntaxError: invalid syntax', t, 'Στην Python τα μπλοκ γράφονται με : και εσοχή, όχι με { }.');
      if (t.k === 'op' && t.v === '=') fail('SyntaxError: invalid syntax', t, 'Μήπως ήθελες σύγκριση; Η σύγκριση γράφεται ==, ενώ το = δίνει τιμή.');
      fail('SyntaxError: invalid syntax', t, `Δεν περίμενα ${desc(t)} εδώ. Μήπως λείπει κόμμα, παρένθεση ή εισαγωγικό;`);
    }

    function block(owner) {
      expectOp(':');
      if (peek().k !== 'nl') {
        const body = simpleStmts();
        return body;
      }
      next();
      if (peek().k !== 'indent') {
        fail('IndentationError: expected an indented block', peek(), `Μετά το «${owner}…:» οι εντολές του μπλοκ γράφονται στις επόμενες γραμμές με εσοχή (4 κενά πιο μέσα). Αν δεν θέλεις να κάνει τίποτα ακόμα, γράψε pass.`);
      }
      next();
      const body = [];
      while (peek().k !== 'dedent' && peek().k !== 'eof') body.push(...statement());
      if (peek().k === 'dedent') next();
      return body;
    }

    function statement() {
      const t = peek();
      if (t.k === 'indent') fail('IndentationError: unexpected indent', t, 'Αυτή η γραμμή έχει εσοχή χωρίς λόγο. Εσοχή μπαίνει μόνο μέσα σε μπλοκ (μετά από γραμμή που τελειώνει με :).');
      if (t.k === 'op' && t.v === '//') fail('SyntaxError: invalid syntax', t, 'Τα σχόλια στην Python ξεκινούν με #, όχι με // όπως στη C++.');
      if (t.k === 'op' && t.v === '@') {
        // decorators: @app.route("/") πάνω από def
        const decorators = [];
        while (isOp('@')) {
          next();
          decorators.push(test());
          if (peek().k !== 'nl') fail('SyntaxError: invalid syntax', peek(), 'Ο decorator (@…) γράφεται μόνος του σε μία γραμμή, πάνω από το def.');
          next();
        }
        if (!isKw('def')) fail('SyntaxError: invalid syntax', peek(), 'Μετά από έναν decorator (@…) πρέπει να ακολουθεί def.');
        const d = defStmt();
        d.decorators = decorators;
        return [d];
      }
      if (t.k === 'kw') {
        if (UNSUPPORTED_KW[t.v]) fail(UNSUPPORTED_KW[t.v], t);
        switch (t.v) {
          case 'if': return [ifStmt()];
          case 'while': {
            next();
            const cond = test();
            return [{ k: 'while', cond, body: block('while'), line: t.line }];
          }
          case 'for': {
            next();
            const targets = [expectName('μεταβλητή')];
            while (isOp(',')) { next(); targets.push(expectName('μεταβλητή')); }
            if (!isKw('in')) fail("SyntaxError: expected 'in'", peek(), 'Το for γράφεται: for x in λίστα:');
            next();
            const iter = testList();
            return [{ k: 'for', targets, iter, body: block('for'), line: t.line }];
          }
          case 'def': return [defStmt()];
          case 'try': return [tryStmt()];
          case 'elif': case 'else': fail('SyntaxError: invalid syntax', t, `Το «${t.v}» πρέπει να βρίσκεται αμέσως μετά από ένα if (ή elif), στην ίδια στήλη με αυτό.`);
          // falls through
          case 'except': case 'finally': fail('SyntaxError: invalid syntax', t, `Το «${t.v}» πρέπει να ακολουθεί ένα try:, στην ίδια στήλη.`);
        }
      }
      const list = simpleStmts();
      return list;
    }

    function simpleStmts() {
      const out = [];
      for (;;) {
        out.push(smallStmt());
        if (endStmt() !== 'more') break;
      }
      return out;
    }

    function smallStmt() {
      const t = peek();
      if (t.k === 'kw') {
        switch (t.v) {
          case 'pass': next(); return { k: 'pass', line: t.line };
          case 'break': next(); return { k: 'break', line: t.line };
          case 'continue': next(); return { k: 'continue', line: t.line };
          case 'return': {
            next();
            const value = (peek().k === 'nl' || peek().k === 'eof' || isOp(';')) ? null : testList();
            return { k: 'return', value, line: t.line };
          }
          case 'global': {
            next();
            const names = [expectName('όνομα μεταβλητής')];
            while (isOp(',')) { next(); names.push(expectName('όνομα μεταβλητής')); }
            return { k: 'global', names, line: t.line };
          }
          case 'import': {
            next();
            const items = [];
            do {
              if (items.length) next();
              const path = [expectName('όνομα module')];
              while (isOp('.')) { next(); path.push(expectName('όνομα module')); }
              let alias = null;
              if (isKw('as')) { next(); alias = expectName('όνομα'); }
              items.push({ path: path.join('.'), alias });
            } while (isOp(','));
            return { k: 'import', items, line: t.line };
          }
          case 'from': {
            next();
            const path = [expectName('όνομα module')];
            while (isOp('.')) { next(); path.push(expectName('όνομα module')); }
            if (!isKw('import')) fail("SyntaxError: invalid syntax", peek(), 'Γράφεται: from module import όνομα');
            next();
            if (isOp('*')) fail('Το «import *» δεν υποστηρίζεται.', peek(), 'Γράψε ονομαστικά ό,τι χρειάζεσαι, π.χ. from gpiozero import LED, Button.');
            const paren = isOp('(');
            if (paren) next();
            const names = [];
            do {
              if (names.length) next();
              if (paren && isOp(')')) break;
              const name = expectName('όνομα');
              let alias = null;
              if (isKw('as')) { next(); alias = expectName('όνομα'); }
              names.push({ name, alias });
            } while (isOp(','));
            if (paren) expectOp(')');
            return { k: 'from', module: path.join('.'), names, line: t.line };
          }
          case 'raise': {
            next();
            const value = (peek().k === 'nl' || peek().k === 'eof') ? null : test();
            return { k: 'raise', value, line: t.line };
          }
        }
      }
      const e = testList();
      if (isOp('=')) {
        const targets = [e];
        let value;
        for (;;) {
          next();
          value = testList();
          if (!isOp('=')) break;
          targets.push(value);
        }
        targets.forEach(tg => checkTarget(tg, t));
        return { k: 'assign', targets, value, line: t.line };
      }
      const aug = ['+=', '-=', '*=', '/=', '//=', '%=', '**='].find(o => isOp(o));
      if (aug) {
        next();
        checkTarget(e, t);
        if (e.k === 'tuple') fail('SyntaxError: illegal expression for augmented assignment', t);
        return { k: 'aug', target: e, op: aug.slice(0, -1), value: test(), line: t.line };
      }
      if (e.k === 'cmp' && e.ops.length === 1 && e.ops[0] === '==' && peek().k === 'nl' && e.left.k === 'name') {
        // x == 5 μόνο του σε γραμμή: σχεδόν πάντα ήθελε να γράψει x = 5
        return { k: 'expr', expr: e, line: t.line, suspicious: 'Η γραμμή συγκρίνει με == αλλά δεν κάνει τίποτα με το αποτέλεσμα. Για να δώσεις τιμή γράψε ='.replace('==', '==') };
      }
      return { k: 'expr', expr: e, line: t.line };
    }

    function checkTarget(e, t) {
      if (e.k === 'name' || e.k === 'index' || e.k === 'attr') return;
      if (e.k === 'tuple' && e.items.every(x => x.k === 'name' || x.k === 'index' || x.k === 'attr')) return;
      if (e.k === 'call') fail("SyntaxError: cannot assign to function call", t, 'Αριστερά από το = μπαίνει όνομα μεταβλητής. Μήπως ήθελες σύγκριση ==;');
      if (e.k === 'cmp') fail("SyntaxError: cannot assign to comparison", t);
      fail('SyntaxError: cannot assign to expression', t, 'Αριστερά από το = μπαίνει όνομα μεταβλητής.');
    }

    function ifStmt() {
      const t = next();
      const tests = [{ cond: test(), line: t.line }];
      tests[0].body = block('if');
      let orelse = null;
      let elseLine = null;
      for (;;) {
        if (isKw('elif')) {
          const e = next();
          const c = { cond: test(), line: e.line };
          c.body = block('elif');
          tests.push(c);
          continue;
        }
        if (isKw('else')) {
          const e = next();
          if (isKw('if')) fail('SyntaxError: expected \':\'', peek(), 'Στην Python το «else if» γράφεται elif.');
          elseLine = e.line;
          orelse = block('else');
        }
        break;
      }
      return { k: 'if', tests, orelse, elseLine, line: t.line };
    }

    function defStmt() {
      const t = next();
      const name = expectName('όνομα συνάρτησης');
      expectOp('(', 'Μετά το όνομα της συνάρτησης μπαίνουν παρενθέσεις: def όνομα():');
      const params = [];
      while (!isOp(')')) {
        if (params.length) expectOp(',');
        if (isOp(')')) break;
        if (isOp('*')) fail('Τα *args και **kwargs δεν υποστηρίζονται.', peek());
        const pn = expectName('όνομα παραμέτρου');
        let def = null;
        if (isOp('=')) { next(); def = test(); }
        else if (params.some(x => x.def)) fail('SyntaxError: non-default argument follows default argument', peek(), 'Οι παράμετροι με προεπιλεγμένη τιμή μπαίνουν στο τέλος.');
        params.push({ name: pn, def });
      }
      next();
      if (isOp('->')) { next(); test(); }
      const body = block('def');
      const assigned = new Set();
      const globalsDecl = new Set();
      collectAssigned(body, assigned, globalsDecl);
      params.forEach(x => assigned.add(x.name));
      return { k: 'def', name, params, body, assigned, globalsDecl, line: t.line };
    }

    function tryStmt() {
      const t = next();
      const body = block('try');
      const handlers = [];
      let orelse = null;
      let finalbody = null;
      while (isKw('except')) {
        const e = next();
        let type = null;
        let name = null;
        if (!isOp(':')) {
          type = test();
          if (isKw('as')) { next(); name = expectName('όνομα'); }
        }
        handlers.push({ type, name, body: block('except'), line: e.line });
      }
      if (isKw('else') && handlers.length) { next(); orelse = block('else'); }
      if (isKw('finally')) { next(); finalbody = block('finally'); }
      if (!handlers.length && !finalbody) fail("SyntaxError: expected 'except' or 'finally' block", peek(), 'Μετά το try: χρειάζεται τουλάχιστον ένα except …: στην ίδια στήλη.');
      return { k: 'try', body, handlers, orelse, finalbody, line: t.line };
    }

    // ---------------------------------------------------------- εκφράσεις

    function testList() {
      const first = test();
      if (!isOp(',')) return first;
      const items = [first];
      while (isOp(',')) {
        next();
        if (peek().k === 'nl' || isOp('=') || isOp(')') || peek().k === 'eof') break;
        items.push(test());
      }
      return { k: 'tuple', items, line: first.line };
    }

    function test() {
      const a = orTest();
      if (isKw('if') && peek(1).k !== 'nl') {
        const t = next();
        const cond = orTest();
        if (!isKw('else')) fail("SyntaxError: expected 'else' after 'if' expression", peek(), 'Η μορφή είναι: τιμή_αν_ναι if συνθήκη else τιμή_αν_όχι');
        next();
        return { k: 'ifexp', cond, a, b: test(), line: t.line };
      }
      return a;
    }
    function orTest() {
      let a = andTest();
      while (isKw('or')) { const t = next(); a = { k: 'bool', op: 'or', a, b: andTest(), line: t.line }; }
      return a;
    }
    function andTest() {
      let a = notTest();
      while (isKw('and')) { const t = next(); a = { k: 'bool', op: 'and', a, b: notTest(), line: t.line }; }
      return a;
    }
    function notTest() {
      if (isKw('not')) { const t = next(); return { k: 'not', a: notTest(), line: t.line }; }
      return comparison();
    }
    function comparison() {
      const left = arith();
      const ops = [];
      const rights = [];
      for (;;) {
        let op = null;
        if (peek().k === 'op' && ['<', '>', '==', '>=', '<=', '!='].includes(peek().v)) op = next().v;
        else if (isKw('in')) { next(); op = 'in'; }
        else if (isKw('not') && isKw('in', 1)) { next(); next(); op = 'not in'; }
        else if (isKw('is')) { next(); if (isKw('not')) { next(); op = 'is not'; } else op = 'is'; }
        if (!op) break;
        ops.push(op);
        rights.push(arith());
      }
      if (isOp('=') && peek(1) && !(peek(1).k === 'op' && peek(1).v === '=')) {
        // if x = 5: — συνηθισμένο λάθος
        const t = peek();
        let q = p;
        let inHeader = false;
        for (let j = p; j < tokens.length && tokens[j].k !== 'nl'; j++) if (tokens[j].k === 'op' && tokens[j].v === ':') inHeader = true;
        p = q;
        if (inHeader && tokens.slice(0, p).reverse().find(x => x.k === 'kw' && (x.v === 'if' || x.v === 'while' || x.v === 'elif') && x.line === t.line)) {
          fail('SyntaxError: invalid syntax. Maybe you meant \'==\' or \':=\' instead of \'=\'?', t, 'Στη σύγκριση γράφεις == (δύο ίσον). Το ένα = δίνει τιμή σε μεταβλητή.');
        }
      }
      if (!ops.length) return left;
      return { k: 'cmp', left, ops, rights, line: left.line };
    }
    function arith() {
      let a = term();
      while (isOp('+') || isOp('-')) { const t = next(); a = { k: 'bin', op: t.v, a, b: term(), line: t.line }; }
      return a;
    }
    function term() {
      let a = factor();
      while (isOp('*') || isOp('/') || isOp('//') || isOp('%')) { const t = next(); a = { k: 'bin', op: t.v, a, b: factor(), line: t.line }; }
      return a;
    }
    function factor() {
      if (isOp('-') || isOp('+')) { const t = next(); return { k: 'un', op: t.v, a: factor(), line: t.line }; }
      return power();
    }
    function power() {
      const a = postfix();
      if (isOp('**')) { const t = next(); return { k: 'bin', op: '**', a, b: factor(), line: t.line }; }
      return a;
    }
    function postfix() {
      let e = atom();
      for (;;) {
        if (isOp('(')) {
          const t = next();
          const args = [];
          while (!isOp(')')) {
            if (args.length) { expectOp(',', 'Τα ορίσματα χωρίζονται με κόμμα.'); if (isOp(')')) break; }
            if (isOp('*')) fail('Το *args δεν υποστηρίζεται.', peek());
            if (peek().k === 'name' && isOp('=', 1)) {
              const name = next().v; next();
              args.push({ name, value: test() });
            } else {
              if (args.some(a => a.name)) fail('SyntaxError: positional argument follows keyword argument', peek(), 'Τα ονομαστικά ορίσματα (όνομα=τιμή) μπαίνουν μετά τα απλά.');
              args.push({ value: test() });
            }
          }
          next();
          e = { k: 'call', fn: e, args, line: t.line };
          continue;
        }
        if (isOp('[')) {
          const t = next();
          let lo = null;
          let hi = null;
          if (!isOp(':')) lo = test();
          if (isOp(':')) {
            next();
            if (!isOp(']')) hi = test();
            expectOp(']');
            e = { k: 'slice', obj: e, lo, hi, line: t.line };
            continue;
          }
          expectOp(']');
          e = { k: 'index', obj: e, index: lo, line: t.line };
          continue;
        }
        if (isOp('.')) {
          const t = next();
          const name = expectName('όνομα ιδιότητας ή μεθόδου');
          e = { k: 'attr', obj: e, name, line: t.line };
          continue;
        }
        return e;
      }
    }
    function atom() {
      const t = peek();
      switch (t.k) {
        case 'num': next(); return { k: 'num', v: t.v.v, float: t.v.float, line: t.line };
        case 'str': {
          next();
          let v = t.v;
          while (peek().k === 'str') v += next().v;
          return { k: 'str', v, line: t.line };
        }
        case 'bytes': next(); return { k: 'bytes', v: t.v, line: t.line };
        case 'fstr': next(); return fstring(t);
        case 'blank': fail('Συμπλήρωσε το κενό ____.', t, 'Αντικατέστησε το ____ με τον κώδικα που λείπει.');
        // falls through
        case 'name':
          next();
          return { k: 'name', name: t.v, line: t.line };
        case 'kw':
          if (t.v === 'True' || t.v === 'False') { next(); return { k: 'const', v: B(t.v === 'True'), line: t.line }; }
          if (t.v === 'None') { next(); return { k: 'const', v: NONE, line: t.line }; }
          if (UNSUPPORTED_KW[t.v]) fail(UNSUPPORTED_KW[t.v], t);
          return fail('SyntaxError: invalid syntax', t, `Η λέξη «${t.v}» δεν μπορεί να μπει σε αυτό το σημείο.`);
        case 'op':
          if (t.v === '(') {
            next();
            if (isOp(')')) { next(); return { k: 'tuple', items: [], line: t.line }; }
            const first = test();
            if (isOp(',')) {
              const items = [first];
              while (isOp(',')) { next(); if (isOp(')')) break; items.push(test()); }
              expectOp(')');
              return { k: 'tuple', items, line: t.line };
            }
            expectOp(')');
            return first;
          }
          if (t.v === '[') {
            next();
            if (isOp(']')) { next(); return { k: 'list', items: [], line: t.line }; }
            const first = test();
            if (isKw('for')) {
              next();
              const targets = [expectName('μεταβλητή')];
              while (isOp(',')) { next(); targets.push(expectName('μεταβλητή')); }
              if (!isKw('in')) fail("SyntaxError: expected 'in'", peek());
              next();
              const iter = orTest();
              let cond = null;
              if (isKw('if')) { next(); cond = orTest(); }
              expectOp(']');
              return { k: 'listcomp', elt: first, targets, iter, cond, line: t.line };
            }
            const items = [first];
            while (isOp(',')) { next(); if (isOp(']')) break; items.push(test()); }
            expectOp(']', 'Η λίστα κλείνει με ]. Τα στοιχεία χωρίζονται με κόμμα.');
            return { k: 'list', items, line: t.line };
          }
          if (t.v === '{') {
            next();
            const pairs = [];
            while (!isOp('}')) {
              if (pairs.length) { expectOp(',', 'Τα ζεύγη του λεξικού χωρίζονται με κόμμα.'); if (isOp('}')) break; }
              const k = test();
              expectOp(':', 'Σε λεξικό κάθε ζεύγος γράφεται κλειδί: τιμή.');
              pairs.push([k, test()]);
            }
            next();
            return { k: 'dict', pairs, line: t.line };
          }
          break;
      }
      if (t.k === 'nl' || t.k === 'eof') fail('SyntaxError: invalid syntax', t, 'Η γραμμή τελειώνει ενώ λείπει κάτι. Μήπως ξέχασες τιμή μετά από τελεστή ή =;');
      return fail('SyntaxError: invalid syntax', t, `Δεν περίμενα ${desc(t)} εδώ.`);
    }

    // f"Θερμοκρασία: {t:.1f} °C"
    function fstring(t) {
      const raw = t.v;
      const parts = [];
      let lit = '';
      for (let i = 0; i < raw.length; i++) {
        const c = raw[i];
        if (c === '{' && raw[i + 1] === '{') { lit += '{'; i++; continue; }
        if (c === '}' && raw[i + 1] === '}') { lit += '}'; i++; continue; }
        if (c === '}') fail("SyntaxError: f-string: single '}' is not allowed", t, 'Στο f-string το } χωρίς { πριν γράφεται }}.');
        if (c !== '{') {
          if (c === '\\') {
            const map = { n: '\n', t: '\t', '\\': '\\', '"': '"', "'": "'" };
            if (raw[i + 1] in map) { lit += map[raw[i + 1]]; i++; continue; }
          }
          lit += c;
          continue;
        }
        let depth = 1;
        let j = i + 1;
        let inner = '';
        let quote = null;
        for (; j < raw.length; j++) {
          const ch = raw[j];
          if (quote) { if (ch === quote) quote = null; inner += ch; continue; }
          if (ch === '"' || ch === "'") { quote = ch; inner += ch; continue; }
          if (ch === '{' || ch === '[' || ch === '(') depth++;
          if (ch === '}' || ch === ']' || ch === ')') depth--;
          if (depth === 0) break;
          inner += ch;
        }
        if (j >= raw.length) fail("SyntaxError: f-string: expecting '}'", t, 'Ένα { μέσα στο f-string δεν κλείνει με }.');
        let spec = '';
        let exprText = inner;
        let d = 0;
        for (let k = 0; k < inner.length; k++) {
          const ch = inner[k];
          if ('([{'.includes(ch)) d++;
          if (')]}'.includes(ch)) d--;
          if (ch === ':' && d === 0) { exprText = inner.slice(0, k); spec = inner.slice(k + 1); break; }
        }
        if (!exprText.trim()) fail('SyntaxError: f-string: empty expression not allowed', t, 'Μέσα στα { } του f-string γράφεις μια μεταβλητή ή έκφραση, π.χ. {temp}.');
        if (lit) parts.push({ lit });
        lit = '';
        const sub = tokenize(exprText).map(x => Object.assign(x, { line: t.line }));
        const e = parse.expr(sub);
        parts.push({ expr: e, spec, src: exprText.trim() });
        i = j;
      }
      if (lit) parts.push({ lit });
      return { k: 'fstr', parts, line: t.line };
    }

    // ---------------------------------------------------------- πρόγραμμα
    if (tokens.__exprOnly) {
      const e = testList();
      return e;
    }
    const body = [];
    while (peek().k !== 'eof') {
      if (peek().k === 'nl') { next(); continue; }
      if (peek().k === 'dedent') { next(); continue; }
      body.push(...statement());
    }
    return body;
  }
  parse.expr = function (tokens) {
    const t = tokens.filter(x => x.k !== 'nl' && x.k !== 'indent' && x.k !== 'dedent');
    t.__exprOnly = true;
    return parse(t);
  };

  function collectAssigned(list, out, globalsDecl) {
    const addTarget = e => {
      if (!e) return;
      if (e.k === 'name') out.add(e.name);
      if (e.k === 'tuple') e.items.forEach(addTarget);
    };
    for (const s of list) {
      if (s.k === 'assign') s.targets.forEach(addTarget);
      else if (s.k === 'aug') addTarget(s.target);
      else if (s.k === 'for') s.targets.forEach(n => out.add(n));
      else if (s.k === 'global') s.names.forEach(n => globalsDecl.add(n));
      else if (s.k === 'import') s.items.forEach(it => out.add(it.alias || it.path.split('.')[0]));
      else if (s.k === 'from') s.names.forEach(n => out.add(n.alias || n.name));
      else if (s.k === 'def') out.add(s.name);
      if (s.k === 'if') { s.tests.forEach(c => collectAssigned(c.body, out, globalsDecl)); if (s.orelse) collectAssigned(s.orelse, out, globalsDecl); }
      if (s.k === 'while' || s.k === 'for') collectAssigned(s.body, out, globalsDecl);
      if (s.k === 'try') {
        collectAssigned(s.body, out, globalsDecl);
        s.handlers.forEach(h => { if (h.name) out.add(h.name); collectAssigned(h.body, out, globalsDecl); });
        if (s.orelse) collectAssigned(s.orelse, out, globalsDecl);
        if (s.finalbody) collectAssigned(s.finalbody, out, globalsDecl);
      }
    }
  }

  function lastLine(list) {
    let n = 0;
    for (const s of list) {
      n = Math.max(n, s.line);
      if (s.k === 'if') { s.tests.forEach(c => { n = Math.max(n, lastLine(c.body)); }); if (s.orelse) n = Math.max(n, lastLine(s.orelse)); }
      if (s.k === 'while' || s.k === 'for' || s.k === 'def') n = Math.max(n, lastLine(s.body));
      if (s.k === 'try') {
        n = Math.max(n, lastLine(s.body));
        s.handlers.forEach(h => { n = Math.max(n, lastLine(h.body)); });
        if (s.orelse) n = Math.max(n, lastLine(s.orelse));
        if (s.finalbody) n = Math.max(n, lastLine(s.finalbody));
      }
    }
    return n;
  }
  const rangeOf = list => (list && list.length ? { from: list[0].line, to: lastLine(list) } : null);

  function exprToString(e) {
    switch (e.k) {
      case 'num': return e.float && Number.isInteger(e.v) ? e.v.toFixed(1) : String(e.v);
      case 'str': return pyRepr(S(e.v));
      case 'bytes': return 'b' + pyRepr(S(e.v));
      case 'fstr': return 'f"…"';
      case 'const': return pyRepr(e.v);
      case 'name': return e.name;
      case 'un': return e.op + exprToString(e.a);
      case 'not': return 'not ' + exprToString(e.a);
      case 'bin': return `${exprToString(e.a)} ${e.op} ${exprToString(e.b)}`;
      case 'bool': return `${exprToString(e.a)} ${e.op} ${exprToString(e.b)}`;
      case 'cmp': return [exprToString(e.left), ...e.ops.map((o, i) => `${o} ${exprToString(e.rights[i])}`)].join(' ');
      case 'call': return `${exprToString(e.fn)}(${e.args.map(a => (a.name ? a.name + '=' : '') + exprToString(a.value)).join(', ')})`;
      case 'attr': return `${exprToString(e.obj)}.${e.name}`;
      case 'index': return `${exprToString(e.obj)}[${exprToString(e.index)}]`;
      case 'slice': return `${exprToString(e.obj)}[${e.lo ? exprToString(e.lo) : ''}:${e.hi ? exprToString(e.hi) : ''}]`;
      case 'list': return `[${e.items.map(exprToString).join(', ')}]`;
      case 'tuple': return `(${e.items.map(exprToString).join(', ')})`;
      case 'dict': return '{…}';
      case 'ifexp': return `${exprToString(e.a)} if ${exprToString(e.cond)} else ${exprToString(e.b)}`;
      case 'listcomp': return '[…]';
    }
    return '…';
  }

  function namesIn(e, out = new Set()) {
    if (!e || typeof e !== 'object') return out;
    if (e.k === 'name') out.add(e.name);
    if (e.k === 'call') { if (e.fn.k !== 'name') namesIn(e.fn, out); e.args.forEach(a => namesIn(a.value, out)); return out; }
    if (e.k === 'attr') { namesIn(e.obj, out); return out; }
    for (const key of ['a', 'b', 'left', 'obj', 'index', 'cond', 'lo', 'hi']) if (e[key]) namesIn(e[key], out);
    if (e.rights) e.rights.forEach(x => namesIn(x, out));
    if (e.items) e.items.forEach(x => namesIn(x, out));
    return out;
  }

  function compile(source) {
    const tokens = tokenize(source);
    const body = parse(tokens);
    const warnings = [];
    (function walk(list) {
      for (const s of list) {
        if (s.suspicious) warnings.push({ line: s.line, text: s.suspicious, hint: '' });
        if (s.k === 'if') { s.tests.forEach(c => walk(c.body)); if (s.orelse) walk(s.orelse); }
        if (s.k === 'while' || s.k === 'for' || s.k === 'def') walk(s.body);
        if (s.k === 'try') { walk(s.body); s.handlers.forEach(h => walk(h.body)); }
      }
    })(body);
    return { program: { body }, warnings };
  }

  // ================================================================== Τιμές

  const NONE = { t: 'NoneType' };
  const TRUE = { t: 'bool', v: true };
  const FALSE = { t: 'bool', v: false };
  const B = b => (b ? TRUE : FALSE);
  const I = n => ({ t: 'int', v: n });
  const F = n => ({ t: 'float', v: n });
  const S = s => ({ t: 'str', v: String(s) });
  const L = a => ({ t: 'list', v: a });
  const T = a => ({ t: 'tuple', v: a });
  const BY = s => ({ t: 'bytes', v: String(s) });
  const TYPE = name => ({ t: 'type', name });
  const isNum = v => v.t === 'int' || v.t === 'float' || v.t === 'bool';
  const numOf = v => (v.t === 'bool' ? (v.v ? 1 : 0) : v.v);

  class PyExc {
    constructor(cls, msg, hint, line) { this.cls = cls; this.msg = msg; this.hint = hint || ''; this.line = line || null; }
  }
  const raise = (cls, msg, hint, line, code) => { const e = new PyExc(cls, msg, hint, line); if (code) e.code = code; throw e; };

  const EXC_PARENT = {
    BaseException: null, Exception: 'BaseException', ArithmeticError: 'Exception', ZeroDivisionError: 'ArithmeticError',
    LookupError: 'Exception', KeyError: 'LookupError', IndexError: 'LookupError', ValueError: 'Exception', JSONDecodeError: 'ValueError',
    TypeError: 'Exception', NameError: 'Exception', UnboundLocalError: 'NameError', AttributeError: 'Exception',
    OSError: 'Exception', ConnectionError: 'OSError', ConnectionRefusedError: 'ConnectionError', TimeoutError: 'OSError', gaierror: 'OSError',
    RuntimeError: 'Exception', ModuleNotFoundError: 'ImportError', ImportError: 'Exception', KeyboardInterrupt: 'BaseException',
    SSLError: 'OSError', SSLCertVerificationError: 'SSLError', AssertionError: 'Exception'
  };
  // Στην Python το SSLCertVerificationError είναι και ValueError (πολλαπλή κληρονομικότητα).
  const EXTRA_PARENTS = { SSLCertVerificationError: ['ValueError'] };
  const isSubclass = (cls, base) => {
    for (let c = cls; c; c = EXC_PARENT[c]) {
      if (c === base) return true;
      if (EXTRA_PARENTS[c] && EXTRA_PARENTS[c].some(x => isSubclass(x, base))) return true;
    }
    return false;
  };
  const NOT_BUILTIN = new Set(['JSONDecodeError', 'gaierror', 'SSLError', 'SSLCertVerificationError']);

  function typeName(v) {
    if (v.t === 'object') return v.cls;
    if (v.t === 'builtin') return 'builtin_function_or_method';
    return v.t;
  }

  function floatRepr(x) {
    if (Number.isNaN(x)) return 'nan';
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
    const s = String(x);
    return s.replace(/e\+?(-?)(\d)$/, 'e$1' + '0$2').replace('e0', 'e+0').replace(/e(\d)/, 'e+$1');
  }
  function strRepr(s) {
    const q = s.includes("'") && !s.includes('"') ? '"' : "'";
    return q + s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(q === "'" ? /'/g : /"/g, '\\' + q) + q;
  }
  function pyRepr(v, seen) {
    switch (v.t) {
      case 'NoneType': return 'None';
      case 'bool': return v.v ? 'True' : 'False';
      case 'int': return String(v.v);
      case 'float': return floatRepr(v.v);
      case 'str': return strRepr(v.v);
      case 'bytes': return 'b' + strRepr(v.v);
      case 'list': case 'tuple': {
        seen = seen || new Set();
        if (seen.has(v)) return '[...]';
        seen.add(v);
        const inner = v.v.map(x => pyRepr(x, seen)).join(', ');
        return v.t === 'list' ? `[${inner}]` : v.v.length === 1 ? `(${inner},)` : `(${inner})`;
      }
      case 'dict': {
        seen = seen || new Set();
        if (seen.has(v)) return '{...}';
        seen.add(v);
        return '{' + [...v.v.values()].map(([k, x]) => `${pyRepr(k, seen)}: ${pyRepr(x, seen)}`).join(', ') + '}';
      }
      case 'range': return v.step === 1 ? `range(${v.start}, ${v.stop})` : `range(${v.start}, ${v.stop}, ${v.step})`;
      case 'function': return `<function ${v.name}>`;
      case 'builtin': return `<built-in function ${v.name}>`;
      case 'method': return `<bound method ${v.name}>`;
      case 'module': return `<module '${v.name}'>`;
      case 'type': return `<class '${v.name}'>`;
      case 'exception': return `${v.cls}(${strRepr(v.msg)})`;
      case 'object': return v.repr ? v.repr() : `<${v.cls} object>`;
    }
    return '<?>';
  }
  function pyStr(v) {
    if (v.t === 'str') return v.v;
    if (v.t === 'exception') return v.cls === 'KeyError' ? v.msg : v.msg;
    if (v.t === 'object' && v.str) return v.str();
    return pyRepr(v);
  }

  function keyOf(v, line) {
    switch (v.t) {
      case 'int': case 'float': case 'bool': return 'n:' + numOf(v);
      case 'str': return 's:' + v.v;
      case 'NoneType': return 'N';
      case 'tuple': return 't:' + v.v.map(x => keyOf(x, line)).join('\u0001');
      case 'bytes': return 'b:' + v.v;
    }
    if (v.t === 'list' || v.t === 'dict') raise('TypeError', `unhashable type: '${v.t}'`, `Μια ${v.t === 'list' ? 'λίστα' : 'λεξικό'} δεν μπορεί να είναι κλειδί λεξικού. Χρησιμοποίησε κείμενο ή αριθμό.`, line);
    return 'o:' + (v.__id || (v.__id = Math.random()));
  }
  function mkDict(pairs, line) {
    const m = new Map();
    for (const [k, v] of pairs) m.set(keyOf(k, line), [k, v]);
    return { t: 'dict', v: m };
  }

  function truthy(v) {
    switch (v.t) {
      case 'NoneType': return false;
      case 'bool': return v.v;
      case 'int': case 'float': return v.v !== 0;
      case 'str': case 'bytes': return v.v.length > 0;
      case 'list': case 'tuple': return v.v.length > 0;
      case 'dict': return v.v.size > 0;
      case 'range': return rangeLen(v) > 0;
    }
    return true;
  }
  const rangeLen = r => Math.max(0, Math.ceil((r.stop - r.start) / r.step));

  function pyEq(a, b) {
    if (isNum(a) && isNum(b)) return numOf(a) === numOf(b);
    if (a.t === 'object' && a.cls === 'ReasonCode' && isNum(b)) return a.value === numOf(b);
    if (b.t === 'object' && b.cls === 'ReasonCode' && isNum(a)) return b.value === numOf(a);
    if (a.t !== b.t) return false;
    switch (a.t) {
      case 'NoneType': return true;
      case 'str': case 'bytes': return a.v === b.v;
      case 'list': case 'tuple': return a.v.length === b.v.length && a.v.every((x, i) => pyEq(x, b.v[i]));
      case 'dict': {
        if (a.v.size !== b.v.size) return false;
        for (const [k, [, x]] of a.v) { const o = b.v.get(k); if (!o || !pyEq(x, o[1])) return false; }
        return true;
      }
      case 'type': return a.name === b.name;
    }
    return a === b;
  }

  const TYPE_GR = { int: 'ακέραιος', float: 'δεκαδικός', str: 'κείμενο', bool: 'True/False', list: 'λίστα', dict: 'λεξικό' };
  const gr = v => (v.t === 'NoneType' ? 'None' : `τιμή τύπου ${typeName(v)}${TYPE_GR[typeName(v)] ? ` (${TYPE_GR[typeName(v)]})` : ''}`);

  function compare(op, a, b, line) {
    if (op === '==') return pyEq(a, b);
    if (op === '!=') return !pyEq(a, b);
    if (op === 'is') return a === b || (a.t === 'NoneType' && b.t === 'NoneType') || (a.t === 'bool' && b.t === 'bool' && a.v === b.v);
    if (op === 'is not') return !compare('is', a, b, line);
    if (op === 'in' || op === 'not in') {
      let r;
      if (b.t === 'str') {
        if (a.t !== 'str') raise('TypeError', `'in <string>' requires string as left operand, not ${typeName(a)}`, 'Για να ψάξεις μέσα σε κείμενο, αυτό που ψάχνεις πρέπει να είναι κι αυτό κείμενο.', line);
        r = b.v.includes(a.v);
      } else if (b.t === 'bytes') r = a.t === 'bytes' && b.v.includes(a.v);
      else if (b.t === 'list' || b.t === 'tuple') r = b.v.some(x => pyEq(x, a));
      else if (b.t === 'dict') r = b.v.has(keyOf(a, line));
      else if (b.t === 'range') { const n = numOf(a); r = n >= b.start && n < b.stop && (n - b.start) % b.step === 0; }
      else if (b.t === 'object' && b.contains) r = b.contains(a, line);
      else raise('TypeError', `argument of type '${typeName(b)}' is not iterable`, 'Το «in» δουλεύει με κείμενο, λίστα, tuple ή λεξικό.', line);
      return op === 'in' ? r : !r;
    }
    let x;
    let y;
    if (isNum(a) && isNum(b)) { x = numOf(a); y = numOf(b); }
    else if (a.t === 'str' && b.t === 'str') { x = a.v; y = b.v; }
    else if ((a.t === 'list' && b.t === 'list') || (a.t === 'tuple' && b.t === 'tuple')) {
      const n = Math.min(a.v.length, b.v.length);
      for (let i = 0; i < n; i++) {
        if (!pyEq(a.v[i], b.v[i])) return compare(op, a.v[i], b.v[i], line);
      }
      x = a.v.length; y = b.v.length;
    } else {
      const hint = (a.t === 'str' && isNum(b)) || (isNum(a) && b.t === 'str')
        ? 'Συγκρίνεις κείμενο με αριθμό. Αν το κείμενο ήρθε από MQTT ή από input, μετάτρεψέ το πρώτα: float(τιμή) ή int(τιμή).'
        : a.t === 'NoneType' || b.t === 'NoneType' ? 'Η μία τιμή είναι None (τίποτα). Έλεγξε πρώτα με if τιμή is not None:'
          : `Δεν γίνεται σύγκριση ανάμεσα σε ${gr(a)} και ${gr(b)}.`;
      raise('TypeError', `'${op}' not supported between instances of '${typeName(a)}' and '${typeName(b)}'`, hint, line);
    }
    switch (op) {
      case '<': return x < y;
      case '>': return x > y;
      case '<=': return x <= y;
      case '>=': return x >= y;
    }
    return false;
  }

  function binop(op, a, b, line) {
    if (isNum(a) && isNum(b)) {
      const x = numOf(a);
      const y = numOf(b);
      const isF = a.t === 'float' || b.t === 'float';
      const mk = n => (isF ? F(n) : I(n));
      switch (op) {
        case '+': return mk(x + y);
        case '-': return mk(x - y);
        case '*': return mk(x * y);
        case '/':
          if (y === 0) raise('ZeroDivisionError', isF ? 'float division by zero' : 'division by zero', 'Διαίρεση με το μηδέν. Έλεγξε πρώτα ότι ο διαιρέτης δεν είναι 0 (π.χ. ότι η λίστα δεν είναι άδεια).', line);
          return F(x / y);
        case '//':
          if (y === 0) raise('ZeroDivisionError', 'integer division or modulo by zero', 'Διαίρεση με το μηδέν.', line);
          return mk(Math.floor(x / y));
        case '%':
          if (y === 0) raise('ZeroDivisionError', 'integer modulo by zero', 'Υπόλοιπο διαίρεσης με το μηδέν.', line);
          return mk(((x % y) + y) % y);
        case '**': return (!isF && y >= 0) ? I(Math.pow(x, y)) : F(Math.pow(x, y));
      }
    }
    if (op === '+') {
      if (a.t === 'str' && b.t === 'str') return S(a.v + b.v);
      if (a.t === 'bytes' && b.t === 'bytes') return BY(a.v + b.v);
      if (a.t === 'list' && b.t === 'list') return L(a.v.concat(b.v));
      if (a.t === 'tuple' && b.t === 'tuple') return T(a.v.concat(b.v));
      if (a.t === 'str') raise('TypeError', `can only concatenate str (not "${typeName(b)}") to str`, `Προσπαθείς να ενώσεις κείμενο με ${gr(b)}. Μετάτρεψέ το με str(…) ή χρησιμοποίησε f-string: f"Τιμή: {x}"`, line);
      if (b.t === 'str' && isNum(a)) raise('TypeError', `unsupported operand type(s) for +: '${typeName(a)}' and 'str'`, 'Προσθέτεις αριθμό με κείμενο. Αν το κείμενο είναι αριθμός (π.χ. από MQTT), μετάτρεψέ το με float(…) ή int(…).', line);
    }
    if (op === '*') {
      const rep = (seq, n) => { const k = Math.max(0, numOf(n)); return seq.t === 'str' ? S(seq.v.repeat(k)) : L([].concat(...Array(k).fill(seq.v))); };
      if ((a.t === 'str' || a.t === 'list') && (b.t === 'int' || b.t === 'bool')) return rep(a, b);
      if ((b.t === 'str' || b.t === 'list') && (a.t === 'int' || a.t === 'bool')) return rep(b, a);
    }
    if (a.t === 'NoneType' || b.t === 'NoneType') {
      raise('TypeError', `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`, 'Η μία τιμή είναι None. Συνήθως αυτό σημαίνει ότι μια συνάρτηση δεν έκανε return, ή ότι το dict.get() δεν βρήκε το κλειδί.', line);
    }
    return raise('TypeError', `unsupported operand type(s) for ${op}: '${typeName(a)}' and '${typeName(b)}'`, `Ο τελεστής ${op} δεν δουλεύει ανάμεσα σε ${gr(a)} και ${gr(b)}.`, line);
  }

  // Σε μορφοποίηση: {x:.1f}, {x:5}, {x:>8}, {x:,}, {x:d}, {x:%}
  function formatSpec(v, spec, line) {
    if (!spec) return pyStr(v);
    const m = /^(?:(.)?([<>^]))?(0)?(\d+)?(,)?(?:\.(\d+))?([dfs%eg])?$/.exec(spec);
    if (!m) raise('ValueError', `Invalid format specifier '${spec}'`, 'Υποστηρίζονται μορφές όπως {x:.1f}, {x:5}, {x:>8}, {x:,}.', line);
    const [, fillCh, align, zero, width, comma, prec, type] = m;
    let s;
    if (type === 'd') {
      if (v.t !== 'int' && v.t !== 'bool') raise('ValueError', `Unknown format code 'd' for object of type '${typeName(v)}'`, 'Το :d είναι για ακέραιους. Για δεκαδικούς γράψε :.0f ή :.1f.', line);
      s = String(numOf(v));
    } else if (type === 'f' || type === '%' || (prec !== undefined && type !== 's')) {
      if (!isNum(v)) raise('ValueError', `Unknown format code '${type || 'f'}' for object of type '${typeName(v)}'`, `Το :.${prec || 6}f θέλει αριθμό, αλλά η τιμή είναι ${gr(v)}. Αν είναι κείμενο από MQTT, μετάτρεψέ το με float(…).`, line);
      const x = numOf(v) * (type === '%' ? 100 : 1);
      s = x.toFixed(prec === undefined ? 6 : Number(prec)) + (type === '%' ? '%' : '');
    } else s = pyStr(v);
    if (comma && isNum(v)) {
      const [ip, fp] = s.split('.');
      s = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fp !== undefined ? '.' + fp : '');
    }
    const w = width ? Number(width) : 0;
    if (s.length < w) {
      const fc = zero ? '0' : (fillCh || ' ');
      const al = align || (isNum(v) ? '>' : '<');
      const pad = w - s.length;
      if (al === '<') s = s + fc.repeat(pad);
      else if (al === '>') s = fc.repeat(pad) + s;
      else s = fc.repeat(Math.floor(pad / 2)) + s + fc.repeat(Math.ceil(pad / 2));
    }
    return s;
  }

  // ---------------------------------------------------------- JSON (με διάκριση int / float όπως η Python)

  function jsonLoads(text, line) {
    const s = String(text);
    let i = 0;
    const err = (what) => {
      const before = s.slice(0, i);
      const ln = before.split('\n').length;
      const col = i - before.lastIndexOf('\n');
      raise('JSONDecodeError', `${what}: line ${ln} column ${col} (char ${i})`,
        s.trim() === '' ? 'Το κείμενο είναι άδειο, οπότε δεν είναι JSON.' : 'Το κείμενο δεν είναι έγκυρο JSON. Στο JSON τα κλειδιά και τα κείμενα μπαίνουν σε διπλά "εισαγωγικά" και δεν επιτρέπεται κόμμα στο τέλος.', line);
    };
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    function value() {
      ws();
      const c = s[i];
      if (c === '{') {
        i++;
        const pairs = [];
        ws();
        if (s[i] === '}') { i++; return mkDict(pairs, line); }
        for (;;) {
          ws();
          if (s[i] !== '"') err('Expecting property name enclosed in double quotes');
          const k = string();
          ws();
          if (s[i] !== ':') err("Expecting ':' delimiter");
          i++;
          pairs.push([S(k), value()]);
          ws();
          if (s[i] === ',') { i++; continue; }
          if (s[i] === '}') { i++; return mkDict(pairs, line); }
          err("Expecting ',' delimiter");
        }
      }
      if (c === '[') {
        i++;
        const out = [];
        ws();
        if (s[i] === ']') { i++; return L(out); }
        for (;;) {
          out.push(value());
          ws();
          if (s[i] === ',') { i++; continue; }
          if (s[i] === ']') { i++; return L(out); }
          err("Expecting ',' delimiter");
        }
      }
      if (c === '"') return S(string());
      if (s.startsWith('true', i)) { i += 4; return TRUE; }
      if (s.startsWith('false', i)) { i += 5; return FALSE; }
      if (s.startsWith('null', i)) { i += 4; return NONE; }
      // Όπως η Python: δέχεται NaN, Infinity, -Infinity (όχι όμως nan με μικρά).
      if (s.startsWith('NaN', i)) { i += 3; return F(NaN); }
      if (s.startsWith('Infinity', i)) { i += 8; return F(Infinity); }
      if (s.startsWith('-Infinity', i)) { i += 9; return F(-Infinity); }
      const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i));
      if (m && m[0] !== '-') {
        i += m[0].length;
        return m[2] || m[3] ? F(Number(m[0])) : I(Number(m[0]));
      }
      return err('Expecting value');
    }
    function string() {
      i++;
      let out = '';
      while (i < s.length && s[i] !== '"') {
        if (s[i] === '\\') {
          const n = s[i + 1];
          const map = { n: '\n', t: '\t', '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', r: '\r' };
          if (n === 'u') { out += String.fromCharCode(parseInt(s.slice(i + 2, i + 6), 16)); i += 6; continue; }
          out += map[n] !== undefined ? map[n] : n;
          i += 2;
          continue;
        }
        out += s[i++];
      }
      if (i >= s.length) err('Unterminated string starting at');
      i++;
      return out;
    }
    const v = value();
    ws();
    if (i < s.length) err('Extra data');
    return v;
  }

  function jsonDumps(v, opts, line, indentLevel) {
    const ascii = opts.ensure_ascii !== false;
    const ind = opts.indent;
    const lvl = indentLevel || 0;
    const q = str => '"' + str.replace(/[\\"\u0000-\u001f\u007f-\uffff]/g, ch => {
      const map = { '\\': '\\\\', '"': '\\"', '\n': '\\n', '\t': '\\t', '\r': '\\r', '\b': '\\b', '\f': '\\f' };
      if (map[ch]) return map[ch];
      const code = ch.charCodeAt(0);
      if (code < 0x20 || ascii) return '\\u' + code.toString(16).padStart(4, '0');
      return ch;
    }) + '"';
    const nl = ind !== null && ind !== undefined ? '\n' + ' '.repeat(ind * (lvl + 1)) : '';
    const end = ind !== null && ind !== undefined ? '\n' + ' '.repeat(ind * lvl) : '';
    const sep = (ind !== null && ind !== undefined) || opts.compact ? ',' : ', ';
    const kv = opts.compact ? ':' : ': ';
    switch (v.t) {
      case 'NoneType': return 'null';
      case 'bool': return v.v ? 'true' : 'false';
      case 'int': return String(v.v);
      case 'float': return Number.isNaN(v.v) ? 'NaN' : v.v === Infinity ? 'Infinity' : v.v === -Infinity ? '-Infinity' : floatRepr(v.v);
      case 'str': return q(v.v);
      case 'list': case 'tuple':
        if (!v.v.length) return '[]';
        return '[' + nl + v.v.map(x => jsonDumps(x, opts, line, lvl + 1)).join(sep + nl) + end + ']';
      case 'dict':
        if (!v.v.size) return '{}';
        return '{' + nl + (opts.sortKeys ? [...v.v.values()].sort((a, b) => (pyStr(a[0]) < pyStr(b[0]) ? -1 : pyStr(a[0]) > pyStr(b[0]) ? 1 : 0)) : [...v.v.values()]).map(([k, x]) => {
          let ks;
          if (k.t === 'str') ks = q(k.v);
          else if (isNum(k) || k.t === 'NoneType') ks = q(k.t === 'NoneType' ? 'null' : k.t === 'bool' ? (k.v ? 'true' : 'false') : pyStr(k));
          else raise('TypeError', `keys must be str, int, float, bool or None, not ${typeName(k)}`, '', line);
          return ks + kv + jsonDumps(x, opts, line, lvl + 1);
        }).join(sep + nl) + end + '}';
    }
    return raise('TypeError', `Object of type ${typeName(v)} is not JSON serializable`, v.t === 'bytes' ? 'Τα bytes δεν γίνονται JSON. Μετάτρεψέ τα πρώτα σε κείμενο με .decode().' : `Το json.dumps μετατρέπει μόνο λεξικά, λίστες, κείμενα, αριθμούς, True/False και None, όχι ${gr(v)}.`, line);
  }

  // ================================================================== Μηχανή

  const STEP_US = 2;
  const CHUNK_US = 10000;
  const EPOCH = Date.UTC(2026, 9, 15, 5, 0, 0) / 1000; // 2026-10-15 08:00 ώρα Ελλάδας (UTC+3)
  const TZ_OFFSET = 3 * 3600;
  // Pins του εικονικού Raspberry Pi (αρίθμηση BCM) → εξαρτήματα της εικονικής πλακέτας
  const PI_PINS = { LED: 17, BUTTON: 27, PIR: 4 };
  const BROKER_HOSTS = new Set(['broker.home.lan', 'localhost', '127.0.0.1', '192.168.1.10']);
  const MODULE_NAMES = ['time', 'json', 'random', 'math', 'datetime', 'gpiozero', 'signal', 'ssl', 'socket', 'paho', 'paho.mqtt', 'paho.mqtt.client', 'config'];
  const IMPORT_HINTS = {};
  const NAME_HINTS = {
    time: 'Ξέχασες το import time στην αρχή;', json: 'Ξέχασες το import json στην αρχή;', random: 'Ξέχασες το import random;', math: 'Ξέχασες το import math;',
    LED: 'Ξέχασες το from gpiozero import LED;', Button: 'Ξέχασες το from gpiozero import Button;', MotionSensor: 'Ξέχασες το from gpiozero import MotionSensor;',
    mqtt: 'Ξέχασες το import paho.mqtt.client as mqtt;', sleep: 'Ξέχασες το from time import sleep; Ή γράψε time.sleep(…).', pause: 'Ξέχασες το from signal import pause;',
    datetime: 'Ξέχασες το from datetime import datetime;'
  };

  class PyMachine {
    constructor(program, board, opts) {
      opts = opts || {};
      this.lang = 'python';
      this.prog = program;
      this.board = board;
      this.globals = new Map();
      this.frames = [];
      this.stepLimit = opts.stepLimit || 20000;
      this.consts = Object.assign({ BROKER_HOST: 'broker.home.lan' }, opts.consts || {});
      this.stepsInCall = 0;
      this.totalSteps = 0;
      this.phase = 'script';
      this.loopIndex = 0;
      this.currentLine = null;
      this.lastBranch = null;
      this.changeCounter = 0;
      this.loopLog = [];
      this.loopInputs = null;
      this.loopSerialStart = 0;
      this.inMainLoop = false;
      this.finished = false;
      this.watchers = [];   // gpiozero: συσκευές με when_pressed κ.λπ.
      this.blinkers = [];
      this.clients = [];    // paho: clients
      this.services = [];   // άλλες «υπηρεσίες» που τρέχουν στις αναμονές (π.χ. ο web server του Flask)
      this.dispatching = false;
      this.rand = 42;
      board.serialStarted = true; // στο Pi το print() πάει κατευθείαν στο τερματικό
      this.builtins = makeBuiltins(this);
    }

    // ---------------------------------------------------------- μεταβλητές
    mkVar(name, value, line, kind) {
      return { name, type: typeName(value), value, prev: null, line, isConst: false, kind, stamp: ++this.changeCounter };
    }
    setVar(rec, val, line) {
      rec.prev = rec.value;
      rec.value = val;
      rec.type = typeName(val);
      rec.line = line;
      rec.stamp = ++this.changeCounter;
    }
    lookup(name, sc, line) {
      if (sc) {
        if (sc.locals.has(name)) return sc.locals.get(name).value;
        if (sc.fn.assigned.has(name) && !sc.fn.globalsDecl.has(name) && !sc.globalNames.has(name)) {
          raise('UnboundLocalError', `cannot access local variable '${name}' where it is not associated with a value`,
            `Μέσα στη συνάρτηση ${sc.fn.name}() δίνεις τιμή στη «${name}», άρα η Python τη θεωρεί τοπική, αλλά τη διαβάζεις πριν πάρει τιμή. Αν θέλεις να αλλάξεις τη μεταβλητή του προγράμματος, γράψε global ${name} στην αρχή της συνάρτησης.`, line);
        }
      }
      if (this.globals.has(name)) return this.globals.get(name).value;
      if (Object.prototype.hasOwnProperty.call(this.builtins, name)) return this.builtins[name];
      if (name === 'true' || name === 'false') raise('NameError', `name '${name}' is not defined. Did you mean: '${name === 'true' ? 'True' : 'False'}'?`, `Στην Python γράφεται ${name === 'true' ? 'True' : 'False'}, με κεφαλαίο το πρώτο γράμμα.`, line);
      if (name === 'null' || name === 'NULL') raise('NameError', `name '${name}' is not defined`, 'Στην Python το «τίποτα» γράφεται None.', line);
      const hint = NAME_HINTS[name] || (name.toLowerCase() === 'none' ? 'Γράφεται None, με κεφαλαίο N.' : name === 'print' ? '' : 'Έλεγξε την ορθογραφία (κεφαλαία/μικρά) και ότι η μεταβλητή πήρε τιμή πριν τη χρησιμοποιήσεις.');
      return raise('NameError', `name '${name}' is not defined`, hint, line);
    }
    assign(name, val, sc, line) {
      if (sc && !sc.fn.globalsDecl.has(name) && !sc.globalNames.has(name)) {
        const rec = sc.locals.get(name);
        if (rec) this.setVar(rec, val, line); else sc.locals.set(name, this.mkVar(name, val, line, 'local'));
        return;
      }
      const rec = this.globals.get(name);
      if (rec) this.setVar(rec, val, line); else this.globals.set(name, this.mkVar(name, val, line, 'global'));
    }
    hidden(v) { return ['module', 'function', 'builtin', 'type', 'method'].includes(v.t); }
    visibleVars() {
      const out = [...this.globals.values()].filter(r => !this.hidden(r.value));
      const fr = this.frames[this.frames.length - 1];
      if (fr) out.push(...[...fr.locals.values()].filter(r => !this.hidden(r.value)));
      return out;
    }
    snapshotGlobals() {
      const out = {};
      for (const [k, rec] of this.globals) if (!this.hidden(rec.value)) out[k] = display(rec.value);
      return out;
    }

    // ---------------------------------------------------------- χρόνος και γεγονότα
    *tick(line) {
      this.currentLine = line;
      this.totalSteps++;
      this.stepsInCall++;
      this.board.advanceMicros(STEP_US);
      if (this.stepsInCall > this.stepLimit) {
        throw new CodeError(`Ο κώδικας έκανε ${this.stepLimit.toLocaleString('el-GR')} βήματα χωρίς καμία αναμονή.`, line,
          'Μάλλον υπάρχει βρόχος που δεν σταματά ποτέ (η συνθήκη του while δεν γίνεται ποτέ False), ή ένα while True χωρίς time.sleep(…) μέσα του.');
      }
      yield { kind: 'line', line };
    }

    // Περιμένει «ms» χιλιοστά: ο χρόνος κυλά σε κομμάτια, και στο μεταξύ τρέχουν τα «παρασκήνια»
    // (callbacks του gpiozero, του paho με loop_start, το blink του LED).
    *wait(ms, line, opts) {
      opts = opts || {};
      const end = this.board.micros + Math.round(ms * 1000);
      this.stepsInCall = 0;
      for (;;) {
        if (!opts.noDispatch) yield* this.dispatch(line, opts.forceMqtt);
        if (opts.until && opts.until()) return true;
        if (this.board.micros >= end) return false;
        this.board.advanceMicros(Math.max(1, Math.min(CHUNK_US, end - this.board.micros)));
        yield { kind: 'waiting' };
      }
    }

    *dispatch(line, forceMqtt) {
      if (this.dispatching) return;
      this.dispatching = true;
      try {
        for (const b of this.blinkers) b.update();
        for (const w of this.watchers) {
          const cur = w.read();
          if (cur === w.last) continue;
          w.last = cur;
          const h = cur ? w.obj.handlers.on : w.obj.handlers.off;
          if (h && h.t !== 'NoneType') yield* this.callValue(h, h.t === 'function' && h.node.params.length ? [w.obj] : [], {}, line);
        }
        for (const c of this.clients) if (c.mode === 'thread' || forceMqtt === c) yield* this.serviceClient(c, line);
        for (const svc of this.services) yield* svc(line);
      } finally {
        this.dispatching = false;
      }
    }

    beginIteration() {
      this.phase = 'loop';
      this.loopIndex++;
      this.stepsInCall = 0;
      this.loopInputs = Object.assign({}, this.board.inputs);
      this.loopSerialStart = this.board.seq;
      this.loopStamp = this.changeCounter;
      return { kind: 'loopStart', index: this.loopIndex };
    }
    endIteration(quietOk) {
      this.board.advanceMicros(10);
      const output = this.board.serial.filter(l => l.id > this.loopSerialStart).map(l => l.text);
      if (!quietOk || output.length || this.changeCounter !== this.loopStamp) {
        this.loopLog.push({ index: this.loopIndex, inputs: this.loopInputs, vars: this.snapshotGlobals(), output });
        if (this.loopLog.length > 60) this.loopLog.shift();
      }
      return { kind: 'loopEnd', index: this.loopIndex };
    }

    // Ατέρμονος βρόχος γεγονότων (client.loop_forever(), pause()): κάθε 50 ms μία «επανάληψη».
    *eventLoop(line, client) {
      const main = !this.inMainLoop;
      if (main) this.inMainLoop = true;
      for (;;) {
        if (main) yield this.beginIteration();
        yield* this.wait(50, line, { forceMqtt: client });
        if (main) yield this.endIteration(true);
      }
    }

    // ---------------------------------------------------------- εκτέλεση
    *main() {
      try {
        yield* this.execList(this.prog.body, null);
      } catch (e) {
        if (e instanceof PyExc) throw toCodeError(e);
        if (e && e.signal) throw new CodeError(e.signal === 'return' ? "SyntaxError: 'return' outside function" : `SyntaxError: '${e.signal}' outside loop`, e.line);
        throw e;
      }
      this.phase = 'τέλος';
      this.finished = true;
      // Όταν τελειώνει το πρόγραμμα, κλείνει και η σύνδεση με τον broker (όπως όταν τελειώνει η διεργασία).
      if (this.clients.length && this.board.net && this.board.net.connected('device')) this.board.net.dropClient('device', 'το πρόγραμμα τελείωσε');
      for (const fn of this.onEnd || []) fn();
    }

    *execList(list, sc) {
      for (const s of list) {
        const r = yield* this.exec(s, sc);
        if (r) return r;
      }
      return null;
    }

    *exec(s, sc) {
      switch (s.k) {
        case 'pass': yield* this.tick(s.line); return null;
        case 'expr': yield* this.tick(s.line); yield* this.ev(s.expr, sc); return null;
        case 'assign': {
          yield* this.tick(s.line);
          const v = yield* this.ev(s.value, sc);
          for (const tg of s.targets) yield* this.store(tg, v, sc, s.line);
          return null;
        }
        case 'aug': {
          yield* this.tick(s.line);
          const cur = yield* this.ev(s.target, sc);
          const rhs = yield* this.ev(s.value, sc);
          let v;
          if (s.op === '+' && cur.t === 'list') {
            const items = yield* this.iterate(rhs, s.line);
            cur.v.push(...items);
            v = cur;
          } else v = binop(s.op, cur, rhs, s.line);
          yield* this.store(s.target, v, sc, s.line);
          return null;
        }
        case 'if': {
          yield* this.tick(s.line);
          for (let i = 0; i < s.tests.length; i++) {
            const c = s.tests[i];
            if (i > 0) yield* this.tick(c.line);
            const v = yield* this.ev(c.cond, sc);
            const ok = truthy(v);
            const last = i === s.tests.length - 1;
            if (ok || last) {
              this.lastBranch = {
                line: c.line, lang: 'python', kw: i === 0 ? 'if' : 'elif',
                cond: exprToString(c.cond), result: ok,
                branch: ok ? (i === 0 ? 'if' : 'elif') : (s.orelse ? 'else' : 'none'),
                range: ok ? rangeOf(c.body) : rangeOf(s.orelse),
                vars: [...namesIn(c.cond)].map(n => ({ name: n, value: this.peekName(n, sc) })).filter(x => x.value !== null),
                step: this.totalSteps
              };
            }
            if (ok) return yield* this.execList(c.body, sc);
          }
          if (s.orelse) return yield* this.execList(s.orelse, sc);
          return null;
        }
        case 'while': {
          // Το «while True:» είναι ο κύριος βρόχος του προγράμματος: κάθε γύρος του είναι μία «επανάληψη»
          // (όπως το loop() στο ESP32), ώστε να φαίνεται στον πίνακα επαναλήψεων και να ελέγχεται.
          const isMain = !this.inMainLoop && s.cond.k === 'const' && truthy(s.cond.v);
          if (isMain) this.inMainLoop = true;
          try {
            for (;;) {
              yield* this.tick(s.line);
              if (!truthy(yield* this.ev(s.cond, sc))) return null;
              if (isMain) yield this.beginIteration();
              const r = yield* this.execList(s.body, sc);
              if (isMain) yield this.endIteration(false);
              if (r && r.signal === 'break') return null;
              if (r && r.signal === 'continue') continue;
              if (r) return r;
            }
          } finally {
            if (isMain) { this.inMainLoop = false; this.phase = 'script'; }
          }
        }
        case 'for': {
          yield* this.tick(s.line);
          const iter = yield* this.ev(s.iter, sc);
          const items = yield* this.iterate(iter, s.line);
          for (const item of items) {
            if (s.targets.length === 1) this.assign(s.targets[0], item, sc, s.line);
            else yield* this.unpack(s.targets.map(n => ({ k: 'name', name: n })), item, sc, s.line);
            const r = yield* this.execList(s.body, sc);
            if (r && r.signal === 'break') break;
            if (r && r.signal === 'continue') { yield* this.tick(s.line); continue; }
            if (r) return r;
            yield* this.tick(s.line);
          }
          return null;
        }
        case 'break': yield* this.tick(s.line); return { signal: 'break', line: s.line };
        case 'continue': yield* this.tick(s.line); return { signal: 'continue', line: s.line };
        case 'return': {
          yield* this.tick(s.line);
          if (!sc) throw new CodeError("SyntaxError: 'return' outside function", s.line, 'Το return χρησιμοποιείται μόνο μέσα σε συνάρτηση (def).');
          const value = s.value ? yield* this.ev(s.value, sc) : NONE;
          return { signal: 'return', value };
        }
        case 'global':
          yield* this.tick(s.line);
          if (sc) s.names.forEach(n => sc.globalNames.add(n));
          return null;
        case 'def': {
          yield* this.tick(s.line);
          const defaults = [];
          for (const p of s.params) defaults.push(p.def ? yield* this.ev(p.def, sc) : null);
          let fv = { t: 'function', name: s.name, node: s, defaults };
          for (const dec of (s.decorators || []).slice().reverse()) {
            const dv = yield* this.ev(dec, sc);
            fv = yield* this.callValue(dv, [fv], {}, s.line);
          }
          this.assign(s.name, fv, sc, s.line);
          return null;
        }
        case 'import': {
          yield* this.tick(s.line);
          for (const it of s.items) {
            const mod = this.module(it.path, s.line);
            if (it.alias) this.assign(it.alias, mod, sc, s.line);
            else {
              const top = it.path.split('.')[0];
              this.assign(top, this.module(top, s.line), sc, s.line);
            }
          }
          return null;
        }
        case 'from': {
          yield* this.tick(s.line);
          const mod = this.module(s.module, s.line);
          for (const n of s.names) {
            let v = mod.attrs[n.name];
            if (!v && MODULE_NAMES.includes(s.module + '.' + n.name)) v = this.module(s.module + '.' + n.name, s.line);
            if (!v) {
              const hint = IMPORT_HINTS[s.module + '.' + n.name] || (s.module === 'config' ? `Το config αυτής της άσκησης έχει: ${Object.keys(mod.attrs).join(', ')}.` : `Το ${s.module} δεν έχει «${n.name}» σε αυτή την εκπαιδευτική έκδοση.`);
              raise('ImportError', `cannot import name '${n.name}' from '${s.module}'`, hint, s.line);
            }
            this.assign(n.alias || n.name, v, sc, s.line);
          }
          return null;
        }
        case 'raise': {
          yield* this.tick(s.line);
          if (!s.value) raise('RuntimeError', 'No active exception to reraise', '', s.line);
          let v = yield* this.ev(s.value, sc);
          if (v.t === 'type') v = { t: 'exception', cls: v.name, msg: '' };
          if (v.t !== 'exception') raise('TypeError', 'exceptions must derive from BaseException', 'Το raise θέλει σφάλμα, π.χ. raise ValueError("λάθος τιμή").', s.line);
          throw new PyExc(v.cls, v.msg, '', s.line);
        }
        case 'try': {
          yield* this.tick(s.line);
          let result = null;
          try {
            try {
              result = yield* this.execList(s.body, sc);
            } catch (e) {
              if (!(e instanceof PyExc)) throw e;
              let handled = false;
              for (const h of s.handlers) {
                let match = !h.type;
                if (h.type) {
                  const tv = yield* this.ev(h.type, sc);
                  const types = tv.t === 'tuple' ? tv.v : [tv];
                  match = types.some(x => x.t === 'type' && isSubclass(e.cls, x.name));
                }
                if (!match) continue;
                yield* this.tick(h.line);
                if (h.name) this.assign(h.name, { t: 'exception', cls: e.cls, msg: e.msg }, sc, h.line);
                result = yield* this.execList(h.body, sc);
                handled = true;
                break;
              }
              if (!handled) throw e;
              return result;
            }
            if (s.orelse) result = yield* this.execList(s.orelse, sc);
            return result;
          } finally {
            if (s.finalbody) {
              const r = yield* this.execList(s.finalbody, sc);
              if (r) return r; // eslint-disable-line no-unsafe-finally
            }
          }
        }
      }
      throw new CodeError('Άγνωστη εντολή.', s.line);
    }

    peekName(n, sc) {
      try { return display(this.lookup(n, sc, null)); } catch (e) { return null; }
    }

    *store(tg, v, sc, line) {
      if (tg.k === 'name') { this.assign(tg.name, v, sc, line); return; }
      if (tg.k === 'tuple') { yield* this.unpack(tg.items, v, sc, line); return; }
      if (tg.k === 'index') {
        const obj = yield* this.ev(tg.obj, sc);
        const idx = yield* this.ev(tg.index, sc);
        if (obj.t === 'list') {
          const i = this.listIndex(obj, idx, line);
          obj.v[i] = v;
        } else if (obj.t === 'dict') {
          obj.v.set(keyOf(idx, line), [idx, v]);
        } else raise('TypeError', `'${typeName(obj)}' object does not support item assignment`, obj.t === 'str' ? 'Τα κείμενα (str) δεν αλλάζουν. Φτιάξε νέο κείμενο.' : obj.t === 'tuple' ? 'Τα tuple δεν αλλάζουν. Χρησιμοποίησε λίστα [ ].' : '', line);
        this.touch(obj, line);
        return;
      }
      if (tg.k === 'attr') {
        const obj = yield* this.ev(tg.obj, sc);
        if (obj.t !== 'object' || !obj.setattr) raise('AttributeError', `'${typeName(obj)}' object has no attribute '${tg.name}'`, '', line);
        obj.setattr(tg.name, v, line);
        this.touch(obj, line);
      }
    }
    // Μια λίστα/λεξικό άλλαξε μέσα της: ενημέρωσε τη «σφραγίδα» της μεταβλητής για τον πίνακα μεταβλητών.
    touch(obj, line) {
      for (const rec of this.visibleVars()) if (rec.value === obj) { rec.stamp = ++this.changeCounter; rec.line = line; }
    }
    *unpack(targets, v, sc, line) {
      const items = yield* this.iterate(v, line);
      if (items.length !== targets.length) {
        raise('ValueError', items.length > targets.length ? `too many values to unpack (expected ${targets.length})` : `not enough values to unpack (expected ${targets.length}, got ${items.length})`,
          `Αριστερά έχεις ${targets.length} μεταβλητές, αλλά δεξιά υπάρχουν ${items.length} τιμές.`, line);
      }
      for (let i = 0; i < targets.length; i++) yield* this.store(targets[i], items[i], sc, line);
    }
    listIndex(obj, idx, line) {
      if (idx.t !== 'int' && idx.t !== 'bool') raise('TypeError', `list indices must be integers or slices, not ${typeName(idx)}`, idx.t === 'str' ? 'Μια λίστα διαβάζεται με αριθμό θέσης, π.χ. λίστα[0]. Με κλειδί-κείμενο διαβάζεται ένα λεξικό.' : '', line);
      let i = numOf(idx);
      if (i < 0) i += obj.v.length;
      if (i < 0 || i >= obj.v.length) raise('IndexError', `${obj.t} index out of range`, `Η λίστα έχει ${obj.v.length} στοιχεία (θέσεις 0 έως ${obj.v.length - 1}), αλλά ζήτησες τη θέση ${numOf(idx)}.`, line);
      return i;
    }

    *iterate(v, line) {
      if (v.t === 'object' && v.iterItems) return v.iterItems(line);
      switch (v.t) {
        case 'list': case 'tuple': return v.v.slice();
        case 'str': return [...v.v].map(S);
        case 'bytes': return [...v.v].map(c => I(c.charCodeAt(0)));
        case 'dict': return [...v.v.values()].map(p => p[0]);
        case 'range': {
          const out = [];
          const n = rangeLen(v);
          if (n > 100000) throw new CodeError('Το range είναι πολύ μεγάλο για την προσομοίωση.', line);
          for (let i = 0; i < n; i++) out.push(I(v.start + i * v.step));
          return out;
        }
      }
      return raise('TypeError', `'${typeName(v)}' object is not iterable`, v.t === 'int' ? 'Για να επαναλάβεις κάτι n φορές γράψε for i in range(n):' : `Το for δουλεύει με λίστες, κείμενα, λεξικά και range, όχι με ${gr(v)}.`, line);
    }

    *ev(e, sc) {
      switch (e.k) {
        case 'num': return e.float ? F(e.v) : I(e.v);
        case 'str': return S(e.v);
        case 'bytes': return BY(e.v);
        case 'const': return e.v;
        case 'name': return this.lookup(e.name, sc, e.line);
        case 'fstr': {
          let out = '';
          for (const p of e.parts) {
            if (p.lit !== undefined) { out += p.lit; continue; }
            const v = yield* this.ev(p.expr, sc);
            out += formatSpec(v, p.spec, e.line);
          }
          return S(out);
        }
        case 'list': {
          const out = [];
          for (const x of e.items) out.push(yield* this.ev(x, sc));
          return L(out);
        }
        case 'tuple': {
          const out = [];
          for (const x of e.items) out.push(yield* this.ev(x, sc));
          return T(out);
        }
        case 'dict': {
          const pairs = [];
          for (const [k, v] of e.pairs) pairs.push([yield* this.ev(k, sc), yield* this.ev(v, sc)]);
          return mkDict(pairs, e.line);
        }
        case 'listcomp': {
          const items = yield* this.iterate(yield* this.ev(e.iter, sc), e.line);
          const out = [];
          for (const item of items) {
            if (e.targets.length === 1) this.assign(e.targets[0], item, sc, e.line);
            else yield* this.unpack(e.targets.map(n => ({ k: 'name', name: n })), item, sc, e.line);
            if (e.cond && !truthy(yield* this.ev(e.cond, sc))) continue;
            out.push(yield* this.ev(e.elt, sc));
          }
          return L(out);
        }
        case 'un': {
          const a = yield* this.ev(e.a, sc);
          if (!isNum(a)) raise('TypeError', `bad operand type for unary ${e.op}: '${typeName(a)}'`, '', e.line);
          return e.op === '-' ? (a.t === 'float' ? F(-a.v) : I(-numOf(a))) : (a.t === 'float' ? a : I(numOf(a)));
        }
        case 'not': return B(!truthy(yield* this.ev(e.a, sc)));
        case 'bool': {
          const a = yield* this.ev(e.a, sc);
          if (e.op === 'and') return truthy(a) ? yield* this.ev(e.b, sc) : a;
          return truthy(a) ? a : yield* this.ev(e.b, sc);
        }
        case 'bin': {
          const a = yield* this.ev(e.a, sc);
          const b = yield* this.ev(e.b, sc);
          return binop(e.op, a, b, e.line);
        }
        case 'cmp': {
          let left = yield* this.ev(e.left, sc);
          for (let i = 0; i < e.ops.length; i++) {
            const right = yield* this.ev(e.rights[i], sc);
            if (!compare(e.ops[i], left, right, e.line)) return FALSE;
            left = right;
          }
          return TRUE;
        }
        case 'ifexp': return truthy(yield* this.ev(e.cond, sc)) ? yield* this.ev(e.a, sc) : yield* this.ev(e.b, sc);
        case 'index': {
          const obj = yield* this.ev(e.obj, sc);
          const idx = yield* this.ev(e.index, sc);
          return this.getItem(obj, idx, e.line);
        }
        case 'slice': {
          const obj = yield* this.ev(e.obj, sc);
          const lo = e.lo ? yield* this.ev(e.lo, sc) : null;
          const hi = e.hi ? yield* this.ev(e.hi, sc) : null;
          if (!['list', 'tuple', 'str', 'bytes'].includes(obj.t)) raise('TypeError', `'${typeName(obj)}' object is not subscriptable`, '', e.line);
          const len = obj.t === 'str' || obj.t === 'bytes' ? obj.v.length : obj.v.length;
          const norm = (x, d) => { if (!x || x.t === 'NoneType') return d; let n = numOf(x); if (n < 0) n += len; return Math.max(0, Math.min(len, n)); };
          const a = norm(lo, 0);
          const b = norm(hi, len);
          const part = obj.v.slice(a, Math.max(a, b));
          return obj.t === 'str' ? S(part) : obj.t === 'bytes' ? BY(part) : obj.t === 'tuple' ? T(part) : L(part);
        }
        case 'attr': {
          const obj = yield* this.ev(e.obj, sc);
          return this.getAttr(obj, e.name, e.line);
        }
        case 'call': {
          const fn = yield* this.ev(e.fn, sc);
          const args = [];
          const kw = {};
          for (const a of e.args) {
            const v = yield* this.ev(a.value, sc);
            if (a.name) kw[a.name] = v; else args.push(v);
          }
          return yield* this.callValue(fn, args, kw, e.line, e.fn);
        }
      }
      throw new CodeError('Άγνωστη έκφραση.', e.line);
    }

    getItem(obj, idx, line) {
      if (obj.t === 'object' && obj.getItem) return obj.getItem(idx, line);
      switch (obj.t) {
        case 'list': case 'tuple': return obj.v[this.listIndex(obj, idx, line)];
        case 'str': case 'bytes': {
          if (idx.t !== 'int') raise('TypeError', `string indices must be integers, not '${typeName(idx)}'`, idx.t === 'str' ? 'Διαβάζεις κείμενο σαν να ήταν λεξικό. Αν είναι JSON, μετάτρεψέ το πρώτα με json.loads(…).' : '', line);
          let i = idx.v;
          if (i < 0) i += obj.v.length;
          if (i < 0 || i >= obj.v.length) raise('IndexError', 'string index out of range', '', line);
          return obj.t === 'str' ? S(obj.v[i]) : I(obj.v.charCodeAt(i));
        }
        case 'dict': {
          const p = obj.v.get(keyOf(idx, line));
          if (!p) {
            const keys = [...obj.v.values()].map(x => pyRepr(x[0])).join(', ');
            raise('KeyError', pyRepr(idx), `Το λεξικό δεν έχει το κλειδί ${pyRepr(idx)}. Έχει: ${keys || 'κανένα'}. Για ασφαλή ανάγνωση χρησιμοποίησε .get(${pyRepr(idx)}), που επιστρέφει None αν λείπει.`, line);
          }
          return p[1];
        }
        case 'range': { const n = numOf(idx); return I(obj.start + n * obj.step); }
      }
      return raise('TypeError', `'${typeName(obj)}' object is not subscriptable`, obj.t === 'NoneType' ? 'Η τιμή είναι None. Μήπως κάποια συνάρτηση δεν επέστρεψε τίποτα;' : '', line);
    }

    getAttr(obj, name, line) {
      if (obj.t === 'module') {
        if (Object.prototype.hasOwnProperty.call(obj.attrs, name)) return obj.attrs[name];
        if (MODULE_NAMES.includes(obj.name + '.' + name)) return this.module(obj.name + '.' + name, line);
        return raise('AttributeError', `module '${obj.name}' has no attribute '${name}'`, `Το ${obj.name} δεν έχει «${name}» σε αυτή την εκπαιδευτική έκδοση. Έλεγξε την ορθογραφία.`, line);
      }
      if (obj.t === 'object') {
        const v = obj.attr(name, line);
        if (v !== undefined) return v;
        return raise('AttributeError', `'${obj.cls}' object has no attribute '${name}'`, obj.cls === 'MQTTMessage' && name === 'payload_str' ? 'Το κείμενο του μηνύματος παίρνεται με msg.payload.decode().' : '', line);
      }
      if (obj.t === 'exception' && name === 'args') return T([S(obj.msg)]);
      const table = METHODS[obj.t];
      if (table && table[name]) return { t: 'method', name: `${obj.t}.${name}`, self: obj, fn: table[name] };
      const hint = obj.t === 'str' && name === 'decode' ? 'Το κείμενο είναι ήδη str. Το .decode() χρειάζεται μόνο για bytes (π.χ. msg.payload).'
        : obj.t === 'bytes' && ['split', 'upper', 'lower', 'strip'].includes(name) ? 'Τα bytes μετατρέπονται σε κείμενο με .decode() πρώτα.'
          : obj.t === 'dict' && name === 'has_key' ? 'Για να δεις αν υπάρχει κλειδί γράψε: if "κλειδί" in λεξικό:'
            : obj.t === 'NoneType' ? 'Η τιμή είναι None (τίποτα). Μήπως η συνάρτηση που την έδωσε δεν έκανε return;' : '';
      return raise('AttributeError', `'${typeName(obj)}' object has no attribute '${name}'`, hint, line);
    }

    *callValue(fn, args, kw, line, fnExpr) {
      switch (fn.t) {
        case 'function': return yield* this.callUser(fn, args, kw, line);
        case 'builtin': case 'method': {
          let r = fn.t === 'method' ? fn.fn(this, fn.self, args, kw, line) : fn.fn(this, args, kw, line);
          if (r && r.__gen) r = yield* r.__gen;
          return r || NONE;
        }
        case 'type': {
          const ctor = TYPE_CTORS[fn.name];
          if (ctor) { let r = ctor(this, args, kw, line); if (r && r.__gen) r = yield* r.__gen; return r; }
          if (EXC_PARENT[fn.name] !== undefined) return { t: 'exception', cls: fn.name, msg: args.length ? pyStr(args[0]) : '' };
          break;
        }
      }
      const what = fnExpr ? exprToString(fnExpr) : pyRepr(fn);
      return raise('TypeError', `'${typeName(fn)}' object is not callable`, fn.t === 'str' || isNum(fn) ? `Το «${what}» είναι τιμή, όχι συνάρτηση. Μήπως έδωσες σε μια μεταβλητή το ίδιο όνομα με μια συνάρτηση;` : '', line);
    }

    *callUser(fn, args, kw, line) {
      const node = fn.node;
      if (this.frames.length > 40) throw new CodeError('RecursionError: maximum recursion depth exceeded', line, 'Μια συνάρτηση καλεί τον εαυτό της (ή η μία την άλλη) χωρίς τέλος.');
      const n = node.params.length;
      const required = node.params.filter(p => !p.def).length;
      if (args.length > n) raise('TypeError', `${node.name}() takes ${n} positional argument${n === 1 ? '' : 's'} but ${args.length} ${args.length === 1 ? 'was' : 'were'} given`,
        this.callbackHint(node.name, n, args.length) || `Η ${node.name}() ορίστηκε με ${n} παραμέτρους, αλλά την καλείς με ${args.length}.`, line);
      const fr = { fn: node, locals: new Map(), globalNames: new Set() };
      node.params.forEach((p, i) => {
        let v = i < args.length ? args[i] : (Object.prototype.hasOwnProperty.call(kw, p.name) ? kw[p.name] : fn.defaults[i]);
        if (!v) raise('TypeError', `${node.name}() missing ${required - Math.min(args.length, required)} required positional argument${required - args.length === 1 ? '' : 's'}: '${p.name}'`,
          this.callbackHint(node.name, n, args.length) || `Η ${node.name}() θέλει τιμή για την παράμετρο «${p.name}».`, line);
        fr.locals.set(p.name, this.mkVar(p.name, v, node.line, 'local'));
      });
      for (const k of Object.keys(kw)) if (!node.params.some(p => p.name === k)) raise('TypeError', `${node.name}() got an unexpected keyword argument '${k}'`, '', line);
      this.frames.push(fr);
      try {
        const r = yield* this.execList(node.body, fr);
        if (r && r.signal === 'return') return r.value;
        if (r && (r.signal === 'break' || r.signal === 'continue')) throw new CodeError(`SyntaxError: '${r.signal}' outside loop`, r.line);
        return NONE;
      } finally {
        this.frames.pop();
      }
    }

    callbackHint(name, declared, given) {
      if (/on_connect/.test(name) && given === 5) return 'Με mqtt.CallbackAPIVersion.VERSION2 το on_connect δέχεται 5 παραμέτρους: def on_connect(client, userdata, flags, reason_code, properties):';
      if (/on_message/.test(name) && given === 3) return 'Το on_message δέχεται 3 παραμέτρους: def on_message(client, userdata, msg):';
      return '';
    }

    module(path, line) {
      this.mods = this.mods || {};
      if (this.mods[path]) return this.mods[path];
      const make = MODULES[path];
      if (!MODULE_NAMES.includes(path) && make) MODULE_NAMES.push(path);
      if (!make) {
        const list = Object.keys(MODULES).filter(k => !k.startsWith('paho') || k === 'paho.mqtt.client').join(', ');
        const hint = `Διαθέσιμα modules σε αυτή την εκπαιδευτική έκδοση: ${list}.`;
        raise('ModuleNotFoundError', `No module named '${path}'`, hint, line);
      }
      const mod = { t: 'module', name: path, attrs: make(this) };
      this.mods[path] = mod;
      return mod;
    }

    // ---------------------------------------------------------- paho: εξυπηρέτηση client
    *serviceClient(c, line) {
      const net = this.board.net;
      if (!net) return;
      // Αυτόματη επανασύνδεση (όπως κάνει το paho μέσα σε loop_forever / loop_start).
      if (c.wantConnected && !c.connecting && !net.connected('device')) {
        if (c.wasConnected) {
          c.wasConnected = false;
          c.events.push({ type: 'disconnect', rc: 7 });
          c.retryAt = this.board.micros + 1e6;
        } else if (this.board.micros >= (c.retryAt || 0)) {
          c.retryAt = this.board.micros + 2e6;
          this.doConnect(c, line);
        }
      }
      while (c.events.length) {
        const ev = c.events.shift();
        if (ev.type === 'connect') {
          if (ev.rc === 0) c.wasConnected = true;
          const h = c.handlers.on_connect;
          if (h) {
            const rcObj = reasonCode(ev.rc);
            const args = c.v2 ? [c.obj, NONE, mkDict([]), rcObj, NONE] : [c.obj, NONE, mkDict([]), I(ev.rc)];
            yield* this.callValue(h, args, {}, line);
          }
        } else if (ev.type === 'disconnect') {
          const h = c.handlers.on_disconnect;
          if (h) {
            const args = c.v2 ? [c.obj, NONE, mkDict([]), reasonCode(ev.rc), NONE] : [c.obj, NONE, I(ev.rc)];
            yield* this.callValue(h, args, {}, line);
          }
        }
      }
      for (;;) {
        const m = net.readNext('device');
        if (!m) break;
        const h = c.handlers.on_message;
        if (!h) continue;
        const msg = makeMessage(m);
        yield* this.callValue(h, [c.obj, NONE, msg], {}, line);
      }
    }

    doConnect(c, line) {
      const net = this.board.net;
      const r = net.connect('device', {
        clientId: c.clientId, port: c.port, host: c.host, tls: !!c.tls, verify: c.tls ? !c.insecure : false, ca: c.tls ? c.tls.ca : null,
        username: c.user, password: c.pass
      });
      c.connecting = false;
      if (r.ok) c.events.push({ type: 'connect', rc: 0 });
      else if (r.code === 'not-authorised' || r.code === 'bad-credentials') c.events.push({ type: 'connect', rc: r.code === 'not-authorised' ? 5 : 4, message: r.message });
      return r;
    }
  }

  function reasonCode(rc) {
    const names = { 0: 'Success', 4: 'Bad user name or password', 5: 'Not authorized', 7: 'Unspecified error' };
    const o = {
      t: 'object', cls: 'ReasonCode', value: rc,
      attr(n) { if (n === 'is_failure') return B(rc !== 0); if (n === 'value') return I(rc); return undefined; },
      repr: () => `ReasonCode(Connack, '${names[rc] || rc}')`, str: () => names[rc] || String(rc)
    };
    return o;
  }

  function makeMessage(m) {
    return {
      t: 'object', cls: 'MQTTMessage',
      attr(n) {
        if (n === 'topic') return S(m.topic);
        if (n === 'payload') return BY(m.payload);
        if (n === 'retain') return B(m.retained);
        if (n === 'qos') return I(m.qos || 0);
        return undefined;
      },
      short: () => `MQTTMessage(${m.topic})`,
      repr: () => '<paho.mqtt.client.MQTTMessage object>'
    };
  }

  function toCodeError(e) {
    return new CodeError(`${e.cls}: ${e.msg}`, e.line, e.hint);
  }

  // ================================================================== Ενσωματωμένα

  function need(name, args, min, max, line, usage) {
    if (args.length < min || args.length > max) {
      const exp = min === max ? `${min}` : `${min} έως ${max}`;
      raise('TypeError', `${name}() takes ${min === max ? 'exactly ' + min : 'from ' + min + ' to ' + max} argument${max === 1 ? '' : 's'} (${args.length} given)`, `Το ${name}() θέλει ${exp} ορίσματα.${usage ? ' Παράδειγμα: ' + usage : ''}`, line);
    }
  }
  const builtin = (name, fn) => ({ t: 'builtin', name, fn });
  const toNumber = (v, what, line) => { if (!isNum(v)) raise('TypeError', `${what} must be a real number, not ${typeName(v)}`, `Θέλει αριθμό, αλλά πήρε ${gr(v)}.`, line); return numOf(v); };

  function roundHalfEven(x) {
    const r = Math.round(x);
    return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
  }

  const TYPE_CTORS = {
    int(m, args, kw, line) {
      if (!args.length) return I(0);
      const v = args[0];
      if (v.t === 'int') return v;
      if (v.t === 'bool') return I(v.v ? 1 : 0);
      if (v.t === 'float') {
        if (!Number.isFinite(v.v)) raise('ValueError', 'cannot convert float NaN to integer', 'Η τιμή είναι nan (π.χ. χαλασμένος αισθητήρας). Έλεγξε πρώτα με math.isnan(x).', line);
        return I(Math.trunc(v.v));
      }
      if (v.t === 'str' || v.t === 'bytes') {
        const s = v.v.trim();
        if (/^[+-]?\d+$/.test(s.replace(/_/g, ''))) return I(parseInt(s.replace(/_/g, ''), 10));
        raise('ValueError', `invalid literal for int() with base 10: ${pyRepr(v.t === 'bytes' ? S(v.v) : v)}`,
          /^[+-]?\d*\.\d+$/.test(s) ? 'Το κείμενο έχει δεκαδικό μέρος. Για δεκαδικό αριθμό χρησιμοποίησε float(…), ή int(float(…)) για να κόψεις τα δεκαδικά.' : 'Το int() μετατρέπει μόνο κείμενο που είναι ακέραιος αριθμός, π.χ. "42".', line);
      }
      return raise('TypeError', `int() argument must be a string, a bytes-like object or a real number, not '${typeName(v)}'`, '', line);
    },
    float(m, args, kw, line) {
      if (!args.length) return F(0);
      const v = args[0];
      if (isNum(v)) return F(numOf(v));
      if (v.t === 'str' || v.t === 'bytes') {
        const s = v.v.trim().toLowerCase();
        if (s === 'nan') return F(NaN);
        if (s === 'inf' || s === 'infinity') return F(Infinity);
        if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(s)) return F(Number(s));
        raise('ValueError', `could not convert string to float: ${pyRepr(S(v.v))}`, v.v.includes(',') ? 'Στην Python η υποδιαστολή είναι τελεία: 22.5, όχι 22,5.' : 'Το κείμενο δεν είναι αριθμός.', line);
      }
      return raise('TypeError', `float() argument must be a string or a real number, not '${typeName(v)}'`, v.t === 'dict' ? 'Μήπως ήθελες μια τιμή του λεξικού, π.χ. float(data["temp"]);' : '', line);
    },
    str(m, args) { return S(args.length ? pyStr(args[0]) : ''); },
    bool(m, args) { return B(args.length ? truthy(args[0]) : false); },
    list(m, args, kw, line) { return { __gen: (function* () { return L(args.length ? yield* m.iterate(args[0], line) : []); })() }; },
    tuple(m, args, kw, line) { return { __gen: (function* () { return T(args.length ? yield* m.iterate(args[0], line) : []); })() }; },
    dict(m, args, kw, line) {
      const pairs = Object.entries(kw).map(([k, v]) => [S(k), v]);
      if (args.length && args[0].t === 'dict') return mkDict([...args[0].v.values()].concat(pairs), line);
      return mkDict(pairs, line);
    }
  };

  function makeBuiltins(m) {
    const b = {};
    b.print = builtin('print', (m, args, kw, line) => {
      const sep = kw.sep ? pyStr(kw.sep) : ' ';
      const end = kw.end ? pyStr(kw.end) : '\n';
      const text = args.map(pyStr).join(sep);
      const parts = (text + (end === '\n' ? '' : end)).split('\n');
      parts.forEach((part, i) => {
        const last = i === parts.length - 1;
        if (last && end !== '\n') { if (part) m.board.serialWrite(part, false, line); return; }
        m.board.serialWrite(part, true, line);
      });
      m.board.advanceMicros(50);
      return NONE;
    });
    b.len = builtin('len', (m, args, kw, line) => {
      need('len', args, 1, 1, line, 'len(λίστα)');
      const v = args[0];
      if (v.t === 'str' || v.t === 'bytes' || v.t === 'list' || v.t === 'tuple') return I(v.v.length);
      if (v.t === 'dict') return I(v.v.size);
      if (v.t === 'range') return I(rangeLen(v));
      return raise('TypeError', `object of type '${typeName(v)}' has no len()`, isNum(v) ? 'Οι αριθμοί δεν έχουν μήκος. Μήπως ήθελες len(str(x));' : '', line);
    });
    b.range = builtin('range', (m, args, kw, line) => {
      need('range', args, 1, 3, line, 'range(5) ή range(1, 10)');
      const n = args.map(a => { if (a.t !== 'int' && a.t !== 'bool') raise('TypeError', `'${typeName(a)}' object cannot be interpreted as an integer`, 'Το range θέλει ακέραιους. Αν έχεις δεκαδικό, γράψε int(x).', line); return numOf(a); });
      const [start, stop, step] = n.length === 1 ? [0, n[0], 1] : [n[0], n[1], n[2] === undefined ? 1 : n[2]];
      if (step === 0) raise('ValueError', 'range() arg 3 must not be zero', '', line);
      return { t: 'range', start, stop, step };
    });
    b.abs = builtin('abs', (m, args, kw, line) => { need('abs', args, 1, 1, line); const x = toNumber(args[0], 'abs()', line); return args[0].t === 'float' ? F(Math.abs(x)) : I(Math.abs(x)); });
    b.round = builtin('round', (m, args, kw, line) => {
      need('round', args, 1, 2, line, 'round(x, 1)');
      const x = toNumber(args[0], 'round()', line);
      if (args.length === 1 || args[1].t === 'NoneType') {
        if (!Number.isFinite(x)) raise('ValueError', 'cannot convert float NaN to integer', '', line);
        return I(roundHalfEven(x));
      }
      const d = numOf(args[1]);
      const k = Math.pow(10, d);
      const r = Math.round((x + Math.sign(x) * Number.EPSILON) * k) / k;
      return args[0].t === 'int' ? I(r) : F(r);
    });
    const minmax = (name, pick) => builtin(name, (m, args, kw, line) => ({
      __gen: (function* () {
        const items = args.length === 1 ? yield* m.iterate(args[0], line) : args;
        if (!items.length) {
          if (kw.default) return kw.default;
          raise('ValueError', `${name}() arg is an empty sequence`, `Η λίστα είναι άδεια, οπότε δεν υπάρχει ${name === 'min' ? 'ελάχιστο' : 'μέγιστο'}. Έλεγξε πρώτα if λίστα:`, line);
        }
        let best = items[0];
        for (const x of items.slice(1)) if (compare(pick, x, best, line)) best = x;
        return best;
      })()
    }));
    b.min = minmax('min', '<');
    b.max = minmax('max', '>');
    b.sum = builtin('sum', (m, args, kw, line) => ({
      __gen: (function* () {
        need('sum', args, 1, 2, line, 'sum(λίστα)');
        let acc = args[1] || I(0);
        for (const x of yield* m.iterate(args[0], line)) acc = binop('+', acc, x, line);
        return acc;
      })()
    }));
    b.sorted = builtin('sorted', (m, args, kw, line) => ({
      __gen: (function* () {
        need('sorted', args, 1, 1, line);
        const items = (yield* m.iterate(args[0], line)).slice();
        items.sort((x, y) => (compare('<', x, y, line) ? -1 : compare('<', y, x, line) ? 1 : 0));
        if (kw.reverse && truthy(kw.reverse)) items.reverse();
        return L(items);
      })()
    }));
    b.enumerate = builtin('enumerate', (m, args, kw, line) => ({
      __gen: (function* () {
        const start = args[1] ? numOf(args[1]) : kw.start ? numOf(kw.start) : 0;
        return L((yield* m.iterate(args[0], line)).map((x, i) => T([I(i + start), x])));
      })()
    }));
    b.zip = builtin('zip', (m, args, kw, line) => ({
      __gen: (function* () {
        const lists = [];
        for (const a of args) lists.push(yield* m.iterate(a, line));
        const n = Math.min(...lists.map(x => x.length));
        return L(Array.from({ length: n }, (_, i) => T(lists.map(x => x[i]))));
      })()
    }));
    b.isinstance = builtin('isinstance', (m, args, kw, line) => {
      need('isinstance', args, 2, 2, line, 'isinstance(x, (int, float))');
      const types = args[1].t === 'tuple' ? args[1].v : [args[1]];
      const tn = typeName(args[0]);
      return B(types.some(t => t.t === 'type' && (t.name === tn || (t.name === 'int' && tn === 'bool') || isSubclass(args[0].cls || '', t.name))));
    });
    b.type = builtin('type', (m, args) => TYPE(typeName(args[0])));
    b.repr = builtin('repr', (m, args) => S(pyRepr(args[0])));
    b.input = builtin('input', (m, args, kw, line) => raise('RuntimeError', 'input() is not available', 'Στην προσομοίωση δεν υπάρχει πληκτρολόγιο. Οι τιμές έρχονται από αισθητήρες, κουμπιά ή MQTT.', line));
    b.open = builtin('open', (m, args, kw, line) => raise('OSError', 'open() is not available in this simulation', 'Τα αρχεία δεν υποστηρίζονται σε αυτή την εκπαιδευτική έκδοση. Για αποθήκευση δεδομένων χρησιμοποίησε SQLite (import sqlite3).', line));
    for (const t of ['int', 'float', 'str', 'bool', 'list', 'dict', 'tuple']) b[t] = TYPE(t);
    b.__name__ = S('__main__');
    for (const e of Object.keys(EXC_PARENT)) if (!NOT_BUILTIN.has(e)) b[e] = TYPE(e);
    return b;
  }

  // ---------------------------------------------------------- μέθοδοι τύπων
  const strArg = (v, what, line) => { if (v.t !== 'str') raise('TypeError', `${what} must be str, not ${typeName(v)}`, `Θέλει κείμενο, αλλά πήρε ${gr(v)}.`, line); return v.v; };
  const METHODS = {
    str: {
      upper: (m, s) => S(s.v.toUpperCase()),
      lower: (m, s) => S(s.v.toLowerCase()),
      strip: (m, s, a) => S(a.length ? s.v.replace(new RegExp(`^[${a[0].v.replace(/[\]\\^-]/g, '\\$&')}]+|[${a[0].v.replace(/[\]\\^-]/g, '\\$&')}]+$`, 'g'), '') : s.v.trim()),
      split: (m, s, a, kw, line) => {
        const sep = a.length && a[0].t !== 'NoneType' ? strArg(a[0], 'sep', line) : null;
        if (sep === null) return L(s.v.trim().split(/\s+/).filter(Boolean).map(S));
        if (sep === '') raise('ValueError', 'empty separator', '', line);
        return L(s.v.split(sep).map(S));
      },
      join: (m, s, a, kw, line) => ({
        __gen: (function* () {
          const items = yield* m.iterate(a[0], line);
          items.forEach(x => { if (x.t !== 'str') raise('TypeError', `sequence item: expected str instance, ${typeName(x)} found`, 'Το join ενώνει μόνο κείμενα. Μετάτρεψε τους αριθμούς με str(x).', line); });
          return S(items.map(x => x.v).join(s.v));
        })()
      }),
      replace: (m, s, a, kw, line) => S(s.v.split(strArg(a[0], 'old', line)).join(strArg(a[1], 'new', line))),
      startswith: (m, s, a, kw, line) => B(s.v.startsWith(strArg(a[0], 'prefix', line))),
      endswith: (m, s, a, kw, line) => B(s.v.endsWith(strArg(a[0], 'suffix', line))),
      find: (m, s, a, kw, line) => I(s.v.indexOf(strArg(a[0], 'sub', line))),
      count: (m, s, a, kw, line) => I(s.v.split(strArg(a[0], 'sub', line)).length - 1),
      isdigit: (m, s) => B(/^\d+$/.test(s.v)),
      encode: (m, s) => BY(unescape(encodeURIComponent(s.v))),
      format: (m, s, a, kw, line) => {
        let i = 0;
        return S(s.v.replace(/\{\{|\}\}|\{([^{}]*)\}/g, (all, inner) => {
          if (all === '{{') return '{';
          if (all === '}}') return '}';
          const [field, spec] = inner.split(':');
          let v;
          if (field === '') v = a[i++];
          else if (/^\d+$/.test(field)) v = a[Number(field)];
          else v = kw[field];
          if (!v) raise('IndexError', 'Replacement index out of range for positional args tuple', 'Το format έχει περισσότερα {} από τιμές.', line);
          return formatSpec(v, spec || '', line);
        }));
      }
    },
    bytes: {
      decode: (m, s) => S(decodeURIComponent(escape(s.v)))
    },
    list: {
      append: (m, l, a, kw, line) => { need('append', a, 1, 1, line); l.v.push(a[0]); m.touch(l, line); return NONE; },
      pop: (m, l, a, kw, line) => {
        if (!l.v.length) raise('IndexError', 'pop from empty list', 'Η λίστα είναι άδεια.', line);
        let i = a.length ? numOf(a[0]) : l.v.length - 1;
        if (i < 0) i += l.v.length;
        if (i < 0 || i >= l.v.length) raise('IndexError', 'pop index out of range', '', line);
        const v = l.v.splice(i, 1)[0];
        m.touch(l, line);
        return v;
      },
      insert: (m, l, a, kw, line) => { l.v.splice(numOf(a[0]), 0, a[1]); m.touch(l, line); return NONE; },
      remove: (m, l, a, kw, line) => {
        const i = l.v.findIndex(x => pyEq(x, a[0]));
        if (i < 0) raise('ValueError', 'list.remove(x): x not in list', 'Η τιμή δεν υπάρχει στη λίστα. Έλεγξε πρώτα με if x in λίστα:', line);
        l.v.splice(i, 1);
        m.touch(l, line);
        return NONE;
      },
      index: (m, l, a, kw, line) => { const i = l.v.findIndex(x => pyEq(x, a[0])); if (i < 0) raise('ValueError', `${pyRepr(a[0])} is not in list`, '', line); return I(i); },
      count: (m, l, a) => I(l.v.filter(x => pyEq(x, a[0])).length),
      clear: (m, l, a, kw, line) => { l.v.length = 0; m.touch(l, line); return NONE; },
      extend: (m, l, a, kw, line) => ({ __gen: (function* () { l.v.push(...(yield* m.iterate(a[0], line))); m.touch(l, line); return NONE; })() }),
      sort: (m, l, a, kw, line) => { l.v.sort((x, y) => (compare('<', x, y, line) ? -1 : compare('<', y, x, line) ? 1 : 0)); if (kw.reverse && truthy(kw.reverse)) l.v.reverse(); m.touch(l, line); return NONE; },
      reverse: (m, l, a, kw, line) => { l.v.reverse(); m.touch(l, line); return NONE; },
      copy: (m, l) => L(l.v.slice())
    },
    dict: {
      get: (m, d, a, kw, line) => { need('get', a, 1, 2, line, 'data.get("temp")'); const p = d.v.get(keyOf(a[0], line)); return p ? p[1] : (a[1] || NONE); },
      keys: (m, d) => L([...d.v.values()].map(p => p[0])),
      values: (m, d) => L([...d.v.values()].map(p => p[1])),
      items: (m, d) => L([...d.v.values()].map(p => T([p[0], p[1]]))),
      pop: (m, d, a, kw, line) => {
        const k = keyOf(a[0], line);
        const p = d.v.get(k);
        if (!p) { if (a.length > 1) return a[1]; raise('KeyError', pyRepr(a[0]), '', line); }
        d.v.delete(k);
        m.touch(d, line);
        return p[1];
      },
      update: (m, d, a, kw, line) => { if (a[0] && a[0].t === 'dict') for (const [k, p] of a[0].v) d.v.set(k, p); for (const [k, v] of Object.entries(kw)) d.v.set(keyOf(S(k)), [S(k), v]); m.touch(d, line); return NONE; },
      setdefault: (m, d, a, kw, line) => { const k = keyOf(a[0], line); if (!d.v.has(k)) { d.v.set(k, [a[0], a[1] || NONE]); m.touch(d, line); } return d.v.get(k)[1]; },
      copy: (m, d) => ({ t: 'dict', v: new Map(d.v) })
    }
  };
  METHODS.tuple = { index: METHODS.list.index, count: METHODS.list.count };

  // ---------------------------------------------------------- modules

  function nowSeconds(m) { return EPOCH + m.board.micros / 1e6; }
  function localParts(sec) {
    const d = new Date((sec + TZ_OFFSET) * 1000);
    return { Y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes(), S: d.getUTCSeconds(), w: (d.getUTCDay() + 6) % 7, us: Math.floor(((sec % 1) + 1) % 1 * 1e6) };
  }
  function strftime(fmt, p) {
    const z = (n, w = 2) => String(n).padStart(w, '0');
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return fmt.replace(/%([YmdHMSAaj%])/g, (_, c) => ({ Y: p.Y, m: z(p.m), d: z(p.d), H: z(p.H), M: z(p.M), S: z(p.S), A: DAYS[p.w], a: DAYS[p.w].slice(0, 3), '%': '%', j: '' }[c]));
  }
  function structTime(p) {
    return {
      t: 'object', cls: 'struct_time',
      attr(n) { const map = { tm_year: p.Y, tm_mon: p.m, tm_mday: p.d, tm_hour: p.H, tm_min: p.M, tm_sec: p.S, tm_wday: p.w }; return n in map ? I(map[n]) : undefined; },
      repr: () => `time.struct_time(tm_year=${p.Y}, tm_mon=${p.m}, tm_mday=${p.d}, tm_hour=${p.H}, tm_min=${p.M}, tm_sec=${p.S})`
    };
  }
  function dtObject(sec) {
    const p = localParts(sec);
    const o = {
      t: 'object', cls: 'datetime', sec,
      attr(n) {
        const map = { year: p.Y, month: p.m, day: p.d, hour: p.H, minute: p.M, second: p.S };
        if (n in map) return I(map[n]);
        if (n === 'strftime') return builtin('strftime', (m, a, kw, line) => S(strftime(strArg(a[0], 'format', line), p)));
        if (n === 'isoformat') return builtin('isoformat', () => S(`${p.Y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T${String(p.H).padStart(2, '0')}:${String(p.M).padStart(2, '0')}:${String(p.S).padStart(2, '0')}`));
        if (n === 'timestamp') return builtin('timestamp', () => F(sec));
        if (n === 'weekday') return builtin('weekday', () => I(p.w));
        return undefined;
      },
      str: () => strftime('%Y-%m-%d %H:%M:%S', p),
      repr: () => `datetime.datetime(${p.Y}, ${p.m}, ${p.d}, ${p.H}, ${p.M}, ${p.S})`
    };
    return o;
  }

  function sleepFn(name) {
    return builtin(name, (m, args, kw, line) => {
      need(name, args, 1, 1, line, 'time.sleep(1)');
      const s = toNumber(args[0], 'sleep() argument', line);
      if (s < 0) raise('ValueError', 'sleep length must be non-negative', '', line);
      return { __gen: (function* () { yield* m.wait(s * 1000, line); return NONE; })() };
    });
  }

  const MODULES = {
    time: m => ({
      sleep: sleepFn('sleep'),
      time: builtin('time', () => F(nowSeconds(m))),
      monotonic: builtin('monotonic', () => F(m.board.micros / 1e6)),
      localtime: builtin('localtime', () => structTime(localParts(nowSeconds(m)))),
      strftime: builtin('strftime', (m2, a, kw, line) => S(strftime(strArg(a[0], 'format', line), localParts(nowSeconds(m)))))
    }),
    json: m => ({
      loads: builtin('loads', (m2, a, kw, line) => {
        need('loads', a, 1, 1, line, 'json.loads(text)');
        if (a[0].t !== 'str' && a[0].t !== 'bytes') raise('TypeError', `the JSON object must be str, bytes or bytearray, not ${typeName(a[0])}`, a[0].t === 'dict' ? 'Η τιμή είναι ήδη λεξικό, δεν χρειάζεται json.loads.' : '', line);
        return jsonLoads(a[0].t === 'bytes' ? decodeURIComponent(escape(a[0].v)) : a[0].v, line);
      }),
      dumps: builtin('dumps', (m2, a, kw, line) => {
        need('dumps', a, 1, 1, line, 'json.dumps(data)');
        return S(jsonDumps(a[0], { indent: kw.indent && kw.indent.t !== 'NoneType' ? numOf(kw.indent) : null, ensure_ascii: kw.ensure_ascii ? truthy(kw.ensure_ascii) : true }, line));
      }),
      JSONDecodeError: TYPE('JSONDecodeError')
    }),
    random: m => {
      const next = () => { m.rand = (m.rand * 1103515245 + 12345) % 2147483648; return m.rand / 2147483648; };
      return {
        random: builtin('random', () => F(next())),
        randint: builtin('randint', (m2, a, kw, line) => { need('randint', a, 2, 2, line); const lo = numOf(a[0]); const hi = numOf(a[1]); return I(lo + Math.floor(next() * (hi - lo + 1))); }),
        uniform: builtin('uniform', (m2, a) => { const lo = numOf(a[0]); const hi = numOf(a[1]); return F(lo + next() * (hi - lo)); }),
        choice: builtin('choice', (m2, a, kw, line) => { if (!a[0].v.length) raise('IndexError', 'Cannot choose from an empty sequence', '', line); return a[0].v[Math.floor(next() * a[0].v.length)]; }),
        seed: builtin('seed', (m2, a) => { m.rand = a.length ? Math.abs(numOf(a[0])) % 2147483648 : 42; return NONE; })
      };
    },
    math: () => ({
      sqrt: builtin('sqrt', (m, a, kw, line) => { const x = toNumber(a[0], 'sqrt()', line); if (x < 0) raise('ValueError', 'math domain error', '', line); return F(Math.sqrt(x)); }),
      floor: builtin('floor', (m, a, kw, line) => I(Math.floor(toNumber(a[0], 'floor()', line)))),
      ceil: builtin('ceil', (m, a, kw, line) => I(Math.ceil(toNumber(a[0], 'ceil()', line)))),
      isnan: builtin('isnan', (m, a, kw, line) => B(Number.isNaN(toNumber(a[0], 'isnan()', line)))),
      pi: F(Math.PI),
      inf: F(Infinity),
      nan: F(NaN)
    }),
    datetime: m => {
      const cls = {
        t: 'object', cls: 'type',
        attr(n) { if (n === 'now') return builtin('now', () => dtObject(nowSeconds(m))); if (n === 'fromtimestamp') return builtin('fromtimestamp', (m2, a) => dtObject(numOf(a[0]))); return undefined; },
        repr: () => "<class 'datetime.datetime'>"
      };
      return { datetime: cls };
    },
    ssl: () => ({ SSLError: TYPE('SSLError'), SSLCertVerificationError: TYPE('SSLCertVerificationError') }),
    socket: () => ({ gaierror: TYPE('gaierror') }),
    signal: m => ({
      pause: builtin('pause', (m2, a, kw, line) => ({ __gen: m.eventLoop(line, null) }))
    }),
    gpiozero: m => ({
      LED: builtin('LED', (m2, a, kw, line) => makeLED(m, a, kw, line)),
      Button: builtin('Button', (m2, a, kw, line) => makeInput(m, 'Button', a, kw, line)),
      MotionSensor: builtin('MotionSensor', (m2, a, kw, line) => makeInput(m, 'MotionSensor', a, kw, line))
    }),
    paho: () => ({}),
    'paho.mqtt': () => ({}),
    'paho.mqtt.client': m => ({
      Client: builtin('Client', (m2, a, kw, line) => makeClient(m, a, kw, line)),
      CallbackAPIVersion: {
        t: 'object', cls: 'CallbackAPIVersion',
        attr(n) { if (n === 'VERSION1' || n === 'VERSION2') return { t: 'object', cls: 'CallbackAPIVersion', version: n === 'VERSION2' ? 2 : 1, attr: () => undefined, repr: () => `<CallbackAPIVersion.${n}: ${n.slice(-1)}>` }; return undefined; },
        repr: () => "<enum 'CallbackAPIVersion'>"
      },
      MQTT_ERR_SUCCESS: I(0)
    }),
    config: m => {
      const out = {};
      for (const [k, v] of Object.entries(m.consts)) out[k] = typeof v === 'number' ? (Number.isInteger(v) ? I(v) : F(v)) : typeof v === 'boolean' ? B(v) : S(v);
      return out;
    }
  };

  // ---------------------------------------------------------- gpiozero
  function pinArg(a, kw, line, cls) {
    const v = a[0] || kw.pin;
    if (!v) raise('TypeError', `${cls}() missing required argument 'pin'`, `Γράψε τον αριθμό του GPIO, π.χ. ${cls}(${cls === 'LED' ? PI_PINS.LED : cls === 'Button' ? PI_PINS.BUTTON : PI_PINS.PIR}).`, line);
    if (v.t === 'str') {
      const mm = /^(?:GPIO|BCM)?(\d+)$/i.exec(v.v);
      if (mm) return Number(mm[1]);
      raise('ValueError', `invalid pin ${pyRepr(v)}`, '', line);
    }
    if (v.t !== 'int') raise('TypeError', `pin must be an int, not ${typeName(v)}`, '', line);
    return v.v;
  }

  function makeLED(m, a, kw, line) {
    const pin = pinArg(a, kw, line, 'LED');
    const b = m.board;
    const P = root.IoTDevice.PINS;
    const wired = pin === PI_PINS.LED;
    if (!wired) b.warnOnce('piled' + pin, line, `Στο GPIO ${pin} δεν είναι συνδεδεμένο LED στο εικονικό Raspberry Pi.`, `Το LED είναι στο GPIO ${PI_PINS.LED}: LED(${PI_PINS.LED}).`);
    let state = 0;
    const set = v => { state = v ? 1 : 0; if (wired) { b.modes[P.LED] = 3; b.digitalWrite(P.LED, state, line); } };
    if (wired) { b.modes[P.LED] = 3; b.outputs[P.LED] = 0; }
    let blinker = null;
    const stopBlink = () => { if (blinker) { m.blinkers = m.blinkers.filter(x => x !== blinker); blinker = null; } };
    const o = {
      t: 'object', cls: 'LED', pin,
      attr(n, ln) {
        switch (n) {
          case 'on': return builtin('on', () => { stopBlink(); set(1); m.touch(o, ln); return NONE; });
          case 'off': return builtin('off', () => { stopBlink(); set(0); m.touch(o, ln); return NONE; });
          case 'toggle': return builtin('toggle', () => { stopBlink(); set(!state); m.touch(o, ln); return NONE; });
          case 'blink': return builtin('blink', (m2, args, kwb) => {
            const on = numOf(args[0] || kwb.on_time || F(1));
            const off = numOf(args[1] || kwb.off_time || F(1));
            stopBlink();
            const start = b.micros;
            blinker = { update() { const per = (on + off) * 1e6; const ph = (b.micros - start) % per; set(ph < on * 1e6); } };
            m.blinkers.push(blinker);
            set(1);
            return NONE;
          });
          case 'close': return builtin('close', () => { stopBlink(); set(0); return NONE; });
          case 'is_lit': case 'is_active': return B(state === 1);
          case 'value': return I(state);
          case 'pin': return S('GPIO' + pin);
        }
        return undefined;
      },
      setattr(n, v, ln) {
        if (n === 'value') { stopBlink(); set(truthy(v)); return; }
        raise('AttributeError', `can't set attribute '${n}'`, n === 'is_lit' ? 'Για να ανάψεις το LED γράψε led.on().' : '', ln);
      },
      short: () => `LED(${pin}) · ${state ? 'αναμμένο' : 'σβηστό'}${blinker ? ' (blink)' : ''}`,
      repr: () => `<gpiozero.LED object on pin GPIO${pin}, is_lit=${state ? 'True' : 'False'}>`,
      str: () => `<gpiozero.LED object on pin GPIO${pin}, is_lit=${state ? 'True' : 'False'}>`
    };
    return o;
  }

  function makeInput(m, cls, a, kw, line) {
    const pin = pinArg(a, kw, line, cls);
    const b = m.board;
    const expected = cls === 'Button' ? PI_PINS.BUTTON : PI_PINS.PIR;
    const key = cls === 'Button' ? 'button' : 'pir';
    const wired = pin === expected;
    if (!wired) b.warnOnce('piin' + pin, line, `Στο GPIO ${pin} δεν είναι συνδεδεμένο ${cls === 'Button' ? 'κουμπί' : 'αισθητήρας κίνησης'}. Η τιμή θα είναι πάντα 0.`, `Το ${cls === 'Button' ? 'κουμπί' : 'PIR'} είναι στο GPIO ${expected}: ${cls}(${expected}).`);
    const read = () => (wired ? !!b.inputs[key] : false);
    const handlers = { on: null, off: null };
    const onName = cls === 'Button' ? 'when_pressed' : 'when_motion';
    const offName = cls === 'Button' ? 'when_released' : 'when_no_motion';
    const isName = cls === 'Button' ? 'is_pressed' : 'motion_detected';
    const waitOn = cls === 'Button' ? 'wait_for_press' : 'wait_for_motion';
    const waitOff = cls === 'Button' ? 'wait_for_release' : 'wait_for_no_motion';
    const o = {
      t: 'object', cls, pin, handlers,
      attr(n, ln) {
        if (n === isName || n === 'is_active') return B(read());
        if (n === 'value') return I(read() ? 1 : 0);
        if (n === onName) return handlers.on || NONE;
        if (n === offName) return handlers.off || NONE;
        if (n === waitOn || n === waitOff) {
          return builtin(n, (m2, args, kwb) => {
            const want = n === waitOn;
            const timeout = args[0] || kwb.timeout;
            const ms = timeout && timeout.t !== 'NoneType' ? numOf(timeout) * 1000 : 1e12;
            return { __gen: (function* () { const ok = yield* m.wait(ms, ln, { until: () => read() === want }); return B(ok); })() };
          });
        }
        if (n === 'pin') return S('GPIO' + pin);
        if (n === 'close') return builtin('close', () => NONE);
        return undefined;
      },
      setattr(n, v, ln) {
        if (n !== onName && n !== offName) raise('AttributeError', `can't set attribute '${n}'`, '', ln);
        if (v.t !== 'function' && v.t !== 'builtin' && v.t !== 'method' && v.t !== 'NoneType') {
          raise('TypeError', 'value must be None or a callable', `Στο ${n} δίνεις το όνομα μιας συνάρτησης χωρίς παρενθέσεις: ${n} = ανάβω, όχι ανάβω().`, ln);
        }
        if (n === onName) handlers.on = v.t === 'NoneType' ? null : v; else handlers.off = v.t === 'NoneType' ? null : v;
        if (!m.watchers.some(w => w.obj === o)) m.watchers.push({ obj: o, read, last: read() });
      },
      short: () => `${cls}(${pin}) · ${cls === 'Button' ? (read() ? 'πατημένο' : 'ελεύθερο') : (read() ? 'κίνηση' : 'ησυχία')}`,
      repr: () => `<gpiozero.${cls} object on pin GPIO${pin}, ${isName}=${read() ? 'True' : 'False'}>`
    };
    return o;
  }

  // ---------------------------------------------------------- paho-mqtt Client
  function makeClient(m, a, kw, line) {
    let v2 = false;
    const first = a[0] || kw.callback_api_version;
    if (first && first.t === 'object' && first.cls === 'CallbackAPIVersion') v2 = first.version === 2;
    else if (first && first.t === 'str') {
      raise('ValueError', 'Unsupported callback API version: version 2.0 added a callback_api_version, see docs/migrations.rst for details',
        'Στο paho-mqtt 2.x το πρώτο όρισμα του Client είναι η έκδοση των callbacks. Γράψε: mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="hub")', line);
    } else {
      m.board.warnOnce('pahov1', line, 'Το mqtt.Client() χωρίς CallbackAPIVersion χρησιμοποιεί την παλιά έκδοση 1 των callbacks (DeprecationWarning στο paho-mqtt 2.x).', 'Προτίμησε mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="…").');
    }
    const cid = kw.client_id ? pyStr(kw.client_id) : (a[1] && a[1].t === 'str' ? a[1].v : 'paho-' + Math.floor(m.board.micros % 9000 + 1000));
    const c = { clientId: cid, v2, mode: 'none', handlers: {}, events: [], user: null, pass: null, tls: null, insecure: false, host: null, port: 1883, wantConnected: false, wasConnected: false };
    const net = () => {
      if (!m.board.net) raise('ConnectionRefusedError', '[Errno 111] Connection refused', 'Σε αυτή την άσκηση δεν υπάρχει broker MQTT.', line);
      return m.board.net;
    };
    const o = {
      t: 'object', cls: 'Client',
      attr(n, ln) {
        if (['on_connect', 'on_message', 'on_disconnect'].includes(n)) return c.handlers[n] || NONE;
        switch (n) {
          case 'username_pw_set': return builtin(n, (m2, args, kwb) => { c.user = pyStr(args[0] || kwb.username); c.pass = args[1] || kwb.password ? pyStr(args[1] || kwb.password) : null; return NONE; });
          case 'tls_set': return builtin(n, (m2, args, kwb) => {
            const ca = kwb.ca_certs || args[0];
            const caName = ca && ca.t === 'str' ? (/home|lab/i.test(ca.v) ? 'Home Lab CA' : ca.v) : 'Public Web CA';
            c.tls = { ca: caName };
            return NONE;
          });
          case 'tls_insecure_set': return builtin(n, (m2, args) => {
            c.insecure = truthy(args[0]);
            if (c.insecure) m.board.warnOnce('pahoinsecure', ln, 'Το tls_insecure_set(True) απενεργοποιεί τον έλεγχο του ονόματος στο πιστοποιητικό.', 'Έτσι ο client δέχεται πιστοποιητικό για οποιοδήποτε όνομα. Άφησέ το False.');
            return NONE;
          });
          case 'connect': return builtin(n, (m2, args, kwb, l2) => {
            const host = args[0] || kwb.host;
            if (!host || host.t !== 'str') raise('TypeError', 'connect() missing required argument: \'host\'', 'Γράψε client.connect("broker.home.lan", 1883).', l2);
            const port = args[1] || kwb.port;
            c.host = host.v;
            c.port = port ? numOf(port) : 1883;
            m.board.advanceMicros(30000);
            if (!BROKER_HOSTS.has(c.host)) raise('gaierror', '[Errno -2] Name or service not known', `Δεν βρέθηκε υπολογιστής με όνομα «${c.host}». Ο broker του σπιτιού είναι το broker.home.lan (ή localhost, αφού τρέχει στο ίδιο Pi).`, l2);
            c.wantConnected = true;
            const r = m.doConnect(c, l2);
            if (!r.ok && r.code !== 'not-authorised' && r.code !== 'bad-credentials') {
              c.wantConnected = false;
              if (r.code === 'bad-cert') raise('SSLCertVerificationError', '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed', r.message + ' Ο client έκανε σωστά που σταμάτησε. Μην απενεργοποιήσεις τον έλεγχο.', l2);
              raise('ConnectionRefusedError', '[Errno 111] Connection refused', r.message, l2);
            }
            return I(0);
          });
          case 'disconnect': return builtin(n, () => { c.wantConnected = false; c.wasConnected = false; net().disconnect('device'); return I(0); });
          case 'reconnect': return builtin(n, (m2, args, kwb, l2) => { m.doConnect(c, l2); return I(0); });
          case 'is_connected': return builtin(n, () => B(!!m.board.net && m.board.net.connected('device')));
          case 'subscribe': return builtin(n, (m2, args, kwb, l2) => {
            const topic = args[0] || kwb.topic;
            if (!topic || topic.t !== 'str') raise('ValueError', 'Invalid topic.', 'Γράψε client.subscribe("home/#").', l2);
            if (!net().connected('device')) return T([I(4), NONE]);
            const r = net().subscribe('device', topic.v);
            if (!r.ok && !r.denied) m.board.warnOnce('psub' + topic.v, l2, r.message, '');
            return T([I(0), I(1)]);
          });
          case 'publish': return builtin(n, (m2, args, kwb, l2) => {
            const topic = args[0] || kwb.topic;
            if (!topic || topic.t !== 'str') raise('ValueError', 'Invalid topic.', '', l2);
            let payload = args[1] || kwb.payload || NONE;
            if (payload.t === 'dict' || payload.t === 'list') raise('TypeError', 'payload must be a string, bytearray, int, float or None.', 'Ένα λεξικό δεν στέλνεται απευθείας. Μετάτρεψέ το σε JSON: client.publish(topic, json.dumps(data)).', l2);
            const text = payload.t === 'NoneType' ? '' : payload.t === 'bytes' ? payload.v : pyStr(payload);
            const retain = truthy(args[3] || kwb.retain || FALSE);
            const qos = numOf(args[2] || kwb.qos || I(0));
            if (!m.board.net || !m.board.net.connected('device')) {
              m.board.warnOnce('ppub-off', l2, 'Έγινε publish χωρίς σύνδεση στον broker. Το μήνυμα χάθηκε.', 'Έλεγξε τη σύνδεση (on_connect) και ότι τρέχει loop_start() ή loop_forever().');
              return msgInfo(4);
            }
            const r = m.board.net.publish('device', topic.v, text, retain, qos);
            if (!r.ok && !r.denied) m.board.warnOnce('ppub' + topic.v, l2, r.message, '');
            return msgInfo(0);
          });
          case 'loop_start': return builtin(n, () => { c.mode = 'thread'; return I(0); });
          case 'loop_stop': return builtin(n, () => { c.mode = 'none'; return I(0); });
          case 'loop': return builtin(n, (m2, args, kwb, l2) => {
            const timeout = args[0] || kwb.timeout;
            const ms = timeout ? numOf(timeout) * 1000 : 1000;
            return {
              __gen: (function* () {
                yield* m.serviceClient(c, l2);
                yield* m.wait(Math.min(ms, 100), l2, { noDispatch: true });
                yield* m.serviceClient(c, l2);
                return I(0);
              })()
            };
          });
          case 'loop_forever': return builtin(n, (m2, args, kwb, l2) => { c.mode = 'forever'; return { __gen: m.eventLoop(l2, c) }; });
        }
        return undefined;
      },
      setattr(n, v, ln) {
        if (!['on_connect', 'on_message', 'on_disconnect'].includes(n)) raise('AttributeError', `'Client' object has no attribute '${n}'`, 'Τα callbacks είναι on_connect, on_message και on_disconnect.', ln);
        if (v.t !== 'function' && v.t !== 'NoneType') raise('TypeError', `${n} must be a function`, `Δίνεις το όνομα της συνάρτησης χωρίς παρενθέσεις: client.${n} = ${n}`, ln);
        c.handlers[n] = v.t === 'NoneType' ? null : v;
      },
      short: () => `Client(${cid}) · ${m.board.net && m.board.net.connected('device') ? 'συνδεδεμένο' : 'αποσυνδεδεμένο'}`,
      repr: () => `<paho.mqtt.client.Client object (${cid})>`
    };
    c.obj = o;
    m.clients.push(c);
    return o;
  }
  function msgInfo(rc) {
    return { t: 'object', cls: 'MQTTMessageInfo', attr(n) { if (n === 'rc') return I(rc); if (n === 'is_published') return builtin('is_published', () => B(rc === 0)); if (n === 'wait_for_publish') return builtin('wait_for_publish', () => NONE); return undefined; }, repr: () => `<MQTTMessageInfo rc=${rc}>` };
  }

  // Για τον πίνακα μεταβλητών και το Serial: σύντομη, αναγνώσιμη μορφή.
  function display(v) {
    if (v.t === 'object' && v.short) return v.short();
    const s = pyRepr(v);
    return s.length > 120 ? s.slice(0, 117) + '…' : s;
  }

  const HIGHLIGHT = {
    keywords: [...KEYWORDS],
    builtins: ['print', 'len', 'range', 'int', 'float', 'str', 'bool', 'list', 'dict', 'tuple', 'round', 'abs', 'min', 'max', 'sum', 'sorted', 'enumerate', 'zip', 'isinstance', 'type', 'repr',
      'time', 'json', 'random', 'math', 'datetime', 'gpiozero', 'LED', 'Button', 'MotionSensor', 'pause', 'sleep', 'mqtt', 'paho', 'config', 'self']
  };

  // Εργαλεία για επεκτάσεις (js/pyweb.js: sqlite3, flask, markupsafe).
  const KIT = { NONE, TRUE, FALSE, B, I, F, S, L, T, BY, TYPE, PyExc, raise, builtin, need, mkDict, keyOf, truthy, isNum, numOf, typeName, pyRepr, pyStr, pyEq, compare, jsonDumps, jsonLoads, formatSpec, EXC_PARENT, NOT_BUILTIN, MODULES, MODULE_NAMES, HIGHLIGHT, toCodeError, CodeError, EPOCH, TZ_OFFSET, IMPORT_HINTS, NAME_HINTS, display };
  root.IoTPy = { tokenize, compile, Machine: PyMachine, display, pyRepr, pyStr, HIGHLIGHT, PI_PINS, jsonLoads, jsonDumps, formatSpec, KIT };
})(typeof window !== 'undefined' ? window : globalThis);
