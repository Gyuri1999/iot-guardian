/*
 * IoT Guardian — κωδικός προόδου για τον δάσκαλο, χωρίς λογαριασμούς και χωρίς server.
 *
 * Ο μαθητής φτιάχνει έναν κωδικό (κείμενο) με μια σύνοψη της προόδου του και ένα ψευδώνυμο που
 * γράφει ο ίδιος. Τον στέλνει στον δάσκαλο όπως θέλει (π.χ. στο e-class). Ο δάσκαλος επικολλά
 * τους κωδικούς στη «Σελίδα τάξης» και βλέπει έναν πίνακα. Όλα μένουν στον browser του καθενός.
 *
 * Μορφή: IOTG1.<base64url(JSON)>.<έλεγχος 8 hex>
 *   JSON: { v: 1, n: ψευδώνυμο, d: 'YYYY-MM-DD', t: { trackId: [μαθήματα, από, κεφάλαια, από, τρέχον κεφ.] },
 *           s: κάρτες ιστορίας, c: ιστορίες ασφάλειας, i: αστέρια εισβολέα }
 * Ο έλεγχος πιάνει λάθη στην αντιγραφή. ΔΕΝ είναι προστασία από αλλαγές: ένας μαθητής που ξέρει
 * προγραμματισμό μπορεί να φτιάξει δικό του κωδικό. Γι' αυτό η σελίδα το λέει στον δάσκαλο.
 */
