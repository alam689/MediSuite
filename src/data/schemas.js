/* =====================================================================
   Module schemas — the interactive contract for every AITMS module.
   Each schema drives: the data table (columns), the create/edit form
   (fields), the seed records, live-computed KPIs, and row actions that
   mutate records. Content derives from the product overview (docx).
   ===================================================================== */
import {
  Users,
  Stethoscope,
  Video,
  CalendarClock,
  FileText,
  Pill,
  FlaskConical,
  Store,
  Wallet,
  Activity,
  Sparkles,
  BarChart3,
  ShieldCheck,
  BedDouble,
  ClipboardPlus,
  Network,
  Ambulance,
  Route,
} from 'lucide-react'

const accents = {
  blue: { light: '#3f8fd1', dark: '#67b0e6' },
  teal: { light: '#4f9d9a', dark: '#6fc3bf' },
  violet: { light: '#8a6fd0', dark: '#a58ee0' },
  amber: { light: '#cf8a3c', dark: '#e6ab5f' },
  green: { light: '#6aa36a', dark: '#8cc28c' },
  rose: { light: '#d1738f', dark: '#e693ac' },
  indigo: { light: '#6b7cce', dark: '#8a99e6' },
  mint: { light: '#3fae8e', dark: '#62cba9' },
  orange: { light: '#c9743f', dark: '#e0945f' },
  sky: { light: '#5ba3c2', dark: '#7fc1dc' },
  plum: { light: '#b574c2', dark: '#cd93d9' },
  gold: { light: '#c28f3f', dark: '#dbab62' },
}

/* small helpers for KPI compute */
const count = (rows, pred) => rows.filter(pred).length
const byStatus = (rows, ...s) => count(rows, (r) => s.includes(r.status))

/* The dispensaries and labs on the platform. A pharmacist or lab tech signs
   in scoped to one of these, exactly as a hospital admin signs in scoped to
   a facility, so the names have to be a shared constant rather than free
   text typed twice. */
export const PHARMACIES = [
  'Metro General Pharmacy',
  'HeartCare Dispensary',
  'City Care Pharmacy',
]

export const LABS = [
  'Metro Diagnostics Lab',
  'HeartCare Pathology',
  'Respira Diagnostics',
]

/* Ambulance operators. Some are hospitals running their own vehicles, some
   are independent services enlisting on the platform — both sign in to the
   same portal, scoped to their own fleet. */
export const AMBULANCE_OPERATORS = [
  'City Emergency Service',
  'Metro General Hospital',
  'HeartCare Diagnostic',
  'Respira Clinic',
]

export const AMBULANCE_TYPES = [
  'ICU',
  'Basic life support',
  'NICU (newborn)',
  'Freezer',
  'Patient transport',
]

/* A vehicle is only offered to patients when the operator has it on duty
   *and* it is roadworthy. Off duty and Maintenance are different answers to
   "why can't I have it" and are kept apart deliberately. */
export const AMBULANCE_STATUSES = ['Available', 'On another trip', 'Off duty', 'Maintenance']

/* Critical-care units. "Life support" is the phrase families use; the
   clinical label is mechanical ventilation, so carry both. */
export const CARE_UNITS = [
  'ICU',
  'CCU (cardiac)',
  'HDU (high dependency)',
  'NICU (newborn)',
  'PICU (paediatric)',
  'Ventilator / life support',
  'Isolation',
]

/* Free beds are always derived, never stored. A stored "available" column
   drifts out of sync with total/occupied the first time anyone edits one of
   them, and a wrong bed count here is not a cosmetic bug. */
export const freeBeds = (r) =>
  Math.max(0, Number(r?.total || 0) - Number(r?.occupied || 0))

const sumFree = (rows, pred) =>
  rows.filter(pred).reduce((n, r) => n + freeBeds(r), 0)

const mins = (n) => Date.now() - n * 60000

/* Calendar dates in the seed are relative to whenever the demo is opened.

   Hard-coded dates rot: written in July, every "upcoming" view is empty by
   August and a pending appointment reads as one nobody answered. The whole
   scheduling half of the app then looks broken when it is working exactly as
   designed. Negative is the past, positive the future.

   Local-zone arithmetic, not `toISOString().slice(0,10)` — converting to UTC
   first hands anyone east of UTC yesterday's date, and the rest of the app
   reads these strings as local days (see patient/helpers.js prettyDate).
   Defined here rather than imported because helpers.js imports this file. */
const day = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 10)
}

/* Tiny inline SVG data URLs so seeded photos/documents are viewable without a backend. */
const svg = (markup) =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup)

const seedPhoto = (initials, bg = '#2f6f6a') =>
  svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${bg}"/><circle cx="60" cy="47" r="23" fill="#eaf6f4"/><rect x="26" y="80" width="68" height="44" rx="22" fill="#eaf6f4"/><text x="60" y="112" fill="${bg}" font-family="Arial" font-size="13" font-weight="700" text-anchor="middle">${initials}</text></svg>`
  )

