import { describe, expect, it } from "vitest";
import { buildSpeechModel } from "../../src/utils/textParser.js";
import {
  applyTranscript,
  compareWords,
  findRecovery,
  matchForward,
} from "../../src/utils/tokenMatcher.js";
import { parseScript } from "../../src/utils/textParser.js";

function model(text) {
  return buildSpeechModel(parseScript(text));
}

function applyAll(m, words, options = {}) {
  let state = { pointer: 0, confirmed: -1, misses: 0 };
  const chunks = words;
  for (const chunk of chunks) {
    state = applyTranscript(m, state, chunk, options);
  }
  return state;
}

describe("compareWords", () => {
  it("accepts inflections", () => {
    expect(compareWords("read", "reads")).toBe(true);
    expect(compareWords("walk", "walked")).toBe(true);
  });

  it("accepts single typos in long words", () => {
    expect(compareWords("audio", "audil")).toBe(true);
  });

  it("refuses unrelated words", () => {
    expect(compareWords("sunset", "marmalade")).toBe(false);
  });
});

describe("matchForward", () => {
  it("advances the pointer within the window", () => {
    const m = model("alpha beta gamma delta epsilon zeta");
    const result = matchForward(m, 0, ["alpha", "beta", "gamma"]);
    expect(result.pointer).toBe(3);
    expect(result.confirmed).toBe(2);
  });

  it("skips filler words without losing position", () => {
    const m = model("alpha beta gamma");
    const result = matchForward(m, 0, ["um", "alpha", "ah", "beta", "er", "gamma"]);
    expect(result.pointer).toBe(3);
  });

  it("respects a narrow window", () => {
    const m = model("a b c d e f g h j k l");
    // Speaking "l" while the pointer sits at "a" must NOT jump 10 words on
    // window 4; the matcher waits inside the window only.
    const result = matchForward(m, 0, ["l"], { window: 4 });
    expect(result.pointer).toBe(0);
    expect(result.misses).toBe(1);
  });

  it("does not drift on stray function words that repeat", () => {
    const m = model("the quick the slow fox");
    const result = matchForward(m, 0, ["the", "the", "quick"]);
    // First "the" matches the expected word (pointer moves to 1); the
    // repeated "the" cannot anchor anywhere fully, so "quick" stays unconfirmed.
    expect(result.pointer).toBe(1);
    expect(result.confirmed).toBe(0);
    expect(result.misses).toBeGreaterThan(0);
  });

  it("holds position on an empty transcript", () => {
    const m = model("alpha beta");
    const result = matchForward(m, 0, []);
    expect(result.pointer).toBe(0);
  });
});

describe("recovery", () => {
  const script = "alpha beta gamma delta epsilon zeta eta theta iodine kappa unique phrase marker tail end";

  it("recovers a unique earlier phrase (backwards) in whole mode", () => {
    const m = model(script);
    const state = { pointer: 10, confirmed: 9, misses: 999 };
    const next = applyTranscript(m, state, ["alpha", "beta", "gamma"], { recovery: "whole" });
    expect(next.confirmed).toBe(2);
  });

  it("recovers forward-only from the cursor", () => {
    const m = model(script);
    const state = { pointer: 6, confirmed: 5, misses: 999 };
    const next = applyTranscript(m, state, ["unique", "phrase", "marker"], { recovery: "forward" });
    expect(next.confirmed).toBeGreaterThanOrEqual(6);
  });

  it("refuses ambiguous repeated phrases in recovery, holding position", () => {
    const repeated = "echo marker echo marker echo different tail here";
    const m = model(repeated);
    const state = { pointer: 5, confirmed: 4, misses: 999 };
    const next = applyTranscript(m, state, ["echo", "marker", "echo"], { recovery: "whole" });
    expect(next.confirmed).toBe(4); // no jump, phrase is not unique
  });

  it("does nothing in off mode", () => {
    const m = model(script);
    const state = { pointer: 10, confirmed: 9, misses: 999 };
    const next = applyTranscript(m, state, ["alpha", "beta", "gamma"], { recovery: "off" });
    expect(next.confirmed).toBe(9);
  });
});

describe("applyTranscript stitching", () => {
  it("keeps progress across multiple chunks", () => {
    const m = model("one two three four five");
    const state = applyAll(m, [
      ["one", "two"],
      ["three", "four"],
    ]);
    expect(state.confirmed).toBe(3);
  });

  it("normalizes numerals from the transcript", () => {
    const m = model("The year is 2024 already");
    const state = applyAll(m, [["the", "year", "is", "two", "zero", "two", "four"]]);
    expect(state.confirmed).toBe(6);
  });
});
