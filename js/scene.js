/*
 * IoT Guardian — ισομετρική σκηνή εργαστηρίου (SVG).
 *
 * Κάθε αντικείμενο σχεδιάζεται σε «συντεταγμένες πάγκου» (u, v, h):
 *   u = κατά μήκος (στην οθόνη: κάτω-δεξιά), v = κατά βάθος (κάτω-αριστερά), h = ύψος.
 * Η προβολή: X = (u − v)·cos30·K, Y = (u + v)·sin30·K − h·K.
 * Τα πάνω πρόσωπα (PCB, breadboard) σχεδιάζονται επίπεδα και «γέρνουν» με matrix().
 */
(function (root) {
  'use strict';

  const K = 3.2;
  // Κατάλογος αντικειμένων της τελευταίας σκηνής (για την 3D απόδοση στο scene3d.js).
  let MAN = null;
  const rec = o => { if (MAN) MAN.push(o); };
  const C = Math.cos(Math.PI / 6);
  const S = 0.5;
  const P = (u, v, h) => [(u - v) * C * K, (u + v) * S * K - (h || 0) * K];
  const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const poly = (pts, cls, extra) => `<polygon points="${pts.map(pt).join(' ')}" class="${cls}"${extra || ''}/>`;
  const planeMatrix = h => `matrix(${(C * K).toFixed(4)},${(S * K).toFixed(4)},${(-C * K).toFixed(4)},${(S * K).toFixed(4)},0,${(-h * K).toFixed(2)})`;

  // Κουτί με τρία ορατά πρόσωπα: πάνω, αριστερό-μπροστά, δεξί-μπροστά.
  // Σκιά στο πάτωμα (φως από πάνω αριστερά): μετατοπισμένο ορθογώνιο κάτω από το αντικείμενο.
  function shadow(u, v, du, dv) {
    const o = 3.2;
    return poly([P(u + o, v - 0.6, 0), P(u + du + o, v - 0.6, 0), P(u + du + o, v + dv - 0.6, 0), P(u + o, v + dv - 0.6, 0)], 'shadow');
  }
  function box(u, v, h, du, dv, dh, cls, id) {
    const t = h + dh;
    const sh = h === 0 && du > 4 ? shadow(u, v, du, dv) : '';
    const top = [P(u, v, t), P(u + du, v, t), P(u + du, v + dv, t), P(u, v + dv, t)];
    const left = [P(u, v + dv, t), P(u + du, v + dv, t), P(u + du, v + dv, h), P(u, v + dv, h)];
    const right = [P(u + du, v, t), P(u + du, v + dv, t), P(u + du, v + dv, h), P(u + du, v, h)];
    return `${sh}<g class="box ${cls}"${id ? ` id="${id}"` : ''}>${poly(left, 'f-l')}${poly(right, 'f-r')}${poly(top, 'f-t')}</g>`;
  }

  // Μικρά εικονίδια (12×12) για τις ετικέτες, όπως στις κάρτες του πάγκου.
  const ICON = {
    chip: '<rect x="2.5" y="2.5" width="7" height="7" rx="1"/><path d="M4.5 0.5v2M7.5 0.5v2M4.5 9.5v2M7.5 9.5v2M0.5 4.5h2M0.5 7.5h2M9.5 4.5h2M9.5 7.5h2"/>',
    pins: '<path d="M2 11h8M3.5 11V3M6 11V3M8.5 11V3M2.5 3h2M5 3h2M7.5 3h2"/>',
    plug: '<path d="M4 1v3M8 1v3M3 4h6v2.5a3 3 0 0 1-6 0zM6 9.5V11.5"/>',
    wifi: '<path d="M1 4.5a7 7 0 0 1 10 0M2.8 6.6a4.5 4.5 0 0 1 6.4 0M4.6 8.6a2 2 0 0 1 2.8 0"/><circle cx="6" cy="10.4" r="0.6"/>',
    button: '<rect x="1" y="5.5" width="10" height="5" rx="1"/><path d="M4 5.5V3.5h4v2"/>',
    bulb: '<path d="M6 1a3.6 3.6 0 0 0-2 6.6V9h4V7.6A3.6 3.6 0 0 0 6 1zM4.5 11h3"/>',
    eye: '<circle cx="3.6" cy="6" r="2.6"/><circle cx="8.4" cy="6" r="2.6"/><circle cx="3.6" cy="6" r="0.9"/><circle cx="8.4" cy="6" r="0.9"/>',
    thermo: '<path d="M5 1.5h2v6.2a2.5 2.5 0 1 1-2 0z"/>',
    screen: '<rect x="1" y="2" width="10" height="7" rx="1"/><path d="M4 11h4"/>',
    car: '<path d="M1.5 8V6.4L3 3.8h6L10.5 6.4V8zM1.5 6.4h9"/><circle cx="3.6" cy="8.6" r="1.1"/><circle cx="8.4" cy="8.6" r="1.1"/>',
    traffic: '<rect x="3.5" y="0.8" width="5" height="10.4" rx="1.4"/><circle cx="6" cy="3.2" r="1"/><circle cx="6" cy="6" r="1"/><circle cx="6" cy="8.8" r="1"/>',
    grid: '<rect x="1" y="2.5" width="10" height="7" rx="1"/><path d="M3 5h0.1M5 5h0.1M7 5h0.1M9 5h0.1M3 7h0.1M5 7h0.1M7 7h0.1M9 7h0.1"/>',
    server: '<rect x="1.5" y="1.5" width="9" height="4" rx="0.8"/><rect x="1.5" y="6.5" width="9" height="4" rx="0.8"/><path d="M3.5 3.5h0.1M3.5 8.5h0.1"/>',
    question: '<circle cx="6" cy="6" r="5"/><path d="M4.4 4.6a1.7 1.7 0 1 1 2.4 1.6c-.6.3-.8.6-.8 1.2M6 9h0.1"/>'
  };
  const PART_ICON = {
    esp32: 'chip', 'esp-module': 'chip', 'esp-uart': 'chip', 'esp-reg': 'chip', pi: 'chip', 'pi-cpu': 'chip', 'pi-ram': 'chip', 'pi-rp1': 'chip', 'mini-esp': 'chip', 'pi-hdmi': 'screen', 'pi-fpc': 'pins',
    'esp-pins': 'pins', 'pi-gpio': 'pins', 'esp-usb': 'plug', 'pi-power': 'plug', 'pi-ports': 'plug', 'esp-antenna': 'wifi', router: 'wifi',
    'esp-buttons': 'button', button: 'button', led: 'bulb', 'esp-led': 'bulb', pir: 'eye', ultrasonic: 'eye', 'us-pins': 'pins', sensor: 'thermo',
    tablet: 'screen', laptop: 'screen', car: 'car', traffic: 'traffic', breadboard: 'grid', 'rpi-broker': 'server', 'unknown-device': 'question'
  };

  // Ετικέτα: τελεία πάνω στο κομμάτι, διακεκομμένη γραμμή, δαχτυλίδι και κουτί με εικονίδιο.
  function callout(p, dx, dy, text, id, part) {
    const x = p[0] + dx;
    const y = p[1] + dy;
    const icon = part && ICON[PART_ICON[part]];
    const w = text.length * 6.1 + 18 + (icon ? 15 : 0);
    const anchorLeft = dx >= 0;
    const bx = anchorLeft ? x + 4 : x - w - 4;
    return `<g class="callout${part ? ' part-link' : ''}"${id ? ` id="${id}"` : ''}${part ? ` data-part="${part}" tabindex="0" role="button" aria-label="Τι είναι: ${text}"` : ''}>
      <path d="M${pt(p)} L${x.toFixed(1)},${y.toFixed(1)}" class="co-line"/>
      <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.4" class="co-dot"/>
      <rect x="${bx.toFixed(1)}" y="${(y - 10).toFixed(1)}" width="${w.toFixed(1)}" height="20" rx="4" class="co-box"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" class="co-ring"/>
      ${icon ? `<g class="co-ico" transform="translate(${(bx + 7).toFixed(1)},${(y - 6).toFixed(1)})">${icon}</g>` : ''}
      <text x="${(bx + (icon ? 23 : 9)).toFixed(1)}" y="${(y + 3.6).toFixed(1)}" class="co-txt">${text}</text>
    </g>`;
  }

  // Καλώδιο jumper (Dupont): αν δοθούν σημεία πάγκου {u, v, h}, σχεδιάζονται και τα πλαστικά βύσματα στις άκρες
  // (θηλυκό πάνω στο pin της πλακέτας, αρσενικό μέσα στην τρύπα του breadboard).
  function wire(a, b, cls, lift, id) {
    let plugs = '';
    if (!Array.isArray(a)) rec({ t: 'wire', a, b, cls, lift: lift || 40, id });
    if (!Array.isArray(a)) {
      const A = a;
      const Bp = b;
      plugs += box(A.u - 1.1, A.v - 1.1, A.h, 2.2, 2.2, 4.6, 'plug ' + cls);
      plugs += box(Bp.u - 0.8, Bp.v - 0.8, Bp.h, 1.6, 1.6, 3.4, 'plug ' + cls);
      a = P(A.u, A.v, A.h + 4.6);
      b = P(Bp.u, Bp.v, Bp.h + 3.4);
    }
    const l = lift || 40;
    const c1 = [a[0], a[1] - l];
    const c2 = [b[0], b[1] - l];
    const d = `M${pt(a)} C${pt(c1)} ${pt(c2)} ${pt(b)}`;
    return `<g class="wire-g" data-part="wire-${cls.replace('w-', '')}"><path d="${d}" class="wire-ol"/><path${id ? ` id="${id}"` : ''} d="${d}" class="wire ${cls}"/><path d="${d}" class="wire-hl"/>`
      + (plugs || `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="2.2" class="wire-end ${cls}"/><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="2.2" class="wire-end ${cls}"/>`) + '</g>';
  }

  // ------------------------------------------------------------ αντικείμενα

  // ESP32 DevKit 38 pins με USB-C (όπως το πραγματικό): μαύρο PCB 52×28 που «πατά» στα pins του.
  // 19 pins σε κάθε πλευρά, βήμα 2,54 mm. Η μπροστινή σειρά (προς τον θεατή) έχει τα GPIO 2, 4, 15.
  const ESP = { u: 0, v: 0, h: 7 };
  const PIN_U = i => 2.6 + i * 2.54;
  const RIGHT_ROW = ['GND', 'D23', 'D22', 'TX', 'RX', 'D21', 'GND2', 'D19', 'D18', 'D5', 'D17', 'D16', 'D4', 'D0', 'D2', 'D15', 'SD1', 'SD0', 'CLK'];
  const LEFT_ROW = ['3V3', 'EN', 'VP', 'VN', 'D34', 'D35', 'D32', 'D33', 'D25', 'D26', 'D27', 'D14', 'D12', 'GND3', 'D13', 'SD2', 'SD3', 'CMD', '5V'];
  const PCB_TOP = ESP.h + 1.6;
  function espPinUV(name) {
    let i = RIGHT_ROW.indexOf(name);
    if (i >= 0) return { u: ESP.u + PIN_U(i), v: ESP.v + 26.6, h: PCB_TOP + 0.6 };
    i = LEFT_ROW.indexOf(name);
    return { u: ESP.u + PIN_U(Math.max(0, i)), v: ESP.v + 1.4, h: PCB_TOP + 0.6 };
  }
  function espPin(name) { const q = espPinUV(name); return P(q.u, q.v, q.h + 0.4); }

  // Επίπεδο v–h σε σταθερό u (δεξί πρόσωπο): local x = v, y = −h.
  const planeVH = u => `matrix(${(-C * K).toFixed(4)},${(S * K).toFixed(4)},0,${K.toFixed(4)},${(u * C * K).toFixed(2)},${(u * S * K).toFixed(2)})`;

  function esp32() {
    const { u, v } = ESP;
    const H = ESP.h;
    rec({ t: 'esp32' });
    let s = '<g id="sc-esp" class="sc-esp" data-part="esp32">';
    s += shadow(u, v, 52, 28);
    // από κάτω: πλαστικό των headers και οι ακίδες προς το τραπέζι
    s += '<g data-part="esp-pins">';
    for (const vv of [0.4, 25.6]) {
      for (let i = 0; i < 19; i++) {
        const a = P(u + PIN_U(i), v + vv + 1, H - 2.5);
        const b = P(u + PIN_U(i), v + vv + 1, 0.3);
        s += `<path d="M${pt(a)} L${pt(b)}" class="pin-leg"/>`;
      }
      s += box(u + 1.3, v + vv, H - 2.5, 48.8, 2, 2.5, 'pinhdr');
    }
    s += '</g>';
    s += box(u, v, H, 52, 28, 1.6, 'pcb esp-black');
    const T = PCB_TOP;
    // τρύπες στερέωσης και silkscreen
    for (const [hu, hv] of [[1.6, 4.6], [1.6, 23.4], [50.4, 4.6], [50.4, 23.4]]) {
      const c = P(u + hu, v + hv, T);
      s += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="1.4" ry="0.8" class="hole"/>`;
    }
    s += `<g transform="${planeMatrix(T)}" class="silk-g">
      <text x="${u + 30.5}" y="${v + 7.2}" class="silk3">3V3 EN VP VN</text>
      <text x="${u + 29}" y="${v + 22.4}" class="silk3">GND 23 22 TX RX</text>
      <text x="${u + 46.2}" y="${v + 4.8}" class="silk3">EN</text><text x="${u + 45.6}" y="${v + 25.2}" class="silk3">BOOT</text>
    </g>`;
    // module ESP-WROOM-32: κεραία στην άκρη, ασημένιο κάλυμμα, χρυσές επαφές γύρω-γύρω
    s += `<g data-part="esp-antenna">${box(u + 0.4, v + 5, T, 6.2, 18, 0.8, 'mod-base')}<g transform="${planeMatrix(T + 0.8)}"><path d="M${u + 1.2},${v + 7} h3.6 v14 h-2.4 v-12 h2.4 v10" class="antenna2"/></g></g>`;
    s += `<g data-part="esp-module">${box(u + 6.6, v + 5, T, 18.6, 18, 0.8, 'mod-base')}`;
    s += `<g transform="${planeMatrix(T + 0.8)}">`;
    for (let k = 0; k < 13; k++) s += `<rect x="${u + 7.4 + k * 1.35}" y="${v + 5.05}" width="0.7" height="1.2" class="castel"/><rect x="${u + 7.4 + k * 1.35}" y="${v + 21.75}" width="0.7" height="1.2" class="castel"/>`;
    for (let k = 0; k < 10; k++) s += `<rect x="${u + 24.1}" y="${v + 6.8 + k * 1.45}" width="1.1" height="0.7" class="castel"/>`;
    s += '</g>';
    s += box(u + 7.6, v + 6.4, T + 0.8, 16.4, 15.2, 1.6, 'shield', 'sc-shield');
    s += `<g transform="${planeMatrix(T + 2.4)}">`
      + `<rect x="${u + 9}" y="${v + 8.2}" width="3.4" height="1.9" rx="0.9" class="shield-logo"/><text x="${u + 9.45}" y="${v + 9.65}" class="shield-l">WiFi</text>`
      + `<text x="${u + 12.8}" y="${v + 9.75}" class="shield-t sm">ESP-WROOM-32</text>`
      + `<text x="${u + 13.4}" y="${v + 12.6}" class="shield-c">CE</text><circle cx="${u + 18.6}" cy="${v + 12}" r="1" class="shield-ring"/>`
      + `<text x="${u + 9.4}" y="${v + 15.4}" class="shield-s sm">FCC ID:2AC7Z-ESPWROOM32</text><text x="${u + 16}" y="${v + 17.4}" class="shield-s sm">211-161007</text>`
      + `<circle cx="${u + 9.4}" cy="${v + 19.6}" r="0.8" class="shield-dot"/></g></g>`;
    // λευκά περιγράμματα (silkscreen) γύρω από τα εξαρτήματα
    s += `<g transform="${planeMatrix(T)}" class="silk-box">
      <rect x="${u + 32.4}" y="${v + 9.9}" width="6.4" height="6.4"/><rect x="${u + 28}" y="${v + 17}" width="7.6" height="6"/>
      <rect x="${u + 28.3}" y="${v + 8.5}" width="3.6" height="2.8"/><rect x="${u + 42}" y="${v + 8.4}" width="2.2" height="2.2"/><rect x="${u + 42}" y="${v + 17.4}" width="2.2" height="2.2"/>
      <rect x="${u + 44.6}" y="${v + 2.2}" width="4.2" height="4.2"/><rect x="${u + 44.6}" y="${v + 21.6}" width="4.2" height="4.2"/>
    </g>`;
    // CP2102 (USB → Serial), ρυθμιστής 1117, κίτρινος πυκνωτής τανταλίου
    s += `<g data-part="esp-uart">${box(u + 33, v + 10.5, T, 5.2, 5.2, 0.9, 'chip')}<g transform="${planeMatrix(T + 0.9)}"><text x="${u + 33.5}" y="${v + 13}" class="chip-t">CP2102</text></g></g>`;
    s += `<g data-part="esp-reg">${box(u + 28.5, v + 17.5, T, 6.5, 3.6, 1.5, 'chip')}${box(u + 29.6, v + 21.1, T, 4.2, 1.6, 0.5, 'shield')}<g transform="${planeMatrix(T + 1.5)}"><text x="${u + 29}" y="${v + 19.8}" class="chip-t">1117</text></g></g>`;
    s += box(u + 28.8, v + 9, T, 2.6, 1.8, 1.2, 'tant');
    // μικρά SMD (αντιστάσεις, πυκνωτές)
    for (const [cu, cv] of [[27, 6.5], [30, 6.5], [39.5, 9], [39.5, 12], [39.5, 17.5], [36, 19], [26.5, 14], [42, 14.5]]) s += box(u + cu, v + cv, T, 1.6, 0.9, 0.5, 'smd-c');
    // USB-C και κουμπιά EN / BOOT
    s += `<g data-part="esp-usb">${box(u + 46.4, v + 9.6, T, 7, 8.8, 3.2, 'usb')}`
      + `<g transform="${planeVH(u + 53.4)}"><rect x="${v + 10.6}" y="${-(T + 2.7)}" width="6.8" height="2.2" rx="1.1" class="usbc-slot"/><rect x="${v + 11.8}" y="${-(T + 1.9)}" width="4.4" height="0.6" rx="0.3" class="usbc-tongue"/></g></g>`;
    s += `<g data-part="esp-buttons">${box(u + 45, v + 2.6, T, 3.4, 3.4, 1.2, 'btn-s')}${box(u + 45, v + 22, T, 3.4, 3.4, 1.2, 'btn-s')}`;
    const b1 = P(u + 46.7, v + 4.3, T + 1.3);
    const b2 = P(u + 46.7, v + 23.7, T + 1.3);
    s += `<ellipse cx="${b1[0].toFixed(1)}" cy="${b1[1].toFixed(1)}" rx="2.6" ry="1.5" class="btn-dot"/><ellipse cx="${b2[0].toFixed(1)}" cy="${b2[1].toFixed(1)}" rx="2.6" ry="1.5" class="btn-dot"/></g>`;
    // LED τροφοδοσίας (κόκκινο) και LED του GPIO 2 (μπλε)
    const pwr = P(u + 43, v + 9.5, T + 0.4);
    const d2 = P(u + 43, v + 18.5, T + 0.4);
    s += `<g data-part="esp-led"><circle cx="${pwr[0].toFixed(1)}" cy="${pwr[1].toFixed(1)}" r="1.7" class="smd pwr" id="sc-pwr"/>`;
    s += `<circle cx="${d2[0].toFixed(1)}" cy="${d2[1].toFixed(1)}" r="9" class="halo blue" id="sc-d2-halo"/>`;
    s += `<circle cx="${d2[0].toFixed(1)}" cy="${d2[1].toFixed(1)}" r="1.7" class="smd d2" id="sc-d2"/></g>`;
    // pins που βγαίνουν και από πάνω: κόλληση στο PCB, κοντή ακίδα και στρογγυλεμένη κορυφή
    s += '<g data-part="esp-pins">';
    // λευκό περίγραμμα silkscreen γύρω από κάθε σειρά pins, όπως στην πλακέτα
    s += `<g transform="${planeMatrix(T)}" class="silk-box rows">`
      + [1.4, 26.6].map(vv => `<rect x="${(u + PIN_U(0) - 1.3).toFixed(2)}" y="${(v + vv - 1.3).toFixed(2)}" width="${(PIN_U(18) - PIN_U(0) + 2.6).toFixed(2)}" height="2.6" rx="0.4"/>`).join('') + '</g>';
    for (const vv of [1.4, 26.6]) {
      for (let i = 0; i < 19; i++) {
        const p = P(u + PIN_U(i), v + vv, T);
        const q = P(u + PIN_U(i), v + vv, T + 2.2);
        s += `<ellipse cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" rx="1.7" ry="1" class="solder"/>`
          + `<path d="M${pt(p)} L${pt(q)}" class="pin-stub"/><ellipse cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" rx="1.25" ry="0.75" class="pin-tip"/>`;
      }
    }
    s += '</g>';
    // WiFi κύματα πάνω από την κεραία
    const ant = P(u + 3, v + 14, T + 2);
    s += `<g id="sc-wifi" class="waves" transform="translate(${ant[0].toFixed(1)},${(ant[1] - 6).toFixed(1)})">
      <path d="M-7,-2 a9,9 0 0 1 14,0"/><path d="M-12,-7 a16,16 0 0 1 24,0"/><path d="M-17,-12 a23,23 0 0 1 34,0"/></g>`;
    const zz = P(u + 15, v + 14, T + 4);
    s += `<text x="${zz[0].toFixed(1)}" y="${(zz[1] - 14).toFixed(1)}" class="zzz" id="sc-zzz">z z z</text>`;
    s += '</g>';
    return s;
  }

  // Breadboard στα δεξιά της πλακέτας.
  const BB = { u: 62, v: 2, du: 60, dv: 26 };
  function breadboard() {
    const { u, v, du, dv } = BB;
    rec({ t: 'bb' });
    let s = '<g data-part="breadboard">' + box(u, v, 0, du, dv, 2.4, 'bb');
    let holes = '';
    for (let x = 3; x < du - 2; x += 2.54) {
      for (const y of [2.2, 4.6]) holes += `<rect x="${(u + x).toFixed(2)}" y="${(v + y).toFixed(2)}" width="0.9" height="0.9"/>`;
      for (let y = 8; y < dv - 7; y += 2.54) holes += `<rect x="${(u + x).toFixed(2)}" y="${(v + y).toFixed(2)}" width="0.9" height="0.9"/>`;
      for (const y of [dv - 5.5, dv - 3.1]) holes += `<rect x="${(u + x).toFixed(2)}" y="${(v + y).toFixed(2)}" width="0.9" height="0.9"/>`;
    }
    s += `<g transform="${planeMatrix(2.4)}"><g class="bb-holes">${holes}</g>
      <rect x="${u + 1}" y="${v + 1.3}" width="${du - 2}" height="0.25" class="rail-r"/>
      <rect x="${u + 1}" y="${v + 6.2}" width="${du - 2}" height="0.25" class="rail-b"/>
      <rect x="${u + 1}" y="${v + dv - 6.6}" width="${du - 2}" height="0.25" class="rail-r"/>
      <rect x="${u + 1}" y="${v + dv - 1.6}" width="${du - 2}" height="0.25" class="rail-b"/>
      <rect x="${u + 1}" y="${v + dv / 2 - 0.6}" width="${du - 2}" height="1.2" class="bb-gap"/></g></g>`;
    return s;
  }

  function led(u, v) {
    rec({ t: 'led', u, v });
    const base = P(u, v, 2.4);
    const top = P(u, v, 14);
    const sh = P(u + 4, v - 1, 2.4);
    return `<ellipse cx="${sh[0].toFixed(1)}" cy="${sh[1].toFixed(1)}" rx="9" ry="4.5" class="shadow"/><g id="sc-led" class="sc-led" data-part="led">
      <path d="M${pt(P(u - 1.2, v, 2.4))} L${pt(P(u - 1.2, v, 6))} M${pt(P(u + 1.2, v, 2.4))} L${pt(P(u + 1.2, v, 6.5))}" class="legs"/>
      <circle cx="${top[0].toFixed(1)}" cy="${top[1].toFixed(1)}" r="36" class="halo red" id="sc-led-halo"/>
      <rect x="${(top[0] - 7).toFixed(1)}" y="${top[1].toFixed(1)}" width="14" height="${(base[1] - top[1] - 12).toFixed(1)}" class="led-body"/>
      <ellipse cx="${top[0].toFixed(1)}" cy="${(base[1] - 12).toFixed(1)}" rx="8.4" ry="3.6" class="led-rim"/>
      <path d="M${(top[0] - 7).toFixed(1)},${top[1].toFixed(1)} a7,7 0 0 1 14,0 z" class="led-dome"/>
      <ellipse cx="${(top[0] - 2.4).toFixed(1)}" cy="${(top[1] + 3).toFixed(1)}" rx="1.8" ry="3.6" class="led-shine"/>
    </g>`;
  }

  function button(u, v) {
    rec({ t: 'button', u, v });
    let s = '<g id="sc-btn" class="sc-btn clickable" data-part="button" tabindex="0" role="button" aria-label="Κουμπί: πάτα για αλλαγή">';
    s += box(u - 4.5, v - 4.5, 2.4, 9, 9, 3, 'btn-body');
    const c = P(u, v, 6.6);
    s += `<g id="sc-btn-cap"><ellipse cx="${c[0].toFixed(1)}" cy="${(c[1] + 3.4).toFixed(1)}" rx="9.5" ry="5.2" class="cap-side"/><ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="9.5" ry="5.2" class="cap"/></g>`;
    s += '</g>';
    return s;
  }

  function pir(u, v) {
    rec({ t: 'pir', u, v });
    let s = '<g id="sc-pir" class="sc-pir clickable" data-part="pir" tabindex="0" role="button" aria-label="Αισθητήρας PIR: πάτα για κίνηση">';
    s += box(u - 7, v - 7, 2.4, 14, 14, 1.4, 'pir-pcb');
    const c = P(u, v, 3.8);
    s += `<path d="M${(c[0] - 18).toFixed(1)},${c[1].toFixed(1)} a18,10 0 0 0 36,0 a18,18 0 0 0 -36,0 z" class="dome"/>
      <path d="M${(c[0] - 13).toFixed(1)},${(c[1] - 6).toFixed(1)} q13,5 26,0 M${(c[0] - 16).toFixed(1)},${(c[1] - 11).toFixed(1)} q16,5 32,0 M${(c[0] - 9).toFixed(1)},${(c[1] - 16).toFixed(1)} q9,4 18,0" class="dome-lines"/>
      <g id="sc-pir-waves" class="pwaves" transform="translate(${c[0].toFixed(1)},${(c[1] - 22).toFixed(1)})">
        <path d="M-12,0 q12,-9 24,0"/><path d="M-19,-7 q19,-13 38,0"/><path d="M-26,-14 q26,-18 52,0"/></g>`;
    s += '</g>';
    return s;
  }

  function sensor(u, v) {
    rec({ t: 'sensor', u, v });
    let s = '<g id="sc-sensor" class="sc-sensor" data-part="sensor">';
    s += box(u - 4.5, v - 6, 2.4, 9, 12, 7, 'dht');
    s += `<g transform="${planeMatrix(9.4)}">${[0, 1, 2, 3, 4].map(i => `<rect x="${u - 3.4 + i * 1.6}" y="${v - 4.6}" width="0.8" height="9.2" class="vent"/>`).join('')}</g>`;
    const c = P(u, v, 10);
    s += `<g transform="translate(${(c[0] + 16).toFixed(1)},${(c[1] - 20).toFixed(1)})"><rect x="0" y="-12" width="66" height="20" rx="4" class="readout"/><text x="33" y="2" text-anchor="middle" class="readout-t" id="sc-temp">22.5 °C</text></g>`;
    s += '</g>';
    return s;
  }

  function router(u, v) {
    rec({ t: 'router', u, v });
    let s = '<g id="sc-router" class="sc-router clickable" data-part="router" tabindex="0" role="button" aria-label="Router WiFi: πάτα για να το σβήσεις ή να το ανάψεις">';
    s += box(u, v, 0, 18, 11, 3.2, 'router-body');
    const a1 = P(u + 4, v + 1, 3.2);
    const a2 = P(u + 14, v + 1, 3.2);
    s += `<path d="M${pt(a1)} l-3,-26 M${pt(a2)} l3,-26" class="antenna-rod"/>`;
    for (let i = 0; i < 4; i++) {
      const l = P(u + 4 + i * 3, v + 11, 2);
      s += `<circle cx="${l[0].toFixed(1)}" cy="${l[1].toFixed(1)}" r="1.1" class="rled" id="sc-rled-${i}"/>`;
    }
    const w = P(u + 9, v + 5, 3.2);
    s += `<g id="sc-router-waves" class="waves" transform="translate(${w[0].toFixed(1)},${(w[1] - 34).toFixed(1)})"><path d="M-8,0 a10,10 0 0 1 16,0"/><path d="M-14,-6 a18,18 0 0 1 28,0"/></g>`;
    s += '</g>';
    return s;
  }

  function rpi(u, v, id) {
    rec({ t: 'rpi', u, v });
    let s = `<g id="${id || 'sc-pi'}" class="sc-pi" data-part="rpi-broker">`;
    s += box(u, v, 0, 30, 20, 1.4, 'pi-pcb');
    s += box(u + 26, v + 2, 1.4, 5, 7, 4, 'port') + box(u + 26, v + 11, 1.4, 5, 7, 4, 'port');
    s += box(u + 5, v + 6, 1.4, 8, 8, 0.8, 'chip');
    s += box(u + 1, v + 1, 1.4, 20, 2.2, 2.2, 'pinhdr');
    s += `<g transform="${planeMatrix(1.4)}"><text x="${u + 14}" y="${v + 17}" class="silk2">Raspberry Pi</text></g>`;
    s += '</g>';
    return s;
  }

  // Raspberry Pi ως κύρια πλακέτα (μαθήματα Python): PCB 56×34, header 40 pins στη μπροστινή πλευρά.
  // Η σειρά με τα μονά pins ακολουθεί το πραγματικό Pi: pin 7 = GPIO 4, 9 = GND, 11 = GPIO 17, 13 = GPIO 27.
  const PI_ODD = ['3V3', 'GPIO2', 'GPIO3', 'GPIO4', 'GND', 'GPIO17', 'GPIO27', 'GPIO22', '3V3b', 'GPIO10', 'GPIO9', 'GPIO11', 'GNDb', 'ID_SD', 'GPIO5', 'GPIO6', 'GPIO13', 'GPIO19', 'GPIO26', 'GNDc'];
  // Raspberry Pi 5 (όπως το πραγματικό). Η μακριά πλευρά (L, 58) πάει προς τον θεατή (+v), η στενή (W, 36) κατά +u:
  // έτσι φαίνονται τα ανοίγματα των USB/Ethernet (μπροστά) και των HDMI/USB-C (δεξιά). Header 2×20 στην πίσω μακριά πλευρά.
  // Η σειρά με τα μονά pins (pin 1, 3, 5…) είναι η εσωτερική: pin 7 = GPIO 4, 9 = GND, 11 = GPIO 17, 13 = GPIO 27.
  const PI_T = 1.6;            // πάνω επιφάνεια του PCB
  const PI_PIN_L = i => 4 + i * 2.32;
  const PI_PIN_TOP = PI_T + 2.4 + 5.2;
  function piPinUV(name) {
    const i = PI_ODD.indexOf(name);
    return { u: ESP.u + 4.4, v: ESP.v + PI_PIN_L(i), h: PI_PIN_TOP };
  }
  function piPin(name) {
    const q = piPinUV(name);
    return P(q.u, q.v, q.h);
  }
  // Ψηλή ακίδα header: σκούρο περίγραμμα, ασημένιο σώμα, μικρή κορυφή.
  function tallPin(u, v, h0, h1) {
    const a = P(u, v, h0);
    const b = P(u, v, h1);
    return `<path d="M${pt(a)} L${pt(b)}" class="pin-ol"/><path d="M${pt(a)} L${pt(b)}" class="pin-body"/><ellipse cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" rx="0.75" ry="0.45" class="pin-tip"/>`;
  }
  function raspberryLogo(cx, cy) {
    const berries = [[0, 0], [1.6, 0.4], [-1.6, 0.4], [0.8, 1.7], [-0.8, 1.7], [0, 3.1], [1.9, 2.1], [-1.9, 2.1]];
    return berries.map(([x, y]) => `<circle cx="${cx + x}" cy="${cy + y}" r="0.85" class="pi-logo"/>`).join('')
      + `<path d="M${cx - 1.6},${cy - 1.6} q1.6,-1.2 1.6,0.6 q0,-1.8 1.6,-0.6" class="pi-logo-leaf"/>`;
  }
  function piHost() {
    const { u, v } = ESP;
    const T = PI_T;
    rec({ t: 'pi5' });
    // τοπικές συντεταγμένες: L κατά μήκος (→ v), W κατά πλάτος (→ u)
    const B = (L, W, h, dL, dW, dh, cls, id) => box(u + W, v + L, h, dW, dL, dh, cls, id);
    const Q = (L, W, h) => P(u + W, v + L, h);
    // κείμενο/σχέδια πάνω στο PCB: διαβάζεται από μπροστά προς τα πίσω (x αυξάνει προς −L), όπως στο πραγματικό
    const onTop = h => `${planeMatrix(h)} matrix(0,-1,1,0,0,0)`;
    const tx = L => -(v + L);
    const ty = W => u + W;
    let s = '<g id="sc-esp" class="sc-esp sc-pihost" data-part="pi">';
    s += B(0, 0, 0, 58, 36, 1.6, 'pi-pcb');
    // χρυσές τρύπες στερέωσης, λογότυπο και silkscreen
    for (const [hl, hw] of [[2.8, 2.8], [2.8, 33.2], [42.8, 2.8], [42.8, 33.2]]) {
      const c = Q(hl, hw, T);
      s += `<ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="2.4" ry="1.4" class="pi-hole"/><ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="1.2" ry="0.7" class="pi-hole-in"/>`;
    }
    s += `<g transform="${onTop(T)}">${raspberryLogo(tx(11), ty(26))}`
      + `<text x="${tx(33)}" y="${ty(9.6)}" class="pi-silk">Raspberry Pi</text><rect x="${tx(19.4)}" y="${ty(9.6) - 2}" width="2.2" height="2.6" rx="0.3" class="pi-silk-box"/><text x="${tx(19.4) + 0.55}" y="${ty(9.6)}" class="pi-silk">5</text>`
      + `<text x="${tx(34.5)}" y="${ty(30.6)}" class="pi-silk big">HDMI</text></g>`;
    // header 2×20 με ψηλές ακίδες (πίσω μακριά πλευρά)
    s += '<g data-part="pi-gpio">';
    s += B(2.8, 1.2, T, 46.4, 4.4, 2.4, 'pinhdr');
    for (const ww of [2.4, 4.4]) for (let i = 0; i < 20; i++) s += tallPin(u + ww, v + PI_PIN_L(i), T + 2.4, PI_PIN_TOP);
    s += '</g>';
    // ανεμιστήρας (λευκό βύσμα) και PoE (2×2)
    s += B(5, 7.6, T, 3.6, 2.4, 2.4, 'conn-white');
    s += B(46, 8, T, 3.6, 3.6, 1.4, 'pinhdr');
    for (const [pl, pw] of [[46.9, 8.9], [48.7, 8.9], [46.9, 10.7], [48.7, 10.7]]) s += tallPin(u + pw, v + pl, T + 1.4, T + 5);
    // επεξεργαστής BCM2712 (μεταλλικό κάλυμμα), RAM, RP1
    s += `<g data-part="pi-ram">${B(10.5, 13, T, 9.6, 6.6, 1.2, 'chip')}</g>`;
    s += `<g data-part="pi-cpu">${B(21, 13, T, 11, 11, 1.8, 'cpu-lid')}<g transform="${onTop(T + 1.8)}"><text x="${tx(30.6)}" y="${ty(16.4)}" class="chip-t dark">BCM2712</text><text x="${tx(30.6)}" y="${ty(18.8)}" class="chip-t dark">ARM · 2.4 GHz</text></g></g>`;
    s += `<g data-part="pi-rp1">${B(34, 9, T, 8, 8, 1.2, 'chip')}<g transform="${onTop(T + 1.2)}">${raspberryLogo(tx(38), ty(12.6))}</g></g>`;
    s += B(43.5, 15, T, 4, 4, 0.8, 'chip');
    // συνδέσεις FPC (κάμερα / οθόνη)
    s += `<g data-part="pi-fpc">${B(35, 20.5, T, 10, 2.6, 1.6, 'fpc')}${B(35, 25, T, 10, 2.6, 1.6, 'fpc')}`;
    s += `<g transform="${onTop(T + 1.6)}"><rect x="${tx(44.4)}" y="${ty(21.2)}" width="8.8" height="1.2" class="fpc-gold"/><rect x="${tx(44.4)}" y="${ty(25.7)}" width="8.8" height="1.2" class="fpc-gold"/></g></g>`;
    // δεξιά μακριά πλευρά: 2 micro-HDMI και USB-C τροφοδοσίας (τα ανοίγματα βλέπουν δεξιά)
    s += '<g data-part="pi-hdmi">';
    for (const hl of [21, 28.5]) {
      s += B(hl, 31.4, T, 5.4, 5.2, 2.6, 'usb');
      s += `<g transform="${planeVH(u + 36.6)}"><rect x="${v + hl + 0.8}" y="${-(T + 2.1)}" width="3.8" height="1.5" rx="0.4" class="usbc-slot"/></g>`;
    }
    s += '</g>';
    s += `<g data-part="pi-power">${B(6.5, 31, T, 7, 5.8, 2.8, 'usb')}<g transform="${planeVH(u + 36.8)}"><rect x="${v + 7.4}" y="${-(T + 2.3)}" width="5.2" height="1.8" rx="0.9" class="usbc-slot"/></g></g>`;
    // μπροστινή στενή πλευρά: δύο διπλά USB-A (τα μπλε είναι USB 3) και Ethernet (τα ανοίγματα βλέπουν μπροστά)
    s += '<g data-part="pi-ports">';
    s += B(49.6, 1.4, T, 10.4, 8.4, 8.4, 'usb-a') + B(49.6, 11, T, 10.4, 8.4, 8.4, 'usb-a usb3');
    s += B(49, 20.6, T, 11.2, 14, 7.6, 'eth');
    for (const [pw, h] of [[1.4, 2.6], [1.4, 6.4], [11, 2.6], [11, 6.4]]) {
      s += `<g transform="${planeUH(v + 60)}"><rect x="${u + pw + 1.4}" y="${-(T + h + 1.6)}" width="5.6" height="1.5" rx="0.2" class="${pw > 5 ? 'usb3-tongue' : 'usb-tongue'}"/></g>`;
    }
    s += `<g transform="${planeUH(v + 60.2)}"><rect x="${u + 22.6}" y="${-(T + 6.4)}" width="10" height="5.4" rx="0.4" class="eth-mouth"/></g>`;
    s += '</g>';
    // μικρά SMD
    for (const [cl, cw] of [[6.4, 14], [7.2, 17], [20, 26.5], [23, 26.5], [18.6, 10], [21, 10], [22, 46.5], [44, 27.5], [28, 9]]) if (cw < 30) s += B(cl, cw, T, 0.9, 1.6, 0.5, 'smd-c');
    // LED τροφοδοσίας και δραστηριότητας
    const pwr = Q(4, 32, T + 0.3);
    const act = Q(4, 29.6, T + 0.3);
    s += `<circle cx="${pwr[0].toFixed(1)}" cy="${pwr[1].toFixed(1)}" r="1.5" class="smd pwr" id="sc-pwr"/>`;
    s += `<circle cx="${act[0].toFixed(1)}" cy="${act[1].toFixed(1)}" r="1.5" class="smd act" id="sc-d2"/>`;
    s += '</g>';
    return s;
  }

  // Μικρό ESP32 που στέλνει μετρήσεις στο Pi (εικονικός client του broker).
  function miniEsp(u, v) {
    rec({ t: 'miniEsp', u, v });
    let s = '<g id="sc-node" class="sc-node" data-part="mini-esp">';
    s += box(u, v, 0, 22, 12, 1.2, 'pcb');
    s += box(u + 3, v + 2, 1.2, 9, 8, 1.2, 'shield');
    s += `<g transform="${planeMatrix(1.2)}"><text x="${u + 13}" y="${v + 7.5}" class="silk2">ESP32</text></g>`;
    s += '</g>';
    return s;
  }

  // Επίπεδο u–h (κάθετο, σε σταθερό v): για ό,τι γράφεται στο μπροστινό πρόσωπο όρθιων πλακετών.
  const planeUH = v => `matrix(${(C * K).toFixed(4)},${(S * K).toFixed(4)},0,${K.toFixed(4)},${(-v * C * K).toFixed(2)},${(v * S * K).toFixed(2)})`;

  function hull(points) {
    const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const q of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
    const upper = [];
    for (const q of pts.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }
  // Κύλινδρος με άξονα προς +v (τα «μάτια» του HC-SR04).
  function cylinderV(cu, cv, ch, r, len) {
    const ring = (vv, rr) => Array.from({ length: 28 }, (_, i) => { const t = (i / 28) * Math.PI * 2; return P(cu + rr * Math.cos(t), vv, ch + rr * Math.sin(t)); });
    const back = ring(cv, r);
    const front = ring(cv + len, r);
    return poly(hull(back.concat(front)), 'cyl-side') + poly(front, 'cyl-face') + poly(ring(cv + len + 0.01, r * 0.7), 'cyl-mesh') + poly(ring(cv + len + 0.02, r * 0.25), 'cyl-core');
  }

  // Αισθητήρας απόστασης HC-SR04: όρθια μπλε πλακέτα στο breadboard, «μάτια» προς τον θεατή (+v).
  const US = { u: 98, v: 9, w: 20 };
  function ultrasonic() {
    const { u, v, w } = US;
    const H = 2.4;
    rec({ t: 'ultrasonic' });
    let s = '<g id="sc-us" class="sc-us" data-part="ultrasonic">';
    // 4 pins στο breadboard
    for (let i = 0; i < 4; i++) s += box(u + 6.2 + i * 2.54, v + 0.2, H, 0.6, 0.6, 2.4, 'pinhdr');
    s += box(u, v, H + 2, w, 1.2, 10, 'us-pcb');
    s += `<g transform="${planeUH(v + 1.2)}"><text x="${u + 7.2}" y="${-(H + 11)}" class="us-t">HC-SR04</text>`
      + `<text x="${u + 6.4}" y="${-(H + 2.7)}" class="us-s">VCC TRIG ECHO GND</text></g>`;
    s += box(u + 8.6, v + 1.2, H + 9, 2.8, 0.8, 1.6, 'shield');
    s += cylinderV(u + 4.6, v + 1.2, H + 7, 3.7, 4);
    s += cylinderV(u + w - 4.6, v + 1.2, H + 7, 3.7, 4);
    // κύματα (40 kHz) προς το εμπόδιο
    const c = P(u + w / 2, v + 6, H + 7);
    s += `<g id="sc-us-waves" class="us-waves" transform="translate(${c[0].toFixed(1)},${c[1].toFixed(1)})">`;
    for (const r of [8, 15, 22]) s += `<path d="M${(-r * 0.87).toFixed(1)},${(r * 0.1).toFixed(1)} Q${(-r * 0.3).toFixed(1)},${(r * 0.75).toFixed(1)} ${(r * 0.25).toFixed(1)},${(r * 0.62).toFixed(1)}"/>`;
    s += '</g></g>';
    return s;
  }
  function usPinUV(i) { return { u: US.u + 6.5 + i * 2.54, v: US.v + 2.6, h: 2.4 }; }

  // Φανάρι: μαύρη κολόνα με τρία φώτα, στο breadboard.
  const TL = { u: 80, v: 16 };
  function trafficLight() {
    const { u, v } = TL;
    rec({ t: 'traffic' });
    let s = '<g id="sc-tl" class="sc-tl" data-part="traffic">';
    s += box(u - 1, v - 1, 2.4, 2, 2, 4, 'tl-pole');
    s += box(u - 2.6, v - 1.6, 6.4, 5.2, 3.2, 16, 'tl-body');
    const lamps = [['r', 18.4], ['y', 13.4], ['g', 8.4]];
    s += `<g transform="${planeUH(v + 1.6)}">`;
    for (const [k, hh] of lamps) {
      s += `<circle cx="${u}" cy="${-hh}" r="3.4" class="tl-halo tl-${k}" id="sc-tl-${k}-halo"/>`;
      s += `<circle cx="${u}" cy="${-hh}" r="1.7" class="tl-lamp tl-${k}" id="sc-tl-${k}"/>`;
    }
    s += '</g></g>';
    return s;
  }
  function tlPinUV(i) { return { u: TL.u - 2.54 + i * 2.54, v: TL.v + 5, h: 2.4 }; }

  // Αυτοκινητάκι-εμπόδιο: το σέρνεις κατά μήκος του άξονα +v (πιο κοντά ή πιο μακριά από τον αισθητήρα).
  const CAR = { u: US.u + US.w / 2, v0: 31 };
  const CAR_SCALE = 0.2; // μονάδες πάγκου ανά εκατοστό
  function carV(cm) { return CAR.v0 + Math.max(2, Math.min(200, cm)) * CAR_SCALE; }
  function car() {
    const u = CAR.u;
    const v = 0;
    rec({ t: 'car' });
    let s = `<g id="sc-car" class="sc-car clickable draggable" data-part="car" tabindex="0" role="slider" aria-label="Εμπόδιο: σύρε το για να αλλάξει η απόσταση" aria-valuemin="2" aria-valuemax="200">`;
    s += shadow(u - 4, v, 8, 15);
    for (const [wu, wv] of [[3.6, 3], [3.6, 11.2]]) {
      const ring = Array.from({ length: 20 }, (_, i) => { const t = (i / 20) * Math.PI * 2; return P(u + wu, v + wv + 1.6 * Math.cos(t), 1.6 + 1.6 * Math.sin(t)); });
      s += poly(ring, 'car-wheel');
    }
    s += box(u - 3.8, v, 0.9, 7.6, 15, 3.6, 'car-body');
    s += box(u - 3.2, v + 4, 4.5, 6.4, 7, 3, 'car-cabin');
    s += poly([P(u + 3.2, v + 4.6, 5), P(u + 3.2, v + 10.4, 5), P(u + 3.2, v + 10, 7.1), P(u + 3.2, v + 5, 7.1)], 'car-glass');
    s += poly([P(u - 2.6, v + 11, 5), P(u + 2.6, v + 11, 5), P(u + 2.6, v + 11, 7.1), P(u - 2.6, v + 11, 7.1)], 'car-glass');
    for (const [wu, wv] of [[3.9, 3], [3.9, 11.2]]) {
      const ring = Array.from({ length: 20 }, (_, i) => { const t = (i / 20) * Math.PI * 2; return P(u + wu, v + wv + 1.6 * Math.cos(t), 1.6 + 1.6 * Math.sin(t)); });
      s += poly(ring, 'car-wheel') + poly(ring.map((q, i) => { const t = (i / 20) * Math.PI * 2; return P(u + wu + 0.05, v + wv + 0.7 * Math.cos(t), 1.6 + 0.7 * Math.sin(t)); }), 'car-hub');
    }
    s += '</g>';
    return s;
  }
  // Μετατόπιση της ομάδας του αυτοκινήτου για απόσταση cm (σε μονάδες SVG).
  function carOffset(cm) { const q = P(0, carV(cm), 0); return `translate(${q[0].toFixed(1)},${q[1].toFixed(1)})`; }
  // Πόσο αλλάζει η απόσταση (cm) όταν το ποντίκι κινείται (dx, dy) σε μονάδες SVG.
  function dragToCm(dx, dy) {
    const ax = -C * K;
    const ay = S * K;
    return (dx * ax + dy * ay) / (ax * ax + ay * ay) / CAR_SCALE;
  }

  function tablet(u, v) {
    rec({ t: 'tablet', u, v });
    let s = '<g id="sc-dash" class="sc-dash" data-part="tablet">';
    s += box(u, v, 0, 26, 18, 1.2, 'tab-body');
    s += `<g transform="${planeMatrix(1.2)}"><rect x="${u + 1.5}" y="${v + 1.5}" width="23" height="15" rx="0.8" class="tab-screen"/>
      <text x="${u + 3}" y="${v + 5.5}" class="tab-h">Dashboard</text>
      <text x="${u + 3}" y="${v + 9.5}" class="tab-t" id="sc-dash-1"> </text>
      <text x="${u + 3}" y="${v + 13}" class="tab-t" id="sc-dash-2"> </text></g>`;
    s += '</g>';
    return s;
  }

  function laptop(u, v, cls, id) {
    let s = `<g id="${id}" class="sc-laptop ${cls}" data-part="${cls === 'unk' ? 'unknown-device' : 'laptop'}">`;
    s += box(u, v, 0, 18, 13, 1, 'lap-base');
    const a = [P(u, v, 1), P(u + 18, v, 1), P(u + 18, v - 3, 13), P(u, v - 3, 13)];
    s += poly(a, 'lap-lid');
    s += '</g>';
    return s;
  }

  // ------------------------------------------------------------ σκηνές

  function fit(svgInner, bounds, extraClass, label) {
    const [x0, y0, x1, y1] = bounds;
    if (MAN) { root.IoTScene.manifest = MAN; MAN = null; }
    return `<svg class="scene ${extraClass || ''}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" data-vb="${x0} ${y0} ${x1 - x0} ${y1 - y0}" role="img" aria-label="${label}">
      <defs>
        <radialGradient id="g-red"><stop offset="0" stop-color="#ff6a4d" stop-opacity="0.85"/><stop offset="1" stop-color="#ff6a4d" stop-opacity="0"/></radialGradient>
        <radialGradient id="g-blue"><stop offset="0" stop-color="#5fb4ff" stop-opacity="0.9"/><stop offset="1" stop-color="#5fb4ff" stop-opacity="0"/></radialGradient>
      </defs>
      <g class="floor">${floorGrid()}</g>
      <g class="sc-content">${svgInner}</g>
    </svg>`;
  }

  function floorGrid() {
    let s = '';
    for (let i = -60; i <= 180; i += 10) {
      s += `<path d="M${pt(P(i, -70, 0))} L${pt(P(i, 60, 0))}"/>`;
    }
    for (let j = -70; j <= 60; j += 10) {
      s += `<path d="M${pt(P(-60, j, 0))} L${pt(P(180, j, 0))}"/>`;
    }
    return s;
  }

  // Σκηνή άσκησης Python: Raspberry Pi + breadboard, και (με broker) το δίκτυο του σπιτιού γύρω του.
  function piScene(hw, world) {
    MAN = [];
    const net = !!(world && world.broker);
    let back = '';
    let mid = piHost();
    let front = '';
    const labels = [callout(P(28, 16, 4), -20, 104, net ? 'RASPBERRY PI · BROKER + PYTHON' : 'RASPBERRY PI', null, 'pi'), callout(piPin('GPIO26'), -10, -96, 'GPIO HEADER · 40 PINS', null, 'pi-gpio')];
    const wires = [];
    mid += breadboard();
    const LED_AT = [72, 15];
    const BTN_AT = [86, 15];
    const PIR_AT = [102, 15];
    if (hw.includes('led') || hw.includes('button') || hw.includes('pir') || !(net || hw.includes('web'))) {
      front += led(LED_AT[0], LED_AT[1]);
      wires.push(wire(piPinUV('GPIO17'), { u: LED_AT[0] - 2.54, v: LED_AT[1] + 2.54, h: 2.4 }, 'w-led', 46, 'sc-w-led'));
      wires.push(wire(piPinUV('GND'), { u: LED_AT[0] + 2.54, v: BB.v + BB.dv - 2, h: 2.4 }, 'w-gnd', 30));
      labels.push(callout(P(LED_AT[0], LED_AT[1], 14), -30, -96, 'LED · GPIO 17', null, 'led'));
    }
    if (hw.includes('button')) {
      front += button(BTN_AT[0], BTN_AT[1]);
      wires.push(wire(piPinUV('GPIO27'), { u: BTN_AT[0] - 5.1, v: BTN_AT[1] + 2.54, h: 2.4 }, 'w-btn', 54, 'sc-w-btn'));
      labels.push(callout(P(BTN_AT[0], BTN_AT[1], 5), 10, -66, 'ΚΟΥΜΠΙ · GPIO 27', null, 'button'));
    }
    if (hw.includes('pir')) {
      front += pir(PIR_AT[0], PIR_AT[1]);
      wires.push(wire(piPinUV('GPIO4'), { u: PIR_AT[0] - 8.9, v: PIR_AT[1] + 5, h: 2.4 }, 'w-pir', 62, 'sc-w-pir'));
      labels.push(callout(P(PIR_AT[0] + 4, PIR_AT[1], 4), 34, -28, 'PIR · GPIO 4', null, 'pir'));
    }
    let links = '';
    const web = hw.includes('web');
    if (net || web) {
      back += router(-14, -40);
      labels.push(callout(P(-5, -38, 9), -60, -22, 'ROUTER', null, 'router'));
      back += tablet(100, -40);
      labels.push(callout(P(112, -32, 2), 40, -36, web ? (net ? 'DASHBOARD · BROWSER' : 'TABLET · BROWSER') : 'DASHBOARD', null, 'tablet'));
      links += `<path id="sc-link-wifi" d="M${pt(P(-5, -32, 4))} Q${pt(P(0, -14, 26))} ${pt(P(10, 10, 2))}" class="link"/>`;
      links += `<path id="sc-link-pi-dash" d="M${pt(P(40, 6, 2))} Q${pt(P(80, -20, 30))} ${pt(P(106, -32, 1.2))}" class="link"/>`;
    }
    if (net) {
      back += miniEsp(40, -52);
      labels.push(callout(P(51, -46, 2), -20, -44, hw.includes('sensor') ? 'ESP32 · ΑΙΣΘΗΤΗΡΑΣ' : 'ESP32 · ΣΥΣΚΕΥΗ', null, 'mini-esp'));
      if (hw.includes('sensor')) back += sensor(68, -46);
      links += `<path id="sc-link-esp-pi" d="M${pt(P(51, -44, 2))} Q${pt(P(40, -20, 34))} ${pt(P(28, 6, 2))}" class="link"/>`;
    }
    const inner = `<g class="sc-back">${back}</g><g class="sc-links">${links}</g><g class="sc-mid">${mid}</g><g class="sc-wires">${wires.join('')}</g><g class="sc-front">${front}</g><g class="sc-labels">${labels.join('')}</g><g id="sc-packets"></g>`;
    return fit(inner, net || web ? [-260, -340, 620, 260] : [-160, -160, 470, 230], 'lab', 'Ισομετρική σκηνή: Raspberry Pi, breadboard και εξαρτήματα');
  }

  // Σκηνή άσκησης κώδικα: ESP32 + breadboard + ό,τι χρειάζεται το μάθημα.
  function labScene(hw, world) {
    MAN = [];
    const net = !!(world && world.broker);
    const wifi = net || hw.includes('router') || (world && world.wifi);
    let back = '';
    let mid = '';
    let front = '';
    const labels = [];
    if (wifi) {
      back += router(-14, -38);
      labels.push(callout(P(-5, -36, 9), -60, -22, 'ROUTER WIFI', null, 'router'));
    }
    if (net) {
      back += rpi(52, -50);
      back += tablet(98, -44);
      labels.push(callout(P(66, -44, 6), -10, -40, 'RASPBERRY PI · BROKER', null, 'rpi-broker'));
      labels.push(callout(P(110, -36, 2), 40, -36, 'DASHBOARD', null, 'tablet'));
    }
    mid += esp32();
    labels.push(callout(P(14, 14, 4), -84, -48, 'ESP32', null, 'esp32'));
    mid += breadboard();
    // καλώδια από τα pins στο breadboard
    const wires = [];
    const LED_AT = [72, 15];
    const BTN_AT = [86, 15];
    const PIR_AT = [102, 15];
    const SEN_AT = [116, 10];
    // Το LED μπαίνει στα μαθήματα που δεν έχουν αισθητήρα απόστασης/φανάρι (ή όταν το ζητούν ρητά).
    if (hw.includes('led') || !(hw.includes('ultrasonic') || hw.includes('traffic'))) {
      front += led(LED_AT[0], LED_AT[1]);
      wires.push(wire(espPinUV('D2'), { u: LED_AT[0] - 2.54, v: LED_AT[1] + 2.54, h: 2.4 }, 'w-led', 46, 'sc-w-led'));
      wires.push(wire(espPinUV('GND'), { u: LED_AT[0] + 2.54, v: BB.v + BB.dv - 2, h: 2.4 }, 'w-gnd', 30));
      labels.push(callout(P(LED_AT[0], LED_AT[1], 14), 26, -92, 'LED · GPIO 2', null, 'led'));
    }
    if (hw.includes('button')) {
      front += button(BTN_AT[0], BTN_AT[1]);
      wires.push(wire(espPinUV('D15'), { u: BTN_AT[0] - 5.1, v: BTN_AT[1] + 2.54, h: 2.4 }, 'w-btn', 54, 'sc-w-btn'));
      labels.push(callout(P(BTN_AT[0], BTN_AT[1], 5), 10, -66, 'ΚΟΥΜΠΙ · GPIO 15', null, 'button'));
    }
    if (hw.includes('pir')) {
      front += pir(PIR_AT[0], PIR_AT[1]);
      wires.push(wire(espPinUV('D4'), { u: PIR_AT[0] - 8.9, v: PIR_AT[1] + 5, h: 2.4 }, 'w-pir', 62, 'sc-w-pir'));
      labels.push(callout(P(PIR_AT[0] + 4, PIR_AT[1], 4), hw.includes('sensor') ? 70 : 34, hw.includes('sensor') ? -78 : -28, 'PIR · GPIO 4', null, 'pir'));
    }
    if (hw.includes('sensor')) {
      front += sensor(SEN_AT[0], SEN_AT[1]);
      labels.push(callout(P(SEN_AT[0] + 3, SEN_AT[1] + 4, 4), 30, 30, 'ΑΙΣΘΗΤΗΡΑΣ', null, 'sensor'));
    }
    if (hw.includes('ultrasonic')) {
      front += ultrasonic();
      wires.push(wire(espPinUV('D5'), usPinUV(1), 'w-trig', 70, 'sc-w-trig'));
      wires.push(wire(espPinUV('D18'), usPinUV(2), 'w-echo', 64, 'sc-w-echo'));
      wires.push(wire(espPinUV('GND'), usPinUV(3), 'w-gnd', 40));
      labels.push(callout(P(US.u + US.w - 3, US.v, 14), 40, -50, 'HC-SR04 · TRIG 5 · ECHO 18', null, 'ultrasonic'));
      front += `<g id="sc-car-move" transform="${carOffset(50)}">${car()}</g>`;
      front += `<g id="sc-dist" class="dist-line"><path id="sc-dist-path" d=""/><g id="sc-dist-tag"><rect x="-26" y="-9" width="52" height="18" rx="9" class="dist-pill"/><text x="0" y="3.6" text-anchor="middle" class="dist-t" id="sc-dist-t">50 cm</text></g></g>`;
      labels.push(`<g id="sc-car-label">${callout(P(CAR.u + 4, 6, 4), 50, 26, 'ΕΜΠΟΔΙΟ · ΣΥΡΕ ΤΟ', null, 'car')}</g>`);
    }
    if (hw.includes('traffic')) {
      front += trafficLight();
      wires.push(wire(espPinUV('D25'), tlPinUV(0), 'w-red', 58, 'sc-w-red'));
      wires.push(wire(espPinUV('D26'), tlPinUV(1), 'w-yel', 52, 'sc-w-yel'));
      wires.push(wire(espPinUV('D27'), tlPinUV(2), 'w-grn', 46, 'sc-w-grn'));
      labels.push(callout(P(TL.u, TL.v + 1.6, 22), 40, -60, 'ΦΑΝΑΡΙ · 25 · 26 · 27', null, 'traffic'));
    }
    let links = '';
    if (wifi) links += `<path id="sc-link-wifi" d="M${pt(P(-5, -30, 4))} Q${pt(P(-4, -12, 30))} ${pt(P(3, 14, PCB_TOP + 1))}" class="link"/>`;
    if (net) {
      links += `<path id="sc-link-esp-pi" d="M${pt(P(3, 14, PCB_TOP + 1))} Q${pt(P(30, -20, 40))} ${pt(P(64, -40, 2))}" class="link"/>`;
      links += `<path id="sc-link-pi-dash" d="M${pt(P(70, -36, 2))} Q${pt(P(92, -30, 26))} ${pt(P(104, -36, 1.2))}" class="link"/>`;
    }
    const inner = `<g class="sc-back">${back}</g><g class="sc-links">${links}</g><g class="sc-mid">${mid}</g><g class="sc-wires">${wires.join('')}</g><g class="sc-front">${front}</g><g class="sc-labels">${labels.join('')}</g><g id="sc-packets"></g>`;
    const b = net ? [-260, -330, 600, 230] : wifi ? [-250, -250, 560, 220] : [-140, -150, 450, 210];
    return fit(inner, b, 'lab', 'Ισομετρική σκηνή εργαστηρίου: πλακέτα ESP32, breadboard και εξαρτήματα');
  }

  // Αρχική: η πλακέτα μόνη της, με ετικέτες για τα μέρη της.
  function homeScene() {
    MAN = [];
    let inner = esp32();
    const T = PCB_TOP;
    inner += callout(P(16, 14, T + 2.4), -96, -66, 'ESP-WROOM-32', null, 'esp-module');
    inner += callout(P(3, 14, T + 0.8), -80, 6, 'ΚΕΡΑΙΑ WIFI', null, 'esp-antenna');
    inner += callout(P(52, 14, T + 1.6), 74, 6, 'USB-C', null, 'esp-usb');
    inner += callout(espPin('D2'), 70, 40, 'PINS GPIO · 38', null, 'esp-pins');
    inner += callout(P(43, 18.5, T + 0.4), 76, -26, 'LED GPIO 2', null, 'esp-led');
    inner += callout(P(46.7, 4.3, T + 1.3), 40, -70, 'ΚΟΥΜΠΙΑ EN / BOOT', null, 'esp-buttons');
    inner += callout(P(35.6, 13, T + 0.9), 30, -96, 'CP2102 · USB → SERIAL', null, 'esp-uart');
    inner += callout(P(31.7, 19.3, T + 1.5), -30, 66, 'ΡΥΘΜΙΣΤΗΣ 3,3 V', null, 'esp-reg');
    return fit(`<g class="sc-mid">${inner}</g>`, [-150, -120, 320, 200], 'home', 'Η πλακέτα ESP32 με ετικέτες για τα μέρη της');
  }

  // Δίκτυο του σπιτιού για ρυθμίσεις και ανάλυση: broker στο κέντρο, συσκευές γύρω.
  const NET_NODES = {
    '192.168.1.10': { u: 40, v: 0, kind: 'pi', label: 'BROKER · .10' },
    '192.168.1.42': { u: -10, v: -40, kind: 'esp', label: 'ESP32-PIR · .42' },
    '192.168.1.43': { u: 40, v: -50, kind: 'esp', label: 'ESP32-TEMP · .43' },
    '192.168.1.44': { u: 95, v: -40, kind: 'esp', label: 'ESP32-LAMP · .44' },
    '192.168.1.20': { u: 100, v: 25, kind: 'lap', label: 'DASHBOARD · .20' },
    '192.168.1.77': { u: -15, v: 35, kind: 'unk', label: 'ΑΓΝΩΣΤΗ ΣΥΣΚΕΥΗ · .77' }
  };
  function nodeCenter(ip) {
    const n = NET_NODES[ip];
    return n.kind === 'pi' ? P(n.u + 15, n.v + 10, 2) : P(n.u + 9, n.v + 6, 2);
  }
  function netScene() {
    MAN = null;
    root.IoTScene.manifest = null;
    let nodes = '';
    let links = '';
    let labels = '';
    const hub = nodeCenter('192.168.1.10');
    for (const [ip, n] of Object.entries(NET_NODES)) {
      if (n.kind === 'pi') nodes += rpi(n.u, n.v, 'sc-pi');
      else if (n.kind === 'esp') nodes += `<g class="mini-esp" data-part="mini-esp" id="sc-node-${ip.split('.').pop()}">${box(n.u, n.v, 0, 18, 12, 1.4, 'pcb')}${box(n.u + 3, n.v + 2, 1.4, 8, 8, 1.6, 'shield')}</g>`;
      else nodes += laptop(n.u, n.v, n.kind === 'unk' ? 'unk' : '', `sc-node-${ip.split('.').pop()}`);
      if (ip !== '192.168.1.10') {
        const c = nodeCenter(ip);
        links += `<path id="sc-nl-${ip.split('.').pop()}" d="M${pt(c)} Q${((c[0] + hub[0]) / 2).toFixed(1)},${(Math.min(c[1], hub[1]) - 30).toFixed(1)} ${pt(hub)}" class="link nl"/>`;
      }
      const c = nodeCenter(ip);
      labels += callout([c[0], c[1] - 10], n.u > 60 ? 30 : -30, -34, n.label, `sc-nlab-${ip.split('.').pop()}`);
    }
    labels += `<g id="sc-ports" transform="translate(${(hub[0] - 40).toFixed(1)},${(hub[1] + 34).toFixed(1)})"></g>`;
    return fit(`<g class="floor-net"></g><g class="sc-links">${links}</g><g class="sc-mid">${nodes}</g><g class="sc-labels">${labels}</g><g id="sc-packets"></g>`, [-260, -250, 600, 370], 'net', 'Χάρτης του δικτύου του σπιτιού: broker στο κέντρο και οι συσκευές γύρω του');
  }

  // ------------------------------------------------------------ ζωντανή ενημέρωση

  function animatePacket(svg, pathId, cls, delay, reverse) {
    const path = svg.querySelector('#' + pathId);
    const layer = svg.querySelector('#sc-packets');
    if (!path || !layer || !path.getTotalLength) return;
    const len = path.getTotalLength();
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4');
    dot.setAttribute('class', 'packet ' + (cls || ''));
    layer.appendChild(dot);
    const start = performance.now() + (delay || 0);
    const dur = 650;
    const step = now => {
      const k = Math.min(1, Math.max(0, (now - start) / dur));
      const p = path.getPointAtLength((reverse ? 1 - k : k) * len);
      dot.setAttribute('cx', p.x.toFixed(1));
      dot.setAttribute('cy', p.y.toFixed(1));
      dot.style.opacity = now < start ? '0' : '1';
      if (k < 1) requestAnimationFrame(step); else dot.remove();
    };
    requestAnimationFrame(step);
  }

  // Μετακίνηση (σύρσιμο) και ζουμ (ροδέλα ή κουμπιά) με αλλαγή του viewBox.
  function attachPanZoom(svg) {
    let base = svg.getAttribute('data-vb').split(' ').map(Number);
    // Προσαρμογή στο περιεχόμενο: το viewBox ξεκινά από το πραγματικό πλαίσιο των αντικειμένων.
    try {
      const bb = svg.querySelector('.sc-content').getBBox();
      if (bb.width > 0) {
        const pad = Math.max(bb.width, bb.height) * 0.03;
        base = [bb.x - pad, bb.y - pad, bb.width + 2 * pad, bb.height + 2 * pad];
        // Αν μια κάρτα επιπλέει πάνω αριστερά, το περιεχόμενο χωράει δίπλα ή κάτω από αυτήν (όπου μεγαλώνει περισσότερο).
        const r = svg.getBoundingClientRect();
        const card = svg.parentElement && svg.parentElement.querySelector('.inputs-card');
        if (card && r.width > 0 && r.height > 0 && getComputedStyle(card).position === 'absolute') {
          const ix = card.offsetLeft + card.offsetWidth, iy = card.offsetTop + card.offsetHeight;
          const ctl = svg.parentElement.querySelector('.scene-ctl');
          const bottom = ctl && getComputedStyle(ctl).position === 'absolute' ? r.height - ctl.offsetTop : 0;
          const kSide = Math.min((r.width - ix) / base[2], (r.height - bottom) / base[3]);
          const kBelow = Math.min(r.width / base[2], (r.height - iy - bottom) / base[3]);
          const k = Math.max(kSide, kBelow);
          if (k > 0) {
            const left = kSide >= kBelow ? ix : 0, top = kSide >= kBelow ? 0 : iy;
            const w = r.width / k, h = r.height / k;
            base = [base[0] - left / k - ((r.width - left) / k - base[2]) / 2, base[1] - top / k - ((r.height - top - bottom) / k - base[3]) / 2, w, h];
          }
        }
        svg.setAttribute('viewBox', base.map(n => n.toFixed(1)).join(' '));
      }
    } catch (e) { /* χωρίς διάταξη (π.χ. κρυφό): μένει το αρχικό viewBox */ }
    let vb = base.slice();
    const apply = () => svg.setAttribute('viewBox', vb.map(n => n.toFixed(1)).join(' '));
    let drag = null;
    svg.addEventListener('pointerdown', e => {
      svg._moved = false;
      if (e.target.closest('.clickable')) return;
      drag = { x: e.clientX, y: e.clientY, vb: vb.slice(), id: e.pointerId, started: false };
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      // Το σύρσιμο ξεκινά μόνο αν το ποντίκι κουνηθεί λίγο· αλλιώς είναι απλό κλικ (π.χ. σε ένα κομμάτι).
      if (!drag.started) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
        drag.started = true;
        svg._moved = true;
        svg.setPointerCapture(drag.id);
        svg.classList.add('dragging');
      }
      const r = svg.getBoundingClientRect();
      const kx = vb[2] / r.width;
      vb[0] = drag.vb[0] - (e.clientX - drag.x) * kx;
      vb[1] = drag.vb[1] - (e.clientY - drag.y) * kx;
      apply();
    });
    const end = () => { drag = null; svg.classList.remove('dragging'); };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    const zoom = (f, cx, cy) => {
      const nw = Math.min(base[2] * 2.2, Math.max(base[2] * 0.35, vb[2] * f));
      const k = nw / vb[2];
      const ox = cx === undefined ? vb[0] + vb[2] / 2 : cx;
      const oy = cy === undefined ? vb[1] + vb[3] / 2 : cy;
      vb = [ox - (ox - vb[0]) * k, oy - (oy - vb[1]) * k, vb[2] * k, vb[3] * k];
      apply();
    };
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const cx = vb[0] + ((e.clientX - r.left) / r.width) * vb[2];
      const cy = vb[1] + ((e.clientY - r.top) / r.height) * vb[3];
      zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, cx, cy);
    }, { passive: false });
    return {
      zoomIn: () => zoom(1 / 1.25),
      zoomOut: () => zoom(1.25),
      reset: () => { vb = base.slice(); apply(); },
      pan: (dx, dy) => { vb[0] += dx * vb[2] * 0.08; vb[1] += dy * vb[3] * 0.08; apply(); }
    };
  }

  // «Στήσιμο» του κυκλώματος, όπως όταν αλλάζεις μάθημα: τα εξαρτήματα πέφτουν ένα-ένα στη θέση τους,
  // μετά τα καλώδια σχεδιάζονται από άκρη σε άκρη, και στο τέλος εμφανίζονται οι ετικέτες.
  // Μόνο animations που δεν αφήνουν ίχνος (fill: backwards): όταν τελειώσουν, ισχύει πάλι το κανονικό CSS.
  function buildIn(svg) {
    if (!svg || !svg.animate) return;
    const bounce = 'cubic-bezier(.2,.9,.25,1.18)';
    const fade = (el, delay, dur) => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur || 380, delay, fill: 'backwards' });
    const drop = (el, delay) => {
      if (el.hasAttribute('transform')) return fade(el, delay);
      el.animate([{ opacity: 0, transform: 'translate(0px,-28px)' }, { opacity: 1, transform: 'translate(0px,0px)' }], { duration: 520, delay, easing: bounce, fill: 'backwards' });
    };
    const draw = (path, delay, dur) => {
      let len = 0;
      try { len = path.getTotalLength(); } catch (e) { len = 0; }
      if (!len) return fade(path, delay);
      const da = `${len.toFixed(1)} ${len.toFixed(1)}`;
      path.animate([{ strokeDasharray: da, strokeDashoffset: len }, { strokeDasharray: da, strokeDashoffset: 0 }], { duration: dur, delay, easing: 'ease-in-out', fill: 'backwards' });
    };
    const floor = svg.querySelector('.floor');
    if (floor) fade(floor, 0, 300);
    // 1. εξαρτήματα (οι σκιές εμφανίζονται μαζί με το αντικείμενο που ακολουθεί)
    const parts = [];
    for (const sel of ['.sc-back', '.sc-mid', '.sc-front']) {
      const g = svg.querySelector(sel);
      if (g) parts.push(...g.children);
    }
    const objects = parts.filter(el => !el.classList.contains('shadow'));
    const step = Math.min(110, 1100 / Math.max(1, objects.length));
    let t = 120;
    parts.forEach(el => {
      if (el.classList.contains('shadow')) { fade(el, t + 200, 320); return; }
      drop(el, t);
      t += step;
    });
    // 2. καλώδια και συνδέσεις δικτύου
    let w = t + 260;
    svg.querySelectorAll('.sc-wires .wire-g').forEach(g => {
      g.querySelectorAll('path').forEach(p => draw(p, w, 620));
      g.querySelectorAll('.box, circle').forEach(x => fade(x, w + 520, 240));
      w += 170;
    });
    svg.querySelectorAll('.sc-links path').forEach((p, i) => draw(p, t + 200 + i * 120, 700));
    // 3. ετικέτες
    let l = Math.max(w, t + 600) + 120;
    svg.querySelectorAll('.sc-labels > *').forEach(el => {
      el.animate([{ opacity: 0, transform: 'translate(0px,8px)' }, { opacity: 1, transform: 'translate(0px,0px)' }], { duration: 340, delay: l, easing: 'ease-out', fill: 'backwards' });
      l += 70;
    });
  }

  root.IoTScene = { K, ESP, PCB_TOP, PIN_U, PI_T, PI_PIN_L, PI_PIN_TOP, BB, TL, manifest: null, buildIn, carOffset, carV, dragToCm, CAR, US, P, labScene, piScene, homeScene, netScene, attachPanZoom, animatePacket, NET_NODES };
})(typeof window !== 'undefined' ? window : globalThis);
