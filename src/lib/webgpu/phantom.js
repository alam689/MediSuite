/* =====================================================================
   Synthetic CT phantom — the Imaging Viewer's demo data.

   NOT patient data and not a real DICOM decode. Real patient imaging must
   never be used in a demo build; this is a procedurally generated head
   volume that behaves like one for viewer purposes. Densities are on the
   Hounsfield scale, so the clinical window/level presets (brain, soft
   tissue, bone, lung) land where a radiologist expects them to.

   Generation is seeded and deterministic: the same slice always produces
   the same pixels, which is what makes the GPU-vs-CPU verification in the
   viewer a meaningful comparison rather than a race against noise.

   Wiring a real study in means replacing this module with a DICOM parse in
   a Web Worker (see the blueprint, §11.4). Everything downstream — the
   processor interface, the shader, the viewer — is unchanged by that swap:
   they only need { data, width, height, token }.
   ===================================================================== */

export const PHANTOM = { width: 256, height: 256, slices: 48 }

/* Hounsfield-ish reference densities. */
const HU = {
  air: -1000,
  csf: 12,
  white: 30,
  gray: 42,
  lesion: 78,
  skull: 1100,
}

/* Seeded PRNG — determinism is a feature here, see header. */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ellipse = (dx, dy, rx, ry) => (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)

export function buildPhantom() {
  const { width, height, slices } = PHANTOM
  const data = new Float32Array(width * height * slices)
  const rand = mulberry32(20260715)

  for (let z = 0; z < slices; z++) {
    // Normalised axial position, -1 (skull base) → +1 (vertex).
    const zc = (z - (slices - 1) / 2) / ((slices - 1) / 2)
    const taper = Math.sqrt(Math.max(0.08, 1 - 0.72 * zc * zc))
    const headRx = 104 * taper
    const headRy = 88 * taper
    const skullThickness = 7

    // A lesion that grows and fades across the series, so scrolling and MIP
    // both have something real to show.
    const lesionZ = 0.15
    const lesionSpread = Math.max(0, 1 - ((zc - lesionZ) / 0.34) ** 2)
    const lesionR = 15 * Math.sqrt(lesionSpread)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - width / 2
        const dy = y - height / 2 + 4

        let v = HU.air
        const outer = ellipse(dx, dy, headRx, headRy)
        const inner = ellipse(dx, dy, headRx - skullThickness, headRy - skullThickness)

        if (outer <= 1) {
          if (inner > 1) {
            // Skull: bright rim, thinning slightly toward the vertex.
            v = HU.skull - 60 * Math.abs(zc)
          } else {
            // Brain: gray matter shell over white matter core.
            const core = ellipse(dx, dy, (headRx - skullThickness) * 0.72, (headRy - skullThickness) * 0.72)
            v = core <= 1 ? HU.white : HU.gray

            // Lateral ventricles — a symmetric pair of CSF pockets.
            const vent = Math.min(
              ellipse(dx - 17, dy - 6, 11 * taper, 21 * taper),
              ellipse(dx + 17, dy - 6, 11 * taper, 21 * taper)
            )
            if (vent <= 1) v = HU.csf

            // Falx cerebri — the midline sliver.
            if (Math.abs(dx) < 1.2 && dy < 20) v = HU.gray + 22

            if (lesionR > 1) {
              const les = ellipse(dx - 34, dy + 22, lesionR, lesionR * 0.9)
              if (les <= 1) v = HU.lesion + 10 * (1 - les)
            }
          }
          v += (rand() - 0.5) * 14 // acquisition noise, tissue only
        }

        data[z * width * height + y * width + x] = v
      }
    }
  }
  return { ...PHANTOM, data }
}

/* One slice as a processor source. The subarray is a view, not a copy. */
export function sliceSource(volume, index) {
  const { width, height } = volume
  const n = width * height
  return {
    width,
    height,
    data: volume.data.subarray(index * n, (index + 1) * n),
    token: `slice-${index}`,
  }
}

/* Maximum intensity projection through the stack — the brightest voxel
   along each ray. Used for vessels and bone in CTA/MRA workflows. */
export function mipSource(volume) {
  const { width, height, slices, data } = volume
  const n = width * height
  const out = new Float32Array(n)
  out.fill(-Infinity)
  for (let z = 0; z < slices; z++) {
    const off = z * n
    for (let i = 0; i < n; i++) {
      const v = data[off + i]
      if (v > out[i]) out[i] = v
    }
  }
  return { width, height, data: out, token: 'mip' }
}

/* Grayscale luminance from an uploaded image, mapped onto the same
   [0, 255] density range the "Uploaded image" preset windows for. The file
   is decoded in the browser and never leaves the device. */
export async function imageToSource(file) {
  const bitmap = await createImageBitmap(file)
  const { width, height } = PHANTOM
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  // Contain, preserving aspect ratio.
  const scale = Math.min(width / bitmap.width, height / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (width - w) / 2, (height - h) / 2, w, h)
  bitmap.close()

  const { data: rgba } = ctx.getImageData(0, 0, width, height)
  const data = new Float32Array(width * height)
  for (let i = 0; i < data.length; i++) {
    const p = i * 4
    // Rec. 601 luma.
    data[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]
  }
  return { width, height, data, token: `upload-${file.name}-${file.size}` }
}
