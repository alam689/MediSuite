/* =====================================================================
   Medical image processor — service boundary.

   The React component depends on this interface, never on GPU commands:

     process(source, params, mask?) -> Uint8ClampedArray (RGBA, w*h*4)

   `mask` is an optional Uint32Array (1 = inside a segmented region) that is
   composited as a separate layer when params.segEnabled is set. Both
   implementations honour it, so the GPU-vs-CPU check still covers the
   overlay path.

   Two implementations satisfy it. `WebGpuImageProcessor` runs a compute
   shader; `CpuImageProcessor` runs the identical maths in JS and doubles
   as the reference the GPU path is verified against. Swapping one for the
   other is invisible to the viewer above.
   ===================================================================== */

import { WINDOW_LEVEL_WGSL } from './shader.js'

export const FILTERS = [
  { value: 0, label: 'None' },
  { value: 1, label: 'Smooth (denoise)' },
  { value: 2, label: 'Sharpen' },
  { value: 3, label: 'Edges (Sobel)' },
]

export const COLOR_MAPS = [
  { value: 0, label: 'Grayscale' },
  { value: 1, label: 'Hot' },
  { value: 2, label: 'Bone' },
  { value: 3, label: 'Jet' },
]

const PARAMS_BYTES = 32

/* ------------------------------------------------------------------ GPU */

export class WebGpuImageProcessor {
  constructor(device) {
    this.device = device
    this.pipeline = null
    this.buffers = null // { input, output, params, mask, staging, width, height }
    this.uploadedToken = null
    this.uploadedMaskToken = null
    this.disposed = false
  }

  async initialize() {
    const module = this.device.createShaderModule({
      label: 'window-level-filter',
      code: WINDOW_LEVEL_WGSL,
    })

    // Surface compile errors eagerly rather than at first dispatch.
    const info = await module.getCompilationInfo?.()
    const fatal = info?.messages?.find((m) => m.type === 'error')
    if (fatal) {
      throw new Error(`Shader compilation failed: ${fatal.message}`)
    }

    // The pipeline is built once and reused for every frame.
    this.pipeline = this.device.createComputePipeline({
      label: 'window-level-pipeline',
      layout: 'auto',
      compute: { module, entryPoint: 'main' },
    })
  }

  // Buffers are reallocated only when the image dimensions change, not per
  // frame — window/level dragging reuses the resident allocation.
  ensureBuffers(width, height) {
    const b = this.buffers
    if (b && b.width === width && b.height === height) return b

    if (b) {
      b.input.destroy()
      b.output.destroy()
      b.params.destroy()
      b.mask.destroy()
      b.staging.destroy()
    }

    const pixels = width * height
    const next = {
      width,
      height,
      input: this.device.createBuffer({
        label: 'input-pixels',
        size: pixels * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      mask: this.device.createBuffer({
        label: 'segmentation-mask',
        size: pixels * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      output: this.device.createBuffer({
        label: 'output-rgba',
        size: pixels * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }),
      params: this.device.createBuffer({
        label: 'params',
        size: PARAMS_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      }),
      staging: this.device.createBuffer({
        label: 'readback',
        size: pixels * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      }),
    }
    this.buffers = next
    this.uploadedToken = null // new allocation — force a re-upload
    this.uploadedMaskToken = null
    return next
  }

  async process(source, params, mask) {
    if (this.disposed) throw new Error('Processor disposed')
    if (!this.pipeline) throw new Error('Processor not initialized')

    const { width, height } = source
    const bufs = this.ensureBuffers(width, height)

    // Pixel data only crosses the bus when the slice actually changed.
    if (this.uploadedToken !== source.token) {
      this.device.queue.writeBuffer(bufs.input, 0, source.data)
      this.uploadedToken = source.token
    }

    // Same for the mask. When segmentation is off the shader never reads it,
    // so stale contents are harmless and re-uploading would be wasted bandwidth.
    const segEnabled = Boolean(params.segEnabled && mask)
    if (segEnabled && this.uploadedMaskToken !== mask.token) {
      this.device.queue.writeBuffer(bufs.mask, 0, mask.data)
      this.uploadedMaskToken = mask.token
    }

    const raw = new ArrayBuffer(PARAMS_BYTES)
    new Float32Array(raw, 0, 2).set([params.windowCenter, params.windowWidth])
    new Uint32Array(raw, 8, 6).set([
      width,
      height,
      params.invert ? 1 : 0,
      params.filterMode,
      params.colorMap,
      segEnabled ? 1 : 0,
    ])
    this.device.queue.writeBuffer(bufs.params, 0, raw)

    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: bufs.input } },
        { binding: 1, resource: { buffer: bufs.output } },
        { binding: 2, resource: { buffer: bufs.params } },
        { binding: 3, resource: { buffer: bufs.mask } },
      ],
    })

    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8))
    pass.end()
    encoder.copyBufferToBuffer(bufs.output, 0, bufs.staging, 0, width * height * 4)
    this.device.queue.submit([encoder.finish()])

    await bufs.staging.mapAsync(GPUMapMode.READ)
    // Copy before unmap — the mapped range is detached on unmap.
    const rgba = new Uint8ClampedArray(bufs.staging.getMappedRange().slice(0))
    bufs.staging.unmap()
    return rgba
  }

  dispose() {
    this.disposed = true
    const b = this.buffers
    if (b) {
      b.input.destroy()
      b.output.destroy()
      b.params.destroy()
      b.mask.destroy()
      b.staging.destroy()
    }
    this.buffers = null
    this.pipeline = null
  }
}

