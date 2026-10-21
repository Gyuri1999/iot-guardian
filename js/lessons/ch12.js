/*
 * IoT Guardian — Κεφάλαιο 12: ACLs και ελάχιστα δικαιώματα.
 * Ο μαθητής γράφει κανόνες πρόσβασης για τον ΔΙΚΟ του εικονικό broker.
 * Οι αποφάσεις allow/deny είναι αποφάσεις του εκπαιδευτικού μοντέλου.
 * Τα tests ελέγχουν και τις επιτρεπόμενες και τις απαγορευμένες ενέργειες:
 * πολύ ευρείς κανόνες αποτυγχάνουν, πολύ στενοί κανόνες επίσης.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 12).ready = true;

  const addTerm = (term, def) => { if (!L.GLOSSARY.some(g => g.term === term)) L.GLOSSARY.push({ term, def }); };
  addTerm('ACL (Access Control List)', 'Λίστα κανόνων που λέει ποιος χρήστης μπορεί να διαβάσει (read) ή να γράψει (write) σε ποια topics.');
  addTerm('read / write / readwrite', 'Τα δικαιώματα ενός κανόνα ACL. read = subscribe και λήψη μηνυμάτων. write = publish. readwrite = και τα δύο.');
  addTerm('default deny', 'Αρχή ασφαλείας: ό,τι δεν επιτρέπεται ρητά, απαγορεύεται. Στον broker: acl_default deny.');
  addTerm('ελάχιστα δικαιώματα', 'Κάθε συσκευή παίρνει μόνο τα δικαιώματα που χρειάζεται για τη δουλειά της. Τίποτα παραπάνω.');
  addTerm('wildcard +', 'Στα φίλτρα MQTT, το + ταιριάζει σε ακριβώς ένα επίπεδο. Το home/+ ταιριάζει στο home/temperature, αλλά όχι στο home/led/set.');
  addTerm('wildcard #', 'Στα φίλτρα MQTT, το # ταιριάζει σε όλα τα επίπεδα από εκεί και κάτω. Μπαίνει μόνο στο τέλος. Το σκέτο # ταιριάζει σε όλα τα topics.');

  const SYNTAX_C12 = 'acl_default deny, user <χρήστης>, topic read|write|readwrite <topic ή φίλτρο>, wildcards + και #, σχόλια με # στην αρχή της γραμμής';

  const AUTH = `listener 8883
tls on
allow_anonymous false
password esp32-temp Temp-Lab-Key-0911
password esp32-lamp Lamp-Lab-Key-0613
password dashboard Dash-Lab-Key-0815
`;

  const CREDS = {
    'esp32-temp': 'Temp-Lab-Key-0911',
    'esp32-lamp': 'Lamp-Lab-Key-0613',
    dashboard: 'Dash-Lab-Key-0815'
  };
  const TO = { 'esp32-temp': 'στον αισθητήρα θερμοκρασίας', 'esp32-lamp': 'στη λάμπα', dashboard: 'στο dashboard' };

  // Βοηθοί για βήματα ελέγχου. Κάθε test ξεκινά από νέο broker, άρα πρώτα γίνεται σύνδεση.
  const conn = who => ({
    connect: who, user: who, pass: CREDS[who], port: 8883, tls: true, expect: 'allow',
    fail: `Ο client ${who} δεν μπόρεσε να συνδεθεί: {v} Μην αλλάζεις τις γραμμές listener, tls και password.`
  });
  const pubOk = (who, topic) => ({ publish: who, topic, payload: '1', expect: 'allow',
    fail: `Απαγορεύτηκε ${TO[who]} (${who}) να γράψει στο ${topic}, αλλά το χρειάζεται. Πρόσθεσε κανόνα topic write ${topic} κάτω από user ${who}.` });
  const pubNo = (who, topic) => ({ publish: who, topic, payload: '1', expect: 'deny',
    fail: `Επιτράπηκε ${TO[who]} (${who}) να γράψει στο ${topic}, ενώ δεν το χρειάζεται. Έλεγξε για κανόνα write ή readwrite που καλύπτει αυτό το topic (π.χ. με + ή #).` });
  const subOk = (who, topic) => ({ subscribe: who, topic, expect: 'allow',
    fail: `Απαγορεύτηκε ${TO[who]} (${who}) να διαβάσει το ${topic}, αλλά το χρειάζεται. Πρόσθεσε κανόνα topic read ${topic} κάτω από user ${who}.` });
  const subNo = (who, topic) => ({ subscribe: who, topic, expect: 'deny',
    fail: `Επιτράπηκε ${TO[who]} (${who}) να διαβάσει το ${topic}, ενώ δεν το χρειάζεται. Έλεγξε για κανόνα read ή readwrite με πολύ ευρύ wildcard.` });

  const TEMP_ALLOW = { name: 'Αισθητήρας: γράφει τις μετρήσεις του', script: [conn('esp32-temp'), pubOk('esp32-temp', 'home/temperature'), pubOk('esp32-temp', 'home/humidity')] };
  const TEMP_DENY = { name: 'Αισθητήρας: δεν γράφει αλλού και δεν διαβάζει', script: [
    conn('esp32-temp'), pubNo('esp32-temp', 'home/led/set'), pubNo('esp32-temp', 'home/motion'), subNo('esp32-temp', 'home/#'), subNo('esp32-temp', 'home/temperature')
  ] };
  const LAMP_ALLOW = { name: 'Λάμπα: ακούει εντολές και αναφέρει κατάσταση', script: [conn('esp32-lamp'), subOk('esp32-lamp', 'home/led/set'), pubOk('esp32-lamp', 'home/led/state')] };
  const LAMP_DENY = { name: 'Λάμπα: τίποτα παραπάνω', script: [
    conn('esp32-lamp'), pubNo('esp32-lamp', 'home/led/set'), pubNo('esp32-lamp', 'home/temperature'),
    subNo('esp32-lamp', 'home/#'), subNo('esp32-lamp', '#'), subNo('esp32-lamp', 'home/led/#'), subNo('esp32-lamp', 'home/temperature')
  ] };
  const DASH_ALLOW = { name: 'Dashboard: διαβάζει όλο το σπίτι και στέλνει εντολές στη λάμπα', script: [conn('dashboard'), subOk('dashboard', 'home/#'), pubOk('dashboard', 'home/led/set')] };
  const DASH_DENY = { name: 'Dashboard: δεν γράφει μετρήσεις ούτε κατάσταση λάμπας', script: [
    conn('dashboard'), pubNo('dashboard', 'home/temperature'), pubNo('dashboard', 'home/led/state'), subNo('dashboard', '#')
  ] };

  const TEMP_RULES = `user esp32-temp
topic write home/temperature
topic write home/humidity
`;
  const LAMP_RULES = `user esp32-lamp
topic read home/led/set
topic write home/led/state
`;
  const DASH_RULES = `user dashboard
topic read home/#
topic write home/led/set
`;

  L.lessons.push(
    // ------------------------------------------------------------ c12-l1
    {
      id: 'c12-l1', chapter: 12, kind: 'guided', mode: 'config', skills: ['security', 'mqtt'],
      title: 'Default deny: ο αισθητήρας γράφει μόνο τις μετρήσεις του',
      prerequisites: [],
      objectives: [
        'Να ξεχωρίζω τα δικαιώματα read και write.',
        'Να εφαρμόζω default deny.',
        'Να δίνω σε μια συσκευή μόνο τα topics που χρειάζεται.'
      ],
      theory: `
<p>Στο Κεφάλαιο 10 απαντήσαμε στο «ποιος είσαι;». Τώρα απαντάμε στο «<strong>τι επιτρέπεται να κάνεις;</strong>» (authorization).</p>
<p>Ο broker το αποφασίζει με μια <strong>ACL</strong>: μια λίστα κανόνων ανά χρήστη.</p>
<ul>
  <li><code>topic write home/temperature</code> → μπορεί να κάνει <strong>publish</strong> εκεί.</li>
  <li><code>topic read home/led/set</code> → μπορεί να κάνει <strong>subscribe</strong> και να λαμβάνει από εκεί.</li>
  <li><code>topic readwrite …</code> → και τα δύο. Χρησιμοποίησέ το σπάνια.</li>
</ul>
<p>Η γραμμή <code>acl_default deny</code> σημαίνει: <strong>ό,τι δεν επιτρέπεται ρητά, απαγορεύεται</strong>. Αυτό λέγεται <strong>default deny</strong>.</p>
<p>Η αρχή των <strong>ελάχιστων δικαιωμάτων</strong>: κάθε συσκευή παίρνει μόνο ό,τι χρειάζεται. Ο αισθητήρας θερμοκρασίας μετρά και στέλνει. Δεν χρειάζεται να διαβάζει τίποτα.</p>
<p>Το <code>acl_default</code> είναι απλοποίηση του εκπαιδευτικού μοντέλου. Στον πραγματικό mosquitto οι κανόνες γράφονται σε ξεχωριστό <code>acl_file</code>, και όταν υπάρχει, ό,τι δεν αναφέρεται απαγορεύεται.</p>`,
      glossary: ['ACL (Access Control List)', 'read / write / readwrite', 'default deny', 'ελάχιστα δικαιώματα', 'authorization'],
      supportedSyntax: SYNTAX_C12,
      initialCode: `${AUTH}
# Ό,τι δεν επιτρέπεται ρητά, απαγορεύεται
acl_default deny

# Ο αισθητήρας στέλνει θερμοκρασία και υγρασία
user esp32-temp
topic ____ home/temperature
topic write ____
`,
      solution: `${AUTH}
# Ό,τι δεν επιτρέπεται ρητά, απαγορεύεται
acl_default deny

# Ο αισθητήρας στέλνει θερμοκρασία και υγρασία
${TEMP_RULES}`,
      initialWorld: {},
      world: { cert: 'valid' },
      panels: ['logs'],
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Στο πρώτο κενό γράψε το δικαίωμα που επιτρέπει publish.',
        'Στο δεύτερο κενό γράψε το topic της υγρασίας: home/humidity.',
        'Πάτησε «Έλεγχος λύσης». Στο log του broker δες τις γραμμές «Denied PUBLISH» και «Denied SUBSCRIBE».'
      ],
      quiz: {
        question: 'Με acl_default deny και μόνο τον κανόνα «topic write home/temperature», τι γίνεται αν ο αισθητήρας κάνει publish στο home/led/set;',
        options: ['Ο broker το απορρίπτει: δεν υπάρχει κανόνας που να το επιτρέπει', 'Περνά, γιατί ο αισθητήρας έχει σωστό κωδικό', 'Περνά, γιατί το write ισχύει για όλα τα topics'],
        answer: 0,
        explain: 'Σωστά. Ο σωστός κωδικός λέει μόνο ποιος είσαι (authentication). Το τι επιτρέπεται το αποφασίζει η ACL, και με default deny ό,τι δεν αναφέρεται απαγορεύεται.',
        retry: 'Όχι ακόμα. Ποιο topic γράφει ο κανόνας; Τι σημαίνει το deny για όλα τα άλλα;'
      },
      hints: [
        'Ο αισθητήρας μόνο στέλνει (publish). Ποιο δικαίωμα αντιστοιχεί στο publish: read ή write;',
        'Κοίτα τις δύο τελευταίες γραμμές. Στην πρώτη λείπει το δικαίωμα, στη δεύτερη λείπει το topic.',
        'Οι δύο γραμμές είναι:\ntopic write home/temperature\ntopic write home/humidity\nΚανένας κανόνας read: ο αισθητήρας δεν χρειάζεται να διαβάζει.'
      ],
      validationTests: [TEMP_ALLOW, TEMP_DENY],
      explanationOnSuccess: 'Ο αισθητήρας μπορεί να στείλει μόνο τις δύο μετρήσεις του. Αν κάποτε ο κώδικάς του έχει λάθος και δοκιμάσει να γράψει αλλού, ο broker θα το σταματήσει και θα το γράψει στο log.',
      remediation: 'Αν ο αισθητήρας δεν μπορεί να γράψει, έλεγξε ότι οι κανόνες βρίσκονται κάτω από τη γραμμή user esp32-temp και ότι τα topics είναι γραμμένα ακριβώς έτσι.'
    },

    // ------------------------------------------------------------ c12-l2
    {
      id: 'c12-l2', chapter: 12, kind: 'independent', mode: 'config', skills: ['security', 'mqtt'],
      title: 'Η λάμπα και το dashboard: read εδώ, write εκεί',
      prerequisites: ['c12-l1'],
      objectives: [
        'Να γράφω κανόνες read και write για συσκευή που ακούει εντολές.',
        'Να χρησιμοποιώ το wildcard # μόνο όπου χρειάζεται.'
      ],
      theory: `
<p>Η λάμπα έχει δύο topics:</p>
<ul>
  <li><code>home/led/set</code>: εδώ <strong>ακούει</strong> εντολές (read).</li>
  <li><code>home/led/state</code>: εδώ <strong>αναφέρει</strong> την κατάστασή της (write).</li>
</ul>
<p>Η λάμπα <strong>δεν</strong> πρέπει να γράφει στο <code>home/led/set</code>. Αλλιώς θα μπορούσε να δίνει εντολές στον εαυτό της ή σε άλλες λάμπες.</p>
<p>Το dashboard πρέπει να <strong>βλέπει όλο το σπίτι</strong>. Εδώ ταιριάζει το wildcard <code>#</code>: το <code>home/#</code> πιάνει όλα τα topics κάτω από το <code>home/</code>.</p>
<p>Το dashboard στέλνει εντολές μόνο στη λάμπα: <code>home/led/set</code>. Δεν γράφει μετρήσεις.</p>`,
      glossary: ['read / write / readwrite', 'wildcard #', 'ελάχιστα δικαιώματα'],
      supportedSyntax: SYNTAX_C12,
      initialCode: `${AUTH}
acl_default deny

${TEMP_RULES}
user esp32-lamp
# γράψε εδώ τους κανόνες της λάμπας

user dashboard
# γράψε εδώ τους κανόνες του dashboard
`,
      solution: `${AUTH}
acl_default deny

${TEMP_RULES}
${LAMP_RULES}
${DASH_RULES}`,
      initialWorld: {},
      world: { cert: 'valid' },
      panels: ['logs'],
      steps: [
        'Γράψε δύο κανόνες για τη λάμπα: τι διαβάζει, τι γράφει.',
        'Γράψε δύο κανόνες για το dashboard: τι διαβάζει, τι γράφει.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το dashboard έχει «topic read home/#». Μπορεί να κάνει subscribe στο home/led/state;',
        options: ['Ναι: το home/# καλύπτει όλα τα topics κάτω από το home/', 'Όχι: χρειάζεται ξεχωριστό κανόνα για κάθε topic', 'Ναι, και μπορεί επίσης να γράψει εκεί'],
        answer: 0,
        explain: 'Σωστά. Το # πιάνει όλα τα επίπεδα. Όμως ο κανόνας είναι read: δεν δίνει δικαίωμα write.',
        retry: 'Όχι ακόμα. Θυμήσου τι πιάνει το # στο τέλος ενός φίλτρου.'
      },
      hints: [
        'Η λάμπα ακούει (read) εντολές και αναφέρει (write) κατάσταση. Το dashboard διαβάζει τα πάντα στο home/ και γράφει μόνο εντολές.',
        'Γράψε τους κανόνες αμέσως κάτω από τη σωστή γραμμή user. Οι γραμμές σχολίων μπορούν να μείνουν ή να σβηστούν.',
        'Λυμένο παράδειγμα:\nuser esp32-lamp\ntopic read home/led/set\ntopic write home/led/state\n\nuser dashboard\ntopic read home/#\ntopic write home/led/set'
      ],
      validationTests: [TEMP_ALLOW, LAMP_ALLOW, LAMP_DENY, DASH_ALLOW, DASH_DENY],
      explanationOnSuccess: 'Κάθε συσκευή έχει τώρα το δικό της «διαβατήριο»: η λάμπα ακούει μόνο εντολές και αναφέρει μόνο την κατάστασή της, το dashboard βλέπει τα πάντα αλλά στέλνει μόνο εντολές.',
      remediation: 'Αν ένας έλεγχος λέει «επιτράπηκε … ενώ δεν το χρειάζεται», ψάξε για readwrite ή για # σε κανόνα write.'
    },

    // ------------------------------------------------------------ c12-l3
    {
      id: 'c12-l3', chapter: 12, kind: 'variant', mode: 'config', skills: ['security', 'mqtt'],
      title: 'Πολύ ευρύ wildcard: στένεψε τους κανόνες',
      prerequisites: ['c12-l2'],
      objectives: [
        'Να εξηγώ τι πιάνει το + και τι πιάνει το #.',
        'Να αντικαθιστώ ευρείς κανόνες με συγκεκριμένα topics.'
      ],
      theory: `
<p>Τα wildcards είναι βολικά, αλλά εύκολα δίνουν <strong>περισσότερα</strong> δικαιώματα από όσα χρειάζονται.</p>
<ul>
  <li><code>+</code> πιάνει <strong>ακριβώς ένα επίπεδο</strong>. Το <code>home/+</code> πιάνει <code>home/temperature</code>, <code>home/humidity</code>, αλλά και <code>home/motion</code> και <code>home/door</code>.</li>
  <li><code>#</code> πιάνει <strong>όλα τα επίπεδα</strong> από εκεί και κάτω. Το σκέτο <code>#</code> πιάνει <strong>τα πάντα</strong>.</li>
</ul>
<p>Ο κανόνας <code>topic readwrite #</code> σημαίνει «διάβασε και γράψε οπουδήποτε». Αν ο κώδικας μιας λάμπας έχει λάθος, μπορεί να στείλει εντολές σε όλο το σπίτι.</p>
<p>Ο broker βγάζει προειδοποίηση για πολύ ευρείς κανόνες. Όμως <strong>δεν</strong> πιάνει όλες τις περιπτώσεις: το <code>home/+</code> δεν βγάζει προειδοποίηση, κι όμως είναι πολύ ευρύ για τον αισθητήρα.</p>`,
      glossary: ['wildcard +', 'wildcard #', 'ελάχιστα δικαιώματα'],
      supportedSyntax: SYNTAX_C12,
      initialCode: `${AUTH}
acl_default deny

user esp32-temp
topic write home/+

user esp32-lamp
topic readwrite #

${DASH_RULES}`,
      solution: `${AUTH}
acl_default deny

${TEMP_RULES}
${LAMP_RULES}
${DASH_RULES}`,
      initialWorld: {},
      world: { cert: 'valid' },
      panels: ['logs'],
      steps: [
        'Διάβασε τις προειδοποιήσεις του broker.',
        'Απάντησε στην ερώτηση: τι πιάνει το home/+;',
        'Αντικατέστησε τους δύο ευρείς κανόνες με συγκεκριμένα topics.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο αισθητήρας έχει «topic write home/+». Σε ποιο από αυτά μπορεί να γράψει;',
        options: ['home/temperature και home/motion', 'Μόνο home/temperature', 'home/temperature και home/led/set'],
        answer: 0,
        explain: 'Σωστά. Το + πιάνει οποιοδήποτε ένα επίπεδο μετά το home/. Άρα και το home/motion. Το home/led/set έχει δύο επίπεδα μετά το home/, οπότε δεν ταιριάζει.',
        retry: 'Όχι ακόμα. Μέτρησε τα επίπεδα μετά το home/: το + πιάνει ακριβώς ένα.'
      },
      hints: [
        'Ελάχιστα δικαιώματα: γράψε ακριβώς τα topics που χρειάζεται κάθε συσκευή, χωρίς wildcards.',
        'Οι ευρείς κανόνες είναι «topic write home/+» (αισθητήρας) και «topic readwrite #» (λάμπα). Το dashboard είναι ήδη σωστό.',
        'Αισθητήρας:\ntopic write home/temperature\ntopic write home/humidity\nΛάμπα:\ntopic read home/led/set\ntopic write home/led/state'
      ],
      validationTests: [TEMP_ALLOW, TEMP_DENY, LAMP_ALLOW, LAMP_DENY, DASH_ALLOW],
      explanationOnSuccess: 'Οι κανόνες είναι τώρα συγκεκριμένοι. Το # έμεινε μόνο εκεί που χρειάζεται πραγματικά: στο read του dashboard. Μια προειδοποίηση του broker είναι χρήσιμη, αλλά η απουσία της δεν αποδεικνύει ότι όλα είναι εντάξει.',
      remediation: 'Αν μια συσκευή δεν μπορεί πια να κάνει τη δουλειά της, στένεψες πολύ: έλεγξε ότι έγραψες όλα τα topics που χρειάζεται.'
    },

    // ------------------------------------------------------------ c12-l4
    {
      id: 'c12-l4', chapter: 12, kind: 'checkpoint', mode: 'config', skills: ['security', 'mqtt'],
      title: 'Έλεγχος κεφαλαίου: ο πίνακας δικαιωμάτων του σπιτιού',
      prerequisites: ['c12-l3'],
      objectives: [
        'Να μεταφράζω έναν πίνακα επιτρεπόμενων ενεργειών σε κανόνες ACL.',
        'Να ελέγχω ότι οι κανόνες δεν είναι ούτε πολύ ευρείς ούτε πολύ στενοί.'
      ],
      theory: `
<p>Ο πίνακας δικαιωμάτων του σπιτιού:</p>
<ul>
  <li><strong>esp32-temp</strong>: write <code>home/temperature</code>, write <code>home/humidity</code>. Τίποτα άλλο.</li>
  <li><strong>esp32-lamp</strong>: read <code>home/led/set</code>, write <code>home/led/state</code>. Τίποτα άλλο.</li>
  <li><strong>dashboard</strong>: read <code>home/#</code>, write <code>home/led/set</code>. Τίποτα άλλο.</li>
  <li><strong>άγνωστη συσκευή</strong>: καμία σύνδεση.</li>
</ul>
<p>Τα tests ελέγχουν <strong>και τις δύο πλευρές</strong>: ό,τι πρέπει να επιτρέπεται και ό,τι πρέπει να απαγορεύεται. Ένας κανόνας πολύ ευρύς αποτυγχάνει. Ένας κανόνας πολύ στενός αποτυγχάνει κι αυτός.</p>
<p>Προσοχή στο εκπαιδευτικό μοντέλο: με <code>acl_default allow</code> οι κανόνες <code>topic</code> <strong>δεν εφαρμόζονται καθόλου</strong> και όλα επιτρέπονται.</p>`,
      glossary: ['ACL (Access Control List)', 'default deny', 'ελάχιστα δικαιώματα'],
      supportedSyntax: SYNTAX_C12,
      initialCode: `${AUTH}
# Προσωρινά: όλα επιτρέπονται, μέχρι να γραφτούν οι κανόνες
acl_default allow

user esp32-temp

user esp32-lamp

user dashboard
`,
      solution: `${AUTH}
acl_default deny

${TEMP_RULES}
${LAMP_RULES}
${DASH_RULES}`,
      initialWorld: {},
      world: { cert: 'valid' },
      panels: ['logs'],
      steps: [
        'Διάβασε τον πίνακα δικαιωμάτων στη θεωρία.',
        'Άλλαξε το default ώστε ό,τι δεν αναφέρεται να απαγορεύεται.',
        'Γράψε τους κανόνες κάθε client κάτω από τη γραμμή user του.',
        'Πάτησε «Έλεγχος λύσης». Διάβασε κάθε αποτυχία: λέει αν έδωσες πολλά ή λίγα δικαιώματα.'
      ],
      quiz: {
        question: 'Γιατί τα tests ελέγχουν και ενέργειες που πρέπει να επιτρέπονται, όχι μόνο όσες πρέπει να απαγορεύονται;',
        options: ['Γιατί ένα σύστημα που απαγορεύει τα πάντα είναι «ασφαλές» αλλά δεν δουλεύει', 'Γιατί ο broker δεν γράφει τίποτα στο log για τις απαγορεύσεις', 'Δεν χρειάζεται: αρκεί να ελέγξουμε τις απαγορεύσεις'],
        answer: 0,
        explain: 'Σωστά. Στόχος είναι τα ελάχιστα δικαιώματα που χρειάζονται, όχι μηδέν δικαιώματα. Οι έλεγχοι allow δείχνουν ότι το σπίτι δουλεύει. Οι έλεγχοι deny δείχνουν ότι δεν δόθηκαν περιττά δικαιώματα.',
        retry: 'Όχι ακόμα. Τι θα γινόταν αν έγραφες acl_default deny και κανέναν κανόνα;'
      },
      hints: [
        'Δύο αλλαγές: πρώτα το default, μετά δύο κανόνες για κάθε client.',
        'Η γραμμή acl_default allow πρέπει να γίνει deny. Μετά, κάτω από κάθε user, γράψε τις γραμμές topic από τον πίνακα της θεωρίας.',
        'Λυμένο παράδειγμα:\nacl_default deny\n\nuser esp32-temp\ntopic write home/temperature\ntopic write home/humidity\n\nuser esp32-lamp\ntopic read home/led/set\ntopic write home/led/state\n\nuser dashboard\ntopic read home/#\ntopic write home/led/set'
      ],
      validationTests: [
        { name: 'Άγνωστη συσκευή δεν συνδέεται', script: [
          { connect: 'unknown-device', port: 8883, tls: true, expect: 'deny', fail: 'Μια άγνωστη συσκευή συνδέθηκε. Μην αλλάζεις τη γραμμή allow_anonymous false.' }
        ] },
        TEMP_ALLOW, TEMP_DENY, LAMP_ALLOW, LAMP_DENY, DASH_ALLOW, DASH_DENY
      ],
      explanationOnSuccess: 'Ο πίνακας δικαιωμάτων περνά ολόκληρος: κάθε συσκευή κάνει τη δουλειά της και τίποτα παραπάνω. Μαζί με τα Κεφάλαια 10 και 11 έχεις τώρα τρία επίπεδα: ταυτότητα (authentication), προστασία μεταφοράς (TLS) και δικαιώματα (authorization). Θυμήσου ότι αυτά είναι αποφάσεις ενός εκπαιδευτικού μοντέλου· σε πραγματικό σύστημα χρειάζεται και έλεγχος της πραγματικής εγκατάστασης.',
      remediation: 'Αν σχεδόν όλοι οι έλεγχοι deny αποτυγχάνουν, μάλλον έμεινε acl_default allow. Αν αποτυγχάνουν έλεγχοι allow, κάποιος κανόνας λείπει ή είναι κάτω από λάθος user.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
