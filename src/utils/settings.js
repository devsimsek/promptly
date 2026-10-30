// localStorage-backed UI settings with defaults and clamping.

const KEY = "promptly.settings";

import { MODELS, storedModelIds as modelIdChoices } from "../workers/modelOptions.js";

// Early builds shipped whisper-only as the hardcoded default; stored
// selections migrate to the hybrid engine once.
const LEGACY_MODEL_ID = "onnx-community/whisper-tiny.en";

export const DEFAULT_SETTINGS = {
  activeScriptId: null,
  modelId: "auto",
  fontSize: 48,
  lineHeight: 1.5,
  mirrorHorizontal: false,
  pureBlack: true,
  scrollMode: "manual",
  manualWpm: 130,
  focalEyeLinePercent: 33,
  matchWindow: 15,
  recoverySearch: "whole",
};

const SCROLL_MODES = new Set(["whisper", "wpm", "manual"]);
const RECOVERY_MODES = new Set(["off", "forward", "whole"]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Parse a numeric setting; fall back when missing, NaN, or non-finite. */
function numeric(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Read settings, filling missing keys from defaults and clamping ranges. */
export function loadSettings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    stored = {};
  }
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  merged.fontSize = clamp(numeric(merged.fontSize, DEFAULT_SETTINGS.fontSize), 24, 72);
  merged.lineHeight = clamp(numeric(merged.lineHeight, DEFAULT_SETTINGS.lineHeight), 1.2, 2.0);
  merged.mirrorHorizontal = Boolean(merged.mirrorHorizontal);
  merged.pureBlack = Boolean(merged.pureBlack);
  if (!SCROLL_MODES.has(merged.scrollMode)) merged.scrollMode = DEFAULT_SETTINGS.scrollMode;
  // Legacy whisper-only defaults migrate to auto once.
  if (merged.modelId === LEGACY_MODEL_ID) merged.modelId = "auto";
  if (!modelIdChoices.has(merged.modelId)) merged.modelId = DEFAULT_SETTINGS.modelId;
  merged.manualWpm = clamp(numeric(merged.manualWpm, DEFAULT_SETTINGS.manualWpm), 80, 250);
  merged.focalEyeLinePercent = clamp(
    numeric(merged.focalEyeLinePercent, DEFAULT_SETTINGS.focalEyeLinePercent),
    20,
    60
  );
  merged.matchWindow = clamp(numeric(merged.matchWindow, DEFAULT_SETTINGS.matchWindow), 5, 120);
  if (!RECOVERY_MODES.has(merged.recoverySearch)) merged.recoverySearch = DEFAULT_SETTINGS.recoverySearch;
  return merged;
}

/** Persist a settings patch (single write). */
export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
