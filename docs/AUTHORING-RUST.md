# Οδηγός συγγραφής: διαδρομή Rust

Συμπλήρωμα του `docs/AUTHORING.md`. Ισχύουν όλες οι βασικές αρχές εκεί (ελληνικά, δυσλεξία, μόνο αμυντική ασφάλεια, έλεγχος με συμπεριφορά).

## Πού είναι τα μαθήματα

- `js/lessons/rs1.js` … `rs6.js`, ένα αρχείο ανά θέμα.
- Κάθε αρχείο ορίζει **ένα κεφάλαιο μία φορά** και παράγει **δύο**:
  - Raspberry Pi: κεφάλαια 41–46, `track: 'rs-pi'`, `board: 'pi'`, crate `rppal`.
  - ESP32: κεφάλαια 51–56, `track: 'rs-esp32'`, `board: 'esp32'`, crate `esp-idf-svc` (με std).
- Το UI δείχνει τα κεφάλαια ως «Κεφάλαιο 1–6» της διαδρομής. Γι’ αυτό, στο κείμενο **μη γράφεις** «Κεφάλαιο 43». Γράψε «στο προηγούμενο κεφάλαιο» ή «στο κεφάλαιο για το ownership».
- Το `rs1.js` ορίζει το `L.RustKit` (εργαλεία για όλα). Πρέπει να φορτώνεται **πρώτο** από τα `rs*.js`. Η σειρά στο `index.html`: `rs1.js` … `rs6.js`, μετά το `lessons.js`.

```js
const K = L.RustKit;
K.addGlossary([{ term: '…', def: '…' }]);          // μόνο όροι που λείπουν
K.defineChapter(2, 'Τίτλος', B => [ { kind: 'guided', … }, … ]);
```

Το `defineChapter(idx, title, build)` καλεί το `build(B)` μία φορά για κάθε πλακέτα. Συμπληρώνει μόνο του:
- `id` (`c42-l1` …),
- `chapter`, `lang: 'rust'`, `board`,
- `prerequisites` (αλυσίδα μέσα στο κεφάλαιο της ίδιας πλακέτας),
- `initialWorld` (= `world`).

Προεπιλογές: `hardware: []`, `panels: ['serial', 'vars', 'loops']`.

## Το αντικείμενο πλακέτας `B`

| Πεδίο | Pi | ESP32 |
|---|---|---|
| `B.name`, `B.crate`, `B.term` | `Raspberry Pi`, `rppal`, `τερματικό` | `ESP32`, `esp-idf-svc`, `Serial Monitor` |
| `B.P` (pins) | LED 17, κουμπί 27, PIR 4, TRIG 23, ECHO 24, φανάρι 16/20/21 | LED 2, κουμπί 15, PIR 4, TRIG 5, ECHO 18, φανάρι 25/26/27 |
| `B.uses({ sleep, us, instant, outs, ins })` | γραμμές `use` (Gpio, OutputPin/InputPin, Error, thread, time) | γραμμές `use` (FreeRtos/Ets, GpioN/Output/Input/PinDriver, Peripherals, time) |
| `B.mainHw` | `fn main() -> Result<(), Box<dyn Error>> {` + `let gpio = Gpio::new()?;` | `fn main() -> anyhow::Result<()> {` + `link_patches()` + `Peripherals::take()?` |
| `B.mainPlain` | `fn main() {` | `fn main() {` + `esp_idf_svc::sys::link_patches();` |
| `B.pin('led')` | `let mut led = gpio.get(17)?.into_output();` | `let mut led = PinDriver::output(peripherals.pins.gpio2)?;` |
| `B.w('led', 'set_high')` | `led.set_high();` | `led.set_high()?;` |
| `B.sleep(ms)`, `B.sleepUs(us)` | `thread::sleep(Duration::from_millis(ms));` | `FreeRtos::delay_ms(ms);`, `Ets::delay_us(us);` |
| `B.outTy('led')`, `B.inTy('echo')` | `OutputPin`, `InputPin` | `PinDriver<'static, Gpio2, Output>`, `PinDriver<'static, Gpio18, Input>` |
| `B.q`, `B.ret`, `B.okEnd` | `''` | `'?'`, `' -> anyhow::Result<()>'`, `'\n    Ok(())'` (για βοηθητικές συναρτήσεις που γράφουν σε pins) |

Μόνο οι γραμμές πλακέτας διαφέρουν. Η λογική του προγράμματος γράφεται μία φορά.

## Υποστηριζόμενη Rust (εκπαιδευτικό υποσύνολο)

