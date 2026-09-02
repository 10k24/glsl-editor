import { describe, expect, it } from "vitest";
import {
  scanVariables,
  resolveVariable,
  variablesInScope,
  enclosingFunction,
  membersForType,
  constructorCompletions,
} from "../src/glsl-vars";

describe("scanVariables", () => {
  it("finds unqualified vec4 declaration at file scope", () => {
    const vars = scanVariables("vec4 color;");
    expect(vars.get("color")).toEqual([{ type: "vec4", scope: "", lineStart: 0 }]);
  });

  it("finds uniform declaration", () => {
    const vars = scanVariables("uniform sampler2D iChannel0;");
    expect(vars.get("iChannel0")).toEqual([{ type: "sampler2D", scope: "", lineStart: 0 }]);
  });

  it("finds const declaration", () => {
    const vars = scanVariables("const float PI = 3.14;");
    expect(vars.get("PI")).toEqual([{ type: "float", scope: "", lineStart: 0 }]);
  });

  it("finds precision-qualified declaration", () => {
    const vars = scanVariables("highp vec2 uv;");
    expect(vars.get("uv")).toEqual([{ type: "vec2", scope: "", lineStart: 0 }]);
  });

  it("finds in/out declarations", () => {
    const src = "in vec3 normal;\nout vec4 fragColor;";
    const vars = scanVariables(src);
    expect(vars.get("normal")).toEqual([{ type: "vec3", scope: "", lineStart: 0 }]);
    expect(vars.get("fragColor")).toEqual([{ type: "vec4", scope: "", lineStart: "in vec3 normal;\n".length }]);
  });

  it("finds array declaration", () => {
    const vars = scanVariables("float arr[8];");
    expect(vars.get("arr")).toEqual([{ type: "float", scope: "", lineStart: 0 }]);
  });

  it("finds declaration with initializer", () => {
    const vars = scanVariables("vec3 pos = vec3(0.0);");
    expect(vars.get("pos")).toEqual([{ type: "vec3", scope: "", lineStart: 0 }]);
  });

  it("ignores declarations inside comments", () => {
    const vars = scanVariables("// vec4 hidden;\nvec4 visible;");
    expect(vars.has("hidden")).toBe(false);
    expect(vars.has("visible")).toBe(true);
  });

  it("ignores non-declaration lines", () => {
    const vars = scanVariables("fragColor = vec4(1.0);\nreturn value;");
    expect(vars.size).toBe(0);
  });

  it("keeps same-name declarations as a list (scope-aware)", () => {
    const src =
      "vec2 weight = vec2(1.0);\n" +
      "float f(float x) {\n" +
      "  float weight = x;\n" +
      "  return weight;\n" +
      "}\n" +
      "void main() {}\n";
    const vars = scanVariables(src);
    expect(vars.get("weight")).toEqual([
      { type: "vec2", scope: "", lineStart: 0 },
      { type: "float", scope: "f", lineStart: src.indexOf("  float weight = x;") },
    ]);
  });

  it("ignores unknown types", () => {
    const vars = scanVariables("MyStruct foo;");
    expect(vars.has("foo")).toBe(false);
  });

  it("tracks a one-line function: params and local, scoped to it", () => {
    const vars = scanVariables("float square(float x) { float y = x * x; return y; }");
    expect(vars.get("x")).toEqual([{ type: "float", scope: "square", lineStart: 0 }]);
    expect(vars.get("y")).toEqual([{ type: "float", scope: "square", lineStart: 0 }]);
    // The function name itself is not a variable.
    expect(vars.has("square")).toBe(false);
  });

  it("tracks parameters on a multiline function", () => {
    const vars = scanVariables("float mix2(vec2 a, vec2 b) {\n  return a.x + b.x;\n}\n");
    expect(vars.get("a")).toEqual([{ type: "vec2", scope: "mix2", lineStart: 0 }]);
    expect(vars.get("b")).toEqual([{ type: "vec2", scope: "mix2", lineStart: 0 }]);
  });

  it("parses qualifier, precision, and array parameters", () => {
    const vars = scanVariables("float f(out vec4 col, highp vec2 uv, float arr[4]) {\n}\n");
    expect(vars.get("col")).toEqual([{ type: "vec4", scope: "f", lineStart: 0 }]);
    expect(vars.get("uv")).toEqual([{ type: "vec2", scope: "f", lineStart: 0 }]);
    expect(vars.get("arr")).toEqual([{ type: "float", scope: "f", lineStart: 0 }]);
  });

  it("does not register the function name as a variable", () => {
    const vars = scanVariables("vec2 weight = vec2(1.0);\nfloat f(float x) {\n}\n");
    expect(vars.has("f")).toBe(false);
    expect(vars.get("weight")).toEqual([{ type: "vec2", scope: "", lineStart: 0 }]);
  });

  it("scopes brace-on-next-line function bodies", () => {
    const src = "float f(float x)\n{\n  vec2 p = vec2(x);\n}\n";
    const vars = scanVariables(src);
    expect(vars.get("p")).toEqual([{ type: "vec2", scope: "f", lineStart: src.indexOf("  vec2 p = vec2(x);") }]);
    expect(vars.get("x")).toEqual([{ type: "float", scope: "f", lineStart: 0 }]);
  });

  it("returns file scope for an empty one-line function", () => {
    const vars = scanVariables("void main() {}\nvec2 g = vec2(1.0);\n");
    expect(vars.get("g")).toEqual([{ type: "vec2", scope: "", lineStart: "void main() {}\n".length }]);
  });

  it("clears a pending header when a new one supersedes it", () => {
    // `float f` never gets its brace: its pending state must not leak into the
    // next function's opening `{` (q is scoped to g, not a ghost f).
    const src =
      "float f(float x)\n" +
      "float g() {\n" +
      "  vec3 q = vec3(0.0);\n" +
      "}\n";
    const vars = scanVariables(src);
    expect(vars.get("x")).toBeUndefined();
    expect(vars.get("q")).toEqual([{ type: "vec3", scope: "g", lineStart: src.indexOf("  vec3 q = vec3(0.0);") }]);
  });
});

