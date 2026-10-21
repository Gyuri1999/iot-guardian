/*
 * IoT Guardian — περιεχόμενο μαθημάτων (Φάση Α: κεφάλαια 1–3).
 * Τα lessons είναι δηλωτικά δεδομένα, ανεξάρτητα από το UI.
 * Πεδία: id, chapter, kind, title, prerequisites, objectives, theory, glossary,
 * initialCode, solution, supportedSyntax, initialWorld, steps, quiz, hints,
 * validationTests, explanationOnSuccess, remediation, skills.
 */
(function (root) {
  'use strict';

  const SKILLS = {
    order: 'Σειρά εκτέλεσης',
    setuploop: 'setup() και loop()',
    syntax: 'Σύνταξη και μηνύματα λάθους',
    variables: 'Μεταβλητές',
    io: 'Είσοδοι και έξοδοι (GPIO)',
    conditions: 'Συνθήκες if / else',
    state: 'Μνήμη κατάστασης',
    timing: 'Συναρτήσεις και χρονισμός',
    sensors: 'Αισθητήρες και δεδομένα',
    network: 'WiFi και δίκτυα',
    mqtt: 'MQTT',
    analysis: 'Ανάλυση δικτύου και logs',
    security: 'Αμυντική ασφάλεια',
    python: 'Python',
    automation: 'Αυτοματισμοί στο Raspberry Pi'
  };

  const KIND_LABELS = {
    micro: 'Μικρομάθημα',
    guided: 'Καθοδηγούμενη άσκηση',
    variant: 'Παραλλαγή',
    independent: 'Ανεξάρτητη άσκηση',
    debug: 'Βρες το λάθος',
    checkpoint: 'Έλεγχος κεφαλαίου'
  };

  const CHAPTERS = [
    { n: 1, title: 'Πρώτο πρόγραμμα', ready: true },
    { n: 2, title: 'Μεταβλητές και συνθήκες', ready: true },
    { n: 3, title: 'Μνήμη κατάστασης και PIR', ready: true },
    { n: 4, title: 'Συναρτήσεις και χρόνος' },
    { n: 5, title: 'Αισθητήρες και δεδομένα' },
    { n: 6, title: 'WiFi και δίκτυα' },
    { n: 7, title: 'MQTT θεμέλια' },
    { n: 8, title: 'Αξιόπιστη επικοινωνία' },
    { n: 9, title: 'Ανάλυση δικτύου' },
    { n: 10, title: 'Authentication και μυστικά' },
    { n: 11, title: 'TLS και πιστοποιητικά' },
    { n: 12, title: 'ACLs και ελάχιστα δικαιώματα' },
    { n: 13, title: 'Ασφαλής λογική εφαρμογής' },
    { n: 14, title: 'Monitoring και ασφαλής διαμόρφωση' },
    { n: 15, title: 'Τελικό έργο' }
  ];

  const SYNTAX_CH1 = 'setup(), loop(), pinMode, digitalWrite, Serial.begin, Serial.println, delay, σχόλια //';
  const SYNTAX_CH2 = SYNTAX_CH1 + ', int, bool, =, ==, !=, !, digitalRead, if / else';
  const SYNTAX_CH3 = SYNTAX_CH2 + ', &&, ||, μεταβλητές έξω από συναρτήσεις';

  // ------------------------------------------------------------- Κεφάλαιο 1

  const C1_SOLVED = `// Το πρώτο μου πρόγραμμα
void setup() {
  pinMode(LED_PIN, OUTPUT);      // το LED είναι έξοδος
  digitalWrite(LED_PIN, HIGH);   // άναψε το LED
  Serial.begin(115200);          // ξεκίνα το Serial Monitor
  Serial.println("Hello IoT");   // τύπωσε ένα μήνυμα
}

void loop() {
  // εδώ δεν κάνουμε τίποτα ακόμα
}
`;

  const C1_LED_TESTS = [
    {
      name: 'Το LED ρυθμίζεται ως έξοδος (OUTPUT)',
      script: [{ setup: true }, { check: 'ledOutput', fail: 'Το LED_PIN είναι: {v}. Χρειάζεται pinMode(LED_PIN, OUTPUT); μέσα στο setup().' }]
    },
    {
      name: 'Το LED είναι αναμμένο μετά το setup()',
      script: [{ setup: true }, { check: 'led', is: true, fail: 'Το LED είναι {v} μετά το setup(). Η εντολή που ανάβει το LED είναι digitalWrite(LED_PIN, HIGH);' }]
    },
    {
      name: 'Το «Hello IoT» τυπώνεται ακριβώς μία φορά',
      script: [
        { setup: true }, { loops: 5 },
        { check: 'count', text: 'Hello IoT', is: 1,
          fail: 'Το «Hello IoT» τυπώθηκε {n} φορές σε 5 επαναλήψεις. Αν το έβαλες μέσα στο loop(), θυμήσου: το loop() επαναλαμβάνεται συνέχεια, ενώ το setup() τρέχει μία φορά.',
          failZero: 'Το «Hello IoT» δεν τυπώθηκε καθόλου. Έλεγξε ότι υπάρχει Serial.println("Hello IoT"); μέσα στο setup() και ότι το κείμενο είναι ακριβώς ίδιο.' }
      ]
    }
  ];

  const lessons = [
    {
      id: 'c1-l1', chapter: 1, kind: 'micro', skills: ['order', 'setuploop'],
      title: 'Εντολές και σειρά εκτέλεσης',
      prerequisites: [],
      objectives: ['Να ξεχωρίζω μια εντολή από ένα σχόλιο.', 'Να ξέρω ότι οι εντολές εκτελούνται από πάνω προς τα κάτω.', 'Να ξέρω ότι το setup() τρέχει μία φορά.'],
      theory: `
<p>Ένα πρόγραμμα είναι μια λίστα από <strong>εντολές</strong>. Ο μικροελεγκτής τις εκτελεί <strong>μία-μία, από πάνω προς τα κάτω</strong>.</p>
<p>Κάθε απλή εντολή τελειώνει με <code>;</code>. Το <code>;</code> είναι σαν την τελεία στο τέλος μιας πρότασης.</p>
<p>Ό,τι γράφεται μετά το <code>//</code> είναι <strong>σχόλιο</strong>: σημείωση για τον άνθρωπο. Ο υπολογιστής το αγνοεί.</p>
<p>Κάθε πρόγραμμα έχει δύο βασικά μέρη:</p>
<ul>
  <li><code>void setup() { … }</code> τρέχει <strong>μία φορά</strong>, όταν ανάβει η πλακέτα.</li>
  <li><code>void loop() { … }</code> τρέχει <strong>ξανά και ξανά</strong>, για πάντα.</li>
</ul>
<p>Τα άγκιστρα <code>{ }</code> δείχνουν πού αρχίζει και πού τελειώνει κάθε μέρος.</p>`,
      glossary: ['εντολή', 'σχόλιο', 'setup()', 'loop()', 'άγκιστρα'],
      supportedSyntax: SYNTAX_CH1,
      initialCode: C1_SOLVED,
      solution: C1_SOLVED,
      initialPasses: true,
      initialWorld: {},
      steps: [
        'Διάβασε τον κώδικα. Βρες τις γραμμές που τελειώνουν με ;',
        'Απάντησε στην ερώτηση πρόβλεψης πριν τρέξεις τον κώδικα.',
        'Πάτησε «Ένα βήμα» αρκετές φορές. Δες ποια γραμμή φωτίζεται και τι αλλάζει στην πλακέτα.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Πόσες φορές θα εμφανιστεί το «Hello IoT» στο Serial Monitor;',
        options: ['Μία φορά', 'Ξανά και ξανά, συνέχεια', 'Καμία φορά'],
        answer: 0,
        explain: 'Σωστά. Το Serial.println("Hello IoT") βρίσκεται μέσα στο setup(), και το setup() τρέχει μία φορά.',
        retry: 'Όχι ακόμα. Κοίτα μέσα σε ποιο ζευγάρι { } βρίσκεται το Serial.println: στο setup() ή στο loop();'
      },
      hints: [
        'Το setup() εκτελείται μία φορά, στην αρχή.',
        'Η γραμμή Serial.println("Hello IoT"); είναι μέσα στα άγκιστρα του setup().',
        'Εδώ ο κώδικας είναι ήδη σωστός. Απάντησε «Μία φορά» και πάτησε «Έλεγχος λύσης».'
      ],
      validationTests: [
        { name: 'Το πρόγραμμα τρέχει και το LED ανάβει', script: [{ setup: true }, { loops: 3 }, { check: 'led', is: true, fail: 'Το LED είναι {v}. Μήπως άλλαξες κάποια γραμμή; Πάτησε «Επαναφορά άσκησης».' }] },
        { name: 'Το μήνυμα εμφανίζεται μία φορά', script: [{ setup: true }, { loops: 5 }, { check: 'count', text: 'Hello IoT', is: 1, fail: 'Το «Hello IoT» εμφανίστηκε {n} φορές.' }] }
      ],
      explanationOnSuccess: 'Είδες ότι οι εντολές εκτελούνται με τη σειρά, και ότι ό,τι είναι στο setup() τρέχει μία φορά. Το loop() εδώ είναι άδειο, άρα μετά το setup() η πλακέτα απλώς περιμένει.',
      remediation: 'Αν κάτι δεν πέρασε, πάτησε «Επαναφορά άσκησης» για να πάρεις πίσω τον αρχικό κώδικα.'
    },

    {
      id: 'c1-l2', chapter: 1, kind: 'guided', skills: ['order', 'setuploop', 'io'],
      title: 'Το πρώτο φως',
      prerequisites: ['c1-l1'],
      objectives: ['Να ανάψω ένα LED με digitalWrite.', 'Να καταλάβω τι σημαίνει κάθε όρισμα μιας εντολής.'],
      theory: `
<p>Για να ανάψει ένα LED χρειάζονται δύο εντολές:</p>
<ol>
  <li><code>pinMode(LED_PIN, OUTPUT);</code> λέει στην πλακέτα: «το pin του LED είναι <strong>έξοδος</strong>».</li>
  <li><code>digitalWrite(LED_PIN, HIGH);</code> λέει: «στείλε <strong>ρεύμα</strong> (HIGH) σε αυτό το pin».</li>
</ol>
<p>Μέσα στις παρενθέσεις υπάρχουν τα <strong>ορίσματα</strong>, χωρισμένα με κόμμα. Το πρώτο λέει <em>ποιο pin</em>, το δεύτερο <em>τι να κάνει</em>.</p>
<p><code>LED_PIN</code> είναι ένα όνομα που έχει ήδη δηλωθεί στην εικονική πλακέτα και σημαίνει «GPIO 2».</p>
<p><code>HIGH</code> σημαίνει ανοιχτό (1). <code>LOW</code> σημαίνει κλειστό (0).</p>`,
      glossary: ['όρισμα', 'pinMode', 'digitalWrite', 'HIGH / LOW', 'GPIO'],
      supportedSyntax: SYNTAX_CH1,
      initialCode: `void setup() {
  pinMode(LED_PIN, OUTPUT);      // το LED είναι έξοδος
  // ΣΥΜΠΛΗΡΩΣΕ: η εντολή που ανάβει το LED

  Serial.begin(115200);
  Serial.println("Hello IoT");
}

void loop() {
}
`,
      solution: `void setup() {
  pinMode(LED_PIN, OUTPUT);      // το LED είναι έξοδος
  digitalWrite(LED_PIN, HIGH);   // άναψε το LED

  Serial.begin(115200);
  Serial.println("Hello IoT");
}

void loop() {
}
`,
      initialWorld: {},
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Στη γραμμή με το ΣΥΜΠΛΗΡΩΣΕ, γράψε την εντολή που ανάβει το LED.',
        'Πάτησε «Ένα βήμα» και δες σε ποια γραμμή αλλάζει το LED στην πλακέτα.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Θέλεις το LED να ανάψει μία φορά, όταν ξεκινά η πλακέτα. Πού γράφεις την εντολή;',
        options: ['Μέσα στο setup()', 'Μέσα στο loop()', 'Έξω από τα άγκιστρα, στην αρχή του αρχείου'],
        answer: 0,
        explain: 'Σωστά. Ό,τι πρέπει να γίνει μία φορά στην αρχή μπαίνει στο setup(). Έξω από τις συναρτήσεις δεν επιτρέπονται εντολές.',
        retry: 'Όχι ακόμα. Ποιο από τα δύο μέρη τρέχει μία φορά στην αρχή;'
      },
      hints: [
        'Το setup() εκτελείται μία φορά. Εκεί ρυθμίζουμε και ανάβουμε το LED.',
        'Η εντολή που αλλάζει το LED είναι η digitalWrite. Θέλει δύο ορίσματα: ποιο pin και τι τιμή.',
        'Γράψε: digitalWrite(LED_PIN, HIGH);\n• digitalWrite = «γράψε ψηφιακή τιμή»\n• LED_PIN = σε ποιο pin (GPIO 2)\n• HIGH = άναψε (1)\n• ; = τέλος εντολής'
      ],
      validationTests: C1_LED_TESTS,
      explanationOnSuccess: 'Το LED άναψε επειδή πρώτα ρύθμισες το pin ως έξοδο και μετά του έστειλες HIGH. Το μήνυμα τυπώθηκε μία φορά, γιατί είναι στο setup().',
      remediation: 'Αν το LED μένει σβηστό, έλεγξε ότι γράφεις HIGH με κεφαλαία και ότι η γραμμή τελειώνει με ;'
    },

    {
      id: 'c1-l3', chapter: 1, kind: 'variant', skills: ['setuploop', 'order'],
      title: 'Από το setup στο loop',
      prerequisites: ['c1-l2'],
      objectives: ['Να δω τη διαφορά ανάμεσα σε μία εκτέλεση και σε επανάληψη.', 'Να προβλέψω πόσες φορές τυπώνεται ένα μήνυμα.'],
      theory: `
<p>Το <code>loop()</code> ξεκινά αμέσως μετά το <code>setup()</code>. Όταν φτάσει στο <code>}</code> του, ξαναρχίζει από την αρχή του.</p>
<p>Η εντολή <code>delay(1000);</code> κάνει την πλακέτα να <strong>περιμένει 1000 χιλιοστά του δευτερολέπτου</strong>, δηλαδή 1 δευτερόλεπτο.</p>
<p>Έτσι, ό,τι βάλεις μέσα στο <code>loop()</code> μαζί με <code>delay(1000);</code> θα γίνεται περίπου μία φορά το δευτερόλεπτο.</p>`,
      glossary: ['loop()', 'delay'],
      supportedSyntax: SYNTAX_CH1,
      initialCode: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);
  Serial.begin(115200);
  Serial.println("Hello IoT");
}

void loop() {
  delay(1000);   // περίμενε 1 δευτερόλεπτο
}
`,
      solution: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);
  Serial.begin(115200);
}

void loop() {
  Serial.println("Hello IoT");
  delay(1000);   // περίμενε 1 δευτερόλεπτο
}
`,
      initialWorld: {},
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Μετακίνησε τη γραμμή Serial.println("Hello IoT"); από το setup() μέσα στο loop(), πριν από το delay.',
        'Πάτησε «Εκτέλεση» και μέτρησε τα μηνύματα στο Serial Monitor.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Αν μεταφέρεις το Serial.println("Hello IoT"); μέσα στο loop(), πόσες φορές θα τυπωθεί σε 5 δευτερόλεπτα;',
        options: ['Μία φορά', 'Περίπου 5 φορές', 'Καμία φορά'],
        answer: 1,
        explain: 'Σωστά. Κάθε επανάληψη του loop() τυπώνει μία φορά και μετά περιμένει 1 δευτερόλεπτο. Σε 5 δευτερόλεπτα γίνονται περίπου 5 επαναλήψεις.',
        retry: 'Όχι ακόμα. Πόσο κρατά μία επανάληψη του loop() με delay(1000);'
      },
      hints: [
        'Ό,τι είναι στο loop() επαναλαμβάνεται.',
        'Κόψε τη γραμμή Serial.println από το setup() και επικόλλησέ την μέσα στα { } του loop().',
        'Το loop() πρέπει να είναι:\nvoid loop() {\n  Serial.println("Hello IoT");\n  delay(1000);\n}\nΚαι στο setup() να μην υπάρχει πια το println.'
      ],
      validationTests: [
        { name: 'Το setup() δεν τυπώνει πια το μήνυμα', script: [{ setup: true }, { check: 'count', text: 'Hello IoT', is: 0, fail: 'Το setup() τύπωσε ακόμα το «Hello IoT». Μετακίνησε τη γραμμή, μην την αντιγράψεις.' }] },
        { name: 'Κάθε επανάληψη του loop() τυπώνει μία φορά', script: [{ setup: true }, { loops: 3 }, { check: 'count', text: 'Hello IoT', is: 3, fail: 'Σε 3 επαναλήψεις τυπώθηκε {n} φορές. Περίμενα 3.' }] },
        { name: 'Το LED μένει αναμμένο', script: [{ setup: true }, { loops: 2 }, { check: 'led', is: true, fail: 'Το LED είναι {v}. Άφησε το pinMode και το digitalWrite στο setup().' }] }
      ],
      explanationOnSuccess: 'Η ίδια εντολή έκανε κάτι διαφορετικό ανάλογα με το πού βρίσκεται. Στο setup() τρέχει μία φορά, στο loop() επαναλαμβάνεται.',
      remediation: 'Αν το μήνυμα τυπώνεται και στο setup() και στο loop(), σβήσε τη γραμμή από το setup().'
    },

    {
      id: 'c1-l4', chapter: 1, kind: 'independent', skills: ['io', 'setuploop'],
      title: 'Σβηστό LED, νέο μήνυμα',
      prerequisites: ['c1-l3'],
      objectives: ['Να γράψω μόνος/μόνη μου μια μικρή αλλαγή.', 'Να χρησιμοποιήσω LOW.'],
      theory: `
<p>Τώρα δοκίμασε μόνος/μόνη σου, χωρίς βήμα-βήμα οδηγίες.</p>
<p>Θυμήσου: <code>HIGH</code> ανάβει, <code>LOW</code> σβήνει. Το κείμενο μέσα στα <code>"…"</code> μπορεί να είναι ό,τι θέλεις, ακόμα και ελληνικά.</p>`,
      glossary: ['HIGH / LOW', 'Serial Monitor'],
      supportedSyntax: SYNTAX_CH1,
      initialCode: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH);
  Serial.begin(115200);
  Serial.println("Hello IoT");
}

