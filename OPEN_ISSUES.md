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

## 2. Align to 10k24 branding, then a shared library

**Goal:** Match the header/footer layout and branding of this app to id.10k24.com, using the studio's existing brand assets (already in `public/img/`; Typekit font loaded on id.10k24.com is `rli7dce`).

**Approach / notes:**
- Reconcile header/footer structure, typography, and logo treatment with id.10k24.com.
- **Roadmap:** extract the header/footer/branding into a shared 10k24 component library that all studio projects consume instead of duplicating.
- **Flag:** id.10k24.com is a React/Vite app; this app is vanilla TS/Vite. The shared-library consolidation must resolve this framework mismatch.

---

## 3. Sleepless design system — rem layout cleanup (single source of truth)

**Goal:** Stand up **Sleepless**, the 10k24 design system, as the single source of truth for CSS/design tokens that all studio projects consume. This glsl-editor is the seed/consumer.

**Status:** Note-only for now. The concrete `px → rem` refactor and inconsistency cleanup is **deferred until Sleepless is planned**.

**Approach / notes:**
- Current `src/style.css` mixes `px` and `rem` units and mixes palettes (Tokyo-Night chrome leftovers vs the 10k24 black/white/`#F24E1E`/`#0ACF83` header/footer).
- `src/index.css` (`tailwindcss` + `tw-animate-css`) is **dead code** — nothing imports it (`src/main.ts` imports only `style.css`). Remove it as part of the Sleepless cleanup.
- Define tokens (spacing scale in `rem`, semantic colors, type scale) once; consume everywhere.

---

## 4. Swap syntax-highlight theme to 10k24 (TBD)

**Goal:** Replace the current CodeMirror Tokyo-Night scheme with a 10k24 syntax theme.

**Approach / notes:**
- Replace `oneDark` + the custom Tokyo-Night `baseTheme` in `src/editor.ts` (colors `#0d0f14`, `#7aa2f7`, `#9aa5ce`, etc.).
- Covers editor surface, autocomplete tooltip, completion popups, error-line/gutter colors.
- **Spec TBD** — pending the Sleepless palette.

---

## 5. Deferred — unify cross-file string contracts & palette (single source of truth)

**Status:** Mostly done. `#s=`, `cm-error-*`, and `hidden` unified; `info-badge` + palette remain (tie into Sleepless, item 3).