describe("resolveVariable", () => {
  const noise =
    "vec2 weight = vec2(1.0);\n" +
    "float noise() {\n" +
    "  vec2 weight = smoothstep(0.0, 1.0, vec2(0.0));\n" +
    "}\n" +
    "float quads() {\n" +
    "  float weight = 1.0;\n" +
    "}\n";

  it("resolves a file-scope declaration", () => {
    expect(resolveVariable("vec2 weight;", "", "weight")).toBe("vec2");
  });

  it("prefers a function-local declaration over file scope", () => {
    expect(resolveVariable(noise, "noise", "weight")).toBe("vec2");
  });

  it("uses the declaration from the matching function, not another", () => {
    expect(resolveVariable(noise, "quads", "weight")).toBe("float");
    expect(resolveVariable(noise, "noise", "weight")).toBe("vec2");
  });

  it("returns null for an out-of-scope name", () => {
    const src = "float noise() {\n  vec2 p = vec2(0.0);\n}\n";
    // Function-locals are visible at file scope (single-file shader UX)
    expect(resolveVariable(src, "", "p")).toBe("vec2");
  });

  it("returns null for an undeclared name", () => {
    expect(resolveVariable("vec2 weight;", "", "nope")).toBeNull();
  });

  it("resolves a one-line function parameter within its own scope", () => {
    expect(resolveVariable("float square(float x) { return x * x; }", "square", "x")).toBe("float");
  });

  it("resolves a one-line function local within its own scope", () => {
    const src = "float f(float x) { vec2 p = vec2(x); return p.x; }";
    expect(resolveVariable(src, "f", "p")).toBe("vec2");
  });

  it("function-locals are visible at file scope (single-file shader UX)", () => {
    const src = "float f(float x) { vec2 p = vec2(x); return p.x; }\nvec2 q = vec2(1.0);\n";
    expect(resolveVariable(src, "", "p")).toBe("vec2");
    expect(resolveVariable(src, "", "q")).toBe("vec2");
  });

  it("excludes a declaration that appears after the cursor", () => {
    const src = "float f() {\n  vec3 target = vec3(0.0);\n  return vec3(0.0);\n}\n";
    const before = src.indexOf("  vec3 target") - 1; // last char of the previous line
    expect(resolveVariable(src, "f", "target", before)).toBeNull();
    expect(resolveVariable(src, "f", "target", src.indexOf("  vec3 target"))).toBe("vec3");
  });

  it("uses the earlier of two same-scope declarations before the cursor", () => {
    const src = "float f() {\n  vec2 p = vec2(0.0);\n  vec3 p = vec3(0.0);\n  return p;\n}\n";
    const firstAt = src.indexOf("  vec2 p");
    const secondAt = src.indexOf("  vec3 p");
    expect(resolveVariable(src, "f", "p", firstAt)).toBe("vec2");
    expect(resolveVariable(src, "f", "p", secondAt)).toBe("vec3");
  });

  it("does not shadow a file-scope variable until the local is declared", () => {
    const src =
      "vec2 weight = vec2(1.0);\n" +
      "float f() {\n" +
      "  float weight = 2.0;\n" +
      "  return weight;\n" +
      "}\n";
    const localAt = src.indexOf("  float weight");
    expect(resolveVariable(src, "f", "weight", localAt - 1)).toBe("vec2");
    expect(resolveVariable(src, "f", "weight", localAt)).toBe("float");
  });

  it("excludes a file-scope declaration that appears after the cursor", () => {
    const src = "float f() {\n  vec2 q = vec2(0.0);\n}\nvec3 g = vec3(0.0);\n";
    expect(resolveVariable(src, "", "g", src.indexOf("float f"))).toBeNull();
  });

  it("resolves a one-line local from any position on its line", () => {
    const one = "float f(float x) { vec3 p = vec3(x); return p.x; }\n";
    // Line-granular visibility: a position on the declaration line sees it.
    expect(resolveVariable(one, "f", "p", one.indexOf("return"))).toBe("vec3");
  });
});

