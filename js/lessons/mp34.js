/*
 * IoT Guardian — MicroPython στο ESP32, κεφάλαιο 34 (5ο του κλάδου): MQTT με umqtt.
 * MQTTClient, connect, publish (json.dumps), subscribe + set_callback + check_msg,
 * αμυντικός έλεγχος εισερχόμενων εντολών, user / password από το config.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 34, title: 'MQTT με umqtt', ready: true, track: 'py-esp32', lang: 'python', board: 'esp32', unlockAfter: 33 });
  if (!L.SKILLS.micropython) L.SKILLS.micropython = 'MicroPython';

  [
    { term: 'umqtt.simple', def: 'Μικρή βιβλιοθήκη MQTT της MicroPython. from umqtt.simple import MQTTClient. Σε αληθινή πλακέτα, αν λείπει, την εγκαθιστάς με mpremote mip install umqtt.simple.' },
    { term: 'MQTTClient', def: 'Ο client MQTT της umqtt: MQTTClient("esp32-temp", "broker.home.lan", user=…, password=…). Μετά connect(), publish(topic, msg), subscribe(topic).' },
    { term: 'set_callback', def: 'client.set_callback(on_message): λέει στη umqtt ποια συνάρτηση να καλέσει για κάθε μήνυμα που έρχεται. Γράφεται ΠΡΙΝ από το subscribe. Η συνάρτηση παίρνει (topic, msg), και τα δύο bytes.' },
    { term: 'check_msg', def: 'client.check_msg() κοιτά αν ήρθε μήνυμα και, αν ναι, καλεί το callback. Δεν περιμένει. Το καλείς σε κάθε γύρο του while True. Το wait_msg() αντίθετα περιμένει μέχρι να έρθει μήνυμα.' },
    { term: 'MQTTException', def: 'Η εξαίρεση της umqtt όταν ο broker απορρίπτει τη σύνδεση. Ο κωδικός 5 σημαίνει «δεν επιτρέπεται» (π.χ. λάθος ή καθόλου στοιχεία σύνδεσης).' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const BASE = { lang: 'python', board: 'esp32', chapter: 34 };
  const SYNTAX = 'from umqtt.simple import MQTTClient, MQTTClient(client_id, server, user=…, password=…), connect(), publish(topic, msg, retain=…), subscribe(topic), set_callback(f), check_msg(), json.dumps, json.loads, bytes.decode(), try / except, isinstance, dict.get';
  const PANELS = ['serial', 'vars', 'mqtt', 'net'];
  const WIFI = { WIFI_SSID: 'SmartHome-Lab', WIFI_PASS: 'lab-pass-123' };
  const OPEN = 'listener 1883\nallow_anonymous true\n';
  const DASH = { name: 'dashboard', subs: ['home/#'] };
  const OPEN_WORLD = { broker: OPEN, clients: [DASH], consts: WIFI };

  const MQTT_PASS = 'Temp-Lab-Key-0815';
  const SECURE_WORLD = {
    broker: `listener 1883\nallow_anonymous false\npassword esp32-temp ${MQTT_PASS}\npassword dashboard Dash-Lab-Key-2026\n`,
    clients: [{ name: 'dashboard', subs: ['home/#'], user: 'dashboard', pass: 'Dash-Lab-Key-2026', port: 1883 }],
    consts: Object.assign({ MQTT_USER: 'esp32-temp', MQTT_PASS }, WIFI)
  };

  // Σύνδεση στο WiFi (από το προηγούμενο κεφάλαιο), σε σύντομη μορφή.
  const WIFI_CODE = `wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(config.WIFI_SSID, config.WIFI_PASS)
while not wlan.isconnected():
    time.sleep_ms(200)
print("WiFi OK")`;

  // ------------------------------------------------------------ 34.1
  const L1_CODE = (host) => `# Η πρώτη σύνδεση στον broker του σπιτιού.
import network
import time
import config
from umqtt.simple import MQTTClient

${WIFI_CODE}

client = MQTTClient("esp32-temp", ${host})   # όνομα client, όνομα broker
client.connect()
print("MQTT connected")

# «Είμαι εδώ»: retained, ώστε να το βλέπει κι όποιος συνδεθεί αργότερα.
client.publish("home/esp32/status", "online", retain=True)

while True:
    time.sleep(1)
`;

  // ------------------------------------------------------------ 34.2
  const L2_CODE = (payload) => `# Το θερμόμετρο στέλνει JSON κάθε 5 δευτερόλεπτα.
from machine import Pin
import dht
import json
import network
import time
import config
from umqtt.simple import MQTTClient

sensor = dht.DHT22(Pin(13))

${WIFI_CODE}

client = MQTTClient("esp32-temp", "broker.home.lan")
client.connect()

while True:
    sensor.measure()
    data = {"t": sensor.temperature(), "h": sensor.humidity()}
    client.publish("home/temperature", ${payload})
    print("Sent", data["t"])
    time.sleep(5)
`;

  // ------------------------------------------------------------ 34.3
  const L3_CODE = (cb, check) => `# Η λάμπα ακούει εντολές από το dashboard στο home/led/set.
from machine import Pin
import network
import time
import config
from umqtt.simple import MQTTClient

led = Pin(2, Pin.OUT)

${WIFI_CODE}

def on_message(topic, msg):          # topic και msg είναι bytes
    text = msg.decode()              # bytes → κείμενο
    print("Command:", text)
    if text == "ON":
        led.on()
    elif text == "OFF":
        led.off()

client = MQTTClient("esp32-lamp", "broker.home.lan")
client.set_callback(${cb})           # ποια συνάρτηση καλείται για κάθε μήνυμα
client.connect()
client.subscribe("home/led/set")

while True:
    ${check}                         # έλεγξε για νέο μήνυμα (χωρίς αναμονή)
    time.sleep_ms(100)
`;

  // ------------------------------------------------------------ 34.4
  const L4_HEAD = `# Η λάμπα του σαλονιού.
# Παράπονο 1: «Σταματά με σφάλμα μόλις ξεκινήσει.»
# Παράπονο 2: «Όταν ξεκινήσει, βλέπει τις εντολές αλλά το LED δεν αλλάζει ποτέ.»
from machine import Pin
import network
import time
import config
from umqtt.simple import MQTTClient

led = Pin(2, Pin.OUT)

${WIFI_CODE}

`;
  const L4_INITIAL = L4_HEAD + `def on_message(topic, msg):
    print("Got", topic, msg)
    if msg == "ON":
        led.on()
    elif msg == "OFF":
        led.off()

client = MQTTClient("esp32-lamp", "broker.home.lan")
client.connect()
client.subscribe("home/led/set")
client.set_callback(on_message)

while True:
    client.check_msg()
    time.sleep_ms(100)
`;
  const L4_SOLUTION = L4_HEAD + `def on_message(topic, msg):
    print("Got", topic, msg)
    text = msg.decode()              # bytes → str
    if text == "ON":
        led.on()
    elif text == "OFF":
        led.off()

client = MQTTClient("esp32-lamp", "broker.home.lan")
client.set_callback(on_message)      # πρώτα το callback
client.connect()
client.subscribe("home/led/set")

while True:
    client.check_msg()
    time.sleep_ms(100)
`;

  // ------------------------------------------------------------ 34.5
  const L5_HEAD = `# Αμυντική λάμπα: δέχεται μόνο {"cmd": "ON"} ή {"cmd": "OFF"}.
# Ό,τι άλλο → print("Ignored: …") και το LED δεν αλλάζει.
# Μετά από κάθε έγκυρη εντολή: publish("home/led/state", cmd, retain=True).
from machine import Pin
import json
import network
import time
import config
from umqtt.simple import MQTTClient

led = Pin(2, Pin.OUT)

${WIFI_CODE}

`;
  const L5_TAIL = `
client = MQTTClient("esp32-lamp", "broker.home.lan")
client.set_callback(on_message)
client.connect()
client.subscribe("home/led/set")

while True:
    client.check_msg()
    time.sleep_ms(100)
`;
  const L5_INITIAL = L5_HEAD + `# ΑΛΛΑΞΕ: σταματά με σφάλμα σε μήνυμα που δεν είναι JSON ή δεν έχει "cmd".
def on_message(topic, msg):
    data = json.loads(msg)
    if data["cmd"] == "ON":
        led.on()
    else:
        led.off()
` + L5_TAIL;
  const L5_SOLUTION = L5_HEAD + `ALLOWED = ("ON", "OFF")

def on_message(topic, msg):
    try:
        data = json.loads(msg)
    except ValueError:
        print("Ignored: not JSON")
        return
    if not isinstance(data, dict):
        print("Ignored: not an object")
        return
    cmd = data.get("cmd")
    if cmd not in ALLOWED:
        print("Ignored: unknown cmd")
        return
    if cmd == "ON":
        led.on()
    else:
        led.off()
    client.publish("home/led/state", cmd, retain=True)
    print("LED", cmd)
` + L5_TAIL;

  // ------------------------------------------------------------ 34.6
  const L6_HEAD = `# Θερμόμετρο με ασφαλή σύνδεση στον broker.
from machine import Pin
import dht
import json
import network
import time
import config
from umqtt.simple import MQTTClient, MQTTException

sensor = dht.DHT22(Pin(13))

${WIFI_CODE}

`;
  const L6_INITIAL = L6_HEAD + `# Ο broker δέχεται μόνο clients με όνομα χρήστη και κωδικό.
# ΑΛΛΑΞΕ: τα στοιχεία είναι γραμμένα μέσα στον κώδικα. Πάρ' τα από το config.
# ΠΡΟΣΘΕΣΕ: try / except MQTTException γύρω από το connect, με print("MQTT refused").
# ΠΡΟΣΘΕΣΕ: try / except OSError γύρω από τη μέτρηση, με print("Sensor error").
client = MQTTClient("esp32-temp", "broker.home.lan", user="esp32-temp", password="${MQTT_PASS}")
client.connect()
print("MQTT connected")

while True:
    sensor.measure()
    data = {"t": sensor.temperature()}
    client.publish("home/temperature", json.dumps(data))
    time.sleep(5)
`;
  const L6_SOLUTION = L6_HEAD + `client = MQTTClient("esp32-temp", "broker.home.lan", user=config.MQTT_USER, password=config.MQTT_PASS)
try:
    client.connect()
    print("MQTT connected")
except MQTTException as e:
    print("MQTT refused:", e)

while True:
    try:
        sensor.measure()
        data = {"t": sensor.temperature()}
        client.publish("home/temperature", json.dumps(data))
    except OSError:
        print("Sensor error")
    time.sleep(5)
`;

  const PASS_CHECKS = [
    { check: 'sourceNot', text: MQTT_PASS, fail: 'Ο κωδικός MQTT είναι γραμμένος μέσα στον κώδικα. Χρησιμοποίησε password=config.MQTT_PASS.' },
    { check: 'serialNot', text: MQTT_PASS, fail: 'Ο κωδικός MQTT εμφανίστηκε στο Τερματικό. Μην τον τυπώνεις.' }
  ];

  L.lessons.push(
    Object.assign({}, BASE, {
      id: 'c34-l1', kind: 'guided', skills: ['micropython', 'mqtt', 'network'],
      title: 'Πρώτη σύνδεση με umqtt.simple',
      prerequisites: [],
      objectives: ['Να φτιάχνω MQTTClient με όνομα client και broker.', 'Να συνδέομαι με connect().', 'Να στέλνω retained μήνυμα κατάστασης.'],
      theory: `
<p>Στη MicroPython το MQTT γίνεται με τη μικρή βιβλιοθήκη <strong>umqtt.simple</strong>.</p>
<pre>from umqtt.simple import MQTTClient
client = MQTTClient("esp32-temp", "broker.home.lan")
client.connect()
client.publish("home/esp32/status", "online", retain=True)</pre>
<ul>
  <li>Πρώτο όρισμα: το <strong>όνομα</strong> του client. Κάθε συσκευή έχει δικό της.</li>
  <li>Δεύτερο: ο <strong>broker</strong>. Εδώ είναι το Raspberry Pi του σπιτιού, <code>broker.home.lan</code>.</li>
  <li><code>retain=True</code>: ο broker κρατά το μήνυμα για όποιον συνδεθεί αργότερα.</li>
</ul>
<p>Πρώτα WiFi, μετά MQTT. Χωρίς WiFi το <code>connect()</code> αποτυγχάνει.</p>
<p>Σε αληθινή πλακέτα, αν λείπει η βιβλιοθήκη: <code>mpremote mip install umqtt.simple</code></p>`,
      glossary: ['umqtt.simple', 'MQTTClient', 'broker', 'retained', 'MQTT'],
      supportedSyntax: SYNTAX,
      initialCode: L1_CODE('____'),
      solution: L1_CODE('"broker.home.lan"'),
      world: OPEN_WORLD, initialWorld: {},
      hardware: [], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το όνομα του broker, σε εισαγωγικά.',
        'Τρέξε. Δες στο πάνελ MQTT το μήνυμα «online».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το dashboard συνδέεται 10 λεπτά μετά την πλακέτα. Βλέπει το «online»;',
        options: ['Ναι, γιατί είναι retained', 'Όχι, έχει χαθεί', 'Μόνο αν η πλακέτα το ξαναστείλει'],
        answer: 0,
        explain: 'Σωστά. Ο broker κρατά το τελευταίο retained μήνυμα κάθε topic και το δίνει σε κάθε νέο subscriber.',
        retry: 'Όχι ακόμα. Τι κάνει το retain=True;'
      },
      hints: [
        'Ο broker του σπιτιού έχει όνομα στο τοπικό δίκτυο.',
        'Το όνομα είναι broker.home.lan. Είναι κείμενο, άρα μέσα σε εισαγωγικά.',
        'client = MQTTClient("esp32-temp", "broker.home.lan")'
      ],
      validationTests: [
        { name: 'Η πλακέτα συνδέεται στον broker', script: [
          { setup: true },
          { check: 'mqttConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε στον broker. {v}' },
          { check: 'serialHas', text: 'MQTT connected', fail: 'Το Τερματικό δεν έγραψε «MQTT connected». Τελευταίες γραμμές: {v}.' }
        ] },
        { name: 'Στέλνει «online» ως retained', script: [
          { setup: true },
          { check: 'published', topic: 'home/esp32/status', payload: 'online', min: 1, fail: 'Δεν στάλθηκε «online» στο home/esp32/status. Μηνύματα: {v}.' },
          { check: 'retained', topic: 'home/esp32/status', fail: 'Ο broker δεν κράτησε το μήνυμα. Πρόσθεσε retain=True.' },
          { check: 'dashboard', topic: 'home/esp32/status', payload: 'online', fail: 'Το dashboard είδε: {v}. Περίμενα «online».' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα μιλά MQTT! Το ίδιο main.py, με τη umqtt.simple, δουλεύει και σε αληθινό ESP32 με MicroPython.',
      remediation: 'Αν δεις «OSError: -202», το όνομα του broker είναι λάθος. Αν δεις «EHOSTUNREACH», η πλακέτα δεν έχει WiFi.'
    }),

    Object.assign({}, BASE, {
      id: 'c34-l2', kind: 'guided', skills: ['micropython', 'mqtt', 'sensors'],
      title: 'Στέλνω μετρήσεις ως JSON',
      prerequisites: ['c34-l1'],
      objectives: ['Να μετατρέπω λεξικό σε JSON με json.dumps.', 'Να στέλνω μέτρηση κάθε 5 δευτερόλεπτα.'],
      theory: `
<p>Το MQTT μεταφέρει <strong>κείμενο ή bytes</strong>. Ένα λεξικό της Python δεν στέλνεται απευθείας.</p>
<pre>data = {"t": 21.5, "h": 40.0}
client.publish("home/temperature", json.dumps(data))
# στέλνει: {"t": 21.5, "h": 40.0}</pre>
<ul>
  <li><code>json.dumps(λεξικό)</code> → κείμενο JSON.</li>
  <li>Χωρίς αυτό: <code>TypeError: object with buffer protocol required</code>.</li>
  <li>Και ένας σκέτος αριθμός θέλει μετατροπή: <code>str(t)</code>.</li>
</ul>
<p>Το JSON το καταλαβαίνει κάθε σύστημα: το dashboard, το Raspberry Pi, μια βάση δεδομένων.</p>`,
      glossary: ['JSON', 'json.loads / json.dumps', 'payload', 'λεξικό (dict)'],
      supportedSyntax: SYNTAX,
      initialCode: L2_CODE('data'),
      solution: L2_CODE('json.dumps(data)'),
      world: Object.assign({ temp: 21.5, humidity: 40 }, OPEN_WORLD), initialWorld: { temp: 21.5, humidity: 40 },
      hardware: ['sensor'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε. Διάβασε το TypeError.',
        'Διόρθωσε το publish ώστε να στέλνει κείμενο JSON.',
        'Άλλαξε τη θερμοκρασία στη σκηνή. Τι βλέπει το dashboard;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι στέλνει το client.publish("home/temperature", json.dumps({"t": 21.5}));',
        options: ['Το κείμενο {"t": 21.5}', 'Ένα λεξικό της Python', 'Τον αριθμό 21.5'],
        answer: 0,
        explain: 'Σωστά. Το json.dumps φτιάχνει κείμενο. Ο παραλήπτης το κάνει ξανά λεξικό με json.loads.',
        retry: 'Όχι ακόμα. Τι επιστρέφει το json.dumps;'
      },
      hints: [
        'Το publish θέλει κείμενο. Το data είναι λεξικό.',
        'Η συνάρτηση που κάνει λεξικό → κείμενο JSON είναι η json.dumps.',
        'client.publish("home/temperature", json.dumps(data))'
      ],
      validationTests: [
        { name: 'Στέλνει JSON με θερμοκρασία και υγρασία', script: [
          { setup: true }, { loops: 1 },
          { check: 'published', topic: 'home/temperature', json: { t: 21.5, h: 40 }, min: 1, fail: 'Δεν στάλθηκε JSON {"t": 21.5, "h": 40.0} στο home/temperature. Μηνύματα: {v}.' }
        ] },
        { name: 'Το dashboard βλέπει τη νέα θερμοκρασία', script: [
          { setup: true }, { loops: 1 }, { set: { temp: 23 } }, { loops: 1 },
          { check: 'dashboard', topic: 'home/temperature', json: { t: 23 }, fail: 'Μετά την αλλαγή σε 23 °C το dashboard είδε: {v}.' }
        ] },
        { name: 'Ένα μήνυμα κάθε 5 δευτερόλεπτα', script: [
          { setup: true }, { ms: 16000 },
          { check: 'published', topic: 'home/temperature', min: 3, max: 4, fail: 'Σε 16 δευτερόλεπτα στάλθηκαν {n} μετρήσεις. Περίμενα 3 έως 4 (μία κάθε 5 s).' }
        ] }
      ],
      explanationOnSuccess: 'Οι μετρήσεις φτάνουν στο dashboard ως JSON. Το ίδιο JSON μπορεί να το διαβάσει ο hub του Raspberry Pi με json.loads.',
      remediation: 'Αν το dashboard δεν βλέπει τίποτα, έλεγξε ότι το topic είναι ακριβώς home/temperature.'
    }),

    Object.assign({}, BASE, {
      id: 'c34-l3', kind: 'guided', skills: ['micropython', 'mqtt', 'io'],
      title: 'Ακούω εντολές: set_callback και check_msg',
      prerequisites: ['c34-l2'],
      objectives: ['Να ορίζω callback για τα εισερχόμενα μηνύματα.', 'Να κάνω subscribe σε topic εντολών.', 'Να καλώ check_msg() σε κάθε γύρο.'],
      theory: `
<p>Για να ακούει εντολές, η πλακέτα χρειάζεται τρία πράγματα:</p>
<ol>
  <li>Μια συνάρτηση <code>on_message(topic, msg)</code>: τι κάνω με κάθε μήνυμα.</li>
  <li><code>client.set_callback(on_message)</code>, <strong>πριν</strong> από το <code>subscribe</code>.</li>
  <li><code>client.check_msg()</code> σε κάθε γύρο του <code>while True</code>.</li>
</ol>
<p>Χωρίς <code>check_msg()</code> τα μηνύματα περιμένουν στο δίκτυο και το callback δεν καλείται ποτέ.</p>
<p>Το <code>topic</code> και το <code>msg</code> είναι <strong>bytes</strong>, π.χ. <code>b'ON'</code>. Με <code>msg.decode()</code> γίνεται κείμενο <code>'ON'</code>.</p>
<p>Στο <code>set_callback</code> δίνεις το <strong>όνομα</strong> της συνάρτησης, χωρίς παρενθέσεις.</p>`,
      glossary: ['set_callback', 'check_msg', 'callback', 'bytes', 'subscribe'],
      supportedSyntax: SYNTAX,
      initialCode: L3_CODE('____', '____'),
      solution: L3_CODE('on_message', 'client.check_msg()'),
      world: OPEN_WORLD, initialWorld: {},
      hardware: ['led'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το set_callback με το όνομα της συνάρτησης.',
        'Συμπλήρωσε τη γραμμή του βρόχου που ελέγχει για νέο μήνυμα.',
        'Τρέξε. Από το πάνελ MQTT στείλε ON και OFF στο home/led/set.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ξέχασες το client.check_msg() στον βρόχο. Τι γίνεται όταν το dashboard στέλνει ON;',
        options: ['Τίποτα: το callback δεν καλείται ποτέ', 'Το LED ανάβει κανονικά', 'Η πλακέτα κάνει restart'],
        answer: 0,
        explain: 'Σωστά. Στη umqtt.simple δεν υπάρχει «παρασκήνιο». Μόνο το check_msg() (ή το wait_msg()) διαβάζει τα μηνύματα.',
        retry: 'Όχι ακόμα. Ποια εντολή διαβάζει τα μηνύματα από το δίκτυο;'
      },
      hints: [
        'Το set_callback θέλει τη συνάρτηση που γράψαμε πιο πάνω. Ο βρόχος θέλει μια εντολή του client.',
        'Η συνάρτηση λέγεται on_message. Η εντολή που κοιτά για μηνύματα χωρίς να περιμένει είναι η check_msg.',
        'client.set_callback(on_message)\n…\nwhile True:\n    client.check_msg()\n    time.sleep_ms(100)'
      ],
      validationTests: [
        { name: 'ON → LED αναμμένο', script: [
          { setup: true }, { dash: { topic: 'home/led/set', payload: 'ON' } }, { loops: 2 },
          { check: 'serialHas', text: 'Command: ON', fail: 'Το dashboard έστειλε ON, αλλά το Τερματικό δεν έγραψε «Command: ON». Καλείς client.check_msg();' },
          { check: 'led', is: true, fail: 'Μετά το ON το LED είναι {v}.' }
        ] },
        { name: 'OFF → LED σβηστό', script: [
          { setup: true }, { dash: { topic: 'home/led/set', payload: 'ON' } }, { loops: 2 },
          { dash: { topic: 'home/led/set', payload: 'OFF' } }, { loops: 2 },
          { check: 'led', is: false, fail: 'Μετά το OFF το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα ακούει! Τώρα το dashboard ελέγχει τη λάμπα. Στο επόμενο βήμα θα δούμε τι γίνεται όταν έρθει κάτι απρόσμενο.',
      remediation: 'Αν δεις «AssertionError: Subscribe callback is not set», το set_callback πρέπει να γραφτεί πριν από το subscribe.'
    }),

    Object.assign({}, BASE, {
      id: 'c34-l4', kind: 'debug', skills: ['micropython', 'mqtt', 'syntax'],
      title: 'Βρες το λάθος: bytes δεν είναι str',
      prerequisites: ['c34-l3'],
      objectives: ['Να βάζω το set_callback πριν από το subscribe.', 'Να ξέρω ότι b"ON" == "ON" είναι False.', 'Να μετατρέπω bytes σε κείμενο με decode().'],
      theory: `
<p>Δύο παράπονα:</p>
<ol>
  <li>«Σταματά με σφάλμα μόλις ξεκινήσει.» → διάβασε το μήνυμα: λέει τι λείπει πριν από το <code>subscribe</code>.</li>
  <li>«Βλέπει τις εντολές αλλά το LED δεν αλλάζει.» → δες τι τυπώνει: <code>Got b'home/led/set' b'ON'</code>.</li>
</ol>
<p>Το <code>b'ON'</code> είναι <strong>bytes</strong>. Στη Python:</p>
<pre>b"ON" == "ON"            # False!
b"ON".decode() == "ON"   # True</pre>
<p>Δεν βγαίνει σφάλμα. Η σύγκριση απλώς είναι πάντα <code>False</code>. Γι’ αυτό το λάθος είναι ύπουλο.</p>`,
      glossary: ['bytes', 'set_callback', 'σύγκριση', 'μήνυμα λάθους'],
      supportedSyntax: SYNTAX,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: OPEN_WORLD, initialWorld: {},
      hardware: ['led'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε και διάβασε το σφάλμα. Διόρθωσε τη σειρά των εντολών.',
        'Τρέξε ξανά και στείλε ON. Τι τυπώνει το Τερματικό;',
        'Διόρθωσε τη σύγκριση με decode().',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'msg = b"ON". Τι δίνει το msg == "ON";',
        options: ['False', 'True', 'TypeError'],
        answer: 0,
        explain: 'Σωστά. bytes και str δεν είναι ποτέ ίσα, ακόμα κι αν «μοιάζουν». Χρειάζεται msg.decode() == "ON" ή msg == b"ON".',
        retry: 'Όχι ακόμα. Τα bytes και τα str είναι διαφορετικοί τύποι. Η Python τα θεωρεί ίσα;'
      },
      hints: [
        'Δύο διορθώσεις: η σειρά δύο γραμμών, και η σύγκριση μέσα στο callback.',
        'Το set_callback πρέπει να είναι πριν από το subscribe. Στο callback κάνε text = msg.decode() και σύγκρινε το text.',
        'client.set_callback(on_message)\nclient.connect()\nclient.subscribe("home/led/set")\n…\ntext = msg.decode()\nif text == "ON":'
      ],
      validationTests: [
        { name: 'Ξεκινά χωρίς σφάλμα και συνδέεται', script: [
          { setup: true },
          { check: 'mqttConnected', is: true, fail: 'Η πλακέτα δεν είναι συνδεδεμένη στον broker. {v}' }
        ] },
        { name: 'ON / OFF αλλάζουν το LED', script: [
          { setup: true }, { dash: { topic: 'home/led/set', payload: 'ON' } }, { loops: 2 },
          { check: 'led', is: true, fail: 'Μετά το ON το LED είναι {v}. Συγκρίνεις bytes με str;' },
          { dash: { topic: 'home/led/set', payload: 'OFF' } }, { loops: 2 },
          { check: 'led', is: false, fail: 'Μετά το OFF το LED είναι {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Δύο κλασικά λάθη της umqtt! Το πρώτο το λέει η ίδια η βιβλιοθήκη. Το δεύτερο δεν το λέει κανείς: μόνο ένα print δείχνει το b μπροστά στο κείμενο.',
      remediation: 'Αν το LED δεν αλλάζει, τύπωσε type(msg). Αν είναι bytes, κάνε decode() πριν από τη σύγκριση.'
    }),

    Object.assign({}, BASE, {
      id: 'c34-l5', kind: 'independent', skills: ['micropython', 'mqtt', 'security', 'conditions'],
      title: 'Ανεξάρτητη άσκηση: δέχομαι μόνο έγκυρες εντολές',
      prerequisites: ['c34-l4'],
      objectives: ['Να πιάνω JSON που δεν διαβάζεται.', 'Να δέχομαι μόνο εντολές από μια λίστα (allowlist).', 'Να επιβεβαιώνω την κατάσταση με publish.'],
      theory: `
<p>Ένα μήνυμα από το δίκτυο μπορεί να είναι <strong>οτιδήποτε</strong>: λάθος του dashboard, παλιά έκδοση, μια άγνωστη συσκευή. Μια ασφαλής συσκευή <strong>ελέγχει πριν εκτελέσει</strong>.</p>
<ol>
  <li><code>json.loads</code> μέσα σε <code>try</code>. Στη MicroPython το λάθος JSON δίνει <code>ValueError</code>.</li>
  <li><code>isinstance(data, dict)</code>: είναι αντικείμενο JSON;</li>
  <li><code>data.get("cmd")</code>: δεν σκάει αν λείπει το κλειδί (δίνει <code>None</code>).</li>
  <li><code>if cmd not in ALLOWED:</code> → αγνόησε. Αυτό είναι <strong>allowlist</strong>.</li>
</ol>
<p>Σε κάθε απόρριψη: <code>print("Ignored: …")</code> και <code>return</code>. Το LED μένει όπως ήταν.</p>
<p>Μετά από έγκυρη εντολή: <code>client.publish("home/led/state", cmd, retain=True)</code>. Έτσι το dashboard ξέρει τι <strong>πραγματικά</strong> έγινε.</p>`,
      glossary: ['έλεγχος εισόδου (validation)', 'allowlist', 'dict.get', 'try / except', 'εντολή και κατάσταση'],
      supportedSyntax: SYNTAX,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: OPEN_WORLD, initialWorld: {},
      hardware: ['led'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε και στείλε από το dashboard το κείμενο hello. Τι γίνεται;',
        'Ξαναγράψε το on_message με τους τέσσερις ελέγχους.',
        'Δοκίμασε: {"cmd": "ON"}, hello, {"cmd": "OPEN"}, {"x": 1}, {"cmd": "OFF"}.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Έρχεται {"cmd": "on"} (μικρά γράμματα). Τι πρέπει να κάνει η αυστηρή λάμπα;',
        options: ['Να το αγνοήσει: "on" δεν είναι στο ALLOWED', 'Να ανάψει', 'Να σταματήσει με σφάλμα'],
        answer: 0,
        explain: 'Σωστά. Η allowlist δέχεται ακριβώς ό,τι γράφει. Ό,τι δεν είναι εκεί, απορρίπτεται, χωρίς να σταματά η πλακέτα.',
        retry: 'Όχι ακόμα. Το "on" είναι ίδιο με το "ON" για την Python;'
      },
      hints: [
        'Κάθε έλεγχος που αποτυγχάνει: print("Ignored: …") και return. Μόνο στο τέλος αλλάζει το LED.',
        'Σειρά: try json.loads / except ValueError → isinstance(data, dict) → cmd = data.get("cmd") → if cmd not in ALLOWED.',
        'ALLOWED = ("ON", "OFF")\ndef on_message(topic, msg):\n    try:\n        data = json.loads(msg)\n    except ValueError:\n        print("Ignored: not JSON")\n        return\n    if not isinstance(data, dict):\n        print("Ignored: not an object")\n        return\n    cmd = data.get("cmd")\n    if cmd not in ALLOWED:\n        print("Ignored: unknown cmd")\n        return\n    …'
      ],
      validationTests: [
        { name: 'Έγκυρο ON → LED αναμμένο και κατάσταση ON', script: [
          { setup: true }, { dash: { topic: 'home/led/set', payload: '{"cmd": "ON"}' } }, { loops: 2 },
          { check: 'led', is: true, fail: 'Μετά το {"cmd": "ON"} το LED είναι {v}.' },
          { check: 'published', topic: 'home/led/state', payload: 'ON', min: 1, fail: 'Δεν στάλθηκε «ON» στο home/led/state. Μηνύματα: {v}.' }
        ] },
        { name: 'Μη-JSON και άγνωστες εντολές αγνοούνται', script: [
          { setup: true }, { dash: { topic: 'home/led/set', payload: '{"cmd": "ON"}' } }, { loops: 2 },
          { dash: { topic: 'home/led/set', payload: 'hello' } }, { loops: 2 },
          { dash: { topic: 'home/led/set', payload: '{"cmd": "OPEN"}' } }, { loops: 2 },
          { dash: { topic: 'home/led/set', payload: '{"x": 1}' } }, { loops: 2 },
          { dash: { topic: 'home/led/set', payload: '[1, 2]' } }, { loops: 2 },
          { check: 'led', is: true, fail: 'Μετά από άκυρα μηνύματα το LED έγινε {v}. Τα άκυρα μηνύματα δεν πρέπει να αλλάζουν το LED.' },
          { check: 'count', text: 'Ignored: not JSON', min: 1, fail: 'Για το «hello» δεν τυπώθηκε «Ignored: not JSON».' },
          { check: 'count', text: 'Ignored: unknown cmd', min: 2, fail: 'Για {"cmd": "OPEN"} και {"x": 1} τυπώθηκε {n} φορές «Ignored: unknown cmd». Περίμενα 2.' },
          { check: 'published', topic: 'home/led/state', is: 1, fail: 'Στάλθηκαν {n} καταστάσεις. Μόνο οι έγκυρες εντολές στέλνουν κατάσταση.' }
        ] },
        { name: 'Έγκυρο OFF μετά από άκυρα → LED σβηστό', script: [
          { setup: true }, { dash: { topic: 'home/led/set', payload: '{"cmd": "ON"}' } }, { loops: 2 },
          { dash: { topic: 'home/led/set', payload: 'hello' } }, { loops: 2 },
          { dash: { topic: 'home/led/set', payload: '{"cmd": "OFF"}' } }, { loops: 2 },
          { check: 'led', is: false, fail: 'Μετά το {"cmd": "OFF"} το LED είναι {v}. Η πλακέτα συνεχίζει να ακούει μετά από άκυρο μήνυμα;' },
          { check: 'dashboard', topic: 'home/led/state', payload: 'OFF', fail: 'Το dashboard βλέπει κατάσταση {v}. Περίμενα «OFF».' }
        ] }
      ],
      explanationOnSuccess: 'Η λάμπα είναι αμυντική: κάνει μόνο ό,τι επιτρέπεται, και τίποτα δεν τη σταματά. Το home/led/state λέει στο dashboard την αλήθεια, όχι αυτό που ζητήθηκε.',
      remediation: 'Αν η πλακέτα σταματά με KeyError, χρησιμοποίησε data.get("cmd") αντί για data["cmd"]. Αν σταματά με AttributeError, λείπει ο έλεγχος isinstance(data, dict).'
    }),

    Object.assign({}, BASE, {
      id: 'c34-l6', kind: 'checkpoint', skills: ['micropython', 'mqtt', 'security', 'sensors'],
      title: 'Έλεγχος κεφαλαίου: ασφαλής σύνδεση με user και password',
      prerequisites: ['c34-l5'],
      objectives: ['Να συνδέομαι στον broker με στοιχεία από το config.', 'Να πιάνω το MQTTException.', 'Να συνεχίζω να στέλνω μετρήσεις και μετά από σφάλμα αισθητήρα.'],
      theory: `
<p>Ο broker του σπιτιού δέχεται πλέον <strong>μόνο</strong> clients με όνομα χρήστη και κωδικό. Τα στοιχεία της πλακέτας είναι στο <code>config.py</code>:</p>
<pre>client = MQTTClient("esp32-temp", "broker.home.lan",
                    user=config.MQTT_USER, password=config.MQTT_PASS)</pre>
<ul>
  <li>Ποτέ κωδικός μέσα στο <code>main.py</code>. Ο κώδικας μοιράζεται, ανεβαίνει σε αποθετήρια, φαίνεται σε οθόνες.</li>
  <li>Λάθος ή καθόλου στοιχεία → ο broker απορρίπτει → <code>MQTTException</code> (κωδικός 5).</li>
  <li>Πιάσ’ το: <code>except MQTTException as e:</code> → <code>print("MQTT refused:", e)</code>.</li>
</ul>
<p>Και ο αισθητήρας: <code>try / except OSError</code> γύρω από τη μέτρηση, με <code>print("Sensor error")</code>. Η πλακέτα συνεχίζει.</p>
<p>Σημείωση: εδώ η σύνδεση είναι στη θύρα 1883 χωρίς TLS, άρα ο κωδικός ταξιδεύει χωρίς κρυπτογράφηση. Στο σπίτι μας είναι δοκιμή· σε αληθινό σύστημα θέλει και TLS.</p>`,
      glossary: ['credentials', 'MQTTException', 'config.py', 'authentication', 'μυστικό (secret)'],
      supportedSyntax: SYNTAX + ', from umqtt.simple import MQTTException',
      initialCode: L6_INITIAL,
      solution: L6_SOLUTION,
      world: Object.assign({ temp: 22.5 }, SECURE_WORLD), initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: ['serial', 'vars', 'mqtt', 'net', 'logs'],
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Αντικατέστησε τα στοιχεία μέσα στον κώδικα με config.MQTT_USER και config.MQTT_PASS.',
        'Βάλε το connect μέσα σε try / except MQTTException.',
        'Βάλε τη μέτρηση και το publish μέσα σε try / except OSError.',
        'Τρέξε. Άναψε το «σφάλμα αισθητήρα» για λίγο. Συνεχίζει;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί ο κωδικός MQTT μπαίνει στο config.py και όχι στο main.py;',
        options: ['Για να μη φαίνεται όταν μοιράζεσαι ή δείχνεις τον κώδικα', 'Για να τρέχει πιο γρήγορα', 'Γιατί η umqtt δεν δέχεται κείμενο στο password'],
        answer: 0,
        explain: 'Σωστά. Ο κώδικας ταξιδεύει (αποθετήρια, φωτογραφίες, βοήθεια από φίλους). Το config.py μένει μόνο στην πλακέτα.',
        retry: 'Όχι ακόμα. Σκέψου ποιος βλέπει το main.py και ποιος το config.py.'
      },
      hints: [
        'Τρεις αλλαγές: στοιχεία από config, try γύρω από το connect, try γύρω από τη μέτρηση.',
        'user=config.MQTT_USER, password=config.MQTT_PASS. Μετά try: client.connect() / except MQTTException as e: print("MQTT refused:", e).',
        'client = MQTTClient("esp32-temp", "broker.home.lan", user=config.MQTT_USER, password=config.MQTT_PASS)\ntry:\n    client.connect()\n    print("MQTT connected")\nexcept MQTTException as e:\n    print("MQTT refused:", e)\n\nwhile True:\n    try:\n        sensor.measure()\n        …\n    except OSError:\n        print("Sensor error")\n    time.sleep(5)'
      ],
      validationTests: [
        { name: 'Συνδέεται με τα στοιχεία της και στέλνει', script: [
          { setup: true }, { loops: 1 },
          { check: 'mqttConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε στον broker: {v}' },
          { check: 'published', topic: 'home/temperature', json: { t: 22.5 }, min: 1, fail: 'Δεν στάλθηκε {"t": 22.5} στο home/temperature. Μηνύματα: {v}.' },
          { check: 'mqttAttempts', max: 1, fail: 'Έγιναν {n} προσπάθειες σύνδεσης. Μία αρκεί.' }
        ] },
        { name: 'Ο κωδικός δεν είναι στον κώδικα ούτε στο Τερματικό', script: [{ setup: true }, { loops: 1 }].concat(PASS_CHECKS) },
        { name: 'Σφάλμα αισθητήρα → συνεχίζει να στέλνει μετά', script: [
          { setup: true }, { loops: 1 },
          { set: { sensorFault: true } }, { loops: 2 },
          { check: 'serialHas', text: 'Sensor error', fail: 'Με σφάλμα αισθητήρα δεν τυπώθηκε «Sensor error». Τελευταίες γραμμές: {v}.' },
          { set: { sensorFault: false, temp: 24.0 } }, { loops: 1 },
          { check: 'dashboard', topic: 'home/temperature', json: { t: 24 }, fail: 'Μετά τη διόρθωση του αισθητήρα το dashboard βλέπει {v}. Περίμενα {"t": 24.0}.' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο! Η πλακέτα συνδέεται με δικά της στοιχεία, κρατά τον κωδικό μυστικό και αντέχει σφάλματα. Στο επόμενο κεφάλαιο: αισθητήρας στάθμευσης με υπερήχους.',
      remediation: 'Αν δεις «MQTTException: 5», ο broker απέρριψε τα στοιχεία. Έλεγξε ότι γράφεις user= και password= με config.MQTT_USER και config.MQTT_PASS.'
    })
  );
})(typeof window !== 'undefined' ? window : globalThis);
