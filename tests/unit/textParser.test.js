import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES,
  buildSpeechModel,
  chunkIntoParagraphs,
  decodeFileText,
  parseScript,
  stripLine,
  validateFile,
} from "../../src/utils/textParser.js";

function bytesOf(...values) {
  return Uint8Array.from(values);
}

describe("file validation", () => {
  it("rejects empty files", () => {
    const file = new File([], "notes.txt");
    expect(validateFile(file)).toBe("That file is empty.");
  });

  it("rejects files over the 10 MB limit", () => {
    const file = new File(["x".repeat(MAX_FILE_BYTES + 1)], "big.txt");
    expect(validateFile(file)).toBe("File is larger than 10 MB.");
  });

  it("rejects unsupported extensions", () => {
    const file = new File(["byte".repeat(100)], "script.pdf");
    expect(validateFile(file)).toMatch(/only/i);
  });

  it("accepts txt, md, and markdown", () => {
    for (const name of ["a.txt", "b.md", "c.markdown"]) {
      expect(validateFile(new File(["hello"], name))).toBeNull();
    }
  });
});

describe("decoding", () => {
  it("decodes strict UTF-8", () => {
    const text = "hello — world";
    expect(decodeFileText(new TextEncoder().encode(text))).toBe(text);
  });

  it("falls back to byte-preserving Latin-1", () => {
    // 0x80..0x9F are Windows-1252 mapped under the ISO	label;字节 map must hold.
    const buffer = bytesOf(72, 233, 108, 108, 111); // "Héllo" in Latin-1
    expect(decodeFileText(buffer)).toBe("Héllo");
  });
});

describe("markdown stripping", () => {
  it("keeps header words", () => {
    const tokens = parseScript("# Open the lid");
    const words = tokens.filter((t) => !t.isPauseCue).map((t) => t.raw);
    expect(words).toEqual(["Open", "the", "lid"]);
    expect(tokens.filter((t) => t.isHeader)).toHaveLength(3);
  });

  it("drops images entirely", () => {
    const tokens = parseScript("Start\n![logo](https://x/img.png)\nEnd");
    expect(tokens.some((t) => t.raw.includes("img"))).toBe(false);
    expect(tokens.some((t) => t.raw === "Start")).toBe(true);
    expect(tokens.some((t) => t.raw === "End")).toBe(true);
  });

  it("keeps link text, drops the URL", () => {
    const words = parseScript("visit [the guide](https://example.com) now").map((t) => t.raw);
    expect(words).toContain("guide");
    expect(words.join(" ")).not.toContain("https");
  });

  it("strips inline styles but keeps text", () => {
    expect(stripLine("**bold** and *slanted*")).toBe("bold and slanted");
    expect(stripLine("~~gone~~ but _kept_")).toBe("gone but kept");
    expect(stripLine("`code` stays")).toBe("code stays");
  });

  it("turns rules into pause cues", () => {
    const tokens = parseScript("one\n---\ntwo");
    const cues = tokens.filter((t) => t.isPauseCue);
    expect(cues).toHaveLength(1);
  });

  it("strips blockquote markers but keeps text", () => {
    const words = parseScript("> quoted words").map((t) => t.raw);
    expect(words).toEqual(["quoted", "words"]);
  });
});

describe("token model", () => {
  it("maps spoken words back to tokens", () => {
    const tokens = parseScript("The year is      2024");
    const model = buildSpeechModel(tokens);
    // Word "2024" expands to "two zero two four" -> 3 extra word entries.
    const tail = model.words.slice(-4);
    expect(tail).toEqual(["two", "zero", "two", "four"]);
    const tokenOfLast = model.wordToToken[model.wordToToken.length - 1];
    expect(tokens[tokenOfLast].raw).toBe("2024");
  });

  it("normalizes contractions for matching", () => {
    // Spec: can't -> cannot. Whisper "can't" normalizes identically.
    const model = buildSpeechModel(parseScript("can't stop"));
    expect(model.words).toEqual(["cannot", "stop"]);
  });

  it("splits over-bottom paragraphs above 500 chars", () => {
    const long = "A".repeat(470) + ". " + "B".repeat(470) + " tail";
    const { chunks, nextIndex } = chunkIntoParagraphs(long, 7);
    expect(chunks.length).toBeGreaterThan(1);
    expect(nextIndex).toBeGreaterThan(7);
  });

  it("assigns paragraphIndex per block", () => {
    const tokens = parseScript("first words\n\nsecond words");
    const paragraphs = new Set(tokens.map((t) => t.paragraphIndex));
    expect(paragraphs.size).toBe(2);
  });

  it("normalizes clean text: lowercase and punctuation-free", () => {
    const tokens = parseScript("Hello,   WORLD!");
    expect(tokens[0].clean).toBe("hello"); // punctuation stripped per word
    expect(tokens[1].clean).toBe("world");
    expect(tokens[0].raw).toBe("Hello,"); // display spelling preserved
  });
});
