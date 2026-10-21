/*
 * IoT Guardian — MicroPython στο ESP32, κεφάλαιο 32 (3ο του κλάδου): Συναρτήσεις και αισθητήρας θερμοκρασίας.
 * def, return, dht.DHT22 στο GPIO 13, try / except OSError (sensorFault), μέσος όρος μετρήσεων.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 32, title: 'Συναρτήσεις και αισθητήρας θερμοκρασίας', ready: true, track: 'py-esp32', lang: 'python', board: 'esp32', unlockAfter: 31 });
  if (!L.SKILLS.micropython) L.SKILLS.micropython = 'MicroPython';

  [
    { term: 'dht.DHT22', def: 'Το module dht της MicroPython διαβάζει τους αισθητήρες DHT11 και DHT22. sensor = dht.DHT22(Pin(13)), μετά sensor.measure() και sensor.temperature() / sensor.humidity().' },
    { term: 'measure()', def: 'Η εντολή που ζητά ΝΕΑ μέτρηση από τον DHT22. Τα temperature() και humidity() δίνουν την τιμή της τελευταίας μέτρησης. Χωρίς νέο measure() η τιμή δεν αλλάζει.' },
    { term: 'OSError', def: 'Εξαίρεση της Python για προβλήματα υλικού ή δικτύου. Ο DHT22 δίνει OSError: [Errno 110] ETIMEDOUT όταν δεν απαντά, π.χ. με χαλαρό καλώδιο.' },
    { term: 'None', def: 'Η τιμή «τίποτα» της Python. Μια συνάρτηση μπορεί να επιστρέψει None για να πει «δεν έχω μέτρηση». Ελέγχεται με if t is None: ή if t is not None:' },
    { term: 'μέσος όρος', def: 'Άθροισμα ÷ πλήθος: sum(values) / len(values). Ο μέσος όρος των τελευταίων μετρήσεων «ηρεμεί» τις μικρές αναπηδήσεις του αισθητήρα.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const BASE = { lang: 'python', board: 'esp32', chapter: 32 };
  const SYNTAX = 'import dht, dht.DHT22(Pin(13)), measure(), temperature(), humidity(), def, return, try / except OSError as e, None, is not None, λίστες: append, pop(0), len, sum, f-strings {t:.1f}, time.sleep(2)';
  const PANELS = ['serial', 'vars', 'branch', 'loops'];

  // ------------------------------------------------------------ 32.1
  const L1_CODE = (pin) => `# Θερμοκρασία και υγρασία από τον DHT22.
from machine import Pin
import dht
import time

sensor = dht.DHT22(Pin(${pin}))    # τα δεδομένα του DHT22 έρχονται στο GPIO 13

while True:
    sensor.measure()                 # ζήτα νέα μέτρηση
    t = sensor.temperature()         # °C
    h = sensor.humidity()            # %
    print(f"Temp: {t:.1f} C, Hum: {h:.0f} %")
    time.sleep(2)                    # ο DHT22 θέλει τουλάχιστον 2 s ανάμεσα στις μετρήσεις
`;

  // ------------------------------------------------------------ 32.2
  const L2_CODE = (body) => `# Θερμοκρασία σε °C και °F, με συναρτήσεις.
from machine import Pin
import dht
import time

sensor = dht.DHT22(Pin(13))

def c_to_f(c):
    # °F = °C × 9 / 5 + 32
    return ${body}

def read_temp():
    sensor.measure()
    return sensor.temperature()

while True:
    t = read_temp()
    f = c_to_f(t)
    print(f"{t:.1f} C = {f:.1f} F")
    time.sleep(2)
`;

  // ------------------------------------------------------------ 32.3
  const L3_HEAD = `# Το θερμόμετρο δεν πρέπει να «πεθαίνει» όταν ο αισθητήρας δεν απαντά.
from machine import Pin
import dht
import time

sensor = dht.DHT22(Pin(13))

`;
  const L3_INITIAL = L3_HEAD + `# ΑΛΛΑΞΕ: πιάσε το OSError. Στο σφάλμα τύπωσε "Sensor error:" και το e,
# και επίστρεψε None.
def read_sensor():
    sensor.measure()
    return sensor.temperature()

while True:
    t = read_sensor()
    # ΑΛΛΑΞΕ: τύπωσε μόνο αν υπάρχει μέτρηση (t is not None)
    print(f"Temp: {t:.1f} C")
    time.sleep(2)
`;
  const L3_SOLUTION = L3_HEAD + `def read_sensor():
    try:
        sensor.measure()
        return sensor.temperature()
    except OSError as e:
        print("Sensor error:", e)
        return None

while True:
    t = read_sensor()
    if t is not None:
        print(f"Temp: {t:.1f} C")
    time.sleep(2)
`;

  // ------------------------------------------------------------ 32.4
  const L4_HEAD = `# Μέσος όρος των 5 τελευταίων ΚΑΛΩΝ μετρήσεων.
from machine import Pin
import dht
import time

sensor = dht.DHT22(Pin(13))
SIZE = 5

def read_sensor():
    try:
        sensor.measure()
        return sensor.temperature()
    except OSError as e:
        print("Sensor error:", e)
        return None
`;
  const L4_INITIAL = L4_HEAD + `
# ΓΡΑΨΕ:
# 1. def average(values): επιστρέφει sum ÷ πλήθος
# 2. μια λίστα readings
# 3. στο while True: αν t is not None → append, κράτα μόνο τις SIZE τελευταίες,
#    και τύπωσε f"Avg: {avg:.1f} C (n={n})"  (n = πόσες τιμές έχει η λίστα)

while True:
    t = read_sensor()
    time.sleep(2)
`;
  const L4_SOLUTION = L4_HEAD + `
def average(values):
    return sum(values) / len(values)

readings = []

while True:
    t = read_sensor()
    if t is not None:
        readings.append(t)
        if len(readings) > SIZE:
            readings.pop(0)          # βγάλε την πιο παλιά
        avg = average(readings)
        n = len(readings)
        print(f"Avg: {avg:.1f} C (n={n})")
    time.sleep(2)
`;

  // ------------------------------------------------------------ 32.5
  const L5_INITIAL = `# Ειδοποίηση ζέστης: LED αναμμένο όταν t >= LIMIT.
# Παράπονο 1: «Η θερμοκρασία στο τερματικό δεν αλλάζει ποτέ.»
# Παράπονο 2: «Όταν ανάψει το LED, δεν ξανασβήνει.»
from machine import Pin
import dht
import time

LIMIT = 30
led = Pin(2, Pin.OUT)
sensor = dht.DHT22(Pin(13))
sensor.measure()

while True:
    t = sensor.temperature()
    print(f"Temp: {t:.1f} C")
    if t >= LIMIT:
        led.on()
        print("HOT")
    time.sleep(2)
`;
  const L5_SOLUTION = `# Ειδοποίηση ζέστης: LED αναμμένο όταν t >= LIMIT.
from machine import Pin
import dht
import time

LIMIT = 30
led = Pin(2, Pin.OUT)
sensor = dht.DHT22(Pin(13))

while True:
    sensor.measure()                 # νέα μέτρηση σε κάθε επανάληψη
    t = sensor.temperature()
    print(f"Temp: {t:.1f} C")
    if t >= LIMIT:
        led.on()
        print("HOT")
    else:
        led.off()
    time.sleep(2)
`;

  // ------------------------------------------------------------ 32.6
  const L6_INITIAL = `# Παρακολούθηση κλίματος.
# - read_sensor(): μέτρηση ή None (με try / except OSError, τύπωσε "Sensor error")
# - average(values)
# - Κράτα τις 3 τελευταίες καλές μετρήσεις.
# - Κάθε καλή μέτρηση: print(f"Temp: {t:.1f} C, Avg: {avg:.1f} C")
# - LED αναμμένο όταν avg >= LIMIT, αλλιώς σβηστό.
# - Σε σφάλμα αισθητήρα: το LED μένει όπως ήταν.
from machine import Pin
import dht
import time

LIMIT = 28
SIZE = 3
led = Pin(2, Pin.OUT)
sensor = dht.DHT22(Pin(13))

while True:
    time.sleep(2)
`;
  const L6_SOLUTION = `# Παρακολούθηση κλίματος.
from machine import Pin
import dht
import time

LIMIT = 28
SIZE = 3
led = Pin(2, Pin.OUT)
sensor = dht.DHT22(Pin(13))
readings = []

def read_sensor():
    try:
        sensor.measure()
        return sensor.temperature()
    except OSError as e:
        print("Sensor error:", e)
        return None

def average(values):
    return sum(values) / len(values)

while True:
    t = read_sensor()
    if t is not None:
        readings.append(t)
        if len(readings) > SIZE:
            readings.pop(0)
        avg = average(readings)
        print(f"Temp: {t:.1f} C, Avg: {avg:.1f} C")
        if avg >= LIMIT:
            led.on()
        else:
            led.off()
    time.sleep(2)
`;

  L.lessons.push(
    Object.assign({}, BASE, {
      id: 'c32-l1', kind: 'micro', skills: ['micropython', 'sensors'],
      title: 'Ο DHT22: θερμοκρασία και υγρασία',
      prerequisites: [],
      objectives: ['Να φτιάχνω έναν αισθητήρα DHT22 με το module dht.', 'Να ζητώ μέτρηση με measure().', 'Να τυπώνω δεκαδικά με f-string.'],
      theory: `
<p>Ο <strong>DHT22</strong> μετρά θερμοκρασία και υγρασία. Μιλά με την πλακέτα από <strong>ένα</strong> καλώδιο δεδομένων: εδώ το <strong>GPIO 13</strong>.</p>
<pre>import dht
sensor = dht.DHT22(Pin(13))
sensor.measure()            # 1. ζήτα μέτρηση
t = sensor.temperature()    # 2. διάβασε °C
h = sensor.humidity()       # 3. διάβασε %</pre>
<ul>
  <li>Το <code>measure()</code> κάνει τη μέτρηση. Τα άλλα δύο απλώς <strong>διαβάζουν</strong> το αποτέλεσμα.</li>
  <li>Ο DHT22 θέλει <strong>τουλάχιστον 2 δευτερόλεπτα</strong> ανάμεσα στις μετρήσεις.</li>
  <li><code>{t:.1f}</code> = με ένα δεκαδικό. <code>{h:.0f}</code> = χωρίς δεκαδικά.</li>
</ul>
<p>Στη σκηνή αλλάζεις θερμοκρασία και υγρασία με τα ρυθμιστικά του αισθητήρα.</p>`,
      glossary: ['dht.DHT22', 'measure()', 'αισθητήρας', 'f-string'],
      supportedSyntax: SYNTAX,
      initialCode: L1_CODE('____'),
      solution: L1_CODE('13'),
      world: { temp: 23.4, humidity: 51 }, initialWorld: { temp: 23.4, humidity: 51 },
      hardware: ['sensor'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το GPIO του DHT22.',
        'Τρέξε. Άλλαξε τη θερμοκρασία στη σκηνή και δες το Τερματικό.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η θερμοκρασία είναι 23.45 °C. Τι τυπώνει το f"{t:.1f}";',
        options: ['23.5 ή 23.4 (ένα δεκαδικό)', '23.45', '23'],
        answer: 0,
        explain: 'Σωστά. Το .1f κρατά ένα δεκαδικό ψηφίο. Ο ίδιος ο DHT22 δίνει έτσι κι αλλιώς ένα δεκαδικό.',
        retry: 'Όχι ακόμα. Το νούμερο μετά την τελεία στο .1f λέει πόσα δεκαδικά μένουν.'
      },
      hints: [
        'Ο DHT22 είναι συνδεδεμένος σε ένα συγκεκριμένο GPIO της πλακέτας.',
        'Δες τη θεωρία: το καλώδιο δεδομένων είναι στο GPIO 13.',
        'sensor = dht.DHT22(Pin(13))\n• 13 = ο αριθμός του GPIO, χωρίς εισαγωγικά'
      ],
      validationTests: [
        { name: '23.4 °C και 51 % → σωστή γραμμή', script: [
          { setup: true }, { loops: 2 },
          { check: 'lastLine', is: 'Temp: 23.4 C, Hum: 51 %', fail: 'Η τελευταία γραμμή είναι {v}. Περίμενα «Temp: 23.4 C, Hum: 51 %».' }
        ] },
        { name: 'Η μέτρηση ακολουθεί τον αισθητήρα', script: [
          { setup: true }, { loops: 1 }, { set: { temp: 26.8 } }, { loops: 1 },
          { check: 'serialHas', text: 'Temp: 26.8 C', fail: 'Άλλαξα τη θερμοκρασία σε 26.8 °C, αλλά το Τερματικό έγραψε: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα μετρά! Σε αληθινό DHT22 το measure() κρατά λίγα χιλιοστά. Και υπάρχει όριο: μία μέτρηση κάθε 2 δευτερόλεπτα.',
      remediation: 'Αν δεις σφάλμα στη γραμμή του DHT22, έλεγξε ότι γράφεις dht.DHT22(Pin(13)) με δύο κλεισίματα παρενθέσεων.'
    }),

    Object.assign({}, BASE, {
      id: 'c32-l2', kind: 'guided', skills: ['micropython', 'timing', 'sensors'],
      title: 'Δικές μου συναρτήσεις: από °C σε °F',
      prerequisites: ['c32-l1'],
      objectives: ['Να γράφω συνάρτηση με def και return.', 'Να καλώ μια συνάρτηση με όρισμα.', 'Να κρύβω τις λεπτομέρειες της μέτρησης σε μια συνάρτηση.'],
      theory: `
<p>Μια <strong>συνάρτηση</strong> είναι ένα κομμάτι κώδικα με όνομα.</p>
<pre>def c_to_f(c):
    return c * 9 / 5 + 32</pre>
<ul>
  <li><code>def</code> → «φτιάχνω συνάρτηση». Μετά: όνομα, παράμετροι σε παρένθεση, <code>:</code></li>
  <li><code>return</code> → η τιμή που «δίνει πίσω».</li>
  <li>Κλήση: <code>f = c_to_f(25)</code> → <code>f</code> = 77.0</li>
</ul>
<p>Το <code>read_temp()</code> κρύβει δύο βήματα (measure + temperature). Ο βρόχος γίνεται πιο καθαρός.</p>
<p>Η συνάρτηση πρέπει να γραφτεί <strong>πριν</strong> την καλέσεις.</p>`,
      glossary: ['def', 'return', 'παράμετρος', 'κλήση συνάρτησης'],
      supportedSyntax: SYNTAX,
      initialCode: L2_CODE('____'),
      solution: L2_CODE('c * 9 / 5 + 32'),
      world: { temp: 25 }, initialWorld: { temp: 25 },
      hardware: ['sensor'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τον τύπο μετά το return.',
        'Τρέξε. Βάλε τη θερμοκρασία στο 0 °C. Βγαίνει 32.0 F;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι επιστρέφει το c_to_f(100);',
        options: ['212.0', '180.0', '132.0'],
        answer: 0,
        explain: 'Σωστά. 100 × 9 / 5 = 180, και 180 + 32 = 212. Το νερό βράζει στους 212 °F.',
        retry: 'Όχι ακόμα. Πρώτα 100 × 9 / 5, μετά + 32.'
      },
      hints: [
        'Η συνάρτηση παίρνει °C στην παράμετρο c και πρέπει να δώσει πίσω °F.',
        'Ο τύπος είναι στο σχόλιο: °C × 9 / 5 + 32. Στη Python το «επί» είναι *.',
        'return c * 9 / 5 + 32\n• c = η παράμετρος\n• return = δώσε πίσω το αποτέλεσμα'
      ],
      validationTests: [
        { name: '25 °C → 77.0 F', world: { temp: 25 }, script: [
          { setup: true }, { loops: 1 },
          { check: 'lastLine', is: '25.0 C = 77.0 F', fail: 'Με 25 °C η γραμμή είναι {v}. Περίμενα «25.0 C = 77.0 F».' }
        ] },
        { name: '-10 °C → 14.0 F', world: { temp: -10 }, script: [
          { setup: true }, { loops: 1 },
          { check: 'lastLine', is: '-10.0 C = 14.0 F', fail: 'Με -10 °C η γραμμή είναι {v}. Περίμενα «-10.0 C = 14.0 F».' }
        ] }
      ],
      explanationOnSuccess: 'Έγραψες τις πρώτες σου συναρτήσεις στη MicroPython! Το c_to_f δεν ξέρει τίποτα για τον αισθητήρα: μπορείς να το ξαναχρησιμοποιήσεις σε κάθε πρόγραμμα.',
      remediation: 'Αν βγαίνει λάθος αριθμός, έλεγξε τη σειρά: c * 9 / 5 + 32. Με παρένθεση (5 + 32) αλλάζει το αποτέλεσμα.'
    }),

    Object.assign({}, BASE, {
      id: 'c32-l3', kind: 'guided', skills: ['micropython', 'sensors', 'conditions'],
      title: 'Όταν ο αισθητήρας δεν απαντά: try / except',
      prerequisites: ['c32-l2'],
      objectives: ['Να πιάνω το OSError του DHT22 με try / except.', 'Να επιστρέφω None όταν δεν υπάρχει μέτρηση.', 'Να κρατώ το πρόγραμμα ζωντανό μετά από σφάλμα.'],
      theory: `
<p>Ένα χαλαρό καλώδιο και ο DHT22 δεν απαντά. Το <code>measure()</code> τότε σηκώνει:</p>
<pre>OSError: [Errno 110] ETIMEDOUT</pre>
<p>Χωρίς προστασία, το πρόγραμμα <strong>σταματά</strong>. Η πλακέτα δεν μετρά ποτέ ξανά, μέχρι κάποιος να την κάνει restart.</p>
<pre>try:
    sensor.measure()
    return sensor.temperature()
except OSError as e:
    print("Sensor error:", e)
    return None</pre>
<ul>
  <li>Μέσα στο <code>try</code>: ό,τι μπορεί να αποτύχει.</li>
  <li>Στο <code>except OSError</code>: τι κάνεις αν αποτύχει.</li>
  <li><code>None</code> = «δεν έχω μέτρηση». Ο βρόχος ελέγχει <code>if t is not None:</code></li>
</ul>
<p>Στη σκηνή, ο διακόπτης «σφάλμα αισθητήρα» προσομοιώνει το χαλαρό καλώδιο.</p>`,
      glossary: ['try / except', 'OSError', 'None', 'μήνυμα λάθους'],
      supportedSyntax: SYNTAX,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: { temp: 22.5 }, initialWorld: { temp: 22.5, sensorFault: false },
      hardware: ['sensor'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε και άναψε το «σφάλμα αισθητήρα» στη σκηνή. Τι γίνεται;',
        'Βάλε το measure() και το return μέσα σε try. Γράψε το except OSError as e.',
        'Στον βρόχο, τύπωσε μόνο αν t is not None.',
        'Τρέξε ξανά: σφάλμα, μετά διόρθωση. Συνεχίζει να μετρά;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο αισθητήρας δεν απαντά και δεν υπάρχει try / except. Τι κάνει η πλακέτα μετά;',
        options: ['Σταματά το πρόγραμμα και δεν μετρά ξανά', 'Ξαναδοκιμάζει μόνη της σε 2 δευτερόλεπτα', 'Τυπώνει 0.0 και συνεχίζει'],
        answer: 0,
        explain: 'Σωστά. Μια εξαίρεση που δεν πιάνεται σταματά όλο το main.py. Γι’ αυτό το try / except είναι απαραίτητο σε συσκευές που δουλεύουν μόνες τους.',
        retry: 'Όχι ακόμα. Τι κάνει η Python όταν μια εξαίρεση δεν πιάνεται πουθενά;'
      },
      hints: [
        'Το σφάλμα γεννιέται στο sensor.measure(). Αυτή η γραμμή πρέπει να είναι μέσα σε try.',
        'Μετά το try: γράψε except OSError as e: με print("Sensor error:", e) και return None. Στον βρόχο: if t is not None:',
        'def read_sensor():\n    try:\n        sensor.measure()\n        return sensor.temperature()\n    except OSError as e:\n        print("Sensor error:", e)\n        return None'
      ],
      validationTests: [
        { name: 'Χαλασμένος αισθητήρας → μήνυμα, όχι σταμάτημα', world: { sensorFault: true }, script: [
          { setup: true }, { loops: 3 },
          { check: 'count', text: 'Sensor error: [Errno 110] ETIMEDOUT', is: 3, fail: 'Σε 3 επαναλήψεις με σφάλμα τυπώθηκε {n} φορές «Sensor error: [Errno 110] ETIMEDOUT». Περίμενα 3.', failZero: 'Με σφάλμα αισθητήρα δεν τυπώθηκε «Sensor error: …». Πιάσε το OSError και τύπωσε print("Sensor error:", e).' },
          { check: 'serialNot', text: 'Temp:', fail: 'Χωρίς μέτρηση τυπώθηκε «Temp: …». Τύπωνε μόνο αν t is not None.' }
        ] },
        { name: 'Μετά το σφάλμα συνεχίζει να μετρά', script: [
          { setup: true }, { loops: 1 },
          { set: { sensorFault: true } }, { loops: 1 },
          { set: { sensorFault: false, temp: 24.1 } }, { loops: 1 },
          { check: 'lastLine', is: 'Temp: 24.1 C', fail: 'Μετά τη διόρθωση του αισθητήρα η τελευταία γραμμή είναι {v}. Περίμενα «Temp: 24.1 C».' }
        ] }
      ],
      explanationOnSuccess: 'Τώρα το θερμόμετρο αντέχει! Μια συσκευή IoT δουλεύει μόνη της για μήνες. Ένα σφάλμα αισθητήρα δεν πρέπει ποτέ να τη «σκοτώνει».',
      remediation: 'Αν δεις «TypeError» στο f-string, το t είναι None. Βάλε το print μέσα σε if t is not None:'
    }),

    Object.assign({}, BASE, {
      id: 'c32-l4', kind: 'independent', skills: ['micropython', 'sensors', 'variables'],
      title: 'Ανεξάρτητη άσκηση: μέσος όρος μετρήσεων',
      prerequisites: ['c32-l3'],
      objectives: ['Να κρατώ τις τελευταίες τιμές σε λίστα.', 'Να γράφω συνάρτηση average.', 'Να αγνοώ τις αποτυχημένες μετρήσεις.'],
      theory: `
<p>Οι αισθητήρες «τρεμοπαίζουν»: 22.4, 22.6, 22.3… Ο <strong>μέσος όρος</strong> των τελευταίων τιμών δίνει πιο ήρεμη εικόνα.</p>
<pre>readings.append(t)          # βάλε στο τέλος
if len(readings) > SIZE:
    readings.pop(0)         # βγάλε την πιο παλιά</pre>
<ul>
  <li>Η λίστα κρατά <strong>το πολύ</strong> <code>SIZE</code> τιμές.</li>
  <li><code>sum(values) / len(values)</code> = μέσος όρος.</li>
  <li>Μόνο <strong>καλές</strong> μετρήσεις μπαίνουν στη λίστα. Το <code>None</code> μένει έξω.</li>
</ul>
<p>Τύπωσε: <code>f"Avg: {avg:.1f} C (n={n})"</code>, όπου <code>n</code> = πόσες τιμές έχει η λίστα.</p>`,
      glossary: ['μέσος όρος', 'λίστα', 'None', 'def'],
      supportedSyntax: SYNTAX,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: { temp: 22 }, initialWorld: { temp: 22 },
      hardware: ['sensor'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Γράψε τη συνάρτηση average(values).',
        'Φτιάξε readings = [] πριν από τον βρόχο.',
        'Στον βρόχο: πρόσθεσε κάθε καλή τιμή, κράτα τις 5 τελευταίες, τύπωσε τον μέσο όρο.',
        'Δοκίμασε με σφάλμα αισθητήρα: ο μέσος όρος μένει σωστός;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η λίστα έχει [20, 21, 22, 23, 24] και SIZE = 5. Έρχεται 30. Ποιος είναι ο νέος μέσος όρος;',
        options: ['24.0', '23.3', '22.0'],
        answer: 0,
        explain: 'Σωστά. Φεύγει το 20 και μένουν [21, 22, 23, 24, 30]. Άθροισμα 120 ÷ 5 = 24.0.',
        retry: 'Όχι ακόμα. Πρώτα βγαίνει η πιο παλιά τιμή (20). Μετά άθροισε τις 5 που μένουν.'
      },
      hints: [
        'Χρειάζεσαι: μια συνάρτηση, μια λίστα πριν από τον βρόχο, και ένα if t is not None μέσα στον βρόχο.',
        'Μέσα στο if: readings.append(t), μετά if len(readings) > SIZE: readings.pop(0), μετά avg = average(readings) και n = len(readings).',
        'def average(values):\n    return sum(values) / len(values)\n\nreadings = []\nwhile True:\n    t = read_sensor()\n    if t is not None:\n        readings.append(t)\n        if len(readings) > SIZE:\n            readings.pop(0)\n        avg = average(readings)\n        n = len(readings)\n        print(f"Avg: {avg:.1f} C (n={n})")\n    time.sleep(2)'
      ],
      validationTests: [
        { name: 'Πέντε μετρήσεις → μέσος όρος 22.0', script: [
          { setup: true }, { sequence: { temp: [20, 21, 22, 23, 24] } },
          { check: 'lastLine', is: 'Avg: 22.0 C (n=5)', fail: 'Μετά από 20, 21, 22, 23, 24 η τελευταία γραμμή είναι {v}. Περίμενα «Avg: 22.0 C (n=5)».' }
        ] },
        { name: 'Η πιο παλιά τιμή φεύγει', script: [
          { setup: true }, { sequence: { temp: [20, 21, 22, 23, 24, 30] } },
          { check: 'lastLine', is: 'Avg: 24.0 C (n=5)', fail: 'Μετά από 20…24 και 30 η τελευταία γραμμή είναι {v}. Περίμενα «Avg: 24.0 C (n=5)». Κρατάς μόνο τις 5 τελευταίες;' }
        ] },
        { name: 'Τα σφάλματα δεν μπαίνουν στον μέσο όρο', script: [
          { setup: true }, { sequence: { temp: [20, 22] } },
          { set: { sensorFault: true } }, { loops: 2 },
          { set: { sensorFault: false, temp: 24 } }, { loops: 1 },
          { check: 'lastLine', is: 'Avg: 22.0 C (n=3)', fail: 'Μετά από 20, 22, δύο σφάλματα και 24 η τελευταία γραμμή είναι {v}. Περίμενα «Avg: 22.0 C (n=3)».' }
        ] }
      ],
      explanationOnSuccess: 'Μέσος όρος με «κυλιόμενο παράθυρο»: η λίστα κρατά πάντα τις πιο πρόσφατες τιμές. Ένα σφάλμα δεν χαλά τον μέσο όρο, γιατί δεν μπαίνει καν στη λίστα.',
      remediation: 'Αν το n μεγαλώνει πάνω από 5, λείπει το pop(0). Αν δεις «ZeroDivisionError», υπολογίζεις μέσο όρο σε άδεια λίστα: βάλε τον υπολογισμό μέσα στο if t is not None.'
    }),

    Object.assign({}, BASE, {
      id: 'c32-l5', kind: 'debug', skills: ['micropython', 'sensors', 'conditions'],
      title: 'Βρες το λάθος: η θερμοκρασία που «κόλλησε»',
      prerequisites: ['c32-l4'],
      objectives: ['Να καταλαβαίνω ότι χωρίς measure() η τιμή δεν ανανεώνεται.', 'Να σβήνω ξανά μια έξοδο με else.'],
      theory: `
<p>Δύο παράπονα από τον πελάτη:</p>
<ol>
  <li>«Η θερμοκρασία στο τερματικό δεν αλλάζει ποτέ.»</li>
  <li>«Όταν ανάψει το LED, δεν ξανασβήνει.»</li>
</ol>
<p>Θυμήσου:</p>
<ul>
  <li>Το <code>temperature()</code> δίνει την τιμή της <strong>τελευταίας</strong> μέτρησης. Νέα τιμή υπάρχει μόνο μετά από νέο <code>measure()</code>.</li>
  <li>Αν ένα <code>if</code> ανάβει το LED, κάποιος πρέπει και να το <strong>σβήνει</strong> όταν η συνθήκη πάψει να ισχύει.</li>
</ul>
<p>Παρακολούθησε το πάνελ «Μεταβλητές»: αλλάζει το <code>t</code> όταν αλλάζεις τη θερμοκρασία στη σκηνή;</p>`,
      glossary: ['measure()', 'if / else', 'dht.DHT22'],
      supportedSyntax: SYNTAX,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: { temp: 22 }, initialWorld: { temp: 22 },
      hardware: ['sensor', 'led'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε. Ανέβασε τη θερμοκρασία στους 32 °C. Αλλάζει το t;',
        'Μετακίνησε το measure() εκεί που πρέπει.',
        'Πρόσθεσε else που σβήνει το LED.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το sensor.measure() τρέχει μία φορά, πριν από το while True. Τι δίνει το sensor.temperature() μέσα στον βρόχο;',
        options: ['Πάντα την ίδια, πρώτη τιμή', 'Κάθε φορά νέα τιμή', 'Σφάλμα'],
        answer: 0,
        explain: 'Σωστά. Το temperature() διαβάζει το αποτέλεσμα της τελευταίας μέτρησης, και αυτή έγινε μόνο μία φορά.',
        retry: 'Όχι ακόμα. Ποια εντολή κάνει πραγματικά τη μέτρηση;'
      },
      hints: [
        'Το ένα λάθος είναι στη θέση μιας γραμμής. Το άλλο είναι κάτι που λείπει.',
        'Το sensor.measure() πρέπει να είναι μέσα στο while True. Μετά το if χρειάζεται else: led.off().',
        'while True:\n    sensor.measure()\n    t = sensor.temperature()\n    …\n    if t >= LIMIT:\n        led.on()\n        print("HOT")\n    else:\n        led.off()'
      ],
      validationTests: [
        { name: 'Κανονική θερμοκρασία → LED σβηστό', script: [
          { setup: true }, { loops: 1 },
          { check: 'led', is: false, fail: 'Στους 22 °C το LED είναι {v}.' }
        ] },
        { name: 'Ζέστη → «HOT» και LED αναμμένο', script: [
          { setup: true }, { loops: 1 }, { set: { temp: 32 } }, { loops: 1 },
          { check: 'serialHas', text: 'Temp: 32.0 C', fail: 'Άλλαξα σε 32 °C αλλά το Τερματικό έγραψε: {v}. Η τιμή ανανεώνεται; Πού είναι το measure();' },
          { check: 'lastLine', is: 'HOT', fail: 'Στους 32 °C η τελευταία γραμμή είναι {v}. Περίμενα «HOT».' },
          { check: 'led', is: true, fail: 'Στους 32 °C το LED είναι {v}.' }
        ] },
        { name: 'Δροσίζει → το LED σβήνει', script: [
          { setup: true }, { set: { temp: 32 } }, { loops: 1 }, { set: { temp: 25 } }, { loops: 1 },
          { check: 'lastLine', is: 'Temp: 25.0 C', fail: 'Μετά την πτώση στους 25 °C η τελευταία γραμμή είναι {v}. Περίμενα «Temp: 25.0 C».' },
          { check: 'led', is: false, fail: 'Στους 25 °C το LED είναι ακόμα {v}. Πρόσθεσε else: led.off().' }
        ] }
      ],
      explanationOnSuccess: 'Βρήκες και τα δύο λάθη. Το «κολλημένο» measure() είναι ύπουλο: σε αληθινή πλακέτα δεν βγάζει κανένα μήνυμα, απλώς δείχνει παλιά τιμή για πάντα.',
      remediation: 'Αν το t δεν αλλάζει στο πάνελ «Μεταβλητές», το measure() είναι ακόμα έξω από τον βρόχο.'
    }),

    Object.assign({}, BASE, {
      id: 'c32-l6', kind: 'checkpoint', skills: ['micropython', 'sensors', 'conditions', 'timing'],
      title: 'Έλεγχος κεφαλαίου: παρακολούθηση κλίματος',
      prerequisites: ['c32-l5'],
      objectives: ['Να συνδυάζω συναρτήσεις, try / except και λίστα.', 'Να παίρνω απόφαση από τον μέσο όρο και όχι από μία τιμή.', 'Να μην αλλάζω έξοδο όταν δεν υπάρχει μέτρηση.'],
      theory: `
<p>Το δωμάτιο του server πρέπει να μένει δροσερό. Φτιάξε μια «παρακολούθηση κλίματος»:</p>
<ol>
  <li><code>read_sensor()</code>: δίνει τη θερμοκρασία ή <code>None</code>. Σε σφάλμα τυπώνει <code>"Sensor error: …"</code>.</li>
  <li><code>average(values)</code>.</li>
  <li>Κράτα τις <strong>3</strong> τελευταίες καλές μετρήσεις (<code>SIZE</code>).</li>
  <li>Σε κάθε καλή μέτρηση: <code>print(f"Temp: {t:.1f} C, Avg: {avg:.1f} C")</code></li>
  <li>LED αναμμένο όταν <code>avg &gt;= LIMIT</code> (28), αλλιώς σβηστό.</li>
  <li>Σε σφάλμα: το LED μένει <strong>όπως ήταν</strong>.</li>
</ol>
<p>Γιατί μέσος όρος; Μία ψηλή τιμή μπορεί να είναι «θόρυβος». Τρεις στη σειρά είναι πραγματική ζέστη.</p>`,
      glossary: ['μέσος όρος', 'try / except', 'None', 'όριο'],
      supportedSyntax: SYNTAX,
      initialCode: L6_INITIAL,
      solution: L6_SOLUTION,
      world: { temp: 24 }, initialWorld: { temp: 24 },
      hardware: ['sensor', 'led'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Γράψε τις δύο συναρτήσεις (μπορείς να ξεκινήσεις από τις προηγούμενες ασκήσεις).',
        'Φτιάξε τη λίστα και τον βρόχο.',
        'Δοκίμασε: ζέστη, δροσιά, σφάλμα αισθητήρα.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Οι 3 τελευταίες τιμές είναι 25, 25, 31. Το LIMIT είναι 28. Τι κάνει το LED;',
        options: ['Μένει σβηστό: ο μέσος όρος είναι 27.0', 'Ανάβει: το 31 είναι πάνω από 28', 'Αναβοσβήνει'],
        answer: 0,
        explain: 'Σωστά. (25 + 25 + 31) ÷ 3 = 27.0, που είναι κάτω από 28. Η απόφαση βγαίνει από τον μέσο όρο, όχι από μία τιμή.',
        retry: 'Όχι ακόμα. Υπολόγισε τον μέσο όρο των τριών και σύγκρινέ τον με το 28.'
      },
      hints: [
        'Ξεκίνα από το read_sensor() με try / except και το average() της άσκησης με τον μέσο όρο.',
        'Στον βρόχο: if t is not None: append, pop(0) αν > SIZE, avg = average(readings), print, και if avg >= LIMIT: led.on() else: led.off().',
        'while True:\n    t = read_sensor()\n    if t is not None:\n        readings.append(t)\n        if len(readings) > SIZE:\n            readings.pop(0)\n        avg = average(readings)\n        print(f"Temp: {t:.1f} C, Avg: {avg:.1f} C")\n        if avg >= LIMIT:\n            led.on()\n        else:\n            led.off()\n    time.sleep(2)'
      ],
      validationTests: [
        { name: 'Ζέστη → LED αναμμένο', script: [
          { setup: true }, { sequence: { temp: [27, 28, 29] } },
          { check: 'lastLine', is: 'Temp: 29.0 C, Avg: 28.0 C', fail: 'Μετά από 27, 28, 29 η τελευταία γραμμή είναι {v}. Περίμενα «Temp: 29.0 C, Avg: 28.0 C».' },
          { check: 'led', is: true, fail: 'Με μέσο όρο 28.0 το LED είναι {v}. Περίμενα αναμμένο (avg >= LIMIT).' }
        ] },
        { name: 'Δροσίζει → ο μέσος όρος πέφτει, LED σβηστό', script: [
          { setup: true }, { sequence: { temp: [29, 29, 29, 25, 25] } },
          { check: 'lastLine', is: 'Temp: 25.0 C, Avg: 26.3 C', fail: 'Μετά από 29, 29, 29, 25, 25 η τελευταία γραμμή είναι {v}. Περίμενα «Temp: 25.0 C, Avg: 26.3 C» (μόνο οι 3 τελευταίες).' },
          { check: 'led', is: false, fail: 'Με μέσο όρο 26.3 το LED είναι {v}. Περίμενα σβηστό.' }
        ] },
        { name: 'Σφάλμα αισθητήρα → όχι σταμάτημα, LED όπως ήταν', script: [
          { setup: true }, { sequence: { temp: [30, 30, 30] } },
          { set: { sensorFault: true } }, { loops: 2 },
          { check: 'serialHas', text: 'Sensor error', fail: 'Με σφάλμα αισθητήρα δεν τυπώθηκε «Sensor error». Το Τερματικό: {v}.' },
          { check: 'led', is: true, fail: 'Στο σφάλμα το LED έγινε {v}. Χωρίς μέτρηση, μην αλλάζεις το LED.' },
          { set: { sensorFault: false, temp: 20 } }, { loops: 3 },
          { check: 'led', is: false, fail: 'Μετά τη διόρθωση και τρεις μετρήσεις στους 20 °C το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο! Συναρτήσεις, αισθητήρας, σφάλματα και μέσος όρος. Στο επόμενο κεφάλαιο η πλακέτα θα συνδεθεί στο WiFi.',
      remediation: 'Αν το πρόγραμμα σταματά στο σφάλμα, το measure() δεν είναι μέσα σε try. Αν το LED σβήνει στο σφάλμα, το if avg >= LIMIT είναι έξω από το if t is not None.'
    })
  );
})(typeof window !== 'undefined' ? window : globalThis);
