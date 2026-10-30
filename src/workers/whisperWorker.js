// Inference worker: owns the ASR pipeline so the UI thread stays free.
// Model choice and parameters live in the ADRs 0001-0003.

import { pipeline, env } from "@huggingface/transformers";
import { transcriptToSpokenWords } from "../utils/normalization.js";
import { hasWebGPU, resolveEnginePlan, resolveThreads } from "./modelOptions.js";

// GitHub Pages serves without COOP/COEP headers, so this file plans for
// the coin-serviceworker path: threads appear only when the page proves
// crossOriginIsolated (see resolveThreads).
env.backends.onnx.wasm.numThreads = resolveThreads(
  typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : false,
  typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 1
);
env.backends.onnx.wasm.proxy = false;

let recognizer = null;
let device = null;
let recognizerFamily = "whisper";
let recognizerModelId = null;
let busy = false;
const queue = [];

function forwardProgress(callbackEvent) {
  if (!callbackEvent || !callbackEvent.status) return;
  const payload = {
    type: "progress",
    status: callbackEvent.status,
    file: callbackEvent.file,
    name: callbackEvent.name,
    loaded: callbackEvent.loaded,
    total: callbackEvent.total,
    progress: callbackEvent.progress,
  };
  self.postMessage(payload);
}

// English-only whisper rejects language/task (adr 0001); multilingual
// whisper and moonshine omit them here per family.
function generationOptionsFor(family, modelId) {
  if (family !== "whisper" || modelId.endsWith(".en")) return {};
  return { language: "english", task: "transcribe" };
}

/** Load one attempt; returns the recognizer and metadata or throws. */
async function attemptLoad(attempt) {
  return pipeline("automatic-speech-recognition", attempt.modelId, {
    device: attempt.device,
    ...(attempt.dtype ? { dtype: attempt.dtype } : {}),
    progress_callback: forwardProgress,
  });
}

async function load(message) {
  const plan = resolveEnginePlan(message.modelId, hasWebGPU());
  let lastError = null;
  for (const attempt of plan.attempts) {
    try {
      recognizer = await attemptLoad(attempt);
      device = attempt.device;
      recognizerFamily = attempt.modelId.includes("moonshine") ? "moonshine" : "whisper";
      recognizerModelId = attempt.modelId;
      self.postMessage({
        type: "ready",
        device,
        modelId: attempt.modelId,
        family: recognizerFamily,
      });
      return;
    } catch (error) {
      lastError = error;
      self.postMessage({
        type: "device-fallback",
        from: attempt.device,
        message: String(error?.message || error),
      });
    }
  }
  // Every attempt failed; surface the exact reason instead of dying silently.
  self.postMessage({
    type: "error",
    message: `Model init failed on every fallback: ${String(lastError?.message || lastError)}`,
  });
  self.postMessage({ type: "idle" });
}

async function drain() {
  if (busy) return;
  busy = true;
  self.postMessage({ type: "infer-start" });
  while (queue.length > 0) {
    const audio = queue.shift();
    try {
      const startedAt = performance.now();
      const generationOptions = generationOptionsFor(recognizerFamily, recognizerModelId);
      const output = await recognizer(audio, { return_timestamps: false, ...generationOptions });
      const elapsed = performance.now() - startedAt;
      const audioSeconds = audio.length / 16000;
      self.postMessage({
        type: "infer-timing",
        ms: Math.round(elapsed),
        audioSeconds: Math.round(audioSeconds * 100) / 100,
      });
      const words = transcriptToSpokenWords(output?.text || "");
      self.postMessage({ type: "transcription", words });
    } catch (error) {
      self.postMessage({ type: "error", message: String(error?.message || error) });
    }
  }
  busy = false;
  self.postMessage({ type: "idle" });
}

self.onmessage = async (event) => {
  const message = event.data || {};
  try {
    if (message.type === "load") {
      await load(message);
    } else if (message.type === "infer") {
      queue.push(message.audio);
      if (queue.length > 2) queue.shift(); // bound the backlog; drop oldest
      drain();
    } else if (message.type === "flush") {
      queue.length = 0;
    } else if (message.type === "dispose") {
      queue.length = 0;
    }
  } catch (handlerError) {
    self.postMessage({
      type: "error",
      message: `Whisper worker failed: ${String(handlerError?.message || handlerError)}`,
    });
    self.postMessage({ type: "idle" });
  }
};

// Bridge module-level throws and rejections so the operator sees the
// cause; never let the engine die silently.
self.addEventListener("unhandledrejection", (event) => {
  self.postMessage({
    type: "error",
    message: `Whisper worker failed: ${String(event.reason?.message || event.reason)}`,
  });
  self.postMessage({ type: "idle" });
});
