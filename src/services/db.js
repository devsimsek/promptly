// IndexedDB wrapper for the script library (promptly_db, store: scripts).

import { openDB } from "idb";

const DB_NAME = "promptly_db";
const DB_VERSION = 1;
const STORE = "scripts";

function connect() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    },
  });
}

function nowMs() {
  return Date.now();
}

/** Secure context crypto.randomUUID is absent on plain http (LAN testing);
 ** build a v4-style UUID from getRandomValues when it is unavailable. */
export function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function listScripts() {
  const db = await connect();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getScript(id) {
  const db = await connect();
  return db.get(STORE, id);
}

function contentByteLength(text) {
  return new TextEncoder().encode(text).length;
}

/** Create a script row; returns the stored record. */
export async function createScript({ title, rawContent }) {
  const db = await connect();
  const record = {
    id: randomId(),
    title: title || "Untitled",
    rawContent,
    fileType: /\.md|\.markdown$/i.test(title || "") ? "md" : "txt",
    sizeBytes: contentByteLength(rawContent),
    createdAt: nowMs(),
    updatedAt: nowMs(),
    lastPositionIndex: 0,
  };
  await db.put(STORE, record);
  return record;
}

/** Patch a script and stamp updatedAt. Returns the next record. */
export async function updateScript(id, patch) {
  const db = await connect();
  const current = await db.get(STORE, id);
  if (!current) throw new Error(`Script not found: ${id}`);
  const next = { ...current, ...patch, updatedAt: nowMs() };
  if (typeof next.rawContent === "string") {
    next.sizeBytes = contentByteLength(next.rawContent);
  }
  await db.put(STORE, next);
  return next;
}

/** Content edits invalidate the reading position; set it back to zero. */
export async function resetProgress(id) {
  return updateScript(id, { lastPositionIndex: 0 });
}

export async function deleteScript(id) {
  const db = await connect();
  await db.delete(STORE, id);
}
