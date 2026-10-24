/*
 * IoT Guardian — MicroPython στο ESP32, κεφάλαιο 36 (επιπλέον): Ήχος, κίνηση, χρώμα και οθόνη.
 * machine.PWM για buzzer, servo (50 Hz) και LED RGB, και οθόνη OLED με I2C + ssd1306.
 * Ανοίγει μετά το κεφάλαιο 31 (κουμπί και κίνηση).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 36, title: 'Ήχος, κίνηση, χρώμα και οθόνη σε MicroPython', ready: true, bonus: true, track: 'py-esp32', lang: 'python', board: 'esp32', unlockAfter: 31 });
  if (!L.SKILLS.micropython) L.SKILLS.micropython = 'MicroPython';

  [
    { term: 'buzzer', def: 'Μικρό ηχείο που βγάζει ήχο όταν ένα κομματάκι μέταλλο μέσα του τρέμει γρήγορα.' },
    { term: 'συχνότητα (Hz)', def: 'Πόσες φορές το δευτερόλεπτο τρέμει κάτι. 440 Hz είναι η νότα λα· όσο μεγαλύτερη η συχνότητα, τόσο πιο ψιλός ο ήχος.' },
    { term: 'PWM', def: 'Το pin ανάβει και σβήνει πάρα πολύ γρήγορα. Όσο περισσότερη ώρα μένει αναμμένο, τόσο πιο φωτεινό φαίνεται ένα LED.' },
    { term: 'duty', def: 'Πόσο από τον χρόνο μένει αναμμένο ένα pin με PWM. Στη MicroPython: duty(0…1023) ή duty_u16(0…65535). Το μισό είναι 512 ή 32768.' },
    { term: 'servo', def: 'Κινητήρας που γυρίζει σε ακριβή γωνία από 0 έως 180 μοίρες, ανάλογα με το μήκος ενός παλμού (0,5 έως 2,5 ms, 50 φορές το δευτερόλεπτο).' },
    { term: 'LED RGB', def: 'Τρία LED σε ένα: κόκκινο (Red), πράσινο (Green), μπλε (Blue). Ανακατεύοντάς τα φτιάχνεις σχεδόν κάθε χρώμα.' },
    { term: 'OLED', def: 'Μικρή οθόνη όπου κάθε κουκκίδα φωτίζει μόνη της. Η δική μας έχει 128 × 64 κουκκίδες.' },
    { term: 'I2C', def: 'Τρόπος επικοινωνίας με δύο καλώδια: SDA (δεδομένα) και SCL (ρολόι). Πολλές συσκευές μπορούν να μοιράζονται τα ίδια δύο καλώδια.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const BASE = { lang: 'python', board: 'esp32', chapter: 36, missionStory: 'Στο σαλόνι στήνεις νέα εξαρτήματα: ένα buzzer για ήχο, ένα servo για κίνηση, ένα LED RGB για χρώμα και μια μικρή οθόνη. Δοκίμασε το καθένα πριν το βάλεις στο σπίτι.' };
  const PANELS = ['serial', 'vars', 'branch', 'loops'];
  const SYN_PWM = 'from machine import Pin, PWM, PWM(Pin(23)), .freq(Hz), .duty_u16(0…65535), .duty(0…1023), Pin(15, Pin.IN), .value(), time.sleep_ms, def, while True:, if / else';
  const SYN_OLED = 'from machine import Pin, I2C, import ssd1306, I2C(0, scl=Pin(22), sda=Pin(21)), ssd1306.SSD1306_I2C(128, 64, i2c), oled.fill(0), oled.text("…", x, y), oled.show(), dht.DHT22(Pin(13)), str()';

  const BELL_OK = `# Το κουδούνι της εισόδου: όσο είναι πατημένο το κουμπί, ακούγεται ήχος.
from machine import Pin, PWM
import time

button = Pin(15, Pin.IN)
buzzer = PWM(Pin(23))
buzzer.freq(880)            # ένα ψιλό «ντινγκ»: 880 Hz

while True:
    if button.value() == 1:
        buzzer.duty_u16(32768)   # μισό-μισό: ακούγεται ήχος
    else:
        buzzer.duty_u16(0)       # 0: σιωπή
    time.sleep_ms(20)
`;
  const BELL_START = BELL_OK.replace('        buzzer.duty_u16(32768)   # μισό-μισό: ακούγεται ήχος\n', '        # ΣΥΜΠΛΗΡΩΣΕ: ήχος (duty_u16 στο 32768)\n        pass\n').replace('        buzzer.duty_u16(0)       # 0: σιωπή\n', '        # ΣΥΜΠΛΗΡΩΣΕ: σιωπή (duty_u16 στο 0)\n        pass\n');

  const MELODY_OK = `# Μια μικρή μελωδία όταν ξεκινά η πλακέτα: ντο, μι, σολ.
from machine import Pin, PWM
import time

buzzer = PWM(Pin(23))
buzzer.duty_u16(0)

def note(freq, ms):
    buzzer.freq(freq)
    buzzer.duty_u16(32768)   # ήχος
    time.sleep_ms(ms)
    buzzer.duty_u16(0)       # σιωπή
    time.sleep_ms(50)        # μικρή παύση ανάμεσα στις νότες

note(262, 300)   # ντο
note(330, 300)   # μι
note(392, 300)   # σολ

while True:
    time.sleep_ms(100)
`;
  const MELODY_START = MELODY_OK.replace('note(330, 300)   # μι\nnote(392, 300)   # σολ\n', '# ΣΥΜΠΛΗΡΩΣΕ: μι (330 Hz) και σολ (392 Hz), 300 ms η καθεμία\n');

  const DOOR_OK = `# Η πόρτα του γκαράζ: με πατημένο το κουμπί ανοίγει (90°), αλλιώς κλείνει (0°).
from machine import Pin, PWM
import time

button = Pin(15, Pin.IN)
servo = PWM(Pin(19), freq=50)    # το servo θέλει 50 παλμούς το δευτερόλεπτο

def angle(a):
    # 0° = παλμός 0,5 ms (duty 26), 180° = 2,5 ms (duty 128)
    servo.duty(int(26 + a * 102 / 180))

angle(0)   # ξεκινάμε κλειστά

while True:
    if button.value() == 1:
        angle(90)    # ανοιχτή
    else:
        angle(0)     # κλειστή
    time.sleep_ms(20)
`;
  const DOOR_START = DOOR_OK.replace('        angle(90)    # ανοιχτή\n', '        # ΣΥΜΠΛΗΡΩΣΕ: άνοιξε την πόρτα (90°)\n        pass\n');

  const MOOD_OK = `# Φως διάθεσης: το χρώμα δείχνει τη θερμοκρασία.
# κρύο (κάτω από 20 °C) = μπλε, άνετα (20 έως 28) = πράσινο, ζέστη (πάνω από 28) = κόκκινο
from machine import Pin, PWM
import dht
import time

red = PWM(Pin(32), freq=1000)
green = PWM(Pin(33), freq=1000)
blue = PWM(Pin(14), freq=1000)
sensor = dht.DHT22(Pin(13))

def color(r, g, b):
    # 0…255 όπως στη ζωγραφική · το duty της MicroPython πάει ως 1023
    red.duty(r * 4)
    green.duty(g * 4)
    blue.duty(b * 4)

while True:
    sensor.measure()
    t = sensor.temperature()
    if t < 20:
        color(0, 0, 255)       # μπλε
    elif t <= 28:
        color(0, 255, 0)       # πράσινο
    else:
        color(255, 0, 0)       # κόκκινο
    time.sleep(2)
`;
  const MOOD_START = MOOD_OK.replace('    elif t <= 28:\n        color(0, 255, 0)       # πράσινο\n    else:\n        color(255, 0, 0)       # κόκκινο\n', '    # ΣΥΜΠΛΗΡΩΣΕ: πράσινο για 20 έως 28, κόκκινο πάνω από 28\n');

  const OLED_OK = `# Θερμόμετρο με οθόνη: η θερμοκρασία γράφεται πάνω στη συσκευή.
from machine import Pin, I2C
import ssd1306
import dht
import time

i2c = I2C(0, scl=Pin(22), sda=Pin(21))       # η οθόνη μιλά με I2C
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
sensor = dht.DHT22(Pin(13))

while True:
    sensor.measure()
    t = sensor.temperature()
    oled.fill(0)                              # σβήσε την προηγούμενη μέτρηση
    oled.text("Temp:", 0, 0)
    oled.text(str(t) + " C", 0, 12)
    oled.show()                               # ΤΩΡΑ στείλε τα γράμματα στην οθόνη
    time.sleep(2)
`;
  const OLED_BUG = OLED_OK.replace('    oled.show()                               # ΤΩΡΑ στείλε τα γράμματα στην οθόνη\n', '');

  const TS = (name, script, world) => ({ name, world, script });
  L.lessons.push(
    Object.assign({}, BASE, {
      id: 'c36-l1', kind: 'micro', skills: ['micropython', 'io', 'conditions'],
      title: 'Το κουδούνι με PWM',
      prerequisites: [],
      objectives: ['Να φτιάχνω PWM σε ένα pin.', 'Να βγάζω ήχο με duty_u16 και να τον σταματώ με duty_u16(0).'],
      theory: `
<p>Στη MicroPython ο ήχος φτιάχνεται με <strong>PWM</strong>: το pin ανάβει και σβήνει τόσο γρήγορα, που το buzzer τρέμει και βγάζει ήχο.</p>
<ul><li><code>buzzer = PWM(Pin(23))</code>: PWM στο pin του buzzer.</li>
<li><code>buzzer.freq(880)</code>: πόσες φορές το δευτερόλεπτο (Hz): ψιλός ή χοντρός ήχος.</li>
<li><code>buzzer.duty_u16(32768)</code>: μισό αναμμένο, μισό σβηστό: <strong>ακούγεται</strong>.</li>
<li><code>buzzer.duty_u16(0)</code>: πάντα σβηστό: <strong>σιωπή</strong>.</li></ul>`,
      glossary: ['buzzer', 'συχνότητα (Hz)', 'PWM', 'duty'], supportedSyntax: SYN_PWM,
      initialCode: BELL_START, solution: BELL_OK,
      world: { button: false }, initialWorld: { button: false }, hardware: ['button', 'buzzer'], panels: PANELS,
      steps: ['Στο if, γράψε buzzer.duty_u16(32768) στη θέση του pass.', 'Στο else, γράψε buzzer.duty_u16(0).', 'Τρέξε και πάτα το κουμπί στη σκηνή.'],
      quiz: { question: 'Τι κάνει το buzzer.duty_u16(0);', options: ['Σωπαίνει το buzzer', 'Βγάζει τον πιο δυνατό ήχο', 'Αλλάζει τη νότα'], answer: 0, explain: 'Σωστά. Με duty 0 το pin μένει πάντα σβηστό, άρα το buzzer δεν τρέμει.', retry: 'duty = πόσο από τον χρόνο είναι αναμμένο. Το 0 τι σημαίνει;' },
      hints: ['Ο ήχος ανοίγει και κλείνει με το duty_u16.', 'Μισό = 32768, τίποτα = 0.', 'if: buzzer.duty_u16(32768)   else: buzzer.duty_u16(0)'],
      validationTests: [
        TS('Χωρίς πάτημα → σιωπή', [{ setup: true }, { loops: 1 }, { check: 'buzzer', is: false, fail: 'Χωρίς πατημένο κουμπί το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → 880 Hz', [{ setup: true }, { sequence: { button: [1] } }, { check: 'buzzer', is: true, freq: 880, fail: 'Με πατημένο κουμπί περίμενα ήχο 880 Hz. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → σιωπή', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'buzzer', is: false, fail: 'Όταν αφήνεις το κουμπί ο ήχος πρέπει να σταματά (duty_u16(0)). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Το κουδούνι δουλεύει! Η συχνότητα λέει ποια νότα, το duty αν ακούγεται.',
      remediation: 'Στο if βάλε buzzer.duty_u16(32768) και στο else buzzer.duty_u16(0).'
    }),
    Object.assign({}, BASE, {
      id: 'c36-l2', kind: 'guided', skills: ['micropython', 'timing'],
      title: 'Μια μελωδία: ντο, μι, σολ',
      prerequisites: ['c36-l1'],
      objectives: ['Να αλλάζω νότα με .freq().', 'Να φτιάχνω μια συνάρτηση για κάθε νότα.'],
      theory: `
<p>Η συνάρτηση <code>note(freq, ms)</code> παίζει μία νότα: αλλάζει τη συχνότητα, ανοίγει τον ήχο, περιμένει <code>ms</code>, κλείνει τον ήχο και κάνει μια μικρή παύση.</p>
<p>Μερικές νότες: ντο = 262 Hz, ρε = 294, μι = 330, φα = 349, σολ = 392, λα = 440, σι = 494.</p>`,
      glossary: ['συχνότητα (Hz)', 'PWM'], supportedSyntax: SYN_PWM,
      initialCode: MELODY_START, solution: MELODY_OK,
      world: {}, initialWorld: {}, hardware: ['buzzer'], panels: PANELS,
      steps: ['Η note() είναι έτοιμη.', 'Πρόσθεσε note(330, 300) και note(392, 300) μετά το ντο.', 'Τρέξε και άκουσε τη μελωδία.'],
      quiz: { question: 'Ποια νότα είναι πιο ψιλή;', options: ['Η σολ (392 Hz)', 'Η ντο (262 Hz)', 'Ακούγονται ίδιες'], answer: 0, explain: 'Σωστά. Περισσότερα Hz = πιο ψιλός ήχος.', retry: 'Ποια έχει περισσότερες δονήσεις το δευτερόλεπτο;' },
      hints: ['Κάθε νότα είναι μία κλήση note(συχνότητα, διάρκεια).', 'μι = 330 Hz, σολ = 392 Hz.', 'note(330, 300)\nnote(392, 300)'],
      validationTests: [
        TS('Παίζουν και οι τρεις νότες', [{ setup: true }, { loops: 1 }, { check: 'tones', min: 3, freqs: [262, 330, 392], fail: 'Περίμενα τις νότες 262, 330 και 392 Hz. Άκουσα: {v}.' }], {}),
        TS('Μετά τη μελωδία: σιωπή', [{ setup: true }, { loops: 1 }, { check: 'buzzer', is: false, fail: 'Μετά τη μελωδία το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }], {})
      ],
      explanationOnSuccess: 'Μπράβο! Με μια συνάρτηση και τρεις κλήσεις έφτιαξες μελωδία.',
      remediation: 'Χρειάζονται τρεις κλήσεις note(): 262, 330 και 392 Hz.'
    }),
    Object.assign({}, BASE, {
      id: 'c36-l3', kind: 'guided', skills: ['micropython', 'io', 'conditions'],
      title: 'Η πόρτα του γκαράζ: servo με PWM',
      prerequisites: ['c36-l2'],
      objectives: ['Να ελέγχω servo με PWM στα 50 Hz.', 'Να μετατρέπω γωνία σε duty.'],
      theory: `
<p>Το <strong>servo</strong> καταλαβαίνει έναν παλμό 50 φορές το δευτερόλεπτο. Το <strong>μήκος</strong> του παλμού λέει τη γωνία:</p>
<ul><li>0,5 ms → 0° · 1,5 ms → 90° · 2,5 ms → 180°</li></ul>
<p>Με <code>PWM(Pin(19), freq=50)</code> και <code>duty(0…1023)</code>, αυτά είναι περίπου duty 26 (0°), 77 (90°) και 128 (180°). Η συνάρτηση <code>angle(a)</code> κάνει τον λογαριασμό για σένα.</p>`,
      glossary: ['servo', 'PWM', 'duty'], supportedSyntax: SYN_PWM,
      initialCode: DOOR_START, solution: DOOR_OK,
      world: { button: false }, initialWorld: { button: false }, hardware: ['button', 'servo'], panels: PANELS,
      steps: ['Η angle(a) είναι έτοιμη.', 'Στο if, γράψε angle(90) στη θέση του pass.', 'Τρέξε και πάτα το κουμπί: δες το μπράτσο να γυρίζει.'],
      quiz: { question: 'Τι μήκος παλμού βάζει το servo στις 90°;', options: ['1,5 ms', '0,5 ms', '20 ms'], answer: 0, explain: 'Σωστά. 1,5 ms είναι η μέση: 90°.', retry: '0,5 ms = 0°, 2,5 ms = 180°. Η μέση;' },
      hints: ['Χρησιμοποίησε την έτοιμη συνάρτηση angle().', 'Η ανοιχτή πόρτα είναι στις 90°.', 'if: angle(90)'],
      validationTests: [
        TS('Στην αρχή η πόρτα είναι κλειστή (0°)', [{ setup: true }, { loops: 1 }, { check: 'servo', angle: 0, fail: 'Χωρίς πάτημα περίμενα το servo στις 0°. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → η πόρτα ανοίγει (90°)', [{ setup: true }, { sequence: { button: [1] } }, { check: 'servo', angle: 90, fail: 'Με πατημένο κουμπί περίμενα το servo στις 90°. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → κλείνει', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'servo', angle: 0, fail: 'Όταν αφήνεις το κουμπί η πόρτα πρέπει να κλείνει (0°). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Η πόρτα ανοίγει και κλείνει! Η γωνία του servo είναι απλώς το μήκος ενός παλμού.',
      remediation: 'Στο if χρειάζεται angle(90).'
    }),
    Object.assign({}, BASE, {
      id: 'c36-l4', kind: 'guided', skills: ['micropython', 'sensors', 'conditions'],
      title: 'Φως διάθεσης: χρώματα με LED RGB',
      prerequisites: ['c36-l3'],
      objectives: ['Να ανακατεύω χρώματα με τρία PWM.', 'Να διαλέγω χρώμα από τη θερμοκρασία.'],
      theory: `
<p>Το <strong>LED RGB</strong> έχει τρία LED: κόκκινο (GPIO 32), πράσινο (33), μπλε (14). Με ένα PWM στο καθένα λες πόσο να ανάψει.</p>
<p>Η <code>color(r, g, b)</code> δέχεται 0…255 (όπως στη ζωγραφική) και τα κάνει duty 0…1020.</p>
<ul><li>(255, 0, 0) κόκκινο · (0, 255, 0) πράσινο · (0, 0, 255) μπλε · (255, 255, 0) κίτρινο</li></ul>`,
      glossary: ['LED RGB', 'PWM', 'duty'], supportedSyntax: SYN_PWM + ', dht.DHT22(Pin(13)), .measure(), .temperature(), elif',
      initialCode: MOOD_START, solution: MOOD_OK,
      world: { temp: 24 }, initialWorld: { temp: 24 }, hardware: ['rgb', 'sensor'], panels: PANELS,
      steps: ['Μετά το if, πρόσθεσε elif t <= 28: με color(0, 255, 0).', 'Πρόσθεσε else: με color(255, 0, 0).', 'Τρέξε και άλλαξε τη θερμοκρασία στις «Εισόδους».'],
      quiz: { question: 'Ποιο χρώμα δίνει το color(255, 255, 0);', options: ['Κίτρινο', 'Λευκό', 'Μωβ'], answer: 0, explain: 'Σωστά. Κόκκινο + πράσινο φως = κίτρινο.', retry: 'Ανάβουν το κόκκινο και το πράσινο. Τι βγάζουν μαζί;' },
      hints: ['Χρειάζεσαι elif και else.', 'Πράσινο = color(0, 255, 0), κόκκινο = color(255, 0, 0).', 'elif t <= 28:\n    color(0, 255, 0)\nelse:\n    color(255, 0, 0)'],
      validationTests: [
        TS('15 °C → μπλε', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 0, g: 0, b: 255, fail: 'Στους 15 °C περίμενα μπλε. Τώρα: {v}.' }], { temp: 15 }),
        TS('24 °C → πράσινο', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 0, g: 255, b: 0, fail: 'Στους 24 °C περίμενα πράσινο. Τώρα: {v}.' }], { temp: 24 }),
        TS('32 °C → κόκκινο', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 255, g: 0, b: 0, fail: 'Στους 32 °C περίμενα κόκκινο. Τώρα: {v}.' }], { temp: 32 })
      ],
      explanationOnSuccess: 'Το φως λέει τη θερμοκρασία με μια ματιά! Τρία PWM, άπειρα χρώματα.',
      remediation: 'Χρειάζονται τρεις περιπτώσεις: κάτω από 20 μπλε, έως 28 πράσινο, πάνω από 28 κόκκινο.'
    }),
    Object.assign({}, BASE, {
      id: 'c36-l5', kind: 'debug', skills: ['micropython', 'sensors', 'syntax'],
      title: 'Βρες το λάθος: η οθόνη μένει άδεια',
      prerequisites: ['c36-l4'],
      objectives: ['Να γράφω στην οθόνη OLED με το ssd1306.', 'Να καταλάβω ότι η οθόνη ενημερώνεται μόνο με oled.show().'],
      theory: `
<p>Η οθόνη <strong>OLED</strong> συνδέεται με <strong>I2C</strong>: δύο καλώδια, SDA (GPIO 21) και SCL (GPIO 22).</p>
<ol><li><code>i2c = I2C(0, scl=Pin(22), sda=Pin(21))</code></li>
<li><code>oled = ssd1306.SSD1306_I2C(128, 64, i2c)</code></li>
<li><code>oled.fill(0)</code> σβήνει τα πάντα.</li>
<li><code>oled.text("Temp:", 0, 0)</code> γράφει στη θέση x = 0, y = 0. Κάθε γραμμή έχει ύψος 8.</li>
<li><code>oled.show()</code> <strong>στέλνει</strong> όλα όσα έγραψες στην οθόνη.</li></ol>
<p>Τα <code>text()</code> γράφουν σε μια μνήμη· η οθόνη αλλάζει μόνο με <code>oled.show()</code>. Κάποιος το ξέχασε…</p>`,
      glossary: ['OLED', 'I2C'], supportedSyntax: SYN_OLED,
      initialCode: OLED_BUG, solution: OLED_OK,
      world: { temp: 24.5 }, initialWorld: { temp: 24.5 }, hardware: ['oled', 'sensor'], panels: PANELS,
      steps: ['Τρέξε: η οθόνη στη σκηνή μένει μαύρη.', 'Βρες τι λείπει μετά τα text().', 'Πρόσθεσέ το και ξανατρέξε.'],
      quiz: { question: 'Γιατί η οθόνη έμενε άδεια;', options: ['Τα text() γράφουν σε μνήμη· η οθόνη ενημερώνεται μόνο με oled.show()', 'Το text() δεν δέχεται αριθμούς', 'Το fill(0) σβήνει μόνιμα την οθόνη'], answer: 0, explain: 'Σωστά. Πρώτα «ζωγραφίζεις» στη μνήμη και μετά τη στέλνεις όλη μαζί.', retry: 'Τι κάνει το oled.show();' },
      hints: ['Η οθόνη ενημερώνεται μόνο με μία συγκεκριμένη εντολή.', 'Κοίτα το βήμα 5 στο «Μάθημα».', 'Πρόσθεσε oled.show() μετά το τελευταίο text().'],
      validationTests: [
        TS('Η θερμοκρασία φαίνεται στην οθόνη', [{ setup: true }, { loops: 1 }, { check: 'oled', has: '24.5', fail: 'Στην οθόνη περίμενα «24.5». Βλέπω: {v}.' }], { temp: 24.5 }),
        TS('Η οθόνη ενημερώνεται με νέα μέτρηση', [{ setup: true }, { loops: 1 }, { set: { temp: 30 } }, { loops: 1 }, { check: 'oled', has: '30', fail: 'Μετά από νέα μέτρηση περίμενα «30». Βλέπω: {v}.' }], { temp: 24.5 })
      ],
      explanationOnSuccess: 'Η οθόνη ζωντάνεψε! fill(0), text(), και στο τέλος show().',
      remediation: 'Λείπει το oled.show() μετά τα text().'
    })
  );
})(typeof window !== 'undefined' ? window : globalThis);
