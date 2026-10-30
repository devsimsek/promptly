import { afterEach, describe, expect, it } from "vitest";
import { clearModelCaches, modelCacheNames } from "../../src/utils/modelCache.js";

const originalCaches = globalThis.caches;

afterEach(() => {
  Object.defineProperty(globalThis, "caches", {
    value: originalCaches,
    configurable: true,
  });
});

class CacheStorageStub {
  constructor(names) {
    this.stores = new Map(names.map((name) => [name, []]));
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name) {
    return this.stores.delete(name);
  }
}

describe("modelCache", () => {
  it("clears only transformer/onnx-related stores", async () => {
    const storage = new CacheStorageStub([
      "transformers-cache",
      "onnxruntime-web",
      "app-shell",
      "workbox-precache-v2",
    ]);
    Object.defineProperty(globalThis, "caches", { value: storage, configurable: true });
    const cleared = await clearModelCaches();
    expect(cleared).toBe(2);
    expect(await modelCacheNames()).toEqual([]);
    expect([...storage.stores.keys()].sort()).toEqual(["app-shell", "workbox-precache-v2"]);
  });

  it("returns null when the Cache API is absent (insecure origin)", async () => {
    Object.defineProperty(globalThis, "caches", { value: undefined, configurable: true });
    expect(await clearModelCaches()).toBeNull();
  });
});
