// Best-effort save/load of the raw shader source so work survives reloads.
// localStorage throws in some private-browsing modes; never let that break editing.

const DOC_KEY = "glsl-editor.doc";
const AC_KEY = "glsl.autocomplete";

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

export function loadAutocomplete(): boolean | null {
  try {
    const stored = localStorage.getItem(AC_KEY);
    return stored === null ? null : stored === "1";
  } catch {
    return null;
  }
}

export function storeAutocomplete(enabled: boolean) {
  try {
    localStorage.setItem(AC_KEY, enabled ? "1" : "0");
  } catch {
    // storage unavailable — skip saving
  }
}
