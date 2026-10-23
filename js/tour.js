/*
 * IoT Guardian — ξενάγηση για την πρώτη φορά.
 * Σκιάζει την οθόνη εκτός από ένα κομμάτι της και δείχνει δίπλα του μια κάρτα με μια μικρή εξήγηση.
 *   IoTTour.start(steps, { onDone, say })   steps: [{ sel, title, text }]
 *   IoTTour.active()
 * Βήματα των οποίων το στοιχείο δεν υπάρχει ή δεν φαίνεται, παραλείπονται.
 */
(function (root) {
  'use strict';

  let cur = null;   // { steps, i, hole, card, onDone, reflow }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };

  function end(done) {
    if (!cur) return;
    const c = cur;
    cur = null;
    c.hole.remove();
    c.card.remove();
    removeEventListener('resize', c.reflow);
    removeEventListener('scroll', c.reflow, true);
    document.removeEventListener('keydown', c.keys, true);
    if (c.onDone) c.onDone(!!done);
  }

  function place() {
    if (!cur) return;
    const st = cur.steps[cur.i];
    const el = document.querySelector(st.sel);
    const r = el.getBoundingClientRect();
    const pad = 6;
    Object.assign(cur.hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const card = cur.card;
    const narrow = innerWidth < 640;
    if (narrow) { Object.assign(card.style, { left: '12px', right: '12px', top: '', bottom: '12px', width: '' }); return; }
    const w = Math.min(340, innerWidth - 24);
    const below = r.bottom + 14 + card.offsetHeight < innerHeight;
    const top = below ? r.bottom + 14 : Math.max(12, r.top - 14 - card.offsetHeight);
    const left = Math.max(12, Math.min(innerWidth - w - 12, r.left));
    Object.assign(card.style, { width: `${w}px`, left: `${left}px`, top: `${top}px`, right: '', bottom: '' });
  }

  function show(i) {
    // προσπέρασε βήματα που δεν φαίνονται σε αυτή την οθόνη
    while (i < cur.steps.length && !visible(document.querySelector(cur.steps[i].sel))) i++;
    if (i >= cur.steps.length) { end(true); return; }
    cur.i = i;
    const st = cur.steps[i];
    const el = document.querySelector(st.sel);
    try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { el.scrollIntoView(); }
    const last = !cur.steps.slice(i + 1).some(s => visible(document.querySelector(s.sel)));
    cur.card.innerHTML = `<div class="tour-head"><b>${esc(st.title)}</b><span class="tour-n">${i + 1}/${cur.steps.length}</span></div>
      <p class="tour-t">${esc(st.text)}</p>
      <div class="tour-acts">${cur.say ? '<button type="button" class="btn sm" data-tour="say">🔊 Άκουσε</button>' : ''}<span class="spacer"></span>
        <button type="button" class="btn quiet sm" data-tour="skip">Παράλειψη</button>
        <button type="button" class="btn primary sm" data-tour="next">${last ? 'Τέλος!' : 'Επόμενο →'}</button></div>`;
    place();
    requestAnimationFrame(place);
    cur.card.querySelector('[data-tour="next"]').focus();
  }

  function start(steps, opts) {
    if (cur || typeof document === 'undefined') return;
    opts = opts || {};
    const hole = document.createElement('div');
    hole.className = 'tour-hole';
    const card = document.createElement('div');
    card.className = 'tour-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-live', 'polite');
    card.setAttribute('aria-label', 'Ξενάγηση');
    document.body.append(hole, card);
    cur = { steps, i: 0, hole, card, onDone: opts.onDone, say: opts.say, reflow: () => place() };
    cur.keys = e => { if (!cur) return; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(false); } };
    card.addEventListener('click', e => {
      const b = e.target.closest('[data-tour]');
      if (!b || !cur) return;
      const a = b.dataset.tour;
      if (a === 'skip') end(false);
      if (a === 'next') show(cur.i + 1);
      if (a === 'say' && cur.say) { const st = cur.steps[cur.i]; cur.say(`${st.title}. ${st.text}`); }
    });
    addEventListener('resize', cur.reflow);
    addEventListener('scroll', cur.reflow, true);
    document.addEventListener('keydown', cur.keys, true);
    show(0);
  }

  root.IoTTour = { start, end: () => end(false), active: () => !!cur };
})(typeof window !== 'undefined' ? window : globalThis);
