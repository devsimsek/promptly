// Prompter presentation view: token stream, focal highlighting, mirror,
// OLED black, and the control bar. Mirroring wraps only the script column;
// controls live outside it so they read normally on beamsplitter glass.

import {
  CornerDownLeft,
  Gauge,
  Maximize,
  Minimize,
  MoveHorizontal,
  Pause,
  Play,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export function PrompterView({
  title,
  tokens,
  speechModel,
  confirmedWordIdx,
  settings,
  onSettings,
  engine,
  onToggleListen,
  onExit,
  onSeekToken,
  tracker,
}) {
  const scrollRef = useRef(null);
  const currentRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const rootRef = useRef(null);

  const currentTokenIdx = useMemo(() => {
    const words = speechModel?.words || [];
    if (confirmedWordIdx == null || confirmedWordIdx < 0) return null;
    return speechModel.wordToToken[Math.min(confirmedWordIdx, words.length - 1)] ?? null;
  }, [speechModel, confirmedWordIdx]);

  // Focal eye-line: keep the current token pinned under the focal percent.
  useEffect(() => {
    const container = scrollRef.current;
    const token = currentRef.current;
    if (!container || !token) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target =
      token.offsetTop - (container.clientHeight * settings.focalEyeLinePercent) / 100;
    container.scrollTo({ top: Math.max(0, target), behavior: reduceMotion ? "auto" : "smooth" });
  }, [currentTokenIdx, settings.focalEyeLinePercent, settings.fontSize, settings.lineHeight]);

  // WPM auto-scroll: advance the confirmed word at words per minute.
  useEffect(() => {
    if (settings.scrollMode !== "wpm" || paused) return;
    const interval = Math.max(150, 60000 / settings.manualWpm);
    const handle = setInterval(() => {
      const atEnd = confirmedWordIdx >= (speechModel?.words.length || 0) - 1;
      if (!atEnd) onSeekToken?.(Math.min((confirmedWordIdx ?? -1) + 2, speechModel.wordToToken.length));
    }, interval);
    return () => clearInterval(handle);
  }, [settings.scrollMode, settings.manualWpm, paused, confirmedWordIdx, speechModel, onSeekToken]);

  // Keyboard: Space toggles pause, +/- scale, mirror m, f fullscreen.
  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof Element && event.target.closest("input, textarea, select")) return;
      if (event.key === " ") {
        event.preventDefault();
        setPaused((p) => !p);
      } else if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleFullscreen();
      } else if (event.key === "m" || event.key === "M") {
        onSettings({ mirrorHorizontal: !settings.mirrorHorizontal });
      } else if (event.key === "ArrowDown" && settings.scrollMode === "wpm") {
        onSettings({ manualWpm: Math.min(250, settings.manualWpm + 10) });
      } else if (event.key === "ArrowUp" && settings.scrollMode === "wpm") {
        onSettings({ manualWpm: Math.max(80, settings.manualWpm - 10) });
      } else if (event.key === "ArrowDown") {
        onSeekToken?.(Math.min((speechModel.wordToToken.length - 1), tokenFromConfirmed(confirmedWordIdx) + 1));
      } else if (event.key === "ArrowUp") {
        onSeekToken?.(Math.max(0, tokenFromConfirmed(confirmedWordIdx) - 3));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings, onSettings, confirmedWordIdx, speechModel, onSeekToken]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      rootRef.current?.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setFullscreen(false)).catch(() => {});
    }
  }

  function tokenFromConfirmed(wordIdx) {
    if (wordIdx == null) return 0;
    return speechModel.wordToToken[Math.min(wordIdx, speechModel.words.length - 1)] ?? 0;
  }

  const confirmedTokenIdx = tokenFromConfirmed(confirmedWordIdx);
  const tokensByParagraph = useMemo(() => {
    const groups = [];
    for (const token of tokens) {
      let group = groups[groups.length - 1];
      if (!group || group.paragraphIndex !== token.paragraphIndex) {
        group = { paragraphIndex: token.paragraphIndex, tokens: [], isPauseOnly: false };
        groups.push(group);
      }
      if (token.isPauseCue) group.isPauseOnly = true;
      group.tokens.push(token);
    }
    return groups;
  }, [tokens]);

  const prompterBg = settings.pureBlack ? "bg-black text-base-content" : "bg-base-200 text-base-content";

  return (
    <div ref={rootRef} className={`relative flex h-full flex-col overflow-hidden ${prompterBg}`} data-testid="prompter">
      <div
        className={`grow overflow-y-auto px-4 sm:px-8 ${settings.mirrorHorizontal ? "scale-x-[-1]" : ""}`}
        ref={scrollRef}
        onPointerDown={(event) => {
          const tokenEl = event.target.closest("[data-token-idx]");
          if (tokenEl) {
            onSeekToken?.(Number(tokenEl.dataset.tokenIdx));
          }
        }}
      >
        <div className="mx-auto max-w-3xl py-[40vh]">
          <h1
            className={`mb-8 text-center ${settings.mirrorHorizontal ? "scale-x-[-1]" : ""}`}
            style={{ fontSize: Math.round(settings.fontSize / 2) }}
          >
            {title}
          </h1>
          <div
            aria-label="Script"
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              letterSpacing: "0.01em",
            }}
          >
            {tokensByParagraph.map((group, groupIdx) => {
              if (group.isPauseOnly) {
                return (
                  <div key={groupIdx} className="my-6 opacity-40" role="separator" aria-label="Pause break">
                    <span className="mx-auto block w-24 border-t-2 border-base-content" />
                  </div>
                );
              }
              return (
                <p key={groupIdx} className="mb-4 text-balance" style={{ textWrap: "pretty" }}>
                  {group.tokens.map((token, tokenIdx) => {
                    const isConfirmed = !token.isHeader && token.id <= confirmedTokenIdx && confirmedTokenIdx !== -1;
                    const isCurrent = !token.isHeader && token.id === confirmedTokenIdx + 1;
                    return (
                      <span
                        key={token.id}
                        data-token-idx={token.id}
                        className={`token ${isConfirmed ? "token-confirmed" : ""} ${isCurrent ? "token-current" : ""}`}
                        data-testid={isCurrent ? "current-token" : undefined}
                        ref={isCurrent ? currentRef : undefined}
                      >
                        {token.raw}
                        {group.tokens[tokenIdx + 1] ? " " : ""}
                      </span>
                    );
                  })}
                </p>
              );
            })}
          </div>
          <div className="h-[60vh]" />
        </div>
      </div>

      {/* Control bar sits outside the mirrored column */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-2 border-t border-base-300 bg-black/60 p-2 backdrop-blur">
        <button type="button" className="btn btn-sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
          {paused ? "Resume" : "Pause"}
        </button>

        <div className="join">
          {["whisper", "wpm", "manual"].map((mode) => (
            <button
              key={mode}
              type="button"
              className={`btn btn-sm join-item ${settings.scrollMode === mode ? "btn-primary" : ""}`}
              onClick={() => onSettings({ scrollMode: mode })}
            >
              {mode === "whisper" ? (
                <Volume2 aria-hidden="true" className="size-4" />
              ) : (
                <Gauge aria-hidden="true" className="size-4" />
              )}
              {mode}
            </button>
          ))}
        </div>

        {settings.scrollMode === "wpm" ? (
          <div className="flex items-center gap-1">
            <input
              type="range"
              className="range range-primary range-xs w-28"
              min="80"
              max="250"
              value={settings.manualWpm}
              aria-label="Words per minute"
              onChange={(event) => onSettings({ manualWpm: Number(event.target.value) })}
            />
            <span className="w-16 text-xs tabular-nums">{settings.manualWpm} wpm</span>
          </div>
        ) : null}

        <button
          type="button"
          className={`btn btn-sm ${settings.mirrorHorizontal ? "btn-primary" : ""}`}
          onClick={() => onSettings({ mirrorHorizontal: !settings.mirrorHorizontal })}
          aria-pressed={settings.mirrorHorizontal}
        >
          <MoveHorizontal aria-hidden="true" className="size-4" />
          Mirror
        </button>

        <button
          type="button"
          className={`btn btn-sm ${settings.pureBlack ? "btn-primary" : ""}`}
          onClick={() => onSettings({ pureBlack: !settings.pureBlack })}
          aria-pressed={settings.pureBlack}
        >
          OLED black
        </button>

        <button type="button" className="btn btn-sm" onClick={() => setShowSettings((s) => !s)}>
          <Settings2 aria-hidden="true" className="size-4" />
          Size
        </button>

        <button type="button" className="btn btn-sm" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize aria-hidden="true" className="size-4" /> : <Maximize aria-hidden="true" className="size-4" />}
          Fullscreen
        </button>

        {engine.listening ? (
          <button type="button" className="btn btn-error btn-sm" onClick={onToggleListen}>
            Stop tracking
          </button>
        ) : settings.scrollMode === "whisper" ? (
          <button type="button" className="btn btn-success btn-sm" onClick={onToggleListen}>
            Start tracking
          </button>
        ) : null}

        <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
          <CornerDownLeft aria-hidden="true" className="size-4" />
          Edit
        </button>
      </div>

      {showSettings ? (
        <div className="border-t border-base-300 bg-black/70 p-3">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <span>Font size</span>
              <input
                type="range"
                className="range range-sm w-40"
                min="24"
                max="72"
                value={settings.fontSize}
                aria-label="Font size in pixels"
                onChange={(event) => onSettings({ fontSize: Number(event.target.value) })}
              />
              <span className="tabular-nums text-xs">{settings.fontSize}px</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span>Line height</span>
              <input
                type="range"
                className="range range-sm w-32"
                min="1.2"
                max="2"
                step="0.05"
                value={settings.lineHeight}
                aria-label="Line height"
                onChange={(event) => onSettings({ lineHeight: Number(event.target.value) })}
              />
              <span className="tabular-nums text-xs">{settings.lineHeight.toFixed(2)}</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span>Focal line</span>
              <input
                type="range"
                className="range range-sm w-24"
                min="20"
                max="60"
                value={settings.focalEyeLinePercent}
                aria-label="Focal eye line percent"
                onChange={(event) => onSettings({ focalEyeLinePercent: Number(event.target.value) })}
              />
              <span className="tabular-nums text-xs">{settings.focalEyeLinePercent}%</span>
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PrompterView;
