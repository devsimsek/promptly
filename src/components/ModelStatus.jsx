// Model and mic status card for edit mode.

import { CircleStop, Download, Mic, Play, TriangleAlert } from "lucide-react";
import { MODELS } from "../config/models.js";

export function ModelStatus({ engine, modelId, onModelChange, onPrepare, onStart, onStop }) {
  const state = engine.engineState;
  const canStart = state === "ready" || state === "processing";
  const percent = engine.progress?.percent;

  return (
    <section aria-label="Speech engine status" className="card border-base-300 border bg-base-100">
      <div className="card-body gap-3">
        <h2 className="card-title text-base">Speech tracking</h2>

        {engine.error ? (
          <div role="alert" className="alert alert-error">
            <TriangleAlert aria-hidden="true" className="size-4" />
            <span className="text-sm">{engine.error}</span>
          </div>
        ) : null}

        {engine.deviceFallbackMessage ? (
          <div role="status" className="alert alert-warning">
            <span className="text-sm">{engine.deviceFallbackMessage}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-sm">
          <span className="badge badge-soft">{state}</span>
          {engine.device ? <span className="badge badge-outline">{engine.device}</span> : null}
        </div>

        <label className="form-control w-full">
          <span className="label-text pb-1 text-xs">Model</span>
          <select
            className="select select-bordered select-sm w-full"
            value={modelId}
            aria-label="Whisper model"
            onChange={(event) => onModelChange(event.target.value)}
          >
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>

        {state === "downloading" ? (
          <progress
            className="progress progress-primary w-full"
            aria-label="Model download progress"
            value={percent ? percent : undefined}
            max="100"
          />
        ) : null}
        {state === "downloading" && !percent ? (
          <p className="text-xs opacity-80">Fetching model files…</p>
        ) : null}

        <div className="card-actions">
          {state === "unloaded" || state === "error" ? (
            <button type="button" className="btn btn-primary" onClick={onPrepare}>
              <Download aria-hidden="true" className="size-4" />
              Prepare model
            </button>
          ) : null}
          {state === "downloading" ? (
            <button type="button" className="btn btn-primary btn-disabled" disabled>
              <Download aria-hidden="true" className="size-4" />
              Downloading…
            </button>
          ) : null}
          {canStart && !engine.listening ? (
            <button type="button" className="btn btn-success" onClick={onStart}>
              <Mic aria-hidden="true" className="size-4" />
              Start mic
            </button>
          ) : null}
          {engine.listening ? (
            <button type="button" className="btn btn-error" onClick={onStop}>
              <CircleStop aria-hidden="true" className="size-4" />
              Stop mic
            </button>
          ) : null}
          {state === "processing" ? (
            <button type="button" className="btn btn-ghost btn-disabled" disabled>
              <Play aria-hidden="true" className="size-4" />
              Working…
            </button>
          ) : null}
        </div>

        <p className="text-xs opacity-70">
          Model and audio stay on this device. First run downloads over the network, then the browser cache keeps it.
        </p>
      </div>
    </section>
  );
}

export default ModelStatus;
