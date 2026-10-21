#!/usr/bin/env node
// Κάνει compile για αληθινό ESP32 τη λύση κάθε άσκησης κώδικα, μέσα από το real-lab/IoTGuardian.h.
// Χρησιμοποιεί φανταστικά στοιχεία WiFi. Δεν χρειάζεται πλακέτα.
//   node tools/real-compile.js            όλες οι ασκήσεις
//   node tools/real-compile.js c7-l1 c16  μόνο όσες ξεκινούν έτσι
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawn } = require('child_process');
const helper = require('../real-lab/helper.js');

const ROOT = path.resolve(__dirname, '..');
const ctx = vm.createContext({ console });
for (const f of ['interpreter.js', 'pyinterp.js', 'pyweb.js', 'device.js', 'network.js', 'validator.js', 'pisys.js', 'lessons.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), ctx);
for (const f of fs.readdirSync(path.join(ROOT, 'js', 'lessons')).filter(f => f.endsWith('.js')).sort()) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'lessons', f), 'utf8'), ctx);
const L = ctx.IoTLessons;
const all = (L.LESSONS || Object.values(L).find(v => Array.isArray(v) && v[0] && v[0].id && v[0].chapter));
const want = process.argv.slice(2);
const lessons = all.filter(l => typeof l.solution === 'string' && !/^\s*(listener|#|password|allow_anonymous)/m.test(l.solution) && /void\s+setup/.test(l.solution))
  .filter(l => !want.length || want.some(w => l.id.startsWith(w)));

const SECRETS = { wifiSsid: 'Lab-Test', wifiPassword: 'not-a-real-password', dhtPin: 13, dhtType: 'DHT22' };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-compile-'));
const JOBS = Math.max(1, Math.min(4, os.cpus().length - 1));

function compile(l) {
  const dir = path.join(TMP, l.id.replace(/-/g, '_'));
  const offset = helper.writeSketch(l.solution, l.consts || (l.world && l.world.consts), SECRETS, dir);
  return new Promise(resolve => {
    const p = spawn(helper.ARDUINO, ['compile', '--fqbn', helper.FQBN, '--build-path', path.join(dir, 'build'), dir]);
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    p.on('exit', code => {
      const errs = [...out.matchAll(/\.ino:(\d+):\d+: error: (.*)/g)].map(m => `γρ. ${m[1] - offset}: ${m[2]}`);
      resolve({ id: l.id, ok: code === 0, errs: errs.length ? errs : (code === 0 ? [] : [out.split('\n').slice(-8).join('\n')]) });
    });
  });
}

(async () => {
  console.log(`${lessons.length} λύσεις, ${JOBS} παράλληλα…`);
  const queue = lessons.slice();
  const results = [];
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (queue.length) {
      const r = await compile(queue.shift());
      results.push(r);
      console.log(`${r.ok ? '✓' : '✗'} ${r.id}${r.ok ? '' : '\n    ' + r.errs.slice(0, 4).join('\n    ')}`);
    }
  }));
  const bad = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - bad} πέρασαν, ${bad} απέτυχαν`);
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(bad ? 1 : 0);
})();
