# Οδηγός συγγραφής μαθημάτων — IoT Guardian

Αυτός ο οδηγός περιγράφει πώς γράφεται ένα κεφάλαιο. Διάβασε πρώτα το `js/lessons.js` (κεφάλαια 1–3): είναι το πρότυπο για ύφος, μέγεθος και δομή.

## Βασικές αρχές (υποχρεωτικές)

1. **Κοινό:** Έλληνες μαθητές που ξεκίνησαν από το μηδέν. Κατάλληλο και για δυσλεξία: μικρές προτάσεις, μία νέα έννοια ανά μικρομάθημα, καθαρή δομή, κανένα «τουβλάκι» κειμένου. Όλο το εκπαιδευτικό κείμενο στα ελληνικά. Ονόματα εντολών, topics και μηνύματα Serial στα αγγλικά.
2. **Μόνο αμυντική ασφάλεια.** Ο μαθητής ρυθμίζει, ελέγχει και διορθώνει το **δικό του εικονικό σύστημα**. Δεν υπάρχει «hacker», δεν υπάρχουν οδηγίες επίθεσης, σάρωσης, μαντέματος κωδικών ή υποκλοπής. Τα περιστατικά είναι προεγγεγραμμένα συνθετικά σενάρια για αμυντική ανάλυση. Οι άγνωστοι clients λέγονται «άγνωστη συσκευή» (`unknown-device`), όχι «επιτιθέμενος».
3. **Ειλικρινής προσομοίωση.** Όλα είναι συνθετικά. Μην ισχυρίζεσαι ότι το εικονικό TLS είναι πραγματική κρυπτογράφηση ή ότι το audit αποδεικνύει πραγματική ασφάλεια.
4. **Έλεγχος με συμπεριφορά**, όχι με σύγκριση κειμένου. Μόνη εξαίρεση: ο έλεγχος `sourceNot` για hardcoded μυστικά, πάντα μαζί με ελέγχους συμπεριφοράς.
5. **Μηνύματα αποτυχίας** (`fail`) στα ελληνικά: τι παρατηρήθηκε και ένα επόμενο βήμα. Ποτέ σκέτο «λάθος».

## Πού γράφεις

Κάθε ομάδα κεφαλαίων γράφεται σε **δικό της αρχείο** `js/lessons/chN.js` (π.χ. `ch04.js`). Μην αλλάζεις άλλα αρχεία.

```js
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 4).ready = true;
  L.GLOSSARY.push({ term: 'millis', def: '…' });   // μόνο όροι που δεν υπάρχουν ήδη
  L.lessons.push(
    { id: 'c4-l1', chapter: 4, … },
    { id: 'c4-l2', chapter: 4, … }
  );
})(typeof window !== 'undefined' ? window : globalThis);
```

- `id`: `cN-lM`, με σειρά. Το πρώτο μάθημα κάθε κεφαλαίου έχει `prerequisites: []` (το κεφάλαιο ξεκλειδώνει όταν τελειώσει το προηγούμενο). Τα επόμενα έχουν `prerequisites: ['cN-l(M-1)']`.
- Κάθε κεφάλαιο: **τουλάχιστον 3 μαθήματα**, ανάμεσά τους **ένα `guided`**, **ένα `variant` ή `independent`**, και **ένα `debug` ή `checkpoint`**. Το τελευταίο του κεφαλαίου είναι `checkpoint`.
- `kind`: `micro`, `guided`, `variant`, `independent`, `debug`, `checkpoint`.
- `skills`: από `order`, `setuploop`, `syntax`, `variables`, `io`, `conditions`, `state` και τα νέα: `timing`, `sensors`, `network`, `mqtt`, `analysis`, `security`. Χρησιμοποίησε μόνο αυτά.

## Κοινά πεδία κάθε μαθήματος

`id, chapter, kind, skills, title, prerequisites, objectives[], theory (HTML), glossary[], supportedSyntax, steps[], quiz{question, options[], answer, explain, retry}, hints[3], explanationOnSuccess, remediation`

- `hints`: ακριβώς 3. (1) υπενθύμιση έννοιας, (2) πού να κοιτάξεις, (3) λυμένο παράδειγμα με εξήγηση (μπορεί να έχει `\n`).
- `quiz`: υποχρεωτικό. Πρόβλεψη πριν την εκτέλεση ή ερώτηση κατανόησης.
- Μικρό `theory`: 3–8 σύντομες παράγραφοι/λίστες. Χρησιμοποίησε `<p>`, `<ul>`, `<ol>`, `<code>`, `<pre>`, `<strong>`.

## Τρεις τύποι μαθημάτων (`mode`)

### 1. `mode: 'code'` (προεπιλογή) — ο μαθητής γράφει κώδικα για την πλακέτα

Πεδία: `initialCode`, `solution`, `world`, `validationTests`, προαιρετικά `initialPasses: true` (μόνο αν ο αρχικός κώδικας είναι ήδη σωστός, για μικρομάθημα παρατήρησης), `hardware`, `panels`.

**Ο αρχικός κώδικας πρέπει να αποτυγχάνει σε τουλάχιστον ένα test και η λύση να περνά όλα.** Τα tests το ελέγχουν αυτόματα. Χρησιμοποίησε κενά `____` για καθοδηγούμενες ασκήσεις.

`world` (κόσμος της άσκησης):

