# AITMS backend (NestJS)

The API gateway of the recommended architecture: Node.js owns users,
workflow, reports and permissions; **Orthanc** owns DICOM imaging (X-ray,
CT, MRI, ultrasound) behind DICOMweb; **MinIO** owns document blobs;
**PostgreSQL** owns metadata and audit.

## Run (development)

```bash
cd server
npm install
npm run dev          # builds and starts http://localhost:4000/api
```

The frontend dev server proxies `/api` here (see `vite.config.js`).

## What works today

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | liveness |
| `GET /api/documents/reports` | list PDFs in the repo's `Reports/` folder |
| `GET /api/documents/reports/:file` | stream one report PDF |
| `GET /api/documents/vaccines` | list PDFs in `Vaccine Card/` |
| `GET /api/documents/vaccines/:file` | stream one vaccine card |

The two folders are an interim stand-in for MinIO: the service layer is
written so swapping `fs` for S3 calls changes nothing above it.

## Infrastructure

```bash
docker compose up -d    # from the repo root
```

brings up PostgreSQL (5432), Orthanc PACS (8042 HTTP/DICOMweb, 4242 DICOM)
and MinIO (9000 API, 9001 console). Then activate the database schema:

```bash
cd server
npm i -D prisma && npm i @prisma/client
npx prisma migrate dev --name init
```

## Roadmap (per the architecture decision)

1. Prisma models live in `prisma/schema.prisma` — Patient / ImagingStudy /
   Document / VaccineRecord / AuditEvent. Pointers only; no blobs in Postgres.
2. DICOM upload: parse with `dcmjs`, STOW-RS into Orthanc, store the
   `StudyInstanceUID` against the patient.
3. Viewer: OHIF pointed at Orthanc's DICOMweb, proxied through this API so
   every image access passes permission checks and lands in `AuditEvent`.
4. Auth: Keycloak (OIDC) in front of everything before real patient data.
