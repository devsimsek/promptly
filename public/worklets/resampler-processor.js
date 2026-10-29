// AudioWorklet processor: captures mic input, downmixes to mono, resamples
// to 16 kHz Float32, and emits rolling ~2 s buffers (~1 s hop overlapped).
// Registered from the main thread via
//   audioContext.audioWorklet.addModule(`${import.meta.env.BASE_URL}worklets/resampler-processor.js`)

const TARGET_RATE = 16000;
const WINDOW_SAMPLES = 32000; // 2 s at 16 kHz
const HOP_SAMPLES = 16000; // emit every 1 s of fresh input

class ResamplerProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.inputRate = sampleRate; // global provided by the worklet context
    this.targetRate = TARGET_RATE;
    this.ring = new Float32Array(this.inputRate * 3); // ~3 s, resampled 16k
    this.ringLength = 0;
    this.emittedSinceWindowStart = 0;
    this.carrySample = 0;
    this.carryPhase = 0;
  }

  appendResampled(input) {
    const ratio = this.inputRate / this.targetRate;
    const outLength = Math.floor((input.length * TARGET_RATE) / this.inputRate);
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i += 1) {
      const srcAt = i * ratio + this.carryPhase;
      const srcWhole = Math.floor(srcAt);
      const frac = srcAt - srcWhole;
      const s0 = srcWhole >= 0 ? (srcWhole < input.length ? input[srcWhole] : 0) : this.carrySample;
      const s1 = srcWhole + 1 < input.length ? input[srcWhole + 1] : s0;
      out[i] = s0 + (s1 - s0) * frac;
    }
    this.carrySample = input.length ? input[input.length - 1] : this.carrySample;
    return out;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channels = input.length;
    let mono;
    if (channels === 1) {
      mono = input[0];
      if (!mono) return true;
    } else {
      mono = new Float32Array(input[0]?.length || 0);
      for (let c = 0; c < channels; c += 1) {
        const ch = input[c];
        if (!ch) continue;
        for (let i = 0; i < mono.length; i += 1) mono[i] += ch[i] / channels;
      }
    }

    const resampled = this.appendResampled(mono);
    const capacity = this.ring.length;
    if (this.ringLength + resampled.length > capacity) {
      // drop the front, keep the tail (presenter paused too long)
      const keep = this.ring.subarray(this.ringLength - (capacity - resampled.length), this.ringLength);
      this.ring.set(keep, 0);
      this.ringLength = keep.length;
    }
    this.ring.set(resampled, this.ringLength);
    this.ringLength += resampled.length;
    this.emittedSinceWindowStart += resampled.length;

    if (this.ringLength >= WINDOW_SAMPLES && this.emittedSinceWindowStart >= HOP_SAMPLES) {
      const out = this.ring.slice(this.ringLength - WINDOW_SAMPLES, this.ringLength);
      this.port.postMessage({ audio: out }, [out.buffer]);
      this.emittedSinceWindowStart = 0;
    }
    return true;
  }
}

registerProcessor("resampler", ResamplerProcessor);