```js
world: {
  button: false, pir: false,            // αρχική κατάσταση εισόδων
  temp: 22.5, humidity: 45,             // αισθητήρας (float)
  sensorFault: false,                   // true → readTemperature() δίνει nan
  router: true,                         // false → το WiFi δεν είναι διαθέσιμο
  wifi: 'connected',                    // παράλειψη → η πλακέτα ξεκινά χωρίς WiFi
  broker: 'listener 1883\nallow_anonymous true\n',   // ρυθμίσεις broker (βλ. πιο κάτω)
  cert: 'valid',                        // valid | expired | wrong-host | untrusted
  clients: [ { name: 'dashboard', subs: ['home/#'], user: 'dashboard', pass: '…', port: 8883, tls: true } ],
  consts: { MQTT_USER: 'esp32-pir', MQTT_PASS: '…' }  // σταθερές «από ξεχωριστό αρχείο ρυθμίσεων»
}
```

`hardware`: ποια χειριστήρια δείχνει η πλακέτα. Από `button`, `pir`, `sensor` (θερμοκρασία/υγρασία/σφάλμα), `router` (WiFi on/off), `broker` (επανεκκίνηση broker). Προεπιλογή: `['button', 'pir']`.

`panels`: ποια πάνελ εξόδου φαίνονται. Από `serial`, `vars`, `branch`, `loops`, `mqtt` (μηνύματα + dashboard), `net` (Network Monitor), `logs` (log του broker). Προεπιλογή: `serial, vars, branch, loops` και επιπλέον `mqtt, net` όταν υπάρχει `world.broker`.

#### Υποστηριζόμενη γλώσσα (εκπαιδευτικό υποσύνολο Arduino C++)

Τύποι `int, long, unsigned long, bool, float, double, String, const`. Τελεστές `= += -= *= /= + - * / % == != < > <= >= && || ! ++ --`. `if/else, for, while, return`, δικές σου συναρτήσεις με παραμέτρους. Global μεταβλητές θυμούνται τιμή ανάμεσα στις επαναλήψεις. **Δεν** υπάρχουν: `switch`, `break`, `continue`, πίνακες, `char`, μέθοδοι σε String (`s.length()`), `String(x)`. Για μετατροπή σε κείμενο: `"" + x` (float τυπώνεται με 2 δεκαδικά, π.χ. `22.50`, και `nan` αν είναι NaN). String σύγκριση με `==` δουλεύει.

Εντολές:

| Εντολή | Τι κάνει |
|---|---|
| `pinMode, digitalWrite, digitalRead, delay, millis` | όπως στο Arduino |
| `Serial.begin(115200), Serial.print(x), Serial.println(x)` | Serial Monitor |
| `abs(x), min(a,b), max(a,b), isnan(f), toInt(s), toFloat(s)` | βοηθητικές |
| `readTemperature(), readHumidity()` | float από τον εικονικό αισθητήρα· `nan` όταν `sensorFault` |
| `WiFi.begin(WIFI_SSID, WIFI_PASSWORD)` | ξεκινά σύνδεση· πετυχαίνει μετά από 1200 ms εικονικού χρόνου. Με router κάτω ή λάθος SSID → `WL_NO_SSID_AVAIL` μετά από 3000 ms. Λάθος κωδικός → `WL_CONNECT_FAILED` |
| `WiFi.status()` | `WL_IDLE_STATUS 0, WL_NO_SSID_AVAIL 1, WL_CONNECTED 3, WL_CONNECT_FAILED 4, WL_DISCONNECTED 6`. Αν πέσει το router → `WL_DISCONNECTED`. **Δεν** ξανασυνδέεται μόνο του. |
| `WiFi.reconnect()` | ξαναδοκιμάζει με τα τελευταία στοιχεία (ίδιοι χρόνοι με begin) |
| `WiFi.localIP()` | `"192.168.1.42"` ή `"0.0.0.0"` |
| `mqtt.setServer(MQTT_HOST, 1883)` | `MQTT_HOST` = `"broker.home.lan"` |
| `mqtt.setCACert(HOME_CA)` | ενεργοποιεί TLS **με** έλεγχο πιστοποιητικού (CA, hostname, ημερομηνία) |
| `mqtt.setInsecure()` | TLS **χωρίς** έλεγχο (κακή πρακτική — βγάζει προειδοποίηση) |
| `mqtt.connect(id)` / `mqtt.connect(id, user, pass)` | bool. Χρειάζεται WiFi συνδεδεμένο. Κοστίζει 30 ms |
| `mqtt.connected()` | bool |
| `mqtt.publish(topic, payload)` / `(topic, payload, retained)` | bool (false αν δεν υπάρχει σύνδεση ή το ACL απαγορεύει) |
| `mqtt.subscribe(filter)` | bool· παραδίδει αμέσως τα retained |
| `mqtt.read()` | φέρνει το επόμενο εισερχόμενο μήνυμα· `false` αν δεν υπάρχει. Μοτίβο: `while (mqtt.read()) { String t = mqtt.topic(); String p = mqtt.payload(); … }` |
| `mqtt.topic(), mqtt.payload()` | του μηνύματος που διαβάστηκε |
| `mqtt.disconnect()` | |
| `jsonValid(s), jsonHas(s, key), jsonGet(s, key)` | εκπαιδευτικοί βοηθοί JSON. `jsonGet` επιστρέφει String (`""` αν λείπει). Αριθμοί ως κείμενο: `toInt(jsonGet(p, "id"))` |

