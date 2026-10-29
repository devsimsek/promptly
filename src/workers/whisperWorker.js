// Inference worker: owns the Whisper pipeline so the UI thread stays free.
// Model choice and parameters live in docs/adr/0001-whisper-tiny.en-english-only.md

import { pipeline, env } from "@huggingface/transformers";
import { transcriptToSpokenWords } from "../utils/normalization.js";

// GitHub Pages serves without COOP/COEP, so SharedArrayBuffer and WASM
// threading are unavailable; keep one thread (see adr 0002).
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

export const DEFAULT_MODEL_ID = "onnx-community/whisper-tiny.en";

let recognizer = null;
let device = null;
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
      progress_callback: forwardProgress,
    });
    device = "webgpu";
  } catch (webgpuError) {
    self.postMessage({
      type: "device-fallback",
      from: "webgpu",
      message: String(webgpuError?.message || webgpuError),
    });
    recognizer = await pipeline("automatic-speech-recognition", modelId, {
      device: "wasm",
      progress_callback: forwardProgress,
    });
    device = "wasm";
  }
  self.postMessage({ type: "ready", device });
}

async function drain() {
  if (busy) return;
  busy = true;
  self.postMessage({ type: "infer-start" });
  while (queue.length > 0) {
    const audio = queue.shift();
    try {
      const output = await recognizer(audio, { return_timestamps: false });
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
};
