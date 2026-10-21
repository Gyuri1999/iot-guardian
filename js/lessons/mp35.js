/*
 * IoT Guardian — MicroPython στο ESP32, κεφάλαιο 35 (6ο του κλάδου): Αισθητήρας στάθμευσης.
 * HC-SR04 με machine.time_pulse_us, cm = us / 58.3, χειρισμός timeout (αρνητική τιμή),
 * φανάρι με τρία Pin (25 / 26 / 27).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 35, title: 'Αισθητήρας στάθμευσης σε MicroPython', ready: true, track: 'py-esp32', lang: 'python', board: 'esp32', unlockAfter: 34 });
  if (!L.SKILLS.micropython) L.SKILLS.micropython = 'MicroPython';

  [
    { term: 'time_pulse_us', def: 'machine.time_pulse_us(pin, 1, 30000) περιμένει το pin να γίνει 1 και μετρά πόσα µs έμεινε 1. Αν δεν έρθει παλμός μέσα στο όριο (εδώ 30000 µs), επιστρέφει αρνητικό αριθμό (-1 ή -2).' },
    { term: 'sleep_us', def: 'time.sleep_us(10): αναμονή 10 µs (μικροδευτερόλεπτα). Τόσο κρατά ο παλμός στο TRIG του HC-SR04.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const BASE = { lang: 'python', board: 'esp32', chapter: 35 };
  const SYNTAX = 'from machine import Pin, time_pulse_us, Pin(5, Pin.OUT), Pin(18, Pin.IN), trig.on() / off(), time.sleep_us, time.sleep_ms, time_pulse_us(echo, 1, 30000), def, return, None, if / elif / else';
  const PANELS = ['serial', 'vars', 'branch', 'loops'];
  const HW = ['ultrasonic', 'traffic'];

  const PINS_US = `trig = Pin(5, Pin.OUT)       # TRIG του HC-SR04
echo = Pin(18, Pin.IN)       # ECHO του HC-SR04 (μέσω διαιρέτη τάσης!)`;
  const PINS_LIGHT = `red = Pin(25, Pin.OUT)
yellow = Pin(26, Pin.OUT)
green = Pin(27, Pin.OUT)`;
  const PING = `    trig.off()
    time.sleep_us(2)
    trig.on()                # παλμός TRIG: 10 µs
    time.sleep_us(10)
    trig.off()`;
  const SET_LIGHT = `# Ανάβει ακριβώς τα φώτα που ζητάς (1) και σβήνει τα άλλα (0).
def set_light(r, y, g):
    red.value(r)
    yellow.value(y)
    green.value(g)`;
  const MEASURE = `# Στέλνει παλμό και επιστρέφει cm, ή None αν δεν ήρθε ηχώ.
def measure():
${PING}
    us = time_pulse_us(echo, 1, 30000)
    if us < 0:
        return None
    return us / 58.3`;

  // ------------------------------------------------------------ 35.1
  const L1_CODE = (pulse) => `# Μέτρηση απόστασης με το HC-SR04.
from machine import Pin, time_pulse_us
import time

${PINS_US}

while True:
${PING}

    us = ${pulse}     # πόσα µs κράτησε η ηχώ
    cm = us / 58.3                      # περίπου 58,3 µs ανά cm (πάει και έρχεται)
    print(f"Distance: {cm:.1f} cm")
    time.sleep_ms(500)
`;

  // ------------------------------------------------------------ 35.2
  const L2_CODE = (body) => `# Τι γίνεται όταν δεν έρχεται ηχώ;
from machine import Pin, time_pulse_us
import time

${PINS_US}

while True:
${PING}

    us = time_pulse_us(echo, 1, 30000)
${body}
    time.sleep_ms(500)
`;
  const L2_BAD = `    # ΣΥΜΠΛΗΡΩΣΕ: αν το us είναι αρνητικό, τύπωσε "No echo" αντί για απόσταση.
    cm = us / 58.3
    print(f"Distance: {cm:.1f} cm")`;
  const L2_GOOD = `    if us < 0:
        print("No echo")                # δεν ήρθε ηχώ μέσα στα 30000 µs
    else:
        cm = us / 58.3
        print(f"Distance: {cm:.1f} cm")`;

  // ------------------------------------------------------------ 35.3
  const L3_CODE = (choose) => `# Φανάρι που αλλάζει με την απόσταση.
from machine import Pin, time_pulse_us
import time

${PINS_US}
${PINS_LIGHT}

${SET_LIGHT}

${MEASURE}

while True:
    cm = measure()
    if cm is None:
        set_light(0, 0, 0)
        print("No echo")
    else:
        print(f"Distance: {cm:.1f} cm")
${choose}
    time.sleep_ms(200)
`;
  const L3_BAD = `        if cm >= ____:
            set_light(0, 0, 1)          # πράσινο: ελεύθερα
        elif cm >= ____:
            set_light(0, 1, 0)          # κίτρινο: πρόσεχε
        else:
            set_light(____, ____, ____) # ΣΥΜΠΛΗΡΩΣΕ: μόνο κόκκινο`;
  const L3_GOOD = `        if cm >= 50:
            set_light(0, 0, 1)          # πράσινο: ελεύθερα
        elif cm >= 20:
            set_light(0, 1, 0)          # κίτρινο: πρόσεχε
        else:
            set_light(1, 0, 0)          # κόκκινο: σταμάτα`;

  // ------------------------------------------------------------ 35.4
  const L4_CODE = (o) => `# Αισθητήρας στάθμευσης του γκαράζ.
# Παράπονο 1: «Γράφει συνέχεια No echo.»
# Παράπονο 2: «Το κίτρινο δεν ανάβει ποτέ.»
# Παράπονο 3: «Πολύ κοντά ανάβουν δύο φώτα μαζί.»
from machine import Pin, time_pulse_us
import time

trig = Pin(5, Pin.OUT)
echo = Pin(18, Pin.IN)
red = Pin(25, Pin.OUT)
yellow = Pin(26, ${o.yellow})
green = Pin(27, Pin.OUT)

def measure():
    trig.off()
    time.sleep_us(2)
    trig.on()
    time.sleep_us(${o.pulse})
    trig.off()
    us = time_pulse_us(echo, 1, 30000)
    if us < 0:
        return None
    return us / 58.3

while True:
    cm = measure()
    red.off()
    yellow.off()
    green.off()
    if cm is None:
        print("No echo")
    else:
        print(f"Distance: {cm:.1f} cm")
        if cm < 20:
            red.on()
        ${o.chain} cm < 50:
            yellow.on()
        else:
            green.on()
    time.sleep_ms(200)
`;
  const L4_BAD = { yellow: 'Pin.IN', pulse: 2, chain: 'if' };
  const L4_GOOD = { yellow: 'Pin.OUT', pulse: 10, chain: 'elif' };

  // ------------------------------------------------------------ 35.5
  const L5_HEAD = `# Αισθητήρας στάθμευσης: όλα μαζί.
from machine import Pin, time_pulse_us
import time

${PINS_US}
${PINS_LIGHT}

${SET_LIGHT}

`;
  const L5_INITIAL = L5_HEAD + `# ΓΡΑΨΕ:
# 1. def measure(): cm ή None (όπως πριν)
# 2. Στο while True, κάθε 100 ms:
#    - None        → όλα σβηστά, print("No echo")
#    - cm >= 50    → πράσινο
#    - cm >= 20    → κίτρινο
#    - cm >= 10    → κόκκινο
#    - cm < 10     → print("STOP") και το κόκκινο αναβοσβήνει:
#                    1ος γύρος αναμμένο, 2ος σβηστό, 3ος αναμμένο…
#    Χρησιμοποίησε μια μεταβλητή blink_on (False όταν cm >= 10).

while True:
    time.sleep_ms(100)
`;
  const L5_SOLUTION = L5_HEAD + `${MEASURE}

blink_on = False

while True:
    cm = measure()
    if cm is None:
        set_light(0, 0, 0)
        print("No echo")
        blink_on = False
    elif cm >= 50:
        set_light(0, 0, 1)
        blink_on = False
    elif cm >= 20:
        set_light(0, 1, 0)
        blink_on = False
    elif cm >= 10:
        set_light(1, 0, 0)
        blink_on = False
    else:
        print("STOP")
        blink_on = not blink_on        # αλλάζει σε κάθε γύρο
        set_light(1 if blink_on else 0, 0, 0)
    time.sleep_ms(100)
`;

  const lightStep = (d, red, yellow, green, want) => ({
    check: 'lights', red, yellow, green,
    fail: `Στα ${d} cm το φανάρι δείχνει: {v}. Περίμενα μόνο ${want}.`
  });
  const at = (d) => ({ set: { distance: d } });

  L.lessons.push(
    Object.assign({}, BASE, {
      id: 'c35-l1', kind: 'micro', skills: ['micropython', 'sensors', 'io'],
      title: 'Η πρώτη μέτρηση με time_pulse_us',
      prerequisites: [],
      objectives: ['Να στέλνω παλμό 10 µs στο TRIG.', 'Να μετρώ την ηχώ με time_pulse_us.', 'Να μετατρέπω τα µs σε cm.'],
      theory: `
<p>Το <strong>HC-SR04</strong> μετρά απόσταση με ήχο, όπως η νυχτερίδα.</p>
<ol>
  <li>Η πλακέτα δίνει παλμό στο <strong>TRIG (GPIO 5)</strong>: 1 για <strong>10 µs</strong>, μετά 0.</li>
  <li>Ο ήχος πάει στο εμπόδιο και γυρίζει. Όσο ταξιδεύει, το <strong>ECHO (GPIO 18)</strong> είναι 1.</li>
  <li>Το <code>time_pulse_us(echo, 1, 30000)</code> μετρά πόσα µs έμεινε 1 το ECHO.</li>
</ol>
<p>Για 1 cm ο ήχος πάει και έρχεται σε περίπου <strong>58,3 µs</strong>:</p>
<pre>cm = us / 58.3          # ή: cm = us * 0.0343 / 2</pre>
<p>Το <code>time_pulse_us</code> είναι στο <code>machine</code>: <code>from machine import Pin, time_pulse_us</code>.</p>
<p><strong>Ασφάλεια σε αληθινή πλακέτα:</strong> το ECHO του κλασικού HC-SR04 βγάζει <strong>5 V</strong>, ενώ τα pins του ESP32 αντέχουν <strong>3,3 V</strong>. Βάλε διαιρέτη τάσης, ή χρησιμοποίησε την έκδοση HC-SR04P που δουλεύει στα 3,3 V.</p>`,
      glossary: ['HC-SR04', 'TRIG / ECHO', 'time_pulse_us', 'sleep_us', 'διαιρέτης τάσης', 'µs (μικροδευτερόλεπτο)'],
      supportedSyntax: SYNTAX,
      initialCode: L1_CODE('____'),
      solution: L1_CODE('time_pulse_us(echo, 1, 30000)'),
      world: { distance: 35 }, initialWorld: { distance: 35 },
      hardware: ['ultrasonic'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Διάβασε τις γραμμές με το trig: αυτός είναι ο παλμός που ξεκινά τη μέτρηση.',
        'Συμπλήρωσε το κενό με την εντολή που μετρά την ηχώ στο echo.',
        'Τρέξε. Σύρε το αυτοκινητάκι. Αλλάζει η απόσταση;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το time_pulse_us επιστρέφει 1166. Πόσο μακριά είναι το εμπόδιο;',
        options: ['Περίπου 20 cm', 'Περίπου 58 cm', 'Περίπου 1166 cm'],
        answer: 0,
        explain: 'Σωστά. 1166 ÷ 58,3 = 20 cm.',
        retry: 'Όχι ακόμα. Διαίρεσε τα µs με το 58,3.'
      },
      hints: [
        'Η διάρκεια της ηχούς μετριέται με μία εντολή του machine που «ακούει» το echo.',
        'Η εντολή είναι time_pulse_us. Θέλει: το pin, ποια στάθμη μετράμε (1), και όριο χρόνου σε µs.',
        'us = time_pulse_us(echo, 1, 30000)\n• echo = το pin της ηχούς\n• 1 = μέτρα πόσο έμεινε 1\n• 30000 = όριο σε µs'
      ],
      validationTests: [
        { name: 'Εμπόδιο στα 35 cm → «Distance: 35.0 cm»', world: { distance: 35 }, script: [
          { setup: true }, { loops: 3 },
          { check: 'count', text: 'Distance: 35.0 cm', is: 3, fail: 'Σε 3 επαναλήψεις τυπώθηκε {n} φορές «Distance: 35.0 cm». Περίμενα 3.', failZero: 'Δεν τυπώθηκε «Distance: 35.0 cm». Μετράς την ηχώ με time_pulse_us(echo, 1, 30000);' }
        ] },
        { name: 'Η μέτρηση ακολουθεί το εμπόδιο', script: [
          { setup: true }, { loops: 1 }, at(80), { loops: 1 },
          { check: 'lastLine', is: 'Distance: 80.0 cm', fail: 'Με εμπόδιο στα 80 cm η τελευταία γραμμή είναι {v}. Περίμενα «Distance: 80.0 cm».' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα μετρά απόσταση σε MicroPython! Το time_pulse_us κάνει τη δουλειά του pulseIn της C++.',
      remediation: 'Αν βλέπεις αρνητική απόσταση, δεν ήρθε ηχώ: έλεγξε ότι μετράς το echo (GPIO 18) και ότι ο παλμός TRIG κρατά 10 µs.'
    }),

    Object.assign({}, BASE, {
      id: 'c35-l2', kind: 'guided', skills: ['micropython', 'sensors', 'conditions'],
      title: 'Όταν δεν έρχεται ηχώ: αρνητική τιμή',
      prerequisites: ['c35-l1'],
      objectives: ['Να αναγνωρίζω το timeout του time_pulse_us.', 'Να τυπώνω καθαρό μήνυμα αντί για ψεύτικη απόσταση.'],
      theory: `
<p>Αν <strong>δεν έρθει ηχώ</strong> μέσα στο όριο (30000 µs), το <code>time_pulse_us</code> δεν δίνει απόσταση. Δίνει <strong>αρνητικό αριθμό</strong>:</p>
<ul>
  <li><code>-1</code>: ο παλμός δεν ξεκίνησε ποτέ,</li>
  <li><code>-2</code>: ξεκίνησε αλλά δεν τελείωσε στην ώρα του.</li>
</ul>
<p>Πότε γίνεται αυτό; Το εμπόδιο είναι πολύ μακριά (πάνω από ~4 m) ή πολύ κοντά (κάτω από 2 cm), ή ένα καλώδιο είναι λάθος.</p>
<p>Το <code>-1 / 58.3</code> δίνει «-0.0 cm». Αυτό είναι <strong>ψέμα</strong>: δεν ξέρουμε την απόσταση. Σωστό:</p>
<pre>if us &lt; 0:
    print("No echo")</pre>
<p>Ελέγχεις <code>us &lt; 0</code>, όχι <code>us == -1</code>: έτσι πιάνεις και τις δύο περιπτώσεις.</p>`,
      glossary: ['time_pulse_us', 'timeout', 'TRIG / ECHO'],
      supportedSyntax: SYNTAX,
      initialCode: L2_CODE(L2_BAD),
      solution: L2_CODE(L2_GOOD),
      world: { distance: 35 }, initialWorld: { distance: 35 },
      hardware: ['ultrasonic'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Πρόσθεσε το if us < 0: με print("No echo").',
        'Βάλε τον υπολογισμό και το print της απόστασης στο else.',
        'Τρέξε. Πήγαινε το αυτοκινητάκι πολύ κοντά (κάτω από 2 cm). Τι γράφει;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το εμπόδιο είναι στα 6 μέτρα. Τι επιστρέφει το time_pulse_us(echo, 1, 30000);',
        options: ['Αρνητικό αριθμό: δεν ήρθε ηχώ', 'Περίπου 35000', 'Μηδέν'],
        answer: 0,
        explain: 'Σωστά. Το HC-SR04 μετρά μέχρι ~4 m. Πιο μακριά δεν έρχεται χρήσιμη ηχώ και η MicroPython δίνει αρνητική τιμή.',
        retry: 'Όχι ακόμα. Τι λέει η θεωρία για την περίπτωση που δεν έρχεται ηχώ;'
      },
      hints: [
        'Πριν υπολογίσεις cm, έλεγξε αν το us είναι αρνητικό.',
        'if us < 0: print("No echo") — else: ο υπολογισμός και το print της απόστασης.',
        'if us < 0:\n    print("No echo")\nelse:\n    cm = us / 58.3\n    print(f"Distance: {cm:.1f} cm")'
      ],
      validationTests: [
        { name: 'Εμπόδιο έξω από την εμβέλεια → «No echo»', world: { distance: 450 }, script: [
          { setup: true }, { loops: 2 },
          { check: 'lastLine', is: 'No echo', fail: 'Με εμπόδιο στα 450 cm η τελευταία γραμμή είναι {v}. Περίμενα «No echo».' },
          { check: 'serialNot', text: 'Distance: -', fail: 'Τυπώθηκε αρνητική απόσταση. Όταν us < 0, τύπωσε «No echo».' }
        ] },
        { name: 'Κανονική μέτρηση στα 35 cm', script: [
          { setup: true }, { loops: 2 },
          { check: 'lastLine', is: 'Distance: 35.0 cm', fail: 'Με εμπόδιο στα 35 cm η τελευταία γραμμή είναι {v}. Περίμενα «Distance: 35.0 cm».' }
        ] }
      ],
      explanationOnSuccess: 'Ο αισθητήρας λέει την αλήθεια: «δεν ξέρω» αντί για ψεύτικο αριθμό. Σε ένα αυτοκίνητο, το «-0.0 cm» θα έκανε τον οδηγό να φρενάρει χωρίς λόγο.',
      remediation: 'Αν βλέπεις και «No echo» και απόσταση στην ίδια επανάληψη, το print της απόστασης δεν είναι μέσα στο else.'
    }),

    Object.assign({}, BASE, {
      id: 'c35-l3', kind: 'guided', skills: ['micropython', 'conditions', 'io'],
      title: 'Φανάρι με τρία Pin',
      prerequisites: ['c35-l2'],
      objectives: ['Να ελέγχω τρία φώτα με τρία Pin(…, Pin.OUT).', 'Να διαλέγω φως με if / elif / else.', 'Να χρησιμοποιώ συνάρτηση που ανάβει ακριβώς ένα φως.'],
      theory: `
<p>Το φανάρι έχει τρία LED:</p>
<ul>
  <li>κόκκινο → <strong>GPIO 25</strong></li>
  <li>κίτρινο → <strong>GPIO 26</strong></li>
  <li>πράσινο → <strong>GPIO 27</strong></li>
</ul>
<p>Η <code>set_light(r, y, g)</code> ανάβει ακριβώς όσα φώτα ζητάς. Π.χ. <code>set_light(0, 1, 0)</code> = μόνο κίτρινο.</p>
<p>Η <code>measure()</code> επιστρέφει cm, ή <code>None</code> όταν δεν ήρθε ηχώ.</p>
<p>Ζώνες του γκαράζ:</p>
<ul>
  <li><strong>50 cm και πάνω</strong> → πράσινο</li>
  <li><strong>20 έως 50</strong> → κίτρινο</li>
  <li><strong>κάτω από 20</strong> → κόκκινο</li>
</ul>
<p>Με <code>if / elif / else</code> ελέγχεις από το μεγαλύτερο όριο προς το μικρότερο.</p>`,
      glossary: ['elif', 'όριο', 'None'],
      supportedSyntax: SYNTAX,
      initialCode: L3_CODE(L3_BAD),
      solution: L3_CODE(L3_GOOD),
      world: { distance: 80 }, initialWorld: { distance: 80 },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τα δύο όρια: 50 και 20.',
        'Συμπλήρωσε το set_light για «μόνο κόκκινο».',
        'Τρέξε. Σύρε το αυτοκινητάκι σιγά σιγά πιο κοντά.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η απόσταση είναι 50.0 cm. Ποιο φως ανάβει με το σωστό πρόγραμμα;',
        options: ['Πράσινο', 'Κίτρινο', 'Κόκκινο'],
        answer: 0,
        explain: 'Σωστά. Η συνθήκη cm >= 50 ισχύει για 50.0, άρα ανάβει το πράσινο.',
        retry: 'Όχι ακόμα. Το >= σημαίνει «μεγαλύτερο ή ίσο».'
      },
      hints: [
        'Τα όρια είναι στη θεωρία: 50 και 20. Το κόκκινο είναι το πρώτο από τα τρία φώτα.',
        'Η σειρά των ορισμάτων είναι (κόκκινο, κίτρινο, πράσινο). Για μόνο κόκκινο: 1, 0, 0.',
        'if cm >= 50:\n    set_light(0, 0, 1)\nelif cm >= 20:\n    set_light(0, 1, 0)\nelse:\n    set_light(1, 0, 0)'
      ],
      validationTests: [
        { name: 'Μακριά (80 cm) → πράσινο', script: [{ setup: true }, at(80), { loops: 1 }, lightStep(80, false, false, true, 'πράσινο')] },
        { name: 'Στη μέση (35 cm) → κίτρινο', script: [{ setup: true }, at(35), { loops: 1 }, lightStep(35, false, true, false, 'κίτρινο')] },
        { name: 'Κοντά (10 cm) → κόκκινο', script: [{ setup: true }, at(10), { loops: 1 }, lightStep(10, true, false, false, 'κόκκινο')] },
        { name: 'Το φανάρι ακολουθεί το αυτοκίνητο', script: [
          { setup: true }, { sequence: { distance: [120, 60, 40, 15] } },
          lightStep(15, true, false, false, 'κόκκινο'),
          at(70), { loops: 1 }, lightStep(70, false, false, true, 'πράσινο')
        ] }
      ],
      explanationOnSuccess: 'Το φανάρι δουλεύει! Η set_light σβήνει πάντα τα άλλα φώτα, οπότε δεν μένει ποτέ «ξεχασμένο» φως αναμμένο.',
      remediation: 'Αν ανάβουν δύο φώτα μαζί, έλεγξε τα τρία ορίσματα του set_light. Αν ανάβει λάθος ζώνη, έλεγξε τη σειρά των ορίων: πρώτα το 50.'
    }),

    Object.assign({}, BASE, {
      id: 'c35-l4', kind: 'debug', skills: ['micropython', 'sensors', 'io', 'conditions'],
      title: 'Βρες τα λάθη: το γκαράζ που μπερδεύεται',
      prerequisites: ['c35-l3'],
      objectives: ['Να βρίσκω πολύ σύντομο παλμό TRIG.', 'Να βρίσκω έξοδο ρυθμισμένη ως είσοδο.', 'Να ξεχωρίζω το if / if από το if / elif.'],
      theory: `
<p>Τρία παράπονα, τρία λάθη. Ψάξε ένα τη φορά:</p>
<ol>
  <li>«Γράφει συνέχεια No echo.» → Πόσο κρατά ο παλμός TRIG; Το HC-SR04 θέλει <strong>10 µs</strong>.</li>
  <li>«Το κίτρινο δεν ανάβει ποτέ.» → Ένα φως είναι <strong>έξοδος</strong>. Κοίτα πώς φτιάχτηκε το κάθε Pin.</li>
  <li>«Πολύ κοντά ανάβουν δύο φώτα μαζί.» → Δύο χωριστά <code>if</code> ελέγχονται <strong>και τα δύο</strong>. Στα 10 cm ισχύει και το <code>cm &lt; 20</code> και το <code>cm &lt; 50</code>.</li>
</ol>
<p>Διάβασε τις <strong>προειδοποιήσεις</strong>: λένε πόσα µs κράτησε ο παλμός και ποιο pin είναι λάθος.</p>`,
      glossary: ['TRIG / ECHO', 'sleep_us', 'Pin.OUT / Pin.IN', 'elif'],
      supportedSyntax: SYNTAX,
      initialCode: L4_CODE(L4_BAD),
      solution: L4_CODE(L4_GOOD),
      world: { distance: 35 }, initialWorld: { distance: 35 },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε. Διάβασε την προειδοποίηση για τον παλμό TRIG και διόρθωσέ τον.',
        'Τρέξε ξανά στα 35 cm. Ανάβει το κίτρινο; Κοίτα τη γραμμή του yellow.',
        'Πήγαινε στα 10 cm. Πόσα φώτα ανάβουν; Διόρθωσε τη συνθήκη.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Με if cm < 20: … και μετά ΧΩΡΙΣΤΟ if cm < 50: … else: …, τι ανάβει στα 10 cm;',
        options: ['Κόκκινο και κίτρινο', 'Μόνο κόκκινο', 'Κόκκινο και πράσινο'],
        answer: 0,
        explain: 'Σωστά. Το πρώτο if ανάβει το κόκκινο. Μετά το δεύτερο if ελέγχεται κι αυτό: 10 < 50, άρα ανάβει και το κίτρινο.',
        retry: 'Όχι ακόμα. Δύο χωριστά if ελέγχονται και τα δύο. Ισχύει το 10 < 50;'
      },
      hints: [
        'Λάθος 1 στη measure(), λάθος 2 στις γραμμές με τα Pin, λάθος 3 στο δεύτερο if του βρόχου.',
        'time.sleep_us(10) για τον παλμό. yellow = Pin(26, Pin.OUT). Και το δεύτερο if γίνεται elif.',
        'time.sleep_us(10)\n…\nyellow = Pin(26, Pin.OUT)\n…\nif cm < 20:\n    red.on()\nelif cm < 50:\n    yellow.on()\nelse:\n    green.on()'
      ],
      validationTests: [
        { name: 'Μετρά κανονικά (όχι «No echo»)', script: [
          { setup: true }, { loops: 2 },
          { check: 'lastLine', is: 'Distance: 35.0 cm', fail: 'Στα 35 cm η τελευταία γραμμή είναι {v}. Περίμενα «Distance: 35.0 cm». Πόσο κρατά ο παλμός TRIG;' }
        ] },
        { name: 'Στα 35 cm → μόνο κίτρινο', script: [{ setup: true }, at(35), { loops: 1 }, lightStep(35, false, true, false, 'κίτρινο')] },
        { name: 'Στα 10 cm → μόνο κόκκινο', script: [{ setup: true }, at(10), { loops: 1 }, lightStep(10, true, false, false, 'κόκκινο')] },
        { name: 'Στα 90 cm → μόνο πράσινο', script: [{ setup: true }, at(90), { loops: 1 }, lightStep(90, false, false, true, 'πράσινο')] }
      ],
      explanationOnSuccess: 'Και τα τρία λάθη διορθώθηκαν! Το if / if αντί για if / elif είναι από τα πιο συχνά λάθη. Δεν βγάζει μήνυμα, απλώς κάνει «περισσότερα» απ’ όσα θέλεις.',
      remediation: 'Αν ακόμα γράφει «No echo», ο παλμός είναι κάτω από 8 µs. Αν το κίτρινο μένει σβηστό, το Pin(26) δεν είναι Pin.OUT.'
    }),

    Object.assign({}, BASE, {
      id: 'c35-l5', kind: 'checkpoint', skills: ['micropython', 'sensors', 'io', 'conditions', 'state'],
      title: 'Έλεγχος κεφαλαίου: ο αισθητήρας στάθμευσης',
      prerequisites: ['c35-l4'],
      objectives: ['Να γράφω μόνος μου measure() με χειρισμό timeout.', 'Να συνδυάζω τέσσερις ζώνες με if / elif.', 'Να αναβοσβήνω ένα φως με μεταβλητή κατάστασης.'],
      theory: `
<p>Το τελικό έργο του κλάδου: ένας πλήρης αισθητήρας στάθμευσης. Μέτρηση κάθε 100 ms.</p>
<ul>
  <li><code>None</code> (καμία ηχώ) → όλα σβηστά και <code>print("No echo")</code></li>
  <li><strong>50 cm και πάνω</strong> → πράσινο</li>
  <li><strong>20 έως 50</strong> → κίτρινο</li>
  <li><strong>10 έως 20</strong> → κόκκινο</li>
  <li><strong>κάτω από 10</strong> → <code>print("STOP")</code> και το κόκκινο <strong>αναβοσβήνει</strong></li>
</ul>
<p>Αναβόσβημα με μια μεταβλητή <code>blink_on</code>:</p>
<ul>
  <li>Κάτω από 10 cm, σε κάθε γύρο: <code>blink_on = not blink_on</code>. Ο 1ος γύρος ανάβει, ο 2ος σβήνει…</li>
  <li>Σε κάθε άλλη ζώνη: <code>blink_on = False</code>. Έτσι το επόμενο «STOP» ξεκινά πάντα με αναμμένο κόκκινο.</li>
</ul>`,
      glossary: ['HC-SR04', 'time_pulse_us', 'κατάσταση (state)', 'None'],
      supportedSyntax: SYNTAX,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: { distance: 100 }, initialWorld: { distance: 100 },
      hardware: HW, panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Γράψε τη measure() (μπορείς να ξεκινήσεις από τις προηγούμενες ασκήσεις).',
        'Γράψε τις πέντε περιπτώσεις στο while True.',
        'Τρέξε και σύρε το αυτοκινητάκι μέχρι τα 5 cm. Αναβοσβήνει το κόκκινο;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το αυτοκίνητο μένει στα 5 cm για 3 γύρους. Πώς είναι το κόκκινο στον 1ο, 2ο και 3ο γύρο;',
        options: ['Αναμμένο, σβηστό, αναμμένο', 'Αναμμένο και στους τρεις', 'Σβηστό, αναμμένο, σβηστό'],
        answer: 0,
        explain: 'Σωστά. Το blink_on ξεκινά False και αλλάζει σε κάθε γύρο: True, False, True.',
        retry: 'Όχι ακόμα. Το blink_on είναι False πριν το STOP. Τι γίνεται με το not σε κάθε γύρο;'
      },
      hints: [
        'Μία αλυσίδα if / elif / elif / elif / else: πρώτα το None, μετά από το μεγαλύτερο όριο στο μικρότερο.',
        'Σε κάθε ζώνη εκτός από το STOP γράψε blink_on = False. Στο else: print("STOP"), blink_on = not blink_on, set_light(1 if blink_on else 0, 0, 0).',
        'if cm is None:\n    set_light(0, 0, 0)\n    print("No echo")\n    blink_on = False\nelif cm >= 50:\n    set_light(0, 0, 1)\n    blink_on = False\nelif cm >= 20:\n    …\nelif cm >= 10:\n    …\nelse:\n    print("STOP")\n    blink_on = not blink_on\n    set_light(1 if blink_on else 0, 0, 0)'
      ],
      validationTests: [
        { name: 'Τρεις ζώνες: πράσινο, κίτρινο, κόκκινο', script: [
          { setup: true },
          at(80), { loops: 1 }, lightStep(80, false, false, true, 'πράσινο'),
          at(35), { loops: 1 }, lightStep(35, false, true, false, 'κίτρινο'),
          at(15), { loops: 1 }, lightStep(15, true, false, false, 'κόκκινο')
        ] },
        { name: 'Κάτω από 10 cm → «STOP» και κόκκινο που αναβοσβήνει', script: [
          { setup: true }, at(60), { loops: 1 }, at(5), { loops: 1 },
          { check: 'serialHas', text: 'STOP', fail: 'Στα 5 cm δεν τυπώθηκε «STOP». Τελευταίες γραμμές: {v}.' },
          lightStep(5, true, false, false, 'κόκκινο (1ος γύρος)'),
          { loops: 1 },
          { check: 'lights', red: false, yellow: false, green: false, fail: 'Στον 2ο γύρο στα 5 cm το φανάρι δείχνει: {v}. Περίμενα όλα σβηστά (το κόκκινο αναβοσβήνει).' },
          { loops: 1 },
          lightStep(5, true, false, false, 'κόκκινο (3ος γύρος)')
        ] },
        { name: 'Καμία ηχώ → όλα σβηστά, «No echo»', script: [
          { setup: true }, at(80), { loops: 1 }, at(450), { loops: 1 },
          { check: 'lastLine', is: 'No echo', fail: 'Χωρίς ηχώ η τελευταία γραμμή είναι {v}. Περίμενα «No echo».' },
          { check: 'lights', red: false, yellow: false, green: false, fail: 'Χωρίς ηχώ το φανάρι δείχνει: {v}. Περίμενα όλα σβηστά.' }
        ] },
        { name: 'Μέτρηση κάθε 100 ms', script: [
          { setup: true }, at(5), { ms: 1050 },
          { check: 'count', text: 'STOP', min: 9, max: 11, fail: 'Σε 1 δευτερόλεπτο στα 5 cm τυπώθηκε {n} φορές «STOP». Περίμενα περίπου 10 (μία μέτρηση κάθε 100 ms).' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες τον κλάδο MicroPython! Pins, συνθήκες, συναρτήσεις, αισθητήρες, WiFi, MQTT και τώρα ένας πλήρης αισθητήρας στάθμευσης. Όλα τρέχουν και σε αληθινό ESP32, ως main.py.',
      remediation: 'Αν το κόκκινο δεν αναβοσβήνει, έλεγξε ότι το blink_on αλλάζει μόνο στο else και ότι γίνεται False στις άλλες ζώνες.'
    })
  );
})(typeof window !== 'undefined' ? window : globalThis);
