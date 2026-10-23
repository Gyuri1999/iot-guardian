/*
 * IoT Guardian — ανάγνωση φωναχτά (Web Speech API, ελληνική φωνή της συσκευής).
 * Διαβάζει ένα κομμάτι της σελίδας παράγραφο-παράγραφο και φωτίζει την παράγραφο που ακούγεται,
 * ώστε το μάτι να ακολουθεί τη φωνή. Δεν στέλνει κείμενο πουθενά: η φωνή είναι του λειτουργικού.
 *   IoTSpeak.supported()        υπάρχει σύνθεση ομιλίας στον browser;
 *   IoTSpeak.toggle(el, btn)    ξεκινά ή σταματά την ανάγνωση του el
 *   IoTSpeak.stop()
 *   IoTSpeak.setRate(r)         0.6 … 1.4
 */
(function (root) {
  'use strict';

  const synth = root.speechSynthesis;
  let rate = 0.9;
  let voice = null;
  let run = null; // { blocks, i, btn, token }

  function pickVoice() {
    if (!synth) return null;
    const vs = synth.getVoices();
    // προτιμά ελληνική φωνή· ανάμεσα σε πολλές, όσες είναι τοπικές (δουλεύουν και χωρίς δίκτυο)
    const el = vs.filter(v => /^el([-_]|$)/i.test(v.lang));
    voice = el.find(v => v.localService) || el[0] || null;
    return voice;
  }
  if (synth) {
    pickVoice();
    if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', pickVoice);
  }

  // Τα «φύλλα» του κειμένου: παράγραφοι, στοιχεία λίστας, τίτλοι (όχι κώδικας και κουμπιά).
  const BLOCK = 'h1,h2,h3,h4,p,li,dt,dd,.title,.kind-tag,figcaption';
  function blocksOf(el) {
    const all = [...el.querySelectorAll(BLOCK)].filter(b => !b.closest('pre, button, .say, [hidden]') && !b.querySelector(BLOCK) && b.offsetParent !== null);
    return all.length ? all : [el];
  }
  // Κείμενο για ομιλία: χωρίς κουμπιά, και με τα σύμβολα σε λέξεις που ακούγονται φυσικά.
  function speechText(b) {
    const c = b.cloneNode(true);
    c.querySelectorAll('button, .say, svg, .ms-box').forEach(x => x.remove());
    return (c.textContent || '')
      .replace(/→/g, ', άρα ')
      .replace(/[·•]/g, ', ')
      .replace(/≥|>=/g, ' μεγαλύτερο ή ίσο ')
      .replace(/≤|<=/g, ' μικρότερο ή ίσο ')
      .replace(/==/g, ' ίσον ίσον ')
      .replace(/!=/g, ' διάφορο ')
      .replace(/°C/g, ' βαθμούς ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setBtn(btn, on) {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(on));
    btn.classList.toggle('on', on);
    const t = btn.querySelector('.say-t');
    if (t) t.textContent = on ? 'Σταμάτα' : 'Άκουσε';
  }

  function stop() {
    if (!run) return;
    const r = run;
    run = null;
    r.blocks.forEach(b => b.classList.remove('reading'));
    setBtn(r.btn, false);
    if (synth) synth.cancel();
  }

  function next(r) {
    if (run !== r) return;
    r.blocks.forEach(b => b.classList.remove('reading'));
    if (r.i >= r.blocks.length) { stop(); return; }
    const b = r.blocks[r.i++];
    const text = speechText(b);
    if (!text) { next(r); return; }
    b.classList.add('reading');
    try { b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* παλιοί browsers */ }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'el-GR';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.onend = () => next(r);
    u.onerror = () => next(r);
    synth.speak(u);
  }

  // Επιστρέφει false αν δεν μπορεί να διαβάσει (ο browser δεν έχει σύνθεση ομιλίας).
  function toggle(el, btn) {
    if (!synth || !el) return false;
    const same = run && run.btn === btn;
    stop();
    if (same) return true;
    synth.cancel();
    run = { blocks: blocksOf(el), i: 0, btn };
    setBtn(btn, true);
    next(run);
    return true;
  }

  root.IoTSpeak = {
    supported: () => !!synth && typeof root.SpeechSynthesisUtterance === 'function',
    hasGreek: () => !!(voice || pickVoice()),
    toggle,
    stop,
    setRate: r => { rate = Math.max(0.6, Math.min(1.4, Number(r) || 0.9)); },
    speaking: () => !!run
  };
})(typeof window !== 'undefined' ? window : globalThis);
