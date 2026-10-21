/*
 * IoT Guardian — Κεφάλαιο 16 (επιπλέον): Μπαταρία, light sleep και deep sleep.
 * Ανοίγει μετά το Κεφάλαιο 6 (WiFi). Οι τιμές ρεύματος είναι ενδεικτικές για το τσιπ ESP32.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 16, title: 'Μπαταρία: light sleep και deep sleep', ready: true, bonus: true, unlockAfter: 6 });
  L.SKILLS.power = 'Ενέργεια και ύπνος';

  [
    { term: 'mA (μιλιαμπέρ)', def: 'Μονάδα ρεύματος. Όσο περισσότερα mA τραβά η πλακέτα, τόσο πιο γρήγορα αδειάζει η μπαταρία.' },
    { term: 'mAh', def: 'Χωρητικότητα μπαταρίας. Μια μπαταρία 2000 mAh δίνει περίπου 2000 mA για μία ώρα, ή 20 mA για 100 ώρες.' },
    { term: 'light sleep', def: 'Ελαφρύς ύπνος: ο επεξεργαστής σταματά, η μνήμη (οι μεταβλητές) κρατιέται. Μόλις ξυπνήσει, το πρόγραμμα συνεχίζει από την επόμενη γραμμή. Περίπου 0,8 mA.' },
    { term: 'deep sleep', def: 'Βαθύς ύπνος: σχεδόν όλα σβήνουν, και η κανονική μνήμη χάνεται. Μόλις ξυπνήσει, το πρόγραμμα ξεκινά από την αρχή (setup). Περίπου 0,01 mA στο τσιπ.' },
    { term: 'RTC_DATA_ATTR', def: 'Λέξη μπροστά από μια μεταβλητή έξω από τις συναρτήσεις. Τη βάζει σε ειδική μνήμη που μένει ζωντανή στο deep sleep, π.χ. RTC_DATA_ATTR int bootCount = 0;' },
    { term: 'πηγή αφύπνισης', def: 'Τι θα ξυπνήσει την πλακέτα: χρονόμετρο (esp_sleep_enable_timer_wakeup) ή αλλαγή σε ένα pin (esp_sleep_enable_ext0_wakeup). Χωρίς πηγή, δεν ξυπνά ποτέ.' },
    { term: 'µs (μικροδευτερόλεπτο)', def: 'Ένα εκατομμυριοστό του δευτερολέπτου. Το χρονόμετρο αφύπνισης μετρά σε µs: 1 δευτερόλεπτο = 1.000.000 µs.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX = 'readTemperature, WiFi.mode(WIFI_OFF), esp_sleep_enable_timer_wakeup(µs), esp_sleep_enable_ext0_wakeup(pin, επίπεδο), esp_light_sleep_start(), esp_deep_sleep_start(), esp_sleep_get_wakeup_cause(), RTC_DATA_ATTR';
  const PANELS = ['serial', 'energy', 'vars'];
  const OPEN_BROKER = 'listener 1883\nallow_anonymous true\n';

  // ------------------------------------------------------------ 16.1
  const L1_INITIAL = `// Θερμόμετρο δωματίου: δείχνει τη θερμοκρασία στο Serial.
// Δεν στέλνει τίποτα στο δίκτυο.

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);   // «για καλό και για κακό»
}

void loop() {
  float t = readTemperature();
  Serial.println("Temp: " + t + " C");
  delay(2000);
}
`;
  const L1_SOLUTION = `// Θερμόμετρο δωματίου: δείχνει τη θερμοκρασία στο Serial.
// Δεν στέλνει τίποτα στο δίκτυο.

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_OFF);   // δεν χρειαζόμαστε δίκτυο: σβήσε το ραδιόφωνο
}

void loop() {
  float t = readTemperature();
  Serial.println("Temp: " + t + " C");
  delay(2000);
}
`;

  // ------------------------------------------------------------ 16.2
  const L2_INITIAL = `// Καταγραφέας θερμοκρασίας με μπαταρία, χωρίς δίκτυο.
int count = 0;   // πόσες μετρήσεις έγιναν

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_OFF);
}

void loop() {
  count++;
  float t = readTemperature();
  Serial.println("#" + count + " " + t + " C");

  // ΑΛΛΑΞΕ: αντί για delay, κοιμήσου 2 δευτερόλεπτα σε light sleep.
  esp_sleep_enable_timer_wakeup(____);   // ΣΥΜΠΛΗΡΩΣΕ: 2 δευτερόλεπτα σε µs
  ____;                                  // ΣΥΜΠΛΗΡΩΣΕ: ξεκίνα τον light sleep
}
`;
  const L2_SOLUTION = `// Καταγραφέας θερμοκρασίας με μπαταρία, χωρίς δίκτυο.
int count = 0;   // πόσες μετρήσεις έγιναν

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_OFF);
}

void loop() {
  count++;
  float t = readTemperature();
  Serial.println("#" + count + " " + t + " C");

  esp_sleep_enable_timer_wakeup(2000000);   // 2 s = 2.000.000 µs
  esp_light_sleep_start();                  // κοιμήσου· μετά συνέχισε από εδώ
}
`;

  // ------------------------------------------------------------ 16.3
  const L3_BODY = `const int SLEEP_SECONDS = 10;

void setup() {
  Serial.begin(115200);
  bootCount++;
  Serial.println("Boot #" + bootCount);
  Serial.println("Temp: " + readTemperature() + " C");

  esp_sleep_enable_timer_wakeup(SLEEP_SECONDS * 1000000);
  esp_deep_sleep_start();
  Serial.println("Αυτό δεν τυπώνεται ποτέ");
}

void loop() {
  // Με deep sleep το loop() δεν τρέχει ποτέ: κάθε ξύπνημα ξεκινά από το setup().
}
`;
  const L3_INITIAL = `// Θερμόμετρο που ξυπνά κάθε 10 δευτερόλεπτα από deep sleep.
int bootCount = 0;   // πόσες φορές ξεκίνησε η πλακέτα

${L3_BODY}`;
  const L3_SOLUTION = `// Θερμόμετρο που ξυπνά κάθε 10 δευτερόλεπτα από deep sleep.
RTC_DATA_ATTR int bootCount = 0;   // μένει ζωντανή στο deep sleep

${L3_BODY}`;

  // ------------------------------------------------------------ 16.4
  const L4_SEND = String.raw`// Συνδέεται, στέλνει την κίνηση και επιστρέφει.
void sendMotion() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(100);
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi failed");
    return;
  }
  mqtt.setServer(MQTT_HOST, 1883);
  if (mqtt.connect("esp32-pir")) {
    mqtt.publish("home/motion", "{\"motion\":true}");
    Serial.println("Motion sent");
  }
}
`;
  const L4_INITIAL = `// Αισθητήρας κίνησης με μπαταρία: κοιμάται μέχρι να δει κίνηση.
${L4_SEND}
void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);

  // Ξύπνησα από τον PIR; Τότε στείλε την κίνηση.
  if (esp_sleep_get_wakeup_cause() == ____) {   // ΣΥΜΠΛΗΡΩΣΕ: αιτία «pin (ext0)»
    sendMotion();
  }

  // Περίμενε να τελειώσει η κίνηση, αλλιώς θα ξυπνήσει αμέσως ξανά.
  while (digitalRead(PIR_PIN) == HIGH) {
    delay(100);
  }

  esp_sleep_enable_ext0_wakeup(____, HIGH);       // ΣΥΜΠΛΗΡΩΣΕ: ποιο pin ξυπνά την πλακέτα
  esp_deep_sleep_start();
}

void loop() {
}
`;
  const L4_SOLUTION = `// Αισθητήρας κίνησης με μπαταρία: κοιμάται μέχρι να δει κίνηση.
${L4_SEND}
void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);

  // Ξύπνησα από τον PIR; Τότε στείλε την κίνηση.
  if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) {
    sendMotion();
  }

  // Περίμενε να τελειώσει η κίνηση, αλλιώς θα ξυπνήσει αμέσως ξανά.
  while (digitalRead(PIR_PIN) == HIGH) {
    delay(100);
  }

  esp_sleep_enable_ext0_wakeup(PIR_PIN, HIGH);
  esp_deep_sleep_start();
}

void loop() {
}
`;

  // ------------------------------------------------------------ 16.5
  const L5_SEND = String.raw`void sendTemperature(float t) {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(100);
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi failed");
    return;
  }
  mqtt.setServer(MQTT_HOST, 1883);
  if (mqtt.connect("esp32-temp")) {
    mqtt.publish("home/temperature", "{\"t\":" + t + "}");
  }
}
`;
  const L5_SETUP = (timer) => `void setup() {
  Serial.begin(115200);
  bootCount++;
  Serial.println("Boot #" + bootCount);

  float t = readTemperature();
  if (!isnan(t)) {
    sendTemperature(t);
  }

  esp_sleep_enable_timer_wakeup(${timer});
  esp_deep_sleep_start();
}

void loop() {
}
`;
  const L5_INITIAL = `// Εξωτερικό θερμόμετρο με μπαταρία: μία μέτρηση κάθε 10 λεπτά.
// Παράπονο: «η μπαταρία αδειάζει σε λιγότερο από μία μέρα».
int bootCount = 0;
const int SLEEP_SECONDS = 600;   // 10 λεπτά

${L5_SEND}
${L5_SETUP('SLEEP_SECONDS * 1000')}`;
  const L5_SOLUTION = `// Εξωτερικό θερμόμετρο με μπαταρία: μία μέτρηση κάθε 10 λεπτά.
RTC_DATA_ATTR int bootCount = 0;
const int SLEEP_SECONDS = 600;   // 10 λεπτά

${L5_SEND}
${L5_SETUP('SLEEP_SECONDS * 1000000')}`;

  const MOTION_WORLD = { broker: OPEN_BROKER, clients: [{ name: 'dashboard', subs: ['home/#'] }], pir: false };

  L.lessons.push(
    {
      id: 'c16-l1', chapter: 16, kind: 'micro', skills: ['power', 'network'],
      title: 'Πού πάει η ενέργεια;',
      prerequisites: [],
      objectives: ['Να διαβάζω το ρεύμα που τραβά η πλακέτα σε mA.', 'Να υπολογίζω πόσο κρατά μια μπαταρία.', 'Να σβήνω το WiFi όταν δεν χρειάζεται.'],
      theory: `
<p>Μια μπαταρία έχει χωρητικότητα σε <strong>mAh</strong>. Μια μπαταρία <strong>2000 mAh</strong> δίνει περίπου:</p>
<ul>
  <li>120 mA για ~17 ώρες,</li>
  <li>40 mA για ~2 μέρες,</li>
  <li>1 mA για ~3 μήνες.</li>
</ul>
<p>Ο απλός λογαριασμός: <strong>ώρες ≈ mAh ÷ mA</strong>.</p>
<p>Στο ESP32 ο μεγαλύτερος «καταναλωτής» είναι το <strong>ραδιόφωνο του WiFi</strong>: με WiFi ενεργό η πλακέτα τραβά περίπου <strong>120 mA</strong>, χωρίς WiFi περίπου <strong>40 mA</strong>.</p>
<p>Αν μια συσκευή δεν χρειάζεται δίκτυο, το σβήνεις: <code>WiFi.mode(WIFI_OFF);</code></p>
<p>Το πάνελ «Ενέργεια και μπαταρία» δείχνει το ρεύμα τώρα, το μέσο ρεύμα και πόσο θα κρατούσε η μπαταρία.</p>`,
      glossary: ['mA (μιλιαμπέρ)', 'mAh'],
      supportedSyntax: SYNTAX,
      initialCode: L1_INITIAL,
      solution: L1_SOLUTION,
      world: {}, initialWorld: {},
      hardware: ['sensor', 'router'], panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα και κοίτα το πάνελ «Ενέργεια και μπαταρία». Πόσα mA τραβά; Πόσο θα κρατούσε η μπαταρία;',
        'Απάντησε στην ερώτηση.',
        'Το θερμόμετρο δεν στέλνει τίποτα στο δίκτυο. Αντικατέστησε το WiFi.begin με WiFi.mode(WIFI_OFF);',
        'Τρέξε ξανά, σύγκρινε και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η πλακέτα τραβά 120 mA από μπαταρία 2000 mAh. Πόσο θα κρατήσει περίπου;',
        options: ['Περίπου 17 ώρες', 'Περίπου 2 μήνες', 'Περίπου 2000 ώρες'],
        answer: 0,
        explain: 'Σωστά. 2000 mAh ÷ 120 mA ≈ 16,7 ώρες. Ούτε μία μέρα, για ένα θερμόμετρο που δεν χρησιμοποιεί καν το δίκτυο.',
        retry: 'Όχι ακόμα. Διαίρεσε: mAh ÷ mA = ώρες.'
      },
      hints: [
        'Ποιο κομμάτι της πλακέτας τραβά τα περισσότερα mA; Το χρειάζεται αυτό το θερμόμετρο;',
        'Η γραμμή WiFi.begin(…) στο setup() ανάβει το WiFi χωρίς λόγο. Βάλε στη θέση της την εντολή που το σβήνει.',
        'Στο setup() γράψε:\nWiFi.mode(WIFI_OFF);\nκαι σβήσε το WiFi.begin(WIFI_SSID, WIFI_PASSWORD);'
      ],
      validationTests: [
        { name: 'Το θερμόμετρο συνεχίζει να μετρά', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 5000 },
          { check: 'count', text: 'Temp: 22.50 C', min: 2, fail: 'Σε 5 δευτερόλεπτα τυπώθηκαν {n} μετρήσεις. Περίμενα τουλάχιστον 2.' }
        ] },
        { name: 'Μέσο ρεύμα κάτω από 50 mA (χωρίς WiFi)', script: [
          { setup: true }, { ms: 6000 },
          { check: 'avgCurrent', max: 50, fail: 'Το μέσο ρεύμα είναι {v} mA. Το ραδιόφωνο του WiFi είναι ακόμα αναμμένο. Σβήσ’ το με WiFi.mode(WIFI_OFF).' },
          { check: 'wifiConnected', is: false, fail: 'Η πλακέτα είναι ακόμα συνδεδεμένη στο WiFi.' }
        ] }
      ],
      explanationOnSuccess: 'Το ρεύμα έπεσε από ~120 σε ~40 mA: η μπαταρία κρατά τώρα περίπου 2 μέρες αντί για 17 ώρες. Είναι βελτίωση, αλλά όχι αρκετή. Ο επεξεργαστής είναι ακόμα ξύπνιος το 100% του χρόνου, ενώ μετρά μία φορά στα 2 δευτερόλεπτα. Στο επόμενο μάθημα θα τον κοιμίσεις.',
      remediation: 'Αν το ρεύμα είναι ακόμα ~120 mA, έλεγξε ότι δεν έμεινε κανένα WiFi.begin στον κώδικα.'
    },

    {
      id: 'c16-l2', chapter: 16, kind: 'guided', skills: ['power', 'timing'],
      title: 'Light sleep: κοιμήσου αντί να περιμένεις',
      prerequisites: ['c16-l1'],
      objectives: ['Να χρησιμοποιώ light sleep αντί για delay.', 'Να ρυθμίζω το χρονόμετρο αφύπνισης σε µs.', 'Να βλέπω ότι στο light sleep οι μεταβλητές κρατιούνται.'],
      theory: `
<p>Το <code>delay(2000)</code> <strong>δεν κοιμίζει</strong> την πλακέτα: περιμένει ξύπνια, με ~40 mA.</p>
<p>Ο <strong>light sleep</strong> σταματά τον επεξεργαστή και πέφτει περίπου στα <strong>0,8 mA</strong>, δηλαδή 50 φορές λιγότερο.</p>
<pre>esp_sleep_enable_timer_wakeup(2000000);   // ξύπνα σε 2 s
esp_light_sleep_start();                  // κοιμήσου</pre>
<ul>
  <li>Το χρονόμετρο μετρά σε <strong>µs</strong> (μικροδευτερόλεπτα): <strong>1 s = 1.000.000 µs</strong>. Το πιο συχνό λάθος είναι να γράψεις ms.</li>
  <li>Μετά τον light sleep, το πρόγραμμα <strong>συνεχίζει από την επόμενη γραμμή</strong>. Οι μεταβλητές κρατούν τις τιμές τους.</li>
  <li>Όσο κοιμάται, η πλακέτα <strong>δεν αντιδρά</strong> σε τίποτα. Είναι για συσκευές που κάνουν κάτι κάθε τόσο, όχι για κουμπιά που θέλουν άμεση απάντηση.</li>
</ul>
<p>Στον προσομοιωτή, όσο η πλακέτα κοιμάται, ο χρόνος τρέχει 100 φορές πιο γρήγορα.</p>`,
      glossary: ['light sleep', 'πηγή αφύπνισης', 'µs (μικροδευτερόλεπτο)'],
      supportedSyntax: SYNTAX,
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      world: {}, initialWorld: {},
      hardware: ['sensor'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τον χρόνο αφύπνισης: 2 δευτερόλεπτα σε µs.',
        'Συμπλήρωσε την εντολή που ξεκινά τον light sleep.',
        'Τρέξε. Δες την πλακέτα να «σβήνει» στον ύπνο, και το μέσο ρεύμα να πέφτει. Το #1, #2, #3 συνεχίζει;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Πόσα µs είναι 2 δευτερόλεπτα;',
        options: ['2.000.000', '2.000', '2'],
        answer: 0,
        explain: 'Σωστά. 1 s = 1.000.000 µs, άρα 2 s = 2.000.000 µs. Με 2000 η πλακέτα θα ξυπνούσε κάθε 2 χιλιοστά του δευτερολέπτου.',
        retry: 'Όχι ακόμα. 1 δευτερόλεπτο = 1.000 ms = 1.000.000 µs.'
      },
      hints: [
        'Δύο εντολές: η μία ρυθμίζει πότε θα ξυπνήσει, η άλλη την κοιμίζει.',
        'Το χρονόμετρο θέλει µs (εκατομμυριοστά). Η εντολή ύπνου είναι esp_light_sleep_start() και δεν παίρνει ορίσματα.',
        'esp_sleep_enable_timer_wakeup(2000000);\nesp_light_sleep_start();'
      ],
      validationTests: [
        { name: 'Μία μέτρηση κάθε 2 δευτερόλεπτα', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 6500 },
          { check: 'count', text: '#1 22.50 C', is: 1, fail: 'Η πρώτη μέτρηση τυπώθηκε {n} φορές.' },
          { check: 'total', is: 4, fail: 'Σε 6,5 δευτερόλεπτα τυπώθηκαν {n} μετρήσεις. Περίμενα 4 (στα 0, 2, 4 και 6 s). Αν είναι πολλές, έγραψες ms αντί για µs.' }
        ] },
        { name: 'Ο μετρητής συνεχίζει (η μνήμη κρατιέται στο light sleep)', world: { temp: 21 }, script: [
          { setup: true }, { ms: 4500 },
          { check: 'lastLine', is: '#3 21.00 C', fail: 'Η τελευταία γραμμή είναι {v}. Περίμενα «#3 21.00 C».' }
        ] },
        { name: 'Μέσο ρεύμα κάτω από 2 mA', script: [
          { setup: true }, { ms: 8000 },
          { check: 'avgCurrent', max: 2, fail: 'Το μέσο ρεύμα είναι {v} mA. Η πλακέτα μάλλον περιμένει ξύπνια (delay) αντί να κοιμάται.' },
          { check: 'sleepShare', mode: 'light', min: 90, fail: 'Η πλακέτα κοιμήθηκε μόνο το {v}% του χρόνου. Περίμενα πάνω από 90%.' }
        ] }
      ],
      explanationOnSuccess: 'Το μέσο ρεύμα έπεσε κάτω από 1 mA: η ίδια μπαταρία κρατά τώρα μήνες αντί για μέρες. Και ο μετρητής count συνέχισε κανονικά, γιατί στο light sleep η μνήμη κρατιέται.',
      remediation: 'Αν βλέπεις «η πλακέτα μπαίνει σε sleep χωρίς τρόπο να ξυπνήσει», το esp_sleep_enable_timer_wakeup πρέπει να γράφεται πριν από το esp_light_sleep_start.'
    },

    {
      id: 'c16-l3', chapter: 16, kind: 'variant', skills: ['power', 'variables', 'state'],
      title: 'Deep sleep: η πλακέτα ξεκινά από την αρχή',
      prerequisites: ['c16-l2'],
      objectives: ['Να χρησιμοποιώ deep sleep με χρονόμετρο.', 'Να εξηγώ γιατί μετά το deep sleep τρέχει ξανά το setup().', 'Να κρατώ μια τιμή με RTC_DATA_ATTR.'],
      theory: `
<p>Ο <strong>deep sleep</strong> σβήνει σχεδόν τα πάντα: το τσιπ πέφτει περίπου στα <strong>0,01 mA</strong>, 80 φορές κάτω από τον light sleep.</p>
<p>Το τίμημα: <strong>η κανονική μνήμη χάνεται</strong>. Όταν ξυπνά, η πλακέτα κάνει <strong>επανεκκίνηση</strong>:</p>
<ol>
  <li>οι μεταβλητές παίρνουν ξανά τις αρχικές τους τιμές,</li>
  <li>τρέχει ξανά το <code>setup()</code>,</li>
  <li>το <code>loop()</code> συνήθως δεν φτάνει ποτέ, γιατί το setup() ξανακοιμίζει την πλακέτα.</li>
</ol>
<p>Για να θυμάται κάτι ανάμεσα στους ύπνους, μια μεταβλητή χρειάζεται τη λέξη <code>RTC_DATA_ATTR</code>. Τη βάζει σε μια μικρή μνήμη που μένει ζωντανή:</p>
<pre>RTC_DATA_ATTR int bootCount = 0;</pre>
<p>Ο κώδικας εδώ τυπώνει πάντα «Boot #1». Τρέξε τον για 30 δευτερόλεπτα και δες γιατί.</p>`,
      glossary: ['deep sleep', 'RTC_DATA_ATTR', 'πηγή αφύπνισης'],
      supportedSyntax: SYNTAX,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: {}, initialWorld: {},
      hardware: ['sensor'], panels: PANELS,
      steps: [
        'Τρέξε για περίπου 30 δευτερόλεπτα (με την επιτάχυνση του ύπνου περνούν γρήγορα). Τι τυπώνει κάθε φορά;',
        'Κοίτα τον πίνακα «Μεταβλητές» αμέσως μετά από ένα ξύπνημα. Τι τιμή έχει το bootCount;',
        'Κάνε το bootCount να θυμάται την τιμή του ανάμεσα στους ύπνους.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Μια κανονική μεταβλητή int counter = 5; έξω από τις συναρτήσεις. Η πλακέτα κάνει deep sleep και ξυπνά. Τι τιμή έχει το counter;',
        options: ['Την αρχική του τιμή, γιατί η μνήμη χάθηκε', 'Την τιμή που είχε πριν τον ύπνο', 'Τυχαία τιμή'],
        answer: 0,
        explain: 'Σωστά. Μετά το deep sleep το πρόγραμμα ξεκινά από την αρχή και η γραμμή int counter = 5; τρέχει ξανά. Μόνο οι μεταβλητές RTC_DATA_ATTR θυμούνται.',
        retry: 'Όχι ακόμα. Ξαναδιάβασε: τι συμβαίνει στην κανονική μνήμη στον deep sleep;'
      },
      hints: [
        'Το bootCount ξαναγίνεται 0 σε κάθε ξύπνημα. Χρειάζεται να μπει στη μνήμη που επιβιώνει.',
        'Η αλλαγή είναι μία λέξη μπροστά από τη δήλωση του bootCount, στην πρώτη γραμμή μετά το σχόλιο.',
        'RTC_DATA_ATTR int bootCount = 0;\nΗ αρχική τιμή 0 μπαίνει μόνο την πρώτη φορά που ανάβει η πλακέτα.'
      ],
      validationTests: [
        { name: 'Το bootCount μετρά 1, 2, 3, 4', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 35000 },
          { check: 'order', texts: ['Boot #1', 'Boot #2', 'Boot #3', 'Boot #4'], fail: 'Τα μηνύματα εκκίνησης ήταν: {v}. Περίμενα Boot #1, #2, #3, #4. Αν βλέπεις μόνο «Boot #1», το bootCount ξεχνά στον deep sleep.' }
        ] },
        { name: 'Ξυπνά κάθε 10 δευτερόλεπτα από το χρονόμετρο', script: [
          { setup: true }, { ms: 35000 },
          { check: 'boots', min: 3, max: 3, fail: 'Σε 35 δευτερόλεπτα έγιναν {n} επανεκκινήσεις. Περίμενα 3 (στα 10, 20 και 30 s).' },
          { check: 'count', text: 'Αυτό δεν τυπώνεται ποτέ', is: 0, fail: 'Τυπώθηκε η γραμμή μετά το esp_deep_sleep_start().' }
        ] },
        { name: 'Μέσο ρεύμα κάτω από 0,1 mA', script: [
          { setup: true }, { ms: 35000 },
          { check: 'avgCurrent', max: 0.1, fail: 'Το μέσο ρεύμα είναι {v} mA.' },
          { check: 'sleepShare', mode: 'deep', min: 99, fail: 'Η πλακέτα ήταν σε deep sleep μόνο το {v}% του χρόνου.' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα ξυπνά, μετρά, θυμάται πόσες φορές ξύπνησε και ξανακοιμάται. Με μέσο ρεύμα τόσο χαμηλό, η μπαταρία θα κρατούσε χρόνια. Στην πράξη όμως άλλα κομμάτια της πλακέτας (LED, τσιπ USB) και η ίδια η μπαταρία βάζουν όριο.',
      remediation: 'Το RTC_DATA_ATTR μπαίνει μόνο σε μεταβλητές έξω από τις συναρτήσεις, πριν από τον τύπο: RTC_DATA_ATTR int …'
    },

    {
      id: 'c16-l4', chapter: 16, kind: 'guided', skills: ['power', 'mqtt', 'io'],
      title: 'Ξύπνα από τον PIR',
      prerequisites: ['c16-l3'],
      objectives: ['Να ξυπνώ την πλακέτα από ένα pin (ext0).', 'Να ελέγχω την αιτία αφύπνισης.', 'Να ανάβω το WiFi μόνο όταν έχω κάτι να στείλω.'],
      theory: `
<p>Ένας αισθητήρας κίνησης δεν χρειάζεται να ξυπνά κάθε λίγο. Αρκεί να ξυπνά <strong>όταν υπάρχει κίνηση</strong>.</p>
<pre>esp_sleep_enable_ext0_wakeup(PIR_PIN, HIGH);   // ξύπνα όταν ο PIR γίνει HIGH
esp_deep_sleep_start();</pre>
<p>Μετά το ξύπνημα, το <code>setup()</code> ρωτά <strong>γιατί</strong> ξύπνησε:</p>
<ul>
  <li><code>ESP_SLEEP_WAKEUP_EXT0</code>: από το pin (κίνηση),</li>
  <li><code>ESP_SLEEP_WAKEUP_TIMER</code>: από το χρονόμετρο,</li>
  <li><code>ESP_SLEEP_WAKEUP_UNDEFINED</code>: πρώτη εκκίνηση (ρεύμα).</li>
</ul>
<p>Μόνο αν η αιτία είναι η κίνηση, η πλακέτα ανάβει WiFi, στέλνει μήνυμα και ξανακοιμάται. Το WiFi, που τραβά τα περισσότερα mA, μένει αναμμένο μόνο ένα-δυο δευτερόλεπτα.</p>
<p>Προσοχή: αν κοιμηθεί όσο ο PIR είναι ακόμα HIGH, θα ξυπνήσει αμέσως ξανά. Γι’ αυτό περιμένει πρώτα να τελειώσει η κίνηση.</p>
<p>Στο πραγματικό ESP32 το ext0 δουλεύει μόνο σε ορισμένα pins (RTC GPIO). Το GPIO 4 είναι ένα από αυτά.</p>`,
      glossary: ['πηγή αφύπνισης', 'deep sleep', 'PIR'],
      supportedSyntax: SYNTAX + ', WiFi.begin, mqtt.connect, mqtt.publish',
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: MOTION_WORLD, initialWorld: { pir: false },
      hardware: ['pir', 'router'], panels: ['serial', 'energy', 'mqtt'],
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε την αιτία αφύπνισης «από pin».',
        'Συμπλήρωσε ποιο pin ξυπνά την πλακέτα.',
        'Τρέξε. Περίμενε λίγο και μετά άναψε και σβήσε την «Κίνηση». Δες στο πάνελ MQTT το μήνυμα και στην «Ενέργεια» πόσο λίγο ήταν αναμμένο το WiFi.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η πλακέτα μόλις πήρε ρεύμα για πρώτη φορά. Τι επιστρέφει το esp_sleep_get_wakeup_cause();',
        options: ['ESP_SLEEP_WAKEUP_UNDEFINED: δεν ξύπνησε από ύπνο', 'ESP_SLEEP_WAKEUP_EXT0', 'ESP_SLEEP_WAKEUP_TIMER'],
        answer: 0,
        explain: 'Σωστά. Στην πρώτη εκκίνηση δεν υπήρξε ύπνος. Γι’ αυτό ο κώδικας δεν στέλνει κίνηση στην αρχή, μόνο κοιμάται.',
        retry: 'Όχι ακόμα. Υπήρξε ύπνος πριν από την πρώτη εκκίνηση;'
      },
      hints: [
        'Η αιτία και το pin είναι έτοιμες σταθερές.',
        'Η αιτία «από pin» λέγεται ESP_SLEEP_WAKEUP_EXT0. Ο PIR είναι στο PIR_PIN.',
        'if (esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_EXT0) {\n…\nesp_sleep_enable_ext0_wakeup(PIR_PIN, HIGH);'
      ],
      validationTests: [
        { name: 'Χωρίς κίνηση: κοιμάται και δεν στέλνει τίποτα', script: [
          { setup: true }, { ms: 20000 },
          { check: 'published', topic: 'home/motion', is: 0, fail: 'Χωρίς κίνηση στάλθηκαν {n} μηνύματα.' },
          { check: 'avgCurrent', max: 0.5, fail: 'Χωρίς κίνηση το μέσο ρεύμα είναι {v} mA. Περίμενα σχεδόν μηδέν: η πλακέτα πρέπει να κοιμάται.' }
        ] },
        { name: 'Κίνηση → ξυπνά, στέλνει ένα μήνυμα και ξανακοιμάται', script: [
          { setup: true }, { ms: 3000 }, { set: { pir: true } }, { ms: 3000 }, { set: { pir: false } }, { ms: 4000 },
          { check: 'published', topic: 'home/motion', json: { motion: true }, is: 1, fail: 'Στάλθηκαν {n} μηνύματα {"motion":true}. Περίμενα 1. Η πλακέτα ξύπνησε από τον PIR; Η αιτία ελέγχεται σωστά; Τελευταία μηνύματα: {v}.' },
          { check: 'dashboard', topic: 'home/motion', json: { motion: true }, fail: 'Το dashboard βλέπει {v}.' },
          { check: 'wakeups', cause: 2, min: 1, max: 1, fail: 'Η πλακέτα ξύπνησε από pin {n} φορές. Περίμενα 1.' }
        ] },
        { name: 'Δύο κινήσεις → δύο μηνύματα', script: [
          { setup: true }, { ms: 2000 },
          { set: { pir: true } }, { ms: 3000 }, { set: { pir: false } }, { ms: 5000 },
          { set: { pir: true } }, { ms: 3000 }, { set: { pir: false } }, { ms: 5000 },
          { check: 'published', topic: 'home/motion', is: 2, fail: 'Σε δύο κινήσεις στάλθηκαν {n} μηνύματα.' }
        ] }
      ],
      explanationOnSuccess: 'Η συσκευή κοιμάται βαθιά σχεδόν όλη την ώρα και ανάβει το WiFi μόνο για να στείλει. Έτσι δουλεύουν οι αισθητήρες κίνησης και πόρτας με μπαταρία.',
      remediation: 'Αν η πλακέτα ξυπνά συνέχεια, μάλλον κοιμάται όσο ο PIR είναι ακόμα HIGH. Κράτα το while που περιμένει να τελειώσει η κίνηση.'
    },

    {
      id: 'c16-l5', chapter: 16, kind: 'checkpoint', skills: ['power', 'state'],
      title: 'Βρες τα λάθη: η μπαταρία αδειάζει σε μια μέρα',
      prerequisites: ['c16-l4'],
      objectives: ['Να εντοπίζω λάθος μονάδας στο χρονόμετρο αφύπνισης.', 'Να χρησιμοποιώ το μέσο ρεύμα ως τεκμήριο.'],
      theory: `
<p>Ένα εξωτερικό θερμόμετρο έπρεπε να ξυπνά <strong>κάθε 10 λεπτά</strong>, να στέλνει μέτρηση και να ξανακοιμάται. Η μπαταρία του όμως αδειάζει σε λιγότερο από μία μέρα.</p>
<p>Υπάρχουν <strong>δύο</strong> λάθη:</p>
<ul>
  <li>ένα κάνει την πλακέτα να ξυπνά πολύ πιο συχνά απ’ όσο νομίζεις,</li>
  <li>ένα κάνει τον μετρητή εκκινήσεων να δείχνει πάντα 1.</li>
</ul>
<p>Τρέξε τον κώδικα και κοίτα το Serial και το πάνελ ενέργειας. Πόσο συχνά ξυπνά; Πόσο ποσοστό του χρόνου κοιμάται;</p>
<p>Θυμήσου: κάθε ξύπνημα με WiFi κοστίζει περίπου 1,2 δευτερόλεπτα στα 120 mA. Λίγα ξυπνήματα είναι φθηνά, πολλά είναι πολύ ακριβά.</p>`,
      glossary: ['µs (μικροδευτερόλεπτο)', 'RTC_DATA_ATTR', 'deep sleep'],
      supportedSyntax: SYNTAX + ', WiFi.begin, mqtt.connect, mqtt.publish',
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: { broker: OPEN_BROKER, clients: [{ name: 'dashboard', subs: ['home/#'] }] }, initialWorld: {},
      hardware: ['sensor', 'router'], panels: ['serial', 'energy', 'mqtt'],
      steps: [
        'Τρέξε τον κώδικα. Πόσο συχνά τυπώνεται «Boot #…»; Πόσο είναι το μέσο ρεύμα;',
        'Βρες γιατί ξυπνά τόσο συχνά. Κοίτα τις μονάδες του χρονομέτρου.',
        'Βρες γιατί ο μετρητής δείχνει πάντα «Boot #1».',
        'Διόρθωσε και τα δύο και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το SLEEP_SECONDS * 1000 με SLEEP_SECONDS = 600 δίνει 600.000. Πόσο κοιμάται τότε η πλακέτα;',
        options: ['0,6 δευτερόλεπτα, γιατί το χρονόμετρο μετρά σε µs', '10 λεπτά', '600 δευτερόλεπτα'],
        answer: 0,
        explain: 'Σωστά. 600.000 µs = 0,6 s. Η πλακέτα ξυπνά σχεδόν συνέχεια και ανάβει κάθε φορά το WiFi. Για 10 λεπτά χρειάζεται 600 × 1.000.000.',
        retry: 'Όχι ακόμα. Σε τι μονάδα μετρά το esp_sleep_enable_timer_wakeup;'
      },
      hints: [
        'Το ένα λάθος είναι μονάδα μέτρησης. Το άλλο είναι μνήμη που χάνεται στον deep sleep.',
        'Κοίτα τη γραμμή esp_sleep_enable_timer_wakeup(…) και τη δήλωση του bootCount.',
        'esp_sleep_enable_timer_wakeup(SLEEP_SECONDS * 1000000);\nRTC_DATA_ATTR int bootCount = 0;'
      ],
      validationTests: [
        { name: 'Ξυπνά κάθε 10 λεπτά (2 επανεκκινήσεις σε 25 λεπτά)', world: { temp: 14.5 }, script: [
          { setup: true }, { ms: 1500000 },
          { check: 'boots', min: 2, max: 2, fail: 'Σε 25 λεπτά έγιναν {n} επανεκκινήσεις. Περίμενα 2 (στα 10 και στα 20 λεπτά). Έλεγξε τις μονάδες του χρονομέτρου: µs, όχι ms.' },
          { check: 'published', topic: 'home/temperature', min: 3, max: 3, fail: 'Στάλθηκαν {n} μετρήσεις. Περίμενα 3.' }
        ] },
        { name: 'Ο μετρητής εκκινήσεων θυμάται', script: [
          { setup: true }, { ms: 1500000 },
          { check: 'order', texts: ['Boot #1', 'Boot #2', 'Boot #3'], fail: 'Τα μηνύματα εκκίνησης ήταν: {v}. Περίμενα Boot #1, #2, #3.' }
        ] },
        { name: 'Μέσο ρεύμα κάτω από 1 mA (μπαταρία για μήνες)', script: [
          { setup: true }, { ms: 1500000 },
          { check: 'avgCurrent', max: 1, fail: 'Το μέσο ρεύμα είναι {v} mA. Με 2000 mAh αυτό δεν κρατά πολύ.' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο. Το ίδιο θερμόμετρο έπεσε από δεκάδες mA κάτω από 1 mA: από μία μέρα σε πολλούς μήνες μπαταρίας. Το λάθος μονάδας (ms αντί για µs) είναι από τα πιο συχνά σε πραγματικές συσκευές. Το πάνελ ενέργειας ήταν το τεκμήριο που το έδειξε.',
      remediation: 'Αν οι επανεκκινήσεις είναι ακόμα πολλές, μέτρα τα μηδενικά: 1 δευτερόλεπτο = 1.000.000 µs.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
