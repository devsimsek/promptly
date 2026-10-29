// Script editor: title, raw text, metrics, autosave status, encoding-safe
// paste target. Exposes onOpenPrompter when the text has words.

import { FileText, Maximize2 } from "lucide-react";
import { countMetrics } from "../utils/textParser.js";

export function SaveBadge({ saveState }) {
  if (saveState === "saving") return <span className="badge badge-ghost badge-sm">Saving…</span>;
  if (saveState === "saved") return <span className="badge badge-success badge-soft badge-sm">Saved</span>;
  if (saveState === "error") return <span className="badge badge-error badge-soft badge-sm">Not saved to this device</span>;
  return null;
}

export function Editor({ draft, onChange, onRename, onOpenPrompter, saveState, onImportFile }) {
  const metrics = countMetrics(draft?.rawContent || "");
  const hasContent = metrics.words > 0;
  return (
    <section aria-label="Script editor" className="card bg-base-100 border border-base-300">
      <div className="card-body gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input input-bordered w-auto grow sm:w-64"
            value={draft?.title || ""}
            placeholder="Script title"
            aria-label="Script title"
            onChange={(event) => onRename(event.target.value)}
          />
          <SaveBadge saveState={saveState} />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenPrompter}
            disabled={!hasContent}
            title={hasContent ? "Open the prompter" : "Write some text first"}
          >
            <Maximize2 aria-hidden="true" className="size-4" />
            Prompter
          </button>
        </div>

        <textarea
          className="textarea textarea-ghost min-h-64 w-full font-mono text-sm"
          value={draft?.rawContent || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={"Paste or type your script.\n\nMarkdown supported: # heads, **bold**, [links](url) text is kept, --- makes a pause break."}
          aria-label="Script text"
        />

        <div className="flex items-center gap-2 text-xs opacity-80">
          <FileText aria-hidden="true" className="size-3" />
          <span className="tabular-nums">
            {metrics.words} words, {metrics.characters} chars
          </span>
          {hasContent ? null : <span className="opacity-60">The prompter stays off until there is text.</span>}
          {onImportFile ? (
            <button type="button" className="link link-hover" onClick={onImportFile}>
              Replace from file
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default Editor;
