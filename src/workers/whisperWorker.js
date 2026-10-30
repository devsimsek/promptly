// Inference worker: owns the Whisper pipeline so the UI thread stays free.
// Model choice and parameters live in docs/adr/0001-whisper-tiny.en-english-only.md

import { pipeline, env } from "@huggingface/transformers";
import { transcriptToSpokenWords } from "../utils/normalization.js";
import { DEFAULT_MODEL_ID } from "./modelOptions.js";

// GitHub Pages serves without COOP/COEP, so SharedArrayBuffer and WASM
// threading are unavailable; keep one thread (see adr 0002).
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
let recognizer = null;
let device = null;
let recognizerOptions = {};
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

async function load(message) {
  const modelId = typeof message.modelId === "string" ? message.modelId : DEFAULT_MODEL_ID;
  const multilingual = !modelId.endsWith(".en");
  // English-only models reject language/task (adr 0001); multilingual
  // models default to English transcription.
  const generationOptions = multilingual ? { language: "english", task: "transcribe" } : {};

  try {
    recognizer = await pipeline("automatic-speech-recognition", modelId, {
      device: "webgpu",
      dtype: "fp32", // safe quality; Whisper is quantization-sensitive
      progress_callback: forwardProgress,
    });
    device = "webgpu";
  } catch (webgpuError) {
    self.postMessage({
      type: "device-fallback",
      from: "webgpu",
      message: String(webgpuError?.message || webgpuError),
    });
    try {
      // q8 for CPU: ~40 MB instead of ~151 MB of fp32 for tiny.en.
      recognizer = await pipeline("automatic-speech-recognition", modelId, {
        device: "wasm",
        dtype: "q8",
        progress_callback: forwardProgress,
      });
      device = "wasm";
    } catch (wasmError) {
      // Never die silently: surface the exact failure to the UI.
      self.postMessage({
        type: "error",
        message: `Model init failed on both WebGPU and WASM: ${String(wasmError?.message || wasmError)}`,
      });
      self.postMessage({ type: "idle" });
      return;
    }
  }
  recognizerOptions = generationOptions;
  self.postMessage({ type: "ready", device });
}

async function drain() {
  if (busy) return;
  busy = true;
  self.postMessage({ type: "infer-start" });
  while (queue.length > 0) {
    const audio = queue.shift();
    try {
      const output = await recognizer(audio, { return_timestamps: false, ...recognizerOptions });
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

// Bridge anything else (module-level throws, unhandled rejections) so the
// operator sees the real cause instead of a generic crash note.
self.addEventListener("unhandledrejection", (event) => {
  self.postMessage({
    type: "error",
    message: `Whisper worker failed: ${String(event.reason?.message || event.reason)}`,
  });
  self.postMessage({ type: "idle" });
});
