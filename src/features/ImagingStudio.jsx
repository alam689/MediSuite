/* =====================================================================
   Imaging Viewer — WebGPU-accelerated study review.

   WebGPU is an enhancement here, never a dependency. Every control works
   without it: when no GPU is available the identical CPU pipeline renders
   the same pixels, more slowly, and the viewer says so plainly.

   The component knows nothing about GPU commands — it drives the
   MedicalImageProcessor interface (lib/webgpu/processor.js) and lets the
   hook decide which implementation is behind it.
   ===================================================================== */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Play,
  Pause,
  RotateCcw,
  Layers,
  Upload,
  Cpu,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Contrast,
  Maximize2,
  Minimize2,
  Scan,
  Ruler,
} from 'lucide-react'
import { useToast } from '../components/ui/Toast.jsx'
import { useWebGpu } from '../lib/webgpu/useWebGpu.js'
import { CpuImageProcessor, compareBuffers, FILTERS, COLOR_MAPS } from '../lib/webgpu/processor.js'
import { buildPhantom, sliceSource, mipSource, imageToSource } from '../lib/webgpu/phantom.js'
import {
  segmentSlice,
  measureVolume,
  SEG_PRESETS,
  PIXEL_SPACING_MM,
  SLICE_THICKNESS_MM,
} from '../lib/webgpu/segmentation.js'
import './features.css'

/* Clinical window/level presets, in Hounsfield units. */
const PRESETS = [
  { key: 'brain', label: 'Brain', wc: 40, ww: 80 },
  { key: 'soft', label: 'Soft tissue', wc: 50, ww: 400 },
  { key: 'bone', label: 'Bone', wc: 300, ww: 1500 },
  { key: 'lung', label: 'Lung', wc: -600, ww: 1500 },
]

