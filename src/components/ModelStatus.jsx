// Model and mic status card for edit mode.

import { CircleStop, Download, Mic, Play, TriangleAlert } from "lucide-react";

export function ModelStatus({ engine, onPrepare, onStart, onStop }) {
  const state = engine.engineState;
  const busy = state === "downloading" || state === "processing";
  const canStart = state === "ready" || state === "processing";
  const percent = engine.progress?.percent;

  return (
    <section aria-label="Speech engine status" className="card bg-base-100 border border-base-300">
      <div className="card-body gap-3">
        <h2 className="card-title text-base">Speech tracking</h2>

        {engine.error ? (
          <div role="alert" className="alert alert-error">
            <TriangleAlert aria-hidden="true" className="size-4" />
            <span className="text-sm">{engine.error}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-2 text-sm">
          <span className="badge badge-soft">{state}</span>
          {engine.device ? <span className="badge badge-outline">{engine.device}</span> : null}
        </div>

        {state === "downloading" ? (
          <progress
            className="progress progress-primary w-full"
            aria-label="Model download progress"
            value={percent ? percent : undefined}
            max="100"
          />
        ) : null}
        {state === "downloading" && percent ? (
          <p className="text-xs opacity-80">
            {percent}% of {Math.round((engine.progress.total || 0) / 1000)} KB
          </p>
        ) : null}
        {state === "downloading" && !percent ? (
          <p className="text-xs opacity-80">Fetching model files…</p>
        ) : null}

        <div className="card-actions">
          {state === "unloaded" || state === "downloading" || state === "error" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onPrepare}
              disabled={state === "downloading"}
            >
              <Download aria-hidden="true" className="size-4" />
              {state === "downloading" ? "Downloading" : "Prepare model"}
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
            <button type="button" className="btn btn-ghost" onClick={onPrepare} disabled>
              <Play aria-hidden="true" className="size-4" />
              Working
            </button>
          ) : null}
        </div>

        <p className="text-xs opacity-70">
          Model and audio stay on this device. First run downloads ~40 MB over the network.
        </p>
      </div>
    </section>
  );
}

export default ModelStatus;
