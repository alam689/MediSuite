import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { createReadStream, existsSync, promises as fs } from 'fs'
import * as path from 'path'

/* =====================================================================
   Patient documents, served from folders on disk.

   This is the interim storage tier of the recommended architecture: the
   folders stand in for MinIO until the object store is wired up, at which
   point this service swaps its fs calls for S3 calls and nothing above it
   changes. DICOM studies never come through here — those belong to
   Orthanc/DICOMweb (see docker-compose.yml).

   Category → folder is a fixed allowlist. Nothing outside these two
   folders is reachable through this API, whatever the request says.
   ===================================================================== */

const CATEGORIES: Record<string, { dir: string; label: string }> = {
  reports: { dir: 'Reports', label: 'Medical reports' },
  vaccines: { dir: 'Vaccine Card', label: 'Vaccine cards' },
}

export interface DocumentEntry {
  file: string
  title: string
  size: number
  modified: string
  /* From the folder's optional report-meta.json sidecar: */
  status?: 'normal' | 'attention'
  takenDate?: string
  note?: string
}

/* Optional per-folder sidecar: { "<filename>.pdf": { status, takenDate, note } }.
   This is how a clinician records "no issues / needs discussion" against a
   report until the PostgreSQL Document table takes over — the UI never
   invents a status on its own. */
async function readMeta(dir: string): Promise<Record<string, Partial<DocumentEntry>>> {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, 'report-meta.json'), 'utf8'))
  } catch {
    return {}
  }
}

/* "CBC  2023-04-07.pdf" → "CBC 2023-04-07" — display name, nothing more. */
function prettyTitle(file: string) {
  return file
    .replace(/\.pdf$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

@Injectable()
export class DocumentsService {
  /* Repo root: dist/documents → dist → server → repo. Override with
     DOCS_ROOT when the folders live elsewhere (e.g. a mounted volume). */
  private root = process.env.DOCS_ROOT || path.resolve(__dirname, '..', '..', '..')

  private dirFor(category: string) {
    const cat = CATEGORIES[category]
    if (!cat) throw new NotFoundException(`Unknown document category "${category}"`)
    return path.join(this.root, cat.dir)
  }

  async list(category: string): Promise<DocumentEntry[]> {
    const dir = this.dirFor(category)
    let names: string[]
    try {
      names = await fs.readdir(dir)
    } catch {
      // Folder missing is an empty shelf, not a server error.
      return []
    }
    const meta = await readMeta(dir)
    const out: DocumentEntry[] = []
    for (const name of names) {
      if (!/\.pdf$/i.test(name)) continue
      const st = await fs.stat(path.join(dir, name))
      if (!st.isFile()) continue
      const m = meta[name] || {}
      out.push({
        file: name,
        title: prettyTitle(name),
        size: st.size,
        modified: st.mtime.toISOString(),
        ...(m.status === 'normal' || m.status === 'attention' ? { status: m.status } : {}),
        ...(m.takenDate ? { takenDate: String(m.takenDate) } : {}),
        ...(m.note ? { note: String(m.note) } : {}),
      })
    }
    return out.sort((a, b) => a.title.localeCompare(b.title))
  }

  /* Resolve a requested filename to a real path, refusing anything that is
     not a plain PDF name sitting directly inside the category folder. */
  async resolve(category: string, file: string) {
    if (file !== path.basename(file) || file.includes('..') || !/\.pdf$/i.test(file)) {
      throw new BadRequestException('Invalid document name')
    }
    const dir = this.dirFor(category)
    const full = path.join(dir, file)
    try {
      const st = await fs.stat(full)
      if (!st.isFile()) throw new Error()
      return { full, size: st.size }
    } catch {
      throw new NotFoundException(`No such document: ${file}`)
    }
  }

  stream(fullPath: string) {
    return createReadStream(fullPath)
  }

  /* Store an uploaded PDF into the category folder. Never overwrites: a
     name clash gets a " (2)" suffix — silently replacing a medical report
     someone else can see is not acceptable. Checks the magic bytes, not
     just the extension. */
  async save(category: string, file?: { originalname?: string; buffer?: Buffer; size?: number }) {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded')
    const name = path.basename(file.originalname || 'document.pdf').replace(/[<>:"/\\|?*]/g, ' ').trim()
    if (!/\.pdf$/i.test(name)) throw new BadRequestException('Only PDF files are accepted')
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new BadRequestException('The file is not a valid PDF')
    }
    const dir = this.dirFor(category)
    await fs.mkdir(dir, { recursive: true })
    let target = name
    for (let i = 2; existsSync(path.join(dir, target)); i++) {
      target = name.replace(/\.pdf$/i, ` (${i}).pdf`)
    }
    await fs.writeFile(path.join(dir, target), file.buffer)
    return { ok: true, file: target }
  }
}
