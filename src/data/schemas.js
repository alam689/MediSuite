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
          { date: '2026-06-10', doctor: 'Dr. Malik', reason: 'Chest tightness', outcome: 'Started beta-blocker' },
          { date: '2026-03-02', doctor: 'Dr. Malik', reason: 'Routine review', outcome: 'Stable' },
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
        visits: [{ date: '2026-05-20', doctor: 'Dr. Malik', reason: 'BP management', outcome: 'Adjusted meds' }],
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
      { resourceId: 'CS-7781', patient: 'Anika Rahman', doctor: 'Dr. Malik', mode: 'Video', reason: 'Chest pain review', status: 'Live' },
      { resourceId: 'CS-7780', patient: 'David Chen', doctor: 'Dr. Rossi', mode: 'Audio', reason: 'Follow-up', status: 'Waiting' },
      { resourceId: 'CS-7778', patient: 'Meera Iyer', doctor: 'Dr. Nair', mode: 'Video', reason: 'Thyroid results', status: 'Queued' },
      { resourceId: 'CS-7775', patient: 'Fatima Al-Sayed', doctor: 'Dr. Bello', mode: 'Chat', reason: 'Triage', status: 'Waiting' },
      { resourceId: 'CS-7770', patient: 'James Okoro', doctor: 'Dr. Malik', mode: 'Video', reason: 'BP management', status: 'Completed' },
      { resourceId: 'CS-7766', patient: 'Grace Wanjiru', doctor: 'Dr. Lin Wei', mode: 'Video', reason: 'Skin rash', status: 'Queued' },
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
      { resourceId: 'AP-5521', time: '09:30', patient: 'Anika Rahman', doctor: 'Dr. Malik', date: '2026-07-13', type: 'Video', status: 'Confirmed' },
      { resourceId: 'AP-5522', time: '10:00', patient: 'David Chen', doctor: 'Dr. Rossi', date: '2026-07-13', type: 'In-person', status: 'Checked-in' },
      { resourceId: 'AP-5525', time: '10:30', patient: 'Meera Iyer', doctor: 'Dr. Nair', date: '2026-07-13', type: 'Video', status: 'Pending' },
      { resourceId: 'AP-5529', time: '11:15', patient: 'Fatima Al-Sayed', doctor: 'Dr. Bello', date: '2026-07-13', type: 'Emergency', status: 'Urgent' },
      { resourceId: 'AP-5533', time: '13:00', patient: 'James Okoro', doctor: 'Dr. Malik', date: '2026-07-14', type: 'Video', status: 'Pending' },
      { resourceId: 'AP-5540', time: '14:30', patient: 'Grace Wanjiru', doctor: 'Dr. Lin Wei', date: '2026-07-14', type: 'Video', status: 'Confirmed' },
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
    statusTones: { Interaction: 'rose', Allergy: 'amber', Refill: 'violet', Issued: 'green', Dispensed: 'blue' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'drug', label: 'Medication', type: 'strong' },
      { key: 'patient', label: 'Patient' },
      { key: 'doctor', label: 'Doctor', filter: true },
      { key: 'flag', label: 'Flag', filter: true },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'drug', label: 'Medication', type: 'text', required: true, full: true },
      { key: 'patient', label: 'Patient', type: 'text', required: true },
      { key: 'doctor', label: 'Doctor', type: 'text', required: true },
      { key: 'dosage', label: 'Dosage', type: 'text' },
      { key: 'flag', label: 'Flag', type: 'select', options: ['None', 'Interaction', 'Allergy', 'Generic offered'] },
      { key: 'status', label: 'Status', type: 'select', options: ['Issued', 'Interaction', 'Allergy', 'Refill', 'Dispensed'] },
    ],
    defaults: { status: 'Issued', flag: 'None' },
    kpis: [
      { label: 'Total', tone: 'rose', compute: (r) => r.length.toString() },
      { label: 'Interaction Alerts', tone: 'amber', compute: (r) => count(r, (x) => x.flag === 'Interaction').toString() },
      { label: 'Refills Pending', tone: 'violet', compute: (r) => byStatus(r, 'Refill').toString() },
      { label: 'Dispensed', tone: 'blue', compute: (r) => byStatus(r, 'Dispensed').toString() },
    ],
    actions: [
      { key: 'override', label: 'Approve', tone: 'green', when: (r) => r.status === 'Interaction' || r.status === 'Refill', patch: () => ({ status: 'Issued', flag: 'None' }), toast: 'Prescription approved & logged' },
      { key: 'dispense', label: 'Dispense', tone: 'blue', when: (r) => r.status === 'Issued', patch: () => ({ status: 'Dispensed' }), toast: 'Sent to pharmacy — QR verified' },
    ],
    seed: [
      { resourceId: 'RX-6612', drug: 'Warfarin 5mg', patient: 'Anika Rahman', doctor: 'Dr. Malik', dosage: 'OD', flag: 'Interaction', status: 'Interaction' },
      { resourceId: 'RX-6609', drug: 'Amoxicillin 500mg', patient: 'James Okoro', doctor: 'Dr. Malik', dosage: 'TDS', flag: 'Allergy', status: 'Allergy' },
      { resourceId: 'RX-6605', drug: 'Metformin 850mg', patient: 'Meera Iyer', doctor: 'Dr. Nair', dosage: 'BD', flag: 'None', status: 'Refill' },
      { resourceId: 'RX-6601', drug: 'Atorvastatin 20mg', patient: 'David Chen', doctor: 'Dr. Rossi', dosage: 'Nocte', flag: 'Generic offered', status: 'Issued' },
      { resourceId: 'RX-6598', drug: 'Levothyroxine 75mcg', patient: 'Meera Iyer', doctor: 'Dr. Nair', dosage: 'OD', flag: 'None', status: 'Dispensed' },
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
    statusTones: { Abnormal: 'rose', 'In lab': 'blue', 'Ready to approve': 'amber', Approved: 'green' },
    columns: [
      { key: 'resourceId', label: 'ID', type: 'ref' },
      { key: 'test', label: 'Test', type: 'strong' },
      { key: 'patient', label: 'Patient' },
      { key: 'result', label: 'Result', filter: true },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'test', label: 'Test', type: 'select', options: ['CBC', 'Lipid Profile', 'HbA1c', 'Thyroid Panel', 'Liver Function', 'Kidney Function', 'Urinalysis'], required: true },
      { key: 'patient', label: 'Patient', type: 'text', required: true },
      { key: 'result', label: 'Result summary', type: 'text', full: true },
      { key: 'status', label: 'Status', type: 'select', options: ['In lab', 'Ready to approve', 'Abnormal', 'Approved'] },
    ],
    defaults: { status: 'In lab', result: 'Processing', test: 'CBC' },
    kpis: [
      { label: 'Orders', tone: 'indigo', compute: (r) => r.length.toString() },
      { label: 'In Lab', tone: 'blue', compute: (r) => byStatus(r, 'In lab').toString() },
      { label: 'Abnormal', tone: 'rose', compute: (r) => byStatus(r, 'Abnormal').toString() },
      { label: 'Approved', tone: 'green', compute: (r) => byStatus(r, 'Approved').toString() },
    ],
    actions: [
      { key: 'approve', label: 'Approve', tone: 'green', when: (r) => r.status === 'Ready to approve' || r.status === 'Abnormal', patch: () => ({ status: 'Approved' }), toast: 'Result approved & released' },
    ],
    seed: [
      { resourceId: 'LAB-4471', test: 'CBC', patient: 'Anika Rahman', result: 'Hemoglobin low (9.1)', status: 'Abnormal' },
      { resourceId: 'LAB-4468', test: 'Lipid Profile', patient: 'David Chen', result: 'Within range', status: 'Ready to approve' },
      { resourceId: 'LAB-4465', test: 'HbA1c', patient: 'Meera Iyer', result: 'Elevated 8.2%', status: 'Abnormal' },
      { resourceId: 'LAB-4460', test: 'Thyroid Panel', patient: 'Fatima Al-Sayed', result: 'Processing', status: 'In lab' },
      { resourceId: 'LAB-4455', test: 'CBC', patient: 'James Okoro', result: 'Normal', status: 'Approved' },
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
      { key: 'batch', label: 'Batch' },
      { key: 'stock', label: 'Stock' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'name', label: 'Medicine', type: 'text', required: true, full: true },
      { key: 'batch', label: 'Batch no.', type: 'text' },
      { key: 'stock', label: 'Stock qty', type: 'number', required: true },
      { key: 'expiry', label: 'Expiry', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['In stock', 'Low stock', 'Expiring', 'Delivering'] },
    ],
    defaults: { status: 'In stock', stock: 100 },
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
      { resourceId: 'PH-8812', name: 'Atorvastatin 20mg', batch: 'B-4410', stock: 620, expiry: '2027-03-01', status: 'In stock' },
      { resourceId: 'PH-8809', name: 'Metformin 850mg', batch: 'B-4388', stock: 40, expiry: '2027-01-15', status: 'Delivering' },
      { resourceId: 'PH-8805', name: 'Amoxicillin 500mg', batch: 'B-2291', stock: 210, expiry: '2026-08-01', status: 'Expiring' },
      { resourceId: 'PH-8800', name: 'Insulin Glargine', batch: 'B-4102', stock: 18, expiry: '2026-11-20', status: 'Low stock' },
      { resourceId: 'PH-8795', name: 'Levothyroxine 75mcg', batch: 'B-4055', stock: 480, expiry: '2027-06-10', status: 'In stock' },
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
      { key: 'amount', label: 'Amount' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'party', label: 'Bill to', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'select', options: ['Consultation', 'Pharmacy', 'Laboratory', 'Insurance', 'Corporate'] },
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
      { resourceId: 'INV-2291', party: 'Anika Rahman', category: 'Consultation', amount: '$240', status: 'Submitted' },
      { resourceId: 'INV-2288', party: 'David Chen', category: 'Laboratory', amount: '$88', status: 'Paid' },
      { resourceId: 'CLM-1140', party: 'Meera Iyer', category: 'Insurance', amount: '$430', status: 'Fraud review' },
      { resourceId: 'INV-2280', party: 'Acme Ltd', category: 'Corporate', amount: '$12,400', status: 'Due' },
      { resourceId: 'INV-2275', party: 'James Okoro', category: 'Pharmacy', amount: '$54', status: 'Overdue' },
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
      { key: 'device', label: 'Device', filter: true },
      { key: 'reading', label: 'Reading' },
      { key: 'status', label: 'Status', type: 'pill', filter: true },
    ],
    formFields: [
      { key: 'patient', label: 'Patient', type: 'text', required: true },
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
    seed: [
      { resourceId: 'RPM-3391', patient: 'Anika Rahman', device: 'Pulse oximeter', reading: 'SpO₂ 88%', status: 'Critical' },
      { resourceId: 'RPM-3388', patient: 'James Okoro', device: 'BP monitor', reading: '168/104', status: 'High' },
      { resourceId: 'RPM-3385', patient: 'Meera Iyer', device: 'Glucose meter', reading: '42 mg/dL', status: 'Critical' },
      { resourceId: 'RPM-3380', patient: 'Fatima Al-Sayed', device: 'Wearable', reading: 'HR 118', status: 'Watch' },
      { resourceId: 'RPM-3375', patient: 'David Chen', device: 'Smart scale', reading: '82 kg', status: 'Stable' },
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

export const schemaMap = Object.fromEntries(schemas.map((s) => [s.key, s]))
