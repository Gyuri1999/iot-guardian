/*
 * IoT Guardian — Διαδρομή Rust, Κεφάλαιο 1: Πρώτο πρόγραμμα στη Rust.
 * Ένας κοινός ορισμός → δύο κεφάλαια: Raspberry Pi (41, rppal) και ESP32 (51, esp-idf-svc).
 *
 * Εδώ ορίζεται και το L.RustKit, που το χρησιμοποιούν τα rs2.js … rs6.js
 * (γι’ αυτό το rs1.js πρέπει να φορτώνεται πρώτο).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  if (!L.SKILLS.rust) L.SKILLS.rust = 'Rust';

  // ------------------------------------------------------------ κοινά εργαλεία για όλα τα κεφάλαια Rust
  const PINS = {
    pi: { led: 17, button: 27, pir: 4, trig: 23, echo: 24, red: 16, yellow: 20, green: 21 },
    esp32: { led: 2, button: 15, pir: 4, trig: 5, echo: 18, red: 25, yellow: 26, green: 27 }
  };
  const OUTPUTS = new Set(['led', 'trig', 'red', 'yellow', 'green']);

  function makeBoard(key) {
    const pi = key === 'pi';
    const P = PINS[key];
    const B = {
      key, pi, P,
      name: pi ? 'Raspberry Pi' : 'ESP32',
      base: pi ? 41 : 51,
      track: pi ? 'rs-pi' : 'rs-esp32',
      crate: pi ? 'rppal' : 'esp-idf-svc',
      // ? μετά από εντολές pin που στο ESP32 επιστρέφουν Result
      q: pi ? '' : '?',
      // βοηθητική συνάρτηση που γράφει σε pins: στο ESP32 επιστρέφει anyhow::Result<()>
      ret: pi ? '' : ' -> anyhow::Result<()>',
      okEnd: pi ? '' : '\n    Ok(())',
      sleep: ms => (pi ? `thread::sleep(Duration::from_millis(${ms}));` : `FreeRtos::delay_ms(${ms});`),
      sleepUs: us => (pi ? `thread::sleep(Duration::from_micros(${us}));` : `Ets::delay_us(${us});`),
      sleepWord: pi ? 'thread::sleep(Duration::from_millis(…))' : 'FreeRtos::delay_ms(…)',
      w: (obj, m) => `${obj}.${m}()${pi ? '' : '?'};`,
      outTy: name => (pi ? 'OutputPin' : `PinDriver<'static, Gpio${P[name]}, Output>`),
      inTy: name => (pi ? 'InputPin' : `PinDriver<'static, Gpio${P[name]}, Input>`),
      // let mut led = …;  (ή let button = …;)
      pin(name, v) {
        v = v || name;
        const out = OUTPUTS.has(name);
        if (pi) return out ? `let mut ${v} = gpio.get(${P[name]})?.into_output${name === 'trig' ? '_low' : ''}();` : `let ${v} = gpio.get(${P[name]})?.into_input();`;
        return out ? `let mut ${v} = PinDriver::output(peripherals.pins.gpio${P[name]})?;` : `let ${v} = PinDriver::input(peripherals.pins.gpio${P[name]})?;`;
      },
      pinExpr: name => (pi ? `gpio.get(${P[name]})?.into_output()` : `PinDriver::output(peripherals.pins.gpio${P[name]})?`),
      // main με πλακέτα / χωρίς πλακέτα
      mainHw: pi ? 'fn main() -> Result<(), Box<dyn Error>> {\n    let gpio = Gpio::new()?;' : 'fn main() -> anyhow::Result<()> {\n    esp_idf_svc::sys::link_patches();\n    let peripherals = Peripherals::take()?;',
      mainPlain: pi ? 'fn main() {' : 'fn main() {\n    esp_idf_svc::sys::link_patches();',
      // γραμμές use. o = { sleep, us, instant, outs: ['led'], ins: ['echo'] }
      uses(o) {
        o = o || {};
        const outs = o.outs || [];
        const ins = o.ins || [];
        const lines = [];
        if (pi) {
          const t = ['Gpio'].concat(outs.length ? ['OutputPin'] : [], ins.length ? ['InputPin'] : []);
          lines.push(t.length > 1 ? `use rppal::gpio::{${t.sort().join(', ')}};` : 'use rppal::gpio::Gpio;');
          lines.push('use std::error::Error;');
          if (o.sleep !== false) lines.push('use std::thread;');
          if (o.instant) lines.push('use std::time::{Duration, Instant};');
          else if (o.sleep !== false) lines.push('use std::time::Duration;');
        } else {
          if (o.sleep !== false || o.us) lines.push(o.us ? 'use esp_idf_svc::hal::delay::{Ets, FreeRtos};' : 'use esp_idf_svc::hal::delay::FreeRtos;');
          const t = [...new Set(outs.map(n => 'Gpio' + P[n]).concat(ins.map(n => 'Gpio' + P[n])))].sort()
            .concat(ins.length ? ['Input'] : [], outs.length ? ['Output'] : []);
          lines.push(t.length ? `use esp_idf_svc::hal::gpio::{${t.concat(['PinDriver']).join(', ')}};` : 'use esp_idf_svc::hal::gpio::PinDriver;');
          lines.push('use esp_idf_svc::hal::peripherals::Peripherals;');
          if (o.instant) lines.push('use std::time::{Duration, Instant};');
        }
        return lines.join('\n');
      },
      pinsText: pi
        ? 'LED = GPIO 17, κουμπί = GPIO 27, PIR = GPIO 4, TRIG = GPIO 23, ECHO = GPIO 24, φανάρι = GPIO 16 / 20 / 21'
        : 'LED = GPIO 2, κουμπί = GPIO 15, PIR = GPIO 4, TRIG = GPIO 5, ECHO = GPIO 18, φανάρι = GPIO 25 / 26 / 27',
      term: pi ? 'τερματικό' : 'Serial Monitor'
    };
    return B;
  }
  const BOARDS = [makeBoard('pi'), makeBoard('esp32')];

  // Ένας ορισμός κεφαλαίου → δύο κεφάλαια (Pi και ESP32).
  // build(B) επιστρέφει πίνακα μαθημάτων χωρίς id / chapter / prerequisites / lang / board.
  function defineChapter(idx, title, build) {
    for (const B of BOARDS) {
      const n = B.base + idx - 1;
      L.CHAPTERS.push({ n, title, ready: true, track: B.track, lang: 'rust', board: B.key });
      build(B).forEach((l, i) => {
        const id = `c${n}-l${i + 1}`;
        const world = l.world || {};
        L.lessons.push(Object.assign({
          id, chapter: n, lang: 'rust', board: B.key,
          prerequisites: i === 0 ? [] : [`c${n}-l${i}`],
          world, initialWorld: world,
          hardware: [], panels: ['serial', 'vars', 'loops']
        }, l, { world, initialWorld: world }));
      });
    }
  }
  function addGlossary(list) {
    list.forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });
  }
  L.RustKit = { BOARDS, PINS, makeBoard, defineChapter, addGlossary };

  addGlossary([
    { term: 'Rust', def: 'Γλώσσα προγραμματισμού που ελέγχει πολλά λάθη πριν τρέξει ο κώδικας. Δεν αφήνει να χαλάσει η μνήμη. Τρέχει και σε μικροελεγκτές.' },
    { term: 'rustc', def: 'Ο compiler της Rust. Μεταφράζει τον κώδικα σε πρόγραμμα. Αν βρει λάθος, γράφει κωδικό, π.χ. error[E0384], και εξήγηση.' },
    { term: 'cargo', def: 'Το εργαλείο της Rust για έργα. cargo build = χτίσε, cargo run = χτίσε και τρέξε. Κατεβάζει και τα crates.' },
    { term: 'crate', def: 'Μια βιβλιοθήκη (ή ένα πρόγραμμα) της Rust. Π.χ. το rppal για το Raspberry Pi ή το esp-idf-svc για το ESP32.' },
    { term: 'fn main', def: 'Η συνάρτηση από όπου ξεκινά κάθε πρόγραμμα Rust.' },
    { term: 'println!', def: 'Macro που τυπώνει μια γραμμή. Το ! δείχνει ότι είναι macro. Τα {} γεμίζουν με τιμές: println!("t = {}", t).' },
    { term: 'macro', def: 'Εντολή που τελειώνει σε !, π.χ. println! ή vec!. Γράφει κώδικα για σένα πριν το compile.' },
    { term: 'let', def: 'Φτιάχνει μια μεταβλητή. Στη Rust μια μεταβλητή δεν αλλάζει, εκτός αν γράψεις let mut.' },
    { term: 'mut', def: 'Λέξη που κάνει μια μεταβλητή «αλλάξιμη»: let mut count = 0;. Χωρίς mut, το count = 1; δίνει error[E0384].' },
    { term: 'ακέραιοι τύποι (u8, u32, i32)', def: 'u = χωρίς πρόσημο, i = με πρόσημο. Ο αριθμός λέει τα bits. u8: 0 έως 255. u32: 0 έως περίπου 4 δισεκατομμύρια. i32: περίπου ±2 δισεκατομμύρια.' },
    { term: 'f32', def: 'Τύπος για δεκαδικούς αριθμούς, π.χ. 21.5. Στη Rust ο δεκαδικός γράφεται με τελεία.' },
    { term: 'overflow (υπερχείλιση)', def: 'Όταν ένα αποτέλεσμα δεν χωρά στον τύπο, π.χ. 250 + 10 σε u8. Η Rust σταματά το πρόγραμμα (panic) αντί να δώσει λάθος αριθμό.' },
    { term: 'panic', def: 'Η Rust σταματά το πρόγραμμα επίτηδες, γιατί κάτι πήγε πολύ στραβά (overflow, unwrap σε None, θέση εκτός πίνακα). Γράφει «thread \'main\' panicked at …».' },
    { term: 'rppal', def: 'Crate της Rust για τα pins του Raspberry Pi. Gpio::new()? και μετά gpio.get(17)?.into_output().' },
    { term: 'esp-idf-svc', def: 'Crate της Rust για το ESP32 (με std). Τα pins βγαίνουν από το Peripherals::take()? και οδηγούνται με PinDriver.' },
    { term: 'loop', def: 'Βρόχος της Rust που δεν σταματά ποτέ (εκτός αν βρει break). Στη main παίζει τον ρόλο του loop() της C++.' }
  ]);

  // ------------------------------------------------------------ Κεφάλαιο 1
  defineChapter(1, 'Πρώτο πρόγραμμα στη Rust', B => {
    const SYN1 = 'fn main() { … }, println!("…"), println!("{}", x), σχόλια //';
    const SYN2 = SYN1 + ', let, let mut, τύποι i32 / u8 / u32 / f32, {όνομα}, {:.1}';
    const SYN3 = SYN2 + `, ${B.crate}, loop { … }, ${B.sleepWord}, led.set_high()${B.q}, led.set_low()${B.q}`;
    const plain = body => `${B.mainPlain}\n${body}\n}\n`;

    // 1.1
    const L1_HEAD = `// Το πρώτο μου πρόγραμμα σε Rust, στο ${B.name}.
${B.mainPlain}
    println!("Hello Rust");`;
    const L1_INITIAL = `${L1_HEAD}
    // ΣΥΜΠΛΗΡΩΣΕ: τύπωσε «Board: ${B.name}»
    // ΣΥΜΠΛΗΡΩΣΕ: τύπωσε «2 + 3 = 5» με {} και την πράξη 2 + 3
}
`;
    const L1_SOLUTION = `${L1_HEAD}
    println!("Board: ${B.name}");
    println!("2 + 3 = {}", 2 + 3);   // το {} γεμίζει με το αποτέλεσμα
}
`;

    // 1.2
    const L2_CODE = (prints) => plain(`    let room = "kitchen";        // κείμενο (&str)
    let temp: f32 = 21.5;        // δεκαδικός
    let mut readings: u32 = 0;   // mut: θα αλλάξει
    readings = readings + 1;
    readings = readings + 1;
    readings = readings + 1;
${prints}`);
    const L2_BAD = `    // ΣΥΜΠΛΗΡΩΣΕ: τύπωσε «Room: kitchen», «Temp: 21.5 C» και «Readings: 3»
    println!("Room: {}", ____);`;
    const L2_GOOD = `    println!("Room: {}", room);
    println!("Temp: {temp} C");
    println!("Readings: {readings}");`;

    // 1.3
    const L3_CODE = (decl) => plain(`    // Μετρητής: πόσες φορές πατήθηκε το κουμπί.
    ${decl}
    println!("Presses: {presses}");
    presses = presses + 1;
    println!("Presses: {presses}");
    presses = presses + 1;
    println!("Presses: {presses}");`);

    // 1.4
    const L4_CODE = (ty) => plain(`    // Πόσα δευτερόλεπτα λειτουργεί η πλακέτα.
    let mut uptime: ${ty} = 200;
    println!("Uptime: {uptime} s");
    uptime = uptime + 60;
    println!("Uptime: {uptime} s");
    uptime = uptime + 60;
    println!("Uptime: {uptime} s");`);

    // 1.5
    const L5_CODE = (off) => `// Αναβοσβήνει το LED κάθε μισό δευτερόλεπτο.
${B.uses({ sleep: true })}

${B.mainHw}
    ${B.pin('led')}   // το LED (GPIO ${B.P.led}) ως έξοδος

    loop {
        ${B.w('led', 'set_high')}
        println!("ON");
        ${B.sleep(500)}
        ${off}
        println!("OFF");
        ${B.sleep(500)}
    }
}
`;

    // 1.6
    const L6_INITIAL = `// Καρδιογράφημα: το LED «χτυπά» σαν καρδιά.
// ΑΛΛΑΞΕ: on 100 ms, off 100 ms, on 100 ms, off 700 ms.
// Πρόσθεσε μετρητή beats (u32) και τύπωσε «Beat 1», «Beat 2», … στην αρχή κάθε γύρου.
${B.uses({ sleep: true })}

${B.mainHw}
    ${B.pin('led')}

    loop {
        ${B.w('led', 'set_high')}
        ${B.sleep(500)}
        ${B.w('led', 'set_low')}
        ${B.sleep(500)}
    }
}
`;
    const L6_SOLUTION = `// Καρδιογράφημα: το LED «χτυπά» σαν καρδιά.
${B.uses({ sleep: true })}

${B.mainHw}
    ${B.pin('led')}
    let mut beats: u32 = 0;

    loop {
        beats = beats + 1;
        println!("Beat {beats}");
        ${B.w('led', 'set_high')}   // πρώτος χτύπος
        ${B.sleep(100)}
        ${B.w('led', 'set_low')}
        ${B.sleep(100)}
        ${B.w('led', 'set_high')}   // δεύτερος χτύπος
        ${B.sleep(100)}
        ${B.w('led', 'set_low')}    // παύση
        ${B.sleep(700)}
    }
}
`;

    const espNote = B.pi ? '' : '<p>Στο ESP32 η πρώτη γραμμή της <code>main</code> είναι πάντα <code>esp_idf_svc::sys::link_patches();</code>. Ετοιμάζει το σύστημα του ESP32. Μην τη σβήνεις.</p>';
    const errNote = B.pi
      ? '<code>fn main() -> Result&lt;(), Box&lt;dyn Error&gt;&gt;</code>: η main μπορεί να επιστρέψει λάθος. Έτσι το <code>?</code> δουλεύει μέσα της.'
      : '<code>fn main() -> anyhow::Result&lt;()&gt;</code>: η main μπορεί να επιστρέψει λάθος. Έτσι το <code>?</code> δουλεύει μέσα της.';

    return [
      {
        kind: 'micro', skills: ['rust', 'order'],
        title: 'Hello, Rust!',
        objectives: ['Να γράφω τη fn main.', 'Να τυπώνω με println!.', 'Να βάζω τιμή μέσα στο κείμενο με {}.'],
        theory: `
<p>Κάθε πρόγραμμα Rust ξεκινά από τη <code>fn main()</code>. Οι εντολές μπαίνουν μέσα στα άγκιστρα <code>{ }</code>.</p>
<p>Το <code>println!("…")</code> τυπώνει μία γραμμή στο ${B.term}. Το <strong>!</strong> σημαίνει ότι είναι <strong>macro</strong>.</p>
<p>Τα <code>{}</code> μέσα στο κείμενο γεμίζουν με τιμές:</p>
<pre>println!("2 + 3 = {}", 2 + 3);   // 2 + 3 = 5</pre>
<p>Σχόλιο: ό,τι υπάρχει μετά το <code>//</code>. Ο compiler δεν το διαβάζει.</p>
<p>Κάθε εντολή τελειώνει με <code>;</code>.</p>${espNote}
<p>Σε αληθινή πλακέτα: <code>cargo run</code> χτίζει και τρέχει το πρόγραμμα${B.pi ? '' : ' (για ESP32 συνήθως <code>cargo run</code> με το espflash)'}.</p>`,
        glossary: ['Rust', 'fn main', 'println!', 'macro', 'cargo'],
        supportedSyntax: SYN1,
        initialCode: L1_INITIAL,
        solution: L1_SOLUTION,
        steps: [
          'Απάντησε στην ερώτηση πρόβλεψης.',
          'Τρέξε τον κώδικα. Τι γράφει το ' + B.term + ';',
          `Πρόσθεσε μια γραμμή println! που γράφει «Board: ${B.name}».`,
          'Πρόσθεσε μια γραμμή που γράφει «2 + 3 = 5». Βάλε {} στο κείμενο και την πράξη 2 + 3 μετά το κόμμα.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Τι τυπώνει το println!("{} cm", 10 + 5);',
          options: ['15 cm', '10 + 5 cm', '{} cm'],
          answer: 0,
          explain: 'Σωστά. Πρώτα γίνεται η πράξη (15) και μετά μπαίνει στη θέση του {}.',
          retry: 'Όχι ακόμα. Το {} γεμίζει με την τιμή μετά το κόμμα. Ποια είναι αυτή;'
        },
        hints: [
          'Κάθε γραμμή που θέλεις να τυπωθεί είναι ένα println!.',
          'Γράψε τις νέες εντολές κάτω από το println!("Hello Rust");, πριν από το } της main.',
          `println!("Board: ${B.name}");\nprintln!("2 + 3 = {}", 2 + 3);\n• το {} γεμίζει με το 2 + 3 = 5\n• κάθε εντολή τελειώνει σε ;`
        ],
        validationTests: [
          { name: 'Τρεις γραμμές με τη σωστή σειρά', script: [
            { setup: true },
            { check: 'lines', is: ['Hello Rust', `Board: ${B.name}`, '2 + 3 = 5'], fail: `Το ${B.term} έγραψε: {v}. Περίμενα «Hello Rust», «Board: ${B.name}», «2 + 3 = 5».` }
          ] }
        ],
        explanationOnSuccess: 'Το πρώτο σου πρόγραμμα Rust τρέχει! Ο compiler έλεγξε τον κώδικα πριν τρέξει. Αν κάτι ήταν λάθος, θα έβλεπες error με κωδικό, π.χ. error[E0425].',
        remediation: 'Αν δεις error[E0425], κάπου έμεινε ένα όνομα που δεν υπάρχει. Έλεγξε τα εισαγωγικά " και το ; στο τέλος κάθε println!.'
      },

      {
        kind: 'guided', skills: ['rust', 'variables'],
        title: 'Μεταβλητές: let, τύποι και {όνομα}',
        objectives: ['Να φτιάχνω μεταβλητές με let.', 'Να ξέρω πότε χρειάζεται mut.', 'Να τυπώνω μεταβλητές με {} και {όνομα}.'],
        theory: `
<p>Με <code>let</code> φτιάχνεις μια μεταβλητή:</p>
<pre>let room = "kitchen";      // ο compiler βρίσκει μόνος τον τύπο
let temp: f32 = 21.5;      // ή τον γράφεις εσύ μετά το :</pre>
<p>Στη Rust μια μεταβλητή <strong>δεν αλλάζει</strong>. Αν θέλεις να αλλάζει, γράψε <code>let mut</code>:</p>
<pre>let mut readings: u32 = 0;
readings = readings + 1;</pre>
<p>Δύο τρόποι να τυπώσεις μια μεταβλητή:</p>
<ul>
  <li><code>println!("Room: {}", room);</code> — η τιμή μετά το κόμμα.</li>
  <li><code>println!("Room: {room}");</code> — το όνομα μέσα στα άγκιστρα.</li>
</ul>
<p>Ο δεκαδικός γράφεται με <strong>τελεία</strong>: <code>21.5</code>, όχι <code>21,5</code>.</p>`,
        glossary: ['let', 'mut', 'f32', 'ακέραιοι τύποι (u8, u32, i32)'],
        supportedSyntax: SYN2,
        initialCode: L2_CODE(L2_BAD),
        solution: L2_CODE(L2_GOOD),
        panels: ['serial', 'vars'],
        steps: [
          'Διάβασε τις τρεις μεταβλητές. Ποια έχει mut; Γιατί;',
          'Στο println! άλλαξε το ____ με το όνομα της μεταβλητής room.',
          'Πρόσθεσε άλλα δύο println!: «Temp: 21.5 C» και «Readings: 3». Δοκίμασε τη μορφή {temp}.',
          'Τρέξε και κοίτα τον πίνακα «Μεταβλητές».',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Ποια μεταβλητή χρειάζεται mut;',
          options: ['Αυτή που αλλάζει τιμή μετά το let', 'Κάθε μεταβλητή με αριθμό', 'Κάθε μεταβλητή που τυπώνεται'],
          answer: 0,
          explain: 'Σωστά. Το mut χρειάζεται μόνο όταν γράφεις ξανά στη μεταβλητή, π.χ. readings = readings + 1.',
          retry: 'Όχι ακόμα. Το mut σημαίνει «αλλάξιμη». Πότε αλλάζει μια μεταβλητή;'
        },
        hints: [
          'Θέλεις τρία println!, ένα για κάθε μεταβλητή.',
          'Το ____ γίνεται room. Μετά γράψε println!("Temp: {temp} C"); και ένα ίδιο για το readings.',
          'println!("Room: {}", room);\nprintln!("Temp: {temp} C");\nprintln!("Readings: {readings}");\n• {} = η τιμή μετά το κόμμα\n• {temp} = η μεταβλητή temp'
        ],
        validationTests: [
          { name: 'Τυπώνει δωμάτιο, θερμοκρασία και μετρήσεις', script: [
            { setup: true },
            { check: 'lines', is: ['Room: kitchen', 'Temp: 21.5 C', 'Readings: 3'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Room: kitchen», «Temp: 21.5 C», «Readings: 3».' }
          ] }
        ],
        explanationOnSuccess: 'Ωραία. Πρόσεξε ότι το room και το temp δεν έχουν mut: δεν αλλάζουν. Η Rust σε βάζει να δηλώνεις από πριν τι θα αλλάξει. Έτσι πιάνει λάθη νωρίς.',
        remediation: 'Γράψε τα κείμενα ακριβώς: «Temp: 21.5 C» με κεφαλαίο T και κενό πριν το C.'
      },

      {
        kind: 'debug', skills: ['rust', 'variables', 'syntax'],
        title: 'Βρες το λάθος: error[E0384]',
        objectives: ['Να διαβάζω ένα μήνυμα λάθους του rustc.', 'Να διορθώνω το E0384 με let mut.'],
        theory: `
<p>Ο compiler της Rust (<code>rustc</code>) ελέγχει τον κώδικα <strong>πριν</strong> τρέξει.</p>
<p>Το λάθος <code>error[E0384]: cannot assign twice to immutable variable</code> σημαίνει:</p>
<ul>
  <li>«προσπαθείς να αλλάξεις μια μεταβλητή»,</li>
  <li>«αλλά δεν τη δήλωσες με <code>mut</code>».</li>
</ul>
<p>Η διόρθωση γίνεται εκεί που <strong>δηλώνεται</strong> η μεταβλητή, όχι εκεί που αλλάζει:</p>
<pre>let mut presses = 0;</pre>
<p>Το μήνυμα λέει και τη γραμμή. Διάβαζε πάντα τον κωδικό (E0384) και τη γραμμή.</p>`,
        glossary: ['rustc', 'mut', 'μήνυμα λάθους'],
        supportedSyntax: SYN2,
        initialCode: L3_CODE('let presses = 0;'),
        solution: L3_CODE('let mut presses = 0;'),
        panels: ['serial', 'vars'],
        steps: [
          'Τρέξε τον κώδικα. Διάβασε το error: ποιος κωδικός, ποια γραμμή;',
          'Βρες πού δηλώνεται το presses.',
          'Κάνε το presses αλλάξιμο.',
          'Τρέξε ξανά: πρέπει να δεις 0, 1, 2.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Πού μπαίνει το mut για να φύγει το error[E0384];',
          options: ['Στη γραμμή let, εκεί που δηλώνεται η μεταβλητή', 'Στη γραμμή presses = presses + 1', 'Στο println!'],
          answer: 0,
          explain: 'Σωστά. let mut presses = 0; Το mut λέει από την αρχή ότι η μεταβλητή θα αλλάξει.',
          retry: 'Όχι ακόμα. Το mut είναι μέρος της δήλωσης. Ποια γραμμή δηλώνει το presses;'
        },
        hints: [
          'Στη Rust μια μεταβλητή δεν αλλάζει, εκτός αν το πεις από πριν.',
          'Κοίτα τη γραμμή με το let presses. Εκεί λείπει μία λέξη.',
          'let mut presses = 0;\n• mut = «αλλάξιμη»\n• μετά το presses = presses + 1 επιτρέπεται'
        ],
        validationTests: [
          { name: 'Μετρά 0, 1, 2', script: [
            { setup: true },
            { check: 'lines', is: ['Presses: 0', 'Presses: 1', 'Presses: 2'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Presses: 0», «Presses: 1», «Presses: 2».' }
          ] }
        ],
        explanationOnSuccess: 'Διόρθωσες το πρώτο σου λάθος rustc. Η Rust σε αναγκάζει να λες ποια δεδομένα αλλάζουν. Σε μεγάλα προγράμματα αυτό προλαβαίνει πολλά λάθη.',
        remediation: 'Το mut μπαίνει μετά το let: let mut presses = 0;. Όχι mut let, όχι presses mut.'
      },

      {
        kind: 'debug', skills: ['rust', 'variables', 'security'],
        title: 'Βρες το λάθος: ο αριθμός που δεν χωρά (overflow)',
        objectives: ['Να ξέρω τα όρια των u8 και u32.', 'Να καταλαβαίνω το panic «attempt to add with overflow».', 'Να διαλέγω τύπο που χωρά τις τιμές.'],
        theory: `
<p>Κάθε ακέραιος τύπος έχει <strong>όρια</strong>:</p>
<ul>
  <li><code>u8</code>: από 0 έως <strong>255</strong>.</li>
  <li><code>u32</code>: από 0 έως περίπου 4 δισεκατομμύρια.</li>
  <li><code>i32</code>: από περίπου −2 έως +2 δισεκατομμύρια (έχει πρόσημο).</li>
</ul>
<p>Τι γίνεται με <code>200 + 60 + 60</code> σε <code>u8</code>; Το 320 δεν χωρά.</p>
<p>Η C++ θα έδινε σιωπηλά λάθος αριθμό (64). Η Rust, όταν τρέχεις με <code>cargo run</code>, <strong>σταματά</strong> το πρόγραμμα με <strong>panic</strong>:</p>
<pre>thread 'main' panicked at src/main.rs:…
attempt to add with overflow</pre>
<p>Αυτό είναι καλό: ένα λάθος νούμερο σε μια συσκευή μπορεί να κρυφτεί για μήνες.</p>
<p>Προσοχή: σε <code>cargo build --release</code> η Rust δεν ελέγχει. Ο αριθμός «γυρίζει» από την αρχή. Γι’ αυτό διάλεξε πάντα τύπο που χωρά τις τιμές σου.</p>`,
        glossary: ['ακέραιοι τύποι (u8, u32, i32)', 'overflow (υπερχείλιση)', 'panic'],
        supportedSyntax: SYN2,
        initialCode: L4_CODE('u8'),
        solution: L4_CODE('u32'),
        panels: ['serial', 'vars'],
        steps: [
          'Πρόβλεψε: ποια γραμμή θα σταματήσει το πρόγραμμα;',
          'Τρέξε. Διάβασε το panic στο ' + B.term + '.',
          'Το uptime μετρά δευτερόλεπτα. Μία μέρα έχει 86.400 δευτερόλεπτα. Διάλεξε τύπο που τα χωρά.',
          'Τρέξε ξανά: 200, 260, 320.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Το uptime είναι u8 και έχει 200. Τι γίνεται στο uptime = uptime + 60;',
          options: ['Panic: το 260 δεν χωρά σε u8', 'Γίνεται 260', 'Γίνεται 255'],
          answer: 0,
          explain: 'Σωστά. Το u8 φτάνει ως 255. Η Rust σταματά αντί να δώσει λάθος αριθμό.',
          retry: 'Όχι ακόμα. Ποια είναι η μεγαλύτερη τιμή ενός u8;'
        },
        hints: [
          'Το λάθος δεν είναι στην πρόσθεση. Είναι στον τύπο της μεταβλητής.',
          'Κοίτα τη γραμμή let mut uptime: u8. Ποιος τύπος χωρά πολλά δευτερόλεπτα;',
          'let mut uptime: u32 = 200;\n• u32 φτάνει ως 4.294.967.295\n• αρκεί για 136 χρόνια σε δευτερόλεπτα'
        ],
        validationTests: [
          { name: 'Μετρά 200, 260, 320 χωρίς panic', script: [
            { setup: true },
            { check: 'lines', is: ['Uptime: 200 s', 'Uptime: 260 s', 'Uptime: 320 s'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Uptime: 200 s», «Uptime: 260 s», «Uptime: 320 s».' }
          ] }
        ],
        explanationOnSuccess: 'Σωστά! Ο τύπος πρέπει να χωρά όλες τις τιμές που μπορεί να πάρει η μεταβλητή. Στο κεφάλαιο για τον ασφαλή κώδικα θα δεις και checked_add / saturating_add, που δεν «σκάνε» ποτέ.',
        remediation: 'Άλλαξε μόνο τον τύπο: u8 → u32. Τα 60 και 200 μένουν ίδια.'
      },

      {
        kind: 'guided', skills: ['rust', 'io'],
        title: `Το LED αναβοσβήνει (${B.crate})`,
        objectives: [`Να ρυθμίζω το LED ως έξοδο με ${B.crate}.`, 'Να ανάβω και να σβήνω το LED.', 'Να γράφω τον κύριο βρόχο με loop { }.'],
        theory: `
<p>Για τα pins χρειάζεσαι ένα <strong>crate</strong> (βιβλιοθήκη): ${B.pi ? '<code>rppal</code> στο Raspberry Pi' : '<code>esp-idf-svc</code> στο ESP32'}.</p>
<pre>${B.pi ? `let gpio = Gpio::new()?;                    // ο ελεγκτής των pins
let mut led = gpio.get(17)?.into_output();  // GPIO 17 ως έξοδος` : `let peripherals = Peripherals::take()?;               // όλα τα «κομμάτια» του ESP32
let mut led = PinDriver::output(peripherals.pins.gpio2)?;  // GPIO 2 ως έξοδος`}</pre>
<p>Το <code>?</code> σημαίνει: «αν αυτό αποτύχει, σταμάτα τη main με το λάθος». Γι’ αυτό η main γράφεται ${errNote}</p>
<p>Το <code>led</code> έχει <code>mut</code>, γιατί το <code>set_high()</code> αλλάζει την κατάστασή του.</p>
<ul>
  <li><code>led.set_high()${B.q};</code> ανάβει, <code>led.set_low()${B.q};</code> σβήνει.${B.pi ? '' : ' Στο ESP32 επιστρέφουν Result, γι’ αυτό το <code>?</code>.'}</li>
  <li><code>${B.sleep(500)}</code> περιμένει 500 ms.</li>
  <li><code>loop { … }</code> επαναλαμβάνει για πάντα. Κάθε γύρος του είναι μία «επανάληψη».</li>
</ul>`,
        glossary: ['crate', B.pi ? 'rppal' : 'esp-idf-svc', 'loop', 'GPIO'],
        supportedSyntax: SYN3,
        initialCode: L5_CODE('____;   // ΣΥΜΠΛΗΡΩΣΕ: σβήσε το LED'),
        solution: L5_CODE(B.w('led', 'set_low')),
        hardware: ['led'], panels: ['serial', 'vars', 'loops'],
        steps: [
          'Διάβασε πώς φτιάχνεται το led. Σε ποιο GPIO είναι;',
          'Συμπλήρωσε το κενό με την εντολή που σβήνει το LED.',
          'Τρέξε. Το LED πρέπει να ανάβει και να σβήνει κάθε μισό δευτερόλεπτο.',
          'Κοίτα τον πίνακα «Επαναλήψεις»: κάθε γύρος του loop είναι μία γραμμή.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Γιατί γράφουμε let mut led και όχι let led;',
          options: ['Γιατί το set_high() / set_low() αλλάζει το led', 'Γιατί το LED είναι αριθμός', 'Δεν χρειάζεται, είναι διακοσμητικό'],
          answer: 0,
          explain: 'Σωστά. Η Rust θέλει mut για κάθε τιμή που αλλάζει, ακόμα και για ένα pin.',
          retry: 'Όχι ακόμα. Τι κάνει το set_high() στο led;'
        },
        hints: [
          'Το LED σβήνει με την «αντίθετη» εντολή του set_high.',
          `Στη θέση του ____ γράψε την εντολή για LOW, με το ίδιο σχήμα: led.…()${B.q};`,
          `${B.w('led', 'set_low')}\n• set_low = σβήσε\n${B.pi ? '• στο rppal δεν θέλει ?' : '• στο ESP32 θέλει ? γιατί επιστρέφει Result'}`
        ],
        validationTests: [
          { name: 'Σε 3 γύρους: 3 φορές ON και 3 φορές OFF', script: [
            { setup: true }, { loops: 3 },
            { check: 'count', text: 'ON', is: 3, fail: 'Σε 3 γύρους το «ON» τυπώθηκε {n} φορές. Περίμενα 3.' },
            { check: 'count', text: 'OFF', is: 3, fail: 'Σε 3 γύρους το «OFF» τυπώθηκε {n} φορές. Περίμενα 3.' },
            { check: 'led', is: false, fail: 'Στο τέλος του γύρου το LED είναι {v}. Περίμενα σβηστό.' }
          ] },
          { name: 'Μισό δευτερόλεπτο αναμμένο, μισό σβηστό', script: [
            { setup: true }, { ms: 250 },
            { check: 'led', is: true, fail: 'Στα 250 ms το LED είναι {v}. Περίμενα αναμμένο.' },
            { ms: 500 },
            { check: 'led', is: false, fail: 'Στα 750 ms το LED είναι {v}. Περίμενα σβηστό. Σβήνεις το LED μετά την πρώτη αναμονή;' }
          ] }
        ],
        explanationOnSuccess: `Το «Hello world» των μικροελεγκτών, σε Rust! Το ίδιο πρόγραμμα με τα σωστά pins τρέχει σε αληθινό ${B.name}${B.pi ? ' με cargo run' : ' με cargo run και espflash'}.`,
        remediation: `Αν βλέπεις error για το ____, δεν το αντικατέστησες. Αν το LED μένει αναμμένο, λείπει το ${B.w('led', 'set_low')}`
      },

      {
        kind: 'checkpoint', skills: ['rust', 'io', 'variables', 'timing'],
        title: 'Έλεγχος κεφαλαίου: καρδιογράφημα',
        objectives: ['Να συνδυάζω let mut, println! και το LED.', 'Να φτιάχνω δικό μου μοτίβο χρόνου.'],
        theory: `
<p>Ένα LED «καρδιάς» δείχνει ότι η συσκευή ζει. Το μοτίβο σου:</p>
<ol>
  <li>αναμμένο 100 ms, σβηστό 100 ms,</li>
  <li>αναμμένο 100 ms, σβηστό <strong>700 ms</strong>.</li>
</ol>
<p>Ένας γύρος κρατά 1 δευτερόλεπτο.</p>
<p>Θέλεις και μετρητή <code>beats</code> (τύπος <code>u32</code>, με <code>mut</code>). Στην αρχή κάθε γύρου αυξάνεται κατά 1 και τυπώνεται: «Beat 1», «Beat 2», …</p>
<p>Ο μετρητής δηλώνεται <strong>πριν</strong> από το <code>loop</code>. Αλλιώς θα ξεκινούσε από την αρχή σε κάθε γύρο.</p>`,
        glossary: ['let', 'mut', 'loop'],
        supportedSyntax: SYN3,
        initialCode: L6_INITIAL,
        solution: L6_SOLUTION,
        hardware: ['led'], panels: ['serial', 'vars', 'loops'],
        steps: [
          'Φτιάξε τον μετρητή beats πριν από το loop.',
          'Στην αρχή του loop: αύξησέ τον και τύπωσε «Beat …».',
          'Γράψε το μοτίβο: on 100, off 100, on 100, off 700.',
          'Τρέξε και μέτρα με το μάτι: δύο γρήγορα χτυπήματα, μία παύση.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Πού δηλώνεις το let mut beats = 0;',
          options: ['Πριν από το loop, για να θυμάται την τιμή του', 'Μέσα στο loop, στην αρχή', 'Μετά το loop'],
          answer: 0,
          explain: 'Σωστά. Μέσα στο loop θα γινόταν 0 σε κάθε γύρο. Μετά το loop δεν θα έτρεχε ποτέ.',
          retry: 'Όχι ακόμα. Τι θα γινόταν αν ξαναφτιαχνόταν σε κάθε γύρο;'
        },
        hints: [
          'Δύο δουλειές: ένας μετρητής που ζει έξω από το loop, και τέσσερα ζευγάρια «εντολή LED + αναμονή».',
          `let mut beats: u32 = 0; πριν από το loop. Μέσα: beats = beats + 1; println!("Beat {beats}"); και μετά set_high / ${B.sleep(100)} / set_low / …`,
          `beats = beats + 1;\nprintln!("Beat {beats}");\n${B.w('led', 'set_high')}\n${B.sleep(100)}\n${B.w('led', 'set_low')}\n${B.sleep(100)}\n${B.w('led', 'set_high')}\n${B.sleep(100)}\n${B.w('led', 'set_low')}\n${B.sleep(700)}`
        ],
        validationTests: [
          { name: 'Μετρά τους χτύπους: Beat 1, 2, 3', script: [
            { setup: true }, { loops: 3 },
            { check: 'lines', is: ['Beat 1', 'Beat 2', 'Beat 3'], fail: 'Σε 3 γύρους το ' + B.term + ' έγραψε: {v}. Περίμενα «Beat 1», «Beat 2», «Beat 3».' }
          ] },
          { name: 'Μοτίβο: on 100, off 100, on 100, off 700', script: [
            { setup: true }, { ms: 50 },
            { check: 'led', is: true, fail: 'Στα 50 ms το LED είναι {v}. Περίμενα αναμμένο (πρώτος χτύπος).' },
            { ms: 100 },
            { check: 'led', is: false, fail: 'Στα 150 ms το LED είναι {v}. Περίμενα σβηστό: ο πρώτος χτύπος κρατά 100 ms.' },
            { ms: 100 },
            { check: 'led', is: true, fail: 'Στα 250 ms το LED είναι {v}. Περίμενα αναμμένο (δεύτερος χτύπος).' },
            { ms: 300 },
            { check: 'led', is: false, fail: 'Στα 550 ms το LED είναι {v}. Περίμενα σβηστό (η μεγάλη παύση).' },
            { ms: 500 },
            { check: 'led', is: true, fail: 'Στα 1050 ms το LED είναι {v}. Περίμενα αναμμένο: ο νέος γύρος ξεκινά στο 1 δευτερόλεπτο.' }
          ] }
        ],
        explanationOnSuccess: 'Έλεγχος κεφαλαίου: πέτυχε! Ξέρεις πια fn main, println!, let και let mut, τύπους που χωρούν τις τιμές τους και το LED με Rust.',
        remediation: 'Αν τα Beat δεν αυξάνονται, το let mut beats είναι μέσα στο loop. Αν ο χρόνος δεν ταιριάζει, μέτρησε: 100 + 100 + 100 + 700 = 1000 ms.'
      }
    ];
  });
})(typeof window !== 'undefined' ? window : globalThis);