void loop() {
}
`,
      solution: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  Serial.begin(115200);
  Serial.println("Το σπίτι ξεκινά");
}

void loop() {
}
`,
      initialWorld: {},
      steps: [
        'Κάνε το LED να είναι σβηστό στην αρχή.',
        'Άλλαξε το μήνυμα σε κάτι δικό σου (όχι «Hello IoT»).',
        'Απάντησε στην ερώτηση επανάληψης και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Επανάληψη: ποιο τμήμα τρέχει μία φορά, και ποια εντολή αλλάζει φυσική έξοδο;',
        options: ['setup() · digitalWrite', 'loop() · Serial.println', 'setup() · pinMode'],
        answer: 0,
        explain: 'Σωστά. Το setup() τρέχει μία φορά. Το digitalWrite αλλάζει την τάση στο pin, άρα αλλάζει κάτι στον φυσικό κόσμο. Το pinMode μόνο ρυθμίζει.',
        retry: 'Όχι ακόμα. Το pinMode ρυθμίζει το pin, αλλά δεν το ανάβει ούτε το σβήνει.'
      },
      hints: [
        'Ποια λέξη σημαίνει «κλειστό»;',
        'Άλλαξε το HIGH σε LOW στη γραμμή του digitalWrite, και άλλαξε το κείμενο μέσα στα εισαγωγικά.',
        'Παράδειγμα:\ndigitalWrite(LED_PIN, LOW);\nSerial.println("Το σπίτι ξεκινά");'
      ],
      validationTests: [
        { name: 'Το LED παραμένει ρυθμισμένο ως έξοδος', script: [{ setup: true }, { check: 'ledOutput', fail: 'Το LED_PIN είναι: {v}. Κράτα το pinMode(LED_PIN, OUTPUT);' }] },
        { name: 'Το LED είναι σβηστό', script: [{ setup: true }, { loops: 3 }, { check: 'led', is: false, fail: 'Το LED είναι {v}. Ποια τιμή σβήνει ένα pin: HIGH ή LOW;' }] },
        { name: 'Τυπώνεται ένα νέο μήνυμα, μία φορά', script: [
          { setup: true }, { loops: 3 },
          { check: 'total', is: 1, fail: 'Τυπώθηκαν {n} γραμμές. Περίμενα ακριβώς μία, από το setup().' },
          { check: 'lastLine', not: 'Hello IoT', notEmpty: true, fail: 'Το μήνυμα είναι {v}. Γράψε κάτι δικό σου.' }
        ] }
      ],
      explanationOnSuccess: 'Έλυσες την άσκηση χωρίς καθοδήγηση. Άλλαξες την έξοδο (LOW) και το μήνυμα, και κράτησες σωστά τη ρύθμιση του pin.',
      remediation: 'Αν το LED δεν σβήνει, έλεγξε ότι δεν υπάρχει δεύτερο digitalWrite με HIGH.'
    },

    {
      id: 'c1-l5', chapter: 1, kind: 'checkpoint', skills: ['syntax'],
      title: 'Βρες το λάθος: το αόρατο ερωτηματικό',
      prerequisites: ['c1-l4'],
      objectives: ['Να διαβάζω ένα μήνυμα λάθους: γραμμή, αιτία, επόμενο βήμα.', 'Να ξεχωρίζω το αγγλικό ; από το ελληνικό ερωτηματικό.'],
      theory: `
<p>Στο ελληνικό πληκτρολόγιο, το πλήκτρο <kbd>Q</kbd> γράφει <code>;</code>. Αυτό είναι το <strong>ελληνικό ερωτηματικό</strong>. Μοιάζει ακριβώς με το αγγλικό semicolon, αλλά για τον υπολογιστή είναι <strong>άλλος χαρακτήρας</strong>.</p>
<p>Επίσης, στη C++ <strong>τα κεφαλαία και τα πεζά μετράνε</strong>: το <code>digitalWrite</code> και το <code>digitalwrite</code> είναι διαφορετικά ονόματα.</p>
<p>Όταν κάτι δεν πάει καλά, το μήνυμα λάθους λέει <strong>σε ποια γραμμή</strong>, <strong>τι βρήκε</strong> και <strong>τι να δοκιμάσεις</strong>. Τα λάθη εμφανίζονται ένα-ένα: διορθώνεις το πρώτο και ξανατρέχεις.</p>`,
      glossary: ['semicolon', 'μήνυμα λάθους'],
      supportedSyntax: SYNTAX_CH1,
      initialCode: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalwrite(LED_PIN, HIGH);
  Serial.begin(115200);
  Serial.println("Hello IoT");
}

