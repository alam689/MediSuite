import { useRef } from 'react'
import { Upload, Eye, Trash2, FileText, FileImage, File as FileIcon } from 'lucide-react'
import { formatBytes, relTimeUtil } from '../../utils/files.js'

const kindIcon = { image: FileImage, pdf: FileText, file: FileIcon }

/* Presentational documents list with upload / view / delete controls. */
export default function DocumentsPanel({ documents = [], onUpload, onView, onDelete }) {
  const ref = useRef(null)

  const pick = () => ref.current?.click()
  const onFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onUpload(file)
  }

  return (
    <div className="docs">
      <div className="docs-head">
        <span className="section-label">Documents</span>
        <button type="button" className="mini-btn accent" onClick={pick}>
          <Upload size={13} /> Upload
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*,application/pdf"
          hidden
          onChange={onFile}
        />
      </div>

      {documents.length === 0 ? (
        <p className="docs-empty">No documents yet. Upload lab reports, scans or PDFs.</p>
      ) : (
        <div className="docs-list">
          {documents.map((d) => {
            const Icon = kindIcon[d.kind] || FileIcon
            return (
              <div className="doc-row" key={d.id}>
                <span className={`doc-icon kind-${d.kind}`}>
                  <Icon size={17} />
                </span>
                <div className="doc-info">
                  <div className="doc-name">{d.name}</div>
                  <div className="doc-meta">
                    {d.type} · {formatBytes(d.size)} · {relTimeUtil(d.uploadedAt)}
                  </div>
                </div>
                <button className="mini-btn accent" onClick={() => onView(d)}>
                  <Eye size={13} /> View
                </button>
                <button className="subform-del" onClick={() => onDelete(d)} aria-label="Delete document">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