export default function ImagingStudio() {
  const toast = useToast()
  const gpu = useWebGpu()

  const volume = useMemo(() => buildPhantom(), [])
  const cpuRef = useRef(null)
  if (!cpuRef.current) cpuRef.current = new CpuImageProcessor()

  /* ---- study state ---- */
  const [slice, setSlice] = useState(Math.floor(volume.slices / 2))
  const [playing, setPlaying] = useState(false)
  const [mip, setMip] = useState(false)
  const [upload, setUpload] = useState(null)

  /* ---- processing params ---- */
  const [wc, setWc] = useState(40)
  const [ww, setWw] = useState(80)
  const [invert, setInvert] = useState(false)
  const [filterMode, setFilterMode] = useState(0)
  const [colorMap, setColorMap] = useState(0)

  /* ---- segmentation ---- */
  const [segOn, setSegOn] = useState(false)
  const [segMin, setSegMin] = useState(SEG_PRESETS[0].min)
  const [segMax, setSegMax] = useState(SEG_PRESETS[0].max)
  const [minArea, setMinArea] = useState(60)
  const [review, setReview] = useState('UNREVIEWED') // blueprint §17.3
  const [volume3d, setVolume3d] = useState(null)

  /* ---- view + pipeline ---- */
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [fullscreen, setFullscreen] = useState(false)
  const [forceCpu, setForceCpu] = useState(false)
  const [stats, setStats] = useState(null)
  const [verify, setVerify] = useState(null)
  const [runtimeError, setRuntimeError] = useState(null)

  const mipData = useMemo(() => (mip && !upload ? mipSource(volume) : null), [mip, upload, volume])
  // Must be memoised: the process effect keys off this identity, and a fresh
  // object every render would re-dispatch GPU work in a loop that never settles.
  const source = useMemo(
    () => upload || mipData || sliceSource(volume, slice),
    [upload, mipData, volume, slice]
  )

  /* Region growing over the current slice. Memoised on the same identity
     rules as `source` — this is CPU work and must not re-run per render. */
  const seg = useMemo(() => {
    if (!segOn) return null
    const t0 = performance.now()
    const { mask, regions } = segmentSlice(source, { min: segMin, max: segMax, minArea })
    return {
      mask: { data: mask, token: `${source.token}:${segMin}:${segMax}:${minArea}` },
      regions,
      ms: performance.now() - t0,
    }
  }, [segOn, source, segMin, segMax, minArea])

  const gpuReady = gpu.status === 'available'
  const useGpu = gpuReady && !forceCpu && !runtimeError
  const params = useMemo(
    () => ({ windowCenter: wc, windowWidth: ww, invert, filterMode, colorMap, segEnabled: segOn }),
    [wc, ww, invert, filterMode, colorMap, segOn]
  )

  /* ---- canvases ---- */
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const offRef = useRef(null)
  if (!offRef.current && typeof document !== 'undefined') {
    offRef.current = document.createElement('canvas')
  }
  const [frame, setFrame] = useState(null)
  const [resizeTick, setResizeTick] = useState(0)

  /* ---- render queue -------------------------------------------------
     GPU work is serialised: only one dispatch/readback may be in flight
     against the resident staging buffer. A drag that outruns the GPU
     coalesces to the newest request instead of queueing every frame. */
  const requestRef = useRef(null)
  const busyRef = useRef(false)

  // Read through refs so these callbacks never change identity. `useToast()`
  // returns a new object per provider render, and the GPU processor arrives
  // late — either in a dependency array would re-arm the effect below on an
  // unrelated render and start the pipeline looping on itself.
  const gpuProcRef = useRef(null)
  gpuProcRef.current = gpu.status === 'available' ? gpu.processor : null
  const toastRef = useRef(toast)
  toastRef.current = toast

  const runOnce = useCallback(async (req) => {
    const t0 = performance.now()
    let rgba
    let mode = req.useGpu ? 'gpu' : 'cpu'
    try {
      const proc = req.useGpu ? gpuProcRef.current : cpuRef.current
      rgba = await proc.process(req.source, req.params, req.mask)
    } catch (error) {
      // A GPU failure mid-session must not blank the viewer: fall back,
      // stay on the CPU path, and tell the user once.
      if (req.useGpu) {
        const reason = error instanceof Error ? error.message : 'GPU processing failed.'
        setRuntimeError(reason)
        toastRef.current.error('GPU processing failed — switched to CPU', { title: 'Imaging Viewer' })
        rgba = await cpuRef.current.process(req.source, req.params, req.mask)
        mode = 'cpu'
      } else {
        throw error
      }
    }
    const ms = performance.now() - t0
    setFrame({ rgba, width: req.source.width, height: req.source.height })
    setStats({ ms, mode })
  }, [])

  const pump = useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      while (requestRef.current) {
        const req = requestRef.current
        requestRef.current = null
        await runOnce(req)
      }
    } finally {
      busyRef.current = false
    }
  }, [runOnce])

  useEffect(() => {
    if (gpu.status === 'checking') return
    requestRef.current = { source, params, useGpu, mask: seg?.mask }
    void pump()
  }, [source, params, useGpu, gpu.status, pump, seg])

  /* ---- redraw on resize ---------------------------------------------
     A trigger only: the draw measures the element itself. Gating the first
     paint on an observer callback would leave the viewport black wherever
     ResizeObserver is unavailable or delivered late. */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const bump = () => setResizeTick((t) => t + 1)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(bump) : null
    ro?.observe(el)
    window.addEventListener('resize', bump)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', bump)
    }
  }, [])

  /* ---- draw ---------------------------------------------------------
     Separate from processing: zoom and pan are canvas transforms and must
     never re-run the pipeline. */
  useEffect(() => {
    const canvas = canvasRef.current
    const off = offRef.current
    const wrap = wrapRef.current
    if (!canvas || !off || !wrap || !frame) return

    const cssW = wrap.clientWidth
    const cssH = wrap.clientHeight
    if (!cssW || !cssH) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)

    off.width = frame.width
    off.height = frame.height
    off
      .getContext('2d')
      .putImageData(new ImageData(frame.rgba, frame.width, frame.height), 0, 0)

    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    // Radiology viewers are black regardless of the app theme.
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const fit = Math.min(canvas.width / frame.width, canvas.height / frame.height)
    const scale = fit * zoom
    ctx.imageSmoothingEnabled = false
    ctx.save()
    ctx.translate(canvas.width / 2 + pan.x * dpr, canvas.height / 2 + pan.y * dpr)
    ctx.scale(scale, scale)
    ctx.drawImage(off, -frame.width / 2, -frame.height / 2)
    ctx.restore()

    /* DICOM-style corner annotations. */
    const pad = 10 * dpr
    ctx.font = `${11.5 * dpr}px Inter, system-ui, sans-serif`
    ctx.fillStyle = 'rgba(220,235,232,0.92)'
    ctx.textBaseline = 'top'
    const label = upload ? 'UPLOADED IMAGE' : 'SYNTHETIC PHANTOM — NOT PATIENT DATA'
    ctx.fillText(label, pad, pad)
    ctx.fillText(upload ? upload.token.replace(/^upload-/, '') : 'STUDY 1.2.826.0.1 · CT HEAD', pad, pad + 15 * dpr)
    if (mip && !upload) {
      ctx.textAlign = 'right'
      ctx.fillText('MIP · ALL SLICES', canvas.width - pad, pad)
      ctx.textAlign = 'left'
    }

    ctx.textBaseline = 'bottom'
    ctx.fillText(`W ${Math.round(ww)}  L ${Math.round(wc)}`, pad, canvas.height - pad)
    ctx.textAlign = 'right'
    const sliceLabel = upload ? 'single image' : mip ? `${volume.slices} slices` : `Slice ${slice + 1}/${volume.slices}`
    ctx.fillText(`${Math.round(zoom * 100)}%  ·  ${sliceLabel}`, canvas.width - pad, canvas.height - pad)
    ctx.textAlign = 'left'
    // `fullscreen` is a real dependency: it resizes the viewport, and the
    // ResizeObserver above cannot be relied on to deliver that change.
  }, [frame, zoom, pan, resizeTick, fullscreen, ww, wc, slice, mip, upload, volume.slices])

  /* ---- full screen (Esc to exit), mirroring the consultation console ---- */
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  /* ---- cine playback ---- */
  useEffect(() => {
    if (!playing || upload || mip) return
    const id = setInterval(() => setSlice((s) => (s + 1) % volume.slices), 90)
    return () => clearInterval(id)
  }, [playing, upload, mip, volume.slices])

  /* ---- wheel zoom (native listener: React's onWheel is passive) ---- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e) => {
      e.preventDefault()
      setZoom((z) => Math.min(8, Math.max(0.4, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  /* ---- drag: window/level (radiology convention), shift-drag pans ---- */
  const dragRef = useRef(null)
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, pan: e.shiftKey, wc, ww, px: pan.x, py: pan.y }
  }
  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (d.pan) {
      setPan({ x: d.px + dx, y: d.py + dy })
    } else {
      setWw(Math.max(1, Math.round(d.ww + dx * 4)))
      setWc(Math.round(d.wc - dy * 2))
    }
  }
  const endDrag = () => {
    dragRef.current = null
  }

  /* ---- actions ---- */
  const applyPreset = (p) => {
    setWc(p.wc)
    setWw(p.ww)
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    applyPreset(upload ? { wc: 128, ww: 255 } : PRESETS[0])
    setInvert(false)
    setFilterMode(0)
    setColorMap(0)
    setSegOn(false)
    setVolume3d(null)
    setReview('UNREVIEWED')
  }

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Select an image file', { title: file.name })
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image too large — 8 MB max', { title: file.name })
      return
    }
    try {
      const src = await imageToSource(file)
      setUpload(src)
      setMip(false)
      setPlaying(false)
      setWc(128)
      setWw(255)
      toast.success('Image processed on this device', { title: file.name })
    } catch {
      toast.error('Could not decode that image', { title: file.name })
    }
  }

  const applySegPreset = (p) => {
    setSegMin(p.min)
    setSegMax(p.max)
    setSegOn(true)
    setReview('UNREVIEWED')
    setVolume3d(null)
  }

  /* Segment every slice and sum the voxels. Explicitly user-triggered: it
     walks the whole series on the CPU. */
  const runVolume = () => {
    if (upload) return
    const t0 = performance.now()
    const v = measureVolume(volume, { min: segMin, max: segMax, minArea })
    setVolume3d({ ...v, ms: performance.now() - t0 })
    toast.info(`Region volume ${v.cm3.toFixed(2)} cm³ across ${v.slicesHit} slices`, {
      title: 'Series measurement',
    })
  }

  /* Run both pipelines on the same input and compare. This is the
     reference-output check the blueprint requires of any GPU path, and it
     doubles as an honest benchmark on the machine actually running it. */
  const runVerify = async () => {
    // Take the same lock the render pump uses: a second mapAsync against the
    // resident staging buffer while a frame is in flight would reject.
    if (!gpuReady || busyRef.current) return
    busyRef.current = true
    setVerify({ running: true })
    try {
      const t0 = performance.now()
      const gpuOut = await gpu.processor.process(source, params, seg?.mask)
      const gpuMs = performance.now() - t0

      const t1 = performance.now()
      const cpuOut = await cpuRef.current.process(source, params, seg?.mask)
      const cpuMs = performance.now() - t1

      const cmp = compareBuffers(gpuOut, cpuOut)
      setVerify({ ...cmp, gpuMs, cpuMs })
      if (cmp.pass) {
        toast.success(`GPU matches CPU reference (max Δ ${cmp.max})`, { title: 'Verification passed' })
      } else {
        toast.error(`GPU output differs from reference (max Δ ${cmp.max})`, { title: 'Verification failed' })
      }
    } catch (error) {
      setVerify(null)
      toast.error(error instanceof Error ? error.message : 'Verification failed', { title: 'Imaging Viewer' })
    } finally {
      busyRef.current = false
      void pump() // drain anything queued while verification held the lock
    }
  }

  /* ---- pipeline status line ---- */
  const status = (() => {
    if (gpu.status === 'checking') return { tone: 'blue', text: 'Checking GPU capability…' }
    if (gpu.status === 'lost') return { tone: 'rose', text: `GPU device lost — using CPU. ${gpu.reason}` }
    if (gpu.status === 'unavailable') return { tone: 'amber', text: `CPU pipeline — ${gpu.reason}` }
    if (runtimeError) return { tone: 'rose', text: `CPU pipeline — ${runtimeError}` }
    if (forceCpu) return { tone: 'amber', text: 'CPU pipeline — forced (fallback test)' }
    return { tone: 'green', text: `WebGPU ready — ${gpu.adapterName}` }
  })()

  const view = (
    <div className={`imaging ${fullscreen ? 'is-fullscreen' : ''}`}>
      {/* Pipeline bar */}
      <div className="img-bar">
        <div className={`img-status tone-${status.tone}`}>
          <span className="img-status-dot" />
          {status.text}
        </div>
        <div className="img-bar-right">
          {stats && (
            <span className="img-metric" title="Time to process the current frame">
              {stats.mode === 'gpu' ? <Zap size={13} /> : <Cpu size={13} />}
              {stats.mode.toUpperCase()} · {stats.ms.toFixed(1)} ms
            </span>
          )}
          {seg && (
            <span className="img-metric" title="Region growing time (CPU) for this slice">
              <Scan size={13} /> SEG · {seg.ms.toFixed(1)} ms
            </span>
          )}
          <label className="img-toggle" title="Force the CPU path to test the fallback">
            <input type="checkbox" checked={forceCpu} onChange={(e) => setForceCpu(e.target.checked)} />
            Force CPU
          </label>
          <button className="btn btn-ghost" onClick={runVerify} disabled={!gpuReady}>
            <ShieldCheck size={15} /> Verify vs CPU
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
          >
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {fullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      </div>

      {/* Verification result */}
      {verify && !verify.running && (
        <div className={`img-verify ${verify.pass ? 'pass' : 'fail'}`}>
          {verify.pass ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <div>
            <strong>
              {verify.pass ? 'GPU output matches the CPU reference' : 'GPU output differs from the CPU reference'}
            </strong>
            <span className="img-verify-sub">
              max Δ {verify.max} · mean Δ {verify.mean.toFixed(3)} (tolerance {verify.tolerance}/255) ·
              GPU {verify.gpuMs.toFixed(1)} ms vs CPU {verify.cpuMs.toFixed(1)} ms ·
              {' '}
              {verify.cpuMs > verify.gpuMs
                ? `${(verify.cpuMs / verify.gpuMs).toFixed(1)}× faster on GPU`
                : 'no GPU speed-up at this size'}
            </span>
          </div>
        </div>
      )}

      <div className="img-layout">
        {/* Viewport */}
        <div className="img-view">
          <div className="img-canvas-wrap" ref={wrapRef}>
            <canvas
              ref={canvasRef}
              className="img-canvas"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              aria-label="Medical image viewport"
            />
            {gpu.status === 'checking' && <div className="img-overlay">Checking image-processing capabilities…</div>}
          </div>

          <div className="img-hint">
            Drag to window/level · Shift-drag to pan · Scroll to zoom
          </div>

          {/* Series controls */}
          <div className="img-series">
            <button
              className="icon-btn"
              onClick={() => setPlaying((p) => !p)}
              disabled={!!upload || mip}
              aria-label={playing ? 'Pause cine' : 'Play cine'}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={volume.slices - 1}
              value={slice}
              disabled={!!upload || mip}
              onChange={(e) => setSlice(Number(e.target.value))}
              className="img-range grow"
              aria-label="Slice"
            />
            <span className="img-slice-num">
              {upload ? '—' : mip ? 'MIP' : `${slice + 1}/${volume.slices}`}
            </span>
          </div>
        </div>

        {/* Controls */}
        <aside className="img-panel">
          <div className="section-label">Window / Level</div>
          <div className="img-presets">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                className={`img-chip ${wc === p.wc && ww === p.ww ? 'on' : ''}`}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="img-field">
            <span>
              Window width <b>{ww}</b>
            </span>
            <input
              type="range"
              min={1}
              max={2000}
              value={ww}
              onChange={(e) => setWw(Number(e.target.value))}
              className="img-range"
            />
          </label>
          <label className="img-field">
            <span>
              Window center <b>{wc}</b>
            </span>
            <input
              type="range"
              min={-1000}
              max={1500}
              value={wc}
              onChange={(e) => setWc(Number(e.target.value))}
              className="img-range"
            />
          </label>

          <div className="section-label" style={{ marginTop: 18 }}>
            Processing
          </div>
          <label className="img-field">
            <span>Filter</span>
            <select
              className="img-select"
              value={filterMode}
              onChange={(e) => setFilterMode(Number(e.target.value))}
            >
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="img-field">
            <span>Colour map</span>
            <select
              className="img-select"
              value={colorMap}
              onChange={(e) => setColorMap(Number(e.target.value))}
            >
              {COLOR_MAPS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <div className="img-switches">
            <label className="img-toggle">
              <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} />
              <Contrast size={14} /> Invert
            </label>
            <label className="img-toggle" title="Maximum intensity projection through the series">
              <input
                type="checkbox"
                checked={mip}
                disabled={!!upload}
                onChange={(e) => {
                  setMip(e.target.checked)
                  setPlaying(false)
                  if (e.target.checked) applyPreset(PRESETS[2])
                }}
              />
              <Layers size={14} /> MIP
            </label>
          </div>

          {/* ---- Segmentation ---- */}
          <div className="section-label" style={{ marginTop: 18 }}>
            Segmentation
          </div>
          <div className="img-presets">
            {SEG_PRESETS.map((p) => (
              <button
                key={p.key}
                className={`img-chip ${segOn && segMin === p.min && segMax === p.max ? 'on' : ''}`}
                onClick={() => applySegPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="img-toggle" style={{ marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={segOn}
              onChange={(e) => {
                setSegOn(e.target.checked)
                setReview('UNREVIEWED')
                setVolume3d(null)
              }}
            />
            <Scan size={14} /> Show region overlay
          </label>

          {segOn && (
            <>
              <label className="img-field">
                <span>
                  Density range <b>{segMin} – {segMax}</b>
                </span>
                <input
                  type="range"
                  min={-200}
                  max={1200}
                  value={segMin}
                  onChange={(e) => setSegMin(Math.min(Number(e.target.value), segMax - 1))}
                  className="img-range"
                  aria-label="Minimum density"
                />
                <input
                  type="range"
                  min={-200}
                  max={1200}
                  value={segMax}
                  onChange={(e) => setSegMax(Math.max(Number(e.target.value), segMin + 1))}
                  className="img-range"
                  aria-label="Maximum density"
                />
              </label>
              <label className="img-field">
                <span>
                  Min region size <b>{minArea} px</b>
                </span>
                <input
                  type="range"
                  min={1}
                  max={400}
                  value={minArea}
                  onChange={(e) => setMinArea(Number(e.target.value))}
                  className="img-range"
                />
              </label>

              <div className="img-regions">
                {seg?.regions.length ? (
                  <>
                    <div className="img-region-head">
                      {seg.regions.length} region{seg.regions.length > 1 ? 's' : ''} on this slice
                    </div>
                    {seg.regions.slice(0, 3).map((r, i) => (
                      <div className="img-region" key={i}>
                        <span className="img-region-dot" />
                        <div>
                          <div className="img-region-title">
                            {r.diameterMm.toFixed(1)} mm · {r.areaMm2.toFixed(1)} mm²
                          </div>
                          <div className="img-region-sub">
                            mean {r.meanValue.toFixed(0)} {upload ? 'lum' : 'HU'} · {r.area} px · centroid{' '}
                            {r.centroid.x.toFixed(0)},{r.centroid.y.toFixed(0)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {seg.regions.length > 3 && (
                      <div className="img-region-sub">+{seg.regions.length - 3} smaller</div>
                    )}
                  </>
                ) : (
                  <div className="img-region-sub">No region in this density range on this slice.</div>
                )}
              </div>

              {!upload && (
                <button className="btn btn-ghost img-vol-btn" onClick={runVolume}>
                  <Ruler size={15} /> Measure volume (all slices)
                </button>
              )}
              {volume3d && (
                <div className="img-vol">
                  <b>{volume3d.cm3.toFixed(2)} cm³</b>
                  <span className="img-region-sub">
                    {volume3d.voxels.toLocaleString()} voxels across {volume3d.slicesHit} slices ·{' '}
                    {PIXEL_SPACING_MM} mm px / {SLICE_THICKNESS_MM} mm slice · {volume3d.ms.toFixed(0)} ms
                  </span>
                </div>
              )}

              <div className="img-review">
                <div className="img-review-row">
                  <span className="section-label">Clinical status</span>
                  <span className={`pill tone-${review === 'ACCEPTED' ? 'green' : review === 'REJECTED' ? 'rose' : 'amber'}`}>
                    {review}
                  </span>
                </div>
                <div className="img-review-btns">
                  <button className="mini-btn accent" onClick={() => { setReview('ACCEPTED'); toast.success('Region accepted for review', { title: 'Recorded' }) }}>
                    Accept
                  </button>
                  <button className="mini-btn" onClick={() => { setReview('REJECTED'); toast.info('Region rejected', { title: 'Recorded' }) }}>
                    Reject
                  </button>
                </div>
              </div>

              <p className="img-warn">
                <AlertTriangle size={13} />
                <span>
                  <b>Not a diagnosis and not AI.</b> This is intensity thresholding with region
                  growing — it finds pixels in a density range that touch each other, and cannot
                  tell a tumour from anything else of the same density. Output is a measurement
                  aid for a qualified clinician, never a finding on its own.
                </span>
              </p>
            </>
          )}

          <div className="section-label" style={{ marginTop: 18 }}>
            Study
          </div>
          <div className="img-actions">
            <label className="btn btn-ghost img-upload">
              <Upload size={15} /> Load image
              <input type="file" accept="image/*" onChange={onUpload} hidden />
            </label>
            {upload && (
              <button className="btn btn-ghost" onClick={() => { setUpload(null); setWc(40); setWw(80) }}>
                Back to phantom
              </button>
            )}
            <button className="btn btn-ghost" onClick={resetView}>
              <RotateCcw size={15} /> Reset view
            </button>
          </div>

          <p className="img-note">
            Images are decoded and processed on this device — nothing is uploaded. The demo study is a
            generated phantom, not patient data.
          </p>
        </aside>
      </div>
    </div>
  )

  // Portalled to the body so the app shell's stacking context can't clip it.
  return fullscreen ? createPortal(view, document.body) : view
}
