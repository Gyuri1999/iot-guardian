#!/usr/bin/env node
/* Γράφει το index.html (τοπική χρήση) και το iot-guardian.html (για δημοσίευση) με όλα τα αρχεία μαθημάτων. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
// ?v=<hash του αρχείου>: ο browser παίρνει το νέο αρχείο μόλις αλλάξει, αντί για το παλιό από την cache.
const ver = f => f + '?v=' + crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, f))).digest('hex').slice(0, 8);
const lessonFiles = fs.readdirSync(path.join(ROOT, 'js', 'lessons')).filter(f => f.endsWith('.js')).sort().map(f => 'js/lessons/' + f);
const scriptFiles = ['js/interpreter.js', 'js/pyinterp.js', 'js/pyweb.js', 'js/pymicro.js', 'js/pyparts.js', 'js/device.js', 'js/network.js', 'js/validator.js', 'js/pisys.js', 'js/rsinterp.js', 'js/rsruntime.js', 'js/rslib.js', 'js/rscheck.js', 'js/vendor/three.min.js', 'js/scene.js', 'js/bbview.js', 'js/bbassemble.js', 'js/bench.js', 'js/bbpractice.js', 'js/scene3d.js', 'js/breadboard3d.js', 'js/parts.js', 'js/themes.js', 'js/sfx.js', 'js/juice.js', 'js/housemap.js', 'js/speak.js', 'js/learn.js', 'js/wiring.js', 'js/gardi.js', 'js/challenge.js', 'js/sandbox.js', 'js/blocks.js', 'js/tour.js', 'js/cases.js', 'js/cases-data.js', 'js/intruder.js', 'js/teacher.js', 'js/stories.js', 'js/lessons.js', ...lessonFiles, 'js/storage.js', 'js/real.js', 'js/ui.js'];
const scripts = scriptFiles.map(s => `<script src="${ver(s)}"></script>`).join('\n');
const favicon = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8').replace(/\s+/g, ' '));
const fonts = `<link rel="icon" type="image/svg+xml" href="${favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Noto+Sans:wght@400;600;700&display=swap">`;
// Εγκατάσταση σε κινητό/υπολογιστή από τον browser (PWA) και παιχνίδι χωρίς internet.
// Ο service worker γράφεται μόνο σε https (GitHub Pages)· όχι στην εφαρμογή Tauri και όχι σε http://localhost.
const pwa = `<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#13254a">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="IoT Guardian">
<script>if ('serviceWorker' in navigator && location.protocol === 'https:' && !/tauri/.test(location.hostname)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>`;
const assets = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', ver('css/style.css'), ver('css/scene.css'), ver('css/guardian-polish.css'), ...scriptFiles.map(ver)];
const cacheName = 'iotg-' + crypto.createHash('sha1').update(assets.join('|')).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'sw.js'), `/* IoT Guardian — service worker (γράφεται από το tools/write-html.js, μην το αλλάζεις με το χέρι).
   Κρατά όλο το παιχνίδι στη συσκευή, ώστε να παίζει και χωρίς internet. Τα αρχεία έχουν ?v=<hash>,
   άρα μια νέα έκδοση φέρνει νέα ονόματα και η παλιά cache σβήνεται. */
const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(assets, null, 0)};
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('iotg-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // η σελίδα: πρώτα το δίκτυο (για νέες εκδόσεις), αλλιώς από τη συσκευή
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./', cp)); return res; })
      .catch(() => caches.match('./').then(h => h || caches.match('index.html'))));
    return;
  }
  const fonts = /^fonts\\.(googleapis|gstatic)\\.com$/.test(u.hostname);
  if (u.origin !== location.origin && !fonts) return; // π.χ. ο τοπικός βοηθός real-lab: ποτέ από cache
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  })));
});
`);
fs.writeFileSync(path.join(ROOT, 'index.html'), `<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>IoT Guardian</title>
${fonts}
<link rel="stylesheet" href="${ver('css/style.css')}">
<link rel="stylesheet" href="${ver('css/scene.css')}">
<link rel="stylesheet" href="${ver('css/guardian-polish.css')}">
${pwa}
</head>
<body>
<div id="app"><p style="padding:16px">Φόρτωση του IoT Guardian… Αν δεν εμφανιστεί τίποτα, βεβαιώσου ότι το JavaScript είναι ενεργό.</p></div>
${scripts}
</body>
</html>
`);
fs.writeFileSync(path.join(ROOT, 'iot-guardian.html'), `<title>IoT Guardian</title>
${fonts}
<link rel="stylesheet" href="${ver('css/style.css')}">
<link rel="stylesheet" href="${ver('css/scene.css')}">
<link rel="stylesheet" href="${ver('css/guardian-polish.css')}">
<script>document.documentElement.lang = 'el';</script>
<div id="app"><p style="padding:16px">Φόρτωση του IoT Guardian…</p></div>
${scripts}
`);
console.log('index.html και iot-guardian.html: ' + lessonFiles.length + ' αρχεία μαθημάτων');
