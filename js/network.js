/*
 * IoT Guardian — εκπαιδευτικός MQTT broker και συνθετικό δίκτυο.
 *
 * Όλα εδώ είναι μοντέλο προσομοίωσης: κανένα πραγματικό πακέτο δεν στέλνεται,
 * καμία πραγματική κρυπτογράφηση δεν γίνεται και δεν καταγράφεται το δίκτυο του χρήστη.
 * Οι αποφάσεις (δεκτό/απορρίφθηκε) είναι αποφάσεις του μοντέλου, όχι πραγματικό όριο ασφαλείας.
 */
(function (root) {
  'use strict';

  const TODAY = '2026-10-15'; // εικονική ημερομηνία για έλεγχο ισχύος πιστοποιητικών
  const BROKER_IP = '192.168.1.10';
  const HOSTS = {
    device: '192.168.1.42',
    'esp32-pir': '192.168.1.42',
    'esp32-temp': '192.168.1.43',
    'esp32-lamp': '192.168.1.44',
    dashboard: '192.168.1.20',
    'unknown-device': '192.168.1.77'
  };
  const HOST_NAMES = { '192.168.1.10': 'Raspberry Pi (broker)', '192.168.1.42': 'ESP32 (η πλακέτα σου)', '192.168.1.43': 'ESP32 θερμοκρασίας', '192.168.1.44': 'ESP32 λάμπας', '192.168.1.20': 'Dashboard', '192.168.1.77': 'Άγνωστη συσκευή' };

  const CERTS = {
    valid: { cn: 'broker.home.lan', issuer: 'Home Lab CA', notAfter: '2027-06-30' },
    expired: { cn: 'broker.home.lan', issuer: 'Home Lab CA', notAfter: '2026-03-31' },
    'wrong-host': { cn: 'printer.home.lan', issuer: 'Home Lab CA', notAfter: '2027-06-30' },
    untrusted: { cn: 'broker.home.lan', issuer: 'Unknown Test CA', notAfter: '2027-06-30' }
  };

  // ---------------------------------------------------------------- Topics

  function validTopic(t) {
    return typeof t === 'string' && t.length > 0 && !/[+#]/.test(t);
  }

  function validFilter(f) {
    if (typeof f !== 'string' || !f.length) return false;
    const lv = f.split('/');
    return lv.every((x, i) => (x === '#' ? i === lv.length - 1 : x === '+' || !/[+#]/.test(x)));
  }

  function topicMatches(filter, topic) {
    const f = filter.split('/');
    const t = topic.split('/');
    for (let i = 0; i < f.length; i++) {
      if (f[i] === '#') return true;
      if (i >= t.length) return false;
      if (f[i] !== '+' && f[i] !== t[i]) return false;
    }
    return f.length === t.length;
  }

  // Καλύπτει ο κανόνας ACL «pattern» όλα τα topics που θα ταίριαζαν στο φίλτρο «filter»;
  function filterCovers(pattern, filter) {
    const p = pattern.split('/');
    const f = filter.split('/');
    for (let i = 0; i < p.length; i++) {
      if (p[i] === '#') return true;
      if (i >= f.length) return false;
      if (f[i] === '#') return false;
      if (p[i] === '+') continue;
      if (f[i] === '+' || p[i] !== f[i]) return false;
    }
    return p.length === f.length;
  }

  // ---------------------------------------------------------------- JSON βοηθοί

  function parseObj(s) {
    try {
      const o = JSON.parse(s);
      return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
    } catch (e) {
      return null;
    }
  }
  const jsonValid = s => parseObj(s) !== null;
  const jsonHas = (s, k) => { const o = parseObj(s); return !!o && Object.prototype.hasOwnProperty.call(o, k); };
  function jsonGet(s, k) {
    const o = parseObj(s);
    if (!o || !Object.prototype.hasOwnProperty.call(o, k)) return '';
    const v = o[k];
    if (v === null || typeof v === 'object') return '';
    return String(v);
  }

  // ---------------------------------------------------------------- Ρυθμίσεις broker

  class ConfigError extends Error {
    constructor(message, line, hint) { super(message); this.name = 'CodeError'; this.line = line; this.hint = hint || ''; }
  }

  const DIRECTIVES = 'listener, tls, allow_anonymous, password, acl_default, user, topic';

  function parseBrokerConfig(text) {
    const cfg = { listeners: [], allowAnonymous: true, passwords: {}, aclDefault: null, rules: {}, ruleLines: [] };
    const warnings = [];
    let currentUser = null;
    const lines = String(text).split('\n');
    lines.forEach((raw, i) => {
      const n = i + 1;
      // Όπως στο mosquitto: σχόλιο είναι μόνο γραμμή που ξεκινά με #, γιατί το # είναι και wildcard.
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      if (/[Ͱ-Ͽ]/.test(line)) throw new ConfigError('Βρέθηκαν ελληνικοί χαρακτήρες σε ρύθμιση.', n, 'Οι ρυθμίσεις γράφονται με λατινικούς χαρακτήρες. Τα ελληνικά επιτρέπονται μόνο σε σχόλια μετά το #.');
      const parts = line.split(/\s+/);
      const d = parts[0];
      const need = (k, usage) => { if (parts.length !== k + 1) throw new ConfigError(`Η ρύθμιση ${d} θέλει ${k} τιμ${k === 1 ? 'ή' : 'ές'}.`, n, `Σωστή μορφή: ${usage}`); };
      switch (d) {
        case 'listener': {
          need(1, 'listener 8883');
          const port = Number(parts[1]);
          if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError(`Η θύρα «${parts[1]}» δεν είναι έγκυρη.`, n, 'Η θύρα είναι ακέραιος από 1 έως 65535, π.χ. 8883.');
          if (cfg.listeners.some(l => l.port === port)) throw new ConfigError(`Η θύρα ${port} δηλώνεται δύο φορές.`, n);
          cfg.listeners.push({ port, tls: false, line: n });
          currentUser = null;
          break;
        }
        case 'tls': {
          need(1, 'tls on');
          if (!['on', 'off'].includes(parts[1])) throw new ConfigError('Το tls δέχεται on ή off.', n);
          const l = cfg.listeners[cfg.listeners.length - 1];
          if (!l) throw new ConfigError('Το tls πρέπει να γράφεται μετά από μια γραμμή listener.', n, 'Γράψε πρώτα listener 8883 και από κάτω tls on.');
          l.tls = parts[1] === 'on';
          break;
        }
        case 'allow_anonymous':
          need(1, 'allow_anonymous false');
          if (!['true', 'false'].includes(parts[1])) throw new ConfigError('Το allow_anonymous δέχεται true ή false.', n);
          cfg.allowAnonymous = parts[1] === 'true';
          break;
        case 'password':
          need(2, 'password esp32-pir <κωδικός>');
          if (cfg.passwords[parts[1]]) throw new ConfigError(`Ο χρήστης ${parts[1]} έχει ήδη κωδικό.`, n, 'Κάθε χρήστης χρειάζεται μία γραμμή password.');
          if (parts[2].length < 12) warnings.push({ line: n, text: `Ο κωδικός του ${parts[1]} έχει λιγότερους από 12 χαρακτήρες.`, hint: 'Οι μακριοί, τυχαίοι κωδικοί είναι πολύ πιο δύσκολο να μαντευτούν.' });
          cfg.passwords[parts[1]] = parts[2];
          break;
        case 'acl_default':
          need(1, 'acl_default deny');
          if (!['deny', 'allow'].includes(parts[1])) throw new ConfigError('Το acl_default δέχεται deny ή allow.', n);
          cfg.aclDefault = parts[1];
          break;
        case 'user':
          need(1, 'user esp32-pir');
          currentUser = parts[1];
          cfg.rules[currentUser] = cfg.rules[currentUser] || [];
          break;
        case 'topic': {
          need(2, 'topic write home/motion');
          if (!currentUser) throw new ConfigError('Ο κανόνας topic πρέπει να βρίσκεται κάτω από μια γραμμή user.', n, 'Γράψε πρώτα user <όνομα> και από κάτω τους κανόνες του.');
          if (!['read', 'write', 'readwrite'].includes(parts[1])) throw new ConfigError(`Η πρόσβαση «${parts[1]}» δεν υπάρχει.`, n, 'Χρησιμοποίησε read, write ή readwrite.');
          if (!validFilter(parts[2])) throw new ConfigError(`Το «${parts[2]}» δεν είναι έγκυρο topic ή φίλτρο.`, n, 'Το # μπαίνει μόνο στο τέλος (π.χ. home/#) και το + πιάνει ακριβώς ένα επίπεδο (π.χ. home/+/state).');
          const rule = { access: parts[1], pattern: parts[2], line: n };
          cfg.rules[currentUser].push(rule);
          cfg.ruleLines.push(Object.assign({ user: currentUser }, rule));
          if (parts[2] === '#' || (parts[1] !== 'read' && /#$/.test(parts[2]) && parts[2].split('/').length <= 2)) {
            warnings.push({ line: n, text: `Ο κανόνας «topic ${parts[1]} ${parts[2]}» για τον ${currentUser} είναι πολύ ευρύς.`, hint: 'Δώσε σε κάθε συσκευή μόνο τα topics που χρειάζεται (ελάχιστα δικαιώματα).' });
          }
          break;
        }
        default:
          throw new ConfigError(`Άγνωστη ρύθμιση «${d}».`, n, `Υποστηρίζονται: ${DIRECTIVES}.`);
      }
    });
    if (!cfg.listeners.length) throw new ConfigError('Δεν υπάρχει καμία γραμμή listener.', 1, 'Χωρίς listener ο broker δεν δέχεται συνδέσεις. Πρόσθεσε π.χ. listener 8883.');
    cfg.aclEnabled = cfg.aclDefault === 'deny' || (cfg.aclDefault !== 'allow' && cfg.ruleLines.length > 0);
    return { config: cfg, warnings };
  }

  function aclAllows(cfg, user, access, topicOrFilter, isFilter) {
    if (!cfg.aclEnabled) return true;
    const rules = (user && cfg.rules[user]) || [];
    return rules.some(r => {
      const okAccess = r.access === 'readwrite' || r.access === access;
      if (!okAccess) return false;
      return isFilter ? filterCovers(r.pattern, topicOrFilter) : topicMatches(r.pattern, topicOrFilter);
    });
  }

  // ---------------------------------------------------------------- Δίκτυο και broker

  class Network {
    constructor(opts) {
      opts = opts || {};
      this.now = opts.now || (() => 0); // ms
      this.config = opts.config;
      this.cert = CERTS[opts.cert || 'valid'];
      this.certName = opts.cert || 'valid';
      this.packets = [];
      this.log = [];
      this.messages = [];
      this.sessions = new Map();
      this.retained = new Map();
      this.inboxes = new Map();
      this.ports = new Map();
      this.nextPort = 50100;
      this.brokerUp = true;
      this.simClients = new Map();
      this.dashboard = null;
      this.lastDelivered = new Map();
    }

    ip(client) { return HOSTS[client] || '192.168.1.' + (60 + (Object.keys(HOSTS).length % 30)); }
    port(client) { if (!this.ports.has(client)) this.ports.set(client, this.nextPort++); return this.ports.get(client); }

    addLog(text, client) {
      this.log.push({ id: this.log.length + 1, t: this.now(), text, client: client || null });
      if (this.log.length > 800) this.log.shift();
    }

    packet(client, dir, listenerPort, tls, info, detail) {
      const cIp = this.ip(client);
      const cPort = this.port(client);
      const toBroker = dir === 'up';
      const plainLen = detail && detail.mqtt ? 4 + (detail.mqtt.topic || '').length + (detail.mqtt.payload || '').length + (detail.mqtt.clientId || '').length + (detail.mqtt.username || '').length + (detail.mqtt.password || '').length : 0;
      const p = {
        no: this.packets.length + 1,
        t: this.now() / 1000,
        src: toBroker ? cIp : BROKER_IP,
        dst: toBroker ? BROKER_IP : cIp,
        sport: toBroker ? cPort : listenerPort,
        dport: toBroker ? listenerPort : cPort,
        proto: tls ? 'TLS' : (detail && detail.mqtt ? 'MQTT' : 'TCP'),
        info,
        client,
        detail: detail || {}
      };
      if (tls && detail && detail.mqtt) {
        p.info = 'Application Data';
        p.detail = { tls: { record: 'Application Data', note: 'Το περιεχόμενο MQTT (topic, payload, κωδικοί) είναι κρυπτογραφημένο.' }, hidden: detail.mqtt };
      }
      p.len = 54 + (tls ? plainLen + 29 : plainLen) + (detail && detail.extraLen ? detail.extraLen : 0);
      this.packets.push(p);
      if (this.packets.length > 3000) this.packets.shift();
      return p;
    }

    session(client) { return this.sessions.get(client) || null; }
    connected(client) { return this.sessions.has(client); }

    // opts: { clientId, port, tls, verify, ca, host, username, password }
    connect(client, opts) {
      const cfg = this.config;
      const host = opts.host || 'broker.home.lan';
      if (!this.brokerUp) return this.fail(client, opts, 'Ο broker δεν απαντά.', null);
      const listener = cfg.listeners.find(l => l.port === opts.port);
      if (!listener) {
        this.packet(client, 'up', opts.port, false, `${this.port(client)} → ${opts.port} [SYN]`, { tcp: 'SYN' });
        this.packet(client, 'down', opts.port, false, `${opts.port} → ${this.port(client)} [RST, ACK]`, { tcp: 'RST' });
        return this.fail(client, opts, `Καμία υπηρεσία στη θύρα ${opts.port}: η σύνδεση απορρίφθηκε.`, 'refused');
      }
      if (opts.tls) {
        this.packet(client, 'up', opts.port, true, `Client Hello (SNI=${host})`, { tls: { record: 'Handshake', type: 'Client Hello', sni: host } });
        if (!listener.tls) {
          this.packet(client, 'down', opts.port, false, 'MQTT: μη αναγνωρίσιμα δεδομένα', { tcp: 'RST' });
          return this.fail(client, opts, `Η θύρα ${opts.port} δεν έχει ενεργό TLS, οπότε το TLS handshake απέτυχε.`, 'tls-mismatch');
        }
        this.packet(client, 'down', opts.port, true, 'Server Hello, Certificate', { tls: { record: 'Handshake', type: 'Server Hello, Certificate' }, cert: Object.assign({}, this.cert), extraLen: 900 });
        if (opts.verify) {
          const problem = this.cert.issuer !== opts.ca ? `Το πιστοποιητικό υπογράφεται από «${this.cert.issuer}», που δεν είναι η έμπιστη CA «${opts.ca}».`
            : this.cert.cn !== host ? `Το πιστοποιητικό είναι για «${this.cert.cn}», αλλά συνδέεσαι στο «${host}».`
              : this.cert.notAfter < TODAY ? `Το πιστοποιητικό έληξε στις ${this.cert.notAfter}.` : null;
          if (problem) {
            this.packet(client, 'up', opts.port, true, 'Alert (Level: Fatal, Description: Bad Certificate)', { tls: { record: 'Alert', type: 'Bad Certificate' } });
            this.addLog(`OpenSSL Error: client ${this.ip(client)} rejected the certificate`, client);
            return this.fail(client, opts, 'Ο client απέρριψε το πιστοποιητικό: ' + problem, 'bad-cert');
          }
        }
      } else if (listener.tls) {
        this.packet(client, 'up', opts.port, false, 'Connect Command (χωρίς TLS)', { mqtt: { type: 'CONNECT', clientId: opts.clientId } });
        this.packet(client, 'down', opts.port, false, `${opts.port} → ${this.port(client)} [RST, ACK]`, { tcp: 'RST' });
        this.addLog(`Client connection from ${this.ip(client)} failed: TLS expected on port ${opts.port}`, client);
        return this.fail(client, opts, `Η θύρα ${opts.port} περιμένει TLS. Η χρήση της θύρας 8883 μόνη της δεν ενεργοποιεί TLS: χρειάζεται και ρύθμιση στον client.`, 'tls-mismatch');
      }
      const tls = !!opts.tls;
      this.packet(client, 'up', opts.port, tls, 'Connect Command', { mqtt: { type: 'CONNECT', clientId: opts.clientId, username: opts.username || '', password: opts.password || '' } });
      let reason = null;
      if (!opts.username) {
        if (!cfg.allowAnonymous) reason = 'not-authorised';
      } else if (!Object.prototype.hasOwnProperty.call(cfg.passwords, opts.username) || cfg.passwords[opts.username] !== opts.password) {
        reason = 'bad-credentials';
      }
      if (reason) {
        this.packet(client, 'down', opts.port, tls, 'Connect Ack (Not authorized)', { mqtt: { type: 'CONNACK', code: 5 } });
        this.addLog(`Client ${opts.clientId} from ${this.ip(client)} ${opts.username ? `(u'${opts.username}')` : '(χωρίς όνομα χρήστη)'} disconnected, not authorised.`, client);
        return this.fail(client, opts, opts.username ? 'Λάθος όνομα χρήστη ή κωδικός.' : 'Ο broker δεν δέχεται ανώνυμες συνδέσεις.', reason);
      }
      for (const [other, s] of this.sessions) {
        if (other !== client && s.clientId === opts.clientId) {
          this.sessions.delete(other);
          this.addLog(`Client ${opts.clientId} already connected, closing old connection.`, other);
        }
      }
      this.packet(client, 'down', opts.port, tls, 'Connect Ack (Accepted)', { mqtt: { type: 'CONNACK', code: 0 } });
      this.sessions.set(client, { clientId: opts.clientId, user: opts.username || null, port: opts.port, tls, insecure: tls && !opts.verify, subs: [] });
      if (!this.inboxes.has(client)) this.inboxes.set(client, []);
      this.addLog(`New client connected from ${this.ip(client)} as ${opts.clientId} (p2, c1, k60${opts.username ? `, u'${opts.username}'` : ''}).`, client);
      return { ok: true };
    }

    fail(client, opts, message, code) {
      this.sessions.delete(client);
      return { ok: false, message, code };
    }

    disconnect(client, reason) {
      const s = this.sessions.get(client);
      if (!s) return;
      this.sessions.delete(client);
      if (reason !== 'silent') {
        this.packet(client, 'up', s.port, s.tls, 'Disconnect Req', { mqtt: { type: 'DISCONNECT' } });
        this.addLog(`Client ${s.clientId} disconnected.`, client);
      }
    }

    dropClient(client, why) {
      const s = this.sessions.get(client);
      if (!s) return;
      this.sessions.delete(client);
      this.addLog(`Client ${s.clientId} has exceeded timeout, disconnecting.${why ? ' (' + why + ')' : ''}`, client);
    }

    restartBroker() {
      for (const [c, s] of this.sessions) this.addLog(`Client ${s.clientId} closed its connection (broker restart).`, c);
      this.sessions.clear();
      this.addLog('mosquitto version 2.0 terminating');
      this.addLog('mosquitto version 2.0 starting');
      this.addLog('Restored retained messages from persistence.');
    }

    publish(client, topic, payload, retain, qos) {
      const s = this.sessions.get(client);
      if (!s) return { ok: false, message: 'Δεν υπάρχει σύνδεση με τον broker.' };
      if (!validTopic(topic)) return { ok: false, message: `Το «${topic}» δεν είναι έγκυρο topic για publish (δεν επιτρέπονται + και #).` };
      this.packet(client, 'up', s.port, s.tls, `Publish Message [${topic}]`, { mqtt: { type: 'PUBLISH', topic, payload, retain: !!retain, qos: qos || 0 } });
      const msg = { id: this.messages.length + 1, t: this.now(), from: s.clientId, client, user: s.user, topic, payload, retain: !!retain, qos: qos || 0, to: [], denied: false };
      if (!aclAllows(this.config, s.user, 'write', topic, false)) {
        msg.denied = true;
        this.messages.push(msg);
        this.addLog(`Denied PUBLISH from ${s.clientId} (d0, q${qos || 0}, r${retain ? 1 : 0}, m0, '${topic}', ... (${payload.length} bytes))`, client);
        return { ok: false, denied: true, message: `Ο broker δεν επιτρέπει στον ${s.user || 'ανώνυμο'} να γράφει στο ${topic}.` };
      }
      if (retain) {
        if (payload === '') this.retained.delete(topic); else this.retained.set(topic, msg);
      }
      this.messages.push(msg);
      if (this.messages.length > 1500) this.messages.shift();
      this.route(msg, false);
      return { ok: true };
    }

    route(msg, dup) {
      for (const [c, s] of this.sessions) {
        const sub = s.subs.find(x => topicMatches(x.filter, msg.topic));
        if (!sub) continue;
        if (!aclAllows(this.config, s.user, 'read', msg.topic, false)) continue;
        this.deliver(c, s, msg, false, dup);
      }
    }

    deliver(c, s, msg, asRetained, dup) {
      msg.to.push(s.clientId);
      this.packet(c, 'down', s.port, s.tls, `Publish Message [${msg.topic}]${asRetained ? ' (retained)' : ''}${dup ? ' (DUP)' : ''}`, { mqtt: { type: 'PUBLISH', topic: msg.topic, payload: msg.payload, retain: asRetained, qos: msg.qos, dup: !!dup } });
      const item = { topic: msg.topic, payload: msg.payload, retained: asRetained, dup: !!dup, t: this.now() };
      this.inboxes.get(c).push(item);
      this.lastDelivered.set(c, item);
      const sim = this.simClients.get(c);
      if (sim && sim.onMessage) sim.onMessage(item);
    }

    redeliverLast(client) {
      const s = this.sessions.get(client);
      const last = this.lastDelivered.get(client);
      if (!s || !last) return false;
      const msg = { topic: last.topic, payload: last.payload, qos: 1, to: [] };
      this.deliver(client, s, msg, false, true);
      return true;
    }

    subscribe(client, filter) {
      const s = this.sessions.get(client);
      if (!s) return { ok: false, message: 'Δεν υπάρχει σύνδεση με τον broker.' };
      if (!validFilter(filter)) return { ok: false, message: `Το «${filter}» δεν είναι έγκυρο φίλτρο.` };
      this.packet(client, 'up', s.port, s.tls, `Subscribe Request [${filter}]`, { mqtt: { type: 'SUBSCRIBE', topic: filter } });
      if (!aclAllows(this.config, s.user, 'read', filter, true)) {
        this.packet(client, 'down', s.port, s.tls, 'Subscribe Ack (Failure)', { mqtt: { type: 'SUBACK', code: 128 } });
        this.addLog(`Denied SUBSCRIBE from ${s.clientId} to '${filter}'.`, client);
        return { ok: false, denied: true, message: `Ο broker δεν επιτρέπει στον ${s.user || 'ανώνυμο'} να διαβάζει το ${filter}.` };
      }
      this.packet(client, 'down', s.port, s.tls, 'Subscribe Ack', { mqtt: { type: 'SUBACK', code: 0 } });
      if (!s.subs.some(x => x.filter === filter)) s.subs.push({ filter });
      for (const [topic, msg] of this.retained) {
        if (topicMatches(filter, topic) && aclAllows(this.config, s.user, 'read', topic, false)) this.deliver(client, s, msg, true, false);
      }
      return { ok: true };
    }

    readNext(client) {
      const q = this.inboxes.get(client);
      return q && q.length ? q.shift() : null;
    }

    // Εικονικοί clients (dashboard, άλλες συσκευές) που ακολουθούν καλές πρακτικές:
    // ξανασυνδέονται μόνοι τους μετά από επανεκκίνηση του broker.
    addSimClient(name, def) {
      const sc = Object.assign({ name, subs: [], values: {}, lastConnectTry: -1e9 }, def);
      // Περιοδικές δημοσιεύσεις (π.χ. ένας εικονικός αισθητήρας ESP32 που στέλνει κάθε 5 s).
      // Αντίγραφο, ώστε ο μετρητής να μη «διαρρέει» από τη μία εκτέλεση στην άλλη.
      sc.publish = (def.publish || []).map(p => Object.assign({}, p, { next: undefined, count: 0 }));
      if (name === 'dashboard') {
        sc.onMessage = m => { sc.values[m.topic] = { payload: m.payload, t: m.t, retained: m.retained }; };
        this.dashboard = sc;
      }
      this.simClients.set(name, sc);
      this.ensureSim(sc);
      return sc;
    }

    simConnectOpts(sc) {
      return { clientId: sc.clientId || sc.name, port: sc.port || 1883, tls: !!sc.tls, verify: !!sc.tls, ca: 'Home Lab CA', host: 'broker.home.lan', username: sc.user, password: sc.pass };
    }

    ensureSim(sc) {
      if (this.sessions.has(sc.name) || !this.brokerUp) return;
      if (this.now() - sc.lastConnectTry < 1000) return;
      sc.lastConnectTry = this.now();
      const r = this.connect(sc.name, this.simConnectOpts(sc));
      sc.lastResult = r;
      if (r.ok) sc.subs.forEach(f => this.subscribe(sc.name, f));
    }

    // inputs: οι τιμές του εικονικού κόσμου (θερμοκρασία κ.λπ.) για τα πρότυπα {temp}, {humidity}, {pir}, {n}.
    tick(inputs) {
      for (const sc of this.simClients.values()) {
        this.ensureSim(sc);
        if (!sc.publish.length || !this.sessions.has(sc.name)) continue;
        for (const p of sc.publish) {
          if (p.next === undefined) p.next = this.now() + (p.offset || 0);
          if (this.now() < p.next) continue;
          p.count++;
          p.next = this.now() + (p.every || 5000);
          this.publish(sc.name, p.topic, fillTemplate(p.payload, inputs || {}, p.count), !!p.retain, 0);
        }
      }
    }
  }

  function fillTemplate(tpl, inputs, n) {
    return String(tpl || '').replace(/\{(temp|humidity|pir|button|n)\}/g, (_, k) => {
      if (k === 'n') return String(n);
      if (k === 'temp') return inputs.sensorFault ? 'nan' : Number(inputs.temp === undefined ? 22.5 : inputs.temp).toFixed(1);
      if (k === 'humidity') return inputs.sensorFault ? 'nan' : String(Math.round(inputs.humidity === undefined ? 45 : inputs.humidity));
      return inputs[k] ? '1' : '0';
    });
  }

  // ---------------------------------------------------------------- Φίλτρα Network Monitor

  const FILTER_HELP = 'Υποστηρίζονται: mqtt, tls, tcp, tcp.port == N, ip.src == Δ, ip.dst == Δ, ip.addr == Δ, mqtt.topic == "…", με && ανάμεσα. Είναι μικρό εκπαιδευτικό υποσύνολο, όχι πλήρης σύνταξη Wireshark.';

  function compileFilter(text) {
    const src = String(text || '').trim();
    if (!src) return { ok: true, fn: () => true };
    const parts = src.split('&&').map(s => s.trim());
    const preds = [];
    for (const part of parts) {
      if (part === 'mqtt') { preds.push(p => p.proto === 'MQTT'); continue; }
      if (part === 'tls') { preds.push(p => p.proto === 'TLS'); continue; }
      if (part === 'tcp') { preds.push(() => true); continue; }
      const m = /^([a-z.]+)\s*(==|!=)\s*(.+)$/.exec(part);
      if (!m) return { ok: false, error: `Δεν καταλαβαίνω το «${part}». ${FILTER_HELP}` };
      const field = m[1];
      const neg = m[2] === '!=';
      let val = m[3].trim();
      if (/^".*"$/.test(val)) val = val.slice(1, -1);
      let get;
      if (field === 'tcp.port') {
        const n = Number(val);
        if (!Number.isInteger(n)) return { ok: false, error: `Το tcp.port θέλει αριθμό, π.χ. tcp.port == 8883.` };
        get = p => p.sport === n || p.dport === n;
      } else if (field === 'ip.src') get = p => p.src === val;
      else if (field === 'ip.dst') get = p => p.dst === val;
      else if (field === 'ip.addr') get = p => p.src === val || p.dst === val;
      else if (field === 'mqtt.topic') get = p => p.proto === 'MQTT' && p.detail.mqtt && p.detail.mqtt.topic === val;
      else return { ok: false, error: `Το πεδίο «${field}» δεν υποστηρίζεται. ${FILTER_HELP}` };
      preds.push(neg ? p => !get(p) : get);
    }
    return { ok: true, fn: p => preds.every(f => f(p)) };
  }

  root.IoTNet = {
    Network, parseBrokerConfig, compileFilter, topicMatches, filterCovers, validTopic, validFilter,
    aclAllows, jsonValid, jsonHas, jsonGet, CERTS, HOSTS, HOST_NAMES, BROKER_IP, TODAY, FILTER_HELP
  };
})(typeof window !== 'undefined' ? window : globalThis);
