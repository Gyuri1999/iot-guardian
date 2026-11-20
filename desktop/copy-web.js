#!/usr/bin/env node
/* Αντιγράφει μόνο ό,τι χρειάζεται το παιχνίδι (index.html, css, js, favicon) στο desktop/dist,
   για να το πακετάρει το Tauri. Τα tests, τα docs και ο real-lab δεν μπαίνουν στην εφαρμογή. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'dist');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ['index.html', 'favicon.svg']) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of ['css', 'js']) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
let n = 0;
(function count(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? count(path.join(d, e.name)) : n++; })(OUT);
console.log(`desktop/dist: ${n} αρχεία`);
