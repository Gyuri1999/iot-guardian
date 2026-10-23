/*
 * IoT Guardian — ελεύθερο εργαστήριο: δεδομένα για τον πάγκο χωρίς ασκήσεις.
 * Εξαρτήματα, κώδικας-αφετηρία ανά διαδρομή, pins ανά πλακέτα, «σκονάκι» εντολών ανά γλώσσα, ιδέες.
 */
(function (root) {
  'use strict';

  const COMPONENTS = [
    { id: 'led', label: 'LED' },
    { id: 'button', label: 'Κουμπί' },
    { id: 'pir', label: 'Αισθητήρας κίνησης (PIR)' },
    { id: 'sensor', label: 'Θερμόμετρο / υγρασία' },
    { id: 'router', label: 'Router WiFi' },
    { id: 'ultrasonic', label: 'Αισθητήρας απόστασης + αυτοκίνητο' },
    { id: 'traffic', label: 'Φανάρι' },
    { id: 'buzzer', label: 'Buzzer (ήχος)' },
    { id: 'servo', label: 'Servo (κίνηση)' },
    { id: 'rgb', label: 'LED RGB (χρώμα)' },
    { id: 'oled', label: 'Οθόνη OLED' }
  ];
  // Ποια εξαρτήματα έχει κάθε πλακέτα στο παιχνίδι (το Pi δεν έχει WiFi router στη σκηνή του).
  const ALLOWED = { esp32: ['led', 'button', 'pir', 'sensor', 'router', 'ultrasonic', 'traffic'], pi: ['led', 'button', 'pir', 'ultrasonic', 'traffic'] };
  // buzzer, servo, LED RGB και OLED: σε όλες τις διαδρομές
  const NEW_PARTS = ['buzzer', 'servo', 'rgb', 'oled'];
  const allowed = (track, board) => (ALLOWED[board] || ALLOWED.esp32).concat(NEW_PARTS);

  const PINS = {
    esp32: [['LED', 'GPIO 2 (LED_PIN)'], ['Κουμπί', 'GPIO 15 (BUTTON_PIN)'], ['PIR', 'GPIO 4 (PIR_PIN)'], ['TRIG / ECHO', 'GPIO 5 / GPIO 18'], ['Φανάρι κόκκινο / κίτρινο / πράσινο', 'GPIO 25 / 26 / 27'], ['Θερμόμετρο', 'readTemperature() · readHumidity()'], ['Buzzer', 'GPIO 23 (BUZZER_PIN)'], ['Servo', 'GPIO 19 (SERVO_PIN)'], ['LED RGB', 'GPIO 32 / 33 / 14'], ['Οθόνη OLED (I2C)', 'SDA 21 · SCL 22']],
    pi: [['LED', 'GPIO 17'], ['Κουμπί', 'GPIO 27'], ['PIR', 'GPIO 4'], ['TRIG / ECHO', 'GPIO 23 / GPIO 24'], ['Φανάρι κόκκινο / κίτρινο / πράσινο', 'GPIO 16 / 20 / 21'], ['Buzzer', 'GPIO 22'], ['Servo', 'GPIO 18'], ['LED RGB', 'GPIO 5 / 6 / 13'], ['Οθόνη OLED (I2C)', 'SDA 2 · SCL 3']]
  };

  const BLANK = {
    'cpp-esp32': `// Ελεύθερο εργαστήριο: γράψε ό,τι θέλεις!
void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_PIN, LOW);
  delay(500);
}
`,
    'py-pi': `# Ελεύθερο εργαστήριο: γράψε ό,τι θέλεις!
from gpiozero import LED
import time

led = LED(17)

while True:
    led.on()
    time.sleep(0.5)
    led.off()
    time.sleep(0.5)
`,
    'py-esp32': `# Ελεύθερο εργαστήριο: γράψε ό,τι θέλεις!
from machine import Pin
import time

led = Pin(2, Pin.OUT)

while True:
    led.on()
    time.sleep_ms(500)
    led.off()
    time.sleep_ms(500)
`,
    'rs-pi': `// Ελεύθερο εργαστήριο: γράψε ό,τι θέλεις!
use rppal::gpio::Gpio;
use std::error::Error;
use std::thread;
use std::time::Duration;

fn main() -> Result<(), Box<dyn Error>> {
    let gpio = Gpio::new()?;
    let mut led = gpio.get(17)?.into_output();

    loop {
        led.set_high();
        println!("ON");
        thread::sleep(Duration::from_millis(500));
        led.set_low();
        println!("OFF");
        thread::sleep(Duration::from_millis(500));
    }
}
`,
    'rs-esp32': `// Ελεύθερο εργαστήριο: γράψε ό,τι θέλεις!
use esp_idf_svc::hal::delay::FreeRtos;
use esp_idf_svc::hal::gpio::PinDriver;
use esp_idf_svc::hal::peripherals::Peripherals;

fn main() -> anyhow::Result<()> {
    esp_idf_svc::sys::link_patches();
    let peripherals = Peripherals::take()?;
    let mut led = PinDriver::output(peripherals.pins.gpio2)?;

    loop {
        led.set_high()?;
        println!("ON");
        FreeRtos::delay_ms(500);
        led.set_low()?;
        println!("OFF");
        FreeRtos::delay_ms(500);
    }
}
`
  };

  const CHEAT = {
    'cpp-esp32': [['pinMode(LED_PIN, OUTPUT);', 'το pin γίνεται έξοδος'], ['digitalWrite(LED_PIN, HIGH);', 'ανάβει (LOW: σβήνει)'], ['digitalRead(BUTTON_PIN)', 'HIGH ή LOW'], ['delay(500);', 'περίμενε 500 ms'], ['millis()', 'ms από την εκκίνηση'], ['Serial.println("…");', 'μήνυμα στο Serial Monitor'], ['readTemperature()', 'θερμοκρασία σε °C'], ['pulseIn(ECHO_PIN, HIGH)', 'διάρκεια ηχούς σε µs'], ['tone(BUZZER_PIN, 440)', 'ήχος 440 Hz (noTone: σιωπή)'], ['servo.attach(SERVO_PIN); servo.write(90);', 'servo στις 90°'], ['analogWrite(RGB_RED_PIN, 255)', 'χρώμα 0–255 σε κάθε κανάλι'], ['display.println("…"); display.display();', 'κείμενο στην οθόνη']],
    'py-pi': [['led = LED(17)', 'LED στο GPIO 17'], ['led.on() / led.off()', 'ανάβει / σβήνει'], ['btn = Button(27)', 'κουμπί στο GPIO 27'], ['btn.is_pressed', 'True όσο είναι πατημένο'], ['pir = MotionSensor(4)', 'αισθητήρας κίνησης'], ['pir.motion_detected', 'True όταν βλέπει κίνηση'], ['time.sleep(0.5)', 'περίμενε μισό δευτερόλεπτο'], ['print(f"…{x}")', 'μήνυμα στο τερματικό'], ['buzzer = TonalBuzzer(22); buzzer.play(Tone("A4"))', 'νότα λα (buzzer.stop(): σιωπή)'], ['servo = AngularServo(18, min_angle=0, max_angle=180, min_pulse_width=0.0005, max_pulse_width=0.0025); servo.angle = 90', 'servo στις 90°'], ['rgb = RGBLED(red=5, green=6, blue=13); rgb.color = (1, 0.5, 0)', 'χρώμα: κάθε κανάλι 0 έως 1'], ['oled = adafruit_ssd1306.SSD1306_I2C(128, 64, busio.I2C(board.SCL, board.SDA)); oled.text("…", 0, 0, 1); oled.show()', 'κείμενο στην οθόνη']],
    'py-esp32': [['buzzer = PWM(Pin(23)); buzzer.freq(440); buzzer.duty_u16(32768)', 'ήχος 440 Hz (duty_u16(0): σιωπή)'], ['servo = PWM(Pin(19), freq=50); servo.duty(77)', 'servo στις 90° (26 = 0°, 128 = 180°)'], ['PWM(Pin(32)).duty(0…1023)', 'LED RGB: κόκκινο 32, πράσινο 33, μπλε 14'], ['oled.fill(0); oled.text("…", 0, 0); oled.show()', 'οθόνη: I2C(0, scl=Pin(22), sda=Pin(21))'], ['led = Pin(2, Pin.OUT)', 'LED ως έξοδος'], ['led.on() / led.value(0)', 'ανάβει / σβήνει'], ['btn = Pin(15, Pin.IN)', 'κουμπί ως είσοδος'], ['btn.value()', '1 ή 0'], ['time.sleep_ms(500)', 'περίμενε 500 ms'], ['time.ticks_ms()', 'ms από την εκκίνηση'], ['time_pulse_us(echo, 1)', 'διάρκεια ηχούς σε µs'], ['print("…")', 'μήνυμα στο τερματικό']],
    'rs-pi': [['let gpio = Gpio::new()?;', 'πρόσβαση στα GPIO'], ['gpio.get(17)?.into_output()', 'LED ως έξοδος'], ['led.set_high() / set_low()', 'ανάβει / σβήνει'], ['gpio.get(27)?.into_input()', 'κουμπί ως είσοδος'], ['button.is_high()', 'true όσο είναι πατημένο'], ['thread::sleep(Duration::from_millis(500))', 'περίμενε 500 ms'], ['println!("{x}")', 'μήνυμα στο τερματικό'], ['buzzer.set_pwm_frequency(440.0, 0.5)?', 'ήχος 440 Hz στο GPIO 22 (clear_pwm()?: σιωπή)'], ['servo.set_pwm(Duration::from_millis(20), Duration::from_micros(1500))?', 'servo (GPIO 18) στις 90°'], ['red.set_pwm_frequency(100.0, 0.5)?', 'LED RGB: GPIO 5 / 6 / 13, duty 0.0–1.0'], ['Text::with_baseline("…", Point::new(0, 0), style, Baseline::Top).draw(&mut display).unwrap()', 'οθόνη: μετά display.flush().unwrap()']],
    'rs-esp32': [['PinDriver::output(peripherals.pins.gpio2)?', 'LED ως έξοδος'], ['led.set_high()?', 'ανάβει (set_low: σβήνει)'], ['PinDriver::input(peripherals.pins.gpio15)?', 'κουμπί ως είσοδος'], ['button.is_high()', 'true όσο είναι πατημένο'], ['FreeRtos::delay_ms(500)', 'περίμενε 500 ms'], ['println!("{x}")', 'μήνυμα στο τερματικό'], ['LedcTimerDriver::new(peripherals.ledc.timer0, &TimerConfig::new().frequency(Hertz(440)))?', 'timer PWM: η συχνότητα'], ['LedcDriver::new(peripherals.ledc.channel0, &timer, peripherals.pins.gpio23)?', 'κανάλι PWM στο buzzer (servo 19, RGB 32 / 33 / 14)'], ['buzzer.set_duty(buzzer.get_max_duty() / 2)?', 'ήχος (set_duty(0)?: σιωπή)'], ['I2cDriver::new(peripherals.i2c0, peripherals.pins.gpio21, peripherals.pins.gpio22, &I2cConfig::new())?', 'δίαυλος της οθόνης (μετά ssd1306)']]
  };

  const IDEAS = {
    led: ['Κάνε το LED να αναβοσβήνει όλο και πιο γρήγορα.', 'Στείλε SOS σε Morse: τρία σύντομα, τρία μακριά, τρία σύντομα.'],
    button: ['Μέτρα πόσες φορές πατήθηκε το κουμπί και τύπωσέ το.', 'Κάνε το κουμπί διακόπτη: ένα πάτημα ανάβει, το επόμενο σβήνει.'],
    pir: ['Άναψε το φως για 3 δευτερόλεπτα μετά από κάθε κίνηση.', 'Μέτρα πόσες φορές πέρασε η γιαγιά από τον διάδρομο.'],
    sensor: ['Τύπωσε τη θερμοκρασία κάθε δευτερόλεπτο.', 'Άναψε το LED όταν η θερμοκρασία ξεπεράσει τους 28 °C.'],
    router: ['Σύνδεσου στο WiFi και τύπωσε τη διεύθυνση IP.', 'Αν χαθεί το WiFi, άναψε το LED ως προειδοποίηση.'],
    ultrasonic: ['Τύπωσε την απόσταση σε εκατοστά δύο φορές το δευτερόλεπτο.', 'Όσο πλησιάζει το αυτοκίνητο, τόσο πιο γρήγορα να αναβοσβήνει κάτι.'],
    buzzer: ['Παίξε μια μικρή μελωδία όταν πατηθεί το κουμπί.', 'Κάνε σειρήνα: η συχνότητα να ανεβοκατεβαίνει.'],
    servo: ['Κάνε το servo να «σκουπίζει» αργά από 0° σε 180° και πίσω.', 'Ανοίξε την πόρτα όταν ο PIR δει κίνηση.'],
    rgb: ['Φτιάξε ουράνιο τόξο: κόκκινο, πορτοκαλί, κίτρινο, πράσινο, μπλε.', 'Κάνε το χρώμα να «αναπνέει» σιγά σιγά.'],
    oled: ['Δείξε στην οθόνη πόσες φορές πατήθηκε το κουμπί.', 'Φτιάξε ρολόι: δευτερόλεπτα από την εκκίνηση με millis().'],
    traffic: ['Φτιάξε κανονικό φανάρι: πράσινο 3 δ, κίτρινο 1 δ, κόκκινο 3 δ.', 'Φανάρι με τέσσερις ζώνες απόστασης, με κόκκινο που αναβοσβήνει πολύ κοντά.']
  };

  const EXT = { cpp: 'ino', python: 'py', rust: 'rs' };

  root.IoTSandbox = { allowed, NEW_PARTS, COMPONENTS, ALLOWED, PINS, BLANK, CHEAT, IDEAS, EXT };
})(typeof window !== 'undefined' ? window : globalThis);
