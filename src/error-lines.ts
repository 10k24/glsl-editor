import { StateEffect, StateField } from "@codemirror/state";
import { EditorView, Decoration, DecorationSet, GutterMarker, gutter } from "@codemirror/view";

// ── Effect to push new error line numbers into the editor ─────────────────────
export const setErrorLinesEffect = StateEffect.define<number[]>();

// ── Gutter marker: red dot shown in the gutter on error lines ─────────────────
class ErrorMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-error-marker";
    el.textContent = "●";
    el.title = "Compile error on this line";
    return el;
  }
}
const errorMarker = new ErrorMarker();

// ── State field: current set of error line numbers + their decorations ─────────
export const errorLinesField = StateField.define<{ lines: number[]; decos: DecorationSet }>({
  create() {
    return { lines: [], decos: Decoration.none };
  },

  update(value, tr) {
    // Handle explicit set-error-lines effects
    for (const e of tr.effects) {
      if (e.is(setErrorLinesEffect)) {
        const lines = e.value;
        const maxLine = tr.state.doc.lines;
        const decos =
          lines.length === 0
            ? Decoration.none
            : Decoration.set(
                lines
                  .filter((n) => n >= 1 && n <= maxLine)
                  .sort((a, b) => a - b)
                  .map((n) => {
                    const from = tr.state.doc.line(n).from;
                    return Decoration.line({ class: "cm-error-line" }).range(from);
                  })
              );
        return { lines, decos };
      }
    }
    // Remap decorations when the document changes so they track edits
    if (tr.docChanged) {
      return { lines: value.lines, decos: value.decos.map(tr.changes) };
    }
    return value;
  },

  provide(f) {
    return EditorView.decorations.from(f, (v) => v.decos);
  },
});

// ── Gutter extension: place the red dot marker on error lines ─────────────────
export const errorGutter = gutter({
  class: "cm-error-gutter",
  lineMarker(view, line) {
    const { lines } = view.state.field(errorLinesField);
    if (lines.length === 0) return null;
    const lineNo = view.state.doc.lineAt(line.from).number;
    return lines.includes(lineNo) ? errorMarker : null;
  },
  initialSpacer: () => errorMarker,
});

// ── Parse "ERROR: 0:LINE: …" from WebGL compiler output ──────────────────────
// Only returns the first (lowest) error line — cascading parse errors from a
// single mistake commonly produce spurious reports on every following line.
export function parseErrorLines(log: string): number[] {
  const re = /ERROR:\s*\d+:(\d+)/g;
  let m: RegExpExecArray | null;
  let first = Infinity;
  while ((m = re.exec(log)) !== null) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n) && n > 0 && n < first) first = n;
  }
  return first === Infinity ? [] : [first];
}
