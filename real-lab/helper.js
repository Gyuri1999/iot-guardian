#!/usr/bin/env node
/*
 * IoT Guardian — τοπικός βοηθός για αληθινό ESP32 και αληθινό Mosquitto.
 *
 *   node real-lab/helper.js --setup   μία φορά: στοιχεία WiFi και αισθητήρα (μένουν στο real-lab/secrets.json)
 *   node real-lab/helper.js           ξεκινά τον βοηθό και τον broker, άνοιξε http://localhost:8787
 *
 * Ακούει μόνο στο 127.0.0.1 και δέχεται αιτήματα μόνο από τη σελίδα του παιχνιδιού που σερβίρει ο ίδιος.
 * Κάνει compile και upload με arduino-cli, διαβάζει το Serial και τρέχει τον Mosquitto ως child process.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const vm = require('vm');
const readline = require('readline');
const { spawn, execFileSync } = require('child_process');

const PORT = 8787;
const WS_PORT = 9001;
const FQBN = 'esp32:esp32:esp32';
const REAL = __dirname;
const GAME = path.resolve(REAL, '..');
const WORK = path.join(REAL, '.work');
const SECRETS = process.env.GUARDIAN_SECRETS || path.join(REAL, 'secrets.json');
const SKETCH = path.join(WORK, 'sketch');  // ο φάκελος και το .ino έχουν το ίδιο όνομα (κανόνας του Arduino)
const BUILD = path.join(WORK, 'build');
const BROKER = path.join(WORK, 'broker');
const TLS = path.join(WORK, 'tls');
const MONITOR_USER = 'guardian-monitor';
const MONITOR_PASS = crypto.randomBytes(12).toString('base64url');

// Ο parser ρυθμίσεων είναι ο ίδιος με του παιχνιδιού.
const sandbox = {};
vm.runInNewContext(fs.readFileSync(path.join(GAME, 'js/network.js'), 'utf8'), sandbox);
const IoTNet = sandbox.IoTNet;

function which(name, extra) {
  for (const dir of (process.env.PATH || '').split(':').concat(extra || [])) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const ARDUINO = which('arduino-cli', ['/opt/homebrew/bin', '/usr/local/bin']);
const MOSQUITTO = which('mosquitto', ['/opt/homebrew/sbin', '/opt/homebrew/opt/mosquitto/sbin', '/usr/local/sbin', '/usr/sbin']);
const MOSQ_PASSWD = which('mosquitto_passwd', ['/opt/homebrew/bin', '/opt/homebrew/opt/mosquitto/bin', '/usr/local/bin']);
const OPENSSL = which('openssl', ['/opt/homebrew/bin', '/usr/bin']);

function lanIP() {
  const nets = os.networkInterfaces();
  const order = Object.keys(nets).sort((a, b) => (a.startsWith('en') ? 0 : 1) - (b.startsWith('en') ? 0 : 1));
  for (const name of order) for (const n of nets[name]) if (n.family === 'IPv4' && !n.internal) return n.address;
  return '127.0.0.1';
}

function readSecrets() {
  try { return JSON.parse(fs.readFileSync(SECRETS, 'utf8')); } catch (e) { return null; }
}

// ------------------------------------------------------------------ ρύθμιση (--setup)

async function setup() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, def) => new Promise(res => rl.question(def !== undefined ? `${q} [${def}]: ` : `${q}: `, a => res(a.trim() || def || '')));
  console.log('Στοιχεία για την αληθινή πλακέτα. Μένουν μόνο σε αυτόν τον υπολογιστή, στο real-lab/secrets.json.\n');
  const old = readSecrets() || {};
  const s = {
    wifiSsid: await ask('Όνομα WiFi (SSID)', old.wifiSsid),
    wifiPassword: await ask('Κωδικός WiFi', old.wifiPassword ? '(ίδιος)' : undefined),
    dhtPin: Number(await ask('GPIO του αισθητήρα DHT', String(old.dhtPin || 13))),
    dhtType: (await ask('Τύπος αισθητήρα (DHT11 ή DHT22)', old.dhtType || 'DHT22')).toUpperCase()
  };
  if (s.wifiPassword === '(ίδιος)') s.wifiPassword = old.wifiPassword;
  rl.close();
  if (!['DHT11', 'DHT22'].includes(s.dhtType)) s.dhtType = 'DHT22';
  fs.writeFileSync(SECRETS, JSON.stringify(s, null, 2), { mode: 0o600 });
  console.log('\nΑποθηκεύτηκε. Τώρα τρέξε: node real-lab/helper.js');
}

// ------------------------------------------------------------------ μετατροπή κώδικα

const C = s => JSON.stringify(String(s)); // JSON string = έγκυρο C++ string literal για κείμενο χωρίς control chars

// Τυλίγει κάθε "κείμενο" σε String(...), ώστε το "Temp: " + x να ενώνει κείμενο όπως στο παιχνίδι
// (στη C++ ένα σκέτο "…" + αριθμός είναι αριθμητική δεικτών). Σχόλια και γραμμές μένουν όπως ήταν.
function wrapStrings(src) {
  let out = '';
  for (let i = 0; i < src.length;) {
    if (src.startsWith('//', i)) { const j = src.indexOf('\n', i); const e = j < 0 ? src.length : j; out += src.slice(i, e); i = e; continue; }
    if (src.startsWith('/*', i)) { const j = src.indexOf('*/', i + 2); const e = j < 0 ? src.length : j + 2; out += src.slice(i, e); i = e; continue; }
    if (src[i] === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"' && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += 'String(' + src.slice(i, j + 1) + ')';
      i = j + 1;
      continue;
    }
    out += src[i++];
  }
  return out;
}

