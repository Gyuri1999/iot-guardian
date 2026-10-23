/*
 * IoT Guardian — ανάγνωση φωναχτά (Web Speech API, ελληνική φωνή της συσκευής).
 * Διαβάζει ένα κομμάτι της σελίδας παράγραφο-παράγραφο και φωτίζει την παράγραφο που ακούγεται,
 * ώστε το μάτι να ακολουθεί τη φωνή. Δεν στέλνει κείμενο πουθενά: η φωνή είναι του λειτουργικού / του browser.
 *
 * Η ποιότητα εξαρτάται από τις φωνές της συσκευής. Διαλέγουμε αυτόματα την πιο φυσική ελληνική φωνή
 * (Natural / Online / Premium / Enhanced / Google) αντί για τις μικρές «compact» φωνές που ακούγονται ρομποτικές,
 * και ο παίκτης μπορεί να διαλέξει άλλη στις ρυθμίσεις.
 *   IoTSpeak.supported()          υπάρχει σύνθεση ομιλίας στον browser;
 *   IoTSpeak.toggle(el, btn)      ξεκινά ή σταματά την ανάγνωση του el
 *   IoTSpeak.say(text)            λέει ένα σύντομο κείμενο (π.χ. ο Γκάρντι, η δοκιμή φωνής)
 *   IoTSpeak.stop()
 *   IoTSpeak.setRate(r)           0.6 … 1.4
 *   IoTSpeak.voices()             οι ελληνικές φωνές, καλύτερη πρώτη: [{ name, label, quality }]
 *   IoTSpeak.setVoiceName(name)   '' = αυτόματα η καλύτερη
 *   IoTSpeak.current()            η φωνή που χρησιμοποιείται τώρα
 *
 * Ενσωματωμένη φυσική φωνή (προαιρετική): το Piper, μια ανοιχτή νευρωνική φωνή, τρέχει ΜΕΣΑ στον browser
 * (WebAssembly). Κατεβαίνει μία φορά (~50 MB) και μένει αποθηκευμένη· το κείμενο δεν φεύγει από τον υπολογιστή.
 *   IoTSpeak.BUILTIN              όνομα «φωνής» για setVoiceName
 *   IoTSpeak.prepareBuiltin()     κατεβάζει και ετοιμάζει τη φωνή από πριν
 *   IoTSpeak.onProgress(f)        f({ state: 'loading'|'ready'|'error', pct, msg })
 */
