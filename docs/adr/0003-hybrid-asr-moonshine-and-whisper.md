# 0003 Hybrid ASR engines: Moonshine for CPU, Whisper for WebGPU

Date: 2026-10-30

## Status

Accepted

## Context

Real-phone testing showed Whisper's CPU path is not fast enough for live
tracking: every request is padded to a 30 second feature window
(preprocessor config n_samples 480000), so a 2 second buffer still costs
seconds of single-threaded WASM. WebGPU availability per device varies;
many Android devices fall back to CPU.

## Decision

The engine setting supports `auto` (the default): when a WebGPU adapter
is present, load Whisper tiny.en with fp32 there; any CPU path loads
Moonshine tiny (`onnx-community/moonshine-tiny-ONNX`), whose variable
length input removes the 30 second padding tax. Explicit model selection
in the selector runs that model on WASM (Whisper also retries WebGPU
first when an adapter exists). Multilingual Whisper selections keep
`language`/`task`; English-only and Moonshine omit them.

## Consequences

- CPU devices get a realistic real-time factor instead of a constant
  heavy load.
- Per-request timing in the engine card (last ms, 10-call average,
  audio seconds per processing second) drives tuning with data, not
  vibes; a ratio below 1 means the phone trails the presenter.
- Moonshine changes transcript variance; the sliding matcher handles it,
  and tokens are normalized through the same pipeline as before.
- Supersedes the single-engine assumption in ADR 0001; ADR 0002 gains the
  threading path through coi-serviceworker (see that ADR).
