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

- **Login** — split-panel auth shell (teal brand panel with module chips + elevated form card).
- **App shell** — 264px teal-gradient sidebar (collapsible to icon-only), glass topbar with
  search, theme toggle, reset-demo-data, notifications and profile.
- **Dashboard** — greeting header, **live** 4-up KPI strip, module grid, and a priority
  worklist pulled live from the data store (RPM alerts, drug interactions, flagged claims,
  live consults).
- **13 fully interactive modules** — Patients, Doctors, Telemedicine, Appointments, EMR/EHR,
  Prescriptions, Laboratory, Pharmacy, Billing & Finance, Remote Monitoring, AI Platform,
  Analytics, Administration.

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
- **Appointments → Book** — slot picker (shows taken slots) that creates real appointments + a day schedule.
- **Remote Monitoring → Live Monitor** — vitals that stream/tick live with sparklines + alert acknowledge.
- **AI Platform → AI Studio** — a guided Symptom Checker wizard and a rule-based Assistant chat.
- **Analytics → Insights** — interactive bar chart (7/14/30-day range) + a revenue-mix donut computed from Billing.

Use the **↺ reset** button in the topbar to restore the seeded demo data at any time.

## Structure

```
src/
  main.jsx                 app entry (ThemeProvider → DataProvider → ToastProvider → Router)
  App.jsx                  routes
  theme/ThemeContext.jsx   light/dark theme + persistence
  store/DataStore.jsx      CRUD data store + localStorage persistence
  styles/index.css         design tokens + base + shared utilities
  data/
    schemas.js             per-module interactive contract (columns, form, seed, KPIs, actions) — source of truth
    moduleContent.js       Function tiles + initial Activity feed per module (merged into schemas)
    modules.js             slim nav view derived from schemas
  components/
    AppShell.jsx  Sidebar.jsx  Topbar.jsx     authenticated shell
    Workspace.jsx                             generic interactive module page (table + CRUD + tabs)
    DeltaBadge.jsx  ThemeToggle.jsx  useAccent.js
    ui/                                        DataTable, Modal/Drawer, Toast, Tabs, Field, ui.css
    cards.css  shell.css  modulehome.css
  features/                                    signature surfaces
    TelemedicineConsole.jsx  AppointmentBooking.jsx  RpmMonitor.jsx
    AIStudio.jsx  AnalyticsInsights.jsx  features.css
  pages/
    Login.jsx  Dashboard.jsx  (+ login.css, dashboard.css)
```

## Notes

- This is a **frontend demo build**: authentication and data are mocked. Any credentials on the
  login screen continue to the dashboard. Wire the panels to the backend API
  (Django + DRF per the product spec) to make it live.
- To add a module: add an entry to `src/data/modules.js` (pick/extend a module accent) and it
  automatically appears in the sidebar with a fully-rendered module home. Primary actions stay teal.
```
