/**
 * Minimal GLSL preprocessor.
 *
 * Handles:
 *   #define NAME           (flag define, no value)
 *   #define NAME value     (value define — substituted in subsequent lines)
 *   #undef NAME
 *   #ifdef NAME / #ifndef NAME / #else / #endif
 *   // #define NAME        (treated as commented-out, not active)
 *
 * Does NOT handle: #if <expr>, function-like macros, ##/# operators.
 * Those are rare in Shadertoy and can be passed through to the driver.
 */

export interface DefineFlag {
  name: string;
  active: boolean; // true = defined in source (not commented out)
}

/** Extract all flag defines (no value) from raw source, including commented-out ones. */
export function parseDefineFlags(src: string): DefineFlag[] {
  const seen = new Set<string>();
  const result: DefineFlag[] = [];

  for (const line of src.split("\n")) {
    // Active: #define NAME (optional trailing comment)
    const active = line.match(/^\s*#define\s+(\w+)\s*(?:\/\/.*)?$/);
    // Commented: // #define NAME
    const commented = line.match(/^\s*\/\/\s*#define\s+(\w+)\s*(?:\/\/.*)?$/);

    const m = active ?? commented;
    if (!m) continue;
    const name = m[1];
    if (seen.has(name)) continue;
    seen.add(name);
    result.push({ name, active: !!active });
  }

  return result;
}

/**
 * Run the preprocessor on raw GLSL source.
 *
 * @param src       Raw user source (may contain // #define or active #define lines)
 * @param overrides Map of name → enabled, set by the define panel UI.
 *                  These take precedence over whatever the source says.
 * @returns Preprocessed source with dead branches stripped, ready for the GPU.
 */
export function preprocess(src: string, overrides: Map<string, boolean>): string {
  const lines = src.split("\n");
  const defines = new Map<string, string | true>(); // name → value or true for flags

  // Seed defines from overrides (UI state wins)
  for (const [name, on] of overrides) {
    if (on) defines.set(name, true);
  }

  // Conditional stack: each entry tracks whether the current branch is active
  type CondState = { active: boolean; seenTrue: boolean };
  const stack: CondState[] = [];

  function isActive(): boolean {
    return stack.every(s => s.active);
  }

  const out: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();

    // ── Conditional directives — always evaluated regardless of active state ──

    if (/^#ifdef\s+(\w+)/.test(line)) {
      const name = line.match(/^#ifdef\s+(\w+)/)![1];
      // Skip if this name is controlled by overrides (already seeded into defines)
      const defined = defines.has(name);
      const active = isActive() && defined;
      stack.push({ active, seenTrue: active });
      out.push(""); // blank line preserves line numbers
      continue;
    }

    if (/^#ifndef\s+(\w+)/.test(line)) {
      const name = line.match(/^#ifndef\s+(\w+)/)![1];
      const defined = defines.has(name);
      const active = isActive() && !defined;
      stack.push({ active, seenTrue: active });
      out.push("");
      continue;
    }

    if (/^#else\b/.test(line)) {
      if (stack.length > 0) {
        const top = stack[stack.length - 1];
        const parentActive = stack.slice(0, -1).every(s => s.active);
        top.active = parentActive && !top.seenTrue;
        if (top.active) top.seenTrue = true;
      }
      out.push("");
      continue;
    }

    if (/^#endif\b/.test(line)) {
      stack.pop();
      out.push("");
      continue;
    }

    // ── Only process remaining directives and code when in an active branch ──

    if (!isActive()) {
      out.push(""); // keep line count for error reporting
      continue;
    }

    // Active #define
    if (/^#define\s+\w+/.test(line)) {
      const m = line.match(/^#define\s+(\w+)(?:\s+(.+))?$/);
      if (m) {
        const [, name, value] = m;
        // Only define if not already controlled by an override
        if (!overrides.has(name)) {
          defines.set(name, value?.trim() ?? true);
        }
      }
      out.push(raw);
      continue;
    }

    // Commented-out #define — skip entirely (do not add to defines)
    if (/^\s*\/\/\s*#define\s+/.test(raw)) {
      out.push(""); // strip so GPU never sees these
      continue;
    }

    if (/^#undef\s+(\w+)/.test(line)) {
      const name = line.match(/^#undef\s+(\w+)/)![1];
      if (!overrides.has(name)) defines.delete(name);
      out.push(raw);
      continue;
    }

    // Pass through all other lines (including #version, #extension, code)
    out.push(raw);
  }

  return out.join("\n");
}
