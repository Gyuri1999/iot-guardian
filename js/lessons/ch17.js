/*
 * IoT Guardian — Κεφάλαιο 17 (Μέρος Β): Python στο Raspberry Pi: τα βασικά.
 * Ανοίγει μετά το Κεφάλαιο 7. Ο μαθητής ξέρει ήδη C++ (μεταβλητές, if, βρόχους, συναρτήσεις)
 * και εδώ μαθαίνει την ίδια λογική στην Python, με συνεχή σύγκριση με τη C++.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.push({ n: 17, title: 'Python στο Raspberry Pi: τα βασικά', ready: true, unlockAfter: 7, lang: 'python' });

  [
    { term: 'Python', def: 'Γλώσσα προγραμματισμού που διαβάζεται σχεδόν σαν αγγλικά. Τρέχει στο Raspberry Pi. Δεν θέλει ; ούτε { }, και τα μπλοκ φαίνονται από την εσοχή.' },
    { term: 'Raspberry Pi', def: 'Μικρός υπολογιστής σε μία πλακέτα, με Linux. Στο σπίτι της άσκησης τρέχει τον broker και προγράμματα Python. Έχει και pins GPIO, όπως το ESP32.' },
    { term: 'print', def: 'Η εντολή της Python που τυπώνει μια γραμμή στο τερματικό. Είναι σαν το Serial.println της C++.' },
    { term: 'εσοχή', def: 'Τα κενά στην αρχή μιας γραμμής. Στην Python η εσοχή (συνήθως 4 κενά) δείχνει ποιες γραμμές ανήκουν σε ένα μπλοκ, όπως τα { } στη C++.' },
    { term: 'f-string', def: 'Κείμενο με f μπροστά, π.χ. f"{t:.1f} °C". Ό,τι γράφεις μέσα σε { } αντικαθίσταται με την τιμή του. Το :.1f σημαίνει «με 1 δεκαδικό».' },
    { term: 'μετατροπή τύπου', def: 'Αλλαγή μιας τιμής σε άλλο τύπο: int("5") δίνει 5, float("22.5") δίνει 22.5, str(3) δίνει "3".' },
    { term: 'δυναμικός τύπος', def: 'Στην Python δεν γράφεις τύπο (int, float). Η μεταβλητή παίρνει τον τύπο της τιμής που της δίνεις.' },
    { term: 'λίστα', def: 'Πολλές τιμές με σειρά, μέσα σε [ ], π.χ. [21.0, 22.5]. Η πρώτη θέση είναι η 0. Το len(λίστα) δίνει πόσες είναι.' },
    { term: 'λεξικό (dict)', def: 'Ζευγάρια «κλειδί: τιμή» μέσα σε { }, π.χ. {"temp": 22.5}. Διαβάζεις μια τιμή με το κλειδί: reading["temp"].' },
    { term: 'def', def: 'Η λέξη που ορίζει συνάρτηση στην Python: def όνομα(παράμετροι): και από κάτω το σώμα με εσοχή. Δεν γράφεις τύπο επιστροφής.' },
    { term: 'SyntaxError', def: 'Λάθος σύνταξης: η Python δεν καταλαβαίνει μια γραμμή. Τότε δεν τρέχει τίποτα από το πρόγραμμα, ούτε οι σωστές γραμμές.' }
  ].forEach(g => { if (!L.GLOSSARY.some(x => x.term === g.term)) L.GLOSSARY.push(g); });

  const SYNTAX_1 = 'print, σχόλια #, κείμενο σε " "';
  const SYNTAX_2 = SYNTAX_1 + ', μεταβλητές, int(), float(), str(), f-strings {x:.1f}';
  const SYNTAX_3 = SYNTAX_2 + ', if/elif/else, < > <= >= == !=, and/or/not';
  const SYNTAX_4 = SYNTAX_3 + ', λίστες [ ], for x in λίστα, sum, len, min, max, λεξικά { }';
  const SYNTAX_5 = SYNTAX_4 + ', def, return';
  const PANELS = ['serial', 'vars'];

  // ------------------------------------------------------------ 17.1
  const L1_INITIAL = `# Το πρώτο μου πρόγραμμα Python
# Κάθε print τυπώνει μία γραμμή στο τερματικό.

print("Hello Pi")
print(____)       # ΣΥΜΠΛΗΡΩΣΕ: τύπωσε το κείμενο "Python ready"
print("Τέλος")
`;
  const L1_SOLUTION = `# Το πρώτο μου πρόγραμμα Python
# Κάθε print τυπώνει μία γραμμή στο τερματικό.

print("Hello Pi")
print("Python ready")
print("Τέλος")
`;

  // ------------------------------------------------------------ 17.2
  const L2_INITIAL = `# Μια μέτρηση φτάνει από το δίκτυο ως ΚΕΙΜΕΝΟ.
text = "22.5"
room = "Σαλόνι"
count = 3

t = ____(text)            # ΣΥΜΠΛΗΡΩΣΕ: κάνε το κείμενο δεκαδικό αριθμό
t_f = t * 9 / 5 + 32      # σε βαθμούς Fahrenheit

print(f"{room}: {t:.1f} °C")
print(f"Σε Fahrenheit: {____:.1f} °F")    # ΣΥΜΠΛΗΡΩΣΕ: ποια μεταβλητή;
print("Μετρήσεις: " + ____(count))       # ΣΥΜΠΛΗΡΩΣΕ: κάνε τον αριθμό κείμενο
`;
  const L2_SOLUTION = `# Μια μέτρηση φτάνει από το δίκτυο ως ΚΕΙΜΕΝΟ.
text = "22.5"
room = "Σαλόνι"
count = 3

t = float(text)           # τώρα το t είναι αριθμός 22.5
t_f = t * 9 / 5 + 32      # σε βαθμούς Fahrenheit

print(f"{room}: {t:.1f} °C")
print(f"Σε Fahrenheit: {t_f:.1f} °F")
print("Μετρήσεις: " + str(count))
`;

  // ------------------------------------------------------------ 17.3
  const L3_INITIAL = `# Θερμοστάτης: δίνει μια ετικέτα σε κάθε θερμοκρασία.
# Το for δοκιμάζει το if με 6 τιμές (θα το δούμε στο επόμενο μάθημα).
for t in [15.0, 18.0, 21.5, 25.0, 26.0, 30.0]:
    if t < 18:
        label = "ΚΡΥΟ"
    elif ____:                 # ΣΥΜΠΛΗΡΩΣΕ: από 18 έως και 25
        label = "ΚΑΝΟΝΙΚΗ"
    ____                       # ΣΥΜΠΛΗΡΩΣΕ: σε κάθε άλλη περίπτωση
        label = "ΖΕΣΤΗ"
    print(f"{t:.1f} °C → {label}")

heating = True
window_open = True
# Η θέρμανση ανάβει μόνο αν είναι ενεργή ΚΑΙ ΔΕΝ είναι ανοιχτό το παράθυρο.
if heating and ____ window_open:      # ΣΥΜΠΛΗΡΩΣΕ: το «όχι» της Python
    print("Θέρμανση: ON")
else:
    print("Θέρμανση: OFF")
`;
  const L3_SOLUTION = `# Θερμοστάτης: δίνει μια ετικέτα σε κάθε θερμοκρασία.
# Το for δοκιμάζει το if με 6 τιμές (θα το δούμε στο επόμενο μάθημα).
for t in [15.0, 18.0, 21.5, 25.0, 26.0, 30.0]:
    if t < 18:
        label = "ΚΡΥΟ"
    elif t <= 25:
        label = "ΚΑΝΟΝΙΚΗ"
    else:
        label = "ΖΕΣΤΗ"
    print(f"{t:.1f} °C → {label}")

heating = True
window_open = True
# Η θέρμανση ανάβει μόνο αν είναι ενεργή ΚΑΙ ΔΕΝ είναι ανοιχτό το παράθυρο.
if heating and not window_open:
    print("Θέρμανση: ON")
else:
    print("Θέρμανση: OFF")
`;

  // ------------------------------------------------------------ 17.4
  const L4_INITIAL = `# Μετρήσεις θερμοκρασίας από το ESP32 της κουζίνας (μία κάθε ώρα).
readings = [21.0, 21.5, 22.5, 23.0, 24.5, 22.0]

# 1. Τύπωσε κάθε μέτρηση σε δική της γραμμή: «21.0 °C», «21.5 °C», …


# 2. Τύπωσε «Μέσος όρος: … °C» με 1 δεκαδικό (χρησιμοποίησε sum και len).


# 3. Τύπωσε «Ελάχιστη: … °C» και «Μέγιστη: … °C».


# 4. Η τελευταία μέτρηση ως λεξικό. Συμπλήρωσε την τιμή του "temp".
reading = {"room": "kitchen", "temp": ____}
print(f"Τελευταία ({reading['room']}): {reading['temp']} °C")
`;
  const L4_SOLUTION = `# Μετρήσεις θερμοκρασίας από το ESP32 της κουζίνας (μία κάθε ώρα).
readings = [21.0, 21.5, 22.5, 23.0, 24.5, 22.0]

# 1. Τύπωσε κάθε μέτρηση σε δική της γραμμή: «21.0 °C», «21.5 °C», …
for t in readings:
    print(f"{t:.1f} °C")

# 2. Τύπωσε «Μέσος όρος: … °C» με 1 δεκαδικό (χρησιμοποίησε sum και len).
avg = sum(readings) / len(readings)
print(f"Μέσος όρος: {avg:.1f} °C")

# 3. Τύπωσε «Ελάχιστη: … °C» και «Μέγιστη: … °C».
print(f"Ελάχιστη: {min(readings)} °C")
print(f"Μέγιστη: {max(readings)} °C")

# 4. Η τελευταία μέτρηση ως λεξικό. Συμπλήρωσε την τιμή του "temp".
reading = {"room": "kitchen", "temp": readings[-1]}
print(f"Τελευταία ({reading['room']}): {reading['temp']} °C")
`;

  // ------------------------------------------------------------ 17.5
  const L5_INITIAL = `# Μετατροπή και έλεγχος θερμοκρασίας.
# Το έγραψε κάποιος «με μυαλό C++». Η Python δεν το δέχεται.

def to_fahrenheit(c) {
    return c * 9 / 5 + 32;
}

def status(t):
    if t > 26 && t < 40:
        return "ΖΕΣΤΗ"
    elif t < 18:
    return "ΚΡΥΟ"
    else:
        return "ΚΑΝΟΝΙΚΗ"

alarm = false
for t in [16.0, 22.0, 28.0]:
    f = to_fahrenheit(t)
    print(f"{t:.1f} °C = {f:.1f} °F → {status(t)}")
    if status(t) == "ΖΕΣΤΗ"
        alarm = true

print(f"Συναγερμός: {alarm}")
`;
  const L5_SOLUTION = `# Μετατροπή και έλεγχος θερμοκρασίας.
# Το έγραψε κάποιος «με μυαλό C++». Η Python δεν το δέχεται.

def to_fahrenheit(c):
    return c * 9 / 5 + 32

def status(t):
    if t > 26 and t < 40:
        return "ΖΕΣΤΗ"
    elif t < 18:
        return "ΚΡΥΟ"
    else:
        return "ΚΑΝΟΝΙΚΗ"

alarm = False
for t in [16.0, 22.0, 28.0]:
    f = to_fahrenheit(t)
    print(f"{t:.1f} °C = {f:.1f} °F → {status(t)}")
    if status(t) == "ΖΕΣΤΗ":
        alarm = True

print(f"Συναγερμός: {alarm}")
`;

  L.lessons.push(
    {
      id: 'c17-l1', chapter: 17, kind: 'micro', lang: 'python', skills: ['python', 'order', 'syntax'],
      title: 'Το πρώτο πρόγραμμα Python',
      prerequisites: [],
      objectives: ['Να τυπώνω κείμενο με print.', 'Να γράφω σχόλιο με #.', 'Να ξέρω ότι ένα πρόγραμμα Python τρέχει μία φορά, από πάνω προς τα κάτω, και τελειώνει.'],
      theory: `
<p>Τώρα γράφεις για το <strong>Raspberry Pi</strong>, σε <strong>Python</strong>. Η λογική είναι ίδια με τη C++. Αλλάζει η γραφή.</p>
<pre>print("Hello Pi")      # σχόλιο</pre>
<ul>
  <li>Στη C++ γράφαμε <code>Serial.println("…");</code>. Στην Python γράφουμε <code>print("…")</code>.</li>
  <li><strong>Χωρίς</strong> <code>;</code> στο τέλος.</li>
  <li>Το σχόλιο ξεκινά με <code>#</code>, όχι με <code>//</code>.</li>
</ul>
<p><strong>Δεν</strong> υπάρχουν <code>setup()</code> και <code>loop()</code>. Το πρόγραμμα τρέχει <strong>από πάνω προς τα κάτω, μία φορά</strong>, και μετά <strong>τελειώνει</strong>.</p>
<p>Η έξοδος φαίνεται στο <strong>Τερματικό</strong>. Κάθε <code>print</code> γράφει μία γραμμή.</p>`,
      glossary: ['Python', 'Raspberry Pi', 'print', 'σχόλιο'],
      supportedSyntax: SYNTAX_1,
      initialCode: L1_INITIAL,
      solution: L1_SOLUTION,
      world: {}, initialWorld: {},
      hardware: [], panels: PANELS,
      steps: [
        'Διάβασε τον κώδικα. Βρες το σχόλιο και τις τρεις εντολές print.',
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Αντικατέστησε το ____ με το κείμενο "Python ready" (με τα εισαγωγικά).',
        'Τρέξε τον κώδικα και κοίτα το Τερματικό. Μετά πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Το πρόγραμμα δεν έχει loop(). Πόσες φορές θα τυπωθεί το «Hello Pi»;',
        options: ['Μία φορά, και μετά το πρόγραμμα τελειώνει', 'Ξανά και ξανά, για πάντα', 'Καμία, γιατί λείπει το setup()'],
        answer: 0,
        explain: 'Σωστά. Η Python εκτελεί τις γραμμές μία φορά, από πάνω προς τα κάτω. Μετά την τελευταία γραμμή το πρόγραμμα τελειώνει.',
        retry: 'Όχι ακόμα. Στην Python δεν υπάρχει loop() που επαναλαμβάνεται μόνο του. Τι γίνεται μετά την τελευταία γραμμή;'
      },
      hints: [
        'Το print τυπώνει ό,τι βάλεις μέσα στις παρενθέσεις. Το κείμενο μπαίνει σε εισαγωγικά " ".',
        'Το κενό ____ είναι στη δεύτερη εντολή print.',
        'Γράψε:\nprint("Python ready")\nΤα εισαγωγικά λένε στην Python ότι αυτό είναι κείμενο.'
      ],
      validationTests: [
        { name: 'Τυπώνονται οι τρεις γραμμές με τη σειρά', script: [
          { setup: true },
          { check: 'lines', is: ['Hello Pi', 'Python ready', 'Τέλος'], fail: 'Το Τερματικό έδειξε: {v}. Περίμενα «Hello Pi», «Python ready», «Τέλος». Έλεγξε ότι το κείμενο είναι ακριβώς ίδιο.' }
        ] },
        { name: 'Το πρόγραμμα τρέχει μία φορά και τελειώνει', script: [
          { setup: true }, { loops: 3 },
          { check: 'count', text: 'Hello Pi', is: 1, fail: 'Το «Hello Pi» τυπώθηκε {n} φορές. Περίμενα 1: χωρίς βρόχο, κάθε γραμμή τρέχει μία φορά.' },
          { check: 'lastLine', is: 'Τέλος', fail: 'Η τελευταία γραμμή είναι {v}. Περίμενα «Τέλος».' }
        ] }
      ],
      explanationOnSuccess: 'Έγραψες το πρώτο σου πρόγραμμα Python. Χωρίς ;, χωρίς { }, χωρίς setup() και loop(). Τρεις γραμμές, τρία print, και το πρόγραμμα τελείωσε.',
      remediation: 'Αν βλέπεις SyntaxError, έλεγξε ότι το κείμενο έχει εισαγωγικά και από τις δύο μεριές: "Python ready".'
    },

    {
      id: 'c17-l2', chapter: 17, kind: 'guided', lang: 'python', skills: ['python', 'variables'],
      title: 'Μεταβλητές χωρίς τύπο και f-strings',
      prerequisites: ['c17-l1'],
      objectives: ['Να φτιάχνω μεταβλητές χωρίς να γράφω τύπο.', 'Να μετατρέπω κείμενο σε αριθμό με float() και int(), και αριθμό σε κείμενο με str().', 'Να τυπώνω τιμές με f-string και 1 δεκαδικό.'],
      theory: `
<p>Στη C++ γράφαμε <code>float t = 22.5;</code>. Στην Python γράφουμε απλώς:</p>
<pre>t = 22.5</pre>
<p>Δεν γράφεις τύπο. Η μεταβλητή παίρνει τον τύπο της τιμής: <code>22.5</code> είναι float, <code>3</code> είναι int, <code>"22.5"</code> είναι <strong>κείμενο</strong> (str).</p>
<p>Μια μέτρηση από το δίκτυο έρχεται συχνά ως <strong>κείμενο</strong>. Με το κείμενο δεν κάνεις πράξεις. Το μετατρέπεις:</p>
<ul>
  <li><code>float("22.5")</code> → 22.5 (δεκαδικός)</li>
  <li><code>int("3")</code> → 3 (ακέραιος)</li>
  <li><code>str(3)</code> → "3" (κείμενο)</li>
</ul>
<p>Το <code>"Μετρήσεις: " + 3</code> βγάζει <strong>TypeError</strong>: κείμενο και αριθμός δεν ενώνονται με <code>+</code>. Θέλει <code>str(3)</code>.</p>
<p>Πιο εύκολο: το <strong>f-string</strong>. Βάζεις <code>f</code> μπροστά και τις μεταβλητές μέσα σε <code>{ }</code>:</p>
<pre>print(f"{room}: {t:.1f} °C")    # Σαλόνι: 22.5 °C</pre>
<p>Το <code>:.1f</code> σημαίνει «με 1 δεκαδικό».</p>`,
      glossary: ['δυναμικός τύπος', 'μετατροπή τύπου', 'f-string', 'μεταβλητή'],
      supportedSyntax: SYNTAX_2,
      initialCode: L2_INITIAL,
      solution: L2_SOLUTION,
      world: {}, initialWorld: {},
      hardware: [], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε το πρώτο κενό: ποια συνάρτηση κάνει το "22.5" δεκαδικό αριθμό;',
        'Συμπλήρωσε στο f-string τη μεταβλητή με τους βαθμούς Fahrenheit.',
        'Συμπλήρωσε το τελευταίο κενό: κάνε το count κείμενο, για να ενωθεί με το "Μετρήσεις: ".',
        'Τρέξε, κοίτα τον πίνακα «Μεταβλητές» (text είναι κείμενο, t αριθμός) και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Τι κάνει η εντολή print("22.5" + 1);',
        options: ['Βγάζει TypeError: κείμενο και αριθμός δεν ενώνονται', 'Τυπώνει 23.5', 'Τυπώνει 22.51'],
        answer: 0,
        explain: 'Σωστά. Το "22.5" είναι κείμενο. Η Python δεν μαντεύει τι θέλεις: πρώτα float("22.5"), μετά πρόσθεση.',
        retry: 'Όχι ακόμα. Τα εισαγωγικά κάνουν το "22.5" κείμενο, όχι αριθμό. Μπορεί η Python να προσθέσει κείμενο και αριθμό;'
      },
      hints: [
        'Τρεις μετατροπές υπάρχουν: float() για δεκαδικό, int() για ακέραιο, str() για κείμενο.',
        'Το πρώτο κενό θέλει δεκαδικό. Το δεύτερο είναι το όνομα της μεταβλητής που κρατά τους °F. Το τρίτο θέλει κείμενο.',
        't = float(text)\nprint(f"Σε Fahrenheit: {t_f:.1f} °F")\nprint("Μετρήσεις: " + str(count))'
      ],
      validationTests: [
        { name: 'Η θερμοκρασία τυπώνεται με 1 δεκαδικό', script: [
          { setup: true },
          { check: 'count', text: 'Σαλόνι: 22.5 °C', is: 1, fail: 'Δεν βρήκα τη γραμμή «Σαλόνι: 22.5 °C». Το Τερματικό έδειξε: {v}.', failZero: 'Δεν τυπώθηκε η γραμμή «Σαλόνι: 22.5 °C». Έλεγξε ότι το t έγινε αριθμός με float(text).' }
        ] },
        { name: 'Η μετατροπή σε Fahrenheit είναι σωστή', script: [
          { setup: true },
          { check: 'count', text: 'Σε Fahrenheit: 72.5 °F', is: 1, fail: 'Δεν τυπώθηκε «Σε Fahrenheit: 72.5 °F». Έβαλες στο f-string τη μεταβλητή t_f;' }
        ] },
        { name: 'Ο αριθμός ενώνεται με κείμενο μέσω str()', script: [
          { setup: true },
          { check: 'lastLine', is: 'Μετρήσεις: 3', fail: 'Η τελευταία γραμμή είναι {v}. Περίμενα «Μετρήσεις: 3». Το count είναι αριθμός: κάνε το κείμενο με str(count).' }
        ] }
      ],
      explanationOnSuccess: 'Το "22.5" ήταν κείμενο, το έκανες αριθμό με float(), έκανες πράξεις και το τύπωσες με f-string. Στην Python ο τύπος δεν γράφεται, αλλά υπάρχει: κείμενο και αριθμός είναι διαφορετικά πράγματα.',
      remediation: 'Αν βλέπεις TypeError: can only concatenate str, κάπου ενώνεις κείμενο με αριθμό χωρίς str(). Αν βλέπεις ValueError, έβαλες int() σε κείμενο με δεκαδικά: για το "22.5" θέλει float().'
    },

    {
      id: 'c17-l3', chapter: 17, kind: 'guided', lang: 'python', skills: ['python', 'conditions', 'syntax'],
      title: 'if, elif, else με άνω-κάτω τελεία και εσοχή',
      prerequisites: ['c17-l2'],
      objectives: ['Να γράφω if/elif/else με : και εσοχή.', 'Να συγκρίνω τιμές με < <= > >= == !=.', 'Να ενώνω συνθήκες με and, or, not.'],
      theory: `
<p>Στη C++ τα μπλοκ ήταν μέσα σε <code>{ }</code>. Στην Python το μπλοκ το δείχνει η <strong>εσοχή</strong> (4 κενά):</p>
<pre>if t &lt; 18:
    label = "ΚΡΥΟ"
elif t &lt;= 25:
    label = "ΚΑΝΟΝΙΚΗ"
else:
    label = "ΖΕΣΤΗ"</pre>
<ul>
  <li>Χωρίς παρενθέσεις γύρω από τη συνθήκη.</li>
  <li>Στο τέλος της γραμμής: <strong>άνω-κάτω τελεία</strong> <code>:</code>.</li>
  <li>Το <code>else if</code> της C++ γράφεται <code>elif</code>.</li>
</ul>
<p>Οι λογικοί τελεστές γράφονται με λέξεις:</p>
<ul>
  <li><code>&amp;&amp;</code> → <code>and</code></li>
  <li><code>||</code> → <code>or</code></li>
  <li><code>!</code> → <code>not</code></li>
</ul>
<p>Και το <code>true</code>/<code>false</code> γράφεται με κεφαλαίο: <code>True</code>/<code>False</code>.</p>`,
      glossary: ['εσοχή', 'if / else', 'συνθήκη', 'σύγκριση'],
      supportedSyntax: SYNTAX_3,
      initialCode: L3_INITIAL,
      solution: L3_SOLUTION,
      world: {}, initialWorld: {},
      hardware: [], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Συμπλήρωσε τη συνθήκη του elif: από 18 έως και 25 βαθμούς.',
        'Συμπλήρωσε τη λέξη για «σε κάθε άλλη περίπτωση». Μην ξεχάσεις το : στο τέλος.',
        'Συμπλήρωσε το «όχι» στη συνθήκη της θέρμανσης.',
        'Τρέξε. Είναι σωστές οι ετικέτες για 18.0 και 25.0; Πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Με t = 18.0, ποια ετικέτα δίνει ο κώδικας; (Πρώτα if t < 18, μετά elif t <= 25.)',
        options: ['ΚΑΝΟΝΙΚΗ', 'ΚΡΥΟ', 'ΖΕΣΤΗ'],
        answer: 0,
        explain: 'Σωστά. Το 18 < 18 είναι False, άρα η Python πάει στο elif. Το 18 <= 25 είναι True: ΚΑΝΟΝΙΚΗ.',
        retry: 'Όχι ακόμα. Είναι το 18 μικρότερο από το 18; Αν όχι, ποια συνθήκη ελέγχεται μετά;'
      },
      hints: [
        'Η Python ελέγχει τις συνθήκες με τη σειρά και σταματά στην πρώτη που είναι True. Στο elif φτάνεις μόνο αν t >= 18.',
        'Το elif χρειάζεται μόνο το πάνω όριο: «μέχρι και 25» είναι <=. Η τελευταία περίπτωση είναι else: με άνω-κάτω τελεία. Το «όχι» είναι μια λέξη.',
        'elif t <= 25:\n    label = "ΚΑΝΟΝΙΚΗ"\nelse:\n    label = "ΖΕΣΤΗ"\n…\nif heating and not window_open:'
      ],
      validationTests: [
        { name: 'Σωστές ετικέτες για όλες τις τιμές', script: [
          { setup: true },
          { check: 'count', text: '15.0 °C → ΚΡΥΟ', is: 1, fail: 'Δεν βρήκα «15.0 °C → ΚΡΥΟ». Το Τερματικό έδειξε: {v}.' },
          { check: 'count', text: '21.5 °C → ΚΑΝΟΝΙΚΗ', is: 1, fail: 'Δεν βρήκα «21.5 °C → ΚΑΝΟΝΙΚΗ». Έλεγξε τη συνθήκη του elif.' },
          { check: 'count', text: '30.0 °C → ΖΕΣΤΗ', is: 1, fail: 'Δεν βρήκα «30.0 °C → ΖΕΣΤΗ». Έλεγξε το else.' }
        ] },
        { name: 'Τα όρια 18 και 25 είναι ΚΑΝΟΝΙΚΗ, το 26 ΖΕΣΤΗ', script: [
          { setup: true },
          { check: 'count', text: '18.0 °C → ΚΑΝΟΝΙΚΗ', is: 1, fail: 'Το 18.0 δεν πήρε ετικέτα ΚΑΝΟΝΙΚΗ. Το Τερματικό έδειξε: {v}.' },
          { check: 'count', text: '25.0 °C → ΚΑΝΟΝΙΚΗ', is: 1, fail: 'Το 25.0 δεν πήρε ετικέτα ΚΑΝΟΝΙΚΗ. «Έως και 25» γράφεται t <= 25, όχι t < 25.' },
          { check: 'count', text: '26.0 °C → ΖΕΣΤΗ', is: 1, fail: 'Το 26.0 δεν πήρε ετικέτα ΖΕΣΤΗ.' }
        ] },
        { name: 'Η θέρμανση μένει σβηστή με ανοιχτό παράθυρο', script: [
          { setup: true },
          { check: 'lastLine', is: 'Θέρμανση: OFF', fail: 'Η τελευταία γραμμή είναι {v}. Με ανοιχτό παράθυρο η θέρμανση πρέπει να μείνει OFF: heating and not window_open.' }
        ] }
      ],
      explanationOnSuccess: 'Η ίδια λογική με τη C++, αλλά με : και εσοχή αντί για { }, elif αντί για else if, και not αντί για !. Η εσοχή δεν είναι διακόσμηση: η Python τη χρησιμοποιεί για να καταλάβει τι ανήκει στο if.',
      remediation: 'Αν βλέπεις IndentationError, κοίτα τα κενά: όλες οι γραμμές μέσα σε ένα μπλοκ έχουν την ίδια εσοχή. Αν βλέπεις «expected \':\'», λείπει η άνω-κάτω τελεία.'
    },

    {
      id: 'c17-l4', chapter: 17, kind: 'variant', lang: 'python', skills: ['python', 'variables', 'order'],
      title: 'Λίστες, for και λεξικά: μέσος όρος μετρήσεων',
      prerequisites: ['c17-l3'],
      objectives: ['Να κρατώ πολλές μετρήσεις σε λίστα.', 'Να περνώ μία-μία τις τιμές με for.', 'Να βρίσκω μέσο όρο, ελάχιστη και μέγιστη με sum, len, min, max.', 'Να διαβάζω τιμή από λεξικό με το κλειδί της.'],
      theory: `
<p>Μια <strong>λίστα</strong> κρατά πολλές τιμές με σειρά:</p>
<pre>readings = [21.0, 21.5, 22.5]</pre>
<p>Το <code>for</code> της Python παίρνει τις τιμές <strong>μία-μία</strong>. Δεν χρειάζεσαι μετρητή <code>i</code> όπως στη C++:</p>
<pre>for t in readings:
    print(t)</pre>
<p>Έτοιμες συναρτήσεις για λίστες:</p>
<ul>
  <li><code>len(readings)</code>: πόσες τιμές</li>
  <li><code>sum(readings)</code>: το άθροισμα</li>
  <li><code>min(readings)</code>, <code>max(readings)</code>: η μικρότερη, η μεγαλύτερη</li>
  <li><code>readings[-1]</code>: η τελευταία τιμή</li>
</ul>
<p>Ένα <strong>λεξικό</strong> κρατά τιμές με <strong>όνομα</strong> (κλειδί):</p>
<pre>reading = {"room": "kitchen", "temp": 22.0}
print(reading["temp"])      # 22.0</pre>
<p>Έτσι μοιάζουν και τα μηνύματα JSON που στέλνουν τα ESP32.</p>`,
      glossary: ['λίστα', 'λεξικό (dict)', 'f-string'],
      supportedSyntax: SYNTAX_4,
      initialCode: L4_INITIAL,
      solution: L4_SOLUTION,
      world: {}, initialWorld: {},
      hardware: [], panels: PANELS,
      steps: [
        'Απάντησε στην ερώτηση πρόβλεψης.',
        'Κάτω από το σχόλιο 1, γράψε ένα for που τυπώνει κάθε μέτρηση έτσι: 21.0 °C',
        'Κάτω από το σχόλιο 2, υπολόγισε avg = sum(…) / len(…) και τύπωσε: Μέσος όρος: 22.4 °C',
        'Κάτω από το σχόλιο 3, τύπωσε: Ελάχιστη: 21.0 °C και Μέγιστη: 24.5 °C (με min και max).',
        'Στο 4, βάλε στο "temp" την τελευταία μέτρηση της λίστας. Τρέξε και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'readings = [21.0, 22.0, 23.0]. Τι δίνει το sum(readings) / len(readings);',
        options: ['22.0', '66.0', '3'],
        answer: 0,
        explain: 'Σωστά. Το sum δίνει 66.0, το len δίνει 3, και 66.0 / 3 = 22.0.',
        retry: 'Όχι ακόμα. Το sum προσθέτει όλες τις τιμές, το len μετρά πόσες είναι. Διαίρεσε το ένα με το άλλο.'
      },
      hints: [
        'Το for t in readings: δίνει στο t κάθε τιμή με τη σειρά. Μέσα στο for γράφεις με εσοχή.',
        'Για 1 δεκαδικό: f"{t:.1f} °C". Ο μέσος όρος είναι sum(readings) / len(readings). Η τελευταία τιμή είναι readings[-1].',
        'for t in readings:\n    print(f"{t:.1f} °C")\navg = sum(readings) / len(readings)\nprint(f"Μέσος όρος: {avg:.1f} °C")\nprint(f"Ελάχιστη: {min(readings)} °C")\nprint(f"Μέγιστη: {max(readings)} °C")\nreading = {"room": "kitchen", "temp": readings[-1]}'
      ],
      validationTests: [
        { name: 'Κάθε μέτρηση τυπώνεται σε δική της γραμμή', script: [
          { setup: true },
          { check: 'order', texts: ['21.0 °C', '21.5 °C', '22.5 °C', '23.0 °C', '24.5 °C', '22.0 °C'], fail: 'Οι γραμμές μετρήσεων ήταν: {v}. Περίμενα τις 6 μετρήσεις με τη σειρά, π.χ. «21.0 °C». Γράψε ένα for πάνω στη λίστα readings.' }
        ] },
        { name: 'Ο μέσος όρος είναι σωστός', script: [
          { setup: true },
          { check: 'count', text: 'Μέσος όρος: 22.4 °C', is: 1, fail: 'Δεν βρήκα «Μέσος όρος: 22.4 °C». Το Τερματικό έδειξε στο τέλος: {v}.', failZero: 'Δεν τυπώθηκε «Μέσος όρος: 22.4 °C». Υπολόγισε sum(readings) / len(readings) και τύπωσέ το με :.1f.' }
        ] },
        { name: 'Ελάχιστη και μέγιστη', script: [
          { setup: true },
          { check: 'count', text: 'Ελάχιστη: 21.0 °C', is: 1, fail: 'Δεν τυπώθηκε «Ελάχιστη: 21.0 °C». Χρησιμοποίησε min(readings).' },
          { check: 'count', text: 'Μέγιστη: 24.5 °C', is: 1, fail: 'Δεν τυπώθηκε «Μέγιστη: 24.5 °C». Χρησιμοποίησε max(readings).' }
        ] },
        { name: 'Το λεξικό κρατά την τελευταία μέτρηση', script: [
          { setup: true },
          { check: 'lastLine', is: 'Τελευταία (kitchen): 22.0 °C', fail: 'Η τελευταία γραμμή είναι {v}. Περίμενα «Τελευταία (kitchen): 22.0 °C». Στο "temp" βάλε readings[-1].' }
        ] }
      ],
      explanationOnSuccess: 'Με τέσσερις έτοιμες συναρτήσεις (sum, len, min, max) έκανες ό,τι στη C++ θα ήθελε βρόχο με μετρητή. Και το λεξικό είναι ο τρόπος της Python να κρατά μια μέτρηση με ονόματα, όπως το JSON.',
      remediation: 'Αν το Τερματικό δείχνει 22.416666666666668 αντί για 22.4, ξέχασες το :.1f μέσα στο f-string.'
    },

    {
      id: 'c17-l5', chapter: 17, kind: 'checkpoint', lang: 'python', skills: ['python', 'syntax', 'timing', 'conditions'],
      title: 'Βρες τα λάθη: συνήθειες από τη C++',
      prerequisites: ['c17-l4'],
      objectives: ['Να γράφω συναρτήσεις με def και return.', 'Να διαβάζω τα μηνύματα SyntaxError και IndentationError.', 'Να διορθώνω συνήθειες της C++ μέσα σε κώδικα Python.'],
      theory: `
<p>Στη C++ γράφαμε <code>float toF(float c) { return …; }</code>. Στην Python:</p>
<pre>def to_fahrenheit(c):
    return c * 9 / 5 + 32</pre>
<p>Χωρίς τύπους, χωρίς <code>{ }</code>, χωρίς <code>;</code>. Το σώμα είναι η γραμμή με εσοχή.</p>
<p>Ο κώδικας εδώ γράφτηκε «με μυαλό C++». Έχει <strong>5 είδη</strong> λαθών:</p>
<ul>
  <li><code>{ }</code> αντί για <code>:</code> και εσοχή,</li>
  <li><code>&amp;&amp;</code> αντί για <code>and</code>,</li>
  <li>γραμμή χωρίς εσοχή μέσα σε μπλοκ,</li>
  <li><code>true</code>/<code>false</code> με μικρό γράμμα,</li>
  <li>if χωρίς <code>:</code> στο τέλος.</li>
</ul>
<p>Προσοχή: με ένα λάθος σύνταξης <strong>δεν τρέχει τίποτα</strong>, ούτε οι σωστές γραμμές. Η Python δείχνει <strong>ένα λάθος τη φορά</strong>. Διόρθωσε, τρέξε ξανά, δες το επόμενο.</p>
<p>Το μήνυμα είναι στα αγγλικά, όπως στο αληθινό Pi, με εξήγηση στα ελληνικά από κάτω.</p>`,
      glossary: ['def', 'SyntaxError', 'εσοχή', 'μήνυμα λάθους'],
      supportedSyntax: SYNTAX_5,
      initialCode: L5_INITIAL,
      solution: L5_SOLUTION,
      world: {}, initialWorld: {},
      hardware: [], panels: PANELS,
      steps: [
        'Τρέξε τον κώδικα. Διάβασε το μήνυμα λάθους και τη γραμμή που δείχνει.',
        'Διόρθωσε αυτό το λάθος και τρέξε ξανά. Επανέλαβε μέχρι να μη βγαίνει λάθος.',
        'Έλεγξε το Τερματικό: 3 γραμμές μετατροπής και «Συναγερμός: True».',
        'Απάντησε στην ερώτηση και πάτησε «Έλεγχος λύσης».'
      ],
      quiz: {
        question: 'Ένα πρόγραμμα 20 γραμμών έχει λάθος σύνταξης στη γραμμή 15. Τι τρέχει;',
        options: ['Τίποτα: η Python ελέγχει όλο το πρόγραμμα πριν ξεκινήσει', 'Οι γραμμές 1 έως 14', 'Όλες εκτός από τη 15'],
        answer: 0,
        explain: 'Σωστά. Πριν τρέξει, η Python διαβάζει όλο το αρχείο. Αν βρει SyntaxError, δεν εκτελεί καμία γραμμή.',
        retry: 'Όχι ακόμα. Τρέξε τον αρχικό κώδικα: τυπώθηκε κάτι στο Τερματικό πριν από το λάθος;'
      },
      hints: [
        'Η Python θέλει : στο τέλος κάθε def, if, elif, else, for. Τα μπλοκ φαίνονται από την εσοχή. Οι λέξεις είναι and, True, False.',
        'Κοίτα: τη γραμμή def to_fahrenheit, το if με &&, το return κάτω από το elif, τις γραμμές με false/true, και το if μέσα στο for.',
        'def to_fahrenheit(c):\n    return c * 9 / 5 + 32\n…\n    if t > 26 and t < 40:\n…\n    elif t < 18:\n        return "ΚΡΥΟ"\n…\nalarm = False\n…\n    if status(t) == "ΖΕΣΤΗ":\n        alarm = True'
      ],
      validationTests: [
        { name: 'Το πρόγραμμα τρέχει χωρίς λάθος', script: [
          { setup: true },
          { check: 'total', is: 4, fail: 'Τυπώθηκαν {n} γραμμές. Περίμενα 4 (3 μετατροπές και τον συναγερμό).' }
        ] },
        { name: 'Η συνάρτηση to_fahrenheit επιστρέφει σωστό αποτέλεσμα', script: [
          { setup: true },
          { check: 'serialHas', text: '16.0 °C = 60.8 °F', fail: 'Δεν βρήκα «16.0 °C = 60.8 °F». Το Τερματικό έδειξε: {v}.' },
          { check: 'serialHas', text: '28.0 °C = 82.4 °F', fail: 'Δεν βρήκα «28.0 °C = 82.4 °F». Το Τερματικό έδειξε: {v}.' }
        ] },
        { name: 'Η συνάρτηση status δίνει σωστές ετικέτες', script: [
          { setup: true },
          { check: 'count', text: '16.0 °C = 60.8 °F → ΚΡΥΟ', is: 1, fail: 'Το 16.0 δεν πήρε ετικέτα ΚΡΥΟ.' },
          { check: 'count', text: '22.0 °C = 71.6 °F → ΚΑΝΟΝΙΚΗ', is: 1, fail: 'Το 22.0 δεν πήρε ετικέτα ΚΑΝΟΝΙΚΗ.' },
          { check: 'count', text: '28.0 °C = 82.4 °F → ΖΕΣΤΗ', is: 1, fail: 'Το 28.0 δεν πήρε ετικέτα ΖΕΣΤΗ.' }
        ] },
        { name: 'Ο συναγερμός ανάβει με ζέστη', script: [
          { setup: true },
          { check: 'lastLine', is: 'Συναγερμός: True', fail: 'Η τελευταία γραμμή είναι {v}. Περίμενα «Συναγερμός: True», γιατί το 28.0 είναι ΖΕΣΤΗ.' }
        ] }
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το κεφάλαιο. Ξέρεις πλέον να «μεταφράζεις» από C++ σε Python: : και εσοχή αντί για { }, and/or/not αντί για && || !, True/False με κεφαλαίο, def χωρίς τύπους. Στο επόμενο κεφάλαιο η Python θα ανάψει το LED του Raspberry Pi.',
      remediation: 'Αν κολλήσεις, διάβασε μόνο την πρώτη γραμμή του μηνύματος και τον αριθμό γραμμής. Διόρθωσε μόνο εκείνο και τρέξε ξανά.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
