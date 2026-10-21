/*
 * IoT Guardian — θεματικό σκηνικό ανά μάθημα: ο πάγκος μπαίνει μέσα στον χώρο όπου θα δούλευε το κύκλωμα.
 *   desk      γραφείο με παράθυρο και φωτιστικό (το LED ανάβει το φωτιστικό)
 *   entrance  είσοδος σπιτιού με πόρτα, κουδούνι και φως εισόδου (κουμπί = κουδούνι)
 *   hallway   διάδρομος τη νύχτα, με γιαγιά που τη σέρνεις μπροστά στον αισθητήρα κίνησης
 * Το δωμάτιο ζωγραφίζεται σε δική του SVG πίσω από τα 3D εξαρτήματα. Τα «ηθοποιοί» (το ανθρωπάκι)
 * μπαίνουν στην κύρια SVG, για να μπορούν να σέρνονται. Όλα στην ίδια ισομετρική προβολή P(u, v, h).
 */
(function (root) {
  'use strict';

  const SC = () => root.IoTScene;
  const pt = p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const poly = (pts, cls) => `<polygon points="${pts.map(pt).join(' ')}" class="${cls}"/>`;

  // Ένας χώρος: πάτωμα, πίσω τοίχος (επίπεδο v = V0) και αριστερός τοίχος (επίπεδο u = U0).
  const U0 = -20;
  const V0 = -26;
  const U1 = 142;
  const V1 = 40;
  const WH = 32;

  function wallA(u0, u1, h0, h1, cls) { const P = SC().P; return poly([P(u0, V0, h0), P(u1, V0, h0), P(u1, V0, h1), P(u0, V0, h1)], cls); }
  function wallB(v0, v1, h0, h1, cls) { const P = SC().P; return poly([P(U0, v0, h0), P(U0, v1, h0), P(U0, v1, h1), P(U0, v0, h1)], cls); }
  function floorRect(u0, v0, u1, v1, cls) { const P = SC().P; return poly([P(u0, v0, 0), P(u1, v0, 0), P(u1, v1, 0), P(u0, v1, 0)], cls); }

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
    const lampU = 128;
    const lampV = -18;
    const glow = P(lampU, V0, 22);
    s += `<ellipse cx="${glow[0].toFixed(1)}" cy="${glow[1].toFixed(1)}" rx="46" ry="34" class="th-glow"/>`;
    const pool = P(lampU, lampV + 8, 0);
    s += `<ellipse cx="${pool[0].toFixed(1)}" cy="${pool[1].toFixed(1)}" rx="40" ry="16" class="th-pool"/>`;
    const b0 = P(lampU, lampV, 0);
    const b1 = P(lampU, lampV, 24);
    s += `<ellipse cx="${b0[0].toFixed(1)}" cy="${b0[1].toFixed(1)}" rx="8" ry="4" class="lamp-base"/>`;
    s += `<path d="M${pt(b0)} L${pt(b1)}" class="lamp-pole"/>`;
    s += `<path d="M${(b1[0] - 10).toFixed(1)},${(b1[1] + 6).toFixed(1)} L${(b1[0] - 5).toFixed(1)},${(b1[1] - 6).toFixed(1)} L${(b1[0] + 5).toFixed(1)},${(b1[1] - 6).toFixed(1)} L${(b1[0] + 10).toFixed(1)},${(b1[1] + 6).toFixed(1)} Z" class="lamp-shade"/>`;
    s += `<ellipse cx="${b1[0].toFixed(1)}" cy="${(b1[1] + 6).toFixed(1)}" rx="5" ry="2" class="lamp-bulb"/>`;
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
  const ZONE = { u0: 84, u1: 126, v0: V0 + 3, v1: -8 };
  function hallway() {
    const P = SC().P;
    let s = shell(true);
    s += floorRect(U0 + 4, V0 + 4, U1 - 6, V0 + 16, 'rm-runner');
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

  // Ιστορία και στόχος κάθε σκηνικού (οι στόχοι-τικ έρχονται από τους ελέγχους του μαθήματος).
  const THEMES = {
    desk: { bg: desk, story: 'Το γραφείο της Μαρίας είναι σκοτεινό. Το ESP32 θα ανάψει το φωτιστικό της, με κώδικα που γράφεις εσύ.' },
    entrance: { bg: entrance, story: 'Κάποιος χτυπά το κουδούνι της εισόδου! Το κουμπί είναι το κουδούνι και το LED το φως της εισόδου.' },
    hallway: { bg: hallway, story: 'Η γιαγιά περπατά στον διάδρομο τη νύχτα. Σύρε την μπροστά στον αισθητήρα: το φως πρέπει να ανάβει μόλις τη δει.', actor: true }
  };
  const BY_CHAPTER = { 1: 'desk', 2: 'entrance', 3: 'hallway' };

  function themeOf(lesson) {
    if (!lesson) return null;
    const key = lesson.theme || (lesson.lang && lesson.lang !== 'cpp' ? null : BY_CHAPTER[lesson.chapter]);
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
    bg.innerHTML = `<defs><radialGradient id="g-warm"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>${theme.bg()}`;
    wrap.insertBefore(bg, wrap.firstChild);
    // Το δωμάτιο ακολουθεί το ζουμ και τη μετακίνηση της κύριας σκηνής.
    const mo = new MutationObserver(() => bg.setAttribute('viewBox', svg.getAttribute('viewBox')));
    mo.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
    let actor = null;
    if (theme.actor) {
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