Σταθερές: `HIGH, LOW, INPUT, OUTPUT, LED_PIN (2), BUTTON_PIN (15), PIR_PIN (4), WIFI_SSID ("SmartHome-Lab"), WIFI_PASSWORD ("lab-pass-123"), MQTT_HOST, HOME_CA ("Home Lab CA")`, συν ό,τι ορίσεις στο `world.consts`.

Κάθε statement κοστίζει 2 µs εικονικού χρόνου. Το `delay(n)` προχωρά το ρολόι n ms. Ένα loop χωρίς delay κρατά λίγα µs.

### Ενέργεια και ύπνος (Κεφάλαιο 16)

| Εντολή | Τι κάνει |
|---|---|
| `WiFi.mode(WIFI_OFF)` / `WiFi.mode(WIFI_STA)` | σβήνει / ανάβει το ραδιόφωνο |
| `esp_sleep_enable_timer_wakeup(µs)` | ξύπνημα από χρονόμετρο (σε µs!) |
| `esp_sleep_enable_ext0_wakeup(PIR_PIN, HIGH)` | ξύπνημα από pin (PIR_PIN ή BUTTON_PIN) |
| `esp_light_sleep_start()` | ύπνος· μετά συνεχίζει από την επόμενη γραμμή, η μνήμη μένει |
| `esp_deep_sleep_start()` | ύπνος· μετά επανεκκίνηση (globals, setup). Κρατιούνται μόνο οι `RTC_DATA_ATTR` |
| `esp_sleep_get_wakeup_cause()` | `ESP_SLEEP_WAKEUP_UNDEFINED 0`, `EXT0 2`, `TIMER 4` |

Ρεύμα: WiFi 120 mA, ξύπνιο 40 mA, light 0,8 mA, deep 0,01 mA. Ο ύπνος κλείνει το WiFi και το MQTT. Ύπνος χωρίς πηγή αφύπνισης = σφάλμα. Πάνελ: `energy`. Έλεγχοι: `avgCurrent {max, min}` (v = mA), `sleepShare {mode: 'light'|'deep'|'any', min}` (v = %), `boots {min, max}`, `wakeups {cause, mode, min, max}`. Το `{ ms }` σταματά στην προθεσμία και όταν η πλακέτα κοιμάται ή περιμένει μέσα στο `setup()`.

#### Βήματα ελέγχων (`validationTests[].script`)

```js
{ setup: true }                          // πάντα πρώτο
{ loops: 3 }                             // 3 επαναλήψεις loop()
{ ms: 2000 }                             // επαναλήψεις μέχρι να περάσουν 2000 ms εικονικού χρόνου
{ set: { button: true } }                // ή pir, temp: 31.5, humidity, sensorFault: true
{ sequence: { pir: [0, 0, 1, 1, 0] } }   // για κάθε τιμή: αλλαγή + 1 loop (και για temp: [25, 31, 29])
{ router: false }                        // πέφτει το WiFi (true για επαναφορά)
{ restartBroker: true }                  // ο broker κάνει restart· όλοι αποσυνδέονται, τα retained μένουν
{ dash: { topic: 'home/led/set', payload: '{"cmd":"ON"}', retain: false } }  // το dashboard στέλνει
{ act: { publish: 'esp32-temp', topic: 'home/temperature', payload: '21' } } // άλλος client (πρέπει να έχει συνδεθεί με act: {connect: …})
{ redeliver: true }                      // ο broker ξαναστέλνει στη συσκευή το τελευταίο μήνυμα (διπλή παράδοση)
```

Έλεγχοι (`{ check: '…', …, fail: 'μήνυμα με {n} ή {v}' }`):

| check | πεδία | `{n}` / `{v}` |
|---|---|---|
| `led` | `is: true/false` | v = αναμμένο/σβηστό |
| `ledOutput` | | v |
| `count` | `text`, `is` ή `min`/`max` (ακριβές ταίριασμα γραμμής) | n |
| `total` | `is` (όλες οι γραμμές Serial) | n |
| `lines` | `is: ['a', 'b']` | v |
| `order` | `texts: [...]` | v |
| `lastLine` | `is` / `not` / `notEmpty` | v |
| `serialHas` | `text` (περιέχεται σε κάποια γραμμή) | v |
| `serialNot` | `text` (σε καμία γραμμή) | |
| `published` | `topic`, `is` ή `min`/`max`, προαιρετικά `json: {k: v}` ή `payload` (επιτυχημένα publish της συσκευής) | n, v |
| `dashboard` | `topic`, `json`/`payload` ή `exists: false` (τελευταία τιμή που είδε το dashboard) | v |
| `retained` | `topic`, `exists` | v |
| `wifiAttempts` | `min`/`max` (begin + reconnect) | n |
| `wifiConnected` | `is` | |
| `mqttConnected` | `is` | v = τελευταίο σφάλμα |
| `mqttAttempts` | `min`/`max` | n |
| `deviceEncrypted` | (κανένα πακέτο MQTT σε καθαρό κείμενο από τη συσκευή, τουλάχιστον ένα TLS) | n |
| `tlsMode` | `is: 'verify' | 'insecure' | 'none'` | v |
| `sourceNot` | `text` (ο κώδικας δεν περιέχει αυτό το κείμενο) | |

`failZero`: εναλλακτικό μήνυμα όταν n = 0. Κάθε test μπορεί να έχει δικό του `world` με εισόδους που υπερισχύουν (π.χ. `world: { pir: true }`) και δικό του πιστοποιητικό (`world: { cert: 'expired' }`), και στα config tests. Ο κόσμος βάσης (broker κ.λπ.) έρχεται από το `world` του μαθήματος.

