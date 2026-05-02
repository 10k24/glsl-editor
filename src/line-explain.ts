/**
 * Produce a plain-English description of what a GLSL line is doing.
 * Fully static — no network calls.
 */

type Explanation = string;

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

/** Strip a trailing ; and trim */
function bare(s: string) { return s.replace(/;$/, "").trim(); }

/** Try to name an rhs expression briefly */
function describeExpr(expr: string): string {
  const e = expr.trim();

  if (/^gl_FragCoord\.xy\s*\//.test(e)) return "the pixel position divided by canvas size — a UV in [0, 1]";
  if (/\/\s*u_resolution/.test(e)) return "the coordinate normalized by canvas resolution";
  if (/\*\s*2\.0?\s*-\s*1\.0?/.test(e) || /\*\s*2\s*-\s*1\b/.test(e)) return "coordinates remapped from [0, 1] to [–1, 1]";
  if (/0\.5\s*\+\s*0\.5\s*\*\s*cos/.test(e)) return "a cosine wave packed into [0, 1] — useful for color cycling";
  if (/0\.5\s*\+\s*0\.5\s*\*\s*sin/.test(e)) return "a sine wave packed into [0, 1]";

  const fn = e.match(/^(\w+)\s*\(/)?.[1];
  if (fn) {
    const args = e.slice(fn.length).replace(/^\s*\(/, "").replace(/\)\s*$/, "");
    switch (fn) {
      case "length":    return `the Euclidean length (magnitude) of ${args}`;
      case "normalize": return `${args} scaled to unit length (direction only)`;
      case "distance":  return `the distance between the two points`;
      case "dot":       return `the dot product of the two vectors`;
      case "cross":     return `the cross product — a vector perpendicular to both inputs`;
      case "reflect":   return `the incident vector reflected around the normal`;
      case "refract":   return `the refracted direction using Snell's law`;
      case "mix":       return `a linear interpolation (blend) between the first two arguments`;
      case "clamp":     return `the value clamped to the given range`;
      case "smoothstep":return `a smooth S-curve interpolation between the two edges`;
      case "step":      return `a hard threshold — 0 below edge, 1 above`;
      case "fract":     return `the fractional part of ${args}`;
      case "floor":     return `${args} rounded down to the nearest integer`;
      case "ceil":      return `${args} rounded up to the nearest integer`;
      case "abs":       return `the absolute value of ${args}`;
      case "mod":       return `${args.split(",")[0].trim()} modulo ${args.split(",")[1]?.trim() ?? "…"}`;
      case "sin":       return `the sine of ${args} (in radians)`;
      case "cos":       return `the cosine of ${args} (in radians)`;
      case "tan":       return `the tangent of ${args} (in radians)`;
      case "pow":       return `${args.split(",")[0].trim()} raised to the power of ${args.split(",")[1]?.trim() ?? "…"}`;
      case "sqrt":      return `the square root of ${args}`;
      case "inversesqrt": return `1 / sqrt(${args}) — fast reciprocal square root`;
      case "max":       return `the larger of the two values`;
      case "min":       return `the smaller of the two values`;
      case "sign":      return `the sign of ${args}: –1, 0, or 1`;
      case "texture2D": return `the texture color sampled at the given UV`;
      case "textureCube": return `the cubemap color sampled by the direction vector`;
      case "vec2": case "vec3": case "vec4":
        return `a new ${fn} constructed from (${args})`;
      case "mat2": case "mat3": case "mat4":
        return `a new ${fn} matrix`;
      case "float": return `${args} cast to float`;
      case "int":   return `${args} cast to int`;
    }
  }

  // arithmetic patterns
  if (/[\+\-\*\/]/.test(e)) return "a computed value";
  return e.length < 40 ? `the value ${e}` : "a computed expression";
}

// ── Main patterns ─────────────────────────────────────────────────────────────

export function explainLine(rawLine: string): Explanation {
  const line = rawLine.trim();
  if (!line) return "";

  // Comment
  if (line.startsWith("//")) return "Comment — not compiled.";
  if (line.startsWith("/*") || line.startsWith("*")) return "Block comment — not compiled.";

  // Braces only
  if (line === "{") return "Opens a block.";
  if (line === "}") return "Closes a block.";
  if (line === "};") return "Closes a struct definition.";

  // Preprocessor
  if (line.startsWith("#")) {
    if (/^#version/.test(line))  return `GLSL version declaration — must be the first non-empty line of the shader.`;
    if (/^#define\s+(\w+)/.test(line)) {
      const m = line.match(/^#define\s+(\w+)(?:\s+(.+))?/);
      return m?.[2]
        ? `Preprocessor constant: replaces every occurrence of '${m[1]}' with ${m[2]} before compilation.`
        : `Preprocessor flag: defines '${m?.[1]}' as a compile-time marker (no value).`;
    }
    if (/^#ifdef|^#ifndef|^#if/.test(line)) return "Conditional compilation — the following block is only included if the condition is true.";
    if (/^#else/.test(line)) return "Else branch of a conditional compilation block.";
    if (/^#endif/.test(line)) return "Ends a conditional compilation block.";
    if (/^#extension/.test(line)) return "Enables or requires a vendor-specific GLSL extension.";
    return "Preprocessor directive — processed before compilation.";
  }

  // precision statement
  {
    const m = line.match(/^precision\s+(highp|mediump|lowp)\s+(\w+)\s*;?$/);
    if (m) {
      const [, prec, type] = m;
      const p = prec === "highp" ? "high" : prec === "mediump" ? "medium" : "low";
      return `Sets ${p} precision as the default for all ${type} variables in this shader.`;
    }
  }

  // uniform / attribute / varying declaration
  {
    const m = line.match(/^(uniform|attribute|varying)\s+(?:(highp|mediump|lowp)\s+)?(\w+)\s+(\w+)(?:\s*=\s*(.+?))?;?$/);
    if (m) {
      const [, qual, , type, name, init] = m;
      const qualDesc: Record<string, string> = {
        uniform:   "passed in from the CPU — constant across all fragments in a draw call",
        attribute: "per-vertex data from a buffer (GLSL ES 1.0)",
        varying:   "interpolated from the vertex shader to the fragment shader",
      };
      if (init) return `Declares ${type} '${name}' as a ${qual} (${qualDesc[qual]}), initialized to ${describeExpr(init)}.`;
      return `Declares ${type} '${name}' as a ${qual}: ${qualDesc[qual]}.`;
    }
  }

  // struct field or plain declaration, no assignment — type name;
  {
    const m = line.match(/^(?:const\s+)?(?:highp|mediump|lowp\s+)?(\w+)\s+(\w+)\s*;?$/);
    if (m && !["if","else","for","while","do","return"].includes(m[1])) {
      return `Declares a ${m[1]} variable '${m[2]}' with no initial value.`;
    }
  }

  // variable declaration WITH assignment — type name = expr;
  {
    const m = line.match(/^(?:const\s+)?(?:highp|mediump|lowp\s+)?(\w+)\s+(\w+)\s*=\s*(.+?);?$/);
    if (m && !["if","else","for","while","do","return"].includes(m[1])) {
      const [, type, name, rhs] = m;
      const constTag = /^const\s/.test(line) ? "compile-time constant " : "";
      return `Declares ${constTag}${type} '${name}' and sets it to ${describeExpr(rhs)}.`;
    }
  }

  // compound assignment — name op= expr;
  {
    const m = line.match(/^([\w.[\]]+)\s*(\+=|-=|\*=|\/=)\s*(.+?);?$/);
    if (m) {
      const [, lhs, op, rhs] = m;
      const opWord: Record<string, string> = { "+=": "adds", "-=": "subtracts", "*=": "multiplies by", "/=": "divides by" };
      return `Updates '${lhs}' — ${opWord[op]} ${describeExpr(rhs)}.`;
    }
  }

  // gl_FragColor assignment
  {
    const m = line.match(/^gl_FragColor\s*=\s*(.+?);?$/);
    if (m) return `Outputs the final fragment color: ${describeExpr(m[1])}. This is written to the framebuffer.`;
  }

  // gl_Position assignment
  {
    const m = line.match(/^gl_Position\s*=\s*(.+?);?$/);
    if (m) return `Sets the clip-space vertex position to ${describeExpr(m[1])}.`;
  }

  // plain assignment — lhs = rhs;
  {
    const m = line.match(/^([\w.[\]]+)\s*=\s*(.+?);?$/);
    if (m) {
      const [, lhs, rhs] = m;
      return `Assigns '${lhs}' to ${describeExpr(rhs)}.`;
    }
  }

  // function call as statement — name(...);
  {
    const m = line.match(/^(\w+)\s*\((.+?)\)\s*;?$/);
    if (m) {
      const [, fn, args] = m;
      return `Calls function '${fn}' with arguments (${args}).`;
    }
  }

  // return statement
  {
    const m = line.match(/^return\s+(.+?);?$/);
    if (m) return `Returns ${describeExpr(m[1])} from this function.`;
    if (/^return\s*;?$/.test(line)) return "Returns from the function (void return).";
  }

  // discard
  if (/^discard\s*;?$/.test(line)) return "Discards this fragment — nothing is written to the framebuffer. Used for cutouts or masking.";

  // if / else / for / while
  {
    const m = line.match(/^if\s*\((.+?)\)/);
    if (m) return `Conditional branch — executes the next block only when (${m[1]}) is true.`;
  }
  if (/^else\s*\{?/.test(line)) return "Executes the next block when the preceding if-condition was false.";
  {
    const m = line.match(/^for\s*\((.+?)\)/);
    if (m) return `Loop — iterates with (${m[1]}).`;
  }
  {
    const m = line.match(/^while\s*\((.+?)\)/);
    if (m) return `Loop — repeats while (${m[1]}) is true.`;
  }
  if (/^break\s*;?$/.test(line))    return "Exits the current loop immediately.";
  if (/^continue\s*;?$/.test(line)) return "Skips the rest of this loop iteration and starts the next.";

  // function definition header
  {
    const m = line.match(/^(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{?$/);
    if (m) {
      const [, ret, name, params] = m;
      if (name === "main") return `Shader entry point — execution begins here. Returns ${ret}.`;
      return `Defines function '${name}' that takes (${params || "no arguments"}) and returns ${ret}.`;
    }
  }

  return "";
}
