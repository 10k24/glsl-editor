import "./style.css";
import { createEditor } from "./editor";
import { createRenderer } from "./shader";
import { createInfoPanel } from "./info-panel";
import { createDefinePanel } from "./define-panel";
import { createDividerResizer } from "./resizer";
import { toggleHidden } from "./dom";
import { loadDoc, storeDoc } from "./persistence";
import { preprocess } from "./glsl-preprocessor";
import { decodeShare, encodeShare, isShareHash } from "./share";

const DEFAULT_SHADER = `precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv = uv * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;

  float d = length(uv);
  vec3 col = 0.5 + 0.5 * cos(u_time * 0.8 + uv.xyx * 2.5 + vec3(0.0, 2.1, 4.2));
  col *= smoothstep(1.4, 0.2, d);

  gl_FragColor = vec4(col, 1.0);
}
`;

// Precedence: shared link (#s=…) > localStorage > default. Hash decoding is async,
// so boot renders the sync source and swaps when the payload arrives.
const hasSharedLink = isShareHash(location.hash);
const initialDoc = hasSharedLink ? DEFAULT_SHADER : loadDoc() ?? DEFAULT_SHADER;

const editorPaneEl  = document.getElementById("editor-pane")!;
const editorCmEl    = document.getElementById("editor-cm")!;
const definePaneEl  = document.getElementById("define-panel")!;
const infoPaneEl    = document.getElementById("info-panel")!;
const canvas        = document.getElementById("canvas") as HTMLCanvasElement;
const statusOk     = document.getElementById("status-ok")!;
const statusErr    = document.getElementById("status-err")!;
const errorOverlay = document.getElementById("error-overlay")!;
const acCheckbox   = document.getElementById("ac-checkbox") as HTMLInputElement;
const divider      = document.getElementById("divider")!;
const body         = document.getElementById("body")!;

const yearEl = document.getElementById("year")!;
yearEl.textContent = String(new Date().getFullYear());

const fpsEl    = document.getElementById("fps")!;
const pauseBtn = document.getElementById("pause-btn")!;

// ── Info panel ───────────────────────────────────────────
const updateInfoPanel = createInfoPanel(infoPaneEl);

// ── Define panel ─────────────────────────────────────────
// The panel owns the define overrides; main reads them via getOverrides() so
// there is a single source of truth (no mirrored copy in this file).
const updateDefinePanel = createDefinePanel(definePaneEl, () => {
  // A define checkbox toggled — recompile immediately with the panel's state and
  // refresh the share hash so the define map stays in sync on the share link.
  renderer?.updateShader(preprocess(editor.getDoc(), updateDefinePanel.getOverrides()));
  updateLocationHash(editor.getDoc());
});

// ── Editor ───────────────────────────────────────────────
const editor = createEditor(editorCmEl, initialDoc, {
  onChange: (doc) => {
    updateDefinePanel.update(doc);
    scheduleUpdate(doc);
  },
  onCursorLine: (lineText, lineNum) => updateInfoPanel(lineText, lineNum),
});

// ── Error display ────────────────────────────────────────
function showError(msg: string | null) {
  editor.setErrorLines(msg);
  toggleHidden(statusOk, !!msg);
  toggleHidden(statusErr, !msg);
  toggleHidden(errorOverlay, !msg);
  errorOverlay.textContent = msg ?? "";
}

// ── Debounced shader update ──────────────────────────────
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let renderer: ReturnType<typeof createRenderer>;
let hashWriteId = 0;
// Set to the doc text of an in-flight share import so its own autosave is
// suppressed: importing a link must not clobber the user's previously saved work
// in localStorage. The imported shader stays shareable via the URL hash.
let importDoc: string | null = null;

function activeOverrides() {
  return updateDefinePanel.getOverrides();
}

// Monotonic guard: fast typing starts overlapping async encodes — only the
// latest may touch the address bar, or a stale payload could win the race.
async function updateLocationHash(src: string) {
  const id = ++hashWriteId;
  const payload = await encodeShare(src, activeOverrides());
  if (id === hashWriteId) history.replaceState(null, "", "#" + payload);
}

function scheduleUpdate(src: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    renderer?.updateShader(preprocess(src, activeOverrides()));
    // Persist every edit except the raw imported share doc (consumed once).
    if (importDoc !== src) storeDoc(src);
    importDoc = null;
    updateLocationHash(src);
  }, 280);
}

// ── Renderer ─────────────────────────────────────────────
renderer = createRenderer(canvas, showError, (fps) => {
  // Tabular numerals avoid header width jitter as FPS changes. Only updates when
  // the standalone <span id="fps" class="hidden"> completes its first frame,
  // so it stays hidden while rendering is paused.
  fpsEl.classList.remove("hidden");
  fpsEl.textContent = `${fps} fps`;
});
updateDefinePanel.update(initialDoc);
renderer?.updateShader(preprocess(initialDoc, activeOverrides()));

// ── Trigger initial info panel for line 1 ────────────────
updateInfoPanel(initialDoc.split("\n")[0], 1);

// ── Import shared link, if any ───────────────────────────
if (hasSharedLink) {
  decodeShare(location.hash).then((shared) => {
    if (!shared) {
      console.warn("Ignoring malformed share link in URL fragment");
      return;
    }
    // Seed defines before the edit below so the recompile it triggers already
    // respects them.
    updateDefinePanel.setOverrides(shared.defines);
    importDoc = shared.doc;
    editor.setDoc(shared.doc);
  });
}

// ── Autocomplete toggle ──────────────────────────────────
acCheckbox.addEventListener("change", () => {
  editor.setAutocomplete(acCheckbox.checked);
});

// ── Pause/resume rendering ───────────────────────────────
pauseBtn.addEventListener("click", () => {
  const running = pauseBtn.textContent === "Pause";
  renderer?.setRunning(!running);
  pauseBtn.textContent = running ? "Play" : "Pause";
  pauseBtn.title = running ? "Resume rendering" : "Pause or resume rendering";
  if (running) fpsEl.classList.add("hidden");
});

// ── Reset to default shader ──────────────────────────────
const resetBtn = document.getElementById("reset-btn")!;

resetBtn.addEventListener("click", () => {
  // Plain transaction (not state replacement) so undo history survives —
  // cmd+z restores the user's shader after a reset.
  editor.setDoc(DEFAULT_SHADER);
});

// ── Share (copy current URL — hash is already live) ──────
const shareBtn = document.getElementById("share-btn")!;

shareBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(location.href).then(() => {
    const original = shareBtn.textContent;
    shareBtn.textContent = "Copied";
    setTimeout(() => {
      shareBtn.textContent = original;
    }, 1200);
  }).catch(() => {
    const original = shareBtn.textContent;
    shareBtn.textContent = "Copy failed";
    setTimeout(() => {
      shareBtn.textContent = original;
    }, 1200);
  });
});

// ── Resizable divider ────────────────────────────────────
createDividerResizer(divider, body, editorPaneEl);
