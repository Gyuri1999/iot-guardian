# Οδηγός συγγραφής: MicroPython στο ESP32 (κλάδος `py-esp32`)

Συμπλήρωμα του `docs/AUTHORING.md`. Ισχύουν όλοι οι βασικοί κανόνες εκεί (ελληνικά, δυσλεξία, αμυντική ασφάλεια, έλεγχος με συμπεριφορά). Εδώ γράφονται μόνο όσα διαφέρουν για τη MicroPython.

## Αρχεία και κεφάλαια

- Ένα αρχείο ανά κεφάλαιο: `js/lessons/mp30.js` … `js/lessons/mp35.js`.
- Κεφάλαιο:

  ```js
  L.CHAPTERS.push({ n: 30, title: '…', ready: true, track: 'py-esp32', lang: 'python', board: 'esp32', unlockAfter: 17 });
  if (!L.SKILLS.micropython) L.SKILLS.micropython = 'MicroPython';
  ```

  Τα 31–35 έχουν `unlockAfter` το προηγούμενο κεφάλαιο.
- Κάθε μάθημα: `lang: 'python'`, `board: 'esp32'`, `chapter`, id `cN-lM`, και όλα τα πεδία του `AUTHORING.md` (μαζί με `initialWorld`).
- Στο ελληνικό κείμενο **μη γράφεις αριθμούς κεφαλαίων** («Κεφάλαιο 32»). Ο παίκτης βλέπει τα κεφάλαια ως 1–6 του κλάδου. Γράψε «στο προηγούμενο κεφάλαιο», «στο κεφάλαιο για το WiFi».
- Όροι γλωσσαρίου: μόνο όσοι δεν υπάρχουν (`if (!L.GLOSSARY.some(x => x.term === g.term))`).

## Πώς τρέχει το πρόγραμμα

- Όπως στην Python του Pi: δεν υπάρχουν `setup()` / `loop()`. Ο **κύριος βρόχος** είναι το πρώτο `while True:` που εκτελείται. Κάθε γύρος = ένα `{ loops: 1 }`.
- Ό,τι είναι πριν από το `while True:` τρέχει στο `{ setup: true }`. Ένα `while not wlan.isconnected():` **δεν** είναι κύριος βρόχος.
- Οι αναμονές (`time.sleep`, `sleep_ms`) κυλούν σε κομμάτια των 10 ms. Έτσι το `{ ms: 700 }` σταματά στη μέση ενός γύρου και μπορείς να ελέγξεις το LED εκεί.
- Πρόσεχε τα όρια στα `{ ms }`: ένα print στο 100 ms κάθε γύρου των 1000 ms τυπώνεται 6 φορές σε 5,5 s. Διάλεξε διάρκειες μακριά από τις στιγμές που τυπώνει το πρόγραμμα.

## Modules (με `board: 'esp32'`)

| Module | Τι υπάρχει |
|---|---|
| `machine` | `Pin(n, Pin.OUT / Pin.IN, Pin.PULL_UP?)`, `.value()`, `.value(x)`, `.on()`, `.off()`, `time_pulse_us(pin, level, timeout_us)` (αρνητικό = καμία ηχώ), `reset()`, `freq()` |
| `time` | ό,τι έχει η Python του Pi, συν `sleep_ms`, `sleep_us`, `ticks_ms`, `ticks_us`, `ticks_diff`, `ticks_add` |
| `dht` | `DHT22(Pin(13))` / `DHT11`: `measure()`, `temperature()`, `humidity()`. Με `sensorFault` το `measure()` σηκώνει `OSError: [Errno 110] ETIMEDOUT` |
| `network` | `WLAN(STA_IF)`: `active(True)`, `connect(ssid, key)`, `isconnected()`, `status()`, `ifconfig()`, `disconnect()`. Σταθερές `STAT_IDLE 1000`, `STAT_CONNECTING 1001`, `STAT_GOT_IP 1010`, `STAT_WRONG_PASSWORD 202`, `STAT_NO_AP_FOUND 201`. Χωρίς `active(True)` το `connect` σηκώνει `OSError` |
| `umqtt.simple` | `MQTTClient(client_id, server, port=0, user=None, password=None)`: `connect()`, `publish(topic, msg, retain=False, qos=0)`, `subscribe(topic)`, `set_callback(f)` (πριν από το subscribe, αλλιώς `AssertionError`), `check_msg()`, `wait_msg()`, `disconnect()`. Το callback παίρνει `(topic, msg)` ως **bytes**. Απόρριψη από τον broker → `MQTTException` (4 = λάθος στοιχεία, 5 = δεν επιτρέπεται). Λεξικό ή αριθμός στο publish → `TypeError` με υπόδειξη `json.dumps` |
| `json`, `config` | όπως στην Python του Pi. Το `config` έχει τις τιμές του `world.consts` |

