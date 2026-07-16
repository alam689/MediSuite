/* =====================================================================
   Intensity segmentation — deterministic, NOT AI, NOT diagnostic.

   What this is: threshold + connected-component region growing. A pixel is
   a candidate if its density falls inside [min, max]; candidates touching
   each other form a region; regions smaller than `minArea` are discarded as
   noise. This is a classical radiology tool (HU-thresholding is how bone is
   segmented in every PACS viewer), not a learned model. It cannot tell a
   tumour from anything else that happens to share its density — it reports
   "a connected region in this density range", and a clinician decides what
   that means.

   What this is NOT: a trained detector. There is no model here, no training
   data, and no diagnostic claim. Shipping something that *looked* like an AI
   detector but was really a threshold would be the dangerous option — it
   would inherit a neural network's credibility without its evidence. If a
   real model is added later (ONNX Runtime Web, blueprint §11.7), it produces
   the same mask shape and everything downstream is unchanged — but it must
   arrive with a validated intended use, a version, and human review states
   (§17), not as a swap behind this function's back.

   The labelling runs on the CPU by design: region growing is a sequential
   flood fill, which is a poor fit for per-pixel GPU parallelism. The GPU
   does what it is good at — compositing the resulting mask over the image
   as a separate layer, one invocation per pixel (§3.3.2).
   ===================================================================== */

/* Geometry assumptions for the synthetic phantom. Real DICOM carries these
   in PixelSpacing (0028,0030) and SliceThickness (0018,0050); a real study
   must read them rather than assume, or every measurement is wrong. */
export const PIXEL_SPACING_MM = 0.5
export const SLICE_THICKNESS_MM = 2.5

export const SEG_PRESETS = [
  { key: 'lesion', label: 'Lesion', min: 68, max: 105 },
  { key: 'bone', label: 'Bone', min: 300, max: 3000 },
  { key: 'csf', label: 'CSF / fluid', min: -5, max: 22 },
]

/* Segment one slice. Returns a mask (1 = kept) and per-region statistics. */
export function segmentSlice(source, { min, max, minArea }) {
  const { data, width, height } = source
  const n = width * height
  const mask = new Uint32Array(n)
  const visited = new Uint8Array(n)
  const stack = new Int32Array(n)
  const regions = []

  const inRange = (i) => data[i] >= min && data[i] <= max

  for (let seed = 0; seed < n; seed++) {
    if (visited[seed] || !inRange(seed)) continue

    // Flood fill (4-connectivity) from this seed.
    let top = 0
    stack[top++] = seed
    visited[seed] = 1

    const members = []
    let sum = 0
    let sx = 0
    let sy = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0

    while (top > 0) {
      const i = stack[--top]
      members.push(i)
      const x = i % width
      const y = (i / width) | 0
      sum += data[i]
      sx += x
      sy += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      if (x > 0) { const j = i - 1; if (!visited[j] && inRange(j)) { visited[j] = 1; stack[top++] = j } }
      if (x < width - 1) { const j = i + 1; if (!visited[j] && inRange(j)) { visited[j] = 1; stack[top++] = j } }
      if (y > 0) { const j = i - width; if (!visited[j] && inRange(j)) { visited[j] = 1; stack[top++] = j } }
      if (y < height - 1) { const j = i + width; if (!visited[j] && inRange(j)) { visited[j] = 1; stack[top++] = j } }
    }

    const area = members.length
    if (area < minArea) continue // noise speckle, not a region

    for (const i of members) mask[i] = 1
    regions.push({
      area,
      meanValue: sum / area,
      centroid: { x: sx / area, y: sy / area },
      bbox: { minX, maxX, minY, maxY },
      areaMm2: area * PIXEL_SPACING_MM * PIXEL_SPACING_MM,
      // Diameter of a circle of equal area — the standard way a 2D lesion
      // measurement is reported.
      diameterMm: 2 * Math.sqrt(area / Math.PI) * PIXEL_SPACING_MM,
    })
  }

  regions.sort((a, b) => b.area - a.area)
  return { mask, regions }
}

/* Segment every slice and sum the voxels — a crude volume estimate.
   Runs the full series on the CPU, so it is an explicit user action rather
   than something that happens on every frame. */
export function measureVolume(volume, opts) {
  const { width, height, slices, data } = volume
  const n = width * height
  let voxels = 0
  let slicesHit = 0

  for (let z = 0; z < slices; z++) {
    const slice = {
      width,
      height,
      data: data.subarray(z * n, (z + 1) * n),
    }
    const { regions } = segmentSlice(slice, opts)
    const area = regions.reduce((sum, r) => sum + r.area, 0)
    if (area > 0) slicesHit++
    voxels += area
  }

  const mm3 = voxels * PIXEL_SPACING_MM * PIXEL_SPACING_MM * SLICE_THICKNESS_MM
  return { voxels, slicesHit, mm3, cm3: mm3 / 1000 }
}
