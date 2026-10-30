// Model metadata shared between the engine UI and the inference worker.
// Families: whisper takes language/task options only on multilingual
// variants; moonshine takes none. Device plans live in resolveEnginePlan.

export const LEGACY_DEFAULT_MODEL_ID = "onnx-community/whisper-tiny.en";

export const DEFAULT_MODEL_ID = "auto";

export const MODELS = [
  {
    id: "auto",
    label: "auto - whisper on WebGPU, moonshine on CPU",
    family: "auto",
  },
  {
    id: LEGACY_DEFAULT_MODEL_ID,
    label: "whisper tiny.en - English only (~40 MB, slow on CPU)",
    family: "whisper",
  },
  {
    id: "onnx-community/whisper-tiny",
    label: "whisper tiny - multilingual (~40 MB, slow on CPU)",
    family: "whisper",
  },
  {
    id: "onnx-community/whisper-base.en",
    label: "whisper base.en - English only (~75 MB, slow on CPU)",
    family: "whisper",
  },
  {
    id: "onnx-community/whisper-base",
    label: "whisper base - multilingual (~75 MB, slow on CPU)",
    family: "whisper",
  },
  {
    id: "onnx-community/moonshine-tiny-ONNX",
    label: "moonshine tiny - English only, no 30s padding (auto on CPU)",
    family: "moonshine",
  },
  {
    id: "onnx-community/moonshine-base-ONNX",
    label: "moonshine base - English only, better accuracy (no 30s padding)",
    family: "moonshine",
  },
];

const VALID_IDS = new Set(MODELS.map((model) => model.id));

/** Stored selections inherit upgrades once: the legacy whisper-only
 ** default migrates to the hybrid auto engine. */
const VALID_LEGACY_IDS = new Set([LEGACY_DEFAULT_MODEL_ID]);
export const storedModelIds = VALID_IDS.union(VALID_LEGACY_IDS);

/** Worker- and main-thread independent GPU presence probe. */
export function hasWebGPU(globalScope = typeof self !== "undefined" ? self : globalThis) {
  return Boolean(globalScope?.navigator?.gpu);
}

/** One transcription-engine request plan, in attempt order. */
export function resolveEnginePlan(modelId, gpuPresent) {
  const requested = modelId === "auto" ? null : modelId;
  if (requested && VALID_IDS.has(requested)) {
    const entry = MODELS.find((model) => model.id === requested);
    if (entry.family === "moonshine") {
      return { attempts: [{ modelId: entry.id, device: "wasm" }] };
    }
    return gpuPresent
      ? {
          attempts: [
            { modelId: entry.id, device: "webgpu", dtype: "fp32" },
            { modelId: entry.id, device: "wasm" },
          ],
        }
      : { attempts: [{ modelId: entry.id, device: "wasm" }] };
  }
  if (gpuPresent) {
    return {
      attempts: [
        { modelId: "onnx-community/whisper-tiny.en", device: "webgpu", dtype: "fp32" },
        { modelId: "onnx-community/moonshine-tiny-ONNX", device: "wasm" },
      ],
    };
  }
  return { attempts: [{ modelId: "onnx-community/moonshine-tiny-ONNX", device: "wasm" }] };
}

/**
 * ORT wasm thread budget. Threads need cross-origin isolation (the
 * coi-serviceworker registration provides it); cap at 4 because phones
 * choke beyond that.
 */
export function resolveThreads(crossOriginIsolated, hardwareConcurrency) {
  if (!crossOriginIsolated) return 1;
  const cores = Math.max(1, Number(hardwareConcurrency) || 1);
  return Math.min(4, cores);
}
