/*
 * IoT Guardian — εικονική πλακέτα τύπου ESP32.
 * Γενικό εκπαιδευτικό μοντέλο: δεν εξομοιώνει πλήρως το πραγματικό chip.
 * Pin map (εικονικό): LED → GPIO 2, Button → GPIO 15, PIR → GPIO 4.
 */
(function (root) {
  'use strict';

  const PINS = { LED: 2, BUTTON: 15, PIR: 4 };
  const MODE_NAMES = { 1: 'INPUT', 3: 'OUTPUT', 5: 'INPUT_PULLUP' };
  const PIN_LABELS = { 2: 'LED (GPIO 2)', 15: 'κουμπί (GPIO 15)', 4: 'PIR (GPIO 4)' };
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
      if ((pin === PINS.BUTTON || pin === PINS.PIR) && mode === 3) {
        this.warnOnce('outIn' + pin, line, `Το ${PIN_LABELS[pin]} είναι είσοδος, αλλά το ρύθμισες ως OUTPUT.`, 'Για να διαβάζεις από κουμπί ή αισθητήρα, χρησιμοποίησε INPUT.');
      }
      if (pin === PINS.LED && mode !== 3) {
        this.warnOnce('ledIn', line, 'Το LED ρυθμίστηκε ως είσοδος. Ένα LED χρειάζεται OUTPUT για να ανάψει.', 'Γράψε pinMode(LED_PIN, OUTPUT);');
      }
      this.modes[pin] = mode;
    }

    digitalWrite(pin, value, line) {
      const v = value ? 1 : 0;
      if (pin === PINS.LED && this.modes[pin] !== 3) {
        this.warnOnce('ledMode', line, 'Γράφεις στο LED_PIN χωρίς να το έχεις ρυθμίσει ως OUTPUT. Στην εικονική πλακέτα το LED μένει σβηστό.', 'Πρόσθεσε pinMode(LED_PIN, OUTPUT); μέσα στο setup(), πριν από το digitalWrite.');
      }
      if (pin === PINS.BUTTON || pin === PINS.PIR) {
        this.warnOnce('writeIn' + pin, line, `Γράφεις τιμή στο ${PIN_LABELS[pin]}, που είναι είσοδος. Δεν θα αλλάξει τίποτα.`, 'Το digitalWrite χρησιμοποιείται για εξόδους, π.χ. LED_PIN.');
      }
      if (!PIN_LABELS[pin]) {
        this.warnOnce('ncw' + pin, line, `Γράφεις στο GPIO ${pin}, όπου δεν είναι συνδεδεμένο τίποτα.`, 'Το LED είναι στο LED_PIN (GPIO 2).');
      }
      this.outputs[pin] = v;
    }

    digitalRead(pin, line) {
      if (pin === PINS.BUTTON) return this.inputs.button ? 1 : 0;
      if (pin === PINS.PIR) return this.inputs.pir ? 1 : 0;
      if (pin === PINS.LED) return this.outputs[pin] || 0;
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
        case 'readTemperature': return V('float', this.inputs.sensorFault ? NaN : this.inputs.temp);
        case 'readHumidity': return V('float', this.inputs.sensorFault ? NaN : this.inputs.humidity);
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
