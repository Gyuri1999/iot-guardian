/*
 * IoT Guardian — 3D απόδοση των εξαρτημάτων με Three.js, κάτω από την SVG σκηνή.
 *
 * Η κάμερα είναι ορθογραφική με την ίδια ισομετρική προβολή P(u, v, h) του scene.js, οπότε
 * ό,τι μένει στην SVG (ετικέτες, κλικ, σύρσιμο, λάμψεις των LED) πέφτει ακριβώς πάνω στα 3D αντικείμενα.
 * Κόσμος: x = u, y = h, z = v. Η SVG κρατά τα σχήματα αόρατα για τα κλικ· το 3D τα ζωγραφίζει.
 * Αν δεν υπάρχει WebGL, μένει η κανονική SVG σκηνή.
 */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const noop = { mount: () => false, unmount() {} };
  if (!THREE || typeof document === 'undefined') { root.IoTScene3D = noop; return; }
  THREE.ColorManagement.legacyMode = false;

  const C30 = Math.cos(Math.PI / 6);
  const INK = 0x1c2130;
  const FONT = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  const WIRE_COLORS = { 'w-led': 0xe8892f, 'w-btn': 0x18a196, 'w-pir': 0xe2b52d, 'w-gnd': 0x34383f, 'w-trig': 0x3fae55, 'w-echo': 0xf2c230, 'w-red': 0xe0503f, 'w-yel': 0xf2c230, 'w-grn': 0x3fae55, 'w-vcc': 0xe0503f, 'w-buz': 0x8e5bd0, 'w-rgbr': 0xe0503f, 'w-rgbg': 0x3fae55, 'w-rgbb': 0x3d8fd6, 'w-servo': 0xc25a22, 'w-sda': 0x18a196, 'w-scl': 0xd4a417 };

  let renderer = null;
  let cur = null; // η τρέχουσα σκηνή

  function webgl() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  // ------------------------------------------------------------ εργαλεία κατασκευής

  function makeKit() {
    const disp = [];
    const keep = x => { disp.push(x); return x; };
    const mats = new Map();
    const geos = new Map();
    const outlines = [];
    const redraws = [];
    const ink = keep(new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));

    function mat(color, o = {}) {
      const key = color + '|' + JSON.stringify(o);
      if (!o.unique && mats.has(key)) return mats.get(key);
      const m = keep(new THREE.MeshStandardMaterial({
        color, roughness: o.r === undefined ? 0.62 : o.r, metalness: o.m || 0,
        transparent: o.op !== undefined, opacity: o.op === undefined ? 1 : o.op,
        emissive: o.e || 0, flatShading: !!o.flat
      }));
      if (!o.unique) mats.set(key, m);
      return m;
    }

    // Κουτί με στρογγυλεμένες ακμές (extrude ενός στρογγυλού ορθογωνίου με λοξότμηση πάνω/κάτω).
    function rbox(w, h, d, r) {
      const key = [w, h, d, r].map(n => n.toFixed(3)).join(',');
      if (geos.has(key)) return geos.get(key);
      let g;
      r = Math.min(r, w / 2 - 0.01, d / 2 - 0.01, h / 2 - 0.01);
      if (r <= 0.04) g = new THREE.BoxGeometry(w, h, d);
      else {
        const b = r * 0.6;
        const iw = w - 2 * b, id = d - 2 * b;
        const rc = Math.max(0.01, Math.min(r - b, iw / 2 - 0.001, id / 2 - 0.001));
        const x0 = -iw / 2, y0 = -id / 2;
        const s = new THREE.Shape();
        s.moveTo(x0 + rc, y0); s.lineTo(x0 + iw - rc, y0); s.quadraticCurveTo(x0 + iw, y0, x0 + iw, y0 + rc);
        s.lineTo(x0 + iw, y0 + id - rc); s.quadraticCurveTo(x0 + iw, y0 + id, x0 + iw - rc, y0 + id);
        s.lineTo(x0 + rc, y0 + id); s.quadraticCurveTo(x0, y0 + id, x0, y0 + id - rc);
        s.lineTo(x0, y0 + rc); s.quadraticCurveTo(x0, y0, x0 + rc, y0);
        g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3 });
        g.rotateX(-Math.PI / 2);
        g.center();
      }
      geos.set(key, keep(g));
      return g;
    }

    // Σκούρο περίγραμμα (όπως το μελάνι της εικονογράφησης): ελαφρώς μεγαλύτερο αντίγραφο με πίσω πρόσωπα.
    function outline(m, t) {
      const g = m.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const s = new THREE.Vector3();
      g.boundingBox.getSize(s);
      const c = new THREE.Vector3();
      g.boundingBox.getCenter(c);
      const o = new THREE.Mesh(g, ink);
      t = t || 0.16;
      o.scale.set((s.x + 2 * t) / Math.max(s.x, 1e-3), (s.y + 2 * t) / Math.max(s.y, 1e-3), (s.z + 2 * t) / Math.max(s.z, 1e-3));
      o.position.copy(c).multiplyScalar(1 - o.scale.x).setY(c.y * (1 - o.scale.y)).setZ(c.z * (1 - o.scale.z));
      m.add(o);
      m.userData.ol = o;
      outlines.push(o);
      return o;
    }

    function mesh(parent, g, material, o = {}) {
      const m = new THREE.Mesh(g, material);
      m.castShadow = o.cast !== false;
      m.receiveShadow = true;
      parent.add(m);
      if (o.ol !== false) outline(m, o.t);
      return m;
    }

    // Κουτί σε συντεταγμένες πάγκου, όπως το box() της SVG: γωνία (u, v, h), διαστάσεις (du, dv, dh).
    function B(parent, u, v, h, du, dv, dh, material, o = {}) {
      const small = Math.min(du, dv, dh) < 0.7;
      const m = mesh(parent, rbox(du, dh, dv, o.r === undefined ? Math.min(0.35, Math.min(du, dv, dh) * 0.25) : o.r), material, { ol: o.ol === undefined ? !small : o.ol, cast: o.cast, t: o.t });
      m.position.set(u + du / 2, h + dh / 2, v + dv / 2);
      return m;
    }

    // Όρθιος κύλινδρος (άξονας h) με κέντρο (cu, cv), από h0, ύψος dh.
    function cylH(parent, cu, cv, h0, r, dh, material, o = {}) {
      const g = keep(new THREE.CylinderGeometry(o.r2 === undefined ? r : o.r2, r, dh, o.seg || 24));
      const m = mesh(parent, g, material, o);
      m.position.set(cu, h0 + dh / 2, cv);
      return m;
    }

    // Κείμενο/σχέδιο πάνω σε επιφάνεια με καμβά. draw(ctx) σχεδιάζει σε απόλυτες συντεταγμένες πάγκου.
    function canvasTex(w, d, ppu, draw) {
      const cv = document.createElement('canvas');
      cv.width = Math.max(4, Math.round(w * ppu));
      cv.height = Math.max(4, Math.round(d * ppu));
      const tex = keep(new THREE.CanvasTexture(cv));
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 4;
      const paint = () => { const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.scale(cv.width / w, cv.height / d); draw(c); tex.needsUpdate = true; };
      paint();
      redraws.push(paint);
      return tex;
    }
    function decalMat(tex, o = {}) {
      return keep(new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: o.r === undefined ? 0.7 : o.r, metalness: o.m || 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    }
    // Οριζόντια επιφάνεια (u0, v0) – (u0 + w, v0 + d) σε ύψος h. Στον καμβά: x = u, y = v.
    function decal(parent, u0, v0, h, w, d, draw, o = {}) {
      const tex = canvasTex(w, d, o.ppu || 24, c => { c.translate(-u0, -v0); draw(c); });
      const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, d)), decalMat(tex, o));
      m.rotation.x = -Math.PI / 2;
      m.position.set(u0 + w / 2, h + 0.012, v0 + d / 2);
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    // Κάθετη επιφάνεια που κοιτά προς +v (τον θεατή, κάτω αριστερά). Στον καμβά: x = u, y = −h.
    function decalV(parent, u0, vFace, h0, w, hh, draw, o = {}) {
      const tex = canvasTex(w, hh, o.ppu || 24, c => { c.translate(-u0, h0 + hh); draw(c); });
      const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(w, hh)), decalMat(tex, o));
      m.position.set(u0 + w / 2, h0 + hh / 2, vFace + 0.012);
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    // Κάθετη επιφάνεια που κοιτά προς +u (κάτω δεξιά). Στον καμβά: x = −v (από v0 + d προς v0), y = −h.
    function decalU(parent, uFace, v0, h0, d, hh, draw, o = {}) {
      const tex = canvasTex(d, hh, o.ppu || 24, c => { c.translate(v0 + d, h0 + hh); c.scale(-1, 1); draw(c); });
      const m = new THREE.Mesh(keep(new THREE.PlaneGeometry(d, hh)), decalMat(tex, o));
      m.rotation.y = Math.PI / 2;
      m.position.set(uFace + 0.012, h0 + hh / 2, v0 + d / 2);
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }

    // Πολλά ίδια μικρά κομμάτια (ακίδες) με ένα InstancedMesh.
    function instances(parent, g, material, list) {
      const im = new THREE.InstancedMesh(keep(g), material, list.length);
      const m4 = new THREE.Matrix4();
      list.forEach((t, i) => { m4.makeScale(t.sx || 1, t.sy || 1, t.sz || 1); m4.setPosition(t.x, t.y, t.z); im.setMatrixAt(i, m4); });
      im.castShadow = true;
      im.receiveShadow = true;
      parent.add(im);
      return im;
    }

    function group(parent, part) {
      const g = new THREE.Group();
      if (part) g.userData.part = part;
      parent.add(g);
      return g;
    }

    return { keep, mat, rbox, outline, mesh, B, cylH, decal, decalV, decalU, instances, group, ink, outlines, redraws, disp };
  }

  // Βοηθοί για τον καμβά.
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function text(c, s, x, y, size, color, weight, align) {
    c.font = `${weight || 700} ${size}px ${FONT}`;
    c.fillStyle = color;
    c.textAlign = align || 'left';
    c.fillText(s, x, y);
  }
  function raspberry(c, cx, cy, k, color) {
    k = k || 1;
    c.fillStyle = color;
    for (const [x, y] of [[0, 0], [1.6, 0.4], [-1.6, 0.4], [0.8, 1.7], [-0.8, 1.7], [0, 3.1], [1.9, 2.1], [-1.9, 2.1]]) {
      c.beginPath(); c.arc(cx + x * k, cy + y * k, 0.85 * k, 0, Math.PI * 2); c.fill();
    }
    c.strokeStyle = color; c.lineWidth = 0.35 * k;
    c.beginPath(); c.moveTo(cx - 1.6 * k, cy - 1.6 * k); c.quadraticCurveTo(cx, cy - 2.8 * k, cx, cy - 1); c.quadraticCurveTo(cx, cy - 2.8 * k, cx + 1.6 * k, cy - 1.6 * k); c.stroke();
  }

  // ------------------------------------------------------------ υλικά

  function palette(k) {
    return {
      black: k.mat(0x1d1e22, { r: 0.55 }),
      pcbBlack: k.mat(0x1b1c20, { r: 0.5 }),
      dark: k.mat(0x2b3342, { r: 0.55 }),
      chip: k.mat(0x24272c, { r: 0.45 }),
      silver: k.mat(0xd3d8dd, { r: 0.32, m: 0.35 }),
      steel: k.mat(0xb9bfc6, { r: 0.3, m: 0.45 }),
      pin: k.mat(0xd9dde2, { r: 0.25, m: 0.55 }),
      gold: k.mat(0xd6aa48, { r: 0.35, m: 0.5 }),
      cream: k.mat(0xf5f0e4, { r: 0.8 }),
      white: k.mat(0xf6f4ee, { r: 0.55 }),
      green: k.mat(0x2f9a55, { r: 0.55 }),
      pirGreen: k.mat(0x1f7247, { r: 0.55 }),
      blue: k.mat(0x3557b8, { r: 0.5 }),
      smd: k.mat(0xc8a86a, { r: 0.5 }),
      tant: k.mat(0xf0b429, { r: 0.45 }),
      plastic: k.mat(0x2a2a2d, { r: 0.6 }),
      navy: k.mat(0x2c3549, { r: 0.5 }),
      slate: k.mat(0x222a3c, { r: 0.45 }),
      screen: k.mat(0x0e1628, { r: 0.25 })
    };
  }

  // ------------------------------------------------------------ αντικείμενα

  function esp32(k, M, S) {
    const g = k.group(k.scene, 'esp32');
    const { u, v } = S.ESP;
    const H = S.ESP.h;
    const T = S.PCB_TOP;
    const PIN_U = S.PIN_U;
    // από κάτω: πλαστικά headers και ακίδες προς το τραπέζι
    const under = k.group(g, 'esp-pins');
    const legs = [];
    for (const vv of [0.4, 25.6]) {
      k.B(under, u + 1.3, v + vv, H - 2.5, 48.8, 2, 2.5, M.black, { r: 0.25 });
      for (let i = 0; i < 19; i++) legs.push({ x: u + PIN_U(i), y: (H - 2.5) / 2 + 0.15, z: v + vv + 1, sy: H - 2.5 - 0.3 });
    }
    k.instances(under, new THREE.CylinderGeometry(0.32, 0.32, 1, 8), M.pin, legs);
    // PCB
    k.B(g, u, v, H, 52, 28, 1.6, M.pcbBlack, { r: 0.6 });
    k.decal(g, u, v, T, 52, 28, c => {
      // τρύπες στερέωσης
      for (const [hu, hv] of [[1.6, 4.6], [1.6, 23.4], [50.4, 4.6], [50.4, 23.4]]) {
        c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(u + hu, v + hv, 1.3, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#0c0d10'; c.beginPath(); c.arc(u + hu, v + hv, 0.75, 0, Math.PI * 2); c.fill();
      }
      // silkscreen
      c.strokeStyle = 'rgba(233,237,242,0.9)'; c.lineWidth = 0.22;
      for (const [x, y, w, h] of [[32.4, 9.9, 6.4, 6.4], [28, 17, 7.6, 6], [28.3, 8.5, 3.6, 2.8], [42, 8.4, 2.2, 2.2], [42, 17.4, 2.2, 2.2], [44.6, 2.2, 4.2, 4.2], [44.6, 21.6, 4.2, 4.2]]) c.strokeRect(u + x, v + y, w, h);
      c.lineWidth = 0.3;
      for (const vv of [1.4, 26.6]) { rrect(c, u + PIN_U(0) - 1.3, v + vv - 1.3, PIN_U(18) - PIN_U(0) + 2.6, 2.6, 0.4); c.stroke(); }
      text(c, '3V3 EN VP VN', u + 30.5, v + 7.2, 1.5, '#dfe5ee');
      text(c, 'GND 23 22 TX RX', u + 29, v + 22.4, 1.5, '#dfe5ee');
      text(c, 'EN', u + 46.2, v + 4.8, 1.5, '#dfe5ee');
      text(c, 'BOOT', u + 45.6, v + 25.2, 1.5, '#dfe5ee');
      // κολλήσεις των pins
      for (const vv of [1.4, 26.6]) for (let i = 0; i < 19; i++) {
        c.fillStyle = '#c3c8ce'; c.beginPath(); c.arc(u + PIN_U(i), v + vv, 0.85, 0, Math.PI * 2); c.fill();
      }
    }, { ppu: 22 });
    // κεραία και module ESP-WROOM-32
    const ant = k.group(g, 'esp-antenna');
    k.B(ant, u + 0.4, v + 5, T, 6.2, 18, 0.8, M.dark, { r: 0.2 });
    k.decal(ant, u + 0.4, v + 5, T + 0.8, 6.2, 18, c => {
      c.strokeStyle = '#d6aa48'; c.lineWidth = 0.5; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(u + 1.2, v + 7); c.lineTo(u + 4.8, v + 7); c.lineTo(u + 4.8, v + 21); c.lineTo(u + 2.4, v + 21); c.lineTo(u + 2.4, v + 9); c.lineTo(u + 4.8, v + 9); c.stroke();
      c.beginPath(); c.moveTo(u + 2.4, v + 19); c.lineTo(u + 4.8, v + 19); c.moveTo(u + 2.4, v + 15); c.lineTo(u + 4.8, v + 15); c.moveTo(u + 2.4, v + 11); c.lineTo(u + 4.8, v + 11); c.stroke();
    });
    const mod = k.group(g, 'esp-module');
    k.B(mod, u + 6.6, v + 5, T, 18.6, 18, 0.8, M.dark, { r: 0.2 });
    k.decal(mod, u + 6.6, v + 5, T + 0.8, 18.6, 18, c => {
      c.fillStyle = '#d6aa48';
      for (let i = 0; i < 13; i++) { c.fillRect(u + 7.4 + i * 1.35, v + 5.05, 0.7, 1.2); c.fillRect(u + 7.4 + i * 1.35, v + 21.75, 0.7, 1.2); }
      for (let i = 0; i < 10; i++) c.fillRect(u + 24.1, v + 6.8 + i * 1.45, 1.1, 0.7);
    });
    k.B(mod, u + 7.6, v + 6.4, T + 0.8, 16.4, 15.2, 1.6, M.silver, { r: 0.5 });
    k.decal(mod, u + 7.6, v + 6.4, T + 2.4, 16.4, 15.2, c => {
      c.strokeStyle = '#6b737c'; c.lineWidth = 0.18; rrect(c, u + 9, v + 8.2, 3.4, 1.9, 0.9); c.stroke();
      text(c, 'WiFi', u + 9.45, v + 9.65, 1.1, '#5b636c');
      text(c, 'ESP-WROOM-32', u + 12.8, v + 9.75, 1.45, '#4b535c');
      text(c, 'CE', u + 13.4, v + 12.6, 1.9, '#4b535c');
      c.beginPath(); c.arc(u + 18.6, v + 12, 1, 0, Math.PI * 2); c.stroke();
      text(c, 'FCC ID:2AC7Z-ESPWROOM32', u + 9.4, v + 15.4, 0.95, '#6b737c', 600);
      text(c, '211-161007', u + 16, v + 17.4, 0.95, '#6b737c', 600);
      c.fillStyle = '#3b4048'; c.beginPath(); c.arc(u + 9.4, v + 19.6, 0.8, 0, Math.PI * 2); c.fill();
    }, { ppu: 30, r: 0.4, m: 0.2 });
    // CP2102, ρυθμιστής 1117, τανταλίου, μικρά SMD
    const uart = k.group(g, 'esp-uart');
    k.B(uart, u + 33, v + 10.5, T, 5.2, 5.2, 0.9, M.chip, { r: 0.2 });
    k.decal(uart, u + 33, v + 10.5, T + 0.9, 5.2, 5.2, c => { text(c, 'CP2102', u + 33.5, v + 13.4, 1.2, '#9aa2ab'); c.fillStyle = '#9aa2ab'; c.beginPath(); c.arc(u + 33.8, v + 11.3, 0.3, 0, 7); c.fill(); }, { ppu: 40 });
    const reg = k.group(g, 'esp-reg');
    k.B(reg, u + 28.5, v + 17.5, T, 6.5, 3.6, 1.5, M.chip, { r: 0.2 });
    k.B(reg, u + 29.6, v + 21.1, T, 4.2, 1.6, 0.5, M.silver, { r: 0.1, ol: false });
    k.decal(reg, u + 28.5, v + 17.5, T + 1.5, 6.5, 3.6, c => text(c, 'AMS1117', u + 29, v + 19.8, 1.0, '#9aa2ab'), { ppu: 40 });
    k.B(g, u + 28.8, v + 9, T, 2.6, 1.8, 1.2, M.tant, { r: 0.2 });
    for (const [cu, cv] of [[27, 6.5], [30, 6.5], [39.5, 9], [39.5, 12], [39.5, 17.5], [36, 19], [26.5, 14], [42, 14.5]]) k.B(g, u + cu, v + cv, T, 1.6, 0.9, 0.5, M.smd, { r: 0.1, ol: false });
    // USB-C (το άνοιγμα κοιτά προς +u)
    const usb = k.group(g, 'esp-usb');
    k.B(usb, u + 46.4, v + 9.6, T, 7, 8.8, 3.2, M.silver, { r: 1.1 });
    k.decalU(usb, u + 53.4, v + 9.6, T, 8.8, 3.2, c => {
      c.fillStyle = '#2f343b'; rrect(c, v + 10.6, -(T + 2.7), 6.8, 2.2, 1.1); c.fill();
      c.fillStyle = '#8a9198'; rrect(c, v + 11.8, -(T + 1.9), 4.4, 0.6, 0.3); c.fill();
    }, { ppu: 40, r: 0.4 });
    // κουμπιά EN / BOOT
    const btns = k.group(g, 'esp-buttons');
    for (const bv of [2.6, 22]) {
      k.B(btns, u + 45, v + bv, T, 3.4, 3.4, 1.2, M.silver, { r: 0.3 });
      k.cylH(btns, u + 46.7, v + bv + 1.7, T + 1.2, 1.0, 0.55, M.plastic, { ol: false });
    }
    // βάσεις των δύο SMD LED (το φως τους το δείχνει η SVG από πάνω)
    k.group(g, 'esp-led');
    // ακίδες από πάνω: κοντό σώμα και στρογγυλή κορυφή
    const top = k.group(g, 'esp-pins');
    const stubs = [];
    const tips = [];
    for (const vv of [1.4, 26.6]) for (let i = 0; i < 19; i++) {
      stubs.push({ x: u + PIN_U(i), y: T + 1.0, z: v + vv, sy: 2.0 });
      tips.push({ x: u + PIN_U(i), y: T + 2.0, z: v + vv });
    }
    k.instances(top, new THREE.CylinderGeometry(0.42, 0.42, 1, 10), M.pin, stubs);
    k.instances(top, new THREE.SphereGeometry(0.62, 12, 8), M.pin, tips);
    return g;
  }

  function breadboard(k, M, S) {
    const { u, v, du, dv } = S.BB;
    const g = k.group(k.scene, 'breadboard');
    k.B(g, u, v, 0, du, dv, 2.4, M.cream, { r: 0.6 });
    k.decal(g, u, v, 2.4, du, dv, c => {
      c.fillStyle = '#e0d7c4'; c.fillRect(u + 1, v + dv / 2 - 0.6, du - 2, 1.2);
      c.fillStyle = '#d9534f'; c.fillRect(u + 1, v + 1.3, du - 2, 0.25); c.fillRect(u + 1, v + dv - 6.6, du - 2, 0.25);
      c.fillStyle = '#3c6fd6'; c.fillRect(u + 1, v + 6.2, du - 2, 0.25); c.fillRect(u + 1, v + dv - 1.6, du - 2, 0.25);
      c.fillStyle = '#8f8878';
      for (let x = 3; x < du - 2; x += 2.54) {
        const ys = [2.2, 4.6, dv - 5.5, dv - 3.1];
        for (let y = 8; y < dv - 7; y += 2.54) ys.push(y);
        for (const y of ys) c.fillRect(u + x, v + y, 0.9, 0.9);
      }
    }, { ppu: 16, r: 0.85 });
    return g;
  }

  function led(k, M, o) {
    const g = k.group(k.scene, 'led');
    const { u, v } = o;
    k.cylH(g, u - 1.2, v, 2.4, 0.25, 3.6, M.pin, { ol: false, seg: 8 });
    k.cylH(g, u + 1.2, v, 2.4, 0.25, 4.1, M.pin, { ol: false, seg: 8 });
    const red = k.mat(0xc93a2d, { r: 0.28, unique: true });
    k.cylH(g, u, v, 5.8, 2.15, 0.6, red);
    k.cylH(g, u, v, 6.4, 1.8, 5.8, red);
    const dome = k.mesh(g, k.keep(new THREE.SphereGeometry(1.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), red);
    dome.position.set(u, 12.2, v);
    g.userData.glow = [red];
    return g;
  }

  function button(k, M, o) {
    const g = k.group(k.scene, 'button');
    const { u, v } = o;
    k.B(g, u - 4.5, v - 4.5, 2.4, 9, 9, 3, M.plastic, { r: 0.6 });
    for (const [a, b] of [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]]) k.cylH(g, u + a, v + b, 5.4, 0.55, 0.2, M.steel, { ol: false, seg: 10 });
    const cap = k.group(g);
    const red = k.mat(0xd4472f, { r: 0.4, unique: true });
    k.cylH(cap, u, v, 5.4, 2.5, 1.4, red, { seg: 28 });
    g.userData.cap = cap;
    g.userData.capMat = red;
    return g;
  }

  function pir(k, M, o) {
    const g = k.group(k.scene, 'pir');
    const { u, v } = o;
    k.B(g, u - 7, v - 7, 2.4, 14, 14, 1.4, M.pirGreen, { r: 0.4 });
    k.B(g, u - 5.2, v - 5.2, 3.8, 10.4, 10.4, 0.5, M.white, { r: 0.5 });
    const dome = k.mesh(g, k.keep(new THREE.SphereGeometry(4.6, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2)), k.mat(0xf8f6f0, { r: 0.35, flat: true }));
    dome.position.set(u, 4.3, v);
    return g;
  }

  function sensor(k, M, o) {
    const g = k.group(k.scene, 'sensor');
    const { u, v } = o;
    for (let i = 0; i < 3; i++) k.B(g, u - 2.6 + i * 2.54, v + 4.6, 2.4, 0.5, 0.5, 1.4, M.pin, { ol: false });
    k.B(g, u - 4.5, v - 6, 3.4, 9, 12, 6, k.mat(0xeef3f6, { r: 0.6 }), { r: 0.6 });
    k.decal(g, u - 4.5, v - 6, 9.4, 9, 12, c => {
      c.fillStyle = '#9fa8b0';
      for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { rrect(c, u - 3.4 + i * 1.6, v - 4.6 + j * 2.4, 0.8, 1.8, 0.35); c.fill(); }
    });
    return g;
  }

  function router(k, M, o) {
    const g = k.group(k.scene, 'router');
    const { u, v } = o;
    k.B(g, u, v, 0, 18, 11, 3.2, M.navy, { r: 1.0 });
    for (const [au, tilt] of [[4, 0.12], [14, -0.12]]) {
      const a = k.cylH(g, 0, 0, 0, 0.6, 9, M.navy, { seg: 12 });
      a.position.set(u + au, 3.2 + 4.5, v + 1.2);
      a.rotation.z = tilt;
      a.position.x -= Math.sin(tilt) * 4.5;
      k.cylH(g, u + au, v + 1.2, 3.2, 1.0, 0.8, M.navy, { seg: 12 });
    }
    return g;
  }

  function tablet(k, M, o) {
    const g = k.group(k.scene, 'tablet');
    const { u, v } = o;
    k.B(g, u, v, 0, 26, 18, 1.2, M.slate, { r: 1.2 });
    k.decal(g, u, v, 1.2, 26, 18, c => { c.fillStyle = '#0e1628'; rrect(c, u + 1.5, v + 1.5, 23, 15, 0.8); c.fill(); }, { r: 0.2 });
    return g;
  }

  function miniEsp(k, M, o) {
    const g = k.group(k.scene, 'mini-esp');
    const { u, v } = o;
    k.B(g, u, v, 0, 22, 12, 1.2, M.pcbBlack, { r: 0.4 });
    k.B(g, u + 3, v + 2, 1.2, 9, 8, 1.2, M.silver, { r: 0.4 });
    k.decal(g, u, v, 1.2, 22, 12, c => text(c, 'ESP32', u + 13, v + 7.5, 2.2, '#cfd7e3'));
    return g;
  }

  function rpi(k, M, o) {
    const g = k.group(k.scene, 'rpi-broker');
    const { u, v } = o;
    k.B(g, u, v, 0, 30, 20, 1.4, M.green, { r: 0.6 });
    k.B(g, u + 26, v + 2, 1.4, 5, 7, 4, M.silver, { r: 0.4 });
    k.B(g, u + 26, v + 11, 1.4, 5, 7, 4, M.silver, { r: 0.4 });
    k.B(g, u + 5, v + 6, 1.4, 8, 8, 0.8, M.chip, { r: 0.2 });
    k.B(g, u + 1, v + 1, 1.4, 20, 2.2, 2.2, M.black, { r: 0.2 });
    k.decal(g, u, v, 1.4, 30, 20, c => text(c, 'Raspberry Pi', u + 14, v + 17, 2.2, '#eaf7ee'));
    return g;
  }

  // Raspberry Pi 5: η μακριά πλευρά (L) κατά +v, η στενή (W) κατά +u, όπως στο scene.js.
  function pi5(k, M, S) {
    const g = k.group(k.scene, 'pi');
    const { u, v } = S.ESP;
    const T = S.PI_T;
    const B = (parent, L, W, h, dL, dW, dh, m, o) => k.B(parent, u + W, v + L, h, dW, dL, dh, m, o);
    B(g, 0, 0, 0, 58, 36, 1.6, M.green, { r: 0.9 });
    k.decal(g, u, v, T, 36, 58, c => {
      for (const [hl, hw] of [[2.8, 2.8], [2.8, 33.2], [42.8, 2.8], [42.8, 33.2]]) {
        c.fillStyle = '#d9b45a'; c.beginPath(); c.arc(u + hw, v + hl, 1.9, 0, 7); c.fill();
        c.fillStyle = '#eef0e8'; c.beginPath(); c.arc(u + hw, v + hl, 1.0, 0, 7); c.fill();
      }
      const rot = (L, W, f) => { c.save(); c.translate(u + W, v + L); c.rotate(-Math.PI / 2); f(); c.restore(); };
      rot(33, 9.6, () => { text(c, 'Raspberry Pi', 0, 0, 2.2, '#eaf7ee'); c.strokeStyle = '#eaf7ee'; c.lineWidth = 0.25; rrect(c, 13.6, -2, 2.2, 2.6, 0.3); c.stroke(); text(c, '5', 14.15, 0, 2.2, '#eaf7ee'); });
      rot(34.5, 30.6, () => text(c, 'HDMI', 0, 0, 2.6, '#eaf7ee'));
      raspberry(c, u + 26, v + 11, 1, '#eaf7ee');
    }, { ppu: 20 });
    // header 2×20 με ψηλές ακίδες
    const hdr = k.group(g, 'pi-gpio');
    B(hdr, 2.8, 1.2, T, 46.4, 4.4, 2.4, M.black, { r: 0.3 });
    const pins = [];
    for (const ww of [2.4, 4.4]) for (let i = 0; i < 20; i++) pins.push({ x: u + ww, y: (T + 2.4 + S.PI_PIN_TOP) / 2, z: v + S.PI_PIN_L(i), sy: S.PI_PIN_TOP - T - 2.4 });
    k.instances(hdr, new THREE.BoxGeometry(0.6, 1, 0.6), M.gold, pins);
    // ανεμιστήρας, PoE
    B(g, 5, 7.6, T, 3.6, 2.4, 2.4, M.white, { r: 0.2 });
    B(g, 46, 8, T, 3.6, 3.6, 1.4, M.black, { r: 0.2 });
    k.instances(g, new THREE.BoxGeometry(0.5, 3.6, 0.5), M.gold, [[46.9, 8.9], [48.7, 8.9], [46.9, 10.7], [48.7, 10.7]].map(([pl, pw]) => ({ x: u + pw, y: T + 3.2, z: v + pl })));
    // RAM, BCM2712, RP1
    B(k.group(g, 'pi-ram'), 10.5, 13, T, 9.6, 6.6, 1.2, M.chip, { r: 0.25 });
    const cpu = k.group(g, 'pi-cpu');
    B(cpu, 21, 13, T, 11, 11, 1.8, M.silver, { r: 0.5 });
    k.decal(cpu, u + 13, v + 21, T + 1.8, 11, 11, c => {
      c.save(); c.translate(u + 16.4, v + 30.6); c.rotate(-Math.PI / 2);
      text(c, 'BCM2712', 0, 0, 1.6, '#55606b'); text(c, 'ARM · 2.4 GHz', 0, 2.4, 1.3, '#55606b', 600);
      c.restore();
    }, { ppu: 36, r: 0.35, m: 0.2 });
    const rp1 = k.group(g, 'pi-rp1');
    B(rp1, 34, 9, T, 8, 8, 1.2, M.chip, { r: 0.25 });
    k.decal(rp1, u + 9, v + 34, T + 1.2, 8, 8, c => raspberry(c, u + 13, v + 37, 1.1, '#e9edf2'), { ppu: 36 });
    B(g, 43.5, 15, T, 4, 4, 0.8, M.chip, { r: 0.2 });
    // FPC κάμερας / οθόνης
    const fpc = k.group(g, 'pi-fpc');
    for (const fw of [20.5, 25]) {
      B(fpc, 35, fw, T, 10, 2.6, 1.6, M.black, { r: 0.2 });
      k.decal(fpc, u + fw, v + 35, T + 1.6, 2.6, 10, c => { c.fillStyle = '#d6aa48'; c.fillRect(u + fw + 0.7, v + 35.6, 1.2, 8.8); });
    }
    // micro-HDMI ×2 και USB-C (ανοίγματα προς +u)
    const hd = k.group(g, 'pi-hdmi');
    for (const hl of [21, 28.5]) {
      B(hd, hl, 31.4, T, 5.4, 5.2, 2.6, M.silver, { r: 0.4 });
      k.decalU(hd, u + 36.6, v + hl, T, 5.4, 2.6, c => { c.fillStyle = '#2f343b'; rrect(c, v + hl + 0.8, -(T + 2.1), 3.8, 1.5, 0.4); c.fill(); }, { ppu: 40 });
    }
    const pw = k.group(g, 'pi-power');
    B(pw, 6.5, 31, T, 7, 5.8, 2.8, M.silver, { r: 0.9 });
    k.decalU(pw, u + 36.8, v + 6.5, T, 7, 2.8, c => { c.fillStyle = '#2f343b'; rrect(c, v + 7.4, -(T + 2.3), 5.2, 1.8, 0.9); c.fill(); }, { ppu: 40 });
    // USB-A ×2 (τα μπλε είναι USB 3) και Ethernet (ανοίγματα προς +v)
    const ports = k.group(g, 'pi-ports');
    B(ports, 49.6, 1.4, T, 10.4, 8.4, 8.4, M.silver, { r: 0.5 });
    B(ports, 49.6, 11, T, 10.4, 8.4, 8.4, M.silver, { r: 0.5 });
    B(ports, 49, 20.6, T, 11.2, 14, 7.6, M.silver, { r: 0.5 });
    k.decalV(ports, u + 1.4, v + 60, T, 33.2, 8.4, c => {
      for (const [pw2, h] of [[1.4, 2.6], [1.4, 6.4], [11, 2.6], [11, 6.4]]) {
        c.fillStyle = '#2f343b'; rrect(c, u + pw2 + 0.8, -(T + h + 2.6), 6.8, 3.0, 0.3); c.fill();
        c.fillStyle = pw2 > 5 ? '#2f6fd6' : '#f2f2ee'; c.fillRect(u + pw2 + 1.4, -(T + h + 1.6), 5.6, 1.2);
      }
    }, { ppu: 30 });
    k.decalV(ports, u + 20.6, v + 60.2, T, 14, 7.6, c => {
      c.fillStyle = '#2f343b'; rrect(c, u + 22.6, -(T + 6.4), 10, 5.4, 0.4); c.fill();
      c.fillStyle = '#e8c35a'; for (let i = 0; i < 8; i++) c.fillRect(u + 23.6 + i * 1.05, -(T + 6.0), 0.5, 1.2);
      c.fillStyle = '#39d98a'; c.fillRect(u + 21.2, -(T + 7.2), 1.2, 0.8); c.fillStyle = '#f0b429'; c.fillRect(u + 33.2, -(T + 7.2), 1.2, 0.8);
    }, { ppu: 30 });
    for (const [cl, cw] of [[6.4, 14], [7.2, 17], [20, 26.5], [23, 26.5], [18.6, 10], [21, 10], [22, 46.5], [44, 27.5], [28, 9]]) if (cw < 30) B(g, cl, cw, T, 0.9, 1.6, 0.5, M.smd, { r: 0.1, ol: false });
    return g;
  }

  function ultrasonic(k, M, S) {
    const g = k.group(k.scene, 'ultrasonic');
    const { u, v, w } = S.US;
    const H = 2.4;
    for (let i = 0; i < 4; i++) k.B(g, u + 6.2 + i * 2.54, v + 0.2, H, 0.6, 0.6, 2.6, M.gold, { ol: false });
    k.B(g, u + 5.6, v - 0.6, H + 1.2, 10.6, 2.2, 1.4, M.black, { r: 0.2 });
    k.B(g, u, v, H + 2, w, 1.2, 10, M.blue, { r: 0.3 });
    k.decalV(g, u, v + 1.2, H + 2, w, 10, c => {
      text(c, 'HC-SR04', u + w / 2, -(H + 10.6), 1.5, '#eef3ff', 700, 'center');
      text(c, 'VCC TRIG ECHO GND', u + w / 2, -(H + 2.7), 0.95, '#eef3ff', 700, 'center');
    }, { ppu: 36 });
    k.B(g, u + 8.6, v + 1.2, H + 9, 2.8, 0.8, 1.6, M.silver, { r: 0.3 });
    // τα δύο «μάτια»: ασημένιοι κύλινδροι προς +v με πλέγμα μπροστά
    const meshTex = c => {
      c.fillStyle = '#2f343b'; c.beginPath(); c.arc(0, 0, 1, 0, 7); c.fill();
      c.fillStyle = '#4c535c';
      for (let x = -1; x <= 1; x += 0.14) for (let y = -1; y <= 1; y += 0.14) if (x * x + y * y < 0.9) { c.beginPath(); c.arc(x, y, 0.045, 0, 7); c.fill(); }
      c.fillStyle = '#9aa2ab'; c.beginPath(); c.arc(0, 0, 0.22, 0, 7); c.fill();
    };
    for (const cu of [u + 4.6, u + w - 4.6]) {
      const cyl = k.mesh(g, k.keep(new THREE.CylinderGeometry(3.7, 3.7, 4, 32)), M.steel);
      cyl.rotation.x = Math.PI / 2;
      cyl.position.set(cu, H + 7, v + 1.2 + 2);
      k.decalV(g, cu - 2.9, v + 5.2, H + 7 - 2.9, 5.8, 5.8, c => { c.translate(cu, -(H + 7)); c.scale(2.9, 2.9); meshTex(c); }, { ppu: 40 });
    }
    return g;
  }

  // ------------------------------------------------------------ buzzer, LED RGB, servo, OLED
  function buzzer3d(k, M, o) {
    const g = k.group(k.scene, 'buzzer');
    const { u, v } = o;
    k.cylH(g, u - 1.27, v, 2.4, 0.22, 1.4, M.pin, { ol: false, seg: 8 });
    k.cylH(g, u + 1.27, v, 2.4, 0.22, 1.4, M.pin, { ol: false, seg: 8 });
    const body = k.mat(0x1d1f24, { r: 0.55, unique: true });
    k.cylH(g, u, v, 3.4, 3.1, 4.2, body, { seg: 32 });
    k.cylH(g, u, v, 7.6, 0.9, 0.05, k.mat(0x050507, { r: 0.9 }), { ol: false, seg: 20 });
    g.userData.body = body;
    return g;
  }
  function rgb3d(k, M, o) {
    const g = k.group(k.scene, 'rgb');
    const { u, v } = o;
    for (const d of [-1.9, -0.63, 0.63, 1.9]) k.cylH(g, u + d, v, 2.4, 0.22, 3.8, M.pin, { ol: false, seg: 8 });
    const lens = k.mat(0xe8eef2, { r: 0.18, op: 0.92, unique: true });
    k.cylH(g, u, v, 5.8, 2.15, 0.6, lens);
    k.cylH(g, u, v, 6.4, 1.8, 5.8, lens);
    const dome = k.mesh(g, k.keep(new THREE.SphereGeometry(1.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), lens);
    dome.position.set(u, 12.2, v);
    g.userData.lens = lens;
    return g;
  }
  function servo3d(k, M, o) {
    const g = k.group(k.scene, 'servo');
    const { u, v } = o;
    const blue = k.mat(0x2f6fd0, { r: 0.45 });
    k.B(g, u, v, 0, 12, 6, 10, blue, { r: 0.5 });
    k.B(g, u - 2, v + 1.5, 6.5, 16, 3, 1, blue, { r: 0.3 });
    k.cylH(g, u + 3.2, v + 3, 10, 1.4, 1, k.mat(0xf2f2f2, { r: 0.5 }), { seg: 20 });
    // το μπράτσο γυρίζει γύρω από τον άξονα (κάθετος άξονας y του three.js)
    const arm = new THREE.Group();
    arm.position.set(u + 3.2, 11.1, v + 3);
    g.add(arm);
    k.B(arm, -1.6, -0.6, 0, 7.6, 1.2, 0.6, k.mat(0xffffff, { r: 0.5 }), { r: 0.3 });
    g.userData.arm = arm;
    return g;
  }
  function oled3d(k, M, o) {
    const g = k.group(k.scene, 'oled');
    const { u, v } = o;
    k.B(g, u - 1, v - 2, 0, 28, 5, 1.2, M.dark, { r: 0.4 });
    k.B(g, u, v, 1.2, 26, 1.2, 17, k.mat(0x1b3f8a, { r: 0.5 }), { r: 0.2 });
    for (let i = 0; i < 4; i++) k.B(g, u + 9 + i * 2.54 - 0.3, v + 0.3, 18.2, 0.6, 0.6, 1.8, M.pin, { ol: false });
    // οθόνη: καμβάς 256×128 (2× τα 128×64 εικονοστοιχεία του SSD1306)
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const tex = k.keep(new THREE.CanvasTexture(cv));
    tex.encoding = THREE.sRGBEncoding;
    const scr = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(23, 12.5)), k.keep(new THREE.MeshBasicMaterial({ map: tex })));
    scr.position.set(u + 1.5 + 11.5, 1.2 + 16 - 6.25, v + 1.2 + 0.02);
    g.add(scr);
    g.userData.draw = items => {
      const c = cv.getContext('2d');
      c.fillStyle = '#05070c';
      c.fillRect(0, 0, 256, 128);
      c.fillStyle = '#9fe7ff';
      c.textBaseline = 'alphabetic';
      c.textAlign = 'center';
      for (const t of items || []) { c.font = `${16 * t.size}px "JetBrains Mono", monospace`; [...String(t.text)].forEach((ch, i) => c.fillText(ch, (t.x + i * 6 * t.size + 3 * t.size) * 2, (t.y + 7 * t.size) * 2)); }
      tex.needsUpdate = true;
    };
    g.userData.draw([]);
    return g;
  }

  function trafficLight(k, M, S) {
    const g = k.group(k.scene, 'traffic');
    const { u, v } = S.TL;
    for (let i = 0; i < 3; i++) k.B(g, u - 2.54 + i * 2.54 - 0.3, v + 4.7, 2.4, 0.6, 0.6, 1.2, M.pin, { ol: false });
    k.cylH(g, u, v, 2.4, 0.9, 4.2, M.plastic, { seg: 16 });
    k.B(g, u - 2.6, v - 1.6, 6.4, 5.2, 3.2, 16, M.plastic, { r: 0.9 });
    const lamps = {};
    const hood = k.keep(new THREE.CylinderGeometry(2.2, 2.2, 1.6, 20, 1, true, -Math.PI / 2, Math.PI));
    for (const [key, hh, col] of [['r', 18.4, 0xd8463a], ['y', 13.4, 0xe6b52e], ['g', 8.4, 0x3fae55]]) {
      const m = k.mat(col, { r: 0.3, unique: true });
      m.userData.base = col;
      const lamp = k.mesh(g, k.keep(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 24)), m, { t: 0.12 });
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(u, hh, v + 1.6 + 0.25);
      const hd = k.mesh(g, hood, k.mat(0x1a1b1e, { r: 0.6 }), { ol: false });
      hd.material.side = THREE.DoubleSide;
      hd.rotation.x = Math.PI / 2;
      hd.position.set(u, hh + 0.1, v + 1.6 + 0.8);
      lamps[key] = m;
    }
    g.userData.lamps = lamps;
    return g;
  }

  // Αυτοκινητάκι-εμπόδιο (σαν παιχνίδι): στρογγυλεμένο κόκκινο σώμα, καμπίνα με τζάμια, μαύροι τροχοί.
  function car(k, M, S) {
    const g = k.group(k.scene, 'car');
    const u = S.CAR.u;
    const red = k.mat(0xe4533d, { r: 0.45 });
    const glass = k.mat(0xbfe3f2, { r: 0.15, m: 0.1 });
    k.B(g, u - 3.8, 0, 0.9, 7.6, 15, 3.6, red, { r: 1.3 });
    k.B(g, u - 3.2, 4, 4.3, 6.4, 7, 3.2, red, { r: 1.1 });
    // τζάμια: λίγο έξω από την καμπίνα, ώστε να φαίνονται στα πλάγια, μπροστά και πίσω
    k.B(g, u - 3.35, 4.8, 4.9, 6.7, 5.4, 2.0, glass, { r: 0.3, ol: false });
    k.B(g, u - 2.5, 3.85, 4.9, 5.0, 7.3, 2.0, glass, { r: 0.3, ol: false });
    for (const [wu, wv] of [[-3.9, 3], [3.9, 3], [-3.9, 11.2], [3.9, 11.2]]) {
      const wheel = k.mesh(g, k.keep(new THREE.CylinderGeometry(1.7, 1.7, 1.2, 24)), M.plastic);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(u + wu, 1.7, wv);
      const hub = k.mesh(g, k.keep(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 16)), M.silver, { ol: false });
      hub.rotation.z = Math.PI / 2;
      hub.position.set(u + wu, 1.7, wv);
    }
    k.B(g, u - 3.2, 14.7, 2.6, 1.4, 0.4, 0.9, k.mat(0x8f2c1f), { ol: false });
    k.B(g, u + 1.8, 14.7, 2.6, 1.4, 0.4, 0.9, k.mat(0x8f2c1f), { ol: false });
    return g;
  }

  // Καλώδιο jumper: πλαστικά βύσματα στις άκρες και σωλήνας με καμπύλη Bezier (το lift της SVG γίνεται ύψος).
  function wire(k, M, o, K) {
    const cls = o.cls;
    const g = k.group(k.scene, 'wire-' + cls.replace('w-', ''));
    const col = WIRE_COLORS[cls] || 0x34383f;
    const body = k.mat(col, { r: 0.45, unique: true });
    const plug = k.mat(new THREE.Color(col).multiplyScalar(0.72).getHex(), { r: 0.5 });
    const A = o.a, Bp = o.b;
    k.B(g, A.u - 1.1, A.v - 1.1, A.h, 2.2, 2.2, 4.6, plug, { r: 0.3 });
    k.B(g, Bp.u - 0.8, Bp.v - 0.8, Bp.h, 1.6, 1.6, 3.4, plug, { r: 0.25 });
    // ίδια διαδρομή με την SVG: κάθε καλώδιο στη δική του λωρίδα, κάθετα μέσα στην τρύπα
    let curve;
    if (o.route) curve = new THREE.CatmullRomCurve3(o.route.map(q => new THREE.Vector3(q.u, q.h, q.v)), false, 'centripetal', 0.5);
    else {
      const lift = o.lift / K;
      const a = new THREE.Vector3(A.u, A.h + 4.6, A.v);
      const b = new THREE.Vector3(Bp.u, Bp.h + 3.4, Bp.v);
      curve = new THREE.CubicBezierCurve3(a, a.clone().add(new THREE.Vector3(0, lift, 0)), b.clone().add(new THREE.Vector3(0, lift, 0)), b);
    }
    const tube = k.keep(new THREE.TubeGeometry(curve, 140, 0.5, 10, false));
    const t = new THREE.Mesh(tube, body);
    t.castShadow = true;
    g.add(t);
    const ol = new THREE.Mesh(k.keep(new THREE.TubeGeometry(curve, 140, 0.68, 10, false)), k.ink);
    t.add(ol);
    t.userData.ol = ol;
    k.outlines.push(ol);
    g.userData.tubes = [tube, ol.geometry];
    if (o.id) g.userData.id = o.id;
    g.userData.glow = [body];
    g.userData.isWire = true;
    return g;
  }

  // ------------------------------------------------------------ σκηνή, κάμερα, φως

  function cssColor(el, name, fallback) {
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    try { return v ? new THREE.Color(v) : new THREE.Color(fallback); } catch (e) { return new THREE.Color(fallback); }
  }

  function build(svg, manifest) {
    const S = root.IoTScene;
    const k = makeKit();
    const scene = new THREE.Scene();
    k.scene = scene;
    const M = palette(k);
    // πάτωμα: πλέγμα όπως στην SVG και επιφάνεια που δέχεται μόνο σκιές
    const gridRaw = getComputedStyle(svg).getPropertyValue('--grid').trim();
    const ga = /rgba?\(([^)]+)\)/.exec(gridRaw);
    const gridAlpha = ga && ga[1].split(',').length === 4 ? parseFloat(ga[1].split(',')[3]) : 1;
    const gridCol = ga ? new THREE.Color(`rgb(${ga[1].split(',').slice(0, 3).join(',')})`) : cssColor(svg, '--grid', '#d8cfbd');
    const pts = [];
    for (let i = -60; i <= 180; i += 10) pts.push(i, 0, -70, i, 0, 60);
    for (let j = -70; j <= 60; j += 10) pts.push(-60, 0, j, 180, 0, j);
    const gg = k.keep(new THREE.BufferGeometry());
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(gg, k.keep(new THREE.LineBasicMaterial({ color: gridCol, transparent: gridAlpha < 1, opacity: gridAlpha }))));
    const ground = new THREE.Mesh(k.keep(new THREE.PlaneGeometry(600, 400)), k.keep(new THREE.ShadowMaterial({ color: 0x2a2418, opacity: 0.2 })));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(60, -0.02, 0);
    ground.receiveShadow = true;
    scene.add(ground);
    // φως: απαλό από παντού και ήλιος από πάνω αριστερά (σκιές προς τα κάτω δεξιά, όπως στα σχέδια)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9cfb8, 0.95));
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    const target = new THREE.Object3D();
    target.position.set(50, 0, -10);
    scene.add(target);
    sun.target = target;
    sun.position.set(50 - 70, 160, -10 + 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 1, far: 420 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.radius = 3;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xfff4e0, 0.35);
    fill.position.set(80, 60, 120);
    scene.add(fill);

    const objs = { wires: [] };
    for (const o of manifest) {
      let g = null;
      switch (o.t) {
        case 'esp32': g = esp32(k, M, S); break;
        case 'bb': g = breadboard(k, M, S); break;
        case 'pi5': g = pi5(k, M, S); break;
        case 'led': g = objs.led = led(k, M, o); break;
        case 'button': g = objs.button = button(k, M, o); break;
        case 'pir': g = pir(k, M, o); break;
        case 'sensor': g = sensor(k, M, o); break;
        case 'router': g = router(k, M, o); break;
        case 'tablet': g = tablet(k, M, o); break;
        case 'miniEsp': g = miniEsp(k, M, o); break;
        case 'rpi': g = rpi(k, M, o); break;
        case 'ultrasonic': g = ultrasonic(k, M, S); break;
        case 'traffic': g = objs.traffic = trafficLight(k, M, S); break;
        case 'car': g = objs.car = car(k, M, S); break;
      case 'buzzer': g = objs.buzzer = buzzer3d(k, M, o); break;
      case 'rgb': g = objs.rgb = rgb3d(k, M, o); break;
      case 'servo': g = objs.servo = servo3d(k, M, o); break;
      case 'oled': g = objs.oled = oled3d(k, M, o); break;
        case 'wire': g = wire(k, M, o, S.K); objs.wires.push(g); break;
      }
      if (g) g.userData.top = true;
    }
    return { k, scene, objs, svg, manifest };
  }

  // Κάμερα με την ισομετρική προβολή του scene.js: X = (u − v)·cos30·K, Y = (u + v)·K/2 − h·K.
  const RX = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2);
  const RY = new THREE.Vector3(-1, 2, -1).normalize();
  const RZ = new THREE.Vector3(1, 1, 1).normalize();
  function placeCamera(cam, svg, W, H, K) {
    const s = Math.sqrt(1.5) * K;
    const vb = svg.viewBox.baseVal;
    const kk = Math.min(W / vb.width, H / vb.height);
    const vw = W / kk, vh = H / kk;
    const x0 = vb.x - (vw - vb.width) / 2;
    const y0 = vb.y - (vh - vb.height) / 2;
    cam.left = x0 / s; cam.right = (x0 + vw) / s;
    cam.top = -y0 / s; cam.bottom = -(y0 + vh) / s;
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ 3D περιστροφή («γύρω γύρω»)
  // Η ισομετρική κάμερα κοιτά από την κατεύθυνση (1,1,1): γωνία 45° γύρω από τον κατακόρυφο άξονα και 35,26° από πάνω.
  // Η περιστροφή ξεκινά από εκεί και επιστρέφει εκεί με ομαλή κίνηση, οπότε δεν υπάρχει «πήδημα» στην εικόνα.
  const ISO_YAW = Math.PI / 4;
  const ISO_PITCH = Math.asin(1 / Math.sqrt(3));
  const UP = new THREE.Vector3(0, 1, 0);
  const ease = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

  function orbitBasis(yaw, pitch) {
    const z = new THREE.Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
    const x = new THREE.Vector3().crossVectors(UP, z).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    return { x, y, z };
  }

  function placeOrbit(now) {
    const o = cur.orbit;
    const { cam } = cur;
    // μετάβαση (μπαίνω / βγαίνω): γωνίες και κέντρο πλαισίου κινούνται ομαλά
    let busy = false;
    if (o.tr) {
      const x = Math.min(1, (now - o.tr.t0) / o.tr.dur);
      const e = ease(x);
      o.yaw = o.tr.y0 + (o.tr.y1 - o.tr.y0) * e;
      o.pitch = o.tr.p0 + (o.tr.p1 - o.tr.p0) * e;
      o.off = [o.tr.o0[0] + (o.tr.o1[0] - o.tr.o0[0]) * e, o.tr.o0[1] + (o.tr.o1[1] - o.tr.o0[1]) * e];
      o.zoom = o.tr.z0 + (o.tr.z1 - o.tr.z0) * e;
      busy = x < 1;
      if (!busy) {
        const done = o.tr.done;
        o.tr = null;
        if (done) done();
        else busy = !!o.auto; // μετά την είσοδο συνεχίζει η αυτόματη περιστροφή
      }
    } else if (o.auto && !o.drag) {
      const dt = o.last ? Math.min(64, now - o.last) : 16;
      o.yaw += dt * 0.00045;
      busy = true;
    }
    o.last = now;
    if (!cur.orbit) return busy;
    const b = orbitBasis(o.yaw, o.pitch);
    cam.matrix.makeBasis(b.x, b.y, b.z).setPosition(o.center.clone().addScaledVector(b.z, 600));
    cam.updateMatrixWorld(true);
    const aspect = cur.W / cur.H;
    const hh = o.half / o.zoom;
    cam.left = o.off[0] - hh * aspect; cam.right = o.off[0] + hh * aspect;
    cam.top = o.off[1] + hh; cam.bottom = o.off[1] - hh;
    cam.updateProjectionMatrix();
    return busy;
  }

  function onOrbitPointer(e) {
    const o = cur && cur.orbit;
    if (!o) return;
    if (e.type === 'pointerdown') {
      o.drag = { x: e.clientX, y: e.clientY, yaw: o.yaw, pitch: o.pitch };
      o.auto = false;
      cur.canvas.setPointerCapture(e.pointerId);
      if (cur.onState) cur.onState();
    } else if (e.type === 'pointermove' && o.drag && !o.tr) {
      o.yaw = o.drag.yaw - (e.clientX - o.drag.x) * 0.009;
      o.pitch = Math.max(0.08, Math.min(1.45, o.drag.pitch + (e.clientY - o.drag.y) * 0.006));
      requestRender();
    } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
      o.drag = null;
    }
  }
  function onOrbitWheel(e) {
    const o = cur && cur.orbit;
    if (!o) return;
    e.preventDefault();
    o.zoom = Math.max(0.5, Math.min(4, o.zoom * (e.deltaY > 0 ? 1 / 1.12 : 1.12)));
    requestRender();
  }

  // on = true: ξεκίνα την περιστροφή (με αυτόματο «γύρω γύρω») · false: επιστροφή στην ισομετρική όψη.
  function orbit(on, opts) {
    if (!cur) return false;
    opts = opts || {};
    const { cam, svg } = cur;
    if (on) {
      if (cur.orbit) { if (opts.auto !== undefined) { cur.orbit.auto = opts.auto; requestRender(); } return true; }
      placeCamera(cam, svg, cur.W, cur.H, root.IoTScene.K);
      const box = new THREE.Box3();
      cur.scene.children.forEach(c => { if (c.userData.top) box.expandByObject(c); });
      if (box.isEmpty()) box.setFromObject(cur.scene);
      const center = box.getCenter(new THREE.Vector3());
      // το τρέχον πλαίσιο της ισομετρικής κάμερας, εκφρασμένο γύρω από το κέντρο της σκηνής
      const cx = center.dot(RX);
      const cy = center.dot(RY);
      const half = (cam.top - cam.bottom) / 2;
      const off0 = [(cam.left + cam.right) / 2 - cx, (cam.top + cam.bottom) / 2 - cy];
      cur.orbit = { yaw: ISO_YAW, pitch: ISO_PITCH, center, half, zoom: 1, off: off0, auto: opts.auto !== false, drag: null, last: 0 };
      cur.orbit.tr = { t0: performance.now(), dur: 700, y0: ISO_YAW, y1: ISO_YAW, p0: ISO_PITCH, p1: 0.5, o0: off0, o1: [0, 0], z0: 1, z1: 1.35 };
      cur.canvas.classList.add('orbiting');
      svg.classList.add('orbiting');
      cur.canvas.addEventListener('pointerdown', onOrbitPointer);
      cur.canvas.addEventListener('pointermove', onOrbitPointer);
      cur.canvas.addEventListener('pointerup', onOrbitPointer);
      cur.canvas.addEventListener('pointercancel', onOrbitPointer);
      cur.canvas.addEventListener('wheel', onOrbitWheel, { passive: false });
      requestRender();
      return true;
    }
    const o = cur.orbit;
    if (!o) return false;
    // γύρνα στη γωνία της ισομετρικής όψης από τον πιο κοντινό δρόμο
    const full = Math.PI * 2;
    const target = ISO_YAW + Math.round((o.yaw - ISO_YAW) / full) * full;
    placeCamera(cam, svg, cur.W, cur.H, root.IoTScene.K);
    const offIso = [(cam.left + cam.right) / 2 - o.center.dot(RX), (cam.top + cam.bottom) / 2 - o.center.dot(RY)];
    o.auto = false;
    o.tr = { t0: performance.now(), dur: 650, y0: o.yaw, y1: target, p0: o.pitch, p1: ISO_PITCH, o0: o.off, o1: offIso, z0: o.zoom, z1: 1, done: () => {
      cur.orbit = null;
      cam.matrix.makeBasis(RX, RY, RZ).setPosition(RZ.clone().multiplyScalar(600));
      cam.updateMatrixWorld(true);
      cur.canvas.classList.remove('orbiting');
      svg.classList.remove('orbiting');
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(t => cur.canvas.removeEventListener(t, onOrbitPointer));
      cur.canvas.removeEventListener('wheel', onOrbitWheel);
      if (cur.onState) cur.onState();
      requestRender();
    } };
    requestRender();
    return true;
  }

  // ------------------------------------------------------------ κατάσταση από την SVG

  function sync() {
    if (!cur) return;
    const { svg, objs, k } = cur;
    const on = sel => { const el = svg.querySelector(sel); return !!(el && el.classList.contains('on')); };
    if (objs.led) {
      const lit = on('#sc-led');
      for (const m of objs.led.userData.glow) { m.emissive.setHex(lit ? 0xff3a1c : 0); m.emissiveIntensity = lit ? 1.1 : 1; m.color.setHex(lit ? 0xff6a4d : 0xc93a2d); }
    }
    if (objs.button) {
      const p = on('#sc-btn');
      objs.button.userData.cap.position.y = p ? -0.7 : 0;
      objs.button.userData.capMat.color.setHex(p ? 0xff6a4d : 0xd4472f);
    }
    if (objs.traffic) {
      for (const [key, m] of Object.entries(objs.traffic.userData.lamps)) {
        const lit = on('#sc-tl-' + key);
        m.emissive.setHex(lit ? m.userData.base : 0);
        m.emissiveIntensity = lit ? 1.2 : 1;
        m.color.setHex(m.userData.base).multiplyScalar(lit ? 1 : 0.38);
      }
    }
    if (objs.car) {
      const mv = svg.querySelector('#sc-car-move');
      const mt = mv && /translate\(\s*(-?[\d.]+)/.exec(mv.getAttribute('transform') || '');
      if (mt) objs.car.position.z = -parseFloat(mt[1]) / (C30 * root.IoTScene.K);
    }
    for (const w of objs.wires) {
      const lit = w.userData.id && on('#' + w.userData.id);
      for (const m of w.userData.glow) { m.emissive.copy(m.color); m.emissiveIntensity = lit ? 0.45 : 0; }
    }
    // επισήμανση κομματιού (hover / επιλογή): το περίγραμμα παίρνει το χρώμα της SVG
    const hot = new Set([...svg.querySelectorAll('.part-hot[data-part]')].map(e => e.dataset.part));
    const selp = new Set([...svg.querySelectorAll('.part-sel[data-part]')].map(e => e.dataset.part));
    if (!cur.hl) cur.hl = { hot: k.keep(new THREE.MeshBasicMaterial({ color: cssColor(svg, '--accent', '#e8892f'), side: THREE.BackSide })), sel: k.keep(new THREE.MeshBasicMaterial({ color: cssColor(svg, '--teal', '#178f86'), side: THREE.BackSide })) };
    for (const o of k.outlines) o.material = k.ink;
    cur.scene.traverse(obj => {
      const p = obj.userData && obj.userData.part;
      if (!p || (!hot.has(p) && !selp.has(p))) return;
      const m = selp.has(p) ? cur.hl.sel : cur.hl.hot;
      obj.traverse(x => { if (x.userData.ol) x.userData.ol.material = m; });
    });
  }

  // ------------------------------------------------------------ απόδοση

  // Απόδοση μόνο όταν αλλάζει κάτι. Αν η καρτέλα δεν δίνει frames (π.χ. κρυφή), ένα χρονόμετρο την κάνει έτσι κι αλλιώς.
  let frame = 0;
  let timer = 0;
  function requestRender() {
    if (frame) return;
    frame = requestAnimationFrame(renderNow);
    timer = setTimeout(() => renderNow(performance.now()), 200);
  }
  function renderNow(now) {
    if (frame) cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = 0;
    if (!cur) return;
    const { svg, canvas, cam } = cur;
    if (!svg.isConnected) { unmount(); return; }
    // θέση και μέγεθος όπως της SVG (στο κινητό η SVG δεν πιάνει όλο το πλαίσιο)
    const r = svg.getBoundingClientRect();
    const wr = cur.wrap.getBoundingClientRect();
    const W = r.width, H = r.height;
    if (W < 2 || H < 2) return;
    canvas.style.left = (r.left - wr.left - cur.wrap.clientLeft) + 'px';
    canvas.style.top = (r.top - wr.top - cur.wrap.clientTop) + 'px';
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const pr = Math.min(2, root.devicePixelRatio || 1);
    if (cur.W !== W || cur.H !== H || cur.pr !== pr) { renderer.setPixelRatio(pr); renderer.setSize(W, H, false); cur.W = W; cur.H = H; cur.pr = pr; }
    const t = now || performance.now();
    let spin = false;
    if (cur.orbit) spin = placeOrbit(t);
    else placeCamera(cam, svg, W, H, root.IoTScene.K);
    if (!cur) return;
    const busy = animate(t);
    cur.renders = (cur.renders || 0) + 1;
    renderer.render(cur.scene, cam);
    if (busy || spin) requestRender();
  }

  // «Στήσιμο»: τα αντικείμενα πέφτουν ένα-ένα, μετά τα καλώδια «τραβιούνται» από άκρη σε άκρη (όπως το buildIn της SVG).
  function animate(now) {
    const a = cur.anim;
    if (!a) return false;
    if (!a.t0) a.t0 = now;
    const t = now - a.t0;
    let busy = false;
    const back = x => { const c1 = 1.1, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
    const inOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    for (const it of a.items) {
      const x = Math.min(1, Math.max(0, (t - it.delay) / it.dur));
      if (x < 1) busy = true;
      if (it.kind === 'drop') {
        it.obj.visible = t >= it.delay;
        it.obj.position.y = (1 - back(x)) * 14;
      } else {
        it.obj.visible = !it.obj.userData.unwired && t >= it.delay;
        const e = inOut(x);
        for (const g of it.obj.userData.tubes) g.setDrawRange(0, Math.max(0, Math.floor(g.index.count * e / 3) * 3));
        // το πρώτο βύσμα μπαίνει στο pin αμέσως, το δεύτερο όταν το καλώδιο φτάσει στην τρύπα
        it.obj.children.forEach((c, i) => { if (i === 0) c.visible = true; else if (i === 1) c.visible = e >= 0.97; });
      }
    }
    if (!busy) cur.anim = null;
    return busy;
  }

  function unmount() {
    if (!cur) return;
    if (cur.orbit) {
      ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'].forEach(t => cur.canvas.removeEventListener(t, onOrbitPointer));
      cur.canvas.removeEventListener('wheel', onOrbitWheel);
      cur.canvas.classList.remove('orbiting');
      cur.orbit = null;
    }
    cur.mo && cur.mo.disconnect();
    cur.ro && cur.ro.disconnect();
    for (const d of cur.k.disp) d.dispose && d.dispose();
    if (cur.canvas.parentNode) cur.canvas.remove();
    cur.svg.classList.remove('has3d');
    cur = null;
  }

  function mount(wrap, svg, manifest, opts) {
    unmount();
    if (!manifest || !manifest.length || !webgl() || (opts && opts.off)) return false;
    try {
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.className = 'scene-3d';
        renderer.domElement.setAttribute('aria-hidden', 'true');
      }
      const built = build(svg, manifest);
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1500);
      cam.matrixAutoUpdate = false;
      cam.matrix.makeBasis(RX, RY, RZ).setPosition(RZ.clone().multiplyScalar(600));
      cam.updateMatrixWorld(true);
      cur = Object.assign(built, { cam, wrap, canvas: renderer.domElement, W: 0, H: 0 });
      wrap.insertBefore(cur.canvas, svg);
      svg.classList.add('has3d');
      if (opts && opts.animate) {
        const items = [];
        const tops = built.scene.children.filter(o => o.userData.top && !o.userData.isWire);
        const step = Math.min(140, 1300 / Math.max(1, tops.length));
        let t = 120;
        for (const o of tops) { items.push({ kind: 'drop', obj: o, delay: t, dur: 760 }); o.visible = false; t += step; }
        let w = t + 260;
        for (const o of built.objs.wires) { items.push({ kind: 'wire', obj: o, delay: w, dur: 900 }); o.visible = false; w += 220; }
        cur.anim = { items, t0: 0 };
      }
      cur.mo = new MutationObserver(() => { sync(); requestRender(); });
      cur.mo.observe(svg, { attributes: true, subtree: true, attributeFilter: ['class', 'transform', 'viewBox'] });
      cur.ro = new ResizeObserver(() => requestRender());
      cur.ro.observe(svg);
      if (document.fonts && document.fonts.status !== 'loaded') {
        const mine = cur;
        document.fonts.ready.then(() => { if (cur === mine) { mine.k.redraws.forEach(f => f()); requestRender(); } });
      }
      sync();
      requestRender();
      return true;
    } catch (e) {
      console.warn('3D σκηνή: επιστροφή στη SVG', e);
      try { unmount(); } catch (e2) { /* τίποτα */ }
      svg.classList.remove('has3d');
      return false;
    }
  }

  // Εικόνα της 3D σκηνής σε μεγαλύτερη ανάλυση (π.χ. για στιγμιότυπα): επιστρέφει έναν 2D καμβά.
  function capture(pr) {
    if (!cur) return null;
    const old = renderer.getPixelRatio();
    renderer.setPixelRatio(pr || 2);
    renderer.setSize(cur.W, cur.H, false);
    placeCamera(cur.cam, cur.svg, cur.W, cur.H, root.IoTScene.K);
    renderer.render(cur.scene, cur.cam);
    const out = document.createElement('canvas');
    out.width = renderer.domElement.width;
    out.height = renderer.domElement.height;
    out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    renderer.setPixelRatio(old);
    renderer.setSize(cur.W, cur.H, false);
    requestRender();
    return out;
  }

  // Συνδεσμολογία από τον μαθητή: ένα καλώδιο κρύβεται ή εμφανίζεται (με «τράβηγμα» από το pin ως την τρύπα).
  function wireVisible(i, on, animate) {
    const g = cur && cur.objs.wires[i];
    if (!g) return;
    g.userData.unwired = !on;
    g.visible = !!on;
    if (on && animate) {
      const it = { kind: 'wire', obj: g, delay: 0, dur: 900 };
      if (cur.anim && cur.anim.t0) { it.delay = performance.now() - cur.anim.t0; cur.anim.items.push(it); } else cur.anim = { items: [it], t0: 0 };
    } else if (on) {
      for (const t of g.userData.tubes) t.setDrawRange(0, Infinity);
      g.children.forEach(c => { c.visible = true; });
    }
    requestRender();
  }

  // Κατάσταση των νέων εξαρτημάτων από το ui.js: { buzz, servo: γωνία, rgb: [r,g,b], oled: [κείμενα] }
  function parts(st) {
    if (!cur) return;
    const o = cur.objs;
    if (o.buzzer) o.buzzer.userData.body.emissive.setHex(st.buzz ? 0x3a2a66 : 0);
    if (o.servo && typeof st.servo === 'number') o.servo.userData.arm.rotation.y = ((st.servo - 90) * Math.PI) / 180;
    if (o.rgb && st.rgb) {
      const [r, gg, b] = st.rgb;
      const lit = r + gg + b > 0;
      const m = o.rgb.userData.lens;
      m.color.setRGB(lit ? Math.max(0.25, r / 255) : 0.9, lit ? Math.max(0.25, gg / 255) : 0.93, lit ? Math.max(0.25, b / 255) : 0.95);
      m.emissive.setRGB(r / 255, gg / 255, b / 255);
      m.emissiveIntensity = lit ? 1.2 : 0;
    }
    if (o.oled && st.oled) { const sig = JSON.stringify(st.oled); if (sig !== o.oled.userData.sig) { o.oled.userData.sig = sig; o.oled.userData.draw(st.oled); } }
    requestRender();
  }

  root.IoTScene3D = {
    mount, unmount, requestRender, capture, orbit, wireVisible, parts,
    orbiting: () => !!(cur && cur.orbit && !(cur.orbit.tr && cur.orbit.tr.done)),
    spinning: () => !!(cur && cur.orbit && cur.orbit.auto),
    onState: f => { if (cur) cur.onState = f; }, info: () => cur && { W: cur.W, H: cur.H, live: cur.svg.isConnected, anim: !!cur.anim, orbit: cur.orbit && { yaw: +cur.orbit.yaw.toFixed(3), pitch: +cur.orbit.pitch.toFixed(3), tr: !!cur.orbit.tr, renders: cur.renders || 0 } } };
})(typeof window !== 'undefined' ? window : globalThis);
