#!/usr/bin/env node
/* Γράφει το index.html (τοπική χρήση) και το iot-guardian.html (για δημοσίευση) με όλα τα αρχεία μαθημάτων. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const lessonFiles = fs.readdirSync(path.join(ROOT, 'js', 'lessons')).filter(f => f.endsWith('.js')).sort().map(f => 'js/lessons/' + f);
const scripts = ['js/interpreter.js', 'js/pyinterp.js', 'js/pyweb.js', 'js/device.js', 'js/network.js', 'js/validator.js', 'js/pisys.js', 'js/vendor/three.min.js', 'js/scene.js', 'js/scene3d.js', 'js/parts.js', 'js/lessons.js', ...lessonFiles, 'js/storage.js', 'js/real.js', 'js/ui.js']
  .map(s => `<script src="${s}"></script>`).join('\n');
const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Sans+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@400;600;700&family=Noto+Sans:wght@400;600;700&display=swap">`;
fs.writeFileSync(path.join(ROOT, 'index.html'), `<!doctype html>
<html lang="el">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>IoT Guardian</title>
${fonts}
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/scene.css">
</head>
<body>
<div id="app"><p style="padding:16px">Φόρτωση του IoT Guardian… Αν δεν εμφανιστεί τίποτα, βεβαιώσου ότι το JavaScript είναι ενεργό.</p></div>
${scripts}
</body>
</html>
`);
fs.writeFileSync(path.join(ROOT, 'iot-guardian.html'), `<title>IoT Guardian</title>
${fonts}
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/scene.css">
<script>document.documentElement.lang = 'el';</script>
<div id="app"><p style="padding:16px">Φόρτωση του IoT Guardian…</p></div>
${scripts}
`);
console.log('index.html και iot-guardian.html: ' + lessonFiles.length + ' αρχεία μαθημάτων');
