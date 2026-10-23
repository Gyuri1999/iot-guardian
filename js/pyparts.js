/*
 * IoT Guardian — Python στο Raspberry Pi: buzzer, servo, LED RGB και οθόνη OLED.
 *   gpiozero          + Buzzer, TonalBuzzer, Servo, AngularServo, RGBLED
 *   gpiozero.tones    Tone (συχνότητα, νότα «A4» ή νούμερο MIDI)
 *   board, busio      pins και δίαυλος I2C (Adafruit Blinka)
 *   adafruit_ssd1306  SSD1306_I2C: fill, text, show
 * Η εικονική πλακέτα είναι η ίδια με του ESP32 (js/device.js): εδώ μόνο τα pins του Pi
 * αντιστοιχίζονται στα εξαρτήματα του πάγκου.
 */
(function (root) {
  'use strict';

  const PyM = root.IoTPy;
  const K = PyM.KIT;
  const { NONE, B, I, F, S, T, raise, builtin, truthy, numOf, typeName, pyStr, pyRepr, MODULES, HIGHLIGHT, NAME_HINTS } = K;

  // Pins του εικονικού Raspberry Pi (BCM) για τα νέα εξαρτήματα
  const PI = { BUZZER: 22, SERVO: 18, RGB: [5, 6, 13], SDA: 2, SCL: 3 };
  // Τα ίδια εξαρτήματα στην εικονική πλακέτα (αρίθμηση του js/device.js)
  const DEV = { RGB: [32, 33, 14] };
  const isNumV = v => v && (v.t === 'int' || v.t === 'float' || v.t === 'bool');
  const fmt = n => (Math.round(n * 100) / 100).toString();

  // ------------------------------------------------------------ Tone
  const NOTE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  function noteFreq(s) {
    const mm = /^([A-Ga-g])([#♯b♭]?)(-?\d)$/.exec(String(s).trim());
    if (!mm) return null;
    const semi = NOTE[mm[1].toUpperCase()] + (mm[2] === '#' || mm[2] === '♯' ? 1 : mm[2] ? -1 : 0) + (Number(mm[3]) - 4) * 12;
    return 440 * Math.pow(2, semi / 12);
  }
  const midiFreq = n => 440 * Math.pow(2, (n - 69) / 12);
  function makeTone(hz) {
    return {
      t: 'object', cls: 'Tone', hz,
      attr(n) {
        if (n === 'frequency') return F(hz);
        if (n === 'midi') return I(Math.round(69 + 12 * Math.log2(hz / 440)));
        return undefined;
      },
      short: () => `Tone · ${fmt(hz)} Hz`,
      repr: () => `<Tone frequency=${fmt(hz)}Hz>`,
      str: () => `${fmt(hz)}Hz`
    };
  }
  // Όπως το gpiozero: αριθμός ≥ 128 = συχνότητα σε Hz, 0–127 = νότα MIDI, κείμενο = νότα («A4», «C#5»)
  function toneOf(v, kw, line, board) {
    kw = kw || {};
    if (kw.frequency) return makeTone(numOf(kw.frequency));
    if (kw.midi) return makeTone(midiFreq(numOf(kw.midi)));
    if (kw.note) v = kw.note;
    if (!v || v.t === 'NoneType') raise('TypeError', 'Tone() needs a value', 'Γράψε π.χ. Tone(440.0) ή Tone("A4").', line);
    if (v.cls === 'Tone') return v;
    if (v.t === 'str') {
      const f = noteFreq(v.v);
      if (!f) raise('ValueError', `invalid note specification ${pyRepr(v)}`, 'Νότες: "C4", "D4", "E4", "F4", "G4", "A4", "B4" (με # για δίεση, π.χ. "C#5").', line);
      return makeTone(f);
    }
    if (isNumV(v)) {
      const n = numOf(v);
      if (n > 0 && n < 128) {
        if (board) board.warnOnce('tonemidi', line, `Το ${n} διαβάζεται ως νότα MIDI (${fmt(midiFreq(n))} Hz), όχι ως ${n} Hz.`, 'Για συχνότητα γράψε αριθμό από 128 και πάνω, π.χ. 440, ή Tone(frequency=…).');
        return makeTone(midiFreq(n));
      }
      if (n <= 0) raise('ValueError', 'invalid frequency', 'Η συχνότητα πρέπει να είναι θετική, π.χ. 440.', line);
      return makeTone(n);
    }
    raise('TypeError', `invalid tone ${typeName(v)}`, 'Γράψε π.χ. Tone(440.0) ή Tone("A4").', line);
  }

  // ------------------------------------------------------------ βοηθητικά
  function pinOf(a, kw, line, cls, want) {
    const v = a[0] || kw.pin;
    if (!v) raise('TypeError', `${cls}() missing required argument 'pin'`, `Γράψε τον αριθμό του GPIO, π.χ. ${cls}(${want}).`, line);
    if (v.t === 'str') { const mm = /^(?:GPIO|BCM)?(\d+)$/i.exec(v.v); if (mm) return Number(mm[1]); raise('ValueError', `invalid pin ${pyRepr(v)}`, '', line); }
    if (v.t === 'object' && v.cls === 'Pin') return v.id;
    if (v.t !== 'int') raise('TypeError', `pin must be an int, not ${typeName(v)}`, '', line);
    return v.v;
  }
  const numKw = (kw, k, d) => (kw[k] && kw[k].t !== 'NoneType' ? numOf(kw[k]) : d);
  function attrSetError(n, ln, hint) { raise('AttributeError', `can't set attribute '${n}'`, hint || '', ln); }

  // ------------------------------------------------------------ Buzzer (ενεργό: on/off, ένας τόνος ~2 kHz)
  function makeBuzzer(m, a, kw, line) {
    const pin = pinOf(a, kw, line, 'Buzzer', PI.BUZZER);
    const b = m.board;
    const wired = pin === PI.BUZZER;
    if (!wired) b.warnOnce('pibuz' + pin, line, `Στο GPIO ${pin} δεν είναι συνδεδεμένο buzzer στο εικονικό Raspberry Pi.`, `Το buzzer είναι στο GPIO ${PI.BUZZER}: Buzzer(${PI.BUZZER}).`);
    let state = 0;
    let beeper = null;
    const set = v => {
      state = v ? 1 : 0;
      if (!wired) return;
      if (state && b.buzzer.freq !== 2000) b.buzzer.tones.push({ t: b.micros, f: 2000, ms: null });
      b.buzzer.freq = state ? 2000 : 0;
      b.buzzer.until = null;
    };
    const stopBeep = () => { if (beeper) { m.blinkers = m.blinkers.filter(x => x !== beeper); beeper = null; } };
    const o = {
      t: 'object', cls: 'Buzzer', pin,
      attr(n) {
        switch (n) {
          case 'on': return builtin('on', () => { stopBeep(); set(1); return NONE; });
          case 'off': return builtin('off', () => { stopBeep(); set(0); return NONE; });
          case 'toggle': return builtin('toggle', () => { stopBeep(); set(!state); return NONE; });
          case 'beep': return builtin('beep', (m2, args, kwb) => {
            const on = numOf(args[0] || kwb.on_time || F(1));
            const off = numOf(args[1] || kwb.off_time || F(1));
            stopBeep();
            const start = b.micros;
            beeper = { update() { const per = (on + off) * 1e6; set((b.micros - start) % per < on * 1e6); } };
            m.blinkers.push(beeper);
            set(1);
            return NONE;
          });
          case 'close': return builtin('close', () => { stopBeep(); set(0); return NONE; });
          case 'is_active': return B(state === 1);
          case 'value': return I(state);
          case 'pin': return S('GPIO' + pin);
        }
        return undefined;
      },
      setattr(n, v, ln) { if (n === 'value') { stopBeep(); set(truthy(v)); return; } attrSetError(n, ln, 'Για ήχο γράψε buzzer.on().'); },
      short: () => `Buzzer(${pin}) · ${state ? 'βουίζει' : 'σιωπή'}`,
      repr: () => `<gpiozero.Buzzer object on pin GPIO${pin}, active_high=True, is_active=${state ? 'True' : 'False'}>`
    };
    return o;
  }

  // ------------------------------------------------------------ TonalBuzzer (παθητικό: παίζει νότες)
  function makeTonal(m, a, kw, line) {
    const pin = pinOf(a, kw, line, 'TonalBuzzer', PI.BUZZER);
    const b = m.board;
    const wired = pin === PI.BUZZER;
    if (!wired) b.warnOnce('pibuz' + pin, line, `Στο GPIO ${pin} δεν είναι συνδεδεμένο buzzer στο εικονικό Raspberry Pi.`, `Το buzzer είναι στο GPIO ${PI.BUZZER}: TonalBuzzer(${PI.BUZZER}).`);
    const mid = kw.mid_tone ? toneOf(kw.mid_tone, null, line, b).hz : 440;
    const octaves = numKw(kw, 'octaves', 1);
    const lo = mid / Math.pow(2, octaves);
    const hi = mid * Math.pow(2, octaves);
    let cur = null;
    const play = (tone, ln) => {
      if (tone && (tone.hz < lo - 0.5 || tone.hz > hi + 0.5)) {
        raise('ValueError', `tone ${fmt(tone.hz)}Hz is out of the device's range (${fmt(lo)}Hz - ${fmt(hi)}Hz)`, `Με octaves=${octaves} το buzzer παίζει από ${Math.round(lo)} έως ${Math.round(hi)} Hz. Για μεγαλύτερο εύρος γράψε TonalBuzzer(${pin}, octaves=2).`, ln);
      }
      cur = tone;
      if (!wired) return;
      const f = tone ? Math.round(tone.hz) : 0;
      if (f && f !== b.buzzer.freq) b.buzzer.tones.push({ t: b.micros, f, ms: null });
      b.buzzer.freq = f;
      b.buzzer.until = null;
    };
    return {
      t: 'object', cls: 'TonalBuzzer', pin,
      attr(n, ln) {
        switch (n) {
          case 'play': return builtin('play', (m2, args, kwb, l2) => { play(toneOf(args[0], kwb, l2 || ln, b), l2 || ln); return NONE; });
          case 'stop': return builtin('stop', () => { play(null, ln); return NONE; });
          case 'close': return builtin('close', () => { play(null, ln); return NONE; });
          case 'tone': return cur || NONE;
          case 'is_active': return B(!!cur);
          case 'min_tone': return makeTone(lo);
          case 'mid_tone': return makeTone(mid);
          case 'max_tone': return makeTone(hi);
          case 'octaves': return I(octaves);
          case 'pin': return S('GPIO' + pin);
        }
        return undefined;
      },
      setattr(n, v, ln) {
        if (n === 'tone') { play(v.t === 'NoneType' ? null : toneOf(v, null, ln, b), ln); return; }
        attrSetError(n, ln, 'Για νότα γράψε buzzer.play(Tone(440.0)).');
      },
      short: () => `TonalBuzzer(${pin}) · ${cur ? fmt(cur.hz) + ' Hz' : 'σιωπή'}`,
      repr: () => `<gpiozero.TonalBuzzer object on pin GPIO${pin}, is_active=${cur ? 'True' : 'False'}>`
    };
  }

  // ------------------------------------------------------------ Servo / AngularServo
  // Ο εικονικός servo γυρίζει 0°–180° για παλμούς 500–2500 µs (όπως στη MicroPython).
  function makeServo(m, a, kw, line, angular) {
    const cls = angular ? 'AngularServo' : 'Servo';
    const pin = pinOf(a, kw, line, cls, PI.SERVO);
    const b = m.board;
    const wired = pin === PI.SERVO;
    if (!wired) b.warnOnce('piservo' + pin, line, `Στο GPIO ${pin} δεν είναι συνδεδεμένο servo στο εικονικό Raspberry Pi.`, `Το servo είναι στο GPIO ${PI.SERVO}: ${cls}(${PI.SERVO}).`);
    const minPw = numKw(kw, 'min_pulse_width', 1 / 1000) * 1e6;
    const maxPw = numKw(kw, 'max_pulse_width', 2 / 1000) * 1e6;
    const minA = numKw(kw, 'min_angle', -90);
    const maxA = numKw(kw, 'max_angle', 90);
    let value = null;   // -1 … 1, None = χαλαρό
    const apply = ln => {
      if (!wired || value === null) return;
      const pulse = minPw + ((value + 1) / 2) * (maxPw - minPw);
      const ang = ((pulse - 500) / 2000) * 180;
      if (ang < -2 || ang > 182) b.warnOnce('servorange', ln, `Ο παλμός ${Math.round(pulse)} µs είναι έξω από τα όρια του servo (500–2500 µs).`, 'Γράψε min_pulse_width=0.0005, max_pulse_width=0.0025.');
      b.servo.attached = true;
      b.servo.angle = Math.max(0, Math.min(180, Math.round(ang)));
      b.servo.moves.push({ t: b.micros, angle: b.servo.angle });
    };
    const setValue = (v, ln) => {
      if (v !== null && (v < -1 - 1e-9 || v > 1 + 1e-9)) raise('ValueError', 'servo value must be between -1 and 1, or None', 'Το value παίρνει τιμές από -1 (μία άκρη) έως 1 (η άλλη άκρη). 0 = στη μέση.', ln);
      value = v;
      apply(ln);
    };
    const setAngle = (deg, ln) => {
      const lo = Math.min(minA, maxA), hi = Math.max(minA, maxA);
      if (deg < lo - 1e-9 || deg > hi + 1e-9) raise('ValueError', `AngularServo angle must be between ${fmt(lo)} and ${fmt(hi)}, or None`, `Με min_angle=${fmt(minA)} και max_angle=${fmt(maxA)} η γωνία πρέπει να είναι μέσα σε αυτά τα όρια.`, ln);
      setValue(((deg - minA) / (maxA - minA)) * 2 - 1, ln);
    };
    // αρχική θέση όπως το gpiozero: Servo → μέση, AngularServo → initial_angle (προεπιλογή 0)
    if (angular) { const ia = kw.initial_angle; if (!ia) setAngle(Math.max(Math.min(0, Math.max(minA, maxA)), Math.min(minA, maxA)), line); else if (ia.t !== 'NoneType') setAngle(numOf(ia), line); }
    else { const iv = kw.initial_value; if (!iv) setValue(0, line); else if (iv.t !== 'NoneType') setValue(numOf(iv), line); }
    const angleNow = () => (value === null ? NONE : F(minA + ((value + 1) / 2) * (maxA - minA)));
    return {
      t: 'object', cls, pin,
      attr(n, ln) {
        switch (n) {
          case 'min': return builtin('min', (m2, x, y, l2) => { setValue(-1, l2 || ln); return NONE; });
          case 'mid': return builtin('mid', (m2, x, y, l2) => { setValue(0, l2 || ln); return NONE; });
          case 'max': return builtin('max', (m2, x, y, l2) => { setValue(1, l2 || ln); return NONE; });
          case 'detach': case 'close': return builtin(n, () => { value = null; return NONE; });
          case 'value': return value === null ? NONE : F(value);
          case 'is_active': return B(value !== null);
          case 'angle': return angular ? angleNow() : undefined;
          case 'min_angle': return angular ? F(minA) : undefined;
          case 'max_angle': return angular ? F(maxA) : undefined;
          case 'pin': return S('GPIO' + pin);
        }
        return undefined;
      },
      setattr(n, v, ln) {
        if (n === 'value') { setValue(v.t === 'NoneType' ? null : numOf(v), ln); return; }
        if (n === 'angle' && angular) { if (v.t === 'NoneType') { value = null; return; } if (!isNumV(v)) raise('TypeError', `angle must be a number, not ${typeName(v)}`, 'Γράψε π.χ. servo.angle = 90', ln); setAngle(numOf(v), ln); return; }
        attrSetError(n, ln, n === 'angle' ? 'Το απλό Servo δεν έχει γωνία. Χρησιμοποίησε AngularServo ή γράψε servo.value = 0.' : '');
      },
      short: () => `${cls}(${pin}) · ${value === null ? 'χαλαρό' : angular ? `${fmt(numOf(angleNow()))}°` : `value ${fmt(value)}`}`,
      repr: () => `<gpiozero.${cls} object on pin GPIO${pin}, value=${value === null ? 'None' : fmt(value)}>`
    };
  }

  // ------------------------------------------------------------ RGBLED
  function makeRGB(m, a, kw, line) {
    const names = ['red', 'green', 'blue'];
    const pins = names.map((k, i) => {
      const v = a[i] || kw[k];
      if (!v) raise('TypeError', `RGBLED() missing required argument '${k}'`, `Γράψε RGBLED(red=${PI.RGB[0]}, green=${PI.RGB[1]}, blue=${PI.RGB[2]}).`, line);
      return pinOf([v], {}, line, 'RGBLED', PI.RGB[i]);
    });
    const b = m.board;
    const ok = pins.map((p, i) => p === PI.RGB[i]);
    if (!ok.every(Boolean)) b.warnOnce('pirgb', line, `Το LED RGB είναι στα GPIO ${PI.RGB.join(' / ')} (κόκκινο / πράσινο / μπλε)· έδωσες ${pins.join(' / ')}.`, `Γράψε RGBLED(red=${PI.RGB[0]}, green=${PI.RGB[1]}, blue=${PI.RGB[2]}).`);
    let col = [0, 0, 0];
    const apply = () => col.forEach((c, i) => { if (ok[i]) b.pwm[DEV.RGB[i]] = Math.round(c * 255); });
    const checkC = (v, ln, what) => {
      if (!isNumV(v)) raise('TypeError', `${what} must be a number, not ${typeName(v)}`, '', ln);
      const c = numOf(v);
      if (c < 0 || c > 1) raise('ValueError', 'each RGB color component must be between 0 and 1', `Στο gpiozero κάθε χρώμα πάει από 0 έως 1 (όχι 0–255). Για ${c} γράψε ${c > 1 ? fmt(Math.min(1, c / 255)) : 0}.`, ln);
      return c;
    };
    const setCol = (v, ln) => {
      if (!v || (v.t !== 'tuple' && v.t !== 'list') || v.v.length !== 3) raise('ValueError', 'color must be a tuple of 3 values', 'Γράψε π.χ. led.color = (1, 0, 0) για κόκκινο.', ln);
      col = v.v.map((x, i) => checkC(x, ln, names[i]));
      apply();
    };
    if (kw.initial_value) setCol(kw.initial_value, line); else apply();
    return {
      t: 'object', cls: 'RGBLED',
      attr(n, ln) {
        switch (n) {
          case 'on': return builtin('on', () => { col = [1, 1, 1]; apply(); return NONE; });
          case 'off': return builtin('off', () => { col = [0, 0, 0]; apply(); return NONE; });
          case 'toggle': return builtin('toggle', () => { col = col.map(c => 1 - c); apply(); return NONE; });
          case 'close': return builtin('close', () => { col = [0, 0, 0]; apply(); return NONE; });
          case 'color': case 'value': return T(col.map(c => (Number.isInteger(c) ? I(c) : F(c))));
          case 'red': case 'green': case 'blue': { const c = col[names.indexOf(n)]; return Number.isInteger(c) ? I(c) : F(c); }
          case 'is_active': case 'is_lit': return B(col.some(c => c > 0));
        }
        return undefined;
      },
      setattr(n, v, ln) {
        if (n === 'color' || n === 'value') { setCol(v, ln); return; }
        const i = names.indexOf(n);
        if (i >= 0) { col[i] = checkC(v, ln, n); apply(); return; }
        attrSetError(n, ln);
      },
      short: () => `RGBLED · (${col.map(fmt).join(', ')})`,
      repr: () => `<gpiozero.RGBLED object on pins (GPIO${pins[0]}, GPIO${pins[1]}, GPIO${pins[2]}), active_high=True, is_active=${col.some(c => c > 0) ? 'True' : 'False'}>`
    };
  }

  // ------------------------------------------------------------ gpiozero: προσθήκη των νέων κλάσεων
  const gpiozeroOrig = MODULES.gpiozero;
  MODULES.gpiozero = m => Object.assign(gpiozeroOrig(m), {
    Buzzer: builtin('Buzzer', (m2, a, kw, line) => makeBuzzer(m, a, kw, line)),
    TonalBuzzer: builtin('TonalBuzzer', (m2, a, kw, line) => makeTonal(m, a, kw, line)),
    Servo: builtin('Servo', (m2, a, kw, line) => makeServo(m, a, kw, line, false)),
    AngularServo: builtin('AngularServo', (m2, a, kw, line) => makeServo(m, a, kw, line, true)),
    RGBLED: builtin('RGBLED', (m2, a, kw, line) => makeRGB(m, a, kw, line)),
    Tone: builtin('Tone', (m2, a, kw, line) => toneOf(a[0], kw, line, m.board))
  });
  MODULES['gpiozero.tones'] = m => ({ Tone: builtin('Tone', (m2, a, kw, line) => toneOf(a[0], kw, line, m.board)) });

  // ------------------------------------------------------------ board, busio, adafruit_ssd1306
  const pinObj = id => ({ t: 'object', cls: 'Pin', id, attr: n => (n === 'id' ? I(id) : undefined), repr: () => `board.D${id}`, short: () => `GPIO ${id}` });
  function makeI2C(m, scl, sda, line) {
    if (!scl || !sda || scl.cls !== 'Pin' || sda.cls !== 'Pin') raise('TypeError', 'I2C() needs scl and sda pins', 'Γράψε busio.I2C(board.SCL, board.SDA).', line);
    const ok = scl.id === PI.SCL && sda.id === PI.SDA;
    if (!ok) m.board.warnOnce('pii2c', line, `Η οθόνη είναι στα SDA = GPIO ${PI.SDA} και SCL = GPIO ${PI.SCL}· έδωσες SDA ${sda.id}, SCL ${scl.id}.`, 'Γράψε busio.I2C(board.SCL, board.SDA).');
    return {
      t: 'object', cls: 'I2C', ok,
      attr(n) { if (n === 'scan') return builtin('scan', () => K.L(ok ? [I(60)] : [])); if (n === 'deinit' || n === 'unlock') return builtin(n, () => NONE); if (n === 'try_lock') return builtin(n, () => B(true)); return undefined; },
      short: () => `I2C · SDA ${sda.id} · SCL ${scl.id}${ok ? '' : ' (λάθος pins)'}`,
      repr: () => '<busio.I2C>'
    };
  }
  MODULES.board = m => {
    const out = { SDA: pinObj(PI.SDA), SCL: pinObj(PI.SCL), I2C: builtin('I2C', (m2, a, kw, line) => makeI2C(m, pinObj(PI.SCL), pinObj(PI.SDA), line)) };
    for (let n = 0; n <= 27; n++) out['D' + n] = pinObj(n);
    return out;
  };
  MODULES.busio = m => ({
    I2C: builtin('I2C', (m2, a, kw, line) => makeI2C(m, a[0] || kw.scl, a[1] || kw.sda, line))
  });
  MODULES.adafruit_ssd1306 = m => ({
    SSD1306_I2C: builtin('SSD1306_I2C', (m2, a, kw, line) => {
      const w = a[0] ? numOf(a[0]) : 128;
      const h = a[1] ? numOf(a[1]) : 64;
      const bus = a[2] || kw.i2c;
      if (!bus || bus.cls !== 'I2C') raise('TypeError', 'expecting an I2C object', 'Γράψε oled = adafruit_ssd1306.SSD1306_I2C(128, 64, i2c).', line);
      const b = m.board;
      if (w !== 128 || h !== 64) b.warnOnce('oledsize', line, `Η οθόνη μας είναι 128 × 64· έγραψες ${w} × ${h}.`, 'Γράψε SSD1306_I2C(128, 64, i2c).');
      b.oled.begun = !!bus.ok;
      return {
        t: 'object', cls: 'SSD1306_I2C',
        attr(name, ln) {
          switch (name) {
            case 'fill': return builtin('fill', (m3, args, kk, l2) => {
              if (!args.length) raise('TypeError', "fill() missing 1 required positional argument: 'color'", 'Γράψε oled.fill(0) για να σβήσεις την οθόνη.', l2 || ln);
              b.oled.buf = []; b.oled.pending = true; return NONE;
            });
            case 'text': return builtin('text', (m3, args, kk, l2) => {
              if (args.length < 4) raise('TypeError', "text() missing 1 required positional argument: 'color'", 'Στην Adafruit γράφεις και το χρώμα: oled.text("Γεια", 0, 0, 1).', l2 || ln);
              const txt = args[0].t === 'str' ? args[0].v : pyStr(args[0]);
              const x = numOf(args[1]);
              const y = numOf(args[2]);
              const size = Math.max(1, Math.min(4, Math.round(kk.size ? numOf(kk.size) : 1)));
              if (y + 8 * size > 64) b.warnOnce('oledfull', l2 || ln, `Το y=${y} είναι κάτω από την οθόνη (ύψος 64, κάθε γραμμή ${8 * size}).`, 'Γραμμές: y = 0, 10, 20, 30, 40, 50 (με size=2: 0, 20, 40).');
              if (numOf(args[3])) b.oled.buf.push({ x, y, size, text: String(txt) });
              b.oled.pending = true;
              return NONE;
            });
            case 'show': return builtin('show', () => { if (b.oled.begun) { b.oled.shown = b.oled.buf.slice(); b.oled.updates++; b.oled.pending = false; } return NONE; });
            case 'poweroff': case 'poweron': case 'contrast': case 'invert': case 'pixel': return builtin(name, () => NONE);
            case 'width': return I(w);
            case 'height': return I(h);
          }
          return undefined;
        },
        short: () => `SSD1306 · ${b.oled.shown.map(t => t.text).join(' / ') || 'κενή'}`,
        repr: () => '<adafruit_ssd1306.SSD1306_I2C>'
      };
    })
  });

  HIGHLIGHT.builtins.push('Buzzer', 'TonalBuzzer', 'Tone', 'Servo', 'AngularServo', 'RGBLED', 'busio', 'adafruit_ssd1306');
  Object.assign(NAME_HINTS, {
    Buzzer: 'Ξέχασες το from gpiozero import Buzzer;', TonalBuzzer: 'Ξέχασες το from gpiozero import TonalBuzzer;',
    Tone: 'Ξέχασες το from gpiozero.tones import Tone;', AngularServo: 'Ξέχασες το from gpiozero import AngularServo;',
    Servo: 'Ξέχασες το from gpiozero import Servo;', RGBLED: 'Ξέχασες το from gpiozero import RGBLED;',
    busio: 'Ξέχασες το import busio;', adafruit_ssd1306: 'Ξέχασες το import adafruit_ssd1306;'
  });

  PyM.PI_PARTS = PI;
})(typeof window !== 'undefined' ? window : globalThis);
