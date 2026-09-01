import { describe, expect, it } from "vitest";
import { scanVariables, membersForType, constructorCompletions } from "../src/glsl-vars";

describe("scanVariables", () => {
  it("finds unqualified vec4 declaration", () => {
    const vars = scanVariables("vec4 color;");
    expect(vars.get("color")).toBe("vec4");
  });

  it("finds uniform declaration", () => {
    const vars = scanVariables("uniform sampler2D iChannel0;");
    expect(vars.get("iChannel0")).toBe("sampler2D");
  });

  it("finds const declaration", () => {
    const vars = scanVariables("const float PI = 3.14;");
    expect(vars.get("PI")).toBe("float");
  });

  it("finds precision-qualified declaration", () => {
    const vars = scanVariables("highp vec2 uv;");
    expect(vars.get("uv")).toBe("vec2");
  });

  it("finds in/out declarations", () => {
    const vars = scanVariables("in vec3 normal;\nout vec4 fragColor;");
    expect(vars.get("normal")).toBe("vec3");
    expect(vars.get("fragColor")).toBe("vec4");
  });

  it("finds array declaration", () => {
    const vars = scanVariables("float arr[8];");
    expect(vars.get("arr")).toBe("float");
  });

  it("finds declaration with initializer", () => {
    const vars = scanVariables("vec3 pos = vec3(0.0);");
    expect(vars.get("pos")).toBe("vec3");
  });

  it("ignores declarations inside comments", () => {
    const vars = scanVariables("// vec4 hidden;\nvec4 visible;");
    expect(vars.has("hidden")).toBe(false);
    expect(vars.get("visible")).toBe("vec4");
  });

  it("ignores non-declaration lines", () => {
    const vars = scanVariables("fragColor = vec4(1.0);\nreturn value;");
    expect(vars.size).toBe(0);
  });

  it("later declaration wins for same name", () => {
    const vars = scanVariables("vec4 q;\nvec2 q;");
    expect(vars.get("q")).toBe("vec2");
  });

  it("ignores unknown types", () => {
    const vars = scanVariables("MyStruct foo;");
    expect(vars.has("foo")).toBe(false);
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
