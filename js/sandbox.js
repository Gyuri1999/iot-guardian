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
    { id: 'traffic', label: 'Φανάρι' }
  ];
  // Ποια εξαρτήματα έχει κάθε πλακέτα στο παιχνίδι (το Pi δεν έχει WiFi router στη σκηνή του).
  const ALLOWED = { esp32: ['led', 'button', 'pir', 'sensor', 'router', 'ultrasonic', 'traffic'], pi: ['led', 'button', 'pir', 'ultrasonic', 'traffic'] };

  const PINS = {
    esp32: [['LED', 'GPIO 2 (LED_PIN)'], ['Κουμπί', 'GPIO 15 (BUTTON_PIN)'], ['PIR', 'GPIO 4 (PIR_PIN)'], ['TRIG / ECHO', 'GPIO 5 / GPIO 18'], ['Φανάρι κόκκινο / κίτρινο / πράσινο', 'GPIO 25 / 26 / 27'], ['Θερμόμετρο', 'readTemperature() · readHumidity()']],
    pi: [['LED', 'GPIO 17'], ['Κουμπί', 'GPIO 27'], ['PIR', 'GPIO 4'], ['TRIG / ECHO', 'GPIO 23 / GPIO 24'], ['Φανάρι κόκκινο / κίτρινο / πράσινο', 'GPIO 16 / 20 / 21']]
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
    'cpp-esp32': [['pinMode(LED_PIN, OUTPUT);', 'το pin γίνεται έξοδος'], ['digitalWrite(LED_PIN, HIGH);', 'ανάβει (LOW: σβήνει)'], ['digitalRead(BUTTON_PIN)', 'HIGH ή LOW'], ['delay(500);', 'περίμενε 500 ms'], ['millis()', 'ms από την εκκίνηση'], ['Serial.println("…");', 'μήνυμα στο Serial Monitor'], ['readTemperature()', 'θερμοκρασία σε °C'], ['pulseIn(ECHO_PIN, HIGH)', 'διάρκεια ηχούς σε µs']],
    'py-pi': [['led = LED(17)', 'LED στο GPIO 17'], ['led.on() / led.off()', 'ανάβει / σβήνει'], ['btn = Button(27)', 'κουμπί στο GPIO 27'], ['btn.is_pressed', 'True όσο είναι πατημένο'], ['pir = MotionSensor(4)', 'αισθητήρας κίνησης'], ['pir.motion_detected', 'True όταν βλέπει κίνηση'], ['time.sleep(0.5)', 'περίμενε μισό δευτερόλεπτο'], ['print(f"…{x}")', 'μήνυμα στο τερματικό']],
    'py-esp32': [['led = Pin(2, Pin.OUT)', 'LED ως έξοδος'], ['led.on() / led.value(0)', 'ανάβει / σβήνει'], ['btn = Pin(15, Pin.IN)', 'κουμπί ως είσοδος'], ['btn.value()', '1 ή 0'], ['time.sleep_ms(500)', 'περίμενε 500 ms'], ['time.ticks_ms()', 'ms από την εκκίνηση'], ['time_pulse_us(echo, 1)', 'διάρκεια ηχούς σε µs'], ['print("…")', 'μήνυμα στο τερματικό']],
    'rs-pi': [['let gpio = Gpio::new()?;', 'πρόσβαση στα GPIO'], ['gpio.get(17)?.into_output()', 'LED ως έξοδος'], ['led.set_high() / set_low()', 'ανάβει / σβήνει'], ['gpio.get(27)?.into_input()', 'κουμπί ως είσοδος'], ['button.is_high()', 'true όσο είναι πατημένο'], ['thread::sleep(Duration::from_millis(500))', 'περίμενε 500 ms'], ['println!("{x}")', 'μήνυμα στο τερματικό']],
    'rs-esp32': [['PinDriver::output(peripherals.pins.gpio2)?', 'LED ως έξοδος'], ['led.set_high()?', 'ανάβει (set_low: σβήνει)'], ['PinDriver::input(peripherals.pins.gpio15)?', 'κουμπί ως είσοδος'], ['button.is_high()', 'true όσο είναι πατημένο'], ['FreeRtos::delay_ms(500)', 'περίμενε 500 ms'], ['println!("{x}")', 'μήνυμα στο τερματικό']]
  };

  const IDEAS = {
    led: ['Κάνε το LED να αναβοσβήνει όλο και πιο γρήγορα.', 'Στείλε SOS σε Morse: τρία σύντομα, τρία μακριά, τρία σύντομα.'],
    button: ['Μέτρα πόσες φορές πατήθηκε το κουμπί και τύπωσέ το.', 'Κάνε το κουμπί διακόπτη: ένα πάτημα ανάβει, το επόμενο σβήνει.'],
    pir: ['Άναψε το φως για 3 δευτερόλεπτα μετά από κάθε κίνηση.', 'Μέτρα πόσες φορές πέρασε η γιαγιά από τον διάδρομο.'],
    sensor: ['Τύπωσε τη θερμοκρασία κάθε δευτερόλεπτο.', 'Άναψε το LED όταν η θερμοκρασία ξεπεράσει τους 28 °C.'],
    router: ['Σύνδεσου στο WiFi και τύπωσε τη διεύθυνση IP.', 'Αν χαθεί το WiFi, άναψε το LED ως προειδοποίηση.'],
    ultrasonic: ['Τύπωσε την απόσταση σε εκατοστά δύο φορές το δευτερόλεπτο.', 'Όσο πλησιάζει το αυτοκίνητο, τόσο πιο γρήγορα να αναβοσβήνει κάτι.'],
    traffic: ['Φτιάξε κανονικό φανάρι: πράσινο 3 δ, κίτρινο 1 δ, κόκκινο 3 δ.', 'Φανάρι με τέσσερις ζώνες απόστασης, με κόκκινο που αναβοσβήνει πολύ κοντά.']
  };

  const EXT = { cpp: 'ino', python: 'py', rust: 'rs' };

  root.IoTSandbox = { COMPONENTS, ALLOWED, PINS, BLANK, CHEAT, IDEAS, EXT };
})(typeof window !== 'undefined' ? window : globalThis);
