/*
 * IoT Guardian — Κεφάλαιο 18 (Μέρος Β): GPIO με gpiozero: LED, κουμπί, κίνηση.
 * Pins του εικονικού Raspberry Pi (BCM): LED 17, κουμπί 27, PIR 4.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 18, title: 'GPIO με gpiozero: LED, κουμπί, κίνηση', ready: true, unlockAfter: 17, lang: 'python' });

  [
    { term: 'gpiozero', def: 'Βιβλιοθήκη Python για τα pins του Raspberry Pi. Κάθε εξάρτημα είναι ένα αντικείμενο: LED(17), Button(27), MotionSensor(4).' },
    { term: 'import', def: 'Φέρνει έτοιμο κώδικα από μια βιβλιοθήκη. Π.χ. from gpiozero import LED ή import time. Μοιάζει με το #include της C++.' },
    { term: 'BCM (αρίθμηση pins)', def: 'Ο τρόπος που αριθμεί τα pins το gpiozero: με τον αριθμό GPIO, όχι με τη θέση του ακροδέκτη στην πλακέτα. Το LED(17) είναι το GPIO 17.' },
    { term: 'time.sleep', def: 'Το πρόγραμμα περιμένει όσα δευτερόλεπτα του πεις, π.χ. time.sleep(0.5) για μισό δευτερόλεπτο. Είναι σαν το delay(500) της C++, αλλά σε δευτερόλεπτα.' },
    { term: 'while True', def: 'Βρόχος που δεν τελειώνει ποτέ. Στην Python παίζει τον ρόλο του loop() της C++.' },
    { term: 'polling', def: 'Ο τρόπος όπου το πρόγραμμα ρωτά ξανά και ξανά «πατήθηκε;», μέσα σε έναν βρόχο.' },
    { term: 'callback', def: 'Μια συνάρτηση που δίνεις σε κάποιον να την καλέσει αργότερα, όταν συμβεί κάτι. Π.χ. btn.when_pressed = toggle (χωρίς παρενθέσεις).' },
    { term: 'pause()', def: 'Από το module signal. Κρατά το πρόγραμμα ζωντανό για πάντα, ώστε να τρέχουν τα callbacks.' },
    { term: 'global', def: 'Λέξη μέσα σε συνάρτηση: «η μεταβλητή αυτή είναι του προγράμματος, όχι τοπική». Χρειάζεται όταν η συνάρτηση αλλάζει την τιμή της.' },
    { term: 'time.monotonic()', def: 'Δίνει τα δευτερόλεπτα από ένα σταθερό σημείο, με δεκαδικά. Μετρά μόνο προς τα εμπρός. Είναι σαν το millis() της C++, αλλά σε δευτερόλεπτα.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX_1 = 'from gpiozero import LED, LED(17), led.on(), led.off(), import time, time.sleep(s), while True:';
  const SYNTAX_2 = SYNTAX_1 + ', Button(27), btn.is_pressed, if/else';
  const SYNTAX_3 = SYNTAX_2 + ', btn.when_pressed = συνάρτηση, led.toggle(), led.is_lit, def, global, from signal import pause, pause()';
  const SYNTAX_4 = SYNTAX_2 + ', MotionSensor(4), pir.motion_detected, led.is_lit, time.monotonic(), and/not';
  const PANELS = ['serial', 'vars', 'loops'];
  const WORLD = { button: false, pir: false };

  // ------------------------------------------------------------ 18.1
  const L1_INITIAL = `from gpiozero import LED
import time

led = ____(17)        # ΣΥΜΠΛΗΡΩΣΕ: το LED στο GPIO 17

while True:
    led.on()
    print("ON")
    time.sleep(0.5)   # μισό δευτερόλεπτο
    ____              # ΣΥΜΠΛΗΡΩΣΕ: σβήσε το LED
    print("OFF")
    time.sleep(0.5)
`;
  const L1_SOLUTION = `from gpiozero import LED
import time

led = LED(17)         # το LED στο GPIO 17

while True:
    led.on()
    print("ON")
    time.sleep(0.5)   # μισό δευτερόλεπτο
    led.off()
    print("OFF")
    time.sleep(0.5)
`;

  // ------------------------------------------------------------ 18.2
  const L2_INITIAL = `from gpiozero import LED, Button
import time

led = LED(17)
btn = Button(27)

while True:
    if ____:              # ΣΥΜΠΛΗΡΩΣΕ: είναι πατημένο το κουμπί;
        led.on()
    else:
        ____              # ΣΥΜΠΛΗΡΩΣΕ: αλλιώς σβήσε το LED
    time.sleep(0.05)      # μικρή αναμονή: 20 έλεγχοι το δευτερόλεπτο
`;
  const L2_SOLUTION = `from gpiozero import LED, Button
import time

led = LED(17)
btn = Button(27)

while True:
    if btn.is_pressed:
        led.on()
    else:
        led.off()
    time.sleep(0.05)      # μικρή αναμονή: 20 έλεγχοι το δευτερόλεπτο
`;

  // ------------------------------------------------------------ 18.3
  const L3_HEAD = `from gpiozero import LED, Button
from signal import pause

led = LED(17)
btn = Button(27)
presses = 0

def toggle():
    global presses        # αλλάζουμε τη μεταβλητή του προγράμματος
    presses += 1
    led.toggle()
    state = "ON" if led.is_lit else "OFF"
    print(f"Πάτημα {presses}: LED {state}")

`;
  const L3_INITIAL = L3_HEAD + `____ = toggle          # ΣΥΜΠΛΗΡΩΣΕ: «όταν πατηθεί το κουμπί»
print("Έτοιμο. Πάτα το κουμπί.")
____                   # ΣΥΜΠΛΗΡΩΣΕ: περίμενε για πάντα
`;
  const L3_SOLUTION = L3_HEAD + `btn.when_pressed = toggle    # το όνομα, ΧΩΡΙΣ παρενθέσεις
print("Έτοιμο. Πάτα το κουμπί.")
pause()
`;

  // ------------------------------------------------------------ 18.4
  const L4_INITIAL = `# Φως νυκτός: ανάβει με κίνηση και μένει αναμμένο
# 5 δευτερόλεπτα μετά την ΤΕΛΕΥΤΑΙΑ κίνηση.
from gpiozero import LED, MotionSensor
import time

led = LED(17)
pir = MotionSensor(4)
ON_TIME = 5          # δευτερόλεπτα μετά την τελευταία κίνηση

while True:
    if pir.motion_detected:
        led.on()
    else:
        led.off()
    time.sleep(0.1)
`;
  const L4_SOLUTION = `# Φως νυκτός: ανάβει με κίνηση και μένει αναμμένο
# 5 δευτερόλεπτα μετά την ΤΕΛΕΥΤΑΙΑ κίνηση.
from gpiozero import LED, MotionSensor
import time

led = LED(17)
pir = MotionSensor(4)
ON_TIME = 5          # δευτερόλεπτα μετά την τελευταία κίνηση
last_motion = 0      # πότε είδαμε κίνηση τελευταία φορά

while True:
    now = time.monotonic()
    if pir.motion_detected:
        last_motion = now            # κάθε κίνηση «ξαναμηδενίζει» το χρονόμετρο
        if not led.is_lit:
            led.on()
            print("Φως ON")
    elif led.is_lit and now - last_motion >= ON_TIME:
        led.off()
        print("Φως OFF")
    time.sleep(0.1)
`;

  // ------------------------------------------------------------ 18.5
  const L5_INITIAL = `# Διακόπτης με κουμπί: κάθε πάτημα αλλάζει το LED.
# Παράπονο: «το LED δεν ανάβει ποτέ και βγαίνει λάθος».
from gpiozero import LED, Button
from signal import pause

led = LED(18)
btn = Button(27)
presses = 0

def toggle():
    presses += 1
    led.toggle()
    print(f"Πάτημα {presses}")

btn.when_pressed = toggle()
print("Έτοιμο")
pause()
`;
  const L5_SOLUTION = `# Διακόπτης με κουμπί: κάθε πάτημα αλλάζει το LED.
# Παράπονο: «το LED δεν ανάβει ποτέ και βγαίνει λάθος».
from gpiozero import LED, Button
from signal import pause

led = LED(17)
btn = Button(27)
presses = 0

def toggle():
    global presses
    presses += 1
    led.toggle()
    print(f"Πάτημα {presses}")

btn.when_pressed = toggle
print("Έτοιμο")
pause()
`;

  // Ένα πάτημα: κουμπί κάτω για 200 ms, μετά πάνω για 200 ms (με pause() μετράμε σε ms).
  const PRESS = [{ set: { button: true } }, { ms: 200 }, { set: { button: false } }, { ms: 200 }];

  L.lessons.push(
    {
      id: 'c18-l1', chapter: 18, kind: 'micro', lang: 'python', skills: ['python', 'io', 'timing'],
      title: 'Άναψε το LED από την Python',
      prerequisites: [],
      objectives: ['Να φέρνω το LED από τη βιβλιοθήκη gpiozero.', 'Να ανάβω και να σβήνω το LED με led.on() και led.off().', 'Να κάνω βρόχο για πάντα με while True: και time.sleep.'],
      theory: `
<p>Στη C++ γράφαμε <code>pinMode</code> και <code>digitalWrite</code>. Στην Python, η βιβλιοθήκη <strong>gpiozero</strong> τα κάνει για σένα:</p>
<pre>from gpiozero import LED
led = LED(17)      # το LED στο GPIO 17
led.on()           # ανάβει
led.off()          # σβήνει</pre>
<p>Το <code>LED(17)</code> ρυθμίζει μόνο του το pin ως έξοδο. Δεν χρειάζεται <code>pinMode</code>.</p>
<p>Δεν υπάρχει <code>loop()</code>. Για να επαναλαμβάνεται κάτι για πάντα, γράφεις:</p>
<pre>while True:
    …</pre>
<p>Για αναμονή: <code>time.sleep(0.5)</code>. Προσοχή: σε <strong>δευτερόλεπτα</strong>, όχι ms. Το <code>delay(500)</code> της C++ είναι <code>time.sleep(0.5)</code>.</p>
<p>Στο εικονικό Pi: <strong>LED 17</strong>, κουμπί 27, PIR 4.</p>`,
      glossary: ['gpiozero', 'import', 'BCM (αρίθμηση pins)', 'while True', 'time.sleep'],
      supportedSyntax: SYNTAX_1,
      initialCode: L1_INITIAL,
      solution: L1_SOLUTION,
      world: WORLD, initialWorld: WORLD,
      hardware: [], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το πρώτο κενό: ποιο αντικείμενο φέραμε από το gpiozero;',
        'Συμπλήρωσε το δεύτερο κενό: η εντολή που σβήνει το LED.',
        'Τρέξε. Δες το LED να αναβοσβήνει και τον πίνακα «Επαναλήψεις» να μετρά. Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Στη C++ γράφαμε delay(500). Τι γράφουμε στην Python για την ίδια αναμονή;',
        options: ['time.sleep(0.5)', 'time.sleep(500)', 'delay(0.5)'],
        answer: 0,
        explain: 'Σωστά. Το time.sleep μετρά σε δευτερόλεπτα: 500 ms = 0.5 s. Με time.sleep(500) το πρόγραμμα θα περίμενε πάνω από 8 λεπτά.',
        retry: 'Όχι ακόμα. Το time.sleep μετρά σε δευτερόλεπτα. Πόσα δευτερόλεπτα είναι 500 ms;'
      },
      hints: [
        'Το πρώτο κενό είναι το όνομα από τη γραμμή from gpiozero import …',
        'Ανάβεις με led.on(). Με τον ίδιο τρόπο, ποια μέθοδος σβήνει; Μην ξεχάσεις τις παρενθέσεις ().',
        'led = LED(17)\n…\n    led.off()\nΗ γραμμή led.off() έχει την ίδια εσοχή με τις άλλες μέσα στο while.'
      ],
      validationTests: [
        { name: 'Το LED ανάβει στην αρχή κάθε γύρου', script: [
          { setup: true }, { ms: 250 },
          { check: 'led', is: true, fail: 'Μετά από 0,25 s το LED είναι {v}. Περίμενα αναμμένο. Δημιούργησες το LED με LED(17);' }
        ] },
        { name: 'Το LED σβήνει μετά από μισό δευτερόλεπτο', script: [
          { setup: true }, { ms: 750 },
          { check: 'led', is: false, fail: 'Μετά από 0,75 s το LED είναι {v}. Περίμενα σβηστό. Λείπει το led.off();' }
        ] },
        { name: 'Αναβοσβήνει: ON και OFF σε κάθε γύρο', script: [
          { setup: true }, { loops: 3 },
          { check: 'count', text: 'ON', is: 3, fail: 'Σε 3 γύρους το «ON» τυπώθηκε {n} φορές. Περίμενα 3.' },
          { check: 'count', text: 'OFF', is: 3, fail: 'Σε 3 γύρους το «OFF» τυπώθηκε {n} φορές. Περίμενα 3.' }
        ] },
        { name: 'Ένας γύρος κρατά 1 δευτερόλεπτο', script: [
          { setup: true }, { ms: 1800 },
          { check: 'count', text: 'ON', is: 2, fail: 'Σε 1,8 s το «ON» τυπώθηκε {n} φορές. Περίμενα 2 (στα 0 και 1 s). Έλεγξε ότι το time.sleep έχει 0.5, σε δευτερόλεπτα.' }
        ] }
      ],
      explanationOnSuccess: 'Το LED αναβοσβήνει από την Python. Το LED(17) έκανε μόνο του τη δουλειά του pinMode, και το while True: πήρε τη θέση του loop(). Κάθε γύρος του while φαίνεται στον πίνακα «Επαναλήψεις».',
      remediation: 'Αν βλέπεις NameError: name \'LED\' is not defined, έλεγξε ότι η πρώτη γραμμή είναι from gpiozero import LED.'
    },

    {
      id: 'c18-l2', chapter: 18, kind: 'guided', lang: 'python', skills: ['python', 'io', 'conditions'],
      title: 'Κουμπί με polling',
      prerequisites: ['c18-l1'],
      objectives: ['Να διαβάζω ένα κουμπί με btn.is_pressed.', 'Να ανάβω το LED όσο το κουμπί είναι πατημένο.', 'Να βάζω μικρή αναμονή μέσα στο while True.'],
      theory: `
<p>Στη C++ γράφαμε <code>if (digitalRead(BUTTON_PIN) == HIGH)</code>. Στην Python:</p>
<pre>from gpiozero import Button
btn = Button(27)

if btn.is_pressed:
    …</pre>
<ul>
  <li>Το <code>btn.is_pressed</code> είναι <code>True</code> όσο το κουμπί είναι πατημένο, αλλιώς <code>False</code>.</li>
  <li>Δεν έχει παρενθέσεις: είναι <strong>ιδιότητα</strong>, όχι εντολή.</li>
</ul>
<p>Το πρόγραμμα ρωτά το κουμπί <strong>ξανά και ξανά</strong> μέσα στο <code>while True</code>. Αυτό λέγεται <strong>polling</strong>.</p>
<p>Βάζουμε πάντα μικρή αναμονή, π.χ. <code>time.sleep(0.05)</code>. Χωρίς αυτήν, ο βρόχος τρέχει χιλιάδες φορές το δευτερόλεπτο χωρίς λόγο και «τρώει» όλο τον επεξεργαστή του Pi.</p>`,
      glossary: ['polling', 'while True', 'gpiozero'],
      supportedSyntax: SYNTAX_2,
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      world: WORLD, initialWorld: WORLD,
      hardware: ['button'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τη συνθήκη: είναι πατημένο το κουμπί;',
        'Συμπλήρωσε το else: σβήσε το LED.',
        'Τρέξε. Κράτα πατημένο το κουμπί της πλακέτας και άφησέ το. Ακολουθεί το LED;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι γράφει η Python για το digitalRead(BUTTON_PIN) == HIGH της C++;',
        options: ['btn.is_pressed', 'btn.is_pressed()', 'btn == HIGH'],
        answer: 0,
        explain: 'Σωστά. Το is_pressed είναι ιδιότητα: γράφεται χωρίς παρενθέσεις και είναι True ή False.',
        retry: 'Όχι ακόμα. Το is_pressed δεν είναι εντολή που καλείς. Είναι μια τιμή True/False του κουμπιού.'
      },
      hints: [
        'Το κουμπί λέγεται btn. Η ιδιότητα που λέει αν είναι πατημένο είναι το is_pressed.',
        'Η συνθήκη είναι btn.is_pressed (χωρίς παρενθέσεις). Στο else γράφεις την εντολή που σβήνει το LED.',
        'if btn.is_pressed:\n    led.on()\nelse:\n    led.off()'
      ],
      validationTests: [
        { name: 'Χωρίς πάτημα: LED σβηστό', script: [
          { setup: true }, { sequence: { button: [0, 0, 0] } },
          { check: 'led', is: false, fail: 'Χωρίς πάτημα το LED είναι {v}. Περίμενα σβηστό.' }
        ] },
        { name: 'Με πατημένο κουμπί: LED αναμμένο', script: [
          { setup: true }, { sequence: { button: [0, 1, 1] } },
          { check: 'led', is: true, fail: 'Με πατημένο κουμπί το LED είναι {v}. Έλεγξε τη συνθήκη btn.is_pressed.' }
        ] },
        { name: 'Αφήνεις το κουμπί: το LED σβήνει', script: [
          { setup: true }, { sequence: { button: [1, 1, 0] } },
          { check: 'led', is: false, fail: 'Αφού άφησες το κουμπί, το LED είναι {v}. Λείπει το led.off() στο else;' }
        ] }
      ],
      explanationOnSuccess: 'Το LED ακολουθεί το κουμπί. Ο βρόχος ρωτά το κουμπί 20 φορές το δευτερόλεπτο: αρκετά γρήγορα για άνθρωπο, και ο επεξεργαστής ξεκουράζεται στο time.sleep.',
      remediation: 'Αν βλέπεις «TypeError: \'bool\' object is not callable», έγραψες btn.is_pressed() με παρενθέσεις. Σβήσε τις παρενθέσεις.'
    },

    {
      id: 'c18-l3', chapter: 18, kind: 'variant', lang: 'python', skills: ['python', 'io', 'state'],
      title: 'Callbacks: when_pressed και pause()',
      prerequisites: ['c18-l2'],
      objectives: ['Να δίνω μια συνάρτηση ως callback με btn.when_pressed = toggle.', 'Να κρατώ το πρόγραμμα ζωντανό με pause().', 'Να αλλάζω μια μεταβλητή του προγράμματος μέσα σε συνάρτηση με global.'],
      theory: `
<p>Με polling ρωτάς συνέχεια «πατήθηκε;». Με <strong>callback</strong> λες μία φορά: «όταν πατηθεί, κάλεσε αυτή τη συνάρτηση».</p>
<pre>def toggle():
    led.toggle()

btn.when_pressed = toggle    # ΧΩΡΙΣ παρενθέσεις
pause()</pre>
<ul>
  <li>Γράφεις το <strong>όνομα</strong> της συνάρτησης, <code>toggle</code>, χωρίς <code>()</code>. Με <code>toggle()</code> θα την καλούσες αμέσως, μία φορά.</li>
  <li>Το callback τρέχει <strong>μία φορά ανά πάτημα</strong>, όσο κι αν κρατάς το κουμπί.</li>
  <li>Το <code>pause()</code> (από το <code>signal</code>) κρατά το πρόγραμμα ζωντανό. Χωρίς αυτό, το πρόγραμμα τελειώνει και τα callbacks δεν τρέχουν ποτέ.</li>
</ul>
<p>Η μεταβλητή <code>presses</code> είναι του προγράμματος. Για να την αλλάξει η συνάρτηση, γράφει πρώτα <code>global presses</code>.</p>`,
      glossary: ['callback', 'pause()', 'global', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX_3,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: WORLD, initialWorld: WORLD,
      hardware: ['button'], panels: PANELS,
      steps: [
        'Διάβασε τη συνάρτηση toggle(). Τι κάνει σε κάθε κλήση;',
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το πρώτο κενό: ποια ιδιότητα του btn σημαίνει «όταν πατηθεί»;',
        'Συμπλήρωσε το δεύτερο κενό: η εντολή που περιμένει για πάντα.',
        'Τρέξε. Πάτα το κουμπί μερικές φορές, και μία φορά κράτα το πατημένο. Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Κρατάς το κουμπί πατημένο για 3 δευτερόλεπτα. Πόσες φορές καλείται η toggle();',
        options: ['Μία φορά, τη στιγμή που πατιέται', 'Συνέχεια, όσο είναι πατημένο', 'Καμία, μέχρι να το αφήσεις'],
        answer: 0,
        explain: 'Σωστά. Το when_pressed καλείται τη στιγμή που το κουμπί αλλάζει από αφημένο σε πατημένο. Δεν χρειάζεται δική σου μνήμη κατάστασης όπως στο Κεφάλαιο 3.',
        retry: 'Όχι ακόμα. Το when_pressed αντιδρά στη στιγμή του πατήματος, όχι στο «είναι πατημένο».'
      },
      hints: [
        'Το btn έχει ιδιότητες για γεγονότα: when_pressed, when_released. Και το pause() ήρθε με from signal import pause.',
        'Το πρώτο κενό είναι btn.when_pressed. Μετά το = γράφεις το όνομα toggle χωρίς παρενθέσεις. Το δεύτερο κενό είναι pause() με παρενθέσεις: αυτό το καλείς.',
        'btn.when_pressed = toggle\nprint("Έτοιμο. Πάτα το κουμπί.")\npause()'
      ],
      validationTests: [
        { name: 'Ξεκινά και περιμένει, με σβηστό LED', script: [
          { setup: true }, { ms: 300 },
          { check: 'serialHas', text: 'Έτοιμο', fail: 'Δεν τυπώθηκε «Έτοιμο». Το Τερματικό έδειξε: {v}.' },
          { check: 'led', is: false, fail: 'Χωρίς πάτημα το LED είναι {v}. Μήπως η toggle καλείται μόνη της; Γράψε toggle χωρίς παρενθέσεις.' }
        ] },
        { name: 'Ένα πάτημα ανάβει το LED', script: [
          { setup: true }, { ms: 300 }, ...PRESS,
          { check: 'led', is: true, fail: 'Μετά από ένα πάτημα το LED είναι {v}. Περίμενα αναμμένο. Έδωσες την toggle στο btn.when_pressed; Υπάρχει pause() στο τέλος;' },
          { check: 'lastLine', is: 'Πάτημα 1: LED ON', fail: 'Η τελευταία γραμμή είναι {v}. Περίμενα «Πάτημα 1: LED ON».' }
        ] },
        { name: 'Δεύτερο πάτημα σβήνει το LED', script: [
          { setup: true }, { ms: 300 }, ...PRESS, ...PRESS,
          { check: 'led', is: false, fail: 'Μετά από δύο πατήματα το LED είναι {v}. Περίμενα σβηστό.' },
          { check: 'lastLine', is: 'Πάτημα 2: LED OFF', fail: 'Η τελευταία γραμμή είναι {v}. Περίμενα «Πάτημα 2: LED OFF».' }
        ] },
        { name: 'Παρατεταμένο πάτημα μετρά μία φορά', script: [
          { setup: true }, { ms: 300 }, { set: { button: true } }, { ms: 2000 }, { set: { button: false } }, { ms: 300 },
          { check: 'count', text: 'Πάτημα 1: LED ON', is: 1, fail: 'Το «Πάτημα 1: LED ON» τυπώθηκε {n} φορές. Περίμενα 1.', failZero: 'Με ένα πάτημα 2 δευτερολέπτων δεν τυπώθηκε «Πάτημα 1: LED ON». Δόθηκε η toggle στο btn.when_pressed; Υπάρχει pause() στο τέλος;' },
          { check: 'serialNot', text: 'Πάτημα 2', fail: 'Ένα πάτημα 2 δευτερολέπτων μετρήθηκε σαν περισσότερα. Χρησιμοποίησε το btn.when_pressed, που αντιδρά μία φορά ανά πάτημα.' }
        ] }
      ],
      explanationOnSuccess: 'Το πρόγραμμα δεν ρωτά πια το κουμπί. Η gpiozero το παρακολουθεί και καλεί την toggle μία φορά σε κάθε πάτημα. Το pause() κρατά το πρόγραμμα ζωντανό, και το global επιτρέπει στη συνάρτηση να αλλάξει τον μετρητή presses.',
      remediation: 'Αν το «Πάτημα 1» εμφανίζεται πριν το «Έτοιμο», έγραψες toggle() με παρενθέσεις: η συνάρτηση καλέστηκε αμέσως. Αν το πρόγραμμα τελειώνει αμέσως, λείπει το pause().'
    },

    {
      id: 'c18-l4', chapter: 18, kind: 'independent', lang: 'python', skills: ['python', 'io', 'timing', 'automation', 'state'],
      title: 'Φως νυκτός με αισθητήρα κίνησης',
      prerequisites: ['c18-l3'],
      objectives: ['Να διαβάζω τον PIR με MotionSensor(4) και motion_detected.', 'Να μετρώ χρόνο χωρίς να μπλοκάρω το πρόγραμμα, με time.monotonic().', 'Να κρατώ το φως αναμμένο 5 s μετά την τελευταία κίνηση.'],
      theory: `
<p>Ο αισθητήρας κίνησης στο Pi:</p>
<pre>from gpiozero import MotionSensor
pir = MotionSensor(4)
if pir.motion_detected:
    …</pre>
<p>Ο κώδικας τώρα ανάβει το φως <strong>μόνο όσο</strong> υπάρχει κίνηση. Ο στόχος: να μένει αναμμένο <strong>5 δευτερόλεπτα μετά την τελευταία κίνηση</strong>.</p>
<p>Το <code>time.sleep(5)</code> δεν κάνει: όσο περιμένει, το πρόγραμμα δεν βλέπει νέα κίνηση. Θυμήσου το <code>millis()</code> της C++. Στην Python είναι το <code>time.monotonic()</code>, σε δευτερόλεπτα:</p>
<pre>now = time.monotonic()
if now - last_motion &gt;= ON_TIME:
    …   # πέρασαν 5 s από την τελευταία κίνηση</pre>
<ol>
  <li>Σε κάθε κίνηση: <code>last_motion = now</code> και άναψε.</li>
  <li>Χωρίς κίνηση: αν το φως είναι αναμμένο <strong>και</strong> πέρασαν 5 s, σβήσε.</li>
</ol>
<p>Τύπωσε <code>Φως ON</code> όταν ανάβει και <code>Φως OFF</code> όταν σβήνει, <strong>μία φορά</strong> τη στιγμή της αλλαγής. Το <code>led.is_lit</code> λέει αν είναι ήδη αναμμένο.</p>`,
      glossary: ['time.monotonic()', 'PIR', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX_4,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: WORLD, initialWorld: WORLD,
      hardware: ['pir'], panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Άναψε και σβήσε την «Κίνηση». Πόση ώρα μένει αναμμένο το φως;',
        'Απάντησε στην ερώτηση.',
        'Φτιάξε μια μεταβλητή last_motion πριν από το while. Σε κάθε κίνηση βάλε σε αυτήν το time.monotonic().',
        'Σβήσε το φως μόνο όταν πέρασαν ON_TIME δευτερόλεπτα από την τελευταία κίνηση.',
        'Τύπωσε «Φως ON» και «Φως OFF» μόνο τη στιγμή της αλλαγής. Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί όχι απλώς led.on(); time.sleep(5); led.off();',
        options: ['Γιατί για 5 s το πρόγραμμα δεν βλέπει νέα κίνηση, και το φως σβήνει ενώ κάποιος κινείται ακόμα', 'Γιατί το time.sleep δεν δουλεύει στο Pi', 'Γιατί το LED καίγεται αν μείνει 5 s αναμμένο'],
        answer: 0,
        explain: 'Σωστά. Το sleep μπλοκάρει: μετρά 5 s από την πρώτη κίνηση, όχι από την τελευταία. Με το monotonic() ο βρόχος συνεχίζει να κοιτά τον PIR κάθε 0,1 s.',
        retry: 'Όχι ακόμα. Τι κάνει το πρόγραμμα όσο τρέχει το time.sleep(5); Βλέπει τον PIR;'
      },
      hints: [
        'Χρειάζεσαι μνήμη: πότε είδες κίνηση τελευταία φορά. Και μία αφαίρεση: τώρα μείον τότε.',
        'Πριν το while: last_motion = 0. Μέσα στο if pir.motion_detected: γράψε last_motion = now. Στο elif: led.is_lit and now - last_motion >= ON_TIME. Το print μπαίνει μόνο όταν αλλάζει η κατάσταση (if not led.is_lit: πριν το led.on()).',
        'last_motion = 0\nwhile True:\n    now = time.monotonic()\n    if pir.motion_detected:\n        last_motion = now\n        if not led.is_lit:\n            led.on()\n            print("Φως ON")\n    elif led.is_lit and now - last_motion >= ON_TIME:\n        led.off()\n        print("Φως OFF")\n    time.sleep(0.1)'
      ],
      validationTests: [
        { name: 'Χωρίς κίνηση το φως μένει σβηστό', script: [
          { setup: true }, { ms: 3000 },
          { check: 'led', is: false, fail: 'Χωρίς καμία κίνηση το φως είναι {v}. Περίμενα σβηστό.' },
          { check: 'serialNot', text: 'Φως ON', fail: 'Τυπώθηκε «Φως ON» χωρίς κίνηση.' }
        ] },
        { name: 'Κίνηση: το φως ανάβει αμέσως', script: [
          { setup: true }, { ms: 500 }, { set: { pir: true } }, { ms: 300 },
          { check: 'led', is: true, fail: 'Λίγο μετά την κίνηση το φως είναι {v}. Περίμενα αναμμένο.' }
        ] },
        { name: 'Μένει αναμμένο μετά το τέλος της κίνησης', script: [
          { setup: true }, { ms: 500 }, { set: { pir: true } }, { ms: 3000 }, { set: { pir: false } }, { ms: 3000 },
          { check: 'led', is: true, fail: '3 δευτερόλεπτα μετά την τελευταία κίνηση το φως είναι {v}. Περίμενα αναμμένο (μένει 5 s). Μετράς τον χρόνο από την τελευταία κίνηση με time.monotonic();' }
        ] },
        { name: 'Σβήνει περίπου 5 s μετά την τελευταία κίνηση', script: [
          { setup: true }, { ms: 500 }, { set: { pir: true } }, { ms: 3000 }, { set: { pir: false } }, { ms: 5600 },
          { check: 'led', is: false, fail: '5,6 δευτερόλεπτα μετά την τελευταία κίνηση το φως είναι {v}. Περίμενα σβηστό.' }
        ] },
        { name: 'Νέα κίνηση ξαναμετρά τα 5 δευτερόλεπτα', script: [
          { setup: true }, { ms: 500 }, { set: { pir: true } }, { ms: 500 }, { set: { pir: false } },
          { ms: 3000 }, { set: { pir: true } }, { ms: 500 }, { set: { pir: false } }, { ms: 3500 },
          { check: 'led', is: true, fail: 'Η δεύτερη κίνηση τελείωσε πριν από 3,5 s, αλλά το φως είναι {v}. Κάθε κίνηση πρέπει να ενημερώνει το last_motion.' },
          { ms: 2000 },
          { check: 'led', is: false, fail: '5,5 s μετά τη δεύτερη κίνηση το φως είναι {v}. Περίμενα σβηστό.' }
        ] },
        { name: 'Τυπώνει «Φως ON» και «Φως OFF» μία φορά', script: [
          { setup: true }, { ms: 500 }, { set: { pir: true } }, { ms: 2000 }, { set: { pir: false } }, { ms: 6000 },
          { check: 'count', text: 'Φως ON', is: 1, fail: 'Το «Φως ON» τυπώθηκε {n} φορές σε μία κίνηση 2 s. Περίμενα 1: τύπωσε μόνο όταν το φως ήταν σβηστό (if not led.is_lit).' },
          { check: 'count', text: 'Φως OFF', is: 1, fail: 'Το «Φως OFF» τυπώθηκε {n} φορές. Περίμενα 1: τύπωσε μόνο τη στιγμή που σβήνει.' }
        ] }
      ],
      explanationOnSuccess: 'Το φως νυκτός δουλεύει όπως τα αληθινά: κάθε κίνηση ξαναμετρά τα 5 δευτερόλεπτα, και ο βρόχος δεν σταματά ποτέ να κοιτά τον αισθητήρα. Είναι το ίδιο μοτίβο με το millis() της C++, με time.monotonic() σε δευτερόλεπτα.',
      remediation: 'Αν το φως σβήνει ενώ υπάρχει ακόμα κίνηση, μάλλον χρησιμοποιείς time.sleep(5). Αν δεν σβήνει ποτέ, έλεγξε ότι το last_motion παίρνει τιμή μόνο όταν υπάρχει κίνηση.'
    },

    {
      id: 'c18-l5', chapter: 18, kind: 'checkpoint', lang: 'python', skills: ['python', 'io', 'state', 'syntax'],
      title: 'Βρες τα λάθη: ο διακόπτης που δεν ανάβει',
      prerequisites: ['c18-l4'],
      objectives: ['Να ξεχωρίζω το «δίνω τη συνάρτηση» (toggle) από το «καλώ τη συνάρτηση» (toggle()).', 'Να εντοπίζω λάθος pin από την προειδοποίηση.', 'Να διορθώνω UnboundLocalError με global.'],
      theory: `
<p>Ένας διακόπτης με κουμπί: κάθε πάτημα αλλάζει το LED. Ο κώδικας όμως βγάζει λάθος, και το LED δεν ανάβει ποτέ.</p>
<p>Υπάρχουν <strong>τρία</strong> λάθη:</p>
<ul>
  <li>ένα κάνει τη συνάρτηση να τρέξει <strong>μία φορά αμέσως</strong>, αντί για κάθε πάτημα,</li>
  <li>ένα κάνει τη συνάρτηση να μην μπορεί να αλλάξει τον μετρητή,</li>
  <li>ένα στέλνει την εντολή σε pin όπου <strong>δεν υπάρχει LED</strong>.</li>
</ul>
<p>Το μήνυμα <code>UnboundLocalError</code> σημαίνει: «αλλάζεις μια μεταβλητή μέσα σε συνάρτηση, άρα η Python τη θεωρεί τοπική, αλλά δεν έχει τιμή ακόμα».</p>
<p>Διάβασε και τις <strong>προειδοποιήσεις</strong>: ο κώδικας τρέχει, αλλά κάτι δεν είναι όπως νομίζεις.</p>
<p>Θυμήσου: στο εικονικό Pi, LED 17, κουμπί 27, PIR 4.</p>`,
      glossary: ['callback', 'global', 'BCM (αρίθμηση pins)', 'προειδοποίηση'],
      supportedSyntax: SYNTAX_3,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: WORLD, initialWorld: WORLD,
      hardware: ['button'], panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Διάβασε το μήνυμα λάθους: σε ποια γραμμή και για ποια μεταβλητή;',
        'Διόρθωσε αυτό το λάθος και τρέξε ξανά. Το «Πάτημα 1» εμφανίζεται πριν πατήσεις τίποτα; Γιατί;',
        'Διόρθωσε και αυτό. Πάτα το κουμπί: ανάβει το LED; Κοίτα τις προειδοποιήσεις.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι κάνει η γραμμή btn.when_pressed = toggle();',
        options: ['Καλεί την toggle μία φορά τώρα, και δίνει στο when_pressed αυτό που επέστρεψε (None)', 'Καλεί την toggle σε κάθε πάτημα', 'Τίποτα, μέχρι να πατηθεί το κουμπί'],
        answer: 0,
        explain: 'Σωστά. Οι παρενθέσεις καλούν τη συνάρτηση αμέσως. Η toggle δεν έχει return, άρα επιστρέφει None, και το κουμπί μένει χωρίς callback.',
        retry: 'Όχι ακόμα. Τι κάνουν οι παρενθέσεις () μετά από το όνομα μιας συνάρτησης;'
      },
      hints: [
        'Τρία σημεία: η γραμμή btn.when_pressed, η πρώτη γραμμή μέσα στην toggle(), και ο αριθμός μέσα στο LED(…).',
        'Το callback δίνεται χωρίς παρενθέσεις. Μέσα στην toggle χρειάζεται global presses πριν το presses += 1. Το LED είναι στο GPIO 17.',
        'led = LED(17)\n…\ndef toggle():\n    global presses\n    presses += 1\n…\nbtn.when_pressed = toggle'
      ],
      validationTests: [
        { name: 'Χωρίς πάτημα: «Έτοιμο», LED σβηστό', script: [
          { setup: true }, { ms: 300 },
          { check: 'serialHas', text: 'Έτοιμο', fail: 'Δεν τυπώθηκε «Έτοιμο». Το Τερματικό έδειξε: {v}.' },
          { check: 'serialNot', text: 'Πάτημα', fail: 'Τυπώθηκε «Πάτημα…» χωρίς να πατηθεί το κουμπί. Η toggle καλείται αμέσως: γράψε btn.when_pressed = toggle, χωρίς παρενθέσεις.' }
        ] },
        { name: 'Ένα πάτημα ανάβει το LED', script: [
          { setup: true }, { ms: 300 }, ...PRESS,
          { check: 'lastLine', is: 'Πάτημα 1', fail: 'Μετά από ένα πάτημα η τελευταία γραμμή είναι {v}. Περίμενα «Πάτημα 1».' },
          { check: 'led', is: true, fail: 'Μετά από ένα πάτημα το LED είναι {v}. Σε ποιο GPIO είναι το LED του Pi; Κοίτα τις προειδοποιήσεις.' }
        ] },
        { name: 'Τρία πατήματα: ο μετρητής φτάνει στο 3', script: [
          { setup: true }, { ms: 300 }, ...PRESS, ...PRESS, ...PRESS,
          { check: 'lastLine', is: 'Πάτημα 3', fail: 'Μετά από τρία πατήματα η τελευταία γραμμή είναι {v}. Περίμενα «Πάτημα 3».' },
          { check: 'led', is: true, fail: 'Μετά από τρία πατήματα το LED είναι {v}. Περίμενα αναμμένο (ON, OFF, ON).' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο. Τρία κλασικά λάθη της gpiozero: παρενθέσεις στο callback, ξεχασμένο global, λάθος pin. Το πρώτο δεν βγάζει καν μήνυμα λάθους, μόνο λάθος συμπεριφορά. Γι’ αυτό ελέγχουμε πάντα τι κάνει το πρόγραμμα, όχι μόνο αν τρέχει.',
      remediation: 'Αν το LED δεν ανάβει ενώ τυπώνεται «Πάτημα 1», το πρόγραμμα μιλά σε άλλο pin. Στο εικονικό Pi το LED είναι στο GPIO 17.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
