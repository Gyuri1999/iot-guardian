/*
 * IoT Guardian — Κεφάλαιο 20 (Μέρος Β): Κανόνες, ειδοποιήσεις και αξιόπιστα δεδομένα.
 * Ο hub στο Raspberry Pi: έλεγχος εισόδου, ειδοποιήσεις με όριο ρυθμού,
 * ανίχνευση σιωπηλής συσκευής, ασφαλής σύνδεση (κωδικός από config, TLS) και τελικός hub.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 20, title: 'Κανόνες, ειδοποιήσεις και αξιόπιστα δεδομένα', ready: true, unlockAfter: 19, lang: 'python' });

  [
    { term: 'try / except', def: 'Η Python δοκιμάζει τον κώδικα μέσα στο try. Αν βγει το σφάλμα που γράφεις στο except, δεν σταματά το πρόγραμμα: τρέχει το except. Π.χ. except json.JSONDecodeError: για χαλασμένο JSON.' },
    { term: 'JSONDecodeError', def: 'Το σφάλμα του json.loads όταν το κείμενο δεν είναι έγκυρο JSON, π.χ. «hello» ή {"t": nan}.' },
    { term: 'dict.get', def: 'data.get("t") δίνει την τιμή του κλειδιού, ή None αν το κλειδί λείπει. Το data["t"] θα έβγαζε KeyError.' },
    { term: 'εύρος αληθοφάνειας', def: 'Οι τιμές που μπορεί πραγματικά να δώσει ένας αισθητήρας, π.χ. −40 έως 85 °C. Μια τιμή έξω από αυτό είναι σχεδόν σίγουρα λάθος και αγνοείται.' },
    { term: 'όριο ρυθμού (rate limit)', def: 'Κανόνας «το πολύ μία φορά ανά Χ δευτερόλεπτα». Εμποδίζει μια ειδοποίηση να στέλνεται ξανά και ξανά για το ίδιο πρόβλημα.' },
    { term: 'time.monotonic', def: 'Ρολόι που μετρά δευτερόλεπτα και πάει μόνο μπροστά. Δεν αλλάζει αν διορθωθεί η ώρα του Pi. Κατάλληλο για «πόσος χρόνος πέρασε».' },
    { term: 'loop_start', def: 'Η client.loop_start() τρέχει το δίκτυο και τα callbacks του paho «στο παρασκήνιο». Έτσι το πρόγραμμα έχει δικό του while True: … time.sleep(…).' },
    { term: 'σιωπηλή συσκευή (stale)', def: 'Συσκευή που δεν έχει στείλει τίποτα για πολύ ώρα. Μπορεί να τελείωσε η μπαταρία ή να χάθηκε το WiFi. Ο hub το καταλαβαίνει μετρώντας τον χρόνο από το τελευταίο μήνυμα.' },
    { term: 'tls_set', def: 'Η client.tls_set(ca_certs="home-ca.crt") ενεργοποιεί TLS στο paho και λέει ποια CA εμπιστεύεται. Ελέγχει CA, όνομα και ημερομηνία του πιστοποιητικού.' },
    { term: 'username_pw_set', def: 'Η client.username_pw_set(user, password) δίνει στον client όνομα χρήστη και κωδικό για τον broker. Καλείται πριν από το connect.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX = 'Ό,τι στο Κεφ. 19, και: try/except json.JSONDecodeError, return, dict.get, isinstance(x, (int, float)), αλυσίδα σύγκρισης a <= x <= b, global, time.monotonic(), time.sleep, client.loop_start(), while True';
  const PANELS = ['serial', 'vars', 'mqtt', 'net'];
  const OPEN_BROKER = 'listener 1883\nallow_anonymous true\n';
  const DASH = { name: 'dashboard', subs: ['home/#'] };
  const TEMP_SENSOR = { name: 'esp32-temp', publish: [{ topic: 'home/temperature', payload: '{"t": {temp}, "n": {n}}', every: 5000, offset: 1000 }] };
  const TEMP_WORLD = { broker: OPEN_BROKER, clients: [DASH, TEMP_SENSOR] };

  // Κοινός έλεγχος εισόδου (από το 20.1), έτοιμος στα επόμενα μαθήματα.
  const PARSE_TEMP = `def parse_temp(text):
    # Επιστρέφει τη θερμοκρασία ως αριθμό, ή None αν το μήνυμα δεν είναι αξιόπιστο.
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    t = data.get("t")
    if not isinstance(t, (int, float)):
        return None
    if not (-40 <= t <= 85):
        return None
    return t
`;

  // ------------------------------------------------------------ 20.1
  const L1_INITIAL = `# Ο hub δεν πρέπει να «πέφτει» από ένα χαλασμένο μήνυμα.
import json
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")

def on_message(client, userdata, msg):
    text = msg.payload.decode()
    try:
        data = json.loads(text)
    except ____:                        # ΣΥΜΠΛΗΡΩΣΕ: το σφάλμα του json
        print("Ignored: bad JSON")
        return
    t = data.____("t")                  # ΣΥΜΠΛΗΡΩΣΕ: δίνει None αν λείπει το κλειδί
    if not isinstance(t, (int, float)):
        print("Ignored: no number")
        return
    if not (____ <= t <= ____):         # ΣΥΜΠΛΗΡΩΣΕ: το εύρος του αισθητήρα (−40 έως 85)
        print("Ignored: out of range")
        return
    print(f"Temp: {t:.1f} C")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
client.loop_forever()
`;
  const L1_SOLUTION = `# Ο hub δεν πρέπει να «πέφτει» από ένα χαλασμένο μήνυμα.
import json
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")

def on_message(client, userdata, msg):
    text = msg.payload.decode()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:        # όχι έγκυρο JSON
        print("Ignored: bad JSON")
        return
    t = data.get("t")                   # None αν λείπει
    if not isinstance(t, (int, float)):
        print("Ignored: no number")
        return
    if not (-40 <= t <= 85):            # έξω από το εύρος του αισθητήρα
        print("Ignored: out of range")
        return
    print(f"Temp: {t:.1f} C")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
client.loop_forever()
`;

  // ------------------------------------------------------------ 20.2
  const L2_HEAD = `# Ειδοποίηση για υψηλή θερμοκρασία, το πολύ μία φορά το λεπτό.
import json
import time
import paho.mqtt.client as mqtt

ALERT_LIMIT = 28      # βαθμοί
COOLDOWN = 60         # δευτερόλεπτα ανάμεσα σε δύο ειδοποιήσεις
last_alert = None     # πότε στάλθηκε η τελευταία (time.monotonic)

${PARSE_TEMP}
def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")

def on_message(client, userdata, msg):
    global last_alert
    t = parse_temp(msg.payload.decode())
    if t is None:
        return
    print(f"Temp: {t:.1f} C")
    if t > ALERT_LIMIT:
        now = time.monotonic()
`;
  const L2_TAIL = `
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
client.loop_forever()
`;
  const L2_INITIAL = L2_HEAD + `        if last_alert is None or now - last_alert >= ____:   # ΣΥΜΠΛΗΡΩΣΕ: πόσα δευτερόλεπτα;
            alert = {"type": "high_temp", "t": t}
            client.publish("home/alerts", json.dumps(alert))
            print("Alert sent")
            last_alert = ____                                  # ΣΥΜΠΛΗΡΩΣΕ: θυμήσου πότε
` + L2_TAIL;
  const L2_SOLUTION = L2_HEAD + `        if last_alert is None or now - last_alert >= COOLDOWN:
            alert = {"type": "high_temp", "t": t}
            client.publish("home/alerts", json.dumps(alert))
            print("Alert sent")
            last_alert = now                                   # από εδώ μετράει το λεπτό
` + L2_TAIL;

  // ------------------------------------------------------------ 20.3
  const L3_HEAD = `# Ο hub καταλαβαίνει πότε το esp32-temp «σώπασε».
import json
import time
import paho.mqtt.client as mqtt

TIMEOUT = 30                  # δευτερόλεπτα χωρίς μήνυμα → offline
last_seen = time.monotonic()  # πότε ήρθε το τελευταίο μήνυμα
offline_sent = False          # έχουμε ήδη πει «offline»;

def send_status(status):
    alert = {"device": "esp32-temp", "status": status}
    client.publish("home/alerts", json.dumps(alert))
    print("esp32-temp", status)

def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")

def on_message(client, userdata, msg):
    global last_seen, offline_sent
    last_seen = time.monotonic()
    print("Seen esp32-temp")
    if offline_sent:          # ήταν offline και ξαναμίλησε
        send_status("online")
        offline_sent = False

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
client.loop_start()           # τα callbacks τρέχουν στο παρασκήνιο

while True:
`;
  const L3_INITIAL = L3_HEAD + `    # ΓΡΑΨΕ ΕΔΩ: αν πέρασαν πάνω από TIMEOUT δευτερόλεπτα από το last_seen
    # και δεν έχεις ήδη στείλει «offline»:
    #     send_status("offline") και offline_sent = True
    time.sleep(1)
`;
  const L3_SOLUTION = L3_HEAD + `    silent = time.monotonic() - last_seen
    if silent > TIMEOUT and not offline_sent:
        send_status("offline")
        offline_sent = True
    time.sleep(1)
`;

  // ------------------------------------------------------------ 20.4
  const SECURE_BROKER = 'listener 8883\ntls on\nallow_anonymous false\npassword pi-hub Hub-Lab-Key-2026\npassword esp32-temp Temp-Lab-Key-0911\npassword dashboard Dash-Lab-Key-0815\n';
  const SECURE_WORLD = {
    broker: SECURE_BROKER, cert: 'valid',
    clients: [
      { name: 'dashboard', subs: ['home/#'], user: 'dashboard', pass: 'Dash-Lab-Key-0815', port: 8883, tls: true },
      { name: 'esp32-temp', user: 'esp32-temp', pass: 'Temp-Lab-Key-0911', port: 8883, tls: true, publish: [{ topic: 'home/temperature', payload: '{"t": {temp}}', every: 5000, offset: 1000 }] }
    ],
    consts: { MQTT_USER: 'pi-hub', MQTT_PASS: 'Hub-Lab-Key-2026' }
  };
  const L4_BODY = `def on_connect(client, userdata, flags, reason_code, properties):
    print("Connected:", reason_code)
    if reason_code.is_failure:
        return
    client.subscribe("home/temperature")
    client.publish("home/hub/status", "online", retain=True)

def on_message(client, userdata, msg):
    data = json.loads(msg.payload.decode())
    t = data["t"]
    print(f"Temp: {t:.1f} C")

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
`;
  const L4_INITIAL = `# Ο broker του σπιτιού έγινε ασφαλής: μόνο TLS στη θύρα 8883 και μόνο με κωδικό.
# Ο hub πρέπει να ακολουθήσει.
import json
import paho.mqtt.client as mqtt

${L4_BODY}client.username_pw_set("pi-hub", "Hub-Lab-Key-2026")
client.connect("localhost", 1883)
client.loop_forever()
`;
  const L4_SOLUTION = `# Ο broker του σπιτιού έγινε ασφαλής: μόνο TLS στη θύρα 8883 και μόνο με κωδικό.
# Ο hub πρέπει να ακολουθήσει.
import json
import paho.mqtt.client as mqtt
from config import MQTT_USER, MQTT_PASS      # τα μυστικά μένουν έξω από τον κώδικα

${L4_BODY}client.username_pw_set(MQTT_USER, MQTT_PASS)
client.tls_set(ca_certs="home-ca.crt")       # TLS με έλεγχο από τη CA του σπιτιού
client.connect("broker.home.lan", 8883)      # το όνομα που γράφει το πιστοποιητικό
client.loop_forever()
`;

  // ------------------------------------------------------------ 20.5
  const L5_TOP = `# Ο τελικός hub του σπιτιού.
import json
import time
import paho.mqtt.client as mqtt

ALERT_LIMIT = 28
COOLDOWN = 60
last_alert = None

${PARSE_TEMP}`;
  const L5_TAIL = `
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
`;
  const L5_INITIAL = L5_TOP + `
def on_connect(client, userdata, flags, reason_code, properties):
    client.publish("home/hub/status", "online", retain=True)

def handle_temperature(text):
    global last_alert
    data = json.loads(text)
    t = data["t"]
    print(f"Temp: {t:.1f} C")
    if t > ALERT_LIMIT:
        client.publish("home/alerts", json.dumps({"type": "high_temp", "t": t}))
        print("Alert sent")
        last_alert = time.monotonic()

def handle_motion(text):
    data = json.loads(text)
    if data.get("motion") is True:
        client.publish("home/led/set", json.dumps({"cmd": "ON"}), retain=True)
    elif data.get("motion") is False:
        client.publish("home/led/set", json.dumps({"cmd": "OFF"}), retain=True)

def on_message(client, userdata, msg):
    text = msg.payload.decode()
    if msg.topic == "home/temperature":
        handle_temperature(text)
    elif msg.topic == "home/motion":
        handle_motion(text)
` + L5_TAIL + `client.subscribe("home/temperature")
client.subscribe("home/motion")
client.loop_forever()
`;
  const L5_SOLUTION = L5_TOP + `
def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")         # μέσα στο on_connect:
    client.subscribe("home/motion")              # ξαναγίνονται μετά από restart
    client.publish("home/hub/status", "online", retain=True)

def handle_temperature(text):
    global last_alert
    t = parse_temp(text)                         # έλεγχος εισόδου
    if t is None:
        print("Ignored")
        return
    print(f"Temp: {t:.1f} C")
    if t > ALERT_LIMIT:
        now = time.monotonic()
        if last_alert is None or now - last_alert >= COOLDOWN:   # όριο ρυθμού
            client.publish("home/alerts", json.dumps({"type": "high_temp", "t": t}))
            print("Alert sent")
            last_alert = now

def handle_motion(text):
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return
    if data.get("motion") is True:
        client.publish("home/led/set", json.dumps({"cmd": "ON"}))     # εντολή: όχι retained
    elif data.get("motion") is False:
        client.publish("home/led/set", json.dumps({"cmd": "OFF"}))

def on_message(client, userdata, msg):
    text = msg.payload.decode()
    if msg.topic == "home/temperature":
        handle_temperature(text)
    elif msg.topic == "home/motion":
        handle_motion(text)
` + L5_TAIL + `client.loop_forever()
`;

  const MOTION = v => ({ act: { publish: 'esp32-pir', topic: 'home/motion', payload: `{"motion": ${v}}` } });

  L.lessons.push(
    {
      id: 'c20-l1', chapter: 20, kind: 'guided', lang: 'python', skills: ['python', 'sensors', 'security'],
      title: 'Ο hub δεν πέφτει από χαλασμένα δεδομένα',
      prerequisites: [],
      objectives: ['Να πιάνω το JSONDecodeError με try/except.', 'Να διαβάζω κλειδιά με .get() αντί για [ ].', 'Να αγνοώ τιμές έξω από το εύρος του αισθητήρα.'],
      theory: `
<p>Ο hub διαβάζει μηνύματα από πολλές συσκευές. Κάποια θα είναι <strong>χαλασμένα</strong>: αισθητήρας με βλάβη, λάθος firmware, μήνυμα από άλλη συσκευή. Ένα κακό μήνυμα <strong>δεν πρέπει</strong> να σταματά όλο το σπίτι.</p>
<p>Στο ESP32 είχαμε <code>jsonValid(p)</code> και <code>isnan(t)</code>. Στην Python, τρεις έλεγχοι:</p>
<ol>
  <li><strong>Είναι JSON;</strong> Το <code>json.loads</code> βγάζει <code>json.JSONDecodeError</code> για κακό κείμενο. Το πιάνουμε:
<pre>try:
    data = json.loads(text)
except json.JSONDecodeError:
    return</pre></li>
  <li><strong>Υπάρχει το κλειδί;</strong> Το <code>data["t"]</code> βγάζει KeyError αν λείπει. Το <code>data.get("t")</code> δίνει <code>None</code>. Μετά ελέγχουμε ότι είναι αριθμός με <code>isinstance(t, (int, float))</code>.</li>
  <li><strong>Είναι αληθοφανές;</strong> Ο αισθητήρας μετρά από −40 έως 85 °C. Ό,τι είναι έξω, αγνοείται: <code>-40 &lt;= t &lt;= 85</code>.</li>
</ol>
<p>Ένας αισθητήρας με βλάβη στέλνει <code>{"t": nan}</code>. Το <code>nan</code> <strong>δεν</strong> είναι έγκυρο JSON, άρα το πιάνει ο πρώτος έλεγχος.</p>
<p>Το <code>return</code> μέσα στο callback σημαίνει «αγνόησε αυτό το μήνυμα και περίμενε το επόμενο».</p>`,
      glossary: ['try / except', 'JSONDecodeError', 'dict.get', 'εύρος αληθοφάνειας', 'έλεγχος εισόδου (validation)'],
      supportedSyntax: SYNTAX,
      initialCode: L1_INITIAL,
      solution: L1_SOLUTION,
      world: TEMP_WORLD, initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το όνομα του σφάλματος στο except.',
        'Συμπλήρωσε τη μέθοδο του λεξικού που δεν «σκάει» όταν λείπει το κλειδί.',
        'Συμπλήρωσε το εύρος: −40 έως 85.',
        'Τρέξε. Άναψε το «Σφάλμα αισθητήρα». Ο hub συνεχίζει; Στείλε από το dashboard στο home/temperature: hello, {"temp": 21} και {"t": 150}.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Φτάνει το μήνυμα {"temp": 21}. Τι κάνει το data.get("t");',
        options: ['Δίνει None, χωρίς σφάλμα', 'Βγάζει KeyError και σταματά το πρόγραμμα', 'Δίνει 21'],
        answer: 0,
        explain: 'Σωστά. Το κλειδί είναι "temp", όχι "t". Το .get() δίνει None, και ο επόμενος έλεγχος (isinstance) αγνοεί το μήνυμα. Το data["t"] θα έβγαζε KeyError.',
        retry: 'Όχι ακόμα. Ποιο κλειδί έχει το μήνυμα; Τι κάνει το .get() όταν το κλειδί λείπει;'
      },
      hints: [
        'Τρία κενά: το σφάλμα του json, η «ήπια» ανάγνωση κλειδιού, και δύο αριθμοί.',
        'Το σφάλμα ζει μέσα στο module json: json.JSONDecodeError. Η μέθοδος του λεξικού είναι η get. Ο αρνητικός αριθμός γράφεται -40.',
        'except json.JSONDecodeError:\nt = data.get("t")\nif not (-40 <= t <= 85):'
      ],
      validationTests: [
        { name: 'Κανονικές μετρήσεις τυπώνονται', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 7000 },
          { check: 'count', text: 'Temp: 22.5 C', min: 1, fail: 'Σε 7 δευτερόλεπτα δεν τυπώθηκε «Temp: 22.5 C». Βλέπω: {v}.', failZero: 'Δεν τυπώθηκε καμία κανονική μέτρηση. Μήπως ο έλεγχος εύρους απορρίπτει και τις σωστές τιμές;' }
        ] },
        { name: 'Αισθητήρας με βλάβη (nan): ο hub συνεχίζει', world: { temp: 22.5, sensorFault: true }, script: [
          { setup: true }, { ms: 7000 },
          { check: 'count', text: 'Ignored: bad JSON', min: 1, fail: 'Το {"t": nan} δεν αναγνωρίστηκε ως κακό JSON ({n} φορές «Ignored: bad JSON»).' },
          { check: 'mqttConnected', is: true, fail: 'Μετά το {"t": nan} ο hub δεν είναι συνδεδεμένος. {v}' },
          { set: { sensorFault: false } }, { ms: 6000 },
          { check: 'serialHas', text: 'Temp: 22.5 C', fail: 'Όταν ο αισθητήρας διορθώθηκε, ο hub δεν τύπωσε μέτρηση. Βλέπω: {v}.' }
        ] },
        { name: 'Κακά μηνύματα από το dashboard αγνοούνται', script: [
          { setup: true }, { ms: 500 },
          { dash: { topic: 'home/temperature', payload: 'hello' } }, { ms: 200 },
          { dash: { topic: 'home/temperature', payload: '{"temp": 21}' } }, { ms: 200 },
          { dash: { topic: 'home/temperature', payload: '{"t": "hot"}' } }, { ms: 200 },
          { dash: { topic: 'home/temperature', payload: '{"t": 150}' } }, { ms: 200 },
          { dash: { topic: 'home/temperature', payload: '{"t": 21.5}' } }, { ms: 200 },
          { check: 'count', text: 'Ignored: bad JSON', is: 1, fail: 'Για το «hello» περίμενα 1 φορά «Ignored: bad JSON». Βρήκα {n}.' },
          { check: 'count', text: 'Ignored: no number', is: 2, fail: 'Για τα {"temp": 21} και {"t": "hot"} περίμενα 2 φορές «Ignored: no number». Βρήκα {n}.' },
          { check: 'count', text: 'Ignored: out of range', is: 1, fail: 'Για το {"t": 150} περίμενα 1 φορά «Ignored: out of range». Βρήκα {n}.' },
          { check: 'count', text: 'Temp: 21.5 C', is: 1, fail: 'Μετά τα κακά μηνύματα, το σωστό {"t": 21.5} τυπώθηκε {n} φορές. Περίμενα 1.' }
        ] }
      ],
      explanationOnSuccess: 'Ο hub αντέχει: κακό JSON, κλειδί που λείπει, κείμενο αντί για αριθμό, τιμή που δεν γίνεται. Αγνοεί το μήνυμα και περιμένει το επόμενο. Αυτό είναι έλεγχος εισόδου: δεν εμπιστευόμαστε τυφλά ό,τι έρχεται από το δίκτυο, ούτε από τις δικές μας συσκευές.',
      remediation: 'Αν βλέπεις «AttributeError: \'list\' object has no attribute \'get\'», ήρθε JSON που δεν είναι λεξικό. Ένα ακόμα isinstance(data, dict) το λύνει.'
    },

    {
      id: 'c20-l2', chapter: 20, kind: 'guided', lang: 'python', skills: ['python', 'automation', 'mqtt'],
      title: 'Ειδοποίηση με όριο ρυθμού',
      prerequisites: ['c20-l1'],
      objectives: ['Να στέλνω ειδοποίηση όταν η θερμοκρασία ξεπερνά ένα όριο.', 'Να στέλνω το πολύ μία ειδοποίηση ανά 60 δευτερόλεπτα.', 'Να μετρώ χρόνο με time.monotonic().'],
      theory: `
<p>Κανόνας: <strong>«αν η θερμοκρασία ξεπεράσει τους 28 βαθμούς, στείλε ειδοποίηση στο <code>home/alerts</code>»</strong>.</p>
<p>Πρόβλημα: το θερμόμετρο στέλνει κάθε 5 δευτερόλεπτα. Χωρίς όριο, ο hub θα έστελνε <strong>12 ειδοποιήσεις το λεπτό</strong> για το ίδιο πρόβλημα. Τόσες ειδοποιήσεις τις αγνοεί κανείς.</p>
<p>Λύση: <strong>όριο ρυθμού</strong>. Θυμόμαστε πότε στάλθηκε η τελευταία. Στέλνουμε ξανά μόνο αν πέρασαν 60 δευτερόλεπτα.</p>
<p>Στο ESP32 είχαμε <code>millis()</code>. Στην Python υπάρχει το <code>time.monotonic()</code>: δευτερόλεπτα που πάνε μόνο μπροστά.</p>
<pre>now = time.monotonic()
if last_alert is None or now - last_alert >= COOLDOWN:
    … στείλε …
    last_alert = now</pre>
<ul>
  <li>Το <code>None</code> σημαίνει «δεν έχει σταλεί ποτέ».</li>
  <li>Το <code>global last_alert</code> χρειάζεται, γιατί το callback αλλάζει μια μεταβλητή έξω από αυτό.</li>
</ul>
<p>Η <code>parse_temp</code> είναι ο έλεγχος εισόδου του προηγούμενου μαθήματος, σε συνάρτηση.</p>`,
      glossary: ['όριο ρυθμού (rate limit)', 'time.monotonic', 'όριο'],
      supportedSyntax: SYNTAX,
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      world: TEMP_WORLD, initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε πόσα δευτερόλεπτα πρέπει να περάσουν (υπάρχει έτοιμη σταθερά).',
        'Συμπλήρωσε τι θυμάται το last_alert μετά την αποστολή.',
        'Τρέξε. Ανέβασε τη θερμοκρασία στους 31 και περίμενε 1–2 λεπτά. Μέτρα τα «Alert sent».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Η θερμοκρασία μένει στους 31 για 2 λεπτά. Μέτρηση κάθε 5 s, όριο ρυθμού 60 s. Πόσες ειδοποιήσεις στέλνονται περίπου;',
        options: ['2 έως 3', '24', '1'],
        answer: 0,
        explain: 'Σωστά. Μία στην αρχή, μία μετά από 60 s, και ίσως μία ακόμα στα 120 s. Χωρίς όριο θα ήταν 24.',
        retry: 'Όχι ακόμα. Πόσα διαστήματα των 60 δευτερολέπτων χωράνε σε 2 λεπτά;'
      },
      hints: [
        'Το πρώτο κενό είναι η διάρκεια σε δευτερόλεπτα. Το δεύτερο είναι η στιγμή που μόλις στείλαμε.',
        'Στην αρχή του προγράμματος υπάρχει COOLDOWN = 60. Στο callback υπάρχει ήδη η μεταβλητή now.',
        'if last_alert is None or now - last_alert >= COOLDOWN:\n    …\n    last_alert = now'
      ],
      validationTests: [
        { name: 'Ζέστη για 100 s → ακριβώς 2 ειδοποιήσεις', world: { temp: 31 }, script: [
          { setup: true }, { ms: 100000 },
          { check: 'published', topic: 'home/alerts', json: { type: 'high_temp' }, min: 2, max: 2, fail: 'Σε 100 δευτερόλεπτα στους 31 βαθμούς στάλθηκαν {n} ειδοποιήσεις. Περίμενα 2 (στην αρχή και μετά από 60 s).', failZero: 'Δεν στάλθηκε καμία ειδοποίηση στους 31 βαθμούς. Έλεγξε τη συνθήκη t > ALERT_LIMIT.' }
        ] },
        { name: 'Κανονική θερμοκρασία → καμία ειδοποίηση· ζέστη → αμέσως μία', world: { temp: 22 }, script: [
          { setup: true }, { ms: 20000 },
          { check: 'published', topic: 'home/alerts', is: 0, fail: 'Στους 22 βαθμούς στάλθηκαν {n} ειδοποιήσεις. Περίμενα 0.' },
          { set: { temp: 30.5 } }, { ms: 10000 },
          { check: 'published', topic: 'home/alerts', json: { type: 'high_temp', t: 30.5 }, is: 1, fail: 'Μόλις ανέβηκε στους 30.5 στάλθηκαν {n} ειδοποιήσεις {"type": "high_temp", "t": 30.5}. Περίμενα 1. Ο hub έστειλε: {v}.' },
          { check: 'dashboard', topic: 'home/alerts', json: { type: 'high_temp' }, fail: 'Το dashboard βλέπει στο home/alerts {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η ειδοποίηση φτάνει αμέσως, αλλά δεν «βομβαρδίζει». Αν θες να πας παραπέρα: με υστέρηση (π.χ. «ξανά συναγερμός μόνο αφού πέσει κάτω από 26») ο hub δεν ενοχλεί όταν η θερμοκρασία παίζει γύρω από τους 28.',
      remediation: 'Αν οι ειδοποιήσεις είναι πολλές, μάλλον το last_alert δεν αλλάζει. Χρειάζεται global last_alert στην αρχή του callback και last_alert = now μετά το publish.'
    },

    {
      id: 'c20-l3', chapter: 20, kind: 'variant', lang: 'python', skills: ['python', 'automation', 'sensors'],
      title: 'Σιωπηλή συσκευή: «το esp32-temp χάθηκε»',
      prerequisites: ['c20-l2'],
      objectives: ['Να χρησιμοποιώ loop_start() με δικό μου while True.', 'Να ανιχνεύω συσκευή που δεν στέλνει πια.', 'Να στέλνω «offline» μία φορά και «online» όταν επιστρέψει.'],
      theory: `
<p>Μια συσκευή που <strong>δεν στέλνει τίποτα</strong> είναι επίσης πρόβλημα: μπαταρία, WiFi, βλάβη. Το <code>on_message</code> όμως δεν καλείται ποτέ για ένα μήνυμα που <strong>δεν</strong> ήρθε.</p>
<p>Άρα ο hub χρειάζεται δικό του βρόχο που κοιτά το ρολόι. Αντί για <code>loop_forever()</code>:</p>
<pre>client.loop_start()      # το paho δουλεύει στο παρασκήνιο
while True:
    … δικός μου έλεγχος …
    time.sleep(1)        # όσο κοιμάται, τρέχουν τα callbacks</pre>
<p>Ο έλεγχος:</p>
<ul>
  <li>Κάθε μήνυμα κάνει <code>last_seen = time.monotonic()</code>.</li>
  <li>Αν πέρασαν <strong>πάνω από 30 δευτερόλεπτα</strong> χωρίς μήνυμα → <code>{"device": "esp32-temp", "status": "offline"}</code> στο <code>home/alerts</code>.</li>
  <li><strong>Μία φορά</strong>: η σημαία <code>offline_sent</code> θυμάται ότι το είπαμε.</li>
  <li>Όταν ξαναέρθει μήνυμα → «online» (αυτό είναι έτοιμο).</li>
</ul>
<p>Το εικονικό esp32-temp εδώ έχει πρόβλημα: στέλνει μόνο μία φορά στα 50 δευτερόλεπτα.</p>`,
      glossary: ['loop_start', 'σιωπηλή συσκευή (stale)', 'time.monotonic', 'timeout'],
      supportedSyntax: SYNTAX,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: { broker: OPEN_BROKER, clients: [DASH, { name: 'esp32-temp', publish: [{ topic: 'home/temperature', payload: '{"t": {temp}}', every: 50000, offset: 1000 }] }] },
      initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα για ένα λεπτό. Πότε τυπώνεται «Seen esp32-temp»;',
        'Απάντησε στην ερώτηση.',
        'Μέσα στο while True γράψε τον έλεγχο: πόσα δευτερόλεπτα πέρασαν από το last_seen;',
        'Αν είναι πάνω από TIMEOUT και δεν έχεις στείλει ήδη: send_status("offline") και offline_sent = True.',
        'Τρέξε ξανά. Βλέπεις «offline» μετά από ~30 s και «online» στα ~51 s; Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Γιατί δεν μπορούμε να βάλουμε τον έλεγχο «πέρασαν 30 s;» μέσα στο on_message;',
        options: ['Γιατί το on_message καλείται μόνο όταν έρθει μήνυμα, και τότε η συσκευή δεν είναι σιωπηλή', 'Γιατί το on_message δεν έχει πρόσβαση στο time', 'Γιατί το on_message τρέχει μόνο μία φορά'],
        answer: 0,
        explain: 'Σωστά. Όσο η συσκευή σωπαίνει, το on_message δεν καλείται καθόλου. Χρειάζεται ένας βρόχος που ξυπνά κάθε δευτερόλεπτο και κοιτά το ρολόι, ανεξάρτητα από τα μηνύματα.',
        retry: 'Όχι ακόμα. Πότε ακριβώς καλείται το on_message;'
      },
      hints: [
        'Δύο συνθήκες μαζί: πέρασε πολύς χρόνος ΚΑΙ δεν το έχουμε πει ήδη.',
        'Ο χρόνος σιωπής είναι time.monotonic() - last_seen. Το «δεν το έχουμε πει» είναι not offline_sent. Ένωσέ τα με and.',
        'silent = time.monotonic() - last_seen\nif silent > TIMEOUT and not offline_sent:\n    send_status("offline")\n    offline_sent = True\ntime.sleep(1)'
      ],
      validationTests: [
        { name: 'Συσκευή που μιλά κάθε 10 s → κανένα «offline»', script: [
          { setup: true }, { ms: 10000 },
          { act: { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t": 22.5}' } }, { ms: 10000 },
          { act: { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t": 22.5}' } }, { ms: 10000 },
          { act: { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t": 22.5}' } }, { ms: 10000 },
          { act: { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t": 22.5}' } }, { ms: 8000 },
          { check: 'count', text: 'Seen esp32-temp', min: 4, fail: 'Ο hub είδε {n} μηνύματα. Περίμενα τουλάχιστον 4. Τρέχει το loop_start(); Υπάρχει time.sleep(…) μέσα στο while;' },
          { check: 'published', topic: 'home/alerts', json: { status: 'offline' }, is: 0, fail: 'Η συσκευή μιλούσε κάθε 10 s, αλλά στάλθηκαν {n} «offline». Το όριο είναι 30 s.' }
        ] },
        { name: 'Σιωπή πάνω από 30 s → ένα «offline», όχι περισσότερα', script: [
          { setup: true }, { ms: 45000 },
          { check: 'published', topic: 'home/alerts', json: { device: 'esp32-temp', status: 'offline' }, is: 1, fail: 'Μετά από ~44 s σιωπής στάλθηκαν {n} μηνύματα {"device": "esp32-temp", "status": "offline"}. Περίμενα ακριβώς 1. Ο hub έστειλε: {v}.', failZero: 'Μετά από ~44 s σιωπής δεν στάλθηκε «offline». Γράψε τον έλεγχο μέσα στο while True.' },
          { check: 'dashboard', topic: 'home/alerts', json: { status: 'offline' }, fail: 'Το dashboard βλέπει στο home/alerts {v}.' }
        ] },
        { name: 'Η συσκευή επιστρέφει → «online»', script: [
          { setup: true }, { ms: 60000 },
          { check: 'published', topic: 'home/alerts', json: { status: 'offline' }, is: 1, fail: 'Στάλθηκαν {n} «offline». Περίμενα 1.' },
          { check: 'published', topic: 'home/alerts', json: { device: 'esp32-temp', status: 'online' }, is: 1, fail: 'Όταν η συσκευή ξαναμίλησε (στα ~51 s), στάλθηκαν {n} «online». Περίμενα 1. Αλλάζει το offline_sent σε True όταν στέλνεις «offline»;' }
        ] }
      ],
      explanationOnSuccess: 'Ο hub ξέρει πια όχι μόνο τι λένε οι συσκευές, αλλά και ποια σώπασε. Στο αληθινό MQTT υπάρχει και το «Last Will»: ο broker στέλνει ένα μήνυμα όταν ένας client χαθεί απότομα. Ο έλεγχος χρόνου όμως πιάνει και συσκευές που είναι συνδεδεμένες αλλά δεν μετρούν πια.',
      remediation: 'Αν βλέπεις «offline» κάθε δευτερόλεπτο, λείπει το offline_sent = True. Αν δεν τρέχουν τα callbacks, έλεγξε ότι υπάρχει time.sleep(1) μέσα στο while.'
    },

    {
      id: 'c20-l4', chapter: 20, kind: 'independent', lang: 'python', skills: ['python', 'security', 'mqtt'],
      title: 'Ασφαλής hub: κωδικός από config και TLS',
      prerequisites: ['c20-l3'],
      objectives: ['Να διαβάζω τα στοιχεία σύνδεσης από το config, όχι από τον κώδικα.', 'Να ενεργοποιώ TLS με έλεγχο πιστοποιητικού στο paho.', 'Να συνδέομαι με το όνομα που γράφει το πιστοποιητικό.'],
      theory: `
<p>Ο broker του σπιτιού έγινε ασφαλής, όπως στα Κεφάλαια 10 και 11:</p>
<pre>listener 8883
tls on
allow_anonymous false</pre>
<p>Ο hub δεν συνδέεται πια. Η δουλειά σου είναι να τον φτιάξεις <strong>μόνος σου</strong>.</p>
<p>Στο ESP32 γράφαμε <code>mqtt.setCACert(HOME_CA)</code> και <code>mqtt.connect(id, MQTT_USER, MQTT_PASS)</code>. Στο paho:</p>
<ul>
  <li><code>from config import MQTT_USER, MQTT_PASS</code>: τα στοιχεία από ξεχωριστό αρχείο. Ο κωδικός <strong>δεν</strong> γράφεται στον κώδικα.</li>
  <li><code>client.username_pw_set(user, password)</code>, πριν από το <code>connect</code>.</li>
  <li><code>client.tls_set(ca_certs="home-ca.crt")</code>: TLS με έλεγχο από τη CA του σπιτιού.</li>
  <li><code>client.connect("broker.home.lan", 8883)</code>.</li>
</ul>
<p>Προσοχή στο όνομα: το πιστοποιητικό γράφει <code>broker.home.lan</code>. Με TLS το <code>"localhost"</code> δεν ταιριάζει και ο έλεγχος αποτυγχάνει. Αυτό είναι σωστό: ο έλεγχος δουλεύει.</p>
<p>Αν το πιστοποιητικό δεν περνά τον έλεγχο, το paho σταματά με <code>SSLCertVerificationError</code>. Η λύση δεν είναι το <code>tls_insecure_set(True)</code>. Η λύση είναι να διορθωθεί το πιστοποιητικό.</p>
<p>Το TLS εδώ είναι εκπαιδευτική προσομοίωση, όχι πραγματική κρυπτογράφηση.</p>`,
      glossary: ['username_pw_set', 'tls_set', 'αρχείο ρυθμίσεων', 'TLS', 'hostname', 'μυστικό (secret)'],
      supportedSyntax: SYNTAX + ', from config import MQTT_USER, MQTT_PASS, client.username_pw_set, client.tls_set(ca_certs=…)',
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: SECURE_WORLD, initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: ['serial', 'mqtt', 'net', 'logs'],
      steps: [
        'Τρέξε. Διάβασε το σφάλμα: γιατί απορρίπτεται η σύνδεση;',
        'Πάρε το όνομα χρήστη και τον κωδικό από το config. Σβήσε τον κωδικό από τον κώδικα.',
        'Ενεργοποίησε TLS και άλλαξε θύρα και όνομα broker.',
        'Τρέξε. Στον Network Monitor: βλέπεις TLS ή MQTT σε καθαρό κείμενο;',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο hub λέει SSLCertVerificationError: το πιστοποιητικό έληξε. Τι κάνεις;',
        options: ['Ανανεώνεται το πιστοποιητικό στον broker· ο hub κάνει σωστά που σταματά', 'Βάζω client.tls_insecure_set(True) για να δουλέψει', 'Γυρνάω στη θύρα 1883 χωρίς TLS'],
        answer: 0,
        explain: 'Σωστά. Ένας client που δέχεται ό,τι πιστοποιητικό του δώσουν δεν ελέγχει τίποτα. Η διόρθωση γίνεται στην πηγή: νέο πιστοποιητικό στον broker.',
        retry: 'Όχι ακόμα. Τι θα σήμαινε να απενεργοποιήσεις τον έλεγχο; Θυμήσου το setInsecure στο Κεφάλαιο 11.'
      },
      hints: [
        'Τρία πράγματα: τα στοιχεία από το config, TLS, και η σωστή θύρα με το σωστό όνομα.',
        'Πρόσθεσε from config import MQTT_USER, MQTT_PASS στην αρχή. Πριν από το connect: username_pw_set και tls_set. Η θύρα TLS είναι η 8883.',
        'from config import MQTT_USER, MQTT_PASS\n…\nclient.username_pw_set(MQTT_USER, MQTT_PASS)\nclient.tls_set(ca_certs="home-ca.crt")\nclient.connect("broker.home.lan", 8883)'
      ],
      validationTests: [
        { name: 'Ο hub συνδέεται με TLS και ακούει', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 7000 },
          { check: 'mqttConnected', is: true, fail: 'Ο hub δεν είναι συνδεδεμένος. {v}' },
          { check: 'deviceEncrypted', fail: 'Ο hub έστειλε {n} πακέτα MQTT σε καθαρό κείμενο. Χρειάζεται client.tls_set(…) και η θύρα 8883.' },
          { check: 'serialHas', text: 'Temp: 22.5 C', fail: 'Ο hub δεν τύπωσε μέτρηση. Βλέπω: {v}.' }
        ] },
        { name: 'Το «online» φτάνει στο dashboard', script: [
          { setup: true }, { ms: 2000 },
          { check: 'retained', topic: 'home/hub/status', exists: true, fail: 'Ο broker δεν έχει retained κατάσταση για τον hub ({v}). Ο hub συνδέθηκε με επιτυχία;' },
          { check: 'dashboard', topic: 'home/hub/status', payload: 'online', fail: 'Το dashboard βλέπει στο home/hub/status {v}.' }
        ] },
        { name: 'Ο κωδικός δεν είναι γραμμένος στον κώδικα', script: [
          { setup: true }, { ms: 2000 },
          { check: 'mqttConnected', is: true, fail: 'Ο hub δεν συνδέθηκε. {v}' },
          { check: 'sourceNot', text: 'Hub-Lab-Key-2026', fail: 'Ο κωδικός του hub είναι ακόμα γραμμένος στον κώδικα. Πάρε τον από το config: from config import MQTT_USER, MQTT_PASS.' }
        ] }
      ],
      explanationOnSuccess: 'Ο hub μιλά μόνο μέσα από TLS, ελέγχει το πιστοποιητικό του broker, και ο κωδικός του ζει στο config, όχι στον κώδικα. Αν μοιραστείς το πρόγραμμα, ο κωδικός δεν πάει μαζί. Στο αληθινό Pi το config θα ήταν αρχείο που διαβάζει μόνο ο χρήστης του hub.',
      remediation: 'Αν βλέπεις «certificate verify failed … συνδέεσαι στο localhost», άλλαξε το όνομα σε "broker.home.lan". Αν βλέπεις «Connection refused», έλεγξε τη θύρα 8883.'
    },

    {
      id: 'c20-l5', chapter: 20, kind: 'checkpoint', lang: 'python', skills: ['python', 'automation', 'mqtt', 'security'],
      title: 'Τελικός hub: όλα μαζί',
      prerequisites: ['c20-l4'],
      objectives: ['Να συνδυάζω έλεγχο εισόδου, κανόνες και ειδοποιήσεις σε έναν hub.', 'Να ελέγχω τον hub σε δύσκολες συνθήκες: βλάβη, restart, ζέστη.'],
      theory: `
<p>Ο τελικός hub κάνει τέσσερα πράγματα:</p>
<ol>
  <li>Στη σύνδεση: subscribe στο <code>home/temperature</code> και στο <code>home/motion</code>, και retained <code>online</code> στο <code>home/hub/status</code>.</li>
  <li>Θερμοκρασία: έλεγχος εισόδου. Κακό μήνυμα → «Ignored», και συνεχίζει.</li>
  <li>Πάνω από 28 βαθμούς → <code>{"type": "high_temp", "t": …}</code> στο <code>home/alerts</code>, το πολύ μία φορά το λεπτό.</li>
  <li>Κίνηση → <code>{"cmd": "ON"}</code> ή <code>{"cmd": "OFF"}</code> στο <code>home/led/set</code>.</li>
</ol>
<p>Ο κώδικας εδώ «δουλεύει» σε μια ήσυχη μέρα. Έχει όμως <strong>4 λάθη</strong> που φαίνονται μόνο σε δύσκολες στιγμές:</p>
<ul>
  <li>μετά από restart του broker,</li>
  <li>όταν ο αισθητήρας έχει βλάβη,</li>
  <li>όταν κάνει ζέστη για πολλή ώρα,</li>
  <li>όταν μια συσκευή συνδεθεί αργότερα στο <code>home/led/set</code>.</li>
</ul>
<p>Η <code>parse_temp</code> υπάρχει έτοιμη. Χρησιμοποίησε ό,τι έμαθες στα Κεφάλαια 19 και 20.</p>`,
      glossary: ['hub', 'on_connect', 'έλεγχος εισόδου (validation)', 'όριο ρυθμού (rate limit)', 'retained'],
      supportedSyntax: SYNTAX,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: { broker: OPEN_BROKER, clients: [DASH, TEMP_SENSOR, { name: 'esp32-pir' }] }, initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: PANELS,
      steps: [
        'Τρέξε σε ήσυχη μέρα: θερμοκρασία 22,5, χωρίς βλάβη. Όλα φαίνονται εντάξει;',
        'Δοκίμασε τις δύσκολες στιγμές: «Επανεκκίνηση broker», «Σφάλμα αισθητήρα», 31 βαθμοί για 2 λεπτά.',
        'Κοίτα το home/led/set στο πάνελ MQTT. Μένει κάτι στον broker;',
        'Διόρθωσε τα 4 λάθη, ένα τη φορά.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ποιο από τα παρακάτω πρέπει να στέλνεται ως retained;',
        options: ['Το «online» στο home/hub/status', 'Το {"cmd": "ON"} στο home/led/set', 'Η ειδοποίηση στο home/alerts'],
        answer: 0,
        explain: 'Σωστά. Το «online» είναι κατάσταση: όποιος συνδεθεί αργότερα πρέπει να τη δει. Η εντολή θα ξαναεκτελούνταν από κάθε λάμπα που συνδέεται, και μια παλιά ειδοποίηση θα φαινόταν σαν καινούργια.',
        retry: 'Όχι ακόμα. Retained μόνο για κατάσταση. Ποιο από αυτά λέει «πώς είναι τα πράγματα τώρα»;'
      },
      hints: [
        'Τα 4 λάθη: πού γίνονται τα subscribe, ποια συνάρτηση διαβάζει τη θερμοκρασία, πόσο συχνά στέλνεται η ειδοποίηση, και το retain στην εντολή.',
        'Μετακίνησε τα subscribe στο on_connect. Στο handle_temperature χρησιμοποίησε parse_temp. Πρόσθεσε τον έλεγχο του COOLDOWN με time.monotonic(). Σβήσε το retain=True από το home/led/set.',
        't = parse_temp(text)\nif t is None:\n    print("Ignored")\n    return\n…\nnow = time.monotonic()\nif last_alert is None or now - last_alert >= COOLDOWN:\n    …\n    last_alert = now'
      ],
      validationTests: [
        { name: 'Ήσυχη μέρα: συνδέεται, «online», μετρήσεις', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 7000 },
          { check: 'mqttConnected', is: true, fail: 'Ο hub δεν είναι συνδεδεμένος. {v}' },
          { check: 'retained', topic: 'home/hub/status', exists: true, fail: 'Δεν υπάρχει retained κατάσταση στο home/hub/status ({v}).' },
          { check: 'serialHas', text: 'Temp: 22.5 C', fail: 'Ο hub δεν τύπωσε μέτρηση. Βλέπω: {v}.' }
        ] },
        { name: 'Βλάβη αισθητήρα: ο hub συνεχίζει', world: { temp: 22.5, sensorFault: true }, script: [
          { setup: true }, { ms: 12000 },
          { check: 'mqttConnected', is: true, fail: 'Με τον αισθητήρα σε βλάβη ο hub αποσυνδέθηκε. {v}' },
          { check: 'serialHas', text: 'Ignored', fail: 'Ο hub δεν τύπωσε «Ignored» για τα χαλασμένα μηνύματα. Βλέπω: {v}.' },
          { set: { sensorFault: false } }, { ms: 6000 },
          { check: 'serialHas', text: 'Temp: 22.5 C', fail: 'Όταν ο αισθητήρας διορθώθηκε, ο hub δεν τύπωσε μέτρηση. Βλέπω: {v}.' }
        ] },
        { name: 'Ζέστη για 70 s: ακριβώς 2 ειδοποιήσεις', world: { temp: 31 }, script: [
          { setup: true }, { ms: 70000 },
          { check: 'published', topic: 'home/alerts', json: { type: 'high_temp' }, min: 2, max: 2, fail: 'Σε 70 δευτερόλεπτα στους 31 βαθμούς στάλθηκαν {n} ειδοποιήσεις. Περίμενα 2 (μία στην αρχή, μία μετά από 60 s).' }
        ] },
        { name: 'Κίνηση: εντολές στη λάμπα, όχι retained', script: [
          { setup: true }, { ms: 1000 },
          MOTION('true'), { ms: 300 },
          { check: 'published', topic: 'home/led/set', json: { cmd: 'ON' }, is: 1, fail: 'Μετά από κίνηση στάλθηκαν {n} εντολές ON. Περίμενα 1.' },
          MOTION('false'), { ms: 300 },
          { check: 'published', topic: 'home/led/set', json: { cmd: 'OFF' }, is: 1, fail: 'Μετά το τέλος της κίνησης στάλθηκαν {n} εντολές OFF. Περίμενα 1.' },
          { check: 'retained', topic: 'home/led/set', exists: false, fail: 'Ο broker κρατά retained εντολή στο home/led/set: {v}. Μια λάμπα που θα συνδεθεί αργότερα θα την ξαναεκτελέσει.' }
        ] },
        { name: 'Μετά από restart: μετρήσεις και κίνηση φτάνουν ξανά', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 3000 }, { restartBroker: true }, { set: { temp: 25 } }, { ms: 12000 },
          { check: 'count', text: 'Temp: 25.0 C', min: 2, fail: 'Μετά το restart τυπώθηκε {n} φορές το «Temp: 25.0 C». Περίμενα τουλάχιστον 2. Τα subscribe γίνονται στο on_connect;' },
          MOTION('true'), { ms: 300 },
          { check: 'published', topic: 'home/led/set', json: { cmd: 'ON' }, is: 1, fail: 'Μετά το restart η κίνηση δεν έφτασε στον hub ({n} εντολές ON).' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το Μέρος Β. Ο hub σου αντέχει restart, βλάβη αισθητήρα και πολύωρη ζέστη, και δεν αφήνει παλιές εντολές στον broker. Αυτές οι «δύσκολες στιγμές» είναι ακριβώς αυτές που κρίνουν αν ένα σύστημα σπιτιού είναι αξιόπιστο.',
      remediation: 'Διόρθωνε ένα λάθος τη φορά και τρέχε τον έλεγχο λύσης: κάθε test δείχνει ποια δύσκολη στιγμή αποτυγχάνει.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
