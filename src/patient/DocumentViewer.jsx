import { Download, ExternalLink } from 'lucide-react'
import Modal from '../components/ui/Modal.jsx'

/* In-app PDF viewer: the browser's built-in renderer inside a modal.
   Upgrade path per the architecture decision is PDF.js — same iframe slot,
   richer controls — without touching the pages that open this. */
export default function DocumentViewer({ doc, url, onClose }) {
  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      title={doc?.title}
      subtitle="Document"
      width={920}
      footer={
        doc && (
          <>
            <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
              <ExternalLink size={15} /> Open in new tab
            </a>
            <a className="btn btn-primary" href={url} download={doc.file}>
              <Download size={15} /> Download
            </a>
          </>
        )
      }
    >
      {doc && (
        <iframe
          title={doc.title}
          src={url}
          style={{
            width: '100%',
            height: '68vh',
            border: 'none',
            borderRadius: 10,
            background: '#525659',
          }}
        />
      )}
    </Modal>
  )
}
