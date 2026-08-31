// WebGL2 vertex shader (GLSL ES 3.00)
const VERTEX_SRC_V2 = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// WebGL1 fallback vertex shader (GLSL ES 1.00)
const VERTEX_SRC_V1 = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Shadertoy preamble for WebGL2 — GLSL ES 3.00, no texture2D restriction, dynamic loop bounds allowed
const SHADERTOY_PREAMBLE_V2 = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform float iChannelTime[4];
uniform vec3 iChannelResolution[4];
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec4 iDate;
uniform float iSampleRate;
out vec4 out_fragColor;
`;

// Shadertoy preamble for WebGL1 fallback
const SHADERTOY_PREAMBLE_V1 = `precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform float iChannelTime[4];
uniform vec3 iChannelResolution[4];
uniform vec4 iMouse;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
uniform vec4 iDate;
uniform float iSampleRate;
`;

// WebGL2: use out_fragColor declared in preamble; texture() is native in GLSL ES 3.0
const SHADERTOY_MAIN_V2 = `
void main() {
  mainImage(out_fragColor, gl_FragCoord.xy);
}
`;

// WebGL1: gl_FragColor is built-in; replace texture() with texture2D()
const SHADERTOY_MAIN_V1 = `
void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

export type ShaderErrorCallback = (err: string | null) => void;
export type FpsCallback = (fps: number) => void;

