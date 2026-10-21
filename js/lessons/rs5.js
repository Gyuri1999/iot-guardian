/*
 * IoT Guardian — Διαδρομή Rust, Κεφάλαιο 5: Αισθητήρας στάθμευσης σε Rust (HC-SR04 + φανάρι).
 * Raspberry Pi: κεφάλαιο 45 · ESP32: κεφάλαιο 55. Χρησιμοποιεί το L.RustKit του rs1.js.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  const K = L.RustKit;

  K.addGlossary([
    { term: 'Instant', def: 'Στιγμή στον χρόνο: let start = Instant::now();. Το start.elapsed() λέει πόσος χρόνος πέρασε από τότε (Duration).' },
    { term: 'Duration', def: 'Διάρκεια χρόνου: Duration::from_millis(30), Duration::from_micros(10). Συγκρίνεται με < και >.' },
    { term: 'busy-wait', def: 'Βρόχος που απλώς περιμένει να αλλάξει ένα pin, ρωτώντας ξανά και ξανά. Χρειάζεται πάντα όριο χρόνου (timeout), αλλιώς μπορεί να κολλήσει για πάντα.' },
    { term: 'as (μετατροπή)', def: 'Μετατρέπει αριθμό σε άλλο τύπο: us as f32, cm as u32. Από f32 σε u32 κόβει τα δεκαδικά (35.7 → 35).' },
    { term: 'range pattern (0..=19)', def: 'Μέσα σε match: το 0..=19 ταιριάζει σε κάθε ακέραιο από 0 έως 19. Τα σκέλη ελέγχονται με τη σειρά, από πάνω προς τα κάτω.' }
  ]);

  K.defineChapter(5, 'Αισθητήρας στάθμευσης σε Rust', B => {
    const HW1 = ['ultrasonic'];
    const HW2 = ['ultrasonic', 'traffic'];
    const PANELS = ['serial', 'vars', 'loops'];
    const SYN1 = `Instant::now(), .elapsed(), Duration::from_millis(…), .as_micros() as f32, while echo.is_low() { … }, Option<f32>, Some(x), None, return None;, ${B.pi ? 'thread::sleep(Duration::from_micros(10))' : 'Ets::delay_us(10)'}`;
    const SYN2 = SYN1 + ', enum Light { Red, Yellow, Green }, match cm as u32 { 0..=19 => …, 20..=49 => …, _ => … }, {:?}';
    const SYN3 = SYN2 + `, red.set_high()${B.q}, yellow.set_low()${B.q}, let light = match … { … };`;

    // ------------------------------------------------------------ κοινά κομμάτια
    const trigger = B.pi
      ? `    trig.set_high();                            // παλμός TRIG: 10 µs
    thread::sleep(Duration::from_micros(10));
    trig.set_low();`
      : `    trig.set_high().ok()?;                      // παλμός TRIG: 10 µs
    Ets::delay_us(10);
    trig.set_low().ok()?;`;
    const MEASURE = (t1, t2) => `// Στέλνει παλμό και μετρά την ηχώ. None = δεν ήρθε ηχώ στην ώρα της.
fn measure(trig: &mut ${B.outTy('trig')}, echo: &${B.inTy('echo')}) -> Option<f32> {
${trigger}

    // 1. Περίμενε να ξεκινήσει η ηχώ (το ECHO γίνεται High)
    let start = Instant::now();
    while echo.is_low() {
        if start.elapsed() > Duration::from_millis(30) {
            return ${t1};
        }
    }
    // 2. Μέτρα πόσο μένει High
    let pulse = Instant::now();
    while echo.is_high() {
        if pulse.elapsed() > Duration::from_millis(30) {
            return ${t2};
        }
    }
    let us = pulse.elapsed().as_micros() as f32;
    Some(us / 58.3)   // περίπου 58,3 µs ανά cm (πήγαινε-έλα)
}`;
    const MEASURE_OK = MEASURE('None', 'None');
    // τύποι μόνο για τα pins που εμφανίζονται σε υπογραφή συνάρτησης (trig, echo)
    const usesFor = () => B.uses({ sleep: true, us: !B.pi, instant: true, outs: ['trig'], ins: ['echo'] });
    const pinsUs = `    ${B.pin('trig')}
    ${B.pin('echo')}`;
    const pinsAll = `${pinsUs}
    ${B.pin('red')}
    ${B.pin('yellow')}
    ${B.pin('green')}`;
    const LIGHT_ENUM = `#[derive(Debug, Clone, Copy, PartialEq)]
enum Light {
    Red,
    Yellow,
    Green,
}`;
    const LIGHT_FOR = (arms) => `// Ποιο φως ταιριάζει σε κάθε απόσταση.
fn light_for(cm: f32) -> Light {
    match cm as u32 {
${arms}
    }
}`;
    const ARMS_OK = `        0..=19 => Light::Red,      // σταμάτα
        20..=49 => Light::Yellow,  // πρόσεχε
        _ => Light::Green,         // 50 cm και πάνω: ελεύθερα`;
    const lightsArm = (name, r, y, g) => `            Light::${name} => {
                ${B.w('red', r ? 'set_high' : 'set_low')}
                ${B.w('yellow', y ? 'set_high' : 'set_low')}
                ${B.w('green', g ? 'set_high' : 'set_low')}
            }`;
    const SHOW = (extra) => `        match light {
${lightsArm('Red', 1, 0, 0)}
${lightsArm('Yellow', 0, 1, 0)}
${lightsArm('Green', 0, 0, 1)}${extra || ''}
        }`;
    const PICK = `        let light = match measure(&mut trig, &echo) {
            Some(cm) => {
                println!("Distance: {:.1} cm", cm);
                light_for(cm)
            }
            None => {
                println!("No echo");
                Light::Yellow   // δεν ξέρουμε: προσοχή
            }
        };`;

    // 5.1
    const L1_CODE = (measure) => `// Αισθητήρας απόστασης HC-SR04 (TRIG = GPIO ${B.P.trig}, ECHO = GPIO ${B.P.echo}).
${usesFor()}

${measure}

${B.mainHw}
${pinsUs}

    loop {
        match measure(&mut trig, &echo) {
            Some(cm) => println!("Distance: {:.1} cm", cm),
            None => println!("No echo"),
        }
        ${B.sleep(200)}
    }
}
`;
    const L1_BAD = MEASURE('____   /* ΣΥΜΠΛΗΡΩΣΕ: «καμία μέτρηση» */', '____');

    // 5.2
    const L2_CODE = (arms) => `// Ποιο φως αντιστοιχεί στην απόσταση; (Το φανάρι έρχεται στο επόμενο μάθημα.)
${usesFor()}

${LIGHT_ENUM}

${LIGHT_FOR(arms)}

${MEASURE_OK}

${B.mainHw}
${pinsUs}

    loop {
        match measure(&mut trig, &echo) {
            Some(cm) => println!("{:.1} cm -> {:?}", cm, light_for(cm)),
            None => println!("No echo"),
        }
        ${B.sleep(200)}
    }
}
`;
    const ARMS_BAD = `        // ΣΥΜΠΛΗΡΩΣΕ: κάτω από 20 cm → Red, από 20 έως 49 → Yellow
        _ => Light::Green,`;

    // 5.3
    const L3_CODE = (show) => `// Αισθητήρας στάθμευσης με φανάρι (κόκκινο / κίτρινο / πράσινο = GPIO ${B.P.red} / ${B.P.yellow} / ${B.P.green}).
${usesFor()}

${LIGHT_ENUM}

${LIGHT_FOR(ARMS_OK)}

${MEASURE_OK}

${B.mainHw}
${pinsAll}

    loop {
${PICK}

${show}
        ${B.sleep(200)}
    }
}
`;
    const SHOW_BAD = `        // ΣΥΜΠΛΗΡΩΣΕ: match light { … } που ανάβει ΜΟΝΟ το σωστό φως.
        // Το Red είναι έτοιμο. Γράψε το Yellow και το Green.
        match light {
${lightsArm('Red', 1, 0, 0)}
            _ => {}
        }`;

    // 5.4
    const L4_INITIAL = `// Αισθητήρας στάθμευσης του γκαράζ.
// Παράπονα: «το κόκκινο δεν ανάβει ποτέ» και «όταν φύγει το αυτοκίνητο, όλα σβήνουν και σταματά».
${usesFor()}

${LIGHT_ENUM}

${LIGHT_FOR(`        0..=49 => Light::Yellow,
        0..=19 => Light::Red,
        _ => Light::Green,`)}

${MEASURE_OK}

${B.mainHw}
${pinsAll}

    loop {
        let cm = measure(&mut trig, &echo).unwrap();
        println!("Distance: {:.1} cm", cm);
        let light = light_for(cm);

${SHOW()}
        ${B.sleep(200)}
    }
}
`;

    // 5.5
    const L5_INITIAL = `// Αισθητήρας στάθμευσης: τελική έκδοση.
// ΖΗΤΟΥΜΕΝΑ:
//   1. Νέα κατάσταση Light::Stop κάτω από 10 cm: το κόκκινο αναβοσβήνει (toggle σε κάθε γύρο).
//   2. Τύπωσε «Light: …» ({:?}) μόνο όταν αλλάζει το φως.
${usesFor()}

${LIGHT_ENUM}

${LIGHT_FOR(ARMS_OK)}

${MEASURE_OK}

${B.mainHw}
${pinsAll}

    loop {
${PICK}

${SHOW()}
        ${B.sleep(200)}
    }
}
`;
    const L5_SOLUTION = `// Αισθητήρας στάθμευσης: τελική έκδοση.
${usesFor()}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Light {
    Stop,     // κάτω από 10 cm: το κόκκινο αναβοσβήνει
    Red,
    Yellow,
    Green,
}

${LIGHT_FOR(`        0..=9 => Light::Stop,
${ARMS_OK.replace('0..=19', '10..=19')}`)}

${MEASURE_OK}

${B.mainHw}
${pinsAll}
    let mut last: Option<Light> = None;   // το φως του προηγούμενου γύρου

    loop {
${PICK}

        if Some(light) != last {
            println!("Light: {:?}", light);
            last = Some(light);
        }

${SHOW(`
            Light::Stop => {
                ${B.w('red', 'toggle')}   // αναβοσβήνει
                ${B.w('yellow', 'set_low')}
                ${B.w('green', 'set_low')}
            }`)}
        ${B.sleep(200)}
    }
}
`;

    const lt = (red, yellow, green, d, want) => ({ check: 'lights', red, yellow, green, fail: `Στα ${d} το φανάρι δείχνει: {v}. Περίμενα μόνο ${want}.` });
    const voltNote = B.pi
      ? '<p><strong>Ασφάλεια σε αληθινό Pi:</strong> το ECHO του HC-SR04 βγάζει <strong>5 V</strong>. Τα pins του Pi αντέχουν μόνο <strong>3,3 V</strong>. Βάλε διαιρέτη τάσης (δύο αντιστάσεις) πριν από το GPIO 24.</p><p>Το Linux του Pi δεν είναι «πραγματικού χρόνου». Η μέτρηση με Instant μπορεί να έχει σφάλμα λίγων cm. Για παιχνίδι στάθμευσης φτάνει.</p>'
      : '<p><strong>Ασφάλεια σε αληθινό ESP32:</strong> το ECHO του HC-SR04 βγάζει <strong>5 V</strong>. Το ESP32 αντέχει μόνο <strong>3,3 V</strong>. Βάλε διαιρέτη τάσης πριν από το GPIO 18.</p><p>Στο ESP32 το <code>trig.set_high().ok()?</code> σημαίνει: «αν αποτύχει το pin, η measure δίνει None».</p>';

    return [
      {
        kind: 'guided', skills: ['rust', 'sensors', 'timing'],
        title: 'Μέτρηση απόστασης που επιστρέφει Option<f32>',
        objectives: ['Να μετρώ την ηχώ του HC-SR04 με Instant.', 'Να βάζω όριο χρόνου σε κάθε αναμονή.', 'Να επιστρέφω None όταν δεν ήρθε ηχώ.'],
        theory: `
<p>Το HC-SR04 μετρά απόσταση με ήχο. Στη Rust δεν υπάρχει έτοιμο <code>pulseIn</code>: τη μέτρηση τη γράφουμε μόνοι μας.</p>
<ol>
  <li>Παλμός στο TRIG: High για 10 µs, μετά Low.</li>
  <li>Περιμένουμε να γίνει το ECHO High (ξεκινά η ηχώ).</li>
  <li>Μετράμε πόσο μένει High με <code>Instant::now()</code> και <code>.elapsed()</code>.</li>
  <li><code>cm = µs / 58.3</code></li>
</ol>
<p>Κάθε <code>while</code> που περιμένει ένα pin λέγεται <strong>busy-wait</strong>. Θέλει <strong>όριο χρόνου</strong> (30 ms). Αλλιώς, αν δεν έρθει ηχώ, το πρόγραμμα κολλάει για πάντα.</p>
<p>Τι επιστρέφει η measure όταν δεν ήρθε ηχώ; Όχι 0: το 0 μοιάζει με απόσταση! Επιστρέφει <code>Option&lt;f32&gt;</code>: <code>Some(cm)</code> ή <code>None</code>.</p>
${voltNote}`,
        glossary: ['HC-SR04', 'TRIG / ECHO', 'Instant', 'Duration', 'busy-wait', 'Option', 'as (μετατροπή)'],
        supportedSyntax: SYN1,
        initialCode: L1_CODE(L1_BAD),
        solution: L1_CODE(MEASURE_OK),
        world: { distance: 35 },
        hardware: HW1, panels: PANELS,
        steps: [
          'Διάβασε τη measure: βρες τον παλμό TRIG και τα δύο while.',
          'Στα δύο κενά η measure πρέπει να πει «καμία μέτρηση». Ποια τιμή του Option είναι αυτή;',
          'Τρέξε. Σύρε το αυτοκινητάκι: αλλάζει η απόσταση;',
          'Βάλε το εμπόδιο πολύ μακριά (πάνω από 400 cm). Τι γράφει;',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Γιατί η measure επιστρέφει Option<f32> και όχι απλώς f32 με 0 για «καμία ηχώ»;',
          options: ['Γιατί το 0 μοιάζει με αληθινή απόσταση, ενώ το None λέει καθαρά «δεν ξέρω»', 'Γιατί το f32 δεν χωρά το 0', 'Γιατί είναι πιο γρήγορο'],
          answer: 0,
          explain: 'Σωστά. Με Option ο compiler σε αναγκάζει να χειριστείς και την περίπτωση «καμία μέτρηση».',
          retry: 'Όχι ακόμα. Τι θα έκανε ένα φανάρι στάθμευσης αν έβλεπε «0 cm»;'
        },
        hints: [
          'Η measure επιστρέφει Option<f32>. Μια τιμή για «υπάρχει μέτρηση» και μία για «δεν υπάρχει».',
          'Το Some(us / 58.3) είναι η επιτυχία στο τέλος. Τα δύο return στα όρια χρόνου είναι η αποτυχία.',
          'if start.elapsed() > Duration::from_millis(30) {\n    return None;\n}\n…\nif pulse.elapsed() > Duration::from_millis(30) {\n    return None;\n}'
        ],
        validationTests: [
          { name: 'Εμπόδιο στα 35 cm → «Distance: 35.0 cm»', world: { distance: 35 }, script: [
            { setup: true }, { loops: 3 },
            { check: 'count', text: 'Distance: 35.0 cm', is: 3, fail: 'Σε 3 γύρους το «Distance: 35.0 cm» τυπώθηκε {n} φορές. Περίμενα 3.' }
          ] },
          { name: 'Η μέτρηση ακολουθεί το εμπόδιο (80 cm)', world: { distance: 35 }, script: [
            { setup: true }, { loops: 1 },
            { set: { distance: 80 } }, { loops: 1 },
            { check: 'lastLine', is: 'Distance: 80.0 cm', fail: 'Με εμπόδιο στα 80 cm η τελευταία γραμμή είναι {v}. Περίμενα «Distance: 80.0 cm».' }
          ] },
          { name: 'Καμία ηχώ → «No echo», όχι ψεύτικη απόσταση', world: { distance: 500 }, script: [
            { setup: true }, { loops: 2 },
            { check: 'count', text: 'No echo', is: 2, fail: 'Χωρίς ηχώ το «No echo» τυπώθηκε {n} φορές. Περίμενα 2.' },
            { check: 'serialNot', text: 'Distance', fail: 'Χωρίς ηχώ τυπώθηκε απόσταση. Η measure πρέπει να δίνει None όταν περάσουν τα 30 ms.' }
          ] }
        ],
        explanationOnSuccess: 'Η μέτρηση δουλεύει και δεν κολλάει ποτέ: κάθε αναμονή έχει όριο. Και όταν δεν ξέρει, το λέει με None, αντί να πει ψέματα.',
        remediation: 'Το None γράφεται χωρίς παρενθέσεις: return None;. Σβήσε και το σχόλιο /* … */.'
      },

      {
        kind: 'guided', skills: ['rust', 'sensors', 'conditions'],
        title: 'enum Light και match με περιοχές',
        objectives: ['Να ορίζω enum Light { Red, Yellow, Green }.', 'Να γράφω match με περιοχές τιμών (0..=19).', 'Να μετατρέπω f32 σε u32 με as.'],
        theory: `
<p>Το φανάρι στάθμευσης έχει τρία φώτα:</p>
<ul>
  <li><strong>κάτω από 20 cm:</strong> Red (σταμάτα),</li>
  <li><strong>20 έως 49 cm:</strong> Yellow (πρόσεχε),</li>
  <li><strong>50 cm και πάνω:</strong> Green (ελεύθερα).</li>
</ul>
<p>Τα φώτα γίνονται ένα enum: <code>enum Light { Red, Yellow, Green }</code>.</p>
<p>Το match δέχεται <strong>περιοχές</strong> ακεραίων:</p>
<pre>match cm as u32 {
    0..=19 => Light::Red,
    20..=49 => Light::Yellow,
    _ => Light::Green,
}</pre>
<p>Το <code>cm as u32</code> κόβει τα δεκαδικά: 19.8 → 19.</p>
<p>Τα σκέλη ελέγχονται <strong>με τη σειρά</strong>. Το <code>_</code> πιάνει ό,τι έμεινε. Χωρίς αυτό, ο compiler λέει E0004: ξέχασες τους αριθμούς από 50 και πάνω.</p>`,
        glossary: ['enum', 'range pattern (0..=19)', 'as (μετατροπή)', 'match'],
        supportedSyntax: SYN2,
        initialCode: L2_CODE(ARMS_BAD),
        solution: L2_CODE(ARMS_OK),
        world: { distance: 35 },
        hardware: HW1, panels: PANELS,
        steps: [
          'Τρέξε. Τι φως δείχνει στα 35 cm; Γιατί;',
          'Πρόσθεσε στο match το σκέλος για 0 έως 19 cm.',
          'Πρόσθεσε το σκέλος για 20 έως 49 cm. Πρόσεξε: πάνω από το _.',
          'Τρέξε και σύρε το αυτοκινητάκι σε 10, 35 και 80 cm.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Τι δίνει η light_for(19.9);',
          options: ['Red: το 19.9 as u32 γίνεται 19', 'Yellow: στρογγυλεύει σε 20', 'Green'],
          answer: 0,
          explain: 'Σωστά. Το as u32 κόβει τα δεκαδικά, δεν στρογγυλεύει.',
          retry: 'Όχι ακόμα. Τι κάνει το as u32 στα δεκαδικά;'
        },
        hints: [
          'Δύο νέα σκέλη στο match, πριν από το _.',
          'Γράψε 0..=19 => Light::Red, και 20..=49 => Light::Yellow, πάνω από το _ => Light::Green,.',
          '0..=19 => Light::Red,\n20..=49 => Light::Yellow,\n_ => Light::Green,'
        ],
        validationTests: [
          { name: '80 cm → Green · 35 cm → Yellow · 10 cm → Red', world: { distance: 80 }, script: [
            { setup: true }, { loops: 1 },
            { check: 'lastLine', is: '80.0 cm -> Green', fail: 'Στα 80 cm η τελευταία γραμμή είναι {v}. Περίμενα «80.0 cm -> Green».' },
            { set: { distance: 35 } }, { loops: 1 },
            { check: 'lastLine', is: '35.0 cm -> Yellow', fail: 'Στα 35 cm η τελευταία γραμμή είναι {v}. Περίμενα «35.0 cm -> Yellow».' },
            { set: { distance: 10 } }, { loops: 1 },
            { check: 'lastLine', is: '10.0 cm -> Red', fail: 'Στα 10 cm η τελευταία γραμμή είναι {v}. Περίμενα «10.0 cm -> Red».' }
          ] },
          { name: 'Τα όρια: 20 cm → Yellow, 60 cm → Green', world: { distance: 20 }, script: [
            { setup: true }, { loops: 1 },
            { check: 'lastLine', is: '20.0 cm -> Yellow', fail: 'Στα 20 cm η τελευταία γραμμή είναι {v}. Περίμενα «20.0 cm -> Yellow» (το 20 ανήκει στο κίτρινο).' },
            { set: { distance: 60 } }, { loops: 1 },
            { check: 'lastLine', is: '60.0 cm -> Green', fail: 'Στα 60 cm η τελευταία γραμμή είναι {v}. Περίμενα «60.0 cm -> Green».' }
          ] }
        ],
        explanationOnSuccess: 'Τρία φώτα, τρία σκέλη, καμία περίπτωση ξεχασμένη. Ο compiler ελέγχει ότι το match καλύπτει όλους τους αριθμούς.',
        remediation: 'Αν όλα βγαίνουν Green, τα νέα σκέλη είναι κάτω από το _. Το _ πρέπει να είναι τελευταίο.'
      },

      {
        kind: 'variant', skills: ['rust', 'sensors', 'io'],
        title: 'Παραλλαγή: το φανάρι ανάβει',
        objectives: ['Να οδηγώ τρία LED με match πάνω στο Light.', 'Να ανάβω πάντα ακριβώς ένα φως.', 'Να διαλέγω ασφαλές φως όταν δεν υπάρχει μέτρηση.'],
        theory: `
<p>Τώρα το Light οδηγεί το φανάρι (GPIO ${B.P.red} / ${B.P.yellow} / ${B.P.green}).</p>
<p>Σε κάθε σκέλος γράφεις <strong>και τα τρία</strong> φώτα: ένα High, δύο Low. Αλλιώς μένει αναμμένο το φως του προηγούμενου γύρου.</p>
<pre>Light::Yellow => {
    ${B.w('red', 'set_low')}
    ${B.w('yellow', 'set_high')}
    ${B.w('green', 'set_low')}
}</pre>
<p>Και όταν η measure δίνει <code>None</code>; Δεν ξέρουμε πού είναι το εμπόδιο. Το ασφαλές είναι το <strong>κίτρινο</strong>: «πρόσεχε».</p>
<pre>let light = match measure(&mut trig, &echo) {
    Some(cm) => { …; light_for(cm) }
    None => { println!("No echo"); Light::Yellow }
};</pre>
<p>Το match <strong>δίνει τιμή</strong>, όπως το if: την κρατάμε στο <code>light</code>.</p>`,
        glossary: ['match', 'enum', 'Option'],
        supportedSyntax: SYN3,
        initialCode: L3_CODE(SHOW_BAD),
        solution: L3_CODE(SHOW()),
        world: { distance: 80 },
        hardware: HW2, panels: PANELS,
        steps: [
          'Διάβασε πώς βγαίνει το light από τη μέτρηση. Τι γίνεται στο None;',
          'Στο match light γράψε το σκέλος Light::Yellow (μόνο κίτρινο).',
          'Γράψε το σκέλος Light::Green και σβήσε το _ => {}.',
          'Τρέξε και σύρε το αυτοκινητάκι.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Αφού σβήσεις το _ => {}, τι γίνεται αν ξεχάσεις το σκέλος Light::Green;',
          options: ['Ο compiler λέει error[E0004]: λείπει το Light::Green', 'Το πράσινο δεν ανάβει ποτέ, χωρίς μήνυμα', 'Ανάβουν όλα'],
          answer: 0,
          explain: 'Σωστά. Χωρίς _ το match πρέπει να έχει σκέλος για κάθε φως. Ο compiler δεν σε αφήνει να ξεχάσεις κανένα.',
          retry: 'Όχι ακόμα. Θυμήσου το λάθος E0004 από το κεφάλαιο για το match.'
        },
        hints: [
          'Αντέγραψε το σκέλος Light::Red και άλλαξε ποιο φως είναι High.',
          'Light::Yellow: μόνο το yellow High. Light::Green: μόνο το green High. Μετά σβήσε το _ => {}.',
          `Light::Yellow => {\n    ${B.w('red', 'set_low')}\n    ${B.w('yellow', 'set_high')}\n    ${B.w('green', 'set_low')}\n}\nLight::Green => {\n    ${B.w('red', 'set_low')}\n    ${B.w('yellow', 'set_low')}\n    ${B.w('green', 'set_high')}\n}`
        ],
        validationTests: [
          { name: '80 cm → πράσινο · 35 cm → κίτρινο · 10 cm → κόκκινο', world: { distance: 80 }, script: [
            { setup: true }, { loops: 1 },
            lt(false, false, true, '80 cm', 'πράσινο'),
            { set: { distance: 35 } }, { loops: 1 },
            lt(false, true, false, '35 cm', 'κίτρινο'),
            { set: { distance: 10 } }, { loops: 1 },
            lt(true, false, false, '10 cm', 'κόκκινο')
          ] },
          { name: 'Καμία ηχώ → κίτρινο (προσοχή)', world: { distance: 80 }, script: [
            { setup: true }, { loops: 1 },
            { set: { distance: 500 } }, { loops: 1 },
            lt(false, true, false, '500 cm (καμία ηχώ)', 'κίτρινο'),
            { check: 'lastLine', is: 'No echo', fail: 'Χωρίς ηχώ η τελευταία γραμμή είναι {v}. Περίμενα «No echo».' }
          ] }
        ],
        explanationOnSuccess: `Ο αισθητήρας στάθμευσης δουλεύει σε Rust, στο ${B.name}! Και όταν ο αισθητήρας δεν βλέπει τίποτα, το φανάρι διαλέγει το ασφαλές κίτρινο.`,
        remediation: 'Αν ανάβουν δύο φώτα μαζί, σε κάποιο σκέλος λείπει ένα set_low.'
      },

      {
        kind: 'debug', skills: ['rust', 'sensors', 'conditions', 'security'],
        title: 'Βρες τα λάθη: το κόκκινο που δεν ανάβει ποτέ',
        objectives: ['Να βρίσκω σκέλος match που δεν τρέχει ποτέ (unreachable pattern).', 'Να αντικαθιστώ το unwrap() με χειρισμό του None.'],
        theory: `
<p>Δύο παράπονα από το γκαράζ:</p>
<ol>
  <li>«Το κόκκινο δεν ανάβει ποτέ.»</li>
  <li>«Όταν φύγει το αυτοκίνητο, όλα σβήνουν και ο αισθητήρας σταματά.»</li>
</ol>
<p><strong>Λάθος 1: η σειρά των σκελών.</strong> Το match δοκιμάζει τα σκέλη από πάνω προς τα κάτω. Αν το <code>0..=49</code> είναι πρώτο, πιάνει και το 10. Το <code>0..=19</code> δεν φτάνει ποτέ. Ο rustc το λέει με προειδοποίηση: <code>warning: unreachable pattern</code>.</p>
<p><strong>Λάθος 2: το unwrap().</strong> Χωρίς εμπόδιο η measure δίνει None. Το <code>.unwrap()</code> σε None κάνει <strong>panic</strong>: η συσκευή σταματά${B.pi ? '' : ' και το ESP32 κάνει επανεκκίνηση (Rebooting…)'}.</p>
<p>Η διόρθωση: <code>match</code> με Some / None, και κίτρινο όταν δεν ξέρουμε. Όπως στο προηγούμενο μάθημα.</p>`,
        glossary: ['range pattern (0..=19)', 'unwrap', 'panic', 'Option'],
        supportedSyntax: SYN3,
        initialCode: L4_INITIAL,
        solution: L3_CODE(SHOW()),
        world: { distance: 10 },
        hardware: HW2, panels: PANELS,
        steps: [
          'Τρέξε με το εμπόδιο στα 10 cm. Ποιο φως ανάβει; Γιατί;',
          'Διόρθωσε τη σειρά των σκελών στη light_for.',
          'Τώρα σύρε το εμπόδιο πολύ μακριά. Τι γράφει το ' + B.term + ';',
          'Αντικατάστησε το unwrap() με match: Some → light_for, None → «No echo» και Light::Yellow.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Στο match με 0..=49 πρώτο και 0..=19 δεύτερο, τι δίνει το 10;',
          options: ['Yellow: το πρώτο σκέλος που ταιριάζει κερδίζει', 'Red: το πιο «στενό» σκέλος κερδίζει', 'Και τα δύο'],
          answer: 0,
          explain: 'Σωστά. Το match σταματά στο πρώτο σκέλος που ταιριάζει. Γι’ αυτό τα στενά σκέλη μπαίνουν πρώτα (ή χωρίζονται: 0..=19, 20..=49).',
          retry: 'Όχι ακόμα. Με ποια σειρά δοκιμάζει τα σκέλη το match;'
        },
        hints: [
          'Δύο λάθη, σε δύο σημεία: η light_for και η πρώτη γραμμή του loop.',
          'Στη light_for βάλε 0..=19 πρώτο και κάνε το δεύτερο 20..=49. Στο loop: let light = match measure(&mut trig, &echo) { Some(cm) => …, None => … };',
          'let light = match measure(&mut trig, &echo) {\n    Some(cm) => {\n        println!("Distance: {:.1} cm", cm);\n        light_for(cm)\n    }\n    None => {\n        println!("No echo");\n        Light::Yellow\n    }\n};'
        ],
        validationTests: [
          { name: '10 cm → κόκκινο', world: { distance: 10 }, script: [
            { setup: true }, { loops: 2 },
            lt(true, false, false, '10 cm', 'κόκκινο')
          ] },
          { name: '35 cm → κίτρινο · 80 cm → πράσινο', world: { distance: 35 }, script: [
            { setup: true }, { loops: 1 },
            lt(false, true, false, '35 cm', 'κίτρινο'),
            { set: { distance: 80 } }, { loops: 1 },
            lt(false, false, true, '80 cm', 'πράσινο')
          ] },
          { name: 'Το αυτοκίνητο φεύγει: κίτρινο, χωρίς panic', world: { distance: 35 }, script: [
            { setup: true }, { loops: 1 },
            { set: { distance: 500 } }, { loops: 2 },
            lt(false, true, false, '500 cm (καμία ηχώ)', 'κίτρινο'),
            { check: 'count', text: 'No echo', is: 2, fail: 'Χωρίς ηχώ το «No echo» τυπώθηκε {n} φορές σε 2 γύρους. Περίμενα 2.' }
          ] }
        ],
        explanationOnSuccess: 'Δύο λάθη που ο compiler δεν μπορεί να πιάσει μόνος του, αλλά σου έδωσε στοιχεία: μια προειδοποίηση και ένα panic με γραμμή. Η συσκευή είναι πια σωστή και ανθεκτική.',
        remediation: 'Μετά το match που φτιάχνει το light, το match light { … } για τα φώτα μένει ίδιο.'
      },

      {
        kind: 'checkpoint', skills: ['rust', 'sensors', 'state', 'io'],
        title: 'Έλεγχος κεφαλαίου: STOP που αναβοσβήνει',
        objectives: ['Να προσθέτω νέα κατάσταση σε enum και να ενημερώνω κάθε match.', 'Να τυπώνω μόνο όταν αλλάζει η κατάσταση.', 'Να αναβοσβήνω το κόκκινο κάτω από 10 cm.'],
        theory: `
<p>Η τελική έκδοση έχει μια νέα κατάσταση: <strong>Stop</strong>, κάτω από 10 cm. Το κόκκινο αναβοσβήνει (toggle σε κάθε γύρο, δηλαδή κάθε 200 ms).</p>
<p>Πρόσθεσε το <code>Stop</code> στο enum και τρέξε. Ο compiler θα σου δείξει <strong>κάθε match</strong> που πρέπει να ενημερωθεί (E0004). Αυτή είναι η δύναμη του enum!</p>
<p>Στη light_for: <code>0..=9 => Light::Stop</code> και μετά <code>10..=19 => Light::Red</code>.</p>
<p>Δεύτερο ζητούμενο: τύπωσε «Light: Stop» (με <code>{:?}</code>) <strong>μόνο όταν αλλάζει</strong> το φως. Κράτα το προηγούμενο φως:</p>
<pre>let mut last: Option&lt;Light&gt; = None;
…
if Some(light) != last {
    println!("Light: {:?}", light);
    last = Some(light);
}</pre>
<p>Το <code>last</code> είναι Option, γιατί στον πρώτο γύρο δεν υπάρχει ακόμα «προηγούμενο φως».</p>`,
        glossary: ['enum', 'match', 'Option', 'κατάσταση (state)'],
        supportedSyntax: SYN3 + `, red.toggle()${B.q}, let mut last: Option<Light> = None;, Some(light) != last`,
        initialCode: L5_INITIAL,
        solution: L5_SOLUTION,
        world: { distance: 80 },
        hardware: HW2, panels: PANELS,
        steps: [
          'Πρόσθεσε το Stop στο enum Light και τρέξε. Πού διαμαρτύρεται ο compiler;',
          'Στη light_for: 0..=9 → Stop, 10..=19 → Red.',
          'Στο match light: Stop → toggle στο κόκκινο, τα άλλα σβηστά.',
          'Πρόσθεσε το last και τύπωνε «Light: …» μόνο όταν αλλάζει.',
          'Πάτησε «Έλεγχος λύσης».'
        ],
        quiz: {
          question: 'Πρόσθεσες Light::Stop στο enum. Τι κάνει ο compiler στα match που δεν το έχουν (χωρίς _);',
          options: ['Βγάζει error[E0004] σε καθένα, για να μην ξεχάσεις κανένα', 'Τίποτα: το Stop απλώς αγνοείται', 'Το μετατρέπει σε Red'],
          answer: 0,
          explain: 'Σωστά. Ο compiler κρατά λίστα με όλες τις περιπτώσεις και ελέγχει κάθε match.',
          retry: 'Όχι ακόμα. Θυμήσου το error[E0004] με το Mode::Blink.'
        },
        hints: [
          'Τρία κομμάτια: το enum (νέα κατάσταση), η light_for (νέο σκέλος) και τα φώτα (νέο σκέλος με toggle). Και ένα τέταρτο: το last.',
          `Light::Stop => { ${B.w('red', 'toggle')} ${B.w('yellow', 'set_low')} ${B.w('green', 'set_low')} }. Το last δηλώνεται πριν από το loop.`,
          'let mut last: Option<Light> = None;\nloop {\n    let light = …;\n    if Some(light) != last {\n        println!("Light: {:?}", light);\n        last = Some(light);\n    }\n    match light { … Light::Stop => { … } }\n}'
        ],
        validationTests: [
          { name: 'Το αυτοκίνητο πλησιάζει: τυπώνει μόνο τις αλλαγές', world: { distance: 80 }, script: [
            { setup: true },
            { sequence: { distance: [80, 80, 35, 35, 15, 15] } },
            { check: 'count', text: 'Light: Green', is: 1, fail: 'Το «Light: Green» τυπώθηκε {n} φορές. Περίμενα 1: μόνο όταν αλλάζει το φως.' },
            { check: 'count', text: 'Light: Yellow', is: 1, fail: 'Το «Light: Yellow» τυπώθηκε {n} φορές. Περίμενα 1.' },
            { check: 'count', text: 'Light: Red', is: 1, fail: 'Το «Light: Red» τυπώθηκε {n} φορές. Περίμενα 1.' },
            lt(true, false, false, '15 cm', 'κόκκινο')
          ] },
          { name: 'Κάτω από 10 cm: Stop, το κόκκινο αναβοσβήνει', world: { distance: 5 }, script: [
            { setup: true }, { loops: 1 },
            { check: 'lastLine', is: 'Light: Stop', fail: 'Στα 5 cm η τελευταία γραμμή είναι {v}. Περίμενα «Light: Stop».' },
            lt(true, false, false, '5 cm (1ος γύρος)', 'κόκκινο'),
            { loops: 1 },
            lt(false, false, false, '5 cm (2ος γύρος)', 'σβηστά όλα: το κόκκινο αναβοσβήνει'),
            { loops: 1 },
            lt(true, false, false, '5 cm (3ος γύρος)', 'κόκκινο'),
            { check: 'count', text: 'Light: Stop', is: 1, fail: 'Το «Light: Stop» τυπώθηκε {n} φορές σε 3 γύρους. Περίμενα 1.' }
          ] },
          { name: 'Καμία ηχώ → κίτρινο', world: { distance: 500 }, script: [
            { setup: true }, { loops: 2 },
            lt(false, true, false, '500 cm (καμία ηχώ)', 'κίτρινο')
          ] }
        ],
        explanationOnSuccess: 'Έλεγχος κεφαλαίου: πέτυχε! Μέτρηση με όρια χρόνου, Option αντί για ψεύτικο 0, enum με match που δεν ξεχνά τίποτα, και κατάσταση που θυμάται. Ένας πραγματικός αισθητήρας στάθμευσης σε Rust.',
        remediation: 'Αν το κόκκινο δεν αναβοσβήνει, μήπως γράφεις set_high αντί για toggle στο Stop;'
      }
    ];
  });
})(typeof window !== 'undefined' ? window : globalThis);
