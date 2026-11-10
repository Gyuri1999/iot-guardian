/*
 * IoT Guardian — «Βρες τον εισβολέα»: μίνι παιχνίδι άμυνας δικτύου (εκπαιδευτική προσομοίωση).
 *
 * Πακέτα ταξιδεύουν στο δίκτυο του σπιτιού και σταματούν στο router. Ο μαθητής διαβάζει την «ταυτότητα»
 * του πακέτου (από πού, προς τα πού, θύρα, κρυπτογράφηση, τι λέει) και αποφασίζει: να περάσει ή να
 * μπλοκαριστεί. Κάθε μπλοκ γίνεται ένας κανόνας firewall. Χωρίς χρονόμετρο: το πακέτο περιμένει.
 * Μόνο άμυνα: όλα τα δεδομένα, οι διευθύνσεις (εύρη τεκμηρίωσης RFC 5737) και τα ονόματα είναι συνθετικά.
 *
 * Μορφή γύρου (ROUNDS):
 *   { id, title, goal, tips: [...], lesson, packets: [
 *       { from, to, addr (διεύθυνση αποστολέα), port, service, enc: true|false, says,
 *         bad: true|false, why, harm (αν περάσει ενώ είναι κακό) | need (αν μπλοκαριστεί ενώ είναι καλό),
 *         rule (κανόνας firewall, μόνο για τα κακά) } ] }
 */
