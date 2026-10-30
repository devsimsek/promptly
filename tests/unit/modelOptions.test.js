import { describe, expect, it } from "vitest";
import {
  MODELS,
  hasWebGPU,
  resolveEnginePlan,
  resolveThreads,
} from "../../src/workers/modelOptions.js";

const MOONSHINE_TINY = "onnx-community/moonshine-tiny-ONNX";
const WHISPER_TINY_EN = "onnx-community/whisper-tiny.en";

describe("resolveEnginePlan", () => {
  it("auto without GPU goes straight to moonshine on wasm", () => {
    const plan = resolveEnginePlan("auto", false);
    expect(plan.attempts).toEqual([{ modelId: MOONSHINE_TINY, device: "wasm" }]);
  });

  it("auto with GPU tries whisper fp32 on webgpu, then moonshine wasm", () => {
    const plan = resolveEnginePlan("auto", true);
    expect(plan.attempts[0]).toEqual({
      modelId: WHISPER_TINY_EN,
      device: "webgpu",
      dtype: "fp32",
    });
    expect(plan.attempts[1]).toEqual({ modelId: MOONSHINE_TINY, device: "wasm" });
  });

  it("explicit moonshine runs only on wasm", () => {
    const plan = resolveEnginePlan(MOONSHINE_TINY, true);
    expect(plan.attempts).toEqual([{ modelId: MOONSHINE_TINY, device: "wasm" }]);
  });

  it("explicit whisper keeps webgpu first when available", () => {
    const plan = resolveEnginePlan("onnx-community/whisper-base", true);
    expect(plan.attempts.map((a) => a.device)).toEqual(["webgpu", "wasm"]);
  });

  it("explicit whisper falls straight to wasm without GPU", () => {
    const plan = resolveEnginePlan(WHISPER_TINY_EN, false);
    expect(plan.attempts).toEqual([{ modelId: WHISPER_TINY_EN, device: "wasm" }]);
  });

  it("unknown model ids fall back to the auto plan", () => {
    const plan = resolveEnginePlan("definitely-not-real", false);
    expect(plan.attempts[0].modelId).toBe(MOONSHINE_TINY);
  });

  it("catalog exposes the auto option to the selector", () => {
    expect(MODELS[0]).toMatchObject({ id: "auto", family: "auto" });
  });
});

describe("resolveThreads", () => {
  it("stays single-threaded without cross-origin isolation", () => {
    expect(resolveThreads(false, 8)).toBe(1);
    expect(resolveThreads(undefined, 8)).toBe(1);
  });

  it("caps threads at 4 with isolation", () => {
    expect(resolveThreads(true, 2)).toBe(2);
    expect(resolveThreads(true, 16)).toBe(4);
    expect(resolveThreads(true, 1)).toBe(1);
    expect(resolveThreads(true, undefined)).toBe(1);
  });
});

describe("hasWebGPU", () => {
  it("probes navigator.gpu on the given global", () => {
    expect(hasWebGPU({ navigator: {} })).toBe(false);
    expect(hasWebGPU({ navigator: { gpu: {} } })).toBe(true);
    expect(hasWebGPU({})).toBe(false);
  });
});
