/* Seed data for the doctor's prescription pad (ported from the standalone
   TELEMEDIB prescription-writing app). Everything here is a starting master
   list — the prescriber can add/edit/delete items from the pickers, and all
   changes persist to localStorage under the `medisuite-rxpad.*` keys.

   The pad deliberately keeps its own medicine/phrase catalogue separate from
   the pharmacy inventory module: this is the clinician's personal formulary
   and phrase book, not the dispensary's stock list. */

/* ---- Section catalogue -------------------------------------------------- */
/* type: 'list' (generic picker) | 'medicine' | 'followup'
   style controls how the label renders on the pad. */
export const LEFT_SECTIONS = [
  { key: 'presenting', label: 'Presenting problem', style: 'blue-italic' },
  { key: 'known', label: 'Known diseases', style: 'italic' },
  { key: 'ecg', label: 'ECG Findings:' },
  { key: 'echo', label: 'Echo Report:' },
  { key: 'ett', label: 'ETT:' },
  { key: 'lipid', label: 'Lipid Profile:' },
  { key: 'otherInv', label: 'Other Investigation:' },
  { key: 'cag', label: 'CAG Report:' },
  { key: 'procedure', label: 'Procedure Note:' },
  { key: 'onexam', label: 'On Examinations', style: 'blue-italic' },
  { key: 'investigation', label: 'Investigation', style: 'blue-italic', underline: true },
  { key: 'plan', label: 'Plan' },
  { key: 'advice', label: 'ADVICE:' },
]

export const RIGHT_SECTIONS = [
  { key: 'rx', label: 'Rx,', style: 'rx', type: 'medicine' },
  { key: 'upodesh', label: 'উপদেশঃ' },
  { key: 'followup', label: 'পরবর্তী সাক্ষাতঃ', type: 'followup' },
  { key: 'cardiac', label: 'Cardiac opinion:', style: 'blue' },
  { key: 'referred', label: 'REFFERED TO:', style: 'blue' },
  { key: 'diagnosis', label: 'DIAGNOSIS:', style: 'red' },
  { key: 'receipt', label: 'Receipt:' },
]

export const ALL_SECTIONS = [...LEFT_SECTIONS, ...RIGHT_SECTIONS]

/* The customizable section catalogue starts as the seed lists above. The
   prescriber can rename sections, hide them, or add custom ones from the
   "Prescription Layout" panel; the working copy persists under
   `medisuite-rxpad.sections` and this is only the factory default. */
export const DEFAULT_SECTIONS = [
  ...LEFT_SECTIONS.map((s) => ({ ...s, side: 'left' })),
  ...RIGHT_SECTIONS.map((s) => ({ ...s, side: 'right' })),
]

/* ---- Per-section style options (the section style editor) --------------- */
/* Each section can carry `styles: { section|list|entry|name|note: {...} }`
   set from the style modal. Sizes are the CSS font-size keywords the original
   app exposed; fonts are stacks that ship with Windows/most browsers plus the
   Bengali faces the pad already relies on. */
export const FONT_SIZES = ['default', 'xx-small', 'x-small', 'small', 'medium', 'large', 'x-large', 'xx-large']
export const EN_FONTS = ['Segoe UI', 'Georgia', 'Times New Roman', 'Arial', 'Verdana', 'Courier New']
export const BN_FONTS = ['Noto Sans Bengali', 'Noto Serif Bengali', 'Hind Siliguri', 'SolaimanLipi']

/* Inline style for one target of a section; undefined when nothing is set so
   the pad's default CSS stays untouched. */
export function sectionStyle(sec, target) {
  const st = sec?.styles?.[target]
  if (!st) return undefined
  const s = {}
  if (st.fontSize && st.fontSize !== 'default') s.fontSize = st.fontSize
  if (st.color) s.color = st.color
  if (st.fontEn || st.fontBn) {
    s.fontFamily = [st.fontEn, st.fontBn].filter(Boolean).map((f) => `'${f}'`).join(', ')
  }
  const line = '1px solid #222'
  const b = st.border || {}
  if (b.t) s.borderTop = line
  if (b.b) s.borderBottom = line
  if (b.l) s.borderLeft = line
  if (b.r) s.borderRight = line
  const p = st.padding || {}
  if (p.t || p.r || p.b || p.l) s.padding = `${p.t || 0}px ${p.r || 0}px ${p.b || 0}px ${p.l || 0}px`
  return Object.keys(s).length ? s : undefined
}

