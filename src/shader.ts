const VERTEX_SRC = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);

export type ShaderErrorCallback = (err: string | null) => void;

export function createRenderer(canvas: HTMLCanvasElement, onError: ShaderErrorCallback) {
  const gl = canvas.getContext("webgl");
  if (!gl) { onError("WebGL not available in this browser"); return null; }

  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

  let program: WebGLProgram | null = null;
  let rafId = 0;
  const startTime = performance.now();

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

  function buildProgram(fragSrc: string): WebGLProgram | null {
    const vert = compile(VERTEX_SRC, gl!.VERTEX_SHADER);
    if (!vert) return null;
    const frag = compile(fragSrc, gl!.FRAGMENT_SHADER);
    if (!frag) { gl!.deleteShader(vert); return null; }

    const prog = gl!.createProgram()!;
    gl!.attachShader(prog, vert);
    gl!.attachShader(prog, frag);
    gl!.linkProgram(prog);
    gl!.deleteShader(vert);
    gl!.deleteShader(frag);

    if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
      onError(gl!.getProgramInfoLog(prog)?.trim() ?? "Link error");
      gl!.deleteProgram(prog);
      return null;
    }
    return prog;
  }

  function updateShader(fragSrc: string) {
    const next = buildProgram(fragSrc);
    if (!next) return;
    if (program) gl!.deleteProgram(program);
    program = next;
    onError(null);
  }

  let lastW = 0, lastH = 0;

  function frame() {
    rafId = requestAnimationFrame(frame);
    if (!program) return;

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

    const t = (performance.now() - startTime) / 1000;
    const timeLoc = gl!.getUniformLocation(program, "u_time");
    const resLoc  = gl!.getUniformLocation(program, "u_resolution");
    if (timeLoc) gl!.uniform1f(timeLoc, t);
    if (resLoc)  gl!.uniform2f(resLoc, canvas.width, canvas.height);

    gl!.drawArrays(gl!.TRIANGLES, 0, 6);
  }

  frame();

  return {
    updateShader,
    destroy() { cancelAnimationFrame(rafId); },
  };
}
