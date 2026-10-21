/*
 * IoT Guardian — Κεφάλαιο 14: Monitoring και ασφαλής διαμόρφωση.
 * Ο μαθητής διαβάζει συνθετικά logs του δικού του broker, συνδέει μια παρατήρηση
 * με την αιτία της, διορθώνει τη διαμόρφωση και ελέγχει ότι η κανονική υπηρεσία συνεχίζει.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 14).ready = true;

  [
    { term: 'ελάχιστη έκθεση', def: 'Ο broker (ή κάθε υπηρεσία) ανοίγει μόνο τις θύρες και τις λειτουργίες που χρειάζονται πραγματικά. Ό,τι έμεινε από δοκιμές κλείνει.' },
    { term: 'monitoring', def: 'Τακτική παρακολούθηση των logs και της κίνησης του δικτύου, για να φαίνονται έγκαιρα λάθη ρυθμίσεων και ασυνήθιστες συνδέσεις.' },
    { term: 'αποτυχία σύνδεσης', def: 'Μια σύνδεση που ο broker απέρριψε, π.χ. «not authorised». Δεν σημαίνει αυτόματα επίθεση· πολύ συχνά είναι λάθος ρύθμιση, π.χ. κωδικός που άλλαξε μόνο στη μία πλευρά.' },
    { term: 'redaction', def: 'Απόκρυψη μυστικών (κωδικοί, κλειδιά) πριν μοιραστείς ένα log ή ένα αρχείο ρυθμίσεων, π.χ. password esp32-temp ********.' },
    { term: 'αντίγραφο ρυθμίσεων (backup)', def: 'Αντίγραφο του αρχείου ρυθμίσεων πριν από μια αλλαγή, ώστε να μπορείς να γυρίσεις πίσω. Περιέχει μυστικά, άρα φυλάσσεται όσο προσεκτικά και το πρωτότυπο.' },
    { term: 'διαχωρισμός δικτύων', def: 'Οι συσκευές IoT μπαίνουν σε ξεχωριστό δίκτυο (π.χ. VLAN ή δίκτυο επισκεπτών) από τους υπολογιστές και τα κινητά, ώστε ένα πρόβλημα στο ένα να μην επηρεάζει εύκολα το άλλο.' },
    { term: 'ενημέρωση firmware', def: 'Εγκατάσταση νέας έκδοσης του λογισμικού μιας συσκευής, συνήθως με διορθώσεις σφαλμάτων και ασφαλείας. Γίνεται μόνο από αξιόπιστη πηγή και με έλεγχο ότι η συσκευή δουλεύει μετά.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX_CFG = 'listener, tls on, allow_anonymous, password, acl_default deny, user, topic read / write / readwrite, σχόλια με # στην αρχή της γραμμής';
  const SYNTAX_LOGS = 'Επιλογή γραμμών στο log του broker και φίλτρα Network Monitor (tcp.port == N, ip.src == Δ, mqtt, tls)';

  // Φανταστικοί κωδικοί του εργαστηρίου
  const PASS = {
    pir: 'Pir-Lab-Key-0427',
    tempOld: 'Temp-Lab-Key-0815',
    temp: 'Temp-Lab-Key-0916',
    lamp: 'Lamp-Lab-Key-2026',
    dash: 'Dash-Lab-Key-2026'
  };

  const tlsConn = (who, pass, extra) => Object.assign({ connect: who, user: who, pass, port: 8883, tls: true }, extra || {});

  // ---------------------------------------------------------------- Ρυθμίσεις
  const ACL_GOOD = [
    'acl_default deny',
    'user esp32-pir',
    'topic write home/motion',
    'user esp32-temp',
    'topic write home/temperature',
    'user esp32-lamp',
    'topic read home/led/set',
    'topic write home/led/state',
    'user dashboard',
    'topic read home/#',
    'topic write home/led/set'
  ];

  const PASSWORDS = [
    `password esp32-pir ${PASS.pir}`,
    `password esp32-temp ${PASS.temp}`,
    `password esp32-lamp ${PASS.lamp}`,
    `password dashboard ${PASS.dash}`
  ];

  const L1_BROKER = [
    'listener 1883',
    'listener 8883',
    'tls on',
    'allow_anonymous true',
    `password esp32-temp ${PASS.temp}`,
    `password dashboard ${PASS.dash}`,
    'user esp32-temp',
    'topic write home/temperature',
    'user dashboard',
    'topic read home/#',
    'topic write home/led/set',
    ''
  ].join('\n');

  const L2_INITIAL = [
    '# Ρυθμίσεις broker του σπιτιού.',
    '# Ο listener 1883 έμεινε από τις δοκιμές του Κεφαλαίου 7.',
    '# ΣΥΜΠΛΗΡΩΣΕ 1: σβήσε τη γραμμή του listener που δεν χρειάζεται.',
    'listener 1883',
    'listener 8883',
    'tls on',
    '# ΣΥΜΠΛΗΡΩΣΕ 2: καμία σύνδεση χωρίς όνομα χρήστη και κωδικό.',
    'allow_anonymous ____',
    ...PASSWORDS,
    ...ACL_GOOD,
    ''
  ].join('\n');

  const L2_SOLUTION = [
    '# Ρυθμίσεις broker του σπιτιού.',
    '# Μόνο ένας listener, με TLS.',
    'listener 8883',
    'tls on',
    'allow_anonymous false',
    ...PASSWORDS,
    ...ACL_GOOD,
    ''
  ].join('\n');

  const L3_BROKER = [
    'listener 8883',
    'tls on',
    'allow_anonymous false',
    ...PASSWORDS,
    ...ACL_GOOD,
    ''
  ].join('\n');

  const L4_INITIAL = [
    'listener 8883',
    'tls on',
    'allow_anonymous false',
    ...PASSWORDS,
    'acl_default deny',
    'user esp32-pir',
    'topic write home/motion',
    'user esp32-temp',
    '# προσωρινό, για τη δοκιμή του Μαρτίου',
    'topic readwrite home/#',
    'user esp32-lamp',
    'topic read home/led/set',
    'topic write home/led/state',
    'user dashboard',
    'topic read home/#',
    'topic write home/led/set',
    ''
  ].join('\n');

  const L4_SOLUTION = [
    'listener 8883',
    'tls on',
    'allow_anonymous false',
    ...PASSWORDS,
    ...ACL_GOOD,
    ''
  ].join('\n');

  const L5_INITIAL = [
    '# Ρυθμίσεις broker: έκδοση πριν από τον έλεγχο.',
    '# Αντίγραφο ασφαλείας: broker.conf.bak (εκτός δημόσιου φακέλου).',
    'listener 1883',
    'listener 8883',
    'tls on',
    'allow_anonymous true',
    `password esp32-pir ${PASS.pir}`,
    `password esp32-temp ${PASS.temp}`,
    'password esp32-lamp lamp1234',
    `password dashboard ${PASS.dash}`,
    'acl_default deny',
    'user esp32-pir',
    'topic write home/motion',
    'user esp32-temp',
    'topic write home/temperature',
    'user esp32-lamp',
    'topic read home/led/set',
    'topic write home/led/state',
    'user dashboard',
    'topic readwrite #',
    ''
  ].join('\n');

  const L5_SOLUTION = [
    '# Ρυθμίσεις broker: μετά τον έλεγχο.',
    '# Αντίγραφο ασφαλείας: broker.conf.bak (εκτός δημόσιου φακέλου).',
    'listener 8883',
    'tls on',
    'allow_anonymous false',
    ...PASSWORDS,
    ...ACL_GOOD,
    ''
  ].join('\n');

  // ---------------------------------------------------------------- Κοινά tests
  const SERVICE_TESTS = [
    {
      name: 'Υπηρεσία: το esp32-pir συνδέεται με TLS και στέλνει κίνηση',
      script: [
        tlsConn('esp32-pir', PASS.pir, { expect: 'allow', fail: 'Το esp32-pir δεν συνδέθηκε στη θύρα 8883 με TLS: {v}. Η διόρθωση δεν πρέπει να κόψει τις κανονικές συσκευές. Έλεγξε listener 8883, tls on και τη γραμμή password.' }),
        { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion":true}', expect: 'allow', fail: 'Το esp32-pir δεν μπορεί να γράψει στο home/motion: {v}. Κράτα τον κανόνα topic write home/motion.' }
      ]
    },
    {
      name: 'Υπηρεσία: το esp32-temp συνδέεται με TLS και στέλνει μέτρηση',
      script: [
        tlsConn('esp32-temp', PASS.temp, { expect: 'allow', fail: 'Το esp32-temp δεν συνδέθηκε στη θύρα 8883 με TLS: {v}.' }),
        { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":21.40}', expect: 'allow', fail: 'Το esp32-temp δεν μπορεί να γράψει στο home/temperature: {v}. Χρειάζεται topic write home/temperature.' }
      ]
    },
    {
      name: 'Υπηρεσία: η λάμπα παίρνει εντολές και αναφέρει κατάσταση',
      script: [
        tlsConn('esp32-lamp', PASS.lamp, { expect: 'allow', fail: 'Το esp32-lamp δεν συνδέθηκε: {v}. Ο κωδικός στη γραμμή password πρέπει να είναι ίδιος με αυτόν της συσκευής.' }),
        { subscribe: 'esp32-lamp', topic: 'home/led/set', expect: 'allow', fail: 'Η λάμπα δεν μπορεί να διαβάσει το home/led/set: {v}.' },
        { publish: 'esp32-lamp', topic: 'home/led/state', payload: 'ON', expect: 'allow', fail: 'Η λάμπα δεν μπορεί να γράψει στο home/led/state: {v}.' }
      ]
    },
    {
      name: 'Υπηρεσία: το dashboard βλέπει τα δεδομένα και στέλνει εντολές',
      script: [
        tlsConn('dashboard', PASS.dash, { expect: 'allow', fail: 'Το dashboard δεν συνδέθηκε: {v}.' }),
        { subscribe: 'dashboard', topic: 'home/#', expect: 'allow', fail: 'Το dashboard δεν μπορεί να διαβάσει το home/#: {v}. Χρειάζεται topic read home/#.' },
        { publish: 'dashboard', topic: 'home/led/set', payload: '{"cmd":"ON","id":1}', expect: 'allow', fail: 'Το dashboard δεν μπορεί να στείλει εντολή στο home/led/set: {v}.' }
      ]
    }
  ];

  const NO_1883 = {
    name: 'Έκθεση: καμία υπηρεσία στη θύρα 1883 (χωρίς TLS)',
    script: [
      { connect: 'unknown-device', port: 1883, expect: 'deny', fail: 'Μια άγνωστη συσκευή συνδέθηκε στη θύρα 1883 χωρίς TLS και χωρίς στοιχεία. Αιτία: ο listener 1883 είναι ακόμα ανοιχτός. Διόρθωση: σβήσε τη γραμμή listener 1883.' },
      { connect: 'esp32-temp', user: 'esp32-temp', pass: PASS.temp, port: 1883, expect: 'deny', fail: 'Το esp32-temp μπόρεσε να συνδεθεί στη θύρα 1883 χωρίς TLS. Τότε ο κωδικός του θα ταξίδευε ως απλό κείμενο. Σβήσε τη γραμμή listener 1883.' }
    ]
  };

  const NO_ANON = {
    name: 'Έκθεση: καμία ανώνυμη σύνδεση ούτε στη θύρα 8883',
    script: [
      { connect: 'unknown-device', port: 8883, tls: true, expect: 'deny', fail: 'Μια άγνωστη συσκευή χωρίς όνομα χρήστη συνδέθηκε στη θύρα 8883. Αιτία: allow_anonymous true. Διόρθωση: allow_anonymous false.' }
    ]
  };

  const lessons = [
    // ------------------------------------------------------------ 14.1
    {
      id: 'c14-l1', chapter: 14, kind: 'micro', skills: ['analysis', 'security'],
      mode: 'analysis',
      title: 'Διάβασε το log: μια σύνδεση χωρίς όνομα',
      prerequisites: [],
      objectives: ['Να διαβάζω γραμμές log του broker τύπου mosquitto.', 'Να ξεχωρίζω επώνυμη από ανώνυμη σύνδεση.', 'Να συνδέω μια παρατήρηση με μια ρύθμιση.'],
      theory: `
<p>Το <strong>monitoring</strong> σημαίνει ότι κοιτάς τακτικά τι γράφει ο broker. Όχι μόνο όταν κάτι χαλάσει.</p>
<p>Μια γραμμή επιτυχημένης σύνδεσης μοιάζει έτσι:</p>
<pre>New client connected from 192.168.1.43 as esp32-temp (p2, c1, k60, u'esp32-temp').</pre>
<ul>
  <li><code>192.168.1.43</code>: από ποια IP.</li>
  <li><code>as esp32-temp</code>: το client id.</li>
  <li><code>u'esp32-temp'</code>: το όνομα χρήστη. Αν <strong>λείπει</strong>, η σύνδεση έγινε <strong>χωρίς όνομα χρήστη</strong> (ανώνυμα).</li>
</ul>
<p>Οι ρυθμίσεις του broker σου εκείνη τη μέρα ήταν:</p>
<pre>listener 1883
listener 8883
tls on
allow_anonymous true
…</pre>
<p>Η καταγραφή είναι <strong>συνθετική</strong>: φτιάχτηκε για την άσκηση, από το εικονικό σου σύστημα.</p>`,
      glossary: ['monitoring', 'ελάχιστη έκθεση'],
      supportedSyntax: SYNTAX_LOGS,
      initialWorld: {},
      panels: ['logs', 'net'],
      capture: {
        broker: L1_BROKER,
        cert: 'valid',
        scenario: [
          tlsConn('dashboard', PASS.dash),
          { subscribe: 'dashboard', topic: 'home/#' },
          tlsConn('esp32-temp', PASS.temp),
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":21.40}' },
          { wait: 4000 },
          { connect: 'unknown-device', port: 1883 },
          { subscribe: 'unknown-device', topic: '#' },
          { publish: 'unknown-device', topic: 'home/led/set', payload: '{"cmd":"ON"}' },
          { wait: 1500 },
          { disconnect: 'unknown-device' },
          { wait: 3500 },
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":21.50}' }
        ]
      },
      evidence: { log: 'unknown-device' },
      evidenceHint: 'Επίλεξε όλες τις γραμμές του log που αφορούν τη συσκευή που συνδέθηκε χωρίς όνομα χρήστη (σύνδεση, απορρίψεις, αποσύνδεση).',
      steps: [
        'Άνοιξε το log του broker. Βρες τις γραμμές «New client connected».',
        'Σύγκρινέ τες: ποια δεν έχει u\'…\' στο τέλος;',
        'Επίλεξε όλες τις γραμμές που αφορούν αυτή τη συσκευή.',
        'Στο Network Monitor γράψε tcp.port == 1883 για να δεις από ποια θύρα ήρθε.',
        'Απάντησε στην ερώτηση.'
      ],
      quiz: {
        question: 'Ποια ρύθμιση επέτρεψε στη συσκευή 192.168.1.77 να συνδεθεί χωρίς όνομα χρήστη;',
        options: ['Ο ξεχασμένος listener 1883 μαζί με allow_anonymous true', 'Ο κανόνας topic read home/# του dashboard', 'Το tls on στη θύρα 8883'],
        answer: 0,
        explain: 'Σωστά. Συνδέθηκε στη θύρα 1883 (χωρίς TLS) και ο broker δέχεται ανώνυμους. Οι ACL απέρριψαν το subscribe και το publish, αλλά η ίδια η σύνδεση δεν χρειαζόταν να είναι δυνατή. Στο επόμενο μάθημα θα την κλείσεις.',
        retry: 'Όχι ακόμα. Δες στο Network Monitor σε ποια θύρα συνδέθηκε, και θυμήσου τι κάνει το allow_anonymous true.'
      },
      hints: [
        'Οι επώνυμες συνδέσεις τελειώνουν με u\'όνομα\'. Ψάξε μια που δεν έχει.',
        'Η συσκευή εμφανίζεται στο log ως unknown-device, με IP 192.168.1.77. Υπάρχουν και γραμμές «Denied» για αυτήν.',
        'Επίλεξε τις 4 γραμμές που περιέχουν unknown-device: τη σύνδεση, το Denied SUBSCRIBE, το Denied PUBLISH και την αποσύνδεση. Απάντηση: ο listener 1883 μαζί με allow_anonymous true.'
      ],
      explanationOnSuccess: 'Συνέδεσες ένα τεκμήριο (γραμμή log χωρίς όνομα χρήστη, θύρα 1883) με μια αιτία (ξεχασμένος listener και allow_anonymous true). Οι ACL σταμάτησαν τις ενέργειες, αλλά η καλύτερη άμυνα είναι να μην υπάρχει καθόλου η περιττή πόρτα.',
      remediation: 'Αν το σύστημα λέει ότι λείπουν γραμμές, φίλτραρε το log με τη λέξη unknown-device.'
    },

    // ------------------------------------------------------------ 14.2
    {
      id: 'c14-l2', chapter: 14, kind: 'guided', skills: ['security', 'network'],
      mode: 'config',
      title: 'Ελάχιστη έκθεση: κλείσε την περιττή πόρτα',
      prerequisites: ['c14-l1'],
      objectives: ['Να αφαιρώ έναν listener που δεν χρειάζεται.', 'Να απαγορεύω τις ανώνυμες συνδέσεις.', 'Να ελέγχω ότι οι κανονικές συσκευές συνεχίζουν να λειτουργούν.'],
      theory: `
<p><strong>Ελάχιστη έκθεση</strong>: κάθε θύρα που ακούει είναι μια πόρτα. Αν δεν τη χρειάζεσαι, την κλείνεις.</p>
<p>Ο listener 1883 έμεινε από τις δοκιμές. Όλες οι συσκευές του σπιτιού χρησιμοποιούν πια τη θύρα 8883 με TLS.</p>
<p>Το σχέδιο αλλαγής:</p>
<ol>
  <li>Κράτα <strong>αντίγραφο</strong> των ρυθμίσεων πριν αλλάξεις κάτι (στην πράξη: π.χ. <code>broker.conf.bak</code>).</li>
  <li>Σβήσε τη γραμμή <code>listener 1883</code>.</li>
  <li>Γράψε <code>allow_anonymous false</code>.</li>
  <li><strong>Έλεγξε</strong> ότι οι κανονικές συσκευές συνδέονται και στέλνουν όπως πριν.</li>
</ol>
<p>Το βήμα 4 είναι εξίσου σημαντικό με τα 2 και 3. Μια διόρθωση που «κλείνει» και την κανονική υπηρεσία δεν είναι επιτυχία.</p>`,
      glossary: ['ελάχιστη έκθεση', 'αντίγραφο ρυθμίσεων (backup)'],
      supportedSyntax: SYNTAX_CFG,
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      initialWorld: {},
      world: { cert: 'valid' },
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Σβήσε τη γραμμή listener 1883.',
        'Συμπλήρωσε το κενό ____ στο allow_anonymous.',
        'Πάτησε «Έλεγχος λύσης». Τα tests «Υπηρεσία: …» δείχνουν αν οι συσκευές λειτουργούν ακόμα.'
      ],
      quiz: {
        question: 'Σβήνεις τον listener 1883. Τι θα γίνει με τις συσκευές που ήδη χρησιμοποιούν 8883 με TLS;',
        options: ['Τίποτα· συνεχίζουν κανονικά', 'Αποσυνδέονται για πάντα', 'Πρέπει να γυρίσουν στη θύρα 1883'],
        answer: 0,
        explain: 'Σωστά. Η θύρα 8883 μένει ως έχει. Κλείνει μόνο η πόρτα που δεν χρησιμοποιεί κανείς από τις κανονικές συσκευές. Τα tests «Υπηρεσία» το επιβεβαιώνουν.',
        retry: 'Όχι ακόμα. Ποια θύρα χρησιμοποιούν οι συσκευές του σπιτιού;'
      },
      hints: [
        'Δύο αλλαγές: μία γραμμή φεύγει και ένα κενό συμπληρώνεται.',
        'Η γραμμή listener 1883 δεν χρειάζεται. Το allow_anonymous δέχεται true ή false.',
        'Η αρχή των ρυθμίσεων γίνεται:\nlistener 8883\ntls on\nallow_anonymous false\n• Οι γραμμές password και τα ACL μένουν όπως είναι.'
      ],
      validationTests: [...SERVICE_TESTS, NO_1883, NO_ANON],
      explanationOnSuccess: 'Ο broker ακούει πια μόνο στη θύρα 8883 με TLS και δέχεται μόνο επώνυμους χρήστες. Και τα τέσσερα tests «Υπηρεσία» πέρασαν: η αλλαγή δεν έσπασε τίποτα από όσα χρειάζεσαι.',
      remediation: 'Αν απέτυχε κάποιο test «Υπηρεσία», μήπως έσβησες κατά λάθος και το tls on ή μια γραμμή password; Σύγκρινε με το αρχικό.'
    },

    // ------------------------------------------------------------ 14.3
    {
      id: 'c14-l3', chapter: 14, kind: 'variant', skills: ['analysis', 'security'],
      mode: 'analysis',
      title: 'Αποτυχία σύνδεσης: επίθεση ή λάθος ρύθμιση;',
      prerequisites: ['c14-l2'],
      objectives: ['Να συγκεντρώνω τεκμήρια πριν βγάλω συμπέρασμα.', 'Να αναγνωρίζω μια αποτυχία σύνδεσης που οφείλεται σε λάθος ρύθμιση.', 'Να προτείνω διόρθωση που δεν αποδυναμώνει την ασφάλεια.'],
      theory: `
<p>Το πρωί άλλαξες τον κωδικό του <code>esp32-temp</code> στις ρυθμίσεις του broker και έκανες επανεκκίνηση. Μετά ο broker γράφει:</p>
<pre>Client esp32-temp from 192.168.1.43 (u'esp32-temp') disconnected, not authorised.</pre>
<p>Μια <strong>αποτυχία σύνδεσης δεν σημαίνει αυτόματα επίθεση</strong>. Πριν βγάλεις συμπέρασμα, μάζεψε τεκμήρια:</p>
<ul>
  <li><strong>Ποιος;</strong> Γνωστή IP και γνωστό όνομα χρήστη, ή άγνωστα;</li>
  <li><strong>Πότε ξεκίνησε;</strong> Αμέσως μετά από μια αλλαγή ρυθμίσεων;</li>
  <li><strong>Τι μοτίβο;</strong> Μία προσπάθεια κάθε λίγα δευτερόλεπτα (κανονική επανασύνδεση) ή πολλά διαφορετικά ονόματα;</li>
  <li><strong>Οι άλλοι;</strong> Συνδέονται κανονικά οι υπόλοιπες συσκευές;</li>
</ul>
<p>Η σωστή διόρθωση ενός λάθους ρύθμισης <strong>δεν</strong> είναι να ανοίξεις τον broker (π.χ. <code>allow_anonymous true</code>). Είναι να ενημερώσεις το αρχείο μυστικών της συσκευής με τον νέο κωδικό.</p>`,
      glossary: ['αποτυχία σύνδεσης', 'monitoring'],
      supportedSyntax: SYNTAX_LOGS,
      initialWorld: {},
      panels: ['logs'],
      capture: {
        broker: L3_BROKER,
        cert: 'valid',
        scenario: [
          { restart: true },
          { wait: 800 },
          tlsConn('dashboard', PASS.dash),
          { subscribe: 'dashboard', topic: 'home/#' },
          tlsConn('esp32-pir', PASS.pir),
          tlsConn('esp32-lamp', PASS.lamp),
          { subscribe: 'esp32-lamp', topic: 'home/led/set' },
          { wait: 1200 },
          tlsConn('esp32-temp', PASS.tempOld),
          { wait: 2000 },
          { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion":true}' },
          { wait: 3000 },
          tlsConn('esp32-temp', PASS.tempOld),
          { wait: 5000 },
          tlsConn('esp32-temp', PASS.tempOld),
          { wait: 1000 },
          { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion":false}' }
        ]
      },
      evidence: { log: 'not authorised' },
      evidenceHint: 'Επίλεξε όλες τις γραμμές όπου ο broker απέρριψε μια σύνδεση.',
      steps: [
        'Διάβασε το log από την αρχή. Πού είναι η επανεκκίνηση του broker;',
        'Βρες τις γραμμές «not authorised». Επίλεξέ τες όλες.',
        'Για κάθε γραμμή σημείωσε: IP, όνομα χρήστη, ώρα.',
        'Κοίτα αν οι άλλες συσκευές συνδέθηκαν κανονικά.',
        'Απάντησε στην ερώτηση.'
      ],
      quiz: {
        question: 'Ποια εξήγηση ταιριάζει καλύτερα με τα τεκμήρια, και ποιο είναι το σωστό επόμενο βήμα;',
        options: [
          'Λάθος ρύθμιση: ο κωδικός άλλαξε στον broker αλλά όχι στη συσκευή. Ενημερώνω το αρχείο μυστικών του esp32-temp.',
          'Σίγουρα επίθεση: κλείνω το WiFi όλου του σπιτιού.',
          'Ο broker χάλασε: γράφω allow_anonymous true για να ξαναδουλέψει.'
        ],
        answer: 0,
        explain: 'Σωστά. Γνωστή IP (.43), γνωστό όνομα (esp32-temp), σταθερές επαναλήψεις, ξεκίνησαν αμέσως μετά την αλλαγή, και οι άλλες συσκευές συνδέονται κανονικά. Όλα δείχνουν λάθος ρύθμιση. Η διόρθωση γίνεται στη συσκευή, χωρίς να αποδυναμωθεί ο broker.',
        retry: 'Όχι ακόμα. Ξανακοίτα: είναι γνωστή η IP και το όνομα χρήστη; Πότε ξεκίνησαν οι αποτυχίες; Συνδέονται οι άλλοι;'
      },
      hints: [
        'Μία αποτυχία σύνδεσης είναι παρατήρηση, όχι συμπέρασμα. Μάζεψε πρώτα τεκμήρια.',
        'Φίλτραρε το log με not authorised. Δες ποια IP και ποιο όνομα χρήστη εμφανίζονται, και αν οι dashboard, esp32-pir, esp32-lamp συνδέθηκαν.',
        'Επίλεξε τις 3 γραμμές «… esp32-temp … not authorised». Όλες έχουν την IP 192.168.1.43 και το όνομα esp32-temp, και ξεκινούν λίγο μετά την επανεκκίνηση. Άρα: λάθος ρύθμιση (πρώτη επιλογή).'
      ],
      explanationOnSuccess: 'Δεν έβγαλες συμπέρασμα από μία γραμμή. Συνέκρινες IP, όνομα χρήστη, χρόνο και τους άλλους clients. Αν όμως έβλεπες άγνωστη IP ή πολλά διαφορετικά ονόματα, θα άξιζε περισσότερη διερεύνηση.',
      remediation: 'Αν το σύστημα λέει ότι λείπουν γραμμές, φίλτραρε το log με not authorised και επίλεξε όλες τις γραμμές που εμφανίζονται.'
    },

    // ------------------------------------------------------------ 14.4
    {
      id: 'c14-l4', chapter: 14, kind: 'independent', skills: ['security', 'mqtt'],
      mode: 'config',
      title: 'Η προειδοποίηση και η περιττή άδεια',
      prerequisites: ['c14-l3'],
      objectives: ['Να συνδέω μια προειδοποίηση του broker με τον κανόνα που την προκαλεί.', 'Να αντικαθιστώ έναν ευρύ κανόνα με τον ελάχιστο απαραίτητο.'],
      theory: `
<p>Κάτω από τις ρυθμίσεις εμφανίζεται μια <strong>προειδοποίηση</strong>: ένας κανόνας για το <code>esp32-temp</code> είναι πολύ ευρύς.</p>
<p>Η προειδοποίηση είναι η παρατήρηση. Η αιτία είναι μια γραμμή που μπήκε «προσωρινά» για μια δοκιμή και ξεχάστηκε:</p>
<pre>topic readwrite home/#</pre>
<p>Με αυτήν, ο αισθητήρας θερμοκρασίας μπορεί να διαβάζει τα πάντα και να <strong>γράφει</strong> και στο <code>home/led/set</code>. Αν το firmware του είχε ένα λάθος, θα μπορούσε να ανάβει φώτα.</p>
<p>Τι χρειάζεται πραγματικά ο αισθητήρας; Μόνο να <strong>γράφει</strong> τη μέτρηση στο <code>home/temperature</code>.</p>
<p>Μετά τη διόρθωση, έλεγξε ότι όλες οι συσκευές λειτουργούν κανονικά.</p>`,
      glossary: ['ελάχιστη έκθεση', 'προειδοποίηση'],
      supportedSyntax: SYNTAX_CFG,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      initialWorld: {},
      world: { cert: 'valid' },
      steps: [
        'Πάτησε «Έλεγχος ρυθμίσεων» και διάβασε την προειδοποίηση. Σε ποια γραμμή δείχνει;',
        'Αντικατάστησε τον ευρύ κανόνα με τον ελάχιστο που χρειάζεται το esp32-temp.',
        'Σβήσε και το σχόλιο «προσωρινό», αφού δεν ισχύει πια.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ποιος κανόνας είναι ο ελάχιστος για έναν αισθητήρα που μόνο στέλνει θερμοκρασία;',
        options: ['topic write home/temperature', 'topic readwrite home/temperature', 'topic write home/#'],
        answer: 0,
        explain: 'Σωστά. Ο αισθητήρας δεν διαβάζει τίποτα και γράφει σε ένα μόνο topic. Οτιδήποτε παραπάνω είναι περιττή άδεια.',
        retry: 'Όχι ακόμα. Χρειάζεται ο αισθητήρας να διαβάζει; Σε πόσα topics γράφει;'
      },
      hints: [
        'Δώσε στη συσκευή μόνο ό,τι χρειάζεται για τη δουλειά της.',
        'Η γραμμή που φταίει είναι κάτω από το user esp32-temp. Το esp32-temp μόνο γράφει, και μόνο τη θερμοκρασία.',
        'Κάτω από το user esp32-temp γράψε μόνο:\ntopic write home/temperature'
      ],
      validationTests: [
        SERVICE_TESTS[1],
        {
          name: 'Ελάχιστα δικαιώματα: το esp32-temp δεν στέλνει εντολές στη λάμπα',
          script: [
            tlsConn('esp32-temp', PASS.temp, { expect: 'allow', fail: 'Το esp32-temp δεν συνδέθηκε: {v}.' }),
            { publish: 'esp32-temp', topic: 'home/led/set', payload: '{"cmd":"ON","id":1}', expect: 'deny', fail: 'Το esp32-temp μπόρεσε να γράψει στο home/led/set. Αιτία: ο κανόνας readwrite home/#. Διόρθωση: κράτα μόνο topic write home/temperature.' },
            { publish: 'esp32-temp', topic: 'home/motion', payload: '{"motion":true}', expect: 'deny', fail: 'Το esp32-temp μπορεί να γράψει στο home/motion. Ένας αισθητήρας θερμοκρασίας δεν χρειάζεται αυτή την άδεια.' }
          ]
        },
        {
          name: 'Ελάχιστα δικαιώματα: το esp32-temp δεν διαβάζει τα topics του σπιτιού',
          script: [
            tlsConn('esp32-temp', PASS.temp, { expect: 'allow', fail: 'Το esp32-temp δεν συνδέθηκε: {v}.' }),
            { subscribe: 'esp32-temp', topic: 'home/#', expect: 'deny', fail: 'Το esp32-temp μπορεί να διαβάζει όλο το home/#. Δεν το χρειάζεται: αφαίρεσε την άδεια read.' }
          ]
        },
        SERVICE_TESTS[0], SERVICE_TESTS[2], SERVICE_TESTS[3]
      ],
      explanationOnSuccess: 'Η προειδοποίηση εξαφανίστηκε, γιατί διόρθωσες την αιτία της και όχι το σύμπτωμα. Ο αισθητήρας κάνει ακόμα τη δουλειά του, αλλά τίποτα παραπάνω.',
      remediation: 'Αν το test «Υπηρεσία: το esp32-temp…» αποτυγχάνει, μήπως έγραψες read αντί για write;'
    },

    // ------------------------------------------------------------ 14.5
    {
      id: 'c14-l5', chapter: 14, kind: 'checkpoint', skills: ['security', 'analysis', 'mqtt'],
      mode: 'config',
      title: 'Έλεγχος κεφαλαίου: διόρθωση με τεκμήρια',
      prerequisites: ['c14-l4'],
      objectives: ['Να εφαρμόζω πολλές διορθώσεις διαμόρφωσης χωρίς να σπάσω την υπηρεσία.', 'Να ξέρω πώς μοιράζομαι ρυθμίσεις και logs με redaction.', 'Να γνωρίζω τον ρόλο του διαχωρισμού δικτύων και των ενημερώσεων firmware.'],
      theory: `
<p>Ένας φίλος σου ζήτησε να ελέγξεις τις ρυθμίσεις του broker του (στο εικονικό εργαστήριο). Βρήκες αυτά τα τεκμήρια:</p>
<ul>
  <li>Στο log: συνδέσεις <strong>χωρίς u'…'</strong> στη θύρα 1883.</li>
  <li>Στο log: <code>Client esp32-lamp … not authorised</code> κάθε λίγα δευτερόλεπτα. Η λάμπα έχει ήδη τον νέο κωδικό <code>Lamp-Lab-Key-2026</code> στο αρχείο μυστικών της. Ο broker έχει ακόμα τον παλιό.</li>
  <li>Κάτω από τις ρυθμίσεις: προειδοποιήσεις για σύντομο κωδικό και για πολύ ευρύ κανόνα.</li>
</ul>
<p>Διόρθωσε τις ρυθμίσεις. Μετά, τα tests ελέγχουν <strong>και</strong> ότι κάθε κανονική συσκευή λειτουργεί.</p>
<p><strong>Όταν γράφεις την αναφορά σου:</strong> κάνε <strong>redaction</strong> στους κωδικούς (<code>password esp32-lamp ********</code>). Κράτα το αντίγραφο ρυθμίσεων σε ασφαλές μέρος, γιατί περιέχει μυστικά.</p>
<p><strong>Και εκτός broker:</strong> οι συσκευές IoT καλό είναι να βρίσκονται σε <strong>χωριστό δίκτυο</strong> από τους υπολογιστές, και να παίρνουν <strong>ενημερώσεις firmware</strong> από αξιόπιστη πηγή. Αυτά δεν προσομοιώνονται εδώ, αλλά ανήκουν στην ίδια λίστα ελέγχου.</p>`,
      glossary: ['redaction', 'αντίγραφο ρυθμίσεων (backup)', 'διαχωρισμός δικτύων', 'ενημέρωση firmware', 'αποτυχία σύνδεσης'],
      supportedSyntax: SYNTAX_CFG,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      initialWorld: {},
      world: { cert: 'valid' },
      steps: [
        'Πάτησε «Έλεγχος ρυθμίσεων» και διάβασε τις προειδοποιήσεις.',
        'Κλείσε την περιττή θύρα και τις ανώνυμες συνδέσεις.',
        'Βάλε στον broker τον κωδικό που έχει ήδη η λάμπα.',
        'Περιόρισε το dashboard σε ό,τι χρειάζεται: διαβάζει home/#, γράφει μόνο home/led/set.',
        'Πάτησε «Έλεγχος λύσης» και απάντησε στην ερώτηση για την αναφορά.'
      ],
      quiz: {
        question: 'Ποια γραμμή είναι σωστή για να μπει στην αναφορά που θα στείλεις στον φίλο σου;',
        options: [
          'password esp32-lamp ******** (ο κωδικός άλλαξε· η λάμπα συνδέεται ξανά)',
          'password esp32-lamp Lamp-Lab-Key-2026',
          'Σβήσαμε όλους τους κωδικούς για να είναι πιο απλό'
        ],
        answer: 0,
        explain: 'Σωστά. Η αναφορά λέει τι άλλαξε και ποιο τεκμήριο το επιβεβαιώνει, χωρίς να δείχνει το ίδιο το μυστικό.',
        retry: 'Όχι ακόμα. Μια αναφορά μπορεί να προωθηθεί ή να αποθηκευτεί κάπου. Πρέπει να περιέχει τον κωδικό;'
      },
      hints: [
        'Υπάρχουν τέσσερα προβλήματα: μια ανοιχτή θύρα, οι ανώνυμοι, ένας κωδικός και ένας κανόνας.',
        'Σβήσε το listener 1883, γράψε allow_anonymous false, άλλαξε το lamp1234 στον κωδικό της λάμπας και αντικατάστησε το topic readwrite # του dashboard.',
        'Οι γραμμές που αλλάζουν:\nlistener 8883\ntls on\nallow_anonymous false\npassword esp32-lamp Lamp-Lab-Key-2026\n…\nuser dashboard\ntopic read home/#\ntopic write home/led/set'
      ],
      validationTests: [
        ...SERVICE_TESTS,
        NO_1883,
        NO_ANON,
        {
          name: 'Κωδικοί: ο παλιός σύντομος κωδικός της λάμπας δεν ισχύει',
          script: [
            { connect: 'esp32-lamp', user: 'esp32-lamp', pass: 'lamp1234', port: 8883, tls: true, expect: 'deny', fail: 'Ο παλιός κωδικός lamp1234 γίνεται ακόμα δεκτός. Αιτία: η γραμμή password esp32-lamp δεν άλλαξε. Διόρθωση: βάλε τον κωδικό που έχει ήδη η συσκευή.' }
          ]
        },
        {
          name: 'Ελάχιστα δικαιώματα: το dashboard δεν γράφει μετρήσεις αισθητήρων',
          script: [
            tlsConn('dashboard', PASS.dash, { expect: 'allow', fail: 'Το dashboard δεν συνδέθηκε: {v}.' }),
            { publish: 'dashboard', topic: 'home/temperature', payload: '{"t":99}', expect: 'deny', fail: 'Το dashboard μπορεί να γράψει στο home/temperature. Αιτία: topic readwrite #. Αποτέλεσμα: θα μπορούσε να εμφανιστεί ψεύτικη μέτρηση. Διόρθωση: topic read home/# και topic write home/led/set.' },
            { publish: 'dashboard', topic: 'home/motion', payload: '{"motion":true}', expect: 'deny', fail: 'Το dashboard μπορεί να γράψει στο home/motion. Περιόρισε τα δικαιώματά του.' },
            { subscribe: 'dashboard', topic: '#', expect: 'deny', fail: 'Το dashboard μπορεί να διαβάσει το # (όλα τα topics του broker). Χρειάζεται μόνο το home/#.' }
          ]
        }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο. Η διόρθωσή σου στηρίζεται σε τεκμήρια, έγινε με αντίγραφο ρυθμίσεων, και τα tests «Υπηρεσία» δείχνουν ότι όλες οι κανονικές συσκευές λειτουργούν. Θυμήσου: αυτό είναι μια λίστα ελέγχου για το εικονικό μοντέλο, όχι απόδειξη ότι ένα πραγματικό σύστημα είναι ασφαλές.',
      remediation: 'Αν αποτυγχάνει μόνο η λάμπα, έλεγξε ότι ο κωδικός γράφτηκε ακριβώς: Lamp-Lab-Key-2026 (κεφαλαία και παύλες μετράνε).'
    }
  ];

  lessons.forEach(l => L.lessons.push(l));
})(typeof window !== 'undefined' ? window : globalThis);
