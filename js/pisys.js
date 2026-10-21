/*
 * IoT Guardian — εικονικό «σύστημα» του Raspberry Pi για το κεφάλαιο ασφάλειας.
 * Ο μαθητής γράφει ένα κομμάτι από το /etc/ssh/sshd_config και κανόνες ufw (firewall).
 * Οι έλεγχοι στέλνουν συνθετικές συνδέσεις και δοκιμές SSH και βλέπουν τι επιτρέπεται.
 * Είναι εκπαιδευτικό μοντέλο: δεν αγγίζει κανένα πραγματικό σύστημα.
 */
(function (root) {
  'use strict';

  class SysError extends Error {
    constructor(message, line, hint) { super(message); this.name = 'CodeError'; this.line = line; this.hint = hint || ''; }
  }

  const PI_IP = '192.168.1.10';
  const SERVICES = { 22: 'SSH', 1883: 'MQTT', 8883: 'MQTT με TLS', 5000: 'dashboard (Flask)' };
  const SSH_KEYS = {
    permitrootlogin: { name: 'PermitRootLogin', values: ['yes', 'no', 'prohibit-password', 'without-password'] },
    passwordauthentication: { name: 'PasswordAuthentication', values: ['yes', 'no'] },
    pubkeyauthentication: { name: 'PubkeyAuthentication', values: ['yes', 'no'] },
    permitemptypasswords: { name: 'PermitEmptyPasswords', values: ['yes', 'no'] },
    allowusers: { name: 'AllowUsers', list: true },
    port: { name: 'Port', number: true },
    maxauthtries: { name: 'MaxAuthTries', number: true }
  };
  const SSH_DEFAULTS = { permitrootlogin: 'prohibit-password', passwordauthentication: 'yes', pubkeyauthentication: 'yes', permitemptypasswords: 'no', allowusers: null, port: 22, maxauthtries: 6 };
  const SERVICE_NAMES = { ssh: 22, openssh: 22, mqtt: 1883, 'secure-mqtt': 8883, http: 80 };

  function ipToInt(ip) { return ip.split('.').reduce((a, x) => a * 256 + Number(x), 0); }
  function validIp(s) { return /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(s) && s.split('.').every(x => Number(x) <= 255); }
  function inCidr(ip, cidr) {
    if (cidr === 'any') return true;
    const [base, bits] = cidr.split('/');
    const n = bits === undefined ? 32 : Number(bits);
    if (n === 0) return true;
    const mask = n === 32 ? 0xffffffff : (~((1 << (32 - n)) - 1)) >>> 0;
    return ((ipToInt(ip) & mask) >>> 0) === ((ipToInt(base) & mask) >>> 0);
  }
  const isLan = ip => inCidr(ip, '192.168.1.0/24');

  function parse(text) {
    const ssh = Object.assign({}, SSH_DEFAULTS);
    const sshSet = {};
    const ufw = { enabled: false, defaultIncoming: 'deny', rules: [], touched: false };
    const warnings = [];
    String(text).split('\n').forEach((raw, i) => {
      const n = i + 1;
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      if (/[Ͱ-Ͽ]/.test(line)) throw new SysError('Βρέθηκαν ελληνικοί χαρακτήρες σε ρύθμιση.', n, 'Οι ρυθμίσεις γράφονται με λατινικούς χαρακτήρες. Τα ελληνικά επιτρέπονται μόνο σε σχόλια (γραμμή που ξεκινά με #).');
      const w = line.split(/\s+/);
      if (w[0] === 'sudo') w.shift();
      if (w[0] === 'ufw') { parseUfw(w.slice(1), n, ufw); ufw.touched = true; return; }
      const key = w[0].toLowerCase();
      const def = SSH_KEYS[key];
      if (!def) throw new SysError(`Άγνωστη ρύθμιση «${w[0]}».`, n, `Υποστηρίζονται: ${Object.values(SSH_KEYS).map(d => d.name).join(', ')} και εντολές ufw.`);
      if (w.length < 2) throw new SysError(`Λείπει η τιμή της ${def.name}.`, n);
      if (sshSet[key]) {
        warnings.push({ line: n, text: `Η ${def.name} υπάρχει ήδη στη γραμμή ${sshSet[key]}. Το sshd κρατά την ΠΡΩΤΗ τιμή, άρα αυτή η γραμμή αγνοείται.`, hint: 'Άφησε κάθε ρύθμιση μία φορά.' });
        return;
      }
      sshSet[key] = n;
      if (def.list) ssh[key] = w.slice(1);
      else if (def.number) {
        const v = Number(w[1]);
        if (!Number.isInteger(v) || v < 1 || v > 65535) throw new SysError(`Η ${def.name} θέλει αριθμό.`, n);
        ssh[key] = v;
      } else {
        const v = w[1].toLowerCase();
        if (!def.values.includes(v)) throw new SysError(`Η ${def.name} δέχεται: ${def.values.join(', ')}.`, n);
        ssh[key] = v === 'without-password' ? 'prohibit-password' : v;
      }
    });
    if (ssh.permitrootlogin === 'yes') warnings.push({ line: sshSet.permitrootlogin, text: 'PermitRootLogin yes: ο root μπορεί να συνδεθεί κατευθείαν μέσω SSH.', hint: 'Γράψε PermitRootLogin no. Συνδέσου με δικό σου χρήστη και χρησιμοποίησε sudo.' });
    if (ssh.passwordauthentication === 'yes') warnings.push({ line: sshSet.passwordauthentication || null, text: 'Η σύνδεση SSH με κωδικό είναι ενεργή' + (sshSet.passwordauthentication ? '' : ' (προεπιλογή)') + ': όποιος φτάνει στη θύρα μπορεί να δοκιμάζει κωδικούς.', hint: 'Με κλειδιά SSH: PasswordAuthentication no.' });
    if (ssh.permitemptypasswords === 'yes') warnings.push({ line: sshSet.permitemptypasswords, text: 'PermitEmptyPasswords yes: λογαριασμοί χωρίς κωδικό μπαίνουν χωρίς τίποτα.', hint: 'Γράψε PermitEmptyPasswords no.' });
    if (!ufw.enabled && ufw.touched) warnings.push({ line: null, text: 'Υπάρχουν κανόνες ufw αλλά λείπει το «ufw enable»: ο firewall δεν είναι ενεργός και δεν μπλοκάρει τίποτα.', hint: 'Πρόσθεσε ufw enable.' });
    if (ufw.enabled && ufw.defaultIncoming === 'allow') warnings.push({ line: null, text: 'ufw default allow incoming: ό,τι δεν απαγορεύεται ρητά, επιτρέπεται.', hint: 'Η ασφαλής βάση είναι ufw default deny incoming και μετά allow μόνο όσα χρειάζονται.' });
    for (const r of ufw.rules) {
      if (r.action !== 'deny' && r.action !== 'reject' && r.from === 'any' && (r.port === ssh.port || r.port === null)) {
        warnings.push({ line: r.line, text: `Το SSH (θύρα ${ssh.port}) ανοίγει σε όλο το Internet${r.action === 'limit' ? ', έστω και με όριο συνδέσεων' : ''}.`, hint: `Αν το διαχειρίζεσαι μόνο από το σπίτι: ufw ${r.action === 'limit' ? 'limit' : 'allow'} from 192.168.1.0/24 to any port ${ssh.port} proto tcp` });
      }
      if (r.action !== 'deny' && r.action !== 'reject' && r.from === 'any' && (r.port === 1883 || r.port === 5000)) {
        warnings.push({ line: r.line, text: `Η θύρα ${r.port} (${SERVICES[r.port]}) ανοίγει για όλους, όχι μόνο για το δίκτυο του σπιτιού.`, hint: `Περιόρισέ την: ufw allow from 192.168.1.0/24 to any port ${r.port}` });
      }
    }
    const allowsSsh = ufw.rules.some(r => r.action !== 'deny' && r.action !== 'reject' && (r.port === null || r.port === ssh.port));
    if (ufw.enabled && ufw.defaultIncoming !== 'allow' && !allowsSsh) {
      warnings.push({ line: null, text: `Ο firewall ενεργοποιείται χωρίς κανόνα για το SSH (θύρα ${ssh.port}): θα κλειδωθείς έξω από το Pi.`, hint: `Πριν από το ufw enable γράψε π.χ. ufw allow from 192.168.1.0/24 to any port ${ssh.port} proto tcp` });
    }
    return { config: { ssh, ufw }, warnings };
  }

  function parsePort(tok, n) {
    const m = /^(\d+)(?:\/(tcp|udp))?$/.exec(tok);
    if (m) return { port: Number(m[1]), proto: m[2] || null };
    const name = tok.toLowerCase();
    if (SERVICE_NAMES[name]) return { port: SERVICE_NAMES[name], proto: 'tcp' };
    throw new SysError(`Δεν καταλαβαίνω τη θύρα «${tok}».`, n, 'Γράψε αριθμό θύρας, π.χ. 22/tcp ή 8883, ή το όνομα ssh.');
  }

  function parseUfw(w, n, ufw) {
    const cmd = w[0];
    if (cmd === 'enable') { ufw.enabled = true; return; }
    if (cmd === 'disable') { ufw.enabled = false; return; }
    if (cmd === 'default') {
      if (!['allow', 'deny', 'reject'].includes(w[1]) || !['incoming', 'outgoing', 'routed'].includes(w[2])) throw new SysError('Η μορφή είναι: ufw default deny incoming', n);
      if (w[2] === 'incoming') ufw.defaultIncoming = w[1];
      return;
    }
    if (!['allow', 'deny', 'reject', 'limit'].includes(cmd)) throw new SysError(`Άγνωστη εντολή ufw «${cmd || ''}».`, n, 'Υποστηρίζονται: ufw enable, ufw default deny incoming, ufw allow/deny/limit …');
    const rule = { action: cmd, from: 'any', port: null, proto: null, line: n };
    let i = 1;
    if (w[i] === 'in') i++;
    if (w[i] === 'from') {
      const src = w[i + 1];
      if (!src) throw new SysError('Λείπει η διεύθυνση μετά το from.', n);
      if (src !== 'any') {
        const [ip, bits] = src.split('/');
        if (!validIp(ip) || (bits !== undefined && !(Number(bits) >= 0 && Number(bits) <= 32))) throw new SysError(`Η «${src}» δεν είναι έγκυρη διεύθυνση ή δίκτυο.`, n, 'Π.χ. 192.168.1.0/24 για όλο το δίκτυο του σπιτιού, ή 192.168.1.20 για μία συσκευή.');
      }
      rule.from = src;
      i += 2;
      if (w[i] === 'to') { if (w[i + 1] !== 'any' && w[i + 1] !== PI_IP) throw new SysError('Μετά το to γράψε any.', n); i += 2; }
      if (w[i] === 'port') { const p = parsePort(w[i + 1] || '', n); rule.port = p.port; rule.proto = p.proto; i += 2; }
      if (w[i] === 'proto') { if (!['tcp', 'udp'].includes(w[i + 1])) throw new SysError('Το proto είναι tcp ή udp.', n); rule.proto = w[i + 1]; i += 2; }
    } else {
      if (!w[i]) throw new SysError('Λείπει η θύρα.', n, 'Π.χ. ufw allow 8883/tcp');
      const p = parsePort(w[i], n);
      rule.port = p.port; rule.proto = p.proto; i++;
    }
    if (i < w.length) throw new SysError(`Περισσεύει το «${w.slice(i).join(' ')}».`, n);
    ufw.rules.push(rule);
  }

  // ---------------------------------------------------------- αξιολόγηση

  class System {
    constructor(config, opts) {
      opts = opts || {};
      this.c = config;
      this.services = opts.services || [22, 1883, 8883, 5000];
      this.users = opts.users || { hubadmin: { key: true, password: 'Hub-Admin-Lab-2026' }, pi: { key: false, password: 'raspberry' }, root: { key: false, password: 'root-lab' } };
      this.log = [];
      this.hits = {};
      this.t = 0;
      this.nextPort = 51514;
    }
    addLog(text) { this.t += 1; this.log.push({ id: this.log.length + 1, t: this.t, text }); }
    stamp() { const s = 8 * 3600 + this.t; const z = x => String(x).padStart(2, '0'); return `Oct 15 ${z(Math.floor(s / 3600))}:${z(Math.floor(s / 60) % 60)}:${z(s % 60)} pi-hub`; }

    // Μία σύνδεση TCP στη θύρα: { ok, message }
    connect(from, port, proto) {
      proto = proto || 'tcp';
      this.t += 1;
      const sp = this.nextPort++;
      const u = this.c.ufw;
      let verdict = 'allow';
      let how = 'ο firewall είναι ανενεργός';
      if (u.enabled) {
        const r = u.rules.find(x => (x.port === null || x.port === port) && (x.proto === null || x.proto === proto) && inCidr(from, x.from));
        if (r) {
          verdict = r.action;
          how = `κανόνας στη γραμμή ${r.line}`;
          if (r.action === 'limit') {
            // ufw limit: μπλοκάρει μια IP που κάνει πάνω από 6 συνδέσεις μέσα σε 30 δευτερόλεπτα.
            const key = from + ':' + port;
            const recent = (this.hits[key] || []).filter(t => this.t - t < 30);
            recent.push(this.t);
            this.hits[key] = recent;
            verdict = recent.length > 6 ? 'limited' : 'allow';
          }
        } else { verdict = u.defaultIncoming; how = `καμία εξαίρεση → default ${u.defaultIncoming} incoming`; }
      }
      if (verdict === 'deny' || verdict === 'reject' || verdict === 'limited') {
        this.addLog(`${this.stamp()} kernel: [UFW ${verdict === 'limited' ? 'LIMIT BLOCK' : 'BLOCK'}] IN=eth0 OUT= SRC=${from} DST=${PI_IP} PROTO=${proto.toUpperCase()} SPT=${sp} DPT=${port}`);
        return { ok: false, message: verdict === 'limited' ? `Ο firewall μπλόκαρε το ${from}: πάρα πολλές συνδέσεις στη θύρα ${port} σε λίγο χρόνο (ufw limit).` : `Ο firewall μπλόκαρε τη σύνδεση από ${from} στη θύρα ${port} (${how}).` };
      }
      if (!this.services.includes(port)) return { ok: false, message: `Η θύρα ${port} πέρασε τον firewall, αλλά καμία υπηρεσία δεν ακούει εκεί (Connection refused).` };
      return { ok: true, message: `Η σύνδεση από ${from} στη θύρα ${port} (${SERVICES[port] || 'υπηρεσία'}) επιτράπηκε (${how}).` };
    }

    // Δοκιμή SSH: { from, user, auth: 'key'|'password', password }
    ssh(a) {
      const s = this.c.ssh;
      const port = a.port || s.port;
      const net = this.connect(a.from, port, 'tcp');
      if (!net.ok) return net;
      const user = a.user || 'pi';
      const sp = this.nextPort - 1;
      const pre = `${this.stamp()} sshd[${1200 + this.log.length}]:`;
      const acct = this.users[user];
      if (s.allowusers && !s.allowusers.includes(user)) {
        this.addLog(`${pre} User ${user} from ${a.from} not allowed because not listed in AllowUsers`);
        this.addLog(`${pre} Connection closed by invalid user ${user} ${a.from} port ${sp} [preauth]`);
        return { ok: false, message: `Ο χρήστης ${user} δεν είναι στο AllowUsers.` };
      }
      if (!acct) {
        this.addLog(`${pre} Invalid user ${user} from ${a.from} port ${sp}`);
        if (a.auth === 'password' && s.passwordauthentication === 'yes') this.addLog(`${pre} Failed password for invalid user ${user} from ${a.from} port ${sp} ssh2`);
        return { ok: false, message: `Ο χρήστης ${user} δεν υπάρχει στο Pi.` };
      }
      if (user === 'root' && (s.permitrootlogin === 'no' || (s.permitrootlogin === 'prohibit-password' && a.auth === 'password'))) {
        if (a.auth === 'password' && s.passwordauthentication === 'yes') this.addLog(`${pre} Failed password for root from ${a.from} port ${sp} ssh2`);
        this.addLog(`${pre} ROOT LOGIN REFUSED FROM ${a.from} port ${sp}`);
        return { ok: false, message: 'Η σύνδεση ως root απορρίφθηκε (PermitRootLogin).' };
      }
      if (a.auth === 'key') {
        if (s.pubkeyauthentication !== 'yes' || !acct.key) {
          this.addLog(`${pre} Connection closed by authenticating user ${user} ${a.from} port ${sp} [preauth]`);
          return { ok: false, message: s.pubkeyauthentication !== 'yes' ? 'Η σύνδεση με κλειδί είναι κλειστή (PubkeyAuthentication no).' : `Ο ${user} δεν έχει εγκατεστημένο δημόσιο κλειδί.` };
        }
        this.addLog(`${pre} Accepted publickey for ${user} from ${a.from} port ${sp} ssh2: ED25519 SHA256:Lab3xAmPLEk3yF1ngerPr1nt`);
        return { ok: true, message: `Ο ${user} μπήκε με κλειδί SSH.` };
      }
      if (s.passwordauthentication !== 'yes') {
        this.addLog(`${pre} Connection closed by authenticating user ${user} ${a.from} port ${sp} [preauth]`);
        return { ok: false, message: 'Η σύνδεση με κωδικό είναι κλειστή (PasswordAuthentication no): ο client βλέπει «Permission denied (publickey)».' };
      }
      const pass = a.password === undefined ? acct.password : a.password;
      if (pass !== acct.password) {
        this.addLog(`${pre} Failed password for ${user} from ${a.from} port ${sp} ssh2`);
        return { ok: false, message: 'Λάθος κωδικός.' };
      }
      this.addLog(`${pre} Accepted password for ${user} from ${a.from} port ${sp} ssh2`);
      return { ok: true, message: `Ο ${user} μπήκε με κωδικό.` };
    }
  }

  // Περίληψη για το πάνελ «Πώς το διαβάζει το Pi»: κάθε υπηρεσία από το σπίτι και από το Internet.
  function exposure(config) {
    const out = [];
    for (const port of [22, 1883, 8883, 5000]) {
      const sys = new System(config);
      const lan = sys.connect('192.168.1.77', port).ok;
      const wan = sys.connect('203.0.113.50', port).ok;
      out.push({ port, name: SERVICES[port], lan, wan });
    }
    return out;
  }

  function runTest(text, test, lesson) {
    let parsed;
    try { parsed = parse(text); } catch (e) {
      return { name: test.name, pass: false, message: e.message + (e.hint ? ' ' + e.hint : ''), line: e.line, codeError: true };
    }
    const sys = new System(parsed.config, (lesson && lesson.world) || {});
    for (const step of test.script) {
      let r = { ok: true };
      if (step.connect) r = sys.connect(step.connect.from, step.connect.port, step.connect.proto);
      else if (step.ssh) r = sys.ssh(step.ssh);
      else if (step.wait) sys.t += step.wait;
      else if (step.burst) {
        for (let k = 0; k < (step.burst.count || 10); k++) r = step.burst.ssh ? sys.ssh(Object.assign({ from: step.burst.from }, step.burst.ssh)) : sys.connect(step.burst.from, step.burst.port || 22);
      }
      if (step.expect && (!!r.ok) !== (step.expect === 'allow')) {
        return { name: test.name, pass: false, message: String(step.fail || '').replace('{v}', r.message || ''), log: sys.log.slice() };
      }
    }
    return { name: test.name, pass: true, message: '', log: sys.log.slice() };
  }

  root.IoTSys = { parse, System, runTest, exposure, SERVICES, inCidr, PI_IP };
})(typeof window !== 'undefined' ? window : globalThis);
