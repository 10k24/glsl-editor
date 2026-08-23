# GLSL Editor

Browser-based GLSL shader editor with live WebGL preview, published by [10k24 Studio](https://10k24.com).

Write a fragment shader, see it render instantly. Works with plain GLSL (`gl_FragColor`) and
[Shadertoy](https://www.shadertoy.com)-style shaders (`mainImage` + `iTime`, `iResolution`, etc.) — paste
Shadertoy code and it just runs.

## Features

- **Live preview** — debounced recompile on every keystroke, WebGL2 with WebGL1 fallback
- **Shadertoy compatibility** — `mainImage` entry point with the full set of `i*` uniforms wired up
- **Inline docs** — hover a line for plain-English explanations of GLSL built-ins and Shadertoy patterns
- **Autocomplete** — GLSL + Shadertoy-aware completions (toggle in header)
- **Define toggles** — flag-style `#define`s get checkboxes; flip dead code without editing
- **Preprocessor** — client-side `#ifdef/#else/#endif` branch stripping with line numbers preserved
- **Error surfacing** — compile errors mapped back to your source lines (gutter markers + overlay)
- **GPU watchdog** — pauses rendering if a frame hangs, protecting the page from pathological shaders

## Development

```bash
bun install
bun run dev        # dev server on :3000
bun run typecheck  # tsc --noEmit
bun run build      # production build → dist/public/
bun run preview    # serve the production build
```

## Deployment

`bun run build` outputs a static site to `dist/public/` (CNAME included). Deploy that directory —
GitHub Pages serves it at [glsl.10k24.com](https://glsl.10k24.com).

> Do not deploy the repo root: hosts serve `.ts` source as `video/mp2t`, which browsers refuse to
> execute as module scripts.

## License

LGPL-2.1 — see [LICENSE](LICENSE).
