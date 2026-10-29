# 0001 Whisper tiny.en as the English-only speech model

Date: 2026-10-29

## Status

Accepted

## Context

promptly transcribes the presenter's voice in the browser with
Transformers.js. The input spec called for whisper-tiny or
whisper-tiny.en plus `language: 'english'` and `task: 'transcribe'`
parameters, and real-time behavior on 1-2 second rolling buffers.

## Decision

Run `onnx-community/whisper-tiny.en` and omit both `language` and `task`.
Transformers.js throws "Cannot specify task or language for an
English-only model" for this model (is_multilingual false), so the
parameters in the input spec contradict each other; the model choice wins
because the on-device privacy and download-size budget matter most.
WebGPU is attempted first with WASM fallback; each request gets
`return_timestamps: false`.

## Consequences

- English scripts only for speech tracking; multilingual tiny exits the
  first release.
- Whisper pads every request to a 30 second feature window regardless of
  buffer length, so short buffers do not guarantee short inference. Real
  time behavior must be measured on physical Android hardware before
  claiming lag-free tracking; the UI detects backlog and offers WPM mode
  instead of guessing (ADR 0002).