**Το dashboard** (`world.clients` με `name: 'dashboard'`) συνδέεται αυτόματα, κάνει subscribe στα `subs` και ξανασυνδέεται μόνο του μετά από restart. Για να στείλει μήνυμα σε test, το βήμα `dash` χρειάζεται να έχει τρέξει πρώτα `setup`.

### 2. `mode: 'config'` — ο μαθητής γράφει ρυθμίσεις broker

Ο editor περιέχει ρυθμίσεις, όχι κώδικα. Πεδία: `initialCode` (αρχικές ρυθμίσεις), `solution`, `validationTests`, `world: { cert }` (προαιρετικό).

Σύνταξη ρυθμίσεων (εκπαιδευτικό υποσύνολο τύπου mosquitto· σχόλιο μόνο γραμμή που ξεκινά με `#`):

```
listener 8883          # νέα θύρα
tls on                 # TLS για την τελευταία listener
allow_anonymous false
password esp32-pir Pir-Lab-Key-0427     # εκπαιδευτική απλοποίηση: στο mosquitto οι κωδικοί αποθηκεύονται hashed
acl_default deny       # προαιρετικό· αν υπάρχουν κανόνες topic, το default είναι ήδη deny
user esp32-pir         # οι κανόνες από κάτω αφορούν αυτόν τον χρήστη
topic write home/motion
topic read home/led/set
```

Οι κωδικοί είναι **φανταστικοί**. Κάτω από 12 χαρακτήρες βγάζουν προειδοποίηση. Πολύ ευρείς κανόνες (`topic readwrite #`, `topic write home/#`) βγάζουν προειδοποίηση.

Βήματα ελέγχου (κάθε βήμα με `expect` ελέγχεται αμέσως):

```js
{ connect: 'esp32-pir', user: 'esp32-pir', pass: 'Pir-Lab-Key-0427', port: 8883, tls: true, expect: 'allow', fail: 'Η σύνδεση του esp32-pir απορρίφθηκε: {v}' }
{ connect: 'unknown-device', port: 8883, tls: true, expect: 'deny', fail: 'Μια συσκευή χωρίς στοιχεία συνδέθηκε κανονικά.' }
{ publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion":true}', expect: 'allow', fail: '…' }
{ subscribe: 'dashboard', topic: 'home/#', expect: 'allow', fail: '…' }
```

Ονόματα clients με γνωστές IP: `esp32-pir`, `esp32-temp`, `esp32-lamp`, `dashboard`, `unknown-device`. Το `tls: true` σημαίνει ότι ο client μιλά TLS και ελέγχει το πιστοποιητικό με CA `Home Lab CA` και host `broker.home.lan`.

### 3. `mode: 'analysis'` — ο μαθητής αναλύει συνθετική καταγραφή

Δεν υπάρχει editor. Ο μαθητής φιλτράρει τον Network Monitor ή το log του broker, **επιλέγει τις γραμμές-τεκμήρια** και απαντά στο quiz. Πεδία:

```js
mode: 'analysis',
panels: ['net'],               // ή ['logs'] ή ['net', 'logs']
capture: {
  broker: 'listener 1883\nallow_anonymous true\n',
  cert: 'valid',
  scenario: [
    { connect: 'esp32-temp', port: 1883 },
    { wait: 1000 },
    { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":21.40}' },
    { subscribe: 'dashboard', topic: 'home/#' },
    { restart: true }, { disconnect: 'esp32-temp' }
  ]
},
evidence: { filter: 'ip.src == 192.168.1.43 && mqtt.topic == "home/temperature"' },  // ή { log: 'not authorised' }
evidenceHint: 'Επίλεξε όλα τα πακέτα όπου η συσκευή θερμοκρασίας στέλνει μέτρηση.'
```

Ο έλεγχος περνά όταν ο μαθητής έχει επιλέξει **ακριβώς** τα πακέτα που ταιριάζουν στο `evidence.filter` (ή τις γραμμές log που περιέχουν το `evidence.log`) **και** έχει απαντήσει σωστά στο quiz. Τα tests ελέγχουν ότι το φίλτρο ταιριάζει σε τουλάχιστον 1 πακέτο αλλά όχι σε όλα. Κάθε βήμα σεναρίου προχωρά τον χρόνο 3 ms· το `wait` προσθέτει χρόνο.

Φίλτρα Network Monitor (υποσύνολο): `mqtt`, `tls`, `tcp`, `tcp.port == N`, `ip.src == Δ`, `ip.dst == Δ`, `ip.addr == Δ`, `mqtt.topic == "…"`, ενωμένα με `&&`, και `!=`.

IP: broker (Raspberry Pi) `192.168.1.10`, ESP32 της άσκησης / esp32-pir `192.168.1.42`, esp32-temp `.43`, esp32-lamp `.44`, dashboard `.20`, unknown-device `.77`.

Τα πακέτα δημιουργούνται από τον ίδιο τον broker: CONNECT/CONNACK, PUBLISH, SUBSCRIBE/SUBACK, και σε TLS: Client Hello, Server Hello + Certificate, Application Data, Alert. Το log του broker έχει γραμμές τύπου mosquitto, π.χ. `New client connected from … as …`, `Client X from … disconnected, not authorised.`, `Denied PUBLISH from …`, `Denied SUBSCRIBE from …`.

## Έλεγχος της δουλειάς σου

```bash
node tests/run-tests.js --only c4
```

