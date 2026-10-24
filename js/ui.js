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
  KIND_LABELS.challenge = 'Πρόκληση';
  KIND_LABELS.sandbox = 'Ελεύθερο εργαστήριο';
  const NET = window.IoTNet;
  const VAL = window.IoTValidator;
  const PY = window.IoTPy;
  CHAPTERS.sort((a, b) => a.n - b.n);
  // Γλώσσα της άσκησης: 'cpp', 'python' ή 'rust'. Πλακέτα: 'esp32' ή 'pi'.
  const langOf = l => (l && l.lang) || 'cpp';
  const boardOf = l => (l && l.board) || (langOf(l) === 'python' ? 'pi' : 'esp32');
  const isPy = () => !!S.task && langOf(S.task) === 'python';
  const isRust = () => !!S.task && langOf(S.task) === 'rust';
  const isPi = () => !!S.task && boardOf(S.task) === 'pi';

  // Διαδρομές: γλώσσα + πλακέτα. Κάθε διαδρομή έχει δικά της κεφάλαια, πρόοδο και κάρτες ιστορίας.
  const TRACKS = [
    { id: 'cpp-esp32', lang: 'cpp', board: 'esp32', name: 'C++', boardName: 'ESP32', tag: 'Arduino C++', desc: 'Η κλασική γλώσσα των μικροελεγκτών: setup(), loop(), pinMode. Από το πρώτο LED ως ένα ασφαλές έξυπνο σπίτι με MQTT και TLS.' },
    { id: 'py-esp32', lang: 'python', board: 'esp32', name: 'Python', boardName: 'ESP32', tag: 'MicroPython', desc: 'Η Python μέσα στο ESP32: machine.Pin, αισθητήρες, WiFi και MQTT με λίγες, καθαρές γραμμές.' },
    { id: 'py-pi', lang: 'python', board: 'pi', name: 'Python', boardName: 'Raspberry Pi', tag: 'Python 3', desc: 'Το Raspberry Pi ως κέντρο του σπιτιού: gpiozero, broker MQTT, SQLite, Flask και ασφάλεια Linux.' },
    { id: 'rs-esp32', lang: 'rust', board: 'esp32', name: 'Rust', boardName: 'ESP32', tag: 'esp-idf-hal', desc: 'Η γλώσσα που πιάνει τα λάθη πριν τρέξει ο κώδικας: ownership, Option, Result και match πάνω στο ESP32.' },
    { id: 'rs-pi', lang: 'rust', board: 'pi', name: 'Rust', boardName: 'Raspberry Pi', tag: 'rppal', desc: 'Ασφαλής και γρήγορη Rust στο Raspberry Pi: GPIO με rppal, αισθητήρας στάθμευσης και κώδικας που δεν «σκάει».' }
  ];
  const LANGS = [
    { lang: 'cpp', name: 'C++', mono: 'C++', color: '#3557b8', blurb: 'Η γλώσσα του Arduino. Γρήγορη και πολύ διαδεδομένη στους μικροελεγκτές.', code: 'void loop() {\n  digitalWrite(LED_PIN, HIGH);\n  delay(500);\n}' },
    { lang: 'python', name: 'Python', mono: 'Py', color: '#2e7d5b', blurb: 'Απλή και καθαρή. Τρέχει στο Raspberry Pi και, ως MicroPython, μέσα στο ESP32.', code: 'while True:\n    led.on()\n    time.sleep(0.5)' },
    { lang: 'rust', name: 'Rust', mono: 'Rs', color: '#c8642a', blurb: 'Νέα και ασφαλής. Ο compiler σε προστατεύει από λάθη μνήμης πριν τρέξει ο κώδικας.', code: 'loop {\n    led.toggle()?;\n    FreeRtos::delay_ms(500);\n}' }
  ];
  const trackOfCh = ch => (ch && ch.track) || (ch && ch.lang === 'python' ? 'py-pi' : 'cpp-esp32');
  const chByN = n => CHAPTERS.find(c => c.n === n);
  const trackOf = l => trackOfCh(chByN(l.chapter));
  const curTrack = () => TRACKS.find(t => t.id === P.track) || null;
  const trackLessons = id => lessons.filter(l => trackOf(l) === id);
  // Ο αριθμός κεφαλαίου που βλέπει ο παίκτης: οι νέες διαδρομές μετρούν από το 1.
  const LEGACY = new Set(['cpp-esp32', 'py-pi']);
  function chNum(n) {
    const ch = chByN(n);
    const tr = trackOfCh(ch);
    if (LEGACY.has(tr)) return n;
    return trackChapters(tr).indexOf(ch) + 1;
  }
  const trackChapters = id => CHAPTERS.filter(c => trackOfCh(c) === id && c.ready && chapterLessons(c.n).length);
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
    if (window.IoTSfx) window.IoTSfx.setEnabled(s.sound !== false);
    if (window.IoTGardi) { window.IoTGardi.setEnabled(s.gardi !== false); window.IoTGardi.setVoice(!!s.gardiVoice); }
    if (window.IoTSpeak) { window.IoTSpeak.setRate(s.readRate || 0.9); window.IoTSpeak.setVoiceName(s.voiceName || ''); }
    if (window.IoTSpeak && window.IoTSpeak.setEnglish) window.IoTSpeak.setEnglish(s.readEnglish !== false);
    html.setAttribute('data-font', s.font || 'noto');
    html.setAttribute('data-letters', s.letters || 'normal');
    const rl = document.getElementById('ruler');
    if (rl) { rl.hidden = !s.ruler || s.ruler === 'off'; rl.classList.toggle('focus', s.ruler === 'focus'); }
    // οι γραμματοσειρές για δυσλεξία φορτώνονται μόνο όταν τις διαλέξεις (Google Fonts, με ελληνικά)
    const FF = { didact: 'Didact+Gothic', ysabeau: 'Ysabeau+Infant:wght@400;600;800' };
    if (FF[s.font] && !document.getElementById('font-' + s.font)) {
      const ln = document.createElement('link');
      ln.id = 'font-' + s.font;
      ln.rel = 'stylesheet';
      ln.href = `https://fonts.googleapis.com/css2?family=${FF[s.font]}&display=swap`;
      document.head.appendChild(ln);
    }
  }
  const motionOK = () => !P.settings.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sfx = n => { if (window.IoTSfx) window.IoTSfx.play(n); };


  // ------------------------------------------------------------ Πρόοδος

  function chapterLessons(n) { return lessons.filter(l => l.chapter === n); }
  const chapterDone = n => chapterLessons(n).every(l => P.completed[l.id]);
  // Μέσα σε κάθε διαδρομή τα κεφάλαια ανοίγουν με τη σειρά· τα «επιπλέον» (bonus) μετά από το unlockAfter τους.
  function chapterUnlocked(n) {
    const ch = chByN(n);
    if (!ch) return false;
    if (ch.bonus && ch.unlockAfter) return chapterDone(ch.unlockAfter);
    const seq = trackChapters(trackOfCh(ch)).filter(c => !c.bonus).map(c => c.n);
    const idx = seq.indexOf(n);
    if (idx <= 0) return idx === 0;
    return chapterDone(seq[idx - 1]);
  }
  function taskUnlocked(l) {
    if (P.completed[l.id]) return true;
    return chapterUnlocked(l.chapter) && l.prerequisites.every(p => P.completed[p]);
  }
  function nextTask(track) {
    const id = track || P.track;
    return (id ? trackLessons(id) : lessons).find(l => !P.completed[l.id] && taskUnlocked(l)) || null;
  }

  // ------------------------------------------------------------ Κοινά κομμάτια

  // Εικονίδια γραμμής (24×24, stroke = currentColor).
  const IC = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-6h4v6"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
    tool: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5z"/>',
    plug: '<path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5"/>',
    bulb: '<path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20h5"/>',
    speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    map: '<path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z"/><path d="M9 4v14M15 6v14"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M8 7h7"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3"/><rect x="8" y="13" width="8" height="5"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    pause: '<path d="M7 4v16M17 4v16"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    step: '<path d="M5 4l10 8-10 8z"/><path d="M19 4v16"/>',
    reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 3v5h5"/>',
    check: '<path d="M4 12l5 5L20 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7"/><path d="M12 17h.01"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    orbit: '<ellipse cx="12" cy="12" rx="9" ry="4"/><path d="M12 3v18"/><path d="M18.5 6.5l2.2 1.2-.6 2.4"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    lang: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'
  };
  const icon = (name, label) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"${label ? '' : ''}>${IC[name]}</svg>`;
  // Κουμπί «Άκουσε»: διαβάζει φωναχτά το κομμάτι που δείχνει το data-say (ή τον πρόγονο, με ^).
  const sayBtn = (target, what) => (window.IoTSpeak && window.IoTSpeak.supported()
    ? `<button class="say" type="button" data-say="${target}" aria-pressed="false" title="Άκουσε ${what || 'το κείμενο'} φωναχτά">${icon('speaker')}<span class="say-t">Άκουσε</span></button>` : '');

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
    car: '<path d="M8 30l14-7 18 9-14 7z" fill="#e4533d"/><path d="M8 30v4l18 9v-4zM40 32v4l-14 7v-4z" fill="#a83a2a"/><path d="M17 26l7-3.5 8 4-7 3.5z" fill="#bfe3f2"/><circle cx="15" cy="37" r="2.6" fill="#1d1e22"/><circle cx="31" cy="42" r="2.6" fill="#1d1e22"/>',
    board: '<path d="M4 26l20-10 20 10-20 10z" fill="#1d2534"/><path d="M4 26v2l20 10v-2zM44 26v2l-20 10v-2z" fill="#0c121b"/><path d="M12 25l9-4.5 9 4.5-9 4.5z" fill="#cfd4d9"/><circle cx="31" cy="29" r="1.6" fill="#7cc4ff"/>'
  };
  const thumb = kind => `<svg class="thumb" viewBox="0 0 48 48" aria-hidden="true">${TH[kind] || TH.led}</svg>`;
  function lessonIcon(l) {
    const hw = l.hardware || [];
    const w = worldOf(l);
    if (l.chapter === 16) return 'battery';
    if (boardOf(l) === 'pi' && w.broker) return 'pi';
    if (hw.includes('ultrasonic')) return 'car';
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

  // Λογότυπο: ασπίδα με τσιπ και κόκκινο LED (ίδιο με docs/logo.svg, με χρώματα από το θέμα).
  const LOGO = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path class="lg-shield" d="M32 4 L54 12 V30 C54 45 44 55 32 60 C20 55 10 45 10 30 V12 Z"/>
    <rect class="lg-chip" x="21" y="22" width="22" height="22" rx="3"/>
    <path class="lg-pins" d="M17 27h4M17 33h4M17 39h4M43 27h4M43 33h4M43 39h4"/>
    <circle class="lg-led" cx="32" cy="33" r="4.6"/><circle class="lg-halo" cx="32" cy="33" r="7.5"/>
    <path class="lg-wifi" d="M26 15.5a9 9 0 0 1 12 0"/>
  </svg>`;

  function rail(active) {
    const b = (id, ic, label, on) => `<button class="rail-btn${on ? ' on' : ''}" id="${id}" title="${label}" aria-label="${label}">${icon(ic)}</button>`;
    return `<nav class="rail" aria-label="Πλοήγηση">
      <div class="rail-logo" aria-hidden="true">${LOGO}</div>
      ${b('nav-home', 'home', 'Αρχική και χάρτης κεφαλαίων', active === 'home')}
      ${b('nav-lab', 'chip', 'Εργαστήριο: συνέχεια από εκεί που έμεινες', active === 'lab')}
      ${b('nav-sandbox', 'tool', 'Ελεύθερο εργαστήριο: πειραματίσου χωρίς ασκήσεις', active === 'sandbox')}
      ${b('nav-cases', 'shield', 'Ιστορίες ασφάλειας: πραγματικές επιθέσεις και πώς προστατεύεσαι', active === 'cases')}
      ${b('nav-lang', 'lang', 'Γλώσσα και πλακέτα', active === 'lang')}
      <button class="rail-btn" data-open="collection" title="Συλλογή: κάρτες ιστορίας και σήματα" aria-label="Συλλογή: κάρτες ιστορίας και σήματα">${icon('star')}</button>
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
        <div class="hdr-mark" aria-hidden="true">${LOGO}</div>
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
      <button class="sc-b sc-3d" id="sc-orbit" aria-pressed="false" aria-label="3D: περιστροφή γύρω γύρω" title="3D: γύρνα τη σκηνή γύρω γύρω" hidden>${icon('orbit')}<span>3D</span></button>
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
    S.theme = null;
    const theme = S.task && modeOf(S.task) === 'code' && window.IoTThemes ? window.IoTThemes.themeOf(S.task) : null;
    if (theme) S.theme = window.IoTThemes.mount(wrap, svg, theme, { pir: S.inputs.pir, onPir: v => { if (!!S.inputs.pir !== v) toggleInput('pir'); }, onHot: hotAction });
    bindParts(wrap, svg);
    const motion = !P.settings.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 3D εξαρτήματα (Three.js) κάτω από την SVG· χωρίς WebGL μένει η επίπεδη σκηνή.
    const has3d = !!(window.IoTScene3D && window.IoTScene3D.mount(wrap, svg, window.IoTScene.manifest, { animate: motion }));
    if (motion) {
      window.IoTScene.buildIn(svg);
    }
    bindOrbit(wrap, svg, has3d, pz);
    return svg;
  }

  // ---------- 3D περιστροφή: η σκηνή γυρίζει γύρω γύρω (σύρσιμο, ροδέλα, Esc για επιστροφή).
  function bindOrbit(wrap, svg, has3d, pz) {
    const btn = $('#sc-orbit');
    const hint = wrap.querySelector('.scene-hint');
    const D3 = window.IoTScene3D;
    if (!btn || !has3d || !D3.orbit) return;
    btn.hidden = false;
    const normalHint = hint ? hint.textContent : '';
    const show = () => {
      const on = D3.orbiting();
      if (S.theme) S.theme.hide(on);
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('on', on);
      btn.title = on ? 'Επιστροφή στην κανονική όψη (Esc)' : '3D: γύρνα τη σκηνή γύρω γύρω';
      if (hint) hint.textContent = on ? (D3.spinning() ? 'Γυρίζει μόνη της · σύρε για να τη γυρίσεις εσύ · ροδέλα για ζουμ · Esc για επιστροφή' : 'Σύρε για περιστροφή · ροδέλα για ζουμ · Esc για επιστροφή') : normalHint;
    };
    D3.onState(show);
    const toggle = () => {
      if (D3.orbiting()) D3.orbit(false); else { if (S.theme) S.theme.hide(true); D3.orbit(true, { auto: !P.settings.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches }); }
      show();
      announce(D3.orbiting() ? '3D περιστροφή: η σκηνή γυρίζει. Οι ετικέτες κρύβονται μέχρι να επιστρέψεις.' : 'Κανονική όψη.');
    };
    btn.onclick = toggle;
    // Το «Επαναφορά προβολής» βγάζει και από την περιστροφή.
    const fit = $('#sc-fit');
    if (fit) fit.onclick = () => { if (D3.orbiting()) { D3.orbit(false); show(); } else pz.reset(); };
    // Esc: επιστροφή (το κουμπί και το κείμενο ενημερώνονται όταν τελειώσει η κίνηση, μέσω του onState)
    if (!S.orbitEsc) {
      S.orbitEsc = true;
      document.addEventListener('keydown', e => {
        const d = window.IoTScene3D;
        if (e.key === 'Escape' && d && d.orbiting && d.orbiting()) d.orbit(false);
      });
    }
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
    // βοηθοί δοκιμής: η γιαγιά περπατά μόνη της, το αυτοκίνητο παρκάρει μόνο του
    const th = S.task && window.IoTThemes ? window.IoTThemes.themeOf(S.task) : null;
    if (hw.includes('pir') && th && th.actor) rows.push(`<div class="in-row"><span class="in-l">Γιαγιά</span><button class="toggle" id="walk-toggle" aria-pressed="false"><span class="value">▶ Βόλτα μόνη της</span></button></div>`);
    if (hw.includes('ultrasonic')) rows.push(`<div class="in-row"><span class="in-l">Αυτοκίνητο</span><button class="toggle" id="park-toggle" aria-pressed="false"><span class="value">▶ Παρκάρει μόνο του</span></button></div>`);
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
    return trackChapters(P.track).map(ch => {
      const ls = chapterLessons(ch.n);
      if (!ch.ready || !ls.length) return '';
      const d = ls.filter(l => P.completed[l.id]).length;
      const ok = chapterUnlocked(ch.n);
      const first = ls.find(l => !P.completed[l.id] && taskUnlocked(l)) || ls[0];
      return `<button class="strip-card${d === ls.length ? ' done' : ''}" data-chapter="${ch.n}" ${ok ? '' : 'disabled'} title="${esc(ch.title)}">
        ${thumb(lessonIcon(first))}
        <span class="sc-txt"><span class="sc-n">${ch.bonus ? 'Επιπλέον · ' : ''}Κεφ. ${chNum(ch.n)}${P.completed && chapterDone(ch.n) && window.IoTStories && window.IoTStories[ch.n] ? ' · ★' : ''}</span><span class="sc-t">${esc(ch.title)}</span><span class="sc-p">${ok ? `${d}/${ls.length}${d === ls.length ? ' · ολοκληρώθηκε' : ''}` : 'κλειδωμένο'}</span></span>
      </button>`;
    }).join('');
  }

  // ------------------------------------------------------------ Το σπίτι-χάρτης

  // ------------------------------------------------------------ Μάθηση: επανάληψη, σημειώσεις, «τι κάνει η γραμμή»

  const todayStr = () => window.IoTLearn.dayStr(new Date());
  // Οι ασκήσεις που τελείωσαν πριν υπάρξει η επανάληψη μπαίνουν κι αυτές, για σήμερα.
  function syncReview(tr) {
    if (!window.IoTLearn) return;
    const today = todayStr();
    for (const l of trackLessons(tr.id)) if (P.completed[l.id] && l.quiz && !P.review[l.id]) P.review[l.id] = { box: 1, due: today };
  }
  function reviewCard(tr) {
    if (!window.IoTLearn) return '';
    syncReview(tr);
    const L = window.IoTLearn;
    const today = todayStr();
    const mine = new Set(trackLessons(tr.id).map(l => l.id));
    const due = L.dueIds(P.review, today).filter(id => mine.has(id));
    const dv = L.dailyView(P.daily, today);
    const all = Object.keys(P.review).filter(id => mine.has(id));
    const next = all.map(id => P.review[id].due).filter(d => d > today).sort()[0];
    const boxes = [1, 2, 3, 4, 5].map(b => all.filter(id => P.review[id].box === b).length);
    const dots = Array.from({ length: dv.goal }, (_, i) => `<i class="${i < dv.count ? 'on' : ''}"></i>`).join('');
    return `<div class="card review-card">
      <div class="card-head"><h3>Επανάληψη και στόχος ημέρας</h3><span class="streak" title="Συνεχόμενες μέρες με τον στόχο">🔥 ${dv.streak} ${dv.streak === 1 ? 'μέρα' : 'μέρες'}</span></div>
      <div class="goal"><span class="goal-dots" aria-hidden="true">${dots}</span><span>Σήμερα ${dv.count}/${dv.goal}${dv.met ? ' · ο στόχος έγινε!' : ' ασκήσεις ή σωστές επαναλήψεις'}</span></div>
      ${all.length ? `<div class="boxes" aria-label="Κουτιά επανάληψης">${boxes.map((n, i) => `<span title="Κουτί ${i + 1}: ξαναρωτιέται σε ${L.BOX_DAYS[i + 1]} ${L.BOX_DAYS[i + 1] === 1 ? 'μέρα' : 'μέρες'}"><b>${n}</b>κουτί ${i + 1}</span>`).join('')}</div>` : ''}
      <p class="muted" style="margin:0.4rem 0">${due.length ? `Σε περιμένουν <b>${due.length}</b> ερωτήσεις από ασκήσεις που έχεις κάνει. Ό,τι θυμάσαι, ανεβαίνει κουτί και ξαναέρχεται σε περισσότερες μέρες.` : all.length ? `Καμία ερώτηση για σήμερα.${next ? ` Η επόμενη επανάληψη: ${next.split('-').reverse().join('/')}.` : ''}` : 'Μόλις τελειώσεις μια άσκηση, η ερώτησή της θα ξανάρθει εδώ αύριο, για να μη την ξεχάσεις.'}</p>
      ${due.length ? `<button class="btn primary" id="start-review">${icon('play')} Ξεκίνα επανάληψη (${Math.min(10, due.length)})</button>` : ''}
    </div>`;
  }
  function openReview(tr) {
    const L = window.IoTLearn;
    const mine = new Set(trackLessons(tr.id).map(l => l.id));
    const queue = L.dueIds(P.review, todayStr()).filter(id => mine.has(id) && byId[id] && byId[id].quiz).slice(0, 10);
    const d = $('#dlg-review');
    const body = $('#dlg-review-body');
    let i = 0;
    let right = 0;
    const show = () => {
      if (i >= queue.length) {
        body.innerHTML = `<div class="rv-end"><p class="rv-big">${right} / ${queue.length} σωστές</p><p>${right === queue.length ? 'Τέλεια! Όλες ανέβηκαν κουτί.' : 'Όσες ξέχασες γύρισαν στο κουτί 1 και θα ξανάρθουν αύριο. Έτσι μαθαίνεται κάτι για πάντα: λίγο-λίγο, κάθε μέρα.'}</p><button class="btn primary" data-close>Τέλος</button></div>`;
        body.querySelector('[data-close]').onclick = () => d.close();
        sfx(right === queue.length ? 'win' : 'tick');
        return;
      }
      const l = byId[queue[i]];
      const q = l.quiz;
      const box = (P.review[l.id] || {}).box || 1;
      body.innerHTML = `<p class="rv-meta">Ερώτηση ${i + 1} από ${queue.length} · Κεφ. ${chNum(l.chapter)} · ${esc(l.title)} · κουτί ${box}</p>
        <fieldset class="rv-q"><legend>${esc(q.question)}</legend>${q.options.map((o, k) => `<label><input type="radio" name="rv-opt" value="${k}"><span>${esc(o)}</span></label>`).join('')}</fieldset>
        <div id="rv-fb" aria-live="polite"></div>
        <div class="btn-row"><button class="btn primary" id="rv-check">Έλεγχος</button></div>`;
      $('#rv-check').onclick = () => {
        const sel = body.querySelector('input:checked');
        if (!sel) { $('#rv-fb').innerHTML = '<div class="feedback no"><strong>Διάλεξε μια απάντηση</strong>Επίλεξε μία από τις επιλογές.</div>'; return; }
        const ok = Number(sel.value) === q.answer;
        const e = L.answer(P.review, l.id, ok, todayStr());
        if (ok) { right++; P.daily = L.bump(P.daily, todayStr(), 1); sfx('tick'); } else sfx('err');
        save();
        body.querySelectorAll('input').forEach(x => { x.disabled = true; });
        body.querySelectorAll('label')[q.answer].classList.add('rv-right');
        $('#rv-fb').innerHTML = ok
          ? `<div class="feedback ok"><strong>Σωστό · πάει στο κουτί ${e.box}</strong>${esc(q.explain)}</div>`
          : `<div class="feedback no"><strong>Όχι ακόμα · ξανά αύριο</strong>Η σωστή απάντηση: «${esc(q.options[q.answer])}». ${esc(q.explain.replace(/^Σωστά\.\s*/, ''))}</div>`;
        const b = $('#rv-check');
        b.textContent = i + 1 < queue.length ? 'Επόμενη ερώτηση' : 'Αποτέλεσμα';
        b.onclick = () => { i++; show(); };
        b.focus();
      };
    };
    show();
    d.addEventListener('close', () => { if (!S.task) renderHome(); }, { once: true });
    d.showModal();
  }
  function openNotes(n) {
    const ch = CHAPTERS.find(c => c.n === n);
    if (!ch || !window.IoTLearn) return;
    $('#dlg-notes-body').innerHTML = window.IoTLearn.chapterNotes(Object.assign({ label: chNum(n) }, ch), chapterLessons(n), GLOSSARY, P.completed);
    $('#dlg-notes').showModal();
  }
  // «Τι κάνει αυτή η γραμμή;»: εξήγηση της γραμμής όπου βρίσκεται ο κέρσορας, σε απλά ελληνικά.
  function bindExplain(l) {
    const ta = $('#code');
    const out = $('#explain-a');
    if (!ta || !out || !window.IoTLearn) return;
    let last = -1;
    const upd = () => {
      const pos = ta.selectionStart;
      const n = ta.value.slice(0, pos).split('\n').length;
      if (n === last) return;
      last = n;
      const line = ta.value.split('\n')[n - 1] || '';
      const ex = window.IoTLearn.explainLine(line, langOf(l));
      out.innerHTML = ex ? `<b>Γραμμή ${n}:</b> ${esc(ex)}` : line.trim() ? `<b>Γραμμή ${n}:</b> <span class="muted">δεν έχω εξήγηση για αυτή τη γραμμή · δες το «Μάθημα» ή τη «Βοήθεια».</span>` : `<b>Γραμμή ${n}:</b> <span class="muted">κενή γραμμή.</span>`;
    };
    ['click', 'keyup', 'focus'].forEach(ev => ta.addEventListener(ev, upd));
  }

  // Η πλακέτα της αρχικής: ESP32 ή Raspberry Pi 5, η καθεμία μόνη της με ετικέτες «τι είναι».
  const homeBoard = tr => S.homeBoard || (tr.board === 'pi' ? 'pi' : 'esp32');
  function mountHomeBoard(bd) {
    const wrap = $('#scene');
    if (!wrap) return;
    wrap.querySelectorAll('svg.scene, .part-info, .part-tip').forEach(x => x.remove());
    mountScene(bd === 'pi' ? window.IoTScene.piHomeScene() : window.IoTScene.homeScene());
    ['sc-d2', 'sc-d2-halo', 'sc-pwr'].forEach(id => { const el = $('#' + id); if (el) el.classList.add('on'); });
  }

  // Τα δωμάτια του σπιτιού για τη διαδρομή: ποια κεφάλαια έχει το καθένα και σε τι κατάσταση είναι.
  function houseRooms(tr) {
    const by = (window.IoTThemes && window.IoTThemes.BY_CHAPTER) || {};
    const nxt = nextTask(tr.id);
    const rooms = {};
    for (const ch of trackChapters(tr.id)) {
      const ls = chapterLessons(ch.n);
      if (!ch.ready || !ls.length) continue;
      const key = by[ch.n];
      if (!key) continue;
      const r = rooms[key] || (rooms[key] = { chapters: [], done: 0, total: 0 });
      r.chapters.push(ch);
      r.total++;
      if (chapterDone(ch.n)) r.done++;
    }
    for (const [key, r] of Object.entries(rooms)) {
      const anyOpen = r.chapters.some(ch => chapterUnlocked(ch.n));
      const here = nxt && r.chapters.some(ch => ch.n === nxt.chapter);
      r.state = r.done === r.total ? 'done' : here ? 'current' : anyOpen ? 'open' : 'locked';
      r.label = `${r.done} από ${r.total} κεφάλαια${r.state === 'done' ? ', τα φώτα άναψαν' : r.state === 'current' ? ', εδώ είναι η επόμενη άσκηση' : r.state === 'locked' ? ', κλειδωμένο' : ''}`;
      r.key = key;
      r.alarm = r.state === 'done' && !(P.challenges && P.challenges[key]);
      r.fixed = !!(P.challenges && P.challenges[key]);
    }
    return rooms;
  }
  function houseHTML(tr) {
    if (!window.IoTHouse) return '';
    S.rooms = houseRooms(tr);
    const lit = Object.values(S.rooms).filter(r => r.state === 'done').length;
    const all = Object.keys(S.rooms).length;
    return `<div class="house-head"><b>Το σπίτι σου</b><span>${lit} από ${all} δωμάτια με αναμμένα φώτα · πάτα ένα δωμάτιο</span></div>${window.IoTHouse.render(S.rooms)}`;
  }
  function bindHouse(tr) {
    const tabs = [['tab-house', 'house'], ['tab-board', 'board']];
    tabs.forEach(([id, v]) => {
      const b = $('#' + id);
      if (!b) return;
      b.onclick = () => {
        S.homeView = v;
        tabs.forEach(([id2, v2]) => $('#' + id2).setAttribute('aria-selected', String(v2 === v)));
        $('#house').hidden = v !== 'house';
        $('#scene').hidden = v !== 'board';
        $('#board-switch').hidden = v !== 'board';
        if (v === 'board') window.dispatchEvent(new Event('resize'));
      };
    });
    [['bd-esp32', 'esp32'], ['bd-pi', 'pi']].forEach(([id, bd]) => {
      const b = $('#' + id);
      if (!b) return;
      b.onclick = () => {
        if (homeBoard(tr) === bd) return;
        S.homeBoard = bd;
        $('#bd-esp32').setAttribute('aria-pressed', String(bd === 'esp32'));
        $('#bd-pi').setAttribute('aria-pressed', String(bd === 'pi'));
        mountHomeBoard(bd);
        sfx('click');
      };
    });
    const map = $('#house .house-map');
    if (!map) return;
    const open = key => openRoom(tr, key);
    map.addEventListener('click', e => { const g = e.target.closest('[data-room]'); if (g && S.rooms[g.dataset.room]) open(g.dataset.room); });
    map.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && S.rooms[e.target.dataset.room]) { e.preventDefault(); open(e.target.dataset.room); } });
  }
  // Κάρτα δωματίου: η ιστορία του, τα κεφάλαιά του και κουμπί για την επόμενη άσκηση εκεί μέσα.
  function openRoom(tr, key) {
    const r = S.rooms[key];
    const panel = $('#hm-panel');
    if (!r || !panel) return;
    sfx('click');
    const th = window.IoTThemes.THEMES[key];
    const name = window.IoTHouse.ROOMS[key].name;
    const rows = r.chapters.map(ch => {
      const ls = chapterLessons(ch.n);
      const d = ls.filter(l => P.completed[l.id]).length;
      const ok = chapterUnlocked(ch.n);
      const first = ls.find(l => !P.completed[l.id] && taskUnlocked(l)) || ls[0];
      return `<li><span class="hm-n">${String(chNum(ch.n)).padStart(2, '0')}</span><span class="hm-ct">${esc(ch.title)}<small>${ok ? `${d}/${ls.length} ασκήσεις` : 'κλειδωμένο'}</small></span>${ok ? `<button class="btn sm quiet" data-notes="${ch.n}" title="Σημειώσεις κεφαλαίου" aria-label="Σημειώσεις κεφαλαίου ${chNum(ch.n)}">${icon('book')}</button><button class="btn sm${d < ls.length ? ' primary' : ''}" data-task="${first.id}">${d === ls.length ? 'Ξανά' : d ? 'Συνέχεια' : 'Ξεκίνα'}</button>` : `<span class="hm-locked">${icon('lock')}</span>`}</li>`;
    }).join('');
    panel.innerHTML = `<div class="hm-ph"><h3>${esc(name)}</h3>${sayBtn('#hm-panel', 'το δωμάτιο')}<button class="btn quiet sm" id="hm-close" aria-label="Κλείσιμο">✕</button></div>
      ${th ? `<p class="hm-story">${esc(th.story)}</p>` : ''}<ul class="hm-chaps">${rows}</ul>
      ${r.state === 'done' ? `<div class="hm-chal${r.fixed ? ' fixed' : ''}"><b>${r.fixed ? '🔧 Πρόκληση λύθηκε' : '🚨 Το σπίτι έχει πρόβλημα!'}</b><span>${r.fixed ? `Καλύτερος χρόνος ${fmtSecs(P.challenges[key].best)} · ${P.challenges[key].n} ${P.challenges[key].n === 1 ? 'φορά' : 'φορές'}` : 'Κάτι χάλασε σε αυτό το δωμάτιο. Βρες το λάθος χωρίς βοήθειες.'}</span><button class="btn sm${r.fixed ? '' : ' primary'}" id="hm-chal">${r.fixed ? 'Νέο πρόβλημα' : 'Ξεκίνα την πρόκληση'}</button></div>` : `<p class="hm-chal-lock">${icon('lock')} Τελείωσε όλα τα κεφάλαια του δωματίου για να ξεκλειδώσει η πρόκληση «Το σπίτι έχει πρόβλημα».</p>`}`;
    panel.hidden = false;
    panel.dataset.room = key;
    $('#house').querySelectorAll('.hm-room').forEach(g => g.classList.toggle('sel', g.dataset.room === key));
    panel.querySelectorAll('[data-task]').forEach(b => { b.onclick = () => openTask(b.dataset.task); });
    if ($('#hm-chal')) $('#hm-chal').onclick = () => openChallenge(tr, key);
    $('#hm-close').onclick = () => { panel.hidden = true; $('#house').querySelectorAll('.hm-room.sel').forEach(g => g.classList.remove('sel')); const g = $(`#house .hm-room[data-room="${key}"]`); if (g) g.focus(); };
    const btn = panel.querySelector('.btn.primary, [data-task]');
    if (btn) btn.focus();
  }

  function renderHome() {
    clearInterval(S.chalT);
    if (window.IoTSpeak) window.IoTSpeak.stop();
    stopMachine();
    S.task = null;
    document.title = 'IoT Guardian';
    S.inputs = { button: false, pir: false };
    const tr = curTrack();
    if (!tr) { renderPicker(); return; }
    const mine = trackLessons(tr.id);
    const total = mine.length;
    const done = mine.filter(l => P.completed[l.id]).length;
    const nxt = nextTask();
    const allDone = total > 0 && done === total;
    const skills = Object.entries(SKILLS).map(([k, name]) => {
      const ls = mine.filter(l => l.skills.includes(k));
      if (!ls.length) return '';
      const d = ls.filter(l => P.completed[l.id]).length;
      const pct = Math.round((d / ls.length) * 100);
      return `<li class="skill"><span>${esc(name)}</span><span class="num">${d}/${ls.length}</span>
        <span class="bar" role="img" aria-label="${esc(name)}: ${d} από ${ls.length}"><i style="width:${pct}%"></i></span></li>`;
    }).join('');
    const chapters = trackChapters(tr.id).map(ch => {
      const ls = chapterLessons(ch.n);
      const unlocked = chapterUnlocked(ch.n);
      const items = ls.map(l => {
        const ok = taskUnlocked(l);
        const mark = P.completed[l.id] ? '✓' : ok ? '○' : '·';
        const state = P.completed[l.id] ? 'ολοκληρώθηκε' : ok ? 'διαθέσιμο' : 'κλειδωμένο';
        return `<li><button class="task-link" data-task="${l.id}" ${ok ? '' : 'disabled'}><span class="mark" aria-hidden="true">${mark}</span><span>${esc(l.title)}<span class="kind">${esc(KIND_LABELS[l.kind])} · ${state}</span></span></button></li>`;
      }).join('');
      const star = chapterDone(ch.n) && window.IoTStories && window.IoTStories[ch.n] ? ` <button class="story-chip" data-story="${ch.n}" title="Κάρτα ιστορίας: ${esc(window.IoTStories[ch.n].title)}">★ ${esc(window.IoTStories[ch.n].badge.name)}</button>` : '';
      return `<details class="chap"${P.current && byId[P.current] && byId[P.current].chapter === ch.n ? ' open' : ''}><summary><span class="no">${String(chNum(ch.n)).padStart(2, '0')}</span> ${esc(ch.title)}${ch.bonus ? ' <span class="py-tag">Επιπλέον</span>' : ''}${star} <span class="muted">· ${unlocked ? `${ls.filter(l => P.completed[l.id]).length}/${ls.length}` : 'κλειδωμένο'}</span></summary><ul class="task-list">${items}</ul></details>`;
    }).join('');

    const cert = allDone ? `<div class="card certificate"><h2>Βεβαίωση ολοκλήρωσης</h2>
        <p>Ολοκλήρωσες και τις ${total} ασκήσεις της διαδρομής ${esc(tr.name)} · ${esc(tr.boardName)} στο IoT Guardian.</p>
        <p class="muted">Είναι βεβαίωση εκπαιδευτικής ολοκλήρωσης, όχι επαγγελματική πιστοποίηση. Για δοκιμές σε πραγματικό ESP32 ή Raspberry Pi, δούλεψε μόνο σε δικό σου ή εξουσιοδοτημένο εργαστήριο.</p></div>` : '';

    app().innerHTML = `<div class="app">${rail('home')}
      <div class="main">
        ${header(`Πρόοδος · ${tr.name} · ${tr.boardName}`, done, total, 'Σήμερα', new Date().toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }))}
        <div class="ws">
          <section class="stage" aria-label="Το σπίτι και η πλακέτα">
            <div class="home-tabs" role="tablist" aria-label="Προβολή">
              <button class="home-tab" role="tab" id="tab-house" aria-selected="${S.homeView !== 'board'}">${icon('home')} Το σπίτι</button>
              <button class="home-tab" role="tab" id="tab-board" aria-selected="${S.homeView === 'board'}">${icon('chip')} Η πλακέτα</button>
              <button class="btn primary sm home-go" id="continue-top" title="${nxt ? esc(nxt.title) : ''}">${icon('play')} <span>${nxt ? `${done ? 'Συνέχεια' : 'Ξεκίνα'}: ${esc(nxt.title)}` : 'Επανάληψη από την αρχή'}</span></button>
            </div>
            <div class="house-wrap" id="house"${S.homeView === 'board' ? ' hidden' : ''}>${houseHTML(tr)}<div class="hm-panel" id="hm-panel" hidden></div></div>
            <div class="board-switch" id="board-switch" role="group" aria-label="Ποια πλακέτα"${S.homeView === 'board' ? '' : ' hidden'}>
              <button class="bs-b" id="bd-esp32" aria-pressed="${homeBoard(tr) === 'esp32'}">ESP32</button>
              <button class="bs-b" id="bd-pi" aria-pressed="${homeBoard(tr) === 'pi'}">Raspberry Pi 5</button>
              <span class="bs-hint">Πάτα ένα κομμάτι για να δεις τι είναι</span>
            </div>
            <div class="scene-wrap" id="scene"${S.homeView === 'board' ? '' : ' hidden'}>${sceneControls()}</div>
            <div class="card dock home-map">
              <div class="card-head"><h3>Χάρτης κεφαλαίων</h3><span class="muted" style="font-size:0.85rem">Κάθε κεφάλαιο ανοίγει όταν τελειώσεις το προηγούμενο</span></div>
              <div class="chaps">${chapters}</div>
            </div>
          </section>
          <aside class="side">
            <div class="card welcome">
              <div class="track-line"><span class="kind-tag">${esc(tr.name)} · ${esc(tr.boardName)} · ${esc(tr.tag)}</span><button class="btn quiet sm" id="change-track">Άλλαξε γλώσσα</button></div>
              <h1>Από το πρώτο LED στο ασφαλές έξυπνο σπίτι</h1>
              <p>Είσαι ο τεχνικός μιας εικονικής κατοικίας. ${esc(tr.desc)} Τρέχεις κάθε πρόγραμμα βήμα-βήμα και βλέπεις γιατί ανάβει κάθε φως και φεύγει κάθε μήνυμα.</p>
              <div class="btn-row"><button class="btn primary" id="continue">${icon('play')} ${nxt ? `${done ? 'Συνέχεια' : 'Ξεκίνα'}: ${esc(nxt.title)}` : 'Επανάληψη από την αρχή'}</button><button class="btn" id="restart">Μηδενισμός προόδου</button></div>
              <div id="confirm-slot"></div>
            </div>
            ${cert}
            ${reviewCard(tr)}
            <div class="card sandbox-card"><div class="card-head"><h3>${icon('tool')} Ελεύθερο εργαστήριο</h3></div><p class="muted" style="margin:0 0 0.5rem">Ο δικός σου πάγκος: διάλεξε εξαρτήματα, γράψε ό,τι θέλεις σε ${esc(tr.name)} και δες το να δουλεύει. Χωρίς ασκήσεις και ελέγχους.</p><button class="btn" id="open-sandbox">${icon('tool')} Άνοιξε το εργαστήριο</button></div>
            <div class="card"><div class="card-head"><h3>Δεξιότητες</h3><span class="muted" style="font-size:0.85rem">${done} από ${total} ασκήσεις</span></div><ul class="skills">${skills}</ul></div>
            ${collectionTeaser(tr)}
            <div class="card"><h3>Γνώρισε την πλακέτα</h3><p class="muted" style="margin:0">${tr.board === 'pi' ? 'Το Raspberry Pi 5 είναι ένας μικρός υπολογιστής με Linux. Το header με τα 40 pins (GPIO) συνδέει LED, κουμπιά και αισθητήρες: στον πάγκο το LED είναι στο GPIO 17, το κουμπί στο GPIO 27 και ο PIR στο GPIO 4.' : 'Το ESP32 έχει επεξεργαστή, WiFi και Bluetooth σε ένα μικρό module. Τα pins (GPIO) συνδέουν LED, κουμπιά και αισθητήρες. Το μπλε LED «D2» είναι συνδεδεμένο στο GPIO 2. Σε πραγματικές πλακέτες τα GPIO διαφέρουν από μοντέλο σε μοντέλο.'}</p></div>
          </aside>
        </div>
        <footer class="strip" aria-label="Κεφάλαια"><div class="strip-head">Κεφάλαια</div><div class="strip-row">${chapterCards()}</div></footer>
      </div></div>`;

    mountHomeBoard(homeBoard(tr));
    bindHouse(tr);
    if ($('#start-review')) $('#start-review').onclick = () => openReview(tr);
    if ($('#open-sandbox')) $('#open-sandbox').onclick = openSandbox;
    gardiHome(tr, nxt);
    if (!P.tours.home) setTimeout(() => { if (!S.task) startTour('home'); }, 700);
    bindRail();
    $('#continue').onclick = () => openTask((nxt || mine[0]).id);
    $('#continue-top').onclick = () => openTask((nxt || mine[0]).id);
    $('#change-track').onclick = renderPicker;
    app().querySelectorAll('[data-story]').forEach(b => { b.onclick = e => { e.preventDefault(); e.stopPropagation(); showStory(Number(b.dataset.story)); }; });
    const tz = $('#open-collection');
    if (tz) tz.onclick = () => openCollection(tr.id);
    $('#restart').onclick = () => {
      $('#confirm-slot').innerHTML = `<div class="confirm" role="alert"><p>Θα σβηστούν οι ολοκληρωμένες ασκήσεις, οι απαντήσεις, ο κώδικας και οι κάρτες σου σε όλες τις γλώσσες. Οι ρυθμίσεις εμφάνισης μένουν. Συνέχεια;</p>
        <div class="btn-row"><button class="btn primary" id="restart-yes">Ναι, νέα διαδρομή</button><button class="btn" id="restart-no">Άκυρο</button></div></div>`;
      $('#restart-no').onclick = () => { $('#confirm-slot').innerHTML = ''; $('#restart').focus(); };
      $('#restart-yes').onclick = () => {
        const settings = P.settings;
        const track = P.track;
        P = window.IoTStorage.defaults();
        P.settings = settings;
        P.track = track;
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
    $('#nav-lang').onclick = renderPicker;
    if ($('#nav-sandbox')) $('#nav-sandbox').onclick = openSandbox;
    if ($('#nav-cases')) $('#nav-cases').onclick = () => renderCases();
    $('#nav-lab').onclick = () => {
      if (!curTrack()) { renderPicker(); return; }
      const cur = P.current && byId[P.current];
      const t = (cur && trackOf(cur) === P.track && taskUnlocked(cur)) ? cur : (nextTask() || trackLessons(P.track)[0]);
      if (t) openTask(t.id);
    };
  }

  // ------------------------------------------------------------ Επιλογή γλώσσας και πλακέτας

  function trackStats(id) {
    const ls = trackLessons(id);
    const done = ls.filter(l => P.completed[l.id]).length;
    const chs = trackChapters(id);
    const cards = chs.filter(c => chapterDone(c.n) && window.IoTStories && window.IoTStories[c.n]).length;
    return { total: ls.length, done, chapters: chs.length, cards };
  }

  function renderPicker() {
    stopMachine();
    S.task = null;
    document.title = 'Διάλεξε γλώσσα · IoT Guardian';
    const langCards = LANGS.map(lg => {
      const tracks = TRACKS.filter(t => t.lang === lg.lang);
      const boards = tracks.map(t => {
        const st = trackStats(t.id);
        const pct = st.total ? Math.round((st.done / st.total) * 100) : 0;
        const ready = st.total > 0;
        return `<button class="board-pick${P.track === t.id ? ' current' : ''}" data-track="${t.id}" ${ready ? '' : 'disabled'}>
          <span class="bp-head"><span class="bp-board">${esc(t.boardName)}</span><span class="bp-tag">${esc(t.tag)}</span></span>
          <span class="bp-desc">${esc(t.desc)}</span>
          ${ready ? `<span class="bp-prog"><span class="bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span class="num">${st.done}/${st.total} ασκήσεις · ${st.chapters} κεφάλαια · ★ ${st.cards}</span></span>` : '<span class="bp-prog muted">Έρχεται σύντομα</span>'}
          ${ready ? `<span class="bp-go">${P.track === t.id ? 'Συνέχεια εδώ' : st.done ? 'Συνέχεια' : 'Ξεκίνα'} ${icon('right')}</span>` : ''}
        </button>`;
      }).join('');
      return `<section class="lang-card" aria-labelledby="lang-${lg.lang}">
        <div class="lc-top"><span class="lc-mono" style="background:${lg.color}" aria-hidden="true">${esc(lg.mono)}</span>
          <div><h2 id="lang-${lg.lang}">${esc(lg.name)}</h2><p class="muted">${esc(lg.blurb)}</p></div></div>
        <pre class="lc-code" aria-hidden="true">${esc(lg.code)}</pre>
        <div class="lc-boards">${boards}</div>
      </section>`;
    }).join('');
    app().innerHTML = `<div class="app">${rail('lang')}
      <div class="main picker">
        ${header('Συνολική πρόοδος · όλες οι γλώσσες', lessons.filter(l => P.completed[l.id]).length, lessons.length, 'Σήμερα', new Date().toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }))}
        <div class="picker-intro card">
          <span class="kind-tag">Καλώς ήρθες στο IoT Guardian</span>
          <h1>Σε ποια γλώσσα θέλεις να προγραμματίσεις;</h1>
          <p>Διάλεξε γλώσσα και πλακέτα. Κάθε διαδρομή έχει τα δικά της κεφάλαια και τη δική της πρόοδο, και μπορείς να αλλάξεις όποτε θέλεις: τίποτα δεν χάνεται. Σε κάθε κεφάλαιο που τελειώνεις κερδίζεις μια <strong>κάρτα ιστορίας</strong> και ένα <strong>σήμα</strong>.</p>
        </div>
        <div class="lang-grid">${langCards}</div>
      </div></div>`;
    bindRail();
    app().querySelectorAll('[data-track]').forEach(b => {
      b.onclick = () => {
        P.track = b.dataset.track;
        save();
        renderHome();
        announce(`Διαδρομή: ${curTrack().name} · ${curTrack().boardName}.`);
      };
    });
    window.scrollTo(0, 0);
    const first = app().querySelector('.board-pick.current') || app().querySelector('.board-pick');
    if (first) first.focus();
  }

  // ------------------------------------------------------------ Κάρτες ιστορίας και σήματα

  const BADGE_IC = {
    bulb: '<path d="M12 3a6 6 0 0 0-3.5 10.9V17h7v-3.1A6 6 0 0 0 12 3zM9.5 20h5"/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
    bug: '<ellipse cx="12" cy="13" rx="4.5" ry="6"/><path d="M12 7V4M9 5l-1.5-1.5M15 5l1.5-1.5M7.5 11H4M7.5 15H4M16.5 11H20M16.5 15H20M12 9v10"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    wave: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
    wifi: '<path d="M3 9a13 13 0 0 1 18 0M6 12.5a8.5 8.5 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="19" r="0.8"/>',
    radio: '<circle cx="12" cy="12" r="2"/><path d="M8 8a5.5 5.5 0 0 0 0 8M16 8a5.5 5.5 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
    crab: '<ellipse cx="12" cy="14" rx="6" ry="4"/><path d="M6 13l-3-3 1-3M18 13l3-3-1-3M8 17l-2 3M16 17l2 3M10 10V8M14 10V8"/>',
    snake: '<path d="M5 18c0-3 3-3 5-3s5 0 5-3-3-3-5-3-4-1-4-3 2-3 4-3h5"/><circle cx="18" cy="3.5" r="0.6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
    rocket: '<path d="M12 3c3 2 5 6 4 11h-8C7 9 9 5 12 3z"/><path d="M8 14l-3 4h4M16 14l3 4h-4"/><circle cx="12" cy="9" r="1.5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8l-1-4H9z"/>',
    battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10v4M6 10v4M9 10v4"/>',
    database: '<ellipse cx="12" cy="5" rx="7" ry="2.5"/><path d="M5 5v14c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5V5M5 12c0 1.4 3 2.5 7 2.5s7-1.1 7-2.5"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    car: '<path d="M4 16v-3l2-5h12l2 5v3zM4 13h16"/><circle cx="8" cy="17" r="1.8"/><circle cx="16" cy="17" r="1.8"/>'
  };
  function medal(st, locked, size) {
    const b = st && st.badge;
    const ic = locked ? '<path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 1-1 1.7M12 17h.01"/>' : BADGE_IC[b.icon] || BADGE_IC.star;
    return `<span class="medal${locked ? ' locked' : ''}" style="${locked ? '' : `background:${b.color}`};width:${size}px;height:${size}px" aria-hidden="true"><svg viewBox="0 0 24 24">${ic}</svg></span>`;
  }
  function collectionTeaser(tr) {
    if (!window.IoTStories) return '';
    const chs = trackChapters(tr.id).filter(c => window.IoTStories[c.n]);
    const got = chs.filter(c => chapterDone(c.n));
    return `<div class="card collection-teaser"><div class="card-head"><h3>Η συλλογή σου</h3><span class="muted" style="font-size:0.85rem">★ ${got.length} από ${chs.length} κάρτες</span></div>
      <div class="medal-row">${chs.map(c => medal(window.IoTStories[c.n], !chapterDone(c.n), 34)).join('')}</div>
      <p class="muted" style="margin:0.4rem 0 0.6rem">Κάθε κεφάλαιο που τελειώνεις ξεκλειδώνει μια αληθινή ιστορία από τον κόσμο του κώδικα και των επεξεργαστών.</p>
      <button class="btn sm" id="open-collection">Άνοιξε τη συλλογή</button></div>`;
  }
  function storyHTML(n, fresh) {
    const st = window.IoTStories[n];
    const ch = chByN(n);
    return `<div class="story-card">
      <div class="story-top">${medal(st, false, 64)}<div>
        <div class="story-kind">${fresh ? 'Νέα κάρτα ιστορίας · ' : ''}Κεφάλαιο ${chNum(n)} · ${esc(ch ? ch.title : '')}</div>
        <h3>${esc(st.title)}</h3>
        <div class="story-meta">${esc(st.who)} · ${esc(st.year)}</div></div></div>
      ${st.text.map(t => `<p>${esc(t)}</p>`).join('')}
      <p class="story-link">${esc(st.link)}</p>
      <div class="story-badge">Σήμα: <strong>${esc(st.badge.name)}</strong></div>
    </div>`;
  }
  function showStory(n, fresh) {
    if (!window.IoTStories || !window.IoTStories[n]) return;
    const d = $('#dlg-story');
    $('#dlg-story-body').innerHTML = storyHTML(n, fresh);
    d.classList.toggle('fresh', !!fresh);
    if (!d.open) d.showModal();
    const btn = d.querySelector('[data-close]');
    if (btn) btn.focus();
  }
  function openCollection(trackId) {
    const host = $('#dlg-collection-body');
    const tabs = TRACKS.filter(t => trackLessons(t.id).length);
    const active = trackId || P.track || tabs[0].id;
    const render = id => {
      const chs = trackChapters(id).filter(c => window.IoTStories && window.IoTStories[c.n]);
      host.innerHTML = `<div class="coll-tabs" role="tablist">${tabs.map(t => `<button role="tab" class="coll-tab${t.id === id ? ' on' : ''}" aria-selected="${t.id === id}" data-ct="${t.id}">${esc(t.name)} · ${esc(t.boardName)} <span class="muted">★ ${trackStats(t.id).cards}</span></button>`).join('')}</div>
        <ul class="coll-grid">${chs.map(c => {
          const got = chapterDone(c.n);
          const st = window.IoTStories[c.n];
          return `<li><button class="coll-item${got ? '' : ' locked'}" ${got ? `data-story="${c.n}"` : 'disabled'}>${medal(st, !got, 48)}
            <span class="ci-n">Κεφ. ${chNum(c.n)}</span><span class="ci-t">${got ? esc(st.badge.name) : 'Κλειδωμένο'}</span><span class="ci-s">${got ? esc(st.title) : esc(c.title)}</span></button></li>`;
        }).join('')}</ul>`;
      host.querySelectorAll('[data-ct]').forEach(b => { b.onclick = () => render(b.dataset.ct); });
      host.querySelectorAll('[data-story]').forEach(b => { b.onclick = () => showStory(Number(b.dataset.story)); });
    };
    render(active);
    $('#dlg-collection').showModal();
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
    S.scope = null;
    if (window.IoTSpeak) window.IoTSpeak.stop();
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

  const DOCK_NAMES = { scope: 'Λογικός αναλυτής', serial: 'Serial Monitor', mqtt: 'MQTT', net: 'Δίκτυο', logs: 'Log broker', energy: 'Ενέργεια', vars: 'Μεταβλητές', branch: 'if / else', loops: 'Επαναλήψεις', syntax: 'Σύνταξη', summary: 'Πώς το διαβάζει ο broker', cfglog: 'Log ελέγχου', hosts: 'Συσκευές', detail: 'Πακέτο', web: 'Browser', db: 'Βάση δεδομένων' };

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
    if (p.includes('serial')) panels.push(['serial', `<div class="card-head"><span class="muted" id="serial-title" style="font-size:0.85rem">${serialTitle(l)}</span>
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
    if (mode === 'code' && scopeSignals(l).length) panels.push(['scope', scopePanelHTML()]);
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
    if (l.sandbox || l.challenge) return '';
    const ch = CHAPTERS.find(c => c.n === l.chapter);
    const ls = chapterLessons(l.chapter);
    const ready = trackChapters(trackOf(l)).map(c => c.n);
    const i = ready.indexOf(l.chapter);
    const prev = ready[i - 1];
    const next = ready[i + 1];
    const cards = ls.map((x, k) => {
      const ok = taskUnlocked(x);
      return `<button class="strip-card${x === l ? ' current' : ''}${P.completed[x.id] ? ' done' : ''}" data-task="${x.id}" ${ok ? '' : 'disabled'} ${x === l ? 'aria-current="true"' : ''}>
        ${thumb(lessonIcon(x))}<span class="sc-txt"><span class="sc-n">${k + 1}. ${esc(KIND_LABELS[x.kind])}</span><span class="sc-t">${esc(x.title)}</span><span class="sc-p">${P.completed[x.id] ? '✓ ολοκληρώθηκε' : ok ? '' : 'κλειδωμένο'}</span></span></button>`;
    }).join('');
    return `<footer class="strip" aria-label="Μαθήματα του κεφαλαίου">
      <div class="strip-head">Μαθήματα · Κεφάλαιο ${chNum(l.chapter)}: ${esc(ch.title)}</div>
      <div class="strip-row">
        ${prev !== undefined ? `<button class="strip-nav" data-chapter="${prev}" ${chapterUnlocked(prev) ? '' : 'disabled'} aria-label="Κεφάλαιο ${chNum(prev)}">${icon('left')}<span>Κεφ. ${chNum(prev)}</span></button>` : ''}
        ${cards}
        ${next !== undefined ? `<button class="strip-nav" data-chapter="${next}" ${chapterUnlocked(next) ? '' : 'disabled'} aria-label="Κεφάλαιο ${chNum(next)}"><span>Κεφ. ${chNum(next)}</span>${icon('right')}</button>` : ''}
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
        <div class="say-row">${sayBtn('#info-lesson', 'το μάθημα')}</div>
        <span class="kind-tag">${esc(KIND_LABELS[l.kind])}${mode === 'config' ? (l.system ? ' · ρυθμίσεις του Pi' : ' · ρυθμίσεις broker') : mode === 'analysis' ? ' · ανάλυση καταγραφής' : ''} ${l.challenge ? ' · χωρίς βοήθειες' : l.sandbox ? ' · χωρίς ασκήσεις' : ` · άσκηση ${idx} από ${ls.length}`}</span>
        <h2>${esc(l.title)}</h2>
        <ul class="objectives">${l.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul>
        <div class="theory">${l.theory}</div>
        ${l.glossary && l.glossary.length ? `<div class="lesson-words"><b>Λέξεις του μαθήματος</b>${l.glossary.map(t => `<button type="button" class="gl-term chip" data-term="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
        <button type="button" class="btn sm notes-btn" data-notes="${l.chapter}">${icon('book')} Σημειώσεις κεφαλαίου</button>
      </div>
      <div class="info-panel" id="info-steps" role="tabpanel" aria-labelledby="itab-steps" hidden>
        <div class="say-row">${sayBtn('#info-steps', 'τα βήματα')}</div>
        <ol class="steps">${l.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        ${l.supportedSyntax ? `<p class="syntax-note"><strong>Υποστηριζόμενα εδώ:</strong> ${esc(l.supportedSyntax)}</p>` : ''}
        ${l.evidenceHint ? `<p class="syntax-note"><strong>Τι ψάχνεις:</strong> ${esc(l.evidenceHint)}</p>` : ''}
      </div>
      <div class="info-panel quiz" id="info-quiz" role="tabpanel" aria-labelledby="itab-quiz" hidden><div class="say-row">${sayBtn('#info-quiz', 'την ερώτηση')}</div><h3>${quizTitle}</h3><div id="quiz-body"></div></div>
      <div class="info-panel" id="info-help" role="tabpanel" aria-labelledby="itab-help" hidden><div class="say-row">${sayBtn('#hints', 'τη βοήθεια')}</div><div id="hints"></div></div>
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
        ${mode === 'code' && window.IoTBlocks ? `<div class="code-mode" role="tablist" aria-label="Πώς γράφεις"><button role="tab" class="cm-b" data-cm="text" aria-selected="true">${icon('code')} Κείμενο</button><button role="tab" class="cm-b" data-cm="blocks" aria-selected="false">🧩 Μπλοκ</button></div><div class="blocks" id="blocks" hidden></div>` : ''}
        <div class="editor">
          <div class="gutter" id="gutter" aria-hidden="true"></div>
          <div class="code-wrap">
            <pre id="hl" aria-hidden="true"></pre>
            <textarea id="code" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"
              aria-label="${isConfig ? (l.system ? 'Ρυθμίσεις του Pi' : 'Ρυθμίσεις broker') : 'Κώδικας άσκησης'}" aria-describedby="editor-help"></textarea>
          </div>
        </div>
        ${isConfig ? '' : `<div class="mini-mon${S.miniCollapsed ? ' collapsed' : ''}" id="mini-mon" data-state="idle">
          <button class="mm-head" id="mm-toggle" aria-expanded="${!S.miniCollapsed}" aria-controls="mm-body"><span class="mm-dot" aria-hidden="true"></span><b>${langOf(l) === 'python' ? 'Τερματικό' : 'Serial Monitor'}</b><span class="mm-state" id="mm-state">ΕΤΟΙΜΟ</span><span class="mm-caret" aria-hidden="true">▾</span></button>
          <pre class="mm-body" id="mm-body" aria-live="off"></pre>
        </div>`}
        ${isConfig ? '' : `<div class="explain" id="explain" aria-live="polite"><span class="ex-q">${icon('bulb')} Τι κάνει αυτή η γραμμή;</span><span class="ex-a" id="explain-a">Πάτα σε μια γραμμή του κώδικα.</span></div>`}
        <p class="editor-help" id="editor-help">${isConfig
          ? 'Σχόλιο είναι μόνο γραμμή που ξεκινά με #. Tab: εσοχή · Esc και μετά Tab: έξοδος.'
          : langOf(l) === 'python' ? 'Tab: εσοχή 4 κενών · Enter μετά από «:» μεγαλώνει την εσοχή · Esc και μετά Tab: έξοδος · Ctrl+Enter: εκτέλεση'
            : langOf(l) === 'rust' ? 'Tab: εσοχή 4 κενών · Enter μετά από { μεγαλώνει την εσοχή · Esc και μετά Tab: έξοδος · Ctrl+Enter: εκτέλεση (cargo run)'
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
        <div class="dock-tabs" role="tablist" aria-label="Έξοδος">${panels.map(([k]) => `<button role="tab" class="dtab" data-dtab="${k}" id="dtab-${k}" aria-controls="dock-${k}">${k === 'serial' && boardOf(l) === 'pi' ? 'Τερματικό' : k === 'summary' && l.system ? 'Πώς το διαβάζει το Pi' : DOCK_NAMES[k]}</button>`).join('')}</div>
        ${panels.map(([k, html]) => `<div class="dock-panel" id="dock-${k}" role="tabpanel" aria-labelledby="dtab-${k}" ${k === S.dockTab ? '' : 'hidden'}>${html}</div>`).join('')}
      </div>` : '';

    app().innerHTML = `<div class="app">${rail(l.sandbox ? 'sandbox' : 'lab')}
      <div class="main">
        ${header(l.sandbox ? 'Ελεύθερο εργαστήριο · χωρίς ασκήσεις' : `Κεφ. ${chNum(l.chapter)} · ${ch.title}`, doneCh, ls.length, 'Εικονικός χρόνος', '00:00.000')}
        <div class="ws">
          <section class="stage" aria-label="Σκηνή εργαστηρίου">
            ${missionHTML(l)}
            ${l.sandbox ? benchHTML(l) : ''}
            <div id="wiring-slot"></div>
            <div class="scene-wrap" id="scene">${sceneControls()}${mode === 'code' ? inputsCardHTML(hw, w) : ''}</div>
            ${dock}
          </section>
          <aside class="side">${info}${tryCard}</aside>
        </div>
        ${lessonStrip(l)}
      </div></div>`;

    mountScene(mode !== 'code' ? window.IoTScene.netScene() : boardOf(l) === 'pi' ? window.IoTScene.piScene(hw, w) : window.IoTScene.labScene(hw, w));
    if (mode === 'code') setupWiring(l);
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
      $('#b-run').onclick = () => (S.runState === 'running' ? doStop() : doRun());
      if ($('#mm-toggle')) $('#mm-toggle').onclick = () => {
        S.miniCollapsed = !S.miniCollapsed;
        $('#mini-mon').classList.toggle('collapsed', S.miniCollapsed);
        $('#mm-toggle').setAttribute('aria-expanded', String(!S.miniCollapsed));
      };
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
    if (mode !== 'analysis' && langOf(l) === 'cpp' && window.IoTReal) {
      window.IoTReal.mount($('#real-slot'), { mode, getCode: () => $('#code').value, consts: () => worldOf(l).consts || {} });
    }
    bindOutputs();
    S.msPrev = false;
    refreshMission(60);
    renderQuiz();
    renderHints();
    if (window.IoTLearn) window.IoTLearn.linkTerms($('#info-lesson .theory'), l.glossary, GLOSSARY);
    bindExplain(l);
    bindCodeMode(l);
    if (l.sandbox) {
      ['b-help', 'itab-help', 'itab-quiz', 'b-check'].forEach(id => { const x = $('#' + id); if (x) x.hidden = true; });
      bindBench(l);
    }
    if (l.challenge) {
      ['b-help', 'itab-help', 'itab-quiz'].forEach(id => { const x = $('#' + id); if (x) x.hidden = true; });
      clearInterval(S.chalT);
      S.chalT = setInterval(() => { const t = $('#ch-timer'); if (!t || !S.chal || S.task !== l) { clearInterval(S.chalT); return; } t.textContent = fmtSecs(Math.round((Date.now() - S.chal.t0) / 1000)); }, 1000);
    }
    gardiLesson(l);
    if (!P.tours.lab && !l.sandbox && !l.challenge) setTimeout(() => { if (S.task === l) startTour('lab'); }, 900);
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
    if (tab === 'scope') { bindScope(); drawScope(); }
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

  // ------------------------------------------------------------ Κείμενο ή μπλοκ
  const blocksKey = l => (l.sandbox ? 'sandbox:' + P.track : l.id);
  function bindCodeMode(l) {
    const tabs = app().querySelectorAll('[data-cm]');
    if (!tabs.length) return;
    tabs.forEach(b => { b.onclick = () => setCodeMode(l, b.dataset.cm, true); });
    if (P.settings.codeView === 'blocks') setCodeMode(l, 'blocks', false);
  }
  function setCodeMode(l, mode, userAction) {
    const ta = $('#code');
    const box = $('#blocks');
    if (!ta || !box) return;
    app().querySelectorAll('[data-cm]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.cm === mode)));
    const help = $('#editor-help');
    if (mode === 'text') {
      box.hidden = true;
      box.innerHTML = '';
      ta.readOnly = false;
      $('.editor').classList.remove('from-blocks');
      if (help && help.dataset.text) help.textContent = help.dataset.text;
      S.blocksEd = null;
    } else {
      if (S.runState === 'running') doStop();
      const key = blocksKey(l);
      const before = ta.value;
      const model = P.blocks[key] || (l.sandbox ? window.IoTBlocks.STARTER() : { setup: [], loop: [] });
      box.hidden = false;
      ta.readOnly = true;
      $('.editor').classList.add('from-blocks');
      if (help) { help.dataset.text = help.dataset.text || help.textContent; help.textContent = `Αυτός είναι ο ίδιος κώδικας σε ${langName(l)}: τον γράφουν τα μπλοκ σου. Για να τον αλλάξεις με το χέρι, πάτα «Κείμενο».`; }
      S.blocksEd = window.IoTBlocks.mount(box, model, {
        track: P.track || 'cpp-esp32',
        hw: hardwareOf(l).concat(hardwareOf(l).includes('ultrasonic') || hardwareOf(l).includes('traffic') ? [] : ['led']),
        onChange: (m, code) => {
          P.blocks[key] = m;
          ta.value = code;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          renderEditor();
        }
      });
      // ο κώδικας του κειμένου αντικαθίσταται: κρατάμε το παλιό για «Αναίρεση»
      const code = window.IoTBlocks.generate(model, P.track || 'cpp-esp32');
      if (before.trim() && before !== code && userAction) gardi('Τα μπλοκ έγραψαν από την αρχή τον κώδικα. Αν θες τον παλιό σου κώδικα, πάτα «Αναίρεση».', 'think', [{ label: 'Αναίρεση', run: () => { setCodeMode(l, 'text', false); ta.value = before; ta.dispatchEvent(new Event('input', { bubbles: true })); renderEditor(); } }], { force: true });
      else if (userAction) gardi('Πάτα ένα μπλοκ για να μπει στο πρόγραμμα, και μετά «Εκτέλεση»! Δίπλα βλέπεις τον ίδιο κώδικα σε κείμενο.', 'happy', null, { force: true });
      ta.value = code;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      renderEditor();
    }
    if (userAction) { P.settings.codeView = mode; save(); sfx('click'); }
  }
  const langName = l => ({ cpp: 'C++', python: boardOf(l) === 'pi' ? 'Python' : 'MicroPython', rust: 'Rust' })[langOf(l)];

  // ------------------------------------------------------------ Ελεύθερο εργαστήριο
  function sandboxLesson(tr) {
    const SB = window.IoTSandbox;
    const allowed = SB.allowed(tr.id, tr.board);
    const saved = P.sandbox.hw[tr.id];
    const hw = (saved || ['led', 'button']).filter(h => allowed.includes(h));
    const first = trackChapters(tr.id)[0];
    const lang = tr.lang;
    const tbl = rows => `<div class="table-wrap"><table><tbody>${rows.map(([a, b]) => `<tr><td class="code">${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div>`;
    const ideas = [].concat(...hw.map(h => SB.IDEAS[h] || []));
    return {
      id: 'sandbox', sandbox: true, kind: 'sandbox', chapter: first.n, theme: 'workshop',
      title: 'Ελεύθερο εργαστήριο', lang: lang === 'cpp' ? undefined : lang, board: tr.board,
      hardware: hw.length ? hw : ['led'],
      initialWorld: { button: false, pir: false, temp: 24, humidity: 45, distance: 80, router: true },
      initialCode: P.sandbox.code[tr.id] || SB.BLANK[tr.id] || '',
      solution: '', validationTests: [], hints: [], quiz: null, prerequisites: [], glossary: [], skills: [],
      objectives: ['Να πειραματιστώ ελεύθερα με τα εξαρτήματα που διαλέγω.', 'Να δω στη σκηνή και στον λογικό αναλυτή τι κάνει ο κώδικάς μου.'],
      theory: `<p>Εδώ είναι ο δικός σου πάγκος. Δεν υπάρχουν ασκήσεις ούτε έλεγχοι: γράφεις, πατάς «Εκτέλεση» και βλέπεις τι γίνεται. Ο κώδικάς σου αποθηκεύεται μόνος του.</p>
        <h3>Pins του πάγκου (${tr.board === 'pi' ? 'Raspberry Pi' : 'ESP32'})</h3>${tbl(SB.PINS[tr.board] || SB.PINS.esp32)}
        <h3>Βασικές εντολές (${esc(tr.name)})</h3>${tbl(SB.CHEAT[tr.id] || [])}`,
      steps: ideas.length ? ideas : ['Διάλεξε εξαρτήματα στον πάγκο για ιδέες.'],
      explanationOnSuccess: '', remediation: ''
    };
  }
  // ------------------------------------------------------------ Ιστορίες ασφάλειας (js/cases.js, js/cases-data.js)
  function renderCases() {
    const C = window.IoTCases;
    if (!C) return;
    stopMachine();
    if (S.casePlayer) { S.casePlayer.stop(); S.casePlayer = null; }
    S.task = null;
    P.cases = P.cases || {};
    document.title = 'Ιστορίες ασφάλειας · IoT Guardian';
    const done = C.CASES.filter(c => P.cases[c.id]).length;
    const cards = C.CASES.map(c => `<button type="button" class="case-card${P.cases[c.id] ? ' done' : ''}" data-case="${c.id}">
        <span class="cc-ic" aria-hidden="true">${c.cover}</span>
        <span class="cc-body"><b>${esc(c.title)}</b><small>${esc(c.year)} · ${esc(c.device)}</small><span class="cc-src">${esc(c.source.short)}</span></span>
        <span class="cc-state">${P.cases[c.id] ? '✓ ολοκληρώθηκε' : 'ξεκίνα →'}</span></button>`).join('');
    app().innerHTML = `<div class="app">${rail('cases')}
      <div class="main cases">
        ${header('Ιστορίες ασφάλειας', done, C.CASES.length, 'Σήμερα', new Date().toLocaleDateString('el-GR', { day: 'numeric', month: 'short', year: 'numeric' }))}
        <div class="card cases-intro">
          <span class="kind-tag">${icon('shield')} Ιστορίες ασφάλειας</span>
          <h1>Πραγματικές επιθέσεις σε συσκευές IoT, και πώς προστατεύεσαι</h1>
          <p>Κάθε ιστορία βασίζεται σε δημοσιευμένη έρευνα. Βλέπεις <strong>πώς έγινε</strong> σε μια κινούμενη σκηνή, διαλέγεις <strong>μέτρα προστασίας</strong> και η ίδια επίθεση ξαναπαίζει: αν διάλεξες σωστά, σταματά. Στο τέλος, ένα μικρό κουίζ.</p>
          <p class="muted">Δείχνουμε μόνο την ιδέα κάθε επίθεσης, για να καταλάβεις πώς αμύνεσαι. Ποτέ μη δοκιμάζεις επιθέσεις σε συσκευές που δεν είναι δικές σου.</p>
        </div>
        <div class="case-grid">${cards}</div>
      </div></div>`;
    bindRail();
    app().querySelectorAll('[data-case]').forEach(b => { b.onclick = () => renderCase(b.dataset.case); });
    window.scrollTo(0, 0);
  }

  function renderCase(id) {
    const C = window.IoTCases;
    const c = C.CASES.find(x => x.id === id);
    if (!c) { renderCases(); return; }
    stopMachine();
    if (S.casePlayer) S.casePlayer.stop();
    document.title = `${c.title} · Ιστορίες ασφάλειας · IoT Guardian`;
    const st = { phase: 1, watched: !!P.cases[id], defOk: !!P.cases[id] };
    const ch = c.chapter ? chByN(c.chapter) : null;
    app().innerHTML = `<div class="app">${rail('cases')}
      <div class="main cases case-page">
        <div class="case-top"><button class="btn sm" id="case-back">← Όλες οι ιστορίες</button></div>
        <div class="card case-head">
          <span class="kind-tag">${c.cover} ${esc(c.year)} · ${esc(c.device)}</span>
          <h1>${esc(c.title)}</h1>
          <p>${esc(c.intro)}</p>
          <p class="case-src">Πηγή: <a href="${esc(c.source.url)}" target="_blank" rel="noopener noreferrer">${esc(c.source.cite)}</a></p>
        </div>
        <div class="case-tabs" role="tablist" aria-label="Μέρη της ιστορίας">
          <button role="tab" class="case-tab" data-phase="1">1 · Πώς έγινε</button>
          <button role="tab" class="case-tab" data-phase="2">2 · Προστάτευσέ το</button>
          <button role="tab" class="case-tab" data-phase="3">3 · Κουίζ</button>
        </div>
        <div class="card case-stage-card">
          <div class="case-stage" id="case-stage"></div>
          <div class="case-say" id="case-say" aria-live="polite"><span class="cs-n" id="case-n"></span><span id="case-text">Πάτα «Παίξε» για να δεις πώς έγινε.</span></div>
          <div class="case-ctl">
            <button class="btn primary sm" id="case-play">${icon('play')} Παίξε</button>
            <button class="btn sm" id="case-step">${icon('step')} Επόμενο βήμα</button>
            <button class="btn sm" id="case-reset">⟲ Από την αρχή</button>
            <span class="spacer"></span>
            ${window.IoTSpeak && window.IoTSpeak.supported() ? `<button class="btn quiet sm" id="case-say-btn">${icon('speaker')} Άκουσε</button>` : ''}
          </div>
        </div>
        <div class="card case-panel" id="case-panel"></div>
      </div></div>`;
    bindRail();
    $('#case-back').onclick = renderCases;
    let lastSay = '';
    const player = C.mount($('#case-stage'), c, {
      motion: motionOK,
      sfx: n => sfx(n),
      onSay: (text, k, n, good) => {
        lastSay = text;
        $('#case-n').textContent = `Βήμα ${k + 1}/${n}`;
        $('#case-text').textContent = text;
        $('#case-say').classList.toggle('good', !!good);
      },
      onEnd: r => {
        if (r.attack) { st.watched = true; $('#case-text').textContent = lastSay + ' ' + '— Τέλος της επίθεσης. Πάμε στο «Προστάτευσέ το».'; tabs(); if (st.phase === 1) panel(); }
        else if (r.blocked) { $('#case-say').classList.add('good'); sfx('win'); }
        else { $('#case-text').textContent = '⚠️ Η επίθεση πέτυχε ξανά: τα μέτρα σου δεν τη σταμάτησαν.'; sfx('err'); }
      }
    });
    S.casePlayer = player;
    $('#case-play').onclick = () => player.play();
    $('#case-step').onclick = () => player.step();
    $('#case-reset').onclick = () => { player.reset(); $('#case-n').textContent = ''; $('#case-text').textContent = 'Πάτα «Παίξε» για να δεις πώς έγινε.'; $('#case-say').classList.remove('good'); };
    if ($('#case-say-btn')) $('#case-say-btn').onclick = () => window.IoTSpeak.say($('#case-text').textContent);

    function tabs() {
      app().querySelectorAll('.case-tab').forEach(b => {
        const p = Number(b.dataset.phase);
        const open = p === 1 || (p === 2 && st.watched) || (p === 3 && st.defOk);
        b.disabled = !open;
        b.setAttribute('aria-selected', String(p === st.phase));
        b.classList.toggle('on', p === st.phase);
        b.onclick = () => { st.phase = p; tabs(); panel(); };
      });
    }
    function panel() {
      const el = $('#case-panel');
      if (st.phase === 1) {
        el.innerHTML = `<h2>Πώς έγινε</h2><ol class="case-steps">${c.steps.map(s => `<li>${esc(s.say)}</li>`).join('')}</ol>
          ${st.watched ? '<button class="btn primary" id="case-go2">Προστάτευσέ το →</button>' : '<p class="muted">Δες όλη την επίθεση (▶ Παίξε) για να ξεκλειδώσει το επόμενο μέρος.</p>'}`;
        if ($('#case-go2')) $('#case-go2').onclick = () => { st.phase = 2; tabs(); panel(); };
        return;
      }
      if (st.phase === 2) {
        el.innerHTML = `<h2>Προστάτευσέ το</h2><p>Ποια μέτρα θα είχαν σταματήσει αυτή την επίθεση; Διάλεξε <strong>όλα</strong> τα σωστά (και κανένα λάθος) και ξαναπαίξε την.</p>
          <div class="case-defs">${c.defenses.map(d => `<label class="case-def"><input type="checkbox" value="${d.id}"> <span>${esc(d.label)}</span></label>`).join('')}</div>
          <div class="case-ctl"><button class="btn primary" id="case-try">${icon('shield')} Ξαναπαίξε με τα μέτρα μου</button></div>
          <div id="case-fb" aria-live="polite"></div>`;
        $('#case-try').onclick = () => {
          const chosen = [...el.querySelectorAll('.case-def input:checked')].map(x => x.value);
          const j = C.judge(c, chosen);
          player.replay(chosen);
          window.scrollTo({ top: $('#case-stage').getBoundingClientRect().top + scrollY - 20, behavior: motionOK() ? 'smooth' : 'auto' });
          const row = (d, cls, head) => `<li class="${cls}"><b>${head} ${esc(d.label)}</b><br>${esc(d.why)}</li>`;
          $('#case-fb').innerHTML = `<ul class="case-fb">${j.good.map(d => row(d, 'ok', '✓')).join('')}${j.bad.map(d => row(d, 'no', '✗')).join('')}</ul>
            ${j.ok ? '<p class="case-win">Σωστά! Με αυτά τα μέτρα η επίθεση σταματά. <button class="btn primary sm" id="case-go3">Στο κουίζ →</button></p>'
              : `<p class="case-miss">${j.missed.length ? `Σου λείπουν ακόμα ${j.missed.length} σωστά μέτρα. ` : ''}${j.bad.length ? 'Ξεδιάλεξε όσα δεν βοηθούν (✗). ' : ''}Δοκίμασε ξανά.</p>`}`;
          if (j.ok) { st.defOk = true; tabs(); $('#case-go3').onclick = () => { st.phase = 3; tabs(); panel(); }; }
        };
        return;
      }
      const q = c.quiz;
      el.innerHTML = `<h2>Κουίζ</h2><fieldset class="case-quiz"><legend>${esc(q.question)}</legend>
          ${q.options.map((o, k) => `<label><input type="radio" name="case-q" value="${k}"> ${esc(o)}</label>`).join('')}</fieldset>
        <button class="btn primary" id="case-check">Έλεγχος</button><div id="case-qfb" aria-live="polite"></div>`;
      $('#case-check').onclick = () => {
        const v = el.querySelector('input[name="case-q"]:checked');
        if (!v) { $('#case-qfb').innerHTML = '<p class="case-miss">Διάλεξε μια απάντηση.</p>'; return; }
        if (Number(v.value) !== q.answer) { sfx('err'); $('#case-qfb').innerHTML = `<p class="case-miss">Όχι ακόμα. ${esc(q.retry || 'Ξαναδές την επίθεση και τα μέτρα.')}</p>`; return; }
        const first = !P.cases[id];
        P.cases[id] = true;
        save();
        sfx('win');
        $('#case-qfb').innerHTML = `<p class="case-win">${esc(q.explain)}</p>
          <div class="case-lesson"><h3>Τι κρατάμε</h3><p>${esc(c.lesson)}</p>
          ${ch ? `<p>Εξάσκηση στον κώδικα: <strong>Κεφάλαιο ${ch.n} · ${esc(ch.title)}</strong>.</p>` : ''}</div>
          <button class="btn" id="case-more">Όλες οι ιστορίες</button>`;
        $('#case-more').onclick = renderCases;
        if (first) announce('Η ιστορία ολοκληρώθηκε!');
      };
    }
    tabs();
    panel();
    window.scrollTo(0, 0);
  }

  function openSandbox() {
    const tr = curTrack();
    if (!tr || !window.IoTSandbox) { renderPicker(); return; }
    const L = sandboxLesson(tr);
    byId[L.id] = L;
    delete P.drafts[L.id];
    openTask(L.id);
  }
  function sandboxTemplates(tr) {
    // ασκήσεις που έχεις ήδη λύσει: η πιο προχωρημένη από κάθε κεφάλαιο
    const groups = new Map();
    for (const l of trackLessons(tr.id)) {
      const w = worldOf(l);
      if (!P.completed[l.id] || modeOf(l) !== 'code' || !l.solution || w.broker || w.wifi || (l.hardware || []).some(h => ['web', 'broker', 'db'].includes(h))) continue;
      groups.set(l.chapter, l);
    }
    return [...groups.values()];
  }
  function benchHTML(l) {
    const tr = curTrack();
    const SB = window.IoTSandbox;
    const allowed = SB.allowed(tr.id, tr.board);
    const tpl = sandboxTemplates(tr);
    return `<section class="bench" id="bench" aria-label="Ο πάγκος σου">
      <div class="bench-head">${icon('tool')}<b>Ο πάγκος σου</b><span class="muted">διάλεξε εξαρτήματα</span></div>
      <div class="bench-parts">${SB.COMPONENTS.filter(c => allowed.includes(c.id)).map(c => `<button type="button" class="bench-chip" data-hw="${c.id}" aria-pressed="${l.hardware.includes(c.id)}">${esc(c.label)}</button>`).join('')}</div>
      <div class="bench-row">
        <label for="sb-tpl" class="muted">Ξεκίνα από:</label>
        <select id="sb-tpl"><option value="">Αναβόσβημα LED (απλή αρχή)</option>${tpl.map(x => `<option value="${x.id}">${esc(x.title)} · Κεφ. ${chNum(x.chapter)}</option>`).join('')}</select>
        <button class="btn sm" id="sb-load">Φόρτωσε</button>
        <span class="spacer"></span>
        <button class="btn sm" id="sb-copy">Αντιγραφή</button>
        <button class="btn sm" id="sb-dl">Κατέβασε .${SB.EXT[langOf(l)]}</button>
      </div>
      ${tpl.length ? '' : '<p class="muted" style="margin:0;font-size:0.85rem">Κάθε άσκηση που λύνεις γίνεται κι αυτή αφετηρία εδώ.</p>'}
    </section>`;
  }
  function bindBench(l) {
    const tr = curTrack();
    const SB = window.IoTSandbox;
    const reopen = () => { if (S.runState === 'running') doStop(); openSandbox(); };
    app().querySelectorAll('[data-hw]').forEach(b => {
      b.onclick = () => {
        const cur = new Set(l.hardware);
        if (cur.has(b.dataset.hw)) cur.delete(b.dataset.hw); else cur.add(b.dataset.hw);
        P.sandbox.hw[tr.id] = [...cur];
        save();
        sfx('click');
        reopen();
      };
    });
    $('#sb-load').onclick = () => {
      const id = $('#sb-tpl').value;
      const src = id ? byId[id] : null;
      const prev = $('#code').value;
      P.sandbox.code[tr.id] = src ? src.solution : SB.BLANK[tr.id];
      if (src) P.sandbox.hw[tr.id] = hardwareOf(src).filter(h => SB.allowed(tr.id, tr.board).includes(h)).concat(hardwareOf(src).includes('led') || !hardwareOf(src).some(h => h === 'ultrasonic' || h === 'traffic') ? ['led'] : []);
      save();
      reopen();
      gardi(src ? `Φόρτωσα τη λύση σου από «${src.title}». Άλλαξέ τη όπως θέλεις!` : 'Ξεκινάμε από ένα απλό αναβόσβημα.', 'happy', [{ label: 'Αναίρεση', run: () => { P.sandbox.code[tr.id] = prev; save(); openSandbox(); } }], { force: true });
    };
    $('#sb-copy').onclick = () => {
      const t = $('#code').value;
      try { navigator.clipboard.writeText(t).then(() => announce('Ο κώδικας αντιγράφηκε.')); } catch (e) { announce('Δεν έγινε αντιγραφή.'); }
    };
    $('#sb-dl').onclick = () => {
      const ext = SB.EXT[langOf(l)];
      const blob = new Blob([$('#code').value], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = ext === 'rs' ? 'main.rs' : `iot-guardian-${tr.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
  }

  // ------------------------------------------------------------ «Το σπίτι έχει πρόβλημα»
  const fmtSecs = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  function openChallenge(tr, key) {
    const C = window.IoTChallenge;
    const r = houseRooms(tr)[key];
    if (!C || !r) return;
    const pool = [];
    for (const ch of r.chapters) for (const l of chapterLessons(ch.n)) if (P.completed[l.id] && modeOf(l) !== 'analysis') pool.push(l);
    const c = C.make(pool.reverse(), VAL.runTests, key + ((P.challenges[key] || {}).n || 0) + (S.chalSalt || ''));
    if (!c) { gardi('Δεν βρήκα πρόβλημα για αυτό το δωμάτιο. Όλα δουλεύουν τέλεια!', 'happy'); return; }
    const name = window.IoTHouse.ROOMS[key].name;
    const story = C.story(name, c.kind);
    const L = Object.assign({}, c.base, {
      id: 'chal-' + key, challenge: key, kind: 'challenge', title: `Το σπίτι έχει πρόβλημα · ${name}`,
      initialCode: c.code, hints: [], quiz: null, prerequisites: [], glossary: [], missionStory: story,
      objectives: ['Να βρω και να διορθώσω ένα λάθος σε κώδικα που ήδη ξέρω, χωρίς βοήθειες.'],
      theory: `<p>${esc(story)}</p><p>Ο κώδικας είναι από την άσκηση «${esc(c.base.title)}». Κάποιος άλλαξε <b>ένα</b> σημείο του. Τρέξε τον, σύγκρινε με το σύμπτωμα και διόρθωσε μόνο αυτό που χρειάζεται.</p><p>Εργαλεία που σε βοηθούν: η σκηνή, ο «Λογικός αναλυτής», το «Τι κάνει αυτή η γραμμή;» και ο «Έλεγχος λύσης».</p>`,
      steps: ['Τρέξε τον κώδικα και παρατήρησε τι κάνει.', 'Σύγκρινε με το σύμπτωμα της πρόκλησης.', 'Βρες τη γραμμή που φταίει και διόρθωσέ τη.', 'Πάτα «Έλεγχος λύσης».']
    });
    byId[L.id] = L;
    delete P.drafts[L.id];
    S.chal = { key, t0: Date.now(), kind: c.kind };
    S.chalSalt = String(Date.now() % 997);
    sfx('err');
    openTask(L.id);
  }

  // ------------------------------------------------------------ Ξενάγηση την πρώτη φορά
  const TOURS = {
    home: [
      { sel: '#house .house-map', title: 'Το σπίτι σου', text: 'Κάθε δωμάτιο έχει κεφάλαια με ασκήσεις. Όταν τα τελειώνεις, ανάβουν τα φώτα του. Πάτα ένα δωμάτιο για να δεις τι έχει μέσα.' },
      { sel: '#continue-top', title: 'Από εδώ ξεκινάς', text: 'Αυτό το κουμπί σε πάει πάντα στην επόμενη άσκηση.' },
      { sel: '#tab-board', title: 'Η πλακέτα', text: 'Εδώ βλέπεις το ESP32 ή το Raspberry Pi από κοντά. Πατάς κάθε κομμάτι και μαθαίνεις τι είναι.' },
      { sel: '.review-card', title: 'Λίγο κάθε μέρα', text: 'Οι ερωτήσεις από όσα έλυσες ξανάρχονται εδώ, για να μην τα ξεχνάς. Τρία βήματα τη μέρα κρατούν το σερί σου.' },
      { sel: '#nav-sandbox', title: 'Ελεύθερο εργαστήριο', text: 'Ο δικός σου πάγκος: φτιάχνεις ό,τι θέλεις, χωρίς ασκήσεις.' },
      { sel: '[data-open="settings"]', title: 'Ρυθμίσεις', text: 'Μέγεθος και γραμματοσειρά γραμμάτων, χάρακας ανάγνωσης, φωνή που διαβάζει φωναχτά.' },
      { sel: '.gd-btn', title: 'Εγώ, ο Γκάρντι', text: 'Αν κολλήσεις, πάτα με! Θα σου πω το επόμενο βήμα, χωρίς να σου χαλάσω τη λύση.' }
    ],
    lab: [
      { sel: '#mission', title: 'Η αποστολή', text: 'Η μικρή ιστορία και οι στόχοι της άσκησης. Κάθε στόχος τσεκάρεται μόνος του, μόλις τον πετύχεις.' },
      { sel: '#wiring', title: 'Πρώτα τα καλώδια', text: 'Διάλεξε καλώδιο και πάτα το pin της πλακέτας όπου πρέπει να μπει.' },
      { sel: '#scene', title: 'Η σκηνή', text: 'Εδώ βλέπεις το κύκλωμα να δουλεύει. Πατάς τα εξαρτήματα, π.χ. το κουμπί, και τα βλέπεις από κοντά.' },
      { sel: '.code-mode', title: 'Κείμενο ή μπλοκ', text: 'Γράφεις κώδικα με το πληκτρολόγιο ή τον φτιάχνεις με τουβλάκια. Με τα μπλοκ βλέπεις από κάτω τον ίδιο κώδικα σε κείμενο.' },
      { sel: '#b-run', title: 'Εκτέλεση', text: 'Τρέχει τον κώδικά σου βήμα-βήμα. Η γραμμή που εκτελείται φωτίζεται.' },
      { sel: '#b-check', title: 'Έλεγχος λύσης', text: 'Όταν νομίζεις ότι τελείωσες, πάτα εδώ. Θα δεις ποιοι έλεγχοι πέρασαν και τι λείπει.' },
      { sel: '#info-lesson .say', title: 'Το μάθημα', text: 'Εδώ είναι η θεωρία. Το «Άκουσε» τη διαβάζει φωναχτά και οι υπογραμμισμένες λέξεις εξηγούνται αν τις πατήσεις.' },
      { sel: '.dock-tabs', title: 'Τι κάνει η πλακέτα', text: 'Serial Monitor, μεταβλητές και λογικός αναλυτής: δες τι συμβαίνει μέσα στο πρόγραμμα.' }
    ]
  };
  function startTour(which) {
    if (!window.IoTTour || window.IoTTour.active()) return;
    if (window.IoTGardi) window.IoTGardi.hide();
    window.IoTTour.start(TOURS[which], {
      say: window.IoTSpeak && window.IoTSpeak.supported() ? t => window.IoTSpeak.say(t) : null,
      onDone: finished => {
        P.tours[which] = true;
        save();
        if (window.IoTSpeak) window.IoTSpeak.stop();
        if (finished) gardi(which === 'home' ? 'Όλα έτοιμα! Πάτα «Ξεκίνα» για την πρώτη σου άσκηση.' : 'Καλή επιτυχία! Αν χρειαστείς κάτι, πάτα με.', 'happy');
      }
    });
  }

  // ------------------------------------------------------------ Οθόνη OLED σε μεγέθυνση
  // Ό,τι γράφει ο κώδικας στην οθόνη φαίνεται καθαρά σε ένα «παράθυρο» πάνω δεξιά στη σκηνή.
  function oledPop(items) {
    const wrap = $('#scene');
    const so = S.scene && S.scene.querySelector('#sc-oled');
    if (!wrap || !so) return;
    let pop = $('#oled-pop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'oled-pop';
      pop.className = 'oled-pop';
      pop.innerHTML = `<button type="button" class="op-head" aria-expanded="true" aria-controls="op-body"><span aria-hidden="true">🖥</span> <b>Οθόνη OLED</b><span class="op-sub">ό,τι γράφει ο κώδικας</span><span class="op-tog" aria-hidden="true"></span></button>
        <div class="op-body" id="op-body"><div class="op-screen"><div class="op-px" aria-live="polite"></div></div><p class="op-note">128 × 64 κουκκίδες · εδώ σε διπλάσιο μέγεθος</p></div>`;
      wrap.appendChild(pop);
      const setOpen = open => { S.oledClosed = !open; pop.classList.toggle('closed', !open); if (open) pop.classList.remove('ping'); pop.querySelector('.op-head').setAttribute('aria-expanded', String(open)); };
      pop.querySelector('.op-head').onclick = () => setOpen(!!S.oledClosed);
      so.addEventListener('click', () => setOpen(true));
      pop.classList.toggle('closed', !!S.oledClosed);
    }
    const sig = JSON.stringify(items);
    if (pop.dataset.sig === sig) return;
    const fresh = pop.dataset.sig !== undefined && items.length > 0;
    pop.dataset.sig = sig;
    const px = pop.querySelector('.op-px');
    px.innerHTML = items.length
      ? items.map(t => [...String(t.text)].map((ch, i) => `<span style="left:${(t.x + i * 6 * t.size) * 2}px;top:${t.y * 2}px;font-size:${16 * t.size}px;width:${12 * t.size}px">${esc(ch)}</span>`).join('')).join('')
      : '<em>σβηστή · δεν έχει δείξει τίποτα ακόμα</em>';
    if (fresh) {
      if (S.oledClosed) pop.classList.add('ping');
      else if (motionOK()) { pop.classList.remove('pop'); void pop.offsetWidth; pop.classList.add('pop'); }
    }
  }

  // ------------------------------------------------------------ Γκάρντι, ο βοηθός
  function gardi(text, mood, actions, o) {
    if (!window.IoTGardi || P.settings.gardi === false || (window.IoTTour && window.IoTTour.active())) return;
    window.IoTGardi.say(text, mood, Object.assign({ actions: actions || [] }, o || {}));
  }
  function gardiHome(tr, nxt) {
    if (!window.IoTLearn) return;
    const today = todayStr();
    const mine = new Set(trackLessons(tr.id).map(l => l.id));
    const due = window.IoTLearn.dueIds(P.review, today).filter(id => mine.has(id)).length;
    const dv = window.IoTLearn.dailyView(P.daily, today);
    const first = !S.gardiHello;
    S.gardiHello = true;
    const hello = first ? (dv.streak > 1 ? `Γεια! Σερί ${dv.streak} ημερών 🔥. ` : 'Γεια! Είμαι ο Γκάρντι. ') : '';
    if (due) gardi(`${hello}Σε περιμένουν ${due} ερωτήσεις επανάληψης. Λίγα λεπτά τη μέρα και δεν ξεχνάς τίποτα.`, 'happy', [{ label: 'Ξεκίνα την επανάληψη', run: () => openReview(tr) }]);
    else if (nxt) {
      const room = window.IoTThemes && window.IoTThemes.BY_CHAPTER[nxt.chapter];
      const rn = room && window.IoTHouse ? window.IoTHouse.ROOMS[room].name : '';
      gardi(`${hello}Επόμενη στάση${rn ? `: ${rn}` : ''} · «${nxt.title}».`, 'happy', [{ label: 'Πάμε!', run: () => openTask(nxt.id) }]);
    } else if (first) gardi(`${hello}Τελείωσες όλη τη διαδρομή! Δοκίμασε άλλη γλώσσα ή κάνε επανάληψη.`, 'party');
  }
  function gardiLesson(l) {
    S.gardiStep = 0;
    clearTimeout(S.gardiIdle);
    if (l.sandbox) gardi('Καλώς ήρθες στο ελεύθερο εργαστήριο! Εδώ δεν υπάρχουν έλεγχοι: διάλεξε εξαρτήματα στον πάγκο και γράψε ό,τι θέλεις. Πάτα με για ιδέες.', 'happy');
    else if (l.challenge) gardi('Χωρίς βοήθειες αυτή τη φορά! Τρέξε τον κώδικα, κοίτα τη σκηνή και τον λογικό αναλυτή, και σκέψου τι δεν ταιριάζει με το σύμπτωμα.', 'think');
    else if (S.wiring) gardi('Πρώτα σύνδεσε τα καλώδια! Διάλεξε καλώδιο και πάτα το σωστό pin της πλακέτας.', 'think');
    else if (!P.completed[l.id] && l.objectives && l.objectives.length) gardi(`Σε αυτή την άσκηση: ${l.objectives[0].replace(/^Να /, 'θα ').replace(/\.$/, '')}. Πάτα με για το πρώτο βήμα.`, 'happy');
    // αν περάσουν 90 δευτερόλεπτα χωρίς πρόοδο, προσφέρεται βοήθεια
    const id = l.id;
    S.gardiIdle = setTimeout(() => { if (S.task && S.task.id === id && !P.completed[id]) gardi('Κόλλησες λίγο; Δεν πειράζει, έτσι μαθαίνουμε. Πάτα με για συμβουλή.', 'think'); }, 90000);
  }
  // Πατάς τον Γκάρντι: στο μάθημα λέει το επόμενο βήμα, στην αρχική μια χρήσιμη ιδέα.
  const HOME_TIPS = [
    'Πάτα ένα δωμάτιο στο σπίτι για να δεις τα κεφάλαιά του.',
    'Στην καρτέλα «Η πλακέτα» πατάς κάθε κομμάτι του ESP32 ή του Raspberry Pi και βλέπεις τι είναι.',
    'Οι υπογραμμισμένες λέξεις στο μάθημα εξηγούνται αν τις πατήσεις.',
    'Στις Ρυθμίσεις υπάρχουν γραμματοσειρές για δυσλεξία και χάρακας ανάγνωσης.',
    'Το κουμπί «Άκουσε» διαβάζει φωναχτά το μάθημα, την αποστολή και τα σφάλματα.',
    'Στον «Λογικό αναλυτή» βλέπεις πότε κάθε pin γίνεται HIGH και LOW.',
    'Στο «Ελεύθερο εργαστήριο» (το κλειδί στα αριστερά) φτιάχνεις ό,τι θέλεις, χωρίς ασκήσεις.'
  ];
  function gardiTip() {
    const l = S.task;
    if (!l) { S.gardiHome = ((S.gardiHome || 0) + 1) % HOME_TIPS.length; gardi(HOME_TIPS[S.gardiHome], 'happy', null, { force: true }); return; }
    if (S.wiring) { const t = S.wiring.tasks[S.wiring.sel]; gardi(t ? `Τώρα: ${t.label}. Κοίτα τη σταθερά στην αρχή του κώδικα για τον αριθμό του pin.` : 'Όλα συνδέθηκαν!', 'think', null, { force: true }); return; }
    if (l.sandbox) {
      const ideas = (l.steps || []).length ? l.steps : ['Γράψε κάτι δικό σου και πάτα «Εκτέλεση»!'];
      S.gardiStep = (S.gardiStep || 0) % ideas.length;
      gardi(`Ιδέα: ${ideas[S.gardiStep++]}`, 'happy', [{ label: 'Άλλη ιδέα', run: gardiTip }], { force: true });
      return;
    }
    if (l.challenge) {
      const tips = ['Δεν λέω τη λύση, αλλά: τρέξε τον κώδικα και σύγκρινε τι γίνεται με αυτό που περιγράφει το σύμπτωμα.', 'Ο «Λογικός αναλυτής» δείχνει ποια γραμμή άλλαξε κάθε pin. Ψάξε πού διαφέρει από αυτό που περιμένεις.', 'Πάτα σε κάθε γραμμή: το «Τι κάνει αυτή η γραμμή;» σε βοηθά να τη διαβάσεις προσεκτικά.', 'Οι στόχοι της πρόκλησης δείχνουν τι πρέπει να ξαναδουλέψει. Τρέξε «Έλεγχος λύσης» για να δεις ποιος αποτυγχάνει.'];
      S.gardiStep = (S.gardiStep || 0) % tips.length;
      gardi(tips[S.gardiStep++], 'think', null, { force: true });
      return;
    }
    const steps = l.steps || [];
    if (S.gardiStep < steps.length) {
      const i = S.gardiStep++;
      gardi(`Βήμα ${i + 1} από ${steps.length}: ${steps[i]}`, 'think', i + 1 < steps.length ? [{ label: 'Επόμενο βήμα', run: gardiTip }] : null, { force: true });
    } else {
      gardi('Αυτά ήταν τα βήματα. Θες μια βοήθεια πιο συγκεκριμένη;', 'think', [{ label: 'Ναι, δείξε βοήθεια', run: () => { showNextHint(); showInfo('help'); } }, { label: 'Από την αρχή', run: () => { S.gardiStep = 0; gardiTip(); } }], { force: true });
    }
  }

  // ------------------------------------------------------------ Σύνδεσε μόνος σου τα καλώδια
  // S.wiring: { tasks, done: Set(i), sel, wrong: {i: n} }. Χωρίς παζλ όλα τα καλώδια θεωρούνται συνδεδεμένα.
  function wiredCls(cls) {
    const W = S.wiring;
    if (!W) return true;
    const ts = W.tasks.filter(t => t.cls === cls);
    return ts.every(t => W.done.has(t.i));
  }
  function setupWiring(l, force) {
    const slot = $('#wiring-slot');
    S.wiring = null;
    if (!slot || !window.IoTWiring) return;
    slot.innerHTML = '';
    const tasks = window.IoTWiring.tasksFrom(window.IoTScene.manifest);
    if (!tasks.length) return;
    // πρώτη φορά που βλέπεις ένα καλώδιο (π.χ. το πρώτο LED, το πρώτο κουμπί): το συνδέεις εσύ
    const fresh = tasks.some(t => !P.wired[t.cls]);
    addWiringButton(l);
    if (!fresh && !force) return;
    S.wiring = { tasks, done: new Set(), sel: 0, wrong: {}, board: boardOf(l) };
    tasks.forEach(t => setWireShown(t.i, false));
    renderWiring();
    updateBoard();
  }
  function addWiringButton(l) {
    const ctl = $('#scene .scene-ctl');
    if (!ctl || $('#sc-wire')) return;
    ctl.insertAdjacentHTML('beforeend', `<button class="sc-b sc-3d" id="sc-wire" title="Σύνδεσε μόνος σου τα καλώδια" aria-label="Σύνδεσε μόνος σου τα καλώδια">${icon('plug')}<span>Καλώδια</span></button>`);
    $('#sc-wire').onclick = () => { if (S.runState === 'running') doStop(); setupWiring(l, true); const c = $('#wiring'); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  }
  function setWireShown(i, on, animate) {
    const sc = S.scene;
    if (sc) sc.querySelectorAll(`[data-wi="${i}"]`).forEach(el => el.classList.toggle('unwired', !on));
    if (window.IoTScene3D && window.IoTScene3D.wireVisible) window.IoTScene3D.wireVisible(i, on, animate);
  }
  function pinoutHTML(board) {
    const SC = window.IoTScene;
    const Wg = window.IoTWiring;
    const pin = p => `<button type="button" class="po-pin k-${Wg.kindOf(p)}" data-pin="${p}" title="${Wg.shown(p)}"><i></i><span>${Wg.shown(p)}</span></button>`;
    if (board === 'pi') {
      return `<div class="pinout pi" role="group" aria-label="Header 40 pins του Raspberry Pi"><div class="po-row">${SC.PI_ODD.map(pin).join('')}</div><div class="po-board">Raspberry Pi 5 · header 40 pins · pin 1 αριστερά</div><div class="po-row">${SC.PI_EVEN.map(pin).join('')}</div></div>`;
    }
    return `<div class="pinout esp" role="group" aria-label="Pins του ESP32"><div class="po-row">${SC.LEFT_ROW.map(pin).join('')}</div><div class="po-board"><span class="po-usb">USB</span>ESP32 DevKit · 38 pins</div><div class="po-row">${SC.RIGHT_ROW.map(pin).join('')}</div></div>`;
  }
  function renderWiring(msg, ok) {
    const W = S.wiring;
    const slot = $('#wiring-slot');
    if (!W || !slot) return;
    const all = W.done.size === W.tasks.length;
    const cur = W.tasks[W.sel];
    slot.innerHTML = `<section class="wiring${all ? ' all' : ''}" id="wiring" aria-label="Σύνδεσε τα καλώδια">
      <div class="wr-head">${icon('plug')}<b>Σύνδεσε τα καλώδια</b><span class="wr-count">${W.done.size}/${W.tasks.length}</span>${sayBtn('#wiring', 'τις οδηγίες')}<button class="btn quiet sm" id="wr-auto">Σύνδεσέ τα για μένα</button></div>
      <p class="wr-help">${all ? 'Το κύκλωμα είναι έτοιμο! Τώρα ο κώδικας μπορεί να ανάψει, να διαβάσει και να μετρήσει.' : `Διάλεξε καλώδιο και μετά πάτα το pin της πλακέτας όπου πρέπει να μπει. Βοήθεια: η σταθερά στην αρχή του κώδικα λέει τον αριθμό του GPIO.`}</p>
      <div class="wr-tasks">${W.tasks.map(t => `<button type="button" class="wr-task ${t.cls}${W.done.has(t.i) ? ' done' : ''}${t.i === W.sel && !all ? ' sel' : ''}" data-wt="${t.i}" ${W.done.has(t.i) ? 'disabled' : ''} aria-pressed="${t.i === W.sel}"><i class="wr-dot"></i>${esc(t.label)}${W.done.has(t.i) ? ` → <b>${esc(window.IoTWiring.shown(t.pin))}</b> ✓` : ''}</button>`).join('')}</div>
      ${all ? '' : pinoutHTML(W.board)}
      ${msg ? `<div class="feedback ${ok ? 'ok' : 'no'}" role="status">${esc(msg)}</div>` : ''}
    </section>`;
    slot.querySelectorAll('[data-wt]').forEach(b => { b.onclick = () => { W.sel = Number(b.dataset.wt); renderWiring(); }; });
    const hintPin = cur && (W.wrong[cur.i] || 0) >= 2 ? cur.pin : null;
    slot.querySelectorAll('[data-pin]').forEach(b => {
      if (hintPin && (b.dataset.pin === hintPin || (cur.role === 'gnd' && /^GND/.test(b.dataset.pin)))) b.classList.add('hint');
      b.onclick = () => pickPin(b.dataset.pin);
    });
    $('#wr-auto').onclick = () => { W.tasks.forEach(t => { if (!W.done.has(t.i)) { W.done.add(t.i); setWireShown(t.i, true, true); } }); finishWiring(); };
  }
  function pickPin(p) {
    const W = S.wiring;
    const t = W && W.tasks[W.sel];
    if (!t || W.done.has(t.i)) return;
    const r = window.IoTWiring.judge(t, p, W.board);
    if (r.ok) {
      if (window.IoTGardi) window.IoTGardi.mood('happy', 1400);
      W.done.add(t.i);
      setWireShown(t.i, true, true);
      sfx('tick');
      const next = W.tasks.find(x => !W.done.has(x.i));
      if (next) W.sel = next.i;
      if (!next) { finishWiring(r.msg); return; }
    } else {
      W.wrong[t.i] = (W.wrong[t.i] || 0) + 1;
      sfx('err');
      if (window.IoTGardi) window.IoTGardi.mood('worried', 1600);
      if (W.wrong[t.i] === 2) gardi('Σε βοηθώ: φώτισα με κίτρινο το σωστό pin.', 'think');
    }
    renderWiring(r.msg, r.ok);
    announce(r.msg);
    updateBoard();
  }
  function finishWiring(msg) {
    const W = S.wiring;
    W.tasks.forEach(t => { P.wired[t.cls] = true; });
    save();
    renderWiring(msg ? `${msg} Όλα τα καλώδια μπήκαν!` : 'Όλα τα καλώδια μπήκαν!', true);
    gardi('Τέλεια σύνδεση! Τώρα το κύκλωμα είναι έτοιμο για τον κώδικά σου.', 'happy');
    sfx('win');
    updateBoard();
    setTimeout(() => { if (S.wiring === W) { S.wiring = null; const sl = $('#wiring-slot'); if (sl) sl.innerHTML = ''; } }, 4500);
  }

  // ------------------------------------------------------------ Λογικός αναλυτής
  // Καταγράφει κάθε αλλαγή HIGH/LOW στα pins της πλακέτας με τον εικονικό χρόνο και τη γραμμή κώδικα.
  const SCOPE_SIGS = {
    led: { pin: 2, label: 'LED', pi: 17, esp: 2, cls: 'w-led', hw: 'led' },
    btn: { pin: 15, label: 'Κουμπί', pi: 27, esp: 15, input: 'button', hw: 'button' },
    pir: { pin: 4, label: 'PIR', pi: 4, esp: 4, input: 'pir', hw: 'pir' },
    trig: { pin: 5, label: 'TRIG', pi: 23, esp: 5, hw: 'ultrasonic' },
    echo: { pin: 18, label: 'ECHO', pi: 24, esp: 18, hw: 'ultrasonic' },
    red: { pin: 25, label: 'Κόκκινο', pi: 16, esp: 25, hw: 'traffic' },
    yel: { pin: 26, label: 'Κίτρινο', pi: 20, esp: 26, hw: 'traffic' },
    grn: { pin: 27, label: 'Πράσινο', pi: 21, esp: 27, hw: 'traffic' },
    buz: { pin: 23, label: 'Buzzer', pi: 23, esp: 23, hw: 'buzzer' }
  };
  function scopeSignals(l) {
    const hw = hardwareOf(l);
    const ledShown = hw.includes('led') || !(hw.includes('ultrasonic') || hw.includes('traffic'));
    return Object.keys(SCOPE_SIGS).filter(k => (k === 'led' ? ledShown : hw.includes(SCOPE_SIGS[k].hw)));
  }
  function scopePanelHTML() {
    return `<div class="scope-bar"><span class="muted" style="font-size:0.85rem">Κάθε γραμμή είναι ένα pin: πάνω = HIGH, κάτω = LOW. Οι μικρές κουκκίδες δείχνουν πότε ο κώδικας <i>διάβασε</i> μια είσοδο. Πέρνα το ποντίκι για να δεις ποια γραμμή κώδικα έκανε την αλλαγή.</span>
      <div class="mini-btns" role="group" aria-label="Παράθυρο χρόνου">${[[500, '0,5 δ'], [2000, '2 δ'], [10000, '10 δ']].map(([ms, t]) => `<button class="btn sm" data-sw="${ms}" aria-pressed="false">${t}</button>`).join('')}<button class="btn sm" id="scope-live" aria-pressed="true">Ζωντανά</button></div></div>
      <div class="scope-wrap"><svg class="scope" id="scope" viewBox="0 0 1000 100" preserveAspectRatio="none" role="img" aria-label="Λογικός αναλυτής: HIGH και LOW κάθε pin στον χρόνο"></svg></div>
      <input type="range" id="scope-pos" min="0" max="100" value="100" step="1" aria-label="Μετακίνηση στον χρόνο">
      <p class="scope-read" id="scope-read" aria-live="polite">Πάτα «Εκτέλεση» για να αρχίσει η καταγραφή.</p>`;
  }
  function scopeAttach(b) {
    const keys = scopeSignals(S.task);
    S.scope = { keys, ev: [], reads: [], last: {}, lastRead: {}, win: S.scopeWin || 2000, live: true, end: 0, cursor: null };
    const level = k => { const sg = SCOPE_SIGS[k]; return sg.input ? (b.inputs[sg.input] ? 1 : 0) : (b.outputs[sg.pin] === 1 ? 1 : 0); };
    const rec = (k, line) => {
      const v = level(k);
      if (S.scope.last[k] === v) return;
      S.scope.last[k] = v;
      S.scope.ev.push({ t: b.micros, k, v, line: line || null });
      if (S.scope.ev.length > 6000) S.scope.ev.splice(0, 1000);
    };
    keys.forEach(k => rec(k, null));
    const byPin = {};
    keys.forEach(k => { byPin[SCOPE_SIGS[k].pin] = k; });
    const dw = b.digitalWrite.bind(b);
    b.digitalWrite = (pin, v, line) => { const r = dw(pin, v, line); if (byPin[pin]) rec(byPin[pin], line); return r; };
    const dr = b.digitalRead.bind(b);
    b.digitalRead = (pin, line) => {
      const r = dr(pin, line);
      const k = byPin[pin];
      if (k) {
        if (k === 'echo') rec('echo', line);
        const lr = S.scope.lastRead[k];
        if (lr === undefined || b.micros - lr > 3000) { S.scope.lastRead[k] = b.micros; S.scope.reads.push({ t: b.micros, k, line }); if (S.scope.reads.length > 4000) S.scope.reads.splice(0, 1000); }
      }
      return r;
    };
    S.scope.rec = rec;
    bindScope();
    drawScopeSoon();
    // ζωντανή ανανέωση ανεξάρτητα από το πώς τρέχει η κάθε γλώσσα
    clearInterval(S.scopeT);
    const mine = S.scope;
    S.scopeT = setInterval(() => {
      if (S.scope !== mine || !$('#scope')) { clearInterval(S.scopeT); return; }
      if (S.dockTab === 'scope' && S.runState === 'running') drawScope();
    }, 120);
  }
  function scopeInput(key) {
    if (!S.scope || !S.scope.rec) return;
    const k = key === 'button' ? 'btn' : key === 'pir' ? 'pir' : null;
    if (k && S.scope.keys.includes(k)) S.scope.rec(k, null);
  }
  function bindScope() {
    const svg = $('#scope');
    if (!svg || svg.dataset.bound) return;
    svg.dataset.bound = '1';
    const win = ms => {
      if (S.scope) S.scope.win = ms;
      S.scopeWin = ms;
      app().querySelectorAll('[data-sw]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.sw) === ms)));
      drawScope();
    };
    app().querySelectorAll('[data-sw]').forEach(b => { b.onclick = () => win(Number(b.dataset.sw)); });
    win(S.scopeWin || 2000);
    $('#scope-live').onclick = () => { if (!S.scope) return; S.scope.live = true; $('#scope-pos').value = '100'; drawScope(); };
    $('#scope-pos').oninput = e => {
      const sc = S.scope;
      if (!sc || !S.board) return;
      const now = S.board.micros / 1000;
      const v = Number(e.target.value);
      sc.live = v >= 100;
      sc.end = Math.max(sc.win, (now * v) / 100);
      drawScope();
    };
    const at = e => {
      const r = svg.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left - r.width * 0.12) / (r.width * 0.88)));
    };
    svg.addEventListener('pointermove', e => { if (S.scope) { S.scope.cursor = at(e); drawScope(); } });
    svg.addEventListener('pointerleave', () => { if (S.scope) { S.scope.cursor = null; drawScope(); } });
    svg.addEventListener('click', e => { const line = scopeLineAt(at(e)); if (line) gotoLine(line); });
  }
  let scopeQueued = false;
  function drawScopeSoon() {
    if (scopeQueued) return;
    scopeQueued = true;
    requestAnimationFrame(() => { scopeQueued = false; drawScope(); });
  }
  function scopeView() {
    const sc = S.scope;
    const nowMs = S.board ? S.board.micros / 1000 : 0;
    const end = sc.live ? Math.max(nowMs, sc.win) : Math.min(sc.end, Math.max(nowMs, sc.win));
    return { t0: end - sc.win, t1: end, nowMs };
  }
  function scopeLineAt(fx) {
    const sc = S.scope;
    if (!sc) return null;
    const { t0, t1 } = scopeView();
    const t = (t0 + fx * (t1 - t0)) * 1000;
    let best = null;
    for (const e of sc.ev) { if (e.t <= t && e.line) best = e; if (e.t > t) break; }
    return best && best.line;
  }
  function drawScope() {
    const svg = $('#scope');
    const sc = S.scope;
    if (!svg || !sc) return;
    const keys = sc.keys;
    const RH = 34;
    const H = keys.length * RH + 22;
    const LX = 120;
    const W = 1000;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = (H * 0.9) + 'px';
    const { t0, t1, nowMs } = scopeView();
    const X = t => LX + ((t / 1000 - t0) / (t1 - t0)) * (W - LX);
    let out = '';
    // πλέγμα χρόνου
    const step = sc.win <= 500 ? 100 : sc.win <= 2000 ? 250 : 1000;
    for (let g = Math.ceil(t0 / step) * step; g <= t1; g += step) {
      const x = X(g * 1000);
      out += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H - 18}" class="sg-grid"/><text x="${x.toFixed(1)}" y="${H - 5}" class="sg-tick" text-anchor="middle">${g >= 1000 ? (g / 1000).toLocaleString('el-GR') + ' δ' : g + ' ms'}</text>`;
    }
    const board = S.task ? boardOf(S.task) : 'esp32';
    keys.forEach((k, r) => {
      const sg = SCOPE_SIGS[k];
      const yH = r * RH + 8;
      const yL = r * RH + RH - 6;
      out += `<text x="8" y="${(yH + yL) / 2 + 4}" class="sg-label">${sg.label}</text><text x="${LX - 8}" y="${(yH + yL) / 2 + 4}" class="sg-pin" text-anchor="end">${board === 'pi' ? 'GPIO ' + sg.pi : 'GPIO ' + sg.esp}</text>`;
      const evs = sc.ev.filter(e => e.k === k);
      let v = 0;
      for (const e of evs) { if (e.t / 1000 <= t0) v = e.v; else break; }
      let d = `M${LX},${v ? yH : yL}`;
      let xPrev = LX;
      for (const e of evs) {
        const tm = e.t / 1000;
        if (tm <= t0) continue;
        if (tm > Math.min(t1, nowMs)) break;
        const x = X(e.t);
        d += ` H${x.toFixed(1)} V${e.v ? yH : yL}`;
        v = e.v;
        xPrev = x;
      }
      const xEnd = X(Math.min(t1, nowMs) * 1000);
      if (xEnd > xPrev) d += ` H${xEnd.toFixed(1)}`;
      out += `<path d="${d}" class="sg-wave sg-${k}"/>`;
      for (const rd of sc.reads) { if (rd.k !== k) continue; const tm = rd.t / 1000; if (tm < t0 || tm > t1) continue; out += `<circle cx="${X(rd.t).toFixed(1)}" cy="${yL + 3}" r="1.6" class="sg-read"/>`; }
      out += `<line x1="0" y1="${r * RH + RH + 0.5}" x2="${W}" y2="${r * RH + RH + 0.5}" class="sg-sep"/>`;
    });
    // κέρσορας
    const read = $('#scope-read');
    if (sc.cursor !== null) {
      const tc = t0 + sc.cursor * (t1 - t0);
      const x = LX + sc.cursor * (W - LX);
      out += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H - 18}" class="sg-cursor"/>`;
      if (read) {
        const vals = keys.map(k => { let v = 0; for (const e of sc.ev) { if (e.k !== k) continue; if (e.t / 1000 <= tc) v = e.v; else break; } return `${SCOPE_SIGS[k].label}: <b class="${v ? 'hi' : 'lo'}">${v ? 'HIGH' : 'LOW'}</b>`; }).join(' · ');
        const line = scopeLineAt(sc.cursor);
        const src = line && $('#code') ? $('#code').value.split('\n')[line - 1] : '';
        read.innerHTML = `<b>${(tc / 1000).toLocaleString('el-GR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} δ</b> · ${vals}${line ? `<br>Τελευταία αλλαγή από τη <button class="linklike" data-goto="${line}">γραμμή ${line}</button>: <code>${esc(src.trim())}</code>` : ''}`;
        const g = read.querySelector('[data-goto]');
        if (g) g.onclick = () => gotoLine(Number(g.dataset.goto));
      }
    } else if (read) {
      read.textContent = S.board ? `Χρόνος: ${(nowMs / 1000).toLocaleString('el-GR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} δ · ${sc.ev.length} αλλαγές HIGH/LOW. Πέρνα το ποντίκι πάνω από τις γραμμές.` : 'Πάτα «Εκτέλεση» για να αρχίσει η καταγραφή.';
    }
    svg.innerHTML = out;
    const pos = $('#scope-pos');
    if (pos && sc.live) pos.value = '100';
  }

  // Αντικείμενα του δωματίου που πατιούνται: το κουδούνι πατά το κουμπί, το θερμόμετρο ζεσταίνει.
  function hotAction(key) {
    if (key === 'bell') {
      if (!S.inputs.button) toggleInput('button');
      clearTimeout(S.bellT);
      S.bellT = setTimeout(() => { if (S.inputs.button) toggleInput('button'); }, 700);
    } else if (key === 'heat' || key === 'cool') {
      const tr = $('#temp-range');
      if (!tr) return;
      tr.value = String(Math.max(-10, Math.min(50, Number(tr.value) + (key === 'heat' ? 3 : -3))));
      tr.dispatchEvent(new Event('input', { bubbles: true }));
      sfx('click');
      announce(`Θερμοκρασία ${S.inputs.temp.toFixed(1)} βαθμοί.`);
    }
  }

  function toggleWalk() {
    if (!S.theme || !S.theme.walk) return;
    const on = S.theme.walk();
    const b = $('#walk-toggle');
    if (b) { b.setAttribute('aria-pressed', String(on)); b.querySelector('.value').textContent = on ? '■ Σταμάτα τη βόλτα' : '▶ Βόλτα μόνη της'; }
    sfx('click');
  }

  // Το αυτοκίνητο πλησιάζει αργά ως τα 5 cm, περιμένει και ξαναφεύγει, ώσπου να το σταματήσεις.
  function toggleAutopark() {
    const b = $('#park-toggle');
    if (S.parkT) { clearInterval(S.parkT); S.parkT = null; }
    else {
      let dir = -1;
      let wait = 0;
      S.parkT = setInterval(() => {
        if (!$('#park-toggle')) { clearInterval(S.parkT); S.parkT = null; return; }
        if (wait > 0) { wait--; return; }
        let d = S.inputs.distance + dir * (S.inputs.distance > 40 ? 3 : 1);
        if (d <= 5) { d = 5; dir = 1; wait = 25; }
        if (d >= 120) { d = 120; dir = -1; wait = 10; }
        setDistance(d);
      }, 60);
    }
    if (b) { b.setAttribute('aria-pressed', String(!!S.parkT)); b.querySelector('.value').textContent = S.parkT ? '■ Σταμάτα το αυτοκίνητο' : '▶ Παρκάρει μόνο του'; }
    sfx('click');
  }

  // Γιορτή όταν τελειώνει μια άσκηση: κομφετί πάνω στη σκηνή, σφραγίδα στην αποστολή, ήχος.
  function celebrate() {
    sfx('win');
    const ms = $('#mission');
    if (ms) { ms.classList.remove('won'); void ms.offsetWidth; ms.classList.add('won'); }
    const wrap = $('#scene');
    if (!wrap || !motionOK()) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    box.setAttribute('aria-hidden', 'true');
    const colors = ['#ff5a3c', '#13857f', '#e2b52d', '#5b7fa6', '#3f8f5a', '#c25a22'];
    for (let i = 0; i < 46; i++) {
      const c = document.createElement('i');
      c.style.left = (5 + Math.random() * 90) + '%';
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
      c.style.setProperty('--r', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      c.style.animationDelay = (Math.random() * 0.35).toFixed(2) + 's';
      if (i % 3 === 0) c.style.borderRadius = '50%';
      box.appendChild(c);
    }
    wrap.appendChild(box);
    setTimeout(() => box.remove(), 2600);
  }

  function bindBoard() {
    const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
    on('btn-toggle', () => toggleInput('button'));
    on('pir-toggle', () => toggleInput('pir'));
    on('fault-toggle', () => toggleInput('sensorFault'));
    on('router-toggle', () => toggleInput('router'));
    on('walk-toggle', toggleWalk);
    on('park-toggle', toggleAutopark);
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
    const need = { button: 'w-btn', pir: 'w-pir' }[key];
    if (need && !wiredCls(need)) {
      announce(`Σύνδεσε πρώτα το καλώδιο: ${window.IoTWiring.WIRES[need].label}.`);
      const card = $('#wiring');
      if (card) { card.classList.remove('nudge'); void card.offsetWidth; card.classList.add('nudge'); }
      sfx('err');
      return;
    }
    S.inputs[key] = !S.inputs[key];
    scopeInput(key);
    sfx(key === 'button' && S.inputs.button && S.theme && S.theme.key === 'entrance' ? 'bell' : 'click');
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

  function serialTitle(l) {
    const lang = langOf(l);
    const pi = boardOf(l) === 'pi';
    if (lang === 'python') return pi ? 'Ό,τι τυπώνει το print() στο τερματικό του Pi' : 'Ό,τι τυπώνει το print() στο REPL του ESP32 (MicroPython)';
    if (lang === 'rust') return pi ? 'Ό,τι τυπώνει το println! στο τερματικό του Pi (cargo run)' : 'Ό,τι τυπώνει το println! στο Serial Monitor του ESP32 (espflash monitor)';
    return 'Ό,τι τυπώνει η πλακέτα';
  }
  // Πώς «γεννιέται» το LED σε κάθε γλώσσα (για την κάρτα εισόδων)
  function ledCode() {
    if (!S.task) return '';
    const lang = langOf(S.task);
    const pi = boardOf(S.task) === 'pi';
    if (lang === 'python') return pi ? `LED(${PY.PI_PINS.LED})` : 'Pin(2, Pin.OUT)';
    if (lang === 'rust') return pi ? 'gpio.get(17)?.into_output()' : 'PinDriver::output(gpio2)';
    return '';
  }

  const RS_KW = new Set(['as', 'break', 'const', 'continue', 'else', 'enum', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mut', 'pub', 'return', 'self', 'Self', 'static', 'struct', 'true', 'use', 'where', 'while', 'dyn', 'move', 'ref', 'mod', 'crate', 'super', 'unsafe', 'type', 'trait']);
  const RS_TY = new Set(['i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32', 'u64', 'u128', 'usize', 'f32', 'f64', 'bool', 'char', 'str', 'String', 'Vec', 'Option', 'Result', 'Some', 'None', 'Ok', 'Err', 'Box']);
  function highlightRust(lines) {
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
        if ((m = /^'(?:\\.|[^\\'])'/.exec(rest))) { out += span('str', m[0]); i += m[0].length; continue; }
        if ((m = /^#!?\[[^\]]*\]/.exec(rest))) { out += span('com', m[0]); i += m[0].length; continue; }
        if ((m = /^_{2,}/.exec(rest))) { out += span('blank', m[0]); i += m[0].length; continue; }
        if ((m = /^[A-Za-z_]\w*!?/.exec(rest))) {
          const w = m[0];
          const cls = w.endsWith('!') ? 'fn' : RS_KW.has(w) ? 'kw' : RS_TY.has(w) || /^[A-Z][A-Z0-9_]+$/.test(w) ? 'const' : /^[A-Z]/.test(w) ? 'fn' : null;
          out += cls ? span(cls, w) : esc(w);
          i += w.length;
          continue;
        }
        if ((m = /^\d[\d_]*(\.\d+)?(?:[iuf](?:8|16|32|64|128|size))?/.exec(rest))) { out += span('num', m[0]); i += m[0].length; continue; }
        out += esc(rest[0]);
        i++;
      }
      return out;
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
    const html = modeOf(S.task) === 'config' ? highlightConfig(lines) : isPy() ? highlightPython(lines) : isRust() ? highlightRust(lines) : highlightLines(lines);
    const paused = S.runState === 'paused' && S.machine;
    const exec = paused ? S.machine.currentLine : null;
    const runLine = S.runState === 'running' && S.machine ? S.machine.currentLine : null;
    S.runLineShown = runLine;
    const errLine = S.error ? S.error.line : null;
    const taken = paused && S.machine.lastBranch && S.machine.lastBranch.range ? S.machine.lastBranch.range : null;
    $('#hl').innerHTML = html.map((h, i) => {
      const n = i + 1;
      let cls = '';
      if (taken && n >= taken.from && n <= taken.to) cls += ' taken';
      if (n === exec) cls += ' exec';
      if (n === runLine) cls += ' run';
      if (n === errLine) cls += ' err';
      return `<span class="l${cls}">${h || ' '}</span>`;
    }).join('');
    $('#gutter').innerHTML = lines.map((_, i) => {
      const n = i + 1;
      if (n === errLine) return `<div class="err">✕ ${n}</div>`;
      if (n === exec) return `<div class="exec">▶ ${n}</div>`;
      if (n === runLine) return `<div class="run">${n}</div>`;
      return `<div>${n}</div>`;
    }).join('') + '<div>&nbsp;</div>';
    syncScroll();
  }

  // ---------- Αποστολή: η ιστορία του μαθήματος και οι στόχοι του, που τσεκάρονται μόλις ο κώδικας τους πετυχαίνει.
  // Οι στόχοι είναι οι ίδιοι έλεγχοι συμπεριφοράς με το «Έλεγχος λύσης» (τρέχουν σε δικό τους εικονικό κόσμο).
  function missionHTML(l) {
    if (modeOf(l) !== 'code' || !l.validationTests || !l.validationTests.length) return '';
    const th = window.IoTThemes ? window.IoTThemes.themeOf(l) : null;
    return `<section class="mission" id="mission" aria-label="Αποστολή">
      <div class="ms-head">${icon('flag')}<b>${l.challenge ? 'Πρόκληση · χωρίς βοήθειες' : 'Αποστολή'}</b>${l.challenge ? '<span class="ch-timer" id="ch-timer" aria-label="Χρόνος">0:00</span>' : ''}${sayBtn('#mission', 'την αποστολή')}<span class="ms-count" id="ms-count" aria-live="polite"></span></div>
      ${l.missionStory || th ? `<p class="ms-story">${esc(l.missionStory || th.story)}</p>` : ''}
      <ul class="ms-goals">${l.validationTests.map((t, i) => `<li data-i="${i}"><span class="ms-box" aria-hidden="true"></span><span>${esc(t.name)}</span><span class="sr-only ms-sr"> · δεν έχει γίνει ακόμα</span></li>`).join('')}</ul>
    </section>`;
  }
  function refreshMission(delay) {
    clearTimeout(S.msTimer);
    S.msTimer = setTimeout(evalMission, delay || 0);
  }
  function evalMission() {
    const el = $('#mission');
    const ta = $('#code');
    if (!el || !ta || !S.task) return;
    let res = null;
    try { res = VAL.runTests(ta.value, S.task.validationTests, S.task); } catch (e) { res = null; }
    let n = 0;
    let ticked = false;
    el.querySelectorAll('li').forEach((li, i) => {
      const ok = !!(res && res[i] && res[i].pass);
      if (ok && !li.classList.contains('done') && S.msPrev) { li.classList.add('just'); ticked = true; }
      li.classList.toggle('done', ok);
      li.querySelector('.ms-sr').textContent = ok ? ' · έγινε' : ' · δεν έχει γίνει ακόμα';
      if (ok) n++;
    });
    if (ticked) {
      sfx('tick');
      const left = el.querySelectorAll('li').length - el.querySelectorAll('li.done').length;
      // αν ο έλεγχος πέρασε ήδη, δεν ζητάμε ξανά «Έλεγχος λύσης»
      const finished = S.task && (P.completed[S.task.id] || (S.task.challenge && S.chal && S.chal.done));
      if (left || !finished) gardi(left ? `Μπράβο! Ένας στόχος έγινε. Μένουν ${left}.` : 'Όλοι οι στόχοι της αποστολής έγιναν! Πάτα «Έλεγχος λύσης» για να το επιβεβαιώσεις.', left ? 'happy' : 'party');
    }
    S.msPrev = true;
    const total = el.querySelectorAll('li').length;
    $('#ms-count').textContent = `${n}/${total}`;
    el.classList.toggle('all', n === total);
    setTimeout(() => el.querySelectorAll('li.just').forEach(li => li.classList.remove('just')), 900);
  }

  // Όσο τρέχει το πρόγραμμα: φωτίζεται η γραμμή που εκτελείται τώρα, και ο editor κυλά ώστε να φαίνεται.
  function updateRunLine() {
    const hl = $('#hl');
    const gut = $('#gutter');
    if (!hl || !gut) return;
    const n = S.runState === 'running' && S.machine ? S.machine.currentLine : null;
    if (n === S.runLineShown) return;
    hl.querySelectorAll('.l.run').forEach(e => e.classList.remove('run'));
    gut.querySelectorAll('.run').forEach(e => e.classList.remove('run'));
    S.runLineShown = n;
    if (!n) return;
    if (hl.children[n - 1]) hl.children[n - 1].classList.add('run');
    if (gut.children[n - 1]) gut.children[n - 1].classList.add('run');
    const ta = $('#code');
    const cs = getComputedStyle(ta);
    const lh = parseFloat(cs.lineHeight) || 22;
    const top = (n - 1) * lh + (parseFloat(cs.paddingTop) || 0);
    if (top < ta.scrollTop || top + lh > ta.scrollTop + ta.clientHeight) {
      ta.scrollTop = Math.max(0, top - ta.clientHeight / 3);
      syncScroll();
    }
  }

  // Μικρό Serial Monitor κάτω από τον κώδικα: οι τελευταίες γραμμές και η κατάσταση (τρέχει, παύση…).
  const MM_STATE = { idle: 'ΕΤΟΙΜΟ', running: 'ΤΡΕΧΕΙ', paused: 'ΠΑΥΣΗ', error: 'ΣΦΑΛΜΑ', ended: 'ΤΕΛΕΙΩΣΕ' };
  function updateMini() {
    const box = $('#mini-mon');
    if (!box) return;
    box.dataset.state = S.runState;
    const st = $('#mm-state');
    if (st) st.textContent = MM_STATE[S.runState] || '';
    const body = $('#mm-body');
    const all = S.board ? S.board.serial.filter(l => l.id > S.serialClearedAt) : [];
    const last = all[all.length - 1];
    const sig = all.length + ':' + (last ? last.id + ':' + last.text.length : '0') + ':' + S.runState;
    if (sig === S.miniSig) return;
    S.miniSig = sig;
    body.textContent = all.length ? all.slice(-4).map(l => l.text).join('\n') : (S.board ? '(δεν έχει τυπωθεί τίποτα ακόμα)' : 'Πάτα ▶ για να τρέξει ο κώδικας.');
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
      insertText(ta, isPy() || isRust() ? '    ' : '  ');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      const before = ta.value.slice(0, ta.selectionStart);
      const cur = before.slice(before.lastIndexOf('\n') + 1);
      // Python: μετά από γραμμή που τελειώνει σε «:» η εσοχή μεγαλώνει κατά 4 κενά.
      const opens = isPy() ? /:\s*(#.*)?$/.test(cur) : /\{\s*$/.test(cur);
      const indent = (/^\s*/.exec(cur) || [''])[0] + (opens ? (isPy() || isRust() ? '    ' : '  ') : '');
      e.preventDefault();
      insertText(ta, '\n' + indent);
      return;
    }
    if (e.key !== 'Shift') S.escTab = false;
  }

  function onCodeInput() {
    refreshMission(800);
    const ta = $('#code');
    P.drafts[S.task.id] = ta.value;
    if (S.task.sandbox) P.sandbox.code[P.track] = ta.value;
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
    if (window.IoTSfx && window.IoTSfx.buzzer) window.IoTSfx.buzzer(0);
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
      const opts = { consts: w.consts || {}, board: boardOf(S.task) };
      const c = E.compile(ta.value, opts);
      S.warnings = c.warnings;
      S.board = VAL.createWorld(w, S.inputs);
      scopeAttach(S.board);
      S.machine = new E.Machine(c.program, S.board, opts);
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
    sfx('err');
    gardi(e.line ? `Κάτι δεν πάει καλά στη γραμμή ${e.line}. Διάβασε το κόκκινο κουτί κάτω από τον κώδικα: λέει τι βρέθηκε και τι να κάνεις.` : 'Κάτι δεν πάει καλά. Διάβασε το κόκκινο κουτί κάτω από τον κώδικα.', 'worried', e.line ? [{ label: `Πήγαινε στη γραμμή ${e.line}`, run: () => gotoLine(e.line) }] : null);
    updateAll();
    announce(`Σφάλμα${e.line ? ' στη γραμμή ' + e.line : ''}: ${e.message}`);
  }

  function doRun() {
    if (S.runState === 'running') return;
    refreshMission(0);
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
          VAL.engine(langOf(l)).compile(code, { consts: worldOf(l).consts || {}, board: boardOf(l) });
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
    if (!allPass) gardi(`Πέρασαν ${passCount} από ${res.length} ελέγχους. Κοίτα ποιος έμεινε με ✗: γράφει τι περίμενε και τι βρήκε.`, 'think', [{ label: 'Μια βοήθεια', run: () => { showNextHint(); showInfo('help'); } }]);
    const slot = $('#results-slot');
    if (slot && slot.firstElementChild) slot.firstElementChild.focus();
  }

  function maybeComplete() {
    const l = S.task;
    if (l.challenge) {
      if (!(S.results && S.results.allPass) || !S.chal || S.chal.done) return;
      S.chal.done = true;
      const secs = Math.round((Date.now() - S.chal.t0) / 1000);
      const old = P.challenges[l.challenge] || { n: 0, best: 0 };
      P.challenges[l.challenge] = { n: old.n + 1, best: old.best ? Math.min(old.best, secs) : secs };
      S.chal.secs = secs;
      clearInterval(S.chalT);
      if (window.IoTLearn) P.daily = window.IoTLearn.bump(P.daily, window.IoTLearn.dayStr(new Date()), 1);
      save();
      celebrate();
      setTimeout(() => gardi(`Το πρόβλημα λύθηκε σε ${fmtSecs(secs)}! Είσαι πραγματικός τεχνικός. 🔧`, 'party', null, { force: true }), 400);
      return;
    }
    const quizOk = !l.quiz || P.quizzes[l.id];
    if (S.results && S.results.allPass && quizOk && !P.completed[l.id]) {
      P.completed[l.id] = true;
      setTimeout(() => gardi('Αποστολή εξετελέσθη! Τα κατάφερες. 🎉', 'party', null, { force: true }), 400);
      if (window.IoTLearn) {
        const today = window.IoTLearn.dayStr(new Date());
        window.IoTLearn.enroll(P.review, l.id, today);
        P.daily = window.IoTLearn.bump(P.daily, today, 1);
      }
      celebrate();
      // Τέλος κεφαλαίου: νέα κάρτα ιστορίας και σήμα (μία φορά)
      const n = l.chapter;
      if (chapterDone(n) && window.IoTStories && window.IoTStories[n] && !P.stories[n]) {
        P.stories[n] = true;
        setTimeout(() => showStory(n, true), 450);
      }
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
    if (l.challenge) {
      const c = P.challenges[l.challenge] || {};
      const secs = S.chal && S.chal.secs;
      slot.innerHTML = `<div class="card success" tabindex="-1" style="margin-top:0.75rem"><h3>🔧 Το πρόβλημα λύθηκε!</h3>${list}
        <p>${secs ? `Χρόνος: <b>${fmtSecs(secs)}</b>. ` : ''}${c.best ? `Καλύτερος χρόνος σε αυτό το δωμάτιο: <b>${fmtSecs(c.best)}</b>. ` : ''}Το δωμάτιο «${esc(window.IoTHouse.ROOMS[l.challenge].name)}» πήρε το κλειδί του τεχνικού.</p>
        <div class="btn-row"><button class="btn primary" id="go-house">Πίσω στο σπίτι</button><button class="btn" id="chal-again">Νέο πρόβλημα εδώ</button></div></div>`;
      $('#go-house').onclick = () => { S.homeView = 'house'; renderHome(); };
      $('#chal-again').onclick = () => openChallenge(curTrack(), l.challenge);
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
    const mine = trackLessons(trackOf(l));
    const next = mine[mine.indexOf(l) + 1];
    const chDone = ls.every(x => P.completed[x.id]);
    const story = chDone && window.IoTStories && window.IoTStories[l.chapter];
    const unlockMsg = (chDone && next && next.chapter !== l.chapter ? `<p><strong>Ξεκλείδωσε το Κεφάλαιο ${chNum(next.chapter)}.</strong></p>` : '')
      + (story ? `<p class="story-won">${medal(story, false, 28)} <span>Κέρδισες το σήμα <strong>${esc(story.badge.name)}</strong> και μια κάρτα ιστορίας.</span> <button class="btn sm" id="see-story">Διάβασέ τη</button></p>` : '');
    const allDone = mine.every(x => P.completed[x.id]);
    const nextBtn = next && taskUnlocked(next)
      ? `<button class="btn primary" id="go-next">Επόμενη άσκηση: ${esc(next.title)}</button>`
      : `<button class="btn primary" id="go-map">${allDone ? 'Δες τη βεβαίωση ολοκλήρωσης' : 'Πίσω στον χάρτη'}</button>`;
    slot.innerHTML = `<div class="card success" tabindex="-1" style="margin-top:0.75rem"><h3>Η άσκηση ολοκληρώθηκε</h3>${list}
      <p>${esc(l.explanationOnSuccess)}</p>${unlockMsg}<div class="btn-row">${nextBtn}</div></div>`;
    if ($('#go-next')) $('#go-next').onclick = () => openTask(next.id);
    if ($('#see-story')) $('#see-story').onclick = () => showStory(l.chapter);
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
    S.miniSig = '';
    updateMini();
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
    updateRunLine();
    updateMini();
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
    const b = $('#b-run');
    if (!b) return;
    // Όσο τρέχει, το ▶ γίνεται ■ (διακοπή).
    if (b.classList.contains('stop') !== running) {
      b.classList.toggle('stop', running);
      b.innerHTML = icon(running ? 'stop' : 'play');
      b.title = running ? 'Διακοπή' : 'Εκτέλεση (Ctrl+Enter)';
      b.setAttribute('aria-label', running ? 'Διακοπή' : 'Εκτέλεση');
    }
    $('#b-pause').disabled = !running;
  }

  function doStop() {
    if (S.raf) clearTimeout(S.raf);
    S.raf = null;
    S.gen = null;
    S.runState = 'idle';
    updateAll();
    announce('Η εκτέλεση σταμάτησε.');
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
      const phase = m.lang !== 'cpp' && m.lang
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
        <div class="err-head"><div class="title">${e.line ? `Σφάλμα στη γραμμή ${e.line}` : 'Σφάλμα'}</div>${sayBtn('^.error-box', 'το σφάλμα')}</div>
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
    const ledOn = !!(b && b.led) && wiredCls('w-led') && wiredCls('w-gnd');
    const pin2 = !!(b && b.outputs[2] === 1);
    if (S.scope && S.dockTab === 'scope') drawScopeSoon();
    // κάρτα εισόδων
    const dot = $('#led-dot');
    if (dot) dot.classList.toggle('on', ledOn);
    if ($('#led-text')) $('#led-text').textContent = ledOn ? 'LED αναμμένο' : 'LED σβηστό';
    if ($('#led-mode')) $('#led-mode').textContent = ledCode() ? `${ledCode()} · ${b && b.modes[2] === 3 ? 'έτοιμο' : 'δεν δημιουργήθηκε'}` : 'pinMode: ' + ((b && b.modeName(2)) || 'δεν ορίστηκε');
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
        $('#wifi-text').textContent = isPi() ? 'Δίκτυο: ενσύρματο (Ethernet) · 192.168.1.10' : 'WiFi: ' + (WIFI_TEXT[st] || st) + (b.wifi.pending ? ' (συνδέεται…)' : '');
        const conn = b.net && b.net.connected('device');
        const sess = conn ? b.net.session('device') : null;
        $('#mqtt-text').textContent = 'MQTT: ' + (!b.net ? 'δεν υπάρχει broker' : conn ? `συνδεδεμένο ως ${sess.clientId} · θύρα ${sess.port}${sess.tls ? (sess.insecure ? ' · TLS χωρίς έλεγχο' : ' · TLS') : ' · χωρίς TLS'}` : 'αποσυνδεδεμένο' + (b.mqtt.lastError ? ' · ' + b.mqtt.lastError : ''));
      }
    }
    // σκηνή
    if (sc && modeOf(S.task) === 'code') {
      cls('#sc-led', 'on', ledOn);
      if (S.theme) S.theme.update({ led: ledOn, button: S.inputs.button, pir: S.inputs.pir, running: S.runState === 'running', temp: S.inputs.temp });
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
      const wifiOn = isPi() ? !!b : !!(b && !sleeping && b.wifiStatus() === 3);
      cls('#sc-wifi', 'on', wifiOn);
      cls('#sc-link-wifi', 'on', wifiOn);
      const net = b && b.net;
      const sensorNode = net && [...net.sessions.keys()].some(c => c !== 'device' && c !== 'dashboard');
      cls('#sc-link-esp-pi', 'on', isPi() ? !!sensorNode : !!(net && net.connected('device')));
      cls('#sc-link-pi-dash', 'on', !!(net && net.connected('dashboard')));
      for (const [k, pin] of [['r', 25], ['y', 26], ['g', 27]]) {
        const on = !!(b && b.light(pin)) && wiredCls({ 25: 'w-red', 26: 'w-yel', 27: 'w-grn' }[pin]);
        cls('#sc-tl-' + k, 'on', on);
        cls('#sc-tl-' + k + '-halo', 'on', on);
      }
      // buzzer, servo, LED RGB, OLED (το καθένα «δουλεύει» μόνο αν είναι συνδεδεμένα τα καλώδιά του)
      if (sc.querySelector('#sc-buzzer') || sc.querySelector('#sc-servo') || sc.querySelector('#sc-rgb') || sc.querySelector('#sc-oled')) {
        const running = S.runState === 'running';
        const f = b && b.buzzerFreq && wiredCls('w-buz') ? b.buzzerFreq() : 0;
        cls('#sc-buzzer', 'on', f > 0);
        cls('#sc-w-buz', 'on', f > 0);
        if (window.IoTSfx) window.IoTSfx.buzzer(running ? f : 0);
        const ang = b && b.servo && wiredCls('w-servo') ? b.servo.angle : 90;
        const horn = sc.querySelector('#sc-servo-horn');
        if (horn) horn.setAttribute('d', window.IoTScene.servoHorn(ang));
        const rgbOk = wiredCls('w-rgbr') && wiredCls('w-rgbg') && wiredCls('w-rgbb');
        const [rr, gg, bb] = b && b.rgb && rgbOk ? b.rgb() : [0, 0, 0];
        const lit = rr + gg + bb > 0;
        const col = lit ? `rgb(${Math.max(40, rr)},${Math.max(40, gg)},${Math.max(40, bb)})` : '';
        ['#sc-rgb-dome', '#sc-rgb-body'].forEach(sel => { const el = sc.querySelector(sel); if (el) el.style.fill = col; });
        const halo = sc.querySelector('#sc-rgb-halo');
        if (halo) { halo.style.fill = lit ? `rgb(${rr},${gg},${bb})` : 'transparent'; halo.style.opacity = lit ? String(Math.min(0.55, (rr + gg + bb) / 900 + 0.15)) : '0'; }
        const items = b && b.oled && wiredCls('w-sda') && wiredCls('w-scl') ? b.oled.shown : [];
        const ot = sc.querySelector('#sc-oled-text');
        const sig = JSON.stringify(items);
        if (ot && ot.dataset.sig !== sig) { ot.dataset.sig = sig; ot.innerHTML = window.IoTScene.oledSVG(items); }
        if (ot) oledPop(items);
        if (window.IoTScene3D && window.IoTScene3D.parts) window.IoTScene3D.parts({ buzz: f > 0, servo: ang, rgb: [rr, gg, bb], oled: items });
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
            if (isPi()) {
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
    if (sc && b && isPi() && b.http.log.length !== (S.httpSeen || 0)) {
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
    if (sc && b && isPi() && b.http.server) cls('#sc-link-pi-dash', 'on', true);
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
    const displayValue = m.display || (m.lang === 'python' ? PY.display : IOT_DISPLAY);
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
      <div class="cond">${b.lang === 'python' ? `${b.kw} ${esc(b.cond)}:` : b.lang === 'rust' ? `${b.kw} ${esc(b.cond)} {` : `if (${esc(b.cond)})`}</div>
      ${b.vars.length ? `<div>Τιμές εκείνη τη στιγμή: ${b.vars.map(v => `<code>${esc(v.name)} = ${esc(v.value)}</code>`).join(', ')}</div>` : ''}
      <div>Η συνθήκη είναι <span class="verdict ${b.result}">${b.result ? 'ΑΛΗΘΗΣ (true)' : 'ΨΕΥΔΗΣ (false)'}</span>${what}</div>
    </div>`;
  }

  function updateLoops() {
    const el = $('#loops');
    if (!el) return;
    const m = S.machine;
    if (!m || !m.loopLog.length) {
      el.innerHTML = isRust()
        ? '<p class="muted">Μετά από κάθε γύρο του κύριου βρόχου (το loop { … } της main) εδώ γράφεται μία γραμμή: τι είσοδο είχε, τι τιμές είχαν οι μεταβλητές και τι τυπώθηκε.</p>'
        : isPy()
        ? '<p class="muted">Μετά από κάθε γύρο του κύριου βρόχου (while True: ή loop_forever) εδώ γράφεται μία γραμμή: τι είσοδο είχε, τι τιμές είχαν οι μεταβλητές και τι τυπώθηκε.</p>'
        : '<p class="muted">Μετά από κάθε επανάληψη του loop() εδώ γράφεται μία γραμμή: τι είσοδο είχε, τι τιμές είχαν οι μεταβλητές και τι τυπώθηκε.</p>';
      return;
    }
    const names = (m.loopVarNames ? m.loopVarNames().map(n => ({ name: n })) : m.lang === 'python' ? m.visibleVars().filter(r => r.kind === 'global' && r.value.t !== 'object') : [...m.globals.values()].filter(r => !r.isConst)).map(r => r.name);
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
        <div class="field"><label for="set-ffont">Γραμματοσειρά</label>
          <select id="set-ffont"><option value="noto">Κανονική (Noto Sans)</option><option value="didact">Didact Gothic · απλά σχήματα γραμμάτων, για δυσλεξία</option><option value="ysabeau">Ysabeau Infant · στρογγυλά «α» και «g»</option></select></div>
        <div class="field"><label for="set-letters">Απόσταση γραμμάτων και λέξεων</label>
          <select id="set-letters"><option value="normal">Κανονική</option><option value="wide">Αυξημένη</option><option value="wider">Πολύ αυξημένη</option></select></div>
        <div class="field"><label for="set-voice">Φωνή για την ανάγνωση φωναχτά</label>
          <div class="btn-row"><select id="set-voice"></select><button class="btn sm" id="set-voice-test" type="button">Δοκιμή φωνής</button></div>
          <span class="help" id="set-voice-help"></span></div>
        <label class="check"><input type="checkbox" id="set-english"> Ο κώδικας και οι αγγλικές λέξεις (π.χ. pinMode, GPIO) διαβάζονται με αγγλική φωνή</label>
        <div class="field"><label for="set-rate">Ταχύτητα ανάγνωσης φωναχτά: <output id="set-rate-out"></output></label>
          <input type="range" id="set-rate" min="0.6" max="1.4" step="0.05"></div>
        <div class="field"><label for="set-ruler">Χάρακας ανάγνωσης</label>
          <select id="set-ruler"><option value="off">Κλειστός</option><option value="line">Λωρίδα που ακολουθεί το ποντίκι</option><option value="focus">Λωρίδα και σκίαση στο υπόλοιπο κείμενο</option></select></div>
        <label class="check"><input type="checkbox" id="set-motion"> Μειωμένη κίνηση (χωρίς εφέ και κινούμενες μεταβάσεις)</label>
        <div class="btn-row"><button class="btn sm" type="button" id="set-tour">Δες ξανά την ξενάγηση</button></div>
        <label class="check"><input type="checkbox" id="set-gardi"> Ο Γκάρντι, το ρομποτάκι-βοηθός στη γωνία</label>
        <label class="check"><input type="checkbox" id="set-gardi-voice"> Ο Γκάρντι μιλά και φωναχτά</label>
        <label class="check"><input type="checkbox" id="set-sound"> Ήχοι του παιχνιδιού (κλικ, κουδούνι, επιτυχία)</label>
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
    <dialog id="dlg-story" class="dlg-story" aria-labelledby="dlg-story-title">
      <div class="dlg-head"><h2 id="dlg-story-title">Κάρτα ιστορίας</h2>${sayBtn('#dlg-story-body', 'την ιστορία')}<button class="btn quiet" data-close>Κλείσιμο</button></div>
      <div class="dlg-body" id="dlg-story-body"></div>
    </dialog>
    <dialog id="dlg-collection" class="dlg-wide" aria-labelledby="dlg-collection-title">
      <div class="dlg-head"><h2 id="dlg-collection-title">Η συλλογή σου</h2><button class="btn quiet" data-close>Κλείσιμο</button></div>
      <div class="dlg-body" id="dlg-collection-body"></div>
    </dialog>
    <dialog id="dlg-review" class="dlg-wide" aria-labelledby="dlg-review-title">
      <div class="dlg-head"><h2 id="dlg-review-title">Επανάληψη</h2>${sayBtn('#dlg-review-body', 'την ερώτηση')}<button class="btn quiet" data-close>Κλείσιμο</button></div>
      <div class="dlg-body" id="dlg-review-body"></div>
    </dialog>
    <dialog id="dlg-notes" class="dlg-wide" aria-labelledby="dlg-notes-title">
      <div class="dlg-head"><h2 id="dlg-notes-title">Σημειώσεις</h2>${sayBtn('#dlg-notes-body', 'τις σημειώσεις')}<button class="btn" id="notes-print">Εκτύπωση</button><button class="btn quiet" data-close>Κλείσιμο</button></div>
      <div class="dlg-body" id="dlg-notes-body"></div>
    </dialog>
    <div class="gl-pop" id="gl-pop" role="dialog" aria-label="Ορισμός" hidden></div>
    <div class="ruler" id="ruler" aria-hidden="true" hidden></div>
    <div id="live" class="sr-only" aria-live="polite"></div>`;
    document.body.appendChild(host);
    applySettings(); // ο χάρακας ανάγνωσης υπάρχει μόνο από εδώ και πέρα
    if (window.IoTGardi) { window.IoTGardi.mount(); window.IoTGardi.onClick(gardiTip); applySettings(); }

    host.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => b.closest('dialog').close(); });

    $('#set-theme').onchange = e => { P.settings.theme = e.target.value; applySettings(); save(); };
    $('#set-font').oninput = e => { P.settings.fontScale = Number(e.target.value); $('#set-font-out').textContent = Math.round(P.settings.fontScale * 100) + '%'; applySettings(); save(); };
    $('#set-spacing').onchange = e => { P.settings.lineSpacing = e.target.value; applySettings(); save(); };
    $('#set-motion').onchange = e => { P.settings.reducedMotion = e.target.checked; applySettings(); save(); };
    $('#set-sound').onchange = e => { P.settings.sound = e.target.checked; applySettings(); save(); sfx('tick'); };
    $('#set-tour').onclick = () => { P.tours = {}; save(); $('#dlg-settings').close(); if (S.task) startTour('lab'); else renderHome(); };
    $('#set-gardi').onchange = e => { P.settings.gardi = e.target.checked; applySettings(); save(); if (e.target.checked) gardi('Γεια! Είμαι ξανά εδώ. Πάτα με όποτε θες μια συμβουλή.', 'happy'); };
    $('#set-gardi-voice').onchange = e => { P.settings.gardiVoice = e.target.checked; applySettings(); save(); };
    $('#set-ffont').onchange = e => { P.settings.font = e.target.value; applySettings(); save(); };
    $('#set-ruler').onchange = e => { P.settings.ruler = e.target.value; applySettings(); save(); };
    $('#set-letters').onchange = e => { P.settings.letters = e.target.value; applySettings(); save(); };
    // Φωνή: λίστα με τις ελληνικές φωνές της συσκευής, η πιο φυσική πρώτη
    const fillVoices = () => {
      const sel = $('#set-voice');
      if (!sel || !window.IoTSpeak) return;
      const vs = window.IoTSpeak.voices();
      const cur = window.IoTSpeak.current();
      const B = window.IoTSpeak.BUILTIN;
      sel.innerHTML = `<option value="">Αυτόματα: η πιο φυσική της συσκευής${cur && P.settings.voiceName !== B ? ` (${esc(cur.name)})` : ''}</option>`
        + (window.IoTSpeak.canBuiltin() ? `<option value="${B}">★ Ενσωματωμένη φυσική φωνή (Piper · κατεβαίνει μία φορά, ~50 MB)</option>` : '')
        + vs.map(v => `<option value="${esc(v.name)}">${esc(v.label)} · ${esc(v.quality)}</option>`).join('');
      sel.value = P.settings.voiceName === B || vs.some(v => v.name === P.settings.voiceName) ? P.settings.voiceName : '';
      const best = vs[0];
      const st = window.IoTSpeak.builtinState();
      if (P.settings.voiceName === B && st.state !== 'idle') { $('#set-voice-help').textContent = st.state === 'loading' ? `${st.msg} ${st.pct}%` : st.msg; return; }
      $('#set-voice-help').textContent = !window.IoTSpeak.supported() ? 'Ο browser σου δεν έχει ανάγνωση φωναχτά.'
        : !vs.length ? 'Δεν βρέθηκε ελληνική φωνή στη συσκευή. Πρόσθεσε μία από τις ρυθμίσεις του συστήματος (δες παρακάτω).'
          : best.quality !== 'φυσική' ? 'Η συσκευή έχει μόνο απλές ελληνικές φωνές. Για πιο φυσική: στο Mac, Ρυθμίσεις συστήματος → Προσβασιμότητα → Περιεχόμενο που εκφωνείται → Φωνή συστήματος → Διαχείριση φωνών → Ελληνικά (Melina, βελτιωμένη). Στα Windows, ο Edge έχει τη φυσική φωνή «Athina Online».'
            : 'Πάτα «Δοκιμή φωνής» για να ακούσεις.';
    };
    if (window.IoTSpeak) { window.IoTSpeak.onVoices(fillVoices); window.IoTSpeak.onProgress(fillVoices); }
    $('#set-voice').onchange = e => { P.settings.voiceName = e.target.value; applySettings(); save(); window.IoTSpeak && window.IoTSpeak.say('Γεια σου! Έτσι ακούγεται αυτή η φωνή.'); };
    $('#set-english').onchange = e => { P.settings.readEnglish = e.target.checked; applySettings(); save(); window.IoTSpeak && window.IoTSpeak.say('Για να ανάψει το LED γράφουμε digitalWrite(LED_PIN, HIGH);'); };
    $('#set-voice-test').onclick = () => { if (!window.IoTSpeak || !window.IoTSpeak.say('Γεια σου! Είμαι η φωνή του IoT Guardian. Το LED στο GPIO 2 ανάβει όταν πατάς το κουμπί.')) announce('Ο browser σου δεν μπορεί να διαβάσει φωναχτά.'); };
    $('#set-rate').oninput = e => { P.settings.readRate = Number(e.target.value); $('#set-rate-out').textContent = Math.round(P.settings.readRate * 100) + '%'; applySettings(); save(); };

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

    // Γλωσσάρι: πατάς μια υπογραμμισμένη λέξη και βλέπεις τον ορισμό της δίπλα της.
    const pop = $('#gl-pop');
    const closePop = () => { if (!pop.hidden) { pop.hidden = true; if (pop._from) pop._from.focus(); } };
    document.addEventListener('click', e => {
      const t = e.target.closest('.gl-term');
      if (!t) { if (!e.target.closest('#gl-pop')) closePop(); return; }
      e.preventDefault();
      const g = GLOSSARY.find(x => x.term.toLowerCase() === t.dataset.term.toLowerCase());
      if (!g) return;
      pop.innerHTML = `<div class="gp-head"><b>${esc(g.term)}</b>${sayBtn('#gl-pop', 'τον ορισμό')}<button class="btn quiet sm" id="gp-close" aria-label="Κλείσιμο">✕</button></div><p>${esc(g.def)}</p>`;
      pop.hidden = false;
      pop._from = t;
      const r = t.getBoundingClientRect();
      const w = Math.min(320, innerWidth - 24);
      pop.style.width = w + 'px';
      pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + scrollX - 20)) + 'px';
      pop.style.top = (r.bottom + scrollY + 8) + 'px';
      $('#gp-close').onclick = closePop;
      $('#gp-close').focus();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
    // Σημειώσεις κεφαλαίου
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-notes]');
      if (!b) return;
      e.preventDefault();
      openNotes(Number(b.dataset.notes));
    });
    $('#notes-print').onclick = () => {
      document.documentElement.classList.add('print-notes');
      const off = () => { document.documentElement.classList.remove('print-notes'); removeEventListener('afterprint', off); };
      addEventListener('afterprint', off);
      window.print();
    };
    // Χάρακας ανάγνωσης: μια λωρίδα ακολουθεί τη γραμμή που διαβάζεις
    const ruler = $('#ruler');
    addEventListener('pointermove', e => {
      if (ruler.hidden || e.pointerType === 'touch') return;
      ruler.style.transform = `translateY(${Math.round(e.clientY - ruler.offsetHeight / 2)}px)`;
    }, { passive: true });

    // «Άκουσε»: ανάγνωση φωναχτά (όποιο κομμάτι κι αν είναι, ακόμα και μέσα σε dialog)
    document.addEventListener('click', e => {
      const sb = e.target.closest('[data-say]');
      if (!sb) return;
      e.preventDefault();
      e.stopPropagation();
      const sel = sb.dataset.say;
      const el = sel[0] === '^' ? sb.closest(sel.slice(1)) : document.querySelector(sel);
      if (!window.IoTSpeak.toggle(el, sb)) { announce('Ο browser σου δεν μπορεί να διαβάσει φωναχτά.'); return; }
      // Η πρώτη φορά με απλή/ρομποτική φωνή: ο Γκάρντι προτείνει την ενσωματωμένη φυσική φωνή
      const cv = window.IoTSpeak.current();
      if (!S.voiceNudged && window.IoTSpeak.canBuiltin() && P.settings.voiceName !== window.IoTSpeak.BUILTIN && (!cv || cv.quality !== 'φυσική')) {
        S.voiceNudged = true;
        gardi('Η φωνή ακούγεται ρομποτική; Έχω μια πιο φυσική ελληνική φωνή μέσα στο παιχνίδι. Κατεβαίνει μία φορά (περίπου 50 MB).', 'think', [{ label: 'Ναι, βάλ\' την', run: () => { P.settings.voiceName = window.IoTSpeak.BUILTIN; applySettings(); save(); window.IoTSpeak.stop(); gardi('Κατεβάζω τη φωνή… Θα σου μιλήσω μόλις είναι έτοιμη.', 'happy'); window.IoTSpeak.prepareBuiltin().then(ok => { if (ok) window.IoTSpeak.say('Γεια σου! Αυτή είναι η νέα μου φωνή.'); }); } }], { force: true, ttl: 15000 });
      }
      if (!window.IoTSpeak.hasGreek()) announce('Δεν βρέθηκε ελληνική φωνή στη συσκευή· η ανάγνωση μπορεί να ακούγεται με ξένη προφορά.');
    }, true);
    document.querySelectorAll('dialog').forEach(d => d.addEventListener('close', () => { if (d.querySelector('.say.on')) window.IoTSpeak.stop(); }));

    document.addEventListener('click', e => {
      const b = e.target.closest('[data-open]');
      if (!b) return;
      const which = b.dataset.open;
      if (which === 'collection') { openCollection(); return; }
      if (which === 'settings') {
        $('#set-theme').value = P.settings.theme;
        $('#set-font').value = String(P.settings.fontScale);
        $('#set-font-out').textContent = Math.round(P.settings.fontScale * 100) + '%';
        $('#set-spacing').value = P.settings.lineSpacing;
        $('#set-motion').checked = P.settings.reducedMotion;
        $('#set-sound').checked = P.settings.sound !== false;
        $('#set-ffont').value = P.settings.font || 'noto';
        $('#set-gardi').checked = P.settings.gardi !== false;
        $('#set-english').checked = P.settings.readEnglish !== false;
        $('#set-gardi-voice').checked = !!P.settings.gardiVoice;
        $('#set-ruler').value = P.settings.ruler || 'off';
        $('#set-letters').value = P.settings.letters || 'normal';
        fillVoices();
        $('#set-rate').value = String(P.settings.readRate || 0.9);
        $('#set-rate-out').textContent = Math.round((P.settings.readRate || 0.9) * 100) + '%';
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
