// File importer, Markdown stripper, and spoken-token normalizer.
// Transforms script text into word-level token objects per the spec:
//   { id, raw, clean, isHeader, headerLevel, isPauseCue, paragraphIndex }

import { normalizeWord } from "./normalization.js";

export const MAX_FILE_BYTES = 10 * 1000 * 1000; // 10 MB
const PARAGRAPH_SOFT_LIMIT = 500;

const HEADING_RE = /^ {0,3}(#{1,6})\s+(.*)$/;
const RULE_RE = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE_RE = /^ {0,3}(```|~~~)/;
const LIST_RE = /^ {0,3}(?:[-*+]|\d{1,3}[.)])\s+/;

/** Byte-preserving ISO-8859-1 decoding. WHATWG maps the label to
 ** Windows-1252, which silently shifts 0x80-0x9F; map octets directly. */
function latin1Decode(buffer) {
  const bytes = new Uint8Array(buffer);
  let text = "";
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return text;
}

/** UTF-8 strict first, Latin-1 fallback on decoding failure. */
export function decodeFileText(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return latin1Decode(buffer);
  }
}

export function detectFileType(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  return "txt";
}

/** Picked-file guard; returns an error string or null. */
export function validateFile(file) {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_FILE_BYTES) return "File is larger than 10 MB.";
  if (!/\.(txt|md|markdown)$/i.test(file.name)) {
    return "Only .txt, .md, or .markdown files are supported.";
  }
  return null;
}

/** Read a File into text with the size and extension rules applied. */
export async function importFileToContent(file) {
  const problem = validateFile(file);
  if (problem) return { error: problem };
  return { content: decodeFileText(await file.arrayBuffer()) };
}

// Inline Markdown stripped from display text; link text kept, URLs dropped.
function stripInline(line) {  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/\*{2,}([^*]+)\*{2,}/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_{2,}([^_]+)_{2,}/g, "$1")
    .replace(/(?<![\w])_([^_\n]+)_(?![\w])/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(LIST_RE, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Public single-line Markdown strippers for editor previews. */
export function stripLine(line) {
  return stripInline(line);
}

// Split over-long paragraphs at sentence boundaries so layout cannot
// overflow; each chunk carries its own paragraphIndex.
export function chunkIntoParagraphs(text, firstParagraphIndex) {
  const chunks = [];
  let start = 0;
  let index = firstParagraphIndex;
  if (text.length <= PARAGRAPH_SOFT_LIMIT) {
    chunks.push({ text, paragraphIndex: index++ });
    return { chunks, nextIndex: index };
  }
  while (start < text.length) {
    if (text.length - start <= PARAGRAPH_SOFT_LIMIT) {
      chunks.push({ text: text.slice(start), paragraphIndex: index++ });
      break;
    }
    const window = text.slice(start, start + PARAGRAPH_SOFT_LIMIT + 1);
    let cut = -1;
    for (const marker of [". ", "? ", "! "]) {
      const at = window.lastIndexOf(marker);
      if (at > 240 && at > cut) cut = at + marker.length;
    }
    if (cut === -1) {
      const space = window.lastIndexOf(" ");
      cut = space > 0 ? space : PARAGRAPH_SOFT_LIMIT;
    }
    chunks.push({ text: text.slice(start, start + cut), paragraphIndex: index++ });
    start += cut;
  }
  return { chunks, nextIndex: index };
}

/** Tokenize script text into word-level token objects. */
export function parseScript(raw) {
  const tokens = [];
  const lines = String(raw ?? "").split(/\r\n|\r|\n/);
  let id = 0;
  let paragraphCounter = 0;
  let inFence = false;
  let fenceLines = [];
  let pending = null; // { headerLevel, headerLine? used, buffer }

  function flushPending() {
    if (!pending || !pending.buffer.trim()) {
      pending = null;
      return;
    }
    const text = pending.buffer.trim();
    const { chunks, nextIndex } = chunkIntoParagraphs(text, paragraphCounter);
    for (const chunk of chunks) {
      for (const word of chunk.text.split(/\s+/)) {
        if (!word) continue;
        tokens.push({
          id: id++,
          raw: word,
          clean: normalizeWord(word),
          isHeader: pending.isHeader,
          headerLevel: pending.isHeader ? pending.headerLevel : undefined,
          isPauseCue: false,
          paragraphIndex: chunk.paragraphIndex,
        });
      }
    }
    paragraphCounter = nextIndex;
    pending = null;
  }

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      if (!inFence) {
        flushPending();
        inFence = true;
        fenceLines = [];
      } else {
        inFence = false;
        const text = fenceLines.join("\n").replace(/`/g, "").trim();
        if (text) {
          const { chunks, nextIndex } = chunkIntoParagraphs(text, paragraphCounter);
          for (const chunk of chunks) {
            for (const word of chunk.text.split(/\s+/)) {
              if (!word) continue;
              tokens.push({
                id: id++,
                raw: word,
                clean: normalizeWord(word),
                isHeader: false,
                isPauseCue: false,
                paragraphIndex: chunk.paragraphIndex,
              });
            }
          }
          paragraphCounter = nextIndex;
        }
        fenceLines = [];
      }
      continue;
    }

    if (inFence) {
      if (line.trim()) fenceLines.push(line.replace(/`/g, "").trim());
      continue;
    }

    if (RULE_RE.test(line)) {
      flushPending();
      tokens.push({
        id: id++,
        raw: line.trim(),
        clean: "",
        isPauseCue: true,
        paragraphIndex: paragraphCounter++,
      });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushPending();
      paragraphCounter += 1; // headers own their paragraph
      pending = { isHeader: true, headerLevel: heading[1].length, buffer: stripInline(heading[2]) };
      flushPending();
      continue;
    }

    const quote = line.replace(/^ {0,3}(?:>\s?)+/, "");
    const text = quote.trim() ? stripInline(quote) : "";
    if (text) {
      if (!pending) pending = { isHeader: false, buffer: "" };
      pending.buffer = pending.buffer ? `${pending.buffer}\n${text}` : text;
      continue;
    }

    flushPending();
    paragraphCounter += 1; // blank line closes a paragraph
  }
  flushPending();

  return tokens;
}

/** Build the spoken-word sequence plus word-to-token map for matching. */
export function buildSpeechModel(tokens) {
  const words = [];
  const wordToToken = [];
  tokens.forEach((token, tokenIdx) => {
    if (token.isPauseCue) return;
    if (!token.clean) return; // symbols produce nothing to match
    for (const word of token.clean.split(" ")) {
      words.push(word);
      wordToToken.push(tokenIdx);
    }
  });
  return { words, wordToToken };
}

/** Words and characters of a script, for editor metrics. */
export function countMetrics(raw) {
  const words = String(raw ?? "").trim() ? String(raw).trim().split(/\s+/).length : 0;
  return { words, characters: String(raw ?? "").length };
}