Τρέχει τα tests μόνο για τα μαθήματα `c4-*`, συν τους γενικούς ελέγχους. Πρέπει να περνούν όλα.

## Μέρος Β: Raspberry Pi και Python (Κεφάλαια 17–20)

Τα μαθήματα Python έχουν `lang: 'python'` και `mode: 'code'` (προεπιλογή). Ο μαθητής γράφει πρόγραμμα Python που τρέχει στο **εικονικό Raspberry Pi** (`192.168.1.10`). Στο ίδιο Pi τρέχει και ο broker του σπιτιού. Τα ESP32 του σπιτιού είναι εικονικοί clients που στέλνουν μετρήσεις.

```js
L.CHAPTERS.push({ n: 17, title: 'Python στο Raspberry Pi: τα βασικά', ready: true, unlockAfter: 7, lang: 'python' });
```

Ξεκλείδωμα: το 17 με `unlockAfter: 7`, το 18 με `unlockAfter: 17`, το 19 με `unlockAfter: 18`, το 20 με `unlockAfter: 19`. Νέες δεξιότητες: `python`, `automation` (υπάρχουν ήδη στο `SKILLS`).

### Πώς τρέχει ένα πρόγραμμα Python

Δεν υπάρχουν `setup()`/`loop()`. Το πρόγραμμα τρέχει από πάνω προς τα κάτω και **μπορεί να τελειώσει**.

- Ο **κύριος βρόχος** είναι το πρώτο `while True:` που εκτελείται (σε οποιοδήποτε επίπεδο, και μέσα σε `def main():`). Κάθε γύρος του είναι μία «επανάληψη» για τα `{ loops: n }` και για τον πίνακα «Επαναλήψεις».
- Το `client.loop_forever()` και το `pause()` είναι επίσης κύριος βρόχος: κάθε 50 ms εικονικού χρόνου είναι ένας γύρος. Με αυτά χρησιμοποίησε `{ ms: … }`, όχι `{ loops: … }`.
- `{ setup: true }`: τρέχει μέχρι την αρχή του κύριου βρόχου ή μέχρι να τελειώσει το πρόγραμμα. Για πρόγραμμα χωρίς βρόχο, το `{ setup: true }` αρκεί για να τρέξει όλο.
- Κάθε εντολή κοστίζει 2 µs. Το `time.sleep(s)` προχωρά το ρολόι. Στο μεταξύ τρέχουν τα «παρασκήνια»: callbacks του gpiozero, του paho με `loop_start()`, το `led.blink()`.
- Βρόχος με 20.000 εντολές χωρίς αναμονή → σφάλμα (ατέρμονος βρόχος).

### Υποστηριζόμενη Python

`int, float, str, bool, None, list, dict, tuple, bytes`. Τελεστές `+ - * / // % **`, συγκρίσεις (και αλυσίδες `0 < x < 10`), `and or not in not in is is not`, `x if c else y`. `if/elif/else`, `while`, `for x in …` (λίστα, `range`, κείμενο, λεξικό, `.items()`), `break`, `continue`, `pass`, `def` με προεπιλεγμένες τιμές και `return`, `global`, `try/except/else/finally` (με `as e`), `raise`, list comprehension `[x for x in xs if …]`, f-strings με μορφοποίηση (`{t:.1f}`, `{n:3d}`, `{x:>6}`, `{p:.0%}`), slicing `a[1:3]`, `a[-3:]`.

**Δεν** υπάρχουν: `class`, `lambda`, `with`, `*args`, αρχεία (`open`), `input()`, τριπλά εισαγωγικά.

Ενσωματωμένα: `print(…, sep=, end=)`, `len, range, int, float, str, bool, list, dict, tuple, round, abs, min, max, sum, sorted, enumerate, zip, isinstance, type, repr`. Μέθοδοι: str `upper lower strip split join replace startswith endswith find count isdigit encode format`, list `append pop insert remove index count clear extend sort reverse copy`, dict `get keys values items pop update setdefault copy`, bytes `decode`. Εξαιρέσεις: `Exception, ValueError, TypeError, KeyError, IndexError, ZeroDivisionError, NameError, ConnectionRefusedError, OSError, json.JSONDecodeError`.

Τα λάθη έχουν **το αγγλικό μήνυμα της πραγματικής Python** (αυτό θα δει ο μαθητής στο αληθινό Pi) και από κάτω ελληνική εξήγηση. Πιάνονται και «συνήθειες από τη C++»: `{ }`, `&&`, `||`, `!`, `++`, `//` για σχόλιο, `true`, `else if`, `if x = 5`.

### Modules

| Module | Τι υπάρχει |
|---|---|
| `time` | `sleep(s)`, `time()` (εικονική ώρα, ξεκινά 2026-10-15 08:00), `monotonic()`, `strftime(fmt)` (`%Y %m %d %H %M %S %A %a`), `localtime()` |
| `datetime` | `datetime.now()` → `.strftime()`, `.isoformat()`, `.hour`, `.minute`, `.timestamp()` |
| `json` | `loads(str ή bytes)` (int/float όπως η Python), `dumps(x, indent=None, ensure_ascii=True)` (`", "` και `": "` όπως η Python), `JSONDecodeError` |
| `random` | `random() randint uniform choice seed` (σταθερός σπόρος: ίδια αποτελέσματα κάθε φορά) |
| `math` | `sqrt floor ceil isnan pi inf nan` |
| `gpiozero` | `LED(17)`: `on() off() toggle() blink(on_time, off_time) is_lit value`. `Button(27)`: `is_pressed wait_for_press(timeout) wait_for_release when_pressed when_released`. `MotionSensor(4)`: `motion_detected wait_for_motion wait_for_no_motion when_motion when_no_motion` |
| `signal` | `pause()`: περιμένει για πάντα, τρέχοντας τα callbacks |
| `paho.mqtt.client` | δες πιο κάτω |
| `config` | οι τιμές του `world.consts` της άσκησης, συν `BROKER_HOST = "broker.home.lan"`. Μοτίβο για μυστικά: `from config import MQTT_USER, MQTT_PASS` |

