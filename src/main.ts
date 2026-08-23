import "./style.css";
import { createEditor } from "./editor";
import { createRenderer } from "./shader";
import { createInfoPanel } from "./info-panel";
import { createDefinePanel } from "./define-panel";
import { preprocess } from "./glsl-preprocessor";

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

// ── Local persistence ────────────────────────────────────
// Best-effort save of the raw shader source so work survives reloads.
// localStorage throws in some private-browsing modes; never let that break editing.
const DOC_KEY = "glsl-editor.doc";

function loadDoc(): string | null {
  try {
    return localStorage.getItem(DOC_KEY);
  } catch {
    return null;
  }
}

function storeDoc(doc: string) {
  try {
    localStorage.setItem(DOC_KEY, doc);
  } catch {
    // storage unavailable — skip saving
  }
}

const initialDoc = loadDoc() ?? DEFAULT_SHADER;

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

// ── Info panel ───────────────────────────────────────────
const updateInfoPanel = createInfoPanel(infoPaneEl);

// ── Define panel ─────────────────────────────────────────
let activeDefineOverrides = new Map<string, boolean>();
const updateDefinePanel = createDefinePanel(definePaneEl, (overrides) => {
  activeDefineOverrides = overrides;
  renderer?.updateShader(preprocess(editor.getDoc(), activeDefineOverrides));
});

// ── Editor ───────────────────────────────────────────────
const editor = createEditor(editorCmEl, initialDoc, {
  onChange: (doc) => {
    updateDefinePanel(doc);
    scheduleUpdate(doc);
  },
  onCursorLine: (lineText, lineNum) => updateInfoPanel(lineText, lineNum),
});

// ── Error display ────────────────────────────────────────
function showError(msg: string | null) {
  editor.setErrorLines(msg);
  if (msg) {
    statusOk.classList.add("hidden");
    statusErr.classList.remove("hidden");
    errorOverlay.textContent = msg;
    errorOverlay.classList.remove("hidden");
  } else {
    statusOk.classList.remove("hidden");
    statusErr.classList.add("hidden");
    errorOverlay.classList.add("hidden");
    errorOverlay.textContent = "";
  }
}

// ── Debounced shader update ──────────────────────────────
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let renderer: ReturnType<typeof createRenderer>;

function scheduleUpdate(src: string) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    renderer?.updateShader(preprocess(src, activeDefineOverrides));
    storeDoc(src);
  }, 280);
}

// ── Renderer ─────────────────────────────────────────────
renderer = createRenderer(canvas, showError);
updateDefinePanel(initialDoc);
renderer?.updateShader(preprocess(initialDoc, activeDefineOverrides));

// ── Trigger initial info panel for line 1 ────────────────
updateInfoPanel(initialDoc.split("\n")[0], 1);

// ── Autocomplete toggle ──────────────────────────────────
acCheckbox.addEventListener("change", () => {
  editor.setAutocomplete(acCheckbox.checked);
});

// ── Reset to default shader ──────────────────────────────
const resetBtn = document.getElementById("reset-btn")!;

resetBtn.addEventListener("click", () => {
  // Plain transaction (not state replacement) so undo history survives —
  // cmd+z restores the user's shader after a reset.
  editor.view.dispatch({
    changes: { from: 0, to: editor.view.state.doc.length, insert: DEFAULT_SHADER },
    selection: { anchor: 0 },
  });
});

// ── Resizable divider ────────────────────────────────────
let dragging = false;

divider.addEventListener("mousedown", (e) => {
  e.preventDefault();
  dragging = true;
  divider.classList.add("dragging");
});

window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const rect = body.getBoundingClientRect();
  const divW = divider.offsetWidth;
  let px = e.clientX - rect.left - divW / 2;
  px = Math.max(200, Math.min(rect.width - divW - 200, px));
  editorPaneEl.style.width = px + "px";
  editorPaneEl.style.flex = "none";
});

window.addEventListener("mouseup", () => {
  if (dragging) {
    dragging = false;
    divider.classList.remove("dragging");
  }
});
