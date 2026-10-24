/*
 * IoT Guardian — Μίνι έργα: ενώνουν όσα έμαθες (κουμπί, PIR, buzzer, servo, LED RGB, οθόνη).
 *   Έργο Α: Έξυπνο κουδούνι      (3 βήματα · το 3ο χωρίς βοήθεια)
 *   Έργο Β: Συναγερμός του σπιτιού (3 βήματα · το 3ο χωρίς βοήθεια)
 * Κάθε βήμα ξεκινά από τον κώδικα του προηγούμενου. Ίδια έργα σε όλες τις διαδρομές:
 *   C++ / ESP32 (27) · Python / Pi (28) · MicroPython / ESP32 (37) · Rust / Pi (48) · Rust / ESP32 (58)
 * Κάθε κεφάλαιο ανοίγει μετά το κεφάλαιο με τα νέα εξαρτήματα της διαδρομής του.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;

  [
    { term: 'μίνι έργο', def: 'Μια μικρή αλλά ολοκληρωμένη συσκευή που ενώνει πολλά εξαρτήματα και πολλά από όσα έμαθες. Χτίζεται βήμα-βήμα.' },
    { term: 'ανίχνευση ακμής', def: 'Καταλαβαίνω τη ΣΤΙΓΜΗ που κάτι αλλάζει (π.χ. μόλις πατήθηκε το κουμπί), συγκρίνοντας την τωρινή τιμή με την προηγούμενη. Έτσι ένα πάτημα μετράει μία φορά, όσο κι αν κρατάς το κουμπί.' },
    { term: 'εναλλαγή (toggle)', def: 'Κάθε φορά που γίνεται κάτι, μια κατάσταση γυρίζει στο αντίθετο: ON → OFF → ON. Π.χ. armed = !armed (C++, Rust) ή armed = not armed (Python).' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  // ------------------------------------------------------------ βοηθητικά για τα «βήματα» του κώδικα
  // s = βήμα (1–3), st = αρχικός κώδικας (true) ή λύση (false)
  // on(k): το κομμάτι του βήματος k υπάρχει · sc(k): «σκαλωσιά» του βήματος k (υπάρχει και στον αρχικό κώδικα)
  // todo(k, t): σχόλιο ΣΥΜΠΛΗΡΩΣΕ μόνο στον αρχικό κώδικα του βήματος k
  const kit = (s, st) => ({
    on: k => k < s || (k === s && !st),
    sc: k => s >= k,
    todo: (k, t) => (k === s && st ? t : '')
  });

  // ================================================================== C++ / ESP32
  const CPP = {
    A(s, st) {
      const { on, sc, todo } = kit(s, st);
      return `// Μίνι έργο: έξυπνο κουδούνι.
${todo(3, '// ΣΥΜΠΛΗΡΩΣΕ: LED RGB μπλε όσο χτυπά το κουδούνι, πράσινο όταν έχει ησυχία\n')}${sc(2) ? 'int visitors = 0;           // πόσοι επισκέπτες ήρθαν\nbool wasPressed = false;    // ήταν πατημένο στον προηγούμενο γύρο;\n\n' : ''}${on(3) ? 'void color(int r, int g, int b) {\n  analogWrite(RGB_RED_PIN, r);\n  analogWrite(RGB_GREEN_PIN, g);\n  analogWrite(RGB_BLUE_PIN, b);\n}\n\n' : ''}void setup() {
  pinMode(BUTTON_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  display.begin();
${sc(2) ? '  servo.attach(SERVO_PIN);\n' : ''}}

void loop() {
  bool pressed = digitalRead(BUTTON_PIN) == HIGH;
${on(2) ? '  if (pressed && !wasPressed) {\n    visitors++;               // μόλις πατήθηκε: νέος επισκέπτης\n  }\n  wasPressed = pressed;\n' : todo(2, '  // ΣΥΜΠΛΗΡΩΣΕ: μέτρα έναν επισκέπτη τη στιγμή που πατιέται το κουμπί\n')}
  display.clearDisplay();
  display.setCursor(0, 0);
  if (pressed) {
${on(1) ? '    tone(BUZZER_PIN, 880);      // ντιν-ντονγκ\n    display.println("Ding dong!");\n' : '    // ΣΥΜΠΛΗΡΩΣΕ: ήχος 880 Hz και «Ding dong!» στην οθόνη\n'}${on(2) ? '    servo.write(90);            // η πόρτα ανοίγει\n' : todo(2, '    // ΣΥΜΠΛΗΡΩΣΕ: άνοιξε την πόρτα (90°)\n')}${on(3) ? '    color(0, 0, 255);           // μπλε: χτυπά\n' : ''}  } else {
${on(1) ? '    noTone(BUZZER_PIN);\n    display.println("Welcome");\n' : '    // ΣΥΜΠΛΗΡΩΣΕ: σιωπή και «Welcome» στην οθόνη\n'}${on(2) ? '    servo.write(0);             // κλειστή\n' : todo(2, '    // ΣΥΜΠΛΗΡΩΣΕ: κλείσε την πόρτα (0°)\n')}${on(3) ? '    color(0, 255, 0);           // πράσινο: ησυχία\n' : ''}  }
${on(2) ? '  display.print("Visitors: ");\n  display.println(visitors);\n' : todo(2, '  // ΣΥΜΠΛΗΡΩΣΕ: γράψε «Visitors: » και τον αριθμό τους\n')}  display.display();
  delay(50);
}
`;
    },
    B(s, st) {
      const { on, sc, todo } = kit(s, st);
      return `// Μίνι έργο: συναγερμός του σπιτιού.
${todo(3, '// ΣΥΜΠΛΗΡΩΣΕ: μέτρα τους συναγερμούς («Alarms: N» στην οθόνη) και κλείδωσε την πόρτα όσο είναι οπλισμένος\n')}${sc(2) ? 'bool armed = true;          // ξεκινά οπλισμένος\nbool wasPressed = false;\n' : ''}${on(3) ? 'int alarms = 0;\nbool wasMotion = false;\n' : ''}${sc(2) ? '\n' : ''}void color(int r, int g, int b) {
  analogWrite(RGB_RED_PIN, r);
  analogWrite(RGB_GREEN_PIN, g);
  analogWrite(RGB_BLUE_PIN, b);
}

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
${sc(2) ? '  pinMode(BUTTON_PIN, INPUT);\n  display.begin();\n' : ''}${on(3) ? '  servo.attach(SERVO_PIN);\n' : ''}}

void loop() {
  bool motion = digitalRead(PIR_PIN) == HIGH;
${sc(2) ? '  bool pressed = digitalRead(BUTTON_PIN) == HIGH;\n' : ''}${on(2) ? '  if (pressed && !wasPressed) {\n    armed = !armed;             // κάθε πάτημα: οπλίζει / αφοπλίζει\n  }\n  wasPressed = pressed;\n' : todo(2, '  // ΣΥΜΠΛΗΡΩΣΕ: κάθε πάτημα του κουμπιού γυρίζει το armed στο αντίθετο\n')}${on(3) ? '  if (armed && motion && !wasMotion) {\n    alarms++;                   // νέος συναγερμός\n  }\n  wasMotion = motion;\n' : ''}
${on(1) ? `  if (${on(2) ? 'armed && motion' : 'motion'}) {
    tone(BUZZER_PIN, 880);      // συναγερμός!
    color(255, 0, 0);           // κόκκινο
${on(2) ? '  } else if (!armed) {\n    noTone(BUZZER_PIN);\n    color(0, 0, 255);           // μπλε: αφοπλισμένος\n' : todo(2, '  // ΣΥΜΠΛΗΡΩΣΕ: αν δεν είναι οπλισμένος, σιωπή και μπλε\n')}  } else {
    noTone(BUZZER_PIN);
    color(0, 255, 0);           // πράσινο: όλα καλά
  }
` : `  if (motion) {
    // ΣΥΜΠΛΗΡΩΣΕ: ήχος 880 Hz και κόκκινο
  } else {
    // ΣΥΜΠΛΗΡΩΣΕ: σιωπή και πράσινο
  }
`}${on(3) ? '  if (armed) {\n    servo.write(0);             // η πόρτα κλειδώνει\n  } else {\n    servo.write(90);\n  }\n' : ''}${sc(2) ? `
  display.clearDisplay();
  display.setCursor(0, 0);
  if (armed) {
    display.println("ARMED");
  } else {
    display.println("OFF");
  }
${on(3) ? '  display.print("Alarms: ");\n  display.println(alarms);\n' : ''}  display.display();
` : ''}  delay(50);
}
`;
    }
  };

  // ================================================================== MicroPython / ESP32
  const MP = {
    A(s, st) {
      const { on, sc, todo } = kit(s, st);
      return `# Μίνι έργο: έξυπνο κουδούνι.
${todo(3, '# ΣΥΜΠΛΗΡΩΣΕ: LED RGB μπλε όσο χτυπά το κουδούνι, πράσινο όταν έχει ησυχία\n')}from machine import Pin, PWM, I2C
import ssd1306
import time

button = Pin(15, Pin.IN)
buzzer = PWM(Pin(23))
buzzer.freq(880)
buzzer.duty_u16(0)
i2c = I2C(0, scl=Pin(22), sda=Pin(21))
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
${sc(2) ? 'servo = PWM(Pin(19), freq=50)\n\ndef angle(a):\n    servo.duty(int(26 + a * 102 / 180))\n' : ''}${on(3) ? '\nred = PWM(Pin(32), freq=1000)\ngreen = PWM(Pin(33), freq=1000)\nblue = PWM(Pin(14), freq=1000)\n\ndef color(r, g, b):\n    red.duty(r * 4)\n    green.duty(g * 4)\n    blue.duty(b * 4)\n' : ''}${sc(2) ? '\nvisitors = 0            # πόσοι επισκέπτες ήρθαν\nwas_pressed = False     # ήταν πατημένο στον προηγούμενο γύρο;\n' : ''}
while True:
    pressed = button.value() == 1
${on(2) ? '    if pressed and not was_pressed:\n        visitors += 1           # μόλις πατήθηκε: νέος επισκέπτης\n    was_pressed = pressed\n' : todo(2, '    # ΣΥΜΠΛΗΡΩΣΕ: μέτρα έναν επισκέπτη τη στιγμή που πατιέται το κουμπί\n')}    oled.fill(0)
    if pressed:
${on(1) ? '        buzzer.duty_u16(32768)      # ντιν-ντονγκ (880 Hz)\n        oled.text("Ding dong!", 0, 0)\n' : '        # ΣΥΜΠΛΗΡΩΣΕ: ήχος και «Ding dong!» στην οθόνη\n        pass\n'}${on(2) ? '        angle(90)                   # η πόρτα ανοίγει\n' : todo(2, '        # ΣΥΜΠΛΗΡΩΣΕ: άνοιξε την πόρτα (90°)\n')}${on(3) ? '        color(0, 0, 255)            # μπλε: χτυπά\n' : ''}    else:
${on(1) ? '        buzzer.duty_u16(0)\n        oled.text("Welcome", 0, 0)\n' : '        # ΣΥΜΠΛΗΡΩΣΕ: σιωπή και «Welcome» στην οθόνη\n        pass\n'}${on(2) ? '        angle(0)                    # κλειστή\n' : todo(2, '        # ΣΥΜΠΛΗΡΩΣΕ: κλείσε την πόρτα (0°)\n')}${on(3) ? '        color(0, 255, 0)            # πράσινο: ησυχία\n' : ''}${on(2) ? '    oled.text("Visitors: " + str(visitors), 0, 12)\n' : todo(2, '    # ΣΥΜΠΛΗΡΩΣΕ: γράψε «Visitors: » και τον αριθμό τους (y = 12)\n')}    oled.show()
    time.sleep_ms(50)
`;
    },
    B(s, st) {
      const { on, sc, todo } = kit(s, st);
      return `# Μίνι έργο: συναγερμός του σπιτιού.
${todo(3, '# ΣΥΜΠΛΗΡΩΣΕ: μέτρα τους συναγερμούς («Alarms: N» στην οθόνη) και κλείδωσε την πόρτα όσο είναι οπλισμένος\n')}from machine import Pin, PWM${sc(2) ? ', I2C' : ''}
${sc(2) ? 'import ssd1306\n' : ''}import time

pir = Pin(4, Pin.IN)
buzzer = PWM(Pin(23))
buzzer.freq(880)
buzzer.duty_u16(0)
red = PWM(Pin(32), freq=1000)
green = PWM(Pin(33), freq=1000)
blue = PWM(Pin(14), freq=1000)

def color(r, g, b):
    red.duty(r * 4)
    green.duty(g * 4)
    blue.duty(b * 4)
${sc(2) ? '\nbutton = Pin(15, Pin.IN)\ni2c = I2C(0, scl=Pin(22), sda=Pin(21))\noled = ssd1306.SSD1306_I2C(128, 64, i2c)\narmed = True            # ξεκινά οπλισμένος\nwas_pressed = False\n' : ''}${on(3) ? 'servo = PWM(Pin(19), freq=50)\n\ndef angle(a):\n    servo.duty(int(26 + a * 102 / 180))\n\nalarms = 0\nwas_motion = False\n' : ''}
while True:
    motion = pir.value() == 1
${sc(2) ? '    pressed = button.value() == 1\n' : ''}${on(2) ? '    if pressed and not was_pressed:\n        armed = not armed           # κάθε πάτημα: οπλίζει / αφοπλίζει\n    was_pressed = pressed\n' : todo(2, '    # ΣΥΜΠΛΗΡΩΣΕ: κάθε πάτημα του κουμπιού γυρίζει το armed στο αντίθετο\n')}${on(3) ? '    if armed and motion and not was_motion:\n        alarms += 1                 # νέος συναγερμός\n    was_motion = motion\n' : ''}${on(1) ? `    if ${on(2) ? 'armed and motion' : 'motion'}:
        buzzer.duty_u16(32768)      # συναγερμός!
        color(255, 0, 0)            # κόκκινο
${on(2) ? '    elif not armed:\n        buzzer.duty_u16(0)\n        color(0, 0, 255)            # μπλε: αφοπλισμένος\n' : todo(2, '    # ΣΥΜΠΛΗΡΩΣΕ: αν δεν είναι οπλισμένος, σιωπή και μπλε\n')}    else:
        buzzer.duty_u16(0)
        color(0, 255, 0)            # πράσινο: όλα καλά
` : `    if motion:
        # ΣΥΜΠΛΗΡΩΣΕ: ήχος και κόκκινο
        pass
    else:
        # ΣΥΜΠΛΗΡΩΣΕ: σιωπή και πράσινο
        pass
`}${on(3) ? '    if armed:\n        angle(0)                    # η πόρτα κλειδώνει\n    else:\n        angle(90)\n' : ''}${sc(2) ? `    oled.fill(0)
    if armed:
        oled.text("ARMED", 0, 0)
    else:
        oled.text("OFF", 0, 0)
${on(3) ? '    oled.text("Alarms: " + str(alarms), 0, 12)\n' : ''}    oled.show()
` : ''}    time.sleep_ms(50)
`;
    }
  };

  // ================================================================== Python / Raspberry Pi
  const PY = {
    A(s, st) {
      const { on, sc, todo } = kit(s, st);
      const imp = ['Button', 'TonalBuzzer'].concat(sc(2) ? ['AngularServo'] : [], on(3) ? ['RGBLED'] : []);
      return `# Μίνι έργο: έξυπνο κουδούνι.
${todo(3, '# ΣΥΜΠΛΗΡΩΣΕ: LED RGB μπλε όσο χτυπά το κουδούνι, πράσινο όταν έχει ησυχία\n')}from gpiozero import ${imp.join(', ')}
from gpiozero.tones import Tone
import board, busio, adafruit_ssd1306
import time

button = Button(27)
buzzer = TonalBuzzer(22)
i2c = busio.I2C(board.SCL, board.SDA)
oled = adafruit_ssd1306.SSD1306_I2C(128, 64, i2c)
${sc(2) ? 'servo = AngularServo(18, min_angle=0, max_angle=180,\n                     min_pulse_width=0.0005, max_pulse_width=0.0025)\n' : ''}${on(3) ? 'led = RGBLED(red=5, green=6, blue=13)\n' : ''}${sc(2) ? '\nvisitors = 0            # πόσοι επισκέπτες ήρθαν\nwas_pressed = False     # ήταν πατημένο στον προηγούμενο γύρο;\n' : ''}
while True:
    pressed = button.is_pressed
${on(2) ? '    if pressed and not was_pressed:\n        visitors += 1           # μόλις πατήθηκε: νέος επισκέπτης\n    was_pressed = pressed\n' : todo(2, '    # ΣΥΜΠΛΗΡΩΣΕ: μέτρα έναν επισκέπτη τη στιγμή που πατιέται το κουμπί\n')}    oled.fill(0)
    if pressed:
${on(1) ? '        buzzer.play(Tone(880.0))    # ντιν-ντονγκ\n        oled.text("Ding dong!", 0, 0, 1)\n' : '        # ΣΥΜΠΛΗΡΩΣΕ: ήχος 880 Hz και «Ding dong!» στην οθόνη\n        pass\n'}${on(2) ? '        servo.angle = 90            # η πόρτα ανοίγει\n' : todo(2, '        # ΣΥΜΠΛΗΡΩΣΕ: άνοιξε την πόρτα (90°)\n')}${on(3) ? '        led.color = (0, 0, 1)       # μπλε: χτυπά\n' : ''}    else:
${on(1) ? '        buzzer.stop()\n        oled.text("Welcome", 0, 0, 1)\n' : '        # ΣΥΜΠΛΗΡΩΣΕ: σιωπή και «Welcome» στην οθόνη\n        pass\n'}${on(2) ? '        servo.angle = 0             # κλειστή\n' : todo(2, '        # ΣΥΜΠΛΗΡΩΣΕ: κλείσε την πόρτα (0°)\n')}${on(3) ? '        led.color = (0, 1, 0)       # πράσινο: ησυχία\n' : ''}${on(2) ? '    oled.text("Visitors: " + str(visitors), 0, 12, 1)\n' : todo(2, '    # ΣΥΜΠΛΗΡΩΣΕ: γράψε «Visitors: » και τον αριθμό τους (y = 12)\n')}    oled.show()
    time.sleep(0.05)
`;
    },
    B(s, st) {
      const { on, sc, todo } = kit(s, st);
      const imp = ['MotionSensor', 'TonalBuzzer', 'RGBLED'].concat(sc(2) ? ['Button'] : [], on(3) ? ['AngularServo'] : []);
      return `# Μίνι έργο: συναγερμός του σπιτιού.
${todo(3, '# ΣΥΜΠΛΗΡΩΣΕ: μέτρα τους συναγερμούς («Alarms: N» στην οθόνη) και κλείδωσε την πόρτα όσο είναι οπλισμένος\n')}from gpiozero import ${imp.join(', ')}
from gpiozero.tones import Tone
${sc(2) ? 'import board, busio, adafruit_ssd1306\n' : ''}import time

pir = MotionSensor(4)
buzzer = TonalBuzzer(22)
led = RGBLED(red=5, green=6, blue=13)
${sc(2) ? 'button = Button(27)\ni2c = busio.I2C(board.SCL, board.SDA)\noled = adafruit_ssd1306.SSD1306_I2C(128, 64, i2c)\narmed = True            # ξεκινά οπλισμένος\nwas_pressed = False\n' : ''}${on(3) ? 'servo = AngularServo(18, min_angle=0, max_angle=180,\n                     min_pulse_width=0.0005, max_pulse_width=0.0025)\nalarms = 0\nwas_motion = False\n' : ''}
while True:
    motion = pir.motion_detected
${sc(2) ? '    pressed = button.is_pressed\n' : ''}${on(2) ? '    if pressed and not was_pressed:\n        armed = not armed           # κάθε πάτημα: οπλίζει / αφοπλίζει\n    was_pressed = pressed\n' : todo(2, '    # ΣΥΜΠΛΗΡΩΣΕ: κάθε πάτημα του κουμπιού γυρίζει το armed στο αντίθετο\n')}${on(3) ? '    if armed and motion and not was_motion:\n        alarms += 1                 # νέος συναγερμός\n    was_motion = motion\n' : ''}${on(1) ? `    if ${on(2) ? 'armed and motion' : 'motion'}:
        buzzer.play(Tone(880.0))    # συναγερμός!
        led.color = (1, 0, 0)       # κόκκινο
${on(2) ? '    elif not armed:\n        buzzer.stop()\n        led.color = (0, 0, 1)       # μπλε: αφοπλισμένος\n' : todo(2, '    # ΣΥΜΠΛΗΡΩΣΕ: αν δεν είναι οπλισμένος, σιωπή και μπλε\n')}    else:
        buzzer.stop()
        led.color = (0, 1, 0)       # πράσινο: όλα καλά
` : `    if motion:
        # ΣΥΜΠΛΗΡΩΣΕ: ήχος 880 Hz και κόκκινο
        pass
    else:
        # ΣΥΜΠΛΗΡΩΣΕ: σιωπή και πράσινο
        pass
`}${on(3) ? '    if armed:\n        servo.angle = 0             # η πόρτα κλειδώνει\n    else:\n        servo.angle = 90\n' : ''}${sc(2) ? `    oled.fill(0)
    if armed:
        oled.text("ARMED", 0, 0, 1)
    else:
        oled.text("OFF", 0, 0, 1)
${on(3) ? '    oled.text("Alarms: " + str(alarms), 0, 12, 1)\n' : ''}    oled.show()
` : ''}    time.sleep(0.05)
`;
    }
  };

  // ================================================================== Rust (κοινά κομμάτια Pi / ESP32)
  const RS_OLED_USES = `use ssd1306::{prelude::*, I2CDisplayInterface, Ssd1306};
use embedded_graphics::{
    mono_font::{ascii::FONT_6X10, MonoTextStyleBuilder},
    pixelcolor::BinaryColor,
    prelude::*,
    text::{Baseline, Text},
};`;
  const RS_OLED_SETUP = `    let interface = I2CDisplayInterface::new(i2c);
    let mut display = Ssd1306::new(interface, DisplaySize128x64, DisplayRotation::Rotate0)
        .into_buffered_graphics_mode();
    display.init().unwrap();
    let style = MonoTextStyleBuilder::new().font(&FONT_6X10).text_color(BinaryColor::On).build();`;
  const txt = (ind, what, y) => `${ind}Text::with_baseline(${what}, Point::new(0, ${y}), style, Baseline::Top).draw(&mut display).unwrap();\n`;

  // Τι αλλάζει ανάμεσα σε Pi (rppal) και ESP32 (esp-idf-hal + LEDC)
  const RSB = {
    pi: {
      head: 'fn main() -> Result<(), Box<dyn Error>> {\n    let gpio = Gpio::new()?;',
      uses: (o) => [`use rppal::gpio::${o.color ? '{Gpio, OutputPin}' : 'Gpio'};`].concat(o.oled ? ['use rppal::i2c::I2c;', RS_OLED_USES] : [], ['use std::error::Error;', 'use std::thread;', 'use std::time::Duration;']).join('\n'),
      input: (v, name) => `    let ${v} = gpio.get(${{ button: 27, pir: 4 }[name]})?.into_input();\n`,
      buzzer: '    let mut buzzer = gpio.get(22)?.into_output();\n',
      servo: '    let mut servo = gpio.get(18)?.into_output();\n',
      rgb: '    let mut red = gpio.get(5)?.into_output();\n    let mut green = gpio.get(6)?.into_output();\n    let mut blue = gpio.get(13)?.into_output();\n',
      i2c: '    let i2c = I2c::new()?;\n',
      colorFn: 'fn color(red: &mut OutputPin, green: &mut OutputPin, blue: &mut OutputPin, r: f64, g: f64, b: f64) -> Result<(), Box<dyn Error>> {\n    red.set_pwm_frequency(100.0, r)?;\n    green.set_pwm_frequency(100.0, g)?;\n    blue.set_pwm_frequency(100.0, b)?;\n    Ok(())\n}\n\n',
      col: (r, g, b) => `color(&mut red, &mut green, &mut blue, ${[r, g, b].map(x => (x ? '1.0' : '0.0')).join(', ')})?;`,
      beep: 'buzzer.set_pwm_frequency(880.0, 0.5)?;',
      quiet: 'buzzer.clear_pwm()?;',
      door: a => `servo.set_pwm(Duration::from_millis(20), Duration::from_micros(${a ? 1500 : 500}))?;`,
      sleep: 'thread::sleep(Duration::from_millis(50));'
    },
    esp32: {
      head: 'fn main() -> anyhow::Result<()> {\n    esp_idf_svc::sys::link_patches();\n    let peripherals = Peripherals::take()?;',
      uses: (o) => ['use esp_idf_svc::hal::delay::FreeRtos;', 'use esp_idf_svc::hal::gpio::PinDriver;'].concat(o.oled ? ['use esp_idf_svc::hal::i2c::{I2cConfig, I2cDriver};'] : [], [`use esp_idf_svc::hal::ledc::{config::TimerConfig, LedcDriver, LedcTimerDriver${o.servo ? ', Resolution' : ''}};`, 'use esp_idf_svc::hal::peripherals::Peripherals;', 'use esp_idf_svc::hal::units::Hertz;'], o.oled ? [RS_OLED_USES] : []).join('\n'),
      input: (v, name) => `    let ${v} = PinDriver::input(peripherals.pins.gpio${{ button: 15, pir: 4 }[name]})?;\n`,
      buzzer: '    let buzz_timer = LedcTimerDriver::new(peripherals.ledc.timer0, &TimerConfig::new().frequency(Hertz(880)))?;\n    let mut buzzer = LedcDriver::new(peripherals.ledc.channel0, &buzz_timer, peripherals.pins.gpio23)?;\n    let half = buzzer.get_max_duty() / 2;\n',
      servo: '    let servo_timer = LedcTimerDriver::new(peripherals.ledc.timer1, &TimerConfig::new().frequency(Hertz(50)).resolution(Resolution::Bits14))?;\n    let mut servo = LedcDriver::new(peripherals.ledc.channel1, &servo_timer, peripherals.pins.gpio19)?;\n    let smax = servo.get_max_duty();\n',
      rgb: '    let rgb_timer = LedcTimerDriver::new(peripherals.ledc.timer2, &TimerConfig::new())?;\n    let mut red = LedcDriver::new(peripherals.ledc.channel2, &rgb_timer, peripherals.pins.gpio32)?;\n    let mut green = LedcDriver::new(peripherals.ledc.channel3, &rgb_timer, peripherals.pins.gpio33)?;\n    let mut blue = LedcDriver::new(peripherals.ledc.channel4, &rgb_timer, peripherals.pins.gpio14)?;\n',
      i2c: '    let i2c = I2cDriver::new(peripherals.i2c0, peripherals.pins.gpio21, peripherals.pins.gpio22, &I2cConfig::new().baudrate(Hertz(400_000)))?;\n',
      colorFn: 'fn color(red: &mut LedcDriver, green: &mut LedcDriver, blue: &mut LedcDriver, r: u32, g: u32, b: u32) -> anyhow::Result<()> {\n    red.set_duty(r)?;\n    green.set_duty(g)?;\n    blue.set_duty(b)?;\n    Ok(())\n}\n\n',
      col: (r, g, b) => `color(&mut red, &mut green, &mut blue, ${[r, g, b].map(x => (x ? 255 : 0)).join(', ')})?;`,
      beep: 'buzzer.set_duty(half)?;',
      quiet: 'buzzer.set_duty(0)?;',
      door: a => `servo.set_duty(smax * ${a ? 1500 : 500} / 20000)?;`,
      sleep: 'FreeRtos::delay_ms(50);'
    }
  };

  const rust = key => {
    const R = RSB[key];
    return {
      A(s, st) {
        const { on, sc, todo } = kit(s, st);
        return `// Μίνι έργο: έξυπνο κουδούνι.
${todo(3, '// ΣΥΜΠΛΗΡΩΣΕ: LED RGB μπλε όσο χτυπά το κουδούνι, πράσινο όταν έχει ησυχία\n')}${R.uses({ oled: true, color: on(3), servo: sc(2) })}

${on(3) ? R.colorFn : ''}${R.head}
${R.input('button', 'button')}${R.buzzer}${sc(2) ? R.servo : ''}${on(3) ? R.rgb : ''}${R.i2c}${RS_OLED_SETUP}
${sc(2) ? '\n    let mut visitors: u32 = 0;      // πόσοι επισκέπτες ήρθαν\n    let mut was_pressed = false;    // ήταν πατημένο στον προηγούμενο γύρο;\n' : ''}
    loop {
        let pressed = button.is_high();
${on(2) ? '        if pressed && !was_pressed {\n            visitors += 1;              // μόλις πατήθηκε: νέος επισκέπτης\n        }\n        was_pressed = pressed;\n' : todo(2, '        // ΣΥΜΠΛΗΡΩΣΕ: μέτρα έναν επισκέπτη τη στιγμή που πατιέται το κουμπί\n')}        display.clear_buffer();
        if pressed {
${on(1) ? `            ${R.beep}   // ντιν-ντονγκ\n${txt('            ', '"Ding dong!"', 0)}` : '            // ΣΥΜΠΛΗΡΩΣΕ: ήχος 880 Hz και «Ding dong!» στην οθόνη\n'}${on(2) ? `            ${R.door(1)}   // η πόρτα ανοίγει (90°)\n` : todo(2, '            // ΣΥΜΠΛΗΡΩΣΕ: άνοιξε την πόρτα (90°)\n')}${on(3) ? `            ${R.col(0, 0, 1)}   // μπλε: χτυπά\n` : ''}        } else {
${on(1) ? `            ${R.quiet}\n${txt('            ', '"Welcome"', 0)}` : '            // ΣΥΜΠΛΗΡΩΣΕ: σιωπή και «Welcome» στην οθόνη\n'}${on(2) ? `            ${R.door(0)}   // κλειστή (0°)\n` : todo(2, '            // ΣΥΜΠΛΗΡΩΣΕ: κλείσε την πόρτα (0°)\n')}${on(3) ? `            ${R.col(0, 1, 0)}   // πράσινο: ησυχία\n` : ''}        }
${on(2) ? `        let line = format!("Visitors: {}", visitors);\n${txt('        ', '&line', 12)}` : todo(2, '        // ΣΥΜΠΛΗΡΩΣΕ: γράψε «Visitors: » και τον αριθμό τους (y = 12)\n')}        display.flush().unwrap();
        ${R.sleep}
    }
}
`;
      },
      B(s, st) {
        const { on, sc, todo } = kit(s, st);
        return `// Μίνι έργο: συναγερμός του σπιτιού.
${todo(3, '// ΣΥΜΠΛΗΡΩΣΕ: μέτρα τους συναγερμούς («Alarms: N» στην οθόνη) και κλείδωσε την πόρτα όσο είναι οπλισμένος\n')}${R.uses({ oled: sc(2), color: true, servo: on(3) })}

${R.colorFn}${R.head}
${R.input('pir', 'pir')}${R.buzzer}${R.rgb}${sc(2) ? R.input('button', 'button') + R.i2c + RS_OLED_SETUP + '\n    let mut armed = true;           // ξεκινά οπλισμένος\n    let mut was_pressed = false;\n' : ''}${on(3) ? R.servo + '    let mut alarms: u32 = 0;\n    let mut was_motion = false;\n' : ''}
    loop {
        let motion = pir.is_high();
${sc(2) ? '        let pressed = button.is_high();\n' : ''}${on(2) ? '        if pressed && !was_pressed {\n            armed = !armed;             // κάθε πάτημα: οπλίζει / αφοπλίζει\n        }\n        was_pressed = pressed;\n' : todo(2, '        // ΣΥΜΠΛΗΡΩΣΕ: κάθε πάτημα του κουμπιού γυρίζει το armed στο αντίθετο\n')}${on(3) ? '        if armed && motion && !was_motion {\n            alarms += 1;                // νέος συναγερμός\n        }\n        was_motion = motion;\n' : ''}${on(1) ? `        if ${on(2) ? 'armed && motion' : 'motion'} {
            ${R.beep}   // συναγερμός!
            ${R.col(1, 0, 0)}   // κόκκινο
${on(2) ? `        } else if !armed {\n            ${R.quiet}\n            ${R.col(0, 0, 1)}   // μπλε: αφοπλισμένος\n` : todo(2, '        // ΣΥΜΠΛΗΡΩΣΕ: αν δεν είναι οπλισμένος, σιωπή και μπλε\n')}        } else {
            ${R.quiet}
            ${R.col(0, 1, 0)}   // πράσινο: όλα καλά
        }
` : `        if motion {
            // ΣΥΜΠΛΗΡΩΣΕ: ήχος 880 Hz και κόκκινο
        } else {
            // ΣΥΜΠΛΗΡΩΣΕ: σιωπή και πράσινο
        }
`}${on(3) ? `        if armed {\n            ${R.door(0)}   // η πόρτα κλειδώνει\n        } else {\n            ${R.door(1)}\n        }\n` : ''}${sc(2) ? `        display.clear_buffer();
        if armed {
${txt('            ', '"ARMED"', 0)}        } else {
${txt('            ', '"OFF"', 0)}        }
${on(3) ? `        let line = format!("Alarms: {}", alarms);\n${txt('        ', '&line', 12)}` : ''}        display.flush().unwrap();
` : ''}        ${R.sleep}
    }
}
`;
      }
    };
  };

  // ================================================================== κείμενα και έλεγχοι (ίδια σε όλες τις διαδρομές)
  const TS = (name, script, world) => ({ name, world, script });
  const W = { button: false, pir: false };
  const T = {
    A1: [
      TS('Ησυχία → σιωπή και «Welcome»', [{ setup: true }, { loops: 1 }, { check: 'buzzer', is: false, fail: 'Χωρίς πάτημα το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }, { check: 'oled', has: 'Welcome', fail: 'Χωρίς πάτημα η οθόνη πρέπει να γράφει «Welcome». Βλέπω: {v}.' }], W),
      TS('Πάτημα → 880 Hz και «Ding dong!»', [{ setup: true }, { sequence: { button: [1] } }, { check: 'buzzer', is: true, freq: 880, fail: 'Με πατημένο κουμπί περίμενα ήχο 880 Hz. Τώρα: {v}.' }, { check: 'oled', has: 'Ding dong!', fail: 'Με πατημένο κουμπί η οθόνη πρέπει να γράφει «Ding dong!». Βλέπω: {v}.' }], W),
      TS('Αφήνεις το κουμπί → σιωπή', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'buzzer', is: false, fail: 'Όταν αφήνεις το κουμπί ο ήχος πρέπει να σταματά. Τώρα: {v}.' }], W)
    ],
    A2: [
      TS('Δύο πατήματα → «Visitors: 2»', [{ setup: true }, { sequence: { button: [1, 1, 0, 1, 0] } }, { check: 'oled', has: 'Visitors: 2', fail: 'Μετά από δύο πατήματα (το πρώτο κρατήθηκε δύο γύρους) περίμενα «Visitors: 2». Βλέπω: {v}.' }], W),
      TS('Πάτημα → η πόρτα ανοίγει (90°)', [{ setup: true }, { sequence: { button: [1] } }, { check: 'servo', angle: 90, fail: 'Με πατημένο κουμπί περίμενα την πόρτα στις 90°. Τώρα: {v}.' }], W),
      TS('Αφήνεις το κουμπί → κλείνει (0°)', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'servo', angle: 0, fail: 'Όταν αφήνεις το κουμπί η πόρτα πρέπει να κλείνει (0°). Τώρα: {v}.' }], W)
    ],
    A3: [
      TS('Ησυχία → πράσινο', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 0, g: 255, b: 0, fail: 'Χωρίς πάτημα περίμενα πράσινο. Τώρα: {v}.' }], W),
      TS('Χτυπά → μπλε, ήχος και ανοιχτή πόρτα', [{ setup: true }, { sequence: { button: [1] } }, { check: 'rgb', r: 0, g: 0, b: 255, fail: 'Όσο χτυπά το κουδούνι περίμενα μπλε. Τώρα: {v}.' }, { check: 'buzzer', is: true, freq: 880, fail: 'Το κουδούνι πρέπει να ακούγεται (880 Hz). Τώρα: {v}.' }, { check: 'servo', angle: 90, fail: 'Η πόρτα πρέπει να ανοίγει (90°). Τώρα: {v}.' }], W),
      TS('Ο μετρητής δουλεύει ακόμα', [{ setup: true }, { sequence: { button: [1, 0, 1, 0, 1, 0] } }, { check: 'oled', has: 'Visitors: 3', fail: 'Μετά από τρία πατήματα περίμενα «Visitors: 3». Βλέπω: {v}.' }, { check: 'rgb', r: 0, g: 255, b: 0, fail: 'Στο τέλος, χωρίς πάτημα, περίμενα πράσινο. Τώρα: {v}.' }], W)
    ],
    B1: [
      TS('Ησυχία → πράσινο, σιωπή', [{ setup: true }, { loops: 1 }, { check: 'rgb', r: 0, g: 255, b: 0, fail: 'Χωρίς κίνηση περίμενα πράσινο. Τώρα: {v}.' }, { check: 'buzzer', is: false, fail: 'Χωρίς κίνηση το buzzer πρέπει να σωπαίνει. Τώρα: {v}.' }], W),
      TS('Κίνηση → κόκκινο και συναγερμός', [{ setup: true }, { sequence: { pir: [1] } }, { check: 'rgb', r: 255, g: 0, b: 0, fail: 'Με κίνηση περίμενα κόκκινο. Τώρα: {v}.' }, { check: 'buzzer', is: true, freq: 880, fail: 'Με κίνηση περίμενα ήχο 880 Hz. Τώρα: {v}.' }], W),
      TS('Η κίνηση σταματά → ησυχία', [{ setup: true }, { sequence: { pir: [1, 0] } }, { check: 'buzzer', is: false, fail: 'Όταν σταματά η κίνηση ο ήχος πρέπει να σταματά. Τώρα: {v}.' }, { check: 'rgb', r: 0, g: 255, b: 0, fail: 'Όταν σταματά η κίνηση περίμενα πράσινο. Τώρα: {v}.' }], W)
    ],
    B2: [
      TS('Στην αρχή: «ARMED»', [{ setup: true }, { loops: 1 }, { check: 'oled', has: 'ARMED', fail: 'Στην αρχή η οθόνη πρέπει να γράφει «ARMED». Βλέπω: {v}.' }], W),
      TS('Ένα πάτημα → «OFF», και η κίνηση αγνοείται (μπλε)', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'oled', has: 'OFF', fail: 'Μετά από ένα πάτημα περίμενα «OFF». Βλέπω: {v}.' }, { set: { pir: true } }, { loops: 1 }, { check: 'buzzer', is: false, fail: 'Αφοπλισμένος συναγερμός δεν πρέπει να χτυπά. Τώρα: {v}.' }, { check: 'rgb', r: 0, g: 0, b: 255, fail: 'Αφοπλισμένος: περίμενα μπλε. Τώρα: {v}.' }], W),
      TS('Δεύτερο πάτημα → ξανά οπλισμένος', [{ setup: true }, { sequence: { button: [1, 0, 1, 0] } }, { check: 'oled', has: 'ARMED', fail: 'Μετά από δύο πατήματα περίμενα ξανά «ARMED». Βλέπω: {v}.' }, { set: { pir: true } }, { loops: 1 }, { check: 'buzzer', is: true, freq: 880, fail: 'Οπλισμένος με κίνηση: περίμενα συναγερμό. Τώρα: {v}.' }], W)
    ],
    B3: [
      TS('Οπλισμένος → πόρτα κλειδωμένη (0°)', [{ setup: true }, { loops: 1 }, { check: 'servo', angle: 0, fail: 'Όσο είναι οπλισμένος η πόρτα πρέπει να είναι στις 0°. Τώρα: {v}.' }, { check: 'oled', has: 'Alarms: 0', fail: 'Στην αρχή περίμενα «Alarms: 0». Βλέπω: {v}.' }], W),
      TS('Δύο κινήσεις → «Alarms: 2»', [{ setup: true }, { sequence: { pir: [1, 1, 0, 1, 0] } }, { check: 'oled', has: 'Alarms: 2', fail: 'Μετά από δύο κινήσεις (η πρώτη κράτησε δύο γύρους) περίμενα «Alarms: 2». Βλέπω: {v}.' }], W),
      TS('Αφοπλισμός → πόρτα ανοιχτή, χωρίς μέτρημα', [{ setup: true }, { sequence: { button: [1, 0] } }, { check: 'servo', angle: 90, fail: 'Αφοπλισμένος: περίμενα την πόρτα στις 90°. Τώρα: {v}.' }, { sequence: { pir: [1, 0] } }, { check: 'oled', has: 'Alarms: 0', fail: 'Αφοπλισμένος η κίνηση δεν μετράει. Βλέπω: {v}.' }, { check: 'rgb', r: 0, g: 0, b: 255, fail: 'Αφοπλισμένος: περίμενα μπλε. Τώρα: {v}.' }], W)
    ]
  };

  const STEPS = [
    {
      key: 'A1', proj: 'A', s: 1, kind: 'guided', hw: ['button', 'buzzer', 'oled'],
      title: 'Έξυπνο κουδούνι · 1: ήχος και οθόνη',
      objectives: ['Να ενώνω κουμπί, buzzer και οθόνη σε μία συσκευή.', 'Να γράφω στην οθόνη διαφορετικό μήνυμα ανάλογα με την είσοδο.'],
      theory: `
<p><strong>Μίνι έργο:</strong> φτιάχνουμε το κουδούνι της εξώπορτας σε τρία βήματα. Κάθε βήμα ξεκινά από τον κώδικα του προηγούμενου.</p>
<p>Βήμα 1: όταν πατιέται το κουμπί, ακούγεται <strong>880 Hz</strong> και η οθόνη γράφει <strong>Ding dong!</strong>. Όταν αφήνεται, σιωπή και <strong>Welcome</strong>.</p>
<p>Η οθόνη σβήνει και ξαναγράφεται σε κάθε γύρο. Γι' αυτό το «σβήσε» είναι πριν από το if και το «στείλε στην οθόνη» μετά.</p>`,
      steps: ['Στο if (πατημένο): ήχος 880 Hz και «Ding dong!».', 'Στο else: σιωπή και «Welcome».', 'Τρέξε και πάτα το κουμπί: άκου και κοίτα την οθόνη.'],
      quiz: { question: 'Γιατί η οθόνη σβήνει (clear / fill(0)) σε κάθε γύρο;', options: ['Για να μη γράφονται τα νέα μηνύματα πάνω στα παλιά', 'Για να κάνει οικονομία ρεύματος', 'Γιατί αλλιώς δεν ακούγεται ο ήχος'], answer: 0, explain: 'Σωστά. Χωρίς σβήσιμο, το «Welcome» και το «Ding dong!» θα έπεφταν το ένα πάνω στο άλλο.', retry: 'Τι θα γινόταν αν γράφαμε ξανά και ξανά στην ίδια θέση χωρίς να σβήσουμε;' },
      hints: ['Ό,τι έμαθες για buzzer και οθόνη μπαίνει τώρα μέσα στο if / else.', 'Ήχος: 880 Hz. Κείμενα: «Ding dong!» και «Welcome».', 'Δες το «σκονάκι» της γλώσσας σου: ήχος, σιωπή και γράψιμο στην οθόνη, μέσα στο if και στο else.'],
      ok: 'Το κουδούνι χτυπά και η οθόνη το λέει! Τρία εξαρτήματα, μία συσκευή.',
      remediation: 'Στο if: ήχος 880 Hz και «Ding dong!». Στο else: σιωπή και «Welcome».'
    },
    {
      key: 'A2', proj: 'A', s: 2, kind: 'guided', hw: ['button', 'buzzer', 'oled', 'servo'],
      title: 'Έξυπνο κουδούνι · 2: πόρτα και μετρητής επισκεπτών',
      objectives: ['Να μετρώ πατήματα με ανίχνευση ακμής.', 'Να ανοίγω την πόρτα με servo όσο χτυπά το κουδούνι.'],
      theory: `
<p>Βήμα 2: η πόρτα ανοίγει (servo στις <strong>90°</strong>) όσο είναι πατημένο το κουμπί, και η οθόνη μετράει τους <strong>επισκέπτες</strong>.</p>
<p>Προσοχή στο μέτρημα: αν γράψεις απλώς «αν πατημένο, visitors + 1», ένα πάτημα που κρατά 10 γύρους θα μετρήσει 10! Θέλουμε τη <strong>στιγμή</strong> που πατήθηκε: τώρα πατημένο <em>και</em> πριν όχι. Αυτό λέγεται <strong>ανίχνευση ακμής</strong>.</p>
<p>Η μεταβλητή <code>wasPressed</code> / <code>was_pressed</code> θυμάται την τιμή του προηγούμενου γύρου.</p>`,
      steps: ['Μέτρα: αν pressed και όχι wasPressed, visitors + 1. Μετά wasPressed = pressed.', 'Πόρτα: 90° στο if, 0° στο else.', 'Οθόνη: «Visitors: » και ο αριθμός, στη δεύτερη γραμμή.'],
      quiz: { question: 'Κρατάς το κουμπί πατημένο για 5 γύρους. Πόσους επισκέπτες μετράει η ανίχνευση ακμής;', options: ['1', '5', '0'], answer: 0, explain: 'Σωστά. Μόνο στον πρώτο γύρο ισχύει «τώρα πατημένο και πριν όχι».', retry: 'Σε πόσους από τους 5 γύρους ήταν το κουμπί ελεύθερο στον προηγούμενο γύρο;' },
      hints: ['Χρειάζεσαι δύο πράγματα: το τωρινό pressed και το προηγούμενο wasPressed / was_pressed.', 'Πρώτα ο έλεγχος «pressed και όχι wasPressed», ΜΕΤΑ η ενημέρωση wasPressed = pressed.', 'Ο servo: 90° μέσα στο if (πατημένο), 0° μέσα στο else.'],
      ok: 'Η πόρτα ανοίγει και ο μετρητής μετράει σωστά, όσο κι αν κρατάς το κουμπί!',
      remediation: 'Έλεγξε τη σειρά: πρώτα το if (pressed και όχι wasPressed), μετά wasPressed = pressed.'
    },
    {
      key: 'A3', proj: 'A', s: 3, kind: 'checkpoint', hw: ['button', 'buzzer', 'oled', 'servo', 'rgb'],
      title: 'Έξυπνο κουδούνι · 3: χωρίς βοήθεια!',
      objectives: ['Να προσθέτω μόνος μου ένα εξάρτημα σε μια συσκευή που δουλεύει.', 'Να μην χαλάω όσα δούλευαν ήδη.'],
      theory: `
<p>Τελευταίο βήμα, <strong>χωρίς βοήθεια</strong>: πρόσθεσε το <strong>LED RGB</strong>.</p>
<ul><li>Όσο χτυπά το κουδούνι: <strong>μπλε</strong>.</li><li>Όταν έχει ησυχία: <strong>πράσινο</strong>.</li></ul>
<p>Ο ήχος, η πόρτα και ο μετρητής πρέπει να συνεχίσουν να δουλεύουν. Ο έλεγχος τα δοκιμάζει όλα μαζί.</p>
<p>Θυμήσου πώς στήνεται το LED RGB στη γλώσσα σου (Κεφάλαιο με τα νέα εξαρτήματα, ή το «σκονάκι» του εργαστηρίου).</p>`,
      steps: ['Στήσε το LED RGB (pins: δες το σκονάκι).', 'Μπλε μέσα στο if, πράσινο μέσα στο else.', 'Τρέξε και έλεγξε ότι όλα τα άλλα δουλεύουν ακόμα.'],
      quiz: { question: 'Πρόσθεσες ένα νέο εξάρτημα. Τι κάνεις πριν πεις «τελείωσα»;', options: ['Ξαναδοκιμάζω και όσα δούλευαν πριν', 'Τίποτα, αφού το καινούργιο δουλεύει', 'Σβήνω τον παλιό κώδικα'], answer: 0, explain: 'Σωστά. Μια αλλαγή μπορεί να χαλάσει κάτι άλλο· γι’ αυτό ο έλεγχος δοκιμάζει όλη τη συσκευή.', retry: 'Μπορεί μια νέα γραμμή να χαλάσει μια παλιά λειτουργία;' },
      hints: ['Χρειάζεσαι τρία κανάλια χρώματος: κόκκινο, πράσινο, μπλε.', 'Μπλε = μόνο το μπλε αναμμένο· πράσινο = μόνο το πράσινο.', 'Μια μικρή συνάρτηση color(r, g, b) κάνει τον κώδικα πιο καθαρό, όπως στο κεφάλαιο με το φως.'],
      ok: 'Το έξυπνο κουδούνι είναι έτοιμο! Κουμπί, ήχος, οθόνη, πόρτα, μετρητής και χρώμα: μια ολόκληρη συσκευή, φτιαγμένη από σένα.',
      remediation: 'Μπλε όσο είναι πατημένο, πράσινο αλλιώς, και κράτα όλα τα προηγούμενα όπως ήταν.'
    },
    {
      key: 'B1', proj: 'B', s: 1, kind: 'guided', hw: ['pir', 'buzzer', 'rgb'],
      title: 'Συναγερμός · 1: κίνηση → ήχος και κόκκινο',
      objectives: ['Να ενώνω αισθητήρα κίνησης, buzzer και LED RGB.', 'Να δείχνω την κατάσταση με χρώμα.'],
      theory: `
<p><strong>Μίνι έργο:</strong> ο συναγερμός του σπιτιού, σε τρία βήματα.</p>
<p>Βήμα 1: όταν ο <strong>PIR</strong> βλέπει κίνηση, ακούγεται <strong>880 Hz</strong> και το φως γίνεται <strong>κόκκινο</strong>. Όταν δεν υπάρχει κίνηση, σιωπή και <strong>πράσινο</strong>.</p>
<p>Η συνάρτηση <code>color</code> (ή το <code>led.color</code>) είναι έτοιμη.</p>`,
      steps: ['Στο if (κίνηση): ήχος 880 Hz και κόκκινο.', 'Στο else: σιωπή και πράσινο.', 'Τρέξε και κάνε κίνηση στη σκηνή.'],
      quiz: { question: 'Γιατί ένας συναγερμός έχει και φως και ήχο;', options: ['Ο ήχος τραβάει την προσοχή, το φως δείχνει την κατάσταση με μια ματιά', 'Γιατί το buzzer χρειάζεται το LED για να δουλέψει', 'Δεν χρειάζεται, είναι διακοσμητικό'], answer: 0, explain: 'Σωστά. Δύο διαφορετικοί τρόποι να μάθεις τι γίνεται, ακόμα κι αν δεν ακούς ή δεν βλέπεις καλά.', retry: 'Σκέψου κάποιον που δεν ακούει καλά, ή ένα θορυβώδες δωμάτιο.' },
      hints: ['Ό,τι έμαθες για buzzer και LED RGB μπαίνει μέσα στο if / else.', 'Κόκκινο = μόνο το κόκκινο αναμμένο, πράσινο = μόνο το πράσινο.', 'Δες το «σκονάκι» της γλώσσας σου για ήχο, σιωπή και χρώμα.'],
      ok: 'Ο συναγερμός αντιδρά στην κίνηση! Τώρα χρειάζεται τρόπο να τον σβήνουμε…',
      remediation: 'Στο if: ήχος 880 Hz και κόκκινο. Στο else: σιωπή και πράσινο.'
    },
    {
      key: 'B2', proj: 'B', s: 2, kind: 'guided', hw: ['pir', 'buzzer', 'rgb', 'button', 'oled'],
      title: 'Συναγερμός · 2: όπλιση και αφόπλιση με το κουμπί',
      objectives: ['Να κάνω εναλλαγή (toggle) μιας κατάστασης με ένα κουμπί.', 'Να δείχνω την κατάσταση στην οθόνη.'],
      theory: `
<p>Βήμα 2: κάθε <strong>πάτημα</strong> του κουμπιού <strong>οπλίζει ή αφοπλίζει</strong> τον συναγερμό. Η οθόνη γράφει <strong>ARMED</strong> ή <strong>OFF</strong> (αυτό είναι ήδη έτοιμο).</p>
<ol><li>Με ανίχνευση ακμής, όπως στο κουδούνι: <code>armed = !armed</code> (C++, Rust) ή <code>armed = not armed</code> (Python). Αυτό είναι η <strong>εναλλαγή</strong>.</li>
<li>Ο συναγερμός χτυπά μόνο αν <strong>είναι οπλισμένος ΚΑΙ</strong> υπάρχει κίνηση.</li>
<li>Αφοπλισμένος: σιωπή και <strong>μπλε</strong>.</li></ol>`,
      steps: ['Πρόσθεσε την εναλλαγή με το κουμπί (ανίχνευση ακμής).', 'Άλλαξε τη συνθήκη σε «οπλισμένος ΚΑΙ κίνηση».', 'Πρόσθεσε την περίπτωση «αφοπλισμένος»: σιωπή και μπλε.'],
      quiz: { question: 'Τι θα γινόταν αν η εναλλαγή γινόταν σε κάθε γύρο που είναι πατημένο το κουμπί (χωρίς ακμή);', options: ['Θα άλλαζε συνέχεια ON/OFF όσο κρατάς το κουμπί, και θα κατέληγε τυχαία', 'Θα δούλευε κανονικά', 'Δεν θα άλλαζε ποτέ'], answer: 0, explain: 'Σωστά. Γι’ αυτό η εναλλαγή γίνεται μόνο τη στιγμή που πατιέται.', retry: 'Ένα πάτημα κρατά πολλούς γύρους. Πόσες φορές θα γύριζε το armed;' },
      hints: ['Ίδια ανίχνευση ακμής με τον μετρητή του κουδουνιού, μόνο που αντί για +1 γυρίζεις το armed στο αντίθετο.', 'Η συνθήκη του συναγερμού: armed && motion (ή armed and motion).', 'Μετά το if του συναγερμού: else if !armed (ή elif not armed) με σιωπή και μπλε.'],
      ok: 'Ο συναγερμός οπλίζει και αφοπλίζει με ένα κουμπί, και η οθόνη λέει πάντα την αλήθεια!',
      remediation: 'Εναλλαγή με ακμή, συνθήκη «armed ΚΑΙ κίνηση», και μπλε όταν δεν είναι οπλισμένος.'
    },
    {
      key: 'B3', proj: 'B', s: 3, kind: 'checkpoint', hw: ['pir', 'buzzer', 'rgb', 'button', 'oled', 'servo'],
      title: 'Συναγερμός · 3: χωρίς βοήθεια!',
      objectives: ['Να συνδυάζω ανίχνευση ακμής με μια κατάσταση (armed).', 'Να ελέγχω servo από την κατάσταση της συσκευής.'],
      theory: `
<p>Τελευταίο βήμα, <strong>χωρίς βοήθεια</strong>:</p>
<ol><li><strong>Μέτρα τους συναγερμούς:</strong> κάθε φορά που <em>ξεκινά</em> κίνηση ενώ είναι οπλισμένος, +1. Η οθόνη γράφει στη δεύτερη γραμμή <strong>Alarms: N</strong>.</li>
<li><strong>Κλείδωσε την πόρτα:</strong> servo στις <strong>0°</strong> όσο είναι οπλισμένος, στις <strong>90°</strong> όταν όχι.</li></ol>
<p>Όσο είναι αφοπλισμένος, η κίνηση <strong>δεν μετράει</strong>. Όλα τα προηγούμενα πρέπει να δουλεύουν ακόμα.</p>`,
      steps: ['Στήσε τον servo και δύο μεταβλητές: alarms και wasMotion / was_motion.', 'Μέτρα με ακμή κίνησης, μόνο όταν είναι οπλισμένος.', 'Πόρτα: 0° οπλισμένος, 90° αφοπλισμένος. Οθόνη: «Alarms: N».'],
      quiz: { question: 'Μια κίνηση κρατά 3 γύρους με τον συναγερμό οπλισμένο. Πόσους συναγερμούς πρέπει να μετρήσει;', options: ['1', '3', '0'], answer: 0, explain: 'Σωστά. Ακμή: μετράει μόνο η στιγμή που ξεκίνησε η κίνηση.', retry: 'Θυμήσου την ανίχνευση ακμής του μετρητή επισκεπτών.' },
      hints: ['Είναι η ίδια ιδέα με τον μετρητή επισκεπτών, αλλά με την κίνηση και με μία συνθήκη ακόμα (armed).', 'if armed && motion && !wasMotion → alarms + 1 · μετά wasMotion = motion.', 'Ο servo: if armed → 0°, αλλιώς 90°. Στην οθόνη, «Alarms: » + αριθμός στη δεύτερη γραμμή.'],
      ok: 'Ο συναγερμός σου είναι ολοκληρωμένος! Κίνηση, ήχος, χρώμα, οθόνη, κουμπί και κλειδαριά: ένα πραγματικό σύστημα ασφαλείας.',
      remediation: 'Μέτρα με ακμή κίνησης μόνο όταν armed, πόρτα 0° οπλισμένος / 90° όχι, και «Alarms: N» στην οθόνη.'
    }
  ];

  // ================================================================== κεφάλαια ανά διαδρομή
  const TRACKS = [
    { n: 27, track: null, lang: 'cpp', board: 'esp32', after: 25, gen: CPP, skill: null, panels: ['serial', 'vars', 'branch', 'loops'] },
    { n: 28, track: 'py-pi', lang: 'python', board: 'pi', after: 26, gen: PY, skill: 'python', panels: ['serial', 'vars', 'branch', 'loops'] },
    { n: 37, track: 'py-esp32', lang: 'python', board: 'esp32', after: 36, gen: MP, skill: 'python', panels: ['serial', 'vars', 'branch', 'loops'] },
    { n: 48, track: 'rs-pi', lang: 'rust', board: 'pi', after: 47, gen: rust('pi'), skill: 'rust', panels: ['serial', 'vars', 'loops'] },
    { n: 58, track: 'rs-esp32', lang: 'rust', board: 'esp32', after: 57, gen: rust('esp32'), skill: 'rust', panels: ['serial', 'vars', 'loops'] }
  ];
  for (const tr of TRACKS) {
    const ch = { n: tr.n, title: 'Μίνι έργα: κουδούνι και συναγερμός', ready: true, bonus: true, unlockAfter: tr.after };
    if (tr.track) Object.assign(ch, { track: tr.track, lang: tr.lang, board: tr.board });
    L.CHAPTERS.push(ch);
    STEPS.forEach((st, i) => {
      const world = Object.assign({}, W);
      const lesson = {
        id: `c${tr.n}-l${i + 1}`, chapter: tr.n, kind: st.kind,
        missionStory: st.proj === 'A' ? 'Στην εξώπορτα φτιάχνεις ένα έξυπνο κουδούνι: παίζει ήχο, γράφει στην οθόνη, ανοίγει την πόρτα και μετράει τους επισκέπτες.' : 'Στην είσοδο στήνεις τον συναγερμό του σπιτιού: ο αισθητήρας κίνησης φυλάει, το κουμπί οπλίζει και αφοπλίζει, και η πόρτα κλειδώνει.',
        skills: (tr.skill ? [tr.skill] : []).concat(['io', 'state', 'conditions']),
        title: st.title, prerequisites: i === 0 ? [] : [`c${tr.n}-l${i}`],
        objectives: st.objectives, theory: st.theory,
        glossary: ['μίνι έργο'].concat(st.s >= 2 ? ['ανίχνευση ακμής'] : [], st.key === 'B2' ? ['εναλλαγή (toggle)'] : []),
        supportedSyntax: 'Όσα έμαθες στα κεφάλαια με τα εξαρτήματα: κουμπί, PIR, buzzer, servo, LED RGB, οθόνη, if / else, μεταβλητές',
        initialCode: tr.gen[st.proj](st.s, true), solution: tr.gen[st.proj](st.s, false),
        world, initialWorld: world, hardware: st.hw, panels: tr.panels,
        steps: st.steps, quiz: st.quiz, hints: st.hints,
        validationTests: T[st.key],
        explanationOnSuccess: st.ok, remediation: st.remediation
      };
      if (tr.track) Object.assign(lesson, { lang: tr.lang, board: tr.board });
      L.lessons.push(lesson);
    });
  }

  L.PROJECTS = { CPP, MP, PY, rust };
})(typeof window !== 'undefined' ? window : globalThis);
