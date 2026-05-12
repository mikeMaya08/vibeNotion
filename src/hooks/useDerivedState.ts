import { useEffect } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { useDerivedStore } from '../store/derivedStore';
import { Block } from '../types';

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

/**
 * Change 3 – cascading derived-state effects.
 *
 * Three separate useEffect hooks all depend on `blocks` but update three
 * DIFFERENT pieces of state in two DIFFERENT stores.  React processes each
 * effect independently, causing a render chain:
 *
 *   blocks changes
 *     → render 1 (documentStore consumers re-render)
 *     → effect A fires  → setLastEdited  → render 2 (derivedStore consumers)
 *     → effect B fires  → setBlockWordCounts → render 3
 *     → effect C fires  → setWordCount + setCharCount + setBlockCount → render 4
 *
 * Effects A, B, C are in the same hook but intentionally NOT batched into
 * one setState call, so React sees them as separate state transitions.
 */
export function useDerivedState() {
  const blocks = useDocumentStore((s) => s.blocks);

  const setLastEdited = useDerivedStore((s) => s.setLastEdited);
  const setBlockWordCounts = useDerivedStore((s) => s.setBlockWordCounts);
  const setWordCount = useDerivedStore((s) => s.setWordCount);
  const setCharCount = useDerivedStore((s) => s.setCharCount);
  const setBlockCount = useDerivedStore((s) => s.setBlockCount);

  // Effect A – timestamp.  Runs first, triggers its own render.
  useEffect(() => {
    setLastEdited(Date.now());
  }, [blocks, setLastEdited]);

  // Effect B – per-block word counts.  Depends on `blocks` independently;
  // React may batch this with Effect A on the first run but will separate them
  // on subsequent runs where only one dep changed.
  useEffect(() => {
    const counts: Record<string, number> = {};
    for (const block of blocks) {
      counts[block.id] = countWords(block.content);
    }
    setBlockWordCounts(counts);
  }, [blocks, setBlockWordCounts]);

  // Effect C – aggregate totals.  Deliberately reads from `blocks` again
  // (not from blockWordCounts) so it runs on its own cycle rather than being
  // triggered by Effect B's state update.
  useEffect(() => {
    let words = 0;
    let chars = 0;
    for (const block of blocks) {
      words += countWords(block.content);
      chars += block.content.length;
    }
    setWordCount(words);
    setCharCount(chars);
    setBlockCount(blocks.length);
  }, [blocks, setWordCount, setCharCount, setBlockCount]);
}

// ── Selector helpers used by the StatusBar ───────────────────────────────────
export function useWordCount() {
  return useDerivedStore((s) => s.wordCount);
}

export function useLastEdited() {
  return useDerivedStore((s) => s.lastEdited);
}

export function useBlockStats(blockId: string): number {
  return useDerivedStore((s) => s.blockWordCounts[blockId] ?? 0);
}

export function useBlockCount() {
  return useDerivedStore((s) => s.blockCount);
}

// Utility to expose all three layers simultaneously for testing
export function useLayerSnapshot() {
  const storeBlocks = useDocumentStore((s) => s.blocks);
  const wordCount = useDerivedStore((s) => s.wordCount);
  const lastEdited = useDerivedStore((s) => s.lastEdited);
  return { storeBlocks, wordCount, lastEdited };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _blockType(_b: Block) { /* keep import used */ }
void _blockType;
