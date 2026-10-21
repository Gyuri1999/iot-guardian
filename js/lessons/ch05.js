/*
 * IoT Guardian — Κεφάλαιο 5: Αισθητήρες και δεδομένα.
 * Έννοιες: float, μονάδες, όρια, άκυρη μέτρηση (nan / isnan), υστέρηση, απλό JSON.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 5).ready = true;

  const SYNTAX_CH5 = 'Ό,τι μέχρι το Κεφ. 4, συν: float, readTemperature(), readHumidity(), isnan(), συνένωση κειμένου με +, else if, συναρτήσεις που επιστρέφουν String';
  const PANELS = ['serial', 'vars', 'branch', 'loops'];
  const HW = ['sensor'];

  L.GLOSSARY.push(
    { term: 'float', def: 'Τύπος για αριθμούς με δεκαδικά, π.χ. 22.5. Το int κρατά μόνο ακέραιους και κόβει τα δεκαδικά.' },
    { term: 'μονάδα μέτρησης', def: 'Τι σημαίνει ο αριθμός: °C για θερμοκρασία, % για υγρασία. Ένας αριθμός χωρίς μονάδα μπερδεύει.' },
    { term: 'όριο', def: 'Μια τιμή-σύνορο. Π.χ. «προειδοποίηση από 30.0 °C και πάνω». Πρέπει να ξέρεις τι γίνεται και ακριβώς πάνω στο όριο.' },
    { term: 'nan / isnan', def: 'nan = «not a number», όχι αριθμός. Ένας αισθητήρας με βλάβη δίνει nan. Κάθε σύγκριση με nan είναι false. Το isnan(t) ρωτά «είναι το t άκυρο;».' },
    { term: 'υστέρηση', def: 'Δύο όρια αντί για ένα: ένα για να ανάψει ο συναγερμός και ένα χαμηλότερο για να σβήσει. Έτσι δεν αναβοσβήνει όταν η τιμή «χορεύει» γύρω από το όριο.' },
    { term: 'JSON', def: 'Απλή μορφή κειμένου για δεδομένα: {"temp":22.50,"hum":45.00}. Κλειδιά σε εισαγωγικά, άνω-κάτω τελεία, τιμή, κόμμα ανάμεσα.' },
    { term: 'payload', def: 'Το «φορτίο» ενός μηνύματος: τα δεδομένα που στέλνεις, π.χ. ένα κείμενο JSON.' },
    { term: 'συνένωση κειμένου', def: 'Με το + ενώνεις κείμενα και αριθμούς: "Temp: " + t δίνει π.χ. Temp: 22.50' }
  );

  L.lessons.push(
    // ------------------------------------------------------------ c5-l1
    {
      id: 'c5-l1', chapter: 5, kind: 'micro', skills: ['sensors', 'variables'],
      title: 'Δεκαδικοί αριθμοί και μονάδες',
      prerequisites: [],
      objectives: ['Να διαβάζω θερμοκρασία από τον εικονικό αισθητήρα.', 'Να ξεχωρίζω int από float.', 'Να τυπώνω μια μέτρηση μαζί με τη μονάδα της.'],
      theory: `
<p>Η εντολή <code>readTemperature()</code> επιστρέφει τη θερμοκρασία σε <strong>βαθμούς Κελσίου</strong>, π.χ. <code>22.5</code>.</p>
<p>Αυτός ο αριθμός έχει <strong>δεκαδικά</strong>. Για να τον κρατήσεις χρειάζεσαι τύπο <code>float</code>.</p>
<ul>
  <li><code>int t = 22.5;</code> → το t γίνεται <strong>22</strong>. Τα δεκαδικά χάνονται.</li>
  <li><code>float t = 22.5;</code> → το t μένει <strong>22.5</strong>.</li>
</ul>
<p>Με το <code>+</code> ενώνεις κείμενο και αριθμό: <code>"Temp: " + t + " C"</code>. Το float τυπώνεται με 2 δεκαδικά: <code>Temp: 22.50 C</code>.</p>
<p>Πάντα γράφε τη <strong>μονάδα</strong>. Το «22.50» μόνο του δεν λέει αν είναι °C, °F ή υγρασία.</p>`,
      glossary: ['float', 'int', 'μονάδα μέτρησης', 'συνένωση κειμένου'],
      supportedSyntax: SYNTAX_CH5,
      initialCode: `void setup() {
  Serial.begin(115200);
}

void loop() {
  int t = readTemperature();             // θερμοκρασία σε °C
  Serial.println("Temp: " + t + " C");
  delay(2000);
}
`,
      solution: `void setup() {
  Serial.begin(115200);
}

void loop() {
  float t = readTemperature();           // θερμοκρασία σε °C
  Serial.println("Temp: " + t + " C");
  delay(2000);
}
`,
      initialWorld: { temp: 22.5 }, world: { temp: 22.5 },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε τον κώδικα. Σύγκρινε την τιμή στο Serial Monitor με την τιμή του αισθητήρα στην πλακέτα.',
        'Άλλαξε τον τύπο της μεταβλητής t ώστε να κρατά δεκαδικά.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο αισθητήρας δείχνει 22.5 °C. Τι θα τυπώσει ο αρχικός κώδικας;',
        options: ['Temp: 22 C', 'Temp: 22.50 C', 'Temp: 23 C'],
        answer: 0,
        explain: 'Σωστά. Το int κρατά μόνο ακέραιους. Δεν στρογγυλοποιεί, απλώς κόβει τα δεκαδικά: 22.5 → 22.',
        retry: 'Όχι ακόμα. Τι τύπος είναι το t; Μπορεί ένα int να κρατήσει το .5;'
      },
      hints: [
        'Ο τύπος int κόβει τα δεκαδικά. Ποιος τύπος τα κρατά;',
        'Η αλλαγή είναι μία λέξη, στη γραμμή όπου δηλώνεται το t.',
        'Γράψε: float t = readTemperature();\nΤο float κρατά το 22.5 ολόκληρο και τυπώνεται ως 22.50.'
      ],
      validationTests: [
        { name: 'Στους 22.5 °C τυπώνει «Temp: 22.50 C»', world: { temp: 22.5 }, script: [
          { setup: true }, { loops: 1 },
          { check: 'lastLine', is: 'Temp: 22.50 C', fail: 'Τυπώθηκε {v}. Περίμενα «Temp: 22.50 C». Τα δεκαδικά χάθηκαν;' }
        ] },
        { name: 'Στους 19.75 °C τυπώνει «Temp: 19.75 C»', world: { temp: 19.75 }, script: [
          { setup: true }, { loops: 1 },
          { check: 'lastLine', is: 'Temp: 19.75 C', fail: 'Τυπώθηκε {v}. Περίμενα «Temp: 19.75 C».' }
        ] }
      ],
      explanationOnSuccess: 'Με float η μέτρηση κρατά τα δεκαδικά της. Σε αισθητήρες αυτό μετράει: 22 και 22.9 °C είναι σχεδόν ένας βαθμός διαφορά.',
      remediation: 'Αν βλέπεις λάθος, έλεγξε ότι γράφεις float με μικρά γράμματα.'
    },

    // ------------------------------------------------------------ c5-l2
    {
      id: 'c5-l2', chapter: 5, kind: 'guided', skills: ['sensors', 'conditions'],
      title: 'Όριο θερμοκρασίας και προειδοποίηση',
      prerequisites: ['c5-l1'],
      objectives: ['Να συγκρίνω μια μέτρηση με ένα όριο.', 'Να αποφασίζω τι γίνεται ακριβώς πάνω στο όριο.'],
      theory: `
<p>Θέλουμε προειδοποίηση όταν κάνει πολλή ζέστη. Ο κανόνας: <strong>από 30.0 °C και πάνω</strong>.</p>
<p>Το όριο το βάζουμε σε σταθερά: <code>const float LIMIT = 30.0;</code>. Αν αλλάξει, το αλλάζεις σε ένα σημείο.</p>
<p>Πρόσεξε τη διαφορά:</p>
<ul>
  <li><code>t &gt; LIMIT</code>: «μεγαλύτερο από». Στους 30.0 ακριβώς είναι <strong>false</strong>.</li>
  <li><code>t &gt;= LIMIT</code>: «μεγαλύτερο ή ίσο». Στους 30.0 ακριβώς είναι <strong>true</strong>.</li>
</ul>
<p>Οι τιμές <strong>ακριβώς πάνω στο όριο</strong> είναι το σημείο όπου γίνονται τα περισσότερα λάθη. Να τις ελέγχεις πάντα.</p>`,
      glossary: ['όριο', 'const', 'float'],
      supportedSyntax: SYNTAX_CH5,
      initialCode: `const float LIMIT = 30.0;   // όριο σε °C

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  float t = readTemperature();
  Serial.println("Temp: " + t + " C");

  if (____) {     // ΣΥΜΠΛΗΡΩΣΕ: σύγκρινε το t με το LIMIT (από 30.0 και πάνω)
    Serial.println("WARNING: too hot");
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }

  delay(2000);
}
`,
      solution: `const float LIMIT = 30.0;   // όριο σε °C

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  float t = readTemperature();
  Serial.println("Temp: " + t + " C");

  if (t >= LIMIT) {
    Serial.println("WARNING: too hot");
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }

  delay(2000);
}
`,
      initialWorld: { temp: 24 }, world: { temp: 24 },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τη συνθήκη του if: σύγκρινε το t με το LIMIT, ώστε η προειδοποίηση να ισχύει από 30.0 °C και πάνω.',
        'Τρέξε και άλλαξε τη θερμοκρασία στην πλακέτα: δοκίμασε 25, 30 και 31.5.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η θερμοκρασία είναι ακριβώς 30.0 °C. Με if (t > LIMIT), θα ανάψει το LED;',
        options: ['Όχι, γιατί το 30.0 δεν είναι μεγαλύτερο από 30.0', 'Ναι, γιατί είναι ίσο', 'Εξαρτάται από την υγρασία'],
        answer: 0,
        explain: 'Σωστά. Το > σημαίνει «αυστηρά μεγαλύτερο». Για να ισχύει και το ίσο χρειάζεσαι >=.',
        retry: 'Όχι ακόμα. Είναι το 30.0 μεγαλύτερο από το 30.0;'
      },
      hints: [
        'Ο κανόνας λέει «από 30.0 και πάνω». Άρα το 30.0 μετράει.',
        'Χρειάζεσαι τον τελεστή «μεγαλύτερο ή ίσο».',
        'Γράψε: if (t >= LIMIT) {\nΜε > η τιμή 30.0 δεν θα έδινε προειδοποίηση.'
      ],
      validationTests: [
        { name: 'Στους 24 °C: LED σβηστό, καμία προειδοποίηση', world: { temp: 24 }, script: [
          { setup: true }, { loops: 2 },
          { check: 'led', is: false, fail: 'Στους 24 °C το LED είναι {v}.' },
          { check: 'serialNot', text: 'WARNING', fail: 'Στους 24 °C τυπώθηκε προειδοποίηση.' }
        ] },
        { name: 'Στους 31.5 °C: LED αναμμένο, προειδοποίηση σε κάθε μέτρηση', world: { temp: 31.5 }, script: [
          { setup: true }, { loops: 2 },
          { check: 'led', is: true, fail: 'Στους 31.5 °C το LED είναι {v}.' },
          { check: 'count', text: 'WARNING: too hot', is: 2, fail: 'Σε 2 μετρήσεις στους 31.5 °C η προειδοποίηση τυπώθηκε {n} φορές.' }
        ] },
        { name: 'Ακριβώς 30.0 °C (πάνω στο όριο): προειδοποίηση', world: { temp: 30 }, script: [
          { setup: true }, { loops: 1 },
          { check: 'led', is: true, fail: 'Στους 30.0 °C ακριβώς το LED είναι {v}. Ο κανόνας είναι «από 30.0 και πάνω». Χρησιμοποίησες > ή >=;' },
          { check: 'count', text: 'WARNING: too hot', is: 1, fail: 'Στους 30.0 °C η προειδοποίηση τυπώθηκε {n} φορές. Περίμενα 1.' }
        ] },
        { name: 'Όταν πέφτει η θερμοκρασία, το LED σβήνει', world: { temp: 24 }, script: [
          { setup: true }, { sequence: { temp: [31, 29.9] } },
          { check: 'led', is: false, fail: 'Από 31 έπεσε στους 29.9 °C, αλλά το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Ο έλεγχος δοκίμασε κανονική τιμή, υψηλή τιμή και τιμή ακριβώς πάνω στο όριο. Τέτοιες «οριακές» δοκιμές βρίσκουν τα πιο συχνά λάθη σε συστήματα με αισθητήρες.',
      remediation: 'Αν μόνο ο έλεγχος των 30.0 αποτυγχάνει, άλλαξε το > σε >=.'
    },

    // ------------------------------------------------------------ c5-l3
    {
      id: 'c5-l3', chapter: 5, kind: 'debug', skills: ['sensors', 'conditions'],
      title: 'Βρες το λάθος: η βλάβη που έγινε συναγερμός',
      prerequisites: ['c5-l2'],
      objectives: ['Να αναγνωρίζω μια άκυρη μέτρηση (nan).', 'Να ελέγχω με isnan πριν από οποιαδήποτε σύγκριση.'],
      theory: `
<p>Όταν ο αισθητήρας χαλάσει ή αποσυνδεθεί, το <code>readTemperature()</code> επιστρέφει <code>nan</code>: «not a number», <strong>όχι αριθμός</strong>.</p>
<p>Κάθε σύγκριση με nan δίνει <strong>false</strong>. Το <code>nan &lt; 30.0</code> είναι false. Το <code>nan &gt;= 30.0</code> είναι επίσης false.</p>
<p>Άρα σε ένα <code>if / else</code> το nan καταλήγει <strong>πάντα στο else</strong>. Αν το else είναι ο συναγερμός, μια βλάβη μοιάζει με φωτιά.</p>
<p>Η σωστή σειρά: <strong>πρώτα</strong> ρωτάς <code>if (isnan(t))</code>, και μόνο αν η τιμή είναι έγκυρη τη συγκρίνεις με το όριο.</p>
<p>Στην πλακέτα, ο διακόπτης «Σφάλμα αισθητήρα» προσομοιώνει τη βλάβη.</p>`,
      glossary: ['nan / isnan', 'όριο', 'if / else'],
      supportedSyntax: SYNTAX_CH5,
      initialCode: `const float LIMIT = 30.0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  float t = readTemperature();
  Serial.println("Temp: " + t + " C");

  if (t < LIMIT) {
    digitalWrite(LED_PIN, LOW);
  } else {
    Serial.println("WARNING: too hot");
    digitalWrite(LED_PIN, HIGH);
  }

  delay(2000);
}
`,
      solution: `const float LIMIT = 30.0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  float t = readTemperature();

  if (isnan(t)) {
    Serial.println("Sensor error");
    digitalWrite(LED_PIN, LOW);
  } else if (t < LIMIT) {
    Serial.println("Temp: " + t + " C");
    digitalWrite(LED_PIN, LOW);
  } else {
    Serial.println("Temp: " + t + " C");
    Serial.println("WARNING: too hot");
    digitalWrite(LED_PIN, HIGH);
  }

  delay(2000);
}
`,
      initialWorld: { temp: 24, sensorFault: false }, world: { temp: 24 },
      hardware: HW, panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Άναψε τον διακόπτη «Σφάλμα αισθητήρα». Τι τυπώνεται; Τι κάνει το LED;',
        'Τρέξε βήμα-βήμα με το σφάλμα ενεργό. Ποιο σκέλος του if εκτελείται, και γιατί;',
        'Πρόσθεσε έλεγχο με isnan πριν από τη σύγκριση. Για άκυρη μέτρηση τύπωσε «Sensor error» και κράτα το LED σβηστό.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο αισθητήρας δίνει nan. Ποιο σκέλος του αρχικού if (t < LIMIT) … else … εκτελείται;',
        options: ['Το else, γιατί το nan < 30.0 είναι false', 'Το if, γιατί το nan είναι μικρό', 'Κανένα από τα δύο'],
        answer: 0,
        explain: 'Σωστά. Κάθε σύγκριση με nan είναι false, άρα το πρόγραμμα πάει στο else και δίνει ψεύτικο συναγερμό.',
        retry: 'Όχι ακόμα. Τι δίνει μια σύγκριση με nan: true ή false; Και πού πηγαίνει το πρόγραμμα όταν η συνθήκη είναι false;'
      },
      hints: [
        'Μια άκυρη μέτρηση δεν είναι ούτε «κανονική» ούτε «ζέστη». Είναι τρίτη περίπτωση.',
        'Βάλε πρώτο ένα if (isnan(t)) { … }. Μετά συνέχισε με else if (t < LIMIT) { … } else { … }.',
        'if (isnan(t)) {\n  Serial.println("Sensor error");\n  digitalWrite(LED_PIN, LOW);\n} else if (t < LIMIT) {\n  digitalWrite(LED_PIN, LOW);\n} else {\n  Serial.println("WARNING: too hot");\n  digitalWrite(LED_PIN, HIGH);\n}'
      ],
      validationTests: [
        { name: 'Με σφάλμα αισθητήρα: «Sensor error», χωρίς συναγερμό', world: { sensorFault: true }, script: [
          { setup: true }, { loops: 2 },
          { check: 'serialNot', text: 'WARNING', fail: 'Με σφάλμα αισθητήρα τυπώθηκε προειδοποίηση ζέστης. Η βλάβη δεν είναι φωτιά: έλεγξε πρώτα με isnan(t).' },
          { check: 'led', is: false, fail: 'Με σφάλμα αισθητήρα το LED είναι {v}. Μια άκυρη μέτρηση δεν πρέπει να ανάβει τον συναγερμό.' },
          { check: 'serialHas', text: 'Sensor error', fail: 'Δεν τυπώθηκε «Sensor error». Τελευταίες γραμμές: {v}.' }
        ] },
        { name: 'Στους 24 °C: LED σβηστό, καμία προειδοποίηση', world: { temp: 24 }, script: [
          { setup: true }, { loops: 2 },
          { check: 'led', is: false, fail: 'Στους 24 °C το LED είναι {v}.' },
          { check: 'serialNot', text: 'WARNING', fail: 'Στους 24 °C τυπώθηκε προειδοποίηση.' },
          { check: 'serialNot', text: 'Sensor error', fail: 'Στους 24 °C τυπώθηκε «Sensor error», ενώ η μέτρηση είναι έγκυρη.' }
        ] },
        { name: 'Ακριβώς 30.0 °C: προειδοποίηση', world: { temp: 30 }, script: [
          { setup: true }, { loops: 1 },
          { check: 'led', is: true, fail: 'Στους 30.0 °C το LED είναι {v}. Ο κανόνας είναι «από 30.0 και πάνω».' },
          { check: 'count', text: 'WARNING: too hot', is: 1, fail: 'Στους 30.0 °C η προειδοποίηση τυπώθηκε {n} φορές.' }
        ] },
        { name: 'Ο αισθητήρας επανέρχεται: η μέτρηση ξαναδουλεύει', world: { temp: 32, sensorFault: true }, script: [
          { setup: true }, { loops: 1 }, { set: { sensorFault: false } }, { loops: 1 },
          { check: 'led', is: true, fail: 'Ο αισθητήρας επανήλθε στους 32 °C, αλλά το LED είναι {v}.' },
          { check: 'count', text: 'WARNING: too hot', is: 1, fail: 'Μετά την επαναφορά στους 32 °C η προειδοποίηση τυπώθηκε {n} φορές. Περίμενα 1.' }
        ] }
      ],
      explanationOnSuccess: 'Τώρα το πρόγραμμα ξεχωρίζει τρεις περιπτώσεις: άκυρη μέτρηση, κανονική τιμή, υψηλή τιμή. Σε πραγματικά συστήματα, ένας ψεύτικος συναγερμός από βλάβη μπορεί να κάνει τους ανθρώπους να αγνοούν και τους αληθινούς.',
      remediation: 'Αν το «Sensor error» δεν τυπώνεται, έλεγξε ότι ο έλεγχος isnan(t) είναι ο πρώτος, πριν από κάθε σύγκριση με το LIMIT.'
    },

    // ------------------------------------------------------------ c5-l4
    {
      id: 'c5-l4', chapter: 5, kind: 'variant', skills: ['sensors', 'state', 'conditions'],
      title: 'Υστέρηση: συναγερμός που δεν τρεμοπαίζει',
      prerequisites: ['c5-l3'],
      objectives: ['Να εξηγώ γιατί ένα μόνο όριο προκαλεί συνεχείς εναλλαγές.', 'Να χρησιμοποιώ δύο όρια (υστέρηση) μαζί με μνήμη κατάστασης.'],
      theory: `
<p>Η θερμοκρασία σπάνια μένει σταθερή. Κοντά στο όριο «χορεύει»: 29.8, 30.1, 29.9, 30.0…</p>
<p>Με ένα μόνο όριο, ο συναγερμός ανάβει και σβήνει συνέχεια. Αυτό κουράζει και κάνει τους ανθρώπους να τον αγνοούν.</p>
<p>Η λύση λέγεται <strong>υστέρηση</strong>: δύο όρια.</p>
<ul>
  <li>Ο συναγερμός <strong>ανάβει</strong> όταν <code>t &gt;= 30.0</code> (LIMIT_ON).</li>
  <li>Ο συναγερμός <strong>σβήνει</strong> μόνο όταν <code>t &lt;= 28.0</code> (LIMIT_OFF).</li>
  <li>Ανάμεσα (28.0 – 30.0) <strong>δεν αλλάζει τίποτα</strong>: μένει όπως ήταν.</li>
</ul>
<p>Γι’ αυτό χρειάζεται η μεταβλητή <code>alarmOn</code>: θυμάται την κατάσταση, όπως το lastMotion στο Κεφάλαιο 3.</p>`,
      glossary: ['υστέρηση', 'κατάσταση (state)', 'όριο'],
      supportedSyntax: SYNTAX_CH5,
      initialCode: `bool alarmOn = false;
const float LIMIT_ON = 30.0;    // ανάβει από εδώ και πάνω
const float LIMIT_OFF = 28.0;   // σβήνει από εδώ και κάτω (δεν χρησιμοποιείται ακόμα)

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  float t = readTemperature();

  if (isnan(t)) {
    Serial.println("Sensor error");          // άκυρη μέτρηση: η κατάσταση δεν αλλάζει
  } else if (!alarmOn && t >= LIMIT_ON) {
    alarmOn = true;
    Serial.println("Alarm ON");
  } else if (alarmOn && t < LIMIT_ON) {
    alarmOn = false;
    Serial.println("Alarm OFF");
  }

  digitalWrite(LED_PIN, alarmOn);
  delay(2000);
}
`,
      solution: `bool alarmOn = false;
const float LIMIT_ON = 30.0;    // ανάβει από εδώ και πάνω
const float LIMIT_OFF = 28.0;   // σβήνει από εδώ και κάτω

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  float t = readTemperature();

  if (isnan(t)) {
    Serial.println("Sensor error");          // άκυρη μέτρηση: η κατάσταση δεν αλλάζει
  } else if (!alarmOn && t >= LIMIT_ON) {
    alarmOn = true;
    Serial.println("Alarm ON");
  } else if (alarmOn && t <= LIMIT_OFF) {
    alarmOn = false;
    Serial.println("Alarm OFF");
  }

  digitalWrite(LED_PIN, alarmOn);
  delay(2000);
}
`,
      initialWorld: { temp: 25 }, world: { temp: 25 },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε τον κώδικα. Άλλαξε τη θερμοκρασία πολλές φορές γύρω από το 30: 30.1, 29.8, 30.2, 29.9. Μέτρα τα «Alarm ON» και «Alarm OFF».',
        'Άλλαξε τη συνθήκη που σβήνει τον συναγερμό ώστε να χρησιμοποιεί το LIMIT_OFF.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Με τον αρχικό κώδικα, η θερμοκρασία πηγαίνει 30.1 → 29.8 → 30.2 → 29.9. Πόσα «Alarm ON» θα δεις;',
        options: ['2', '1', '4'],
        answer: 0,
        explain: 'Σωστά. Στο 30.1 ανάβει, στο 29.8 σβήνει, στο 30.2 ξανανάβει, στο 29.9 ξανασβήνει. Δύο «Alarm ON» για μια θερμοκρασία που ουσιαστικά δεν άλλαξε.',
        retry: 'Όχι ακόμα. Ακολούθησε τις τιμές μία-μία. Σε ποιες ο συναγερμός ανάβει (από σβηστός σε αναμμένος);'
      },
      hints: [
        'Ο συναγερμός πρέπει να σβήνει μόνο όταν η θερμοκρασία πέσει αρκετά, όχι μόλις πέσει κάτω από το 30.',
        'Κοίτα το δεύτερο else if: alarmOn && t < LIMIT_ON. Ποιο όριο και ποιος τελεστής χρειάζονται εκεί;',
        'Γράψε: } else if (alarmOn && t <= LIMIT_OFF) {\nΈτσι στους 29.9 ο συναγερμός μένει αναμμένος, και σβήνει μόνο στους 28.0 ή λιγότερο.'
      ],
      validationTests: [
        { name: 'Θερμοκρασία που «χορεύει» γύρω από το 30: ένα μόνο «Alarm ON»', world: { temp: 25 }, script: [
          { setup: true }, { sequence: { temp: [29.5, 30.1, 29.8, 30.0, 29.6, 30.2, 29.9] } },
          { check: 'count', text: 'Alarm ON', is: 1, fail: 'Για θερμοκρασία γύρω από το 30 τυπώθηκε {n} φορές «Alarm ON». Περίμενα 1. Ο συναγερμός σβήνει πολύ εύκολα.' },
          { check: 'count', text: 'Alarm OFF', is: 0, fail: 'Τυπώθηκε {n} φορές «Alarm OFF», ενώ η θερμοκρασία δεν έπεσε ποτέ στους 28.0.' },
          { check: 'led', is: true, fail: 'Στο τέλος (29.9 °C) το LED είναι {v}. Μετά από συναγερμό πρέπει να μένει αναμμένο μέχρι τους 28.0.' }
        ] },
        { name: 'Πραγματική πτώση: σβήνει ακριβώς στους 28.0', world: { temp: 25 }, script: [
          { setup: true }, { sequence: { temp: [30.5, 29.0, 28.1] } },
          { check: 'led', is: true, fail: 'Στους 28.1 °C το LED είναι {v}. Πάνω από το LIMIT_OFF ο συναγερμός πρέπει να μένει αναμμένος.' },
          { sequence: { temp: [28.0, 27.0] } },
          { check: 'order', texts: ['Alarm ON', 'Alarm OFF'], fail: 'Τα μηνύματα ήταν: {v}. Περίμενα ένα «Alarm ON» και μετά ένα «Alarm OFF».' },
          { check: 'led', is: false, fail: 'Η θερμοκρασία έπεσε στους 28.0 και κάτω, αλλά το LED είναι {v}.' }
        ] },
        { name: 'Ακριβώς 30.0 °C: ο συναγερμός ανάβει', world: { temp: 25 }, script: [
          { setup: true }, { sequence: { temp: [30.0] } },
          { check: 'count', text: 'Alarm ON', is: 1, fail: 'Στους 30.0 °C τυπώθηκε {n} φορές «Alarm ON». Περίμενα 1.' }
        ] },
        { name: 'Σφάλμα αισθητήρα στη διάρκεια συναγερμού: η κατάσταση δεν αλλάζει', world: { temp: 31 }, script: [
          { setup: true }, { loops: 1 }, { set: { sensorFault: true } }, { loops: 2 },
          { check: 'led', is: true, fail: 'Με σφάλμα αισθητήρα το LED έγινε {v}. Μια άκυρη μέτρηση δεν πρέπει να αλλάζει τον συναγερμό.' },
          { check: 'count', text: 'Alarm OFF', is: 0, fail: 'Τυπώθηκε «Alarm OFF» {n} φορές λόγω άκυρης μέτρησης.' },
          { check: 'serialHas', text: 'Sensor error', fail: 'Δεν τυπώθηκε «Sensor error». Τελευταίες γραμμές: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Με δύο όρια, μικρές διακυμάνσεις δεν αλλάζουν τον συναγερμό. Το ίδιο κόλπο χρησιμοποιούν θερμοστάτες, ψυγεία και κλιματιστικά για να μην ανοιγοκλείνουν συνέχεια.',
      remediation: 'Αν ο συναγερμός δεν σβήνει ποτέ, έλεγξε τον τελεστή: για να σβήσει στους 28.0 ακριβώς χρειάζεσαι <=.'
    },

    // ------------------------------------------------------------ c5-l5
    {
      id: 'c5-l5', chapter: 5, kind: 'checkpoint', skills: ['sensors', 'conditions', 'timing'],
      title: 'Έλεγχος κεφαλαίου: μέτρηση σε JSON',
      prerequisites: ['c5-l4'],
      objectives: ['Να φτιάχνω ένα απλό κείμενο JSON από μετρήσεις.', 'Να χειρίζομαι σωστά κανονικές, οριακές και άκυρες τιμές μαζί.'],
      theory: `
<p>Για να στείλει μια συσκευή μετρήσεις σε άλλο σύστημα, τις γράφει σε μια κοινή μορφή. Η πιο συχνή είναι το <strong>JSON</strong>:</p>
<pre>{"temp":22.50,"hum":45.00}</pre>
<ul>
  <li>Αγκύλες <code>{ }</code> γύρω-γύρω.</li>
  <li>Κάθε κλειδί σε εισαγωγικά: <code>"temp"</code>, μετά <code>:</code> και η τιμή.</li>
  <li>Κόμμα ανάμεσα στα ζευγάρια. Κανένα κενό δεν χρειάζεται.</li>
</ul>
<p>Μέσα σε κείμενο C++, το εισαγωγικό γράφεται <code>\\"</code>. Έτσι το <code>"{\\"temp\\":"</code> είναι το κείμενο <code>{"temp":</code></p>
<p>Το <code>nan</code> <strong>δεν</strong> είναι έγκυρη τιμή JSON. Αν η μέτρηση είναι άκυρη, μη φτιάξεις payload. Τύπωσε «Sensor error».</p>
<p>Στον έλεγχο αυτό ενώνεις όσα έμαθες: float, όριο, isnan και μια συνάρτηση που <strong>επιστρέφει</strong> String.</p>`,
      glossary: ['JSON', 'payload', 'return', 'nan / isnan', 'συνένωση κειμένου'],
      supportedSyntax: SYNTAX_CH5,
      initialCode: String.raw`const float LIMIT = 30.0;

// Επιστρέφει κείμενο JSON, π.χ. {"temp":22.50,"hum":45.00}
String makePayload(float t, float h) {
  // ΣΥΜΠΛΗΡΩΣΕ: φτιάξε το JSON με "{\"temp\":" + t + ...
  return "";
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  float t = readTemperature();
  float h = readHumidity();

  // ΣΥΜΠΛΗΡΩΣΕ: αν η μέτρηση είναι άκυρη, τύπωσε "Sensor error" και σβήσε το LED

  Serial.println(makePayload(t, h));
  if (t >= LIMIT) {
    Serial.println("WARNING: too hot");
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }

  delay(2000);
}
`,
      solution: String.raw`const float LIMIT = 30.0;

// Επιστρέφει κείμενο JSON, π.χ. {"temp":22.50,"hum":45.00}
String makePayload(float t, float h) {
  return "{\"temp\":" + t + ",\"hum\":" + h + "}";
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  float t = readTemperature();
  float h = readHumidity();

  if (isnan(t) || isnan(h)) {
    Serial.println("Sensor error");
    digitalWrite(LED_PIN, LOW);
  } else {
    Serial.println(makePayload(t, h));
    if (t >= LIMIT) {
      Serial.println("WARNING: too hot");
      digitalWrite(LED_PIN, HIGH);
    } else {
      digitalWrite(LED_PIN, LOW);
    }
  }

  delay(2000);
}
`,
      initialWorld: { temp: 22.5, humidity: 45 }, world: { temp: 22.5, humidity: 45 },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση κατανόησης.',
        'Συμπλήρωσε τη makePayload ώστε να επιστρέφει JSON με θερμοκρασία και υγρασία.',
        'Πρόσθεσε έλεγχο για άκυρη μέτρηση πριν φτιάξεις το payload.',
        'Δοκίμασε στην πλακέτα: κανονική τιμή, 30.0 ακριβώς, και «Σφάλμα αισθητήρα». Μετά πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί δεν στέλνουμε {"temp":nan,"hum":nan} όταν ο αισθητήρας έχει βλάβη;',
        options: ['Το nan δεν είναι έγκυρη τιμή JSON και ο παραλήπτης θα μπερδευτεί ή θα αποτύχει', 'Γιατί το JSON δεν δέχεται δεκαδικούς', 'Γιατί το payload πρέπει να είναι πάντα ίδιο'],
        answer: 0,
        explain: 'Σωστά. Το JSON δεν έχει τιμή nan. Είναι καλύτερα να πεις καθαρά «Sensor error» παρά να στείλεις δεδομένα που μοιάζουν σωστά αλλά δεν είναι.',
        retry: 'Όχι ακόμα. Ξαναδιάβασε τη θεωρία: είναι το nan έγκυρη τιμή JSON;'
      },
      hints: [
        'Το JSON είναι απλώς κείμενο. Το φτιάχνεις με + από κομμάτια: σταθερό κείμενο, τιμή, σταθερό κείμενο, τιμή, «}».',
        'Τα κομμάτια είναι: "{\\"temp\\":" , t , ",\\"hum\\":" , h , "}". Για την άκυρη μέτρηση, βάλε τον έλεγχο isnan πρώτο και όλο τον υπόλοιπο κώδικα στο else.',
        'return "{\\"temp\\":" + t + ",\\"hum\\":" + h + "}";\n\nif (isnan(t) || isnan(h)) {\n  Serial.println("Sensor error");\n  digitalWrite(LED_PIN, LOW);\n} else {\n  Serial.println(makePayload(t, h));\n  … ο έλεγχος του ορίου …\n}'
      ],
      validationTests: [
        { name: 'Κανονική μέτρηση (22.5 °C, 45 %) → σωστό JSON, χωρίς προειδοποίηση', world: { temp: 22.5, humidity: 45 }, script: [
          { setup: true }, { loops: 1 },
          { check: 'count', text: '{"temp":22.50,"hum":45.00}', min: 1, fail: 'Λάθος JSON.', failZero: 'Δεν τυπώθηκε το JSON {"temp":22.50,"hum":45.00}. Έλεγξε εισαγωγικά, άνω-κάτω τελείες, κόμμα και αγκύλες.' },
          { check: 'serialNot', text: 'WARNING', fail: 'Στους 22.5 °C τυπώθηκε προειδοποίηση.' },
          { check: 'led', is: false, fail: 'Στους 22.5 °C το LED είναι {v}.' }
        ] },
        { name: 'Άλλη μέτρηση (19.25 °C, 60.5 %) → το JSON ακολουθεί τις τιμές', world: { temp: 19.25, humidity: 60.5 }, script: [
          { setup: true }, { loops: 1 },
          { check: 'count', text: '{"temp":19.25,"hum":60.50}', min: 1, fail: 'Λάθος JSON.', failZero: 'Περίμενα {"temp":19.25,"hum":60.50}. Το JSON χρησιμοποιεί τις παραμέτρους t και h, ή σταθερές τιμές;' }
        ] },
        { name: 'Ακριβώς 30.0 °C → JSON και προειδοποίηση', world: { temp: 30, humidity: 50 }, script: [
          { setup: true }, { loops: 1 },
          { check: 'count', text: '{"temp":30.00,"hum":50.00}', min: 1, fail: 'Λάθος JSON.', failZero: 'Στους 30.0 °C περίμενα {"temp":30.00,"hum":50.00}.' },
          { check: 'count', text: 'WARNING: too hot', is: 1, fail: 'Στους 30.0 °C η προειδοποίηση τυπώθηκε {n} φορές. Περίμενα 1.' },
          { check: 'led', is: true, fail: 'Στους 30.0 °C το LED είναι {v}.' }
        ] },
        { name: 'Άκυρη μέτρηση → «Sensor error», χωρίς nan και χωρίς συναγερμό', world: { sensorFault: true }, script: [
          { setup: true }, { loops: 2 },
          { check: 'serialNot', text: 'nan', fail: 'Τυπώθηκε κείμενο με «nan». Με άκυρη μέτρηση μη φτιάχνεις payload.' },
          { check: 'serialHas', text: 'Sensor error', fail: 'Με βλάβη αισθητήρα δεν τυπώθηκε «Sensor error». Τελευταίες γραμμές: {v}.' },
          { check: 'serialNot', text: 'WARNING', fail: 'Με βλάβη αισθητήρα τυπώθηκε προειδοποίηση ζέστης.' },
          { check: 'led', is: false, fail: 'Με βλάβη αισθητήρα το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το Κεφάλαιο 5. Η συσκευή σου διαβάζει δεκαδικές μετρήσεις, ξέρει τι κάνει ακριβώς πάνω στο όριο, δεν μπερδεύει τη βλάβη με συναγερμό και φτιάχνει καθαρά δεδομένα JSON. Στο επόμενο κεφάλαιο θα συνδεθεί σε δίκτυο.',
      remediation: 'Αν το JSON δεν ταιριάζει, τύπωσέ το και σύγκρινέ το χαρακτήρα-χαρακτήρα με το {"temp":22.50,"hum":45.00}. Συχνά λείπει ένα εισαγωγικό ή η άνω-κάτω τελεία.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
