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
 */
(function (root) {
  'use strict';

  const synth = root.speechSynthesis;
  let rate = 0.9;
  let wanted = '';   // όνομα φωνής που διάλεξε ο παίκτης ('' = αυτόματα)
  let voice = null;
  let run = null;    // { blocks, i, btn }
  const listeners = [];

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
    if (!synth || !el) return false;
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
    if (!synth || typeof root.SpeechSynthesisUtterance !== 'function') return false;
    stop();
    pickVoice();
    chunks(clean(text)).forEach(p => synth.speak(utter(p, null)));
    return true;
  }

  root.IoTSpeak = {
    supported: () => !!synth && typeof root.SpeechSynthesisUtterance === 'function',
    hasGreek: () => !!(voice || pickVoice()),
    toggle,
    say,
    stop,
    clean,
    setRate: r => { rate = Math.max(0.6, Math.min(1.4, Number(r) || 0.9)); },
    setVoiceName: n => { wanted = typeof n === 'string' ? n : ''; pickVoice(); },
    voices: () => greekVoices().map(v => ({ name: v.name, label: `${v.name}${v.localService ? '' : ' · online'}`, quality: quality(v) })),
    current: () => (pickVoice() ? { name: voice.name, quality: quality(voice) } : null),
    onVoices: f => { listeners.push(f); },
    speaking: () => !!run
  };
})(typeof window !== 'undefined' ? window : globalThis);
