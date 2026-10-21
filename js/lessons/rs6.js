/*
 * IoT Guardian — Διαδρομή Rust, Κεφάλαιο 6: Ασφαλής κώδικας με Rust (αμυντικός προγραμματισμός).
 * Raspberry Pi: κεφάλαιο 46 · ESP32: κεφάλαιο 56. Χρησιμοποιεί το L.RustKit του rs1.js.
 * Όλες οι εντολές είναι συνθετικές, γραμμένες μέσα στον κώδικα (inbox). Καμία επίθεση: μόνο έλεγχος εισόδου.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  const K = L.RustKit;

  K.addGlossary([
    { term: 'checked_add', def: 'Πρόσθεση που ρωτά «χωράει;». Δίνει Some(αποτέλεσμα) ή None αν δεν χωρά. Ποτέ panic.' },
    { term: 'saturating_add', def: 'Πρόσθεση που «κολλάει» στο όριο: στο u8 το 250 + 10 δίνει 255. Ποτέ panic, ποτέ «γύρισμα» στο 0.' },
    { term: 'bounds check (έλεγχος ορίων)', def: 'Έλεγχος ότι η θέση που ζητάς υπάρχει. Το v[i] κάνει panic αν δεν υπάρχει. Το v.get(i) δίνει None.' },
    { term: 'πρώτα ο έλεγχος μήκους', def: 'Πριν επεξεργαστείς ένα κείμενο που ήρθε απ’ έξω, έλεγξε ότι δεν είναι υπερβολικά μεγάλο. Έτσι η συσκευή δεν σπαταλά μνήμη και χρόνο.' }
  ]);

  K.defineChapter(6, 'Ασφαλής κώδικας με Rust', B => {
    const SYN1 = 'u8, .checked_add(1) → Option, .saturating_add(1), match Some / None';
    const SYN2 = SYN1 + ', v.get(i), v[i], [usize; 4]';
    const SYN3 = SYN2 + ', enum Command { LedOn, LedOff, Blink(u32) }, Result<Command, String>, .len(), .split_whitespace(), .next(), .unwrap_or(""), match (word, arg) { ("LED", "ON") => … }, format!(…)';
    const SYN4 = SYN3 + `, if let Some(line) = inbox.get(next), Ok(Command::Blink(times)) =>, led.set_high()${B.q}`;
    const plain = body => `${B.mainPlain}\n${body}\n}\n`;

    // 6.1
    const L1_CODE = (ev, al) => plain(`    // Μετρητής γεγονότων κίνησης (u8: ως 255).
    let mut events: u8 = 250;
    for _ in 0..10 {
${ev}
    }
    println!("Events: {events}");

    // Μετρητής συναγερμών: θέλουμε να ξέρουμε πότε γέμισε.
    let mut alarms: u8 = 254;
    for _ in 0..3 {
${al}
    }`);
    const EV_BAD = '        events += 1;   // ΑΛΛΑΞΕ: πρόσθεση που σταματά στο 255';
    const EV_GOOD = '        events = events.saturating_add(1);   // σταματά στο 255';
    const AL_BAD = `        alarms += 1;   // ΑΛΛΑΞΕ: checked_add + match (None → «Alarm counter full»)
        println!("Alarms: {alarms}");`;
    const AL_GOOD = `        match alarms.checked_add(1) {
            Some(n) => {
                alarms = n;
                println!("Alarms: {alarms}");
            }
            None => println!("Alarm counter full"),
        }`;

    // 6.2
    const L2_CODE = (body) => plain(`    let rooms = vec!["kitchen", "salon", "bedroom"];   // θέσεις 0, 1, 2

    // Αιτήματα από το dashboard: «δείξε μου το δωμάτιο i».
    let requests: [usize; 4] = [0, 2, 7, 1];
    for i in requests {
${body}
    }`);
    const IDX_BAD = `        let room = rooms[i];
        println!("Room {i}: {room}");`;
    const IDX_GOOD = `        match rooms.get(i) {
            Some(room) => println!("Room {i}: {room}"),
            None => println!("Room {i}: unknown"),
        }`;

    // 6.3 / 6.4 / 6.5: ο έλεγχος εντολών
    const CMD_ENUM = `#[derive(Debug, Clone, Copy, PartialEq)]
enum Command {
    LedOn,
    LedOff,
    Blink(u32),
}

const MAX_LEN: usize = 16;     // μέγιστο μήκος εντολής (bytes)
const MAX_BLINKS: u32 = 10;    // το πολύ 10 αναλαμπές`;
    const PARSE = (lenCheck, blinkArm) => `// Ελέγχει ένα κείμενο εντολής. Ok(Command) αν είναι σωστό, αλλιώς Err με τον λόγο.
// Ποτέ panic: ό,τι κι αν έρθει, απαντά με Result.
fn parse_command(text: &str) -> Result<Command, String> {
${lenCheck}
    let mut parts = text.split_whitespace();
    let word = parts.next().unwrap_or("");
    let arg = parts.next().unwrap_or("");
    if parts.next().is_some() {
        return Err(String::from("too many words"));
    }
    match (word, arg) {
        ("LED", "ON") => Ok(Command::LedOn),
        ("LED", "OFF") => Ok(Command::LedOff),
${blinkArm}
        _ => Err(format!("unknown command: {}", text)),
    }
}`;
    const LEN_OK = `    if text.len() > MAX_LEN {
        return Err(String::from("too long"));   // πρώτα ο έλεγχος μήκους
    }`;
    const BLINK_OK = `        ("BLINK", n) => match n.parse::<u32>() {
            Ok(times) if times >= 1 && times <= MAX_BLINKS => Ok(Command::Blink(times)),
            Ok(_) => Err(format!("blink count out of range: {}", n)),
            Err(_) => Err(format!("not a number: {}", n)),
        },`;
    const PARSE_OK = PARSE(LEN_OK, BLINK_OK);

    const INBOX3 = '["LED ON", "BLINK 3", "led on", "BLINK 99", "BLINK x", "LED OFF NOW", "BLINK 2222222222222222"]';
    const L3_CODE = (parse) => `${CMD_ENUM}

${parse}

${B.mainPlain}
    // Εντολές που ήρθαν από το dashboard (συνθετικές).
    let inbox = ${INBOX3};
    for line in inbox {
        match parse_command(line) {
            Ok(cmd) => println!("OK: {:?}", cmd),
            Err(e) => println!("Rejected: {e}"),
        }
    }
}
`;
    const L3_BAD = PARSE('    // ΣΥΜΠΛΗΡΩΣΕ 1: αν το text είναι μεγαλύτερο από MAX_LEN → Err("too long")',
      '        // ΣΥΜΠΛΗΡΩΣΕ 2: ("BLINK", n) → Blink(1 έως MAX_BLINKS), αλλιώς Err');

    // 6.4 και 6.5: εκτέλεση στο LED
    const blinkLoop = ind => ['for _ in 0..times {', `    ${B.w('led', 'set_high')}`, `    ${B.sleep(100)}`, `    ${B.w('led', 'set_low')}`, `    ${B.sleep(100)}`, '}']
      .map(l => ind + l).join('\n');
    const INBOX4 = '["LED ON", "BLINK 2", "LED OFF", "LED ON NOW", "LED ON"]';
    const L4_CODE = (handle) => `// Το LED εκτελεί εντολές από το dashboard: μία εντολή σε κάθε γύρο.
${B.uses({ sleep: true })}

${CMD_ENUM}

${PARSE_OK}

${B.mainHw}
    ${B.pin('led')}
    let inbox = ${INBOX4};
    let mut next: usize = 0;   // ποια εντολή είναι η επόμενη

    loop {
        if let Some(line) = inbox.get(next) {
            next += 1;
${handle}
        }
        ${B.sleep(200)}
    }
}
`;
    const HANDLE_BAD = `            let cmd = parse_command(line).unwrap();
            match cmd {
                Command::LedOn => {
                    ${B.w('led', 'set_high')}
                    println!("LED on");
                }
                Command::LedOff => {
                    ${B.w('led', 'set_low')}
                    println!("LED off");
                }
                Command::Blink(times) => {
                    println!("Blink x{times}");
${blinkLoop(' '.repeat(20))}
                }
            }`;
    const handleGood = (errArm) => `            match parse_command(line) {
                Ok(Command::LedOn) => {
                    ${B.w('led', 'set_high')}
                    println!("LED on");
                }
                Ok(Command::LedOff) => {
                    ${B.w('led', 'set_low')}
                    println!("LED off");
                }
                Ok(Command::Blink(times)) => {
                    println!("Blink x{times}");
${blinkLoop(' '.repeat(20))}
                }
${errArm}
            }`;
    const ERR_SIMPLE = `                Err(e) => println!("Rejected: {e}"),   // η εντολή αγνοείται, το LED μένει όπως ήταν`;

    // 6.5
    const INBOX5 = '["LED ON", "BLINK 99", "hello", "LED OFF", "BLINK 0", "LED OFF", "LED ON"]';
    const L5_INITIAL = `// Τελικό: ασφαλής εκτέλεση εντολών με κλείδωμα.
// ΖΗΤΟΥΜΕΝΑ:
//   1. Μετρητής rejected (u8) που δεν ξεχειλίζει ποτέ. Τύπωσε «Rejected (n): λόγος».
//   2. Μετά από MAX_REJECTED απορρίψεις: τύπωσε μία φορά «Locked: too many bad commands»
//      και από εκεί και πέρα αγνόησε κάθε εντολή: «Ignored (locked): …».
${L4_CODE(handleGood(ERR_SIMPLE)).split('\n').slice(1).join('\n').replace(`let inbox = ${INBOX4};`, `let inbox = ${INBOX5};`).replace('const MAX_BLINKS: u32 = 10;    // το πολύ 10 αναλαμπές', 'const MAX_BLINKS: u32 = 10;    // το πολύ 10 αναλαμπές\nconst MAX_REJECTED: u8 = 3;    // μετά από 3 κακές εντολές: κλείδωμα')}`;
    const L5_SOLUTION = `// Τελικό: ασφαλής εκτέλεση εντολών με κλείδωμα.
${B.uses({ sleep: true })}

${CMD_ENUM}
const MAX_REJECTED: u8 = 3;    // μετά από 3 κακές εντολές: κλείδωμα

${PARSE_OK}

${B.mainHw}
    ${B.pin('led')}
    let inbox = ${INBOX5};
    let mut next: usize = 0;
    let mut rejected: u8 = 0;    // πόσες κακές εντολές ήρθαν
    let mut locked = false;

    loop {
        if let Some(line) = inbox.get(next) {
            next += 1;
            if locked {
                println!("Ignored (locked): {line}");
            } else {
${handleGood(`                Err(e) => {
                    rejected = rejected.saturating_add(1);   // ποτέ overflow
                    println!("Rejected ({rejected}): {e}");
                    if rejected >= MAX_REJECTED {
                        locked = true;
                        println!("Locked: too many bad commands");
                    }
                }`).replace(/\n/g, '\n    ').replace(/^ {12}/, '                ')}
            }
        }
        ${B.sleep(200)}
    }
}
`;

    return [
      {
        kind: 'guided', skills: ['rust', 'security', 'variables'],
        title: 'Μετρητές που δεν ξεχειλίζουν ποτέ',
        objectives: ['Να χρησιμοποιώ saturating_add για μετρητή που «κολλάει» στο όριο.', 'Να χρησιμοποιώ checked_add όταν θέλω να ξέρω ότι γέμισε.'],
        theory: `
<p>Στο πρώτο κεφάλαιο είδες: <code>250 + 10</code> σε <code>u8</code> = <strong>panic</strong>. Σε μια συσκευή που μετρά γεγονότα μέρα-νύχτα, ένας μετρητής κάποτε θα φτάσει το όριο.</p>
<p>Η Rust έχει ασφαλείς προσθέσεις:</p>
<ul>
  <li><code>x.saturating_add(1)</code>: σταματά στο όριο. Στο u8: 255 + 1 = 255.</li>
  <li><code>x.checked_add(1)</code>: δίνει <code>Some(νέα τιμή)</code> ή <code>None</code> αν δεν χωρά. Εσύ αποφασίζεις τι θα γίνει.</li>
  <li><code>x.wrapping_add(1)</code>: 255 + 1 = 0. Σπάνια το θέλεις σε μετρητή.</li>
</ul>
<pre>match alarms.checked_add(1) {
    Some(n) => alarms = n,
    None => println!("Alarm counter full"),
}</pre>
<p>Θυμήσου: σε <code>--release</code> η απλή πρόσθεση δεν κάνει panic. Γυρίζει σιωπηλά στο 0. Με saturating / checked η συμπεριφορά είναι <strong>ίδια παντού</strong>.</p>`,
        glossary: ['saturating_add', 'checked_add', 'overflow (υπερχείλιση)', 'Option'],
        supportedSyntax: SYN1,
        initialCode: L1_CODE(EV_BAD, AL_BAD),
        solution: L1_CODE(EV_GOOD, AL_GOOD),
        panels: ['serial', 'vars'],
        steps: [
          'Τρέξε. Πού γίνεται το panic;',
          'Στον πρώτο βρόχο κάνε την πρόσθεση με saturating_add.',
          'Στον δεύτερο βρόχο γράψε match πάνω στο alarms.checked_add(1).',
          'Τρέξε: Events 255, Alarms 255 και δύο φορές «Alarm counter full».',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Τι δίνει το 255u8.checked_add(1);',
          options: ['None', 'Some(0)', 'Some(255)'],
          answer: 0,
          explain: 'Σωστά. Το 256 δεν χωρά σε u8, άρα None. Το saturating_add θα έδινε 255.',
          retry: 'Όχι ακόμα. Το checked_add «ρωτά» αν χωράει. Χωράει το 256 σε u8;'
        },
        hints: [
          'Δύο διαφορετικές μέθοδοι: μία που «κολλάει» στο όριο, και μία που απαντά με Option.',
          'events = events.saturating_add(1); — και στο δεύτερο: match alarms.checked_add(1) { Some(n) => …, None => … }',
          'match alarms.checked_add(1) {\n    Some(n) => {\n        alarms = n;\n        println!("Alarms: {alarms}");\n    }\n    None => println!("Alarm counter full"),\n}'
        ],
        validationTests: [
          { name: 'Κανένα panic: 255 και «full»', script: [
            { setup: true },
            { check: 'lines', is: ['Events: 255', 'Alarms: 255', 'Alarm counter full', 'Alarm counter full'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Events: 255», «Alarms: 255» και δύο φορές «Alarm counter full».' }
          ] }
        ],
        explanationOnSuccess: 'Οι μετρητές σου δεν «σκάνε» πια, ό,τι κι αν γίνει. Και το checked_add σου έδωσε κάτι παραπάνω: ξέρεις πότε γέμισε, και μπορείς να το αναφέρεις.',
        remediation: 'Το saturating_add δίνει νέα τιμή: γράψε events = events.saturating_add(1);, όχι σκέτο events.saturating_add(1);.'
      },

      {
        kind: 'debug', skills: ['rust', 'security'],
        title: 'Βρες το λάθος: η θέση που δεν υπάρχει',
        objectives: ['Να καταλαβαίνω το panic «index out of bounds».', 'Να χρησιμοποιώ get() για ασφαλή πρόσβαση σε λίστα.'],
        theory: `
<p>Το <code>rooms[i]</code> δίνει το στοιχείο στη θέση i. Αν η θέση <strong>δεν υπάρχει</strong>, η Rust κάνει panic:</p>
<pre>index out of bounds: the len is 3 but the index is 7</pre>
<p>Σε C ή C++ το ίδιο λάθος διαβάζει «ξένη» μνήμη. Αυτό είναι από τα πιο συχνά κενά ασφαλείας. Η Rust <strong>ελέγχει πάντα τα όρια</strong> (bounds check). Γι’ αυτό σταματά.</p>
<p>Όμως μια συσκευή δεν πρέπει να σταματά επειδή κάποιος ζήτησε λάθος αριθμό. Όταν το i έρχεται απ’ έξω, χρησιμοποίησε <code>get</code>:</p>
<pre>match rooms.get(i) {
    Some(room) => …,
    None => println!("Room {i}: unknown"),
}</pre>
<p>Κανόνας: <strong>δεδομένα απ’ έξω = get()</strong>. Το <code>[i]</code> μόνο όταν είσαι σίγουρος ότι η θέση υπάρχει.</p>`,
        glossary: ['bounds check (έλεγχος ορίων)', 'panic', 'Option'],
        supportedSyntax: SYN2,
        initialCode: L2_CODE(IDX_BAD),
        solution: L2_CODE(IDX_GOOD),
        panels: ['serial', 'vars'],
        steps: [
          'Τρέξε. Διάβασε το panic: πόσα στοιχεία έχει η λίστα; Ποια θέση ζητήθηκε;',
          'Αντικατάστησε το rooms[i] με ένα match πάνω στο rooms.get(i).',
          'Στο None τύπωσε «Room 7: unknown».',
          'Τρέξε: πρέπει να απαντά και στο αίτημα μετά το 7.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Γιατί είναι καλό που η Rust κάνει panic στο rooms[7], αντί να δώσει κάτι;',
          options: ['Γιατί αλλιώς θα διάβαζε μνήμη που δεν ανήκει στη λίστα', 'Γιατί το panic είναι γρήγορο', 'Δεν είναι καλό, είναι λάθος της Rust'],
          answer: 0,
          explain: 'Σωστά. Το panic είναι το «φρένο ασφαλείας». Το get() είναι ο τρόπος να μη χρειαστεί ποτέ το φρένο.',
          retry: 'Όχι ακόμα. Τι θα γινόταν αν η γλώσσα διάβαζε τη θέση 7 χωρίς έλεγχο;'
        },
        hints: [
          'Το get(i) δίνει Option: Some αν η θέση υπάρχει, None αν όχι.',
          'Σβήσε το let room = rooms[i]; και γράψε match rooms.get(i) { Some(room) => …, None => … }.',
          'match rooms.get(i) {\n    Some(room) => println!("Room {i}: {room}"),\n    None => println!("Room {i}: unknown"),\n}'
        ],
        validationTests: [
          { name: 'Απαντά σε όλα τα αιτήματα, και στο λάθος', script: [
            { setup: true },
            { check: 'lines', is: ['Room 0: kitchen', 'Room 2: bedroom', 'Room 7: unknown', 'Room 1: salon'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα kitchen, bedroom, «Room 7: unknown» και salon.' }
          ] }
        ],
        explanationOnSuccess: 'Ένα λάθος αίτημα δεν σταματά πια τη συσκευή. Απαντά «unknown» και συνεχίζει με το επόμενο. Αυτό λέγεται ανθεκτικότητα.',
        remediation: 'Το get θέλει τη θέση σε παρενθέσεις: rooms.get(i), όχι rooms.get[i].'
      },

      {
        kind: 'guided', skills: ['rust', 'security', 'conditions'],
        title: 'Έλεγχος εντολών: Result αντί για panic',
        objectives: ['Να ελέγχω το μήκος πριν από οτιδήποτε άλλο.', 'Να δέχομαι μόνο εντολές από μια λίστα (allowlist).', 'Να ελέγχω τα όρια ενός αριθμού μέσα σε εντολή.'],
        theory: `
<p>Η συσκευή δέχεται εντολές από το dashboard: <code>LED ON</code>, <code>LED OFF</code>, <code>BLINK 3</code>. Κάθε κείμενο που έρχεται απ’ έξω είναι <strong>ύποπτο</strong> μέχρι να ελεγχθεί.</p>
<p>Η <code>parse_command</code> επιστρέφει <code>Result&lt;Command, String&gt;</code> και <strong>ποτέ</strong> δεν κάνει panic. Ελέγχει με τη σειρά:</p>
<ol>
  <li><strong>Μήκος:</strong> πάνω από 16 bytes → <code>Err("too long")</code>. Πρώτα αυτό, πριν σπαταλήσουμε χρόνο.</li>
  <li><strong>Λέξεις:</strong> το πολύ δύο.</li>
  <li><strong>Allowlist:</strong> μόνο οι γνωστές εντολές. Ό,τι άλλο → <code>unknown command</code>. Και τα πεζά (led on) απορρίπτονται.</li>
  <li><strong>Όρια:</strong> το BLINK θέλει αριθμό από 1 έως 10.</li>
</ol>
<p>Το match σε ζευγάρι <code>(word, arg)</code>:</p>
<pre>("BLINK", n) => match n.parse::&lt;u32&gt;() {
    Ok(times) if times >= 1 && times &lt;= MAX_BLINKS => Ok(Command::Blink(times)),
    Ok(_) => Err(format!("blink count out of range: {}", n)),
    Err(_) => Err(format!("not a number: {}", n)),
},</pre>
<p>Το <code>if</code> μετά το pattern λέγεται <strong>guard</strong>: το σκέλος ταιριάζει μόνο αν ισχύει και η συνθήκη.</p>`,
        glossary: ['έλεγχος εισόδου (validation)', 'allowlist', 'πρώτα ο έλεγχος μήκους', 'Result', 'enum'],
        supportedSyntax: SYN3,
        initialCode: L3_CODE(L3_BAD),
        solution: L3_CODE(PARSE_OK),
        panels: ['serial', 'vars'],
        steps: [
          'Τρέξε. Ποιες εντολές απορρίπτονται με λάθος λόγο;',
          'ΣΥΜΠΛΗΡΩΣΕ 1: έλεγξε το text.len() > MAX_LEN πρώτο.',
          'ΣΥΜΠΛΗΡΩΣΕ 2: γράψε το σκέλος ("BLINK", n) με τα τρία εσωτερικά σκέλη.',
          'Τρέξε: δύο OK και πέντε Rejected, ο καθένας με τον λόγο του.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Γιατί ο έλεγχος μήκους γίνεται πρώτος;',
          options: ['Για να μη δουλέψει η συσκευή πάνω σε τεράστιο κείμενο', 'Γιατί το len() δουλεύει μόνο στην αρχή', 'Δεν έχει σημασία η σειρά'],
          answer: 0,
          explain: 'Σωστά. Ένα τεράστιο κείμενο απορρίπτεται αμέσως, πριν το κόψουμε σε λέξεις ή το τυπώσουμε.',
          retry: 'Όχι ακόμα. Τι θα γινόταν αν έρθει κείμενο με 1.000.000 χαρακτήρες;'
        },
        hints: [
          'Δύο κενά: ένα if στην αρχή και ένα σκέλος στο match.',
          'if text.len() > MAX_LEN { return Err(String::from("too long")); } — και ("BLINK", n) => match n.parse::<u32>() { … },',
          'if text.len() > MAX_LEN {\n    return Err(String::from("too long"));\n}\n…\n("BLINK", n) => match n.parse::<u32>() {\n    Ok(times) if times >= 1 && times <= MAX_BLINKS => Ok(Command::Blink(times)),\n    Ok(_) => Err(format!("blink count out of range: {}", n)),\n    Err(_) => Err(format!("not a number: {}", n)),\n},'
        ],
        validationTests: [
          { name: 'Σωστές εντολές περνούν, οι άλλες απορρίπτονται με τον σωστό λόγο', script: [
            { setup: true },
            { check: 'lines', is: ['OK: LedOn', 'OK: Blink(3)', 'Rejected: unknown command: led on', 'Rejected: blink count out of range: 99', 'Rejected: not a number: x', 'Rejected: too many words', 'Rejected: too long'], fail: 'Το ' + B.term + ' έγραψε: {v}. Δες τις 7 εντολές μία-μία: ποια πήρε λάθος απάντηση;' }
          ] },
          { name: 'Το πολύ μεγάλο κείμενο κόβεται πριν απ’ όλα', script: [
            { setup: true },
            { check: 'serialNot', text: '2222222222222222', fail: 'Το πολύ μεγάλο κείμενο τυπώθηκε στο ' + B.term + '. Απόρριψέ το πρώτα με «too long», χωρίς να το επαναλάβεις.' }
          ] }
        ],
        explanationOnSuccess: 'Αυτός είναι ο πυρήνας του ασφαλούς κώδικα: κάθε είσοδος ελέγχεται, οι λάθος εντολές απορρίπτονται με καθαρό λόγο, και η συσκευή δεν σταματά ποτέ.',
        remediation: 'Το "BLINK 2222222222222222" έχει 22 bytes. Αν βλέπεις «out of range» αντί για «too long», ο έλεγχος μήκους λείπει ή είναι πιο κάτω.'
      },

      {
        kind: 'variant', skills: ['rust', 'security', 'io'],
        title: 'Παραλλαγή: το LED εκτελεί μόνο έγκυρες εντολές',
        objectives: ['Να εκτελώ εντολές στο LED με match πάνω σε Result<Command, …>.', 'Να αγνοώ με ασφάλεια μια κακή εντολή χωρίς panic.'],
        theory: `
<p>Τώρα οι εντολές οδηγούν το LED, <strong>μία σε κάθε γύρο</strong> του loop.</p>
<p>Η λίστα διαβάζεται με <code>inbox.get(next)</code>. Όταν τελειώσουν οι εντολές, το get δίνει None και η συσκευή απλώς περιμένει. Κανένα panic.</p>
<p>Ο κώδικας που σου έδωσαν κάνει <code>parse_command(line).unwrap()</code>. Με την 4η εντολή, «LED ON NOW», η συσκευή σταματά${B.pi ? '' : ' και το ESP32 κάνει επανεκκίνηση'}. Μία κακή εντολή → όλη η συσκευή εκτός λειτουργίας!</p>
<p>Η λύση: match πάνω στο Result, με τα patterns μέσα σε patterns:</p>
<pre>match parse_command(line) {
    Ok(Command::LedOn) => { … }
    Ok(Command::Blink(times)) => { … }
    Err(e) => println!("Rejected: {e}"),
}</pre>
<p>Μια κακή εντολή <strong>δεν αλλάζει</strong> το LED. Η συσκευή μένει στην τελευταία σωστή κατάσταση.</p>`,
        glossary: ['unwrap', 'match', 'Result', 'έλεγχος εισόδου (validation)'],
        supportedSyntax: SYN4,
        initialCode: L4_CODE(HANDLE_BAD),
        solution: L4_CODE(handleGood(ERR_SIMPLE)),
        hardware: ['led'], panels: ['serial', 'vars', 'loops'],
        steps: [
          'Τρέξε. Σε ποια εντολή σταματά; Τι λέει το panic;',
          'Σβήσε το let cmd = …unwrap(); και κάνε match πάνω στο parse_command(line).',
          'Βάλε Ok(…) γύρω από κάθε Command::… και πρόσθεσε σκέλος Err(e).',
          'Τρέξε: η 4η εντολή απορρίπτεται και η 5η ανάβει το LED.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Το LED είναι σβηστό και έρχεται η κακή εντολή «LED ON NOW». Τι κάνει το LED;',
          options: ['Μένει σβηστό: η εντολή απορρίπτεται', 'Ανάβει: μοιάζει με LED ON', 'Η συσκευή σταματά'],
          answer: 0,
          explain: 'Σωστά. Ό,τι δεν είναι ακριβώς σωστό, απορρίπτεται. Η συσκευή δεν «μαντεύει».',
          retry: 'Όχι ακόμα. Τι δίνει η parse_command για τρεις λέξεις;'
        },
        hints: [
          'Το unwrap() σταματά τη συσκευή στο πρώτο Err. Χρειάζεσαι match που χειρίζεται και το Err.',
          'match parse_command(line) { Ok(Command::LedOn) => { … } Ok(Command::LedOff) => { … } Ok(Command::Blink(times)) => { … } Err(e) => … }',
          'match parse_command(line) {\n    Ok(Command::LedOn) => { … }\n    Ok(Command::LedOff) => { … }\n    Ok(Command::Blink(times)) => { … }\n    Err(e) => println!("Rejected: {e}"),\n}'
        ],
        validationTests: [
          { name: 'ON, BLINK, OFF, κακή εντολή, ON', script: [
            { setup: true }, { loops: 1 },
            { check: 'led', is: true, fail: 'Μετά το «LED ON» το LED είναι {v}. Περίμενα αναμμένο.' },
            { loops: 2 },
            { check: 'led', is: false, fail: 'Μετά το «LED OFF» το LED είναι {v}. Περίμενα σβηστό.' },
            { loops: 1 },
            { check: 'lastLine', is: 'Rejected: too many words', fail: 'Μετά το «LED ON NOW» η τελευταία γραμμή είναι {v}. Περίμενα «Rejected: too many words».' },
            { check: 'led', is: false, fail: 'Μετά την κακή εντολή το LED είναι {v}. Περίμενα να μείνει σβηστό.' },
            { loops: 1 },
            { check: 'led', is: true, fail: 'Μετά το τελευταίο «LED ON» το LED είναι {v}. Περίμενα αναμμένο: η συσκευή συνεχίζει μετά από μια κακή εντολή.' }
          ] },
          { name: 'Όλο το log, και η συσκευή ζει μετά το τέλος', script: [
            { setup: true }, { loops: 8 },
            { check: 'lines', is: ['LED on', 'Blink x2', 'LED off', 'Rejected: too many words', 'LED on'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «LED on», «Blink x2», «LED off», «Rejected: too many words», «LED on».' }
          ] }
        ],
        explanationOnSuccess: 'Η συσκευή εκτελεί μόνο ό,τι πέρασε τον έλεγχο. Οι κακές εντολές καταγράφονται και αγνοούνται. Και όταν τελειώσουν οι εντολές, το get() δίνει None αντί για panic.',
        remediation: 'Μέσα στο match, κάθε σκέλος γράφεται Ok(Command::LedOn), όχι σκέτο Command::LedOn.'
      },

      {
        kind: 'checkpoint', skills: ['rust', 'security', 'state', 'io'],
        title: 'Έλεγχος κεφαλαίου: κλείδωμα μετά από κακές εντολές',
        objectives: ['Να συνδυάζω έλεγχο εντολών, ασφαλή μετρητή και κατάσταση.', 'Να κλειδώνω τη συσκευή μετά από πολλές κακές εντολές.'],
        theory: `
<p>Πολλές κακές εντολές στη σειρά σημαίνουν ότι κάτι δεν πάει καλά: ένα χαλασμένο dashboard ή μια άγνωστη συσκευή. Η αμυντική απάντηση είναι το <strong>κλείδωμα</strong>.</p>
<ol>
  <li>Μετρητής <code>rejected: u8</code> με <code>saturating_add</code>: ποτέ overflow.</li>
  <li>Τύπωνε «Rejected (1): λόγος», «Rejected (2): …».</li>
  <li>Όταν <code>rejected >= MAX_REJECTED</code> (3): <code>locked = true</code> και τύπωσε <strong>μία φορά</strong> «Locked: too many bad commands».</li>
  <li>Όσο <code>locked</code>: κάθε νέα εντολή, ακόμα και σωστή, αγνοείται: «Ignored (locked): LED ON». Το LED δεν αλλάζει.</li>
</ol>
<p>Ο έλεγχος <code>if locked</code> μπαίνει <strong>πριν</strong> από την parse_command: μια κλειδωμένη συσκευή δεν επεξεργάζεται τίποτα.</p>
<p>Σε αληθινό σύστημα, το ξεκλείδωμα θα γινόταν μόνο από τον διαχειριστή, π.χ. με κουμπί πάνω στη συσκευή.</p>`,
        glossary: ['κλείδωμα έξω (lockout)', 'saturating_add', 'έλεγχος εισόδου (validation)', 'κατάσταση (state)'],
        supportedSyntax: SYN4 + ', const MAX_REJECTED: u8 = 3;, let mut locked = false;',
        initialCode: L5_INITIAL,
        solution: L5_SOLUTION,
        hardware: ['led'], panels: ['serial', 'vars', 'loops'],
        steps: [
          'Τρέξε τον αρχικό κώδικα και διάβασε το log.',
          'Πρόσθεσε τον μετρητή rejected και το locked πριν από το loop.',
          'Στο σκέλος Err: αύξησε με saturating_add, τύπωσε «Rejected (n): …», και κλείδωσε στο 3.',
          'Πριν από την parse_command: αν locked, τύπωσε «Ignored (locked): …» και μην εκτελέσεις τίποτα.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Η συσκευή είναι κλειδωμένη και έρχεται η σωστή εντολή «LED ON». Τι γίνεται;',
          options: ['Αγνοείται: «Ignored (locked): LED ON»', 'Εκτελείται, γιατί είναι σωστή', 'Ξεκλειδώνει τη συσκευή'],
          answer: 0,
          explain: 'Σωστά. Το κλείδωμα ισχύει για όλα. Αλλιώς δεν θα προστάτευε τίποτα.',
          retry: 'Όχι ακόμα. Ξαναδιάβασε το βήμα 4 της θεωρίας.'
        },
        hints: [
          'Δύο νέες μεταβλητές (rejected, locked) πριν από το loop, ένα if locked { … } else { …match… } και αλλαγές στο σκέλος Err.',
          'if locked { println!("Ignored (locked): {line}"); } else { match parse_command(line) { … } }. Στο Err: rejected = rejected.saturating_add(1);',
          'Err(e) => {\n    rejected = rejected.saturating_add(1);\n    println!("Rejected ({rejected}): {e}");\n    if rejected >= MAX_REJECTED {\n        locked = true;\n        println!("Locked: too many bad commands");\n    }\n}'
        ],
        validationTests: [
          { name: 'Τρεις κακές εντολές → κλείδωμα, οι επόμενες αγνοούνται', script: [
            { setup: true }, { loops: 9 },
            { check: 'lines', is: ['LED on', 'Rejected (1): blink count out of range: 99', 'Rejected (2): unknown command: hello', 'LED off', 'Rejected (3): blink count out of range: 0', 'Locked: too many bad commands', 'Ignored (locked): LED OFF', 'Ignored (locked): LED ON'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα 3 «Rejected (n)», μία φορά «Locked: too many bad commands» και μετά «Ignored (locked): …».' }
          ] },
          { name: 'Κλειδωμένη συσκευή: το LED δεν αλλάζει', script: [
            { setup: true }, { loops: 1 },
            { check: 'led', is: true, fail: 'Μετά το «LED ON» το LED είναι {v}. Περίμενα αναμμένο.' },
            { loops: 3 },
            { check: 'led', is: false, fail: 'Μετά το «LED OFF» το LED είναι {v}. Περίμενα σβηστό.' },
            { loops: 4 },
            { check: 'led', is: false, fail: 'Μετά το κλείδωμα ήρθε «LED ON» και το LED είναι {v}. Περίμενα σβηστό: η κλειδωμένη συσκευή αγνοεί κάθε εντολή.' },
            { check: 'count', text: 'Locked: too many bad commands', is: 1, fail: 'Το «Locked: …» τυπώθηκε {n} φορές. Περίμενα 1.' }
          ] }
        ],
        explanationOnSuccess: 'Έλεγχος κεφαλαίου: πέτυχε! Μετρητής που δεν ξεχειλίζει, πρόσβαση με get(), έλεγχος κάθε εντολής με Result και κλείδωμα. Αμυντικός κώδικας που δεν σταματά ποτέ και δεν εκτελεί τίποτα ανεξέλεγκτο. Ολοκλήρωσες τη διαδρομή Rust!',
        remediation: 'Το «Locked» πρέπει να τυπωθεί μόνο τη στιγμή που κλειδώνει: βάλ’ το μέσα στο if rejected >= MAX_REJECTED, στο σκέλος Err.'
      }
    ];
  });
})(typeof window !== 'undefined' ? window : globalThis);
