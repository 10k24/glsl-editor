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
    expect(vars.get("color")).toEqual([{ type: "vec4", scope: "" }]);
  });

  it("finds uniform declaration", () => {
    const vars = scanVariables("uniform sampler2D iChannel0;");
    expect(vars.get("iChannel0")).toEqual([{ type: "sampler2D", scope: "" }]);
  });

  it("finds const declaration", () => {
    const vars = scanVariables("const float PI = 3.14;");
    expect(vars.get("PI")).toEqual([{ type: "float", scope: "" }]);
  });

  it("finds precision-qualified declaration", () => {
    const vars = scanVariables("highp vec2 uv;");
    expect(vars.get("uv")).toEqual([{ type: "vec2", scope: "" }]);
  });

  it("finds in/out declarations", () => {
    const vars = scanVariables("in vec3 normal;\nout vec4 fragColor;");
    expect(vars.get("normal")).toEqual([{ type: "vec3", scope: "" }]);
    expect(vars.get("fragColor")).toEqual([{ type: "vec4", scope: "" }]);
  });

  it("finds array declaration", () => {
    const vars = scanVariables("float arr[8];");
    expect(vars.get("arr")).toEqual([{ type: "float", scope: "" }]);
  });

  it("finds declaration with initializer", () => {
    const vars = scanVariables("vec3 pos = vec3(0.0);");
    expect(vars.get("pos")).toEqual([{ type: "vec3", scope: "" }]);
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
      { type: "vec2", scope: "" },
      { type: "float", scope: "f" },
    ]);
  });

  it("ignores unknown types", () => {
    const vars = scanVariables("MyStruct foo;");
    expect(vars.has("foo")).toBe(false);
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
    expect(resolveVariable(src, "", "p")).toBeNull();
  });

  it("returns null for an undeclared name", () => {
    expect(resolveVariable("vec2 weight;", "", "nope")).toBeNull();
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
