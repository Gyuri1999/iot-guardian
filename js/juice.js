/* IoT Guardian — μικρές κινήσεις («juice») που κάνουν το παιχνίδι πιο ζωντανό.
   Ιδέες από: Emil Kowalski «good vs great animations», notbor.ing «the most satisfying checkbox»,
   Josh Comeau «boop» και linear() springs, McCormick «CSS animations for game juice».
   Κανόνες: σύντομες (≤ 0.6 s), μικρές, ποτέ αναβόσβημα, ποτέ μόνο η κίνηση (υπάρχει πάντα και κείμενο),
   και τίποτα όταν ο παίκτης ζήτησε «λιγότερη κίνηση» (ρύθμιση ή σύστημα). */
(function (root) {
  'use strict';
  const doc = typeof document !== 'undefined' ? document : null;

  function motionOK() {
    if (!doc) return false;
    if (doc.documentElement.getAttribute('data-reduced-motion') === 'true') return false;
    return !(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  const can = el => !!(el && el.animate && motionOK());

  // Απαλό «όχι»: 3 μικρές κινήσεις 4px στο πλάι (όχι κόκκινο φλας).
  function nudge(el) {
    if (!can(el)) return;
    el.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' },
      { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }
    ], { duration: 280, easing: 'ease-out' });
  }

  // Κύμα από το κουμπί «Εκτέλεση»: ο κώδικας «φεύγει» για την πλακέτα.
  function launch(el) {
    if (!can(el)) return;
    el.animate([{ transform: 'scale(0.9)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    const r = el.getBoundingClientRect();
    const ring = doc.createElement('span');
    ring.className = 'jc-ring';
    ring.setAttribute('aria-hidden', 'true');
    Object.assign(ring.style, { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px`, width: `${r.width}px`, height: `${r.height}px` });
    doc.body.appendChild(ring);
    const a = ring.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 0.55 }, { transform: 'translate(-50%,-50%) scale(2.1)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
    a.onfinish = () => ring.remove();
    setTimeout(() => ring.remove(), 900); // αν ο browser «παγώσει» τις κινήσεις (καρτέλα στο παρασκήνιο)
  }

  // Μικρή «έκρηξη» από τελίτσες εκεί που έγινε κάτι καλό (π.χ. τσεκάρισμα στόχου).
  function burst(el, opts) {
    if (!can(el)) return;
    opts = opts || {};
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const n = opts.n || 8;
    const colors = opts.colors || ['#3f8f5a', '#13857f', '#e2b52d', '#ff5a3c'];
    for (let i = 0; i < n; i++) {
      const d = doc.createElement('span');
      d.className = 'jc-dot';
      d.setAttribute('aria-hidden', 'true');
      d.style.left = `${cx}px`;
      d.style.top = `${cy}px`;
      d.style.background = colors[i % colors.length];
      doc.body.appendChild(d);
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 16 + Math.random() * 14;
      const a = d.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px)) scale(0.3)`, opacity: 0 }
      ], { duration: 480 + Math.random() * 160, easing: 'cubic-bezier(.16,1,.3,1)' });
      a.onfinish = () => d.remove();
      setTimeout(() => d.remove(), 1000);
    }
  }

  // Η μπάρα προόδου γεμίζει από εκεί που ήταν πριν (και όχι από το μηδέν σε κάθε σελίδα).
  let lastPct = null;
  function bars(scope) {
    const bar = (scope || doc).querySelector && (scope || doc).querySelector('.pp-bar i[data-pct]');
    if (!bar || bar.dataset.jc) return;
    bar.dataset.jc = '1';
    const to = Number(bar.dataset.pct) || 0;
    const from = lastPct === null ? to : lastPct;
    lastPct = to;
    if (from === to || !motionOK()) { bar.style.width = `${to}%`; return; }
    bar.style.width = `${from}%`;
    void bar.offsetWidth;
    bar.style.transition = 'width 0.7s cubic-bezier(.16,1,.3,1)';
    bar.style.width = `${to}%`;
    if (to > from) setTimeout(() => { const pill = bar.closest('.progress-pill'); if (pill && pill.animate && motionOK()) pill.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 360, easing: 'ease-out' }); }, 650);
  }

  function watch() {
    if (!doc || !root.MutationObserver) return;
    const app = doc.getElementById('app');
    if (!app) return;
    bars(app);
    new MutationObserver(() => bars(app)).observe(app, { childList: true });
  }
  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', watch);
    else watch();
  }

  root.IoTJuice = { motionOK, nudge, launch, burst, bars };
})(typeof window !== 'undefined' ? window : globalThis);
