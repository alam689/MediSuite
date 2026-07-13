/* =====================================================================
   File helpers for client-side photo & document handling.
   Images are downscaled before storage so base64 data URLs stay small
   enough for localStorage. Non-images are kept as-is (with a size cap).
   ===================================================================== */

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/* Downscale an image file to `max` px on its longest edge → JPEG data URL. */
export async function imageToDataUrl(file, max = 320, quality = 0.82) {
  const src = await fileToDataUrl(file)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch {
        resolve(src) // e.g. tainted canvas — fall back to original
      }
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}

export function formatBytes(n) {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function relTimeUtil(ts) {
  if (!ts) return ''
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function docKind(file) {
  const type = file.type || ''
  if (type.startsWith('image/')) return 'image'
  if (type === 'application/pdf') return 'pdf'
  return 'file'
}

/* Initials for an avatar fallback, ignoring a leading "Dr." honorific. */
export function initialsOf(name = '') {
  const parts = name
    .split(/\s+/)
    .filter((w) => w && !/^dr\.?$/i.test(w))
  const letters = parts.map((w) => w[0]).join('')
  return (letters || name[0] || '?').slice(0, 2).toUpperCase()
}
