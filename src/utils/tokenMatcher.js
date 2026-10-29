// Sliding-window speech alignment. Batch semantics per transcript chunk:
//   1. leading pass: advance while spoken words continue in script order,
//      tolerating stumbles (spoken words not matching count as misses);
//   2. anchor pass: when the leading pass stalls, look for the rest of the
//      batch matching one script position inside the adjustable window;
//   3. any remaining batch words count as misses; recovery handles skips.

export const DEFAULT_WINDOW = 15;
export const MIN_UNIQUE_PHRASE = 3; // words needed to trust a recovery jump
export const MISSES_BEFORE_RECOVERY = 8;

const FILLER_WORDS = new Set(["um", "uh", "er", "ah", "hmm", "erm"]);

import { normalizeWord } from "./normalization.js";

function commonPrefixLength(a, b) {
  let n = 0;
  const max = Math.min(a.length, b.length);
  while (n < max && a[n] === b[n]) n += 1;
  return n;
}

function levenshteinWithin1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        diff += 1;
        if (diff > 1) return false;
      }
    }
    return true;
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
    } else {
      j += 1;
      edits += 1;
      if (edits > 1) return false;
    }
  }
  return true;
}

/** true when a transcript word plausibly names the script word. */
export function compareWords(scriptWord, spokenWord) {
  if (!scriptWord || !spokenWord) return false;
  if (scriptWord === spokenWord) return true;
  if (scriptWord.length >= 3 && spokenWord.length >= 3) {
    const prefix = commonPrefixLength(scriptWord, spokenWord);
    if (prefix >= 3 && prefix >= Math.min(scriptWord.length, spokenWord.length) - 1) {
      return true; // plural, past-tense, or trailing inflection
    }
  }
  if (scriptWord.length >= 4 && levenshteinWithin1(scriptWord, spokenWord)) {
    return true;
  }
  return false;
}

export function filterSpokenWords(transcriptWords) {
  const spoken = [];
  for (const word of transcriptWords || []) {
    const normalized = normalizeWord(word);
    if (!normalized || FILLER_WORDS.has(normalized)) continue;
    spoken.push(normalized);
  }
  return spoken;
}

/**
 * Advance the pointer with one transcript batch.
 * Returns { pointer, confirmed, misses }; pointer/confirmed are word
 * indices into speechModel.words; pointer is the NEXT word to read.
 */
export function matchForward(speechModel, cursor, transcriptWords, options = {}) {
  const window = options.window ?? DEFAULT_WINDOW;
  const words = speechModel.words;
  let pointer = cursor;
  let confirmed = options.confirmed ?? cursor - 1;
  let misses = options.misses ?? 0;
  const spoken = filterSpokenWords(transcriptWords);
  if (spoken.length === 0) return { pointer, confirmed, misses };

  // 1. Leading pass: in-order with stumble tolerance.
  let t = 0;
  while (t < spoken.length && pointer < words.length) {
    if (compareWords(words[pointer], spoken[t])) {
      pointer += 1;
      confirmed = pointer - 1;
      t += 1;
    } else {
      break; // first mismatch ends the in-order run
    }
  }

  // 2. Anchor pass: rest of the batch must match one position inside the
  //    window (full agreement), so short skips catch up immediately while
  //    repeated or partial phrases stay held.
  if (t < spoken.length) {
    const rest = spoken.slice(t);
    const limit = Math.min(pointer + window, words.length);
    for (let s = pointer + 1; s + rest.length <= limit; s += 1) {
      let agree = true;
      for (let j = 0; j < rest.length; j += 1) {
        if (!compareWords(words[s + j], rest[j])) {
          agree = false;
          break;
        }
      }
      if (agree) {
        pointer = s + rest.length;
        confirmed = pointer - 1;
        t = spoken.length;
        misses = 0;
        break;
      }
    }
  }

  // 3. Whatever still does not fit counts as misses; position holds.
  const remaining = spoken.length - t;
  if (remaining > 0) {
    misses += remaining;
  }
  return { pointer, confirmed, misses };
}

/**
 * Whole-script or forward recovery. Requires a unique phrase of at least
 * MIN_UNIQUE_PHRASE words: the phrase must occur exactly once anywhere it
 * is searched, otherwise the position is ambiguous and lost anyway.
 * Returns the last confirmed word index, or -1.
 */
export function findRecovery(speechModel, transcriptWords, options = {}) {
  const mode = options.mode ?? "off";
  if (mode === "off") return -1;
  const from = Math.max(0, options.cursor ?? 0);
  const words = speechModel.words;
  const spoken = filterSpokenWords(transcriptWords);
  if (spoken.length < MIN_UNIQUE_PHRASE) return -1;

  const phrase = spoken.slice(0, MIN_UNIQUE_PHRASE + 3);
  const phraseLength = phrase.length;
  if (words.length < phraseLength) return -1;

  let occurrences = 0;
  let bestEnd = -1;
  for (let start = 0; start + phraseLength <= words.length; start += 1) {
    let agree = true;
    for (let j = 0; j < phraseLength; j += 1) {
      if (!compareWords(words[start + j], phrase[j])) {
        agree = false;
        break;
      }
    }
    if (agree) {
      occurrences += 1;
      const end = start + phraseLength - 1;
      if (end >= from) bestEnd = end;
    }
  }

  if (occurrences !== 1) return -1; // ambiguous: repeated passage
  if (bestEnd === -1) return -1; // only match lies behind a forward search
  return bestEnd;
}

/** Apply a transcript chunk, then try recovery when the matcher is lost. */
export function applyTranscript(speechModel, state, transcriptWords, options = {}) {
  const forward = matchForward(speechModel, state.pointer, transcriptWords, state);
  let next = { ...state, ...forward };

  if (next.misses >= MISSES_BEFORE_RECOVERY && options.recovery && options.recovery !== "off") {
    const found = findRecovery(speechModel, transcriptWords, {
      mode: options.recovery,
      cursor: options.recovery === "forward" ? next.pointer : 0,
    });
    if (found >= 0) {
      next = { pointer: found + 1, confirmed: found, misses: 0 };
    }
  }
  return next;
}