void loop() {
}
`,
      solution: C1_SOLVED.replace('// Το πρώτο μου πρόγραμμα\n', ''),
      initialWorld: {},
      steps: [
        'Πάτησε «Εκτέλεση» και διάβασε προσεκτικά το μήνυμα λάθους.',
        'Πήγαινε στη γραμμή που δείχνει και διόρθωσέ τη.',
        'Τρέξε ξανά. Αν εμφανιστεί δεύτερο λάθος, διόρθωσέ το κι αυτό.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί ο υπολογιστής δεν δέχεται το ελληνικό ερωτηματικό στη θέση του ;',
        options: ['Είναι διαφορετικός χαρακτήρας, ακόμα κι αν φαίνεται ίδιος', 'Γιατί το ; πρέπει πάντα να έχει κενό πριν', 'Γιατί οι εντολές δεν τελειώνουν με ;'],
        answer: 0,
        explain: 'Σωστά. Κάθε χαρακτήρας έχει δικό του κωδικό. Το ελληνικό ερωτηματικό (U+037E) και το αγγλικό semicolon (U+003B) μοιάζουν, αλλά έχουν διαφορετικούς κωδικούς.',
        retry: 'Όχι ακόμα. Ξαναδιάβασε το μήνυμα λάθους: τι λέει ότι βρήκε;'
      },
      hints: [
        'Τρέξε τον κώδικα και κοίτα τη γραμμή που δείχνει το μήνυμα λάθους.',
        'Υπάρχουν δύο λάθη: ένα σημάδι στο τέλος της γραμμής 2 και ένα γράμμα που έπρεπε να είναι κεφαλαίο στη γραμμή 3.',
        'Γραμμή 2: σβήσε το τελευταίο σημάδι και γράψε ; με αγγλικό πληκτρολόγιο.\nΓραμμή 3: γράψε digitalWrite με κεφαλαίο W.'
      ],
      validationTests: C1_LED_TESTS,
      explanationOnSuccess: 'Διάβασες τα μηνύματα λάθους και τα χρησιμοποίησες για να βρεις τη γραμμή και την αιτία. Αυτό θα το κάνεις πολύ συχνά: ακόμα και οι έμπειροι προγραμματιστές κάνουν τέτοια λάθη κάθε μέρα.',
      remediation: 'Αν το λάθος συνεχίζει, σβήσε όλη τη γραμμή και γράψε την ξανά με αγγλικό πληκτρολόγιο.'
    },

    // ------------------------------------------------------------- Κεφάλαιο 2

    {
      id: 'c2-l1', chapter: 2, kind: 'micro', skills: ['variables'],
      title: 'Μεταβλητές: κουτιά με όνομα',
      prerequisites: ['c1-l5'],
      objectives: ['Να δηλώνω μια μεταβλητή int.', 'Να ξεχωρίζω τη δήλωση από την ανάθεση.', 'Να προβλέπω πώς αλλάζει μια τιμή σε κάθε επανάληψη.'],
      theory: `
<p>Μια <strong>μεταβλητή</strong> είναι ένα κουτί με όνομα, που κρατά μια τιμή.</p>
<p><code>int counter = 0;</code> σημαίνει: «φτιάξε ένα κουτί για ακέραιο αριθμό (<code>int</code>), με όνομα <code>counter</code>, και βάλε μέσα 0». Αυτό λέγεται <strong>δήλωση</strong>.</p>
<p><code>counter = counter + 1;</code> σημαίνει: «πάρε την τιμή που έχει τώρα το counter, πρόσθεσε 1, και βάλε το αποτέλεσμα πίσω στο counter». Αυτό λέγεται <strong>ανάθεση</strong>. Το <code>=</code> εδώ δεν σημαίνει «ισούται» όπως στα μαθηματικά, αλλά «βάλε μέσα».</p>
<p>Υπάρχει και ο τύπος <code>bool</code>, που κρατά μόνο <code>true</code> (αληθές) ή <code>false</code> (ψευδές).</p>
<p>Όταν η μεταβλητή δηλώνεται <strong>έξω από τις συναρτήσεις</strong>, θυμάται την τιμή της από τη μία επανάληψη του loop() στην επόμενη.</p>`,
      glossary: ['μεταβλητή', 'int', 'bool', 'δήλωση', 'ανάθεση'],
      supportedSyntax: SYNTAX_CH2,
      initialCode: `int counter = 0;   // ένα κουτί με όνομα counter, ξεκινά από 0

void setup() {
  Serial.begin(115200);
}

void loop() {
  counter = counter + 1;      // πάρε την παλιά τιμή και πρόσθεσε 1
  Serial.println(counter);
  delay(1000);
}
`,
      solution: `int counter = 0;   // ένα κουτί με όνομα counter, ξεκινά από 0

void setup() {
  Serial.begin(115200);
}

