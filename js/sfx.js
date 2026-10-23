/*
 * IoT Guardian — μικροί ήχοι του παιχνιδιού, φτιαγμένοι με Web Audio (χωρίς αρχεία ήχου).
 *   click   πάτημα διακόπτη ή εισόδου
 *   tick    ένας στόχος της αποστολής έγινε
 *   win     η άσκηση ολοκληρώθηκε
 *   err     λάθος στον κώδικα
 *   bell    το κουδούνι της εισόδου
 * Ο ήχος μπαίνει μόνο μετά από ενέργεια του χρήστη (κανόνας των browsers) και σβήνει από τις Ρυθμίσεις.
 */
(function (root) {
  'use strict';

  let ctx = null;
  let enabled = true;
  const VOL = 0.12;

  function ac() {
    if (!enabled) return null;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) { try { ctx = new AC(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // Ένας τόνος: συχνότητα, αρχή (δευτερόλεπτα από τώρα), διάρκεια, μορφή κύματος, ένταση
  function tone(a, f, at, dur, type, vol, slideTo) {
    const t0 = a.currentTime + at;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime((vol || 1) * VOL, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  const SOUNDS = {
    click: a => tone(a, 880, 0, 0.05, 'square', 0.35),
    tick: a => { tone(a, 660, 0, 0.09, 'triangle', 0.8); tone(a, 990, 0.07, 0.12, 'triangle', 0.8); },
    win: a => { [523, 659, 784, 1047].forEach((f, i) => tone(a, f, i * 0.09, 0.22, 'triangle', 0.9)); tone(a, 1568, 0.38, 0.35, 'sine', 0.5); },
    err: a => { tone(a, 220, 0, 0.16, 'sawtooth', 0.45, 160); },
    bell: a => { tone(a, 1318, 0, 0.35, 'sine', 0.9); tone(a, 1046, 0.32, 0.5, 'sine', 0.9); }
  };

  function play(name) {
    const a = ac();
    if (!a || !SOUNDS[name]) return;
    try { SOUNDS[name](a); } catch (e) { /* ο ήχος δεν είναι κρίσιμος */ }
  }

  // Ο ήχος του buzzer όσο τρέχει το πρόγραμμα: συνεχής τόνος που αλλάζει συχνότητα (0 = σιωπή).
  let buzz = null;
  function buzzer(freq) {
    const f = Math.round(freq || 0);
    if (!f || !enabled) {
      if (buzz) { try { buzz.g.gain.setTargetAtTime(0.0001, buzz.a.currentTime, 0.01); buzz.o.stop(buzz.a.currentTime + 0.05); } catch (e) { /* ήδη σταματημένο */ } buzz = null; }
      return;
    }
    const a = ac();
    if (!a) return;
    if (!buzz) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'square';
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(VOL * 0.35, a.currentTime + 0.02);
      o.connect(g).connect(a.destination);
      o.start();
      buzz = { a, o, g, f: 0 };
    }
    if (buzz.f !== f) { buzz.o.frequency.setValueAtTime(Math.max(30, Math.min(8000, f)), buzz.a.currentTime); buzz.f = f; }
  }

  root.IoTSfx = { buzzer, play, setEnabled: on => { enabled = !!on; }, enabled: () => enabled };
})(typeof window !== 'undefined' ? window : globalThis);