/* ---- Medicines ---------------------------------------------------------- */
export const DOSES = ['১+০+১', '১+০+০', '০+০+১', '১+১+১', '০+১+০', '১+১+১+১', '১/২+০+১/২', '১+০+১/২']
export const TIMINGS = ['খাবার পরে', 'খাবার আগে', 'ভরা পেটে', 'খালি পেটে', 'রাতে শোবার আগে']
export const DURATIONS = ['৩ দিন', '৭ দিন', '১০ দিন', '১৫ দিন', '১ মাস', '২ মাস', '৩ মাস', '৬ মাস', 'চলবে']

/* Medicine Remarks master (the timing/instruction phrases). Kept as its own
   scored list — the picker's timing dropdown and the Preset Data settings
   page both read it; TIMINGS above remains only the factory fallback. */
let rid = 0
const R = (text, score = 0) => ({ id: `r${++rid}`, text, score })
export const SEED_REMARKS = [
  R('ভরা পেটে', 3034),
  R('খাবার পরে', 2323),
  R('খাওয়ার আগে', 2170),
  R('খাওয়ার ৩০ মিনিট আগে', 1837),
  R('প্রতি সপ্তাহে ১টা করে ৮ সপ্তাহ', 588),
  R('খালি পেটে', 531),
  R('রাতে শোবার আগে', 246),
  R('প্রয়োজনে', 120),
]

/* score: how often the prescriber has used the item — the pickers rank by
   it, mirroring the reference app's "Score" column. presets: alternative
   dosage suggestions; the medicine's own dose/timing/duration fields are
   the current default ("Make Default" rewrites them from a preset). */
let mid = 0
const M = (brand, strength, form, generic = '', company = '', score = 0) => ({
  id: `m${++mid}`,
  brand,
  strength,
  form,
  generic,
  company,
  score,
  hidden: false,
  presets: [],
  dose: '১+০+১',
  timing: 'খাবার পরে',
  duration: 'চলবে',
})

export const SEED_MEDICINES = [
  M('Ecosprin Plus', '75 mg + 75 mg', 'Tablet', 'Aspirin + Clopidogrel', 'Acme Laboratories Limited.', 1180),
  M('Ecosprin', '75 mg', 'Tablet (Enteric Coated)', 'Aspirin', 'Acme Laboratories Limited.', 1083),
  M('Lopirel Plus', '75 mg + 75 mg', 'Tablet', 'Clopidogrel + Aspirin', 'Incepta Pharmaceuticals Limited', 1076),
  M('Linatab E', '5/10', 'Tablet', 'Linagliptin + Empagliflozin', 'Beximco Pharmaceuticals Ltd.', 640),
  M('Clopid-AS', '75 mg + 75 mg', 'Tablet', 'Clopidogrel + Aspirin', 'Drug International Ltd.', 610),
  M('Lopirel', '75 mg', 'Tablet', 'Clopidogrel', 'Incepta Pharmaceuticals Limited', 560),
  M('Clopid', '75 mg', 'Tablet', 'Clopidogrel', 'Drug International Ltd.', 520),
  M('NITRIN SR', '2.6 MG', 'Tablet', 'Nitroglycerin', 'Square Pharmaceuticals Ltd.', 505),
  M('Rostab', '10 mg', 'Tablet', 'Rosuvastatin', 'Renata Limited', 480),
  M('Rocovas', '10 mg', 'Tablet', 'Rosuvastatin', 'Square Pharmaceuticals Ltd.', 455),
  M('Rostab', '20 mg', 'Tablet', 'Rosuvastatin', 'Renata Limited', 430),
  M('Rostab', '5 mg', 'Tablet', 'Rosuvastatin', 'Renata Limited', 410),
  M('Pantonix', '20 mg', 'Tablet', 'Pantoprazole', 'Incepta Pharmaceuticals Limited', 395),
  M('Bislol', '2.5 mg', 'Tablet', 'Bisoprolol', 'Drug International Ltd.', 360),
  M('Nidocard Retard', '2.6 mg', 'Tablet', 'Nitroglycerin', 'Techno Drugs Ltd.', 340),
  M('Sitagil M', '50 mg + 500 mg', 'Tablet (Extended Release)', 'Sitagliptin + Metformin', 'Incepta Pharmaceuticals Limited', 310),
  M('Sabitar', '24 mg + 26 mg', 'Tablet', 'Sacubitril + Valsartan', 'Incepta Pharmaceuticals Limited', 290),
  M('Metacard MR', '35 mg', 'Tablet (Modified Release)', 'Trimetazidine', 'Drug International Ltd.', 270),
  M('Metazine MR', '35 mg', 'Tablet (Modified Release)', 'Trimetazidine', 'Opsonin Pharma Limited', 240),
  M('Efodio', '10 mg', 'Tablet', 'Empagliflozin', 'Beximco Pharmaceuticals Ltd.', 220),
  M('Carva', '75 mg', 'Tablet (Enteric Coated)', 'Aspirin', 'Square Pharmaceuticals Ltd.', 200),
  M('Remmo', '20 mg', 'Tablet', 'Rivaroxaban', 'Beximco Pharmaceuticals Ltd.', 170),
  M('Trocer SR', '2.6 mg', 'Tablet (Sustained Release)', 'Nitroglycerin', 'Aristopharma Ltd.', 150),
  M('Dexlan', '30 mg', 'Capsule (Delayed Release)', 'Dexlansoprazole', 'Incepta Pharmaceuticals Limited', 130),
]

