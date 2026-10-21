/*
 * IoT Guardian — αληθινό εργαστήριο (προαιρετικό).
 *
 * Λειτουργεί μόνο όταν η σελίδα ανοίγει από τον τοπικό βοηθό (node real-lab/helper.js → http://localhost:8787).
 * Ο βοηθός κάνει compile/upload στο ESP32 και τρέχει τον Mosquitto. Εδώ υπάρχει το πάνελ ελέγχου
 * και ένας μικρός MQTT client πάνω από WebSocket (QoS 0) για να βλέπεις τα αληθινά μηνύματα.
 * Οι στοιχεία του WiFi δεν περνούν ποτέ από αυτή τη σελίδα: μένουν στο real-lab/secrets.json.
 */
(function (root) {
  'use strict';

  const ON_HELPER = /^(localhost|127\.0\.0\.1):8787$/.test(root.location ? root.location.host : '');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R = {
    status: null, port: '', tab: 'serial', busy: false,
    serial: [], broker: [], flashLog: [], msgs: [],
    slot: null, opts: null, es: null, mq: null
  };
  const MAX = 250;
  const push = (arr, x) => { arr.push(x); if (arr.length > MAX) arr.shift(); };

  // ------------------------------------------------------------ MQTT πάνω από WebSocket (υποσύνολο 3.1.1)

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const str = s => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
  const remLen = n => { const out = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return out; };
  const packet = (head, body) => new Uint8Array([head, ...remLen(body.length), ...body]);

  class MiniMqtt {
    constructor(url, user, pass, onMsg, onState) {
      this.url = url; this.user = user; this.pass = pass; this.onMsg = onMsg; this.onState = onState;
      this.buf = new Uint8Array(0); this.pid = 1; this.closed = false; this.state = 'σύνδεση…';
      this.open();
    }
    open() {
      const ws = new WebSocket(this.url, 'mqtt');
      ws.binaryType = 'arraybuffer';
      this.ws = ws;
      ws.onopen = () => {
        const flags = 0xC2; // username, password, clean session
        ws.send(packet(0x10, [...str('MQTT'), 4, flags, 0, 60, ...str('guardian-page-' + Math.random().toString(36).slice(2, 8)), ...str(this.user), ...str(this.pass)]));
        this.ping = setInterval(() => { if (ws.readyState === 1) ws.send(new Uint8Array([0xC0, 0])); }, 30000);
      };
      ws.onmessage = e => { this.feed(new Uint8Array(e.data)); };
      ws.onclose = () => {
        clearInterval(this.ping);
        this.set('χωρίς σύνδεση');
        if (!this.closed) this.retry = setTimeout(() => this.open(), 2500);
      };
      ws.onerror = () => {};
    }
    set(s) { this.state = s; this.onState(s); }
    feed(chunk) {
      const b = new Uint8Array(this.buf.length + chunk.length);
      b.set(this.buf); b.set(chunk, this.buf.length);
      let i = 0;
      while (i + 2 <= b.length) {
        let mult = 1, len = 0, j = i + 1, d;
        do { if (j >= b.length) { this.buf = b.slice(i); return; } d = b[j++]; len += (d & 127) * mult; mult *= 128; } while (d & 128);
        if (j + len > b.length) break;
        this.handle(b[i], b.subarray(j, j + len));
        i = j + len;
      }
      this.buf = b.slice(i);
    }
    handle(head, body) {
      const type = head >> 4;
      if (type === 2) { // CONNACK
        if (body[1] === 0) {
          this.set('συνδεδεμένο');
          const id = this.pid++;
          this.ws.send(packet(0x82, [id >> 8, id & 255, ...str('#'), 0]));
        } else this.set(`ο broker αρνήθηκε (κωδικός ${body[1]})`);
      } else if (type === 3) { // PUBLISH
        const tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.subarray(2, 2 + tl));
        const qos = (head >> 1) & 3;
        const start = 2 + tl + (qos ? 2 : 0);
        this.onMsg({ topic, payload: dec.decode(body.subarray(start)), retained: !!(head & 1), t: Date.now() });
      }
    }
    publish(topic, payload, retain) {
      if (!this.ws || this.ws.readyState !== 1) return false;
      this.ws.send(packet(0x30 | (retain ? 1 : 0), [...str(topic), ...enc.encode(payload)]));
      return true;
    }
    close() { this.closed = true; clearTimeout(this.retry); if (this.ws) this.ws.close(); }
  }

  // ------------------------------------------------------------ σύνδεση με τον βοηθό

  async function api(path, body) {
    const r = await fetch(path, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'Σφάλμα βοηθού'), { line: j.line });
    return j;
  }

  async function refresh() {
    try {
      R.status = await api('/api/status');
      if (!R.port || !R.status.ports.some(p => p.address === R.port)) R.port = R.status.ports[0] ? R.status.ports[0].address : '';
      ensureStreams();
    } catch (e) {
      R.status = { error: 'Ο βοηθός δεν απαντά. Τρέχει το node real-lab/helper.js;' };
    }
    render();
  }

  function ensureStreams() {
    if (!R.es) {
      R.es = new EventSource('/api/events');
      R.es.onmessage = e => {
        const m = JSON.parse(e.data);
        push(m.src === 'serial' ? R.serial : R.broker, m.text);
        if (!m.old && m.src === 'broker' && /Opening websockets listen socket|mosquitto version .* running/.test(m.text) && R.mq) { R.mq.close(); R.mq = null; setTimeout(ensureStreams, 600); }
        paint(m.src === 'serial' ? 'serial' : 'log');
      };
    }
    const b = R.status && R.status.broker;
    if (!R.mq && b && b.running) {
      R.mq = new MiniMqtt(`ws://127.0.0.1:${b.wsPort}`, b.user, b.pass, m => { push(R.msgs, m); paint('mqtt'); }, () => paintState());
    }
  }

  // ------------------------------------------------------------ ενέργειες

  async function flash() {
    const o = R.opts;
    const code = o.getCode();
    const consts = o.consts();
    // Πρώτα ο ίδιος έλεγχος με την προσομοίωση: στην πλακέτα πάει μόνο κώδικας που καταλαβαίνει και το παιχνίδι.
    try { root.IoTInterp.compile(code, { consts }); } catch (e) {
      R.flashLog = [{ type: 'error', text: `Πριν το φλάσαρισμα: ${e.message}${e.line ? ` (γρ. ${e.line})` : ''}` }];
      R.tab = 'log'; render(); return;
    }
    R.busy = true; R.flashLog = []; R.tab = 'log'; render();
    try {
      const r = await fetch('/api/flash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, consts, port: R.port }) });
      const reader = r.body.getReader();
      let rest = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        rest += dec.decode(value, { stream: true });
        let i;
        while ((i = rest.indexOf('\n')) >= 0) {
          const line = rest.slice(0, i); rest = rest.slice(i + 1);
          if (!line.trim()) continue;
          const m = JSON.parse(line);
          if (m.type === 'log' && R.flashLog.length > 400) continue;
          R.flashLog.push(m);
          if (m.type === 'done') R.tab = 'serial';
          paint('log');
        }
      }
    } catch (e) {
      R.flashLog.push({ type: 'error', text: e.message });
    }
    R.busy = false;
    await refresh();
  }

  async function broker(config) {
    R.busy = true; R.tab = 'log'; render();
    try {
      const r = await api('/api/broker', { config });
      R.flashLog = [{ type: r.ok ? 'done' : 'error', text: r.ok ? (config ? 'Ο αληθινός broker τρέχει τώρα με τις ρυθμίσεις σου.' : 'Ο broker γύρισε σε ανοιχτό εργαστήριο: θύρα 1883, χωρίς υποχρεωτικό κωδικό.') : r.error }];
    } catch (e) {
      R.flashLog = [{ type: 'error', text: e.message + (e.line ? ` (γρ. ${e.line})` : '') }];
    }
    R.busy = false;
    await refresh();
  }

  async function tls() {
    R.busy = true; render();
    try {
      const r = await api('/api/tls', {});
      R.flashLog = [{ type: 'done', text: `Φτιάχτηκε δική σου CA και πιστοποιητικό για το ${r.ip}. Το HOME_CA στο ESP32 δείχνει πλέον σε αυτή την CA.` }];
    } catch (e) { R.flashLog = [{ type: 'error', text: e.message }]; }
    R.busy = false; R.tab = 'log';
    await refresh();
  }

  // ------------------------------------------------------------ εμφάνιση

  function brokerLine(b) {
    if (!b) return '';
    if (!b.running) return `<span class="bad-text">Ο broker δεν τρέχει.</span> ${esc(b.error || '')}`;
    const ports = (b.listeners || []).map(l => `${l.port}${l.tls ? ' (TLS)' : ''}`).join(', ');
    return `Broker: <b>${b.mode === 'lesson' ? 'ρυθμίσεις μαθήματος' : 'ανοιχτό εργαστήριο'}</b> · θύρα ${esc(ports)} στο ${esc(R.status.mqttHost)}`;
  }

  function panelBody() {
    if (R.tab === 'serial') {
      return `<pre class="real-out" id="real-out">${R.serial.length ? esc(R.serial.slice(-150).join('\n')) : 'Μετά το φλάσαρισμα, εδώ εμφανίζεται ό,τι τυπώνει η αληθινή πλακέτα.'}</pre>`;
    }
    if (R.tab === 'mqtt') {
      const rows = R.msgs.slice(-80).reverse().map(m => `<tr><td class="code">${new Date(m.t).toLocaleTimeString('el-GR')}</td><td class="code">${esc(m.topic)}${m.retained ? ' <small>(retained)</small>' : ''}</td><td class="code real-pl">${esc(m.payload)}</td></tr>`).join('');
      return `<div class="table-wrap real-table"><table><thead><tr><th>Ώρα</th><th>Topic</th><th>Payload</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="muted">Δεν έχει έρθει ακόμα μήνυμα.</td></tr>'}</tbody></table></div>
        <form class="real-pub" id="real-pub">
          <input id="real-topic" placeholder="topic, π.χ. home/led/set" aria-label="Topic" value="home/led/set">
          <input id="real-payload" placeholder='payload, π.χ. {"cmd":"on"}' aria-label="Payload" value='{"cmd":"on"}'>
          <label class="check"><input type="checkbox" id="real-retain"> retained</label>
          <button class="btn sm" type="submit">Publish</button>
        </form>`;
    }
    const flash = R.flashLog.map(m => {
      if (m.type === 'diag') return `<li class="real-${m.type === 'diag' ? 'diag' : ''}"><b>${m.line ? `γρ. ${m.line}` : 'compile'}</b> ${esc(m.text)}</li>`;
      if (m.type === 'log') return `<li class="real-log">${esc(m.text)}</li>`;
      return `<li class="real-${m.type}">${esc(m.text)}</li>`;
    }).join('');
    const blog = R.broker.slice(-60).map(t => `<li class="real-log">${esc(t)}</li>`).join('');
    return `<ul class="real-list" id="real-out">${flash}${blog ? `<li class="sub-h">Log του Mosquitto</li>${blog}` : ''}</ul>`;
  }

  function render() {
    if (!R.slot || !R.slot.isConnected) return;
    if (!ON_HELPER) {
      R.slot.innerHTML = `<details class="real real-off"><summary>Αληθινό ESP32 και αληθινός broker (προαιρετικό)</summary>
        <p>Ο ίδιος κώδικας μπορεί να τρέξει σε αληθινή πλακέτα και τα μηνύματα να περάσουν από αληθινό Mosquitto, στον δικό σου υπολογιστή.</p>
        <ol><li>Μία φορά: <code>node real-lab/helper.js --setup</code> (στοιχεία WiFi, μένουν τοπικά)</li>
        <li>Κάθε φορά: <code>node real-lab/helper.js</code></li>
        <li>Άνοιξε το παιχνίδι από το <code>http://localhost:8787</code></li></ol>
        <p class="muted">Χρειάζονται arduino-cli με πακέτο ESP32 και mosquitto. Οδηγίες και συνδεσμολογία στο real-lab/README.md.</p></details>`;
      return;
    }
    const s = R.status;
    const mode = R.opts.mode;
    let controls = '';
    if (!s) controls = '<p class="muted">Σύνδεση με τον βοηθό…</p>';
    else if (s.error) controls = `<p class="bad-text">${esc(s.error)}</p>`;
    else {
      const warn = [];
      if (!s.secrets) warn.push('Δεν έχουν οριστεί στοιχεία WiFi: σταμάτα τον βοηθό και τρέξε <code>node real-lab/helper.js --setup</code>.');
      if (!s.arduinoCli) warn.push('Λείπει το arduino-cli.');
      if (!s.mosquitto) warn.push('Λείπει ο mosquitto (<code>brew install mosquitto</code>).');
      const portSel = s.ports.length
        ? `<select id="real-port" aria-label="Θύρα USB">${s.ports.map(p => `<option value="${esc(p.address)}" ${p.address === R.port ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>`
        : '<span class="muted">Δεν βρέθηκε πλακέτα. Σύνδεσέ την με καλώδιο USB δεδομένων.</span>';
      controls = `${warn.map(w => `<p class="real-warn">${w}</p>`).join('')}
        <p class="real-line">${brokerLine(s.broker)}${s.secrets ? ` · WiFi: <b>${esc(s.secrets.ssid)}</b>` : ''}</p>
        <div class="real-ctl">
          ${mode === 'code' ? `${portSel}
            <button class="ib" id="real-refresh" title="Ξαναψάξε θύρες" aria-label="Ξαναψάξε θύρες">↻</button>
            <button class="btn sm primary" id="real-flash" ${R.busy || !s.ports.length || !s.secrets ? 'disabled' : ''}>Φλάσαρε στο ESP32</button>`
          : `<button class="btn sm primary" id="real-apply" ${R.busy ? 'disabled' : ''}>Εφάρμοσε στον αληθινό broker</button>
            <button class="btn sm" id="real-lab" ${R.busy ? 'disabled' : ''}>Ανοιχτό εργαστήριο</button>
            <button class="btn sm" id="real-tls" ${R.busy ? 'disabled' : ''}>${s.tls ? 'Νέα πιστοποιητικά TLS' : 'Δημιουργία πιστοποιητικών TLS'}</button>`}
        </div>`;
    }
    const tabs = [['serial', 'Serial (αληθινό)'], ['mqtt', 'MQTT (αληθινό)'], ['log', 'Log']];
    R.slot.innerHTML = `<section class="real" aria-label="Αληθινό ESP32">
      <div class="real-head"><h4>Αληθινό ESP32</h4><span class="real-state" id="real-state"></span></div>
      ${controls}
      <div class="dock-tabs real-tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" class="dtab" data-rtab="${k}" aria-selected="${R.tab === k}">${t}</button>`).join('')}</div>
      <div id="real-body">${panelBody()}</div>
    </section>`;
    bind();
    paintState();
    scrollOut();
  }

  function paint(which) {
    if (!R.slot || !R.slot.isConnected || !ON_HELPER) return;
    if (which && which !== R.tab) return;
    const body = R.slot.querySelector('#real-body');
    if (!body) return;
    const keep = R.tab === 'mqtt' && R.slot.querySelector('#real-topic') ? [R.slot.querySelector('#real-topic').value, R.slot.querySelector('#real-payload').value, R.slot.querySelector('#real-retain').checked] : null;
    if (keep && R.slot.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') {
      const tb = R.slot.querySelector('.real-table');
      if (tb) tb.outerHTML = panelBody().split('<form')[0];
      return;
    }
    body.innerHTML = panelBody();
    if (keep) { R.slot.querySelector('#real-topic').value = keep[0]; R.slot.querySelector('#real-payload').value = keep[1]; R.slot.querySelector('#real-retain').checked = keep[2]; }
    bindPub();
    scrollOut();
  }

  function paintState() {
    const el = R.slot && R.slot.querySelector('#real-state');
    if (el) el.textContent = R.busy ? 'δουλεύει…' : (R.mq ? `MQTT: ${R.mq.state}` : '');
  }

  function scrollOut() {
    const o = R.slot.querySelector('#real-out');
    if (o) o.scrollTop = o.scrollHeight;
  }

  function bindPub() {
    const f = R.slot.querySelector('#real-pub');
    if (!f) return;
    f.onsubmit = e => {
      e.preventDefault();
      const topic = R.slot.querySelector('#real-topic').value.trim();
      if (!topic || /[#+]/.test(topic)) return;
      if (!R.mq || !R.mq.publish(topic, R.slot.querySelector('#real-payload').value, R.slot.querySelector('#real-retain').checked)) {
        R.flashLog = [{ type: 'error', text: 'Η σελίδα δεν είναι συνδεδεμένη στον broker.' }];
      }
    };
  }

  function bind() {
    const $ = s => R.slot.querySelector(s);
    R.slot.querySelectorAll('[data-rtab]').forEach(b => { b.onclick = () => { R.tab = b.dataset.rtab; render(); }; });
    if ($('#real-port')) $('#real-port').onchange = e => { R.port = e.target.value; };
    if ($('#real-refresh')) $('#real-refresh').onclick = refresh;
    if ($('#real-flash')) $('#real-flash').onclick = flash;
    if ($('#real-apply')) $('#real-apply').onclick = () => broker(R.opts.getCode());
    if ($('#real-lab')) $('#real-lab').onclick = () => broker(null);
    if ($('#real-tls')) $('#real-tls').onclick = tls;
    bindPub();
  }

  // opts: { mode: 'code' | 'config', getCode(), consts() }
  function mount(slot, opts) {
    R.slot = slot;
    R.opts = opts;
    render();
    if (ON_HELPER) refresh();
  }

  root.IoTReal = { mount, MiniMqtt, available: ON_HELPER };
})(typeof window !== 'undefined' ? window : globalThis);