const seedDoc = (title, lines = []) => {
  const body = lines
    .map((l, i) => `<text x="26" y="${130 + i * 30}" fill="#27322f" font-family="Arial" font-size="15">${l}</text>`)
    .join('')
  return svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="620"><rect width="480" height="620" fill="#ffffff"/><rect width="480" height="74" fill="#2f6f6a"/><text x="26" y="46" fill="#ffffff" font-family="Arial" font-size="21" font-weight="700">${title}</text>${body}</svg>`
  )
}

export const schemas = [
  /* ------------------------------------------------------------ Patients */
  {
    key: 'patients',
    label: 'Patients',
    icon: Users,
    accent: accents.blue,
    tagline: 'Patient Management',
    desc: 'Registration, profiles, medical & family history, allergies and consent.',
    entity: 'Patient',
    idPrefix: 'PT',
    hasDocuments: true,
    statusTones: {
      Active: 'green',
      'Consent pending': 'amber',
      Chronic: 'violet',
      Inactive: 'rose',
    },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'name', label: 'Name', type: 'strong' },
      { key: 'age', label: 'Age' },
      { key: 'gender', label: 'Gender' },
      { key: 'department', label: 'Department', filter: true },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'name', label: 'Full name', type: 'text', required: true, full: true },
      { key: 'age', label: 'Age', type: 'number', required: true },
      { key: 'gender', label: 'Gender', type: 'select', options: ['Female', 'Male', 'Other'] },
      { key: 'department', label: 'Department', type: 'select', options: ['General Med', 'Cardiology', 'Endocrinology', 'Pulmonology', 'Neurology', 'Dermatology'] },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'insurance', label: 'Insurer', type: 'text' },
      { key: 'communication', label: 'Communication needs', type: 'select', options: ['Standard', 'Non-speaking (mute)', 'Deaf', 'Deaf-mute', 'Hard of hearing'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Consent pending', 'Chronic', 'Inactive'] },
      { key: 'allergies', label: 'Known allergies', type: 'textarea', full: true },
    ],
    /* Patient history — repeatable child records. */
    subforms: [
      {
        key: 'conditions',
        label: 'Medical History',
        singular: 'condition',
        fields: [
          { key: 'condition', label: 'Condition' },
          { key: 'since', label: 'Since', placeholder: 'Year', width: 90 },
          { key: 'status', label: 'Status', placeholder: 'Active / Resolved', width: 150 },
        ],
      },
      {
        key: 'visits',
        label: 'Visit History',
        singular: 'visit',
        fields: [
          { key: 'date', label: 'Date', type: 'date', width: 150 },
          { key: 'doctor', label: 'Doctor' },
          { key: 'reason', label: 'Reason' },
          { key: 'outcome', label: 'Outcome' },
        ],
      },
      {
        key: 'medications',
        label: 'Medications',
        singular: 'medication',
        fields: [
          { key: 'name', label: 'Medication' },
          { key: 'dosage', label: 'Dosage', width: 130 },
          { key: 'since', label: 'Since', placeholder: 'Year', width: 90 },
        ],
      },
    ],
    defaults: { status: 'Consent pending', gender: 'Female', department: 'General Med', communication: 'Standard', conditions: [], visits: [], medications: [], documents: [] },
    kpis: [
      { label: 'Total Patients', tone: 'blue', compute: (r) => r.length.toLocaleString() },
      { label: 'Active', tone: 'green', compute: (r) => byStatus(r, 'Active').toLocaleString() },
      { label: 'Chronic Care', tone: 'violet', compute: (r) => byStatus(r, 'Chronic').toLocaleString() },
      { label: 'Consent Pending', tone: 'amber', compute: (r) => byStatus(r, 'Consent pending').toLocaleString() },
    ],
    actions: [
      { key: 'verify', label: 'Verify', tone: 'green', when: (r) => r.status === 'Consent pending', patch: () => ({ status: 'Active' }), toast: 'Patient consent verified' },
    ],
    seed: [
      {
        resourceId: 'PT-90421', name: 'Anika Rahman', age: 34, gender: 'Female', department: 'Cardiology',
        phone: '+880 171 000021', insurance: 'Aetna', status: 'Active', allergies: 'None recorded',
        conditions: [
          { condition: 'Hypertension', since: '2021', status: 'Active' },
          { condition: 'Iron-deficiency anaemia', since: '2024', status: 'Active' },
        ],
        visits: [
          { date: day(-7), doctor: 'Dr. Malik', reason: 'Chest tightness', outcome: 'Started beta-blocker' },
          { date: day(-58), doctor: 'Dr. Malik', reason: 'Routine review', outcome: 'Stable' },
        ],
        medications: [
          { name: 'Bisoprolol', dosage: '5mg OD', since: '2026' },
          { name: 'Ferrous sulfate', dosage: '200mg BD', since: '2024' },
        ],
        documents: [
          { id: 'DOC-PT90421-1', name: 'CBC_Report.svg', kind: 'image', type: 'Image', size: 1400, uploadedAt: 1749650000000, dataUrl: seedDoc('Lab Report — CBC', ['Patient: Anika Rahman', 'Haemoglobin: 9.1 g/dL (low)', 'WBC: 7.2 ×10⁹/L', 'Platelets: 240 ×10⁹/L', 'Date: 2026-06-10']) },
          { id: 'DOC-PT90421-2', name: 'ECG_Strip.svg', kind: 'image', type: 'Image', size: 1300, uploadedAt: 1748900000000, dataUrl: seedDoc('ECG Report', ['Rhythm: Sinus', 'Rate: 78 bpm', 'No acute ST changes', 'Date: 2026-05-28']) },
        ],
      },
      { resourceId: 'PT-90418', name: 'James Okoro', age: 51, gender: 'Male', department: 'General Med', phone: '+234 802 445 118', insurance: 'BUPA', status: 'Consent pending', allergies: 'Penicillin',
        conditions: [{ condition: 'Type 2 Diabetes', since: '2019', status: 'Active' }],
        visits: [{ date: day(-21), doctor: 'Dr. Malik', reason: 'BP management', outcome: 'Adjusted meds' }],
        medications: [{ name: 'Metformin', dosage: '850mg BD', since: '2019' }],
        documents: [{ id: 'DOC-PT90418-1', name: 'HbA1c_Report.svg', kind: 'image', type: 'Image', size: 1200, uploadedAt: 1748000000000, dataUrl: seedDoc('Lab Report — HbA1c', ['Patient: James Okoro', 'HbA1c: 8.2% (elevated)', 'Date: 2026-05-18']) }],
      },
      { resourceId: 'PT-90415', name: 'Meera Iyer', age: 29, gender: 'Female', department: 'Endocrinology', phone: '+91 98200 41551', insurance: 'Star Health', status: 'Chronic', allergies: 'Sulfa drugs',
        conditions: [{ condition: 'Hypothyroidism', since: '2022', status: 'Active' }], visits: [], medications: [{ name: 'Levothyroxine', dosage: '75mcg OD', since: '2022' }], documents: [] },
      { resourceId: 'PT-90410', name: 'David Chen', age: 63, gender: 'Male', department: 'Pulmonology', phone: '+65 8120 4410', insurance: 'Prudential', status: 'Chronic', allergies: 'None recorded',
        conditions: [{ condition: 'COPD', since: '2018', status: 'Active' }], visits: [], medications: [], documents: [] },
      { resourceId: 'PT-90388', name: 'Fatima Al-Sayed', age: 45, gender: 'Female', department: 'Neurology', phone: '+971 50 883 8891', insurance: 'Daman', status: 'Active', allergies: 'Latex', communication: 'Deaf', conditions: [], visits: [], medications: [], documents: [] },
      { resourceId: 'PT-90372', name: 'Robert Miller', age: 58, gender: 'Male', department: 'Cardiology', phone: '+1 415 220 9910', insurance: 'Kaiser', status: 'Consent pending', allergies: 'Aspirin', communication: 'Hard of hearing', conditions: [], visits: [], medications: [], documents: [] },
      { resourceId: 'PT-90355', name: 'Grace Wanjiru', age: 37, gender: 'Female', department: 'Dermatology', phone: '+254 722 118 900', insurance: 'Jubilee', status: 'Active', allergies: 'None recorded', communication: 'Non-speaking (mute)', conditions: [], visits: [], medications: [], documents: [] },
    ],
  },

  /* ------------------------------------------------------------- Doctors */
  {
    key: 'doctors',
    label: 'Doctors',
    icon: Stethoscope,
    accent: accents.teal,
    tagline: 'Doctor Management',
    desc: 'Registration, license verification, schedules, and performance dashboards.',
    entity: 'Doctor',
    idPrefix: 'DR',
    hasDocuments: true,
    statusTones: { Available: 'green', 'On call': 'blue', 'In review': 'amber', 'On leave': 'rose' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'name', label: 'Name', type: 'avatarName', imageKey: 'photo' },
      { key: 'specialization', label: 'Specialization', filter: true },
      { key: 'fee', label: 'Fee' },
      { key: 'rating', label: 'Rating' },
      { key: 'careerStart', label: 'Since', render: (r) => (r.careerStart ? String(r.careerStart).slice(0, 4) : '—') },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'photo', label: 'Photo', type: 'image', full: true },
      { key: 'name', label: 'Full name', type: 'text', required: true, full: true },
      { key: 'specialization', label: 'Specialization', type: 'select', options: ['Cardiology', 'Radiology', 'Dermatology', 'Neurology', 'Endocrinology', 'Pulmonology', 'General Med'] },
      { key: 'license', label: 'License no.', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'fee', label: 'Consultation fee', type: 'text' },
      { key: 'rating', label: 'Rating', type: 'number' },
      { key: 'careerStart', label: 'Career started', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['Available', 'On call', 'In review', 'On leave'] },
      { key: 'education', label: 'Educational background', type: 'textarea', full: true },
    ],
    /* Repeatable child collections (one-to-many, embedded on the doctor record). */
    subforms: [
      {
        key: 'degrees',
        label: 'Degrees',
        singular: 'degree',
        fields: [
          { key: 'degree', label: 'Degree', placeholder: 'e.g. MBBS, FCPS' },
          { key: 'institution', label: 'Institution' },
          { key: 'year', label: 'Year', type: 'number', width: 90 },
        ],
      },
      {
        key: 'awards',
        label: 'Awards & Recognition',
        singular: 'award',
        fields: [
          { key: 'title', label: 'Award' },
          { key: 'org', label: 'Awarded by' },
          { key: 'year', label: 'Year', type: 'number', width: 90 },
        ],
      },
      {
        key: 'chambers',
        label: 'Chambers & Timing',
        singular: 'chamber',
        fields: [
          { key: 'name', label: 'Chamber / Hospital' },
          { key: 'address', label: 'Address' },
          { key: 'days', label: 'Days', placeholder: 'Sun–Thu' },
          { key: 'from', label: 'From', placeholder: '5:00 PM', width: 110 },
          { key: 'to', label: 'To', placeholder: '9:00 PM', width: 110 },
        ],
      },
    ],
    defaults: { status: 'In review', specialization: 'General Med', rating: 4.5, fee: '$60', photo: '', degrees: [], awards: [], chambers: [], documents: [] },
    kpis: [
      { label: 'Active Doctors', tone: 'teal', compute: (r) => byStatus(r, 'Available', 'On call').toLocaleString() },
      { label: 'On Call', tone: 'green', compute: (r) => byStatus(r, 'On call').toLocaleString() },
      { label: 'In Review', tone: 'amber', compute: (r) => byStatus(r, 'In review').toLocaleString() },
      { label: 'Avg. Rating', tone: 'violet', compute: (r) => (r.reduce((a, x) => a + Number(x.rating || 0), 0) / (r.length || 1)).toFixed(1) },
    ],
    actions: [
      { key: 'approve', label: 'Verify', tone: 'green', when: (r) => r.status === 'In review', patch: () => ({ status: 'Available' }), toast: 'License verified — doctor activated' },
    ],
    seed: [
      {
        resourceId: 'DR-2041', name: 'Dr. Sara Malik', specialization: 'Cardiology', license: 'MDC-88213',
        photo: seedPhoto('SM'),
        email: 'sara.malik@metrogeneral.health', phone: '+880 171 552 0041', fee: '$120', rating: 4.9,
        careerStart: '2008-07-01', status: 'Available',
        education: 'Interventional cardiologist with 16+ years in tertiary cardiac care; fellowship-trained in coronary intervention.',
        documents: [
          { id: 'DOC-DR2041-1', name: 'Medical_License.svg', kind: 'image', type: 'Image', size: 1200, uploadedAt: 1749800000000, dataUrl: seedDoc('Medical License', ['Name: Dr. Sara Malik', 'Council: BMDC', 'Reg. No: MDC-88213', 'Valid till: 2027']) },
          { id: 'DOC-DR2041-2', name: 'FCPS_Certificate.svg', kind: 'image', type: 'Image', size: 1100, uploadedAt: 1749000000000, dataUrl: seedDoc('FCPS Certificate', ['Fellowship in Cardiology', 'Awarded by BCPS', 'Year: 2011']) },
        ],
        degrees: [
          { degree: 'MBBS', institution: 'Dhaka Medical College', year: 2005 },
          { degree: 'FCPS (Cardiology)', institution: 'BCPS', year: 2011 },
          { degree: 'Fellowship, Interventional Cardiology', institution: 'NUHS Singapore', year: 2014 },
        ],
        awards: [
          { title: 'Best Cardiologist Award', org: 'National Heart Foundation', year: 2019 },
          { title: 'Research Excellence', org: 'SAARC Cardiac Society', year: 2021 },
        ],
        chambers: [
          { name: 'Metro General Hospital', address: 'Gulshan, Dhaka', days: 'Sun–Thu', from: '5:00 PM', to: '9:00 PM' },
          { name: 'HeartCare Diagnostic', address: 'Banani, Dhaka', days: 'Fri', from: '10:00 AM', to: '1:00 PM' },
        ],
      },
      {
        resourceId: 'DR-2039', name: 'Dr. Tunde Bello', specialization: 'Radiology', license: 'MDC-77120',
        email: 'tunde.bello@metrogeneral.health', phone: '+234 802 445 7120', fee: '$95', rating: 4.7,
        careerStart: '2012-02-15', status: 'In review',
        education: 'Diagnostic radiologist focused on cross-sectional imaging and AI-assisted reporting.',
        degrees: [
          { degree: 'MBBS', institution: 'University of Lagos', year: 2009 },
          { degree: 'FMCR (Radiology)', institution: 'National Postgraduate Medical College', year: 2015 },
        ],
        awards: [{ title: 'Young Radiologist of the Year', org: 'AORNA', year: 2018 }],
        chambers: [{ name: 'Metro Imaging Center', address: 'Ikeja, Lagos', days: 'Mon–Sat', from: '9:00 AM', to: '4:00 PM' }],
      },
      {
        resourceId: 'DR-2036', name: 'Dr. Lin Wei', specialization: 'Dermatology', license: 'MDC-66540',
        email: 'lin.wei@metrogeneral.health', phone: '+65 8120 6540', fee: '$80', rating: 4.8,
        careerStart: '2015-09-01', status: 'On call',
        education: 'Clinical & cosmetic dermatologist; special interest in teledermatology.',
        degrees: [{ degree: 'MBBS', institution: 'NUS Singapore', year: 2012 }, { degree: 'MRCP (Dermatology)', institution: 'Royal College of Physicians', year: 2017 }],
        awards: [],
        chambers: [{ name: 'SkinHealth Clinic', address: 'Orchard, Singapore', days: 'Tue–Sat', from: '11:00 AM', to: '6:00 PM' }],
      },
      {
        resourceId: 'DR-2030', name: 'Dr. Omar Farah', specialization: 'Neurology', license: 'MDC-55901',
        email: 'omar.farah@metrogeneral.health', phone: '+971 50 883 5901', fee: '$140', rating: 4.6,
        careerStart: '2006-01-10', status: 'On leave',
        education: 'Consultant neurologist; stroke and epilepsy specialist.',
        degrees: [{ degree: 'MBBS', institution: 'UAE University', year: 2003 }, { degree: 'MD (Neurology)', institution: 'Cairo University', year: 2009 }],
        awards: [{ title: 'Stroke Care Innovation', org: 'MENA Neuro Society', year: 2020 }],
        chambers: [{ name: 'NeuroCare Center', address: 'Deira, Dubai', days: 'Sun–Wed', from: '4:00 PM', to: '8:00 PM' }],
      },
      {
        resourceId: 'DR-2028', name: 'Dr. Priya Nair', specialization: 'Endocrinology', license: 'MDC-44120',
        email: 'priya.nair@metrogeneral.health', phone: '+91 98200 44120', fee: '$110', rating: 4.9,
        careerStart: '2010-06-20', status: 'Available',
        education: 'Endocrinologist specializing in diabetes and thyroid disorders.',
        degrees: [{ degree: 'MBBS', institution: 'AIIMS Delhi', year: 2007 }, { degree: 'DM (Endocrinology)', institution: 'PGIMER Chandigarh', year: 2013 }],
        awards: [{ title: 'Diabetes Care Excellence', org: 'ISE', year: 2022 }],
        chambers: [
          { name: 'Metro General Hospital', address: 'Gulshan, Dhaka', days: 'Mon–Wed', from: '6:00 PM', to: '9:00 PM' },
          { name: 'Endo & Diabetes Clinic', address: 'Dhanmondi, Dhaka', days: 'Sat', from: '9:00 AM', to: '2:00 PM' },
        ],
      },
      {
        resourceId: 'DR-2021', name: 'Dr. Marco Rossi', specialization: 'Pulmonology', license: 'MDC-33087',
        email: 'marco.rossi@metrogeneral.health', phone: '+39 06 3308 7', fee: '$100', rating: 4.5,
        careerStart: '2013-11-05', status: 'On call',
        education: 'Pulmonologist with focus on COPD and sleep medicine.',
        degrees: [{ degree: 'MD', institution: 'Sapienza University of Rome', year: 2010 }],
        awards: [],
        chambers: [{ name: 'Respira Clinic', address: 'Rome, Italy', days: 'Mon–Fri', from: '3:00 PM', to: '7:00 PM' }],
      },
    ],
  },

  /* -------------------------------------------------------- Telemedicine */
  {
    key: 'telemedicine',
    label: 'Telemedicine',
    icon: Video,
    accent: accents.violet,
    tagline: 'Telemedicine Module',
    desc: 'HD video, audio, chat, secure messaging, waiting room and virtual queue.',
    entity: 'Consultation',
    idPrefix: 'CS',
    hasConsole: true,
    hasAccessible: true,
    statusTones: { Live: 'violet', Waiting: 'amber', Queued: 'blue', Ended: 'rose', Completed: 'green' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'patient', label: 'Patient', type: 'strong' },
      { key: 'doctor', label: 'Doctor' },
      { key: 'mode', label: 'Mode', filter: true },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'patient', label: 'Patient', type: 'text', required: true },
      { key: 'doctor', label: 'Doctor', type: 'text', required: true },
      { key: 'mode', label: 'Mode', type: 'select', options: ['Video', 'Audio', 'Chat'] },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'time', label: 'Time', type: 'text' },
      { key: 'reason', label: 'Reason', type: 'text', full: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Queued', 'Waiting', 'Live', 'Ended', 'Completed'] },
    ],
    defaults: { status: 'Queued', mode: 'Video' },
    kpis: [
      { label: 'Live Now', tone: 'violet', compute: (r) => byStatus(r, 'Live').toString() },
      { label: 'In Waiting Room', tone: 'amber', compute: (r) => byStatus(r, 'Waiting').toString() },
      { label: 'Queued', tone: 'blue', compute: (r) => byStatus(r, 'Queued').toString() },
      { label: 'Completed', tone: 'green', compute: (r) => byStatus(r, 'Completed').toString() },
    ],
    actions: [
      { key: 'admit', label: 'Admit', tone: 'violet', when: (r) => r.status === 'Waiting' || r.status === 'Queued', patch: () => ({ status: 'Live' }), toast: 'Consultation started' },
      { key: 'end', label: 'End', tone: 'rose', when: (r) => r.status === 'Live', patch: () => ({ status: 'Ended' }), toast: 'Consultation ended' },
      { key: 'resume', label: 'Resume', tone: 'violet', when: (r) => r.status === 'Ended', patch: () => ({ status: 'Live', resumeRequested: false }), toast: 'Consultation resumed' },
      { key: 'complete', label: 'Complete', tone: 'green', when: (r) => r.status === 'Ended', patch: () => ({ status: 'Completed', resumeRequested: false }), toast: 'Consultation completed' },
    ],
    seed: [
      { resourceId: 'CS-7781', patient: 'Anika Rahman', doctor: 'Dr. Malik', mode: 'Video', date: day(0), time: '09:30', reason: 'Chest pain review', status: 'Live' },
      { resourceId: 'CS-7780', patient: 'David Chen', doctor: 'Dr. Rossi', mode: 'Audio', date: day(0), time: '10:00', reason: 'Follow-up', status: 'Waiting' },
      { resourceId: 'CS-7778', patient: 'Meera Iyer', doctor: 'Dr. Nair', mode: 'Video', date: day(0), time: '10:30', reason: 'Thyroid results', status: 'Queued' },
      { resourceId: 'CS-7775', patient: 'Fatima Al-Sayed', doctor: 'Dr. Bello', mode: 'Chat', date: day(0), time: '11:15', reason: 'Triage', status: 'Waiting' },
      { resourceId: 'CS-7770', patient: 'James Okoro', doctor: 'Dr. Malik', mode: 'Video', date: day(-21), time: '11:00', reason: 'BP management', status: 'Completed' },
      { resourceId: 'CS-7766', patient: 'Grace Wanjiru', doctor: 'Dr. Lin Wei', mode: 'Video', date: day(2), time: '14:30', reason: 'Skin rash', status: 'Queued' },
    ],
  },

  /* -------------------------------------------------------- Appointments */
  {
    key: 'appointments',
    label: 'Appointments',
    icon: CalendarClock,
    accent: accents.amber,
    tagline: 'Appointment Management',
    desc: 'Online booking, smart scheduling, AI queue optimization and reminders.',
    entity: 'Appointment',
    idPrefix: 'AP',
    hasBooking: true,
    statusTones: { Confirmed: 'green', Pending: 'amber', 'Checked-in': 'blue', Urgent: 'rose', Cancelled: 'rose' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'time', label: 'Time' },
      { key: 'patient', label: 'Patient', type: 'strong' },
      { key: 'doctor', label: 'Doctor', filter: true },
      { key: 'type', label: 'Type', filter: true },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'patient', label: 'Patient', type: 'text', required: true },
      { key: 'doctor', label: 'Doctor', type: 'select', options: ['Dr. Malik', 'Dr. Bello', 'Dr. Nair', 'Dr. Rossi', 'Dr. Lin Wei'], required: true },
      { key: 'hospital', label: 'Hospital / chamber', type: 'text', full: true },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'time', label: 'Time', type: 'text', required: true },
      { key: 'type', label: 'Type', type: 'select', options: ['Video', 'In-person', 'Emergency'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Confirmed', 'Checked-in', 'Urgent', 'Cancelled'] },
    ],
    defaults: { status: 'Pending', type: 'Video', time: '09:00' },
    kpis: [
      { label: 'Booked', tone: 'amber', compute: (r) => r.length.toString() },
      { label: 'Confirmed', tone: 'green', compute: (r) => byStatus(r, 'Confirmed', 'Checked-in').toString() },
      { label: 'Pending', tone: 'blue', compute: (r) => byStatus(r, 'Pending').toString() },
      { label: 'Urgent', tone: 'rose', compute: (r) => byStatus(r, 'Urgent').toString() },
    ],
    actions: [
      { key: 'confirm', label: 'Confirm', tone: 'green', when: (r) => r.status === 'Pending', patch: () => ({ status: 'Confirmed' }), toast: 'Appointment confirmed & reminder sent' },
      { key: 'cancel', label: 'Cancel', tone: 'rose', when: (r) => r.status !== 'Cancelled', patch: () => ({ status: 'Cancelled' }), toast: 'Appointment cancelled' },
    ],
    seed: [
      { resourceId: 'AP-5521', time: '09:30', patient: 'Anika Rahman', doctor: 'Dr. Malik', hospital: 'Metro General Hospital', date: day(0), type: 'Video', status: 'Confirmed' },
      { resourceId: 'AP-5522', time: '10:00', patient: 'David Chen', doctor: 'Dr. Rossi', hospital: 'Respira Clinic', date: day(0), type: 'In-person', status: 'Checked-in' },
      { resourceId: 'AP-5525', time: '10:30', patient: 'Meera Iyer', doctor: 'Dr. Nair', hospital: 'Endo & Diabetes Clinic', date: day(0), type: 'Video', status: 'Pending' },
      { resourceId: 'AP-5529', time: '11:15', patient: 'Fatima Al-Sayed', doctor: 'Dr. Bello', hospital: 'Metro Imaging Center', date: day(0), type: 'Emergency', status: 'Urgent' },
      { resourceId: 'AP-5533', time: '13:00', patient: 'James Okoro', doctor: 'Dr. Malik', hospital: 'Metro General Hospital', date: day(1), type: 'Video', status: 'Pending' },
      { resourceId: 'AP-5540', time: '14:30', patient: 'Grace Wanjiru', doctor: 'Dr. Lin Wei', hospital: 'SkinHealth Clinic', date: day(2), type: 'Video', status: 'Confirmed' },
      { resourceId: 'AP-5544', time: '16:00', patient: 'Anika Rahman', doctor: 'Dr. Malik', hospital: 'HeartCare Diagnostic', date: day(5), type: 'In-person', status: 'Confirmed' },
      /* Past bookings, so the "Past" tab and visit history are not empty. */
      { resourceId: 'AP-5510', time: '09:00', patient: 'Anika Rahman', doctor: 'Dr. Malik', hospital: 'Metro General Hospital', date: day(-7), type: 'Video', status: 'Confirmed' },
      { resourceId: 'AP-5502', time: '11:00', patient: 'James Okoro', doctor: 'Dr. Malik', hospital: 'Metro General Hospital', date: day(-21), type: 'In-person', status: 'Confirmed' },
      { resourceId: 'AP-5498', time: '15:30', patient: 'David Chen', doctor: 'Dr. Rossi', hospital: 'Respira Clinic', date: day(-30), type: 'Video', status: 'Cancelled' },
    ],
  },

  /* ---------------------------------------------------------------- EMR */
  {
    key: 'emr',
    label: 'EMR / EHR',
    icon: FileText,
    accent: accents.green,
    tagline: 'Electronic Medical Records',
    desc: 'Diagnoses, medications, vitals, clinical notes, lab and radiology reports.',
    entity: 'Record',
    idPrefix: 'EMR',
    statusTones: { 'AI draft': 'violet', Editing: 'amber', 'Ready for sign-off': 'blue', Signed: 'green' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'type', label: 'Note type', filter: true },
      { key: 'patient', label: 'Patient', type: 'strong' },
      { key: 'doctor', label: 'Doctor' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'patient', label: 'Patient', type: 'text', required: true },
      { key: 'doctor', label: 'Doctor', type: 'text', required: true },
      { key: 'type', label: 'Note type', type: 'select', options: ['Consult note', 'SOAP note', 'Progress note', 'Discharge summary', 'Procedure note'] },
      { key: 'diagnosis', label: 'Diagnosis', type: 'text', full: true },
      { key: 'notes', label: 'Clinical notes', type: 'textarea', full: true },
      { key: 'status', label: 'Status', type: 'select', options: ['AI draft', 'Editing', 'Ready for sign-off', 'Signed'] },
    ],
    defaults: { status: 'AI draft', type: 'Consult note' },
    kpis: [
      { label: 'Active Records', tone: 'green', compute: (r) => r.length.toString() },
      { label: 'AI Drafts', tone: 'violet', compute: (r) => byStatus(r, 'AI draft').toString() },
      { label: 'Awaiting Sign-off', tone: 'amber', compute: (r) => byStatus(r, 'Ready for sign-off', 'Editing').toString() },
      { label: 'Signed', tone: 'blue', compute: (r) => byStatus(r, 'Signed').toString() },
    ],
    actions: [
      { key: 'sign', label: 'Sign off', tone: 'green', when: (r) => r.status !== 'Signed', patch: () => ({ status: 'Signed' }), toast: 'Record signed off' },
    ],
    seed: [
      { resourceId: 'EMR-3391', type: 'Consult note', patient: 'Anika Rahman', doctor: 'Dr. Malik', diagnosis: 'Stable angina', notes: 'Patient reports exertional chest tightness. Continue beta-blocker.', status: 'AI draft' },
      { resourceId: 'EMR-3388', type: 'Discharge summary', patient: 'David Chen', doctor: 'Dr. Rossi', diagnosis: 'COPD exacerbation', notes: 'Improved on nebulisers. Discharge with inhaler plan.', status: 'Ready for sign-off' },
      { resourceId: 'EMR-3385', type: 'Progress note', patient: 'Meera Iyer', doctor: 'Dr. Nair', diagnosis: 'Hypothyroidism', notes: 'TSH improving on levothyroxine 75mcg.', status: 'Editing' },
      { resourceId: 'EMR-3380', type: 'Procedure note', patient: 'Fatima Al-Sayed', doctor: 'Dr. Bello', diagnosis: 'Migraine', notes: 'Occipital nerve block performed, tolerated well.', status: 'Signed' },
      { resourceId: 'EMR-3376', type: 'SOAP note', patient: 'James Okoro', doctor: 'Dr. Malik', diagnosis: 'Hypertension', notes: 'BP 148/92. Increase amlodipine to 10mg.', status: 'AI draft' },
    ],
  },

  /* ------------------------------------------------------- Prescriptions */
  {
    key: 'prescriptions',
    label: 'Prescriptions',
    icon: Pill,
    accent: accents.rose,
    tagline: 'Electronic Prescription',
    desc: 'Digital signature, drug database, interaction alerts and refill management.',
    entity: 'Prescription',
    idPrefix: 'RX',
    /* The fulfilment half of this lifecycle belongs to the pharmacy, not the
       prescriber: Issued → Verified → (Partially) Dispensed → Out for
       delivery → Delivered, with Rejected as the pharmacist's stop. The
       clinical holds (Interaction, Allergy, Refill) stay with the doctor. */
    statusTones: {
      Interaction: 'rose',
      Allergy: 'amber',
      Refill: 'violet',
      Issued: 'green',
      Verified: 'teal',
      'Partially dispensed': 'amber',
      Dispensed: 'blue',
      'Out for delivery': 'violet',
      Delivered: 'green',
      Rejected: 'rose',
    },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'drug', label: 'Medication', type: 'strong' },
      { key: 'patient', label: 'Patient' },
      { key: 'doctor', label: 'Doctor', filter: true },
      { key: 'pharmacy', label: 'Pharmacy', filter: true },
      { key: 'flag', label: 'Flag', filter: true },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'drug', label: 'Medication', type: 'text', required: true, full: true },
      { key: 'patient', label: 'Patient', type: 'text', required: true },
      { key: 'doctor', label: 'Doctor', type: 'text', required: true },
      { key: 'dosage', label: 'Dosage', type: 'text' },
      { key: 'qty', label: 'Quantity', type: 'number' },
      { key: 'days', label: 'Duration (days)', type: 'number' },
      { key: 'refills', label: 'Refills allowed', type: 'number' },
      { key: 'pharmacy', label: 'Dispensing pharmacy', type: 'select', options: PHARMACIES },
      { key: 'fulfilment', label: 'Fulfilment', type: 'select', options: ['Collect in store', 'Home delivery'] },
      { key: 'flag', label: 'Flag', type: 'select', options: ['None', 'Interaction', 'Allergy', 'Generic offered'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Issued', 'Interaction', 'Allergy', 'Refill', 'Verified', 'Partially dispensed', 'Dispensed', 'Out for delivery', 'Delivered', 'Rejected'] },
      { key: 'instructions', label: 'Instructions to patient', type: 'textarea', full: true },
    ],
    defaults: { status: 'Issued', flag: 'None', qty: 30, days: 30, refills: 0, fulfilment: 'Collect in store', pharmacy: PHARMACIES[0], dispensedQty: 0 },
    kpis: [
      { label: 'Total', tone: 'rose', compute: (r) => r.length.toString() },
      { label: 'Interaction Alerts', tone: 'amber', compute: (r) => count(r, (x) => x.flag === 'Interaction').toString() },
      { label: 'Awaiting Pharmacy', tone: 'violet', compute: (r) => byStatus(r, 'Issued', 'Verified', 'Partially dispensed').toString() },
      { label: 'Dispensed', tone: 'blue', compute: (r) => byStatus(r, 'Dispensed', 'Out for delivery', 'Delivered').toString() },
    ],
    actions: [
      { key: 'override', label: 'Approve', tone: 'green', when: (r) => r.status === 'Interaction' || r.status === 'Refill', patch: () => ({ status: 'Issued', flag: 'None' }), toast: 'Prescription approved & logged' },
    ],
    /* `issuedAt` is not decoration: the pharmacy's authenticity check refuses
       to verify a script it cannot date, so a seed row without one is a
       prescription nobody can ever fill. RX-6590 is deliberately left old, so
       the expiry branch of that check has something real to catch. */
    seed: [
      { resourceId: 'RX-6612', drug: 'Warfarin 5mg', patient: 'Anika Rahman', doctor: 'Dr. Malik', dosage: 'OD', qty: 28, days: 28, refills: 0, flag: 'Interaction', status: 'Interaction', pharmacy: 'Metro General Pharmacy', fulfilment: 'Collect in store', issuedAt: mins(1200), instructions: 'Take at the same time each evening. Do not skip INR checks.' },
      { resourceId: 'RX-6609', drug: 'Amoxicillin 500mg', patient: 'James Okoro', doctor: 'Dr. Malik', dosage: 'TDS', qty: 21, days: 7, refills: 0, flag: 'Allergy', status: 'Allergy', pharmacy: 'Metro General Pharmacy', fulfilment: 'Collect in store', issuedAt: mins(2600) },
      { resourceId: 'RX-6605', drug: 'Metformin 850mg', patient: 'Meera Iyer', doctor: 'Dr. Nair', dosage: 'BD', qty: 60, days: 30, refills: 2, flag: 'None', status: 'Refill', pharmacy: 'City Care Pharmacy', fulfilment: 'Home delivery', issuedAt: mins(40000) },
      { resourceId: 'RX-6601', drug: 'Atorvastatin 20mg', patient: 'David Chen', doctor: 'Dr. Rossi', dosage: 'Nocte', qty: 30, days: 30, refills: 3, flag: 'Generic offered', status: 'Issued', pharmacy: 'Metro General Pharmacy', fulfilment: 'Collect in store', issuedAt: mins(300), instructions: 'One tablet at night.' },
      { resourceId: 'RX-6598', drug: 'Levothyroxine 75mcg', patient: 'Meera Iyer', doctor: 'Dr. Nair', dosage: 'OD', qty: 30, days: 30, refills: 5, flag: 'None', status: 'Dispensed', pharmacy: 'City Care Pharmacy', fulfilment: 'Collect in store', issuedAt: mins(6000), dispensedQty: 30, dispensedBy: 'City Care Pharmacy' },
      { resourceId: 'RX-6595', drug: 'Insulin Glargine 100U/mL', patient: 'James Okoro', doctor: 'Dr. Nair', dosage: '18U nocte', qty: 3, days: 30, refills: 2, flag: 'None', status: 'Issued', pharmacy: 'Metro General Pharmacy', fulfilment: 'Home delivery', issuedAt: mins(180), instructions: 'Keep refrigerated. Rotate injection sites.' },
      { resourceId: 'RX-6590', drug: 'Salbutamol inhaler', patient: 'David Chen', doctor: 'Dr. Rossi', dosage: 'PRN', qty: 2, days: 60, refills: 4, flag: 'None', status: 'Verified', pharmacy: 'HeartCare Dispensary', fulfilment: 'Collect in store', issuedAt: mins(160000) },
      { resourceId: 'RX-6586', drug: 'Bisoprolol 5mg', patient: 'Anika Rahman', doctor: 'Dr. Malik', dosage: 'OD', qty: 30, days: 30, refills: 5, flag: 'None', status: 'Out for delivery', pharmacy: 'Metro General Pharmacy', fulfilment: 'Home delivery', issuedAt: mins(2000), dispensedQty: 30, dispensedBy: 'Metro General Pharmacy' },
    ],
  },

  /* --------------------------------------------------------- Laboratory */
  {
    key: 'laboratory',
    label: 'Laboratory',
    icon: FlaskConical,
    accent: accents.indigo,
    tagline: 'Laboratory Information System',
    desc: 'Test orders, sample tracking, analyzer integration and AI interpretation.',
    entity: 'Lab order',
    idPrefix: 'LAB',
    hasImaging: true,
    hasDocuments: true,
    /* The order's real life: Ordered → Sample collected → In lab → Ready to
       approve → Approved (released to the patient). Abnormal is a result
       property that still needs approving, not a terminal state, and
       Rejected is the lab refusing a bad sample rather than a silent
       re-draw nobody is told about. */
    statusTones: {
      Ordered: 'violet',
      'Sample collected': 'teal',
      'In lab': 'blue',
      'Ready to approve': 'amber',
      Abnormal: 'rose',
      Approved: 'green',
      Rejected: 'rose',
    },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'test', label: 'Test', type: 'strong' },
      { key: 'patient', label: 'Patient' },
      { key: 'lab', label: 'Lab', filter: true },
      { key: 'priority', label: 'Priority', filter: true },
      { key: 'result', label: 'Result' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'test', label: 'Test', type: 'select', options: ['CBC', 'Lipid Profile', 'HbA1c', 'Thyroid Panel', 'Liver Function', 'Kidney Function', 'Urinalysis', 'Chest X-ray', 'CT Head', 'ECG'], required: true },
      { key: 'patient', label: 'Patient', type: 'text', required: true },
      { key: 'doctor', label: 'Ordered by', type: 'text' },
      { key: 'lab', label: 'Laboratory', type: 'select', options: LABS },
      { key: 'priority', label: 'Priority', type: 'select', options: ['Routine', 'Urgent', 'STAT'] },
      { key: 'sample', label: 'Sample type', type: 'select', options: ['Blood', 'Urine', 'Swab', 'Imaging', 'Stool', 'Tissue'] },
      { key: 'accession', label: 'Accession no.', type: 'text' },
      { key: 'clinicalNote', label: 'Clinical indication', type: 'text', full: true },
      { key: 'result', label: 'Result summary', type: 'text', full: true },
      { key: 'interpretation', label: 'Interpretation', type: 'textarea', full: true },
      { key: 'verifiedBy', label: 'Verified by', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Ordered', 'Sample collected', 'In lab', 'Ready to approve', 'Abnormal', 'Approved', 'Rejected'] },
    ],
    /* Analytes are the report. A single "result" string cannot say which
       value was out of range, and a range that isn't stored can't be
       checked later against the value that was. */
    subforms: [
      {
        key: 'analytes',
        label: 'Analytes & reference ranges',
        singular: 'analyte',
        fields: [
          { key: 'name', label: 'Analyte' },
          { key: 'value', label: 'Value', width: 110 },
          { key: 'unit', label: 'Unit', width: 100 },
          { key: 'low', label: 'Ref. low', width: 100 },
          { key: 'high', label: 'Ref. high', width: 100 },
        ],
      },
    ],
    defaults: { status: 'Ordered', result: '', test: 'CBC', lab: LABS[0], priority: 'Routine', sample: 'Blood', analytes: [], documents: [] },
    kpis: [
      { label: 'Orders', tone: 'indigo', compute: (r) => r.length.toString() },
      { label: 'Awaiting Sample', tone: 'violet', compute: (r) => byStatus(r, 'Ordered').toString() },
      { label: 'Abnormal', tone: 'rose', compute: (r) => byStatus(r, 'Abnormal').toString() },
      { label: 'Released', tone: 'green', compute: (r) => byStatus(r, 'Approved').toString() },
    ],
    actions: [
      { key: 'approve', label: 'Approve', tone: 'green', when: (r) => r.status === 'Ready to approve' || r.status === 'Abnormal', patch: () => ({ status: 'Approved', reportedAt: Date.now() }), toast: 'Result approved & released' },
    ],
    seed: [
      { resourceId: 'LAB-4471', test: 'CBC', patient: 'Anika Rahman', doctor: 'Dr. Malik', lab: 'Metro Diagnostics Lab', priority: 'Urgent', sample: 'Blood', accession: 'ACC-4471', clinicalNote: 'Fatigue, exertional chest tightness', result: 'Haemoglobin low (9.1)', status: 'Abnormal', orderedAt: mins(600), collectedAt: mins(540), receivedAt: mins(510),
        analytes: [
          { name: 'Haemoglobin', value: '9.1', unit: 'g/dL', low: '12.0', high: '15.5' },
          { name: 'WBC', value: '7.2', unit: '×10⁹/L', low: '4.0', high: '11.0' },
          { name: 'Platelets', value: '240', unit: '×10⁹/L', low: '150', high: '400' },
        ] },
      { resourceId: 'LAB-4468', test: 'Lipid Profile', patient: 'David Chen', doctor: 'Dr. Rossi', lab: 'Respira Diagnostics', priority: 'Routine', sample: 'Blood', accession: 'ACC-4468', result: 'Within range', status: 'Ready to approve', orderedAt: mins(400), collectedAt: mins(360), receivedAt: mins(330),
        analytes: [
          { name: 'Total cholesterol', value: '4.6', unit: 'mmol/L', low: '0', high: '5.2' },
          { name: 'LDL', value: '2.7', unit: 'mmol/L', low: '0', high: '3.4' },
          { name: 'HDL', value: '1.4', unit: 'mmol/L', low: '1.0', high: '2.2' },
        ] },
      { resourceId: 'LAB-4465', test: 'HbA1c', patient: 'Meera Iyer', doctor: 'Dr. Nair', lab: 'Metro Diagnostics Lab', priority: 'Routine', sample: 'Blood', accession: 'ACC-4465', result: 'Elevated 8.2%', status: 'Abnormal', orderedAt: mins(1500), collectedAt: mins(1440), receivedAt: mins(1400),
        analytes: [{ name: 'HbA1c', value: '8.2', unit: '%', low: '4.0', high: '5.6' }] },
      { resourceId: 'LAB-4460', test: 'Thyroid Panel', patient: 'Fatima Al-Sayed', doctor: 'Dr. Bello', lab: 'Metro Diagnostics Lab', priority: 'Routine', sample: 'Blood', accession: 'ACC-4460', result: '', status: 'In lab', orderedAt: mins(300), collectedAt: mins(250), receivedAt: mins(230), analytes: [] },
      { resourceId: 'LAB-4455', test: 'CBC', patient: 'James Okoro', doctor: 'Dr. Malik', lab: 'HeartCare Pathology', priority: 'Routine', sample: 'Blood', accession: 'ACC-4455', result: 'Normal', status: 'Approved', orderedAt: mins(3000), collectedAt: mins(2940), receivedAt: mins(2900), reportedAt: mins(2760), verifiedBy: 'Dr. T. Bello',
        analytes: [{ name: 'Haemoglobin', value: '14.2', unit: 'g/dL', low: '13.0', high: '17.0' }] },
      { resourceId: 'LAB-4452', test: 'Kidney Function', patient: 'Anika Rahman', doctor: 'Dr. Malik', lab: 'Metro Diagnostics Lab', priority: 'STAT', sample: 'Blood', accession: '', result: '', status: 'Ordered', orderedAt: mins(35), clinicalNote: 'Pre-contrast screen', analytes: [] },
      { resourceId: 'LAB-4450', test: 'Chest X-ray', patient: 'David Chen', doctor: 'Dr. Rossi', lab: 'Respira Diagnostics', priority: 'Urgent', sample: 'Imaging', accession: 'ACC-4450', result: '', status: 'Sample collected', orderedAt: mins(120), collectedAt: mins(60), clinicalNote: 'COPD exacerbation follow-up', analytes: [] },
      { resourceId: 'LAB-4447', test: 'Urinalysis', patient: 'Grace Wanjiru', doctor: 'Dr. Lin Wei', lab: 'Metro Diagnostics Lab', priority: 'Routine', sample: 'Urine', accession: '', result: '', status: 'Ordered', orderedAt: mins(90), analytes: [] },
    ],
  },

  /* ----------------------------------------------------------- Pharmacy */
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    icon: Store,
    accent: accents.mint,
    tagline: 'Pharmacy Management',
    desc: 'Inventory, batch tracking, expiry alerts, generics and home delivery.',
    entity: 'Item',
    idPrefix: 'PH',
    statusTones: { 'In stock': 'green', 'Low stock': 'amber', Expiring: 'rose', Delivering: 'blue' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'name', label: 'Medicine', type: 'strong' },
      { key: 'branch', label: 'Dispensary', filter: true },
      { key: 'batch', label: 'Batch' },
      { key: 'stock', label: 'Stock' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'name', label: 'Medicine', type: 'text', required: true, full: true },
      { key: 'generic', label: 'Generic name', type: 'text' },
      { key: 'branch', label: 'Dispensary', type: 'select', options: PHARMACIES, required: true },
      { key: 'batch', label: 'Batch no.', type: 'text' },
      { key: 'stock', label: 'Stock qty', type: 'number', required: true },
      { key: 'reorderLevel', label: 'Reorder level', type: 'number' },
      { key: 'price', label: 'Unit price', type: 'text' },
      { key: 'expiry', label: 'Expiry', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['In stock', 'Low stock', 'Expiring', 'Delivering'] },
    ],
    defaults: { status: 'In stock', stock: 100, reorderLevel: 50, branch: PHARMACIES[0] },
    kpis: [
      { label: 'SKUs', tone: 'mint', compute: (r) => r.length.toString() },
      { label: 'Low Stock', tone: 'amber', compute: (r) => byStatus(r, 'Low stock').toString() },
      { label: 'Expiring', tone: 'rose', compute: (r) => byStatus(r, 'Expiring').toString() },
      { label: 'Delivering', tone: 'blue', compute: (r) => byStatus(r, 'Delivering').toString() },
    ],
    actions: [
      { key: 'reorder', label: 'Reorder', tone: 'green', when: (r) => r.status === 'Low stock', patch: (r) => ({ status: 'In stock', stock: Number(r.stock) + 200 }), toast: 'Reorder raised (+200 units)' },
    ],
    seed: [
      /* Expiries are relative too: the "expiring within 60 days" rule and the
         precedence of expiry over quantity both need a shelf that is actually
         near its date whenever the demo is opened. PH-8805 is deliberately
         past it, PH-8786 deliberately close to it. */
      { resourceId: 'PH-8812', name: 'Atorvastatin 20mg', generic: 'Atorvastatin', branch: 'Metro General Pharmacy', batch: 'B-4410', stock: 620, reorderLevel: 120, price: '$0.35', expiry: day(210), status: 'In stock' },
      { resourceId: 'PH-8809', name: 'Metformin 850mg', generic: 'Metformin HCl', branch: 'City Care Pharmacy', batch: 'B-4388', stock: 40, reorderLevel: 100, price: '$0.18', expiry: day(160), status: 'Delivering' },
      { resourceId: 'PH-8805', name: 'Amoxicillin 500mg', generic: 'Amoxicillin', branch: 'Metro General Pharmacy', batch: 'B-2291', stock: 210, reorderLevel: 80, price: '$0.44', expiry: day(-5), status: 'Expiring' },
      { resourceId: 'PH-8800', name: 'Insulin Glargine', generic: 'Insulin glargine', branch: 'Metro General Pharmacy', batch: 'B-4102', stock: 18, reorderLevel: 40, price: '$21.00', expiry: day(105), status: 'Low stock' },
      { resourceId: 'PH-8795', name: 'Levothyroxine 75mcg', generic: 'Levothyroxine sodium', branch: 'City Care Pharmacy', batch: 'B-4055', stock: 480, reorderLevel: 100, price: '$0.12', expiry: day(300), status: 'In stock' },
      { resourceId: 'PH-8790', name: 'Bisoprolol 5mg', generic: 'Bisoprolol fumarate', branch: 'Metro General Pharmacy', batch: 'B-4520', stock: 340, reorderLevel: 90, price: '$0.21', expiry: day(390), status: 'In stock' },
      { resourceId: 'PH-8786', name: 'Salbutamol inhaler', generic: 'Salbutamol', branch: 'HeartCare Dispensary', batch: 'B-3311', stock: 26, reorderLevel: 30, price: '$6.80', expiry: day(38), status: 'Expiring' },
      { resourceId: 'PH-8782', name: 'Warfarin 5mg', generic: 'Warfarin sodium', branch: 'Metro General Pharmacy', batch: 'B-4601', stock: 155, reorderLevel: 60, price: '$0.16', expiry: day(280), status: 'In stock' },
      { resourceId: 'PH-8778', name: 'Ferrous sulfate 200mg', generic: 'Ferrous sulfate', branch: 'HeartCare Dispensary', batch: 'B-4210', stock: 410, reorderLevel: 100, price: '$0.09', expiry: day(360), status: 'In stock' },
    ],
  },

  /* ------------------------------------------------------ Bed capacity */
  {
    key: 'capacity',
    label: 'Bed Capacity',
    icon: BedDouble,
    accent: accents.rose,
    tagline: 'Critical Care Capacity',
    desc: 'ICU, CCU, ventilator and high-dependency bed availability across facilities.',
    entity: 'Unit',
    idPrefix: 'CAP',
    statusTones: { Open: 'green', Diverting: 'amber', Closed: 'rose' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'hospital', label: 'Facility', type: 'strong' },
      { key: 'unit', label: 'Unit', filter: true },
      { key: 'beds', label: 'Free / total', render: (r) => `${freeBeds(r)} / ${r.total || 0}` },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'hospital', label: 'Facility', type: 'text', required: true, full: true },
      { key: 'address', label: 'Address', type: 'text', full: true },
      { key: 'unit', label: 'Unit', type: 'select', options: CARE_UNITS, required: true },
      { key: 'total', label: 'Total beds', type: 'number', required: true },
      { key: 'occupied', label: 'Occupied', type: 'number', required: true },
      { key: 'phone', label: 'Admissions phone', type: 'text' },
      {
        key: 'status',
        label: 'Operational status',
        type: 'select',
        // Separate from the bed count: a unit can be closed for cleaning or
        // diverting on staffing while beds sit physically empty.
        options: ['Open', 'Diverting', 'Closed'],
      },
    ],
    defaults: { status: 'Open', unit: 'ICU', total: 10, occupied: 0 },
    kpis: [
      { label: 'ICU free', tone: 'rose', compute: (r) => sumFree(r, (x) => x.unit === 'ICU' && x.status === 'Open').toString() },
      { label: 'CCU free', tone: 'violet', compute: (r) => sumFree(r, (x) => x.unit === 'CCU (cardiac)' && x.status === 'Open').toString() },
      { label: 'Ventilators free', tone: 'amber', compute: (r) => sumFree(r, (x) => x.unit === 'Ventilator / life support' && x.status === 'Open').toString() },
      { label: 'Units full', tone: 'blue', compute: (r) => count(r, (x) => freeBeds(x) === 0).toString() },
    ],
    actions: [
      {
        key: 'admit',
        label: 'Admit',
        tone: 'blue',
        when: (r) => freeBeds(r) > 0 && r.status === 'Open',
        // Stamp the time on every change: patients are shown how old this
        // number is, so it has to be truthful.
        patch: (r) => ({ occupied: Number(r.occupied || 0) + 1, updatedAt: Date.now() }),
        toast: 'Admission recorded — one bed fewer',
      },
      {
        key: 'discharge',
        label: 'Discharge',
        tone: 'green',
        when: (r) => Number(r.occupied || 0) > 0,
        patch: (r) => ({ occupied: Number(r.occupied || 0) - 1, updatedAt: Date.now() }),
        toast: 'Discharge recorded — one bed free',
      },
    ],
    seed: [
      { resourceId: 'CAP-101', hospital: 'Metro General Hospital', address: 'Gulshan, Dhaka', unit: 'ICU', total: 14, occupied: 11, phone: '+880 9611 550 101', status: 'Open', updatedAt: mins(6) },
      { resourceId: 'CAP-102', hospital: 'Metro General Hospital', address: 'Gulshan, Dhaka', unit: 'CCU (cardiac)', total: 8, occupied: 8, phone: '+880 9611 550 102', status: 'Open', updatedAt: mins(11) },
      { resourceId: 'CAP-103', hospital: 'Metro General Hospital', address: 'Gulshan, Dhaka', unit: 'Ventilator / life support', total: 10, occupied: 7, phone: '+880 9611 550 103', status: 'Open', updatedAt: mins(4) },
      { resourceId: 'CAP-104', hospital: 'Metro General Hospital', address: 'Gulshan, Dhaka', unit: 'NICU (newborn)', total: 6, occupied: 4, phone: '+880 9611 550 104', status: 'Open', updatedAt: mins(19) },
      { resourceId: 'CAP-105', hospital: 'HeartCare Diagnostic', address: 'Banani, Dhaka', unit: 'CCU (cardiac)', total: 6, occupied: 2, phone: '+880 9611 770 105', status: 'Open', updatedAt: mins(9) },
      { resourceId: 'CAP-106', hospital: 'HeartCare Diagnostic', address: 'Banani, Dhaka', unit: 'ICU', total: 4, occupied: 4, phone: '+880 9611 770 106', status: 'Open', updatedAt: mins(27) },
      { resourceId: 'CAP-107', hospital: 'Endo & Diabetes Clinic', address: 'Dhanmondi, Dhaka', unit: 'HDU (high dependency)', total: 5, occupied: 1, phone: '+880 9611 330 107', status: 'Diverting', updatedAt: mins(38) },
      { resourceId: 'CAP-108', hospital: 'NeuroCare Center', address: 'Deira, Dubai', unit: 'ICU', total: 9, occupied: 6, phone: '+971 4 220 8108', status: 'Open', updatedAt: mins(14) },
      { resourceId: 'CAP-109', hospital: 'Respira Clinic', address: 'Rome, Italy', unit: 'Ventilator / life support', total: 6, occupied: 3, phone: '+39 06 5510 109', status: 'Open', updatedAt: mins(52) },
      // Deliberately stale, so the freshness warning has something to catch.
      { resourceId: 'CAP-110', hospital: 'Metro Imaging Center', address: 'Ikeja, Lagos', unit: 'HDU (high dependency)', total: 4, occupied: 2, phone: '+234 802 445 7110', status: 'Open', updatedAt: mins(190) },
      { resourceId: 'CAP-111', hospital: 'SkinHealth Clinic', address: 'Orchard, Singapore', unit: 'Isolation', total: 3, occupied: 0, phone: '+65 6820 6111', status: 'Closed', updatedAt: mins(75) },
    ],
  },

  /* --------------------------------------------------------- Admissions */
  {
    key: 'admissions',
    label: 'Admissions',
    icon: ClipboardPlus,
    accent: accents.sky,
    tagline: 'In-patient Admissions',
    desc: 'Admission, ward and bed assignment, transfers and discharge.',
    entity: 'Admission',
    idPrefix: 'ADM',
    /* Bed *capacity* counts and *who is in which bed* are different questions.
       Capacity answers "is there room"; this answers "where is Mr Chen". The
       two are kept apart on purpose — an admission that silently decremented
       a capacity row would double-count against the manual Admit action. */
    /* Reserved sits *before* Admitted: a patient-side bed booking is a
       request against a unit, not an occupancy. Nothing about it touches
       the capacity count until admissions actually confirms it. */
    statusTones: { Reserved: 'amber', Admitted: 'blue', Observation: 'amber', 'For discharge': 'violet', Discharged: 'green', Transferred: 'teal', Declined: 'rose', Cancelled: 'rose' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'patient', label: 'Patient', type: 'strong' },
      { key: 'hospital', label: 'Facility', filter: true },
      { key: 'unit', label: 'Ward / unit', filter: true },
      { key: 'bed', label: 'Bed' },
      { key: 'doctor', label: 'Consultant', filter: true },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'patient', label: 'Patient', type: 'text', required: true, full: true },
      { key: 'hospital', label: 'Facility', type: 'text', required: true, full: true },
      { key: 'unit', label: 'Ward / unit', type: 'select', options: [...CARE_UNITS, 'General ward', 'Maternity', 'Surgical ward'] },
      { key: 'bed', label: 'Bed no.', type: 'text' },
      { key: 'doctor', label: 'Consultant', type: 'text' },
      { key: 'admittedOn', label: 'Admitted on', type: 'date' },
      { key: 'diagnosis', label: 'Admitting diagnosis', type: 'text', full: true },
      { key: 'payer', label: 'Payer', type: 'select', options: ['Self-pay', 'Insurance', 'Corporate', 'Government scheme'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Reserved', 'Admitted', 'Observation', 'For discharge', 'Discharged', 'Transferred', 'Declined', 'Cancelled'] },
    ],
    defaults: { status: 'Admitted', unit: 'General ward', payer: 'Self-pay' },
    kpis: [
      { label: 'In-patients', tone: 'sky', compute: (r) => byStatus(r, 'Admitted', 'Observation', 'For discharge').toString() },
      { label: 'For Discharge', tone: 'violet', compute: (r) => byStatus(r, 'For discharge').toString() },
      { label: 'Under Observation', tone: 'amber', compute: (r) => byStatus(r, 'Observation').toString() },
      { label: 'Discharged', tone: 'green', compute: (r) => byStatus(r, 'Discharged').toString() },
    ],
    actions: [
      /* A patient booking arrives as Reserved and waits for a human. The
         bed is only really held once someone in admissions says so. */
      { key: 'acceptBed', label: 'Confirm bed', tone: 'blue', when: (r) => r.status === 'Reserved', patch: () => ({ status: 'Admitted', admittedOn: new Date().toISOString().slice(0, 10) }), toast: 'Bed booking confirmed — patient notified' },
      { key: 'declineBed', label: 'Decline booking', tone: 'rose', when: (r) => r.status === 'Reserved', patch: () => ({ status: 'Declined' }), toast: 'Booking declined — deposit refundable' },
      { key: 'flag', label: 'Mark for discharge', tone: 'violet', when: (r) => r.status === 'Admitted' || r.status === 'Observation', patch: () => ({ status: 'For discharge' }), toast: 'Flagged for discharge planning' },
      { key: 'discharge', label: 'Discharge', tone: 'green', when: (r) => r.status === 'For discharge', patch: () => ({ status: 'Discharged', dischargedAt: Date.now() }), toast: 'Patient discharged — bed released' },
    ],
    seed: [
      { resourceId: 'ADM-2201', patient: 'David Chen', hospital: 'Metro General Hospital', unit: 'ICU', bed: 'ICU-04', doctor: 'Dr. Rossi', admittedOn: day(-4), diagnosis: 'COPD exacerbation', payer: 'Insurance', status: 'For discharge' },
      { resourceId: 'ADM-2198', patient: 'Anika Rahman', hospital: 'Metro General Hospital', unit: 'CCU (cardiac)', bed: 'CCU-02', doctor: 'Dr. Malik', admittedOn: day(-2), diagnosis: 'Unstable angina', payer: 'Insurance', status: 'Admitted' },
      { resourceId: 'ADM-2194', patient: 'Fatima Al-Sayed', hospital: 'NeuroCare Center', unit: 'HDU (high dependency)', bed: 'HDU-01', doctor: 'Dr. Farah', admittedOn: day(-3), diagnosis: 'Status migrainosus', payer: 'Self-pay', status: 'Observation' },
      { resourceId: 'ADM-2190', patient: 'James Okoro', hospital: 'Metro General Hospital', unit: 'General ward', bed: 'GW-17', doctor: 'Dr. Malik', admittedOn: day(-8), diagnosis: 'Hyperglycaemia', payer: 'Corporate', status: 'Discharged', dischargedAt: mins(2880) },
      { resourceId: 'ADM-2186', patient: 'Grace Wanjiru', hospital: 'SkinHealth Clinic', unit: 'Isolation', bed: 'ISO-01', doctor: 'Dr. Lin Wei', admittedOn: day(-1), diagnosis: 'Severe cellulitis', payer: 'Insurance', status: 'Admitted' },
    ],
  },

  /* ---------------------------------------------------- Ambulance fleet */
  {
    key: 'ambulances',
    label: 'Ambulance Fleet',
    icon: Ambulance,
    accent: accents.orange,
    tagline: 'Enlisted Ambulances & Drivers',
    desc: 'Vehicles enlisted by each operator, their crew, and whether they are on duty.',
    entity: 'Ambulance',
    idPrefix: 'AMB',
    statusTones: { Available: 'green', 'On another trip': 'amber', 'Off duty': 'blue', Maintenance: 'rose' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'regNo', label: 'Registration', type: 'strong' },
      { key: 'unitType', label: 'Type', filter: true },
      { key: 'operator', label: 'Operator', filter: true },
      { key: 'driverName', label: 'Driver' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'regNo', label: 'Registration no.', type: 'text', required: true, full: true },
      { key: 'operator', label: 'Operator', type: 'select', options: AMBULANCE_OPERATORS, required: true },
      { key: 'unitType', label: 'Vehicle type', type: 'select', options: AMBULANCE_TYPES, required: true },
      { key: 'phone', label: 'Dispatch phone', type: 'text', required: true },
      { key: 'baseFee', label: 'Base fare', type: 'text' },
      { key: 'station', label: 'Home station', type: 'text', full: true },
      /* The crew is part of the enlistment, not an afterthought: a vehicle
         with no named, licensed driver cannot legally be dispatched, so the
         driver's details live on the record that gets offered to patients. */
      { key: 'driverName', label: 'Driver name', type: 'text', required: true },
      { key: 'driverPhone', label: 'Driver phone', type: 'text', required: true },
      { key: 'driverLicense', label: 'Driving licence no.', type: 'text', required: true },
      { key: 'licenseExpiry', label: 'Licence expiry', type: 'date' },
      { key: 'driverExperience', label: 'Years driving', type: 'number' },
      { key: 'paramedic', label: 'Paramedic on board', type: 'select', options: ['Yes', 'No'] },
      { key: 'status', label: 'Status', type: 'select', options: AMBULANCE_STATUSES },
    ],
    defaults: { status: 'Available', unitType: 'Basic life support', paramedic: 'No', operator: AMBULANCE_OPERATORS[0] },
    kpis: [
      { label: 'Enlisted', tone: 'orange', compute: (r) => r.length.toString() },
      { label: 'Available now', tone: 'green', compute: (r) => byStatus(r, 'Available').toString() },
      { label: 'On a trip', tone: 'amber', compute: (r) => byStatus(r, 'On another trip').toString() },
      { label: 'Off road', tone: 'rose', compute: (r) => byStatus(r, 'Off duty', 'Maintenance').toString() },
    ],
    actions: [
      { key: 'onDuty', label: 'Put on duty', tone: 'green', when: (r) => r.status === 'Off duty' || r.status === 'Maintenance', patch: () => ({ status: 'Available', updatedAt: Date.now() }), toast: 'Vehicle is on duty' },
      { key: 'offDuty', label: 'Take off duty', tone: 'blue', when: (r) => r.status === 'Available', patch: () => ({ status: 'Off duty', updatedAt: Date.now() }), toast: 'Vehicle taken off duty' },
    ],
    seed: [
      { resourceId: 'AMB-201', regNo: 'DHA-MET-201', operator: 'Metro General Hospital', unitType: 'ICU', phone: '+880 17 1552 0041', baseFee: '৳1,500 base', station: 'Gulshan, Dhaka', lat: 23.804, lng: 90.398, driverName: 'Rafiqul Islam', driverPhone: '+880 17 3311 0201', driverLicense: 'DL-DHA-448201', licenseExpiry: day(420), driverExperience: 9, paramedic: 'Yes', status: 'Available', updatedAt: mins(8) },
      { resourceId: 'AMB-202', regNo: 'DHA-HCD-202', operator: 'HeartCare Diagnostic', unitType: 'Basic life support', phone: '+880 17 1552 0042', baseFee: '৳900 base', station: 'Banani, Dhaka', lat: 23.799, lng: 90.421, driverName: 'Shamim Ahmed', driverPhone: '+880 17 3311 0202', driverLicense: 'DL-DHA-451877', licenseExpiry: day(180), driverExperience: 5, paramedic: 'No', status: 'Available', updatedAt: mins(14) },
      { resourceId: 'AMB-203', regNo: 'DHA-CES-203', operator: 'City Emergency Service', unitType: 'ICU', phone: '+880 17 1552 0043', baseFee: '৳1,400 base', station: 'Mohakhali, Dhaka', lat: 23.783, lng: 90.414, driverName: 'Jahangir Alam', driverPhone: '+880 17 3311 0203', driverLicense: 'DL-DHA-402119', licenseExpiry: day(95), driverExperience: 12, paramedic: 'Yes', status: 'Available', updatedAt: mins(3) },
      { resourceId: 'AMB-204', regNo: 'DHA-MET-204', operator: 'Metro General Hospital', unitType: 'Freezer', phone: '+880 17 1552 0044', baseFee: '৳2,000 base', station: 'Tejgaon, Dhaka', lat: 23.78, lng: 90.395, driverName: 'Nazrul Haque', driverPhone: '+880 17 3311 0204', driverLicense: 'DL-DHA-419063', licenseExpiry: day(-12), driverExperience: 7, paramedic: 'No', status: 'Available', updatedAt: mins(26) },
      { resourceId: 'AMB-205', regNo: 'DHA-RES-205', operator: 'Respira Clinic', unitType: 'Basic life support', phone: '+880 17 1552 0045', baseFee: '৳900 base', station: 'Banani, Dhaka', lat: 23.797, lng: 90.403, driverName: 'Sohel Rana', driverPhone: '+880 17 3311 0205', driverLicense: 'DL-DHA-466204', licenseExpiry: day(310), driverExperience: 3, paramedic: 'No', status: 'On another trip', updatedAt: mins(5) },
      { resourceId: 'AMB-206', regNo: 'DHA-CES-206', operator: 'City Emergency Service', unitType: 'NICU (newborn)', phone: '+880 17 1552 0046', baseFee: '৳2,200 base', station: 'Badda, Dhaka', lat: 23.788, lng: 90.426, driverName: 'Kamal Uddin', driverPhone: '+880 17 3311 0206', driverLicense: 'DL-DHA-470913', licenseExpiry: day(240), driverExperience: 6, paramedic: 'Yes', status: 'Available', updatedAt: mins(11) },
      { resourceId: 'AMB-207', regNo: 'DHA-CES-207', operator: 'City Emergency Service', unitType: 'Patient transport', phone: '+880 17 1552 0047', baseFee: '৳700 base', station: 'Mohakhali, Dhaka', lat: 23.776, lng: 90.408, driverName: 'Belal Hossain', driverPhone: '+880 17 3311 0207', driverLicense: 'DL-DHA-482550', licenseExpiry: day(60), driverExperience: 2, paramedic: 'No', status: 'Maintenance', updatedAt: mins(320) },
    ],
  },

  /* --------------------------------------------------- Ambulance trips */
  {
    key: 'ambulanceTrips',
    label: 'Ambulance Trips',
    icon: Route,
    accent: accents.gold,
    tagline: 'Dispatch & Trip Log',
    desc: 'Patient pickups: who was dispatched, to whom, and how the trip ended.',
    entity: 'Trip',
    idPrefix: 'TRIP',
    statusTones: { Dispatched: 'amber', Arrived: 'blue', Completed: 'green', Cancelled: 'rose' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'patient', label: 'Patient', type: 'strong' },
      { key: 'ambulanceId', label: 'Ambulance' },
      { key: 'operator', label: 'Operator', filter: true },
      { key: 'pickup', label: 'Pickup' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'patient', label: 'Patient', type: 'text', required: true },
      { key: 'phone', label: 'Contact number', type: 'text' },
      { key: 'ambulanceId', label: 'Ambulance', type: 'text', required: true },
      { key: 'operator', label: 'Operator', type: 'select', options: AMBULANCE_OPERATORS },
      { key: 'pickup', label: 'Pickup point', type: 'text', full: true },
      { key: 'destination', label: 'Destination', type: 'text', full: true },
      { key: 'unitType', label: 'Vehicle type', type: 'select', options: AMBULANCE_TYPES },
      { key: 'etaMin', label: 'ETA (minutes)', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['Dispatched', 'Arrived', 'Completed', 'Cancelled'] },
    ],
    defaults: { status: 'Dispatched' },
    kpis: [
      { label: 'Live now', tone: 'amber', compute: (r) => byStatus(r, 'Dispatched', 'Arrived').toString() },
      { label: 'Completed', tone: 'green', compute: (r) => byStatus(r, 'Completed').toString() },
      { label: 'Cancelled', tone: 'rose', compute: (r) => byStatus(r, 'Cancelled').toString() },
      { label: 'Trips logged', tone: 'gold', compute: (r) => r.length.toString() },
    ],
    actions: [
      { key: 'arrived', label: 'Mark arrived', tone: 'blue', when: (r) => r.status === 'Dispatched', patch: () => ({ status: 'Arrived', arrivedAt: Date.now() }), toast: 'Marked as arrived at the patient' },
      { key: 'complete', label: 'Complete', tone: 'green', when: (r) => r.status === 'Arrived' || r.status === 'Dispatched', patch: () => ({ status: 'Completed', completedAt: Date.now() }), toast: 'Trip completed' },
    ],
    seed: [
      { resourceId: 'TRIP-4402', patient: 'David Chen', phone: '+1 415 555 0132', ambulanceId: 'AMB-205', operator: 'Respira Clinic', pickup: 'Banani, Dhaka', destination: 'Respira Clinic', unitType: 'Basic life support', etaMin: 6, status: 'Dispatched', requestedAt: mins(4) },
      { resourceId: 'TRIP-4398', patient: 'Grace Wanjiru', phone: '+254 712 445 118', ambulanceId: 'AMB-203', operator: 'City Emergency Service', pickup: 'Mohakhali, Dhaka', destination: 'Metro General Hospital', unitType: 'ICU', etaMin: 9, status: 'Completed', requestedAt: mins(220), completedAt: mins(180) },
      { resourceId: 'TRIP-4391', patient: 'James Okoro', phone: '+234 802 445 118', ambulanceId: 'AMB-206', operator: 'City Emergency Service', pickup: 'Badda, Dhaka', destination: 'Metro General Hospital', unitType: 'NICU (newborn)', etaMin: 11, status: 'Completed', requestedAt: mins(1500), completedAt: mins(1440) },
      { resourceId: 'TRIP-4386', patient: 'Meera Iyer', phone: '+91 98 2200 4471', ambulanceId: 'AMB-203', operator: 'City Emergency Service', pickup: 'Gulshan-2, Dhaka', destination: 'Endo & Diabetes Clinic', unitType: 'ICU', etaMin: 7, status: 'Cancelled', requestedAt: mins(2900) },
    ],
  },

  /* -------------------------------------------------------- Departments */
  {
    key: 'departments',
    label: 'Departments',
    icon: Network,
    accent: accents.teal,
    tagline: 'Departments & Services',
    desc: 'Clinical departments, service catalogue, heads of unit and tariffs.',
    entity: 'Department',
    idPrefix: 'DEP',
    statusTones: { Open: 'green', 'Limited service': 'amber', Closed: 'rose' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'name', label: 'Department', type: 'strong' },
      { key: 'hospital', label: 'Facility', filter: true },
      { key: 'head', label: 'Head of unit' },
      { key: 'phone', label: 'Extension' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'name', label: 'Department', type: 'text', required: true, full: true },
      { key: 'hospital', label: 'Facility', type: 'text', required: true, full: true },
      { key: 'head', label: 'Head of unit', type: 'text' },
      { key: 'phone', label: 'Extension', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Limited service', 'Closed'] },
      { key: 'notes', label: 'Notes', type: 'textarea', full: true },
    ],
    /* The tariff is a department property, not a doctor's fee: an X-ray
       costs the same whoever requested it. Billing reads these. */
    subforms: [
      {
        key: 'services',
        label: 'Service catalogue',
        singular: 'service',
        fields: [
          { key: 'name', label: 'Service' },
          { key: 'code', label: 'Code', width: 110 },
          { key: 'price', label: 'Tariff', width: 110 },
        ],
      },
    ],
    defaults: { status: 'Open', services: [] },
    kpis: [
      { label: 'Departments', tone: 'teal', compute: (r) => r.length.toString() },
      { label: 'Open', tone: 'green', compute: (r) => byStatus(r, 'Open').toString() },
      { label: 'Limited', tone: 'amber', compute: (r) => byStatus(r, 'Limited service').toString() },
      { label: 'Services', tone: 'blue', compute: (r) => r.reduce((n, x) => n + (x.services?.length || 0), 0).toString() },
    ],
    actions: [
      { key: 'open', label: 'Reopen', tone: 'green', when: (r) => r.status !== 'Open', patch: () => ({ status: 'Open' }), toast: 'Department reopened' },
    ],
    seed: [
      { resourceId: 'DEP-011', name: 'Cardiology', hospital: 'Metro General Hospital', head: 'Dr. Sara Malik', phone: 'x2201', status: 'Open',
        services: [
          { name: 'Consultation — cardiology', code: 'CARD-01', price: '$120' },
          { name: 'Echocardiogram', code: 'CARD-14', price: '$180' },
          { name: 'Exercise tolerance test', code: 'CARD-22', price: '$210' },
        ] },
      { resourceId: 'DEP-012', name: 'Endocrinology', hospital: 'Metro General Hospital', head: 'Dr. Priya Nair', phone: 'x2210', status: 'Open',
        services: [
          { name: 'Consultation — endocrinology', code: 'ENDO-01', price: '$110' },
          { name: 'Diabetes education session', code: 'ENDO-08', price: '$45' },
        ] },
      { resourceId: 'DEP-013', name: 'Radiology', hospital: 'Metro Imaging Center', head: 'Dr. Tunde Bello', phone: 'x3300', status: 'Open',
        services: [
          { name: 'Chest X-ray', code: 'RAD-02', price: '$60' },
          { name: 'CT head (non-contrast)', code: 'RAD-31', price: '$320' },
        ] },
      { resourceId: 'DEP-014', name: 'Pulmonology', hospital: 'Respira Clinic', head: 'Dr. Marco Rossi', phone: 'x4110', status: 'Open',
        services: [
          { name: 'Consultation — pulmonology', code: 'PULM-01', price: '$100' },
          { name: 'Spirometry', code: 'PULM-05', price: '$70' },
        ] },
      { resourceId: 'DEP-015', name: 'Emergency', hospital: 'Metro General Hospital', head: 'Unassigned', phone: 'x9999', status: 'Limited service', notes: 'Overnight cover by on-call rota only.',
        services: [{ name: 'Emergency attendance', code: 'ED-01', price: '$150' }] },
      { resourceId: 'DEP-016', name: 'Dermatology', hospital: 'SkinHealth Clinic', head: 'Dr. Lin Wei', phone: 'x5120', status: 'Open',
        services: [{ name: 'Consultation — dermatology', code: 'DERM-01', price: '$80' }] },
    ],
  },

  /* ------------------------------------------------------------ Billing */
  {
    key: 'billing',
    label: 'Billing & Finance',
    icon: Wallet,
    accent: accents.orange,
    tagline: 'Billing & Finance',
    desc: 'Consultation, pharmacy and lab billing, insurance claims and subscriptions.',
    entity: 'Invoice',
    idPrefix: 'INV',
    statusTones: { Paid: 'green', Due: 'amber', Submitted: 'blue', 'Fraud review': 'violet', Overdue: 'rose' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'party', label: 'Bill to', type: 'strong' },
      { key: 'category', label: 'Category', filter: true },
      { key: 'hospital', label: 'Facility', filter: true },
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'party', label: 'Bill to', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: ['Consultation', 'Pharmacy', 'Laboratory', 'Insurance', 'Corporate', 'In-patient'] },
      { key: 'hospital', label: 'Facility', type: 'text', full: true },
      { key: 'doctor', label: 'Attributed to', type: 'text' },
      { key: 'date', label: 'Issued', type: 'date' },
      { key: 'amount', label: 'Amount', type: 'text', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['Due', 'Submitted', 'Paid', 'Fraud review', 'Overdue'] },
    ],
    defaults: { status: 'Due', category: 'Consultation' },
    kpis: [
      { label: 'Invoices', tone: 'orange', compute: (r) => r.length.toString() },
      { label: 'Paid', tone: 'green', compute: (r) => byStatus(r, 'Paid').toString() },
      { label: 'Claims Pending', tone: 'blue', compute: (r) => byStatus(r, 'Submitted').toString() },
      { label: 'Fraud Flags', tone: 'violet', compute: (r) => byStatus(r, 'Fraud review').toString() },
    ],
    actions: [
      { key: 'pay', label: 'Mark paid', tone: 'green', when: (r) => r.status !== 'Paid' && r.status !== 'Fraud review', patch: () => ({ status: 'Paid' }), toast: 'Payment recorded' },
      { key: 'clear', label: 'Clear flag', tone: 'blue', when: (r) => r.status === 'Fraud review', patch: () => ({ status: 'Submitted' }), toast: 'Fraud flag cleared' },
    ],
    seed: [
      /* Spread across three months so the earnings and revenue charts have a
         trend to show rather than a single bar. */
      { resourceId: 'INV-2291', party: 'Anika Rahman', category: 'Consultation', hospital: 'Metro General Hospital', doctor: 'Dr. Malik', date: day(-1), amount: '$240', status: 'Submitted' },
      { resourceId: 'INV-2288', party: 'David Chen', category: 'Laboratory', hospital: 'Respira Clinic', doctor: 'Dr. Rossi', date: day(-3), amount: '$88', status: 'Paid' },
      { resourceId: 'CLM-1140', party: 'Meera Iyer', category: 'Insurance', hospital: 'Endo & Diabetes Clinic', doctor: 'Dr. Nair', date: day(-10), amount: '$430', status: 'Fraud review' },
      { resourceId: 'INV-2280', party: 'Acme Ltd', category: 'Corporate', hospital: 'Metro General Hospital', date: day(-36), amount: '$12,400', status: 'Due' },
      { resourceId: 'INV-2275', party: 'James Okoro', category: 'Pharmacy', hospital: 'Metro General Hospital', doctor: 'Dr. Malik', date: day(-44), amount: '$54', status: 'Overdue' },
      { resourceId: 'INV-2270', party: 'David Chen', category: 'In-patient', hospital: 'Metro General Hospital', doctor: 'Dr. Rossi', date: day(-9), amount: '$3,180', status: 'Due' },
      { resourceId: 'INV-2266', party: 'Anika Rahman', category: 'Consultation', hospital: 'Metro General Hospital', doctor: 'Dr. Malik', date: day(-58), amount: '$120', status: 'Paid' },
      { resourceId: 'INV-2263', party: 'Anika Rahman', category: 'Consultation', hospital: 'Metro General Hospital', doctor: 'Dr. Malik', date: day(-25), amount: '$120', status: 'Paid' },
      { resourceId: 'INV-2261', party: 'Grace Wanjiru', category: 'Consultation', hospital: 'SkinHealth Clinic', doctor: 'Dr. Lin Wei', date: day(0), amount: '$80', status: 'Due' },
    ],
  },

  /* --------------------------------------------------------------- RPM */
  {
    key: 'rpm',
    label: 'Remote Monitoring',
    icon: Activity,
    accent: accents.sky,
    tagline: 'Remote Patient Monitoring',
    desc: 'Live vitals from BP, glucose, ECG, SpO₂ and wearable devices with risk alerts.',
    entity: 'Monitor',
    idPrefix: 'RPM',
    hasMonitor: true,
    statusTones: { Critical: 'rose', High: 'amber', Watch: 'blue', Stable: 'green' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'patient', label: 'Patient', type: 'strong' },
      { key: 'doctor', label: 'Responsible', filter: true },
      { key: 'device', label: 'Device', filter: true },
      { key: 'reading', label: 'Reading' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'patient', label: 'Patient', type: 'text', required: true },
      { key: 'doctor', label: 'Responsible clinician', type: 'text' },
      { key: 'device', label: 'Device', type: 'select', options: ['Pulse oximeter', 'BP monitor', 'Glucose meter', 'ECG', 'Wearable', 'Smart scale'] },
      { key: 'reading', label: 'Latest reading', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Stable', 'Watch', 'High', 'Critical'] },
    ],
    defaults: { status: 'Stable', device: 'Wearable' },
    kpis: [
      { label: 'Monitored', tone: 'sky', compute: (r) => r.length.toString() },
      { label: 'Critical', tone: 'rose', compute: (r) => byStatus(r, 'Critical').toString() },
      { label: 'High', tone: 'amber', compute: (r) => byStatus(r, 'High').toString() },
      { label: 'Stable', tone: 'green', compute: (r) => byStatus(r, 'Stable').toString() },
    ],
    actions: [
      { key: 'ack', label: 'Acknowledge', tone: 'green', when: (r) => r.status === 'Critical' || r.status === 'High', patch: () => ({ status: 'Watch' }), toast: 'Alert acknowledged — care team notified' },
    ],
    /* A monitored patient has a clinician responsible for the alert. Without
       one, a critical reading arrives in nobody's queue — which is the exact
       failure remote monitoring exists to prevent. */
    seed: [
      { resourceId: 'RPM-3391', patient: 'Anika Rahman', doctor: 'Dr. Malik', device: 'Pulse oximeter', reading: 'SpO₂ 88%', status: 'Critical' },
      { resourceId: 'RPM-3388', patient: 'James Okoro', doctor: 'Dr. Malik', device: 'BP monitor', reading: '168/104', status: 'High' },
      { resourceId: 'RPM-3385', patient: 'Meera Iyer', doctor: 'Dr. Nair', device: 'Glucose meter', reading: '42 mg/dL', status: 'Critical' },
      { resourceId: 'RPM-3380', patient: 'Fatima Al-Sayed', doctor: 'Dr. Bello', device: 'Wearable', reading: 'HR 118', status: 'Watch' },
      { resourceId: 'RPM-3375', patient: 'David Chen', doctor: 'Dr. Rossi', device: 'Smart scale', reading: '82 kg', status: 'Stable' },
    ],
  },

  /* --------------------------------------------------------- AI Platform */
  {
    key: 'ai',
    label: 'AI Platform',
    icon: Sparkles,
    accent: accents.plum,
    tagline: 'Artificial Intelligence Platform',
    desc: 'Symptom checker, medical assistant, imaging, chatbot and predictive models.',
    entity: 'AI task',
    idPrefix: 'AI',
    hasAI: true,
    statusTones: { 'Needs review': 'amber', 'Radiologist': 'blue', Clinician: 'rose', Accepted: 'green' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'task', label: 'Task', type: 'strong' },
      { key: 'kind', label: 'Type', filter: true },
      { key: 'confidence', label: 'Confidence' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'task', label: 'Task', type: 'text', required: true, full: true },
      { key: 'kind', label: 'Type', type: 'select', options: ['Imaging', 'Prediction', 'Notes', 'Triage'] },
      { key: 'confidence', label: 'Confidence', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Needs review', 'Radiologist', 'Clinician', 'Accepted'] },
    ],
    defaults: { status: 'Needs review', kind: 'Prediction', confidence: '0.80' },
    kpis: [
      { label: 'AI Tasks', tone: 'plum', compute: (r) => r.length.toString() },
      { label: 'Needs Review', tone: 'amber', compute: (r) => byStatus(r, 'Needs review', 'Radiologist', 'Clinician').toString() },
      { label: 'Accepted', tone: 'green', compute: (r) => byStatus(r, 'Accepted').toString() },
      { label: 'Avg. Confidence', tone: 'violet', compute: (r) => (r.reduce((a, x) => a + Number(x.confidence || 0), 0) / (r.length || 1)).toFixed(2) },
    ],
    actions: [
      { key: 'accept', label: 'Accept', tone: 'green', when: (r) => r.status !== 'Accepted', patch: () => ({ status: 'Accepted' }), toast: 'AI output accepted by clinician' },
    ],
    seed: [
      { resourceId: 'AI-7791', task: 'Chest X-ray · Anika Rahman', kind: 'Imaging', confidence: '0.86', status: 'Radiologist' },
      { resourceId: 'AI-7788', task: 'Sepsis risk · James Okoro', kind: 'Prediction', confidence: '0.79', status: 'Clinician' },
      { resourceId: 'AI-7785', task: 'SOAP note · Meera Iyer', kind: 'Notes', confidence: '0.94', status: 'Needs review' },
      { resourceId: 'AI-7780', task: 'Symptom triage · Fatima Al-Sayed', kind: 'Triage', confidence: '0.88', status: 'Accepted' },
      { resourceId: 'AI-7775', task: 'Diabetes risk · David Chen', kind: 'Prediction', confidence: '0.72', status: 'Needs review' },
    ],
  },

  /* --------------------------------------------------------- Analytics */
  {
    key: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    accent: accents.gold,
    tagline: 'Analytics & Predictive Insights',
    desc: 'Patient volume, revenue, satisfaction and predictive resource forecasting.',
    entity: 'Report',
    idPrefix: 'RPT',
    hasCharts: true,
    statusTones: { Live: 'green', Scheduled: 'blue', Draft: 'amber' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'name', label: 'Report', type: 'strong' },
      { key: 'category', label: 'Category', filter: true },
      { key: 'owner', label: 'Owner' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'name', label: 'Report name', type: 'text', required: true, full: true },
      { key: 'category', label: 'Category', type: 'select', options: ['Operational', 'Financial', 'Clinical', 'Predictive'] },
      { key: 'owner', label: 'Owner', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Scheduled', 'Live'] },
    ],
    defaults: { status: 'Draft', category: 'Operational' },
    kpis: [
      { label: 'Reports', tone: 'gold', compute: (r) => r.length.toString() },
      { label: 'Live', tone: 'green', compute: (r) => byStatus(r, 'Live').toString() },
      { label: 'Scheduled', tone: 'blue', compute: (r) => byStatus(r, 'Scheduled').toString() },
      { label: 'Draft', tone: 'amber', compute: (r) => byStatus(r, 'Draft').toString() },
    ],
    actions: [
      { key: 'publish', label: 'Publish', tone: 'green', when: (r) => r.status !== 'Live', patch: () => ({ status: 'Live' }), toast: 'Report published' },
    ],
    seed: [
      { resourceId: 'RPT-021', name: 'Patient Volume Forecast', category: 'Predictive', owner: 'Ops team', status: 'Live' },
      { resourceId: 'RPT-018', name: 'ICU Demand (72h)', category: 'Predictive', owner: 'Bed mgmt', status: 'Live' },
      { resourceId: 'RPT-015', name: 'Monthly Revenue Mix', category: 'Financial', owner: 'Finance', status: 'Scheduled' },
      { resourceId: 'RPT-012', name: 'Seasonal Disease Trends', category: 'Clinical', owner: 'Epidemiology', status: 'Draft' },
      { resourceId: 'RPT-009', name: 'Doctor Utilization', category: 'Operational', owner: 'HR', status: 'Live' },
    ],
  },

  /* ---------------------------------------------------------- Admin */
  {
    key: 'admin',
    label: 'Administration',
    icon: ShieldCheck,
    accent: accents.indigo,
    tagline: 'Administrator Portal',
    desc: 'Hospitals, users, pricing plans, security, audit logs and AI monitoring.',
    entity: 'Item',
    idPrefix: 'SYS',
    statusTones: { Open: 'amber', 'In progress': 'blue', Resolved: 'green', Incident: 'rose' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'title', label: 'Task', type: 'strong' },
      { key: 'kind', label: 'Type', filter: true },
      { key: 'tenant', label: 'Tenant' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'title', label: 'Task', type: 'text', required: true, full: true },
      { key: 'kind', label: 'Type', type: 'select', options: ['Onboarding', 'Role change', 'Security', 'Billing', 'Config'] },
      { key: 'tenant', label: 'Tenant', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['Open', 'In progress', 'Resolved', 'Incident'] },
    ],
    defaults: { status: 'Open', kind: 'Config' },
    kpis: [
      { label: 'Open Tasks', tone: 'amber', compute: (r) => byStatus(r, 'Open', 'In progress').toString() },
      { label: 'Incidents', tone: 'rose', compute: (r) => byStatus(r, 'Incident').toString() },
      { label: 'Resolved', tone: 'green', compute: (r) => byStatus(r, 'Resolved').toString() },
      { label: 'Total', tone: 'indigo', compute: (r) => r.length.toString() },
    ],
    actions: [
      { key: 'resolve', label: 'Resolve', tone: 'green', when: (r) => r.status !== 'Resolved', patch: () => ({ status: 'Resolved' }), toast: 'Task resolved' },
    ],
    seed: [
      { resourceId: 'SYS-441', title: 'New tenant onboarding', kind: 'Onboarding', tenant: 'Sunrise Clinic', status: 'In progress' },
      { resourceId: 'SYS-438', title: 'Grant Lab Manager role', kind: 'Role change', tenant: 'Metro General', status: 'Open' },
      { resourceId: 'SYS-435', title: 'Unusual login investigation', kind: 'Security', tenant: 'Acme Health', status: 'Incident' },
      { resourceId: 'SYS-430', title: 'Plan upgrade to Enterprise', kind: 'Billing', tenant: 'Acme Health', status: 'Resolved' },
      { resourceId: 'SYS-425', title: 'Enforce MFA policy', kind: 'Config', tenant: 'Sunrise Clinic', status: 'Open' },
    ],
  },
]

/* Merge in the Function tiles + initial Activity feed for each module. */
import { content } from './moduleContent.js'
for (const s of schemas) {
  s.tiles = content[s.key]?.tiles || []
  s.feed = content[s.key]?.feed || []
}

/* Resolve the human-written names in the seeds into patient/doctor ids, so
   every portal can scope by key rather than by string match. */
import { linkSeeds } from './links.js'
linkSeeds(schemas)

export const schemaMap = Object.fromEntries(schemas.map((s) => [s.key, s]))