/* ------------------------------------------------------------------ CPU */

/* Mirror of `colorize` in the shader. */
function colorize(v, map) {
  if (map === 1) {
    return [
      Math.min(Math.max(v * 3, 0), 1),
      Math.min(Math.max(v * 3 - 1, 0), 1),
      Math.min(Math.max(v * 3 - 2, 0), 1),
    ]
  }
  if (map === 2) {
    return [
      Math.min(Math.max(v * 0.95, 0), 1),
      Math.min(Math.max(v * 0.98, 0), 1),
      Math.min(Math.max(v * 1.12, 0), 1),
    ]
  }
  if (map === 3) {
    return [
      Math.min(Math.max(1.5 - Math.abs(4 * v - 3), 0), 1),
      Math.min(Math.max(1.5 - Math.abs(4 * v - 2), 0), 1),
      Math.min(Math.max(1.5 - Math.abs(4 * v - 1), 0), 1),
    ]
  }
  return [v, v, v]
}

export class CpuImageProcessor {
  async initialize() {}

  async process(source, params, mask) {
    const { data, width, height } = source
    const { windowCenter, windowWidth, invert, filterMode, colorMap } = params
    const lo = windowCenter - windowWidth * 0.5
    const span = Math.max(windowWidth, 1)
    const segEnabled = Boolean(params.segEnabled && mask)

    const windowed = (px, py) => {
      const x = px < 0 ? 0 : px > width - 1 ? width - 1 : px
      const y = py < 0 ? 0 : py > height - 1 ? height - 1 : py
      const v = (data[y * width + x] - lo) / span
      return v < 0 ? 0 : v > 1 ? 1 : v
    }

    /* Mirror of `maskAt` in the shader. */
    const maskAt = (px, py) => {
      const x = px < 0 ? 0 : px > width - 1 ? width - 1 : px
      const y = py < 0 ? 0 : py > height - 1 ? height - 1 : py
      return mask.data[y * width + x]
    }

    const out = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let v = windowed(x, y)

        if (filterMode === 1) {
          const s =
            windowed(x - 1, y - 1) * 1 + windowed(x, y - 1) * 2 + windowed(x + 1, y - 1) * 1 +
            windowed(x - 1, y) * 2 + windowed(x, y) * 4 + windowed(x + 1, y) * 2 +
            windowed(x - 1, y + 1) * 1 + windowed(x, y + 1) * 2 + windowed(x + 1, y + 1) * 1
          v = s / 16
        } else if (filterMode === 2) {
          const s =
            5 * windowed(x, y) -
            windowed(x - 1, y) - windowed(x + 1, y) -
            windowed(x, y - 1) - windowed(x, y + 1)
          v = Math.min(Math.max(s, 0), 1)
        } else if (filterMode === 3) {
          const gx =
            -1 * windowed(x - 1, y - 1) + 1 * windowed(x + 1, y - 1) +
            -2 * windowed(x - 1, y) + 2 * windowed(x + 1, y) +
            -1 * windowed(x - 1, y + 1) + 1 * windowed(x + 1, y + 1)
          const gy =
            -1 * windowed(x - 1, y - 1) - 2 * windowed(x, y - 1) - 1 * windowed(x + 1, y - 1) +
            1 * windowed(x - 1, y + 1) + 2 * windowed(x, y + 1) + 1 * windowed(x + 1, y + 1)
          v = Math.min(Math.max(Math.sqrt(gx * gx + gy * gy), 0), 1)
        }

        if (invert) v = 1 - v

        let [r, g, b] = colorize(v, colorMap)

        if (segEnabled && maskAt(x, y) === 1) {
          const ov = [1.0, 0.32, 0.28]
          const boundary =
            maskAt(x - 1, y) === 0 || maskAt(x + 1, y) === 0 ||
            maskAt(x, y - 1) === 0 || maskAt(x, y + 1) === 0
          if (boundary) {
            ;[r, g, b] = ov
          } else {
            r = r + (ov[0] - r) * 0.4
            g = g + (ov[1] - g) * 0.4
            b = b + (ov[2] - b) * 0.4
          }
        }

        const i = (y * width + x) * 4
        out[i] = Math.round(r * 255)
        out[i + 1] = Math.round(g * 255)
        out[i + 2] = Math.round(b * 255)
        out[i + 3] = 255
      }
    }
    return out
  }

  dispose() {}
}

/* ------------------------------------------------------- verification */

/* Compare two RGBA buffers. The GPU works in f32 and the CPU in f64, so
   exact equality is the wrong bar — the blueprint asks for a documented
   numerical tolerance instead. */
export function compareBuffers(a, b, tolerance = 2) {
  let max = 0
  let sum = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (i % 4 === 3) continue // alpha is constant
    const d = Math.abs(a[i] - b[i])
    if (d > max) max = d
    sum += d
  }
  const mean = sum / (n * 0.75)
  return { max, mean, pass: max <= tolerance, tolerance }
}
