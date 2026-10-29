// Speech tracking state: apply transcript batches to the script's spoken
// words via the sliding-window matcher, with recovery search handling.

import { useCallback, useRef, useState } from "react";
import { applyTranscript } from "../utils/tokenMatcher.js";

export function useTracker(speechModel) {
  const [state, setState] = useState({ pointer: 0, confirmed: -1, misses: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;
  const modelRef = useRef(speechModel);
  modelRef.current = speechModel;

  /** Feed one transcript batch; returns the new pointer word index. */
  const apply = useCallback(
    (transcriptWords, options = {}) => {
      const model = modelRef.current;
      if (!model || model.words.length === 0) return stateRef.current;
      if (options.windowChanged) {
        const next = { ...stateRef.current, pointer: Math.min(stateRef.current.pointer, model.words.length) };
        stateRef.current = next;
        setState(next);
        return next;
      }
      const next = applyTranscript(model, stateRef.current, transcriptWords, options);
      if (next.pointer !== stateRef.current.pointer || next.confirmed !== stateRef.current.confirmed) {
        stateRef.current = next;
        setState(next);
      }
      return next;
    },
    []
  );

  /** Jump to a token index (tap-to-reposition); clears miss counter. */
  const seekToken = useCallback(
    (tokenIdx) => {
      const model = modelRef.current;
      if (!model) return stateRef.current;
      let pointer = stateRef.current.pointer;
      for (let i = 0; i < model.wordToToken.length; i += 1) {
        if (model.wordToToken[i] >= tokenIdx) {
          pointer = i;
          break;
        }
      }
      if (tokenIdx > (model.wordToToken[model.wordToToken.length - 1] ?? -1)) {
        pointer = model.words.length;
      }
      const next = { pointer, confirmed: pointer - 1, misses: 0 };
      stateRef.current = next;
      setState(next);
      return next;
    },
    []
  );

  const reset = useCallback(() => {
    const next = { pointer: 0, confirmed: -1, misses: 0 };
    stateRef.current = next;
    setState(next);
  }, []);

  return {
    state,
    pointer: state.pointer,
    confirmed: state.confirmed,
    apply,
    seekToken,
    reset,
  };
}
