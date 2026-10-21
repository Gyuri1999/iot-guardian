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
  const C = Math.cos(Math.PI / 6);
  const S = 0.5;
  const P = (u, v, h) => [(u - v) * C * K, (u + v) * S * K - (h || 0) * K];
  const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const poly = (pts, cls, extra) => `<polygon points="${pts.map(pt).join(' ')}" class="${cls}"${extra || ''}/>`;
  const planeMatrix = h => `matrix(${(C * K).toFixed(4)},${(S * K).toFixed(4)},${(-C * K).toFixed(4)},${(S * K).toFixed(4)},0,${(-h * K).toFixed(2)})`;

  // Κουτί με τρία ορατά πρόσωπα: πάνω, αριστερό-μπροστά, δεξί-μπροστά.
  function box(u, v, h, du, dv, dh, cls, id) {
    const t = h + dh;
    const top = [P(u, v, t), P(u + du, v, t), P(u + du, v + dv, t), P(u, v + dv, t)];
    const left = [P(u, v + dv, t), P(u + du, v + dv, t), P(u + du, v + dv, h), P(u, v + dv, h)];
    const right = [P(u + du, v, t), P(u + du, v + dv, t), P(u + du, v + dv, h), P(u + du, v, h)];
    return `<g class="box ${cls}"${id ? ` id="${id}"` : ''}>${poly(left, 'f-l')}${poly(right, 'f-r')}${poly(top, 'f-t')}</g>`;
  }

  // Ετικέτα τύπου «callout»: χάπι με κείμενο και γραμμή προς το σημείο.
  function callout(p, dx, dy, text, id) {
    const x = p[0] + dx;
    const y = p[1] + dy;
    const w = text.length * 6.1 + 18;
    const anchorLeft = dx >= 0;
    const bx = anchorLeft ? x : x - w;
    return `<g class="callout"${id ? ` id="${id}"` : ''}>
      <path d="M${pt(p)} L${x.toFixed(1)},${y.toFixed(1)}" class="co-line"/>
      <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" class="co-dot"/>
      <rect x="${bx.toFixed(1)}" y="${(y - 9).toFixed(1)}" width="${w.toFixed(1)}" height="18" rx="4" class="co-box"/>
      <text x="${(bx + 9).toFixed(1)}" y="${(y + 3.6).toFixed(1)}" class="co-txt">${text}</text>
    </g>`;
  }

  function wire(a, b, cls, lift, id) {
    const l = lift || 40;
    const c1 = [a[0], a[1] - l];
    const c2 = [b[0], b[1] - l];
    return `<path${id ? ` id="${id}"` : ''} d="M${pt(a)} C${pt(c1)} ${pt(c2)} ${pt(b)}" class="wire ${cls}"/>`;
  }

  // ------------------------------------------------------------ αντικείμενα

  // ESP32 DevKit: PCB 52×28, module, κεραία, USB-C, headers, LED, κουμπιά.
  const ESP = { u: 0, v: 0 };
  const PIN_U = i => 8 + i * 2.54;
  const RIGHT_ROW = ['D23', 'D22', 'TX', 'RX', 'D21', 'D19', 'D18', 'D5', 'D17', 'D16', 'D4', 'D2', 'D15', 'GND', '3V3'];
  function espPin(name) {
    const i = RIGHT_ROW.indexOf(name);
    return P(ESP.u + PIN_U(i), ESP.v + 26.4, 4.4);
  }

  function esp32() {
    const { u, v } = ESP;
    let s = '<g id="sc-esp" class="sc-esp">';
    s += box(u, v, 0, 52, 28, 1.6, 'pcb');
    // σχέδια πάνω στο PCB (silkscreen, κεραία)
    s += `<g transform="${planeMatrix(1.6)}" class="silk-g">
      <path d="M${u + 1},${v + 6} h3 v16 h-2 v-14 h2" class="antenna2"/>
      <text x="${u + 30}" y="${v + 14.6}" class="silk2" transform="rotate(0)">ESP32 DevKit</text>
    </g>`;
    s += box(u + 5, v + 4, 1.6, 18, 20, 0.6, 'mod-base');
    s += box(u + 8, v + 5, 2.2, 15, 18, 1.4, 'shield', 'sc-shield');
    s += `<g transform="${planeMatrix(3.6)}"><text x="${u + 10}" y="${v + 15}" class="shield-t">ESP-WROOM-32</text></g>`;
    // headers
    s += box(u + 6.6, v + 0.4, 1.6, 38.8, 2.4, 2.4, 'pinhdr');
    s += box(u + 6.6, v + 25.2, 1.6, 38.8, 2.4, 2.4, 'pinhdr');
    for (let i = 0; i < 15; i++) {
      for (const vv of [1.6, 26.4]) {
        const p = P(u + PIN_U(i), v + vv, 4.0);
        s += `<ellipse cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" rx="1.9" ry="1.1" class="pin-pad"/>`;
      }
    }
    // USB-C, κουμπιά, LED
    s += box(u + 48.5, v + 10, 1.6, 4.6, 8, 1.8, 'usb');
    s += box(u + 44, v + 4.5, 1.6, 3, 3, 1, 'btn-b') + box(u + 44, v + 20.5, 1.6, 3, 3, 1, 'btn-b');
    const pwr = P(u + 38, v + 9, 2.2);
    const d2 = P(u + 38, v + 19, 2.2);
    s += `<circle cx="${pwr[0].toFixed(1)}" cy="${pwr[1].toFixed(1)}" r="2.2" class="smd pwr" id="sc-pwr"/>`;
    s += `<circle cx="${d2[0].toFixed(1)}" cy="${d2[1].toFixed(1)}" r="9" class="halo blue" id="sc-d2-halo"/>`;
    s += `<circle cx="${d2[0].toFixed(1)}" cy="${d2[1].toFixed(1)}" r="2.2" class="smd d2" id="sc-d2"/>`;
    // WiFi κύματα πάνω από την κεραία
    const ant = P(u + 2.5, v + 14, 4);
    s += `<g id="sc-wifi" class="waves" transform="translate(${ant[0].toFixed(1)},${(ant[1] - 6).toFixed(1)})">
      <path d="M-7,-2 a9,9 0 0 1 14,0"/><path d="M-12,-7 a16,16 0 0 1 24,0"/><path d="M-17,-12 a23,23 0 0 1 34,0"/></g>`;
    const zz = P(u + 15, v + 14, 6);
    s += `<text x="${zz[0].toFixed(1)}" y="${(zz[1] - 14).toFixed(1)}" class="zzz" id="sc-zzz">z z z</text>`;
    s += '</g>';
    return s;
  }

  // Breadboard στα δεξιά της πλακέτας.
  const BB = { u: 62, v: 2, du: 60, dv: 26 };
  function breadboard() {
    const { u, v, du, dv } = BB;
    let s = box(u, v, 0, du, dv, 2.4, 'bb');
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
      <rect x="${u + 1}" y="${v + dv / 2 - 0.6}" width="${du - 2}" height="1.2" class="bb-gap"/></g>`;
    return s;
  }

  function led(u, v) {
    const base = P(u, v, 2.4);
    const top = P(u, v, 14);
    return `<g id="sc-led" class="sc-led">
      <path d="M${pt(P(u - 1.2, v, 2.4))} L${pt(P(u - 1.2, v, 6))} M${pt(P(u + 1.2, v, 2.4))} L${pt(P(u + 1.2, v, 6.5))}" class="legs"/>
      <circle cx="${top[0].toFixed(1)}" cy="${top[1].toFixed(1)}" r="36" class="halo red" id="sc-led-halo"/>
      <rect x="${(top[0] - 7).toFixed(1)}" y="${top[1].toFixed(1)}" width="14" height="${(base[1] - top[1] - 12).toFixed(1)}" class="led-body"/>
      <ellipse cx="${top[0].toFixed(1)}" cy="${(base[1] - 12).toFixed(1)}" rx="8.4" ry="3.6" class="led-rim"/>
      <path d="M${(top[0] - 7).toFixed(1)},${top[1].toFixed(1)} a7,7 0 0 1 14,0 z" class="led-dome"/>
      <ellipse cx="${(top[0] - 2.4).toFixed(1)}" cy="${(top[1] + 3).toFixed(1)}" rx="1.8" ry="3.6" class="led-shine"/>
    </g>`;
  }

  function button(u, v) {
    let s = '<g id="sc-btn" class="sc-btn clickable" tabindex="0" role="button" aria-label="Κουμπί: πάτα για αλλαγή">';
    s += box(u - 4.5, v - 4.5, 2.4, 9, 9, 3, 'btn-body');
    const c = P(u, v, 6.6);
    s += `<g id="sc-btn-cap"><ellipse cx="${c[0].toFixed(1)}" cy="${(c[1] + 3.4).toFixed(1)}" rx="9.5" ry="5.2" class="cap-side"/><ellipse cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" rx="9.5" ry="5.2" class="cap"/></g>`;
    s += '</g>';
    return s;
  }

  function pir(u, v) {
    let s = '<g id="sc-pir" class="sc-pir clickable" tabindex="0" role="button" aria-label="Αισθητήρας PIR: πάτα για κίνηση">';
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
    let s = '<g id="sc-sensor" class="sc-sensor">';
    s += box(u - 4.5, v - 6, 2.4, 9, 12, 7, 'dht');
    s += `<g transform="${planeMatrix(9.4)}">${[0, 1, 2, 3, 4].map(i => `<rect x="${u - 3.4 + i * 1.6}" y="${v - 4.6}" width="0.8" height="9.2" class="vent"/>`).join('')}</g>`;
    const c = P(u, v, 10);
    s += `<g transform="translate(${(c[0] + 16).toFixed(1)},${(c[1] - 20).toFixed(1)})"><rect x="0" y="-12" width="66" height="20" rx="4" class="readout"/><text x="33" y="2" text-anchor="middle" class="readout-t" id="sc-temp">22.5 °C</text></g>`;
    s += '</g>';
    return s;
  }

  function router(u, v) {
    let s = '<g id="sc-router" class="sc-router clickable" tabindex="0" role="button" aria-label="Router WiFi: πάτα για να το σβήσεις ή να το ανάψεις">';
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
    let s = `<g id="${id || 'sc-pi'}" class="sc-pi clickable" tabindex="0" role="button" aria-label="Raspberry Pi με τον broker MQTT">`;
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
  const PI_PIN_U = i => 6 + i * 2.4;
  function piPin(name) {
    const i = PI_ODD.indexOf(name);
    return P(ESP.u + PI_PIN_U(i), ESP.v + 31.6, 4.6);
  }
  function piHost() {
    const { u, v } = ESP;
    let s = '<g id="sc-esp" class="sc-esp sc-pihost">';
    s += box(u, v, 0, 56, 34, 1.6, 'pi-pcb');
    s += `<g transform="${planeMatrix(1.6)}"><text x="${u + 20}" y="${v + 25}" class="silk2">Raspberry Pi 5</text></g>`;
    // θύρες USB / Ethernet στην αριστερή στενή πλευρά
    s += box(u - 2, v + 2, 1.6, 9, 9, 6, 'port') + box(u - 2, v + 12.5, 1.6, 9, 8, 6, 'port') + box(u - 2, v + 22, 1.6, 9, 9, 7, 'port');
    s += box(u + 22, v + 6, 1.6, 12, 12, 1.4, 'chip') + box(u + 37, v + 7, 1.6, 8, 10, 1, 'chip');
    // header 2×20
    s += box(u + 4.6, v + 29.6, 1.6, 48.4, 4, 2.6, 'pinhdr');
    for (let i = 0; i < 20; i++) {
      for (const vv of [30.6, 32.6]) {
        const p = P(u + PI_PIN_U(i), v + vv, 4.4);
        s += `<ellipse cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" rx="1.4" ry="0.8" class="pin-pad"/>`;
      }
    }
    const pwr = P(u + 50, v + 4, 2.2);
    const act = P(u + 50, v + 8, 2.2);
    s += `<circle cx="${pwr[0].toFixed(1)}" cy="${pwr[1].toFixed(1)}" r="2.2" class="smd pwr" id="sc-pwr"/>`;
    s += `<circle cx="${act[0].toFixed(1)}" cy="${act[1].toFixed(1)}" r="2.2" class="smd act" id="sc-d2"/>`;
    s += '</g>';
    return s;
  }

  // Μικρό ESP32 που στέλνει μετρήσεις στο Pi (εικονικός client του broker).
  function miniEsp(u, v) {
    let s = '<g id="sc-node" class="sc-node">';
    s += box(u, v, 0, 22, 12, 1.2, 'pcb');
    s += box(u + 3, v + 2, 1.2, 9, 8, 1.2, 'shield');
    s += `<g transform="${planeMatrix(1.2)}"><text x="${u + 13}" y="${v + 7.5}" class="silk2">ESP32</text></g>`;
    s += '</g>';
    return s;
  }

  function tablet(u, v) {
    let s = '<g id="sc-dash" class="sc-dash">';
    s += box(u, v, 0, 26, 18, 1.2, 'tab-body');
    s += `<g transform="${planeMatrix(1.2)}"><rect x="${u + 1.5}" y="${v + 1.5}" width="23" height="15" rx="0.8" class="tab-screen"/>
      <text x="${u + 3}" y="${v + 5.5}" class="tab-h">Dashboard</text>
      <text x="${u + 3}" y="${v + 9.5}" class="tab-t" id="sc-dash-1"> </text>
      <text x="${u + 3}" y="${v + 13}" class="tab-t" id="sc-dash-2"> </text></g>`;
    s += '</g>';
    return s;
  }

  function laptop(u, v, cls, id) {
    let s = `<g id="${id}" class="sc-laptop ${cls}">`;
    s += box(u, v, 0, 18, 13, 1, 'lap-base');
    const a = [P(u, v, 1), P(u + 18, v, 1), P(u + 18, v - 3, 13), P(u, v - 3, 13)];
    s += poly(a, 'lap-lid');
    s += '</g>';
    return s;
  }

  // ------------------------------------------------------------ σκηνές

  function fit(svgInner, bounds, extraClass, label) {
    const [x0, y0, x1, y1] = bounds;
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
    const net = !!(world && world.broker);
    let back = '';
    let mid = piHost();
    let front = '';
    const labels = [callout(P(28, 16, 4), -96, -58, net ? 'RASPBERRY PI · BROKER + PYTHON' : 'RASPBERRY PI')];
    const wires = [];
    mid += breadboard();
    const LED_AT = [72, 15];
    const BTN_AT = [86, 15];
    const PIR_AT = [102, 15];
    if (hw.includes('led') || hw.includes('button') || hw.includes('pir') || !(net || hw.includes('web'))) {
      front += led(LED_AT[0], LED_AT[1]);
      wires.push(wire(piPin('GPIO17'), P(LED_AT[0] - 0.8, LED_AT[1], 2.6), 'w-led', 46, 'sc-w-led'));
      wires.push(wire(piPin('GND'), P(LED_AT[0] + 1.5, BB.v + BB.dv - 1.5, 2.6), 'w-gnd', 30));
      labels.push(callout(P(LED_AT[0], LED_AT[1], 14), -40, -60, 'LED · GPIO 17'));
    }
    if (hw.includes('button')) {
      front += button(BTN_AT[0], BTN_AT[1]);
      wires.push(wire(piPin('GPIO27'), P(BTN_AT[0] - 2.5, BTN_AT[1] + 3, 2.6), 'w-btn', 54, 'sc-w-btn'));
      labels.push(callout(P(BTN_AT[0], BTN_AT[1], 5), 10, -66, 'ΚΟΥΜΠΙ · GPIO 27'));
    }
    if (hw.includes('pir')) {
      front += pir(PIR_AT[0], PIR_AT[1]);
      wires.push(wire(piPin('GPIO4'), P(PIR_AT[0] - 4, PIR_AT[1] + 5, 2.6), 'w-pir', 62, 'sc-w-pir'));
      labels.push(callout(P(PIR_AT[0] + 4, PIR_AT[1], 4), 34, -28, 'PIR · GPIO 4'));
    }
    let links = '';
    const web = hw.includes('web');
    if (net || web) {
      back += router(-14, -40);
      labels.push(callout(P(-5, -38, 9), -60, -22, 'ROUTER'));
      back += tablet(100, -40);
      labels.push(callout(P(112, -32, 2), 40, -36, web ? (net ? 'DASHBOARD · BROWSER' : 'TABLET · BROWSER') : 'DASHBOARD'));
      links += `<path id="sc-link-wifi" d="M${pt(P(-5, -32, 4))} Q${pt(P(0, -14, 26))} ${pt(P(10, 10, 2))}" class="link"/>`;
      links += `<path id="sc-link-pi-dash" d="M${pt(P(40, 6, 2))} Q${pt(P(80, -20, 30))} ${pt(P(106, -32, 1.2))}" class="link"/>`;
    }
    if (net) {
      back += miniEsp(40, -52);
      labels.push(callout(P(51, -46, 2), -20, -44, hw.includes('sensor') ? 'ESP32 · ΑΙΣΘΗΤΗΡΑΣ' : 'ESP32 · ΣΥΣΚΕΥΗ'));
      if (hw.includes('sensor')) back += sensor(68, -46);
      links += `<path id="sc-link-esp-pi" d="M${pt(P(51, -44, 2))} Q${pt(P(40, -20, 34))} ${pt(P(28, 6, 2))}" class="link"/>`;
    }
    const inner = `<g class="sc-back">${back}</g><g class="sc-links">${links}</g><g class="sc-mid">${mid}</g><g class="sc-wires">${wires.join('')}</g><g class="sc-front">${front}</g><g class="sc-labels">${labels.join('')}</g><g id="sc-packets"></g>`;
    return fit(inner, net || web ? [-260, -340, 620, 260] : [-160, -160, 470, 230], 'lab', 'Ισομετρική σκηνή: Raspberry Pi, breadboard και εξαρτήματα');
  }

  // Σκηνή άσκησης κώδικα: ESP32 + breadboard + ό,τι χρειάζεται το μάθημα.
  function labScene(hw, world) {
    const net = !!(world && world.broker);
    const wifi = net || hw.includes('router') || (world && world.wifi);
    let back = '';
    let mid = '';
    let front = '';
    const labels = [];
    if (wifi) {
      back += router(-14, -38);
      labels.push(callout(P(-5, -36, 9), -60, -22, 'ROUTER WIFI'));
    }
    if (net) {
      back += rpi(52, -50);
      back += tablet(98, -44);
      labels.push(callout(P(66, -44, 6), -10, -40, 'RASPBERRY PI · BROKER'));
      labels.push(callout(P(110, -36, 2), 40, -36, 'DASHBOARD'));
    }
    mid += esp32();
    labels.push(callout(P(14, 14, 4), -84, -48, 'ESP32'));
    mid += breadboard();
    // καλώδια από τα pins στο breadboard
    const wires = [];
    const LED_AT = [72, 15];
    const BTN_AT = [86, 15];
    const PIR_AT = [102, 15];
    const SEN_AT = [116, 10];
    front += led(LED_AT[0], LED_AT[1]);
    wires.push(wire(espPin('D2'), P(LED_AT[0] - 0.8, LED_AT[1], 2.6), 'w-led', 46, 'sc-w-led'));
    wires.push(wire(espPin('GND'), P(LED_AT[0] + 1.5, BB.v + BB.dv - 1.5, 2.6), 'w-gnd', 30));
    labels.push(callout(P(LED_AT[0], LED_AT[1], 14), -40, -60, 'LED · GPIO 2'));
    if (hw.includes('button')) {
      front += button(BTN_AT[0], BTN_AT[1]);
      wires.push(wire(espPin('D15'), P(BTN_AT[0] - 2.5, BTN_AT[1] + 3, 2.6), 'w-btn', 54, 'sc-w-btn'));
      labels.push(callout(P(BTN_AT[0], BTN_AT[1], 5), 10, -66, 'ΚΟΥΜΠΙ · GPIO 15'));
    }
    if (hw.includes('pir')) {
      front += pir(PIR_AT[0], PIR_AT[1]);
      wires.push(wire(espPin('D4'), P(PIR_AT[0] - 4, PIR_AT[1] + 5, 2.6), 'w-pir', 62, 'sc-w-pir'));
      labels.push(callout(P(PIR_AT[0] + 4, PIR_AT[1], 4), 34, -28, 'PIR · GPIO 4'));
    }
    if (hw.includes('sensor')) {
      front += sensor(SEN_AT[0], SEN_AT[1]);
      labels.push(callout(P(SEN_AT[0] + 3, SEN_AT[1] + 4, 4), 30, 30, 'ΑΙΣΘΗΤΗΡΑΣ'));
    }
    let links = '';
    if (wifi) links += `<path id="sc-link-wifi" d="M${pt(P(-5, -30, 4))} Q${pt(P(-4, -12, 30))} ${pt(P(2, 14, 4))}" class="link"/>`;
    if (net) {
      links += `<path id="sc-link-esp-pi" d="M${pt(P(2, 14, 4))} Q${pt(P(30, -20, 40))} ${pt(P(64, -40, 2))}" class="link"/>`;
      links += `<path id="sc-link-pi-dash" d="M${pt(P(70, -36, 2))} Q${pt(P(92, -30, 26))} ${pt(P(104, -36, 1.2))}" class="link"/>`;
    }
    const inner = `<g class="sc-back">${back}</g><g class="sc-links">${links}</g><g class="sc-mid">${mid}</g><g class="sc-wires">${wires.join('')}</g><g class="sc-front">${front}</g><g class="sc-labels">${labels.join('')}</g><g id="sc-packets"></g>`;
    const b = net ? [-260, -330, 600, 230] : wifi ? [-250, -250, 560, 220] : [-140, -150, 450, 210];
    return fit(inner, b, 'lab', 'Ισομετρική σκηνή εργαστηρίου: πλακέτα ESP32, breadboard και εξαρτήματα');
  }

  // Αρχική: η πλακέτα μόνη της, με ετικέτες για τα μέρη της.
  function homeScene() {
    let inner = esp32();
    inner += callout(P(14, 14, 4.6), -96, -60, 'ESP-WROOM-32');
    inner += callout(P(1.5, 14, 1.6), -70, 10, 'ΚΕΡΑΙΑ WIFI');
    inner += callout(P(51, 14, 3.4), 40, 36, 'USB-C');
    inner += callout(espPin('D2'), 60, 26, 'PINS GPIO');
    inner += callout(P(38, 19, 2.2), 70, -40, 'LED D2 (GPIO 2)');
    inner += callout(P(45.5, 6, 2.6), 40, -66, 'ΚΟΥΜΠΙΑ EN / BOOT');
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
    let nodes = '';
    let links = '';
    let labels = '';
    const hub = nodeCenter('192.168.1.10');
    for (const [ip, n] of Object.entries(NET_NODES)) {
      if (n.kind === 'pi') nodes += rpi(n.u, n.v, 'sc-pi');
      else if (n.kind === 'esp') nodes += `<g class="mini-esp" id="sc-node-${ip.split('.').pop()}">${box(n.u, n.v, 0, 18, 12, 1.4, 'pcb')}${box(n.u + 3, n.v + 2, 1.4, 8, 8, 1.6, 'shield')}</g>`;
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
      if (e.target.closest('.clickable')) return;
      drag = { x: e.clientX, y: e.clientY, vb: vb.slice() };
      svg.setPointerCapture(e.pointerId);
      svg.classList.add('dragging');
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
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

  root.IoTScene = { labScene, piScene, homeScene, netScene, attachPanZoom, animatePacket, NET_NODES };
})(typeof window !== 'undefined' ? window : globalThis);
