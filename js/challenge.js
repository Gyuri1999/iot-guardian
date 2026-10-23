/*
 * IoT Guardian — «Το σπίτι έχει πρόβλημα»: πρόκληση χωρίς βοήθειες σε κάθε δωμάτιο.
 * Παίρνει μια άσκηση που ο μαθητής έχει ήδη λύσει και «χαλάει» τη λύση της με ένα μικρό, ρεαλιστικό
 * λάθος (HIGH↔LOW, OUTPUT→INPUT, ανάποδη σύγκριση, λάθος pin, γραμμή που λείπει, ρύθμιση ασφαλείας…).
 * Κρατά μόνο λάθη που (α) ο κώδικας ακόμα «χτίζεται» και (β) τουλάχιστον ένας έλεγχος της άσκησης τα πιάνει.
 * Έτσι η πρόκληση λύνεται πάντα, σε κάθε γλώσσα, και ο μαθητής βλέπει ένα σύμπτωμα, όχι τη γραμμή.
 */
(function (root) {
  'use strict';

  // Κάθε κανόνας: [είδος, regex, αντικατάσταση]. Εφαρμόζεται σε ΜΙΑ γραμμή τη φορά.
  const SWAPS = (a, b) => [new RegExp(`\\b${a}\\b|\\b${b}\\b`), m => (m === a ? b : a)];
  const RULES = [
    ['level', ...SWAPS('HIGH', 'LOW')],
    ['level', /\.on\(\)|\.off\(\)/, m => (m === '.on()' ? '.off()' : '.on()')],
    ['level', /\.value\(1\)|\.value\(0\)/, m => (m === '.value(1)' ? '.value(0)' : '.value(1)')],
    ['level', /set_high\(\)|set_low\(\)/, m => (m === 'set_high()' ? 'set_low()' : 'set_high()')],
    ['mode', /\bOUTPUT\b/, () => 'INPUT'],
    ['mode', /Pin\.OUT\b/, () => 'Pin.IN'],
    ['cmp', /==/, () => '!='],
    ['cmp', /!=/, () => '=='],
    ['cmp', />=/, () => '<='],
    ['cmp', /<=/, () => '>='],
    ['cmp', / > /, () => ' < '],
    ['cmp', / < /, () => ' > '],
    ['logic', /&&|\|\|/, m => (m === '&&' ? '||' : '&&')],
    ['logic', /\band\b|\bor\b/, m => (m === 'and' ? 'or' : 'and')],
    ['bool', /\btrue\b|\bfalse\b/, m => (m === 'true' ? 'false' : 'true')],
    ['bool', /\bTrue\b|\bFalse\b/, m => (m === 'True' ? 'False' : 'True')],
    ['pin', /(PIN\w*\s*=\s*)(\d+)/, (m, a, n) => a + ({ 2: 4, 4: 15, 15: 4, 17: 27, 27: 17, 5: 18, 18: 5, 25: 26, 26: 25, 27: 26, 16: 20, 20: 16, 21: 20, 23: 24, 24: 23 }[n] || Number(n) + 1)],
    ['time', /(delay|sleep_ms)\((\d+)\)/, (m, f, n) => `${f}(${Number(n) * 10})`],
    ['math', /\/ 2\b/, () => '* 2'],
    ['math', / \* 0\.0343/, () => ' * 0.343'],
    ['config', /\b(allow|deny)\b/, m => (m === 'allow' ? 'deny' : 'allow')],
    ['config', /\b8883\b/, () => '1883'],
    ['config', /\byes\b|\bno\b/, m => (m === 'yes' ? 'no' : 'yes')],
    ['config', /\breadwrite\b/, () => 'write']
  ];
  // Γραμμές που «λείπουν»: μόνο ρυθμίσεις που ο κώδικας χρειάζεται για να δουλέψει
  const DROPPABLE = /pinMode\(|Serial\.begin\(|\.connect\(|\.subscribe\(|\.commit\(\)|\.loop\(\)|allow_anonymous|password_file|require_certificate/;

  const isComment = line => /^\s*(\/\/|#(?!include|define))/.test(line);

  function candidates(code) {
    const lines = code.split('\n');
    const out = [];
    lines.forEach((line, i) => {
      if (!line.trim() || isComment(line)) return;
      const body = line.replace(/\s+(\/\/|#).*$/, '');
      for (const [kind, re, f] of RULES) {
        const m = body.match(re);
        if (!m) continue;
        const nl = body.slice(0, m.index) + body.slice(m.index).replace(re, f) + line.slice(body.length);
        if (nl !== line) out.push({ kind, line: i + 1, code: lines.map((x, j) => (j === i ? nl : x)).join('\n') });
      }
      if (DROPPABLE.test(body)) out.push({ kind: 'drop', line: i + 1, code: lines.filter((_, j) => j !== i).join('\n') });
    });
    return out;
  }

  // Απλό ανακάτεμα με σπόρο: η ίδια πρόκληση για τον ίδιο σπόρο, άλλη όταν αλλάζει
  function shuffle(a, seed) {
    let s = 0;
    for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }

  // lessons: υποψήφιες ασκήσεις (λυμένες), runTests: (code, tests, lesson) → αποτελέσματα
  function make(lessons, runTests, seed) {
    for (const base of lessons) {
      if (!base.solution || !base.validationTests || !base.validationTests.length) continue;
      for (const c of shuffle(candidates(base.solution), seed + base.id)) {
        let res;
        try { res = runTests(c.code, base.validationTests, base); } catch (e) { continue; }
        if (!res || res.some(r => r.codeError)) continue;
        const failed = res.filter(r => !r.pass).length;
        if (failed > 0) return { base, code: c.code, kind: c.kind, line: c.line, failed };
      }
    }
    return null;
  }

  const SYMPTOMS = {
    level: 'Τα φώτα κάνουν το ανάποδο από αυτό που πρέπει: ανάβουν όταν πρέπει να σβήνουν.',
    mode: 'Ο κώδικας τρέχει κανονικά, αλλά κάτι μένει σβηστό και δεν αντιδρά ποτέ.',
    drop: 'Από χθες ένα κομμάτι του συστήματος δεν ξεκινά καθόλου.',
    cmp: 'Το σύστημα αντιδρά στη λάθος περίπτωση: κάνει το σωστό, αλλά τη λάθος στιγμή.',
    logic: 'Ο κανόνας απόφασης μπερδεύτηκε: ενεργοποιείται σε λάθος συνδυασμό.',
    bool: 'Μια ρύθμιση είναι ανάποδα από ό,τι πρέπει.',
    pin: 'Κάποιος πείραξε τον κώδικα: η πλακέτα μιλά σε λάθος pin.',
    time: 'Όλα δουλεύουν, αλλά πολύ αργά: το σύστημα αργεί να αντιδράσει.',
    math: 'Οι μετρήσεις βγαίνουν λάθος: οι αριθμοί δεν ταιριάζουν με την πραγματικότητα.',
    config: 'Μια ρύθμιση ασφαλείας άλλαξε και το σπίτι δεν προστατεύεται πια όπως πριν.'
  };
  const story = (roomName, kind) => `🚨 Το σπίτι έχει πρόβλημα στο δωμάτιο «${roomName}»! ${SYMPTOMS[kind] || SYMPTOMS.bool} Βρες το λάθος και διόρθωσέ το. Αυτή τη φορά χωρίς βοήθειες: εσύ είσαι ο τεχνικός.`;

  root.IoTChallenge = { candidates, make, story, SYMPTOMS };
})(typeof window !== 'undefined' ? window : globalThis);
