# GLSL Editor — Feature Completeness Plan

## Goal

Make the editor feature-complete so anyone can understand any part of a GLSL or Shadertoy shader. Two pillars: **explanation completeness** (every token/pattern explained) and **rendering completeness** (shaders actually run).

---

## P0: Understanding Gaps (Critical)

These block the core value proposition — a user reading Shadertoy code gets zero help.

### 1. Add Shadertoy Uniform Documentation

**File:** `src/glsl-docs.ts`

Add entries for every Shadertoy built-in uniform to `GLSL_DOCS`:

| Token | Kind | Signature | Description |
|-------|------|-----------|-------------|
| `iResolution` | variable | `iResolution: vec3 (read-only)` | Canvas size in pixels. `.xy` = width/height, `.z` = aspect ratio (width/height) |
| `iTime` | variable | `iTime: float (read-only)` | Elapsed time in seconds since the shader started rendering |
| `iTimeDelta` | variable | `iTimeDelta: float (read-only)` | Time in seconds of the last frame (frame delta) |
| `iFrameRate` | variable | `iFrameRate: float (read-only)` | Current frame rate (1/iTimeDelta), approximated |
| `iFrame` | variable | `iFrame: int (read-only)` | Frame counter, starts at 0 and increments each frame |
| `iMouse` | variable | `iMouse: vec4 (read-only)` | Mouse state. `.xy` = cursor position in pixels (bottom-left origin), `.zw` = click position (0 while no click) |
| `iChannel0` | variable | `iChannel0: sampler2D (read-only)` | Texture channel 0. Bound by the host; sample with `texture(iChannel0, uv)` |
| `iChannel1` | variable | `iChannel1: sampler2D (read-only)` | Texture channel 1 |
| `iChannel2` | variable | `iChannel2: sampler2D (read-only)` | Texture channel 2 |
| `iChannel3` | variable | `iChannel3: sampler2D (read-only)` | Texture channel 3 |
| `iChannelTime` | variable | `iChannelTime: float[4] (read-only)` | Elapsed time for each video channel (if video textures are bound) |
| `iChannelResolution` | variable | `iChannelResolution: vec3[4] (read-only)` | Resolution (width, height, 1.0) of each channel's texture |
| `iDate` | variable | `iDate: vec4 (read-only)` | Date. `.x` = year, `.y` = month, `.z` = day, `.w` = seconds since midnight |
| `iSampleRate` | variable | `iSampleRate: float (read-only)` | Audio sample rate (default 44100.0). For audio shaders |
| `mainImage` | keyword | `mainImage(out vec4 fragColor, in vec2 fragCoord)` | Shadertoy entry point. Write your output color to `fragColor`. `fragCoord` is the pixel position (bottom-left origin) |

Also add `fragColor` and `fragCoord` as context-sensitive variables (only meaningful inside `mainImage`).

### 2. Add GLSL ES 3.00 Function Documentation

**File:** `src/glsl-docs.ts`

Add entries for ES 3.0 functions that are missing:

| Token | Description |
|-------|-------------|
| `texture` | ES 3.0 texture sampling. `texture(sampler2D, vec2, bias?)` — replaces `texture2D` in GLSL ES 3.0 |
| `texelFetch` | ES 3.0 texel fetch at integer coordinates without filtering. `texelFetch(sampler2D, ivec2, int lod)` |
| `textureLod` | ES 3.0 texture lookup with explicit LOD. `textureLod(sampler2D, vec2, float lod)` |
| `textureGrad` | ES 3.0 texture lookup with explicit gradients |
| `textureProj` | ES 3.0 projective texture lookup |
| `dFdx` | Partial derivative of a variable with respect to window x. `dFdx(float) → float` |
| `dFdy` | Partial derivative of a variable with respect to window y |
| `fwidth` | Returns `abs(dFdx(p)) + abs(dFdy(p))` — used for anti-aliasing |
| `round` | ES 3.0 round-to-nearest-integer function |
| `isnan` | Returns true if x is NaN |
| `isinf` | Returns true if x is +/- infinity |

### 3. Fix Line Explanation for Shadertoy Patterns

**File:** `src/line-explain.ts`

**3a.** In `explainLine`, add pattern matches before the `gl_FragColor` check:
- `fragColor = ...` → explain as Shadertoy output assignment
- Any variable assignment where the line is inside a `mainImage` function