/* A few dosage suggestion presets so the settings page's "User Suggestion"
   panel and the picker's preset menu are not empty on first run. */
SEED_MEDICINES[0].dose = '০+১+০'
SEED_MEDICINES[0].defaultPresetId = 'p1'
SEED_MEDICINES[0].presets = [
  { id: 'p1', dose: '০+১+০', timing: 'একসাথে একবার ভরা পেটে', duration: 'চলবে' },
  { id: 'p2', dose: '০+১+০', timing: 'খাওয়ার পরে', duration: '১ মাস' },
  { id: 'p3', dose: '১+০+১', timing: 'খাওয়ার পরে', duration: '১ মাস' },
  { id: 'p4', dose: '০+১+০', timing: 'ভরা পেটে', duration: 'চলবে' },
]
SEED_MEDICINES[12].presets = [
  { id: 'p5', dose: '১+০+১', timing: 'খাওয়ার ৩০ মিনিট আগে', duration: '১ মাস' },
  { id: 'p6', dose: '০+০+১', timing: 'খাওয়ার আগে', duration: 'চলবে' },
]

export const SEED_MEDICINE_GROUPS = [
  { id: 'mg1', name: 'Post MI (DAPT + Statin)', medIds: ['m1', 'm9', 'm14', 'm13'] },
  { id: 'mg2', name: 'Angina', medIds: ['m8', 'm18', 'm14'] },
]

/* ---- Generic section master lists -------------------------------------- */
let iid = 0
const I = (text, subs = [], score = 0) => ({ id: `i${++iid}`, text, subs, score })