const PROVIDED = new Set(['WIFI_SSID', 'WIFI_PASSWORD', 'MQTT_HOST', 'HOME_CA', 'LED_PIN', 'BUTTON_PIN', 'PIR_PIN', 'TRIG_PIN', 'ECHO_PIN', 'RED_PIN', 'YELLOW_PIN', 'GREEN_PIN']);

function transpile(code, consts) {
  const head = ['#include "IoTGuardian.h"'];
  for (const [k, v] of Object.entries(consts || {})) {
    if (PROVIDED.has(k) || !/^[A-Z_][A-Z0-9_]*$/.test(k)) continue;
    head.push(typeof v === 'number' ? `static const long ${k} = ${Math.trunc(v)};` : `static const String ${k} = ${C(v)};`);
  }
  let body = wrapStrings(code)
    .replace(/\bWiFi\s*\.\s*begin\s*\(/g, 'guardianWiFiBegin(')
    .replace(/\bWiFi\s*\.\s*localIP\s*\(\s*\)/g, 'guardianLocalIP()');
  return { text: head.join('\n') + '\n' + body, offset: head.length };
}

function writeSketch(code, consts, s = readSecrets(), dir = SKETCH) {
  if (!s) throw new Error('Δεν έχουν οριστεί τα στοιχεία WiFi. Σταμάτα τον βοηθό και τρέξε: node real-lab/helper.js --setup');
  fs.mkdirSync(dir, { recursive: true });
  const ca = fs.existsSync(path.join(TLS, 'ca.crt')) ? fs.readFileSync(path.join(TLS, 'ca.crt'), 'utf8').trim() : '';
  fs.writeFileSync(path.join(dir, 'guardian_secrets.h'), [
    '// Γράφεται αυτόματα από το helper.js. Μην το μοιράζεσαι: περιέχει τον κωδικό του WiFi σου.',
    '#pragma once',
    `#define WIFI_SSID String(${C(s.wifiSsid)})`,
    `#define WIFI_PASSWORD String(${C(s.wifiPassword)})`,
    `#define MQTT_HOST String(${C(lanIP())})`,
    `#define GUARDIAN_DHT_PIN ${Number(s.dhtPin) || 13}`,
    `#define GUARDIAN_DHT_TYPE ${s.dhtType === 'DHT11' ? 'DHT11' : 'DHT22'}`,
    `static const char HOME_CA[] = R"PEM(${ca})PEM";`,
    ''
  ].join('\n'));
  fs.copyFileSync(path.join(REAL, 'IoTGuardian.h'), path.join(dir, 'IoTGuardian.h'));
  const t = transpile(code, consts);
  fs.writeFileSync(path.join(dir, path.basename(dir) + '.ino'), t.text);
  return t.offset;
}

// ------------------------------------------------------------------ Serial Monitor

const events = new Set(); // ανοιχτές συνδέσεις SSE
const history = { serial: [], broker: [] };
function emit(src, text) {
  const h = history[src];
  h.push(text);
  if (h.length > 300) h.shift();
  const msg = `data: ${JSON.stringify({ src, text, t: Date.now() })}\n\n`;
  for (const res of events) res.write(msg);
}

let monitor = null;
function startMonitor(port) {
  stopMonitor();
  const p = spawn(ARDUINO, ['monitor', '-p', port, '--config', 'baudrate=115200', '--quiet', '--raw']);
  monitor = { proc: p, port };
  let buf = '';
  p.stdout.on('data', d => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { emit('serial', buf.slice(0, i).replace(/\r$/, '')); buf = buf.slice(i + 1); }
  });
  p.stderr.on('data', d => emit('serial', '[monitor] ' + d.toString().trim()));
  p.on('exit', () => { if (monitor && monitor.proc === p) monitor = null; });
}
function stopMonitor() {
  if (!monitor) return;
  monitor.proc.kill();
  monitor = null;
}

