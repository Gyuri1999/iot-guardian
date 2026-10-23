/*
 * IoT Guardian — το σπίτι-χάρτης της αρχικής οθόνης.
 * Ένα ισομετρικό σπίτι σε τομή (χωρίς ταβάνι) με τα 8 θεματικά δωμάτια. Κάθε δωμάτιο κρατά τα κεφάλαια
 * της διαδρομής που ανήκουν σε αυτό (IoTThemes.BY_CHAPTER):
 *   done      όλα τα κεφάλαια τελείωσαν → τα φώτα ανάβουν
 *   current   εδώ είναι η επόμενη άσκηση → καρφίτσα «Είσαι εδώ»
 *   open      ξεκλείδωτο, όχι ακόμα τελειωμένο
 *   locked    κλειδωμένο
 *   empty     η διαδρομή δεν έχει κεφάλαιο εδώ (το δωμάτιο φαίνεται σβηστό)
 * Μόνο SVG· τα κλικ τα χειρίζεται το ui.js (data-room).
 */
(function (root) {
  'use strict';

  const K = 2.4;
  const C = Math.cos(Math.PI / 6);
  const S = 0.5;
  const P = (u, v, h) => [(u - v) * C * K, (u + v) * S * K - (h || 0) * K];
  const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const poly = (pts, cls) => `<polygon points="${pts.map(pt).join(' ')}" class="${cls}"/>`;

  const RW = 42;
  const RD = 36;
  const WH = 30;
  const COLS = 4;
  const W = RW * COLS;
  const D = RD * 2;

  // Θέση κάθε δωματίου: πίσω σειρά (κολλητά στον τοίχο) και μπροστινή σειρά.
  const ROOMS = {
    entrance: { c: 0, r: 0, name: 'Είσοδος' },
    livingroom: { c: 1, r: 0, name: 'Σαλόνι' },
    greenhouse: { c: 2, r: 0, name: 'Θερμοκήπιο' },
    serverroom: { c: 3, r: 0, name: 'Δωμάτιο servers' },
    desk: { c: 0, r: 1, name: 'Γραφείο' },
    hallway: { c: 1, r: 1, name: 'Διάδρομος' },
    workshop: { c: 2, r: 1, name: 'Εργαστήρι' },
    garage: { c: 3, r: 1, name: 'Γκαράζ' }
  };

  const floorRect = (u0, v0, u1, v1, cls) => poly([P(u0, v0, 0), P(u1, v0, 0), P(u1, v1, 0), P(u0, v1, 0)], cls);
  const wallA = (u0, u1, h0, h1, cls) => poly([P(u0, 0, h0), P(u1, 0, h0), P(u1, 0, h1), P(u0, 0, h1)], cls);
  const wallB = (v0, v1, h0, h1, cls) => poly([P(0, v0, h0), P(0, v1, h0), P(0, v1, h1), P(0, v0, h1)], cls);
  function block(u, v, h, du, dv, dh, cls) {
    return `<g class="hb ${cls}">` +
      poly([P(u, v + dv, h), P(u + du, v + dv, h), P(u + du, v + dv, h + dh), P(u, v + dv, h + dh)], 'f-l') +
      poly([P(u + du, v, h), P(u + du, v + dv, h), P(u + du, v + dv, h + dh), P(u + du, v, h + dh)], 'f-r') +
      poly([P(u, v, h + dh), P(u + du, v, h + dh), P(u + du, v + dv, h + dh), P(u, v + dv, h + dh)], 'f-t') + '</g>';
  }
  const dot = (u, v, h, r, cls) => { const q = P(u, v, h); return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${r}" class="${cls}"/>`; };

  // Μικρά έπιπλα σε κάθε δωμάτιο (συντεταγμένες από τη γωνία του δωματίου).
  const PROPS = {
    desk: (u, v) => block(u + 8, v + 6, 0, 20, 9, 8, 'p-wood') + block(u + 13, v + 8, 8, 9, 2, 6, 'p-screen') + block(u + 30, v + 8, 0, 2, 2, 16, 'p-dark') + dot(u + 31, v + 9, 17, 3.2, 'p-bulb'),
    entrance: (u, v) => wallA(u + 14, u + 26, 0, 21, 'p-door') + dot(u + 24.5, v, 10, 1.1, 'p-knob') + floorRect(u + 13, v + 1, u + 27, v + 7, 'p-mat') + wallA(u + 30, u + 32, 11, 14, 'p-bell') + wallA(u + 18, u + 22, 23, 25, 'p-bulb'),
    livingroom: (u, v) => floorRect(u + 6, v + 12, u + 36, v + 30, 'p-rug') + block(u + 8, v + 2, 0, 26, 9, 6, 'p-sofa') + block(u + 8, v + 2, 6, 26, 3, 6, 'p-sofa') + wallA(u + 10, u + 32, 12, 24, 'p-window') + block(u + 34, v + 26, 0, 2, 2, 16, 'p-dark') + dot(u + 35, v + 27, 17, 3.2, 'p-bulb'),
    greenhouse: (u, v) => wallA(u + 2, u + 40, 3, 28, 'p-glass') + block(u + 4, v + 2, 0, 34, 7, 6, 'p-wood') + [8, 15, 22, 29, 36].map(x => dot(u + x, v + 5.5, 10, 3.4, 'p-leaf')).join('') + floorRect(u + 4, v + 20, u + 20, v + 32, 'p-soil'),
    serverroom: (u, v) => [4, 16, 28].map(x => block(u + x, v + 2, 0, 9, 8, 22, 'p-rack') + [5, 10, 15, 20].map(h => dot(u + x + 7, v + 10, h, 0.9, 'p-led')).join('')).join(''),
    hallway: (u, v) => floorRect(u + 4, v + 12, u + 38, v + 22, 'p-runner') + block(u + 30, v + 14, 0, 4, 4, 3, 'p-pir') + dot(u + 20, v + 16, 24, 4, 'p-bulb'),
    workshop: (u, v) => block(u + 6, v + 4, 0, 30, 9, 9, 'p-wood') + block(u + 10, v + 6, 9, 8, 5, 4, 'p-crate') + block(u + 22, v + 6, 9, 6, 5, 2, 'p-tool') + block(u + 8, v + 22, 0, 8, 6, 5, 'p-crate'),
    garage: (u, v) => floorRect(u + 12, v + 4, u + 13.4, v + 32, 'p-line') + floorRect(u + 30, v + 4, u + 31.4, v + 32, 'p-line') + block(u + 15, v + 10, 1.2, 13, 20, 6, 'p-car') + block(u + 17, v + 16, 7.2, 9, 9, 4, 'p-car') + dot(u + 15, v + 13, 1.6, 1.8, 'p-wheel') + dot(u + 15, v + 26, 1.6, 1.8, 'p-wheel')
  };

  function lockIcon(x, y) {
    return `<g class="hm-lock" transform="translate(${x.toFixed(1)},${y.toFixed(1)})"><rect x="-5" y="-1" width="10" height="8" rx="1.6"/><path d="M-3,-1 v-3 a3,3 0 0 1 6,0 v3"/></g>`;
  }

  // rooms: { key: { state, done, total, label } }
  function render(rooms) {
    const order = Object.keys(ROOMS).sort((a, b) => (ROOMS[a].c + ROOMS[a].r) - (ROOMS[b].c + ROOMS[b].r) || ROOMS[a].r - ROOMS[b].r);
    let floors = '';
    let props = '';
    let labels = '';
    for (const key of order) {
      const R = ROOMS[key];
      const st = (rooms[key] && rooms[key].state) || 'empty';
      const u = R.c * RW;
      const v = R.r * RD;
      const mid = P(u + RW / 2, v + RD / 2, 0);
      const info = rooms[key];
      const aria = info && st !== 'empty' ? `${R.name}: ${info.label}` : `${R.name}: δεν υπάρχει κεφάλαιο σε αυτή τη διαδρομή`;
      const live = st !== 'empty' && st !== 'locked';
      floors += `<g class="hm-room st-${st}" data-room="${key}"${st !== 'empty' ? ` tabindex="0" role="button" aria-label="${aria}"` : ' aria-hidden="true"'}>`
        + floorRect(u + 0.6, v + 0.6, u + RW - 0.6, v + RD - 0.6, `hm-floor fl-${key}`)
        + (st === 'done' ? `<ellipse cx="${mid[0].toFixed(1)}" cy="${mid[1].toFixed(1)}" rx="${(RW * 1.5).toFixed(0)}" ry="${(RD * 1.0).toFixed(0)}" class="hm-glow"/>` : '')
        + `<g class="hm-props">${PROPS[key](u, v)}</g>`
        + (st === 'locked' ? floorRect(u + 0.6, v + 0.6, u + RW - 0.6, v + RD - 0.6, 'hm-shade') : '')
        + floorRect(u + 0.6, v + 0.6, u + RW - 0.6, v + RD - 0.6, 'hm-hit')
        + '</g>';
      if (st !== 'empty') {
        const top = P(u + RW / 2, v + RD * 0.62, 12);
        const text = `${R.name}${info && info.total ? ` · ${info.done}/${info.total}` : ''}`;
        const w = 22 + text.length * 6.2;
        labels += `<g class="hm-label st-${st}" data-room="${key}" transform="translate(${top[0].toFixed(1)},${top[1].toFixed(1)})">`
          + `<rect x="${(-w / 2).toFixed(1)}" y="-10" width="${w.toFixed(1)}" height="20" rx="10" class="hm-pill"/>`
          + (st === 'locked' ? lockIcon(-w / 2 + 11, -3.5) : st === 'done' ? `<text x="${(-w / 2 + 11).toFixed(1)}" y="4.5" text-anchor="middle" class="hm-star">${info.fixed ? '🔧' : '★'}</text>` : `<circle cx="${(-w / 2 + 11).toFixed(1)}" cy="0" r="3.6" class="hm-dot"/>`)
          + (info.alarm ? `<g class="hm-alarm" transform="translate(${(w / 2 - 2).toFixed(1)},-11)"><circle r="8"/><text y="3.6" text-anchor="middle">!</text></g>` : '')
          + `<text x="${(9).toFixed(1)}" y="4.2" text-anchor="middle" class="hm-t">${text}</text>`
          + (st === 'current' ? `<g class="hm-pin" transform="translate(0,-16)"><path d="M0,0 C-7,-8 -7,-17 0,-17 C7,-17 7,-8 0,0 Z"/><circle cx="0" cy="-11" r="2.6"/></g>` : '')
          + '</g>';
      }
      void live;
    }
    // τοίχοι του σπιτιού (πίσω και αριστερά) και χαμηλά χωρίσματα ανάμεσα στα δωμάτια
    let walls = wallA(0, W, 0, WH, 'hm-wall-a') + wallB(0, D, 0, WH, 'hm-wall-b');
    walls += `<path d="M${pt(P(0, D, WH))} L${pt(P(0, 0, WH))} L${pt(P(W, 0, WH))}" class="hm-edge"/>`;
    let parts = '';
    for (let c = 1; c < COLS; c++) parts += block(c * RW - 0.8, 0, 0, 1.6, D, 4, 'hm-part');
    parts += block(0, RD - 0.8, 0, W, 1.6, 4, 'hm-part');
    const b = [P(0, D, 0)[0] - 30, P(0, 0, WH)[1] - 16, P(W, 0, 0)[0] + 30, P(W, D, 0)[1] + 20];
    return `<svg class="house-map" viewBox="${b[0].toFixed(0)} ${b[1].toFixed(0)} ${(b[2] - b[0]).toFixed(0)} ${(b[3] - b[1]).toFixed(0)}" role="group" aria-label="Το σπίτι: κάθε δωμάτιο είναι ένα κομμάτι της διαδρομής σου">
      <defs><radialGradient id="hm-warm"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.75"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>
      <ellipse cx="${P(W / 2, D / 2, 0)[0].toFixed(1)}" cy="${(P(W / 2, D / 2, 0)[1] + 8).toFixed(1)}" rx="${(W * 1.25).toFixed(0)}" ry="${(D * 1.35).toFixed(0)}" class="hm-ground"/>
      ${walls}${floors}${parts}${props}<g class="hm-labels">${labels}</g>
    </svg>`;
  }

  root.IoTHouse = { render, ROOMS };
})(typeof window !== 'undefined' ? window : globalThis);
