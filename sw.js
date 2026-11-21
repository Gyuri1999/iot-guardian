/* IoT Guardian — service worker (γράφεται από το tools/write-html.js, μην το αλλάζεις με το χέρι).
   Κρατά όλο το παιχνίδι στη συσκευή, ώστε να παίζει και χωρίς internet. Τα αρχεία έχουν ?v=<hash>,
   άρα μια νέα έκδοση φέρνει νέα ονόματα και η παλιά cache σβήνεται. */
const CACHE = "iotg-4d5c4e1a42";
const ASSETS = ["./","index.html","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png","icons/apple-touch-icon.png","css/style.css?v=f7a7df95","css/scene.css?v=08fb39cc","css/guardian-polish.css?v=28d98af1","js/interpreter.js?v=1f41da25","js/pyinterp.js?v=2b57a4e2","js/pyweb.js?v=1d4b1f56","js/pymicro.js?v=a3ed49e8","js/pyparts.js?v=570de286","js/device.js?v=e731e99c","js/network.js?v=4d7ee50b","js/validator.js?v=81bcd5f9","js/pisys.js?v=45bffd59","js/rsinterp.js?v=93c4f0b5","js/rsruntime.js?v=74728ed1","js/rslib.js?v=8ed6ca11","js/rscheck.js?v=0ebeb527","js/vendor/three.min.js?v=a13f10ad","js/scene.js?v=907202b9","js/bbview.js?v=4f1e9be1","js/bbassemble.js?v=0322679d","js/bench.js?v=522142a5","js/bbpractice.js?v=a2a876e9","js/scene3d.js?v=2a9d138a","js/breadboard3d.js?v=ecb9eaa6","js/parts.js?v=a8491a3a","js/themes.js?v=da229a50","js/sfx.js?v=7da2df50","js/juice.js?v=aa8d0fb6","js/housemap.js?v=3da955c7","js/speak.js?v=966fc031","js/learn.js?v=91c864cf","js/wiring.js?v=ebd91a2c","js/gardi.js?v=d434fa36","js/challenge.js?v=be25ead1","js/sandbox.js?v=0c875fbf","js/blocks.js?v=1b0e7918","js/tour.js?v=88dbe1b2","js/cases.js?v=5d930699","js/cases-data.js?v=7a13b957","js/intruder.js?v=df1d6ceb","js/teacher.js?v=68ffb740","js/stories.js?v=3fa985b2","js/lessons.js?v=0bbb0be8","js/lessons/ch04.js?v=27715545","js/lessons/ch05.js?v=d72bf1f8","js/lessons/ch06.js?v=3b95f4e1","js/lessons/ch07.js?v=3c6e4ff5","js/lessons/ch08.js?v=81b2505c","js/lessons/ch09.js?v=007d5728","js/lessons/ch10.js?v=16bbf8bb","js/lessons/ch11.js?v=bdcb7e66","js/lessons/ch12.js?v=e34275db","js/lessons/ch13.js?v=bb8f4fc0","js/lessons/ch14.js?v=0ad59fef","js/lessons/ch15.js?v=5d22b6ed","js/lessons/ch16.js?v=f3c0fd21","js/lessons/ch17.js?v=26b2c629","js/lessons/ch18.js?v=8fc9f2be","js/lessons/ch19.js?v=f9a1122a","js/lessons/ch20.js?v=80a8926c","js/lessons/ch21.js?v=c4265c5d","js/lessons/ch22.js?v=d40b382f","js/lessons/ch23.js?v=24a6c5dc","js/lessons/ch24.js?v=effab617","js/lessons/ch25.js?v=db95a42a","js/lessons/ch26.js?v=51a0b07a","js/lessons/mp30.js?v=aead7ab2","js/lessons/mp31.js?v=0c87f6f4","js/lessons/mp32.js?v=b0a9fddd","js/lessons/mp33.js?v=f66a77b0","js/lessons/mp34.js?v=c7915e1d","js/lessons/mp35.js?v=2ebd022b","js/lessons/mp36.js?v=8cb251e5","js/lessons/projects.js?v=f04ac2bc","js/lessons/rs1.js?v=9a41472b","js/lessons/rs2.js?v=b60ce9c6","js/lessons/rs3.js?v=95c95e67","js/lessons/rs4.js?v=ae26afb7","js/lessons/rs5.js?v=08d744fa","js/lessons/rs6.js?v=a59adb2a","js/lessons/rs7.js?v=3d571dcf","js/lessons/rs8.js?v=72befcba","js/storage.js?v=de3defb0","js/real.js?v=748a5af4","js/ui.js?v=bc4e1290"];
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
  const fonts = /^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (u.origin !== location.origin && !fonts) return; // π.χ. ο τοπικός βοηθός real-lab: ποτέ από cache
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  })));
});