Pins του εικονικού Pi (BCM): **LED 17, κουμπί 27, PIR 4**. Άλλο pin → προειδοποίηση.

### paho-mqtt (όπως η έκδοση 2.x)

```python
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, reason_code, properties):
    client.subscribe("home/#")          # subscribe ΕΔΩ: ξαναγίνεται μετά από επανασύνδεση

def on_message(client, userdata, msg):
    text = msg.payload.decode()         # το payload είναι bytes
    print(msg.topic, text)

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="pi-hub")
client.on_connect = on_connect
client.on_message = on_message
client.username_pw_set("hub", "…")     # προαιρετικά
client.tls_set(ca_certs="home-ca.crt")  # προαιρετικά· όνομα με «home» ή «lab» = η CA του σπιτιού
client.connect("broker.home.lan", 1883) # ή "localhost": ο broker είναι στο ίδιο Pi
client.loop_forever()                   # ή client.loop_start() + while True: … time.sleep(…)
```

- `mqtt.Client("id")` (στυλ 1.x) δίνει το ίδιο σφάλμα με το αληθινό paho 2.x. `mqtt.Client()` χωρίς έκδοση βγάζει προειδοποίηση.
- Τα callbacks καλούνται **μόνο** όταν τρέχει `loop_forever()`, `loop_start()` (κατά τη διάρκεια κάθε `time.sleep`) ή `client.loop()`. Χωρίς αυτά τα μηνύματα δεν φτάνουν ποτέ.
- Μετά από restart του broker το paho ξανασυνδέεται μόνο του σε ~1 s και ξανακαλεί το `on_connect`. Τα subscribe που έγιναν έξω από το `on_connect` χάνονται.
- `publish(topic, payload, qos=0, retain=False)`: payload `str`, αριθμός ή bytes. Λεξικό → TypeError (θέλει `json.dumps`).
- `connect` σε άγνωστο host → `gaierror`. Σε θύρα χωρίς listener → `ConnectionRefusedError`. Λάθος κωδικός → το `on_connect` καλείται με `reason_code` αποτυχίας (`reason_code.is_failure`, `reason_code == 0` για επιτυχία).

### Κόσμος, εικονικές συσκευές και έλεγχοι

Το Pi χρησιμοποιεί τον ίδιο `world` και τους ίδιους ελέγχους. Το πρόγραμμα Python είναι ο client `device`, άρα `published`, `mqttConnected`, `serialHas` (το `print`), `count`, `lines`, `led` δουλεύουν κανονικά.

**Εικονικά ESP32 που στέλνουν μόνα τους** (νέο): στο `world.clients`:

```js
{ name: 'esp32-temp', publish: [{ topic: 'home/temperature', payload: '{"t": {temp}, "n": {n}}', every: 5000, offset: 1000 }] }
```

Στέλνουν κάθε `every` ms (το πρώτο στο `offset`). Πρότυπα: `{temp}` (με 1 δεκαδικό, ή `nan` όταν `sensorFault`), `{humidity}`, `{pir}`, `{button}` (1/0), `{n}` (αύξων αριθμός). Οι τιμές έρχονται από τις εισόδους, οπότε `{ set: { temp: 31 } }` αλλάζει ό,τι θα στείλει ο αισθητήρας. Μεμονωμένο μήνυμα: `{ act: { publish: 'esp32-temp', topic, payload } }`, αν ο client είναι συνδεδεμένος.

`hardware` για το Pi: `button`, `pir`, `sensor` (ρυθμίζει τι στέλνει ο εικονικός αισθητήρας), `broker`. Το LED φαίνεται πάντα. `panels`: όπως πριν. Το `serial` εμφανίζεται ως «Τερματικό».

Το `supportedSyntax` των μαθημάτων Python γράφεται σε μορφή Python, π.χ. `'print, if/elif/else, f-strings, λίστες'`.

## Μέρος Β (συνέχεια): SQLite, Flask, ασφάλεια του Pi (Κεφάλαια 21–23)

Ξεκλείδωμα: 21 `unlockAfter: 20`, 22 `unlockAfter: 21`, 23 `unlockAfter: 22`. Όλα `lang: 'python'` εκτός από τα μαθήματα ρυθμίσεων/ανάλυσης του 23.

### sqlite3 (εκπαιδευτικό υποσύνολο του SQLite)

```python
import sqlite3
conn = sqlite3.connect("home.db")       # ":memory:" για προσωρινή βάση
cur = conn.cursor()
cur.execute("CREATE TABLE IF NOT EXISTS readings (id INTEGER PRIMARY KEY, room TEXT NOT NULL, temp REAL, ts REAL)")
cur.execute("INSERT INTO readings (room, temp, ts) VALUES (?, ?, ?)", (room, t, time.time()))
conn.commit()
for row in cur.execute("SELECT room, ROUND(AVG(temp), 1) FROM readings GROUP BY room ORDER BY room"):
    print(row)                          # tuple
```

