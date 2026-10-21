/*
 * IoT Guardian — Κεφάλαιο 10: Authentication και μυστικά.
 * Ο μαθητής ρυθμίζει τον ΔΙΚΟ του εικονικό broker και τη ΔΙΚΗ του εικονική πλακέτα.
 * Όλοι οι κωδικοί είναι φανταστικές εκπαιδευτικές τιμές.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 10).ready = true;

  const addTerm = (term, def) => { if (!L.GLOSSARY.some(g => g.term === term)) L.GLOSSARY.push({ term, def }); };
  addTerm('authentication', '«Ποιος είσαι;». Ο broker ελέγχει την ταυτότητα ενός client, π.χ. με όνομα χρήστη και κωδικό.');
  addTerm('authorization', '«Τι επιτρέπεται να κάνεις;». Αφού ο broker ξέρει ποιος είσαι, αποφασίζει σε ποια topics μπορείς να γράψεις ή να διαβάσεις.');
  addTerm('κρυπτογράφηση μεταφοράς', '«Πώς προστατεύεται η μεταφορά;». Τα δεδομένα ταξιδεύουν στο δίκτυο έτσι ώστε να μην μπορεί να τα διαβάσει όποιος βλέπει την κίνηση. Στο MQTT γίνεται με TLS.');
  addTerm('credentials', 'Τα στοιχεία σύνδεσης ενός client: συνήθως όνομα χρήστη και κωδικός. Κάθε συσκευή πρέπει να έχει τα δικά της.');
  addTerm('anonymous access', 'Σύνδεση χωρίς όνομα χρήστη και κωδικό. Με allow_anonymous false ο broker την απορρίπτει.');
  addTerm('μυστικό (secret)', 'Κάθε τιμή που δίνει πρόσβαση: κωδικός, κλειδί, token. Δεν γράφεται στον κοινόχρηστο κώδικα και δεν τυπώνεται σε logs.');
  addTerm('redaction', 'Απόκρυψη μυστικών από logs και μηνύματα. Τυπώνεις π.χ. το όνομα χρήστη, αλλά ποτέ τον κωδικό.');
  addTerm('hash κωδικού', 'Μονόδρομος «δακτυλικό αποτύπωμα» του κωδικού. Ο πραγματικός mosquitto αποθηκεύει hashes (με το εργαλείο mosquitto_passwd), όχι τους ίδιους τους κωδικούς.');

  const SYNTAX_C10_CONFIG = 'listener, allow_anonymous true/false, password <χρήστης> <κωδικός>, σχόλια με # στην αρχή της γραμμής';
  const SYNTAX_C10_CODE = 'Serial.println, mqtt.setServer, mqtt.connect(id, user, pass), String με +, σταθερές MQTT_USER και MQTT_PASS';

  // Κοινές εκπαιδευτικές τιμές (φανταστικές).
  const PIR = { user: 'esp32-pir', pass: 'Pir-Lab-Key-0427' };
  const TEMP = { user: 'esp32-temp', pass: 'Temp-Lab-Key-0911' };
  const LAMP = { user: 'esp32-lamp', pass: 'Lamp-Lab-Key-0613' };
  const DASH = { user: 'dashboard', pass: 'Dash-Lab-Key-0815' };

  const allowConn = (c, who) => ({
    connect: c.user, user: c.user, pass: c.pass, port: 1883, expect: 'allow',
    fail: `Ο ${who || c.user} δεν μπόρεσε να συνδεθεί με τα δικά του στοιχεία: {v} Έλεγξε ότι υπάρχει γραμμή password ${c.user} με τον σωστό κωδικό.`
  });

  const ANON_DENY = {
    connect: 'unknown-device', port: 1883, expect: 'deny',
    fail: 'Μια άγνωστη συσκευή συνδέθηκε χωρίς όνομα χρήστη και κωδικό. Έλεγξε τη γραμμή allow_anonymous: πρέπει να είναι false.'
  };

  L.lessons.push(
    // ------------------------------------------------------------ c10-l1
    {
      id: 'c10-l1', chapter: 10, kind: 'guided', mode: 'config', skills: ['security', 'mqtt'],
      title: 'Ποιος είσαι; Κλείνουμε τις ανώνυμες συνδέσεις',
      prerequisites: [],
      objectives: [
        'Να ξεχωρίζω authentication, authorization και κρυπτογράφηση.',
        'Να κλείνω το anonymous access στον broker.',
        'Να δίνω σε κάθε client δικό του λογαριασμό.'
      ],
      theory: `
<p>Στην ασφάλεια ενός συστήματος IoT υπάρχουν <strong>τρεις διαφορετικές ερωτήσεις</strong>. Μην τις μπερδεύεις:</p>
<ul>
  <li><strong>Authentication</strong>: «Ποιος είσαι;» → όνομα χρήστη και κωδικός.</li>
  <li><strong>Authorization</strong>: «Τι επιτρέπεται να κάνεις;» → ποια topics (Κεφάλαιο 12).</li>
  <li><strong>Κρυπτογράφηση μεταφοράς</strong>: «Πώς προστατεύεται η μεταφορά;» → TLS (Κεφάλαιο 11).</li>
</ul>
<p>Σε αυτό το κεφάλαιο ασχολούμαστε μόνο με την πρώτη: το <strong>authentication</strong>.</p>
<p>Η ρύθμιση <code>allow_anonymous true</code> σημαίνει: «δέξου όποιον συνδεθεί, ακόμα και χωρίς στοιχεία». Με <code>false</code>, κάθε client πρέπει να δώσει όνομα και κωδικό.</p>
<p>Η γραμμή <code>password esp32-pir Pir-Lab-Key-0427</code> φτιάχνει τον λογαριασμό <code>esp32-pir</code>. Οι κωδικοί εδώ είναι <strong>φανταστικοί</strong>, μόνο για εξάσκηση.</p>
<p><strong>Προσοχή:</strong> στο μοντέλο μας ο κωδικός γράφεται καθαρά στις ρυθμίσεις, για να είναι εύκολο. Ένα αρχείο ρυθμίσεων <strong>δεν</strong> είναι αυτόματα ασφαλής αποθήκη. Ο πραγματικός mosquitto κρατά τους κωδικούς σε ξεχωριστό αρχείο (<code>password_file</code>) ως <strong>hash</strong>, με το εργαλείο <code>mosquitto_passwd</code>.</p>`,
      glossary: ['authentication', 'authorization', 'κρυπτογράφηση μεταφοράς', 'anonymous access', 'credentials', 'hash κωδικού'],
      supportedSyntax: SYNTAX_C10_CONFIG,
      initialCode: `# Ρυθμίσεις του broker (εκπαιδευτικό μοντέλο τύπου mosquitto)
listener 1883

# Δέχεται ο broker συνδέσεις χωρίς όνομα και κωδικό;
allow_anonymous ____

# Ένας λογαριασμός για κάθε client
password esp32-pir Pir-Lab-Key-0427
password ____ Dash-Lab-Key-0815
`,
      solution: `# Ρυθμίσεις του broker (εκπαιδευτικό μοντέλο τύπου mosquitto)
listener 1883

# Δέχεται ο broker συνδέσεις χωρίς όνομα και κωδικό;
allow_anonymous false

# Ένας λογαριασμός για κάθε client
password esp32-pir Pir-Lab-Key-0427
password dashboard Dash-Lab-Key-0815
`,
      initialWorld: {},
      world: { cert: 'valid' },
      panels: ['logs'],
      steps: [
        'Απάντησε στην ερώτηση κατανόησης.',
        'Στο πρώτο κενό γράψε την τιμή που κλείνει τις ανώνυμες συνδέσεις.',
        'Στο δεύτερο κενό γράψε το όνομα χρήστη του dashboard: dashboard.',
        'Πάτησε «Έλεγχος λύσης». Δες στο log του broker ποιοι έγιναν δεκτοί και ποιοι όχι.'
      ],
      quiz: {
        question: 'Ο broker ελέγχει όνομα και κωδικό πριν δεχτεί έναν client. Ποια από τις τρεις ερωτήσεις απαντά αυτός ο έλεγχος;',
        options: ['Ποιος είσαι; (authentication)', 'Τι επιτρέπεται να κάνεις; (authorization)', 'Πώς προστατεύεται η μεταφορά; (κρυπτογράφηση)'],
        answer: 0,
        explain: 'Σωστά. Όνομα και κωδικός αποδεικνύουν ταυτότητα. Το τι επιτρέπεται (authorization) και η κρυπτογράφηση της μεταφοράς είναι χωριστά θέματα, με δικές τους ρυθμίσεις.',
        retry: 'Όχι ακόμα. Ο κωδικός δεν λέει τι μπορείς να κάνεις, ούτε κρύβει τα δεδομένα στο δίκτυο. Τι αποδεικνύει;'
      },
      hints: [
        'Το allow_anonymous δέχεται μόνο true ή false. Ποιο από τα δύο απαγορεύει τις συνδέσεις χωρίς στοιχεία;',
        'Κοίτα τις γραμμές 5 και 9. Στη γραμμή 9 λείπει το όνομα του λογαριασμού, που ακολουθεί αμέσως μετά τη λέξη password.',
        'Η σωστή μορφή είναι:\nallow_anonymous false\npassword dashboard Dash-Lab-Key-0815\nΤο false κλείνει τις ανώνυμες συνδέσεις. Η γραμμή password φτιάχνει λογαριασμό: πρώτα όνομα, μετά κωδικός.'
      ],
      validationTests: [
        { name: 'Το esp32-pir συνδέεται με τα δικά του στοιχεία', script: [allowConn(PIR)] },
        { name: 'Το dashboard συνδέεται με τα δικά του στοιχεία', script: [allowConn(DASH, 'dashboard')] },
        { name: 'Άγνωστη συσκευή χωρίς στοιχεία απορρίπτεται', script: [ANON_DENY] },
        { name: 'Ταυτότητα που δεν υπάρχει απορρίπτεται', script: [
          { connect: 'unknown-device', user: 'guest', pass: 'Guest-Lab-Key-0000', port: 1883, expect: 'deny',
            fail: 'Ο broker δέχτηκε τον λογαριασμό guest, που δεν έχει δική του γραμμή password. Κράτα μόνο τους λογαριασμούς που χρειάζεσαι.' }
        ] }
      ],
      explanationOnSuccess: 'Ο broker τώρα ρωτά «ποιος είσαι;» πριν δεχτεί κάποιον. Οι δύο γνωστοί clients μπαίνουν με τα δικά τους στοιχεία, ενώ η άγνωστη συσκευή απορρίπτεται. Θυμήσου: αυτό είναι μόνο authentication. Τα δεδομένα ακόμα ταξιδεύουν χωρίς κρυπτογράφηση στη θύρα 1883 (το λύνουμε στο Κεφάλαιο 11).',
      remediation: 'Αν βλέπεις μήνυμα για γραμμή με κενό, σβήσε τις κάτω παύλες και γράψε την τιμή. Αν η άγνωστη συσκευή συνδέεται ακόμα, έλεγξε ότι γράφεις false με πεζά γράμματα.'
    },

    // ------------------------------------------------------------ c10-l2
    {
      id: 'c10-l2', chapter: 10, kind: 'variant', mode: 'config', skills: ['security', 'mqtt'],
      title: 'Ένας λογαριασμός για όλους; Όχι πια',
      prerequisites: ['c10-l1'],
      objectives: [
        'Να εξηγώ γιατί ο κοινός λογαριασμός είναι κακή πρακτική.',
        'Να δίνω σε κάθε client διακριτή ταυτότητα.'
      ],
      theory: `
<p>Σε πολλά σπίτια όλες οι συσκευές μοιράζονται <strong>έναν</strong> λογαριασμό. Είναι βολικό, αλλά δημιουργεί τρία προβλήματα:</p>
<ol>
  <li>Στο log δεν φαίνεται <strong>ποια συσκευή</strong> έκανε κάτι.</li>
  <li>Αν χαθεί μία συσκευή, πρέπει να αλλάξεις τον κωδικό <strong>σε όλες</strong>.</li>
  <li>Δεν μπορείς να δώσεις σε κάθε συσκευή <strong>διαφορετικά δικαιώματα</strong> (Κεφάλαιο 12).</li>
</ol>
<p>Η λύση: <strong>μοναδικά credentials</strong>. Κάθε client έχει δικό του όνομα χρήστη και δικό του κωδικό.</p>
<p>Ένας καλός κωδικός είναι <strong>μακρύς</strong> (τουλάχιστον 12 χαρακτήρες) και διαφορετικός για κάθε συσκευή.</p>`,
      glossary: ['credentials', 'authentication'],
      supportedSyntax: SYNTAX_C10_CONFIG,
      initialCode: `listener 1883
allow_anonymous false

# Όλες οι συσκευές μοιράζονται τον ίδιο λογαριασμό
password home Home-Shared-Key-2026
`,
      solution: `listener 1883
allow_anonymous false

# Ένας λογαριασμός για κάθε client
password esp32-temp Temp-Lab-Key-0911
password esp32-lamp Lamp-Lab-Key-0613
password dashboard Dash-Lab-Key-0815
`,
      initialWorld: {},
      world: { cert: 'valid' },
      panels: ['logs'],
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Σβήσε τον κοινό λογαριασμό home.',
        'Φτιάξε τρεις λογαριασμούς. Οι εκπαιδευτικοί κωδικοί είναι: esp32-temp → Temp-Lab-Key-0911, esp32-lamp → Lamp-Lab-Key-0613, dashboard → Dash-Lab-Key-0815.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Όλες οι συσκευές συνδέονται ως home. Στο log βλέπεις ότι ο home έστειλε ένα παράξενο μήνυμα. Τι ξέρεις για το ποια συσκευή το έστειλε;',
        options: ['Τίποτα σίγουρο: όλες έχουν την ίδια ταυτότητα', 'Ήταν σίγουρα το dashboard', 'Ήταν σίγουρα ο αισθητήρας θερμοκρασίας'],
        answer: 0,
        explain: 'Σωστά. Με κοινό λογαριασμό, ο broker βλέπει μόνο «home». Με διακριτές ταυτότητες, κάθε γραμμή του log δείχνει ποιος client ήταν.',
        retry: 'Όχι ακόμα. Τι όνομα βλέπει ο broker για κάθε συσκευή, όταν όλες χρησιμοποιούν τον λογαριασμό home;'
      },
      hints: [
        'Κάθε client χρειάζεται τη δική του γραμμή password, με το δικό του όνομα.',
        'Σβήσε τη γραμμή password home … και γράψε τρεις νέες γραμμές password από κάτω, μία για κάθε client.',
        'Οι τρεις γραμμές είναι:\npassword esp32-temp Temp-Lab-Key-0911\npassword esp32-lamp Lamp-Lab-Key-0613\npassword dashboard Dash-Lab-Key-0815\nΚάθε γραμμή: λέξη password, όνομα χρήστη, κωδικός.'
      ],
      validationTests: [
        { name: 'Ο αισθητήρας θερμοκρασίας συνδέεται ως esp32-temp', script: [allowConn(TEMP)] },
        { name: 'Η λάμπα συνδέεται ως esp32-lamp', script: [allowConn(LAMP)] },
        { name: 'Το dashboard συνδέεται ως dashboard', script: [allowConn(DASH, 'dashboard')] },
        { name: 'Ο κοινός λογαριασμός home δεν δουλεύει πια', script: [
          { connect: 'unknown-device', user: 'home', pass: 'Home-Shared-Key-2026', port: 1883, expect: 'deny',
            fail: 'Μια συσκευή συνδέθηκε ακόμα με τον κοινό λογαριασμό home. Σβήσε τη γραμμή password home.' }
        ] },
        { name: 'Χωρίς στοιχεία δεν μπαίνει κανείς', script: [ANON_DENY] }
      ],
      explanationOnSuccess: 'Κάθε client έχει τώρα δική του ταυτότητα. Στο log φαίνεται ποιος συνδέθηκε, και αν χρειαστεί να αλλάξεις έναν κωδικό, αλλάζεις μόνο έναν λογαριασμό.',
      remediation: 'Αν μια σύνδεση απορρίπτεται, σύγκρινε γράμμα-γράμμα τον κωδικό με τα βήματα. Τα κεφαλαία και τα πεζά μετράνε.'
    },

    // ------------------------------------------------------------ c10-l3
    {
      id: 'c10-l3', chapter: 10, kind: 'independent', skills: ['security', 'mqtt', 'variables'],
      title: 'Μυστικά έξω από τον κώδικα και έξω από τα logs',
      prerequisites: ['c10-l2'],
      objectives: [
        'Να παίρνω τα credentials από ξεχωριστό αρχείο ρυθμίσεων, όχι από τον κώδικα.',
        'Να μην τυπώνω ποτέ κωδικό στο Serial (redaction).',
        'Να κρατώ χρήσιμα logs χωρίς μυστικά.'
      ],
      theory: `
<p>Ο κώδικας συχνά μοιράζεται: σε συμμαθητές, σε ένα αποθετήριο, σε ένα screenshot. Αν ο κωδικός είναι γραμμένος μέσα του, ταξιδεύει μαζί του.</p>
<p>Γι' αυτό <strong>χωρίζουμε τις ρυθμίσεις από τον κώδικα</strong>. Σε αυτή την άσκηση, τα στοιχεία έρχονται από ένα ξεχωριστό αρχείο ρυθμίσεων ως σταθερές:</p>
<ul>
  <li><code>MQTT_USER</code> → το όνομα χρήστη</li>
  <li><code>MQTT_PASS</code> → ο κωδικός</li>
</ul>
<p>Δεύτερος κανόνας: <strong>ποτέ μην τυπώνεις μυστικό</strong> στο Serial ή σε log. Αυτό λέγεται <strong>redaction</strong>. Το όνομα χρήστη μπορείς να το τυπώσεις. Τον κωδικό, όχι.</p>
<p><strong>Ειλικρινά:</strong> το ξεχωριστό αρχείο δεν κάνει τον κωδικό αόρατο. Η πλακέτα τον έχει ακόμα στη μνήμη της. Απλώς δεν μπαίνει στον κοινόχρηστο κώδικα και δεν εμφανίζεται σε logs.</p>`,
      glossary: ['μυστικό (secret)', 'redaction', 'credentials'],
      supportedSyntax: SYNTAX_C10_CODE,
      initialCode: `// Τα στοιχεία σύνδεσης υπάρχουν σε ξεχωριστό αρχείο ρυθμίσεων:
// MQTT_USER και MQTT_PASS

void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 1883);

  String user = "esp32-pir";
  String pass = "Pir-Lab-Key-0427";

  Serial.println("Connecting as " + user);
  Serial.println("Password: " + pass);

  if (mqtt.connect("esp32-pir", user, pass)) {
    Serial.println("MQTT connected");
  } else {
    Serial.println("MQTT failed");
  }
}

void loop() {
  delay(1000);
}
`,
      solution: `// Τα στοιχεία σύνδεσης υπάρχουν σε ξεχωριστό αρχείο ρυθμίσεων:
// MQTT_USER και MQTT_PASS

void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 1883);

  Serial.println("Connecting as " + MQTT_USER);   // το όνομα επιτρέπεται

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
  } else {
    Serial.println("MQTT failed");
  }
}

void loop() {
  delay(1000);
}
`,
      initialWorld: { wifi: 'connected' },
      world: {
        wifi: 'connected',
        broker: 'listener 1883\nallow_anonymous false\npassword esp32-pir Pir-Lab-Key-0427\npassword dashboard Dash-Lab-Key-0815\n',
        clients: [{ name: 'dashboard', subs: ['home/#'], user: 'dashboard', pass: 'Dash-Lab-Key-0815', port: 1883 }],
        consts: { MQTT_USER: 'esp32-pir', MQTT_PASS: 'Pir-Lab-Key-0427' }
      },
      hardware: ['broker'],
      panels: ['serial', 'vars', 'mqtt', 'logs'],
      steps: [
        'Τρέξε τον κώδικα. Κοίτα το Serial Monitor: τι βλέπει όποιος κοιτάξει την οθόνη σου;',
        'Σβήσε τις δύο μεταβλητές με τα στοιχεία. Χρησιμοποίησε στη θέση τους MQTT_USER και MQTT_PASS.',
        'Σβήσε τη γραμμή που τυπώνει τον κωδικό. Κράτα τη γραμμή «Connecting as …».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ποια γραμμή είναι ασφαλές να μείνει στο Serial Monitor;',
        options: ['Connecting as esp32-pir', 'Password: Pir-Lab-Key-0427', 'Και οι δύο, αφού το Serial το βλέπω μόνο εγώ'],
        answer: 0,
        explain: 'Σωστά. Το όνομα χρήστη βοηθά στην αποσφαλμάτωση και δεν δίνει πρόσβαση. Ο κωδικός δίνει πρόσβαση, άρα δεν τυπώνεται ποτέ. Τα logs συχνά αντιγράφονται, φωτογραφίζονται ή στέλνονται σε άλλους.',
        retry: 'Όχι ακόμα. Ποια από τις δύο τιμές αρκεί για να συνδεθεί κάποιος στον broker;'
      },
      hints: [
        'Δύο κανόνες: ο κωδικός δεν γράφεται μέσα στον κώδικα, και δεν τυπώνεται στο Serial.',
        'Κοίτα τις γραμμές 8 έως 14. Εκεί υπάρχει ο κωδικός γραμμένος καθαρά, μια εντολή που τον τυπώνει, και το mqtt.connect που τον χρησιμοποιεί.',
        'Γράψε:\nSerial.println("Connecting as " + MQTT_USER);\nif (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {\nΚαι σβήσε τις γραμμές String user, String pass και Serial.println("Password: " + pass).'
      ],
      validationTests: [
        { name: 'Η πλακέτα συνδέεται με τα στοιχεία από το αρχείο ρυθμίσεων', script: [
          { setup: true },
          { check: 'mqttConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε στον broker: {v} Χρησιμοποίησε mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS).' },
          { check: 'serialHas', text: 'MQTT connected', fail: 'Δεν τυπώθηκε «MQTT connected». Τελευταίες γραμμές: {v}.' }
        ] },
        { name: 'Ο κωδικός δεν τυπώνεται στο Serial', script: [
          { setup: true }, { loops: 3 },
          { check: 'serialNot', text: 'Pir-Lab-Key-0427', fail: 'Ο κωδικός εμφανίζεται στο Serial Monitor. Σβήσε κάθε Serial.print που τυπώνει τον κωδικό.' }
        ] },
        { name: 'Το log λέει ακόμα ποιος συνδέεται', script: [
          { setup: true },
          { check: 'serialHas', text: 'Connecting as esp32-pir', fail: 'Δεν βρήκα τη γραμμή «Connecting as esp32-pir». Κράτα το όνομα χρήστη στο log: είναι χρήσιμο και δεν είναι μυστικό. Τελευταίες γραμμές: {v}.' }
        ] },
        { name: 'Ο κωδικός δεν είναι γραμμένος μέσα στον κώδικα', script: [
          { setup: true },
          { check: 'sourceNot', text: 'Pir-Lab-Key-0427', fail: 'Ο κωδικός είναι ακόμα γραμμένος μέσα στον κώδικα. Χρησιμοποίησε τη σταθερά MQTT_PASS από το αρχείο ρυθμίσεων.' },
          { check: 'mqttConnected', is: true, fail: 'Ο κωδικός λείπει από τον κώδικα, αλλά η σύνδεση απέτυχε: {v} Δώσε στο mqtt.connect τα MQTT_USER και MQTT_PASS.' }
        ] }
      ],
      explanationOnSuccess: 'Ο κώδικάς σου μπορεί τώρα να μοιραστεί χωρίς να μοιραστεί και ο κωδικός. Το log δείχνει ποιος συνδέεται, αλλά δεν δείχνει κανένα μυστικό. Θυμήσου ότι ο κωδικός υπάρχει ακόμα στην πλακέτα: τα μυστικά χρειάζονται προστασία και εκεί που αποθηκεύονται.',
      remediation: 'Αν η σύνδεση αποτυγχάνει, έλεγξε ότι γράφεις MQTT_USER και MQTT_PASS χωρίς εισαγωγικά. Με εισαγωγικά θα ήταν απλό κείμενο, όχι οι σταθερές.'
    },

    // ------------------------------------------------------------ c10-l4
    {
      id: 'c10-l4', chapter: 10, kind: 'checkpoint', mode: 'config', skills: ['security', 'mqtt'],
      title: 'Έλεγχος κεφαλαίου: καθάρισε τις ρυθμίσεις authentication',
      prerequisites: ['c10-l3'],
      objectives: [
        'Να εντοπίζω προβλήματα authentication σε ένα αρχείο ρυθμίσεων.',
        'Να αφήνω ανοιχτούς μόνο τους λογαριασμούς που χρειάζονται, με δυνατούς κωδικούς.'
      ],
      theory: `
<p>Πριν από μια αλλαγή, οι ρυθμίσεις του broker ελέγχονται. Ψάχνουμε τρία συνηθισμένα προβλήματα:</p>
<ul>
  <li><strong>Ανοιχτό anonymous access</strong>: <code>allow_anonymous true</code>.</li>
  <li><strong>Ξεχασμένοι λογαριασμοί δοκιμών</strong>, π.χ. <code>test</code> με κωδικό <code>test</code>.</li>
  <li><strong>Κοντοί κωδικοί</strong>: κάτω από 12 χαρακτήρες. Ο broker βγάζει προειδοποίηση.</li>
</ul>
<p>Κάθε συσκευή του σπιτιού χρειάζεται <strong>δικό της</strong> λογαριασμό. Τίποτα παραπάνω.</p>
<p>Θυμήσου: εδώ οι κωδικοί φαίνονται καθαρά για εκπαιδευτικούς λόγους. Σε πραγματικό mosquitto αποθηκεύονται ως hash, σε ξεχωριστό αρχείο με περιορισμένη πρόσβαση.</p>`,
      glossary: ['anonymous access', 'credentials', 'hash κωδικού'],
      supportedSyntax: SYNTAX_C10_CONFIG,
      initialCode: `listener 1883
allow_anonymous true

password esp32-pir Pir-Lab-Key-0427
password esp32-temp Temp-Lab-Key-0911
password esp32-lamp lamp1234
password dashboard Dash-Lab-Key-0815

# λογαριασμός για μια γρήγορη δοκιμή
password test test
`,
      solution: `listener 1883
allow_anonymous false

password esp32-pir Pir-Lab-Key-0427
password esp32-temp Temp-Lab-Key-0911
password esp32-lamp Lamp-Lab-Key-0613
password dashboard Dash-Lab-Key-0815
`,
      initialWorld: {},
      world: { cert: 'valid' },
      panels: ['logs'],
      steps: [
        'Διάβασε τις ρυθμίσεις και τις προειδοποιήσεις. Βρες τρία προβλήματα.',
        'Κλείσε τις ανώνυμες συνδέσεις.',
        'Δώσε στη λάμπα τον νέο εκπαιδευτικό κωδικό Lamp-Lab-Key-0613.',
        'Σβήσε τον λογαριασμό δοκιμών.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Μετά τη διόρθωση, μια άγνωστη συσκευή δοκιμάζει να συνδεθεί χωρίς στοιχεία. Τι θα γίνει;',
        options: ['Ο broker την απορρίπτει: δεν δέχεται ανώνυμες συνδέσεις', 'Συνδέεται, αλλά δεν μπορεί να στείλει μηνύματα', 'Συνδέεται κανονικά, γιατί είναι στο ίδιο WiFi'],
        answer: 0,
        explain: 'Σωστά. Με allow_anonymous false, η σύνδεση σταματά στο authentication. Το ότι μια συσκευή είναι στο ίδιο δίκτυο δεν της δίνει ταυτότητα.',
        retry: 'Όχι ακόμα. Ποια ρύθμιση αποφασίζει για τις συνδέσεις χωρίς όνομα και κωδικό;'
      },
      hints: [
        'Ψάξε για: ανοιχτές ανώνυμες συνδέσεις, κωδικό κάτω από 12 χαρακτήρες, λογαριασμό που δεν ανήκει σε καμία συσκευή του σπιτιού.',
        'Κοίτα τη γραμμή 2 (allow_anonymous), τη γραμμή 6 (κωδικός της λάμπας) και τις γραμμές 9–10 (λογαριασμός test).',
        'Οι αλλαγές:\nallow_anonymous false\npassword esp32-lamp Lamp-Lab-Key-0613\nΚαι σβήσε τη γραμμή password test test (μαζί με το σχόλιο από πάνω της).'
      ],
      validationTests: [
        { name: 'Οι τέσσερις συσκευές του σπιτιού συνδέονται', script: [
          allowConn(PIR), allowConn(TEMP), allowConn(LAMP), allowConn(DASH, 'dashboard')
        ] },
        { name: 'Άγνωστη συσκευή χωρίς στοιχεία απορρίπτεται', script: [ANON_DENY] },
        { name: 'Ο λογαριασμός δοκιμών δεν υπάρχει πια', script: [
          { connect: 'unknown-device', user: 'test', pass: 'test', port: 1883, expect: 'deny',
            fail: 'Ο broker δέχτηκε τον λογαριασμό test. Σβήσε τη γραμμή password test test.' }
        ] },
        { name: 'Ο παλιός κοντός κωδικός της λάμπας δεν δουλεύει', script: [
          { connect: 'esp32-lamp', user: 'esp32-lamp', pass: 'lamp1234', port: 1883, expect: 'deny',
            fail: 'Η λάμπα συνδέεται ακόμα με τον παλιό κοντό κωδικό lamp1234. Άλλαξέ τον σε Lamp-Lab-Key-0613.' }
        ] }
      ],
      explanationOnSuccess: 'Ο broker ζητά πλέον ταυτότητα από όλους, κάθε συσκευή έχει δικό της λογαριασμό με μακρύ κωδικό, και δεν μένουν ξεχασμένοι λογαριασμοί. Αυτό είναι το authentication. Στο επόμενο κεφάλαιο θα προστατέψεις και τη μεταφορά των κωδικών με TLS.',
      remediation: 'Αν ένας έλεγχος αποτυγχάνει, διάβασε ποιος client απορρίφθηκε ή έγινε δεκτός και κοίτα τη δική του γραμμή password.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
