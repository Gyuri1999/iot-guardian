/*
 * IoT Guardian — η «βιβλιοθήκη» της Rust: μέθοδοι για String, Vec, Option, Result, αριθμούς,
 * std::thread / std::time, rppal::gpio (Raspberry Pi) και esp_idf_svc::hal (ESP32).
 */
(function (root) {
  'use strict';

  const RT = root.IoTRustRT;
  const { RustMachine, I, F, B, S, UNIT, SOME, NONE, OK, ERR, INT_RANGE, isIntTy, checkRange, panic, rerr, display, debug, isCopy, clone, deref, eqVal, cmpVal, typeOfVal, utf8, PI_MAP, ESP_MAP, PIN_WORD, LIB } = RT;
  const { CodeError } = root.IoTInterp;

  const fn = (name, call) => ({ t: 'builtin', name, call });
  const errVal = (msg, dbg, ty) => ({ t: 'err', msg, debug: dbg || JSON.stringify(msg), ty: ty || 'Error' });
  const argInt = (a, what, line) => {
    const v = deref(a);
    if (!v || v.t !== 'int') throw rerr('E0308', `mismatched types: expected integer, found \`${v ? typeOfVal(v) : 'nothing'}\``, line, `Το ${what} θέλει ακέραιο αριθμό.`);
    return v.v;
  };
  const argNum = (a, what, line) => {
    const v = deref(a);
    if (!v || (v.t !== 'int' && v.t !== 'float')) throw rerr('E0308', 'mismatched types', line, `Το ${what} θέλει αριθμό.`);
    return v.v;
  };
  const need = (args, n, name, line) => {
    if (args.length !== n) throw rerr('E0061', `this method takes ${n} argument${n === 1 ? '' : 's'} but ${args.length} argument${args.length === 1 ? ' was' : 's were'} supplied`, line, `Η .${name}() θέλει ${n} τιμ${n === 1 ? 'ή' : 'ές'}.`);
  };
  const noMethod = (v, name, line, hint) => {
    throw rerr('E0599', `no method named \`${name}\` found for ${v.t === 'struct' ? 'struct' : v.t === 'enum' ? 'enum' : 'type'} \`${typeOfVal(v)}\` in the current scope`, line, hint || '');
  };

  // ------------------------------------------------------------ std::time
  const durOf = (us) => ({ t: 'dur', us: Math.round(us) });
  LIB['std::time::Duration'] = {
    value: {
      t: 'type', name: 'Duration',
      assoc: {
        from_millis: (m, a, line) => durOf(argInt(a[0], 'Duration::from_millis', line) * 1000),
        from_secs: (m, a, line) => durOf(argInt(a[0], 'Duration::from_secs', line) * 1e6),
        from_micros: (m, a, line) => durOf(argInt(a[0], 'Duration::from_micros', line)),
        from_secs_f32: (m, a, line) => durOf(argNum(a[0], 'Duration::from_secs_f32', line) * 1e6),
        from_secs_f64: (m, a, line) => durOf(argNum(a[0], 'Duration::from_secs_f64', line) * 1e6)
      },
      consts: { ZERO: () => durOf(0) }
    }
  };
  LIB['std::time::Instant'] = { value: m => ({ t: 'type', name: 'Instant', assoc: { now: mm => ({ t: 'inst', us: mm.board.micros }) } }) };
  LIB['std::thread::sleep'] = {
    value: fn('sleep', (a, line, m) => {
      const d = deref(a[0]);
      if (!d || d.t !== 'dur') throw rerr('E0308', `mismatched types: expected \`Duration\`, found \`${d ? typeOfVal(d) : '()'}\``, line, 'Το thread::sleep θέλει Duration, π.χ. thread::sleep(Duration::from_millis(500)).');
      return (function* () { yield* m.wait(d.us); return UNIT; })();
    })
  };
  LIB['std::process::exit'] = { value: fn('exit', (a, line, m) => { m.finished = true; throw { signal: 'exit', line }; }) };
  LIB['std::error::Error'] = { value: { t: 'trait', name: 'Error' } };
  // String και Vec (στο prelude: δεν χρειάζονται use)
  LIB.String = {
    value: {
      t: 'type', name: 'String',
      assoc: {
        new: () => S('', true),
        from: (m, a, line) => { const v = deref(a[0]); if (!v || v.t !== 'str') throw rerr('E0277', `the trait bound \`String: From<${v ? typeOfVal(v) : '()'}>\` is not satisfied`, line, 'Το String::from θέλει κείμενο σε "…".'); return S(v.v, true); },
        with_capacity: () => S('', true)
      }
    }
  };
  LIB.Vec = { value: { t: 'type', name: 'Vec', assoc: { new: () => ({ t: 'vec', v: [] }), with_capacity: () => ({ t: 'vec', v: [] }) } } };
  LIB['anyhow::Result'] = { value: { t: 'trait', name: 'Result' } };
  LIB['anyhow::Error'] = { value: { t: 'trait', name: 'Error' } };
  LIB['std::cmp::Ordering'] = { value: { t: 'type', name: 'Ordering' } };

  // ------------------------------------------------------------ Raspberry Pi: rppal::gpio
  const LEVEL = v => ({ t: 'level', v: !!v });
  LIB['rppal::gpio::Level'] = { board: 'pi', value: { t: 'type', name: 'Level', consts: { High: () => LEVEL(1), Low: () => LEVEL(0) } } };
  LIB['rppal::gpio::Gpio'] = {
    board: 'pi',
    value: { t: 'type', name: 'Gpio', assoc: { new: m => OK(gpioObj(m)) } }
  };

  // Ποιο εξάρτημα του εικονικού πάγκου είναι στο pin n (ή null).
  function wired(m, n) {
    const map = m.target === 'pi' ? PI_MAP : ESP_MAP;
    const key = map[n];
    return key ? { key, pin: m.PINS[key] } : null;
  }
  function readInput(m, n, line) {
    const w = wired(m, n);
    if (!w) {
      m.board.warnOnce('rsnc' + n, line, `Διαβάζεις το GPIO ${n}, όπου δεν είναι συνδεδεμένο τίποτα στον εικονικό πάγκο. Η τιμή θα είναι πάντα Low.`, pinHelp(m));
      return 0;
    }
    if (w.key === 'BUTTON') return m.board.inputs.button ? 1 : 0;
    if (w.key === 'PIR') return m.board.inputs.pir ? 1 : 0;
    if (w.key === 'ECHO') return m.board.echoLevel();
    return m.board.outputs[w.pin] || 0;
  }
  function writeOutput(m, n, v, line) {
    const w = wired(m, n);
    if (!w) { m.board.warnOnce('rsncw' + n, line, `Γράφεις στο GPIO ${n}, όπου δεν είναι συνδεδεμένο τίποτα.`, pinHelp(m)); return; }
    if (w.key === 'BUTTON' || w.key === 'PIR' || w.key === 'ECHO') {
      m.board.warnOnce('rsin' + n, line, `Στο GPIO ${n} είναι ${PIN_WORD[w.key]}, που είναι είσοδος. Δεν αλλάζει τίποτα αν γράψεις εκεί.`, 'Για είσοδο φτιάξε pin εισόδου και διάβασέ το με is_high() / is_low().');
      return;
    }
    m.board.modes[w.pin] = 3;
    m.board.digitalWrite(w.pin, v, line);
  }
  function setupPin(m, n, mode) {
    const w = wired(m, n);
    if (w) m.board.modes[w.pin] = mode;
  }
  function pinHelp(m) {
    return m.target === 'pi'
      ? 'Στον εικονικό πάγκο: LED = GPIO 17, κουμπί = GPIO 27, PIR = GPIO 4, TRIG = GPIO 23, ECHO = GPIO 24, φανάρι = GPIO 16 / 20 / 21.'
      : 'Στον εικονικό πάγκο: LED = GPIO 2, κουμπί = GPIO 15, PIR = GPIO 4, TRIG = GPIO 5, ECHO = GPIO 18, φανάρι = GPIO 25 / 26 / 27.';
  }

  function gpioObj(m) {
    return {
      t: 'obj', cls: 'Gpio',
      debug: () => 'Gpio',
      short: () => 'Gpio (ελεγκτής των pins)',
      methods: {
        get(args, line) {
          need(args, 1, 'get', line);
          const n = argInt(args[0], 'gpio.get', line);
          if (n < 0 || n > 27) return ERR(errVal(`Pin ${n} is not available`, `PinNotAvailable(${n})`, 'rppal::gpio::Error'));
          if (m.usedPins.has(n)) return ERR(errVal(`Pin ${n} is already in use`, `PinUsed(${n})`, 'rppal::gpio::Error'));
          m.usedPins.add(n);
          return OK(piPin(m, n));
        }
      }
    };
  }
  function piPin(m, n) {
    const into = (kind, init) => () => {
      if (kind === 'out') { setupPin(m, n, 3); if (init !== undefined) writeOutput(m, n, init, null); return piOutput(m, n); }
      setupPin(m, n, kind === 'pullup' ? 5 : 1);
      return piInput(m, n);
    };
    return {
      t: 'obj', cls: 'Pin', moveOnly: true,
      debug: () => `Pin { pin: ${n} }`,
      short: () => `Pin(GPIO ${n}) · δεν έχει ρυθμιστεί`,
      methods: {
        into_output: into('out'), into_output_low: into('out', 0), into_output_high: into('out', 1),
        into_input: into('in'), into_input_pullup: into('pullup'), into_input_pulldown: into('in'),
        pin: () => I(n, 'u8')
      },
      selfMethods: new Set(['into_output', 'into_output_low', 'into_output_high', 'into_input', 'into_input_pullup', 'into_input_pulldown'])
    };
  }
  function piOutput(m, n) {
    const get = () => !!(wired(m, n) ? m.board.outputs[wired(m, n).pin] : 0);
    return {
      t: 'obj', cls: 'OutputPin',
      debug: () => `OutputPin { pin: ${n} }`,
      short: () => `OutputPin(GPIO ${n}) · ${get() ? 'High' : 'Low'}`,
      mutMethods: new Set(['set_high', 'set_low', 'toggle', 'write', 'set_value']),
      methods: {
        set_high: (a, line) => { writeOutput(m, n, 1, line); return UNIT; },
        set_low: (a, line) => { writeOutput(m, n, 0, line); return UNIT; },
        toggle: (a, line) => { writeOutput(m, n, get() ? 0 : 1, line); return UNIT; },
        write: (a, line) => { const l = deref(a[0]); if (!l || l.t !== 'level') throw rerr('E0308', 'mismatched types: expected `Level`', line, 'Γράψε Level::High ή Level::Low.'); writeOutput(m, n, l.v ? 1 : 0, line); return UNIT; },
        is_set_high: () => B(get()), is_set_low: () => B(!get()),
        pin: () => I(n, 'u8')
      }
    };
  }
  function piInput(m, n) {
    return {
      t: 'obj', cls: 'InputPin',
      debug: () => `InputPin { pin: ${n} }`,
      short: () => `InputPin(GPIO ${n}) · ${readInput(m, n, null) ? 'High' : 'Low'}`,
      methods: {
        is_high: (a, line) => B(readInput(m, n, line)),
        is_low: (a, line) => B(!readInput(m, n, line)),
        read: (a, line) => LEVEL(readInput(m, n, line)),
        pin: () => I(n, 'u8')
      }
    };
  }

  // Ονόματα τύπων που γράφονται μόνο σε υπογραφές, π.χ. fn blink(led: &mut OutputPin) ή
  // &mut PinDriver<'static, Gpio2, Output>: χρειάζονται μόνο για να περάσει το use.
  ['OutputPin', 'InputPin', 'Pin', 'IoPin'].forEach(n => { LIB['rppal::gpio::' + n] = { board: 'pi', value: { t: 'type', name: n } }; });
  ['Output', 'Input', 'InputOutput', 'AnyIOPin', 'AnyInputPin', 'AnyOutputPin'].concat(Array.from({ length: 40 }, (_, i) => 'Gpio' + i))
    .forEach(n => { LIB['esp_idf_svc::hal::gpio::' + n] = { board: 'esp32', value: { t: 'type', name: n } }; });

  // ------------------------------------------------------------ ESP32: esp_idf_svc::hal
  LIB['esp_idf_svc::hal::peripherals::Peripherals'] = {
    board: 'esp32',
    value: {
      t: 'type', name: 'Peripherals',
      assoc: {
        take: m => {
          if (m.peripheralsTaken) return ERR(errVal('ESP_ERR_INVALID_STATE', 'EspError(ESP_ERR_INVALID_STATE)', 'EspError'));
          m.peripheralsTaken = true;
          const pins = {};
          for (let n = 0; n <= 39; n++) pins['gpio' + n] = { t: 'obj', cls: `Gpio${n}`, gpio: n, moveOnly: true, debug: () => `Gpio${n}`, short: () => `Gpio${n}`, methods: {} };
          const pinsObj = { t: 'obj', cls: 'Pins', fields: pins, debug: () => 'Pins { … }', short: () => 'Pins', methods: {} };
          return OK({ t: 'obj', cls: 'Peripherals', fields: { pins: pinsObj }, debug: () => 'Peripherals { … }', short: () => 'Peripherals (όλα τα «κομμάτια» του ESP32)', methods: {} });
        }
      }
    }
  };
  const pinToken = (a, what, line) => {
    const p = deref(a);
    if (!p || p.t !== 'obj' || p.gpio === undefined) throw rerr('E0308', `mismatched types: expected a GPIO pin, found \`${p ? typeOfVal(p) : '()'}\``, line, `Το ${what} θέλει ένα pin, π.χ. peripherals.pins.gpio2.`);
    return p.gpio;
  };
  LIB['esp_idf_svc::hal::gpio::PinDriver'] = {
    board: 'esp32',
    value: {
      t: 'type', name: 'PinDriver',
      assoc: {
        output: (m, a, line) => { need(a, 1, 'PinDriver::output', line); const n = pinToken(a[0], 'PinDriver::output', line); setupPin(m, n, 3); return OK(espDriver(m, n, 'Output')); },
        input: (m, a, line) => { need(a, 1, 'PinDriver::input', line); const n = pinToken(a[0], 'PinDriver::input', line); setupPin(m, n, 1); return OK(espDriver(m, n, 'Input')); },
        input_output: (m, a, line) => { const n = pinToken(a[0], 'PinDriver::input_output', line); return OK(espDriver(m, n, 'InputOutput')); }
      }
    }
  };
  LIB['esp_idf_svc::hal::gpio::Pull'] = { board: 'esp32', value: { t: 'type', name: 'Pull', consts: { Up: () => ({ t: 'enum', name: 'Pull', variant: 'Up', v: [] }), Down: () => ({ t: 'enum', name: 'Pull', variant: 'Down', v: [] }), Floating: () => ({ t: 'enum', name: 'Pull', variant: 'Floating', v: [] }) } } };
  LIB['esp_idf_svc::hal::gpio::Level'] = { board: 'esp32', value: { t: 'type', name: 'Level', consts: { High: () => LEVEL(1), Low: () => LEVEL(0) } } };
  LIB['esp_idf_svc::hal::delay::FreeRtos'] = {
    board: 'esp32',
    value: { t: 'type', name: 'FreeRtos', assoc: { delay_ms: (m, a, line) => { const ms = argInt(a[0], 'FreeRtos::delay_ms', line); return (function* () { yield* m.wait(ms * 1000); return UNIT; })(); } } }
  };
  LIB['esp_idf_svc::hal::delay::Ets'] = {
    board: 'esp32',
    value: { t: 'type', name: 'Ets', assoc: { delay_us: (m, a, line) => { const us = argInt(a[0], 'Ets::delay_us', line); m.board.advanceMicros(us); return UNIT; }, delay_ms: (m, a, line) => { const ms = argInt(a[0], 'Ets::delay_ms', line); m.board.advanceMicros(ms * 1000); return UNIT; } } }
  };
  LIB['esp_idf_svc::sys::link_patches'] = { board: 'esp32', value: fn('link_patches', () => UNIT) };
  LIB['esp_idf_svc::log::EspLogger'] = { board: 'esp32', value: { t: 'type', name: 'EspLogger', assoc: { initialize_default: () => UNIT } } };
  const ESP_OK = OK(UNIT);
  function espDriver(m, n, mode) {
    const get = () => !!(wired(m, n) ? m.board.outputs[wired(m, n).pin] : 0);
    return {
      t: 'obj', cls: `PinDriver<${mode}>`,
      debug: () => `PinDriver { pin: ${n} }`,
      short: () => mode === 'Output' ? `PinDriver<Output>(GPIO ${n}) · ${get() ? 'High' : 'Low'}` : `PinDriver<Input>(GPIO ${n}) · ${readInput(m, n, null) ? 'High' : 'Low'}`,
      mutMethods: new Set(['set_high', 'set_low', 'toggle', 'set_level', 'set_pull']),
      mustUse: new Set(['set_high', 'set_low', 'toggle', 'set_level', 'set_pull']),
      methods: {
        set_high: (a, line) => { outOnly(m, mode, line); writeOutput(m, n, 1, line); return ESP_OK; },
        set_low: (a, line) => { outOnly(m, mode, line); writeOutput(m, n, 0, line); return ESP_OK; },
        toggle: (a, line) => { outOnly(m, mode, line); writeOutput(m, n, get() ? 0 : 1, line); return ESP_OK; },
        set_level: (a, line) => { outOnly(m, mode, line); const l = deref(a[0]); writeOutput(m, n, l && l.v ? 1 : 0, line); return ESP_OK; },
        is_set_high: () => B(get()), is_set_low: () => B(!get()),
        is_high: (a, line) => B(mode === 'Output' ? get() : readInput(m, n, line)),
        is_low: (a, line) => B(!(mode === 'Output' ? get() : readInput(m, n, line))),
        get_level: (a, line) => LEVEL(readInput(m, n, line)),
        set_pull: (a, line) => { const p = deref(a[0]); if (p && p.variant === 'Up') setupPin(m, n, 5); return ESP_OK; },
        pin: () => I(n, 'i32')
      }
    };
  }
  function outOnly(m, mode, line) {
    if (mode !== 'Output' && mode !== 'InputOutput') throw rerr('E0599', `no method named \`set_high\` found for struct \`PinDriver<'_, _, Input>\``, line, 'Το pin είναι είσοδος (PinDriver::input). Για LED φτιάξε PinDriver::output(…).');
  }

  // ------------------------------------------------------------ κλήση path: Type::assoc(...)
  // Τα LIB με «assoc» γίνονται κλήσιμα: ο RustMachine.resolvePath δίνει πίσω builtin.
  const resolveOrig = RustMachine.prototype.resolvePath;
  RustMachine.prototype.resolvePath = function (segs, line, e) {
    if (segs.length >= 2) {
      const typeSegs = segs.slice(0, -1);
      const last = segs[segs.length - 1];
      const full = this.prog.resolve(typeSegs);
      const lib = LIB[full];
      if (lib) {
        if (lib.board && lib.board !== this.target) throw rerr('E0433', `failed to resolve: could not find \`${typeSegs[0]}\``, line, RT.BOARD_HINT[this.target]);
        const ty = typeof lib.value === 'function' ? lib.value(this) : lib.value;
        if (ty.assoc && ty.assoc[last]) { const f = ty.assoc[last]; const m = this; return fn(`${ty.name}::${last}`, (args, ln) => f(m, args, ln)); }
        if (ty.consts && ty.consts[last]) return ty.consts[last]();
        if (ty.t === 'type') throw rerr('E0599', `no function or associated item named \`${last}\` found for struct \`${ty.name}\` in the current scope`, line, Object.keys(ty.assoc || {}).length ? `Διαθέσιμες: ${Object.keys(ty.assoc).map(k => `${ty.name}::${k}`).join(', ')}.` : '');
      }
    }
    return resolveOrig.call(this, segs, line, e);
  };

  // ------------------------------------------------------------ μέθοδοι
  function strMethods(m, s, name, args, e, recv, pl) {
    const line = e.line;
    const str = s.v;
    const needMut = () => { if (!s.owned) throw rerr('E0599', `no method named \`${name}\` found for reference \`&str\` in the current scope`, line, `Το ${name} υπάρχει μόνο στο String. Φτιάξε String με String::from("…").`); };
    switch (name) {
      case 'len': return I(utf8(str).length, 'usize');
      case 'is_empty': return B(!str.length);
      case 'to_string': case 'to_owned': case 'into': return S(str, true);
      case 'clone': return S(str, s.owned);
      case 'as_str': return S(str, false);
      case 'trim': return S(str.trim(), false);
      case 'trim_start': return S(str.replace(/^\s+/, ''), false);
      case 'trim_end': return S(str.replace(/\s+$/, ''), false);
      case 'to_uppercase': return S(str.toUpperCase(), true);
      case 'to_lowercase': return S(str.toLowerCase(), true);
      case 'contains': need(args, 1, name, line); return B(str.includes(patOf(args[0])));
      case 'starts_with': need(args, 1, name, line); return B(str.startsWith(patOf(args[0])));
      case 'ends_with': need(args, 1, name, line); return B(str.endsWith(patOf(args[0])));
      case 'replace': need(args, 2, name, line); return S(str.split(patOf(args[0])).join(patOf(args[1])), true);
      case 'repeat': return S(str.repeat(argInt(args[0], 'repeat', line)), true);
      case 'push_str': {
        needMut(); need(args, 1, name, line);
        const a = deref(args[0]);
        if (a.t !== 'str') throw rerr('E0308', `mismatched types: expected \`&str\`, found \`${typeOfVal(a)}\``, line, a.t === 'char' ? "Για έναν χαρακτήρα γράψε push('x'). Το push_str θέλει κείμενο σε \"…\"." : '');
        if (a.owned && args[0].t !== 'ref') throw rerr('E0308', 'mismatched types: expected `&str`, found `String`', line, 'Δάνεισε το String με &: s.push_str(&other).');
        s.v += a.v; return UNIT;
      }
      case 'push': { needMut(); const c = deref(args[0]); if (c.t !== 'char') throw rerr('E0308', `mismatched types: expected \`char\`, found \`${typeOfVal(c)}\``, line, "Το push θέλει έναν χαρακτήρα σε μονά εισαγωγικά: s.push('!'). Για κείμενο χρησιμοποίησε push_str(\"…\")."); s.v += c.v; return UNIT; }
      case 'pop': { needMut(); const ch = [...s.v]; if (!ch.length) return NONE; const c = ch.pop(); s.v = ch.join(''); return SOME({ t: 'char', v: c }); }
      case 'clear': needMut(); s.v = ''; return UNIT;
      case 'chars': return { t: 'iter', items: [...str].map(c => ({ t: 'char', v: c })) };
      case 'bytes': return { t: 'iter', items: utf8(str).map(b => I(b, 'u8')) };
      case 'lines': return { t: 'iter', items: str.split('\n').map(x => S(x, false)) };
      case 'split_whitespace': return { t: 'iter', items: str.trim().split(/\s+/).filter(Boolean).map(x => S(x, false)) };
      case 'split': need(args, 1, name, line); return { t: 'iter', items: str.split(patOf(args[0])).map(x => S(x, false)) };
      case 'parse': {
        const ty = e.turbofish && e.turbofish.k === 'path' ? e.turbofish.name : m.hintParse || 'i32';
        if (isIntTy(ty)) {
          if (!/^[+-]?\d+$/.test(str)) return ERR(errVal(str === '' ? 'cannot parse integer from empty string' : 'invalid digit found in string', `ParseIntError { kind: ${str === '' ? 'Empty' : 'InvalidDigit'} }`, 'ParseIntError'));
          const n = Number(str);
          const r = INT_RANGE[ty];
          if (n > r[1]) return ERR(errVal('number too large to fit in target type', 'ParseIntError { kind: PosOverflow }', 'ParseIntError'));
          if (n < r[0]) return ERR(errVal(ty[0] === 'u' && str.startsWith('-') ? 'invalid digit found in string' : 'number too small to fit in target type', `ParseIntError { kind: ${ty[0] === 'u' ? 'InvalidDigit' : 'NegOverflow'} }`, 'ParseIntError'));
          return OK(I(n, ty));
        }
        if (ty === 'f32' || ty === 'f64') {
          if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(str) && !/^(inf|NaN)$/.test(str)) return ERR(errVal('invalid float literal', 'ParseFloatError { kind: Invalid }', 'ParseFloatError'));
          return OK(F(Number(str), ty));
        }
        if (ty === 'bool') return str === 'true' || str === 'false' ? OK(B(str === 'true')) : ERR(errVal('provided string was not `true` or `false`', 'ParseBoolError', 'ParseBoolError'));
        throw rerr('E0277', `the trait bound \`${ty}: FromStr\` is not satisfied`, line);
      }
      case 'eq': return B(eqVal(s, args[0]));
    }
    return noMethod(s, name, line);
  }
  const patOf = a => { const v = deref(a); return v.t === 'char' ? v.v : v.v; };

  function vecMethods(m, v, name, args, e, recv, pl) {
    const line = e.line;
    const arr = v.v;
    const needVec = () => { if (v.arr) throw rerr('E0599', `no method named \`${name}\` found for array \`${typeOfVal(v)}\` in the current scope`, line, 'Οι πίνακες [T; N] έχουν σταθερό μέγεθος. Για λίστα που μεγαλώνει χρησιμοποίησε Vec: vec![…].'); };
    switch (name) {
      case 'len': return I(arr.length, 'usize');
      case 'is_empty': return B(!arr.length);
      case 'push': {
        needVec(); need(args, 1, name, line);
        let x = deref(args[0]).t === 'ref' ? args[0] : args[0];
        if (arr.length) {
          const sample = deref(arr[0]);
          const xv = deref(x);
          if (sample.t !== xv.t && !(sample.t === 'int' && xv.t === 'int')) throw rerr('E0308', `mismatched types: expected \`${typeOfVal(sample)}\`, found \`${typeOfVal(xv)}\``, line, 'Ένα Vec κρατά τιμές ενός μόνο τύπου.');
          if (xv.t === 'int' && !xv.ty) x = I(checkRange(xv.v, sample.ty || 'i32', '+', line), sample.ty);
          if (xv.t === 'float' && !xv.ty) x = F(xv.v, sample.ty);
        } else if (deref(x).t === 'int' && !deref(x).ty) x = I(deref(x).v, 'i32');
        arr.push(x);
        return UNIT;
      }
      case 'pop': needVec(); return arr.length ? SOME(arr.pop()) : NONE;
      case 'clear': needVec(); arr.length = 0; return UNIT;
      case 'insert': { needVec(); const i = argInt(args[0], 'insert', line); if (i > arr.length) panic(`insertion index (is ${i}) should be <= len (is ${arr.length})`, line); arr.splice(i, 0, args[1]); return UNIT; }
      case 'remove': { needVec(); const i = argInt(args[0], 'remove', line); if (i >= arr.length) panic(`removal index (is ${i}) should be < len (is ${arr.length})`, line); return arr.splice(i, 1)[0]; }
      case 'truncate': needVec(); arr.length = Math.min(arr.length, argInt(args[0], 'truncate', line)); return UNIT;
      case 'get': {
        need(args, 1, name, line);
        const i = argInt(args[0], 'get', line);
        return i >= 0 && i < arr.length ? SOME({ t: 'ref', mut: false, get: () => arr[i], set: () => {} }) : NONE;
      }
      case 'first': return arr.length ? SOME(arr[0]) : NONE;
      case 'last': return arr.length ? SOME(arr[arr.length - 1]) : NONE;
      case 'contains': need(args, 1, name, line); return B(arr.some(x => eqVal(x, args[0])));
      case 'clone': case 'to_vec': return { t: 'vec', v: arr.map(clone), arr: name === 'clone' ? v.arr : false };
      case 'iter': case 'iter_mut': case 'into_iter': return { t: 'iter', items: arr.slice() };
      case 'sort': case 'sort_unstable': arr.sort((a, b) => cmpVal(a, b)); return UNIT;
      case 'reverse': arr.reverse(); return UNIT;
      case 'swap': { const i = argInt(args[0], 'swap', line); const j = argInt(args[1], 'swap', line); if (i >= arr.length || j >= arr.length) panic(`index out of bounds: the len is ${arr.length} but the index is ${Math.max(i, j)}`, line); [arr[i], arr[j]] = [arr[j], arr[i]]; return UNIT; }
      case 'join': { const sep = deref(args[0]).v; return S(arr.map(x => display(deref(x), line)).join(sep), true); }
      case 'capacity': return I(Math.max(4, arr.length), 'usize');
    }
    return iterMethods(m, { t: 'iter', items: arr.slice() }, name, args, e) || noMethod(v, name, line);
  }

  function iterMethods(m, it, name, args, e) {
    const line = e.line;
    const items = it.items.map(deref);
    const num = x => x.v;
    switch (name) {
      case 'iter': case 'into_iter': case 'copied': case 'cloned': return { t: 'iter', items: it.items.map(deref) };
      case 'count': return I(items.length, 'usize');
      case 'enumerate': return { t: 'iter', items: it.items.map((x, i) => ({ t: 'tuple', v: [I(i, 'usize'), x] })) };
      case 'rev': return { t: 'iter', items: it.items.slice().reverse() };
      case 'skip': return { t: 'iter', items: it.items.slice(argInt(args[0], 'skip', line)) };
      case 'take': return { t: 'iter', items: it.items.slice(0, argInt(args[0], 'take', line)) };
      case 'step_by': { const k = argInt(args[0], 'step_by', line); return { t: 'iter', items: it.items.filter((x, i) => i % k === 0) }; }
      case 'nth': { const i = argInt(args[0], 'nth', line); return i < it.items.length ? SOME(it.items[i]) : NONE; }
      case 'last': return it.items.length ? SOME(it.items[it.items.length - 1]) : NONE;
      case 'next': return it.items.length ? SOME(it.items.shift()) : NONE;
      case 'sum': {
        const ty = e.turbofish && e.turbofish.k === 'path' ? e.turbofish.name : (items[0] ? items[0].ty : 'i32');
        if (items.some(x => x.t === 'float') || ty === 'f32' || ty === 'f64') return F(items.reduce((a, x) => a + num(x), 0), ty === 'f32' ? 'f32' : 'f64');
        return I(checkRange(items.reduce((a, x) => a + num(x), 0), ty || 'i32', '+', line), ty || 'i32');
      }
      case 'max': case 'min': {
        if (!items.length) return NONE;
        if (items[0].t === 'float') throw rerr('E0277', 'the trait bound `f32: Ord` is not satisfied', line, 'Τα δεκαδικά δεν έχουν .max() σε iterator (λόγω NaN). Γράψε βρόχο for που κρατά το μεγαλύτερο.');
        let best = it.items[0];
        for (const x of it.items) { const c = cmpVal(x, best); if (name === 'max' ? c >= 0 : c < 0) best = x; }
        return SOME(best);
      }
      case 'collect': return { t: 'vec', v: it.items.map(deref) };
      case 'any': case 'all': case 'map': case 'filter': case 'for_each': case 'fold': case 'position': case 'find':
        throw rerr('', `\`.${name}()\` needs a closure, which is not supported in this version`, line, 'Γράψε το ίδιο με έναν βρόχο for, π.χ. for x in v.iter() { … }.');
    }
    return null;
  }

  function numMethods(m, v, name, args, e) {
    const line = e.line;
    if (v.t === 'int') {
      const ty = v.ty || 'i32';
      const r = INT_RANGE[ty];
      const other = () => argInt(args[0], name, line);
      const inRange = x => x >= r[0] && x <= r[1];
      switch (name) {
        case 'abs': return I(checkRange(Math.abs(v.v), ty, '+', line), v.ty);
        case 'pow': return I(checkRange(Math.pow(v.v, other()), ty, 'pow', line), v.ty);
        case 'min': return I(Math.min(v.v, other()), v.ty);
        case 'max': return I(Math.max(v.v, other()), v.ty);
        case 'clamp': return I(Math.min(argInt(args[1], name, line), Math.max(argInt(args[0], name, line), v.v)), v.ty);
        case 'checked_add': { const x = v.v + other(); return inRange(x) ? SOME(I(x, ty)) : NONE; }
        case 'checked_sub': { const x = v.v - other(); return inRange(x) ? SOME(I(x, ty)) : NONE; }
        case 'checked_mul': { const x = v.v * other(); return inRange(x) ? SOME(I(x, ty)) : NONE; }
        case 'checked_div': { const o = other(); return o === 0 ? NONE : SOME(I(Math.trunc(v.v / o), ty)); }
        case 'saturating_add': return I(Math.min(r[1], Math.max(r[0], v.v + other())), ty);
        case 'saturating_sub': return I(Math.min(r[1], Math.max(r[0], v.v - other())), ty);
        case 'saturating_mul': return I(Math.min(r[1], Math.max(r[0], v.v * other())), ty);
        case 'wrapping_add': case 'wrapping_sub': case 'wrapping_mul': {
          const o = other();
          let x = name === 'wrapping_add' ? v.v + o : name === 'wrapping_sub' ? v.v - o : v.v * o;
          const span = r[1] - r[0] + 1;
          x = ((((x - r[0]) % span) + span) % span) + r[0];
          return I(x, ty);
        }
        case 'to_string': return S(String(v.v), true);
        case 'is_positive': return B(v.v > 0);
        case 'is_negative': return B(v.v < 0);
        case 'signum': return I(Math.sign(v.v), v.ty);
        case 'count_ones': return I(v.v.toString(2).split('1').length - 1, 'u32');
        case 'clone': return v;
        case 'cmp': return { t: 'enum', name: 'Ordering', variant: v.v < other() ? 'Less' : v.v > deref(args[0]).v ? 'Greater' : 'Equal', v: [] };
        case 'sqrt': case 'round': case 'floor': throw rerr('E0599', `no method named \`${name}\` found for type \`${ty}\` in the current scope`, line, `Το .${name}() υπάρχει στα δεκαδικά. Μετάτρεψε πρώτα: (x as f32).${name}().`);
      }
    }
    if (v.t === 'float') {
      const ty = v.ty || 'f64';
      const o = () => argNum(args[0], name, line);
      switch (name) {
        case 'abs': return F(Math.abs(v.v), ty);
        case 'sqrt': return F(Math.sqrt(v.v), ty);
        case 'round': return F(Math.sign(v.v) * Math.round(Math.abs(v.v)), ty);
        case 'floor': return F(Math.floor(v.v), ty);
        case 'ceil': return F(Math.ceil(v.v), ty);
        case 'trunc': return F(Math.trunc(v.v), ty);
        case 'min': return F(Math.min(v.v, o()), ty);
        case 'max': return F(Math.max(v.v, o()), ty);
        case 'clamp': return F(Math.min(argNum(args[1], name, line), Math.max(argNum(args[0], name, line), v.v)), ty);
        case 'powi': return F(Math.pow(v.v, argInt(args[0], name, line)), ty);
        case 'powf': return F(Math.pow(v.v, o()), ty);
        case 'is_nan': return B(Number.isNaN(v.v));
        case 'is_finite': return B(Number.isFinite(v.v));
        case 'to_string': return S(RT.fmtFloat(v.v, ty), true);
        case 'clone': return v;
      }
    }
    return noMethod(v, name, line);
  }

  function optMethods(m, o, name, args, e) {
    const line = e.line;
    switch (name) {
      case 'is_some': return B(o.some);
      case 'is_none': return B(!o.some);
      case 'unwrap': if (!o.some) panic('called `Option::unwrap()` on a `None` value', line); return o.v;
      case 'expect': if (!o.some) panic(deref(args[0]).v, line); return o.v;
      case 'unwrap_or': return o.some ? o.v : args[0];
      case 'unwrap_or_default': return o.some ? o.v : I(0, 'i32');
      case 'ok_or': return o.some ? OK(o.v) : ERR(args[0]);
      case 'copied': case 'cloned': return o.some ? SOME(clone(deref(o.v))) : NONE;
      case 'clone': return clone(o);
      case 'take': { if (!m.lastPlace) return o; const old = o.some ? SOME(o.v) : NONE; m.lastPlace.set(NONE); return old; }
      case 'as_ref': return o;
    }
    return noMethod(o, name, line, ['map', 'and_then', 'filter', 'unwrap_or_else'].includes(name) ? 'Αυτή η μέθοδος θέλει closure, που δεν υποστηρίζεται εδώ. Γράψε match ή if let.' : '');
  }
  function resMethods(m, r, name, args, e) {
    const line = e.line;
    switch (name) {
      case 'is_ok': return B(r.ok);
      case 'is_err': return B(!r.ok);
      case 'unwrap': if (!r.ok) panic(`called \`Result::unwrap()\` on an \`Err\` value: ${debug(deref(r.v))}`, line); return r.v;
      case 'expect': if (!r.ok) panic(`${deref(args[0]).v}: ${debug(deref(r.v))}`, line); return r.v;
      case 'unwrap_err': if (r.ok) panic(`called \`Result::unwrap_err()\` on an \`Ok\` value: ${debug(deref(r.v))}`, line); return r.v;
      case 'unwrap_or': return r.ok ? r.v : args[0];
      case 'unwrap_or_default': return r.ok ? r.v : I(0, 'i32');
      case 'ok': return r.ok ? SOME(r.v) : NONE;
      case 'err': return r.ok ? NONE : SOME(r.v);
      case 'clone': return clone(r);
    }
    return noMethod(r, name, line, ['map', 'map_err', 'and_then', 'unwrap_or_else'].includes(name) ? 'Αυτή η μέθοδος θέλει closure, που δεν υποστηρίζεται εδώ. Γράψε match.' : '');
  }

  RustMachine.prototype.builtinMethod = function (d, name, args, e, recv, pl) {
    const line = e.line;
    this.lastPlace = pl;
    if (name === 'clone' && (d.t === 'struct' || d.t === 'enum')) {
      if (d.def && !d.def.derives.has('Clone')) throw rerr('E0599', `no method named \`clone\` found for ${d.t} \`${d.name}\` in the current scope`, line, `Πρόσθεσε #[derive(Clone)] πάνω από τον ορισμό του ${d.name}.`);
      return clone(d);
    }
    switch (d.t) {
      case 'str': return strMethods(this, d, name, args, e, recv, pl);
      case 'vec': return vecMethods(this, d, name, args, e, recv, pl);
      case 'iter': return iterMethods(this, d, name, args, e) || noMethod(d, name, line);
      case 'int': case 'float': return numMethods(this, d, name, args, e);
      case 'opt': return optMethods(this, d, name, args, e);
      case 'res': return resMethods(this, d, name, args, e);
      case 'bool': if (name === 'then_some') return d.v ? SOME(args[0]) : NONE; if (name === 'clone') return d; break;
      case 'char':
        switch (name) {
          case 'is_ascii_digit': case 'is_numeric': return B(/[0-9]/.test(d.v));
          case 'is_alphabetic': return B(/\p{L}/u.test(d.v));
          case 'is_whitespace': return B(/\s/.test(d.v));
          case 'to_digit': return /[0-9]/.test(d.v) ? SOME(I(Number(d.v), 'u32')) : NONE;
          case 'to_ascii_uppercase': return { t: 'char', v: d.v.toUpperCase() };
          case 'to_string': return S(d.v, true);
          case 'is_ascii_uppercase': return B(/[A-Z]/.test(d.v));
        }
        break;
      case 'dur':
        switch (name) {
          case 'as_millis': return I(Math.floor(d.us / 1000), 'u128');
          case 'as_micros': return I(Math.floor(d.us), 'u128');
          case 'as_secs': return I(Math.floor(d.us / 1e6), 'u64');
          case 'as_secs_f32': return F(d.us / 1e6, 'f32');
          case 'as_secs_f64': return F(d.us / 1e6, 'f64');
          case 'subsec_millis': return I(Math.floor(d.us / 1000) % 1000, 'u32');
        }
        break;
      case 'inst':
        switch (name) {
          case 'elapsed': return { t: 'dur', us: this.board.micros - d.us };
          case 'duration_since': { const o = deref(args[0]); return { t: 'dur', us: Math.max(0, d.us - o.us) }; }
        }
        break;
      case 'level':
        if (name === 'clone') return d;
        break;
      case 'err':
        if (name === 'to_string') return S(d.msg, true);
        if (name === 'kind') return S(d.debug, false);
        break;
      case 'obj': {
        const f = d.methods && d.methods[name];
        if (f) return f(args, line, e);
        if (name === 'clone') throw rerr('E0599', `no method named \`clone\` found for struct \`${d.cls}\` in the current scope`, line, 'Τα pins δεν αντιγράφονται: κάθε pin έχει έναν μόνο «ιδιοκτήτη». Δάνεισέ το με & ή &mut.');
        const avail = Object.keys(d.methods || {});
        return noMethod(d, name, line, avail.length ? `Διαθέσιμες μέθοδοι: ${avail.map(x => '.' + x + '()').join(', ')}.` : '');
      }
    }
    return noMethod(d, name, line);
  };

  root.IoTRustLib = { gpioObj, espDriver, wired };
})(typeof window !== 'undefined' ? window : globalThis);
