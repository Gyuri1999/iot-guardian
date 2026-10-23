/*
 * IoT Guardian — εργαλεία μάθησης.
 *   linkTerms(el, terms, glossary)   οι λέξεις του γλωσσαρίου μέσα στο κείμενο γίνονται πατήσιμες
 *   explainLine(line, lang)          «Τι κάνει αυτή η γραμμή;» σε απλά ελληνικά (C++, Python, Rust)
 *   review / daily                   επανάληψη σε διαστήματα (κουτιά Leitner), στόχος ημέρας και σερί
 *   chapterNotes(...)                φύλλο σημειώσεων κεφαλαίου για διάβασμα ή εκτύπωση
 * Χωρίς DOM εκτός από το linkTerms, ώστε τα υπόλοιπα να ελέγχονται στα tests.
 */
(function (root) {
  'use strict';

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ------------------------------------------------------------ γλωσσάρι μέσα στο κείμενο

  const isWordChar = ch => !!ch && /[\p{L}\p{N}_]/u.test(ch);
  // Παραλλαγές ενός όρου: «HIGH / LOW» → HIGH, LOW · «setup()» → setup(), setup
  function variants(term) {
    const out = [];
    for (const part of term.split(/\s+\/\s+/)) {
      const p = part.trim();
      if (!p) continue;
      out.push(p);
      if (p.endsWith('()')) out.push(p.slice(0, -2));
    }
    return out.filter((x, i, a) => x.length > 1 && a.indexOf(x) === i);
  }
  function linkTerms(el, terms, glossary) {
    if (!el || !terms || !terms.length || typeof document === 'undefined') return 0;
    const defs = new Map(glossary.map(g => [g.term.toLowerCase(), g]));
    let n = 0;
    for (const term of terms) {
      const g = defs.get(term.toLowerCase());
      if (!g) continue;
      let done = false;
      for (const vtxt of variants(term)) {
        if (done) break;
        const needle = vtxt.toLowerCase();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
          acceptNode: t => (t.parentElement.closest('pre, button, .gl-term, h2, .kind-tag, .say-row') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
        });
        let t;
        while ((t = walker.nextNode())) {
          const low = t.data.toLowerCase();
          let i = low.indexOf(needle);
          while (i >= 0 && (isWordChar(t.data[i - 1]) || isWordChar(t.data[i + needle.length]))) i = low.indexOf(needle, i + 1);
          if (i < 0) continue;
          const mid = t.splitText(i);
          mid.splitText(needle.length);
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'gl-term';
          b.dataset.term = g.term;
          b.title = 'Τι σημαίνει; Πάτα για τον ορισμό';
          b.textContent = mid.data;
          mid.replaceWith(b);
          n++;
          done = true;
          break;
        }
      }
    }
    return n;
  }

  // ------------------------------------------------------------ «Τι κάνει αυτή η γραμμή;»

  const PINMODE = { OUTPUT: 'έξοδο (η πλακέτα θα γράφει HIGH ή LOW)', INPUT: 'είσοδο (η πλακέτα θα διαβάζει)', INPUT_PULLUP: 'είσοδο με εσωτερική αντίσταση pull-up (ελεύθερο = HIGH, πατημένο = LOW)' };
  const LEVEL = v => (v === 'HIGH' ? 'HIGH (3,3 V, «αναμμένο»)' : v === 'LOW' ? 'LOW (0 V, «σβηστό»)' : `την τιμή της ${v}`);

  const CPP = [
    [/^\s*\/\//, () => 'Σχόλιο: σημείωση για τον άνθρωπο. Ο μικροελεγκτής το αγνοεί.'],
    [/^\s*#include\s*[<"](.+)[>"]/, m => `Φέρνει έτοιμο κώδικα από τη βιβλιοθήκη ${m[1]}, για να χρησιμοποιήσεις τις εντολές της.`],
    [/^\s*#define\s+(\w+)\s+(.+)/, m => `Ορίζει το όνομα ${m[1]} να σημαίνει ${m[2].trim()}. Πριν τη μεταγλώττιση, κάθε ${m[1]} αντικαθίσταται.`],
    [/^\s*void\s+setup\s*\(\s*\)/, () => 'Αρχή της setup(): ό,τι είναι μέσα στα άγκιστρα τρέχει μία φορά, όταν ξεκινά η πλακέτα.'],
    [/^\s*void\s+loop\s*\(\s*\)/, () => 'Αρχή της loop(): ό,τι είναι μέσα στα άγκιστρα επαναλαμβάνεται ξανά και ξανά, για πάντα.'],
    [/^\s*(void|int|float|bool|long|unsigned long|String)\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/, m => `Ορίζει μια δική σου συνάρτηση ${m[2]}${m[3].trim() ? ` που παίρνει ${m[3].trim()}` : ' χωρίς παραμέτρους'}${m[1] === 'void' ? ' και δεν επιστρέφει τιμή' : ` και επιστρέφει ${m[1]}`}.`],
    [/pinMode\(\s*(\w+)\s*,\s*(\w+)\s*\)/, m => `Ρυθμίζει το pin ${m[1]} ως ${PINMODE[m[2]] || m[2]}.`],
    [/digitalWrite\(\s*(\w+)\s*,\s*(\w+)\s*\)/, m => `Γράφει στο pin ${m[1]} ${LEVEL(m[2])}.`],
    [/(\w+)\s*=\s*digitalRead\(\s*(\w+)\s*\)/, m => `Διαβάζει το pin ${m[2]} (HIGH ή LOW) και κρατά την τιμή στη μεταβλητή ${m[1]}.`],
    [/digitalRead\(\s*(\w+)\s*\)/, m => `Διαβάζει αν το pin ${m[1]} είναι HIGH ή LOW.`],
    [/analogRead\(\s*(\w+)\s*\)/, m => `Διαβάζει μια αναλογική τιμή (0–4095) από το pin ${m[1]}.`],
    [/pulseIn\(\s*(\w+)\s*,\s*(\w+)/, m => `Μετρά πόσα μικροδευτερόλεπτα μένει το pin ${m[1]} στο ${m[2]}: έτσι μετριέται η ηχώ του αισθητήρα απόστασης.`],
    [/delayMicroseconds\(\s*([^)]+)\)/, m => `Περιμένει ${m[1].trim()} μικροδευτερόλεπτα (εκατομμυριοστά του δευτερολέπτου).`],
    [/delay\(\s*([^)]+)\)/, m => `Σταματά για ${m[1].trim()} χιλιοστά του δευτερολέπτου${/^\d+$/.test(m[1].trim()) ? ` (${(Number(m[1]) / 1000).toLocaleString('el-GR')} δευτ.)` : ''}. Όσο περιμένει, η πλακέτα δεν κάνει τίποτα άλλο.`],
    [/millis\(\s*\)/, () => 'Χρησιμοποιεί το millis(): πόσα χιλιοστά του δευτερολέπτου πέρασαν από την εκκίνηση. Έτσι μετράς χρόνο χωρίς να σταματάς την πλακέτα.'],
    [/Serial\.begin\(\s*(\d+)\s*\)/, m => `Ανοίγει τη σειριακή σύνδεση με τον υπολογιστή στα ${m[1]} baud, για να βλέπεις μηνύματα στο Serial Monitor.`],
    [/Serial\.println\((.*)\)\s*;/, m => `Τυπώνει στο Serial Monitor ${m[1].trim() || 'μια κενή γραμμή'} και αλλάζει γραμμή.`],
    [/Serial\.print\((.*)\)\s*;/, m => `Τυπώνει στο Serial Monitor ${m[1].trim()}, χωρίς να αλλάξει γραμμή.`],
    [/WiFi\.begin\(/, () => 'Ξεκινά τη σύνδεση στο WiFi με το όνομα δικτύου και τον κωδικό.'],
    [/WiFi\.status\(\)\s*(==|!=)\s*WL_CONNECTED/, m => (m[1] === '==' ? 'Ελέγχει αν η πλακέτα συνδέθηκε στο WiFi.' : 'Ελέγχει αν η πλακέτα ΔΕΝ είναι ακόμα συνδεδεμένη στο WiFi.')],
    [/\.connect\(/, () => 'Προσπαθεί να συνδεθεί στον broker MQTT.'],
    [/\.publish\(\s*([^,]+),\s*(.+)\)\s*;/, m => `Στέλνει μήνυμα στο topic ${m[1].trim()} με περιεχόμενο ${m[2].trim()}.`],
    [/\.subscribe\(\s*([^)]+)\)/, m => `Γράφεται στο topic ${m[1].trim()}: από εδώ και πέρα θα λαμβάνει τα μηνύματά του.`],
    [/\.loop\(\s*\)/, () => 'Δίνει χρόνο στον client MQTT να στείλει και να λάβει μηνύματα. Πρέπει να καλείται συχνά.'],
    [/^\s*\}\s*else\s+if\s*\((.*)\)/, m => `Αλλιώς, αν ισχύει ${m[1].trim()}, τρέχει το επόμενο μπλοκ.`],
    [/^\s*(\}\s*)?else\b/, () => 'Αλλιώς: τρέχει μόνο αν καμία από τις προηγούμενες συνθήκες δεν ίσχυσε.'],
    [/^\s*if\s*\((.*)\)/, m => `Ελέγχει αν ισχύει ${m[1].trim()}. Μόνο τότε τρέχει το μπλοκ από κάτω.`],
    [/^\s*for\s*\(\s*(?:int\s+)?(\w+)\s*=\s*([^;]+);\s*([^;]+);/, m => `Βρόχος for: το ${m[1]} ξεκινά από ${m[2].trim()} και ο βρόχος επαναλαμβάνεται όσο ισχύει ${m[3].trim()}.`],
    [/^\s*while\s*\((.*)\)/, m => `Επαναλαμβάνει το μπλοκ όσο ισχύει ${m[1].trim()}.`],
    [/^\s*return\s*(.*);/, m => (m[1].trim() ? `Επιστρέφει την τιμή ${m[1].trim()} και τελειώνει η συνάρτηση.` : 'Τελειώνει τη συνάρτηση εδώ.')],
    [/^\s*const\s+\w+\s+(\w+)\s*=\s*(.+);/, m => `Σταθερά ${m[1]} = ${m[2].trim()}: ένα όνομα για μια τιμή που δεν αλλάζει. Αν χρειαστεί αλλαγή, την αλλάζεις σε ένα σημείο.`],
    [/^\s*(int|float|bool|long|unsigned long|String|char)\s+(\w+)\s*=\s*(.+);/, m => `Νέα μεταβλητή ${m[2]} τύπου ${m[1]}, με αρχική τιμή ${m[3].trim()}.`],
    [/^\s*(int|float|bool|long|unsigned long|String|char)\s+(\w+)\s*;/, m => `Νέα μεταβλητή ${m[2]} τύπου ${m[1]}, χωρίς αρχική τιμή ακόμα.`],
    [/^\s*(\w+)\s*\+\+\s*;/, m => `Αυξάνει το ${m[1]} κατά 1.`],
    [/^\s*(\w+)\s*([+\-*/])=\s*(.+);/, m => `Αλλάζει το ${m[1]}: ${({ '+': 'προσθέτει', '-': 'αφαιρεί', '*': 'πολλαπλασιάζει με', '/': 'διαιρεί με' })[m[2]]} ${m[3].trim()}.`],
    [/^\s*(\w+)\s*=\s*(.+);/, m => `Βάζει στη μεταβλητή ${m[1]} την τιμή ${m[2].trim()}.`],
    [/^\s*(\w+)\(([^)]*)\)\s*;/, m => `Καλεί τη συνάρτηση ${m[1]}${m[2].trim() ? ` με ${m[2].trim()}` : ''}: τρέχει ο κώδικάς της και μετά συνεχίζει εδώ.`],
    [/^\s*\}\s*$/, () => 'Κλείνει το μπλοκ που άνοιξε πιο πάνω με {.'],
    [/^\s*\{\s*$/, () => 'Ανοίγει ένα μπλοκ εντολών.']
  ];

  const PY = [
    [/^\s*#/, () => 'Σχόλιο: σημείωση για τον άνθρωπο. Η Python το αγνοεί.'],
    [/^\s*from\s+([\w.]+)\s+import\s+(.+)/, m => `Φέρνει από το module ${m[1]} τα ${m[2].trim()}, για να τα χρησιμοποιήσεις.`],
    [/^\s*import\s+([\w., ]+)/, m => `Φέρνει το module ${m[1].trim()} (έτοιμος κώδικας).`],
    [/^\s*def\s+(\w+)\s*\(([^)]*)\)\s*:/, m => `Ορίζει μια δική σου συνάρτηση ${m[1]}${m[2].trim() ? ` με παραμέτρους ${m[2].trim()}` : ''}. Ό,τι έχει εσοχή από κάτω ανήκει σε αυτήν.`],
    [/^\s*class\s+(\w+)/, m => `Ορίζει μια κλάση ${m[1]}: ένα «καλούπι» για αντικείμενα.`],
    [/^\s*elif\s+(.*):/, m => `Αλλιώς, αν ισχύει ${m[1].trim()}, τρέχει το μπλοκ με εσοχή από κάτω.`],
    [/^\s*else\s*:/, () => 'Αλλιώς: τρέχει μόνο αν καμία από τις προηγούμενες συνθήκες δεν ίσχυσε.'],
    [/^\s*if\s+__name__\s*==/, () => 'Τρέχει τον κώδικα από κάτω μόνο όταν το αρχείο εκτελείται απευθείας (όχι όταν γίνεται import).'],
    [/^\s*if\s+(.*):/, m => `Ελέγχει αν ισχύει ${m[1].trim()}. Μόνο τότε τρέχει το μπλοκ με εσοχή από κάτω.`],
    [/^\s*while\s+True\s*:/, () => 'Βρόχος που δεν τελειώνει ποτέ: το μπλοκ από κάτω επαναλαμβάνεται για πάντα (σαν το loop() της C++).'],
    [/^\s*while\s+(.*):/, m => `Επαναλαμβάνει το μπλοκ όσο ισχύει ${m[1].trim()}.`],
    [/^\s*for\s+(\w+)\s+in\s+range\((.*)\)\s*:/, m => `Βρόχος: το ${m[1]} παίρνει τις τιμές του range(${m[2]}) μία-μία.`],
    [/^\s*for\s+(.+)\s+in\s+(.+):/, m => `Βρόχος: για κάθε στοιχείο του ${m[2].trim()}, με όνομα ${m[1].trim()}, τρέχει το μπλοκ από κάτω.`],
    [/^\s*try\s*:/, () => 'Δοκιμάζει το μπλοκ από κάτω. Αν γίνει σφάλμα, δεν σταματά το πρόγραμμα: πάει στο except.'],
    [/^\s*except\s*(.*):/, m => `Αν έγινε σφάλμα${m[1].trim() ? ` τύπου ${m[1].trim()}` : ''} στο try, τρέχει αυτό το μπλοκ.`],
    [/^\s*finally\s*:/, () => 'Τρέχει πάντα στο τέλος, είτε έγινε σφάλμα είτε όχι.'],
    [/^\s*with\s+(.+)\s+as\s+(\w+)\s*:/, m => `Ανοίγει ${m[1].trim()} με όνομα ${m[2]} και το κλείνει μόνο του στο τέλος του μπλοκ.`],
    [/^\s*return\s*(.*)$/, m => (m[1].trim() ? `Επιστρέφει την τιμή ${m[1].trim()} και τελειώνει η συνάρτηση.` : 'Τελειώνει τη συνάρτηση εδώ.')],
    [/(\w+)\s*=\s*LED\((\d+)\)/, m => `Φτιάχνει ένα LED στο GPIO ${m[2]} με όνομα ${m[1]}.`],
    [/(\w+)\s*=\s*Button\((\d+)/, m => `Φτιάχνει ένα κουμπί στο GPIO ${m[2]} με όνομα ${m[1]}.`],
    [/(\w+)\s*=\s*MotionSensor\((\d+)/, m => `Φτιάχνει έναν αισθητήρα κίνησης στο GPIO ${m[2]} με όνομα ${m[1]}.`],
    [/(\w+)\s*=\s*Pin\((\d+),\s*Pin\.(OUT|IN)/, m => `Ρυθμίζει το pin ${m[2]} ως ${m[3] === 'OUT' ? 'έξοδο' : 'είσοδο'}, με όνομα ${m[1]}.`],
    [/(\w+)\.on\(\)/, m => `Ανάβει το ${m[1]} (HIGH).`],
    [/(\w+)\.off\(\)/, m => `Σβήνει το ${m[1]} (LOW).`],
    [/(\w+)\.value\((\d)\)/, m => `Γράφει ${m[2] === '1' ? 'HIGH (1)' : 'LOW (0)'} στο ${m[1]}.`],
    [/(\w+)\.value\(\)/, m => `Διαβάζει την τιμή του ${m[1]} (0 ή 1).`],
    [/(\w+)\.is_pressed/, m => `Ελέγχει αν το κουμπί ${m[1]} είναι πατημένο αυτή τη στιγμή.`],
    [/\.when_pressed\s*=\s*(\w+)/, m => `Όταν πατηθεί το κουμπί, να καλείται αυτόματα η συνάρτηση ${m[1]} (callback).`],
    [/(?:time\.)?sleep_ms\(([^)]+)\)/, m => `Περιμένει ${m[1].trim()} χιλιοστά του δευτερολέπτου.`],
    [/(?:time\.)?sleep\(([^)]+)\)/, m => `Περιμένει ${m[1].trim()} δευτερόλεπτα.`],
    [/\.publish\(\s*([^,]+),\s*(.+)\)/, m => `Στέλνει μήνυμα MQTT στο topic ${m[1].trim()} με περιεχόμενο ${m[2].trim()}.`],
    [/\.subscribe\(\s*([^)]+)\)/, m => `Γράφεται στο topic ${m[1].trim()} για να λαμβάνει τα μηνύματά του.`],
    [/\.loop_forever\(\)/, () => 'Αφήνει τον client MQTT να ακούει μηνύματα για πάντα.'],
    [/json\.loads\(/, () => 'Μετατρέπει κείμενο JSON σε λεξικό Python.'],
    [/json\.dumps\(/, () => 'Μετατρέπει ένα λεξικό Python σε κείμενο JSON, για να σταλεί.'],
    [/\.execute\(/, () => 'Εκτελεί μια εντολή SQL στη βάση (με ? για τις τιμές, ώστε να είναι ασφαλές).'],
    [/\.commit\(\)/, () => 'Αποθηκεύει μόνιμα τις αλλαγές στη βάση. Χωρίς commit, χάνονται.'],
    [/@app\.route\((.+)\)/, m => `Λέει στο Flask: όταν κάποιος ανοίξει τη διεύθυνση ${m[1].trim()}, να τρέξει η συνάρτηση από κάτω.`],
    [/^\s*print\((.*)\)\s*$/, m => `Τυπώνει στο τερματικό ${m[1].trim() || 'μια κενή γραμμή'}.`],
    [/^\s*(\w+)\s*\+=\s*(.+)$/, m => `Αυξάνει το ${m[1]} κατά ${m[2].trim()}.`],
    [/^\s*(\w+)\s*=\s*(.+)$/, m => `Βάζει στη μεταβλητή ${m[1]} την τιμή ${m[2].trim()}.`],
    [/^\s*(\w+)\(([^)]*)\)\s*$/, m => `Καλεί τη συνάρτηση ${m[1]}${m[2].trim() ? ` με ${m[2].trim()}` : ''}.`]
  ];

  const RS = [
    [/^\s*\/\//, () => 'Σχόλιο: η Rust το αγνοεί.'],
    [/^\s*use\s+(.+);/, m => `Φέρνει στο πρόγραμμα το ${m[1].trim()}, για να το χρησιμοποιείς με σύντομο όνομα.`],
    [/^\s*fn\s+main\s*\(/, () => 'Η main(): από εδώ ξεκινά το πρόγραμμα.'],
    [/^\s*(?:pub\s+)?fn\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^{]+))?/, m => `Ορίζει τη συνάρτηση ${m[1]}${m[2].trim() ? ` με παραμέτρους ${m[2].trim()}` : ''}${m[3] ? ` που επιστρέφει ${m[3].trim()}` : ''}.`],
    [/^\s*(?:pub\s+)?enum\s+(\w+)/, m => `Ορίζει τον τύπο ${m[1]} που μπορεί να είναι μόνο μία από τις παραλλαγές που ακολουθούν.`],
    [/^\s*(?:pub\s+)?struct\s+(\w+)/, m => `Ορίζει το struct ${m[1]}: πολλές τιμές μαζί, με ονόματα.`],
    [/^\s*let\s+mut\s+(\w+)(?:\s*:\s*([^=]+))?\s*=\s*(.+);/, m => `Νέα μεταβλητή ${m[1]} που ΜΠΟΡΕΙ να αλλάξει (mut)${m[2] ? `, τύπου ${m[2].trim()}` : ''}, με τιμή ${m[3].trim()}.`],
    [/^\s*let\s+(\w+)(?:\s*:\s*([^=]+))?\s*=\s*(.+);/, m => `Νέα μεταβλητή ${m[1]}${m[2] ? ` τύπου ${m[2].trim()}` : ''} με τιμή ${m[3].trim()}. Χωρίς mut δεν αλλάζει (αλλιώς error E0384).`],
    [/^\s*match\s+(.+)\s*\{/, m => `Ελέγχει το ${m[1].trim()} απέναντι σε κάθε περίπτωση από κάτω. Πρέπει να καλύπτονται ΟΛΕΣ οι περιπτώσεις.`],
    [/^\s*(Some|None|Ok|Err)\b.*=>/, m => `Περίπτωση του match: τι γίνεται όταν η τιμή είναι ${m[1]}.`],
    [/^\s*_\s*=>/, () => 'Η περίπτωση «οτιδήποτε άλλο» του match.'],
    [/^\s*\}\s*else\s+if\s+(.*)\{/, m => `Αλλιώς, αν ισχύει ${m[1].trim()}, τρέχει το επόμενο μπλοκ.`],
    [/^\s*(\}\s*)?else\b/, () => 'Αλλιώς: τρέχει αν καμία από τις προηγούμενες συνθήκες δεν ίσχυσε.'],
    [/^\s*if\s+let\s+(.+)\s*=\s*(.+)\{/, m => `Αν το ${m[2].trim()} ταιριάζει με ${m[1].trim()}, τρέχει το μπλοκ (και παίρνεις την τιμή μέσα του).`],
    [/^\s*if\s+(.*)\{/, m => `Ελέγχει αν ισχύει ${m[1].trim()}.`],
    [/^\s*loop\s*\{/, () => 'Βρόχος που δεν τελειώνει, ώσπου να βρει break.'],
    [/^\s*while\s+(.*)\{/, m => `Επαναλαμβάνει όσο ισχύει ${m[1].trim()}.`],
    [/^\s*for\s+(\w+)\s+in\s+(.+)\{/, m => `Για κάθε ${m[1]} μέσα στο ${m[2].trim()}, τρέχει το μπλοκ.`],
    [/println!\((.*)\)/, m => `Τυπώνει στο τερματικό ${m[1].trim()} και αλλάζει γραμμή. Τα {} γεμίζουν με τιμές.`],
    [/\.unwrap\(\)/, () => 'unwrap(): παίρνει την τιμή, αλλά αν είναι None ή Err το πρόγραμμα σταματά (panic). Σε συσκευή, προτίμησε match ή ?.'],
    [/\?\s*;/, () => 'Το ? : αν η τιμή είναι Err, επιστρέφει αμέσως το σφάλμα· αλλιώς παίρνει την τιμή και συνεχίζει.'],
    [/set_high\(\)/, () => 'Γράφει HIGH στο pin: ανάβει.'],
    [/set_low\(\)/, () => 'Γράφει LOW στο pin: σβήνει.'],
    [/is_high\(\)/, () => 'Ελέγχει αν το pin είναι HIGH.'],
    [/sleep\(/, () => 'Περιμένει για τον χρόνο που δίνεται (Duration).'],
    [/^\s*return\s+(.+);/, m => `Επιστρέφει την τιμή ${m[1].trim()}.`],
    [/^\s*break\s*;/, () => 'Βγαίνει από τον βρόχο.'],
    [/^\s*(\w+)\s*([+\-*/])=\s*(.+);/, m => `Αλλάζει το ${m[1]} (${m[2]}= ${m[3].trim()}). Θέλει η μεταβλητή να είναι mut.`],
    [/^\s*(\w+)\s*=\s*(.+);/, m => `Βάζει στη μεταβλητή ${m[1]} την τιμή ${m[2].trim()} (θέλει mut).`],
    [/^\s*\}\s*$/, () => 'Κλείνει το μπλοκ.']
  ];

  function explainLine(line, lang) {
    if (!line || !line.trim()) return null;
    const rules = lang === 'python' ? PY : lang === 'rust' ? RS : CPP;
    // τα σχόλια στο τέλος της γραμμής δεν μετράνε, εκτός αν η γραμμή είναι μόνο σχόλιο
    const code = lang === 'python' ? line.replace(/\s+#.*$/, '') : line.replace(/\s+\/\/.*$/, '');
    for (const [re, f] of rules) {
      const m = code.match(re);
      if (m) return f(m);
    }
    return null;
  }

  // ------------------------------------------------------------ επανάληψη σε διαστήματα

  const BOX_DAYS = [0, 1, 2, 4, 8, 16];
  const GOAL = 3;
  const pad = n => String(n).padStart(2, '0');
  const dayStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return dayStr(new Date(y, m - 1, d + n)); };

  // Μόλις τελειώσει μια άσκηση μπαίνει στο κουτί 1 και ξαναρωτιέται αύριο.
  function enroll(review, id, today) { if (!review[id]) review[id] = { box: 1, due: addDays(today, 1) }; return review; }
  // Σωστό: ανεβαίνει κουτί (περισσότερες μέρες ως την επόμενη φορά). Λάθος: πίσω στο κουτί 1.
  function answer(review, id, ok, today) {
    const e = review[id] || { box: 1, due: today };
    const box = ok ? Math.min(5, e.box + 1) : 1;
    review[id] = { box, due: addDays(today, BOX_DAYS[box]) };
    return review[id];
  }
  const dueIds = (review, today) => Object.keys(review).filter(id => review[id].due <= today).sort((a, b) => review[a].box - review[b].box || (review[a].due < review[b].due ? -1 : 1));

  // Στόχος ημέρας: 3 «βήματα» (άσκηση που τελείωσε ή σωστή επανάληψη). Σερί: συνεχόμενες μέρες με στόχο.
  function bump(daily, today, n) {
    const d = Object.assign({ date: today, count: 0, streak: 0, best: 0, lastMet: '' }, daily || {});
    if (d.date !== today) { d.date = today; d.count = 0; }
    const before = d.count;
    d.count += n || 1;
    if (before < GOAL && d.count >= GOAL && d.lastMet !== today) {
      d.streak = d.lastMet === addDays(today, -1) ? d.streak + 1 : 1;
      d.lastMet = today;
      d.best = Math.max(d.best, d.streak);
    }
    return d;
  }
  function dailyView(daily, today) {
    const d = daily || {};
    const count = d.date === today ? d.count : 0;
    const alive = d.lastMet === today || d.lastMet === addDays(today, -1);
    return { count: Math.min(count, GOAL), goal: GOAL, met: count >= GOAL, streak: alive ? d.streak || 0 : 0, best: d.best || 0 };
  }

  // ------------------------------------------------------------ φύλλο σημειώσεων κεφαλαίου

  function chapterNotes(ch, lessons, glossary, completed) {
    const defs = new Map(glossary.map(g => [g.term.toLowerCase(), g]));
    const objectives = [];
    const terms = [];
    const snippets = [];
    const learned = [];
    for (const l of lessons) {
      for (const o of l.objectives || []) if (!objectives.includes(o)) objectives.push(o);
      for (const t of l.glossary || []) { const g = defs.get(t.toLowerCase()); if (g && !terms.includes(g)) terms.push(g); }
      const m = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(l.theory || '');
      if (m && snippets.length < 4) snippets.push({ title: l.title, code: m[1] });
      if (completed && completed[l.id] && l.explanationOnSuccess) learned.push({ title: l.title, text: l.explanationOnSuccess });
    }
    return `<article class="notes">
      <h2>Σημειώσεις · Κεφάλαιο ${esc(ch.label || ch.n)}: ${esc(ch.title)}</h2>
      <section><h3>Τι μαθαίνω</h3><ul>${objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul></section>
      <section><h3>Λέξεις του κεφαλαίου</h3><dl class="notes-gl">${terms.map(g => `<div><dt>${esc(g.term)}</dt><dd>${esc(g.def)}</dd></div>`).join('')}</dl></section>
      ${snippets.length ? `<section><h3>Κώδικας για να θυμάσαι</h3>${snippets.map(s => `<p class="notes-st">${esc(s.title)}</p><pre>${s.code}</pre>`).join('')}</section>` : ''}
      ${learned.length ? `<section><h3>Τι κατάλαβα (από όσα τελείωσα)</h3><ul>${learned.map(x => `<li><b>${esc(x.title)}:</b> ${esc(x.text)}</li>`).join('')}</ul></section>` : ''}
    </article>`;
  }

  root.IoTLearn = { linkTerms, variants, explainLine, enroll, answer, dueIds, bump, dailyView, dayStr, addDays, chapterNotes, GOAL, BOX_DAYS };
})(typeof window !== 'undefined' ? window : globalThis);
