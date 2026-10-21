/*
 * IoT Guardian — MicroPython στο ESP32, κεφάλαιο 30 (1ο του κλάδου): Πρώτα βήματα στη MicroPython.
 * print, μεταβλητές, machine.Pin, led.on()/off(), time.sleep / sleep_ms, αναβόσβημα.
 * Ο κώδικας τρέχει στην εικονική πλακέτα ESP32 (board: 'esp32'), με τα modules της MicroPython.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 30, title: 'Πρώτα βήματα στη MicroPython', ready: true, track: 'py-esp32', lang: 'python', board: 'esp32', unlockAfter: 17 });
  if (!L.SKILLS.micropython) L.SKILLS.micropython = 'MicroPython';

  [
    { term: 'MicroPython', def: 'Μια μικρή Python για μικροελεγκτές, όπως το ESP32. Γράφεις Python και τρέχει πάνω στην πλακέτα, χωρίς υπολογιστή δίπλα της.' },
    { term: 'firmware MicroPython', def: 'Το «λειτουργικό» που γράφεις μία φορά στη μνήμη του ESP32. Μετά η πλακέτα καταλαβαίνει Python. Το κατεβάζεις από το micropython.org.' },
    { term: 'REPL', def: 'Η «γραμμή εντολών» της MicroPython (Read–Eval–Print Loop). Γράφεις μία εντολή, π.χ. 1 + 1, και η πλακέτα απαντά αμέσως. Φαίνεται με το σύμβολο >>>.' },
    { term: 'Thonny / mpremote', def: 'Δύο εργαλεία για να μιλάς με το ESP32 μέσω USB. Το Thonny είναι πρόγραμμα με παράθυρα. Το mpremote δουλεύει στο τερματικό, π.χ. mpremote cp main.py :main.py' },
    { term: 'boot.py / main.py', def: 'Δύο αρχεία στη μνήμη του ESP32. Σε κάθε εκκίνηση τρέχει πρώτα το boot.py και μετά το main.py. Το πρόγραμμά σου το αποθηκεύεις ως main.py.' },
    { term: 'machine.Pin', def: 'Η «κλάση» της MicroPython για ένα GPIO. Pin(2, Pin.OUT) = το GPIO 2 ως έξοδος. Pin(15, Pin.IN) = το GPIO 15 ως είσοδος.' },
    { term: 'Pin.OUT / Pin.IN', def: 'Η κατεύθυνση ενός pin. Pin.OUT: η πλακέτα δίνει ρεύμα (LED, φανάρι). Pin.IN: η πλακέτα διαβάζει (κουμπί, PIR).' },
    { term: 'time.sleep_ms', def: 'Αναμονή σε χιλιοστά του δευτερολέπτου (ms) στη MicroPython. time.sleep_ms(500) = μισό δευτερόλεπτο. Το time.sleep(1) περιμένει 1 δευτερόλεπτο.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const BASE = { lang: 'python', board: 'esp32', chapter: 30 };
  const SYNTAX = 'print, μεταβλητές (str, int, float), from machine import Pin, Pin(2, Pin.OUT), led.on(), led.off(), led.value(), import time, time.sleep(s), time.sleep_ms(ms), while True:';
  const PANELS = ['serial', 'vars', 'loops'];
  const HW = ['led'];

  // ------------------------------------------------------------ 30.1
  const L1_CODE = (who, ver) => `# Το πρώτο μου πρόγραμμα MicroPython.
# Το print γράφει στο τερματικό (μέσω USB).
board = "ESP32"
version = 1.22

print("Hello", ${who})        # τύπωσε το όνομα της πλακέτας
print("MicroPython", ${ver})  # τύπωσε την έκδοση
`;

  // ------------------------------------------------------------ 30.2
  const L2_CODE = (mode, action) => `# Ανάβω το LED της πλακέτας (GPIO 2).
from machine import Pin

led = Pin(2, ${mode})     # το GPIO 2 ως έξοδος
led.${action}()           # άναψε το LED
print("LED on")
`;

  // ------------------------------------------------------------ 30.3
  const L3_HEAD = `# Αναβόσβημα: 500 ms αναμμένο, 500 ms σβηστό.
from machine import Pin
import time

led = Pin(2, Pin.OUT)

while True:
    led.on()
    print("ON")
    time.sleep_ms(500)
`;
  const L3_INITIAL = L3_HEAD + `    # ΣΥΜΠΛΗΡΩΣΕ: σβήσε το LED, τύπωσε "OFF" και περίμενε 500 ms
`;
  const L3_SOLUTION = L3_HEAD + `    led.off()
    print("OFF")
    time.sleep_ms(500)
`;

  // ------------------------------------------------------------ 30.4
  const L4_INITIAL = `# Παράπονο: «Το LED δεν ανάβει ποτέ.
# Και το τερματικό γράφει ON μόνο μία φορά.»
from machine import Pin
import time

led = Pin(2, Pin.IN)

while True:
    led.on()
    print("ON")
    time.sleep(500)
    led.off()
    print("OFF")
    time.sleep(500)
`;
  const L4_SOLUTION = `# Διορθωμένο: LED ως έξοδος, αναμονή σε ms.
from machine import Pin
import time

led = Pin(2, Pin.OUT)

while True:
    led.on()
    print("ON")
    time.sleep_ms(500)
    led.off()
    print("OFF")
    time.sleep_ms(500)
`;

  // ------------------------------------------------------------ 30.5
  const L5_INITIAL = `# Χτύπος καρδιάς: η πλακέτα δείχνει ότι «ζει».
# 1. Τύπωσε "Boot" μία φορά, στην αρχή.
# 2. Μέσα στο while True:
#    - μέτρα τους χτύπους με μια μεταβλητή beats
#    - άναψε το LED για ON_MS, σβήσ' το για OFF_MS
#    - τύπωσε f"Beat {beats}"
from machine import Pin
import time

ON_MS = 100
OFF_MS = 900

led = Pin(2, Pin.OUT)

while True:
    time.sleep_ms(1000)
`;
  const L5_SOLUTION = `# Χτύπος καρδιάς: η πλακέτα δείχνει ότι «ζει».
from machine import Pin
import time

ON_MS = 100
OFF_MS = 900

led = Pin(2, Pin.OUT)
beats = 0
print("Boot")

while True:
    beats = beats + 1
    led.on()
    time.sleep_ms(ON_MS)
    led.off()
    print(f"Beat {beats}")
    time.sleep_ms(OFF_MS)
`;

  L.lessons.push(
    Object.assign({}, BASE, {
      id: 'c30-l1', kind: 'micro', skills: ['micropython', 'variables', 'order'],
      title: 'Hello ESP32: η πρώτη γραμμή MicroPython',
      prerequisites: [],
      objectives: ['Να ξέρω τι είναι η MicroPython.', 'Να τυπώνω κείμενο και μεταβλητές με print.', 'Να ξέρω πώς φτάνει το πρόγραμμα στην πλακέτα (main.py).'],
      theory: `
<p>Η <strong>MicroPython</strong> είναι Python για μικροελεγκτές. Τρέχει <strong>πάνω στο ESP32</strong>.</p>
<p>Πώς ξεκινάς σε αληθινή πλακέτα:</p>
<ol>
  <li>Γράφεις μία φορά το <strong>firmware MicroPython</strong> στο ESP32 (π.χ. με το Thonny).</li>
  <li>Συνδέεις την πλακέτα με USB. Στο <strong>REPL</strong> (<code>&gt;&gt;&gt;</code>) δοκιμάζεις εντολές μία μία.</li>
  <li>Αποθηκεύεις το πρόγραμμα ως <code>main.py</code> στην πλακέτα. Με το mpremote: <code>mpremote cp main.py :main.py</code></li>
  <li>Σε κάθε εκκίνηση τρέχει πρώτα το <code>boot.py</code> και μετά το <code>main.py</code>.</li>
</ol>
<p>Το <code>print</code> γράφει στο τερματικό, μέσω USB. Εδώ φαίνεται στο πάνελ «Τερματικό».</p>
<pre>board = "ESP32"
print("Hello", board)    # → Hello ESP32</pre>
<p>Το <code>print</code> βάζει ένα κενό ανάμεσα στα κομμάτια.</p>`,
      glossary: ['MicroPython', 'firmware MicroPython', 'REPL', 'Thonny / mpremote', 'boot.py / main.py', 'print'],
      supportedSyntax: 'print, μεταβλητές (str, int, float), σχόλια #',
      initialCode: L1_CODE('____', 'version'),
      solution: L1_CODE('board', 'version'),
      world: {}, initialWorld: {},
      hardware: HW, panels: ['serial', 'vars'],
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το κενό με το όνομα της μεταβλητής που κρατά «ESP32».',
        'Πάτησε «Εκτέλεση» και δες το Τερματικό.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Μετά από restart του ESP32, ποιο αρχείο τρέχει το πρόγραμμά σου μόνο του;',
        options: ['Το main.py, μετά το boot.py', 'Κανένα: πρέπει να το ξεκινάς από τον υπολογιστή', 'Μόνο ό,τι γράψεις στο REPL'],
        answer: 0,
        explain: 'Σωστά. Το boot.py τρέχει πρώτο και μετά το main.py. Γι’ αυτό το πρόγραμμά σου το αποθηκεύεις ως main.py.',
        retry: 'Όχι ακόμα. Το REPL είναι για δοκιμές. Ποιο αρχείο τρέχει μόνο του σε κάθε εκκίνηση;'
      },
      hints: [
        'Μια μεταβλητή είναι ένα «κουτί» με όνομα. Το print δείχνει τι έχει μέσα.',
        'Η μεταβλητή με το κείμενο "ESP32" λέγεται board. Γράψε το όνομά της χωρίς εισαγωγικά.',
        'print("Hello", board)\n• "Hello" = σταθερό κείμενο\n• board = η μεταβλητή → ESP32'
      ],
      validationTests: [
        { name: 'Τυπώνει «Hello ESP32» και την έκδοση', script: [
          { setup: true },
          { check: 'lines', is: ['Hello ESP32', 'MicroPython 1.22'], fail: 'Το Τερματικό έγραψε: {v}. Περίμενα «Hello ESP32» και «MicroPython 1.22».' }
        ] }
      ],
      explanationOnSuccess: 'Η πρώτη σου γραμμή MicroPython! Το ίδιο πρόγραμμα, ως main.py, θα έγραφε το ίδιο σε αληθινό ESP32, στο Thonny ή στο mpremote.',
      remediation: 'Αν δεις «NameError», έγραψες όνομα που δεν υπάρχει. Αν δεις «Hello board», έβαλες εισαγωγικά γύρω από το όνομα της μεταβλητής.'
    }),

    Object.assign({}, BASE, {
      id: 'c30-l2', kind: 'guided', skills: ['micropython', 'io'],
      title: 'Ανάβω το LED με machine.Pin',
      prerequisites: ['c30-l1'],
      objectives: ['Να φορτώνω το Pin από το module machine.', 'Να ρυθμίζω ένα GPIO ως έξοδο.', 'Να ανάβω και να σβήνω ένα LED με on() και off().'],
      theory: `
<p>Στη MicroPython τα pins ελέγχονται με το <code>machine.Pin</code>.</p>
<pre>from machine import Pin
led = Pin(2, Pin.OUT)   # GPIO 2, ως έξοδος</pre>
<ul>
  <li>Ο <strong>πρώτος</strong> αριθμός είναι το GPIO. Στην πλακέτα μας το LED είναι στο <strong>GPIO 2</strong>.</li>
  <li>Το <code>Pin.OUT</code> λέει: «η πλακέτα δίνει ρεύμα από εδώ».</li>
</ul>
<p>Μετά:</p>
<ul>
  <li><code>led.on()</code> → ανάβει (τιμή 1)</li>
  <li><code>led.off()</code> → σβήνει (τιμή 0)</li>
  <li><code>led.value(1)</code> ή <code>led.value(0)</code> κάνουν το ίδιο.</li>
</ul>
<p>Στο Raspberry Pi γράφαμε <code>gpiozero</code>. Στο ESP32 <strong>δεν</strong> υπάρχει: εδώ είναι το <code>machine</code>.</p>`,
      glossary: ['machine.Pin', 'Pin.OUT / Pin.IN', 'GPIO', 'import'],
      supportedSyntax: SYNTAX,
      initialCode: L2_CODE('____', '____'),
      solution: L2_CODE('Pin.OUT', 'on'),
      world: {}, initialWorld: {},
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το πρώτο κενό: το GPIO 2 πρέπει να είναι έξοδος.',
        'Συμπλήρωσε το δεύτερο κενό: η μέθοδος που ανάβει το LED.',
        'Τρέξε. Ανάβει το LED στη σκηνή;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι κάνει η γραμμή led = Pin(2, Pin.OUT);',
        options: ['Ρυθμίζει το GPIO 2 ως έξοδο. Το LED μένει σβηστό μέχρι το led.on()', 'Ανάβει αμέσως το LED', 'Διαβάζει το κουμπί στο GPIO 2'],
        answer: 0,
        explain: 'Σωστά. Το Pin(…) μόνο ετοιμάζει το pin. Το LED ανάβει με led.on().',
        retry: 'Όχι ακόμα. Σκέψου: ποια γραμμή λέει «άναψε»;'
      },
      hints: [
        'Ένα pin που δίνει ρεύμα σε LED είναι έξοδος.',
        'Η σταθερά για έξοδο είναι πεδίο του Pin: Pin.OUT. Η μέθοδος που ανάβει είναι η on.',
        'led = Pin(2, Pin.OUT)\nled.on()\n• Pin.OUT = έξοδος\n• on() = τιμή 1, το LED ανάβει'
      ],
      validationTests: [
        { name: 'Το GPIO 2 είναι έξοδος', script: [{ setup: true }, { check: 'ledOutput', fail: 'Το GPIO 2 είναι: {v}. Γράψε led = Pin(2, Pin.OUT).' }] },
        { name: 'Το LED ανάβει', script: [{ setup: true }, { check: 'led', is: true, fail: 'Το LED είναι {v}. Μετά το Pin(…) γράψε led.on().' }] },
        { name: 'Τυπώνει «LED on»', script: [{ setup: true }, { check: 'serialHas', text: 'LED on', fail: 'Το Τερματικό δεν έγραψε «LED on». Μην σβήσεις το print.' }] }
      ],
      explanationOnSuccess: 'Το LED ανάβει! Το Pin(2, Pin.OUT) είναι το ίδιο με το pinMode(LED_PIN, OUTPUT) της C++, και το led.on() με το digitalWrite(LED_PIN, HIGH).',
      remediation: 'Αν το LED μένει σβηστό, έλεγξε ότι γράφεις Pin.OUT (με κεφαλαία) και led.on() με παρενθέσεις.'
    }),

    Object.assign({}, BASE, {
      id: 'c30-l3', kind: 'variant', skills: ['micropython', 'io', 'timing'],
      title: 'Αναβόσβημα με while True και sleep_ms',
      prerequisites: ['c30-l2'],
      objectives: ['Να γράφω τον κύριο βρόχο while True.', 'Να περιμένω με time.sleep_ms.', 'Να φτιάχνω αναβόσβημα με σταθερό ρυθμό.'],
      theory: `
<p>Η MicroPython <strong>δεν</strong> έχει <code>setup()</code> και <code>loop()</code>.</p>
<ul>
  <li>Ό,τι είναι <strong>πριν</strong> από το <code>while True:</code> τρέχει μία φορά (σαν το setup).</li>
  <li>Ό,τι είναι <strong>μέσα</strong> στο <code>while True:</code> επαναλαμβάνεται για πάντα (σαν το loop).</li>
</ul>
<p>Οι εντολές μέσα στο βρόχο έχουν <strong>εσοχή</strong> (4 κενά).</p>
<p>Αναμονή:</p>
<ul>
  <li><code>time.sleep(1)</code> → 1 δευτερόλεπτο</li>
  <li><code>time.sleep_ms(500)</code> → 500 ms (μόνο στη MicroPython)</li>
  <li><code>time.sleep_us(10)</code> → 10 µs</li>
</ul>
<p>Χωρίς αναμονή το LED αλλάζει τόσο γρήγορα που δεν το βλέπεις.</p>`,
      glossary: ['while True', 'time.sleep_ms', 'εσοχή'],
      supportedSyntax: SYNTAX,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: {}, initialWorld: {},
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε τον αρχικό κώδικα. Το LED σβήνει ποτέ;',
        'Πρόσθεσε τρεις γραμμές με εσοχή: led.off(), print("OFF"), time.sleep_ms(500).',
        'Τρέξε ξανά και δες τον πίνακα «Επαναλήψεις».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Μια επανάληψη έχει δύο αναμονές των 500 ms. Πόσες φορές αναβοσβήνει το LED σε 5 δευτερόλεπτα;',
        options: ['5 φορές', '10 φορές', '2 φορές'],
        answer: 0,
        explain: 'Σωστά. 500 + 500 = 1000 ms ανά επανάληψη, άρα 5 επαναλήψεις σε 5 δευτερόλεπτα.',
        retry: 'Όχι ακόμα. Πρόσθεσε τις δύο αναμονές για μία επανάληψη και διαίρεσε τα 5000 ms.'
      },
      hints: [
        'Για να αναβοσβήνει, το LED πρέπει να ανάβει ΚΑΙ να σβήνει μέσα στον ίδιο βρόχο.',
        'Μετά το πρώτο time.sleep_ms(500) λείπει το «σβηστό» κομμάτι. Πρόσεξε την εσοχή: 4 κενά.',
        '    led.off()\n    print("OFF")\n    time.sleep_ms(500)\n• Χωρίς την τελευταία αναμονή, το LED θα ξανανάβει αμέσως.'
      ],
      validationTests: [
        { name: 'Σε 3 επαναλήψεις: 3 × ON και 3 × OFF', script: [
          { setup: true }, { loops: 3 },
          { check: 'count', text: 'ON', is: 3, fail: 'Τυπώθηκε {n} φορές «ON». Περίμενα 3.' },
          { check: 'count', text: 'OFF', is: 3, fail: 'Τυπώθηκε {n} φορές «OFF». Περίμενα 3. Πρόσθεσε print("OFF") μετά το led.off().' },
          { check: 'led', is: false, fail: 'Στο τέλος κάθε επανάληψης το LED είναι {v}. Πρέπει να είναι σβηστό.' }
        ] },
        { name: 'Ρυθμός: 1 αναβόσβημα το δευτερόλεπτο', script: [
          { setup: true }, { ms: 3500 },
          { check: 'count', text: 'ON', is: 4, fail: 'Σε 3,5 δευτερόλεπτα το LED άναψε {n} φορές. Περίμενα 4 (κάθε 1000 ms). Μην ξεχάσεις το time.sleep_ms(500) μετά το OFF.' }
        ] },
        { name: 'Στα 700 ms το LED είναι σβηστό', script: [
          { setup: true }, { ms: 700 },
          { check: 'led', is: false, fail: 'Στα 700 ms το LED είναι {v}. Από τα 500 έως τα 1000 ms πρέπει να είναι σβηστό.' }
        ] }
      ],
      explanationOnSuccess: 'Το LED αναβοσβήνει μία φορά το δευτερόλεπτο. Το while True είναι ο κύριος βρόχος της πλακέτας: τρέχει για πάντα, όσο έχει ρεύμα.',
      remediation: 'Αν δεις «IndentationError», οι νέες γραμμές δεν έχουν ίδια εσοχή με τις άλλες μέσα στο while. Χρησιμοποίησε 4 κενά.'
    }),

    Object.assign({}, BASE, {
      id: 'c30-l4', kind: 'debug', skills: ['micropython', 'io', 'timing', 'syntax'],
      title: 'Βρες το λάθος: το LED που δεν ανάβει',
      prerequisites: ['c30-l3'],
      objectives: ['Να διαβάζω τις προειδοποιήσεις της πλακέτας.', 'Να ξεχωρίζω το Pin.IN από το Pin.OUT.', 'Να ξεχωρίζω το sleep (δευτερόλεπτα) από το sleep_ms (ms).'],
      theory: `
<p>Δύο λάθη που κάνουν όλοι στην αρχή:</p>
<ol>
  <li><strong>Λάθος κατεύθυνση.</strong> Ένα LED θέλει <code>Pin.OUT</code>. Με <code>Pin.IN</code> το pin «ακούει» και δεν δίνει ρεύμα. Το LED μένει σβηστό, <strong>χωρίς</strong> μήνυμα λάθους.</li>
  <li><strong>Λάθος μονάδα χρόνου.</strong> Το <code>time.sleep(500)</code> περιμένει <strong>500 δευτερόλεπτα</strong>, πάνω από 8 λεπτά! Για ms γράφεις <code>time.sleep_ms(500)</code> ή <code>time.sleep(0.5)</code>.</li>
</ol>
<p>Μέθοδος:</p>
<ul>
  <li>Διάβασε τις <strong>προειδοποιήσεις</strong> κάτω από τον κώδικα.</li>
  <li>Κοίτα τον <strong>εικονικό χρόνο</strong>: προχωρά πολύ πιο γρήγορα απ’ ό,τι περιμένεις;</li>
</ul>`,
      glossary: ['Pin.OUT / Pin.IN', 'time.sleep_ms', 'προειδοποίηση', 'μονάδα μέτρησης'],
      supportedSyntax: SYNTAX,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: {}, initialWorld: {},
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε. Διάβασε την προειδοποίηση για το LED.',
        'Κοίτα τον εικονικό χρόνο μετά το πρώτο «ON». Πόσο περιμένει η πλακέτα;',
        'Διόρθωσε τα δύο λάθη. Το αναβόσβημα πρέπει να είναι 500 ms / 500 ms.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Στη MicroPython, πόσο περιμένει το time.sleep(500);',
        options: ['500 δευτερόλεπτα', '500 ms', '500 µs'],
        answer: 0,
        explain: 'Σωστά. Το time.sleep μετρά σε δευτερόλεπτα. Για ms υπάρχει το time.sleep_ms.',
        retry: 'Όχι ακόμα. Το time.sleep έχει την ίδια μονάδα με το time.sleep της Python στο Raspberry Pi.'
      },
      hints: [
        'Υπάρχουν δύο λάθη: ένα στη γραμμή του Pin και ένα στις αναμονές.',
        'Το LED δίνει φως, άρα το pin πρέπει να δίνει ρεύμα. Και το 500 στο sleep είναι δευτερόλεπτα.',
        'led = Pin(2, Pin.OUT)\n…\ntime.sleep_ms(500)\n• Pin.OUT = έξοδος\n• sleep_ms = χιλιοστά του δευτερολέπτου'
      ],
      validationTests: [
        { name: 'Το LED είναι έξοδος', script: [{ setup: true }, { loops: 1 }, { check: 'ledOutput', fail: 'Το GPIO 2 είναι: {v}. Ένα LED χρειάζεται Pin.OUT.' }] },
        { name: 'Το LED ανάβει στα 200 ms', script: [{ setup: true }, { ms: 200 }, { check: 'led', is: true, fail: 'Στα 200 ms το LED είναι {v}. Μόλις ξεκινά ο βρόχος πρέπει να ανάβει.' }] },
        { name: 'Ρυθμός 500 ms / 500 ms', script: [
          { setup: true }, { ms: 3500 },
          { check: 'count', text: 'ON', is: 4, fail: 'Σε 3,5 δευτερόλεπτα τυπώθηκε {n} φορές «ON». Περίμενα 4. Οι αναμονές μετρούν σε δευτερόλεπτα ή σε ms;' }
        ] }
      ],
      explanationOnSuccess: 'Βρήκες και τα δύο λάθη! Το Pin.IN για LED δεν βγάζει μήνυμα λάθους σε αληθινή πλακέτα: απλώς δεν ανάβει. Γι’ αυτό αξίζει να ελέγχεις πρώτα την κατεύθυνση του pin.',
      remediation: 'Αν το «ON» τυπώνεται μόνο μία φορά, η πλακέτα περιμένει ακόμα στο time.sleep(500). Άλλαξέ το σε time.sleep_ms(500).'
    }),

    Object.assign({}, BASE, {
      id: 'c30-l5', kind: 'checkpoint', skills: ['micropython', 'io', 'timing', 'variables'],
      title: 'Έλεγχος κεφαλαίου: χτύπος καρδιάς',
      prerequisites: ['c30-l4'],
      objectives: ['Να συνδυάζω print, μεταβλητές, Pin και sleep_ms.', 'Να μετρώ επαναλήψεις με μια μεταβλητή.', 'Να χωρίζω τι τρέχει μία φορά και τι επαναλαμβάνεται.'],
      theory: `
<p>Πολλές συσκευές IoT έχουν ένα <strong>LED «ζωής»</strong>. Ένας σύντομος χτύπος κάθε δευτερόλεπτο σημαίνει «δουλεύω κανονικά».</p>
<p>Τι θέλουμε:</p>
<ol>
  <li>Στην αρχή, <strong>μία φορά</strong>: <code>print("Boot")</code>.</li>
  <li>Σε κάθε επανάληψη: <code>beats</code> + 1, LED αναμμένο για <code>ON_MS</code> (100 ms), σβηστό για <code>OFF_MS</code> (900 ms).</li>
  <li>Μετά το σβήσιμο: <code>print(f"Beat {beats}")</code>.</li>
</ol>
<p>Θυμήσου: το <code>beats = 0</code> μπαίνει <strong>πριν</strong> από το <code>while True:</code>. Αλλιώς μηδενίζεται σε κάθε επανάληψη.</p>`,
      glossary: ['μεταβλητή', 'f-string', 'while True', 'time.sleep_ms'],
      supportedSyntax: SYNTAX + ', f-strings',
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: {}, initialWorld: {},
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Πριν από το while True: φτιάξε τη μεταβλητή beats = 0 και τύπωσε "Boot".',
        'Μέσα στο βρόχο: αύξησε το beats, άναψε, περίμενε ON_MS, σβήσε, τύπωσε, περίμενε OFF_MS.',
        'Τρέξε για λίγα δευτερόλεπτα και δες το Τερματικό.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Αν γράψεις beats = 0 ΜΕΣΑ στο while True, τι θα τυπώνει;',
        options: ['Πάντα «Beat 1»', 'Beat 1, Beat 2, Beat 3…', 'Τίποτα'],
        answer: 0,
        explain: 'Σωστά. Σε κάθε επανάληψη το beats ξαναγίνεται 0 και μετά 1.',
        retry: 'Όχι ακόμα. Τι γίνεται με την τιμή όταν το beats = 0 τρέχει σε κάθε γύρο;'
      },
      hints: [
        'Δύο μέρη: πριν από το while (μία φορά) και μέσα στο while (για πάντα).',
        'Πριν: beats = 0 και print("Boot"). Μέσα: beats = beats + 1, led.on(), time.sleep_ms(ON_MS), led.off(), print(…), time.sleep_ms(OFF_MS).',
        'beats = 0\nprint("Boot")\nwhile True:\n    beats = beats + 1\n    led.on()\n    time.sleep_ms(ON_MS)\n    led.off()\n    print(f"Beat {beats}")\n    time.sleep_ms(OFF_MS)'
      ],
      validationTests: [
        { name: '«Boot» μία φορά, μετά Beat 1, 2, 3', script: [
          { setup: true }, { loops: 3 },
          { check: 'lines', is: ['Boot', 'Beat 1', 'Beat 2', 'Beat 3'], fail: 'Το Τερματικό έγραψε: {v}. Περίμενα «Boot», «Beat 1», «Beat 2», «Beat 3».' }
        ] },
        { name: 'Το LED ανάβει για λίγο στην αρχή κάθε χτύπου', script: [
          { setup: true }, { ms: 50 },
          { check: 'led', is: true, fail: 'Στα 50 ms το LED είναι {v}. Ο χτύπος ξεκινά με led.on().' },
          { ms: 400 },
          { check: 'led', is: false, fail: 'Στα 450 ms το LED είναι ακόμα {v}. Πρέπει να μένει αναμμένο μόνο ON_MS (100 ms).' }
        ] },
        { name: 'Ένας χτύπος το δευτερόλεπτο', script: [
          { setup: true }, { ms: 4500 },
          { check: 'count', text: 'Beat 5', is: 1, fail: 'Σε 4,5 δευτερόλεπτα δεν έφτασε στο «Beat 5». Κάθε χτύπος κρατά ON_MS + OFF_MS = 1000 ms.' },
          { check: 'count', text: 'Beat 6', is: 0, fail: 'Σε 4,5 δευτερόλεπτα έγιναν πάνω από 5 χτύποι. Μήπως λείπει μία αναμονή;' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το πρώτο κεφάλαιο της MicroPython! Ξέρεις print, μεταβλητές, Pin, on/off και αναμονές. Στο επόμενο κεφάλαιο η πλακέτα θα «ακούει» κουμπί και κίνηση.',
      remediation: 'Αν το «Boot» τυπώνεται πολλές φορές, είναι μέσα στο while True. Αν όλοι οι χτύποι είναι «Beat 1», το beats = 0 είναι μέσα στο βρόχο.'
    })
  );
})(typeof window !== 'undefined' ? window : globalThis);
