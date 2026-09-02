import { Completion, snippetCompletion } from "@codemirror/autocomplete";
import { EditorSelection } from "@codemirror/state";

/**
 * Variable → type tracking for the editor's autocomplete.
 *
 * Scans the current doc for GLSL variable declarations and exposes the member /
 * constructor completions each type supports, so a completion source can say
 * "the identifier left of `.` is a vec4, so offer its swizzle accessors".
 *
 * This is deliberately a shallow regex scan, not a full GLSL parser — the same
 * pragmatic trade the preprocessor and line-explainer already make.
 */

// The GLSL scalar/vector/matrix/sampler types a variable can be declared with.
const KNOWN_TYPES = new Set([
  "float", "int", "uint", "bool", "double",
  "vec2", "vec3", "vec4",
  "ivec2", "ivec3", "ivec4",
  "bvec2", "bvec3", "bvec4",
  "mat2", "mat3", "mat4",
  "sampler2D", "samplerCube",
]);

/** Recognize a vector type and the number of its components, else null. */
function vectorComponents(type: string): number | null {
  const m = type.match(/^[ib]?vec(\d)$/);
  return m ? Number(m[1]) : null;
}

/** Recognize a matrix type and its dimension, else null. */
function matrixDimension(type: string): number | null {
  const m = type.match(/^mat(\d)$/);
  return m ? Number(m[1]) : null;
}

const SWIZZLE: { char: string; detail: string }[] = [
  { char: "x", detail: "x component" },
  { char: "y", detail: "y component" },
  { char: "z", detail: "z component" },
  { char: "w", detail: "w component" },
  { char: "r", detail: "red channel" },
  { char: "g", detail: "green channel" },
  { char: "b", detail: "blue channel" },
  { char: "a", detail: "alpha channel" },
  { char: "s", detail: "s texture coord" },
  { char: "t", detail: "t texture coord" },
  { char: "p", detail: "p texture coord" },
  { char: "q", detail: "q texture coord" },
];

/** A variable declaration and the function body (scope) it lives in. */
export interface VarDecl {
  type: string;
  /** Enclosing function name, or "" for variables at file scope. */
  scope: string;
  /** Document offset of the line the declaration starts on. Resolution is
   *  line-granular: the declaration becomes visible from this line onward. */
  lineStart: number;
}

