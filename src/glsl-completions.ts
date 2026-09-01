import { CompletionContext, CompletionResult, Completion } from "@codemirror/autocomplete";
import { GLSL_DOCS, DocKind } from "./glsl-docs";
import {
  resolveVariable,
  variablesInScope,
  enclosingFunction,
  membersForType,
  constructorCompletions,
} from "./glsl-vars";

const CM_TYPE: Record<DocKind, Completion["type"]> = {
  function:  "function",
  type:      "type",
  variable:  "variable",
  qualifier: "keyword",
  keyword:   "keyword",
};

// Build the keyword/function completion list once — never changes
const GLSL_COMPLETIONS: Completion[] = Object.entries(GLSL_DOCS).map(([label, doc]) => ({
  label,
  type: CM_TYPE[doc.kind],
  detail: doc.signature ?? undefined,
  info: doc.description,
  boost: doc.kind === "function" ? 1 : 0,
}));

// Resolver: look up the type of an identifier left of a `.` or `[` in the
// current doc, honoring the enclosing function scope (a same-name variable in a
// different function must not shadow this one).
function resolveType(ctx: CompletionContext, identEnd: number): string | null {
  const line = ctx.state.doc.lineAt(ctx.pos).text;
  const start = identEnd - 1;
  if (start < 0) return null;
  const ident = line.slice(0, identEnd).match(/(\w+)$/);
  if (!ident) return null;
  const doc = ctx.state.doc.toString();
  const scope = enclosingFunction(doc, ctx.pos);
  return resolveVariable(doc, scope, ident[1]);
}

export function glslCompletionSource(ctx: CompletionContext): CompletionResult | null {
  const mainLine = ctx.state.doc.lineAt(ctx.pos);
  const line = mainLine.text;
  const pos = ctx.pos - mainLine.from; // line-relative cursor offset // = cursor offset in the line
  const ch = pos > 0 ? line[pos - 1] : "";

  // ── Bracket context: `m[` — matrix-index skeleton ─────────────────────
  if (ch === "[" && pos >= 2 && /\w/.test(line[pos - 2])) {
    const type = resolveType(ctx, pos - 1);
    if (type) {
      // Vectors are indexed with dot-swizzles, not `[i]`; offering a swizzle
      // char here would replace the `[` and produce `vx`. Only matrices get a
      // bracket skeleton. (Scalars already return no members.)
      if (/^[ib]?vec\d$/.test(type)) return null;
      const options = membersForType(type);
      // from covers the typed `[`, so the skeleton replaces it.
      if (options.length > 0) return { from: ctx.pos - 1, options, validFor: /^\[?\d*$/ };
    }
    return null;
  }

  // ── Dot-member context: `q.` — swizzle accessors ──────────────────────
  if (ch === "." && pos >= 2 && /\w/.test(line[pos - 2])) {
    const type = resolveType(ctx, pos - 1);
    if (type) {
      const options = membersForType(type);
      if (options.length > 0) return { from: ctx.pos, options, validFor: /^\w*$/ };
    }
    return null;
  }

  // ── Word context: variable / keyword / function / type / constructor ──
  const word = ctx.matchBefore(/\w+/);
  if (!word) return null;
  if (word.from === word.to && !ctx.explicit) return null;

  const typed = word.text.toLowerCase();
  const keywordOpts = GLSL_COMPLETIONS.filter(c =>
    c.label.toLowerCase().startsWith(typed)
  );

  const ctorOpts = constructorCompletions().filter(c =>
    c.label.toLowerCase().startsWith(typed)
  );

  // User-declared variables in scope rank first — that's what the user most
  // likely wants to reference. Variables in another function are out of scope
  // and deliberately not offered.
  const doc = ctx.state.doc.toString();
  const scope = enclosingFunction(doc, ctx.pos);
  const varOpts = [...variablesInScope(doc, scope).entries()]
    .filter(([name]) => name.toLowerCase().startsWith(typed))
    .map(([name, type]) => ({ label: name, type: "variable", detail: type, boost: 2 }));

  const options = [...varOpts, ...keywordOpts, ...ctorOpts];
  if (options.length === 0) return null;

  return { from: word.from, options, validFor: /^\w*$/ };
}
