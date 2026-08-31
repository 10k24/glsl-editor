// Best-effort save/load of the raw shader source so work survives reloads.
// localStorage throws in some private-browsing modes; never let that break editing.

const DOC_KEY = "glsl-editor.doc";

export function loadDoc(): string | null {
  try {
    return localStorage.getItem(DOC_KEY);
  } catch {
    return null;
  }
}

export function storeDoc(doc: string) {
  try {
    localStorage.setItem(DOC_KEY, doc);
  } catch {
    // storage unavailable — skip saving
  }
}
