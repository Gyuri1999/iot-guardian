/*
 * IoT Guardian — Κεφάλαιο 4: Συναρτήσεις και χρόνος.
 * Έννοιες: απλές συναρτήσεις, παράμετροι, for, delay έναντι millis().
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 4).ready = true;

  const SYNTAX_CH4 = 'Ό,τι μέχρι το Κεφ. 3, συν: δικές σου συναρτήσεις (void, int, παράμετροι), for, millis(), unsigned long, const';
  const PANELS = ['serial', 'vars', 'branch', 'loops'];
  const HW = ['button'];

  // Γρήγορα πατήματα του κουμπιού: 5 φορές πατημένο 100 ms, ελεύθερο 100 ms (σύνολο ~1 δευτερόλεπτο).
  function quickPresses(n) {
    const steps = [];
    for (let i = 0; i < n; i++) {
      steps.push(
        { set: { button: true } }, { ms: 100 },
        { check: 'led', is: true, fail: 'Το κουμπί είναι πατημένο, αλλά το LED είναι {v}. Το LED πρέπει να ακολουθεί το κουμπί σε κάθε επανάληψη.' },
        { set: { button: false } }, { ms: 100 },
        { check: 'led', is: false, fail: 'Το κουμπί αφέθηκε, αλλά το LED είναι {v}.' }
      );
    }
    return steps;
  }

  const RESPONSIVE_TEST = {
    name: 'Το κουμπί απαντά αμέσως (5 γρήγορα πατήματα σε ~1 δευτερόλεπτο)',
    world: { button: false },
    script: [{ setup: true }].concat(quickPresses(5), [
      { check: 'count', text: 'tick', max: 1,
        fail: 'Σε περίπου 1 δευτερόλεπτο με πατήματα τυπώθηκαν {n} «tick». Αυτό σημαίνει ότι κάθε φορά που το πρόγραμμα κοίταζε το κουμπί, έμενε κολλημένο σε delay(1000). Έτσι 1 δευτερόλεπτο έγινε {n}. Χρησιμοποίησε millis() αντί για delay(1000).' }
    ])
  };

  const PERIODIC_TEST = {
    name: 'Ένα «tick» περίπου κάθε δευτερόλεπτο (3,1 δευτερόλεπτα → 3 ή 4)',
    world: { button: false },
    script: [
      { setup: true }, { ms: 2000 }, { ms: 1100 },
      { check: 'count', text: 'tick', min: 3, max: 4,
        fail: 'Σε 3,1 δευτερόλεπτα τυπώθηκαν {n} «tick». Περίμενα 3 ή 4. Αν είναι πάρα πολλά, μήπως το lastTick δεν θυμάται την τιμή του;',
        failZero: 'Σε 3,1 δευτερόλεπτα δεν τυπώθηκε κανένα «tick». Έλεγξε τη συνθήκη με το millis() και ότι το lastTick ενημερώνεται μέσα στο if.' }
    ]
  };

  L.GLOSSARY.push(
    { term: 'συνάρτηση', def: 'Ένα κομμάτι κώδικα με όνομα. Το γράφεις μία φορά και το χρησιμοποιείς όσες φορές θέλεις, π.χ. void blink() { … }.' },
    { term: 'κλήση συνάρτησης', def: 'Όταν γράφεις το όνομα μιας συνάρτησης με παρενθέσεις, π.χ. blink();, το πρόγραμμα πηγαίνει να εκτελέσει τον κώδικά της και μετά επιστρέφει.' },
    { term: 'void', def: 'Σημαίνει «κενό». Μια συνάρτηση void κάνει κάτι αλλά δεν επιστρέφει τιμή.' },
    { term: 'παράμετρος', def: 'Μια μεταβλητή μέσα στις παρενθέσεις μιας συνάρτησης, π.χ. int times. Παίρνει την τιμή που δίνεις όταν καλείς τη συνάρτηση.' },
    { term: 'return', def: 'Τερματίζει μια συνάρτηση και δίνει πίσω μια τιμή, π.χ. return 42;.' },
    { term: 'for', def: 'Βρόχος που επαναλαμβάνει ένα μπλοκ συγκεκριμένες φορές. for (int i = 0; i < 3; i++) { … } τρέχει 3 φορές.' },
    { term: 'millis', def: 'Επιστρέφει πόσα χιλιοστά του δευτερολέπτου (ms) έχουν περάσει από τότε που ξεκίνησε η πλακέτα. Δεν σταματά το πρόγραμμα.' },
    { term: 'unsigned long', def: 'Τύπος για μεγάλους θετικούς ακέραιους. Τον χρησιμοποιούμε για χρόνους με millis().' },
    { term: 'const', def: 'Σταθερά: μια τιμή με όνομα που δεν αλλάζει ποτέ, π.χ. const int INTERVAL = 1000;.' },
    { term: 'μπλοκάρισμα', def: 'Όταν το πρόγραμμα περιμένει (π.χ. με delay) και δεν μπορεί να κάνει τίποτα άλλο, ούτε να διαβάσει ένα κουμπί.' },
    { term: 'μη μπλοκαριστικός χρονισμός', def: 'Αντί να περιμένεις, ρωτάς σε κάθε επανάληψη: «πέρασε αρκετός χρόνος;» με millis(). Έτσι το loop() συνεχίζει να τρέχει γρήγορα.' }
  );

  L.lessons.push(
    // ------------------------------------------------------------ c4-l1
    {
      id: 'c4-l1', chapter: 4, kind: 'micro', skills: ['timing', 'order'],
      title: 'Η πρώτη σου συνάρτηση',
      prerequisites: [],
      objectives: ['Να ξεχωρίζω τον ορισμό μιας συνάρτησης από την κλήση της.', 'Να καλώ μια συνάρτηση μέσα από το loop().'],
      theory: `
<p>Μια <strong>συνάρτηση</strong> είναι ένα κομμάτι κώδικα με <strong>όνομα</strong>. Το <code>setup()</code> και το <code>loop()</code> είναι κι αυτά συναρτήσεις.</p>
<p>Μπορείς να φτιάξεις και δικές σου:</p>
<pre>void signal() {
  Serial.println("tick");
}</pre>
<ul>
  <li><code>void</code>: η συνάρτηση κάνει κάτι, αλλά δεν δίνει πίσω τιμή.</li>
  <li><code>signal</code>: το όνομά της.</li>
  <li>Μέσα στα <code>{ }</code>: τι κάνει.</li>
</ul>
<p>Ο <strong>ορισμός</strong> μόνος του δεν κάνει τίποτα. Για να τρέξει, πρέπει να την <strong>καλέσεις</strong>: <code>signal();</code></p>
<p>Η κλήση λέει: «πήγαινε, κάνε ό,τι γράφει η signal, και γύρνα πίσω εδώ».</p>`,
      glossary: ['συνάρτηση', 'κλήση συνάρτησης', 'void'],
      supportedSyntax: SYNTAX_CH4,
      initialCode: `// Ορισμός: τι κάνει η συνάρτηση signal
void signal() {
  Serial.println("tick");
}

void setup() {
  Serial.begin(115200);
}

void loop() {
  // ΣΥΜΠΛΗΡΩΣΕ: κάλεσε τη συνάρτηση signal

  delay(1000);
}
`,
      solution: `// Ορισμός: τι κάνει η συνάρτηση signal
void signal() {
  Serial.println("tick");
}

void setup() {
  Serial.begin(115200);
}

void loop() {
  signal();      // κλήση: τρέξε τον κώδικα της signal
  delay(1000);
}
`,
      initialWorld: {}, world: {},
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Κάτω από τη γραμμή ΣΥΜΠΛΗΡΩΣΕ, γράψε την κλήση της συνάρτησης signal.',
        'Πάτησε «Ένα βήμα» και δες πώς η εκτέλεση πηγαίνει μέσα στη signal και μετά γυρίζει πίσω στο loop().',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Αν σβήσεις την κλήση signal(); από το loop(), αλλά αφήσεις τον ορισμό της, τι θα τυπωθεί;',
        options: ['Τίποτα', '«tick» κάθε δευτερόλεπτο', '«tick» μία φορά'],
        answer: 0,
        explain: 'Σωστά. Ο ορισμός είναι σαν συνταγή στο ράφι. Αν κανείς δεν την καλέσει, δεν μαγειρεύεται τίποτα.',
        retry: 'Όχι ακόμα. Ο ορισμός μιας συνάρτησης τρέχει μόνος του ή μόνο όταν κάποιος την καλέσει;'
      },
      hints: [
        'Για να τρέξει μια συνάρτηση, γράφεις το όνομά της με παρενθέσεις.',
        'Η κλήση μπαίνει μέσα στο loop(), πριν από το delay(1000);. Το όνομα της συνάρτησης είναι signal.',
        'Γράψε: signal();\n• signal = το όνομα\n• () = «τρέξε την τώρα»\n• ; = τέλος εντολής'
      ],
      validationTests: [
        { name: 'Κάθε επανάληψη τυπώνει ένα «tick»', script: [
          { setup: true }, { loops: 3 },
          { check: 'count', text: 'tick', is: 3, fail: 'Σε 3 επαναλήψεις τυπώθηκε {n} φορές «tick». Περίμενα 3.', failZero: 'Δεν τυπώθηκε κανένα «tick». Η συνάρτηση signal ορίστηκε, αλλά καλείται;' }
        ] },
        { name: 'Το setup() δεν τυπώνει τίποτα', script: [
          { setup: true }, { check: 'total', is: 0, fail: 'Το setup() τύπωσε {n} γραμμές. Η κλήση πρέπει να είναι μέσα στο loop().' }
        ] }
      ],
      explanationOnSuccess: 'Η εκτέλεση πήγε από το loop() μέσα στη signal(), τύπωσε «tick» και γύρισε πίσω στο delay. Αυτό είναι μια κλήση συνάρτησης.',
      remediation: 'Αν βλέπεις λάθος «δεν υπάρχει», έλεγξε ότι γράφεις signal ακριβώς έτσι, με μικρά γράμματα.'
    },

    // ------------------------------------------------------------ c4-l2
    {
      id: 'c4-l2', chapter: 4, kind: 'guided', skills: ['timing', 'variables'],
      title: 'Παράμετροι και for: αναβόσβημα Ν φορές',
      prerequisites: ['c4-l1'],
      objectives: ['Να δίνω τιμή σε μια συνάρτηση μέσω παραμέτρου.', 'Να επαναλαμβάνω κάτι συγκεκριμένες φορές με for.', 'Να χρησιμοποιώ την ίδια συνάρτηση με διαφορετικές τιμές.'],
      theory: `
<p>Μια συνάρτηση μπορεί να παίρνει μια <strong>παράμετρο</strong>: μια τιμή που της δίνεις όταν την καλείς.</p>
<pre>void blink(int times) { … }</pre>
<p>Όταν γράφεις <code>blink(3);</code>, μέσα στη συνάρτηση το <code>times</code> έχει την τιμή 3. Με <code>blink(2);</code> έχει την τιμή 2. <strong>Ίδιος κώδικας, άλλη τιμή.</strong></p>
<p>Ο βρόχος <code>for</code> επαναλαμβάνει κάτι συγκεκριμένες φορές:</p>
<pre>for (int i = 0; i &lt; 3; i++) { … }</pre>
<ol>
  <li><code>int i = 0</code>: ξεκίνα να μετράς από 0.</li>
  <li><code>i &lt; 3</code>: συνέχισε όσο το i είναι μικρότερο από 3.</li>
  <li><code>i++</code>: μετά από κάθε γύρο, πρόσθεσε 1.</li>
</ol>
<p>Έτσι το i παίρνει τις τιμές 0, 1, 2: τρεις γύροι.</p>`,
      glossary: ['παράμετρος', 'for', 'συνάρτηση'],
      supportedSyntax: SYNTAX_CH4,
      initialCode: `// Αναβοσβήνει το LED όσες φορές λέει η παράμετρος times
void blink(int times) {
  for (int i = 0; i < ____; i++) {   // ΣΥΜΠΛΗΡΩΣΕ: πόσους γύρους;
    digitalWrite(LED_PIN, HIGH);
    Serial.println("blink");
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  blink(3);                 // τρία αναβοσβήματα στην εκκίνηση
  Serial.println("ready");
}

void loop() {
  blink(2);                 // δύο αναβοσβήματα σε κάθε επανάληψη
  delay(1000);
}
`,
      solution: `// Αναβοσβήνει το LED όσες φορές λέει η παράμετρος times
void blink(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    Serial.println("blink");
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  blink(3);                 // τρία αναβοσβήματα στην εκκίνηση
  Serial.println("ready");
}

void loop() {
  blink(2);                 // δύο αναβοσβήματα σε κάθε επανάληψη
  delay(1000);
}
`,
      initialWorld: {}, world: {},
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το κενό ώστε ο for να κάνει τόσους γύρους όσους λέει η παράμετρος.',
        'Τρέξε βήμα-βήμα και κοίτα στις «Μεταβλητές» τις τιμές του times και του i.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι θα τυπώσει η κλήση blink(4); ;',
        options: ['4 φορές «blink»', '1 φορά «blink»', '3 φορές «blink»'],
        answer: 0,
        explain: 'Σωστά. Το times γίνεται 4, οπότε ο for κάνει 4 γύρους (i = 0, 1, 2, 3) και τυπώνει σε κάθε γύρο.',
        retry: 'Όχι ακόμα. Ποια τιμή παίρνει το times όταν γράφεις blink(4); Πόσους γύρους κάνει τότε ο for;'
      },
      hints: [
        'Ο αριθμός των γύρων δεν πρέπει να είναι σταθερός. Πρέπει να έρχεται από την παράμετρο.',
        'Η παράμετρος λέγεται times και βρίσκεται στην πρώτη γραμμή: void blink(int times).',
        'Γράψε: for (int i = 0; i < times; i++) {\nΑν γράψεις i < 3, τότε και το blink(2) θα αναβοσβήνει 3 φορές. Με i < times, κάθε κλήση αναβοσβήνει όσες φορές της ζητάς.'
      ],
      validationTests: [
        { name: 'Το blink(3) στο setup() δίνει 3 αναβοσβήματα και μετά «ready»', script: [
          { setup: true },
          { check: 'lines', is: ['blink', 'blink', 'blink', 'ready'], fail: 'Το setup() τύπωσε: {v}. Περίμενα 3 «blink» και μετά «ready».' }
        ] },
        { name: 'Το blink(2) στο loop() δίνει 2 αναβοσβήματα ανά επανάληψη', script: [
          { setup: true }, { loops: 2 },
          { check: 'count', text: 'blink', is: 7, fail: 'Μετά το setup() και 2 επαναλήψεις τυπώθηκε {n} φορές «blink». Περίμενα 3 + 2 + 2 = 7. Η συνάρτηση χρησιμοποιεί την παράμετρο times;' }
        ] },
        { name: 'Το LED μένει σβηστό στο τέλος κάθε αναβοσβήματος', script: [
          { setup: true }, { loops: 1 }, { check: 'led', is: false, fail: 'Μετά το αναβόσβημα το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η ίδια συνάρτηση blink έκανε 3 αναβοσβήματα στο setup() και 2 στο loop(). Αυτό είναι το κέρδος των παραμέτρων: γράφεις τον κώδικα μία φορά και τον ξαναχρησιμοποιείς.',
      remediation: 'Αν κάθε κλήση αναβοσβήνει τις ίδιες φορές, μάλλον έγραψες αριθμό αντί για times.'
    },

    // ------------------------------------------------------------ c4-l3
    {
      id: 'c4-l3', chapter: 4, kind: 'guided', skills: ['timing', 'io'],
      title: 'Ρολόι χωρίς αναμονή: millis()',
      prerequisites: ['c4-l2'],
      objectives: ['Να εξηγώ γιατί το delay μπλοκάρει το πρόγραμμα.', 'Να γράφω περιοδική ενέργεια με millis().', 'Να κρατώ το κουμπί αποκρίσιμο.'],
      theory: `
<p>Το <code>delay(1000);</code> <strong>σταματά</strong> όλο το πρόγραμμα για 1 δευτερόλεπτο. Όσο περιμένει, <strong>δεν κοιτάζει το κουμπί</strong>. Αυτό λέγεται <strong>μπλοκάρισμα</strong>.</p>
<p>Η λύση: αντί να περιμένουμε, <strong>κοιτάμε το ρολόι</strong>.</p>
<ul>
  <li><code>millis()</code> δίνει πόσα ms πέρασαν από την εκκίνηση.</li>
  <li><code>lastTick</code> θυμάται <strong>πότε</strong> έγινε το τελευταίο tick.</li>
  <li><code>millis() - lastTick</code> = πόσος χρόνος πέρασε από τότε.</li>
</ul>
<pre>if (millis() - lastTick &gt;= INTERVAL) {
  lastTick = millis();   // σημείωσε την ώρα
  … κάνε κάτι …
}</pre>
<p>Το loop() τρέχει πολύ γρήγορα. Τις περισσότερες φορές η συνθήκη είναι false και απλώς συνεχίζει. Έτσι το κουμπί ελέγχεται συνέχεια.</p>`,
      glossary: ['millis', 'μπλοκάρισμα', 'μη μπλοκαριστικός χρονισμός', 'unsigned long', 'const'],
      supportedSyntax: SYNTAX_CH4,
      initialCode: `unsigned long lastTick = 0;            // πότε έγινε το τελευταίο tick (σε ms)
const unsigned long INTERVAL = 1000;   // κάθε πόσα ms θέλουμε tick

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  // 1. Το LED ακολουθεί το κουμπί, σε ΚΑΘΕ επανάληψη
  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));

  // 2. Το tick γίνεται μόνο όταν περάσει το INTERVAL
  if (millis() - lastTick >= ____) {   // ΣΥΜΠΛΗΡΩΣΕ: πόσος χρόνος;
    lastTick = ____;                   // ΣΥΜΠΛΗΡΩΣΕ: σημείωσε την ώρα τώρα
    Serial.println("tick");
  }

  delay(10);   // μικρή ανάσα: το κουμπί ελέγχεται ~100 φορές το δευτερόλεπτο
}
`,
      solution: `unsigned long lastTick = 0;            // πότε έγινε το τελευταίο tick (σε ms)
const unsigned long INTERVAL = 1000;   // κάθε πόσα ms θέλουμε tick

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  // 1. Το LED ακολουθεί το κουμπί, σε ΚΑΘΕ επανάληψη
  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));

  // 2. Το tick γίνεται μόνο όταν περάσει το INTERVAL
  if (millis() - lastTick >= INTERVAL) {
    lastTick = millis();
    Serial.println("tick");
  }

  delay(10);   // μικρή ανάσα: το κουμπί ελέγχεται ~100 φορές το δευτερόλεπτο
}
`,
      initialWorld: { button: false }, world: { button: false },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τα δύο κενά: πόσος χρόνος πρέπει να περάσει, και ποια ώρα σημειώνουμε.',
        'Πάτησε «Εκτέλεση». Πάτα και άφηνε γρήγορα το κουμπί: το LED πρέπει να ακολουθεί αμέσως, ενώ το «tick» έρχεται κάθε δευτερόλεπτο.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ένα loop() έχει delay(1000); στο τέλος. Πατάς το κουμπί αμέσως μετά τον έλεγχό του. Πόσο μπορεί να αργήσει να το «δει» το πρόγραμμα;',
        options: ['Σχεδόν 1 δευτερόλεπτο', 'Καθόλου, το βλέπει αμέσως', 'Ακριβώς 10 ms'],
        answer: 0,
        explain: 'Σωστά. Όσο τρέχει το delay(1000), το πρόγραμμα δεν κοιτάζει το κουμπί. Με millis() και μικρό delay(10), το κουμπί ελέγχεται περίπου 100 φορές το δευτερόλεπτο.',
        retry: 'Όχι ακόμα. Τι κάνει το πρόγραμμα όσο τρέχει το delay(1000); Μπορεί να διαβάσει το κουμπί;'
      },
      hints: [
        'Η συνθήκη ρωτά: «πέρασε τουλάχιστον INTERVAL ms από το τελευταίο tick;». Μετά σημειώνουμε την τωρινή ώρα.',
        'Πρώτο κενό: η σταθερά με το διάστημα (INTERVAL). Δεύτερο κενό: η εντολή που δίνει την ώρα τώρα.',
        'if (millis() - lastTick >= INTERVAL) {\n  lastTick = millis();\n  Serial.println("tick");\n}\nΑν ξεχάσεις το lastTick = millis();, μετά το πρώτο δευτερόλεπτο η συνθήκη θα ισχύει πάντα και θα τυπώνει σε κάθε επανάληψη.'
      ],
      validationTests: [PERIODIC_TEST, RESPONSIVE_TEST],
      explanationOnSuccess: 'Το πρόγραμμα κάνει δύο πράγματα «ταυτόχρονα»: ελέγχει το κουμπί συνέχεια και τυπώνει tick κάθε δευτερόλεπτο. Στην πραγματικότητα δεν περιμένει ποτέ. Απλώς κοιτάζει το ρολόι σε κάθε επανάληψη.',
      remediation: 'Αν τα «tick» είναι πάρα πολλά, έλεγξε ότι το lastTick = millis(); είναι μέσα στο if. Αν δεν έρχεται κανένα, έλεγξε το >= στη συνθήκη.'
    },

    // ------------------------------------------------------------ c4-l4
    {
      id: 'c4-l4', chapter: 4, kind: 'variant', skills: ['timing', 'state'],
      title: 'Παλμός ζωής και κουμπί μαζί',
      prerequisites: ['c4-l3'],
      objectives: ['Να μετατρέπω μπλοκαριστικό κώδικα σε κώδικα με millis().', 'Να οργανώνω το loop() σε μικρές συναρτήσεις.'],
      theory: `
<p>Πολλές συσκευές έχουν ένα LED που αναβοσβήνει συνέχεια. Λέγεται <strong>παλμός ζωής</strong> (heartbeat): δείχνει ότι το πρόγραμμα τρέχει.</p>
<p>Εδώ το loop() είναι χωρισμένο σε δύο συναρτήσεις:</p>
<ul>
  <li><code>heartbeat()</code>: αλλάζει το LED κάθε 500 ms.</li>
  <li><code>checkButton()</code>: τυπώνει «Button pressed» τη στιγμή που πατιέται το κουμπί.</li>
</ul>
<p>Το πρόβλημα: η heartbeat() χρησιμοποιεί <code>delay(500)</code> δύο φορές. Έτσι κάθε επανάληψη κρατά 1 δευτερόλεπτο και το LED δεν αλλάζει τη σωστή στιγμή.</p>
<p>Ξαναγράψε την heartbeat() με το μοτίβο του millis(). Για να αλλάξεις το LED, χρησιμοποίησε τη μεταβλητή <code>ledOn</code>: <code>ledOn = !ledOn;</code> (το <code>!</code> αντιστρέφει true ↔ false).</p>`,
      glossary: ['millis', 'μη μπλοκαριστικός χρονισμός', 'συνάρτηση', '! (όχι)'],
      supportedSyntax: SYNTAX_CH4,
      initialCode: `bool ledOn = false;               // είναι αναμμένο το LED τώρα;
unsigned long lastBlink = 0;      // πότε άλλαξε τελευταία φορά το LED
const unsigned long BLINK_EVERY = 500;
int lastButton = LOW;

void heartbeat() {
  // ΑΛΛΑΞΕ: αυτή η εκδοχή μπλοκάρει όλο το πρόγραμμα για 1 δευτερόλεπτο
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}

void checkButton() {
  int b = digitalRead(BUTTON_PIN);
  if (b == HIGH && lastButton == LOW) {
    Serial.println("Button pressed");
  }
  lastButton = b;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  heartbeat();
  checkButton();
  delay(10);
}
`,
      solution: `bool ledOn = false;               // είναι αναμμένο το LED τώρα;
unsigned long lastBlink = 0;      // πότε άλλαξε τελευταία φορά το LED
const unsigned long BLINK_EVERY = 500;
int lastButton = LOW;

void heartbeat() {
  if (millis() - lastBlink >= BLINK_EVERY) {
    lastBlink = millis();
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn);
  }
}

void checkButton() {
  int b = digitalRead(BUTTON_PIN);
  if (b == HIGH && lastButton == LOW) {
    Serial.println("Button pressed");
  }
  lastButton = b;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  heartbeat();
  checkButton();
  delay(10);
}
`,
      initialWorld: { button: false }, world: { button: false },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Ξαναγράψε μόνο την heartbeat(): χωρίς delay, με millis(), lastBlink και ledOn.',
        'Τρέξε. Το LED πρέπει να αλλάζει κάθε μισό δευτερόλεπτο και κάθε πάτημα να τυπώνει αμέσως «Button pressed».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Στον αρχικό κώδικα, πόσο κρατά μία επανάληψη του loop();',
        options: ['Περίπου 1 δευτερόλεπτο', 'Περίπου 10 ms', 'Περίπου 500 ms'],
        answer: 0,
        explain: 'Σωστά. delay(500) + delay(500) + delay(10) ≈ 1 δευτερόλεπτο. Όλο αυτό τον χρόνο το κουμπί δεν ελέγχεται.',
        retry: 'Όχι ακόμα. Πρόσθεσε όλα τα delay που εκτελούνται σε μία επανάληψη, μαζί και αυτά μέσα στην heartbeat().'
      },
      hints: [
        'Το μοτίβο είναι ίδιο με το «tick» του προηγούμενου μαθήματος. Μόνο που αντί να τυπώνεις, αλλάζεις το LED.',
        'Μέσα στην heartbeat() χρειάζεσαι ένα if με millis() - lastBlink >= BLINK_EVERY. Μέσα στο if: ενημέρωσε το lastBlink, αντέστρεψε το ledOn και γράψε το στο LED.',
        'void heartbeat() {\n  if (millis() - lastBlink >= BLINK_EVERY) {\n    lastBlink = millis();\n    ledOn = !ledOn;\n    digitalWrite(LED_PIN, ledOn);\n  }\n}'
      ],
      validationTests: [
        { name: 'Το LED αλλάζει κάθε 500 ms (αναμμένο στα 0,6 s, σβηστό στα 1,1 s, αναμμένο στα 1,6 s)', world: { button: false }, script: [
          { setup: true },
          { ms: 600 }, { check: 'led', is: true, fail: 'Στα 0,6 δευτερόλεπτα το LED είναι {v}. Περίμενα αναμμένο (πρώτη αλλαγή στα 500 ms). Μήπως η heartbeat() ακόμα περιμένει με delay;' },
          { ms: 500 }, { check: 'led', is: false, fail: 'Στα 1,1 δευτερόλεπτα το LED είναι {v}. Περίμενα σβηστό (δεύτερη αλλαγή στα 1000 ms).' },
          { ms: 500 }, { check: 'led', is: true, fail: 'Στα 1,6 δευτερόλεπτα το LED είναι {v}. Περίμενα αναμμένο.' }
        ] },
        { name: 'Κάθε πάτημα δίνει ένα «Button pressed»', world: { button: false }, script: [
          { setup: true },
          { set: { button: true } }, { ms: 50 }, { set: { button: false } }, { ms: 50 },
          { set: { button: true } }, { ms: 50 }, { set: { button: false } }, { ms: 50 },
          { set: { button: true } }, { ms: 50 }, { set: { button: false } }, { ms: 50 },
          { check: 'count', text: 'Button pressed', is: 3, fail: 'Σε 3 πατήματα τυπώθηκε {n} φορές «Button pressed». Μην αλλάξεις την checkButton().' }
        ] },
        { name: 'Χωρίς πάτημα, κανένα μήνυμα', world: { button: false }, script: [
          { setup: true }, { ms: 1500 }, { check: 'total', is: 0, fail: 'Χωρίς πάτημα τυπώθηκαν {n} γραμμές.' }
        ] }
      ],
      explanationOnSuccess: 'Τώρα κάθε επανάληψη κρατά περίπου 10 ms. Η heartbeat() και η checkButton() «μοιράζονται» τον χρόνο: η καθεμία κάνει τη δουλειά της μόνο όταν χρειάζεται και επιστρέφει αμέσως.',
      remediation: 'Αν το LED μένει πάντα αναμμένο ή πάντα σβηστό, έλεγξε ότι γράφεις ledOn = !ledOn; μέσα στο if και μετά digitalWrite(LED_PIN, ledOn);'
    },

    // ------------------------------------------------------------ c4-l5
    {
      id: 'c4-l5', chapter: 4, kind: 'checkpoint', skills: ['timing', 'variables', 'syntax'],
      title: 'Βρες το λάθος: το tick που δεν σταματά',
      prerequisites: ['c4-l4'],
      objectives: ['Να εντοπίζω μεταβλητή που ξεχνά την τιμή της.', 'Να ελέγχω ότι ο χρονισμός με millis() δουλεύει και ότι το κουμπί μένει αποκρίσιμο.'],
      theory: `
<p>Αυτός ο κώδικας χρησιμοποιεί millis(), όπως έμαθες. Το κουμπί δουλεύει. Όμως μετά το πρώτο δευτερόλεπτο το «tick» τυπώνεται <strong>σε κάθε επανάληψη</strong>.</p>
<p>Θυμήσου από το Κεφάλαιο 2:</p>
<ul>
  <li>Μια μεταβλητή δηλωμένη <strong>έξω</strong> από τις συναρτήσεις θυμάται την τιμή της.</li>
  <li>Μια μεταβλητή δηλωμένη <strong>μέσα</strong> στο loop() ξαναγεννιέται σε κάθε επανάληψη, με την αρχική της τιμή.</li>
</ul>
<p>Τρέξε βήμα-βήμα και κοίτα στις «Μεταβλητές» την τιμή του <code>lastTick</code> στην αρχή κάθε επανάληψης.</p>`,
      glossary: ['millis', 'μεταβλητή', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX_CH4,
      initialCode: `const unsigned long INTERVAL = 1000;

void showTick() {
  Serial.println("tick");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  unsigned long lastTick = 0;

  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));

  if (millis() - lastTick >= INTERVAL) {
    lastTick = millis();
    showTick();
  }

  delay(10);
}
`,
      solution: `const unsigned long INTERVAL = 1000;
unsigned long lastTick = 0;

void showTick() {
  Serial.println("tick");
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  digitalWrite(LED_PIN, digitalRead(BUTTON_PIN));

  if (millis() - lastTick >= INTERVAL) {
    lastTick = millis();
    showTick();
  }

  delay(10);
}
`,
      initialWorld: { button: false }, world: { button: false },
      hardware: HW, panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα για 3 δευτερόλεπτα. Τι περίμενες στο Serial Monitor; Τι βλέπεις;',
        'Τρέξε βήμα-βήμα. Κοίτα τι τιμή έχει το lastTick στην αρχή κάθε επανάληψης.',
        'Διόρθωσε το λάθος και πάτησε «Έλεγχος λύσης». Ο έλεγχος δοκιμάζει και τον χρόνο και το κουμπί.'
      ],
      quiz: {
        question: 'Γιατί το «tick» τυπώνεται σε κάθε επανάληψη μετά το πρώτο δευτερόλεπτο;',
        options: ['Το lastTick δηλώνεται μέσα στο loop(), άρα γίνεται 0 σε κάθε επανάληψη', 'Το INTERVAL είναι πολύ μικρό', 'Η showTick() καλείται δύο φορές'],
        answer: 0,
        explain: 'Σωστά. Το lastTick = millis(); γίνεται, αλλά στην επόμενη επανάληψη η γραμμή unsigned long lastTick = 0; το μηδενίζει ξανά. Έτσι το millis() - 0 είναι πάντα πάνω από 1000.',
        retry: 'Όχι ακόμα. Δες στις «Μεταβλητές» την τιμή του lastTick στην αρχή της επόμενης επανάληψης.'
      },
      hints: [
        'Η μνήμη του χρόνου πρέπει να επιβιώνει από τη μία επανάληψη στην άλλη.',
        'Κοίτα την πρώτη γραμμή μέσα στο loop(). Πού δηλώνεται το lastTick;',
        'Μετακίνησε τη γραμμή unsigned long lastTick = 0; έξω από το loop(), π.χ. κάτω από το const unsigned long INTERVAL = 1000;\nΜέσα στο loop() να μη μείνει καμία δήλωση του lastTick.'
      ],
      validationTests: [
        {
          name: 'Ένα «tick» περίπου κάθε δευτερόλεπτο (3,1 δευτερόλεπτα → 3 ή 4)',
          world: { button: false },
          script: [
            { setup: true }, { ms: 2000 }, { ms: 1100 },
            { check: 'count', text: 'tick', min: 3, max: 4,
              fail: 'Σε 3,1 δευτερόλεπτα τυπώθηκαν {n} «tick». Περίμενα 3 ή 4. Το lastTick θυμάται την τιμή του από επανάληψη σε επανάληψη;',
              failZero: 'Δεν τυπώθηκε κανένα «tick». Η showTick() καλείται μέσα στο if;' }
          ]
        },
        RESPONSIVE_TEST
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το Κεφάλαιο 4. Ξέρεις να φτιάχνεις συναρτήσεις με παραμέτρους, να επαναλαμβάνεις με for και, κυρίως, να κάνεις περιοδικές ενέργειες με millis() χωρίς να «παγώνει» το κουμπί.',
      remediation: 'Αν τα «tick» είναι ακόμα πάρα πολλά, έλεγξε ότι δεν άφησες δεύτερη δήλωση του lastTick μέσα στο loop().'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
