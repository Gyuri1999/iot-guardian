/*
 * IoT Guardian — Διαδρομή Rust, κεφάλαιο 47 (επιπλέον, μόνο Raspberry Pi): Ήχος, κίνηση, χρώμα και οθόνη.
 * PWM λογισμικού του rppal (set_pwm_frequency, set_pwm, clear_pwm) για buzzer, servo και LED RGB,
 * και οθόνη OLED με rppal::i2c + ssd1306 + embedded-graphics.
 * Ανοίγει μετά το κεφάλαιο 2 της Rust στο Pi (42: συνθήκες, βρόχοι και συναρτήσεις).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  const K = L.RustKit;
  const N = 47;
  L.CHAPTERS.push({ n: N, title: 'Ήχος, κίνηση, χρώμα και οθόνη στη Rust', ready: true, bonus: true, track: 'rs-pi', lang: 'rust', board: 'pi', unlockAfter: 42 });

  K.addGlossary([
    { term: 'PWM', def: 'Το pin ανάβει και σβήνει πάρα πολύ γρήγορα. Όσο περισσότερη ώρα μένει αναμμένο, τόσο πιο φωτεινό φαίνεται ένα LED.' },
    { term: 'duty cycle', def: 'Πόσο από τον χρόνο μένει αναμμένο ένα pin με PWM, από 0.0 (ποτέ) έως 1.0 (πάντα). Στο rppal: set_pwm_frequency(συχνότητα, duty).' },
    { term: 'buzzer', def: 'Μικρό ηχείο που βγάζει ήχο όταν ένα κομματάκι μέταλλο μέσα του τρέμει γρήγορα.' },
    { term: 'servo', def: 'Κινητήρας που γυρίζει σε ακριβή γωνία από 0 έως 180 μοίρες, ανάλογα με το μήκος ενός παλμού (0,5 έως 2,5 ms, 50 φορές το δευτερόλεπτο).' },
    { term: 'LED RGB', def: 'Τρία LED σε ένα: κόκκινο (Red), πράσινο (Green), μπλε (Blue). Ανακατεύοντάς τα φτιάχνεις σχεδόν κάθε χρώμα.' },
    { term: 'OLED', def: 'Μικρή οθόνη όπου κάθε κουκκίδα φωτίζει μόνη της. Η δική μας έχει 128 × 64 κουκκίδες.' },
    { term: 'I2C', def: 'Τρόπος επικοινωνίας με δύο καλώδια: SDA (δεδομένα) και SCL (ρολόι). Πολλές συσκευές μπορούν να μοιράζονται τα ίδια δύο καλώδια.' },
    { term: 'embedded-graphics', def: 'Crate της Rust για να ζωγραφίζεις σε μικρές οθόνες: κείμενο (Text), γραμματοσειρές (FONT_6X10) και σχήματα.' }
  ]);

  const PANELS = ['serial', 'vars', 'loops'];
  const TS = (name, script, world) => ({ name, world, script });
  const SYN_PWM = 'gpio.get(22)?.into_output(), .set_pwm_frequency(Hz: f64, duty: f64)?, .clear_pwm()?, .set_pwm(Duration::from_millis(20), Duration::from_micros(µs))?, button.is_high(), loop, if / else, fn με &mut OutputPin';
  const SYN_OLED = 'I2c::new()?, I2CDisplayInterface::new(i2c), Ssd1306::new(…).into_buffered_graphics_mode(), display.init().unwrap(), MonoTextStyleBuilder::new().font(&FONT_6X10).text_color(BinaryColor::On).build(), Text::with_baseline("…", Point::new(x, y), style, Baseline::Top).draw(&mut display).unwrap(), display.clear_buffer(), display.flush().unwrap(), format!';
  const USES = 'use rppal::gpio::Gpio;\nuse std::error::Error;\nuse std::thread;\nuse std::time::Duration;';

  // ------------------------------------------------------------ 1. Κουδούνι
  const BELL_OK = `// Το κουδούνι της εισόδου: όσο είναι πατημένο το κουμπί, το buzzer παίζει 880 Hz.
${USES}

fn main() -> Result<(), Box<dyn Error>> {
    let gpio = Gpio::new()?;
    let button = gpio.get(27)?.into_input();
    let mut buzzer = gpio.get(22)?.into_output();   // το buzzer είναι στο GPIO 22

    loop {
        if button.is_high() {
            buzzer.set_pwm_frequency(880.0, 0.5)?;  // 880 Hz, μισό-μισό: ακούγεται
        } else {
            buzzer.clear_pwm()?;                    // σιωπή
        }
        thread::sleep(Duration::from_millis(20));
    }
}
`;
  const BELL_START = BELL_OK.replace('            buzzer.set_pwm_frequency(880.0, 0.5)?;  // 880 Hz, μισό-μισό: ακούγεται\n', '            // ΣΥΜΠΛΗΡΩΣΕ: ήχος 880 Hz με duty 0.5\n').replace('            buzzer.clear_pwm()?;                    // σιωπή\n', '            // ΣΥΜΠΛΗΡΩΣΕ: σιωπή\n');

  // ------------------------------------------------------------ 2. Πόρτα με servo
  const DOOR_OK = `// Η πόρτα του γκαράζ: με πατημένο το κουμπί ανοίγει (90°), αλλιώς κλείνει (0°).
use rppal::gpio::{Gpio, OutputPin};
use std::error::Error;
use std::thread;
use std::time::Duration;

// Γωνία 0–180° → παλμός 500–2500 µs, κάθε 20 ms
fn angle(servo: &mut OutputPin, deg: u64) -> Result<(), Box<dyn Error>> {
    let pulse = 500 + deg * 2000 / 180;
    servo.set_pwm(Duration::from_millis(20), Duration::from_micros(pulse))?;
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let gpio = Gpio::new()?;
    let button = gpio.get(27)?.into_input();
    let mut servo = gpio.get(18)?.into_output();   // το servo είναι στο GPIO 18

    loop {
        if button.is_high() {
            angle(&mut servo, 90)?;   // ανοιχτή
        } else {
            angle(&mut servo, 0)?;    // κλειστή
        }
        thread::sleep(Duration::from_millis(20));
    }
}
`;
  const DOOR_START = DOOR_OK.replace('            angle(&mut servo, 90)?;   // ανοιχτή\n', '            // ΣΥΜΠΛΗΡΩΣΕ: άνοιξε την πόρτα (90°)\n');

  // ------------------------------------------------------------ 3. Φως του σπιτιού RGB
  const RGB_OK = `// Φως του σπιτιού: κόκκινο αν υπάρχει κίνηση, μπλε όταν χτυπά το κουδούνι,
// αλλιώς ένα απαλό πράσινο. Κάθε χρώμα είναι ένα duty από 0.0 έως 1.0.
use rppal::gpio::{Gpio, OutputPin};
use std::error::Error;
use std::thread;
use std::time::Duration;

fn color(red: &mut OutputPin, green: &mut OutputPin, blue: &mut OutputPin, r: f64, g: f64, b: f64) -> Result<(), Box<dyn Error>> {
    red.set_pwm_frequency(100.0, r)?;
    green.set_pwm_frequency(100.0, g)?;
    blue.set_pwm_frequency(100.0, b)?;
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let gpio = Gpio::new()?;
    let button = gpio.get(27)?.into_input();
    let pir = gpio.get(4)?.into_input();
    let mut red = gpio.get(5)?.into_output();
    let mut green = gpio.get(6)?.into_output();
    let mut blue = gpio.get(13)?.into_output();

    loop {
        if pir.is_high() {
            color(&mut red, &mut green, &mut blue, 1.0, 0.0, 0.0)?;   // κόκκινο
        } else if button.is_high() {
            color(&mut red, &mut green, &mut blue, 0.0, 0.0, 1.0)?;   // μπλε
        } else {
            color(&mut red, &mut green, &mut blue, 0.0, 0.2, 0.0)?;   // απαλό πράσινο
        }
        thread::sleep(Duration::from_millis(50));
    }
}
`;
  const RGB_START = RGB_OK.replace(`        } else if button.is_high() {
            color(&mut red, &mut green, &mut blue, 0.0, 0.0, 1.0)?;   // μπλε
        } else {
            color(&mut red, &mut green, &mut blue, 0.0, 0.2, 0.0)?;   // απαλό πράσινο
        }`, `        }
        // ΣΥΜΠΛΗΡΩΣΕ: μπλε (0.0, 0.0, 1.0) αν πατηθεί το κουμπί, αλλιώς απαλό πράσινο (0.0, 0.2, 0.0)`);

  // ------------------------------------------------------------ 4. Οθόνη: μετρητής επισκεπτών
  const OLED_OK = `// Μετρητής επισκεπτών: κάθε πάτημα του κουδουνιού μετράει, και η οθόνη δείχνει πόσοι ήρθαν.
use rppal::gpio::Gpio;
use rppal::i2c::I2c;
use ssd1306::{prelude::*, I2CDisplayInterface, Ssd1306};
use embedded_graphics::{
    mono_font::{ascii::{FONT_10X20, FONT_6X10}, MonoTextStyleBuilder},
    pixelcolor::BinaryColor,
    prelude::*,
    text::{Baseline, Text},
};
use std::error::Error;
use std::thread;
use std::time::Duration;

fn main() -> Result<(), Box<dyn Error>> {
    let gpio = Gpio::new()?;
    let button = gpio.get(27)?.into_input();

    // Η οθόνη: I2C (SDA = GPIO 2, SCL = GPIO 3) → interface → οθόνη με buffer
    let i2c = I2c::new()?;
    let interface = I2CDisplayInterface::new(i2c);
    let mut display = Ssd1306::new(interface, DisplaySize128x64, DisplayRotation::Rotate0)
        .into_buffered_graphics_mode();
    display.init().unwrap();

    let small = MonoTextStyleBuilder::new().font(&FONT_6X10).text_color(BinaryColor::On).build();
    let big = MonoTextStyleBuilder::new().font(&FONT_10X20).text_color(BinaryColor::On).build();

    let mut count: u32 = 0;
    let mut was_pressed = false;
    loop {
        let pressed = button.is_high();
        if pressed && !was_pressed {        // μόλις πατήθηκε (όχι όσο μένει πατημένο)
            count += 1;
        }
        was_pressed = pressed;

        display.clear_buffer();             // σβήσε την προηγούμενη εικόνα
        Text::with_baseline("Visitors:", Point::new(0, 0), small, Baseline::Top).draw(&mut display).unwrap();
        let msg = format!("{}", count);
        Text::with_baseline(&msg, Point::new(0, 20), big, Baseline::Top).draw(&mut display).unwrap();
        display.flush().unwrap();           // ΤΩΡΑ στείλε την εικόνα στην οθόνη

        thread::sleep(Duration::from_millis(50));
    }
}
`;
  const OLED_BUG = OLED_OK.replace('        display.flush().unwrap();           // ΤΩΡΑ στείλε την εικόνα στην οθόνη\n', '');

  const lessons = [
    {
      kind: 'micro', skills: ['rust', 'io', 'conditions'],
      title: 'Το κουδούνι: PWM στο buzzer',
      objectives: ['Να βγάζω ήχο με set_pwm_frequency().', 'Να σταματώ τον ήχο με clear_pwm().'],
      theory: `
<p>Το <strong>buzzer</strong> βγάζει ήχο όταν το pin του ανάβει και σβήνει πολύ γρήγορα. Αυτό είναι το <strong>PWM</strong>. Στο rppal κάθε <code>OutputPin</code> το ξέρει:</p>
<ul><li><code>buzzer.set_pwm_frequency(880.0, 0.5)?;</code>: 880 φορές το δευτερόλεπτο (Hz), μισό αναμμένο, μισό σβηστό (<strong>duty</strong> 0.5).</li>
<li><code>buzzer.clear_pwm()?;</code>: σταματά το PWM, άρα και τον ήχο.</li></ul>
<p>Προσοχή: η συχνότητα και το duty είναι <code>f64</code>. Γράφεις <code>880.0</code>, όχι <code>880</code>: η Rust δεν μετατρέπει μόνη της ακέραιο σε δεκαδικό.</p>
<p>Και οι δύο εντολές μπορεί να αποτύχουν, γι' αυτό επιστρέφουν <code>Result</code> και τελειώνουν με <code>?</code>.</p>`,
      glossary: ['PWM', 'duty cycle', 'buzzer'], supportedSyntax: SYN_PWM,
      initialCode: BELL_START, solution: BELL_OK,
      world: { button: false }, hardware: ['button', 'buzzer'], panels: PANELS,
      steps: ['Στο if, γράψε buzzer.set_pwm_frequency(880.0, 0.5)?;', 'Στο else, γράψε buzzer.clear_pwm()?;', 'Τρέξε και πάτα το κουμπί στη σκηνή.'],
      quiz: { question: 'Τι λέει η Rust για το set_pwm_frequency(880, 0.5);', options: ['error[E0308]: περιμένει f64 και βρήκε ακέραιο', 'Τίποτα, παίζει 880 Hz', 'Παίζει 88 Hz'], answer: 0, explain: 'Σωστά. Η Rust δεν αλλάζει μόνη της τον τύπο: γράφεις 880.0.', retry: 'Τι τύπου είναι το 880 και τι τύπου το 880.0;' },
      hints: ['Ο ήχος ξεκινά με set_pwm_frequency και σταματά με clear_pwm.', 'Η συχνότητα και το duty είναι δεκαδικοί: 880.0 και 0.5.', 'if: buzzer.set_pwm_frequency(880.0, 0.5)?;   else: buzzer.clear_pwm()?;'],
      validationTests: [
        TS('Χωρίς πάτημα → σιωπή', [{ setup: true }, { loops: 1 }, { check: 'buzzer', is: false, fail: 'Χωρίς πατημένο κουμπί το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → 880 Hz', [{ setup: true }, { sequence: { button: [1] } }, { check: 'buzzer', is: true, freq: 880, fail: 'Με πατημένο κουμπί περίμενα ήχο 880 Hz. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → σιωπή', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'buzzer', is: false, fail: 'Όταν αφήνεις το κουμπί ο ήχος πρέπει να σταματά (clear_pwm). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Το κουδούνι δουλεύει! Η συχνότητα λέει ποια νότα, το duty αν ακούγεται.',
      remediation: 'Στο if βάλε buzzer.set_pwm_frequency(880.0, 0.5)?; και στο else buzzer.clear_pwm()?;'
    },
    {
      kind: 'guided', skills: ['rust', 'io', 'timing'],
      title: 'Η πόρτα του γκαράζ: servo με set_pwm',
      objectives: ['Να ελέγχω servo με παλμό κάθε 20 ms.', 'Να μετατρέπω γωνία σε μήκος παλμού μέσα σε μια συνάρτηση.'],
      theory: `
<p>Το <strong>servo</strong> δέχεται έναν παλμό κάθε <strong>20 ms</strong>. Το <strong>μήκος</strong> του παλμού λέει τη γωνία:</p>
<ul><li>500 µs → 0° · 1500 µs → 90° · 2500 µs → 180°</li></ul>
<p>Στο rppal: <code>servo.set_pwm(Duration::from_millis(20), Duration::from_micros(1500))?;</code>: περίοδος 20 ms, παλμός 1500 µs.</p>
<p>Η συνάρτηση <code>angle(&amp;mut servo, 90)</code> κάνει τον λογαριασμό για σένα: <code>500 + 90 × 2000 / 180 = 1500</code>. Παίρνει το servo με <code>&amp;mut</code>: το δανείζεται για να το αλλάξει, χωρίς να το κρατήσει.</p>`,
      glossary: ['servo', 'PWM'], supportedSyntax: SYN_PWM,
      initialCode: DOOR_START, solution: DOOR_OK,
      world: { button: false }, hardware: ['button', 'servo'], panels: PANELS,
      steps: ['Η angle() είναι έτοιμη. Διάβασέ την.', 'Στο if, γράψε angle(&mut servo, 90)?;', 'Τρέξε και πάτα το κουμπί: δες το μπράτσο να γυρίζει.'],
      quiz: { question: 'Τι μήκος παλμού δίνει η angle() για 180°;', options: ['2500 µs', '1800 µs', '20 ms'], answer: 0, explain: 'Σωστά: 500 + 180 × 2000 / 180 = 2500.', retry: 'Βάλε 180 στον τύπο: 500 + deg × 2000 / 180.' },
      hints: ['Η ανοιχτή πόρτα είναι στις 90 μοίρες.', 'Το servo δίνεται δανεικό με &mut servo.', 'angle(&mut servo, 90)?;'],
      validationTests: [
        TS('Στην αρχή η πόρτα είναι κλειστή (0°)', [{ setup: true }, { loops: 1 }, { check: 'servo', angle: 0, fail: 'Χωρίς πάτημα περίμενα το servo στις 0°. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → η πόρτα ανοίγει (90°)', [{ setup: true }, { sequence: { button: [1] } }, { check: 'servo', angle: 90, fail: 'Με πατημένο κουμπί περίμενα το servo στις 90°. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → κλείνει', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'servo', angle: 0, fail: 'Όταν αφήνεις το κουμπί η πόρτα πρέπει να κλείνει (0°). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Η πόρτα ανοίγει και κλείνει! Ο servo καταλαβαίνει μόνο μήκος παλμού· η angle() το μεταφράζει από μοίρες.',
      remediation: 'Με πατημένο κουμπί κάλεσε angle(&mut servo, 90)?;'
    },
    {
      kind: 'guided', skills: ['rust', 'conditions', 'io'],
      title: 'Το φως του σπιτιού: LED RGB',
      objectives: ['Να ανακατεύω χρώματα με τρία PWM.', 'Να δανείζω πολλά pins σε μια συνάρτηση με &mut.'],
      theory: `
<p>Το <strong>LED RGB</strong> έχει μέσα τρία LED: κόκκινο (GPIO 5), πράσινο (GPIO 6), μπλε (GPIO 13). Το <strong>duty</strong> του καθενός λέει πόσο ανάβει: 0.0 = σβηστό, 1.0 = όσο πιο πολύ γίνεται.</p>
<ul><li>(1.0, 0.0, 0.0) = κόκκινο · (0.0, 0.0, 1.0) = μπλε · (1.0, 1.0, 0.0) = κίτρινο</li></ul>
<p>Η <code>color()</code> παίρνει δανεικά και τα τρία pins (<code>&amp;mut</code>) και τα τρία duty.</p>`,
      glossary: ['LED RGB', 'duty cycle', 'PWM'], supportedSyntax: SYN_PWM,
      initialCode: RGB_START, solution: RGB_OK,
      world: { button: false, pir: false }, hardware: ['rgb', 'button', 'pir'], panels: PANELS,
      steps: ['Μετά το if, πρόσθεσε else if button.is_high() { … } με μπλε.', 'Πρόσθεσε else { … } με απαλό πράσινο (0.0, 0.2, 0.0).', 'Τρέξε, πάτα το κουμπί και κάνε κίνηση στη σκηνή.'],
      quiz: { question: 'Γιατί η color() παίρνει &mut red και όχι σκέτο red;', options: ['Για να το δανειστεί και να το αλλάξει, και μετά να ξαναγυρίσει στη main', 'Γιατί είναι πιο γρήγορο', 'Γιατί το &mut σβήνει το LED'], answer: 0, explain: 'Σωστά. Με σκέτο red η main θα έχανε το pin μετά την πρώτη κλήση (move).', retry: 'Τι γίνεται με μια τιμή που δίνεις σε συνάρτηση χωρίς &;' },
      hints: ['Χρειάζεσαι else if και else.', 'Μπλε = 0.0, 0.0, 1.0 · απαλό πράσινο = 0.0, 0.2, 0.0.', '} else if button.is_high() {\n    color(&mut red, &mut green, &mut blue, 0.0, 0.0, 1.0)?;\n} else {\n    color(&mut red, &mut green, &mut blue, 0.0, 0.2, 0.0)?;\n}'],
      validationTests: [
        TS('Ησυχία → απαλό πράσινο', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 0, g: 51, b: 0, fail: 'Χωρίς κίνηση και κουμπί περίμενα απαλό πράσινο (0.0, 0.2, 0.0). Τώρα: {v}.' }], { button: false, pir: false }),
        TS('Κουμπί → μπλε', [{ setup: true }, { sequence: { button: [1] } }, { check: 'rgb', r: 0, g: 0, b: 255, fail: 'Με πατημένο κουμπί περίμενα μπλε. Τώρα: {v}.' }], { button: false, pir: false }),
        TS('Κίνηση → κόκκινο', [{ setup: true }, { sequence: { pir: [1] } }, { check: 'rgb', r: 255, g: 0, b: 0, fail: 'Με κίνηση περίμενα κόκκινο. Τώρα: {v}.' }], { button: false, pir: false })
      ],
      explanationOnSuccess: 'Το φως δείχνει τι γίνεται στο σπίτι! Τρία PWM, άπειρα χρώματα, και ο δανεισμός κρατά τα pins στη main.',
      remediation: 'Χρειάζονται τρεις περιπτώσεις: κίνηση κόκκινο, κουμπί μπλε, αλλιώς απαλό πράσινο.'
    },
    {
      kind: 'debug', skills: ['rust', 'state', 'syntax'],
      title: 'Βρες το λάθος: ο μετρητής δεν φαίνεται',
      objectives: ['Να γράφω στην οθόνη OLED με ssd1306 και embedded-graphics.', 'Να καταλάβω ότι η οθόνη ενημερώνεται μόνο με flush().'],
      theory: `
<p>Η οθόνη <strong>OLED</strong> συνδέεται με <strong>I2C</strong> (SDA = GPIO 2, SCL = GPIO 3). Στη Rust τη στήνεις σε τρία βήματα: <code>I2c::new()?</code> → <code>I2CDisplayInterface::new(i2c)</code> → <code>Ssd1306::new(…).into_buffered_graphics_mode()</code>.</p>
<p>Για να γράψεις, το <strong>embedded-graphics</strong> θέλει ένα <strong>στυλ</strong> (γραμματοσειρά και χρώμα) και ένα <code>Text</code> σε μια θέση <code>Point::new(x, y)</code>:</p>
<pre>Text::with_baseline("Visitors:", Point::new(0, 0), small, Baseline::Top)
    .draw(&amp;mut display).unwrap();</pre>
<p>Το <code>draw</code> ζωγραφίζει σε μια μνήμη (buffer). Η οθόνη αλλάζει μόνο με <code>display.flush()</code>. Κάποιος το ξέχασε…</p>
<p>Γιατί <code>.unwrap()</code> και όχι <code>?</code>; Τα λάθη της οθόνης (<code>DisplayError</code>) δεν μετατρέπονται σε <code>Box&lt;dyn Error&gt;</code>. Σε πραγματικό έργο θα τα χειριζόσουν με <code>map_err</code>.</p>`,
      glossary: ['OLED', 'I2C', 'embedded-graphics'], supportedSyntax: SYN_OLED,
      initialCode: OLED_BUG, solution: OLED_OK,
      world: { button: false }, hardware: ['oled', 'button'], panels: PANELS,
      steps: ['Τρέξε: η οθόνη στη σκηνή μένει μαύρη.', 'Βρες τι λείπει μετά τα draw().', 'Πρόσθεσέ το, ξανατρέξε και πάτα το κουμπί μερικές φορές.'],
      quiz: { question: 'Γιατί η οθόνη έμενε άδεια;', options: ['Το draw ζωγραφίζει στο buffer· η οθόνη ενημερώνεται μόνο με display.flush()', 'Το Text δεν δέχεται αριθμούς', 'Το clear_buffer σβήνει μόνιμα την οθόνη'], answer: 0, explain: 'Σωστά. Πρώτα ζωγραφίζεις όλη την εικόνα στη μνήμη και μετά τη στέλνεις μαζί: έτσι δεν τρεμοπαίζει.', retry: 'Τι κάνει το display.flush();' },
      hints: ['Η οθόνη ενημερώνεται μόνο με μία συγκεκριμένη εντολή της display.', 'Κοίτα την τελευταία παράγραφο του «Μαθήματος».', 'Πρόσθεσε display.flush().unwrap(); μετά το δεύτερο draw.'],
      validationTests: [
        TS('Στην αρχή η οθόνη δείχνει 0', [{ setup: true }, { loops: 1 }, { check: 'oled', has: 'Visitors: 0', fail: 'Στην οθόνη περίμενα «Visitors: 0». Βλέπω: {v}.' }], { button: false }),
        TS('Δύο πατήματα → 2', [{ setup: true }, { sequence: { button: [1, 0, 1, 0] } }, { check: 'oled', has: 'Visitors: 2', fail: 'Μετά από δύο πατήματα περίμενα «Visitors: 2». Βλέπω: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Ο μετρητής φαίνεται! clear_buffer, draw, και στο τέλος flush().',
      remediation: 'Λείπει το display.flush().unwrap(); μετά τα draw().'
    }
  ];

  lessons.forEach((l, i) => {
    const world = l.world || {};
    L.lessons.push(Object.assign({
      id: `c${N}-l${i + 1}`, chapter: N, lang: 'rust', board: 'pi',
      prerequisites: i === 0 ? [] : [`c${N}-l${i}`]
    }, l, { world, initialWorld: world }));
  });
})(typeof window !== 'undefined' ? window : globalThis);
