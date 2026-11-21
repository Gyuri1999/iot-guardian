/*
 * IoT Guardian — «Πάγκος»: η συναρμολόγηση σαν εικονογράφηση, σε 4 βήματα.
 *   1. το ESP32 μπαίνει στο breadboard
 *   2. τα εξαρτήματα (LED, αντίσταση, κουμπί …) μπαίνουν στις τρύπες
 *   3. τα καλώδια ένα-ένα, με ετικέτα «GPIO 2», «GND» στο pin τους
 *   4. «τρέχει ο κώδικας»: το ρεύμα κυλά και το LED ανάβει
 * Το σχέδιο φτιάχνεται από το ίδιο μοντέλο συνδέσεων με το «Μέσα» (bbview.js → nets), άρα ταιριάζει
 * με κάθε άσκηση. Σχέδιο: λευκό breadboard με κόκκινη (+) και μπλε (−) γραμμή, ESP32 DevKit από πάνω.
 * Με «λιγότερη κίνηση» τα βήματα αλλάζουν χωρίς κίνηση και το LED μένει σταθερά αναμμένο.
 */
(function (root) {
  'use strict';
  const doc = typeof document !== 'undefined' ? document : null;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------ γεωμετρία
  const P = 26; // απόσταση τρυπών
  const cx = c => 100 + c * P;
  const ROW = { A: 178, B: 204, C: 230, D: 256, E: 282, F: 340, G: 366, H: 392, I: 418, J: 444 };
  const RAIL = { tp: 106, tm: 130, bp: 492, bm: 516 }; // πάνω +/−, κάτω +/−
  const BOARD = { y: 70, b: 552 };
  const ESP = { x: 182, w: 200, y: 26, b: 560, lx: cx(4), rx: cx(10) };
  const PIN_Y = i => 116 + i * 22;
  // ίδια σειρά pins με το scene.js (38 pins, η κεραία πάνω)
  const RIGHT_ROW = ['GND', 'D23', 'D22', 'TX', 'RX', 'D21', 'GND2', 'D19', 'D18', 'D5', 'D17', 'D16', 'D4', 'D0', 'D2', 'D15', 'SD1', 'SD0', 'CLK'];
  const LEFT_ROW = ['3V3', 'EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'GND3', 'D13', 'SD2', 'SD3', 'CMD', '5V'];
  const PART0 = 18; // πρώτη στήλη για εξαρτήματα (δεξιά από το ESP32)

  const COLORS = {
    'w-led': ['#f5c518', 'Κίτρινο'], 'w-gnd': ['#26292f', 'Μαύρο'], 'w-btn': ['#22b5a5', 'Τιρκουάζ'], 'w-pir': ['#ff8a3d', 'Πορτοκαλί'],
    'w-buz': ['#9b6bdf', 'Μωβ'], 'w-rgbr': ['#e5483b', 'Κόκκινο'], 'w-rgbg': ['#3fbf5a', 'Πράσινο'], 'w-rgbb': ['#3d8fe0', 'Μπλε'],
    'w-trig': ['#3fbf5a', 'Πράσινο'], 'w-echo': ['#3d8fe0', 'Μπλε'], 'w-red': ['#e5483b', 'Κόκκινο'], 'w-yel': ['#f5c518', 'Κίτρινο'], 'w-grn': ['#3fbf5a', 'Πράσινο'],
    pwr: ['#e5483b', 'Κόκκινο']
  };
  const colOf = cls => COLORS[cls] || ['#ff8a3d', 'Πορτοκαλί'];

  function pinXY(name) {
    let i = RIGHT_ROW.indexOf(name);
    if (i >= 0) return { x: ESP.rx, y: PIN_Y(i), side: 'r', name };
    i = LEFT_ROW.indexOf(name);
    return { x: ESP.lx, y: PIN_Y(Math.max(0, i)), side: 'l', name };
  }

  // πολυγραμμή → path με στρογγυλές γωνίες (σαν λυγισμένο καλώδιο)
  function rounded(pts, r) {
    r = r || 12;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let k = 1; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], [x2, y2] = pts[k + 1];
      const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
      const q = Math.min(r, l1 / 2, l2 / 2);
      const a = [x1 - (x1 - x0) / (l1 || 1) * q, y1 - (y1 - y0) / (l1 || 1) * q];
      const b = [x1 + (x2 - x1) / (l2 || 1) * q, y1 + (y2 - y1) / (l2 || 1) * q];
      d += ` L${a[0].toFixed(1)},${a[1].toFixed(1)} Q${x1},${y1} ${b[0].toFixed(1)},${b[1].toFixed(1)}`;
    }
    const e = pts[pts.length - 1];
    return d + ` L${e[0]},${e[1]}`;
  }

  // ------------------------------------------------------------ διάταξη από το μοντέλο συνδέσεων
  // → { cols, parts: [{ p, legs: [{ leg, col, wire, via }], x0, x1 }], wires: [...], jumpers: [...], resistors: [...] }
  function layout(n, labels) {
    const lab = cls => (labels && labels[cls]) || cls;
    const viaOf = leg => { const ch = n.chains.find(c => c.sig === leg && c.via); return ch ? ch : null; };
    const out = { parts: [], wires: [], jumpers: [], resistors: [], power: false };
    let col = PART0;
    for (const p of n.parts) {
      if (p.t === 'resistor') continue;
      const legs = p.legs.map(l => ({ leg: l, role: l.role, label: l.label }));
      if (!legs.some(l => l.role === 'gnd')) legs.push({ leg: null, role: 'gnd', label: '− (GND)', implied: true });
      if (p.t === 'pir') legs.unshift({ leg: null, role: 'pwr', label: '+ (VCC)', implied: true });
      const placed = { p, legs: [], x0: 0, x1: 0 };
      const step = p.t === 'button' ? 2 : 1;
      legs.forEach((L, k) => {
        const ch = L.leg && L.role === 'sig' ? viaOf(L.leg) : null;
        if (ch && k === 0) col += 3; // χώρος για την αντίσταση πριν από το πρώτο πόδι
        L.col = col;
        if (L.role === 'sig' && L.leg) {
          const w = L.leg.wire || (ch && ch.wire);
          if (w) {
            const wc = ch ? col - 3 : col;
            if (ch) out.resistors.push({ c0: col - 3, c1: col });
            out.wires.push({ cls: w.cls, id: w.id, from: pinXY((w.a && w.a.name) || 'D2'), col: wc, label: lab(w.cls), part: p, leg: L, via: !!ch, input: p.input || !!L.leg.input });
          }
        }
        if (L.role === 'gnd') out.jumpers.push({ col, rail: 'bm', part: p, leg: L });
        if (L.role === 'pwr') { out.jumpers.push({ col, rail: 'bp', part: p, leg: L }); out.power = true; }
        placed.legs.push(L);
        col += step;
      });
      placed.x0 = cx(placed.legs[0].col);
      placed.x1 = cx(placed.legs[placed.legs.length - 1].col);
      out.parts.push(placed);
      col += 2;
    }
    out.cols = Math.max(30, col + 1);
    return out;
  }

  // ------------------------------------------------------------ σχέδιο
  function holes(cols) {
    let s = '';
    for (let c = 0; c < cols; c++) {
      if (c >= 3 && c <= 11) continue; // κάτω από το ESP32
      for (const y of Object.values(ROW)) s += `<rect x="${cx(c) - 4}" y="${y - 4}" width="8" height="8" rx="1.6" class="bn-hole"/>`;
      if (c % 6 !== 5) for (const y of Object.values(RAIL)) s += `<rect x="${cx(c) - 4}" y="${y - 4}" width="8" height="8" rx="1.6" class="bn-hole"/>`;
    }
    return s;
  }

  function board(cols) {
    const x = 50, w = cx(cols - 1) + 46 - x;
    let s = `<g class="bn-bb">`;
    s += `<rect x="${x + 6}" y="${BOARD.y + 12}" width="${w}" height="${BOARD.b - BOARD.y}" rx="18" class="bn-bb-shadow"/>`;
    s += `<rect x="${x}" y="${BOARD.y + 8}" width="${w}" height="${BOARD.b - BOARD.y}" rx="18" class="bn-bb-side"/>`;
    s += `<rect x="${x}" y="${BOARD.y}" width="${w}" height="${BOARD.b - BOARD.y}" rx="18" class="bn-bb-top"/>`;
    s += `<rect x="${x + 14}" y="${311 - 7}" width="${w - 28}" height="14" rx="6" class="bn-gap"/>`;
    // κόκκινη (+) και μπλε (−) γραμμή, πάνω και κάτω
    const line = (y, cls) => `<line x1="${x + 40}" y1="${y}" x2="${x + w - 40}" y2="${y}" class="${cls}"/>`;
    s += line(RAIL.tp - 16, 'bn-red') + line(RAIL.tm + 16, 'bn-blue') + line(RAIL.bp - 16, 'bn-red') + line(RAIL.bm + 16, 'bn-blue');
    for (const [y, t, c] of [[RAIL.tp, '+', 'bn-plus'], [RAIL.tm, '−', 'bn-minus'], [RAIL.bp, '+', 'bn-plus'], [RAIL.bm, '−', 'bn-minus']]) {
      s += `<text x="${x + 20}" y="${y + 7}" class="${c}">${t}</text><text x="${x + w - 20}" y="${y + 7}" class="${c}">${t}</text>`;
    }
    for (const [k, y] of Object.entries(ROW)) s += `<text x="${x + 22}" y="${y + 6}" class="bn-rowl">${k}</text>`;
    s += holes(cols) + '</g>';
    return s;
  }

  function esp32() {
    const { x, w, y, b } = ESP;
    let s = `<g class="bn-esp" data-st="1">`;
    s += `<rect x="${x + 8}" y="${y + 14}" width="${w}" height="${b - y}" rx="14" class="bn-esp-shadow"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${b - y}" rx="14" class="bn-pcb"/>`;
    for (const [hx, hy] of [[x + 18, y + 18], [x + w - 18, y + 18], [x + 18, b - 18], [x + w - 18, b - 18]]) s += `<circle cx="${hx}" cy="${hy}" r="9" class="bn-mhole"/>`;
    // κεραία (χρυσό ζιγκ-ζαγκ)
    const ax = x + 46;
    s += `<path d="M${ax},${y + 54} v-26 h18 v18 h18 v-18 h18 v18 h18 v-18 h18 v18 h14 v-18" class="bn-ant"/>`;
    // μεταλλικό κουτί με το Wi-Fi
    const mx = x + 40, my = y + 66, mw = w - 80, mh = 150;
    for (let k = 0; k < 9; k++) s += `<rect x="${mx - 8}" y="${my + 10 + k * 15}" width="6" height="8" class="bn-pad"/><rect x="${mx + mw + 2}" y="${my + 10 + k * 15}" width="6" height="8" class="bn-pad"/>`;
    for (let k = 0; k < 7; k++) s += `<rect x="${mx + 10 + k * 15}" y="${my + mh + 2}" width="8" height="7" class="bn-pad"/>`;
    s += `<rect x="${mx}" y="${my}" width="${mw}" height="${mh}" rx="6" class="bn-can"/><rect x="${mx + 5}" y="${my + 5}" width="${mw - 10}" height="${mh - 10}" rx="4" class="bn-can-in"/>`;
    const wx = mx + mw / 2, wy = my + 54;
    s += `<path d="M${wx - 24},${wy - 8} q24,-22 48,0 M${wx - 16},${wy} q16,-14 32,0 M${wx - 8},${wy + 8} q8,-7 16,0" class="bn-wifi"/><circle cx="${wx}" cy="${wy + 15}" r="3.6" class="bn-wifi-dot"/>`;
    s += `<text x="${wx}" y="${my + 104}" class="bn-esp-t">ESP32</text><text x="${wx}" y="${my + 128}" class="bn-esp-s">Wi-Fi + Bluetooth</text>`;
    // μικρά τσιπάκια, λυχνία ρεύματος, κουμπιά EN/BOOT, USB-C
    s += `<rect x="${x + 64}" y="${y + 268}" width="22" height="14" rx="2" class="bn-chip"/><rect x="${x + 112}" y="${y + 268}" width="14" height="14" rx="2" class="bn-chip"/>`;
    s += `<rect x="${x + 96}" y="${y + 300}" width="12" height="18" rx="3" class="bn-pled"/>`;
    s += `<rect x="${x + 60}" y="${y + 340}" width="30" height="30" rx="3" class="bn-chip"/><rect x="${x + 112}" y="${y + 336}" width="40" height="38" rx="3" class="bn-chip"/>`;
    for (let k = 0; k < 4; k++) s += `<rect x="${x + 114 + k * 10}" y="${y + 378}" width="5" height="9" class="bn-pad"/>`;
    for (const [bx, t] of [[x + 50, 'EN'], [x + w - 50, 'BOOT']]) s += `<rect x="${bx - 17}" y="${b - 92}" width="34" height="34" rx="4" class="bn-btn-base"/><circle cx="${bx}" cy="${b - 75}" r="10" class="bn-btn-cap"/><text x="${bx}" y="${b - 44}" class="bn-esp-l">${t}</text>`;
    s += `<rect x="${x + w / 2 - 34}" y="${b - 40}" width="68" height="46" rx="12" class="bn-usb"/><rect x="${x + w / 2 - 22}" y="${b - 26}" width="44" height="14" rx="7" class="bn-usb-in"/>`;
    // pins (δύο σειρές)
    for (let i = 0; i < 19; i++) for (const px of [ESP.lx, ESP.rx]) s += `<circle cx="${px}" cy="${PIN_Y(i)}" r="6.2" class="bn-pin"/><circle cx="${px}" cy="${PIN_Y(i)}" r="2.6" class="bn-pin-in"/>`;
    return s + '</g>';
  }

  function legLine(x, y0, y1, cls) { return `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" class="bn-leg${cls ? ' ' + cls : ''}"/><circle cx="${x}" cy="${y1}" r="4" class="bn-foot"/>`; }

  function partSvg(pl, k) {
    const p = pl.p, xs = pl.legs.map(L => cx(L.col));
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    const Y = ROW.C;
    let s = `<g class="bn-part bn-${p.t}" data-st="2" data-k="${k}">`;
    const legs = top => pl.legs.map(L => legLine(cx(L.col), top, Y, L.role === 'gnd' ? 'short' : '')).join('');
    if (p.t === 'led') {
      s += legs(198);
      s += `<circle cx="${mid}" cy="${138}" r="78" class="bn-glow" data-glow/>`;
      s += `<ellipse cx="${mid}" cy="${198}" rx="29" ry="9" class="bn-led-rim"/><path d="M${mid - 25},${198} v-56 a25,25 0 0 1 50,0 v56 z" class="bn-led" data-led/><path d="M${mid - 13},${146} q2,-18 14,-22" class="bn-shine"/>`;
    } else if (p.t === 'rgb') {
      s += legs(196);
      s += `<circle cx="${mid}" cy="${150}" r="70" class="bn-glow rgb" data-glow/>`;
      s += `<ellipse cx="${mid}" cy="${198}" rx="25" ry="7" class="bn-led-rim"/><path d="M${mid - 22},${198} v-40 a22,22 0 0 1 44,0 v40 z" class="bn-led rgb" data-led/><path d="M${mid - 11},${150} q2,-14 12,-18" class="bn-shine"/>`;
    } else if (p.t === 'button') {
      s += legs(210) + `<rect x="${mid - 40}" y="${176}" width="80" height="80" rx="7" class="bn-tact"/><circle cx="${mid}" cy="${216}" r="24" class="bn-tact-cap" data-press/>`;
    } else if (p.t === 'buzzer') {
      s += legs(200) + `<g class="bn-waves" data-glow><path d="M${mid + 34},${150} q12,18 0,36 M${mid + 46},${142} q18,26 0,52"/></g><circle cx="${mid}" cy="${166}" r="36" class="bn-buz"/><circle cx="${mid}" cy="${168}" r="6" class="bn-buz-hole"/><text x="${mid - 18}" y="${150}" class="bn-mark">+</text>`;
    } else if (p.t === 'pir') {
      s += legs(196) + `<rect x="${mid - 46}" y="${128}" width="92" height="68" rx="6" class="bn-pcb-g"/><circle cx="${mid}" cy="${162}" r="27" class="bn-dome"/><path d="M${mid - 18},${162} h36 M${mid},${144} v36" class="bn-dome-l"/>`;
    } else if (p.t === 'ultrasonic') {
      s += legs(184) + `<rect x="${mid - 82}" y="${112}" width="164" height="72" rx="6" class="bn-pcb-b"/>`;
      for (const dx of [-46, 46]) s += `<circle cx="${mid + dx}" cy="${146}" r="28" class="bn-tx"/><circle cx="${mid + dx}" cy="${146}" r="18" class="bn-tx-in"/>`;
      s += `<g class="bn-waves" data-glow><path d="M${mid - 20},${102} q20,-16 40,0 M${mid - 30},${90} q30,-24 60,0"/></g>`;
    } else if (p.t === 'traffic') {
      s += legs(200) + `<rect x="${mid - 26}" y="${92}" width="52" height="112" rx="12" class="bn-tl"/>`;
      ['r', 'y', 'g'].forEach((c, i) => { s += `<circle cx="${mid}" cy="${116 + i * 32}" r="12" class="bn-tl-l ${c}" data-tl="${i}"/>`; });
    } else {
      s += legs(196) + `<rect x="${mid - 40}" y="${140}" width="80" height="56" rx="6" class="bn-pcb-b"/>`;
    }
    // ετικέτες των ποδιών (+, −, VCC …), μικρές, κάτω από τη σειρά C
    for (const L of pl.legs) {
      const t = L.role === 'gnd' ? '−' : L.role === 'pwr' ? '+' : (p.t === 'ultrasonic' || p.t === 'rgb') ? (L.label.split(' ')[1] || '') : p.t === 'led' ? '+' : '';
      if (t) s += `<text x="${cx(L.col)}" y="${Y - 12}" class="bn-legl">${esc(t.replace(/[()]/g, ''))}</text>`;
    }
    return s + '</g>';
  }

  function resistorSvg(r, k) {
    const x0 = cx(r.c0), x1 = cx(r.c1), y = ROW.D, m = (x0 + x1) / 2;
    let s = `<g class="bn-part bn-res" data-st="2" data-k="r${k}">`;
    s += `<path d="M${x0},${y} L${m - 30},${y} M${m + 30},${y} L${x1},${y}" class="bn-lead"/><circle cx="${x0}" cy="${y}" r="4" class="bn-foot"/><circle cx="${x1}" cy="${y}" r="4" class="bn-foot"/>`;
    s += `<rect x="${m - 34}" y="${y - 14}" width="68" height="28" rx="14" class="bn-resb"/>`;
    s += [['#c0392b', -18], ['#c0392b', -8], ['#5a3418', 2], ['#c9a227', 18]].map(([c, dx]) => `<rect x="${m + dx - 3}" y="${y - 14}" width="6" height="28" style="fill:${c}"/>`).join('');
    return s + `<text x="${m}" y="${y + 34}" class="bn-legl">220 Ω</text></g>`;
  }

  // τα καλώδια: από το pin του ESP32 στη στήλη τους (σειρά E), από κάτω ώστε να μην περνούν πάνω από τα εξαρτήματα
  function routes(L) {
    const right = L.wires.filter(w => w.from.side === 'r').sort((a, b) => a.col - b.col);
    const left = L.wires.filter(w => w.from.side === 'l').sort((a, b) => a.col - b.col);
    const m = right.length;
    right.forEach((w, r) => {
      const ex = cx(w.col), ey = ROW.E;
      const lane = Math.max(w.from.y, ROW.F - 12 + r * 22);
      const xa = ESP.rx + 26 + (m - 1 - r) * 10;
      w.pts = w.from.y >= lane ? [[w.from.x, w.from.y], [ex, w.from.y], [ex, ey]] : [[w.from.x, w.from.y], [xa, w.from.y], [xa, lane], [ex, lane], [ex, ey]];
    });
    left.forEach((w, r) => {
      const ex = cx(w.col), ey = ROW.E;
      const xa = ESP.lx - 26 - r * 9, lane = ESP.b + 18 + r * 12;
      w.pts = [[w.from.x, w.from.y], [xa, w.from.y], [xa, lane], [ex, lane], [ex, ey]];
    });
  }

  function wireSvg(pts, color, cls, attrs) {
    const d = rounded(pts, 14);
    const e = pts[pts.length - 1];
    return `<g class="bn-wire ${cls || ''}" ${attrs || ''} style="--wc:${color}"><path d="${d}" class="bn-w-ol" pathLength="1"/><path d="${d}" class="bn-w" pathLength="1"/><path d="${d}" class="bn-w-hl" pathLength="1"/><path d="${d}" class="bn-flow"/><circle cx="${e[0]}" cy="${e[1]}" r="5.5" class="bn-plug"/></g>`;
  }

  function tag(x, y, px, py, text, color, k) {
    const w = Math.max(76, 14 * text.length + 26);
    return `<g class="bn-tag" data-tag="${k}" style="--wc:${color}"><path d="M${px},${py} L${x},${y}" class="bn-tag-l"/><circle cx="${px}" cy="${py}" r="6" class="bn-tag-dot"/><rect x="${x - w / 2}" y="${y - 19}" width="${w}" height="38" rx="19" class="bn-tag-r"/><text x="${x}" y="${y + 8}" class="bn-tag-t">${esc(text)}</text></g>`;
  }

  // → { html, steps: [{ n, title, text }], actions } για ένα manifest
  function build(manifest, labels, S) {
    const BV = root.IoTBBView;
    const n = BV.nets(manifest, S);
    const L = layout(n, labels);
    routes(L);
    const cols = L.cols;
    const W = cx(cols - 1) + 70, H = ESP.b + 18 + Math.max(1, L.wires.filter(w => w.from.side === 'l').length) * 12 + 20;
    let s = `<svg class="bn-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="bn-title"><title id="bn-title">ESP32 πάνω σε breadboard με τα εξαρτήματα και τα καλώδια της άσκησης</title>`;
    s += `<defs><radialGradient id="bn-glow-g"><stop offset="0" stop-color="#ff5a3a" stop-opacity="0.9"/><stop offset="0.3" stop-color="#ff3b2a" stop-opacity="0.45"/><stop offset="0.65" stop-color="#ff3b2a" stop-opacity="0.12"/><stop offset="1" stop-color="#ff3b2a" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="bn-glow-rgb"><stop offset="0" stop-color="#7fb6ff" stop-opacity="0.85"/><stop offset="1" stop-color="#7f6bff" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="bn-can-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9ecef"/><stop offset="1" stop-color="#9aa1a9"/></linearGradient>` +
      `<linearGradient id="bn-led-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b3150c"/><stop offset="0.45" stop-color="#ff3b2a"/><stop offset="1" stop-color="#a5130b"/></linearGradient></defs>`;
    s += board(cols);
    // το GND και το 5V από την αριστερή πλευρά, κατευθείαν στις γραμμές από κάτω (δεν κόβουν άλλα καλώδια)
    const actions = [];
    let wires = '', tags = '', k = 0;
    const tagSpots = [];
    const tagAt = (pin, text, color, kk) => {
      let tx = pin.side === 'r' ? ESP.rx + 98 : ESP.lx - 86, ty = pin.y - 34;
      while (tagSpots.some(t => Math.abs(t.x - tx) < 120 && Math.abs(t.y - ty) < 42)) ty -= 44;
      tagSpots.push({ x: tx, y: ty });
      return tag(tx, ty, pin.x, pin.y, text, color, kk);
    };
    for (const w of L.wires) {
      const [c, name] = colOf(w.cls);
      wires += wireSvg(w.pts, c, w.input ? 'in' : '', `data-st="3" data-k="${k}"${w.id ? ` data-w="${esc(w.id)}"` : ''}`);
      tags += tagAt(w.from, w.label, c, k);
      const what = `${w.leg.label} ${w.part.gen}`;
      actions.push({ k, kind: 'wire', text: w.via
        ? `${name} καλώδιο: από το pin ${w.label} στη στήλη της αντίστασης. Η αντίσταση ενώνεται με το ${what}.`
        : `${name} καλώδιο: από το pin ${w.label} στη στήλη όπου είναι το ${what}. Ίδια στήλη σημαίνει ενωμένα.` });
      k++;
    }
    if (L.jumpers.some(j => j.rail === 'bm')) {
      const g = pinXY('GND3');
      wires += wireSvg([[g.x, g.y], [g.x - 40, g.y], [g.x - 40, RAIL.bm]], colOf('w-gnd')[0], 'gnd', `data-st="3" data-k="${k}"`);
      tags += tagAt(g, 'GND', '#9aa3ad', k);
      actions.push({ k, kind: 'gnd', text: 'Μαύρο καλώδιο: από το GND του ESP32 στη μπλε γραμμή (−). Αυτή είναι η γείωση: εκεί γυρίζει το ρεύμα.' });
      k++;
    }
    if (L.power) {
      const v = pinXY('5V');
      wires += wireSvg([[v.x, v.y], [v.x - 60, v.y], [v.x - 60, RAIL.bp]], colOf('pwr')[0], 'pwr', `data-st="3" data-k="${k}"`);
      tags += tagAt(v, '5V', colOf('pwr')[0], k);
      actions.push({ k, kind: 'pwr', text: 'Κόκκινο καλώδιο: από το 5V του ESP32 στην κόκκινη γραμμή (+). Από εκεί παίρνουν ρεύμα οι αισθητήρες.' });
      k++;
    }
    for (const j of L.jumpers) {
      const x = cx(j.col), y = j.rail === 'bm' ? RAIL.bm : RAIL.bp;
      const [c] = j.rail === 'bm' ? colOf('w-gnd') : colOf('pwr');
      wires += wireSvg([[x, ROW.E], [x, y]], c, 'jump', `data-st="3" data-k="${k}"`);
      actions.push({ k, kind: 'jump', text: j.rail === 'bm'
        ? `Μικρό μαύρο καλώδιο: από το ${j.leg.label} ${j.part.gen} στη μπλε γραμμή (−), τη γείωση.`
        : `Μικρό κόκκινο καλώδιο: από το ${j.leg.label} ${j.part.gen} στην κόκκινη γραμμή (+).` });
      k++;
    }
    s += `<g class="bn-wires">${wires}</g>`;
    s += L.resistors.map(resistorSvg).join('');
    s += L.parts.map(partSvg).join('');
    s += esp32();
    s += `<g class="bn-tags">${tags}</g>`;
    s += '</svg>';

    const names = L.parts.map(pl => pl.p.name);
    const hasRes = L.resistors.length > 0;
    const outputs = L.parts.filter(pl => !pl.p.input).map(pl => pl.p.t);
    const runText = outputs.includes('led')
      ? 'Τρέχει ο κώδικας! Το ρεύμα κυλά από το pin, μέσα από την αντίσταση και το LED, στη γείωση (GND). Το LED αναβοσβήνει.'
      : outputs.length ? 'Τρέχει ο κώδικας! Το ρεύμα κυλά από το pin, μέσα από το εξάρτημα, στη γείωση (GND).'
        : 'Τρέχει ο κώδικας! Το ESP32 διαβάζει το σήμα που έρχεται στο pin του.';
    const steps = [
      { n: 1, title: 'Το ESP32 στο breadboard', text: 'Βήμα 1: Βάλε το ESP32 στο breadboard. Τα πόδια του (pins) μπαίνουν στις τρύπες. Κάθε pin έχει όνομα, π.χ. GPIO 2 ή GND.' },
      { n: 2, title: 'Τα εξαρτήματα', text: `Βήμα 2: Βάλε ${names.length === 1 ? 'το εξάρτημα' : 'τα εξαρτήματα'}: ${names.join(', ')}${hasRes ? ' και την αντίσταση 220 Ω' : ''}.${outputs.includes('led') ? ' Το μακρύ πόδι του LED είναι το +.' : ''} Τα πόδια μπαίνουν σε τρύπες του breadboard.` },
      { n: 3, title: 'Τα καλώδια', text: 'Βήμα 3: Τα καλώδια, ένα-ένα. Ό,τι είναι στην ίδια στήλη τρυπών ενώνεται.' },
      { n: 4, title: 'Τρέξε τον κώδικα', text: `Βήμα 4: ${runText}` }
    ];
    const materials = [['esp32', 'ESP32 DevKit']].concat(L.parts.map(pl => [pl.p.t, pl.p.name === 'LED' ? 'LED' : pl.p.name[0].toUpperCase() + pl.p.name.slice(1)]));
    if (hasRes) materials.push(['resistor', 'Αντίσταση 220 Ω']);
    materials.push(['bb', 'Breadboard'], ['wire', `Καλώδια (${actions.length})`]);
    return { html: s, steps, actions, materials, layout: L, nets: n };
  }

  // ------------------------------------------------------------ παράθυρο «Πάγκος»
  const ICONS = {
    esp32: '<rect x="5" y="2" width="14" height="20" rx="2" fill="#1d1f24"/><rect x="8" y="5" width="8" height="7" rx="1" fill="#c7ccd2"/>',
    led: '<path d="M7 14 v-6 a5 5 0 0 1 10 0 v6 z" fill="#ff3b2a"/><path d="M9 14 v7 M15 14 v5" stroke="#aab" stroke-width="1.6"/>',
    rgb: '<path d="M6 14 v-6 a6 6 0 0 1 12 0 v6 z" fill="#cfe3ff"/><path d="M8 14 v7 M11 14 v6 M14 14 v7 M17 14 v6" stroke="#aab" stroke-width="1.4"/>',
    resistor: '<path d="M1 12 h5 M18 12 h5" stroke="#aab" stroke-width="1.6"/><rect x="6" y="8" width="12" height="8" rx="4" fill="#e8c48a"/><rect x="9" y="8" width="2" height="8" fill="#c0392b"/><rect x="13" y="8" width="2" height="8" fill="#5a3418"/>',
    button: '<rect x="4" y="4" width="16" height="16" rx="2" fill="#2a2d33"/><circle cx="12" cy="12" r="5" fill="#111"/>',
    buzzer: '<circle cx="12" cy="12" r="9" fill="#1d1f24"/><circle cx="12" cy="12" r="2" fill="#555"/>',
    pir: '<rect x="3" y="6" width="18" height="14" rx="2" fill="#1f7a4d"/><circle cx="12" cy="13" r="6" fill="#f4f4f4"/>',
    ultrasonic: '<rect x="1" y="6" width="22" height="12" rx="2" fill="#2563c9"/><circle cx="7" cy="12" r="4" fill="#cfd4da"/><circle cx="17" cy="12" r="4" fill="#cfd4da"/>',
    traffic: '<rect x="8" y="1" width="8" height="22" rx="3" fill="#1d1f24"/><circle cx="12" cy="6" r="2.2" fill="#e5483b"/><circle cx="12" cy="12" r="2.2" fill="#f5c518"/><circle cx="12" cy="18" r="2.2" fill="#3fbf5a"/>',
    bb: '<rect x="1" y="5" width="22" height="14" rx="2" fill="#f2f2ee"/><path d="M4 9 h16 M4 12 h16 M4 15 h16" stroke="#9aa" stroke-dasharray="1.5 1.5"/>',
    wire: '<path d="M3 19 C 8 19, 8 6, 21 6" stroke="#f5c518" stroke-width="2.6" fill="none"/><circle cx="21" cy="6" r="2" fill="#e5483b"/>'
  };
  const ico = t => `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">${ICONS[t] || ICONS.wire}</svg>`;

  let current = null;

  // opts: { manifest, labels, title, code (HTML), objectives, sfx, reducedMotion, speak, onClose }
  function open(opts) {
    if (!doc) return null;
    close();
    const B = build(opts.manifest, opts.labels, opts.S);
    const motion = () => !(opts.reducedMotion && opts.reducedMotion());
    const sfx = n => { if (opts.sfx) opts.sfx(n); };
    const back = doc.activeElement;
    const el = doc.createElement('div');
    el.className = 'bench';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'bn-h');
    el.innerHTML = `<div class="bn-shell">
      <header class="bn-head">
        <h2 id="bn-h" class="bn-card bn-title"><span class="bn-pad-ico" aria-hidden="true">🎮</span>${esc(opts.title || 'Πώς συνδέεται')}</h2>
        <div class="bn-card bn-steps"><b id="bn-stepn">Βήμα 1/4</b><div class="bn-dots" role="group" aria-label="Βήματα">${B.steps.map(st => `<button class="bn-dot" data-go="${st.n}" aria-label="Βήμα ${st.n}: ${esc(st.title)}"></button>`).join('')}</div></div>
        <button class="bn-x" id="bn-close" aria-label="Κλείσε τον πάγκο" title="Κλείσε (Esc)">✕</button>
      </header>
      <aside class="bn-side">
        <section class="bn-card bn-mat"><h3>Υλικά</h3><ul>${B.materials.map(([t, nm]) => `<li data-mat="${esc(t)}">${ico(t)}<span>${esc(nm)}</span></li>`).join('')}</ul></section>
        ${opts.code ? `<section class="bn-card bn-code"><h3>Ο κώδικάς σου</h3><pre>${opts.code}</pre></section>` : ''}
        ${opts.objectives && opts.objectives.length ? `<section class="bn-card bn-learn"><h3><span aria-hidden="true">💡</span> Τι μαθαίνεις</h3><ul>${opts.objectives.slice(0, 3).map(o => `<li>${esc(o)}</li>`).join('')}</ul></section>` : ''}
      </aside>
      <main class="bn-stage">
        <div class="bn-svgwrap">${B.html}</div>
        <p class="bn-cap" id="bn-cap" aria-live="polite"></p>
      </main>
      <footer class="bn-foot">
        <div class="bn-ctl">
          <button class="bn-b run" id="bn-play"><span aria-hidden="true">▶</span>Εκτέλεση</button>
          <button class="bn-b" id="bn-stop"><span aria-hidden="true">■</span>Στοπ</button>
          <button class="bn-b" id="bn-reset"><span aria-hidden="true">↻</span>Επαναφορά</button>
          ${opts.speak ? '<button class="bn-b" id="bn-say"><span aria-hidden="true">🔊</span>Άκουσε</button>' : ''}
        </div>
      </footer>
    </div>`;
    doc.body.appendChild(el);
    doc.documentElement.classList.add('bn-open');
    const $ = q => el.querySelector(q);
    const svg = $('.bn-svg'), cap = $('#bn-cap');
    const timers = [], anims = [];
    let step = 0, playing = false;
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const clear = () => { timers.forEach(clearTimeout); timers.length = 0; anims.forEach(a => { try { a.finish(); } catch (e) { /* ήδη */ } }); anims.length = 0; };
    const anim = (node, kf, o) => {
      if (!(node && node.animate && motion())) return null;
      const a = node.animate(kf, Object.assign({ fill: 'none' }, o));
      anims.push(a);
      later((o.duration || 300) + 200, () => { try { a.finish(); } catch (e) { /* ήδη */ } }); // αν ο browser «παγώσει» τις κινήσεις (καρτέλα στο παρασκήνιο)
      return a;
    };
    const say = t => { cap.textContent = t; cap.classList.remove('pop'); void cap.offsetWidth; cap.classList.add('pop'); };
    const all = q => [...svg.querySelectorAll(q)];

    // ποια κομμάτια φαίνονται: όλα τα data-st ≤ step, και στο βήμα 3 μόνο τα καλώδια ως το k
    function paint(st, upto) {
      svg.setAttribute('data-step', st);
      all('[data-st]').forEach(g => {
        const s = +g.dataset.st;
        const show = s < st || (s === st && (s !== 3 || upto === undefined || +g.dataset.k <= upto));
        g.classList.toggle('bn-hide', !show);
      });
      all('.bn-tag').forEach(t => t.classList.toggle('bn-hide', st < 3 || (st === 3 && upto !== undefined && +t.dataset.tag > upto)));
      svg.classList.toggle('bn-run', st === 4);
      $('#bn-stepn').textContent = `Βήμα ${st}/4`;
      el.querySelectorAll('.bn-dot').forEach(d => { const n = +d.dataset.go; d.classList.toggle('on', n === st); d.classList.toggle('done', n < st); d.setAttribute('aria-current', n === st ? 'step' : 'false'); });
      el.querySelectorAll('.bn-mat li').forEach(li => {
        const t = li.dataset.mat;
        li.classList.toggle('used', (t === 'esp32' || t === 'bb') ? st >= 1 : t === 'wire' ? st >= 3 : st >= 2);
      });
    }

    function goStep(st, auto) {
      clear();
      step = st;
      const S0 = B.steps[st - 1];
      if (st < 3) paint(st); else if (st === 3) paint(3, motion() ? -1 : undefined); else paint(4);
      say(S0.text);
      if (st === 1) {
        anim($('.bn-esp'), [{ transform: 'translateY(-60px) scale(1.04)', opacity: 0 }, { transform: 'translateY(4px)', opacity: 1, offset: 0.75 }, { transform: 'none', opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.2,.9,.3,1)' });
        sfx('click');
        if (auto) later(motion() ? 2600 : 3200, () => goStep(2, true));
      } else if (st === 2) {
        const parts = all('.bn-part');
        parts.forEach((p, i) => {
          if (motion()) p.classList.add('bn-hide');
          later(i * 380, () => { p.classList.remove('bn-hide'); anim(p, [{ transform: 'translateY(-46px)', opacity: 0 }, { transform: 'translateY(3px)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'ease-out' }); sfx('tick'); });
        });
        if (auto) later(parts.length * 380 + 2800, () => goStep(3, true));
      } else if (st === 3) {
        if (!motion()) { say(S0.text + ' ' + B.actions.map(a => a.text).join(' ')); if (auto) later(5000, () => goStep(4, true)); return; }
        const STEP = 2300;
        B.actions.forEach((a, i) => later(400 + i * STEP, () => {
          paint(3, a.k);
          const g = svg.querySelector(`.bn-wire[data-k="${a.k}"]`);
          if (g) {
            g.classList.add('bn-now');
            g.querySelectorAll('.bn-w-ol, .bn-w, .bn-w-hl').forEach(p => anim(p, [{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], { duration: 900, easing: 'cubic-bezier(.45,0,.2,1)' }));
            anim(g.querySelector('.bn-plug'), [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(0)', opacity: 0, offset: 0.8 }, { transform: 'scale(1.5)', opacity: 1, offset: 0.92 }, { transform: 'none', opacity: 1 }], { duration: 1100 });
            later(STEP - 100, () => g.classList.remove('bn-now'));
          }
          const t = svg.querySelector(`.bn-tag[data-tag="${a.k}"]`);
          if (t) anim(t, [{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'ease-out' });
          say(`${i + 1}/${B.actions.length}. ${a.text}`);
          later(880, () => sfx('tick'));
        }));
        later(400 + B.actions.length * STEP, () => { paint(3); if (auto) goStep(4, true); else say('Όλα τα καλώδια μπήκαν. Πάτα «Εκτέλεση» ή το βήμα 4 για να τρέξει ο κώδικας.'); });
      } else {
        svg.classList.toggle('bn-still', !motion());
        sfx('win');
        if (auto) later(6000, () => { playing = false; setPlay(); say(S0.text + ' Πάτα «Επαναφορά» για να το ξαναδείς.'); });
      }
    }

    const setPlay = () => { $('#bn-play').classList.toggle('on', playing); $('#bn-play').setAttribute('aria-pressed', String(playing)); };
    function play() { playing = true; setPlay(); goStep(step >= 1 && step < 4 ? step : 1, true); }
    function stop() { playing = false; setPlay(); clear(); paint(step || 1); svg.classList.remove('bn-run'); say('Σταμάτησε. Πάτα «Εκτέλεση» για να συνεχίσει ή μια τελεία για να πας σε βήμα.'); }
    function reset() { playing = false; setPlay(); clear(); step = 1; paint(1); svg.classList.remove('bn-run'); say(B.steps[0].text); }

    $('#bn-play').onclick = play;
    $('#bn-stop').onclick = stop;
    $('#bn-reset').onclick = reset;
    if ($('#bn-say')) $('#bn-say').onclick = () => opts.speak(cap.textContent);
    el.querySelectorAll('.bn-dot').forEach(d => { d.onclick = () => { playing = false; setPlay(); goStep(+d.dataset.go, false); }; });
    $('#bn-close').onclick = () => close();
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') { // η εστίαση μένει μέσα στο παράθυρο
        const f = [...el.querySelectorAll('button')].filter(b => !b.disabled && b.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    el.addEventListener('click', e => { if (e.target === el) close(); });

    current = { el, close: () => { clear(); el.remove(); doc.documentElement.classList.remove('bn-open'); current = null; if (back && back.focus) back.focus(); if (opts.onClose) opts.onClose(); }, build: B, goStep, play, stop, reset, get step() { return step; } };
    $('#bn-close').focus();
    if (opts.autoplay !== false && motion()) play();
    else goStep(1, false);
    return current;
  }

  function close() { if (current) current.close(); }

  root.IoTBench = { build, open, close, layout, pinXY, get current() { return current; } };
})(typeof window !== 'undefined' ? window : globalThis);
