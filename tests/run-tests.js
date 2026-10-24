#!/usr/bin/env node
/* IoT Guardian — unit και integration tests. Εκτέλεση: node tests/run-tests.js */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
// Χρήση: node tests/run-tests.js [--only c4]   (το --only περιορίζει τα tests μαθημάτων σε ids που ξεκινούν έτσι)
const onlyIdx = process.argv.indexOf('--only');
const ONLY = onlyIdx > 0 ? process.argv[onlyIdx + 1] : null;
const ctx = vm.createContext({ console });
const loadErrors = [];
for (const f of ['interpreter.js', 'pyinterp.js', 'pyweb.js', 'pymicro.js', 'pyparts.js', 'device.js', 'network.js', 'validator.js', 'pisys.js', 'rsinterp.js', 'rsruntime.js', 'rslib.js', 'rscheck.js', 'lessons.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
}
const extra = fs.existsSync(path.join(ROOT, 'js', 'lessons')) ? fs.readdirSync(path.join(ROOT, 'js', 'lessons')).filter(f => f.endsWith('.js')).sort() : [];
for (const f of extra) {
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'lessons', f), 'utf8'), ctx, { filename: 'lessons/' + f }); }
  catch (e) { loadErrors.push(f + ': ' + e.message); }
}
for (const f of ['cases.js', 'cases-data.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx, { filename: f });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'storage.js'), 'utf8'), ctx, { filename: 'storage.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'learn.js'), 'utf8'), ctx, { filename: 'learn.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'wiring.js'), 'utf8'), ctx, { filename: 'wiring.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'challenge.js'), 'utf8'), ctx, { filename: 'challenge.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'blocks.js'), 'utf8'), ctx, { filename: 'blocks.js' });
const { IoTInterp, IoTDevice, IoTValidator, IoTLessons, IoTStorage, IoTLearn, IoTWiring, IoTChallenge, IoTBlocks, IoTCases } = ctx;

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || '') + ` αναμενόταν ${JSON.stringify(b)}, βρέθηκε ${JSON.stringify(a)}`); }
function codeError(src) {
  try { IoTInterp.compile(src); } catch (e) { if (e.name === 'CodeError') return e; throw e; }
  throw new Error('αναμενόταν CodeError');
}
function run(src, loops, world) {
  const r = new IoTValidator.Runner(src, world);
  r.runSetup();
  if (loops) r.runLoops(loops);
  return r;
}
const wrap = (setup, loop, globals) => `${globals || ''}\nvoid setup() {\n${setup || ''}\n}\nvoid loop() {\n${loop || ''}\n}\n`;

console.log('\nParser και μη υποστηριζόμενη σύνταξη');
test('ελληνικό ερωτηματικό → σφάλμα στη σωστή γραμμή', () => {
  const e = codeError('void setup() {\n  pinMode(LED_PIN, OUTPUT);\n}\nvoid loop() {}');
  eq(e.line, 2); assert(/ελληνικό ερωτηματικό/.test(e.message));
});
test('λείπει ; → δείχνει τη γραμμή της εντολής', () => {
  const e = codeError('void setup() {\n  pinMode(LED_PIN, OUTPUT)\n  digitalWrite(LED_PIN, HIGH);\n}\nvoid loop() {}');
  eq(e.line, 2); assert(/Λείπει το ;/.test(e.message));
});
test('λείπει } → αναφέρει τη γραμμή του {', () => {
  const e = codeError('void setup() {\n  delay(1);\nvoid loop() {}');
  assert(/ορίσεις συνάρτηση μέσα/.test(e.message) || /Λείπει ένα }/.test(e.message), e.message);
});
test('switch → σαφές μήνυμα μη υποστήριξης', () => {
  const e = codeError(wrap('', 'switch (1) {}'));
  assert(/switch δεν υποστηρίζεται/.test(e.message));
});
test('πίνακες → σαφές μήνυμα', () => {
  const e = codeError(wrap('', '', 'int a[3];'));
  assert(/πίνακες/.test(e.message));
});
test('λάθος κεφαλαία → πρόταση διόρθωσης', () => {
  const e = codeError(wrap('digitalwrite(LED_PIN, HIGH);'));
  assert(/digitalWrite/.test(e.message), e.message);
});
test('κενό ____ → οδηγία συμπλήρωσης', () => {
  const e = codeError(wrap('', 'int x = ____;'));
  assert(/Συμπλήρωσε το κενό/.test(e.message));
});
test('αδήλωτη μεταβλητή', () => {
  const e = codeError(wrap('', 'counter = 1;'));
  assert(/δεν έχει δηλωθεί/.test(e.message));
});
test('λείπει loop()', () => {
  const e = codeError('void setup() {}');
  assert(/loop/.test(e.message));
});
test('ανάθεση σε σταθερά → σφάλμα', () => {
  const e = codeError(wrap('HIGH = 0;'));
  assert(/σταθερά/.test(e.message));
});
test('= μέσα σε if → προειδοποίηση, όχι σφάλμα', () => {
  const c = IoTInterp.compile(wrap('', 'int b = 0; if (b = HIGH) { }'));
  assert(c.warnings.some(w => /ανάθεση/.test(w.text)));
});
test('σύγκριση χωρίς χρήση → σφάλμα με εξήγηση', () => {
  const e = codeError(wrap('', 'int b = 0; b == 1;'));
  assert(/συγκρίνει/.test(e.message));
});