// <type> <name> [array] — leading segment of a declaration, possibly preceded
// by an opening brace (one-line function body) and a qualifier/precision span.
// Falls in front of a `;`-split segment and matches only the first two words.
const DECL_SEGMENT = /^\s*\{?\s*(?:(?:const|uniform|in|out|varying|attribute)\s+)?(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+(\w+)\b/;
// A function definition — return type, name, params (all up to the closing `)`).
// The opening brace is NOT required here; it may share the line or be next.
const FUNC_HEADER = /^([\w.]+)\s+(\w+)\s*\(([^)]*)\)/;
// A single function parameter: optional qualifier + precision, then type name.
const PARAM = /^(?:(?:in|out|inout)\s+)?(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+(\w+)(?:\s*\[[^\]]*\])?$/;

function braces(line: string): number {
  const opens = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  return opens - closes;
}

/** A resolved function parameter — its name and type. */
interface Param {
  name: string;
  type: string;
}

/** Parse a function's parameter list into `{ name, type }[]`, type-validated. */
function parseParams(paramsSrc: string): Param[] {
  if (!paramsSrc.trim()) return [];
  const out: Param[] = [];
  for (const raw of paramsSrc.split(",")) {
    const p = raw.trim();
    const m = p.match(PARAM);
    if (m && KNOWN_TYPES.has(m[1])) out.push({ name: m[2], type: m[1] });
  }
  return out;
}

/** Enclosing function scope for each line: `{ lineStart, scope }[]`. */
interface LineScope {
  lineStart: number;
  scope: string;
  /** A function whose body opens mid-line (same-line or brace-on-next-line): the
   *  raw-doc offset of its `{` and the scope it activates from there on. */
  opened?: { offset: number; scope: string };
}

/** Single-pass parse result: enclosing scope per line + all declarations. */
interface Analysis {
  lines: LineScope[];
  vars: Map<string, VarDecl[]>;
}

/**
 * Parse `src`, memoized by content. One keystroke's completion work re-analyzes
 * the same doc several times (dot/bracket resolution, scope lookup, word
 * listing); a content-keyed cache lets one analysis serve them all and stays
 * correct across every state the editor can hold.
 */
let cachedSrc = "";
let cachedAnalysis: Analysis | null = null;
function analyze(src: string): Analysis {
  if (src === cachedSrc && cachedAnalysis) return cachedAnalysis;
  cachedSrc = src;
  return (cachedAnalysis = analyzeOnce(src));
}

/**
 * Walk the source once, in a single pass, producing both the enclosing scope
 * at the start of every line and every variable declaration (function params
 * and body locals) tagged with its scope.
 *
 * Handles all function brace styles with one tracker: the header, a `{` on the
 * same line (multiline or one-line), or a `{` on the following line (held in
 * `pendingParams` until it arrives). One-line function bodies are supported:
 * locals and params are found and correctly scoped. Commented lines (`//`) are
 * skipped, so a declaration inside a comment never registers.
 */
function analyzeOnce(src: string): Analysis {
  const vars = new Map<string, VarDecl[]>();
  const lines: LineScope[] = [];
  let scope = ""; // enclosing function name, "" = file scope
  let depth = 0; // brace depth
  const stack: { name: string; baseDepth: number }[] = [];
  let pendingName = "";
  let pendingParams: { params: Param[]; lineStart: number } | null = null;
  let lineStart = 0;

  const add = (name: string, type: string, sc: string, lineStart: number) => {
    const list = vars.get(name) ?? [];
    list.push({ type, scope: sc, lineStart });
    vars.set(name, list);
  };

  for (const raw of src.split("\n")) {
    lines.push({ lineStart, scope });
    const line = raw.split("//")[0].trim();
    if (line) {
      const fm = line.match(FUNC_HEADER);

      if (fm) {
        // A new header supersedes a pending one whose brace never arrived,
        // so a later unrelated `{` can't open under a stale name.
        pendingName = "";
        pendingParams = null;
        const name = fm[2];
        const params = parseParams(fm[3]);
        if (line.includes("{")) {
          // Body opens on this line (multiline or one-line); open now.
          stack.push({ name, baseDepth: depth + 1 });
          scope = name;
          for (const p of params) add(p.name, p.type, name, lineStart);
          lines[lines.length - 1].opened = { offset: raw.indexOf("{"), scope: name };
        } else {
          // Brace is on a later line; hold the params until it arrives.
          pendingName = name;
          pendingParams = { params, lineStart };
        }
      } else if (pendingParams && line.includes("{")) {
        // The pending header's brace arrives on this line (brace-on-next-line).
        stack.push({ name: pendingName, baseDepth: depth + 1 });
        scope = pendingName;
        for (const p of pendingParams.params) add(p.name, p.type, pendingName, pendingParams.lineStart);
        lines[lines.length - 1].opened = { offset: raw.indexOf("{"), scope: pendingName };
        pendingName = "";
        pendingParams = null;
      }

      // Extract declarations from the line, tagged with the current scope.
      // On a header line, skip the header itself so its name isn't a "var".
      const rest = fm ? line.slice(fm[0].length) : line;
      for (const seg of rest.split(";")) {
        const d = seg.match(DECL_SEGMENT);
        if (d && KNOWN_TYPES.has(d[1])) add(d[2], d[1], scope, lineStart);
      }

      depth += braces(line);
      while (stack.length && stack[stack.length - 1].baseDepth > depth) stack.pop();
      scope = stack.length ? stack[stack.length - 1].name : "";
    }
    lineStart += raw.length + 1;
  }
  return { lines, vars };
}

/**
 * Scan GLSL source for variable declarations, tracking the function body each
 * one lives in. Includes function parameters. Same-name declarations are kept
 * as a list (each with its scope), so a name reused in different functions no
 * longer shadows across scopes. Plain reassignment (`q = other;`) is not
 * tracked.
 */
export function scanVariables(src: string): Map<string, VarDecl[]> {
  return analyze(src).vars;
}

/**
 * Enclosing function names for every line. Binary-searched by callers that
 * need the scope at an arbitrary cursor position.
 */
function lineScopes(src: string): LineScope[] {
  return analyze(src).lines;
}

/**
 * The line `pos` falls on, found by binary search. Position-aware resolution
 * uses its start offset to decide which declarations are visible.
 */
function lineContaining(lines: LineScope[], pos: number): LineScope {
  let lo = 0;
  let hi = lines.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].lineStart <= pos) lo = mid + 1;
    else hi = mid;
  }
  return lines[lo - 1];
}

