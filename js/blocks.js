/*
 * IoT Guardian — μπλοκ για μικρότερους.
 * Ο μαθητής φτιάχνει το πρόγραμμα με τουβλάκια (σαν Scratch) και δίπλα βλέπει τον ίδιο κώδικα
 * σε C++, Python, MicroPython ή Rust, όπως τον γράφει ο αληθινός προγραμματιστής.
 *   model:    { setup: [block…], loop: [block…] }
 *   block:    { t: 'led'|'light'|'wait'|'print'|'printv'|'if'|'repeat'|'set'|'change', … }
 *   generate(model, track) → κώδικας · caps(track) → ποια μπλοκ/συνθήκες υποστηρίζει η γλώσσα
 *   mount(el, model, { track, hw, onChange }) → επεξεργαστής μπλοκ (DOM)
 */
(function (root) {
  'use strict';

  const MAX = 200;
  const COLORS = { red: 'κόκκινο', yel: 'κίτρινο', grn: 'πράσινο' };
  const CONDS = {
    button: 'το κουμπί είναι πατημένο',
    pir: 'ο PIR βλέπει κίνηση',
    temp: 'η θερμοκρασία είναι πάνω από',
    dist: 'η απόσταση είναι κάτω από',
    count: 'ο μετρητής είναι τουλάχιστον'
  };
  const CAPS = {
    'cpp-esp32': ['button', 'pir', 'temp', 'dist'],
    'py-esp32': ['button', 'pir', 'temp', 'dist'],
    'py-pi': ['button', 'pir'],
    'rs-pi': ['button', 'pir'],
    'rs-esp32': ['button', 'pir']
  };
  const caps = track => CAPS[track] || CAPS['cpp-esp32'];
  // Python στο Pi (gpiozero): το εικονικό Pi δεν έχει φανάρι για την Python
  const hasTraffic = track => track !== 'py-pi';

  // ------------------------------------------------------------ μοντέλο

  const num = (v, d, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const txt = v => String(v == null ? '' : v).replace(/[\u0000-\u001f"\\`{}$]/g, '').slice(0, 60);
  function normBlock(b, depth, count) {
    if (!b || typeof b !== 'object' || count.n++ > MAX) return null;
    switch (b.t) {
      case 'led': return { t: 'led', on: !!b.on };
      case 'light': return { t: 'light', c: COLORS[b.c] ? b.c : 'red', on: !!b.on };
      case 'wait': return { t: 'wait', ms: num(b.ms, 500, 1, 60000) };
      case 'print': return { t: 'print', text: txt(b.text) };
      case 'printv': return { t: 'printv', v: ['count', 'temp', 'dist'].includes(b.v) ? b.v : 'count' };
      case 'set': return { t: 'set', n: num(b.n, 0, -9999, 9999) };
      case 'change': return { t: 'change', n: num(b.n, 1, -9999, 9999) };
      case 'if':
        if (depth > 4) return null;
        return { t: 'if', c: CONDS[b.c] ? b.c : 'button', n: num(b.n, 30, -999, 9999), then: normList(b.then, depth + 1, count), else: Array.isArray(b.else) ? normList(b.else, depth + 1, count) : null };
      case 'repeat':
        if (depth > 4) return null;
        return { t: 'repeat', n: num(b.n, 3, 1, 100), body: normList(b.body, depth + 1, count) };
      default: return null;
    }
  }
  function normList(a, depth, count) { return (Array.isArray(a) ? a : []).map(b => normBlock(b, depth, count)).filter(Boolean); }
  function normalize(m) {
    const count = { n: 0 };
    return { setup: normList(m && m.setup, 0, count), loop: normList(m && m.loop, 0, count) };
  }
  // Τι χρησιμοποιεί το πρόγραμμα (για να δηλωθούν μόνο τα pins που χρειάζονται)
  function uses(m) {
    const u = { led: false, light: {}, button: false, pir: false, temp: false, dist: false, count: false, countSet: false };
    const walk = list => list.forEach(b => {
      if (b.t === 'led') u.led = true;
      if (b.t === 'light') u.light[b.c] = true;
      if (b.t === 'printv') u[b.v] = true;
      if (b.t === 'set' || b.t === 'change') { u.count = true; u.countSet = true; }
      if (b.t === 'if') { u[b.c] = true; walk(b.then); if (b.else) walk(b.else); }
      if (b.t === 'repeat') walk(b.body);
    });
    walk(m.setup);
    walk(m.loop);
    return u;
  }

  // ------------------------------------------------------------ παραγωγή κώδικα

  const LIGHT_PIN = {
    cpp: { red: 'RED_PIN', yel: 'YELLOW_PIN', grn: 'GREEN_PIN' },
    pyesp: { red: 25, yel: 26, grn: 27 }, pypi: { red: 16, yel: 20, grn: 21 },
    rspi: { red: 16, yel: 20, grn: 21 }, rsesp: { red: 25, yel: 26, grn: 27 }
  };
  const VAR = { red: 'red', yel: 'yellow', grn: 'green' };

  function genCpp(m) {
    const u = uses(m);
    const L = [];
    const body = (list, ind, d) => list.forEach(b => {
      const p = ' '.repeat(ind);
      switch (b.t) {
        case 'led': L.push(`${p}digitalWrite(LED_PIN, ${b.on ? 'HIGH' : 'LOW'});`); break;
        case 'light': L.push(`${p}digitalWrite(${LIGHT_PIN.cpp[b.c]}, ${b.on ? 'HIGH' : 'LOW'});`); break;
        case 'wait': L.push(`${p}delay(${b.ms});`); break;
        case 'print': L.push(`${p}Serial.println("${b.text}");`); break;
        case 'printv': L.push(`${p}Serial.println(${b.v === 'count' ? 'count' : b.v === 'temp' ? 'readTemperature()' : 'distanceCm()'});`); break;
        case 'set': L.push(`${p}count = ${b.n};`); break;
        case 'change': L.push(`${p}count = count + ${b.n};`); break;
        case 'if': {
          const c = { button: 'digitalRead(BUTTON_PIN) == HIGH', pir: 'digitalRead(PIR_PIN) == HIGH', temp: `readTemperature() > ${b.n}`, dist: `distanceCm() < ${b.n}`, count: `count >= ${b.n}` }[b.c];
          L.push(`${p}if (${c}) {`); body(b.then, ind + 2, d + 1);
          if (b.else) { L.push(`${p}} else {`); body(b.else, ind + 2, d + 1); }
          L.push(`${p}}`); break;
        }
        case 'repeat': { const v = 'ijkmn'[d] || 'r'; L.push(`${p}for (int ${v} = 0; ${v} < ${b.n}; ${v}++) {`); body(b.body, ind + 2, d + 1); L.push(`${p}}`); break; }
      }
    });
    L.push('// Αυτόν τον κώδικα τον έφτιαξαν τα μπλοκ σου.');
    if (u.count) L.push('int count = 0;   // ο μετρητής');
    if (u.dist) L.push('', 'float distanceCm() {', '  digitalWrite(TRIG_PIN, LOW);', '  delayMicroseconds(2);', '  digitalWrite(TRIG_PIN, HIGH);', '  delayMicroseconds(10);', '  digitalWrite(TRIG_PIN, LOW);', '  long duration = pulseIn(ECHO_PIN, HIGH);', '  return duration * 0.0343 / 2;', '}');
    L.push('', 'void setup() {', '  Serial.begin(115200);');
    if (u.led) L.push('  pinMode(LED_PIN, OUTPUT);');
    for (const c of Object.keys(u.light)) L.push(`  pinMode(${LIGHT_PIN.cpp[c]}, OUTPUT);`);
    if (u.button) L.push('  pinMode(BUTTON_PIN, INPUT);');
    if (u.pir) L.push('  pinMode(PIR_PIN, INPUT);');
    if (u.dist) L.push('  pinMode(TRIG_PIN, OUTPUT);', '  pinMode(ECHO_PIN, INPUT);');
    body(m.setup, 2, 0);
    L.push('}', '', 'void loop() {');
    body(m.loop, 2, 0);
    if (!m.loop.length) L.push('  delay(100);');
    L.push('}', '');
    return L.join('\n');
  }

  function genPy(m, pi) {
    const u = uses(m);
    const L = [];
    const body = (list, ind, d) => {
      if (!list.length) { L.push(' '.repeat(ind) + 'pass'); return; }
      list.forEach(b => {
        const p = ' '.repeat(ind);
        switch (b.t) {
          case 'led': L.push(`${p}led.${b.on ? 'on' : 'off'}()`); break;
          case 'light': L.push(`${p}${VAR[b.c]}.${b.on ? 'on' : 'off'}()`); break;
          case 'wait': L.push(pi ? `${p}time.sleep(${b.ms / 1000})` : `${p}time.sleep_ms(${b.ms})`); break;
          case 'print': L.push(`${p}print("${b.text}")`); break;
          case 'printv': L.push(`${p}print(${b.v === 'count' ? 'count' : b.v === 'temp' ? 'temperature()' : 'distance_cm()'})`); break;
          case 'set': L.push(`${p}count = ${b.n}`); break;
          case 'change': L.push(`${p}count = count + ${b.n}`); break;
          case 'if': {
            const c = pi
              ? { button: 'button.is_pressed', pir: 'pir.motion_detected', count: `count >= ${b.n}` }[b.c]
              : { button: 'button.value() == 1', pir: 'pir.value() == 1', temp: `temperature() > ${b.n}`, dist: `distance_cm() < ${b.n}`, count: `count >= ${b.n}` }[b.c];
            L.push(`${p}if ${c}:`); body(b.then, ind + 4, d + 1);
            if (b.else) { L.push(`${p}else:`); body(b.else, ind + 4, d + 1); }
            break;
          }
          case 'repeat': L.push(`${p}for ${'ijkmn'[d] || 'r'} in range(${b.n}):`); body(b.body, ind + 4, d + 1); break;
        }
      });
    };
    L.push('# Αυτόν τον κώδικα τον έφτιαξαν τα μπλοκ σου.');
    if (pi) {
      const imp = [u.led || Object.keys(u.light).length ? 'LED' : null, u.button ? 'Button' : null, u.pir ? 'MotionSensor' : null].filter(Boolean);
      if (imp.length) L.push(`from gpiozero import ${imp.join(', ')}`);
      L.push('import time', '');
      if (u.led) L.push('led = LED(17)');
      for (const c of Object.keys(u.light)) L.push(`${VAR[c]} = LED(${LIGHT_PIN.pypi[c]})`);
      if (u.button) L.push('button = Button(27)');
      if (u.pir) L.push('pir = MotionSensor(4)');
    } else {
      L.push(`from machine import Pin${u.dist ? ', time_pulse_us' : ''}`);
      if (u.temp) L.push('import dht');
      L.push('import time', '');
      if (u.led) L.push('led = Pin(2, Pin.OUT)');
      for (const c of Object.keys(u.light)) L.push(`${VAR[c]} = Pin(${LIGHT_PIN.pyesp[c]}, Pin.OUT)`);
      if (u.button) L.push('button = Pin(15, Pin.IN)');
      if (u.pir) L.push('pir = Pin(4, Pin.IN)');
      if (u.temp) L.push('sensor = dht.DHT22(Pin(13))', '', 'def temperature():', '    sensor.measure()', '    return sensor.temperature()');
      if (u.dist) L.push('trig = Pin(5, Pin.OUT)', 'echo = Pin(18, Pin.IN)', '', 'def distance_cm():', '    trig.off()', '    time.sleep_us(2)', '    trig.on()', '    time.sleep_us(10)', '    trig.off()', '    us = time_pulse_us(echo, 1, 30000)', '    return us / 58.3');
    }
    if (u.count) L.push('count = 0   # ο μετρητής');
    L.push('');
    if (m.setup.length) { body(m.setup, 0, 0); L.push(''); }
    L.push('while True:');
    if (m.loop.length) body(m.loop, 4, 0); else L.push(pi ? '    time.sleep(0.1)' : '    time.sleep_ms(100)');
    L.push('');
    return L.join('\n');
  }

  function genRust(m, pi) {
    const u = uses(m);
    const L = [];
    const q = pi ? '' : '?';
    const body = (list, ind, d) => list.forEach(b => {
      const p = ' '.repeat(ind);
      switch (b.t) {
        case 'led': L.push(`${p}led.set_${b.on ? 'high' : 'low'}()${q};`); break;
        case 'light': L.push(`${p}${VAR[b.c]}.set_${b.on ? 'high' : 'low'}()${q};`); break;
        case 'wait': L.push(pi ? `${p}thread::sleep(Duration::from_millis(${b.ms}));` : `${p}FreeRtos::delay_ms(${b.ms});`); break;
        case 'print': L.push(`${p}println!("${b.text}");`); break;
        case 'printv': L.push(`${p}println!("{}", count);`); break;
        case 'set': L.push(`${p}count = ${b.n};`); break;
        case 'change': L.push(`${p}count += ${b.n};`); break;
        case 'if': {
          const c = { button: 'button.is_high()', pir: 'pir.is_high()', count: `count >= ${b.n}` }[b.c] || 'false';
          L.push(`${p}if ${c} {`); body(b.then, ind + 4, d + 1);
          if (b.else) { L.push(`${p}} else {`); body(b.else, ind + 4, d + 1); }
          L.push(`${p}}`); break;
        }
        case 'repeat': L.push(`${p}for _ in 0..${b.n} {`); body(b.body, ind + 4, d + 1); L.push(`${p}}`); break;
      }
    });
    L.push('// Αυτόν τον κώδικα τον έφτιαξαν τα μπλοκ σου.');
    if (pi) {
      L.push('use rppal::gpio::Gpio;', 'use std::error::Error;', 'use std::thread;', 'use std::time::Duration;', '', 'fn main() -> Result<(), Box<dyn Error>> {', '    let gpio = Gpio::new()?;');
      if (u.led) L.push('    let mut led = gpio.get(17)?.into_output();');
      for (const c of Object.keys(u.light)) L.push(`    let mut ${VAR[c]} = gpio.get(${LIGHT_PIN.rspi[c]})?.into_output();`);
      if (u.button) L.push('    let button = gpio.get(27)?.into_input();');
      if (u.pir) L.push('    let pir = gpio.get(4)?.into_input();');
    } else {
      L.push('use esp_idf_svc::hal::delay::FreeRtos;', 'use esp_idf_svc::hal::gpio::PinDriver;', 'use esp_idf_svc::hal::peripherals::Peripherals;', '', 'fn main() -> anyhow::Result<()> {', '    esp_idf_svc::sys::link_patches();', '    let peripherals = Peripherals::take()?;');
      if (u.led) L.push('    let mut led = PinDriver::output(peripherals.pins.gpio2)?;');
      for (const c of Object.keys(u.light)) L.push(`    let mut ${VAR[c]} = PinDriver::output(peripherals.pins.gpio${LIGHT_PIN.rsesp[c]})?;`);
      if (u.button) L.push('    let button = PinDriver::input(peripherals.pins.gpio15)?;');
      if (u.pir) L.push('    let pir = PinDriver::input(peripherals.pins.gpio4)?;');
    }
    if (u.count) L.push(`    let ${u.countSet ? 'mut ' : ''}count: i32 = 0;   // ο μετρητής`);
    body(m.setup, 4, 0);
    L.push('', '    loop {');
    body(m.loop, 8, 0);
    if (!m.loop.length) L.push(pi ? '        thread::sleep(Duration::from_millis(100));' : '        FreeRtos::delay_ms(100);');
    L.push('    }', '}', '');
    return L.join('\n');
  }

  function generate(model, track) {
    const m = normalize(model);
    if (track === 'py-pi') return genPy(m, true);
    if (track === 'py-esp32') return genPy(m, false);
    if (track === 'rs-pi') return genRust(m, true);
    if (track === 'rs-esp32') return genRust(m, false);
    return genCpp(m);
  }

  // ------------------------------------------------------------ επεξεργαστής μπλοκ (DOM)

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PALETTE = [
    { t: 'led', icon: '💡', label: 'LED', make: () => ({ t: 'led', on: true }) },
    { t: 'light', icon: '🚦', label: 'Φανάρι', make: () => ({ t: 'light', c: 'red', on: true }), hw: 'traffic' },
    { t: 'wait', icon: '⏱', label: 'Περίμενε', make: () => ({ t: 'wait', ms: 500 }) },
    { t: 'print', icon: '💬', label: 'Τύπωσε', make: () => ({ t: 'print', text: 'Γεια!' }) },
    { t: 'printv', icon: '🔢', label: 'Τύπωσε τιμή', make: () => ({ t: 'printv', v: 'count' }) },
    { t: 'if', icon: '❓', label: 'Αν … τότε', make: () => ({ t: 'if', c: 'button', n: 30, then: [], else: null }) },
    { t: 'repeat', icon: '🔁', label: 'Επανάλαβε', make: () => ({ t: 'repeat', n: 3, body: [] }) },
    { t: 'set', icon: '🔢', label: 'Όρισε μετρητή', make: () => ({ t: 'set', n: 0 }) },
    { t: 'change', icon: '➕', label: 'Άλλαξε μετρητή', make: () => ({ t: 'change', n: 1 }) }
  ];
  const CAT = { led: 'out', light: 'out', wait: 'time', print: 'say', printv: 'say', if: 'ctl', repeat: 'ctl', set: 'var', change: 'var' };

  function mount(el, model, opts) {
    let m = normalize(model);
    let target = 'loop';
    let drag = null;
    const capsOf = caps(opts.track);
    const hw = opts.hw || [];
    const condOk = c => c === 'count' || (capsOf.includes(c) && (c === 'button' ? hw.includes('button') : c === 'pir' ? hw.includes('pir') : c === 'temp' ? hw.includes('sensor') : c === 'dist' ? hw.includes('ultrasonic') : true));
    const valOk = v => v === 'count' || condOk(v);
    const listAt = path => {
      const parts = path.split('.');
      let list = m[parts[0]];
      for (let i = 1; i < parts.length; i += 2) {
        const b = list[Number(parts[i])];
        list = b[parts[i + 1]];
      }
      return list;
    };
    const blockAt = path => { const i = path.lastIndexOf('.'); return listAt(path.slice(0, i))[Number(path.slice(i + 1))]; };
    const changed = () => opts.onChange(m, generate(m, opts.track));

    const sel = (key, val, options) => `<select data-k="${key}">${Object.entries(options).map(([k, v]) => `<option value="${k}"${k === String(val) ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    const numIn = (key, val, w) => `<input type="number" data-k="${key}" value="${val}" style="width:${w || 4.2}rem">`;
    function blockHTML(b, path) {
      let inner = '';
      switch (b.t) {
        case 'led': inner = `💡 LED ${sel('on', b.on ? 1 : 0, { 1: 'ανάβει', 0: 'σβήνει' })}`; break;
        case 'light': inner = `🚦 Φανάρι ${sel('c', b.c, COLORS)} ${sel('on', b.on ? 1 : 0, { 1: 'ανάβει', 0: 'σβήνει' })}`; break;
        case 'wait': inner = `⏱ Περίμενε ${numIn('ms', b.ms, 5)} ms`; break;
        case 'print': inner = `💬 Τύπωσε <input type="text" data-k="text" value="${esc(b.text)}" maxlength="60" style="width:8rem">`; break;
        case 'printv': { const o = { count: 'τον μετρητή', temp: 'τη θερμοκρασία', dist: 'την απόσταση' }; Object.keys(o).forEach(k => { if (!valOk(k)) delete o[k]; }); inner = `🔢 Τύπωσε ${sel('v', b.v, o)}`; break; }
        case 'set': inner = `🔢 Όρισε μετρητή σε ${numIn('n', b.n)}`; break;
        case 'change': inner = `➕ Άλλαξε μετρητή κατά ${numIn('n', b.n)}`; break;
        case 'if': {
          const o = {};
          Object.keys(CONDS).forEach(k => { if (condOk(k)) o[k] = CONDS[k]; });
          inner = `❓ Αν ${sel('c', b.c, o)}${['temp', 'dist', 'count'].includes(b.c) ? ' ' + numIn('n', b.n) + (b.c === 'temp' ? ' °C' : b.c === 'dist' ? ' cm' : '') : ''} τότε
            <label class="bk-else"><input type="checkbox" data-k="else"${b.else ? ' checked' : ''}> αλλιώς</label>`;
          break;
        }
        case 'repeat': inner = `🔁 Επανάλαβε ${numIn('n', b.n, 3.5)} φορές`; break;
      }
      const tools = `<span class="bk-tools"><button type="button" data-act="up" aria-label="Πάνω">▲</button><button type="button" data-act="down" aria-label="Κάτω">▼</button><button type="button" data-act="del" aria-label="Διαγραφή">✕</button></span>`;
      let kids = '';
      if (b.t === 'if') kids = slotHTML(b.then, path + '.then', 'τότε') + (b.else ? slotHTML(b.else, path + '.else', 'αλλιώς') : '');
      if (b.t === 'repeat') kids = slotHTML(b.body, path + '.body', '');
      return `<div class="bk bk-${CAT[b.t]}" data-path="${path}" draggable="true"><div class="bk-row"><span class="bk-grip" aria-hidden="true">⠿</span><span class="bk-in">${inner}</span>${tools}</div>${kids}</div>`;
    }
    function slotHTML(list, path, label) {
      return `<div class="bk-slot${target === path ? ' active' : ''}" data-slot="${path}">${label ? `<span class="bk-slot-l">${label}</span>` : ''}
        ${list.map((b, i) => `<div class="bk-drop" data-drop="${path}" data-i="${i}"></div>${blockHTML(b, path + '.' + i)}`).join('')}
        <div class="bk-drop end" data-drop="${path}" data-i="${list.length}">${list.length ? '' : 'σύρε ή πάτα ένα μπλοκ'}</div></div>`;
    }
    function render() {
      const pal = PALETTE.filter(p => !p.hw || (hw.includes(p.hw) && (p.hw !== 'traffic' || hasTraffic(opts.track))));
      el.innerHTML = `<div class="bk-pal" role="group" aria-label="Μπλοκ">${pal.map(p => `<button type="button" class="bk-p bk-${CAT[p.t]}" data-new="${p.t}" draggable="true">${p.icon} ${esc(p.label)}</button>`).join('')}</div>
        <p class="bk-hint">Πάτα ένα μπλοκ για να μπει στο κομμάτι με το κίτρινο περίγραμμα, ή σύρε το όπου θέλεις.</p>
        <div class="bk-prog">
          <div class="bk-hat bk-hat-setup" data-target="setup">▶ Στην αρχή (μία φορά)</div>${slotHTML(m.setup, 'setup', '')}
          <div class="bk-hat" data-target="loop">🔁 Για πάντα</div>${slotHTML(m.loop, 'loop', '')}
        </div>`;
    }
    const insert = (path, i, b) => { const list = listAt(path); list.splice(Math.min(i, list.length), 0, b); };
    const removeAt = path => { const i = path.lastIndexOf('.'); const list = listAt(path.slice(0, i)); return list.splice(Number(path.slice(i + 1)), 1)[0]; };

    el.addEventListener('click', e => {
      const nb = e.target.closest('[data-new]');
      if (nb) { const p = PALETTE.find(x => x.t === nb.dataset.new); insert(target, 1e9, p.make()); render(); changed(); return; }
      const act = e.target.closest('[data-act]');
      if (act) {
        const path = act.closest('.bk').dataset.path;
        const i = path.lastIndexOf('.');
        const list = listAt(path.slice(0, i));
        const k = Number(path.slice(i + 1));
        if (act.dataset.act === 'del') { list.splice(k, 1); if (target.startsWith(path)) target = 'loop'; }
        if (act.dataset.act === 'up' && k > 0) [list[k - 1], list[k]] = [list[k], list[k - 1]];
        if (act.dataset.act === 'down' && k < list.length - 1) [list[k + 1], list[k]] = [list[k], list[k + 1]];
        render(); changed(); return;
      }
      const hat = e.target.closest('[data-target]');
      const slot = hat ? null : e.target.closest('[data-slot]');
      if (hat || (slot && !e.target.closest('select, input, label'))) { target = hat ? hat.dataset.target : slot.dataset.slot; render(); }
    });
    const onEdit = e => {
      const k = e.target.dataset.k;
      if (!k) return;
      const b = blockAt(e.target.closest('.bk').dataset.path);
      if (k === 'else') { b.else = e.target.checked ? (b.else || []) : null; render(); }
      else if (k === 'on') b.on = e.target.value === '1';
      else if (k === 'text') b.text = txt(e.target.value);
      else if (k === 'c' || k === 'v') { b[k] = e.target.value; if (b.t === 'if') render(); }
      else b[k] = num(e.target.value, b[k], k === 'ms' ? 1 : -9999, k === 'ms' ? 60000 : 9999);
      changed();
    };
    el.addEventListener('change', onEdit);
    el.addEventListener('input', e => { if (e.target.matches('input[type=number], input[type=text]')) onEdit(e); });
    // σύρσιμο: από την παλέτα (νέο μπλοκ) ή από το πρόγραμμα (μετακίνηση)
    el.addEventListener('dragstart', e => {
      const nb = e.target.closest('[data-new]');
      const bk = e.target.closest('.bk');
      drag = nb ? { t: nb.dataset.new } : bk ? { path: bk.dataset.path } : null;
      if (drag && e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'block'); }
      e.stopPropagation();
    });
    el.addEventListener('dragover', e => { const d = e.target.closest('[data-drop]'); if (drag && d) { e.preventDefault(); el.querySelectorAll('.bk-drop.over').forEach(x => x.classList.remove('over')); d.classList.add('over'); } });
    el.addEventListener('drop', e => {
      const d = e.target.closest('[data-drop]');
      if (!drag || !d) return;
      e.preventDefault();
      const to = d.dataset.drop;
      let i = Number(d.dataset.i);
      if (drag.t) insert(to, i, PALETTE.find(x => x.t === drag.t).make());
      else {
        if (to === drag.path || to.startsWith(drag.path + '.')) { drag = null; render(); return; } // όχι μέσα στον εαυτό του
        const from = drag.path;
        const fi = from.lastIndexOf('.');
        const fromList = from.slice(0, fi);
        const fk = Number(from.slice(fi + 1));
        const b = removeAt(from);
        if (fromList === to && fk < i) i--;
        insert(to, i, b);
      }
      drag = null;
      render(); changed();
    });
    el.addEventListener('dragend', () => { drag = null; el.querySelectorAll('.bk-drop.over').forEach(x => x.classList.remove('over')); });

    render();
    return { model: () => m, set: nm => { m = normalize(nm); render(); changed(); } };
  }

  // Ένα πρώτο πρόγραμμα-παράδειγμα: αναβοσβήνει το LED
  const STARTER = () => ({ setup: [{ t: 'print', text: 'Γεια σου, κόσμε!' }], loop: [{ t: 'led', on: true }, { t: 'wait', ms: 500 }, { t: 'led', on: false }, { t: 'wait', ms: 500 }] });

  root.IoTBlocks = { normalize, generate, caps, uses, mount, STARTER, CONDS };
})(typeof window !== 'undefined' ? window : globalThis);
