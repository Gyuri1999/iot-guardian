/*
 * IoT Guardian — Διαδρομή Rust, κεφάλαιο 57 (επιπλέον, μόνο ESP32): Ήχος, κίνηση, χρώμα και οθόνη.
 * PWM με το LEDC του ESP32 (LedcTimerDriver + LedcDriver) για buzzer, servo και LED RGB,
 * και οθόνη OLED με I2cDriver + ssd1306 + embedded-graphics.
 * Ανοίγει μετά το κεφάλαιο 2 της Rust στο ESP32 (52: συνθήκες, βρόχοι και συναρτήσεις).
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  const K = L.RustKit;
  const N = 57;
  L.CHAPTERS.push({ n: N, title: 'Ήχος, κίνηση, χρώμα και οθόνη στη Rust', ready: true, bonus: true, track: 'rs-esp32', lang: 'rust', board: 'esp32', unlockAfter: 52 });

  K.addGlossary([
    { term: 'LEDC', def: 'Το «κομμάτι» του ESP32 που φτιάχνει PWM. Έχει timers (δίνουν τη συχνότητα) και κανάλια (το καθένα οδηγεί ένα pin με το δικό του duty).' },
    { term: 'duty cycle', def: 'Πόσο από τον χρόνο μένει αναμμένο ένα pin με PWM. Στο LEDC πάει από 0 έως get_max_duty() (255 με 8 bits, 16383 με 14 bits).' },
    { term: 'PWM', def: 'Το pin ανάβει και σβήνει πάρα πολύ γρήγορα. Όσο περισσότερη ώρα μένει αναμμένο, τόσο πιο φωτεινό φαίνεται ένα LED.' },
    { term: 'buzzer', def: 'Μικρό ηχείο που βγάζει ήχο όταν ένα κομματάκι μέταλλο μέσα του τρέμει γρήγορα.' },
    { term: 'servo', def: 'Κινητήρας που γυρίζει σε ακριβή γωνία από 0 έως 180 μοίρες, ανάλογα με το μήκος ενός παλμού (0,5 έως 2,5 ms, 50 φορές το δευτερόλεπτο).' },
    { term: 'LED RGB', def: 'Τρία LED σε ένα: κόκκινο (Red), πράσινο (Green), μπλε (Blue). Ανακατεύοντάς τα φτιάχνεις σχεδόν κάθε χρώμα.' },
    { term: 'OLED', def: 'Μικρή οθόνη όπου κάθε κουκκίδα φωτίζει μόνη της. Η δική μας έχει 128 × 64 κουκκίδες.' },
    { term: 'I2C', def: 'Τρόπος επικοινωνίας με δύο καλώδια: SDA (δεδομένα) και SCL (ρολόι). Πολλές συσκευές μπορούν να μοιράζονται τα ίδια δύο καλώδια.' },
    { term: 'embedded-graphics', def: 'Crate της Rust για να ζωγραφίζεις σε μικρές οθόνες: κείμενο (Text), γραμματοσειρές (FONT_6X10) και σχήματα.' }
  ]);

  const PANELS = ['serial', 'vars', 'loops'];
  const TS = (name, script, world) => ({ name, world, script });
  const SYN_PWM = 'LedcTimerDriver::new(peripherals.ledc.timer0, &TimerConfig::new().frequency(Hertz(880)))?, LedcDriver::new(peripherals.ledc.channel0, &timer, peripherals.pins.gpio23)?, .get_max_duty(), .set_duty(…)?, .resolution(Resolution::Bits14), PinDriver::input, loop, if / else, fn με &mut LedcDriver';
  const SYN_OLED = 'I2cDriver::new(peripherals.i2c0, peripherals.pins.gpio21, peripherals.pins.gpio22, &I2cConfig::new().baudrate(Hertz(400_000)))?, I2CDisplayInterface::new(i2c), Ssd1306::new(…).into_buffered_graphics_mode(), display.init().unwrap(), MonoTextStyleBuilder, Text::with_baseline(…).draw(&mut display).unwrap(), display.clear_buffer(), display.flush().unwrap(), format!';
  const HEAD = 'fn main() -> anyhow::Result<()> {\n    esp_idf_svc::sys::link_patches();\n    let peripherals = Peripherals::take()?;';

  // ------------------------------------------------------------ 1. Κουδούνι
  const BELL_OK = `// Το κουδούνι της εισόδου: όσο είναι πατημένο το κουμπί, το buzzer παίζει 880 Hz.
use esp_idf_svc::hal::delay::FreeRtos;
use esp_idf_svc::hal::gpio::PinDriver;
use esp_idf_svc::hal::ledc::{config::TimerConfig, LedcDriver, LedcTimerDriver};
use esp_idf_svc::hal::peripherals::Peripherals;
use esp_idf_svc::hal::units::Hertz;

${HEAD}
    let button = PinDriver::input(peripherals.pins.gpio15)?;

    // timer: 880 Hz · κανάλι: οδηγεί το GPIO 23 (buzzer)
    let timer = LedcTimerDriver::new(peripherals.ledc.timer0, &TimerConfig::new().frequency(Hertz(880)))?;
    let mut buzzer = LedcDriver::new(peripherals.ledc.channel0, &timer, peripherals.pins.gpio23)?;
    let max = buzzer.get_max_duty();

    loop {
        if button.is_high() {
            buzzer.set_duty(max / 2)?;   // μισό-μισό: ακούγεται
        } else {
            buzzer.set_duty(0)?;         // 0: σιωπή
        }
        FreeRtos::delay_ms(20);
    }
}
`;
  const BELL_START = BELL_OK.replace('            buzzer.set_duty(max / 2)?;   // μισό-μισό: ακούγεται\n', '            // ΣΥΜΠΛΗΡΩΣΕ: ήχος (duty στο μισό του max)\n').replace('            buzzer.set_duty(0)?;         // 0: σιωπή\n', '            // ΣΥΜΠΛΗΡΩΣΕ: σιωπή (duty 0)\n');

  // ------------------------------------------------------------ 2. Πόρτα με servo
  const DOOR_OK = `// Η πόρτα του γκαράζ: με πατημένο το κουμπί ανοίγει (90°), αλλιώς κλείνει (0°).
use esp_idf_svc::hal::delay::FreeRtos;
use esp_idf_svc::hal::gpio::PinDriver;
use esp_idf_svc::hal::ledc::{config::TimerConfig, LedcDriver, LedcTimerDriver, Resolution};
use esp_idf_svc::hal::peripherals::Peripherals;
use esp_idf_svc::hal::units::Hertz;

// Γωνία 0–180° → παλμός 500–2500 µs μέσα σε περίοδο 20 000 µs (50 Hz)
fn angle(servo: &mut LedcDriver, deg: u32) -> anyhow::Result<()> {
    let max = servo.get_max_duty();          // 16383 με 14 bits
    let pulse_us = 500 + deg * 2000 / 180;
    servo.set_duty(max * pulse_us / 20000)?;
    Ok(())
}

${HEAD}
    let button = PinDriver::input(peripherals.pins.gpio15)?;

    // Το servo θέλει 50 Hz και μεγάλη ακρίβεια (14 bits)
    let config = TimerConfig::new().frequency(Hertz(50)).resolution(Resolution::Bits14);
    let timer = LedcTimerDriver::new(peripherals.ledc.timer0, &config)?;
    let mut servo = LedcDriver::new(peripherals.ledc.channel0, &timer, peripherals.pins.gpio19)?;

    loop {
        if button.is_high() {
            angle(&mut servo, 90)?;   // ανοιχτή
        } else {
            angle(&mut servo, 0)?;    // κλειστή
        }
        FreeRtos::delay_ms(20);
    }
}
`;
  const DOOR_START = DOOR_OK.replace('            angle(&mut servo, 90)?;   // ανοιχτή\n', '            // ΣΥΜΠΛΗΡΩΣΕ: άνοιξε την πόρτα (90°)\n');

  // ------------------------------------------------------------ 3. Φως του σπιτιού RGB
  const RGB_OK = `// Φως του σπιτιού: κόκκινο αν υπάρχει κίνηση, μπλε όταν χτυπά το κουδούνι,
// αλλιώς ένα απαλό πράσινο. Με 8 bits το duty πάει από 0 έως 255, όπως στη C++.
use esp_idf_svc::hal::delay::FreeRtos;
use esp_idf_svc::hal::gpio::PinDriver;
use esp_idf_svc::hal::ledc::{config::TimerConfig, LedcDriver, LedcTimerDriver};
use esp_idf_svc::hal::peripherals::Peripherals;

fn color(red: &mut LedcDriver, green: &mut LedcDriver, blue: &mut LedcDriver, r: u32, g: u32, b: u32) -> anyhow::Result<()> {
    red.set_duty(r)?;
    green.set_duty(g)?;
    blue.set_duty(b)?;
    Ok(())
}

${HEAD}
    let button = PinDriver::input(peripherals.pins.gpio15)?;
    let pir = PinDriver::input(peripherals.pins.gpio4)?;

    // Ένας timer (1000 Hz, 8 bits) για τρία κανάλια
    let timer = LedcTimerDriver::new(peripherals.ledc.timer0, &TimerConfig::new())?;
    let mut red = LedcDriver::new(peripherals.ledc.channel0, &timer, peripherals.pins.gpio32)?;
    let mut green = LedcDriver::new(peripherals.ledc.channel1, &timer, peripherals.pins.gpio33)?;
    let mut blue = LedcDriver::new(peripherals.ledc.channel2, &timer, peripherals.pins.gpio14)?;

    loop {
        if pir.is_high() {
            color(&mut red, &mut green, &mut blue, 255, 0, 0)?;   // κόκκινο
        } else if button.is_high() {
            color(&mut red, &mut green, &mut blue, 0, 0, 255)?;   // μπλε
        } else {
            color(&mut red, &mut green, &mut blue, 0, 51, 0)?;    // απαλό πράσινο
        }
        FreeRtos::delay_ms(50);
    }
}
`;
  const RGB_START = RGB_OK.replace(`        } else if button.is_high() {
            color(&mut red, &mut green, &mut blue, 0, 0, 255)?;   // μπλε
        } else {
            color(&mut red, &mut green, &mut blue, 0, 51, 0)?;    // απαλό πράσινο
        }`, `        }
        // ΣΥΜΠΛΗΡΩΣΕ: μπλε (0, 0, 255) αν πατηθεί το κουμπί, αλλιώς απαλό πράσινο (0, 51, 0)`);

  // ------------------------------------------------------------ 4. Οθόνη: μετρητής επισκεπτών
  const OLED_OK = `// Μετρητής επισκεπτών: κάθε πάτημα του κουδουνιού μετράει, και η οθόνη δείχνει πόσοι ήρθαν.
use esp_idf_svc::hal::delay::FreeRtos;
use esp_idf_svc::hal::gpio::PinDriver;
use esp_idf_svc::hal::i2c::{I2cConfig, I2cDriver};
use esp_idf_svc::hal::peripherals::Peripherals;
use esp_idf_svc::hal::units::Hertz;
use ssd1306::{prelude::*, I2CDisplayInterface, Ssd1306};
use embedded_graphics::{
    mono_font::{ascii::{FONT_10X20, FONT_6X10}, MonoTextStyleBuilder},
    pixelcolor::BinaryColor,
    prelude::*,
    text::{Baseline, Text},
};

${HEAD}
    let button = PinDriver::input(peripherals.pins.gpio15)?;

    // Η οθόνη: I2C (SDA = GPIO 21, SCL = GPIO 22) → interface → οθόνη με buffer
    let config = I2cConfig::new().baudrate(Hertz(400_000));
    let i2c = I2cDriver::new(peripherals.i2c0, peripherals.pins.gpio21, peripherals.pins.gpio22, &config)?;
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

        FreeRtos::delay_ms(50);
    }
}
`;
  const OLED_BUG = OLED_OK.replace('        display.flush().unwrap();           // ΤΩΡΑ στείλε την εικόνα στην οθόνη\n', '');

  const lessons = [
    {
      kind: 'micro', skills: ['rust', 'io', 'conditions'],
      title: 'Το κουδούνι: PWM με το LEDC',
      objectives: ['Να φτιάχνω έναν timer και ένα κανάλι LEDC.', 'Να βγάζω ήχο με set_duty() και να τον σταματώ με duty 0.'],
      theory: `
<p>Το ESP32 φτιάχνει <strong>PWM</strong> με ένα κομμάτι που λέγεται <strong>LEDC</strong>. Χρειάζεσαι δύο πράγματα:</p>
<ol><li>Έναν <strong>timer</strong>, που δίνει τη συχνότητα: <code>LedcTimerDriver::new(peripherals.ledc.timer0, &amp;TimerConfig::new().frequency(Hertz(880)))?</code></li>
<li>Ένα <strong>κανάλι</strong>, που οδηγεί το pin: <code>LedcDriver::new(peripherals.ledc.channel0, &amp;timer, peripherals.pins.gpio23)?</code></li></ol>
<p>Μετά λες πόσο από τον χρόνο να είναι αναμμένο το pin: <code>buzzer.set_duty(max / 2)?</code> (μισό-μισό: ακούγεται), <code>buzzer.set_duty(0)?</code> (σιωπή). Το <code>max</code> το δίνει το <code>buzzer.get_max_duty()</code>.</p>`,
      glossary: ['LEDC', 'duty cycle', 'PWM', 'buzzer'], supportedSyntax: SYN_PWM,
      initialCode: BELL_START, solution: BELL_OK,
      world: { button: false }, hardware: ['button', 'buzzer'], panels: PANELS,
      steps: ['Στο if, γράψε buzzer.set_duty(max / 2)?;', 'Στο else, γράψε buzzer.set_duty(0)?;', 'Τρέξε και πάτα το κουμπί στη σκηνή.'],
      quiz: { question: 'Ποιο κομμάτι του LEDC λέει ΠΟΙΑ νότα ακούγεται;', options: ['Ο timer, με τη συχνότητα (Hertz(880))', 'Το κανάλι, με το set_duty', 'Το pin gpio23'], answer: 0, explain: 'Σωστά. Ο timer δίνει τη συχνότητα· το duty λέει μόνο αν (και πόσο) ακούγεται.', retry: 'Ποιο από τα δύο έχει μέσα το Hertz(880);' },
      hints: ['Ο ήχος ανοίγει και κλείνει με το set_duty.', 'Μισό = max / 2, σιωπή = 0.', 'if: buzzer.set_duty(max / 2)?;   else: buzzer.set_duty(0)?;'],
      validationTests: [
        TS('Χωρίς πάτημα → σιωπή', [{ setup: true }, { loops: 1 }, { check: 'buzzer', is: false, fail: 'Χωρίς πατημένο κουμπί το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → 880 Hz', [{ setup: true }, { sequence: { button: [1] } }, { check: 'buzzer', is: true, freq: 880, fail: 'Με πατημένο κουμπί περίμενα ήχο 880 Hz. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → σιωπή', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'buzzer', is: false, fail: 'Όταν αφήνεις το κουμπί ο ήχος πρέπει να σταματά (duty 0). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Το κουδούνι δουλεύει! Ο timer δίνει τη νότα, το duty αν ακούγεται.',
      remediation: 'Στο if βάλε buzzer.set_duty(max / 2)?; και στο else buzzer.set_duty(0)?;'
    },
    {
      kind: 'guided', skills: ['rust', 'io', 'timing'],
      title: 'Η πόρτα του γκαράζ: servo στα 50 Hz',
      objectives: ['Να ρυθμίζω timer στα 50 Hz με ακρίβεια 14 bits.', 'Να μετατρέπω γωνία σε duty μέσα σε μια συνάρτηση.'],
      theory: `
<p>Το <strong>servo</strong> δέχεται έναν παλμό κάθε <strong>20 ms</strong> (50 Hz). Το <strong>μήκος</strong> του παλμού λέει τη γωνία: 500 µs → 0°, 1500 µs → 90°, 2500 µs → 180°.</p>
<p>Γι' αυτό ο timer είναι στα <code>Hertz(50)</code> με <code>Resolution::Bits14</code>: το duty πάει από 0 έως 16383, άρα έχουμε μεγάλη ακρίβεια.</p>
<p>Η <code>angle()</code> κάνει τον λογαριασμό: <code>duty = max × παλμός / 20000</code>. Για 90°: 16383 × 1500 / 20000 ≈ 1228.</p>`,
      glossary: ['servo', 'LEDC', 'duty cycle'], supportedSyntax: SYN_PWM,
      initialCode: DOOR_START, solution: DOOR_OK,
      world: { button: false }, hardware: ['button', 'servo'], panels: PANELS,
      steps: ['Η angle() είναι έτοιμη. Διάβασέ την.', 'Στο if, γράψε angle(&mut servo, 90)?;', 'Τρέξε και πάτα το κουμπί: δες το μπράτσο να γυρίζει.'],
      quiz: { question: 'Γιατί ο timer του servo είναι στα 50 Hz;', options: ['Γιατί ο servo περιμένει έναν παλμό κάθε 20 ms', 'Γιατί έτσι ακούγεται καλύτερα', 'Γιατί το ESP32 δεν κάνει πιο γρήγορο PWM'], answer: 0, explain: 'Σωστά: 1 / 0,020 s = 50 Hz.', retry: 'Κάθε πόσα ms θέλει παλμό ο servo;' },
      hints: ['Η ανοιχτή πόρτα είναι στις 90 μοίρες.', 'Το servo δίνεται δανεικό με &mut servo.', 'angle(&mut servo, 90)?;'],
      validationTests: [
        TS('Στην αρχή η πόρτα είναι κλειστή (0°)', [{ setup: true }, { loops: 1 }, { check: 'servo', angle: 0, fail: 'Χωρίς πάτημα περίμενα το servo στις 0°. Τώρα: {v}.' }], { button: false }),
        TS('Πάτημα → η πόρτα ανοίγει (90°)', [{ setup: true }, { sequence: { button: [1] } }, { check: 'servo', angle: 90, fail: 'Με πατημένο κουμπί περίμενα το servo στις 90°. Τώρα: {v}.' }], { button: false }),
        TS('Αφήνεις το κουμπί → κλείνει', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'servo', angle: 0, fail: 'Όταν αφήνεις το κουμπί η πόρτα πρέπει να κλείνει (0°). Τώρα: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Η πόρτα ανοίγει και κλείνει! Η angle() μεταφράζει μοίρες σε duty για τον servo.',
      remediation: 'Με πατημένο κουμπί κάλεσε angle(&mut servo, 90)?;'
    },
    {
      kind: 'guided', skills: ['rust', 'conditions', 'io'],
      title: 'Το φως του σπιτιού: LED RGB',
      objectives: ['Να μοιράζω έναν timer σε τρία κανάλια.', 'Να δανείζω πολλά κανάλια σε μια συνάρτηση με &mut.'],
      theory: `
<p>Το <strong>LED RGB</strong> έχει τρία LED: κόκκινο (GPIO 32), πράσινο (GPIO 33), μπλε (GPIO 14). Χρειάζονται τρία <strong>κανάλια</strong> LEDC (channel0, 1, 2), αλλά αρκεί <strong>ένας timer</strong>: όλα θέλουν την ίδια συχνότητα.</p>
<p>Το <code>TimerConfig::new()</code> έχει 1000 Hz και 8 bits, άρα το duty πάει από 0 έως 255, όπως στο analogWrite της C++.</p>
<ul><li>(255, 0, 0) = κόκκινο · (0, 0, 255) = μπλε · (255, 255, 0) = κίτρινο</li></ul>`,
      glossary: ['LED RGB', 'LEDC', 'duty cycle'], supportedSyntax: SYN_PWM,
      initialCode: RGB_START, solution: RGB_OK,
      world: { button: false, pir: false }, hardware: ['rgb', 'button', 'pir'], panels: PANELS,
      steps: ['Μετά το if, πρόσθεσε } else if button.is_high() { … } με μπλε.', 'Πρόσθεσε } else { … } με απαλό πράσινο (0, 51, 0).', 'Τρέξε, πάτα το κουμπί και κάνε κίνηση στη σκηνή.'],
      quiz: { question: 'Τι θα γινόταν αν έφτιαχνες και το green με peripherals.ledc.channel0;', options: ['error[E0382]: το channel0 το έχεις ήδη δώσει (move) στο red', 'Το πράσινο θα άναβε μαζί με το κόκκινο', 'Τίποτα, θα δούλευε κανονικά'], answer: 0, explain: 'Σωστά. Κάθε κανάλι έχει έναν ιδιοκτήτη· η Rust το ελέγχει πριν τρέξει ο κώδικας.', retry: 'Θυμήσου τι κάνει το move στη Rust.' },
      hints: ['Χρειάζεσαι else if και else.', 'Μπλε = 0, 0, 255 · απαλό πράσινο = 0, 51, 0.', '} else if button.is_high() {\n    color(&mut red, &mut green, &mut blue, 0, 0, 255)?;\n} else {\n    color(&mut red, &mut green, &mut blue, 0, 51, 0)?;\n}'],
      validationTests: [
        TS('Ησυχία → απαλό πράσινο', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 0, g: 51, b: 0, fail: 'Χωρίς κίνηση και κουμπί περίμενα απαλό πράσινο (0, 51, 0). Τώρα: {v}.' }], { button: false, pir: false }),
        TS('Κουμπί → μπλε', [{ setup: true }, { sequence: { button: [1] } }, { check: 'rgb', r: 0, g: 0, b: 255, fail: 'Με πατημένο κουμπί περίμενα μπλε. Τώρα: {v}.' }], { button: false, pir: false }),
        TS('Κίνηση → κόκκινο', [{ setup: true }, { sequence: { pir: [1] } }, { check: 'rgb', r: 255, g: 0, b: 0, fail: 'Με κίνηση περίμενα κόκκινο. Τώρα: {v}.' }], { button: false, pir: false })
      ],
      explanationOnSuccess: 'Το φως δείχνει τι γίνεται στο σπίτι! Ένας timer, τρία κανάλια, άπειρα χρώματα.',
      remediation: 'Χρειάζονται τρεις περιπτώσεις: κίνηση κόκκινο, κουμπί μπλε, αλλιώς απαλό πράσινο.'
    },
    {
      kind: 'debug', skills: ['rust', 'state', 'syntax'],
      title: 'Βρες το λάθος: ο μετρητής δεν φαίνεται',
      objectives: ['Να γράφω στην οθόνη OLED με I2cDriver, ssd1306 και embedded-graphics.', 'Να καταλάβω ότι η οθόνη ενημερώνεται μόνο με flush().'],
      theory: `
<p>Η οθόνη <strong>OLED</strong> συνδέεται με <strong>I2C</strong> (SDA = GPIO 21, SCL = GPIO 22). Στο ESP32 φτιάχνεις τον δίαυλο με <code>I2cDriver::new(peripherals.i2c0, peripherals.pins.gpio21, peripherals.pins.gpio22, &amp;config)?</code>.</p>
<p>Από εκεί και πέρα ο κώδικας είναι <strong>ίδιος με του Raspberry Pi</strong>: τα crates <code>ssd1306</code> και <code>embedded-graphics</code> δεν νοιάζονται ποια πλακέτα έχεις. Αυτή είναι μια μεγάλη δύναμη της Rust.</p>
<p>Το <code>draw</code> ζωγραφίζει σε μια μνήμη (buffer). Η οθόνη αλλάζει μόνο με <code>display.flush()</code>. Κάποιος το ξέχασε…</p>`,
      glossary: ['OLED', 'I2C', 'embedded-graphics'], supportedSyntax: SYN_OLED,
      initialCode: OLED_BUG, solution: OLED_OK,
      world: { button: false }, hardware: ['oled', 'button'], panels: PANELS,
      steps: ['Τρέξε: η οθόνη στη σκηνή μένει μαύρη.', 'Βρες τι λείπει μετά τα draw().', 'Πρόσθεσέ το, ξανατρέξε και πάτα το κουμπί μερικές φορές.'],
      quiz: { question: 'Τι αλλάζει στον κώδικα της οθόνης ανάμεσα σε ESP32 και Raspberry Pi;', options: ['Μόνο το πώς φτιάχνεις τον δίαυλο I2C· το ssd1306 και το embedded-graphics μένουν ίδια', 'Όλα', 'Το ESP32 δεν έχει I2C'], answer: 0, explain: 'Σωστά. Τα crates γράφτηκαν για κάθε πλακέτα που έχει I2C.', retry: 'Κοίτα ποιες γραμμές έχουν «esp_idf» μέσα.' },
      hints: ['Η οθόνη ενημερώνεται μόνο με μία συγκεκριμένη εντολή της display.', 'Κοίτα την τελευταία παράγραφο του «Μαθήματος».', 'Πρόσθεσε display.flush().unwrap(); μετά το δεύτερο draw.'],
      validationTests: [
        TS('Στην αρχή η οθόνη δείχνει 0', [{ setup: true }, { loops: 1 }, { check: 'oled', has: 'Visitors: 0', fail: 'Στην οθόνη περίμενα «Visitors: 0». Βλέπω: {v}.' }], { button: false }),
        TS('Δύο πατήματα → 2', [{ setup: true }, { sequence: { button: [1, 0, 1, 0] } }, { check: 'oled', has: 'Visitors: 2', fail: 'Μετά από δύο πατήματα περίμενα «Visitors: 2». Βλέπω: {v}.' }], { button: false })
      ],
      explanationOnSuccess: 'Ο μετρητής φαίνεται! Και ο ίδιος κώδικας οθόνης δουλεύει και στο Raspberry Pi.',
      remediation: 'Λείπει το display.flush().unwrap(); μετά τα draw().'
    }
  ];

  lessons.forEach((l, i) => {
    const world = l.world || {};
    L.lessons.push(Object.assign({
      id: `c${N}-l${i + 1}`, chapter: N, lang: 'rust', board: 'esp32',
      prerequisites: i === 0 ? [] : [`c${N}-l${i}`]
    }, l, { world, initialWorld: world }));
  });
})(typeof window !== 'undefined' ? window : globalThis);