export const SEED_MASTER = {
  presenting: [
    I('Chest pain', ['for 7 days', 'for 1 month', 'on exertion', 'at rest']),
    I('Shortness of breath', ['on exertion', 'at rest', 'NYHA-II', 'NYHA-III']),
    I('Palpitation'),
    I('Dizziness'),
    I('Syncope'),
    I('Leg swelling'),
  ],
  known: [
    I('HTN', ['for 5 years', 'for 10 years', 'newly diagnosed']),
    I('DM', ['for 5 years', 'for 10 years', 'newly diagnosed']),
    I('IHD'),
    I('Dyslipidemia'),
    I('CKD'),
    I('COPD / Asthma'),
  ],
  ecg: [
    I('Sinus rhythm, normal ECG'),
    I('Sinus tachycardia'),
    I('Atrial fibrillation'),
    I('ST elevation in anterior leads'),
    I('ST depression with T inversion'),
    I('Old inferior MI'),
    I('LVH with strain pattern'),
  ],
  echo: [
    I('Normal LV systolic function, EF 60%'),
    I('LVEF 45%, mild LV systolic dysfunction'),
    I('LVEF 35%, moderate LV systolic dysfunction'),
    I('Severe Mitral Stenosis, MVA 0.9 cm²'),
    I('Concentric LVH, Grade-I diastolic dysfunction'),
    I('RWMA in LAD territory'),
  ],
  ett: [
    I('Negative for inducible ischaemia'),
    I('Positive for inducible ischaemia'),
    I('Inconclusive — submaximal effort'),
  ],
  lipid: [
    I('TC 220, TG 180, LDL 140, HDL 38'),
    I('Within normal limits'),
  ],
  otherInv: [
    I('CBC, RBS, S. Creatinine'),
    I('HbA1c'),
    I('S. Electrolytes'),
    I('Troponin-I'),
    I('D-dimer'),
    I('TSH'),
  ],
  cag: [
    I('Normal epicardial coronaries'),
    I('Single vessel disease — LAD 80%'),
    I('Double vessel disease'),
    I('Triple vessel disease'),
  ],
  procedure: [
    I('PCI to LAD with DES'),
    I('PCI to RCA with DES'),
    I('PTMC done'),
    I('Permanent pacemaker implantation (VVI)'),
  ],
  onexam: [
    I('BP', ['110/70 mmHg', '120/80 mmHg', '130/85 mmHg', '140/90 mmHg', '150/90 mmHg', '160/100 mmHg']),
    I('Pulse', ['60 bpm, regular', '72 bpm, regular', '80 bpm, regular', '96 bpm, irregular']),
    I('Heart — S1 S2 normal, no murmur'),
    I('Lungs — clear'),
    I('No oedema'),
    I('Anaemia — absent'),
  ],
  investigation: [
    I('ECG'),
    I('Echocardiogram (2D & Doppler)'),
    I('ETT'),
    I('Chest X-ray P/A view'),
    I('CBC with ESR'),
    I('Fasting lipid profile'),
    I('HbA1c'),
    I('S. Creatinine'),
    I('S. Electrolytes'),
    I('Troponin-I'),
    I('CAG (Coronary Angiogram)'),
  ],
  plan: [
    I('Medical management'),
    I('CAG, then decision'),
    I('PCI'),
    I('CABG referral'),
    I('Device therapy evaluation'),
  ],
  advice: [
    I('CORONARY ANGIOGRAM', ['RENAL PACKAGE', 'PTCA ( IF NEEDED, Y)'], 48),
    I('ECHO', [], 15),
    I('CABG', ['Patient refused'], 13),
    I('Continue all previous medications', [], 9),
    I('Stop smoking completely', [], 6),
    I('Salt restricted diet', [], 4),
    I('Review with all reports', [], 2),
  ],
  upodesh: [
    I('শাক সবজি, ফলমূল, ইসবগুলের ভুষি খাবেন'),
    I('চর্বি জাতীয় খাবার (গরু/খাসীর মাংস, চিংড়ি মাছ, মগজ, কলিজা, নারিকেল, ডিমের কুসুম) কম খাবেন।'),
    I('পাতে লবন খাবেন না ।'),
    I('ওজন নিয়ন্ত্রনে রাখবেন।'),
    I('প্রতিদিন ৩০ মিনিট মধ্যম গতিতে হাঁটবেন, সপ্তাহে ০৫ দিন।'),
    I('নিয়মিত ব্যায়াম করুন'),
    I('মানসিক চাপ পরিহার করবেন'),
    I('অতিরিক্ত শ্বাস কষ্ট বা বুকে ব্যথা হলে নিকটস্থ হাসপাতালে ভর্তি হবেন'),
    I('লবন নিষেধ'),
    I('ধূমপান ও তামাক জাতীয় দ্রব্য সম্পূর্ণ নিষেধ'),
  ],
  followup: [
    I('১৫ দিন পর সকল রিপোর্টসহ দেখা করবেন।', [], 89),
    I('১৫ দিন পর দেখা করবেন।', [], 12),
    I('৭ দিন পর দেখা করবেন।', [], 8),
    I('পরবর্তী চিকিৎসার জন্য গ্যাস্ট্রোএন্টেরোলজিস্ট ডাঃ মোস্তফা নুর মহসিন স্যারের ৩০৪ নং রুমে যোগাযোগ করবেন।', [], 3),
    I('৩ মাস পর দেখা করবেন।', [], 3),
    I('৩০ দিন পর সকল রিপোর্টসহ দেখা করবেন।', [], 2),
    I('১ মাস পর দেখা করবেন।', [], 2),
    I('সকল রিপোর্টসহ দেখা করবেন।', [], 1),
    I('ব্যাথা বাড়লে আসবেন'),
    I('জ্বর বাড়লে আসবেন'),
    I('টেস্ট রিপোট নিয়ে আসবেন'),
  ],
  cardiac: [
    I('CATARACT SURGERY CAN BE DONE WITHOUT RISK OF MAJOR ADVERSE CARDIAC EVENTS.'),
    I('SURGERY CAN BE DONE UNDER SAB OR G/A WITHOUT RISK OF MAJOR ADVERSE CARDIAC EVENTS.'),
    I('STOP TAB ECOSPRIN 75MG, 7 DAYS BEFORE OPERATION AND RESTART 2 DAYS AFTER OPERATION'),
    I('Patient is fit for his job both mentally and physically.'),
  ],
  referred: [
    I('পরবর্তী চিকিৎসার জন্য গাইনীরোগ বিশেষজ্ঞের সাথে যোগাযোগ করবেন।'),
    I('পরবর্তী চিকিৎসার জন্য নিউরোমেডিসিন বিশেষজ্ঞের সাথে যোগাযোগ করবেন।'),
    I('TO R/P ( CARDIOLOGY), PLEASE ADMIT THE PATIENT TO W-12 FOR CAG ON SUNDAY.'),
    I('এঞ্জিওগ্রাম পরীক্ষার জন্য সকল রিপোর্টসহ বহিঃ বিভাগের ভর্তি টিকিট নিয়ে আবাসিক চিকিৎসক (কার্ডিওলজি) এর সাথে যোগাযোগ করবেন।'),
  ],
  diagnosis: [
    I('Severe Mitral Stenosis'),
    I('IHD — Chronic Stable Angina'),
    I('Acute Coronary Syndrome (NSTEMI)'),
    I('Acute Anterior MI'),
    I('Hypertensive Heart Disease'),
    I('Heart Failure with Reduced EF'),
    I('Atrial Fibrillation'),
  ],
  receipt: [
    I('Received 1000/= BDT as consultancy.'),
    I('Received 800/= BDT as consultancy.'),
    I('Received 500/= BDT as report showing fee.'),
  ],
}

