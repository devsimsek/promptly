// Hook-level regression tests: autosave triggers on title-only edits and
// storage bootstrap failures surface instead of three dots forever.

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useScripts } from "../../src/hooks/useScripts.js";
import * as db from "../../src/services/db.js";

let counter = 0;

beforeEach(async () => {
  counter += 1;
  const { IDBFactory } = await import("fake-indexeddb");
  globalThis.indexedDB = new IDBFactory();
  localStorage.clear();
});

describe("useScripts", () => {
  it("persists a title-only edit", async () => {
    const { result } = renderHook(() => useScripts());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const scriptId = result.current.activeScriptId;

    // Title-only edit: content untouched. The debounce must still fire.
    result.current.updateDraft({ title: "Renamed via editor" });
    await waitFor(
      () => expect(result.current.saveState).toBe("saved"),
      { timeout: 3000 }
    );
    const stored = await db.getScript(scriptId);
    expect(stored.title).toBe("Renamed via editor");
    // lastPositionIndex must survive a rename.
    expect(stored.lastPositionIndex).toBe(0);
  });

  it("renames from the library without touching the draft content", async () => {
    const { result } = renderHook(() => useScripts());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await result.current.createScript("Backup", "some words");
    let target;
    await waitFor(() => {
      target = result.current.scripts.find((script) => script.title === "Backup");
      expect(target).toBeTruthy();
    });
    await result.current.renameScript(target.id, "Renamed from library");
    const stored = await db.getScript(target.id);
    expect(stored.title).toBe("Renamed from library");
    expect(stored.rawContent).toBe("some words");
  });

  it("switches scripts preserving each script's own position", async () => {
    const { result } = renderHook(() => useScripts());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    const a = result.current.activeScriptId;
    await result.current.createScript("Second", "words here");
    let b;
    await waitFor(() => {
      b = result.current.activeScriptId;
      expect(b).not.toBe(a);
    });
    await db.updateScript(b, { lastPositionIndex: 7 });
    await result.current.switchScript(a);
    const storedA = await db.getScript(a);
    expect(storedA.lastPositionIndex).toBe(0);
    const storedB = await db.getScript(b);
    expect(storedB.lastPositionIndex).toBe(7);
  });

  it("surfaces storage failures instead of hanging", async () => {
    // open() throws synchronously; idb surfaces that as a rejection.
    globalThis.indexedDB = {
      open: () => {
        throw new TypeError("storage blocked");
      },
    };
    const { result } = renderHook(() => useScripts());
    await waitFor(() => expect(result.current.loadError).toBeTruthy(), { timeout: 3000 });
    expect(result.current.loadError).toMatch(/storage blocked/i);
  });
});
