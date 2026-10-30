// AudioWorklet processor: captures mic input, downmixes to mono, resamples
// to 16 kHz Float32, and emits rolling ~2 s buffers (~1 s hop overlapped).
// Registered from the main thread via
//   audioContext.audioWorklet.addModule(`${import.meta.env.BASE_URL}worklets/resampler-processor.js`)
// Mirrors src/audio/resampler.js; browsers without AudioWorklet use the
// ScriptProcessorNode fallback with the class instead.

const TARGET_RATE = 16000;
const WINDOW_SAMPLES = 32000; // 2 s at 16 kHz
const HOP_SAMPLES = 16000; // emit every 1 s of fresh input

class ResamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.inputRate = sampleRate; // global provided by the worklet context
    this.cursor = 0; // absolute source position (float)
    this.bufferStart = 0;
    this.carry = 0;
    this.ring = new Float32Array(this.inputRate * 3); // ~3 s, resampled 16k
    this.ringLength = 0;
    this.emittedSinceWindowStart = 0;
  }

  appendResampled(mono) {
    if (!mono || mono.length === 0) return null;
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
        s0 = this.carry;
        s1 = mono[0];
        frac = Math.min(1, Math.max(0, 1 + local));
      } else {
        const i0 = Math.min(Math.floor(local), mono.length - 1);
        frac = Math.min(1, Math.max(0, local - i0));
        s0 = mono[i0];
        s1 = i0 + 1 < mono.length ? mono[i0 + 1] : s0;
      }
      out[k] = s0 + (s1 - s0) * frac;
    }
    this.cursor = this.cursor + count * ratio;
    this.bufferStart = end;
    this.carry = mono[mono.length - 1];
    return out;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channels = input.length;
    let mono = null;
    if (channels === 1) {
      mono = input[0];
    } else {
      mono = new Float32Array(input[0]?.length || 0);
      for (let c = 0; c < channels; c += 1) {
        const ch = input[c];
        if (!ch) continue;
        for (let i = 0; i < mono.length; i += 1) mono[i] += ch[i] / channels;
      }
    }

    const resampled = this.appendResampled(mono);
    if (resampled && resampled.length) {
      const capacity = this.ring.length;
      const overflow = this.ringLength + resampled.length - capacity;
      if (overflow > 0) {
        // drop the front, keep the tail (presenter paused too long)
        const keep = this.ring.subarray(overflow, this.ringLength);
        this.ring.set(keep, 0);
        this.ringLength = keep.length;
      }
      this.ring.set(resampled, this.ringLength);
      this.ringLength += resampled.length;
      this.emittedSinceWindowStart += resampled.length;
    }

    if (this.ringLength >= WINDOW_SAMPLES && this.emittedSinceWindowStart >= HOP_SAMPLES) {
      const out = this.ring.slice(this.ringLength - WINDOW_SAMPLES, this.ringLength);
      this.port.postMessage({ audio: out }, [out.buffer]);
      this.emittedSinceWindowStart = 0;
    }
    return true;
  }
}

registerProcessor("resampler", ResamplerProcessor);
