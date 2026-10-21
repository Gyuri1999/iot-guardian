/*
 * IoT Guardian — Κεφάλαιο 7: MQTT θεμέλια.
 * Broker, client, publish, subscribe, topic, payload, JSON.
 * Διαχωρισμός εντολής (home/led/set) και αναφερόμενης κατάστασης (home/led/state).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 7).ready = true;

  const addTerm = (term, def) => { if (!L.GLOSSARY.some(g => g.term === term)) L.GLOSSARY.push({ term, def }); };
  addTerm('MQTT', 'Ένα μικρό πρωτόκολλο για μηνύματα ανάμεσα σε συσκευές. Οι συσκευές δεν μιλούν απευθείας μεταξύ τους: στέλνουν και παίρνουν μηνύματα μέσω ενός broker.');
  addTerm('broker', 'Ο «ταχυδρόμος» του MQTT. Δέχεται κάθε μήνυμα και το παραδίδει σε όσους έχουν κάνει subscribe στο topic του. Εδώ τρέχει σε ένα εικονικό Raspberry Pi.');
  addTerm('client', 'Κάθε πρόγραμμα ή συσκευή που συνδέεται στον broker: η πλακέτα σου, το dashboard, άλλες ESP32.');
  addTerm('topic', 'Η «διεύθυνση» ενός μηνύματος, π.χ. home/motion. Τα επίπεδα χωρίζονται με /. Κεφαλαία και πεζά μετράνε: το home/LED/set είναι άλλο topic από το home/led/set.');
  addTerm('publish', 'Αποστολή μηνύματος σε ένα topic: mqtt.publish(topic, payload). Ο αποστολέας δεν ξέρει ποιος θα το διαβάσει.');
  addTerm('subscribe', 'Δήλωση ενδιαφέροντος για ένα topic ή φίλτρο: mqtt.subscribe("home/led/set"). Από εκεί και πέρα ο broker σου παραδίδει τα μηνύματα που ταιριάζουν.');
  addTerm('payload', 'Το περιεχόμενο ενός μηνύματος MQTT. Είναι κείμενο, π.χ. {"motion":true}.');
  addTerm('JSON', 'Τρόπος να γράφουμε δεδομένα ως κείμενο με ζευγάρια «όνομα: τιμή», π.χ. {"cmd":"ON","id":3}. Τα ονόματα και τα κείμενα μπαίνουν σε διπλά εισαγωγικά.');
  addTerm('wildcard (# και +)', 'Ειδικά σύμβολα σε φίλτρο subscribe. Το # πιάνει όλα τα επίπεδα από εκεί και κάτω (home/#). Το + πιάνει ακριβώς ένα επίπεδο (home/+/state).');
  addTerm('εντολή και κατάσταση', 'Η εντολή (π.χ. home/led/set) λέει τι ζητάμε να γίνει. Η κατάσταση (π.χ. home/led/state) λέει τι έγινε πραγματικά. Μόνο η συσκευή ξέρει την πραγματική κατάσταση.');

  const SYNTAX_CH7 = 'Ό,τι μέχρι το Κεφ. 6, και: mqtt.setServer, mqtt.connect, mqtt.publish, mqtt.subscribe, mqtt.read, mqtt.topic, mqtt.payload, jsonGet, jsonHas, jsonValid, δικές σου συναρτήσεις void';

  const WORLD7 = {
    wifi: 'connected',
    broker: 'listener 1883\nallow_anonymous true\n',
    clients: [{ name: 'dashboard', subs: ['home/#'] }]
  };
  const PANELS = ['serial', 'vars', 'mqtt', 'net'];

  // ------------------------------------------------------------- c7-l1

  const C7L1_SOLUTION = String.raw`void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 1883);        // πού βρίσκεται ο broker
  if (mqtt.connect("esp32-pir")) {        // γίνε client του broker
    Serial.println("MQTT connected");
    mqtt.publish("home/status", "{\"status\":\"online\"}");
  }
}

void loop() {
  delay(1000);
}
`;

  // ------------------------------------------------------------- c7-l2

  const C7L2_SOLUTION = String.raw`int lastMotion = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  mqtt.setServer(MQTT_HOST, 1883);
  if (mqtt.connect("esp32-pir")) {
    Serial.println("MQTT connected");
  }
}

void loop() {
  int motion = digitalRead(PIR_PIN);

  if (motion != lastMotion) {               // στέλνουμε μόνο όταν αλλάζει
    String payload = "";
    if (motion == HIGH) {
      payload = "{\"motion\":true}";
    } else {
      payload = "{\"motion\":false}";
    }
    mqtt.publish("home/motion", payload);
    Serial.println(payload);
  }

  lastMotion = motion;
  delay(200);
}
`;

  // ------------------------------------------------------------- c7-l3 / c7-l4

  const C7_LAMP_SOLUTION = String.raw`// Αναφέρει την ΠΡΑΓΜΑΤΙΚΗ κατάσταση του LED, όπως τη διαβάζει από το pin.
void reportState() {
  if (digitalRead(LED_PIN) == HIGH) {
    mqtt.publish("home/led/state", "{\"led\":\"ON\"}");
  } else {
    mqtt.publish("home/led/state", "{\"led\":\"OFF\"}");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  mqtt.setServer(MQTT_HOST, 1883);
  if (mqtt.connect("esp32-lamp")) {
    mqtt.subscribe("home/led/set");      // μόνο το topic εντολών της λάμπας
    reportState();                       // το dashboard μαθαίνει την αρχική κατάσταση
  }
}

void loop() {
  while (mqtt.read()) {
    String topic = mqtt.topic();
    String msg = mqtt.payload();
    if (topic == "home/led/set") {
      String cmd = jsonGet(msg, "cmd");
      if (cmd == "ON") {
        digitalWrite(LED_PIN, HIGH);
      }
      if (cmd == "OFF") {
        digitalWrite(LED_PIN, LOW);
      }
      reportState();
    }
  }
  delay(100);
}
`;

  // Κοινά tests για τη λάμπα (c7-l3, c7-l4).
  const LAMP_TESTS = [
    {
      name: 'Στην αρχή η συσκευή αναφέρει ότι το LED είναι σβηστό',
      script: [
        { setup: true }, { loops: 2 },
        { check: 'dashboard', topic: 'home/led/state', json: { led: 'OFF' }, fail: 'Στο home/led/state το dashboard βλέπει {v}. Περίμενα {"led":"OFF"} αμέσως μετά τη σύνδεση. Κάλεσε μια συνάρτηση αναφοράς κατάστασης στο setup(), μετά το subscribe.' }
      ]
    },
    {
      name: 'Εντολή ON → LED αναμμένο και αναφορά {"led":"ON"}',
      script: [
        { setup: true }, { loops: 1 },
        { dash: { topic: 'home/led/set', payload: '{"cmd":"ON"}' } }, { loops: 2 },
        { check: 'led', is: true, fail: 'Το dashboard έστειλε {"cmd":"ON"} στο home/led/set, αλλά το LED είναι {v}. Έλεγξε το subscribe και τον έλεγχο του cmd.' },
        { check: 'dashboard', topic: 'home/led/state', json: { led: 'ON' }, fail: 'Το LED άλλαξε, αλλά στο home/led/state το dashboard βλέπει {v}. Η συσκευή πρέπει να αναφέρει την πραγματική κατάσταση μετά από κάθε εντολή.' }
      ]
    },
    {
      name: 'Εντολή OFF μετά από ON → LED σβηστό και αναφορά {"led":"OFF"}',
      script: [
        { setup: true }, { loops: 1 },
        { dash: { topic: 'home/led/set', payload: '{"cmd":"ON"}' } }, { loops: 2 },
        { dash: { topic: 'home/led/set', payload: '{"cmd":"OFF"}' } }, { loops: 2 },
        { check: 'led', is: false, fail: 'Μετά το {"cmd":"OFF"} το LED είναι {v}.' },
        { check: 'dashboard', topic: 'home/led/state', json: { led: 'OFF' }, fail: 'Μετά το OFF το dashboard βλέπει στο home/led/state {v}. Περίμενα {"led":"OFF"}.' }
      ]
    },
    {
      name: 'Μήνυμα σε άσχετο topic δεν αλλάζει το LED',
      script: [
        { setup: true }, { loops: 1 },
        { dash: { topic: 'home/kitchen/light/set', payload: '{"cmd":"ON"}' } }, { loops: 2 },
        { check: 'led', is: false, fail: 'Μια εντολή για το φως της κουζίνας (home/kitchen/light/set) άναψε το LED σου. Η λάμπα πρέπει να αντιδρά μόνο στο home/led/set: στένεψε το subscribe ή έλεγξε το mqtt.topic().' },
        { check: 'published', topic: 'home/led/state', json: { led: 'ON' }, is: 0, fail: 'Μετά από μήνυμα σε άσχετο topic η συσκευή ανέφερε {"led":"ON"} ({n} φορές).' }
      ]
    },
    {
      name: 'Άγνωστη εντολή δεν αλλάζει την κατάσταση',
      script: [
        { setup: true }, { loops: 1 },
        { dash: { topic: 'home/led/set', payload: '{"cmd":"BLINK"}' } }, { loops: 2 },
        { check: 'led', is: false, fail: 'Η άγνωστη εντολή BLINK άλλαξε το LED σε {v}.' },
        { check: 'dashboard', topic: 'home/led/state', json: { led: 'OFF' }, fail: 'Μετά την άγνωστη εντολή το dashboard βλέπει {v}. Η αναφορά πρέπει να λέει την πραγματική κατάσταση ({"led":"OFF"}), όχι να επαναλαμβάνει την εντολή.' }
      ]
    }
  ];

  L.lessons.push(
    {
      id: 'c7-l1', chapter: 7, kind: 'micro', skills: ['mqtt', 'network'],
      title: 'Broker, client και topic: το πρώτο μήνυμα',
      prerequisites: [],
      objectives: ['Να ξέρω τι είναι broker και τι client.', 'Να στέλνω ένα μήνυμα με publish σε ένα topic.', 'Να ξεχωρίζω το topic από το payload.'],
      theory: `
<p>Στο <strong>MQTT</strong> οι συσκευές δεν μιλούν απευθείας μεταξύ τους. Όλα τα μηνύματα περνούν από έναν <strong>broker</strong>, σαν ταχυδρομείο.</p>
<ul>
  <li><strong>client</strong>: κάθε συσκευή που συνδέεται στον broker. Η πλακέτα σου και το dashboard είναι clients.</li>
  <li><strong>topic</strong>: η «διεύθυνση» του μηνύματος, π.χ. <code>home/status</code>.</li>
  <li><strong>payload</strong>: το περιεχόμενο, π.χ. <code>{"status":"online"}</code>.</li>
</ul>
<p><code>mqtt.publish(topic, payload)</code> στέλνει ένα μήνυμα. Ο broker το δίνει σε όσους έχουν κάνει <strong>subscribe</strong> σε αυτό το topic.</p>
<p>Το dashboard εδώ έχει κάνει subscribe στο <code>home/#</code>. Το <code>#</code> σημαίνει «όλα όσα ξεκινούν με home/».</p>
<p>Μέσα σε κείμενο C++, το <code>\\"</code> γράφει ένα εισαγωγικό. Έτσι το <code>"{\\"status\\":\\"online\\"}"</code> γίνεται <code>{"status":"online"}</code>.</p>`,
      glossary: ['MQTT', 'broker', 'client', 'topic', 'payload', 'publish'],
      supportedSyntax: SYNTAX_CH7,
      initialCode: String.raw`void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 1883);        // πού βρίσκεται ο broker
  if (mqtt.connect("esp32-pir")) {        // γίνε client του broker
    Serial.println("MQTT connected");
    // ΣΥΜΠΛΗΡΩΣΕ: το topic είναι "home/status"
    mqtt.publish(____, "{\"status\":\"online\"}");
  }
}

void loop() {
  delay(1000);
}
`,
      solution: C7L1_SOLUTION,
      world: WORLD7,
      initialWorld: {},
      hardware: [],
      panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το κενό ____ με το topic "home/status" (μέσα σε εισαγωγικά).',
        'Πάτησε «Εκτέλεση». Κοίτα το πάνελ MQTT: τι έφτασε στο dashboard;',
        'Άνοιξε τον Network Monitor και βρες το πακέτο «Publish Message [home/status]».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Στο mqtt.publish("home/status", "{\\"status\\":\\"online\\"}"), ποιο είναι το topic;',
        options: ['home/status', '{"status":"online"}', 'esp32-pir'],
        answer: 0,
        explain: 'Σωστά. Το πρώτο όρισμα είναι το topic (η διεύθυνση). Το δεύτερο είναι το payload (το περιεχόμενο). Το esp32-pir είναι το όνομα του client.',
        retry: 'Όχι ακόμα. Το topic είναι η «διεύθυνση» και γράφεται πρώτο μέσα στις παρενθέσεις.'
      },
      hints: [
        'Το publish θέλει δύο πράγματα: πού (topic) και τι (payload).',
        'Το κενό ____ είναι το πρώτο όρισμα του mqtt.publish. Ένα topic είναι κείμενο, άρα θέλει "εισαγωγικά".',
        'Γράψε:\nmqtt.publish("home/status", "{\\"status\\":\\"online\\"}");\n• "home/status" = το topic\n• το δεύτερο κείμενο = το payload σε μορφή JSON'
      ],
      validationTests: [
        { name: 'Η πλακέτα συνδέεται στον broker', script: [{ setup: true }, { check: 'mqttConnected', is: true, fail: 'Η πλακέτα δεν είναι συνδεδεμένη στον broker. {v}' }] },
        { name: 'Το dashboard λαμβάνει {"status":"online"} στο home/status', script: [
          { setup: true }, { loops: 2 },
          { check: 'dashboard', topic: 'home/status', json: { status: 'online' }, fail: 'Στο home/status το dashboard βλέπει {v}. Έλεγξε ότι το topic είναι ακριβώς "home/status".' }
        ] },
        { name: 'Ένα μήνυμα μόνο, από το setup()', script: [
          { setup: true }, { loops: 5 },
          { check: 'published', topic: 'home/status', is: 1, fail: 'Η πλακέτα έστειλε {n} μηνύματα στο home/status σε 5 επαναλήψεις. Περίμενα 1, από το setup().', failZero: 'Δεν στάλθηκε κανένα μήνυμα στο home/status. Η πλακέτα έστειλε: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα σου έγινε client του broker και έστειλε το πρώτο της μήνυμα. Δεν ήξερε ποιος θα το διαβάσει: ο broker το παρέδωσε στο dashboard, επειδή το dashboard είχε κάνει subscribe στο home/#.',
      remediation: 'Αν το dashboard δεν βλέπει τίποτα, σύγκρινε γράμμα-γράμμα το topic στον κώδικα με το topic στο πάνελ MQTT.'
    },

    {
      id: 'c7-l2', chapter: 7, kind: 'guided', skills: ['mqtt', 'state'],
      title: 'Ο PIR στέλνει την κίνηση σε JSON',
      prerequisites: ['c7-l1'],
      objectives: ['Να στέλνω μήνυμα μόνο όταν αλλάζει η κατάσταση.', 'Να γράφω payload σε μορφή JSON.'],
      theory: `
<p>Θέλουμε το dashboard να ξέρει αν υπάρχει κίνηση στο σπίτι. Η πλακέτα στέλνει στο topic <code>home/motion</code>.</p>
<p>Δεν στέλνουμε σε κάθε επανάληψη. Στέλνουμε <strong>μόνο όταν αλλάζει</strong> η τιμή του PIR, με το μοτίβο του Κεφαλαίου 3 (<code>motion</code> και <code>lastMotion</code>).</p>
<p>Το payload γράφεται σε <strong>JSON</strong>: ζευγάρια «όνομα: τιμή» μέσα σε <code>{ }</code>.</p>
<ul>
  <li>Κίνηση: <code>{"motion":true}</code></li>
  <li>Χωρίς κίνηση: <code>{"motion":false}</code></li>
</ul>
<p>Το JSON είναι κοινή «γλώσσα»: κάθε client μπορεί να το διαβάσει, και μπορούμε αργότερα να προσθέσουμε κι άλλα πεδία.</p>`,
      glossary: ['JSON', 'payload', 'publish', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX_CH7,
      initialCode: String.raw`int lastMotion = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  mqtt.setServer(MQTT_HOST, 1883);
  if (mqtt.connect("esp32-pir")) {
    Serial.println("MQTT connected");
  }
}

void loop() {
  int motion = digitalRead(PIR_PIN);

  if (motion != lastMotion) {               // στέλνουμε μόνο όταν αλλάζει
    String payload = "";
    if (motion == HIGH) {
      payload = ____;                       // ΣΥΜΠΛΗΡΩΣΕ: JSON για «υπάρχει κίνηση»
    } else {
      payload = "{\"motion\":false}";
    }
    mqtt.publish(____, payload);            // ΣΥΜΠΛΗΡΩΣΕ: το topic home/motion
    Serial.println(payload);
  }

  lastMotion = motion;
  delay(200);
}
`,
      solution: C7L2_SOLUTION,
      world: WORLD7,
      initialWorld: { pir: false },
      hardware: ['pir'],
      panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το payload για την κίνηση. Πάρε για παράδειγμα τη γραμμή του else.',
        'Συμπλήρωσε το topic "home/motion".',
        'Τρέξε, άναψε και σβήσε την «Κίνηση». Μέτρα τα μηνύματα στο πάνελ MQTT.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο PIR δίνει 0, 0, 1, 1, 0. Πόσα μηνύματα θα στείλει η πλακέτα στο home/motion;',
        options: ['2', '5', '3'],
        answer: 0,
        explain: 'Σωστά. Στέλνει μόνο στις αλλαγές: 0→1 ({"motion":true}) και 1→0 ({"motion":false}).',
        retry: 'Όχι ακόμα. Το publish είναι μέσα στο if (motion != lastMotion). Μέτρα μόνο τις αλλαγές.'
      },
      hints: [
        'Το payload για κίνηση μοιάζει με αυτό για «χωρίς κίνηση», αλλά με true.',
        'Αντέγραψε το κείμενο της γραμμής του else και άλλαξε το false σε true. Το topic είναι κείμενο σε "εισαγωγικά".',
        'payload = "{\\"motion\\":true}";\nmqtt.publish("home/motion", payload);\nΤο \\" βάζει ένα εισαγωγικό μέσα στο κείμενο.'
      ],
      validationTests: [
        { name: 'Ακολουθία 0,0,1,1,0 → δύο μηνύματα, σωστό JSON', world: { pir: false }, script: [
          { setup: true }, { sequence: { pir: [0, 0, 1, 1, 0] } },
          { check: 'published', topic: 'home/motion', is: 2, fail: 'Στάλθηκαν {n} μηνύματα στο home/motion. Περίμενα 2, ένα για κάθε αλλαγή. Τελευταία μηνύματα: {v}.', failZero: 'Δεν στάλθηκε κανένα μήνυμα στο home/motion. Η πλακέτα έστειλε: {v}.' },
          { check: 'published', topic: 'home/motion', json: { motion: true }, is: 1, fail: 'Το {"motion":true} στάλθηκε {n} φορές. Περίμενα 1. Έλεγξε ότι το payload είναι έγκυρο JSON: {v}.' },
          { check: 'published', topic: 'home/motion', json: { motion: false }, is: 1, fail: 'Το {"motion":false} στάλθηκε {n} φορές. Περίμενα 1.' },
          { check: 'dashboard', topic: 'home/motion', json: { motion: false }, fail: 'Στο τέλος το dashboard βλέπει {v}. Περίμενα {"motion":false}.' }
        ] },
        { name: 'Σταθερή κίνηση → ένα μόνο μήνυμα', world: { pir: false }, script: [
          { setup: true }, { sequence: { pir: [1, 1, 1, 1] } },
          { check: 'published', topic: 'home/motion', is: 1, fail: 'Με σταθερή κίνηση στάλθηκαν {n} μηνύματα. Περίμενα 1.' },
          { check: 'dashboard', topic: 'home/motion', json: { motion: true }, fail: 'Κατά την κίνηση το dashboard βλέπει {v}. Περίμενα {"motion":true}.' }
        ] },
        { name: 'Χωρίς κίνηση → κανένα μήνυμα', world: { pir: false }, script: [
          { setup: true }, { loops: 5 },
          { check: 'published', topic: 'home/motion', is: 0, fail: 'Χωρίς καμία αλλαγή στάλθηκαν {n} μηνύματα στο home/motion.' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα στέλνει ένα μήνυμα ανά γεγονός, σε μορφή JSON που κάθε client καταλαβαίνει. Το dashboard βλέπει πάντα την τελευταία κατάσταση της κίνησης.',
      remediation: 'Αν το dashboard δείχνει το payload αλλά ο έλεγχος λέει ότι δεν είναι JSON, έλεγξε τα \\" γύρω από το motion. Το true γράφεται χωρίς εισαγωγικά.'
    },

    {
      id: 'c7-l3', chapter: 7, kind: 'variant', skills: ['mqtt', 'conditions'],
      title: 'Εντολή και πραγματική κατάσταση',
      prerequisites: ['c7-l2'],
      objectives: ['Να κάνω subscribe σε topic εντολών και να διαβάζω μηνύματα.', 'Να ξεχωρίζω την εντολή (set) από την αναφερόμενη κατάσταση (state).', 'Να αγνοώ μηνύματα από άσχετα topics.'],
      theory: `
<p>Τώρα η πλακέτα είναι μια <strong>λάμπα</strong>. Το dashboard στέλνει εντολή στο <code>home/led/set</code>, π.χ. <code>{"cmd":"ON"}</code>.</p>
<p>Για να παίρνει μηνύματα, η πλακέτα κάνει <code>mqtt.subscribe(…)</code>. Στο <code>loop()</code> τα διαβάζει ένα-ένα:</p>
<pre>while (mqtt.read()) {
  String topic = mqtt.topic();
  String msg = mqtt.payload();
}</pre>
<p><strong>Εντολή δεν σημαίνει ότι έγινε.</strong> Η λάμπα μπορεί να είναι εκτός δικτύου ή να μην καταλάβει την εντολή. Γι’ αυτό η συσκευή αναφέρει τι έγινε <strong>πραγματικά</strong> σε άλλο topic: <code>home/led/state</code>.</p>
<p>Το dashboard δείχνει «αναμμένο» μόνο όταν το δει στο <code>home/led/state</code>, όχι όταν στείλει την εντολή.</p>
<p>Ο αρχικός κώδικας κάνει subscribe στο <code>home/#</code>, άρα ακούει <strong>όλο</strong> το σπίτι. Μια εντολή για την κουζίνα θα άναβε και τη δική σου λάμπα.</p>`,
      glossary: ['subscribe', 'εντολή και κατάσταση', 'wildcard (# και +)', 'topic'],
      supportedSyntax: SYNTAX_CH7,
      initialCode: String.raw`void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  mqtt.setServer(MQTT_HOST, 1883);
  if (mqtt.connect("esp32-lamp")) {
    mqtt.subscribe("home/#");            // ακούει ΟΛΑ τα topics του σπιτιού
  }
}

void loop() {
  while (mqtt.read()) {
    String topic = mqtt.topic();
    String msg = mqtt.payload();
    String cmd = jsonGet(msg, "cmd");
    if (cmd == "ON") {
      digitalWrite(LED_PIN, HIGH);
    }
    if (cmd == "OFF") {
      digitalWrite(LED_PIN, LOW);
    }
    // ΣΥΜΠΛΗΡΩΣΕ: ανάφερε την πραγματική κατάσταση στο home/led/state
  }
  delay(100);
}
`,
      solution: C7_LAMP_SOLUTION,
      world: WORLD7,
      initialWorld: {},
      hardware: [],
      panels: PANELS,
      steps: [
        'Τρέξε τον αρχικό κώδικα. Από το πάνελ MQTT στείλε {"cmd":"ON"} στο home/kitchen/light/set. Τι έπαθε η λάμπα σου;',
        'Κάνε τη λάμπα να αντιδρά μόνο σε μηνύματα του home/led/set.',
        'Μετά από κάθε εντολή, και μία φορά στο setup(), στείλε την πραγματική κατάσταση στο home/led/state: {"led":"ON"} ή {"led":"OFF"}.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το dashboard έστειλε {"cmd":"ON"} στο home/led/set. Πότε πρέπει να δείξει «η λάμπα είναι αναμμένη»;',
        options: ['Όταν δει {"led":"ON"} στο home/led/state', 'Αμέσως μόλις στείλει την εντολή', 'Όταν ο broker δεχτεί την εντολή'],
        answer: 0,
        explain: 'Σωστά. Μόνο η συσκευή ξέρει αν το LED άναψε πραγματικά. Ο broker απλώς παραδίδει μηνύματα: δεν ξέρει αν η λάμπα εκτέλεσε την εντολή.',
        retry: 'Όχι ακόμα. Η εντολή λέει τι ζητήσαμε. Ποιο topic λέει τι έγινε;'
      },
      hints: [
        'Δύο αλλαγές: (1) η λάμπα αγνοεί άσχετα topics, (2) η λάμπα αναφέρει τι έκανε.',
        'Για το (1): κάνε subscribe στο "home/led/set" αντί για "home/#", ή έλεγξε if (topic == "home/led/set"). Για το (2): φτιάξε μια συνάρτηση void reportState() που διαβάζει digitalRead(LED_PIN).',
        'void reportState() {\n  if (digitalRead(LED_PIN) == HIGH) {\n    mqtt.publish("home/led/state", "{\\"led\\":\\"ON\\"}");\n  } else {\n    mqtt.publish("home/led/state", "{\\"led\\":\\"OFF\\"}");\n  }\n}\nΚάλεσέ τη στο setup() μετά το subscribe, και μέσα στο while μετά από κάθε εντολή του home/led/set.'
      ],
      validationTests: LAMP_TESTS,
      explanationOnSuccess: 'Η λάμπα ακούει μόνο τις δικές της εντολές και λέει την αλήθεια για την κατάστασή της. Η αναφορά βγαίνει από το digitalRead του pin, όχι από την εντολή. Έτσι μια άγνωστη εντολή δεν «ξεγελά» το dashboard.',
      remediation: 'Αν το LED ανάβει από το home/kitchen/light/set, η λάμπα ακούει ακόμα όλο το σπίτι. Αν το dashboard δεν βλέπει το home/led/state, έλεγξε ότι η reportState() καλείται.'
    },

    {
      id: 'c7-l4', chapter: 7, kind: 'checkpoint', skills: ['mqtt', 'syntax'],
      title: 'Βρες το λάθος: η λάμπα δεν ακούει',
      prerequisites: ['c7-l3'],
      objectives: ['Να εντοπίζω λάθος topic με τη βοήθεια του Network Monitor.', 'Να θυμάμαι ότι στα topics τα κεφαλαία και τα πεζά μετράνε.', 'Να μην αναφέρω κατάσταση στο topic εντολών.'],
      theory: `
<p>Αυτή η λάμπα <strong>δεν αντιδρά σε καμία εντολή</strong>, και το dashboard δείχνει κάτι περίεργο.</p>
<p>Ο κώδικας τρέχει χωρίς μήνυμα λάθους. Ο broker δεν βγάζει σφάλμα όταν κάνεις subscribe σε topic που δεν χρησιμοποιεί κανείς. Απλώς δεν σου στέλνει τίποτα.</p>
<p>Θυμήσου: στο MQTT τα topics είναι <strong>ακριβή</strong>. <code>home/led/set</code>, <code>home/LED/set</code> και <code>home/led/sett</code> είναι τρία διαφορετικά topics.</p>
<p>Χρήσιμο εργαλείο: ο <strong>Network Monitor</strong>. Σύγκρινε το «Subscribe Request […]» της λάμπας με το «Publish Message […]» του dashboard.</p>
<p>Υπάρχουν <strong>δύο</strong> λάθη. Το δεύτερο αφορά το πού στέλνεται η κατάσταση.</p>`,
      glossary: ['topic', 'subscribe', 'εντολή και κατάσταση'],
      supportedSyntax: SYNTAX_CH7,
      initialCode: String.raw`void reportState() {
  if (digitalRead(LED_PIN) == HIGH) {
    mqtt.publish("home/led/set", "{\"led\":\"ON\"}");
  } else {
    mqtt.publish("home/led/set", "{\"led\":\"OFF\"}");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  mqtt.setServer(MQTT_HOST, 1883);
  if (mqtt.connect("esp32-lamp")) {
    mqtt.subscribe("home/Led/set");
    reportState();
  }
}

void loop() {
  while (mqtt.read()) {
    String topic = mqtt.topic();
    String msg = mqtt.payload();
    if (topic == "home/led/set") {
      String cmd = jsonGet(msg, "cmd");
      if (cmd == "ON") {
        digitalWrite(LED_PIN, HIGH);
      }
      if (cmd == "OFF") {
        digitalWrite(LED_PIN, LOW);
      }
      reportState();
    }
  }
  delay(100);
}
`,
      solution: C7_LAMP_SOLUTION,
      world: WORLD7,
      initialWorld: {},
      hardware: [],
      panels: ['serial', 'vars', 'mqtt', 'net'],
      steps: [
        'Τρέξε τον κώδικα και στείλε {"cmd":"ON"} στο home/led/set από το πάνελ MQTT. Τι περίμενες; Τι έγινε;',
        'Άνοιξε τον Network Monitor. Βρες το «Subscribe Request» της λάμπας και σύγκρινέ το γράμμα-γράμμα με το topic της εντολής.',
        'Κοίτα και σε ποιο topic στέλνει η reportState(). Είναι topic εντολής ή κατάστασης;',
        'Διόρθωσε και τα δύο λάθη και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η λάμπα έκανε subscribe στο home/Led/set και το dashboard στέλνει στο home/led/set. Τι κάνει ο broker;',
        options: ['Δεν παραδίδει την εντολή, γιατί τα δύο topics είναι διαφορετικά', 'Την παραδίδει, γιατί μοιάζουν', 'Βγάζει μήνυμα λάθους στη λάμπα'],
        answer: 0,
        explain: 'Σωστά. Ο broker συγκρίνει τα topics χαρακτήρα προς χαρακτήρα. Δεν «διορθώνει» ορθογραφία και δεν προειδοποιεί: απλώς δεν βρίσκει ταίριασμα.',
        retry: 'Όχι ακόμα. Ο broker συγκρίνει τα topics ακριβώς, όπως το == συγκρίνει δύο κείμενα.'
      },
      hints: [
        'Το ένα λάθος είναι ένα κεφαλαίο γράμμα. Το άλλο είναι ένα topic που έπρεπε να λέει state.',
        'Δες τη γραμμή του mqtt.subscribe στο setup() και τις δύο γραμμές mqtt.publish στη reportState().',
        'mqtt.subscribe("home/led/set");\nκαι στη reportState():\nmqtt.publish("home/led/state", …);\nΗ συσκευή ακούει στο set και αναφέρει στο state. Ποτέ το αντίθετο.'
      ],
      validationTests: LAMP_TESTS.concat([
        { name: 'Η συσκευή δεν γράφει ποτέ στο topic εντολών', script: [
          { setup: true }, { loops: 1 },
          { dash: { topic: 'home/led/set', payload: '{"cmd":"ON"}' } }, { loops: 2 },
          { check: 'published', topic: 'home/led/set', is: 0, fail: 'Η λάμπα έστειλε {n} μηνύματα στο home/led/set. Αυτό το topic είναι για εντολές προς τη λάμπα. Η κατάσταση πηγαίνει στο home/led/state.' }
        ] }
      ]),
      explanationOnSuccess: 'Βρήκες δύο «σιωπηλά» λάθη. Το πρώτο δεν έβγαζε κανένα σφάλμα: ο broker απλώς δεν είχε τι να παραδώσει. Το δεύτερο ανακάτευε εντολές και κατάσταση στο ίδιο topic. Το τεκμήριο ήταν στον Network Monitor.',
      remediation: 'Αν το LED δεν ανάβει ακόμα, αντέγραψε το topic από το μήνυμα του dashboard στο πάνελ MQTT και επικόλλησέ το στο subscribe.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