describe("variablesInScope", () => {
  it("lists file-scope and same-function variables", () => {
    const src =
      "uniform float u_time;\n" +
      "void main() {\n" +
      "  vec2 uv = vec2(0.0);\n" +
      "}\n";
    const vars = variablesInScope(src, "main");
    expect([...vars.keys()]).toContain("u_time");
    expect([...vars.keys()]).toContain("uv");
  });

  it("excludes variables declared only in another function", () => {
    const src =
      "float other() {\n" +
      "  vec3 hidden = vec3(0.0);\n" +
      "}\n" +
      "void main() {\n" +
      "  vec2 uv = vec2(0.0);\n" +
      "}\n";
    const vars = variablesInScope(src, "main");
    expect(vars.has("hidden")).toBe(false);
    expect(vars.has("uv")).toBe(true);
  });

  it("excludes variables declared after the cursor", () => {
    const src =
      "float f() {\n" +
      "  vec2 uv = vec2(0.0);\n" +
      "  vec3 later = vec3(0.0);\n" +
      "}\n";
    const vars = variablesInScope(src, "f", src.indexOf("  vec2 uv"));
    expect(vars.has("later")).toBe(false);
    expect(vars.get("uv")).toBe("vec2");
  });
});

describe("enclosingFunction", () => {
  const src =
    "vec2 weight = vec2(1.0);\n" +
    "float noise() {\n" +
    "  vec2 f = weight;\n" +
    "  return f.x;\n" +
    "}\n" +
    "void main() {}\n";

  it("returns empty scope before the first function", () => {
    expect(enclosingFunction(src, src.indexOf("vec2 weight"))).toBe("");
  });

  it("returns the enclosing function inside its body", () => {
    const bodyPos = src.indexOf("vec2 f = weight");
    expect(enclosingFunction(src, bodyPos)).toBe("noise");
  });

  it("returns empty scope after the function closes", () => {
    const afterPos = src.indexOf("void main");
    expect(enclosingFunction(src, afterPos)).toBe("");
  });

  it("resolves the scope of a one-line function by brace offset", () => {
    const one = "float other(float x) { vec3 p = vec3(x); return p.x; }\n";
    // At/after the opening brace the one-line body is inside `other`...
    expect(enclosingFunction(one, one.indexOf("{") + 1)).toBe("other");
    // ...but its signature (before the brace) is still outer scope.
    expect(enclosingFunction(one, one.indexOf("float other"))).toBe("");
  });
});