(function (root) {
  'use strict';

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const W = 680, H = 380;

  const NODES = [
    { id: 'net', icon: '☁️', label: 'Internet', x: 90, y: 190, big: true },
    { id: 'router', icon: '🛡️', label: 'Router · firewall', x: 290, y: 190, big: true },
    { id: 'cam', icon: '📷', label: 'Κάμερα', x: 450, y: 70 },
    { id: 'lock', icon: '🔒', label: 'Κλειδαριά', x: 600, y: 70 },
    { id: 'lamp', icon: '💡', label: 'Λάμπα', x: 450, y: 165 },
    { id: 'thermo', icon: '🌡️', label: 'Θερμοστάτης', x: 600, y: 165 },
    { id: 'esp', icon: '📟', label: 'ESP32 αισθητήρας', x: 450, y: 260 },
    { id: 'pi', icon: '🍓', label: 'Raspberry Pi · broker', x: 600, y: 260 },
    { id: 'tablet', icon: '📱', label: 'Tablet της Μαρίας', x: 525, y: 338 }
  ];
  const NODE = Object.fromEntries(NODES.map(n => [n.id, n]));
  const HUB = { x: NODE.router.x, y: NODE.router.y - 50 }; // εδώ περιμένει το πακέτο, πάνω από το router

  const ROUNDS = [
    {
      id: 'r1', title: 'Κωδικοί στην πόρτα',
      goal: 'Κάποιος από το Internet δοκιμάζει κωδικούς στις συσκευές. Άφησε να περάσουν μόνο όσα είναι του σπιτιού.',
      tips: ['Έρχεται από μέσα (192.168.1.x) ή από το Internet;', 'Δοκιμάζει έναν κωδικό σαν «admin» ή «12345»;', 'Είναι η πρώτη προσπάθεια ή μία από πολλές;'],
      lesson: 'Οι συσκευές IoT δεν πρέπει να δέχονται συνδέσεις με κωδικό από το Internet. Άλλαξε πάντα τον κωδικό που έχει από το εργοστάσιο.',
      packets: [
        { from: 'tablet', to: 'cam', addr: '192.168.1.23', port: 443, service: 'HTTPS · εφαρμογή κάμερας', enc: true, says: 'Σύνδεση ως «maria» (1η προσπάθεια)', bad: false,
          why: 'Έρχεται από το tablet μέσα στο σπίτι, με τον λογαριασμό της Μαρίας και κρυπτογράφηση. Είναι κανονική χρήση.', need: 'Η Μαρία δεν θα έβλεπε την κάμερά της.' },
        { from: 'net', to: 'cam', addr: '203.0.113.45', port: 23, service: 'Telnet', enc: false, says: 'Σύνδεση ως «admin», κωδικός «admin» (προσπάθεια 1 από 60)', bad: true,
          why: 'Άγνωστος από το Internet δοκιμάζει τον κωδικό του εργοστασίου, μέσω Telnet χωρίς κρυπτογράφηση. Έτσι έπιανε κάμερες το botnet Mirai.',
          harm: 'Αν ο κωδικός δεν έχει αλλάξει, ο εισβολέας μπαίνει στην κάμερα.', rule: 'ΜΠΛΟΚ · Internet → Κάμερα · θύρα 23 (Telnet)' },
        { from: 'net', to: 'cam', addr: '203.0.113.45', port: 23, service: 'Telnet', enc: false, says: 'Σύνδεση ως «root», κωδικός «12345» (προσπάθεια 2 από 60)', bad: true,
          why: 'Η ίδια διεύθυνση ξαναδοκιμάζει, με άλλον εύκολο κωδικό. Πολλές προσπάθειες στη σειρά = κάποιος μαντεύει.',
          harm: 'Κάθε προσπάθεια που περνά είναι μια ακόμα ευκαιρία να βρει τον κωδικό.', rule: 'ΜΠΛΟΚ · 203.0.113.45 → όλο το σπίτι (πολλές προσπάθειες)' },
        { from: 'esp', to: 'pi', addr: '192.168.1.40', port: 8883, service: 'MQTT με TLS', enc: true, says: 'Σύνδεση ως «sensor-01» · home/office/temp = 22.5', bad: false,
          why: 'Ο αισθητήρας του σπιτιού στέλνει θερμοκρασία στον δικό μας broker, με TLS. Αυτό θέλουμε.', need: 'Ο broker δεν θα μάθαινε πια τη θερμοκρασία.' },
        { from: 'net', to: 'lock', addr: '198.51.100.9', port: 80, service: 'HTTP', enc: false, says: 'Εντολή «άνοιξε την πόρτα», χωρίς κωδικό', bad: true,
          why: 'Εντολή στην κλειδαριά από άγνωστη διεύθυνση στο Internet, χωρίς κωδικό και χωρίς κρυπτογράφηση. Η κλειδαριά δεν πρέπει να ακούει τέτοια.',
          harm: 'Η πόρτα ανοίγει για έναν άγνωστο.', rule: 'ΜΠΛΟΚ · Internet → Κλειδαριά · κάθε θύρα' }
      ]
    },
    {
      id: 'r2', title: 'Ανοιχτές θύρες',
      goal: 'Κάθε υπηρεσία ακούει σε μια «θύρα». Κλείσε όσες δεν πρέπει να φαίνονται από το Internet.',
      tips: ['Η θύρα 23 (Telnet) και η 1883 (MQTT χωρίς TLS) στέλνουν τα πάντα χωρίς κρυπτογράφηση.', 'Οι ρυθμίσεις του router ανοίγουν μόνο από μέσα.', 'Μέσα στο σπίτι, με TLS, είναι συνήθως εντάξει.'],
      lesson: 'Άνοιξε μόνο τις θύρες που χρειάζεσαι, και μόνο σε όσους τις χρειάζονται. Ό,τι φαίνεται από το Internet το βρίσκουν αυτόματα προγράμματα σάρωσης.',
      packets: [
        { from: 'net', to: 'pi', addr: '203.0.113.88', port: 1883, service: 'MQTT χωρίς TLS', enc: false, says: 'Γράψου σε «#» (όλα τα μηνύματα)', bad: true,
          why: 'Άγνωστος από το Internet ζητά να διαβάζει όλα τα μηνύματα του broker, χωρίς κωδικό και χωρίς κρυπτογράφηση.',
          harm: 'Θα έβλεπε πότε είναι κανείς στο σπίτι, από τους αισθητήρες κίνησης.', rule: 'ΜΠΛΟΚ · Internet → Pi · θύρα 1883 (MQTT)' },
        { from: 'thermo', to: 'pi', addr: '192.168.1.31', port: 8883, service: 'MQTT με TLS', enc: true, says: 'home/living/thermo = 21.0', bad: false,
          why: 'Συσκευή του σπιτιού, στον δικό μας broker, με TLS.', need: 'Ο θερμοστάτης δεν θα έστελνε τη θερμοκρασία.' },
        { from: 'net', to: 'cam', addr: '198.51.100.23', port: 23, service: 'Telnet', enc: false, says: 'Είσαι ανοιχτός; (σάρωση θύρας)', bad: true,
          why: 'Ένα πρόγραμμα σάρωσης ψάχνει συσκευές με ανοιχτό Telnet. Το Telnet δεν πρέπει να φαίνεται από έξω.',
          harm: 'Ο σαρωτής σημειώνει την κάμερα ως στόχο για αργότερα.', rule: 'ΜΠΛΟΚ · Internet → όλα · θύρα 23 (Telnet)' },
        { from: 'tablet', to: 'pi', addr: '192.168.1.23', port: 443, service: 'HTTPS · dashboard', enc: true, says: 'Δείξε μου τις μετρήσεις', bad: false,
          why: 'Η Μαρία ανοίγει το dashboard από το σπίτι, με HTTPS.', need: 'Η Μαρία δεν θα έβλεπε το dashboard.' },
        { from: 'net', to: 'router', addr: '203.0.113.7', port: 80, service: 'HTTP · σελίδα ρυθμίσεων', enc: false, says: 'Σύνδεση στις ρυθμίσεις του router', bad: true,
          why: 'Η σελίδα ρυθμίσεων του router δεν πρέπει να ανοίγει από το Internet. Μόνο από μέσα.',
          harm: 'Αν μπει, μπορεί να αλλάξει όλους τους κανόνες του firewall.', rule: 'ΜΠΛΟΚ · Internet → Router · θύρα 80 (ρυθμίσεις)' }
      ]
    },
    {
      id: 'r3', title: 'Πού πάνε τα δεδομένα;',
      goal: 'Τώρα κοίτα και ό,τι φεύγει από το σπίτι. Μια συσκευή μπορεί να στέλνει κρυφά δεδομένα έξω.',
      tips: ['Ξέρουμε σε ποιον πάει; Είναι η εταιρεία της συσκευής ή άγνωστος;', 'Μια ενημέρωση λογισμικού πρέπει να έχει ψηφιακή υπογραφή.', 'Κωδικοί και βίντεο δεν φεύγουν ποτέ χωρίς κρυπτογράφηση.'],
      lesson: 'Το firewall ελέγχει και ό,τι βγαίνει. Δέξου ενημερώσεις μόνο με έγκυρη υπογραφή, και πρόσεχε συσκευές που στέλνουν πολλά δεδομένα σε αγνώστους.',
      packets: [
        { from: 'cam', to: 'net', addr: '192.168.1.50 → 203.0.113.200', port: 9000, service: 'άγνωστη', enc: false, says: 'Βίντεο σαλονιού, 2 GB, ώρα 03:12', bad: true,
          why: 'Η κάμερα στέλνει βίντεο σε άγνωστο server, μέσα στη νύχτα, χωρίς κρυπτογράφηση. Κάποιος την έχει πάρει στον έλεγχό του.',
          harm: 'Το βίντεο από το σαλόνι φτάνει σε έναν άγνωστο.', rule: 'ΜΠΛΟΚ · Κάμερα → 203.0.113.200 · και έλεγχος της κάμερας' },
        { from: 'net', to: 'lamp', addr: 'updates.lamp-maker.example', port: 443, service: 'HTTPS · ενημέρωση', enc: true, says: 'Νέο λογισμικό v2.4 · υπογραφή εταιρείας: έγκυρη ✓', bad: false,
          why: 'Ενημέρωση από την εταιρεία της λάμπας, με HTTPS και έγκυρη ψηφιακή υπογραφή. Οι ενημερώσεις διορθώνουν κενά ασφαλείας.', need: 'Η λάμπα θα έμενε με παλιό λογισμικό που έχει κενά.' },
        { from: 'net', to: 'lamp', addr: '198.51.100.66', port: 8080, service: 'HTTP · «ενημέρωση»', enc: false, says: 'Νέο λογισμικό! · υπογραφή: καμία', bad: true,
          why: 'Λογισμικό χωρίς υπογραφή, από άγνωστη διεύθυνση. Μπορεί να είναι κακόβουλο.',
          harm: 'Η λάμπα θα έτρεχε κώδικα ενός αγνώστου.', rule: 'ΜΠΛΟΚ · ενημερώσεις χωρίς έγκυρη υπογραφή' },
        { from: 'esp', to: 'pi', addr: '192.168.1.40', port: 8883, service: 'MQTT με TLS', enc: true, says: 'home/office/motion = 0', bad: false,
          why: 'Κανονική μέτρηση μέσα στο σπίτι, με TLS.', need: 'Ο συναγερμός δεν θα μάθαινε για κίνηση.' },
        { from: 'lock', to: 'net', addr: '192.168.1.60 → 203.0.113.99', port: 80, service: 'HTTP', enc: false, says: 'Λίστα κωδικών πόρτας: 4821, 1977…', bad: true,
          why: 'Κωδικοί που φεύγουν από το σπίτι, χωρίς κρυπτογράφηση, προς άγνωστο. Κανείς δεν πρέπει να τους μάθει.',
          harm: 'Ο άγνωστος μαθαίνει τους κωδικούς της πόρτας.', rule: 'ΜΠΛΟΚ · Κλειδαριά → Internet (εκτός από την εταιρεία της)' }
      ]
    },
    {
      id: 'r4', title: 'Η συσκευή-ζόμπι',
      goal: 'Μια συσκευή του σπιτιού έχει γίνει «ζόμπι» σε botnet. Βρες την και απομόνωσέ την, χωρίς να χαλάσεις τα υπόλοιπα.',
      tips: ['Πόσα πακέτα στέλνει; Μια λάμπα δεν στέλνει χιλιάδες το δευτερόλεπτο.', 'Εντολές «κατέβασε αυτό το αρχείο» από άγνωστο είναι ύποπτες.', 'Ώρα (NTP) και ονόματα (DNS) είναι κανονική κίνηση.'],
      lesson: 'Αν μια συσκευή στέλνει τεράστια κίνηση ή παίρνει εντολές από άγνωστους, απομόνωσέ την, άλλαξε τον κωδικό της και ενημέρωσέ την. Μην κόβεις στα τυφλά όλο το Internet.',
      packets: [
        { from: 'cam', to: 'net', addr: '192.168.1.50 → 198.51.100.10', port: 80, service: 'HTTP', enc: false, says: '5.000 αιτήματα το δευτερόλεπτο προς τον ίδιο server', bad: true,
          why: 'Χιλιάδες αιτήματα προς έναν στόχο: η κάμερα συμμετέχει σε επίθεση DDoS. Είναι «ζόμπι».',
          harm: 'Το σπίτι βοηθά να πέσει ένας server κάποιου άλλου.', rule: 'ΑΠΟΜΟΝΩΣΗ · Κάμερα: χωρίς Internet μέχρι να καθαριστεί' },
        { from: 'tablet', to: 'net', addr: '192.168.1.23', port: 53, service: 'DNS', enc: false, says: 'Ποια διεύθυνση έχει το weather.example;', bad: false,
          why: 'Το DNS μεταφράζει ονόματα σε διευθύνσεις. Είναι η πιο συνηθισμένη κίνηση στο Internet.', need: 'Το tablet δεν θα έβρισκε καμία σελίδα.' },
        { from: 'thermo', to: 'pi', addr: '192.168.1.31', port: 8883, service: 'MQTT με TLS', enc: true, says: 'home/living/thermo = 21.5', bad: false,
          why: 'Κανονική μέτρηση μέσα στο σπίτι, με TLS.', need: 'Ο θερμοστάτης θα σταματούσε να στέλνει.' },
        { from: 'net', to: 'cam', addr: '203.0.113.45', port: 23, service: 'Telnet', enc: false, says: 'Εντολή: «κατέβασε το αρχείο bot.sh και τρέξ’ το»', bad: true,
          why: 'Ο ελεγκτής του botnet στέλνει εντολές στην κάμερα-ζόμπι. Αυτή η σύνδεση πρέπει να κοπεί.',
          harm: 'Η κάμερα παίρνει νέες εντολές επίθεσης.', rule: 'ΜΠΛΟΚ · 203.0.113.45 (ελεγκτής botnet) → όλο το σπίτι' },
        { from: 'pi', to: 'net', addr: '192.168.1.10', port: 123, service: 'NTP · ώρα', enc: false, says: 'Τι ώρα είναι;', bad: false,
          why: 'Το Pi ρωτά την ακριβή ώρα. Τη χρειάζεται, π.χ. για να ελέγχει τα πιστοποιητικά TLS.', need: 'Το ρολόι του Pi θα πήγαινε λάθος και το TLS θα αποτύγχανε.' }
      ]
    }
  ];

  // Έλεγχος δεδομένων (και για τα τεστ): λίστα προβλημάτων, κενή = εντάξει.
  function check(r) {
    const errs = [];
    if (!r.id || !r.title || !r.goal || !r.lesson) errs.push('λείπει id / τίτλος / στόχος / μάθημα');
    if (!Array.isArray(r.tips) || !r.tips.length) errs.push('χωρίς βοήθειες');
    const ps = r.packets || [];
    if (ps.length < 3) errs.push('λίγα πακέτα');
    if (!ps.some(p => p.bad) || !ps.some(p => !p.bad)) errs.push('χρειάζονται και καλά και κακά πακέτα');
    ps.forEach((p, i) => {
      for (const k of ['from', 'to']) if (!NODE[p[k]]) errs.push(`πακέτο ${i + 1}: άγνωστη συσκευή «${p[k]}»`);
      if (p.from === p.to) errs.push(`πακέτο ${i + 1}: ίδιος αποστολέας και παραλήπτης`);
      if (p.from === 'router') errs.push(`πακέτο ${i + 1}: δεν ξεκινά από το router`);
      if (!p.addr || !p.service || !p.says || !p.why || typeof p.enc !== 'boolean' || typeof p.bad !== 'boolean' || !(p.port > 0)) errs.push(`πακέτο ${i + 1}: ελλιπές`);
      if (p.bad && (!p.harm || !p.rule)) errs.push(`πακέτο ${i + 1}: κακό χωρίς harm / rule`);
      if (!p.bad && !p.need) errs.push(`πακέτο ${i + 1}: καλό χωρίς need`);
      // μόνο συνθετικές διευθύνσεις: ιδιωτικές 192.168.x.x ή τεκμηρίωσης (RFC 5737) ή *.example
      for (const ip of String(p.addr).match(/\d+\.\d+\.\d+\.\d+/g) || []) if (!/^(192\.168\.|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/.test(ip)) errs.push(`πακέτο ${i + 1}: μη συνθετική διεύθυνση ${ip}`);
      for (const host of String(p.addr).match(/[a-z][a-z0-9-]*(\.[a-z0-9-]+)+/gi) || []) if (!/\.example$/.test(host)) errs.push(`πακέτο ${i + 1}: όνομα εκτός .example`);
    });
    return errs;
  }

  // choice: 'allow' | 'block' → { correct, packet }
  function judge(p, choice) {
    return { correct: (choice === 'block') === !!p.bad, packet: p };
  }
  const stars = mistakes => (mistakes <= 0 ? 3 : mistakes === 1 ? 2 : 1);
  const unlocked = (progress, i) => i === 0 || !!(progress && progress[ROUNDS[i - 1].id]);

  // ------------------------------------------------------------ σκηνή

  function svgScene() {
    const links = NODES.filter(n => n.id !== 'router').map(n => `<line class="itr-link${n.id === 'net' ? ' wan' : ''}" x1="${NODE.router.x}" y1="${NODE.router.y}" x2="${n.x}" y2="${n.y}"/>`).join('');
    const nodes = NODES.map(n => {
      const r = n.big ? 34 : 24;
      return `<g class="itr-node" id="itr-n-${n.id}" transform="translate(${n.x},${n.y})">
        <circle r="${r}" class="itr-ring"/><text class="itr-ic" text-anchor="middle" dy="${n.big ? 11 : 8}" style="font-size:${n.big ? 30 : 22}px">${n.icon}</text>
        <text class="itr-lb" text-anchor="middle" y="${r + 15}">${esc(n.label)}</text></g>`;
    }).join('');
    return `<svg class="itr-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Το δίκτυο του σπιτιού: Internet, router και οι συσκευές">
      <g class="itr-zone"><rect x="10" y="30" width="170" height="320" rx="14"/><text x="22" y="50">Έξω · Internet</text></g>
      <g class="itr-zone home"><rect x="380" y="18" width="292" height="356" rx="14"/><text x="392" y="38">Μέσα · Το σπίτι</text></g>
      ${links}${nodes}
      <g class="itr-shield" id="itr-shield" transform="translate(${NODE.router.x},${NODE.router.y})"><circle r="46"/></g>
      <g class="itr-pkt" id="itr-pkt" transform="translate(-50,-50)"><rect x="-15" y="-10" width="30" height="20" rx="4"/><path d="M-15,-9 L0,2 L15,-9"/></g>
    </svg>`;
  }

  function mount(el, opts) {
    opts = opts || {};
    const progress = Object.assign({}, opts.progress || {});
    const motion = () => (opts.motion ? opts.motion() : true);
    const sfx = n => { if (opts.sfx) opts.sfx(n); };
    let token = 0; // ακυρώνει κινήσεις όταν αλλάζει η οθόνη
    let raf = 0;
    let tm = 0;

    function stopAnim() { token++; if (raf) cancelAnimationFrame(raf); clearTimeout(tm); raf = 0; }

    function menu() {
      stopAnim();
      el.innerHTML = `<div class="itr-rounds">${ROUNDS.map((r, i) => {
        const open = unlocked(progress, i);
        const st = progress[r.id] || 0;
        return `<button type="button" class="itr-round${st ? ' done' : ''}" data-r="${i}" ${open ? '' : 'disabled'}>
          <span class="itr-rn">${i + 1}</span>
          <span class="itr-rb"><b>${esc(r.title)}</b><small>${esc(r.goal)}</small></span>
          <span class="itr-rs" aria-label="${st} από 3 αστέρια">${open ? '★'.repeat(st) + '☆'.repeat(3 - st) : '🔒'}</span></button>`;
      }).join('')}</div>`;
      el.querySelectorAll('[data-r]').forEach(b => { b.onclick = () => play(Number(b.dataset.r)); });
    }

    function play(ri) {
      stopAnim();
      const r = ROUNDS[ri];
      const st = { i: 0, mistakes: 0, rules: [] };
      el.innerHTML = `<div class="itr-play">
        <div class="itr-top"><button class="btn sm" id="itr-back">← Γύροι</button>
          <h2>Γύρος ${ri + 1} · ${esc(r.title)}</h2>
          <span class="itr-count" id="itr-count"></span></div>
        <p class="itr-goal">${esc(r.goal)}</p>
        <div class="itr-grid">
          <div class="itr-stage">${svgScene()}</div>
          <div class="itr-side">
            <div class="itr-panel" id="itr-panel" aria-live="polite"></div>
            <div class="itr-fw"><h3>🧱 Οι κανόνες του firewall σου</h3><ol id="itr-rules"><li class="muted">Κανένας ακόμα.</li></ol></div>
          </div>
        </div></div>`;
      el.querySelector('#itr-back').onclick = menu;
      const $ = s => el.querySelector(s);
      const pkt = $('#itr-pkt');
      const panel = $('#itr-panel');
      const place = (x, y) => pkt.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`);

      function travel(a, b, dur) {
        const my = token;
        return new Promise(res => {
          if (!motion()) { place(b.x, b.y); res(my === token); return; }
          const t0 = performance.now();
          const ease = x => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
          // κάθε καρέ με requestAnimationFrame· αν η καρτέλα δεν δίνει καρέ (κρυφή), ένα χρονόμετρο συνεχίζει
          const tick = () => {
            let done = false;
            const go = () => { if (done) return; done = true; cancelAnimationFrame(raf); clearTimeout(tm); f(performance.now()); };
            raf = requestAnimationFrame(go);
            tm = setTimeout(go, 60);
          };
          const f = now => {
            if (my !== token) { res(false); return; }
            const x = Math.min(1, (now - t0) / dur);
            const e = ease(x);
            place(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e);
            if (x < 1) tick(); else res(true);
          };
          tick();
        });
      }
      const flash = (id, cls) => {
        const n = $('#itr-n-' + id);
        if (!n) return;
        n.classList.remove('ok', 'hit', 'cut');
        void n.getBoundingClientRect();
        n.classList.add(cls);
      };
      const mark = (id, on) => { const n = $('#itr-n-' + id); if (n) n.classList.toggle('active', on); };

      function rulesView() {
        $('#itr-rules').innerHTML = st.rules.length ? st.rules.map(t => `<li>${esc(t)}</li>`).join('') : '<li class="muted">Κανένας ακόμα.</li>';
      }

      function card(p) {
        const from = NODE[p.from], to = NODE[p.to];
        const help = r.tips.map(t => `<li>${esc(t)}</li>`).join('');
        panel.innerHTML = `<div class="itr-card">
          <h3>📦 Πακέτο στο router: τι κάνουμε;</h3>
          <dl>
            <dt>Από</dt><dd>${from.icon} ${esc(from.label)} <code>${esc(p.addr)}</code></dd>
            <dt>Προς</dt><dd>${to.icon} ${esc(to.label)}</dd>
            <dt>Θύρα</dt><dd><code>${p.port}</code> · ${esc(p.service)}</dd>
            <dt>Κρυπτογράφηση</dt><dd>${p.enc ? '🔐 ναι' : '⚠️ όχι'}</dd>
            <dt>Τι λέει</dt><dd>«${esc(p.says)}»</dd>
          </dl>
          <div class="itr-act">
            <button class="btn primary" id="itr-allow">✅ Άφησέ το να περάσει</button>
            <button class="btn danger" id="itr-block">⛔ Μπλόκαρε</button>
          </div>
          <div class="itr-tools">
            ${opts.speak ? '<button class="btn quiet sm" id="itr-say">🔊 Άκουσε</button>' : ''}
            <details class="itr-help"><summary>💡 Βοήθεια</summary><ul>${help}</ul></details>
          </div></div>`;
        $('#itr-allow').onclick = () => decide(p, 'allow');
        $('#itr-block').onclick = () => decide(p, 'block');
        if ($('#itr-say')) $('#itr-say').onclick = () => opts.speak(`Από ${from.label}, προς ${to.label}. Θύρα ${p.port}, ${p.service}. Κρυπτογράφηση: ${p.enc ? 'ναι' : 'όχι'}. Λέει: ${p.says}`);
        $('#itr-allow').focus({ preventScroll: true });
      }

      async function decide(p, choice) {
        const j = judge(p, choice);
        if (!j.correct) st.mistakes++;
        $('#itr-count').textContent = `Πακέτο ${st.i + 1}/${r.packets.length} · λάθη: ${st.mistakes}`;
        panel.querySelectorAll('.itr-act button').forEach(b => { b.disabled = true; });
        sfx(j.correct ? 'tick' : 'err');
        const shield = $('#itr-shield');
        const head = j.correct ? '<p class="itr-ok">✓ Σωστά!</p>' : '<p class="itr-no">✗ Όχι αυτή τη φορά.</p>';
        let what = '';
        if (choice === 'allow') {
          pkt.classList.add(p.bad ? 'evil' : 'good');
          const ok = await travel(HUB, NODE[p.to], 1000);
          if (!ok) return;
          flash(p.to, p.bad ? 'hit' : 'ok');
          if (p.bad) what = `<p class="itr-harm">⚠️ Πέρασε: ${esc(p.harm)}</p>`;
        } else {
          shield.classList.remove('up'); void shield.getBoundingClientRect(); shield.classList.add('up');
          pkt.classList.add('blocked');
          if (!p.bad) { flash(p.to, 'cut'); what = `<p class="itr-harm">⚠️ Κόπηκε κάτι χρήσιμο: ${esc(p.need)}</p>`; }
        }
        if (p.bad) { st.rules.push(p.rule); rulesView(); }
        const last = st.i === r.packets.length - 1;
        panel.innerHTML = `<div class="itr-card itr-fb ${j.correct ? 'right' : 'wrong'}">${head}${what}
          <p>${p.bad ? '<b>Ήταν εισβολέας.</b> ' : '<b>Ήταν κανονική κίνηση.</b> '}${esc(p.why)}</p>
          ${p.bad ? `<p class="itr-rule">Νέος κανόνας: <code>${esc(p.rule)}</code></p>` : ''}
          <button class="btn primary" id="itr-next">${last ? 'Τέλος γύρου →' : 'Επόμενο πακέτο →'}</button></div>`;
        $('#itr-next').onclick = () => { st.i++; if (last) finish(); else next(); };
        $('#itr-next').focus({ preventScroll: true });
      }

      async function next() {
        const p = r.packets[st.i];
        $('#itr-count').textContent = `Πακέτο ${st.i + 1}/${r.packets.length} · λάθη: ${st.mistakes}`;
        pkt.setAttribute('class', 'itr-pkt');
        NODES.forEach(n => mark(n.id, false));
        mark(p.from, true);
        mark('router', true);
        panel.innerHTML = '<div class="itr-card itr-wait"><p>📦 Ένα πακέτο έρχεται προς το router…</p></div>';
        place(NODE[p.from].x, NODE[p.from].y);
        const ok = await travel(NODE[p.from], HUB, 1300);
        if (!ok) return;
        sfx('click');
        card(p);
      }

      function finish() {
        stopAnim();
        NODES.forEach(n => mark(n.id, false));
        pkt.setAttribute('transform', 'translate(-50,-50)');
        const s = stars(st.mistakes);
        const prev = progress[r.id] || 0;
        if (s > prev) progress[r.id] = s;
        if (opts.onResult) opts.onResult(r.id, Math.max(s, prev));
        sfx('win');
        const nextR = ROUNDS[ri + 1];
        panel.innerHTML = `<div class="itr-card itr-end">
          <p class="itr-stars" aria-label="${s} από 3 αστέρια">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</p>
          <h3>Ο γύρος τελείωσε!</h3>
          <p>Λάθη: <b>${st.mistakes}</b> · κανόνες firewall: <b>${st.rules.length}</b></p>
          <div class="itr-lesson"><h4>Τι κρατάμε</h4><p>${esc(r.lesson)}</p></div>
          <div class="itr-act">
            ${nextR ? '<button class="btn primary" id="itr-nextr">Επόμενος γύρος →</button>' : '<p class="itr-ok">🏆 Έκλεισες όλους τους γύρους. Είσαι φύλακας δικτύου!</p>'}
            <button class="btn" id="itr-again">⟲ Ξανά</button>
            <button class="btn" id="itr-menu">Όλοι οι γύροι</button>
          </div></div>`;
        if ($('#itr-nextr')) $('#itr-nextr').onclick = () => play(ri + 1);
        $('#itr-again').onclick = () => play(ri);
        $('#itr-menu').onclick = menu;
        $('#itr-count').textContent = '';
      }

      next();
    }

    menu();
    return { menu, play, stop: stopAnim };
  }

  root.IoTIntruder = { ROUNDS, NODES, check, judge, stars, unlocked, mount };
})(typeof window !== 'undefined' ? window : globalThis);
