import { describe, expect, it } from "vitest";
import {
  bytesToB64url,
  b64urlToBytes,
  decodeShare,
  encodeDefines,
  encodeShare,
  parseDefines,
} from "../src/share";

const SAMPLE_SHADER = `precision mediump float;
uniform float u_time;
void main() {
  vec2 uv = gl_FragCoord.xy;
  gl_FragColor = vec4(uv / u_time, 0.0, 1.0);
}`;

describe("b64url codec", () => {
  it("b64urlToBytes ↔ bytesToB64url round-trips cleanly", () => {
    const original = new Uint8Array([0, 31, 127, 128, 255]);
    expect(b64urlToBytes(bytesToB64url(original))).toEqual(original);
  });

  it("produces only URL-safe characters (no +/= or spaces)", () => {
    const encoded = bytesToB64url(new TextEncoder().encode(SAMPLE_SHADER + " → 你好 ñ"));
    expect(encoded).not.toMatch(/[ +/=\s]/);
    expect(encoded).toMatch(/^[-A-Za-z0-9_]+$/);
  });
});

describe("define serialization", () => {
  it("encodeDefines ↔ parseDefines round-trips", () => {
    const src = new Map([
      ["GLOW", true],
      ["DEBUG", false],
    ]);
    const roundTrip = parseDefines(encodeDefines(src));
    expect(roundTrip).toEqual(src);
  });

  it("empty map yields empty string, parses back empty", () => {
    expect(encodeDefines(new Map())).toBe("");
    expect(parseDefines("")).toEqual(new Map());
  });

  it("ignores malformed pairs", () => {
    const result = parseDefines("GOOD:1,BAD,ALSOBAD:,123:5");
    expect(result.size).toBe(1);
    expect(result.get("GOOD")).toBe(true);
  });
});

describe("encodeShare → decodeShare round-trip", () => {
  it("round-trips doc (z: path) with no defines", async () => {
    const encoded = await encodeShare(SAMPLE_SHADER, new Map());
    const decoded = await decodeShare("#" + encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.doc).toBe(SAMPLE_SHADER);
    expect(decoded!.defines.size).toBe(0);
  });

  it("round-trips doc + defines", async () => {
    const defines = new Map([
      ["A", true],
      ["B", false],
    ]);
    const encoded = await encodeShare(SAMPLE_SHADER, defines);
    const decoded = await decodeShare("#" + encoded);
    expect(decoded!.doc).toBe(SAMPLE_SHADER);
    expect(decoded!.defines).toEqual(defines);
  });

  it("survives unicode shader source", async () => {
    const unicode = "// coffee: café ☕ — 式\nvoid main() {}\n";
    const encoded = await encodeShare(unicode, new Map());
    const decoded = await decodeShare("#" + encoded);
    expect(decoded!.doc).toBe(unicode);
  });
});

describe("decodeShare edge cases", () => {
  it("non-share hash → null", async () => {
    expect(await decodeShare("#foo")).toBeNull();
    expect(await decodeShare("")).toBeNull();
  });

  it("missing s param → null", async () => {
    expect(await decodeShare("#s=")).toBeNull();
  });

  it("truncated deflate payload → null (catch handles)", async () => {
    expect(await decodeShare("#s=z:abc")).toBeNull();
  });

  it("invalid p: payload → null", async () => {
    expect(await decodeShare("#s=p:!!!")).toBeNull();
  });
});

describe("payload safety", () => {
  it("hash fragment contains no percent-encoding or spaces — copy-paste safe", async () => {
    const encoded = await encodeShare(SAMPLE_SHADER, new Map([["FOO", true]]));
    expect(encoded).not.toMatch(/%/);
    expect(encoded).not.toMatch(/\s/);
  });
});
