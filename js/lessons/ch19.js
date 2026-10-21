/*
 * IoT Guardian — Κεφάλαιο 19 (Μέρος Β): Το Raspberry Pi ως κέντρο MQTT.
 * Το πρόγραμμα Python του μαθητή είναι ο «hub» του σπιτιού: συνδέεται στον broker
 * που τρέχει στο ίδιο Pi, ακούει τα ESP32 και στέλνει εντολές (paho-mqtt 2.x).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 19, title: 'Το Raspberry Pi ως κέντρο MQTT', ready: true, unlockAfter: 18, lang: 'python' });

  [
    { term: 'hub', def: 'Το «κέντρο» του σπιτιού: ένα πρόγραμμα (εδώ σε Python, στο Raspberry Pi) που ακούει όλες τις συσκευές και αποφασίζει τι θα γίνει.' },
    { term: 'paho-mqtt', def: 'Η πιο γνωστή βιβλιοθήκη MQTT για Python. Τη φορτώνουμε με import paho.mqtt.client as mqtt. Στην έκδοση 2.x ο Client θέλει πρώτα την έκδοση των callbacks: mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub").' },
    { term: 'localhost', def: 'Το όνομα «ο ίδιος μου ο υπολογιστής». Ο broker τρέχει στο ίδιο Raspberry Pi με το πρόγραμμα, οπότε το Pi μπορεί να συνδεθεί στο localhost.' },
    { term: 'callback', def: 'Μια συνάρτηση που δεν καλείς εσύ. Τη δίνεις στη βιβλιοθήκη (π.χ. client.on_message = on_message) και τη καλεί εκείνη όταν συμβεί κάτι, π.χ. όταν φτάσει μήνυμα.' },
    { term: 'loop_forever', def: 'Η εντολή client.loop_forever() κρατά το πρόγραμμα ζωντανό: διαβάζει από το δίκτυο, καλεί τα callbacks και ξανασυνδέεται μόνη της. Χωρίς αυτήν (ή χωρίς loop_start) τα μηνύματα δεν φτάνουν ποτέ στο πρόγραμμα.' },
    { term: 'bytes', def: 'Τύπος της Python για «ακατέργαστα» δεδομένα, π.χ. b\'{"t": 21.5}\'. Το msg.payload είναι bytes. Με .decode() γίνεται κείμενο (str).' },
    { term: 'json.loads / json.dumps', def: 'json.loads(κείμενο) → λεξικό της Python. json.dumps(λεξικό) → κείμενο JSON για αποστολή. Το MQTT στέλνει κείμενο, όχι λεξικά.' },
    { term: 'on_connect', def: 'Το callback που καλείται κάθε φορά που ο client συνδέεται, και μετά από κάθε επανασύνδεση. Η σωστή θέση για τα subscribe.' },
    { term: 'γέφυρα (bridge)', def: 'Πρόγραμμα που ακούει ένα topic και, με βάση αυτό, στέλνει σε άλλο topic. Π.χ. κίνηση στο home/motion → εντολή στο home/led/set.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX = 'import, def, if/elif/else, f-strings, λεξικά, paho.mqtt.client: Client(mqtt.CallbackAPIVersion.VERSION2, client_id=…), connect, publish(topic, payload, retain=…), subscribe, on_connect, on_message, loop_forever, json.loads, json.dumps, bytes.decode()';
  const PANELS = ['serial', 'vars', 'mqtt', 'net'];
  const OPEN_BROKER = 'listener 1883\nallow_anonymous true\n';
  const DASH = { name: 'dashboard', subs: ['home/#'] };
  const TEMP_SENSOR = { name: 'esp32-temp', publish: [{ topic: 'home/temperature', payload: '{"t": {temp}, "n": {n}}', every: 5000, offset: 1000 }] };
  const TEMP_WORLD = { broker: OPEN_BROKER, clients: [DASH, TEMP_SENSOR] };

  // ------------------------------------------------------------ 19.1
  const L1_INITIAL = `# Ο hub του σπιτιού: συνδέεται στον broker και λέει «είμαι εδώ».
import paho.mqtt.client as mqtt

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")

# Ο broker τρέχει στο ίδιο Raspberry Pi.
client.connect(____, 1883)            # ΣΥΜΠΛΗΡΩΣΕ: το όνομα του broker, σε εισαγωγικά

# Κατάσταση: ο broker να την κρατήσει για όποιον συνδεθεί αργότερα.
client.publish("home/hub/status", "online", retain=____)   # ΣΥΜΠΛΗΡΩΣΕ: True ή False
print("Hub online")

client.loop_forever()
`;
  const L1_SOLUTION = `# Ο hub του σπιτιού: συνδέεται στον broker και λέει «είμαι εδώ».
import paho.mqtt.client as mqtt

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")

# Ο broker τρέχει στο ίδιο Raspberry Pi.
client.connect("localhost", 1883)

# Κατάσταση: ο broker να την κρατήσει για όποιον συνδεθεί αργότερα.
client.publish("home/hub/status", "online", retain=True)
print("Hub online")

client.loop_forever()
`;

  // ------------------------------------------------------------ 19.2
  const L2_INITIAL = `# Ο hub ακούει το θερμόμετρο esp32-temp.
import json
import paho.mqtt.client as mqtt

def on_message(client, userdata, msg):
    text = msg.payload.____()       # ΣΥΜΠΛΗΡΩΣΕ: bytes → κείμενο
    data = json.____(text)          # ΣΥΜΠΛΗΡΩΣΕ: κείμενο JSON → λεξικό
    t = data["t"]
    print(f"Temp: {t:.1f} C")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_message = on_message
client.connect("localhost", 1883)
client.subscribe("home/temperature")
____                                # ΣΥΜΠΛΗΡΩΣΕ: τρέχε για πάντα και κάλεσε τα callbacks
`;
  const L2_SOLUTION = `# Ο hub ακούει το θερμόμετρο esp32-temp.
import json
import paho.mqtt.client as mqtt

def on_message(client, userdata, msg):
    text = msg.payload.decode()     # bytes → κείμενο
    data = json.loads(text)         # κείμενο JSON → λεξικό
    t = data["t"]
    print(f"Temp: {t:.1f} C")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_message = on_message
client.connect("localhost", 1883)
client.subscribe("home/temperature")
client.loop_forever()
`;

  // ------------------------------------------------------------ 19.3
  const L3_HEAD = `# Ο hub πρέπει να συνεχίζει να ακούει και μετά από restart του broker.
import json
import paho.mqtt.client as mqtt

`;
  const L3_MSG = `def on_message(client, userdata, msg):
    data = json.loads(msg.payload.decode())
    t = data["t"]
    print(f"Temp: {t:.1f} C")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
`;
  const L3_INITIAL = L3_HEAD + `def on_connect(client, userdata, flags, reason_code, properties):
    print("Connected:", reason_code)
    # ΜΕΤΑΚΙΝΗΣΕ εδώ το subscribe

` + L3_MSG + `client.subscribe("home/temperature")    # ← γίνεται μόνο μία φορά
client.loop_forever()
`;
  const L3_SOLUTION = L3_HEAD + `def on_connect(client, userdata, flags, reason_code, properties):
    print("Connected:", reason_code)
    client.subscribe("home/temperature")    # ξαναγίνεται σε κάθε σύνδεση

` + L3_MSG + `client.loop_forever()
`;

  // ------------------------------------------------------------ 19.4
  const L4_HEAD = `# Γέφυρα: κίνηση από το esp32-pir → εντολή στη λάμπα.
import json
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/motion")

def on_message(client, userdata, msg):
    data = json.loads(msg.payload.decode())
    motion = data.get("motion")
    print("Motion:", motion)
`;
  const L4_TAIL = `
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
client.loop_forever()
`;
  const L4_INITIAL = L4_HEAD + `    # ΓΡΑΨΕ ΕΔΩ:
    # αν motion είναι True  → στείλε {"cmd": "ON"}  στο home/led/set
    # αν motion είναι False → στείλε {"cmd": "OFF"} στο home/led/set
    # Φτιάξε λεξικό και στείλ' το με json.dumps(…).
` + L4_TAIL;
  const L4_SOLUTION = L4_HEAD + `    if motion is True:
        command = {"cmd": "ON"}
    elif motion is False:
        command = {"cmd": "OFF"}
    else:
        return                      # άγνωστο μήνυμα: δεν στέλνουμε τίποτα
    client.publish("home/led/set", json.dumps(command))
    print("Sent:", command["cmd"])
` + L4_TAIL;

  // ------------------------------------------------------------ 19.5
  const L5_INITIAL = `# Ο hub διαβάζει τη θερμοκρασία και στέλνει μια σύνοψη στο dashboard.
# Παράπονο: «δεν δουλεύει τίποτα». Υπάρχουν 4 λάθη.
import json
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")

def on_message(client, userdata, msg):
    text = str(msg.payload)
    data = json.loads(text)
    t = data["t"]
    print(f"Temp: {t:.1f} C")
    summary = {"t": t, "unit": "C"}
    client.publish("home/hub/last", summary)

client = mqtt.Client("pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
print("Hub started")
`;
  const L5_SOLUTION = `# Ο hub διαβάζει τη θερμοκρασία και στέλνει μια σύνοψη στο dashboard.
import json
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")

def on_message(client, userdata, msg):
    text = msg.payload.decode()                     # bytes → κείμενο
    data = json.loads(text)
    t = data["t"]
    print(f"Temp: {t:.1f} C")
    summary = {"t": t, "unit": "C"}
    client.publish("home/hub/last", json.dumps(summary))   # λεξικό → JSON

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
print("Hub started")
client.loop_forever()                               # αλλιώς το πρόγραμμα τελειώνει εδώ
`;

  L.lessons.push(
    {
      id: 'c19-l1', chapter: 19, kind: 'micro', lang: 'python', skills: ['python', 'mqtt', 'network'],
      title: 'Ο hub συνδέεται: «online»',
      prerequisites: [],
      objectives: ['Να φτιάχνω client με το paho-mqtt 2.x.', 'Να συνδέομαι στον broker που τρέχει στο ίδιο Pi.', 'Να στέλνω μια κατάσταση ως retained.'],
      theory: `
<p>Μέχρι τώρα τα μηνύματα τα έστελναν τα ESP32. Τώρα το <strong>Raspberry Pi</strong> γίνεται ο <strong>hub</strong> του σπιτιού: ένα πρόγραμμα Python που ακούει όλες τις συσκευές.</p>
<p>Ο broker τρέχει <strong>στο ίδιο Pi</strong>. Άρα το πρόγραμμα συνδέεται στο <code>"localhost"</code> («ο εαυτός μου»). Το <code>"broker.home.lan"</code> δουλεύει επίσης.</p>
<p>Στο ESP32 γράφαμε:</p>
<pre>mqtt.setServer(MQTT_HOST, 1883);
mqtt.connect("esp32-pir");</pre>
<p>Στο Pi, με Python και τη βιβλιοθήκη <strong>paho-mqtt 2.x</strong>:</p>
<pre>import paho.mqtt.client as mqtt
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.connect("localhost", 1883)</pre>
<ul>
  <li>Το <code>CallbackAPIVersion.VERSION2</code> λέει ποια μορφή έχουν τα callbacks. Στην έκδοση 2.x είναι υποχρεωτικό.</li>
  <li>Το <code>client_id</code> είναι το όνομα του client στον broker.</li>
</ul>
<p>Το «online» είναι <strong>κατάσταση</strong>, όχι εντολή. Όπως στο Κεφάλαιο 8, το στέλνουμε με <code>retain=True</code>: ένα dashboard που ανοίγει αργότερα το βλέπει αμέσως.</p>
<p>Το <code>client.loop_forever()</code> κρατά το πρόγραμμα ζωντανό και τη σύνδεση ανοιχτή.</p>`,
      glossary: ['hub', 'paho-mqtt', 'localhost', 'retained', 'loop_forever'],
      supportedSyntax: SYNTAX,
      initialCode: L1_INITIAL,
      solution: L1_SOLUTION,
      world: { broker: OPEN_BROKER, clients: [DASH] }, initialWorld: {},
      hardware: ['broker'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το όνομα του broker. Θυμήσου: τρέχει στο ίδιο Pi.',
        'Συμπλήρωσε το retain. Το «online» είναι κατάσταση.',
        'Τρέξε. Κοίτα το πάνελ MQTT: τι βλέπει το dashboard στο home/hub/status;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το dashboard ανοίγει 10 λεπτά μετά το «online». Θα το δει;',
        options: ['Ναι, αν στάλθηκε με retain=True', 'Ναι, πάντα', 'Όχι, ποτέ'],
        answer: 0,
        explain: 'Σωστά. Ο broker κρατά το τελευταίο retained μήνυμα του topic και το δίνει αμέσως σε κάθε νέο subscriber.',
        retry: 'Όχι ακόμα. Θυμήσου το Κεφάλαιο 8: τι κάνει ο broker με ένα retained μήνυμα;'
      },
      hints: [
        'Ο broker και το πρόγραμμα είναι στο ίδιο μηχάνημα. Ποιο όνομα σημαίνει «ο ίδιος μου ο υπολογιστής»;',
        'Το πρώτο κενό είναι κείμενο σε εισαγωγικά. Το δεύτερο είναι True ή False, χωρίς εισαγωγικά.',
        'client.connect("localhost", 1883)\nclient.publish("home/hub/status", "online", retain=True)\nΣτην Python το True γράφεται με κεφαλαίο Τ.'
      ],
      validationTests: [
        { name: 'Ο hub συνδέεται και μένει συνδεδεμένος', script: [
          { setup: true }, { ms: 2000 },
          { check: 'mqttConnected', is: true, fail: 'Ο hub δεν είναι συνδεδεμένος στον broker. {v} Έλεγξε το client.connect(…).' },
          { check: 'serialHas', text: 'Hub online', fail: 'Το τερματικό δεν δείχνει «Hub online». Βλέπω: {v}.' }
        ] },
        { name: 'Το «online» φτάνει στο dashboard και μένει retained', script: [
          { setup: true }, { ms: 1000 },
          { check: 'published', topic: 'home/hub/status', payload: 'online', is: 1, fail: 'Το «online» στάλθηκε {n} φορές στο home/hub/status. Περίμενα 1. Ο hub έστειλε: {v}.' },
          { check: 'dashboard', topic: 'home/hub/status', payload: 'online', fail: 'Το dashboard βλέπει στο home/hub/status {v}. Περίμενα «online».' },
          { check: 'retained', topic: 'home/hub/status', exists: true, fail: 'Ο broker δεν κρατά retained τιμή για το home/hub/status ({v}). Βάλε retain=True.' }
        ] }
      ],
      explanationOnSuccess: 'Ο hub είναι στο δίκτυο. Το «online» μένει στον broker, άρα κάθε dashboard που θα ανοίξει θα ξέρει ότι ο hub λειτουργεί. Παρατήρησε στον Network Monitor ότι το Pi μιλά με τον broker στη θύρα 1883, όπως και τα ESP32.',
      remediation: 'Αν βλέπεις «gaierror: Name or service not known», το όνομα του broker είναι λάθος. Γράψε "localhost" ή "broker.home.lan".'
    },

    {
      id: 'c19-l2', chapter: 19, kind: 'guided', lang: 'python', skills: ['python', 'mqtt', 'sensors'],
      title: 'on_message: ο hub ακούει το θερμόμετρο',
      prerequisites: ['c19-l1'],
      objectives: ['Να γράφω callback on_message.', 'Να μετατρέπω το payload από bytes σε κείμενο με .decode().', 'Να διαβάζω JSON με json.loads.'],
      theory: `
<p>Στο ESP32 διαβάζαμε τα μηνύματα μόνοι μας, μέσα στο <code>loop()</code>:</p>
<pre>while (mqtt.read()) { String p = mqtt.payload(); … }</pre>
<p>Στο paho γράφουμε μια συνάρτηση, το <strong>callback</strong>, και τη δίνουμε στον client. Την καλεί η βιβλιοθήκη όταν φτάσει μήνυμα:</p>
<pre>def on_message(client, userdata, msg):
    text = msg.payload.decode()
client.on_message = on_message</pre>
<ul>
  <li><code>msg.topic</code>: το topic, ως κείμενο.</li>
  <li><code>msg.payload</code>: το περιεχόμενο, ως <strong>bytes</strong> (<code>b'{"t": 21.5}'</code>). Το <code>.decode()</code> το κάνει κείμενο.</li>
  <li><code>json.loads(text)</code>: το κείμενο JSON γίνεται λεξικό. Μετά: <code>data["t"]</code>.</li>
</ul>
<p>Τα callbacks τρέχουν <strong>μόνο</strong> όσο τρέχει το <code>client.loop_forever()</code>. Αυτό διαβάζει το δίκτυο και καλεί το <code>on_message</code> για κάθε μήνυμα.</p>
<p>Το εικονικό <strong>esp32-temp</strong> στέλνει θερμοκρασία στο <code>home/temperature</code> κάθε 5 δευτερόλεπτα.</p>`,
      glossary: ['callback', 'bytes', 'json.loads / json.dumps', 'loop_forever', 'payload'],
      supportedSyntax: SYNTAX,
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      world: TEMP_WORLD, initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τη μέθοδο που κάνει τα bytes κείμενο.',
        'Συμπλήρωσε τη συνάρτηση του json που διαβάζει κείμενο JSON.',
        'Συμπλήρωσε την τελευταία γραμμή: ο client να τρέχει για πάντα.',
        'Τρέξε. Άλλαξε τη θερμοκρασία στον αισθητήρα και περίμενε το επόμενο μήνυμα (έως 5 s). Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι τυπώνει το print(msg.payload) για το μήνυμα {"t": 21.5};',
        options: ['b\'{"t": 21.5}\' — είναι bytes, όχι κείμενο', '{"t": 21.5}', '21.5'],
        answer: 0,
        explain: 'Σωστά. Το payload είναι bytes, γι’ αυτό η Python δείχνει μπροστά ένα b και εισαγωγικά. Με .decode() γίνεται κανονικό κείμενο.',
        retry: 'Όχι ακόμα. Τι τύπο έχει το msg.payload;'
      },
      hints: [
        'Δύο μετατροπές: bytes → κείμενο, και μετά κείμενο → λεξικό. Στο τέλος, ο βρόχος που καλεί τα callbacks.',
        'Η μέθοδος των bytes είναι η decode. Η συνάρτηση του json που «φορτώνει» από κείμενο είναι η loads (load string).',
        'text = msg.payload.decode()\ndata = json.loads(text)\n…\nclient.loop_forever()'
      ],
      validationTests: [
        { name: 'Ο hub τυπώνει κάθε μέτρηση', world: { temp: 23.4 }, script: [
          { setup: true }, { ms: 12000 },
          { check: 'count', text: 'Temp: 23.4 C', min: 2, fail: 'Σε 12 δευτερόλεπτα τυπώθηκε {n} φορές το «Temp: 23.4 C». Περίμενα τουλάχιστον 2 (μία κάθε 5 s).', failZero: 'Δεν τυπώθηκε καμία μέτρηση. Τρέχει το client.loop_forever(); Χωρίς αυτό το on_message δεν καλείται ποτέ.' },
          { check: 'serialNot', text: "b'", fail: 'Στο τερματικό φαίνεται b\'…\': τυπώθηκαν bytes. Χρησιμοποίησε msg.payload.decode().' }
        ] },
        { name: 'Νέα θερμοκρασία → νέα τιμή στο τερματικό', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 3000 }, { set: { temp: 27 } }, { ms: 6000 },
          { check: 'serialHas', text: 'Temp: 27.0 C', fail: 'Μετά την αλλαγή στους 27 το τερματικό δείχνει: {v}. Περίμενα «Temp: 27.0 C».' }
        ] }
      ],
      explanationOnSuccess: 'Ο hub ακούει. Η ροή είναι: το esp32-temp στέλνει → ο broker παραδίδει → το loop_forever καλεί το on_message → decode → json.loads → print. Αυτή τη ροή θα τη χρησιμοποιείς σε όλο το Μέρος Β.',
      remediation: 'Αν δεν τυπώνεται τίποτα, έλεγξε ότι η τελευταία γραμμή είναι client.loop_forever() με παρενθέσεις.'
    },

    {
      id: 'c19-l3', chapter: 19, kind: 'guided', lang: 'python', skills: ['python', 'mqtt', 'network'],
      title: 'Subscribe μέσα στο on_connect',
      prerequisites: ['c19-l2'],
      objectives: ['Να γράφω callback on_connect με τις 5 παραμέτρους του VERSION2.', 'Να βάζω το subscribe μέσα στο on_connect.', 'Να εξηγώ τι χάνεται μετά από restart του broker.'],
      theory: `
<p>Ο broker κάνει <strong>restart</strong> (π.χ. αναβάθμιση). Όλοι οι clients αποσυνδέονται.</p>
<p>Το paho, όσο τρέχει το <code>loop_forever()</code>, <strong>ξανασυνδέεται μόνο του</strong> σε περίπου 1 δευτερόλεπτο. Όμως η νέα σύνδεση ξεκινά <strong>χωρίς συνδρομές</strong>.</p>
<p>Στο ESP32, στο Κεφάλαιο 8, βάλαμε το subscribe μέσα στη συνάρτηση σύνδεσης. Στο paho υπάρχει έτοιμο callback γι’ αυτό, το <code>on_connect</code>. Καλείται <strong>σε κάθε</strong> σύνδεση:</p>
<pre>def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")

client.on_connect = on_connect</pre>
<ul>
  <li>Με <code>VERSION2</code> το <code>on_connect</code> έχει <strong>5 παραμέτρους</strong>.</li>
  <li>Το <code>reason_code</code> λέει αν πέτυχε η σύνδεση («Success»).</li>
</ul>
<p>Ο κώδικας εδώ κάνει subscribe <strong>μία φορά</strong>, μετά το <code>connect()</code>. Δουλεύει… μέχρι το πρώτο restart. Δοκίμασε το κουμπί «Επανεκκίνηση broker».</p>`,
      glossary: ['on_connect', 'επανασύνδεση', 'subscribe'],
      supportedSyntax: SYNTAX,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: TEMP_WORLD, initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Έρχονται μετρήσεις;',
        'Πάτησε «Επανεκκίνηση broker». Τυπώνεται ξανά «Connected»; Έρχονται μετρήσεις μετά;',
        'Απάντησε στην ερώτηση.',
        'Μετακίνησε το client.subscribe(…) μέσα στο on_connect.',
        'Τρέξε, κάνε ξανά restart και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Μετά το restart τυπώθηκε ξανά «Connected: Success», αλλά δεν έρχονται μετρήσεις. Γιατί;',
        options: ['Η νέα σύνδεση δεν έχει κάνει subscribe', 'Ο broker έσβησε τα μηνύματα', 'Το esp32-temp σταμάτησε να στέλνει'],
        answer: 0,
        explain: 'Σωστά. Ο hub ξανασυνδέθηκε, αλλά το subscribe έγινε μόνο μία φορά, στην πρώτη σύνδεση. Η νέα σύνδεση δεν ακούει τίποτα, και ο broker δεν προειδοποιεί.',
        retry: 'Όχι ακόμα. Κοίτα το πάνελ MQTT: το esp32-temp στέλνει ακόμα; Σε ποιον παραδίδει ο broker;'
      },
      hints: [
        'Ό,τι γράφεις μέσα στο on_connect γίνεται σε κάθε σύνδεση, και στις επανασυνδέσεις.',
        'Η γραμμή client.subscribe("home/temperature") είναι κάτω από το client.connect(…). Πρέπει να πάει μέσα στο on_connect, με 4 κενά εσοχή.',
        'def on_connect(client, userdata, flags, reason_code, properties):\n    print("Connected:", reason_code)\n    client.subscribe("home/temperature")\nΚαι σβήσε το subscribe από κάτω.'
      ],
      validationTests: [
        { name: 'Μετρήσεις φτάνουν από την αρχή', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 7000 },
          { check: 'count', text: 'Temp: 22.5 C', min: 1, fail: 'Σε 7 δευτερόλεπτα δεν τυπώθηκε μέτρηση. Κάνει ο hub subscribe στο home/temperature;' }
        ] },
        { name: 'Μετά από restart του broker οι μετρήσεις συνεχίζουν', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 3000 }, { restartBroker: true }, { set: { temp: 25 } }, { ms: 12000 },
          { check: 'count', text: 'Connected: Success', is: 2, fail: 'Το «Connected: Success» τυπώθηκε {n} φορές. Περίμενα 2: μία στην αρχή και μία μετά το restart.' },
          { check: 'mqttConnected', is: true, fail: 'Ο hub δεν ξανασυνδέθηκε μετά το restart. {v}' },
          { check: 'count', text: 'Temp: 25.0 C', min: 2, fail: 'Μετά το restart τυπώθηκε {n} φορές το «Temp: 25.0 C». Περίμενα τουλάχιστον 2.', failZero: 'Μετά το restart ο hub ξανασυνδέθηκε, αλλά δεν πήρε καμία μέτρηση. Το subscribe πρέπει να γίνεται μέσα στο on_connect.' }
        ] }
      ],
      explanationOnSuccess: 'Ο hub «επιβιώνει» από restart: το paho ξανασυνδέεται, καλεί το on_connect, και το on_connect ξανακάνει subscribe. Αυτός είναι ο κανόνας για κάθε πρόγραμμα paho: τα subscribe μπαίνουν στο on_connect.',
      remediation: 'Αν βλέπεις σφάλμα για τον αριθμό παραμέτρων, το on_connect του VERSION2 θέλει 5: client, userdata, flags, reason_code, properties.'
    },

    {
      id: 'c19-l4', chapter: 19, kind: 'variant', lang: 'python', skills: ['python', 'mqtt', 'automation'],
      title: 'Γέφυρα: κίνηση → λάμπα',
      prerequisites: ['c19-l3'],
      objectives: ['Να στέλνω εντολή από τον hub όταν φτάσει ένα μήνυμα.', 'Να φτιάχνω payload JSON με json.dumps.', 'Να αγνοώ μηνύματα που δεν καταλαβαίνω.'],
      theory: `
<p>Ένας κανόνας αυτοματισμού: <strong>«όταν υπάρχει κίνηση, άναψε τη λάμπα»</strong>.</p>
<p>Το esp32-pir στέλνει στο <code>home/motion</code>: <code>{"motion": true}</code> ή <code>{"motion": false}</code>. Ο hub ακούει και στέλνει εντολή στο <code>home/led/set</code>. Αυτό λέγεται <strong>γέφυρα</strong>.</p>
<p>Στο ESP32 φτιάχναμε το JSON με το χέρι:</p>
<pre>"{\\"cmd\\":\\"ON\\"}"</pre>
<p>Στην Python φτιάχνουμε <strong>λεξικό</strong> και το κάνουμε κείμενο με <code>json.dumps</code>:</p>
<pre>command = {"cmd": "ON"}
client.publish("home/led/set", json.dumps(command))</pre>
<ul>
  <li>Το JSON <code>true</code> γίνεται <code>True</code> στην Python μετά το <code>json.loads</code>.</li>
  <li>Αν φτάσει κάτι άλλο (π.χ. λείπει το <code>motion</code>), ο hub <strong>δεν στέλνει τίποτα</strong>.</li>
  <li>Η εντολή <strong>δεν</strong> στέλνεται ως retained (Κεφάλαιο 8).</li>
</ul>`,
      glossary: ['γέφυρα (bridge)', 'json.loads / json.dumps', 'εντολή και κατάσταση'],
      supportedSyntax: SYNTAX + ', is True / is False, return',
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: { broker: OPEN_BROKER, clients: [DASH, { name: 'esp32-pir' }] }, initialWorld: {},
      hardware: ['broker'], panels: PANELS,
      steps: [
        'Τρέξε. Από το dashboard στείλε {"motion": true} στο home/motion. Τι τυπώνει ο hub;',
        'Μέσα στο on_message γράψε το if/elif που διαλέγει την εντολή.',
        'Στείλε την εντολή με client.publish(…, json.dumps(…)).',
        'Τρέξε ξανά και στείλε true και false. Τι βλέπει το dashboard στο home/led/set;',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι τυπώνει το print(json.dumps({"cmd": "ON"}));',
        options: ['{"cmd": "ON"}', "{'cmd': 'ON'}", 'cmd=ON'],
        answer: 0,
        explain: 'Σωστά. Το json.dumps γράφει έγκυρο JSON: διπλά εισαγωγικά και κενό μετά την άνω-κάτω τελεία. Το {\'cmd\': \'ON\'} είναι πώς τυπώνει η Python ένα λεξικό, και δεν είναι έγκυρο JSON.',
        retry: 'Όχι ακόμα. Το JSON θέλει πάντα διπλά εισαγωγικά.'
      },
      hints: [
        'Δύο περιπτώσεις (True, False) και μία «άγνωστη». Για κάθε μία: ποια εντολή στέλνεις;',
        'Μέσα στο on_message, κάτω από το print: if motion is True: … elif motion is False: … else: return. Μετά ένα client.publish.',
        'if motion is True:\n    command = {"cmd": "ON"}\nelif motion is False:\n    command = {"cmd": "OFF"}\nelse:\n    return\nclient.publish("home/led/set", json.dumps(command))'
      ],
      validationTests: [
        { name: 'Κίνηση → {"cmd": "ON"} στη λάμπα', script: [
          { setup: true }, { ms: 1000 },
          { act: { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion": true}' } }, { ms: 500 },
          { check: 'published', topic: 'home/led/set', json: { cmd: 'ON' }, is: 1, fail: 'Μετά από {"motion": true} στάλθηκαν {n} εντολές ON στο home/led/set. Περίμενα 1. Ο hub έστειλε: {v}.' },
          { check: 'dashboard', topic: 'home/led/set', json: { cmd: 'ON' }, fail: 'Το dashboard βλέπει στο home/led/set {v}. Περίμενα {"cmd": "ON"}. Χρησιμοποίησες json.dumps;' }
        ] },
        { name: 'Τέλος κίνησης → {"cmd": "OFF"}, χωρίς retained', script: [
          { setup: true }, { ms: 1000 },
          { act: { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion": true}' } }, { ms: 500 },
          { act: { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion": false}' } }, { ms: 500 },
          { check: 'published', topic: 'home/led/set', json: { cmd: 'OFF' }, is: 1, fail: 'Μετά από {"motion": false} στάλθηκαν {n} εντολές OFF. Περίμενα 1. Ο hub έστειλε: {v}.' },
          { check: 'dashboard', topic: 'home/led/set', json: { cmd: 'OFF' }, fail: 'Το dashboard βλέπει {v}. Περίμενα {"cmd": "OFF"}.' },
          { check: 'retained', topic: 'home/led/set', exists: false, fail: 'Ο broker κρατά retained εντολή στο home/led/set: {v}. Οι εντολές δεν στέλνονται ως retained.' }
        ] },
        { name: 'Άγνωστο μήνυμα → καμία εντολή', script: [
          { setup: true }, { ms: 1000 },
          { act: { publish: 'esp32-pir', topic: 'home/motion', payload: '{"battery": 80}' } }, { ms: 500 },
          { check: 'published', topic: 'home/led/set', is: 0, fail: 'Για μήνυμα χωρίς «motion» στάλθηκαν {n} εντολές. Ο hub πρέπει να μη στέλνει τίποτα όταν δεν καταλαβαίνει το μήνυμα.' },
          { check: 'mqttConnected', is: true, fail: 'Ο hub δεν είναι πια συνδεδεμένος. {v}' }
        ] }
      ],
      explanationOnSuccess: 'Ο hub έγινε ο «εγκέφαλος»: το esp32-pir δεν ξέρει καν ότι υπάρχει λάμπα, και η λάμπα δεν ξέρει για τον PIR. Ο κανόνας ζει σε ένα μέρος, στο Pi, και αλλάζει εύκολα.',
      remediation: 'Αν βλέπεις «TypeError: payload must be a string…», στέλνεις λεξικό. Τύλιξέ το με json.dumps(…).'
    },

    {
      id: 'c19-l5', chapter: 19, kind: 'checkpoint', lang: 'python', skills: ['python', 'mqtt', 'automation'],
      title: 'Βρες τα 4 λάθη του hub',
      prerequisites: ['c19-l4'],
      objectives: ['Να διαβάζω ένα μήνυμα σφάλματος της Python και να βρίσκω τη γραμμή.', 'Να αναγνωρίζω τα 4 πιο συχνά λάθη με το paho.'],
      theory: `
<p>Ένας hub έπρεπε να διαβάζει τη θερμοκρασία και να στέλνει σύνοψη στο <code>home/hub/last</code>, π.χ. <code>{"t": 22.5, "unit": "C"}</code>. Δεν δουλεύει τίποτα.</p>
<p>Υπάρχουν <strong>4 λάθη</strong>. Όλα είναι πολύ συχνά στα πραγματικά Raspberry Pi:</p>
<ol>
  <li>Ο <code>Client</code> φτιάχνεται με το στυλ της παλιάς έκδοσης 1.x.</li>
  <li>Το payload γίνεται κείμενο με <code>str(…)</code> αντί για <code>.decode()</code>.</li>
  <li>Ένα λεξικό στέλνεται χωρίς <code>json.dumps</code>.</li>
  <li>Λείπει κάτι στο τέλος, οπότε το πρόγραμμα τελειώνει αμέσως.</li>
</ol>
<p>Τρέξε. Διάβασε το σφάλμα: πρώτα το <strong>αγγλικό</strong> (αυτό θα δεις και στο αληθινό Pi), μετά την ελληνική εξήγηση. Διόρθωσε, ξανατρέξε, βρες το επόμενο.</p>
<p>Το <code>str(b'abc')</code> δίνει το κείμενο <code>"b'abc'"</code>, με το b και τα εισαγωγικά μέσα. Αυτό δεν είναι JSON.</p>`,
      glossary: ['paho-mqtt', 'bytes', 'json.loads / json.dumps', 'loop_forever'],
      supportedSyntax: SYNTAX,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: TEMP_WORLD, initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: PANELS,
      steps: [
        'Τρέξε. Διάβασε το πρώτο σφάλμα και τη γραμμή του. Διόρθωσέ το.',
        'Τρέξε ξανά. Αν δεν βγαίνει σφάλμα αλλά δεν έρχεται τίποτα, τι λείπει στο τέλος;',
        'Συνέχισε μέχρι να δεις «Temp: …» στο τερματικό και τη σύνοψη στο dashboard.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το πρόγραμμα τυπώνει «Hub started» και τελειώνει. Δεν βγαίνει κανένα σφάλμα. Τι λείπει πιθανότατα;',
        options: ['Το client.loop_forever() στο τέλος', 'Το import json', 'Το client.on_message = on_message'],
        answer: 0,
        explain: 'Σωστά. Χωρίς loop_forever() (ή loop_start()) η Python φτάνει στο τέλος του αρχείου και σταματά. Κανείς δεν διαβάζει το δίκτυο, κανένα callback δεν καλείται.',
        retry: 'Όχι ακόμα. Αν έλειπε το import json, θα έβγαινε NameError. Τι κρατά ένα πρόγραμμα paho ζωντανό;'
      },
      hints: [
        'Το πρώτο σφάλμα είναι ValueError στη γραμμή του mqtt.Client. Το paho 2.x θέλει πρώτα την έκδοση των callbacks.',
        'Μετά: JSONDecodeError (τι είναι το str(msg.payload);), TypeError στο publish (τι θέλει το payload;), και η τελευταία γραμμή του αρχείου.',
        'client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")\ntext = msg.payload.decode()\nclient.publish("home/hub/last", json.dumps(summary))\nclient.loop_forever()'
      ],
      validationTests: [
        { name: 'Ο hub ξεκινά, συνδέεται και μένει ζωντανός', script: [
          { setup: true }, { ms: 3000 },
          { check: 'serialHas', text: 'Hub started', fail: 'Δεν τυπώθηκε «Hub started». Βλέπω: {v}.' },
          { check: 'mqttConnected', is: true, fail: 'Ο hub δεν είναι συνδεδεμένος μετά από 3 δευτερόλεπτα. {v} Μήπως το πρόγραμμα τελείωσε; Λείπει το client.loop_forever();' }
        ] },
        { name: 'Ο hub διαβάζει σωστά τη θερμοκρασία', world: { temp: 24.2 }, script: [
          { setup: true }, { ms: 12000 },
          { check: 'count', text: 'Temp: 24.2 C', min: 2, fail: 'Το «Temp: 24.2 C» τυπώθηκε {n} φορές σε 12 δευτερόλεπτα. Περίμενα τουλάχιστον 2.', failZero: 'Σε 12 δευτερόλεπτα δεν τυπώθηκε καμία μέτρηση. Αν το πρόγραμμα σταματά μετά το «Hub started», λείπει το client.loop_forever() στο τέλος.' }
        ] },
        { name: 'Η σύνοψη φτάνει στο dashboard ως JSON', world: { temp: 24.2 }, script: [
          { setup: true }, { ms: 7000 },
          { check: 'published', topic: 'home/hub/last', json: { t: 24.2, unit: 'C' }, min: 1, fail: 'Δεν βρέθηκε σύνοψη {"t": 24.2, "unit": "C"} στο home/hub/last. Ο hub έστειλε: {v}.' },
          { check: 'dashboard', topic: 'home/hub/last', json: { t: 24.2, unit: 'C' }, fail: 'Το dashboard βλέπει στο home/hub/last {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο. Τα 4 λάθη που διόρθωσες είναι τα πιο συχνά σε προγράμματα paho: παλιός Client, str αντί για decode, λεξικό χωρίς json.dumps, και πρόγραμμα που τελειώνει. Τώρα ξέρεις τι σημαίνει το καθένα όταν το δεις στο αληθινό τερματικό.',
      remediation: 'Διόρθωνε ένα λάθος τη φορά και ξανατρέχε. Κάθε σφάλμα δείχνει τη γραμμή του.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
