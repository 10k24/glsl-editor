import { EditorState, Compartment, Prec } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { StreamLanguage, bracketMatching, indentOnInput } from "@codemirror/language";
import { shader } from "@codemirror/legacy-modes/mode/clike";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion, closeBrackets, completionKeymap, acceptCompletion } from "@codemirror/autocomplete";
import { glslCompletionSource } from "./glsl-completions";
import { setErrorLinesEffect, errorLinesField, errorGutter, parseErrorLines } from "./error-lines";

const glslLang = StreamLanguage.define(shader);
const autocompleteComp = new Compartment();

const baseTheme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "#0d0f14" },
  ".cm-scroller": { overflow: "auto", height: "100%" },
  ".cm-content": { padding: "12px 0", caretColor: "#7aa2f7" },
  ".cm-line": { padding: "0 16px" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "#7aa2f7" },
  ".cm-activeLine": { backgroundColor: "rgba(122,162,247,0.05)" },
  ".cm-gutters": {
    backgroundColor: "#0d0f14",
    borderRight: "1px solid #1e2030",
    color: "#9aa5ce",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(122,162,247,0.06)",
    color: "#c0caf5",
  },
  // Error line decoration
  ".cm-error-line": {
    backgroundColor: "rgba(247, 118, 142, 0.08) !important",
    borderLeft: "3px solid #f7768e",
    paddingLeft: "13px !important",
  },
  // Error gutter marker
  ".cm-error-gutter .cm-error-marker": {
    color: "#f7768e",
    fontSize: "0.6rem",
    lineHeight: "1",
    paddingRight: "3px",
    cursor: "default",
  },
  // Autocomplete popup
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "#13151f",
    border: "1px solid #2a2d3e",
    borderRadius: "6px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
  },
  ".cm-tooltip-autocomplete ul li": {
    fontSize: "1rem",
    padding: "4px 10px",
    color: "#c0caf5",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "rgba(122,162,247,0.15)",
    color: "#c0caf5",
  },
  ".cm-completionLabel": { color: "#c0caf5" },
  ".cm-completionDetail": { color: "#7aa2f7", fontSize: "0.85rem", fontStyle: "normal", marginLeft: "8px" },
  ".cm-completionMatchedText": { color: "#9ece6a", fontWeight: "700", textDecoration: "none" },
  // Info popup beside completion
  ".cm-tooltip.cm-completionInfo": {
    backgroundColor: "#0d0f14",
    border: "1px solid #2a2d3e",
    borderRadius: "6px",
    color: "#a9b1d6",
    fontSize: "0.9rem",
    padding: "8px 12px",
    maxWidth: "320px",
    lineHeight: "1.5",
  },
}, { dark: true });

export interface EditorCallbacks {
  onChange: (doc: string) => void;
  onCursorLine: (lineText: string, lineNum: number) => void;
}

export function createEditor(
  container: HTMLElement,
  initialDoc: string,
  callbacks: EditorCallbacks
) {
  const view = new EditorView({
    state: EditorState.create({
      doc: initialDoc,
      extensions: [
        glslLang,
        oneDark,
        baseTheme,
        lineNumbers(),
        highlightActiveLine(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        errorLinesField,
        errorGutter,
        Prec.highest(keymap.of([{ key: "Tab", run: acceptCompletion }])),
        Prec.high(keymap.of(completionKeymap)),
        keymap.of([...defaultKeymap, indentWithTab]),
        EditorView.lineWrapping,
        autocompleteComp.of([]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            callbacks.onChange(update.state.doc.toString());
          }
          if (update.docChanged || update.selectionSet) {
            const state = update.state;
            const head = state.selection.main.head;
            const line = state.doc.lineAt(head);
            callbacks.onCursorLine(line.text, line.number);
          }
        }),
      ],
    }),
    parent: container,
  });

  function setAutocomplete(enabled: boolean) {
    view.dispatch({
      effects: autocompleteComp.reconfigure(
        enabled
          ? [autocompletion({ override: [glslCompletionSource], defaultKeymap: false })]
          : []
      ),
    });
  }

  function setErrorLines(log: string | null) {
    const lines = log ? parseErrorLines(log) : [];
    view.dispatch({ effects: setErrorLinesEffect.of(lines) });
  }

  return { view, setAutocomplete, setErrorLines, getDoc: () => view.state.doc.toString() };
}