- `fn`, `let` / `let mut`, `const`, `if` / `else` (και ως έκφραση), `loop` (και `break τιμή`), `while`, `for` σε ranges / Vec / πίνακες / `.iter()` / `.enumerate()`.
- `match`: λεκτικά, περιοχές (`0..=19`), enums, Option / Result (και φωλιασμένα: `Ok(Command::Blink(n))`), guards (`Ok(t) if t <= 10`), ζευγάρια (`match (word, arg)`). Επίσης `if let`, `while let`.
- `struct` + `impl` (`&self`, `&mut self`, `self`), enums χωρίς δεδομένα και με δεδομένα σε παρενθέσεις, `#[derive(Debug, Clone, Copy, PartialEq)]`.
- `String`, `&str`, `Vec`, πίνακες, Option, Result, `?`.
- Ακέραιοι με panic σε overflow, `checked_` / `saturating_` / `wrapping_`, `f32` / `f64`, `as`.
- `println!`, `print!`, `format!`, `vec!`, `panic!`, `assert!`, `assert_eq!`.
- Μορφές: `{}`, `{:?}`, `{:#?}`, `{όνομα}`, `{:.1}`, `{:>5}`, `{:05}`.
- **Δεν** υπάρχουν: closures, generics, ορισμοί traits, modules, lifetimes σε κώδικα μαθητή, HashMap.
  - Το `'static` μέσα στο `PinDriver<'static, …>` γίνεται δεκτό ως όνομα τύπου.

Ο κύριος βρόχος είναι το **πρώτο `loop { }` που είναι εντολή στο σώμα της `main`**. Κάθε γύρος του είναι μία «επανάληψη» για τα `{ loops: n }`.
- Ένα `loop` που θέλει `break` πριν από τον κύριο βρόχο γράψ’ το ως `let x = loop { … break τιμή; };`.
- Αλλιώς θα θεωρηθεί κύριος βρόχος.

Πρόγραμμα χωρίς `loop` τρέχει ολόκληρο στο `{ setup: true }`. Για έλεγχο χρόνου σε τέτοιο πρόγραμμα χρησιμοποίησε `{ ms: … }` ως πρώτο βήμα, χωρίς `setup`.

## Έλεγχοι (compile) που μοιάζουν με το rustc

Ο `rscheck.js` πιάνει:
- E0384, E0596, E0382 (και σε βρόχους, και `peripherals.pins.gpio2` δύο φορές),
- E0308 (και το ξεχασμένο `;` στο τέλος συνάρτησης, και `let n: u32 = s.parse();` χωρίς `?`),
- E0277, E0004 (και φωλιασμένα patterns), E0425 / E0433 / E0432.

Προειδοποιήσεις: αχρησιμοποίητη μεταβλητή, περιττό `mut`, Result που αγνοήθηκε, `unreachable pattern`.

Panic (overflow, `unwrap` σε None / Err, θέση εκτός πίνακα) → το test αποτυγχάνει. Στο τερματικό φαίνονται οι γραμμές `thread 'main' panicked at …`, όπως στο αληθινό. Στο ESP32 προστίθεται και `Rebooting...`.

Στο Pi, ένα δεύτερο `gpio.get(17)?` δίνει `Err(PinUsed(17))`. Η main τυπώνει `Error: PinUsed(17)` και σταματά. Στο ESP32 το ίδιο λάθος είναι E0382 στο compile.

## HC-SR04 στη Rust

Δεν υπάρχει `pulseIn`. Η μέτρηση γράφεται με το χέρι (δες `rs5.js`):

1. TRIG High για 10 µs (`thread::sleep(Duration::from_micros(10))` ή `Ets::delay_us(10)`), μετά Low.
2. `while echo.is_low()` με όριο 30 ms (`Instant::now()`, `.elapsed()`).
3. `while echo.is_high()` με όριο 30 ms.
4. `cm = elapsed.as_micros() as f32 / 58.3`.

Ο προσομοιωτής μοντελοποιεί το επίπεδο του ECHO στον χρόνο. Με `{:.1}`: 35 → `35.0`, 80 → `80.0`, 50 → `49.9`, 2 → `2.1`. Διάλεξε αποστάσεις για τα tests **μακριά από τα όρια** (π.χ. 10, 35, 80, όχι 50). Πάνω από ~400 cm → καμία ηχώ.

Είσοδοι: `world: { distance: 35 }`, `{ set: { distance: 500 } }`, `{ sequence: { distance: [80, 35, 10] } }`.

## Έλεγχοι συμπεριφοράς

Ίδιοι με το `AUTHORING.md`: `lines`, `count`, `lastLine`, `serialHas`, `serialNot`, `led`, `lights`, `sourceNot`. Το `println!` πηγαίνει στο Serial / τερματικό.

Κάθε `solution` πρέπει:
- να περνά όλα τα tests,
- να είναι αληθινή Rust για την πλακέτα (rppal 0.17+ / esp-idf-svc 0.49+ με std),
- να μη βγάζει προειδοποιήσεις.

Το `initialCode` πρέπει να αποτυγχάνει σε τουλάχιστον ένα test. Τα κενά γράφονται `____;` (δίνει E0425) ή ως σχόλιο `/* ΣΥΜΠΛΗΡΩΣΕ … */`.

```bash
node tests/run-tests.js --only c43      # μόνο τα μαθήματα του κεφαλαίου 43
node tests/run-tests.js                 # όλα
```
