// Backend-free shader sharing.
//
// Shader source + define overrides are packed into the URL fragment:
//
//   #s=z:<deflate-raw + base64url>[&d=NAME:1,NAME2:0]
//
// "z:" marks compressed payloads (native CompressionStream), "p:" is a plain
// base64url fallback for browsers without it. The fragment never reaches any
// server — GitHub Pages and friends serve the same document regardless.

export const HAS_COMPRESSION = typeof CompressionStream !== "undefined";

// The URL fragment prefix that marks a share link. Single source of truth for
// the "#s=" contract — consumers check this instead of hardcoding the literal.
const SHARE_PREFIX = "#s=";

export function isShareHash(hash: string): boolean {
  return hash.startsWith(SHARE_PREFIX);
}

export interface SharePayload {
  doc: string;
  defines: Map<string, boolean>;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function inflateB64(b64: string): Promise<string> {
  const stream = new Blob([b64urlToBytes(b64)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

export function encodeDefines(defines: Map<string, boolean>): string {
  return [...defines].map(([name, on]) => `${name}:${on ? 1 : 0}`).join(",");
}

export function parseDefines(raw: string): Map<string, boolean> {
  const defines = new Map<string, boolean>();
  for (const pair of raw.split(",")) {
    const m = pair.match(/^(\w+):(0|1)$/);
    if (m) defines.set(m[1], m[2] === "1");
  }
  return defines;
}

export async function encodeShare(doc: string, defines: Map<string, boolean>): Promise<string> {
  const s = HAS_COMPRESSION
    ? "z:" + bytesToB64url(new Uint8Array(
        await new Response(
          new Blob([doc]).stream().pipeThrough(new CompressionStream("deflate-raw"))
        ).arrayBuffer()
      ))
    : "p:" + bytesToB64url(new TextEncoder().encode(doc));
  const d = defines.size > 0 ? "&d=" + encodeDefines(defines) : "";
  return `s=${s}${d}`;
}

export async function decodeShare(hash: string): Promise<SharePayload | null> {
  if (!isShareHash(hash)) return null;
  try {
    const params = new URLSearchParams(hash.slice(1));
    const s = params.get("s");
    if (!s) return null;
    let doc: string | null = null;
    if (s.startsWith("z:") && typeof DecompressionStream !== "undefined") {
      doc = await inflateB64(s.slice(2));
    } else if (s.startsWith("p:")) {
      doc = new TextDecoder().decode(b64urlToBytes(s.slice(2)));
    }
    if (!doc) return null;
    return { doc, defines: parseDefines(params.get("d") ?? "") };
  } catch {
    return null; // malformed or truncated link — caller falls back to normal load
  }
}