describe("membersForType", () => {
  it("returns swizzle accessors for vec2 (dimension-limited)", () => {
    const m = membersForType("vec2");
    expect(m.map((c) => c.label)).toEqual([".x", ".y", ".r", ".g", ".s", ".t"]);
  });

  it("returns swizzle accessors for vec3 (dimension-limited)", () => {
    const m = membersForType("vec3");
    expect(m.map((c) => c.label)).toEqual([".x", ".y", ".z", ".r", ".g", ".b", ".s", ".t", ".p"]);
  });

  it("returns all swizzle accessors for vec4", () => {
    const m = membersForType("vec4");
    expect(m.map((c) => c.label)).toEqual([".x", ".y", ".z", ".w", ".r", ".g", ".b", ".a", ".s", ".t", ".p", ".q"]);
  });

  it("returns bracket skeleton for mat3", () => {
    const m = membersForType("mat3");
    expect(m).toHaveLength(1);
    expect(m[0].label).toBe("[row][col]");
  });

  it("returns bracket skeleton for mat4", () => {
    const m = membersForType("mat4");
    expect(m).toHaveLength(1);
    expect(m[0].label).toBe("[row][col]");
  });

  it("returns empty for float", () => {
    expect(membersForType("float")).toEqual([]);
  });

  it("returns empty for sampler2D", () => {
    expect(membersForType("sampler2D")).toEqual([]);
  });

  it("returns empty for bool", () => {
    expect(membersForType("bool")).toEqual([]);
  });
});

describe("constructorCompletions", () => {
  const ctors = constructorCompletions();
  const labels = ctors.map((c) => c.label);

  it("includes all vec types", () => {
    expect(labels).toContain("vec2");
    expect(labels).toContain("vec3");
    expect(labels).toContain("vec4");
  });

  it("includes all matrix types", () => {
    expect(labels).toContain("mat2");
    expect(labels).toContain("mat3");
    expect(labels).toContain("mat4");
  });

  it("includes scalar types", () => {
    expect(labels).toContain("float");
    expect(labels).toContain("int");
    expect(labels).toContain("uint");
    expect(labels).toContain("bool");
  });

  it("excludes sampler types", () => {
    expect(labels).not.toContain("sampler2D");
    expect(labels).not.toContain("samplerCube");
  });
});

// -- DEFAULT_SHADER diagnostic ----------------------------------------
const DEFAULT_SHADER = `precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv = uv * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;

  float d = length(uv);
  vec3 col = 0.5 + 0.5 * cos(u_time * 0.8 + uv.xyx * 2.5 + vec3(0.0, 2.1, 4.2));
  col *= smoothstep(1.4, 0.2, d);

  gl_FragColor = vec4(col, 1.0);
}
`;

describe("DEFAULT_SHADER completion chain", () => {
  it("uv resolves to vec2 inside main() and offers correct swizzles", () => {
    const pos = 100;
    const scope = enclosingFunction(DEFAULT_SHADER, pos);
    const type = resolveVariable(DEFAULT_SHADER, scope, "uv", pos);
    const members = membersForType(type!);
    const labels = members.map(m => m.label);

    expect(scope).toBe("main");
    expect(type).toBe("vec2");
    expect(labels).toContain(".x");
    expect(labels).toContain(".y");
    expect(labels).not.toContain(".z");
    expect(labels).not.toContain(".w");
  });

  it("uv resolves at file scope — function-locals visible everywhere", () => {
    const pos = DEFAULT_SHADER.length;
    const scope = enclosingFunction(DEFAULT_SHADER, pos);
    const type = resolveVariable(DEFAULT_SHADER, scope, "uv", pos);

    expect(scope).toBe("");
    expect(type).toBe("vec2");
  });

  it("uv not visible at pos 0 — position-aware hoisting excludes before-declaration", () => {
    const scope = enclosingFunction(DEFAULT_SHADER, 0);
    const type = resolveVariable(DEFAULT_SHADER, scope, "uv", 0);

    expect(scope).toBe("");
    expect(type).toBeNull();
  });

  it("u_resolution resolves everywhere (file scope)", () => {
    const pos = DEFAULT_SHADER.length;
    const scope = enclosingFunction(DEFAULT_SHADER, pos);
    const type = resolveVariable(DEFAULT_SHADER, scope, "u_resolution", pos);

    expect(scope).toBe("");
    expect(type).toBe("vec2");
  });

  it("u_resolution resolves inside main()", () => {
    const pos = 100;
    const scope = enclosingFunction(DEFAULT_SHADER, pos);
    const type = resolveVariable(DEFAULT_SHADER, scope, "u_resolution", pos);

    expect(scope).toBe("main");
    expect(type).toBe("vec2");
  });

  it("user-declared gl_FragCoord shadows the built-in in resolveVariable", () => {
    const src = "void main() { float gl_FragCoord = 1.0; }";
    const scope = enclosingFunction(src, src.length - 1);
    const type = resolveVariable(src, scope, "gl_FragCoord", src.length - 1);

    expect(scope).toBe("main");
    expect(type).toBe("float");
  });
});
