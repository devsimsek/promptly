# promptly

A private, browser-based teleprompter with speech tracking. Scripts live
in IndexedDB in your browser; the Whisper model runs on-device through
[@huggingface/transformers](https://huggingface.co/docs/transformers.js)
(WebGPU when available, WASM otherwise). No backend, no telemetry: the
only outbound traffic is the model download.

## Features

- Script library with import (.txt / .md / .markdown), rename, delete,
  autosave, and reading-position memory (content edits reset it).
- Markdown-aware prompter: headers inline styles, links keep text without
  URLs, images dropped, rules become pause separators.
- Speech tracking: an in-browser Whisper aligns your microphone to the
  script and pins the current word to the focal eye-line (top 33 percent
  by default).
- Manual and WPM fallback modes; WPM is adjustable 80-250 with ArrowUp
  and ArrowDown, Space pauses and resumes.
- Hardware rig utilities: horizontal mirror for beamsplitter glass, OLED
  pure-black background, font size 24-72 px, line-height control, and
  fullscreen.
- Tapping a word repositions the tracking pointer.

## Getting started

```bash
npm install
npm run dev
```

Open the printed URL. The first Start Tracking downloads roughly 40 MB of
model files, then caches them in the browser.

## Tests

```bash
npm test          # unit + component (Vitest, jsdom)
npm run test:e2e  # production-build browser tests (Playwright)
npm run build     # production bundle under dist/
```

## Deploying

The build targets a GitHub Pages project page at `/promptly/`:

```
.github/workflows/deploy-pages.yml  # builds and deploys on push to main
.github/workflows/ci.yml            # tests + build gate
```

Set the repository's Pages source to GitHub Actions once. Other hosts or
user sites: set `PUBLIC_BASE=/` (or any subpath) at build time.

## Notes

- Multithreaded WASM needs cross-origin isolation, which native GitHub
  Pages cannot provide; see `docs/adr/0002`. WebGPU devices use their
  accelerated path, everything else falls back to single-thread WASM.
- Android WebGPU and inference speed vary by device; the prompter detects
  backlog and offers WPM mode instead of drifting silently.
- Speech tracking is English-only while using whisper-tiny.en
  (`docs/adr/0001`).