- Εντολές: `CREATE TABLE [IF NOT EXISTS]` (τύποι INTEGER/REAL/TEXT, `PRIMARY KEY` [AUTOINCREMENT], `NOT NULL`, `UNIQUE`, `DEFAULT`), `INSERT INTO … [(στήλες)] VALUES (…), (…)`, `SELECT … FROM … WHERE … GROUP BY … ORDER BY … [DESC] LIMIT … OFFSET …`, `UPDATE … SET … WHERE …`, `DELETE FROM … WHERE …`, `DROP TABLE [IF EXISTS]`.
- Εκφράσεις: `= == != <> < > <= >= AND OR NOT IS [NOT] NULL [NOT] LIKE [NOT] BETWEEN [NOT] IN (…) + - * / % ||`. Συναρτήσεις: `COUNT(*) COUNT AVG MIN MAX SUM ROUND LOWER UPPER LENGTH ABS COALESCE IFNULL`.
- Όπως το πραγματικό SQLite:
  - Ένα `INTEGER PRIMARY KEY` παίρνει αυτόματα αύξοντα αριθμό.
  - Στήλη REAL κάνει το `22` → `22.0`, στήλη TEXT κάνει τους αριθμούς κείμενο.
  - Ακέραιος / ακέραιος = ακέραιος.
  - Το `NULL` στο `ORDER BY` μπαίνει πρώτο με ASC και τελευταίο με DESC.
- Python API:
  - `conn.cursor() / execute / executemany / commit / rollback / close`
  - `cur.execute / executemany / fetchone / fetchall / fetchmany / lastrowid / rowcount`
  - το cursor διατρέχεται με `for row in cur`
  - Εξαιρέσεις: `sqlite3.Error, OperationalError, IntegrityError, ProgrammingError`.
- **commit:** οι έλεγχοι (`dbRows`) και το «τι μένει» βλέπουν **μόνο ό,τι έγινε commit**. Χωρίς commit:
  - στο τέλος του προγράμματος βγαίνει προειδοποίηση και οι αλλαγές χάνονται·
  - το `close()` χωρίς commit επίσης τις χάνει.
- Παράμετροι μόνο με `?` και tuple:
  - `(x,)` για μία τιμή. Το `(x)` χωρίς κόμμα με κείμενο δίνει το πραγματικό «Incorrect number of bindings supplied…».
  - Δύο εντολές με `;` → «You can only execute one statement at a time.».
  - **SQL injection** (αμυντικά): ένα f-string με `x' OR '1'='1` αλλάζει το WHERE. Με `?` δεν αλλάζει.
- Αρχική βάση της άσκησης:

  ```js
  world: { db: { 'home.db': ['CREATE TABLE readings (…)', "INSERT INTO readings (room, temp) VALUES ('salon', 22.5)"] } }
  ```

  Τρέχει στο πρώτο `connect` και γίνεται commit.
- Έλεγχος: `{ check: 'dbRows', table: 'readings', min/max/is, where: { room: 'salon' }, file: 'home.db' (προαιρετικό) }`. Το `{n}` είναι το πλήθος.
- Πάνελ: `db` (πίνακες και γραμμές, με ένδειξη «χωρίς commit»).

### Flask (μοντέλο του Flask 3 και του Werkzeug)

```python
from flask import Flask, jsonify, request, abort
from markupsafe import escape          # το flask.escape δεν υπάρχει στο Flask 3

app = Flask(__name__)

@app.route("/")
def index():
    return f"<h1>Γεια {escape(request.args.get('name', 'φίλε'))}</h1>"

@app.route("/api/temp/<room>")         # και <int:id>, <float:x>
def temp(room):
    return {"room": room, "temp": 22.5}      # dict → JSON

@app.route("/api/led", methods=["POST"])
def led():
    if request.headers.get("X-API-Key") != API_KEY:
        abort(401)
    data = request.get_json()
    return jsonify(ok=True, cmd=data["cmd"]), 200

app.run(host="0.0.0.0", port=5000, debug=False)
```

- **Τι επιστρέφει μια συνάρτηση route:**
  - `str` → HTML.
  - `dict`/`list` ή `jsonify(…)` → JSON. Το JSON είναι συμπαγές, με **ταξινομημένα κλειδιά** και `\n` στο τέλος, όπως στο Flask: `{"room":"salon","temp":22.5}\n`.
  - `(σώμα, status)` ή `(σώμα, status, headers)`.
  - `None` → 500 με το πραγματικό μήνυμα.
