/*
 * IoT Guardian — Κεφάλαιο 9: Ανάλυση δικτύου.
 * Συνθετικές καταγραφές του δικού μας εικονικού δικτύου. Πρώτα: πακέτο, IP, port,
 * client/server, TCP. Μετά: φιλτράρισμα και επιλογή γραμμών-τεκμηρίων.
 * Όλα τα πακέτα είναι συνθετικά· κανένα πραγματικό δίκτυο δεν καταγράφεται.
 */
(function (root) {
  'use strict';
  const L = root.IoTLessons;
  L.CHAPTERS.find(c => c.n === 9).ready = true;

  const addTerm = (term, def) => { if (!L.GLOSSARY.some(g => g.term === term)) L.GLOSSARY.push({ term, def }); };
  addTerm('πακέτο', 'Ένα μικρό κομμάτι δεδομένων που ταξιδεύει στο δίκτυο. Έχει αποστολέα, παραλήπτη και περιεχόμενο. Ένα μήνυμα MQTT ταξιδεύει μέσα σε πακέτα.');
  addTerm('διεύθυνση IP', 'Ο «αριθμός σπιτιού» μιας συσκευής στο δίκτυο, π.χ. 192.168.1.43. Δείχνει ποια συσκευή στέλνει (ip.src) και ποια παραλαμβάνει (ip.dst).');
  addTerm('θύρα (port)', 'Ο «αριθμός διαμερίσματος» μέσα σε μια συσκευή: ποιο πρόγραμμα θα πάρει το πακέτο. Ο broker MQTT ακούει συνήθως στη θύρα 1883 (ή 8883 με TLS).');
  addTerm('client / server', 'Ο server περιμένει συνδέσεις σε μια γνωστή θύρα (εδώ ο broker). Ο client ξεκινά τη σύνδεση (εδώ οι ESP32 και το dashboard).');
  addTerm('TCP', 'Ο τρόπος μεταφοράς που χρησιμοποιεί το MQTT. Ανοίγει μια σύνδεση ανάμεσα σε client και server και φροντίζει τα δεδομένα να φτάνουν με σειρά και χωρίς κενά.');
  addTerm('Network Monitor', 'Το εργαλείο της εφαρμογής που δείχνει τα συνθετικά πακέτα του εικονικού σου δικτύου: χρόνο, αποστολέα, παραλήπτη, πρωτόκολλο και περιγραφή.');
  addTerm('φίλτρο', 'Μια συνθήκη που κρατά μόνο τα πακέτα που σε ενδιαφέρουν, π.χ. mqtt.topic == "home/temperature". Εδώ υποστηρίζεται ένα μικρό εκπαιδευτικό υποσύνολο.');
  addTerm('τεκμήριο', 'Οι συγκεκριμένες γραμμές (πακέτα ή log) που στηρίζουν ένα συμπέρασμα. Μια καλή απάντηση λέει «το ξέρω από τις γραμμές 7 και 12», όχι «έτσι νομίζω».');

  const OPEN = 'listener 1883\nallow_anonymous true\n';
  const FILTER_NOTE = '<p><strong>Προσοχή:</strong> τα φίλτρα εδώ είναι ένα <strong>μικρό εκπαιδευτικό υποσύνολο</strong>, εμπνευσμένο από το Wireshark. Δεν είναι η πλήρης σύνταξη του Wireshark. Υποστηρίζονται: <code>mqtt</code>, <code>tls</code>, <code>tcp</code>, <code>tcp.port == N</code>, <code>ip.src == …</code>, <code>ip.dst == …</code>, <code>ip.addr == …</code>, <code>mqtt.topic == "…"</code>, το <code>!=</code> και το <code>&amp;&amp;</code> ανάμεσα.</p>';
  const IP_TABLE = `
<ul>
  <li><code>192.168.1.10</code>: Raspberry Pi με τον broker (server)</li>
  <li><code>192.168.1.43</code>: ESP32 θερμοκρασίας (esp32-temp)</li>
  <li><code>192.168.1.42</code>: ESP32 κίνησης (esp32-pir)</li>
  <li><code>192.168.1.44</code>: ESP32 λάμπας (esp32-lamp)</li>
  <li><code>192.168.1.20</code>: dashboard</li>
</ul>`;

  L.lessons.push(
    {
      id: 'c9-l1', chapter: 9, kind: 'micro', mode: 'analysis', skills: ['analysis', 'network'],
      title: 'Πακέτα, IP, θύρες: ποιος μιλά σε ποιον',
      prerequisites: [],
      objectives: ['Να ξέρω τι είναι πακέτο, διεύθυνση IP και θύρα.', 'Να ξεχωρίζω client και server σε μια καταγραφή.', 'Να επιλέγω γραμμές-τεκμήρια στον Network Monitor.'],
      theory: `
<p>Όταν η ESP32 στέλνει ένα μήνυμα MQTT, αυτό ταξιδεύει στο δίκτυο μέσα σε <strong>πακέτα</strong>. Κάθε πακέτο είναι μία γραμμή στον <strong>Network Monitor</strong>.</p>
<p>Κάθε πακέτο έχει:</p>
<ul>
  <li><strong>διεύθυνση IP</strong> αποστολέα (Source) και παραλήπτη (Destination): ποια <em>συσκευή</em>.</li>
  <li><strong>θύρα (port)</strong>: ποιο <em>πρόγραμμα</em> μέσα στη συσκευή. Ο broker ακούει στη θύρα <code>1883</code>.</li>
</ul>
<p>Ο broker είναι ο <strong>server</strong>: περιμένει. Οι ESP32 και το dashboard είναι <strong>clients</strong>: ξεκινούν τη σύνδεση από μια τυχαία θύρα τους (π.χ. 50100) προς τη θύρα 1883.</p>
<p>Το MQTT πατά πάνω στο <strong>TCP</strong>, που κρατά μια σταθερή σύνδεση client–server. Για απλότητα, ο Monitor δεν δείχνει τα πακέτα ανοίγματος του TCP. Δείχνει τα πακέτα MQTT: CONNECT, CONNACK, SUBSCRIBE, PUBLISH.</p>
<p>Οι διευθύνσεις του εικονικού σπιτιού:</p>${IP_TABLE}
<p>Η καταγραφή είναι <strong>συνθετική</strong>: φτιάχτηκε από το εικονικό σου σπίτι, όχι από πραγματικό δίκτυο.</p>`,
      glossary: ['πακέτο', 'διεύθυνση IP', 'θύρα (port)', 'client / server', 'TCP', 'Network Monitor'],
      panels: ['net'],
      capture: {
        broker: OPEN,
        scenario: [
          { connect: 'esp32-temp', port: 1883 },
          { wait: 2000 },
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":21.40}' },
          { wait: 1000 },
          { connect: 'dashboard', port: 1883 },
          { subscribe: 'dashboard', topic: 'home/#' },
          { wait: 3000 },
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":21.60}' }
        ]
      },
      evidence: { filter: 'ip.src == 192.168.1.43 && ip.dst == 192.168.1.10' },
      evidenceHint: 'Επίλεξε όλα τα πακέτα που έστειλε η ESP32 θερμοκρασίας (client) προς τον broker (server). Ούτε ένα παραπάνω, ούτε ένα λιγότερο.',
      steps: [
        'Διάβασε τη θεωρία και κράτα δίπλα σου τον πίνακα με τις διευθύνσεις.',
        'Στον Network Monitor κοίτα τις στήλες Source και Destination κάθε γραμμής.',
        'Γράψε στο φίλτρο: ip.src == 192.168.1.43 και δες ποιες γραμμές μένουν.',
        'Επίλεξε τις γραμμές-τεκμήρια και απάντησε στην ερώτηση.'
      ],
      quiz: {
        question: 'Στα πακέτα από την ESP32 θερμοκρασίας προς τον broker, ποια θύρα προορισμού βλέπεις, και τι σημαίνει;',
        options: ['1883: η θύρα όπου ακούει ο broker (server)', '50100: η θύρα όπου ακούει ο broker', '192.168.1.10: η θύρα του broker'],
        answer: 0,
        explain: 'Σωστά. Ο server ακούει σε μια γνωστή θύρα (1883 για MQTT). Ο client χρησιμοποιεί μια τυχαία δική του θύρα, π.χ. 50100. Το 192.168.1.10 είναι διεύθυνση IP, όχι θύρα.',
        retry: 'Όχι ακόμα. Η IP λέει ποια συσκευή. Η θύρα λέει ποιο πρόγραμμα. Ποιο πρόγραμμα περιμένει μηνύματα MQTT;'
      },
      hints: [
        'Η ESP32 θερμοκρασίας έχει IP 192.168.1.43. Ο broker έχει 192.168.1.10.',
        'Ψάχνεις γραμμές όπου Source = 192.168.1.43 και Destination = 192.168.1.10. Τα πακέτα της αντίθετης κατεύθυνσης (απαντήσεις του broker) δεν μετράνε.',
        'Φίλτρο: ip.src == 192.168.1.43 && ip.dst == 192.168.1.10\nΘα μείνουν 3 γραμμές: Connect Command και δύο Publish Message. Επίλεξέ τες όλες.'
      ],
      explanationOnSuccess: 'Διάβασες μια καταγραφή όπως ένας τεχνικός δικτύου: ποιος στέλνει (IP), σε ποιο πρόγραμμα (θύρα), ποιος ξεκινά τη σύνδεση (client) και ποιος περιμένει (server). Και στήριξες την απάντησή σου σε συγκεκριμένες γραμμές.',
      remediation: 'Αν ο έλεγχος λέει ότι τα τεκμήρια δεν ταιριάζουν, έλεγξε ότι δεν επέλεξες το Connect Ack: αυτό το στέλνει ο broker προς την ESP32, όχι το αντίθετο.'
    },

    {
      id: 'c9-l2', chapter: 9, kind: 'guided', mode: 'analysis', skills: ['analysis', 'mqtt'],
      title: 'Ποια συσκευή έστειλε τη μέτρηση, και πότε;',
      prerequisites: ['c9-l1'],
      objectives: ['Να γράφω φίλτρο με δύο συνθήκες ενωμένες με &&.', 'Να ξεχωρίζω το πακέτο του αποστολέα από την προώθηση του broker.', 'Να απαντώ «ποιος» και «πότε» με αναφορά σε συγκεκριμένη γραμμή.'],
      theory: `
<p>Σε ένα σπίτι με πολλές συσκευές, ο Network Monitor γεμίζει γρήγορα. Το <strong>φίλτρο</strong> κρατά μόνο ό,τι σε ενδιαφέρει.</p>
<p>Ξεκίνα απλά: <code>mqtt.topic == "home/temperature"</code>. Θα δεις <strong>δύο</strong> γραμμές για την ίδια μέτρηση:</p>
<ol>
  <li>η συσκευή στέλνει στον broker (Destination <code>192.168.1.10</code>),</li>
  <li>ο broker την προωθεί στο dashboard (Source <code>192.168.1.10</code>).</li>
</ol>
<p>Ο <strong>αποστολέας</strong> της μέτρησης είναι η Source της πρώτης γραμμής. Πρόσθεσε με <code>&amp;&amp;</code> μια δεύτερη συνθήκη: <code>ip.dst == 192.168.1.10</code>.</p>
<p>Η στήλη <strong>Time</strong> δείχνει πότε έγινε, σε δευτερόλεπτα από την αρχή της καταγραφής.</p>
${FILTER_NOTE}`,
      glossary: ['φίλτρο', 'τεκμήριο', 'διεύθυνση IP'],
      panels: ['net'],
      capture: {
        broker: OPEN,
        scenario: [
          { connect: 'dashboard', port: 1883 },
          { subscribe: 'dashboard', topic: 'home/#' },
          { connect: 'esp32-pir', port: 1883 },
          { connect: 'esp32-lamp', port: 1883 },
          { subscribe: 'esp32-lamp', topic: 'home/led/set' },
          { connect: 'esp32-temp', port: 1883 },
          { wait: 4000 },
          { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion":true}' },
          { wait: 3000 },
          { publish: 'dashboard', topic: 'home/led/set', payload: '{"cmd":"ON"}' },
          { publish: 'esp32-lamp', topic: 'home/led/state', payload: '{"led":"ON"}' },
          { wait: 5000 },
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":23.10}' },
          { wait: 2000 },
          { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion":false}' }
        ]
      },
      evidence: { filter: 'mqtt.topic == "home/temperature" && ip.dst == 192.168.1.10' },
      evidenceHint: 'Επίλεξε μόνο το πακέτο όπου η μέτρηση θερμοκρασίας φεύγει από τη συσκευή προς τον broker. Όχι την προώθηση προς το dashboard.',
      steps: [
        'Γράψε στο φίλτρο: mqtt.topic == "home/temperature". Πόσες γραμμές μένουν;',
        'Κοίτα τις στήλες Source και Destination. Ποια γραμμή είναι ο αποστολέας και ποια η προώθηση του broker;',
        'Πρόσθεσε: && ip.dst == 192.168.1.10',
        'Επίλεξε τη γραμμή-τεκμήριο. Διάβασε Source και Time και απάντησε στην ερώτηση.'
      ],
      quiz: {
        question: 'Ποια συσκευή έστειλε τη μέτρηση θερμοκρασίας και πότε;',
        options: [
          '192.168.1.43 (ESP32 θερμοκρασίας), περίπου στο δευτερόλεπτο 12',
          '192.168.1.10 (broker), περίπου στο δευτερόλεπτο 12',
          '192.168.1.42 (ESP32 κίνησης), περίπου στο δευτερόλεπτο 4',
          '192.168.1.20 (dashboard), περίπου στο δευτερόλεπτο 7'
        ],
        answer: 0,
        explain: 'Σωστά. Στο πακέτο-τεκμήριο η Source είναι 192.168.1.43 και η Destination ο broker. Ο broker απλώς προώθησε τη μέτρηση στο dashboard: δεν την έφτιαξε.',
        retry: 'Όχι ακόμα. Ο broker εμφανίζεται ως Source στην προώθηση, αλλά δεν είναι ο αρχικός αποστολέας. Κοίτα το πακέτο με Destination 192.168.1.10.'
      },
      hints: [
        'Κάθε μέτρηση εμφανίζεται δύο φορές: όταν φτάνει στον broker και όταν φεύγει από αυτόν.',
        'Το πακέτο του αποστολέα έχει Destination τον broker (192.168.1.10). Ενώνεις δύο συνθήκες με &&.',
        'Φίλτρο: mqtt.topic == "home/temperature" && ip.dst == 192.168.1.10\nΘα μείνει μία γραμμή «Publish Message [home/temperature]». Source = 192.168.1.43 και Time ≈ 12 s.'
      ],
      explanationOnSuccess: 'Απάντησες στο «ποιος» και στο «πότε» με μία συγκεκριμένη γραμμή ως τεκμήριο. Είδες επίσης ότι ο broker εμφανίζεται ως αποστολέας στην προώθηση, χωρίς να είναι η πηγή της μέτρησης.',
      remediation: 'Αν το φίλτρο βγάζει σφάλμα, έλεγξε ότι το topic είναι σε διπλά εισαγωγικά και ότι γράφεις δύο ίσον (==) και δύο & (&&).'
    },

    {
      id: 'c9-l3', chapter: 9, kind: 'variant', mode: 'analysis', skills: ['analysis', 'mqtt'],
      title: 'Γιατί κόλλησε η θερμοκρασία; Το λάθος topic',
      prerequisites: ['c9-l2'],
      objectives: ['Να εντοπίζω ορθογραφικό λάθος σε topic μέσα σε καταγραφή.', 'Να εξηγώ γιατί ο broker δεν παραδίδει μηνύματα σε λάθος topic.'],
      theory: `
<p>Το dashboard δείχνει θερμοκρασία <strong>22.00</strong> εδώ και ώρα, ενώ το δωμάτιο ζεσταίνεται. Η ESP32 θερμοκρασίας πήρε πρόσφατα νέο κώδικα.</p>
<p>Εδώ το dashboard έχει κάνει subscribe <strong>μόνο</strong> στο <code>home/temperature</code> (όχι στο <code>home/#</code>).</p>
<p>Θυμήσου από το Κεφάλαιο 7: ο broker συγκρίνει τα topics <strong>γράμμα-γράμμα</strong>. Αν κανείς δεν έχει κάνει subscribe σε ένα topic, ο broker δέχεται το μήνυμα, αλλά <strong>δεν το παραδίδει πουθενά</strong>. Κανείς δεν παίρνει μήνυμα λάθους.</p>
<p>Ψάξε στην καταγραφή: στέλνει ακόμα η συσκευή; Αν ναι, σε ποιο topic; Φτάνει κάτι στο dashboard (<code>192.168.1.20</code>);</p>
${FILTER_NOTE}`,
      glossary: ['topic', 'φίλτρο', 'τεκμήριο'],
      panels: ['net'],
      capture: {
        broker: OPEN,
        scenario: [
          { connect: 'dashboard', port: 1883 },
          { subscribe: 'dashboard', topic: 'home/temperature' },
          { connect: 'esp32-temp', port: 1883 },
          { wait: 1000 },
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":21.80}' },
          { wait: 5000 },
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":22.00}' },
          { wait: 5000 },
          { disconnect: 'esp32-temp' },
          { wait: 2000 },
          { connect: 'esp32-temp', port: 1883 },
          { wait: 1000 },
          { publish: 'esp32-temp', topic: 'home/temprature', payload: '{"t":22.40}' },
          { wait: 5000 },
          { publish: 'esp32-temp', topic: 'home/temprature', payload: '{"t":22.90}' },
          { wait: 5000 },
          { publish: 'esp32-temp', topic: 'home/temprature', payload: '{"t":23.30}' }
        ]
      },
      evidence: { filter: 'mqtt.topic == "home/temprature"' },
      evidenceHint: 'Επίλεξε όλα τα πακέτα που στάλθηκαν στο λάθος topic. Αυτά εξηγούν γιατί το dashboard δεν ενημερώνεται.',
      steps: [
        'Χωρίς φίλτρο, διάβασε την καταγραφή από πάνω προς τα κάτω. Τι αλλάζει μετά την επανασύνδεση της ESP32;',
        'Φίλτρο ip.src == 192.168.1.43 && mqtt: δες σε ποια topics στέλνει.',
        'Φίλτρο ip.dst == 192.168.1.20: ποια μηνύματα έφτασαν πραγματικά στο dashboard;',
        'Φίλτραρε το λάθος topic, επίλεξε τα τεκμήρια και απάντησε στην ερώτηση.'
      ],
      quiz: {
        question: 'Γιατί το dashboard έμεινε στο 22.00;',
        options: [
          'Μετά τον νέο κώδικα η ESP32 στέλνει στο home/temprature (λείπει ένα e) και κανείς δεν έχει subscribe εκεί',
          'Η ESP32 θερμοκρασίας σταμάτησε να στέλνει',
          'Ο broker απορρίπτει τις νέες μετρήσεις',
          'Το δωμάτιο δεν ζεσταίνεται πραγματικά'
        ],
        answer: 0,
        explain: 'Σωστά. Τα τεκμήρια δείχνουν ότι η συσκευή στέλνει κανονικά, κάθε 5 δευτερόλεπτα, αλλά στο home/temprature. Ο broker τα δέχεται και δεν βρίσκει κανέναν subscriber, άρα δεν φεύγει κανένα πακέτο προς το 192.168.1.20.',
        retry: 'Όχι ακόμα. Η συσκευή συνεχίζει να στέλνει πακέτα. Σύγκρινε γράμμα-γράμμα τα topics πριν και μετά την επανασύνδεση.'
      },
      hints: [
        'Η συσκευή δεν σταμάτησε: στα τελευταία δευτερόλεπτα υπάρχουν ακόμα Publish από το 192.168.1.43.',
        'Σύγκρινε το topic των δύο πρώτων Publish με το topic των τελευταίων. Μέτρα τα γράμματα.',
        'Φίλτρο: mqtt.topic == "home/temprature"\nΘα μείνουν 3 γραμμές. Επίλεξέ τες όλες. Το σωστό topic είναι home/temperature, με e μετά το p.'
      ],
      explanationOnSuccess: 'Βρήκες ένα «σιωπηλό» λάθος: η συσκευή δούλευε, ο broker δούλευε, αλλά τα μηνύματα δεν έφταναν πουθενά. Το τεκμήριο ήταν τα πακέτα με το λάθος topic και η απουσία πακέτων προς το dashboard. Η διόρθωση γίνεται στον κώδικα της ESP32, όχι στον broker.',
      remediation: 'Αν το φίλτρο δεν δείχνει τίποτα, αντέγραψε το topic ακριβώς όπως το βλέπεις στη στήλη Info: home/temprature.'
    },

    {
      id: 'c9-l4', chapter: 9, kind: 'checkpoint', mode: 'analysis', skills: ['analysis', 'mqtt'],
      title: 'Έλεγχος: ποια συσκευή στέλνει πολύ συχνά;',
      prerequisites: ['c9-l3'],
      objectives: ['Να εντοπίζω ασυνήθιστα συχνή αποστολή από τη στήλη Time.', 'Να συνδέω ένα εύρημα δικτύου με πιθανό λάθος στον κώδικα.', 'Να προτείνω ασφαλές επόμενο βήμα με βάση τα τεκμήρια.'],
      theory: `
<p>Ο broker του σπιτιού φαίνεται «φορτωμένος». Κάποια συσκευή στέλνει <strong>πολύ περισσότερα</strong> μηνύματα από όσα χρειάζεται.</p>
<p>Πώς μοιάζει η κανονική συμπεριφορά;</p>
<ul>
  <li>Θερμοκρασία: ένα μήνυμα κάθε μερικά δευτερόλεπτα, ή όταν αλλάζει.</li>
  <li>Κατάσταση λάμπας: ένα μήνυμα <strong>όταν αλλάζει</strong>.</li>
</ul>
<p>Αν δεις το <strong>ίδιο</strong> μήνυμα ξανά και ξανά, με λίγα <strong>χιλιοστά του δευτερολέπτου</strong> απόσταση στη στήλη Time, κάτι δεν πάει καλά. Συνήθως είναι ένα <code>publish</code> μέσα στο <code>loop()</code> χωρίς τον έλεγχο αλλαγής του Κεφαλαίου 3.</p>
<p>Όλες οι συσκευές εδώ είναι <strong>δικές σου</strong>. Ψάχνεις σφάλμα, όχι ένοχο.</p>
${FILTER_NOTE}`,
      glossary: ['τεκμήριο', 'φίλτρο', 'κατάσταση (state)'],
      panels: ['net'],
      capture: {
        broker: OPEN,
        scenario: [
          { connect: 'dashboard', port: 1883 },
          { subscribe: 'dashboard', topic: 'home/#' },
          { connect: 'esp32-temp', port: 1883 },
          { connect: 'esp32-pir', port: 1883 },
          { wait: 2000 },
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":22.10}' },
          { wait: 3000 },
          { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion":true}' },
          { wait: 1000 },
          { connect: 'esp32-lamp', port: 1883 },
          { publish: 'esp32-lamp', topic: 'home/led/state', payload: '{"led":"ON"}', gap: 2 },
          { publish: 'esp32-lamp', topic: 'home/led/state', payload: '{"led":"ON"}', gap: 2 },
          { publish: 'esp32-lamp', topic: 'home/led/state', payload: '{"led":"ON"}', gap: 2 },
          { publish: 'esp32-lamp', topic: 'home/led/state', payload: '{"led":"ON"}', gap: 2 },
          { publish: 'esp32-lamp', topic: 'home/led/state', payload: '{"led":"ON"}', gap: 2 },
          { publish: 'esp32-lamp', topic: 'home/led/state', payload: '{"led":"ON"}', gap: 2 },
          { publish: 'esp32-lamp', topic: 'home/led/state', payload: '{"led":"ON"}', gap: 2 },
          { publish: 'esp32-lamp', topic: 'home/led/state', payload: '{"led":"ON"}', gap: 2 },
          { wait: 2000 },
          { publish: 'esp32-temp', topic: 'home/temperature', payload: '{"t":22.30}' },
          { publish: 'esp32-pir', topic: 'home/motion', payload: '{"motion":false}' }
        ]
      },
      evidence: { filter: 'ip.src == 192.168.1.44 && mqtt.topic == "home/led/state"' },
      evidenceHint: 'Επίλεξε όλα τα πακέτα όπου η συσκευή που στέλνει υπερβολικά συχνά στέλνει το μήνυμά της στον broker. Όχι τις προωθήσεις προς το dashboard.',
      steps: [
        'Χωρίς φίλτρο, κοίτα τη στήλη Time. Πού πυκνώνουν οι γραμμές;',
        'Βρες ποια IP στέλνει αυτά τα πακέτα και σε ποιο topic.',
        'Γράψε φίλτρο που κρατά μόνο τα πακέτα αυτής της συσκευής σε αυτό το topic.',
        'Επίλεξε όλα τα τεκμήρια και απάντησε στην ερώτηση.'
      ],
      quiz: {
        question: 'Τι δείχνουν τα τεκμήρια και ποιο είναι το σωστό επόμενο βήμα;',
        options: [
          'Η ESP32 λάμπας (192.168.1.44) στέλνει το ίδιο {"led":"ON"} κάθε λίγα ms. Μάλλον λείπει ο έλεγχος αλλαγής: διορθώνω τον κώδικά της να στέλνει μόνο όταν αλλάζει η κατάσταση',
          'Η ESP32 θερμοκρασίας στέλνει πολύ συχνά: της αλλάζω το topic',
          'Ο broker φτιάχνει μόνος του τα μηνύματα: τον κάνω επανεκκίνηση',
          'Είναι φυσιολογικό: κάθε κατάσταση στέλνεται πολλές φορές για σιγουριά'
        ],
        answer: 0,
        explain: 'Σωστά. Οκτώ ίδια μηνύματα σε περίπου 15 ms από το 192.168.1.44, ενώ η κατάσταση δεν άλλαξε. Η θερμοκρασία στέλνεται κάθε λίγα δευτερόλεπτα, που είναι λογικό. Η διόρθωση είναι στον κώδικα της λάμπας: publish μόνο όταν αλλάζει η κατάσταση. Για αξιοπιστία υπάρχουν το QoS και η επιβεβαίωση, όχι το «στέλνω πολλές φορές».',
        retry: 'Όχι ακόμα. Δες τις διαφορές χρόνου στη στήλη Time ανάμεσα στα πακέτα κάθε συσκευής. Ποια στέλνει κάθε δευτερόλεπτα και ποια κάθε λίγα χιλιοστά;'
      },
      hints: [
        'Ψάξε μια ομάδα γραμμών με σχεδόν ίδιο χρόνο (διαφορά 0.002 s) και ίδιο περιεχόμενο.',
        'Τα πακέτα αυτά έχουν Source 192.168.1.44 (λάμπα) και topic home/led/state. Οι ίδιες γραμμές με Source 192.168.1.10 είναι προωθήσεις προς το dashboard και δεν μετράνε.',
        'Φίλτρο: ip.src == 192.168.1.44 && mqtt.topic == "home/led/state"\nΘα μείνουν 8 γραμμές. Επίλεξέ τες όλες.'
      ],
      explanationOnSuccess: 'Ολοκλήρωσες το Κεφάλαιο 9. Ξεκίνησες από την ερώτηση «τι είναι ένα πακέτο» και τώρα βρίσκεις ποια συσκευή έχει σφάλμα, με αριθμό γραμμής και χρόνο. Το συμπέρασμά σου στηρίζεται σε τεκμήρια, όχι σε εικασία.',
      remediation: 'Αν ο έλεγχος λέει ότι τα τεκμήρια δεν ταιριάζουν, μέτρα: πρέπει να είναι ακριβώς 8 γραμμές, όλες με Source 192.168.1.44.'
    }
  );
})(typeof window !== 'undefined' ? window : globalThis);