export const SEED_GROUPS = {
  investigation: [
    { id: 'g1', name: 'Routine cardiac workup', itemIds: [] },
  ],
  upodesh: [
    { id: 'g2', name: 'Cardiac diet & lifestyle', itemIds: [] },
  ],
}

/* ---- Print layout defaults ---------------------------------------------- */
/* Default page type is 'blank' — MediSuite doctors print on plain paper, so
   the letterhead must be printed too. 'pad' (pre-printed stationery, header
   space left empty) remains selectable in the layout wizard. */
export const DEFAULT_LAYOUT = {
  page: {
    type: 'blank', // 'blank' (print header/footer too) | 'pad' (pre-printed prescription pad)
    height: 11.3,
    width: 8,
    marginLeft: 0.7,
    marginRight: 0.2,
    headerHeight: 2.45,
    footerHeight: 1.2,
  },
  header: {
    columns: 2,
    widths: [50, 50],
  },
  patient: {
    rows: [
      {
        id: 'r1',
        fields: [
          { key: 'pid', label: 'ID', width: 20 },
          { key: 'name', label: 'Name', width: 35 },
          { key: 'age', label: 'Age', width: 12 },
          { key: 'gender', label: 'Gender', width: 15 },
          { key: 'date', label: 'Date', width: 18 },
        ],
      },
      {
        id: 'r2',
        fields: [
          { key: 'phone', label: 'Phone', width: 50 },
          { key: 'department', label: 'Department', width: 50 },
        ],
      },
    ],
  },
  body: {
    leftWidth: 2.6, // inches; right takes the rest
    leftTopMargin: 0,
    rightTopMargin: 0,
    separator: false,
    bottomLine: false,
  },
  footer: {
    columns: 3,
    widths: [40, 20, 40],
  },
}

export const DEFAULT_VISIBILITY = {
  headerFooter: true, // blank-page printing → the letterhead is part of the sheet
  patient: false, // plain Name/Age/Date row; the boxed grid is opt-in
  sections: Object.fromEntries(ALL_SECTIONS.map((s) => [s.key, true])),
}

/* ---- Bengali dosage → dispensing numbers -------------------------------- */
/* The pharmacy module thinks in qty/days; the pad thinks in ১+০+১ and
   '১ মাস'. These translate one into the other so a pad prescription lands
   in the pharmacy queue as a fillable line, not free text. 'চলবে'
   (continue) has no end date — treat it as a 30-day supply per issue. */
export const DURATION_DAYS = {
  '৩ দিন': 3, '৭ দিন': 7, '১০ দিন': 10, '১৫ দিন': 15,
  '১ মাস': 30, '২ মাস': 60, '৩ মাস': 90, '৬ মাস': 180, 'চলবে': 30,
}

export const dosesPerDay = (dose) => {
  const en = String(dose || '')
    .replace(/[০-৯]/g, (d) => '০১২৩৪৫৬৭৮৯'.indexOf(d))
  return en
    .split('+')
    .map((part) => {
      const [a, b] = part.split('/')
      const n = parseFloat(a)
      if (!n) return 0
      return b ? n / parseFloat(b) : n
    })
    .reduce((sum, n) => sum + n, 0)
}

/* ---- Helpers ------------------------------------------------------------ */
const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
export const toBn = (n) => String(n).replace(/[0-9]/g, (d) => BN_DIGITS[+d])

export const padId = (prefix = 'x') =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const medPrefix = (form) => {
  const f = String(form || '').toLowerCase()
  if (f.startsWith('cap')) return 'CAP.'
  if (f.startsWith('syr')) return 'SYP.'
  if (f.startsWith('inj')) return 'INJ.'
  if (f.startsWith('ins')) return 'INS.'
  if (f.startsWith('drop')) return 'DROP'
  return 'TAB.'
}

export const todayStr = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}
