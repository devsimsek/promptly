// Stateful linear resampler used by the ScriptProcessorNode fallback in
// browsers without AudioWorklet. The worklet processor
// (public/worklets/resampler-processor.js) implements the same algorithm;
// changes here are mirrored there. Phase carries across chunk boundaries
// via a continuous source cursor, so a sample stream stays smooth.

const TARGET_RATE = 16000;

export class Resampler {
  constructor(inputRate) {
    this.inputRate = inputRate;
    this.cursor = 0; // absolute source position (float, source samples)
    this.bufferStart = 0; // source index where the current buffer begins
  }

  /** Notes for one mono input buffer; returns 16 kHz samples. */
  push(mono) {
    if (!mono || mono.length === 0) return new Float32Array(0);
    const ratio = this.inputRate / TARGET_RATE;
    const end = this.bufferStart + mono.length;
    const count = Math.max(0, Math.ceil((end - this.cursor) / ratio));
    const out = new Float32Array(count);
    for (let k = 0; k < count; k += 1) {
      const pos = this.cursor + k * ratio;
      const local = pos - this.bufferStart;
      let s0;
      let s1;
      let frac;
      if (local < 0) {
        // Interpolate across the chunk boundary (carry sample to mono[0]).
        s0 = this.carry ?? mono[0];
        s1 = mono[0];
        frac = 1 + local;
      } else {
        const i0 = Math.min(Math.floor(local), mono.length - 1);
        frac = Math.min(1, Math.max(0, local - i0));
        s0 = mono[i0];
        s1 = i0 + 1 < mono.length ? mono[i0 + 1] : s0;
      }
      out[k] = s0 + (s1 - s0) * frac;
    }
    this.cursor = this.cursor + count * ratio; // leftover fraction carries
    this.bufferStart = end;
    this.carry = mono[mono.length - 1];
    return out;
  }
}

/** Mono-safe averaging across channels, tolerating short channel arrays. */
export function downmix(buffers, length) {
  const mono = new Float32Array(length);
  let used = 0;
  for (const buffer of buffers) {
    if (!buffer) continue;
    used += 1;
    for (let i = 0; i < mono.length; i += 1) {
      mono[i] += (buffer[i] || 0) / buffers.length;
    }
  }
  return used > 0 ? mono : null;
}