**3b.** In `describeExpr`, add patterns:
- `iResolution.xy` → "canvas pixel dimensions"
- `iResolution` → "the canvas resolution (width, height, aspect ratio)"
- `iTime` → "elapsed time in seconds"
- `fragCoord.xy / iResolution` → "normalized UV coordinates [0,1]"
- `fragCoord.xy / iResolution.xy - 0.5` → "centered UV coordinates [-0.5, 0.5]"
- `texture(iChannel` → "samples a texture channel"
- `iMouse.xy` → "current mouse cursor position in pixels"
- `iMouse.zw` → "mouse click position in pixels (0 if not clicking)"
- `iFrame` → "the current frame number"

**3c.** In the `mainImage` function definition explanation (line 247), expand the description to explain all parameters and common patterns.

### 4. Add Shadertoy Names to Autocomplete

**File:** `src/glsl-docs.ts` + `src/glsl-completions.ts`

All Shadertoy uniform variables added in step 1 will automatically appear in autocomplete since completions are built from `GLSL_DOCS`. No changes needed to `glsl-completions.ts` — just ensure the doc entries exist.

Also add `fragColor` and `fragCoord` as variable-kind entries so they autocomplete inside `mainImage`.

---

## P1: Rendering & Documentation Gaps (Important)

### 5. Add Texture Loading UI

**Files:** `src/shader.ts`, new `src/channel-panel.ts`, `src/main.ts`, `index.html`, `src/style.css`

Add a small panel below the canvas (or as a toolbar) with 4 channel slots:
- Each slot: button to upload an image file (PNG, JPG, BMP)
- Display thumbnail of loaded texture
- Toggle for wrap mode (repeat/clamp) and filter (linear/nearest)
- Drag-and-drop support onto channel slots
- In `shader.ts`: replace dummy textures with loaded textures via `gl.texImage2D()`

### 6. Add URL Sharing / LocalStorage Persistence

**Files:** `src/main.ts`, new `src/share.ts`

Option A (simpler): localStorage auto-save on every edit, restore on load.
Option B (shareable): Compress shader source with LZString or similar, encode in URL hash (`#base64...`).
Recommend doing both: localStorage for persistence, URL hash for sharing.

### 7. Add Fullscreen Preview

**Files:** `src/main.ts`, `src/style.css`, `index.html`

Add a button (in header or on canvas) that toggles the canvas to fill the viewport (CSS `position: fixed; inset: 0; z-index: 100`). Click or Escape to exit.

### 8. Complete the Preprocessor

**File:** `src/glsl-preprocessor.ts`

Add:
- `#if EXPR` / `#elif EXPR` / `#endif` — evaluate simple integer/boolean expressions
- `defined(NAME)` operator inside `#if`
- `#define NAME value` client-side substitution (currently only passed to GPU)
- `#pragma` directives (at minimum, ignore them silently instead of returning generic "preprocessor directive" explanation)

---

## P2: Quality & Cleanup

### 9. Remove Vestigial Files
- Delete `src/index.css` (unused Tailwind CSS)
- Delete `components.json` (unused shadcn config)
- Remove `"jsx": "react-jsx"` from `tsconfig.json`

### 10. Add Tests
- `src/glsl-preprocessor.test.ts` — unit tests for define/ifdef/value substitution
- `src/line-explain.test.ts` — unit tests for all explanation patterns
- `src/glsl-docs.test.ts` — verify all doc entries have required fields
- Use Vitest (already a natural fit for Vite projects)

### 11. Add Linting
- Install ESLint + TypeScript plugin
- Add to package.json scripts: `"lint": "eslint src/"`, `"lint:fix": "eslint src/ --fix"`

---

## Implementation Order

```
Phase 1 (P0): Understanding completeness
  1.1  Add Shadertoy uniform docs to glsl-docs.ts
  1.2  Add ES 3.0 function docs to glsl-docs.ts
  1.3  Fix line-explain.ts for Shadertoy patterns
  → Autocomplete gains Shadertoy names automatically

Phase 2 (P1): Rendering completeness
  2.1  Texture loading (channel-panel.ts + shader.ts changes)
  2.2  URL sharing / localStorage persistence
  2.3  Fullscreen preview

Phase 3 (P1): Preprocessor completion
  3.1  #if/#elif expression evaluation
  3.2  #define value substitution

Phase 4 (P2): Quality
  4.1  Delete vestigial files
  4.2  Add Vitest + tests
  4.3  Add ESLint
```

---

## Out of Scope (Future)
- Multi-pass / multi-buffer rendering (Buf A–D)
- Audio shader support
- Vertex shader editing
- Multiple shader tabs
- Error-on-hover tooltips
- Mobile responsive layout
