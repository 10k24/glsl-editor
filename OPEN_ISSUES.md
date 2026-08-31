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

## 2. Stop/start render controls — DONE

**Status:** ✅ Done. `renderer.setRunning(bool)` added to `src/shader.ts` (a user pause is respected even if the shader is edited — only the GPU-hang watchdog auto-resumes on edit). Toolbar `#pause-btn` toggles Pause/Play via `src/main.ts`. Default is running.

**Approach:**
- Give the renderer `setRunning(bool)` / `pause()` / `resume()` methods that cancel/restart the loop.
- Wire two toolbar buttons to them (state reflects paused vs running).

**Roadmap:** these controls may later become part of a shared 10k24 component.

---

## 3. Live FPS display in menu/navbar — DONE

**Status:** ✅ Done. Renderer computes exponentially-smoothed FPS from frame deltas and reports it via an `onFps` callback only when the rounded value changes. Header `<span id="fps">` (hidden until the first frame) is updated in `src/main.ts`.

**Approach:**
- Renderer computes smoothed FPS from frame deltas and emits it via a callback (e.g. `onFps`).
- A header element updates ~once per second.

**Roadmap:** eventually a shared 10k24 component.

---

## 4. Toggle editor vs. presentation mode — DONE

**Status:** ✅ Done. `#present-btn` (header toolbar) toggles a `presenting` class on `#app`, which hides the header/editor-pane/divider/footer so the canvas fills the window (it re-sizes itself each frame at `src/shader.ts:273`, so no manual resize). Exit via the floating `#exit-present-btn` or `Esc`. The exit button stays hidden until the first pointer move/tap, then fades out after 3s idle (`src/main.ts` reveal/hide timer + `src/style.css` opacity transition).

**Goal:** Let users switch between the full editor view and a clean, distraction-free "presentation" mode that shows only the rendered shader output.

**Approach / notes:**
- Hide the editor pane, divider, info/define panels, and toolbar chrome in presentation mode; maximize the preview canvas.
- Keyboard shortcut (e.g. `Shift+P` / `Esc` to exit) plus a toolbar/menu toggle button.
- State should be simple and explicit; no ambiguity about which mode is active (e.g. a class on a root element + matching body class).
- Keep the render loop running so the presentation stays live (do not repurpose the stop/start task for this).

**Open decisions:**
- Expose a fullscreen option alongside pure in-page presentation mode, or keep it page-constrained for v1.

---

## 5. Bug — mobile: middle drag divider not touch-accessible — DONE