console.log('\nΜεταβλητές, if/else, χρονισμός');
test('int κόβει τα δεκαδικά', () => {
  const r = run(wrap('Serial.begin(115200); int x = 7 / 2; Serial.println(x); float y = 7.0 / 2; Serial.println(y);'));
  eq(r.board.serialLines(), ['3', '3.50']);
});
test('global μεταβλητή θυμάται ανάμεσα σε επαναλήψεις', () => {
  const r = run(wrap('Serial.begin(115200);', 'counter++; Serial.println(counter);', 'int counter = 0;'), 3);
  eq(r.board.serialLines(), ['1', '2', '3']);
});
test('local μεταβλητή ξαναρχίζει σε κάθε επανάληψη', () => {
  const r = run(wrap('Serial.begin(115200);', 'int c = 0; c++; Serial.println(c);'), 3);
  eq(r.board.serialLines(), ['1', '1', '1']);
});
test('if/else επιλέγει σωστό σκέλος και καταγράφει γιατί', () => {
  const src = wrap('pinMode(LED_PIN, OUTPUT);', 'if (digitalRead(BUTTON_PIN) == HIGH) { digitalWrite(LED_PIN, HIGH); } else { digitalWrite(LED_PIN, LOW); }');
  const off = run(src, 1, { button: false });
  eq(off.board.led, false); eq(off.machine.lastBranch.branch, 'else');
  const on = run(src, 1, { button: true });
  eq(on.board.led, true); eq(on.machine.lastBranch.branch, 'if');
});
test('&& και || με βραχυκύκλωμα', () => {
  const r = run(wrap('Serial.begin(115200); int a = 0; if (a == 1 && 10 / a > 1) { Serial.println("x"); } if (a == 0 || 10 / a > 1) { Serial.println("ok"); }'));
  eq(r.board.serialLines(), ['ok']);
});
test('for και while', () => {
  const r = run(wrap('Serial.begin(115200); int s = 0; for (int i = 0; i < 4; i++) { s += i; } int k = 3; while (k > 0) { k--; } Serial.println(s); Serial.println(k);'));
  eq(r.board.serialLines(), ['6', '0']);
});
test('συναρτήσεις με παραμέτρους και return', () => {
  const r = run('int twice(int v) {\n return v * 2;\n}\nvoid setup() { Serial.begin(115200); Serial.println(twice(21)); }\nvoid loop() {}');
  eq(r.board.serialLines(), ['42']);
});
test('delay και millis με εικονικό ρολόι', () => {
  const r = run(wrap('Serial.begin(115200);', 'delay(1000); Serial.println(millis() / 1000);'), 3);
  eq(r.board.serialLines(), ['1', '2', '3']);
});
test('print + println στην ίδια γραμμή', () => {
  const r = run(wrap('Serial.begin(115200); Serial.print("A="); Serial.println(5);'));
  eq(r.board.serialLines(), ['A=5']);
});
test('όριο βημάτων σταματά ατέρμονο βρόχο', () => {
  let err = null;
  try { run(wrap('', 'while (true) { }'), 1); } catch (e) { err = e; }
  assert(err && err.name === 'CodeError' && /βήματα/.test(err.message), err && err.message);
});
test('διαίρεση με μηδέν → σφάλμα με γραμμή', () => {
  let err = null;
  try { run(wrap('int z = 0;\nint q = 5 / z;')); } catch (e) { err = e; }
  assert(err && err.line === 4, err && (err.message + ' line ' + err.line));
});
test('digitalWrite χωρίς pinMode → προειδοποίηση και σβηστό LED', () => {
  const r = run(wrap('digitalWrite(LED_PIN, HIGH);'));
  eq(r.board.led, false);
  assert(r.board.warnings.some(w => /OUTPUT/.test(w.text)));
});
test('βήμα-βήμα: κάθε βήμα αντιστοιχεί σε ορατή γραμμή', () => {
  const src = 'void setup() {\n  pinMode(LED_PIN, OUTPUT);\n  digitalWrite(LED_PIN, HIGH);\n}\nvoid loop() {\n  delay(10);\n}\n';
  const c = IoTInterp.compile(src);
  const m = new IoTInterp.Machine(c.program, new IoTDevice.Board());
  const g = m.main();
  const seen = [];
  while (seen.length < 4) { const r = g.next(); if (r.value.kind === 'line') seen.push(r.value.line); }
  eq(seen, [2, 3, 6, 6]);
});
test('ο interpreter δεν χρησιμοποιεί eval ή new Function', () => {
  for (const f of ['interpreter.js', 'device.js', 'validator.js']) {
    const s = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert(!/\beval\s*\(/.test(s) && !/new\s+Function\s*\(/.test(s), f);
  }
});

console.log('\nΠίνακας επαναλήψεων');
test('καταγράφει είσοδο, μεταβλητές και έξοδο ανά επανάληψη', () => {
  const r = new IoTValidator.Runner(wrap('Serial.begin(115200);', 'int m = digitalRead(PIR_PIN); if (m != last) { Serial.println("ch"); } last = m;', 'int last = LOW;'), { pir: false });
  r.runSetup();
  for (const v of [0, 1, 1]) { r.board.inputs.pir = !!v; r.runLoops(1); }
  const log = r.machine.loopLog;
  eq(log.map(x => x.inputs.pir), [false, true, true]);
  eq(log.map(x => x.output.length), [0, 1, 0]);
  eq(log[2].vars.last, '1');
});

console.log('\nΜαθήματα: λύση περνά, αρχικός κώδικας αποτυγχάνει');
test('όλα τα αρχεία μαθημάτων φορτώνονται', () => {
  const relevant = ONLY ? loadErrors.filter(e => e.startsWith('ch' + ONLY.slice(1).padStart(2, '0'))) : loadErrors;
  assert(!relevant.length, relevant.join(' | '));
});
test('μοναδικά ids μαθημάτων και έγκυρα prerequisites', () => {
  const ids = IoTLessons.lessons.map(l => l.id);
  eq(ids.length, new Set(ids).size, 'διπλά ids');
  for (const l of IoTLessons.lessons) for (const p of l.prerequisites) assert(ids.includes(p), l.id + ' → ' + p);
});
for (const l of IoTLessons.lessons.filter(x => !ONLY || x.id.startsWith(ONLY + '-'))) {
  if (l.mode === 'analysis') {
    test(`${l.id} ανάλυση: η καταγραφή έχει τα τεκμήρια`, () => {
      const net = IoTValidator.buildCapture(l.capture);
      if (l.evidence.filter) {
        const f = ctx.IoTNet.compileFilter(l.evidence.filter);
        assert(f.ok, f.error);
        const n = net.packets.filter(f.fn).length;
        assert(n >= 1 && n < net.packets.length, 'τεκμήρια: ' + n + ' από ' + net.packets.length);
      } else {
        const n = net.log.filter(x => x.text.includes(l.evidence.log)).length;
        assert(n >= 1 && n < net.log.length, 'γραμμές log: ' + n + ' από ' + net.log.length);
      }
    });
    test(`${l.id} έχει 3 hints, quiz και πεδία μαθήματος`, () => {
      eq(l.hints.length, 3);
      assert(l.quiz && l.quiz.options[l.quiz.answer]);
      for (const k of ['id', 'title', 'prerequisites', 'objectives', 'theory', 'glossary', 'steps', 'explanationOnSuccess', 'remediation', 'capture', 'evidence']) assert(k in l, 'λείπει ' + k);
    });
    continue;
  }
  test(`${l.id} λύση περνά όλους τους ελέγχους`, () => {
    const res = IoTValidator.runTests(l.solution, l.validationTests, l);
    const bad = res.filter(r => !r.pass);
    assert(!bad.length, bad.map(b => b.name + ': ' + b.message).join(' | '));
  });
  test(`${l.id} αρχικός κώδικας ${l.initialPasses ? 'περνά (μικρομάθημα παρατήρησης)' : 'δεν περνά'}`, () => {
    const res = IoTValidator.runTests(l.initialCode, l.validationTests, l);
    const allPass = res.every(r => r.pass);
    eq(allPass, !!l.initialPasses);
  });
  test(`${l.id} έχει 3 hints, quiz και πεδία μαθήματος`, () => {
    eq(l.hints.length, 3);
    assert(l.quiz && l.quiz.options[l.quiz.answer]);
    for (const k of ['id', 'title', 'prerequisites', 'objectives', 'theory', 'glossary', 'initialCode', 'supportedSyntax', 'initialWorld', 'steps', 'validationTests', 'explanationOnSuccess', 'remediation']) assert(k in l, 'λείπει ' + k);
  });
}
test('κάθε κεφάλαιο έχει ≥3 μικρομαθήματα/ασκήσεις, καθοδηγούμενη, παραλλαγή/ανεξάρτητη και εντοπισμό λάθους', () => {
  for (const ch of IoTLessons.CHAPTERS.filter(c => c.ready && (!ONLY || 'c' + c.n === ONLY)).map(c => c.n)) {
    const ls = IoTLessons.lessons.filter(l => l.chapter === ch);
    assert(ls.length >= 3, 'κεφ. ' + ch);
    assert(ls.some(l => l.kind === 'guided'), 'guided κεφ. ' + ch);
    assert(ls.some(l => l.kind === 'checkpoint' || l.kind === 'debug'), 'debug κεφ. ' + ch);
  }
});
test('εναλλακτική σωστή λύση περνά (έλεγχος συμπεριφοράς, όχι κειμένου)', () => {
  const l = IoTLessons.lessons.find(x => x.id === 'c2-l4');
  const alt = l.initialCode.replace('digitalWrite(LED_PIN, HIGH);\n  } else {\n    digitalWrite(LED_PIN, LOW);', 'digitalWrite(LED_PIN, LOW);\n  } else {\n    digitalWrite(LED_PIN, HIGH);');
  assert(alt !== l.initialCode);
  assert(IoTValidator.runTests(alt, l.validationTests, l).every(r => r.pass));
});

console.log('\nΑισθητήρες, WiFi, MQTT, δίκτυο');
const N = ctx.IoTNet;
const OPEN = 'listener 1883\nallow_anonymous true\n';
const SECURE = 'listener 8883\ntls on\nallow_anonymous false\npassword esp32-pir pir-Secret-2026\npassword dashboard dash-Secret-2026\nuser esp32-pir\ntopic write home/motion\ntopic read home/led/set\nuser dashboard\ntopic read home/#\ntopic write home/led/set\n';
test('topicMatches με + και #', () => {
  assert(N.topicMatches('home/#', 'home/led/set'));
  assert(N.topicMatches('home/+/state', 'home/led/state'));
  assert(!N.topicMatches('home/+/state', 'home/led/set'));
  assert(N.topicMatches('home/#', 'home'));
  assert(!N.topicMatches('home/led', 'home/led/set'));
});
test('filterCovers για ACL σε subscribe', () => {
  assert(N.filterCovers('home/#', 'home/+/state'));
  assert(!N.filterCovers('home/+/state', 'home/#'));
  assert(!N.filterCovers('home/led/state', 'home/+/state'));
  assert(N.filterCovers('#', 'anything/#'));
});
test('parseBrokerConfig: σφάλμα με γραμμή και ελληνική εξήγηση', () => {
  let e = null;
  try { N.parseBrokerConfig('listener 1883\ntopic read home/#'); } catch (x) { e = x; }
  assert(e && e.line === 2 && /user/.test(e.message + e.hint), e && e.message);
  let e2 = null;
  try { N.parseBrokerConfig('listener 1883\nallow_anonymus false'); } catch (x) { e2 = x; }
  assert(e2 && e2.line === 2 && /Άγνωστη/.test(e2.message));
});
test('parseBrokerConfig: προειδοποίηση για πολύ ευρύ κανόνα', () => {
  const r = N.parseBrokerConfig('listener 1883\npassword x abcdefghijklmn\nuser x\ntopic readwrite #');
  assert(r.warnings.some(w => /ευρύς/.test(w.text)));
});
test('broker: ανώνυμη σύνδεση απορρίπτεται όταν allow_anonymous false', () => {
  const net = new N.Network({ config: N.parseBrokerConfig(SECURE).config });
  assert(!net.connect('unknown-device', { clientId: 'x', port: 8883, tls: true, verify: true, ca: 'Home Lab CA', host: 'broker.home.lan' }).ok);
  assert(net.connect('esp32-pir', { clientId: 'esp32-pir', port: 8883, tls: true, verify: true, ca: 'Home Lab CA', host: 'broker.home.lan', username: 'esp32-pir', password: 'pir-Secret-2026' }).ok);
});
test('broker: ACL write/read και παράδοση μόνο σε εξουσιοδοτημένους', () => {
  const net = new N.Network({ config: N.parseBrokerConfig(SECURE).config });
  const o = (u, p) => ({ clientId: u, port: 8883, tls: true, verify: true, ca: 'Home Lab CA', host: 'broker.home.lan', username: u, password: p });
  net.connect('esp32-pir', o('esp32-pir', 'pir-Secret-2026'));
  net.connect('dashboard', o('dashboard', 'dash-Secret-2026'));
  assert(net.subscribe('dashboard', 'home/#').ok);
  assert(!net.subscribe('esp32-pir', 'home/#').ok);
  assert(net.publish('esp32-pir', 'home/motion', '{"motion":true}').ok);
  assert(!net.publish('esp32-pir', 'home/led/set', 'ON').ok);
  eq(net.readNext('dashboard').topic, 'home/motion');
  eq(net.readNext('dashboard'), null);
});
test('broker: retained παραδίδεται σε νέο subscriber', () => {
  const net = new N.Network({ config: N.parseBrokerConfig(OPEN).config });
  const o = id => ({ clientId: id, port: 1883 });
  net.connect('esp32-temp', o('t'));
  net.publish('esp32-temp', 'home/temperature', '{"t":21.5}', true);
  net.connect('dashboard', o('d'));
  net.subscribe('dashboard', 'home/#');
  const m = net.readNext('dashboard');
  assert(m && m.retained && m.payload === '{"t":21.5}');
});
test('TLS: plaintext στη θύρα TLS απορρίπτεται, πιστοποιητικά ελέγχονται', () => {
  const cfg = N.parseBrokerConfig('listener 8883\ntls on\n').config;
  const base = { clientId: 'x', port: 8883, ca: 'Home Lab CA', host: 'broker.home.lan' };
  eq(new N.Network({ config: cfg }).connect('device', Object.assign({ tls: false }, base)).code, 'tls-mismatch');
  eq(new N.Network({ config: cfg, cert: 'expired' }).connect('device', Object.assign({ tls: true, verify: true }, base)).code, 'bad-cert');
  eq(new N.Network({ config: cfg, cert: 'wrong-host' }).connect('device', Object.assign({ tls: true, verify: true }, base)).code, 'bad-cert');
  eq(new N.Network({ config: cfg, cert: 'untrusted' }).connect('device', Object.assign({ tls: true, verify: true }, base)).code, 'bad-cert');
  assert(new N.Network({ config: cfg, cert: 'expired' }).connect('device', Object.assign({ tls: true, verify: false }, base)).ok, 'insecure δέχεται τα πάντα');
  assert(new N.Network({ config: cfg }).connect('device', Object.assign({ tls: true, verify: true }, base)).ok);
});
test('TLS: η καταγραφή κρύβει περιεχόμενο αλλά δείχνει μεταδεδομένα', () => {
  const net = new N.Network({ config: N.parseBrokerConfig('listener 8883\ntls on\n').config });
  net.connect('device', { clientId: 'x', port: 8883, tls: true, verify: true, ca: 'Home Lab CA', host: 'broker.home.lan' });
  net.publish('device', 'home/door', '{"status":"closed"}');
  const p = net.packets[net.packets.length - 1];
  eq(p.proto, 'TLS'); eq(p.info, 'Application Data'); eq(p.src, '192.168.1.42');
  assert(!JSON.stringify(p.detail.tls).includes('home/door'));
});
test('φίλτρα Network Monitor', () => {
  const net = new N.Network({ config: N.parseBrokerConfig(OPEN).config });
  net.connect('esp32-temp', { clientId: 't', port: 1883 });
  net.publish('esp32-temp', 'home/temperature', '21');
  const f = N.compileFilter('ip.src == 192.168.1.43 && mqtt.topic == "home/temperature"');
  assert(f.ok); eq(net.packets.filter(f.fn).length, 1);
  assert(N.compileFilter('tcp.port == 1883').ok);
  assert(!N.compileFilter('frame.len > 3').ok);
});
test('JSON βοηθοί', () => {
  assert(N.jsonValid('{"cmd":"ON"}')); assert(!N.jsonValid('{cmd:ON}')); assert(!N.jsonValid('[1]'));
  eq(N.jsonGet('{"id":17,"cmd":"ON"}', 'id'), '17'); eq(N.jsonGet('{"a":1}', 'b'), '');
});
const WORLD7 = { wifi: 'connected', broker: OPEN, clients: [{ name: 'dashboard', subs: ['home/#'] }] };
test('συσκευή: WiFi.begin συνδέεται μετά από εικονικό χρόνο και δίνει IP', () => {
  const src = wrap('Serial.begin(115200);\nWiFi.begin(WIFI_SSID, WIFI_PASSWORD);\nwhile (WiFi.status() != WL_CONNECTED) { delay(100); }\nSerial.println(WiFi.localIP());');
  const r = new IoTValidator.Runner(src, {});
  r.runSetup();
  eq(r.board.serialLines(), ['192.168.1.42']);
  assert(r.board.millis >= 1200);
});
test('συσκευή: λάθος κωδικός WiFi → WL_CONNECT_FAILED', () => {
  const src = wrap('Serial.begin(115200);\nWiFi.begin(WIFI_SSID, "wrong");\ndelay(4000);\nSerial.println(WiFi.status());');
  const r = new IoTValidator.Runner(src, {}); r.runSetup();
  eq(r.board.serialLines(), ['4']);
});
test('συσκευή: router κάτω → WiFi χάνεται και το MQTT αποσυνδέεται', () => {
  const src = wrap('mqtt.setServer(MQTT_HOST, 1883);\nmqtt.connect("esp32-pir");', '');
  const r = new IoTValidator.Runner(src, WORLD7); r.runSetup();
  assert(r.board.net.connected('device'));
  r.board.setRouter(false); r.runLoops(1);
  eq(r.board.wifiStatus(), 6); assert(!r.board.net.connected('device'));
});
test('συσκευή: publish, subscribe και read', () => {
  const src = wrap('pinMode(LED_PIN, OUTPUT);\nmqtt.setServer(MQTT_HOST, 1883);\nmqtt.connect("esp32-lamp");\nmqtt.subscribe("home/led/set");',
    'while (mqtt.read()) {\n if (mqtt.payload() == "ON") { digitalWrite(LED_PIN, HIGH); mqtt.publish("home/led/state", "ON"); }\n}');
  const r = new IoTValidator.Runner(src, WORLD7); r.runSetup(); r.runLoops(1);
  r.tick(); r.board.net.publish('dashboard', 'home/led/set', 'ON'); r.runLoops(1);
  eq(r.board.led, true);
  eq(r.board.net.dashboard.values['home/led/state'].payload, 'ON');
});
test('συσκευή: αισθητήρας με σφάλμα δίνει nan', () => {
  const r = new IoTValidator.Runner(wrap('Serial.begin(115200);\nfloat t = readTemperature();\nSerial.println(t);\nSerial.println(isnan(t));'), { sensorFault: true });
  r.runSetup(); eq(r.board.serialLines(), ['nan', '1']);
});
test('συσκευή: setInsecure συνδέεται σε ληγμένο cert, setCACert όχι', () => {
  const W = { wifi: 'connected', broker: 'listener 8883\ntls on\n', cert: 'expired' };
  const mk = tlsLine => wrap(`mqtt.setServer(MQTT_HOST, 8883);\n${tlsLine}\nmqtt.connect("x");`);
  const a = new IoTValidator.Runner(mk('mqtt.setInsecure();'), W); a.runSetup(); assert(a.board.net.connected('device'));
  const b = new IoTValidator.Runner(mk('mqtt.setCACert(HOME_CA);'), W); b.runSetup(); assert(!b.board.net.connected('device'));
});
test('επιπλέον σταθερές άσκησης (π.χ. MQTT_USER)', () => {
  const r = new IoTValidator.Runner(wrap('Serial.begin(115200);\nSerial.println(MQTT_USER);'), { consts: { MQTT_USER: 'esp32-pir' } });
  r.runSetup(); eq(r.board.serialLines(), ['esp32-pir']);
});

console.log('\nΕνέργεια, light sleep, deep sleep');
test('light sleep: η μνήμη κρατιέται και το ρεύμα πέφτει', () => {
  const r = new IoTValidator.Runner('int c = 0;\nvoid setup() { Serial.begin(115200); WiFi.mode(WIFI_OFF); }\nvoid loop() { c++; Serial.println(c); esp_sleep_enable_timer_wakeup(1000000); esp_light_sleep_start(); }', {});
  r.runSetup(); r.runFor(3500);
  eq(r.board.serialLines(), ['1', '2', '3', '4']);
  assert(r.board.avgMa() < 1, 'avg ' + r.board.avgMa());
});
test('deep sleep: επανεκκίνηση, μόνο οι RTC_DATA_ATTR κρατιούνται', () => {
  const src = 'RTC_DATA_ATTR int boots = 0;\nint normal = 0;\nvoid setup() { Serial.begin(115200); boots++; normal++; Serial.println("" + boots + "/" + normal + "/" + esp_sleep_get_wakeup_cause()); esp_sleep_enable_timer_wakeup(5000000); esp_deep_sleep_start(); }\nvoid loop() {}';
  const r = new IoTValidator.Runner(src, {}); r.runSetup(); r.runFor(16000);
  eq(r.board.serialLines(), ['1/1/0', '2/1/4', '3/1/4', '4/1/4']);
  eq(r.board.boots, 3);
});
test('ext0: ο PIR ξυπνά την πλακέτα', () => {
  const src = 'void setup() { Serial.begin(115200); if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) { Serial.println("motion"); } while (digitalRead(PIR_PIN) == HIGH) { delay(50); } esp_sleep_enable_ext0_wakeup(PIR_PIN, HIGH); esp_deep_sleep_start(); }\nvoid loop() {}';
  const r = new IoTValidator.Runner(src, {}); r.runSetup(); r.runFor(4000);
  eq(r.board.serialLines(), []);
  r.board.inputs.pir = true; r.runFor(300); r.board.inputs.pir = false; r.runFor(2000);
  eq(r.board.serialLines(), ['motion']);
});
test('ύπνος χωρίς πηγή αφύπνισης → σαφές σφάλμα', () => {
  let e = null;
  try { const r = new IoTValidator.Runner('void setup() { esp_deep_sleep_start(); }\nvoid loop() {}', {}); r.runSetup(); } catch (x) { e = x; }
  assert(e && /χωρίς τρόπο να ξυπνήσει/.test(e.message), e && e.message);
});
test('ο ύπνος κλείνει το WiFi και το MQTT', () => {
  const src = 'void setup() { mqtt.setServer(MQTT_HOST, 1883); mqtt.connect("x"); esp_sleep_enable_timer_wakeup(1000000); esp_light_sleep_start(); }\nvoid loop() { delay(100); }';
  const r = new IoTValidator.Runner(src, { wifi: 'connected', broker: 'listener 1883\nallow_anonymous true\n' }); r.runSetup(); r.runFor(1500);
  assert(!r.board.net.connected('device')); eq(r.board.wifiStatus(), 6);
});
test('RTC_DATA_ATTR μέσα σε συνάρτηση → σφάλμα', () => {
  const e = codeError(wrap('', 'RTC_DATA_ATTR int x = 0;'));
  assert(/έξω από τις συναρτήσεις/.test(e.message));
});

console.log('\nPython (Raspberry Pi)');
const { IoTPy } = ctx;
function py(src, world, after) {
  const r = new IoTValidator.Runner(src, world || {}, {}, 'python');
  r.runSetup();
  if (after) after(r);
  return r;
}
const out = r => r.board.serial.map(e => e.text);
function pyError(src, world, after) {
  try { py(src, world, after); } catch (e) { if (e.name === 'CodeError') return e; throw e; }
  throw new Error('αναμενόταν σφάλμα');
}
test('αριθμοί και κείμενο όπως η Python', () => {
  eq(out(py('print(7 / 2, 7 // 2, -7 // 2, -7 % 3, 2 ** 10, 3.0, 0.1 + 0.2)')), ['3.5 3 -4 2 1024 3.0 0.30000000000000004']);
  eq(out(py('print(round(2.5), round(3.5), round(3.14159, 2), int("42"), float("22.5"))')), ['2 4 3.14 42 22.5']);
  eq(out(py('t = 22.456\nprint(f"{t:.1f}|{3:03d}|{\'ok\':>4}|{1234567:,}|{0.256:.1%}")')), ['22.5|003|  ok|1,234,567|25.6%']);
  eq(out(py('print(True, None, [1, "a"], {"k": (1,)}, "x" * 3)')), ["True None [1, 'a'] {'k': (1,)} xxx"]);
});
test('json: int/float και μορφή όπως η Python', () => {
  eq(out(py('import json\nd = json.loads(\'{"t": 22.0, "n": 3}\')\nprint(d, type(d["n"]), json.dumps({"a": 1, "b": [True, None], "g": "ά"}))')),
    ['{\'t\': 22.0, \'n\': 3} <class \'int\'> {"a": 1, "b": [true, null], "g": "\\u03ac"}']);
  eq(out(py('import json\ntry:\n    json.loads("nan")\nexcept ValueError as e:\n    print("bad", e)')), ['bad Expecting value: line 1 column 1 (char 0)']);
});
test('συνήθειες από C++ → ελληνική εξήγηση', () => {
  assert(/Λείπει η άνω-κάτω τελεία/.test(pyError('if 1 > 0\n    print(1)').hint));
  assert(/με \{ \}/.test(pyError('while True {\n}').hint));
  assert(/and/.test(pyError('if a && b:\n    pass').hint));
  assert(/True/.test(pyError('x = true').hint));
  assert(/elif/.test(pyError('if 1:\n    pass\nelse if 2:\n    pass').hint));
  assert(/#/.test(pyError('// σχόλιο\nprint(1)').hint));
  eq(pyError('print(1)\n  print(2)').line, 2);
});
test('λάθη εκτέλεσης: πραγματικό μήνυμα + εξήγηση', () => {
  const e1 = pyError('t = "22.5"\nx = t + 1');
  eq(e1.line, 2); assert(/^TypeError: can only concatenate str/.test(e1.message) && /str\(/.test(e1.hint));
  const e2 = pyError('count = 0\ndef f():\n    count += 1\nf()');
  assert(/UnboundLocalError/.test(e2.message) && /global count/.test(e2.hint));
  assert(/KeyError/.test(pyError('d = {"a": 1}\nprint(d["b"])').message));
  assert(/float/.test(pyError('int("22.5")').hint));
});
test('while True: κάθε γύρος μετρά ως επανάληψη', () => {
  const r = py('n = 0\nwhile True:\n    n += 1\n    print(n)');
  r.runLoops(3);
  eq(out(r), ['1', '2', '3']);
  eq(r.machine.loopIndex, 3);
});
test('βρόχος χωρίς αναμονή → σφάλμα βημάτων', () => {
  assert(/βήματα/.test(pyError('x = 0\nwhile x >= 0:\n    x += 1').message));
});
test('gpiozero: LED, κουμπί και callbacks', () => {
  const r = py('from gpiozero import LED, Button\nimport time\nled = LED(17)\nbtn = Button(27)\nwhile True:\n    if btn.is_pressed:\n        led.on()\n    else:\n        led.off()\n    time.sleep(0.1)');
  r.runLoops(2); eq(r.board.led, false);
  r.board.inputs.button = true; r.runLoops(2); eq(r.board.led, true);
  const c = py('from gpiozero import LED, Button\nfrom signal import pause\nled = LED(17)\nbtn = Button(27)\ndef toggle():\n    led.toggle()\nbtn.when_pressed = toggle\npause()');
  c.board.inputs.button = true; c.runFor(200); eq(c.board.led, true);
  c.board.inputs.button = false; c.runFor(200); c.board.inputs.button = true; c.runFor(200); eq(c.board.led, false);
  const w = py('from gpiozero import LED\nled = LED(18)\nled.on()');
  assert(w.board.warnings.some(x => /GPIO 18/.test(x.text)) && !w.board.led);
});
const HUB_WORLD = { broker: 'listener 1883\nallow_anonymous true', clients: [
  { name: 'esp32-temp', publish: [{ topic: 'home/temperature', payload: '{"t": {temp}}', every: 5000, offset: 1000 }] }, { name: 'dashboard', subs: ['home/#'] }] };
const HUB = `import json
import paho.mqtt.client as mqtt
def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")
def on_message(client, userdata, msg):
    t = json.loads(msg.payload)["t"]
    print(t)
    if t > 25:
        client.publish("home/alerts", json.dumps({"t": t}))
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("broker.home.lan", 1883)
client.loop_forever()`;
test('paho: on_message, publish, επανασύνδεση με on_connect', () => {
  const r = py(HUB, HUB_WORLD);
  r.runFor(7000); eq(out(r), ['22.5', '22.5']);
  r.board.inputs.temp = 30; r.board.net.restartBroker(); r.runFor(6000);
  eq(out(r).slice(-1), ['30.0']);
  assert(r.board.net.messages.some(m => m.client === 'device' && m.topic === 'home/alerts' && m.payload === '{"t": 30.0}'));
  assert(r.board.net.dashboard.values['home/alerts']);
});
test('paho: χωρίς loop δεν φτάνει τίποτα · παλιό Client("id") · dict χωρίς json.dumps', () => {
  const r = py(HUB.replace('client.loop_forever()', 'import time\nwhile True:\n    time.sleep(1)'), HUB_WORLD);
  r.runFor(8000); eq(out(r), []);
  assert(/CallbackAPIVersion\.VERSION2/.test(pyError(HUB.replace('mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub"', '"pi-hub"'), HUB_WORLD).hint));
  const e = pyError(HUB.replace('json.dumps({"t": t})', '{"t": t}'), Object.assign({}, HUB_WORLD, { temp: 30 }), r2 => r2.runFor(2000));
  assert(/json\.dumps/.test(e.hint));
});
test('εικονικός αισθητήρας με σφάλμα στέλνει μη έγκυρο JSON', () => {
  const r = py('import paho.mqtt.client as mqtt\nimport json\ndef on_message(c, u, msg):\n    try:\n        json.loads(msg.payload)\n        print("ok")\n    except json.JSONDecodeError:\n        print("bad")\nclient = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="hub")\nclient.on_message = on_message\nclient.connect("localhost", 1883)\nclient.subscribe("home/#")\nclient.loop_forever()', Object.assign({}, HUB_WORLD, { sensorFault: true }));
  r.runFor(2000); eq(out(r), ['bad']);
});
test('μεταβλητές: σύντομη εμφάνιση αντικειμένων', () => {
  const r = py('from gpiozero import LED\nled = LED(17)\nled.on()\nxs = [1, 2]');
  eq(r.machine.visibleVars().map(v => `${v.name}:${v.type}=${IoTPy.display(v.value)}`), ['led:LED=LED(17) · αναμμένο', 'xs:list=[1, 2]']);
});

console.log('\nSQLite, Flask και ασφάλεια του Pi');
const SQL = 'import sqlite3\nconn = sqlite3.connect("home.db")\ncur = conn.cursor()\ncur.execute("CREATE TABLE IF NOT EXISTS readings (id INTEGER PRIMARY KEY, room TEXT NOT NULL, temp REAL)")\n';
test('sqlite3: INSERT με ?, commit, SELECT με GROUP BY', () => {
  const r = py(SQL + 'cur.executemany("INSERT INTO readings (room, temp) VALUES (?, ?)", [("salon", 22), ("salon", 23.5), ("kitchen", 25.1)])\nconn.commit()\nfor row in cur.execute("SELECT room, ROUND(AVG(temp), 2), COUNT(*) FROM readings GROUP BY room ORDER BY room"):\n    print(row)\nprint(cur.execute("SELECT temp FROM readings WHERE id = ?", (1,)).fetchone())');
  eq(out(r), ["('kitchen', 25.1, 1)", "('salon', 22.75, 2)", '(22.0,)']);
  eq(IoTValidator.CHECKS.dbRows(r.board, { table: 'readings', is: 3 }).pass, true);
  eq(IoTValidator.CHECKS.dbRows(r.board, { table: 'readings', where: { room: 'salon' }, is: 2 }).pass, true);
});
test('sqlite3: χωρίς commit οι αλλαγές χάνονται · f-string = SQL injection', () => {
  const r = py(SQL + 'cur.execute("INSERT INTO readings (room, temp) VALUES (?, ?)", ("salon", 22))');
  eq(IoTValidator.CHECKS.dbRows(r.board, { table: 'readings', min: 1 }).pass, false);
  assert(r.board.warnings.some(w => /commit/.test(w.text)));
  const q = py(SQL + 'cur.execute("INSERT INTO readings (room, temp) VALUES (?, ?)", ("salon", 22))\nroom = "x\' OR \'1\'=\'1"\nprint(len(cur.execute(f"SELECT * FROM readings WHERE room = \'{room}\'").fetchall()), len(cur.execute("SELECT * FROM readings WHERE room = ?", (room,)).fetchall()))');
  eq(out(q), ['1 0']);
});
test('sqlite3: πραγματικά μηνύματα λάθους', () => {
  assert(/no such table: logs/.test(pyError(SQL + 'cur.execute("SELECT * FROM logs")').message));
  const e = pyError(SQL + 'cur.execute("INSERT INTO readings (room) VALUES (?)", ("kitchen"))');
  assert(/uses 1, and there are 7 supplied/.test(e.message) && /\(x,\)/.test(e.hint));
  assert(/one statement at a time/.test(pyError(SQL + 'cur.execute("SELECT 1; DROP TABLE readings")').message));
  assert(/NOT NULL constraint failed: readings.room/.test(pyError(SQL + 'cur.execute("INSERT INTO readings (temp) VALUES (?)", (1,))').message));
});
const FLASK = 'from flask import Flask, jsonify, request, abort\nfrom markupsafe import escape\napp = Flask(__name__)\n@app.route("/")\ndef index():\n    return f"<h1>{escape(request.args.get(\'name\', \'x\'))}</h1>"\n@app.route("/api/temp/<room>")\ndef temp(room):\n    if room != "salon":\n        return jsonify({"error": "unknown"}), 404\n    return {"room": room, "temp": 22.5}\n@app.route("/api/led", methods=["POST"])\ndef led():\n    if request.headers.get("X-API-Key") != "k-123":\n        abort(401)\n    return jsonify(ok=True, cmd=request.get_json()["cmd"])\n';
test('flask: routes, JSON, escape, abort, 404/405/500', () => {
  const r = py(FLASK + '@app.route("/boom")\ndef boom():\n    return {}["x"]\napp.run(host="0.0.0.0", port=5000)');
  const C = IoTValidator.CHECKS.response;
  r.request({ path: '/?name=<script>' }); eq(C(r.board, { status: 200, notContains: '<script>', contains: '&lt;script&gt;' }, r).pass, true);
  r.request({ path: '/api/temp/salon' }); eq(r.lastRequest.response.body, '{"room":"salon","temp":22.5}\n');
  r.request({ path: '/api/temp/attic' }); eq(r.lastRequest.response.status, 404);
  r.request({ path: '/api/led', method: 'POST', json: { cmd: 'ON' } }); eq(r.lastRequest.response.status, 401);
  r.request({ path: '/api/led', method: 'POST', json: { cmd: 'ON' }, headers: { 'x-api-key': 'k-123' } }); eq(C(r.board, { status: 200, json: { ok: true, cmd: 'ON' } }, r).pass, true);
  r.request({ path: '/api/led' }); eq(r.lastRequest.response.status, 405);
  r.request({ path: '/boom' }); eq(r.lastRequest.response.status, 500);
  assert(out(r).some(l => l === "KeyError: 'x'") && out(r).some(l => /"GET \/boom HTTP\/1.1" 500/.test(l)));
});
test('flask: 127.0.0.1 δεν φαίνεται από το tablet · debug=True προειδοποιεί', () => {
  const r = py(FLASK + 'app.run(debug=True)');
  r.request({ path: '/' }); eq(r.lastRequest.response.status, 0);
  r.request({ path: '/', from: 'pi' }); eq(r.lastRequest.response.status, 200);
  assert(r.board.warnings.some(w => /debug=True/.test(w.text)));
});
test('Pi: sshd_config και ufw', () => {
  const lesson = { mode: 'config', system: true, world: {} };
  const good = 'PermitRootLogin no\nPasswordAuthentication no\nAllowUsers hubadmin\nufw default deny incoming\nufw allow from 192.168.1.0/24 to any port 22 proto tcp\nufw allow 8883/tcp\nufw enable';
  const t = [{ name: 't', script: [
    { ssh: { from: '192.168.1.20', user: 'hubadmin', auth: 'key' }, expect: 'allow', fail: 'a {v}' },
    { ssh: { from: '192.168.1.20', user: 'pi', auth: 'password' }, expect: 'deny', fail: 'b {v}' },
    { ssh: { from: '192.168.1.20', user: 'root', auth: 'key' }, expect: 'deny', fail: 'c {v}' },
    { connect: { from: '203.0.113.50', port: 22 }, expect: 'deny', fail: 'd {v}' },
    { connect: { from: '203.0.113.50', port: 8883 }, expect: 'allow', fail: 'e {v}' },
    { connect: { from: '192.168.1.77', port: 1883 }, expect: 'deny', fail: 'f {v}' }] }];
  const r = IoTValidator.runTests(good, t, lesson)[0];
  assert(r.pass, r.message);
  assert(r.log.some(x => /Accepted publickey for hubadmin/.test(x.text)) && r.log.some(x => /UFW BLOCK.*DPT=22/.test(x.text)));
  eq(IoTValidator.runTests('ufw allow 22', t, lesson)[0].message, 'b Ο pi μπήκε με κωδικό.');
  const lim = IoTValidator.runTests('ufw limit 22/tcp\nufw enable', [{ name: 'l', script: [{ burst: { from: '203.0.113.50', port: 22, count: 10 }, expect: 'deny', fail: 'x' }] }], lesson)[0];
  assert(lim.pass && lim.log.some(x => /LIMIT BLOCK/.test(x.text)));
  assert(ctx.IoTSys.parse('ufw default deny incoming\nufw enable').warnings.some(w => /κλειδωθείς/.test(w.text)));
});

console.log('\nΑποθήκευση προόδου');
test('validate δέχεται έγκυρο export', () => {
  const s = IoTStorage.defaults();
  s.completed['c1-l1'] = true;
  s.drafts['c1-l2'] = 'void setup(){}';
  const v = IoTStorage.validate(JSON.parse(JSON.stringify(s)));
  assert(v.ok, v.error); eq(v.data.completed['c1-l1'], true);
});
test('validate απορρίπτει λάθος schema', () => {
  assert(!IoTStorage.validate({ schema: 99 }).ok);
  assert(!IoTStorage.validate('x').ok);
});
test('validate πετά άγνωστα μαθήματα και λάθος τύπους', () => {
  const v = IoTStorage.validate({ schema: 1, completed: { 'c1-l1': true, 'hack': true, 'c1-l2': 'yes' }, drafts: { 'c1-l1': 5 } });
  assert(v.ok); eq(Object.keys(v.data.completed), ['c1-l1']); eq(Object.keys(v.data.drafts), []);
});

// ------------------------------------------------------------ εργαλεία μάθησης (js/learn.js)
test('εξήγηση γραμμής: pinMode, digitalWrite, delay, if', () => {
  assert(/έξοδο/.test(IoTLearn.explainLine('  pinMode(LED_PIN, OUTPUT);', 'cpp')));
  assert(/HIGH/.test(IoTLearn.explainLine('digitalWrite(LED_PIN, HIGH); // άναψε', 'cpp')));
  assert(/0,5 δευτ/.test(IoTLearn.explainLine('delay(500);', 'cpp')));
  assert(/Ελέγχει αν ισχύει motion == HIGH/.test(IoTLearn.explainLine('if (motion == HIGH) {', 'cpp')));
  eq(IoTLearn.explainLine('   ', 'cpp'), null);
});
test('εξήγηση γραμμής: Python και Rust', () => {
  assert(/GPIO 17/.test(IoTLearn.explainLine('led = LED(17)', 'python')));
  assert(/για πάντα/.test(IoTLearn.explainLine('while True:', 'python')));
  assert(/mut/.test(IoTLearn.explainLine('let mut n: u32 = 0;', 'rust')));
  assert(/ΟΛΕΣ/.test(IoTLearn.explainLine('match d {', 'rust')));
});
test('κάθε γραμμή κάθε λύσης εξηγείται χωρίς σφάλμα', () => {
  for (const l of IoTLessons.lessons) for (const line of String(l.solution || '').split('\n')) IoTLearn.explainLine(line, l.lang || 'cpp');
});
test('επανάληψη: σωστό ανεβάζει κουτί, λάθος γυρίζει στο 1', () => {
  const r = {};
  IoTLearn.enroll(r, 'c1-l1', '2026-10-23');
  eq(r['c1-l1'], { box: 1, due: '2026-10-24' });
  eq(IoTLearn.dueIds(r, '2026-10-23'), []);
  eq(IoTLearn.dueIds(r, '2026-10-24'), ['c1-l1']);
  eq(IoTLearn.answer(r, 'c1-l1', true, '2026-10-24'), { box: 2, due: '2026-10-26' });
  eq(IoTLearn.answer(r, 'c1-l1', false, '2026-10-26'), { box: 1, due: '2026-10-27' });
});
test('στόχος ημέρας και σερί', () => {
  let d = IoTLearn.bump(null, '2026-10-22', 3);
  eq(d.streak, 1);
  d = IoTLearn.bump(d, '2026-10-23', 2);
  eq(d.streak, 1);
  d = IoTLearn.bump(d, '2026-10-23', 1);
  eq(d.streak, 2);
  eq(IoTLearn.dailyView(d, '2026-10-24').streak, 2);
  eq(IoTLearn.dailyView(d, '2026-10-26').streak, 0);
});
test('validate κρατά έγκυρη επανάληψη και πετά τα λάθος', () => {
  const v = IoTStorage.validate({ schema: 1, review: { 'c1-l1': { box: 2, due: '2026-10-25' }, 'c1-l2': { box: 9, due: 'x' }, hack: { box: 1, due: '2026-10-25' } }, daily: { date: '2026-10-23', count: 2, streak: 1, best: 3, lastMet: '2026-10-22' } });
  assert(v.ok, v.error);
  eq(Object.keys(v.data.review), ['c1-l1']);
  eq(v.data.daily.count, 2);
});
test('σημειώσεις κεφαλαίου: στόχοι και λέξεις', () => {
  const ls = IoTLessons.lessons.filter(l => l.chapter === 1);
  const html = IoTLearn.chapterNotes({ n: 1, title: 'Πρώτο πρόγραμμα' }, ls, IoTLessons.GLOSSARY, {});
  assert(html.includes('Τι μαθαίνω') && html.includes('setup()'));
});

// ------------------------------------------------------------ συνδεσμολογία (js/wiring.js)
test('συνδεσμολογία: σωστό pin, GND, 3V3 και λάθος GPIO', () => {
  const man = [{ t: 'esp32' }, { t: 'wire', cls: 'w-led', a: { name: 'D2' } }, { t: 'wire', cls: 'w-gnd', a: { name: 'GND2' } }];
  const ts = IoTWiring.tasksFrom(man);
  eq(ts.map(t => [t.i, t.pin]), [[0, 'D2'], [1, 'GND2']]);
  assert(IoTWiring.judge(ts[0], 'D2', 'esp32').ok);
  const g = IoTWiring.judge(ts[0], 'GND', 'esp32');
  assert(!g.ok && /0 V/.test(g.msg));
  assert(/αναμμένο/.test(IoTWiring.judge(ts[0], '3V3', 'esp32').msg));
  assert(/LED_PIN/.test(IoTWiring.judge(ts[0], 'D4', 'esp32').msg));
  assert(/μόνο είσοδος/.test(IoTWiring.judge(ts[0], 'D34', 'esp32').msg));
  assert(IoTWiring.judge(ts[1], 'GND3', 'esp32').ok, 'κάθε GND είναι σωστό για τη γείωση');
  assert(!IoTWiring.judge(ts[1], '5V', 'esp32').ok);
});
test('συνδεσμολογία Pi: GPIO17 και ονόματα pins', () => {
  const t = IoTWiring.tasksFrom([{ t: 'wire', cls: 'w-led', a: { name: 'GPIO17' } }])[0];
  assert(IoTWiring.judge(t, 'GPIO17', 'pi').ok);
  assert(/ID_SD/.test(IoTWiring.judge(t, 'ID_SD', 'pi').msg));
  eq(IoTWiring.shown('3V3b'), '3V3');
  eq(IoTWiring.kindOf('GND4'), 'gnd');
});

// ------------------------------------------------------------ «Το σπίτι έχει πρόβλημα» (js/challenge.js)
test('πρόκληση: λάθη μόνο ανά γραμμή, χωρίς σχόλια', () => {
  const c = IoTChallenge.candidates('// HIGH\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n  digitalWrite(LED_PIN, HIGH); // HIGH\n}');
  assert(c.some(x => x.kind === 'level' && x.code.includes('digitalWrite(LED_PIN, LOW); // HIGH')));
  assert(c.some(x => x.kind === 'mode'));
  assert(c.some(x => x.kind === 'drop' && !x.code.includes('pinMode')));
  assert(!c.some(x => x.line === 1), 'το σχόλιο δεν αλλάζει');
});
test('πρόκληση: κάθε κεφάλαιο με λύση δίνει λάθος που πιάνεται από τους ελέγχους', () => {
  const byCh = {};
  for (const l of IoTLessons.lessons) (byCh[l.chapter] = byCh[l.chapter] || []).push(l);
  let n = 0;
  for (const [ch, ls] of Object.entries(byCh)) {
    const pool = ls.filter(l => l.solution && l.validationTests && l.mode !== 'analysis').reverse();
    if (!pool.length) continue;
    const c = IoTChallenge.make(pool, IoTValidator.runTests, 'test' + ch);
    assert(c, 'καμία πρόκληση για το κεφάλαιο ' + ch);
    const fixed = IoTValidator.runTests(c.base.solution, c.base.validationTests, c.base);
    assert(fixed.every(r => r.pass), 'η λύση πρέπει να περνά: ' + c.base.id);
    n++;
  }
  assert(n > 20);
});

// ------------------------------------------------------------ μπλοκ (js/blocks.js)
test('μπλοκ: ο κώδικας που φτιάχνουν τρέχει σε όλες τις διαδρομές', () => {
  const TR = { 'cpp-esp32': ['cpp', 'esp32'], 'py-pi': ['python', 'pi'], 'py-esp32': ['python', 'esp32'], 'rs-pi': ['rust', 'pi'], 'rs-esp32': ['rust', 'esp32'] };
  for (const [tr, [lang, board]] of Object.entries(TR)) {
    const caps = IoTBlocks.caps(tr);
    const model = {
      setup: [{ t: 'print', text: 'Γεια!' }, { t: 'set', n: 0 }],
      loop: [
        { t: 'if', c: 'button', then: [{ t: 'led', on: true }, { t: 'change', n: 1 }], else: [{ t: 'led', on: false }] },
        { t: 'repeat', n: 2, body: [{ t: 'wait', ms: 100 }] },
        { t: 'if', c: 'count', n: 3, then: [{ t: 'printv', v: 'count' }, { t: 'set', n: 0 }], else: null },
        ...(caps.includes('temp') ? [{ t: 'if', c: 'temp', n: 20, then: [{ t: 'printv', v: 'temp' }], else: null }] : []),
        ...(caps.includes('dist') ? [{ t: 'if', c: 'dist', n: 100, then: [{ t: 'printv', v: 'dist' }], else: null }] : [])
      ]
    };
    for (const m of [model, IoTBlocks.STARTER(), { setup: [], loop: [] }]) {
      const r = new IoTValidator.Runner(IoTBlocks.generate(m, tr), { board, temp: 24, distance: 50 }, { button: true }, lang);
      r.runSetup();
      r.runFor(1200);
    }
    const r = new IoTValidator.Runner(IoTBlocks.generate(model, tr), { board }, { button: true }, lang);
    r.runSetup();
    r.runFor(800);
    eq(r.board.outputs[2], 1, tr + ': με πατημένο κουμπί το LED ανάβει');
  }
});
test('μπλοκ: normalize καθαρίζει άγνωστα και επικίνδυνα δεδομένα', () => {
  const m = IoTBlocks.normalize({ setup: [{ t: 'print', text: 'a"); evil(); ("' }, { t: 'hack' }], loop: [{ t: 'wait', ms: 1e9 }] });
  eq(m.setup.length, 1);
  assert(!/"/.test(m.setup[0].text));
  eq(m.loop[0].ms, 60000);
});

// ------------------------------------------------------------ ανάγνωση φωναχτά: κώδικας στα αγγλικά (js/speak.js)
test('ανάγνωση: ο κώδικας πάει στην αγγλική φωνή, τα ελληνικά στην ελληνική', () => {
  const sctx = vm.createContext({ console, speechSynthesis: { getVoices: () => [{ lang: 'en-US', name: 'Samantha', localService: true }, { lang: 'el-GR', name: 'Melina' }], addEventListener() {}, cancel() {}, speak() {} }, SpeechSynthesisUtterance: function () {} });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'speak.js'), 'utf8'), sctx, { filename: 'speak.js' });
  const p = sctx.IoTSpeak.pieces('1. pinMode(LED_PIN, OUTPUT); λέει στην πλακέτα.');
  eq(p.map(x => x.en), [false, true, false]);
  eq(p[1].t, 'pin Mode L E D pin, output');
  sctx.IoTSpeak.setEnglish(false);
  assert(sctx.IoTSpeak.pieces('pinMode(LED_PIN, OUTPUT);').every(x => !x.en));
});

test('μπλοκ: buzzer, servo, LED RGB και οθόνη σε C++ και MicroPython', () => {
  const m = { setup: [{ t: 'oled', text: 'Hi!' }], loop: [{ t: 'if', c: 'button', then: [{ t: 'tone', f: 880, ms: 0 }, { t: 'servo', a: 90 }, { t: 'rgb', r: 255, g: 128, b: 0 }, { t: 'oledv', v: 'temp' }], else: [{ t: 'quiet' }, { t: 'servo', a: 0 }] }, { t: 'wait', ms: 50 }] };
  for (const [tr, lang] of [['cpp-esp32', 'cpp'], ['py-esp32', 'python']]) {
    const r = new IoTValidator.Runner(IoTBlocks.generate(m, tr), { board: 'esp32', temp: 21.5 }, { button: true }, lang);
    r.runSetup();
    r.runLoops(2);
    const b = r.board;
    eq(b.buzzerFreq(), 880, tr + ' buzzer');
    eq(b.servo.angle, 90, tr + ' servo');
    assert(Math.abs(b.rgb()[0] - 255) <= 2 && b.rgb()[1] === 128, tr + ' rgb ' + b.rgb());
    assert(b.oledText().includes('21.5'), tr + ' oled ' + b.oledText());
  }
});
test('MicroPython: PWM servo από duty και προειδοποίηση για λάθος συχνότητα', () => {
  const r = new IoTValidator.Runner('from machine import Pin, PWM\nservo = PWM(Pin(19), freq=100)\nservo.duty(128)\n', { board: 'esp32' }, {}, 'python');
  r.runSetup();
  assert(r.board.warnings.some(w => /50 Hz/.test(w.text)), 'περίμενα προειδοποίηση για τα 50 Hz');
});

// ------------------------------------------------------------ νέα εξαρτήματα στο Raspberry Pi (js/pyparts.js, js/rslib.js)
test('μπλοκ: buzzer, servo, LED RGB και οθόνη και στο Raspberry Pi (Python και Rust)', () => {
  const m = { setup: [{ t: 'oled', text: 'Hi!' }], loop: [{ t: 'if', c: 'button', then: [{ t: 'tone', f: 880, ms: 0 }, { t: 'servo', a: 90 }, { t: 'rgb', r: 255, g: 128, b: 0 }, { t: 'change', n: 1 }, { t: 'oledv', v: 'count' }], else: [{ t: 'quiet' }, { t: 'servo', a: 0 }] }, { t: 'wait', ms: 50 }] };
  for (const [tr, lang, board] of [['py-pi', 'python', 'pi'], ['rs-pi', 'rust', 'pi'], ['rs-esp32', 'rust', 'esp32']]) {
    const r = new IoTValidator.Runner(IoTBlocks.generate(m, tr), { board }, { button: true }, lang);
    r.runSetup();
    r.runLoops(2);
    const b = r.board;
    eq(b.buzzerFreq(), 880, tr + ' buzzer');
    eq(b.servo.angle, 90, tr + ' servo');
    assert(Math.abs(b.rgb()[0] - 255) <= 2 && Math.abs(b.rgb()[1] - 128) <= 2, tr + ' rgb ' + b.rgb());
    assert(/\d/.test(b.oledText()), tr + ' oled ' + b.oledText());
  }
});
test('Python στο Pi: Tone, όρια του TonalBuzzer και χρώματα 0–1 του RGBLED', () => {
  const r = py('from gpiozero import TonalBuzzer, RGBLED\nfrom gpiozero.tones import Tone\nb = TonalBuzzer(22)\nb.play(Tone("A4"))\nled = RGBLED(red=5, green=6, blue=13)\nled.color = (0, 0.5, 1)\n', { board: 'pi' });
  eq(r.board.buzzerFreq(), 440);
  eq(r.board.rgb(), [0, 128, 255]);
  assert(/out of the device's range/.test(pyError('from gpiozero import TonalBuzzer\nb = TonalBuzzer(22)\nb.play(2000)\n', { board: 'pi' }).message));
  assert(/between 0 and 1/.test(pyError('from gpiozero import RGBLED\nled = RGBLED(5, 6, 13)\nled.color = (255, 0, 0)\n', { board: 'pi' }).message));
  assert(/color/.test(pyError('import board, busio, adafruit_ssd1306\no = adafruit_ssd1306.SSD1306_I2C(128, 64, busio.I2C(board.SCL, board.SDA))\no.text("hi", 0, 0)\n', { board: 'pi' }).message));
});
test('Python στο Pi: AngularServo με παλμούς 0,5–2,5 ms και οθόνη με size=2', () => {
  const r = py('from gpiozero import AngularServo\nimport board, busio, adafruit_ssd1306\ns = AngularServo(18, min_angle=0, max_angle=180, min_pulse_width=0.0005, max_pulse_width=0.0025)\ns.angle = 45\no = adafruit_ssd1306.SSD1306_I2C(128, 64, busio.I2C(board.SCL, board.SDA))\no.fill(0)\no.text("Hi", 0, 20, 1, size=2)\no.show()\n', { board: 'pi' });
  eq(r.board.servo.angle, 45);
  eq(r.board.oled.shown, [{ x: 0, y: 20, size: 2, text: 'Hi' }]);
});
test('Python: τα modules του Pi δεν υπάρχουν στη MicroPython του ESP32', () => {
  assert(/adafruit_ssd1306/.test(pyError('import adafruit_ssd1306\n', { board: 'esp32' }).message));
});
test('Rust στο Pi: set_pwm_frequency θέλει f64 και το rppal::i2c δεν υπάρχει στο ESP32', () => {
  const bad = 'use rppal::gpio::Gpio;\nuse std::error::Error;\n\nfn main() -> Result<(), Box<dyn Error>> {\n    let gpio = Gpio::new()?;\n    let mut b = gpio.get(22)?.into_output();\n    b.set_pwm_frequency(440, 0.5)?;\n    Ok(())\n}\n';
  let e = null;
  try { const r = new IoTValidator.Runner(bad, { board: 'pi' }, {}, 'rust'); r.runSetup(); } catch (x) { e = x; }
  assert(e && /E0308/.test(e.message) && /440\.0/.test(e.hint), 'περίμενα E0308 για το 440');
  let e2 = null;
  try { new IoTValidator.Runner('use rppal::i2c::I2c;\nfn main() {}\n', { board: 'esp32' }, {}, 'rust'); } catch (x) { e2 = x; }
  assert(e2 && /E0432/.test(e2.message), 'το rppal είναι μόνο για το Pi');
});

// ------------------------------------------------------------ ιστορίες ασφάλειας (js/cases.js, js/cases-data.js)
test('ιστορίες ασφάλειας: τουλάχιστον 6, όλες με σωστά δεδομένα και πηγή', () => {
  assert(IoTCases.CASES.length >= 6, 'λίγες ιστορίες: ' + IoTCases.CASES.length);
  const ids = new Set();
  for (const c of IoTCases.CASES) {
    eq(IoTCases.check(c), [], c.id);
    assert(!ids.has(c.id), 'διπλό id ' + c.id); ids.add(c.id);
    assert(c.steps.length >= 3 && c.defenses.some(d => !d.good), c.id + ': θέλει βήματα και τουλάχιστον ένα λάθος μέτρο');
    if (c.chapter) assert(IoTLessons.CHAPTERS.some(ch => ch.n === c.chapter), c.id + ': άγνωστο κεφάλαιο ' + c.chapter);
  }
});
test('ιστορίες ασφάλειας: αξιολόγηση μέτρων', () => {
  const c = IoTCases.CASES[0];
  const good = c.defenses.filter(d => d.good).map(d => d.id);
  const bad = c.defenses.filter(d => !d.good).map(d => d.id);
  const j = IoTCases.judge(c, good);
  assert(j.ok && j.stopStep >= 0, 'όλα τα σωστά → ok');
  assert(!IoTCases.judge(c, good.concat(bad[0])).ok, 'με λάθος μέτρο δεν περνά');
  assert(!IoTCases.judge(c, good.slice(1)).ok || good.length === 1, 'αν λείπει σωστό δεν περνά');
  eq(IoTCases.judge(c, bad).stopStep, -1);
});
test('ιστορίες ασφάλειας: αποθήκευση ολοκληρωμένων', () => {
  const s = IoTStorage.defaults();
  s.cases = { [IoTCases.CASES[0].id]: true, 'den-yparxei': true, 'Κακό': true };
  const v = IoTStorage.validate(JSON.parse(JSON.stringify(s)));
  eq(Object.keys(v.data ? v.data.cases : v.value.cases), [IoTCases.CASES[0].id]);
});

console.log(`\n${passed} πέρασαν, ${failed} απέτυχαν\n`);
process.exit(failed ? 1 : 0);
