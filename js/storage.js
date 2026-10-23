/*
 * IoT Guardian — αποθήκευση προόδου στο localStorage.
 * Κρατά μόνο εκπαιδευτικά δεδομένα: ολοκληρωμένα μαθήματα, απαντήσεις,
 * πρόχειρο κώδικα και ρυθμίσεις. Κανένα προσωπικό δεδομένο ή μυστικό.
 */
(function (root) {
  'use strict';

  const KEY = 'iot-guardian-progress';
  const SCHEMA = 1;
  const MAX_DRAFT = 20000;

  function knownIds() {
    return new Set((root.IoTLessons ? root.IoTLessons.lessons : []).map(l => l.id));
  }

  function defaults() {
    return {
      schema: SCHEMA,
      completed: {},
      quizzes: {},
      drafts: {},
      hints: {},
      current: null,
      track: null,
      stories: {},
      review: {},
      wired: {},
      challenges: {},
      sandbox: { hw: {}, code: {} },
      blocks: {},
      tours: {},
      daily: null,
      settings: { theme: 'system', fontScale: 1, lineSpacing: 'normal', reducedMotion: false, sound: true, font: 'noto', letters: 'normal', readRate: 0.9, ruler: 'off', gardi: true, gardiVoice: false, codeView: 'text', readEnglish: true }
    };
  }

  function validate(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'Το αρχείο δεν περιέχει έγκυρη πρόοδο.' };
    if (obj.schema !== SCHEMA) return { ok: false, error: `Άγνωστη έκδοση δεδομένων (${obj.schema}). Περίμενα ${SCHEMA}.` };
    const ids = knownIds();
    const out = defaults();
    const pickBool = src => {
      const o = {};
      if (src && typeof src === 'object') for (const [k, v] of Object.entries(src)) if (ids.has(k) && v === true) o[k] = true;
      return o;
    };
    out.completed = pickBool(obj.completed);
    out.quizzes = pickBool(obj.quizzes);
    if (obj.drafts && typeof obj.drafts === 'object') {
      for (const [k, v] of Object.entries(obj.drafts)) if (ids.has(k) && typeof v === 'string' && v.length <= MAX_DRAFT) out.drafts[k] = v;
    }
    if (obj.hints && typeof obj.hints === 'object') {
      for (const [k, v] of Object.entries(obj.hints)) if (ids.has(k) && Number.isInteger(v) && v >= 0 && v <= 3) out.hints[k] = v;
    }
    if (typeof obj.current === 'string' && ids.has(obj.current)) out.current = obj.current;
    if (typeof obj.track === 'string' && /^(cpp|py|rs)-(esp32|pi)$/.test(obj.track)) out.track = obj.track;
    if (obj.stories && typeof obj.stories === 'object') for (const [k, v] of Object.entries(obj.stories)) if (/^\d{1,3}$/.test(k) && v === true) out.stories[k] = true;
    if (obj.blocks && typeof obj.blocks === 'object' && root.IoTBlocks) {
      for (const [k, v] of Object.entries(obj.blocks)) if ((ids.has(k) || /^sandbox:(cpp|py|rs)-(esp32|pi)$/.test(k)) && v && typeof v === 'object') out.blocks[k] = root.IoTBlocks.normalize(v);
    }
    if (obj.tours && typeof obj.tours === 'object') for (const k of ['home', 'lab']) if (obj.tours[k] === true) out.tours[k] = true;
    const sb = obj.sandbox;
    if (sb && typeof sb === 'object') {
      const TR = /^(cpp|py|rs)-(esp32|pi)$/;
      const HW = ['led', 'button', 'pir', 'sensor', 'router', 'ultrasonic', 'traffic', 'buzzer', 'servo', 'rgb', 'oled'];
      if (sb.hw && typeof sb.hw === 'object') for (const [k, v] of Object.entries(sb.hw)) if (TR.test(k) && Array.isArray(v)) out.sandbox.hw[k] = v.filter(h => HW.includes(h));
      if (sb.code && typeof sb.code === 'object') for (const [k, v] of Object.entries(sb.code)) if (TR.test(k) && typeof v === 'string' && v.length <= MAX_DRAFT) out.sandbox.code[k] = v;
    }
    const ROOMS = ['desk', 'entrance', 'hallway', 'workshop', 'greenhouse', 'livingroom', 'serverroom', 'garage'];
    if (obj.challenges && typeof obj.challenges === 'object') for (const [k, v] of Object.entries(obj.challenges)) if (ROOMS.includes(k) && v && Number.isInteger(v.n) && v.n > 0 && Number.isInteger(v.best) && v.best >= 0) out.challenges[k] = { n: v.n, best: v.best };
    if (obj.wired && typeof obj.wired === 'object') for (const [k, v] of Object.entries(obj.wired)) if (/^w-[a-z]{3,5}$/.test(k) && v === true) out.wired[k] = true;
    const day = /^\d{4}-\d{2}-\d{2}$/;
    if (obj.review && typeof obj.review === 'object') {
      for (const [k, v] of Object.entries(obj.review)) if (ids.has(k) && v && Number.isInteger(v.box) && v.box >= 1 && v.box <= 5 && day.test(v.due)) out.review[k] = { box: v.box, due: v.due };
    }
    const dl = obj.daily;
    if (dl && typeof dl === 'object' && day.test(dl.date) && Number.isInteger(dl.count) && dl.count >= 0 && dl.count < 1000) {
      out.daily = { date: dl.date, count: dl.count, streak: Number.isInteger(dl.streak) && dl.streak >= 0 ? dl.streak : 0, best: Number.isInteger(dl.best) && dl.best >= 0 ? dl.best : 0, lastMet: day.test(dl.lastMet) ? dl.lastMet : '' };
    }
    const s = obj.settings || {};
    if (['system', 'light', 'dark'].includes(s.theme)) out.settings.theme = s.theme;
    if (typeof s.fontScale === 'number' && s.fontScale >= 0.85 && s.fontScale <= 1.6) out.settings.fontScale = s.fontScale;
    if (['normal', 'relaxed', 'loose'].includes(s.lineSpacing)) out.settings.lineSpacing = s.lineSpacing;
    if (typeof s.reducedMotion === 'boolean') out.settings.reducedMotion = s.reducedMotion;
    if (typeof s.sound === 'boolean') out.settings.sound = s.sound;
    if (['noto', 'didact', 'ysabeau'].includes(s.font)) out.settings.font = s.font;
    if (['normal', 'wide', 'wider'].includes(s.letters)) out.settings.letters = s.letters;
    if (['off', 'line', 'focus'].includes(s.ruler)) out.settings.ruler = s.ruler;
    if (typeof s.gardi === 'boolean') out.settings.gardi = s.gardi;
    if (['text', 'blocks'].includes(s.codeView)) out.settings.codeView = s.codeView;
    if (typeof s.readEnglish === 'boolean') out.settings.readEnglish = s.readEnglish;
    if (typeof s.gardiVoice === 'boolean') out.settings.gardiVoice = s.gardiVoice;
    if (typeof s.readRate === 'number' && s.readRate >= 0.6 && s.readRate <= 1.4) out.settings.readRate = s.readRate;
    if (typeof s.voiceName === 'string' && s.voiceName.length <= 120) out.settings.voiceName = s.voiceName;
    return { ok: true, data: out };
  }

  function load() {
    try {
      const raw = root.localStorage && root.localStorage.getItem(KEY);
      if (!raw) return defaults();
      const v = validate(JSON.parse(raw));
      return v.ok ? v.data : defaults();
    } catch (e) {
      return defaults();
    }
  }

  function save(state) {
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function exportJson(state) {
    return JSON.stringify(Object.assign({ app: 'IoT Guardian', exported: new Date().toISOString() }, state), null, 2);
  }

  function parseImport(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'Το κείμενο δεν είναι έγκυρο JSON. Επικόλλησε ολόκληρο το περιεχόμενο της εξαγωγής.' }; }
    return validate(obj);
  }

  root.IoTStorage = { load, save, defaults, validate, exportJson, parseImport, SCHEMA };
})(typeof window !== 'undefined' ? window : globalThis);
