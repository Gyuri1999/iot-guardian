/*
 * IoT Guardian — Κεφάλαιο 6: WiFi και δίκτυα.
 * Έννοιες: SSID, password, IP, port, τοπικό δίκτυο, σύνδεση, timeout, απώλεια και περιορισμένη επανασύνδεση.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 6).ready = true;

  const SYNTAX_CH6 = 'Ό,τι μέχρι το Κεφ. 5, συν: WiFi.begin(WIFI_SSID, WIFI_PASSWORD), WiFi.status(), WL_CONNECTED, WiFi.localIP(), WiFi.reconnect()';
  const PANELS = ['serial', 'vars', 'branch', 'loops'];
  const HW = ['router', 'button'];

  // Χρόνος σε κομμάτια των 2 s (ο εκτελεστής ελέγχων τρέχει έως 200.000 επαναλήψεις ανά βήμα «ms»).
  const wait = seconds => Array.from({ length: Math.ceil(seconds / 2) }, () => ({ ms: 2000 }));

  const BUTTON_STILL_WORKS = [
    { set: { button: true } }, { ms: 100 },
    { check: 'led', is: true, fail: 'Χωρίς WiFi, το κουμπί πατήθηκε αλλά το LED είναι {v}. Η λογική του κουμπιού πρέπει να συνεχίζει, ακόμα κι όταν το δίκτυο λείπει.' },
    { set: { button: false } }, { ms: 100 },
    { check: 'led', is: false, fail: 'Χωρίς WiFi, το κουμπί αφέθηκε αλλά το LED είναι {v}.' }
  ];

  // Κοινός κώδικας σύνδεσης με timeout (λύση του c6-l2, αρχή για c6-l3 και c6-l4).
  const CONNECT_FN = `bool connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT) {
    delay(100);
  }
  return WiFi.status() == WL_CONNECTED;
}`;

  const SETUP_BLOCK = `void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);

  wasConnected = connectWiFi();
  lastAttempt = millis();
  if (wasConnected) {
    Serial.println("WiFi connected");
    Serial.println("IP: " + WiFi.localIP());
  } else {
    Serial.println("WiFi failed");
  }
}`;

  L.GLOSSARY.push(
    { term: 'WiFi', def: 'Ασύρματο τοπικό δίκτυο. Η πλακέτα συνδέεται σε έναν router, όπως ένα κινητό.' },
    { term: 'SSID', def: 'Το όνομα ενός δικτύου WiFi, π.χ. SmartHome-Lab. Δεν είναι μυστικό: το βλέπουν όλοι κοντά στον router.' },
    { term: 'κωδικός WiFi', def: 'Το μυστικό που χρειάζεται για να μπεις στο δίκτυο. Δεν το γράφουμε μέσα στον κώδικα και δεν το τυπώνουμε ποτέ.' },
    { term: 'αρχείο ρυθμίσεων', def: 'Ξεχωριστό αρχείο με στοιχεία όπως SSID και κωδικούς (π.χ. secrets.h). Δεν το ανεβάζουμε μαζί με τον κώδικα και δεν το μοιραζόμαστε.' },
    { term: 'διεύθυνση IP', def: 'Ο «αριθμός διεύθυνσης» μιας συσκευής στο δίκτυο, π.χ. 192.168.1.42. Τη δίνει συνήθως ο router.' },
    { term: 'port', def: 'Αριθμός «πόρτας» πάνω σε μια συσκευή. Δείχνει σε ποια υπηρεσία πάει ένα μήνυμα, π.χ. 1883 για MQTT.' },
    { term: 'τοπικό δίκτυο (LAN)', def: 'Οι συσκευές ενός σπιτιού ή εργαστηρίου που συνδέονται στον ίδιο router. Οι διευθύνσεις 192.168.x.x είναι τοπικές.' },
    { term: 'WiFi.status', def: 'Επιστρέφει την κατάσταση του WiFi. WL_CONNECTED (3) σημαίνει «συνδεδεμένο».' },
    { term: 'timeout', def: 'Ένα όριο χρόνου: «αν δεν τα καταφέρεις σε 10 δευτερόλεπτα, σταμάτα να περιμένεις και πες ότι απέτυχε».' },
    { term: 'επανασύνδεση', def: 'Νέα προσπάθεια σύνδεσης μετά από απώλεια. Γίνεται με μέτρο: λίγες προσπάθειες, με διάστημα ανάμεσα.' }
  );

  L.lessons.push(
    // ------------------------------------------------------------ c6-l1
    {
      id: 'c6-l1', chapter: 6, kind: 'micro', skills: ['network'],
      title: 'Σύνδεση στο WiFi και διεύθυνση IP',
      prerequisites: [],
      objectives: ['Να ξέρω τι είναι SSID, κωδικός και διεύθυνση IP.', 'Να συνδέω την πλακέτα στο εικονικό WiFi.', 'Να μην τυπώνω ποτέ τον κωδικό.'],
      theory: `
<p>Για να μπει η πλακέτα στο <strong>τοπικό δίκτυο</strong> του σπιτιού χρειάζεται δύο στοιχεία:</p>
<ul>
  <li><strong>SSID</strong>: το όνομα του δικτύου. Εδώ: <code>WIFI_SSID</code>.</li>
  <li><strong>Κωδικός</strong>: το μυστικό του δικτύου. Εδώ: <code>WIFI_PASSWORD</code>.</li>
</ul>
<p>Αυτές οι δύο σταθερές βρίσκονται σε <strong>ξεχωριστό αρχείο ρυθμίσεων</strong>, όχι στον κώδικα. Έτσι μπορείς να δείξεις τον κώδικά σου χωρίς να δείξεις τον κωδικό. <strong>Ποτέ</strong> δεν τυπώνουμε τον κωδικό στο Serial.</p>
<p><code>WiFi.begin(WIFI_SSID, WIFI_PASSWORD);</code> ξεκινά τη σύνδεση. Η σύνδεση <strong>δεν</strong> γίνεται αμέσως. Γι’ αυτό ρωτάμε συνέχεια <code>WiFi.status()</code> μέχρι να γίνει <code>WL_CONNECTED</code>.</p>
<p>Μόλις συνδεθεί, ο router δίνει στην πλακέτα μια <strong>διεύθυνση IP</strong>, π.χ. <code>192.168.1.42</code>. Τη βλέπεις με <code>WiFi.localIP()</code>.</p>
<p>Η IP λέει <strong>ποια συσκευή</strong>. Το <strong>port</strong> (θύρα) λέει <strong>ποια υπηρεσία</strong> πάνω της, π.χ. 1883 για MQTT. Θα το χρησιμοποιήσεις στο Κεφάλαιο 7.</p>`,
      glossary: ['WiFi', 'SSID', 'κωδικός WiFi', 'αρχείο ρυθμίσεων', 'διεύθυνση IP', 'port', 'τοπικό δίκτυο (LAN)', 'WiFi.status'],
      supportedSyntax: SYNTAX_CH6,
      initialCode: `void setup() {
  Serial.begin(115200);
  Serial.println("Connecting to " + WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);      // τα στοιχεία έρχονται από το αρχείο ρυθμίσεων
  while (WiFi.status() != WL_CONNECTED) {    // περίμενε μέχρι να συνδεθεί
    delay(100);
  }
  Serial.println("WiFi connected");

  // ΣΥΜΠΛΗΡΩΣΕ: τύπωσε "IP: " και μετά τη διεύθυνση IP της πλακέτας

}

void loop() {
  delay(1000);
}
`,
      solution: `void setup() {
  Serial.begin(115200);
  Serial.println("Connecting to " + WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);      // τα στοιχεία έρχονται από το αρχείο ρυθμίσεων
  while (WiFi.status() != WL_CONNECTED) {    // περίμενε μέχρι να συνδεθεί
    delay(100);
  }
  Serial.println("WiFi connected");
  Serial.println("IP: " + WiFi.localIP());
}

void loop() {
  delay(1000);
}
`,
      initialWorld: { router: true }, world: { router: true },
      hardware: ['router'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε βήμα-βήμα. Δες πόσες φορές γυρίζει ο while πριν συνδεθεί η πλακέτα.',
        'Πρόσθεσε μια γραμμή που τυπώνει «IP: » και τη διεύθυνση της πλακέτας.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ποιο από αυτά είναι μυστικό και δεν πρέπει να εμφανίζεται ποτέ στο Serial Monitor;',
        options: ['Ο κωδικός του WiFi', 'Το SSID (όνομα δικτύου)', 'Η τοπική διεύθυνση IP της πλακέτας'],
        answer: 0,
        explain: 'Σωστά. Το SSID το βλέπουν όλοι κοντά στον router, και η τοπική IP χρειάζεται για έλεγχο. Ο κωδικός όμως δίνει πρόσβαση στο δίκτυο.',
        retry: 'Όχι ακόμα. Ποιο από τα τρία θα άνοιγε την πόρτα του δικτύου σε όποιον το έβλεπε;'
      },
      hints: [
        'Η διεύθυνση IP επιστρέφεται από μια εντολή του WiFi.',
        'Η εντολή είναι WiFi.localIP(). Ένωσέ την με το κείμενο "IP: " χρησιμοποιώντας +.',
        'Γράψε: Serial.println("IP: " + WiFi.localIP());\nΘα τυπώσει IP: 192.168.1.42'
      ],
      validationTests: [
        { name: 'Μετά τη σύνδεση τυπώνεται «IP: 192.168.1.42»', world: { router: true }, script: [
          { setup: true },
          { check: 'wifiConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε στο WiFi. Κράτα το WiFi.begin(WIFI_SSID, WIFI_PASSWORD);' },
          { check: 'count', text: 'IP: 192.168.1.42', is: 1, fail: 'Το «IP: 192.168.1.42» τυπώθηκε {n} φορές. Περίμενα 1, στο setup().', failZero: 'Δεν τυπώθηκε η διεύθυνση IP. Περίμενα μια γραμμή «IP: 192.168.1.42».' },
          { check: 'order', texts: ['WiFi connected', 'IP: 192.168.1.42'], fail: 'Η σειρά ήταν: {v}. Η IP τυπώνεται μετά τη σύνδεση.' }
        ] },
        { name: 'Ο κωδικός δεν τυπώνεται και δεν είναι γραμμένος στον κώδικα', world: { router: true }, script: [
          { setup: true }, { loops: 2 },
          { check: 'serialNot', text: 'lab-pass-123', fail: 'Ο κωδικός του WiFi εμφανίστηκε στο Serial Monitor. Μην τυπώνεις ποτέ το WIFI_PASSWORD.' },
          { check: 'sourceNot', text: 'lab-pass-123', fail: 'Ο κωδικός είναι γραμμένος μέσα στον κώδικα. Χρησιμοποίησε τη σταθερά WIFI_PASSWORD από το αρχείο ρυθμίσεων.' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα μπήκε στο τοπικό δίκτυο και πήρε διεύθυνση IP. Ο κωδικός έμεινε στο αρχείο ρυθμίσεων και δεν εμφανίστηκε πουθενά.',
      remediation: 'Αν βλέπεις «IP: 0.0.0.0», η διεύθυνση τυπώθηκε πριν ολοκληρωθεί η σύνδεση. Βάλε τη γραμμή μετά τον while.'
    },

    // ------------------------------------------------------------ c6-l2
    {
      id: 'c6-l2', chapter: 6, kind: 'guided', skills: ['network', 'timing'],
      title: 'Timeout: όχι αναμονή για πάντα',
      prerequisites: ['c6-l1'],
      objectives: ['Να βάζω όριο χρόνου (timeout) σε μια σύνδεση.', 'Να δίνω σαφές μήνυμα αποτυχίας.', 'Να κρατώ την υπόλοιπη λογική ζωντανή χωρίς WiFi.'],
      theory: `
<p>Στο προηγούμενο μάθημα ο <code>while</code> περίμενε <strong>μέχρι</strong> να συνδεθεί η πλακέτα. Τι γίνεται αν ο router είναι σβηστός; Περιμένει <strong>για πάντα</strong>. Το κουμπί δεν δουλεύει ποτέ.</p>
<p>Η λύση είναι ένα <strong>timeout</strong>: «προσπάθησε το πολύ 10 δευτερόλεπτα».</p>
<pre>unsigned long start = millis();
while (WiFi.status() != WL_CONNECTED &amp;&amp; millis() - start &lt; WIFI_TIMEOUT) {
  delay(100);
}</pre>
<p>Ο while σταματά όταν <strong>είτε</strong> συνδεθεί <strong>είτε</strong> περάσουν 10 δευτερόλεπτα.</p>
<p>Η σύνδεση είναι μέσα στη συνάρτηση <code>connectWiFi()</code>, που <strong>επιστρέφει</strong> <code>true</code> ή <code>false</code>. Έτσι το setup() ξέρει τι να τυπώσει: «WiFi connected» ή «WiFi failed».</p>`,
      glossary: ['timeout', 'millis', 'return', 'WiFi.status'],
      supportedSyntax: SYNTAX_CH6,
      initialCode: `const unsigned long WIFI_TIMEOUT = 10000;   // 10 δευτερόλεπτα το πολύ

// Προσπαθεί να συνδεθεί. Επιστρέφει true αν τα κατάφερε.
bool connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < ____) {   // ΣΥΜΠΛΗΡΩΣΕ
    delay(100);
  }
  return WiFi.status() == WL_CONNECTED;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);

  if (connectWiFi()) {
    Serial.println("WiFi connected");
    Serial.println("IP: " + WiFi.localIP());
  } else {
    Serial.println(____);   // ΣΥΜΠΛΗΡΩΣΕ: σαφές μήνυμα αποτυχίας "WiFi failed"
  }
}

void loop() {
  // Το κουμπί δουλεύει, με ή χωρίς WiFi
  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));
  delay(10);
}
`,
      solution: `const unsigned long WIFI_TIMEOUT = 10000;   // 10 δευτερόλεπτα το πολύ

// Προσπαθεί να συνδεθεί. Επιστρέφει true αν τα κατάφερε.
bool connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT) {
    delay(100);
  }
  return WiFi.status() == WL_CONNECTED;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);

  if (connectWiFi()) {
    Serial.println("WiFi connected");
    Serial.println("IP: " + WiFi.localIP());
  } else {
    Serial.println("WiFi failed");
  }
}

void loop() {
  // Το κουμπί δουλεύει, με ή χωρίς WiFi
  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));
  delay(10);
}
`,
      initialWorld: { router: true, button: false }, world: { router: true, button: false },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τα δύο κενά: το όριο χρόνου και το μήνυμα αποτυχίας.',
        'Σβήσε τον router στην πλακέτα και τρέξε. Μετά από 10 δευτερόλεπτα πρέπει να δεις «WiFi failed» και το κουμπί να δουλεύει.',
        'Άναψε τον router, τρέξε ξανά και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο router είναι σβηστός. Με τον while του προηγούμενου μαθήματος (χωρίς timeout), τι θα γίνει;',
        options: ['Το πρόγραμμα κολλάει στο setup() και το loop() δεν ξεκινά ποτέ', 'Τυπώνει «WiFi failed» και συνεχίζει', 'Η πλακέτα συνδέεται σε άλλο δίκτυο'],
        answer: 0,
        explain: 'Σωστά. Η συνθήκη WiFi.status() != WL_CONNECTED μένει πάντα true. Ο while δεν τελειώνει, και ούτε το κουμπί ούτε τίποτα άλλο δουλεύει.',
        retry: 'Όχι ακόμα. Πότε γίνεται false η συνθήκη του while αν ο router δεν ανάψει ποτέ;'
      },
      hints: [
        'Ο while πρέπει να σταματά και όταν περάσει ο μέγιστος χρόνος. Το μήνυμα πρέπει να λέει καθαρά τι απέτυχε.',
        'Πρώτο κενό: η σταθερά με τα 10000 ms, που δηλώνεται στην πρώτη γραμμή. Δεύτερο κενό: κείμενο σε εισαγωγικά.',
        'while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT) {\n…\nSerial.println("WiFi failed");'
      ],
      validationTests: [
        { name: 'Router αναμμένος → «WiFi connected» και IP', world: { router: true }, script: [
          { setup: true },
          { check: 'wifiConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε, ενώ ο router είναι αναμμένος.' },
          { check: 'count', text: 'IP: 192.168.1.42', is: 1, fail: 'Το «IP: 192.168.1.42» τυπώθηκε {n} φορές. Περίμενα 1.' },
          { check: 'serialNot', text: 'WiFi failed', fail: 'Τυπώθηκε «WiFi failed» ενώ η σύνδεση πέτυχε.' }
        ] },
        { name: 'Router σβηστός → «WiFi failed» μετά το timeout, χωρίς IP', world: { router: false, button: false }, script: [
          { setup: true },
          { check: 'count', text: 'WiFi failed', is: 1, fail: 'Το «WiFi failed» τυπώθηκε {n} φορές. Περίμενα 1.', failZero: 'Με σβηστό router δεν τυπώθηκε «WiFi failed». Ο χρήστης πρέπει να ξέρει τι απέτυχε.' },
          { check: 'serialNot', text: 'IP: ', fail: 'Τυπώθηκε διεύθυνση IP, ενώ δεν υπάρχει σύνδεση.' },
          { check: 'wifiAttempts', max: 1, fail: 'Έγιναν {n} προσπάθειες σύνδεσης στο setup(). Εδώ αρκεί μία, με timeout.' }
        ] },
        { name: 'Router σβηστός → το κουμπί δουλεύει κανονικά', world: { router: false, button: false }, script: [{ setup: true }].concat(BUTTON_STILL_WORKS) }
      ],
      explanationOnSuccess: 'Η συσκευή σου δεν «παγώνει» πια όταν λείπει το δίκτυο. Περιμένει λογικό χρόνο, λέει καθαρά τι απέτυχε και συνεχίζει να κάνει τη δουλειά της τοπικά.',
      remediation: 'Αν βλέπεις μήνυμα ότι ξεπεράστηκαν τα βήματα, ο while δεν τελειώνει ποτέ: έλεγξε τη συνθήκη με το millis() - start.'
    },

    // ------------------------------------------------------------ c6-l3
    {
      id: 'c6-l3', chapter: 6, kind: 'variant', skills: ['network', 'timing', 'state'],
      title: 'Απώλεια σύνδεσης και επανασύνδεση',
      prerequisites: ['c6-l2'],
      objectives: ['Να εντοπίζω πότε χάνεται και πότε επιστρέφει το WiFi.', 'Να ξαναδοκιμάζω σύνδεση με μέτρο, χωρίς να μπλοκάρω το loop().'],
      theory: `
<p>Ένα δίκτυο μπορεί να «πέσει» ενώ η συσκευή δουλεύει: ο router κάνει επανεκκίνηση, κόβεται το ρεύμα.</p>
<p>Σε αυτή την πλακέτα, το WiFi <strong>δεν</strong> ξανασυνδέεται μόνο του. Πρέπει να το ζητήσεις: <code>WiFi.reconnect();</code></p>
<p>Πόσο συχνά; Όχι σε κάθε επανάληψη: αυτό θα «βομβάρδιζε» τον router. Εδώ: <strong>μία προσπάθεια κάθε 5 δευτερόλεπτα</strong>, με το μοτίβο του millis() από το Κεφάλαιο 4.</p>
<p>Η συνάρτηση <code>checkWiFi()</code> κρατά στη μνήμη <code>wasConnected</code> αν ήταν συνδεδεμένη πριν. Έτσι τυπώνει «WiFi lost» και «WiFi back» μία φορά, τη στιγμή της αλλαγής.</p>
<p>Το κουμπί και το LED συνεχίζουν να δουλεύουν σε όλη τη διάρκεια.</p>`,
      glossary: ['επανασύνδεση', 'κατάσταση (state)', 'μη μπλοκαριστικός χρονισμός'],
      supportedSyntax: SYNTAX_CH6,
      initialCode: `const unsigned long WIFI_TIMEOUT = 10000;
const unsigned long RETRY_EVERY = 5000;   // μία προσπάθεια κάθε 5 δευτερόλεπτα
bool wasConnected = false;
unsigned long lastAttempt = 0;

${CONNECT_FN}

void checkWiFi() {
  bool online = WiFi.status() == WL_CONNECTED;
  if (wasConnected && !online) {
    Serial.println("WiFi lost");
  }
  if (!wasConnected && online) {
    Serial.println("WiFi back");
  }
  wasConnected = online;

  // ΣΥΜΠΛΗΡΩΣΕ: αν δεν υπάρχει σύνδεση και πέρασαν RETRY_EVERY ms από την τελευταία προσπάθεια,
  // κάλεσε WiFi.reconnect() και σημείωσε την ώρα στο lastAttempt.

}

${SETUP_BLOCK}

void loop() {
  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));
  checkWiFi();
  delay(10);
}
`,
      solution: `const unsigned long WIFI_TIMEOUT = 10000;
const unsigned long RETRY_EVERY = 5000;   // μία προσπάθεια κάθε 5 δευτερόλεπτα
bool wasConnected = false;
unsigned long lastAttempt = 0;

${CONNECT_FN}

void checkWiFi() {
  bool online = WiFi.status() == WL_CONNECTED;
  if (wasConnected && !online) {
    Serial.println("WiFi lost");
  }
  if (!wasConnected && online) {
    Serial.println("WiFi back");
  }
  wasConnected = online;

  if (!online && millis() - lastAttempt >= RETRY_EVERY) {
    Serial.println("Reconnecting...");
    WiFi.reconnect();
    lastAttempt = millis();
  }
}

${SETUP_BLOCK}

void loop() {
  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));
  checkWiFi();
  delay(10);
}
`,
      initialWorld: { router: true, button: false }, world: { router: true, button: false },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε τον αρχικό κώδικα. Σβήσε τον router για λίγο και ξανάναψέ τον. Επιστρέφει η σύνδεση;',
        'Συμπλήρωσε την checkWiFi(): μία κλήση WiFi.reconnect() το πολύ κάθε 5 δευτερόλεπτα, όσο δεν υπάρχει σύνδεση.',
        'Δοκίμασε ξανά τον router και το κουμπί. Μετά πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο router έσβησε και ξανάναψε. Με τον αρχικό κώδικα, θα ξανασυνδεθεί η πλακέτα;',
        options: ['Όχι, γιατί κανείς δεν καλεί WiFi.reconnect()', 'Ναι, αυτόματα', 'Ναι, αλλά μόνο αν πατηθεί το κουμπί'],
        answer: 0,
        explain: 'Σωστά. Η πλακέτα καταλαβαίνει ότι χάθηκε η σύνδεση («WiFi lost»), αλλά δεν ξαναπροσπαθεί. Αυτό το κάνει μόνο το WiFi.reconnect().',
        retry: 'Όχι ακόμα. Ξαναδιάβασε τη θεωρία: ξανασυνδέεται μόνο του το WiFi σε αυτή την πλακέτα;'
      },
      hints: [
        'Είναι το ίδιο μοτίβο με το «tick» του Κεφαλαίου 4, με μια επιπλέον συνθήκη: να μην υπάρχει σύνδεση.',
        'Χρειάζεσαι ένα if με δύο συνθήκες ενωμένες με &&: !online και millis() - lastAttempt >= RETRY_EVERY. Μέσα: WiFi.reconnect(); και lastAttempt = millis();',
        'if (!online && millis() - lastAttempt >= RETRY_EVERY) {\n  Serial.println("Reconnecting...");\n  WiFi.reconnect();\n  lastAttempt = millis();\n}\nΤο μήνυμα «Reconnecting...» είναι προαιρετικό, αλλά βοηθά να βλέπεις τι γίνεται.'
      ],
      validationTests: [
        { name: 'Όταν πέφτει ο router: ένα «WiFi lost» και το κουμπί δουλεύει', world: { router: true, button: false }, script: [
          { setup: true }, { ms: 500 }, { router: false }, { ms: 1000 },
          { check: 'count', text: 'WiFi lost', is: 1, fail: 'Το «WiFi lost» τυπώθηκε {n} φορές. Περίμενα 1, τη στιγμή της απώλειας.' }
        ].concat(BUTTON_STILL_WORKS) },
        { name: 'Ο router επιστρέφει → η πλακέτα ξανασυνδέεται', world: { router: true }, script: [
          { setup: true }, { ms: 500 }, { router: false }, { ms: 2000 }, { router: true }
        ].concat(wait(8), [
          { check: 'wifiConnected', is: true, fail: 'Ο router ξανάναψε πριν από 8 δευτερόλεπτα, αλλά η πλακέτα δεν συνδέθηκε. Καλείς WiFi.reconnect() όσο δεν υπάρχει σύνδεση;' },
          { check: 'count', text: 'WiFi back', is: 1, fail: 'Το «WiFi back» τυπώθηκε {n} φορές. Περίμενα 1.' }
        ]) },
        { name: 'Μεγάλη διακοπή (30 s) → προσπάθειες με μέτρο, όχι σε κάθε επανάληψη', world: { router: true }, script: [
          { setup: true }, { router: false }
        ].concat(wait(30), [
          { check: 'wifiAttempts', min: 3, max: 8, fail: 'Σε 30 δευτερόλεπτα χωρίς router έγιναν {n} προσπάθειες σύνδεσης (μαζί με την πρώτη). Περίμενα περίπου μία κάθε 5 δευτερόλεπτα (3 έως 8). Πάρα πολλές «βομβαρδίζουν» το δίκτυο. Πολύ λίγες σημαίνουν ότι δεν ξαναδοκιμάζεις.' }
        ]) }
      ],
      explanationOnSuccess: 'Η συσκευή σου τώρα επιβιώνει από μια διακοπή δικτύου: το καταλαβαίνει, ξαναδοκιμάζει ήρεμα κάθε 5 δευτερόλεπτα και επιστρέφει μόνη της. Το κουμπί δεν σταμάτησε ούτε στιγμή.',
      remediation: 'Αν οι προσπάθειες είναι χιλιάδες, ξέχασες το lastAttempt = millis(); ή τη σύγκριση με το RETRY_EVERY.'
    },

    // ------------------------------------------------------------ c6-l4
    {
      id: 'c6-l4', chapter: 6, kind: 'checkpoint', skills: ['network', 'timing', 'state'],
      title: 'Έλεγχος κεφαλαίου: περιορισμένες προσπάθειες',
      prerequisites: ['c6-l3'],
      objectives: ['Να βάζω ανώτατο όριο στις προσπάθειες επανασύνδεσης.', 'Να αντικαθιστώ μπλοκαριστικό βρόχο με λογική που δεν σταματά το κουμπί.'],
      theory: `
<p>Αυτός ο κώδικας ξαναδοκιμάζει το WiFi μέσα σε έναν <code>while</code>. Όσο λείπει ο router:</p>
<ul>
  <li>το <code>loop()</code> δεν τελειώνει ποτέ,</li>
  <li>το κουμπί σταματά να δουλεύει,</li>
  <li>οι προσπάθειες δεν σταματούν ποτέ.</li>
</ul>
<p>Ξαναγράψε την <code>checkWiFi()</code> ώστε:</p>
<ol>
  <li>να μην έχει <code>while</code> ούτε μεγάλο <code>delay</code>,</li>
  <li>να κάνει <strong>το πολύ 3</strong> προσπάθειες <code>WiFi.reconnect()</code>, μία κάθε 5 δευτερόλεπτα,</li>
  <li>αν αποτύχουν όλες, να τυπώνει <strong>μία φορά</strong> «WiFi failed» και να σταματά να προσπαθεί,</li>
  <li>αν η σύνδεση επιστρέψει, να τυπώνει «WiFi back» και να μηδενίζει τον μετρητή.</li>
</ol>
<p>Σε πραγματική συσκευή, μετά το «WiFi failed» ίσως ξαναδοκίμαζες πολύ αργότερα. Εδώ σταματάμε, για να είναι καθαρό.</p>`,
      glossary: ['επανασύνδεση', 'timeout', 'μπλοκάρισμα', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX_CH6,
      initialCode: `const unsigned long WIFI_TIMEOUT = 10000;
const unsigned long RETRY_EVERY = 5000;
const int MAX_RETRIES = 3;
bool wasConnected = false;
unsigned long lastAttempt = 0;
int retries = 0;
bool gaveUp = false;

${CONNECT_FN}

void checkWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost");
    while (WiFi.status() != WL_CONNECTED) {   // ξαναδοκιμάζει για πάντα...
      WiFi.reconnect();
      delay(5000);                            // ...και μπλοκάρει το κουμπί
    }
    Serial.println("WiFi back");
  }
}

${SETUP_BLOCK}

void loop() {
  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));
  checkWiFi();
  delay(10);
}
`,
      solution: `const unsigned long WIFI_TIMEOUT = 10000;
const unsigned long RETRY_EVERY = 5000;
const int MAX_RETRIES = 3;
bool wasConnected = false;
unsigned long lastAttempt = 0;
int retries = 0;
bool gaveUp = false;

${CONNECT_FN}

void checkWiFi() {
  bool online = WiFi.status() == WL_CONNECTED;
  if (wasConnected && !online) {
    Serial.println("WiFi lost");
  }
  if (!wasConnected && online) {
    Serial.println("WiFi back");
    retries = 0;
    gaveUp = false;
  }
  wasConnected = online;

  if (!online && !gaveUp && millis() - lastAttempt >= RETRY_EVERY) {
    if (retries < MAX_RETRIES) {
      retries++;
      Serial.println("Retry " + retries);
      WiFi.reconnect();
      lastAttempt = millis();
    } else {
      gaveUp = true;
      Serial.println("WiFi failed");
    }
  }
}

${SETUP_BLOCK}

void loop() {
  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));
  checkWiFi();
  delay(10);
}
`,
      initialWorld: { router: true, button: false }, world: { router: true, button: false },
      hardware: HW, panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα και σβήσε τον router. Δοκίμασε το κουμπί. Τι παρατηρείς;',
        'Ξαναγράψε την checkWiFi() χωρίς while, με millis(), retries και gaveUp.',
        'Δοκίμασε δύο σενάρια: σύντομη διακοπή (ο router ξανανάβει γρήγορα) και μεγάλη διακοπή (μένει σβηστός).',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί βάζουμε ανώτατο όριο στις προσπάθειες επανασύνδεσης;',
        options: ['Για να μη φορτώνουμε το δίκτυο και την μπαταρία άσκοπα, και για να ενημερώσουμε καθαρά ότι κάτι δεν πάει καλά', 'Γιατί το WiFi.reconnect() δουλεύει μόνο 3 φορές', 'Για να συνδεθεί πιο γρήγορα'],
        answer: 0,
        explain: 'Σωστά. Ατελείωτες προσπάθειες σπαταλούν ενέργεια και «θορυβούν» στο δίκτυο. Ένα σαφές «WiFi failed» βοηθά τον άνθρωπο να δει ότι κάτι χρειάζεται έλεγχο.',
        retry: 'Όχι ακόμα. Σκέψου τι κοστίζει μια προσπάθεια σύνδεσης κάθε λίγα δευτερόλεπτα, για ώρες.'
      },
      hints: [
        'Ξεκίνα από τη λύση του προηγούμενου μαθήματος. Πρόσθεσε έναν μετρητή retries και μια σημαία gaveUp.',
        'Μέσα στο if που ξαναδοκιμάζει: αν retries < MAX_RETRIES, κάνε reconnect και retries++. Αλλιώς, gaveUp = true; και τύπωσε «WiFi failed». Όταν η σύνδεση επιστρέψει, μηδένισε το retries.',
        'if (!online && !gaveUp && millis() - lastAttempt >= RETRY_EVERY) {\n  if (retries < MAX_RETRIES) {\n    retries++;\n    WiFi.reconnect();\n    lastAttempt = millis();\n  } else {\n    gaveUp = true;\n    Serial.println("WiFi failed");\n  }\n}'
      ],
      validationTests: [
        { name: 'Μεγάλη διακοπή (30 s): το πολύ 3 επανασυνδέσεις, ένα «WiFi failed», κουμπί ζωντανό', world: { router: true, button: false }, script: [
          { setup: true }, { router: false }
        ].concat(wait(30), [
          { check: 'wifiAttempts', min: 2, max: 4, fail: 'Έγιναν {n} προσπάθειες σύνδεσης συνολικά (1 στο setup() + επανασυνδέσεις). Περίμενα το πολύ 4: μία αρχική και 3 επανασυνδέσεις.' },
          { check: 'count', text: 'WiFi failed', is: 1, fail: 'Το «WiFi failed» τυπώθηκε {n} φορές. Περίμενα ακριβώς 1, όταν τελειώσουν οι προσπάθειες.', failZero: 'Μετά από 30 δευτερόλεπτα χωρίς router δεν τυπώθηκε «WiFi failed». Ο χρήστης πρέπει να ξέρει ότι η συσκευή σταμάτησε να προσπαθεί.' }
        ], BUTTON_STILL_WORKS) },
        { name: 'Σύντομη διακοπή: η σύνδεση επιστρέφει χωρίς «WiFi failed»', world: { router: true }, script: [
          { setup: true }, { router: false }, { ms: 3000 }, { router: true }
        ].concat(wait(10), [
          { check: 'wifiConnected', is: true, fail: 'Ο router ξανάναψε, αλλά η πλακέτα δεν συνδέθηκε σε 10 δευτερόλεπτα.' },
          { check: 'count', text: 'WiFi back', is: 1, fail: 'Το «WiFi back» τυπώθηκε {n} φορές. Περίμενα 1.' },
          { check: 'serialNot', text: 'WiFi failed', fail: 'Τυπώθηκε «WiFi failed» σε μια σύντομη διακοπή που λύθηκε.' }
        ]) },
        { name: 'Δεύτερη διακοπή μετά την επιστροφή: ο μετρητής ξεκινά από την αρχή', world: { router: true }, script: [
          { setup: true }, { router: false }, { ms: 3000 }, { router: true }
        ].concat(wait(10), [{ router: false }], wait(6), [{ router: true }], wait(10), [
          { check: 'wifiConnected', is: true, fail: 'Μετά τη δεύτερη διακοπή η πλακέτα δεν ξανασυνδέθηκε. Μηδενίζεις το retries όταν επιστρέφει η σύνδεση;' },
          { check: 'count', text: 'WiFi back', is: 2, fail: 'Το «WiFi back» τυπώθηκε {n} φορές σε δύο διακοπές. Περίμενα 2.' }
        ]) }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το Κεφάλαιο 6. Η συσκευή σου συνδέεται με timeout, δείχνει την IP της, καταλαβαίνει την απώλεια, ξαναδοκιμάζει με μέτρο και ξέρει πότε να σταματήσει. Και σε όλη τη διάρκεια, το κουμπί δούλευε.',
      remediation: 'Αν βλέπεις μήνυμα ότι ξεπεράστηκαν τα βήματα, υπάρχει ακόμα while που περιμένει τη σύνδεση. Αν το «WiFi failed» τυπώνεται πολλές φορές, έλεγξε ότι το gaveUp γίνεται true και ότι το if το ελέγχει.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
