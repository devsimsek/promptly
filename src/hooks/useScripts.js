// Script library state: load, autosave (debounced 500 ms), rename, delete,
// switch, and import. Never renders; App owns the UI.

import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "../services/db.js";

const ACTIVE_KEY = "promptly.activeScriptId";

export function useScripts() {
  const [scripts, setScripts] = useState([]);
  const [activeScriptId, setActiveScriptId] = useState(null);
  const [draft, setDraftState] = useState(null); // { id, title, rawContent }
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [loadError, setLoadError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef(null);
  const savedRef = useRef(null); // last content persisted for this draft
  const draftRef = useRef(null);

  const setDraft = useCallback((next) => {
    draftRef.current = next;
    setDraftState(next);
  }, []);

  const refresh = useCallback(async () => {
    const all = await db.listScripts();
    setScripts(all);
    return all;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = localStorage.getItem(ACTIVE_KEY);
      const all = await db.listScripts();
      if (cancelled) return;
      let first = all.find((script) => script.id === stored) || all[0] || null;
      if (!first) first = await db.createScript({ title: "Untitled", rawContent: "" });
      setScripts(all);
      setActiveScriptId(first.id);
      setDraft({ id: first.id, title: first.title, rawContent: first.rawContent });
      savedRef.current = { title: first.title, rawContent: first.rawContent || "" };
      setLoaded(true);
    })().catch((error) => {
      if (cancelled) return;
      setLoadError(String(error?.message || error));
      setLoaded(true); // surface the failure instead of three dots forever
    });
    return () => {
      cancelled = true;
    };
  }, [setDraft]);

  const persist = useCallback(async (next) => {
    if (!next?.id) return;
    try {
      setSaveState("saving");
      const contentChanged = next.rawContent !== savedRef.current?.rawContent;
      // Renames keep lastPositionIndex; content edits reset it. Titles
      // always ride along so editor-only renames persist too.
      const patch = contentChanged
        ? { title: next.title, rawContent: next.rawContent, lastPositionIndex: 0 }
        : { title: next.title };
      await db.updateScript(next.id, patch);
      savedRef.current = { title: next.title, rawContent: next.rawContent };
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!draft) return;
    const dirty =
      draft.rawContent !== savedRef.current?.rawContent || draft.title !== savedRef.current?.title;
    if (!dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    timerRef.current = setTimeout(() => persist(draft), 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draft, loaded, persist]);

  const updateDraft = useCallback((patch) => {
    setDraft({ ...(draftRef.current || { id: null }), ...patch });
  }, [setDraft]);

  const flushPending = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = draftRef.current;
    if (current?.id && (current.rawContent !== savedRef.current?.rawContent || current.title !== savedRef.current?.title)) {
      await persist(current);
    }
  }, [persist]);

  const activate = useCallback(
    async (record) => {
      setActiveScriptId(record.id);
      localStorage.setItem(ACTIVE_KEY, record.id);
      savedRef.current = { title: record.title, rawContent: record.rawContent || "" };
      setDraft({ id: record.id, title: record.title, rawContent: record.rawContent });
      setSaveState("saved");
      await refresh();
    },
    [refresh, setDraft]
  );

  const switchScript = useCallback(
    async (id) => {
      if (
        id === activeScriptId &&
        draftRef.current &&
        draftRef.current.rawContent === savedRef.current?.rawContent &&
        draftRef.current.title === savedRef.current?.title
      ) {
        return;
      }
      await flushPending();
      const record = await db.getScript(id);
      if (record) await activate(record);
    },
    [activeScriptId, flushPending, activate]
  );

  const createScript = useCallback(
    async (title = "Untitled", rawContent = "") => {
      await flushPending();
      const record = await db.createScript({ title, rawContent });
      await activate(record);
      return record;
    },
    [flushPending, activate]
  );

  const renameScript = useCallback(
    async (id, title) => {
      // Library-side rename: the request carries the target script id, so
      // renaming script B never depends on which draft is open.
      if (!title?.trim()) return;
      const next = await db.updateScript(id, { title: title.trim() });
      if (id === draftRef.current?.id) {
        const current = draftRef.current;
        setDraft({ ...current, title: next.title });
        savedRef.current = { title: next.title, rawContent: next.rawContent };
        setSaveState("saved");
      }
      await refresh();
    },
    [refresh, setDraft]
  );

  const deleteScript = useCallback(
    async (id) => {
      await db.deleteScript(id);
      const remaining = await refresh();
      if (remaining.length === 0) {
        await createScript("Untitled", "");
      } else if (id === activeScriptId) {
        await activate(remaining[0]);
      }
    },
    [refresh, activate, createScript, activeScriptId]
  );

  /** Import content matching the spec: reuse a script with the same
   ** title when present, otherwise create a new one. */
  const importContent = useCallback(
    async (title, content) => {
      const contentChangedIntoBlank = content.trim() === "" && draftRef.current?.rawContent?.trim() !== "";
      if (contentChangedIntoBlank) {
        // Importing an empty file is already rejected by validateFile.
        return null;
      }
      await flushPending();
      let target = null;
      for (const script of scripts) {
        if (script.title === title) {
          target = await db.getScript(script.id);
          break;
        }
      }
      if (target) {
        const next = await db.updateScript(target.id, { rawContent: content, lastPositionIndex: 0 });
        await activate(next);
        return next;
      }
      const record = await db.createScript({ title, rawContent: content });
      await activate(record);
      return record;
    },
    [scripts, flushPending, activate]
  );

  return {
    scripts,
    activeScriptId,
    draft,
    saveState,
    loaded,
    loadError,
    updateDraft,
    switchScript,
    createScript,
    renameScript,
    deleteScript,
    importContent,
    refresh,
  };
}
