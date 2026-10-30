import { describe, expect, it } from "vitest";
import { Resampler, downmix } from "../../src/audio/resampler.js";

describe("Resampler", () => {
  it("passthrough matches at 16 kHz input", () => {
    const resampler = new Resampler(16000);
    const input = Float32Array.from([0, 0.25, 0.5, 0.75, 1]);
    const out = resampler.push(input);
    expect(out.length).toBe(5);
    expect(out[2]).toBeCloseTo(0.5);
  });

  it("downsamples 48 kHz to 16 kHz sampling the same signal", () => {
    const resampler = new Resampler(48000);
    const input = Float32Array.from({ length: 480 }, (_, i) => Math.sin(i / 10));
    const out = resampler.push(input);
    expect(out.length).toBe(160);
    // Output sample k lands near input index 3k; linear interpolation
    // between neighbors keeps it within one input step of the sine.
    for (let k = 0; k < out.length; k += 1) {
      const sourceAt = 3 * k;
      const floorValue = Math.sin(Math.floor(sourceAt) / 10);
      const ceilValue = Math.sin(Math.ceil(sourceAt) / 10);
      expect(out[k]).toBeGreaterThanOrEqual(Math.min(floorValue, ceilValue) - 0.01);
      expect(out[k]).toBeLessThanOrEqual(Math.max(floorValue, ceilValue) + 0.01);
    }
  });

  it("keeps phase continuity across chunk boundaries", () => {
    const resampler = new Resampler(48000);
    // First chunk 470 samples (not divisible by the 3-sample ratio), so
    // the boundary lands mid-ratio; the second chunk continues the stream.
    const a = resampler.push(Float32Array.from({ length: 470 }, (_, i) => Math.sin(i / 5)));
    const sourceAtBoundary = Math.round(resampler.cursor); // carried position
    const b = resampler.push(
      Float32Array.from({ length: 480 }, (_, i) => Math.sin((470 + i) / 5))
    );
    for (const chunk of [a, b]) {
      for (const value of chunk) expect(Number.isFinite(value)).toBe(true);
    }
    expect(Math.abs(b[0] - Math.sin(sourceAtBoundary / 5))).toBeLessThan(0.05);
  });
});

describe("downmix", () => {
  it("averages stereo to mono", () => {
    const left = Float32Array.from([1, 1]);
    const right = Float32Array.from([0, 0]);
    const mono = downmix([left, right], 2);
    expect([...mono]).toEqual([0.5, 0.5]);
  });

  it("returns null without channels", () => {
    expect(downmix([], 4)).toBeNull();
  });
});
