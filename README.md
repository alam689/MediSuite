# MediSuite — AI-Powered Telemedicine Management System (Frontend)

A React frontend for the **AI-Powered Telemedicine Management System (AITMS)**, built
to the **DataMart Enterprise Suite** design system ("eye-comfort first": warm off-white
surfaces, calm teal brand, pastel module accents, full light/dark parity, token-driven CSS).

Content and module structure are derived from the product overview
(`AI-Powered Telemedicine Management System.docx`); the visual language is derived from
`DESIGN_CONTEXT from DMES.md`.

## Stack

- **React 18 + Vite**
- **react-router-dom** for routing
- **lucide-react** icons
- **WebGPU** (native API + WGSL compute shaders) for medical-image processing, as a
  progressive enhancement with a CPU fallback — see `src/lib/webgpu/`
- Theming via `ThemeContext` (`data-theme` on `<html>`, persisted to `localStorage['dm-theme']`,
  respects OS `prefers-color-scheme` on first visit)
- One global `src/styles/index.css` owns all design tokens + shared utilities; components
  ship scoped CSS that consumes only CSS variables (no hardcoded hex in components).

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
npm run preview  # preview the production build
```

The dev server honors a `PORT` env var if set, otherwise uses `5173`.

## What's included

Six stakeholders, one data store. Each signs in to its own workspace and works the same
records from its own side:

- **Patient** (`/patient`) — books, joins consultations, reads results, pays.
- **Doctor** (`/doctor`) — own caseload: schedule, queue, notes, prescribing, lab orders, earnings.
- **Hospital admin** (`/hospital`) — one facility's beds, admissions, bookings, practitioners,
  departments and revenue.
- **Pharmacy** (`/pharmacy`) — one dispensary's prescription queue, stock and deliveries.
- **Laboratory** (`/lab`) — one lab's sample intake, bench worklist and reporting.
- **Administrator** (`/app`) — the 16-module platform console below, unscoped.

Pick the role on the login screen. A **session** (`src/auth/AuthContext.jsx`) plus a
`<RequireRole>` guard keeps each role in its own workspace — typing another portal's URL
redirects to your own home. It is navigation, not authorization: the data still reaches the
browser, and only a server can fix that (blueprint §9.3).

### Work that crosses roles

The point of one store is that a handoff is a single record changing state, not a copy:

| Flow | Path |
|---|---|
| Prescription | doctor issues (with allergy/interaction check) → pharmacy verifies authenticity → dispenses, decrementing shelf stock → delivers → patient sees "Ready to collect" |
| Lab order | doctor orders → lab logs the sample and accessions it → bench enters analytes → **abnormal is derived from reference ranges, not typed** → doctor releases to the patient |
| Admission | hospital admits to a ward and bed → transfers → discharges; the ward board reconciles against the hand-maintained bed count and reports any disagreement |

Every portal carries a **notification bell** showing what is waiting on that role, on every
page rather than only its dashboard. Both the bell and the dashboard read the same builder in
`src/portal/notifications.js`, so a badge count and a page can never disagree. "Unread" is
tracked by item id, not by timestamp — most items are derived from record *state* and have no
moment of creation, so a prescription that has been on hold for a week would otherwise light
the bell up every session.

- **Login** — split-panel auth shell (teal brand panel with module chips + elevated form card),
  with a **six-role toggle** that signs in and routes to that role's workspace.
- **App shell** — 264px teal-gradient sidebar (collapsible to icon-only), glass topbar with
  search, theme toggle, reset-demo-data, notifications and profile.
- **Dashboard** — greeting header, **live** 4-up KPI strip, module grid, and a priority
  worklist pulled live from the data store (RPM alerts, drug interactions, flagged claims,
  live consults).
- **16 fully interactive modules** — Patients, Doctors, Telemedicine, Appointments, EMR/EHR,
  Prescriptions, Laboratory, Pharmacy, Bed Capacity, **Admissions**, **Departments**,
  Billing & Finance, Remote Monitoring, AI Platform, Analytics, Administration.

## Interactivity

A client-side data store (`src/store/DataStore.jsx`, React reducer + `localStorage`) gives
every module **real CRUD that persists across refresh**. Each module renders a config-driven
**Workspace** (`src/components/Workspace.jsx`) with two tabs plus any feature tabs:

- **Overview** — the **Function tiles** (each one interactive: clicking opens the relevant
  create form or feature tab), a **recent-records worklist**, and a live **Activity feed**.
- **Records** — the full data table.

Shared behaviour across every module:

- **Live KPIs** computed from the current records (they update as you add/edit/act).
- A **data table** (`ui/DataTable.jsx`) with search, column filters, sortable headers and pagination.
- **Create / Edit** via an auto-generated, validated form (fields declared per module in `data/schemas.js`),
  including **repeatable child records** where a schema declares `subforms` (add/remove rows for
  one-to-many data), a **photo** field (`type: 'image'`, downscaled client-side and stored as a data URL),
  and a **Documents** section (`hasDocuments: true`) for uploading and viewing files.
  - **Doctors** — full profile with **photo**, educational background, career start, repeatable
    **Degrees / Awards / Chambers & Timing**, and a **Documents** section (license, certificates).
  - **Patients** — **medical history**: repeatable **Medical History (conditions)**, **Visit History**,
    **Medications**, plus a **Documents** section for lab reports and scans.
  - Photos show as avatars in the table (initials fallback) and as a hero in the detail drawer.
  - Documents open in an in-app **viewer** (images inline, PDFs in a frame); upload/delete persist.
- A **detail drawer**, **delete confirm**, and per-module **status actions** (Verify, Approve,
  Confirm, Dispatch, Acknowledge, Sign-off…) that mutate records and raise **toasts**.
- An **activity log**: every mutation (create, status action, delete, admit, booking, ack…)
  appends a real entry to that module's Activity feed and the dashboard's aggregated feed.

Marquee modules add **signature feature tabs** (`src/features/`):

- **Telemedicine → Live Console** — waiting-room admit, video stage, working secure chat, and a
  **full-screen** mode (toggle in the console bar, Esc to exit) that fills the viewport for an
  immersive consultation. Ending a call requires **confirmation**; the call then moves to
  **Recently Ended** where it can be **resumed** — the doctor can resume directly, and if the
  patient requests to rejoin (simulated after a drop) the doctor must **Approve/Decline** — or
  marked **Complete** to finalize.
- **Telemedicine → Accessible Care** — inclusive consultation for **non-speaking / mute, Deaf,
  and Deaf-mute** patients:
  - communication-profile selector (Mute / Deaf / Deaf-mute / Hard of hearing);
  - **text-to-speech** so a mute patient's typed/tapped words are spoken to the clinician;
  - **live captions** of the clinician (real speech-to-text where supported, else typed captions);
  - **AAC quick-phrase board**, an emoji **picture/symbol board**, and an emoji **pain scale**;
  - **multi-language (English ⇄ বাংলা)** for the phrase/picture boards and spoken output;
  - **AI sign-language panel** — live camera that streams frames to a **configurable recognition
    model endpoint** (set in the UI or via `VITE_SIGN_RECOGNITION_URL`; persists to localStorage),
    with a clear **Not connected / Connected / Recognising / Error** status and manual-sign fallback.
    Contract: `POST { image, ts } → { gloss, confidence }`. Recognised glosses appear in the transcript;
  - **sign-language interpreter (VRI)** request and a **caregiver-present (with consent)** toggle;
  - an **accessible treatment/medication plan** (large text, morning/noon/night pictograms, read-aloud);
  - an **accessible consultation summary** generated in plain language with read-aloud, that can be
    **saved to the patient's record** — it renders as a document and appears (and is viewable) in that
    patient's **Documents** section.
- **Laboratory → Imaging Viewer** — a **WebGPU-accelerated** study viewer. A WGSL compute
  shader runs window/level, spatial filtering and colour mapping over the pixel buffer, one
  invocation per pixel:
  - **clinical window/level** — Brain / Soft tissue / Bone / Lung presets on the Hounsfield
    scale, plus sliders and click-drag windowing (drag = W/L, shift-drag = pan, scroll = zoom);
  - **filters** — Gaussian denoise, sharpen, Sobel edges; **colour maps** — grayscale, hot,
    bone, jet; invert;
  - **series navigation** — slice scrubber, cine playback, and **MIP** (maximum intensity
    projection) through the stack;
  - **segmentation + measurement** — density thresholding with connected-component region
    growing finds candidate regions (Lesion / Bone / CSF presets, adjustable density range and
    minimum region size). The mask is composited over the image as a **separate GPU layer**
    (translucent wash + solid outline), so the original pixels are never overwritten. Reports
    per-region diameter, area, mean density and centroid, plus an on-demand **volume across the
    whole series** (cm³). Carries the blueprint's human-review states (UNREVIEWED → ACCEPTED /
    REJECTED).

    **This is not AI and not a diagnosis.** It is deterministic intensity thresholding — it
    finds touching pixels in a density range and cannot distinguish a tumour from anything else
    of the same density. It is a measurement aid for a qualified clinician. A real detector
    (ONNX Runtime Web, blueprint §11.7) would produce the same mask shape and slot into the same
    overlay path, but must arrive with a validated intended use, a model version and an audit
    trail — see §17 and §17.5 (medical-device boundary);
  - **full screen** — fills the viewport for reading (Esc exits), same pattern as the console;
  - **load your own image** — decoded and processed entirely on-device, never uploaded;
  - **progressive enhancement, enforced** — WebGPU is optional. `useWebGpu` reports
    `checking / available / unavailable / lost`; when there is no GPU (or the device is lost
    mid-session, or you tick **Force CPU** to test the fallback) the identical CPU pipeline
    renders the same pixels and the status bar says which path is live;
  - **Verify vs CPU** — runs both pipelines on the same input and reports max/mean pixel delta
    against a documented tolerance, plus measured GPU vs CPU timings. On an Intel iGPU the GPU
    output is bit-identical (max Δ 0) at roughly 4–5× the speed.

  The demo study is a **generated phantom, not patient data** (`lib/webgpu/phantom.js`).
  Swapping in a real study means replacing that module with a DICOM parse in a Web Worker —
  the shader, processor and viewer are unchanged, since they only need
  `{ data, width, height, token }`. On-device AI inference (ONNX Runtime Web) is **not**
  included; it is a governed, separately-validated step.
- **Appointments → Book** — slot picker (shows taken slots) that creates real appointments + a day schedule.
- **Remote Monitoring → Live Monitor** — vitals that stream/tick live with sparklines + alert acknowledge.
- **AI Platform → AI Studio** — a guided Symptom Checker wizard and a rule-based Assistant chat.
- **Analytics → Insights** — interactive bar chart (7/14/30-day range) + a revenue-mix donut computed from Billing.

Use the **↺ reset** button in the topbar to restore the seeded demo data at any time.

## Hospital admin

Sign in with the **Hospital admin** role (`/hospital`). Scoped to **one facility** — or pick
**All clinics** for a group view across every site, for an admin who runs more than one. In group
view every row names its facility (the bed board groups by site, appointment rows carry a site
badge), because an aggregated ICU count with no hospital on it is worse than no count at all.

This is not the platform administrator. The Administration module is tenant-wide (users, roles, security, every
organisation); this desk sees its own site and nothing else. That scoping is the role, and it maps
to the blueprint's ABAC organisation dimension (§15.2). The current facility is pinned in the top
bar and named in the footer, because every number on every page is scoped to it.

- **Overview** — beds free, bookings, practitioners, stale counts, and a **needs attention** list
  ordered worst-first (urgent appointments → full units → stale bed counts → booking requests).
- **Beds & units** — the desk that feeds the patient-facing critical care search. Admit/discharge
  steppers, Open / Diverting / Closed per unit, and a **“Still correct”** button that re-stamps the
  timestamp without changing a number — because "is it still 3?" is usually answered "yes", and a
  patient needs to know someone *checked*, not just that nothing moved. Every write stamps
  `updatedAt`, since patients are shown how old each count is.
- **Appointments** — where a patient's booking request lands. **Confirm** lives here, not in the
  portal: the patient asks, the facility decides. Also check-in and cancel.
- **Practitioners** — add, update and remove the facility's roster:
  - **Add** an existing practitioner (the picker excludes anyone already here), or **register a
    new** one — created **In review**, because a facility cannot clear its own doctors' licences;
  - **Edit hours** — days are *picked, not typed*: the string feeds the patient booking calendar via
    `parseDays()`, so a typo would silently erase a doctor's availability. Writes back in the
    seed's own style ("Mon–Wed", "5:00 PM"), and only touches the chamber at *this* site — a
    doctor's other clinics are left alone;
  - **Remove** ends the chamber here only; the practitioner record and their other clinics survive,
    and existing bookings are not cancelled (the dialog says so).

  Roster editing is disabled in **All clinics** view — a doctor may sit at several sites, so "their
  hours" is ambiguous from a group view. Licence state is shown but **never editable here**: that's
  the platform admin's call, and a hospital signing off its own doctors' credentials is exactly what
  this separation prevents.

  The loop is real: hours typed here drive the patient's calendar. Give a doctor Fri/Sat 10–2 at a
  site and the patient booking calendar enables only Fri and Sat, offering 10:00–13:30.

**Demo simplification:** the scoping is a client-side filter. Real ABAC is a server decision — the
API must refuse to return another facility's records, because filtering in the browser means the
data was already sent (§9.3).

## Patient portal

Sign in with the **Patient** role (`/patient`). A calmer shell — short plain-language nav, larger
type, no 13-module sidebar — over the **same DataStore**, so the two sides are genuinely wired
together rather than mocked separately:

- **Home** — greeting, a live-consultation callout when a doctor is ready, next appointment,
  new results, outstanding balance, quick actions.
- **Find a doctor** — search and filter by **speciality and hospital**; each card shows where that
  doctor sits. Booking is *where → when → what time*:
  - **choose hospital / chamber** — from the doctor's own `chambers` (name, address, days, hours);
    doctors with none recorded are offered as an online consultation;
  - **month calendar** — with the days that hospital is actually open. Dr. Malik sits at Metro
    General Sun–Thu and HeartCare on Fridays, so picking HeartCare leaves only Fridays selectable;
    closed days say why on hover. Past days and anything beyond a 90-day horizon are unavailable;
  - **times generated from that chamber's opening hours** — Metro General (5–9 PM) offers
    17:00–20:30, HeartCare (10 AM–1 PM) offers 10:00–12:30. A fixed 9–5 list would offer slots at
    clinics that are shut. Times already taken are struck through.

  Booking creates a **real appointment** (carrying the chosen hospital) that appears in the
  clinician's Appointments module — as **Pending**, because a patient request is not a
  confirmation; a clinician confirms it.
- **Critical care** — search **ICU / CCU / HDU / NICU / PICU / ventilator (life support) / isolation**
  availability across facilities, by hospital or area, reading the clinician **Bed Capacity** module.
  Units sort available-first; each card shows free-of-total, an occupancy bar, and **how old the
  number is**, with anything over 30 minutes flagged as possibly out of date.

  This one is safety-sensitive, so it is built defensively:
  - a non-dismissible **emergency notice comes first** — call emergency services, don't plan a
    critical-care trip from a web page (§18.5);
  - **availability is derived** from total minus occupied, never a stored label, so the status can't
    contradict the numbers beside it. A unit can also be `Diverting` or `Closed` with beds free —
    that's an operational state, not a count;
  - the action on every card is **"Call to confirm"**, not "reserve". The platform cannot hold a
    critical-care bed, and a button implying otherwise would be a dangerous lie.

  Clinician side (**Bed Capacity**) has Admit / Discharge actions that adjust occupancy and stamp
  `updatedAt` — patients are told how fresh each number is, so it has to be true.
- **Consultation** — the patient side of the Live Console, sharing the same telemedicine records:
  check in → waiting room → admitted → in call, plus ask-to-rejoin after a drop. The **doctor
  admits; the patient cannot self-admit** — that asymmetry is enforced, not just styled. Leaving
  requires **confirmation**, as it does on the clinician side: a mis-tap ends the call for the
  doctor too, and the dialog says so. Media is simulated, matching the console.
- **My records** — summary (conditions, medication, allergies, visits), test results, visit notes,
  documents. Notes appear **only once signed** (an unsigned draft isn't the clinician's word yet),
  and clinician status vocabulary is translated to plain language ("Ready to approve" → "Awaiting
  doctor review").
- **Prescriptions** — with an explanation when a medicine is held for an allergy or interaction
  check. Refill requests are raised for the care team; the portal never changes a prescription.
- **Payments** — invoices and simulated payment (clearly labelled: a real build only marks an
  invoice paid on a signed server webhook, §22.2).
- **Profile** — details, dependents, and **consent** per §16.7: each purpose is separate (never one
  bundled "I agree"), and a decision is stored with its version, timestamp and author, not as a
  bare boolean. Includes a **demo identity switcher** (labelled as such) to view the portal as any
  seeded patient.

An **emergency disclaimer** is pinned to every patient page (§18.5), deliberately without inventing
a global emergency number.

**Demo simplifications, stated plainly:** records are linked by patient *name* (the seed has no
patient foreign key), and identity is chosen client-side. A real portal resolves identity from the
auth token to a patient id **server-side** and never lets the client pick whose records to read —
client-side hiding is not authorization (§9.3).

## Structure

```
src/
  main.jsx                 app entry (ThemeProvider → DataProvider → AuthProvider → ToastProvider → Router)
  App.jsx                  routes; each portal's scoping provider mounts inside its own guarded route
  theme/ThemeContext.jsx   light/dark theme + persistence
  store/DataStore.jsx      CRUD data store + localStorage persistence
  styles/index.css         design tokens + base + shared utilities
  auth/
    AuthContext.jsx        the session: role, identity, sign in/out; useScopedIdentity()
    RequireRole.jsx        route guard — no session → login, wrong role → your own home
  portal/                                    shared frame for doctor / pharmacy / lab
    PortalShell.jsx        brand, nav with badges, scope picker, sign-out, boundary footer
    NotificationBell.jsx   the bell — used by all five portals, tracks unread by item id
    notifications.js       "what needs you" per role, defined once; bell and dashboard both read it
    format.js              money, turnaround, out-of-range, first name
    portal.css             the `pf-` frame (one copy, not four)
  data/
    schemas.js             per-module interactive contract (columns, form, seed, KPIs, actions) — source of truth
    links.js               resolves the seeds' human names into patient/doctor ids; refuses to guess when ambiguous
    moduleContent.js       Function tiles + initial Activity feed per module (merged into schemas)
    modules.js             slim nav view derived from schemas
  components/
    AppShell.jsx  Sidebar.jsx  Topbar.jsx     authenticated shell
    Workspace.jsx                             generic interactive module page (table + CRUD + tabs)
    DeltaBadge.jsx  ThemeToggle.jsx  useAccent.js
    ui/                                        DataTable, Modal/Drawer, Toast, Tabs, Field, ui.css
    cards.css  shell.css  modulehome.css
  lib/
    webgpu/                                    GPU imaging pipeline (lazy-loaded)
      capability.js          feature detection — never throws, "unsupported" is a normal state
      shader.js              WGSL compute shader (window/level, filters, colour maps, mask overlay)
      processor.js           MedicalImageProcessor: WebGPU + CPU reference impls, comparator
      segmentation.js        region growing + measurements (deterministic, not AI, not diagnostic)
      phantom.js             synthetic CT volume, MIP, image import (no patient data)
      useWebGpu.js           device lifecycle as React state (incl. device-loss handling)
  features/                                    signature surfaces
    TelemedicineConsole.jsx  AppointmentBooking.jsx  RpmMonitor.jsx
    ImagingStudio.jsx        WebGPU imaging viewer (Laboratory → Imaging Viewer)
    AIStudio.jsx  AnalyticsInsights.jsx  features.css
  doctor/                                    doctor workspace (/doctor)
    DoctorContext.jsx        the signed-in clinician; mine() and the patient panel
    DoctorShell.jsx          nav with counts of work waiting on this doctor
    DoctorHome.jsx           "what needs me now", ordered by cost of being late
    DoctorSchedule.jsx  DoctorPatients.jsx  DoctorConsults.jsx
    DoctorNotes.jsx          write / sign; a signed note is locked
    DoctorPrescribe.jsx      allergy + interaction check before issue; override is recorded
    DoctorLabs.jsx           order tests, review reports, release results to the patient
    DoctorEarnings.jsx  DoctorProfile.jsx
  pharmacy/                                  dispensary (/pharmacy)
    PharmacyContext.jsx      branch scope; open / blocked / in-transit / closed buckets
    PharmacyShell.jsx  PharmacyHome.jsx
    PharmacyQueue.jsx        authenticity checks (no override), dispense, substitute, reject
    PharmacyInventory.jsx    stock, reorder levels, expiry — expiry outranks quantity
    PharmacyDeliveries.jsx   packed → dispatched → delivered
  lab/                                       diagnostic centre (/lab)
    LabContext.jsx           lab scope, stage buckets, STAT-first ordering
    LabShell.jsx  LabHome.jsx
    LabOrders.jsx            sample collection + accession, sample rejection
    LabBench.jsx             analyte entry with reference ranges; abnormal is derived
    LabReports.jsx           released reports + median turnaround
  hospital/                                  hospital admin desk (/hospital)
    HospitalContext.jsx      the one facility this admin runs; scopes every page
    HospitalShell.jsx        nav + always-visible facility scope
    HospitalHome.jsx  HospitalBeds.jsx  HospitalAppointments.jsx  HospitalStaff.jsx
    HospitalAdmissions.jsx   ward board; reconciles against the hand-kept bed count
    HospitalDepartments.jsx  departments, heads of unit, service catalogue & tariffs
    HospitalRevenue.jsx      facility billing — collected and billed kept apart
    hospital.css
  patient/                                   patient portal (/patient)
    PatientContext.jsx       who is signed in; filters the shared store by patient
    PatientShell.jsx         patient nav + emergency footer
    PatientHome.jsx  FindDoctor.jsx  BedSearch.jsx  MyConsult.jsx
    Calendar.jsx  SearchSelect.jsx   month picker + searchable dropdown (combobox)
    MyRecords.jsx  MyPrescriptions.jsx  MyPayments.jsx  MyProfile.jsx
    helpers.js               local-date handling, doctor-name resolution, plain-language text
    patient.css
  pages/
    Login.jsx  Dashboard.jsx  (+ login.css, dashboard.css)
```

## Notes

- This is a **frontend demo build**: authentication and data are mocked. Any credentials on the
  login screen continue to that role's workspace. Wire the panels to the backend API
  (Django + DRF per the product spec) to make it live.
- **The role guard is not security.** It stops a user wandering into the wrong workspace; every
  portal still filters records in the browser, which means the data was already sent. Real
  authorization is the API refusing to answer (blueprint §9.3, §15.2). Three places state a
  limitation rather than hide it, and each should be replaced before any real use: the
  prescribing interaction check is a short demonstration list, not a drug database; prescription
  validity is one constant for every drug class; laboratory reference ranges are illustrative
  adult intervals rather than the analyser's own.
- **Credential verification stays with the platform administrator.** A facility can onboard a
  practitioner (Practitioners → Add) but cannot verify their own doctors' licences — that
  separation is deliberate and predates this work.
- To add a module: add an entry to `src/data/modules.js` (pick/extend a module accent) and it
  automatically appears in the sidebar with a fully-rendered module home. Primary actions stay teal.
```
