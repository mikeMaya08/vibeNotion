import { create } from 'zustand';

/**
 * Change 3 – derived state store.
 *
 * Intentionally separate from documentStore so that React must re-render the
 * components that subscribe to EACH store independently.  A single user
 * action (typing a character) triggers:
 *
 *   1. documentStore update  (synchronous, via queueMicrotask from Block)
 *   2. wordCount effect       (useEffect fires after next render)
 *   3. lastEdited effect      (another useEffect, same deps, different phase)
 *   4. blockStats effect      (another useEffect, fires after wordCount state update)
 *
 * This cascade means there are at least 3 renders between "user presses key"
 * and "all derived values are stable".
 */
interface DerivedState {
  wordCount: number;
  charCount: number;
  blockCount: number;
  lastEdited: number | null;   // timestamp ms
  // Per-block word counts, keyed by block id
  blockWordCounts: Record<string, number>;

  setWordCount: (count: number) => void;
  setCharCount: (count: number) => void;
  setBlockCount: (count: number) => void;
  setLastEdited: (ts: number) => void;
  setBlockWordCounts: (counts: Record<string, number>) => void;
}

export const useDerivedStore = create<DerivedState>((set) => ({
  wordCount: 0,
  charCount: 0,
  blockCount: 0,
  lastEdited: null,
  blockWordCounts: {},

  setWordCount: (wordCount) => set({ wordCount }),
  setCharCount: (charCount) => set({ charCount }),
  setBlockCount: (blockCount) => set({ blockCount }),
  setLastEdited: (lastEdited) => set({ lastEdited }),
  setBlockWordCounts: (blockWordCounts) => set({ blockWordCounts }),
}));
