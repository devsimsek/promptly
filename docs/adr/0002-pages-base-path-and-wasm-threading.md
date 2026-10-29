# 0002 GitHub Pages project page with single-thread WASM fallback

Date: 2026-10-29

## Status

Accepted

## Context

promptly deploys to GitHub Pages as a project page under /promptly/.
Native Pages does not let a site set Cross-Origin-Opener-Policy and
Cross-Origin-Embedder-Policy response headers, so `crossOriginIsolated`
is false and onnxruntime-web's WASM multithreading is unavailable.
Relative asset URLs must reach the worker, the AudioWorklet processor,
and runtime binaries under the /promptly/ subpath.

## Decision

- Keep the Vite base at /promptly/ (overridable through PUBLIC_BASE) and
  reference the AudioWorklet processor through `import.meta.env.BASE_URL`
  and the Whisper worker through `new URL(..., import.meta.url)` so the
  bundler rewrites both.
- Pin `env.backends.onnx.wasm.numThreads = 1` in the worker. Inference
  already runs in a dedicated Web Worker, so the UI thread stays free even
  without threads. Inference stays bounded: at most two queued audio
  buffers, oldest dropped; backlog beyond that triggers a lagging notice
  and a WPM offer rather than silent drift.

## Alternatives rejected

- coi-serviceworker or an isolation proxy: extra moving parts and a
  service worker on the critical path just to enable worker threads.
- Moving the app to a custom domain behind a header-capable host:
  out of scope for this release.

## Consequences

- Predictable correctness everywhere Pages serves the app.
- Slower WASM inference than threaded builds would give on desktop CPU
  fallback; WebGPU devices keep their fast path.