- **request:** `method`, `path`, `args.get(k, default, type=int)`, `headers.get(k)` (χωρίς διάκριση κεφαλαίων), `get_json(silent=True)`, `json`, `remote_addr`.
- **`abort(code)`:** 400/401/403/404/405/415/429/500, με τις σελίδες του Werkzeug.
- **Σφάλμα μέσα σε route:** ο browser παίρνει 500 και ο server **συνεχίζει**. Στο τερματικό τυπώνεται `ERROR in app: Exception on …` και η γραμμή του σφάλματος.
- **Το `app.run(...)` είναι κύριος βρόχος.** Με αυτό χρησιμοποίησε `{ ms }` και `{ request }`.
- **`host`:** με `127.0.0.1` (την προεπιλογή) ο server δέχεται αιτήματα μόνο από το ίδιο το Pi, οπότε το tablet παίρνει «Connection refused». Το `0.0.0.0` ανοίγει τον server σε όλο το δίκτυο.
- **`debug=True`:** βγάζει προειδοποίηση για τον debugger.
- **Στο τερματικό** φαίνονται οι γραμμές εκκίνησης και ένα access log ανά αίτημα: `192.168.1.20 - - [15/Oct/2026 08:00:01] "GET /api/temp HTTP/1.1" 200 -`.
- **Βήμα ελέγχου (νέο):** `{ request: { method: 'GET'|'POST', path: '/api/temp/salon?x=1', from: 'tablet' (προεπιλογή, 192.168.1.20) | 'pi', headers: { 'X-API-Key': '…' }, json: { … } ή body: 'κείμενο', port: 5000 } }`. Περιμένει την απάντηση (μέχρι 10 s εικονικού χρόνου).
- **Έλεγχος (νέο):** `{ check: 'response', status: 200, contains: 'κείμενο' | ['α', 'β'], notContains: '<script>', json: { k: v }, contentType: 'json' }`, για το τελευταίο αίτημα.
  - `{v}` = «status · αρχή του σώματος» ή το σφάλμα σύνδεσης.
  - `{n}` = status (0 αν δεν έγινε σύνδεση).
- **`hardware: ['web']`** δείχνει router και tablet στη σκηνή. Συνδυάζεται με `sensor`, `broker` κ.λπ.
- **Πάνελ `web`:** μικρός browser. Ο μαθητής στέλνει αιτήματα και βλέπει status, σώμα και προεπισκόπηση HTML **χωρίς scripts**.
- Μπορεί να συνδυαστεί με `paho` (`client.loop_start()` πριν από το `app.run`) και με `sqlite3`.

### Ασφάλεια του Pi: `mode: 'config', system: true`

Ο editor έχει ένα κομμάτι από το `/etc/ssh/sshd_config` και εντολές `ufw`. Σχόλιο είναι μόνο γραμμή που ξεκινά με `#`.

```
PermitRootLogin no               # yes | no | prohibit-password (προεπιλογή)
PasswordAuthentication no        # προεπιλογή yes
PubkeyAuthentication yes
AllowUsers hubadmin
Port 22
ufw default deny incoming
ufw allow from 192.168.1.0/24 to any port 22 proto tcp
ufw allow 8883/tcp
ufw limit 22/tcp                 # μπλοκάρει μετά από 6 συνδέσεις από την ίδια IP
ufw deny 1883
ufw enable                       # χωρίς αυτό, ο firewall είναι ανενεργός
```

- **Κανόνες:**
  - sshd: ισχύει η **πρώτη** τιμή κάθε ρύθμισης. Αν μια ρύθμιση γραφτεί δεύτερη φορά, βγαίνει προειδοποίηση.
  - ufw: ο πρώτος κανόνας που ταιριάζει αποφασίζει.
- **Προειδοποιήσεις για:**
  - root login και κωδικούς στο SSH
  - ανενεργό firewall
  - `default allow`
  - 1883/5000 ανοιχτές σε όλους
  - «θα κλειδωθείς έξω από το Pi» (κανένας κανόνας για το SSH)
- **Υπηρεσίες του Pi:** 22, 1883, 8883, 5000.
- **Λογαριασμοί** (φανταστικοί):
  - `hubadmin`: έχει κλειδί και κωδικό
  - `pi`: μόνο κωδικός `raspberry`
  - `root`
  - Αλλάζουν με `world: { users: { … }, services: [...] }`.
- **IP:**
  - σπίτι `192.168.1.0/24` (tablet `.20`, άγνωστη συσκευή `.77`)
  - Internet π.χ. `203.0.113.50` (δίκτυο τεκμηρίωσης)

Βήματα ελέγχου (το `expect` ελέγχεται αμέσως, `{v}` = εξήγηση):

```js
{ connect: { from: '203.0.113.50', port: 22 }, expect: 'deny', fail: '… {v}' }
{ wait: 60 }                             // περνούν 60 δευτερόλεπτα (π.χ. για το ufw limit)
{ ssh: { from: '192.168.1.20', user: 'hubadmin', auth: 'key' }, expect: 'allow', fail: '… {v}' }
{ ssh: { from: '192.168.1.20', user: 'pi', auth: 'password', password: 'raspberry' }, expect: 'deny', fail: '…' }
{ burst: { from: '203.0.113.50', port: 22, count: 10 }, expect: 'deny', fail: '…' }   // το expect αφορά την τελευταία
```

Το log του ελέγχου (πάνελ «Log ελέγχου») περιέχει γραμμές τύπου:
- `auth.log`: `Accepted publickey for …`, `Failed password for …`, `ROOT LOGIN REFUSED …`, `User … not allowed because not listed in AllowUsers`
- ufw: `[UFW BLOCK] … SRC=… DPT=22`

### Ανάλυση logs του Pi: `mode: 'analysis'` με έτοιμες γραμμές

```js
mode: 'analysis', panels: ['logs'],
capture: { lines: ['Oct 15 03:12:01 pi-hub sshd[812]: Failed password for invalid user admin from 203.0.113.50 port 40022 ssh2', '…'] },
evidence: { log: '203.0.113.50' },     // σωστά τεκμήρια = όλες οι γραμμές που περιέχουν αυτό το κείμενο
evidenceHint: '…'
```

Οι γραμμές είναι συνθετικές. Χρησιμοποίησε IP από τα δίκτυα τεκμηρίωσης (`203.0.113.0/24`, `198.51.100.0/24`), όχι πραγματικές.
