import { useCallback } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { BlockType } from '../types';

/**
 * Exposes editor-level keyboard actions separate from per-block handlers.
 * Consumed by the Editor component for global key listeners.
 */
export function useEditorState() {
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const blocks = useDocumentStore((s) => s.blocks);
  const focusedBlockId = useDocumentStore((s) => s.focusedBlockId);
  const setFocusedBlockId = useDocumentStore((s) => s.setFocusedBlockId);
  const addBlockAfter = useDocumentStore((s) => s.addBlockAfter);
  const deleteBlock = useDocumentStore((s) => s.deleteBlock);
  const mergeBlockWithPrevious = useDocumentStore((s) => s.mergeBlockWithPrevious);
  const updateBlockType = useDocumentStore((s) => s.updateBlockType);

  const focusAdjacentBlock = useCallback(
    (direction: 'up' | 'down') => {
      if (!focusedBlockId) return;
      const idx = blocks.findIndex((b) => b.id === focusedBlockId);
      if (idx === -1) return;
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < blocks.length) {
        setFocusedBlockId(blocks[nextIdx].id);
      }
    },
    [blocks, focusedBlockId, setFocusedBlockId],
  );

  const handleEnterKey = useCallback(
    (blockId: string) => {
      addBlockAfter(blockId);
    },
    [addBlockAfter],
  );

  const handleBackspaceOnEmpty = useCallback(
    (blockId: string): { mergedId: string; cursorOffset: number } | null => {
      return mergeBlockWithPrevious(blockId);
    },
    [mergeBlockWithPrevious],
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => deleteBlock(blockId),
    [deleteBlock],
  );

  const handleTransformBlock = useCallback(
    (blockId: string, type: BlockType) => updateBlockType(blockId, type),
    [updateBlockType],
  );

  return {
    undo,
    redo,
    focusAdjacentBlock,
    handleEnterKey,
    handleBackspaceOnEmpty,
    handleDeleteBlock,
    handleTransformBlock,
  };
}
