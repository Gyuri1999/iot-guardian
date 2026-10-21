/*
 * IoT Guardian — MicroPython στο ESP32, κεφάλαιο 31 (2ο του κλάδου): Συνθήκες, βρόχοι, κουμπί και PIR.
 * Pin.IN, value(), if/elif/else, while True, μνήμη κατάστασης (ακμή πατήματος), συναγερμός PIR.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 31, title: 'Συνθήκες, βρόχοι, κουμπί και PIR', ready: true, track: 'py-esp32', lang: 'python', board: 'esp32', unlockAfter: 30 });
  if (!L.SKILLS.micropython) L.SKILLS.micropython = 'MicroPython';

  [
    { term: 'Pin.value()', def: 'Χωρίς όρισμα διαβάζει ένα pin: 1 (HIGH) ή 0 (LOW). Με όρισμα γράφει: led.value(1) ανάβει, led.value(0) σβήνει.' },
    { term: 'Pin.PULL_UP', def: 'Εσωτερική αντίσταση που κρατά ένα pin εισόδου στο 1 όταν δεν πατιέται τίποτα. Με κουμπί προς τη γείωση (GND), πατημένο = 0. Γράφεται Pin(15, Pin.IN, Pin.PULL_UP).' },
    { term: 'ακμή (edge)', def: 'Η στιγμή που μια είσοδος αλλάζει: από 0 σε 1 (ανερχόμενη ακμή, «μόλις πατήθηκε») ή από 1 σε 0 (κατερχόμενη, «μόλις αφέθηκε»). Τη βρίσκεις αν θυμάσαι την προηγούμενη τιμή.' },
    { term: 'elif', def: 'Το «αλλιώς αν» της Python. if … elif … else: ελέγχονται με τη σειρά και εκτελείται μόνο το πρώτο σκέλος που ισχύει.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const BASE = { lang: 'python', board: 'esp32', chapter: 31 };
  const SYNTAX = 'from machine import Pin, Pin(n, Pin.IN), Pin(n, Pin.OUT), .value(), .on(), .off(), if/elif/else, ==, and, not, True/False, while True:, time.sleep_ms';
  const PANELS = ['serial', 'vars', 'branch', 'loops'];

  // ------------------------------------------------------------ 31.1
  const L1_CODE = (mode, read) => `# Διαβάζω το κουμπί (GPIO 15).
from machine import Pin
import time

button = Pin(15, ${mode})          # το κουμπί είναι είσοδος

while True:
    print("Button:", button.${read})   # 1 = πατημένο, 0 = όχι
    time.sleep_ms(500)
`;

  // ------------------------------------------------------------ 31.2
  const L2_CODE = (kw) => `# Το LED ανάβει με το κουμπί ή με κίνηση.
from machine import Pin
import time

led = Pin(2, Pin.OUT)
button = Pin(15, Pin.IN)
pir = Pin(4, Pin.IN)

while True:
    if button.value() == 1:
        led.on()
        print("Button")
    ${kw} pir.value() == 1:
        led.on()
        print("Motion")
    else:
        led.off()
        print("Quiet")
    time.sleep_ms(200)
`;

  // ------------------------------------------------------------ 31.3
  const L3_HEAD = `# Κουμπί-διακόπτης: κάθε πάτημα αλλάζει το LED (ON → OFF → ON …).
from machine import Pin
import time

led = Pin(2, Pin.OUT)
button = Pin(15, Pin.IN)

led_on = False      # πώς είναι τώρα το LED
`;
  const L3_INITIAL = L3_HEAD + `prev = 0            # η τιμή του κουμπιού στην προηγούμενη επανάληψη

while True:
    now = button.value()
    # ΑΛΛΑΞΕ: αλλάζει σε ΚΑΘΕ επανάληψη όσο κρατάς το κουμπί.
    # Θέλουμε αλλαγή ΜΟΝΟ τη στιγμή του πατήματος: now == 1 και prev == 0.
    if now == 1:
        led_on = not led_on
        led.value(led_on)
        print("LED ON" if led_on else "LED OFF")
    # ΣΥΜΠΛΗΡΩΣΕ: θυμήσου την τιμή για την επόμενη επανάληψη
    time.sleep_ms(50)
`;
  const L3_SOLUTION = L3_HEAD + `prev = 0            # η τιμή του κουμπιού στην προηγούμενη επανάληψη

while True:
    now = button.value()
    if now == 1 and prev == 0:          # μόλις πατήθηκε
        led_on = not led_on
        led.value(led_on)
        print("LED ON" if led_on else "LED OFF")
    prev = now                          # θυμήσου για την επόμενη φορά
    time.sleep_ms(50)
`;

  // ------------------------------------------------------------ 31.4
  const L4_INITIAL = `# Μετρητής πατημάτων.
# Σε κάθε ΝΕΟ πάτημα: count + 1 και print(f"Presses: {count}").
# Όσο κρατάς το κουμπί πατημένο, δεν μετράει ξανά.
from machine import Pin
import time

button = Pin(15, Pin.IN)

while True:
    time.sleep_ms(50)
`;
  const L4_SOLUTION = `# Μετρητής πατημάτων.
from machine import Pin
import time

button = Pin(15, Pin.IN)
count = 0
prev = 0

while True:
    now = button.value()
    if now == 1 and prev == 0:
        count = count + 1
        print(f"Presses: {count}")
    prev = now
    time.sleep_ms(50)
`;

  // ------------------------------------------------------------ 31.5
  const L5_INITIAL = `# Συναγερμός κίνησης στον διάδρομο.
# Παράπονο 1: «Δεν βλέπει ποτέ κίνηση.»
# Παράπονο 2: «Όταν δουλέψει, γεμίζει το τερματικό με Motion detected.»
# Θέλουμε: "Motion detected" ΜΙΑ φορά όταν ξεκινά η κίνηση,
#          "Clear" ΜΙΑ φορά όταν σταματά, LED αναμμένο όσο υπάρχει κίνηση.
from machine import Pin
import time

led = Pin(2, Pin.OUT)
pir = Pin(4, Pin.OUT)

while True:
    if pir.value() == 1:
        print("Motion detected")
        led.on()
    else:
        led.off()
    time.sleep_ms(100)
`;
  const L5_SOLUTION = `# Συναγερμός κίνησης στον διάδρομο.
from machine import Pin
import time

led = Pin(2, Pin.OUT)
pir = Pin(4, Pin.IN)
prev = 0

while True:
    now = pir.value()
    if now == 1 and prev == 0:
        print("Motion detected")
        led.on()
    elif now == 0 and prev == 1:
        print("Clear")
        led.off()
    prev = now
    time.sleep_ms(100)
`;

  // ------------------------------------------------------------ 31.6
  const L6_INITIAL = `# Συναγερμός με όπλιση.
# - Κάθε νέο πάτημα του κουμπιού αλλάζει το armed και τυπώνει "Armed" ή "Disarmed".
# - Όταν armed και ξεκινά κίνηση: print("ALARM") και LED αναμμένο.
#   Το LED μένει αναμμένο μέχρι τον αφοπλισμό.
# - Στον αφοπλισμό: LED σβηστό.
# - Όταν δεν είναι armed, η κίνηση αγνοείται.
from machine import Pin
import time

led = Pin(2, Pin.OUT)
button = Pin(15, Pin.IN)
pir = Pin(4, Pin.IN)

armed = False

while True:
    time.sleep_ms(100)
`;
  const L6_SOLUTION = `# Συναγερμός με όπλιση.
from machine import Pin
import time

led = Pin(2, Pin.OUT)
button = Pin(15, Pin.IN)
pir = Pin(4, Pin.IN)

armed = False
prev_button = 0
prev_pir = 0

while True:
    b = button.value()
    m = pir.value()

    if b == 1 and prev_button == 0:      # νέο πάτημα
        armed = not armed
        if armed:
            print("Armed")
        else:
            led.off()
            print("Disarmed")

    if armed and m == 1 and prev_pir == 0:   # ξεκινά κίνηση
        led.on()
        print("ALARM")

    prev_button = b
    prev_pir = m
    time.sleep_ms(100)
`;

  L.lessons.push(
    Object.assign({}, BASE, {
      id: 'c31-l1', kind: 'micro', skills: ['micropython', 'io'],
      title: 'Διαβάζω το κουμπί με Pin.IN',
      prerequisites: [],
      objectives: ['Να ρυθμίζω ένα GPIO ως είσοδο.', 'Να διαβάζω την τιμή του με .value().'],
      theory: `
<p>Ένα κουμπί είναι <strong>είσοδος</strong>: η πλακέτα «ακούει» το pin.</p>
<pre>button = Pin(15, Pin.IN)
button.value()     # 1 ή 0</pre>
<ul>
  <li>Στην εικονική πλακέτα το κουμπί είναι στο <strong>GPIO 15</strong>.</li>
  <li>Πατημένο → <code>1</code>. Αφημένο → <code>0</code>.</li>
</ul>
<p><strong>Σε αληθινή πλακέτα</strong> συχνά συνδέουμε το κουμπί προς τη γείωση (GND) και γράφουμε <code>Pin(15, Pin.IN, Pin.PULL_UP)</code>. Τότε ισχύει το ανάποδο: πατημένο = 0.</p>
<p>Χωρίς <code>()</code> το <code>button.value</code> είναι η ίδια η μέθοδος, όχι η τιμή. Οι παρενθέσεις «τη ρωτούν».</p>`,
      glossary: ['Pin.OUT / Pin.IN', 'Pin.value()', 'Pin.PULL_UP', 'polling'],
      supportedSyntax: SYNTAX,
      initialCode: L1_CODE('____', '____'),
      solution: L1_CODE('Pin.IN', 'value()'),
      world: {}, initialWorld: { button: false },
      hardware: ['button'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε: το GPIO 15 ως είσοδος.',
        'Συμπλήρωσε: η μέθοδος που διαβάζει την τιμή, με παρενθέσεις.',
        'Τρέξε. Κράτα πατημένο το κουμπί στη σκηνή και δες το Τερματικό.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το κουμπί είναι πατημένο. Τι τυπώνει το print("Button:", button.value());',
        options: ['Button: 1', 'Button: True', 'Button: 0'],
        answer: 0,
        explain: 'Σωστά. Το .value() δίνει ακέραιο: 1 για HIGH, 0 για LOW.',
        retry: 'Όχι ακόμα. Το .value() δεν επιστρέφει True/False, αλλά αριθμό. Στην πλακέτα μας πατημένο = HIGH.'
      },
      hints: [
        'Το κουμπί δεν δίνει ρεύμα: η πλακέτα το διαβάζει. Άρα είναι είσοδος.',
        'Η σταθερά είναι Pin.IN. Η μέθοδος ανάγνωσης είναι η ίδια με αυτή που γράφει: value, αλλά χωρίς όρισμα.',
        'button = Pin(15, Pin.IN)\nprint("Button:", button.value())\n• value() χωρίς όρισμα = διάβασε'
      ],
      validationTests: [
        { name: 'Πατημένο κουμπί → «Button: 1»', world: { button: true }, script: [
          { setup: true }, { loops: 2 },
          { check: 'count', text: 'Button: 1', is: 2, fail: 'Με πατημένο κουμπί τυπώθηκε {n} φορές «Button: 1» σε 2 επαναλήψεις. Περίμενα 2.', failZero: 'Με πατημένο κουμπί δεν τυπώθηκε «Button: 1». Διάβασε το κουμπί με button.value().' }
        ] },
        { name: 'Αφημένο κουμπί → «Button: 0»', world: { button: false }, script: [
          { setup: true }, { loops: 2 },
          { check: 'lastLine', is: 'Button: 0', fail: 'Με αφημένο κουμπί η τελευταία γραμμή είναι {v}. Περίμενα «Button: 0».' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα «ακούει» το κουμπί! Αυτό λέγεται polling: σε κάθε επανάληψη ρωτάμε το pin «τι τιμή έχεις;».',
      remediation: 'Αν δεις «<bound_method…>» ή κάτι παρόμοιο, λείπουν οι παρενθέσεις: button.value().'
    }),

    Object.assign({}, BASE, {
      id: 'c31-l2', kind: 'guided', skills: ['micropython', 'conditions', 'io'],
      title: 'if, elif, else: κουμπί ή κίνηση',
      prerequisites: ['c31-l1'],
      objectives: ['Να γράφω if/elif/else στη Python.', 'Να ξέρω ότι ελέγχεται η πρώτη συνθήκη που ισχύει.', 'Να ελέγχω το LED από δύο εισόδους.'],
      theory: `
<p>Με <code>if / elif / else</code> η πλακέτα διαλέγει <strong>ένα</strong> από πολλά σκέλη.</p>
<pre>if button.value() == 1:
    …          # 1ος έλεγχος
elif pir.value() == 1:
    …          # μόνο αν ο 1ος ήταν False
else:
    …          # αν κανένας δεν ισχύει</pre>
<ul>
  <li>Μετά από κάθε συνθήκη: <strong>άνω-κάτω τελεία</strong> <code>:</code></li>
  <li>Στη Python γράφεις <code>elif</code>, όχι <code>else if</code>.</li>
  <li>Αν ισχύουν και τα δύο, κερδίζει το <strong>πρώτο</strong>.</li>
</ul>
<p>Ο PIR είναι στο <strong>GPIO 4</strong>. Δίνει 1 όταν βλέπει κίνηση.</p>`,
      glossary: ['elif', 'συνθήκη', 'PIR', 'Pin.value()'],
      supportedSyntax: SYNTAX,
      initialCode: L2_CODE('____'),
      solution: L2_CODE('elif'),
      world: {}, initialWorld: { button: false, pir: false },
      hardware: ['button', 'pir'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τη λέξη που σημαίνει «αλλιώς αν».',
        'Τρέξε. Δοκίμασε: τίποτα, μόνο κίνηση, μόνο κουμπί, και τα δύο.',
        'Δες στο πάνελ «Συνθήκη» ποιο σκέλος εκτελέστηκε.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το κουμπί είναι πατημένο ΚΑΙ υπάρχει κίνηση. Τι τυπώνεται;',
        options: ['Button', 'Motion', 'Button και Motion'],
        answer: 0,
        explain: 'Σωστά. Η πρώτη συνθήκη ισχύει, άρα το elif και το else προσπερνιούνται.',
        retry: 'Όχι ακόμα. Σε if/elif/else εκτελείται μόνο ένα σκέλος: το πρώτο που ισχύει.'
      },
      hints: [
        'Θέλουμε «αλλιώς, αν υπάρχει κίνηση».',
        'Στη Python το «else if» γράφεται με μία λέξη.',
        'elif pir.value() == 1:\n• elif = else + if\n• στο τέλος η άνω-κάτω τελεία :'
      ],
      validationTests: [
        { name: 'Τίποτα → «Quiet», LED σβηστό', script: [
          { setup: true }, { loops: 1 },
          { check: 'lastLine', is: 'Quiet', fail: 'Χωρίς κουμπί και κίνηση η τελευταία γραμμή είναι {v}. Περίμενα «Quiet».' },
          { check: 'led', is: false, fail: 'Χωρίς κουμπί και κίνηση το LED είναι {v}.' }
        ] },
        { name: 'Κίνηση → «Motion», LED αναμμένο', script: [
          { setup: true }, { set: { pir: true } }, { loops: 1 },
          { check: 'lastLine', is: 'Motion', fail: 'Με κίνηση η τελευταία γραμμή είναι {v}. Περίμενα «Motion».' },
          { check: 'led', is: true, fail: 'Με κίνηση το LED είναι {v}.' }
        ] },
        { name: 'Κουμπί και κίνηση → «Button» (πρώτο κερδίζει)', script: [
          { setup: true }, { set: { pir: true, button: true } }, { loops: 1 },
          { check: 'lastLine', is: 'Button', fail: 'Με κουμπί και κίνηση η τελευταία γραμμή είναι {v}. Περίμενα «Button».' },
          { set: { pir: false, button: false } }, { loops: 1 },
          { check: 'led', is: false, fail: 'Όταν σταματούν και τα δύο, το LED είναι {v}. Πρέπει να σβήνει.' }
        ] }
      ],
      explanationOnSuccess: 'Το if/elif/else δουλεύει! Η σειρά των ελέγχων είναι απόφαση: εδώ το κουμπί έχει προτεραιότητα από τον PIR.',
      remediation: 'Αν δεις «SyntaxError», έλεγξε ότι γράφεις elif (όχι else if) και ότι υπάρχει η άνω-κάτω τελεία στο τέλος.'
    }),

    Object.assign({}, BASE, {
      id: 'c31-l3', kind: 'guided', skills: ['micropython', 'state', 'conditions'],
      title: 'Κουμπί-διακόπτης: θυμάμαι την προηγούμενη τιμή',
      prerequisites: ['c31-l2'],
      objectives: ['Να βρίσκω τη στιγμή του πατήματος (ακμή).', 'Να κρατώ κατάσταση σε μεταβλητή έξω από τον βρόχο.', 'Να αλλάζω True/False με not.'],
      theory: `
<p>Ένας διακόπτης αλλάζει <strong>μία</strong> φορά σε κάθε πάτημα. Όμως ο βρόχος τρέχει κάθε 50 ms: όσο κρατάς το κουμπί, βλέπει <code>1</code> πολλές φορές.</p>
<p>Λύση: θυμόμαστε την <strong>προηγούμενη</strong> τιμή.</p>
<ul>
  <li><code>now == 1 and prev == 0</code> → μόλις πατήθηκε (<strong>ακμή</strong>).</li>
  <li>Στο τέλος κάθε επανάληψης: <code>prev = now</code>.</li>
</ul>
<p>Το <code>led_on = not led_on</code> κάνει το True → False και το False → True.</p>
<p>Το <code>led.value(led_on)</code> δέχεται και True/False.</p>`,
      glossary: ['ακμή (edge)', 'κατάσταση (state)', '! (όχι)'],
      supportedSyntax: SYNTAX,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: {}, initialWorld: { button: false },
      hardware: ['button'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε και κράτα το κουμπί πατημένο για λίγο. Τι κάνει το LED;',
        'Άλλαξε τη συνθήκη: now == 1 and prev == 0.',
        'Στο τέλος του βρόχου, πριν από το sleep, γράψε prev = now.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Κρατάς το κουμπί για 1 δευτερόλεπτο. Ο βρόχος τρέχει κάθε 50 ms. Με την αρχική συνθήκη (μόνο now == 1), πόσες φορές αλλάζει το LED;',
        options: ['Περίπου 20 φορές', '1 φορά', 'Καμία'],
        answer: 0,
        explain: 'Σωστά. 1000 ÷ 50 = 20 επαναλήψεις, και σε καθεμία το now είναι 1. Γι’ αυτό χρειάζεται το prev.',
        retry: 'Όχι ακόμα. Πόσες επαναλήψεις χωρούν σε 1000 ms αν η καθεμία κρατά 50 ms;'
      },
      hints: [
        'Η αλλαγή πρέπει να γίνεται μόνο όταν το κουμπί ΜΟΛΙΣ πατήθηκε: τώρα 1, πριν 0.',
        'Δύο αλλαγές: (1) and prev == 0 στη συνθήκη, (2) prev = now στο τέλος του βρόχου.',
        'if now == 1 and prev == 0:\n    led_on = not led_on\n    …\nprev = now\n• το prev = now έχει την ίδια εσοχή με το if'
      ],
      validationTests: [
        { name: 'Ένα μακρύ πάτημα → μία αλλαγή', script: [
          { setup: true }, { sequence: { button: [0, 1, 1, 1, 1, 0] } },
          { check: 'count', text: 'LED ON', is: 1, fail: 'Ένα πάτημα (4 επαναλήψεις πατημένο) τύπωσε {n} φορές «LED ON». Περίμενα 1.' },
          { check: 'count', text: 'LED OFF', is: 0, fail: 'Ένα πάτημα τύπωσε και «LED OFF» {n} φορές. Το LED άλλαξε πάνω από μία φορά.' },
          { check: 'led', is: true, fail: 'Μετά από ένα πάτημα το LED είναι {v}. Περίμενα αναμμένο.' }
        ] },
        { name: 'Δεύτερο πάτημα → σβήνει', script: [
          { setup: true }, { sequence: { button: [0, 1, 1, 0, 0, 1, 1, 0] } },
          { check: 'led', is: false, fail: 'Μετά από δύο πατήματα το LED είναι {v}. Περίμενα σβηστό.' },
          { check: 'order', texts: ['LED ON', 'LED OFF'], fail: 'Οι αλλαγές ήταν: {v}. Περίμενα «LED ON» και μετά «LED OFF».' }
        ] }
      ],
      explanationOnSuccess: 'Τώρα το κουμπί είναι διακόπτης! Το prev είναι «μνήμη» της πλακέτας: χωρίς αυτήν δεν ξέρει αν το πάτημα είναι νέο ή το ίδιο.',
      remediation: 'Αν το LED αλλάζει πολλές φορές, έλεγξε ότι το prev = now είναι μέσα στο while (με εσοχή) αλλά έξω από το if.'
    }),

    Object.assign({}, BASE, {
      id: 'c31-l4', kind: 'variant', skills: ['micropython', 'state', 'variables'],
      title: 'Παραλλαγή: μετρητής πατημάτων',
      prerequisites: ['c31-l3'],
      objectives: ['Να ξαναχρησιμοποιώ το μοτίβο της ακμής.', 'Να μετρώ γεγονότα με μια μεταβλητή.'],
      theory: `
<p>Το ίδιο μοτίβο, νέα δουλειά: <strong>μέτρα</strong> τα πατήματα.</p>
<ul>
  <li><code>count = 0</code> και <code>prev = 0</code> πριν από τον βρόχο.</li>
  <li>Σε κάθε <strong>νέο</strong> πάτημα: <code>count = count + 1</code> και <code>print(f"Presses: {count}")</code>.</li>
  <li><code>prev = now</code> στο τέλος.</li>
</ul>
<p>Τυπώνεις <strong>μόνο</strong> όταν γίνει πάτημα. Έτσι το τερματικό μένει καθαρό.</p>`,
      glossary: ['ακμή (edge)', 'μεταβλητή', 'f-string'],
      supportedSyntax: SYNTAX + ', f-strings',
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: {}, initialWorld: { button: false },
      hardware: ['button'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Φτιάξε τις μεταβλητές count και prev πριν από το while True.',
        'Μέσα στο βρόχο διάβασε το κουμπί και βρες την ακμή.',
        'Τρέξε. Πάτα το κουμπί 3 φορές.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Οι τιμές του κουμπιού σε 6 επαναλήψεις είναι 1, 0, 1, 1, 0, 1. Πόσα πατήματα μετρά το σωστό πρόγραμμα;',
        options: ['3', '4', '2'],
        answer: 0,
        explain: 'Σωστά. Νέο πάτημα (0 → 1) έχουμε στην 1η, 3η και 6η τιμή. Το 1, 1 είναι το ίδιο πάτημα.',
        retry: 'Όχι ακόμα. Μέτρα μόνο τα σημεία όπου η τιμή γίνεται 1 ενώ πριν ήταν 0 (στην αρχή το prev είναι 0).'
      },
      hints: [
        'Είναι το ίδιο μοτίβο με τον διακόπτη: now, prev, and.',
        'Αντί για led_on = not led_on, γράψε count = count + 1 και τύπωσε.',
        'count = 0\nprev = 0\nwhile True:\n    now = button.value()\n    if now == 1 and prev == 0:\n        count = count + 1\n        print(f"Presses: {count}")\n    prev = now\n    time.sleep_ms(50)'
      ],
      validationTests: [
        { name: 'Τρία πατήματα → Presses: 1, 2, 3', script: [
          { setup: true }, { sequence: { button: [1, 0, 1, 1, 0, 1, 1, 1] } },
          { check: 'lines', is: ['Presses: 1', 'Presses: 2', 'Presses: 3'], fail: 'Το Τερματικό έγραψε: {v}. Περίμενα «Presses: 1», «Presses: 2», «Presses: 3».' }
        ] },
        { name: 'Χωρίς πάτημα → τίποτα', script: [
          { setup: true }, { loops: 5 },
          { check: 'total', is: 0, fail: 'Χωρίς πάτημα τυπώθηκαν {n} γραμμές. Τύπωνε μόνο όταν μετράς νέο πάτημα.' }
        ] }
      ],
      explanationOnSuccess: 'Μετράς σωστά! Το ίδιο μοτίβο μετρά επισκέπτες σε πόρτα, στροφές ενός τροχού ή πατήματα σε κουδούνι.',
      remediation: 'Αν μετρά πάρα πολλά, λείπει το and prev == 0 ή το prev = now.'
    }),

    Object.assign({}, BASE, {
      id: 'c31-l5', kind: 'debug', skills: ['micropython', 'io', 'state'],
      title: 'Βρες το λάθος: ο συναγερμός του διαδρόμου',
      prerequisites: ['c31-l4'],
      objectives: ['Να βρίσκω λάθος κατεύθυνση σε pin εισόδου.', 'Να τυπώνω ένα μήνυμα ανά γεγονός, όχι ανά επανάληψη.'],
      theory: `
<p>Δύο παράπονα, δύο λάθη:</p>
<ol>
  <li>«Δεν βλέπει ποτέ κίνηση». Ένας αισθητήρας είναι <strong>είσοδος</strong>. Ένα pin <code>Pin.OUT</code> δεν διαβάζει τον PIR: δίνει πάντα ό,τι του έγραψες (0).</li>
  <li>«Γεμίζει το τερματικό». Το <code>if pir.value() == 1</code> ισχύει σε <strong>κάθε</strong> επανάληψη όσο κρατά η κίνηση. Θέλουμε μήνυμα μόνο στις <strong>ακμές</strong>.</li>
</ol>
<p>Ακμές με δύο συνθήκες:</p>
<ul>
  <li><code>now == 1 and prev == 0</code> → ξεκίνησε κίνηση</li>
  <li><code>now == 0 and prev == 1</code> → σταμάτησε</li>
</ul>`,
      glossary: ['PIR', 'ακμή (edge)', 'Pin.OUT / Pin.IN', 'προειδοποίηση'],
      supportedSyntax: SYNTAX,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: {}, initialWorld: { pir: false },
      hardware: ['pir'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε και άναψε την κίνηση στη σκηνή. Διάβασε την προειδοποίηση για το GPIO 4.',
        'Διόρθωσε την κατεύθυνση του pin του PIR.',
        'Πρόσθεσε prev και τύπωνε μόνο στις ακμές: «Motion detected» και «Clear».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο PIR βλέπει κίνηση για 2 δευτερόλεπτα και ο βρόχος τρέχει κάθε 100 ms. Πόσες φορές τυπώνει «Motion detected» ο αρχικός κώδικας (αν το pin ήταν σωστό);',
        options: ['Περίπου 20', '1', '2'],
        answer: 0,
        explain: 'Σωστά. 2000 ÷ 100 = 20 επαναλήψεις με τιμή 1. Το σωστό πρόγραμμα τυπώνει μία φορά.',
        retry: 'Όχι ακόμα. Σε κάθε επανάληψη με κίνηση το if ισχύει ξανά.'
      },
      hints: [
        'Το πρώτο λάθος είναι στη γραμμή pir = Pin(4, …). Το δεύτερο είναι ότι λείπει «μνήμη».',
        'Ο PIR θέλει Pin.IN. Για τις ακμές χρειάζεσαι prev = 0 πριν από τον βρόχο και prev = now στο τέλος.',
        'pir = Pin(4, Pin.IN)\nprev = 0\nwhile True:\n    now = pir.value()\n    if now == 1 and prev == 0:\n        print("Motion detected")\n        led.on()\n    elif now == 0 and prev == 1:\n        print("Clear")\n        led.off()\n    prev = now\n    time.sleep_ms(100)'
      ],
      validationTests: [
        { name: 'Κίνηση → LED αναμμένο', script: [
          { setup: true }, { sequence: { pir: [0, 1, 1] } },
          { check: 'led', is: true, fail: 'Με κίνηση το LED είναι {v}. Ο PIR διαβάζεται; Είναι Pin.IN;' }
        ] },
        { name: 'Μία κίνηση → ένα «Motion detected» και ένα «Clear»', script: [
          { setup: true }, { sequence: { pir: [0, 1, 1, 1, 1, 0, 0] } },
          { check: 'count', text: 'Motion detected', is: 1, fail: 'Μία κίνηση τύπωσε {n} φορές «Motion detected». Περίμενα 1.' },
          { check: 'count', text: 'Clear', is: 1, fail: 'Το τέλος της κίνησης τύπωσε {n} φορές «Clear». Περίμενα 1.' },
          { check: 'led', is: false, fail: 'Μετά την κίνηση το LED είναι {v}. Περίμενα σβηστό.' }
        ] },
        { name: 'Δύο κινήσεις → δύο μηνύματα', script: [
          { setup: true }, { sequence: { pir: [1, 1, 0, 0, 1, 0] } },
          { check: 'count', text: 'Motion detected', is: 2, fail: 'Δύο κινήσεις τύπωσαν {n} φορές «Motion detected». Περίμενα 2.' }
        ] }
      ],
      explanationOnSuccess: 'Ο συναγερμός λέει ένα μήνυμα ανά γεγονός. Αργότερα, αντί για print, θα στέλνεις μήνυμα MQTT: ένα ανά κίνηση, όχι είκοσι.',
      remediation: 'Αν δεν βλέπει κίνηση, ο PIR είναι ακόμα Pin.OUT. Αν τυπώνει πολλές φορές, λείπει το prev.'
    }),

    Object.assign({}, BASE, {
      id: 'c31-l6', kind: 'checkpoint', skills: ['micropython', 'io', 'conditions', 'state'],
      title: 'Έλεγχος κεφαλαίου: συναγερμός με όπλιση',
      prerequisites: ['c31-l5'],
      objectives: ['Να συνδυάζω δύο εισόδους με μνήμη κατάστασης.', 'Να «κλειδώνω» έναν συναγερμό μέχρι τον αφοπλισμό.', 'Να χρησιμοποιώ and μέσα σε συνθήκη.'],
      theory: `
<p>Ένας συναγερμός σπιτιού έχει δύο καταστάσεις: <strong>οπλισμένος</strong> και <strong>αφοπλισμένος</strong>.</p>
<ul>
  <li>Το κουμπί (GPIO 15) είναι διακόπτης: κάθε νέο πάτημα αλλάζει το <code>armed</code>. Τύπωσε <code>"Armed"</code> ή <code>"Disarmed"</code>.</li>
  <li>Αν <code>armed</code> και <strong>ξεκινά</strong> κίνηση: <code>print("ALARM")</code> και LED αναμμένο.</li>
  <li>Το LED <strong>μένει</strong> αναμμένο, ακόμα κι αν σταματήσει η κίνηση. Σβήνει μόνο στον αφοπλισμό.</li>
  <li>Αφοπλισμένος: η κίνηση αγνοείται.</li>
</ul>
<p>Χρειάζεσαι δύο «μνήμες»: <code>prev_button</code> και <code>prev_pir</code>.</p>`,
      glossary: ['κατάσταση (state)', 'ακμή (edge)', 'elif', 'PIR'],
      supportedSyntax: SYNTAX,
      initialCode: L6_INITIAL,
      solution: L6_SOLUTION,
      world: {}, initialWorld: { button: false, pir: false },
      hardware: ['button', 'pir'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Πρόσθεσε prev_button και prev_pir πριν από τον βρόχο.',
        'Γράψε το κομμάτι του κουμπιού (όπλιση / αφοπλισμός).',
        'Γράψε το κομμάτι του PIR (μόνο όταν armed).',
        'Δοκίμασε στη σκηνή: κίνηση, όπλιση, κίνηση, αφοπλισμός.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο συναγερμός είναι οπλισμένος και χτύπησε. Η κίνηση σταματά. Τι κάνει το LED;',
        options: ['Μένει αναμμένο μέχρι τον αφοπλισμό', 'Σβήνει αμέσως', 'Αναβοσβήνει'],
        answer: 0,
        explain: 'Σωστά. Ένας συναγερμός δεν «ξεχνά» μόνος του. Τον σβήνει ο χρήστης με τον αφοπλισμό.',
        retry: 'Όχι ακόμα. Ξαναδιάβασε: πότε σβήνει το LED;'
      },
      hints: [
        'Δύο ανεξάρτητα if: ένα για το κουμπί, ένα για τον PIR. Και τα δύο ψάχνουν ακμή.',
        'Κουμπί: if b == 1 and prev_button == 0 → armed = not armed. PIR: if armed and m == 1 and prev_pir == 0 → ALARM.',
        'if b == 1 and prev_button == 0:\n    armed = not armed\n    if armed:\n        print("Armed")\n    else:\n        led.off()\n        print("Disarmed")\nif armed and m == 1 and prev_pir == 0:\n    led.on()\n    print("ALARM")\nprev_button = b\nprev_pir = m'
      ],
      validationTests: [
        { name: 'Αφοπλισμένος: η κίνηση αγνοείται', script: [
          { setup: true }, { sequence: { pir: [0, 1, 1, 0] } },
          { check: 'count', text: 'ALARM', is: 0, fail: 'Χωρίς όπλιση τυπώθηκε {n} φορές «ALARM». Ο συναγερμός χτυπά μόνο όταν armed.' },
          { check: 'led', is: false, fail: 'Χωρίς όπλιση το LED είναι {v}.' }
        ] },
        { name: 'Όπλιση και κίνηση → ένα ALARM, LED κλειδωμένο', script: [
          { setup: true }, { sequence: { button: [0, 1, 1, 0] } },
          { check: 'lastLine', is: 'Armed', fail: 'Μετά από ένα πάτημα η τελευταία γραμμή είναι {v}. Περίμενα «Armed».' },
          { sequence: { pir: [1, 1, 1, 0, 0] } },
          { check: 'count', text: 'ALARM', is: 1, fail: 'Μία κίνηση τύπωσε {n} φορές «ALARM». Περίμενα 1.' },
          { check: 'led', is: true, fail: 'Μετά τον συναγερμό το LED είναι {v}. Πρέπει να μένει αναμμένο μέχρι τον αφοπλισμό.' }
        ] },
        { name: 'Αφοπλισμός → LED σβηστό', script: [
          { setup: true }, { sequence: { button: [1, 0] } }, { sequence: { pir: [1, 0] } },
          { sequence: { button: [1, 1, 0] } },
          { check: 'lastLine', is: 'Disarmed', fail: 'Μετά το δεύτερο πάτημα η τελευταία γραμμή είναι {v}. Περίμενα «Disarmed».' },
          { check: 'led', is: false, fail: 'Μετά τον αφοπλισμό το LED είναι {v}. Πρέπει να σβήνει.' },
          { check: 'count', text: 'Armed', is: 1, fail: 'Τυπώθηκε {n} φορές «Armed». Ένα πάτημα = μία αλλαγή.' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο! Είσοδοι, συνθήκες, ακμές και κατάσταση: αυτά είναι η βάση κάθε συσκευής. Στο επόμενο κεφάλαιο θα οργανώσεις τον κώδικα σε συναρτήσεις και θα διαβάσεις θερμοκρασία.',
      remediation: 'Αν το «Armed» τυπώνεται πολλές φορές, λείπει το prev_button. Αν το LED σβήνει μόλις σταματήσει η κίνηση, μην γράφεις led.off() στο κομμάτι του PIR.'
    })
  );
})(typeof window !== 'undefined' ? window : globalThis);