**Status:** ✅ Done. `src/resizer.ts` switched from mouse events to Pointer Events (`pointerdown/move/up/cancel` + `setPointerCapture`), unifying touch and mouse. CSS adds `touch-action: none` (so drags aren't hijacked by scroll/zoom) and an invisible `#divider::before` hit area (±8px around the 5px visual).

**Problem:** On mobile/touch, the middle resize divider (`#divider`) is either too narrow to grab or doesn't respond to touch, making editor/preview resizing impossible on touch devices.

**Approach:**
- Widen the touch hit-target beyond the visual divider (e.g. a padded hit area / `touch-action: none` on the divider).
- Add touch (`touchstart`/`touchmove`/`touchend`) handlers alongside the existing mouse handlers in `src/main.ts`.

## 6. Bug — editor and preview must share height — DONE

**Status:** ✅ Done. `#editor-cm` set to `flex: 1 1 0%; height: 0; min-height: 0` so the CodeMirror editor gets a definite height and the `.cm-scroller` scrolls internally; the editor pane always matches the preview pane height.

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

---

## 8. Sleepless design system — rem layout cleanup (single source of truth)

**Goal:** Stand up **Sleepless**, the 10k24 design system, as the single source of truth for CSS/design tokens that all studio projects consume. This glsl-editor is the seed/consumer.

**Status:** Note-only for now. The concrete `px → rem` refactor and inconsistency cleanup is **deferred until Sleepless is planned**.

**Approach / notes:**
- Current `src/style.css` mixes `px` and `rem` units and mixes palettes (Tokyo-Night chrome leftovers vs the 10k24 black/white/`#F24E1E`/`#0ACF83` header/footer).
- `src/index.css` (`tailwindcss` + `tw-animate-css`) is **dead code** — nothing imports it (`src/main.ts` imports only `style.css`). Remove it as part of the Sleepless cleanup.
- Define tokens (spacing scale in `rem`, semantic colors, type scale) once; consume everywhere.

---

## 9. Remove non-adelle-mono fonts — DONE

**Goal:** Audit and remove fonts that aren't `adelle-mono` so typography is consistent with the 10k24 brand.

**Status:** ✅ Done. Built as `adelle-mono` everywhere.
- Base/body font: `Inter` → `adelle-mono`.
- Code editor + inline code (`.cm-editor`, `.define-row code`, `#info-token`/`#info-sig`, `#error-overlay`): `JetBrains Mono`/`Fira Code`/`Menlo` fallbacks → `adelle-mono`.
- Removed the dead Google Fonts `Inter`/`JetBrains Mono` `<link>` from `index.html` (`adelle-mono` loads via the existing Typekit `rli7dce` link).
- Defined `--font-mono: 'adelle-mono', monospace` once in `:root` (src/style.css:7) and referenced via `var(--font-mono)` at all 14 sites — single source of truth.
- Decision recorded: code editor also uses `adelle-mono` (no separate code font).

---

## 10. Swap syntax-highlight theme to 10k24 (TBD)

**Goal:** Replace the current CodeMirror Tokyo-Night scheme with a 10k24 syntax theme.

**Approach / notes:**
- Replace `oneDark` + the custom Tokyo-Night `baseTheme` in `src/editor.ts` (colors `#0d0f14`, `#7aa2f7`, `#9aa5ce`, etc.).
- Covers editor surface, autocomplete tooltip, completion popups, error-line/gutter colors.
- **Spec TBD** — pending the Sleepless palette.

---

## 11. Deferred — unify cross-file string contracts & palette (single source of truth)

**Status:** Mostly done. `#s=`, `cm-error-*`, and `hidden` unified; `info-badge` + palette remain (tie into Sleepless, task 8).

**Findings (from design-philosophy audit):**
- ✅ **`#s=` share prefix** unified: `share.ts` now exports `isShareHash()` and both `share.ts` (decode) and `main.ts` use it.
- ✅ **`cm-error-*` class strings** unified: `error-lines.ts` exports `ERROR_LINE_CLASS`/`ERROR_MARKER_CLASS`/`ERROR_GUTTER_CLASS`; `editor.ts` theme and `error-lines.ts` both import them.
- ✅ **`hidden` class** unified: new `src/dom.ts` exports `toggleHidden()`; `main.ts` `showError()` and `define-panel.ts` `render()` use it. Single source for the class name.
- ⬜ **`info-badge-${kind}` class names** produced in `src/info-panel.ts`, styled in `src/style.css`. (CSS selectors can't consume a TS constant, so unifying the *class-name* here yields no shared value; revisit if Sleepless introduces CSS custom classes.)
- ⬜ **Color palette** (`#0d0f14`, `#7aa2f7`, `#f7768e`, …) duplicated across `src/editor.ts`, `src/style.css`, `src/index.css` (dead), and `index.html` meta theme-color. Pull into token variables (→ Sleepless).

---

## 12. Deferred — unify duplicated technical/content knowledge

**Status:** Deferred out of the Tier-1 cleanup (content-level, higher test/risk impact).

**Findings (from design-philosophy audit):**
- **WebGL error-log format** parsed independently in `src/shader.ts:175` (`/ERROR:\s*(\d+):(\d+)/`) and `src/error-lines.ts:74` (`/ERROR:\s*\d+:(\d+)/`). Share one parser.
- **Defines grammar** scanned twice inside `src/glsl-preprocessor.ts` (`parseDefineFlags` at :21–40 and `preprocess` at :118–135), including the duplicated `// #define` comment rule. `parseDefineFlags` should be the single grammar authority.
- **`DocKind` → label mapping**: ✅ `KIND_LABELS` moved into `src/glsl-docs.ts` next to `DocKind` (info-panel imports it). ⬜ `CM_TYPE` in `src/glsl-completions.ts:4–10` maps `DocKind`→CM completion type and could also move beside the type.
- **GLSL function-semantics text** re-described in both `src/line-explain.ts` (`describeExpr`, ~26 functions) and `src/glsl-docs.ts`; update one, the other drifts. Unify the teaching content.

---

## 13. Autocomplete: suggest variable members (`.field` after a typed variable)

**Goal:** Add member completion. When a user types `q.` (a variable of known type), offer that type's members. E.g. for `vec4 q = vec4(1.0);`, typing `q.` should suggest `x`, `y`, `z`, `w`, `r`, `g`, `b`, `a`, `s`, `t`, `p`, `q`, array access, etc.

**Approach / notes:**
- Current autocomplete (`src/glsl-completions.ts`) is keyword/function-only; extend it (or add a second completion source) that resolves the identifier left of the `.` to a declared variable's type.
- Track in-scope variable declarations (name → type) as the user types — a lightweight GLSL parse of the current doc (regex/text scan, not a full parser; see existing parser scans in `src/glsl-preprocessor.ts`).
- Member lists per type: `vecN` (component accessors, swizzling, array `[i]`), `matN`, `sampler2D` (`texture` isn't a member but may imply usage), structs can't be user-defined in Shadertoy, so built-in types cover most of it.
- Files: `src/glsl-completions.ts` (add member source), `src/editor.ts` (register source), plus tests.

**Open decisions:**
- Handle copy-propagation / reassignment (e.g. `q = somethingElse` changes `q`'s type), or resolve to the first declaration only for v1.
- Whether to include `matN` prototype-style members and array indexing suggestions, or just the simple vector component accessors first.
