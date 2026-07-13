/* =====================================================================
   Per-module Function tiles + initial Activity feed entries.
   Merged onto the schemas at load time (see schemas.js). Tiles are
   interactive: `go` tells the Workspace where a click should take you
   ('create' opens the new-record form, a feature key opens that tab,
   'records' focuses the table).
   ===================================================================== */
import {
  Users,
  Stethoscope,
  Video,
  CalendarClock,
  CalendarPlus,
  FileText,
  Pill,
  FlaskConical,
  Store,
  Wallet,
  Activity,
  Sparkles,
  BarChart3,
  ShieldCheck,
  ListChecks,
} from 'lucide-react'

export const content = {
  patients: {
    tiles: [
      { icon: Users, title: 'Registration & Profiles', desc: 'Onboard patients and manage digital profiles.', count: 'New patient', go: 'create' },
      { icon: FileText, title: 'Medical & Family History', desc: 'Longitudinal history, allergies and lifestyle.', count: 'Open records', go: 'records' },
      { icon: ShieldCheck, title: 'Consent Management', desc: 'Capture and verify consent for care and data.', count: 'Review', go: 'records' },
      { icon: Activity, title: 'Health Timeline', desc: 'Chronological view of every clinical event.', count: 'View', go: 'records' },
    ],
    feed: [
      { title: 'Consent verified', sub: 'PT-90418 · James Okoro', minsAgo: 8 },
      { title: 'Allergy record updated', sub: 'PT-88120 · penicillin flagged', minsAgo: 31 },
      { title: 'Insurance info verified', sub: 'PT-90418 · policy active', minsAgo: 62 },
      { title: 'Emergency contact added', sub: 'PT-90388', minsAgo: 120 },
    ],
  },
  doctors: {
    tiles: [
      { icon: Stethoscope, title: 'Registration & Licensing', desc: 'Onboard doctors with license verification.', count: 'Add doctor', go: 'create' },
      { icon: CalendarClock, title: 'Schedules & Leave', desc: 'Schedules, leave and multi-hospital practice.', count: 'Manage', go: 'records' },
      { icon: BarChart3, title: 'Performance Dashboard', desc: 'Consultations, ratings and outcomes.', count: 'View', go: 'records' },
      { icon: Wallet, title: 'Revenue Dashboard', desc: 'Per-doctor earnings and payouts.', count: 'This month', go: 'records' },
    ],
    feed: [
      { title: 'License verified', sub: 'Dr. Lin Wei', minsAgo: 12 },
      { title: 'Schedule published', sub: 'Dr. Malik · next week', minsAgo: 44 },
      { title: 'Leave approved', sub: 'Dr. Farah · 2 days', minsAgo: 70 },
      { title: 'New specialization added', sub: 'Sports Medicine', minsAgo: 180 },
    ],
  },
  telemedicine: {
    tiles: [
      { icon: Video, title: 'Live Console', desc: 'Admit patients, video, audio and screen share.', count: 'Open console', go: 'console' },
      { icon: Users, title: 'Waiting Room & Queue', desc: 'Virtual waiting room with smart routing.', count: 'Manage', go: 'console' },
      { icon: FileText, title: 'Secure Messaging', desc: 'Encrypted chat, image and file sharing.', count: 'E2E encrypted', go: 'console' },
      { icon: CalendarPlus, title: 'New Consultation', desc: 'Queue a new video, audio or chat session.', count: 'Create', go: 'create' },
    ],
    feed: [
      { title: 'Session started', sub: 'CS-7781 · HD video', minsAgo: 1 },
      { title: 'File shared in consult', sub: 'CS-7778 · lab.pdf', minsAgo: 3 },
      { title: 'Recording saved', sub: 'CS-7772 · consented', minsAgo: 18 },
      { title: 'Patient joined waiting room', sub: 'PT-90455', minsAgo: 22 },
    ],
  },
  appointments: {
    tiles: [
      { icon: CalendarPlus, title: 'Book Appointment', desc: 'Pick a slot and confirm instantly.', count: 'Book', go: 'booking' },
      { icon: Sparkles, title: 'AI Queue Optimization', desc: 'Smart scheduling that balances load.', count: 'Enabled', go: 'records' },
      { icon: Video, title: 'Reminders', desc: 'SMS, email and WhatsApp reminders.', count: 'Automated', go: 'records' },
      { icon: Activity, title: 'Emergency Appointments', desc: 'Priority slotting for urgent cases.', count: 'Open slots', go: 'create' },
    ],
    feed: [
      { title: 'Appointment confirmed', sub: 'AP-5521 · reminder sent', minsAgo: 5 },
      { title: 'WhatsApp reminder delivered', sub: 'AP-5522', minsAgo: 20 },
      { title: 'Emergency slot filled', sub: 'AP-5529 · Dr. Bello', minsAgo: 35 },
      { title: 'Appointment rescheduled', sub: 'AP-5501 → tomorrow 14:00', minsAgo: 90 },
    ],
  },
  emr: {
    tiles: [
      { icon: FileText, title: 'Clinical Notes & SOAP', desc: 'Structured notes with AI-drafted summaries.', count: 'New note', go: 'create' },
      { icon: Activity, title: 'Vitals & Diagnoses', desc: 'Vital signs, problem lists and coding.', count: 'Open', go: 'records' },
      { icon: FlaskConical, title: 'Reports & Documents', desc: 'Lab, radiology, surgical and imaging.', count: 'Linked', go: 'records' },
      { icon: Sparkles, title: 'AI Diagnosis Support', desc: 'Highlights possible diagnoses from data.', count: 'Assist mode', go: 'records' },
    ],
    feed: [
      { title: 'SOAP note generated', sub: 'EMR-3391 · from transcript', minsAgo: 4 },
      { title: 'Vitals recorded', sub: 'PT-90421 · BP 128/82', minsAgo: 19 },
      { title: 'Radiology report linked', sub: 'PT-88342 · chest CT', minsAgo: 52 },
      { title: 'Chart signed off', sub: 'EMR-3372 · Dr. Chen', minsAgo: 75 },
    ],
  },
  prescriptions: {
    tiles: [
      { icon: Pill, title: 'Prescription Writer', desc: 'Digital signature, dosage and PDF export.', count: 'New Rx', go: 'create' },
      { icon: Sparkles, title: 'Drug Interaction Detection', desc: 'Alerts to unsafe combinations.', count: 'Review', go: 'records' },
      { icon: ShieldCheck, title: 'Allergy Alerts', desc: 'Cross-checks allergy records in real time.', count: 'Active', go: 'records' },
      { icon: Store, title: 'Refill Management', desc: 'Refill requests, approvals and QR verify.', count: 'Pending', go: 'records' },
    ],
    feed: [
      { title: 'Interaction override logged', sub: 'RX-6612 · doctor confirmed', minsAgo: 6 },
      { title: 'Refill approved', sub: 'RX-6598 · Dr. Iyer', minsAgo: 24 },
      { title: 'Script dispensed', sub: 'RX-6590 · QR verified', minsAgo: 40 },
      { title: 'Generic substituted', sub: 'RX-6585', minsAgo: 88 },
    ],
  },
  laboratory: {
    tiles: [
      { icon: FlaskConical, title: 'Test Orders & Sampling', desc: 'Orders, barcode labels and tracking.', count: 'New order', go: 'create' },
      { icon: Activity, title: 'Analyzer Integration', desc: 'Automated result capture from analyzers.', count: 'Auto', go: 'records' },
      { icon: Sparkles, title: 'AI Report Analysis', desc: 'Identifies abnormal values and trends.', count: 'Flagged', go: 'records' },
      { icon: ShieldCheck, title: 'Report Approval', desc: 'Pathologist review and sign-off.', count: 'Queue', go: 'records' },
    ],
    feed: [
      { title: 'AI flagged abnormal CBC', sub: 'LAB-4471 · Hgb 9.1', minsAgo: 7 },
      { title: 'Result approved', sub: 'LAB-4455 · Dr. Path', minsAgo: 28 },
      { title: 'Sample received', sub: 'LAB-4472 · barcode scan', minsAgo: 45 },
      { title: 'Analyzer result imported', sub: 'LAB-4450', minsAgo: 100 },
    ],
  },
  pharmacy: {
    tiles: [
      { icon: Store, title: 'Inventory & Batches', desc: 'Stock, batch tracking and expiry alerts.', count: 'Add item', go: 'create' },
      { icon: Pill, title: 'Prescription Integration', desc: 'Fills e-prescriptions with generics.', count: 'Linked', go: 'records' },
      { icon: Activity, title: 'Home Delivery', desc: 'Order fulfilment and delivery tracking.', count: 'Active', go: 'records' },
      { icon: Wallet, title: 'Online Payment', desc: 'Integrated checkout and reconciliation.', count: 'Online', go: 'records' },
    ],
    feed: [
      { title: 'Reorder raised', sub: 'Insulin Glargine ×200', minsAgo: 9 },
      { title: 'Delivery dispatched', sub: 'PH-8809 · PT-90410', minsAgo: 26 },
      { title: 'Expiry alert', sub: 'Batch B-2291 · 21 days', minsAgo: 48 },
      { title: 'Payment received', sub: 'PH-8801 · online', minsAgo: 95 },
    ],
  },
  billing: {
    tiles: [
      { icon: Wallet, title: 'Billing & Payments', desc: 'Consultation, pharmacy, lab and mobile pay.', count: 'New invoice', go: 'create' },
      { icon: ShieldCheck, title: 'Insurance Claims', desc: 'Submission, tracking and reconciliation.', count: 'Pending', go: 'records' },
      { icon: Sparkles, title: 'Fraud Detection', desc: 'Detects suspicious billing activity.', count: 'Flags', go: 'records' },
      { icon: BarChart3, title: 'Revenue Reports', desc: 'Financial dashboards and corporate billing.', count: 'Live', go: 'records' },
    ],
    feed: [
      { title: 'AI flagged claim', sub: 'CLM-1140 · duplicate pattern', minsAgo: 11 },
      { title: 'Payment settled', sub: 'INV-2288 · $88', minsAgo: 33 },
      { title: 'Claim approved', sub: 'CLM-1132 · $180', minsAgo: 57 },
      { title: 'Subscription renewed', sub: 'Clinic plan · annual', minsAgo: 130 },
    ],
  },
  rpm: {
    tiles: [
      { icon: Activity, title: 'Live Vitals', desc: 'BP, HR, glucose, SpO₂, temperature, weight.', count: 'Open monitor', go: 'monitor' },
      { icon: Sparkles, title: 'Health Risk Prediction', desc: 'Predicts deterioration from device data.', count: 'Flagged', go: 'records' },
      { icon: ShieldCheck, title: 'Critical Alerts', desc: 'Threshold and anomaly escalations.', count: 'Active', go: 'monitor' },
      { icon: BarChart3, title: 'Device & Adherence', desc: 'Enrollment, connectivity and usage.', count: 'Enroll', go: 'create' },
    ],
    feed: [
      { title: 'Critical SpO₂ alert', sub: 'RPM-3391 · care team paged', minsAgo: 1 },
      { title: 'Risk score rose', sub: 'PT-88342 · hypertension', minsAgo: 14 },
      { title: 'New device paired', sub: 'PT-90455 · smart scale', minsAgo: 38 },
      { title: 'Alert resolved', sub: 'RPM-3370', minsAgo: 80 },
    ],
  },
  ai: {
    tiles: [
      { icon: Sparkles, title: 'Symptom Checker', desc: 'Guided triage with severity and routing.', count: 'Open studio', go: 'ai' },
      { icon: FileText, title: 'Medical Assistant', desc: 'Speech-to-text, SOAP notes, Rx drafting.', count: 'Assistant', go: 'ai' },
      { icon: Activity, title: 'Imaging & Pathology', desc: 'X-ray, CT, MRI and lab interpretation.', count: 'Review', go: 'records' },
      { icon: BarChart3, title: 'Predictive Models', desc: 'Diabetes, cardiac, sepsis, readmission.', count: 'Validated', go: 'records' },
    ],
    feed: [
      { title: 'Imaging model result', sub: 'AI-7791 · flagged for review', minsAgo: 3 },
      { title: 'Risk model run', sub: 'PT-88342 · sepsis 0.79', minsAgo: 17 },
      { title: 'Note accepted by doctor', sub: 'AI-7770 · Dr. Chen', minsAgo: 41 },
      { title: 'Chatbot booked appointment', sub: 'PT-90455', minsAgo: 96 },
    ],
  },
  analytics: {
    tiles: [
      { icon: BarChart3, title: 'Operational Dashboards', desc: 'Patients, doctors, volume, revenue, CSAT.', count: 'Open insights', go: 'insights' },
      { icon: Sparkles, title: 'Predictive Analytics', desc: 'Forecast volume, occupancy, ICU, workload.', count: '72h horizon', go: 'insights' },
      { icon: Activity, title: 'Disease Trends', desc: 'Seasonal and population health trends.', count: 'Updated', go: 'records' },
      { icon: Wallet, title: 'Financial Insights', desc: 'Revenue mix, margins and consumption.', count: 'New report', go: 'create' },
    ],
    feed: [
      { title: 'ICU demand forecast updated', sub: 'Peak 86% · 72h out', minsAgo: 10 },
      { title: 'Seasonal trend detected', sub: 'Respiratory · region A', minsAgo: 30 },
      { title: 'Revenue milestone', sub: 'MTD crossed $4.8M', minsAgo: 60 },
      { title: 'Doctor workload rebalanced', sub: 'Cardiology', minsAgo: 140 },
    ],
  },
  admin: {
    tiles: [
      { icon: ShieldCheck, title: 'Tenant & User Management', desc: 'Hospitals, roles and access control.', count: 'New task', go: 'create' },
      { icon: Wallet, title: 'Pricing Plans', desc: 'Editions, subscriptions and white-label.', count: 'Configure', go: 'records' },
      { icon: Sparkles, title: 'AI Monitoring', desc: 'Model usage, drift and confidence.', count: 'Live', go: 'records' },
      { icon: ListChecks, title: 'Audit Logs', desc: 'Immutable audit trail and compliance.', count: 'View', go: 'records' },
    ],
    feed: [
      { title: 'MFA enforced for tenant', sub: 'Sunrise Clinic', minsAgo: 15 },
      { title: 'Backup completed', sub: 'All tenants · encrypted', minsAgo: 46 },
      { title: 'Role granted', sub: 'Lab Manager · J. Okoro', minsAgo: 70 },
      { title: 'Incident closed', sub: 'SYS-435', minsAgo: 160 },
    ],
  },
}