// ------------------------------------------------------------------ compile και upload

function run(cmd, args, onLine) {
  return new Promise(resolve => {
    const p = spawn(cmd, args);
    let out = '';
    const feed = d => {
      out += d;
      String(d).split('\n').forEach(l => { if (l.trim()) onLine(l); });
    };
    p.stdout.on('data', feed);
    p.stderr.on('data', feed);
    p.on('exit', code => resolve({ code, out }));
  });
}

async function boards() {
  if (!ARDUINO) return [];
  try {
    const raw = execFileSync(ARDUINO, ['board', 'list', '--format', 'json'], { encoding: 'utf8', timeout: 15000 });
    const j = JSON.parse(raw);
    const list = Array.isArray(j) ? j : (j.detected_ports || []);
    return list.map(x => x.port || x)
      .filter(p => p && p.protocol === 'serial' && /usb|wch|SLAB|cu\.usbserial|ttyUSB|ttyACM/i.test(p.address + ' ' + (p.label || '') + ' ' + JSON.stringify(p.properties || {})))
      .map(p => ({ address: p.address, label: p.label || p.address }));
  } catch (e) { return []; }
}

async function flash(req, res) {
  const body = await readJson(req);
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' });
  const send = o => res.write(JSON.stringify(o) + '\n');
  try {
    if (!ARDUINO) throw new Error('Δεν βρέθηκε το arduino-cli. Εγκατάσταση: brew install arduino-cli');
    const port = String(body.port || '');
    if (!port) throw new Error('Δεν διάλεξες θύρα. Σύνδεσε το ESP32 με καλώδιο USB δεδομένων.');
    if (body.consts && body.consts.MQTT_USER && body.consts.MQTT_PASS && brokerState.mode === 'lab') {
      labUsers[body.consts.MQTT_USER] = String(body.consts.MQTT_PASS);
      await startBroker();
    }
    const offset = writeSketch(String(body.code || ''), body.consts);
    send({ type: 'stage', text: 'Compile για ESP32 (η πρώτη φορά αργεί 1–2 λεπτά)…' });
    const errors = [];
    const c = await run(ARDUINO, ['compile', '--fqbn', FQBN, '--build-path', BUILD, SKETCH], line => {
      const m = line.match(/sketch\.ino:(\d+):(?:\d+:)?\s*(error|warning):\s*(.*)/);
      if (m) {
        const n = Number(m[1]) - offset;
        const item = { type: m[2], line: n > 0 ? n : null, text: m[3] };
        if (m[2] === 'error') errors.push(item);
        send({ type: 'diag', ...item });
      } else send({ type: 'log', text: line });
    });
    if (c.code !== 0) throw new Error(errors.length ? `Το compile απέτυχε (${errors.length} σφάλματα).` : 'Το compile απέτυχε. Δες το log.');
    stopMonitor();
    send({ type: 'stage', text: `Upload στο ${port}…` });
    const u = await run(ARDUINO, ['upload', '-p', port, '--fqbn', FQBN, '--input-dir', BUILD], line => send({ type: 'log', text: line }));
    if (u.code !== 0) throw new Error('Το upload απέτυχε. Αν η πλακέτα δεν απαντά, κράτα πατημένο το BOOT μέχρι να ξεκινήσει το upload.');
    startMonitor(port);
    send({ type: 'done', text: 'Η πλακέτα τρέχει τον κώδικά σου. Το Serial Monitor ακούει στα 115200.' });
  } catch (e) {
    send({ type: 'error', text: e.message });
  }
  res.end();
}

// ------------------------------------------------------------------ Mosquitto

const brokerState = { mode: 'lab', proc: null, error: '', listeners: [] };
const labUsers = {};

function confFromLesson(text) {
  const { config } = IoTNet.parseBrokerConfig(text);
  return {
    listeners: config.listeners.length ? config.listeners : [{ port: 1883, tls: false }],
    allowAnonymous: config.allowAnonymous,
    passwords: config.passwords,
    acl: config.aclEnabled ? config.ruleLines : null
  };
}

