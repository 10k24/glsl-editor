# Open Issues / Roadmap

Actionable open tasks for glsl.10k24.com, tracked here until they're scoped and built.

---

## 1. Shadertoy-style image channels (localStorage-backed, zero server)

**Goal:** Let users attach an image to the Shadertoy samplers `iChannel0`–`iChannel3` — by uploading a file (stored only in browser localStorage, no server, no storage cost) or by pasting an image URL (Shadertoy-style load).

**Approach / notes:**
- Follow the Shadertoy convention: `uniform sampler2D iChannelN;` auto-declared in the preamble, sampled via `texture(iChannelN, uv)`, V-flipped (`UNPIXEL_FLIP_Y_WEBGL = true`) for Shadertoy-compatible orientation.
- Uploads are decoded/downscaled to a max dimension and stored as base64 data URLs in localStorage (cap ~5MB), using the existing silent-fail `try/catch` persistence pattern in `src/main.ts`.
- Files: `src/shader.ts` (renderer `setChannel(i, source)` — hides decode/upload complexity), `src/channel-image.ts` (encode/store), `src/channel-panel.ts` (UI, mirrors `define-panel.ts`), `index.html` + `src/style.css` + `src/main.ts` (wire), `src/share.ts` (URL-only persistence).
- **Sharing caveat:** image *URLs* are shareable via `#s=` params; uploaded *file* image data is too large for the URL fragment and is **not** shareable — a shared link opened elsewhere shows the placeholder for upload-backed channels.

**Open decisions:**
- Max downscale dimension: 1024px (safer quota) vs 2048px (higher quality, more storage).
- Include the URL-load field in v1, or upload-only first.

---

## 2. Stop/start render controls

**Goal:** Add stop/start buttons to pause and resume the `requestAnimationFrame` render loop in `src/shader.ts`.

**Approach:**
- Give the renderer `setRunning(bool)` / `pause()` / `resume()` methods that cancel/restart the loop.
- Wire two toolbar buttons to them (state reflects paused vs running).

**Roadmap:** these controls may later become part of a shared 10k24 component.

---

## 3. Live FPS display in menu/navbar

**Goal:** Show a live FPS readout in the header/navbar, computed from frame deltas in the render loop.

**Approach:**
- Renderer computes smoothed FPS from frame deltas and emits it via a callback (e.g. `onFps`).
- A header element updates ~once per second.

**Roadmap:** eventually a shared 10k24 component.

---

## 4. Toggle editor vs. presentation mode

**Goal:** Let users switch between the full editor view and a clean, distraction-free "presentation" mode that shows only the rendered shader output.

**Approach / notes:**
- Hide the editor pane, divider, info/define panels, and toolbar chrome in presentation mode; maximize the preview canvas.
- Keyboard shortcut (e.g. `Shift+P` / `Esc` to exit) plus a toolbar/menu toggle button.
- State should be simple and explicit; no ambiguity about which mode is active (e.g. a class on a root element + matching body class).
- Keep the render loop running so the presentation stays live (do not repurpose the stop/start task for this).

**Open decisions:**
- Expose a fullscreen option alongside pure in-page presentation mode, or keep it page-constrained for v1.

---

## 5. Bug — mobile: middle drag divider not touch-accessible

**Problem:** On mobile/touch, the middle resize divider (`#divider`) is either too narrow to grab or doesn't respond to touch, making editor/preview resizing impossible on touch devices.

**Approach:**
- Widen the touch hit-target beyond the visual divider (e.g. a padded hit area / `touch-action: none` on the divider).
- Add touch (`touchstart`/`touchmove`/`touchend`) handlers alongside the existing mouse handlers in `src/main.ts`.

## 6. Bug — editor and preview must share height

**Problem:** The text editor area and the shader preview should always be the **same height**; when the content is taller, the text editor needs its own internal scroll. Currently they can diverge.

**Approach:**
- Constrain editor pane and preview pane to equal height (flex/stretch on the parent), and give `.cm-scroller` an `overflow-y: auto` so the CodeMirror editor scrolls internally when its content exceeds the shared height.
- Verify the divider behavior still works with the two panes locked to equal height.

---

## 7. Align to 10k24 branding, then a shared library

**Goal:** Match the header/footer layout and branding of this app to id.10k24.com, using the studio's existing brand assets (already in `public/img/`; Typekit font loaded on id.10k24.com is `rli7dce`).

**Approach / notes:**
- Reconcile header/footer structure, typography, and logo treatment with id.10k24.com.
- **Roadmap:** extract the header/footer/branding into a shared 10k24 component library that all studio projects consume instead of duplicating.
- **Flag:** id.10k24.com is a React/Vite app; this app is vanilla TS/Vite. The shared-library consolidation must resolve this framework mismatch.
