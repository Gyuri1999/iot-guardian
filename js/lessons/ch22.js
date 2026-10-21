/*
 * IoT Guardian — Κεφάλαιο 22 (Μέρος Β): Web dashboard με Flask.
 * Ο μικρός web server του Raspberry Pi: πρώτη σελίδα, JSON API από τη βάση,
 * ασφαλής εμφάνιση εισόδου (escape), προστατευμένο endpoint ελέγχου και τελικός έλεγχος.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 22, title: 'Web dashboard με Flask', ready: true, unlockAfter: 21, lang: 'python' });

  [
    { term: 'Flask', def: 'Μικρή βιβλιοθήκη Python για web servers. Γράφεις συναρτήσεις και λες σε ποια διεύθυνση (route) απαντά η καθεμία.' },
    { term: 'route', def: 'Μια διεύθυνση του server, π.χ. "/" ή "/api/temp/salon". Το @app.route("/…") πάνω από ένα def λέει «αυτή η συνάρτηση απαντά εδώ».' },
    { term: 'app.run', def: 'Ξεκινά τον web server: app.run(host="0.0.0.0", port=5000). Από εκεί και πέρα το πρόγραμμα περιμένει αιτήματα για πάντα.' },
    { term: 'host 0.0.0.0', def: 'Ο server ακούει σε όλες τις κάρτες δικτύου του Pi, άρα και το tablet του σπιτιού τον βρίσκει. Η προεπιλογή 127.0.0.1 σημαίνει «μόνο από το ίδιο το Pi».' },
    { term: 'HTTP status', def: 'Ο αριθμός που συνοδεύει κάθε απάντηση: 200 OK, 400 κακό αίτημα, 401 χωρίς σωστό κλειδί, 404 δεν βρέθηκε, 405 λάθος μέθοδος, 500 σφάλμα στον server.' },
    { term: 'API (JSON)', def: 'Διευθύνσεις του server που δεν δίνουν σελίδα για ανθρώπους αλλά δεδομένα JSON για προγράμματα, π.χ. {"room":"salon","temp":22.6}.' },
    { term: 'jsonify', def: 'Η jsonify(…) του Flask φτιάχνει απάντηση JSON. Ένα λεξικό στο return κάνει το ίδιο. Για άλλο status: return jsonify({…}), 404.' },
    { term: 'escape', def: 'Η escape(…) από το markupsafe μετατρέπει τα < > & " \' σε ασφαλή κείμενο (&lt; &gt; …). Έτσι ό,τι γράψει ο χρήστης φαίνεται ως κείμενο και δεν γίνεται HTML.' },
    { term: 'XSS', def: 'Cross-Site Scripting: όταν μια σελίδα βάζει κείμενο του χρήστη μέσα στο HTML χωρίς escape, ο browser μπορεί να το διαβάσει ως κώδικα. Η άμυνα: escape σε κάθε έξοδο.' },
    { term: 'API key', def: 'Ένα μυστικό κλειδί που στέλνει ο client σε κάθε αίτημα, π.χ. στην κεφαλίδα X-API-Key. Ο server εκτελεί την εντολή μόνο αν το κλειδί είναι σωστό.' },
    { term: 'κεφαλίδα (header)', def: 'Επιπλέον πληροφορία σε ένα αίτημα HTTP, έξω από το σώμα, π.χ. X-API-Key: … ή Content-Type: application/json.' },
    { term: 'abort', def: 'Η abort(401) σταματά αμέσως τη συνάρτηση του route και στέλνει την αντίστοιχη σελίδα σφάλματος.' },
    { term: 'debug mode', def: 'Το app.run(debug=True) ανοίγει τον debugger του Werkzeug: από τη σελίδα σφάλματος μπορεί να τρέξει κώδικας στο Pi. Μόνο για δοκιμές στον δικό σου υπολογιστή, ποτέ σε dashboard του σπιτιού.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX = 'from flask import Flask, jsonify, request, abort · app = Flask(__name__) · @app.route("/…") · return "<html>" ή {…} ή (σώμα, status) · app.run(host=…, port=…, debug=…)';
  const PANELS = ['web', 'serial', 'vars'];
  const PANELS_DB = ['web', 'serial', 'vars', 'db'];
  const OPEN_BROKER = 'listener 1883\nallow_anonymous true\n';
  const DASH = { name: 'dashboard', subs: ['home/#'] };
  const API_KEY = 'Led-Lab-Key-3141';   // φανταστικό κλειδί της άσκησης
  const HOME_DB = {
    'home.db': [
      'CREATE TABLE readings (id INTEGER PRIMARY KEY, room TEXT NOT NULL, temp REAL, ts REAL)',
      "INSERT INTO readings (room, temp, ts) VALUES ('salon', 21.8, 1000), ('kitchen', 24.1, 1500), ('salon', 22.6, 2000)"
    ]
  };
  const GET = (path, from) => ({ request: from ? { method: 'GET', path, from } : { method: 'GET', path } });

  // ------------------------------------------------------------ 22.1
  const L1_HEAD = `# Η πρώτη σελίδα του Pi.
from flask import Flask

app = Flask(__name__)

@app.route("/")
def index():
    return "<h1>Smart Home</h1><p>Το Pi είναι online.</p>"

`;
  const L1_INITIAL = L1_HEAD + `app.run(port=5000)
`;
  const L1_SOLUTION = L1_HEAD + `app.run(host="0.0.0.0", port=5000)   # όλο το δίκτυο του σπιτιού
`;

  // ------------------------------------------------------------ 22.2
  const L2_HEAD = `# API: η τελευταία θερμοκρασία κάθε δωματίου, από τη βάση.
import sqlite3
from flask import Flask, jsonify

app = Flask(__name__)

def latest(room):
    # Δίνει (temp, ts) της πιο πρόσφατης μέτρησης, ή None.
    conn = sqlite3.connect("home.db")
    cur = conn.cursor()
`;
  const L2_TAIL = `
app.run(host="0.0.0.0", port=5000)
`;
  const L2_INITIAL = L2_HEAD + `    cur.execute("SELECT temp, ts FROM readings WHERE room = ? ORDER BY ts ____ LIMIT 1",   # ΣΥΜΠΛΗΡΩΣΕ: η νεότερη πρώτη
                ____)                                                                     # ΣΥΜΠΛΗΡΩΣΕ: tuple με το room
    row = cur.fetchone()
    conn.close()
    return row

@app.route("/api/temp/<room>")
def temp(room):
    row = latest(room)
    if row is None:
        return jsonify({"error": "unknown room"}), ____     # ΣΥΜΠΛΗΡΩΣΕ: το status «δεν βρέθηκε»
    return {"room": room, "temp": row[0]}
` + L2_TAIL;
  const L2_SOLUTION = L2_HEAD + `    cur.execute("SELECT temp, ts FROM readings WHERE room = ? ORDER BY ts DESC LIMIT 1",
                (room,))                    # παράμετρος με ?, ποτέ f-string
    row = cur.fetchone()
    conn.close()
    return row

@app.route("/api/temp/<room>")
def temp(room):
    row = latest(room)
    if row is None:
        return jsonify({"error": "unknown room"}), 404
    return {"room": room, "temp": row[0]}
` + L2_TAIL;

  // ------------------------------------------------------------ 22.3
  const L3_HEAD = `# Αναζήτηση δωματίου στο dashboard.
from flask import Flask, request
from markupsafe import escape

app = Flask(__name__)
ROOMS = ["salon", "kitchen", "bedroom"]

@app.route("/search")
def search():
    q = request.args.get("q", "")
    found = [r for r in ROOMS if q.lower() in r]
`;
  const L3_TAIL = `    items = "".join([f"<li>{r}</li>" for r in found])
    return f"<h2>Αναζήτηση: {shown}</h2><ul>{items}</ul>"

app.run(host="0.0.0.0", port=5000)
`;
  const L3_INITIAL = L3_HEAD + `    shown = q                      # ΑΛΛΑΞΕ: το q μπαίνει αυτούσιο μέσα στο HTML
` + L3_TAIL;
  const L3_SOLUTION = L3_HEAD + `    shown = escape(q)              # < > & " ' γίνονται ασφαλές κείμενο
` + L3_TAIL;

  // ------------------------------------------------------------ 22.4
  const L4_HEAD = `# Το tablet ανάβει και σβήνει τη λάμπα μέσα από το dashboard.
import json
import paho.mqtt.client as mqtt
from flask import Flask, jsonify, request, abort
`;
  const L4_BODY = `
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-web")
client.connect("localhost", 1883)
client.loop_start()                 # το MQTT δουλεύει στο παρασκήνιο

app = Flask(__name__)

@app.route("/api/led", methods=["POST"])
def led():
`;
  const L4_REST = `    data = request.get_json(silent=True)
    if data is None or data.get("cmd") not in ["ON", "OFF"]:
        abort(400)
    client.publish("home/led/set", json.dumps({"cmd": data["cmd"]}))
    return jsonify(ok=True, cmd=data["cmd"])

`;
  const L4_INITIAL = L4_HEAD + `
API_KEY = "${API_KEY}"
` + L4_BODY + `    # ΓΡΑΨΕ ΕΔΩ: χωρίς σωστό X-API-Key → abort(401)
` + L4_REST + `app.run(host="0.0.0.0", port=5000, debug=True)
`;
  const L4_SOLUTION = L4_HEAD + `from config import API_KEY           # το κλειδί μένει έξω από τον κώδικα
` + L4_BODY + `    if request.headers.get("X-API-Key") != API_KEY:
        abort(401)                  # λάθος ή καθόλου κλειδί: τίποτα δεν γίνεται
` + L4_REST + `app.run(host="0.0.0.0", port=5000, debug=False)
`;

  const LED = (headers, json, from) => ({ request: Object.assign({ method: 'POST', path: '/api/led' }, headers ? { headers } : {}, json !== undefined ? { json } : {}, from ? { from } : {}) });

  // ------------------------------------------------------------ 22.5
  const L5_TOP = `# Το dashboard του σπιτιού. Κάτι δεν πάει καλά...
import json
import sqlite3
import paho.mqtt.client as mqtt
from flask import Flask, jsonify, request, abort
from markupsafe import escape
from config import API_KEY

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-web")
client.connect("localhost", 1883)
client.loop_start()

app = Flask(__name__)

def query(sql, params=()):
    conn = sqlite3.connect("home.db")
    rows = conn.cursor().execute(sql, params).fetchall()
    conn.close()
    return rows

`;
  const L5_INITIAL = L5_TOP + `@app.route("/")
def index():
    name = request.args.get("name", "φίλε")
    return f"<h1>Καλώς ήρθες, {name}</h1><p><a href='/api/rooms'>Δωμάτια</a></p>"

@app.route("/api/rooms")
def rooms():
    names = [r[0] for r in query("SELECT room FROM readings GROUP BY room ORDER BY room")]
    result = {"rooms": names, "count": len(names)}

@app.route("/api/temp/<room>")
def temp(room):
    rows = query("SELECT temp FROM readings WHERE room = ? ORDER BY ts DESC LIMIT 1", (room,))
    return {"room": room, "temp": rows[0][0]}

@app.route("/api/led", methods=["POST"])
def led():
    data = request.get_json(silent=True)
    if data is None or data.get("cmd") not in ["ON", "OFF"]:
        abort(400)
    client.publish("home/led/set", json.dumps({"cmd": data["cmd"]}))
    return jsonify(ok=True, cmd=data["cmd"])

app.run(port=5000, debug=True)
`;
  const L5_SOLUTION = L5_TOP + `@app.route("/")
def index():
    name = request.args.get("name", "φίλε")
    return f"<h1>Καλώς ήρθες, {escape(name)}</h1><p><a href='/api/rooms'>Δωμάτια</a></p>"

@app.route("/api/rooms")
def rooms():
    names = [r[0] for r in query("SELECT room FROM readings GROUP BY room ORDER BY room")]
    return {"rooms": names, "count": len(names)}

@app.route("/api/temp/<room>")
def temp(room):
    rows = query("SELECT temp FROM readings WHERE room = ? ORDER BY ts DESC LIMIT 1", (room,))
    if not rows:
        return jsonify({"error": "unknown room"}), 404
    return {"room": room, "temp": rows[0][0]}

@app.route("/api/led", methods=["POST"])
def led():
    if request.headers.get("X-API-Key") != API_KEY:
        abort(401)
    data = request.get_json(silent=True)
    if data is None or data.get("cmd") not in ["ON", "OFF"]:
        abort(400)
    client.publish("home/led/set", json.dumps({"cmd": data["cmd"]}))
    return jsonify(ok=True, cmd=data["cmd"])

app.run(host="0.0.0.0", port=5000, debug=False)
`;

  const LED_WORLD = { broker: OPEN_BROKER, clients: [DASH], consts: { API_KEY } };

  L.lessons.push(
    {
      id: 'c22-l1', chapter: 22, kind: 'micro', lang: 'python', skills: ['python', 'network'],
      title: 'Η πρώτη σελίδα: ποιος τη βλέπει;',
      prerequisites: [],
      objectives: ['Να γράφω ένα route που επιστρέφει HTML.', 'Να ξεκινώ τον server με app.run.', 'Να ξεχωρίζω το host 127.0.0.1 από το 0.0.0.0.'],
      theory: `
<p>Ο hub μαζεύει δεδομένα. Τώρα θέλουμε να τα βλέπουμε από το <strong>tablet</strong> του σπιτιού. Το Pi γίνεται <strong>web server</strong> με το Flask.</p>
<pre>@app.route("/")
def index():
    return "&lt;h1&gt;Smart Home&lt;/h1&gt;"</pre>
<ul>
  <li>Το <code>@app.route("/")</code> λέει: «αυτή η συνάρτηση απαντά στη διεύθυνση <code>/</code>».</li>
  <li>Ό,τι κάνει <code>return</code> είναι η σελίδα. Ένα κείμενο γίνεται HTML.</li>
</ul>
<p>Το <code>app.run(…)</code> ξεκινά τον server. Από εκεί και πέρα το πρόγραμμα <strong>περιμένει αιτήματα για πάντα</strong>, όπως το <code>loop_forever()</code>.</p>
<p>Το σημαντικό: <strong>ποιος</strong> μπορεί να συνδεθεί;</p>
<ul>
  <li>Χωρίς <code>host</code>, ο server ακούει στο <code>127.0.0.1</code>: <strong>μόνο το ίδιο το Pi</strong>. Το tablet παίρνει «Connection refused».</li>
  <li>Με <code>host="0.0.0.0"</code> ακούει σε <strong>όλο το δίκτυο</strong> του σπιτιού: <code>http://192.168.1.10:5000</code>.</li>
</ul>
<p>Το <code>0.0.0.0</code> ανοίγει την πόρτα σε όλους στο δίκτυο. Γι' αυτό, ό,τι βάλεις στον server από εδώ και πέρα πρέπει να είναι ασφαλές.</p>`,
      glossary: ['Flask', 'route', 'app.run', 'host 0.0.0.0', 'localhost', 'port'],
      supportedSyntax: SYNTAX,
      initialCode: L1_INITIAL,
      solution: L1_SOLUTION,
      world: {}, initialWorld: {},
      hardware: ['web'], panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Διάβασε στο τερματικό τη γραμμή «Running on …».',
        'Στο πάνελ Web άνοιξε το / από το Pi. Μετά από το tablet. Τι αλλάζει;',
        'Απάντησε στην ερώτηση.',
        'Άλλαξε το app.run ώστε να ακούει σε όλο το δίκτυο. Δοκίμασε ξανά από το tablet.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο server τρέχει με app.run(port=5000). Το tablet (192.168.1.20) ανοίγει http://192.168.1.10:5000/. Τι γίνεται;',
        options: ['Connection refused: ο server δέχεται μόνο από το ίδιο το Pi', 'Βλέπει κανονικά τη σελίδα', '404 Not Found'],
        answer: 0,
        explain: 'Σωστά. Η προεπιλογή είναι host="127.0.0.1". Ο server δεν ακούει καν στη διεύθυνση 192.168.1.10, οπότε η σύνδεση απορρίπτεται πριν φτάσει στο Flask.',
        retry: 'Όχι ακόμα. Σε ποια διεύθυνση ακούει ο server όταν δεν γράφεις host; Κοίτα τη γραμμή «Running on …».'
      },
      hints: [
        'Το πρόβλημα δεν είναι στο route. Είναι στο πού ακούει ο server.',
        'Κοίτα την τελευταία γραμμή. Το app.run δέχεται και host=…',
        'app.run(host="0.0.0.0", port=5000)\nΤο 0.0.0.0 σημαίνει «όλες οι διευθύνσεις του Pi», άρα και η 192.168.1.10 που βλέπει το tablet.'
      ],
      validationTests: [
        { name: 'Το Pi βλέπει τη σελίδα', script: [
          { setup: true }, GET('/', 'pi'),
          { check: 'response', status: 200, contains: 'Smart Home', fail: 'Από το ίδιο το Pi η σελίδα / έδωσε: «{v}».' }
        ] },
        { name: 'Το tablet βλέπει τη σελίδα', script: [
          { setup: true }, GET('/'),
          { check: 'response', status: 200, contains: 'Smart Home', fail: 'Το tablet πήρε: «{v}». Ο server πρέπει να ακούει σε όλο το δίκτυο: host="0.0.0.0".' }
        ] },
        { name: 'Άγνωστη διεύθυνση → 404', script: [
          { setup: true }, GET('/settings'),
          { check: 'response', status: 404, fail: 'Το /settings δεν υπάρχει, άρα περίμενα 404. Το tablet πήρε: «{v}».' }
        ] }
      ],
      explanationOnSuccess: 'Το dashboard φαίνεται από το tablet. Στο τερματικό κάθε αίτημα γράφει μία γραμμή: ποια IP, ποια διεύθυνση, ποιο status. Αυτό είναι το access log: το πρώτο πράγμα που κοιτάς όταν κάτι δεν δουλεύει.',
      remediation: 'Αν το tablet παίρνει «Connection refused», κοίτα το host στο app.run. Αν παίρνει 404, κοίτα τη διεύθυνση στο @app.route.'
    },

    {
      id: 'c22-l2', chapter: 22, kind: 'guided', lang: 'python', skills: ['python', 'automation', 'network'],
      title: 'JSON API: η θερμοκρασία από τη βάση',
      prerequisites: ['c22-l1'],
      objectives: ['Να γράφω route με μεταβλητή στη διεύθυνση: /api/temp/<room>.', 'Να επιστρέφω λεξικό ως JSON.', 'Να απαντώ 404 με JSON όταν το δωμάτιο δεν υπάρχει.'],
      theory: `
<p>Μια σελίδα είναι για ανθρώπους. Ένα <strong>API</strong> είναι για προγράμματα: δίνει <strong>JSON</strong>.</p>
<pre>@app.route("/api/temp/&lt;room&gt;")
def temp(room):
    return {"room": room, "temp": 22.6}</pre>
<ul>
  <li>Το <code>&lt;room&gt;</code> είναι κομμάτι της διεύθυνσης που γίνεται παράμετρος: <code>/api/temp/salon</code> → <code>room = "salon"</code>.</li>
  <li>Ένα <strong>λεξικό</strong> στο <code>return</code> γίνεται JSON: <code>{"room":"salon","temp":22.6}</code>.</li>
</ul>
<p>Η θερμοκρασία έρχεται από τη βάση <code>home.db</code> του Κεφαλαίου 21. Θέλουμε την <strong>πιο πρόσφατη</strong>: <code>ORDER BY ts DESC LIMIT 1</code>.</p>
<p>Το <code>room</code> το γράφει όποιος στέλνει το αίτημα. Άρα μπαίνει στο SQL <strong>μόνο με <code>?</code></strong>, όπως στο Κεφάλαιο 21.</p>
<p>Αν το δωμάτιο δεν υπάρχει, το <code>fetchone()</code> δίνει <code>None</code>. Τότε απαντάμε με <strong>status 404</strong>:</p>
<pre>return jsonify({"error": "unknown room"}), 404</pre>
<p>Το δεύτερο στοιχείο του tuple είναι το status. Χωρίς αυτό, το Flask στέλνει 200.</p>`,
      glossary: ['API (JSON)', 'jsonify', 'HTTP status', 'route', 'JSON'],
      supportedSyntax: SYNTAX + ' · sqlite3: connect, execute(sql, (x,)), fetchone, close',
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      world: { db: HOME_DB }, initialWorld: {},
      hardware: ['web'], panels: PANELS_DB,
      steps: [
        'Κοίτα στο πάνελ Βάση τον πίνακα readings. Ποια είναι η νεότερη μέτρηση του salon;',
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τη σειρά ταξινόμησης: η νεότερη πρώτη.',
        'Συμπλήρωσε την παράμετρο: tuple με ένα στοιχείο.',
        'Συμπλήρωσε το status για «δεν βρέθηκε».',
        'Από το tablet άνοιξε /api/temp/salon, /api/temp/kitchen και /api/temp/garage. Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το tablet ζητά /api/temp/garage. Δεν υπάρχει garage στη βάση. Τι πρέπει να πάρει;',
        options: ['404 με JSON {"error":"unknown room"}', '200 με {"room":"garage","temp":null}', '500 Internal Server Error'],
        answer: 0,
        explain: 'Σωστά. Το 404 λέει στο πρόγραμμα του tablet «αυτό δεν υπάρχει», χωρίς να μαντεύει. Το 500 θα σήμαινε ότι χάλασε ο server. Το 200 θα έλεγε ψέματα.',
        retry: 'Όχι ακόμα. Τι λέει το 200; Τι λέει το 500; Ποιο ταιριάζει σε «δεν υπάρχει τέτοιο δωμάτιο»;'
      },
      hints: [
        'Τρία κενά: η κατεύθυνση ταξινόμησης, η παράμετρος του ?, και ένας αριθμός status.',
        'Η νεότερη πρώτη είναι φθίνουσα σειρά: DESC. Μία παράμετρος θέλει tuple με κόμμα. Το «δεν βρέθηκε» είναι το γνωστό 404.',
        'ORDER BY ts DESC LIMIT 1\n(room,)        ← το κόμμα το κάνει tuple\nreturn jsonify({"error": "unknown room"}), 404'
      ],
      validationTests: [
        { name: 'salon: η νεότερη μέτρηση, σε JSON', script: [
          { setup: true }, GET('/api/temp/salon'),
          { check: 'response', status: 200, contentType: 'json', fail: 'Το /api/temp/salon έδωσε: «{v}». Περίμενα 200 με JSON.' },
          { check: 'response', json: { room: 'salon', temp: 22.6 }, fail: 'Το /api/temp/salon έδωσε: «{v}». Περίμενα {"room":"salon","temp":22.6}, τη νεότερη μέτρηση (ts 2000). Ελέγξε το ORDER BY ts DESC.' }
        ] },
        { name: 'kitchen: σωστό δωμάτιο', script: [
          { setup: true }, GET('/api/temp/kitchen'),
          { check: 'response', status: 200, json: { room: 'kitchen', temp: 24.1 }, fail: 'Το /api/temp/kitchen έδωσε: «{v}». Περίμενα {"room":"kitchen","temp":24.1}.' }
        ] },
        { name: 'Άγνωστο δωμάτιο → 404 με JSON', script: [
          { setup: true }, GET('/api/temp/garage'),
          { check: 'response', status: 404, contentType: 'json', fail: 'Το /api/temp/garage έδωσε: «{v}». Περίμενα 404 με JSON {"error": …}.' },
          { check: 'response', json: { error: 'unknown room' }, fail: 'Το σώμα του 404 είναι: «{v}». Περίμενα {"error":"unknown room"}.' },
          GET('/api/temp/salon'),
          { check: 'response', status: 200, fail: 'Μετά το 404, το /api/temp/salon έδωσε: «{v}». Ο server πρέπει να συνεχίζει κανονικά.' }
        ] }
      ],
      explanationOnSuccess: 'Το Pi έχει πια ένα μικρό API. Το JSON του Flask είναι συμπαγές και με ταξινομημένα κλειδιά: {"room":"salon","temp":22.6}. Ένα πρόγραμμα στο tablet μπορεί να το διαβάσει και να ζωγραφίσει γράφημα, και ξέρει από το 404 πότε ζήτησε κάτι που δεν υπάρχει.',
      remediation: 'Αν βλέπεις «Incorrect number of bindings supplied», ξέχασες το κόμμα στο (room,). Αν η θερμοκρασία είναι 21.8, η ταξινόμηση είναι ανάποδα: χρειάζεται DESC.'
    },

    {
      id: 'c22-l3', chapter: 22, kind: 'guided', lang: 'python', skills: ['python', 'security', 'network'],
      title: 'Ό,τι γράφει ο χρήστης, μένει κείμενο (escape)',
      prerequisites: ['c22-l2'],
      objectives: ['Να καταλαβαίνω γιατί η είσοδος του χρήστη δεν μπαίνει αυτούσια στο HTML.', 'Να χρησιμοποιώ escape() από το markupsafe.'],
      theory: `
<p>Η σελίδα <code>/search?q=sal</code> γράφει «Αναζήτηση: sal». Το <code>q</code> το γράφει <strong>όποιος στέλνει το αίτημα</strong>.</p>
<p>Τι γίνεται αν το <code>q</code> είναι <code>&lt;b&gt;Σαλόνι&lt;/b&gt;</code>; Το f-string το βάζει αυτούσιο στη σελίδα. Ο browser το διαβάζει ως <strong>HTML</strong>, όχι ως κείμενο.</p>
<p>Με ένα <code>&lt;script&gt;</code> στη θέση του <code>&lt;b&gt;</code>, ο browser του tablet θα έτρεχε <strong>κώδικα που δεν έγραψες εσύ</strong>. Αυτό λέγεται <strong>XSS</strong>.</p>
<p>Η άμυνα είναι μία γραμμή:</p>
<pre>from markupsafe import escape
shown = escape(q)</pre>
<ul>
  <li>Το <code>&lt;</code> γίνεται <code>&amp;lt;</code> και το <code>&gt;</code> γίνεται <code>&amp;gt;</code>.</li>
  <li>Ο browser δείχνει τα σύμβολα ως <strong>κείμενο</strong>. Δεν τα εκτελεί.</li>
</ul>
<p>Κανόνας: <strong>escape σε κάθε έξοδο</strong> που περιέχει κείμενο από έξω (διεύθυνση, φόρμα, βάση, MQTT).</p>
<p>Η προεπισκόπηση του παιχνιδιού <strong>δεν</strong> τρέχει scripts, οπότε εδώ τίποτα δεν εκτελείται. Θα δεις όμως το <code>&lt;b&gt;</code> να γίνεται έντονο: η απόδειξη ότι η σελίδα δέχεται HTML από έξω.</p>`,
      glossary: ['escape', 'XSS', 'f-string', 'έλεγχος εισόδου (validation)'],
      supportedSyntax: SYNTAX + ' · request.args.get(k, default) · from markupsafe import escape',
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: {}, initialWorld: {},
      hardware: ['web'], panels: PANELS,
      steps: [
        'Τρέξε. Από το tablet άνοιξε /search?q=sal. Βλέπεις το salon;',
        'Άνοιξε /search?q=<b>Σαλόνι</b>. Κοίτα την προεπισκόπηση και το σώμα της απάντησης.',
        'Απάντησε στην ερώτηση.',
        'Βάλε escape(q) στη θέση του q. Ξαναδοκίμασε το <b>.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Με escape, τι στέλνει ο server για q=<b>Σαλόνι</b>;',
        options: ['&lt;b&gt;Σαλόνι&lt;/b&gt;: ο browser δείχνει τα σύμβολα ως κείμενο', '<b>Σαλόνι</b>: έντονα γράμματα', 'Τίποτα: το escape σβήνει τα σύμβολα'],
        answer: 0,
        explain: 'Σωστά. Το escape δεν σβήνει τίποτα. Αλλάζει τα < και > σε &lt; και &gt;. Ο χρήστης βλέπει ακριβώς ό,τι έγραψε, αλλά ως κείμενο.',
        retry: 'Όχι ακόμα. Το escape ούτε σβήνει ούτε αφήνει το HTML. Σε τι μετατρέπει το < ;'
      },
      hints: [
        'Το πρόβλημα είναι μία γραμμή: εκεί που το q μπαίνει στο shown.',
        'Το escape είναι ήδη import από το markupsafe. Κάλεσέ το με το q.',
        'shown = escape(q)\nΤα ονόματα στο ROOMS τα γράψαμε εμείς, αλλά το q έρχεται από έξω. Γι\' αυτό αυτό θέλει escape.'
      ],
      validationTests: [
        { name: 'Η αναζήτηση δουλεύει', script: [
          { setup: true }, GET('/search?q=sal'),
          { check: 'response', status: 200, contains: ['salon', 'Αναζήτηση: sal'], fail: 'Το /search?q=sal έδωσε: «{v}». Περίμενα 200 με «Αναζήτηση: sal» και το salon.' }
        ] },
        { name: '<script> στην αναζήτηση → μένει κείμενο', script: [
          { setup: true }, GET('/search?q=<script>alert(1)</script>'),
          { check: 'response', status: 200, notContains: '<script>', fail: 'Η σελίδα περιέχει αυτούσιο <script>: «{v}». Χρησιμοποίησε escape(q).' },
          { check: 'response', contains: '&lt;script&gt;', fail: 'Δεν βλέπω το &lt;script&gt; στη σελίδα: «{v}». Το escape πρέπει να αλλάζει τα σύμβολα, όχι να τα σβήνει.' }
        ] },
        { name: '<b> στην αναζήτηση → μένει κείμενο', script: [
          { setup: true }, GET('/search?q=<b>Σαλόνι</b>'),
          { check: 'response', status: 200, notContains: '<b>', contains: '&lt;b&gt;Σαλόνι&lt;/b&gt;', fail: 'Η σελίδα για q=<b>Σαλόνι</b> είναι: «{v}». Περίμενα &lt;b&gt;Σαλόνι&lt;/b&gt;.' }
        ] }
      ],
      explanationOnSuccess: 'Η σελίδα δείχνει ό,τι γράφει ο χρήστης, αλλά ως κείμενο. Στο αληθινό Flask, τα templates (render_template) κάνουν escape αυτόματα. Όταν όμως φτιάχνεις HTML μόνος σου με f-string, το escape είναι δική σου ευθύνη.',
      remediation: 'Αν βλέπεις «ImportError: cannot import name \'escape\' from \'flask\'», το escape ζει στο markupsafe από το Flask 3 και μετά: from markupsafe import escape.'
    },

    {
      id: 'c22-l4', chapter: 22, kind: 'independent', lang: 'python', skills: ['python', 'security', 'automation', 'network'],
      title: 'Κλειδί για τη λάμπα: προστατευμένο endpoint',
      prerequisites: ['c22-l3'],
      objectives: ['Να ελέγχω την κεφαλίδα X-API-Key πριν εκτελέσω εντολή.', 'Να απαντώ 401 με abort όταν το κλειδί λείπει ή είναι λάθος.', 'Να παίρνω το κλειδί από το config και να κλείνω το debug.'],
      theory: `
<p>Το <code>POST /api/led</code> στέλνει εντολή στη λάμπα μέσω MQTT (<code>home/led/set</code>). Με <code>host="0.0.0.0"</code>, <strong>κάθε συσκευή</strong> του δικτύου μπορεί να το καλέσει.</p>
<p>Θέλουμε: μόνο όποιος έχει το <strong>κλειδί</strong>. Το tablet το στέλνει σε κάθε αίτημα, σε μια κεφαλίδα:</p>
<pre>X-API-Key: …</pre>
<p>Ο server ελέγχει <strong>πρώτα</strong>, πριν κάνει οτιδήποτε:</p>
<pre>if request.headers.get("X-API-Key") != API_KEY:
    abort(401)</pre>
<ul>
  <li>Το <code>.get</code> δίνει <code>None</code> αν η κεφαλίδα λείπει. Το <code>None</code> δεν είναι ίσο με το κλειδί, άρα 401.</li>
  <li>Το <code>abort(401)</code> σταματά τη συνάρτηση. Το <code>publish</code> από κάτω δεν τρέχει.</li>
</ul>
<p>Δύο ακόμα κανόνες, όπως στο Κεφάλαιο 20:</p>
<ul>
  <li>Το κλειδί <strong>δεν</strong> γράφεται στον κώδικα: <code>from config import API_KEY</code>.</li>
  <li>Το <code>debug=True</code> ανοίγει έναν debugger που τρέχει κώδικα Python από τον browser. Σε server του δικτύου: πάντα <code>debug=False</code>.</li>
</ul>
<p>Το κλειδί εδώ είναι φανταστικό. Σε αληθινό σπίτι, το HTTP θέλει και HTTPS, αλλιώς το κλειδί ταξιδεύει ως καθαρό κείμενο.</p>`,
      glossary: ['API key', 'κεφαλίδα (header)', 'abort', 'debug mode', 'HTTP status', 'αρχείο ρυθμίσεων'],
      supportedSyntax: SYNTAX + ' · @app.route(…, methods=["POST"]) · request.headers.get(k) · request.get_json(silent=True) · abort(401) · from config import API_KEY · paho: loop_start, publish',
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: LED_WORLD, initialWorld: {},
      hardware: ['web', 'broker'], panels: ['web', 'serial', 'vars', 'mqtt'],
      steps: [
        'Τρέξε. Από το tablet στείλε POST /api/led με JSON {"cmd": "ON"}, χωρίς κλειδί. Τι γίνεται στη λάμπα;',
        'Γράψε τον έλεγχο του X-API-Key πριν από όλα τα άλλα.',
        'Πάρε το API_KEY από το config. Σβήσε το κλειδί από τον κώδικα.',
        'Κλείσε το debug.',
        'Δοκίμασε χωρίς κλειδί, με λάθος κλειδί και με σωστό. Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ένα αίτημα έρχεται με λάθος κλειδί. Γιατί ο έλεγχος μπαίνει πριν από το client.publish;',
        options: ['Για να μη φτάσει ποτέ η εντολή στη λάμπα', 'Για να τρέχει πιο γρήγορα ο server', 'Δεν έχει σημασία η σειρά'],
        answer: 0,
        explain: 'Σωστά. Το abort(401) σταματά τη συνάρτηση. Αν ο έλεγχος ήταν μετά το publish, η λάμπα θα είχε ήδη ανάψει, και το 401 θα ερχόταν πολύ αργά.',
        retry: 'Όχι ακόμα. Τι θα είχε ήδη γίνει αν ο έλεγχος ήταν στο τέλος της συνάρτησης;'
      },
      hints: [
        'Τρία πράγματα: έλεγχος κλειδιού στην αρχή του led(), κλειδί από το config, debug=False.',
        'Η κεφαλίδα διαβάζεται με request.headers.get("X-API-Key"). Αν δεν είναι ίση με το API_KEY → abort(401). Στην κορυφή: from config import API_KEY αντί για API_KEY = "…".',
        'from config import API_KEY\n…\ndef led():\n    if request.headers.get("X-API-Key") != API_KEY:\n        abort(401)\n    …\napp.run(host="0.0.0.0", port=5000, debug=False)'
      ],
      validationTests: [
        { name: 'Χωρίς κλειδί → 401, η λάμπα δεν αλλάζει', script: [
          { setup: true }, LED(null, { cmd: 'ON' }),
          { check: 'response', status: 401, fail: 'POST /api/led χωρίς κλειδί έδωσε: «{v}». Περίμενα 401.' },
          { check: 'published', topic: 'home/led/set', is: 0, fail: 'Χωρίς κλειδί στάλθηκαν {n} εντολές στο home/led/set. Ο έλεγχος πρέπει να γίνεται πριν από το publish.' }
        ] },
        { name: 'Λάθος κλειδί → 401', script: [
          { setup: true }, LED({ 'X-API-Key': 'guess-1234' }, { cmd: 'ON' }),
          { check: 'response', status: 401, fail: 'POST /api/led με λάθος κλειδί έδωσε: «{v}». Περίμενα 401.' },
          { check: 'published', topic: 'home/led/set', is: 0, fail: 'Με λάθος κλειδί στάλθηκαν {n} εντολές στη λάμπα.' }
        ] },
        { name: 'Σωστό κλειδί → εντολή στη λάμπα', script: [
          { setup: true }, LED({ 'X-API-Key': API_KEY }, { cmd: 'ON' }),
          { check: 'response', status: 200, json: { ok: true, cmd: 'ON' }, fail: 'POST /api/led με σωστό κλειδί έδωσε: «{v}». Περίμενα 200 με {"cmd":"ON","ok":true}.' },
          { check: 'published', topic: 'home/led/set', json: { cmd: 'ON' }, is: 1, fail: 'Με σωστό κλειδί στάλθηκαν {n} εντολές ON. Περίμενα 1.' },
          LED({ 'X-API-Key': API_KEY }, { cmd: 'BLINK' }),
          { check: 'response', status: 400, fail: 'Η άγνωστη εντολή BLINK έδωσε: «{v}». Περίμενα 400.' }
        ] },
        { name: 'debug κλειστό, κλειδί έξω από τον κώδικα', script: [
          { setup: true },
          { check: 'serialHas', text: 'Debug mode: off', fail: 'Στο τερματικό δεν βλέπω «Debug mode: off». Γράψε debug=False στο app.run.' },
          { check: 'serialNot', text: 'Debugger is active', fail: 'Ο debugger του Werkzeug είναι ενεργός. Γράψε debug=False.' },
          LED({ 'X-API-Key': API_KEY }, { cmd: 'OFF' }),
          { check: 'response', status: 200, fail: 'Με το κλειδί από το config, το POST /api/led έδωσε: «{v}».' },
          { check: 'sourceNot', text: API_KEY, fail: 'Το κλειδί είναι ακόμα γραμμένο στον κώδικα. Πάρε το από το config: from config import API_KEY.' }
        ] }
      ],
      explanationOnSuccess: 'Η λάμπα ακούει μόνο όποιον έχει το κλειδί, και το 401 φεύγει πριν γίνει οτιδήποτε. Το κλειδί ζει στο config και ο debugger είναι κλειστός. Σε αληθινό σύστημα θα πρόσθετες HTTPS και όριο ρυθμού (429) για πολλά λάθος κλειδιά.',
      remediation: 'Αν ακόμα και με σωστό κλειδί παίρνεις 401, έλεγξε το όνομα της κεφαλίδας: "X-API-Key". Αν βλέπεις «ImportError … from \'config\'», το όνομα είναι API_KEY.'
    },

    {
      id: 'c22-l5', chapter: 22, kind: 'checkpoint', lang: 'python', skills: ['python', 'security', 'network', 'automation'],
      title: 'Τελικό dashboard: βρες τα 6 λάθη',
      prerequisites: ['c22-l4'],
      objectives: ['Να διαβάζω το access log και το «ERROR in app» για να βρίσκω λάθη.', 'Να συνδυάζω host, status, escape, κλειδί και debug σε ένα dashboard.'],
      theory: `
<p>Το dashboard έχει τέσσερα routes:</p>
<ul>
  <li><code>/</code>: καλωσόρισμα με <code>?name=…</code></li>
  <li><code>/api/rooms</code>: λίστα δωματίων από τη βάση</li>
  <li><code>/api/temp/&lt;room&gt;</code>: τελευταία θερμοκρασία</li>
  <li><code>POST /api/led</code>: εντολή στη λάμπα</li>
</ul>
<p>Έχει <strong>6 λάθη</strong>. Τα συμπτώματα:</p>
<ol>
  <li>Το tablet παίρνει «Connection refused».</li>
  <li>Στο τερματικό: <code>Debugger is active!</code></li>
  <li>Το <code>/api/rooms</code> δίνει 500. Στο τερματικό: <code>did not return a valid response</code>.</li>
  <li>Το <code>/api/temp/garage</code> δίνει 500 αντί για 404.</li>
  <li>Το <code>/?name=&lt;b&gt;x&lt;/b&gt;</code> γίνεται έντονο.</li>
  <li>Η λάμπα ανάβει χωρίς κλειδί.</li>
</ol>
<p>Παρατήρησε: όταν ένα route «σκάει», το tablet παίρνει 500, αλλά <strong>ο server συνεχίζει</strong>. Το τερματικό γράφει <code>ERROR in app</code> και τη γραμμή του λάθους. Ξεκίνα από εκεί.</p>`,
      glossary: ['HTTP status', 'host 0.0.0.0', 'escape', 'API key', 'debug mode', 'return'],
      supportedSyntax: SYNTAX + ' · request.args, request.headers, request.get_json · abort · escape · sqlite3 · paho',
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: { db: HOME_DB, broker: OPEN_BROKER, clients: [DASH], consts: { API_KEY } }, initialWorld: {},
      hardware: ['web', 'broker'], panels: ['web', 'serial', 'vars', 'db', 'mqtt'],
      steps: [
        'Τρέξε. Δοκίμασε όλα τα routes από το Pi και από το tablet.',
        'Για κάθε 500, διάβασε στο τερματικό το «ERROR in app» και τη γραμμή.',
        'Διόρθωσε τα 6 λάθη, ένα τη φορά. Τρέχε τον έλεγχο λύσης μετά από κάθε διόρθωση.',
        'Απάντησε στην ερώτηση.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το /api/temp/garage δίνει 500. Τι γίνεται με τον server;',
        options: ['Συνεχίζει: το επόμενο αίτημα εξυπηρετείται κανονικά', 'Σταματά και πρέπει να ξαναξεκινήσει', 'Ξαναξεκινά μόνος του από την αρχή'],
        answer: 0,
        explain: 'Σωστά. Το Flask πιάνει το σφάλμα του route, γράφει «ERROR in app» στο τερματικό και στέλνει 500. Τα άλλα αιτήματα συνεχίζουν. Γι\' αυτό ένα 500 περνά εύκολα απαρατήρητο: πρέπει να κοιτάς το log.',
        retry: 'Όχι ακόμα. Στείλε /api/temp/garage και μετά /api/temp/salon. Τι βλέπεις στο access log;'
      },
      hints: [
        'Ένα λάθος σε κάθε route, και δύο στο app.run.',
        'app.run: host="0.0.0.0", debug=False. rooms(): λείπει ένα return. temp(): αν το rows είναι άδειο → 404. index(): escape(name). led(): έλεγχος X-API-Key στην αρχή.',
        'def rooms():\n    …\n    return {"rooms": names, "count": len(names)}\n\nif not rows:\n    return jsonify({"error": "unknown room"}), 404\n\nif request.headers.get("X-API-Key") != API_KEY:\n    abort(401)'
      ],
      // Κάθε test (εκτός από το πρώτο) στέλνει από το ίδιο το Pi, ώστε κάθε λάθος να φαίνεται χωριστά.
      validationTests: [
        { name: 'Το tablet φτάνει τον server', script: [
          { setup: true }, GET('/'),
          { check: 'response', status: 200, fail: 'Ο server πρέπει να ακούει σε όλο το δίκτυο. Το tablet πήρε: «{v}»' }
        ] },
        { name: 'Ο debugger είναι κλειστός', script: [
          { setup: true },
          { check: 'serialNot', text: 'Debugger is active', fail: 'Στο τερματικό: «Debugger is active!». Γράψε debug=False στο app.run.' }
        ] },
        { name: '/api/rooms: λίστα δωματίων σε JSON', script: [
          { setup: true }, GET('/api/rooms', 'pi'),
          { check: 'response', status: 200, json: { rooms: ['kitchen', 'salon'], count: 2 }, fail: 'Περίμενα {"count":2,"rooms":["kitchen","salon"]}. Το /api/rooms έδωσε: «{v}»' }
        ] },
        { name: '/api/temp: 200 για salon, 404 για garage, ο server συνεχίζει', script: [
          { setup: true }, GET('/api/temp/salon', 'pi'),
          { check: 'response', status: 200, json: { room: 'salon', temp: 22.6 }, fail: 'Το /api/temp/salon έδωσε: «{v}»' },
          GET('/api/temp/garage', 'pi'),
          { check: 'response', status: 404, contentType: 'json', fail: 'Περίμενα 404 με JSON, όχι 500. Το /api/temp/garage έδωσε: «{v}»' },
          GET('/api/temp/kitchen', 'pi'),
          { check: 'response', status: 200, json: { temp: 24.1 }, fail: 'Μετά το garage, το /api/temp/kitchen έδωσε: «{v}»' }
        ] },
        { name: 'Το όνομα στο καλωσόρισμα μένει κείμενο', script: [
          { setup: true }, GET('/?name=<script>alert(1)</script>', 'pi'),
          { check: 'response', status: 200, notContains: '<script>', contains: '&lt;script&gt;', fail: 'Το name θέλει escape. Το /?name=<script>… έδωσε: «{v}»' }
        ] },
        { name: 'Λάμπα: μόνο με κλειδί', script: [
          { setup: true }, LED(null, { cmd: 'ON' }, 'pi'),
          { check: 'response', status: 401, fail: 'Περίμενα 401. POST /api/led χωρίς κλειδί έδωσε: «{v}»' },
          LED({ 'X-API-Key': 'guess-1234' }, { cmd: 'ON' }, 'pi'),
          { check: 'response', status: 401, fail: 'Περίμενα 401. POST /api/led με λάθος κλειδί έδωσε: «{v}»' },
          { check: 'published', topic: 'home/led/set', is: 0, fail: 'Χωρίς σωστό κλειδί στάλθηκαν {n} εντολές στη λάμπα.' },
          LED({ 'X-API-Key': API_KEY }, { cmd: 'ON' }, 'pi'),
          { check: 'response', status: 200, json: { ok: true, cmd: 'ON' }, fail: 'POST /api/led με σωστό κλειδί έδωσε: «{v}»' },
          { check: 'published', topic: 'home/led/set', json: { cmd: 'ON' }, is: 1, fail: 'Με σωστό κλειδί στάλθηκαν {n} εντολές ON. Περίμενα 1.' }
        ] }
      ],
      explanationOnSuccess: 'Το dashboard είναι έτοιμο: φαίνεται στο δίκτυο του σπιτιού, απαντά με σωστά status, δείχνει την είσοδο ως κείμενο, ζητά κλειδί για τη λάμπα και δεν έχει debugger ανοιχτό. Στο Κεφάλαιο 23 κλειδώνουμε και το ίδιο το Pi: ποιος μπορεί να φτάσει τη θύρα 5000.',
      remediation: 'Διόρθωνε ένα λάθος τη φορά. Κάθε test ελέγχει ένα σύμπτωμα. Δοκίμασε τα routes και από το Pi: έτσι βλέπεις τα λάθη τους ακόμα κι αν το tablet παίρνει «Connection refused».'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
