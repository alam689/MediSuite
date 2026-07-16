/* =====================================================================
   WebGPU capability detection.

   WebGPU is an *optional* acceleration layer in this platform. Nothing
   here throws: an unsupported browser is an expected, first-class state
   that the UI renders as a fallback, not an error.
   ===================================================================== */

export async function detectWebGpu() {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return { supported: false, reason: 'This browser does not expose WebGPU.' }
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    })
    if (!adapter) {
      return { supported: false, reason: 'No suitable GPU adapter was found.' }
    }

    const device = await adapter.requestDevice()

    // `requestAdapterInfo` is not in every implementation, and `info` is the
    // newer shape. Report only a coarse name — adapter details are a
    // fingerprinting surface and are never sent anywhere.
    let adapterName = 'Available GPU'
    try {
      const info = adapter.info || (await adapter.requestAdapterInfo?.())
      adapterName = info?.description || info?.vendor || info?.architecture || adapterName
    } catch {
      /* info is optional — a missing name is not a failure */
    }

    return { supported: true, adapter, device, adapterName }
  } catch (error) {
    return {
      supported: false,
      reason: error instanceof Error ? error.message : 'WebGPU initialization failed.',
    }
  }
}
