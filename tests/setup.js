// Test bootstrap: jsdom + fake-indexeddb, and @testing-library matchers.

import "fake-indexeddb/auto";

// Node 26 ships an experimental global localStorage that refuses the jsdom
// assignment; shim a Map-backed Storage when the real one is absent.
if (typeof localStorage !== "object" || localStorage === null) {
  class StorageShim {
    constructor() {
      this.map = new Map();
    }
    get length() {
      return this.map.size;
    }
    key(index) {
      return [...this.map.keys()][index] ?? null;
    }
    getItem(key) {
      return this.map.has(key) ? this.map.get(key) : null;
    }
    setItem(key, value) {
      this.map.set(key, String(value));
    }
    removeItem(key) {
      this.map.delete(key);
    }
    clear() {
      this.map.clear();
    }
  }
  Object.defineProperty(globalThis, "localStorage", {
    value: new StorageShim(),
    configurable: true,
    writable: true,
  });
}

// jsdom lacks matchMedia; components use it for reduced motion.
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  });
}

// jsdom lacks scrollTo on elements; prompter calls it per highlight move.
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
