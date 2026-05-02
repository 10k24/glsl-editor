export type DocKind = "function" | "type" | "variable" | "keyword" | "qualifier";

export interface GlslDoc {
  kind: DocKind;
  signature?: string;
  description: string;
}

export const GLSL_DOCS: Record<string, GlslDoc> = {

  // ── Trig ────────────────────────────────────────────────────────────────
  radians:    { kind:"function", signature:"radians(degrees: genType) → genType",    description:"Converts degrees to radians. Equivalent to degrees × π/180." },
  degrees:    { kind:"function", signature:"degrees(radians: genType) → genType",    description:"Converts radians to degrees. Equivalent to radians × 180/π." },
  sin:        { kind:"function", signature:"sin(angle: genType) → genType",          description:"Returns the sine of angle (in radians). Output range is [–1, 1]." },
  cos:        { kind:"function", signature:"cos(angle: genType) → genType",          description:"Returns the cosine of angle (in radians). Output range is [–1, 1]." },
  tan:        { kind:"function", signature:"tan(angle: genType) → genType",          description:"Returns the tangent of angle (in radians). Ratio of sin/cos." },
  asin:       { kind:"function", signature:"asin(x: genType) → genType",             description:"Returns the arc-sine (inverse sine) of x in radians. Input must be in [–1, 1]; returns values in [–π/2, π/2]." },
  acos:       { kind:"function", signature:"acos(x: genType) → genType",             description:"Returns the arc-cosine (inverse cosine) of x in radians. Input must be in [–1, 1]; returns values in [0, π]." },
  atan:       { kind:"function", signature:"atan(y: genType, x: genType) → genType  |  atan(y_over_x: genType) → genType", description:"Two-argument form returns the angle (in radians) of the vector (x, y), handling all quadrants (like atan2). One-argument form returns arc-tangent of y/x in [–π/2, π/2]." },

  // ── Exponential ─────────────────────────────────────────────────────────
  pow:        { kind:"function", signature:"pow(x: genType, y: genType) → genType",  description:"Returns x raised to the power y. x must be ≥ 0. Result is undefined for x < 0 or (x = 0 and y ≤ 0)." },
  exp:        { kind:"function", signature:"exp(x: genType) → genType",              description:"Returns the natural exponentiation eˣ." },
  log:        { kind:"function", signature:"log(x: genType) → genType",              description:"Returns the natural logarithm ln(x). x must be > 0." },
  exp2:       { kind:"function", signature:"exp2(x: genType) → genType",             description:"Returns 2 raised to the power x (2ˣ)." },
  log2:       { kind:"function", signature:"log2(x: genType) → genType",             description:"Returns log base-2 of x. x must be > 0." },
  sqrt:       { kind:"function", signature:"sqrt(x: genType) → genType",             description:"Returns the square root of x. x must be ≥ 0." },
  inversesqrt:{ kind:"function", signature:"inversesqrt(x: genType) → genType",      description:"Returns 1 / sqrt(x). Faster than dividing by sqrt(x). x must be > 0." },

  // ── Common math ─────────────────────────────────────────────────────────
  abs:        { kind:"function", signature:"abs(x: genType) → genType",              description:"Returns the absolute value of x. Component-wise for vectors." },
  sign:       { kind:"function", signature:"sign(x: genType) → genType",             description:"Returns –1.0, 0.0, or 1.0 depending on the sign of x." },
  floor:      { kind:"function", signature:"floor(x: genType) → genType",            description:"Returns the largest integer ≤ x (round toward –∞)." },
  ceil:       { kind:"function", signature:"ceil(x: genType) → genType",             description:"Returns the smallest integer ≥ x (round toward +∞)." },
  fract:      { kind:"function", signature:"fract(x: genType) → genType",            description:"Returns the fractional part of x: x – floor(x). Useful for repeating patterns." },
  mod:        { kind:"function", signature:"mod(x: genType, y: genType|float) → genType", description:"Returns the modulo: x – y × floor(x/y). Works component-wise. Common for tiling and wrapping." },
  min:        { kind:"function", signature:"min(x: genType, y: genType|float) → genType", description:"Returns the component-wise minimum of x and y." },
  max:        { kind:"function", signature:"max(x: genType, y: genType|float) → genType", description:"Returns the component-wise maximum of x and y." },
  clamp:      { kind:"function", signature:"clamp(x: genType, minVal, maxVal) → genType", description:"Clamps x to [minVal, maxVal]. Equivalent to min(max(x, minVal), maxVal). Safe when minVal ≤ maxVal." },
  mix:        { kind:"function", signature:"mix(x: genType, y: genType, a: genType|float) → genType", description:"Linear interpolation: x × (1 – a) + y × a. a=0 returns x; a=1 returns y. a can exceed [0,1] for extrapolation." },
  step:       { kind:"function", signature:"step(edge: genType|float, x: genType) → genType", description:"Returns 0.0 if x < edge, else 1.0. A hard threshold / Heaviside step function." },
  smoothstep: { kind:"function", signature:"smoothstep(edge0: genType|float, edge1: genType|float, x: genType) → genType", description:"Smooth Hermite interpolation between 0 and 1. Returns 0 when x ≤ edge0, 1 when x ≥ edge1, and a cubic S-curve in between. Equivalent to t²(3–2t) where t = clamp((x–edge0)/(edge1–edge0), 0, 1)." },

  // ── Geometric ───────────────────────────────────────────────────────────
  length:     { kind:"function", signature:"length(x: genType) → float",             description:"Returns the Euclidean length (magnitude) of vector x: sqrt(x.x² + x.y² + …)." },
  distance:   { kind:"function", signature:"distance(p0: genType, p1: genType) → float", description:"Returns the distance between two points: length(p1 – p0)." },
  dot:        { kind:"function", signature:"dot(x: genType, y: genType) → float",    description:"Returns the dot product of x and y. Measures how parallel two vectors are. dot(a,a) = length(a)²." },
  cross:      { kind:"function", signature:"cross(x: vec3, y: vec3) → vec3",         description:"Returns the cross product of x and y. The result is perpendicular to both input vectors. Only valid for vec3." },
  normalize:  { kind:"function", signature:"normalize(x: genType) → genType",        description:"Returns a unit vector in the same direction as x. Equivalent to x / length(x)." },
  faceforward:{ kind:"function", signature:"faceforward(N, I, Nref: genType) → genType", description:"Returns N if dot(Nref, I) < 0, else –N. Ensures a normal faces toward the viewer." },
  reflect:    { kind:"function", signature:"reflect(I: genType, N: genType) → genType", description:"Returns the reflection direction of incident vector I around normal N. N must be normalized. Result: I – 2 × dot(N, I) × N." },
  refract:    { kind:"function", signature:"refract(I: genType, N: genType, eta: float) → genType", description:"Returns the refraction vector given incident I, surface normal N, and ratio of indices of refraction eta. Uses Snell's law." },

  // ── Matrix ──────────────────────────────────────────────────────────────
  matrixCompMult: { kind:"function", signature:"matrixCompMult(x: matType, y: matType) → matType", description:"Component-wise matrix multiplication (not standard matrix multiply). For regular matrix math, use the * operator." },

  // ── Vector constructors / swizzles ──────────────────────────────────────
  vec2: { kind:"type", signature:"vec2(x, y: float)",   description:"2-component float vector. Components accessible as .x/.y, .r/.g, or .s/.t." },
  vec3: { kind:"type", signature:"vec3(x, y, z: float | vec2, z | x, vec2)", description:"3-component float vector. Components accessible as .x/.y/.z, .r/.g/.b, or .s/.t/.p." },
  vec4: { kind:"type", signature:"vec4(x, y, z, w: float | vec3, w | …)", description:"4-component float vector. Components accessible as .x/.y/.z/.w, .r/.g/.b/.a, or .s/.t/.p/.q." },
  mat2: { kind:"type", signature:"mat2(col0: vec2, col1: vec2)",  description:"2×2 float matrix. Constructed column-major. mat2 × vec2 performs a linear transform." },
  mat3: { kind:"type", signature:"mat3(col0: vec3, col1: vec3, col2: vec3)", description:"3×3 float matrix. Constructed column-major. Commonly used for normals and rotations." },
  mat4: { kind:"type", signature:"mat4(col0: vec4, … col3: vec4)", description:"4×4 float matrix. Constructed column-major. Standard transform matrix (model, view, projection)." },
  ivec2: { kind:"type", description:"2-component integer vector." },
  ivec3: { kind:"type", description:"3-component integer vector." },
  ivec4: { kind:"type", description:"4-component integer vector." },
  bvec2: { kind:"type", description:"2-component boolean vector. Returned by comparison functions." },
  bvec3: { kind:"type", description:"3-component boolean vector." },
  bvec4: { kind:"type", description:"4-component boolean vector." },
  sampler2D:   { kind:"type", description:"Opaque handle to a 2D texture. Sample with texture2D(sampler, uv)." },
  samplerCube: { kind:"type", description:"Opaque handle to a cubemap texture. Sample with textureCube(sampler, dir)." },

  // ── Texture ─────────────────────────────────────────────────────────────
  texture2D:   { kind:"function", signature:"texture2D(sampler: sampler2D, coord: vec2, bias?: float) → vec4", description:"Samples a 2D texture at the given UV coordinates. Returns a vec4 (RGBA). The optional bias adjusts the mipmap LOD." },
  textureCube: { kind:"function", signature:"textureCube(sampler: samplerCube, coord: vec3) → vec4", description:"Samples a cubemap texture using a 3D direction vector as the coordinate." },
  texture2DProj:{ kind:"function", signature:"texture2DProj(sampler: sampler2D, coord: vec3|vec4) → vec4", description:"Projective texture lookup: divides the texture coordinate by its last component before sampling." },

  // ── Fragment output ──────────────────────────────────────────────────────
  gl_FragColor:    { kind:"variable", signature:"gl_FragColor: vec4  (write-only)",  description:"Output color of the current fragment (RGBA). This is the final value written to the framebuffer. Setting alpha < 1.0 makes the fragment semi-transparent (if blending is enabled)." },
  gl_FragCoord:    { kind:"variable", signature:"gl_FragCoord: vec4  (read-only)",   description:"The window-space position of the current fragment. .xy is the pixel position (origin at bottom-left), .z is depth [0,1], .w is 1/clip-w." },
  gl_FragDepth:    { kind:"variable", signature:"gl_FragDepth: float  (write-only)", description:"Override the depth value written to the depth buffer. If not written, gl_FragCoord.z is used." },
  gl_PointCoord:   { kind:"variable", signature:"gl_PointCoord: vec2  (read-only)",  description:"2D coordinate within a point sprite, ranging [0,1] in both dimensions. Only valid when rendering GL_POINTS." },

  // ── Vertex built-ins (for reference) ────────────────────────────────────
  gl_Position:  { kind:"variable", signature:"gl_Position: vec4  (write-only, vertex)",  description:"Clip-space position output from the vertex shader. Must be written for every vertex. Usually: projectionMatrix × viewMatrix × modelMatrix × vec4(position, 1.0)." },
  gl_PointSize: { kind:"variable", signature:"gl_PointSize: float  (write-only, vertex)", description:"Size of the rendered point in pixels when drawing GL_POINTS primitives." },
  gl_FrontFacing:{ kind:"variable", signature:"gl_FrontFacing: bool  (read-only, fragment)", description:"True if the fragment belongs to a front-facing primitive. Useful for two-sided lighting." },

  // ── Storage qualifiers ──────────────────────────────────────────────────
  uniform:   { kind:"qualifier", description:"Declares a variable passed from the CPU (application) to the shader. Constant across all vertices/fragments in a draw call. Read-only inside the shader." },
  attribute: { kind:"qualifier", description:"(GLSL ES 1.0) Per-vertex input data from a vertex buffer — position, normal, UV, etc. Read-only, available only in vertex shaders. Replaced by 'in' in GLSL ES 3.0." },
  varying:   { kind:"qualifier", description:"(GLSL ES 1.0) Passes interpolated data from the vertex shader to the fragment shader. Written in the vertex shader, read in the fragment shader. Replaced by 'out'/'in' in GLSL ES 3.0." },
  in:        { kind:"qualifier", description:"(GLSL ES 3.0) Input to the current shader stage. In a vertex shader: per-vertex attribute. In a fragment shader: interpolated value from the vertex shader." },
  out:       { kind:"qualifier", description:"(GLSL ES 3.0) Output from the current shader stage. In a vertex shader: data passed to the next stage. In a fragment shader: the fragment color output." },
  inout:     { kind:"qualifier", description:"Function parameter qualifier — the variable is both read on entry and written on exit (passed by reference)." },

  // ── Precision qualifiers ─────────────────────────────────────────────────
  precision: { kind:"keyword", description:"Sets the default floating-point precision for a type (float, int, sampler2D…). Usually placed at the top of the shader: 'precision mediump float;'" },
  highp:     { kind:"qualifier", description:"High precision floating-point. At least 16 bits of mantissa, range [–2¹⁶, 2¹⁶]. Guaranteed in vertex shaders; optional in fragment shaders on some hardware." },
  mediump:   { kind:"qualifier", description:"Medium precision floating-point. At least 10 bits of mantissa, range [–2¹⁰, 2¹⁰]. A safe default for fragment shaders." },
  lowp:      { kind:"qualifier", description:"Low precision floating-point. At least 8 bits, range [–2, 2]. Suitable for colors (0–1). Avoids clamping for values outside that range on some GPUs." },

  // ── Primitive types ───────────────────────────────────────────────────────
  float: { kind:"type", description:"Single-precision (or mediump) scalar floating-point value. The fundamental numeric type in GLSL." },
  int:   { kind:"type", description:"Signed integer scalar. GLSL ES 1.0 integers have limited arithmetic; use float for general math." },
  uint:  { kind:"type", description:"Unsigned integer scalar (GLSL ES 3.0+)." },
  bool:  { kind:"type", description:"Boolean scalar. Produced by comparison operators; consumed by if/while conditions and mix()." },
  void:  { kind:"keyword", description:"Indicates a function returns no value, or (as a parameter list) that a function takes no arguments." },

  // ── Control flow ─────────────────────────────────────────────────────────
  if:       { kind:"keyword", description:"Conditional branch. Executes the following block only when the condition is true." },
  else:     { kind:"keyword", description:"Executes its block when the preceding 'if' condition was false." },
  for:      { kind:"keyword", description:"Counted loop. Loops should have a deterministic iteration count; avoid infinite or GPU-heavy loops." },
  while:    { kind:"keyword", description:"Condition-driven loop. Runs while the condition is true. Avoid long-running loops in shaders." },
  do:       { kind:"keyword", description:"Do-while loop. Executes the body at least once before checking the condition." },
  break:    { kind:"keyword", description:"Exits the nearest enclosing for/while/do loop immediately." },
  continue: { kind:"keyword", description:"Skips the rest of the current loop iteration and moves to the next iteration." },
  return:   { kind:"keyword", description:"Returns a value from a function and exits it immediately. 'return;' (no value) exits a void function." },
  discard:  { kind:"keyword", description:"(Fragment shaders only) Discards the current fragment — it is not written to the framebuffer. Useful for alpha cutouts or stencil effects." },

  // ── Other keywords ────────────────────────────────────────────────────────
  const:    { kind:"keyword", description:"Declares a compile-time constant. Must be initialized with a constant expression." },
  struct:   { kind:"keyword", description:"Defines a composite data type grouping multiple fields. Access members with dot notation." },
  main:     { kind:"keyword", description:"The required entry point of every shader. Signature: void main(). Execution starts here." },
};

// Priority order when multiple tokens match on a line
const KIND_PRIORITY: Record<DocKind, number> = {
  function:  4,
  variable:  3,
  type:      2,
  qualifier: 1,
  keyword:   0,
};

const TOKEN_RE = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

export function findBestDocForLine(lineText: string): { token: string; doc: GlslDoc } | null {
  let best: { token: string; doc: GlslDoc } | null = null;
  let bestPriority = -1;

  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(lineText)) !== null) {
    const token = match[1];
    const doc = GLSL_DOCS[token];
    if (!doc) continue;
    const priority = KIND_PRIORITY[doc.kind];
    if (priority > bestPriority) {
      bestPriority = priority;
      best = { token, doc };
    }
  }

  return best;
}
