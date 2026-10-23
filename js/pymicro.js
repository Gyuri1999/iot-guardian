/*
 * IoT Guardian — MicroPython στο ESP32: επέκταση του interpreter Python (js/pyinterp.js).
 *   machine      Pin (OUT / IN / PULL_UP / PULL_DOWN), time_pulse_us, reset
 *   time         + sleep_ms, sleep_us, ticks_ms, ticks_us, ticks_diff
 *   dht          DHT22 / DHT11: measure(), temperature(), humidity()
 *   network      WLAN(STA_IF): active, connect, isconnected, status, ifconfig
 *   umqtt.simple MQTTClient: connect, publish, subscribe, set_callback, check_msg, wait_msg, disconnect
 * Η πλακέτα και το δίκτυο είναι τα ίδια με της C++ (js/device.js, js/network.js).
 * Στο Raspberry Pi μένουν τα modules του Pi (gpiozero, paho…) και τα modules της MicroPython δεν υπάρχουν.
 */
(function (root) {
  'use strict';

  const PyM = root.IoTPy;
  const K = PyM.KIT;
  const { NONE, B, I, F, S, T, BY, TYPE, raise, builtin, truthy, isNum, numOf, typeName, pyStr, MODULES, HIGHLIGHT, EXC_PARENT, NOT_BUILTIN } = K;
  const PINS = (root.IoTDevice && root.IoTDevice.PINS) || { LED: 2, BUTTON: 15, PIR: 4, TRIG: 5, ECHO: 18, RED: 25, YELLOW: 26, GREEN: 27 };

  // modules ανά πλακέτα
  const ESP_ONLY = new Set(['machine', 'network', 'umqtt', 'umqtt.simple', 'dht', 'esp32', 'ssd1306']);
  const PI_ONLY = new Set(['gpiozero', 'gpiozero.tones', 'board', 'busio', 'adafruit_ssd1306', 'signal', 'paho', 'paho.mqtt', 'paho.mqtt.client', 'flask', 'sqlite3', 'markupsafe']);
  const proto = PyM.Machine.prototype;
  const moduleOrig = proto.module;
  proto.module = function (path, line) {
    const target = this.target || 'pi';
    if (target === 'esp32' && PI_ONLY.has(path)) {
      raise('ImportError', `no module named '${path}'`, path === 'gpiozero' ? 'Το gpiozero είναι για Raspberry Pi. Στο ESP32 με MicroPython γράφεις: from machine import Pin' : path.startsWith('paho') ? 'Στο ESP32 το MQTT γίνεται με: from umqtt.simple import MQTTClient' : 'Αυτό το module υπάρχει στο Raspberry Pi, όχι στη MicroPython του ESP32.', line);
    }
    if (target !== 'esp32' && ESP_ONLY.has(path)) {
      raise('ModuleNotFoundError', `No module named '${path}'`, path === 'machine' ? 'Το machine είναι της MicroPython (ESP32). Στο Raspberry Pi γράφεις: from gpiozero import LED' : 'Αυτό το module υπάρχει στη MicroPython του ESP32, όχι στο Raspberry Pi.', line);
    }
    const mod = moduleOrig.call(this, path, line);
    if (path === 'time' && target === 'esp32' && !mod.micro) {
      mod.micro = true;
      Object.assign(mod.attrs, microTime(this));
    }
    return mod;
  };

  Object.assign(EXC_PARENT, { MQTTException: 'Exception' });
  NOT_BUILTIN.add('MQTTException');
  HIGHLIGHT.builtins.push('machine', 'Pin', 'network', 'WLAN', 'MQTTClient', 'dht', 'umqtt', 'time_pulse_us', 'PWM', 'I2C', 'SoftI2C', 'ssd1306');

  // ------------------------------------------------------------ time (MicroPython)
  function microTime(m) {
    const waitFn = (name, k) => builtin(name, (m2, a, kw, line) => {
      const v = a[0];
      if (!v || !isNum(v)) raise('TypeError', `can't convert ${v ? typeName(v) : 'NoneType'} to int`, `Γράψε time.${name}(500).`, line);
      const us = numOf(v) * k;
      if (k === 1) { m.board.advanceMicros(us); return NONE; }
      return { __gen: (function* () { yield* m.wait(us / 1000, line); return NONE; })() };
    });
    return {
      sleep_ms: waitFn('sleep_ms', 1000),
      sleep_us: waitFn('sleep_us', 1),
      ticks_ms: builtin('ticks_ms', () => I(Math.floor(m.board.micros / 1000))),
      ticks_us: builtin('ticks_us', () => I(Math.floor(m.board.micros))),
      ticks_diff: builtin('ticks_diff', (m2, a) => I(numOf(a[0]) - numOf(a[1]))),
      ticks_add: builtin('ticks_add', (m2, a) => I(numOf(a[0]) + numOf(a[1])))
    };
  }

  // ------------------------------------------------------------ machine
  const NAMES = { 23: 'buzzer', 19: 'servo', 32: 'κόκκινο του LED RGB', 33: 'πράσινο του LED RGB', 14: 'μπλε του LED RGB', 21: 'SDA της οθόνης', 22: 'SCL της οθόνης', 13: 'αισθητήρας DHT22', [PINS.LED]: 'LED', [PINS.BUTTON]: 'κουμπί', [PINS.PIR]: 'PIR', [PINS.TRIG]: 'TRIG', [PINS.ECHO]: 'ECHO', [PINS.RED]: 'κόκκινο φως', [PINS.YELLOW]: 'κίτρινο φως', [PINS.GREEN]: 'πράσινο φως' };
  const INPUTS = new Set([PINS.BUTTON, PINS.PIR, PINS.ECHO]);
  const OUT = 3; const IN = 1; const PULL_UP = 2; const PULL_DOWN = 1;

  function makePin(m, a, kw, line) {
    const idv = a[0] || kw.id;
    if (!idv || idv.t !== 'int') raise('TypeError', 'expecting a pin', 'Γράψε τον αριθμό του GPIO, π.χ. Pin(2, Pin.OUT).', line);
    const n = idv.v;
    if (n < 0 || n > 39 || [6, 7, 8, 9, 10, 11].includes(n)) raise('ValueError', `invalid pin`, n >= 6 && n <= 11 ? 'Τα GPIO 6–11 χρησιμοποιούνται από τη μνήμη flash του ESP32 και δεν είναι διαθέσιμα.' : 'Το ESP32 έχει GPIO από 0 έως 39.', line);
    const b = m.board;
    let mode = a[1] ? numOf(a[1]) : kw.mode ? numOf(kw.mode) : -1;
    const pull = a[2] ? numOf(a[2]) : kw.pull ? numOf(kw.pull) : -1;
    if (!NAMES[n]) b.warnOnce('mpnc' + n, line, `Στο GPIO ${n} δεν είναι συνδεδεμένο τίποτα στην εικονική πλακέτα.`, 'LED = 2, κουμπί = 15, PIR = 4, TRIG = 5, ECHO = 18, φανάρι = 25 / 26 / 27, buzzer = 23, servo = 19, LED RGB = 32 / 33 / 14, οθόνη SDA 21 / SCL 22.');
    const setMode = md => {
      mode = md;
      if (md === OUT) {
        if (INPUTS.has(n)) b.warnOnce('mpoutin' + n, line, `Το GPIO ${n} (${NAMES[n]}) είναι είσοδος, αλλά το ρύθμισες Pin.OUT.`, 'Για κουμπί ή αισθητήρα: Pin(…, Pin.IN).');
        b.pinMode(n, 3, line);
      } else if (md === IN) {
        if (n === PINS.LED) b.warnOnce('mpledin', line, 'Το LED ρυθμίστηκε ως είσοδος (Pin.IN). Για να ανάψει χρειάζεται Pin.OUT.', 'Γράψε led = Pin(2, Pin.OUT).');
        b.pinMode(n, pull === PULL_UP ? 5 : 1, line);
      }
    };
    if (mode !== -1) setMode(mode);
    const init = a[3] || kw.value;
    const write = (v, ln) => {
      if (mode !== OUT) b.warnOnce('mpwritein' + n, ln, `Γράφεις στο Pin(${n}) χωρίς να είναι Pin.OUT.`, `Φτιάξε το pin ως έξοδο: Pin(${n}, Pin.OUT).`);
      if (mode === OUT || (mode === -1 && n === PINS.LED)) { if (mode !== OUT) b.modes[n] = 3; b.digitalWrite(n, v ? 1 : 0, ln); }
    };
    if (init && mode === OUT) write(truthy(init), line);
    const read = ln => (mode === OUT ? (b.outputs[n] || 0) : b.digitalRead(n, ln));
    const o = {
      t: 'object', cls: 'Pin', pin: n,
      attr(name, ln) {
        switch (name) {
          case 'value': return builtin('value', (m2, args) => { if (args.length) { write(truthy(args[0]), ln); m.touch && m.touch(o, ln); return NONE; } return I(read(ln)); });
          case 'on': return builtin('on', () => { write(1, ln); m.touch && m.touch(o, ln); return NONE; });
          case 'off': return builtin('off', () => { write(0, ln); m.touch && m.touch(o, ln); return NONE; });
          case 'init': return builtin('init', (m2, args, kwb) => { setMode(args[0] ? numOf(args[0]) : numOf(kwb.mode || I(-1))); return NONE; });
          case 'irq': return builtin('irq', (m2, args, kwb, l2) => raise('NotImplementedError', 'Pin.irq is not supported in this simulation', 'Διάβασε το pin μέσα στο while True: με .value().', l2));
        }
        return undefined;
      },
      call(args, ln) { if (args.length) { write(truthy(args[0]), ln); return NONE; } return I(read(ln)); },
      short: () => `Pin(${n}) · ${mode === OUT ? 'OUT' : mode === IN ? 'IN' : '—'} · ${read(null) ? 1 : 0}`,
      repr: () => `Pin(${n})`
    };
    return o;
  }
  const PinType = {
    t: 'object', cls: 'type',
    attr(n) {
      const consts = { OUT, IN, PULL_UP, PULL_DOWN, OPEN_DRAIN: 7, IRQ_RISING: 1, IRQ_FALLING: 2 };
      if (n in consts) return I(consts[n]);
      return undefined;
    },
    call: null,
    repr: () => "<class 'Pin'>"
  };

  // ------------------------------------------------------------ PWM: buzzer, servo, LED RGB
  // Το ίδιο εικονικό μοντέλο με τη C++: ο buzzer ακούγεται, το servo γυρίζει, το LED RGB αλλάζει χρώμα.
  const SERVO_PIN = 19; const BUZZER_PIN = 23; const RGB = [32, 33, 14];
  function makePWM(m, a, kw, line) {
    const p = a[0] || kw.pin;
    if (!p || p.cls !== 'Pin') raise('TypeError', 'expecting a Pin', 'Γράψε π.χ. PWM(Pin(23)).', line);
    const n = p.pin;
    const b = m.board;
    let freq = a[1] ? numOf(a[1]) : kw.freq ? numOf(kw.freq) : n === SERVO_PIN ? 50 : 5000;
    let duty16 = kw.duty_u16 ? numOf(kw.duty_u16) : kw.duty ? numOf(kw.duty) * 64 : a[2] ? numOf(a[2]) * 64 : 0;
    if (n !== BUZZER_PIN && n !== SERVO_PIN && n !== PINS.LED && !RGB.includes(n)) b.warnOnce('pwmnc' + n, line, `Στο GPIO ${n} δεν υπάρχει κάτι που να δέχεται PWM.`, 'buzzer = 23, servo = 19, LED RGB = 32 / 33 / 14.');
    const apply = ln => {
      const level = Math.max(0, Math.min(65535, duty16));
      if (n === BUZZER_PIN) {
        const f = level > 0 ? Math.round(freq) : 0;
        if (f && f !== b.buzzer.freq) b.buzzer.tones.push({ t: b.micros, f, ms: null });
        b.buzzer.freq = f;
        b.buzzer.until = null;
      } else if (n === SERVO_PIN) {
        if (Math.round(freq) !== 50) b.warnOnce('servofreq', ln, `Το servo θέλει PWM στα 50 Hz· έβαλες ${Math.round(freq)} Hz.`, 'Γράψε PWM(Pin(19), freq=50).');
        const pulse = (level / 65535) * (1e6 / freq);   // μήκος παλμού σε µs
        if (level > 0) {
          b.servo.attached = true;
          const ang = ((pulse - 500) / 2000) * 180;
          if (ang < -2 || ang > 182) b.warnOnce('servorange', ln, `Ο παλμός ${Math.round(pulse)} µs είναι έξω από τα όρια του servo (500–2500 µs).`, 'Για 0°–180° χρησιμοποίησε duty από 26 έως 128 (ή duty_u16 από 1638 έως 8192).');
          b.servo.angle = Math.max(0, Math.min(180, Math.round(ang)));
          b.servo.moves.push({ t: b.micros, angle: b.servo.angle });
        }
      } else {
        b.pwm[n] = Math.round((level / 65535) * 255);
        if (n === PINS.LED) { b.modes[n] = 3; b.outputs[n] = level > 0 ? 1 : 0; }
      }
    };
    apply(line);
    const o = {
      t: 'object', cls: 'PWM', pin: n,
      attr(name, ln) {
        switch (name) {
          case 'freq': return builtin('freq', (m2, args) => { if (args.length) { freq = Math.max(1, numOf(args[0])); apply(ln); return NONE; } return I(Math.round(freq)); });
          case 'duty': return builtin('duty', (m2, args, kk, l2) => { if (args.length) { const d = numOf(args[0]); if (d < 0 || d > 1023) b.warnOnce('dutyrange', l2, `Το duty() δέχεται 0 έως 1023· έδωσες ${d}.`, '0 = σβηστό, 1023 = όλη την ώρα αναμμένο.'); duty16 = Math.max(0, Math.min(1023, d)) * 64; apply(l2); return NONE; } return I(Math.round(duty16 / 64)); });
          case 'duty_u16': return builtin('duty_u16', (m2, args, kk, l2) => { if (args.length) { const d = numOf(args[0]); if (d < 0 || d > 65535) b.warnOnce('dutyrange16', l2, `Το duty_u16() δέχεται 0 έως 65535· έδωσες ${d}.`, '0 = σβηστό, 65535 = όλη την ώρα αναμμένο, 32768 = μισό.'); duty16 = Math.max(0, Math.min(65535, d)); apply(l2); return NONE; } return I(Math.round(duty16)); });
          case 'duty_ns': return builtin('duty_ns', (m2, args, kk, l2) => { if (args.length) { duty16 = Math.round((numOf(args[0]) / (1e9 / freq)) * 65535); apply(l2); return NONE; } return I(Math.round((duty16 / 65535) * (1e9 / freq))); });
          case 'deinit': return builtin('deinit', () => { duty16 = 0; apply(ln); return NONE; });
        }
        return undefined;
      },
      short: () => `PWM(Pin(${n})) · ${Math.round(freq)} Hz · duty ${Math.round(duty16 / 64)}/1023`,
      repr: () => `PWM(Pin(${n}), freq=${Math.round(freq)}, duty=${Math.round(duty16 / 64)})`
    };
    return o;
  }

  // ------------------------------------------------------------ I2C και οθόνη SSD1306
  function makeI2C(m, a, kw, line, kind) {
    const scl = kw.scl;
    const sda = kw.sda;
    if (!scl || !sda || scl.cls !== 'Pin' || sda.cls !== 'Pin') raise('TypeError', 'missing scl / sda', `Γράψε ${kind}(0, scl=Pin(22), sda=Pin(21)).`, line);
    const ok = scl.pin === 22 && sda.pin === 21;
    if (!ok) m.board.warnOnce('i2cpins', line, `Η οθόνη είναι στα SDA 21 και SCL 22· έδωσες sda=Pin(${sda.pin}), scl=Pin(${scl.pin}).`, `Γράψε ${kind}(0, scl=Pin(22), sda=Pin(21)).`);
    return {
      t: 'object', cls: 'I2C', ok,
      attr(name) { if (name === 'scan') return builtin('scan', () => K.L ? K.L(ok ? [I(60)] : []) : NONE); return undefined; },
      short: () => `I2C · SDA ${sda.pin} · SCL ${scl.pin}${ok ? '' : ' (λάθος pins)'}`,
      repr: () => `I2C(0, scl=Pin(${scl.pin}), sda=Pin(${sda.pin}))`
    };
  }
  MODULES.ssd1306 = m => ({
    SSD1306_I2C: builtin('SSD1306_I2C', (m2, a, kw, line) => {
      const w = a[0] ? numOf(a[0]) : 128;
      const h = a[1] ? numOf(a[1]) : 64;
      const bus = a[2] || kw.i2c;
      if (!bus || bus.cls !== 'I2C') raise('TypeError', 'expecting an I2C object', 'Γράψε oled = ssd1306.SSD1306_I2C(128, 64, i2c).', line);
      const b = m.board;
      if (w !== 128 || h !== 64) b.warnOnce('oledsize', line, `Η οθόνη μας είναι 128 × 64· έγραψες ${w} × ${h}.`, 'Γράψε SSD1306_I2C(128, 64, i2c).');
      b.oled.begun = !!bus.ok;
      return {
        t: 'object', cls: 'SSD1306_I2C',
        attr(name, ln) {
          switch (name) {
            case 'fill': return builtin('fill', (m3, args) => { b.oled.buf = []; b.oled.pending = true; return NONE; });
            case 'text': return builtin('text', (m3, args, kk, l2) => {
              const txt = args[0] ? (args[0].t === 'str' ? args[0].v : pyStr(args[0])) : '';
              const x = args[1] ? numOf(args[1]) : 0;
              const y = args[2] ? numOf(args[2]) : 0;
              if (y > 56) b.warnOnce('oledfull', l2, `Το y=${y} είναι κάτω από την οθόνη (ύψος 64, κάθε γραμμή 8).`, 'Γραμμές: y = 0, 10, 20, 30, 40, 50.');
              b.oled.buf.push({ x, y, size: 1, text: String(txt) });
              b.oled.pending = true;
              return NONE;
            });
            case 'show': return builtin('show', () => { if (b.oled.begun) { b.oled.shown = b.oled.buf.slice(); b.oled.updates++; b.oled.pending = false; } return NONE; });
            case 'poweroff': case 'poweron': case 'contrast': case 'invert': return builtin(name, () => NONE);
            case 'width': return I(w);
            case 'height': return I(h);
          }
          return undefined;
        },
        short: () => `SSD1306 · ${b.oled.shown.map(t => t.text).join(' / ') || 'κενή'}`,
        repr: () => '<SSD1306_I2C>'
      };
    })
  });

  MODULES.machine = m => {
    const Pin = builtin('Pin', (m2, a, kw, line) => makePin(m, a, kw, line));
    // Τα Pin.OUT κ.λπ. διαβάζονται ως πεδία του ίδιου του Pin
    const attr = Pin.attr;
    Pin.attr = n => (PinType.attr(n) !== undefined ? PinType.attr(n) : attr ? attr(n) : undefined);
    return {
      Pin,
      PWM: builtin('PWM', (m2, a, kw, line) => makePWM(m, a, kw, line)),
      I2C: builtin('I2C', (m2, a, kw, line) => makeI2C(m, a, kw, line, 'I2C')),
      SoftI2C: builtin('SoftI2C', (m2, a, kw, line) => makeI2C(m, a, kw, line, 'SoftI2C')),
      time_pulse_us: builtin('time_pulse_us', (m2, a, kw, line) => {
        const p = a[0];
        if (!p || p.cls !== 'Pin') raise('TypeError', 'expecting a Pin', 'Γράψε time_pulse_us(echo, 1, 30000).', line);
        const level = a[1] ? numOf(a[1]) : 1;
        const timeout = a[2] ? numOf(a[2]) : 1000000;
        const us = m.board.pulseIn(p.pin, level, timeout, line);
        return I(us === 0 ? -1 : us);
      }),
      reset: builtin('reset', (m2, a, kw, line) => raise('SystemExit', 'machine.reset()', 'Η πλακέτα ξεκινά από την αρχή.', line)),
      freq: builtin('freq', () => I(240000000)),
      unique_id: builtin('unique_id', () => BY('\x24\x0a\xc4\x00\x42\x42'))
    };
  };
  MODULES.esp32 = () => ({ raw_temperature: builtin('raw_temperature', () => I(120)) });

  // ------------------------------------------------------------ dht
  MODULES.dht = m => {
    const make = kind => builtin(kind, (m2, a, kw, line) => {
      const p = a[0];
      if (!p || p.cls !== 'Pin') raise('TypeError', 'expecting a Pin', `Γράψε ${kind}(Pin(13)).`, line);
      let t = null; let h = null;
      return {
        t: 'object', cls: kind,
        attr(n, ln) {
          if (n === 'measure') return builtin('measure', () => {
            m.board.advanceMicros(25000);
            if (m.board.inputs.sensorFault) raise('OSError', '[Errno 110] ETIMEDOUT', 'Ο αισθητήρας δεν απάντησε. Στην πραγματικότητα συμβαίνει με χαλαρό καλώδιο. Πιάσε το λάθος με try / except OSError και ξαναδοκίμασε αργότερα.', ln);
            t = m.board.inputs.temp; h = m.board.inputs.humidity;
            return NONE;
          });
          if (n === 'temperature') return builtin('temperature', (m3, aa, kk, l2) => { if (t === null) raise('OSError', '[Errno 22] EINVAL', 'Κάλεσε πρώτα sensor.measure() και μετά sensor.temperature().', l2); return kind === 'DHT11' ? I(Math.round(t)) : F(Math.round(t * 10) / 10); });
          if (n === 'humidity') return builtin('humidity', (m3, aa, kk, l2) => { if (h === null) raise('OSError', '[Errno 22] EINVAL', 'Κάλεσε πρώτα sensor.measure().', l2); return kind === 'DHT11' ? I(Math.round(h)) : F(Math.round(h * 10) / 10); });
          return undefined;
        },
        short: () => `${kind} · ${t === null ? 'δεν μέτρησε ακόμα' : `${t} °C, ${h} %`}`,
        repr: () => `<${kind}>`
      };
    });
    return { DHT22: make('DHT22'), DHT11: make('DHT11') };
  };

  // ------------------------------------------------------------ network
  MODULES.network = m => {
    const b = m.board;
    const WLAN = builtin('WLAN', (m2, a, kw, line) => {
      let active = false;
      return {
        t: 'object', cls: 'WLAN',
        attr(n, ln) {
          switch (n) {
            case 'active': return builtin('active', (m3, args) => { if (args.length) { active = truthy(args[0]); return NONE; } return B(active); });
            case 'connect': return builtin('connect', (m3, args, kwb, l2) => {
              if (!active) raise('OSError', 'Wifi Internal State Error', 'Πριν από το connect γράψε wlan.active(True).', l2);
              const ssid = args[0] || kwb.ssid;
              const key = args[1] || kwb.key || kwb.password;
              if (!ssid || ssid.t !== 'str') raise('TypeError', "object of type 'NoneType' has no len()", 'Γράψε wlan.connect(config.WIFI_SSID, config.WIFI_PASS).', l2);
              b.wifi.begins++;
              b.wifiStart(ssid.v, key ? pyStr(key) : '');
              return NONE;
            });
            case 'isconnected': return builtin('isconnected', () => B(b.wifiStatus() === 3));
            case 'status': return builtin('status', () => { const s = b.wifiStatus(); return I(s === 3 ? 1010 : s === 4 ? 202 : s === 1 ? 201 : s === 0 ? 1000 : 1001); });
            case 'disconnect': return builtin('disconnect', () => { b.wifi.status = 6; if (b.net) b.net.dropClient('device', 'WiFi disconnect'); return NONE; });
            case 'ifconfig': return builtin('ifconfig', () => (b.wifiStatus() === 3 ? T([S('192.168.1.42'), S('255.255.255.0'), S('192.168.1.1'), S('192.168.1.1')]) : T([S('0.0.0.0'), S('0.0.0.0'), S('0.0.0.0'), S('0.0.0.0')])));
            case 'scan': return builtin('scan', () => K.L([T([BY(b.expected ? b.expected.ssid : 'HomeLab'), BY(''), I(6), I(-58), I(3), B(false)])]));
          }
          return undefined;
        },
        short: () => `WLAN · ${b.wifiStatus() === 3 ? 'συνδεδεμένο' : active ? 'ενεργό, όχι συνδεδεμένο' : 'ανενεργό'}`,
        repr: () => '<WLAN>'
      };
    });
    return { WLAN, STA_IF: I(0), AP_IF: I(1), STAT_IDLE: I(1000), STAT_GOT_IP: I(1010), STAT_CONNECTING: I(1001), STAT_WRONG_PASSWORD: I(202), STAT_NO_AP_FOUND: I(201) };
  };

  // ------------------------------------------------------------ umqtt.simple
  MODULES.umqtt = () => ({});
  MODULES['umqtt.simple'] = m => {
    const b = m.board;
    const MQTTClient = builtin('MQTTClient', (m2, a, kw, line) => {
      const cid = a[0] || kw.client_id;
      const server = a[1] || kw.server;
      if (!cid || !server) raise('TypeError', "function missing required positional argument #2", 'Γράψε MQTTClient("esp32-temp", "broker.home.lan").', line);
      const c = {
        clientId: pyStr(cid), host: pyStr(server),
        port: a[2] || kw.port ? numOf(a[2] || kw.port) : 0,
        user: kw.user && kw.user.t !== 'NoneType' ? pyStr(kw.user) : null,
        pass: kw.password && kw.password.t !== 'NoneType' ? pyStr(kw.password) : null,
        ssl: kw.ssl ? truthy(kw.ssl) : false,
        cb: null
      };
      if (!c.port) c.port = c.ssl ? 8883 : 1883;
      const net = l2 => {
        if (!b.net) raise('OSError', '[Errno 113] EHOSTUNREACH', 'Σε αυτή την άσκηση δεν υπάρχει broker MQTT.', l2);
        if (b.wifiStatus() !== 3) raise('OSError', '[Errno 113] EHOSTUNREACH', 'Δεν υπάρχει σύνδεση WiFi. Περίμενε πρώτα να γίνει wlan.isconnected() == True.', l2);
        return b.net;
      };
      const deliver = function* (l2, block) {
        for (let guard = 0; guard < 400; guard++) {
          const msg = b.net && b.net.readNext('device');
          if (msg) {
            if (c.cb) yield* m.callValue(c.cb, [BY(msg.topic), BY(msg.payload)], {}, l2);
            return true;
          }
          if (!block) return false;
          yield* m.wait(50, l2, { noDispatch: true });
          if (b.net && b.net.tick) b.net.tick(b.inputs);
        }
        return false;
      };
      return {
        t: 'object', cls: 'MQTTClient',
        attr(n, ln) {
          switch (n) {
            case 'connect': return builtin('connect', (m3, args, kwb, l2) => {
              const nt = net(l2);
              b.advanceMicros(30000);
              if (!['broker.home.lan', '192.168.1.10'].includes(c.host)) raise('OSError', '-202', `Δεν βρέθηκε ο υπολογιστής «${c.host}». Ο broker του σπιτιού είναι το broker.home.lan.`, l2);
              b.mqtt.connects++;
              const r = nt.connect('device', { clientId: c.clientId, port: c.port, host: c.host, tls: c.ssl, verify: c.ssl, ca: c.ssl ? 'Home Lab CA' : null, username: c.user, password: c.pass });
              b.mqtt.lastError = r.ok ? null : r.message;
              if (!r.ok) {
                const code = r.code === 'bad-credentials' ? 4 : r.code === 'not-authorised' ? 5 : null;
                if (code) raise('MQTTException', String(code), r.message + (code === 4 ? ' Έλεγξε user και password (από το config, όχι γραμμένα μέσα στον κώδικα).' : ''), l2);
                raise('OSError', '[Errno 104] ECONNRESET', r.message, l2);
              }
              return I(0);
            });
            case 'publish': return builtin('publish', (m3, args, kwb, l2) => {
              const topic = args[0] || kwb.topic;
              const msg = args[1] || kwb.msg;
              if (!topic || !msg) raise('TypeError', 'function missing required positional argument', 'Γράψε client.publish(b"home/temp", b"22.5") ή με κείμενο σε "…".', l2);
              if (msg.t === 'dict' || msg.t === 'list') raise('TypeError', "object with buffer protocol required", 'Ένα λεξικό δεν στέλνεται απευθείας. Μετάτρεψέ το: json.dumps(data).', l2);
              if (msg.t === 'int' || msg.t === 'float') raise('TypeError', "object with buffer protocol required", 'Ένας αριθμός δεν στέλνεται απευθείας. Γράψε str(t) ή json.dumps(…).', l2);
              const nt = net(l2);
              if (!nt.connected('device')) raise('OSError', '[Errno 128] ENOTCONN', 'Κάλεσε πρώτα client.connect().', l2);
              const retain = truthy(args[2] || kwb.retain || B(false));
              const qos = numOf(args[3] || kwb.qos || I(0));
              const r = nt.publish('device', pyStr(topic), pyStr(msg), retain, qos);
              if (!r.ok && !r.denied) b.warnOnce('mppub' + pyStr(topic), l2, r.message, '');
              return NONE;
            });
            case 'subscribe': return builtin('subscribe', (m3, args, kwb, l2) => {
              const topic = args[0] || kwb.topic;
              if (!c.cb) raise('AssertionError', 'Subscribe callback is not set', 'Πριν από το subscribe γράψε client.set_callback(on_message).', l2);
              const nt = net(l2);
              if (!nt.connected('device')) raise('OSError', '[Errno 128] ENOTCONN', 'Κάλεσε πρώτα client.connect().', l2);
              const r = nt.subscribe('device', pyStr(topic));
              if (!r.ok && !r.denied) b.warnOnce('mpsub' + pyStr(topic), l2, r.message, '');
              return NONE;
            });
            case 'set_callback': return builtin('set_callback', (m3, args, kwb, l2) => {
              const f = args[0];
              if (!f || (f.t !== 'function' && f.t !== 'builtin')) raise('TypeError', 'callback must be a function', 'Δώσε το όνομα της συνάρτησης χωρίς παρενθέσεις: client.set_callback(on_message).', l2);
              c.cb = f;
              return NONE;
            });
            case 'check_msg': return builtin('check_msg', (m3, args, kwb, l2) => ({ __gen: (function* () { net(l2); yield* deliver(l2, false); return NONE; })() }));
            case 'wait_msg': return builtin('wait_msg', (m3, args, kwb, l2) => ({ __gen: (function* () { net(l2); yield* deliver(l2, true); return NONE; })() }));
            case 'ping': return builtin('ping', () => NONE);
            case 'disconnect': return builtin('disconnect', () => { if (b.net) b.net.disconnect('device'); return NONE; });
          }
          return undefined;
        },
        short: () => `MQTTClient(${c.clientId}) · ${b.net && b.net.connected('device') ? 'συνδεδεμένο' : 'αποσυνδεδεμένο'}`,
        repr: () => `<MQTTClient ${c.clientId}>`
      };
    });
    return { MQTTClient, MQTTException: TYPE('MQTTException') };
  };

  root.IoTPyMicro = { ESP_ONLY, PI_ONLY };
})(typeof window !== 'undefined' ? window : globalThis);
