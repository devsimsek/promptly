import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import * as db from "../../src/services/db.js";

let counter = 0;

beforeEach(() => {
  // Fresh object-store per test; avoids deleteDatabase-vs-open races.
  globalThis.indexedDB = new IDBFactory();
});

async function createSample(title = "Sample") {
  counter += 1;
  return db.createScript({ title: `${title} ${counter}`, rawContent: `line ${counter}
words` });
}

describe("script CRUD", () => {
  it("creates with metadata", async () => {
    const before = Date.now();
    const script = await createSample("Intro");
    expect(script.title).toMatch(/Intro/);
    expect(script.fileType).toBe("txt");
    expect(script.sizeBytes).toBeGreaterThan(0);
    expect(script.createdAt).toBeGreaterThanOrEqual(before);
    expect(script.updatedAt).toBe(script.createdAt);
    expect(script.lastPositionIndex).toBe(0);
  });

  it("lists newest first", async () => {
    const a = await createSample("Older");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const b = await createSample("Newer");
    const list = await db.listScripts();
    expect(list[0].id).toBe(b.id);
    expect(list[1].id).toBe(a.id);
  });

  it("renames and timestamps", async () => {
    const script = await createSample("First");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const next = await db.updateScript(script.id, { title: "Second" });
    expect(next.title).toBe("Second");
    expect(next.updatedAt).toBeGreaterThanOrEqual(script.creationSafe || script.createdAt);
  });

  it("edits content and keeps lastPositionIndex when untouched", async () => {
    const script = await createSample("Edit");
    const next = await db.updateScript(script.id, { rawContent: "brand new words" });
    expect(next.sizeBytes).not.toBe(script.sizeBytes);
    expect(next.lastPositionIndex).toBe(0); // nothing changed position
  });

  it("resets progress explicitly", async () => {
    const script = await createSample("Progress");
    await db.updateScript(script.id, { lastPositionIndex: 42 });
    const reset = await db.resetProgress(script.id);
    expect(reset.lastPositionIndex).toBe(0);
  });

  it("deletes", async () => {
    const script = await createSample("Gone");
    await db.deleteScript(script.id);
    expect(await db.getScript(script.id)).toBeUndefined();
  });
});
