/*
 * IoT Guardian — Κεφάλαιο 21 (Μέρος Β): Αποθήκευση μετρήσεων με SQLite.
 * Ο hub στο Raspberry Pi κρατά τις μετρήσεις σε βάση SQLite: πίνακας, INSERT και commit,
 * SELECT, στατιστικά με GROUP BY, καταγραφή από MQTT, και παράμετροι ? αντί για f-string.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 21, title: 'Αποθήκευση μετρήσεων με SQLite', ready: true, unlockAfter: 20, lang: 'python' });

  [
    { term: 'SQLite', def: 'Μια μικρή βάση δεδομένων που ζει σε ένα αρχείο, π.χ. home.db. Δεν χρειάζεται server. Στην Python τη φορτώνουμε με import sqlite3.' },
    { term: 'βάση δεδομένων', def: 'Οργανωμένη αποθήκη δεδομένων που μένει και μετά το τέλος του προγράμματος. Τα δεδομένα μπαίνουν σε πίνακες.' },
    { term: 'πίνακας (table)', def: 'Μέρος της βάσης με στήλες (π.χ. room, temp, ts) και γραμμές. Κάθε γραμμή είναι μία μέτρηση.' },
    { term: 'SQL', def: 'Η γλώσσα που «μιλά» η βάση. Π.χ. CREATE TABLE φτιάχνει πίνακα, INSERT προσθέτει γραμμή, SELECT διαβάζει.' },
    { term: 'cursor', def: 'Το αντικείμενο που στέλνει εντολές SQL και φέρνει αποτελέσματα: cur = conn.cursor(), μετά cur.execute(…).' },
    { term: 'commit', def: 'Η conn.commit() κάνει τις αλλαγές μόνιμες. Χωρίς commit, όταν τελειώσει το πρόγραμμα ή κλείσει η σύνδεση, οι αλλαγές χάνονται.' },
    { term: 'παράμετρος ? (placeholder)', def: 'Θέση μέσα στο SQL που τη γεμίζει η βάση με μια τιμή που δίνεις χωριστά: execute("… WHERE room = ?", (room,)). Η τιμή μένει πάντα τιμή. Δεν γίνεται ποτέ κομμάτι της εντολής.' },
    { term: 'tuple', def: 'Σταθερή λίστα τιμών σε παρενθέσεις: ("salon", 22.5). Οι γραμμές της βάσης έρχονται ως tuple. Tuple με μία τιμή θέλει κόμμα: ("salon",).' },
    { term: 'SELECT', def: 'Η εντολή SQL που διαβάζει. SELECT room, temp FROM readings WHERE room = ? ORDER BY ts DESC LIMIT 5.' },
    { term: 'fetchall / fetchone', def: 'cur.fetchall() φέρνει όλες τις γραμμές σε λίστα από tuple. cur.fetchone() φέρνει μία γραμμή, ή None αν δεν υπάρχει.' },
    { term: 'ORDER BY / LIMIT', def: 'ORDER BY ts ταξινομεί από το μικρό στο μεγάλο. Με DESC από το μεγάλο στο μικρό. LIMIT 3 κρατά μόνο τις 3 πρώτες γραμμές.' },
    { term: 'GROUP BY', def: 'Χωρίζει τις γραμμές σε ομάδες με ίδια τιμή, π.χ. ανά δωμάτιο. Οι AVG, MIN, MAX, COUNT υπολογίζονται τότε για κάθε ομάδα χωριστά.' },
    { term: 'συνάρτηση συνάθροισης', def: 'Συνάρτηση SQL που κάνει πολλές γραμμές έναν αριθμό: COUNT(*) πλήθος, AVG μέσος όρος, MIN, MAX, SUM. Η ROUND(x, 1) στρογγυλεύει σε 1 δεκαδικό.' },
    { term: 'SQL injection', def: 'Λάθος ασφάλειας: μια τιμή (π.χ. όνομα δωματίου) μπαίνει μέσα στο SQL με f-string, και ένα εισαγωγικό μέσα της αλλάζει την εντολή. Η προστασία: πάντα παράμετροι ?.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX = 'import sqlite3, sqlite3.connect, conn.cursor(), cur.execute(sql, (τιμές,)), conn.commit(), conn.close(), CREATE TABLE IF NOT EXISTS, INSERT INTO … VALUES (?, ?), SELECT … FROM … WHERE … ORDER BY … DESC LIMIT …, fetchall, fetchone, for row in cur, f-strings';
  const SQL_SYNTAX = SYNTAX + ', COUNT(*), AVG, MIN, MAX, ROUND(x, 1), GROUP BY, ξεπακετάρισμα tuple: room, n = row';
  const MQTT_SYNTAX = SYNTAX + ', paho.mqtt.client, on_connect, on_message, loop_forever, json.loads, json.dumps, try/except, dict.get, isinstance, time.time()';
  const PANELS = ['serial', 'vars', 'db'];
  const MQTT_PANELS = ['serial', 'vars', 'db', 'mqtt'];
  const OPEN_BROKER = 'listener 1883\nallow_anonymous true\n';
  const DASH = { name: 'dashboard', subs: ['home/#'] };

  // Κοινός πίνακας μετρήσεων και αρχικά δεδομένα (συνθετικά), με χρονοσφραγίδα ανά 10 λεπτά.
  const TABLE = 'CREATE TABLE readings (id INTEGER PRIMARY KEY, room TEXT NOT NULL, temp REAL, ts REAL)';
  const T0 = 1792036200;
  const seed = rows => [TABLE, 'INSERT INTO readings (room, temp, ts) VALUES ' + rows.map(([r, t], i) => `('${r}', ${t}, ${T0 + 600 * i})`).join(', ')];
  const HOME_ROWS = [['salon', 21.5], ['kitchen', 23.0], ['bedroom', 19.5], ['salon', 22.0], ['kitchen', 24.0], ['bedroom', 20.5], ['salon', 22.5], ['kitchen', 25.5]];
  const HOME_DB = { 'home.db': seed(HOME_ROWS) };

  // ------------------------------------------------------------ 21.1
  const L1_HEAD = `# Η πρώτη μέτρηση του σπιτιού, σε βάση SQLite.
import sqlite3

conn = sqlite3.connect("home.db")     # ανοίγει το αρχείο της βάσης (ή το φτιάχνει)
cur = conn.cursor()                   # με τον cursor στέλνουμε εντολές SQL

cur.execute("CREATE TABLE IF NOT EXISTS readings (id INTEGER PRIMARY KEY, room TEXT NOT NULL, temp REAL)")
cur.execute("INSERT INTO readings (room, temp) VALUES (?, ?)", ("salon", 22.5))
print("Inserted row", cur.lastrowid)

`;
  const L1_INITIAL = L1_HEAD + `# ΓΡΑΨΕ ΕΔΩ: κάνε τις αλλαγές μόνιμες (μία γραμμή)

conn.close()
print("Done")
`;
  const L1_SOLUTION = L1_HEAD + `conn.commit()                         # τώρα η μέτρηση μένει στη βάση

conn.close()
print("Done")
`;

  // ------------------------------------------------------------ 21.2
  const L2_HEAD = `# Τι έχει μέσα η βάση; Διαβάζουμε με SELECT.
import sqlite3

conn = sqlite3.connect("home.db")
cur = conn.cursor()

# 1. Όλες οι μετρήσεις
cur.execute("SELECT room, temp FROM readings")
`;
  const L2_INITIAL = L2_HEAD + `rows = cur.____()                     # ΣΥΜΠΛΗΡΩΣΕ: φέρε όλες τις γραμμές σε λίστα
print("All readings:", len(rows))

# 2. Μόνο το σαλόνι, με τη σειρά που μετρήθηκαν
cur.execute("SELECT temp FROM readings WHERE room = ? ORDER BY ts", ____)   # ΣΥΜΠΛΗΡΩΣΕ: tuple με μία τιμή, το "salon"
for row in cur:
    print(row)

# 3. Οι 3 πιο πρόσφατες μετρήσεις, η νεότερη πρώτη
# ΔΙΟΡΘΩΣΕ: τώρα βγαίνουν οι 3 πιο παλιές.
cur.execute("SELECT room, temp FROM readings ORDER BY ts LIMIT 3")
for room, temp in cur:
    print(f"{room}: {temp}")

conn.close()
`;
  const L2_SOLUTION = L2_HEAD + `rows = cur.fetchall()                 # λίστα από tuple
print("All readings:", len(rows))

# 2. Μόνο το σαλόνι, με τη σειρά που μετρήθηκαν
cur.execute("SELECT temp FROM readings WHERE room = ? ORDER BY ts", ("salon",))   # το κόμμα κάνει το tuple
for row in cur:
    print(row)

# 3. Οι 3 πιο πρόσφατες μετρήσεις, η νεότερη πρώτη
cur.execute("SELECT room, temp FROM readings ORDER BY ts DESC LIMIT 3")
for room, temp in cur:
    print(f"{room}: {temp}")

conn.close()
`;

  // ------------------------------------------------------------ 21.3
  const L3_HEAD = `# Στατιστικά από τη βάση: η SQL κάνει τους λογαριασμούς.
import sqlite3

conn = sqlite3.connect("home.db")
cur = conn.cursor()

# 1. Όλο το σπίτι (έτοιμο)
cur.execute("SELECT COUNT(*), ROUND(AVG(temp), 1), MIN(temp), MAX(temp) FROM readings")
n, avg, lo, hi = cur.fetchone()
print(f"All: n={n} avg={avg} min={lo} max={hi}")

# 2. Ανά δωμάτιο, με αλφαβητική σειρά
`;
  const L3_INITIAL = L3_HEAD + `# ΔΙΟΡΘΩΣΕ: τώρα βγαίνει μία γραμμή για όλο το σπίτι. Λείπει το GROUP BY room (πριν από το ORDER BY).
sql = "SELECT room, COUNT(*), ROUND(AVG(temp), 1), MIN(temp), MAX(temp) FROM readings ORDER BY room"
for room, n, avg, lo, hi in cur.execute(sql):
    print(f"{room}: n={n} avg={avg} min={lo} max={hi}")

# 3. Πόσες μετρήσεις είναι πάνω από 22 βαθμούς;
cur.execute("SELECT COUNT(*) FROM readings WHERE temp > ?", (____,))   # ΣΥΜΠΛΗΡΩΣΕ: το όριο
hot = cur.fetchone()[____]            # ΣΥΜΠΛΗΡΩΣΕ: η θέση του πρώτου στοιχείου
print("Above 22:", hot)

conn.close()
`;
  const L3_SOLUTION = L3_HEAD + `sql = "SELECT room, COUNT(*), ROUND(AVG(temp), 1), MIN(temp), MAX(temp) FROM readings GROUP BY room ORDER BY room"
for room, n, avg, lo, hi in cur.execute(sql):
    print(f"{room}: n={n} avg={avg} min={lo} max={hi}")

# 3. Πόσες μετρήσεις είναι πάνω από 22 βαθμούς;
cur.execute("SELECT COUNT(*) FROM readings WHERE temp > ?", (22,))
hot = cur.fetchone()[0]               # το fetchone δίνει tuple: (4,)
print("Above 22:", hot)

conn.close()
`;

  // ------------------------------------------------------------ 21.4
  const L4_HEAD = `# Ο hub γράφει κάθε σωστή μέτρηση στη βάση.
import json
import time
import sqlite3
import paho.mqtt.client as mqtt

conn = sqlite3.connect("home.db")
cur = conn.cursor()
cur.execute("CREATE TABLE IF NOT EXISTS readings (id INTEGER PRIMARY KEY, room TEXT NOT NULL, temp REAL, ts REAL)")
conn.commit()

def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/temperature")

def on_message(client, userdata, msg):
    text = msg.payload.decode()
`;
  const L4_TAIL = `
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
client.loop_forever()
`;
  const L4_INITIAL = L4_HEAD + `    print("Got", text)
    # ΓΡΑΨΕ ΕΔΩ:
    # 1. json.loads μέσα σε try/except. Αν αποτύχει: print("Ignored") και return.
    # 2. room = data.get("room") και t = data.get("t").
    # 3. Το room πρέπει να είναι str και το t αριθμός από -40 έως 85.
    #    Αλλιώς: print("Ignored") και return.
    # 4. INSERT με ? : (room, t, time.time()). Μετά commit.
    # 5. print(f"Stored {room} {t:.1f}")
` + L4_TAIL;
  const L4_SOLUTION = L4_HEAD + `    try:
        data = json.loads(text)
    except json.JSONDecodeError:              # κακό JSON, π.χ. {"t": nan}
        print("Ignored")
        return
    room = data.get("room")
    t = data.get("t")
    if not isinstance(room, str) or not isinstance(t, (int, float)) or not (-40 <= t <= 85):
        print("Ignored")
        return
    cur.execute("INSERT INTO readings (room, temp, ts) VALUES (?, ?, ?)", (room, t, time.time()))
    conn.commit()                             # κάθε μέτρηση μένει, ακόμα κι αν κοπεί το ρεύμα
    print(f"Stored {room} {t:.1f}")
` + L4_TAIL;
  const L4_WORLD = {
    broker: OPEN_BROKER,
    clients: [DASH, { name: 'esp32-temp', publish: [{ topic: 'home/temperature', payload: '{"room": "salon", "t": {temp}}', every: 5000, offset: 1000 }] }]
  };
  const DASH_TEMP = payload => ({ dash: { topic: 'home/temperature', payload } });

  // ------------------------------------------------------------ 21.5
  const L5_HEAD = `# Ο hub απαντά σε ερωτήσεις του dashboard: «τι γίνεται στο δωμάτιο Χ;»
# Το dashboard στέλνει όνομα δωματίου στο home/query.
# Ο hub απαντά στο home/query/result με πλήθος μετρήσεων και την τελευταία θερμοκρασία.
import json
import sqlite3
import paho.mqtt.client as mqtt

conn = sqlite3.connect("home.db")
cur = conn.cursor()

`;
  const L5_TAIL = `
def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/query")

def on_message(client, userdata, msg):
    room = msg.payload.decode()
    try:
        n = count_readings(room)
        t = last_temp(room)
    except sqlite3.Error as e:
        print("DB error:", e)
        return
    print(f"Query {room}: {n} readings, last {t}")
    client.publish("home/query/result", json.dumps({"room": room, "count": n, "last": t}))

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.connect("localhost", 1883)
client.loop_forever()
`;
  const L5_INITIAL = L5_HEAD + `def count_readings(room):
    cur.execute("SELECT COUNT(*) FROM readings WHERE room = ?", (room))
    return cur.fetchone()[0]

def last_temp(room):
    sql = f"SELECT temp FROM readings WHERE room = '{room}' ORDER BY ts DESC LIMIT 1"
    row = cur.execute(sql).fetchone()
    if row is None:
        return None
    return row[0]
` + L5_TAIL;
  const L5_SOLUTION = L5_HEAD + `def count_readings(room):
    cur.execute("SELECT COUNT(*) FROM readings WHERE room = ?", (room,))     # tuple με κόμμα
    return cur.fetchone()[0]

def last_temp(room):
    sql = "SELECT temp FROM readings WHERE room = ? ORDER BY ts DESC LIMIT 1"  # ? αντί για f-string
    row = cur.execute(sql, (room,)).fetchone()
    if row is None:
        return None
    return row[0]
` + L5_TAIL;
  const ASK = room => ({ dash: { topic: 'home/query', payload: room } });

  L.lessons.push(
    {
      id: 'c21-l1', chapter: 21, kind: 'micro', lang: 'python', skills: ['python', 'sensors'],
      title: 'Πρώτη μέτρηση στη βάση: χωρίς commit δεν μένει τίποτα',
      prerequisites: [],
      objectives: ['Να ανοίγω βάση SQLite και να φτιάχνω πίνακα.', 'Να προσθέτω μια μέτρηση με INSERT και παραμέτρους ?.', 'Να κάνω τις αλλαγές μόνιμες με commit().'],
      theory: `
<p>Ως τώρα ο hub <strong>ξεχνά</strong> κάθε μέτρηση μόλις την τυπώσει. Για ιστορικό χρειαζόμαστε μια <strong>βάση δεδομένων</strong>.</p>
<p>Το Raspberry Pi έχει έτοιμη τη <strong>SQLite</strong>: όλη η βάση είναι ένα αρχείο, εδώ το <code>home.db</code>.</p>
<pre>conn = sqlite3.connect("home.db")
cur = conn.cursor()</pre>
<p>Ο <strong>πίνακας</strong> <code>readings</code> έχει στήλες. Κάθε γραμμή είναι μία μέτρηση:</p>
<ul>
  <li><code>id INTEGER PRIMARY KEY</code>: αύξων αριθμός, μπαίνει μόνος του.</li>
  <li><code>room TEXT NOT NULL</code>: το δωμάτιο, υποχρεωτικό.</li>
  <li><code>temp REAL</code>: η θερμοκρασία, δεκαδικός.</li>
</ul>
<p>Το <code>INSERT</code> έχει <code>?</code> στις θέσεις των τιμών. Τις τιμές τις δίνουμε χωριστά, σε tuple: <code>("salon", 22.5)</code>.</p>
<p><strong>Η νέα ιδέα:</strong> το INSERT γράφει σε «πρόχειρο». Μόνο το <code>conn.commit()</code> το κάνει <strong>μόνιμο</strong>. Χωρίς commit, όταν κλείσει η σύνδεση, η μέτρηση χάνεται.</p>`,
      glossary: ['SQLite', 'βάση δεδομένων', 'πίνακας (table)', 'SQL', 'cursor', 'commit', 'παράμετρος ? (placeholder)'],
      supportedSyntax: SYNTAX,
      initialCode: L1_INITIAL,
      solution: L1_SOLUTION,
      world: {}, initialWorld: {},
      hardware: [], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε τον κώδικα. Τυπώνεται «Inserted row 1». Τι λέει η προειδοποίηση; Τι δείχνει το πάνελ της βάσης;',
        'Στη θέση του σχολίου γράψε την εντολή που κάνει τις αλλαγές μόνιμες.',
        'Τρέξε ξανά. Η γραμμή φαίνεται πια στη βάση;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το πρόγραμμα κάνει INSERT, τυπώνει «Inserted row 1» και μετά conn.close(), χωρίς commit. Τι έχει η βάση στο τέλος;',
        options: ['Καμία γραμμή: η αλλαγή χάθηκε', 'Μία γραμμή, αφού τυπώθηκε «Inserted row 1»', 'Μία γραμμή, αλλά χωρίς θερμοκρασία'],
        answer: 0,
        explain: 'Σωστά. Το INSERT έγινε μόνο «πρόχειρα». Το close() χωρίς commit πετά τις αλλαγές. Το «Inserted row 1» λέει μόνο ποιον αριθμό θα έπαιρνε η γραμμή.',
        retry: 'Όχι ακόμα. Ποια εντολή κάνει τις αλλαγές μόνιμες; Υπάρχει στον κώδικα;'
      },
      hints: [
        'Η εντολή που λείπει ανήκει στη σύνδεση (conn), όχι στον cursor.',
        'Γράψε την πριν από το conn.close(). Αν τη γράψεις μετά, η σύνδεση έχει ήδη κλείσει.',
        'conn.commit()\n\nΤο commit «σφραγίζει» ό,τι έγινε από το προηγούμενο commit και μετά.'
      ],
      validationTests: [
        { name: 'Η μέτρηση μένει στη βάση', script: [
          { setup: true },
          { check: 'serialHas', text: 'Inserted row 1', fail: 'Δεν τυπώθηκε «Inserted row 1». Βλέπω: {v}.' },
          { check: 'dbRows', table: 'readings', is: 1, fail: 'Στη βάση βλέπω: {v}. Περίμενα 1 γραμμή. Χωρίς conn.commit() πριν από το close() η μέτρηση χάνεται.' },
          { check: 'dbRows', table: 'readings', where: { room: 'salon', temp: 22.5 }, is: 1, fail: 'Δεν βρήκα με commit τη γραμμή room = salon, temp = 22.5 ({n} γραμμές).' }
        ] },
        { name: 'Ο πίνακας υπάρχει ήδη: τα παλιά δεδομένα μένουν', world: { db: { 'home.db': ['CREATE TABLE readings (id INTEGER PRIMARY KEY, room TEXT NOT NULL, temp REAL)', "INSERT INTO readings (room, temp) VALUES ('kitchen', 23.0)"] } }, script: [
          { setup: true },
          { check: 'dbRows', table: 'readings', is: 2, fail: 'Η βάση είχε ήδη 1 μέτρηση. Μετά το πρόγραμμα έχει {n} γραμμές με commit. Περίμενα 2.' },
          { check: 'dbRows', table: 'readings', where: { room: 'kitchen' }, is: 1, fail: 'Η παλιά μέτρηση της κουζίνας χάθηκε ({n} γραμμές kitchen).' },
          { check: 'serialHas', text: 'Inserted row 2', fail: 'Η νέα γραμμή έπρεπε να πάρει τον αριθμό 2. Βλέπω: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η μέτρηση μένει στο home.db και μετά το τέλος του προγράμματος. Το IF NOT EXISTS κράτησε τον παλιό πίνακα, οπότε η νέα γραμμή πήρε τον αριθμό 2. Θυμήσου: INSERT χωρίς commit είναι σαν κείμενο που δεν αποθήκευσες.',
      remediation: 'Αν το πάνελ της βάσης γράφει «χωρίς commit», πρόσθεσε conn.commit() πριν από το conn.close().'
    },

    {
      id: 'c21-l2', chapter: 21, kind: 'guided', lang: 'python', skills: ['python', 'sensors'],
      title: 'Διαβάζω τις μετρήσεις με SELECT',
      prerequisites: ['c21-l1'],
      objectives: ['Να διαβάζω γραμμές με SELECT και fetchall().', 'Να φιλτράρω με WHERE … = ? και tuple μίας τιμής.', 'Να παίρνω τις πιο πρόσφατες με ORDER BY … DESC LIMIT.'],
      theory: `
<p>Η βάση <code>home.db</code> έχει ήδη 8 μετρήσεις από τρία δωμάτια. Τώρα τις διαβάζουμε.</p>
<pre>cur.execute("SELECT room, temp FROM readings")
rows = cur.fetchall()      # λίστα από tuple</pre>
<p>Κάθε γραμμή είναι ένα <strong>tuple</strong>, π.χ. <code>('salon', 22.5)</code>. Το <code>row[0]</code> είναι η πρώτη στήλη.</p>
<p>Ο cursor διατρέχεται και κατευθείαν, χωρίς λίστα:</p>
<pre>for room, temp in cur:
    print(room, temp)</pre>
<ul>
  <li><code>WHERE room = ?</code>: μόνο ένα δωμάτιο. Η τιμή δίνεται χωριστά: <code>("salon",)</code>. Το <strong>κόμμα</strong> κάνει το tuple.</li>
  <li><code>ORDER BY ts</code>: ταξινόμηση με τη χρονοσφραγίδα, από την παλιότερη.</li>
  <li><code>DESC</code>: ανάποδα, η νεότερη πρώτη. <code>LIMIT 3</code>: μόνο 3 γραμμές.</li>
</ul>
<p>Η στήλη <code>temp</code> είναι REAL. Γι' αυτό το 23 επιστρέφει ως <code>23.0</code>.</p>`,
      glossary: ['SELECT', 'fetchall / fetchone', 'tuple', 'ORDER BY / LIMIT', 'παράμετρος ? (placeholder)'],
      supportedSyntax: SYNTAX,
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      world: { db: HOME_DB }, initialWorld: {},
      hardware: [], panels: PANELS,
      steps: [
        'Άνοιξε το πάνελ της βάσης. Πόσες γραμμές έχει ο πίνακας readings;',
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τη μέθοδο που φέρνει όλες τις γραμμές.',
        'Συμπλήρωσε το tuple με μία τιμή, το "salon".',
        'Διόρθωσε το τρίτο SELECT ώστε να βγαίνουν οι 3 νεότερες, η νεότερη πρώτη.',
        'Τρέξε και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι τυπώνει το print(row) για μια γραμμή του SELECT temp FROM readings;',
        options: ['(21.5,)', '21.5', "['21.5']"],
        answer: 0,
        explain: 'Σωστά. Κάθε γραμμή είναι tuple, ακόμα κι αν έχει μία στήλη. Η Python γράφει το tuple μίας τιμής με κόμμα: (21.5,). Για τον σκέτο αριθμό: row[0].',
        retry: 'Όχι ακόμα. Τι τύπος είναι κάθε γραμμή που φέρνει ο cursor;'
      },
      hints: [
        'Τρία σημεία: η μέθοδος που φέρνει «όλα», ένα tuple μίας τιμής, και η λέξη για «ανάποδη» σειρά.',
        'Η μέθοδος είναι η fetchall. Το tuple μίας τιμής θέλει κόμμα πριν την παρένθεση. Η ανάποδη σειρά είναι DESC, αμέσως μετά το ORDER BY ts.',
        'rows = cur.fetchall()\ncur.execute("… WHERE room = ? ORDER BY ts", ("salon",))\ncur.execute("SELECT room, temp FROM readings ORDER BY ts DESC LIMIT 3")'
      ],
      validationTests: [
        { name: 'Μετρήσεις του σπιτιού', script: [
          { setup: true },
          { check: 'lines', is: ['All readings: 8', '(21.5,)', '(22.0,)', '(22.5,)', 'kitchen: 25.5', 'salon: 22.5', 'bedroom: 20.5'], fail: 'Περίμενα: «All readings: 8», τις 3 μετρήσεις του salon ως tuple, και τις 3 νεότερες (kitchen 25.5 πρώτη). Βλέπω: {v}.' }
        ] },
        { name: 'Άλλη βάση: μόνο η κουζίνα', world: { db: { 'home.db': seed([['kitchen', 23], ['kitchen', 24]]) } }, script: [
          { setup: true },
          { check: 'lines', is: ['All readings: 2', 'kitchen: 24.0', 'kitchen: 23.0'], fail: 'Με βάση που έχει μόνο 2 μετρήσεις κουζίνας περίμενα: «All readings: 2», καμία γραμμή για το salon, και «kitchen: 24.0», «kitchen: 23.0». Βλέπω: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Διαβάζεις τη βάση με τρεις τρόπους: όλα μαζί (fetchall), ένα δωμάτιο (WHERE … = ?), και τα πιο πρόσφατα (ORDER BY … DESC LIMIT). Πρόσεξε ότι η δεύτερη βάση έδωσε 24.0, όχι 24: η στήλη REAL κρατά πάντα δεκαδικό.',
      remediation: 'Αν βλέπεις «Incorrect number of bindings supplied … 5 supplied», λείπει το κόμμα: ("salon",). Χωρίς κόμμα, το ("salon") είναι απλό κείμενο με 5 γράμματα.'
    },

    {
      id: 'c21-l3', chapter: 21, kind: 'guided', lang: 'python', skills: ['python', 'sensors', 'automation'],
      title: 'Στατιστικά ανά δωμάτιο με GROUP BY',
      prerequisites: ['c21-l2'],
      objectives: ['Να υπολογίζω COUNT, AVG, MIN, MAX μέσα στην SQL.', 'Να χωρίζω τα αποτελέσματα ανά δωμάτιο με GROUP BY.', 'Να στρογγυλεύω με ROUND(x, 1).'],
      theory: `
<p>Θέλουμε μια μικρή αναφορά: <strong>πόσες μετρήσεις, μέσος όρος, ελάχιστη, μέγιστη</strong>. Δεν χρειάζεται βρόχος με αθροίσματα. Τη δουλειά την κάνει η SQL.</p>
<ul>
  <li><code>COUNT(*)</code>: πλήθος γραμμών.</li>
  <li><code>AVG(temp)</code>, <code>MIN(temp)</code>, <code>MAX(temp)</code>: μέσος όρος, ελάχιστη, μέγιστη.</li>
  <li><code>ROUND(AVG(temp), 1)</code>: με 1 δεκαδικό. Επιστρέφει δεκαδικό, π.χ. <code>20.0</code>.</li>
</ul>
<p>Χωρίς τίποτα άλλο, αυτές οι συναρτήσεις δίνουν <strong>μία</strong> γραμμή για όλο τον πίνακα.</p>
<p>Με <code>GROUP BY room</code> οι γραμμές χωρίζονται σε <strong>ομάδες ανά δωμάτιο</strong>. Βγαίνει μία γραμμή για κάθε δωμάτιο.</p>
<pre>SELECT room, COUNT(*), ROUND(AVG(temp), 1)
FROM readings GROUP BY room ORDER BY room</pre>
<p>Σειρά λέξεων: <code>WHERE</code> → <code>GROUP BY</code> → <code>ORDER BY</code> → <code>LIMIT</code>.</p>
<p>Το <code>fetchone()</code> φέρνει tuple. Το ξεπακετάρουμε: <code>n, avg, lo, hi = cur.fetchone()</code>.</p>`,
      glossary: ['GROUP BY', 'συνάρτηση συνάθροισης', 'fetchall / fetchone', 'tuple'],
      supportedSyntax: SQL_SYNTAX,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: { db: HOME_DB }, initialWorld: {},
      hardware: [], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Στο δεύτερο SQL πρόσθεσε GROUP BY room πριν από το ORDER BY room.',
        'Στο τρίτο μέρος συμπλήρωσε το όριο (22) και τη θέση του πρώτου στοιχείου.',
        'Τρέξε. Συμφωνούν οι αριθμοί με το πάνελ της βάσης;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο πίνακας έχει 8 μετρήσεις από 3 δωμάτια. Πόσες γραμμές φέρνει το SELECT room, COUNT(*) FROM readings GROUP BY room;',
        options: ['3', '8', '1'],
        answer: 0,
        explain: 'Σωστά. Μία γραμμή για κάθε ομάδα, δηλαδή για κάθε δωμάτιο. Χωρίς GROUP BY θα ήταν 1 γραμμή για όλο τον πίνακα.',
        retry: 'Όχι ακόμα. Το GROUP BY room φτιάχνει μία ομάδα για κάθε διαφορετικό δωμάτιο.'
      },
      hints: [
        'Το GROUP BY λέει «μία γραμμή ανά δωμάτιο». Το fetchone() δίνει tuple, ακόμα κι αν έχει μία τιμή.',
        'Γράψε GROUP BY room ανάμεσα στο FROM readings και στο ORDER BY room. Το όριο είναι 22. Η πρώτη θέση σε tuple είναι το 0.',
        '"… FROM readings GROUP BY room ORDER BY room"\ncur.execute("SELECT COUNT(*) FROM readings WHERE temp > ?", (22,))\nhot = cur.fetchone()[0]'
      ],
      validationTests: [
        { name: 'Αναφορά του σπιτιού', script: [
          { setup: true },
          { check: 'lines', is: ['All: n=8 avg=22.3 min=19.5 max=25.5', 'bedroom: n=2 avg=20.0 min=19.5 max=20.5', 'kitchen: n=3 avg=24.2 min=23.0 max=25.5', 'salon: n=3 avg=22.0 min=21.5 max=22.5', 'Above 22: 4'], fail: 'Περίμενα μία γραμμή για όλο το σπίτι, μία για κάθε δωμάτιο (bedroom, kitchen, salon) και «Above 22: 4». Βλέπω: {v}.' }
        ] },
        { name: 'Άλλη βάση: σοφίτα και σαλόνι', world: { db: { 'home.db': seed([['salon', 20], ['attic', 30.5], ['salon', 21]]) } }, script: [
          { setup: true },
          { check: 'lines', is: ['All: n=3 avg=23.8 min=20.0 max=30.5', 'attic: n=1 avg=30.5 min=30.5 max=30.5', 'salon: n=2 avg=20.5 min=20.0 max=21.0', 'Above 22: 1'], fail: 'Με άλλη βάση (salon 20, 21 και attic 30.5) τα αποτελέσματα δεν ταιριάζουν. Βλέπω: {v}.' }
        ] }
      ],
      explanationOnSuccess: 'Η SQL έκανε όλους τους λογαριασμούς. Ένα GROUP BY έδωσε αναφορά για κάθε δωμάτιο, όσα δωμάτια κι αν υπάρχουν. Ο κώδικας Python μόνο τυπώνει.',
      remediation: 'Αν βλέπεις μόνο μία γραμμή για τα δωμάτια, λείπει το GROUP BY room. Αν βλέπεις «near "GROUP": syntax error», το GROUP BY πρέπει να μπει πριν από το ORDER BY.'
    },

    {
      id: 'c21-l4', chapter: 21, kind: 'independent', lang: 'python', skills: ['python', 'automation', 'sensors', 'security'],
      title: 'Ο hub γράφει τις μετρήσεις MQTT στη βάση',
      prerequisites: ['c21-l3'],
      objectives: ['Να αποθηκεύω κάθε μέτρηση MQTT σε SQLite μέσα στο on_message.', 'Να αποθηκεύω μόνο ελεγμένες τιμές.', 'Να γράφω χρονοσφραγίδα με time.time().'],
      theory: `
<p>Τώρα ενώνουμε τα δύο: το <code>esp32-temp</code> στέλνει κάθε 5 δευτερόλεπτα στο <code>home/temperature</code>:</p>
<pre>{"room": "salon", "t": 22.5}</pre>
<p>Ο hub γράφει κάθε σωστή μέτρηση στον πίνακα <code>readings</code>. Η δουλειά σου είναι να γράψεις το <code>on_message</code> <strong>μόνος σου</strong>.</p>
<ol>
  <li><strong>Έλεγχος εισόδου</strong>, όπως στο Κεφάλαιο 20: έγκυρο JSON, <code>room</code> κείμενο, <code>t</code> αριθμός από −40 έως 85.</li>
  <li>Αν κάτι δεν ταιριάζει: <code>print("Ignored")</code>. <strong>Δεν</strong> γράφεται τίποτα στη βάση.</li>
  <li><code>INSERT</code> με τρία <code>?</code>: <code>(room, t, time.time())</code>.</li>
  <li><code>conn.commit()</code> μετά από κάθε μέτρηση.</li>
</ol>
<ul>
  <li>Το <code>time.time()</code> δίνει την ώρα σε δευτερόλεπτα. Έτσι ξέρουμε πότε μετρήθηκε κάθε τιμή.</li>
  <li>Γιατί έλεγχος; Μια χαλασμένη τιμή στη βάση χαλάει κάθε μέσο όρο αργότερα.</li>
  <li>Και κάτι ακόμα: μήνυμα χωρίς <code>room</code> θα έδινε <code>IntegrityError</code> (η στήλη είναι <code>NOT NULL</code>).</li>
</ul>`,
      glossary: ['commit', 'παράμετρος ? (placeholder)', 'έλεγχος εισόδου (validation)', 'hub', 'try / except'],
      supportedSyntax: MQTT_SYNTAX,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: L4_WORLD, initialWorld: { temp: 22.5 },
      hardware: ['sensor', 'broker'], panels: MQTT_PANELS,
      steps: [
        'Τρέξε. Τι τυπώνει ο hub; Τι έχει η βάση;',
        'Γράψε τον έλεγχο εισόδου με try/except, .get() και isinstance.',
        'Γράψε το INSERT με τρία ? και το commit.',
        'Τρέξε. Άναψε το «Σφάλμα αισθητήρα»: γράφεται κάτι στη βάση; Στείλε από το dashboard {"room": "kitchen", "t": 150}.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο αισθητήρας στέλνει {"room": "salon", "t": nan}. Τι πρέπει να γίνει;',
        options: ['Τίποτα στη βάση: «Ignored», και ο hub συνεχίζει', 'Γραμμή με temp = NULL', 'Ο hub σταματά για να το δει κάποιος'],
        answer: 0,
        explain: 'Σωστά. Το nan δεν είναι έγκυρο JSON, άρα το πιάνει ο έλεγχος. Η βάση κρατά μόνο αξιόπιστες μετρήσεις, και ο hub περιμένει την επόμενη.',
        retry: 'Όχι ακόμα. Σκέψου τι θα έκανε μια χαλασμένη τιμή στον μέσο όρο αύριο.'
      },
      hints: [
        'Πρώτα έλεγχος, μετά INSERT, μετά commit. Κάθε αποτυχία ελέγχου: print("Ignored") και return.',
        'Πάρε τον έλεγχο από το Κεφάλαιο 20 και πρόσθεσε isinstance(room, str). Το INSERT: "INSERT INTO readings (room, temp, ts) VALUES (?, ?, ?)" με (room, t, time.time()).',
        'try:\n    data = json.loads(text)\nexcept json.JSONDecodeError:\n    print("Ignored")\n    return\nroom = data.get("room")\nt = data.get("t")\nif not isinstance(room, str) or not isinstance(t, (int, float)) or not (-40 <= t <= 85):\n    print("Ignored")\n    return\ncur.execute("INSERT INTO readings (room, temp, ts) VALUES (?, ?, ?)", (room, t, time.time()))\nconn.commit()\nprint(f"Stored {room} {t:.1f}")'
      ],
      validationTests: [
        { name: 'Κανονικές μετρήσεις αποθηκεύονται με ώρα', world: { temp: 22.5 }, script: [
          { setup: true }, { ms: 12000 },
          { check: 'dbRows', table: 'readings', where: { room: 'salon', temp: 22.5 }, min: 2, fail: 'Σε 12 δευτερόλεπτα ήρθαν 3 μετρήσεις. Στη βάση (με commit) βρήκα {n} γραμμές salon 22.5.', failZero: 'Καμία μέτρηση στη βάση με commit. Γράφεις INSERT και conn.commit() μέσα στο on_message;' },
          { check: 'dbRows', table: 'readings', where: { ts: null }, is: 0, fail: 'Βρήκα {n} γραμμές χωρίς χρονοσφραγίδα. Δώσε time.time() στη στήλη ts.' },
          { check: 'serialHas', text: 'Stored salon 22.5', fail: 'Δεν τυπώθηκε «Stored salon 22.5». Βλέπω: {v}.' }
        ] },
        { name: 'Αισθητήρας με βλάβη: τίποτα στη βάση, ο hub συνεχίζει', world: { temp: 22.5, sensorFault: true }, script: [
          { setup: true }, { ms: 12000 },
          { check: 'dbRows', table: 'readings', is: 0, fail: 'Με τον αισθητήρα σε βλάβη ({"t": nan}) γράφτηκαν {n} γραμμές. Περίμενα 0.' },
          { check: 'mqttConnected', is: true, fail: 'Με τον αισθητήρα σε βλάβη ο hub σταμάτησε. {v}' },
          { set: { sensorFault: false } }, { ms: 6000 },
          { check: 'dbRows', table: 'readings', min: 1, fail: 'Όταν ο αισθητήρας διορθώθηκε, δεν γράφτηκε καμία μέτρηση ({n}).' }
        ] },
        { name: 'Κακά μηνύματα δεν μπαίνουν στη βάση', script: [
          { setup: true }, { ms: 300 },
          DASH_TEMP('hello'), { ms: 50 },
          DASH_TEMP('{"t": 21}'), { ms: 50 },
          DASH_TEMP('{"room": "kitchen", "t": "hot"}'), { ms: 50 },
          DASH_TEMP('{"room": "kitchen", "t": 150}'), { ms: 50 },
          DASH_TEMP('{"room": 7, "t": 21}'), { ms: 50 },
          DASH_TEMP('{"room": "kitchen", "t": 21.5}'), { ms: 50 },
          { check: 'mqttConnected', is: true, fail: 'Μετά τα κακά μηνύματα ο hub δεν είναι συνδεδεμένος. {v}' },
          { check: 'dbRows', table: 'readings', is: 1, fail: 'Από 6 μηνύματα μόνο 1 ήταν σωστό ({"room": "kitchen", "t": 21.5}). Στη βάση βρήκα {n} γραμμές.' },
          { check: 'dbRows', table: 'readings', where: { room: 'kitchen', temp: 21.5 }, is: 1, fail: 'Η σωστή μέτρηση kitchen 21.5 δεν βρέθηκε στη βάση ({n}).' },
          { check: 'count', text: 'Ignored', is: 5, fail: 'Περίμενα 5 φορές «Ignored» για τα 5 κακά μηνύματα. Βρήκα {n}.' }
        ] }
      ],
      explanationOnSuccess: 'Ο hub κρατά πια ιστορικό: κάθε σωστή μέτρηση με δωμάτιο και ώρα. Οι κακές τιμές μένουν έξω, άρα τα στατιστικά του 21.3 θα είναι αξιόπιστα. Το commit μετά από κάθε INSERT σημαίνει ότι, αν κοπεί το ρεύμα, χάνεται το πολύ μία μέτρηση.',
      remediation: 'Αν βλέπεις «IntegrityError: NOT NULL constraint failed: readings.room», ήρθε μήνυμα χωρίς room. Έλεγξε isinstance(room, str) πριν από το INSERT.'
    },

    {
      id: 'c21-l5', chapter: 21, kind: 'checkpoint', lang: 'python', skills: ['python', 'security', 'automation'],
      title: 'Ασφαλή ερωτήματα: παράμετροι ? αντί για f-string',
      prerequisites: ['c21-l4'],
      objectives: ['Να αναγνωρίζω SQL φτιαγμένο με f-string ως κίνδυνο.', 'Να ξαναγράφω ερωτήματα με παραμέτρους ?.', 'Να διορθώνω το λάθος (room) αντί για (room,).'],
      theory: `
<p>Το dashboard ρωτά τον hub: στέλνει ένα όνομα δωματίου στο <code>home/query</code>. Ο hub απαντά με πλήθος μετρήσεων και την τελευταία θερμοκρασία.</p>
<p>Το όνομα έρχεται <strong>από το δίκτυο</strong>. Ο hub δεν ξέρει τι θα περιέχει. Ο κώδικας εδώ έχει δύο λάθη.</p>
<p><strong>1. SQL με f-string.</strong></p>
<pre>f"… WHERE room = '{room}'"</pre>
<p>Αν το όνομα έχει εισαγωγικό, γίνεται <strong>κομμάτι της εντολής</strong>:</p>
<ul>
  <li><code>kid's room</code> → το SQL σπάει: <code>OperationalError</code>.</li>
  <li><code>x' OR '1'='1</code> → το WHERE γίνεται «πάντα αληθές» και φέρνει μετρήσεις <strong>άλλου</strong> δωματίου.</li>
</ul>
<p>Αυτό λέγεται <strong>SQL injection</strong>. Η προστασία είναι μία: <strong>παράμετροι <code>?</code></strong>. Με <code>?</code> η τιμή μένει πάντα τιμή, ό,τι κι αν περιέχει.</p>
<p><strong>2. Το κόμμα που λείπει.</strong> Το <code>(room)</code> είναι απλό κείμενο, όχι tuple. Η sqlite3 το διαβάζει γράμμα-γράμμα:</p>
<pre>Incorrect number of bindings supplied. The current statement uses 1, and there are 5 supplied.</pre>
<p>Σωστά: <code>(room,)</code>.</p>
<p>Διόρθωσε τον <strong>δικό σου</strong> hub ώστε κάθε όνομα να είναι ασφαλές.</p>`,
      glossary: ['SQL injection', 'παράμετρος ? (placeholder)', 'tuple', 'έλεγχος εισόδου (validation)'],
      supportedSyntax: MQTT_SYNTAX + ', except sqlite3.Error as e',
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: { broker: OPEN_BROKER, clients: [DASH], db: HOME_DB }, initialWorld: {},
      hardware: ['broker'], panels: MQTT_PANELS,
      steps: [
        'Τρέξε. Στείλε από το dashboard στο home/query: salon. Τι τυπώνει ο hub;',
        'Διόρθωσε το count_readings. Δοκίμασε ξανά με salon.',
        "Στείλε kid's room και μετά x' OR '1'='1. Τι απαντά ο hub; Ποιο δωμάτιο έχει 25.5;",
        'Ξαναγράψε το last_temp με ? αντί για f-string.',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: "Ποιος είναι ο σωστός τρόπος για να ψάξεις ένα όνομα που ήρθε από το δίκτυο;",
        options: ['cur.execute("… WHERE room = ?", (room,))', 'cur.execute(f"… WHERE room = \'{room}\'")', 'cur.execute(f"… WHERE room = \'{room.replace(\'OR\', \'\')}\'")'],
        answer: 0,
        explain: 'Σωστά. Με ? η βάση παίρνει την τιμή χωριστά από την εντολή. Τα «φίλτρα» σε f-string ξεχνούν πάντα κάποια περίπτωση: εδώ το εισαγωγικό θα έσπαγε ακόμα το SQL.',
        retry: 'Όχι ακόμα. Ποιος τρόπος κρατά την τιμή εντελώς έξω από το κείμενο της εντολής;'
      },
      hints: [
        'Δύο λάθη: ένα κόμμα που λείπει, και ένα SQL που φτιάχνεται με f-string.',
        'Στο count_readings γράψε (room,). Στο last_temp βγάλε το f και τα \'{room}\', βάλε ? και δώσε (room,) στο execute.',
        'cur.execute("SELECT COUNT(*) FROM readings WHERE room = ?", (room,))\n\nsql = "SELECT temp FROM readings WHERE room = ? ORDER BY ts DESC LIMIT 1"\nrow = cur.execute(sql, (room,)).fetchone()'
      ],
      validationTests: [
        { name: 'Κανονική ερώτηση: salon', script: [
          { setup: true }, { ms: 300 }, ASK('salon'), { ms: 200 },
          { check: 'serialNot', text: 'DB error', fail: 'Ο hub τύπωσε «DB error» για το salon. Κοίτα το count_readings: (room) ή (room,);' },
          { check: 'published', topic: 'home/query/result', json: { room: 'salon', count: 3, last: 22.5 }, is: 1, fail: 'Για το salon περίμενα {"room": "salon", "count": 3, "last": 22.5}. Ο hub έστειλε: {v}.' }
        ] },
        { name: 'Δωμάτιο χωρίς μετρήσεις: garage', script: [
          { setup: true }, { ms: 300 }, ASK('garage'), { ms: 200 },
          { check: 'published', topic: 'home/query/result', json: { room: 'garage', count: 0, last: null }, is: 1, fail: 'Για το garage περίμενα {"count": 0, "last": null}. Ο hub έστειλε: {v}.' }
        ] },
        { name: 'Όνομα με εισαγωγικό: κανένα σφάλμα', script: [
          { setup: true }, { ms: 300 }, ASK("kid's room"), { ms: 200 },
          { check: 'serialNot', text: 'DB error', fail: "Το όνομα «kid's room» έσπασε το SQL (DB error). Με παράμετρο ? το εισαγωγικό είναι απλό γράμμα." },
          { check: 'published', topic: 'home/query/result', json: { room: "kid's room", count: 0, last: null }, is: 1, fail: "Για το «kid's room» περίμενα {\"count\": 0, \"last\": null}. Ο hub έστειλε: {v}." },
          { check: 'mqttConnected', is: true, fail: 'Ο hub αποσυνδέθηκε. {v}' }
        ] },
        { name: "Όνομα που αλλάζει το WHERE: x' OR '1'='1", script: [
          { setup: true }, { ms: 300 }, ASK("x' OR '1'='1"), { ms: 200 },
          { check: 'serialNot', text: 'DB error', fail: 'Ο hub τύπωσε «DB error». Διόρθωσε πρώτα το count_readings.' },
          { check: 'published', topic: 'home/query/result', json: { count: 0, last: null }, is: 1, fail: 'Δεν υπάρχει δωμάτιο με αυτό το όνομα, άρα περίμενα {"count": 0, "last": null}. Ο hub έστειλε: {v}. Αν βλέπεις «last»: 25.5, το f-string άλλαξε το WHERE και ήρθε μέτρηση από την κουζίνα.' },
          { check: 'dbRows', table: 'readings', is: 8, fail: 'Ο πίνακας readings έπρεπε να μείνει με 8 γραμμές. Βρήκα {n}.' }
        ] }
      ],
      explanationOnSuccess: 'Ο hub σου απαντά σωστά για κάθε όνομα, όσο περίεργο κι αν είναι. Ο κανόνας είναι απλός: τιμές που έρχονται απ\' έξω (MQTT, φόρμα, αρχείο) δεν μπαίνουν ποτέ μέσα στο SQL με f-string. Πάντα ? και tuple με κόμμα.',
      remediation: 'Αν βλέπεις «Incorrect number of bindings supplied», λείπει το κόμμα στο (room,). Αν βλέπεις «unrecognized token» ή «syntax error», κάποιο SQL φτιάχνεται ακόμα με f-string.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
