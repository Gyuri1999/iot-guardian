/*
 * IoT Guardian — έλεγχος λύσεων με βάση τη συμπεριφορά.
 * Κάθε test ξεκινά από καθαρό εικονικό κόσμο, εφαρμόζει μια ακολουθία γεγονότων
 * και ελέγχει το αποτέλεσμα. Δεν γίνεται απλή σύγκριση κειμένου του κώδικα.
 *
 * Βήματα για ασκήσεις κώδικα:
 *   { setup: true }                      τρέξε globals + setup()
 *   { loops: n }                         τρέξε n επαναλήψεις του loop()
 *   { ms: n }                            τρέξε loop() για n ms εικονικού χρόνου
 *   { set: { button: true } }            άλλαξε είσοδο (button, pir, temp, humidity, sensorFault)
 *   { sequence: { pir: [0,0,1,1,0] } }   για κάθε τιμή: άλλαξε είσοδο και τρέξε 1 loop
 *   { router: false }                    το router του WiFi σβήνει / ανάβει
 *   { restartBroker: true }              ο broker κάνει επανεκκίνηση
 *   { dash: { topic, payload, retain } } το dashboard στέλνει μήνυμα
 *   { act: <βήμα σεναρίου> }             ένας άλλος εικονικός client κάνει κάτι
 *   { redeliver: true }                  ο broker ξαναστέλνει το τελευταίο μήνυμα (διπλή παράδοση)
 *   { check: … }                         δες CHECKS
 *
 * Βήματα για ασκήσεις ρύθμισης broker (mode: 'config'):
 *   { connect: 'esp32-temp', user, pass, port, tls, expect: 'allow'|'deny', fail }
 *   { publish: 'esp32-temp', topic, payload, expect, fail }
 *   { subscribe: 'dashboard', topic, expect, fail }
 */
