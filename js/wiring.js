/*
 * IoT Guardian — «Σύνδεσε μόνος σου τα καλώδια».
 * Ο μαθητής διαλέγει για κάθε καλώδιο το pin της πλακέτας. Αν διαλέξει λάθος, μαθαίνει ΓΙΑΤΙ
 * δεν θα δούλευε (GND = πάντα 0 V, 3V3 = πάντα ρεύμα, pins μόνο-είσοδος, pins της flash…).
 * Καθαρές συναρτήσεις: η διεπαφή είναι στο ui.js.
 */
(function (root) {
  'use strict';

  // Τι κάνει κάθε καλώδιο της σκηνής: έξοδος (η πλακέτα γράφει), είσοδος (η πλακέτα διαβάζει) ή γείωση.
  const WIRES = {
    'w-led': { label: 'LED · σήμα (+)', role: 'out', what: 'το LED' },
    'w-gnd': { label: 'Γείωση (GND)', role: 'gnd', what: 'η γείωση' },
    'w-btn': { label: 'Κουμπί', role: 'in', what: 'το κουμπί' },
    'w-pir': { label: 'PIR · OUT', role: 'in', what: 'ο PIR' },
    'w-trig': { label: 'HC-SR04 · TRIG', role: 'out', what: 'το TRIG' },
    'w-echo': { label: 'HC-SR04 · ECHO', role: 'in', what: 'το ECHO' },
    'w-red': { label: 'Φανάρι · κόκκινο', role: 'out', what: 'το κόκκινο φως' },
    'w-yel': { label: 'Φανάρι · κίτρινο', role: 'out', what: 'το κίτρινο φως' },
    'w-grn': { label: 'Φανάρι · πράσινο', role: 'out', what: 'το πράσινο φως' },
    'w-buz': { label: 'Buzzer', role: 'out', what: 'το buzzer' },
    'w-servo': { label: 'Servo · σήμα', role: 'out', what: 'το servo' },
    'w-rgbr': { label: 'LED RGB · κόκκινο', role: 'out', what: 'το κόκκινο του LED RGB' },
    'w-rgbg': { label: 'LED RGB · πράσινο', role: 'out', what: 'το πράσινο του LED RGB' },
    'w-rgbb': { label: 'LED RGB · μπλε', role: 'out', what: 'το μπλε του LED RGB' },
    'w-sda': { label: 'OLED · SDA (δεδομένα)', role: 'out', what: 'το SDA της οθόνης' },
    'w-scl': { label: 'OLED · SCL (ρολόι)', role: 'out', what: 'το SCL της οθόνης' }
  };
  const CLASSES = Object.keys(WIRES);

  // Όνομα για εμφάνιση: GND2 → GND, 3V3b → 3V3, GPIO17 → GPIO17
  const shown = p => p.replace(/^GND\w*$/, 'GND').replace(/^(3V3|5V)b$/, '$1');
  // Τι είδους pin είναι
  function kindOf(p) {
    if (/^GND/.test(p)) return 'gnd';
    if (/^(3V3|5V)/.test(p)) return p.startsWith('5V') ? 'v5' : 'v3';
    if (p === 'EN') return 'en';
    if (/^(SD\d|CLK|CMD)$/.test(p)) return 'flash';
    if (p === 'TX' || p === 'RX') return 'uart';
    if (/^(VP|VN|D34|D35)$/.test(p)) return 'inonly';
    if (/^ID_S[CD]$/.test(p)) return 'id';
    return 'gpio';
  }
  const gpioNum = (p, board) => (board === 'pi' ? (p.match(/^GPIO(\d+)$/) || [])[1] : (p.match(/^D(\d+)$/) || [])[1]);

  // Οι εργασίες συνδεσμολογίας από τον κατάλογο της σκηνής (ένα καλώδιο = μία εργασία).
  function tasksFrom(manifest) {
    // i = σειρά του καλωδίου ανάμεσα σε ΟΛΑ τα καλώδια της σκηνής (ίδιο με το data-wi της SVG)
    return (manifest || []).filter(o => o.t === 'wire').map((o, i) => ({ o, i })).filter(x => x.o.a && x.o.a.name)
      .map(({ o, i }) => Object.assign({ i, cls: o.cls, pin: o.a.name }, WIRES[o.cls] || { label: o.cls, role: 'out', what: 'το εξάρτημα' }));
  }

  // Ελέγχει μια επιλογή: { ok, msg }
  function judge(task, pick, board) {
    const k = kindOf(pick);
    const want = shown(task.pin);
    const n = gpioNum(task.pin, board);
    const where = `${want}${n && board !== 'pi' ? ` (GPIO ${n})` : ''}`;
    if (task.role === 'gnd') {
      if (k === 'gnd') return { ok: true, msg: `Σωστά! Το μαύρο καλώδιο πάει στο GND (${shown(pick)}): από εκεί γυρίζει το ρεύμα και κλείνει το κύκλωμα. Όλα τα GND της πλακέτας είναι ενωμένα μεταξύ τους.` };
      if (k === 'v3' || k === 'v5') return { ok: false, msg: `Όχι! Το ${shown(pick)} βγάζει πάντα τάση. Αν η γείωση πήγαινε εκεί, δεν θα υπήρχε δρόμος επιστροφής για το ρεύμα. Η γείωση πάει σε ένα από τα pins GND.` };
      return { ok: false, msg: `Το ${shown(pick)} δεν είναι γείωση. Ψάξε ένα pin με το όνομα GND: εκεί επιστρέφει το ρεύμα.` };
    }
    if (pick === task.pin) {
      const why = task.role === 'out' ? 'Ο κώδικας γράφει HIGH ή LOW σε αυτό το pin.' : 'Ο κώδικας διαβάζει από αυτό το pin αν είναι HIGH ή LOW.';
      return { ok: true, msg: `Σωστά! ${task.label} → ${where}. ${why}` };
    }
    const out = task.role === 'out';
    const msgs = {
      gnd: out ? `Το GND είναι πάντα 0 V (LOW): ${task.what} δεν θα άναβε ποτέ, ό,τι κι αν έγραφε ο κώδικας.` : `Το GND είναι πάντα 0 V: ο κώδικας θα διάβαζε πάντα LOW, όσο κι αν πατάς ή κινείσαι.`,
      v3: out ? `Το ${shown(pick)} έχει πάντα ρεύμα: ${task.what} θα έμενε συνέχεια αναμμένο και ο κώδικας δεν θα μπορούσε να το σβήσει.` : `Το ${shown(pick)} έχει πάντα ρεύμα: ο κώδικας θα διάβαζε πάντα HIGH.`,
      v5: `Το 5V έχει πάντα ρεύμα, και μάλιστα περισσότερο από όσο αντέχουν τα pins (δουλεύουν στα 3,3 V). Εδώ θέλουμε ένα GPIO που το ελέγχει ο κώδικας.`,
      en: 'Το EN επανεκκινεί την πλακέτα όταν γίνει LOW. Δεν είναι για εξαρτήματα.',
      flash: 'Τα SD0–SD3, CLK και CMD είναι ενωμένα με τη μνήμη flash του module. Αν τα χρησιμοποιήσεις, η πλακέτα δεν ξεκινά.',
      uart: 'Τα TX και RX τα χρησιμοποιεί η σύνδεση USB για το Serial Monitor. Αν βάλεις κάτι εκεί, χαλάει η επικοινωνία με τον υπολογιστή.',
      inonly: out ? `Το ${pick} είναι μόνο είσοδος: δεν μπορεί να βγάλει HIGH για να ανάψει κάτι.` : `Το ${pick} μπορεί να διαβάσει, αλλά δεν είναι αυτό που περιμένει ο κώδικας.`,
      id: 'Τα ID_SD και ID_SC είναι για να αναγνωρίζει το Pi πρόσθετες πλακέτες (HAT). Μην τα χρησιμοποιείς.',
      gpio: `Το ${shown(pick)} είναι κανονικό GPIO, αλλά ο κώδικας περιμένει ${task.what} στο ${where}. Στο ${shown(pick)} θα ${out ? 'έγραφε' : 'διάβαζε'} άλλο pin. Κοίτα τη σταθερά στην αρχή του κώδικα (π.χ. LED_PIN).`
    };
    return { ok: false, msg: msgs[k] };
  }

  root.IoTWiring = { WIRES, CLASSES, tasksFrom, judge, kindOf, shown, gpioNum };
})(typeof window !== 'undefined' ? window : globalThis);