**Findings (from design-philosophy audit):**
- ✅ **`#s=` share prefix** unified: `share.ts` now exports `isShareHash()` and both `share.ts` (decode) and `main.ts` use it.
- ✅ **`cm-error-*` class strings** unified: `error-lines.ts` exports `ERROR_LINE_CLASS`/`ERROR_MARKER_CLASS`/`ERROR_GUTTER_CLASS`; `editor.ts` theme and `error-lines.ts` both import them.
- ✅ **`hidden` class** unified: new `src/dom.ts` exports `toggleHidden()`; `main.ts` `showError()` and `define-panel.ts` `render()` use it. Single source for the class name.
- ⬜ **`info-badge-${kind}` class names** produced in `src/info-panel.ts`, styled in `src/style.css`. (CSS selectors can't consume a TS constant, so unifying the *class-name* here yields no shared value; revisit if Sleepless introduces CSS custom classes.)
- ⬜ **Color palette** (`#0d0f14`, `#7aa2f7`, `#f7768e`, …) duplicated across `src/editor.ts`, `src/style.css`, `src/index.css` (dead), and `index.html` meta theme-color. Pull into token variables (→ Sleepless).

---

## 6. Deferred — unify duplicated technical/content knowledge

**Status:** Deferred out of the Tier-1 cleanup (content-level, higher test/risk impact).

**Findings (from design-philosophy audit):**
- **WebGL error-log format** parsed independently in `src/shader.ts:175` (`/ERROR:\s*(\d+):(\d+)/`) and `src/error-lines.ts:74` (`/ERROR:\s*\d+:(\d+)/`). Share one parser.
- **Defines grammar** scanned twice inside `src/glsl-preprocessor.ts` (`parseDefineFlags` at :21–40 and `preprocess` at :118–135), including the duplicated `// #define` comment rule. `parseDefineFlags` should be the single grammar authority.
- **`DocKind` → label mapping**: ✅ `KIND_LABELS` moved into `src/glsl-docs.ts` next to `DocKind` (info-panel imports it). ⬜ `CM_TYPE` in `src/glsl-completions.ts:4–10` maps `DocKind`→CM completion type and could also move beside the type.
- **GLSL function-semantics text** re-described in both `src/line-explain.ts` (`describeExpr`, ~26 functions) and `src/glsl-docs.ts`; update one, the other drifts. Unify the teaching content.

---

## 7. ✅ Done — Autocomplete: suggest variable members (`.field` after a typed variable)

**Status:** **Implemented.** Vector swizzle accessors, matrix `[0][0]` skeleton, and constructor options all ship.

**What was built:**
- **`src/glsl-vars.ts`** (new deep module): `scanVariables()` (name → type regex scan of the doc), `membersForType()`, `constructorCompletions()`, `KNOWN_TYPES` set.
- **`src/glsl-completions.ts`**: routes completion by context — bracket (`m[`), dot (`q.`), and word (keyword / function / type / constructor).
- **`src/editor.ts`**: `memberTriggerKeymap` + `insertThenComplete` fire `startCompletion` after typing `.` / `[`.
- **ON by default** (`index.html` `#ac-checkbox` `checked` + boot calls `setAutocomplete(true)`), **preference persisted** in `localStorage` (`glsl.autocomplete`), re-read on load.
- **Context hints** in the popup, dimmed via `.cm-completionDetail` opacity: swizzle members carry `"x component"`, `"red channel"`, `"s texture coord"`, etc.; matrix skeleton shows `"index skeleton"`; constructors show `"constructor"`.
- Vectors expose `.x .y .z .w .r .g .b .a .s .t .p .q`; matrices a `m[0][0]` skeleton with cursor landing on the row index; bare type keyword + constructor both offered for type words. Scalars/mat/sampler have no dot-notation (design decision).

**Coverage:** `test/glsl-vars.test.ts` (unit), `test/autocomplete.e2e.ts` (4 e2e), localStorage persistence covered in `test/boot.e2e.ts`. Full suite green (56 unit, 21 e2e) as of this update.

**Deferred (captured from open decisions, if revisited):** copy-propagation / reassignment type tracking (currently resolves to last declaration).

---

## 8. GA4 event tracking: `shader_share` + `presentation_start`

**Goal:** Send two custom GA4 events with the shader's share-URL, content-fingerprinted.

**Scope (trimmed from a larger proposal — user wants only these two):**
- `shader_share` — fired on Share button click.
- `presentation_start` — fired on Present button click (also captures the shader URL).
- Explicit **non-goals**: no `compile_error`, `autocomplete_toggle`, `shader_reset`, `render_toggle`, `define_toggle`, `presentation_end`; no dev-gating change (gtag.js loads as-is, including on localhost).

**Key constraint (why we fingerprint):** GA4 caps custom event parameter *values* at **100 chars** (only `page_location` gets 1,000). A full compressed `#s=` shader URL is typically hundreds of chars and would be truncated, so it's never sent raw. Instead:
- Send a **SHA-1 fingerprint** (hex, 40 chars — well under the limit) of the full share-URL as a `shader_url` param. Collision-resistant for dedupe, privacy-safe, no truncation ambiguity.
- SHA-1 chosen over MD5: exposed directly by `crypto.subtle.digest` (built-in WebCrypto, zero deps, works on https + localhost); MD5 would need a dependency. Collision risk negligible for dedupe.
- GA4 does not auto-capture the shared link (it only sees `page_location` = the clean address bar), so the event is the only way to get it.

**Design (deep module, single source of truth for GA naming/limits):**
- New `src/analytics.ts`:
  - `track(event, params)` — no-ops safely when `typeof gtag !== "function"` (GA absent/blocked).
  - `fingerprint(text)` — `crypto.subtle.digest("SHA-1", ...)` → hex.
  - `EVENTS` constants — event/param names defined once.
- `src/main.ts`:
  - Reuse the existing URL-building logic from the Share click handler (default shader → clean URL; else `base + "#" + encodeShare(doc, overrides)`).
  - `shader_share`: `track(EVENTS.shaderShare, { shader_url: await fingerprint(url), copied: "success" | "failed" })` (`copied` from the clipboard promise — cheap signal that sharing actually worked).
  - `presentation_start`: build the same share-URL and `track(EVENTS.presentationStart, { shader_url: await fingerprint(url) })`; Present handler becomes async.

**Coverage:** new `test/analytics.test.ts` — stub `window.gtag`, assert `track()` forwards the correct event name + params; assert `fingerprint()` returns a stable 40-char hex; assert `track()` no-ops when `gtag` is undefined. (`crypto.subtle` is available in Vitest's Node runtime — no mock needed.)

**Open / out-of-band:** registering `shader_url` (+ `copied`) as a **custom dimension** in the GA4 dashboard must be done manually to make the params reportable.
