// promptly: a private, in-browser teleprompter with speech tracking.
// Integration point: edit mode (library + editor + engine card), prompter
// mode (presentation + controls), and settings persistence.

import { FileWarning, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Editor from "./components/Editor.jsx";
import ModelStatus from "./components/ModelStatus.jsx";
import PrompterView from "./components/PrompterView.jsx";
import ScriptLibrary from "./components/ScriptLibrary.jsx";
import { useLocalWhisper } from "./hooks/useLocalWhisper.js";
import { useScripts } from "./hooks/useScripts.js";
import { useSettings } from "./hooks/useSettings.js";
import { useTracker } from "./hooks/useTracker.js";
import { updateScript } from "./services/db.js";
import { buildSpeechModel, parseScript } from "./utils/textParser.js";

export function App() {
  const library = useScripts();
  const { settings, update } = useSettings();
  const engine = useLocalWhisper();
  const [mode, setMode] = useState("edit");
  const [notice, setNotice] = useState(null);

  const tokens = useMemo(() => parseScript(library.draft?.rawContent || ""), [library.draft?.rawContent]);
  const speechModel = useMemo(() => buildSpeechModel(tokens), [tokens]);
  const tracker = useTracker(speechModel);

  // Feed transcript batches into the tracker while listening.
  useEffect(() => {
    if (!engine.listening || settings.scrollMode !== "whisper") return;
    return engine.subscribe((words) => {
      tracker.apply(words, { window: settings.matchWindow, recovery: settings.recoverySearch });
    });
  }, [engine, settings.scrollMode, settings.matchWindow, settings.recoverySearch, tracker]);

  // Reset tracker when the text changes or the script switches.
  useEffect(() => {
    tracker.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library.draft?.id, library.draft?.rawContent]);

  // Persist the reading position (token id of the confirmed word) on exit.
  function savePositionBeforeExit() {
    const confirmedToken = speechModel.wordToToken[
      Math.min(tracker.confirmed, speechModel.words.length - 1)
    ];
    if (library.draft?.id && confirmedToken != null && confirmedToken >= 0) {
      void updateScript(library.draft.id, { lastPositionIndex: confirmedToken });
    }
  }

  async function toggleListen() {
    if (engine.listening) {
      await engine.stopListening();
      return;
    }
    const started = await engine.startListening();
    if (started) setMode("prompter");
  }

  function openPrompter() {
    setMode("prompter");
  }

  function exitPrompter() {
    if (engine.listening) void engine.stopListening();
    savePositionBeforeExit();
    setMode("edit");
  }

  function handleImport(title, content) {
    library.importContent(title, content);
    setNotice(null);
  }

  function handleSwitch(id) {
    if (mode === "prompter") exitPrompter();
    library.switchScript(id);
  }

  function handleCreate() {
    if (mode === "prompter") exitPrompter();
    library.createScript("Untitled", "");
  }

  function handleDelete(id) {
    if (mode === "prompter") exitPrompter();
    library.deleteScript(id);
  }

  if (!library.loaded) {
    return (
      <main className="grid min-h-dvh place-items-center bg-base-200 p-6 text-center">
        <span className="loading loading-dots loading-lg" aria-label="Loading promptly" />
      </main>
    );
  }

  if (mode === "prompter") {
    return (
      <main className="h-dvh bg-black">
        {tokens.length === 0 ? (
          <div role="alert" className="alert alert-error m-4">
            <FileWarning aria-hidden="true" className="size-5" />
            <span>No script text. Add some words first.</span>
            <button type="button" className="btn btn-sm" onClick={exitPrompter}>
              Back to editor
            </button>
          </div>
        ) : (
          <PrompterView
            title={library.draft?.title || "Untitled"}
            tokens={tokens}
            speechModel={speechModel}
            confirmedWordIdx={tracker.confirmed}
            settings={settings}
            onSettings={update}
            engine={engine}
            onToggleListen={toggleListen}
            onExit={exitPrompter}
            onSeekToken={tracker.seekToken}
            tracker={tracker}
          />
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-4 lg:p-6">
      <header className="navbar mb-4 rounded-box border border-base-300 bg-base-100 px-4">
        <div className="navbar-start gap-2">
          <span className="text-lg font-semibold">promptly</span>
          <span className="badge badge-ghost badge-sm">local-first</span>
        </div>
        <div className="navbar-end gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setNotice(notice === null ? "" : null)}
            aria-label="Toggle settings notice"
          >
            <Settings2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </header>

      {notice !== null ? (
        <div role="status" className="alert alert-info mb-4">
          <span>
            Settings live in this browser (localStorage). Library lives in IndexedDB; nothing leaves the device.
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-4">
          <ScriptLibrary
            scripts={library.scripts}
            activeScriptId={library.activeScriptId}
            onCreate={handleCreate}
            onSwitch={handleSwitch}
            onRename={library.renameScript}
            onDelete={handleDelete}
            onImport={handleImport}
          />
          <ModelStatus
            engine={engine}
            onPrepare={engine.ensureLoaded}
            onStart={toggleListen}
            onStop={toggleListen}
          />
        </div>

        <Editor
          draft={library.draft}
          onChange={(rawContent) => library.updateDraft({ rawContent })}
          onRename={(title) => {
            library.updateDraft({ title }); // renames never reset progress
          }}
          saveState={library.saveState}
          onOpenPrompter={openPrompter}
        />
      </div>
    </main>
  );
}

export default App;
