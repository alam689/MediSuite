/* =====================================================================
   useWebGpu — GPU lifecycle as React state.

   Resolves to one of:
     { status: 'checking' }
     { status: 'available',   processor, adapterName }
     { status: 'unavailable', reason }
     { status: 'lost',        reason }

   'unavailable' and 'lost' are normal states, not errors: the caller
   renders the CPU path and the clinician keeps working. A lost device
   (driver reset, laptop GPU switch) is reported so the UI can say what
   happened instead of freezing on a stale frame.
   ===================================================================== */

import { useEffect, useState } from 'react'
import { detectWebGpu } from './capability.js'
import { WebGpuImageProcessor } from './processor.js'

export function useWebGpu() {
  const [state, setState] = useState({ status: 'checking' })

  useEffect(() => {
    let active = true
    let processor = null
    let device = null

    async function initialize() {
      const cap = await detectWebGpu()

      if (!cap.supported) {
        if (active) setState({ status: 'unavailable', reason: cap.reason })
        return
      }
      if (!active) {
        cap.device.destroy()
        return
      }

      device = cap.device

      // Device loss can happen at any time — driver reset, GPU switch, tab
      // eviction. Never log identifiers here; this fires with PHI on screen.
      device.lost.then((info) => {
        if (!active) return
        setState({
          status: 'lost',
          reason: info.message || `GPU device lost (${info.reason}).`,
        })
      })

      try {
        processor = new WebGpuImageProcessor(device)
        await processor.initialize()
        if (!active) {
          processor.dispose()
          device.destroy()
          return
        }
        setState({ status: 'available', processor, adapterName: cap.adapterName })
      } catch (error) {
        processor?.dispose()
        if (active) {
          setState({
            status: 'unavailable',
            reason: error instanceof Error ? error.message : 'Pipeline creation failed.',
          })
        }
      }
    }

    void initialize()

    // Leaving the page cancels the work and releases GPU memory.
    return () => {
      active = false
      processor?.dispose()
      device?.destroy()
    }
  }, [])

  return state
}
