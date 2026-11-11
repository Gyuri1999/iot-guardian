/*
 * IoT Guardian — «Σύνδεσέ το μόνος σου» στο σχέδιο του breadboard (js/bbview.js).
 *
 * Ο μαθητής σέρνει κάθε καλώδιο από την ετικέτα του (π.χ. «GPIO 2») και το αφήνει σε μια τρύπα.
 *   - Όσο σέρνει: το καλώδιο τεντώνεται, η στήλη από κάτω φωτίζεται και ένα μήνυμα λέει τι έχει εκεί.
 *   - Σωστή στήλη (ίδια με το πόδι του εξαρτήματος): το βύσμα κουμπώνει και η στήλη ανάβει.
 *   - Λάθος στήλη: το καλώδιο γυρίζει πίσω και εξηγεί γιατί. Μετά από 2 λάθη δείχνει τη σωστή στήλη.
 *   - Όλα σωστά: το ρεύμα κυλά σε όλο το κύκλωμα.
 * Χωρίς σύρσιμο: πάτα (ή Enter) την ετικέτα και μετά τη στήλη. Esc ακυρώνει.
 * Η άσκηση είναι μόνο στο σχέδιο: δεν αλλάζει τις συνδέσεις του μαθήματος.
 */
(function (root) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  // Μήνυμα για μια απόθεση. legsByCol: στήλη → [{ leg, part }], target: { leg, part }
  function explain(col, wireLabel, target, legsByCol) {
    const want = `${target.leg.label} ${target.part.gen}`;
    if (col === target.leg.i) return { ok: true, text: `Σωστά! Στήλη ${col + 1}: το ${wireLabel} και το ${want} είναι στην ίδια στήλη, άρα ενώνονται.` };
    const here = legsByCol.get(col) || [];
    if (!here.length) return { ok: false, text: `Η στήλη ${col + 1} είναι άδεια: κανένα πόδι δεν είναι εκεί, οπότε το ${wireLabel} δεν θα ενωνόταν με τίποτα. Ψάξε τη στήλη με το ${want}.` };
    const h = here[0];
    return { ok: false, text: `Στη στήλη ${col + 1} είναι το ${h.leg.label} ${h.part.gen}, όχι το ${want}. Το ${wireLabel} πάει στη στήλη με το ${want}.` };
  }

  // Ετικέτες ανακατεμένες στο κάτω μέρος, ώστε να μην είναι ήδη κάτω από τη σωστή στήλη.
  function shuffledSlots(n, G, rnd) {
    const order = [...Array(n).keys()];
    for (let k = n - 1; k > 0; k--) { const r = Math.floor(rnd() * (k + 1)); [order[k], order[r]] = [order[r], order[k]]; }
    const perRow = Math.max(1, Math.floor((G.W - 60) / 70));
    const rows = Math.ceil(n / perRow);
    return order.map(k => {
      const row = Math.floor(k / perRow), inRow = Math.min(perRow, n - row * perRow);
      const span = (G.W - 60) / inRow;
      return { x: 30 + span * (k % perRow + 0.5), y: G.TAG_Y + row * 26 + (rows === 1 ? 10 : 0) };
    });
  }

  function mount(host, view, opts) {
    opts = opts || {};
    const BV = root.IoTBBView;
    const G = BV.GEO;
    const svg = host.querySelector('.bd-svg');
    if (!svg) return null;
    const original = host.innerHTML;
    const n = view.nets;
    const labels = opts.labels || {};
    const sfx = name => { if (opts.sfx) opts.sfx(name); };
    const say = t => { if (opts.message) opts.message(t); };
    const reduced = () => !!(opts.reducedMotion && opts.reducedMotion());

    const legsByCol = new Map();
    for (const p of n.parts) for (const l of p.legs) { if (!legsByCol.has(l.i)) legsByCol.set(l.i, []); legsByCol.get(l.i).push({ leg: l, part: p }); }
    const shown = n.wires.filter(w => w.hole);
    const groups = [...svg.querySelectorAll('.bd-wire')];
    const slots = shuffledSlots(groups.length, G, opts.random || Math.random);

    svg.classList.add('bp-on');
    const items = groups.map((g, k) => {
      const w = shown[k];
      const leg = n.parts.flatMap(p => p.legs).find(l => l.wire === w);
      const part = n.parts.find(p => p.legs.includes(leg));
      const it = { g, w, leg, part, label: labels[w.cls] || w.cls, tx: slots[k].x, ty: slots[k].y, done: false, miss: 0, ex: 0, ey: 0 };
      g.classList.remove('on', 'unwired');
      g.classList.add('bp-loose');
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', `Καλώδιο ${it.label}: σύρε το σε μια στήλη του breadboard`);
      g.querySelector('g').setAttribute('transform', `translate(${it.tx},${it.ty})`);
      place(it, it.tx, it.ty - 14);
      return it;
    });
    svg.querySelectorAll('.bd-col.used').forEach(c => { c.classList.remove('used', 'on'); c.querySelector('.bd-band').removeAttribute('style'); });
    const led = svg.querySelector('[data-part-led]');
    if (led) led.classList.remove('lit');
    const cols = [...svg.querySelectorAll('.bd-col')];

    function place(it, ex, ey) {
      it.ex = ex; it.ey = ey;
      const x0 = it.tx, y0 = it.ty - 9;
      const dy = Math.max(20, (y0 - ey) * 0.5);
      const d = `M${x0},${y0} C${x0},${y0 - dy} ${ex},${ey + dy} ${ex},${ey}`;
      it.g.querySelectorAll('.bd-wline, .bd-flow').forEach(p => p.setAttribute('d', d));
      const plug = it.g.querySelector('.bd-plug');
      plug.setAttribute('cx', ex); plug.setAttribute('cy', ey);
    }
    // κίνηση του άκρου προς (x, y)· easeOutBack για «ελατήριο»
    function animateTo(it, x, y, ms, back, done) {
      if (reduced()) { place(it, x, y); if (done) done(); return; }
      const sx = it.ex, sy = it.ey, t0 = performance.now();
      const ease = t => back ? 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2) : 1 - Math.pow(1 - t, 3);
      const step = now => {
        const t = Math.min(1, (now - t0) / ms), e = ease(t);
        place(it, sx + (x - sx) * e, sy + (y - sy) * e);
        if (t < 1) req(step); else if (done) done();
      };
      req(step);
    }
    const req = f => { let fired = false; const run = now => { if (!fired) { fired = true; f(now || performance.now()); } }; requestAnimationFrame(run); setTimeout(() => run(performance.now()), 40); };

    const toSvg = e => {
      const m = svg.getScreenCTM();
      if (!m) return { x: 0, y: 0 };
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      return { x: p.x, y: p.y };
    };
    const colAt = (x, y) => {
      if (y < G.BOARD_Y - 6 || y > G.BOARD_B + 6) return -1;
      const i = Math.round((x - G.X0) / G.C);
      return i >= 0 && i < BV.COLS && Math.abs(x - G.hx(i)) <= G.C / 2 ? i : -1;
    };
    const rowAt = y => Math.max(0, Math.min(BV.ROWS - 1, Math.round((y - G.ROW0) / G.C)));
    const hover = i => cols.forEach((c, k) => c.classList.toggle('bp-hover', k === i));
    const hereText = i => {
      const here = legsByCol.get(i) || [];
      return here.length ? `Στήλη ${i + 1}: εδώ είναι το ${here[0].leg.label} ${here[0].part.gen}.` : `Στήλη ${i + 1}: άδεια.`;
    };

    function ripple(x, y, color) {
      if (reduced()) return;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 6);
      c.setAttribute('class', 'bp-ripple');
      c.style.stroke = color;
      svg.appendChild(c);
      setTimeout(() => c.remove(), 700);
    }

    function connect(it, i, j) {
      const res = explain(i, it.label, { leg: it.leg, part: it.part }, legsByCol);
      if (res.ok) {
        it.done = true;
        it.g.classList.remove('bp-loose', 'bp-sel', 'bp-drag');
        it.g.classList.add('bp-done');
        it.g.setAttribute('aria-label', `Καλώδιο ${it.label}: συνδέθηκε στη στήλη ${i + 1}`);
        const x = G.hx(i), y = G.hy(j);
        animateTo(it, x, y, 140, false, () => ripple(x, y, it.g.dataset.color));
        const c = cols[i];
        c.classList.add('used', 'bp-snap');
        c.querySelector('.bd-band').style.setProperty('--c', it.g.dataset.color);
        setTimeout(() => c.classList.remove('bp-snap'), 700);
        sfx('tick');
        say(res.text);
        if (items.every(x => x.done)) setTimeout(win, reduced() ? 0 : 450);
      } else {
        it.miss++;
        it.g.classList.remove('bp-drag');
        sfx('err');
        if (cols[i]) { cols[i].classList.add('bp-wrong'); setTimeout(() => cols[i].classList.remove('bp-wrong'), 600); }
        animateTo(it, it.tx, it.ty - 14, 420, true);
        let text = res.text;
        if (it.miss >= 2) { text += ` Βοήθεια: είναι η στήλη ${it.leg.i + 1}, που αναβοσβήνει.`; cols[it.leg.i].classList.add('bp-hint'); }
        say(text);
      }
    }

    function win() {
      svg.classList.add('bp-win');
      items.forEach(it => it.g.classList.add('on'));
      cols.forEach(c => c.classList.contains('used') && c.classList.add('on'));
      if (led) led.classList.add('lit');
      sfx('win');
      say('Μπράβο! Συνέδεσες όλα τα καλώδια στις σωστές στήλες. Δες το ρεύμα να κυλά: από το pin, μέσα από το εξάρτημα, στη γείωση (GND).');
      if (opts.onWin) opts.onWin();
    }

    // ---- σύρσιμο με ποντίκι / δάχτυλο
    let drag = null, sel = null;
    const select = it => {
      if (sel) sel.g.classList.remove('bp-sel');
      sel = it;
      if (it) { it.g.classList.add('bp-sel'); say(`Διάλεξες το ${it.label}. Τώρα πάτα μια στήλη του breadboard.`); }
    };
    const onDown = e => {
      const g = e.target.closest && e.target.closest('.bd-wire.bp-loose');
      if (!g || e.button > 0) return;
      const it = items.find(x => x.g === g);
      e.preventDefault();
      drag = { it, id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* παλιός browser */ }
    };
    const onMove = e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      if (!drag.moved) { drag.moved = true; select(null); drag.it.g.classList.add('bp-drag'); sfx('click'); drag.last = -2; }
      const p = toSvg(e);
      place(drag.it, p.x, p.y);
      const i = colAt(p.x, p.y);
      hover(i);
      if (i !== drag.last) { drag.last = i; if (i >= 0) say(hereText(i)); }
    };
    const onUp = e => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      hover(-1);
      if (!d.moved) { select(sel === d.it ? null : d.it); return; }
      const p = toSvg(e);
      const i = colAt(p.x, p.y);
      if (i < 0) { d.it.g.classList.remove('bp-drag'); animateTo(d.it, d.it.tx, d.it.ty - 14, 380, true); say(`Το ${d.it.label} γύρισε πίσω. Άφησέ το πάνω σε μια στήλη του breadboard.`); return; }
      connect(d.it, i, rowAt(p.y));
    };
    const onCancel = e => { if (drag && e.pointerId === drag.id) { const it = drag.it; drag = null; hover(-1); it.g.classList.remove('bp-drag'); animateTo(it, it.tx, it.ty - 14, 300, true); } };
    // ---- πάτημα: πρώτα καλώδιο, μετά στήλη (και με πληκτρολόγιο)
    const onClick = e => {
      const c = e.target.closest && e.target.closest('.bd-col');
      if (c && sel) { const it = sel; select(null); connect(it, +c.dataset.i, BV.ROWS - 1); }
    };
    const onKey = e => {
      if (e.key === 'Escape' && sel) { select(null); say('Ακυρώθηκε.'); return; }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const g = e.target.closest && e.target.closest('.bd-wire.bp-loose');
      if (g) { e.preventDefault(); const it = items.find(x => x.g === g); select(sel === it ? null : it); return; }
      const c = e.target.closest && e.target.closest('.bd-col');
      if (c && sel) { e.preventDefault(); const it = sel; select(null); connect(it, +c.dataset.i, BV.ROWS - 1); it.g.focus(); }
      else if (c) say(hereText(+c.dataset.i) + ' Διάλεξε πρώτα ένα καλώδιο.');
    };
    const onFocus = e => { const c = e.target.closest && e.target.closest('.bd-col'); if (c && sel) say(hereText(+c.dataset.i)); };
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
    svg.addEventListener('pointercancel', onCancel);
    svg.addEventListener('click', onClick);
    svg.addEventListener('keydown', onKey);
    svg.addEventListener('focusin', onFocus);
    say('Σύρε κάθε καλώδιο από την ετικέτα του (κάτω) σε μια στήλη του breadboard. Βάλ\' το στη στήλη με το σωστό πόδι.');

    return {
      items,
      done: () => items.every(x => x.done),
      // για τα τεστ / πληκτρολόγιο: σύνδεσε το καλώδιο k στη στήλη i
      drop: (k, i) => connect(items[k], i, BV.ROWS - 1),
      destroy() { host.innerHTML = original; }
    };
  }

  root.IoTBBPractice = { mount, explain, shuffledSlots };
})(typeof window !== 'undefined' ? window : globalThis);
