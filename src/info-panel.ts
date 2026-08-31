import { findBestDocForLine, KIND_LABELS } from "./glsl-docs";
import { explainLine } from "./line-explain";

export function createInfoPanel(container: HTMLElement): (lineText: string, lineNum: number) => void {
  container.innerHTML = `
    <div id="info-explain"></div>
    <div id="info-token-section">
      <div id="info-token-row">
        <span id="info-badge"></span>
        <code id="info-token"></code>
        <span id="info-sig"></span>
      </div>
      <div id="info-desc"></div>
    </div>
  `;

  const explainEl  = container.querySelector<HTMLElement>("#info-explain")!;
  const tokenSec   = container.querySelector<HTMLElement>("#info-token-section")!;
  const badge      = container.querySelector<HTMLElement>("#info-badge")!;
  const tokenEl    = container.querySelector<HTMLElement>("#info-token")!;
  const sigEl      = container.querySelector<HTMLElement>("#info-sig")!;
  const descEl     = container.querySelector<HTMLElement>("#info-desc")!;

  function update(lineText: string) {
    const trimmed = lineText.trim();

    // ── Line explanation (always shown) ──────────────────
    const explanation = explainLine(trimmed);
    if (explanation) {
      explainEl.innerHTML = explanation;
      explainEl.style.opacity = "1";
    } else {
      // If there's nothing to explain, clear it out
      explainEl.textContent  = "";
    }

    // ── Token docs ────────────────────────────────────────
    const result = findBestDocForLine(trimmed);
    if (result) {
      const { token: tok, doc } = result;
      badge.textContent   = KIND_LABELS[doc.kind];
      badge.className     = `info-badge-${doc.kind}`;
      tokenEl.textContent = tok;
      sigEl.textContent   = doc.signature ?? "";
      descEl.textContent  = doc.description;
      tokenSec.style.display = "flex";
    } else {
      tokenSec.style.display = "none";
    }
  }

  return update;
}
