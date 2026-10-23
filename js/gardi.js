/*
 * IoT Guardian — ο Γκάρντι, το ρομποτάκι-βοηθός.
 * Κάθεται στη γωνία της οθόνης, αντιδρά σε ό,τι κάνεις (χαρά, ανησυχία, σκέψη) και λέει
 * ΜΙΑ μικρή κουβέντα τη φορά σε συννεφάκι. Δεν λύνει την άσκηση: δείχνει πού να κοιτάξεις.
 *   IoTGardi.mount()                       μία φορά, στο body
 *   IoTGardi.say(text, mood, { ttl, speak, action: {label, run} })
 *   IoTGardi.mood(m)                       idle · happy · worried · think · party · sleep
 *   IoTGardi.onClick(f)                    τι γίνεται όταν τον πατάς
 *   IoTGardi.setEnabled(on), setVoice(on)
 */
(function (root) {
  'use strict';

  let el = null;
  let bubble = null;
  let hideT = null;
  let moodT = null;
  let enabled = true;
  let voice = false;
  let clickFn = null;
  let lastText = '';
  let lastAt = 0;

  const SVG = `<svg class="gd-bot" viewBox="0 0 64 76" aria-hidden="true">
    <path class="gd-ant" d="M32 15 V6"/><circle class="gd-ant-led" cx="32" cy="5" r="3.6"/>
    <rect class="gd-head" x="9" y="15" width="46" height="34" rx="14"/>
    <path class="gd-ear" d="M5 27v10M59 27v10"/>
    <g class="gd-eyes gd-e-normal"><rect x="20" y="27" width="6" height="8" rx="3"/><rect x="38" y="27" width="6" height="8" rx="3"/></g>
    <g class="gd-eyes gd-e-happy"><path d="M19 32q4-6 8 0M37 32q4-6 8 0"/></g>
    <g class="gd-eyes gd-e-worried"><path d="M18 25l8 3M46 25l-8 3"/><rect x="20" y="29" width="6" height="6" rx="3"/><rect x="38" y="29" width="6" height="6" rx="3"/></g>
    <g class="gd-eyes gd-e-think"><rect x="22" y="25" width="5" height="7" rx="2.5"/><rect x="40" y="25" width="5" height="7" rx="2.5"/></g>
    <g class="gd-eyes gd-e-sleep"><path d="M19 31h8M37 31h8"/></g>
    <path class="gd-mouth gd-m-smile" d="M26 41q6 5 12 0"/>
    <path class="gd-mouth gd-m-open" d="M27 40q5 7 10 0z"/>
    <path class="gd-mouth gd-m-flat" d="M27 42h10"/>
    <path class="gd-body" d="M32 50 L48 55 V62 C48 69 41 73 32 75 C23 73 16 69 16 62 V55 Z"/>
    <rect class="gd-chip" x="26" y="56" width="12" height="11" rx="2"/><circle class="gd-heart" cx="32" cy="61.5" r="2.4"/>
  </svg>`;

  function mount() {
    if (el || typeof document === 'undefined') return;
    el = document.createElement('div');
    el.className = 'gardi m-idle';
    el.innerHTML = `<div class="gd-bubble" role="status" aria-live="polite" hidden><button class="gd-x" type="button" aria-label="Κλείσιμο">✕</button><p class="gd-text"></p><div class="gd-acts"></div></div>
      <button class="gd-btn" type="button" aria-label="Γκάρντι, ο βοηθός σου: πάτα για συμβουλή" title="Γκάρντι: πάτα για συμβουλή">${SVG}</button>`;
    document.body.appendChild(el);
    bubble = el.querySelector('.gd-bubble');
    el.querySelector('.gd-btn').onclick = () => { if (clickFn) clickFn(); };
    el.querySelector('.gd-x').onclick = () => hide();
    bubble.addEventListener('pointerenter', () => clearTimeout(hideT));
    bubble.addEventListener('pointerleave', () => { hideT = setTimeout(hide, 4000); });
    el.hidden = !enabled;
  }

  function mood(m, ms) {
    if (!el) return;
    el.className = el.className.replace(/\bm-\w+/, 'm-' + (m || 'idle'));
    clearTimeout(moodT);
    if (ms) moodT = setTimeout(() => mood('idle'), ms);
  }

  function hide() {
    if (!bubble) return;
    bubble.hidden = true;
    el.classList.remove('talking');
  }

  function say(text, m, o) {
    o = o || {};
    if (!el || !enabled || !text) return;
    const now = Date.now();
    // η ίδια κουβέντα δεν επαναλαμβάνεται αμέσως
    if (text === lastText && now - lastAt < 15000 && !o.force) return;
    lastText = text;
    lastAt = now;
    bubble.querySelector('.gd-text').textContent = text;
    const acts = bubble.querySelector('.gd-acts');
    acts.innerHTML = '';
    for (const a of o.actions || []) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn sm';
      b.textContent = a.label;
      b.onclick = () => { hide(); a.run(); };
      acts.appendChild(b);
    }
    bubble.hidden = false;
    el.classList.add('talking');
    setTimeout(() => el && el.classList.remove('talking'), 1200);
    mood(m || 'idle', o.moodMs || 2600);
    clearTimeout(hideT);
    hideT = setTimeout(hide, o.ttl || Math.min(14000, 4500 + text.length * 55));
    if (voice && root.speechSynthesis && root.SpeechSynthesisUtterance) {
      // ίδια φωνή και προφορά με την ανάγνωση φωναχτά (js/speak.js)
      try { if (root.IoTSpeak) root.IoTSpeak.say(text); } catch (e) { /* χωρίς φωνή, μόνο κείμενο */ }
    }
  }

  root.IoTGardi = {
    mount, say, mood, hide,
    onClick: f => { clickFn = f; },
    setEnabled: on => { enabled = !!on; if (el) { el.hidden = !enabled; if (!enabled) hide(); } },
    setVoice: on => { voice = !!on; },
    enabled: () => enabled
  };
})(typeof window !== 'undefined' ? window : globalThis);
