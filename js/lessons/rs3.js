/*
 * IoT Guardian — Διαδρομή Rust, Κεφάλαιο 3: Ownership και δανεισμός.
 * Raspberry Pi: κεφάλαιο 43 · ESP32: κεφάλαιο 53. Χρησιμοποιεί το L.RustKit του rs1.js.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  const K = L.RustKit;

  K.addGlossary([
    { term: 'String / &str', def: 'String = κείμενο που «ανήκει» στη μεταβλητή και μπορεί να μεγαλώσει (String::from("…")). &str = δανεικό κείμενο, μόνο για διάβασμα, π.χ. "kitchen".' },
    { term: 'ownership', def: 'Κάθε τιμή στη Rust έχει έναν ιδιοκτήτη (μια μεταβλητή). Όταν ο ιδιοκτήτης τελειώσει, η τιμή σβήνει από τη μνήμη. Έτσι η Rust δεν χρειάζεται garbage collector.' },
    { term: 'move', def: 'Όταν δίνεις ένα String, ένα Vec ή ένα pin σε άλλη μεταβλητή ή σε συνάρτηση, του δίνεις και την ιδιοκτησία. Η παλιά μεταβλητή δεν μπορεί πια να το χρησιμοποιήσει (error[E0382]).' },
    { term: 'clone', def: 'Φτιάχνει πλήρες αντίγραφο: let b = a.clone();. Μετά έχεις δύο ανεξάρτητες τιμές. Κοστίζει μνήμη και χρόνο.' },
    { term: 'borrowing (δανεισμός)', def: 'Δίνεις πρόσβαση χωρίς να δώσεις την ιδιοκτησία. &x = δανεισμός για διάβασμα. &mut x = δανεισμός για αλλαγή.' },
    { term: '&mut', def: 'Δανεισμός για αλλαγή. Μόνο ένας &mut κάθε φορά. Χρειάζεται για να αλλάξει μια συνάρτηση κάτι δικό σου, π.χ. fn blink(led: &mut …).' },
    { term: 'Vec', def: 'Λίστα που μεγαλώνει: let mut v: Vec<u32> = Vec::new(); v.push(20);. Ή γρήγορα: vec![20, 22, 24].' }
  ]);

  K.defineChapter(3, 'Ownership και δανεισμός', B => {
    const SYN1 = 'String::from("…"), &str, .push_str(…), .len(), .clone()';
    const SYN2 = SYN1 + ', fn f(x: &str), fn f(v: &mut Vec<u32>), &x, &mut x, Vec::new(), .push(…), {:?}';
    const SYN3 = SYN2 + `, fn blink(led: &mut ${B.outTy('led')}, times: u32)${B.ret}, for _ in 0..times`;
    const plain = body => `${B.mainPlain}\n${body}\n}\n`;
    const T = B.outTy('led');

    // 3.1
    const L1_CODE = (line) => plain(`    let room: &str = "kitchen";              // &str: δανεικό κείμενο
    let mut label = String::from("Room: ");  // String: δικό μας, μεγαλώνει
    ${line}
    println!("{label}");
    println!("Length: {}", label.len());`);

    // 3.2
    const L2_CODE = (o) => `// Ένα μήνυμα καταγραφής που θέλουμε να δείξουμε δύο φορές.
fn show(${o.param}) {
    println!("Log: {text}");
}

${B.mainPlain}
    let msg = String::from("door open");
    show(${o.arg});
    show(${o.arg});
    println!("Done: {msg}");
}
`;

    // 3.3
    const L3_CODE = (param) => `// Ημερολόγιο μετρήσεων: μια συνάρτηση γράφει, μια άλλη διαβάζει.
fn add_reading(log: ${param}, value: u32) {
    log.push(value);
}

fn average(log: &Vec<u32>) -> u32 {
    let mut sum: u32 = 0;
    for v in log.iter() {
        sum += v;
    }
    sum / log.len() as u32
}

${B.mainPlain}
    let mut log: Vec<u32> = Vec::new();
    add_reading(&mut log, 20);
    add_reading(&mut log, 22);
    add_reading(&mut log, 24);
    println!("Readings: {:?}", log);
    println!("Average: {}", average(&log));
}
`;

    // 3.4
    const L4_CODE = (o) => `// Μια συνάρτηση που αναβοσβήνει το LED όσες φορές της πεις.
${B.uses({ sleep: true, outs: ['led'] })}

fn blink(${o.param}, times: u32)${B.ret} {
    println!("Blink x{times}");
    for _ in 0..times {
        ${B.w('led', 'set_high')}
        ${B.sleep(200)}
        ${B.w('led', 'set_low')}
        ${B.sleep(200)}
    }${B.okEnd}
}

${B.mainHw}
    ${o.decl}
    blink(${o.arg}, 2)${B.q};
    ${B.sleep(1000)}
    blink(${o.arg}, 3)${B.q};
    ${B.w('led', 'set_high')}   // στο τέλος μένει αναμμένο: «έτοιμο»
    println!("Ready");
    Ok(())
}
`;
    const L4_BAD = { param: `mut led: ${T}`, decl: B.pin('led').replace('let mut led', 'let led'), arg: 'led' };
    const L4_GOOD = { param: `led: &mut ${T}`, decl: B.pin('led'), arg: '&mut led' };

    // 3.5
    const L5_FLASH = `fn flash(led: &mut ${T}, times: u32)${B.ret} {
    for _ in 0..times {
        ${B.w('led', 'set_high')}
        ${B.sleep(150)}
        ${B.w('led', 'set_low')}
        ${B.sleep(150)}
    }${B.okEnd}
}`;
    const L5_INITIAL = `// Πόρτα: 1 αναλαμπή = κλειστή, 3 αναλαμπές = ανοιχτή.
// Παράπονο: «το πρόγραμμα δεν ξεκινά καν».
${B.uses({ sleep: true, outs: ['led'] })}

${L5_FLASH}

${B.mainHw}
    ${B.pin('led', 'status_led')}   // LED κατάστασης
    ${B.pin('led', 'alarm_led')}    // LED συναγερμού

    let doors = [false, true, false];   // true = ανοιχτή
    for open in doors {
        if open {
            println!("ALARM: door open");
            flash(&mut alarm_led, 3)${B.q};
        } else {
            println!("OK: door closed");
            flash(&mut status_led, 1)${B.q};
        }
    }
    println!("Done");
    Ok(())
}
`;
    const L5_SOLUTION = `// Πόρτα: 1 αναλαμπή = κλειστή, 3 αναλαμπές = ανοιχτή.
${B.uses({ sleep: true, outs: ['led'] })}

${L5_FLASH}

// Δανείζεται το LED (&mut) και το δανείζει παρακάτω στη flash.
fn report(led: &mut ${T}, open: bool)${B.ret} {
    if open {
        println!("ALARM: door open");
        flash(led, 3)${B.q};
    } else {
        println!("OK: door closed");
        flash(led, 1)${B.q};
    }${B.okEnd}
}

${B.mainHw}
    ${B.pin('led')}   // ένα pin → ένας ιδιοκτήτης

    let doors = [false, true, false];   // true = ανοιχτή
    for open in doors {
        report(&mut led, open)${B.q};
    }
    println!("Done");
    Ok(())
}
`;

    const ownerWhy = B.pi
      ? '<p>Στο Raspberry Pi το <code>gpio.get(17)?</code> δίνει το pin <strong>μία φορά</strong>. Αν το ζητήσεις δεύτερη φορά, παίρνεις <code>Err(PinUsed(17))</code> και η main σταματά με <code>Error: PinUsed(17)</code>.</p>'
      : '<p>Στο ESP32 το <code>peripherals.pins.gpio2</code> είναι μια τιμή σαν το String. Το <code>PinDriver::output(peripherals.pins.gpio2)</code> την παίρνει (move). Αν τη δώσεις δεύτερη φορά, ο compiler λέει <code>error[E0382]: use of moved value: peripherals.pins.gpio2</code>. Το λάθος πιάνεται <strong>πριν</strong> τρέξει ο κώδικας!</p>';

    return [
      {
        kind: 'micro', skills: ['rust', 'variables'],
        title: 'String και &str',
        objectives: ['Να ξεχωρίζω το String από το &str.', 'Να μεγαλώνω ένα String με push_str.'],
        theory: `
<p>Η Rust έχει δύο ειδών κείμενα:</p>
<ul>
  <li><code>&str</code>: κείμενο <strong>δανεικό</strong>, μόνο για διάβασμα. Κάθε <code>"…"</code> στον κώδικα είναι &str.</li>
  <li><code>String</code>: κείμενο που <strong>σου ανήκει</strong>. Μπορεί να μεγαλώσει, αν έχει <code>mut</code>.</li>
</ul>
<pre>let room: &str = "kitchen";
let mut label = String::from("Room: ");
label.push_str(room);      // label = "Room: kitchen"</pre>
<p>Το <code>.len()</code> δίνει το μήκος σε bytes. Για απλά λατινικά γράμματα, 1 γράμμα = 1 byte.</p>
<p>Γιατί δύο είδη; Γιατί η Rust θέλει να ξέρει <strong>ποιος είναι ο ιδιοκτήτης</strong> κάθε κομματιού μνήμης. Αυτό λέγεται <strong>ownership</strong>.</p>`,
        glossary: ['String / &str', 'ownership'],
        supportedSyntax: SYN1,
        initialCode: L1_CODE('____;   // ΣΥΜΠΛΗΡΩΣΕ: κόλλα το room στο τέλος του label'),
        solution: L1_CODE('label.push_str(room);'),
        panels: ['serial', 'vars'],
        steps: [
          'Απάντησε στην ερώτηση πρόβλεψης.',
          'Ποιο από τα δύο κείμενα έχει mut; Γιατί μόνο αυτό;',
          'Συμπλήρωσε το κενό: κόλλα το room στο label με push_str.',
          'Τρέξε. Πόσο μήκος έχει το label;',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Τι από τα παρακάτω μπορεί να μεγαλώσει με push_str;',
          options: ['Ένα let mut s = String::from("…");', 'Ένα let s = "…";', 'Οποιοδήποτε κείμενο'],
          answer: 0,
          explain: 'Σωστά. Μόνο ένα String σου ανήκει και μπορεί να μεγαλώσει, και μόνο αν έχει mut.',
          retry: 'Όχι ακόμα. Ποιο είδος κειμένου είναι «δικό σου»;'
        },
        hints: [
          'Το push_str είναι μέθοδος του String: γράφεται label.push_str(…).',
          'Μέσα στις παρενθέσεις βάλε το κείμενο που θέλεις να προσθέσεις: το room.',
          'label.push_str(room);\n• label = String με mut\n• room = &str που διαβάζεται μόνο'
        ],
        validationTests: [
          { name: 'Room: kitchen, μήκος 13', script: [
            { setup: true },
            { check: 'lines', is: ['Room: kitchen', 'Length: 13'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Room: kitchen» και «Length: 13».' }
          ] }
        ],
        explanationOnSuccess: 'Ωραία. Το "kitchen" δεν άλλαξε: το label πήρε ένα αντίγραφο των γραμμάτων του. Το label είναι ο ιδιοκτήτης του δικού του κειμένου.',
        remediation: 'Το push_str θέλει το room χωρίς εισαγωγικά (είναι μεταβλητή). Αν δεις E0596, λείπει το mut από το label.'
      },

      {
        kind: 'debug', skills: ['rust', 'variables', 'syntax'],
        title: 'Βρες το λάθος: η τιμή που «μετακόμισε» (E0382)',
        objectives: ['Να καταλαβαίνω το move.', 'Να διορθώνω το E0382 με δανεισμό (&).', 'Να ξέρω πότε το clone() είναι λύση.'],
        theory: `
<p>Όταν δίνεις ένα <code>String</code> σε συνάρτηση, της δίνεις και την <strong>ιδιοκτησία</strong>. Αυτό λέγεται <strong>move</strong>.</p>
<pre>fn show(text: String) { … }
show(msg);   // το msg «μετακόμισε» μέσα στη show
show(msg);   // error[E0382]: use of moved value: msg</pre>
<p>Μετά το πρώτο <code>show</code>, το <code>msg</code> δεν έχει πια τιμή. Ο compiler δεν σε αφήνει να το χρησιμοποιήσεις.</p>
<p>Δύο λύσεις:</p>
<ol>
  <li><strong>Δάνεισμα</strong> (η καλύτερη εδώ): η show <strong>διαβάζει</strong> μόνο. <code>fn show(text: &str)</code> και <code>show(&msg)</code>.</li>
  <li><strong>Αντίγραφο</strong>: <code>show(msg.clone())</code>. Δουλεύει, αλλά φτιάχνει νέο κείμενο κάθε φορά.</li>
</ol>
<p>Το <code>&msg</code> είναι <code>&String</code>. Η Rust το δέχεται και όπου ζητείται <code>&str</code>.</p>
<p>Οι αριθμοί (i32, u8, f32, bool) <strong>δεν</strong> μετακομίζουν: αντιγράφονται μόνοι τους (Copy).</p>`,
        glossary: ['move', 'borrowing (δανεισμός)', 'clone', 'ownership'],
        supportedSyntax: SYN2,
        initialCode: L2_CODE({ param: 'text: String', arg: 'msg' }),
        solution: L2_CODE({ param: 'text: &str', arg: '&msg' }),
        panels: ['serial', 'vars'],
        steps: [
          'Τρέξε. Διάβασε το error: ποιος κωδικός; Σε ποια γραμμή «μετακόμισε» το msg;',
          'Η show μόνο τυπώνει. Χρειάζεται να της ανήκει το κείμενο;',
          'Άλλαξε την παράμετρο της show σε δανεισμό (&str).',
          'Στις κλήσεις δάνεισε το msg με &.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Μετά το let b = a; (το a είναι String), τι ισχύει;',
          options: ['Το b είναι ο ιδιοκτήτης, το a δεν μπορεί να χρησιμοποιηθεί', 'Έχουμε δύο αντίγραφα', 'Το a και το b δείχνουν το ίδιο και δουλεύουν και τα δύο'],
          answer: 0,
          explain: 'Σωστά. Το String μετακόμισε στο b. Για δύο αντίγραφα θέλεις let b = a.clone();',
          retry: 'Όχι ακόμα. Στη Rust το String έχει έναν μόνο ιδιοκτήτη. Ποιος είναι μετά το let b = a;'
        },
        hints: [
          'Η show δεν χρειάζεται να κρατήσει το κείμενο. Της αρκεί να το «δει».',
          'Δύο αλλαγές: στη δήλωση fn show(text: …) και στις δύο κλήσεις show(…).',
          'fn show(text: &str) {\n    println!("Log: {text}");\n}\n…\nshow(&msg);\nshow(&msg);\n• & = δανεισμός, το msg μένει δικό σου'
        ],
        validationTests: [
          { name: 'Δύο φορές «Log» και μετά «Done»', script: [
            { setup: true },
            { check: 'lines', is: ['Log: door open', 'Log: door open', 'Done: door open'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα δύο φορές «Log: door open» και μετά «Done: door open».' }
          ] }
        ],
        explanationOnSuccess: 'Τώρα η show δανείζεται το κείμενο και το επιστρέφει. Με τον δανεισμό η Rust ξέρει πάντα ποιος είναι ο ιδιοκτήτης. Έτσι δεν υπάρχει μνήμη που «σβήστηκε» ενώ κάποιος τη χρησιμοποιεί ακόμα.',
        remediation: 'Αν δεις E0308 (expected &str, found String), ξέχασες το & σε μία κλήση: show(&msg).'
      },

      {
        kind: 'guided', skills: ['rust', 'variables', 'state'],
        title: 'Δανεισμός για αλλαγή: &mut',
        objectives: ['Να δίνω σε συνάρτηση &mut για να αλλάξει κάτι δικό μου.', 'Να δίνω & όταν η συνάρτηση μόνο διαβάζει.'],
        theory: `
<p>Δύο είδη δανεισμού:</p>
<ul>
  <li><code>&x</code>: «δες το, μην το αλλάξεις». Όσοι θέλουν, ταυτόχρονα.</li>
  <li><code>&mut x</code>: «μπορείς να το αλλάξεις». Μόνο <strong>ένας</strong> κάθε φορά.</li>
</ul>
<pre>fn add_reading(log: &mut Vec&lt;u32&gt;, value: u32) {
    log.push(value);         // αλλάζει το Vec του main
}
fn average(log: &Vec&lt;u32&gt;) -> u32 { … }   // μόνο διαβάζει</pre>
<p>Το <code>&mut</code> γράφεται <strong>και</strong> στη δήλωση <strong>και</strong> στην κλήση: <code>add_reading(&mut log, 20)</code>.</p>
<p>Αν η παράμετρος είναι <code>&Vec</code> και προσπαθήσεις <code>push</code>, ο compiler λέει <code>error[E0596]: cannot borrow *log as mutable, as it is behind a & reference</code>: «σου το δάνεισα για να το δεις, όχι για να το αλλάξεις».</p>
<p>Ο κανόνας «ένας &mut κάθε φορά» εμποδίζει δύο κομμάτια κώδικα να αλλάζουν τα ίδια δεδομένα μαζί.</p>`,
        glossary: ['&mut', 'borrowing (δανεισμός)', 'Vec'],
        supportedSyntax: SYN2,
        initialCode: L3_CODE('&Vec<u32>   /* ΑΛΛΑΞΕ: αυτή η συνάρτηση γράφει στο log */'),
        solution: L3_CODE('&mut Vec<u32>'),
        panels: ['serial', 'vars'],
        steps: [
          'Τρέξε. Διάβασε το error[E0596]. Ποια συνάρτηση προσπαθεί να αλλάξει το log;',
          'Άλλαξε τον τύπο της παραμέτρου log στην add_reading, ώστε να επιτρέπει αλλαγή.',
          'Πρόσεξε: η average μένει με &Vec. Γιατί;',
          'Τρέξε: Readings [20, 22, 24], Average 22.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Η συνάρτηση fn print_all(log: …) μόνο τυπώνει τις μετρήσεις. Τι τύπο δίνεις;',
          options: ['&Vec<u32>: αρκεί δανεισμός για διάβασμα', '&mut Vec<u32>', 'Vec<u32>: να της ανήκει'],
          answer: 0,
          explain: 'Σωστά. Δώσε πάντα το λιγότερο που χρειάζεται: & για διάβασμα, &mut μόνο όταν αλλάζει.',
          retry: 'Όχι ακόμα. Αλλάζει κάτι η print_all; Και αν της δώσεις Vec, θα το ξαναπάρεις πίσω;'
        },
        hints: [
          'Η add_reading καλεί log.push(…), άρα αλλάζει το log.',
          'Η παράμετρος log θέλει δανεισμό για αλλαγή. Οι κλήσεις έχουν ήδη &mut log.',
          'fn add_reading(log: &mut Vec<u32>, value: u32) {\n    log.push(value);\n}'
        ],
        validationTests: [
          { name: 'Τρεις μετρήσεις και ο μέσος όρος τους', script: [
            { setup: true },
            { check: 'lines', is: ['Readings: [20, 22, 24]', 'Average: 22'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Readings: [20, 22, 24]» και «Average: 22».' }
          ] }
        ],
        explanationOnSuccess: 'Τώρα κάθε συνάρτηση παίρνει ακριβώς όση πρόσβαση χρειάζεται. Αυτή είναι η αρχή των ελάχιστων δικαιωμάτων, μέσα στον ίδιο τον κώδικα!',
        remediation: 'Γράψε &mut Vec<u32> και σβήσε το σχόλιο /* … */ αν σε μπερδεύει. Η average μένει &Vec<u32>.'
      },

      {
        kind: 'variant', skills: ['rust', 'io', 'timing'],
        title: 'Παραλλαγή: δάνεισε το LED σε μια συνάρτηση',
        objectives: ['Να γράφω συνάρτηση που παίρνει &mut σε pin.', 'Να καλώ τη συνάρτηση πολλές φορές με το ίδιο LED.'],
        theory: `
<p>Ένα pin είναι σαν το String: έχει <strong>έναν ιδιοκτήτη</strong>. Αν το δώσεις σε συνάρτηση, μετακομίζει.</p>
<pre>fn blink(mut led: ${T}, times: u32)   // παίρνει το LED για πάντα
blink(led, 2);
blink(led, 3);   // error[E0382]: use of moved value: led</pre>
<p>Η λύση είναι ο δανεισμός για αλλαγή:</p>
<pre>fn blink(led: &mut ${T}, times: u32)${B.ret}
blink(&mut led, 2)${B.q};</pre>
<p>Ο τύπος του pin είναι <code>${T.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>${B.pi ? ' (από το <code>use rppal::gpio::{Gpio, OutputPin};</code>)' : '. Τον φέρνεις με <code>use esp_idf_svc::hal::gpio::{Gpio2, Output, PinDriver};</code>. Το <code>\'static</code> λέει ότι το pin ζει όσο όλο το πρόγραμμα'}.</p>
${B.pi ? '' : '<p>Στο ESP32 η blink επιστρέφει <code>anyhow::Result&lt;()&gt;</code>, γιατί το <code>set_high()?</code> μπορεί να αποτύχει. Στο τέλος της γράφεις <code>Ok(())</code> και την καλείς με <code>?</code>.</p>'}
<p>Το <code>for _ in 0..times</code> επαναλαμβάνει <code>times</code> φορές. Το <code>_</code> σημαίνει «δεν με νοιάζει ο αριθμός του γύρου».</p>`,
        glossary: ['&mut', 'move', 'ownership'],
        supportedSyntax: SYN3,
        initialCode: L4_CODE(L4_BAD),
        solution: L4_CODE(L4_GOOD),
        hardware: ['led'], panels: ['serial', 'vars'],
        steps: [
          'Τρέξε. Διάβασε το error[E0382]. Πού μετακόμισε το led;',
          'Άλλαξε την παράμετρο της blink σε δανεισμό για αλλαγή (&mut).',
          'Στις δύο κλήσεις δάνεισε το led με &mut. Και το led στη main θέλει τώρα mut.',
          'Τρέξε: δύο αναλαμπές, παύση, τρεις αναλαμπές, και το LED μένει αναμμένο.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Γιατί δεν μπορείς να γράψεις led.clone() για να το δώσεις δύο φορές;',
          options: ['Γιατί ένα pin δεν αντιγράφεται: υπάρχει μόνο ένα αληθινό LED', 'Γιατί το clone είναι αργό', 'Μπορείς, αλλά δεν συνηθίζεται'],
          answer: 0,
          explain: 'Σωστά. Δύο «ιδιοκτήτες» του ίδιου pin θα μπορούσαν να το αλλάζουν ταυτόχρονα. Η Rust δεν το επιτρέπει.',
          retry: 'Όχι ακόμα. Πόσα αληθινά LED υπάρχουν στο GPIO ' + B.P.led + ';'
        },
        hints: [
          'Η blink δεν πρέπει να κρατήσει το LED. Αρκεί να το δανειστεί για λίγο, για να το αλλάξει.',
          `Τρεις αλλαγές: fn blink(led: &mut ${T}, …), blink(&mut led, …) δύο φορές, και let mut led στη main.`,
          `fn blink(led: &mut ${T}, times: u32)${B.ret} { … }\n\n${B.pin('led')}\nblink(&mut led, 2)${B.q};\nblink(&mut led, 3)${B.q};`
        ],
        validationTests: [
          { name: 'Δύο κλήσεις της blink και «Ready»', script: [
            { setup: true },
            { check: 'lines', is: ['Blink x2', 'Blink x3', 'Ready'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Blink x2», «Blink x3», «Ready».' },
            { check: 'led', is: true, fail: 'Στο τέλος το LED είναι {v}. Περίμενα αναμμένο («έτοιμο»).' }
          ] },
          { name: 'Η πρώτη αναλαμπή ανάβει το LED', script: [
            { ms: 100 },
            { check: 'led', is: true, fail: 'Στα 100 ms το LED είναι {v}. Περίμενα αναμμένο: η blink πρέπει να ανάβει πρώτα.' },
            { ms: 200 },
            { check: 'led', is: false, fail: 'Στα 300 ms το LED είναι {v}. Περίμενα σβηστό: κάθε αναλαμπή κρατά 200 ms.' }
          ] }
        ],
        explanationOnSuccess: 'Το LED έμεινε στη main και η blink το δανείστηκε δύο φορές. Αυτό είναι το πιο συχνό μοτίβο με pins στη Rust: ένας ιδιοκτήτης, πολλοί δανεισμοί.',
        remediation: 'Αν δεις E0596, το led στη main χρειάζεται mut: για να δώσεις &mut, πρέπει να είναι mut.'
      },

      {
        kind: 'checkpoint', skills: ['rust', 'io', 'security'],
        title: 'Έλεγχος κεφαλαίου: ένα pin, ένας ιδιοκτήτης',
        objectives: ['Να βρίσκω και να διορθώνω δύο «ιδιοκτήτες» για το ίδιο pin.', 'Να περνάω &mut μέσα από δύο συναρτήσεις.'],
        theory: `
<p>Σε μια πλακέτα, κάθε pin συνδέεται με ένα εξάρτημα. Αν δύο κομμάτια του κώδικα πιστεύουν ότι είναι «δικό τους», το ένα θα σβήνει ό,τι ανάβει το άλλο.</p>
${ownerWhy}
<p>Η σωστή δομή:</p>
<ol>
  <li>Ένας ιδιοκτήτης: <code>${B.pin('led')}</code></li>
  <li>Κάθε συνάρτηση που το χρειάζεται παίρνει <code>&mut</code>.</li>
  <li>Μια συνάρτηση που έχει ήδη <code>led: &mut …</code> μπορεί να το δώσει παρακάτω: <code>flash(led, 3)</code> (χωρίς νέο &mut, είναι ήδη δανεικό).</li>
</ol>
<p>Ζητούμενο: μία μεταβλητή <code>led</code> και μια συνάρτηση <code>report(led: &mut …, open: bool)</code> που τυπώνει και καλεί τη <code>flash</code>.</p>`,
        glossary: ['ownership', '&mut', 'move'],
        supportedSyntax: SYN3 + ', [false, true, false], for open in doors',
        initialCode: L5_INITIAL,
        solution: L5_SOLUTION,
        hardware: ['led'], panels: ['serial', 'vars'],
        steps: [
          `Τρέξε. ${B.pi ? 'Τι γράφει το τερματικό; Ποιο pin είναι «ήδη σε χρήση»;' : 'Διάβασε το error[E0382]. Ποιο pin δόθηκε δύο φορές;'}`,
          'Κράτα μόνο έναν ιδιοκτήτη: let mut led.',
          'Γράψε τη συνάρτηση report(led: &mut …, open: bool), με το if που τυπώνει και καλεί τη flash.',
          'Στο for κάλεσε report(&mut led, open).',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: B.pi ? 'Τι κάνει το δεύτερο gpio.get(17)? όταν το pin 17 έχει ήδη ιδιοκτήτη;' : 'Πότε πιάνεται το λάθος «δύο ιδιοκτήτες για το gpio2» στο ESP32;',
          options: B.pi
            ? ['Επιστρέφει Err(PinUsed(17)) και το ? σταματά τη main', 'Δίνει δεύτερο αντίγραφο του pin', 'Τίποτα, απλώς προειδοποιεί']
            : ['Στο compile: error[E0382], πριν τρέξει ο κώδικας', 'Όταν τρέξει η δεύτερη γραμμή', 'Ποτέ: απλώς δουλεύει το τελευταίο'],
          answer: 0,
          explain: B.pi ? 'Σωστά. Το rppal δεν δίνει το ίδιο pin δύο φορές. Το λάθος έρχεται ως Result και το ? το προωθεί.' : 'Σωστά. Το pin είναι τιμή με έναν ιδιοκτήτη, άρα ο compiler βλέπει το δεύτερο move και σταματά.',
          retry: 'Όχι ακόμα. Ξαναδιάβασε τη θεωρία: τι γίνεται με το δεύτερο αίτημα για το ίδιο pin;'
        },
        hints: [
          'Ένα LED → μία μεταβλητή. Όλες οι συναρτήσεις τη δανείζονται.',
          'Σβήσε τη γραμμή του alarm_led και μετονόμασε το status_led σε led. Η report παίρνει led: &mut … και καλεί flash(led, 3) ή flash(led, 1).',
          `fn report(led: &mut ${T}, open: bool)${B.ret} {\n    if open {\n        println!("ALARM: door open");\n        flash(led, 3)${B.q};\n    } else {\n        println!("OK: door closed");\n        flash(led, 1)${B.q};\n    }${B.okEnd.replace('\n    ', '\n    ')}\n}\n…\nfor open in doors {\n    report(&mut led, open)${B.q};\n}`
        ],
        validationTests: [
          { name: 'Τρεις πόρτες: OK, ALARM, OK, Done', script: [
            { setup: true },
            { check: 'lines', is: ['OK: door closed', 'ALARM: door open', 'OK: door closed', 'Done'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «OK: door closed», «ALARM: door open», «OK: door closed», «Done».' },
            { check: 'led', is: false, fail: 'Στο τέλος το LED είναι {v}. Περίμενα σβηστό.' }
          ] },
          { name: 'Το LED αναβοσβήνει πραγματικά', script: [
            { ms: 100 },
            { check: 'led', is: true, fail: 'Στα 100 ms το LED είναι {v}. Περίμενα αναμμένο (η πρώτη αναλαμπή).' },
            { ms: 300 },
            { check: 'led', is: true, fail: 'Στα 400 ms το LED είναι {v}. Περίμενα αναμμένο (η πρώτη από τις 3 αναλαμπές του ALARM).' }
          ] }
        ],
        explanationOnSuccess: 'Έλεγχος κεφαλαίου: πέτυχε! Ownership και δανεισμός δεν είναι μόνο για μνήμη: προστατεύουν και το υλικό. Ένα pin, ένας ιδιοκτήτης, και κανείς δεν «παλεύει» για το ίδιο LED.',
        remediation: 'Μέσα στη report το led είναι ήδη &mut. Γράψε flash(led, 3), όχι flash(&mut led, 3).'
      }
    ];
  });
})(typeof window !== 'undefined' ? window : globalThis);