(function (root) {
  'use strict';

  const synth = root.speechSynthesis;
  let rate = 0.9;
  let wanted = '';   // όνομα φωνής που διάλεξε ο παίκτης ('' = αυτόματα)
  let voice = null;
  let run = null;    // { blocks, i, btn }
  const listeners = [];

  // ------------------------------------------------------------ ενσωματωμένη φωνή (Piper)
  const BUILTIN = 'builtin:piper-el';
  const PIPER_VOICE = 'el_GR-rapunzelina-low';
  const PIPER_URL = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm';
  const ORT_WASM = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';
  let piper = null;      // Promise<TtsSession>
  let piperState = { state: 'idle', pct: 0, msg: '' };
  let audio = null;      // το <audio> που παίζει τώρα
  let gen = 0;           // κάθε stop() ακυρώνει ό,τι ετοιμαζόταν
  const progress = [];
  const setPiper = st => { piperState = Object.assign({}, piperState, st); progress.forEach(f => f(piperState)); };
  const canBuiltin = () => typeof root.WebAssembly === 'object' && typeof root.fetch === 'function' && typeof root.Audio === 'function';
  const useBuiltin = () => wanted === BUILTIN && canBuiltin() && piperState.state !== 'error';
  function prepareBuiltin() {
    if (piper) return piper;
    setPiper({ state: 'loading', pct: 0, msg: 'Κατεβαίνει η φωνή…' });
    piper = import(PIPER_URL).then(tts => tts.TtsSession.create({
      voiceId: PIPER_VOICE,
      // το πακέτο του jsdelivr φέρνει το onnxruntime-web 1.27.0: τα wasm του πρέπει να είναι της ίδιας έκδοσης
      wasmPaths: Object.assign({}, tts.TtsSession.WASM_LOCATIONS, { onnxWasm: ORT_WASM }),
      progress: p => { if (p && p.total) setPiper({ state: 'loading', pct: Math.round((p.loaded * 100) / p.total), msg: 'Κατεβαίνει η φωνή…' }); }
    })).then(session => { setPiper({ state: 'ready', pct: 100, msg: 'Η φυσική φωνή είναι έτοιμη.' }); return session; })
      .catch(e => { piper = null; setPiper({ state: 'error', pct: 0, msg: 'Δεν κατέβηκε η φωνή (χρειάζεται ίντερνετ την πρώτη φορά). Χρησιμοποιείται η φωνή της συσκευής.' }); throw e; });
    return piper;
  }
  // Συνθέτει μια πρόταση σε ήχο (Blob URL)
  function synth1(text) { return prepareBuiltin().then(sess => sess.predict(text)).then(blob => URL.createObjectURL(blob)); }
  // Παίζει τις προτάσεις με τη σειρά· ετοιμάζει την επόμενη όσο ακούγεται η τρέχουσα.
  function playBuiltin(parts, done) {
    const my = gen;
    let k = 0;
    let nextUrl = parts.length ? synth1(parts[0]) : null;
    const step = () => {
      if (my !== gen) return;
      if (k >= parts.length) { if (done) done(); return; }
      const cur = nextUrl;
      k++;
      nextUrl = k < parts.length ? synth1(parts[k]) : null;
      cur.then(url => {
        if (my !== gen) { URL.revokeObjectURL(url); return; }
        audio = new Audio(url);
        audio.playbackRate = rate;
        if ('preservesPitch' in audio) audio.preservesPitch = true;
        audio.onended = () => { URL.revokeObjectURL(url); step(); };
        audio.onerror = () => { URL.revokeObjectURL(url); step(); };
        audio.play().catch(() => step());
      }, () => {
        // η φωνή δεν φόρτωσε: συνεχίζουμε με τη φωνή της συσκευής
        if (my !== gen) return;
        if (synth) { let j = k - 1; const one = () => { if (my !== gen) return; if (j >= parts.length) { if (done) done(); return; } synth.speak(utter(parts[j++], one)); }; one(); } else if (done) done();
      });
    };
    step();
  }

  const isGreek = v => /^el([-_]|$)/i.test(v.lang);
  // Βαθμός «φυσικότητας» από το όνομα της φωνής (οι browsers δεν δίνουν κάτι καλύτερο).
  function score(v) {
    const n = `${v.name} ${v.voiceURI || ''}`;
    let s = 0;
    if (/natural|neural|online/i.test(n)) s += 60;          // Edge / Windows: Microsoft Athina Online (Natural)
    if (/premium|enhanced|βελτιωμ|siri/i.test(n)) s += 50;  // macOS / iOS: βελτιωμένες φωνές
    if (/google/i.test(n)) s += 40;                          // Chrome: Google Ελληνικά
    if (/compact|espeak|e-speak/i.test(n)) s -= 50;          // μικρές, ρομποτικές φωνές
    if (/el[-_]GR/i.test(v.lang)) s += 5;
    if (v.localService) s += 2;
    return s;
  }
  const quality = v => { const s = score(v); return s >= 40 ? 'φυσική' : s >= 0 ? 'απλή' : 'ρομποτική'; };

  function greekVoices() {
    if (!synth) return [];
    return synth.getVoices().filter(isGreek).sort((a, b) => score(b) - score(a));
  }
  function pickVoice() {
    const el = greekVoices();
    voice = (wanted && el.find(v => v.name === wanted)) || el[0] || null;
    return voice;
  }
  if (synth) {
    pickVoice();
    if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', () => { pickVoice(); listeners.forEach(f => f()); });
  }

  // Προφορά: ό,τι διαβάζεται άσχημα γράμμα-γράμμα ή με αγγλική προφορά, γράφεται όπως ακούγεται.
  const SAY = [
    [/\bESP32\b/g, 'ι ες πι τριάντα δύο'], [/\bESP-WROOM-32\b/g, 'ι ες πι ρουμ τριάντα δύο'],
    [/\bRaspberry Pi\b/g, 'Ράσμπερι Πάι'], [/\bPi\b/g, 'Πάι'],
    [/\bGPIO\b/g, 'τζι πι άι όου'], [/\bLEDs?\b/g, 'λεντ'], [/\bPIR\b/g, 'πι άι αρ'],
    [/\bMQTT\b/g, 'εμ κιου τι τι'], [/\bWi-?Fi\b/gi, 'γουάι φάι'], [/\bUSB-C\b/g, 'γιου ες μπι σι'], [/\bUSB\b/g, 'γιου ες μπι'],
    [/\bTLS\b/g, 'τι ελ ες'], [/\bSSH\b/g, 'ες ες έιτς'], [/\bHTTP\b/g, 'έιτς τι τι πι'], [/\bJSON\b/g, 'τζέισον'],
    [/\bHC-SR04\b/g, 'έιτς σι ες αρ ζίρο φορ'], [/\bDHT22\b/g, 'ντι έιτς τι είκοσι δύο'], [/\bCPU\b/g, 'σι πι γιου'],
    [/C\+\+/g, 'σι πλας πλας'], [/\bPython\b/g, 'Πάιθον'], [/\bMicroPython\b/g, 'Μάικρο Πάιθον'], [/\bRust\b/g, 'Ραστ'],
    [/\bArduino\b/g, 'Αρντουίνο'], [/\bSerial Monitor\b/g, 'Σίριαλ Μόνιτορ'], [/\bSerial\b/g, 'Σίριαλ'],
    [/\bbroker\b/g, 'μπρόκερ'], [/\bdashboard\b/g, 'ντάσμπορντ'], [/\bloop\(\)/g, 'λουπ'], [/\bsetup\(\)/g, 'σέταπ'],
    [/\bHIGH\b/g, 'χάι'], [/\bLOW\b/g, 'λόου'], [/\btrue\b/g, 'τρου'], [/\bfalse\b/g, 'φολς'],
    [/\bms\b/g, 'χιλιοστά του δευτερολέπτου'], [/\bµs\b/g, 'μικροδευτερόλεπτα'], [/\bcm\b/g, 'εκατοστά'],
    [/\bmA\b/g, 'μιλιαμπέρ'], [/\b3,3 ?V\b/g, 'τρία κόμμα τρία βολτ'], [/\b(\d+) ?V\b/g, '$1 βολτ']
  ];
  function clean(text) {
    // δεκαδικοί με κόμμα, όπως διαβάζονται στα ελληνικά: 22.5 → 22,5 («είκοσι δύο κόμμα πέντε»)
    let t = String(text || '').replace(/(\d)\.(\d)/g, '$1,$2');
    for (const [re, w] of SAY) t = t.replace(re, w);
    return t
      .replace(/→/g, ', άρα ')
      .replace(/[·•|]/g, ', ')
      .replace(/≥|>=/g, ' μεγαλύτερο ή ίσο ')
      .replace(/≤|<=/g, ' μικρότερο ή ίσο ')
      .replace(/==/g, ' ίσον ')
      .replace(/!=/g, ' διάφορο ')
      .replace(/°C/g, ' βαθμούς Κελσίου')
      .replace(/%/g, ' τοις εκατό')
      .replace(/([A-Za-z_]\w*)\(\)/g, '$1')                   // led.on() → led.on
      .replace(/[«»"“”`{}[\]<>#*_~]/g, ' ')                     // σύμβολα που η φωνή διαβάζει δυνατά
      .replace(/[\u{1F000}-\u{1FAFF}☀-➿]/gu, ' ')     // emoji
      .replace(/\s*([,.;:!?])(?!\d)\s*/g, '$1 ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Μικρά κομμάτια (πρόταση-πρόταση): πιο φυσικές παύσεις, και ο Chrome δεν «κόβει» τις μεγάλες εκφωνήσεις.
  function chunks(text) {
    const out = [];
    for (const s of text.split(/(?<=[.!;?])\s+/)) {
      if (s.length <= 180) { if (s.trim()) out.push(s.trim()); continue; }
      let cur = '';
      for (const part of s.split(/(?<=,)\s+/)) {
        if ((cur + ' ' + part).length > 180 && cur) { out.push(cur.trim()); cur = part; } else cur += ' ' + part;
      }
      if (cur.trim()) out.push(cur.trim());
    }
    return out;
  }
  function utter(text, onend) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (voice && voice.lang) || 'el-GR';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1;
    u.onend = onend;
    u.onerror = onend;
    return u;
  }

  // Τα «φύλλα» του κειμένου: παράγραφοι, στοιχεία λίστας, τίτλοι (όχι κώδικας και κουμπιά).
  const BLOCK = 'h1,h2,h3,h4,p,li,dt,dd,.title,.kind-tag,figcaption';
  function blocksOf(el) {
    const all = [...el.querySelectorAll(BLOCK)].filter(b => !b.closest('pre, button, .say, [hidden]') && !b.querySelector(BLOCK) && b.offsetParent !== null);
    return all.length ? all : [el];
  }
  function speechText(b) {
    const c = b.cloneNode(true);
    c.querySelectorAll('button, .say, svg, .ms-box').forEach(x => x.remove());
    return clean(c.textContent);
  }

  function setBtn(btn, on) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('on', on);
    const t = btn.querySelector('.say-t');
    if (t) t.textContent = on ? 'Σταμάτα' : 'Άκουσε';
  }

  function stop() {
    if (run) {
      const r = run;
      run = null;
      r.blocks.forEach(b => b.classList.remove('reading'));
      setBtn(r.btn, false);
    }
    gen++;
    if (audio) { try { audio.pause(); } catch (e) { /* ήδη σταματημένο */ } audio = null; }
    if (synth) synth.cancel();
  }

  function next(r) {
    if (run !== r) return;
    r.blocks.forEach(b => b.classList.remove('reading'));
    if (r.i >= r.blocks.length) { stop(); return; }
    const b = r.blocks[r.i++];
    const parts = chunks(speechText(b));
    if (!parts.length) { next(r); return; }
    b.classList.add('reading');
    try { b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* παλιοί browsers */ }
    if (useBuiltin()) { playBuiltin(parts, () => { if (run === r) next(r); }); return; }
    let k = 0;
    const one = () => {
      if (run !== r) return;
      if (k >= parts.length) { next(r); return; }
      synth.speak(utter(parts[k++], one));
    };
    one();
  }

  // Επιστρέφει false αν δεν μπορεί να διαβάσει (ο browser δεν έχει σύνθεση ομιλίας).
  function toggle(el, btn) {
    if (!el || (!synth && !useBuiltin())) return false;
    const same = run && run.btn === btn;
    stop();
    if (same) return true;
    pickVoice();
    run = { blocks: blocksOf(el), i: 0, btn };
    setBtn(btn, true);
    next(run);
    return true;
  }

  // Σύντομο κείμενο (Γκάρντι, δοκιμή φωνής): σταματά ό,τι ακουγόταν πριν.
  function say(text) {
    if (useBuiltin()) { stop(); playBuiltin(chunks(clean(text)), null); return true; }
    if (!synth || typeof root.SpeechSynthesisUtterance !== 'function') return false;
    stop();
    pickVoice();
    chunks(clean(text)).forEach(p => synth.speak(utter(p, null)));
    return true;
  }

  root.IoTSpeak = {
    supported: () => (!!synth && typeof root.SpeechSynthesisUtterance === 'function') || canBuiltin(),
    hasGreek: () => useBuiltin() || !!(voice || pickVoice()),
    BUILTIN,
    canBuiltin,
    prepareBuiltin: () => prepareBuiltin().catch(() => null),
    builtinState: () => piperState,
    onProgress: f => { progress.push(f); },
    toggle,
    say,
    stop,
    clean,
    setRate: r => { rate = Math.max(0.6, Math.min(1.4, Number(r) || 0.9)); },
    setVoiceName: n => { wanted = typeof n === 'string' ? n : ''; if (wanted === BUILTIN && canBuiltin()) { if (piperState.state === 'error') setPiper({ state: 'idle' }); prepareBuiltin().catch(() => null); } pickVoice(); },
    voices: () => greekVoices().map(v => ({ name: v.name, label: `${v.name}${v.localService ? '' : ' · online'}`, quality: quality(v) })),
    current: () => (useBuiltin() ? { name: 'Ενσωματωμένη φυσική φωνή (Piper)', quality: 'φυσική' } : pickVoice() ? { name: voice.name, quality: quality(voice) } : null),
    onVoices: f => { listeners.push(f); },
    speaking: () => !!run
  };
})(typeof window !== 'undefined' ? window : globalThis);