async function startBroker(lessonConfigText) {
  if (!MOSQUITTO) { brokerState.error = 'Δεν βρέθηκε ο mosquitto. Εγκατάσταση: brew install mosquitto'; return; }
  // null: ανοιχτό εργαστήριο (1883, ανώνυμοι επιτρέπονται) · κείμενο: οι ρυθμίσεις του μαθήματος · τίποτα: ό,τι ίσχυε
  const mode = lessonConfigText === undefined ? brokerState.mode : (lessonConfigText === null ? 'lab' : 'lesson');
  const text = lessonConfigText === undefined ? brokerState.text : lessonConfigText;
  const spec = mode === 'lesson'
    ? confFromLesson(text)
    : { listeners: [{ port: 1883, tls: false }], allowAnonymous: true, passwords: { ...labUsers }, acl: null };
  if (spec.listeners.some(l => l.tls) && !fs.existsSync(path.join(TLS, 'server.crt'))) {
    brokerState.error = 'Οι ρυθμίσεις ζητούν TLS. Πάτα πρώτα «Δημιουργία πιστοποιητικών». Ο broker συνεχίζει με τις προηγούμενες ρυθμίσεις.';
    return;
  }
  brokerState.mode = mode;
  brokerState.text = text;

  fs.mkdirSync(BROKER, { recursive: true });
  const conf = ['# Γράφεται από το helper.js', `allow_anonymous ${spec.allowAnonymous ? 'true' : 'false'}`,
    'log_dest stdout', 'log_type error', 'log_type warning', 'log_type notice', 'log_type information', 'log_type subscribe', 'connection_messages true', 'log_timestamp false'];
  for (const l of spec.listeners) {
    conf.push(`listener ${l.port} 0.0.0.0`);
    if (l.tls) {
      conf.push(`cafile ${path.join(TLS, 'ca.crt')}`, `certfile ${path.join(TLS, 'server.crt')}`, `keyfile ${path.join(TLS, 'server.key')}`);
    }
  }
  conf.push(`listener ${WS_PORT} 127.0.0.1`, 'protocol websockets');

  const passwd = path.join(BROKER, 'passwd');
  const users = { ...spec.passwords, [MONITOR_USER]: MONITOR_PASS };
  fs.writeFileSync(passwd, Object.entries(users).map(([u, p]) => `${u}:${p}`).join('\n') + '\n', { mode: 0o600 });
  if (MOSQ_PASSWD) execFileSync(MOSQ_PASSWD, ['-U', passwd]);
  conf.push(`password_file ${passwd}`);
  if (spec.acl) {
    const byUser = {};
    for (const r of spec.acl) (byUser[r.user] = byUser[r.user] || []).push(`topic ${r.access} ${r.pattern}`);
    byUser[MONITOR_USER] = ['topic readwrite #'];
    const acl = path.join(BROKER, 'acl');
    fs.writeFileSync(acl, Object.entries(byUser).map(([u, rs]) => `user ${u}\n${rs.join('\n')}`).join('\n\n') + '\n');
    conf.push(`acl_file ${acl}`);
  }
  const confPath = path.join(BROKER, 'mosquitto.conf');
  fs.writeFileSync(confPath, conf.join('\n') + '\n');

  await stopBroker();
  brokerState.error = '';
  brokerState.listeners = spec.listeners;
  const p = spawn(MOSQUITTO, ['-c', confPath]);
  brokerState.proc = p;
  const feed = d => String(d).split('\n').forEach(l => { if (l.trim()) emit('broker', l.trim()); });
  p.stdout.on('data', feed);
  p.stderr.on('data', feed);
  p.on('exit', code => {
    if (brokerState.proc !== p) return;
    brokerState.proc = null;
    brokerState.error = `Ο mosquitto σταμάτησε (κωδικός ${code}). Μήπως τρέχει ήδη άλλος broker στην ίδια θύρα; (brew services stop mosquitto)`;
    emit('broker', brokerState.error);
  });
  await new Promise(r => setTimeout(r, 400));
}

function stopBroker() {
  const p = brokerState.proc;
  if (!p) return Promise.resolve();
  brokerState.proc = null;
  return new Promise(r => { p.once('exit', r); p.kill(); setTimeout(r, 1500); });
}

function tlsSetup() {
  if (!OPENSSL) throw new Error('Δεν βρέθηκε το openssl.');
  fs.mkdirSync(TLS, { recursive: true });
  const ip = lanIP();
  const o = (...a) => execFileSync(OPENSSL, a, { cwd: TLS, stdio: 'pipe' });
  o('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.crt', '-days', '825', '-subj', '/CN=IoT Guardian Home Lab CA');
  o('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', `/CN=${ip}`);
  fs.writeFileSync(path.join(TLS, 'server.ext'), `subjectAltName=IP:${ip},DNS:localhost\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n`);
  o('x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.crt', '-days', '825', '-extfile', 'server.ext');
  fs.chmodSync(path.join(TLS, 'ca.key'), 0o600);
  fs.chmodSync(path.join(TLS, 'server.key'), 0o600);
  return ip;
}

