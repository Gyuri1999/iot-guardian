/*
 * IoT Guardian — «Μέσα στο breadboard»: κοινό μοντέλο συνδέσεων και σχέδιο από πάνω.
 *
 * Από το manifest της σκηνής (scene.js) βρίσκει ποιο καλώδιο μπαίνει σε ποια στήλη και ποιο πόδι
 * εξαρτήματος είναι στην ίδια στήλη. Το χρησιμοποιούν:
 *   - το scene3d.js για τις μεταλλικές λωρίδες και το ρεύμα στην 3D «ακτινογραφία»,
 *   - το ui.js για το μεγάλο σχέδιο από πάνω (SVG) με αριθμημένες στήλες και προτάσεις.
 * Breadboard: 22 στήλες × 5 τρύπες (a–e). Οι 5 τρύπες κάθε στήλης ενώνονται με μια μεταλλική λωρίδα.
 */
(function (root) {
  'use strict';

  const COLS = 22, ROWS = 5;
  const ROW_NAMES = ['a', 'b', 'c', 'd', 'e'];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Πόδια κάθε εξαρτήματος (συντεταγμένες πάγκου). sig: πόδια σήματος, gnd: πόδι γείωσης, top: ύψος σώματος.
  const PARTS = {
    led: { name: 'LED', gen: 'του LED', legs: (u, v) => [{ u: u - 1.27, v, role: 'sig', label: '+ (μακρύ πόδι)' }, { u: u + 1.27, v, role: 'gnd', label: '− (κοντό πόδι)' }], top: 6 },
    button: { name: 'κουμπί', gen: 'του κουμπιού', legs: (u, v) => [{ u: u - 2.54, v, role: 'sig', label: 'πόδι 1' }, { u: u + 2.54, v, role: 'gnd', label: 'πόδι 2' }], top: 4, input: true },
    buzzer: { name: 'buzzer', gen: 'του buzzer', legs: (u, v) => [{ u: u - 1.27, v, role: 'sig', label: '+' }, { u: u + 1.27, v, role: 'gnd', label: '−' }], top: 4 },
    rgb: { name: 'LED RGB', gen: 'του LED RGB', legs: (u, v) => [{ u: u - 3.81, v, role: 'sig', label: 'πόδι R (κόκκινο)' }, { u: u - 1.27, v, role: 'gnd', label: 'κοινό −' }, { u: u + 1.27, v, role: 'sig', label: 'πόδι G (πράσινο)' }, { u: u + 3.81, v, role: 'sig', label: 'πόδι B (μπλε)' }], top: 6 },
    // pass: πόδια που απλώς περνούν το ρεύμα (σε σειρά με το εξάρτημα της ίδιας στήλης)
    resistor: { name: 'αντίσταση', gen: 'της αντίστασης', legs: (u, v) => [{ u: u - 2.54, v, role: 'pass', label: 'αριστερό πόδι' }, { u: u + 2.54, v, role: 'pass', label: 'δεξί πόδι' }], top: 3.6 },
    pir: { name: 'PIR', gen: 'του PIR', legs: (u, v) => [{ u: u - 6.07, v: v + 5.03, role: 'sig', label: 'pin OUT' }], top: 3.4, input: true },
    // χωρίς u, v στο manifest: οι θέσεις έρχονται από το scene.js (US, TL)
    ultrasonic: { name: 'HC-SR04', gen: 'του αισθητήρα απόστασης', top: 6, legs: (u, v, S) => ['VCC', 'TRIG', 'ECHO', 'GND'].map((n, i) => ({ u: S.US.u + 6.5 + i * 2.54, v: S.US.v + 2.6 + 2.54, role: n === 'GND' ? 'gnd' : n === 'VCC' ? 'pwr' : 'sig', label: 'pin ' + n, input: n === 'ECHO' })) },
    traffic: { name: 'φανάρι', gen: 'του φαναριού', top: 4, legs: (u, v, S) => ['κόκκινο', 'κίτρινο', 'πράσινο'].map((n, i) => ({ u: S.TL.u - 2.54 + i * 2.54, v: S.TL.v + 5 - 2.54, role: 'sig', label: 'πόδι ' + n })) }
  };

  function geom(S) {
    const BB = S.BB;
    const onBB = p => p && p.u >= BB.u && p.u <= BB.u + BB.du && p.v >= BB.v && p.v <= BB.v + BB.dv && (p.h === undefined || p.h < 4);
    // στήλη / σειρά της πλησιέστερης τρύπας (τα κέντρα: u = BB.u + 3.45 + 2.54·i, v = BB.v + 8.45 + 2.54·j)
    const hole = p => ({
      i: Math.max(0, Math.min(COLS - 1, Math.round((p.u - BB.u - 3.45) / 2.54))),
      j: Math.max(0, Math.min(ROWS - 1, Math.round((p.v - BB.v - 8.45) / 2.54)))
    });
    return { BB, onBB, hole };
  }

  // → { parts: [{ t, name, u, v, legs: [{ u, v, role, label, i, j, wire }] }], chains: [{ part, sig, gnd, wire, gndWire, input }] }
  function nets(manifest, S) {
    S = S || root.IoTScene;
    const { onBB, hole } = geom(S);
    const parts = [];
    for (const o of manifest || []) {
      const P = PARTS[o.t];
      if (!P) continue;
      const legs = P.legs(o.u, o.v, S).map(l => Object.assign(l, hole(l), { wire: null }));
      if (!legs.some(l => onBB(l))) continue;
      parts.push({ t: o.t, name: P.name, gen: P.gen, u: o.u, v: o.v, top: P.top, input: !!P.input, legs });
    }
    const wires = (manifest || []).filter(o => o.t === 'wire' && onBB(o.b));
    for (const w of wires) {
      // πρώτα ελεύθερο πόδι στην ίδια στήλη, αλλιώς το πιο κοντινό ελεύθερο
      let best = null, bd = 14;
      for (const p of parts) for (const l of p.legs) {
        if (l.wire) continue;
        const d = Math.abs(l.u - w.b.u) * 10 + Math.abs(l.v - w.b.v);
        if (d < bd * 10) { bd = d / 10; best = l; }
      }
      if (best) { best.wire = w; w.hole = hole(w.b); }
    }
    const chains = [];
    for (const p of parts) {
      const g = p.legs.find(l => l.role === 'gnd' && l.wire);
      for (const l of p.legs) {
        if (l.role !== 'sig') continue;
        let wire = l.wire, via = null;
        if (!wire) { // χωρίς δικό του καλώδιο: ίσως μέσα από αντίσταση στην ίδια στήλη
          const q = passAt(parts, p, l.i);
          const other = q && q.part.legs.find(x => x !== q.leg && x.role === 'pass');
          if (other && other.wire) { wire = other.wire; via = { part: q.part, a: other, b: q.leg }; }
        }
        if (wire) chains.push({ part: p, sig: l, gnd: g || null, wire, gndWire: g ? g.wire : null, input: p.input || !!l.input, via });
      }
    }
    return { parts, chains, wires };
  }

  function passAt(parts, not, i) {
    for (const r of parts) if (r !== not) for (const q of r.legs) if (q.role === 'pass' && q.i === i) return { part: r, leg: q };
    return null;
  }

  // Προτάσεις για κάθε στήλη που χρησιμοποιείται: «Στήλη 3: GPIO 2 και το + πόδι του LED».
  function sentences(n, labels) {
    const lab = w => (labels && labels[w.cls]) || '';
    const out = [];
    for (const p of n.parts) for (const l of p.legs) {
      if (!l.wire) continue;
      const same = l.wire.hole && l.wire.hole.i === l.i;
      out.push({ col: l.i + 1, text: same
        ? `Στήλη ${l.i + 1}: το καλώδιο ${lab(l.wire)}${lab(l.wire) ? ' ' : ''}και το ${l.label} ${p.gen} είναι στην ίδια στήλη, άρα ενώνονται.`
        : `Το καλώδιο ${lab(l.wire)} πάει κατευθείαν στο ${l.label} ${p.gen}.` });
    }
    // πόδια αντίστασης χωρίς καλώδιο: ενώνονται με το πόδι άλλου εξαρτήματος στην ίδια στήλη
    for (const p of n.parts) for (const l of p.legs) {
      if (l.role !== 'pass' || l.wire) continue;
      const mate = n.parts.filter(o => o !== p).flatMap(o => o.legs.filter(x => x.i === l.i).map(x => ({ x, o })))[0];
      if (mate) out.push({ col: l.i + 1, text: `Στήλη ${l.i + 1}: το ${l.label} ${p.gen} και το ${mate.x.label} ${mate.o.gen} είναι στην ίδια στήλη. Έτσι το ρεύμα περνά πρώτα από την αντίσταση, που το περιορίζει για να μην καεί ${mate.o.gen.replace(/^του /, 'το ').replace(/^της /, 'η ')}.` });
    }
    return out.sort((a, b) => a.col - b.col);
  }

  // ------------------------------------------------------------ σχέδιο από πάνω (SVG)
  // Πάνω: τα εξαρτήματα, με τα πόδια τους να κατεβαίνουν στις τρύπες. Μέση: οι στήλες (a–e).
  // Κάτω: τα καλώδια από την πλακέτα ανεβαίνουν στις τρύπες. Η χρωματιστή στήλη δείχνει τι ενώνει.
  const C = 26;
  const X0 = 46;
  const BOARD_Y = 96, NUM_Y = BOARD_Y + 20, ROW0 = BOARD_Y + 40;
  const BOARD_B = ROW0 + (ROWS - 1) * C + 22, TAG_Y = BOARD_B + 34;
  const W = X0 + (COLS - 1) * C + 36, H = TAG_Y + 2 * 26 + 18;
  const hx = i => X0 + i * C, hy = j => ROW0 + j * C;
  const WIRE_COL = { 'w-led': '#e8892f', 'w-btn': '#18a196', 'w-pir': '#e2b52d', 'w-gnd': '#34383f', 'w-buz': '#8e5bd0', 'w-rgbr': '#e0503f', 'w-rgbg': '#3fae55', 'w-rgbb': '#3d8fd6', 'w-trig': '#3fae55', 'w-echo': '#f2c230', 'w-red': '#e0503f', 'w-yel': '#f2c230', 'w-grn': '#3fae55' };

  function svg(manifest, labels, S) {
    const n = nets(manifest, S);
    const used = new Map(); // στήλη → χρώμα του καλωδίου της
    for (const p of n.parts) for (const l of p.legs) if (l.wire && l.wire.hole && l.wire.hole.i === l.i) used.set(l.i, WIRE_COL[l.wire.cls] || '#e8892f');
    for (const c of n.chains) if (c.via && !used.has(c.sig.i)) used.set(c.sig.i, WIRE_COL[c.wire.cls] || '#e8892f');
    let s = `<svg class="bd-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="bd-title"><title id="bd-title">Σχέδιο του breadboard από πάνω: εξαρτήματα πάνω, καλώδια κάτω</title>`;
    s += `<rect x="${X0 - 30}" y="${BOARD_Y}" width="${(COLS - 1) * C + 54}" height="${BOARD_B - BOARD_Y}" rx="10" class="bd-board"/>`;
    for (let i = 0; i < COLS; i++) {
      const col = used.get(i);
      s += `<g class="bd-col${col ? ' used' : ''}" data-i="${i}" tabindex="0" aria-label="Στήλη ${i + 1}: οι 5 τρύπες a έως e είναι ενωμένες"><title>Στήλη ${i + 1}: οι 5 τρύπες (a–e) είναι ενωμένες από κάτω</title>`;
      s += `<rect x="${hx(i) - 10}" y="${hy(0) - 12}" width="20" height="${(ROWS - 1) * C + 24}" rx="10" class="bd-band"${col ? ` style="--c:${col}"` : ''}/>`;
      for (let j = 0; j < ROWS; j++) s += `<rect x="${hx(i) - 4}" y="${hy(j) - 4}" width="8" height="8" rx="2" class="bd-hole"/>`;
      s += `<text x="${hx(i)}" y="${NUM_Y}" class="bd-num">${i + 1}</text></g>`;
    }
    for (let j = 0; j < ROWS; j++) s += `<text x="${X0 - 18}" y="${hy(j) + 4}" class="bd-row">${ROW_NAMES[j]}</text>`;
    // εξαρτήματα πάνω από το breadboard· τα πόδια κατεβαίνουν στην τρύπα τους
    const BODY = BOARD_Y - 34;
    for (const p of n.parts) {
      const xs = p.legs.map(l => hx(l.i));
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      s += `<g class="bd-part bd-${p.t}">`;
      if (p.t === 'resistor') { // ξαπλωμένη πάνω από τη σειρά a, πόδια λοξά προς τις τρύπες
        const RY = BOARD_Y - 14, x0 = Math.min(...xs), x1 = Math.max(...xs);
        for (const l of p.legs) s += `<path d="M${hx(l.i) + (hx(l.i) === x0 ? 8 : -8)},${RY} L${hx(l.i)},${hy(l.j)}" class="bd-leg"/><circle cx="${hx(l.i)}" cy="${hy(l.j)}" r="4.5" class="bd-foot"/>`;
        s += `<rect x="${x0 + 6}" y="${RY - 6}" width="${x1 - x0 - 12}" height="12" rx="6" class="bd-res"/>`;
        s += [['#c0392b', 0.3], ['#c0392b', 0.42], ['#7a4a26', 0.54], ['#c9a227', 0.72]].map(([c, f]) => `<rect x="${x0 + 6 + (x1 - x0 - 12) * f - 2}" y="${RY - 6}" width="4" height="12" style="fill:${c}"/>`).join('');
        s += `<text x="${cx}" y="${RY - 12}" class="bd-pm sm">220 Ω</text></g>`;
        continue;
      }
      for (const l of p.legs) {
        s += `<line x1="${hx(l.i)}" y1="${BODY + 8}" x2="${hx(l.i)}" y2="${hy(l.j)}" class="bd-leg"/><circle cx="${hx(l.i)}" cy="${hy(l.j)}" r="4.5" class="bd-foot"/>`;
      }
      const span = Math.max(...xs) - Math.min(...xs);
      if (p.t === 'led') s += `<path d="M${cx - 11},${BODY + 10} v-12 a11,11 0 0 1 22,0 v12 z" class="bd-led" data-part-led/><text x="${xs[0] - 8}" y="${BODY + 24}" class="bd-pm">+</text><text x="${xs[1] + 8}" y="${BODY + 24}" class="bd-pm">−</text>`;
      else if (p.t === 'button') s += `<rect x="${cx - span / 2 - 10}" y="${BODY - 12}" width="${span + 20}" height="22" rx="4" class="bd-btn"/><circle cx="${cx}" cy="${BODY - 1}" r="7" class="bd-btn-cap"/>`;
      else if (p.t === 'buzzer') s += `<circle cx="${cx}" cy="${BODY - 2}" r="14" class="bd-buz"/>`;
      else if (p.t === 'rgb') s += `<path d="M${cx - 16},${BODY + 10} v-12 a16,16 0 0 1 32,0 v12 z" class="bd-rgb"/>` + p.legs.map(l => `<text x="${hx(l.i)}" y="${BODY + 26}" class="bd-pm sm">${esc(l.label.split(' ')[1] || l.label)}</text>`).join('');
      else if (p.t === 'pir') s += `<rect x="${cx - 20}" y="${BODY - 18}" width="40" height="28" rx="4" class="bd-pir"/><circle cx="${cx}" cy="${BODY - 4}" r="9" class="bd-pir-dome"/>`;
      else s += `<rect x="${cx - span / 2 - 14}" y="${BODY - 14}" width="${span + 28}" height="24" rx="4" class="bd-mod bd-mod-${p.t}"/>`;
      s += `<text x="${cx}" y="${BODY - 26}" class="bd-pname">${esc(p.name)}</text></g>`;
    }
    // καλώδια από κάτω: ετικέτα με το pin της πλακέτας → ευθεία πάνω στην τρύπα
    const inputs = new Set(n.chains.filter(c => c.input).map(c => c.wire));
    const placed = [];
    for (const w of n.wires) {
      if (!w.hole) continue;
      const x = hx(w.hole.i), y = hy(w.hole.j);
      const col = WIRE_COL[w.cls] || '#888';
      const level = placed.filter(px => Math.abs(px - x) < 64).length % 3;
      placed.push(x);
      const ty = TAG_Y + level * 26;
      const d = `M${x},${ty - 9} L${x},${y}`;
      const leg = n.parts.flatMap(p => p.legs).find(l => l.wire === w);
      s += `<g class="bd-wire${w.cls === 'w-gnd' ? ' gnd' : ''}${inputs.has(w) ? ' in' : ''}"${w.id ? ` data-w="${esc(w.id)}"` : ''} data-tx="${x}" data-ty="${ty}" data-hy="${y}" data-col="${leg ? leg.i : -1}" data-color="${col}">` +
        `<path d="${d}" class="bd-wline" style="stroke:${col}"/><path d="${d}" class="bd-flow"/>` +
        `<circle cx="${x}" cy="${y}" r="5.5" class="bd-plug" style="fill:${col}"/>` +
        `<g transform="translate(${x},${ty})"><rect x="-30" y="-10" width="60" height="20" rx="10" class="bd-tag" style="stroke:${col}"/><text y="4" class="bd-tag-t">${esc((labels && labels[w.cls]) || w.cls)}</text></g></g>`;
    }
    s += `<text x="${X0 - 30}" y="${H - 4}" class="bd-from">↑ καλώδια από την πλακέτα</text>`;
    s += '</svg>';
    return { html: s, sentences: sentences(n, labels), nets: n };
  }

  // Ενεργά καλώδια: το καλώδιο σήματος και το GND της ίδιας αλυσίδας «κυλούν» μαζί.
  // isWired(cls): στη λειτουργία «σύνδεσε μόνος σου» τα καλώδια που λείπουν φαίνονται αχνά.
  function sync(el, sceneSvg, n, isWired) {
    if (!el || !sceneSvg || !n) return;
    const shown = n.wires.filter(w => w.hole);
    el.querySelectorAll('.bd-wire').forEach((g, k) => g.classList.toggle('unwired', !!(isWired && shown[k] && !isWired(shown[k].cls))));
    const on = id => { const e = id && sceneSvg.querySelector('#' + id); return !!(e && e.classList.contains('on')); };
    const live = new Set();
    for (const c of n.chains) if (on(c.wire.id)) { live.add(c.wire); if (c.gndWire) live.add(c.gndWire); }
    el.querySelectorAll('.bd-wire').forEach((g, k) => g.classList.toggle('on', live.has(n.wires.filter(w => w.hole)[k])));
    el.querySelectorAll('.bd-col.used').forEach(g => g.classList.toggle('on', live.size > 0));
    const led = el.querySelector('[data-part-led]');
    if (led) led.classList.toggle('lit', on('sc-led'));
  }

  root.IoTBBView = { PARTS, COLS, ROWS, nets, sentences, svg, sync, GEO: { C, X0, ROW0, BOARD_Y, BOARD_B, TAG_Y, W, H, hx, hy } };
})(typeof window !== 'undefined' ? window : globalThis);
