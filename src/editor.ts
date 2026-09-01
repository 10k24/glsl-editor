import { EditorState, Compartment, Prec } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from "@codemirror/commands";
import { StreamLanguage, bracketMatching, indentOnInput } from "@codemirror/language";
import { shader } from "@codemirror/legacy-modes/mode/clike";
import { oneDark } from "@codemirror/theme-one-dark";
import { autocompletion, closeBrackets, completionKeymap, acceptCompletion, startCompletion } from "@codemirror/autocomplete";
import { glslCompletionSource } from "./glsl-completions";
import { ERROR_GUTTER_CLASS, ERROR_LINE_CLASS, ERROR_MARKER_CLASS, setErrorLinesEffect, errorLinesField, errorGutter, parseErrorLines } from "./error-lines";

const glslLang = StreamLanguage.define(shader);
const autocompleteComp = new Compartment();

// Typing `.` or `[` after an identifier should open member completion for the
// variable left of it. CM6 only auto-opens the popup on word characters, so
// these keys insert the trigger char and then explicitly start completion.
const memberTriggerKeymap = keymap.of([
  { key: ".", run: insertThenComplete(".") },
  { key: "[", run: insertThenComplete("[") },
]);

function insertThenComplete(ch: string): (view: EditorView) => boolean {
  return (view) => {
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: ch },
      selection: { anchor: from + ch.length },
    });
    startCompletion(view);
    return true;
  };
}

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
  [`.${ERROR_LINE_CLASS}`]: {
    backgroundColor: "rgba(247, 118, 142, 0.08) !important",
    borderLeft: "3px solid #f7768e",
    paddingLeft: "13px !important",
  },
  // Error gutter marker
  [`.${ERROR_GUTTER_CLASS} .${ERROR_MARKER_CLASS}`]: {
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
  ".cm-completionDetail": { color: "#7aa2f7", opacity: 0.55, fontSize: "0.85rem", fontStyle: "normal", marginLeft: "8px" },
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
        history(),
        errorLinesField,
        errorGutter,
        Prec.highest(keymap.of([{ key: "Tab", run: acceptCompletion }])),
        Prec.high(memberTriggerKeymap),
        Prec.high(keymap.of(completionKeymap)),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
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

  function setDoc(text: string) {
    // Plain transaction (not state replacement) so undo history survives —
    // e.g. cmd+z restores the user's shader after a reset or share-link load.
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: { anchor: 0 },
    });
  }

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

  // Test seam for CM6 history: headless Chromium doesn't emit the `beforeinput`
  // events CM6's history() needs, so E2E can't drive undo/redo via Mod-z. Expose
  // the commands on window only in dev (the E2E server); stripped from prod builds.
  if (import.meta.env.DEV) {
    window.__cmUndo = () => undo(view);
    window.__cmRedo = () => redo(view);
  }

  return { view, setDoc, setAutocomplete, setErrorLines, getDoc: () => view.state.doc.toString() };
}
