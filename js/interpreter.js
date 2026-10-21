/*
 * IoT Guardian — εκπαιδευτικός interpreter για υποσύνολο Arduino-style C++.
 *
 * Ο κώδικας του μαθητή ΔΕΝ εκτελείται με eval() ή new Function().
 * Περνά από tokenizer → parser (AST) → στατικό έλεγχο → εκτέλεση με generator,
 * ένα statement τη φορά. Ο κώδικας δεν έχει πρόσβαση σε DOM, cookies ή δίκτυο:
 * μπορεί να καλέσει μόνο τις εντολές της εικονικής πλακέτας που ορίζονται εδώ.
 */
(function (root) {
  'use strict';

  class CodeError extends Error {
    constructor(message, line, hint) {
      super(message);
      this.name = 'CodeError';
      this.line = line || null;
      this.hint = hint || '';
    }
  }

  // Σταθερές της εικονικής πλακέτας. Οι τιμές INPUT/OUTPUT/INPUT_PULLUP είναι ίδιες με του ESP32 core.
  // Οι τιμές WL_* ακολουθούν τη βιβλιοθήκη WiFi του ESP32. Τα κείμενα είναι συνθετικά, μόνο για την προσομοίωση.
  const BOARD_CONSTS = {
    HIGH: 1, LOW: 0,
    INPUT: 1, OUTPUT: 3, INPUT_PULLUP: 5,
    LED_PIN: 2, LED_BUILTIN: 2, BUTTON_PIN: 15, PIR_PIN: 4,
    WL_IDLE_STATUS: 0, WL_NO_SSID_AVAIL: 1, WL_CONNECTED: 3, WL_CONNECT_FAILED: 4, WL_DISCONNECTED: 6,
    WIFI_SSID: 'SmartHome-Lab', WIFI_PASSWORD: 'lab-pass-123',
    MQTT_HOST: 'broker.home.lan', HOME_CA: 'Home Lab CA',
    ESP_SLEEP_WAKEUP_UNDEFINED: 0, ESP_SLEEP_WAKEUP_EXT0: 2, ESP_SLEEP_WAKEUP_TIMER: 4,
    WIFI_OFF: 0, WIFI_STA: 1
  };

  // Επιτρεπόμενος αριθμός ορισμάτων για κάθε εντολή.
  // Οι εντολές εκτός πυρήνα (αισθητήρες, WiFi, mqtt, JSON) εκτελούνται από την εικονική πλακέτα.
  const BUILTINS = {
    pinMode: [2], digitalWrite: [2], digitalRead: [1],
    delay: [1], millis: [0],
    'Serial.begin': [1], 'Serial.print': [1], 'Serial.println': [0, 1],
    abs: [1], min: [2], max: [2], isnan: [1], toInt: [1], toFloat: [1],
    readTemperature: [0], readHumidity: [0],
    'WiFi.begin': [2], 'WiFi.status': [0], 'WiFi.localIP': [0], 'WiFi.reconnect': [0], 'WiFi.disconnect': [0],
    'mqtt.setServer': [2], 'mqtt.setCACert': [1], 'mqtt.setInsecure': [0],
    'mqtt.connect': [1, 3], 'mqtt.connected': [0], 'mqtt.disconnect': [0],
    'mqtt.publish': [2, 3], 'mqtt.subscribe': [1],
    'mqtt.read': [0], 'mqtt.topic': [0], 'mqtt.payload': [0],
    jsonValid: [1], jsonHas: [2], jsonGet: [2],
    'WiFi.mode': [1],
    esp_sleep_enable_timer_wakeup: [1], esp_sleep_enable_ext0_wakeup: [2],
    esp_light_sleep_start: [0], esp_deep_sleep_start: [0], esp_sleep_get_wakeup_cause: [0]
  };
  const DEEP_SLEEP = { deepSleep: true }; // σήμα (όχι σφάλμα): η πλακέτα μπαίνει σε deep sleep
  const CORE = new Set(['pinMode', 'digitalWrite', 'digitalRead', 'delay', 'millis', 'Serial.begin', 'Serial.print', 'Serial.println', 'abs', 'min', 'max', 'isnan', 'toInt', 'toFloat']);
  const BUILTIN_RETURNS = { digitalRead: 'int', millis: 'int' };
  const EXAMPLES = {
    pinMode: 'pinMode(LED_PIN, OUTPUT)', digitalWrite: 'digitalWrite(LED_PIN, HIGH)', digitalRead: 'digitalRead(BUTTON_PIN)',
    delay: 'delay(1000)', millis: 'millis()', 'WiFi.begin': 'WiFi.begin(WIFI_SSID, WIFI_PASSWORD)',
    'mqtt.connect': 'mqtt.connect("esp32-pir") ή mqtt.connect("esp32-pir", MQTT_USER, MQTT_PASS)',
    'mqtt.publish': 'mqtt.publish("home/motion", payload) ή mqtt.publish("home/temperature", payload, true)',
    'mqtt.setServer': 'mqtt.setServer(MQTT_HOST, 1883)', jsonGet: 'jsonGet(msg, "cmd")', jsonHas: 'jsonHas(msg, "id")'
  };

  const TYPE_MAP = {
    int: 'int', long: 'int', byte: 'int', bool: 'bool', boolean: 'bool',
    float: 'float', double: 'float', String: 'String', void: 'void'
  };

  const UNSUPPORTED_WORDS = {
    switch: 'Η εντολή switch δεν υποστηρίζεται ακόμα. Χρησιμοποίησε if / else if / else.',
    case: 'Η εντολή switch/case δεν υποστηρίζεται ακόμα. Χρησιμοποίησε if / else if / else.',
    do: 'Ο βρόχος do…while δεν υποστηρίζεται. Χρησιμοποίησε while ή for.',
    break: 'Το break δεν υποστηρίζεται σε αυτή την εκπαιδευτική έκδοση. Γράψε τη συνθήκη του βρόχου ώστε να σταματά μόνη της.',
    continue: 'Το continue δεν υποστηρίζεται σε αυτή την εκπαιδευτική έκδοση. Χρησιμοποίησε if μέσα στον βρόχο.',
    class: 'Οι κλάσεις (class) δεν υποστηρίζονται σε αυτή την εκπαιδευτική έκδοση.',
    struct: 'Οι δομές (struct) δεν υποστηρίζονται σε αυτή την εκπαιδευτική έκδοση.',
    char: 'Ο τύπος char δεν υποστηρίζεται. Για κείμενο χρησιμοποίησε String.',
    goto: 'Το goto δεν υποστηρίζεται.',
    new: 'Η δυναμική μνήμη (new) δεν υποστηρίζεται.',
    delete: 'Η δυναμική μνήμη (delete) δεν υποστηρίζεται.',
    template: 'Τα templates δεν υποστηρίζονται.',
    namespace: 'Τα namespaces δεν υποστηρίζονται.',
    static: 'Η λέξη static δεν υποστηρίζεται. Για τιμή που «θυμάται», δήλωσε τη μεταβλητή έξω από τις συναρτήσεις.',
    volatile: 'Η λέξη volatile δεν υποστηρίζεται σε αυτή την εκπαιδευτική έκδοση.',
    auto: 'Η λέξη auto δεν υποστηρίζεται. Γράψε τον τύπο, π.χ. int ή bool.'
  };

  const SPECIAL_OPS = {
    '&': 'Ο τελεστής & δεν υποστηρίζεται. Για «και» σε συνθήκη γράψε &&.',
    '|': 'Ο τελεστής | δεν υποστηρίζεται. Για «ή» σε συνθήκη γράψε ||.',
    '[': 'Οι πίνακες (arrays) με [ ] δεν υποστηρίζονται ακόμα.',
    ']': 'Οι πίνακες (arrays) με [ ] δεν υποστηρίζονται ακόμα.',
    '?': 'Ο τελεστής ? : δεν υποστηρίζεται. Χρησιμοποίησε if / else.',
    ':': 'Ο χαρακτήρας : δεν υποστηρίζεται εδώ.',
    '<<': 'Ο τελεστής << δεν υποστηρίζεται. Για εκτύπωση χρησιμοποίησε Serial.println(…).',
    '>>': 'Ο τελεστής >> δεν υποστηρίζεται.',
    '::': 'Ο τελεστής :: δεν υποστηρίζεται.',
    '->': 'Οι δείκτες (->) δεν υποστηρίζονται.'
  };

  // ---------------------------------------------------------------- Tokenizer

  function tokenize(src, startLine) {
    const toks = [];
    let i = 0;
    let line = startLine || 1;
    const n = src.length;
    const push = (type, value, l) => toks.push({ type, value, line: l });
    const OPS2 = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '::', '->', '<<', '>>'];

    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === ' ') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') {
        const start = line;
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
        if (i >= n) throw new CodeError('Το σχόλιο που ξεκινά με /* δεν κλείνει ποτέ.', start, 'Πρόσθεσε */ εκεί που τελειώνει το σχόλιο.');
        i += 2;
        continue;
      }
      if (c === '#') {
        let j = i;
        while (j < n && src[j] !== '\n') j++;
        push('pp', src.slice(i, j).replace(/\/\/.*$/, '').trim(), line);
        i = j;
        continue;
      }
      if (c === ';') {
        throw new CodeError('Βρέθηκε ελληνικό ερωτηματικό αντί για αγγλικό semicolon.', line,
          'Σβήσε το σημάδι στο τέλος της γραμμής και γράψε ξανά το ; με αγγλικό πληκτρολόγιο. Μοιάζουν ίδια, αλλά ο υπολογιστής τα βλέπει ως διαφορετικούς χαρακτήρες.');
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        let j = i;
        while (j < n && /[0-9.]/.test(src[j])) j++;
        const raw = src.slice(i, j);
        if ((raw.match(/\./g) || []).length > 1) throw new CodeError(`Ο αριθμός «${raw}» έχει περισσότερες από μία τελείες.`, line, 'Ένας δεκαδικός αριθμός έχει μία τελεία, π.χ. 21.5');
        if (/[A-Za-z_]/.test(src[j] || '')) {
          let k = j;
          while (k < n && /[A-Za-z0-9_]/.test(src[k])) k++;
          throw new CodeError(`Το «${src.slice(i, k)}» δεν είναι έγκυρος αριθμός ή όνομα.`, line, 'Τα ονόματα μεταβλητών δεν μπορούν να ξεκινούν με αριθμό.');
        }
        push('num', raw.includes('.') ? { v: parseFloat(raw), float: true } : { v: parseInt(raw, 10), float: false }, line);
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i;
        while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
        if (/[Ͱ-Ͽἀ-῿]/.test(src[j] || '')) {
          throw new CodeError('Ένα όνομα περιέχει ελληνικό γράμμα.', line, 'Τα ονόματα εντολών και μεταβλητών γράφονται μόνο με λατινικούς χαρακτήρες. Έλεγξε μήπως ένα γράμμα (π.χ. ο ή Α) γράφτηκε με ελληνικό πληκτρολόγιο.');
        }
        push('id', src.slice(i, j), line);
        i = j;
        continue;
      }
      if (/[Ͱ-Ͽἀ-῿]/.test(c)) {
        throw new CodeError(`Βρέθηκε ελληνικός χαρακτήρας «${c}» μέσα στον κώδικα.`, line,
          'Ελληνικά επιτρέπονται μόνο μέσα σε "εισαγωγικά" ή μέσα σε σχόλια //. Οι εντολές και τα ονόματα γράφονται με λατινικούς χαρακτήρες.');
      }
      if (c === '"') {
        let j = i + 1;
        let s = '';
        while (j < n && src[j] !== '"') {
          if (src[j] === '\n') throw new CodeError('Το κείμενο σε εισαγωγικά δεν κλείνει στην ίδια γραμμή.', line, 'Βάλε " στο τέλος του κειμένου.');
          if (src[j] === '\\' && j + 1 < n) {
            const e = src[j + 1];
            s += e === 'n' ? '\n' : e === 't' ? '\t' : e;
            j += 2;
            continue;
          }
          s += src[j];
          j++;
        }
        if (j >= n) throw new CodeError('Το κείμενο σε εισαγωγικά δεν κλείνει.', line, 'Βάλε " στο τέλος του κειμένου.');
        push('str', s, line);
        i = j + 1;
        continue;
      }
      if (c === '“' || c === '”' || c === '«' || c === '»' || c === '„') {
        throw new CodeError('Βρέθηκαν «καλλιγραφικά» εισαγωγικά.', line, 'Στον κώδικα χρησιμοποίησε τα απλά εισαγωγικά " του πληκτρολογίου. Συχνά τα καλλιγραφικά μπαίνουν όταν αντιγράφεις κείμενο από έγγραφο.');
      }
      if (c === "'") throw new CodeError('Τα μονά εισαγωγικά \' (char) δεν υποστηρίζονται.', line, 'Για κείμενο χρησιμοποίησε διπλά εισαγωγικά, π.χ. "A".');
      const two = src.substr(i, 2);
      if (OPS2.includes(two)) { push('op', two, line); i += 2; continue; }
      if ('=<>+-*/%!(){};,.&|[]?:'.includes(c)) { push('op', c, line); i++; continue; }
      throw new CodeError(`Άγνωστος χαρακτήρας «${c}».`, line, 'Σβήσε αυτόν τον χαρακτήρα ή έλεγξε αν γράφτηκε κατά λάθος.');
    }
    push('eof', null, line);
    return toks;
  }

  function describe(t) {
    if (!t || t.type === 'eof') return 'το τέλος του κώδικα';
    if (t.type === 'str') return `το κείμενο "${t.value}"`;
    if (t.type === 'num') return `τον αριθμό ${t.value.v}`;
    if (t.type === 'pp') return `την οδηγία ${t.value}`;
    return `«${t.value}»`;
  }

  // ------------------------------------------------------------------- Parser

  class Parser {
    constructor(tokens) {
      this.toks = tokens;
      this.pos = 0;
      this.warnings = [];
    }
    peek(o) { return this.toks[Math.min(this.pos + (o || 0), this.toks.length - 1)]; }
    next() { return this.toks[Math.min(this.pos++, this.toks.length - 1)]; }
    prevLine() { return this.pos > 0 ? this.toks[Math.min(this.pos - 1, this.toks.length - 1)].line : 1; }
    isOp(v, o) { const t = this.peek(o); return t.type === 'op' && t.value === v; }
    isId(v, o) { const t = this.peek(o); return t.type === 'id' && (v === undefined || t.value === v); }

    expectOp(v, where) {
      if (this.isOp(v)) return this.next();
      const t = this.peek();
      if (t.type === 'op' && SPECIAL_OPS[t.value]) throw new CodeError(SPECIAL_OPS[t.value], t.line);
      if (v === ';') {
        throw new CodeError('Λείπει το ; στο τέλος της εντολής.', this.prevLine(),
          'Κάθε απλή εντολή τελειώνει με ; (αγγλικό semicolon). Πρόσθεσέ το στο τέλος αυτής της γραμμής.');
      }
      if (v === ')') {
        const comma = (t.type === 'id' || t.type === 'num' || t.type === 'str') && t.line === this.prevLine();
        throw new CodeError(`Περίμενα να κλείσει η παρένθεση «)»${where ? ' ' + where : ''}, αλλά βρήκα ${describe(t)}.`, t.line,
          comma ? 'Μήπως λείπει κόμμα , ανάμεσα σε δύο τιμές; π.χ. digitalWrite(LED_PIN, HIGH)' : 'Μέτρησε τις παρενθέσεις: κάθε ( χρειάζεται το δικό της ).');
      }
      if (v === '(') {
        throw new CodeError(`Περίμενα «(»${where ? ' ' + where : ''}, αλλά βρήκα ${describe(t)}.`, t.line, 'Οι συνθήκες και οι κλήσεις συναρτήσεων γράφονται μέσα σε παρενθέσεις.');
      }
      throw new CodeError(`Περίμενα «${v}»${where ? ' ' + where : ''}, αλλά βρήκα ${describe(t)}.`, t.line, '');
    }

    parseType() {
      const start = this.pos;
      let isConst = false;
      let rtc = false;
      if (this.isId('RTC_DATA_ATTR')) { this.next(); rtc = true; }
      if (this.isId('const')) { this.next(); isConst = true; }
      if (this.isId('unsigned')) {
        this.next();
        if (this.isId('long') || this.isId('int')) this.next();
        if (this.isId('long')) this.next();
        return { type: 'int', isConst, rtc };
      }
      const t = this.peek();
      if (t.type === 'id' && TYPE_MAP[t.value]) {
        this.next();
        if (t.value === 'long' && this.isId('long')) this.next();
        return { type: TYPE_MAP[t.value], isConst, rtc };
      }
      if (isConst || rtc) throw new CodeError(`Μετά το ${rtc ? 'RTC_DATA_ATTR' : 'const'} περιμένω τύπο, π.χ. ${rtc ? 'RTC_DATA_ATTR int bootCount = 0;' : 'const int LIMIT = 5;'}`, t.line);
      this.pos = start;
      return null;
    }

    parseProgram() {
      const globals = [];
      const functions = {};
      const order = [];
      while (this.peek().type !== 'eof') {
        const t = this.peek();
        if (t.type === 'pp') { this.next(); const d = parseDirective(t); if (d) globals.push(d); continue; }
        if (t.type === 'id' && UNSUPPORTED_WORDS[t.value]) throw new CodeError(UNSUPPORTED_WORDS[t.value], t.line);
        const ty = this.parseType();
        if (!ty) {
          if (t.type === 'op' && t.value === '}') throw new CodeError('Περισσεύει ένα }.', t.line, 'Κάθε } κλείνει ένα {. Εδώ δεν υπάρχει ανοιχτό { να κλείσει. Μήπως έγραψες } δύο φορές;');
          throw new CodeError(`Δεν περίμενα ${describe(t)} σε αυτό το σημείο.`, t.line,
            'Έξω από τις συναρτήσεις γράφουμε μόνο δηλώσεις μεταβλητών (π.χ. int x = 0;) ή συναρτήσεις (π.χ. void setup() { … }). Οι εντολές μπαίνουν μέσα στα { } του setup() ή του loop().');
        }
        const nameTok = this.next();
        if (nameTok.type !== 'id') throw new CodeError(`Μετά τον τύπο ${ty.type} περιμένω ένα όνομα, αλλά βρήκα ${describe(nameTok)}.`, nameTok.line);
        checkName(nameTok);
        if (this.isOp('(')) {
          if (ty.rtc) throw new CodeError('Το RTC_DATA_ATTR μπαίνει μόνο σε μεταβλητές, όχι σε συναρτήσεις.', nameTok.line);
          const fn = this.parseFunction(ty, nameTok);
          if (functions[fn.name]) throw new CodeError(`Η συνάρτηση ${fn.name}() ορίζεται δύο φορές.`, fn.line, 'Κράτησε μόνο έναν ορισμό της.');
          functions[fn.name] = fn;
          order.push(fn.name);
        } else {
          if (ty.type === 'void') throw new CodeError('Μια μεταβλητή δεν μπορεί να είναι void.', nameTok.line, 'Χρησιμοποίησε int, bool, float ή String.');
          globals.push(this.parseDeclRest(ty, nameTok));
        }
      }
      return { globals, functions, order };
    }

    parseFunction(ty, nameTok) {
      this.expectOp('(');
      const params = [];
      if (!this.isOp(')')) {
        if (this.isId('void') && this.isOp(')', 1)) {
          this.next();
        } else {
          for (;;) {
            const pt = this.parseType();
            if (!pt || pt.type === 'void' || pt.rtc) throw new CodeError('Κάθε παράμετρος χρειάζεται τύπο και όνομα, π.χ. int pin.', this.peek().line);
            const pn = this.next();
            if (pn.type !== 'id') throw new CodeError(`Η παράμετρος χρειάζεται όνομα, βρήκα ${describe(pn)}.`, pn.line);
            params.push({ type: pt.type, name: pn.value });
            if (this.isOp(',')) { this.next(); continue; }
            break;
          }
        }
      }
      this.expectOp(')', `της συνάρτησης ${nameTok.value}`);
      if (this.isOp(';')) throw new CodeError('Οι δηλώσεις συναρτήσεων χωρίς σώμα (prototypes) δεν χρειάζονται εδώ.', this.peek().line, 'Σβήσε το ; και γράψε το σώμα της συνάρτησης μέσα σε { }.');
      if (!this.isOp('{')) throw new CodeError(`Η συνάρτηση ${nameTok.value}() χρειάζεται σώμα μέσα σε { }.`, this.peek().line, 'Γράψε { αμέσως μετά την παρένθεση.');
      const body = this.parseBlock();
      return { name: nameTok.value, type: ty.type, params, body, line: nameTok.line, endLine: body.endLine };
    }

    parseDeclRest(ty, nameTok) {
      checkName(nameTok);
      if (this.isOp('[')) throw new CodeError(SPECIAL_OPS['['], nameTok.line);
      let init = null;
      if (this.isOp('=')) { this.next(); init = this.parseExpr(); }
      if (this.isOp(',')) throw new CodeError('Γράψε μία μεταβλητή σε κάθε δήλωση.', nameTok.line, 'Αντί για int a = 0, b = 0; γράψε int a = 0; και σε νέα γραμμή int b = 0;');
      this.expectOp(';');
      if (ty.isConst && !init) throw new CodeError(`Η σταθερά ${nameTok.value} χρειάζεται τιμή.`, nameTok.line, `Γράψε π.χ. const int ${nameTok.value} = 5;`);
      return { k: 'decl', type: ty.type, isConst: ty.isConst, rtc: !!ty.rtc, name: nameTok.value, init, line: nameTok.line };
    }

    parseBlock() {
      const open = this.expectOp('{');
      const body = [];
      while (!this.isOp('}')) {
        if (this.peek().type === 'eof') {
          throw new CodeError(`Λείπει ένα } για να κλείσει το { της γραμμής ${open.line}.`, this.prevLine(),
            'Κάθε { χρειάζεται το δικό του }. Πρόσθεσε } εκεί που τελειώνει το μπλοκ.');
        }
        body.push(this.parseStatement());
      }
      const close = this.next();
      return { k: 'block', body, line: open.line, endLine: close.line };
    }

    parseStatement() {
      const t = this.peek();
      if (t.type === 'pp') throw new CodeError('Οι οδηγίες που ξεκινούν με # γράφονται στην αρχή του προγράμματος, έξω από συναρτήσεις.', t.line);
      if (t.type === 'op' && t.value === '{') return this.parseBlock();
      if (t.type === 'op' && t.value === ';') { this.next(); return { k: 'empty', line: t.line }; }
      if (t.type === 'id') {
        if (UNSUPPORTED_WORDS[t.value]) throw new CodeError(UNSUPPORTED_WORDS[t.value], t.line);
        if (t.value === 'if') return this.parseIf();
        if (t.value === 'else') throw new CodeError('Βρέθηκε else χωρίς if ακριβώς πριν.', t.line, 'Το else γράφεται αμέσως μετά το } του if. Έλεγξε μήπως υπάρχει ; ή άλλη εντολή ανάμεσα.');
        if (t.value === 'for') return this.parseFor();
        if (t.value === 'while') return this.parseWhile();
        if (t.value === 'return') {
          this.next();
          let value = null;
          if (!this.isOp(';')) value = this.parseExpr();
          this.expectOp(';');
          return { k: 'return', value, line: t.line };
        }
        const save = this.pos;
        const ty = this.parseType();
        if (ty) {
          const nameTok = this.next();
          if (nameTok.type !== 'id') throw new CodeError(`Μετά τον τύπο περιμένω όνομα μεταβλητής, βρήκα ${describe(nameTok)}.`, nameTok.line);
          if (this.isOp('(')) throw new CodeError('Δεν μπορείς να ορίσεις συνάρτηση μέσα σε άλλη συνάρτηση.', nameTok.line, 'Μήπως λείπει ένα } για να κλείσει η προηγούμενη συνάρτηση;');
          if (ty.type === 'void') throw new CodeError('Μια μεταβλητή δεν μπορεί να είναι void.', nameTok.line);
          if (ty.rtc) throw new CodeError('Το RTC_DATA_ATTR μπαίνει μόνο σε μεταβλητές έξω από τις συναρτήσεις.', nameTok.line, 'Μετακίνησε τη δήλωση στην αρχή του αρχείου, πάνω από το setup().');
          return this.parseDeclRest(ty, nameTok);
        }
        this.pos = save;
      }
      const expr = this.parseExpr();
      this.expectOp(';');
      checkExprStatement(expr, t.line);
      return { k: 'expr', expr, line: t.line };
    }

    parseIf() {
      const t = this.next();
      if (!this.isOp('(')) throw new CodeError('Μετά το if περιμένω ( με τη συνθήκη.', t.line, 'Γράψε π.χ. if (buttonState == HIGH) { … }');
      this.next();
      const cond = this.parseExpr();
      this.expectOp(')', 'της συνθήκης του if');
      if (this.isOp(';')) {
        this.warnings.push({ line: t.line, text: 'Υπάρχει ; αμέσως μετά το if (…). Έτσι το if δεν ελέγχει τίποτα.', hint: 'Σβήσε το ; ώστε το if να ελέγχει το μπλοκ { } που ακολουθεί.' });
      }
      if (cond.k === 'assign') {
        this.warnings.push({ line: t.line, text: 'Στη συνθήκη του if υπάρχει = (ανάθεση) και όχι == (σύγκριση).', hint: 'Το = αλλάζει την τιμή της μεταβλητής. Για να ρωτήσεις «είναι ίσο;» γράψε ==.' });
      }
      const then = this.parseStatement();
      let otherwise = null;
      if (this.isId('else')) { this.next(); otherwise = this.parseStatement(); }
      return { k: 'if', cond, then, otherwise, line: t.line };
    }

    parseFor() {
      const t = this.next();
      if (!this.isOp('(')) throw new CodeError('Μετά το for περιμένω (.', t.line, 'Γράψε π.χ. for (int i = 0; i < 3; i++) { … }');
      this.next();
      let init = null;
      if (this.isOp(';')) {
        this.next();
      } else {
        const ty = this.parseType();
        if (ty) {
          const nameTok = this.next();
          init = this.parseDeclRest(ty, nameTok);
        } else {
          const e = this.parseExpr();
          init = { k: 'expr', expr: e, line: t.line };
          this.expectOp(';');
        }
      }
      let cond = null;
      if (!this.isOp(';')) cond = this.parseExpr();
      this.expectOp(';');
      let update = null;
      if (!this.isOp(')')) update = this.parseExpr();
      this.expectOp(')', 'του for');
      const body = this.parseStatement();
      return { k: 'for', init, cond, update, body, line: t.line };
    }

    parseWhile() {
      const t = this.next();
      if (!this.isOp('(')) throw new CodeError('Μετά το while περιμένω ( με τη συνθήκη.', t.line);
      this.next();
      const cond = this.parseExpr();
      this.expectOp(')', 'της συνθήκης του while');
      const body = this.parseStatement();
      return { k: 'while', cond, body, line: t.line };
    }

    parseExpr() { return this.parseAssign(); }

    parseAssign() {
      const left = this.parseOr();
      const t = this.peek();
      if (t.type === 'op' && ['=', '+=', '-=', '*=', '/='].includes(t.value)) {
        this.next();
        if (left.k !== 'var') throw new CodeError('Αριστερά από το = πρέπει να υπάρχει όνομα μεταβλητής.', t.line, 'Η ανάθεση γράφεται: μεταβλητή = τιμή; π.χ. counter = 0;');
        const value = this.parseAssign();
        return { k: 'assign', op: t.value, name: left.name, value, line: t.line };
      }
      return left;
    }

    parseLevel(nextFn, ops) {
      let a = nextFn.call(this);
      for (;;) {
        const t = this.peek();
        if (t.type === 'op' && ops.includes(t.value)) {
          this.next();
          const b = nextFn.call(this);
          a = { k: 'bin', op: t.value, a, b, line: t.line };
        } else {
          return a;
        }
      }
    }
    parseOr() { return this.parseLevel(this.parseAnd, ['||']); }
    parseAnd() { return this.parseLevel(this.parseEq, ['&&']); }
    parseEq() { return this.parseLevel(this.parseRel, ['==', '!=']); }
    parseRel() { return this.parseLevel(this.parseAdd, ['<', '>', '<=', '>=']); }
    parseAdd() { return this.parseLevel(this.parseMul, ['+', '-']); }
    parseMul() { return this.parseLevel(this.parseUnary, ['*', '/', '%']); }

    parseUnary() {
      const t = this.peek();
      if (t.type === 'op' && (t.value === '!' || t.value === '-' || t.value === '+')) {
        this.next();
        return { k: 'un', op: t.value, a: this.parseUnary(), line: t.line };
      }
      if (t.type === 'op' && (t.value === '++' || t.value === '--')) {
        this.next();
        const target = this.parseUnary();
        if (target.k !== 'var') throw new CodeError(`Το ${t.value} δουλεύει μόνο πάνω σε μεταβλητή.`, t.line);
        return { k: 'inc', op: t.value, prefix: true, name: target.name, line: t.line };
      }
      return this.parsePostfix();
    }

    parsePostfix() {
      let e = this.parsePrimary();
      while (this.isOp('++') || this.isOp('--')) {
        const t = this.next();
        if (e.k !== 'var') throw new CodeError(`Το ${t.value} δουλεύει μόνο πάνω σε μεταβλητή.`, t.line);
        e = { k: 'inc', op: t.value, prefix: false, name: e.name, line: t.line };
      }
      return e;
    }

    parsePrimary() {
      const t = this.next();
      if (t.type === 'num') return { k: 'num', v: t.value.v, float: t.value.float, line: t.line };
      if (t.type === 'str') return { k: 'str', v: t.value, line: t.line };
      if (t.type === 'op' && t.value === '(') {
        const e = this.parseExpr();
        this.expectOp(')');
        return { k: 'group', a: e, line: t.line };
      }
      if (t.type === 'id') {
        if (t.value === 'true' || t.value === 'false') return { k: 'bool', v: t.value === 'true', line: t.line };
        if (UNSUPPORTED_WORDS[t.value]) throw new CodeError(UNSUPPORTED_WORDS[t.value], t.line);
        if (TYPE_MAP[t.value] || t.value === 'const' || t.value === 'unsigned') {
          throw new CodeError(`Η λέξη ${t.value} είναι τύπος και δεν μπαίνει σε αυτό το σημείο.`, t.line, 'Οι τύποι γράφονται μόνο όταν δηλώνεις νέα μεταβλητή, π.χ. int x = 0;');
        }
        let name = t.value;
        if (this.isOp('.')) {
          this.next();
          const m = this.next();
          if (m.type !== 'id') throw new CodeError(`Μετά την τελεία περιμένω όνομα εντολής, βρήκα ${describe(m)}.`, m.line);
          name = t.value + '.' + m.value;
          if (!this.isOp('(')) throw new CodeError(`Το ${name} χρειάζεται παρενθέσεις.`, m.line, `Γράψε ${name}(…);`);
        }
        if (this.isOp('(')) {
          this.next();
          const args = [];
          if (!this.isOp(')')) {
            for (;;) {
              args.push(this.parseExpr());
              if (this.isOp(',')) { this.next(); continue; }
              break;
            }
          }
          this.expectOp(')', `της κλήσης ${name}`);
          return { k: 'call', name, args, line: t.line };
        }
        if (this.isOp('[')) throw new CodeError(SPECIAL_OPS['['], t.line);
        return { k: 'var', name, line: t.line };
      }
      if (t.type === 'eof') throw new CodeError('Ο κώδικας τελειώνει απότομα.', this.prevLine(), 'Μάλλον λείπει κάτι στο τέλος, π.χ. μια τιμή, ένα ) ή ένα }.');
      if (t.type === 'op' && t.value === ';') throw new CodeError('Περίμενα μια τιμή πριν από το ;', t.line, 'Συμπλήρωσε την τιμή που λείπει, π.χ. HIGH, LOW ή έναν αριθμό.');
      if (t.type === 'op' && t.value === ')') throw new CodeError('Περίμενα μια τιμή, αλλά βρήκα «)».', t.line, 'Οι παρενθέσεις είναι άδειες ή λείπει μια τιμή μετά από τελεστή.');
      if (t.type === 'op' && SPECIAL_OPS[t.value]) throw new CodeError(SPECIAL_OPS[t.value], t.line);
      throw new CodeError(`Δεν περίμενα ${describe(t)} σε αυτό το σημείο.`, t.line, '');
    }
  }

  function checkName(tok) {
    const n = tok.value;
    if (TYPE_MAP[n] || ['if', 'else', 'for', 'while', 'return', 'true', 'false', 'const', 'unsigned'].includes(n)) {
      throw new CodeError(`Το «${n}» είναι δεσμευμένη λέξη και δεν μπορεί να γίνει όνομα.`, tok.line, 'Διάλεξε άλλο όνομα, π.χ. myValue.');
    }
  }

  function checkExprStatement(expr, line) {
    if (expr.k === 'assign' || expr.k === 'inc' || expr.k === 'call') return;
    if (expr.k === 'var' && /^_+$/.test(expr.name)) return; // ο στατικός έλεγχος λέει «Συμπλήρωσε το κενό»
    if (expr.k === 'var' && (BUILTINS[expr.name] || expr.name === 'setup' || expr.name === 'loop')) {
      throw new CodeError(`Για να εκτελεστεί η ${expr.name} χρειάζονται παρενθέσεις.`, line, `Γράψε ${expr.name}(…);`);
    }
    if (expr.k === 'bin' && expr.op === '==') {
      throw new CodeError('Αυτή η γραμμή συγκρίνει (==) αλλά δεν αλλάζει τίποτα.', line, 'Το == ρωτά «είναι ίσο;». Για να βάλεις τιμή σε μεταβλητή χρησιμοποίησε ένα = (ανάθεση).');
    }
    throw new CodeError('Αυτή η γραμμή υπολογίζει μια τιμή αλλά δεν τη χρησιμοποιεί.', line, 'Μήπως ήθελες να την αποθηκεύσεις σε μεταβλητή με =, ή να την τυπώσεις με Serial.println(…);');
  }

  function parseDirective(t) {
    const text = t.value;
    if (/^#include\b/.test(text)) return null; // αγνοείται: η εικονική πλακέτα έχει ήδη όσα χρειάζονται
    const m = /^#define\s+([A-Za-z_]\w*)\s+(.+)$/.exec(text);
    if (m) {
      const p = new Parser(tokenize(m[2], t.line));
      const init = p.parseExpr();
      if (p.peek().type !== 'eof') throw new CodeError('Το #define δέχεται μόνο ένα όνομα και μία τιμή.', t.line, 'Γράψε π.χ. #define LIMIT 30 (χωρίς ; στο τέλος).');
      return { k: 'decl', type: 'auto', isConst: true, name: m[1], init, line: t.line };
    }
    throw new CodeError(`Η οδηγία «${text.split(/\s+/)[0]}» δεν υποστηρίζεται.`, t.line, 'Υποστηρίζονται μόνο #include (αγνοείται) και #define ΟΝΟΜΑ τιμή.');
  }

  // ---------------------------------------------------------- Στατικός έλεγχος

  function suggest(name, known) {
    const low = name.toLowerCase();
    for (const k of known) if (k.toLowerCase() === low) return k;
    return null;
  }

  function staticCheck(prog, extraConsts) {
    const consts = Object.assign({}, BOARD_CONSTS, extraConsts || {});
    const fns = prog.functions;
    const warnings = [];
    if (!fns.setup) throw new CodeError('Λείπει η συνάρτηση void setup().', 1, 'Κάθε πρόγραμμα χρειάζεται setup() (τρέχει μία φορά στην αρχή) και loop() (επαναλαμβάνεται συνέχεια).');
    if (!fns.loop) throw new CodeError('Λείπει η συνάρτηση void loop().', fns.setup.endLine || 1, 'Πρόσθεσε μετά το setup(): void loop() { } — ακόμα κι αν είναι άδεια.');
    for (const name of ['setup', 'loop']) {
      const f = fns[name];
      if (f.type !== 'void' || f.params.length) throw new CodeError(`Η ${name} πρέπει να γράφεται ακριβώς void ${name}().`, f.line, 'Δεν παίρνει παραμέτρους και δεν επιστρέφει τιμή.');
    }

    const globalNames = new Map();
    const knownNames = () => [...Object.keys(consts), ...Object.keys(BUILTINS), ...Object.keys(fns), ...globalNames.keys()];

    function lookup(name, scopes) {
      for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return scopes[i].get(name);
      if (globalNames.has(name)) return globalNames.get(name);
      if (Object.prototype.hasOwnProperty.call(consts, name)) return { isConst: true, board: true };
      return null;
    }

    function unknownName(name, line, scopes) {
      if (/^_+$/.test(name)) throw new CodeError(`Συμπλήρωσε το κενό ${name} στη γραμμή ${line}.`, line, 'Σβήσε τις κάτω παύλες και γράψε στη θέση τους τον κώδικα που ζητά η άσκηση.');
      const all = [...knownNames()];
      for (const s of scopes) all.push(...s.keys());
      const s = suggest(name, all);
      if (s) throw new CodeError(`Το «${name}» δεν υπάρχει. Μήπως εννοείς «${s}»;`, line, 'Στη C++ τα κεφαλαία και τα πεζά μετράνε: digitalWrite και digitalwrite είναι διαφορετικά ονόματα.');
      throw new CodeError(`Η μεταβλητή «${name}» δεν έχει δηλωθεί.`, line, `Δήλωσέ την πριν τη χρησιμοποιήσεις, π.χ. int ${name} = 0;`);
    }

    function expr(e, scopes) {
      switch (e.k) {
        case 'num': case 'str': case 'bool': return;
        case 'group': expr(e.a, scopes); return;
        case 'var': if (!lookup(e.name, scopes)) unknownName(e.name, e.line, scopes); return;
        case 'un': expr(e.a, scopes); return;
        case 'bin': expr(e.a, scopes); expr(e.b, scopes); return;
        case 'assign': case 'inc': {
          const v = lookup(e.name, scopes);
          if (!v) unknownName(e.name, e.line, scopes);
          if (v.board) throw new CodeError(`Το ${e.name} είναι σταθερά της πλακέτας και δεν αλλάζει.`, e.line, 'Μήπως ήθελες == (σύγκριση) αντί για = (ανάθεση);');
          if (v.isConst) throw new CodeError(`Το ${e.name} είναι σταθερά (const) και δεν αλλάζει.`, e.line, 'Αν θέλεις να αλλάζει, σβήσε το const από τη δήλωση.');
          if (e.k === 'assign') expr(e.value, scopes);
          return;
        }
        case 'call': {
          e.args.forEach(a => expr(a, scopes));
          const user = fns[e.name];
          if (user) {
            if (user.params.length !== e.args.length) throw new CodeError(`Η ${e.name}() θέλει ${user.params.length} ορίσματα, έδωσες ${e.args.length}.`, e.line);
            return;
          }
          const b = BUILTINS[e.name];
          if (b) {
            if (!b.includes(e.args.length)) {
              const want = b.join(' ή ');
              const ex = EXAMPLES[e.name];
              throw new CodeError(`Η ${e.name} θέλει ${want} ορίσματα, έδωσες ${e.args.length}.`, e.line, ex ? `Παράδειγμα: ${ex}` : '');
            }
            return;
          }
          const dot = e.name.indexOf('.');
          if (dot > 0 && ['Serial', 'WiFi', 'mqtt'].includes(e.name.slice(0, dot))) {
            const obj = e.name.slice(0, dot);
            const s = suggest(e.name, Object.keys(BUILTINS));
            const list = Object.keys(BUILTINS).filter(k => k.startsWith(obj + '.')).join(', ');
            throw new CodeError(`Το ${obj} δεν έχει εντολή «${e.name.slice(dot + 1)}».`, e.line, s ? `Μήπως εννοείς ${s};` : `Υποστηρίζονται: ${list}.`);
          }
          if (e.name.includes('.')) throw new CodeError(`Το «${e.name}» δεν υποστηρίζεται.`, e.line);
          const s = suggest(e.name, [...Object.keys(BUILTINS), ...Object.keys(fns)]);
          if (s) throw new CodeError(`Η εντολή «${e.name}» δεν υπάρχει. Μήπως εννοείς «${s}»;`, e.line, 'Στη C++ τα κεφαλαία και τα πεζά μετράνε: digitalWrite και digitalwrite είναι διαφορετικά ονόματα.');
          throw new CodeError(`Η εντολή «${e.name}» δεν υπάρχει.`, e.line, 'Έλεγξε την ορθογραφία ή δες τη λίστα υποστηριζόμενων εντολών.');
        }
      }
    }

    function stmt(s, scopes, fn) {
      switch (s.k) {
        case 'block': { scopes.push(new Map()); s.body.forEach(x => stmt(x, scopes, fn)); scopes.pop(); return; }
        case 'empty': return;
        case 'decl': {
          if (s.init) expr(s.init, scopes);
          const top = scopes[scopes.length - 1];
          if (top.has(s.name)) throw new CodeError(`Η μεταβλητή ${s.name} δηλώνεται δεύτερη φορά.`, s.line, `Για να αλλάξεις την τιμή της γράψε μόνο ${s.name} = …; χωρίς τον τύπο μπροστά.`);
          top.set(s.name, { isConst: s.isConst });
          return;
        }
        case 'expr': expr(s.expr, scopes); return;
        case 'return':
          if (s.value) {
            if (fn.type === 'void') throw new CodeError(`Η ${fn.name}() είναι void και δεν επιστρέφει τιμή.`, s.line, 'Γράψε σκέτο return; ή άλλαξε τον τύπο της συνάρτησης.');
            expr(s.value, scopes);
          }
          return;
        case 'if': expr(s.cond, scopes); stmt(s.then, scopes, fn); if (s.otherwise) stmt(s.otherwise, scopes, fn); return;
        case 'while': expr(s.cond, scopes); stmt(s.body, scopes, fn); return;
        case 'for': {
          scopes.push(new Map());
          if (s.init) stmt(s.init, scopes, fn);
          if (s.cond) expr(s.cond, scopes);
          if (s.update) expr(s.update, scopes);
          stmt(s.body, scopes, fn);
          scopes.pop();
        }
      }
    }

    // Οι αρχικές τιμές των globals μπορούν να χρησιμοποιούν μόνο ό,τι δηλώθηκε πιο πάνω.
    for (const g of prog.globals) {
      if (g.init) expr(g.init, []);
      if (globalNames.has(g.name)) throw new CodeError(`Η μεταβλητή ${g.name} δηλώνεται δεύτερη φορά.`, g.line);
      if (fns[g.name]) throw new CodeError(`Το όνομα ${g.name} χρησιμοποιείται ήδη από συνάρτηση.`, g.line);
      globalNames.set(g.name, { isConst: g.isConst });
    }
    for (const name of prog.order) {
      const fn = fns[name];
      const scope = new Map();
      fn.params.forEach(p => scope.set(p.name, { isConst: false }));
      const scopes = [scope];
      fn.body.body.forEach(x => stmt(x, scopes, fn));
    }
    return warnings;
  }

  // opts.consts: επιπλέον σταθερές της άσκησης (π.χ. MQTT_USER από ξεχωριστό αρχείο ρυθμίσεων).
  function compile(source, opts) {
    const parser = new Parser(tokenize(source));
    const program = parser.parseProgram();
    const warnings = parser.warnings.concat(staticCheck(program, opts && opts.consts));
    return { program, warnings };
  }

  // ------------------------------------------------------------- Τιμές/τύποι

  const V = (t, v) => ({ t, v });
  const VOID = V('void', 0);

  function num(x, line) {
    if (x.t === 'String') throw new CodeError('Δεν γίνεται αριθμητική πράξη ή σύγκριση μεγέθους με κείμενο.', line, 'Έλεγξε ότι και οι δύο πλευρές είναι αριθμοί.');
    if (x.t === 'void') throw new CodeError('Χρησιμοποιείς το αποτέλεσμα μιας εντολής που δεν επιστρέφει τιμή.', line, 'Εντολές όπως digitalWrite και delay κάνουν κάτι, αλλά δεν δίνουν τιμή.');
    return x.t === 'bool' ? (x.v ? 1 : 0) : x.v;
  }

  function truthy(x, line) {
    if (x.t === 'String') throw new CodeError('Μια συνθήκη δεν μπορεί να είναι κείμενο.', line, 'Χρησιμοποίησε σύγκριση, π.χ. motion == HIGH.');
    return num(x, line) !== 0;
  }

  function formatValue(x) {
    if (x.t === 'float') return Number.isNaN(x.v) ? 'nan' : x.v.toFixed(2);
    if (x.t === 'bool') return x.v ? '1' : '0';
    if (x.t === 'void') return '';
    return String(x.v);
  }

  function displayValue(x) {
    if (!x) return '—';
    if (x.t === 'String') return `"${x.v}"`;
    if (x.t === 'bool') return x.v ? 'true' : 'false';
    if (x.t === 'float') return Number.isNaN(x.v) ? 'nan' : String(Math.round(x.v * 10000) / 10000);
    return String(x.v);
  }

  function coerce(type, x, line, name) {
    if (x.t === 'void') throw new CodeError(`Η τιμή για το «${name}» προέρχεται από εντολή που δεν επιστρέφει τίποτα.`, line, 'Εντολές όπως digitalWrite και delay δεν δίνουν τιμή.');
    switch (type) {
      case 'int':
        if (x.t === 'String') throw new CodeError(`Το «${name}» είναι int (ακέραιος) και δεν μπορεί να κρατήσει κείμενο.`, line, 'Βάλε αριθμό ή άλλαξε τον τύπο σε String.');
        return V('int', Math.trunc(num(x, line)) | 0);
      case 'float':
        if (x.t === 'String') throw new CodeError(`Το «${name}» είναι float και δεν μπορεί να κρατήσει κείμενο.`, line);
        return V('float', num(x, line));
      case 'bool':
        if (x.t === 'String') throw new CodeError(`Το «${name}» είναι bool (true/false) και δεν μπορεί να κρατήσει κείμενο.`, line);
        return V('bool', num(x, line) !== 0);
      case 'String':
        return V('String', x.t === 'String' ? x.v : formatValue(x));
      default:
        return x;
    }
  }

  function defaultValue(type) {
    if (type === 'String') return V('String', '');
    if (type === 'bool') return V('bool', false);
    if (type === 'float') return V('float', 0);
    return V('int', 0);
  }

  function binop(op, a, b, line) {
    if (op === '+' && (a.t === 'String' || b.t === 'String')) {
      const s = x => (x.t === 'String' ? x.v : formatValue(x));
      return V('String', s(a) + s(b));
    }
    if (op === '==' || op === '!=') {
      let eq;
      if (a.t === 'String' || b.t === 'String') {
        if (a.t !== b.t) throw new CodeError('Συγκρίνεις κείμενο με αριθμό.', line, 'Σύγκρινε κείμενο με κείμενο ή αριθμό με αριθμό.');
        eq = a.v === b.v;
      } else {
        eq = num(a, line) === num(b, line);
      }
      return V('bool', op === '==' ? eq : !eq);
    }
    const x = num(a, line);
    const y = num(b, line);
    const isFloat = a.t === 'float' || b.t === 'float';
    const wrap = r => (isFloat ? V('float', r) : V('int', r | 0));
    switch (op) {
      case '<': return V('bool', x < y);
      case '>': return V('bool', x > y);
      case '<=': return V('bool', x <= y);
      case '>=': return V('bool', x >= y);
      case '+': return wrap(x + y);
      case '-': return wrap(x - y);
      case '*': return wrap(x * y);
      case '/':
        if (y === 0) throw new CodeError('Διαίρεση με το μηδέν.', line, 'Έλεγξε με if ότι ο διαιρέτης δεν είναι 0 πριν διαιρέσεις.');
        return isFloat ? V('float', x / y) : V('int', Math.trunc(x / y));
      case '%':
        if (isFloat) throw new CodeError('Το % (υπόλοιπο) δουλεύει μόνο με ακέραιους.', line);
        if (y === 0) throw new CodeError('Υπόλοιπο διαίρεσης με το μηδέν.', line);
        return V('int', x % y);
    }
    throw new CodeError(`Άγνωστος τελεστής ${op}.`, line);
  }

  function exprToString(e) {
    switch (e.k) {
      case 'num': return e.float ? String(e.v) : String(e.v);
      case 'str': return JSON.stringify(e.v);
      case 'bool': return e.v ? 'true' : 'false';
      case 'var': return e.name;
      case 'group': return '(' + exprToString(e.a) + ')';
      case 'un': return e.op + exprToString(e.a);
      case 'bin': return exprToString(e.a) + ' ' + e.op + ' ' + exprToString(e.b);
      case 'assign': return e.name + ' ' + e.op + ' ' + exprToString(e.value);
      case 'inc': return e.prefix ? e.op + e.name : e.name + e.op;
      case 'call': return e.name + '(' + e.args.map(exprToString).join(', ') + ')';
    }
    return '?';
  }

  function namesIn(e, out) {
    out = out || [];
    if (!e) return out;
    if (e.k === 'var' && !out.includes(e.name)) out.push(e.name);
    if (e.a) namesIn(e.a, out);
    if (e.b) namesIn(e.b, out);
    if (e.value) namesIn(e.value, out);
    if (e.args) e.args.forEach(a => namesIn(a, out));
    return out;
  }

  function stmtRange(s) {
    if (!s) return null;
    return { from: s.line, to: s.endLine || s.line };
  }

  // ------------------------------------------------------------------ Machine

  const STEP_US = 2;        // εικονικό κόστος κάθε statement
  const LOOP_OVERHEAD_US = 10;

  class Machine {
    constructor(program, board, opts) {
      opts = opts || {};
      this.prog = program;
      this.board = board;
      this.globals = new Map();
      this.frames = [];
      this.stepLimit = opts.stepLimit || 20000;
      this.consts = Object.assign({}, BOARD_CONSTS, opts.consts || {});
      this.stepsInCall = 0;
      this.totalSteps = 0;
      this.phase = 'init';
      this.loopIndex = 0;
      this.currentLine = null;
      this.lastBranch = null;
      this.changeCounter = 0;
      this.loopLog = [];
      this.loopInputs = null;
      this.loopSerialStart = 0;
    }

    mkVar(name, type, value, line, isConst, kind) {
      return { name, type, value, prev: null, line, isConst: !!isConst, kind, stamp: ++this.changeCounter };
    }

    setVar(rec, val, line) {
      rec.prev = rec.value;
      rec.value = val;
      rec.line = line;
      rec.stamp = ++this.changeCounter;
    }

    findVar(name, scope) {
      for (let s = scope; s; s = s.parent) if (s.vars.has(name)) return s.vars.get(name);
      if (this.globals.has(name)) return this.globals.get(name);
      return null;
    }

    readVar(name, scope, line) {
      const rec = this.findVar(name, scope);
      if (rec) return rec.value;
      if (Object.prototype.hasOwnProperty.call(this.consts, name)) {
        const c = this.consts[name];
        return typeof c === 'string' ? V('String', c) : V('int', c);
      }
      throw new CodeError(`Η μεταβλητή «${name}» δεν έχει δηλωθεί.`, line);
    }

    *tick(line) {
      this.currentLine = line;
      this.totalSteps++;
      this.stepsInCall++;
      this.board.advanceMicros(STEP_US);
      if (this.stepsInCall > this.stepLimit) {
        const where = this.phase === 'setup' ? 'Το setup()' : 'Αυτή η επανάληψη του loop()';
        throw new CodeError(`${where} ξεπέρασε τα ${this.stepLimit.toLocaleString('el-GR')} βήματα χωρίς να τελειώσει.`, line,
          'Μάλλον υπάρχει βρόχος (while ή for) που δεν σταματά ποτέ. Έλεγξε ότι η συνθήκη του κάποια στιγμή γίνεται false.');
      }
      yield { kind: 'line', line };
    }

    *evalExpr(e, scope) {
      switch (e.k) {
        case 'num': return V(e.float ? 'float' : 'int', e.v);
        case 'str': return V('String', e.v);
        case 'bool': return V('bool', e.v);
        case 'group': return yield* this.evalExpr(e.a, scope);
        case 'var': return this.readVar(e.name, scope, e.line);
        case 'un': {
          const a = yield* this.evalExpr(e.a, scope);
          if (e.op === '!') return V('bool', !truthy(a, e.line));
          if (e.op === '-') return V(a.t === 'float' ? 'float' : 'int', -num(a, e.line));
          return a;
        }
        case 'bin': {
          if (e.op === '&&') {
            const a = yield* this.evalExpr(e.a, scope);
            if (!truthy(a, e.line)) return V('bool', false);
            return V('bool', truthy(yield* this.evalExpr(e.b, scope), e.line));
          }
          if (e.op === '||') {
            const a = yield* this.evalExpr(e.a, scope);
            if (truthy(a, e.line)) return V('bool', true);
            return V('bool', truthy(yield* this.evalExpr(e.b, scope), e.line));
          }
          const a = yield* this.evalExpr(e.a, scope);
          const b = yield* this.evalExpr(e.b, scope);
          return binop(e.op, a, b, e.line);
        }
        case 'assign': {
          const rec = this.findVar(e.name, scope);
          if (!rec) throw new CodeError(`Η μεταβλητή «${e.name}» δεν έχει δηλωθεί.`, e.line);
          let val = yield* this.evalExpr(e.value, scope);
          if (e.op !== '=') val = binop(e.op[0], rec.value, val, e.line);
          val = coerce(rec.type, val, e.line, rec.name);
          this.setVar(rec, val, e.line);
          return val;
        }
        case 'inc': {
          const rec = this.findVar(e.name, scope);
          if (!rec) throw new CodeError(`Η μεταβλητή «${e.name}» δεν έχει δηλωθεί.`, e.line);
          const old = rec.value;
          const nv = coerce(rec.type, binop(e.op === '++' ? '+' : '-', old, V('int', 1), e.line), e.line, rec.name);
          this.setVar(rec, nv, e.line);
          return e.prefix ? nv : old;
        }
        case 'call': {
          const args = [];
          for (const a of e.args) args.push(yield* this.evalExpr(a, scope));
          const fn = this.prog.functions[e.name];
          if (fn) return yield* this.callUser(fn, args, e.line);
          if (e.name === 'esp_light_sleep_start') { yield* this.sleepWait('light', e.line); return VOID; }
          if (e.name === 'esp_deep_sleep_start') {
            this.board.checkWakeSources(e.line, 'deep');
            this.deepLine = e.line;
            throw DEEP_SLEEP;
          }
          return this.builtin(e.name, args, e.line);
        }
      }
      throw new CodeError('Άγνωστη έκφραση.', e.line);
    }

    builtin(name, args, line) {
      const b = this.board;
      switch (name) {
        case 'pinMode': b.pinMode(num(args[0], line), num(args[1], line), line); return VOID;
        case 'digitalWrite': b.digitalWrite(num(args[0], line), num(args[1], line), line); return VOID;
        case 'digitalRead': return V('int', b.digitalRead(num(args[0], line), line));
        case 'delay': {
          const ms = num(args[0], line);
          if (ms < 0) throw new CodeError('Το delay δεν δέχεται αρνητικό χρόνο.', line);
          b.advanceMicros(Math.round(ms * 1000));
          return VOID;
        }
        case 'millis': return V('int', Math.floor(b.micros / 1000));
        case 'Serial.begin': b.serialBegin(num(args[0], line), line); return VOID;
        case 'Serial.print': b.serialWrite(formatValue(args[0]), false, line); return VOID;
        case 'Serial.println': b.serialWrite(args.length ? formatValue(args[0]) : '', true, line); return VOID;
        case 'abs': { const x = num(args[0], line); return V(args[0].t === 'float' ? 'float' : 'int', Math.abs(x)); }
        case 'min': case 'max': {
          const x = num(args[0], line);
          const y = num(args[1], line);
          const r = name === 'min' ? Math.min(x, y) : Math.max(x, y);
          return V(args[0].t === 'float' || args[1].t === 'float' ? 'float' : 'int', r);
        }
        case 'isnan': return V('bool', Number.isNaN(num(args[0], line)));
        case 'toInt': case 'toFloat': {
          if (args[0].t !== 'String') throw new CodeError(`Το ${name} μετατρέπει κείμενο σε αριθμό, αλλά έδωσες ${args[0].t}.`, line);
          const m = /^\s*-?\d+(\.\d+)?/.exec(args[0].v);
          const n = m ? parseFloat(m[0]) : 0;
          return name === 'toInt' ? V('int', Math.trunc(n) | 0) : V('float', n);
        }
      }
      if (!BUILTINS[name] || !b.call) throw new CodeError(`Η εντολή «${name}» δεν υπάρχει.`, line);
      // Αισθητήρες, WiFi, mqtt και JSON: τα χειρίζεται η εικονική πλακέτα.
      return b.call(name, args.map(a => (a.t === 'String' ? a.v : num(a, line))), line, { V, CodeError, formatValue, argTypes: args.map(a => a.t) });
    }

    *callUser(fn, args, line) {
      if (this.frames.length > 40) throw new CodeError('Πάρα πολλές κλήσεις συναρτήσεων η μία μέσα στην άλλη.', line, 'Μήπως μια συνάρτηση καλεί τον εαυτό της χωρίς τέλος;');
      const scope = { vars: new Map(), parent: null };
      fn.params.forEach((p, i) => scope.vars.set(p.name, this.mkVar(p.name, p.type, coerce(p.type, args[i], line, p.name), fn.line, false, 'local')));
      const frame = { fn, current: scope };
      this.frames.push(frame);
      try {
        const r = yield* this.execList(fn.body.body, scope);
        if (fn.type === 'void') return VOID;
        if (r && r.ret && r.value) return coerce(fn.type, r.value, line, fn.name);
        throw new CodeError(`Η ${fn.name}() τελείωσε χωρίς return, αλλά πρέπει να επιστρέφει ${fn.type}.`, fn.endLine || fn.line, `Πρόσθεσε return …; στο τέλος της ${fn.name}().`);
      } finally {
        this.frames.pop();
      }
    }

    *execList(list, scope) {
      const frame = this.frames[this.frames.length - 1];
      const saved = frame ? frame.current : null;
      if (frame) frame.current = scope;
      try {
        for (const st of list) {
          const r = yield* this.exec(st, scope);
          if (r) return r;
        }
        return null;
      } finally {
        if (frame) frame.current = saved;
      }
    }

    *exec(s, scope) {
      switch (s.k) {
        case 'block': return yield* this.execList(s.body, { vars: new Map(), parent: scope });
        case 'empty': return null;
        case 'decl': {
          yield* this.tick(s.line);
          const val = s.init ? yield* this.evalExpr(s.init, scope) : defaultValue(s.type);
          const type = s.type === 'auto' ? val.t : s.type;
          scope.vars.set(s.name, this.mkVar(s.name, type, coerce(type, val, s.line, s.name), s.line, s.isConst, 'local'));
          return null;
        }
        case 'expr':
          yield* this.tick(s.line);
          yield* this.evalExpr(s.expr, scope);
          return null;
        case 'return': {
          yield* this.tick(s.line);
          const value = s.value ? yield* this.evalExpr(s.value, scope) : null;
          return { ret: true, value };
        }
        case 'if': {
          yield* this.tick(s.line);
          const c = yield* this.evalExpr(s.cond, scope);
          const ok = truthy(c, s.line);
          const vars = namesIn(s.cond).map(n => ({ name: n, value: displayValue(this.findVar(n, scope) ? this.findVar(n, scope).value : this.readVar(n, scope, s.line)) }));
          this.lastBranch = {
            line: s.line,
            cond: exprToString(s.cond),
            result: ok,
            branch: ok ? 'if' : (s.otherwise ? 'else' : 'none'),
            range: ok ? stmtRange(s.then) : stmtRange(s.otherwise),
            vars,
            step: this.totalSteps
          };
          if (ok) return yield* this.exec(s.then, scope);
          if (s.otherwise) return yield* this.exec(s.otherwise, scope);
          return null;
        }
        case 'while':
          for (;;) {
            yield* this.tick(s.line);
            const c = yield* this.evalExpr(s.cond, scope);
            if (!truthy(c, s.line)) return null;
            const r = yield* this.exec(s.body, scope);
            if (r) return r;
          }
        case 'for': {
          const fs = { vars: new Map(), parent: scope };
          const frame = this.frames[this.frames.length - 1];
          const saved = frame.current;
          frame.current = fs;
          try {
            if (s.init) yield* this.exec(s.init, fs);
            for (;;) {
              yield* this.tick(s.line);
              if (s.cond && !truthy(yield* this.evalExpr(s.cond, fs), s.line)) return null;
              const r = yield* this.exec(s.body, fs);
              if (r) return r;
              if (s.update) yield* this.evalExpr(s.update, fs);
            }
          } finally {
            frame.current = saved;
          }
        }
      }
      return null;
    }

    snapshotGlobals() {
      const out = {};
      for (const [k, rec] of this.globals) if (!rec.isConst) out[k] = displayValue(rec.value);
      return out;
    }

    // Μία «εκκίνηση» της πλακέτας: globals → setup() → loop() για πάντα.
    // Μετά από deep sleep η πλακέτα ξεκινά από την αρχή· κρατούνται μόνο οι μεταβλητές RTC_DATA_ATTR.
    *boot() {
      this.phase = 'globals';
      const old = this.globals;
      this.globals = new Map();
      for (const g of this.prog.globals) {
        if (g.rtc && old.has(g.name)) { this.globals.set(g.name, old.get(g.name)); continue; }
        const val = g.init ? yield* this.evalExpr(g.init, null) : defaultValue(g.type);
        const type = g.type === 'auto' ? val.t : g.type;
        const rec = this.mkVar(g.name, type, coerce(type, val, g.line, g.name), g.line, g.isConst, 'global');
        rec.rtc = !!g.rtc;
        this.globals.set(g.name, rec);
      }
      this.phase = 'setup';
      this.stepsInCall = 0;
      yield { kind: 'phase', phase: 'setup' };
      yield* this.callUser(this.prog.functions.setup, [], this.prog.functions.setup.line);
      for (;;) {
        this.phase = 'loop';
        this.loopIndex++;
        this.stepsInCall = 0;
        this.loopInputs = Object.assign({}, this.board.inputs);
        this.loopSerialStart = this.board.seq;
        yield { kind: 'loopStart', index: this.loopIndex };
        yield* this.callUser(this.prog.functions.loop, [], this.prog.functions.loop.line);
        this.board.advanceMicros(LOOP_OVERHEAD_US);
        this.loopLog.push({
          index: this.loopIndex,
          inputs: this.loopInputs,
          vars: this.snapshotGlobals(),
          output: this.board.serial.filter(l => l.id > this.loopSerialStart).map(l => l.text)
        });
        if (this.loopLog.length > 60) this.loopLog.shift();
        yield { kind: 'loopEnd', index: this.loopIndex };
      }
    }

    *main() {
      for (;;) {
        try {
          yield* this.boot();
        } catch (sig) {
          if (sig !== DEEP_SLEEP) throw sig;
          this.frames = [];
          this.phase = 'deep sleep';
          yield* this.sleepWait('deep', this.deepLine);
          this.board.resetForBoot();
        }
      }
    }

    // Η πλακέτα κοιμάται μέχρι να ξυπνήσει από χρονόμετρο ή από pin (ext0).
    // Κάθε κομμάτι 10 ms επιστρέφει ένα γεγονός «sleeping», ώστε να μπορούν να αλλάξουν οι είσοδοι.
    *sleepWait(mode, line) {
      const b = this.board;
      b.checkWakeSources(line, mode);
      b.goToSleep(mode);
      let cause = 0;
      for (;;) {
        const w = b.wake;
        if (w.ext0 && b.digitalRead(w.ext0.pin, line) === w.ext0.level) { cause = 2; break; }
        const end = w.timerUs !== null ? b.sleep.since + w.timerUs : null;
        if (end !== null && b.micros >= end) { cause = 4; break; }
        b.advanceMicros(end !== null ? Math.max(1, Math.min(10000, end - b.micros)) : 10000);
        yield { kind: 'sleeping', mode };
      }
      b.wakeUp(cause);
    }

    visibleVars() {
      const out = [];
      for (const rec of this.globals.values()) out.push(rec);
      const frame = this.frames[this.frames.length - 1];
      if (frame) {
        const chain = [];
        for (let s = frame.current; s; s = s.parent) chain.unshift(s);
        for (const s of chain) for (const rec of s.vars.values()) out.push(rec);
      }
      return out;
    }
  }

  root.IoTInterp = {
    CodeError, tokenize, compile, Machine, BOARD_CONSTS, BUILTINS, BUILTIN_RETURNS,
    formatValue, displayValue, exprToString
  };
})(typeof window !== 'undefined' ? window : globalThis);
