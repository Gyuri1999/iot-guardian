/*
 * IoT Guardian — Διαδρομή Rust, Κεφάλαιο 4: Option, Result και match.
 * Raspberry Pi: κεφάλαιο 44 · ESP32: κεφάλαιο 54. Χρησιμοποιεί το L.RustKit του rs1.js.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  const K = L.RustKit;

  K.addGlossary([
    { term: 'Option', def: 'Τιμή που μπορεί να λείπει: Some(τιμή) ή None. Π.χ. το v.get(5) δίνει None αν δεν υπάρχει θέση 5. Η Rust δεν έχει null.' },
    { term: 'Result', def: 'Αποτέλεσμα που μπορεί να είναι λάθος: Ok(τιμή) ή Err(λάθος). Π.χ. το "abc".parse::<u32>() δίνει Err.' },
    { term: 'match', def: 'Διαλέγει σκέλος ανάλογα με την τιμή: match x { Some(v) => …, None => … }. Πρέπει να καλύπτει κάθε περίπτωση (αλλιώς error[E0004]).' },
    { term: 'if let', def: 'Σύντομο match για μία περίπτωση: if let Some(v) = x { … }. Τρέχει μόνο αν ταιριάζει.' },
    { term: '? (τελεστής)', def: 'Μετά από Result: αν είναι Ok, δίνει την τιμή. Αν είναι Err, η συνάρτηση επιστρέφει αμέσως το λάθος. Δουλεύει μόνο σε συνάρτηση που επιστρέφει Result (ή Option).' },
    { term: 'unwrap', def: 'Βγάζει την τιμή από Some / Ok. Αν βρει None / Err, κάνει panic και σταματά το πρόγραμμα. Σε συσκευή που πρέπει να δουλεύει πάντα, απόφυγέ το.' },
    { term: 'parse', def: 'Μετατρέπει κείμενο σε αριθμό: "42".parse::<u32>(). Επιστρέφει Result, γιατί το κείμενο μπορεί να μην είναι αριθμός.' },
    { term: 'enum', def: 'Τύπος με λίστα από επιλογές: enum Mode { Off, On, Blink }. Μια τιμή Mode είναι πάντα ακριβώς μία από αυτές.' },
    { term: 'impl', def: 'Μπλοκ με συναρτήσεις (μεθόδους) για έναν τύπο: impl Mode { fn next(self) -> Mode { … } }.' },
    { term: '#[derive(…)]', def: 'Ζητά από τον compiler να γράψει έτοιμες ικανότητες: Debug (τύπωμα με {:?}), Clone / Copy (αντιγραφή), PartialEq (σύγκριση με ==).' }
  ]);

  K.defineChapter(4, 'Option, Result και match', B => {
    const SYN1 = 'vec![…], v.get(i), Some(x), None, match x { … => …, }';
    const SYN2 = SYN1 + ', "42".parse::<u32>(), Ok(n), Err(e), Err(_)';
    const SYN3 = SYN2 + ', fn f(…) -> Result<u32, Box<dyn Error>>, ?, Err("…".into()), if let Ok(x) = …';
    const SYN4 = SYN3 + `, #[derive(Debug, Clone, Copy, PartialEq)], enum Mode { Off, On, Blink }, impl Mode { fn next(self) -> Mode }, {:?}, led.toggle()${B.q}`;
    const plain = body => `${B.mainPlain}\n${body}\n}\n`;
    const MODE_ENUM = `#[derive(Debug, Clone, Copy, PartialEq)]
enum Mode {
    Off,
    On,
    Blink,
}`;
    const driveLed = (blinkArm) => `        match mode {
            Mode::Off => {
                ${B.w('led', 'set_low')}
            }
            Mode::On => {
                ${B.w('led', 'set_high')}
            }${blinkArm}
        }`;
    const BLINK_ARM = `
            Mode::Blink => {
                ${B.w('led', 'toggle')}   // αλλάζει σε κάθε γύρο
            }`;

    // 4.1
    const L1_CODE = (noneArm) => plain(`    let readings = vec![21, 23, 22];   // θέσεις 0, 1, 2

    for index in [1, 5] {
        match readings.get(index) {
            Some(value) => println!("Reading {index}: {value}"),${noneArm}
        }
    }`);

    // 4.2
    const L2_CODE = (errArm) => plain(`    // Κείμενα που ήρθαν από έναν αισθητήρα.
    let inputs = ["42", "abc", "7"];

    for text in inputs {
        match text.parse::<u32>() {
            Ok(n) => println!("Value: {n}"),
            ${errArm}
        }
    }`);

    // 4.3
    const L3_CODE = (loopBody) => plain(`    // Γραμμές από ένα αρχείο καταγραφής. Η μία χάλασε.
    let lines = vec!["21", "22", "ERR", "23"];
    let mut sum: u32 = 0;
    let mut count: u32 = 0;

    for line in lines.iter() {
${loopBody}
    }
    println!("Average: {}", sum / count);`);
    const L3_BAD = `        let t: u32 = line.parse().unwrap();
        sum += t;
        count += 1;`;
    const L3_GOOD = `        match line.parse::<u32>() {
            Ok(t) => {
                sum += t;
                count += 1;
            }
            Err(_) => println!("Skipped bad line: {line}"),
        }`;

    // 4.4
    const L4_CODE = (q) => `use std::error::Error;

const MAX_LIMIT: u32 = 100;

// Διαβάζει ένα όριο από κείμενο. Λάθος αν δεν είναι αριθμός ή αν είναι πάνω από 100.
fn parse_limit(text: &str) -> Result<u32, Box<dyn Error>> {
    let n: u32 = text.trim().parse()${q};
    if n > MAX_LIMIT {
        return Err("limit too high".into());
    }
    Ok(n)
}

${B.mainPlain}
    if let Ok(limit) = parse_limit(" 40 ") {
        println!("Limit: {limit}");
    }
    for text in ["500", "abc"] {
        match parse_limit(text) {
            Ok(n) => println!("Limit: {n}"),
            Err(e) => println!("Rejected {text}: {e}"),
        }
    }
}
`;

    // 4.5
    const L5_CODE = (nextBody) => `// Ένα κουμπί, τρεις καταστάσεις: Off → On → Blink → Off …
${B.uses({ sleep: true })}

${MODE_ENUM}

impl Mode {
    // Η επόμενη κατάσταση μετά από ένα πάτημα.
    fn next(self) -> Mode {
${nextBody}
    }
}

${B.mainHw}
    ${B.pin('led')}
    ${B.pin('button')}
    let mut mode = Mode::Off;
    let mut was_pressed = false;

    loop {
        let pressed = button.is_high();
        if pressed && !was_pressed {
            mode = mode.next();
            println!("Mode: {:?}", mode);
        }
        was_pressed = pressed;

${driveLed(BLINK_ARM)}
        ${B.sleep(250)}
    }
}
`;
    const L5_NEXT_BAD = `        // ΣΥΜΠΛΗΡΩΣΕ: γράψε ένα match πάνω στο self.
        // Off → On, On → Blink, Blink → Off.
        self`;
    const L5_NEXT_GOOD = `        match self {
            Mode::Off => Mode::On,
            Mode::On => Mode::Blink,
            Mode::Blink => Mode::Off,
        }`;

    // 4.6
    const L6_CODE = (modeFor, blinkArm) => `// Φως διαδρόμου με PIR:
//   κίνηση τώρα            → Blink (ειδοποίηση)
//   κίνηση πριν από λίγο   → On (φως για λίγους γύρους)
//   ησυχία για 4+ γύρους   → Off
${B.uses({ sleep: true })}

${MODE_ENUM}

const QUIET_LOOPS: u32 = 4;

fn mode_for(motion: bool, quiet: u32) -> Mode {
${modeFor}
}

${B.mainHw}
    ${B.pin('led')}
    ${B.pin('pir')}
    let mut quiet: u32 = 100;    // πόσοι γύροι χωρίς κίνηση
    let mut last = Mode::Off;

    loop {
        let motion = pir.is_high();
        if motion {
            quiet = 0;
        } else if quiet < 100 {
            quiet += 1;
        }

        let mode = mode_for(motion, quiet);
        if mode != last {
            println!("Mode: {:?}", mode);
            last = mode;
        }

${driveLed(blinkArm)}
        ${B.sleep(250)}
    }
}
`;
    const L6_FOR_BAD = `    // ΣΥΜΠΛΗΡΩΣΕ: πρόσθεσε την κατάσταση On (quiet < QUIET_LOOPS).
    if motion {
        Mode::Blink
    } else {
        Mode::Off
    }`;
    const L6_FOR_GOOD = `    if motion {
        Mode::Blink
    } else if quiet < QUIET_LOOPS {
        Mode::On
    } else {
        Mode::Off
    }`;
    const L6_ARM_BAD = '\n            // ΣΥΜΠΛΗΡΩΣΕ: τι κάνει το LED στο Mode::Blink;';

    return [
      {
        kind: 'micro', skills: ['rust', 'conditions'],
        title: 'Option: η τιμή που μπορεί να λείπει',
        objectives: ['Να χρησιμοποιώ το v.get(i), που δίνει Option.', 'Να γράφω match με Some και None.'],
        theory: `
<p>Τι γίνεται αν ζητήσεις τη θέση 5 σε μια λίστα με 3 τιμές;</p>
<p>Το <code>readings.get(5)</code> δεν «σκάει». Δίνει ένα <strong>Option</strong>:</p>
<ul>
  <li><code>Some(τιμή)</code> αν η θέση υπάρχει,</li>
  <li><code>None</code> αν δεν υπάρχει.</li>
</ul>
<p>Με <code>match</code> χειρίζεσαι και τα δύο:</p>
<pre>match readings.get(index) {
    Some(value) => println!("Reading {index}: {value}"),
    None => println!("No reading at {index}"),
}</pre>
<p>Ο compiler σε <strong>αναγκάζει</strong> να γράψεις και το None. Αν λείπει, λέει <code>error[E0004]: non-exhaustive patterns: None not covered</code>: «ξέχασες μια περίπτωση».</p>
<p>Η Rust δεν έχει <code>null</code>. Ό,τι μπορεί να λείπει είναι Option, και φαίνεται στον τύπο.</p>`,
        glossary: ['Option', 'match', 'Vec'],
        supportedSyntax: SYN1,
        initialCode: L1_CODE(''),
        solution: L1_CODE('\n            None => println!("No reading at {index}"),'),
        panels: ['serial', 'vars'],
        steps: [
          'Απάντησε στην ερώτηση πρόβλεψης.',
          'Τρέξε. Διάβασε το error[E0004]. Ποια περίπτωση λείπει;',
          'Πρόσθεσε το σκέλος None, που τυπώνει «No reading at 5».',
          'Τρέξε ξανά.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Η λίστα έχει 3 τιμές. Τι δίνει το readings.get(3);',
          options: ['None: οι θέσεις είναι 0, 1, 2', 'Some(22)', 'Panic'],
          answer: 0,
          explain: 'Σωστά. Οι θέσεις ξεκινούν από 0, άρα η τελευταία είναι η 2. Το get δεν κάνει panic: δίνει None.',
          retry: 'Όχι ακόμα. Από ποιον αριθμό ξεκινούν οι θέσεις σε μια λίστα;'
        },
        hints: [
          'Ένα match πάνω σε Option θέλει δύο σκέλη: Some(…) και None.',
          'Κάτω από το σκέλος Some(value) => …, γράψε ένα σκέλος για το None με ένα println!.',
          'None => println!("No reading at {index}"),\n• το None δεν έχει τιμή μέσα του\n• κάθε σκέλος τελειώνει με ,'
        ],
        validationTests: [
          { name: 'Θέση 1: τιμή · θέση 5: «No reading»', script: [
            { setup: true },
            { check: 'lines', is: ['Reading 1: 23', 'No reading at 5'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Reading 1: 23» και «No reading at 5».' }
          ] }
        ],
        explanationOnSuccess: 'Ο compiler σε έβαλε να σκεφτείς τι γίνεται όταν η τιμή λείπει. Σε άλλες γλώσσες αυτό το ξεχνάμε, και η συσκευή «σκάει» τη χειρότερη στιγμή.',
        remediation: 'Γράψε το σκέλος μέσα στα άγκιστρα του match, μετά το σκέλος του Some.'
      },

      {
        kind: 'guided', skills: ['rust', 'conditions', 'sensors'],
        title: 'Result: κείμενο που μπορεί να μην είναι αριθμός',
        objectives: ['Να μετατρέπω κείμενο σε αριθμό με parse::<u32>().', 'Να χειρίζομαι Ok και Err με match.'],
        theory: `
<p>Οι αισθητήρες και τα δίκτυα συχνά στέλνουν <strong>κείμενο</strong>. Για να γίνει αριθμός:</p>
<pre>"42".parse::&lt;u32&gt;()</pre>
<p>Το <code>::&lt;u32&gt;</code> λέει «θέλω u32». Αλλά τι γίνεται με το <code>"abc"</code>; Δεν είναι αριθμός!</p>
<p>Γι’ αυτό το parse δίνει <strong>Result</strong>:</p>
<ul>
  <li><code>Ok(42)</code>: πέτυχε,</li>
  <li><code>Err(e)</code>: απέτυχε. Το <code>e</code> λέει γιατί, π.χ. <code>invalid digit found in string</code>.</li>
</ul>
<pre>match text.parse::&lt;u32&gt;() {
    Ok(n) => …,
    Err(e) => println!("Bad input {text}: {e}"),
}</pre>
<p>Αν δεν σε νοιάζει το λάθος, γράψε <code>Err(_)</code>.</p>`,
        glossary: ['Result', 'parse', 'match'],
        supportedSyntax: SYN2,
        initialCode: L2_CODE('Err(e) => ____,   // ΣΥΜΠΛΗΡΩΣΕ: τύπωσε «Bad input …: …»'),
        solution: L2_CODE('Err(e) => println!("Bad input {text}: {e}"),'),
        panels: ['serial', 'vars'],
        steps: [
          'Πρόβλεψε: ποια από τα τρία κείμενα είναι αριθμοί;',
          'Συμπλήρωσε το σκέλος Err: τύπωσε «Bad input », το κείμενο, «: » και το λάθος.',
          'Τρέξε. Τι λέει το μήνυμα λάθους του parse;',
          'Δοκίμασε να αλλάξεις το "7" σε "-7". Τι γίνεται; (Μετά ξαναβάλ’ το "7".)',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Τι δίνει το "300".parse::<u8>();',
          options: ['Err: το 300 δεν χωρά σε u8', 'Ok(300)', 'Ok(255)'],
          answer: 0,
          explain: 'Σωστά. Το parse ελέγχει και τα όρια του τύπου: number too large to fit in target type.',
          retry: 'Όχι ακόμα. Θυμήσου τα όρια του u8 από το πρώτο κεφάλαιο.'
        },
        hints: [
          'Το σκέλος Err χρειάζεται ένα println! αντί για το ____.',
          'Μέσα στο κείμενο του println! χρησιμοποίησε {text} και {e}.',
          'Err(e) => println!("Bad input {text}: {e}"),'
        ],
        validationTests: [
          { name: '42 και 7 περνούν · abc απορρίπτεται', script: [
            { setup: true },
            { check: 'lines', is: ['Value: 42', 'Bad input abc: invalid digit found in string', 'Value: 7'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Value: 42», «Bad input abc: invalid digit found in string», «Value: 7».' }
          ] }
        ],
        explanationOnSuccess: 'Το πρόγραμμα δεν σταμάτησε στο "abc". Χειρίστηκε το λάθος και συνέχισε. Έτσι πρέπει να φέρεται μια συσκευή όταν της έρθουν παράξενα δεδομένα.',
        remediation: 'Γράψε το κείμενο ακριβώς: «Bad input {text}: {e}», με κενό μετά το «:».'
      },

      {
        kind: 'debug', skills: ['rust', 'sensors', 'security'],
        title: 'Βρες το λάθος: το unwrap() που σταματά τα πάντα',
        objectives: ['Να καταλαβαίνω γιατί το unwrap() κάνει panic.', 'Να αντικαθιστώ το unwrap() με match.', 'Να προσπερνώ μια χαλασμένη τιμή χωρίς να σταματά η συσκευή.'],
        theory: `
<p>Το <code>.unwrap()</code> λέει: «είμαι σίγουρος ότι είναι Ok, δώσε μου την τιμή».</p>
<p>Αν όμως είναι <code>Err</code>, κάνει <strong>panic</strong>:</p>
<pre>called \`Result::unwrap()\` on an \`Err\` value: ParseIntError { kind: InvalidDigit }</pre>
<p>Ένα χαλασμένο κείμενο, και σταματά όλη η συσκευή. Σε ένα σύστημα που πρέπει να δουλεύει μέρα-νύχτα, αυτό είναι πρόβλημα.</p>
<p>Η διόρθωση: χειρίσου το Err με <code>match</code>.</p>
<pre>match line.parse::&lt;u32&gt;() {
    Ok(t) => { … χρησιμοποίησε το t … }
    Err(_) => println!("Skipped bad line: {line}"),
}</pre>
<p>Το unwrap() είναι εντάξει σε μικρές δοκιμές. Σε δεδομένα που έρχονται απ’ έξω, χρησιμοποίησε match, if let ή ?.</p>`,
        glossary: ['unwrap', 'panic', 'Result'],
        supportedSyntax: SYN2,
        initialCode: L3_CODE(L3_BAD),
        solution: L3_CODE(L3_GOOD),
        panels: ['serial', 'vars'],
        steps: [
          'Τρέξε. Διάβασε το panic. Ποια γραμμή του αρχείου το προκάλεσε;',
          'Αντικατάστησε το unwrap() με ένα match πάνω στο line.parse::<u32>().',
          'Στο Ok(t) πρόσθεσε στο sum και μέτρα. Στο Err(_) τύπωσε «Skipped bad line: …».',
          'Τρέξε: ο μέσος όρος πρέπει να είναι 22.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Τι κάνει το "ERR".parse::<u32>().unwrap();',
          options: ['Panic: το πρόγραμμα σταματά', 'Δίνει 0', 'Δίνει None'],
          answer: 0,
          explain: 'Σωστά. Το unwrap σε Err σταματά το πρόγραμμα. Δεν μαντεύει μια τιμή.',
          retry: 'Όχι ακόμα. Το "ERR" δεν είναι αριθμός. Τι κάνει το unwrap όταν βρει Err;'
        },
        hints: [
          'Το unwrap() υποθέτει ότι όλα πάνε καλά. Εδώ μία γραμμή είναι χαλασμένη.',
          'Βάλε τις τρεις γραμμές του βρόχου μέσα σε ένα match: σκέλος Ok(t) για τη μέτρηση, σκέλος Err(_) για το μήνυμα.',
          'match line.parse::<u32>() {\n    Ok(t) => {\n        sum += t;\n        count += 1;\n    }\n    Err(_) => println!("Skipped bad line: {line}"),\n}'
        ],
        validationTests: [
          { name: 'Προσπερνά το ERR και βγάζει μέσο όρο 22', script: [
            { setup: true },
            { check: 'lines', is: ['Skipped bad line: ERR', 'Average: 22'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Skipped bad line: ERR» και «Average: 22».' }
          ] }
        ],
        explanationOnSuccess: 'Η συσκευή αντέχει πια μια χαλασμένη μέτρηση. Και το λέει καθαρά στο log, αντί να την κρύψει. Αυτό είναι αμυντικός προγραμματισμός.',
        remediation: 'Αν ο μέσος όρος βγαίνει λάθος, μήπως μετράς και τη χαλασμένη γραμμή; Το count += 1 μπαίνει μόνο στο Ok.'
      },

      {
        kind: 'guided', skills: ['rust', 'conditions', 'security'],
        title: 'Ο τελεστής ? και το if let',
        objectives: ['Να γράφω συνάρτηση που επιστρέφει Result.', 'Να προωθώ λάθη με ?.', 'Να χρησιμοποιώ if let για μία περίπτωση.'],
        theory: `
<p>Μια συνάρτηση που μπορεί να αποτύχει επιστρέφει <code>Result</code>:</p>
<pre>fn parse_limit(text: &str) -> Result&lt;u32, Box&lt;dyn Error&gt;&gt;</pre>
<p>Το <code>Box&lt;dyn Error&gt;</code> σημαίνει «οποιοδήποτε λάθος». Θέλει <code>use std::error::Error;</code>.</p>
<p>Μέσα της, το <code>?</code> κάνει τη δουλειά του match για σένα:</p>
<pre>let n: u32 = text.trim().parse()?;</pre>
<ul>
  <li>αν το parse δώσει <code>Ok(40)</code>, το <code>n</code> γίνεται 40,</li>
  <li>αν δώσει <code>Err</code>, η συνάρτηση <strong>επιστρέφει αμέσως</strong> το λάθος.</li>
</ul>
<p>Χωρίς το <code>?</code>, ο compiler λέει <code>error[E0308]: expected u32, found Result</code>: «αυτό είναι Result, όχι αριθμός».</p>
<p>Δικό σου λάθος: <code>return Err("limit too high".into());</code>. Στο τέλος, η επιτυχία: <code>Ok(n)</code>.</p>
<p>Για μία μόνο περίπτωση, το <code>if let</code> είναι πιο σύντομο από το match: <code>if let Ok(limit) = parse_limit(" 40 ") { … }</code>.</p>`,
        glossary: ['? (τελεστής)', 'if let', 'Result'],
        supportedSyntax: SYN3,
        initialCode: L4_CODE('   /* ΣΥΜΠΛΗΡΩΣΕ: αν το parse αποτύχει, επέστρεψε το λάθος */'),
        solution: L4_CODE('?'),
        panels: ['serial', 'vars'],
        steps: [
          'Τρέξε. Διάβασε το error[E0308]. Τι τύπο δίνει το parse();',
          'Πρόσθεσε το ? αμέσως μετά το parse() (πριν από το ;).',
          'Τρέξε. Ποια από τα τρία όρια περνούν;',
          'Βρες το if let. Τι θα γινόταν με το " 40 " χωρίς το trim();',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Στην parse_limit("abc"), πού σταματά η εκτέλεση;',
          options: ['Στη γραμμή με το ?: η συνάρτηση επιστρέφει αμέσως Err', 'Στο return Err("limit too high")', 'Στο Ok(n)'],
          answer: 0,
          explain: 'Σωστά. Το ? βλέπει Err και επιστρέφει αμέσως. Οι επόμενες γραμμές δεν τρέχουν.',
          retry: 'Όχι ακόμα. Τι κάνει το ? όταν βρει Err;'
        },
        hints: [
          'Το parse() δίνει Result. Το n θέλει u32. Κάτι πρέπει να «ανοίξει» το Result.',
          'Ένας χαρακτήρας αρκεί, αμέσως μετά το parse().',
          'let n: u32 = text.trim().parse()?;\n• Ok → n = ο αριθμός\n• Err → η συνάρτηση επιστρέφει το λάθος'
        ],
        validationTests: [
          { name: '40 περνά · 500 και abc απορρίπτονται με λόγο', script: [
            { setup: true },
            { check: 'lines', is: ['Limit: 40', 'Rejected 500: limit too high', 'Rejected abc: invalid digit found in string'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Limit: 40», «Rejected 500: limit too high», «Rejected abc: invalid digit found in string».' }
          ] }
        ],
        explanationOnSuccess: 'Με το ? τα λάθη «ανεβαίνουν» μόνα τους στον καλούντα, χωρίς να γράφεις match παντού. Το ίδιο ? χρησιμοποιείς ήδη στη main: ' + (B.pi ? 'gpio.get(17)?' : 'Peripherals::take()?') + '.',
        remediation: 'Το ? μπαίνει πριν από το ;: parse()?; και σβήσε το σχόλιο /* … */.'
      },

      {
        kind: 'variant', skills: ['rust', 'state', 'io'],
        title: 'Παραλλαγή: enum Mode με το κουμπί',
        objectives: ['Να ορίζω enum με καταστάσεις.', 'Να γράφω μέθοδο με match μέσα σε impl.', 'Να οδηγώ το LED ανάλογα με την κατάσταση.'],
        theory: `
<p>Ένα <code>enum</code> είναι μια λίστα επιλογών. Μια τιμή του είναι πάντα <strong>ακριβώς μία</strong>:</p>
<pre>#[derive(Debug, Clone, Copy, PartialEq)]
enum Mode { Off, On, Blink }</pre>
<ul>
  <li><code>Debug</code>: τυπώνεται με <code>{:?}</code> → «On».</li>
  <li><code>Clone, Copy</code>: αντιγράφεται σαν αριθμός (χωρίς move).</li>
  <li><code>PartialEq</code>: συγκρίνεται με <code>==</code>.</li>
</ul>
<p>Στο <code>impl Mode</code> γράφεις μεθόδους. Η <code>next(self)</code> δίνει την επόμενη κατάσταση με ένα match:</p>
<pre>match self {
    Mode::Off => Mode::On,
    …
}</pre>
<p>Αυτό είναι ένα <strong>state machine</strong>: καταστάσεις και κανόνες για το πώς αλλάζουν. Είναι πολύ πιο καθαρό από τρία bool.</p>
<p>Στο Blink το LED κάνει <code>toggle()</code> σε κάθε γύρο (κάθε 250 ms).</p>`,
        glossary: ['enum', 'impl', '#[derive(…)]', 'match', 'κατάσταση (state)'],
        supportedSyntax: SYN4,
        initialCode: L5_CODE(L5_NEXT_BAD),
        solution: L5_CODE(L5_NEXT_GOOD),
        world: { button: false },
        hardware: ['led', 'button'], panels: ['serial', 'vars', 'loops'],
        steps: [
          'Διάβασε το enum και το match που οδηγεί το LED.',
          'Τρέξε και πάτα το κουμπί. Αλλάζει η κατάσταση; Γιατί όχι;',
          'Γράψε το match στη next: Off → On, On → Blink, Blink → Off.',
          'Τρέξε και πάτα τρεις φορές.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Τι τυπώνει το println!("{:?}", Mode::On.next());',
          options: ['Blink', 'On', 'Off'],
          answer: 0,
          explain: 'Σωστά. Μετά το On έρχεται το Blink.',
          retry: 'Όχι ακόμα. Ακολούθησε τον κανόνα: Off → On → Blink → Off.'
        },
        hints: [
          'Η next πρέπει να εξετάσει το self με match, ένα σκέλος για κάθε κατάσταση.',
          'Τρία σκέλη: Mode::Off => Mode::On, και άλλα δύο. Σβήσε το self που επιστρέφει τώρα.',
          'match self {\n    Mode::Off => Mode::On,\n    Mode::On => Mode::Blink,\n    Mode::Blink => Mode::Off,\n}'
        ],
        validationTests: [
          { name: 'Πάτημα 1: On (αναμμένο) · πάτημα 2: Blink · πάτημα 3: Off', script: [
            { setup: true }, { loops: 1 },
            { sequence: { button: [1, 0] } },
            { check: 'lastLine', is: 'Mode: On', fail: 'Μετά το 1ο πάτημα η τελευταία γραμμή είναι {v}. Περίμενα «Mode: On».' },
            { check: 'led', is: true, fail: 'Στο On το LED είναι {v}. Περίμενα αναμμένο.' },
            { sequence: { button: [1, 0] } },
            { check: 'lastLine', is: 'Mode: Blink', fail: 'Μετά το 2ο πάτημα η τελευταία γραμμή είναι {v}. Περίμενα «Mode: Blink».' },
            { sequence: { button: [1, 0] } },
            { check: 'lastLine', is: 'Mode: Off', fail: 'Μετά το 3ο πάτημα η τελευταία γραμμή είναι {v}. Περίμενα «Mode: Off».' },
            { check: 'led', is: false, fail: 'Στο Off το LED είναι {v}. Περίμενα σβηστό.' }
          ] },
          { name: 'Στο Blink το LED αλλάζει σε κάθε γύρο', script: [
            { setup: true }, { loops: 1 },
            { sequence: { button: [1, 0, 1, 0] } },
            { check: 'led', is: true, fail: 'Στο Blink, μετά από 2 γύρους, το LED είναι {v}. Περίμενα αναμμένο.' },
            { loops: 1 },
            { check: 'led', is: false, fail: 'Στο Blink, έναν γύρο μετά, το LED είναι {v}. Περίμενα να άλλαξε (σβηστό).' },
            { loops: 1 },
            { check: 'led', is: true, fail: 'Στο Blink, έναν ακόμα γύρο μετά, το LED είναι {v}. Περίμενα αναμμένο.' }
          ] }
        ],
        explanationOnSuccess: 'Ένα state machine με enum! Αν αύριο προσθέσεις κατάσταση (π.χ. Dim), ο compiler θα σου δείξει κάθε match που πρέπει να ενημερώσεις.',
        remediation: 'Τα σκέλη γράφονται Mode::Off, όχι σκέτο Off. Κάθε σκέλος τελειώνει με κόμμα.'
      },

      {
        kind: 'checkpoint', skills: ['rust', 'state', 'sensors', 'io'],
        title: 'Έλεγχος κεφαλαίου: φως διαδρόμου με PIR (E0004)',
        objectives: ['Να διορθώνω ένα match που δεν καλύπτει όλες τις περιπτώσεις.', 'Να γράφω συνάρτηση που επιστρέφει enum.', 'Να συνδυάζω enum, match και PIR.'],
        theory: `
<p>Ένα φως διαδρόμου με αισθητήρα κίνησης (PIR, GPIO ${B.P.pir}). Τρεις καταστάσεις:</p>
<ul>
  <li><strong>Blink</strong>: υπάρχει κίνηση <strong>τώρα</strong>.</li>
  <li><strong>On</strong>: υπήρξε κίνηση πριν από λίγους γύρους (<code>quiet &lt; QUIET_LOOPS</code>).</li>
  <li><strong>Off</strong>: ησυχία για 4 γύρους ή περισσότερους.</li>
</ul>
<p>Ο κώδικας που σου έδωσαν δεν περνά το compile: <code>error[E0004]: non-exhaustive patterns: Mode::Blink not covered</code>.</p>
<p>Το match πρέπει να έχει σκέλος για <strong>κάθε</strong> κατάσταση. Μπορείς να γράψεις και <code>_ =&gt; …</code> («όλα τα άλλα»). Εδώ όμως είναι καλύτερο να γράψεις ρητά το <code>Mode::Blink</code>. Αν αύριο προστεθεί νέα κατάσταση, ο compiler θα σε ειδοποιήσει.</p>
<p>Το <code>println!</code> γίνεται μόνο όταν <strong>αλλάζει</strong> η κατάσταση (<code>mode != last</code>), για να μη γεμίζει το ${B.term}.</p>`,
        glossary: ['match', 'enum', 'PIR', 'κατάσταση (state)'],
        supportedSyntax: SYN4 + ', pir.is_high(), const',
        initialCode: L6_CODE(L6_FOR_BAD, L6_ARM_BAD),
        solution: L6_CODE(L6_FOR_GOOD, BLINK_ARM),
        world: { pir: false },
        hardware: ['led', 'pir'], panels: ['serial', 'vars', 'loops'],
        steps: [
          'Τρέξε. Διάβασε το error[E0004]. Ποια κατάσταση λείπει από το match;',
          'Πρόσθεσε το σκέλος Mode::Blink: το LED κάνει toggle.',
          'Στη mode_for πρόσθεσε το else if για το On.',
          'Τρέξε: κούνησε το χέρι μπροστά στο PIR και μετά άφησέ το ήσυχο.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Γιατί είναι καλύτερο να γράψεις Mode::Blink => … αντί για _ => …;',
          options: ['Αν προστεθεί νέα κατάσταση, ο compiler θα σου δείξει το match που πρέπει να αλλάξει', 'Γιατί το _ δεν επιτρέπεται στη Rust', 'Γιατί είναι πιο γρήγορο'],
          answer: 0,
          explain: 'Σωστά. Το _ «καταπίνει» και τις μελλοντικές καταστάσεις, χωρίς προειδοποίηση.',
          retry: 'Όχι ακόμα. Σκέψου τι θα γίνει αν αύριο προσθέσεις Mode::Dim.'
        },
        hints: [
          'Δύο σημεία: το match στο loop (λείπει σκέλος) και η mode_for (λείπει περίπτωση).',
          `Στο match: Mode::Blink => { ${B.w('led', 'toggle')} }. Στη mode_for: } else if quiet < QUIET_LOOPS { Mode::On }.`,
          `Mode::Blink => {\n    ${B.w('led', 'toggle')}\n}\n\nif motion {\n    Mode::Blink\n} else if quiet < QUIET_LOOPS {\n    Mode::On\n} else {\n    Mode::Off\n}`
        ],
        validationTests: [
          { name: 'Κίνηση → Blink · μετά On · μετά από ησυχία → Off', script: [
            { setup: true }, { loops: 1 },
            { sequence: { pir: [1] } },
            { check: 'lastLine', is: 'Mode: Blink', fail: 'Με κίνηση η τελευταία γραμμή είναι {v}. Περίμενα «Mode: Blink».' },
            { sequence: { pir: [0] } },
            { check: 'lastLine', is: 'Mode: On', fail: 'Αμέσως μετά την κίνηση η τελευταία γραμμή είναι {v}. Περίμενα «Mode: On».' },
            { check: 'led', is: true, fail: 'Στο On το LED είναι {v}. Περίμενα αναμμένο.' },
            { loops: 2 },
            { check: 'led', is: true, fail: 'Τρεις γύρους μετά την κίνηση το LED είναι {v}. Περίμενα ακόμα αναμμένο.' },
            { loops: 1 },
            { check: 'lastLine', is: 'Mode: Off', fail: 'Μετά από 4 ήσυχους γύρους η τελευταία γραμμή είναι {v}. Περίμενα «Mode: Off».' },
            { check: 'led', is: false, fail: 'Στο Off το LED είναι {v}. Περίμενα σβηστό.' }
          ] },
          { name: 'Συνεχής κίνηση: το LED αναβοσβήνει, τυπώνεται μία φορά', script: [
            { setup: true }, { loops: 1 },
            { sequence: { pir: [1] } },
            { check: 'led', is: true, fail: 'Στον 1ο γύρο με κίνηση το LED είναι {v}. Περίμενα αναμμένο (toggle από σβηστό).' },
            { sequence: { pir: [1] } },
            { check: 'led', is: false, fail: 'Στον 2ο γύρο με κίνηση το LED είναι {v}. Περίμενα σβηστό (toggle).' },
            { sequence: { pir: [1, 1] } },
            { check: 'count', text: 'Mode: Blink', is: 1, fail: 'Το «Mode: Blink» τυπώθηκε {n} φορές. Περίμενα 1: τύπωνε μόνο όταν αλλάζει η κατάσταση.' }
          ] }
        ],
        explanationOnSuccess: 'Έλεγχος κεφαλαίου: πέτυχε! Option, Result, match, ?, enum: τα εργαλεία της Rust για να μη μένει καμία περίπτωση ξεχασμένη. Ο compiler έγινε ο βοηθός σου.',
        remediation: 'Αν το On δεν κρατά, έλεγξε τη σειρά στη mode_for: πρώτα motion, μετά quiet < QUIET_LOOPS, μετά Off.'
      }
    ];
  });
})(typeof window !== 'undefined' ? window : globalThis);
