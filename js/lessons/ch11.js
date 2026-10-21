/*
 * IoT Guardian — Κεφάλαιο 11: TLS και πιστοποιητικά.
 * Το TLS εδώ είναι ΜΟΝΤΕΛΟ: δεν γίνεται πραγματική κρυπτογράφηση. Τα προβλήματα
 * πιστοποιητικών (ληγμένο, λάθος όνομα, άγνωστη CA) είναι μεταδεδομένα του προσομοιωτή.
 * Εικονική σημερινή ημερομηνία: 2026-10-15.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 11).ready = true;

  const addTerm = (term, def) => { if (!L.GLOSSARY.some(g => g.term === term)) L.GLOSSARY.push({ term, def }); };
  addTerm('TLS', 'Transport Layer Security: πρωτόκολλο που κρυπτογραφεί τη σύνδεση και επιτρέπει στον client να ελέγξει ότι μιλά με τον σωστό server. Στον προσομοιωτή είναι μοντέλο, όχι πραγματική κρυπτογράφηση.');
  addTerm('πιστοποιητικό (certificate)', 'Ψηφιακή «ταυτότητα» του server: γράφει για ποιο όνομα ισχύει, ποιος το υπέγραψε (CA) και μέχρι πότε ισχύει.');
  addTerm('CA (Certificate Authority)', 'Ο οργανισμός (ή στο σπίτι, το δικό σου εργαλείο) που υπογράφει πιστοποιητικά. Ο client εμπιστεύεται μόνο πιστοποιητικά που υπογράφει μια CA που ήδη γνωρίζει.');
  addTerm('αλυσίδα εμπιστοσύνης', 'Ο client εμπιστεύεται την CA → η CA υπογράφει το πιστοποιητικό του broker → άρα ο client εμπιστεύεται τον broker. Αν σπάσει ένας κρίκος, η σύνδεση απορρίπτεται.');
  addTerm('hostname', 'Το όνομα του server στο δίκτυο, π.χ. broker.home.lan. Πρέπει να ταιριάζει με το όνομα που γράφει το πιστοποιητικό.');
  addTerm('μεταδεδομένα (metadata)', 'Πληροφορίες γύρω από τα δεδομένα: ποιος μιλά με ποιον, πότε, σε ποια θύρα, πόσα bytes. Το TLS κρύβει το περιεχόμενο, όχι τα μεταδεδομένα.');
  addTerm('setInsecure', 'Εντολή που ενεργοποιεί TLS χωρίς έλεγχο πιστοποιητικού. Ο client δέχεται οποιονδήποτε server. Δεν είναι λύση· είναι παράκαμψη του ελέγχου.');

  const SYNTAX_C11 = 'mqtt.setServer(MQTT_HOST, 8883), mqtt.setCACert(HOME_CA), mqtt.setInsecure(), mqtt.connect(id, user, pass), mqtt.connected(), mqtt.publish, if / else, Serial.println';

  const BROKER_TLS = 'listener 8883\ntls on\nallow_anonymous false\npassword esp32-pir Pir-Lab-Key-0427\npassword dashboard Dash-Lab-Key-0815\n';
  const DASH_TLS = { name: 'dashboard', subs: ['home/#'], user: 'dashboard', pass: 'Dash-Lab-Key-0815', port: 8883, tls: true };
  const CONSTS = { MQTT_USER: 'esp32-pir', MQTT_PASS: 'Pir-Lab-Key-0427' };
  const worldWith = cert => ({ wifi: 'connected', broker: BROKER_TLS, cert, clients: [DASH_TLS], consts: CONSTS });
  const HW = ['broker'];
  const PANELS = ['serial', 'mqtt', 'net', 'logs'];

  // Κοινοί έλεγχοι για σενάρια με προβληματικό πιστοποιητικό.
  const rejectChecks = [
    { check: 'mqttAttempts', min: 1, fail: 'Η πλακέτα δεν δοκίμασε καθόλου να συνδεθεί ({n} προσπάθειες). Κράτα το mqtt.connect(…).' },
    { check: 'tlsMode', is: 'verify', fail: 'Ο τρόπος TLS είναι «{v}». Ο client πρέπει να ελέγχει το πιστοποιητικό με mqtt.setCACert(HOME_CA), χωρίς setInsecure().' },
    { check: 'deviceEncrypted', fail: 'Η πλακέτα έστειλε {n} πακέτα MQTT χωρίς TLS ή δεν ξεκίνησε TLS. Χρησιμοποίησε θύρα 8883 και mqtt.setCACert(HOME_CA).', failZero: 'Η πλακέτα δεν ξεκίνησε καθόλου TLS. Έλεγξε ότι η θύρα είναι 8883 και ότι υπάρχει mqtt.setCACert(HOME_CA).' },
    { check: 'mqttConnected', is: false, fail: 'Η πλακέτα συνδέθηκε, παρόλο που το πιστοποιητικό έχει πρόβλημα. Αυτό σημαίνει ότι ο έλεγχος παρακάμφθηκε.' }
  ];

  L.lessons.push(
    // ------------------------------------------------------------ c11-l1
    {
      id: 'c11-l1', chapter: 11, kind: 'guided', skills: ['security', 'mqtt', 'network'],
      title: 'TLS με έλεγχο πιστοποιητικού',
      prerequisites: [],
      objectives: [
        'Να συνδέω την πλακέτα στη θύρα TLS του broker.',
        'Να ενεργοποιώ τον έλεγχο του πιστοποιητικού με μια έμπιστη CA.',
        'Να εξηγώ τι ελέγχει ο client: CA, hostname, ημερομηνία.'
      ],
      theory: `
<p>Στο Κεφάλαιο 10 ο κωδικός ταξίδευε <strong>χωρίς κρυπτογράφηση</strong>. Το <strong>TLS</strong> προστατεύει τη μεταφορά.</p>
<p>Το TLS κάνει δύο δουλειές:</p>
<ol>
  <li><strong>Κρυπτογραφεί</strong> τη σύνδεση: topic, payload και κωδικοί δεν διαβάζονται στο δίκτυο.</li>
  <li>Επιτρέπει στον client να <strong>ελέγξει</strong> ότι μιλά με τον σωστό broker, μέσα από το <strong>πιστοποιητικό</strong> του.</li>
</ol>
<p>Ο client ελέγχει τρία πράγματα στο πιστοποιητικό:</p>
<ul>
  <li><strong>CA</strong>: το υπέγραψε μια αρχή που εμπιστεύομαι; (εδώ: <code>HOME_CA</code> = «Home Lab CA»)</li>
  <li><strong>Hostname</strong>: είναι για το όνομα στο οποίο συνδέομαι; (εδώ: <code>broker.home.lan</code>)</li>
  <li><strong>Ημερομηνία</strong>: ισχύει σήμερα; (εικονική ημερομηνία: 15/10/2026)</li>
</ul>
<p>Στον κώδικα: <code>mqtt.setServer(MQTT_HOST, 8883);</code> και <code>mqtt.setCACert(HOME_CA);</code>. Στον broker: <code>listener 8883</code> και από κάτω <code>tls on</code>.</p>
<p><strong>Ειλικρινά:</strong> στον προσομοιωτή το TLS είναι μοντέλο. Δεν γίνεται πραγματική κρυπτογράφηση· δείχνουμε μόνο τι θα έβλεπε κάποιος στο δίκτυο.</p>`,
      glossary: ['TLS', 'πιστοποιητικό (certificate)', 'CA (Certificate Authority)', 'hostname'],
      supportedSyntax: SYNTAX_C11,
      initialCode: `void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, ____);   // η θύρα του TLS listener
  mqtt.setCACert(____);              // η CA που εμπιστευόμαστε

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
    mqtt.publish("home/status", "online");
  } else {
    Serial.println("Certificate rejected");
  }
}

void loop() {
  delay(1000);
}
`,
      solution: `void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 8883);   // η θύρα του TLS listener
  mqtt.setCACert(HOME_CA);           // η CA που εμπιστευόμαστε

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
    mqtt.publish("home/status", "online");
  } else {
    Serial.println("Certificate rejected");
  }
}

void loop() {
  delay(1000);
}
`,
      initialWorld: worldWith('valid'),
      world: worldWith('valid'),
      hardware: HW,
      panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Στο πρώτο κενό γράψε τη θύρα του TLS listener.',
        'Στο δεύτερο κενό γράψε τη σταθερά της έμπιστης CA.',
        'Τρέξε. Στον Network Monitor δες τα πακέτα Client Hello, Server Hello + Certificate και Application Data.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο broker στέλνει πιστοποιητικό για «broker.home.lan», υπογεγραμμένο από «Home Lab CA», που λήγει 30/06/2027. Η πλακέτα συνδέεται στο broker.home.lan και εμπιστεύεται τη Home Lab CA. Τι θα γίνει;',
        options: ['Η σύνδεση γίνεται δεκτή: CA, όνομα και ημερομηνία ταιριάζουν', 'Απορρίπτεται, γιατί το πιστοποιητικό λήγει κάποτε', 'Απορρίπτεται, γιατί η CA είναι του σπιτιού'],
        answer: 0,
        explain: 'Σωστά. Και οι τρεις έλεγχοι περνούν: έμπιστη CA, σωστό hostname, ισχύει σήμερα (15/10/2026). Μια δική σου CA για το σπίτι είναι απολύτως εντάξει, αρκεί ο client να την εμπιστεύεται.',
        retry: 'Όχι ακόμα. Έλεγξε ένα-ένα: ποιος υπέγραψε, για ποιο όνομα, μέχρι πότε ισχύει.'
      },
      hints: [
        'Η θύρα που χρησιμοποιείται συνήθως για MQTT με TLS είναι η 8883. Η CA του σπιτιού υπάρχει ως έτοιμη σταθερά.',
        'Κοίτα τις γραμμές 3 και 4. Το setServer θέλει αριθμό θύρας και το setCACert θέλει το όνομα της σταθεράς για τη CA.',
        'Γράψε:\nmqtt.setServer(MQTT_HOST, 8883);\nmqtt.setCACert(HOME_CA);\nΤο 8883 είναι η θύρα όπου ο broker έχει tls on. Το HOME_CA λέει στον client ποια CA να εμπιστεύεται.'
      ],
      validationTests: [
        { name: 'Ο client ελέγχει το πιστοποιητικό', script: [
          { setup: true },
          { check: 'tlsMode', is: 'verify', fail: 'Ο τρόπος TLS είναι «{v}». Χρειάζεται mqtt.setCACert(HOME_CA) πριν από το connect.' }
        ] },
        { name: 'Η σύνδεση με έγκυρο πιστοποιητικό γίνεται δεκτή', script: [
          { setup: true },
          { check: 'mqttConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε στον broker. {v} Έλεγξε τη θύρα 8883, το mqtt.setCACert(HOME_CA) και το mqtt.connect(…).' },
          { check: 'serialHas', text: 'MQTT connected', fail: 'Δεν τυπώθηκε «MQTT connected». Τελευταίες γραμμές: {v}.' }
        ] },
        { name: 'Όλη η κίνηση MQTT της πλακέτας περνά μέσα από TLS', script: [
          { setup: true }, { loops: 2 },
          { check: 'deviceEncrypted', fail: 'Βρέθηκαν {n} πακέτα MQTT σε καθαρό κείμενο από την πλακέτα.', failZero: 'Δεν βρέθηκε κανένα πακέτο TLS από την πλακέτα. Έλεγξε θύρα και CA.' }
        ] },
        { name: 'Το dashboard βλέπει το «online»', script: [
          { setup: true }, { loops: 1 },
          { check: 'published', topic: 'home/status', min: 1, fail: 'Η πλακέτα δεν δημοσίευσε στο home/status. Τελευταία μηνύματα: {v}.' },
          { check: 'dashboard', topic: 'home/status', payload: 'online', fail: 'Το dashboard είδε στο home/status: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα μιλά τώρα TLS με τον broker και ελέγχει το πιστοποιητικό του. Στον Network Monitor τα μηνύματα φαίνονται ως «Application Data»: το περιεχόμενο είναι κρυμμένο (στο μοντέλο). Ο κωδικός δεν ταξιδεύει πια καθαρός.',
      remediation: 'Αν η σύνδεση αποτυγχάνει, διάβασε την προειδοποίηση: λέει αν φταίει η θύρα ή το πιστοποιητικό.'
    },

    // ------------------------------------------------------------ c11-l2
    {
      id: 'c11-l2', chapter: 11, kind: 'micro', mode: 'analysis', skills: ['analysis', 'security'],
      title: 'Τι φαίνεται στο δίκτυο: χωρίς TLS και με TLS',
      prerequisites: ['c11-l1'],
      objectives: [
        'Να συγκρίνω μια καταγραφή χωρίς TLS με μια καταγραφή με TLS.',
        'Να ξεχωρίζω το περιεχόμενο από τα μεταδεδομένα.'
      ],
      theory: `
<p>Η καταγραφή είναι <strong>συνθετική</strong>: φτιάχτηκε από τον προσομοιωτή για εκπαίδευση. Ο broker του εργαστηρίου έχει δύο θύρες:</p>
<ul>
  <li><code>1883</code> χωρίς TLS: εδώ συνδέεται ο αισθητήρας θερμοκρασίας (<code>192.168.1.43</code>).</li>
  <li><code>8883</code> με TLS: εδώ συνδέεται ο αισθητήρας κίνησης (<code>192.168.1.42</code>).</li>
</ul>
<p>Χωρίς TLS, μέσα στα πακέτα MQTT φαίνονται <strong>όνομα χρήστη, κωδικός, topic και payload</strong>.</p>
<p>Με TLS, το περιεχόμενο κρύβεται. Μένουν όμως ορατά τα <strong>μεταδεδομένα</strong>: διευθύνσεις IP, θύρες, χρόνος και μέγεθος πακέτων.</p>
<p>Το φίλτρο <code>mqtt</code> δείχνει μόνο πακέτα MQTT σε καθαρό κείμενο. Το φίλτρο <code>tls</code> δείχνει μόνο πακέτα TLS.</p>`,
      glossary: ['TLS', 'μεταδεδομένα (metadata)'],
      supportedSyntax: 'Φίλτρα: mqtt, tls, ip.src == Δ, tcp.port == N, ενωμένα με &&',
      initialWorld: {},
      panels: ['net'],
      capture: {
        broker: 'listener 1883\nlistener 8883\ntls on\nallow_anonymous false\npassword esp32-temp Temp-Lab-Key-0911\npassword esp32-pir Pir-Lab-Key-0427\n',
        cert: 'valid',
        scenario: [
          { connect: 'esp32-temp', user: 'esp32-temp', pass: 'Temp-Lab-Key-0911', port: 1883 },
          { wait: 500 },
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":21.40}' },
          { wait: 1000 },
          { connect: 'esp32-pir', user: 'esp32-pir', pass: 'Pir-Lab-Key-0427', port: 8883, tls: true },
          { wait: 500 },
          { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion":true}' }
        ]
      },
      evidence: { filter: 'mqtt && ip.src == 192.168.1.43' },
      evidenceHint: 'Επίλεξε όλα τα πακέτα όπου ο αισθητήρας θερμοκρασίας στέλνει περιεχόμενο που διαβάζεται καθαρά (στοιχεία σύνδεσης ή μέτρηση).',
      steps: [
        'Γράψε το φίλτρο tls και άνοιξε ένα πακέτο «Application Data». Τι φαίνεται; Τι λείπει;',
        'Γράψε το φίλτρο mqtt. Άνοιξε το πακέτο «Connect Command». Τι φαίνεται;',
        'Επίλεξε τα πακέτα-τεκμήρια: όσα στέλνει ο αισθητήρας θερμοκρασίας με περιεχόμενο σε καθαρό κείμενο.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος».'
      ],
      quiz: {
        question: 'Στα πακέτα TLS του αισθητήρα κίνησης, τι μπορεί ακόμα να δει κάποιος που βλέπει την κίνηση του δικτύου;',
        options: ['Μόνο μεταδεδομένα: IP, θύρες, χρόνο και μέγεθος', 'Το topic και το payload, αλλά όχι τον κωδικό', 'Τίποτα απολύτως, ούτε ότι υπάρχει σύνδεση'],
        answer: 0,
        explain: 'Σωστά. Το TLS κρύβει το περιεχόμενο (κωδικό, topic, payload), όχι το ότι δύο συσκευές μιλούν. Από τα μεταδεδομένα μπορεί ακόμα να φανεί π.χ. πότε υπάρχει δραστηριότητα.',
        retry: 'Όχι ακόμα. Άνοιξε ένα πακέτο «Application Data»: ποια πεδία φαίνονται και ποια λείπουν;'
      },
      hints: [
        'Περιεχόμενο σε καθαρό κείμενο υπάρχει μόνο στα πακέτα MQTT, όχι στα TLS.',
        'Χρησιμοποίησε δύο συνθήκες μαζί: πακέτα MQTT και αποστολέας ο αισθητήρας θερμοκρασίας (192.168.1.43).',
        'Φίλτρο: mqtt && ip.src == 192.168.1.43\nΘα μείνουν δύο πακέτα: το Connect Command (με όνομα και κωδικό) και το Publish Message (με τη μέτρηση). Επίλεξε και τα δύο.'
      ],
      explanationOnSuccess: 'Βρήκες ότι χωρίς TLS ο εκπαιδευτικός κωδικός και η μέτρηση διαβάζονται κατευθείαν από την καταγραφή, ενώ με TLS μένουν μόνο μεταδεδομένα. Γι\' αυτό ο broker του σπιτιού κρατά μόνο τη θύρα 8883 με tls on.',
      remediation: 'Αν ο έλεγχος δεν περνά, μάλλον επέλεξες και πακέτα του broker (CONNACK) ή πακέτα TLS. Κράτα μόνο όσα στέλνει το 192.168.1.43 ως MQTT.'
    },

    // ------------------------------------------------------------ c11-l3
    {
      id: 'c11-l3', chapter: 11, kind: 'debug', skills: ['security', 'mqtt', 'network'],
      title: 'Βρες το λάθος: η θύρα 8883 δεν φτάνει',
      prerequisites: ['c11-l2'],
      objectives: [
        'Να καταλάβω ότι ο αριθμός θύρας μόνος του δεν ενεργοποιεί TLS.',
        'Να διαβάζω το μήνυμα αποτυχίας και την καταγραφή για να βρω την αιτία.'
      ],
      theory: `
<p>Η θύρα <code>8883</code> είναι απλώς μια <strong>σύμβαση</strong>: «εδώ συνήθως μιλάμε MQTT με TLS». Ο αριθμός μόνος του δεν κρυπτογραφεί τίποτα.</p>
<p>Για να γίνει TLS χρειάζονται <strong>και οι δύο πλευρές</strong>:</p>
<ul>
  <li>Ο broker: <code>tls on</code> στη listener.</li>
  <li>Ο client: εντολή που ενεργοποιεί TLS, εδώ <code>mqtt.setCACert(HOME_CA)</code>.</li>
</ul>
<p>Αν ο client μιλήσει MQTT σε καθαρό κείμενο σε μια θύρα TLS, ο broker κλείνει τη σύνδεση.</p>
<p>Και κάτι ακόμα: TLS <strong>χωρίς έλεγχο πιστοποιητικού</strong> δεν είναι ασφαλές TLS. Θα το δεις στα επόμενα μαθήματα.</p>`,
      glossary: ['TLS'],
      supportedSyntax: SYNTAX_C11,
      initialCode: `void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 8883);   // 8883 = ασφαλής θύρα, άρα έχουμε TLS... σωστά;

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
    mqtt.publish("home/status", "online");
  } else {
    Serial.println("MQTT failed");
  }
}

void loop() {
  delay(1000);
}
`,
      solution: `void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 8883);
  mqtt.setCACert(HOME_CA);           // ενεργοποιεί TLS με έλεγχο πιστοποιητικού

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
    mqtt.publish("home/status", "online");
  } else {
    Serial.println("MQTT failed");
  }
}

void loop() {
  delay(1000);
}
`,
      initialWorld: worldWith('valid'),
      world: worldWith('valid'),
      hardware: HW,
      panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Διάβασε την προειδοποίηση και το log του broker.',
        'Στον Network Monitor βρες το πακέτο που έστειλε η πλακέτα. Είναι MQTT ή TLS;',
        'Πρόσθεσε τη γραμμή που λείπει, αμέσως μετά το setServer.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί απέτυχε η σύνδεση στη θύρα 8883;',
        options: ['Ο client μίλησε MQTT χωρίς TLS, ενώ ο broker περίμενε TLS', 'Η θύρα 8883 είναι κλειστή στον broker', 'Ο κωδικός MQTT_PASS είναι λάθος'],
        answer: 0,
        explain: 'Σωστά. Η θύρα ήταν σωστή, αλλά ο client δεν ενεργοποίησε TLS. Ο αριθμός θύρας δεν αλλάζει από μόνος του τον τρόπο που μιλά ο client.',
        retry: 'Όχι ακόμα. Κοίτα το log: «TLS expected on port 8883». Τι έστειλε ο client;'
      },
      hints: [
        'Το TLS χρειάζεται ρύθμιση και στον broker και στον client. Ο broker έχει ήδη tls on.',
        'Στο setup() υπάρχει μόνο το setServer. Λείπει η εντολή που λέει στον client «μίλα TLS και έλεγξε το πιστοποιητικό».',
        'Πρόσθεσε στη γραμμή 4:\nmqtt.setCACert(HOME_CA);\nΈτσι ο client ξεκινά TLS και ελέγχει ότι το πιστοποιητικό το υπέγραψε η Home Lab CA.'
      ],
      validationTests: [
        { name: 'Ο client μιλά TLS με έλεγχο πιστοποιητικού', script: [
          { setup: true },
          { check: 'tlsMode', is: 'verify', fail: 'Ο τρόπος TLS είναι «{v}». Η θύρα 8883 μόνη της δεν ενεργοποιεί TLS. Πρόσθεσε mqtt.setCACert(HOME_CA).' }
        ] },
        { name: 'Η σύνδεση γίνεται δεκτή', script: [
          { setup: true },
          { check: 'mqttConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε στον broker. {v} Έλεγξε τη θύρα 8883, το mqtt.setCACert(HOME_CA) και το mqtt.connect(…).' }
        ] },
        { name: 'Κανένα πακέτο MQTT σε καθαρό κείμενο', script: [
          { setup: true }, { loops: 2 },
          { check: 'deviceEncrypted', fail: 'Η πλακέτα έστειλε {n} πακέτα MQTT σε καθαρό κείμενο.', failZero: 'Η πλακέτα δεν έστειλε κανένα πακέτο TLS.' },
          { check: 'dashboard', topic: 'home/status', payload: 'online', fail: 'Το dashboard είδε στο home/status: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η θύρα 8883 ήταν σωστή, αλλά δεν αρκούσε. Χρειαζόταν και ο client να ενεργοποιήσει TLS με έλεγχο πιστοποιητικού. Όταν ελέγχεις μια συσκευή, μην κοιτάς μόνο τον αριθμό θύρας: κοίτα αν η κίνηση είναι πραγματικά TLS.',
      remediation: 'Αν βλέπεις «Καμία υπηρεσία στη θύρα», έλεγξε ότι η θύρα στο setServer είναι 8883.'
    },

    // ------------------------------------------------------------ c11-l4
    {
      id: 'c11-l4', chapter: 11, kind: 'variant', skills: ['security', 'mqtt', 'conditions'],
      title: 'Ληγμένο πιστοποιητικό: όχι «δοκίμασε χωρίς έλεγχο»',
      prerequisites: ['c11-l3'],
      objectives: [
        'Να αναγνωρίζω ένα ληγμένο πιστοποιητικό από την ημερομηνία ισχύος.',
        'Να αφαιρώ ένα «εναλλακτικό σχέδιο» που παρακάμπτει τον έλεγχο.'
      ],
      theory: `
<p>Κάθε πιστοποιητικό έχει <strong>ημερομηνία λήξης</strong>. Μετά από αυτή, ο client πρέπει να το απορρίπτει.</p>
<p>Σε αυτό το σενάριο, το πιστοποιητικό του broker έληξε στις <strong>31/03/2026</strong>. Η εικονική σημερινή ημερομηνία είναι <strong>15/10/2026</strong>.</p>
<p>Ένα συνηθισμένο λάθος είναι το «εναλλακτικό σχέδιο»: «αν αποτύχει το TLS, ξαναδοκίμασε με <code>setInsecure()</code>». Έτσι ο έλεγχος <strong>υπάρχει μόνο όταν δεν χρειάζεται</strong>.</p>
<p>Η σωστή αντίδραση είναι:</p>
<ul>
  <li>να μη συνδεθείς,</li>
  <li>να γράψεις ένα καθαρό μήνυμα στο log, π.χ. <code>Certificate rejected</code>,</li>
  <li>και να διορθωθεί το πιστοποιητικό στον broker (ανανέωση από τη CA).</li>
</ul>
<p>Στον προσομοιωτή, το «ληγμένο» είναι απλώς μια ημερομηνία στα μεταδεδομένα του εικονικού πιστοποιητικού.</p>`,
      glossary: ['πιστοποιητικό (certificate)', 'setInsecure'],
      supportedSyntax: SYNTAX_C11,
      initialCode: `void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 8883);
  mqtt.setCACert(HOME_CA);

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
  } else {
    // «Εναλλακτικό σχέδιο»: δοκίμασε ξανά χωρίς έλεγχο
    Serial.println("TLS failed, retrying without check");
    mqtt.setInsecure();
    if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
      Serial.println("MQTT connected");
    }
  }
}

void loop() {
  if (mqtt.connected()) {
    mqtt.publish("home/status", "online");
  }
  delay(2000);
}
`,
      solution: `void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 8883);
  mqtt.setCACert(HOME_CA);

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
  } else {
    Serial.println("Certificate rejected");
  }
}

void loop() {
  if (mqtt.connected()) {
    mqtt.publish("home/status", "online");
  }
  delay(2000);
}
`,
      initialWorld: worldWith('expired'),
      world: worldWith('expired'),
      hardware: HW,
      panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Στον Network Monitor άνοιξε το πακέτο «Server Hello, Certificate» και δες την ημερομηνία λήξης.',
        'Βρες το «εναλλακτικό σχέδιο» μέσα στο else.',
        'Αντικατέστησέ το με ένα μόνο μήνυμα: Certificate rejected.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το πιστοποιητικό έληξε στις 31/03/2026 και σήμερα είναι 15/10/2026. Τι πρέπει να κάνει ο client;',
        options: ['Να απορρίψει τη σύνδεση και να το αναφέρει στο log', 'Να συνδεθεί με setInsecure(), για να μη χαθούν μετρήσεις', 'Να συνδεθεί χωρίς TLS στη θύρα 1883'],
        answer: 0,
        explain: 'Σωστά. Ένας client που δέχεται ληγμένο πιστοποιητικό «για να μη χαθούν δεδομένα» δεν ελέγχει τίποτα στην πράξη. Η διόρθωση γίνεται στον broker: ανανέωση του πιστοποιητικού.',
        retry: 'Όχι ακόμα. Αν ο client δεχτεί ένα προβληματικό πιστοποιητικό, πώς ξέρει ότι μιλά με τον σωστό broker;'
      },
      hints: [
        'Όταν ο έλεγχος του πιστοποιητικού αποτυγχάνει, η σωστή αντίδραση είναι να μη γίνει σύνδεση.',
        'Μέσα στο else υπάρχουν το setInsecure() και ένα δεύτερο connect. Αυτά είναι η παράκαμψη.',
        'Το else να γίνει:\n} else {\n  Serial.println("Certificate rejected");\n}\nΣβήσε το setInsecure() και το δεύτερο mqtt.connect.'
      ],
      validationTests: [
        { name: 'Ο client απορρίπτει το ληγμένο πιστοποιητικό', script: [{ setup: true }, { loops: 2 }].concat(rejectChecks) },
        { name: 'Δεν στέλνονται μηνύματα μέσα από απορριφθείσα σύνδεση', script: [
          { setup: true }, { ms: 5000 },
          { check: 'published', topic: 'home/status', max: 0, fail: 'Η πλακέτα δημοσίευσε {n} μηνύματα παρόλο που το πιστοποιητικό είναι ληγμένο.' }
        ] },
        { name: 'Το log λέει καθαρά τι έγινε', script: [
          { setup: true },
          { check: 'serialHas', text: 'Certificate rejected', fail: 'Δεν βρήκα «Certificate rejected» στο Serial. Τελευταίες γραμμές: {v}.' },
          { check: 'serialNot', text: 'MQTT connected', fail: 'Το Serial λέει «MQTT connected», ενώ το πιστοποιητικό είναι ληγμένο.' }
        ] }
      ],
      explanationOnSuccess: 'Ο client απέρριψε το ληγμένο πιστοποιητικό και το είπε καθαρά στο log. Δεν στάλθηκε τίποτα μέσα από μια σύνδεση που δεν μπορεί να ελεγχθεί. Η επόμενη κίνηση είναι στον broker: ανανέωση του πιστοποιητικού.',
      remediation: 'Αν η πλακέτα συνδέεται ακόμα, ψάξε για setInsecure() οπουδήποτε στον κώδικα.'
    },

    // ------------------------------------------------------------ c11-l5
    {
      id: 'c11-l5', chapter: 11, kind: 'independent', skills: ['security', 'mqtt', 'conditions'],
      title: 'Λάθος hostname: το πιστοποιητικό είναι για άλλη συσκευή',
      prerequisites: ['c11-l4'],
      objectives: [
        'Να γράφω μόνος/μόνη μου ασφαλή σύνδεση TLS.',
        'Να εξηγώ γιατί ο έλεγχος hostname είναι απαραίτητος.'
      ],
      theory: `
<p>Ένα πιστοποιητικό μπορεί να είναι υπογεγραμμένο από έμπιστη CA και να ισχύει, αλλά να είναι <strong>για άλλο όνομα</strong>.</p>
<p>Σε αυτό το σενάριο ο broker παρουσιάζει πιστοποιητικό για <code>printer.home.lan</code>, ενώ η πλακέτα συνδέεται στο <code>broker.home.lan</code>.</p>
<p>Η CA είναι σωστή και η ημερομηνία ισχύει. Όμως το πιστοποιητικό λέει «είμαι ο εκτυπωτής», όχι «είμαι ο broker». Ο client πρέπει να το απορρίψει.</p>
<p>Χωρίς έλεγχο hostname, <strong>οποιοδήποτε</strong> πιστοποιητικό της ίδιας CA θα γινόταν δεκτό.</p>`,
      glossary: ['hostname', 'αλυσίδα εμπιστοσύνης'],
      supportedSyntax: SYNTAX_C11,
      initialCode: `void setup() {
  Serial.begin(115200);

  // Γράψε εδώ:
  // 1. setServer στο MQTT_HOST, στη θύρα TLS
  // 2. έλεγχο πιστοποιητικού με την έμπιστη CA
  // 3. connect με MQTT_USER και MQTT_PASS
  //    αν πετύχει:  Serial.println("MQTT connected");
  //    αν αποτύχει: Serial.println("Certificate rejected");
}

void loop() {
  delay(1000);
}
`,
      solution: `void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 8883);
  mqtt.setCACert(HOME_CA);

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
  } else {
    Serial.println("Certificate rejected");
  }
}

void loop() {
  delay(1000);
}
`,
      initialWorld: worldWith('wrong-host'),
      world: worldWith('wrong-host'),
      hardware: HW,
      panels: PANELS,
      steps: [
        'Γράψε τη σύνδεση μόνος/μόνη σου, χωρίς να κοιτάξεις τα προηγούμενα μαθήματα αν μπορείς.',
        'Τρέξε. Στον Network Monitor άνοιξε το «Server Hello, Certificate»: για ποιο όνομα είναι;',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η CA είναι έμπιστη και η ημερομηνία ισχύει, αλλά το πιστοποιητικό είναι για printer.home.lan. Τι κάνει ο client που συνδέεται στο broker.home.lan;',
        options: ['Το απορρίπτει: το όνομα δεν ταιριάζει', 'Το δέχεται: η CA είναι έμπιστη', 'Το δέχεται: η ημερομηνία ισχύει'],
        answer: 0,
        explain: 'Σωστά. Πρέπει να περνούν και οι τρεις έλεγχοι: CA, hostname και ημερομηνία. Ένας μόνο δεν αρκεί.',
        retry: 'Όχι ακόμα. Αρκεί ένας από τους τρεις ελέγχους, ή χρειάζονται όλοι;'
      },
      hints: [
        'Χρειάζεσαι τρεις εντολές για τη σύνδεση και ένα if / else για το μήνυμα.',
        'Η θύρα TLS είναι 8883. Η έμπιστη CA είναι η σταθερά HOME_CA. Το connect θέλει id, MQTT_USER και MQTT_PASS.',
        'Λυμένο παράδειγμα:\nmqtt.setServer(MQTT_HOST, 8883);\nmqtt.setCACert(HOME_CA);\nif (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {\n  Serial.println("MQTT connected");\n} else {\n  Serial.println("Certificate rejected");\n}'
      ],
      validationTests: [
        { name: 'Ο client απορρίπτει πιστοποιητικό για άλλο hostname', script: [{ setup: true }, { loops: 1 }].concat(rejectChecks) },
        { name: 'Το log λέει καθαρά τι έγινε', script: [
          { setup: true },
          { check: 'serialHas', text: 'Certificate rejected', fail: 'Δεν βρήκα «Certificate rejected» στο Serial. Τελευταίες γραμμές: {v}.' },
          { check: 'serialNot', text: 'MQTT connected', fail: 'Το Serial λέει «MQTT connected», ενώ το πιστοποιητικό είναι για άλλο όνομα.' }
        ] }
      ],
      explanationOnSuccess: 'Ο client σου ελέγχει και το όνομα, όχι μόνο την CA. Στον πραγματικό κόσμο, η διόρθωση είναι να βγει πιστοποιητικό για broker.home.lan, όχι να χαλαρώσει ο έλεγχος.',
      remediation: 'Αν τα tests λένε ότι δεν ξεκίνησε TLS, έλεγξε ότι η θύρα είναι 8883 και ότι το setCACert γράφεται πριν από το connect.'
    },

    // ------------------------------------------------------------ c11-l6
    {
      id: 'c11-l6', chapter: 11, kind: 'checkpoint', skills: ['security', 'mqtt'],
      title: 'Έλεγχος κεφαλαίου: χωρίς setInsecure, χωρίς μυστικά στο log',
      prerequisites: ['c11-l5'],
      objectives: [
        'Να εντοπίζω την παράκαμψη του ελέγχου πιστοποιητικού.',
        'Να συνδυάζω TLS με όσα έμαθα για τα μυστικά στο Κεφάλαιο 10.'
      ],
      theory: `
<p>Σε αυτό το σενάριο ο broker παρουσιάζει πιστοποιητικό υπογεγραμμένο από την <strong>«Unknown Test CA»</strong>, όχι από τη <strong>«Home Lab CA»</strong> που εμπιστεύεται η πλακέτα.</p>
<p>Η <strong>αλυσίδα εμπιστοσύνης</strong> σπάει στον πρώτο κρίκο: η πλακέτα δεν ξέρει αυτή την CA, άρα δεν μπορεί να ξέρει αν ο server είναι ο δικός της broker.</p>
<p>Ο κώδικας που σου δίνουμε «δουλεύει»: συνδέεται και στέλνει μετρήσεις. Αλλά συνδέεται <strong>επειδή δεν ελέγχει τίποτα</strong>.</p>
<p>Στον προσομοιωτή η απόφαση «δεκτό / απορρίφθηκε» είναι απόφαση του μοντέλου. Σε πραγματική συσκευή, η ίδια λογική προστατεύει πραγματικά δεδομένα.</p>`,
      glossary: ['αλυσίδα εμπιστοσύνης', 'CA (Certificate Authority)', 'setInsecure', 'redaction'],
      supportedSyntax: SYNTAX_C11,
      initialCode: `void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 8883);
  mqtt.setInsecure();   // «χωρίς αυτό δεν συνδεόταν»

  Serial.println("User: " + MQTT_USER + " / Pass: " + MQTT_PASS);

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
  } else {
    Serial.println("Certificate rejected");
  }
}

void loop() {
  if (mqtt.connected()) {
    mqtt.publish("home/status", "online");
  }
  delay(2000);
}
`,
      solution: `void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 8883);
  mqtt.setCACert(HOME_CA);

  Serial.println("User: " + MQTT_USER);

  if (mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT connected");
  } else {
    Serial.println("Certificate rejected");
  }
}

void loop() {
  if (mqtt.connected()) {
    mqtt.publish("home/status", "online");
  }
  delay(2000);
}
`,
      initialWorld: worldWith('untrusted'),
      world: worldWith('untrusted'),
      hardware: HW,
      panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Συνδέεται; Διάβασε τις προειδοποιήσεις.',
        'Στον Network Monitor άνοιξε το «Server Hello, Certificate». Ποιος το υπέγραψε;',
        'Βρες δύο προβλήματα: την παράκαμψη του ελέγχου και ένα μυστικό στο Serial.',
        'Διόρθωσε και τα δύο και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο κώδικας με setInsecure() συνδέεται κανονικά. Γιατί αυτό είναι πρόβλημα;',
        options: ['Ο client δέχεται οποιοδήποτε πιστοποιητικό, άρα δεν ξέρει με ποιον μιλά', 'Δεν είναι πρόβλημα: η σύνδεση είναι κρυπτογραφημένη', 'Γιατί το setInsecure() κάνει τη σύνδεση πιο αργή'],
        answer: 0,
        explain: 'Σωστά. Κρυπτογράφηση χωρίς έλεγχο ταυτότητας σημαίνει «μιλάω κρυφά με κάποιον, αλλά δεν ξέρω με ποιον». Ο έλεγχος πιστοποιητικού είναι αυτό που δένει την κρυπτογράφηση με τον σωστό broker.',
        retry: 'Όχι ακόμα. Τι ελέγχει ο client όταν καλείται το setInsecure();'
      },
      hints: [
        'Ένα σωστό TLS χρειάζεται έλεγχο πιστοποιητικού. Ένα σωστό log δεν περιέχει κωδικούς.',
        'Κοίτα τη γραμμή 4 (πώς ρυθμίζεται το TLS) και τη γραμμή 6 (τι τυπώνεται στο Serial).',
        'Γραμμή 4: mqtt.setCACert(HOME_CA);\nΓραμμή 6: Serial.println("User: " + MQTT_USER);\nΜε την έμπιστη CA, ο client θα απορρίψει το πιστοποιητικό της Unknown Test CA και θα τυπώσει «Certificate rejected». Αυτό είναι το σωστό αποτέλεσμα εδώ.'
      ],
      validationTests: [
        { name: 'Ο client απορρίπτει πιστοποιητικό από μη έμπιστη CA', script: [{ setup: true }, { loops: 2 }].concat(rejectChecks) },
        { name: 'Δεν στέλνονται μηνύματα μέσα από μη ελεγμένη σύνδεση', script: [
          { setup: true }, { ms: 5000 },
          { check: 'published', topic: 'home/status', max: 0, fail: 'Η πλακέτα δημοσίευσε {n} μηνύματα σε broker που δεν μπόρεσε να ελέγξει.' },
          { check: 'serialHas', text: 'Certificate rejected', fail: 'Δεν βρήκα «Certificate rejected» στο Serial. Τελευταίες γραμμές: {v}.' }
        ] },
        { name: 'Ο κωδικός δεν τυπώνεται στο Serial', script: [
          { setup: true }, { loops: 2 },
          { check: 'serialNot', text: 'Pir-Lab-Key-0427', fail: 'Ο κωδικός εμφανίζεται στο Serial Monitor. Τύπωσε μόνο το όνομα χρήστη.' },
          { check: 'serialHas', text: 'User: esp32-pir', fail: 'Δεν βρήκα «User: esp32-pir». Κράτα το όνομα χρήστη στο log. Τελευταίες γραμμές: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Ο client πλέον απορρίπτει κάθε προβληματικό πιστοποιητικό: ληγμένο, για λάθος όνομα, από άγνωστη CA. Και κανένα μυστικό δεν φεύγει στο log. Θυμήσου: το setInsecure() δεν «φτιάχνει» μια αποτυχία TLS, απλώς σταματά να την ελέγχει.',
      remediation: 'Αν η πλακέτα συνδέεται ακόμα, ψάξε για setInsecure(). Αν το Serial δείχνει ακόμα τον κωδικό, σβήσε το MQTT_PASS από το Serial.println.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