// ------------------------------------------------------------------ HTTP

function readJson(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', d => { s += d; if (s.length > 200000) { reject(new Error('Πολύ μεγάλο αίτημα.')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } });
  });
}
const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };

const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(GAME, rel);
  // Μόνο τα αρχεία του παιχνιδιού: όχι real-lab (μυστικά, πιστοποιητικά), όχι έξω από τον φάκελο.
  if (!file.startsWith(GAME + path.sep) || file.startsWith(REAL + path.sep) || rel.split('/').some(p => p.startsWith('.'))) return json(res, 404, { error: 'not found' });
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  // Προστασία από άλλες σελίδες: σωστό Host (όχι DNS rebinding) και, σε αλλαγές, σωστό Origin.
  if (!ALLOWED_HOSTS.has(req.headers.host)) return json(res, 403, { error: 'host' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'POST') {
    const origin = req.headers.origin || '';
    if (![...ALLOWED_HOSTS].some(h => origin === `http://${h}`)) return json(res, 403, { error: 'origin' });
    if (!/application\/json/.test(req.headers['content-type'] || '')) return json(res, 415, { error: 'json only' });
  }
  try {
    if (url.pathname === '/api/status') {
      const s = readSecrets();
      return json(res, 200, {
        helper: true,
        arduinoCli: !!ARDUINO, mosquitto: !!MOSQUITTO,
        secrets: s ? { ssid: s.wifiSsid, dhtPin: s.dhtPin, dhtType: s.dhtType } : null,
        mqttHost: lanIP(),
        ports: await boards(),
        monitor: monitor ? monitor.port : null,
        broker: { running: !!brokerState.proc, mode: brokerState.mode, error: brokerState.error, listeners: brokerState.listeners, wsPort: WS_PORT, user: MONITOR_USER, pass: MONITOR_PASS },
        tls: fs.existsSync(path.join(TLS, 'server.crt'))
      });
    }
    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': ok\n\n');
      for (const src of ['broker', 'serial']) for (const text of history[src].slice(-80)) res.write(`data: ${JSON.stringify({ src, text, old: true })}\n\n`);
      events.add(res);
      req.on('close', () => events.delete(res));
      return;
    }
    if (url.pathname === '/api/flash' && req.method === 'POST') return flash(req, res);
    if (url.pathname === '/api/serial/start' && req.method === 'POST') { const b = await readJson(req); startMonitor(String(b.port)); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/serial/stop' && req.method === 'POST') { stopMonitor(); return json(res, 200, { ok: true }); }
    if (url.pathname === '/api/broker' && req.method === 'POST') {
      const b = await readJson(req);
      if (b.config) IoTNet.parseBrokerConfig(String(b.config)); // ίδιο μήνυμα λάθους με το παιχνίδι
      await startBroker(b.config ? String(b.config) : null);
      return json(res, 200, { ok: !brokerState.error, error: brokerState.error, mode: brokerState.mode });
    }
    if (url.pathname === '/api/tls' && req.method === 'POST') { const ip = tlsSetup(); return json(res, 200, { ok: true, ip }); }
    if (req.method === 'GET') return serveStatic(req, res, url);
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    return json(res, 400, { error: e.message, line: e.line || null });
  }
});

async function main() {
  if (process.argv.includes('--setup')) return setup();
  if (!readSecrets()) console.log('Σημείωση: δεν έχουν οριστεί στοιχεία WiFi. Τρέξε πρώτα: node real-lab/helper.js --setup\n');
  if (!ARDUINO) console.log('Δεν βρέθηκε arduino-cli: brew install arduino-cli');
  if (!MOSQUITTO) console.log('Δεν βρέθηκε mosquitto: brew install mosquitto');
  await startBroker(null);
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`IoT Guardian — αληθινό εργαστήριο: http://localhost:${PORT}`);
    console.log(`Broker για το ESP32: ${lanIP()}:1883 · για τη σελίδα: ws://127.0.0.1:${WS_PORT}`);
    console.log('Ctrl+C για τερματισμό.');
  });
  const bye = async () => { stopMonitor(); await stopBroker(); process.exit(0); };
  process.on('SIGINT', bye);
  process.on('SIGTERM', bye);
}

if (require.main === module) main();
module.exports = { transpile, wrapStrings, confFromLesson, writeSketch, ARDUINO, FQBN };