(function (root) {
  'use strict';

  const PREFIX = 'IOTG1';
  const TRACK_IDS = ['cpp-esp32', 'py-esp32', 'py-pi', 'rs-esp32', 'rs-pi'];

  // FNV-1a 32 bit: μικρός έλεγχος για λάθη αντιγραφής
  function check(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }

  // base64url πάνω σε UTF-8, χωρίς TextEncoder / btoa (δουλεύει παντού, και στα τεστ)
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function toB64url(str) {
    const bin = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    let out = '';
    for (let i = 0; i < bin.length; i += 3) {
      const n = (bin.charCodeAt(i) << 16) | ((bin.charCodeAt(i + 1) || 0) << 8) | (bin.charCodeAt(i + 2) || 0);
      const k = Math.min(3, bin.length - i);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (k > 1 ? B64[(n >> 6) & 63] : '') + (k > 2 ? B64[n & 63] : '');
    }
    return out;
  }
  function fromB64url(s) {
    let bin = '';
    for (let i = 0; i < s.length; i += 4) {
      const c = [0, 1, 2, 3].map(j => (i + j < s.length ? B64.indexOf(s[i + j]) : -1));
      if (c[0] < 0 || c[1] < 0) throw new Error('base64');
      const n = (c[0] << 18) | (c[1] << 12) | (Math.max(0, c[2]) << 6) | Math.max(0, c[3]);
      bin += String.fromCharCode((n >> 16) & 255);
      if (c[2] >= 0) bin += String.fromCharCode((n >> 8) & 255);
      if (c[3] >= 0) bin += String.fromCharCode(n & 255);
    }
    // λάθος UTF-8 → σφάλμα από το decodeURIComponent
    return decodeURIComponent(bin.replace(/[\s\S]/g, ch => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0')));
  }

  const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;

  // Έλεγχος σχήματος: ό,τι έρχεται από επικόλληση είναι άγνωστο κείμενο.
  function normalize(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== 1) return null;
    const n = cleanName(o.n);
    if (!n || typeof o.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.d)) return null;
    const t = {};
    if (!o.t || typeof o.t !== 'object' || Array.isArray(o.t)) return null;
    for (const [k, v] of Object.entries(o.t)) {
      if (!TRACK_IDS.includes(k) || !Array.isArray(v) || v.length !== 5) return null;
      const [done, total, chDone, chTotal, cur] = v;
      if (!isInt(total, 0, 999) || !isInt(done, 0, total) || !isInt(chTotal, 0, 99) || !isInt(chDone, 0, chTotal) || !isInt(cur, 0, 99)) return null;
      t[k] = [done, total, chDone, chTotal, cur];
    }
    for (const k of ['s', 'c', 'i']) if (!isInt(o[k], 0, 999)) return null;
    return { v: 1, n, d: o.d, t, s: o.s, c: o.c, i: o.i };
  }

  function encode(summary) {
    const s = normalize(summary);
    if (!s) throw new Error('μη έγκυρη σύνοψη');
    const body = toB64url(JSON.stringify(s));
    return `${PREFIX}.${body}.${check(PREFIX + body)}`;
  }

  // → { ok: true, data } ή { ok: false, error }
  function decode(code) {
    const m = /^IOTG1\.([A-Za-z0-9_-]{8,3000})\.([0-9a-f]{8})$/.exec(String(code || '').replace(/\s+/g, ''));
    if (!m) return { ok: false, error: (/^IOTG1\./.test(String(code || '').trim()) ? 'Ο κωδικός είναι κομμένος ή έχει άλλα γράμματα μέσα. Αντίγραψέ τον ξανά ολόκληρο.' : 'Δεν μοιάζει με κωδικό προόδου: ένας κωδικός ξεκινά με IOTG1.') };
    if (check(PREFIX + m[1]) !== m[2]) return { ok: false, error: 'Ο κωδικός δεν αντιγράφηκε ολόκληρος ή άλλαξε κάπου.' };
    let o;
    try { o = JSON.parse(fromB64url(m[1])); } catch (e) { return { ok: false, error: 'Ο κωδικός είναι χαλασμένος.' }; }
    const data = normalize(o);
    return data ? { ok: true, data } : { ok: false, error: 'Ο κωδικός έχει άγνωστη μορφή.' };
  }

  // Πολλοί κωδικοί (ένας ανά γραμμή ή χωρισμένοι με κενά) → { good: [...], bad: [{ code, error }] }
  function decodeMany(text) {
    const parts = String(text || '').split(/\s+/).filter(Boolean);
    const good = [], bad = [];
    for (const p of parts) { const r = decode(p); if (r.ok) good.push(r.data); else bad.push({ code: p.slice(0, 24) + (p.length > 24 ? '…' : ''), error: r.error }); }
    return { good, bad };
  }

  // Τάξη: ένας μαθητής ανά ψευδώνυμο (χωρίς διάκριση πεζών)· κρατά τον πιο πρόσφατο κωδικό.
  function merge(list, incoming) {
    const map = new Map(list.map(x => [x.n.toLocaleLowerCase('el'), x]));
    let added = 0, updated = 0;
    for (const x of incoming) {
      const k = x.n.toLocaleLowerCase('el');
      const old = map.get(k);
      if (!old) { map.set(k, x); added++; } else if (x.d >= old.d) { map.set(k, x); updated++; }
    }
    return { list: [...map.values()].sort((a, b) => a.n.localeCompare(b.n, 'el')), added, updated };
  }

  const csvCell = v => {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // όχι τύποι στο λογιστικό φύλλο
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // tracks: [{ id, label }]
  function csv(list, tracks) {
    const head = ['Ψευδώνυμο', 'Ημερομηνία', ...tracks.flatMap(t => [`${t.label}: μαθήματα`, `${t.label}: κεφάλαια`, `${t.label}: τρέχον κεφάλαιο`]), 'Κάρτες ιστορίας', 'Ιστορίες ασφάλειας', 'Αστέρια εισβολέα'];
    const rows = list.map(x => [x.n, x.d, ...tracks.flatMap(t => { const v = x.t[t.id]; return v ? [`${v[0]}/${v[1]}`, `${v[2]}/${v[3]}`, v[4] || '-'] : ['-', '-', '-']; }), x.s, x.c, x.i]);
    return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  }

  root.IoTTeacher = { encode, decode, decodeMany, merge, csv, normalize, check, TRACK_IDS };
})(typeof window !== 'undefined' ? window : globalThis);
