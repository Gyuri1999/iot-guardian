/*
 * IoT Guardian — Κεφάλαιο 25 (επιπλέον): Ήχος, κίνηση, χρώμα και οθόνη.
 * Buzzer με tone(), servo με το έτοιμο αντικείμενο servo, LED RGB με analogWrite(), οθόνη OLED με το αντικείμενο display.
 * Ανοίγει μετά το Κεφάλαιο 4 (συναρτήσεις και χρόνος).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 25, title: 'Ήχος, κίνηση, χρώμα και οθόνη', ready: true, bonus: true, unlockAfter: 4 });

  [
    { term: 'buzzer', def: 'Μικρό ηχείο που βγάζει ήχο όταν ένα κομματάκι μέταλλο μέσα του τρέμει γρήγορα.' },
    { term: 'συχνότητα (Hz)', def: 'Πόσες φορές το δευτερόλεπτο τρέμει κάτι. 440 Hz είναι η νότα λα· όσο μεγαλύτερη η συχνότητα, τόσο πιο ψιλός ο ήχος.' },
    { term: 'tone', def: 'tone(BUZZER_PIN, 440) ξεκινά ήχο 440 Hz στο buzzer. tone(BUZZER_PIN, 440, 200) τον σταματά μόνο του μετά από 200 ms. noTone(BUZZER_PIN) σωπαίνει το buzzer.' },
    { term: 'servo', def: 'Κινητήρας που γυρίζει σε ακριβή γωνία από 0 έως 180 μοίρες. servo.attach(SERVO_PIN) τον συνδέει, servo.write(90) τον γυρίζει στις 90°.' },
    { term: 'LED RGB', def: 'Τρία LED σε ένα: κόκκινο (Red), πράσινο (Green), μπλε (Blue). Ανακατεύοντάς τα φτιάχνεις σχεδόν κάθε χρώμα.' },
    { term: 'analogWrite', def: 'analogWrite(pin, 0…255) δίνει «λίγο ή πολύ» αντί για μόνο HIGH/LOW: 0 = σβηστό, 255 = όσο πιο φωτεινό γίνεται. Γίνεται με PWM.' },
    { term: 'PWM', def: 'Το pin ανάβει και σβήνει πάρα πολύ γρήγορα. Όσο περισσότερη ώρα μένει αναμμένο, τόσο πιο φωτεινό φαίνεται.' },
    { term: 'OLED', def: 'Μικρή οθόνη όπου κάθε κουκκίδα φωτίζει μόνη της. Η δική μας έχει 128 × 64 κουκκίδες.' },
    { term: 'I2C', def: 'Τρόπος επικοινωνίας με δύο καλώδια: SDA (δεδομένα) και SCL (ρολόι). Πολλές συσκευές μπορούν να μοιράζονται τα ίδια δύο καλώδια.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const PANELS = ['serial', 'vars', 'branch', 'loops'];
  const SYNTAX_BZ = 'pinMode, digitalRead, tone(BUZZER_PIN, συχνότητα [, ms]), noTone(BUZZER_PIN), delay, if / else';
  const SYNTAX_SRV = 'servo.attach(SERVO_PIN), servo.write(γωνία 0–180), servo.read(), digitalRead, if / else';
  const SYNTAX_RGB = 'analogWrite(RGB_RED_PIN / RGB_GREEN_PIN / RGB_BLUE_PIN, 0–255), readTemperature(), float, if / else if / else, δικές σου συναρτήσεις';
  const SYNTAX_OLED = 'display.begin(), display.clearDisplay(), display.setTextSize(n), display.setCursor(x, y), display.print(...), display.println(...), display.display(), readTemperature()';

  // ------------------------------------------------------------ 1. Κουδούνι
  const BELL_OK = `// Το κουδούνι της εισόδου: όσο είναι πατημένο το κουμπί, ακούγεται ήχος.
void setup() {
  pinMode(BUTTON_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
  if (digitalRead(BUTTON_PIN) == HIGH) {
    tone(BUZZER_PIN, 880);     // ήχος 880 Hz (ένα ψιλό «ντινγκ»)
  } else {
    noTone(BUZZER_PIN);        // σιωπή
  }
  delay(20);
}
`;
  const BELL_START = `// Το κουδούνι της εισόδου: όσο είναι πατημένο το κουμπί, ακούγεται ήχος.
void setup() {
  pinMode(BUTTON_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
}

void loop() {
  if (digitalRead(BUTTON_PIN) == HIGH) {
    // ΣΥΜΠΛΗΡΩΣΕ: ήχος 880 Hz στο buzzer
  } else {
    // ΣΥΜΠΛΗΡΩΣΕ: σιωπή
  }
  delay(20);
}
`;

  // ------------------------------------------------------------ 2. Μελωδία
  const MELODY_OK = `// Μια μικρή μελωδία όταν ξεκινά η πλακέτα: ντο, μι, σολ.
void note(int freq, int ms) {
  tone(BUZZER_PIN, freq, ms);  // η νότα σταματά μόνη της μετά από ms
  delay(ms + 50);              // περίμενε να τελειώσει, και μια μικρή παύση
}

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  note(262, 300);   // ντο
  note(330, 300);   // μι
  note(392, 300);   // σολ
}

void loop() {
}
`;
  const MELODY_START = `// Μια μικρή μελωδία όταν ξεκινά η πλακέτα: ντο, μι, σολ.
void note(int freq, int ms) {
  tone(BUZZER_PIN, freq, ms);  // η νότα σταματά μόνη της μετά από ms
  delay(ms + 50);              // περίμενε να τελειώσει, και μια μικρή παύση
}

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  note(262, 300);   // ντο
  // ΣΥΜΠΛΗΡΩΣΕ: μι (330 Hz) και σολ (392 Hz), 300 ms η καθεμία
}

void loop() {
}
`;

  // ------------------------------------------------------------ 3. Πόρτα με servo
  const DOOR_OK = `// Η πόρτα του γκαράζ: με πατημένο το κουμπί ανοίγει (90°), αλλιώς κλείνει (0°).
void setup() {
  pinMode(BUTTON_PIN, INPUT);
  servo.attach(SERVO_PIN);     // το servo είναι στο GPIO 19
  servo.write(0);              // ξεκινάμε με την πόρτα κλειστή
}

void loop() {
  if (digitalRead(BUTTON_PIN) == HIGH) {
    servo.write(90);           // ανοιχτή
  } else {
    servo.write(0);            // κλειστή
  }
  delay(20);
}
`;
  const DOOR_START = `// Η πόρτα του γκαράζ: με πατημένο το κουμπί ανοίγει (90°), αλλιώς κλείνει (0°).
void setup() {
  pinMode(BUTTON_PIN, INPUT);
  // ΣΥΜΠΛΗΡΩΣΕ: σύνδεσε το servo στο SERVO_PIN
  servo.write(0);              // ξεκινάμε με την πόρτα κλειστή
}

void loop() {
  if (digitalRead(BUTTON_PIN) == HIGH) {
    // ΣΥΜΠΛΗΡΩΣΕ: άνοιξε την πόρτα (90°)
  } else {
    servo.write(0);            // κλειστή
  }
  delay(20);
}
`;

  // ------------------------------------------------------------ 4. Φως διάθεσης RGB
  const MOOD_OK = `// Φως διάθεσης: το χρώμα δείχνει τη θερμοκρασία.
// κρύο (κάτω από 20 °C) = μπλε, άνετα (20 έως 28) = πράσινο, ζέστη (πάνω από 28) = κόκκινο
void color(int r, int g, int b) {
  analogWrite(RGB_RED_PIN, r);
  analogWrite(RGB_GREEN_PIN, g);
  analogWrite(RGB_BLUE_PIN, b);
}

void setup() {
  Serial.begin(115200);
}

void loop() {
  float t = readTemperature();
  if (t < 20) {
    color(0, 0, 255);          // μπλε
  } else if (t <= 28) {
    color(0, 255, 0);          // πράσινο
  } else {
    color(255, 0, 0);          // κόκκινο
  }
  delay(1000);
}
`;
  const MOOD_START = `// Φως διάθεσης: το χρώμα δείχνει τη θερμοκρασία.
// κρύο (κάτω από 20 °C) = μπλε, άνετα (20 έως 28) = πράσινο, ζέστη (πάνω από 28) = κόκκινο
void color(int r, int g, int b) {
  analogWrite(RGB_RED_PIN, r);
  analogWrite(RGB_GREEN_PIN, g);
  analogWrite(RGB_BLUE_PIN, b);
}

void setup() {
  Serial.begin(115200);
}

void loop() {
  float t = readTemperature();
  if (t < 20) {
    color(0, 0, 255);          // μπλε
  }
  // ΣΥΜΠΛΗΡΩΣΕ: πράσινο για 20 έως 28, κόκκινο πάνω από 28
  delay(1000);
}
`;

  // ------------------------------------------------------------ 5. Θερμόμετρο στην οθόνη (βρες το λάθος)
  const OLED_OK = `// Θερμόμετρο με οθόνη: η θερμοκρασία γράφεται πάνω στη συσκευή.
void setup() {
  display.begin();
  display.setTextSize(2);      // μεγάλα γράμματα
}

void loop() {
  float t = readTemperature();
  display.clearDisplay();      // σβήσε την προηγούμενη μέτρηση
  display.setCursor(0, 0);
  display.println("Temp:");
  display.print(t);
  display.println(" C");
  display.display();           // ΤΩΡΑ στείλε τα γράμματα στην οθόνη
  delay(1000);
}
`;
  const OLED_BUG = OLED_OK.replace('  display.display();           // ΤΩΡΑ στείλε τα γράμματα στην οθόνη\n', '');

  const TS = (name, script, world) => ({ name, world, script });
  L.lessons.push(
    {
      id: 'c25-l1', chapter: 25, kind: 'micro', skills: ['io', 'conditions'],
      title: 'Το κουδούνι: tone() και noTone()',
      prerequisites: [],
      objectives: ['Να βγάζω ήχο από το buzzer με tone().', 'Να σταματώ τον ήχο με noTone().', 'Να ξέρω τι είναι η συχνότητα.'],
      theory: `
<p>Το <strong>buzzer</strong> είναι ένα μικρό ηχείο. Για να βγάλει ήχο, η πλακέτα το κάνει να τρέμει πολύ γρήγορα.</p>
<p><code>tone(BUZZER_PIN, 880);</code> το κάνει να τρέμει 880 φορές το δευτερόλεπτο: αυτή είναι η <strong>συχνότητα</strong>, σε Hz. Μεγάλη συχνότητα = ψιλός ήχος, μικρή = χοντρός.</p>
<p>Ο ήχος συνεχίζει μέχρι να γράψεις <code>noTone(BUZZER_PIN);</code>.</p>
<p>Στο παιχνίδι ο ήχος ακούγεται και στα ηχεία σου όσο τρέχει ο κώδικας (αν οι ήχοι είναι ανοιχτοί στις Ρυθμίσεις).</p>`,
      glossary: ['buzzer', 'συχνότητα (Hz)', 'tone'], supportedSyntax: SYNTAX_BZ,
      initialCode: BELL_START, solution: BELL_OK,
      world: { button: false }, initialWorld: { button: false }, hardware: ['button', 'buzzer'], panels: PANELS,
      steps: ['Μέσα στο if, γράψε tone(BUZZER_PIN, 880);', 'Μέσα στο else, γράψε noTone(BUZZER_PIN);', 'Τρέξε τον κώδικα και πάτα το κουμπί στη σκηνή.'],
      quiz: { question: 'Τι ήχο βγάζει το tone(BUZZER_PIN, 220) σε σχέση με το tone(BUZZER_PIN, 880);', options: ['Πιο χοντρό (πιο μπάσο)', 'Πιο ψιλό', 'Τον ίδιο, απλώς πιο δυνατά'], answer: 0, explain: 'Σωστά. Λιγότερες δονήσεις το δευτερόλεπτο σημαίνει πιο χοντρό ήχο.', retry: 'Σκέψου: 220 είναι λιγότερες δονήσεις από 880.' },
      hints: ['Ο ήχος ξεκινά με tone(pin, συχνότητα) και σταματά με noTone(pin).', 'Το pin του buzzer λέγεται BUZZER_PIN.', 'if: tone(BUZZER_PIN, 880);   else: noTone(BUZZER_PIN);'],
      validationTests: [
        TS('Χωρίς πάτημα → σιωπή', [{ setup: true }, { loops: 1 }, { check: 'buzzer', is: false, fail: 'Χωρίς πατημένο κουμπί το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → 880 Hz', [{ setup: true }, { sequence: { button: [1] } }, { check: 'buzzer', is: true, freq: 880, fail: 'Με πατημένο κουμπί περίμενα ήχο 880 Hz. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → σιωπή', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'buzzer', is: false, fail: 'Όταν αφήνεις το κουμπί ο ήχος πρέπει να σταματά (noTone). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Το κουδούνι δουλεύει! Το tone() ξεκινά ήχο σε μια συχνότητα και το noTone() τον σταματά.',
      remediation: 'Έλεγξε ότι βάζεις tone() μέσα στο if και noTone() μέσα στο else, και ότι χρησιμοποιείς το BUZZER_PIN.'
    },
    {
      id: 'c25-l2', chapter: 25, kind: 'guided', skills: ['timing', 'io'],
      title: 'Μια μελωδία: ντο, μι, σολ',
      prerequisites: ['c25-l1'],
      objectives: ['Να παίζω νότες με διάρκεια: tone(pin, συχνότητα, ms).', 'Να χρησιμοποιώ μια δική μου συνάρτηση για κάθε νότα.'],
      theory: `
<p>Με τρίτο όρισμα, το <code>tone(BUZZER_PIN, 262, 300)</code> παίζει τη νότα για <strong>300 ms</strong> και σταματά μόνο του.</p>
<p>Το tone() όμως <em>δεν περιμένει</em>: ο κώδικας συνεχίζει αμέσως. Γι' αυτό η συνάρτηση <code>note()</code> κάνει και <code>delay(ms + 50)</code>, ώστε η επόμενη νότα να ξεκινήσει όταν τελειώσει η προηγούμενη.</p>
<p>Μερικές νότες: ντο = 262 Hz, ρε = 294, μι = 330, φα = 349, σολ = 392, λα = 440, σι = 494.</p>`,
      glossary: ['tone', 'συχνότητα (Hz)'], supportedSyntax: SYNTAX_BZ,
      initialCode: MELODY_START, solution: MELODY_OK,
      world: {}, initialWorld: {}, hardware: ['buzzer'], panels: PANELS,
      steps: ['Η συνάρτηση note() είναι έτοιμη.', 'Πρόσθεσε note(330, 300); και note(392, 300); μετά το ντο.', 'Τρέξε και άκουσε τη μελωδία. Δες και τον λογικό αναλυτή.'],
      quiz: { question: 'Τι θα γινόταν αν η note() δεν είχε delay;', options: ['Οι νότες θα ξεκινούσαν σχεδόν μαζί και θα ακουγόταν μόνο η τελευταία', 'Η μελωδία θα έπαιζε πιο αργά', 'Δεν θα ακουγόταν τίποτα'], answer: 0, explain: 'Σωστά. Το tone() δεν περιμένει· κάθε νέο tone() αντικαθιστά το προηγούμενο αμέσως.', retry: 'Το tone() επιστρέφει αμέσως. Τι γίνεται με το επόμενο tone() χωρίς αναμονή;' },
      hints: ['Κάθε νότα είναι μία κλήση note(συχνότητα, διάρκεια).', 'μι = 330 Hz, σολ = 392 Hz.', 'note(330, 300);\nnote(392, 300);'],
      validationTests: [
        TS('Παίζουν και οι τρεις νότες', [{ setup: true }, { ms: 300 }, { check: 'tones', min: 3, freqs: [262, 330, 392], fail: 'Περίμενα τις νότες 262, 330 και 392 Hz. Άκουσα: {v}.' }], {}),
        TS('Μετά τη μελωδία: σιωπή', [{ setup: true }, { ms: 600 }, { check: 'buzzer', is: false, fail: 'Μετά τη μελωδία το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }], {})
      ],
      explanationOnSuccess: 'Μπράβο! Με μια μικρή συνάρτηση και τρεις κλήσεις έφτιαξες μελωδία. Έτσι γίνονται και τα κουδουνίσματα των συσκευών.',
      remediation: 'Χρειάζονται τρεις κλήσεις note(): 262, 330 και 392 Hz.'
    },
    {
      id: 'c25-l3', chapter: 25, kind: 'guided', skills: ['io', 'conditions'],
      title: 'Η πόρτα του γκαράζ: servo',
      prerequisites: ['c25-l2'],
      objectives: ['Να συνδέω το servo με servo.attach().', 'Να το γυρίζω σε γωνία με servo.write().'],
      theory: `
<p>Το <strong>servo</strong> είναι ένας κινητήρας που δεν γυρίζει συνέχεια: πηγαίνει σε μια <strong>γωνία</strong> από 0 έως 180 μοίρες και μένει εκεί.</p>
<p>Στο παιχνίδι υπάρχει έτοιμο ένα αντικείμενο <code>servo</code>:</p>
<ul><li><code>servo.attach(SERVO_PIN);</code> μία φορά, στο <code>setup()</code>: «το servo είναι σε αυτό το pin».</li>
<li><code>servo.write(90);</code> το γυρίζει στις 90°.</li></ul>
<p>Σε πραγματικό ESP32 θα έγραφες στην αρχή <code>#include &lt;ESP32Servo.h&gt;</code> και <code>Servo servo;</code>· οι υπόλοιπες εντολές είναι ίδιες.</p>`,
      glossary: ['servo'], supportedSyntax: SYNTAX_SRV,
      initialCode: DOOR_START, solution: DOOR_OK,
      world: { button: false }, initialWorld: { button: false }, hardware: ['button', 'servo'], panels: PANELS,
      steps: ['Στο setup(), πρόσθεσε servo.attach(SERVO_PIN); πριν από το servo.write(0);', 'Μέσα στο if, γράψε servo.write(90);', 'Τρέξε και πάτα το κουμπί: δες το μπράτσο να γυρίζει.'],
      quiz: { question: 'Τι θα γίνει αν ξεχάσεις το servo.attach(SERVO_PIN);', options: ['Το servo δεν θα κινείται, ό,τι κι αν γράψεις στο servo.write', 'Θα γυρίζει συνέχεια', 'Θα γυρίσει στις 180°'], answer: 0, explain: 'Σωστά. Χωρίς attach η πλακέτα δεν ξέρει σε ποιο pin να στείλει τους παλμούς.', retry: 'Τι λέει το attach στην πλακέτα;' },
      hints: ['Το attach γίνεται μία φορά, στο setup().', 'Η ανοιχτή πόρτα είναι στις 90 μοίρες.', 'setup: servo.attach(SERVO_PIN);   if: servo.write(90);'],
      validationTests: [
        TS('Στην αρχή η πόρτα είναι κλειστή (0°)', [{ setup: true }, { loops: 1 }, { check: 'servo', angle: 0, fail: 'Χωρίς πάτημα περίμενα το servo στις 0°. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → η πόρτα ανοίγει (90°)', [{ setup: true }, { sequence: { button: [1] } }, { check: 'servo', angle: 90, fail: 'Με πατημένο κουμπί περίμενα το servo στις 90°. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → κλείνει', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'servo', angle: 0, fail: 'Όταν αφήνεις το κουμπί η πόρτα πρέπει να κλείνει (0°). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Η πόρτα ανοίγει και κλείνει! Το servo θυμάται τη γωνία μέχρι να του πεις άλλη.',
      remediation: 'Χρειάζεται servo.attach(SERVO_PIN) στο setup() και servo.write(90) όταν είναι πατημένο το κουμπί.'
    },
    {
      id: 'c25-l4', chapter: 25, kind: 'guided', skills: ['sensors', 'conditions', 'io'],
      title: 'Φως διάθεσης: χρώματα με LED RGB',
      prerequisites: ['c25-l3'],
      objectives: ['Να ανακατεύω χρώματα με analogWrite(0–255).', 'Να διαλέγω χρώμα ανάλογα με τη θερμοκρασία.'],
      theory: `
<p>Το <strong>LED RGB</strong> έχει μέσα τρία LED: κόκκινο, πράσινο και μπλε. Με το <code>analogWrite(pin, τιμή)</code> λες πόσο να ανάψει το καθένα: <strong>0</strong> = σβηστό, <strong>255</strong> = όσο πιο πολύ γίνεται.</p>
<ul><li>(255, 0, 0) = κόκκινο · (0, 255, 0) = πράσινο · (0, 0, 255) = μπλε</li>
<li>(255, 255, 0) = κίτρινο · (255, 0, 255) = μωβ · (255, 255, 255) = λευκό</li></ul>
<p>Η συνάρτηση <code>color(r, g, b)</code> είναι έτοιμη και κάνει και τα τρία analogWrite μαζί.</p>`,
      glossary: ['LED RGB', 'analogWrite', 'PWM'], supportedSyntax: SYNTAX_RGB,
      initialCode: MOOD_START, solution: MOOD_OK,
      world: { temp: 24 }, initialWorld: { temp: 24 }, hardware: ['rgb', 'sensor'], panels: PANELS,
      steps: ['Μετά το if, πρόσθεσε else if (t <= 28) με color(0, 255, 0);', 'Πρόσθεσε else με color(255, 0, 0);', 'Τρέξε και άλλαξε τη θερμοκρασία στις «Εισόδους»: δες το χρώμα να αλλάζει.'],
      quiz: { question: 'Ποιο χρώμα δίνει το color(255, 255, 0);', options: ['Κίτρινο', 'Λευκό', 'Μωβ'], answer: 0, explain: 'Σωστά. Κόκκινο + πράσινο φως = κίτρινο.', retry: 'Ανάβουν το κόκκινο και το πράσινο. Τι χρώμα βγάζουν μαζί;' },
      hints: ['Χρειάζεσαι else if και else.', 'Το πράσινο είναι color(0, 255, 0), το κόκκινο color(255, 0, 0).', 'else if (t <= 28) {\n  color(0, 255, 0);\n} else {\n  color(255, 0, 0);\n}'],
      validationTests: [
        TS('15 °C → μπλε', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 0, g: 0, b: 255, fail: 'Στους 15 °C περίμενα μπλε (0, 0, 255). Τώρα: {v}.' }], { temp: 15 }),
        TS('24 °C → πράσινο', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 0, g: 255, b: 0, fail: 'Στους 24 °C περίμενα πράσινο (0, 255, 0). Τώρα: {v}.' }], { temp: 24 }),
        TS('32 °C → κόκκινο', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 255, g: 0, b: 0, fail: 'Στους 32 °C περίμενα κόκκινο (255, 0, 0). Τώρα: {v}.' }], { temp: 32 })
      ],
      explanationOnSuccess: 'Το φως λέει τη θερμοκρασία με μια ματιά! Με τρία analogWrite φτιάχνεις όποιο χρώμα θέλεις.',
      remediation: 'Χρειάζονται τρεις περιπτώσεις: κάτω από 20 μπλε, έως 28 πράσινο, πάνω από 28 κόκκινο.'
    },
    {
      id: 'c25-l5', chapter: 25, kind: 'debug', skills: ['sensors', 'syntax'],
      title: 'Βρες το λάθος: η οθόνη μένει άδεια',
      prerequisites: ['c25-l4'],
      objectives: ['Να γράφω κείμενο και αριθμούς στην οθόνη OLED.', 'Να καταλάβω ότι η οθόνη ενημερώνεται μόνο με display.display().'],
      theory: `
<p>Η οθόνη <strong>OLED</strong> έχει 128 × 64 κουκκίδες και συνδέεται με δύο καλώδια (<strong>I2C</strong>: SDA και SCL). Στο παιχνίδι υπάρχει έτοιμο το αντικείμενο <code>display</code>.</p>
<ol><li><code>display.begin();</code> μία φορά στο setup().</li>
<li><code>display.clearDisplay();</code> σβήνει ό,τι υπήρχε.</li>
<li><code>display.setCursor(0, 0);</code> πάει πάνω αριστερά. <code>display.setTextSize(2);</code> μεγάλα γράμματα.</li>
<li><code>display.print(...)</code> / <code>display.println(...)</code> γράφουν.</li>
<li><code>display.display();</code> <strong>στέλνει</strong> όλα όσα έγραψες στην οθόνη.</li></ol>
<p>Τα print γράφουν σε μια μνήμη μέσα στην πλακέτα. Η οθόνη αλλάζει <em>μόνο</em> όταν καλέσεις <code>display.display()</code>. Κάποιος το ξέχασε σε αυτόν τον κώδικα…</p>`,
      glossary: ['OLED', 'I2C'], supportedSyntax: SYNTAX_OLED,
      initialCode: OLED_BUG, solution: OLED_OK,
      world: { temp: 24.5 }, initialWorld: { temp: 24.5 }, hardware: ['oled', 'sensor'], panels: PANELS,
      steps: ['Τρέξε τον κώδικα: η οθόνη στη σκηνή μένει μαύρη.', 'Βρες τι λείπει μετά τα print.', 'Πρόσθεσέ το και ξανατρέξε.'],
      quiz: { question: 'Γιατί η οθόνη έμενε άδεια;', options: ['Τα print γράφουν σε μνήμη· η οθόνη ενημερώνεται μόνο με display.display()', 'Το display.print δουλεύει μόνο με κείμενο, όχι με αριθμούς', 'Το clearDisplay σβήνει μόνιμα την οθόνη'], answer: 0, explain: 'Σωστά. Πρώτα «ζωγραφίζεις» στη μνήμη και μετά τη στέλνεις όλη μαζί: έτσι η εικόνα δεν τρεμοπαίζει.', retry: 'Τι κάνει το display.display();' },
      hints: ['Η οθόνη ενημερώνεται μόνο με μία συγκεκριμένη εντολή.', 'Κοίτα το βήμα 5 στο «Μάθημα».', 'Πρόσθεσε display.display(); μετά το τελευταίο println.'],
      validationTests: [
        TS('Η θερμοκρασία φαίνεται στην οθόνη', [{ setup: true }, { loops: 1 }, { check: 'oled', has: '24.50', fail: 'Στην οθόνη περίμενα «24.50». Βλέπω: {v}.' }], { temp: 24.5 }),
        TS('Η οθόνη ενημερώνεται με νέα μέτρηση', [{ setup: true }, { loops: 1 }, { set: { temp: 30 } }, { loops: 1 }, { check: 'oled', has: '30.00', fail: 'Μετά από νέα μέτρηση περίμενα «30.00». Βλέπω: {v}.' }], { temp: 24.5 })
      ],
      explanationOnSuccess: 'Η οθόνη ζωντάνεψε! Θυμήσου: clearDisplay, γράψιμο, και στο τέλος display.display().',
      remediation: 'Λείπει το display.display() μετά τα print/println.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
