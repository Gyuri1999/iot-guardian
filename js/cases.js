/*
 * IoT Guardian — Ιστορίες ασφάλειας: πραγματικές επιθέσεις σε συσκευές IoT, από δημοσιευμένες έρευνες.
 * Κάθε ιστορία έχει τρία μέρη:
 *   1. «Πώς έγινε»: κινούμενη σκηνή βήμα-βήμα (μόνο η ιδέα, χωρίς οδηγίες επίθεσης).
 *   2. «Προστάτευσέ το»: διαλέγεις μέτρα και η ίδια επίθεση ξαναπαίζει· τα σωστά μέτρα τη σταματούν.
 *   3. Κουίζ και «τι κρατάμε».
 *
 * Μορφή μιας ιστορίας (CASES):
 *   { id, title, year, device, source: { cite, url }, intro, chapter (κεφάλαιο για εξάσκηση) ,
 *     zones: [{ x, y, w, h, label }], nodes: [{ id, icon, label, x, y }],
 *     steps: [{ say, acts: [...], stop: ['defId'...], stopAt: 'nodeId', blocked: 'κείμενο' }],
 *     defenses: [{ id, label, good, why }], quiz: { question, options, answer, explain }, lesson }
 * Ενέργειες (acts):
 *   { t: 'packet', from, to, kind: 'bad'|'good'|'key', label }   ένα «πακέτο» ταξιδεύει
 *   { t: 'burst', from: [ids], to, kind }                         πολλά μαζί (π.χ. DDoS)
 *   { t: 'state', node, s: 'bad'|'down'|'ok'|'warn'|'' }          αλλάζει η κατάσταση μιας συσκευής
 *   { t: 'tag', node, text }                                       ταμπελάκι πάνω από μια συσκευή
 */