void loop() {
  counter = counter + 2;      // πάρε την παλιά τιμή και πρόσθεσε 2
  Serial.println(counter);
  delay(1000);
}
`,
      initialWorld: {},
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Πάτησε «Ένα βήμα» και παρακολούθησε το counter στον πίνακα «Μεταβλητές»: τρέχουσα και προηγούμενη τιμή.',
        'Άλλαξε το πρόγραμμα ώστε να τυπώνει 2, 4, 6, …',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι θα τυπωθεί στην τρίτη επανάληψη του loop();',
        options: ['1', '3', '0', 'counter'],
        answer: 1,
        explain: 'Σωστά. Το counter ξεκινά από 0. Επανάληψη 1 → 1, επανάληψη 2 → 2, επανάληψη 3 → 3. Το Serial.println(counter) τυπώνει την τιμή, όχι τη λέξη counter.',
        retry: 'Όχι ακόμα. Γράψε στο χαρτί την τιμή του counter μετά από κάθε επανάληψη.'
      },
      hints: [
        'Ποια γραμμή αλλάζει την τιμή του counter;',
        'Στη γραμμή counter = counter + 1; άλλαξε τον αριθμό που προστίθεται.',
        'Γράψε: counter = counter + 2;'
      ],
      validationTests: [
        { name: 'Τυπώνει 2, 4, 6 στις τρεις πρώτες επαναλήψεις', script: [{ setup: true }, { loops: 3 }, { check: 'lines', is: ['2', '4', '6'], fail: 'Τυπώθηκαν: {v}. Περίμενα «2», «4», «6».' }] }
      ],
      explanationOnSuccess: 'Το counter θυμάται την τιμή του ανάμεσα στις επαναλήψεις, επειδή δηλώθηκε έξω από τις συναρτήσεις. Κάθε φορά παίρνει την παλιά τιμή και προσθέτει 2.',
      remediation: 'Αν τυπώνει 2, 2, 2, μήπως έγραψες counter = 2; αντί για counter = counter + 2;'
    },

    {
      id: 'c2-l2', chapter: 2, kind: 'micro', skills: ['io', 'variables'],
      title: 'HIGH, LOW και digitalRead',
      prerequisites: ['c2-l1'],
      objectives: ['Να διαβάζω την κατάσταση ενός κουμπιού.', 'Να αποθηκεύω μια ανάγνωση σε μεταβλητή.'],
      theory: `
<p>Μέχρι τώρα <strong>γράφαμε</strong> σε ένα pin (έξοδος). Τώρα θα <strong>διαβάσουμε</strong> από ένα pin (είσοδος).</p>
<p><code>pinMode(BUTTON_PIN, INPUT);</code> λέει: «το pin του κουμπιού είναι <strong>είσοδος</strong>».</p>
<p><code>digitalRead(BUTTON_PIN)</code> ρωτά το pin και <strong>επιστρέφει</strong> μια τιμή: <code>HIGH</code> (1) ή <code>LOW</code> (0).</p>
<p>Στην εικονική πλακέτα, το κουμπί δίνει <code>HIGH</code> όταν είναι πατημένο και <code>LOW</code> όταν είναι ελεύθερο.</p>
<p>Για να κρατήσουμε την τιμή, τη βάζουμε σε μεταβλητή: <code>buttonState = digitalRead(BUTTON_PIN);</code></p>`,
      glossary: ['digitalRead', 'INPUT', 'HIGH / LOW', 'επιστρέφει'],
      supportedSyntax: SYNTAX_CH2,
      initialCode: `int buttonState = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  buttonState = ____;   // ΣΥΜΠΛΗΡΩΣΕ: διάβασε το κουμπί
  Serial.println(buttonState);
  delay(500);
}
`,
      solution: `int buttonState = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  buttonState = digitalRead(BUTTON_PIN);   // διάβασε το κουμπί
  Serial.println(buttonState);
  delay(500);
}
`,
      initialWorld: { button: false },
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το κενό ____ ώστε το buttonState να παίρνει την τιμή του κουμπιού.',
        'Πάτησε «Εκτέλεση». Πάτησε και άφησε το κουμπί στην πλακέτα και δες τι τυπώνεται.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Όταν το κουμπί είναι πατημένο, τι επιστρέφει το digitalRead(BUTTON_PIN);',
        options: ['HIGH (1)', 'LOW (0)', 'Το κείμενο "πατημένο"'],
        answer: 0,
        explain: 'Σωστά. Στην εικονική πλακέτα, πατημένο κουμπί = HIGH = 1. Το Serial.println τυπώνει το 1.',
        retry: 'Όχι ακόμα. Ξαναδιάβασε τη θεωρία: τι δίνει το κουμπί όταν είναι πατημένο;'
      },
      hints: [
        'Η εντολή που διαβάζει ένα pin είναι η digitalRead.',
        'Το digitalRead θέλει ένα όρισμα: ποιο pin να διαβάσει. Το κουμπί είναι στο BUTTON_PIN.',
        'Γράψε: buttonState = digitalRead(BUTTON_PIN);'
      ],
      validationTests: [
        { name: 'Ελεύθερο κουμπί → τυπώνει 0', world: { button: false }, script: [{ setup: true }, { loops: 1 }, { check: 'lastLine', is: '0', fail: 'Με ελεύθερο κουμπί τυπώθηκε {v}. Περίμενα 0 (LOW).' }] },
        { name: 'Πατημένο κουμπί → τυπώνει 1', world: { button: false }, script: [{ setup: true }, { loops: 1 }, { set: { button: true } }, { loops: 1 }, { check: 'lastLine', is: '1', fail: 'Με πατημένο κουμπί τυπώθηκε {v}. Περίμενα 1 (HIGH). Διαβάζεις το σωστό pin;' }] }
      ],
      explanationOnSuccess: 'Το digitalRead διαβάζει το κουμπί σε κάθε επανάληψη, οπότε το πρόγραμμα αντιδρά όταν αλλάζεις την είσοδο.',
      remediation: 'Αν τυπώνει πάντα 0, έλεγξε ότι διαβάζεις το BUTTON_PIN και όχι το LED_PIN.'
    },

    {
      id: 'c2-l3', chapter: 2, kind: 'guided', skills: ['conditions', 'io'],
      title: 'Το LED ακολουθεί το κουμπί',
      prerequisites: ['c2-l2'],
      objectives: ['Να γράφω συνθήκη με ==.', 'Να καταλαβαίνω πότε εκτελείται το if και πότε το else.'],
      theory: `
<p>Το <code>if</code> ρωτά μια ερώτηση. Αν η απάντηση είναι <strong>ναι</strong> (true), εκτελεί τις εντολές στο πρώτο ζευγάρι <code>{ }</code>. Αλλιώς (<code>else</code>) εκτελεί το δεύτερο.</p>
<pre>if (συνθήκη) {
  // αν ισχύει
} else {
  // αν δεν ισχύει
}</pre>
<p>Για να ρωτήσουμε «είναι ίσο;» γράφουμε <strong>δύο</strong> ίσον: <code>==</code>. Π.χ. <code>buttonState == HIGH</code> σημαίνει «είναι το κουμπί πατημένο;».</p>
<p>Όταν τρέχεις βήμα-βήμα, η ενότητα «Γιατί αυτό το σκέλος;» εξηγεί ποιο σκέλος επιλέχθηκε και με ποιες τιμές.</p>`,
      glossary: ['if / else', 'συνθήκη', 'σύγκριση'],
      supportedSyntax: SYNTAX_CH2,
      initialCode: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  int buttonState = digitalRead(BUTTON_PIN);

  if (____) {                     // ΣΥΜΠΛΗΡΩΣΕ τη συνθήκη
    digitalWrite(LED_PIN, HIGH);  // κουμπί πατημένο → LED αναμμένο
  } else {
    digitalWrite(LED_PIN, LOW);   // αλλιώς → LED σβηστό
  }
}
`,
      solution: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  int buttonState = digitalRead(BUTTON_PIN);

  if (buttonState == HIGH) {
    digitalWrite(LED_PIN, HIGH);  // κουμπί πατημένο → LED αναμμένο
  } else {
    digitalWrite(LED_PIN, LOW);   // αλλιώς → LED σβηστό
  }
}
`,
      initialWorld: { button: false },
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τη συνθήκη του if.',
        'Τρέξε βήμα-βήμα με ελεύθερο κουμπί, και μετά με πατημένο. Δες ποιο σκέλος φωτίζεται.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το κουμπί είναι ελεύθερο, άρα η συνθήκη είναι false. Ποιο σκέλος εκτελείται;',
        options: ['Το σκέλος του else', 'Το σκέλος του if', 'Και τα δύο'],
        answer: 0,
        explain: 'Σωστά. Όταν η συνθήκη είναι false, το πρόγραμμα παρακάμπτει το πρώτο μπλοκ και εκτελεί το else. Ποτέ και τα δύο.',
        retry: 'Όχι ακόμα. Το else σημαίνει «αλλιώς», δηλαδή «αν η συνθήκη δεν ισχύει».'
      },
      hints: [
        'Η ερώτηση που θέλουμε είναι: «είναι το κουμπί πατημένο;»',
        'Σύγκρινε τη μεταβλητή buttonState με το HIGH. Για σύγκριση χρειάζονται δύο ίσον.',
        'Γράψε: if (buttonState == HIGH) {'
      ],
      validationTests: [
        { name: 'Ελεύθερο κουμπί → LED σβηστό', world: { button: false }, script: [{ setup: true }, { loops: 2 }, { check: 'led', is: false, fail: 'Με ελεύθερο κουμπί το LED είναι {v}.' }] },
        { name: 'Πατημένο κουμπί → LED αναμμένο', world: { button: true }, script: [{ setup: true }, { loops: 2 }, { check: 'led', is: true, fail: 'Με πατημένο κουμπί το LED είναι {v}.' }] },
        { name: 'Το LED ακολουθεί κάθε αλλαγή', world: { button: false }, script: [
          { setup: true }, { loops: 1 },
          { set: { button: true } }, { loops: 1 }, { check: 'led', is: true, fail: 'Πάτησα το κουμπί αλλά το LED είναι {v}.' },
          { set: { button: false } }, { loops: 1 }, { check: 'led', is: false, fail: 'Άφησα το κουμπί αλλά το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Το πρόγραμμα ελέγχει το κουμπί σε κάθε επανάληψη. Επειδή υπάρχει και if και else, το LED παίρνει πάντα μια σωστή τιμή.',
      remediation: 'Αν το LED δεν σβήνει ποτέ, έλεγξε ότι έγραψες == (δύο ίσον) και όχι =.'
    },

    {
      id: 'c2-l4', chapter: 2, kind: 'variant', skills: ['conditions', 'variables'],
      title: 'Ανεστραμμένη λογική',
      prerequisites: ['c2-l3'],
      objectives: ['Να χρησιμοποιώ μεταβλητή bool.', 'Να αντιστρέφω μια συνθήκη με !.'],
      theory: `
