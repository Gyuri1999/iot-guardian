/*
 * IoT Guardian — Κεφάλαιο 8: Αξιόπιστη επικοινωνία.
 * Επανασύνδεση με ρυθμό και νέο subscribe, QoS, retained κατάσταση,
 * διπλή παράδοση και επιβεβαίωση σε επίπεδο εφαρμογής (idempotency με id).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 8).ready = true;

  const addTerm = (term, def) => { if (!L.GLOSSARY.some(g => g.term === term)) L.GLOSSARY.push({ term, def }); };
  addTerm('επανασύνδεση', 'Όταν χαθεί η σύνδεση με τον broker, η συσκευή ξαναπροσπαθεί. Καλή πρακτική: με ρυθμό (π.χ. κάθε 2 δευτερόλεπτα) και με νέο subscribe μετά από κάθε επιτυχία.');
  addTerm('QoS', 'Quality of Service: πόσο επιμένει το MQTT να παραδώσει ένα μήνυμα. QoS 0 = το πολύ μία φορά, QoS 1 = τουλάχιστον μία φορά (μπορεί και δύο), QoS 2 = ακριβώς μία φορά. Αφορά την παράδοση στον επόμενο client, όχι το αν ο actuator εκτέλεσε την εντολή.');
  addTerm('retained', 'Μήνυμα που ο broker κρατά ως «τελευταία τιμή» ενός topic. Κάθε νέος subscriber το παίρνει αμέσως. Ταιριάζει σε κατάσταση (θερμοκρασία, state), όχι σε εντολές.');
  addTerm('διπλή παράδοση', 'Το ίδιο μήνυμα φτάνει δύο φορές, π.χ. επειδή χάθηκε η επιβεβαίωση και ο αποστολέας ξαναέστειλε. Με QoS 1 είναι αναμενόμενο.');
  addTerm('idempotent', 'Μια ενέργεια είναι idempotent όταν, αν γίνει δύο φορές, το αποτέλεσμα είναι ίδιο με μία. Το «άναψε» είναι idempotent, το «άλλαξε (TOGGLE)» δεν είναι, εκτός αν η συσκευή αγνοεί επαναλήψεις με το ίδιο id.');
  addTerm('επιβεβαίωση εφαρμογής', 'Μήνυμα της ίδιας της συσκευής που λέει «εκτέλεσα την εντολή με id 7, τώρα το LED είναι ON». Είναι η μόνη απόδειξη ότι η ενέργεια έγινε.');
  addTerm('actuator', 'Εξάρτημα που κάνει κάτι στον φυσικό κόσμο: λάμπα, ρελέ, ανεμιστήρας, κλειδαριά.');

  const SYNTAX_CH8 = 'Ό,τι στο Κεφ. 7, και: mqtt.connected, mqtt.publish(topic, payload, retained), millis, unsigned long, toInt, jsonHas, return σε συνάρτηση void';

  const WORLD8 = {
    wifi: 'connected',
    broker: 'listener 1883\nallow_anonymous true\n',
    clients: [{ name: 'dashboard', subs: ['home/#'] }]
  };
  const PANELS = ['serial', 'vars', 'mqtt', 'net', 'logs'];

  // ------------------------------------------------------------- c8-l1

  const C8L1_SOLUTION = String.raw`unsigned long lastTry = 0;   // πότε έγινε η τελευταία προσπάθεια

void reportState() {
  if (digitalRead(LED_PIN) == HIGH) {
    mqtt.publish("home/led/state", "{\"led\":\"ON\"}");
  } else {
    mqtt.publish("home/led/state", "{\"led\":\"OFF\"}");
  }
}

void connectMqtt() {
  lastTry = millis();
  if (mqtt.connect("esp32-lamp")) {
    Serial.println("MQTT connected");
    mqtt.subscribe("home/led/set");     // κάθε νέα σύνδεση χρειάζεται νέο subscribe
    reportState();
  } else {
    Serial.println("MQTT connect failed");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  mqtt.setServer(MQTT_HOST, 1883);
  connectMqtt();
}

void loop() {
  if (!mqtt.connected()) {
    if (millis() - lastTry >= 2000) {   // μία προσπάθεια κάθε 2 δευτερόλεπτα
      connectMqtt();
    }
  }

  while (mqtt.read()) {
    if (mqtt.topic() == "home/led/set") {
      String cmd = jsonGet(mqtt.payload(), "cmd");
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

  const C8L1_INITIAL = C8L1_SOLUTION
    .replace('    mqtt.subscribe("home/led/set");     // κάθε νέα σύνδεση χρειάζεται νέο subscribe\n', '    mqtt.subscribe(____);               // ΣΥΜΠΛΗΡΩΣΕ: το topic εντολών της λάμπας\n')
    .replace('if (millis() - lastTry >= 2000) {   // μία προσπάθεια κάθε 2 δευτερόλεπτα', 'if (millis() - lastTry >= ____) {   // ΣΥΜΠΛΗΡΩΣΕ: κάθε 2 δευτερόλεπτα (σε ms)');

  // ------------------------------------------------------------- c8-l2

  const C8L2_SOLUTION = String.raw`float lastSent = -100.0;     // η τελευταία θερμοκρασία που στείλαμε
bool fanOn = false;
unsigned long lastTry = 0;

void connectMqtt() {
  lastTry = millis();
  if (mqtt.connect("esp32-temp")) {
    Serial.println("MQTT connected");
  }
}

void setup() {
  Serial.begin(115200);
  mqtt.setServer(MQTT_HOST, 1883);
  connectMqtt();
}

void loop() {
  if (!mqtt.connected() && millis() - lastTry >= 2000) {
    connectMqtt();
  }

  float t = readTemperature();

  // Κατάσταση: retained, για να τη βλέπει αμέσως κάθε νέος subscriber.
  if (!isnan(t) && abs(t - lastSent) >= 0.5) {
    String payload = "{\"t\":" + t + "}";
    if (mqtt.publish("home/temperature", payload, true)) {
      lastSent = t;
    }
  }

  // Εντολή: ΟΧΙ retained. Ισχύει μόνο τη στιγμή που στέλνεται.
  if (t > 28 && !fanOn) {
    fanOn = true;
    mqtt.publish("home/fan/set", "{\"cmd\":\"ON\"}", false);
  }
  if (t < 26 && fanOn) {
    fanOn = false;
    mqtt.publish("home/fan/set", "{\"cmd\":\"OFF\"}", false);
  }
  delay(500);
}
`;

  const C8L2_INITIAL = C8L2_SOLUTION
    .replace('mqtt.publish("home/temperature", payload, true)', 'mqtt.publish("home/temperature", payload, ____)')
    .replace('mqtt.publish("home/fan/set", "{\\"cmd\\":\\"ON\\"}", false);', 'mqtt.publish("home/fan/set", "{\\"cmd\\":\\"ON\\"}", ____);')
    .replace('mqtt.publish("home/fan/set", "{\\"cmd\\":\\"OFF\\"}", false);', 'mqtt.publish("home/fan/set", "{\\"cmd\\":\\"OFF\\"}", ____);')
    .replace('  // Κατάσταση: retained, για να τη βλέπει αμέσως κάθε νέος subscriber.\n', '  // ΣΥΜΠΛΗΡΩΣΕ: retained ή όχι; (true / false)\n')
    .replace('  // Εντολή: ΟΧΙ retained. Ισχύει μόνο τη στιγμή που στέλνεται.\n', '  // ΣΥΜΠΛΗΡΩΣΕ: retained ή όχι; (true / false)\n');

  // ------------------------------------------------------------- c8-l3 / c8-l4

  const C8_TOGGLE_SOLUTION = String.raw`int lastId = 0;              // το id της τελευταίας εντολής που εκτελέστηκε
unsigned long lastTry = 0;

// Επιβεβαίωση εφαρμογής: πραγματική κατάσταση + id της εντολής.
void reportState(int id) {
  String led = "OFF";
  if (digitalRead(LED_PIN) == HIGH) {
    led = "ON";
  }
  mqtt.publish("home/led/state", "{\"led\":\"" + led + "\",\"id\":" + id + "}", true);
}

void handleCommand(String msg) {
  if (!jsonHas(msg, "id")) {
    Serial.println("Command without id ignored");
    return;
  }
  int id = toInt(jsonGet(msg, "id"));
  if (id == lastId) {
    Serial.println("Duplicate command ignored");
    reportState(id);           // ξαναστείλε την επιβεβαίωση, χωρίς δεύτερη ενέργεια
    return;
  }
  lastId = id;
  if (jsonGet(msg, "cmd") == "TOGGLE") {
    if (digitalRead(LED_PIN) == HIGH) {
      digitalWrite(LED_PIN, LOW);
    } else {
      digitalWrite(LED_PIN, HIGH);
    }
  }
  reportState(id);
}

void connectMqtt() {
  lastTry = millis();
  if (mqtt.connect("esp32-lamp")) {
    Serial.println("MQTT connected");
    mqtt.subscribe("home/led/set");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  mqtt.setServer(MQTT_HOST, 1883);
  connectMqtt();
}

void loop() {
  if (!mqtt.connected() && millis() - lastTry >= 2000) {
    connectMqtt();
  }
  while (mqtt.read()) {
    if (mqtt.topic() == "home/led/set") {
      handleCommand(mqtt.payload());
    }
  }
  delay(100);
}
`;

  const C8L3_INITIAL = String.raw`int lastId = 0;              // το id της τελευταίας εντολής που εκτελέστηκε
unsigned long lastTry = 0;

// Επιβεβαίωση εφαρμογής: πραγματική κατάσταση + id της εντολής.
void reportState(int id) {
  String led = "OFF";
  if (digitalRead(LED_PIN) == HIGH) {
    led = "ON";
  }
  mqtt.publish("home/led/state", "{\"led\":\"" + led + "\",\"id\":" + id + "}", true);
}

void handleCommand(String msg) {
  int id = toInt(jsonGet(msg, "id"));
  // ΣΥΜΠΛΗΡΩΣΕ:
  // 1. Εντολή χωρίς "id" → αγνόησέ τη.
  // 2. Ίδιο id με την προηγούμενη → μην ξανακάνεις TOGGLE, μόνο ξαναστείλε την επιβεβαίωση.
  // 3. Νέο id → θυμήσου το στο lastId.
  if (jsonGet(msg, "cmd") == "TOGGLE") {
    if (digitalRead(LED_PIN) == HIGH) {
      digitalWrite(LED_PIN, LOW);
    } else {
      digitalWrite(LED_PIN, HIGH);
    }
  }
  reportState(id);
}

void connectMqtt() {
  lastTry = millis();
  if (mqtt.connect("esp32-lamp")) {
    Serial.println("MQTT connected");
    mqtt.subscribe("home/led/set");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  mqtt.setServer(MQTT_HOST, 1883);
  connectMqtt();
}

void loop() {
  if (!mqtt.connected() && millis() - lastTry >= 2000) {
    connectMqtt();
  }
  while (mqtt.read()) {
    if (mqtt.topic() == "home/led/set") {
      handleCommand(mqtt.payload());
    }
  }
  delay(100);
}
`;

  // Checkpoint: δύο λάθη. (1) Το subscribe γίνεται μόνο στο setup(), όχι σε κάθε επανασύνδεση.
  // (2) Το lastId είναι τοπική μεταβλητή, άρα «ξεχνά» σε κάθε κλήση.
  const C8L4_INITIAL = C8_TOGGLE_SOLUTION
    .replace('int lastId = 0;              // το id της τελευταίας εντολής που εκτελέστηκε\n', '')
    .replace('void handleCommand(String msg) {\n', 'void handleCommand(String msg) {\n  int lastId = 0;\n')
    .replace('    Serial.println("MQTT connected");\n    mqtt.subscribe("home/led/set");\n', '    Serial.println("MQTT connected");\n')
    .replace('  connectMqtt();\n}\n\nvoid loop() {', '  connectMqtt();\n  mqtt.subscribe("home/led/set");\n}\n\nvoid loop() {');

  const TOGGLE = id => ({ dash: { topic: 'home/led/set', payload: `{"cmd":"TOGGLE","id":${id}}` } });

  const T_ONE = {
    name: 'Μία εντολή TOGGLE → LED αναμμένο και επιβεβαίωση με το id',
    script: [
      { setup: true }, { loops: 1 }, TOGGLE(1), { loops: 2 },
      { check: 'led', is: true, fail: 'Μετά από ένα TOGGLE με id 1 το LED είναι {v}.' },
      { check: 'dashboard', topic: 'home/led/state', json: { led: 'ON', id: 1 }, fail: 'Το dashboard βλέπει στο home/led/state {v}. Περίμενα {"led":"ON","id":1}.' }
    ]
  };
  const T_DUP = {
    name: 'Διπλή παράδοση της ίδιας εντολής δεν αλλάζει ξανά το LED',
    script: [
      { setup: true }, { loops: 1 }, TOGGLE(1), { loops: 2 },
      { redeliver: true }, { loops: 2 },
      { check: 'led', is: true, fail: 'Ο broker παρέδωσε δεύτερη φορά το ίδιο TOGGLE (id 1) και το LED έγινε {v}. Μια επανάληψη με το ίδιο id πρέπει να αγνοείται.' }
    ]
  };
  const T_NEW = {
    name: 'Νέα εντολή με νέο id εκτελείται κανονικά',
    script: [
      { setup: true }, { loops: 1 }, TOGGLE(1), { loops: 2 }, TOGGLE(2), { loops: 2 },
      { check: 'led', is: false, fail: 'Μετά από δύο διαφορετικές εντολές (id 1 και id 2) το LED είναι {v}. Περίμενα σβηστό: κάθε νέο id είναι νέα εντολή.' },
      { check: 'dashboard', topic: 'home/led/state', json: { led: 'OFF', id: 2 }, fail: 'Το dashboard βλέπει {v}. Περίμενα {"led":"OFF","id":2}.' }
    ]
  };

  L.lessons.push(
    {
      id: 'c8-l1', chapter: 8, kind: 'guided', skills: ['mqtt', 'network', 'timing'],
      title: 'Επανασύνδεση με ρυθμό και νέο subscribe',
      prerequisites: [],
      objectives: ['Να ξανασυνδέομαι στον broker όταν χαθεί η σύνδεση.', 'Να μην «βομβαρδίζω» τον broker με προσπάθειες.', 'Να ξέρω ότι μετά από νέα σύνδεση χρειάζεται νέο subscribe.'],
      theory: `
<p>Ο broker μπορεί να κάνει <strong>επανεκκίνηση</strong>, π.χ. μετά από αναβάθμιση. Τότε <strong>όλοι οι clients αποσυνδέονται</strong>.</p>
<p>Η <code>mqtt.connected()</code> λέει αν υπάρχει σύνδεση. Αν όχι, η συσκευή ξαναδοκιμάζει.</p>
<p><strong>Με ρυθμό:</strong> μία προσπάθεια κάθε 2 δευτερόλεπτα, όχι σε κάθε loop. Χρησιμοποιούμε <code>millis()</code> και μια μεταβλητή <code>lastTry</code>, χωρίς <code>delay</code> που θα πάγωνε την πλακέτα.</p>
<pre>if (millis() - lastTry >= 2000) { … }</pre>
<p><strong>Νέο subscribe:</strong> στο απλό μοντέλο μας, ο broker ξεχνά τις συνδρομές μιας σύνδεσης που έκλεισε. Γι’ αυτό το <code>mqtt.subscribe</code> μπαίνει <strong>μέσα</strong> στη συνάρτηση σύνδεσης, ώστε να γίνεται σε κάθε επιτυχία.</p>
<p>Στην πλακέτα υπάρχει κουμπί «Επανεκκίνηση broker». Δοκίμασέ το όσο τρέχει ο κώδικας.</p>`,
      glossary: ['επανασύνδεση', 'subscribe', 'broker'],
      supportedSyntax: SYNTAX_CH8,
      initialCode: C8L1_INITIAL,
      solution: C8L1_SOLUTION,
      world: WORLD8,
      initialWorld: {},
      hardware: ['broker', 'router'],
      panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το topic του subscribe μέσα στη connectMqtt().',
        'Συμπλήρωσε τον χρόνο ανάμεσα στις προσπάθειες: 2 δευτερόλεπτα σε ms.',
        'Τρέξε, πάτησε «Επανεκκίνηση broker» και μετά στείλε {"cmd":"ON"} στο home/led/set. Ανάβει η λάμπα;',
        'Σβήσε το router και μέτρα τα «MQTT connect failed» στο Serial. Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο broker έκανε επανεκκίνηση. Η λάμπα ξανασυνδέθηκε, αλλά ΔΕΝ ξανάκανε subscribe. Τι θα γίνει όταν το dashboard στείλει ON;',
        options: ['Η λάμπα δεν θα πάρει την εντολή', 'Η λάμπα θα την πάρει κανονικά', 'Ο broker θα βγάλει σφάλμα στο dashboard'],
        answer: 0,
        explain: 'Σωστά. Η νέα σύνδεση ξεκινά χωρίς συνδρομές. Η λάμπα φαίνεται «συνδεδεμένη», αλλά δεν ακούει τίποτα. Ο broker δεν προειδοποιεί κανέναν.',
        retry: 'Όχι ακόμα. Ο broker παραδίδει μόνο σε όσους έχουν κάνει subscribe στη σημερινή τους σύνδεση.'
      },
      hints: [
        'Η connectMqtt() καλείται και στο setup() και σε κάθε επανασύνδεση. Ό,τι μπει εκεί, γίνεται κάθε φορά.',
        'Το πρώτο κενό είναι το topic εντολών "home/led/set", σε εισαγωγικά. Το δεύτερο είναι αριθμός σε χιλιοστά του δευτερολέπτου.',
        'mqtt.subscribe("home/led/set");\nκαι\nif (millis() - lastTry >= 2000) {\n2 δευτερόλεπτα = 2000 ms.'
      ],
      validationTests: [
        { name: 'Μετά από επανεκκίνηση του broker η πλακέτα ξανασυνδέεται', script: [
          { setup: true }, { loops: 2 }, { restartBroker: true }, { ms: 3000 },
          { check: 'mqttConnected', is: true, fail: 'Μετά την επανεκκίνηση του broker η πλακέτα δεν ξανασυνδέθηκε. {v}' },
          { check: 'count', text: 'MQTT connected', is: 2, fail: 'Το «MQTT connected» τυπώθηκε {n} φορές. Περίμενα 2: μία στην αρχή και μία μετά την επανεκκίνηση.' }
        ] },
        { name: 'Μετά την επανασύνδεση οι εντολές φτάνουν ξανά', script: [
          { setup: true }, { loops: 2 }, { restartBroker: true }, { ms: 3000 },
          { dash: { topic: 'home/led/set', payload: '{"cmd":"ON"}' } }, { loops: 2 },
          { check: 'led', is: true, fail: 'Μετά την επανασύνδεση το dashboard έστειλε ON, αλλά το LED είναι {v}. Μήπως η νέα σύνδεση δεν έκανε subscribe;' },
          { check: 'dashboard', topic: 'home/led/state', json: { led: 'ON' }, fail: 'Το dashboard βλέπει στο home/led/state {v}. Περίμενα {"led":"ON"}.' }
        ] },
        { name: 'Οι προσπάθειες σύνδεσης γίνονται με ρυθμό (όχι σε κάθε loop)', script: [
          { setup: true }, { loops: 2 }, { router: false }, { ms: 6000 },
          { check: 'mqttAttempts', min: 3, max: 5, fail: 'Σε 6 δευτερόλεπτα χωρίς δίκτυο έγιναν {n} προσπάθειες σύνδεσης. Περίμενα περίπου μία κάθε 2 δευτερόλεπτα (3 έως 5 συνολικά).' }
        ] }
      ],
      explanationOnSuccess: 'Η λάμπα σου «επιβιώνει» από επανεκκίνηση του broker: ξανασυνδέεται, ξανακάνει subscribe και αναφέρει την κατάστασή της. Όταν δεν υπάρχει δίκτυο, δοκιμάζει ήρεμα κάθε 2 δευτερόλεπτα, χωρίς να φορτώνει το δίκτυο.',
      remediation: 'Αν οι προσπάθειες είναι δεκάδες, ο έλεγχος millis() - lastTry λείπει ή το lastTry δεν ενημερώνεται μέσα στη connectMqtt().'
    },

    {
      id: 'c8-l2', chapter: 8, kind: 'guided', skills: ['mqtt', 'sensors'],
      title: 'Retained: η τελευταία θερμοκρασία περιμένει',
      prerequisites: ['c8-l1'],
      objectives: ['Να στέλνω κατάσταση ως retained.', 'Να εξηγώ γιατί μια εντολή δεν στέλνεται ως retained.'],
      theory: `
<p>Ένα νέο dashboard συνδέεται στις 10:00. Η θερμοκρασία στάλθηκε στις 09:55. Θα τη δει; Με απλό μήνυμα <strong>όχι</strong>: τα μηνύματα παραδίδονται μόνο σε όσους ακούν εκείνη τη στιγμή.</p>
<p>Με <strong>retained</strong>, ο broker κρατά το τελευταίο μήνυμα του topic και το δίνει <strong>αμέσως</strong> σε κάθε νέο subscriber:</p>
<pre>mqtt.publish("home/temperature", payload, true);</pre>
<p>Το retained ταιριάζει σε <strong>κατάσταση</strong>: «τώρα είναι 23.50 βαθμοί».</p>
<p>Δεν ταιριάζει σε <strong>εντολή</strong>: «άναψε τον ανεμιστήρα». Μια retained εντολή θα ξαναεκτελούνταν από κάθε συσκευή που συνδέεται αργότερα, ακόμα και ώρες μετά, όταν δεν τη θέλει κανείς. Χωρίς λήξη και επιβεβαίωση, μια εντολή προς actuator <strong>δεν</strong> γίνεται retained.</p>
<p>Η πλακέτα εδώ είναι θερμόμετρο. Στέλνει θερμοκρασία όταν αλλάζει κατά 0.5 ή παραπάνω, και ανάβει τον ανεμιστήρα πάνω από 28 βαθμούς.</p>`,
      glossary: ['retained', 'εντολή και κατάσταση', 'actuator'],
      supportedSyntax: SYNTAX_CH8,
      initialCode: C8L2_INITIAL,
      solution: C8L2_SOLUTION,
      world: WORLD8,
      initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'],
      panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τα τρία κενά ____ με true ή false. Σκέψου: είναι κατάσταση ή εντολή;',
        'Τρέξε, ανέβασε τη θερμοκρασία πάνω από 28 και μετά πάτησε «Επανεκκίνηση broker». Τι βλέπει το dashboard όταν ξανασυνδεθεί;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η εντολή {"cmd":"ON"} στο home/fan/set στάλθηκε ως retained στις 14:00. Στις 22:00 ο ανεμιστήρας κάνει restart και ξανασυνδέεται. Τι θα γίνει;',
        options: ['Θα πάρει ξανά την παλιά εντολή και θα ανάψει, χωρίς να το θέλει κανείς', 'Τίποτα, γιατί η εντολή έληξε', 'Θα ρωτήσει πρώτα το dashboard'],
        answer: 0,
        explain: 'Σωστά. Ο broker δίνει το retained μήνυμα σε κάθε νέο subscriber, όσο παλιό κι αν είναι. Το απλό MQTT δεν έχει λήξη για retained. Γι’ αυτό οι εντολές δεν στέλνονται ως retained.',
        retry: 'Όχι ακόμα. Τι κάνει ο broker με ένα retained μήνυμα όταν κάποιος κάνει subscribe;'
      },
      hints: [
        'Η θερμοκρασία είναι κατάσταση. Το «άναψε/σβήσε τον ανεμιστήρα» είναι εντολή.',
        'Το τρίτο όρισμα του mqtt.publish είναι το retained: true ή false.',
        'mqtt.publish("home/temperature", payload, true);\nmqtt.publish("home/fan/set", "{\\"cmd\\":\\"ON\\"}", false);\nmqtt.publish("home/fan/set", "{\\"cmd\\":\\"OFF\\"}", false);'
      ],
      validationTests: [
        { name: 'Η θερμοκρασία μένει στον broker ως retained', world: { temp: 22.5 }, script: [
          { setup: true }, { loops: 2 },
          { check: 'published', topic: 'home/temperature', json: { t: 22.5 }, min: 1, fail: 'Δεν βρέθηκε μήνυμα {"t":22.50} στο home/temperature. Η πλακέτα έστειλε: {v}.' },
          { check: 'retained', topic: 'home/temperature', exists: true, fail: 'Ο broker δεν κρατά retained τιμή για το home/temperature ({v}). Ένα νέο dashboard δεν θα έβλεπε τίποτα μέχρι την επόμενη αλλαγή.' }
        ] },
        { name: 'Οι εντολές ανεμιστήρα στέλνονται, αλλά ΔΕΝ μένουν στον broker', world: { temp: 22.5 }, script: [
          { setup: true }, { sequence: { temp: [25, 29, 30, 25] } },
          { check: 'published', topic: 'home/fan/set', json: { cmd: 'ON' }, is: 1, fail: 'Το {"cmd":"ON"} στάλθηκε {n} φορές. Περίμενα 1, όταν η θερμοκρασία ξεπέρασε τους 28.' },
          { check: 'published', topic: 'home/fan/set', json: { cmd: 'OFF' }, is: 1, fail: 'Το {"cmd":"OFF"} στάλθηκε {n} φορές. Περίμενα 1, όταν έπεσε κάτω από 26.' },
          { check: 'retained', topic: 'home/fan/set', exists: false, fail: 'Ο broker κρατά retained εντολή στο home/fan/set: {v}. Κάθε συσκευή που θα συνδεθεί αργότερα θα την ξαναεκτελέσει.' }
        ] },
        { name: 'Μετά από επανεκκίνηση, το dashboard βλέπει την τελευταία θερμοκρασία', world: { temp: 22.5 }, script: [
          { setup: true }, { sequence: { temp: [21, 23.5] } }, { restartBroker: true }, { ms: 2500 },
          { check: 'retained', topic: 'home/temperature', exists: true, fail: 'Μετά την επανεκκίνηση ο broker δεν έχει retained θερμοκρασία ({v}).' },
          { check: 'dashboard', topic: 'home/temperature', json: { t: 23.5 }, fail: 'Το dashboard βλέπει {v}. Περίμενα την τελευταία τιμή {"t":23.50}.' }
        ] }
      ],
      explanationOnSuccess: 'Κάθε νέος subscriber βλέπει αμέσως την τελευταία θερμοκρασία, ακόμα κι αν το θερμόμετρο είναι εκτός δικτύου εκείνη τη στιγμή. Οι εντολές του ανεμιστήρα όμως ισχύουν μόνο τη στιγμή που στέλνονται, άρα κανένα παλιό «ON» δεν θα ξαναεκτελεστεί μετά από ώρες.',
      remediation: 'Αν το retained για το home/fan/set υπάρχει ήδη, έλεγξε και τα δύο publish του ανεμιστήρα: και το ON και το OFF πρέπει να έχουν false.'
    },

    {
      id: 'c8-l3', chapter: 8, kind: 'variant', skills: ['mqtt', 'state'],
      title: 'Διπλή παράδοση: TOGGLE μόνο μία φορά',
      prerequisites: ['c8-l2'],
      objectives: ['Να εξηγώ γιατί ένα μήνυμα μπορεί να φτάσει δύο φορές.', 'Να κάνω μια εντολή TOGGLE ασφαλή με id (idempotency).', 'Να ξέρω ότι το QoS δεν αποδεικνύει ότι ο actuator εκτέλεσε την εντολή.'],
      theory: `
<p>Με <strong>QoS 1</strong> το MQTT υπόσχεται «τουλάχιστον μία φορά». Αν χαθεί η επιβεβαίωση, ο αποστολέας ξαναστέλνει. Άρα το ίδιο μήνυμα μπορεί να φτάσει <strong>δύο φορές</strong>.</p>
<p>Για το <code>{"cmd":"ON"}</code> αυτό δεν πειράζει: δύο φορές «άναψε» = αναμμένο. Για το <code>{"cmd":"TOGGLE"}</code> πειράζει: δύο φορές «άλλαξε» = πάλι σβηστό!</p>
<p>Λύση: κάθε εντολή έχει ένα <strong>id</strong>, π.χ. <code>{"cmd":"TOGGLE","id":7}</code>. Η συσκευή θυμάται το τελευταίο id. Αν ξαναδεί το ίδιο, <strong>δεν</strong> ξανακάνει την ενέργεια.</p>
<p>Η συσκευή ξαναστέλνει όμως την <strong>επιβεβαίωση</strong> <code>{"led":"ON","id":7}</code>. Ίσως ο αποστολέας ξαναέστειλε ακριβώς επειδή δεν την πήρε.</p>
<p><strong>Προσοχή:</strong> το QoS αφορά μόνο την παράδοση στον επόμενο κρίκο. Δεν λέει αν το LED άναψε. Αυτό το λέει μόνο η επιβεβαίωση της ίδιας της συσκευής στο <code>home/led/state</code>.</p>`,
      glossary: ['QoS', 'διπλή παράδοση', 'idempotent', 'επιβεβαίωση εφαρμογής'],
      supportedSyntax: SYNTAX_CH8,
      initialCode: C8L3_INITIAL,
      solution: C8_TOGGLE_SOLUTION,
      world: WORLD8,
      initialWorld: {},
      hardware: ['broker'],
      panels: PANELS,
      steps: [
        'Τρέξε τον αρχικό κώδικα και στείλε {"cmd":"TOGGLE","id":1}. Μετά πάτησε «Διπλή παράδοση». Τι έπαθε το LED;',
        'Στη handleCommand(): αγνόησε εντολές χωρίς "id" (jsonHas).',
        'Αν το id είναι ίδιο με το lastId: ξαναστείλε μόνο την επιβεβαίωση και σταμάτα με return;',
        'Αλλιώς: αποθήκευσε το id στο lastId και εκτέλεσε την εντολή.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο broker παρέδωσε με QoS 1 την εντολή στη λάμπα. Τι ξέρει σίγουρα το dashboard;',
        options: ['Ότι το μήνυμα παραδόθηκε, όχι ότι το LED άναψε', 'Ότι το LED άναψε', 'Ότι η εντολή εκτελέστηκε ακριβώς μία φορά'],
        answer: 0,
        explain: 'Σωστά. Το QoS αφορά τη μεταφορά του μηνύματος. Η λάμπα μπορεί να έχει καμένο LED, λάθος κώδικα ή να το εκτελέσει δύο φορές. Μόνο η επιβεβαίωση στο home/led/state λέει τι έγινε.',
        retry: 'Όχι ακόμα. Το QoS είναι υπόσχεση του δικτύου, όχι της λάμπας.'
      },
      hints: [
        'Η μεταβλητή lastId υπάρχει ήδη έξω από τις συναρτήσεις, άρα θυμάται ανάμεσα στα μηνύματα.',
        'Πριν από το if της TOGGLE πρόσθεσε δύο ελέγχους με return: έναν με !jsonHas(msg, "id") και έναν με id == lastId. Μετά γράψε lastId = id;',
        'if (!jsonHas(msg, "id")) {\n  return;\n}\nint id = toInt(jsonGet(msg, "id"));\nif (id == lastId) {\n  reportState(id);   // ξανά επιβεβαίωση\n  return;           // όχι δεύτερη ενέργεια\n}\nlastId = id;'
      ],
      validationTests: [
        T_ONE,
        T_DUP,
        { name: 'Η διπλή εντολή επιβεβαιώνεται ξανά, χωρίς δεύτερη ενέργεια', script: [
          { setup: true }, { loops: 1 }, TOGGLE(1), { loops: 2 }, { redeliver: true }, { loops: 2 },
          { check: 'published', topic: 'home/led/state', json: { led: 'ON', id: 1 }, min: 2, fail: 'Η επιβεβαίωση {"led":"ON","id":1} στάλθηκε {n} φορές. Μετά τη διπλή παράδοση περίμενα να σταλεί ξανά, γιατί ο αποστολέας μπορεί να μην πήρε την πρώτη. Τελευταία μηνύματα: {v}.' }
        ] },
        T_NEW,
        { name: 'Εντολή χωρίς id αγνοείται', script: [
          { setup: true }, { loops: 1 },
          { dash: { topic: 'home/led/set', payload: '{"cmd":"TOGGLE"}' } }, { loops: 2 },
          { check: 'led', is: false, fail: 'Μια εντολή χωρίς id άλλαξε το LED σε {v}. Χωρίς id η συσκευή δεν μπορεί να ξεχωρίσει νέα εντολή από επανάληψη, άρα πρέπει να την αγνοήσει.' }
        ] }
      ],
      explanationOnSuccess: 'Η λάμπα σου είναι πια idempotent: όσες φορές κι αν φτάσει η ίδια εντολή, το LED αλλάζει μία φορά. Και κάθε φορά λέει την αλήθεια στο home/led/state, με το id της εντολής, ώστε το dashboard να ξέρει ποια εντολή εκτελέστηκε.',
      remediation: 'Αν η νέα εντολή με id 2 δεν εκτελείται, έλεγξε ότι γράφεις lastId = id; πριν από την ενέργεια. Αν η διπλή αλλάζει ξανά το LED, έλεγξε ότι το return είναι μέσα στο if (id == lastId).'
    },

    {
      id: 'c8-l4', chapter: 8, kind: 'checkpoint', skills: ['mqtt', 'state'],
      title: 'Έλεγχος: ασφαλής μετά από διακοπή και διπλή παράδοση',
      prerequisites: ['c8-l3'],
      objectives: ['Να συνδυάζω επανασύνδεση, νέο subscribe και idempotency.', 'Να βρίσκω λάθη που φαίνονται μόνο σε σπάνια σενάρια.'],
      theory: `
<p>Αυτή η λάμπα δουλεύει σωστά <strong>στην αρχή</strong>. Τα προβλήματα εμφανίζονται μόνο σε δύσκολες στιγμές:</p>
<ul>
  <li>μετά από <strong>επανεκκίνηση του broker</strong>,</li>
  <li>όταν μια εντολή φτάσει <strong>δύο φορές</strong>.</li>
</ul>
<p>Υπάρχουν <strong>δύο</strong> λάθη. Κανένα δεν βγάζει μήνυμα λάθους.</p>
<p>Δοκίμασε με τα κουμπιά «Επανεκκίνηση broker» και «Διπλή παράδοση». Κοίτα τον πίνακα «Μεταβλητές»: τι τιμή έχει το <code>lastId</code> κάθε φορά που ξεκινά η <code>handleCommand()</code>;</p>`,
      glossary: ['επανασύνδεση', 'idempotent', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX_CH8,
      initialCode: C8L4_INITIAL,
      solution: C8_TOGGLE_SOLUTION,
      world: WORLD8,
      initialWorld: {},
      hardware: ['broker', 'router'],
      panels: PANELS,
      steps: [
        'Τρέξε, στείλε {"cmd":"TOGGLE","id":1} και πάτησε «Διπλή παράδοση». Τι έγινε;',
        'Πάτησε «Επανεκκίνηση broker», περίμενε 3 δευτερόλεπτα και στείλε νέα εντολή με id 2. Φτάνει;',
        'Βρες και διόρθωσε τα δύο λάθη.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί το int lastId = 0; μέσα στη handleCommand() δεν προστατεύει από διπλή παράδοση;',
        options: ['Ξαναγίνεται 0 σε κάθε κλήση, άρα δεν θυμάται το προηγούμενο id', 'Γιατί το 0 δεν είναι έγκυρο id', 'Γιατί οι συναρτήσεις δεν δέχονται μεταβλητές'],
        answer: 0,
        explain: 'Σωστά. Μια τοπική μεταβλητή δημιουργείται από την αρχή σε κάθε κλήση. Για να θυμάται ανάμεσα στα μηνύματα, η μεταβλητή πρέπει να δηλωθεί έξω από τις συναρτήσεις.',
        retry: 'Όχι ακόμα. Θυμήσου το Κεφάλαιο 2: πότε μια μεταβλητή θυμάται την τιμή της;'
      },
      hints: [
        'Το ένα λάθος αφορά τη μνήμη (πού δηλώνεται μια μεταβλητή). Το άλλο αφορά το πού γίνεται το subscribe.',
        'Δες την πρώτη γραμμή μέσα στη handleCommand() και τη γραμμή mqtt.subscribe στο setup().',
        '1. Μετακίνησε το int lastId = 0; έξω από τις συναρτήσεις, στην αρχή του αρχείου.\n2. Μετακίνησε το mqtt.subscribe("home/led/set"); μέσα στη connectMqtt(), μετά το «MQTT connected».'
      ],
      validationTests: [
        T_ONE,
        T_DUP,
        T_NEW,
        { name: 'Μετά από επανεκκίνηση του broker οι εντολές φτάνουν ξανά', script: [
          { setup: true }, { loops: 2 }, { restartBroker: true }, { ms: 3000 }, TOGGLE(1), { loops: 2 },
          { check: 'mqttConnected', is: true, fail: 'Η πλακέτα δεν ξανασυνδέθηκε μετά την επανεκκίνηση. {v}' },
          { check: 'led', is: true, fail: 'Μετά την επανασύνδεση το dashboard έστειλε TOGGLE (id 1), αλλά το LED είναι {v}. Η νέα σύνδεση έκανε subscribe;' }
        ] },
        { name: 'Διακοπή και μετά διπλή παράδοση της παλιάς εντολής → καμία δεύτερη ενέργεια', script: [
          { setup: true }, { loops: 1 }, TOGGLE(5), { loops: 2 },
          { restartBroker: true }, { ms: 3000 }, { redeliver: true }, { loops: 2 },
          { check: 'led', is: true, fail: 'Μετά την επανασύνδεση ο broker ξανάστειλε την παλιά εντολή (id 5) και το LED έγινε {v}. Μια παλιά εντολή δεν πρέπει να ξαναεκτελείται.' },
          { check: 'retained', topic: 'home/led/state', exists: true, fail: 'Ο broker δεν έχει retained κατάσταση στο home/led/state ({v}). Η κατάσταση μπορεί να είναι retained, για να τη βλέπει αμέσως ένα νέο dashboard.' },
          { check: 'retained', topic: 'home/led/set', exists: false, fail: 'Υπάρχει retained εντολή στο home/led/set ({v}). Οι εντολές δεν μένουν στον broker.' }
        ] },
        { name: 'Χωρίς δίκτυο οι προσπάθειες γίνονται με ρυθμό', script: [
          { setup: true }, { loops: 2 }, { router: false }, { ms: 6000 },
          { check: 'mqttAttempts', min: 3, max: 5, fail: 'Σε 6 δευτερόλεπτα έγιναν {n} προσπάθειες σύνδεσης. Περίμενα περίπου μία κάθε 2 δευτερόλεπτα.' }
        ] }
      ],
      explanationOnSuccess: 'Η λάμπα σου είναι ασφαλής σε δύσκολες στιγμές: ξανασυνδέεται με ρυθμό, ξανακάνει subscribe, αγνοεί επαναλήψεις με το ίδιο id και επιβεβαιώνει πάντα την πραγματική κατάσταση. Κανένα από αυτά τα λάθη δεν φαινόταν σε μια απλή δοκιμή: τα βρήκες επειδή δοκίμασες τα σενάρια αποτυχίας.',
      remediation: 'Αν μετά την επανεκκίνηση οι εντολές δεν φτάνουν, το subscribe γίνεται μόνο μία φορά. Αν η διπλή παράδοση αλλάζει το LED, το lastId δεν θυμάται.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
