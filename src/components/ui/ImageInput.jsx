import { useRef } from 'react'
import { Upload, User, X } from 'lucide-react'
import { imageToDataUrl } from '../../utils/files.js'

/* Photo picker with live preview. Stores a downscaled JPEG data URL. */
export default function ImageInput({ value, onChange, onError }) {
  const ref = useRef(null)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onError?.('Please choose an image file')
      return
    }
    const dataUrl = await imageToDataUrl(file, 320)
    onChange(dataUrl)
  }

  return (
    <div className="img-input">
      <div className="img-preview">
        {value ? <img src={value} alt="preview" /> : <User size={26} />}
      </div>
      <div className="img-actions">
        <button type="button" className="mini-btn accent" onClick={() => ref.current?.click()}>
          <Upload size={13} /> {value ? 'Change photo' : 'Upload photo'}
        </button>
        {value && (
          <button type="button" className="mini-btn" onClick={() => onChange('')}>
            <X size={13} /> Remove
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  )
}