<p>Μια μεταβλητή <code>bool</code> κρατά <code>true</code> ή <code>false</code>. Μπορεί να κρατήσει το αποτέλεσμα μιας σύγκρισης:</p>
<p><code>bool pressed = (digitalRead(BUTTON_PIN) == HIGH);</code></p>
<p>Το <code>!</code> σημαίνει «όχι». Το <code>!pressed</code> είναι true όταν το <code>pressed</code> είναι false.</p>
<p>Σενάριο: ένα φωτάκι νυκτός μένει αναμμένο, και σβήνει μόνο όσο κρατάς πατημένο το κουμπί.</p>`,
      glossary: ['bool', '! (όχι)'],
      supportedSyntax: SYNTAX_CH2,
      initialCode: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  bool pressed = (digitalRead(BUTTON_PIN) == HIGH);

  if (pressed) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}
`,
      solution: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  bool pressed = (digitalRead(BUTTON_PIN) == HIGH);

  if (!pressed) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}
`,
      initialWorld: { button: false },
      steps: [
        'Άλλαξε το πρόγραμμα ώστε το LED να είναι αναμμένο όταν το κουμπί ΔΕΝ είναι πατημένο.',
        'Δοκίμασε και τις δύο καταστάσεις του κουμπιού.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι κάνει το ! μπροστά από μια μεταβλητή bool;',
        options: ['Την αντιστρέφει: το true γίνεται false και το αντίστροφο', 'Τη μηδενίζει', 'Τη συγκρίνει με το 1'],
        answer: 0,
        explain: 'Σωστά. Το ! είναι το «όχι». Δεν αλλάζει τη μεταβλητή, απλώς δίνει την αντίθετη τιμή της.',
        retry: 'Όχι ακόμα. Το ! διαβάζεται «όχι».'
      },
      hints: [
        'Υπάρχουν δύο τρόποι: να αλλάξεις τη συνθήκη ή να αλλάξεις τι κάνει κάθε σκέλος.',
        'Βάλε ! μπροστά από το pressed στη συνθήκη, ή άλλαξε θέση στο HIGH και το LOW.',
        'Γράψε: if (!pressed) {'
      ],
      validationTests: [
        { name: 'Ελεύθερο κουμπί → LED αναμμένο', world: { button: false }, script: [{ setup: true }, { loops: 2 }, { check: 'led', is: true, fail: 'Με ελεύθερο κουμπί το LED είναι {v}. Εδώ πρέπει να είναι αναμμένο.' }] },
        { name: 'Πατημένο κουμπί → LED σβηστό', world: { button: true }, script: [{ setup: true }, { loops: 2 }, { check: 'led', is: false, fail: 'Με πατημένο κουμπί το LED είναι {v}. Εδώ πρέπει να είναι σβηστό.' }] },
        { name: 'Αντιδρά σε κάθε αλλαγή', world: { button: false }, script: [
          { setup: true }, { loops: 1 },
          { set: { button: true } }, { loops: 1 }, { check: 'led', is: false, fail: 'Πάτησα το κουμπί αλλά το LED είναι {v}.' },
          { set: { button: false } }, { loops: 1 }, { check: 'led', is: true, fail: 'Άφησα το κουμπί αλλά το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η ίδια είσοδος έδωσε την αντίθετη συμπεριφορά. Αν η λύση σου είναι διαφορετική από του διπλανού σου, μπορεί και οι δύο να είναι σωστές: ο έλεγχος κοιτά τη συμπεριφορά, όχι τον κώδικα.',
      remediation: 'Αν τίποτα δεν άλλαξε, έλεγξε ότι το ! είναι μέσα στις παρενθέσεις του if.'
    },

    {
      id: 'c2-l5', chapter: 2, kind: 'checkpoint', skills: ['conditions', 'syntax'],
      title: 'Βρες το λάθος: = ή ==;',
      prerequisites: ['c2-l4'],
      objectives: ['Να ξεχωρίζω την ανάθεση (=) από τη σύγκριση (==).', 'Να εντοπίζω λάθος με βάση τη συμπεριφορά.'],
      theory: `
