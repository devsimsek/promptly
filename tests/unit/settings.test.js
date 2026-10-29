import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../../src/utils/settings.js";

beforeEach(() => {
  localStorage.clear();
});

describe("settings persistence", () => {
  it("returns defaults on a fresh browser", () => {
    expect(loadSettings()).toMatchObject(DEFAULT_SETTINGS);
  });

  it("round-trips a patch", () => {
    saveSettings({ fontSize: 72, scrollMode: "whisper" });
    expect(loadSettings()).toMatchObject({ fontSize: 72, scrollMode: "whisper" });
  });

  it("clamps ranges", () => {
    saveSettings({ fontSize: 500, lineHeight: 9, manualWpm: 1, matchWindow: 0, focalEyeLinePercent: 3 });
    const settings = loadSettings();
    expect(settings.fontSize).toBe(72);
    expect(settings.lineHeight).toBe(2.0);
    expect(settings.manualWpm).toBe(80);
    expect(settings.matchWindow).toBe(5);
    expect(settings.focalEyeLinePercent).toBe(20);
  });

  it("falls back on invalid enums", () => {
    saveSettings({ scrollMode: "hyperspeed", recoverySearch: "sideways" });
    expect(loadSettings()).toMatchObject({ scrollMode: "manual", recoverySearch: "whole" });
  });

  it("survives malformed stored JSON", () => {
    localStorage.setItem("promptly.settings", "{not json");
    expect(loadSettings()).toMatchObject(DEFAULT_SETTINGS);
  });
});
