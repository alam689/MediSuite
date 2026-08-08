import { useDoctor } from '../DoctorContext.jsx'
import { usePad } from './PadContext.jsx'

/* The letterhead on the pad and the printed sheet. Unlike the standalone
   prescription-pad app this was ported from — which hard-coded one doctor —
   the header is built from the signed-in doctor's own profile record, so it
   follows whoever is prescribing and updates when they edit their profile.

   The doctor can also overwrite the generated text from the layout wizard's
   Header step (contentEditable columns); the override persists per browser
   and wins over the profile until "Reset to profile". */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* Belt-and-braces for the stored override: it is self-authored, but it is
   also re-rendered from localStorage on every load, so strip anything
   executable that could ride along in a paste. */
export const sanitizeHeaderHtml = (h) =>
  String(h)
    .replace(/<(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '')

/* The profile-derived letterhead as HTML — the same markup the JSX used to
   render, so the editable copy and the printed sheet stay identical. */
export function autoHeaderHtml(me, name) {
  const degrees = (me?.degrees || [])
    .map((d) => [d.degree, d.institution].filter(Boolean).join(', '))
    .filter(Boolean)
  const chamber = (me?.chambers || [])[0]
  const left = [
    `<h1>${esc((me?.name || name || '').toUpperCase())}</h1>`,
    ...degrees.map((l) => `<p>${esc(l)}</p>`),
    me?.specialization ? `<p class="doc-spec">${esc(me.specialization)} Specialist</p>` : '',
    me?.license ? `<p class="doc-reg">Reg. No: ${esc(me.license)}</p>` : '',
  ].filter(Boolean).join('')
  const right = [
    '<h1>MediSuite</h1>',
    '<p class="doc-spec">AI-Powered Telemedicine</p>',
    chamber ? `<p>${esc(chamber.name)}</p>` : '',
    chamber?.address ? `<p>${esc(chamber.address)}</p>` : '',
    chamber?.days ? `<p>${esc(chamber.days)} · ${esc(chamber.from)}–${esc(chamber.to)}</p>` : '',
    me?.phone ? `<p>${esc(me.phone)}</p>` : '',
    me?.email ? `<p>${esc(me.email)}</p>` : '',
  ].filter(Boolean).join('')
  return { left, right }
}

/* Editable mode (layout wizard): the columns are uncontrolled contentEditable
   surfaces seeded once from `seed`; keystrokes accumulate in `editRef.current`
   and the wizard decides when to persist them. */
export default function PadHeader({ editable = false, seed, editRef }) {
  const { me, name } = useDoctor()
  const { headerHtml } = usePad()

  if (editable) {
    return (
      <div className="doc-header editing">
        <div
          className="doc-id"
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: seed.left }}
          onInput={(e) => { editRef.current.left = e.currentTarget.innerHTML }}
        />
        <div
          className="doc-org"
          contentEditable
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: seed.right }}
          onInput={(e) => { editRef.current.right = e.currentTarget.innerHTML }}
        />
      </div>
    )
  }

  const auto = autoHeaderHtml(me, name)
  return (
    <div className="doc-header">
      <div className="doc-id" dangerouslySetInnerHTML={{ __html: headerHtml?.left ?? auto.left }} />
      <div className="doc-org" dangerouslySetInnerHTML={{ __html: headerHtml?.right ?? auto.right }} />
    </div>
  )
}
