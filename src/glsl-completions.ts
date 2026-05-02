import { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import { GLSL_DOCS, DocKind } from "./glsl-docs";

const CM_TYPE: Record<DocKind, Completion["type"]> = {
  function:  "function",
  type:      "type",
  variable:  "variable",
  qualifier: "keyword",
  keyword:   "keyword",
};

// Build the completion list once — it never changes
const GLSL_COMPLETIONS: Completion[] = Object.entries(GLSL_DOCS).map(([label, doc]) => ({
  label,
  type: CM_TYPE[doc.kind],
  detail: doc.signature ?? undefined,
  info: doc.description,
  boost: doc.kind === "function" ? 1 : 0,
}));

export function glslCompletionSource(ctx: CompletionContext): CompletionResult | null {
  // Match a word that is at least 1 character, preceded by a word boundary
  const word = ctx.matchBefore(/\w+/);
  if (!word) return null;
  // Don't suggest when the user hasn't typed at least 1 char OR
  // cursor is in the middle of a word and wasn't explicitly triggered
  if (word.from === word.to && !ctx.explicit) return null;

  const typed = word.text.toLowerCase();

  const options = GLSL_COMPLETIONS.filter(c =>
    c.label.toLowerCase().startsWith(typed)
  );

  if (options.length === 0) return null;

  return {
    from: word.from,
    options,
    validFor: /^\w*$/,
  };
}
