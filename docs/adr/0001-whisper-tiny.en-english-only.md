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

Run `onnx-community/whisper-tiny.en` by default and omit both `language`
and `task` for English-only models. Transformers.js throws "Cannot
specify task or language for an English-only model" for this model
(is_multilingual false), so the parameters in the input spec contradict
each other; the model choice wins because the on-device privacy and
download-size budget matter most. A model selector in edit mode offers
tiny/base in English-only and multilingual variants; multilingual
selections pass `language: 'english'` and `task: 'transcribe'`.
WebGPU is attempted first with WASM fallback; each request gets
`return_timestamps: false`.

## Consequences

- English-only by default for speech tracking; the selector enables the
  multilingual variants, which default to English transcription.
- Whisper pads every request to a 30 second feature window regardless of
  buffer length, so short buffers do not guarantee short inference. Real
  time behavior must be measured on physical Android hardware before
  claiming lag-free tracking; the UI detects backlog and offers WPM mode
  instead of guessing (ADR 0002).
