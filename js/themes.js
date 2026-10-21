/*
 * IoT Guardian — θεματικό σκηνικό ανά μάθημα: ο πάγκος μπαίνει μέσα στον χώρο όπου θα δούλευε το κύκλωμα.
 *   desk      γραφείο με παράθυρο και φωτιστικό (το LED ανάβει το φωτιστικό)
 *   entrance  είσοδος σπιτιού με πόρτα, κουδούνι και φως εισόδου (κουμπί = κουδούνι)
 *   hallway   διάδρομος τη νύχτα, με γιαγιά που τη σέρνεις μπροστά στον αισθητήρα κίνησης
 *   workshop, greenhouse, livingroom, serverroom, garage για τα υπόλοιπα κεφάλαια (βλ. BY_CHAPTER)
 * Το δωμάτιο ζωγραφίζεται σε δική του SVG πίσω από τα 3D εξαρτήματα. Τα «ηθοποιοί» (το ανθρωπάκι)
 * μπαίνουν στην κύρια SVG, για να μπορούν να σέρνονται. Όλα στην ίδια ισομετρική προβολή P(u, v, h).
 */
(function (root) {
  'use strict';

  const SC = () => root.IoTScene;
  const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const poly = (pts, cls) => `<polygon points="${pts.map(pt).join(' ')}" class="${cls}"/>`;

  // Ένας χώρος: πάτωμα, πίσω τοίχος (επίπεδο v = V0) και αριστερός τοίχος (επίπεδο u = U0).
  // Όταν η σκηνή έχει router ή broker πίσω από την πλακέτα, οι τοίχοι πάνε πιο πίσω (setRoom).
  let U0 = -20;
  let V0 = -26;
  let U1 = 142;
  let V1 = 40;
  const WH = 32;
  function setRoom(deep, long) {
    U0 = deep ? -34 : -20;
    V0 = deep ? -66 : -26;
    U1 = deep ? 150 : 142;
    V1 = long ? 90 : 40;
  }

  function wallA(u0, u1, h0, h1, cls) { const P = SC().P; return poly([P(u0, V0, h0), P(u1, V0, h0), P(u1, V0, h1), P(u0, V0, h1)], cls); }
  function wallB(v0, v1, h0, h1, cls) { const P = SC().P; return poly([P(U0, v0, h0), P(U0, v1, h0), P(U0, v1, h1), P(U0, v0, h1)], cls); }
  function floorRect(u0, v0, u1, v1, cls) { const P = SC().P; return poly([P(u0, v0, 0), P(u1, v0, 0), P(u1, v1, 0), P(u0, v1, 0)], cls); }
  // Έπιπλο-κουτί: πάνω πλευρά και οι δύο πλευρές που βλέπουμε (προς +v και προς +u).
  function block(u, v, h, du, dv, dh, cls) {
    const P = SC().P;
    return `<g class="blk ${cls}">` +
      poly([P(u, v + dv, h), P(u + du, v + dv, h), P(u + du, v + dv, h + dh), P(u, v + dv, h + dh)], 'f-l') +
      poly([P(u + du, v, h), P(u + du, v + dv, h), P(u + du, v + dv, h + dh), P(u + du, v, h + dh)], 'f-r') +
      poly([P(u, v, h + dh), P(u + du, v, h + dh), P(u + du, v + dv, h + dh), P(u, v + dv, h + dh)], 'f-t') + '</g>';
  }
  // Κυκλικό αντικείμενο πάνω στον αριστερό τοίχο (ρολόι, θερμόμετρο)
  function discB(v, h, r, cls) {
    const P = SC().P;
    const pts = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; pts.push(P(U0, v + r * Math.cos(a), h + r * Math.sin(a))); }
    return poly(pts, cls);
  }
  function floorLamp(u, v) {
    const P = SC().P;
    let s = '';
    const glow = P(u, V0, 22);
    s += `<ellipse cx="${glow[0].toFixed(1)}" cy="${glow[1].toFixed(1)}" rx="46" ry="34" class="th-glow"/>`;
    const pool = P(u, v + 8, 0);
    s += `<ellipse cx="${pool[0].toFixed(1)}" cy="${pool[1].toFixed(1)}" rx="40" ry="16" class="th-pool"/>`;
    const b0 = P(u, v, 0);
    const b1 = P(u, v, 24);
    s += `<ellipse cx="${b0[0].toFixed(1)}" cy="${b0[1].toFixed(1)}" rx="8" ry="4" class="lamp-base"/>`;
    s += `<path d="M${pt(b0)} L${pt(b1)}" class="lamp-pole"/>`;
    s += `<path d="M${(b1[0] - 10).toFixed(1)},${(b1[1] + 6).toFixed(1)} L${(b1[0] - 5).toFixed(1)},${(b1[1] - 6).toFixed(1)} L${(b1[0] + 5).toFixed(1)},${(b1[1] - 6).toFixed(1)} L${(b1[0] + 10).toFixed(1)},${(b1[1] + 6).toFixed(1)} Z" class="lamp-shade"/>`;
    s += `<ellipse cx="${b1[0].toFixed(1)}" cy="${(b1[1] + 6).toFixed(1)}" rx="5" ry="2" class="lamp-bulb"/>`;
    return s;
  }

  function shell(night) {
    const P = SC().P;
    let s = `<g class="room${night ? ' night' : ''}">`;
    s += floorRect(U0, V0, U1, V1, 'rm-floor');
    // σανίδες πατώματος
    for (let v = V0 + 8; v < V1; v += 8) s += `<path d="M${pt(P(U0, v, 0))} L${pt(P(U1, v, 0))}" class="rm-plank"/>`;
    s += wallA(U0, U1, 0, WH, 'rm-wall-a') + wallB(V0, V1, 0, WH, 'rm-wall-b');
    // σοβατεπί και πάνω ακμή
    s += wallA(U0, U1, 0, 2.2, 'rm-base') + wallB(V0, V1, 0, 2.2, 'rm-base-b');
    s += `<path d="M${pt(P(U0, V1, WH))} L${pt(P(U0, V0, WH))} L${pt(P(U1, V0, WH))}" class="rm-edge"/>`;
    s += `<path d="M${pt(P(U0, V0, 0))} L${pt(P(U0, V0, WH))}" class="rm-edge"/>`;
    return s + '</g>';
  }

  // Κορνίζα στον πίσω τοίχο
  function frame(u, h, w, hh, inner) {
    let s = wallA(u, u + w, h, h + hh, 'rm-frame') + wallA(u + 1.2, u + w - 1.2, h + 1.2, h + hh - 1.2, inner || 'rm-art');
    return s;
  }

  // ------------------------------------------------------------ γραφείο
  function desk() {
    const P = SC().P;
    let s = shell(false);
    // παράθυρο στον αριστερό τοίχο, με ουρανό
    s += wallB(-20, -2, 11, 27, 'rm-wframe') + wallB(-18.8, -3.2, 12.2, 25.8, 'rm-sky');
    s += `<path d="M${pt(P(U0, -11, 12.2))} L${pt(P(U0, -11, 25.8))} M${pt(P(U0, -18.8, 19))} L${pt(P(U0, -3.2, 19))}" class="rm-wbar"/>`;
    const sun = P(U0, -6.5, 23);
    s += `<circle cx="${sun[0].toFixed(1)}" cy="${sun[1].toFixed(1)}" r="3.2" class="rm-moon"/>`;
    // ράφι και κορνίζες
    s += frame(22, 14, 16, 12, 'rm-art-a') + frame(44, 16, 9, 9, 'rm-art-b');
    // φωτιστικό στην πίσω-δεξιά γωνία: φως στον τοίχο όταν ανάβει το LED
    s += floorLamp(128, V0 + 8);
    return s;
  }

  // ------------------------------------------------------------ είσοδος
  function entrance() {
    const P = SC().P;
    let s = shell(false);
    // πόρτα με κάσα, πόμολο και τζαμάκι
    s += wallA(48, 68, 0, 27, 'rm-dframe') + wallA(49.6, 66.4, 0, 25.6, 'rm-door');
    s += wallA(53, 63, 18, 23, 'rm-dglass');
    const knob = P(64, V0, 12);
    s += `<circle cx="${knob[0].toFixed(1)}" cy="${knob[1].toFixed(1)}" r="1.6" class="rm-knob"/>`;
    // χαλάκι μπροστά στην πόρτα
    s += floorRect(48, V0 + 1, 68, V0 + 9, 'rm-mat');
    // φως εισόδου πάνω από την πόρτα (ανάβει με το LED)
    const lamp = P(58, V0, 29);
    s += `<ellipse cx="${lamp[0].toFixed(1)}" cy="${(lamp[1] + 14).toFixed(1)}" rx="40" ry="30" class="th-glow"/>`;
    s += wallA(55, 61, 27.5, 31.5, 'porch-lamp');
    s += wallA(56, 60, 28.2, 30.8, 'porch-bulb');
    // κουδούνι δίπλα στην πόρτα (ανάβει όταν πατιέται το κουμπί)
    s += wallA(72, 76, 11, 16, 'bell-plate');
    const bell = P(74, V0, 13.5);
    s += `<circle cx="${bell[0].toFixed(1)}" cy="${bell[1].toFixed(1)}" r="1.9" class="bell-btn"/>`;
    s += `<g class="bell-waves" transform="translate(${(bell[0] + 6).toFixed(1)},${(bell[1] - 2).toFixed(1)})"><path d="M0,-4 a5,5 0 0 1 0,8"/><path d="M3,-7 a9,9 0 0 1 0,14"/></g>`;
    // φυτό στη γωνία
    const pot = P(U0 + 6, V0 + 6, 0);
    s += `<path d="M${(pot[0] - 7).toFixed(1)},${(pot[1] - 14).toFixed(1)} L${(pot[0] + 7).toFixed(1)},${(pot[1] - 14).toFixed(1)} L${(pot[0] + 5).toFixed(1)},${pot[1].toFixed(1)} L${(pot[0] - 5).toFixed(1)},${pot[1].toFixed(1)} Z" class="rm-pot"/>`;
    s += `<path d="M${pot[0].toFixed(1)},${(pot[1] - 14).toFixed(1)} q-14,-18 -6,-34 M${pot[0].toFixed(1)},${(pot[1] - 14).toFixed(1)} q10,-16 4,-32 M${pot[0].toFixed(1)},${(pot[1] - 14).toFixed(1)} q2,-20 0,-38" class="rm-leaf"/>`;
    return s;
  }

  // ------------------------------------------------------------ διάδρομος τη νύχτα
  const ZONE = { u0: 84, u1: 126, v0: -23, v1: -8 };
  function hallway() {
    const P = SC().P;
    let s = shell(true);
    s += floorRect(U0 + 4, -22, U1 - 6, -10, 'rm-runner');
    s += frame(6, 13, 14, 13, 'rm-art-a') + frame(30, 15, 10, 10, 'rm-art-b');
    // πόρτα δωματίου στον αριστερό τοίχο
    s += wallB(2, 18, 0, 26, 'rm-dframe') + wallB(3.4, 16.6, 0, 24.6, 'rm-door');
    // φωτιστικό οροφής που ανάβει με το LED
    const top = P(105, V0 + 2, WH);
    s += `<path d="M${pt(P(84, V0, WH - 0.5))} L${pt(P(126, V0, WH - 0.5))} L${pt(P(126, -6, 0))} L${pt(P(84, -6, 0))} Z" class="th-cone"/>`;
    s += `<ellipse cx="${top[0].toFixed(1)}" cy="${(top[1] + 3).toFixed(1)}" rx="12" ry="4" class="ceil-lamp"/>`;
    s += `<ellipse cx="${top[0].toFixed(1)}" cy="${(top[1] + 18).toFixed(1)}" rx="54" ry="30" class="th-glow"/>`;
    // περιοχή που «βλέπει» ο αισθητήρας κίνησης
    s += floorRect(ZONE.u0, ZONE.v0, ZONE.u1, ZONE.v1, 'pir-zone');
    return s;
  }

  // Η γιαγιά (σέρνεται στον διάδρομο). u = θέση στον διάδρομο.
  function grandma(u) {
    const P = SC().P;
    const v = -16;
    const f = P(u, v, 0);
    const x = f[0];
    const y = f[1];
    return `<g class="actor" id="th-actor" data-u="${u}" tabindex="0" role="slider" aria-label="Γιαγιά στον διάδρομο: σύρε την ή πάτα τα βελάκια" aria-valuemin="-20" aria-valuemax="140" aria-valuenow="${Math.round(u)}">
      <ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="10" ry="4" class="actor-shadow"/>
      <path d="M${(x - 8).toFixed(1)},${(y - 2).toFixed(1)} L${(x - 5).toFixed(1)},${(y - 30).toFixed(1)} Q${x.toFixed(1)},${(y - 36).toFixed(1)} ${(x + 5).toFixed(1)},${(y - 30).toFixed(1)} L${(x + 8).toFixed(1)},${(y - 2).toFixed(1)} Z" class="actor-dress"/>
      <path d="M${(x - 5).toFixed(1)},${(y - 26).toFixed(1)} l-4,12 M${(x + 5).toFixed(1)},${(y - 26).toFixed(1)} l6,10" class="actor-arm"/>
      <path d="M${(x + 11).toFixed(1)},${(y - 16).toFixed(1)} L${(x + 13).toFixed(1)},${(y - 1).toFixed(1)}" class="actor-cane"/>
      <circle cx="${x.toFixed(1)}" cy="${(y - 40).toFixed(1)}" r="6.5" class="actor-head"/>
      <path d="M${(x - 6.5).toFixed(1)},${(y - 42).toFixed(1)} a6.5,6.5 0 0 1 13,0 q-6.5,-5 -13,0 Z" class="actor-hair"/>
      <circle cx="${(x + 1).toFixed(1)}" cy="${(y - 49).toFixed(1)}" r="3" class="actor-hair"/>
      <g class="actor-tip" transform="translate(${x.toFixed(1)},${(y - 58).toFixed(1)})"><rect x="-30" y="-8" width="60" height="14" rx="4"/><text x="0" y="2.5" text-anchor="middle">↔ σύρε με</text></g>
    </g>`;
  }
  const inZone = u => u >= ZONE.u0 - 4 && u <= ZONE.u1 + 4;

  // ------------------------------------------------------------ εργαστήρι (συναρτήσεις, χρόνος)
  function workshop() {
    const P = SC().P;
    let s = shell(false);
    // πίνακας με τρύπες για τα εργαλεία
    s += wallA(8, 58, 9, 27, 'rm-peg');
    for (let u = 11; u < 57; u += 4) for (let h = 11; h < 26; h += 4) { const q = P(u, V0, h); s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="0.7" class="rm-peg-hole"/>`; }
    const t1 = P(16, V0, 22);
    const t2 = P(30, V0, 23);
    const t3 = P(44, V0, 22);
    s += `<path d="M${pt(t1)} l0,18 M${(t1[0] - 3).toFixed(1)},${t1[1].toFixed(1)} a3,3 0 1 1 6,0" class="rm-tool"/>`;
    s += `<path d="M${pt(t2)} l6,14" class="rm-tool rm-tool-r"/><path d="M${(t2[0] + 6).toFixed(1)},${(t2[1] + 14).toFixed(1)} l2,6" class="rm-tool"/>`;
    s += `<path d="M${pt(t3)} l-5,16 m5,-16 l5,16" class="rm-tool"/>`;
    // ρολόι στον αριστερό τοίχο: millis() και delay()
    s += discB(-10, 20, 6, 'rm-clock');
    const c = P(U0, -10, 20);
    s += `<path d="M${pt(c)} l0,-5 M${pt(c)} l4,1" class="rm-hands"/>`;
    // πάγκος στον πίσω τοίχο, με λάμπα εργασίας από πάνω
    s += block(72, V0 + 1, 0, 60, 10, 12, 'rm-bench');
    s += block(80, V0 + 2, 12, 10, 6, 5, 'rm-crate') + block(94, V0 + 2, 12, 8, 6, 3, 'rm-crate b');
    const lamp = P(110, V0 + 6, WH);
    const lb = P(110, V0 + 6, 22);
    s += `<path d="M${pt(lamp)} L${pt(lb)}" class="lamp-pole thin"/>`;
    s += `<ellipse cx="${lb[0].toFixed(1)}" cy="${(lb[1] + 12).toFixed(1)}" rx="40" ry="26" class="th-glow"/>`;
    s += `<path d="M${(lb[0] - 9).toFixed(1)},${(lb[1] + 6).toFixed(1)} L${(lb[0] - 4).toFixed(1)},${lb[1].toFixed(1)} L${(lb[0] + 4).toFixed(1)},${lb[1].toFixed(1)} L${(lb[0] + 9).toFixed(1)},${(lb[1] + 6).toFixed(1)} Z" class="lamp-shade"/>`;
    s += `<ellipse cx="${lb[0].toFixed(1)}" cy="${(lb[1] + 6).toFixed(1)}" rx="5" ry="1.8" class="lamp-bulb"/>`;
    return s;
  }

  // ------------------------------------------------------------ θερμοκήπιο (θερμοκρασία, υγρασία)
  function greenhouse() {
    const P = SC().P;
    let s = shell(false).replace('class="room"', 'class="room glass"');
    // τζάμια: κάθετα δοκάρια στους δύο τοίχους
    for (let u = U0 + 16; u < U1; u += 16) s += `<path d="M${pt(P(u, V0, 2.2))} L${pt(P(u, V0, WH))}" class="rm-mullion"/>`;
    for (let v = V0 + 16; v < V1; v += 16) s += `<path d="M${pt(P(U0, v, 2.2))} L${pt(P(U0, v, WH))}" class="rm-mullion"/>`;
    s += `<path d="M${pt(P(U0, V0, 18))} L${pt(P(U1, V0, 18))} M${pt(P(U0, V0, 18))} L${pt(P(U0, V1, 18))}" class="rm-mullion"/>`;
    // ράφι με γλάστρες στον πίσω τοίχο
    s += block(10, V0 + 1, 0, 120, 8, 7, 'rm-bench');
    for (let u = 16; u < 128; u += 14) {
      const g = P(u, V0 + 5, 7);
      s += `<path d="M${(g[0] - 4).toFixed(1)},${(g[1] - 8).toFixed(1)} L${(g[0] + 4).toFixed(1)},${(g[1] - 8).toFixed(1)} L${(g[0] + 3).toFixed(1)},${g[1].toFixed(1)} L${(g[0] - 3).toFixed(1)},${g[1].toFixed(1)} Z" class="rm-pot"/>`;
      s += `<path d="M${g[0].toFixed(1)},${(g[1] - 8).toFixed(1)} q-8,-8 -3,-17 M${g[0].toFixed(1)},${(g[1] - 8).toFixed(1)} q6,-7 2,-16" class="rm-leaf thin"/>`;
    }
    // μεγάλο θερμόμετρο στον αριστερό τοίχο: γεμίζει κόκκινο όταν ανάβει ο συναγερμός (LED)
    s += wallB(-14, -8, 6, 28, 'rm-thermo');
    s += wallB(-12, -10, 8, 18, 'rm-thermo-lvl') + wallB(-12, -10, 18, 26, 'rm-thermo-hot');
    s += discB(-11, 7, 3, 'rm-thermo-bulb');
    // ανεμιστήρας στη γωνία
    const f = P(U0 + 4, 20, 14);
    s += `<g class="rm-fan" transform="translate(${f[0].toFixed(1)},${f[1].toFixed(1)})"><circle r="9"/><path d="M0,0 L0,-8 M0,0 L7,4 M0,0 L-7,4"/></g>`;
    // λάμπα ανάπτυξης πάνω από το ράφι
    const top = P(70, V0 + 4, WH - 2);
    s += `<path d="M${pt(P(30, V0 + 4, WH - 2))} L${pt(P(110, V0 + 4, WH - 2))}" class="grow-bar"/>`;
    s += `<ellipse cx="${top[0].toFixed(1)}" cy="${(top[1] + 20).toFixed(1)}" rx="70" ry="30" class="th-glow"/>`;
    return s;
  }

  // ------------------------------------------------------------ σαλόνι (WiFi, εντολές λάμπας, web)
  function livingroom() {
    const P = SC().P;
    let s = shell(false);
    s += floorRect(70, V0 + 12, 130, V0 + 34, 'rm-rug');
    // παράθυρο με κουρτίνες στον πίσω τοίχο
    s += wallA(18, 46, 11, 27, 'rm-wframe') + wallA(19.4, 44.6, 12.4, 25.6, 'rm-sky');
    s += wallA(14, 20, 9, 29, 'rm-curtain') + wallA(44, 50, 9, 29, 'rm-curtain');
    // καναπές
    s += block(72, V0 + 1, 0, 50, 12, 8, 'rm-sofa') + block(72, V0 + 1, 8, 50, 4, 8, 'rm-sofa');
    s += block(74, V0 + 5, 8, 22, 7, 2, 'rm-cushion') + block(98, V0 + 5, 8, 22, 7, 2, 'rm-cushion');
    // τηλεόραση στον αριστερό τοίχο
    s += wallB(4, 30, 12, 26, 'rm-tv') + wallB(5.2, 28.8, 13.2, 24.8, 'rm-tv-screen');
    s += floorLamp(136, V0 + 8);
    return s;
  }

  // ------------------------------------------------------------ δωμάτιο servers (δίκτυο, ασφάλεια)
  function serverroom() {
    const P = SC().P;
    let s = shell(true);
    for (let u = U0 + 12; u < U1; u += 12) s += `<path d="M${pt(P(u, V0, 0))} L${pt(P(u, V1, 0))}" class="rm-tile"/>`;
    // σχάρα καλωδίων στο ταβάνι
    s += `<path d="M${pt(P(U0, V0 + 4, WH - 2))} L${pt(P(U1, V0 + 4, WH - 2))}" class="rm-tray"/>`;
    // ράφια (racks) με λαμπάκια· το «st» ανάβει πράσινο με το LED
    const racks = [8, 28, 92, 112];
    racks.forEach((u, i) => {
      s += block(u, V0 + 1, 0, 16, 12, 28, 'rm-rack');
      for (let h = 4; h < 26; h += 4) {
        s += `<path d="M${pt(P(u + 1.5, V0 + 13, h))} L${pt(P(u + 14.5, V0 + 13, h))}" class="rm-rack-line"/>`;
        const d = P(u + 12.5, V0 + 13, h + 1.6);
        s += `<circle cx="${d[0].toFixed(1)}" cy="${d[1].toFixed(1)}" r="0.9" class="rack-led${(h + i) % 3 ? '' : ' st'}" style="animation-delay:${((h * 7 + i * 3) % 10) / 10}s"/>`;
      }
    });
    // πινακίδα με ασπίδα στον αριστερό τοίχο
    s += wallB(-6, 10, 14, 26, 'rm-sign');
    const c = P(U0, 2, 20);
    s += `<path d="M${c[0].toFixed(1)},${(c[1] - 5).toFixed(1)} l4.5,1.6 v3.4 q0,3.6 -4.5,5.4 q-4.5,-1.8 -4.5,-5.4 v-3.4 Z" class="rm-shield"/>`;
    const top = P(66, V0 + 2, WH);
    s += `<ellipse cx="${top[0].toFixed(1)}" cy="${(top[1] + 18).toFixed(1)}" rx="54" ry="30" class="th-glow cool"/>`;
    return s;
  }

  // ------------------------------------------------------------ γκαράζ (απόσταση, φανάρι)
  function garage() {
    const P = SC().P;
    let s = shell(false).replace('class="room"', 'class="room concrete"');
    // ρολό γκαράζ στον πίσω τοίχο
    s += wallA(14, 66, 0, 26, 'rm-gdoor-frame') + wallA(15.4, 64.6, 0, 24.6, 'rm-gdoor');
    for (let h = 3; h < 24.6; h += 3) s += `<path d="M${pt(P(15.4, V0, h))} L${pt(P(64.6, V0, h))}" class="rm-slat"/>`;
    // γραμμές στάθμευσης και κίτρινο-μαύρο σταμάτημα πριν τον αισθητήρα
    s += floorRect(96, 16, 97.4, V1 - 4, 'rm-pline') + floorRect(122, 16, 123.4, V1 - 4, 'rm-pline');
    for (let u = 98; u < 121; u += 4) s += floorRect(u, 13, u + 2, 15, 'rm-stop');
    // ράφι με λάστιχα και κουτιά στον αριστερό τοίχο
    s += block(U0 + 1, 0, 0, 10, 26, 16, 'rm-shelf');
    s += block(U0 + 2, 2, 16, 8, 9, 6, 'rm-crate') + block(U0 + 2, 14, 16, 8, 9, 4, 'rm-crate b');
    const tyre = P(80, V0 + 7, 0);
    s += `<ellipse cx="${tyre[0].toFixed(1)}" cy="${(tyre[1] - 3).toFixed(1)}" rx="11" ry="5.5" class="rm-tyre"/><ellipse cx="${tyre[0].toFixed(1)}" cy="${(tyre[1] - 9).toFixed(1)}" rx="11" ry="5.5" class="rm-tyre"/><ellipse cx="${tyre[0].toFixed(1)}" cy="${(tyre[1] - 9).toFixed(1)}" rx="4" ry="2" class="rm-tyre-in"/>`;
    // λάμπα γκαράζ
    const top = P(104, V0 + 2, WH - 1);
    s += `<path d="M${pt(P(92, V0 + 2, WH - 1))} L${pt(P(116, V0 + 2, WH - 1))}" class="grow-bar"/>`;
    s += `<ellipse cx="${top[0].toFixed(1)}" cy="${(top[1] + 18).toFixed(1)}" rx="50" ry="28" class="th-glow"/>`;
    return s;
  }

  // Ιστορία και στόχος κάθε σκηνικού (οι στόχοι-τικ έρχονται από τους ελέγχους του μαθήματος).
  const THEMES = {
    desk: { bg: desk, story: 'Το γραφείο της Μαρίας είναι σκοτεινό. Το ESP32 θα ανάψει το φωτιστικό της, με κώδικα που γράφεις εσύ.' },
    entrance: { bg: entrance, story: 'Κάποιος χτυπά το κουδούνι της εισόδου! Το κουμπί είναι το κουδούνι και το LED το φως της εισόδου.' },
    hallway: { bg: hallway, story: 'Η γιαγιά περπατά στον διάδρομο τη νύχτα. Σύρε την μπροστά στον αισθητήρα: το φως πρέπει να ανάβει μόλις τη δει.', actor: true },
    workshop: { bg: workshop, story: 'Στο εργαστήρι του θείου Νίκου όλα έχουν τη θέση τους. Φτιάξε κι εσύ τα δικά σου «εργαλεία»: συναρτήσεις που κάνουν μία δουλειά, σωστά και στην ώρα τους.' },
    greenhouse: { bg: greenhouse, story: 'Τα φυτά στο θερμοκήπιο δεν αντέχουν πολλή ζέστη. Διάβασε σωστά τον αισθητήρα και δώσε προειδοποίηση μόνο όταν πρέπει.' },
    livingroom: { bg: livingroom, story: 'Στο σαλόνι όλα είναι συνδεδεμένα: το router, η λάμπα, το tablet. Κάνε τη συσκευή να συνδέεται σωστά και να ακούει μόνο τις σωστές εντολές.' },
    serverroom: { bg: serverroom, story: 'Το μικρό δωμάτιο με τα servers του σπιτιού. Εδώ ζουν ο broker και τα δεδομένα: φρόντισε να μπαίνει μόνο όποιος πρέπει.' },
    garage: { bg: garage, story: 'Το αυτοκίνητο μπαίνει στο γκαράζ. Μέτρησε την απόσταση και δείξε με το φανάρι πότε πρέπει να σταματήσει, πριν ακουμπήσει τον τοίχο.' }
  };
  // Κεφάλαιο → σκηνικό, για όλες τις γλώσσες (C++, Python στο Pi, MicroPython, Rust).
  const BY_CHAPTER = {
    1: 'desk', 2: 'entrance', 3: 'hallway', 4: 'workshop', 5: 'greenhouse', 6: 'livingroom', 7: 'hallway', 8: 'greenhouse',
    9: 'serverroom', 10: 'serverroom', 11: 'serverroom', 12: 'serverroom', 13: 'livingroom', 14: 'serverroom', 15: 'hallway', 16: 'hallway',
    17: 'desk', 18: 'entrance', 19: 'greenhouse', 20: 'greenhouse', 21: 'serverroom', 22: 'livingroom', 23: 'serverroom', 24: 'garage',
    30: 'desk', 31: 'entrance', 32: 'greenhouse', 33: 'livingroom', 34: 'greenhouse', 35: 'garage',
    41: 'desk', 42: 'entrance', 43: 'workshop', 44: 'hallway', 45: 'garage', 46: 'workshop',
    51: 'desk', 52: 'entrance', 53: 'workshop', 54: 'hallway', 55: 'garage', 56: 'workshop'
  };

  function themeOf(lesson) {
    if (!lesson) return null;
    const key = lesson.theme || BY_CHAPTER[lesson.chapter];
    return key && THEMES[key] ? Object.assign({ key }, THEMES[key]) : null;
  }

  // Δημιουργεί τη SVG του δωματίου πίσω από τη σκηνή και (αν χρειάζεται) τον «ηθοποιό» μέσα στην κύρια SVG.
  // onPir(true/false): καλείται όταν η γιαγιά μπαίνει ή βγαίνει από την περιοχή του αισθητήρα.
  function mount(wrap, svg, theme, opts) {
    opts = opts || {};
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    bg.setAttribute('class', `scene-bg theme-${theme.key}`);
    bg.setAttribute('aria-hidden', 'true');
    bg.setAttribute('viewBox', svg.getAttribute('viewBox'));
    // πόσο βαθύ/μακρύ δωμάτιο χρειάζεται η σκηνή (router/broker πίσω, αυτοκινητάκι μπροστά)
    const back = svg.querySelector('.sc-back');
    setRoom(!!(back && back.childElementCount), !!svg.querySelector('#sc-car-move'));
    bg.innerHTML = `<defs><radialGradient id="g-warm"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient><radialGradient id="g-cool"><stop offset="0" stop-color="#5fe0a0" stop-opacity="0.7"/><stop offset="1" stop-color="#5fe0a0" stop-opacity="0"/></radialGradient></defs>${theme.bg()}`;
    wrap.insertBefore(bg, wrap.firstChild);
    // Το δωμάτιο ακολουθεί το ζουμ και τη μετακίνηση της κύριας σκηνής.
    const mo = new MutationObserver(() => bg.setAttribute('viewBox', svg.getAttribute('viewBox')));
    mo.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
    let actor = null;
    // η γιαγιά μόνο όταν στη σκηνή υπάρχει αισθητήρας κίνησης
    if (theme.actor && svg.querySelector('[data-part="pir"]')) {
      const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      layer.setAttribute('class', 'sc-actors');
      svg.appendChild(layer);
      let u = opts.pir ? 104 : 20;
      const draw = () => { layer.innerHTML = grandma(u); actor = layer.firstElementChild; };
      draw();
      const setU = nu => {
        const was = inZone(u);
        u = Math.max(-20, Math.min(140, nu));
        draw();
        if (inZone(u) !== was && opts.onPir) opts.onPir(inZone(u));
      };
      let drag = null;
      layer.addEventListener('pointerdown', e => {
        if (!e.target.closest('.actor')) return;
        e.stopPropagation();
        drag = { x: e.clientX, u };
        layer.setPointerCapture(e.pointerId);
        layer.classList.add('dragging');
      });
      layer.addEventListener('pointermove', e => {
        if (!drag) return;
        // οριζόντια κίνηση στην οθόνη → κίνηση κατά μήκος του διαδρόμου (άξονας u)
        const r = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const k = vb.width / r.width;
        const du = ((e.clientX - drag.x) * k) / (Math.cos(Math.PI / 6) * SC().K);
        setU(drag.u + du);
      });
      const end = () => { drag = null; layer.classList.remove('dragging'); };
      layer.addEventListener('pointerup', end);
      layer.addEventListener('pointercancel', end);
      layer.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setU(u + (e.key === 'ArrowRight' ? 8 : -8)); layer.querySelector('.actor').focus(); }
      });
      layer.addEventListener('click', e => e.stopPropagation());
      if (opts.onPir && inZone(u) !== !!opts.pir) opts.onPir(inZone(u));
    }
    return { bg, update: st => { bg.classList.toggle('led-on', !!st.led); bg.classList.toggle('btn-on', !!st.button); bg.classList.toggle('pir-on', !!st.pir); }, hide: h => { bg.style.visibility = h ? 'hidden' : ''; }, actor: () => actor };
  }

  root.IoTThemes = { themeOf, mount, THEMES };
})(typeof window !== 'undefined' ? window : globalThis);
