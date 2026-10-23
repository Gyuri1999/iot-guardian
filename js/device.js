/*
 * IoT Guardian — εικονική πλακέτα τύπου ESP32.
 * Γενικό εκπαιδευτικό μοντέλο: δεν εξομοιώνει πλήρως το πραγματικό chip.
 * Pin map (εικονικό): LED → GPIO 2, Button → GPIO 15, PIR → GPIO 4.
 */
(function (root) {
  'use strict';

  const PINS = { LED: 2, BUTTON: 15, PIR: 4, TRIG: 5, ECHO: 18, RED: 25, YELLOW: 26, GREEN: 27, BUZZER: 23, SERVO: 19, RGB_R: 32, RGB_G: 33, RGB_B: 14 };
  const MODE_NAMES = { 1: 'INPUT', 3: 'OUTPUT', 5: 'INPUT_PULLUP' };
  const PIN_LABELS = { 23: 'buzzer (GPIO 23)', 19: 'servo (GPIO 19)', 32: 'κόκκινο του LED RGB (GPIO 32)', 33: 'πράσινο του LED RGB (GPIO 33)', 14: 'μπλε του LED RGB (GPIO 14)', 2: 'LED (GPIO 2)', 15: 'κουμπί (GPIO 15)', 4: 'PIR (GPIO 4)', 5: 'TRIG του HC-SR04 (GPIO 5)', 18: 'ECHO του HC-SR04 (GPIO 18)', 25: 'κόκκινο φως (GPIO 25)', 26: 'κίτρινο φως (GPIO 26)', 27: 'πράσινο φως (GPIO 27)' };
  const INPUT_PINS = new Set([15, 4, 18]);
  // Ενδεικτικό ρεύμα του ESP32 σε κάθε κατάσταση (mA). Πραγματικές τιμές διαφέρουν ανά πλακέτα.
  const POWER_MA = { active: 40, wifi: 120, light: 0.8, deep: 0.01 };

  function err(message, line, hint) {
    return new root.IoTInterp.CodeError(message, line, hint);
  }

  class Board {
    constructor(world) {
      world = world || {};
      this.micros = 0;
      this.inputs = { button: !!world.button, pir: !!world.pir };
      this.modes = {};
      this.outputs = {};
      this.serial = [];
      this.partial = null;
      this.serialStarted = false;
      this.warnings = [];
      this.warned = new Set();
      this.seq = 0;
      this.initWorld(world);
    }

    get led() { return this.modes[PINS.LED] === 3 && this.outputs[PINS.LED] === 1; }
    // Φανάρι: ένα φως ανάβει μόνο αν το pin του είναι OUTPUT και HIGH.
    light(pin) { return this.modes[pin] === 3 && this.outputs[pin] === 1; }
    get millis() { return Math.floor(this.micros / 1000); }
    modeName(pin) { return MODE_NAMES[this.modes[pin]] || null; }
    // Κάθε πέρασμα χρόνου χρεώνεται στην «μπαταρία» με το ρεύμα της τρέχουσας κατάστασης.
    advanceMicros(us) {
      if (this.energy) {
        const st = this.powerState();
        this.energy.mAus += POWER_MA[st] * us;
        this.energy.us += us;
        this.energy.byState[st] += us;
      }
      this.micros += us;
    }

    // Κατάσταση ενέργειας: deep, light, wifi (ραδιόφωνο ενεργό) ή active (μόνο επεξεργαστής).
    powerState() {
      if (this.sleep) return this.sleep.mode;
      const w = this.wifi;
      if (w && w.mode !== 0 && (w.status === 3 || w.pending)) return 'wifi';
      return 'active';
    }
    currentMa() { return POWER_MA[this.powerState()]; }
    avgMa() { return this.energy.us ? this.energy.mAus / this.energy.us : 0; }
    usedMah() { return this.energy.mAus / 3.6e9; }

    checkWakeSources(line, mode) {
      if (this.wake.timerUs === null && !this.wake.ext0) {
        throw err(`Η πλακέτα μπαίνει σε ${mode === 'deep' ? 'deep' : 'light'} sleep χωρίς τρόπο να ξυπνήσει.`, line,
          'Πριν από τον ύπνο ρύθμισε πηγή αφύπνισης: esp_sleep_enable_timer_wakeup(10000000); (10 δευτερόλεπτα) ή esp_sleep_enable_ext0_wakeup(PIR_PIN, HIGH);');
      }
    }

    goToSleep(mode) {
      // Στο μοντέλο, ο ύπνος κλείνει το ραδιόφωνο: η σύνδεση WiFi (και το MQTT) χάνεται.
      if (this.wifi.status === 3 || this.wifi.pending) {
        this.wifi.status = 6;
        this.wifi.pending = null;
        if (this.net) this.net.dropClient('device', mode + ' sleep');
      }
      if (this.partial) { this.partial.open = false; this.partial = null; }
      this.sleep = { mode, since: this.micros };
    }

    wakeUp(cause) {
      this.wakeups.push({ t: this.micros / 1000, mode: this.sleep.mode, cause, sleptMs: (this.micros - this.sleep.since) / 1000 });
      if (this.wakeups.length > 200) this.wakeups.shift();
      this.sleep = null;
      this.wakeCause = cause;
    }

    // Μετά από deep sleep: όλα ξεκινούν από την αρχή (pins, WiFi, MQTT, πηγές αφύπνισης).
    resetForBoot() {
      this.boots++;
      this.modes = {};
      this.outputs = {};
      this.serialStarted = false;
      this.wifi.status = 0;
      this.wifi.pending = null;
      this.wifi.creds = null;
      this.wifi.mode = 1;
      this.mqtt.host = null;
      this.mqtt.tlsMode = 'none';
      this.mqtt.current = null;
      if (this.net) this.net.dropClient('device', 'reboot');
      this.wake = { timerUs: null, ext0: null };
      this.initParts();
    }

    warnOnce(key, line, text, hint) {
      if (this.warned.has(key)) return;
      this.warned.add(key);
      this.warnings.push({ line, text, hint: hint || '' });
    }

    pinMode(pin, mode, line) {
      if (!MODE_NAMES[mode]) throw err(`Η τιμή ${mode} δεν είναι έγκυρη λειτουργία pin.`, line, 'Χρησιμοποίησε INPUT, OUTPUT ή INPUT_PULLUP.');
      if (!PIN_LABELS[pin]) {
        this.warnOnce('nc' + pin, line, `Στο GPIO ${pin} δεν είναι συνδεδεμένο τίποτα στην εικονική πλακέτα.`, 'Χρησιμοποίησε LED_PIN, BUTTON_PIN ή PIR_PIN.');
      }
      if (INPUT_PINS.has(pin) && mode === 3) {
        this.warnOnce('outIn' + pin, line, `Το ${PIN_LABELS[pin]} είναι είσοδος, αλλά το ρύθμισες ως OUTPUT.`, 'Για να διαβάζεις από κουμπί ή αισθητήρα, χρησιμοποίησε INPUT.');
      }
      if (pin === PINS.LED && mode !== 3) {
        this.warnOnce('ledIn', line, 'Το LED ρυθμίστηκε ως είσοδος. Ένα LED χρειάζεται OUTPUT για να ανάψει.', 'Γράψε pinMode(LED_PIN, OUTPUT);');
      }
      this.modes[pin] = mode;
    }

    digitalWrite(pin, value, line) {
      const v = value ? 1 : 0;
      // buzzer με digitalWrite: απλό «μπιπ» στα 2 kHz, όπως ένα ενεργό buzzer
      if (pin === PINS.BUZZER) { this.buzzer.freq = v ? 2000 : 0; this.buzzer.until = null; if (v) this.buzzer.tones.push({ t: this.micros, f: 2000, ms: null }); }
      if (pin === PINS.LED && this.modes[pin] !== 3) {
        this.warnOnce('ledMode', line, 'Γράφεις στο LED_PIN χωρίς να το έχεις ρυθμίσει ως OUTPUT. Στην εικονική πλακέτα το LED μένει σβηστό.', 'Πρόσθεσε pinMode(LED_PIN, OUTPUT); μέσα στο setup(), πριν από το digitalWrite.');
      }
      if (INPUT_PINS.has(pin)) {
        this.warnOnce('writeIn' + pin, line, `Γράφεις τιμή στο ${PIN_LABELS[pin]}, που είναι είσοδος. Δεν θα αλλάξει τίποτα.`, 'Το digitalWrite χρησιμοποιείται για εξόδους, π.χ. LED_PIN.');
      }
      if (!PIN_LABELS[pin]) {
        this.warnOnce('ncw' + pin, line, `Γράφεις στο GPIO ${pin}, όπου δεν είναι συνδεδεμένο τίποτα.`, 'Το LED είναι στο LED_PIN (GPIO 2).');
      }
      // TRIG του HC-SR04: ένας παλμός HIGH τουλάχιστον 10 µs «οπλίζει» μία μέτρηση.
      if (pin === PINS.TRIG) {
        const was = this.outputs[pin] || 0;
        if (!was && v) this.trig.highAt = this.micros;
        if (was && !v && this.trig.highAt !== null) {
          const len = this.micros - this.trig.highAt;
          this.trig.highAt = null;
          if (len >= 8) { this.trig.armed = true; this.trig.firedAt = this.micros; }
          else this.warnOnce('trigshort', line, `Ο παλμός TRIG κράτησε μόνο ${len} µs. Το HC-SR04 θέλει τουλάχιστον 10 µs.`, 'Γράψε digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN, LOW);');
        }
      }
      this.outputs[pin] = v;
    }

    // pulseIn(ECHO_PIN, HIGH): πόσα µs κράτησε η ηχώ. ~58 µs ανά εκατοστό (πάει και έρχεται με 343 m/s).
    pulseIn(pin, level, timeout, line) {
      const limit = timeout === undefined ? 1000000 : timeout;
      if (pin !== PINS.ECHO) {
        this.warnOnce('pulsepin' + pin, line, `Το pulseIn διαβάζει το GPIO ${pin}, αλλά η ηχώ του HC-SR04 είναι στο ECHO_PIN (GPIO 18). Επιστρέφει 0.`, 'Γράψε pulseIn(ECHO_PIN, HIGH).');
        this.advanceMicros(limit);
        return 0;
      }
      if (this.modes[pin] === 3) {
        // Ένα pin OUTPUT δεν «ακούει»: η ηχώ δεν διαβάζεται ποτέ.
        this.warnOnce('echomode', line, 'Το ECHO_PIN είναι ρυθμισμένο ως OUTPUT, άρα δεν μπορεί να διαβάσει την ηχώ: το pulseIn επιστρέφει 0.', 'Γράψε pinMode(ECHO_PIN, INPUT); στο setup().');
        this.trig.armed = false;
        this.advanceMicros(limit);
        return 0;
      }
      if (this.modes[pin] !== 1 && this.modes[pin] !== 5) {
        this.warnOnce('echomode', line, 'Το ECHO_PIN δεν ρυθμίστηκε ως INPUT.', 'Πρόσθεσε pinMode(ECHO_PIN, INPUT); στο setup().');
      }
      if (!level) { this.advanceMicros(Math.min(limit, 100)); return 0; }
      if (!this.trig.armed) {
        this.warnOnce('notrig', line, 'Το pulseIn περίμενε ηχώ, αλλά δεν στάλθηκε παλμός στο TRIG: επιστρέφει 0 μετά το timeout.', 'Πριν από το pulseIn στείλε παλμό: digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN, LOW);');
        this.advanceMicros(limit);
        return 0;
      }
      this.trig.armed = false;
      const cm = this.inputs.distance;
      const echo = cm > 400 || cm < 2 ? 0 : Math.round(cm * 58.3);
      this.us = { at: this.micros, cm };
      this.advanceMicros(450); // 8 παλμοί των 40 kHz πριν ξεκινήσει η ηχώ
      if (!echo || echo > limit) { this.advanceMicros(Math.min(limit, 38000)); return 0; }
      this.advanceMicros(echo);
      return echo;
    }

    // Στάθμη του ECHO τη στιγμή αυτή (για κώδικα που μετρά μόνος του τον χρόνο, π.χ. Rust με Instant):
    // ~450 µs μετά τον παλμό TRIG ανεβαίνει σε HIGH και μένει όσο ταξιδεύει ο ήχος (58,3 µs ανά cm).
    echoLevel() {
      const t = this.trig;
      if (!t || t.firedAt === undefined || t.firedAt === null) return 0;
      const cm = this.inputs.distance;
      const echo = cm > 400 || cm < 2 ? 0 : Math.round(cm * 58.3);
      const dt = this.micros - t.firedAt;
      if (dt < 450) return 0;
      if (!this.us || this.us.at !== t.firedAt) this.us = { at: t.firedAt, cm };
      if (dt < 450 + echo) return 1;
      t.firedAt = null;
      t.armed = false;
      return 0;
    }

    digitalRead(pin, line) {
      if (pin === PINS.BUTTON) return this.inputs.button ? 1 : 0;
      if (pin === PINS.PIR) return this.inputs.pir ? 1 : 0;
      if (pin === PINS.LED) return this.outputs[pin] || 0;
      if (pin === PINS.ECHO) return this.echoLevel();
      if (this.outputs[pin] !== undefined) return this.outputs[pin];
      this.warnOnce('ncr' + pin, line, `Διαβάζεις από το GPIO ${pin}, όπου δεν είναι συνδεδεμένο τίποτα. Η τιμή θα είναι πάντα LOW (0).`, 'Το κουμπί είναι στο BUTTON_PIN και ο PIR στο PIR_PIN.');
      return 0;
    }

    serialBegin(baud, line) {
      if (this.serialStarted) return;
      this.serialStarted = true;
      if (baud !== 115200 && baud !== 9600) {
        this.warnOnce('baud', line, `Ξεκίνησες το Serial με ${baud} baud. Το εικονικό Serial Monitor δέχεται οποιαδήποτε τιμή, αλλά σε πραγματική πλακέτα πρέπει να ταιριάζει με τη ρύθμιση του monitor.`, 'Συνηθισμένη τιμή για ESP32: 115200.');
      }
    }

    serialWrite(text, newline, line) {
      if (!this.serialStarted) {
        this.warnOnce('nobegin', line, 'Τυπώνεις στο Serial χωρίς Serial.begin(…). Σε πραγματική πλακέτα πιθανότατα δεν θα έβλεπες τίποτα.', 'Πρόσθεσε Serial.begin(115200); στην αρχή του setup().');
      }
      if (this.partial) {
        this.partial.text += text;
        this.partial.line = line;
        if (newline) { this.partial.open = false; this.partial = null; }
      } else {
        const entry = { id: ++this.seq, t: this.micros / 1000, text, line, open: !newline };
        this.serial.push(entry);
        if (!newline) this.partial = entry;
        if (this.serial.length > 1500) this.serial.splice(0, this.serial.length - 1500);
      }
    }

    serialLines() { return this.serial.map(e => e.text); }

    // ------------------------------------------------ αισθητήρες, WiFi, mqtt, JSON

    initWorld(world) {
      this.inputs.temp = typeof world.temp === 'number' ? world.temp : 22.5;
      this.inputs.humidity = typeof world.humidity === 'number' ? world.humidity : 45;
      this.inputs.sensorFault = !!world.sensorFault;
      this.inputs.router = world.router !== false;
      this.inputs.distance = typeof world.distance === 'number' ? world.distance : 50;
      this.trig = { highAt: null, armed: false };
      this.us = null;
      const connected = world.wifi === 'connected';
      this.wifi = { status: connected ? 3 : 0, pending: null, begins: 0, reconnects: 0, creds: connected ? { ssid: world.ssid || 'SmartHome-Lab', pass: world.wifiPass || 'lab-pass-123' } : null };
      this.expected = { ssid: world.ssid || 'SmartHome-Lab', pass: world.wifiPass || 'lab-pass-123' };
      this.mqtt = { host: null, port: 1883, tlsMode: 'none', ca: null, current: null, connects: 0, clientId: null };
      this.wifi.mode = 1;
      this.energy = { mAus: 0, us: 0, byState: { active: 0, wifi: 0, light: 0, deep: 0 } };
      this.battery = typeof world.battery === 'number' ? world.battery : 2000;
      this.sleep = null;
      this.wake = { timerUs: null, ext0: null };
      this.wakeCause = 0;
      this.wakeups = [];
      this.boots = 0;
      this.net = null;
      // Raspberry Pi: βάσεις SQLite (ανά αρχείο) και αιτήματα HTTP προς τον web server του Flask.
      this.dbSeed = world.db || null;
      this.db = {};
      this.http = { queue: [], log: [], server: null, nextId: 1 };
      this.initParts();
    }

    // ------------------------------------------------ buzzer, servo, LED RGB, OLED
    initParts() {
      this.buzzer = { freq: 0, until: null, tones: [] };
      this.servo = { attached: false, angle: 90, moves: [] };
      this.pwm = {};
      this.oled = { begun: false, buf: [], shown: [], x: 0, y: 0, size: 1, updates: 0, pending: false };
    }
    // Συχνότητα που ακούγεται τώρα (0 = σιωπή). Ένα tone(…, ms) σταματά μόνο του.
    buzzerFreq() {
      const z = this.buzzer;
      if (z.freq && z.until !== null && this.micros >= z.until) { z.freq = 0; z.until = null; }
      return z.freq;
    }
    rgb() { return [this.pwm[32] || 0, this.pwm[33] || 0, this.pwm[14] || 0]; }
    oledText() { return this.oled.shown.map(t => t.text).join(' '); }
    tone(pin, freq, ms, line) {
      if (pin !== PINS.BUZZER) this.warnOnce('tonepin' + pin, line, `Το tone() πάει στο GPIO ${pin}, αλλά το buzzer είναι στο BUZZER_PIN (GPIO 23).`, 'Γράψε tone(BUZZER_PIN, 440);');
      const f = Math.max(0, Math.round(freq));
      if (f > 0 && (f < 30 || f > 20000)) this.warnOnce('tonefreq', line, `Τα ${f} Hz δεν ακούγονται καλά από ένα buzzer.`, 'Δοκίμασε συχνότητες από 200 έως 4000 Hz (π.χ. 440 = λα).');
      this.buzzer.freq = pin === PINS.BUZZER ? f : 0;
      this.buzzer.until = ms ? this.micros + Math.round(ms) * 1000 : null;
      if (pin === PINS.BUZZER && f) this.buzzer.tones.push({ t: this.micros, f, ms: ms || null });
    }
    noTone(pin) { if (pin === PINS.BUZZER) { this.buzzer.freq = 0; this.buzzer.until = null; } }
    analogWrite(pin, val, line) {
      const v = Math.round(val);
      if (v < 0 || v > 255) this.warnOnce('pwmrange', line, `Το analogWrite δέχεται τιμές από 0 έως 255· έδωσες ${v}.`, '0 = σβηστό, 255 = όσο πιο φωτεινό γίνεται.');
      const c = Math.max(0, Math.min(255, v));
      if (![32, 33, 14, PINS.LED].includes(pin)) this.warnOnce('pwmpin' + pin, line, `Στο GPIO ${pin} δεν είναι συνδεδεμένο τίποτα που να δέχεται analogWrite.`, 'Το LED RGB είναι στα RGB_RED_PIN, RGB_GREEN_PIN και RGB_BLUE_PIN.');
      this.pwm[pin] = c;
      if (pin === PINS.LED) { this.modes[pin] = 3; this.outputs[pin] = c > 0 ? 1 : 0; }
    }
    servoWrite(angle, line) {
      if (!this.servo.attached) this.warnOnce('servoattach', line, 'Το servo δεν κινείται: δεν έχει γίνει servo.attach(SERVO_PIN).', 'Πρόσθεσε servo.attach(SERVO_PIN); στο setup().');
      const a = Math.round(angle);
      if (a < 0 || a > 180) this.warnOnce('servorange', line, `Το servo γυρίζει από 0 έως 180 μοίρες· έδωσες ${a}.`, 'Οι τιμές έξω από τα όρια κόβονται στο 0 ή στο 180.');
      if (!this.servo.attached) return;
      this.servo.angle = Math.max(0, Math.min(180, a));
      this.servo.moves.push({ t: this.micros, angle: this.servo.angle });
    }
    // OLED 128×64: γράμματα 6×8 εικονοστοιχεία επί το μέγεθος. Ό,τι γράφεις φαίνεται μόνο μετά το display.display().
    oledWrite(text, newline, line) {
      const o = this.oled;
      if (!o.begun) this.warnOnce('oledbegin', line, 'Γράφεις στην οθόνη πριν από το display.begin().', 'Πρόσθεσε display.begin(); στο setup().');
      const t = String(text);
      if (t) o.buf.push({ x: o.x, y: o.y, size: o.size, text: t });
      o.x += t.length * 6 * o.size;
      if (newline) { o.x = 0; o.y += 8 * o.size; }
      if (o.y >= 64) this.warnOnce('oledfull', line, 'Το κείμενο βγήκε κάτω από την οθόνη (64 εικονοστοιχεία ύψος).', 'Κάλεσε display.clearDisplay(); και display.setCursor(0, 0); πριν ξαναγράψεις.');
      o.pending = true;
    }

    setRouter(up) {
      this.inputs.router = up;
      if (!up && this.wifi.status === 3) {
        this.wifi.status = 6;
        if (this.net) this.net.dropClient('device', 'WiFi lost');
      }
    }

    wifiStatus() {
      const w = this.wifi;
      if (w.pending && this.micros >= w.pending.at) { w.status = w.pending.result; w.pending = null; }
      if (w.status === 3 && !this.inputs.router) { w.status = 6; if (this.net) this.net.dropClient('device', 'WiFi lost'); }
      return w.status;
    }

    wifiStart(ssid, pass) {
      const w = this.wifi;
      w.creds = { ssid, pass };
      w.status = 6;
      if (this.net) this.net.dropClient('device', 'WiFi restart');
      let result = 3;
      let after = 1200;
      if (!this.inputs.router || ssid !== this.expected.ssid) { result = 1; after = 3000; }
      else if (pass !== this.expected.pass) { result = 4; after = 3000; }
      w.pending = { at: this.micros + after * 1000, result };
    }

    netReady(line) {
      if (!this.net) throw err('Αυτή η άσκηση δεν έχει broker MQTT.', line, 'Οι εντολές mqtt χρησιμοποιούνται από το Κεφάλαιο 7 και μετά.');
      return this.wifiStatus() === 3;
    }

    call(name, a, line, h) {
      const { V } = h;
      const VOID = V('void', 0);
      const S = s => V('String', s);
      const B = b => V('bool', !!b);
      const str = (i, what) => {
        if (h.argTypes[i] !== 'String') throw err(`Το ${what} της ${name} πρέπει να είναι κείμενο σε "εισαγωγικά".`, line);
        return a[i];
      };
      switch (name) {
        case 'pulseIn': return V('int', this.pulseIn(a[0], a[1], a[2], line));
        case 'readTemperature': return V('float', this.inputs.sensorFault ? NaN : this.inputs.temp);
        case 'readHumidity': return V('float', this.inputs.sensorFault ? NaN : this.inputs.humidity);
        case 'tone': this.tone(a[0], a[1], a[2], line); return VOID;
        case 'noTone': this.noTone(a[0]); return VOID;
        case 'analogWrite': this.analogWrite(a[0], a[1], line); return VOID;
        case 'servo.attach':
          if (a[0] !== 19) this.warnOnce('servopin', line, `Το servo είναι στο SERVO_PIN (GPIO 19), όχι στο GPIO ${a[0]}.`, 'Γράψε servo.attach(SERVO_PIN);');
          this.servo.attached = a[0] === 19;
          return VOID;
        case 'servo.write': this.servoWrite(a[0], line); return VOID;
        case 'servo.read': return V('int', this.servo.angle);
        case 'display.begin': this.oled.begun = true; return VOID;
        case 'display.clearDisplay': this.oled.buf = []; this.oled.x = 0; this.oled.y = 0; this.oled.pending = true; return VOID;
        case 'display.setCursor': this.oled.x = Math.max(0, Math.round(a[0])); this.oled.y = Math.max(0, Math.round(a[1])); return VOID;
        case 'display.setTextSize': this.oled.size = Math.max(1, Math.min(4, Math.round(a[0]))); return VOID;
        case 'display.print':
        case 'display.println': {
          const ty = h.argTypes[0];
          const txt = a.length ? (ty === 'String' ? a[0] : ty === 'float' || ty === 'double' ? Number(a[0]).toFixed(2) : ty === 'bool' ? (a[0] ? 'true' : 'false') : String(Math.trunc(a[0]))) : '';
          this.oledWrite(txt, name === 'display.println', line);
          return VOID;
        }
        case 'display.display':
          if (!this.oled.begun) this.warnOnce('oledbegin', line, 'Η οθόνη δεν έχει ξεκινήσει: λείπει το display.begin().', 'Πρόσθεσε display.begin(); στο setup().');
          if (this.oled.begun) { this.oled.shown = this.oled.buf.slice(); this.oled.updates++; this.oled.pending = false; }
          return VOID;
        case 'jsonValid': return B(root.IoTNet.jsonValid(String(a[0])));
        case 'jsonHas': return B(root.IoTNet.jsonHas(String(a[0]), String(a[1])));
        case 'jsonGet': return S(root.IoTNet.jsonGet(String(a[0]), String(a[1])));

        case 'WiFi.mode':
          if (a[0] !== 0 && a[0] !== 1) throw err('Το WiFi.mode δέχεται WIFI_OFF ή WIFI_STA.', line);
          this.wifi.mode = a[0];
          if (a[0] === 0) {
            this.wifi.status = 0;
            this.wifi.pending = null;
            if (this.net) this.net.dropClient('device', 'WiFi off');
          }
          return VOID;
        case 'esp_sleep_enable_timer_wakeup':
          if (a[0] < 0) throw err('Ο χρόνος αφύπνισης δεν μπορεί να είναι αρνητικός.', line);
          this.wake.timerUs = a[0];
          return VOID;
        case 'esp_sleep_enable_ext0_wakeup':
          if (a[0] !== PINS.PIR && a[0] !== PINS.BUTTON) throw err(`Το GPIO ${a[0]} δεν έχει συνδεδεμένο αισθητήρα ή κουμπί για αφύπνιση.`, line, 'Χρησιμοποίησε PIR_PIN ή BUTTON_PIN.');
          this.wake.ext0 = { pin: a[0], level: a[1] ? 1 : 0 };
          return VOID;
        case 'esp_sleep_get_wakeup_cause': return V('int', this.wakeCause);
        case 'WiFi.begin':
          this.wifi.begins++;
          this.wifi.mode = 1;
          this.wifiStart(str(0, 'SSID'), str(1, 'password'));
          this.advanceMicros(5000);
          return VOID;
        case 'WiFi.reconnect':
          if (!this.wifi.creds) { this.warnOnce('reconnect-nobegin', line, 'Κάλεσες WiFi.reconnect() χωρίς να έχει γίνει ποτέ WiFi.begin(…).', 'Το reconnect ξαναχρησιμοποιεί τα στοιχεία του τελευταίου WiFi.begin.'); return VOID; }
          this.wifi.reconnects++;
          this.wifiStart(this.wifi.creds.ssid, this.wifi.creds.pass);
          this.advanceMicros(5000);
          return VOID;
        case 'WiFi.disconnect':
          this.wifi.status = 6;
          this.wifi.pending = null;
          if (this.net) this.net.dropClient('device', 'WiFi disconnect');
          return VOID;
        case 'WiFi.status': return V('int', this.wifiStatus());
        case 'WiFi.localIP': return S(this.wifiStatus() === 3 ? '192.168.1.42' : '0.0.0.0');

        case 'mqtt.setServer':
          this.mqtt.host = str(0, 'όνομα του server');
          this.mqtt.port = Number(a[1]);
          return VOID;
        case 'mqtt.setCACert':
          this.mqtt.tlsMode = 'verify';
          this.mqtt.ca = str(0, 'όνομα της CA');
          return VOID;
        case 'mqtt.setInsecure':
          this.mqtt.tlsMode = 'insecure';
          this.warnOnce('insecure', line, 'Το mqtt.setInsecure() απενεργοποιεί τον έλεγχο του πιστοποιητικού.', 'Έτσι ο client θα δεχτεί οποιοδήποτε πιστοποιητικό, ακόμα και ληγμένο ή για λάθος όνομα. Χρησιμοποίησε mqtt.setCACert(HOME_CA).');
          return VOID;
        case 'mqtt.connect': {
          this.mqtt.connects++;
          this.advanceMicros(30000);
          if (!this.netReady(line)) {
            this.mqtt.lastError = 'Δεν υπάρχει σύνδεση WiFi.';
            return B(false);
          }
          if (!this.mqtt.host) throw err('Το mqtt.connect κλήθηκε πριν από το mqtt.setServer(…).', line, 'Γράψε πρώτα mqtt.setServer(MQTT_HOST, 1883); στο setup().');
          if (a.length === 3) { str(1, 'όνομα χρήστη'); str(2, 'κωδικός'); }
          const id = str(0, 'client id');
          this.mqtt.clientId = id;
          const r = this.net.connect('device', {
            clientId: id, port: this.mqtt.port, host: this.mqtt.host,
            tls: this.mqtt.tlsMode !== 'none', verify: this.mqtt.tlsMode === 'verify', ca: this.mqtt.ca,
            username: a.length === 3 ? a[1] : null, password: a.length === 3 ? a[2] : null
          });
          this.mqtt.lastError = r.ok ? null : r.message;
          if (!r.ok) this.warnOnce('mqttfail:' + r.code, line, 'Η σύνδεση MQTT απέτυχε: ' + r.message, r.code === 'bad-cert' ? 'Ο client έκανε σωστά που απέρριψε το πιστοποιητικό. Δεν πρέπει να παρακαμφθεί ο έλεγχος.' : '');
          return B(r.ok);
        }
        case 'mqtt.connected':
          if (!this.net) return B(false);
          this.wifiStatus();
          return B(this.net.connected('device'));
        case 'mqtt.disconnect':
          if (this.net) this.net.disconnect('device');
          return VOID;
        case 'mqtt.publish': {
          const topic = str(0, 'topic');
          const payload = h.argTypes[1] === 'String' ? a[1] : h.formatValue(V(h.argTypes[1], a[1]));
          if (!this.net || !this.netReady(line) || !this.net.connected('device')) {
            this.warnOnce('pub-offline', line, 'Έγινε publish χωρίς σύνδεση στον broker. Το μήνυμα χάθηκε.', 'Έλεγξε πρώτα mqtt.connected().');
            return B(false);
          }
          const r = this.net.publish('device', topic, payload, a.length === 3 ? !!a[2] : false, 0);
          if (!r.ok && !r.denied) this.warnOnce('pub:' + topic, line, r.message, '');
          return B(r.ok);
        }
        case 'mqtt.subscribe': {
          const f = str(0, 'topic');
          if (!this.net || !this.netReady(line) || !this.net.connected('device')) return B(false);
          const r = this.net.subscribe('device', f);
          if (!r.ok) this.warnOnce('sub:' + f, line, r.message, '');
          return B(r.ok);
        }
        case 'mqtt.read': {
          if (!this.net) return B(false);
          const m = this.net.readNext('device');
          this.mqtt.current = m;
          return B(!!m);
        }
        case 'mqtt.topic': return S(this.mqtt.current ? this.mqtt.current.topic : '');
        case 'mqtt.payload': return S(this.mqtt.current ? this.mqtt.current.payload : '');
      }
      throw err(`Η εντολή «${name}» δεν υπάρχει.`, line);
    }
  }

  root.IoTDevice = { Board, PINS, MODE_NAMES, POWER_MA };
})(typeof window !== 'undefined' ? window : globalThis);
