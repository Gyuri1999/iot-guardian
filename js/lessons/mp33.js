/*
 * IoT Guardian — MicroPython στο ESP32, κεφάλαιο 33 (4ο του κλάδου): WiFi με network.WLAN.
 * Σύνδεση με στοιχεία από το config, αναμονή με timeout (ticks_ms / ticks_diff), status(),
 * λάθος κωδικός / router κάτω, επανασύνδεση. Ο κωδικός δεν τυπώνεται ποτέ.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 33, title: 'WiFi με network.WLAN', ready: true, track: 'py-esp32', lang: 'python', board: 'esp32', unlockAfter: 32 });
  if (!L.SKILLS.micropython) L.SKILLS.micropython = 'MicroPython';

  [
    { term: 'network.WLAN', def: 'Το WiFi της MicroPython. wlan = network.WLAN(network.STA_IF) φτιάχνει τον «σταθμό» (STA) που συνδέεται σε router. Μετά: active(True), connect(ssid, κωδικός), isconnected().' },
    { term: 'STA_IF', def: 'Station interface: η πλακέτα συνδέεται σε ένα υπάρχον WiFi, όπως ένα κινητό. Το AP_IF κάνει την πλακέτα η ίδια σημείο πρόσβασης.' },
    { term: 'wlan.status()', def: 'Αριθμός που λέει τι κάνει το WiFi: STAT_CONNECTING (1001), STAT_GOT_IP (1010), STAT_WRONG_PASSWORD (202), STAT_NO_AP_FOUND (201).' },
    { term: 'config.py', def: 'Ένα ξεχωριστό αρχείο στην πλακέτα με ρυθμίσεις και μυστικά, π.χ. WIFI_SSID και WIFI_PASS. Το φορτώνεις με import config. Δεν το ανεβάζεις σε δημόσιο αποθετήριο κώδικα.' },
    { term: 'ticks_ms / ticks_diff', def: 'time.ticks_ms() δίνει ms από την εκκίνηση. time.ticks_diff(τώρα, αρχή) δίνει πόσα ms πέρασαν, σωστά ακόμα κι όταν ο μετρητής «γυρίσει» από την αρχή.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const BASE = { lang: 'python', board: 'esp32', chapter: 33 };
  const SYNTAX = 'import network, import config, network.WLAN(network.STA_IF), active(True), connect(ssid, key), isconnected(), status(), ifconfig(), disconnect(), network.STAT_*, time.ticks_ms(), time.ticks_diff(), def με προεπιλεγμένη τιμή, return True / False';
  const PANELS = ['serial', 'vars', 'branch', 'loops'];
  const CONSTS = { WIFI_SSID: 'SmartHome-Lab', WIFI_PASS: 'lab-pass-123' };
  const WORLD = { consts: CONSTS };
  const PASS_HIDDEN = { check: 'serialNot', text: 'lab-pass-123', fail: 'Ο κωδικός του WiFi εμφανίστηκε στο Τερματικό. Μην τυπώνεις ποτέ το config.WIFI_PASS.' };
  const PASS_NOT_IN_CODE = { check: 'sourceNot', text: 'lab-pass-123', fail: 'Ο κωδικός του WiFi είναι γραμμένος μέσα στον κώδικα. Χρησιμοποίησε config.WIFI_PASS.' };

  const CONNECT_FN = `def connect_wifi(timeout_ms=10000):
    wlan.connect(config.WIFI_SSID, config.WIFI_PASS)
    start = time.ticks_ms()
    while not wlan.isconnected():
        if time.ticks_diff(time.ticks_ms(), start) > timeout_ms:
            return False
        time.sleep_ms(200)
    return True`;

  // ------------------------------------------------------------ 33.1
  const L1_CODE = (args) => `# Σύνδεση στο WiFi του σπιτιού.
import network
import time
import config                    # config.py: WIFI_SSID και WIFI_PASS

wlan = network.WLAN(network.STA_IF)
wlan.active(True)                # άναψε το WiFi της πλακέτας
wlan.connect(${args})

while not wlan.isconnected():
    print("Connecting...")
    time.sleep_ms(500)

print("Connected, IP:", wlan.ifconfig()[0])

while True:
    time.sleep(1)
`;

  // ------------------------------------------------------------ 33.2
  const L2_CODE = (limit) => `# Σύνδεση με όριο χρόνου: όχι αναμονή για πάντα.
import network
import time
import config

wlan = network.WLAN(network.STA_IF)
wlan.active(True)

def connect_wifi(timeout_ms=10000):
    wlan.connect(config.WIFI_SSID, config.WIFI_PASS)
    start = time.ticks_ms()
    while not wlan.isconnected():
        if time.ticks_diff(time.ticks_ms(), start) > ${limit}:
            return False         # πέρασε ο χρόνος: σταμάτα να περιμένεις
        time.sleep_ms(200)
    return True

if connect_wifi():
    print("WiFi OK:", wlan.ifconfig()[0])
else:
    print("WiFi failed, status:", wlan.status())

while True:
    time.sleep(1)
`;

  // ------------------------------------------------------------ 33.3
  const L3_HEAD = `# Γιατί δεν συνδέθηκε; Ένα καθαρό μήνυμα για κάθε status.
import network
import time
import config

wlan = network.WLAN(network.STA_IF)
wlan.active(True)

${CONNECT_FN}

`;
  const L3_INITIAL = L3_HEAD + `# ΣΥΜΠΛΗΡΩΣΕ: "Wrong password" για STAT_WRONG_PASSWORD,
#             "Network not found" για STAT_NO_AP_FOUND.
def explain(status):
    if status == network.STAT_GOT_IP:
        return "Connected"
    else:
        return "Error " + str(status)

connect_wifi()
print("WiFi:", explain(wlan.status()))

while True:
    time.sleep(1)
`;
  const L3_SOLUTION = L3_HEAD + `def explain(status):
    if status == network.STAT_GOT_IP:
        return "Connected"
    elif status == network.STAT_WRONG_PASSWORD:
        return "Wrong password"
    elif status == network.STAT_NO_AP_FOUND:
        return "Network not found"
    else:
        return "Error " + str(status)

connect_wifi()
print("WiFi:", explain(wlan.status()))

while True:
    time.sleep(1)
`;

  // ------------------------------------------------------------ 33.4
  const L4_INITIAL = `# Παράπονο 1: «Η πλακέτα σταματά με OSError πριν συνδεθεί.»
# Παράπονο 2: «Κάποιος είδε τον κωδικό του WiFi στο τερματικό, στο εργαστήριο.»
import network
import time
import config

wlan = network.WLAN(network.STA_IF)
print("Connecting to", config.WIFI_SSID, "with", config.WIFI_PASS)
wlan.connect(config.WIFI_SSID, config.WIFI_PASS)

while not wlan.isconnected():
    time.sleep_ms(200)

print("IP:", wlan.ifconfig()[0])

while True:
    time.sleep(1)
`;
  const L4_SOLUTION = `# Διορθωμένο: ενεργό WiFi, και ο κωδικός δεν τυπώνεται.
import network
import time
import config

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
print("Connecting to", config.WIFI_SSID)
wlan.connect(config.WIFI_SSID, config.WIFI_PASS)

while not wlan.isconnected():
    time.sleep_ms(200)

print("IP:", wlan.ifconfig()[0])

while True:
    time.sleep(1)
`;

  // ------------------------------------------------------------ 33.5
  const L5_HEAD = `# Η πλακέτα ξανασυνδέεται μόνη της όταν πέσει το WiFi.
# LED αναμμένο = συνδεδεμένη.
from machine import Pin
import network
import time
import config

led = Pin(2, Pin.OUT)
wlan = network.WLAN(network.STA_IF)
wlan.active(True)

${CONNECT_FN}

if connect_wifi():
    print("WiFi OK")
led.value(wlan.isconnected())

`;
  const L5_INITIAL = L5_HEAD + `# ΓΡΑΨΕ: κάθε 5 s έλεγξε το WiFi.
# Αν δεν είναι συνδεδεμένο: LED σβηστό, print("WiFi lost, reconnecting"),
# wlan.disconnect() και ξανά connect_wifi(). Αν πετύχει: print("Reconnected") και LED αναμμένο.
while True:
    time.sleep(5)
`;
  const L5_SOLUTION = L5_HEAD + `while True:
    if not wlan.isconnected():
        led.off()
        print("WiFi lost, reconnecting")
        wlan.disconnect()
        if connect_wifi():
            print("Reconnected")
            led.on()
    time.sleep(5)
`;

  L.lessons.push(
    Object.assign({}, BASE, {
      id: 'c33-l1', kind: 'micro', skills: ['micropython', 'network', 'security'],
      title: 'Σύνδεση στο WiFi με network.WLAN',
      prerequisites: [],
      objectives: ['Να ανάβω το WiFi της πλακέτας με active(True).', 'Να συνδέομαι με στοιχεία από το config.', 'Να περιμένω μέχρι το isconnected() να γίνει True.'],
      theory: `
<p>Τέσσερα βήματα για WiFi στη MicroPython:</p>
<ol>
  <li><code>wlan = network.WLAN(network.STA_IF)</code> → το WiFi «σταθμού».</li>
  <li><code>wlan.active(True)</code> → ανάβει το ραδιόφωνο.</li>
  <li><code>wlan.connect(ssid, κωδικός)</code> → ξεκινά τη σύνδεση. <strong>Δεν</strong> περιμένει!</li>
  <li><code>while not wlan.isconnected():</code> → περίμενε λίγο και ξαναρώτα.</li>
</ol>
<p>Η σύνδεση θέλει περίπου 1 δευτερόλεπτο. Το <code>wlan.ifconfig()[0]</code> δίνει τη διεύθυνση IP.</p>
<p><strong>Μυστικά:</strong> το όνομα και ο κωδικός του WiFi μπαίνουν σε ξεχωριστό αρχείο <code>config.py</code>:</p>
<pre>WIFI_SSID = "…"
WIFI_PASS = "…"</pre>
<p>Στον κώδικα γράφεις <code>config.WIFI_SSID</code> και <code>config.WIFI_PASS</code>. Έτσι ο κωδικός δεν φαίνεται όταν δείχνεις ή μοιράζεσαι το <code>main.py</code>.</p>`,
      glossary: ['network.WLAN', 'STA_IF', 'config.py', 'SSID', 'διεύθυνση IP'],
      supportedSyntax: SYNTAX,
      initialCode: L1_CODE('____, ____'),
      solution: L1_CODE('config.WIFI_SSID, config.WIFI_PASS'),
      world: WORLD, initialWorld: { router: true },
      hardware: ['router'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τα δύο ορίσματα του connect με τις τιμές από το config.',
        'Τρέξε. Πόσες φορές γράφει «Connecting...» πριν συνδεθεί;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι κάνει το wlan.connect(…) μόνο του;',
        options: ['Ξεκινά τη σύνδεση και συνεχίζει αμέσως, χωρίς να περιμένει', 'Περιμένει μέχρι να συνδεθεί', 'Τυπώνει την IP'],
        answer: 0,
        explain: 'Σωστά. Γι’ αυτό χρειάζεται το while not wlan.isconnected(): για να περιμένεις.',
        retry: 'Όχι ακόμα. Αν το connect περίμενε μόνο του, γιατί θα χρειαζόταν ο βρόχος από κάτω;'
      },
      hints: [
        'Τα στοιχεία του WiFi είναι στο module config.',
        'Γράψε config. και μετά το όνομα της ρύθμισης: WIFI_SSID για το όνομα, WIFI_PASS για τον κωδικό.',
        'wlan.connect(config.WIFI_SSID, config.WIFI_PASS)\n• πρώτα το όνομα του δικτύου, μετά ο κωδικός'
      ],
      validationTests: [
        { name: 'Η πλακέτα συνδέεται στο WiFi', script: [
          { setup: true },
          { check: 'wifiConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε στο WiFi. Έλεγξε το wlan.connect(config.WIFI_SSID, config.WIFI_PASS).' },
          { check: 'serialHas', text: 'Connected, IP: 192.168.1.42', fail: 'Το Τερματικό δεν έγραψε «Connected, IP: 192.168.1.42». Τελευταίες γραμμές: {v}.' }
        ] },
        { name: 'Ο κωδικός δεν είναι μέσα στον κώδικα ούτε στο Τερματικό', script: [
          { setup: true }, PASS_HIDDEN, PASS_NOT_IN_CODE
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα είναι στο δίκτυο, με IP 192.168.1.42! Και ο κωδικός μένει στο config.py, όχι στο main.py.',
      remediation: 'Αν δεις «AttributeError: …config…», έγραψες λάθος όνομα. Τα σωστά είναι WIFI_SSID και WIFI_PASS, με κεφαλαία.'
    }),

    Object.assign({}, BASE, {
      id: 'c33-l2', kind: 'guided', skills: ['micropython', 'network', 'timing'],
      title: 'Όριο χρόνου: όχι αναμονή για πάντα',
      prerequisites: ['c33-l1'],
      objectives: ['Να μετρώ χρόνο με ticks_ms και ticks_diff.', 'Να σταματώ την αναμονή μετά από timeout.', 'Να επιστρέφω True / False από μια συνάρτηση.'],
      theory: `
<p>Αν ο router είναι σβηστός, το <code>while not wlan.isconnected()</code> περιμένει <strong>για πάντα</strong>. Η πλακέτα «κολλάει» και δεν κάνει τίποτα άλλο.</p>
<p>Λύση: ένα <strong>όριο χρόνου</strong> (timeout).</p>
<pre>start = time.ticks_ms()
while not wlan.isconnected():
    if time.ticks_diff(time.ticks_ms(), start) > timeout_ms:
        return False
    time.sleep_ms(200)
return True</pre>
<ul>
  <li><code>ticks_diff(τώρα, αρχή)</code> = πόσα ms πέρασαν.</li>
  <li>Η συνάρτηση επιστρέφει <code>True</code> (συνδέθηκε) ή <code>False</code> (πέρασε ο χρόνος).</li>
  <li><code>timeout_ms=10000</code> είναι <strong>προεπιλεγμένη τιμή</strong>: αν δεν δώσεις τίποτα, είναι 10 δευτερόλεπτα.</li>
</ul>`,
      glossary: ['timeout', 'ticks_ms / ticks_diff', 'return', 'wlan.status()'],
      supportedSyntax: SYNTAX,
      initialCode: L2_CODE('____'),
      solution: L2_CODE('timeout_ms'),
      world: WORLD, initialWorld: { router: true },
      hardware: ['router'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το κενό με το όριο χρόνου (την παράμετρο της συνάρτησης).',
        'Τρέξε με τον router αναμμένο.',
        'Σβήσε τον router στη σκηνή και τρέξε ξανά. Τι τυπώνει μετά από 10 δευτερόλεπτα;',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο router είναι σβηστός. Τι κάνει το connect_wifi() με το όριο χρόνου;',
        options: ['Μετά από 10 s επιστρέφει False και το πρόγραμμα συνεχίζει', 'Περιμένει για πάντα', 'Σηκώνει OSError αμέσως'],
        answer: 0,
        explain: 'Σωστά. Το πρόγραμμα ξέρει ότι απέτυχε και μπορεί να κάνει κάτι άλλο: να τυπώσει μήνυμα, να ξαναδοκιμάσει αργότερα.',
        retry: 'Όχι ακόμα. Δες τι κάνει το if μέσα στον βρόχο όταν περάσει ο χρόνος.'
      },
      hints: [
        'Συγκρίνεις τα ms που πέρασαν με το όριο χρόνου.',
        'Το όριο είναι η παράμετρος της συνάρτησης: timeout_ms.',
        'if time.ticks_diff(time.ticks_ms(), start) > timeout_ms:\n    return False'
      ],
      validationTests: [
        { name: 'Router αναμμένος → «WiFi OK»', script: [
          { setup: true },
          { check: 'wifiConnected', is: true, fail: 'Με αναμμένο router η πλακέτα δεν συνδέθηκε.' },
          { check: 'serialHas', text: 'WiFi OK: 192.168.1.42', fail: 'Το Τερματικό δεν έγραψε «WiFi OK: 192.168.1.42». Τελευταίες γραμμές: {v}.' }
        ] },
        { name: 'Router σβηστός → σταματά να περιμένει', world: { router: false }, script: [
          { setup: true },
          { check: 'lastLine', is: 'WiFi failed, status: 201', fail: 'Με σβηστό router η τελευταία γραμμή είναι {v}. Περίμενα «WiFi failed, status: 201» μετά το όριο χρόνου.' }
        ] }
      ],
      explanationOnSuccess: 'Τώρα η πλακέτα δεν κολλάει ποτέ στο WiFi. Το 201 είναι το network.STAT_NO_AP_FOUND: «δεν βρέθηκε το δίκτυο».',
      remediation: 'Αν ο έλεγχος «κρατά υπερβολικά πολύ», η αναμονή δεν σταματά ποτέ: έλεγξε τη σύγκριση με το timeout_ms και το return False.'
    }),

    Object.assign({}, BASE, {
      id: 'c33-l3', kind: 'variant', skills: ['micropython', 'network', 'conditions'],
      title: 'Παραλλαγή: τι λέει το status();',
      prerequisites: ['c33-l2'],
      objectives: ['Να ξεχωρίζω λάθος κωδικό από δίκτυο που λείπει.', 'Να μετατρέπω έναν κωδικό κατάστασης σε καθαρό μήνυμα.'],
      theory: `
<p>Όταν η σύνδεση αποτύχει, το <code>wlan.status()</code> λέει <strong>γιατί</strong>:</p>
<ul>
  <li><code>network.STAT_GOT_IP</code> (1010) → συνδέθηκε</li>
  <li><code>network.STAT_WRONG_PASSWORD</code> (202) → λάθος κωδικός</li>
  <li><code>network.STAT_NO_AP_FOUND</code> (201) → δεν βρέθηκε δίκτυο (router σβηστός ή λάθος όνομα)</li>
  <li><code>network.STAT_CONNECTING</code> (1001) → ακόμα προσπαθεί</li>
</ul>
<p>Σύγκρινε με τα <strong>ονόματα</strong>, όχι με τους αριθμούς. Το <code>status == network.STAT_WRONG_PASSWORD</code> διαβάζεται πιο εύκολα από το <code>status == 202</code>.</p>
<p>Ένα καθαρό μήνυμα βοηθά όποιον στήνει τη συσκευή: «Wrong password» λέει αμέσως τι να διορθώσει.</p>`,
      glossary: ['wlan.status()', 'elif', 'κωδικός WiFi'],
      supportedSyntax: SYNTAX,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: WORLD, initialWorld: { router: true },
      hardware: ['router'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Πρόσθεσε δύο elif στη συνάρτηση explain.',
        'Τρέξε με τον router σβηστό. Τι γράφει;',
        'Πάτησε «Έλεγχος λύσης». Ένας έλεγχος δοκιμάζει router με άλλο κωδικό από το config.'
      ],
      quiz: {
        question: 'Το όνομα του WiFi στο config έχει ορθογραφικό λάθος. Ποιο status θα δεις;',
        options: ['STAT_NO_AP_FOUND (201)', 'STAT_WRONG_PASSWORD (202)', 'STAT_GOT_IP (1010)'],
        answer: 0,
        explain: 'Σωστά. Η πλακέτα ψάχνει δίκτυο με αυτό το όνομα και δεν το βρίσκει, όπως όταν ο router είναι σβηστός.',
        retry: 'Όχι ακόμα. Με λάθος όνομα, η πλακέτα βρίσκει το δίκτυο για να δοκιμάσει κωδικό;'
      },
      hints: [
        'Χρειάζεσαι δύο ακόμα σκέλη, ένα για κάθε σταθερά.',
        'elif status == network.STAT_WRONG_PASSWORD: return "Wrong password" — και το ίδιο για STAT_NO_AP_FOUND.',
        'elif status == network.STAT_WRONG_PASSWORD:\n    return "Wrong password"\nelif status == network.STAT_NO_AP_FOUND:\n    return "Network not found"'
      ],
      validationTests: [
        { name: 'Όλα σωστά → «WiFi: Connected»', script: [
          { setup: true },
          { check: 'lastLine', is: 'WiFi: Connected', fail: 'Με σωστά στοιχεία η τελευταία γραμμή είναι {v}. Περίμενα «WiFi: Connected».' }
        ] },
        { name: 'Ο router έχει άλλο κωδικό → «WiFi: Wrong password»', world: { wifiPass: 'new-router-pass-77' }, script: [
          { setup: true },
          { check: 'lastLine', is: 'WiFi: Wrong password', fail: 'Με λάθος κωδικό η τελευταία γραμμή είναι {v}. Περίμενα «WiFi: Wrong password».' },
          PASS_HIDDEN
        ] },
        { name: 'Router σβηστός → «WiFi: Network not found»', world: { router: false }, script: [
          { setup: true },
          { check: 'lastLine', is: 'WiFi: Network not found', fail: 'Με σβηστό router η τελευταία γραμμή είναι {v}. Περίμενα «WiFi: Network not found».' }
        ] }
      ],
      explanationOnSuccess: 'Η πλακέτα λέει καθαρά τι πήγε στραβά. Πρόσεξε: λέει «Wrong password», αλλά δεν τυπώνει ποτέ τον ίδιο τον κωδικό.',
      remediation: 'Αν βλέπεις «WiFi: Error 202», λείπει το σκέλος για STAT_WRONG_PASSWORD. Το 201 είναι το STAT_NO_AP_FOUND.'
    }),

    Object.assign({}, BASE, {
      id: 'c33-l4', kind: 'debug', skills: ['micropython', 'network', 'security'],
      title: 'Βρες το λάθος: OSError και κωδικός στο τερματικό',
      prerequisites: ['c33-l3'],
      objectives: ['Να διαβάζω ένα OSError του WiFi.', 'Να μην τυπώνω ποτέ μυστικά.'],
      theory: `
<p>Δύο παράπονα:</p>
<ol>
  <li>«Η πλακέτα σταματά με <code>OSError</code> πριν καν συνδεθεί.»</li>
  <li>«Κάποιος είδε τον κωδικό του WiFi στο τερματικό, στο εργαστήριο.»</li>
</ol>
<p>Θυμήσου τα βήματα: <code>WLAN(…)</code>, <strong><code>active(True)</code></strong>, <code>connect(…)</code>. Χωρίς ενεργό WiFi, το <code>connect</code> αποτυγχάνει.</p>
<p>Το τερματικό <strong>δεν</strong> είναι ιδιωτικό. Το βλέπει όποιος είναι δίπλα, μπαίνει σε φωτογραφίες και σε logs. Τύπωσε το όνομα του δικτύου αν θέλεις, ποτέ τον κωδικό.</p>`,
      glossary: ['network.WLAN', 'μυστικό (secret)', 'redaction', 'OSError'],
      supportedSyntax: SYNTAX,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: WORLD, initialWorld: { router: true },
      hardware: ['router'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Τρέξε. Διάβασε το μήνυμα λάθους και τη γραμμή του.',
        'Πρόσθεσε τη γραμμή που λείπει πριν από το connect.',
        'Άλλαξε το print ώστε να μη δείχνει τον κωδικό.',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ποιο print είναι ασφαλές;',
        options: ['print("Connecting to", config.WIFI_SSID)', 'print("Key:", config.WIFI_PASS)', 'print(config.WIFI_SSID, config.WIFI_PASS)'],
        answer: 0,
        explain: 'Σωστά. Το όνομα του δικτύου φαίνεται έτσι κι αλλιώς σε κάθε κινητό. Ο κωδικός πρέπει να μένει μυστικός.',
        retry: 'Όχι ακόμα. Ποιο από αυτά δεν περιέχει τον κωδικό;'
      },
      hints: [
        'Το ένα λάθος είναι μια γραμμή που λείπει. Το άλλο είναι ένα print που λέει πάρα πολλά.',
        'Πριν από το wlan.connect χρειάζεται wlan.active(True). Από το print βγάλε το config.WIFI_PASS.',
        'wlan = network.WLAN(network.STA_IF)\nwlan.active(True)\nprint("Connecting to", config.WIFI_SSID)\nwlan.connect(config.WIFI_SSID, config.WIFI_PASS)'
      ],
      validationTests: [
        { name: 'Η πλακέτα συνδέεται', script: [
          { setup: true },
          { check: 'wifiConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε στο WiFi.' },
          { check: 'serialHas', text: 'IP: 192.168.1.42', fail: 'Το Τερματικό δεν έγραψε την IP. Τελευταίες γραμμές: {v}.' }
        ] },
        { name: 'Ο κωδικός δεν εμφανίζεται', script: [{ setup: true }, PASS_HIDDEN, PASS_NOT_IN_CODE] }
      ],
      explanationOnSuccess: 'Δύο διορθώσεις: το WiFi ανάβει πριν από τη σύνδεση, και ο κωδικός δεν βγαίνει ποτέ στο τερματικό. Τα logs και οι οθόνες «μιλάνε» περισσότερο απ’ όσο νομίζουμε.',
      remediation: 'Αν δεις ακόμα OSError, έλεγξε ότι το wlan.active(True) είναι πριν από το wlan.connect και όχι μετά.'
    }),

    Object.assign({}, BASE, {
      id: 'c33-l5', kind: 'checkpoint', skills: ['micropython', 'network', 'state', 'security'],
      title: 'Έλεγχος κεφαλαίου: επανασύνδεση στο WiFi',
      prerequisites: ['c33-l4'],
      objectives: ['Να ελέγχω τη σύνδεση μέσα στον κύριο βρόχο.', 'Να ξανασυνδέομαι με όριο χρόνου.', 'Να δείχνω την κατάσταση με το LED.'],
      theory: `
<p>Το WiFi πέφτει: ο router κάνει restart, κόβεται το ρεύμα. Μια καλή συσκευή <strong>ξανασυνδέεται μόνη της</strong>.</p>
<p>Στον κύριο βρόχο, κάθε 5 δευτερόλεπτα:</p>
<ol>
  <li>Αν <code>not wlan.isconnected()</code>: LED σβηστό και <code>print("WiFi lost, reconnecting")</code>.</li>
  <li><code>wlan.disconnect()</code> και μετά <code>connect_wifi()</code> (με όριο χρόνου).</li>
  <li>Αν πετύχει: <code>print("Reconnected")</code> και LED αναμμένο.</li>
  <li>Αν όχι: θα ξαναδοκιμάσει στον επόμενο γύρο.</li>
</ol>
<p>Σε αληθινό ESP32 η MicroPython μερικές φορές ξανασυνδέεται και μόνη της. Μη βασίζεσαι σε αυτό: έλεγχε εσύ.</p>
<p>Και πάντα: <strong>κανένας κωδικός</strong> στο τερματικό.</p>`,
      glossary: ['επανασύνδεση', 'timeout', 'network.WLAN', 'κατάσταση (state)'],
      supportedSyntax: SYNTAX + ', from machine import Pin',
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: WORLD, initialWorld: { router: true },
      hardware: ['router', 'led'], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Γράψε τον έλεγχο μέσα στο while True.',
        'Τρέξε. Σβήσε τον router για λίγο και ξανάναψέ τον.',
        'Δες στο Τερματικό: «WiFi lost» και μετά «Reconnected».',
        'Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ο router είναι σβηστός για 1 λεπτό. Τι κάνει το σωστό πρόγραμμα;',
        options: ['Δοκιμάζει ξανά σε κάθε γύρο, και συνδέεται όταν ο router ανάψει', 'Σταματά με σφάλμα', 'Περιμένει για πάντα στην πρώτη προσπάθεια'],
        answer: 0,
        explain: 'Σωστά. Κάθε προσπάθεια έχει όριο χρόνου, οπότε ο βρόχος συνεχίζει και ξαναδοκιμάζει.',
        retry: 'Όχι ακόμα. Το connect_wifi έχει όριο χρόνου. Τι γίνεται μετά από κάθε αποτυχία;'
      },
      hints: [
        'Όλα γίνονται μέσα στο while True, πριν από το time.sleep(5).',
        'if not wlan.isconnected(): → led.off(), print, wlan.disconnect(), και if connect_wifi(): → print("Reconnected"), led.on().',
        'while True:\n    if not wlan.isconnected():\n        led.off()\n        print("WiFi lost, reconnecting")\n        wlan.disconnect()\n        if connect_wifi():\n            print("Reconnected")\n            led.on()\n    time.sleep(5)'
      ],
      validationTests: [
        { name: 'Στην αρχή: συνδεδεμένη, LED αναμμένο', script: [
          { setup: true }, { loops: 1 },
          { check: 'wifiConnected', is: true, fail: 'Η πλακέτα δεν συνδέθηκε στην αρχή.' },
          { check: 'led', is: true, fail: 'Με σύνδεση το LED είναι {v}.' }
        ] },
        { name: 'Πέφτει το WiFi → LED σβηστό, νέα προσπάθεια', script: [
          { setup: true }, { loops: 1 }, { router: false }, { loops: 1 },
          { check: 'serialHas', text: 'WiFi lost, reconnecting', fail: 'Μετά την πτώση του router δεν τυπώθηκε «WiFi lost, reconnecting». Τελευταίες γραμμές: {v}.' },
          { check: 'led', is: false, fail: 'Χωρίς WiFi το LED είναι {v}. Πρέπει να σβήνει.' }
        ] },
        { name: 'Ο router επιστρέφει → «Reconnected»', script: [
          { setup: true }, { loops: 1 }, { router: false }, { loops: 2 }, { router: true }, { loops: 2 },
          { check: 'wifiConnected', is: true, fail: 'Ο router ξανάναψε, αλλά η πλακέτα δεν ξανασυνδέθηκε.' },
          { check: 'serialHas', text: 'Reconnected', fail: 'Δεν τυπώθηκε «Reconnected». Τελευταίες γραμμές: {v}.' },
          { check: 'led', is: true, fail: 'Μετά την επανασύνδεση το LED είναι {v}.' },
          { check: 'wifiAttempts', min: 3, fail: 'Έγιναν μόνο {n} προσπάθειες σύνδεσης. Ξαναδοκίμαζε σε κάθε γύρο χωρίς WiFi.' },
          PASS_HIDDEN
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο! Η πλακέτα συνδέεται, ξέρει γιατί αποτυγχάνει, ξανασυνδέεται και κρατά τον κωδικό μυστικό. Στο επόμενο κεφάλαιο θα στείλει μετρήσεις με MQTT.',
      remediation: 'Αν η πλακέτα δεν ξανασυνδέεται, έλεγξε ότι καλείς connect_wifi() μέσα στο if not wlan.isconnected().'
    })
  );
})(typeof window !== 'undefined' ? window : globalThis);
