// React hook owning the Whisper engine lifecycle, microphone capture, and
// rolling transcription callback stream. Exposes engine states:
//   unloaded | downloading | ready | listening | processing | error

import { useCallback, useEffect, useRef, useState } from "react";

const ENGINE_STATES = ["unloaded", "downloading", "ready", "listening", "processing", "error"];

function audioWorkletUrl() {
  return `${import.meta.env.BASE_URL}worklets/resampler-processor.js`;
}

export function useLocalWhisper() {
  const [engineState, setEngineState] = useState("unloaded");
  const [progress, setProgress] = useState(null); // { percent, loaded, total } | null
  const [device, setDevice] = useState(null); // "webgpu" | "wasm"
  const [error, setError] = useState(null);
  const [listening, setListening] = useState(false);
  const engineStateRef = useRef(engineState);
  engineStateRef.current = engineState;
  const listeningRef = useRef(false);

  const workerRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const wakeLockRef = useRef(null);
  const sessionRef = useRef({ active: false, number: 0 });
  const transcriptionListeners = useRef(new Set());

  const subscribe = useCallback((listener) => {
    transcriptionListeners.current.add(listener);
    return () => transcriptionListeners.current.delete(listener);
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return true;
    if (typeof Worker === "undefined") {
      setError("Web workers are unavailable in this browser context.");
      return false;
    }
    const worker = new Worker(new URL("../workers/whisperWorker.js", import.meta.url), { type: "module" });
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const message = event.data;
      if (!message || !message.type) return;
      if (message.type === "progress") {
        setEngineState("downloading");
        if (typeof message.total === "number" && message.total > 0) {
          setProgress({
            percent: Math.min(100, Math.round(((message.loaded || 0) / message.total) * 100)),
            loaded: message.loaded,
            total: message.total,
          });
        } else {
          setProgress(null); // indeterminate
        }
      } else if (message.type === "ready") {
        setDevice(message.device);
        setProgress(null);
        setEngineState(sessionRef.current.active ? "listening" : "ready");
      } else if (message.type === "infer-start") {
        setEngineState("processing");
      } else if (message.type === "idle") {
        setEngineState(sessionRef.current.active ? "listening" : "ready");
      } else if (message.type === "transcription") {
        if (!sessionRef.current.active) return; // stale session, ignore
        transcriptionListeners.current.forEach((listener) => listener(message.words));
      } else if (message.type === "device-fallback") {
        setError(`WebGPU unavailable, falling back to WASM: ${message.message}`);
      } else if (message.type === "error") {
        setError(message.message);
        if (!sessionRef.current.active) setEngineState("error");
      }
    };
    worker.onerror = (event) => {
      setError(event.message || "Whisper worker failed unexpectedly.");
      if (!sessionRef.current.active) setEngineState("error");
    };
    return true;
  }, []);

  /** Download and initialize the model. Safe to call repeatedly; a new
   ** model id swaps the model in the worker. */
  const ensureLoaded = useCallback(async (modelId) => {
    if (!ensureWorker()) return false;
    const state = engineStateRef.current;
    if (state === "ready" || state === "listening" || state === "processing" || state === "downloading") {
      return true;
    }
    setError(null);
    setEngineState("downloading");
    workerRef.current.postMessage({ type: "load", modelId });
    return true;
  }, []);

  const stopListeningInternal = useCallback(async () => {
    if (!sessionRef.current.active) return;
    sessionRef.current.active = false;
    sessionRef.current.number += 1;
    if (workerRef.current) workerRef.current.postMessage({ type: "flush" });
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      try {
        await audioRef.current.close();
      } catch {
        /* already closed */
      }
      audioRef.current = null;
    }
    wakeLockRef.current = null;
    listeningRef.current = false;
    setListening(false);
    setEngineState("ready");
  }, []);

  const startListening = useCallback(async () => {
    if (listeningRef.current) return false;
    if (typeof AudioContext === "undefined") {
      setError("Web Audio is unavailable in this browser context.");
      return false;
    }
    setError(null);
    sessionRef.current.active = true;
    try {
      await ensureLoaded();
      let context;
      try {
        context = new AudioContext({ sampleRate: 16000, latencyHint: "interactive" });
      } catch {
        context = new AudioContext(); // worklet still resamples to 16 kHz
      }
      await context.audioWorklet.addModule(audioWorkletUrl());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const node = new AudioWorkletNode(context, "resampler", { numberOfOutputs: 0 });
      node.port.onmessage = (event) => {
        const audio = event.data?.audio;
        if (!audio) return;
        workerRef.current?.postMessage({ type: "infer", audio }, [audio.buffer]);
      };
      context.createMediaStreamSource(stream).connect(node);
      audioRef.current = context;
      streamRef.current = stream;
      listeningRef.current = true;
      setListening(true);
      setEngineState("listening");
      if ("wakeLock" in navigator) {
        navigator.wakeLock
          .request("screen")
          .then((lock) => {
            wakeLockRef.current = lock;
          })
          .catch(() => {
            /* wake lock is best-effort */
          });
      }
      return true;
    } catch (audioError) {
      sessionRef.current.active = false;
      await stopListeningInternal();
      setError(audioError?.message || "Microphone unavailable.");
      setEngineState("error");
      return false;
    }
  }, [ensureLoaded, stopListeningInternal]);

  const stopListening = useCallback(async () => {
    await stopListeningInternal();
  }, [stopListeningInternal]);

  const resetError = useCallback(() => {
    setError(null);
    setEngineState(sessionRef.current.active ? "listening" : engineStateRef.current);
  }, []);

  // Release capture when the tab hides (mobile lifecycle requirement).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && sessionRef.current.active) {
        void stopListeningInternal();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stopListeningInternal]);

  return {
    engineState,
    progress,
    device,
    error,
    listening,
    ensureLoaded,
    startListening,
    stopListening,
    resetError,
    subscribe,
    ENGINE_STATES,
  };
}

export default useLocalWhisper;