(function (root) {
  'use strict';

  const CASES = [];   // γεμίζει από το js/cases-data.js

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const W = 640, H = 300;

  // Έλεγχος δεδομένων: επιστρέφει λίστα με προβλήματα (κενή = εντάξει). Τη χρησιμοποιούν και τα τεστ.
  function check(c) {
    const errs = [];
    const ids = new Set((c.nodes || []).map(n => n.id));
    const defs = new Map((c.defenses || []).map(d => [d.id, d]));
    if (!c.id || !c.title || !c.source || !c.source.cite || !/^https:\/\//.test(c.source.url || '')) errs.push('λείπει id / τίτλος / πηγή');
    for (const st of c.steps || []) {
      if (!st.say) errs.push('βήμα χωρίς κείμενο');
      for (const a of st.acts || []) {
        for (const k of ['from', 'to', 'node']) {
          const v = a[k];
          if (v === undefined) continue;
          for (const x of [].concat(v)) if (!ids.has(x)) errs.push(`άγνωστη συσκευή «${x}»`);
        }
      }
      for (const d of st.stop || []) { if (!defs.has(d)) errs.push(`άγνωστο μέτρο «${d}»`); else if (!defs.get(d).good) errs.push(`το «${d}» σταματά βήμα αλλά δεν είναι σωστό μέτρο`); }
      if (st.stop && st.stop.length && (!st.stopAt || !ids.has(st.stopAt) || !st.blocked)) errs.push('βήμα με stop χωρίς stopAt / blocked');
    }
    const goods = [...defs.values()].filter(d => d.good);
    if (!goods.length) errs.push('κανένα σωστό μέτρο');
    for (const d of goods) if (!(c.steps || []).some(st => (st.stop || []).includes(d.id))) errs.push(`το σωστό μέτρο «${d.id}» δεν σταματά κανένα βήμα`);
    for (const d of defs.values()) if (!d.why) errs.push(`το μέτρο «${d.id}» δεν εξηγεί γιατί`);
    const q = c.quiz;
    if (!q || !q.question || !Array.isArray(q.options) || !(q.answer >= 0 && q.answer < q.options.length) || !q.explain) errs.push('κουίζ ελλιπές');
    return errs;
  }

  // Αξιολόγηση επιλογών: { ok, good: [...], bad: [...], missed: [...], stopStep }
  function judge(c, chosen) {
    const set = new Set(chosen);
    const good = c.defenses.filter(d => d.good && set.has(d.id));
    const bad = c.defenses.filter(d => !d.good && set.has(d.id));
    const missed = c.defenses.filter(d => d.good && !set.has(d.id));
    const stopStep = c.steps.findIndex(st => (st.stop || []).some(id => set.has(id)));
    return { ok: !missed.length && !bad.length, good, bad, missed, stopStep };
  }

  // ------------------------------------------------------------ η σκηνή
  function stageSVG(c) {
    const zones = (c.zones || []).map(z => `<g class="cz"><rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="14"/><text x="${z.x + 10}" y="${z.y + 18}">${esc(z.label)}</text></g>`).join('');
    const nodes = c.nodes.map(n => `<g class="cn" id="cn-${n.id}" transform="translate(${n.x},${n.y})">
        <circle class="cn-ring" r="27"/><text class="cn-ic" y="9" text-anchor="middle" aria-hidden="true">${n.icon}</text>
        <text class="cn-lb" y="45" text-anchor="middle">${esc(n.label)}</text><g class="cn-tag"></g><g class="cn-shield"></g></g>`).join('');
    return `<svg class="case-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Κινούμενη σκηνή: ${esc(c.title)}">${zones}<g class="c-links"></g>${nodes}<g class="c-packets"></g></svg>`;
  }

  // Παίκτης: mount(el, c, opts) → { play, step, reset, replay(chosen), stop }
  //   opts: { onSay(text, i, n), onEnd(result), motion: () => bool, sfx(name) }
  function mount(el, c, opts) {
    opts = opts || {};
    el.innerHTML = stageSVG(c);
    const svg = el.querySelector('svg');
    const pk = svg.querySelector('.c-packets');
    const pos = Object.fromEntries(c.nodes.map(n => [n.id, n]));
    let i = 0;          // επόμενο βήμα
    let token = 0;      // ακυρώνει ό,τι τρέχει όταν πατάς κάτι άλλο
    let timer = null;
    const motion = () => (opts.motion ? opts.motion() : true);
    const node = id => svg.querySelector(`#cn-${id}`);
    const sleep = ms => new Promise(r => { timer = setTimeout(r, ms); });

    function reset() {
      token++; clearTimeout(timer); i = 0;
      pk.innerHTML = '';
      svg.querySelector('.c-links').innerHTML = '';
      svg.querySelectorAll('.cn').forEach(g => { g.setAttribute('class', 'cn'); g.querySelector('.cn-tag').innerHTML = ''; g.querySelector('.cn-shield').innerHTML = ''; });
    }
    function setState(id, s) { const g = node(id); if (g) g.setAttribute('class', 'cn' + (s ? ' s-' + s : '')); }
    function tag(id, text) {
      const g = node(id);
      if (!g) return;
      const w = Math.max(40, text.length * 7 + 16);
      g.querySelector('.cn-tag').innerHTML = text ? `<rect x="${-w / 2}" y="-58" width="${w}" height="20" rx="10"/><text y="-44" text-anchor="middle">${esc(text)}</text>` : '';
    }
    function shield(id) {
      const g = node(id);
      if (g) g.querySelector('.cn-shield').innerHTML = '<circle class="sh-ring" r="34"/><text class="sh-ic" x="22" y="-18" text-anchor="middle">🛡️</text>';
    }
    // Ένα πακέτο από a σε b. bounce: γυρίζει πίσω πριν φτάσει (μπλοκαρίστηκε).
    function packet(a, b, kind, label, my, bounce) {
      const A = pos[a], B = pos[b];
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'cp k-' + (kind || 'bad'));
      g.innerHTML = `<circle r="9"/>${label ? `<text y="-14" text-anchor="middle">${esc(label)}</text>` : ''}`;
      pk.appendChild(g);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'cl k-' + (kind || 'bad'));
      ['x1', 'y1', 'x2', 'y2'].forEach((k, j) => line.setAttribute(k, [A.x, A.y, B.x, B.y][j]));
      svg.querySelector('.c-links').appendChild(line);
      const dur = motion() ? 900 : 0;
      const end = bounce ? 0.72 : 1;
      return new Promise(res => {
        if (!dur) { const p = end; g.setAttribute('transform', `translate(${A.x + (B.x - A.x) * p},${A.y + (B.y - A.y) * p})`); setTimeout(() => g.remove(), 700); setTimeout(res, 10); return; }
        // Αν ο browser καθυστερεί τα frames (π.χ. καρτέλα στο παρασκήνιο), το πακέτο τελειώνει με χρονόμετρο.
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(safety);
          if (bounce) g.remove(); else { g.setAttribute('transform', `translate(${B.x},${B.y})`); setTimeout(() => g.remove(), 250); }
          res();
        };
        const safety = setTimeout(finish, dur + (bounce ? 400 : 0) + 300);
        const t0 = performance.now();
        const tick = now => {
          if (done) return;
          if (my !== token) { done = true; clearTimeout(safety); g.remove(); res(); return; }
          let p = Math.min(1, (now - t0) / dur);
          let f = p * end;
          if (bounce && p >= 1) {
            const q = Math.min(1, (now - t0 - dur) / 400);
            f = end * (1 - q);
            if (q >= 1) { finish(); return; }
          } else if (p >= 1) { finish(); return; }
          const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
          g.setAttribute('transform', `translate(${A.x + (B.x - A.x) * e},${A.y + (B.y - A.y) * e})`);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }
    async function runActs(acts, my, block) {
      for (const a of acts || []) {
        if (my !== token) return;
        if (a.t === 'packet') await packet(a.from, a.to, a.kind, a.label, my, block && a.to === block);
        else if (a.t === 'burst') await Promise.all([].concat(a.from).map(f => packet(f, a.to, a.kind, '', my, block && a.to === block)));
        else if (a.t === 'state') { if (!(block && a.node === block)) setState(a.node, a.s); }
        else if (a.t === 'tag') tag(a.node, a.text);
        if (block && (a.to === block || a.node === block)) return true;
      }
      return false;
    }
    // Ένα βήμα της επίθεσης. chosen: μέτρα της επανάληψης (ή null στο «Πώς έγινε»)
    async function doStep(k, my, chosen) {
      const st = c.steps[k];
      const stops = chosen ? (st.stop || []).filter(id => chosen.has(id)) : [];
      if (stops.length) {
        const def = c.defenses.find(d => d.id === stops[0]);
        if (opts.onSay) opts.onSay(st.say, k, c.steps.length);
        shield(st.stopAt);
        await runActs(st.acts, my, st.stopAt);
        if (my !== token) return 'cancel';
        setState(st.stopAt, 'ok');
        if (opts.sfx) opts.sfx('tick');
        if (opts.onSay) opts.onSay(`🛡️ ${def.label}: ${st.blocked}`, k, c.steps.length, true);
        return 'blocked';
      }
      if (opts.onSay) opts.onSay(st.say, k, c.steps.length);
      await runActs(st.acts, my, null);
      return my === token ? 'done' : 'cancel';
    }
    async function step() {
      if (i >= c.steps.length) return;
      const my = ++token;
      await doStep(i, my, null);
      if (my === token) { i++; if (i >= c.steps.length && opts.onEnd) opts.onEnd({ attack: true }); }
    }
    async function play() {
      if (i >= c.steps.length) reset();
      const my = ++token;
      while (i < c.steps.length && my === token) {
        const r = await doStep(i, my, null);
        if (r === 'cancel') return;
        i++;
        await sleep(motion() ? 1400 : 300);
      }
      if (my === token && opts.onEnd) opts.onEnd({ attack: true });
    }
    async function replay(chosen) {
      reset();
      const my = ++token;
      const set = new Set(chosen);
      for (let k = 0; k < c.steps.length; k++) {
        const r = await doStep(k, my, set);
        if (r === 'cancel') return;
        if (r === 'blocked') { if (opts.onEnd) opts.onEnd({ blocked: true, step: k }); return; }
        await sleep(motion() ? 900 : 200);
      }
      if (my === token && opts.onEnd) opts.onEnd({ blocked: false });
    }
    return { play, step, reset, replay, stop: () => { token++; clearTimeout(timer); }, get index() { return i; } };
  }

  root.IoTCases = { CASES, check, judge, mount, stageSVG };
})(typeof window !== 'undefined' ? window : globalThis);