(function (root) {
  'use strict';

  const { compile, Machine, CodeError } = root.IoTInterp;
  const { Board, PINS } = root.IoTDevice;

  // ------------------------------------------------------------ Κόσμος άσκησης

  function createWorld(spec, inputs) {
    spec = spec || {};
    const board = new Board(Object.assign({}, spec, inputs || {}));
    if (spec.broker) {
      const parsed = root.IoTNet.parseBrokerConfig(spec.broker);
      const net = new root.IoTNet.Network({ now: () => board.micros / 1000, config: parsed.config, cert: spec.cert });
      board.net = net;
      (spec.clients || []).forEach(c => net.addSimClient(c.name, c));
    }
    return board;
  }

  // Εκτελεί ένα βήμα σεναρίου πάνω σε ένα δίκτυο. Επιστρέφει { ok, message }.
  function applyAction(net, step) {
    if (step.connect) {
      return net.connect(step.connect, {
        clientId: step.clientId || step.connect, port: step.port || 1883, tls: !!step.tls, verify: step.verify !== false,
        ca: step.ca || 'Home Lab CA', host: step.host || 'broker.home.lan', username: step.user || null, password: step.pass || null
      });
    }
    if (step.publish) return net.publish(step.publish, step.topic, step.payload || '', !!step.retain, step.qos || 0);
    if (step.subscribe) return net.subscribe(step.subscribe, step.topic);
    if (step.disconnect) { net.disconnect(step.disconnect); return { ok: true }; }
    if (step.restart) { net.restartBroker(); return { ok: true }; }
    return { ok: true };
  }

  // Δημιουργεί συνθετική καταγραφή για ασκήσεις ανάλυσης.
  function buildCapture(spec) {
    // Έτοιμες γραμμές log (π.χ. /var/log/auth.log του Pi): χωρίς broker και χωρίς πακέτα.
    if (spec.lines) {
      return { packets: [], log: spec.lines.map((text, i) => ({ id: i + 1, t: i, text, client: null })), sessions: new Map(), messages: [] };
    }
    let now = 0;
    const parsed = root.IoTNet.parseBrokerConfig(spec.broker);
    const net = new root.IoTNet.Network({ now: () => now, config: parsed.config, cert: spec.cert });
    for (const step of spec.scenario || []) {
      if (step.wait) { now += step.wait; continue; }
      now += step.gap || 3;
      applyAction(net, step);
    }
    return net;
  }

  // Η γλώσσα της άσκησης: 'cpp' (ESP32, προεπιλογή) ή 'python' (Raspberry Pi).
  function engine(lang) {
    if (lang === 'rust') return { compile: root.IoTRust.compile, Machine: root.IoTRust.Machine };
    return lang === 'python' ? { compile: root.IoTPy.compile, Machine: root.IoTPy.Machine } : { compile, Machine };
  }

  // Ένα αίτημα HTTP προς τον εικονικό web server του Pi (από το tablet 192.168.1.20 ή από το ίδιο το Pi).
  // Αν κανείς δεν ακούει, απορρίπτεται αμέσως, όπως μια σύνδεση TCP χωρίς server.
  function httpSend(board, spec) {
    const req = {
      id: board.http.nextId++, method: (spec.method || 'GET').toUpperCase(), path: spec.path || '/',
      from: spec.from === 'pi' ? '127.0.0.1' : (spec.from || '192.168.1.20'),
      headers: spec.headers || {}, port: spec.port || 5000,
      body: spec.json !== undefined ? JSON.stringify(spec.json) : spec.body
    };
    const srv = board.http.server;
    const refuse = why => { req.response = { status: 0, error: why, body: '', contentType: '', headers: {} }; board.http.log.push({ req, resp: req.response, t: board.micros / 1000 }); return req; };
    if (!srv) return refuse('Connection refused: δεν τρέχει web server στο Pi (λείπει το app.run ή το πρόγραμμα σταμάτησε).');
    if (srv.port !== req.port) return refuse(`Connection refused: κανείς δεν ακούει στη θύρα ${req.port} (ο server είναι στη ${srv.port}).`);
    if (srv.host === '127.0.0.1' && req.from !== '127.0.0.1') return refuse('Connection refused: ο server ακούει μόνο στο 127.0.0.1, άρα δέχεται αιτήματα μόνο από το ίδιο το Pi, όχι από το tablet.');
    board.http.queue.push(req);
    return req;
  }

  class Runner {
    constructor(source, spec, inputs, lang) {
      const E = engine(lang);
      const opts = { consts: (spec && spec.consts) || {}, board: spec && spec.board };
      const c = E.compile(source, opts);
      this.source = source;
      this.warnings = c.warnings;
      this.board = createWorld(spec, inputs);
      this.machine = new E.Machine(c.program, this.board, opts);
      this.gen = this.machine.main();
    }
    // Τρέχει μέχρι το γεγονός «kind». Σταματά νωρίτερα αν η πλακέτα κοιμάται και
    // πέρασε η προθεσμία (deadline σε µs), ή στον πρώτο ύπνο αν stopOnSleep.
    advanceTo(kind, deadline, stopOnSleep) {
      for (let guard = 0; guard < 2000000; guard++) {
        const r = this.gen.next();
        if (r.done) return;
        if (r.value.kind === kind) return;
        // Εκτός loop() (π.χ. αναμονή μέσα στο setup()) σταματάμε στην προθεσμία.
        if (deadline !== undefined && this.machine.phase !== 'loop' && this.board.micros >= deadline) return;
        // 'sleeping': ύπνος του ESP32 · 'waiting': αναμονή της Python (time.sleep, loop_forever)
        if (r.value.kind === 'sleeping' || r.value.kind === 'waiting') {
          if (stopOnSleep && r.value.kind === 'sleeping') return;
          if (deadline !== undefined && this.board.micros >= deadline) return;
          if (guard % 100 === 0) this.tick();
        }
      }
      throw new CodeError('Η εκτέλεση κράτησε υπερβολικά πολύ.', null);
    }
    tick() { if (this.board.net) this.board.net.tick(this.board.inputs); }
    request(spec) {
      const req = httpSend(this.board, spec);
      this.lastRequest = req;
      for (let i = 0; i < 200 && !req.response; i++) {
        const before = this.board.micros;
        this.runFor(50);
        if (this.board.micros === before) break;
      }
      if (!req.response) { req.response = { status: 0, error: 'Ο server δεν απάντησε.', body: '', contentType: '', headers: {} }; }
      return req;
    }
    runSetup() { this.tick(); this.advanceTo('loopStart', undefined, true); }
    runLoops(n) { for (let i = 0; i < n; i++) { this.tick(); this.advanceTo('loopEnd'); } }
    runFor(ms) {
      const end = this.board.micros + ms * 1000;
      for (let guard = 0; guard < 200000 && this.board.micros < end; guard++) { this.tick(); this.advanceTo('loopEnd', end); }
    }
  }

  const fill = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ''));
  const lines = b => b.serial.map(e => e.text.trim());
  const countOf = (b, text) => lines(b).filter(l => l === text).length;
  const listText = arr => (arr.length ? arr.map(x => `«${x}»`).join(', ') : 'τίποτα');

  function jsonMatches(payload, want) {
    let o;
    try { o = JSON.parse(payload); } catch (e) { return false; }
    if (!o || typeof o !== 'object') return false;
    return Object.entries(want).every(([k, v]) => JSON.stringify(o[k]) === JSON.stringify(v));
  }

  function devicePublishes(b, c) {
    if (!b.net) return [];
    return b.net.messages.filter(m => m.client === 'device' && !m.denied && m.topic === c.topic && (!c.json || jsonMatches(m.payload, c.json)) && (c.payload === undefined || m.payload === c.payload));
  }

  const CHECKS = {
    led(b, c) { return { pass: b.led === c.is, vars: { v: b.led ? 'αναμμένο' : 'σβηστό' } }; },
    // Φανάρι: { check: 'lights', red: true, yellow: false, green: false } (όσα δοθούν)
    lights(b, c) {
      const now = { red: b.light(PINS.RED), yellow: b.light(PINS.YELLOW), green: b.light(PINS.GREEN) };
      const pass = ['red', 'yellow', 'green'].every(k => c[k] === undefined || now[k] === c[k]);
      const gr = { red: 'κόκκινο', yellow: 'κίτρινο', green: 'πράσινο' };
      const on = Object.keys(now).filter(k => now[k]).map(k => gr[k]);
      return { pass, vars: { v: on.length ? on.join(' + ') : 'όλα σβηστά' } };
    },
    // Buzzer: { check: 'buzzer', is: true, freq: 440 } (το freq είναι προαιρετικό)
    buzzer(b, c) {
      const f = b.buzzerFreq ? b.buzzerFreq() : 0;
      const pass = (f > 0) === c.is && (c.freq === undefined || !c.is || Math.abs(f - c.freq) <= 1);
      return { pass, vars: { v: f ? `${f} Hz` : 'σιωπή' } };
    },
    // Πόσες νότες ξεκίνησαν (tone) από την αρχή: { check: 'tones', min: 3, freqs: [262, 330] }
    tones(b, c) {
      const t = b.buzzer ? b.buzzer.tones : [];
      const okF = !c.freqs || c.freqs.every(f => t.some(x => Math.abs(x.f - f) <= 1));
      return { pass: t.length >= (c.min || 1) && okF, vars: { n: t.length, v: t.slice(-6).map(x => x.f + ' Hz').join(', ') || 'καμία νότα' } };
    },
    // Servo: { check: 'servo', angle: 90 }
    servo(b, c) {
      const s = b.servo || { attached: false, angle: 90 };
      return { pass: s.attached && Math.abs(s.angle - c.angle) <= (c.tol || 2), vars: { v: s.attached ? `${s.angle}°` : 'χωρίς servo.attach' } };
    },
    // LED RGB: { check: 'rgb', r: 255, g: 0, b: 0 } (όποιο λείπει δεν ελέγχεται)
    rgb(b, c) {
      const [r, g, bl] = b.rgb ? b.rgb() : [0, 0, 0];
      const near = (x, y) => y === undefined || Math.abs(x - y) <= (c.tol || 12);
      return { pass: near(r, c.r) && near(g, c.g) && near(bl, c.b), vars: { v: `R ${r}, G ${g}, B ${bl}` } };
    },
    // OLED: { check: 'oled', has: '24.5' } ή { check: 'oled', empty: false }
    oled(b, c) {
      const t = b.oledText ? b.oledText().replace(/\s+/g, ' ').trim() : '';
      const pass = c.has !== undefined ? t.includes(c.has) : c.empty !== undefined ? (t === '') === c.empty : t !== '';
      return { pass, vars: { v: t ? `«${t}»` : (b.oled && b.oled.pending ? 'τίποτα (λείπει το display.display())' : 'τίποτα') } };
    },
    ledOutput(b) { return { pass: b.modes[PINS.LED] === 3, vars: { v: b.modeName(PINS.LED) || 'δεν ορίστηκε' } }; },
    count(b, c) {
      const n = countOf(b, c.text);
      const pass = c.is !== undefined ? n === c.is : (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max);
      return { pass, vars: { n } };
    },
    total(b, c) { const n = lines(b).length; return { pass: n === c.is, vars: { n } }; },
    lines(b, c) {
      const l = lines(b);
      const pass = l.length === c.is.length && l.every((x, i) => x === c.is[i]);
      return { pass, vars: { v: listText(l.slice(0, 8)) } };
    },
    order(b, c) {
      const l = lines(b).filter(x => c.texts.includes(x));
      const pass = l.length === c.texts.length && l.every((x, i) => x === c.texts[i]);
      return { pass, vars: { v: listText(l.slice(0, 8)) } };
    },
    lastLine(b, c) {
      const l = lines(b);
      const last = l.length ? l[l.length - 1] : null;
      let pass = last !== null;
      if (c.is !== undefined) pass = pass && last === c.is;
      if (c.not !== undefined) pass = pass && last !== c.not;
      if (c.notEmpty) pass = pass && last.length > 0;
      return { pass, vars: { v: last === null ? 'τίποτα' : `«${last}»` } };
    },
    serialHas(b, c) { return { pass: lines(b).some(l => l.includes(c.text)), vars: { v: listText(lines(b).slice(-5)) } }; },
    serialNot(b, c) { return { pass: !b.serial.some(l => l.text.includes(c.text)), vars: {} }; },
    published(b, c) {
      const n = devicePublishes(b, c).length;
      const pass = c.is !== undefined ? n === c.is : (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max);
      const all = b.net ? b.net.messages.filter(m => m.client === 'device').slice(-4).map(m => `${m.topic} ${m.payload}`) : [];
      return { pass, vars: { n, v: listText(all) } };
    },
    dashboard(b, c) {
      const d = b.net && b.net.dashboard;
      const v = d && d.values[c.topic];
      let pass;
      if (c.exists === false) pass = !v;
      else pass = !!v && (c.json ? jsonMatches(v.payload, c.json) : c.payload === undefined || v.payload === c.payload);
      return { pass, vars: { v: v ? `«${v.payload}»` : 'τίποτα' } };
    },
    retained(b, c) {
      const r = b.net && b.net.retained.get(c.topic);
      return { pass: c.exists === false ? !r : !!r, vars: { v: r ? `«${r.payload}»` : 'τίποτα' } };
    },
    wifiAttempts(b, c) {
      const n = b.wifi.begins + b.wifi.reconnects;
      const pass = (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max);
      return { pass, vars: { n } };
    },
    wifiConnected(b, c) { return { pass: (b.wifiStatus() === 3) === c.is, vars: {} }; },
    mqttConnected(b, c) { return { pass: !!(b.net && b.net.connected('device')) === c.is, vars: { v: b.mqtt.lastError || '' } }; },
    mqttAttempts(b, c) { const n = b.mqtt.connects; return { pass: (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max), vars: { n } }; },
    deviceEncrypted(b) {
      const plain = b.net ? b.net.packets.filter(p => p.client === 'device' && p.proto === 'MQTT').length : 0;
      const tls = b.net ? b.net.packets.filter(p => p.client === 'device' && p.proto === 'TLS').length : 0;
      return { pass: plain === 0 && tls > 0, vars: { n: plain } };
    },
    tlsMode(b, c) { return { pass: b.mqtt.tlsMode === c.is, vars: { v: b.mqtt.tlsMode } }; },
    sourceNot(b, c, runner) { return { pass: !runner.source.includes(c.text), vars: {} }; },
    avgCurrent(b, c) {
      const ma = b.avgMa();
      const pass = (c.max === undefined || ma <= c.max) && (c.min === undefined || ma >= c.min);
      return { pass, vars: { v: ma < 1 ? ma.toFixed(3) : ma.toFixed(1) } };
    },
    sleepShare(b, c) {
      const e = b.energy;
      const pct = e.us ? (100 * (c.mode === 'any' ? e.byState.light + e.byState.deep : e.byState[c.mode])) / e.us : 0;
      return { pass: pct >= c.min, vars: { v: pct.toFixed(0) } };
    },
    boots(b, c) {
      const n = b.boots;
      return { pass: (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max), vars: { n } };
    },
    response(b, c, runner) {
      const req = runner.lastRequest;
      const r = req && req.response;
      if (!r) return { pass: false, vars: { v: 'δεν στάλθηκε αίτημα', n: 0 } };
      let pass = true;
      if (c.status !== undefined) pass = pass && r.status === c.status;
      if (c.contains) pass = pass && [].concat(c.contains).every(t => r.body.includes(t));
      if (c.notContains) pass = pass && [].concat(c.notContains).every(t => !r.body.includes(t));
      if (c.json) {
        let o = null;
        try { o = JSON.parse(r.body); } catch (e) { o = null; }
        pass = pass && !!o && typeof o === 'object' && Object.entries(c.json).every(([k, v]) => JSON.stringify(o[k]) === JSON.stringify(v));
      }
      if (c.contentType) pass = pass && (r.contentType || '').includes(c.contentType);
      return { pass, vars: { v: r.status === 0 ? r.error : `${r.status} · ${r.body.replace(/\s+/g, ' ').trim().slice(0, 140)}`, n: r.status } };
    },
    dbRows(b, c) {
      const db = c.file ? b.db[c.file] : Object.values(b.db || {})[0];
      const t = db && db.committed.get(c.table.toLowerCase());
      let rows = t ? t.rows : [];
      if (c.where) rows = rows.filter(r => Object.entries(c.where).every(([k, v]) => { const x = r.vals.get(k.toLowerCase()); return !!x && (x.t === 'NoneType' ? v === null : x.v === v); }));
      const n = rows.length;
      const pass = !!t && (c.is !== undefined ? n === c.is : (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max));
      return { pass, vars: { n, v: t ? `${n} γραμμές με commit` : `δεν υπάρχει πίνακας ${c.table} με commit` } };
    },
    wakeups(b, c) {
      const n = b.wakeups.filter(w => (c.cause === undefined || w.cause === c.cause) && (c.mode === undefined || w.mode === c.mode)).length;
      return { pass: (c.min === undefined || n >= c.min) && (c.max === undefined || n <= c.max), vars: { n } };
    }
  };

  function runCodeTest(code, test, spec, lang) {
    let runner;
    try {
      // Ένα test μπορεί να αλλάξει το πιστοποιητικό του broker (π.χ. world: { cert: 'expired' }).
      const testSpec = test.world && test.world.cert ? Object.assign({}, spec, { cert: test.world.cert }) : spec;
      runner = new Runner(code, testSpec, test.world, lang);
      for (const step of test.script) {
        if (step.setup) runner.runSetup();
        else if (step.loops) runner.runLoops(step.loops);
        else if (step.ms) runner.runFor(step.ms);
        else if (step.set) Object.assign(runner.board.inputs, step.set);
        else if (step.sequence) {
          const [key, values] = Object.entries(step.sequence)[0];
          for (const v of values) { runner.board.inputs[key] = typeof v === 'number' && key !== 'button' && key !== 'pir' ? v : !!v; runner.runLoops(1); }
        } else if (step.router !== undefined) runner.board.setRouter(!!step.router);
        else if (step.restartBroker) runner.board.net.restartBroker();
        else if (step.dash) {
          runner.tick();
          runner.board.net.publish('dashboard', step.dash.topic, step.dash.payload, !!step.dash.retain, step.dash.qos || 0);
        } else if (step.act) applyAction(runner.board.net, step.act);
        else if (step.redeliver) runner.board.net.redeliverLast('device');
        else if (step.request) runner.request(step.request);
        else if (step.check) {
          const fn = CHECKS[step.check];
          if (!fn) throw new Error('Άγνωστος έλεγχος: ' + step.check);
          const r = fn(runner.board, step, runner);
          if (!r.pass) {
            const msg = (r.vars.n === 0 && step.failZero) ? step.failZero : step.fail;
            return { name: test.name, pass: false, message: fill(msg, r.vars) };
          }
        }
      }
      return { name: test.name, pass: true, message: '' };
    } catch (e) {
      if (e instanceof CodeError || e.name === 'CodeError') {
        return { name: test.name, pass: false, message: e.message + (e.hint ? ' ' + e.hint : ''), line: e.line, codeError: true };
      }
      throw e;
    }
  }

  function runConfigTest(text, test, spec) {
    let parsed;
    try {
      parsed = root.IoTNet.parseBrokerConfig(text);
    } catch (e) {
      return { name: test.name, pass: false, message: e.message + (e.hint ? ' ' + e.hint : ''), line: e.line, codeError: true };
    }
    let now = 0;
    const net = new root.IoTNet.Network({ now: () => now, config: parsed.config, cert: (test.world && test.world.cert) || (spec && spec.cert) || 'valid' });
    for (const step of test.script) {
      now += 5;
      const r = applyAction(net, step);
      if (step.expect) {
        const allowed = !!r.ok;
        if (allowed !== (step.expect === 'allow')) {
          return { name: test.name, pass: false, message: fill(step.fail, { v: r.message || (allowed ? 'επιτράπηκε' : 'απορρίφθηκε') }), log: net.log.slice() };
        }
      }
    }
    return { name: test.name, pass: true, message: '', log: net.log.slice() };
  }

  function runTests(code, tests, lesson) {
    const mode = lesson && lesson.mode;
    const world = lesson && lesson.world;
    // η πλακέτα της άσκησης (Rust και MicroPython τρέχουν σε ESP32 ή Raspberry Pi)
    const spec = lesson && lesson.board ? Object.assign({}, world || {}, { board: lesson.board }) : world;
    if (mode === 'config' && lesson.system) return tests.map(t => root.IoTSys.runTest(code, t, lesson));
    return tests.map(t => (mode === 'config' ? runConfigTest(code, t, spec) : runCodeTest(code, t, spec, lesson && lesson.lang)));
  }

  function runTest(code, test, lesson) { return runTests(code, [test], lesson)[0]; }

  root.IoTValidator = { Runner, runTests, runTest, CHECKS, createWorld, applyAction, buildCapture, engine, httpSend };
})(typeof window !== 'undefined' ? window : globalThis);
