/*
 * IoT Guardian — Κεφάλαιο 13: Ασφαλής λογική εφαρμογής.
 * Η συσκευή (esp32-lamp) δέχεται εντολές από το dashboard στο home/led/set
 * και ελέγχει κάθε εντολή πριν την εκτελέσει: μορφή, allowlist, command ID, λήξη.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 13).ready = true;

  [
    { term: 'allowlist', def: 'Λίστα με ό,τι επιτρέπεται ρητά, π.χ. μόνο οι εντολές ON και OFF. Ό,τι δεν είναι στη λίστα απορρίπτεται. Είναι πιο ασφαλές από το να απαριθμείς τι απαγορεύεται.' },
    { term: 'έλεγχος εισόδου (validation)', def: 'Έλεγχος ενός μηνύματος πριν χρησιμοποιηθεί: σωστή μορφή, σωστός τύπος, τιμή μέσα σε όρια. Αν κάτι δεν ταιριάζει, το μήνυμα απορρίπτεται και καταγράφεται.' },
    { term: 'command ID', def: 'Αριθμός που συνοδεύει κάθε εντολή. Ο αποστολέας τον αυξάνει κάθε φορά. Η συσκευή θυμάται το τελευταίο ID που δέχτηκε και απορρίπτει ίδιο ή παλαιότερο ID, ώστε μια εντολή να μην εκτελεστεί δύο φορές.' },
    { term: 'λήξη εντολής (expiry)', def: 'Χρονικό όριο μέσα στο payload (π.χ. "exp":5000). Αν η εντολή φτάσει μετά το όριο, απορρίπτεται. Λειτουργεί σωστά μόνο αν αποστολέας και συσκευή έχουν συγχρονισμένο ρολόι.' },
    { term: 'millis', def: 'Επιστρέφει πόσα χιλιοστά του δευτερολέπτου πέρασαν από την εκκίνηση της πλακέτας. Στην προσομοίωση μετρά τον εικονικό χρόνο.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX_C13 = 'όλα των προηγούμενων κεφαλαίων, void συναρτήσεις με return;, else if, mqtt.read / topic / payload, jsonValid, jsonHas, jsonGet, toInt, millis()';

  // Broker του κεφαλαίου: TLS, χωρίς ανώνυμους, ACL ανά χρήστη (όπως τα κεφ. 10–12).
  const BROKER_C13 = [
    'listener 8883',
    'tls on',
    'allow_anonymous false',
    'password esp32-lamp Lamp-Lab-Key-2026',
    'password dashboard Dash-Lab-Key-2026',
    'acl_default deny',
    'user esp32-lamp',
    'topic read home/led/set',
    'topic write home/led/state',
    'user dashboard',
    'topic read home/#',
    'topic write home/led/set',
    ''
  ].join('\n');

  const WORLD_C13 = {
    wifi: 'connected',
    broker: BROKER_C13,
    cert: 'valid',
    clients: [{ name: 'dashboard', subs: ['home/#'], user: 'dashboard', pass: 'Dash-Lab-Key-2026', port: 8883, tls: true }],
    consts: { MQTT_USER: 'esp32-lamp', MQTT_PASS: 'Lamp-Lab-Key-2026' }
  };

  const HW = ['broker'];
  const PANELS = ['serial', 'vars', 'branch', 'mqtt', 'net'];

  // Κοινά κομμάτια κώδικα
  const SETUP = `void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  mqtt.setServer(MQTT_HOST, 8883);
  mqtt.setCACert(HOME_CA);
  if (mqtt.connect("esp32-lamp", MQTT_USER, MQTT_PASS)) {
    mqtt.subscribe("home/led/set");
    Serial.println("MQTT connected");
  }
}
`;

  const LOOP = `void loop() {
  while (mqtt.read()) {
    if (mqtt.topic() == "home/led/set") {
      handleCommand(mqtt.payload());
    }
  }
  delay(10);
}
`;

  const ACT = `// Εκτελεί μια εντολή που έχει ήδη ελεγχθεί.
void applyCommand(String cmd) {
  if (cmd == "ON") {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
  mqtt.publish("home/led/state", cmd);
  Serial.println("Accepted: " + cmd);
}
`;

  // ---------------------------------------------------------------- Βοηθοί για tests
  const dash = p => ({ dash: { topic: 'home/led/set', payload: p } });
  const send = p => [dash(p), { loops: 1 }];
  const START = [{ setup: true }, { loops: 1 }];

  const BASIC_TESTS = [
    {
      name: 'Το {"cmd":"ON"} ανάβει τη λάμπα και ενημερώνει το dashboard',
      script: [...START, ...send('{"cmd":"ON"}'),
        { check: 'led', is: true, fail: 'Το dashboard έστειλε {"cmd":"ON"} και η λάμπα είναι {v}. Έλεγξε τη διαδρομή: έγκυρο JSON → cmd == "ON" → applyCommand.' },
        { check: 'dashboard', topic: 'home/led/state', payload: 'ON', fail: 'Το dashboard βλέπει στο home/led/state: {v}. Περίμενα «ON».' },
        { check: 'count', text: 'Accepted: ON', is: 1, fail: 'Η γραμμή «Accepted: ON» τυπώθηκε {n} φορές. Κάθε εντολή που εκτελείται πρέπει να αφήνει μία γραμμή καταγραφής.' }]
    },
    {
      name: 'Το {"cmd":"OFF"} σβήνει τη λάμπα',
      script: [...START, ...send('{"cmd":"ON"}'), ...send('{"cmd":"OFF"}'),
        { check: 'led', is: false, fail: 'Μετά το {"cmd":"OFF"} η λάμπα είναι {v}.' },
        { check: 'dashboard', topic: 'home/led/state', payload: 'OFF', fail: 'Το dashboard βλέπει στο home/led/state: {v}. Περίμενα «OFF».' }]
    },
    {
      name: 'Άγνωστη εντολή → απορρίπτεται και η λάμπα δεν αλλάζει',
      script: [...START,
        ...send('{"cmd":"ON"}'), ...send('{"cmd":"BLINK"}'),
        { check: 'led', is: true, fail: 'Η λάμπα ήταν αναμμένη. Μετά το {"cmd":"BLINK"} είναι {v}. Μια άγνωστη εντολή δεν πρέπει να αλλάζει τίποτα.' },
        ...send('{"cmd":"OFF"}'), ...send('{"cmd":"on"}'),
        { check: 'led', is: false, fail: 'Η λάμπα ήταν σβηστή. Μετά το {"cmd":"on"} (με πεζά) είναι {v}. Η allowlist δέχεται ακριβώς "ON" και "OFF".' },
        ...send('{"cmd":1}'), ...send('{"mode":"ON"}'),
        { check: 'led', is: false, fail: 'Μετά από {"cmd":1} ή {"mode":"ON"} η λάμπα είναι {v}. Λάθος τύπος ή κλειδί που λείπει = άγνωστη εντολή.' },
        { check: 'count', text: 'Rejected: unknown cmd', is: 4, fail: 'Η γραμμή «Rejected: unknown cmd» τυπώθηκε {n} φορές. Περίμενα 4 (BLINK, on, 1, χωρίς cmd).' }]
    }
  ];

  const JSON_TEST = {
    name: 'Κακοσχηματισμένο JSON → «Rejected: bad json»',
    script: [...START, ...send('{cmd:ON}'), ...send('ON'),
      { check: 'led', is: false, fail: 'Μετά από μη έγκυρο JSON η λάμπα είναι {v}. Ένα χαλασμένο μήνυμα δεν πρέπει να εκτελείται.' },
      { check: 'count', text: 'Rejected: bad json', is: 2, fail: 'Η γραμμή «Rejected: bad json» τυπώθηκε {n} φορές. Περίμενα 2 (για {cmd:ON} και για σκέτο ON).' }]
  };

  // ---------------------------------------------------------------- Κώδικας ανά μάθημα

  const L1_INITIAL = `// Λάμπα σαλονιού: δέχεται εντολές από το dashboard.
${SETUP}
${ACT}
// Ελέγχει ένα μήνυμα από το home/led/set.
void handleCommand(String p) {
  // 1. Μορφή: πρέπει να είναι έγκυρο JSON.
  if (____) {                       // ΣΥΜΠΛΗΡΩΣΕ: «αν ΔΕΝ είναι έγκυρο JSON»
    Serial.println("Rejected: bad json");
    return;                         // σταμάτα εδώ, μην εκτελέσεις τίποτα
  }

  // 2. Allowlist: δεχόμαστε ΜΟΝΟ "ON" ή "OFF".
  String cmd = jsonGet(p, "cmd");
  if (cmd == "ON") {
    applyCommand(cmd);
  } else if (cmd == ____) {         // ΣΥΜΠΛΗΡΩΣΕ τη δεύτερη επιτρεπτή εντολή
    applyCommand(cmd);
  } else {
    Serial.println("Rejected: unknown cmd");
  }
}

${LOOP}`;

  const HANDLE_L1 = `// Ελέγχει ένα μήνυμα από το home/led/set.
void handleCommand(String p) {
  // 1. Μορφή: πρέπει να είναι έγκυρο JSON.
  if (!jsonValid(p)) {
    Serial.println("Rejected: bad json");
    return;
  }

  // 2. Allowlist: δεχόμαστε ΜΟΝΟ "ON" ή "OFF".
  String cmd = jsonGet(p, "cmd");
  if (cmd == "ON") {
    applyCommand(cmd);
  } else if (cmd == "OFF") {
    applyCommand(cmd);
  } else {
    Serial.println("Rejected: unknown cmd");
  }
}
`;

  const L1_SOLUTION = `// Λάμπα σαλονιού: δέχεται εντολές από το dashboard.
${SETUP}
${ACT}
${HANDLE_L1}
${LOOP}`;

  const L2_INITIAL = `// Λάμπα σαλονιού: μια παλιότερη εκδοχή του κώδικα.
${SETUP}
void handleCommand(String p) {
  if (!jsonValid(p)) {
    Serial.println("Rejected: bad json");
    return;
  }

  String cmd = jsonGet(p, "cmd");
  if (cmd == "OFF") {
    digitalWrite(LED_PIN, LOW);
    mqtt.publish("home/led/state", "OFF");
    Serial.println("Accepted: OFF");
  } else {
    digitalWrite(LED_PIN, HIGH);
    mqtt.publish("home/led/state", "ON");
    Serial.println("Accepted: ON");
  }
}

${LOOP}`;

  const L2_SOLUTION = `// Λάμπα σαλονιού: διορθωμένη εκδοχή.
${SETUP}
void handleCommand(String p) {
  if (!jsonValid(p)) {
    Serial.println("Rejected: bad json");
    return;
  }

  String cmd = jsonGet(p, "cmd");
  if (cmd == "OFF") {
    digitalWrite(LED_PIN, LOW);
    mqtt.publish("home/led/state", "OFF");
    Serial.println("Accepted: OFF");
  } else if (cmd == "ON") {
    digitalWrite(LED_PIN, HIGH);
    mqtt.publish("home/led/state", "ON");
    Serial.println("Accepted: ON");
  } else {
    Serial.println("Rejected: unknown cmd");
  }
}

${LOOP}`;

  const L3_INITIAL = `// Λάμπα σαλονιού: κάθε εντολή έχει πλέον αριθμό "id".
// Παράδειγμα: {"cmd":"ON","id":17}

int lastId = 0;   // το τελευταίο id που δεχτήκαμε

${SETUP}
${ACT}
void handleCommand(String p) {
  if (!jsonValid(p)) {
    Serial.println("Rejected: bad json");
    return;
  }

  // ΣΥΜΠΛΗΡΩΣΕ:
  // 1. Διάβασε το id. Αν λείπει ή είναι εκτός ορίων 1..1000000:
  //    τύπωσε "Rejected: bad id" και σταμάτα.
  // 2. Αν το id είναι ίδιο ή μικρότερο από το lastId:
  //    τύπωσε "Rejected: duplicate id" και σταμάτα.

  String cmd = jsonGet(p, "cmd");
  if (cmd == "ON" || cmd == "OFF") {
    applyCommand(cmd);
    // 3. ΣΥΜΠΛΗΡΩΣΕ: θυμήσου το id της εντολής που εκτελέστηκε.
  } else {
    Serial.println("Rejected: unknown cmd");
  }
}

${LOOP}`;

  const HANDLE_ID = `void handleCommand(String p) {
  if (!jsonValid(p)) {
    Serial.println("Rejected: bad json");
    return;
  }

  // Τύπος και όρια του id
  int id = toInt(jsonGet(p, "id"));
  if (!jsonHas(p, "id") || id < 1 || id > 1000000) {
    Serial.println("Rejected: bad id");
    return;
  }
  // Ίδιο ή παλαιότερο id → η εντολή έχει ήδη εκτελεστεί
  if (id <= lastId) {
    Serial.println("Rejected: duplicate id");
    return;
  }

  String cmd = jsonGet(p, "cmd");
  if (cmd == "ON" || cmd == "OFF") {
    applyCommand(cmd);
    lastId = id;     // μόνο μετά από επιτυχία
  } else {
    Serial.println("Rejected: unknown cmd");
  }
}
`;

  const L3_SOLUTION = `// Λάμπα σαλονιού: κάθε εντολή έχει πλέον αριθμό "id".
// Παράδειγμα: {"cmd":"ON","id":17}

int lastId = 0;   // το τελευταίο id που δεχτήκαμε

${SETUP}
${ACT}
${HANDLE_ID}
${LOOP}`;

  const L4_INITIAL = `// Λάμπα σαλονιού: κάθε εντολή έχει "id" και "exp" (λήξη).
// Παράδειγμα: {"cmd":"ON","id":17,"exp":5000}
// Η εντολή ισχύει μόνο όσο millis() <= exp.

int lastId = 0;

${SETUP}
${ACT}
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

  // ΣΥΜΠΛΗΡΩΣΕ τον έλεγχο λήξης εδώ (δες τα βήματα της άσκησης).

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

${LOOP}`;

  const HANDLE_FULL = `void handleCommand(String p) {
  // 1. Μορφή
  if (!jsonValid(p)) {
    Serial.println("Rejected: bad json");
    return;
  }

  // 2. Τύπος και όρια του id
  int id = toInt(jsonGet(p, "id"));
  if (!jsonHas(p, "id") || id < 1 || id > 1000000) {
    Serial.println("Rejected: bad id");
    return;
  }

  // 3. Τύπος και λήξη του exp
  int expiresAt = toInt(jsonGet(p, "exp"));
  if (!jsonHas(p, "exp") || expiresAt < 1) {
    Serial.println("Rejected: bad exp");
    return;
  }
  if (millis() > expiresAt) {
    Serial.println("Rejected: expired");
    return;
  }

  // 4. Διπλή ή παλιά εντολή
  if (id <= lastId) {
    Serial.println("Rejected: duplicate id");
    return;
  }

  // 5. Allowlist
  String cmd = jsonGet(p, "cmd");
  if (cmd == "ON" || cmd == "OFF") {
    applyCommand(cmd);
    lastId = id;
  } else {
    Serial.println("Rejected: unknown cmd");
  }
}
`;

  const L4_SOLUTION = `// Λάμπα σαλονιού: κάθε εντολή έχει "id" και "exp" (λήξη).
// Παράδειγμα: {"cmd":"ON","id":17,"exp":5000}
// Η εντολή ισχύει μόνο όσο millis() <= exp.

int lastId = 0;

${SETUP}
${ACT}
${HANDLE_FULL}
${LOOP}`;

  const L5_INITIAL = `// Λάμπα σαλονιού: ο κώδικας που πέρασε στην «παραγωγή» του εργαστηρίου.
// Κάτι δεν πάει καλά. Τρέξε τα σενάρια και βρες τι.

int lastId = 0;

${SETUP}
${ACT}
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

  int expiresAt = toInt(jsonGet(p, "exp"));
  if (!jsonHas(p, "exp") || expiresAt < 1) {
    Serial.println("Rejected: bad exp");
    return;
  }
  if (millis() < expiresAt) {
    Serial.println("Rejected: expired");
    return;
  }

  if (id == lastId) {
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

${LOOP}`;

  // ---------------------------------------------------------------- Tests με id / exp

  const ID_TESTS = [
    {
      name: 'Νέα id με αύξουσα σειρά → εκτελούνται',
      script: [...START, ...send('{"cmd":"ON","id":1}'), ...send('{"cmd":"OFF","id":2}'), ...send('{"cmd":"ON","id":3}'),
        { check: 'led', is: true, fail: 'Μετά από ON(1), OFF(2), ON(3) η λάμπα είναι {v}. Οι νέες εντολές πρέπει να εκτελούνται κανονικά.' },
        { check: 'count', text: 'Accepted: ON', is: 2, fail: 'Το «Accepted: ON» τυπώθηκε {n} φορές. Περίμενα 2.' },
        { check: 'count', text: 'Accepted: OFF', is: 1, fail: 'Το «Accepted: OFF» τυπώθηκε {n} φορές. Περίμενα 1.' }]
    },
    {
      name: 'Διπλή παράδοση της ίδιας εντολής → εκτελείται μία φορά',
      script: [...START, ...send('{"cmd":"ON","id":7}'), { redeliver: true }, { loops: 1 }, { redeliver: true }, { loops: 1 },
        { check: 'count', text: 'Accepted: ON', is: 1, fail: 'Η ίδια εντολή (id 7) παραδόθηκε 3 φορές και εκτελέστηκε {n} φορές. Σύγκρινε το id με το lastId πριν εκτελέσεις.' },
        { check: 'count', text: 'Rejected: duplicate id', is: 2, fail: 'Το «Rejected: duplicate id» τυπώθηκε {n} φορές. Περίμενα 2 (για τις δύο επαναλήψεις).' },
        { check: 'published', topic: 'home/led/state', is: 1, fail: 'Η συσκευή έστειλε {n} ενημερώσεις κατάστασης για μία εντολή.' }]
    },
    {
      name: 'Παλαιότερο id → απορρίπτεται',
      script: [...START, ...send('{"cmd":"ON","id":5}'), ...send('{"cmd":"OFF","id":6}'), ...send('{"cmd":"ON","id":5}'),
        { check: 'led', is: false, fail: 'Μετά το OFF(6) ήρθε ξανά ένα ON με id 5 και η λάμπα είναι {v}. Ένα id μικρότερο από το lastId είναι παλιά εντολή: απόρριψέ την με id <= lastId.' },
        { check: 'count', text: 'Rejected: duplicate id', is: 1, fail: 'Το «Rejected: duplicate id» τυπώθηκε {n} φορές. Περίμενα 1.' }]
    }
  ];

  const BAD_ID_TEST = {
    name: 'id που λείπει ή είναι εκτός ορίων → «Rejected: bad id»',
    script: [...START, ...send('{"cmd":"ON"}'), ...send('{"cmd":"ON","id":0}'), ...send('{"cmd":"ON","id":"abc"}'), ...send('{"cmd":"ON","id":5000000}'),
      { check: 'led', is: false, fail: 'Μετά από εντολές χωρίς σωστό id η λάμπα είναι {v}. Έλεγξε jsonHas(p, "id") και τα όρια 1..1000000 πριν από οτιδήποτε άλλο.' },
      { check: 'count', text: 'Rejected: bad id', is: 4, fail: 'Το «Rejected: bad id» τυπώθηκε {n} φορές. Περίμενα 4 (χωρίς id, 0, "abc", 5000000).' }]
  };

  const withExp = (cmd, id, exp) => `{"cmd":"${cmd}","id":${id},"exp":${exp}}`;

  const EXP_TESTS = [
    {
      name: 'Εντολή μέσα στο χρόνο της → εκτελείται',
      script: [...START, ...send(withExp('ON', 17, 5000)),
        { check: 'led', is: true, fail: 'Η εντολή {"cmd":"ON","id":17,"exp":5000} έφτασε στα ~0,03 s και η λάμπα είναι {v}. Μια έγκαιρη εντολή πρέπει να εκτελείται.' },
        { check: 'count', text: 'Accepted: ON', is: 1, fail: 'Το «Accepted: ON» τυπώθηκε {n} φορές.' }]
    },
    {
      name: 'Ληγμένη εντολή → «Rejected: expired»',
      script: [...START, { ms: 6000 }, ...send(withExp('ON', 17, 5000)),
        { check: 'led', is: false, fail: 'Η εντολή έληγε στα 5000 ms και έφτασε στα ~6000 ms. Η λάμπα είναι {v}. Σύγκρινε millis() με το exp: αν millis() > exp, απόρριψε.' },
        { check: 'count', text: 'Rejected: expired', is: 1, fail: 'Το «Rejected: expired» τυπώθηκε {n} φορές. Περίμενα 1.' }]
    },
    {
      name: 'exp που λείπει ή δεν είναι θετικός αριθμός → «Rejected: bad exp»',
      script: [...START, ...send('{"cmd":"ON","id":1}'), ...send('{"cmd":"ON","id":2,"exp":"soon"}'),
        { check: 'led', is: false, fail: 'Εντολές χωρίς έγκυρο exp άναψαν τη λάμπα (είναι {v}). Αν το exp λείπει, δεν ξέρουμε αν η εντολή είναι φρέσκια.' },
        { check: 'count', text: 'Rejected: bad exp', is: 2, fail: 'Το «Rejected: bad exp» τυπώθηκε {n} φορές. Περίμενα 2.' }]
    },
    {
      name: 'Οι έλεγχοι id συνεχίζουν να λειτουργούν',
      script: [...START, ...send(withExp('ON', 3, 60000)), ...send(withExp('OFF', 4, 60000)), ...send(withExp('ON', 3, 60000)), { redeliver: true }, { loops: 1 },
        { check: 'led', is: false, fail: 'Μετά το OFF(4) μια παλιά εντολή ON(3) άναψε ξανά τη λάμπα (είναι {v}).' },
        { check: 'count', text: 'Rejected: duplicate id', is: 2, fail: 'Το «Rejected: duplicate id» τυπώθηκε {n} φορές. Περίμενα 2.' }]
    }
  ];

  const lessons = [
    // ------------------------------------------------------------ 13.1
    {
      id: 'c13-l1', chapter: 13, kind: 'guided', skills: ['security', 'mqtt', 'conditions'],
      title: 'Allowlist: μόνο ON και OFF',
      prerequisites: [],
      objectives: ['Να ελέγχω ότι ένα payload είναι έγκυρο JSON πριν το χρησιμοποιήσω.', 'Να δέχομαι μόνο εντολές από μια allowlist.', 'Να καταγράφω κάθε απόρριψη με σαφή γραμμή στο Serial.'],
      theory: `
<p>Στα προηγούμενα κεφάλαια ο broker έλεγξε <strong>ποιος</strong> στέλνει (κωδικοί, TLS, ACL). Τώρα η συσκευή ελέγχει <strong>τι</strong> της στέλνουν.</p>
<p>Ένα μήνυμα μπορεί να είναι χαλασμένο από λάθος, από μια παλιά έκδοση του dashboard ή από μια άγνωστη συσκευή. Η συσκευή δεν πρέπει να «μαντεύει» τι εννοούσε.</p>
<p>Ο κανόνας: <strong>έλεγξε πρώτα, εκτέλεσε μετά</strong>.</p>
<ol>
  <li><strong>Μορφή:</strong> <code>jsonValid(p)</code>. Αν δεν είναι έγκυρο JSON → <code>Rejected: bad json</code>.</li>
  <li><strong>Allowlist:</strong> δεχόμαστε μόνο <code>"ON"</code> και <code>"OFF"</code>, ακριβώς έτσι. Όλα τα άλλα → <code>Rejected: unknown cmd</code>.</li>
</ol>
<p>Το <code>return;</code> μέσα σε μια <code>void</code> συνάρτηση σημαίνει «σταμάτα εδώ». Έτσι ένα κακό μήνυμα δεν φτάνει ποτέ στο <code>applyCommand</code>.</p>
<p>Η γραμμή καταγραφής (π.χ. <code>Rejected: bad json</code>) βοηθά αργότερα να καταλάβεις τι συνέβη. Δεν γράφει ποτέ κωδικούς ή άλλα μυστικά.</p>`,
      glossary: ['allowlist', 'έλεγχος εισόδου (validation)'],
      supportedSyntax: SYNTAX_C13,
      initialCode: L1_INITIAL,
      solution: L1_SOLUTION,
      initialWorld: {},
      world: WORLD_C13,
      hardware: HW,
      panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το πρώτο κενό ____ : η συνθήκη είναι «το p ΔΕΝ είναι έγκυρο JSON».',
        'Συμπλήρωσε το δεύτερο κενό ____ με τη δεύτερη επιτρεπτή εντολή.',
        'Τρέξε. Από το dashboard στείλε {"cmd":"ON"}, μετά {cmd:ON} και {"cmd":"BLINK"}. Κοίτα το Serial Monitor.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η λάμπα είναι σβηστή. Φτάνει το μήνυμα {"cmd":"BLINK"}. Τι πρέπει να γίνει;',
        options: ['Τίποτα στη λάμπα· τυπώνεται «Rejected: unknown cmd»', 'Η λάμπα ανάβει, γιατί δεν είναι OFF', 'Η πλακέτα κάνει επανεκκίνηση'],
        answer: 0,
        explain: 'Σωστά. Το BLINK δεν είναι στην allowlist. Η συσκευή δεν αλλάζει τίποτα και καταγράφει την απόρριψη.',
        retry: 'Όχι ακόμα. Η allowlist έχει μόνο δύο λέξεις. Τι γίνεται με όλες τις άλλες;'
      },
      hints: [
        'Πρώτα ελέγχεις τη μορφή, μετά το περιεχόμενο. Το ! σημαίνει «όχι».',
        'Το πρώτο κενό χρειάζεται το jsonValid(p) με ένα ! μπροστά. Το δεύτερο κενό είναι κείμενο σε εισαγωγικά.',
        'if (!jsonValid(p)) {\n  Serial.println("Rejected: bad json");\n  return;\n}\n…\n} else if (cmd == "OFF") {\n• !jsonValid(p) = «δεν είναι έγκυρο JSON»\n• "OFF" με κεφαλαία, όπως το στέλνει το dashboard'
      ],
      validationTests: [...BASIC_TESTS, JSON_TEST],
      explanationOnSuccess: 'Η λάμπα εκτελεί μόνο δύο εντολές και απορρίπτει όλα τα άλλα, με μια γραμμή καταγραφής για κάθε απόρριψη. Αυτό λέγεται allowlist: γράφεις τι επιτρέπεται, όχι τι απαγορεύεται.',
      remediation: 'Αν η λάμπα ανάβει με {"cmd":"on"}, μήπως συγκρίνεις χωρίς να προσέχεις τα κεφαλαία; Η σύγκριση με == είναι ακριβής.'
    },

    // ------------------------------------------------------------ 13.2
    {
      id: 'c13-l2', chapter: 13, kind: 'debug', skills: ['security', 'conditions'],
      title: 'Βρες το λάθος: ό,τι δεν είναι OFF γίνεται ON',
      prerequisites: ['c13-l1'],
      objectives: ['Να εντοπίζω ένα else που δέχεται «όλα τα υπόλοιπα».', 'Να μετατρέπω μια λογική «απαγόρευσε το ένα» σε allowlist.'],
      theory: `
<p>Αυτός ο κώδικας μοιάζει σωστός: το ON ανάβει και το OFF σβήνει.</p>
<p>Κοίτα όμως το <code>else</code>. Το <code>else</code> σημαίνει «σε <strong>κάθε</strong> άλλη περίπτωση». Εδώ, κάθε μήνυμα που δεν είναι ακριβώς <code>"OFF"</code> ανάβει τη λάμπα: <code>"BLINK"</code>, <code>"on"</code>, ακόμα και ένα JSON χωρίς <code>cmd</code>.</p>
<p>Σε ένα σπίτι αυτό σημαίνει ότι μια παλιά ή λάθος ρυθμισμένη συσκευή μπορεί να ανάβει φώτα χωρίς λόγο.</p>
<p>Η διόρθωση: <strong>κάθε επιτρεπτή εντολή έχει δικό της if</strong>, και το τελικό <code>else</code> μόνο απορρίπτει.</p>`,
      glossary: ['allowlist', 'if / else'],
      supportedSyntax: SYNTAX_C13,
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      initialWorld: {},
      world: WORLD_C13,
      hardware: HW,
      panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Από το dashboard στείλε {"cmd":"BLINK"}. Τι κάνει η λάμπα;',
        'Κοίτα την ενότητα «Γιατί αυτό το σκέλος;»: ποιο σκέλος εκτελέστηκε;',
        'Διόρθωσε τη λογική ώστε μόνο το "ON" να ανάβει τη λάμπα. Όλα τα άλλα (εκτός από το "OFF") → «Rejected: unknown cmd».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ποιο από αυτά τα μηνύματα ανάβει τη λάμπα στον αρχικό κώδικα;',
        options: ['Όλα όσα δεν είναι ακριβώς "OFF", π.χ. "BLINK", "on", {"mode":"ON"}', 'Μόνο το {"cmd":"ON"}', 'Κανένα'],
        answer: 0,
        explain: 'Σωστά. Το else πιάνει όλες τις άλλες περιπτώσεις. Γι’ αυτό χρειάζεται ρητός έλεγχος για το "ON".',
        retry: 'Όχι ακόμα. Τι σημαίνει το else; Πότε εκτελείται;'
      },
      hints: [
        'Το else εκτελείται για κάθε τιμή που δεν ταίριαξε στο if.',
        'Πρόσθεσε ένα else if (cmd == "ON") πριν από το άναμμα, και ένα τελικό else που μόνο τυπώνει «Rejected: unknown cmd».',
        '} else if (cmd == "ON") {\n  digitalWrite(LED_PIN, HIGH);\n  mqtt.publish("home/led/state", "ON");\n  Serial.println("Accepted: ON");\n} else {\n  Serial.println("Rejected: unknown cmd");\n}'
      ],
      validationTests: BASIC_TESTS,
      explanationOnSuccess: 'Το λάθος δεν ήταν συντακτικό: ο κώδικας έτρεχε κανονικά. Ήταν λάθος λογικής. Με allowlist, κάθε επιτρεπτή τιμή ελέγχεται ρητά και ό,τι περισσεύει απορρίπτεται.',
      remediation: 'Αν το {"cmd":"OFF"} δεν δουλεύει πια, μήπως έσβησες το πρώτο if; Κράτα και τα τρία σκέλη: OFF, ON, άγνωστο.'
    },

    // ------------------------------------------------------------ 13.3
    {
      id: 'c13-l3', chapter: 13, kind: 'variant', skills: ['security', 'state'],
      title: 'Command ID: καμία εντολή δύο φορές',
      prerequisites: ['c13-l2'],
      objectives: ['Να ελέγχω τύπο και όρια ενός αριθμητικού πεδίου.', 'Να απορρίπτω διπλή ή παλιά εντολή με βάση το command ID.', 'Να ενημερώνω την κατάσταση μόνο μετά από επιτυχία.'],
      theory: `
<p>Στο Κεφάλαιο 8 είδες ότι ένα μήνυμα μπορεί να <strong>παραδοθεί δύο φορές</strong>. Για μια λάμπα δεν είναι σοβαρό. Για μια πόρτα γκαράζ που «αλλάζει κατάσταση» είναι.</p>
<p>Λύση: κάθε εντολή έχει έναν αριθμό <code>id</code>. Ο αποστολέας τον αυξάνει κάθε φορά: 1, 2, 3, …</p>
<pre>{"cmd":"ON","id":17}</pre>
<p>Η συσκευή θυμάται το <code>lastId</code>, το id της τελευταίας εντολής που εκτέλεσε.</p>
<ul>
  <li>Αν το id λείπει ή δεν είναι από 1 έως 1000000 → <code>Rejected: bad id</code>.</li>
  <li>Αν <code>id &lt;= lastId</code> → η εντολή είναι ίδια ή παλαιότερη → <code>Rejected: duplicate id</code>.</li>
  <li>Αλλιώς εκτελείται και <strong>μετά</strong> γράφουμε <code>lastId = id;</code></li>
</ul>
<p><strong>Προϋποθέσεις:</strong> το id έχει νόημα μόνο αν ξέρουμε ότι το έστειλε το αξιόπιστο dashboard (ταυτότητα από τον broker: κωδικός, TLS, ACL). Επίσης, σε πραγματική συσκευή το <code>lastId</code> πρέπει να αποθηκεύεται, γιατί μετά από επανεκκίνηση η μεταβλητή ξαναγίνεται 0. Αυτό είναι <strong>διαχείριση κατάστασης</strong>.</p>`,
      glossary: ['command ID', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX_C13,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      initialWorld: {},
      world: WORLD_C13,
      hardware: HW,
      panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Γράψε τους δύο ελέγχους (bad id, duplicate id) στη θέση του ΣΥΜΠΛΗΡΩΣΕ.',
        'Μετά το applyCommand, γράψε lastId = id;',
        'Δοκίμασε: στείλε {"cmd":"ON","id":1}, μετά ξανά το ίδιο. Η δεύτερη φορά πρέπει να απορριφθεί.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το lastId είναι 6. Φτάνει {"cmd":"ON","id":5}. Τι γίνεται;',
        options: ['Απορρίπτεται ως «duplicate id», γιατί 5 <= 6', 'Εκτελείται, γιατί το 5 δεν είναι ίσο με το 6', 'Το lastId γίνεται 5'],
        answer: 0,
        explain: 'Σωστά. Ένα μικρότερο id σημαίνει παλιά εντολή που έφτασε αργά ή ξαναστάλθηκε. Με τον έλεγχο <= την απορρίπτουμε, και το lastId μένει 6.',
        retry: 'Όχι ακόμα. Ο κανόνας λέει: id ίδιο ή μικρότερο από το lastId → απόρριψη.'
      },
      hints: [
        'Οι έλεγχοι μπαίνουν πριν από την εκτέλεση και ο καθένας τελειώνει με return;. Το lastId αλλάζει μόνο αν η εντολή εκτελεστεί.',
        'Για το id: int id = toInt(jsonGet(p, "id"));. Έλεγξε και jsonHas(p, "id"), γιατί το toInt δίνει 0 αν λείπει.',
        'int id = toInt(jsonGet(p, "id"));\nif (!jsonHas(p, "id") || id < 1 || id > 1000000) {\n  Serial.println("Rejected: bad id");\n  return;\n}\nif (id <= lastId) {\n  Serial.println("Rejected: duplicate id");\n  return;\n}\n…\napplyCommand(cmd);\nlastId = id;'
      ],
      validationTests: [...ID_TESTS, BAD_ID_TEST],
      explanationOnSuccess: 'Η συσκευή εκτελεί κάθε εντολή μία φορά, ακόμα κι αν ο broker την παραδώσει ξανά. Θυμήσου τις προϋποθέσεις: αξιόπιστος αποστολέας (από τον broker) και αποθήκευση του lastId σε πραγματική συσκευή.',
      remediation: 'Αν η πρώτη εντολή απορρίπτεται, μήπως έγραψες lastId = id; πριν από τον έλεγχο; Η ενημέρωση γίνεται μόνο μετά το applyCommand.'
    },

    // ------------------------------------------------------------ 13.4
    {
      id: 'c13-l4', chapter: 13, kind: 'independent', skills: ['security', 'timing'],
      title: 'Λήξη εντολής με millis()',
      prerequisites: ['c13-l3'],
      objectives: ['Να απορρίπτω εντολή που έφτασε αργά.', 'Να εξηγώ γιατί ένα timestamp χρειάζεται συγχρονισμένο ρολόι και δεν αποτελεί από μόνο του αυθεντικοποίηση.'],
      theory: `
<p>Μια εντολή «άναψε το φως» που φτάνει μετά από 10 λεπτά (π.χ. γιατί το WiFi έπεφτε) μάλλον δεν ισχύει πια.</p>
<p>Γι’ αυτό το dashboard βάζει ένα όριο λήξης <code>exp</code>:</p>
<pre>{"cmd":"ON","id":17,"exp":5000}</pre>
<p>Σε αυτή την προσομοίωση το <code>exp</code> είναι σε χιλιοστά, στο <strong>ίδιο ρολόι</strong> με το <code>millis()</code> της συσκευής. Η εντολή ισχύει μόνο αν <code>millis() &lt;= exp</code>.</p>
<p><strong>Προϋπόθεση 1 – συγχρονισμός χρόνου:</strong> στην πραγματικότητα το <code>millis()</code> ξεκινά από 0 σε κάθε επανεκκίνηση και κάθε συσκευή έχει δικό της ρολόι. Ένα πραγματικό σύστημα χρειάζεται κοινή ώρα (π.χ. NTP) και ανοχή για μικρές διαφορές.</p>
<p><strong>Προϋπόθεση 2 – αξιόπιστος αποστολέας:</strong> ένα timestamp <strong>μόνο του δεν αποτελεί αυθεντικοποίηση</strong>. Όποιος μπορεί να γράψει στο <code>home/led/set</code> μπορεί να βάλει και ένα «φρέσκο» exp. Η ταυτότητα του αποστολέα έρχεται από τον broker (κωδικοί, TLS, ACL).</p>
<p>Σειρά ελέγχων: μορφή → id → exp → διπλή εντολή → allowlist → εκτέλεση.</p>`,
      glossary: ['λήξη εντολής (expiry)', 'millis', 'command ID'],
      supportedSyntax: SYNTAX_C13,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      initialWorld: {},
      world: WORLD_C13,
      hardware: HW,
      panels: PANELS,
      steps: [
        'Διάβασε το exp με int expiresAt = toInt(jsonGet(p, "exp"));',
        'Αν το exp λείπει ή είναι μικρότερο από 1: τύπωσε "Rejected: bad exp" και σταμάτα.',
        'Αν millis() > expiresAt: τύπωσε "Rejected: expired" και σταμάτα.',
        'Δοκίμασε: τρέξε για 6 δευτερόλεπτα και στείλε {"cmd":"ON","id":17,"exp":5000}.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Μια εντολή έχει "exp" στο μέλλον. Είναι αυτό αρκετό για να την εμπιστευτούμε;',
        options: ['Όχι. Το exp δείχνει μόνο αν είναι φρέσκια. Ποιος την έστειλε το ελέγχει ο broker (κωδικοί, TLS, ACL)', 'Ναι, ένα φρέσκο timestamp αποδεικνύει ότι την έστειλε το dashboard', 'Ναι, αν το exp είναι μεγάλος αριθμός'],
        answer: 0,
        explain: 'Σωστά. Οποιοσδήποτε αποστολέας μπορεί να γράψει έναν αριθμό στο exp. Η λήξη συμπληρώνει την αυθεντικοποίηση, δεν την αντικαθιστά.',
        retry: 'Όχι ακόμα. Ποιος γράφει την τιμή του exp μέσα στο μήνυμα;'
      },
      hints: [
        'Ο έλεγχος λήξης μοιάζει με τον έλεγχο του id: διάβασε, έλεγξε τύπο/όρια, σύγκρινε, return;.',
        'Βάλε τον έλεγχο μετά τον έλεγχο του id και πριν από τον έλεγχο «duplicate id».',
        'int expiresAt = toInt(jsonGet(p, "exp"));\nif (!jsonHas(p, "exp") || expiresAt < 1) {\n  Serial.println("Rejected: bad exp");\n  return;\n}\nif (millis() > expiresAt) {\n  Serial.println("Rejected: expired");\n  return;\n}'
      ],
      validationTests: EXP_TESTS,
      explanationOnSuccess: 'Η συσκευή απορρίπτει εντολές που άργησαν. Θυμήσου όμως: εδώ συσκευή και dashboard μοιράζονται το ίδιο εικονικό ρολόι. Σε πραγματικό σύστημα χρειάζεται συγχρονισμός χρόνου, και η ταυτότητα του αποστολέα πρέπει να ελέγχεται χωριστά.',
      remediation: 'Αν απορρίπτονται και οι φρέσκιες εντολές, έλεγξε τη φορά της σύγκρισης: ληγμένη είναι όταν millis() > expiresAt.'
    },

    // ------------------------------------------------------------ 13.5
    {
      id: 'c13-l5', chapter: 13, kind: 'checkpoint', skills: ['security', 'conditions', 'state'],
      title: 'Έλεγχος κεφαλαίου: δύο λάθη στους ελέγχους',
      prerequisites: ['c13-l4'],
      objectives: ['Να βρίσκω λάθη σε συγκρίσεις ασφαλείας με βάση τη συμπεριφορά.', 'Να επιβεβαιώνω ότι κάθε εντολή αφήνει ακριβώς μία γραμμή αποτελέσματος.'],
      theory: `
<p>Αυτός ο κώδικας έχει όλους τους ελέγχους του κεφαλαίου. Τρέχει χωρίς μήνυμα λάθους. Όμως <strong>δύο συγκρίσεις</strong> είναι λάθος.</p>
<p>Τέτοια λάθη είναι επικίνδυνα, γιατί ο κώδικας «φαίνεται» ασφαλής. Μόνο οι δοκιμές με συγκεκριμένα σενάρια τα δείχνουν.</p>
<p>Δοκίμασε με το dashboard:</p>
<ul>
  <li>μια φρέσκια εντολή, π.χ. <code>{"cmd":"ON","id":1,"exp":60000}</code>,</li>
  <li>μια παλαιότερη εντολή, π.χ. id 1 μετά από id 2.</li>
</ul>
<p>Κάθε εντολή πρέπει να αφήνει <strong>ακριβώς μία</strong> γραμμή αποτελέσματος: <code>Accepted: …</code> ή <code>Rejected: …</code>.</p>`,
      glossary: ['έλεγχος εισόδου (validation)', 'λήξη εντολής (expiry)', 'command ID'],
      supportedSyntax: SYNTAX_C13,
      initialCode: L5_INITIAL,
      solution: L4_SOLUTION.replace('// Λάμπα σαλονιού: κάθε εντολή έχει "id" και "exp" (λήξη).\n// Παράδειγμα: {"cmd":"ON","id":17,"exp":5000}\n// Η εντολή ισχύει μόνο όσο millis() <= exp.', '// Λάμπα σαλονιού: διορθωμένη έκδοση.'),
      initialWorld: {},
      world: WORLD_C13,
      hardware: HW,
      panels: PANELS,
      steps: [
        'Στείλε μια φρέσκια εντολή. Εκτελείται; Τι γράφει το Serial;',
        'Τρέξε για 6 δευτερόλεπτα και στείλε εντολή με "exp":5000. Τι γίνεται τώρα;',
        'Στείλε id 2 και μετά id 1. Εκτελείται η παλιά;',
        'Διόρθωσε τις δύο συγκρίσεις και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί ο έλεγχος id == lastId δεν αρκεί;',
        options: ['Γιατί αφήνει να περάσει μια παλαιότερη εντολή (id μικρότερο από lastId)', 'Γιατί το == δεν δουλεύει με int', 'Γιατί το lastId δεν αλλάζει ποτέ'],
        answer: 0,
        explain: 'Σωστά. Με == απορρίπτεται μόνο η αμέσως προηγούμενη εντολή. Μια παλαιότερη (π.χ. ON με id 5 μετά το OFF με id 6) θα εκτελούνταν ξανά. Χρειάζεται <=.',
        retry: 'Όχι ακόμα. Σκέψου την ακολουθία id: 5, 6, 5. Τι κάνει το == στο τρίτο μήνυμα;'
      },
      hints: [
        'Ένα λάθος αφορά τον χρόνο και ένα το id. Δοκίμασε κάθε σενάριο χωριστά.',
        'Κοίτα τη φορά του < στον έλεγχο λήξης, και το == στον έλεγχο διπλής εντολής.',
        'Γράψε:\nif (millis() > expiresAt) {   // ληγμένη όταν ο χρόνος ΠΕΡΑΣΕ το όριο\n…\nif (id <= lastId) {           // ίδιο Ή παλαιότερο id'
      ],
      validationTests: [
        ...EXP_TESTS.slice(0, 2),
        {
          name: 'Παλαιότερο id → απορρίπτεται',
          script: [...START, ...send(withExp('ON', 5, 60000)), ...send(withExp('OFF', 6, 60000)), ...send(withExp('ON', 5, 60000)),
            { check: 'led', is: false, fail: 'Μετά το OFF(6) μια εντολή ON με id 5 άναψε τη λάμπα (είναι {v}). Ένα παλαιότερο id πρέπει να απορρίπτεται: χρησιμοποίησε id <= lastId.' },
            { check: 'count', text: 'Rejected: duplicate id', is: 1, fail: 'Το «Rejected: duplicate id» τυπώθηκε {n} φορές. Περίμενα 1.' }]
        },
        {
          name: 'Κάθε εντολή αφήνει ακριβώς μία γραμμή αποτελέσματος',
          script: [...START,
            ...send('{bad'), ...send('{"cmd":"ON","exp":60000}'), ...send(withExp('ON', 1, 60000)), ...send(withExp('BLINK', 2, 60000)),
            { redeliver: true }, { loops: 1 },
            { check: 'total', is: 6, fail: 'Το Serial έχει {n} γραμμές. Περίμενα 6: «MQTT connected» και μία γραμμή για καθεμία από τις 5 εντολές.' },
            { check: 'lines', is: ['MQTT connected', 'Rejected: bad json', 'Rejected: bad id', 'Accepted: ON', 'Rejected: unknown cmd', 'Rejected: unknown cmd'], fail: 'Οι γραμμές ήταν: {v}. Περίμενα: bad json, bad id, Accepted: ON, unknown cmd, unknown cmd.' },
            { check: 'led', is: true, fail: 'Η λάμπα είναι {v}. Μόνο το ON με id 1 έπρεπε να εκτελεστεί.' }]
        }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο. Η λάμπα ελέγχει μορφή, τύπους, όρια, id και λήξη, και καταγράφει κάθε απόφαση. Θυμήσου τα όρια αυτής της λύσης: χρειάζεται αξιόπιστο αποστολέα από τον broker, συγχρονισμένο ρολόι και αποθηκευμένο lastId σε πραγματική συσκευή.',
      remediation: 'Αν το σενάριο «μία γραμμή ανά εντολή» αποτυγχάνει, έλεγξε ότι κάθε έλεγχος που τυπώνει «Rejected» τελειώνει με return;.'
    }
  ];

  lessons.forEach(l => L.lessons.push(l));
})(typeof window !== 'undefined' ? window : globalThis);