<p>Αυτός ο κώδικας <strong>τρέχει χωρίς λάθος</strong>, αλλά δεν κάνει αυτό που θέλουμε: το LED μένει πάντα αναμμένο.</p>
<p>Τέτοια λάθη είναι πιο δύσκολα, γιατί δεν τα σταματά ο υπολογιστής. Τα βρίσκεις αν <strong>συγκρίνεις τι περίμενες με τι έγινε</strong>.</p>
<p>Χρήσιμα εργαλεία: «Ένα βήμα», ο πίνακας «Μεταβλητές» και η ενότητα «Γιατί αυτό το σκέλος;». Κοίτα επίσης τις προειδοποιήσεις κάτω από τον κώδικα.</p>`,
      glossary: ['ανάθεση', 'σύγκριση', 'προειδοποίηση'],
      supportedSyntax: SYNTAX_CH2,
      initialCode: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  int buttonState = digitalRead(BUTTON_PIN);

  if (buttonState = HIGH) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}
`,
      solution: `void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  int buttonState = digitalRead(BUTTON_PIN);

  if (buttonState == HIGH) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}
`,
      initialWorld: { button: false },
      steps: [
        'Τρέξε τον κώδικα με ελεύθερο κουμπί. Τι κάνει το LED; Τι περίμενες;',
        'Τρέξε βήμα-βήμα και κοίτα την τιμή του buttonState πριν και μετά το if.',
        'Διόρθωσε το λάθος και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι κάνει το buttonState = HIGH μέσα στη συνθήκη του if;',
        options: ['Βάζει HIGH στη μεταβλητή, άρα η συνθήκη είναι πάντα αληθής', 'Συγκρίνει το buttonState με το HIGH', 'Σβήνει το LED'],
        answer: 0,
        explain: 'Σωστά. Το = είναι ανάθεση: αλλάζει το buttonState σε HIGH (1), και το 1 μετράει ως true. Γι’ αυτό εκτελείται πάντα το if.',
        retry: 'Όχι ακόμα. Δες στον πίνακα «Μεταβλητές» τι τιμή έχει το buttonState μετά τη γραμμή του if.'
      },
      hints: [
        'Το LED ανάβει ακόμα κι όταν το κουμπί είναι ελεύθερο. Κοίτα τη συνθήκη του if.',
        'Στη συνθήκη υπάρχει ένα σύμβολο που αλλάζει την τιμή αντί να τη συγκρίνει.',
        'Άλλαξε το = σε == :\nif (buttonState == HIGH) {'
      ],
      validationTests: [
        { name: 'Ελεύθερο κουμπί → LED σβηστό', world: { button: false }, script: [{ setup: true }, { loops: 2 }, { check: 'led', is: false, fail: 'Με ελεύθερο κουμπί το LED είναι {v}. Η συνθήκη μάλλον είναι πάντα αληθής.' }] },
        { name: 'Πατημένο κουμπί → LED αναμμένο', world: { button: true }, script: [{ setup: true }, { loops: 2 }, { check: 'led', is: true, fail: 'Με πατημένο κουμπί το LED είναι {v}.' }] },
        { name: 'Το LED ακολουθεί κάθε αλλαγή', world: { button: false }, script: [
          { setup: true }, { loops: 1 },
          { set: { button: true } }, { loops: 1 }, { check: 'led', is: true, fail: 'Πάτησα το κουμπί αλλά το LED είναι {v}.' },
          { set: { button: false } }, { loops: 1 }, { check: 'led', is: false, fail: 'Άφησα το κουμπί αλλά το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Βρήκες ένα από τα πιο συνηθισμένα λάθη στη C++. Το = βάζει τιμή, το == ρωτά αν δύο τιμές είναι ίσες.',
      remediation: 'Αν δεν βλέπεις τη διαφορά, τρέξε βήμα-βήμα και κοίτα τη στήλη «Προηγούμενη» του buttonState.'
    },

    // ------------------------------------------------------------- Κεφάλαιο 3

    {
      id: 'c3-l1', chapter: 3, kind: 'micro', skills: ['io', 'conditions'],
      title: 'Ο αισθητήρας κίνησης PIR',
      prerequisites: ['c2-l5'],
      objectives: ['Να διαβάζω έναν αισθητήρα κίνησης.', 'Να δω γιατί ένα μήνυμα επαναλαμβάνεται όσο κρατά η κίνηση.'],
      theory: `
<p>Ο <strong>PIR</strong> είναι αισθητήρας κίνησης. Για το πρόγραμμα μοιάζει με κουμπί: δίνει <code>HIGH</code> όσο βλέπει κίνηση και <code>LOW</code> όταν δεν βλέπει.</p>
<p>Στην εικονική πλακέτα αλλάζεις την κίνηση με τον διακόπτη «Κίνηση».</p>
<p>Το <code>digitalWrite</code> δέχεται και μεταβλητή ως δεύτερο όρισμα: <code>digitalWrite(LED_PIN, motion);</code> γράφει στο LED ό,τι τιμή έχει το <code>motion</code>.</p>`,
      glossary: ['PIR', 'αισθητήρας'],
      supportedSyntax: SYNTAX_CH3,
      initialCode: `void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int motion = digitalRead(PIR_PIN);

  if (motion == HIGH) {
    Serial.println("Motion detected");
  }
  // ΣΥΜΠΛΗΡΩΣΕ: κάνε το LED να ακολουθεί την κίνηση

  delay(500);
}
`,
      solution: `void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int motion = digitalRead(PIR_PIN);

  if (motion == HIGH) {
    Serial.println("Motion detected");
  }
  digitalWrite(LED_PIN, motion);

  delay(500);
}
`,
      initialWorld: { pir: false },
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Κάνε το LED να ανάβει όσο υπάρχει κίνηση και να σβήνει όταν σταματά.',
        'Πάτησε «Εκτέλεση», άναψε την «Κίνηση» για λίγα δευτερόλεπτα και κοίτα το Serial Monitor.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η κίνηση διαρκεί 3 επαναλήψεις του loop(). Πόσες φορές θα τυπωθεί «Motion detected»;',
        options: ['1', '3', '0'],
        answer: 1,
        explain: 'Σωστά. Σε κάθε επανάληψη το πρόγραμμα ρωτά «υπάρχει κίνηση;» και, αφού υπάρχει, τυπώνει ξανά. Στο επόμενο μάθημα θα το διορθώσουμε.',
        retry: 'Όχι ακόμα. Πόσες φορές ελέγχεται η συνθήκη όσο κρατά η κίνηση;'
      },
      hints: [
        'Το LED πρέπει να έχει την ίδια τιμή με το motion.',
        'Μπορείς να γράψεις if / else, ή να δώσεις κατευθείαν το motion στο digitalWrite.',
        'Γράψε μετά το if: digitalWrite(LED_PIN, motion);'
      ],
      validationTests: [
        { name: 'Χωρίς κίνηση → LED σβηστό, κανένα μήνυμα', world: { pir: false }, script: [{ setup: true }, { loops: 2 }, { check: 'led', is: false, fail: 'Χωρίς κίνηση το LED είναι {v}.' }, { check: 'total', is: 0, fail: 'Χωρίς κίνηση τυπώθηκαν {n} γραμμές.' }] },
        { name: 'Με κίνηση → LED αναμμένο', world: { pir: false }, script: [{ setup: true }, { set: { pir: true } }, { loops: 3 }, { check: 'led', is: true, fail: 'Με κίνηση το LED είναι {v}.' }, { check: 'count', text: 'Motion detected', is: 3, fail: 'Σε 3 επαναλήψεις με κίνηση τυπώθηκε {n} φορές. Σε αυτό το μάθημα το περιμένουμε 3 φορές.' }] },
        { name: 'Όταν σταματά η κίνηση → LED σβήνει', world: { pir: true }, script: [{ setup: true }, { loops: 2 }, { set: { pir: false } }, { loops: 1 }, { check: 'led', is: false, fail: 'Η κίνηση σταμάτησε αλλά το LED είναι {v}.' }] }
      ],
      explanationOnSuccess: 'Το LED ακολουθεί τον αισθητήρα. Πρόσεξε όμως ότι το «Motion detected» τυπώνεται σε κάθε επανάληψη όσο κρατά η κίνηση. Σε ένα πραγματικό σπίτι θα έστελνε δεκάδες ειδοποιήσεις για ένα μόνο πέρασμα.',
      remediation: 'Αν το LED δεν σβήνει, μήπως έγραψες digitalWrite μόνο μέσα στο if; Τότε κανείς δεν το σβήνει όταν σταματά η κίνηση.'
    },

    {
      id: 'c3-l2', chapter: 3, kind: 'micro', skills: ['state', 'variables'],
      title: 'Παρούσα και προηγούμενη τιμή',
      prerequisites: ['c3-l1'],
      objectives: ['Να κρατώ την προηγούμενη τιμή μιας εισόδου.', 'Να εντοπίζω μια αλλαγή κατάστασης.'],
      theory: `
<p>Για να καταλάβουμε ότι κάτι <strong>άλλαξε</strong>, χρειάζεται να θυμόμαστε πώς ήταν πριν.</p>
<ul>
  <li><code>motion</code>: η τιμή <strong>τώρα</strong>, σε αυτή την επανάληψη.</li>
  <li><code>lastMotion</code>: η τιμή στην <strong>προηγούμενη</strong> επανάληψη. Δηλώνεται έξω από τις συναρτήσεις, για να τη θυμάται.</li>
</ul>
<p>Αν <code>motion != lastMotion</code> (το <code>!=</code> σημαίνει «διαφορετικό»), τότε κάτι άλλαξε.</p>
<p>Στο τέλος κάθε επανάληψης γράφουμε την τωρινή τιμή στη μνήμη, για να τη συγκρίνουμε την επόμενη φορά.</p>
<p>Ο <strong>Πίνακας επαναλήψεων</strong> (στη στήλη εξόδου) δείχνει για κάθε επανάληψη την είσοδο, τις μεταβλητές και τι τυπώθηκε.</p>`,
      glossary: ['κατάσταση (state)', '!= (διαφορετικό)'],
      supportedSyntax: SYNTAX_CH3,
      initialCode: `int lastMotion = LOW;   // η τιμή του PIR στην προηγούμενη επανάληψη

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
}

void loop() {
  int motion = digitalRead(PIR_PIN);   // η τιμή τώρα

  if (motion != lastMotion) {
    Serial.println("State changed");
  }

  lastMotion = ____;   // ΣΥΜΠΛΗΡΩΣΕ: θυμήσου την τιμή για την επόμενη φορά
  delay(500);
}
`,
      solution: `int lastMotion = LOW;   // η τιμή του PIR στην προηγούμενη επανάληψη

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
}

void loop() {
  int motion = digitalRead(PIR_PIN);   // η τιμή τώρα

  if (motion != lastMotion) {
    Serial.println("State changed");
  }

  lastMotion = motion;   // θυμήσου την τιμή για την επόμενη φορά
  delay(500);
}
`,
      initialWorld: { pir: false },
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το κενό ώστε το lastMotion να θυμάται την τωρινή τιμή.',
        'Τρέξε, άλλαξε την κίνηση μερικές φορές και κοίτα τον Πίνακα επαναλήψεων.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο PIR δίνει διαδοχικά 0, 0, 1, 1, 0 (μία τιμή ανά επανάληψη). Πόσες αλλαγές υπάρχουν;',
        options: ['2', '3', '5'],
        answer: 0,
        explain: 'Σωστά. Από 0 σε 1 (η κίνηση ξεκίνησε) και από 1 σε 0 (σταμάτησε). Όταν η τιμή μένει ίδια, δεν υπάρχει αλλαγή.',
        retry: 'Όχι ακόμα. Μέτρα μόνο τα σημεία όπου ο αριθμός είναι διαφορετικός από τον προηγούμενο.'
      },
      hints: [
        'Στο τέλος της επανάληψης, η «προηγούμενη» τιμή για την επόμενη φορά είναι η τιμή που έχουμε τώρα.',
        'Η τωρινή τιμή βρίσκεται στη μεταβλητή motion.',
        'Γράψε: lastMotion = motion;'
      ],
      validationTests: [
        { name: 'Ακολουθία 0,0,1,1,0 → ακριβώς 2 αλλαγές', world: { pir: false }, script: [{ setup: true }, { sequence: { pir: [0, 0, 1, 1, 0] } }, { check: 'count', text: 'State changed', is: 2, fail: 'Τυπώθηκε {n} φορές. Με την ακολουθία 0,0,1,1,0 υπάρχουν ακριβώς 2 αλλαγές.' }] },
        { name: 'Σταθερή κίνηση → μόνο μία αλλαγή', world: { pir: false }, script: [{ setup: true }, { sequence: { pir: [1, 1, 1, 1] } }, { check: 'count', text: 'State changed', is: 1, fail: 'Με σταθερή κίνηση τυπώθηκε {n} φορές. Περίμενα 1: μόνο τη στιγμή που ξεκίνησε.' }] }
      ],
      explanationOnSuccess: 'Το πρόγραμμα τώρα αντιδρά στην αλλαγή και όχι στην κατάσταση. Αυτό το μοτίβο (τωρινή τιμή, προηγούμενη τιμή, σύγκριση, ενημέρωση) θα το χρησιμοποιείς πολύ συχνά.',
      remediation: 'Αν τυπώνει σε κάθε επανάληψη, το lastMotion δεν ενημερώνεται. Αν δεν τυπώνει ποτέ, έλεγξε ότι η ενημέρωση γίνεται μετά τη σύγκριση.'
    },

    {
      id: 'c3-l3', chapter: 3, kind: 'guided', skills: ['state', 'conditions'],
      title: 'Motion detected μόνο στην αρχή',
      prerequisites: ['c3-l2'],
      objectives: ['Να ξεχωρίζω την αρχή από το τέλος μιας κίνησης.', 'Να συνδυάζω δύο συνθήκες με &&.'],
      theory: `
<p>Το <code>&&</code> σημαίνει «και»: η συνθήκη ισχύει μόνο αν ισχύουν και οι δύο πλευρές.</p>
<ul>
  <li>Η κίνηση <strong>μόλις ξεκίνησε</strong>: τώρα <code>HIGH</code> <em>και</em> πριν <code>LOW</code>.</li>
  <li>Η κίνηση <strong>μόλις σταμάτησε</strong>: τώρα <code>LOW</code> <em>και</em> πριν <code>HIGH</code>.</li>
</ul>
<p>Έτσι, ένα πέρασμα από το δωμάτιο δίνει <strong>ένα</strong> «Motion detected» και <strong>ένα</strong> «Motion stopped», όσο κι αν κρατήσει.</p>`,
      glossary: ['&& (και)', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX_CH3,
      initialCode: `int lastMotion = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int motion = digitalRead(PIR_PIN);

  // ΣΥΜΠΛΗΡΩΣΕ:
  // 1. Αν η κίνηση μόλις ξεκίνησε: τύπωσε "Motion detected" και άναψε το LED.
  // 2. Αν η κίνηση μόλις σταμάτησε: τύπωσε "Motion stopped" και σβήσε το LED.

  lastMotion = motion;
  delay(200);
}
`,
      solution: `int lastMotion = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int motion = digitalRead(PIR_PIN);

  if (motion == HIGH && lastMotion == LOW) {
    Serial.println("Motion detected");
    digitalWrite(LED_PIN, HIGH);
  }
  if (motion == LOW && lastMotion == HIGH) {
    Serial.println("Motion stopped");
    digitalWrite(LED_PIN, LOW);
  }

  lastMotion = motion;
  delay(200);
}
`,
      initialWorld: { pir: false },
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Γράψε δύο if: ένα για την αρχή και ένα για το τέλος της κίνησης.',
        'Τρέξε και άλλαξε την κίνηση. Κάθε πέρασμα πρέπει να δίνει ένα «Motion detected» και ένα «Motion stopped».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ποια συνθήκη σημαίνει «η κίνηση μόλις ξεκίνησε»;',
        options: ['motion == HIGH && lastMotion == LOW', 'motion == HIGH', 'lastMotion == HIGH'],
        answer: 0,
        explain: 'Σωστά. Χρειάζεται και η τωρινή τιμή (HIGH) και η προηγούμενη (LOW). Μόνο το motion == HIGH θα ίσχυε σε κάθε επανάληψη της κίνησης.',
        retry: 'Όχι ακόμα. «Μόλις ξεκίνησε» σημαίνει ότι πριν δεν υπήρχε κίνηση και τώρα υπάρχει.'
      },
      hints: [
        'Χρειάζεσαι δύο if. Κάθε if συγκρίνει και το motion και το lastMotion.',
        'Αρχή κίνησης: motion == HIGH && lastMotion == LOW. Τέλος κίνησης: το αντίθετο. Μέσα σε κάθε if βάλε ένα Serial.println και ένα digitalWrite.',
        'if (motion == HIGH && lastMotion == LOW) {\n  Serial.println("Motion detected");\n  digitalWrite(LED_PIN, HIGH);\n}\nif (motion == LOW && lastMotion == HIGH) {\n  Serial.println("Motion stopped");\n  digitalWrite(LED_PIN, LOW);\n}'
      ],
      validationTests: [
        { name: 'Ακολουθία 0,0,1,1,0 → ένα «Motion detected» και ένα «Motion stopped»', world: { pir: false }, script: [
          { setup: true }, { sequence: { pir: [0, 0, 1, 1, 0] } },
          { check: 'count', text: 'Motion detected', is: 1, fail: '«Motion detected» τυπώθηκε {n} φορές. Περίμενα 1.' },
          { check: 'count', text: 'Motion stopped', is: 1, fail: '«Motion stopped» τυπώθηκε {n} φορές. Περίμενα 1.' },
          { check: 'order', texts: ['Motion detected', 'Motion stopped'], fail: 'Η σειρά των μηνυμάτων ήταν: {v}. Πρώτα πρέπει να έρθει το «Motion detected».' }
        ] },
        { name: 'Σταθερή κίνηση → κανένα επιπλέον μήνυμα', world: { pir: false }, script: [
          { setup: true }, { sequence: { pir: [1, 1, 1, 1, 1] } },
          { check: 'total', is: 1, fail: 'Με σταθερή κίνηση τυπώθηκαν {n} γραμμές. Περίμενα μόνο μία.' },
          { check: 'led', is: true, fail: 'Κατά τη διάρκεια της κίνησης το LED είναι {v}.' }
        ] },
        { name: 'Χωρίς κίνηση → σιωπή και σβηστό LED', world: { pir: false }, script: [
          { setup: true }, { loops: 5 },
          { check: 'total', is: 0, fail: 'Χωρίς κίνηση τυπώθηκαν {n} γραμμές.' },
          { check: 'led', is: false, fail: 'Χωρίς κίνηση το LED είναι {v}.' }
        ] },
        { name: 'Δύο περάσματα → δύο ζευγάρια μηνυμάτων', world: { pir: false }, script: [
          { setup: true }, { sequence: { pir: [1, 0, 1, 0] } },
          { check: 'count', text: 'Motion detected', is: 2, fail: '«Motion detected» τυπώθηκε {n} φορές σε δύο περάσματα.' },
          { check: 'count', text: 'Motion stopped', is: 2, fail: '«Motion stopped» τυπώθηκε {n} φορές σε δύο περάσματα.' },
          { check: 'led', is: false, fail: 'Μετά το δεύτερο πέρασμα το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Το σύστημα τώρα στέλνει μία ειδοποίηση ανά γεγονός, όχι μία ανά επανάληψη. Ο έλεγχος δοκίμασε τέσσερα διαφορετικά σενάρια εισόδου και όλα πέρασαν.',
      remediation: 'Αν ένα σενάριο αποτυγχάνει, τρέξε την ίδια ακολουθία με το χέρι και κοίτα τον Πίνακα επαναλήψεων γραμμή-γραμμή.'
    },

    {
      id: 'c3-l4', chapter: 3, kind: 'checkpoint', skills: ['state', 'syntax'],
      title: 'Βρες το λάθος: η μνήμη ενημερώνεται πολύ νωρίς',
      prerequisites: ['c3-l3'],
      objectives: ['Να εντοπίζω λάθος στη σειρά των εντολών.', 'Να χρησιμοποιώ τον Πίνακα επαναλήψεων ως τεκμήριο.'],
      theory: `
<p>Ο κώδικας τρέχει χωρίς μήνυμα λάθους, αλλά <strong>δεν τυπώνει ποτέ τίποτα</strong>, όσο κι αν αλλάζεις την κίνηση.</p>
<p>Όλες οι εντολές που χρειάζονται υπάρχουν. Το πρόβλημα είναι η <strong>σειρά</strong> τους.</p>
<p>Τρέξε βήμα-βήμα και κοίτα τις τιμές του <code>motion</code> και του <code>lastMotion</code> τη στιγμή που ελέγχεται κάθε if.</p>`,
      glossary: ['σειρά εκτέλεσης', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX_CH3,
      initialCode: `int lastMotion = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int motion = digitalRead(PIR_PIN);
  lastMotion = motion;

  if (motion == HIGH && lastMotion == LOW) {
    Serial.println("Motion detected");
    digitalWrite(LED_PIN, HIGH);
  }
  if (motion == LOW && lastMotion == HIGH) {
    Serial.println("Motion stopped");
    digitalWrite(LED_PIN, LOW);
  }

  delay(200);
}
`,
      solution: `int lastMotion = LOW;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int motion = digitalRead(PIR_PIN);

  if (motion == HIGH && lastMotion == LOW) {
    Serial.println("Motion detected");
    digitalWrite(LED_PIN, HIGH);
  }
  if (motion == LOW && lastMotion == HIGH) {
    Serial.println("Motion stopped");
    digitalWrite(LED_PIN, LOW);
  }

  lastMotion = motion;
  delay(200);
}
`,
      initialWorld: { pir: false },
      steps: [
        'Τρέξε τον κώδικα και άλλαξε την κίνηση. Τι περίμενες να δεις; Τι βλέπεις;',
        'Τρέξε βήμα-βήμα. Όταν φτάσεις στο πρώτο if, κοίτα το motion και το lastMotion.',
        'Διόρθωσε τη σειρά και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί δεν τυπώνεται ποτέ τίποτα;',
        options: ['Το lastMotion γίνεται ίσο με το motion πριν από τη σύγκριση, άρα δεν βρίσκεται ποτέ διαφορά', 'Ο PIR δεν λειτουργεί', 'Λείπει το Serial.begin'],
        answer: 0,
        explain: 'Σωστά. Η ενημέρωση της μνήμης πρέπει να γίνεται μετά τη σύγκριση. Αλλιώς συγκρίνεις την τωρινή τιμή με τον εαυτό της.',
        retry: 'Όχι ακόμα. Δες στον πίνακα «Μεταβλητές» τι τιμές έχουν τα motion και lastMotion τη στιγμή του if.'
      },
      hints: [
        'Όλες οι εντολές υπάρχουν. Το πρόβλημα είναι πού βρίσκεται μία από αυτές.',
        'Η γραμμή lastMotion = motion; εκτελείται πριν από τα if. Τι τιμή έχει τότε το lastMotion;',
        'Μετακίνησε τη γραμμή lastMotion = motion; μετά το δεύτερο if, πριν από το delay(200);'
      ],
      validationTests: [
        { name: 'Ακολουθία 0,0,1,1,0 → ένα «Motion detected» και ένα «Motion stopped»', world: { pir: false }, script: [
          { setup: true }, { sequence: { pir: [0, 0, 1, 1, 0] } },
          { check: 'count', text: 'Motion detected', is: 1, fail: '«Motion detected» τυπώθηκε {n} φορές. Περίμενα 1.' },
          { check: 'count', text: 'Motion stopped', is: 1, fail: '«Motion stopped» τυπώθηκε {n} φορές. Περίμενα 1.' },
          { check: 'order', texts: ['Motion detected', 'Motion stopped'], fail: 'Η σειρά των μηνυμάτων ήταν: {v}.' }
        ] },
        { name: 'Σταθερή κίνηση → ένα μήνυμα, LED αναμμένο', world: { pir: false }, script: [
          { setup: true }, { sequence: { pir: [1, 1, 1, 1] } },
          { check: 'total', is: 1, fail: 'Με σταθερή κίνηση τυπώθηκαν {n} γραμμές. Περίμενα μία.' },
          { check: 'led', is: true, fail: 'Κατά τη διάρκεια της κίνησης το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες τη Φάση Α. Ξέρεις πια να γράφεις setup() και loop(), να διαβάζεις εισόδους, να ελέγχεις εξόδους με if/else και να θυμάσαι κατάσταση ανάμεσα στις επαναλήψεις. Αυτά είναι η βάση για όλα τα επόμενα κεφάλαια.',
      remediation: 'Αν τυπώνει σε κάθε επανάληψη, μάλλον έσβησες τη γραμμή αντί να τη μετακινήσεις.'
    }
  ];

  const GLOSSARY = [
    { term: 'εντολή', def: 'Μία οδηγία προς τον μικροελεγκτή, π.χ. digitalWrite(LED_PIN, HIGH);. Οι απλές εντολές τελειώνουν με ;' },
    { term: 'σχόλιο', def: 'Κείμενο μετά από // (ή ανάμεσα σε /* και */). Είναι σημείωση για τον άνθρωπο. Ο υπολογιστής το αγνοεί.' },
    { term: 'setup()', def: 'Η συνάρτηση που τρέχει μία φορά, όταν ξεκινά η πλακέτα. Εκεί γίνονται οι ρυθμίσεις.' },
    { term: 'loop()', def: 'Η συνάρτηση που τρέχει ξανά και ξανά, μετά το setup(), για όσο έχει ρεύμα η πλακέτα.' },
    { term: 'άγκιστρα', def: 'Τα σύμβολα { και }. Δείχνουν πού αρχίζει και πού τελειώνει ένα μπλοκ κώδικα. Κάθε { χρειάζεται το δικό του }.' },
    { term: 'semicolon', def: 'Το σύμβολο ; στο τέλος μιας εντολής. Πρέπει να γράφεται με αγγλικό πληκτρολόγιο. Το ελληνικό ερωτηματικό μοιάζει ίδιο αλλά είναι άλλος χαρακτήρας.' },
    { term: 'όρισμα', def: 'Μια τιμή που δίνεις σε μια εντολή μέσα στις παρενθέσεις. Π.χ. στο digitalWrite(LED_PIN, HIGH) τα ορίσματα είναι LED_PIN και HIGH.' },
    { term: 'GPIO', def: 'General Purpose Input/Output: ένα pin της πλακέτας που μπορεί να γίνει είσοδος ή έξοδος. Τα νούμερα διαφέρουν από πλακέτα σε πλακέτα.' },
    { term: 'pinMode', def: 'Ρυθμίζει ένα pin ως είσοδο (INPUT) ή έξοδο (OUTPUT). Γράφεται συνήθως στο setup().' },
    { term: 'digitalWrite', def: 'Γράφει HIGH ή LOW σε ένα pin εξόδου. Έτσι ανάβει ή σβήνει ένα LED.' },
    { term: 'digitalRead', def: 'Διαβάζει ένα pin εισόδου και επιστρέφει HIGH (1) ή LOW (0).' },
    { term: 'HIGH / LOW', def: 'Οι δύο ψηφιακές τιμές. HIGH = 1 = υπάρχει τάση. LOW = 0 = δεν υπάρχει τάση.' },
    { term: 'INPUT', def: 'Ρύθμιση ενός pin ως είσοδος, για κουμπιά και αισθητήρες.' },
    { term: 'επιστρέφει', def: 'Όταν μια εντολή δίνει πίσω μια τιμή, π.χ. το digitalRead επιστρέφει HIGH ή LOW. Την τιμή μπορείς να τη βάλεις σε μεταβλητή.' },
    { term: 'delay', def: 'Κάνει την πλακέτα να περιμένει. Το delay(1000) περιμένει 1000 χιλιοστά, δηλαδή 1 δευτερόλεπτο. Όσο περιμένει, δεν κάνει τίποτα άλλο.' },
    { term: 'Serial Monitor', def: 'Παράθυρο όπου εμφανίζονται τα μηνύματα που στέλνει η πλακέτα με Serial.print και Serial.println.' },
    { term: 'print / println', def: 'Το Serial.print τυπώνει χωρίς να αλλάξει γραμμή. Το Serial.println τυπώνει και αλλάζει γραμμή.' },
    { term: 'μεταβλητή', def: 'Ένα κουτί με όνομα που κρατά μια τιμή. Η τιμή μπορεί να αλλάξει όσο τρέχει το πρόγραμμα.' },
    { term: 'int', def: 'Τύπος για ακέραιους αριθμούς, π.χ. 0, 7, -3.' },
    { term: 'bool', def: 'Τύπος που κρατά μόνο true (αληθές) ή false (ψευδές).' },
    { term: 'δήλωση', def: 'Η δημιουργία μιας μεταβλητής: τύπος, όνομα και (προαιρετικά) αρχική τιμή. Π.χ. int counter = 0;' },
    { term: 'ανάθεση', def: 'Το = βάζει μια τιμή μέσα σε μεταβλητή. Π.χ. counter = 5; Δεν σημαίνει «ισούται».' },
    { term: 'σύγκριση', def: 'Το == ρωτά «είναι ίσα;» και δίνει true ή false. Το != ρωτά «είναι διαφορετικά;».' },
    { term: '!= (διαφορετικό)', def: 'Σύγκριση που είναι true όταν οι δύο τιμές διαφέρουν.' },
    { term: '! (όχι)', def: 'Αντιστρέφει μια τιμή bool: το !true είναι false.' },
    { term: '&& (και)', def: 'Ενώνει δύο συνθήκες. Το αποτέλεσμα είναι true μόνο αν ισχύουν και οι δύο.' },
    { term: 'if / else', def: 'Εκτελεί ένα μπλοκ αν ισχύει μια συνθήκη, αλλιώς (else) εκτελεί άλλο μπλοκ.' },
    { term: 'συνθήκη', def: 'Μια ερώτηση με απάντηση true ή false, γραμμένη μέσα στις παρενθέσεις του if.' },
    { term: 'κατάσταση (state)', def: 'Τιμή που το πρόγραμμα θυμάται ανάμεσα στις επαναλήψεις, π.χ. η προηγούμενη τιμή ενός αισθητήρα.' },
    { term: 'PIR', def: 'Passive Infrared: αισθητήρας που αντιλαμβάνεται κίνηση ανθρώπων από τη θερμότητά τους. Δίνει HIGH όσο βλέπει κίνηση.' },
    { term: 'αισθητήρας', def: 'Εξάρτημα που μετρά κάτι από τον φυσικό κόσμο (κίνηση, θερμοκρασία, φως) και το δίνει στην πλακέτα ως είσοδο.' },
    { term: 'μήνυμα λάθους', def: 'Εξήγηση για το τι εμπόδισε την εκτέλεση. Λέει τη γραμμή, την πιθανή αιτία και ένα επόμενο βήμα.' },
    { term: 'προειδοποίηση', def: 'Ο κώδικας τρέχει, αλλά κάτι μοιάζει ύποπτο. Αξίζει να το ελέγξεις.' },
    { term: 'σειρά εκτέλεσης', def: 'Οι εντολές εκτελούνται από πάνω προς τα κάτω. Αν αλλάξεις τη σειρά, μπορεί να αλλάξει και το αποτέλεσμα.' }
  ];

  root.IoTLessons = { lessons, CHAPTERS, SKILLS, KIND_LABELS, GLOSSARY };
})(typeof window !== 'undefined' ? window : globalThis);
