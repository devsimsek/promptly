import { afterEach, describe, expect, it } from "vitest";
import { randomId } from "../../src/services/db.js";

const originalCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    configurable: true,
  });
});

function cryptoWithoutRandomUUID() {
  // A plain object carrying exactly what insecure origins have: bound
  // getRandomValues, no randomUUID. (A prototype shim fails the internal
  // Crypto-brand check.) 
  return {
    getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
  };
}

describe("randomId", () => {
  it("delegates to crypto.randomUUID on secure origins", () => {
    expect(randomId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("builds a v4 id from getRandomValues when randomUUID is absent", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: cryptoWithoutRandomUUID(),
      configurable: true,
    });
    expect(typeof randomId()).toBe("string");
    expect(randomId()).toMatch(/^[0-9a-f-]+$/);
  });

  it("falls back to a timestamped id without any crypto", () => {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    expect(randomId()).toMatch(/^id-/);
  });
});
