// Script library sidebar: search, open, rename, delete, import, new.

import { BookOpen, FilePlus2, FolderOpen, Pencil, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { importFileToContent, validateFile } from "../utils/textParser.js";

function titleFromFile(fileName) {
  return fileName.replace(/\.(txt|md|markdown)$/i, "");
}

function bytesToLabel(sizeBytes) {
  if (sizeBytes >= 1000000) return `${(sizeBytes / 1000000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(sizeBytes / 1000))} KB`;
}

export function ScriptLibrary({ scripts, activeScriptId, onCreate, onSwitch, onRename, onDelete, onImport }) {
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [notice, setNotice] = useState(null);
  const fileInputRef = useRef(null);

  const filtered = scripts.filter((script) =>
    script.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  async function sendFile(file) {
    const problem = validateFile(file);
    if (problem) {
      setNotice(problem);
      return;
    }
    const result = await importFileToContent(file);
    if (result.error) {
      setNotice(result.error);
      return;
    }
    await onImport(titleFromFile(file.name), result.content);
    setNotice(null);
  }

  return (
    <section aria-label="Script library" className="card bg-base-100 border border-base-300 lg:col-span-1">
      <div className="card-body gap-3 p-4">
        <h2 className="card-title text-base">
          <BookOpen aria-hidden="true" className="size-4" />
          Library
          <span className="badge badge-ghost badge-sm">{scripts.length}</span>
        </h2>

        <input
          type="search"
          className="input input-sm"
          placeholder="Search scripts"
          value={query}
          aria-label="Search scripts"
          onChange={(event) => setQuery(event.target.value)}
        />

        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {filtered.map((script) => (
            <li key={script.id} className="border-base-200 border rounded-box">
              {renamingId === script.id ? (
                <div className="flex w-full items-center gap-2 p-2">
                  <input
                    className="input input-sm"
                    autoFocus
                    value={renameValue}
                    aria-label="Script title"
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onRename(script.id, renameValue.trim() || script.title);
                        setRenamingId(null);
                      }
                      if (event.key === "Escape") setRenamingId(null);
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onRename(script.id, renameValue.trim() || script.title);
                      setRenamingId(null);
                    }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex w-full items-center gap-1 p-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm flex-1 justify-start text-left"
                    onClick={() => onSwitch(script.id)}
                  >
                    <FolderOpen aria-hidden="true" className="size-4 shrink-0" />
                    <span className={script.id === activeScriptId ? "font-semibold" : ""}>
                      {script.title}
                    </span>
                  </button>
                  <span className="text-xs opacity-70 tabular-nums">{bytesToLabel(script.sizeBytes || 0)}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    aria-label={`Rename ${script.title}`}
                    onClick={() => {
                      setRenamingId(script.id);
                      setRenameValue(script.title);
                    }}
                  >
                    <Pencil aria-hidden="true" className="size-3" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    aria-label={`Delete ${script.title}`}
                    onClick={() => onDelete(script.id)}
                  >
                    <Trash2 aria-hidden="true" className="size-3" />
                  </button>
                </div>
              )}
            </li>
          ))}
          {filtered.length === 0 ? <li className="opacity-70">No scripts match.</li> : null}
        </ul>

        {notice ? (
          <div role="alert" className="alert alert-error py-2 text-sm">
            <span>{notice}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onCreate()}>
            <FilePlus2 aria-hidden="true" className="size-4" />
            New script
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}>
            <Upload aria-hidden="true" className="size-4" />
            Import file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.markdown"
            className="hidden"
            aria-label="Import script file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) sendFile(file);
            }}
          />
        </div>
      </div>
    </section>
  );
}

export default ScriptLibrary;
