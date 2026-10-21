/*
 * IoT Guardian — Διαδρομή Rust, Κεφάλαιο 2: Συνθήκες, βρόχοι και συναρτήσεις.
 * Raspberry Pi: κεφάλαιο 42 · ESP32: κεφάλαιο 52. Χρησιμοποιεί το L.RustKit του rs1.js.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  const K = L.RustKit;

  K.addGlossary([
    { term: 'if ως έκφραση', def: 'Στη Rust το if δίνει τιμή: let state = if t > 25 { "HOT" } else { "OK" };. Τα δύο σκέλη πρέπει να δίνουν τον ίδιο τύπο.' },
    { term: 'range (1..=5)', def: 'Σειρά αριθμών. 1..5 = 1, 2, 3, 4 (χωρίς το 5). 1..=5 = 1, 2, 3, 4, 5 (μαζί με το 5).' },
    { term: 'break', def: 'Βγαίνει αμέσως από τον βρόχο (loop, while ή for).' },
    { term: 'while', def: 'Βρόχος που επαναλαμβάνεται όσο ισχύει μια συνθήκη: while n > 0 { … }.' },
    { term: '-> (τύπος επιστροφής)', def: 'Στη δήλωση συνάρτησης λέει τι τύπο επιστρέφει: fn double(x: i32) -> i32.' },
    { term: 'τελευταία έκφραση', def: 'Η τελευταία γραμμή μιας συνάρτησης χωρίς ; είναι η τιμή που επιστρέφει. Με ; γίνεται εντολή και η συνάρτηση επιστρέφει () (τίποτα).' },
    { term: 'ανίχνευση ακμής', def: 'Μετράμε μόνο τη στιγμή που κάτι αλλάζει (π.χ. το κουμπί από «όχι» σε «πατημένο»), όχι όσο μένει πατημένο.' }
  ]);

  K.defineChapter(2, 'Συνθήκες, βρόχοι και συναρτήσεις', B => {
    const SYN1 = 'let, let mut, if / else if / else, if ως έκφραση, ==, !=, <, >, &&, ||, !';
    const SYN2 = SYN1 + ', for i in 1..=5, while, loop, break, +=, -=';
    const SYN3 = SYN2 + ', fn όνομα(x: i32) -> i32 { … }, τελευταία έκφραση χωρίς ;, bool';
    const SYN4 = SYN3 + `, button.is_high(), led.set_high()${B.q}, led.set_low()${B.q}, ${B.sleepWord}`;
    const plain = body => `${B.mainPlain}\n${body}\n}\n`;

    // 2.1
    const L1_CODE = (cold) => plain(`    let temp = 15;   // °C

    // Το if δίνει τιμή: την κρατάμε στο state.
    let state = if temp > 25 {
        "HOT"
    } else if temp < 18 {
        ${cold}
    } else {
        "OK"
    };
    println!("Temp {temp}: {state}");

    // Και με αριθμούς: ο ανεμιστήρας δουλεύει μόνο όταν κάνει ζέστη.
    let fan = if state == "HOT" { 100 } else { 0 };
    println!("Fan: {fan}%");`);

    // 2.2
    const L2_CODE = (range, step) => plain(`    // 1. for: μετρήσεις 1 έως 5
    for i in ${range} {
        println!("Reading {i}");
    }

    // 2. while: αντίστροφη μέτρηση 3, 2, 1
    let mut n = 3;
    while n > 0 {
        println!("{n}...");
        ${step}
    }

    // 3. loop με break: η πρώτη δύναμη του 2 πάνω από 100
    let mut x: u32 = 1;
    let first = loop {
        x = x * 2;
        if x > 100 {
            break x;   // βγες από το loop και δώσε την τιμή x
        }
    };
    println!("First power of 2 over 100: {first}");`);

    // 2.3
    const L3_CODE = (body) => `// Μετατροπή °C σε °F με δικές μας συναρτήσεις.
fn to_fahrenheit(c: i32) -> i32 {
    ${body}
}

fn is_hot(c: i32) -> bool {
    c > 25   // χωρίς ; : αυτή είναι η τιμή που επιστρέφει
}

${B.mainPlain}
    for c in [0, 20, 30] {
        let f = to_fahrenheit(c);
        let hot = is_hot(c);
        println!("{c} C = {f} F, hot: {hot}");
    }
}
`;

    // 2.4
    const L4_HEAD = `// Το κουμπί ελέγχει το LED.
${B.uses({ sleep: true })}

${B.mainHw}
    ${B.pin('led')}
    ${B.pin('button')}   // διαβάζει High όσο είναι πατημένο

    loop {`;
    const L4_INITIAL = `${L4_HEAD}
        // ΣΥΜΠΛΗΡΩΣΕ: αν το κουμπί είναι πατημένο, άναψε το LED. Αλλιώς σβήσ' το.

        ${B.sleep(50)}
    }
}
`;
    const L4_SOLUTION = `${L4_HEAD}
        if button.is_high() {
            ${B.w('led', 'set_high')}
        } else {
            ${B.w('led', 'set_low')}
        }
        ${B.sleep(50)}
    }
}
`;

    // 2.5
    const L5_CODE = (fnBody, edge) => `// Κάθε πάτημα αλλάζει το LED: 1ο πάτημα ανάβει, 2ο σβήνει, …
${B.uses({ sleep: true })}

${fnBody}

${B.mainHw}
    ${B.pin('led')}
    ${B.pin('button')}
    let mut presses: u32 = 0;
${edge.decl}
    loop {
        let pressed = button.is_high();
${edge.body}
        if led_should_be_on(presses) {
            ${B.w('led', 'set_high')}
        } else {
            ${B.w('led', 'set_low')}
        }
        ${B.sleep(50)}
    }
}
`;
    const L5_FN_BAD = `// ΣΥΜΠΛΗΡΩΣΕ: true όταν το presses είναι μονός αριθμός (1, 3, 5, …)
fn led_should_be_on(presses: u32) -> bool {
    false
}`;
    const L5_FN_GOOD = `// true όταν το presses είναι μονός αριθμός (1, 3, 5, …)
fn led_should_be_on(presses: u32) -> bool {
    presses % 2 == 1
}`;
    const L5_EDGE_BAD = {
      decl: '',
      body: `        // ΑΛΛΑΞΕ: τώρα μετρά σε κάθε γύρο όσο κρατάς το κουμπί.
        // Μέτρα μόνο τη στιγμή που το κουμπί γίνεται πατημένο.
        if pressed {
            presses += 1;
            println!("Presses: {presses}");
        }`
    };
    const L5_EDGE_GOOD = {
      decl: '    let mut was_pressed = false;   // πώς ήταν στον προηγούμενο γύρο\n',
      body: `        if pressed && !was_pressed {   // ακμή: από «όχι» σε «πατημένο»
            presses += 1;
            println!("Presses: {presses}");
        }
        was_pressed = pressed;`
    };

    return [
      {
        kind: 'micro', skills: ['rust', 'conditions'],
        title: 'Το if που δίνει τιμή',
        objectives: ['Να γράφω if / else if / else στη Rust.', 'Να χρησιμοποιώ το if ως έκφραση: let x = if … { … } else { … };'],
        theory: `
<p>Το if της Rust μοιάζει με της C++, αλλά <strong>χωρίς παρενθέσεις</strong>:</p>
<pre>if temp > 25 { … } else if temp &lt; 18 { … } else { … }</pre>
<p>Και κάτι νέο: το if <strong>δίνει τιμή</strong>. Την κρατάς σε μεταβλητή:</p>
<pre>let state = if temp > 25 { "HOT" } else { "OK" };</pre>
<ul>
  <li>Μέσα στα σκέλη, η τιμή γράφεται <strong>χωρίς ;</strong>.</li>
  <li>Όλα τα σκέλη δίνουν τον <strong>ίδιο τύπο</strong> (εδώ κείμενο).</li>
  <li>Μετά το τελευταίο <code>}</code> μπαίνει <code>;</code>, γιατί όλο αυτό είναι ένα <code>let</code>.</li>
</ul>
<p>Αν ένα σκέλος δίνει κείμενο και άλλο αριθμό, ο compiler βγάζει <code>error[E0308]: mismatched types</code>.</p>`,
        glossary: ['if ως έκφραση', 'if / else', 'συνθήκη'],
        supportedSyntax: SYN1,
        initialCode: L1_CODE('____'),
        solution: L1_CODE('"COLD"'),
        panels: ['serial', 'vars', 'branch'],
        steps: [
          'Απάντησε στην ερώτηση πρόβλεψης.',
          'Η θερμοκρασία είναι 15. Ποιο σκέλος του if θα τρέξει;',
          'Συμπλήρωσε το κενό με την τιμή "COLD" (με εισαγωγικά, χωρίς ;).',
          'Τρέξε. Τι γράφει για τον ανεμιστήρα; Γιατί;',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Με temp = 30, τι κρατά το state;',
          options: ['"HOT"', '"COLD"', '"OK"'],
          answer: 0,
          explain: 'Σωστά. Το 30 > 25 ισχύει, άρα τρέχει το πρώτο σκέλος και το state γίνεται "HOT".',
          retry: 'Όχι ακόμα. Ξεκίνα από το πρώτο if: ισχύει το 30 > 25;'
        },
        hints: [
          'Κάθε σκέλος του if δίνει ένα κείμενο. Το μεσαίο σκέλος είναι για το κρύο.',
          'Στη θέση του ____ γράψε το κείμενο για κρύο, σε εισαγωγικά, όπως το "HOT" πιο πάνω.',
          '} else if temp < 18 {\n    "COLD"\n} else {\n• χωρίς ; μετά το "COLD": είναι η τιμή του σκέλους'
        ],
        validationTests: [
          { name: 'Με 15 °C: COLD και ανεμιστήρας 0%', script: [
            { setup: true },
            { check: 'lines', is: ['Temp 15: COLD', 'Fan: 0%'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα «Temp 15: COLD» και «Fan: 0%».' }
          ] }
        ],
        explanationOnSuccess: 'Ωραία. Το if ως έκφραση κάνει τον κώδικα μικρό και καθαρό: μία μεταβλητή, μία τιμή, χωρίς να την αλλάζεις μετά. Γι’ αυτό το state δεν χρειάζεται mut.',
        remediation: 'Αν δεις E0308, κάποιο σκέλος δίνει άλλο τύπο ή έχει ; στο τέλος. Γράψε μόνο "COLD".'
      },

      {
        kind: 'guided', skills: ['rust', 'conditions', 'state'],
        title: 'Βρόχοι: for, while και loop',
        objectives: ['Να γράφω for με range (1..=5).', 'Να γράφω while που σταματά.', 'Να βγαίνω από loop με break.'],
        theory: `
<p>Η Rust έχει τρεις βρόχους:</p>
<ul>
  <li><code>for i in 1..=5 { … }</code> — για κάθε αριθμό από 1 έως 5.</li>
  <li><code>while n > 0 { … }</code> — όσο ισχύει η συνθήκη.</li>
  <li><code>loop { … }</code> — για πάντα, μέχρι να βρει <code>break</code>.</li>
</ul>
<p>Πρόσεξε τα ranges:</p>
<ul>
  <li><code>1..5</code> = 1, 2, 3, 4 (<strong>χωρίς</strong> το 5).</li>
  <li><code>1..=5</code> = 1, 2, 3, 4, 5 (<strong>μαζί</strong> με το 5).</li>
</ul>
<p>Στο <code>while</code> κάτι πρέπει να αλλάζει, αλλιώς δεν σταματά ποτέ. Εδώ το <code>n -= 1;</code> (ίδιο με <code>n = n - 1;</code>).</p>
<p>Το <code>break x;</code> βγαίνει από το <code>loop</code> και δίνει την τιμή <code>x</code>: <code>let first = loop { … };</code></p>
<p>Η Rust <strong>δεν</strong> έχει <code>++</code>. Γράφεις <code>n += 1;</code>.</p>`,
        glossary: ['range (1..=5)', 'while', 'break', 'loop'],
        supportedSyntax: SYN2,
        initialCode: L2_CODE('1..5', '____;   // ΣΥΜΠΛΗΡΩΣΕ: μείωσε το n κατά 1'),
        solution: L2_CODE('1..=5', 'n -= 1;'),
        panels: ['serial', 'vars', 'loops'],
        steps: [
          'Διάβασε τους τρεις βρόχους. Ποιος σταματά με break;',
          'Το for πρέπει να τυπώσει και το «Reading 5». Άλλαξε το range.',
          'Συμπλήρωσε το while, ώστε το n να μικραίνει σε κάθε γύρο.',
          'Τρέξε. Ποια δύναμη του 2 βρήκε το loop;',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Πόσες φορές τρέχει το for i in 0..3 { … };',
          options: ['3 φορές (0, 1, 2)', '4 φορές (0, 1, 2, 3)', '2 φορές'],
          answer: 0,
          explain: 'Σωστά. Το 0..3 σταματά πριν το 3: 0, 1, 2. Το 0..=3 θα έδινε 4 φορές.',
          retry: 'Όχι ακόμα. Το .. (χωρίς =) δεν περιλαμβάνει τον τελευταίο αριθμό.'
        },
        hints: [
          'Δύο αλλαγές: το range του for και μία εντολή μέσα στο while.',
          'Για να μπει και το 5 χρειάζεται =. Στο while το n πρέπει να μικραίνει: n -= 1;',
          'for i in 1..=5 {\n…\nwhile n > 0 {\n    println!("{n}...");\n    n -= 1;\n}'
        ],
        validationTests: [
          { name: 'for 1–5, αντίστροφη μέτρηση 3–1 και δύναμη του 2', script: [
            { setup: true },
            { check: 'lines', is: ['Reading 1', 'Reading 2', 'Reading 3', 'Reading 4', 'Reading 5', '3...', '2...', '1...', 'First power of 2 over 100: 128'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα Reading 1 έως 5, μετά 3... 2... 1... και την πρώτη δύναμη του 2 πάνω από 100.' }
          ] }
        ],
        explanationOnSuccess: 'Τρεις βρόχοι, τρεις δουλειές. Στις πλακέτες ο κύριος βρόχος είναι ένα loop { } χωρίς break: η συσκευή δουλεύει για πάντα.',
        remediation: 'Αν λείπει το «Reading 5», το range είναι 1..5. Αν το πρόγραμμα «κολλάει», το while δεν μειώνει το n.'
      },

      {
        kind: 'debug', skills: ['rust', 'timing', 'syntax'],
        title: 'Βρες το λάθος: η συνάρτηση που δεν επιστρέφει (E0308)',
        objectives: ['Να γράφω συνάρτηση με παραμέτρους και τύπο επιστροφής.', 'Να ξέρω ότι η τελευταία έκφραση χωρίς ; είναι η τιμή επιστροφής.', 'Να διορθώνω το E0308 «expected i32, found ()».'],
        theory: `
<p>Μια συνάρτηση με παράμετρο και τιμή επιστροφής:</p>
<pre>fn double(x: i32) -> i32 {
    x * 2
}</pre>
<ul>
  <li><code>x: i32</code> — η παράμετρος και ο τύπος της (υποχρεωτικός).</li>
  <li><code>-> i32</code> — τι επιστρέφει.</li>
  <li><code>x * 2</code> <strong>χωρίς ;</strong> — αυτή είναι η τιμή που επιστρέφει.</li>
</ul>
<p>Αν βάλεις <code>;</code> στο τέλος, η γραμμή γίνεται απλή εντολή. Η συνάρτηση τότε δεν επιστρέφει τίποτα: <code>()</code>.</p>
<p>Ο compiler το πιάνει: <code>error[E0308]: mismatched types: expected i32, found ()</code>. Δηλαδή «υποσχέθηκες i32, αλλά δεν έδωσες τίποτα».</p>
<p>Εναλλακτικά γράφεις <code>return x * 2;</code>. Η Rust προτιμά τη μορφή χωρίς <code>return</code>.</p>`,
        glossary: ['συνάρτηση', 'παράμετρος', '-> (τύπος επιστροφής)', 'τελευταία έκφραση'],
        supportedSyntax: SYN3,
        initialCode: L3_CODE('c * 9 / 5 + 32;'),
        solution: L3_CODE('c * 9 / 5 + 32'),
        panels: ['serial', 'vars'],
        steps: [
          'Τρέξε. Διάβασε το error: ποια συνάρτηση, ποια γραμμή;',
          'Σύγκρινε το σώμα της to_fahrenheit με το σώμα της is_hot. Ποια διαφορά βλέπεις;',
          'Διόρθωσε την to_fahrenheit.',
          'Τρέξε ξανά: 0 C = 32 F, 20 C = 68 F, 30 C = 86 F.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Τι επιστρέφει η fn f() -> i32 { 5; } ;',
          options: ['Τίποτα, δηλαδή (): γι’ αυτό βγαίνει error[E0308]', 'Το 5', 'Το 0'],
          answer: 0,
          explain: 'Σωστά. Με το ; το 5 είναι εντολή που «πετιέται». Η συνάρτηση υπόσχεται i32 αλλά δίνει ().',
          retry: 'Όχι ακόμα. Τι κάνει το ; σε μια έκφραση στο τέλος συνάρτησης;'
        },
        hints: [
          'Η τελευταία γραμμή μιας συνάρτησης είναι η τιμή της μόνο αν δεν έχει ;.',
          'Κοίτα το τέλος της γραμμής c * 9 / 5 + 32. Η is_hot δείχνει τη σωστή μορφή.',
          'fn to_fahrenheit(c: i32) -> i32 {\n    c * 9 / 5 + 32\n}\n• χωρίς ; = «αυτό επιστρέφω»'
        ],
        validationTests: [
          { name: 'Τρεις μετατροπές', script: [
            { setup: true },
            { check: 'lines', is: ['0 C = 32 F, hot: false', '20 C = 68 F, hot: false', '30 C = 86 F, hot: true'], fail: 'Το ' + B.term + ' έγραψε: {v}. Περίμενα 0 C = 32 F, 20 C = 68 F και 30 C = 86 F (hot: true).' }
          ] }
        ],
        explanationOnSuccess: 'Ένα ; έκανε όλη τη διαφορά! Ο compiler δεν σε άφησε να τρέξεις ένα πρόγραμμα που θα έδινε σκουπίδια. Θυμήσου: τελευταία γραμμή χωρίς ; = τιμή επιστροφής.',
        remediation: 'Σβήσε μόνο το ; στο τέλος του c * 9 / 5 + 32. Μην αλλάξεις τον τύπο της συνάρτησης.'
      },

      {
        kind: 'variant', skills: ['rust', 'io', 'conditions'],
        title: 'Παραλλαγή: το κουμπί ανάβει το LED',
        objectives: ['Να διαβάζω το κουμπί με is_high().', 'Να οδηγώ το LED με if / else μέσα στον κύριο βρόχο.'],
        theory: `
<p>Το κουμπί είναι <strong>είσοδος</strong>:</p>
<pre>${B.pin('button')}</pre>
<p>Το <code>button.is_high()</code> δίνει <code>true</code> όσο το κουμπί είναι πατημένο. Το <code>button</code> δεν χρειάζεται <code>mut</code>: μόνο το διαβάζουμε.</p>
<p>Μέσα στο <code>loop</code>, σε κάθε γύρο:</p>
<ol>
  <li>διάβασε το κουμπί,</li>
  <li>άναψε ή σβήσε το LED με if / else,</li>
  <li>περίμενε λίγο (50 ms), για να μη «τρέχει» ο βρόχος άσκοπα.</li>
</ol>
<p>Στο εικονικό κύκλωμα το κουμπί έχει ήδη αντίσταση pull-down: όταν δεν το πατάς, διαβάζεται Low.</p>`,
        glossary: ['INPUT', 'if / else', 'polling'],
        supportedSyntax: SYN4,
        initialCode: L4_INITIAL,
        solution: L4_SOLUTION,
        world: { button: false },
        hardware: ['led', 'button'], panels: ['serial', 'vars', 'branch', 'loops'],
        steps: [
          'Βρες σε ποιο GPIO είναι το κουμπί.',
          'Μέσα στο loop γράψε ένα if με συνθήκη button.is_high().',
          'Στο if άναψε το LED, στο else σβήσ’ το.',
          'Τρέξε και πάτα το κουμπί στη σκηνή.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Γιατί το button δεν έχει mut;',
          options: ['Γιατί μόνο το διαβάζουμε, δεν το αλλάζουμε', 'Γιατί το κουμπί είναι πάντα Low', 'Λάθος, πρέπει να έχει mut'],
          answer: 0,
          explain: 'Σωστά. Το is_high() μόνο κοιτάζει. Η Rust ζητά mut μόνο για ό,τι αλλάζει.',
          retry: 'Όχι ακόμα. Το is_high() αλλάζει κάτι στο κουμπί;'
        },
        hints: [
          'Ίδια λογική με το «if ως έκφραση»: μια συνθήκη, δύο σκέλη. Εδώ τα σκέλη είναι εντολές για το LED.',
          `if button.is_high() { … } else { … } — μέσα βάλε ${B.w('led', 'set_high')} και ${B.w('led', 'set_low')}`,
          `if button.is_high() {\n    ${B.w('led', 'set_high')}\n} else {\n    ${B.w('led', 'set_low')}\n}`
        ],
        validationTests: [
          { name: 'Χωρίς πάτημα: LED σβηστό', script: [
            { setup: true }, { loops: 2 },
            { check: 'led', is: false, fail: 'Χωρίς πάτημα το LED είναι {v}. Περίμενα σβηστό.' }
          ] },
          { name: 'Πατημένο: LED αναμμένο · αφήνεις: σβήνει', script: [
            { setup: true }, { loops: 1 },
            { set: { button: true } }, { loops: 2 },
            { check: 'led', is: true, fail: 'Με πατημένο κουμπί το LED είναι {v}. Περίμενα αναμμένο. Διαβάζεις το button.is_high();' },
            { set: { button: false } }, { loops: 2 },
            { check: 'led', is: false, fail: 'Αφού άφησες το κουμπί, το LED είναι {v}. Περίμενα σβηστό. Έχεις else;' }
          ] }
        ],
        explanationOnSuccess: 'Είσοδος → απόφαση → έξοδος: η βάση κάθε συσκευής IoT. Το ίδιο if λειτουργεί για κάθε αισθητήρα.',
        remediation: 'Χωρίς else, το LED μένει αναμμένο για πάντα μετά το πρώτο πάτημα.'
      },

      {
        kind: 'checkpoint', skills: ['rust', 'io', 'state', 'timing'],
        title: 'Έλεγχος κεφαλαίου: κάθε πάτημα αλλάζει το LED',
        objectives: ['Να μετρώ πατήματα με ανίχνευση ακμής.', 'Να γράφω συνάρτηση που επιστρέφει bool.', 'Να συνδυάζω βρόχο, συνθήκες και συναρτήσεις.'],
        theory: `
<p>Θέλουμε διακόπτη με ένα κουμπί: 1ο πάτημα ανάβει, 2ο σβήνει, 3ο ανάβει…</p>
<p>Πρόβλημα: ο βρόχος τρέχει κάθε 50 ms. Αν κρατάς το κουμπί μισό δευτερόλεπτο, το <code>if pressed</code> μετρά <strong>10 πατήματα</strong>!</p>
<p>Λύση: <strong>ανίχνευση ακμής</strong>. Θυμόμαστε πώς ήταν το κουμπί στον προηγούμενο γύρο:</p>
<pre>if pressed && !was_pressed {   // μόλις πατήθηκε
    presses += 1;
}
was_pressed = pressed;</pre>
<p>Μετά, μια συνάρτηση αποφασίζει για το LED: <code>fn led_should_be_on(presses: u32) -> bool</code>. Μονός αριθμός = αναμμένο.</p>
<p>Το <code>%</code> δίνει το υπόλοιπο της διαίρεσης: <code>presses % 2 == 1</code> σημαίνει «μονός».</p>`,
        glossary: ['ανίχνευση ακμής', 'κατάσταση (state)', 'bool', 'συνάρτηση'],
        supportedSyntax: SYN4 + ', %',
        initialCode: L5_CODE(L5_FN_BAD, L5_EDGE_BAD),
        solution: L5_CODE(L5_FN_GOOD, L5_EDGE_GOOD),
        world: { button: false },
        hardware: ['led', 'button'], panels: ['serial', 'vars', 'branch', 'loops'],
        steps: [
          'Τρέξε τον αρχικό κώδικα και κράτα πατημένο το κουμπί. Τι γίνεται με το Presses;',
          'Πρόσθεσε τη μεταβλητή was_pressed πριν από το loop.',
          'Μέτρα μόνο όταν pressed && !was_pressed. Στο τέλος του γύρου κράτα την τιμή: was_pressed = pressed;',
          'Γράψε το σώμα της led_should_be_on με το %.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Το κουμπί ήταν πατημένο και στον προηγούμενο γύρο (was_pressed = true) και τώρα (pressed = true). Μετράμε πάτημα;',
          options: ['Όχι: είναι το ίδιο πάτημα που κρατάς ακόμα', 'Ναι, κάθε γύρο', 'Μόνο αν περάσει 1 δευτερόλεπτο'],
          answer: 0,
          explain: 'Σωστά. Μετράμε μόνο τη στιγμή της αλλαγής: από false σε true.',
          retry: 'Όχι ακόμα. Τι λέει η συνθήκη pressed && !was_pressed όταν και τα δύο είναι true;'
        },
        hints: [
          'Δύο κομμάτια: μια μεταβλητή που θυμάται τον προηγούμενο γύρο, και μια συνάρτηση με %.',
          'let mut was_pressed = false; πριν από το loop. Το if γίνεται if pressed && !was_pressed. Στην συνάρτηση: presses % 2 == 1 (χωρίς ;).',
          'if pressed && !was_pressed {\n    presses += 1;\n    println!("Presses: {presses}");\n}\nwas_pressed = pressed;\n\nfn led_should_be_on(presses: u32) -> bool {\n    presses % 2 == 1\n}'
        ],
        validationTests: [
          { name: 'Κράτημα 3 γύρους = 1 πάτημα, LED αναμμένο', script: [
            { setup: true }, { loops: 1 },
            { sequence: { button: [1, 1, 1] } },
            { check: 'count', text: 'Presses: 1', is: 1, fail: 'Ενώ κρατούσες το κουμπί 3 γύρους, το «Presses: 1» τυπώθηκε {n} φορές. Περίμενα 1 φορά.' },
            { check: 'serialNot', text: 'Presses: 2', fail: 'Ένα κράτημα μετρήθηκε σαν πολλά πατήματα. Μέτρα μόνο όταν pressed && !was_pressed.' },
            { check: 'led', is: true, fail: 'Μετά το 1ο πάτημα το LED είναι {v}. Περίμενα αναμμένο (1 = μονός).' }
          ] },
          { name: 'Δύο πατήματα: LED σβηστό · τρία: αναμμένο', script: [
            { setup: true }, { loops: 1 },
            { sequence: { button: [1, 0, 1, 1, 0] } },
            { check: 'lastLine', is: 'Presses: 2', fail: 'Μετά από 2 πατήματα η τελευταία γραμμή είναι {v}. Περίμενα «Presses: 2».' },
            { check: 'led', is: false, fail: 'Μετά από 2 πατήματα το LED είναι {v}. Περίμενα σβηστό (2 = ζυγός).' },
            { sequence: { button: [1, 0] } },
            { check: 'led', is: true, fail: 'Μετά από 3 πατήματα το LED είναι {v}. Περίμενα αναμμένο.' }
          ] }
        ],
        explanationOnSuccess: 'Έλεγχος κεφαλαίου: πέτυχε! Συνδύασες βρόχο, συνθήκες, μνήμη κατάστασης και δική σου συνάρτηση. Η ανίχνευση ακμής είναι από τα πιο χρήσιμα μοτίβα στις συσκευές.',
        remediation: 'Το was_pressed = pressed; μπαίνει μετά το if, σε κάθε γύρο, όχι μέσα στο if.'
      }
    ];
  });
})(typeof window !== 'undefined' ? window : globalThis);
