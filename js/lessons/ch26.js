/*
 * IoT Guardian — Python στο Raspberry Pi, κεφάλαιο 26 (επιπλέον): Ήχος, κίνηση, χρώμα και οθόνη.
 * gpiozero: Buzzer, TonalBuzzer + Tone, AngularServo, RGBLED · οθόνη OLED με Adafruit (board, busio, adafruit_ssd1306).
 * Ανοίγει μετά το κεφάλαιο 18 (GPIO με gpiozero).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 26, title: 'Ήχος, κίνηση, χρώμα και οθόνη στο Raspberry Pi', ready: true, bonus: true, track: 'py-pi', lang: 'python', board: 'pi', unlockAfter: 18 });

  [
    { term: 'buzzer', def: 'Μικρό ηχείο που βγάζει ήχο όταν ένα κομματάκι μέταλλο μέσα του τρέμει γρήγορα.' },
    { term: 'συχνότητα (Hz)', def: 'Πόσες φορές το δευτερόλεπτο τρέμει κάτι. 440 Hz είναι η νότα λα· όσο μεγαλύτερη η συχνότητα, τόσο πιο ψιλός ο ήχος.' },
    { term: 'Tone', def: 'Μια νότα στο gpiozero: Tone("A4") = λα (440 Hz), Tone("C4") = ντο, Tone(440.0) = 440 Hz. Την παίζει το TonalBuzzer με .play().' },
    { term: 'servo', def: 'Κινητήρας που γυρίζει σε ακριβή γωνία από 0 έως 180 μοίρες, ανάλογα με το μήκος ενός παλμού (0,5 έως 2,5 ms, 50 φορές το δευτερόλεπτο).' },
    { term: 'LED RGB', def: 'Τρία LED σε ένα: κόκκινο (Red), πράσινο (Green), μπλε (Blue). Ανακατεύοντάς τα φτιάχνεις σχεδόν κάθε χρώμα.' },
    { term: 'PWM', def: 'Το pin ανάβει και σβήνει πάρα πολύ γρήγορα. Όσο περισσότερη ώρα μένει αναμμένο, τόσο πιο φωτεινό φαίνεται ένα LED.' },
    { term: 'OLED', def: 'Μικρή οθόνη όπου κάθε κουκκίδα φωτίζει μόνη της. Η δική μας έχει 128 × 64 κουκκίδες.' },
    { term: 'I2C', def: 'Τρόπος επικοινωνίας με δύο καλώδια: SDA (δεδομένα) και SCL (ρολόι). Πολλές συσκευές μπορούν να μοιράζονται τα ίδια δύο καλώδια.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const BASE = { lang: 'python', board: 'pi', chapter: 26 };
  const PANELS = ['serial', 'vars', 'branch', 'loops'];
  const TS = (name, script, world) => ({ name, world, script });
  const SYN_BZ = 'from gpiozero import Button, Buzzer, TonalBuzzer, from gpiozero.tones import Tone, buzzer.on(), buzzer.off(), buzzer.play(Tone("A4")), buzzer.stop(), button.is_pressed, time.sleep, def, while True:, if / else';
  const SYN_SRV = 'from gpiozero import AngularServo, Button, AngularServo(18, min_angle=0, max_angle=180, min_pulse_width=0.0005, max_pulse_width=0.0025), servo.angle = 90, button.is_pressed, if / else';
  const SYN_RGB = 'from gpiozero import RGBLED, Button, MotionSensor, RGBLED(red=5, green=6, blue=13), led.color = (κόκκινο, πράσινο, μπλε) με τιμές 0 έως 1, pir.motion_detected, if / elif / else';
  const SYN_OLED = 'import board, busio, adafruit_ssd1306, busio.I2C(board.SCL, board.SDA), adafruit_ssd1306.SSD1306_I2C(128, 64, i2c), oled.fill(0), oled.text("…", x, y, 1), size=2, oled.show(), str()';

  // ------------------------------------------------------------ 1. Κουδούνι
  const BELL_OK = `# Το κουδούνι της εισόδου: όσο είναι πατημένο το κουμπί, το buzzer βουίζει.
from gpiozero import Button, Buzzer
import time

button = Button(27)
buzzer = Buzzer(22)          # το buzzer είναι στο GPIO 22

while True:
    if button.is_pressed:
        buzzer.on()          # βουίζει
    else:
        buzzer.off()         # σιωπή
    time.sleep(0.02)
`;
  const BELL_START = BELL_OK.replace('        buzzer.on()          # βουίζει\n', '        # ΣΥΜΠΛΗΡΩΣΕ: άναψε το buzzer\n        pass\n').replace('        buzzer.off()         # σιωπή\n', '        # ΣΥΜΠΛΗΡΩΣΕ: σβήσε το buzzer\n        pass\n');

  // ------------------------------------------------------------ 2. Μελωδία
  const MELODY_OK = `# Μια μικρή μελωδία όταν ξεκινά το Pi: ντο, μι, σολ.
from gpiozero import TonalBuzzer
from gpiozero.tones import Tone
import time

buzzer = TonalBuzzer(22)

def note(name):
    buzzer.play(Tone(name))   # π.χ. "C4" = ντο
    time.sleep(0.3)
    buzzer.stop()             # σιωπή
    time.sleep(0.05)          # μικρή παύση ανάμεσα στις νότες

note("C4")   # ντο
note("E4")   # μι
note("G4")   # σολ

while True:
    time.sleep(0.1)
`;
  const MELODY_START = MELODY_OK.replace('note("E4")   # μι\nnote("G4")   # σολ\n', '# ΣΥΜΠΛΗΡΩΣΕ: μι ("E4") και σολ ("G4")\n');

  // ------------------------------------------------------------ 3. Πόρτα με servo
  const DOOR_OK = `# Η πόρτα του γκαράζ: με πατημένο το κουμπί ανοίγει (90°), αλλιώς κλείνει (0°).
from gpiozero import AngularServo, Button
import time

button = Button(27)
# Ο servo μας θέλει παλμό 0,5 ms για 0° και 2,5 ms για 180°
servo = AngularServo(18, min_angle=0, max_angle=180,
                     min_pulse_width=0.0005, max_pulse_width=0.0025)

while True:
    if button.is_pressed:
        servo.angle = 90     # ανοιχτή
    else:
        servo.angle = 0      # κλειστή
    time.sleep(0.02)
`;
  const DOOR_START = DOOR_OK.replace('        servo.angle = 90     # ανοιχτή\n', '        # ΣΥΜΠΛΗΡΩΣΕ: άνοιξε την πόρτα (90°)\n        pass\n');

  // ------------------------------------------------------------ 4. Φως συναγερμού RGB
  const ALARM_OK = `# Φως του σπιτιού: κόκκινο αν υπάρχει κίνηση, μπλε όταν χτυπά το κουδούνι,
# αλλιώς ένα απαλό πράσινο. Στο gpiozero κάθε χρώμα πάει από 0 έως 1.
from gpiozero import RGBLED, Button, MotionSensor
import time

led = RGBLED(red=5, green=6, blue=13)
button = Button(27)
pir = MotionSensor(4)

while True:
    if pir.motion_detected:
        led.color = (1, 0, 0)      # κόκκινο
    elif button.is_pressed:
        led.color = (0, 0, 1)      # μπλε
    else:
        led.color = (0, 0.2, 0)    # απαλό πράσινο
    time.sleep(0.05)
`;
  const ALARM_START = ALARM_OK.replace('    elif button.is_pressed:\n        led.color = (0, 0, 1)      # μπλε\n    else:\n        led.color = (0, 0.2, 0)    # απαλό πράσινο\n', '    # ΣΥΜΠΛΗΡΩΣΕ: μπλε (0, 0, 1) αν πατηθεί το κουμπί, αλλιώς απαλό πράσινο (0, 0.2, 0)\n');

  // ------------------------------------------------------------ 5. Οθόνη: μετρητής επισκεπτών
  const OLED_OK = `# Μετρητής επισκεπτών: κάθε πάτημα του κουδουνιού μετράει, και η οθόνη δείχνει πόσοι ήρθαν.
from gpiozero import Button
import board
import busio
import adafruit_ssd1306
import time

button = Button(27)
i2c = busio.I2C(board.SCL, board.SDA)             # η οθόνη μιλά με I2C (GPIO 3 και 2)
oled = adafruit_ssd1306.SSD1306_I2C(128, 64, i2c)

count = 0
was_pressed = False
while True:
    pressed = button.is_pressed
    if pressed and not was_pressed:                 # μόλις πατήθηκε (όχι όσο μένει πατημένο)
        count += 1
    was_pressed = pressed
    oled.fill(0)                                    # σβήσε την προηγούμενη εικόνα
    oled.text("Visitors:", 0, 0, 1)
    oled.text(str(count), 0, 20, 1, size=2)         # μεγάλα γράμματα
    oled.show()                                     # ΤΩΡΑ στείλε τα γράμματα στην οθόνη
    time.sleep(0.05)
`;
  const OLED_BUG = OLED_OK.replace('    oled.show()                                     # ΤΩΡΑ στείλε τα γράμματα στην οθόνη\n', '');

  L.lessons.push(
    Object.assign({}, BASE, {
      id: 'c26-l1', kind: 'micro', skills: ['python', 'io', 'conditions'],
      title: 'Το κουδούνι: Buzzer',
      prerequisites: [],
      objectives: ['Να ανάβω και να σβήνω ένα buzzer με το gpiozero.', 'Να το ελέγχω με ένα κουμπί.'],
      theory: `
<p>Το <strong>buzzer</strong> είναι ένα μικρό ηχείο. Στο gpiozero το <code>Buzzer</code> δουλεύει σαν το <code>LED</code>:</p>
<ul><li><code>buzzer = Buzzer(22)</code>: το buzzer είναι στο GPIO 22.</li>
<li><code>buzzer.on()</code>: βουίζει. <code>buzzer.off()</code>: σιωπή.</li>
<li><code>buzzer.beep()</code>: βουίζει και σωπαίνει μόνο του, κάθε 1 δευτερόλεπτο.</li></ul>
<p>Στο παιχνίδι ο ήχος ακούγεται και στα ηχεία σου όσο τρέχει ο κώδικας (αν οι ήχοι είναι ανοιχτοί στις Ρυθμίσεις).</p>`,
      glossary: ['buzzer'], supportedSyntax: SYN_BZ,
      initialCode: BELL_START, solution: BELL_OK,
      world: { button: false }, initialWorld: { button: false }, hardware: ['button', 'buzzer'], panels: PANELS,
      steps: ['Στο if, γράψε buzzer.on() στη θέση του pass.', 'Στο else, γράψε buzzer.off().', 'Τρέξε και πάτα το κουμπί στη σκηνή.'],
      quiz: { question: 'Με ποια εντολή του gpiozero μοιάζει το buzzer.on();', options: ['Με το led.on(): ανάβει μια έξοδο', 'Με το button.is_pressed: διαβάζει μια είσοδο', 'Με το time.sleep(): περιμένει'], answer: 0, explain: 'Σωστά. Το Buzzer είναι κι αυτό έξοδος, όπως το LED.', retry: 'Το buzzer είναι έξοδος ή είσοδος;' },
      hints: ['Ο ήχος ανοίγει με buzzer.on() και κλείνει με buzzer.off().', 'Το on() μπαίνει στο if, το off() στο else.', 'if: buzzer.on()   else: buzzer.off()'],
      validationTests: [
        TS('Χωρίς πάτημα → σιωπή', [{ setup: true }, { loops: 1 }, { check: 'buzzer', is: false, fail: 'Χωρίς πατημένο κουμπί το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → ήχος', [{ setup: true }, { sequence: { button: [1] } }, { check: 'buzzer', is: true, fail: 'Με πατημένο κουμπί περίμενα ήχο. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → σιωπή', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'buzzer', is: false, fail: 'Όταν αφήνεις το κουμπί ο ήχος πρέπει να σταματά (buzzer.off()). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Το κουδούνι δουλεύει! Το Buzzer του gpiozero ανάβει και σβήνει όπως ένα LED.',
      remediation: 'Στο if βάλε buzzer.on() και στο else buzzer.off().'
    }),
    Object.assign({}, BASE, {
      id: 'c26-l2', kind: 'guided', skills: ['python', 'timing'],
      title: 'Μια μελωδία: ντο, μι, σολ',
      prerequisites: ['c26-l1'],
      objectives: ['Να παίζω νότες με TonalBuzzer και Tone.', 'Να φτιάχνω μια συνάρτηση για κάθε νότα.'],
      theory: `
<p>Το απλό <code>Buzzer</code> βγάζει έναν μόνο ήχο. Το <code>TonalBuzzer</code> παίζει <strong>νότες</strong>:</p>
<ul><li><code>buzzer.play(Tone("A4"))</code>: η νότα λα (440 Hz). Οι νότες γράφονται με το αγγλικό γράμμα και την οκτάβα: C = ντο, D = ρε, E = μι, F = φα, G = σολ, A = λα, B = σι.</li>
<li><code>buzzer.play(Tone(440.0))</code>: το ίδιο, με τη συχνότητα σε Hz.</li>
<li><code>buzzer.stop()</code>: σιωπή.</li></ul>
<p>Το TonalBuzzer παίζει από 220 έως 880 Hz (από το A3 έως το A5). Για πιο πολλές νότες γράφεις <code>TonalBuzzer(22, octaves=2)</code>.</p>`,
      glossary: ['Tone', 'συχνότητα (Hz)'], supportedSyntax: SYN_BZ,
      initialCode: MELODY_START, solution: MELODY_OK,
      world: {}, initialWorld: {}, hardware: ['buzzer'], panels: PANELS,
      steps: ['Η note() είναι έτοιμη.', 'Πρόσθεσε note("E4") και note("G4") μετά το ντο.', 'Τρέξε και άκουσε τη μελωδία. Δες και τον λογικό αναλυτή.'],
      quiz: { question: 'Ποια νότα είναι το Tone("A4");', options: ['Το λα, 440 Hz', 'Το ντο, 262 Hz', 'Το σολ, 392 Hz'], answer: 0, explain: 'Σωστά. A = λα, και το A4 είναι το λα των 440 Hz.', retry: 'Το A είναι το αγγλικό όνομα μιας νότας. Ποιας;' },
      hints: ['Κάθε νότα είναι μία κλήση note("…").', 'μι = "E4", σολ = "G4".', 'note("E4")\nnote("G4")'],
      validationTests: [
        TS('Παίζουν και οι τρεις νότες', [{ setup: true }, { loops: 1 }, { check: 'tones', min: 3, freqs: [262, 330, 392], fail: 'Περίμενα τις νότες 262, 330 και 392 Hz. Άκουσα: {v}.' }], {}),
        TS('Μετά τη μελωδία: σιωπή', [{ setup: true }, { loops: 1 }, { check: 'buzzer', is: false, fail: 'Μετά τη μελωδία το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }], {})
      ],
      explanationOnSuccess: 'Μπράβο! Με το TonalBuzzer και τα ονόματα των νοτών έφτιαξες μελωδία.',
      remediation: 'Χρειάζονται τρεις κλήσεις note(): "C4", "E4" και "G4".'
    }),
    Object.assign({}, BASE, {
      id: 'c26-l3', kind: 'guided', skills: ['python', 'io', 'conditions'],
      title: 'Η πόρτα του γκαράζ: AngularServo',
      prerequisites: ['c26-l2'],
      objectives: ['Να γυρίζω ένα servo σε γωνία με το AngularServo.', 'Να καταλάβω τι είναι το μήκος του παλμού.'],
      theory: `
<p>Το <strong>servo</strong> δέχεται έναν παλμό 50 φορές το δευτερόλεπτο. Το <strong>μήκος</strong> του παλμού λέει τη γωνία. Ο δικός μας θέλει 0,5 ms για 0° και 2,5 ms για 180°.</p>
<p>Το <code>AngularServo</code> του gpiozero κάνει τον λογαριασμό για σένα. Του λες μία φορά τα όρια:</p>
<pre>servo = AngularServo(18, min_angle=0, max_angle=180,
                     min_pulse_width=0.0005, max_pulse_width=0.0025)</pre>
<p>και μετά γράφεις απλώς <code>servo.angle = 90</code>.</p>`,
      glossary: ['servo', 'PWM'], supportedSyntax: SYN_SRV,
      initialCode: DOOR_START, solution: DOOR_OK,
      world: { button: false }, initialWorld: { button: false }, hardware: ['button', 'servo'], panels: PANELS,
      steps: ['Στο if, γράψε servo.angle = 90 στη θέση του pass.', 'Τρέξε και πάτα το κουμπί: δες το μπράτσο να γυρίζει.'],
      quiz: { question: 'Τι θα γινόταν αν γράψεις servo.angle = 200;', options: ['ValueError: η γωνία είναι έξω από τα όρια 0–180', 'Ο servo θα γύριζε στις 200°', 'Θα γύριζε συνέχεια'], answer: 0, explain: 'Σωστά. Το AngularServo ελέγχει τα όρια που του έδωσες και σταματά με λάθος.', retry: 'Ποια όρια δώσαμε με min_angle και max_angle;' },
      hints: ['Η γωνία αλλάζει με servo.angle = …', 'Η ανοιχτή πόρτα είναι στις 90 μοίρες.', 'servo.angle = 90'],
      validationTests: [
        TS('Στην αρχή η πόρτα είναι κλειστή (0°)', [{ setup: true }, { loops: 1 }, { check: 'servo', angle: 0, fail: 'Χωρίς πάτημα περίμενα το servo στις 0°. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → η πόρτα ανοίγει (90°)', [{ setup: true }, { sequence: { button: [1] } }, { check: 'servo', angle: 90, fail: 'Με πατημένο κουμπί περίμενα το servo στις 90°. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → κλείνει', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'servo', angle: 0, fail: 'Όταν αφήνεις το κουμπί η πόρτα πρέπει να κλείνει (0°). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Η πόρτα ανοίγει και κλείνει! Το AngularServo μετατρέπει τις μοίρες σε μήκος παλμού.',
      remediation: 'Με πατημένο κουμπί γράψε servo.angle = 90.'
    }),
    Object.assign({}, BASE, {
      id: 'c26-l4', kind: 'guided', skills: ['python', 'conditions', 'io'],
      title: 'Το φως του σπιτιού: RGBLED',
      prerequisites: ['c26-l3'],
      objectives: ['Να ανακατεύω χρώματα με το RGBLED.', 'Να ξέρω ότι στο gpiozero κάθε χρώμα πάει από 0 έως 1.'],
      theory: `
<p>Το <strong>LED RGB</strong> έχει μέσα τρία LED: κόκκινο, πράσινο, μπλε. Στο gpiozero:</p>
<ul><li><code>led = RGBLED(red=5, green=6, blue=13)</code></li>
<li><code>led.color = (1, 0, 0)</code>: κόκκινο. Κάθε τιμή πάει από <strong>0</strong> (σβηστό) έως <strong>1</strong> (όσο πιο φωτεινό γίνεται).</li>
<li>(1, 1, 0) = κίτρινο · (1, 0, 1) = μωβ · (0, 0.2, 0) = πολύ απαλό πράσινο.</li></ul>
<p>Προσοχή: αν γράψεις 255 όπως στη C++, το gpiozero θα σταματήσει με ValueError.</p>`,
      glossary: ['LED RGB', 'PWM'], supportedSyntax: SYN_RGB,
      initialCode: ALARM_START, solution: ALARM_OK,
      world: { button: false, pir: false }, initialWorld: { button: false, pir: false }, hardware: ['rgb', 'button', 'pir'], panels: PANELS,
      steps: ['Μετά το if, πρόσθεσε elif button.is_pressed: με led.color = (0, 0, 1)', 'Πρόσθεσε else: με led.color = (0, 0.2, 0)', 'Τρέξε, πάτα το κουμπί και κάνε κίνηση στη σκηνή.'],
      quiz: { question: 'Ποιο χρώμα είναι το led.color = (1, 1, 0);', options: ['Κίτρινο', 'Λευκό', 'Μωβ'], answer: 0, explain: 'Σωστά. Κόκκινο + πράσινο φως = κίτρινο.', retry: 'Ανάβουν το κόκκινο και το πράσινο. Τι χρώμα βγάζουν μαζί;' },
      hints: ['Χρειάζεσαι elif και else.', 'Μπλε = (0, 0, 1), απαλό πράσινο = (0, 0.2, 0).', 'elif button.is_pressed:\n    led.color = (0, 0, 1)\nelse:\n    led.color = (0, 0.2, 0)'],
      validationTests: [
        TS('Ησυχία → απαλό πράσινο', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 0, g: 51, b: 0, fail: 'Χωρίς κίνηση και κουμπί περίμενα απαλό πράσινο (0, 0.2, 0). Τώρα: {v}.' }], { button: false, pir: false }),
        TS('Κουμπί → μπλε', [{ setup: true }, { sequence: { button: [1] } }, { check: 'rgb', r: 0, g: 0, b: 255, fail: 'Με πατημένο κουμπί περίμενα μπλε (0, 0, 1). Τώρα: {v}.' }], { button: false, pir: false }),
        TS('Κίνηση → κόκκινο', [{ setup: true }, { sequence: { pir: [1] } }, { check: 'rgb', r: 255, g: 0, b: 0, fail: 'Με κίνηση περίμενα κόκκινο (1, 0, 0). Τώρα: {v}.' }], { button: false, pir: false })
      ],
      explanationOnSuccess: 'Το φως δείχνει τι γίνεται στο σπίτι με μια ματιά! Θυμήσου: στο gpiozero τα χρώματα πάνε από 0 έως 1.',
      remediation: 'Χρειάζονται τρεις περιπτώσεις: κίνηση κόκκινο, κουμπί μπλε, αλλιώς απαλό πράσινο.'
    }),
    Object.assign({}, BASE, {
      id: 'c26-l5', kind: 'debug', skills: ['python', 'state', 'syntax'],
      title: 'Βρες το λάθος: ο μετρητής δεν φαίνεται',
      prerequisites: ['c26-l4'],
      objectives: ['Να γράφω στην οθόνη OLED με τη βιβλιοθήκη της Adafruit.', 'Να καταλάβω ότι η οθόνη ενημερώνεται μόνο με oled.show().'],
      theory: `
<p>Η οθόνη <strong>OLED</strong> συνδέεται με <strong>I2C</strong>: στο Raspberry Pi το SDA είναι το GPIO 2 και το SCL το GPIO 3.</p>
<ol><li><code>i2c = busio.I2C(board.SCL, board.SDA)</code></li>
<li><code>oled = adafruit_ssd1306.SSD1306_I2C(128, 64, i2c)</code></li>
<li><code>oled.fill(0)</code> σβήνει τα πάντα.</li>
<li><code>oled.text("Visitors:", 0, 0, 1)</code> γράφει στη θέση x = 0, y = 0. Το τελευταίο <strong>1</strong> είναι το χρώμα (1 = φωτεινό). Με <code>size=2</code> τα γράμματα γίνονται διπλά.</li>
<li><code>oled.show()</code> <strong>στέλνει</strong> όλα όσα έγραψες στην οθόνη.</li></ol>
<p>Τα <code>text()</code> γράφουν σε μια μνήμη· η οθόνη αλλάζει μόνο με <code>oled.show()</code>. Κάποιος το ξέχασε…</p>`,
      glossary: ['OLED', 'I2C'], supportedSyntax: SYN_OLED,
      initialCode: OLED_BUG, solution: OLED_OK,
      world: { button: false }, initialWorld: { button: false }, hardware: ['oled', 'button'], panels: PANELS,
      steps: ['Τρέξε: η οθόνη στη σκηνή μένει μαύρη.', 'Βρες τι λείπει μετά τα text().', 'Πρόσθεσέ το, ξανατρέξε και πάτα το κουμπί μερικές φορές.'],
      quiz: { question: 'Γιατί η οθόνη έμενε άδεια;', options: ['Τα text() γράφουν σε μνήμη· η οθόνη ενημερώνεται μόνο με oled.show()', 'Το text() δεν δέχεται αριθμούς', 'Το fill(0) σβήνει μόνιμα την οθόνη'], answer: 0, explain: 'Σωστά. Πρώτα «ζωγραφίζεις» στη μνήμη και μετά τη στέλνεις όλη μαζί: έτσι η εικόνα δεν τρεμοπαίζει.', retry: 'Τι κάνει το oled.show();' },
      hints: ['Η οθόνη ενημερώνεται μόνο με μία συγκεκριμένη εντολή.', 'Κοίτα το βήμα 5 στο «Μάθημα».', 'Πρόσθεσε oled.show() μετά το τελευταίο text().'],
      validationTests: [
        TS('Στην αρχή η οθόνη δείχνει 0', [{ setup: true }, { loops: 1 }, { check: 'oled', has: 'Visitors: 0', fail: 'Στην οθόνη περίμενα «Visitors: 0». Βλέπω: {v}.' }], { button: false }),
        TS('Δύο πατήματα → 2', [{ setup: true }, { sequence: { button: [1, 0, 1, 0] } }, { check: 'oled', has: 'Visitors: 2', fail: 'Μετά από δύο πατήματα περίμενα «Visitors: 2». Βλέπω: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Ο μετρητής φαίνεται! fill(0), text(), και στο τέλος show().',
      remediation: 'Λείπει το oled.show() μετά τα text().'
    })
  );
})(typeof window !== 'undefined' ? window : globalThis);
