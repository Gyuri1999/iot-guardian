/*
 * IoT Guardian — «Δες πώς συνδέεται»: κινούμενη συναρμολόγηση πάνω στο σχέδιο του breadboard (bbview.js).
 * Ιδέα από τη «breadboard view» του Fritzing και τα καλώδια του Wokwi: η πλακέτα (ESP32 ή Pi) και το
 * breadboard φαίνονται μαζί και κάθε καλώδιο «ζωγραφίζεται» από το pin της πλακέτας ως την τρύπα του.
 * Σειρά, όπως στο αληθινό εργαστήριο: 1) η πλακέτα, 2) τα εξαρτήματα μπαίνουν στις τρύπες,
 * 3) τα καλώδια ένα-ένα (με λεζάντα), 4) το ρεύμα κυλά μία φορά.
 * Με «λιγότερη κίνηση» δεν παίζει κίνηση: δείχνει κατευθείαν το τελικό σχέδιο και όλες τις λεζάντες.
 */
(function (root) {
  'use strict';

  // Λεζάντα για κάθε καλώδιο: από ποιο pin, σε ποια στήλη, και τι άλλο είναι εκεί.
  function steps(view, labels) {
    const n = view.nets;
    const lab = w => (labels && labels[w.cls]) || 'της πλακέτας';
    const out = [];
    for (const w of n.wires) {
      if (!w.hole) continue;
      const leg = n.parts.flatMap(p => p.legs.map(l => ({ l, p }))).find(x => x.l.wire === w);
      const col = w.hole.i + 1;
      let text = `Καλώδιο από το pin ${lab(w)} → στήλη ${col} του breadboard.`;
      if (leg && leg.l.i === w.hole.i) text = `Καλώδιο από το pin ${lab(w)} → στήλη ${col}. Εκεί είναι το ${leg.l.label} ${leg.p.gen}, άρα ενώνονται.`;
      if (w.cls === 'w-gnd') text = `Καλώδιο από το GND της πλακέτας → στήλη ${col}. Από εκεί γυρίζει το ρεύμα πίσω στην πλακέτα.`;
      out.push({ w, text });
    }
    return out;
  }

  function play(host, view, opts) {
    opts = opts || {};
    const svg = host.querySelector('.bd-svg');
    const say = opts.say || (() => {});
    const motion = !opts.reducedMotion || !opts.reducedMotion();
    const list = steps(view, opts.labels);
    const timers = [];
    const anims = [];
    let stopped = false;
    const later = (ms, fn) => timers.push(setTimeout(() => { if (!stopped) fn(); }, ms));
    const anim = (el, kf, o) => { if (el && el.animate) { const a = el.animate(kf, Object.assign({ fill: 'both' }, o)); anims.push(a); return a; } return null; };

    if (!svg) return { stop() {}, steps: list };
    const groups = [...svg.querySelectorAll('.bd-wire')];
    const shown = view.nets.wires.filter(w => w.hole);
    const gOf = w => groups[shown.indexOf(w)];

    if (!motion) {
      say(list.map((x, k) => `${k + 1}. ${x.text}`).join(' '), true);
      if (opts.onEnd) opts.onEnd();
      return { stop() {}, steps: list };
    }

    svg.classList.add('bd-assembling');
    // 1. η πλακέτα ανεβαίνει από κάτω
    anim(svg.querySelector('.bd-mcu'), [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
    // τα καλώδια και οι στήλες κρύβονται μέχρι να έρθει η σειρά τους
    for (const g of groups) {
      const wl = g.querySelector('.bd-wline');
      anim(wl, [{ strokeDasharray: '1 1', strokeDashoffset: 1 }], { duration: 1 });
      anim(g.querySelector('.bd-plug'), [{ opacity: 0 }], { duration: 1 });
    }
    svg.querySelectorAll('.bd-col.used .bd-band').forEach(b => anim(b, [{ opacity: 0 }], { duration: 1 }));
    say('Πρώτα η πλακέτα. Τα pins της είναι οι ετικέτες κάτω από το breadboard.');
    if (opts.sfx) opts.sfx('click');

    // 2. τα εξαρτήματα πέφτουν στις τρύπες τους
    const parts = [...svg.querySelectorAll('.bd-part')];
    parts.forEach((p, k) => {
      anim(p, [{ transform: 'translateY(-28px)', opacity: 0 }, { transform: 'translateY(-28px)', opacity: 0, offset: 0.001 }], { duration: 1 });
      later(650 + k * 260, () => {
        anim(p, [{ transform: 'translateY(-28px)', opacity: 0 }, { transform: 'translateY(3px)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'ease-out' });
        if (opts.sfx) opts.sfx('tick');
      });
    });
    later(650, () => say('Μετά τα εξαρτήματα: τα πόδια τους μπαίνουν σε τρύπες του breadboard.'));

    // 3. τα καλώδια ένα-ένα, από το pin προς την τρύπα
    const t0 = 650 + parts.length * 260 + 500;
    const STEP = 1500;
    list.forEach((x, k) => {
      later(t0 + k * STEP, () => {
        const g = gOf(x.w);
        if (!g) return;
        g.classList.add('bd-now');
        anim(g.querySelector('.bd-wline'), [{ strokeDasharray: '1 1', strokeDashoffset: 1 }, { strokeDasharray: '1 1', strokeDashoffset: 0 }], { duration: 700, easing: 'cubic-bezier(.45,0,.2,1)' });
        anim(g.querySelector('.bd-tag'), [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-out' });
        later(680, () => {
          anim(g.querySelector('.bd-plug'), [{ opacity: 0, transform: 'scale(0.2)' }, { opacity: 1, transform: 'scale(1.4)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
          const band = svg.querySelector(`.bd-col.used[data-i="${x.w.hole.i}"] .bd-band`);
          anim(band, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
          if (opts.sfx) opts.sfx('tick');
        });
        later(STEP - 80, () => g.classList.remove('bd-now'));
        say(`${k + 1}/${list.length}. ${x.text}`);
      });
    });

    // 4. το ρεύμα κυλά μία φορά: από το pin, μέσα από το εξάρτημα, στο GND
    const tEnd = t0 + list.length * STEP + 200;
    later(tEnd, () => {
      groups.forEach(g => g.classList.add('on'));
      svg.querySelectorAll('.bd-col.used').forEach(c => c.classList.add('on'));
      const led = svg.querySelector('[data-part-led]');
      if (led) led.classList.add('lit');
      say('Έτοιμο! Όταν ο κώδικας ανάψει το pin, το ρεύμα κυλά: από το pin, μέσα από το εξάρτημα, στη γείωση (GND).');
      if (opts.sfx) opts.sfx('win');
    });
    later(tEnd + 2600, () => { finish(); if (opts.onEnd) opts.onEnd(); });

    function finish() {
      svg.classList.remove('bd-assembling');
      groups.forEach(g => g.classList.remove('bd-now', 'on'));
      svg.querySelectorAll('.bd-col.used.on').forEach(c => c.classList.remove('on'));
      const led = svg.querySelector('[data-part-led]');
      if (led) led.classList.remove('lit');
      anims.forEach(a => { try { a.cancel(); } catch (e) { /* ήδη τελείωσε */ } });
      anims.length = 0;
    }
    return {
      steps: list,
      stop() { if (stopped) return; stopped = true; timers.forEach(clearTimeout); finish(); }
    };
  }

  root.IoTBBAssemble = { steps, play };
})(typeof window !== 'undefined' ? window : globalThis);
