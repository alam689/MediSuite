/* =====================================================================
   WGSL compute shader — window/level, spatial filter, colour map.

   One invocation per pixel. Reads the raw density buffer, writes packed
   RGBA. The CPU reference implementation in `processor.js` mirrors this
   maths exactly; if you change one, change the other and re-run the
   "Verify vs CPU" check in the Imaging Viewer.

   Params layout (std140 uniform, 32 bytes):
     0  windowCenter : f32
     4  windowWidth  : f32
     8  width        : u32
     12 height       : u32
     16 invert       : u32
     20 filterMode   : u32   0 none | 1 smooth | 2 sharpen | 3 edges
     24 colorMap     : u32   0 gray | 1 hot | 2 bone | 3 jet
     28 segEnabled   : u32   composite the segmentation mask layer
   ===================================================================== */

export const WINDOW_LEVEL_WGSL = /* wgsl */ `
struct Params {
  windowCenter : f32,
  windowWidth  : f32,
  width        : u32,
  height       : u32,
  invert       : u32,
  filterMode   : u32,
  colorMap     : u32,
  segEnabled   : u32,
};

@group(0) @binding(0) var<storage, read>       inputPixels  : array<f32>;
@group(0) @binding(1) var<storage, read_write> outputPixels : array<u32>;
@group(0) @binding(2) var<uniform>             params       : Params;
// Segmentation mask, 1 = inside a kept region. Produced on the CPU (region
// growing is sequential); composited here as a separate layer so the
// original pixel data is never overwritten.
@group(0) @binding(3) var<storage, read>       segMask      : array<u32>;

// Window/level at a clamped coordinate. Edge pixels replicate rather than
// wrap, so a filter kernel never samples across the opposite border.
fn windowed(px: i32, py: i32) -> f32 {
  let x = clamp(px, 0, i32(params.width) - 1);
  let y = clamp(py, 0, i32(params.height) - 1);
  let v = inputPixels[u32(y) * params.width + u32(x)];
  let lo = params.windowCenter - params.windowWidth * 0.5;
  return clamp((v - lo) / max(params.windowWidth, 1.0), 0.0, 1.0);
}

fn colorize(v: f32) -> vec3<f32> {
  if (params.colorMap == 1u) {           // hot — perfusion / PET uptake
    return vec3<f32>(
      clamp(v * 3.0,       0.0, 1.0),
      clamp(v * 3.0 - 1.0, 0.0, 1.0),
      clamp(v * 3.0 - 2.0, 0.0, 1.0)
    );
  }
  if (params.colorMap == 2u) {           // bone — cool-tinted grey
    return vec3<f32>(
      clamp(v * 0.95, 0.0, 1.0),
      clamp(v * 0.98, 0.0, 1.0),
      clamp(v * 1.12, 0.0, 1.0)
    );
  }
  if (params.colorMap == 3u) {           // jet — functional overlays
    return vec3<f32>(
      clamp(1.5 - abs(4.0 * v - 3.0), 0.0, 1.0),
      clamp(1.5 - abs(4.0 * v - 2.0), 0.0, 1.0),
      clamp(1.5 - abs(4.0 * v - 1.0), 0.0, 1.0)
    );
  }
  return vec3<f32>(v, v, v);             // grayscale — diagnostic default
}

fn maskAt(px: i32, py: i32) -> u32 {
  let x = clamp(px, 0, i32(params.width) - 1);
  let y = clamp(py, 0, i32(params.height) - 1);
  return segMask[u32(y) * params.width + u32(x)];
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  if (gid.x >= params.width || gid.y >= params.height) {
    return;
  }
  let x = i32(gid.x);
  let y = i32(gid.y);

  var v = windowed(x, y);

  if (params.filterMode == 1u) {
    // Gaussian 3x3 — noise reduction.
    let s =
      windowed(x - 1, y - 1) * 1.0 + windowed(x, y - 1) * 2.0 + windowed(x + 1, y - 1) * 1.0 +
      windowed(x - 1, y    ) * 2.0 + windowed(x, y    ) * 4.0 + windowed(x + 1, y    ) * 2.0 +
      windowed(x - 1, y + 1) * 1.0 + windowed(x, y + 1) * 2.0 + windowed(x + 1, y + 1) * 1.0;
    v = s / 16.0;
  } else if (params.filterMode == 2u) {
    // Unsharp-style sharpen — edge enhancement.
    let s = 5.0 * windowed(x, y)
      - windowed(x - 1, y) - windowed(x + 1, y)
      - windowed(x, y - 1) - windowed(x, y + 1);
    v = clamp(s, 0.0, 1.0);
  } else if (params.filterMode == 3u) {
    // Sobel magnitude — structure boundaries.
    let gx =
      -1.0 * windowed(x - 1, y - 1) + 1.0 * windowed(x + 1, y - 1) +
      -2.0 * windowed(x - 1, y    ) + 2.0 * windowed(x + 1, y    ) +
      -1.0 * windowed(x - 1, y + 1) + 1.0 * windowed(x + 1, y + 1);
    let gy =
      -1.0 * windowed(x - 1, y - 1) - 2.0 * windowed(x, y - 1) - 1.0 * windowed(x + 1, y - 1) +
       1.0 * windowed(x - 1, y + 1) + 2.0 * windowed(x, y + 1) + 1.0 * windowed(x + 1, y + 1);
    v = clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);
  }

  if (params.invert == 1u) {
    v = 1.0 - v;
  }

  var c = colorize(v);

  // Segmentation overlay — a translucent wash inside the region and a solid
  // outline on its boundary, so the underlying pixels stay readable.
  if (params.segEnabled == 1u && maskAt(x, y) == 1u) {
    let overlay = vec3<f32>(1.0, 0.32, 0.28);
    let boundary =
      maskAt(x - 1, y) == 0u || maskAt(x + 1, y) == 0u ||
      maskAt(x, y - 1) == 0u || maskAt(x, y + 1) == 0u;
    if (boundary) {
      c = overlay;
    } else {
      c = mix(c, overlay, 0.40);
    }
  }

  let r = u32(c.r * 255.0 + 0.5);
  let g = u32(c.g * 255.0 + 0.5);
  let b = u32(c.b * 255.0 + 0.5);
  outputPixels[u32(y) * params.width + u32(x)] = r | (g << 8u) | (b << 16u) | (255u << 24u);
}
`
