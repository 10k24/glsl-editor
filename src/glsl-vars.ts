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

/**
 * Scan GLSL source for variable declarations (name → type).
 *
 * Handles unqualified, `uniform`/`in`/`out`/`varying`/`attribute`, `const`,
 * and precision-qualified declarations, with or without an initializer or an
 * array suffix. Lines with `//` comments are ignored, so a declaration inside
 * a comment never registers. Later declarations of the same name win
 * (redeclaration updates the type); plain reassignment (`q = other;`) is not
 * tracked — the type is left at the last declaration.
 */
export function scanVariables(src: string): Map<string, string> {
  const vars = new Map<string, string>();
  // Optional qualifier span and precision, then <type> <name> [array] [= init];
  const decl = /^(?:(?:const|uniform|in|out|varying|attribute)\s+)?(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+(\w+)(?:\s*\[[^\]]*\])?(?:\s*=\s*[^;]*?)?\s*;?$/;

  for (const raw of src.split("\n")) {
    const line = raw.split("//")[0].trim();
    const m = line.match(decl);
    if (!m) continue;
    // Only a known type token counts as a declaration — this rejects
    // statements like `return value;` from being misread as `type name`.
    if (!KNOWN_TYPES.has(m[1])) continue;
    vars.set(m[2], m[1]);
  }
  return vars;
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
