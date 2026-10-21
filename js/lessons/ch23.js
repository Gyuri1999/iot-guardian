/*
 * IoT Guardian — Κεφάλαιο 23: Ασφάλεια του Raspberry Pi: SSH, firewall, logs.
 * Ο μαθητής θωρακίζει το ΔΙΚΟ του εικονικό Pi: sshd_config, κανόνες ufw και ανάγνωση auth.log.
 * Τα μαθήματα ρυθμίσεων χρησιμοποιούν το μοντέλο js/pisys.js (mode: 'config', system: true).
 * Όλες οι συνδέσεις και τα logs είναι συνθετικά. Εξωτερικές IP μόνο από δίκτυα τεκμηρίωσης.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 23, title: 'Ασφάλεια του Raspberry Pi: SSH, firewall, logs', ready: true, unlockAfter: 22, lang: 'python' });

  [
    { term: 'SSH', def: 'Ασφαλής απομακρυσμένη σύνδεση σε τερματικό άλλου υπολογιστή, π.χ. στο Raspberry Pi. Ακούει στη θύρα 22.' },
    { term: 'κλειδί SSH', def: 'Ζευγάρι κλειδιών: το ιδιωτικό μένει στον υπολογιστή σου, το δημόσιο μπαίνει στο Pi. Είναι πολύ πιο δύσκολο να μαντευτεί από έναν κωδικό.' },
    { term: 'sshd_config', def: 'Το αρχείο ρυθμίσεων του SSH server στο Pi (/etc/ssh/sshd_config). Ισχύει η ΠΡΩΤΗ τιμή κάθε ρύθμισης.' },
    { term: 'root', def: 'Ο διαχειριστής του Linux, με όλα τα δικαιώματα. Δεν συνδεόμαστε ως root μέσω SSH· μπαίνουμε με δικό μας χρήστη και χρησιμοποιούμε sudo.' },
    { term: 'firewall', def: 'Φίλτρο που αποφασίζει ποιες συνδέσεις φτάνουν στις υπηρεσίες ενός υπολογιστή, με βάση θύρα και διεύθυνση.' },
    { term: 'ufw', def: 'Uncomplicated Firewall: απλό εργαλείο για τον firewall στο Linux. Ο πρώτος κανόνας που ταιριάζει αποφασίζει. Δεν ισχύει τίποτα πριν από το ufw enable.' },
    { term: 'ufw limit', def: 'Κανόνας ufw που επιτρέπει μια θύρα, αλλά μπλοκάρει μια IP που κάνει πάρα πολλές συνδέσεις σε λίγο χρόνο (6 μέσα σε 30 s).' },
    { term: 'AllowUsers', def: 'Ρύθμιση του sshd_config: μόνο οι χρήστες της λίστας μπορούν να συνδεθούν με SSH. Όλοι οι άλλοι απορρίπτονται.' },
    { term: 'auth.log', def: 'Το log του Pi για συνδέσεις και δικαιώματα (/var/log/auth.log): επιτυχίες και αποτυχίες SSH, χρήση sudo.' },
    { term: 'κλείδωμα έξω (lockout)', def: 'Όταν μια αλλαγή ρυθμίσεων κόβει και τη δική σου πρόσβαση, π.χ. firewall χωρίς κανόνα για το SSH. Γι\' αυτό αλλάζεις με προσοχή και δοκιμάζεις πριν κλείσεις τη συνεδρία.' },
    { term: 'ενημερώσεις συστήματος', def: 'Εγκατάσταση διορθώσεων ασφαλείας στο Pi: sudo apt update && sudo apt full-upgrade. Γίνεται τακτικά.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX_SYS = 'PermitRootLogin, PasswordAuthentication, PubkeyAuthentication, AllowUsers, ufw default deny incoming, ufw allow / limit / deny, ufw allow from <δίκτυο> to any port <θύρα> proto tcp, ufw enable, σχόλια με # στην αρχή της γραμμής';
  const SYNTAX_LOGS = 'Επιλογή γραμμών στο auth.log του Pi (sshd, sudo, [UFW BLOCK])';

  const HOME = '192.168.1.20';      // ο υπολογιστής/tablet σου στο σπίτι
  const DEVICE = '192.168.1.43';    // esp32-temp
  const UNKNOWN = '192.168.1.77';   // άγνωστη συσκευή μέσα στο σπίτι
  const NET = '203.0.113.50';       // άγνωστη πηγή από το Internet (δίκτυο τεκμηρίωσης)

  // Φανταστικοί λογαριασμοί του εργαστηρίου.
  // Ο προηγούμενος διαχειριστής είχε αφήσει κλειδί και στον root.
  const USERS_BASIC = {
    hubadmin: { key: true, password: 'Hub-Admin-Lab-2026' },
    pi: { key: false, password: 'raspberry' },
    root: { key: true, password: 'root-lab' }
  };
  // Στα 23.3 και 23.5 ο pi έχει και ένα παλιό κλειδί από ένα παλιό laptop.
  const USERS_OLDKEY = {
    hubadmin: { key: true, password: 'Hub-Admin-Lab-2026' },
    pi: { key: true, password: 'raspberry' },
    root: { key: true, password: 'root-lab' }
  };

  // ---------------------------------------------------------------- βήματα ελέγχου
  const sshKeyOk = (from) => ({ ssh: { from: from || HOME, user: 'hubadmin', auth: 'key' }, expect: 'allow',
    fail: 'Ο hubadmin δεν μπήκε με το κλειδί του από το σπίτι: {v} Κράτα PubkeyAuthentication yes και κανόνα ufw για τη θύρα 22 από το 192.168.1.0/24.' });
  const piPassNo = { ssh: { from: HOME, user: 'pi', auth: 'password', password: 'raspberry' }, expect: 'deny',
    fail: 'Ο λογαριασμός pi μπήκε με τον γνωστό κωδικό raspberry. ({v}) Κλείσε τους κωδικούς: PasswordAuthentication no.' };
  const adminPassNo = { ssh: { from: HOME, user: 'hubadmin', auth: 'password' }, expect: 'deny',
    fail: 'Ο hubadmin μπήκε με κωδικό. ({v}) Με PasswordAuthentication no μπαίνει μόνο με κλειδί. Αν η ρύθμιση γράφεται δύο φορές, ισχύει η ΠΡΩΤΗ.' };
  const rootKeyNo = { ssh: { from: HOME, user: 'root', auth: 'key' }, expect: 'deny',
    fail: 'Ο root μπήκε με SSH (με κλειδί). ({v}) Γράψε PermitRootLogin no.' };
  const rootPassNo = { ssh: { from: HOME, user: 'root', auth: 'password' }, expect: 'deny',
    fail: 'Ο root μπήκε με κωδικό. ({v}) Γράψε PermitRootLogin no και PasswordAuthentication no.' };
  const netDeny = (port, why) => ({ connect: { from: NET, port }, expect: 'deny',
    fail: `Η θύρα ${port} απαντά σε άγνωστη πηγή από το Internet (${NET}). {v} ${why}` });
  const lanAllow = (from, port, why) => ({ connect: { from, port }, expect: 'allow',
    fail: `Η θύρα ${port} δεν απαντά στο ${from} μέσα στο σπίτι. {v} ${why}` });

  const T_SSH_KEY = { name: 'SSH: ο hubadmin μπαίνει με κλειδί από το σπίτι', script: [sshKeyOk()] };
  const T_NO_PASS = { name: 'SSH: κανείς δεν μπαίνει με κωδικό', script: [piPassNo, adminPassNo] };
  const T_NO_ROOT = { name: 'SSH: ο root δεν μπαίνει, ούτε με κλειδί', script: [rootKeyNo, rootPassNo] };
  const T_NET_SSH = { name: 'Internet: το SSH δεν φαίνεται', script: [
    netDeny(22, 'Το SSH πρέπει να ανοίγει μόνο για το 192.168.1.0/24, και ο firewall πρέπει να είναι ενεργός (ufw enable).')
  ] };
  const T_NET_HOME_ONLY = { name: 'Internet: οι θύρες 1883 και 5000 είναι κλειστές', script: [
    netDeny(1883, 'Η 1883 είναι MQTT χωρίς TLS: κλείσ\' την ή άφησέ τη μόνο για το σπίτι. Έλεγξε και το ufw default deny incoming.'),
    netDeny(5000, 'Το dashboard είναι μόνο για το σπίτι: ufw allow from 192.168.1.0/24 to any port 5000 proto tcp.')
  ] };
  const T_8883 = { name: 'Συσκευές: το MQTT με TLS (8883) δουλεύει', script: [
    lanAllow(DEVICE, 8883, 'Οι συσκευές χρειάζονται τη θύρα 8883: ufw allow 8883/tcp.'),
    { connect: { from: NET, port: 8883 }, expect: 'allow', fail: 'Η θύρα 8883 δεν απαντά εκτός σπιτιού. {v} Η εφαρμογή του κινητού τη χρειάζεται: ufw allow 8883/tcp.' }
  ] };
  const T_DASH_HOME = { name: 'Σπίτι: το dashboard (5000) ανοίγει από το tablet', script: [
    lanAllow(HOME, 5000, 'Το dashboard χρειάζεται: ufw allow from 192.168.1.0/24 to any port 5000 proto tcp.')
  ] };
  const T_PI_KEY = { name: 'SSH: μόνο ο hubadmin, όχι ο pi με το παλιό κλειδί', script: [
    { ssh: { from: HOME, user: 'pi', auth: 'key' }, expect: 'deny', fail: 'Ο pi μπήκε με το παλιό του κλειδί. ({v}) Γράψε AllowUsers hubadmin.' },
    sshKeyOk()
  ] };
  const T_BURST = { name: 'Firewall: πολλές συνδέσεις στο SSH από μία συσκευή μπλοκάρονται', script: [
    { burst: { from: UNKNOWN, port: 22, count: 10 }, expect: 'deny',
      fail: 'Η άγνωστη συσκευή 192.168.1.77 έκανε 10 συνδέσεις στο SSH και καμία δεν μπλοκαρίστηκε. ({v}) Ο κανόνας της θύρας 22 πρέπει να είναι limit και όχι allow: ufw limit from 192.168.1.0/24 to any port 22 proto tcp.' },
    { ssh: { from: HOME, user: 'hubadmin', auth: 'key' }, expect: 'allow',
      fail: 'Μετά το μπλοκάρισμα της .77, ούτε ο hubadmin από το .20 μπαίνει: {v} Το limit πρέπει να μετρά ανά IP.' }
  ] };

  // ---------------------------------------------------------------- ρυθμίσεις
  const SSH_GOOD = [
    'PermitRootLogin no',
    'PasswordAuthentication no',
    'PubkeyAuthentication yes'
  ];

  const L1_INITIAL = [
    '# Κομμάτι από το /etc/ssh/sshd_config του Pi',
    '',
    '# ΑΛΛΑΞΕ: κανείς δεν μπαίνει κατευθείαν ως root',
    'PermitRootLogin yes',
    '',
    '# ΑΛΛΑΞΕ: όχι κωδικοί, μόνο κλειδιά',
    'PasswordAuthentication yes',
    '',
    '# Τα κλειδιά μένουν ενεργά',
    'PubkeyAuthentication yes',
    ''
  ].join('\n');

  const L1_SOLUTION = [
    '# Κομμάτι από το /etc/ssh/sshd_config του Pi',
    '',
    '# Κανείς δεν μπαίνει κατευθείαν ως root',
    'PermitRootLogin no',
    '',
    '# Όχι κωδικοί, μόνο κλειδιά',
    'PasswordAuthentication no',
    '',
    '# Τα κλειδιά μένουν ενεργά',
    'PubkeyAuthentication yes',
    ''
  ].join('\n');

  const L2_INITIAL = [
    '# --- SSH (από το 23.1) ---',
    ...SSH_GOOD,
    '',
    '# --- Firewall (ufw) ---',
    '# Βάση: ό,τι δεν επιτρέπεται ρητά, μπλοκάρεται',
    'ufw default deny incoming',
    '',
    '# SSH μόνο από το δίκτυο του σπιτιού',
    '# ΣΥΜΠΛΗΡΩΣΕ: γράψε εδώ τον κανόνα για τη θύρα 22',
    '',
    '# MQTT με TLS: για τις συσκευές και την εφαρμογή του κινητού',
    'ufw allow 8883/tcp',
    '',
    '# Dashboard: μόνο από το σπίτι',
    'ufw allow from 192.168.1.0/24 to any port 5000 proto tcp',
    '',
    '# Η 1883 (MQTT χωρίς TLS) μένει κλειστή: δεν γράφουμε κανόνα',
    '',
    '# ΣΥΜΠΛΗΡΩΣΕ: ενεργοποίησε τον firewall',
    ''
  ].join('\n');

  const L2_SOLUTION = [
    '# --- SSH (από το 23.1) ---',
    ...SSH_GOOD,
    '',
    '# --- Firewall (ufw) ---',
    'ufw default deny incoming',
    'ufw allow from 192.168.1.0/24 to any port 22 proto tcp',
    'ufw allow 8883/tcp',
    'ufw allow from 192.168.1.0/24 to any port 5000 proto tcp',
    'ufw enable',
    ''
  ].join('\n');

  const L3_INITIAL = [
    '# --- SSH ---',
    '# προσωρινά, για να μπει το κλειδί του νέου laptop',
    'PasswordAuthentication yes',
    'PermitRootLogin no',
    'PubkeyAuthentication yes',
    'PasswordAuthentication no',
    '',
    '# --- Firewall (ufw) ---',
    'ufw default deny incoming',
    'ufw allow from 192.168.1.0/24 to any port 22 proto tcp',
    'ufw allow 8883/tcp',
    'ufw allow from 192.168.1.0/24 to any port 5000 proto tcp',
    'ufw enable',
    ''
  ].join('\n');

  const L3_SOLUTION = [
    '# --- SSH ---',
    'PermitRootLogin no',
    'PubkeyAuthentication yes',
    'PasswordAuthentication no',
    'AllowUsers hubadmin',
    '',
    '# --- Firewall (ufw) ---',
    'ufw default deny incoming',
    'ufw limit from 192.168.1.0/24 to any port 22 proto tcp',
    'ufw allow 8883/tcp',
    'ufw allow from 192.168.1.0/24 to any port 5000 proto tcp',
    'ufw enable',
    ''
  ].join('\n');

  const L5_INITIAL = [
    '# Ρυθμίσεις του hub όπως τις βρήκες',
    '# Αντίγραφο ασφαλείας: sshd_config.bak (στο Pi, όχι σε δημόσιο φάκελο)',
    '',
    '# --- SSH ---',
    'PermitRootLogin yes',
    'PasswordAuthentication yes',
    'PubkeyAuthentication yes',
    '',
    '# --- Firewall (ufw) ---',
    'ufw default allow incoming',
    'ufw allow 1883',
    'ufw allow 5000',
    ''
  ].join('\n');

  const L5_SOLUTION = [
    '# Ρυθμίσεις του hub μετά τη θωράκιση',
    '# Αντίγραφο ασφαλείας: sshd_config.bak (στο Pi, όχι σε δημόσιο φάκελο)',
    '',
    '# --- SSH ---',
    'PermitRootLogin no',
    'PasswordAuthentication no',
    'PubkeyAuthentication yes',
    'AllowUsers hubadmin',
    '',
    '# --- Firewall (ufw) ---',
    'ufw default deny incoming',
    'ufw limit from 192.168.1.0/24 to any port 22 proto tcp',
    'ufw allow 8883/tcp',
    'ufw allow from 192.168.1.0/24 to any port 5000 proto tcp',
    'ufw enable',
    ''
  ].join('\n');

  // ---------------------------------------------------------------- συνθετικό auth.log (23.4)
  const FP = 'ED25519 SHA256:Lab3xAmPLEk3yF1ngerPr1nt';
  const blk = (time, src, spt, dpt) => `Oct 15 ${time} pi-hub kernel: [UFW BLOCK] IN=eth0 OUT= SRC=${src} DST=192.168.1.10 PROTO=TCP SPT=${spt} DPT=${dpt}`;
  const AUTH_LOG = [
    `Oct 15 03:12:01 pi-hub sshd[812]: Invalid user admin from ${NET} port 40022`,
    `Oct 15 03:12:03 pi-hub sshd[812]: Failed password for invalid user admin from ${NET} port 40022 ssh2`,
    `Oct 15 03:12:06 pi-hub sshd[812]: Failed password for invalid user admin from ${NET} port 40022 ssh2`,
    `Oct 15 03:12:09 pi-hub sshd[812]: Failed password for invalid user admin from ${NET} port 40022 ssh2`,
    `Oct 15 03:12:10 pi-hub sshd[812]: Connection closed by invalid user admin ${NET} port 40022 [preauth]`,
    `Oct 15 03:12:14 pi-hub sshd[815]: Invalid user admin from ${NET} port 40027`,
    `Oct 15 03:12:16 pi-hub sshd[815]: Failed password for invalid user admin from ${NET} port 40027 ssh2`,
    `Oct 15 03:12:21 pi-hub sshd[818]: Failed password for root from ${NET} port 40031 ssh2`,
    `Oct 15 03:12:21 pi-hub sshd[818]: ROOT LOGIN REFUSED FROM ${NET} port 40031`,
    `Oct 15 03:12:30 pi-hub sshd[821]: Invalid user test from ${NET} port 40036`,
    `Oct 15 03:12:32 pi-hub sshd[821]: Failed password for invalid user test from ${NET} port 40036 ssh2`,
    `Oct 15 03:12:35 pi-hub sshd[821]: Connection closed by invalid user test ${NET} port 40036 [preauth]`,
    `Oct 15 08:01:12 pi-hub sshd[901]: Accepted publickey for hubadmin from 192.168.1.20 port 51514 ssh2: ${FP}`,
    'Oct 15 08:01:12 pi-hub sshd[901]: pam_unix(sshd:session): session opened for user hubadmin(uid=1000) by (uid=0)',
    'Oct 15 08:03:40 pi-hub sudo: hubadmin : TTY=pts/0 ; PWD=/home/hubadmin ; USER=root ; COMMAND=/usr/bin/nano /etc/ssh/sshd_config',
    'Oct 15 08:05:02 pi-hub sudo: hubadmin : TTY=pts/0 ; PWD=/home/hubadmin ; USER=root ; COMMAND=/usr/bin/systemctl restart ssh',
    'Oct 15 08:06:15 pi-hub sudo: hubadmin : TTY=pts/0 ; PWD=/home/hubadmin ; USER=root ; COMMAND=/usr/sbin/ufw enable',
    blk('08:12:44', NET, 40102, 22),
    blk('08:12:47', NET, 40103, 22),
    blk('08:13:02', '198.51.100.23', 52201, 1883),
    blk('08:13:05', NET, 40104, 22),
    'Oct 15 08:20:30 pi-hub sshd[901]: pam_unix(sshd:session): session closed for user hubadmin',
    blk('08:24:10', NET, 40110, 22),
    `Oct 15 08:31:10 pi-hub sshd[955]: Accepted publickey for hubadmin from 192.168.1.20 port 51530 ssh2: ${FP}`
  ];

  const lessons = [
    // ------------------------------------------------------------ 23.1
    {
      id: 'c23-l1', chapter: 23, kind: 'guided', mode: 'config', system: true, skills: ['security', 'network'],
      title: 'SSH μόνο με κλειδιά, χωρίς root',
      prerequisites: [],
      objectives: [
        'Να εξηγώ γιατί το κλειδί SSH είναι πιο ασφαλές από τον κωδικό.',
        'Να κλείνω τη σύνδεση SSH με κωδικό.',
        'Να απαγορεύω τη σύνδεση ως root.'
      ],
      theory: `
<p>Το Pi είναι το κέντρο του σπιτιού: broker, dashboard, βάση δεδομένων. Το διαχειρίζεσαι από μακριά με <strong>SSH</strong> (θύρα 22).</p>
<p>Με <strong>κωδικό</strong>, όποιος φτάνει στη θύρα 22 μπορεί να δοκιμάζει κωδικούς. Ο παλιός προεπιλεγμένος λογαριασμός <code>pi</code> με κωδικό <code>raspberry</code> είναι γνωστός σε όλους.</p>
<p>Με <strong>κλειδί SSH</strong>, το ιδιωτικό κλειδί μένει στον υπολογιστή σου. Στο Pi μπαίνει μόνο το δημόσιο. Δεν υπάρχει κωδικός να μαντέψει κανείς.</p>
<p>Στον πραγματικό υπολογιστή σου: <code>ssh-keygen -t ed25519</code> και μετά <code>ssh-copy-id hubadmin@192.168.1.10</code>. Εδώ ο <code>hubadmin</code> έχει ήδη κλειδί.</p>
<ul>
  <li><code>PasswordAuthentication no</code>: μόνο κλειδιά.</li>
  <li><code>PermitRootLogin no</code>: κανείς δεν μπαίνει ως <code>root</code>. Μπαίνεις ως <code>hubadmin</code> και χρησιμοποιείς <code>sudo</code>.</li>
</ul>
<p><strong>Σειρά με ασφάλεια:</strong> πρώτα δοκίμασε ότι μπαίνεις με το κλειδί. Μετά κλείσε τους κωδικούς. Κράτα ανοιχτή τη συνεδρία σου μέχρι να δεις ότι όλα δουλεύουν (<code>sudo systemctl restart ssh</code>).</p>
<p>Προσοχή: ο προηγούμενος διαχειριστής είχε βάλει κλειδί και στον <code>root</code>. Άρα το κλειδί μόνο του δεν αρκεί.</p>`,
      glossary: ['SSH', 'κλειδί SSH', 'sshd_config', 'root', 'auth.log'],
      supportedSyntax: SYNTAX_SYS,
      initialCode: L1_INITIAL,
      solution: L1_SOLUTION,
      initialWorld: {},
      world: { users: USERS_BASIC },
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Δες τις προειδοποιήσεις κάτω από τις ρυθμίσεις.',
        'Άλλαξε τις δύο γραμμές με το σχόλιο ΑΛΛΑΞΕ.',
        'Πάτησε «Έλεγχος λύσης». Στο «Log ελέγχου» βρες τις γραμμές Accepted publickey και ROOT LOGIN REFUSED.'
      ],
      quiz: {
        question: 'Γράφεις PasswordAuthentication no. Ο hubadmin έχει κλειδί. Ο pi έχει μόνο τον κωδικό raspberry. Τι γίνεται;',
        options: [
          'Ο hubadmin μπαίνει με το κλειδί του. Ο pi δεν μπαίνει πια.',
          'Κανείς δεν μπαίνει: το SSH κλείνει τελείως.',
          'Μπαίνουν και οι δύο, γιατί ο κωδικός του pi είναι σωστός.'
        ],
        answer: 0,
        explain: 'Σωστά. Το SSH μένει ανοιχτό, αλλά δέχεται μόνο κλειδιά. Ο σωστός κωδικός δεν βοηθά πια κανέναν.',
        retry: 'Όχι ακόμα. Το PasswordAuthentication no κλείνει μόνο τους κωδικούς. Τι γίνεται με τα κλειδιά;'
      },
      hints: [
        'Δύο ρυθμίσεις, δύο τιμές: yes ή no.',
        'Η PermitRootLogin αφορά τον root. Η PasswordAuthentication αφορά τους κωδικούς. Και οι δύο πρέπει να γίνουν no.',
        'Οι γραμμές γίνονται:\nPermitRootLogin no\nPasswordAuthentication no\nPubkeyAuthentication yes\nΗ τρίτη μένει yes: αλλιώς ούτε ο hubadmin θα έμπαινε.'
      ],
      validationTests: [T_SSH_KEY, T_NO_PASS, T_NO_ROOT],
      explanationOnSuccess: 'Το SSH δέχεται πια μόνο κλειδιά, και ο root δεν μπαίνει καθόλου. Ο hubadmin δουλεύει κανονικά. Στο Log ελέγχου φαίνεται κάθε απόφαση του sshd, όπως στο πραγματικό /var/log/auth.log.',
      remediation: 'Αν ο hubadmin δεν μπαίνει, μήπως άλλαξες κατά λάθος και το PubkeyAuthentication σε no; Αυτό πρέπει να μείνει yes.'
    },

    // ------------------------------------------------------------ 23.2
    {
      id: 'c23-l2', chapter: 23, kind: 'guided', mode: 'config', system: true, skills: ['security', 'network'],
      title: 'Firewall: default deny και μόνο ό,τι χρειάζεται',
      prerequisites: ['c23-l1'],
      objectives: [
        'Να γράφω βάση default deny με το ufw.',
        'Να ανοίγω μια θύρα μόνο για το δίκτυο του σπιτιού.',
        'Να αποφεύγω δύο κλασικά λάθη: ξεχασμένο ufw enable και κλείδωμα έξω.'
      ],
      theory: `
<p>Το Pi έχει τέσσερις υπηρεσίες: <strong>22</strong> SSH, <strong>1883</strong> MQTT χωρίς TLS, <strong>8883</strong> MQTT με TLS, <strong>5000</strong> dashboard.</p>
<p>Ο <strong>firewall</strong> αποφασίζει ποιος φτάνει σε ποια θύρα. Στο Pi τον ρυθμίζουμε με το <code>ufw</code>.</p>
<ol>
  <li><code>ufw default deny incoming</code>: ό,τι δεν επιτρέπεται ρητά, μπλοκάρεται.</li>
  <li><code>ufw allow from 192.168.1.0/24 to any port 22 proto tcp</code>: SSH μόνο από το σπίτι.</li>
  <li><code>ufw allow 8883/tcp</code>: MQTT με TLS για όλους. Έχει TLS, κωδικούς και ACL.</li>
  <li><code>ufw enable</code>: <strong>τώρα</strong> ισχύουν όλα.</li>
</ol>
<p><strong>Λάθος 1:</strong> ξεχνάς το <code>ufw enable</code>. Οι κανόνες υπάρχουν, αλλά δεν κάνουν τίποτα.</p>
<p><strong>Λάθος 2:</strong> <code>default deny</code> και <code>enable</code> χωρίς κανόνα για το SSH. Ο firewall κόβει και εσένα: <strong>κλειδώνεσαι έξω</strong> από το Pi. Γι' αυτό ο κανόνας για τη θύρα 22 γράφεται <strong>πριν</strong> από το <code>ufw enable</code>.</p>
<p>Τα προγράμματα του ίδιου του Pi (π.χ. η Python με <code>localhost:1883</code>) δεν περνούν από αυτόν τον firewall.</p>`,
      glossary: ['firewall', 'ufw', 'default deny', 'κλείδωμα έξω (lockout)', 'θύρα (port)'],
      supportedSyntax: SYNTAX_SYS,
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      initialWorld: {},
      world: { users: USERS_BASIC },
      steps: [
        'Δες το πάνελ «Πώς το διαβάζει το Pi»: ποιες θύρες είναι ανοιχτές σε όλους;',
        'Γράψε πρώτα μόνο το ufw enable στο τέλος. Διάβασε την προειδοποίηση.',
        'Πρόσθεσε τον κανόνα για τη θύρα 22, μόνο από το 192.168.1.0/24.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γράφεις ufw default deny incoming και ufw enable, αλλά κανέναν κανόνα για τη θύρα 22. Τι θα γίνει;',
        options: [
          'Ο firewall κόβει και το δικό σου SSH: κλειδώνεσαι έξω από το Pi.',
          'Τίποτα: το SSH επιτρέπεται πάντα.',
          'Ο firewall μένει ανενεργός.'
        ],
        answer: 0,
        explain: 'Σωστά. Με default deny, ό,τι δεν επιτρέπεται ρητά μπλοκάρεται. Και το SSH σου. Γι\' αυτό ο κανόνας για τη θύρα 22 μπαίνει πριν από το ufw enable.',
        retry: 'Όχι ακόμα. Τι σημαίνει default deny για μια θύρα χωρίς κανόνα;'
      },
      hints: [
        'Δύο γραμμές λείπουν: ένας κανόνας για τη θύρα 22 και η ενεργοποίηση.',
        'Ο κανόνας του SSH μοιάζει με αυτόν του dashboard, αλλά με θύρα 22. Η ενεργοποίηση είναι η τελευταία γραμμή.',
        'Πρόσθεσε:\nufw allow from 192.168.1.0/24 to any port 22 proto tcp\n…\nufw enable\nΤο /24 σημαίνει: όλες οι διευθύνσεις 192.168.1.x.'
      ],
      validationTests: [T_SSH_KEY, T_NET_SSH, T_NET_HOME_ONLY, T_DASH_HOME, T_8883,
        { name: 'Σπίτι: η 1883 χωρίς TLS δεν απαντά ούτε μέσα στο σπίτι', script: [
          { connect: { from: UNKNOWN, port: 1883 }, expect: 'deny', fail: 'Η άγνωστη συσκευή 192.168.1.77 φτάνει στη θύρα 1883 (MQTT χωρίς TLS). {v} Μη γράψεις κανόνα allow για την 1883· το default deny την κλείνει.' }
        ] }
      ],
      explanationOnSuccess: 'Ο firewall είναι ενεργός. Το SSH και το dashboard απαντούν μόνο στο σπίτι, το MQTT με TLS απαντά σε όλους, και η 1883 είναι κλειστή. Στο Log ελέγχου, κάθε μπλοκάρισμα γράφεται ως [UFW BLOCK].',
      remediation: 'Αν το SSH από το σπίτι αποτυγχάνει, έλεγξε ότι ο κανόνας της θύρας 22 έχει from 192.168.1.0/24. Αν απαντά το Internet, έλεγξε ότι υπάρχει ufw enable.'
    },

    // ------------------------------------------------------------ 23.3
    {
      id: 'c23-l3', chapter: 23, kind: 'variant', mode: 'config', system: true, skills: ['security', 'network'],
      title: 'Όριο συνδέσεων και μόνο ένας χρήστης',
      prerequisites: ['c23-l2'],
      objectives: [
        'Να βάζω όριο συνδέσεων στο SSH με ufw limit.',
        'Να περιορίζω το SSH σε συγκεκριμένους χρήστες με AllowUsers.',
        'Να εξηγώ ότι στο sshd_config ισχύει η πρώτη τιμή.'
      ],
      theory: `
<p>Το SSH είναι ανοιχτό μόνο για το σπίτι. Τι γίνεται όμως αν μια <strong>άγνωστη συσκευή μέσα στο σπίτι</strong> (π.χ. η <code>192.168.1.77</code>) ανοίγει συνδέσεις ξανά και ξανά;</p>
<p><strong>ufw limit</strong>: επιτρέπει τη θύρα, αλλά μπλοκάρει μια IP που κάνει πάνω από 6 συνδέσεις σε 30 s.</p>
<ul>
  <li><code>ufw limit 22/tcp</code>: όριο για <strong>όλους</strong>. Ανοίγει όμως το SSH και στο Internet.</li>
  <li><code>ufw limit from 192.168.1.0/24 to any port 22 proto tcp</code>: μόνο το σπίτι, και με όριο. Αυτό θέλουμε εδώ.</li>
</ul>
<p><strong>AllowUsers hubadmin</strong>: μόνο αυτός ο χρήστης μπαίνει με SSH. Ο <code>pi</code> έχει ακόμα ένα παλιό κλειδί από ένα παλιό laptop. Με AllowUsers δεν μπαίνει.</p>
<p><strong>Παγίδα:</strong> στο sshd_config ισχύει η <strong>πρώτη</strong> τιμή κάθε ρύθμισης. Αν γράφει πρώτα <code>PasswordAuthentication yes</code> και μετά <code>no</code>, ισχύει το <strong>yes</strong>. Το Pi βγάζει προειδοποίηση για τη δεύτερη γραμμή.</p>`,
      glossary: ['ufw limit', 'AllowUsers', 'sshd_config', 'ufw'],
      supportedSyntax: SYNTAX_SYS,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      initialWorld: {},
      world: { users: USERS_OLDKEY },
      steps: [
        'Διάβασε την προειδοποίηση για τη διπλή γραμμή PasswordAuthentication.',
        'Σβήσε την προσωρινή γραμμή PasswordAuthentication yes (και το σχόλιό της).',
        'Πρόσθεσε AllowUsers hubadmin.',
        'Άλλαξε τον κανόνα της θύρας 22 από allow σε limit, χωρίς να βγάλεις το from 192.168.1.0/24.',
        'Πάτησε «Έλεγχος λύσης». Στο Log ελέγχου βρες τη γραμμή [UFW LIMIT BLOCK].'
      ],
      quiz: {
        question: 'Το sshd_config έχει πρώτα «PasswordAuthentication yes» και πιο κάτω «PasswordAuthentication no». Τι ισχύει;',
        options: [
          'yes: το sshd κρατά την πρώτη τιμή, άρα οι κωδικοί είναι ανοιχτοί.',
          'no: η τελευταία γραμμή κερδίζει.',
          'Το SSH δεν ξεκινά καθόλου.'
        ],
        answer: 0,
        explain: 'Σωστά. Στο sshd_config κερδίζει η πρώτη τιμή. Η δεύτερη γραμμή αγνοείται, κι ας φαίνεται σωστή. Γράφε κάθε ρύθμιση μία φορά.',
        retry: 'Όχι ακόμα. Ξαναδιάβασε την παγίδα στη θεωρία: ποια τιμή κρατά το sshd;'
      },
      hints: [
        'Τρεις αλλαγές: μία γραμμή φεύγει, μία μπαίνει, μία λέξη αλλάζει.',
        'Η πρώτη PasswordAuthentication φεύγει. Το AllowUsers μπαίνει στο κομμάτι SSH. Στον κανόνα ufw της θύρας 22, το allow γίνεται limit.',
        'Λυμένο παράδειγμα:\nPermitRootLogin no\nPubkeyAuthentication yes\nPasswordAuthentication no\nAllowUsers hubadmin\n…\nufw limit from 192.168.1.0/24 to any port 22 proto tcp\nΑν γράψεις σκέτο ufw limit 22/tcp πριν από τον κανόνα του σπιτιού, το SSH ανοίγει και στο Internet.'
      ],
      validationTests: [T_SSH_KEY, T_NO_PASS, T_PI_KEY, T_NO_ROOT, T_BURST, T_NET_SSH, T_DASH_HOME],
      explanationOnSuccess: 'Μόνο ο hubadmin μπαίνει, μόνο με κλειδί, μόνο από το σπίτι. Μια συσκευή που ανοίγει συνδέσεις ξανά και ξανά μπλοκάρεται, ενώ το δικό σου .20 συνεχίζει κανονικά, γιατί το όριο μετρά ανά IP.',
      remediation: 'Αν ο έλεγχος λέει ότι το SSH απαντά στο Internet, μάλλον έγραψες ufw limit 22/tcp. Βάλε from 192.168.1.0/24 στον κανόνα. Αν ο hubadmin μπαίνει με κωδικό, έμεινε η πρώτη γραμμή PasswordAuthentication yes.'
    },

    // ------------------------------------------------------------ 23.4
    {
      id: 'c23-l4', chapter: 23, kind: 'independent', mode: 'analysis', skills: ['analysis', 'security'],
      title: 'Διάβασε το auth.log: μια νύχτα με αποτυχίες',
      prerequisites: ['c23-l3'],
      objectives: [
        'Να διαβάζω γραμμές του auth.log και του ufw.',
        'Να ξεχωρίζω αποτυχίες από επιτυχίες σύνδεσης.',
        'Να επιλέγω ψύχραιμη, αμυντική αντίδραση με βάση τα τεκμήρια.'
      ],
      theory: `
<p>Το πρωί κοιτάς το <code>/var/log/auth.log</code> του Pi. Η καταγραφή είναι <strong>συνθετική</strong>: φτιάχτηκε για την άσκηση.</p>
<p>Εκείνη τη νύχτα το Pi είχε ήδη <code>PermitRootLogin no</code>. Οι κωδικοί όμως ήταν ακόμα ανοιχτοί και ο firewall σβηστός. Το πρωί, στις 08:0x, έκλεισες τους κωδικούς και άναψες τον firewall.</p>
<p>Γραμμές που θα δεις:</p>
<ul>
  <li><code>Invalid user admin from …</code>: όνομα χρήστη που δεν υπάρχει στο Pi.</li>
  <li><code>Failed password for …</code>: αποτυχημένη δοκιμή κωδικού.</li>
  <li><code>ROOT LOGIN REFUSED</code>: το sshd αρνήθηκε τον root.</li>
  <li><code>Accepted publickey for hubadmin</code>: <strong>επιτυχία</strong>, με κλειδί.</li>
  <li><code>[UFW BLOCK] … SRC=… DPT=22</code>: ο firewall σταμάτησε τη σύνδεση πριν φτάσει στο SSH.</li>
</ul>
<p>Το πιο σημαντικό ερώτημα: <strong>υπάρχει κάποιο Accepted από την άγνωστη πηγή;</strong></p>
<p>Η άμυνα γίνεται <strong>μόνο στο δικό σου σύστημα</strong>. Δεν «απαντάμε» ποτέ στην πηγή.</p>`,
      glossary: ['auth.log', 'firewall', 'τεκμήριο', 'αποτυχία σύνδεσης'],
      supportedSyntax: SYNTAX_LOGS,
      initialWorld: {},
      panels: ['logs'],
      capture: { lines: AUTH_LOG },
      evidence: { log: NET },
      evidenceHint: 'Επίλεξε όλες τις γραμμές της άγνωστης πηγής από το Internet που δοκίμασε να μπει στο SSH: τις αποτυχίες του sshd και τα μπλοκαρίσματα του firewall.',
      steps: [
        'Διάβασε το log από την αρχή. Χώρισέ το σε «νύχτα» και «πρωί».',
        'Βρες την IP που εμφανίζεται στις αποτυχίες της νύχτας.',
        'Φίλτραρε με αυτή την IP και επίλεξε όλες τις γραμμές της.',
        'Έλεγξε: υπάρχει κάποιο Accepted από αυτή την IP;',
        'Απάντησε στην ερώτηση.'
      ],
      quiz: {
        question: 'Τι δείχνουν τα τεκμήρια, και ποια είναι η σωστή αντίδραση;',
        options: [
          'Μια άγνωστη πηγή από το Internet δοκίμασε ονόματα και κωδικούς. Δεν πέτυχε τίποτα. Με κλειδιά και firewall δεν φτάνει πια ούτε στο SSH. Δεν χρειάζεται πανικός: κρατάμε τα μέτρα.',
          'Η πηγή μπήκε στο Pi ως root. Σβήνουμε αμέσως όλο το σύστημα.',
          'Τα μπλοκαρίσματα γεμίζουν το log. Κλείνουμε τον firewall για να ησυχάσει.'
        ],
        answer: 0,
        explain: 'Σωστά. Κανένα Accepted από 203.0.113.50: όλες οι προσπάθειες απέτυχαν. Ο root απορρίφθηκε (ROOT LOGIN REFUSED). Μετά τις 08:06 ο firewall τη σταματά πριν φτάσει στο SSH. Οι μόνες επιτυχίες είναι του hubadmin από το σπίτι, με κλειδί.',
        retry: 'Όχι ακόμα. Ψάξε γραμμή «Accepted» από την IP 203.0.113.50. Υπάρχει; Τι λέει το ROOT LOGIN REFUSED;'
      },
      hints: [
        'Μια αποτυχία δεν είναι επιτυχία. Ψάξε τι πέτυχε και ποιος.',
        'Η άγνωστη πηγή είναι η 203.0.113.50. Εμφανίζεται και στο sshd (νύχτα) και στο [UFW BLOCK] (πρωί). Η 198.51.100.23 είναι άλλη πηγή, σε άλλη θύρα.',
        'Φίλτραρε με 203.0.113.50 και επίλεξε όλες τις γραμμές (16). Κανένα Accepted από αυτήν. Απάντηση: η πρώτη επιλογή.'
      ],
      explanationOnSuccess: 'Διάβασες το log με τεκμήρια, όχι με φόβο. Οι προσπάθειες της νύχτας απέτυχαν, και τα μέτρα του πρωινού τις σταματούν πια στον firewall. Τέτοιες δοκιμές από το Internet είναι συνηθισμένες. Η απάντηση είναι σωστές ρυθμίσεις, τακτικές ενημερώσεις και τακτικός έλεγχος του log.',
      remediation: 'Αν το σύστημα λέει ότι λείπουν γραμμές, φίλτραρε με 203.0.113.50 και επίλεξε ΟΛΕΣ: και τις γραμμές του sshd και τις [UFW BLOCK].'
    },

    // ------------------------------------------------------------ 23.5
    {
      id: 'c23-l5', chapter: 23, kind: 'checkpoint', mode: 'config', system: true, skills: ['security', 'network', 'analysis'],
      title: 'Έλεγχος κεφαλαίου: πλήρης θωράκιση του hub',
      prerequisites: ['c23-l4'],
      objectives: [
        'Να θωρακίζω SSH και firewall μαζί, χωρίς να κόψω τις κανονικές υπηρεσίες.',
        'Να ελέγχω κάθε θύρα από το σπίτι και από το Internet.',
        'Να γνωρίζω τον ρόλο των ενημερώσεων και των αντιγράφων ασφαλείας.'
      ],
      theory: `
<p>Ένας φίλος σού έδωσε το Pi του (στο εικονικό εργαστήριο) να το ελέγξεις. Οι ρυθμίσεις του έχουν πολλά προβλήματα:</p>
<ul>
  <li>Ο <code>root</code> μπαίνει με SSH. Οι κωδικοί είναι ανοιχτοί.</li>
  <li>Ο <code>pi</code> έχει ακόμα ένα παλιό κλειδί.</li>
  <li>Ο firewall δεν είναι ενεργός, και η βάση του είναι <code>default allow</code>.</li>
  <li>Οι θύρες 1883 και 5000 ανοίγουν σε όλους.</li>
</ul>
<p>Ο στόχος:</p>
<ul>
  <li>SSH: μόνο <code>hubadmin</code>, μόνο με κλειδί, μόνο από το σπίτι, με όριο συνδέσεων.</li>
  <li>8883 (MQTT με TLS): για όλους.</li>
  <li>5000 (dashboard): μόνο από το σπίτι. 1883: κλειστή ή μόνο από το σπίτι.</li>
</ul>
<p><strong>Και εκτός ρυθμίσεων</strong> (δεν προσομοιώνονται εδώ):</p>
<ul>
  <li>Ενημερώσεις: <code>sudo apt update && sudo apt full-upgrade</code>, τακτικά.</li>
  <li>Αντίγραφα ασφαλείας: των ρυθμίσεων και της βάσης δεδομένων, σε άλλο μέσο.</li>
</ul>`,
      glossary: ['firewall', 'ufw limit', 'AllowUsers', 'κλείδωμα έξω (lockout)', 'ενημερώσεις συστήματος', 'αντίγραφο ρυθμίσεων (backup)'],
      supportedSyntax: SYNTAX_SYS,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      initialWorld: {},
      world: { users: USERS_OLDKEY },
      steps: [
        'Διάβασε τις προειδοποιήσεις και το πάνελ «Πώς το διαβάζει το Pi».',
        'Διόρθωσε το κομμάτι SSH: root, κωδικοί, χρήστες.',
        'Ξαναγράψε τον firewall: default deny, κανόνες μόνο για ό,τι χρειάζεται, όριο στο SSH.',
        'Μην ξεχάσεις τον κανόνα για τη θύρα 22 και το ufw enable.',
        'Πάτησε «Έλεγχος λύσης» και απάντησε στην ερώτηση.'
      ],
      quiz: {
        question: 'Οι ρυθμίσεις σου περνούν όλους τους ελέγχους. Τι ακόμα χρειάζεται το Pi για να μείνει ασφαλές;',
        options: [
          'Τακτικές ενημερώσεις (apt update / full-upgrade), αντίγραφα ασφαλείας και τακτικό έλεγχο του auth.log.',
          'Τίποτα: με firewall το Pi είναι ασφαλές για πάντα.',
          'Να ανοίξουμε ξανά τους κωδικούς, για να μη χαθεί ποτέ το κλειδί.'
        ],
        answer: 0,
        explain: 'Σωστά. Οι ρυθμίσεις είναι μία στρώση. Οι ενημερώσεις κλείνουν γνωστά κενά, τα αντίγραφα σε σώζουν από λάθη, και ο έλεγχος του log δείχνει έγκαιρα κάτι ασυνήθιστο.',
        retry: 'Όχι ακόμα. Μένει κάτι σταθερό για πάντα σε ένα σύστημα; Τι γίνεται όταν βγαίνει μια διόρθωση ασφαλείας;'
      },
      hints: [
        'Δύο κομμάτια: SSH (4 γραμμές) και firewall (5 γραμμές). Κάθε θύρα: ποιος τη χρειάζεται;',
        'SSH: PermitRootLogin no, PasswordAuthentication no, AllowUsers hubadmin. Firewall: default deny, limit για το 22 από το σπίτι, 8883 για όλους, 5000 από το σπίτι, enable. Οι γραμμές ufw allow 1883 και ufw allow 5000 φεύγουν.',
        'Λυμένο παράδειγμα:\nPermitRootLogin no\nPasswordAuthentication no\nPubkeyAuthentication yes\nAllowUsers hubadmin\nufw default deny incoming\nufw limit from 192.168.1.0/24 to any port 22 proto tcp\nufw allow 8883/tcp\nufw allow from 192.168.1.0/24 to any port 5000 proto tcp\nufw enable'
      ],
      validationTests: [T_SSH_KEY, T_NO_PASS, T_NO_ROOT, T_PI_KEY, T_NET_SSH, T_NET_HOME_ONLY, T_8883, T_DASH_HOME, T_BURST],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο. Το hub δέχεται SSH μόνο από τον hubadmin, μόνο με κλειδί, μόνο από το σπίτι και με όριο. Από το Internet φαίνεται μόνο το MQTT με TLS. Τώρα πρόσθεσε τη ρουτίνα: sudo apt update && sudo apt full-upgrade τακτικά, αντίγραφα ασφαλείας σε άλλο μέσο, και μια ματιά στο auth.log. Θυμήσου: αυτό είναι εκπαιδευτικό μοντέλο, όχι απόδειξη ότι ένα πραγματικό σύστημα είναι ασφαλές.',
      remediation: 'Αν το SSH από το σπίτι αποτυγχάνει, έλεγξε ότι ο κανόνας της θύρας 22 υπάρχει πριν από το ufw enable. Αν απαντά το Internet, έλεγξε το default deny και το ufw enable.'
    }
  ];

  lessons.forEach(l => L.lessons.push(l));
})(typeof window !== 'undefined' ? window : globalThis);
