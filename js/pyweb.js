/*
 * IoT Guardian — επεκτάσεις του interpreter Python για το Raspberry Pi:
 *   sqlite3     μικρή μηχανή SQL (υποσύνολο του SQLite) με commit/rollback και παραμέτρους ?
 *   flask       εικονικός web server: routes, jsonify, request, abort, app.run
 *   markupsafe  escape() για ασφαλή HTML
 * Όλα τρέχουν μέσα στην προσομοίωση: δεν ανοίγει καμία πραγματική θύρα και δεν γράφεται κανένα αρχείο.
 */
(function (root) {
  'use strict';

  const K = root.IoTPy.KIT;
  const { NONE, B, I, F, S, L, T, TYPE, PyExc, raise, builtin, need, mkDict, truthy, isNum, numOf, typeName, pyRepr, pyStr, jsonDumps, jsonLoads, EXC_PARENT, NOT_BUILTIN, MODULES, HIGHLIGHT, IMPORT_HINTS } = K;

  Object.assign(EXC_PARENT, { Error: 'Exception', DatabaseError: 'Error', OperationalError: 'DatabaseError', IntegrityError: 'DatabaseError', ProgrammingError: 'DatabaseError', HTTPException: 'Exception' });
  ['Error', 'DatabaseError', 'OperationalError', 'IntegrityError', 'ProgrammingError', 'HTTPException'].forEach(x => NOT_BUILTIN.add(x));
  HIGHLIGHT.builtins.push('sqlite3', 'Flask', 'jsonify', 'request', 'abort', 'escape', 'app');
  IMPORT_HINTS['flask.escape'] = 'Από το Flask 3 το escape δεν υπάρχει στο flask. Γράψε: from markupsafe import escape';

  // ================================================================== SQL

  const sqlErr = (cls, msg, hint, line) => raise(cls, msg, hint || '', line);

  function sqlTokens(sql, line) {
    const out = [];
    let i = 0;
    let params = 0;
    while (i < sql.length) {
      const c = sql[i];
      const rest = sql.slice(i);
      let m;
      if (/\s/.test(c)) { i++; continue; }
      if (rest.startsWith('--')) { const j = sql.indexOf('\n', i); i = j < 0 ? sql.length : j; continue; }
      if (c === "'") {
        let j = i + 1;
        let v = '';
        for (;;) {
          if (j >= sql.length) sqlErr('OperationalError', `unrecognized token: "${rest.slice(0, 24)}"`, 'Ένα κείμενο σε μονά εισαγωγικά δεν κλείνει. Αν η τιμή ήρθε από μεταβλητή, μην τη βάζεις μέσα στο SQL με f-string: χρησιμοποίησε ? και δώσε την τιμή χωριστά.', line);
          if (sql[j] === "'") { if (sql[j + 1] === "'") { v += "'"; j += 2; continue; } break; }
          v += sql[j++];
        }
        out.push({ k: 'str', v });
        i = j + 1;
        continue;
      }
      if (c === '"' || c === '`') {
        const j = sql.indexOf(c, i + 1);
        if (j < 0) sqlErr('OperationalError', `unrecognized token: "${rest.slice(0, 24)}"`, '', line);
        out.push({ k: 'w', v: sql.slice(i + 1, j), u: sql.slice(i + 1, j).toUpperCase(), quoted: true });
        i = j + 1;
        continue;
      }
      if ((m = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(rest))) { out.push({ k: 'num', v: Number(m[0]), float: /[.eE]/.test(m[0]) }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_][\w]*/.exec(rest))) { out.push({ k: 'w', v: m[0], u: m[0].toUpperCase() }); i += m[0].length; continue; }
      if (c === '?') { out.push({ k: 'param', n: params++ }); i++; continue; }
      const op = ['<>', '!=', '==', '<=', '>=', '||', '=', '<', '>', '(', ')', ',', '*', '+', '-', '/', '%', ';', '.'].find(o => rest.startsWith(o));
      if (!op) sqlErr('OperationalError', `unrecognized token: "${c}"`, '', line);
      out.push({ k: 'op', v: op });
      i += op.length;
    }
    out.push({ k: 'eof' });
    out.params = params;
    return out;
  }

  const RESERVED = new Set(['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'CREATE', 'TABLE', 'ORDER', 'BY', 'GROUP', 'LIMIT', 'OFFSET', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'LIKE', 'IN', 'BETWEEN', 'DELETE', 'UPDATE', 'SET', 'DROP', 'AS', 'ASC', 'DESC', 'PRIMARY', 'KEY', 'DEFAULT', 'UNIQUE', 'IF', 'EXISTS']);

  function sqlParse(toks, line) {
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const isW = (u, o = 0) => toks[p + o].k === 'w' && toks[p + o].u === u && !toks[p + o].quoted;
    const isOp = v => peek().k === 'op' && peek().v === v;
    const near = () => {
      const t = peek();
      const txt = t.k === 'eof' ? 'end of input' : t.k === 'str' ? `'${t.v}'` : t.k === 'param' ? '?' : String(t.v);
      return t.k === 'eof' ? 'incomplete input' : `near "${txt}": syntax error`;
    };
    const bad = hint => sqlErr('OperationalError', near(), hint || 'Η εντολή SQL δεν είναι σωστή σε αυτό το σημείο. Έλεγξε κόμματα, παρενθέσεις και εισαγωγικά.', line);
    const expectW = (u, hint) => { if (!isW(u)) bad(hint); next(); };
    const expectOp = (v, hint) => { if (!isOp(v)) bad(hint); next(); };
    const ident = () => {
      const t = peek();
      if (t.k !== 'w' || (!t.quoted && RESERVED.has(t.u))) bad();
      next();
      return t.v;
    };

    function expr() { return orE(); }
    function orE() { let a = andE(); while (isW('OR')) { next(); a = { k: 'or', a, b: andE() }; } return a; }
    function andE() { let a = notE(); while (isW('AND')) { next(); a = { k: 'and', a, b: notE() }; } return a; }
    function notE() { if (isW('NOT')) { next(); return { k: 'not', a: notE() }; } return cmpE(); }
    function cmpE() {
      let a = catE();
      for (;;) {
        if (peek().k === 'op' && ['=', '==', '!=', '<>', '<', '>', '<=', '>='].includes(peek().v)) { const op = next().v; a = { k: 'cmp', op: op === '==' ? '=' : op === '<>' ? '!=' : op, a, b: catE() }; continue; }
        if (isW('IS')) { next(); const neg = isW('NOT') ? (next(), true) : false; expectW('NULL'); a = { k: 'isnull', a, neg }; continue; }
        let neg = false;
        if (isW('NOT') && (isW('LIKE', 1) || isW('IN', 1) || isW('BETWEEN', 1))) { next(); neg = true; }
        if (isW('LIKE')) { next(); a = { k: 'like', a, b: catE(), neg }; continue; }
        if (isW('BETWEEN')) { next(); const lo = catE(); expectW('AND'); a = { k: 'between', a, lo, hi: catE(), neg }; continue; }
        if (isW('IN')) {
          next();
          expectOp('(');
          const items = [expr()];
          while (isOp(',')) { next(); items.push(expr()); }
          expectOp(')');
          a = { k: 'in', a, items, neg };
          continue;
        }
        return a;
      }
    }
    function catE() { let a = addE(); while (isOp('||')) { next(); a = { k: 'bin', op: '||', a, b: addE() }; } return a; }
    function addE() { let a = mulE(); while (isOp('+') || isOp('-')) { const op = next().v; a = { k: 'bin', op, a, b: mulE() }; } return a; }
    function mulE() { let a = unE(); while (isOp('*') || isOp('/') || isOp('%')) { const op = next().v; a = { k: 'bin', op, a, b: unE() }; } return a; }
    function unE() { if (isOp('-')) { next(); return { k: 'neg', a: unE() }; } if (isOp('+')) { next(); return unE(); } return prim(); }
    function prim() {
      const t = peek();
      if (t.k === 'num') { next(); return { k: 'lit', v: t.float ? F(t.v) : I(t.v) }; }
      if (t.k === 'str') { next(); return { k: 'lit', v: S(t.v) }; }
      if (t.k === 'param') { next(); return { k: 'param', n: t.n }; }
      if (isOp('(')) { next(); const e = expr(); expectOp(')'); return e; }
      if (isW('NULL')) { next(); return { k: 'lit', v: NONE }; }
      if (t.k === 'w' && !(RESERVED.has(t.u) && !t.quoted)) {
        next();
        if (isOp('(')) {
          next();
          const fn = t.u;
          if (isOp('*')) { next(); expectOp(')'); return { k: 'fn', fn, star: true, args: [] }; }
          const args = [];
          if (!isOp(')')) { args.push(expr()); while (isOp(',')) { next(); args.push(expr()); } }
          expectOp(')');
          if (!FUNCS.has(fn)) sqlErr('OperationalError', `no such function: ${t.v}`, `Υποστηρίζονται: ${[...FUNCS].join(', ')}.`, line);
          return { k: 'fn', fn, args };
        }
        if (isOp('.')) { next(); return { k: 'col', name: ident(), table: t.v }; }
        return { k: 'col', name: t.v };
      }
      return bad();
    }

    function statement() {
      if (isW('CREATE')) {
        next();
        expectW('TABLE');
        let ifNot = false;
        if (isW('IF')) { next(); expectW('NOT'); expectW('EXISTS'); ifNot = true; }
        const name = ident();
        expectOp('(');
        const cols = [];
        do {
          if (cols.length) next();
          const c = { name: ident(), type: '', pk: false, auto: false, notnull: false, unique: false, def: null };
          const typeParts = [];
          while (peek().k === 'w' && !RESERVED.has(peek().u)) typeParts.push(next().u);
          if (isOp('(')) { while (!isOp(')')) next(); next(); }
          c.type = typeParts.join(' ');
          for (;;) {
            if (isW('PRIMARY')) { next(); expectW('KEY'); c.pk = true; if (isW('AUTOINCREMENT')) { next(); c.auto = true; } continue; }
            if (isW('NOT')) { next(); expectW('NULL'); c.notnull = true; continue; }
            if (isW('UNIQUE')) { next(); c.unique = true; continue; }
            if (isW('DEFAULT')) { next(); const e = prim(); c.def = e.k === 'lit' ? e.v : NONE; continue; }
            if (isW('AUTOINCREMENT')) { next(); continue; }
            break;
          }
          cols.push(c);
        } while (isOp(','));
        expectOp(')', 'Μετά τη λίστα των στηλών κλείνει η παρένθεση. Οι στήλες χωρίζονται με κόμμα.');
        return { k: 'create', name, ifNot, cols };
      }
      if (isW('DROP')) {
        next(); expectW('TABLE');
        let ifExists = false;
        if (isW('IF')) { next(); expectW('EXISTS'); ifExists = true; }
        return { k: 'drop', name: ident(), ifExists };
      }
      if (isW('INSERT')) {
        next(); expectW('INTO');
        const table = ident();
        let cols = null;
        if (isOp('(')) { next(); cols = [ident()]; while (isOp(',')) { next(); cols.push(ident()); } expectOp(')'); }
        expectW('VALUES', 'Μετά το INSERT INTO πίνακας (στήλες) ακολουθεί VALUES (…).');
        const rows = [];
        do {
          if (rows.length) next();
          expectOp('(');
          const r = [expr()];
          while (isOp(',')) { next(); r.push(expr()); }
          expectOp(')');
          rows.push(r);
        } while (isOp(','));
        return { k: 'insert', table, cols, rows };
      }
      if (isW('SELECT')) {
        next();
        const items = [];
        do {
          if (items.length) next();
          if (isOp('*')) { next(); items.push({ star: true }); continue; }
          const e = expr();
          let alias = null;
          if (isW('AS')) { next(); alias = ident(); } else if (peek().k === 'w' && !RESERVED.has(peek().u)) alias = next().v;
          items.push({ e, alias });
        } while (isOp(','));
        let table = null;
        if (isW('FROM')) { next(); table = ident(); }
        let where = null;
        if (isW('WHERE')) { next(); where = expr(); }
        const groupBy = [];
        if (isW('GROUP')) { next(); expectW('BY'); groupBy.push(expr()); while (isOp(',')) { next(); groupBy.push(expr()); } }
        const orderBy = [];
        if (isW('ORDER')) {
          next(); expectW('BY');
          do {
            if (orderBy.length) next();
            const e = expr();
            let desc = false;
            if (isW('DESC')) { next(); desc = true; } else if (isW('ASC')) next();
            orderBy.push({ e, desc });
          } while (isOp(','));
        }
        let limit = null;
        let offset = null;
        if (isW('LIMIT')) { next(); limit = expr(); if (isW('OFFSET')) { next(); offset = expr(); } }
        return { k: 'select', items, table, where, groupBy, orderBy, limit, offset };
      }
      if (isW('DELETE')) {
        next(); expectW('FROM');
        const table = ident();
        let where = null;
        if (isW('WHERE')) { next(); where = expr(); }
        return { k: 'delete', table, where };
      }
      if (isW('UPDATE')) {
        next();
        const table = ident();
        expectW('SET');
        const sets = [];
        do {
          if (sets.length) next();
          const c = ident();
          expectOp('=');
          sets.push([c, expr()]);
        } while (isOp(','));
        let where = null;
        if (isW('WHERE')) { next(); where = expr(); }
        return { k: 'update', table, sets, where };
      }
      return bad('Υποστηρίζονται οι εντολές CREATE TABLE, INSERT, SELECT, UPDATE, DELETE και DROP TABLE.');
    }

    const st = statement();
    if (isOp(';')) next();
    if (peek().k !== 'eof') {
      if (peek().k === 'w' || peek().k === 'op') {
        // Δεύτερη εντολή μετά το ; (ή περίσσια κείμενα)
        const tail = toks.slice(p).some(t => t.k === 'w' && ['SELECT', 'DROP', 'DELETE', 'INSERT', 'UPDATE', 'CREATE'].includes(t.u));
        if (tail && toks.slice(0, p).some(t => t.k === 'op' && t.v === ';')) sqlErr('ProgrammingError', 'You can only execute one statement at a time.', 'Το execute() τρέχει μία εντολή SQL κάθε φορά.', line);
      }
      bad();
    }
    return st;
  }

  const FUNCS = new Set(['COUNT', 'AVG', 'MIN', 'MAX', 'SUM', 'ROUND', 'LOWER', 'UPPER', 'LENGTH', 'ABS', 'COALESCE', 'IFNULL']);
  const AGG = new Set(['COUNT', 'AVG', 'MIN', 'MAX', 'SUM']);
  const isAggCall = e => e.k === 'fn' && AGG.has(e.fn) && !((e.fn === 'MIN' || e.fn === 'MAX') && e.args.length > 1);
  const hasAgg = e => !!e && typeof e === 'object' && (isAggCall(e) || ['a', 'b', 'lo', 'hi'].some(k => hasAgg(e[k])) || (e.args || []).some(hasAgg) || (e.items || []).some(hasAgg));

  const isNull = v => v.t === 'NoneType';
  function sqlNum(v) {
    if (isNum(v)) return numOf(v);
    if (v.t === 'str') { const n = parseFloat(v.v); return Number.isNaN(n) ? 0 : n; }
    return 0;
  }
  function sqlText(v) {
    if (v.t === 'str') return v.v;
    if (v.t === 'float') return Number.isInteger(v.v) ? v.v.toFixed(1) : String(v.v);
    if (v.t === 'int' || v.t === 'bool') return String(numOf(v));
    return '';
  }
  // NULL → null· αριθμοί < κείμενο (όπως στο SQLite)
  function sqlCmp(a, b) {
    if (isNull(a) || isNull(b)) return null;
    const an = isNum(a);
    const bn = isNum(b);
    if (an && bn) return Math.sign(numOf(a) - numOf(b));
    if (an) return -1;
    if (bn) return 1;
    return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
  }
  const sqlTruth = v => !isNull(v) && (isNum(v) ? numOf(v) !== 0 : sqlNum(v) !== 0);
  const bool3 = x => (x === null ? NONE : I(x ? 1 : 0));

  function evalSql(e, ctx, line) {
    switch (e.k) {
      case 'lit': return e.v;
      case 'param': return ctx.params[e.n];
      case 'col': {
        const key = e.name.toLowerCase();
        if (ctx.alias && ctx.alias.has(key)) return ctx.alias.get(key);
        if (!ctx.row || !ctx.row.vals.has(key)) {
          if (ctx.cols && !ctx.cols.includes(key)) sqlErr('OperationalError', `no such column: ${e.name}`, `Ο πίνακας έχει τις στήλες: ${ctx.cols.join(', ')}. Αν ήθελες κείμενο, βάλ’ το σε μονά εισαγωγικά 'έτσι', ή ακόμα καλύτερα δώσε το ως παράμετρο με ?.`, line);
          return NONE;
        }
        return ctx.row.vals.get(key);
      }
      case 'neg': { const v = evalSql(e.a, ctx, line); return isNull(v) ? NONE : v.t === 'float' ? F(-v.v) : I(-sqlNum(v)); }
      case 'not': { const v = evalSql(e.a, ctx, line); return isNull(v) ? NONE : I(sqlTruth(v) ? 0 : 1); }
      case 'and': {
        const a = evalSql(e.a, ctx, line);
        const b = evalSql(e.b, ctx, line);
        if ((!isNull(a) && !sqlTruth(a)) || (!isNull(b) && !sqlTruth(b))) return I(0);
        return isNull(a) || isNull(b) ? NONE : I(1);
      }
      case 'or': {
        const a = evalSql(e.a, ctx, line);
        const b = evalSql(e.b, ctx, line);
        if ((!isNull(a) && sqlTruth(a)) || (!isNull(b) && sqlTruth(b))) return I(1);
        return isNull(a) || isNull(b) ? NONE : I(0);
      }
      case 'cmp': {
        const c = sqlCmp(evalSql(e.a, ctx, line), evalSql(e.b, ctx, line));
        if (c === null) return NONE;
        return bool3({ '=': c === 0, '!=': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[e.op]);
      }
      case 'isnull': { const n = isNull(evalSql(e.a, ctx, line)); return I(e.neg ? (n ? 0 : 1) : (n ? 1 : 0)); }
      case 'like': {
        const a = evalSql(e.a, ctx, line);
        const b = evalSql(e.b, ctx, line);
        if (isNull(a) || isNull(b)) return NONE;
        const re = new RegExp('^' + sqlText(b).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'is');
        const r = re.test(sqlText(a));
        return I(r !== e.neg ? 1 : 0);
      }
      case 'between': {
        const a = evalSql(e.a, ctx, line);
        const lo = sqlCmp(a, evalSql(e.lo, ctx, line));
        const hi = sqlCmp(a, evalSql(e.hi, ctx, line));
        if (lo === null || hi === null) return NONE;
        const r = lo >= 0 && hi <= 0;
        return I(r !== e.neg ? 1 : 0);
      }
      case 'in': {
        const a = evalSql(e.a, ctx, line);
        if (isNull(a)) return NONE;
        const r = e.items.some(x => sqlCmp(a, evalSql(x, ctx, line)) === 0);
        return I(r !== e.neg ? 1 : 0);
      }
      case 'bin': {
        const a = evalSql(e.a, ctx, line);
        const b = evalSql(e.b, ctx, line);
        if (isNull(a) || isNull(b)) return NONE;
        if (e.op === '||') return S(sqlText(a) + sqlText(b));
        const x = sqlNum(a);
        const y = sqlNum(b);
        const intRes = (a.t === 'int' || a.t === 'bool') && (b.t === 'int' || b.t === 'bool');
        switch (e.op) {
          case '+': return intRes ? I(x + y) : F(x + y);
          case '-': return intRes ? I(x - y) : F(x - y);
          case '*': return intRes ? I(x * y) : F(x * y);
          case '/': if (y === 0) return NONE; return intRes ? I(Math.trunc(x / y)) : F(x / y);
          case '%': if (y === 0) return NONE; return I(Math.trunc(x) % Math.trunc(y));
        }
        break;
      }
      case 'fn': {
        if (isAggCall(e)) {
          if (!ctx.group) sqlErr('OperationalError', `misuse of aggregate function ${e.fn}()`, 'Οι συναρτήσεις COUNT, AVG, MIN, MAX, SUM μπαίνουν στο SELECT, όχι στο WHERE.', line);
          if (e.star) return I(ctx.group.length);
          const vals = ctx.group.map(r => evalSql(e.args[0], Object.assign({}, ctx, { row: r, group: null }), line)).filter(v => !isNull(v));
          switch (e.fn) {
            case 'COUNT': return I(vals.length);
            case 'AVG': return vals.length ? F(vals.reduce((s, v) => s + sqlNum(v), 0) / vals.length) : NONE;
            case 'SUM': {
              if (!vals.length) return NONE;
              const allInt = vals.every(v => v.t === 'int' || v.t === 'bool');
              const sum = vals.reduce((s, v) => s + sqlNum(v), 0);
              return allInt ? I(sum) : F(sum);
            }
            case 'MIN': case 'MAX': {
              if (!vals.length) return NONE;
              return vals.reduce((best, v) => { const c = sqlCmp(v, best); return (e.fn === 'MIN' ? c < 0 : c > 0) ? v : best; });
            }
          }
        }
        const args = e.args.map(a => evalSql(a, ctx, line));
        switch (e.fn) {
          case 'ROUND': {
            if (isNull(args[0])) return NONE;
            const k = Math.pow(10, args[1] ? sqlNum(args[1]) : 0);
            const x = sqlNum(args[0]) * k;
            return F((x < 0 ? -Math.round(-x) : Math.round(x)) / k);
          }
          case 'LOWER': return isNull(args[0]) ? NONE : S(sqlText(args[0]).toLowerCase());
          case 'UPPER': return isNull(args[0]) ? NONE : S(sqlText(args[0]).toUpperCase());
          case 'LENGTH': return isNull(args[0]) ? NONE : I(sqlText(args[0]).length);
          case 'ABS': return isNull(args[0]) ? NONE : args[0].t === 'float' ? F(Math.abs(args[0].v)) : I(Math.abs(sqlNum(args[0])));
          case 'COALESCE': case 'IFNULL': return args.find(v => !isNull(v)) || NONE;
          case 'MIN': case 'MAX': {
            if (args.some(isNull)) return NONE;
            return args.reduce((best, v) => { const c = sqlCmp(v, best); return (e.fn === 'MIN' ? c < 0 : c > 0) ? v : best; });
          }
        }
      }
    }
    return NONE;
  }

  // Τύπος στήλης (affinity) όπως στο SQLite: REAL κάνει το 22 → 22.0, TEXT κάνει τους αριθμούς κείμενο κ.λπ.
  function affinity(type) {
    const t = (type || '').toUpperCase();
    if (t.includes('INT')) return 'INTEGER';
    if (t.includes('CHAR') || t.includes('CLOB') || t.includes('TEXT')) return 'TEXT';
    if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB')) return 'REAL';
    if (!t) return 'BLOB';
    return 'NUMERIC';
  }
  function applyAffinity(col, v) {
    if (isNull(v)) return v;
    const aff = affinity(col.type);
    if (v.t === 'bool') v = I(v.v ? 1 : 0);
    if (aff === 'TEXT' && isNum(v)) return S(sqlText(v));
    if (aff === 'REAL') {
      if (v.t === 'int') return F(v.v);
      if (v.t === 'str' && /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(v.v)) return F(Number(v.v));
    }
    if (aff === 'INTEGER' || aff === 'NUMERIC') {
      if (v.t === 'float' && Number.isInteger(v.v)) return I(v.v);
      if (v.t === 'str' && /^\s*[+-]?\d+\s*$/.test(v.v)) return I(parseInt(v.v, 10));
      if (v.t === 'str' && /^\s*[+-]?(\d+\.\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(v.v)) return F(Number(v.v));
    }
    return v;
  }

  function cloneTables(tables) {
    const out = new Map();
    for (const [k, t] of tables) out.set(k, Object.assign({}, t, { rows: t.rows.map(r => ({ rowid: r.rowid, vals: new Map(r.vals) })) }));
    return out;
  }

  function runSql(db, sql, params, line) {
    const toks = sqlTokens(sql, line);
    if (toks.params !== params.length) {
      sqlErr('ProgrammingError', `Incorrect number of bindings supplied. The current statement uses ${toks.params}, and there are ${params.length} supplied.`,
        params.length > toks.params && toks.params === 1 ? 'Για μία μόνο τιμή γράψε tuple με κόμμα: (x,) — το (x) χωρίς κόμμα είναι απλώς x.' : `Η εντολή έχει ${toks.params} θέσεις ? αλλά έδωσες ${params.length} τιμές. Πρέπει να είναι ίσες.`, line);
    }
    const st = sqlParse(toks, line);
    const table = name => {
      const t = db.tables.get(name.toLowerCase());
      if (!t) sqlErr('OperationalError', `no such table: ${name}`, `Ο πίνακας «${name}» δεν υπάρχει. Φτιάξ’ τον πρώτα με CREATE TABLE IF NOT EXISTS ${name} (…).${db.tables.size ? ' Υπάρχουν: ' + [...db.tables.values()].map(x => x.name).join(', ') + '.' : ''}`, line);
      return t;
    };
    const res = { rows: [], rowcount: -1, lastrowid: null, changed: false };
    switch (st.k) {
      case 'create': {
        if (db.tables.has(st.name.toLowerCase())) {
          if (st.ifNot) return res;
          sqlErr('OperationalError', `table ${st.name} already exists`, 'Γράψε CREATE TABLE IF NOT EXISTS, ώστε το πρόγραμμα να ξανατρέχει χωρίς σφάλμα.', line);
        }
        db.tables.set(st.name.toLowerCase(), { name: st.name, cols: st.cols, rows: [], seq: 0 });
        res.changed = true;
        res.ddl = true;
        return res;
      }
      case 'drop': {
        if (!db.tables.has(st.name.toLowerCase())) { if (st.ifExists) return res; sqlErr('OperationalError', `no such table: ${st.name}`, '', line); }
        db.tables.delete(st.name.toLowerCase());
        res.changed = true;
        res.ddl = true;
        return res;
      }
      case 'insert': {
        const t = table(st.table);
        const names = st.cols ? st.cols.map(c => c.toLowerCase()) : t.cols.map(c => c.name.toLowerCase());
        for (const n of names) if (!t.cols.some(c => c.name.toLowerCase() === n)) sqlErr('OperationalError', `table ${t.name} has no column named ${n}`, `Οι στήλες του ${t.name} είναι: ${t.cols.map(c => c.name).join(', ')}.`, line);
        res.rowcount = 0;
        for (const exprs of st.rows) {
          if (exprs.length !== names.length) {
            sqlErr('OperationalError', st.cols ? `${exprs.length} values for ${names.length} columns` : `table ${t.name} has ${names.length} columns but ${exprs.length} values were supplied`,
              st.cols ? 'Οι τιμές στο VALUES πρέπει να είναι όσες και οι στήλες στην παρένθεση.' : `Ο πίνακας έχει ${names.length} στήλες. Γράψε ποιες στήλες συμπληρώνεις: INSERT INTO ${t.name} (στήλη1, στήλη2) VALUES (?, ?).`, line);
          }
          const vals = new Map();
          for (const c of t.cols) vals.set(c.name.toLowerCase(), c.def || NONE);
          exprs.forEach((e, i) => vals.set(names[i], evalSql(e, { params }, line)));
          let rowid = null;
          for (const c of t.cols) {
            const key = c.name.toLowerCase();
            let v = applyAffinity(c, vals.get(key));
            if (c.pk && affinity(c.type) === 'INTEGER' && isNull(v)) v = I(t.seq + 1);
            if (c.pk && affinity(c.type) === 'INTEGER') rowid = numOf(v);
            if (c.notnull && isNull(v)) sqlErr('IntegrityError', `NOT NULL constraint failed: ${t.name}.${c.name}`, `Η στήλη ${c.name} δεν δέχεται κενή τιμή (None).`, line);
            if ((c.unique || c.pk) && !isNull(v) && t.rows.some(r => sqlCmp(r.vals.get(key), v) === 0)) sqlErr('IntegrityError', `UNIQUE constraint failed: ${t.name}.${c.name}`, `Υπάρχει ήδη γραμμή με ${c.name} = ${pyRepr(v)}.`, line);
            vals.set(key, v);
          }
          if (rowid === null) rowid = t.seq + 1;
          t.seq = Math.max(t.seq, rowid);
          t.rows.push({ rowid, vals });
          res.lastrowid = rowid;
          res.rowcount++;
        }
        res.changed = true;
        return res;
      }
      case 'delete': case 'update': {
        const t = table(st.table);
        const cols = t.cols.map(c => c.name.toLowerCase());
        const match = r => !st.where || sqlTruth(evalSql(st.where, { row: r, params, cols }, line));
        if (st.k === 'delete') {
          const before = t.rows.length;
          t.rows = t.rows.filter(r => !match(r));
          res.rowcount = before - t.rows.length;
        } else {
          res.rowcount = 0;
          for (const r of t.rows) {
            if (!match(r)) continue;
            for (const [c, e] of st.sets) {
              const col = t.cols.find(x => x.name.toLowerCase() === c.toLowerCase());
              if (!col) sqlErr('OperationalError', `no such column: ${c}`, '', line);
              r.vals.set(c.toLowerCase(), applyAffinity(col, evalSql(e, { row: r, params, cols }, line)));
            }
            res.rowcount++;
          }
        }
        res.changed = true;
        return res;
      }
      case 'select': {
        const t = st.table ? table(st.table) : null;
        const cols = t ? t.cols.map(c => c.name.toLowerCase()) : [];
        let rows = t ? t.rows : [{ rowid: 0, vals: new Map() }];
        if (st.where) {
          if (hasAgg(st.where)) sqlErr('OperationalError', 'misuse of aggregate function', 'Οι συναρτήσεις COUNT, AVG, MIN, MAX, SUM μπαίνουν στο SELECT, όχι στο WHERE.', line);
          rows = rows.filter(r => sqlTruth(evalSql(st.where, { row: r, params, cols }, line)));
        }
        const items = [];
        for (const it of st.items) {
          if (it.star) { if (!t) sqlErr('OperationalError', 'no tables specified', '', line); t.cols.forEach(c => items.push({ e: { k: 'col', name: c.name }, alias: null })); } else items.push(it);
        }
        const aggregate = st.groupBy.length || items.some(it => hasAgg(it.e));
        let groups;
        if (aggregate) {
          if (st.groupBy.length) {
            const map = new Map();
            for (const r of rows) {
              const key = st.groupBy.map(g => pyRepr(evalSql(g, { row: r, params, cols }, line))).join('\u0001');
              if (!map.has(key)) map.set(key, []);
              map.get(key).push(r);
            }
            groups = [...map.values()];
          } else groups = [rows];
        } else groups = rows.map(r => [r]);
        let out = groups.map(g => {
          const src = g[0] || { rowid: 0, vals: new Map() };
          const ctx = { row: src, group: aggregate ? g : null, params, cols };
          const vals = items.map(it => evalSql(it.e, ctx, line));
          const alias = new Map();
          items.forEach((it, i) => { if (it.alias) alias.set(it.alias.toLowerCase(), vals[i]); });
          return { vals, ctx: Object.assign({}, ctx, { alias }) };
        });
        if (st.orderBy.length) {
          const keyed = out.map(o => ({ o, keys: st.orderBy.map(ob => evalSql(ob.e, o.ctx, line)) }));
          keyed.sort((x, y) => {
            for (let i = 0; i < st.orderBy.length; i++) {
              const a = x.keys[i];
              const b = y.keys[i];
              let c = isNull(a) && isNull(b) ? 0 : isNull(a) ? -1 : isNull(b) ? 1 : sqlCmp(a, b);
              if (st.orderBy[i].desc) c = -c;
              if (c) return c;
            }
            return 0;
          });
          out = keyed.map(k => k.o);
        }
        const off = st.offset ? sqlNum(evalSql(st.offset, { params }, line)) : 0;
        const lim = st.limit ? sqlNum(evalSql(st.limit, { params }, line)) : -1;
        out = out.slice(off, lim < 0 ? undefined : off + lim);
        res.rows = out.map(o => T(o.vals));
        res.columns = items.map(it => it.alias || (it.e.k === 'col' ? it.e.name : '?'));
        return res;
      }
    }
    return res;
  }

  // ---------------------------------------------------------- sqlite3 module

  function openDb(m, fname) {
    const b = m.board;
    if (fname === ':memory:') return { name: ':memory:', tables: new Map(), committed: new Map(), dirty: false, memory: true };
    if (!b.db[fname]) {
      const db = { name: fname, tables: new Map(), committed: new Map(), dirty: false };
      b.db[fname] = db;
      const seed = b.dbSeed && b.dbSeed[fname];
      if (seed) {
        for (const sql of seed) runSql(db, sql, [], null);
        db.committed = cloneTables(db.tables);
      }
    }
    return b.db[fname];
  }

  function bindParams(p, line) {
    if (!p || p.t === 'NoneType') return [];
    if (p.t === 'tuple' || p.t === 'list') return p.v.map((v, i) => checkBind(v, i, line));
    if (p.t === 'str') return [...p.v].map(S);
    if (p.t === 'dict') raise('ProgrammingError', 'Binding by name is not supported here', 'Σε αυτή την έκδοση οι παράμετροι δίνονται ως tuple: execute("… ?", (x,))', line);
    return raise('ProgrammingError', 'parameters are of unsupported type', 'Οι τιμές για τα ? δίνονται ως tuple, π.χ. (temp,) για μία τιμή ή (room, temp) για δύο.', line);
  }
  function checkBind(v, i, line) {
    if (['int', 'float', 'str', 'NoneType', 'bool', 'bytes'].includes(v.t)) return v.t === 'bool' ? I(v.v ? 1 : 0) : v;
    return raise('ProgrammingError', `Error binding parameter ${i + 1}: type '${typeName(v)}' is not supported`, v.t === 'dict' || v.t === 'list' ? 'Λεξικά και λίστες δεν αποθηκεύονται απευθείας. Αποθήκευσε κάθε τιμή στη δική της στήλη, ή μετάτρεψέ τα σε κείμενο με json.dumps(…).' : '', line);
  }

  function makeConnection(m, fname, line) {
    const db = openDb(m, fname);
    let closed = false;
    const live = l => { if (closed) raise('ProgrammingError', 'Cannot operate on a closed database.', 'Η σύνδεση με τη βάση έκλεισε με close(). Άνοιξέ την ξανά ή κάνε close() μόνο στο τέλος.', l); };
    function exec(sql, params, l) {
      live(l);
      if (!sql || sql.t !== 'str') raise('TypeError', `execute() argument 1 must be str, not ${typeName(sql || NONE)}`, '', l);
      m.board.advanceMicros(300);
      const r = runSql(db, sql.v, bindParams(params, l), l);
      // Όπως το sqlite3 της Python: CREATE/DROP εκτός ανοιχτής συναλλαγής αποθηκεύονται αμέσως·
      // INSERT/UPDATE/DELETE ανοίγουν συναλλαγή που θέλει commit().
      if (r.changed && r.ddl && !db.dirty) db.committed = cloneTables(db.tables);
      else if (r.changed) { db.dirty = true; db.changes = (db.changes || 0) + 1; }
      return r;
    }
    function makeCursor() {
      let rows = [];
      let lastrowid = NONE;
      let rowcount = -1;
      const cur = {
        t: 'object', cls: 'Cursor',
        attr(n) {
          switch (n) {
            case 'execute': return builtin('execute', (m2, a, kw, l) => { need('execute', a, 1, 2, l, 'cur.execute("SELECT … WHERE room = ?", (room,))'); const r = exec(a[0], a[1], l); rows = r.rows.slice(); lastrowid = r.lastrowid === null ? lastrowid : I(r.lastrowid); rowcount = r.rowcount; return cur; });
            case 'executemany': return builtin('executemany', (m2, a, kw, l) => ({
              __gen: (function* () {
                const seq = yield* m.iterate(a[1], l);
                rowcount = 0;
                for (const p of seq) { const r = exec(a[0], p, l); rowcount += Math.max(0, r.rowcount); if (r.lastrowid !== null) lastrowid = I(r.lastrowid); }
                rows = [];
                return cur;
              })()
            }));
            case 'fetchone': return builtin('fetchone', () => (rows.length ? rows.shift() : NONE));
            case 'fetchall': return builtin('fetchall', () => { const r = rows; rows = []; return L(r); });
            case 'fetchmany': return builtin('fetchmany', (m2, a, kw) => { const n = a[0] ? numOf(a[0]) : kw.size ? numOf(kw.size) : 1; return L(rows.splice(0, n)); });
            case 'lastrowid': return lastrowid;
            case 'rowcount': return I(rowcount);
            case 'close': return builtin('close', () => NONE);
          }
          return undefined;
        },
        iterItems() { const r = rows; rows = []; return r; },
        short: () => `Cursor · ${rows.length} γραμμές για διάβασμα`,
        repr: () => '<sqlite3.Cursor object>'
      };
      return cur;
    }
    const conn = {
      t: 'object', cls: 'Connection',
      attr(n) {
        switch (n) {
          case 'cursor': return builtin('cursor', (m2, a, kw, l) => { live(l); return makeCursor(); });
          case 'execute': return builtin('execute', (m2, a, kw, l) => { const c = makeCursor(); return { __gen: (function* () { return yield* m.callValue(c.attr('execute'), a, kw, l); })() }; });
          case 'executemany': return builtin('executemany', (m2, a, kw, l) => { const c = makeCursor(); return { __gen: (function* () { return yield* m.callValue(c.attr('executemany'), a, kw, l); })() }; });
          case 'commit': return builtin('commit', (m2, a, kw, l) => { live(l); db.committed = cloneTables(db.tables); db.dirty = false; db.commits = (db.commits || 0) + 1; m.board.advanceMicros(2000); return NONE; });
          case 'rollback': return builtin('rollback', (m2, a, kw, l) => { live(l); db.tables = cloneTables(db.committed); db.dirty = false; return NONE; });
          case 'close': return builtin('close', () => {
            // Όπως στο sqlite3: το close() ΔΕΝ κάνει commit· ό,τι δεν αποθηκεύτηκε χάνεται.
            if (db.dirty) {
              m.board.warnOnce('dbclose', line, 'Η σύνδεση έκλεισε με αλλαγές που δεν αποθηκεύτηκαν: χάθηκαν.', 'Κάλεσε conn.commit() πριν από το conn.close().');
              db.tables = cloneTables(db.committed);
              db.dirty = false;
            }
            closed = true;
            return NONE;
          });
          case 'total_changes': return I(db.changes || 0);
        }
        return undefined;
      },
      short: () => `Connection(${fname})${closed ? ' · κλειστή' : db.dirty ? ' · αλλαγές χωρίς commit' : ''}`,
      repr: () => '<sqlite3.Connection object>'
    };
    if (!m.dbWatch) {
      m.dbWatch = true;
      (m.onEnd = m.onEnd || []).push(() => {
        for (const d of Object.values(m.board.db)) {
          if (d.dirty) {
            m.board.warnOnce('dbdirty', null, `Το πρόγραμμα τελείωσε με αλλαγές στη βάση ${d.name} χωρίς commit: χάθηκαν.`, 'Μετά από INSERT/UPDATE/DELETE κάλεσε conn.commit().');
            d.tables = cloneTables(d.committed);
            d.dirty = false;
          }
        }
      });
    }
    return conn;
  }

  MODULES.sqlite3 = m => ({
    connect: builtin('connect', (m2, a, kw, line) => {
      need('connect', a, 1, 1, line, 'sqlite3.connect("home.db")');
      if (a[0].t !== 'str') raise('TypeError', 'expected str, bytes or os.PathLike object', 'Δώσε το όνομα του αρχείου της βάσης, π.χ. "home.db".', line);
      return makeConnection(m, a[0].v, line);
    }),
    Error: TYPE('Error'), DatabaseError: TYPE('DatabaseError'), OperationalError: TYPE('OperationalError'), IntegrityError: TYPE('IntegrityError'), ProgrammingError: TYPE('ProgrammingError')
  });

  // ================================================================== Flask

  const REASONS = { 200: 'OK', 201: 'CREATED', 204: 'NO CONTENT', 400: 'BAD REQUEST', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT FOUND', 405: 'METHOD NOT ALLOWED', 415: 'UNSUPPORTED MEDIA TYPE', 429: 'TOO MANY REQUESTS', 500: 'INTERNAL SERVER ERROR' };
  const TITLES = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 415: 'Unsupported Media Type', 429: 'Too Many Requests', 500: 'Internal Server Error' };
  const DESCR = {
    400: 'The browser (or proxy) sent a request that this server could not understand.',
    401: "The server could not verify that you are authorized to access the URL requested. You either supplied the wrong credentials (e.g. a bad password), or your browser doesn't understand how to supply the credentials required.",
    403: "You don't have the permission to access the requested resource. It is either read-protected or not readable by the server.",
    404: 'The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again.',
    405: 'The method is not allowed for the requested URL.',
    415: "Did not attempt to load JSON data because the request Content-Type was not 'application/json'.",
    429: 'This user has exceeded an allotted request count. Try again later.',
    500: 'The server encountered an internal error and was unable to complete your request. Either the server is overloaded or there is an error in the application.'
  };
  const errorPage = (code, desc) => ({ status: code, contentType: 'text/html; charset=utf-8', headers: {}, body: `<!doctype html>\n<html lang=en>\n<title>${code} ${TITLES[code] || ''}</title>\n<h1>${TITLES[code] || code}</h1>\n<p>${desc || DESCR[code] || ''}</p>\n` });

  function compileRoute(path, line) {
    if (typeof path !== 'string' || !path.startsWith('/')) raise('ValueError', "urls must start with a leading slash", 'Η διαδρομή ξεκινά με /, π.χ. @app.route("/api/temp")', line);
    const params = [];
    const re = '^' + path.replace(/<(?:(int|float|path|string):)?(\w+)>|[.*+?^${}()|[\]\\]/g, (all, conv, name) => {
      if (!name) return '\\' + all;
      params.push({ name, conv: conv || 'string' });
      return conv === 'int' ? '(\\d+)' : conv === 'float' ? '(\\d+\\.\\d+)' : conv === 'path' ? '(.+)' : '([^/]+)';
    }) + '$';
    return { re: new RegExp(re), params };
  }

  function makeResponse(m, rv, route, line) {
    if (rv.t === 'object' && rv.cls === 'Response') return rv.resp;
    if (rv.t === 'str') return { status: 200, contentType: 'text/html; charset=utf-8', headers: {}, body: rv.v };
    if (rv.t === 'dict' || rv.t === 'list') return jsonResponse(rv, line);
    if (rv.t === 'tuple' && rv.v.length >= 2 && rv.v.length <= 3) {
      const base = makeResponse(m, rv.v[0], route, line);
      let status = base.status;
      let headers = Object.assign({}, base.headers);
      const extra = rv.v.slice(1);
      for (const x of extra) {
        if (x.t === 'int') status = x.v;
        else if (x.t === 'dict') for (const [k, v] of x.v.values()) headers[pyStr(k)] = pyStr(v);
      }
      return Object.assign({}, base, { status, headers });
    }
    if (rv.t === 'NoneType') {
      raise('TypeError', `The view function for '${route}' did not return a valid response. The function either returned None or ended without a return statement.`, `Η συνάρτηση ${route}() πρέπει να κάνει return κάτι: κείμενο/HTML, λεξικό ή jsonify(…).`, line);
    }
    return raise('TypeError', `The view function did not return a valid response. The return type must be a string, dict, list, tuple with headers or status, Response instance, or WSGI callable, but it was a ${typeName(rv)}.`, 'Επίστρεψε κείμενο, λεξικό ή jsonify(…). Για αριθμό: str(x) ή {"value": x}.', line);
  }
  function jsonResponse(v, line) {
    return { status: 200, contentType: 'application/json', headers: {}, body: jsonDumps(v, { compact: true, sortKeys: true }, line) + '\n' };
  }

  function dictLike(get, keys, label) {
    return {
      t: 'object', cls: label,
      attr(n) {
        if (n === 'get') {
          return builtin('get', (m, a, kw, line) => {
            const v = get(pyStr(a[0]));
            if (v === undefined) return a[1] || kw.default || NONE;
            const type = kw.type || a[2];
            if (type && type.t === 'type') {
              try { return type.name === 'int' ? K.I(parseInt(/^\s*-?\d+\s*$/.test(v) ? v : 'x', 10)) : type.name === 'float' ? F(Number(v)) : S(v); } catch (e) { return NONE; }
            }
            return S(v);
          });
        }
        if (n === 'keys') return builtin('keys', () => L(keys().map(S)));
        return undefined;
      },
      getItem(idx, line) {
        const v = get(pyStr(idx));
        if (v === undefined) raise('HTTPException', `400 Bad Request: KeyError ${pyRepr(idx)}`, `Το αίτημα δεν έχει «${pyStr(idx)}». Χρησιμοποίησε .get("${pyStr(idx)}") για να πάρεις None αντί για σφάλμα 400.`, line, 400);
        return S(v);
      },
      contains(a) { return get(pyStr(a)) !== undefined; },
      short: () => `${label}(${keys().length})`,
      repr: () => `${label}(${JSON.stringify(Object.fromEntries(keys().map(k => [k, get(k)])))})`
    };
  }

  function makeRequestProxy(m) {
    const cur = l => { if (!m.currentRequest) raise('RuntimeError', 'Working outside of request context.', 'Το request υπάρχει μόνο μέσα σε συνάρτηση που εξυπηρετεί ένα αίτημα (με @app.route).', l); return m.currentRequest; };
    return {
      t: 'object', cls: 'Request',
      attr(n, l) {
        const r = cur(l);
        switch (n) {
          case 'method': return S(r.method);
          case 'path': return S(r.path.split('?')[0]);
          case 'remote_addr': return S(r.from);
          case 'args': return dictLike(k => r.query[k], () => Object.keys(r.query), 'ImmutableMultiDict');
          case 'headers': {
            const lower = {};
            for (const [k, v] of Object.entries(r.headers || {})) lower[k.toLowerCase()] = v;
            return dictLike(k => lower[k.toLowerCase()], () => Object.keys(r.headers || {}), 'Headers');
          }
          case 'get_json': return builtin('get_json', (m2, a, kw, l2) => jsonBody(r, kw.silent && truthy(kw.silent), l2));
          case 'json': return jsonBody(r, false, l);
          case 'is_json': return B(r.body !== undefined && r.json);
        }
        return undefined;
      },
      repr: () => '<Request>'
    };
  }
  function jsonBody(r, silent, l) {
    if (r.body === undefined || r.body === null || r.body === '') {
      if (silent) return NONE;
      raise('HTTPException', `415 Unsupported Media Type: ${DESCR[415]}`, 'Το αίτημα δεν έχει σώμα JSON.', l, 415);
    }
    try { return jsonLoads(r.body, l); } catch (e) {
      if (silent) return NONE;
      raise('HTTPException', '400 Bad Request: Failed to decode JSON object', 'Το σώμα του αιτήματος δεν είναι έγκυρο JSON.', l, 400);
    }
  }

  function stamp(m) {
    const d = new Date((K.EPOCH + m.board.micros / 1e6 + K.TZ_OFFSET) * 1000);
    const z = n => String(n).padStart(2, '0');
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { access: `${z(d.getUTCDate())}/${MON[d.getUTCMonth()]}/${d.getUTCFullYear()} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())}`, iso: `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())},${String(d.getUTCMilliseconds()).padStart(3, '0')}` };
  }

  function makeApp(m, nameArg, line) {
    const routes = [];
    const register = (path, methods, l) => builtin('decorator', (m2, a, kw, l2) => {
      const fn = a[0];
      if (!fn || fn.t !== 'function') raise('TypeError', 'route decorator expects a function', 'Το @app.route("…") μπαίνει ακριβώς πάνω από ένα def.', l2);
      const c = compileRoute(path, l);
      if (routes.some(r => r.fn.name === fn.name)) raise('AssertionError', `View function mapping is overwriting an existing endpoint function: ${fn.name}`, 'Δύο routes έχουν συνάρτηση με το ίδιο όνομα. Κάθε route θέλει δική της συνάρτηση με διαφορετικό όνομα.', l2);
      routes.push(Object.assign({ path, methods, fn }, c));
      return fn;
    });
    const methodsOf = (kw, def) => (kw.methods ? kw.methods.v.map(x => pyStr(x).toUpperCase()) : def);
    const app = {
      t: 'object', cls: 'Flask', routes,
      attr(n, l) {
        switch (n) {
          case 'route': return builtin('route', (m2, a, kw, l2) => register(a[0] ? pyStr(a[0]) : '', methodsOf(kw, ['GET']), l2));
          case 'get': return builtin('get', (m2, a, kw, l2) => register(pyStr(a[0]), ['GET'], l2));
          case 'post': return builtin('post', (m2, a, kw, l2) => register(pyStr(a[0]), ['POST'], l2));
          case 'run': return builtin('run', (m2, a, kw, l2) => runApp(m, app, a, kw, l2));
          case 'name': return S(nameArg);
        }
        return undefined;
      },
      short: () => `Flask · ${routes.length} routes`,
      repr: () => `<Flask '${nameArg}'>`
    };
    return app;
  }

  function runApp(m, app, a, kw, line) {
    const b = m.board;
    const host = kw.host ? pyStr(kw.host) : a[0] ? pyStr(a[0]) : '127.0.0.1';
    const port = kw.port ? numOf(kw.port) : a[1] ? numOf(a[1]) : 5000;
    const debug = kw.debug ? truthy(kw.debug) : a[2] ? truthy(a[2]) : false;
    const say = t => b.serialWrite(t, true, line);
    // Όταν τρέχεις «python hub.py», το Flask γράφει το όνομα του αρχείου.
    const shown = app.attr('name').v === '__main__' ? 'hub' : app.attr('name').v;
    say(` * Serving Flask app '${shown}'`);
    say(` * Debug mode: ${debug ? 'on' : 'off'}`);
    say('WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.');
    if (host === '0.0.0.0') { say(' * Running on all addresses (0.0.0.0)'); say(` * Running on http://127.0.0.1:${port}`); say(` * Running on http://192.168.1.10:${port}`); }
    else say(` * Running on http://${host}:${port}`);
    say('Press CTRL+C to quit');
    if (debug) {
      say(' * Restarting with stat');
      say(' * Debugger is active!');
      say(' * Debugger PIN: 104-772-391');
      b.warnOnce('flaskdebug', line, 'Το debug=True ενεργοποιεί τον debugger του Werkzeug: όποιος δει σελίδα σφάλματος μπορεί να τρέξει κώδικα Python στο Pi.' + (host === '0.0.0.0' ? ' Και με host="0.0.0.0" η σελίδα αυτή φαίνεται σε όλο το δίκτυο.' : ''), 'Στο κανονικό dashboard γράψε debug=False.');
    }
    if (!app.routes.length) b.warnOnce('noroutes', line, 'Ο server ξεκίνησε χωρίς καμία διαδρομή (@app.route): κάθε αίτημα θα πάρει 404.', 'Γράψε τις συναρτήσεις με @app.route πριν από το app.run().');
    b.http.server = { host, port, debug, app };
    m.services.push(function* serve(l) {
      while (b.http.queue.length) yield* handle(m, app, b.http.queue.shift(), l);
    });
    (m.onEnd = m.onEnd || []).push(() => { b.http.server = null; });
    return { __gen: m.eventLoop(line, null) };
  }

  function* handle(m, app, req, line) {
    const b = m.board;
    b.advanceMicros(1500);
    const [path, qs] = req.path.split('?');
    req.query = {};
    if (qs) for (const part of qs.split('&')) { if (!part) continue; const [k, v] = part.split('='); req.query[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' ')); }
    let resp;
    const matches = app.routes.map(r => ({ r, mm: r.re.exec(path) })).filter(x => x.mm);
    const hit = matches.find(x => x.r.methods.includes(req.method));
    if (!matches.length) resp = errorPage(404);
    else if (!hit) resp = errorPage(405);
    else {
      const kw = {};
      hit.r.params.forEach((p, i) => { const s = decodeURIComponent(hit.mm[i + 1]); kw[p.name] = p.conv === 'int' ? I(parseInt(s, 10)) : p.conv === 'float' ? F(Number(s)) : S(s); });
      m.currentRequest = req;
      try {
        const rv = yield* m.callValue(hit.r.fn, [], kw, line);
        resp = makeResponse(m, rv, hit.r.fn.name, line);
      } catch (e) {
        if (!(e instanceof PyExc)) throw e;
        if (e.cls === 'HTTPException') resp = errorPage(e.code || 500, e.msg.replace(/^\d+ [^:]+: /, ''));
        else {
          const st = stamp(m);
          b.serialWrite(`[${st.iso}] ERROR in app: Exception on ${path} [${req.method}]`, true, e.line);
          b.serialWrite('Traceback (most recent call last):', true, e.line);
          b.serialWrite(`  File "hub.py", line ${e.line || '?'}, in ${hit.r.fn.name}`, true, e.line);
          b.serialWrite(`${e.cls}: ${e.msg}`, true, e.line);
          b.warnOnce('flask500:' + e.line, e.line, `Σφάλμα μέσα στη ${hit.r.fn.name}(): ${e.cls}: ${e.msg}. Ο browser πήρε 500 Internal Server Error, αλλά ο server συνεχίζει.`, e.hint);
          resp = errorPage(500);
        }
      } finally {
        m.currentRequest = null;
      }
    }
    req.response = resp;
    b.http.log.push({ req, resp, t: b.micros / 1000 });
    if (b.http.log.length > 200) b.http.log.shift();
    b.serialWrite(`${req.from} - - [${stamp(m).access}] "${req.method} ${req.path} HTTP/1.1" ${resp.status} -`, true, line);
  }

  MODULES.flask = m => {
    const proxy = makeRequestProxy(m);
    return {
      Flask: builtin('Flask', (m2, a, kw, line) => makeApp(m, a[0] ? pyStr(a[0]) : '__main__', line)),
      jsonify: builtin('jsonify', (m2, a, kw, line) => {
        const v = a.length === 1 ? a[0] : a.length > 1 ? L(a) : mkDict(Object.entries(kw).map(([k, x]) => [S(k), x]), line);
        const resp = jsonResponse(v, line);
        return { t: 'object', cls: 'Response', resp, attr(n) { if (n === 'status_code') return I(resp.status); return undefined; }, repr: () => `<Response ${resp.body.length} bytes [${resp.status} ${REASONS[resp.status]}]>` };
      }),
      request: proxy,
      abort: builtin('abort', (m2, a, kw, line) => {
        const code = a[0] ? numOf(a[0]) : 500;
        const desc = a[1] ? pyStr(a[1]) : kw.description ? pyStr(kw.description) : DESCR[code] || '';
        raise('HTTPException', `${code} ${TITLES[code] || ''}: ${desc}`, '', line, code);
      })
    };
  };

  MODULES.markupsafe = () => ({
    escape: builtin('escape', (m, a, kw, line) => {
      need('escape', a, 1, 1, line, 'escape(name)');
      const s = pyStr(a[0]);
      return S(s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&#34;').replace(/'/g, '&#39;'));
    })
  });

})(typeof window !== 'undefined' ? window : globalThis);