/**
 * Resolve the effective type of `name` visible at `scope` (a function name, or
 * "" for file scope) from `pos` in the doc. Only declarations at or before
 * `pos`'s line are visible (GLSL has no hoisting), so a variable declared after
 * the cursor is neither resolved nor offered. A file-scope declaration is seen
 * by every scope; a declaration in the same function shadows it. Out-of-scope
 * declarations (other functions) are never consulted. Among the visible
 * candidates the later one wins. `pos` defaults to the end of the doc.
 */
export function resolveVariable(
  src: string,
  scope: string,
  name: string,
  pos = Number.POSITIVE_INFINITY,
): string | null {
  const decls = scanVariables(src).get(name);
  if (!decls) return null;
  const posLine = lineContaining(lineScopes(src), pos).lineStart;
  let type: string | null = null;
  for (const d of decls) {
    if (d.lineStart <= posLine && (scope === "" || d.scope === scope || d.scope === "")) type = d.type;
  }
  return type;
}

/**
 * All variables visible at `scope` from `pos`, mapping name → effective type.
 * Same hoisting rule as `resolveVariable`: only declarations at or before
 * `pos`'s line are included.
 */
export function variablesInScope(
  src: string,
  scope: string,
  pos = Number.POSITIVE_INFINITY,
): Map<string, string> {
  const result = new Map<string, string>();
  const posLine = lineContaining(lineScopes(src), pos).lineStart;
  for (const [name, decls] of scanVariables(src)) {
    let type: string | null = null;
    for (const d of decls) {
      if (d.lineStart <= posLine && (scope === "" || d.scope === scope || d.scope === "")) type = d.type;
    }
    if (type !== null) result.set(name, type);
  }
  return result;
}

/** Enclosing function name at document offset `pos`, or "" at file scope. */
export function enclosingFunction(src: string, pos: number): string {
  const line = lineContaining(lineScopes(src), pos);
  // A function body may open mid-line (one-line function, `void main() {`), so
  // the scope is the opened function only at/after its `{` offset.
  if (line.opened && pos >= line.lineStart + line.opened.offset) return line.opened.scope;
  return line.scope;
}

/**
 * Dot-members and bracket-skeleton completions for a resolved variable type.
 *
 * Vectors → swizzle accessors (positions, colors, texture coords). Matrices → a
 * `m[0][0]` indexing skeleton whose row index is left selected. Scalars,
 * samplers, and arrays have no such accessors.
 */
export function membersForType(type: string): Completion[] {
  const components = vectorComponents(type);
  if (components !== null) {
    // Only offer swizzles the vector dimension actually supports: a vec2 has
    // `.x .y .r .g .s .t`, a vec3 adds `.z .b .p`, a vec4 adds `.w .a .q`.
    // The user already typed `.`, so each completion applies just the swizzle
    // char at the cursor (from = after the dot), never a leading `.`.
    return SWIZZLE.filter((_, i) => i % 4 < components).map(({ char, detail }) => ({
      label: "." + char,
      type: "keyword",
      apply: char,
      detail,
    }));
  }
  if (matrixDimension(type) !== null) {
    // The user already typed `[`, so this replaces it (from = position of the
    // `[`) with the full skeleton. A plain apply is used instead of a snippet:
    // the two-field snippet's field activation raced (intermittently degrading
    // to empty fields), and `[0][0]` with the cursor in the row index needs no
    // Tab-through-column chrome.
    return [{
      label: "[row][col]",
      type: "keyword",
      detail: "index skeleton",
      apply: (view, _completion, from, to) => {
        view.dispatch({
          changes: { from, to, insert: "[0][0]" },
          selection: EditorSelection.cursor(from + 1),
        });
      },
    }];
  }
  return [];
}

/** Types that can be constructed with a literal constructor. */
const CONSTRUCTOR_TYPES = [
  "vec2", "vec3", "vec4",
  "ivec2", "ivec3", "ivec4",
  "bvec2", "bvec3", "bvec4",
  "mat2", "mat3", "mat4",
  "float", "int", "uint", "bool",
];

/** Constructor completions shown alongside the bare type keyword. */
export function constructorCompletions(): Completion[] {
  return CONSTRUCTOR_TYPES.map((type) =>
    snippetCompletion(type + "(${0})", { label: type, detail: "constructor", boost: -100 } as Completion)
  );
}
