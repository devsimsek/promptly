// Shared normalization used by the parser, prompts, and speech worker.
// Mirrors the input spec: lowercase, expand common contractions, expand
// single digits to words, then strip punctuation.

const CONTRACTIONS = new Map([
  ["can't", "cannot"],
  ["won't", "will not"],
  ["n't", " not"],
  ["'re", " are"],
  ["'ve", " have"],
  ["'ll", " will"],
  ["'m", " am"],
  ["it's", "it is"],
  ["that's", "that is"],
  ["they're", "they are"],
  ["we're", "we are"],
  ["you're", "you are"],
]);

const DIGIT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/** Lowercase, expand contractions and single digits, strip punctuation. */
export function normalizeWord(input) {
  let text = String(input ?? "").toLowerCase();
  for (const [from, to] of CONTRACTIONS) {
    text = text.split(from).join(to);
  }
  text = text.replace(/[0-9]/g, (digit) => ` ${DIGIT_WORDS[digit]} `);
  text = text.replace(/[^\w\s]|_/g, " ");
  return text.replace(/\s+/g, " ").trim();
}

/** All spoken words inside a phrase, skipping empty results. */
export function transcriptToSpokenWords(text) {
  return String(text ?? "")
    .replace(/[.?!,:;]+/g, " ")
    .split(/\s+/)
    .map((word) => normalizeWord(word))
    .filter(Boolean);
}
