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
 *
 * Κώδικας και αγγλικές λέξεις (pinMode(LED_PIN, OUTPUT), GPIO, MQTT…) διαβάζονται με αγγλική φωνή, αν υπάρχει,
 * γιατί με ελληνική προφορά δεν βγάζουν νόημα. Κλείνει με IoTSpeak.setEnglish(false).
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
  // Το μοντέλο της Piper δεν έχει τον ήχο [ç] (χ πριν από ε/ι/η/υ: «έχει», «όχι», «χέρι») και «σπάει» σε αυτές τις λέξεις.
  // Μια τελεία κάτω από το χ (U+0323) αλλάζει τον φωνολογικό κανόνα· η λέξη ακούγεται με σκληρό χ, αλλά ακούγεται.
  // Αριθμοί από 1000 και πάνω: το espeak τους κάνει «χίλια…» και ξαναβγάζει τον ήχο [ç]. Τους γράφουμε εμείς με λέξεις.
  const U = ['', 'ένα', 'δύο', 'τρία', 'τέσσερα', 'πέντε', 'έξι', 'επτά', 'οκτώ', 'εννέα'];
  const TEEN = ['δέκα', 'έντεκα', 'δώδεκα', 'δεκατρία', 'δεκατέσσερα', 'δεκαπέντε', 'δεκαέξι', 'δεκαεπτά', 'δεκαοκτώ', 'δεκαεννέα'];
  const TENS = ['', '', 'είκοσι', 'τριάντα', 'σαράντα', 'πενήντα', 'εξήντα', 'εβδομήντα', 'ογδόντα', 'ενενήντα'];
  const HUND = ['', 'εκατό', 'διακόσια', 'τριακόσια', 'τετρακόσια', 'πεντακόσια', 'εξακόσια', 'επτακόσια', 'οκτακόσια', 'εννιακόσια'];
  function under1000(n, fem) {
    const h = Math.floor(n / 100), r = n % 100, w = [];
    if (h) w.push(h === 1 && r ? 'εκατόν' : fem && h > 1 ? HUND[h].replace(/α$/, 'ες') : HUND[h]);
    if (r >= 10 && r < 20) w.push(TEEN[r - 10]);
    else {
      if (r >= 20) w.push(TENS[Math.floor(r / 10)]);
      const u = r % 10;
      if (u) w.push(fem && u === 3 ? 'τρεις' : fem && u === 4 ? 'τέσσερις' : fem && u === 1 ? 'μία' : U[u]);
    }
    return w.join(' ');
  }
  function bigNumber(n) {
    const th = Math.floor(n / 1000), r = n % 1000;
    const head = th === 1 ? 'χίλια' : `${under1000(th, true)} χιλιάδες`;
    return r ? `${head} ${under1000(r, false)}` : head;
  }
  const forPiper = t => t.replace(/\b\d{4,6}\b/g, m => bigNumber(Number(m))).replace(/χ(?=[ειηυίέήύϊΐϋΰ]|αι|οι|ει)/gi, 'χ\u0323').replace(/Χ(?=[ΕΙΗΥΈΊΉΎ])/g, 'Χ\u0323');
  // Αν μια πρόταση αποτύχει, ξαναδοκιμάζει μόνο με ελληνικά γράμματα και αριθμούς πριν την προσπεράσει.
  function synth1(text) {
    return prepareBuiltin()
      .then(sess => sess.predict(forPiper(text)).catch(() => sess.predict(forPiper(text.replace(/[^\p{Script=Greek}\d\s,.;!?·\u0323]/gu, ' ')))))
      .then(blob => URL.createObjectURL(blob));
  }
  // Παίζει ένα έτοιμο κομμάτι ήχου (Blob URL) και μετά καλεί το step.
  function playUrl(urlP, my, step, fallbackText) {
    urlP.then(url => {
      if (my !== gen) { URL.revokeObjectURL(url); return; }
      audio = new Audio(url);
      audio.playbackRate = rate;
      if ('preservesPitch' in audio) audio.preservesPitch = true;
      audio.onended = () => { URL.revokeObjectURL(url); step(); };
      audio.onerror = () => { URL.revokeObjectURL(url); step(); };
      audio.play().catch(() => step());
    }, () => {
      // η ενσωματωμένη φωνή δεν φόρτωσε: αυτό το κομμάτι το λέει η φωνή της συσκευής
      if (my !== gen) return;
      if (synth) synth.speak(utter(fallbackText, step)); else step();
    });
  }
  // Παίζει τα κομμάτια με τη σειρά: τα ελληνικά με την ελληνική φωνή (ενσωματωμένη ή της συσκευής),
  // τα αγγλικά (κώδικας, ονόματα) με αγγλική φωνή. Ετοιμάζει από πριν τα επόμενα ελληνικά κομμάτια.
  function playPieces(list, done) {
    const my = gen;
    const builtin = useBuiltin();
    const pre = new Map();
    const prefetch = from => { if (!builtin) return; for (let x = from; x < list.length && x < from + 2; x++) if (!list[x].en && !pre.has(x)) pre.set(x, synth1(list[x].t)); };
    let k = 0;
    const step = () => {
      if (my !== gen) return;
      if (k >= list.length) { if (done) done(); return; }
      const j = k++;
      const p = list[j];
      prefetch(j + 1);
      if (p.en && enVoice) { synth.speak(utterEn(p.t, step)); return; }
      if (builtin) { const u = pre.get(j) || synth1(p.t); pre.delete(j); playUrl(u, my, step, p.t); return; }
      if (synth) synth.speak(utter(p.t, step)); else step();
    };
    prefetch(0);
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
    if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', () => { pickVoice(); pickEnglish(); listeners.forEach(f => f()); });
  }

  // ------------------------------------------------------------ κώδικας και αγγλικές λέξεις με αγγλική φωνή
  let english = true;   // ρύθμιση: ο κώδικας διαβάζεται στα αγγλικά
  let enVoice = null;
  function pickEnglish() {
    if (!synth) return null;
    const en = synth.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang));
    const sc = v => score(v) + (/en[-_]US/i.test(v.lang) ? 4 : /en[-_]GB/i.test(v.lang) ? 3 : 0) + (/samantha|daniel|karen|alex|google us/i.test(v.name) ? 20 : 0);
    enVoice = en.sort((a, b) => sc(b) - sc(a))[0] || null;
    return enVoice;
  }
  function utterEn(text, onend) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = enVoice.lang;
    u.voice = enVoice;
    u.rate = Math.min(1.3, rate * 1.05);
    u.onend = onend;
    u.onerror = onend;
    return u;
  }
  // Μια «αγγλική» περιοχή: λέξεις/κώδικας με λατινικούς χαρακτήρες, μαζί με παρενθέσεις, τελεστές και αριθμούς ανάμεσα.
  const EN_RUN = /[A-Za-z_][\w.]*(?:\s*\([^()]*\))?;?(?:(?:[ \t]+|[ \t]*(?:==|!=|>=|<=|&&|\|\||[=+\-*/<>])[ \t]*)[A-Za-z_0-9][\w.]*(?:\s*\([^()]*\))?;?)*/g;
  const ACR = { IoT: 'I o T', LED: 'L E D', LEDs: 'L E Ds', GPIO: 'G P I O', PIR: 'P I R', MQTT: 'M Q T T', TLS: 'T L S', SSH: 'S S H', USB: 'U S B', HTTP: 'H T T P', HTTPS: 'H T T P S', JSON: 'Jason', CPU: 'C P U', SQL: 'sequel', ESP32: 'E S P thirty two', ACL: 'A C L', IP: 'I P', ID: 'I D', DHT22: 'D H T twenty two', SoC: 'S O C', UART: 'you art', PWM: 'P W M', ADC: 'A D C', OTA: 'O T A', PoE: 'P O E', RP1: 'R P one', BCM2712: 'B C M twenty seven twelve' };
  function speakableEnglish(t) {
    return t
      .replace(/HC-SR04/g, 'H C S R zero four')
      .replace(/\bprintln\b/g, 'print line')
      .replace(/==/g, ' equals ').replace(/!=/g, ' not equal ').replace(/>=/g, ' greater or equal ').replace(/<=/g, ' less or equal ')
      .replace(/&&/g, ' and ').replace(/\|\|/g, ' or ').replace(/\+\+/g, ' plus plus ')
      .replace(/_/g, ' ')
      .replace(/\b[A-Za-z]*[A-Z][A-Za-z0-9]*\b/g, w => ACR[w] || (/^[A-Z]{3,}$/.test(w) ? w.toLowerCase() : w))   // OUTPUT → output (λέξη, όχι συλλαβισμός)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/\.(?=[A-Za-z])/g, ' dot ')
      .replace(/[();{}[\]"'`]/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  // Κείμενο → κομμάτια [{ en, t }]: τα ελληνικά «καθαρίζονται» για την ελληνική φωνή, τα αγγλικά για την αγγλική.
  function pieces(raw) {
    const src = String(raw || '');
    const out = [];
    const greek = t => { for (const c of chunks(clean(t))) if (/[\p{L}\p{N}]/u.test(c)) out.push({ en: false, t: c }); };
    if (!english || !(enVoice || pickEnglish())) { greek(src); return out; }
    let last = 0;
    src.replace(EN_RUN, (m, i) => {
      // μόνο αριθμοί ή ένα γράμμα (π.χ. «C» στο °C) μένουν στα ελληνικά
      if (!/[A-Za-z]{2}/.test(m)) return m;
      if (i > last) greek(src.slice(last, i));
      const e = speakableEnglish(m);
      if (e) out.push({ en: true, t: e });
      last = i + m.length;
      return m;
    });
    if (last < src.length) greek(src.slice(last));
    return out;
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
    return c.textContent;
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
    const list = pieces(speechText(b));
    if (!list.length) { next(r); return; }
    b.classList.add('reading');
    try { b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* παλιοί browsers */ }
    playPieces(list, () => { if (run === r) next(r); });
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
    if (!useBuiltin() && (!synth || typeof root.SpeechSynthesisUtterance !== 'function')) return false;
    stop();
    pickVoice();
    playPieces(pieces(text), null);
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
    setEnglish: on => { english = on !== false; },
    pieces,
    hasEnglish: () => !!(enVoice || pickEnglish()),
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
