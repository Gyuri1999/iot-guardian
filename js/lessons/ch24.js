/*
 * IoT Guardian — Κεφάλαιο 24 (επιπλέον): Αισθητήρας στάθμευσης με HC-SR04 και φανάρι.
 * Ανοίγει μετά το Κεφάλαιο 5 (αισθητήρες). Χτίζει πάνω στο millis() του Κεφαλαίου 4.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 24, title: 'Αισθητήρας στάθμευσης: HC-SR04 και φανάρι', ready: true, bonus: true, unlockAfter: 5 });

  [
    { term: 'HC-SR04', def: 'Αισθητήρας απόστασης με υπερήχους. Έχει δύο «μάτια»: το ένα στέλνει ήχο, το άλλο ακούει την ηχώ. Μετρά από 2 έως 400 cm περίπου.' },
    { term: 'υπέρηχος', def: 'Ήχος τόσο ψηλός που δεν τον ακούμε. Το HC-SR04 χρησιμοποιεί 40 kHz.' },
    { term: 'TRIG / ECHO', def: 'Τα δύο pins του HC-SR04. Στο TRIG η πλακέτα στέλνει παλμό 10 µs για να ξεκινήσει μέτρηση. Το ECHO μένει HIGH όσο ταξιδεύει ο ήχος.' },
    { term: 'pulseIn', def: 'pulseIn(ECHO_PIN, HIGH) περιμένει το pin να γίνει HIGH και επιστρέφει πόσα µs έμεινε HIGH. Επιστρέφει 0 αν δεν ήρθε ηχώ.' },
    { term: 'µs (μικροδευτερόλεπτο)', def: 'Ένα εκατομμυριοστό του δευτερολέπτου. 1 ms = 1.000 µs.' },
    { term: 'διαιρέτης τάσης', def: 'Δύο αντιστάσεις που «μικραίνουν» μια τάση, π.χ. από 5 V σε περίπου 3,3 V. Προστατεύει ένα pin του ESP32 από τάση που δεν αντέχει.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX = 'pinMode, digitalWrite, delayMicroseconds(µs), pulseIn(ECHO_PIN, HIGH), float, long, if / else if / else, millis(), unsigned long, δικές σου συναρτήσεις';
  const PANELS = ['serial', 'vars', 'branch', 'loops'];
  const HW = ['ultrasonic', 'traffic'];

  // Κοινά κομμάτια κώδικα
  const TRIGGER = `  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);   // παλμός TRIG: 10 µs
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);`;

  const SETUP_US = `void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}`;

  const SETUP_ALL = `void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RED_PIN, OUTPUT);
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
}`;

  const SET_LIGHT = `// Ανάβει ακριβώς τα φώτα που ζητάς (HIGH) και σβήνει τα άλλα (LOW).
void setLight(int red, int yellow, int green) {
  digitalWrite(RED_PIN, red);
  digitalWrite(YELLOW_PIN, yellow);
  digitalWrite(GREEN_PIN, green);
}`;

  const MEASURE = `// Στέλνει παλμό, μετρά την ηχώ και επιστρέφει cm (0 = καμία ηχώ).
float measure() {
${TRIGGER}
  long duration = pulseIn(ECHO_PIN, HIGH);
  return duration * 0.0343 / 2;
}`;

  // ------------------------------------------------------------ 24.1
  const L1_CODE = (pulse) => `// Μέτρηση απόστασης με το HC-SR04.
${SETUP_US}

void loop() {
${TRIGGER}

  long duration = ${pulse};   // πόσα µs κράτησε η ηχώ
  float cm = duration * 0.0343 / 2;
  Serial.println("Distance: " + cm + " cm");
  delay(500);
}
`;

  // ------------------------------------------------------------ 24.2
  const L2_CODE = (formula, print) => `// Μέτρηση απόστασης: τι σημαίνει το 0;
${SETUP_US}

void loop() {
${TRIGGER}

  long duration = pulseIn(ECHO_PIN, HIGH);
  float cm = ${formula};
${print}
  delay(500);
}
`;
  const L2_PRINT_BAD = `
  // ΣΥΜΠΛΗΡΩΣΕ: αν duration == 0, τύπωσε "No echo" αντί για 0.00
  Serial.println("Distance: " + cm + " cm");`;
  const L2_PRINT_GOOD = `
  if (duration == 0) {
    Serial.println("No echo");   // ούτε ηχώ, ούτε μέτρηση
  } else {
    Serial.println("Distance: " + cm + " cm");
  }`;

  // ------------------------------------------------------------ 24.3
  const L3_CODE = (choose) => `// Φανάρι που αλλάζει με την απόσταση.
${SET_LIGHT}

${SETUP_ALL}

void loop() {
${TRIGGER}
  long duration = pulseIn(ECHO_PIN, HIGH);
  float cm = duration * 0.0343 / 2;
  Serial.println("Distance: " + cm + " cm");

${choose}
  delay(200);
}
`;
  const L3_CHOOSE_BAD = `  if (cm >= ____) {
    setLight(LOW, LOW, HIGH);       // πράσινο: ελεύθερα
  } else if (cm >= ____) {
    setLight(LOW, HIGH, LOW);       // κίτρινο: πρόσεχε
  } else {
    setLight(____, ____, ____);     // ΣΥΜΠΛΗΡΩΣΕ: μόνο κόκκινο
  }`;
  const L3_CHOOSE_GOOD = `  if (cm >= 50) {
    setLight(LOW, LOW, HIGH);       // πράσινο: ελεύθερα
  } else if (cm >= 20) {
    setLight(LOW, HIGH, LOW);       // κίτρινο: πρόσεχε
  } else {
    setLight(HIGH, LOW, LOW);       // κόκκινο: σταμάτα
  }`;

  // ------------------------------------------------------------ 24.4
  const L4_HEAD = `// Αισθητήρας στάθμευσης: μέτρηση κάθε 100 ms, κόκκινο που αναβοσβήνει κάτω από 10 cm.
const int MEASURE_MS = 100;   // κάθε πότε μετράμε
const int BLINK_MS = 250;     // κάθε πότε αλλάζει το κόκκινο στο «STOP»

unsigned long lastMeasure = 0;
unsigned long lastBlink = 0;
float cm = 100;               // η τελευταία μέτρηση
bool redOn = false;           // πώς είναι τώρα το κόκκινο στο «STOP»

${MEASURE}

${SET_LIGHT}

// Το φανάρι για απόσταση από 10 cm και πάνω.
void showLight(float d) {
  if (d >= 50) {
    setLight(LOW, LOW, HIGH);
  } else if (d >= 20) {
    setLight(LOW, HIGH, LOW);
  } else {
    setLight(HIGH, LOW, LOW);
  }
}

${SETUP_ALL}
`;
  const L4_INITIAL = `${L4_HEAD}
void loop() {
  // ΑΛΛΑΞΕ: αυτό το loop() «κολλάει» στα delay.
  // Κάν' το να μετρά κάθε MEASURE_MS και να αλλάζει το κόκκινο κάθε BLINK_MS, με millis().
  cm = measure();
  Serial.println("Distance: " + cm + " cm");

  if (cm > 0 && cm < 10) {
    // STOP: το κόκκινο αναβοσβήνει
    setLight(HIGH, LOW, LOW);
    delay(BLINK_MS);
    setLight(LOW, LOW, LOW);
    delay(BLINK_MS);
  } else {
    showLight(cm);
    delay(MEASURE_MS);
  }
}
`;
  const L4_SOLUTION = `${L4_HEAD}
void loop() {
  unsigned long now = millis();

  // 1. Μέτρηση κάθε MEASURE_MS, χωρίς delay
  if (now - lastMeasure >= MEASURE_MS) {
    lastMeasure = now;
    cm = measure();
    Serial.println("Distance: " + cm + " cm");
  }

  // 2. Φανάρι
  if (cm > 0 && cm < 10) {
    // STOP: το κόκκινο αλλάζει κάθε BLINK_MS
    if (now - lastBlink >= BLINK_MS) {
      lastBlink = now;
      redOn = !redOn;
      if (redOn) {
        setLight(HIGH, LOW, LOW);
      } else {
        setLight(LOW, LOW, LOW);
      }
    }
  } else {
    showLight(cm);
  }
}
`;

  // ------------------------------------------------------------ 24.5
  const L5_CODE = (o) => `// Αισθητήρας στάθμευσης του γκαράζ.
// Παράπονο: «γράφει συνέχεια No echo». Και όταν μετρά, το φανάρι κάνει περίεργα.

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RED_PIN, OUTPUT);
${o.yellowMode}
  pinMode(GREEN_PIN, OUTPUT);
}

float measure() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(${o.pulse});
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH);
  return ${o.formula};
}

void loop() {
  float cm = measure();
  digitalWrite(RED_PIN, LOW);
  digitalWrite(YELLOW_PIN, LOW);
  digitalWrite(GREEN_PIN, LOW);

  if (cm == 0) {
    Serial.println("No echo");
  } else {
    Serial.println("Distance: " + cm + " cm");
    if (cm < 20) {
      digitalWrite(RED_PIN, HIGH);
    }${o.chain} (cm < 50) {
      digitalWrite(YELLOW_PIN, HIGH);
    } else {
      digitalWrite(GREEN_PIN, HIGH);
    }
  }
  delay(200);
}
`;
  const L5_BAD = { yellowMode: '', pulse: 2, formula: 'duration * 0.0343', chain: '\n    if' };
  const L5_GOOD = { yellowMode: '  pinMode(YELLOW_PIN, OUTPUT);', pulse: 10, formula: 'duration * 0.0343 / 2', chain: ' else if' };

  const lightsMsg = (want) => `Στα {d} το φανάρι δείχνει: {v}. Περίμενα μόνο ${want}.`;
  const lightStep = (d, red, yellow, green, want, extra) => ({
    check: 'lights', red, yellow, green,
    fail: lightsMsg(want).replace('{d}', d + ' cm') + (extra ? ' ' + extra : '')
  });

  L.lessons.push(
    {
      id: 'c24-l1', chapter: 24, kind: 'micro', skills: ['sensors', 'io'],
      title: 'Πόσο μακριά είναι; Η πρώτη μέτρηση',
      prerequisites: [],
      objectives: ['Να στέλνω παλμό στο TRIG του HC-SR04.', 'Να μετρώ την ηχώ με pulseIn.', 'Να μετατρέπω τα µs σε εκατοστά.'],
      theory: `
<p>Το <strong>HC-SR04</strong> μετρά απόσταση όπως η νυχτερίδα: με <strong>ήχο</strong>.</p>
<ol>
  <li>Η πλακέτα δίνει έναν σύντομο παλμό στο <code>TRIG_PIN</code>: HIGH για <strong>10 µs</strong>, μετά LOW.</li>
  <li>Ο αισθητήρας στέλνει υπέρηχο. Ο ήχος χτυπά στο εμπόδιο και <strong>γυρίζει πίσω</strong>.</li>
  <li>Όσο ταξιδεύει ο ήχος, το <code>ECHO_PIN</code> μένει HIGH. Το <code>pulseIn(ECHO_PIN, HIGH)</code> μετρά πόσα <strong>µs</strong> κράτησε.</li>
</ol>
<p>Ο ήχος τρέχει <strong>343 m/s</strong>, δηλαδή <strong>0,0343 cm σε κάθε µs</strong>. Για 1 cm απόσταση, ο ήχος πάει και έρχεται: περίπου <strong>58 µs</strong>.</p>
<pre>float cm = duration * 0.0343 / 2;</pre>
<p>Στο εικονικό εργαστήριο σέρνεις το αυτοκινητάκι ή αλλάζεις το «Εμπόδιο».</p>
<p><strong>Ασφάλεια σε αληθινή πλακέτα:</strong> το ECHO του HC-SR04 βγάζει <strong>5 V</strong>. Το ESP32 αντέχει μόνο <strong>3,3 V</strong> στα pins του. Βάλε <strong>διαιρέτη τάσης</strong> (δύο αντιστάσεις) ανάμεσα στο ECHO και στο GPIO 18.</p>`,
      glossary: ['HC-SR04', 'υπέρηχος', 'TRIG / ECHO', 'pulseIn', 'µs (μικροδευτερόλεπτο)', 'διαιρέτης τάσης'],
      supportedSyntax: SYNTAX,
      initialCode: L1_CODE('____'),
      solution: L1_CODE('pulseIn(ECHO_PIN, HIGH)'),
      world: { distance: 35 }, initialWorld: { distance: 35 },
      hardware: ['ultrasonic'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Διάβασε τις γραμμές με το TRIG_PIN: αυτός είναι ο παλμός που ξεκινά τη μέτρηση.',
        'Συμπλήρωσε το κενό με την εντολή που μετρά πόσα µs κράτησε η ηχώ στο ECHO_PIN.',
        'Τρέξε. Σύρε το αυτοκινητάκι πιο κοντά και πιο μακριά. Αλλάζει η απόσταση στο Serial;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το pulseIn επιστρέφει 2915 µs. Περίπου πόσο μακριά είναι το εμπόδιο; (περίπου 58 µs ανά cm)',
        options: ['Περίπου 50 cm', 'Περίπου 100 cm', 'Περίπου 29 cm'],
        answer: 0,
        explain: 'Σωστά. 2915 ÷ 58 ≈ 50 cm. Τα 58 µs ανά cm περιέχουν ήδη το «πάει και έρχεται».',
        retry: 'Όχι ακόμα. Διαίρεσε τα µs με το 58.'
      },
      hints: [
        'Η διάρκεια της ηχούς μετριέται με μία εντολή που «ακούει» το ECHO_PIN.',
        'Η εντολή είναι το pulseIn. Θέλει δύο ορίσματα: το pin της ηχούς και ποιο επίπεδο μετράμε (HIGH).',
        'long duration = pulseIn(ECHO_PIN, HIGH);\n• ECHO_PIN = το pin που ακούει\n• HIGH = μέτρα πόσο έμεινε HIGH'
      ],
      validationTests: [
        { name: 'Εμπόδιο στα 35 cm → «Distance: 35.00 cm»', world: { distance: 35 }, script: [
          { setup: true }, { loops: 3 },
          { check: 'count', text: 'Distance: 35.00 cm', is: 3, fail: 'Σε 3 επαναλήψεις τυπώθηκε {n} φορές «Distance: 35.00 cm». Περίμενα 3.', failZero: 'Δεν τυπώθηκε «Distance: 35.00 cm». Μετράς την ηχώ με pulseIn(ECHO_PIN, HIGH);' }
        ] },
        { name: 'Η μέτρηση ακολουθεί το εμπόδιο (80 cm)', world: { distance: 80 }, script: [
          { setup: true }, { loops: 2 },
          { check: 'lastLine', is: 'Distance: 79.99 cm', fail: 'Με εμπόδιο στα 80 cm η τελευταία γραμμή είναι {v}. Περίμενα «Distance: 79.99 cm».' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα μετρά απόσταση! Τα 79.99 αντί για 80 είναι φυσιολογικά: το pulseIn μετρά ακέραια µs, οπότε υπάρχει ένα μικρό σφάλμα. Και οι αληθινοί αισθητήρες έχουν ακρίβεια περίπου ±0,3 cm.',
      remediation: 'Αν βλέπεις «Distance: 0.00 cm», έλεγξε ότι γράφεις ECHO_PIN μέσα στο pulseIn και ότι ο παλμός TRIG κρατά 10 µs.'
    },

    {
      id: 'c24-l2', chapter: 24, kind: 'guided', skills: ['sensors', 'conditions'],
      title: 'Γιατί / 2; Και τι σημαίνει το 0;',
      prerequisites: ['c24-l1'],
      objectives: ['Να εξηγώ γιατί ο τύπος διαιρεί με το 2.', 'Να αναγνωρίζω το 0 του pulseIn ως «καμία ηχώ».', 'Να τυπώνω καθαρό μήνυμα αντί για ψεύτικη μέτρηση.'],
      theory: `
<p>Ο ήχος κάνει <strong>δύο</strong> διαδρομές: από τον αισθητήρα στο εμπόδιο, και πίσω.</p>
<p>Το <code>duration * 0.0343</code> δίνει <strong>όλη</strong> τη διαδρομή. Η απόσταση είναι η <strong>μισή</strong>: γι’ αυτό <code>/ 2</code>.</p>
<p>Το <code>pulseIn</code> επιστρέφει <strong>0</strong> όταν <strong>δεν ήρθε ηχώ</strong>:</p>
<ul>
  <li>δεν στάλθηκε παλμός στο TRIG (ή ήταν πολύ σύντομος),</li>
  <li>το εμπόδιο είναι πολύ μακριά (πάνω από ~400 cm) ή πολύ κοντά (κάτω από 2 cm),</li>
  <li>κάποιο καλώδιο είναι λάθος.</li>
</ul>
<p>Το 0 <strong>δεν</strong> σημαίνει «εμπόδιο στα 0 cm». Σημαίνει «δεν ξέρω». Ένας αισθητήρας στάθμευσης που τυπώνει «0.00 cm» μπερδεύει τον οδηγό.</p>
<p>Σωστό είναι να το ελέγχεις: <code>if (duration == 0) { … }</code></p>`,
      glossary: ['pulseIn', 'TRIG / ECHO'],
      supportedSyntax: SYNTAX,
      initialCode: L2_CODE('duration * 0.0343', L2_PRINT_BAD),
      solution: L2_CODE('duration * 0.0343 / 2', L2_PRINT_GOOD),
      world: { distance: 35 }, initialWorld: { distance: 35 },
      hardware: ['ultrasonic'], panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα με εμπόδιο στα 35 cm. Τι απόσταση τυπώνει; Γιατί;',
        'Διόρθωσε τον τύπο της απόστασης.',
        'Πρόσθεσε ένα if: όταν το duration είναι 0, τύπωσε «No echo». Αλλιώς τύπωσε την απόσταση.',
        'Δοκίμασε: βάλε προσωρινά σε σχόλιο τη γραμμή delayMicroseconds(10);. Τι τυπώνεται τώρα; Μετά ξαναβάλ’ την.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Χωρίς το / 2, το εμπόδιο στα 35 cm φαίνεται στα…',
        options: ['70 cm: μετράμε όλη τη διαδρομή, πήγαινε-έλα', '17,5 cm', '35 cm: δεν αλλάζει τίποτα'],
        answer: 0,
        explain: 'Σωστά. Ο ήχος ταξίδεψε 35 cm ως το εμπόδιο και 35 cm πίσω: 70 cm συνολικά. Η απόσταση είναι η μισή διαδρομή.',
        retry: 'Όχι ακόμα. Πόσες φορές διανύει ο ήχος την απόσταση ως το εμπόδιο;'
      },
      hints: [
        'Δύο αλλαγές: ο τύπος θέλει το μισό της διαδρομής, και το 0 θέλει δικό του μήνυμα.',
        'Πρόσθεσε / 2 στο τέλος του τύπου. Μετά κάνε το Serial.println μέρος ενός if (duration == 0) { … } else { … }.',
        'float cm = duration * 0.0343 / 2;\nif (duration == 0) {\n  Serial.println("No echo");\n} else {\n  Serial.println("Distance: " + cm + " cm");\n}'
      ],
      validationTests: [
        { name: 'Εμπόδιο στα 35 cm → σωστή απόσταση', world: { distance: 35 }, script: [
          { setup: true }, { loops: 2 },
          { check: 'count', text: 'Distance: 35.00 cm', is: 2, fail: 'Με εμπόδιο στα 35 cm τυπώθηκε {n} φορές «Distance: 35.00 cm». Τελευταία γραμμή: δες το Serial. Αν βλέπεις περίπου 70, λείπει το / 2.' }
        ] },
        { name: 'Καμία ηχώ (τίποτα μπροστά) → «No echo», όχι «0.00 cm»', world: { distance: 35 }, script: [
          { setup: true }, { loops: 1 },
          { set: { distance: 500 } }, { loops: 2 },
          { check: 'count', text: 'No echo', is: 2, fail: 'Χωρίς ηχώ τυπώθηκε {n} φορές «No echo». Περίμενα 2.' },
          { check: 'serialNot', text: '0.00 cm', fail: 'Τυπώθηκε «0.00 cm». Το 0 σημαίνει «καμία ηχώ», όχι απόσταση. Έλεγξε το duration == 0 πριν τυπώσεις.' }
        ] },
        { name: 'Όταν γυρίσει το εμπόδιο, ξαναμετρά', world: { distance: 500 }, script: [
          { setup: true }, { loops: 1 },
          { set: { distance: 80 } }, { loops: 1 },
          { check: 'lastLine', is: 'Distance: 79.99 cm', fail: 'Με εμπόδιο στα 80 cm η τελευταία γραμμή είναι {v}. Περίμενα «Distance: 79.99 cm».' }
        ] }
      ],
      explanationOnSuccess: 'Τώρα ο αισθητήρας λέει την αλήθεια: απόσταση όταν μετρά, «No echo» όταν δεν ξέρει. Ο έλεγχος για «άκυρη τιμή» είναι ίδιος με το isnan() του θερμομέτρου στο Κεφάλαιο 5.',
      remediation: 'Το if ελέγχει το duration (τα µs), όχι το cm. Βάλε και τα δύο Serial.println μέσα στο if / else.'
    },

    {
      id: 'c24-l3', chapter: 24, kind: 'guided', skills: ['sensors', 'conditions', 'io'],
      title: 'Φανάρι που βλέπει την απόσταση',
      prerequisites: ['c24-l2'],
      objectives: ['Να επιλέγω ανάμεσα σε τρεις περιπτώσεις με if / else if / else.', 'Να ανάβω πάντα ακριβώς ένα φως.'],
      theory: `
<p>Ένα φανάρι στάθμευσης έχει τρία φώτα:</p>
<ul>
  <li><strong>50 cm και πάνω:</strong> πράσινο (ελεύθερα),</li>
  <li><strong>από 20 έως 49 cm:</strong> κίτρινο (πρόσεχε),</li>
  <li><strong>κάτω από 20 cm:</strong> κόκκινο (σταμάτα).</li>
</ul>
<p>Με <code>if / else if / else</code> τρέχει <strong>μόνο ένα</strong> μπλοκ: το πρώτο που η συνθήκη του είναι αληθινή.</p>
<pre>if (cm >= 50) {        // πρώτα το μεγαλύτερο όριο
  …πράσινο…
} else if (cm >= 20) { // εδώ ξέρουμε ήδη ότι cm < 50
  …κίτρινο…
} else {               // όλα τα υπόλοιπα: cm < 20
  …κόκκινο…
}</pre>
<p>Η συνάρτηση <code>setLight(red, yellow, green)</code> γράφει <strong>και τα τρία</strong> φώτα μαζί. Έτσι δεν μένει ποτέ αναμμένο ένα παλιό φως.</p>
<p>Τα φώτα είναι στα <code>RED_PIN</code>, <code>YELLOW_PIN</code>, <code>GREEN_PIN</code>, όλα OUTPUT.</p>`,
      glossary: ['όριο', 'TRIG / ECHO'],
      supportedSyntax: SYNTAX,
      initialCode: L3_CODE(L3_CHOOSE_BAD),
      solution: L3_CODE(L3_CHOOSE_GOOD),
      world: { distance: 80 }, initialWorld: { distance: 80 },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τα δύο όρια: πρώτα του πράσινου, μετά του κίτρινου.',
        'Συμπλήρωσε το setLight του κόκκινου: μόνο το κόκκινο HIGH.',
        'Τρέξε. Σύρε το αυτοκινητάκι από μακριά προς τον αισθητήρα. Κοίτα τον πίνακα «Διακλάδωση»: ποιο μπλοκ τρέχει;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η απόσταση είναι 65 cm. Ποια μπλοκ τρέχουν στο if (cm >= 50) … else if (cm >= 20) … else …;',
        options: ['Μόνο το πρώτο (πράσινο)', 'Το πρώτο και το δεύτερο, γιατί 65 ≥ 20', 'Όλα'],
        answer: 0,
        explain: 'Σωστά. Το 65 ≥ 20 είναι αληθινό, αλλά το else if ελέγχεται μόνο αν το πρώτο if ήταν ψευδές. Τρέχει μόνο ένα μπλοκ.',
        retry: 'Όχι ακόμα. Πότε ελέγχεται ένα else if;'
      },
      hints: [
        'Ξεκίνα από το μεγαλύτερο όριο. Κάθε else if «ξέρει» ότι οι προηγούμενες συνθήκες ήταν ψευδείς.',
        'Πράσινο από 50 και πάνω, κίτρινο από 20 και πάνω. Στο κόκκινο: HIGH στο πρώτο όρισμα, LOW στα άλλα δύο.',
        'if (cm >= 50) {\n  setLight(LOW, LOW, HIGH);\n} else if (cm >= 20) {\n  setLight(LOW, HIGH, LOW);\n} else {\n  setLight(HIGH, LOW, LOW);\n}'
      ],
      validationTests: [
        { name: '80 cm → μόνο πράσινο', world: { distance: 80 }, script: [
          { setup: true }, { loops: 1 },
          lightStep(80, false, false, true, 'το πράσινο')
        ] },
        { name: 'Το αυτοκίνητο πλησιάζει: πράσινο → κίτρινο → κόκκινο', world: { distance: 120 }, script: [
          { setup: true },
          { sequence: { distance: [120, 60] } }, lightStep(60, false, false, true, 'το πράσινο'),
          { sequence: { distance: [45] } }, lightStep(45, false, true, false, 'το κίτρινο', 'Από 20 έως 49 cm: κίτρινο.'),
          { sequence: { distance: [25] } }, lightStep(25, false, true, false, 'το κίτρινο'),
          { sequence: { distance: [15] } }, lightStep(15, true, false, false, 'το κόκκινο', 'Κάτω από 20 cm: μόνο κόκκινο.'),
          { sequence: { distance: [5] } }, lightStep(5, true, false, false, 'το κόκκινο')
        ] },
        { name: 'Το αυτοκίνητο φεύγει: κόκκινο → κίτρινο → πράσινο', world: { distance: 10 }, script: [
          { setup: true },
          { sequence: { distance: [10] } }, lightStep(10, true, false, false, 'το κόκκινο'),
          { sequence: { distance: [30] } }, lightStep(30, false, true, false, 'το κίτρινο', 'Μήπως έμεινε αναμμένο το κόκκινο;'),
          { sequence: { distance: [150] } }, lightStep(150, false, false, true, 'το πράσινο', 'Μήπως έμεινε αναμμένο κάποιο παλιό φως;'),
          { check: 'serialHas', text: 'Distance: 149.98 cm', fail: 'Δεν βλέπω τη μέτρηση των 150 cm στο Serial. Τελευταίες γραμμές: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Το φανάρι αλλάζει μόνο του με την απόσταση και πάντα ανάβει ένα μόνο φως. Η σειρά των ορίων μετράει: από το μεγαλύτερο προς το μικρότερο.',
      remediation: 'Αν δεν ανάβει κανένα φως, έλεγξε τα pinMode(…, OUTPUT) στο setup(). Αν ανάβουν δύο, έλεγξε ότι χρησιμοποιείς else if και ότι το setLight γράφει και τα τρία φώτα.'
    },

    {
      id: 'c24-l4', chapter: 24, kind: 'variant', skills: ['timing', 'sensors', 'conditions'],
      title: 'Μέτρα κάθε 100 ms και αναβόσβησε στο STOP',
      prerequisites: ['c24-l3'],
      objectives: ['Να μετρώ περιοδικά με millis() αντί για delay.', 'Να κάνω δύο χρονισμούς μαζί: μέτρηση και αναβόσβημα.', 'Να αντιδρά το φανάρι αμέσως όταν αλλάζει η απόσταση.'],
      theory: `
<p>Πολύ κοντά (κάτω από <strong>10 cm</strong>) ο οδηγός πρέπει να σταματήσει: το κόκκινο <strong>αναβοσβήνει</strong> κάθε 250 ms.</p>
<p>Ο αρχικός κώδικας το κάνει με <code>delay</code>. Το πρόβλημα: όσο περιμένει, <strong>δεν μετρά</strong>. Ο αισθητήρας «τυφλώνεται» για μισό δευτερόλεπτο.</p>
<p>Θυμήσου το Κεφάλαιο 4. Αντί να περιμένεις, <strong>ρωτάς</strong> σε κάθε επανάληψη:</p>
<pre>unsigned long now = millis();
if (now - lastMeasure >= MEASURE_MS) {
  lastMeasure = now;
  …μέτρησε…
}</pre>
<p>Εδώ χρειάζεσαι <strong>δύο</strong> τέτοια ρολόγια:</p>
<ul>
  <li><code>lastMeasure</code>: μέτρηση κάθε 100 ms,</li>
  <li><code>lastBlink</code>: αλλαγή του κόκκινου κάθε 250 ms, μόνο στο STOP.</li>
</ul>
<p>Το <code>redOn = !redOn;</code> αλλάζει το true σε false και το αντίστροφο.</p>`,
      glossary: ['millis', 'μη μπλοκαριστικός χρονισμός', 'μπλοκάρισμα'],
      supportedSyntax: SYNTAX,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: { distance: 35 }, initialWorld: { distance: 35 },
      hardware: HW, panels: PANELS,
      steps: [
        'Τρέξε. Βάλε το αυτοκινητάκι στα 8 cm. Πόσες μετρήσεις τυπώνονται το δευτερόλεπτο; Μετά τράβηξέ το γρήγορα μακριά: πόσο αργεί να αλλάξει το φανάρι;',
        'Απάντησε στην ερώτηση.',
        'Γράψε ξανά το loop() χωρίς delay: πρώτα η μέτρηση κάθε MEASURE_MS με millis().',
        'Μετά το STOP: άλλαξε το redOn κάθε BLINK_MS με το lastBlink, και άναψε ή σβήσε το κόκκινο.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Στον αρχικό κώδικα, στο STOP, πόσες μετρήσεις γίνονται σε 1 δευτερόλεπτο;',
        options: ['Περίπου 2: κάθε επανάληψη κολλάει 500 ms στα delay', 'Περίπου 10', 'Περίπου 4'],
        answer: 0,
        explain: 'Σωστά. Δύο delay(250) σε κάθε επανάληψη: 500 ms χωρίς μέτρηση. Με millis() η μέτρηση γίνεται κάθε 100 ms, ό,τι κι αν κάνει το φανάρι.',
        retry: 'Όχι ακόμα. Πόσο κρατούν μαζί τα δύο delay(BLINK_MS);'
      },
      hints: [
        'Δύο ανεξάρτητα «ρολόγια» με millis(): ένα για τη μέτρηση, ένα για το αναβόσβημα. Κανένα delay.',
        'Στην αρχή του loop() κράτα το now = millis(). Η μέτρηση μπαίνει σε if (now - lastMeasure >= MEASURE_MS). Στο STOP, το redOn αλλάζει σε if (now - lastBlink >= BLINK_MS).',
        'unsigned long now = millis();\nif (now - lastMeasure >= MEASURE_MS) {\n  lastMeasure = now;\n  cm = measure();\n  Serial.println("Distance: " + cm + " cm");\n}\nif (cm > 0 && cm < 10) {\n  if (now - lastBlink >= BLINK_MS) {\n    lastBlink = now;\n    redOn = !redOn;\n    if (redOn) { setLight(HIGH, LOW, LOW); } else { setLight(LOW, LOW, LOW); }\n  }\n} else {\n  showLight(cm);\n}'
      ],
      validationTests: [
        { name: 'Περίπου 10 μετρήσεις το δευτερόλεπτο (35 cm)', world: { distance: 35 }, script: [
          { setup: true }, { ms: 1050 },
          { check: 'count', text: 'Distance: 35.00 cm', min: 9, max: 11, fail: 'Σε 1 δευτερόλεπτο τυπώθηκαν {n} μετρήσεις. Περίμενα περίπου 10 (μία κάθε 100 ms).' },
          { check: 'lights', red: false, yellow: true, green: false, fail: 'Στα 35 cm το φανάρι δείχνει: {v}. Περίμενα μόνο το κίτρινο.' }
        ] },
        { name: 'STOP (8 cm): συνεχίζει να μετρά και το κόκκινο αναβοσβήνει κάθε 250 ms', world: { distance: 8 }, script: [
          { setup: true }, { ms: 400 },
          { check: 'lights', red: true, yellow: false, green: false, fail: 'Στα 400 ms το φανάρι δείχνει: {v}. Περίμενα αναμμένο μόνο το κόκκινο (άναψε στα 250 ms).' },
          { ms: 250 },
          { check: 'lights', red: false, yellow: false, green: false, fail: 'Στα 650 ms το φανάρι δείχνει: {v}. Περίμενα όλα σβηστά (το κόκκινο σβήνει στα 500 ms).' },
          { ms: 250 },
          { check: 'lights', red: true, yellow: false, green: false, fail: 'Στα 900 ms το φανάρι δείχνει: {v}. Περίμενα ξανά μόνο το κόκκινο (στα 750 ms).' },
          { check: 'count', text: 'Distance: 7.99 cm', min: 8, fail: 'Σε 900 ms στο STOP τυπώθηκαν {n} μετρήσεις. Περίμενα τουλάχιστον 8. Τα delay «τυφλώνουν» τον αισθητήρα: χρησιμοποίησε millis().' }
        ] },
        { name: 'Το αυτοκίνητο απομακρύνεται: το φανάρι αλλάζει μέσα σε 300 ms', world: { distance: 8 }, script: [
          { setup: true }, { ms: 600 },
          { set: { distance: 35 } }, { ms: 300 },
          { check: 'lights', red: false, yellow: true, green: false, fail: 'Το αυτοκίνητο έφυγε στα 35 cm πριν από 300 ms, αλλά το φανάρι δείχνει: {v}. Περίμενα μόνο κίτρινο.' },
          { check: 'lastLine', is: 'Distance: 35.00 cm', fail: 'Η τελευταία μέτρηση είναι {v}. Περίμενα «Distance: 35.00 cm».' }
        ] }
      ],
      explanationOnSuccess: 'Τώρα ο αισθητήρας μετρά 10 φορές το δευτερόλεπτο, ό,τι κι αν κάνει το φανάρι. Δύο χρονισμοί τρέχουν «μαζί» χωρίς να μπλοκάρει ο ένας τον άλλον. Έτσι δουλεύουν και οι αληθινοί αισθητήρες στάθμευσης.',
      remediation: 'Αν οι μετρήσεις είναι πάρα πολλές, μήπως ξέχασες το lastMeasure = now; μέσα στο if; Αν το κόκκινο δεν αναβοσβήνει, έλεγξε το lastBlink = now; και το redOn = !redOn;.'
    },

    {
      id: 'c24-l5', chapter: 24, kind: 'checkpoint', skills: ['sensors', 'io', 'conditions'],
      title: 'Βρες τα λάθη: ο αισθητήρας του γκαράζ',
      prerequisites: ['c24-l4'],
      objectives: ['Να εντοπίζω λάθη στον παλμό TRIG, στον τύπο και στα pins.', 'Να διορθώνω όρια ώστε να ανάβει πάντα ένα φως.'],
      theory: `
<p>Ένας αισθητήρας στάθμευσης για το γκαράζ γράφει συνέχεια «No echo». Υπάρχουν <strong>τέσσερα</strong> λάθη:</p>
<ul>
  <li>ένα στον <strong>παλμό TRIG</strong> (πόσο κρατά;),</li>
  <li>ένα στον <strong>τύπο</strong> της απόστασης,</li>
  <li>ένα στο <code>setup()</code>: ένα φως δεν ανάβει ποτέ,</li>
  <li>ένα στα <strong>if</strong>: κάποιες φορές ανάβουν δύο φώτα μαζί.</li>
</ul>
<p>Διόρθωνε <strong>ένα-ένα</strong> και τρέχε ξανά. Κάθε διόρθωση αποκαλύπτει το επόμενο λάθος.</p>
<p>Κοίτα και τις <strong>προειδοποιήσεις</strong> κάτω από τον editor: ο προσομοιωτής λέει αν ο παλμός TRIG ήταν πολύ σύντομος.</p>
<p>Ένα ακόμα συχνό λάθος σε αληθινή πλακέτα: <code>pinMode(ECHO_PIN, OUTPUT)</code>. Το ECHO είναι <strong>είσοδος</strong>: ο αισθητήρας γράφει, η πλακέτα ακούει.</p>`,
      glossary: ['TRIG / ECHO', 'pulseIn', 'όριο'],
      supportedSyntax: SYNTAX,
      initialCode: L5_CODE(L5_BAD),
      solution: L5_CODE(L5_GOOD),
      world: { distance: 35 }, initialWorld: { distance: 35 },
      hardware: HW, panels: PANELS,
      steps: [
        'Τρέξε. Διάβασε την προειδοποίηση για τον παλμό TRIG και διόρθωσέ τον.',
        'Τρέξε ξανά με το αυτοκινητάκι στα 35 cm. Η απόσταση στο Serial είναι σωστή;',
        'Σύρε το αυτοκινητάκι σε 80, 35 και 12 cm. Ανάβει πάντα ένα φως; Ανάβει ποτέ το κίτρινο;',
        'Διόρθωσε όλα τα λάθη και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Με if (cm < 20) {…} και μετά ξεχωριστό if (cm < 50) {…} else {…}, τι ανάβει στα 12 cm;',
        options: ['Κόκκινο και κίτρινο μαζί', 'Μόνο κόκκινο', 'Μόνο πράσινο'],
        answer: 0,
        explain: 'Σωστά. Τα δύο if είναι ανεξάρτητα: 12 < 20 ανάβει το κόκκινο, και 12 < 50 ανάβει και το κίτρινο. Με else if τρέχει μόνο το πρώτο.',
        retry: 'Όχι ακόμα. Δύο χωριστά if ελέγχονται και τα δύο, πάντα.'
      },
      hints: [
        'Παλμός TRIG 10 µs, απόσταση = μισή διαδρομή, κάθε φως θέλει OUTPUT, και μία μόνο αλυσίδα if / else if / else.',
        'Κοίτα: το delayMicroseconds μετά το HIGH, το return του measure(), τα pinMode στο setup(), και το δεύτερο if στο loop().',
        'delayMicroseconds(10);\nreturn duration * 0.0343 / 2;\npinMode(YELLOW_PIN, OUTPUT);\n} else if (cm < 50) {'
      ],
      validationTests: [
        { name: 'Μετρά σωστά (35 cm)', world: { distance: 35 }, script: [
          { setup: true }, { loops: 2 },
          { check: 'serialNot', text: 'No echo', fail: 'Τυπώθηκε «No echo» ενώ το εμπόδιο είναι στα 35 cm. Ο παλμός TRIG είναι αρκετά μεγάλος (10 µs);' },
          { check: 'lastLine', is: 'Distance: 35.00 cm', fail: 'Με εμπόδιο στα 35 cm η τελευταία γραμμή είναι {v}. Περίμενα «Distance: 35.00 cm». Αν είναι περίπου 70, λείπει κάτι από τον τύπο.' }
        ] },
        { name: 'Ένα φως κάθε φορά: 80 → 35 → 12 → 60 cm', world: { distance: 80 }, script: [
          { setup: true },
          { sequence: { distance: [80] } }, lightStep(80, false, false, true, 'το πράσινο'),
          { sequence: { distance: [35] } }, lightStep(35, false, true, false, 'το κίτρινο', 'Αν δεν ανάβει τίποτα, έχει το YELLOW_PIN pinMode OUTPUT;'),
          { sequence: { distance: [12] } }, lightStep(12, true, false, false, 'το κόκκινο', 'Αν ανάβουν δύο φώτα, θέλεις else if.'),
          { sequence: { distance: [60] } }, lightStep(60, false, false, true, 'το πράσινο')
        ] },
        { name: 'Πολύ κοντά (5 cm) → μόνο κόκκινο', world: { distance: 5 }, script: [
          { setup: true }, { loops: 2 },
          lightStep(5, true, false, false, 'το κόκκινο'),
          { check: 'serialHas', text: 'Distance: 5.01 cm', fail: 'Δεν βλέπω μέτρηση περίπου 5 cm στο Serial. Τελευταίες γραμμές: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο! Ο αισθητήρας μετρά, ο τύπος παίρνει τη μισή διαδρομή, και το φανάρι ανάβει πάντα ένα μόνο φως. Αυτά τα τέσσερα λάθη είναι από τα πιο συχνά σε αληθινά έργα με HC-SR04.',
      remediation: 'Αν βλέπεις ακόμα «No echo», η προειδοποίηση κάτω από τον editor λέει πόσο κράτησε ο παλμός TRIG. Χρειάζεται τουλάχιστον 10 µs.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