function isShadertoy(src: string): boolean {
  return /void\s+mainImage\s*\(/.test(src);
}


function buildShadertoySource(src: string, webgl2: boolean): { src: string; preambleLines: number } {
  if (webgl2) {
    const preamble = SHADERTOY_PREAMBLE_V2;
    return { src: preamble + src + SHADERTOY_MAIN_V2, preambleLines: preamble.split("\n").length - 1 };
  }
  // WebGL1: replace texture() → texture2D() since GLSL ES 1.0 doesn't have texture()
  const patched = src.replace(/\btexture\s*\(/g, "texture2D(");
  const preamble = SHADERTOY_PREAMBLE_V1;
  return { src: preamble + patched + SHADERTOY_MAIN_V1, preambleLines: preamble.split("\n").length - 1 };
}

/** Create a 1×1 black placeholder texture for iChannel slots */
function makeDummyTexture(gl: WebGLRenderingContext | WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  onError: ShaderErrorCallback,
  onFps: FpsCallback = () => {},
) {
  const gl2 = canvas.getContext("webgl2");
  const gl1 = gl2 ? null : canvas.getContext("webgl");
  const gl: WebGLRenderingContext | WebGL2RenderingContext | null = gl2 ?? gl1;
  const webgl2 = !!gl2;

  if (!gl) { onError("WebGL not available in this browser"); return null; }

  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

  const dummyTextures = [0, 1, 2, 3].map(() => makeDummyTexture(gl));

  let program: WebGLProgram | null = null;
  let isShadertoyProgram = false;
  let rafId = 0;
  let running = true;
  // Distinguish a user-initiated stop (Pause button) from the watchdog pausing
  // the loop. Only a watchdog pause auto-resumes when the shader is edited —
  // a user pause stays paused until they hit Play again.
  let userPaused = false;
  let frameCount = 0;
  let prevTime = performance.now();
  const startTime = performance.now();
  let smoothedFps = 60;
  let lastReportedFps = -1;

  let mouseX = 0, mouseY = 0, mouseClickX = 0, mouseClickY = 0;
  canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * devicePixelRatio;
    mouseY = canvas.height - (e.clientY - r.top) * devicePixelRatio;
  });
  canvas.addEventListener("mousedown", e => {
    const r = canvas.getBoundingClientRect();
    mouseClickX = (e.clientX - r.left) * devicePixelRatio;
    mouseClickY = canvas.height - (e.clientY - r.top) * devicePixelRatio;
  });

  function compile(src: string, type: number): WebGLShader | null {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
      const log = gl!.getShaderInfoLog(s) ?? "Unknown compile error";
      gl!.deleteShader(s);
      onError(log.trim());
      return null;
    }
    return s;
  }

  function buildProgram(fragSrc: string): { prog: WebGLProgram; shadertoy: boolean } | null {
    const shadertoy = isShadertoy(fragSrc);

    const vertSrc = (shadertoy && webgl2) ? VERTEX_SRC_V2 : VERTEX_SRC_V1;

    let compileSrc: string;
    let preambleLines = 0;
    if (shadertoy) {
      const built = buildShadertoySource(fragSrc, webgl2);
      compileSrc = built.src;
      preambleLines = built.preambleLines;
    } else {
      compileSrc = fragSrc;
    }

    const vert = compile(vertSrc, gl!.VERTEX_SHADER);
    if (!vert) return null;

    const fragShader = gl!.createShader(gl!.FRAGMENT_SHADER)!;
    gl!.shaderSource(fragShader, compileSrc);
    gl!.compileShader(fragShader);
    if (!gl!.getShaderParameter(fragShader, gl!.COMPILE_STATUS)) {
      const rawLog = gl!.getShaderInfoLog(fragShader)?.trim() ?? "Unknown compile error";
      gl!.deleteShader(fragShader);
      gl!.deleteShader(vert);
      const adjustedLog = preambleLines > 0
        ? rawLog.replace(/ERROR:\s*(\d+):(\d+)/g, (_, a, b) => {
            const adjusted = parseInt(b, 10) - preambleLines;
            return `ERROR: ${a}:${adjusted > 0 ? adjusted : b}`;
          })
        : rawLog;
      onError(adjustedLog);
      return null;
    }

    const prog = gl!.createProgram()!;
    gl!.attachShader(prog, vert);
    gl!.attachShader(prog, fragShader);
    gl!.linkProgram(prog);
    gl!.deleteShader(vert);
    gl!.deleteShader(fragShader);

    if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
      onError(gl!.getProgramInfoLog(prog)?.trim() ?? "Link error");
      gl!.deleteProgram(prog);
      return null;
    }

    return { prog, shadertoy };
  }

  // GPU hang watchdog: if a single frame takes longer than this, stop rendering
  const FRAME_TIMEOUT_MS = 1000;
  let slowFrames = 0;
  const MAX_SLOW_FRAMES = 2;

  function updateShader(fragSrc: string) {
    const result = buildProgram(fragSrc);
    if (!result) return;
    if (program) gl!.deleteProgram(program);
    program = result.prog;
    isShadertoyProgram = result.shadertoy;
    frameCount = 0;
    slowFrames = 0;
    prevTime = performance.now();
    onError(null);
    // If the watchdog paused the loop (see FRAME_TIMEOUT_MS), resume it so the
    // fixed shader starts rendering again — otherwise it would sit at "Live"
    // while the canvas stays frozen. A user-initiated pause is respected.
    if (!running && !userPaused) {
      running = true;
      prevTime = performance.now();
      frame();
    }
  }

  let lastW = 0, lastH = 0;

  function frame() {
    rafId = requestAnimationFrame(frame);
    if (!program) return;

    const now = performance.now();
    const delta = now - prevTime;

    // Watchdog: GPU hang detection. Skip frame 0 — it can be slow spuriously
    // while GL JIT-compiles and the program is first bound.
    if (frameCount > 0 && delta > FRAME_TIMEOUT_MS) {
      slowFrames++;
      if (slowFrames >= MAX_SLOW_FRAMES) {
        cancelAnimationFrame(rafId);
        running = false;
        onError(`Shader is too slow — rendering paused to protect the page.\nFrame took ${Math.round(delta)}ms. Loops bound by fragCoord or iResolution can be O(width²·height) per pixel.`);
        return;
      }
    } else {
      slowFrames = 0;
    }

    // Smoothed FPS readout, reported only when the rounded value changes so the
    // DOM isn't updated on every frame.
    if (delta > 0) {
      smoothedFps = smoothedFps * 0.9 + (1000 / delta) * 0.1;
      const rounded = Math.round(smoothedFps);
      if (rounded !== lastReportedFps) {
        lastReportedFps = rounded;
        onFps(rounded);
      }
    }

    const t = (now - startTime) / 1000;
    prevTime = now;

    const w = canvas.clientWidth * devicePixelRatio;
    const h = canvas.clientHeight * devicePixelRatio;
    if (w !== lastW || h !== lastH) {
      canvas.width = w;
      canvas.height = h;
      gl!.viewport(0, 0, w, h);
      lastW = w; lastH = h;
    }

    gl!.useProgram(program);

    const pos = gl!.getAttribLocation(program, "a_position");
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
    gl!.enableVertexAttribArray(pos);
    gl!.vertexAttribPointer(pos, 2, gl!.FLOAT, false, 0, 0);

    if (isShadertoyProgram) {
      const u = (name: string) => gl!.getUniformLocation(program!, name);

      const resLoc = u("iResolution");
      if (resLoc) gl!.uniform3f(resLoc, canvas.width, canvas.height, canvas.width / canvas.height);

      const timeLoc = u("iTime");
      if (timeLoc) gl!.uniform1f(timeLoc, t);

      const deltaS = delta / 1000;
      const tdLoc = u("iTimeDelta");
      if (tdLoc) gl!.uniform1f(tdLoc, deltaS);

      const frLoc = u("iFrameRate");
      if (frLoc) gl!.uniform1f(frLoc, deltaS > 0 ? 1 / deltaS : 60);

      const frameLoc = u("iFrame");
      if (frameLoc) gl!.uniform1i(frameLoc, frameCount);

      const mouseLoc = u("iMouse");
      if (mouseLoc) gl!.uniform4f(mouseLoc, mouseX, mouseY, mouseClickX, mouseClickY);

      const srLoc = u("iSampleRate");
      if (srLoc) gl!.uniform1f(srLoc, 44100);

      const now2 = new Date();
      const dateLoc = u("iDate");
      if (dateLoc) gl!.uniform4f(dateLoc,
        now2.getFullYear(), now2.getMonth(), now2.getDate(),
        now2.getHours() * 3600 + now2.getMinutes() * 60 + now2.getSeconds()
      );

      for (let i = 0; i < 4; i++) {
        const loc = u(`iChannel${i}`);
        if (loc) {
          gl!.activeTexture(gl!.TEXTURE0 + i);
          gl!.bindTexture(gl!.TEXTURE_2D, dummyTextures[i]);
          gl!.uniform1i(loc, i);
        }
      }
    } else {
      const timeLoc = gl!.getUniformLocation(program, "u_time");
      const resLoc  = gl!.getUniformLocation(program, "u_resolution");
      if (timeLoc) gl!.uniform1f(timeLoc, t);
      if (resLoc)  gl!.uniform2f(resLoc, canvas.width, canvas.height);
    }

    gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    frameCount++;
  }

  frame();

  return {
    updateShader,
    setRunning(next: boolean) {
      if (next === running) return;
      running = next;
      if (next) {
        userPaused = false;
        prevTime = performance.now();
        onError(null);
        frame();
      } else {
        userPaused = true;
        cancelAnimationFrame(rafId);
      }
    },
    destroy() { cancelAnimationFrame(rafId); },
  };
}
