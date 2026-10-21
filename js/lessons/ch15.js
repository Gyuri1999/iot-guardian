/*
 * IoT Guardian — Κεφάλαιο 15: Τελικό έργο.
 * Ο μαθητής ρυθμίζει τον τελικό broker, γράφει το firmware του κόμβου διαδρόμου
 * (PIR, θερμοκρασία, λάμπα) και περνά ένα audit με χωριστούς ελέγχους λειτουργίας και ασφάλειας.
 * Το audit είναι λίστα ελέγχου του εκπαιδευτικού μοντέλου, όχι απόδειξη πραγματικής ασφάλειας.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 15).ready = true;

  [
    { term: 'audit', def: 'Συστηματικός έλεγχος με λίστα: τι πρέπει να λειτουργεί και ποιοι κανόνες ασφαλείας πρέπει να ισχύουν. Στο IoT Guardian ελέγχει το εικονικό μοντέλο, όχι ένα πραγματικό σύστημα.' },
    { term: 'επανασύνδεση με αναμονή', def: 'Μετά από αποτυχία, η συσκευή ξαναδοκιμάζει, αλλά περιμένει λίγο ανάμεσα στις προσπάθειες (π.χ. 5 s για WiFi, 2 s για MQTT). Έτσι δεν φορτώνει άσκοπα το δίκτυο και τον broker.' },
    { term: 'μοναδική ταυτότητα', def: 'Κάθε συσκευή έχει δικό της όνομα χρήστη, δικό της κωδικό και δικό της client id. Έτσι οι ACL και τα logs δείχνουν ακριβώς ποια συσκευή έκανε τι.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX_CFG = 'listener, tls on, allow_anonymous, password, acl_default deny, user, topic read / write / readwrite, σχόλια με #';
  const SYNTAX_FW = 'όλα των προηγούμενων κεφαλαίων: WiFi.begin / status / reconnect, mqtt.setServer / setCACert / connect / connected / subscribe / publish / read, readTemperature, isnan, jsonValid / jsonHas / jsonGet, toInt, millis(), συναρτήσεις bool και void';

  const PASS = { hall: 'Hall-Lab-Key-0310', temp: 'Temp-Lab-Key-0916', dash: 'Dash-Lab-Key-2026' };

  const FINAL_BROKER = [
    '# Τελικός broker του έξυπνου σπιτιού.',
    'listener 8883',
    'tls on',
    'allow_anonymous false',
    `password esp32-hall ${PASS.hall}`,
    `password esp32-temp ${PASS.temp}`,
    `password dashboard ${PASS.dash}`,
    'acl_default deny',
    'user esp32-hall',
    'topic write home/motion',
    'topic write home/temperature',
    'topic write home/led/state',
    'topic read home/led/set',
    'user esp32-temp',
    'topic write home/outdoor/temperature',
    'user dashboard',
    'topic read home/#',
    'topic write home/led/set',
    ''
  ].join('\n');

  const L1_INITIAL = [
    '# Τελικός broker του έξυπνου σπιτιού.',
    '# Συμπλήρωσε τα κενά ____ . Οι κωδικοί είναι φανταστικοί.',
    'listener ____',
    'tls on',
    'allow_anonymous ____',
    `password esp32-hall ${PASS.hall}`,
    `password esp32-temp ${PASS.temp}`,
    `password dashboard ${PASS.dash}`,
    'acl_default ____',
    'user esp32-hall',
    'topic write home/motion',
    'topic write home/temperature',
    'topic write home/led/state',
    'topic ____ home/led/set',
    'user esp32-temp',
    '# ΣΥΜΠΛΗΡΩΣΕ: ένας κανόνας για το home/outdoor/temperature',
    'user dashboard',
    'topic read home/#',
    'topic write home/led/set',
    ''
  ].join('\n');

  const tlsConn = (who, pass, extra) => Object.assign({ connect: who, user: who, pass, port: 8883, tls: true }, extra || {});

  // ---------------------------------------------------------------- Firmware

  const FW_HEAD = `// Τελικό έργο: κόμβος διαδρόμου (PIR, θερμοκρασία, λάμπα).
// Τα MQTT_USER και MQTT_PASS έρχονται από ξεχωριστό αρχείο μυστικών.

int lastMotion = LOW;
int lastId = 0;
unsigned long lastTempMs = 0;
unsigned long lastWifiTry = 0;
unsigned long lastMqttTry = 0;
`;

  const FW_SETUP = `void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(PIR_PIN, INPUT);
  digitalWrite(LED_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastWifiTry = millis();

  mqtt.setServer(MQTT_HOST, 8883);
  mqtt.setCACert(HOME_CA);          // TLS με έλεγχο πιστοποιητικού
  Serial.println("Boot: esp32-hall");
}
`;

  const FW_CONN = `// Επιστρέφει true όταν υπάρχουν WiFi και MQTT.
bool ensureConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiTry >= 5000) {     // αναμονή 5 s ανάμεσα στις προσπάθειες
      Serial.println("WiFi down, retrying");
      WiFi.reconnect();
      lastWifiTry = millis();
    }
    return false;
  }
  if (mqtt.connected()) {
    return true;
  }
  if (millis() - lastMqttTry < 2000) {        // αναμονή 2 s ανάμεσα στις προσπάθειες
    return false;
  }
  lastMqttTry = millis();
  if (mqtt.connect("esp32-hall", MQTT_USER, MQTT_PASS)) {
    mqtt.subscribe("home/led/set");           // ξανά, μετά από κάθε σύνδεση
    Serial.println("MQTT connected");
    return true;
  }
  Serial.println("MQTT connect failed");
  return false;
}
`;

  const FW_SENSORS = `void checkMotion() {
  int motion = digitalRead(PIR_PIN);
  if (motion == HIGH && lastMotion == LOW) {
    mqtt.publish("home/motion", "{\\"motion\\":true}");
  }
  if (motion == LOW && lastMotion == HIGH) {
    mqtt.publish("home/motion", "{\\"motion\\":false}");
  }
  lastMotion = motion;
}

void sendTemperature() {
  float t = readTemperature();
  if (isnan(t) || t < -20 || t > 60) {        // άκυρη ή εκτός ορίων μέτρηση
    Serial.println("Sensor error: reading ignored");
    return;
  }
  mqtt.publish("home/temperature", "{\\"t\\":" + t + "}");
}
`;

  const FW_APPLY = `void applyCommand(String cmd) {
  if (cmd == "ON") {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  mqtt.publish("home/led/state", cmd);
  Serial.println("Accepted: " + cmd);
}
`;

  const FW_HANDLE = `void handleCommand(String p) {
  if (!jsonValid(p)) {
    Serial.println("Rejected: bad json");
    return;
  }
  int id = toInt(jsonGet(p, "id"));
  if (!jsonHas(p, "id") || id < 1 || id > 1000000) {
    Serial.println("Rejected: bad id");
    return;
  }
  if (id <= lastId) {
    Serial.println("Rejected: duplicate id");
    return;
  }
  String cmd = jsonGet(p, "cmd");
  if (cmd == "ON" || cmd == "OFF") {
    applyCommand(cmd);
    lastId = id;
  } else {
    Serial.println("Rejected: unknown cmd");
  }
}
`;

  const FW_LOOP = `void loop() {
  if (ensureConnection()) {
    while (mqtt.read()) {
      if (mqtt.topic() == "home/led/set") {
        handleCommand(mqtt.payload());
      }
    }
    checkMotion();
    if (millis() - lastTempMs >= 10000) {     // μία μέτρηση κάθε 10 s
      lastTempMs = millis();
      sendTemperature();
    }
  }
  delay(50);
}
`;

  const FINAL_FW = [FW_HEAD, FW_SETUP, FW_CONN, FW_SENSORS, FW_APPLY, FW_HANDLE, FW_LOOP].join('\n');

  // Αρχικός κώδικας 15.2: δομή έτοιμη, τέσσερα TODO.
  const L2_INITIAL = [
    FW_HEAD,
    FW_SETUP.replace('  mqtt.setCACert(HOME_CA);          // TLS με έλεγχο πιστοποιητικού\n', '  // TODO 1: ενεργοποίησε TLS με έλεγχο πιστοποιητικού (CA: HOME_CA).\n'),
    FW_CONN.replace(`    if (millis() - lastWifiTry >= 5000) {     // αναμονή 5 s ανάμεσα στις προσπάθειες
      Serial.println("WiFi down, retrying");
      WiFi.reconnect();
      lastWifiTry = millis();
    }
`, `    // TODO 2: αν πέρασαν τουλάχιστον 5000 ms από το lastWifiTry,
    //         τύπωσε "WiFi down, retrying", κάλεσε WiFi.reconnect()
    //         και ενημέρωσε το lastWifiTry.
`),
    FW_SENSORS.replace(`  if (isnan(t) || t < -20 || t > 60) {        // άκυρη ή εκτός ορίων μέτρηση
    Serial.println("Sensor error: reading ignored");
    return;
  }
`, `  // TODO 3: αν η μέτρηση είναι nan ή εκτός ορίων -20..60,
  //         τύπωσε "Sensor error: reading ignored" και μη στείλεις τίποτα.
`),
    FW_APPLY,
    `void handleCommand(String p) {
  if (!jsonValid(p)) {
    Serial.println("Rejected: bad json");
    return;
  }
  int id = toInt(jsonGet(p, "id"));
  if (!jsonHas(p, "id") || id < 1 || id > 1000000) {
    Serial.println("Rejected: bad id");
    return;
  }
  if (id <= lastId) {
    Serial.println("Rejected: duplicate id");
    return;
  }
  String cmd = jsonGet(p, "cmd");
  // TODO 4: allowlist. Μόνο "ON" ή "OFF" → applyCommand(cmd) και lastId = id.
  //         Οτιδήποτε άλλο → "Rejected: unknown cmd".
  applyCommand(cmd);
  lastId = id;
}
`,
    FW_LOOP
  ].join('\n');

  // Αρχικός κώδικας 15.3: «η έκδοση πριν από το audit», με κρυμμένα προβλήματα.
  const L3_INITIAL = `// Κόμβος διαδρόμου: η έκδοση πριν από το audit.
// Τα MQTT_USER και MQTT_PASS έρχονται από ξεχωριστό αρχείο μυστικών.

int lastMotion = LOW;
int lastId = 0;
bool subscribed = false;
unsigned long lastTempMs = 0;
unsigned long lastMqttTry = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(PIR_PIN, INPUT);
  digitalWrite(LED_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  mqtt.setServer(MQTT_HOST, 8883);
  mqtt.setInsecure();               // «προσωρινά», για να δουλέψει γρήγορα
  Serial.println("MQTT login " + MQTT_USER + " / " + MQTT_PASS);
}

bool ensureConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  if (mqtt.connected()) {
    return true;
  }
  if (millis() - lastMqttTry < 2000) {
    return false;
  }
  lastMqttTry = millis();
  if (mqtt.connect("esp32-hall", MQTT_USER, MQTT_PASS)) {
    if (!subscribed) {
      mqtt.subscribe("home/led/set");
      subscribed = true;
    }
    Serial.println("MQTT connected");
    return true;
  }
  Serial.println("MQTT connect failed");
  return false;
}

void checkMotion() {
  int motion = digitalRead(PIR_PIN);
  if (motion == HIGH && lastMotion == LOW) {
    mqtt.publish("home/motion", "{\\"motion\\":true}");
  }
  if (motion == LOW && lastMotion == HIGH) {
    mqtt.publish("home/motion", "{\\"motion\\":false}");
  }
  lastMotion = motion;
}

void sendTemperature() {
  float t = readTemperature();
  mqtt.publish("home/temperature", "{\\"t\\":" + t + "}");
}

void handleCommand(String p) {
  if (!jsonValid(p)) {
    Serial.println("Rejected: bad json");
    return;
  }
  int id = toInt(jsonGet(p, "id"));
  if (!jsonHas(p, "id") || id < 1 || id > 1000000) {
    Serial.println("Rejected: bad id");
    return;
  }
  if (id <= lastId) {
    Serial.println("Rejected: duplicate id");
    return;
  }
  String cmd = jsonGet(p, "cmd");
  if (cmd == "OFF") {
    digitalWrite(LED_PIN, LOW);
  } else {
    digitalWrite(LED_PIN, HIGH);
    cmd = "ON";
  }
  mqtt.publish("home/led/state", cmd);
  Serial.println("Accepted: " + cmd);
  lastId = id;
}

${FW_LOOP}`;

  const WORLD_FINAL = {
    broker: FINAL_BROKER,
    cert: 'valid',
    pir: false,
    temp: 22.5,
    clients: [{ name: 'dashboard', subs: ['home/#'], user: 'dashboard', pass: PASS.dash, port: 8883, tls: true }],
    consts: { MQTT_USER: 'esp32-hall', MQTT_PASS: PASS.hall }
  };

  const HW = ['button', 'pir', 'sensor', 'router', 'broker'];
  const PANELS = ['serial', 'vars', 'mqtt', 'net', 'logs'];

  // ---------------------------------------------------------------- Audit tests
  const ONLINE = [{ setup: true }, { ms: 3000 }];
  const cmd = (c, id) => ({ dash: { topic: 'home/led/set', payload: `{"cmd":"${c}","id":${id}}` } });

  const T = {
    connect: {
      name: 'Λειτουργία: η συσκευή συνδέεται σε WiFi και MQTT',
      script: [...ONLINE,
        { check: 'wifiConnected', is: true, fail: 'Αιτία: μετά από 3 s δεν υπάρχει WiFi. Αποτέλεσμα: τίποτα δεν φτάνει στο σπίτι. Διόρθωση: κάλεσε WiFi.begin(WIFI_SSID, WIFI_PASSWORD) στο setup().' },
        { check: 'mqttConnected', is: true, fail: 'Αιτία: η σύνδεση MQTT απέτυχε ({v}). Αποτέλεσμα: ούτε μετρήσεις ούτε εντολές. Διόρθωση: θύρα 8883, mqtt.setCACert(HOME_CA) και mqtt.connect("esp32-hall", MQTT_USER, MQTT_PASS).' }]
    },
    motion: {
      name: 'Λειτουργία: μία ειδοποίηση ανά αλλαγή κίνησης',
      script: [...ONLINE, { sequence: { pir: [0, 1, 1, 1, 0, 0] } },
        { check: 'published', topic: 'home/motion', json: { motion: true }, is: 1, fail: 'Αιτία: το {"motion":true} στάλθηκε {n} φορές για ένα πέρασμα. Αποτέλεσμα: πολλαπλές ή καμία ειδοποίηση. Διόρθωση: στείλε μόνο όταν motion == HIGH && lastMotion == LOW.' },
        { check: 'published', topic: 'home/motion', json: { motion: false }, is: 1, fail: 'Αιτία: το {"motion":false} στάλθηκε {n} φορές. Διόρθωση: στείλε όταν motion == LOW && lastMotion == HIGH και ενημέρωσε το lastMotion στο τέλος.' }]
    },
    temp: {
      name: 'Λειτουργία: η θερμοκρασία φτάνει στο dashboard',
      script: [...ONLINE, { ms: 9000 },
        { check: 'published', topic: 'home/temperature', json: { t: 22.5 }, min: 1, max: 2, fail: 'Αιτία: σε 12 s στάλθηκαν {n} μετρήσεις {"t":22.50} (περίμενα 1–2, μία κάθε 10 s). Τελευταία μηνύματα: {v}. Διόρθωση: έλεγξε το sendTemperature() και τον χρονισμό των 10000 ms.' },
        { check: 'dashboard', topic: 'home/temperature', json: { t: 22.5 }, fail: 'Αιτία: το dashboard βλέπει στο home/temperature: {v}. Διόρθωση: έλεγξε το topic και ότι το ACL επιτρέπει topic write home/temperature.' }]
    },
    commands: {
      name: 'Λειτουργία: εντολές ON και OFF από το dashboard',
      script: [...ONLINE, cmd('ON', 1), { loops: 1 },
        { check: 'led', is: true, fail: 'Αιτία: μετά το {"cmd":"ON","id":1} η λάμπα είναι {v}. Διόρθωση: έλεγξε subscribe στο home/led/set και το handleCommand.' },
        { check: 'dashboard', topic: 'home/led/state', payload: 'ON', fail: 'Αιτία: το dashboard βλέπει στο home/led/state: {v}. Διόρθωση: μετά την εκτέλεση στείλε την κατάσταση.' },
        cmd('OFF', 2), { loops: 1 },
        { check: 'led', is: false, fail: 'Αιτία: μετά το {"cmd":"OFF","id":2} η λάμπα είναι {v}.' }]
    },
    wifiLoss: {
      name: 'Λειτουργία: απώλεια WiFi και επανασύνδεση',
      script: [...ONLINE, { router: false }, { ms: 12000 }, { router: true }, { ms: 10000 },
        { check: 'wifiConnected', is: true, fail: 'Αιτία: το router επανήλθε, αλλά η συσκευή δεν ξανασυνδέθηκε στο WiFi. Αποτέλεσμα: το σπίτι μένει «τυφλό» μέχρι να γίνει επανεκκίνηση. Διόρθωση: όταν WiFi.status() != WL_CONNECTED, κάλεσε WiFi.reconnect() κάθε 5 s.' },
        { check: 'mqttConnected', is: true, fail: 'Αιτία: υπάρχει WiFi αλλά όχι MQTT ({v}). Διόρθωση: μετά το WiFi, ξανακάλεσε mqtt.connect(…).' },
        cmd('ON', 1), { loops: 1 },
        { check: 'led', is: true, fail: 'Αιτία: μετά την επανασύνδεση η εντολή ON δεν έφτασε (λάμπα {v}). Διόρθωση: κάνε mqtt.subscribe("home/led/set") μετά από κάθε επιτυχημένο connect.' }]
    },
    brokerRestart: {
      name: 'Λειτουργία: επανασύνδεση MQTT μετά από επανεκκίνηση του broker',
      script: [...ONLINE, { restartBroker: true }, { ms: 4000 },
        { check: 'mqttConnected', is: true, fail: 'Αιτία: μετά την επανεκκίνηση του broker η συσκευή δεν ξανασυνδέθηκε ({v}). Διόρθωση: έλεγχε mqtt.connected() σε κάθε loop και ξανασυνδέσου.' },
        cmd('ON', 1), { loops: 1 },
        { check: 'led', is: true, fail: 'Αιτία: η συσκευή ξανασυνδέθηκε αλλά δεν πήρε την εντολή ON (λάμπα {v}). Μετά από restart ο broker ξεχνά τα subscriptions. Διόρθωση: κάνε mqtt.subscribe("home/led/set") μετά από ΚΑΘΕ επιτυχημένο connect, όχι μόνο την πρώτη φορά.' }]
    },
    tls: {
      name: 'Ασφάλεια: TLS με έλεγχο πιστοποιητικού',
      script: [...ONLINE,
        { check: 'tlsMode', is: 'verify', fail: 'Αιτία: η λειτουργία TLS είναι «{v}». Αποτέλεσμα: η συσκευή θα δεχόταν οποιοδήποτε πιστοποιητικό. Διόρθωση: αντί για mqtt.setInsecure() γράψε mqtt.setCACert(HOME_CA).' },
        { check: 'deviceEncrypted', fail: 'Αιτία: βρέθηκαν {n} πακέτα MQTT της συσκευής σε απλό κείμενο (ή κανένα TLS). Διόρθωση: θύρα 8883 και mqtt.setCACert(HOME_CA) πριν από το connect.' }]
    },
    wrongCert: {
      name: 'Ασφάλεια: πιστοποιητικό για λάθος όνομα → καμία σύνδεση',
      world: { cert: 'wrong-host' },
      script: [{ setup: true }, { ms: 12000 },
        { check: 'mqttConnected', is: false, fail: 'Αιτία: ο broker έδειξε πιστοποιητικό για printer.home.lan και η συσκευή συνδέθηκε παρ’ όλα αυτά. Αποτέλεσμα: η συσκευή θα μιλούσε με όποιον παρουσίαζε οποιοδήποτε πιστοποιητικό. Διόρθωση: mqtt.setCACert(HOME_CA), ποτέ mqtt.setInsecure().' },
        { check: 'published', topic: 'home/temperature', is: 0, fail: 'Αιτία: στάλθηκαν {n} μετρήσεις παρόλο που το πιστοποιητικό ήταν λάθος. Διόρθωση: έλεγχος πιστοποιητικού με mqtt.setCACert(HOME_CA).' },
        { check: 'mqttAttempts', max: 7, fail: 'Αιτία: {n} προσπάθειες σύνδεσης MQTT σε 12 s. Αποτέλεσμα: άσκοπο φορτίο στον broker. Διόρθωση: περίμενε 2000 ms ανάμεσα στις προσπάθειες.' }]
    },
    badReading: {
      name: 'Ασφάλεια: άκυρη μέτρηση δεν στέλνεται',
      world: { sensorFault: true },
      script: [...ONLINE, { ms: 9000 },
        { check: 'published', topic: 'home/temperature', is: 0, fail: 'Αιτία: με χαλασμένο αισθητήρα στάλθηκαν {n} μετρήσεις ({v}). Αποτέλεσμα: το dashboard δείχνει «nan» ή ψεύτικες τιμές. Διόρθωση: if (isnan(t) || t < -20 || t > 60) → «Sensor error: reading ignored» και return;' },
        { check: 'serialHas', text: 'Sensor error', fail: 'Αιτία: η άκυρη μέτρηση δεν καταγράφηκε στο Serial. Διόρθωση: τύπωσε «Sensor error: reading ignored».' },
        { set: { sensorFault: false, temp: 85 } }, { ms: 10000 },
        { check: 'published', topic: 'home/temperature', is: 0, fail: 'Αιτία: στάλθηκε μέτρηση 85 °C, εκτός ορίων −20..60. Διόρθωση: πρόσθεσε έλεγχο ορίων.' },
        { set: { temp: 23 } }, { ms: 10000 },
        { check: 'published', topic: 'home/temperature', json: { t: 23 }, min: 1, fail: 'Αιτία: όταν ο αισθητήρας έγινε ξανά κανονικός, δεν στάλθηκε μέτρηση. Διόρθωση: ο έλεγχος πρέπει να απορρίπτει μόνο την άκυρη μέτρηση, όχι όλες τις επόμενες.' }]
    },
    unknownCmd: {
      name: 'Ασφάλεια: άγνωστη ή κακοσχηματισμένη εντολή δεν αλλάζει τίποτα',
      script: [...ONLINE,
        { dash: { topic: 'home/led/set', payload: '{"cmd":"BLINK","id":1}' } }, { loops: 1 },
        { dash: { topic: 'home/led/set', payload: '{cmd:ON}' } }, { loops: 1 },
        { dash: { topic: 'home/led/set', payload: '{"cmd":"ON"}' } }, { loops: 1 },
        { check: 'led', is: false, fail: 'Αιτία: μια άγνωστη ή κακοσχηματισμένη εντολή άναψε τη λάμπα. Αποτέλεσμα: η συσκευή εκτελεί ό,τι δεν καταλαβαίνει. Διόρθωση: allowlist μόνο "ON"/"OFF", όλα τα άλλα → «Rejected: unknown cmd».' },
        { check: 'serialHas', text: 'Rejected: unknown cmd', fail: 'Αιτία: δεν καταγράφηκε «Rejected: unknown cmd». Διόρθωση: στο τελικό else τύπωσε «Rejected: unknown cmd».' },
        { check: 'serialHas', text: 'Rejected: bad json', fail: 'Αιτία: δεν καταγράφηκε «Rejected: bad json». Διόρθωση: έλεγξε jsonValid(p) πρώτα.' },
        cmd('ON', 2), { loops: 1 }, { redeliver: true }, { loops: 1 },
        { check: 'count', text: 'Accepted: ON', is: 1, fail: 'Αιτία: η ίδια εντολή εκτελέστηκε {n} φορές μετά από διπλή παράδοση. Διόρθωση: απόρριψε id <= lastId.' }]
    },
    topicAcl: {
      name: 'Ασφάλεια: μη επιτρεπόμενο topic και άγνωστη συσκευή',
      script: [...ONLINE,
        { act: tlsConn('esp32-temp', PASS.temp) },
        { act: { publish: 'esp32-temp', topic: 'home/led/set', payload: '{"cmd":"ON","id":50}' } },
        { act: { connect: 'unknown-device', port: 8883, tls: true } },
        { act: { publish: 'unknown-device', topic: 'home/led/set', payload: '{"cmd":"ON","id":51}' } },
        { loops: 2 },
        { check: 'led', is: false, fail: 'Αιτία: η λάμπα άναψε από εντολή που ΔΕΝ έστειλε το dashboard (λάμπα {v}). Διόρθωση: στον broker μόνο ο dashboard έχει topic write home/led/set, και allow_anonymous false.' },
        { check: 'mqttConnected', is: true, fail: 'Αιτία: η συσκευή δεν είναι συνδεδεμένη ({v}), άρα ο έλεγχος δεν είναι έγκυρος. Διόρθωση: πρώτα να περνά το «Λειτουργία: η συσκευή συνδέεται».' }]
    },
    secrets: {
      name: 'Ασφάλεια: καταγραφές και κώδικας χωρίς μυστικά',
      script: [...ONLINE, { router: false }, { ms: 6000 }, { router: true }, { ms: 8000 },
        { check: 'serialNot', text: PASS.hall, fail: 'Αιτία: ο κωδικός MQTT εμφανίζεται στο Serial Monitor. Αποτέλεσμα: όποιος δει ή αντιγράψει τα logs, μαθαίνει τον κωδικό. Διόρθωση: σβήσε κάθε Serial.print που περιέχει MQTT_PASS. Γράψε στο log μόνο το όνομα χρήστη ή «MQTT connected».' },
        { check: 'sourceNot', text: PASS.hall, fail: 'Αιτία: ο κωδικός είναι γραμμένος μέσα στον κώδικα. Διόρθωση: χρησιμοποίησε τη σταθερά MQTT_PASS από το αρχείο μυστικών.' },
        { check: 'mqttConnected', is: true, fail: 'Αιτία: η συσκευή δεν συνδέθηκε ({v}). Διόρθωση: πρώτα να περνούν τα tests «Λειτουργία».' }]
    },
    backoff: {
      name: 'Ασφάλεια: επανασύνδεση WiFi με αναμονή',
      script: [...ONLINE, { router: false }, { ms: 20000 },
        { check: 'wifiAttempts', min: 3, max: 6, fail: 'Αιτία: σε 20 s χωρίς router έγιναν {n} συνολικές προσπάθειες WiFi (περίμενα 3–6). Λίγες = δεν ξαναδοκιμάζει. Πολλές = φορτώνει το δίκτυο. Διόρθωση: WiFi.reconnect() μία φορά κάθε 5000 ms.' }]
    }
  };

  const AUDIT = [T.connect, T.motion, T.temp, T.commands, T.wifiLoss, T.brokerRestart, T.tls, T.wrongCert, T.badReading, T.unknownCmd, T.topicAcl, T.secrets, T.backoff];

  const lessons = [
    // ------------------------------------------------------------ 15.1
    {
      id: 'c15-l1', chapter: 15, kind: 'guided', skills: ['security', 'mqtt'],
      mode: 'config',
      title: 'Ο τελικός broker του σπιτιού',
      prerequisites: [],
      objectives: ['Να γράφω πλήρη ρύθμιση broker: μόνο TLS, χωρίς ανώνυμους, μοναδικές ταυτότητες, ACL με default deny.', 'Να ελέγχω χωριστά τη λειτουργία και την ασφάλεια.'],
      theory: `
<p>Στο τελικό έργο ενώνεις όλα όσα έμαθες σε ένα μικρό έξυπνο σπίτι:</p>
<ul>
  <li><code>esp32-hall</code>: ο κόμβος του διαδρόμου (PIR, θερμοκρασία, λάμπα). Θα γράψεις το firmware του στο επόμενο μάθημα.</li>
  <li><code>esp32-temp</code>: εξωτερικός αισθητήρας θερμοκρασίας.</li>
  <li><code>dashboard</code>: βλέπει τα πάντα στο <code>home/#</code> και στέλνει εντολές στη λάμπα.</li>
</ul>
<p>Πρώτα ο broker. Ο κανόνας είναι <strong>ό,τι δεν επιτρέπεται ρητά, απαγορεύεται</strong>:</p>
<ol>
  <li>Μόνο <code>listener 8883</code> με <code>tls on</code>.</li>
  <li><code>allow_anonymous false</code>.</li>
  <li>Μία γραμμή <code>password</code> για κάθε συσκευή (<strong>μοναδική ταυτότητα</strong>).</li>
  <li><code>acl_default deny</code> και, για κάθε χρήστη, μόνο τα topics που χρειάζεται.</li>
</ol>
<p>Τα tests έχουν δύο ομάδες: <strong>Λειτουργία</strong> (οι συσκευές κάνουν τη δουλειά τους) και <strong>Ασφάλεια</strong> (ό,τι δεν χρειάζεται είναι κλειστό). Χρειάζονται και οι δύο.</p>`,
      glossary: ['μοναδική ταυτότητα', 'ελάχιστη έκθεση', 'audit'],
      supportedSyntax: SYNTAX_CFG,
      initialCode: L1_INITIAL,
      solution: FINAL_BROKER,
      initialWorld: {},
      world: { cert: 'valid' },
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τα κενά ____ : θύρα, ανώνυμοι, default του ACL και η πρόσβαση της λάμπας στο home/led/set.',
        'Γράψε τον κανόνα του esp32-temp κάτω από το σχόλιο ΣΥΜΠΛΗΡΩΣΕ.',
        'Πάτησε «Έλεγχος λύσης». Διάβασε χωριστά τα tests «Λειτουργία» και «Ασφάλεια».'
      ],
      quiz: {
        question: 'Το esp32-hall πρέπει να ΔΙΑΒΑΖΕΙ εντολές από το home/led/set. Ποιος κανόνας χρειάζεται;',
        options: ['topic read home/led/set', 'topic write home/led/set', 'topic readwrite home/#'],
        answer: 0,
        explain: 'Σωστά. Η συσκευή μόνο διαβάζει εντολές. Μόνο το dashboard γράφει στο home/led/set.',
        retry: 'Όχι ακόμα. Ποιος στέλνει τις εντολές και ποιος τις λαμβάνει;'
      },
      hints: [
        'Θυμήσου το Κεφάλαιο 11 (TLS στη θύρα 8883) και το Κεφάλαιο 12 (ACL με default deny).',
        'Τα κενά είναι: ένας αριθμός θύρας, true ή false, allow ή deny, read ή write. Το esp32-temp μόνο γράφει τη μέτρησή του.',
        'listener 8883\ntls on\nallow_anonymous false\n…\nacl_default deny\n…\ntopic read home/led/set\nuser esp32-temp\ntopic write home/outdoor/temperature'
      ],
      validationTests: [
        {
          name: 'Λειτουργία: το esp32-hall συνδέεται και κάνει τη δουλειά του',
          script: [
            tlsConn('esp32-hall', PASS.hall, { expect: 'allow', fail: 'Αιτία: το esp32-hall δεν συνδέθηκε με TLS στη θύρα 8883 ({v}). Διόρθωση: listener 8883, tls on και η γραμμή password esp32-hall.' }),
            { publish: 'esp32-hall', topic: 'home/motion', payload: '{"motion":true}', expect: 'allow', fail: 'Αιτία: το esp32-hall δεν γράφει στο home/motion ({v}). Διόρθωση: κράτα topic write home/motion.' },
            { publish: 'esp32-hall', topic: 'home/temperature', payload: '{"t":22.50}', expect: 'allow', fail: 'Αιτία: το esp32-hall δεν γράφει στο home/temperature ({v}).' },
            { publish: 'esp32-hall', topic: 'home/led/state', payload: 'ON', expect: 'allow', fail: 'Αιτία: το esp32-hall δεν γράφει στο home/led/state ({v}).' },
            { subscribe: 'esp32-hall', topic: 'home/led/set', expect: 'allow', fail: 'Αιτία: το esp32-hall δεν διαβάζει το home/led/set ({v}). Αποτέλεσμα: η λάμπα δεν παίρνει εντολές. Διόρθωση: topic read home/led/set.' }
          ]
        },
        {
          name: 'Λειτουργία: ο εξωτερικός αισθητήρας στέλνει μέτρηση',
          script: [
            tlsConn('esp32-temp', PASS.temp, { expect: 'allow', fail: 'Αιτία: το esp32-temp δεν συνδέθηκε ({v}).' }),
            { publish: 'esp32-temp', topic: 'home/outdoor/temperature', payload: '{"t":14.20}', expect: 'allow', fail: 'Αιτία: το esp32-temp δεν γράφει στο home/outdoor/temperature ({v}). Διόρθωση: κάτω από user esp32-temp γράψε topic write home/outdoor/temperature.' }
          ]
        },
        {
          name: 'Λειτουργία: το dashboard βλέπει τα πάντα και στέλνει εντολές',
          script: [
            tlsConn('dashboard', PASS.dash, { expect: 'allow', fail: 'Αιτία: το dashboard δεν συνδέθηκε ({v}).' }),
            { subscribe: 'dashboard', topic: 'home/#', expect: 'allow', fail: 'Αιτία: το dashboard δεν διαβάζει το home/# ({v}).' },
            { publish: 'dashboard', topic: 'home/led/set', payload: '{"cmd":"ON","id":1}', expect: 'allow', fail: 'Αιτία: το dashboard δεν στέλνει εντολές ({v}).' }
          ]
        },
        {
          name: 'Ασφάλεια: καμία σύνδεση χωρίς TLS ή χωρίς στοιχεία',
          script: [
            { connect: 'esp32-hall', user: 'esp32-hall', pass: PASS.hall, port: 1883, expect: 'deny', fail: 'Αιτία: το esp32-hall συνδέθηκε στη θύρα 1883 χωρίς TLS. Αποτέλεσμα: ο κωδικός θα ταξίδευε ως απλό κείμενο. Διόρθωση: μόνο listener 8883 με tls on.' },
            { connect: 'unknown-device', port: 8883, tls: true, expect: 'deny', fail: 'Αιτία: μια άγνωστη συσκευή χωρίς στοιχεία συνδέθηκε. Διόρθωση: allow_anonymous false.' }
          ]
        },
        {
          name: 'Ασφάλεια: μοναδικές ταυτότητες',
          script: [
            { connect: 'esp32-temp', user: 'esp32-hall', pass: PASS.temp, port: 8883, tls: true, expect: 'deny', fail: 'Αιτία: ο κωδικός του esp32-temp δέχτηκε σύνδεση ως esp32-hall. Διόρθωση: κάθε χρήστης έχει τον δικό του κωδικό.' }
          ]
        },
        {
          name: 'Ασφάλεια: κάθε συσκευή μόνο στα δικά της topics',
          script: [
            tlsConn('esp32-temp', PASS.temp),
            { publish: 'esp32-temp', topic: 'home/led/set', payload: '{"cmd":"ON","id":9}', expect: 'deny', fail: 'Αιτία: το esp32-temp μπορεί να στείλει εντολή στη λάμπα. Διόρθωση: ο esp32-temp χρειάζεται μόνο topic write home/outdoor/temperature.' },
            tlsConn('esp32-hall', PASS.hall),
            { subscribe: 'esp32-hall', topic: 'home/#', expect: 'deny', fail: 'Αιτία: το esp32-hall μπορεί να διαβάσει όλο το home/#. Διόρθωση: μόνο topic read home/led/set.' },
            { publish: 'esp32-hall', topic: 'home/led/set', payload: '{"cmd":"ON","id":9}', expect: 'deny', fail: 'Αιτία: το esp32-hall μπορεί να γράψει εντολές στον εαυτό του. Διόρθωση: για το home/led/set χρειάζεται μόνο read.' },
            tlsConn('dashboard', PASS.dash),
            { publish: 'dashboard', topic: 'home/motion', payload: '{"motion":true}', expect: 'deny', fail: 'Αιτία: το dashboard μπορεί να γράψει ψεύτικη κίνηση. Διόρθωση: για το dashboard μόνο topic read home/# και topic write home/led/set.' }
          ]
        }
      ],
      explanationOnSuccess: 'Ο broker είναι έτοιμος: ένας listener με TLS, κανένας ανώνυμος, μία ταυτότητα ανά συσκευή και ACL με default deny. Και οι τρεις συσκευές λειτουργούν κανονικά. Στο επόμενο μάθημα γράφεις το firmware του esp32-hall.',
      remediation: 'Αν αποτυγχάνει ένα test «Λειτουργία», μάλλον έκλεισες κάτι που χρειάζεται. Αν αποτυγχάνει ένα test «Ασφάλεια», κάτι έμεινε ανοιχτό. Διάβασε την αιτία στο μήνυμα.'
    },

    // ------------------------------------------------------------ 15.2
    {
      id: 'c15-l2', chapter: 15, kind: 'independent', skills: ['mqtt', 'network', 'sensors', 'security', 'state'],
      title: 'Το firmware του κόμβου διαδρόμου',
      prerequisites: ['c15-l1'],
      objectives: ['Να ενώνω PIR, θερμοκρασία, λάμπα, WiFi και MQTT σε ένα πρόγραμμα.', 'Να γράφω επανασύνδεση με αναμονή.', 'Να στέλνω μόνο έγκυρες μετρήσεις και να εκτελώ μόνο επιτρεπτές εντολές.'],
      theory: `
<p>Ο κώδικας είναι σχεδόν έτοιμος. Κάθε κομμάτι το έχεις γράψει σε προηγούμενο κεφάλαιο. Λείπουν <strong>τέσσερα TODO</strong>:</p>
<ol>
  <li><strong>TLS με έλεγχο πιστοποιητικού</strong> (Κεφ. 11): <code>mqtt.setCACert(HOME_CA);</code></li>
  <li><strong>Επανασύνδεση WiFi με αναμονή</strong> (Κεφ. 8): <code>WiFi.reconnect()</code> μία φορά κάθε 5 s, όχι σε κάθε loop.</li>
  <li><strong>Έλεγχος μέτρησης</strong> (Κεφ. 5): <code>isnan(t)</code> και όρια −20..60 °C.</li>
  <li><strong>Allowlist εντολών</strong> (Κεφ. 13): μόνο <code>ON</code> και <code>OFF</code>.</li>
</ol>
<p>Η ροή του <code>loop()</code>:</p>
<pre>αν ensureConnection():
  διάβασε εντολές → έλεγξε → εκτέλεσε
  έλεγξε την κίνηση (μόνο αλλαγές)
  κάθε 10 s: μέτρηση θερμοκρασίας
delay(50)</pre>
<p>Ο broker του κόσμου είναι αυτός που έγραψες στο 15.1. Τα στοιχεία σύνδεσης βρίσκονται στις σταθερές <code>MQTT_USER</code> και <code>MQTT_PASS</code> (από ξεχωριστό αρχείο μυστικών). Μην τα γράφεις ποτέ στο Serial.</p>`,
      glossary: ['επανασύνδεση με αναμονή', 'allowlist', 'μοναδική ταυτότητα'],
      supportedSyntax: SYNTAX_FW,
      initialCode: L2_INITIAL,
      solution: FINAL_FW,
      initialWorld: { pir: false },
      world: WORLD_FINAL,
      hardware: HW,
      panels: PANELS,
      steps: [
        'Διάβασε όλο τον κώδικα. Βρες τα TODO 1–4.',
        'Γράψε κάθε TODO και τρέξε. Δες στο Serial ότι εμφανίζεται «MQTT connected».',
        'Δοκίμασε με το χέρι: κίνηση, σφάλμα αισθητήρα, router κάτω/πάνω, εντολή από το dashboard.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το router πέφτει για 20 s. Πόσες φορές πρέπει περίπου να καλέσει η συσκευή WiFi.reconnect();',
        options: ['Περίπου 4 (μία κάθε 5 s)', 'Σε κάθε loop, δηλαδή εκατοντάδες', 'Καμία· περιμένει επανεκκίνηση'],
        answer: 0,
        explain: 'Σωστά. Η συσκευή ξαναδοκιμάζει, αλλά με αναμονή. Αν δοκίμαζε σε κάθε loop, κάθε προσπάθεια θα έκοβε την προηγούμενη πριν προλάβει να ολοκληρωθεί.',
        retry: 'Όχι ακόμα. Ξαναδιάβασε το TODO 2: πόσο περιμένει ανάμεσα στις προσπάθειες;'
      },
      hints: [
        'Κάθε TODO αντιστοιχεί σε ένα κεφάλαιο: 11 (TLS), 8 (επανασύνδεση), 5 (μετρήσεις), 13 (allowlist).',
        'TODO 1 είναι μία γραμμή στο setup(). TODO 2 είναι ένα if με millis() - lastWifiTry >= 5000. TODO 3 είναι ένα if με isnan και όρια, που τελειώνει με return;. TODO 4 είναι if / else γύρω από το applyCommand.',
        'TODO 1: mqtt.setCACert(HOME_CA);\nTODO 2:\nif (millis() - lastWifiTry >= 5000) {\n  Serial.println("WiFi down, retrying");\n  WiFi.reconnect();\n  lastWifiTry = millis();\n}\nTODO 3:\nif (isnan(t) || t < -20 || t > 60) {\n  Serial.println("Sensor error: reading ignored");\n  return;\n}\nTODO 4:\nif (cmd == "ON" || cmd == "OFF") {\n  applyCommand(cmd);\n  lastId = id;\n} else {\n  Serial.println("Rejected: unknown cmd");\n}'
      ],
      validationTests: [T.connect, T.motion, T.temp, T.commands, T.wifiLoss, T.tls, T.badReading, T.unknownCmd, T.secrets, T.backoff],
      explanationOnSuccess: 'Ο κόμβος διαδρόμου λειτουργεί: στέλνει κίνηση και θερμοκρασία, εκτελεί εντολές, και αντέχει απώλεια WiFi. Στο τελευταίο μάθημα θα κάνεις audit σε μια άλλη έκδοση του ίδιου κώδικα.',
      remediation: 'Αν δεν βλέπεις «MQTT connected», ξεκίνα από το TODO 1: χωρίς TLS η θύρα 8883 δεν δέχεται τη σύνδεση. Το μήνυμα στο Network Monitor λέει γιατί.'
    },

    // ------------------------------------------------------------ 15.3
    {
      id: 'c15-l3', chapter: 15, kind: 'checkpoint', skills: ['security', 'mqtt', 'network', 'analysis'],
      title: 'Τελικό audit: λειτουργία και ασφάλεια',
      prerequisites: ['c15-l2'],
      objectives: ['Να εκτελώ ένα audit με χωριστούς ελέγχους λειτουργίας και ασφάλειας.', 'Να διαβάζω κάθε αποτυχία ως αιτία → αποτέλεσμα → διορθωτικό βήμα.', 'Να γνωρίζω τα όρια ενός audit σε εκπαιδευτικό μοντέλο.'],
      theory: `
<p>Αυτή είναι μια παλιότερη έκδοση του firmware. «Δουλεύει» στην πρώτη ματιά: συνδέεται, ανάβει τη λάμπα, στέλνει μετρήσεις. Όμως το <strong>audit</strong> ελέγχει περισσότερα σενάρια:</p>
<ul>
  <li><strong>Λειτουργία:</strong> σύνδεση, κίνηση, θερμοκρασία, εντολές, απώλεια WiFi, επανεκκίνηση broker.</li>
  <li><strong>Ασφάλεια:</strong> TLS με έλεγχο, πιστοποιητικό για λάθος όνομα, άκυρη μέτρηση, άγνωστη εντολή, μη επιτρεπόμενο topic, μυστικά στα logs, επανασύνδεση με αναμονή.</li>
</ul>
<p>Κάθε μήνυμα αποτυχίας γράφει <strong>αιτία</strong>, <strong>αποτέλεσμα</strong> και <strong>διορθωτικό βήμα</strong>. Διόρθωσε ένα-ένα και ξανατρέξε.</p>
<p><strong>Όριο του audit:</strong> ελέγχει μια λίστα σεναρίων μέσα σε αυτό το εικονικό μοντέλο. Δεν αποδεικνύει ότι ένα πραγματικό σύστημα είναι ασφαλές. Το πραγματικό TLS, οι πραγματικές συσκευές και τα πραγματικά δίκτυα έχουν πολύ περισσότερες λεπτομέρειες.</p>`,
      glossary: ['audit', 'επανασύνδεση με αναμονή', 'redaction'],
      supportedSyntax: SYNTAX_FW,
      initialCode: L3_INITIAL,
      solution: FINAL_FW,
      initialWorld: { pir: false },
      world: WORLD_FINAL,
      hardware: HW,
      panels: PANELS,
      steps: [
        'Πάτησε «Έλεγχος λύσης» πρώτα, για να δεις ποια tests αποτυγχάνουν.',
        'Ξεκίνα από τα tests «Ασφάλεια: TLS…» και «Ασφάλεια: καταγραφές…». Διάβασε αιτία και διορθωτικό βήμα.',
        'Συνέχισε με την επανασύνδεση (WiFi και MQTT), τη μέτρηση και τις εντολές.',
        'Μετά από κάθε διόρθωση, ξανατρέξε τον έλεγχο. Ένα πράσινο test δεν πρέπει να γίνει κόκκινο.',
        'Απάντησε στην ερώτηση.'
      ],
      quiz: {
        question: 'Όλα τα tests του audit πέρασαν. Τι σημαίνει αυτό;',
        options: [
          'Ότι το εικονικό σύστημα περνά τη λίστα ελέγχου αυτού του μοντέλου. Δεν είναι απόδειξη ότι ένα πραγματικό σύστημα είναι ασφαλές.',
          'Ότι το σπίτι είναι πλέον εντελώς ασφαλές και δεν χρειάζεται ξανά έλεγχο',
          'Ότι μπορώ να βάλω αυτόν τον κώδικα όπως είναι σε πραγματικά σπίτια'
        ],
        answer: 0,
        explain: 'Σωστά. Ένα audit ελέγχει ό,τι περιλαμβάνει η λίστα του. Τα πραγματικά συστήματα χρειάζονται συνεχή παρακολούθηση, ενημερώσεις και έλεγχο από ειδικούς.',
        retry: 'Όχι ακόμα. Ξαναδιάβασε την παράγραφο «Όριο του audit».'
      },
      hints: [
        'Τα προβλήματα είναι έξι: TLS, μυστικό στο log, επανασύνδεση WiFi, subscribe μετά από επανασύνδεση, έλεγχος μέτρησης, allowlist.',
        'Κοίτα: setInsecure στο setup(), το Serial.println με MQTT_PASS, το ensureConnection() όταν δεν υπάρχει WiFi, τη μεταβλητή subscribed, το sendTemperature() και το else στο handleCommand().',
        'Η λύση μοιάζει με το firmware του 15.2:\n• mqtt.setCACert(HOME_CA); αντί για setInsecure\n• σβήσε το println με MQTT_PASS\n• WiFi.reconnect() κάθε 5000 ms με lastWifiTry\n• mqtt.subscribe("home/led/set") μετά από ΚΑΘΕ connect\n• if (isnan(t) || t < -20 || t > 60) { … return; }\n• if (cmd == "ON" || cmd == "OFF") { … } else { Serial.println("Rejected: unknown cmd"); }'
      ],
      validationTests: AUDIT,
      explanationOnSuccess: 'Συγχαρητήρια, ολοκλήρωσες το IoT Guardian! Έστησες ένα εικονικό έξυπνο σπίτι με ελεγχόμενα payloads, μοναδικές ταυτότητες, ACL, μοντελοποιημένο TLS, επανασύνδεση με αναμονή και καταγραφές χωρίς μυστικά, και πέρασες το audit. Αυτό είναι εκπαιδευτική ολοκλήρωση: δεν αποτελεί επαγγελματική πιστοποίηση και δεν σημαίνει ότι ο κώδικας είναι έτοιμος για πραγματική χρήση (production). Το επόμενο βήμα σε πραγματικό υλικό είναι να μάθεις πώς δουλεύουν στην πράξη το TLS, η αποθήκευση μυστικών και οι ενημερώσεις firmware, με την καθοδήγηση κάποιου έμπειρου.',
      remediation: 'Αν μια διόρθωση χάλασε ένα test που περνούσε, γύρνα ένα βήμα πίσω. Διόρθωνε ένα πρόβλημα κάθε φορά και ξανατρέχε τον έλεγχο.'
    }
  ];

  lessons.forEach(l => L.lessons.push(l));
})(typeof window !== 'undefined' ? window : globalThis);