Τα modules του Pi (`gpiozero`, `paho`, `flask`, `sqlite3`, `signal`) δίνουν `ImportError` στο ESP32, με ελληνική υπόδειξη.

## Pins της εικονικής πλακέτας

| Εξάρτημα | GPIO | `hardware` |
|---|---|---|
| LED | 2 | `led` |
| Κουμπί (1 = πατημένο) | 15 | `button` |
| PIR (1 = κίνηση) | 4 | `pir` |
| DHT22 (δεδομένα) | 13 | `sensor` |
| HC-SR04 TRIG / ECHO | 5 / 18 | `ultrasonic` |
| Φανάρι κόκκινο / κίτρινο / πράσινο | 25 / 26 / 27 | `traffic` |
| Router (WiFi on/off) | — | `router` |

- Ένα LED με `Pin.IN` **δεν** ανάβει (με προειδοποίηση), όπως στην αληθινή πλακέτα. Αυτό επιτρέπει debug ασκήσεις με λάθος κατεύθυνση.
- Ο παλμός TRIG χρειάζεται τουλάχιστον 8 µs (`time.sleep_us(10)`). Πιο σύντομος → προειδοποίηση και `time_pulse_us` = -1.
- Απόσταση 35 cm → 2041 µs → `us / 58.3` = 35.0. Τύπωνε με `f"{cm:.1f}"`, ώστε οι έλεγχοι να μη εξαρτώνται από δεκαδικά.

## Κόσμος της άσκησης

- WiFi: η πλακέτα ξεκινά **χωρίς** WiFi. Το SSID / κωδικός του router είναι `SmartHome-Lab` / `lab-pass-123` (αλλάζουν με `world.ssid` / `world.wifiPass`). Βάλε τα στοιχεία στο `world.consts` (`WIFI_SSID`, `WIFI_PASS`) και ο κώδικας τα διαβάζει από το `config`.
  - Σύνδεση σε 1200 ms. Λάθος κωδικός → `STAT_WRONG_PASSWORD` σε 3000 ms. Router κάτω / λάθος SSID → `STAT_NO_AP_FOUND` σε 3000 ms.
  - Ένα test με `world: { wifiPass: 'άλλος' }` κάνει τον κωδικό του `config` λάθος, χωρίς να αλλάξεις το `consts`.
- MQTT: `world.broker`, `world.clients` (dashboard κ.λπ.), όπως στα κεφάλαια MQTT της C++. Για ασφαλή broker βάλε `MQTT_USER` / `MQTT_PASS` στο `consts`, και χρησιμοποίησε `sourceNot` + `serialNot` για τον κωδικό.
- Έλεγχοι που δουλεύουν: `led`, `ledOutput`, `lights`, `count`, `lines`, `order`, `lastLine`, `total`, `serialHas`, `serialNot`, `published`, `dashboard`, `retained`, `wifiConnected`, `wifiAttempts` (μετρά κάθε `wlan.connect`), `mqttConnected` (με `{v}` = τελευταίο σφάλμα), `mqttAttempts`, `sourceNot`.

## Ρεαλισμός

Οι λύσεις πρέπει να τρέχουν και σε αληθινό ESP32 με MicroPython 1.22+, ως `main.py`. Μη χρησιμοποιείς ό,τι δεν έχει η MicroPython (π.χ. `Pin.irq` δεν υποστηρίζεται εδώ). Μια διαφορά που αξίζει να ξέρεις: στη MicroPython το λάθος JSON δίνει `ValueError`. Εδώ εμφανίζεται ως `JSONDecodeError`, που είναι υποκλάση του `ValueError`, άρα το `except ValueError:` δουλεύει και στα δύο.

## Έλεγχος

```bash
node tests/run-tests.js --only c30
```

Η λύση κάθε μαθήματος πρέπει να περνά όλα τα tests και ο αρχικός κώδικας να αποτυγχάνει σε τουλάχιστον ένα.
