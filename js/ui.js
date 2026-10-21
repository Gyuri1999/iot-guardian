/*
 * IoT Guardian — διεπαφή χρήστη.
 * Ροή: ενέργεια χρήστη → interpreter/πλακέτα/δίκτυο → κατάσταση → UI.
 * Η πλακέτα, το Serial Monitor, οι μεταβλητές, ο broker και ο έλεγχος διαβάζουν όλα την ίδια κατάσταση.
 *
 * Τρεις τύποι άσκησης (lesson.mode):
 *   code     — κώδικας για την πλακέτα (προεπιλογή)
 *   config   — ρυθμίσεις του εικονικού broker
 *   analysis — ανάλυση συνθετικής καταγραφής με επιλογή τεκμηρίων
 */
(function () {
  'use strict';

  const { CodeError, displayValue, BOARD_CONSTS } = window.IoTInterp;
  const IOT_DISPLAY = displayValue;
  const { lessons, CHAPTERS, SKILLS, KIND_LABELS, GLOSSARY } = window.IoTLessons;
  const NET = window.IoTNet;
  const VAL = window.IoTValidator;
  const PY = window.IoTPy;
  // Πρώτα το Μέρος Α (ESP32, μαζί με τα επιπλέον κεφάλαια), μετά το Μέρος Β (Python).
  CHAPTERS.sort((a, b) => (a.lang === 'python') - (b.lang === 'python') || a.n - b.n);
  // Γλώσσα της άσκησης: 'cpp' (ESP32) ή 'python' (Raspberry Pi).
  const langOf = l => (l && l.lang) || 'cpp';
  const isPy = () => !!S.task && langOf(S.task) === 'python';
  // Σειρά: κεφάλαιο, μετά αριθμός μαθήματος (cN-lM), ανεξάρτητα από τη σειρά φόρτωσης των αρχείων.
  const lessonNo = l => Number((/-l(\d+)$/.exec(l.id) || [0, 0])[1]);
  lessons.sort((a, b) => a.chapter - b.chapter || lessonNo(a) - lessonNo(b));
  const byId = Object.fromEntries(lessons.map(l => [l.id, l]));

  let P = window.IoTStorage.load();
  const S = {
    task: null, gen: null, machine: null, board: null,
    runState: 'idle', error: null, warnings: [], info: null,
    inputs: {},
    lastFrame: 0, target: 0, raf: null, lastPaint: 0,
    stampBefore: 0, serialPaused: false, serialClearedAt: 0, serialSig: '',
    tab: 'code', resetTimer: null, results: null, escTab: false, saveTimer: null,
    netFilter: null, netFilterText: '', netSig: '', selectedPacket: null, mqttSig: '', logSig: '',
    capture: null, evidence: new Set(), configSummary: null, cfgTimer: null
  };

  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const br = s => esc(s).replace(/\n/g, '<br>');
  const app = () => $('#app');
  // setTimeout αντί για requestAnimationFrame: συνεχίζει και σε ενσωματωμένα παράθυρα που παγώνουν τα frames.
  const schedule = cb => setTimeout(() => cb(performance.now()), 16);
  const SLEEP_SPEED = 100; // όσο η πλακέτα κοιμάται, ο εικονικός χρόνος τρέχει 100 φορές πιο γρήγορα

  const worldOf = l => l.world || l.initialWorld || {};
  const modeOf = l => l.mode || 'code';
  const hardwareOf = l => l.hardware || ['button', 'pir'];
  function panelsOf(l) {
    if (l.panels) return l.panels;
    if (modeOf(l) === 'analysis') return ['net'];
    if (modeOf(l) === 'config') return [];
    const base = ['serial', 'vars', 'branch', 'loops'];
    return worldOf(l).broker ? ['serial', 'mqtt', 'net', 'vars', 'branch', 'loops'] : base;
  }

  function save() { window.IoTStorage.save(P); }
  function announce(text) {
    const r = $('#live');
    if (!r) return;
    r.textContent = '';
    setTimeout(() => { r.textContent = text; }, 40);
  }

  // ------------------------------------------------------------ Ρυθμίσεις

  function applySettings() {
    const s = P.settings;
    const html = document.documentElement;
    if (s.theme === 'system') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', s.theme);
    html.style.setProperty('--font-scale', String(s.fontScale));
    html.setAttribute('data-spacing', s.lineSpacing);
    html.setAttribute('data-reduced-motion', s.reducedMotion ? 'true' : 'false');
  }

  // ------------------------------------------------------------ Πρόοδος

  const chapterLessons = n => lessons.filter(l => l.chapter === n);
  const readyChapters = () => CHAPTERS.filter(c => c.ready && chapterLessons(c.n).length);
  function chapterUnlocked(n) {
    const ch = CHAPTERS.find(c => c.n === n);
    if (ch && ch.unlockAfter) return chapterLessons(ch.unlockAfter).every(l => P.completed[l.id]);
    const ready = readyChapters().filter(c => !c.unlockAfter).map(c => c.n);
    const idx = ready.indexOf(n);
    if (idx <= 0) return idx === 0;
    return chapterLessons(ready[idx - 1]).every(l => P.completed[l.id]);
  }
  function taskUnlocked(l) {
    if (P.completed[l.id]) return true;
    return chapterUnlocked(l.chapter) && l.prerequisites.every(p => P.completed[p]);
  }
  function nextTask() {
    return lessons.find(l => !P.completed[l.id] && taskUnlocked(l)) || null;
  }

  // ------------------------------------------------------------ Κοινά κομμάτια

  // Εικονίδια γραμμής (24×24, stroke = currentColor).
  const IC = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
    map: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M8 7h7"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3"/><rect x="8" y="13" width="8" height="5"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M7 4v16M17 4v16"/>',
    step: '<path d="M5 4l10 8-10 8z"/><path d="M19 4v16"/>',
    reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 3v5h5"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7"/><path d="M12 17h.01"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'
  };
  const icon = (name, label) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"${label ? '' : ''}>${IC[name]}</svg>`;

  // Μικρές εικόνες για τη λωρίδα μαθημάτων.
  const TH = {
    led: '<path d="M18 30h12v6H18z" fill="#8a2018"/><path d="M18 30V16a6 6 0 0 1 12 0v14z" fill="#d9372b"/><ellipse cx="21.5" cy="17" rx="1.6" ry="3.4" fill="#fff" opacity=".6"/><path d="M21 36v8M27 36v6" stroke="#9aa0a6" stroke-width="1.6"/>',
    button: '<path d="M10 26l14-7 14 7-14 7z" fill="#2a2a2d"/><path d="M10 26v5l14 7v-5zM38 26v5l-14 7v-5z" fill="#141416"/><ellipse cx="24" cy="24" rx="7.5" ry="4" fill="#8f2c1f"/><ellipse cx="24" cy="21.5" rx="7.5" ry="4" fill="#d4472f"/>',
    pir: '<path d="M8 30l16-8 16 8-16 8z" fill="#1f7247"/><path d="M8 30v3l16 8v-3zM40 30v3l-16 8v-3z" fill="#134a2e"/><path d="M13 27a11 7 0 0 0 22 0a11 11 0 0 0-22 0z" fill="#f6f4ee" stroke="#c9c3b6"/>',
    thermo: '<path d="M14 18l10-5 10 5v14l-10 5-10-5z" fill="#e8e8e2" stroke="#c9c9c2"/><path d="M14 18l10 5 10-5M24 23v14" stroke="#c9c9c2" fill="none"/><path d="M17 22v9M20 23.5v9" stroke="#9b9b94"/>',
    wifi: '<path d="M8 32l16-8 16 8-16 8z" fill="#2c3549"/><path d="M14 30l-2-14M34 30l2-14" stroke="#2c3549" stroke-width="2.6" stroke-linecap="round"/><path d="M18 16a8 8 0 0 1 12 0M14 12a14 14 0 0 1 20 0" stroke="#2f9fe8" stroke-width="2" fill="none" stroke-linecap="round"/>',
    pi: '<path d="M6 28l18-9 18 9-18 9z" fill="#23864f"/><path d="M6 28v2l18 9v-2zM42 28v2l-18 9v-2z" fill="#155c35"/><path d="M18 26l6-3 6 3-6 3z" fill="#23262b"/><circle cx="34" cy="20" r="3" fill="#e8892f"/><circle cx="14" cy="18" r="2.2" fill="#18a196"/>',
    lock: '<rect x="13" y="22" width="22" height="16" rx="2.5" fill="#1d2534"/><path d="M17 22v-5a7 7 0 0 1 14 0v5" stroke="#1d2534" stroke-width="3" fill="none"/><circle cx="24" cy="30" r="2.6" fill="#d6aa48"/>',
    scope: '<rect x="8" y="12" width="26" height="4" rx="1" fill="#c9bfa7"/><rect x="8" y="19" width="20" height="4" rx="1" fill="#c8642a"/><rect x="8" y="26" width="24" height="4" rx="1" fill="#c9bfa7"/><circle cx="31" cy="30" r="7" stroke="#1d2534" stroke-width="2.6" fill="none"/><path d="M36 35l5 5" stroke="#1d2534" stroke-width="3" stroke-linecap="round"/>',
    battery: '<rect x="10" y="16" width="26" height="16" rx="2.5" fill="none" stroke="#1d2534" stroke-width="2.4"/><rect x="36" y="21" width="3" height="6" rx="1" fill="#1d2534"/><rect x="13" y="19" width="9" height="10" rx="1" fill="#1f7a55"/><path d="M26 19l-3 6h4l-3 6" stroke="#e2b52d" stroke-width="1.8" fill="none"/>',
    board: '<path d="M4 26l20-10 20 10-20 10z" fill="#1d2534"/><path d="M4 26v2l20 10v-2zM44 26v2l-20 10v-2z" fill="#0c121b"/><path d="M12 25l9-4.5 9 4.5-9 4.5z" fill="#cfd4d9"/><circle cx="31" cy="29" r="1.6" fill="#7cc4ff"/>'
  };
  const thumb = kind => `<svg class="thumb" viewBox="0 0 48 48" aria-hidden="true">${TH[kind] || TH.led}</svg>`;
  function lessonIcon(l) {
    const hw = l.hardware || [];
    const w = worldOf(l);
    if (l.chapter === 16) return 'battery';
    if (langOf(l) === 'python' && w.broker) return 'pi';
    if (modeOf(l) === 'config') return 'lock';
    if (modeOf(l) === 'analysis') return 'scope';
    if (l.chapter === 1 && lessonNo(l) === 1) return 'board';
    if (hw.includes('sensor')) return 'thermo';
    if (w.broker) return 'pi';
    if (hw.includes('router') || w.wifi) return 'wifi';
    if (hw.includes('pir')) return 'pir';
    if (hw.includes('button') && l.chapter > 1) return 'button';
    return 'led';
  }

  function rail(active) {
    const b = (id, ic, label, on) => `<button class="rail-btn${on ? ' on' : ''}" id="${id}" title="${label}" aria-label="${label}">${icon(ic)}</button>`;
    return `<nav class="rail" aria-label="Πλοήγηση">
      <div class="rail-logo" aria-hidden="true"><span></span></div>
      ${b('nav-home', 'home', 'Αρχική και χάρτης κεφαλαίων', active === 'home')}
      ${b('nav-lab', 'chip', 'Εργαστήριο: συνέχεια από εκεί που έμεινες', active === 'lab')}
      <button class="rail-btn" data-open="glossary" title="Γλωσσάρι" aria-label="Γλωσσάρι">${icon('book')}</button>
      <button class="rail-btn" data-open="data" title="Εξαγωγή ή εισαγωγή προόδου" aria-label="Εξαγωγή ή εισαγωγή προόδου">${icon('save')}</button>
      <span class="rail-space"></span>
      <button class="rail-btn" data-open="settings" title="Ρυθμίσεις εμφάνισης" aria-label="Ρυθμίσεις εμφάνισης">${icon('gear')}</button>
    </nav>`;
  }

  function header(progressLabel, done, total, clockLabel, clockValue) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<header class="hdr">
      <div class="hdr-brand">
        <div class="hdr-mark" aria-hidden="true"></div>
        <div><div class="hdr-title">IoT Guardian</div><div class="hdr-sub">Κατάλαβε · Γράψε · Προστάτευσε</div></div>
      </div>
      <span class="spacer"></span>
      <div class="pill progress-pill" title="${esc(progressLabel)}">
        ${icon('book')}
        <div class="pp-body"><div class="pp-label">${esc(progressLabel)}</div><div class="pp-bar"><i style="width:${pct}%"></i></div></div>
        <div class="pp-num">${done}/${total}</div>
      </div>
      <div class="pill clock"><div class="pp-label">${esc(clockLabel)}</div><div class="clock-v" id="hdr-clock">${esc(clockValue)}</div></div>
    </header>
    <p class="notice"><strong>Εκπαιδευτική προσομοίωση</strong> · όχι πραγματική συσκευή ή πραγματική καταγραφή δικτύου. Όλα τα δεδομένα είναι συνθετικά.</p>`;
  }

  function sceneControls() {
    return `<div class="scene-ctl" role="group" aria-label="Προβολή σκηνής">
      <button class="sc-b" id="sc-zoom-out" aria-label="Σμίκρυνση">${icon('minus')}</button>
      <button class="sc-b" id="sc-fit" aria-label="Επαναφορά προβολής">${icon('fit')}</button>
      <button class="sc-b" id="sc-zoom-in" aria-label="Μεγέθυνση">${icon('plus')}</button>
    </div>
    <p class="scene-hint">Σύρε για μετακίνηση · ροδέλα ή + / − για ζουμ</p>`;
  }

  function mountScene(svgHTML) {
    const wrap = $('#scene');
    wrap.insertAdjacentHTML('afterbegin', svgHTML);
    const svg = wrap.querySelector('svg.scene');
    const pz = window.IoTScene.attachPanZoom(svg);
    const on = (id, f) => { const el = $('#' + id); if (el) el.onclick = f; };
    on('sc-zoom-in', pz.zoomIn);
    on('sc-zoom-out', pz.zoomOut);
    on('sc-fit', pz.reset);
    S.scene = svg;
    bindParts(wrap, svg);
    const motion = !P.settings.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 3D εξαρτήματα (Three.js) κάτω από την SVG· χωρίς WebGL μένει η επίπεδη σκηνή.
    if (window.IoTScene3D) window.IoTScene3D.mount(wrap, svg, window.IoTScene.manifest, { animate: motion });
    if (motion) window.IoTScene.buildIn(svg);
    return svg;
  }

  // ---------- «Τι είναι;»: κάθε κομμάτι της σκηνής εξηγείται με κλικ ή Enter.
  function bindParts(wrap, svg) {
    const PARTS = window.IoTParts || {};
    const tip = document.createElement('div');
    tip.className = 'part-tip';
    tip.hidden = true;
    wrap.appendChild(tip);
    const card = document.createElement('div');
    card.className = 'part-info';
    card.hidden = true;
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-live', 'polite');
    wrap.appendChild(card);
    const findPart = t => { const el = t && t.closest && t.closest('[data-part]'); return el && svg.contains(el) && PARTS[el.dataset.part] ? el : null; };
    const groupsOf = key => [...svg.querySelectorAll(`[data-part="${key}"]`)];
    const mark = (cls, key) => {
      svg.querySelectorAll('.' + cls).forEach(x => x.classList.remove(cls));
      if (key) groupsOf(key).forEach(x => x.classList.add(cls));
    };
    svg.addEventListener('mouseover', e => {
      const el = findPart(e.target);
      mark('part-hot', el && el.dataset.part);
      if (!el) { tip.hidden = true; return; }
      const r = wrap.getBoundingClientRect();
      tip.textContent = PARTS[el.dataset.part].title + ' · πάτα για «τι είναι»';
      tip.style.left = (e.clientX - r.left) + 'px';
      tip.style.top = (e.clientY - r.top) + 'px';
      tip.hidden = false;
    });
    svg.addEventListener('mouseleave', () => { mark('part-hot', null); tip.hidden = true; });
    const open = key => {
      const p = PARTS[key];
      if (!p) return;
      mark('part-sel', key);
      card.innerHTML = `<button class="pi-close" aria-label="Κλείσιμο">×</button>
        <div class="pi-kind">${esc(p.kind)}</div><h4>${esc(p.title)}</h4>
        <dl><dt>Τι είναι</dt><dd>${esc(p.what)}</dd><dt>Τι κάνει</dt><dd>${esc(p.does)}</dd>
        ${p.pins && p.pins !== '—' ? `<dt>Συνδέσεις</dt><dd>${esc(p.pins)}</dd>` : ''}<dt>Στο παιχνίδι</dt><dd>${esc(p.game)}</dd></dl>`;
      card.hidden = false;
      card.querySelector('.pi-close').onclick = () => { card.hidden = true; mark('part-sel', null); };
      announce(`${p.title}. ${p.what}`);
    };
    svg.addEventListener('click', e => {
      if (svg._moved) return;
      const el = findPart(e.target);
      if (!el) return;
      // Κουμπί, PIR, router: το κλικ πάνω τους αλλάζει την είσοδο. Το «τι είναι» ανοίγει από την ετικέτα τους.
      if (el.classList.contains('clickable') && !el.classList.contains('callout')) return;
      open(el.dataset.part);
    });
    svg.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = e.target.closest && e.target.closest('.callout.part-link');
      if (!el) return;
      e.preventDefault();
      open(el.dataset.part);
    });
  }

  // Είσοδοι της πλακέτας (κάρτα πάνω στη σκηνή). Τα ίδια χειριστήρια υπάρχουν και πάνω στα αντικείμενα.
  function inputsCardHTML(hw, world) {
    const I = S.inputs;
    const rows = [];
    const sw = (id, label, on, onText, offText) => `<div class="in-row"><span class="in-l">${label}</span><button class="toggle" id="${id}" aria-pressed="${on}"><span class="value">${on ? onText : offText}</span></button></div>`;
    if (hw.includes('button')) rows.push(sw('btn-toggle', 'Κουμπί', I.button, 'Πατημένο · HIGH', 'Ελεύθερο · LOW'));
    if (hw.includes('pir')) rows.push(sw('pir-toggle', 'PIR', I.pir, 'Κίνηση · HIGH', 'Καμία κίνηση · LOW'));
    if (hw.includes('sensor')) {
      rows.push(`<div class="in-row"><label class="in-l" for="temp-range">Θερμ. <output id="temp-out">${I.temp.toFixed(1)} °C</output></label><input type="range" id="temp-range" min="-10" max="50" step="0.5" value="${I.temp}"></div>`);
      rows.push(`<div class="in-row"><label class="in-l" for="hum-range">Υγρασία <output id="hum-out">${Math.round(I.humidity)} %</output></label><input type="range" id="hum-range" min="0" max="100" step="1" value="${I.humidity}"></div>`);
      rows.push(sw('fault-toggle', 'Αισθητήρας', I.sensorFault, 'Σφάλμα · nan', 'Λειτουργεί'));
    }
    if (hw.includes('router')) rows.push(sw('router-toggle', 'Router', I.router, 'Ενεργό', 'Σβηστό'));
    if (hw.includes('ultrasonic')) rows.push(`<div class="in-row"><label class="in-l" for="dist-range">Εμπόδιο <output id="dist-out">${Math.round(I.distance)} cm</output></label><input type="range" id="dist-range" min="2" max="200" step="1" value="${I.distance}"></div>`);
    const netInfo = hw.includes('router') || hw.includes('broker') || world.broker || world.wifi;
    if (netInfo) rows.push(`<div class="in-status"><div id="wifi-text">WiFi: —</div><div id="mqtt-text">MQTT: —</div></div>`);
    if (hw.includes('broker')) rows.push(`<div class="btn-row"><button class="btn sm" id="broker-restart">Επανεκκίνηση broker</button><button class="btn sm" id="broker-dup" title="Ο broker ξαναστέλνει στη συσκευή το τελευταίο μήνυμα, όπως μπορεί να γίνει με QoS 1">Διπλή παράδοση</button></div>`);
    const py = S.task && langOf(S.task) === 'python';
    const noLed = hw.includes('ultrasonic') || hw.includes('traffic');
    if (!(noLed && !hw.includes('led')) && (!py || hw.some(h => ['led', 'button', 'pir'].includes(h)) || !(world.broker || hw.includes('web')))) rows.push(`<div class="in-led"><span class="dot" id="led-dot"></span><span id="led-text">LED σβηστό</span> · <span id="led-mode">pinMode: δεν ορίστηκε</span></div>`);
    if (!rows.length) return '';
    return `<div class="inputs-card" aria-label="Είσοδοι της πλακέτας"><div class="ic-head">Είσοδοι · πάτα και πάνω στα εξαρτήματα</div>${rows.join('')}</div>`;
  }

  // ------------------------------------------------------------ Αρχική οθόνη

  function chapterCards() {
    return CHAPTERS.map(ch => {
      const ls = chapterLessons(ch.n);
      if (!ch.ready || !ls.length) return '';
      const d = ls.filter(l => P.completed[l.id]).length;
      const ok = chapterUnlocked(ch.n);
      const first = ls.find(l => !P.completed[l.id] && taskUnlocked(l)) || ls[0];
      return `<button class="strip-card${d === ls.length ? ' done' : ''}" data-chapter="${ch.n}" ${ok ? '' : 'disabled'} title="${esc(ch.title)}">
        ${thumb(lessonIcon(first))}
        <span class="sc-txt"><span class="sc-n">${ch.bonus ? 'Επιπλέον · ' : ''}${ch.lang === 'python' ? 'Python · ' : ''}Κεφ. ${ch.n}</span><span class="sc-t">${esc(ch.title)}</span><span class="sc-p">${ok ? `${d}/${ls.length}${d === ls.length ? ' · ολοκληρώθηκε' : ''}` : 'κλειδωμένο'}</span></span>
      </button>`;
    }).join('');
  }

  function renderHome() {
    stopMachine();
    S.task = null;
    document.title = 'IoT Guardian';
    S.inputs = { button: false, pir: false };
    const total = lessons.length;
    const done = lessons.filter(l => P.completed[l.id]).length;
    const nxt = nextTask();
    const allDone = done === total;
    const skills = Object.entries(SKILLS).map(([k, name]) => {
      const ls = lessons.filter(l => l.skills.includes(k));
      if (!ls.length) return '';
      const d = ls.filter(l => P.completed[l.id]).length;
      const pct = Math.round((d / ls.length) * 100);
      return `<li class="skill"><span>${esc(name)}</span><span class="num">${d}/${ls.length}</span>
        <span class="bar" role="img" aria-label="${esc(name)}: ${d} από ${ls.length}"><i style="width:${pct}%"></i></span></li>`;
    }).join('');
    S.partShown = false;
    const chapters = CHAPTERS.map(ch => {
      const ls = chapterLessons(ch.n);
      if (!ch.ready || !ls.length) return '';
      const unlocked = chapterUnlocked(ch.n);
      const items = ls.map(l => {
        const ok = taskUnlocked(l);
        const mark = P.completed[l.id] ? '✓' : ok ? '○' : '·';
        const state = P.completed[l.id] ? 'ολοκληρώθηκε' : ok ? 'διαθέσιμο' : 'κλειδωμένο';
        return `<li><button class="task-link" data-task="${l.id}" ${ok ? '' : 'disabled'}><span class="mark" aria-hidden="true">${mark}</span><span>${esc(l.title)}<span class="kind">${esc(KIND_LABELS[l.kind])} · ${state}</span></span></button></li>`;
      }).join('');
      const part = ch.lang === 'python' && !S.partShown ? (S.partShown = true, '<h4 class="part-h">Μέρος Β · Raspberry Pi και Python</h4>') : '';
      return `${part}<details class="chap"${P.current && byId[P.current] && byId[P.current].chapter === ch.n ? ' open' : ''}><summary><span class="no">${String(ch.n).padStart(2, '0')}</span> ${esc(ch.title)}${ch.lang === 'python' ? ' <span class="py-tag">Python</span>' : ''} <span class="muted">· ${unlocked ? `${ls.filter(l => P.completed[l.id]).length}/${ls.length}` : 'κλειδωμένο'}</span></summary><ul class="task-list">${items}</ul></details>`;
    }).join('');

    const cert = allDone ? `<div class="card certificate"><h2>Βεβαίωση ολοκλήρωσης</h2>
        <p>Ολοκλήρωσες και τις ${total} ασκήσεις του IoT Guardian: από το πρώτο LED μέχρι ένα εικονικό έξυπνο σπίτι με ελεγχόμενα μηνύματα, μοναδικές ταυτότητες, ACLs, TLS με έλεγχο πιστοποιητικού και ασφαλή επανασύνδεση.</p>
        <p class="muted">Είναι βεβαίωση εκπαιδευτικής ολοκλήρωσης, όχι επαγγελματική πιστοποίηση. Για δοκιμές σε πραγματικό ESP32 ή Raspberry Pi, δούλεψε μόνο σε δικό σου ή εξουσιοδοτημένο εργαστήριο.</p></div>` : '';

    app().innerHTML = `<div class="app">${rail('home')}
      <div class="main">
        ${header('Συνολική πρόοδος', done, total, 'Σήμερα', new Date().toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }))}
        <div class="ws">
          <section class="stage" aria-label="Η πλακέτα">
            <div class="scene-wrap" id="scene">${sceneControls()}</div>
            <div class="card dock home-map">
              <div class="card-head"><h3>Χάρτης κεφαλαίων</h3><span class="muted" style="font-size:0.85rem">Κάθε κεφάλαιο ανοίγει όταν τελειώσεις το προηγούμενο</span></div>
              <div class="chaps">${chapters}</div>
            </div>
          </section>
          <aside class="side">
            <div class="card welcome">
              <span class="kind-tag">Καλώς ήρθες</span>
              <h1>Από το πρώτο LED στο ασφαλές έξυπνο σπίτι</h1>
              <p>Είσαι ο τεχνικός μιας εικονικής κατοικίας. Γράφεις μικρά προγράμματα για μια πλακέτα ESP32, τα τρέχεις βήμα-βήμα και βλέπεις γιατί ανάβει κάθε φως και φεύγει κάθε μήνυμα. Μετά συνδέεις WiFi, MQTT και dashboard, και ρυθμίζεις το σύστημα ώστε να είναι ασφαλές.</p>
              <div class="btn-row"><button class="btn primary" id="continue">${icon('play')} ${nxt ? `${done ? 'Συνέχεια' : 'Ξεκίνα'}: ${esc(nxt.title)}` : 'Επανάληψη από την αρχή'}</button><button class="btn" id="restart">Νέα διαδρομή</button></div>
              <div id="confirm-slot"></div>
            </div>
            ${cert}
            <div class="card"><div class="card-head"><h3>Δεξιότητες</h3><span class="muted" style="font-size:0.85rem">${done} από ${total} ασκήσεις</span></div><ul class="skills">${skills}</ul></div>
            <div class="card"><h3>Γνώρισε την πλακέτα</h3><p class="muted" style="margin:0">Το ESP32 έχει επεξεργαστή, WiFi και Bluetooth σε ένα μικρό module. Τα pins (GPIO) συνδέουν LED, κουμπιά και αισθητήρες. Το μπλε LED «D2» είναι συνδεδεμένο στο GPIO 2. Σε πραγματικές πλακέτες τα GPIO διαφέρουν από μοντέλο σε μοντέλο.</p></div>
          </aside>
        </div>
        <footer class="strip" aria-label="Κεφάλαια"><div class="strip-head">Κεφάλαια</div><div class="strip-row">${chapterCards()}</div></footer>
      </div></div>`;

    mountScene(window.IoTScene.homeScene());
    const d2 = $('#sc-d2'); if (d2) d2.classList.add('on');
    const halo = $('#sc-d2-halo'); if (halo) halo.classList.add('on');
    const pwr = $('#sc-pwr'); if (pwr) pwr.classList.add('on');
    bindRail();
    $('#continue').onclick = () => openTask((nxt || lessons[0]).id);
    $('#restart').onclick = () => {
      $('#confirm-slot').innerHTML = `<div class="confirm" role="alert"><p>Θα σβηστούν οι ολοκληρωμένες ασκήσεις, οι απαντήσεις και ο κώδικάς σου. Οι ρυθμίσεις εμφάνισης μένουν. Συνέχεια;</p>
        <div class="btn-row"><button class="btn primary" id="restart-yes">Ναι, νέα διαδρομή</button><button class="btn" id="restart-no">Άκυρο</button></div></div>`;
      $('#restart-no').onclick = () => { $('#confirm-slot').innerHTML = ''; $('#restart').focus(); };
      $('#restart-yes').onclick = () => {
        const settings = P.settings;
        P = window.IoTStorage.defaults();
        P.settings = settings;
        save();
        renderHome();
        announce('Η πρόοδος μηδενίστηκε.');
      };
      $('#restart-yes').focus();
    };
    app().querySelectorAll('[data-task]').forEach(b => { b.onclick = () => openTask(b.dataset.task); });
    bindChapterCards();
    window.scrollTo(0, 0);
  }

  function bindChapterCards() {
    app().querySelectorAll('[data-chapter]').forEach(b => {
      b.onclick = () => {
        const ls = chapterLessons(Number(b.dataset.chapter));
        const t = ls.find(l => !P.completed[l.id] && taskUnlocked(l)) || ls.find(taskUnlocked);
        if (t) openTask(t.id);
      };
    });
  }

  function bindRail() {
    $('#nav-home').onclick = renderHome;
    $('#nav-lab').onclick = () => {
      const t = (P.current && byId[P.current] && taskUnlocked(byId[P.current])) ? byId[P.current] : (nextTask() || lessons[0]);
      openTask(t.id);
    };
  }

  // ------------------------------------------------------------ Εργαστήριο

  function freshInputs(l) {
    const w = worldOf(l);
    return {
      button: !!w.button, pir: !!w.pir,
      temp: typeof w.temp === 'number' ? w.temp : 22.5,
      humidity: typeof w.humidity === 'number' ? w.humidity : 45,
      sensorFault: !!w.sensorFault, router: w.router !== false,
      distance: typeof w.distance === 'number' ? w.distance : 50
    };
  }

  function openTask(id) {
    const l = byId[id];
    if (!l || !taskUnlocked(l)) return;
    stopMachine();
    S.task = l;
    S.board = null;
    S.machine = null;
    S.error = null;
    S.warnings = [];
    S.info = null;
    S.results = null;
    S.serialClearedAt = 0;
    S.serialSig = '';
    S.netSig = '';
    S.mqttSig = '';
    S.logSig = '';
    S.selectedPacket = null;
    S.netFilter = null;
    S.netFilterText = '';
    S.evidence = new Set();
    S.configSummary = null;
    S.msgSeen = 0;
    S.capture = modeOf(l) === 'analysis' ? VAL.buildCapture(l.capture) : null;
    S.inputs = freshInputs(l);
    S.infoTab = 'lesson';
    S.dockTab = null;
    P.current = id;
    save();
    renderLab();
  }

  const DOCK_NAMES = { serial: 'Serial Monitor', mqtt: 'MQTT', net: 'Δίκτυο', logs: 'Log broker', energy: 'Ενέργεια', vars: 'Μεταβλητές', branch: 'if / else', loops: 'Επαναλήψεις', syntax: 'Σύνταξη', summary: 'Πώς το διαβάζει ο broker', cfglog: 'Log ελέγχου', hosts: 'Συσκευές', detail: 'Πακέτο', web: 'Browser', db: 'Βάση δεδομένων' };

  function dockPanels(l) {
    const mode = modeOf(l);
    const p = panelsOf(l);
    const panels = [];
    if (mode === 'config') {
      panels.push(['summary', '<div id="cfg-summary"></div>']);
      panels.push(['cfglog', '<div class="table-wrap" id="cfg-log"><p class="muted">Πάτησε «Έλεγχος λύσης». Εδώ θα δεις τι έγραψε ο broker για κάθε σύνδεση και κάθε μήνυμα των ελέγχων.</p></div>']);
      panels.push(['syntax', l.system ? systemHelpCard() : configHelpCard()]);
      return panels;
    }
    if (p.includes('serial')) panels.push(['serial', `<div class="card-head"><span class="muted" id="serial-title" style="font-size:0.85rem">${langOf(l) === 'python' ? 'Ό,τι τυπώνει το print() στο τερματικό του Pi' : 'Ό,τι τυπώνει η πλακέτα'}</span>
        <div class="mini-btns"><button class="btn sm" id="s-clear">Καθαρισμός</button><button class="btn sm" id="s-pause" aria-pressed="false">Πάγωμα</button><button class="btn sm" id="s-copy">Αντιγραφή</button></div></div>
        <div class="serial" id="serial" role="log" aria-labelledby="serial-title" tabindex="0"></div>`]);
    if (p.includes('net')) panels.push(['net', netCardHTML(mode === 'analysis')]);
    if (p.includes('logs')) panels.push(['logs', '<div class="table-wrap" id="logs"></div>']);
    if (p.includes('mqtt')) panels.push(['mqtt', '<div id="mqtt"></div>']);
    if (p.includes('energy')) panels.push(['energy', '<div id="energy"></div>']);
    if (p.includes('web')) panels.push(['web', webPanelHTML()]);
    if (p.includes('db')) panels.push(['db', '<div id="db"></div>']);
    if (p.includes('vars')) panels.push(['vars', '<div class="table-wrap" id="vars"></div>']);
    if (p.includes('branch')) panels.push(['branch', '<div id="branch"></div>']);
    if (p.includes('loops')) panels.push(['loops', '<div class="table-wrap" id="loops"></div>']);
    if (mode === 'analysis') panels.push(['hosts', hostsTable()]);
    return panels;
  }

  function netCardHTML(analysis) {
    return `<div class="card-head"><span class="muted" id="net-count" style="font-size:0.85rem"></span></div>
      <form class="filter-row" id="net-filter-form">
        <label class="sr-only" for="net-filter">Φίλτρο</label>
        <input id="net-filter" type="text" spellcheck="false" autocomplete="off" placeholder='π.χ. mqtt   ή   ip.src == 192.168.1.43   ή   mqtt.topic == "home/led"' value="${esc(S.netFilterText)}">
        <button class="btn" type="submit">Εφαρμογή</button>
      </form>
      <p class="filter-help">${esc(NET.FILTER_HELP)}</p>
      <div id="net-filter-err"></div>
      <div class="table-wrap net-table" id="net"></div>
      <div id="net-detail" class="net-detail"></div>`;
  }

  function lessonStrip(l) {
    const ch = CHAPTERS.find(c => c.n === l.chapter);
    const ls = chapterLessons(l.chapter);
    const ready = readyChapters().map(c => c.n);
    const i = ready.indexOf(l.chapter);
    const prev = ready[i - 1];
    const next = ready[i + 1];
    const cards = ls.map((x, k) => {
      const ok = taskUnlocked(x);
      return `<button class="strip-card${x === l ? ' current' : ''}${P.completed[x.id] ? ' done' : ''}" data-task="${x.id}" ${ok ? '' : 'disabled'} ${x === l ? 'aria-current="true"' : ''}>
        ${thumb(lessonIcon(x))}<span class="sc-txt"><span class="sc-n">${k + 1}. ${esc(KIND_LABELS[x.kind])}</span><span class="sc-t">${esc(x.title)}</span><span class="sc-p">${P.completed[x.id] ? '✓ ολοκληρώθηκε' : ok ? '' : 'κλειδωμένο'}</span></span></button>`;
    }).join('');
    return `<footer class="strip" aria-label="Μαθήματα του κεφαλαίου">
      <div class="strip-head">Μαθήματα · Κεφάλαιο ${l.chapter}: ${esc(ch.title)}</div>
      <div class="strip-row">
        ${prev !== undefined ? `<button class="strip-nav" data-chapter="${prev}" ${chapterUnlocked(prev) ? '' : 'disabled'} aria-label="Κεφάλαιο ${prev}">${icon('left')}<span>Κεφ. ${prev}</span></button>` : ''}
        ${cards}
        ${next !== undefined ? `<button class="strip-nav" data-chapter="${next}" ${chapterUnlocked(next) ? '' : 'disabled'} aria-label="Κεφάλαιο ${next}"><span>Κεφ. ${next}</span>${icon('right')}</button>` : ''}
      </div>
    </footer>`;
  }

  function renderLab() {
    const l = S.task;
    const mode = modeOf(l);
    const ls = chapterLessons(l.chapter);
    const idx = ls.indexOf(l) + 1;
    const ch = CHAPTERS.find(c => c.n === l.chapter);
    const doneCh = ls.filter(x => P.completed[x.id]).length;
    document.title = `${l.title} · IoT Guardian`;
    const quizTitle = ['micro', 'guided', 'variant'].includes(l.kind) ? 'Ερώτηση πρόβλεψης' : 'Ερώτηση κατανόησης';
    const hw = hardwareOf(l);
    const w = worldOf(l);

    const tabs = [['lesson', 'Μάθημα'], ['steps', 'Βήματα'], ['quiz', 'Ερώτηση'], ['help', 'Βοήθεια']];
    const info = `<div class="card info">
      <div class="info-tabs" role="tablist" aria-label="Πληροφορίες μαθήματος">${tabs.map(([k, n]) => `<button role="tab" class="itab" id="itab-${k}" data-itab="${k}" aria-controls="info-${k}">${n}</button>`).join('')}</div>
      <div class="info-panel guide" id="info-lesson" role="tabpanel" aria-labelledby="itab-lesson">
        <span class="kind-tag">${esc(KIND_LABELS[l.kind])}${mode === 'config' ? (l.system ? ' · ρυθμίσεις του Pi' : ' · ρυθμίσεις broker') : mode === 'analysis' ? ' · ανάλυση καταγραφής' : ''} · άσκηση ${idx} από ${ls.length}</span>
        <h2>${esc(l.title)}</h2>
        <ul class="objectives">${l.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
        <div class="theory">${l.theory}</div>
      </div>
      <div class="info-panel" id="info-steps" role="tabpanel" aria-labelledby="itab-steps" hidden>
        <ol class="steps">${l.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        ${l.supportedSyntax ? `<p class="syntax-note"><strong>Υποστηριζόμενα εδώ:</strong> ${esc(l.supportedSyntax)}</p>` : ''}
        ${l.evidenceHint ? `<p class="syntax-note"><strong>Τι ψάχνεις:</strong> ${esc(l.evidenceHint)}</p>` : ''}
      </div>
      <div class="info-panel quiz" id="info-quiz" role="tabpanel" aria-labelledby="itab-quiz" hidden><h3>${quizTitle}</h3><div id="quiz-body"></div></div>
      <div class="info-panel" id="info-help" role="tabpanel" aria-labelledby="itab-help" hidden><div id="hints"></div></div>
    </div>`;

    let tryCard;
    if (mode === 'analysis') {
      tryCard = `<div class="card try">
        <div class="try-head"><h3>Τεκμήρια</h3>
          <div class="try-btns">
            <button class="ib" id="b-clear-ev" title="Καθαρισμός επιλογών" aria-label="Καθαρισμός επιλογών">${icon('reset')}</button>
            <button class="ib" id="b-help" title="Βοήθεια" aria-label="Βοήθεια">${icon('help')}</button>
            <button class="ib primary" id="b-check" title="Έλεγχος λύσης" aria-label="Έλεγχος λύσης">${icon('check')}<span>Έλεγχος</span></button>
          </div></div>
        <p class="info-line" id="ev-status"></p>
        <p class="muted" style="font-size:0.88rem;margin:0">Φίλτραρε την καταγραφή στο κάτω μέρος και σημείωσε τα κουτάκια στις γραμμές που αποδεικνύουν την απάντησή σου.</p>
        <div id="results-slot"></div>
      </div>`;
    } else {
      const isConfig = mode === 'config';
      tryCard = `<div class="card try">
        <div class="try-head"><h3>${isConfig ? (l.system ? 'Ρυθμίσεις του Pi' : 'Ρυθμίσεις broker') : 'Δοκίμασέ το'}</h3>
          <div class="try-btns" role="toolbar" aria-label="Χειριστήρια">
            <button class="ib" id="b-reset" title="Επαναφορά άσκησης" aria-label="Επαναφορά άσκησης">${icon('reset')}</button>
            <button class="ib" id="b-help" title="Βοήθεια" aria-label="Βοήθεια">${icon('help')}</button>
            ${isConfig ? '' : `<button class="ib" id="b-step" title="Ένα βήμα (Ctrl+Shift+Enter)" aria-label="Ένα βήμα">${icon('step')}</button>
            <button class="ib" id="b-pause" title="Παύση" aria-label="Παύση">${icon('pause')}</button>`}
            <button class="ib run" id="${isConfig ? 'b-validate' : 'b-run'}" title="${isConfig ? 'Έλεγχος ρυθμίσεων' : 'Εκτέλεση'} (Ctrl+Enter)" aria-label="${isConfig ? 'Έλεγχος ρυθμίσεων' : 'Εκτέλεση'}">${icon('play')}</button>
          </div></div>
        ${isConfig ? '' : '<div class="run-state" id="run-state" aria-live="off"></div>'}
        <div class="editor">
          <div class="gutter" id="gutter" aria-hidden="true"></div>
          <div class="code-wrap">
            <pre id="hl" aria-hidden="true"></pre>
            <textarea id="code" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"
              aria-label="${isConfig ? (l.system ? 'Ρυθμίσεις του Pi' : 'Ρυθμίσεις broker') : 'Κώδικας άσκησης'}" aria-describedby="editor-help"></textarea>
          </div>
        </div>
        <p class="editor-help" id="editor-help">${isConfig
          ? 'Σχόλιο είναι μόνο γραμμή που ξεκινά με #. Tab: εσοχή · Esc και μετά Tab: έξοδος.'
          : langOf(l) === 'python' ? 'Tab: εσοχή 4 κενών · Enter μετά από «:» μεγαλώνει την εσοχή · Esc και μετά Tab: έξοδος · Ctrl+Enter: εκτέλεση'
            : 'Tab: εσοχή · Esc και μετά Tab: έξοδος · Ctrl+Enter: εκτέλεση · Ctrl+Shift+Enter: ένα βήμα'}</p>
        <button class="btn primary wide" id="b-check">${icon('check')} Έλεγχος λύσης</button>
        <div id="error-slot"></div>
        <div id="results-slot"></div>
        <div id="real-slot"></div>
      </div>`;
    }

    const panels = dockPanels(l);
    if (!S.dockTab || !panels.some(p => p[0] === S.dockTab)) S.dockTab = panels.length ? panels[0][0] : null;
    const dock = panels.length ? `<div class="card dock">
        <div class="dock-tabs" role="tablist" aria-label="Έξοδος">${panels.map(([k]) => `<button role="tab" class="dtab" data-dtab="${k}" id="dtab-${k}" aria-controls="dock-${k}">${k === 'serial' && langOf(l) === 'python' ? 'Τερματικό' : k === 'summary' && l.system ? 'Πώς το διαβάζει το Pi' : DOCK_NAMES[k]}</button>`).join('')}</div>
        ${panels.map(([k, html]) => `<div class="dock-panel" id="dock-${k}" role="tabpanel" aria-labelledby="dtab-${k}" ${k === S.dockTab ? '' : 'hidden'}>${html}</div>`).join('')}
      </div>` : '';

    app().innerHTML = `<div class="app">${rail('lab')}
      <div class="main">
        ${header(`Κεφ. ${l.chapter} · ${ch.title}`, doneCh, ls.length, 'Εικονικός χρόνος', '00:00.000')}
        <div class="ws">
          <section class="stage" aria-label="Σκηνή εργαστηρίου">
            <div class="scene-wrap" id="scene">${sceneControls()}${mode === 'code' ? inputsCardHTML(hw, w) : ''}</div>
            ${dock}
          </section>
          <aside class="side">${info}${tryCard}</aside>
        </div>
        ${lessonStrip(l)}
      </div></div>`;

    mountScene(mode !== 'code' ? window.IoTScene.netScene() : langOf(l) === 'python' ? window.IoTScene.piScene(hw, w) : window.IoTScene.labScene(hw, w));
    bindRail();
    app().querySelectorAll('.strip [data-task]').forEach(b => { b.onclick = () => openTask(b.dataset.task); });
    bindChapterCards();
    app().querySelectorAll('[data-itab]').forEach(b => { b.onclick = () => showInfo(b.dataset.itab); });
    app().querySelectorAll('[data-dtab]').forEach(b => { b.onclick = () => showDock(b.dataset.dtab); });
    showInfo(S.infoTab || 'lesson', true);
    if (S.dockTab) showDock(S.dockTab, true);
    $('#b-help').onclick = () => { showNextHint(); showInfo('help'); };
    $('#b-check').onclick = doCheck;

    if (mode !== 'analysis') {
      const ta = $('#code');
      ta.value = typeof P.drafts[l.id] === 'string' ? P.drafts[l.id] : l.initialCode;
      ta.addEventListener('input', onCodeInput);
      ta.addEventListener('scroll', syncScroll);
      ta.addEventListener('keydown', onEditorKey);
      $('#b-reset').onclick = doReset;
    }
    if (mode === 'code') {
      $('#b-run').onclick = doRun;
      $('#b-pause').onclick = doPause;
      $('#b-step').onclick = doStep;
      bindBoard();
    }
    if (mode === 'config') {
      $('#b-validate').onclick = () => { validateConfig(true); };
      validateConfig(false);
    }
    if (mode === 'analysis') {
      $('#b-clear-ev').onclick = () => { S.evidence.clear(); S.netSig = ''; S.logSig = ''; updateNet(true); updateLogs(true); updateEvidenceStatus(); };
    }
    if (mode !== 'analysis' && langOf(l) !== 'python' && window.IoTReal) {
      window.IoTReal.mount($('#real-slot'), { mode, getCode: () => $('#code').value, consts: () => worldOf(l).consts || {} });
    }
    bindOutputs();
    renderQuiz();
    renderHints();
    updateAll();
    window.scrollTo(0, 0);
  }

  function showInfo(tab, silent) {
    S.infoTab = tab;
    app().querySelectorAll('[data-itab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.itab === tab)));
    app().querySelectorAll('.info-panel').forEach(p => { p.hidden = p.id !== 'info-' + tab; });
    if (!silent) {
      const card = $('.card.info');
      if (card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: 'start', behavior: P.settings.reducedMotion ? 'auto' : 'smooth' });
    }
  }

  function showDock(tab, silent) {
    S.dockTab = tab;
    app().querySelectorAll('[data-dtab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.dtab === tab)));
    app().querySelectorAll('.dock-panel').forEach(p => { p.hidden = p.id !== 'dock-' + tab; });
    if (!silent) { updateSerial(true); updateNet(true); updateLogs(true); updateMqtt(true); }
  }

  // Συμβατότητα με παλιές κλήσεις: «guide» = οδηγίες, «code» = κώδικας.
  function setTab(tab) {
    if (tab === 'guide') showInfo(S.infoTab || 'lesson');
  }

  function hostsTable() {
    const rows = Object.entries(NET.HOST_NAMES).map(([ip, name]) => `<tr><td class="code">${ip}</td><td>${esc(name)}</td></tr>`).join('');
    return `<div class="table-wrap"><table><thead><tr><th scope="col">IP</th><th scope="col">Συσκευή</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="muted" style="font-size:0.85rem;margin-top:0.5rem">Θύρα 1883: MQTT χωρίς TLS. Θύρα 8883: συνήθως MQTT με TLS (αλλά η θύρα μόνη της δεν το εγγυάται).</p>`;
  }

  function configHelpCard() {
    return `<div class="table-wrap"><table><tbody>
        <tr><td class="code">listener 8883</td><td>άνοιξε θύρα</td></tr>
        <tr><td class="code">tls on</td><td>TLS για την προηγούμενη θύρα</td></tr>
        <tr><td class="code">allow_anonymous false</td><td>καμία σύνδεση χωρίς όνομα χρήστη</td></tr>
        <tr><td class="code">password &lt;χρήστης&gt; &lt;κωδικός&gt;</td><td>ταυτότητα ενός client</td></tr>
        <tr><td class="code">user &lt;χρήστης&gt;</td><td>οι κανόνες από κάτω αφορούν αυτόν</td></tr>
        <tr><td class="code">topic read home/#</td><td>δικαίωμα ανάγνωσης</td></tr>
        <tr><td class="code">topic write home/motion</td><td>δικαίωμα δημοσίευσης</td></tr>
        <tr><td class="code">topic readwrite …</td><td>και τα δύο</td></tr>
        <tr><td class="code">acl_default deny</td><td>ό,τι δεν επιτρέπεται ρητά, απαγορεύεται</td></tr>
      </tbody></table></div>
      <p class="muted" style="font-size:0.85rem;margin-top:0.5rem"><code>+</code> = ακριβώς ένα επίπεδο (home/+/state). <code>#</code> = όλα τα επόμενα επίπεδα, μόνο στο τέλος (home/#). Οι κωδικοί εδώ είναι φανταστικοί. Στο πραγματικό mosquitto αποθηκεύονται κρυπτογραφημένοι (hashed) σε ξεχωριστό αρχείο.</p>`;
  }

  function systemHelpCard() {
    return `<div class="table-wrap"><table><tbody>
        <tr><td class="code">PermitRootLogin no</td><td>κανείς δεν μπαίνει ως root μέσω SSH</td></tr>
        <tr><td class="code">PasswordAuthentication no</td><td>SSH μόνο με κλειδί, όχι με κωδικό</td></tr>
        <tr><td class="code">PubkeyAuthentication yes</td><td>επιτρέπονται κλειδιά SSH</td></tr>
        <tr><td class="code">AllowUsers hubadmin</td><td>μόνο αυτοί οι χρήστες μπαίνουν με SSH</td></tr>
        <tr><td class="code">ufw default deny incoming</td><td>ό,τι δεν επιτρέπεται ρητά, μπλοκάρεται</td></tr>
        <tr><td class="code">ufw allow 8883/tcp</td><td>άνοιξε μια θύρα για όλους</td></tr>
        <tr><td class="code">ufw allow from 192.168.1.0/24 to any port 22 proto tcp</td><td>άνοιξε μια θύρα μόνο για το σπίτι</td></tr>
        <tr><td class="code">ufw limit 22/tcp</td><td>μπλόκαρε όποιον κάνει πάνω από 6 συνδέσεις στα 30 s</td></tr>
        <tr><td class="code">ufw deny 1883</td><td>κλείσε μια θύρα</td></tr>
        <tr><td class="code">ufw enable</td><td>ενεργοποίησε τον firewall (χωρίς αυτό, οι κανόνες δεν ισχύουν)</td></tr>
      </tbody></table></div>
      <p class="muted" style="font-size:0.85rem;margin-top:0.5rem">Οι κανόνες ufw ελέγχονται με τη σειρά: ο πρώτος που ταιριάζει αποφασίζει. Στο sshd_config ισχύει η <strong>πρώτη</strong> τιμή κάθε ρύθμισης. Θύρες του Pi: 22 SSH, 1883 MQTT, 8883 MQTT με TLS, 5000 dashboard. Δίκτυο σπιτιού: 192.168.1.0/24.</p>`;
  }

  // ---------- Browser (αιτήματα HTTP προς το Flask του Pi)
  function webPanelHTML() {
    return `<form class="web-form" id="web-form">
        <div class="web-row">
          <label class="sr-only" for="web-method">Μέθοδος</label>
          <select id="web-method"><option>GET</option><option>POST</option></select>
          <span class="web-host">http://192.168.1.10:</span>
          <label class="sr-only" for="web-port">Θύρα</label><input id="web-port" class="web-port" value="5000" inputmode="numeric">
          <label class="sr-only" for="web-path">Διαδρομή</label><input id="web-path" class="web-path" value="/" spellcheck="false">
          <button class="btn sm primary" type="submit">Αποστολή</button>
        </div>
        <div class="web-row">
          <label class="sr-only" for="web-from">Από πού</label>
          <select id="web-from"><option value="192.168.1.20">από το tablet (192.168.1.20)</option><option value="pi">από το ίδιο το Pi (localhost)</option></select>
          <label class="sr-only" for="web-key">X-API-Key</label><input id="web-key" placeholder="X-API-Key (προαιρετικό)" spellcheck="false">
        </div>
        <label class="sr-only" for="web-body">Σώμα JSON</label>
        <textarea id="web-body" rows="2" spellcheck="false" placeholder='σώμα JSON για POST, π.χ. {"cmd": "ON"}'></textarea>
      </form>
      <div id="web-out" aria-live="polite"></div>`;
  }

  function sendWeb(e) {
    e.preventDefault();
    if (!S.board || !S.gen) { S.webMsg = 'Τρέξε πρώτα το πρόγραμμα: ο web server ξεκινά με το app.run().'; updateWeb(true); return; }
    const headers = {};
    if ($('#web-key').value.trim()) headers['X-API-Key'] = $('#web-key').value.trim();
    const body = $('#web-body').value.trim();
    const method = $('#web-method').value;
    S.webLast = VAL.httpSend(S.board, { method, path: $('#web-path').value.trim() || '/', port: Number($('#web-port').value) || 5000, from: $('#web-from').value, headers, body: method === 'POST' && body ? body : undefined });
    S.webMsg = '';
    updateWeb(true);
  }

  function updateWeb(force) {
    const el = $('#web-out');
    if (!el) return;
    const log = S.board ? S.board.http.log : [];
    const sig = log.length + ':' + (S.webLast && S.webLast.response ? 'r' : '-') + ':' + (S.webMsg || '');
    if (!force && sig === S.webSig) return;
    S.webSig = sig;
    let html = S.webMsg ? `<p class="info-line">${esc(S.webMsg)}</p>` : '';
    const req = S.webLast;
    if (req && !req.response) html += '<p class="muted">Αναμονή απάντησης…</p>';
    if (req && req.response) {
      const r = req.response;
      const isHtml = (r.contentType || '').includes('html');
      html += r.status === 0
        ? `<div class="web-resp"><b class="bad-text">Δεν έγινε σύνδεση</b><p>${esc(r.error)}</p></div>`
        : `<div class="web-resp"><div class="web-status s${String(r.status)[0]}">${r.status} · ${esc(r.contentType)}</div>
          <pre class="web-body">${esc(r.body)}</pre>
          ${isHtml ? `<div class="sub-h">Προεπισκόπηση (χωρίς scripts)</div><iframe class="web-preview" sandbox="" title="Προεπισκόπηση της σελίδας" srcdoc="${esc(r.body)}"></iframe>` : ''}</div>`;
    }
    if (log.length) {
      html += `<div class="sub-h">Αιτήματα</div><div class="table-wrap"><table><thead><tr><th>Από</th><th>Αίτημα</th><th>Κατάσταση</th></tr></thead><tbody>${log.slice(-8).reverse().map(x => `<tr><td class="code">${esc(x.req.from)}</td><td class="code">${esc(x.req.method + ' ' + x.req.path)}</td><td class="code">${x.resp.status || 'απέτυχε'}</td></tr>`).join('')}</tbody></table></div>`;
    } else if (!req) html += '<p class="muted">Τρέξε το πρόγραμμα και στείλε ένα αίτημα, σαν να άνοιγες τη σελίδα από το tablet του σπιτιού.</p>';
    el.innerHTML = html;
  }

  // ---------- Βάση δεδομένων (SQLite του Pi)
  function updateDb() {
    const el = $('#db');
    if (!el) return;
    const dbs = S.board ? Object.values(S.board.db) : [];
    const sig = dbs.map(d => d.name + d.dirty + [...d.tables.values()].map(t => t.name + t.rows.length).join() + [...d.committed.values()].map(t => t.rows.length).join()).join('|');
    if (sig === S.dbSig && el.innerHTML) return;
    S.dbSig = sig;
    if (!dbs.length) { el.innerHTML = '<p class="muted">Όταν το πρόγραμμα ανοίξει βάση με sqlite3.connect(…), εδώ θα δεις τους πίνακες και τις γραμμές τους.</p>'; return; }
    const pyd = v => PY.display(v);
    el.innerHTML = dbs.map(d => {
      const tables = [...d.tables.values()];
      return `<div class="db-file"><div class="sub-h">${esc(d.name)} ${d.dirty ? '<span class="bad-text">· αλλαγές χωρίς commit</span>' : '<span class="muted">· όλα αποθηκευμένα</span>'}</div>
        ${tables.length ? tables.map(t => {
          const saved = d.committed.get(t.name.toLowerCase());
          const rows = t.rows.slice(-25);
          return `<p style="margin:0.4rem 0 0.2rem"><strong class="code">${esc(t.name)}</strong> <span class="muted">· ${t.rows.length} γραμμές${saved && saved.rows.length !== t.rows.length ? ` (${saved.rows.length} με commit)` : !saved ? ' (ο πίνακας δεν έχει γίνει commit)' : ''}</span></p>
            <div class="table-wrap db-table"><table><thead><tr>${t.cols.map(c => `<th>${esc(c.name)} <span class="muted">${esc(c.type)}</span></th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr>${t.cols.map(c => `<td class="code">${esc(pyd(r.vals.get(c.name.toLowerCase())))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${t.cols.length}" class="muted">κανένα δεδομένο</td></tr>`}</tbody></table></div>`;
        }).join('') : '<p class="muted">Η βάση δεν έχει ακόμα πίνακες.</p>'}</div>`;
    }).join('');
  }

  function bindBoard() {
    const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
    on('btn-toggle', () => toggleInput('button'));
    on('pir-toggle', () => toggleInput('pir'));
    on('fault-toggle', () => toggleInput('sensorFault'));
    on('router-toggle', () => toggleInput('router'));
    // Πάτημα πάνω στα αντικείμενα της σκηνής (και Enter / Space με το πληκτρολόγιο).
    const sceneToggle = (id, key) => {
      const el = $('#' + id);
      if (!el) return;
      el.addEventListener('click', () => toggleInput(key));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleInput(key); } });
    };
    sceneToggle('sc-btn', 'button');
    sceneToggle('sc-pir', 'pir');
    if (hardwareOf(S.task).includes('router')) sceneToggle('sc-router', 'router');
    on('broker-restart', () => {
      if (!S.board || !S.board.net) { announce('Πάτησε πρώτα «Εκτέλεση».'); return; }
      S.board.net.restartBroker();
      announce('Ο broker έκανε επανεκκίνηση. Όλοι οι clients αποσυνδέθηκαν.');
      updateLive();
    });
    on('broker-dup', () => {
      if (!S.board || !S.board.net) { announce('Πάτησε πρώτα «Εκτέλεση».'); return; }
      const ok = S.board.net.redeliverLast('device');
      announce(ok ? 'Ο broker ξανάστειλε στη συσκευή το τελευταίο μήνυμα.' : 'Η συσκευή δεν έχει λάβει ακόμα κανένα μήνυμα για να ξανασταλεί.');
      updateLive();
    });
    const tr = $('#temp-range');
    if (tr) tr.oninput = () => { S.inputs.temp = Number(tr.value); if (S.board) S.board.inputs.temp = S.inputs.temp; $('#temp-out').textContent = S.inputs.temp.toFixed(1) + ' °C'; updateBoard(); };
    const hr = $('#hum-range');
    if (hr) hr.oninput = () => { S.inputs.humidity = Number(hr.value); if (S.board) S.board.inputs.humidity = S.inputs.humidity; $('#hum-out').textContent = Math.round(S.inputs.humidity) + ' %'; };
    const dr = $('#dist-range');
    if (dr) dr.oninput = () => setDistance(Number(dr.value));
    bindCar();
  }

  // Απόσταση του εμποδίου (cm): από το ρυθμιστικό, από το σύρσιμο του αυτοκινήτου ή από τα βελάκια.
  function setDistance(cm, announceIt) {
    S.inputs.distance = Math.max(2, Math.min(200, Math.round(cm)));
    if (S.board) S.board.inputs.distance = S.inputs.distance;
    const dr = $('#dist-range');
    if (dr && Number(dr.value) !== S.inputs.distance) dr.value = S.inputs.distance;
    if ($('#dist-out')) $('#dist-out').textContent = S.inputs.distance + ' cm';
    updateBoard();
    if (announceIt) announce(`Εμπόδιο στα ${S.inputs.distance} εκατοστά.`);
  }

  function bindCar() {
    const carEl = S.scene && S.scene.querySelector('#sc-car');
    if (!carEl) return;
    const svg = S.scene;
    let drag = null;
    carEl.addEventListener('pointerdown', e => {
      e.stopPropagation();
      drag = { x: e.clientX, y: e.clientY, cm: S.inputs.distance };
      carEl.setPointerCapture(e.pointerId);
      svg.classList.add('car-drag');
    });
    carEl.addEventListener('pointermove', e => {
      if (!drag) return;
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const k = vb.width / r.width;
      setDistance(drag.cm + window.IoTScene.dragToCm((e.clientX - drag.x) * k, (e.clientY - drag.y) * k));
    });
    const end = () => { if (drag) announce(`Εμπόδιο στα ${S.inputs.distance} εκατοστά.`); drag = null; svg.classList.remove('car-drag'); };
    carEl.addEventListener('pointerup', end);
    carEl.addEventListener('pointercancel', end);
    carEl.addEventListener('keydown', e => {
      const step = e.shiftKey ? 10 : 2;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setDistance(S.inputs.distance + step, true); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setDistance(S.inputs.distance - step, true); }
    });
  }

  function toggleInput(key) {
    S.inputs[key] = !S.inputs[key];
    if (S.board) {
      if (key === 'router') S.board.setRouter(S.inputs.router);
      else S.board.inputs[key] = S.inputs[key];
    }
    updateBoard();
    const txt = {
      button: S.inputs.button ? 'Κουμπί πατημένο' : 'Κουμπί ελεύθερο',
      pir: S.inputs.pir ? 'Υπάρχει κίνηση' : 'Καμία κίνηση',
      sensorFault: S.inputs.sensorFault ? 'Ο αισθητήρας δίνει άκυρη μέτρηση' : 'Ο αισθητήρας λειτουργεί',
      router: S.inputs.router ? 'Το router λειτουργεί' : 'Το router σταμάτησε'
    }[key];
    announce(txt);
  }

  function bindOutputs() {
    if ($('#web-form')) $('#web-form').onsubmit = sendWeb;
    if ($('#s-clear')) {
      $('#s-clear').onclick = () => { S.serialClearedAt = S.board ? S.board.seq : 0; S.serialSig = ''; updateSerial(true); };
      $('#s-pause').onclick = () => {
        S.serialPaused = !S.serialPaused;
        $('#s-pause').setAttribute('aria-pressed', String(S.serialPaused));
        $('#s-pause').textContent = S.serialPaused ? 'Συνέχεια προβολής' : 'Πάγωμα';
        if (!S.serialPaused) updateSerial(true);
      };
      $('#s-copy').onclick = copySerial;
      $('#serial').addEventListener('click', e => {
        const b = e.target.closest('[data-line]');
        if (b) gotoLine(Number(b.dataset.line));
      });
    }
    if ($('#net-filter-form')) {
      $('#net-filter-form').onsubmit = e => {
        e.preventDefault();
        const text = $('#net-filter').value;
        const f = NET.compileFilter(text);
        if (!f.ok) {
          $('#net-filter-err').innerHTML = `<p class="feedback no" role="alert"><strong>Το φίλτρο δεν εφαρμόστηκε</strong>${esc(f.error)}</p>`;
          return;
        }
        $('#net-filter-err').innerHTML = '';
        S.netFilter = text.trim() ? f.fn : null;
        S.netFilterText = text;
        S.netSig = '';
        updateNet(true);
        announce('Το φίλτρο εφαρμόστηκε.');
      };
      $('#net').addEventListener('click', e => {
        const cb = e.target.closest('input[data-ev]');
        if (cb) {
          const n = Number(cb.dataset.ev);
          if (cb.checked) S.evidence.add('p' + n); else S.evidence.delete('p' + n);
          updateEvidenceStatus();
          return;
        }
        const row = e.target.closest('tr[data-no]');
        if (row) selectPacket(Number(row.dataset.no));
      });
      $('#net').addEventListener('keydown', e => {
        const row = e.target.closest('tr[data-no]');
        if (row && (e.key === 'Enter' || e.key === ' ') && e.target.tagName !== 'INPUT') { e.preventDefault(); selectPacket(Number(row.dataset.no)); }
      });
    }
    if ($('#logs')) {
      $('#logs').addEventListener('change', e => {
        const cb = e.target.closest('input[data-log]');
        if (!cb) return;
        const id = 'l' + cb.dataset.log;
        if (cb.checked) S.evidence.add(id); else S.evidence.delete(id);
        updateEvidenceStatus();
      });
    }
    if ($('#mqtt')) {
      $('#mqtt').addEventListener('submit', e => {
        if (e.target.id !== 'dash-form') return;
        e.preventDefault();
        if (!S.board || !S.board.net) { S.info = 'Πάτησε πρώτα «Εκτέλεση», ώστε να ξεκινήσει ο εικονικός κόσμος.'; renderErrorSlot(); return; }
        const net = S.board.net;
        net.tick();
        if (!net.connected('dashboard')) { announce('Το dashboard δεν είναι συνδεδεμένο στον broker.'); S.info = 'Το dashboard δεν είναι συνδεδεμένο στον broker αυτή τη στιγμή.'; renderErrorSlot(); return; }
        const topic = $('#dash-topic').value.trim();
        const payload = $('#dash-payload').value;
        const r = net.publish('dashboard', topic, payload, $('#dash-retain').checked, 0);
        announce(r.ok ? `Το dashboard έστειλε στο ${topic}.` : r.message);
        S.mqttSig = '';
        updateMqtt(true);
      });
    }
  }

  // ------------------------------------------------------------ Editor

  const KW = new Set(['RTC_DATA_ATTR', 'void', 'int', 'long', 'unsigned', 'bool', 'boolean', 'float', 'double', 'String', 'byte', 'const', 'if', 'else', 'for', 'while', 'return', 'true', 'false', '#define', '#include']);
  const FN = new Set(['pinMode', 'digitalWrite', 'digitalRead', 'delay', 'millis', 'Serial', 'begin', 'print', 'println', 'setup', 'loop', 'WiFi', 'mqtt',
    'readTemperature', 'readHumidity', 'isnan', 'toInt', 'toFloat', 'abs', 'min', 'max', 'jsonValid', 'jsonHas', 'jsonGet',
    'esp_sleep_enable_timer_wakeup', 'esp_sleep_enable_ext0_wakeup', 'esp_light_sleep_start', 'esp_deep_sleep_start', 'esp_sleep_get_wakeup_cause']);
  const CONSTS = new Set(Object.keys(BOARD_CONSTS));
  const CFG_KW = new Set(['listener', 'tls', 'allow_anonymous', 'password', 'acl_default', 'user', 'topic', 'ufw', 'sudo', 'PermitRootLogin', 'PasswordAuthentication', 'PubkeyAuthentication', 'PermitEmptyPasswords', 'AllowUsers', 'Port', 'MaxAuthTries']);
  const CFG_VAL = new Set(['on', 'off', 'true', 'false', 'deny', 'allow', 'read', 'write', 'readwrite', 'yes', 'no', 'prohibit-password', 'limit', 'reject', 'enable', 'disable', 'default', 'incoming', 'outgoing', 'from', 'to', 'any', 'port', 'proto', 'tcp', 'udp']);
  const span = (cls, s) => `<span class="t-${cls}">${esc(s)}</span>`;

  function highlightConfig(lines) {
    return lines.map(line => {
      if (/^\s*#/.test(line)) return span('com', line);
      return line.split(/(\s+)/).map((w, i) => {
        if (!w.trim()) return esc(w);
        if (i === 0 && CFG_KW.has(w)) return span('kw', w);
        if (/^_{2,}$/.test(w)) return span('blank', w);
        if (CFG_VAL.has(w)) return span('const', w);
        if (/^\d+$/.test(w)) return span('num', w);
        if (/[Ͱ-Ͽ]/.test(w)) return `<span class="t-bad">${esc(w)}</span>`;
        return /[+#]/.test(w) ? span('fn', w) : esc(w);
      }).join('');
    });
  }

  function highlightLines(lines) {
    let inBlock = false;
    return lines.map(line => {
      let out = '';
      let i = 0;
      while (i < line.length) {
        if (inBlock) {
          const end = line.indexOf('*/', i);
          if (end === -1) { out += span('com', line.slice(i)); i = line.length; } else { out += span('com', line.slice(i, end + 2)); i = end + 2; inBlock = false; }
          continue;
        }
        const rest = line.slice(i);
        let m;
        if (rest.startsWith('//')) { out += span('com', rest); break; }
        if (rest.startsWith('/*')) { out += span('com', '/*'); i += 2; inBlock = true; continue; }
        if ((m = /^"(?:[^"\\]|\\.)*"?/.exec(rest))) { out += span('str', m[0]); i += m[0].length; continue; }
        if ((m = /^_{2,}/.exec(rest))) { out += span('blank', m[0]); i += m[0].length; continue; }
        if ((m = /^#?[A-Za-z_]\w*/.exec(rest))) {
          const w = m[0];
          const extra = S.task && worldOf(S.task).consts && Object.prototype.hasOwnProperty.call(worldOf(S.task).consts, w);
          const cls = KW.has(w) ? 'kw' : (CONSTS.has(w) || extra) ? 'const' : FN.has(w) ? 'fn' : null;
          out += cls ? span(cls, w) : esc(w);
          i += w.length;
          continue;
        }
        if ((m = /^\d+(\.\d+)?/.exec(rest))) { out += span('num', m[0]); i += m[0].length; continue; }
        if (rest[0] === ';') { out += '<span class="t-bad">' + esc(rest[0]) + '</span>'; i++; continue; }
        out += esc(rest[0]);
        i++;
      }
      return out;
    });
  }

  const PY_KW = new Set(PY.HIGHLIGHT.keywords);
  const PY_FN = new Set(PY.HIGHLIGHT.builtins);
  function highlightPython(lines) {
    return lines.map(line => {
      let out = '';
      let i = 0;
      while (i < line.length) {
        const rest = line.slice(i);
        let m;
        if (rest[0] === '#') { out += span('com', rest); break; }
        if ((m = /^[fFbBrR]{0,2}(?:"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?)/.exec(rest)) && /["']/.test(m[0])) { out += span('str', m[0]); i += m[0].length; continue; }
        if ((m = /^_{2,}(?![\w\u0370-\u03ff])/.exec(rest))) { out += span('blank', m[0]); i += m[0].length; continue; }
        if ((m = /^[A-Za-z_\u0370-\u03ff][\w\u0370-\u03ff]*/.exec(rest))) {
          const w = m[0];
          const cls = (w === 'True' || w === 'False' || w === 'None') ? 'const' : PY_KW.has(w) ? 'kw' : PY_FN.has(w) ? 'fn' : /^[A-Z][A-Z0-9_]+$/.test(w) ? 'const' : null;
          out += cls ? span(cls, w) : esc(w);
          i += w.length;
          continue;
        }
        if ((m = /^\d+(\.\d+)?/.exec(rest))) { out += span('num', m[0]); i += m[0].length; continue; }
        if (rest.startsWith('&&') || rest.startsWith('||')) { out += '<span class="t-bad">' + esc(rest.slice(0, 2)) + '</span>'; i += 2; continue; }
        out += esc(rest[0]);
        i++;
      }
      return out;
    });
  }

  function renderEditor() {
    const ta = $('#code');
    if (!ta) return;
    const lines = ta.value.split('\n');
    const html = modeOf(S.task) === 'config' ? highlightConfig(lines) : isPy() ? highlightPython(lines) : highlightLines(lines);
    const paused = S.runState === 'paused' && S.machine;
    const exec = paused ? S.machine.currentLine : null;
    const errLine = S.error ? S.error.line : null;
    const taken = paused && S.machine.lastBranch && S.machine.lastBranch.range ? S.machine.lastBranch.range : null;
    $('#hl').innerHTML = html.map((h, i) => {
      const n = i + 1;
      let cls = '';
      if (taken && n >= taken.from && n <= taken.to) cls += ' taken';
      if (n === exec) cls += ' exec';
      if (n === errLine) cls += ' err';
      return `<span class="l${cls}">${h || ' '}</span>`;
    }).join('');
    $('#gutter').innerHTML = lines.map((_, i) => {
      const n = i + 1;
      if (n === errLine) return `<div class="err">✕ ${n}</div>`;
      if (n === exec) return `<div class="exec">▶ ${n}</div>`;
      return `<div>${n}</div>`;
    }).join('') + '<div>&nbsp;</div>';
    syncScroll();
  }

  function syncScroll() {
    const ta = $('#code');
    if (!ta) return;
    $('#hl').scrollTop = ta.scrollTop;
    $('#hl').scrollLeft = ta.scrollLeft;
    $('#gutter').scrollTop = ta.scrollTop;
  }

  function insertText(ta, text) {
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  }

  function onEditorKey(e) {
    const ta = e.target;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (modeOf(S.task) === 'config') validateConfig(true);
      else if (e.shiftKey) doStep(); else doRun();
      return;
    }
    if (e.key === 'Escape') { S.escTab = true; return; }
    if (e.key === 'Tab' && !S.escTab && !e.shiftKey) {
      e.preventDefault();
      insertText(ta, isPy() ? '    ' : '  ');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      const before = ta.value.slice(0, ta.selectionStart);
      const cur = before.slice(before.lastIndexOf('\n') + 1);
      // Python: μετά από γραμμή που τελειώνει σε «:» η εσοχή μεγαλώνει κατά 4 κενά.
      const opens = isPy() ? /:\s*(#.*)?$/.test(cur) : /\{\s*$/.test(cur);
      const indent = (/^\s*/.exec(cur) || [''])[0] + (opens ? (isPy() ? '    ' : '  ') : '');
      e.preventDefault();
      insertText(ta, '\n' + indent);
      return;
    }
    if (e.key !== 'Shift') S.escTab = false;
  }

  function onCodeInput() {
    const ta = $('#code');
    P.drafts[S.task.id] = ta.value;
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(save, 400);
    if (modeOf(S.task) === 'config') {
      clearTimeout(S.cfgTimer);
      S.cfgTimer = setTimeout(() => validateConfig(false), 350);
      renderEditor();
      return;
    }
    const wasActive = !!S.gen;
    if (wasActive) stopMachine();
    S.error = null;
    if (wasActive) S.info = 'Ο κώδικας άλλαξε, οπότε η εκτέλεση σταμάτησε. Πάτησε «Εκτέλεση» για να τρέξει η νέα έκδοση.';
    renderEditor();
    renderErrorSlot();
    updateRunState();
    updateControls();
  }

  function gotoLine(n) {
    const ta = $('#code');
    if (!ta || !n) return;
    setTab('code', true);
    const lines = ta.value.split('\n');
    let start = 0;
    for (let i = 0; i < n - 1 && i < lines.length; i++) start += lines[i].length + 1;
    const end = start + (lines[n - 1] || '').length;
    ta.focus();
    ta.setSelectionRange(start, end);
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    ta.scrollTop = Math.max(0, (n - 1) * lh - ta.clientHeight / 3);
    syncScroll();
  }

  // ------------------------------------------------------------ Ρυθμίσεις broker

  function validateConfig(announceIt) {
    const ta = $('#code');
    if (!ta) return;
    try {
      const r = S.task.system ? window.IoTSys.parse(ta.value) : NET.parseBrokerConfig(ta.value);
      S.error = null;
      S.warnings = r.warnings;
      S.configSummary = r.config;
      if (announceIt) announce(r.warnings.length ? `Οι ρυθμίσεις διαβάστηκαν, με ${r.warnings.length} προειδοποιήσεις.` : 'Οι ρυθμίσεις διαβάστηκαν χωρίς σφάλμα.');
    } catch (e) {
      S.error = e;
      S.warnings = [];
      S.configSummary = null;
      if (announceIt) announce(`Σφάλμα στη γραμμή ${e.line}: ${e.message}`);
    }
    renderEditor();
    renderErrorSlot();
    renderConfigSummary();
    updateNetScene();
  }

  function renderSystemSummary(el, c) {
    const s = c.ssh;
    const u = c.ufw;
    const ex = window.IoTSys.exposure(c);
    const yes = v => (v ? '<strong>ναι</strong>' : 'όχι');
    const where = e => (e.wan ? '<span class="bad-text">από όλους (και Internet)</span>' : e.lan ? 'μόνο από το σπίτι' : 'από κανέναν');
    el.innerHTML = `<ul class="summary">
        <li>SSH στη θύρα <strong>${s.port}</strong> · root: <strong>${s.permitrootlogin === 'yes' ? 'μπαίνει (κακό)' : s.permitrootlogin === 'no' ? 'όχι' : 'μόνο με κλειδί'}</strong></li>
        <li>Σύνδεση SSH με κωδικό: ${s.passwordauthentication === 'yes' ? '<strong class="bad-text">επιτρέπεται</strong>' : '<strong>όχι</strong>'} · με κλειδί: ${yes(s.pubkeyauthentication === 'yes')}</li>
        <li>Χρήστες SSH: ${s.allowusers ? s.allowusers.map(x => `<code>${esc(x)}</code>`).join(', ') : 'όλοι οι λογαριασμοί'}</li>
        <li>Firewall (ufw): ${u.enabled ? `<strong>ενεργός</strong> · default ${esc(u.defaultIncoming)} incoming` : '<strong class="bad-text">ανενεργός</strong>: όλες οι θύρες με υπηρεσία είναι ανοιχτές'}</li>
      </ul>
      <div class="table-wrap"><table><thead><tr><th>Υπηρεσία</th><th>Θύρα</th><th>Ποιος φτάνει</th></tr></thead><tbody>
        ${ex.map(e => `<tr><td>${esc(e.name)}</td><td class="code">${e.port}</td><td>${where(e)}</td></tr>`).join('')}
      </tbody></table></div>
      ${u.rules.length ? `<div class="sub-h">Κανόνες ufw με τη σειρά</div><ol class="summary">${u.rules.map(r => `<li><code>${esc(r.action)} ${r.from === 'any' ? '' : 'from ' + esc(r.from) + ' '}${r.port === null ? 'όλες τις θύρες' : 'θύρα ' + r.port}${r.proto ? '/' + r.proto : ''}</code> <span class="muted">(γρ. ${r.line})</span></li>`).join('')}</ol>` : ''}`;
  }

  function renderConfigSummary() {
    const el = $('#cfg-summary');
    if (!el) return;
    const c = S.configSummary;
    if (!c) { el.innerHTML = '<p class="muted">Διόρθωσε πρώτα το σφάλμα στις ρυθμίσεις.</p>'; return; }
    if (S.task && S.task.system) { renderSystemSummary(el, c); return; }
    const listeners = c.listeners.map(l => `<li>Θύρα <strong>${l.port}</strong> · ${l.tls ? 'με TLS' : '<strong>χωρίς TLS</strong>: όλα ταξιδεύουν ως απλό κείμενο'}</li>`).join('');
    const users = Object.keys(c.passwords);
    const ruleUsers = Object.keys(c.rules);
    const rules = c.ruleLines.map(r => `<tr><td class="code">${esc(r.user)}</td><td class="code">${esc(r.access)}</td><td class="code">${esc(r.pattern)}</td></tr>`).join('');
    el.innerHTML = `<ul class="summary">
        ${listeners}
        <li>Ανώνυμες συνδέσεις: <strong>${c.allowAnonymous ? 'επιτρέπονται' : 'δεν επιτρέπονται'}</strong></li>
        <li>Χρήστες με κωδικό: ${users.length ? users.map(u => `<code>${esc(u)}</code>`).join(', ') : '<strong>κανένας</strong>'}</li>
        <li>Έλεγχος δικαιωμάτων (ACL): <strong>${c.aclEnabled ? 'ενεργός · ό,τι δεν επιτρέπεται ρητά απαγορεύεται' : 'ανενεργός · όλοι μπορούν να διαβάζουν και να γράφουν παντού'}</strong></li>
        ${ruleUsers.filter(u => !users.includes(u)).length ? `<li>Προσοχή: κανόνες για χρήστες χωρίς κωδικό: ${ruleUsers.filter(u => !users.includes(u)).map(u => `<code>${esc(u)}</code>`).join(', ')}</li>` : ''}
      </ul>
      ${rules ? `<div class="table-wrap"><table><thead><tr><th scope="col">Χρήστης</th><th scope="col">Δικαίωμα</th><th scope="col">Topic</th></tr></thead><tbody>${rules}</tbody></table></div>` : ''}`;
  }

  // ------------------------------------------------------------ Εκτέλεση

  function stopMachine() {
    if (S.raf) clearTimeout(S.raf);
    S.raf = null;
    S.gen = null;
    if (S.runState !== 'error') S.runState = 'idle';
  }

  function prepare() {
    if (S.gen) return true;
    const ta = $('#code');
    S.results = null;
    renderResults();
    const w = worldOf(S.task);
    try {
      const E = VAL.engine(langOf(S.task));
      const c = E.compile(ta.value, { consts: w.consts || {} });
      S.warnings = c.warnings;
      S.board = VAL.createWorld(w, S.inputs);
      S.machine = new E.Machine(c.program, S.board, { consts: w.consts || {} });
      S.gen = S.machine.main();
      S.error = null;
      S.info = null;
      S.serialClearedAt = 0;
      S.serialSig = '';
      S.netSig = '';
      S.mqttSig = '';
      S.selectedPacket = null;
      S.webLast = null;
      S.webMsg = '';
      S.webSig = '';
      S.dbSig = '';
      S.httpSeen = 0;
      S.stampBefore = S.machine.changeCounter;
      return true;
    } catch (e) {
      if (!(e instanceof CodeError) && e.name !== 'CodeError') throw e;
      showError(e);
      return false;
    }
  }

  function showError(e) {
    if (S.raf) clearTimeout(S.raf);
    S.raf = null;
    S.gen = null;
    S.error = e;
    S.runState = 'error';
    updateAll();
    announce(`Σφάλμα${e.line ? ' στη γραμμή ' + e.line : ''}: ${e.message}`);
  }

  function doRun() {
    if (S.runState === 'running') return;
    if (!S.gen && !prepare()) return;
    S.runState = 'running';
    S.lastFrame = performance.now();
    S.target = S.board.micros;
    updateAll();
    announce('Η εκτέλεση ξεκίνησε.');
    S.raf = schedule(frame);
  }

  function frame(now) {
    if (S.runState !== 'running') return;
    const dt = Math.min(100, now - S.lastFrame);
    S.lastFrame = now;
    S.target += dt * 1000 * (S.board.sleep ? SLEEP_SPEED : 1);
    let steps = 0;
    let ended = false;
    try {
      if (S.board.net) S.board.net.tick(S.board.inputs);
      while (S.board.micros < S.target && steps < 4000) {
        const r = S.gen.next();
        steps++;
        if (r.done) { ended = true; break; }
      }
    } catch (e) {
      if (e instanceof CodeError || e.name === 'CodeError') { showError(e); return; }
      throw e;
    }
    if (ended) { programEnded(); return; }
    if (steps >= 4000) S.target = S.board.micros;
    if (now - S.lastPaint > 120) { S.lastPaint = now; updateLive(); } else { updateBoard(); }
    S.raf = schedule(frame);
  }

  // Ένα πρόγραμμα Python μπορεί να τελειώσει (το loop() του ESP32 όχι).
  function programEnded() {
    if (S.raf) clearTimeout(S.raf);
    S.raf = null;
    S.gen = null;
    S.runState = 'ended';
    updateAll();
    announce('Το πρόγραμμα τελείωσε.');
  }

  function doPause() {
    if (S.runState !== 'running') return;
    if (S.raf) clearTimeout(S.raf);
    S.raf = null;
    S.runState = 'paused';
    S.stampBefore = S.machine.changeCounter;
    updateAll();
    announce(`Παύση. Επόμενη γραμμή ${S.machine.currentLine || ''}.`);
  }

  function doStep() {
    if (S.runState === 'running') doPause();
    if (!S.gen && !prepare()) return;
    S.stampBefore = S.machine.changeCounter;
    try {
      if (S.board.net) S.board.net.tick(S.board.inputs);
      for (let guard = 0; guard < 2000000; guard++) {
        const r = S.gen.next();
        if (r.done) { programEnded(); return; }
        if (r.value.kind === 'line') break;
      }
      S.runState = 'paused';
    } catch (e) {
      if (e instanceof CodeError || e.name === 'CodeError') { showError(e); return; }
      throw e;
    }
    updateAll();
    announce(`Επόμενη γραμμή ${S.machine.currentLine}. LED ${S.board.led ? 'αναμμένο' : 'σβηστό'}.`);
  }

  function doReset() {
    const btn = $('#b-reset');
    if (!S.resetTimer) {
      btn.textContent = 'Πάτα ξανά για επιβεβαίωση';
      S.resetTimer = setTimeout(() => { S.resetTimer = null; if ($('#b-reset')) $('#b-reset').textContent = 'Επαναφορά άσκησης'; }, 4000);
      announce('Πάτα ξανά «Επαναφορά» για να επιστρέψει ο αρχικός κώδικας αυτής της άσκησης.');
      return;
    }
    clearTimeout(S.resetTimer);
    S.resetTimer = null;
    btn.textContent = 'Επαναφορά άσκησης';
    stopMachine();
    S.runState = 'idle';
    delete P.drafts[S.task.id];
    save();
    $('#code').value = S.task.initialCode;
    S.board = null;
    S.machine = null;
    S.error = null;
    S.warnings = [];
    S.results = null;
    S.info = 'Ο κώδικας επανήλθε στην αρχική μορφή της άσκησης. Η υπόλοιπη πρόοδος δεν άλλαξε.';
    S.inputs = freshInputs(S.task);
    if (modeOf(S.task) === 'code') { $('#board').innerHTML = boardHTML(true, hardwareOf(S.task)); bindBoard(); }
    if (modeOf(S.task) === 'config') validateConfig(false);
    updateAll();
    announce('Ο κώδικας της άσκησης επανήλθε.');
  }

  // ------------------------------------------------------------ Έλεγχος λύσης

  function expectedEvidence(l) {
    const set = new Set();
    if (l.evidence.filter) {
      const f = NET.compileFilter(l.evidence.filter);
      S.capture.packets.filter(f.fn).forEach(p => set.add('p' + p.no));
    } else if (l.evidence.log) {
      S.capture.log.filter(x => x.text.includes(l.evidence.log)).forEach(x => set.add('l' + x.id));
    }
    return set;
  }

  function doCheck() {
    const l = S.task;
    const mode = modeOf(l);
    let res;
    if (mode === 'analysis') {
      const want = expectedEvidence(l);
      const got = S.evidence;
      const missing = [...want].filter(x => !got.has(x)).length;
      const extra = [...got].filter(x => !want.has(x)).length;
      const what = l.evidence.filter ? 'πακέτα' : 'γραμμές log';
      let message = '';
      if (!got.size) message = `Δεν έχεις επιλέξει ${what}. Σημείωσε το κουτάκι δίπλα σε κάθε γραμμή που αποδεικνύει την απάντησή σου.`;
      else if (missing && extra) message = `Λείπουν ${missing} ${what} που αποδεικνύουν την απάντηση, και ${extra} από όσα επέλεξες δεν τη στηρίζουν.`;
      else if (missing) message = `Λείπουν ακόμα ${missing} ${what}. Δοκίμασε ένα φίλτρο που δείχνει μόνο τη σχετική συσκευή ή το σχετικό topic.`;
      else if (extra) message = `${extra} από όσα επέλεξες δεν αποδεικνύουν την απάντηση. Κράτα μόνο όσα σχετίζονται άμεσα.`;
      res = [{ name: 'Τα τεκμήρια που επέλεξες στηρίζουν την απάντηση', pass: !missing && !extra && got.size > 0, message }];
    } else {
      const code = $('#code').value;
      if (mode === 'code') {
        try {
          VAL.engine(langOf(l)).compile(code, { consts: worldOf(l).consts || {} });
        } catch (e) {
          if (!(e instanceof CodeError) && e.name !== 'CodeError') throw e;
          showError(e);
          S.results = { res: [{ name: 'Ο κώδικας διαβάζεται χωρίς σφάλμα', pass: false, message: 'Διόρθωσε πρώτα το σφάλμα που φαίνεται πάνω από εδώ.' }], allPass: false };
          renderResults();
          return;
        }
      } else {
        validateConfig(false);
        if (S.error) {
          S.results = { res: [{ name: 'Ο broker διαβάζει τις ρυθμίσεις χωρίς σφάλμα', pass: false, message: `Γραμμή ${S.error.line}: ${S.error.message} Διόρθωσέ το και ξαναδοκίμασε.` }], allPass: false };
          renderResults();
          return;
        }
      }
      res = VAL.runTests(code, l.validationTests, l);
    }
    const allPass = res.every(r => r.pass);
    S.results = { res, allPass };
    if (mode === 'config' && $('#cfg-log')) {
      const rows = res.flatMap(r => (r.log || []).map(x => `<tr><td>${esc(r.name)}</td><td class="code log-text">${esc(x.text)}</td></tr>`));
      $('#cfg-log').innerHTML = rows.length ? `<table><thead><tr><th scope="col">Έλεγχος</th><th scope="col">${S.task && S.task.system ? 'Γραμμή log του Pi' : 'Μήνυμα broker'}</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : `<p class="muted">${S.task && S.task.system ? 'Το Pi' : 'Ο broker'} δεν έγραψε τίποτα σε αυτούς τους ελέγχους.</p>`;
    }
    if (allPass) maybeComplete();
    renderResults();
    const passCount = res.filter(r => r.pass).length;
    announce(allPass ? 'Όλοι οι έλεγχοι πέρασαν.' : `Πέρασαν ${passCount} από ${res.length} ελέγχους.`);
    const slot = $('#results-slot');
    if (slot && slot.firstElementChild) slot.firstElementChild.focus();
  }

  function maybeComplete() {
    const l = S.task;
    const quizOk = !l.quiz || P.quizzes[l.id];
    if (S.results && S.results.allPass && quizOk && !P.completed[l.id]) {
      P.completed[l.id] = true;
      save();
    }
  }

  function renderResults() {
    const slot = $('#results-slot');
    if (!slot) return;
    const r = S.results;
    if (!r) { slot.innerHTML = ''; return; }
    const l = S.task;
    const list = `<ul class="results">${r.res.map(t => `<li class="${t.pass ? 'pass' : 'fail'}">
      <span class="icon" aria-hidden="true">${t.pass ? '✓' : '✕'}</span>
      <span><span class="sr-only">${t.pass ? 'Πέρασε:' : 'Δεν πέρασε:'}</span>${esc(t.name)}${t.message ? `<small>${esc(t.message)}</small>` : ''}</span></li>`).join('')}</ul>`;
    if (!r.allPass) {
      slot.innerHTML = `<div class="card" tabindex="-1" style="margin-top:0.75rem"><h3>Αποτέλεσμα ελέγχου</h3>${list}<p class="info-line">${esc(l.remediation)}</p></div>`;
      return;
    }
    if (l.quiz && !P.quizzes[l.id]) {
      slot.innerHTML = `<div class="card" tabindex="-1" style="margin-top:0.75rem"><h3>Αποτέλεσμα ελέγχου</h3>${list}
        <p class="info-line">${{ analysis: 'Τα τεκμήρια είναι σωστά.', config: 'Οι ρυθμίσεις πέρασαν όλους τους ελέγχους.', code: 'Ο κώδικας πέρασε όλους τους ελέγχους.' }[modeOf(l)]} Για να ολοκληρωθεί η άσκηση, απάντησε και την ερώτηση στην καρτέλα «Ερώτηση».</p>
        <button class="btn" id="to-quiz">Πήγαινε στην ερώτηση</button></div>`;
      $('#to-quiz').onclick = () => { showInfo('quiz'); const first = $('#quiz-body input'); if (first) first.focus(); };
      return;
    }
    const ls = chapterLessons(l.chapter);
    const next = lessons[lessons.indexOf(l) + 1];
    const chapterDone = ls.every(x => P.completed[x.id]);
    const unlockMsg = chapterDone && next && next.chapter !== l.chapter ? `<p><strong>Ξεκλείδωσε το Κεφάλαιο ${next.chapter}.</strong></p>` : '';
    const allDone = lessons.every(x => P.completed[x.id]);
    const nextBtn = next && taskUnlocked(next)
      ? `<button class="btn primary" id="go-next">Επόμενη άσκηση: ${esc(next.title)}</button>`
      : `<button class="btn primary" id="go-map">${allDone ? 'Δες τη βεβαίωση ολοκλήρωσης' : 'Πίσω στον χάρτη'}</button>`;
    slot.innerHTML = `<div class="card success" tabindex="-1" style="margin-top:0.75rem"><h3>Η άσκηση ολοκληρώθηκε</h3>${list}
      <p>${esc(l.explanationOnSuccess)}</p>${unlockMsg}<div class="btn-row">${nextBtn}</div></div>`;
    if ($('#go-next')) $('#go-next').onclick = () => openTask(next.id);
    if ($('#go-map')) $('#go-map').onclick = renderHome;
  }

  // ------------------------------------------------------------ Quiz και hints

  function renderQuiz() {
    const l = S.task;
    if (!l.quiz) return;
    const q = l.quiz;
    const answered = !!P.quizzes[l.id];
    $('#quiz-body').innerHTML = `<fieldset>
      <legend>${esc(q.question)}</legend>
      ${q.options.map((o, i) => `<label><input type="radio" name="quiz-opt" id="quiz-opt-${i}" value="${i}" ${answered && i === q.answer ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}
    </fieldset>
    <button class="btn" id="quiz-check">Έλεγχος απάντησης</button>
    <div id="quiz-fb" aria-live="polite">${answered ? `<div class="feedback ok"><strong>Σωστό</strong>${esc(q.explain)}</div>` : ''}</div>`;
    $('#quiz-check').onclick = () => {
      const sel = $('#quiz-body').querySelector('input:checked');
      const fb = $('#quiz-fb');
      if (!sel) { fb.innerHTML = '<div class="feedback no"><strong>Διάλεξε μια απάντηση</strong>Επίλεξε μία από τις επιλογές και πάτα ξανά «Έλεγχος απάντησης».</div>'; return; }
      if (Number(sel.value) === q.answer) {
        P.quizzes[l.id] = true;
        save();
        fb.innerHTML = `<div class="feedback ok"><strong>Σωστό</strong>${esc(q.explain)}</div>`;
        if (S.results && S.results.allPass) { maybeComplete(); renderResults(); }
      } else {
        fb.innerHTML = `<div class="feedback no"><strong>Δοκίμασε ξανά</strong>${esc(q.retry)}</div>`;
      }
    };
  }

  function renderHints() {
    const l = S.task;
    const lvl = P.hints[l.id] || 0;
    const names = ['Υπενθύμιση έννοιας', 'Πού να κοιτάξεις', 'Λυμένο παράδειγμα'];
    const shown = l.hints.slice(0, lvl).map((h, i) => `<div class="hint"><b>Βοήθεια ${i + 1} από 3 · ${names[i]}</b>${i === 2 ? `<pre>${esc(h)}</pre>` : `<p style="margin:0.2rem 0 0">${br(h)}</p>`}</div>`).join('');
    $('#hints').innerHTML = `<p class="muted" style="font-size:0.9rem">Η βοήθεια δεν αφαιρεί πόντους και δεν αλλάζει τον κώδικά σου.</p>
      ${shown}
      <button class="btn" id="hint-next" style="margin-top:0.6rem" ${lvl >= 3 ? 'disabled' : ''}>${lvl >= 3 ? 'Έχεις δει όλη τη βοήθεια' : `Δείξε τη βοήθεια ${lvl + 1} από 3`}</button>`;
    $('#hint-next').onclick = showNextHint;
  }

  function showNextHint() {
    const l = S.task;
    const lvl = P.hints[l.id] || 0;
    if (lvl >= 3) return;
    P.hints[l.id] = lvl + 1;
    save();
    renderHints();
    announce(`Βοήθεια ${lvl + 1}: ${l.hints[lvl]}`);
  }

  // ------------------------------------------------------------ Ενημερώσεις προβολής

  function updateAll() {
    renderEditor();
    renderErrorSlot();
    updateRunState();
    updateControls();
    updateBoard();
    updateSerial(true);
    updateVars();
    updateBranch();
    updateLoops();
    updateMqtt(true);
    updateNet(true);
    updateLogs(true);
    updateEnergy();
    updateWeb(true);
    updateDb();
    updateEvidenceStatus();
    if (S.selectedPacket) selectPacket(S.selectedPacket, true);
  }

  function updateLive() {
    updateRunState();
    updateBoard();
    updateSerial(false);
    updateVars();
    updateLoops();
    updateMqtt(false);
    updateNet(false);
    updateLogs(false);
    updateEnergy();
    updateWeb(false);
    updateDb();
  }

  // ---------- Ενέργεια

  const STATE_NAMES = { active: 'Ξύπνιο (επεξεργαστής)', wifi: 'Ξύπνιο + WiFi', light: 'Light sleep', deep: 'Deep sleep' };
  const CAUSE_NAMES = { 0: 'πρώτη εκκίνηση', 2: 'pin (ext0)', 4: 'χρονόμετρο' };
  function fmtDuration(hours) {
    if (!isFinite(hours)) return '—';
    if (hours < 48) return `περίπου ${Math.max(1, Math.round(hours))} ώρες`;
    const days = hours / 24;
    if (days < 60) return `περίπου ${Math.round(days)} μέρες`;
    if (days < 730) return `περίπου ${Math.round(days / 30)} μήνες`;
    if (days < 1825) return `περίπου ${Math.round(days / 365)} χρόνια`;
    return 'πάνω από 5 χρόνια*';
  }
  function fmtMa(ma) { return ma < 1 ? ma.toFixed(2) : ma < 10 ? ma.toFixed(1) : String(Math.round(ma)); }

  function updateEnergy() {
    const el = $('#energy');
    if (!el) return;
    const b = S.board;
    if (!b || !b.energy.us) { el.innerHTML = '<p class="muted">Πάτησε «Εκτέλεση». Εδώ θα δεις πόσο ρεύμα τραβά η πλακέτα και πόσο θα κρατούσε μια μπαταρία.</p>'; return; }
    const st = b.powerState();
    const e = b.energy;
    const avg = b.avgMa();
    const life = avg > 0 ? b.battery / avg : Infinity;
    const share = k => (100 * e.byState[k]) / e.us;
    const bars = ['wifi', 'active', 'light', 'deep'].map(k => `<div class="eshare"><span>${STATE_NAMES[k]}</span><span class="ebar"><i class="es-${k}" style="width:${share(k).toFixed(1)}%"></i></span><span class="num">${share(k).toFixed(0)}%</span></div>`).join('');
    const wakes = b.wakeups.slice(-4).reverse().map(w => `<li>${fmtTime(w.t)} · ξύπνησε από ${w.mode} sleep (${CAUSE_NAMES[w.cause]}) μετά από ${(w.sleptMs / 1000).toFixed(1)} s</li>`).join('');
    el.innerHTML = `<div class="emetrics">
        <div><span class="muted">Τώρα</span><strong>${fmtMa(b.currentMa())} mA</strong><span class="estate es-txt-${st}">${STATE_NAMES[st]}</span></div>
        <div><span class="muted">Μέσο ρεύμα</span><strong>${fmtMa(avg)} mA</strong><span class="muted">από την εκκίνηση</span></div>
        <div><span class="muted">Μπαταρία ${b.battery} mAh</span><strong>${fmtDuration(life)}</strong><span class="muted">με αυτόν τον ρυθμό</span></div>
      </div>
      <div class="eshares" aria-label="Χρόνος σε κάθε κατάσταση">${bars}</div>
      <p class="muted" style="font-size:0.85rem;margin:0.5rem 0 0">Επανεκκινήσεις από deep sleep: <strong>${b.boots}</strong>${b.sleep ? ' · <strong>κοιμάται: ο χρόνος τρέχει ×100</strong>' : ''}</p>
      ${wakes ? `<ul class="ewakes">${wakes}</ul>` : ''}
      <p class="muted" style="font-size:0.8rem;margin:0.4rem 0 0">Ενδεικτικές τιμές για το τσιπ ESP32 (WiFi 120 mA, ξύπνιο 40 mA, light 0,8 mA, deep 0,01 mA). Σε πλακέτα DevKit το LED PWR και το τσιπ USB τραβούν επιπλέον μερικά mA ακόμα και στον ύπνο.${life / 24 >= 1825 ? ' *Στην πράξη, μετά από μερικά χρόνια όριο γίνεται η αυτοεκφόρτιση της μπαταρίας: αδειάζει και μόνη της.' : ''}</p>`;
  }

  function updateControls() {
    const running = S.runState === 'running';
    if (!$('#b-run')) return;
    $('#b-run').disabled = running;
    $('#b-pause').disabled = !running;
  }

  function fmtTime(ms) {
    const t = Math.floor(ms);
    const m = Math.floor(t / 60000);
    const s = Math.floor((t % 60000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(t % 1000).padStart(3, '0')}`;
  }

  function updateRunState() {
    const clk = $('#hdr-clock');
    if (clk && S.task && S.board) clk.textContent = fmtTime(S.board.micros / 1000);
    const el = $('#run-state');
    if (!el) return;
    const labels = { idle: 'Έτοιμο', running: 'Εκτελείται', paused: 'Σε παύση', error: 'Σφάλμα', ended: 'Τελείωσε' };
    const m = S.machine;
    const parts = [`<span>Κατάσταση: <b>${labels[S.runState]}</b></span>`];
    if (m && S.board && S.runState !== 'idle') {
      const sleeping = S.board.sleep ? ` · ${S.board.sleep.mode} sleep` : '';
      const phase = m.lang === 'python'
        ? (m.finished ? 'τέλος προγράμματος' : m.phase === 'loop' ? `κύριος βρόχος · γύρος ${m.loopIndex}` : 'κύριο πρόγραμμα')
        : (m.phase === 'loop' ? `loop() · επανάληψη ${m.loopIndex}` : m.phase === 'setup' ? 'setup()' : m.phase === 'deep sleep' ? 'κοιμάται' : 'αρχικές τιμές') + sleeping;
      parts.push(`<span>Φάση: <b>${phase}</b></span>`);
      if (S.runState === 'paused' && m.currentLine) parts.push(`<span>Επόμενη γραμμή: <b>${m.currentLine}</b></span>`);
      parts.push(`<span>Εικονικός χρόνος: <b>${fmtTime(S.board.micros / 1000)}</b></span>`);
    }
    el.innerHTML = parts.join('');
  }

  function renderErrorSlot() {
    const slot = $('#error-slot');
    if (!slot) return;
    let html = '';
    const e = S.error;
    if (e) {
      html += `<div class="error-box" role="alert">
        <div class="title">${e.line ? `Σφάλμα στη γραμμή ${e.line}` : 'Σφάλμα'}</div>
        <dl><dt>Τι βρέθηκε</dt><dd>${esc(e.message)}</dd>${e.hint ? `<dt>Τι να κάνεις</dt><dd>${esc(e.hint)}</dd>` : ''}</dl>
        ${e.line ? `<button class="btn" id="goto-err">Πήγαινε στη γραμμή ${e.line}</button>` : ''}
      </div>`;
    }
    const warns = (S.warnings || []).concat(S.board ? S.board.warnings : []);
    if (warns.length) {
      html += `<ul class="warn-list" aria-label="Προειδοποιήσεις">${warns.map(w => `<li><b>Προειδοποίηση${w.line ? ' · γραμμή ' + w.line : ''}</b><br>${esc(w.text)}${w.hint ? ' ' + esc(w.hint) : ''}</li>`).join('')}</ul>`;
    }
    if (S.info) html += `<p class="info-line" role="status">${esc(S.info)}</p>`;
    slot.innerHTML = html;
    if ($('#goto-err')) $('#goto-err').onclick = () => gotoLine(e.line);
  }

  const WIFI_TEXT = { 0: 'δεν έχει ξεκινήσει', 1: 'το δίκτυο δεν βρέθηκε', 3: 'συνδεδεμένο · 192.168.1.42', 4: 'λάθος κωδικός', 6: 'αποσυνδεδεμένο' };

  function updateBoard() {
    if (!S.task) return;
    const b = S.board;
    const sc = S.scene;
    const cls = (sel, c, v) => { const el = sc && sc.querySelector(sel); if (el) el.classList.toggle(c, !!v); };
    const ledOn = !!(b && b.led);
    const pin2 = !!(b && b.outputs[2] === 1);
    // κάρτα εισόδων
    const dot = $('#led-dot');
    if (dot) dot.classList.toggle('on', ledOn);
    if ($('#led-text')) $('#led-text').textContent = ledOn ? 'LED αναμμένο' : 'LED σβηστό';
    if ($('#led-mode')) $('#led-mode').textContent = isPy() ? `LED(${PY.PI_PINS.LED}) · ${b && b.modes[2] === 3 ? 'έτοιμο' : 'δεν δημιουργήθηκε'}` : 'pinMode: ' + ((b && b.modeName(2)) || 'δεν ορίστηκε');
    const setSw = (id, val, onT, offT) => {
      const btn = $('#' + id);
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(val));
      btn.querySelector('.value').textContent = val ? onT : offT;
    };
    setSw('btn-toggle', S.inputs.button, 'Πατημένο · HIGH', 'Ελεύθερο · LOW');
    setSw('pir-toggle', S.inputs.pir, 'Κίνηση · HIGH', 'Καμία κίνηση · LOW');
    setSw('fault-toggle', S.inputs.sensorFault, 'Σφάλμα · nan', 'Λειτουργεί');
    setSw('router-toggle', S.inputs.router, 'Ενεργό', 'Σβηστό');
    if ($('#wifi-text')) {
      if (!b) {
        $('#wifi-text').textContent = 'WiFi: —';
        $('#mqtt-text').textContent = 'MQTT: —';
      } else {
        const st = b.wifiStatus();
        $('#wifi-text').textContent = isPy() ? 'Δίκτυο: ενσύρματο (Ethernet) · 192.168.1.10' : 'WiFi: ' + (WIFI_TEXT[st] || st) + (b.wifi.pending ? ' (συνδέεται…)' : '');
        const conn = b.net && b.net.connected('device');
        const sess = conn ? b.net.session('device') : null;
        $('#mqtt-text').textContent = 'MQTT: ' + (!b.net ? 'δεν υπάρχει broker' : conn ? `συνδεδεμένο ως ${sess.clientId} · θύρα ${sess.port}${sess.tls ? (sess.insecure ? ' · TLS χωρίς έλεγχο' : ' · TLS') : ' · χωρίς TLS'}` : 'αποσυνδεδεμένο' + (b.mqtt.lastError ? ' · ' + b.mqtt.lastError : ''));
      }
    }
    // σκηνή
    if (sc && modeOf(S.task) === 'code') {
      cls('#sc-led', 'on', ledOn);
      cls('#sc-led-halo', 'on', ledOn);
      cls('#sc-d2', 'on', pin2);
      cls('#sc-d2-halo', 'on', pin2);
      cls('#sc-pwr', 'on', !!b);
      cls('#sc-w-led', 'on', ledOn);
      cls('#sc-btn', 'on', S.inputs.button);
      cls('#sc-w-btn', 'on', S.inputs.button);
      cls('#sc-pir', 'on', S.inputs.pir);
      cls('#sc-w-pir', 'on', S.inputs.pir);
      cls('#sc-router', 'on', S.inputs.router);
      const sleeping = !!(b && b.sleep);
      cls('#sc-esp', 'asleep', sleeping);
      const wifiOn = isPy() ? !!b : !!(b && !sleeping && b.wifiStatus() === 3);
      cls('#sc-wifi', 'on', wifiOn);
      cls('#sc-link-wifi', 'on', wifiOn);
      const net = b && b.net;
      const sensorNode = net && [...net.sessions.keys()].some(c => c !== 'device' && c !== 'dashboard');
      cls('#sc-link-esp-pi', 'on', isPy() ? !!sensorNode : !!(net && net.connected('device')));
      cls('#sc-link-pi-dash', 'on', !!(net && net.connected('dashboard')));
      for (const [k, pin] of [['r', 25], ['y', 26], ['g', 27]]) {
        const on = !!(b && b.light(pin));
        cls('#sc-tl-' + k, 'on', on);
        cls('#sc-tl-' + k + '-halo', 'on', on);
      }
      const move = sc.querySelector('#sc-car-move');
      if (move) {
        const cm = S.inputs.distance;
        const tr = window.IoTScene.carOffset(cm);
        move.setAttribute('transform', tr);
        const lab = sc.querySelector('#sc-car-label');
        if (lab) lab.setAttribute('transform', tr);
        const carEl = sc.querySelector('#sc-car');
        if (carEl) carEl.setAttribute('aria-valuenow', String(cm));
        const { P, US, CAR, carV } = window.IoTScene;
        const a = P(US.u + US.w / 2, US.v + 5.6, 9.4);
        const z = P(CAR.u, carV(cm), 4.5);
        const path = sc.querySelector('#sc-dist-path');
        if (path) path.setAttribute('d', `M${a[0].toFixed(1)},${a[1].toFixed(1)} L${z[0].toFixed(1)},${z[1].toFixed(1)}`);
        const tag = sc.querySelector('#sc-dist-tag');
        if (tag) tag.setAttribute('transform', `translate(${((a[0] + z[0]) / 2 - 22).toFixed(1)},${((a[1] + z[1]) / 2).toFixed(1)})`);
        const t = sc.querySelector('#sc-dist-t');
        if (t) t.textContent = cm + ' cm';
        cls('#sc-us-waves', 'on', !!(b && b.us && b.micros - b.us.at < 400000));
      }
      const temp = sc.querySelector('#sc-temp');
      if (temp) {
        temp.textContent = S.inputs.sensorFault ? 'nan · σφάλμα' : `${Number(S.inputs.temp).toFixed(1)} °C`;
        cls('#sc-sensor', 'fault', S.inputs.sensorFault);
      }
      if (net && net.dashboard) {
        const vals = Object.entries(net.dashboard.values).slice(-2);
        const lines = vals.map(([t, v]) => `${t.replace(/^home\//, '')}: ${v.payload}`.slice(0, 24));
        const l1 = sc.querySelector('#sc-dash-1');
        const l2 = sc.querySelector('#sc-dash-2');
        if (l1) l1.textContent = lines[0] || 'αναμονή…';
        if (l2) l2.textContent = lines[1] || ' ';
      }
      // κινούμενα «πακέτα» για κάθε νέο μήνυμα MQTT
      if (net && net.messages.length !== S.msgSeen) {
        const fresh = net.messages.slice(Math.max(S.msgSeen, net.messages.length - 3));
        S.msgSeen = net.messages.length;
        if (!P.settings.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          fresh.forEach((m, i) => {
            if (isPy()) {
              // Pi: ο broker και το πρόγραμμα Python είναι στο ίδιο Pi. Οι αισθητήρες στέλνουν προς το Pi,
              // το Pi προωθεί στο dashboard.
              if (m.client !== 'device' && m.client !== 'dashboard') window.IoTScene.animatePacket(sc, 'sc-link-esp-pi', 'in', i * 120);
              if (!m.denied && m.to.includes('dashboard')) window.IoTScene.animatePacket(sc, 'sc-link-pi-dash', '', 650 + i * 120);
              if (m.client === 'dashboard') window.IoTScene.animatePacket(sc, 'sc-link-pi-dash', 'in', i * 120, true);
            } else if (m.client === 'device') {
              window.IoTScene.animatePacket(sc, 'sc-link-esp-pi', '', i * 120);
              if (!m.denied && m.to.includes('dashboard')) window.IoTScene.animatePacket(sc, 'sc-link-pi-dash', '', 650 + i * 120);
            } else if (m.client === 'dashboard') {
              window.IoTScene.animatePacket(sc, 'sc-link-pi-dash', 'in', i * 120, true);
              if (m.to.length) window.IoTScene.animatePacket(sc, 'sc-link-esp-pi', 'in', 650 + i * 120, true);
            }
          });
        }
      }
    }
    // Αιτήματα HTTP από το tablet προς το Flask του Pi
    if (sc && b && isPy() && b.http.log.length !== (S.httpSeen || 0)) {
      const fresh = b.http.log.slice(S.httpSeen || 0);
      S.httpSeen = b.http.log.length;
      if (!P.settings.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        fresh.slice(-3).forEach((x, i) => {
          if (x.req.from === '127.0.0.1') return;
          window.IoTScene.animatePacket(sc, 'sc-link-pi-dash', 'in', i * 200, true);
          if (x.resp.status) window.IoTScene.animatePacket(sc, 'sc-link-pi-dash', '', 600 + i * 200);
        });
      }
      const last = fresh[fresh.length - 1];
      const l1 = sc.querySelector('#sc-dash-1');
      const l2 = sc.querySelector('#sc-dash-2');
      if (last && l1 && !(b.net && b.net.dashboard)) { l1.textContent = `${last.req.method} ${last.req.path}`.slice(0, 24); if (l2) l2.textContent = last.resp.status ? `→ ${last.resp.status}` : '→ απέτυχε'; }
    }
    if (sc && b && isPy() && b.http.server) cls('#sc-link-pi-dash', 'on', true);
    if (sc && modeOf(S.task) === 'config') updateNetScene();
    if (S.board && S.board.warnings.length !== S.lastWarnCount) { S.lastWarnCount = S.board.warnings.length; renderErrorSlot(); }
  }

  // Χάρτης δικτύου στις ασκήσεις ρυθμίσεων: θύρες του broker και τι γίνεται με την άγνωστη συσκευή.
  function updateNetScene() {
    const sc = S.scene;
    const c = S.configSummary;
    const ports = sc && sc.querySelector('#sc-ports');
    if (!ports) return;
    if (!c) { ports.innerHTML = ''; return; }
    if (S.task && S.task.system) {
      const ex = window.IoTSys.exposure(c);
      ports.innerHTML = ex.map((e, i) => {
        const t = `${e.port} · ${e.wan ? 'ΑΝΟΙΧΤΗ ΣΕ ΟΛΟΥΣ' : e.lan ? 'ΜΟΝΟ ΣΠΙΤΙ' : 'ΚΛΕΙΣΤΗ'}`;
        const w = t.length * 6 + 16;
        return `<g class="port-tag ${e.wan ? 'open' : e.lan ? 'tls' : ''}" transform="translate(0,${i * 22})"><rect width="${w}" height="18" rx="4"/><text x="8" y="12.5">${t}</text></g>`;
      }).join('');
      const sshLan = ex[0].lan;
      const link = sc.querySelector('#sc-nl-77');
      if (link) { link.classList.toggle('on', sshLan); link.classList.toggle('deny', !sshLan); }
      const lab = sc.querySelector('#sc-nlab-77 .co-txt');
      if (lab) lab.textContent = sshLan ? 'ΑΓΝΩΣΤΗ · ΦΤΑΝΕΙ ΣΤΟ SSH' : 'ΑΓΝΩΣΤΗ · SSH ΜΠΛΟΚΑΡΕΤΑΙ';
      const box = sc.querySelector('#sc-nlab-77 .co-box');
      if (box && lab) box.setAttribute('width', (lab.textContent.length * 6.1 + 18).toFixed(1));
      return;
    }
    ports.innerHTML = c.listeners.map((l, i) => {
      const t = `${l.port} · ${l.tls ? 'TLS' : 'ΧΩΡΙΣ TLS'}`;
      const w = t.length * 6 + 16;
      return `<g class="port-tag ${l.tls ? 'tls' : 'open'}" transform="translate(${i * (w + 6)},0)"><rect width="${w}" height="18" rx="4"/><text x="8" y="12.5">${t}</text></g>`;
    }).join('');
    const link = sc.querySelector('#sc-nl-77');
    if (link) { link.classList.toggle('on', c.allowAnonymous); link.classList.toggle('deny', !c.allowAnonymous); }
    const lab = sc.querySelector('#sc-nlab-77 .co-txt');
    if (lab) lab.textContent = c.allowAnonymous ? 'ΑΓΝΩΣΤΗ · ΜΠΑΙΝΕΙ ΧΩΡΙΣ ΣΤΟΙΧΕΙΑ' : 'ΑΓΝΩΣΤΗ · ΑΠΟΡΡΙΠΤΕΤΑΙ';
    const box = sc.querySelector('#sc-nlab-77 .co-box');
    if (box && lab) box.setAttribute('width', (lab.textContent.length * 6.1 + 18).toFixed(1));
  }

  function updateSerial(force) {
    const box = $('#serial');
    if (!box) return;
    if (S.serialPaused && !force) return;
    const all = S.board ? S.board.serial.filter(l => l.id > S.serialClearedAt) : [];
    const last = all[all.length - 1];
    const sig = all.length + ':' + (last ? last.id + ':' + last.text.length : '0') + ':' + S.serialClearedAt;
    if (!force && sig === S.serialSig) return;
    S.serialSig = sig;
    const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 12;
    const view = all.slice(-200);
    box.innerHTML = view.length
      ? view.map(l => `<div class="row"><span class="ts">${fmtTime(l.t)}</span><span class="msg">${esc(l.text) || '&nbsp;'}</span><button class="ln" data-line="${l.line}" title="Πήγαινε στη γραμμή ${l.line}">γρ. ${l.line}</button></div>`).join('')
      : `<div class="empty">${S.board ? 'Δεν έχει τυπωθεί τίποτα ακόμα.' : 'Πάτησε «Εκτέλεση» ή «Ένα βήμα». Ό,τι τυπώνει το πρόγραμμα θα εμφανιστεί εδώ.'}</div>`;
    if (atBottom || force) box.scrollTop = box.scrollHeight;
  }

  function copySerial() {
    const text = S.board ? S.board.serial.filter(l => l.id > S.serialClearedAt).map(l => `[${fmtTime(l.t)}] ${l.text}`).join('\n') : '';
    const done = () => announce('Η έξοδος αντιγράφηκε.');
    const fallback = () => {
      const box = $('#serial');
      const range = document.createRange();
      range.selectNodeContents(box);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      announce('Η αντιγραφή δεν επιτράπηκε. Το κείμενο επιλέχθηκε: πάτα Ctrl+C.');
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }

  function updateVars() {
    const el = $('#vars');
    if (!el) return;
    const m = S.machine;
    if (!m) { el.innerHTML = '<p class="muted">Οι μεταβλητές εμφανίζονται όταν τρέξει ο κώδικας.</p>'; return; }
    const recs = m.visibleVars();
    if (!recs.length) { el.innerHTML = '<p class="muted">Αυτό το πρόγραμμα δεν έχει μεταβλητές ακόμα.</p>'; return; }
    const showChange = S.runState === 'paused';
    const displayValue = m.lang === 'python' ? PY.display : IOT_DISPLAY;
    el.innerHTML = `<table><thead><tr><th scope="col">Όνομα</th><th scope="col">Τύπος</th><th scope="col">Τιμή</th><th scope="col">Προηγούμενη</th><th scope="col">Γραμμή</th></tr></thead><tbody>
      ${recs.map(r => {
        const changed = showChange && r.stamp > S.stampBefore;
        return `<tr class="${changed ? 'changed' : ''}"><td class="code">${esc(r.name)}${changed ? '<span class="sr-only"> (μόλις άλλαξε)</span>' : ''}</td>
          <td class="code">${r.isConst ? 'const ' : ''}${esc(r.type)}${r.kind === 'local' ? ' <span class="muted">τοπική</span>' : ''}</td>
          <td class="code">${esc(displayValue(r.value))}</td>
          <td class="code">${r.prev ? esc(displayValue(r.prev)) : '<span class="muted">—</span>'}</td>
          <td class="code">${r.line || ''}</td></tr>`;
      }).join('')}</tbody></table>`;
  }

  function updateBranch() {
    const el = $('#branch');
    if (!el) return;
    const b = S.machine && S.machine.lastBranch;
    if (!b) { el.innerHTML = '<p class="muted">Όταν εκτελεστεί ένα if, εδώ θα δεις ποιο σκέλος επιλέχθηκε και με ποιες τιμές.</p>'; return; }
    const range = b.range ? (b.range.from === b.range.to ? `γραμμή ${b.range.from}` : `γραμμές ${b.range.from}–${b.range.to}`) : '';
    const what = b.branch === 'if' ? `, άρα εκτελείται το σκέλος του if (${range}).`
      : b.branch === 'elif' ? `, άρα εκτελείται αυτό το σκέλος elif (${range}).`
        : b.branch === 'else' ? `, άρα εκτελείται το σκέλος του else (${range}).`
          : b.lang === 'python' ? '. Καμία συνθήκη δεν ισχύει και δεν υπάρχει else, οπότε το πρόγραμμα συνεχίζει μετά το if.' : '. Δεν υπάρχει else, οπότε το πρόγραμμα προσπερνά το if και συνεχίζει.';
    el.innerHTML = `<div class="branch">
      <div>Γραμμή ${b.line}</div>
      <div class="cond">${b.lang === 'python' ? `${b.kw} ${esc(b.cond)}:` : `if (${esc(b.cond)})`}</div>
      ${b.vars.length ? `<div>Τιμές εκείνη τη στιγμή: ${b.vars.map(v => `<code>${esc(v.name)} = ${esc(v.value)}</code>`).join(', ')}</div>` : ''}
      <div>Η συνθήκη είναι <span class="verdict ${b.result}">${b.result ? 'ΑΛΗΘΗΣ (true)' : 'ΨΕΥΔΗΣ (false)'}</span>${what}</div>
    </div>`;
  }

  function updateLoops() {
    const el = $('#loops');
    if (!el) return;
    const m = S.machine;
    if (!m || !m.loopLog.length) {
      el.innerHTML = isPy()
        ? '<p class="muted">Μετά από κάθε γύρο του κύριου βρόχου (while True: ή loop_forever) εδώ γράφεται μία γραμμή: τι είσοδο είχε, τι τιμές είχαν οι μεταβλητές και τι τυπώθηκε.</p>'
        : '<p class="muted">Μετά από κάθε επανάληψη του loop() εδώ γράφεται μία γραμμή: τι είσοδο είχε, τι τιμές είχαν οι μεταβλητές και τι τυπώθηκε.</p>';
      return;
    }
    const names = (m.lang === 'python' ? m.visibleVars().filter(r => r.kind === 'global' && r.value.t !== 'object') : [...m.globals.values()].filter(r => !r.isConst)).map(r => r.name);
    const hw = hardwareOf(S.task);
    const cols = [];
    if (hw.includes('button')) cols.push(['Κουμπί', r => (r.inputs.button ? '1 · HIGH' : '0 · LOW')]);
    if (hw.includes('pir')) cols.push(['PIR', r => (r.inputs.pir ? '1 · HIGH' : '0 · LOW')]);
    if (hw.includes('sensor')) cols.push(['Θερμ.', r => (r.inputs.sensorFault ? 'nan' : Number(r.inputs.temp).toFixed(1))]);
    if (hw.includes('router')) cols.push(['Router', r => (r.inputs.router ? 'on' : 'off')]);
    if (hw.includes('ultrasonic')) cols.push(['Εμπόδιο', r => `${Math.round(r.inputs.distance)} cm`]);
    const rows = m.loopLog.slice(-10);
    el.innerHTML = `<table><thead><tr><th scope="col">#</th>${cols.map(c => `<th scope="col">${c[0]}</th>`).join('')}${names.map(n => `<th scope="col">${esc(n)}</th>`).join('')}<th scope="col">Τύπωσε</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="code">${r.index}</td>${cols.map(c => `<td class="code">${c[1](r)}</td>`).join('')}
        ${names.map(n => `<td class="code">${esc(r.vars[n] !== undefined ? r.vars[n] : '')}</td>`).join('')}
        <td class="code">${r.output.length ? esc(r.output.slice(0, 3).join(' · ')) + (r.output.length > 3 ? ` (+${r.output.length - 3})` : '') : '<span class="muted">—</span>'}</td></tr>`).join('')}
    </tbody></table>${m.loopLog.length > 10 ? `<p class="muted" style="font-size:0.85rem;margin-top:0.4rem">Φαίνονται οι 10 πιο πρόσφατες από ${m.loopIndex} επαναλήψεις.</p>` : ''}`;
  }

  // ---------- MQTT

  function updateMqtt(force) {
    const el = $('#mqtt');
    if (!el) return;
    const net = S.board && S.board.net;
    const hasDash = (worldOf(S.task).clients || []).some(c => c.name === 'dashboard');
    const sig = net ? net.messages.length + ':' + (net.dashboard ? Object.keys(net.dashboard.values).length : 0) + ':' + net.sessions.size + ':' + (net.messages.length ? net.messages[net.messages.length - 1].to.length : 0) : 'none';
    if (!force && sig === S.mqttSig) return;
    S.mqttSig = sig;
    const prevForm = $('#dash-topic') ? { t: $('#dash-topic').value, p: $('#dash-payload').value, r: $('#dash-retain').checked } : null;
    if (!net) {
      el.innerHTML = '<p class="muted">Όταν τρέξει ο κώδικας, εδώ θα δεις κάθε μήνυμα που περνά από τον broker: ποιος το έστειλε, σε ποιο topic και σε ποιους παραδόθηκε.</p>';
      return;
    }
    const sessions = [...net.sessions.values()].map(s => `<code>${esc(s.clientId)}</code>`).join(', ') || '<span class="muted">κανείς</span>';
    let dash = '';
    if (hasDash && net.dashboard) {
      const vals = Object.entries(net.dashboard.values);
      dash = `<h4 class="sub-h">Dashboard</h4>
        ${vals.length ? `<ul class="tiles">${vals.map(([t, v]) => `<li><span class="code">${esc(t)}</span><strong class="code">${esc(v.payload)}</strong><span class="muted">${fmtTime(v.t)}${v.retained ? ' · retained' : ''}</span></li>`).join('')}</ul>` : '<p class="muted">Το dashboard δεν έχει λάβει τίποτα ακόμα.</p>'}
        <p class="muted" style="font-size:0.85rem">Το dashboard δείχνει ό,τι <strong>αναφέρει</strong> η συσκευή, όχι ό,τι του ζητήθηκε. Μια εντολή δεν σημαίνει ότι εκτελέστηκε.</p>
        <form class="dash-form" id="dash-form">
          <label for="dash-topic">Topic</label><input id="dash-topic" type="text" spellcheck="false" value="${esc(prevForm ? prevForm.t : 'home/led/set')}">
          <label for="dash-payload">Payload</label><input id="dash-payload" type="text" spellcheck="false" value="${esc(prevForm ? prevForm.p : '{"cmd":"ON"}')}">
          <label class="check"><input type="checkbox" id="dash-retain" ${prevForm && prevForm.r ? 'checked' : ''}> retained</label>
          <button class="btn" type="submit">Στείλε από το dashboard</button>
        </form>`;
    }
    const msgs = net.messages.slice(-25).reverse();
    el.innerHTML = `<p style="font-size:0.9rem">Συνδεδεμένοι clients: ${sessions}</p>
      ${dash}
      <h4 class="sub-h">Μηνύματα (νεότερα πρώτα)</h4>
      ${msgs.length ? `<div class="table-wrap"><table><thead><tr><th scope="col">Χρόνος</th><th scope="col">Από</th><th scope="col">Topic</th><th scope="col">Payload</th><th scope="col">Παραδόθηκε σε</th></tr></thead><tbody>
        ${msgs.map(m => `<tr class="${m.denied ? 'denied' : ''}"><td class="code">${fmtTime(m.t)}</td><td class="code">${esc(m.from)}</td><td class="code">${esc(m.topic)}${m.retain ? ' <span class="muted">retained</span>' : ''}</td><td class="code">${esc(m.payload)}</td>
          <td>${m.denied ? '<strong class="bad-text">Απορρίφθηκε (ACL)</strong>' : m.to.length ? esc([...new Set(m.to)].join(', ')) : '<span class="muted">κανέναν subscriber</span>'}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">Κανένα μήνυμα ακόμα.</p>'}`;
  }

  // ---------- Network Monitor

  function currentPackets() {
    if (S.capture) return S.capture.packets;
    return S.board && S.board.net ? S.board.net.packets : [];
  }

  const hostLabel = ip => `<span title="${esc(NET.HOST_NAMES[ip] || '')}">${ip}</span>`;

  function updateNet(force) {
    const el = $('#net');
    if (!el) return;
    const all = currentPackets();
    const sig = all.length + ':' + S.netFilterText + ':' + (all.length ? all[all.length - 1].no : 0);
    if (!force && sig === S.netSig) return;
    S.netSig = sig;
    const analysis = !!S.capture;
    const shown = S.netFilter ? all.filter(S.netFilter) : all;
    const view = analysis ? shown : shown.slice(-200);
    $('#net-count').textContent = `${shown.length} από ${all.length} πακέτα`;
    if (!all.length) {
      el.innerHTML = '<p class="muted">Δεν υπάρχει κίνηση ακόμα. Όταν η συσκευή μιλήσει με τον broker, τα πακέτα θα εμφανιστούν εδώ.</p>';
      return;
    }
    el.innerHTML = `<table><thead><tr>${analysis ? '<th scope="col"><span class="sr-only">Τεκμήριο</span>✓</th>' : ''}<th scope="col">#</th><th scope="col">Χρόνος (s)</th><th scope="col">Πηγή</th><th scope="col">Προορισμός</th><th scope="col">Πρωτόκολλο</th><th scope="col">Μήκος</th><th scope="col">Πληροφορίες</th></tr></thead><tbody>
      ${view.map(p => `<tr data-no="${p.no}" tabindex="0" class="${p.no === S.selectedPacket ? 'selected' : ''} proto-${p.proto.toLowerCase()}">
        ${analysis ? `<td><input type="checkbox" data-ev="${p.no}" aria-label="Τεκμήριο: πακέτο ${p.no}" ${S.evidence.has('p' + p.no) ? 'checked' : ''}></td>` : ''}
        <td class="code">${p.no}</td><td class="code">${p.t.toFixed(3)}</td><td class="code">${hostLabel(p.src)}</td><td class="code">${hostLabel(p.dst)}</td>
        <td class="code">${p.proto}</td><td class="code">${p.len}</td><td class="code">${esc(p.info)}</td></tr>`).join('')}
    </tbody></table>${!analysis && shown.length > 200 ? '<p class="muted" style="font-size:0.85rem">Φαίνονται τα 200 πιο πρόσφατα.</p>' : ''}`;
  }

  function selectPacket(no, silent) {
    S.selectedPacket = no;
    const p = currentPackets().find(x => x.no === no);
    const el = $('#net-detail');
    app().querySelectorAll('#net tr.selected').forEach(r => r.classList.remove('selected'));
    const row = app().querySelector(`#net tr[data-no="${no}"]`);
    if (row) row.classList.add('selected');
    if (S.scene && p) {
      S.scene.querySelectorAll('.link.hot').forEach(x => x.classList.remove('hot'));
      const other = p.src === NET.BROKER_IP ? p.dst : p.src;
      const link = S.scene.querySelector('#sc-nl-' + other.split('.').pop());
      if (link) {
        link.classList.add('hot');
        if (!P.settings.reducedMotion) window.IoTScene.animatePacket(S.scene, link.id, p.src === NET.BROKER_IP ? 'in' : '', 0, p.src === NET.BROKER_IP);
      }
    }
    if (!el || !p) return;
    const d = p.detail || {};
    const layers = [];
    layers.push(`<li><b>Frame</b> πακέτο #${p.no} · ${p.len} bytes · χρόνος ${p.t.toFixed(3)} s</li>`);
    layers.push(`<li><b>IPv4</b> από ${p.src} (${esc(NET.HOST_NAMES[p.src] || 'άγνωστη')}) προς ${p.dst} (${esc(NET.HOST_NAMES[p.dst] || 'άγνωστη')})</li>`);
    layers.push(`<li><b>TCP</b> θύρα πηγής ${p.sport} → θύρα προορισμού ${p.dport}${d.tcp ? ' · σημαίες ' + d.tcp : ''}</li>`);
    if (d.mqtt && p.proto === 'MQTT') {
      const m = d.mqtt;
      const rows = [['Τύπος', m.type]];
      if (m.clientId) rows.push(['Client ID', m.clientId]);
      if (m.type === 'CONNECT') { rows.push(['Όνομα χρήστη', m.username || '(κανένα)']); rows.push(['Κωδικός (συνθετικός, ορατός σε απλό κείμενο)', m.password || '(κανένας)']); }
      if (m.topic) rows.push(['Topic', m.topic]);
      if (m.payload !== undefined) rows.push(['Payload', m.payload]);
      if (m.code !== undefined) rows.push(['Κωδικός απάντησης', String(m.code)]);
      if (m.retain) rows.push(['Retained', 'ναι']);
      if (m.dup) rows.push(['Διπλή παράδοση (DUP)', 'ναι']);
      layers.push(`<li><b>MQTT</b><dl>${rows.map(r => `<dt>${esc(r[0])}</dt><dd class="code">${esc(r[1])}</dd>`).join('')}</dl></li>`);
    }
    if (p.proto === 'TLS') {
      const t = d.tls || {};
      let tlsInfo = `${esc(t.record || '')}${t.type ? ' · ' + esc(t.type) : ''}${t.sni ? ` · όνομα server (SNI): ${esc(t.sni)}` : ''}`;
      if (d.cert) tlsInfo += `<dl><dt>Πιστοποιητικό για</dt><dd class="code">${esc(d.cert.cn)}</dd><dt>Υπογραφή από</dt><dd class="code">${esc(d.cert.issuer)}</dd><dt>Ισχύει έως</dt><dd class="code">${esc(d.cert.notAfter)}</dd></dl>
        <p class="muted">Το ότι υπάρχει πιστοποιητικό δεν σημαίνει ότι είναι έγκυρο. Αυτό το ελέγχει ο client (CA, όνομα, ημερομηνία).</p>`;
      if (t.record === 'Application Data') tlsInfo += '<p class="muted">Κρυπτογραφημένο περιεχόμενο. Ο αναλυτής βλέπει μόνο διευθύνσεις, θύρες, χρόνους και μέγεθος, όχι topic, payload ή κωδικούς.</p>';
      layers.push(`<li><b>TLS</b> ${tlsInfo}</li>`);
    }
    el.innerHTML = `<ul class="layers">${layers.join('')}</ul>`;
    if (!silent) announce(`Πακέτο ${no}: ${p.info}`);
  }

  // ---------- Log του broker

  function currentLog() {
    if (S.capture) return S.capture.log;
    return S.board && S.board.net ? S.board.net.log : [];
  }

  function updateLogs(force) {
    const el = $('#logs');
    if (!el) return;
    const log = currentLog();
    const sig = log.length + ':' + (log.length ? log[log.length - 1].id : 0);
    if (!force && sig === S.logSig) return;
    S.logSig = sig;
    const analysis = !!S.capture;
    if (!log.length) { el.innerHTML = '<p class="muted">Το log είναι άδειο.</p>'; return; }
    el.innerHTML = `<table><thead><tr>${analysis ? '<th scope="col"><span class="sr-only">Τεκμήριο</span>✓</th>' : ''}<th scope="col">Χρόνος</th><th scope="col">${S.capture && S.capture.packets.length === 0 && !S.capture.config ? 'Γραμμή log' : 'Μήνυμα broker'}</th></tr></thead><tbody>
      ${log.slice(analysis ? 0 : -150).map(x => `<tr>${analysis ? `<td><input type="checkbox" data-log="${x.id}" aria-label="Τεκμήριο: γραμμή log ${x.id}" ${S.evidence.has('l' + x.id) ? 'checked' : ''}></td>` : ''}<td class="code">${fmtTime(x.t)}</td><td class="code log-text">${esc(x.text)}</td></tr>`).join('')}
    </tbody></table>`;
  }

  function updateEvidenceStatus() {
    const el = $('#ev-status');
    if (!el) return;
    el.textContent = S.evidence.size ? `Έχεις επιλέξει ${S.evidence.size} ${S.evidence.size === 1 ? 'τεκμήριο' : 'τεκμήρια'}.` : 'Δεν έχεις επιλέξει τεκμήρια ακόμα. Σημείωσε τα κουτάκια στις γραμμές που αποδεικνύουν την απάντησή σου.';
  }

  // ------------------------------------------------------------ Διάλογοι

  function buildDialogs() {
    const host = document.createElement('div');
    host.innerHTML = `
    <dialog id="dlg-settings" aria-labelledby="dlg-settings-title">
      <div class="dlg-head"><h2 id="dlg-settings-title">Ρυθμίσεις εμφάνισης</h2><button class="btn quiet" data-close>Κλείσιμο</button></div>
      <div class="dlg-body">
        <div class="field"><label for="set-theme">Θέμα</label>
          <select id="set-theme"><option value="system">Όπως το σύστημα</option><option value="light">Φωτεινό</option><option value="dark">Σκοτεινό</option></select></div>
        <div class="field"><label for="set-font">Μέγεθος γραμμάτων: <output id="set-font-out"></output></label>
          <input type="range" id="set-font" min="0.9" max="1.5" step="0.05"></div>
        <div class="field"><label for="set-spacing">Διάστιχο</label>
          <select id="set-spacing"><option value="normal">Κανονικό</option><option value="relaxed">Άνετο</option><option value="loose">Πολύ άνετο</option></select></div>
        <label class="check"><input type="checkbox" id="set-motion"> Μειωμένη κίνηση (χωρίς εφέ και κινούμενες μεταβάσεις)</label>
      </div>
    </dialog>
    <dialog id="dlg-glossary" aria-labelledby="dlg-glossary-title">
      <div class="dlg-head"><h2 id="dlg-glossary-title">Γλωσσάρι</h2><button class="btn quiet" data-close>Κλείσιμο</button></div>
      <div class="dlg-body">
        <div class="field"><label for="gl-search">Αναζήτηση όρου</label><input type="search" id="gl-search" placeholder="π.χ. μεταβλητή"></div>
        <dl class="glossary" id="gl-list"></dl>
      </div>
    </dialog>
    <dialog id="dlg-data" aria-labelledby="dlg-data-title">
      <div class="dlg-head"><h2 id="dlg-data-title">Εξαγωγή και εισαγωγή προόδου</h2><button class="btn quiet" data-close>Κλείσιμο</button></div>
      <div class="dlg-body">
        <div class="field"><label for="exp-text">Εξαγωγή</label>
          <textarea id="exp-text" readonly></textarea>
          <span class="help">Αντίγραψε αυτό το κείμενο και φύλαξέ το. Περιέχει μόνο εκπαιδευτική πρόοδο και τον κώδικα των ασκήσεων.</span>
          <div class="btn-row"><button class="btn" id="exp-copy">Αντιγραφή</button></div></div>
        <div class="field"><label for="imp-text">Εισαγωγή</label>
          <textarea id="imp-text" placeholder="Επικόλλησε εδώ μια παλιότερη εξαγωγή"></textarea>
          <span class="help">Ή διάλεξε αρχείο .json: <input type="file" id="imp-file" accept=".json,application/json"></span>
          <div class="btn-row"><button class="btn" id="imp-check">Έλεγχος</button></div>
          <div id="imp-result" aria-live="polite"></div></div>
      </div>
    </dialog>
    <div id="live" class="sr-only" aria-live="polite"></div>`;
    document.body.appendChild(host);

    host.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => b.closest('dialog').close(); });

    $('#set-theme').onchange = e => { P.settings.theme = e.target.value; applySettings(); save(); };
    $('#set-font').oninput = e => { P.settings.fontScale = Number(e.target.value); $('#set-font-out').textContent = Math.round(P.settings.fontScale * 100) + '%'; applySettings(); save(); };
    $('#set-spacing').onchange = e => { P.settings.lineSpacing = e.target.value; applySettings(); save(); };
    $('#set-motion').onchange = e => { P.settings.reducedMotion = e.target.checked; applySettings(); save(); };

    const sorted = GLOSSARY.slice().sort((a, b) => a.term.localeCompare(b.term, 'el'));
    const renderGl = q => {
      const qq = (q || '').trim().toLowerCase();
      const items = sorted.filter(g => !qq || g.term.toLowerCase().includes(qq) || g.def.toLowerCase().includes(qq));
      $('#gl-list').innerHTML = items.length ? items.map(g => `<div><dt>${esc(g.term)}</dt><dd>${esc(g.def)}</dd></div>`).join('') : '<p class="muted">Δεν βρέθηκε όρος.</p>';
    };
    $('#gl-search').oninput = e => renderGl(e.target.value);
    renderGl('');

    let pending = null;
    $('#exp-copy').onclick = () => {
      const t = $('#exp-text');
      const fb = () => { t.focus(); t.select(); announce('Το κείμενο επιλέχθηκε: πάτα Ctrl+C.'); };
      try { navigator.clipboard.writeText(t.value).then(() => announce('Η πρόοδος αντιγράφηκε.'), fb); } catch (e) { fb(); }
    };
    $('#imp-file').onchange = e => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > 500000) { $('#imp-result').innerHTML = '<div class="feedback no"><strong>Πολύ μεγάλο αρχείο</strong>Μια εξαγωγή προόδου είναι λίγα KB.</div>'; return; }
      const r = new FileReader();
      r.onload = () => { $('#imp-text').value = String(r.result || ''); $('#imp-check').click(); };
      r.readAsText(f);
    };
    $('#imp-check').onclick = () => {
      const v = window.IoTStorage.parseImport($('#imp-text').value);
      const out = $('#imp-result');
      if (!v.ok) { pending = null; out.innerHTML = `<div class="feedback no"><strong>Δεν μπορεί να εισαχθεί</strong>${esc(v.error)}</div>`; return; }
      pending = v.data;
      const n = Object.keys(v.data.completed).length;
      out.innerHTML = `<div class="feedback ok"><strong>Έγκυρη πρόοδος</strong>Περιέχει ${n} ολοκληρωμένες ασκήσεις. Η εισαγωγή θα αντικαταστήσει την τωρινή σου πρόοδο.</div>
        <div class="btn-row" style="margin-top:0.5rem"><button class="btn primary" id="imp-apply">Αντικατάσταση προόδου</button></div>`;
      $('#imp-apply').onclick = () => {
        P = pending;
        save();
        applySettings();
        $('#dlg-data').close();
        renderHome();
        announce('Η πρόοδος εισήχθη.');
      };
    };

    document.addEventListener('click', e => {
      const b = e.target.closest('[data-open]');
      if (!b) return;
      const which = b.dataset.open;
      if (which === 'settings') {
        $('#set-theme').value = P.settings.theme;
        $('#set-font').value = String(P.settings.fontScale);
        $('#set-font-out').textContent = Math.round(P.settings.fontScale * 100) + '%';
        $('#set-spacing').value = P.settings.lineSpacing;
        $('#set-motion').checked = P.settings.reducedMotion;
      }
      if (which === 'data') {
        $('#exp-text').value = window.IoTStorage.exportJson(P);
        $('#imp-text').value = '';
        $('#imp-result').innerHTML = '';
      }
      $('#dlg-' + which).showModal();
    });
  }

  // ------------------------------------------------------------ Εκκίνηση

  function boot() {
    applySettings();
    buildDialogs();
    document.addEventListener('keydown', e => {
      if (!S.task || e.target.id === 'code' || modeOf(S.task) !== 'code') return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (e.shiftKey) doStep(); else doRun(); }
    });
    renderHome();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
