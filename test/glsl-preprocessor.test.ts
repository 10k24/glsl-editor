import { describe, expect, it } from "vitest";
import { parseDefineFlags, preprocess } from "../src/glsl-preprocessor";

describe("parseDefineFlags", () => {
    it("finds active flag defines", () => {
        expect(parseDefineFlags("#define FOO")).toEqual([{ name: "FOO", active: true }]);
    });

    it("finds commented-out defines as inactive", () => {
        expect(parseDefineFlags("// #define FOO")).toEqual([{ name: "FOO", active: false }]);
    });

    it("ignores value defines — they are not toggleable flags", () => {
        expect(parseDefineFlags("#define PI 3.14")).toEqual([]);
    });

    it("deduplicates by name, first occurrence wins", () => {
        const src = "#define FOO\n// #define FOO\n";
        expect(parseDefineFlags(src)).toEqual([{ name: "FOO", active: true }]);
    });

    it("tolerates trailing comments and whitespace", () => {
        const src = "  #define FOO  // glow enabled\n\t// #define BAR // off\n";
        expect(parseDefineFlags(src)).toEqual([
            { name: "FOO", active: true },
            { name: "BAR", active: false },
        ]);
    });
});

describe("preprocess", () => {
    it("passes plain source through untouched", () => {
        const src = "void main() { gl_FragColor = vec4(1.0); }";
        expect(preprocess(src, new Map())).toBe(src);
    });

    it("keeps #ifdef body when the name is defined", () => {
        const src = "#define GLOW\n#ifdef GLOW\nbody();\n#endif\n";
        const out = preprocess(src, new Map());
        expect(out).toContain("body();");
    });

    it("strips #ifdef body when the name is undefined but preserves line count", () => {
        const src = "#ifdef GLOW\nbody();\n#endif\n";
        const out = preprocess(src, new Map());
        expect(out).not.toContain("body();");
        expect(out.split("\n").length).toBe(src.split("\n").length);
    });

    it("handles #else branches", () => {
        const src = "#define A\n#ifdef A\na();\n#else\nb();\n#endif\n";
        const out = preprocess(src, new Map());
        expect(out).toContain("a();");
        expect(out).not.toContain("b();");
    });

    it("handles #ifndef", () => {
        const src = "#ifndef MISSING\nfallback();\n#endif\n";
        expect(preprocess(src, new Map())).toContain("fallback();");
    });

    it("nests conditionals — parent gate kills child branch", () => {
        const src = "#ifdef UNDEFINED\n#ifdef DEFINED\ninner();\n#endif\nouter_body();\n#endif\n";
        const out = preprocess(src, new Map());
        expect(out).not.toContain("inner();");
        expect(out).not.toContain("outer_body();");
    });

    it("override=true activates a define the source never declares", () => {
        const src = "#ifdef FORCED\nforced();\n#endif\n";
        const overrides = new Map([["FORCED", true]]);
        expect(preprocess(src, overrides)).toContain("forced();");
    });

    it("override=false deactivates a define present in source", () => {
        const src = "#define KILL\n#ifdef KILL\nkilled();\n#endif\n";
        const overrides = new Map([["KILL", false]]);
        expect(preprocess(src, overrides)).not.toContain("killed();");
    });

    it("never defines a commented-out flag unless overridden", () => {
        const src = "// #define OPT\n#ifdef OPT\nopt();\n#endif\n";
        expect(preprocess(src, new Map())).not.toContain("opt();");

        const overrides = new Map([["OPT", true]]);
        expect(preprocess(src, overrides)).toContain("opt();");
    });

    it("strips commented-out defines from GPU source entirely", () => {
        const src = "// #define OPT\nvoid main() {}\n";
        const out = preprocess(src, new Map());
        expect(out).not.toContain("#define");
    });

    it("ignores directives inside dead branches", () => {
        const src = "#ifdef NOPE\n#define HIDDEN\nhidden();\n#endif\nvisible();\n";
        const out = preprocess(src, new Map());
        expect(out).not.toContain("hidden();");
        expect(out).toContain("visible();");
    });

    it("honors #undef unless the name is override-controlled", () => {
        const withUndef = "#define X\n#undef X\n#ifdef X\nnope();\n#endif\n";
        expect(preprocess(withUndef, new Map())).not.toContain("nope();");

        const overrides = new Map([["X", true]]);
        expect(preprocess(withUndef, overrides)).toContain("nope();");
    });
});
