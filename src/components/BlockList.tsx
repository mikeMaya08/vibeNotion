import React, { useRef, useCallback } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { Block } from './Block';
import { useEditorState } from '../hooks/useEditorState';
import { useDerivedState, useBlockStats } from '../hooks/useDerivedState';

// ── Per-block stats badge ─────────────────────────────────────────────────────
// Subscribes to derivedStore independently so it re-renders on its own cadence,
// separate from the Block's own re-render cycle.
const BlockWordBadge: React.FC<{ blockId: string }> = ({ blockId }) => {
  const words = useBlockStats(blockId);
  return (
    <span
      className="block-word-badge"
      data-testid={`block-words-${blockId}`}
      data-value={words}
    >
      {words > 0 ? `${words}w` : ''}
    </span>
  );
};

export const BlockList: React.FC = () => {
  const blocks = useDocumentStore((s) => s.blocks);
  const setDraggingBlockId = useDocumentStore((s) => s.setDraggingBlockId);
  const setDragOverBlockId = useDocumentStore((s) => s.setDragOverBlockId);
  const draggingBlockId = useDocumentStore((s) => s.draggingBlockId);
  const dragOverBlockId = useDocumentStore((s) => s.dragOverBlockId);
  const moveBlock = useDocumentStore((s) => s.moveBlock);

  const {
    handleEnterKey,
    handleBackspaceOnEmpty,
    focusAdjacentBlock,
    handleTransformBlock,
  } = useEditorState();

  // Change 3 – wire up the cascading derived-state effects here so they run
  // whenever the block list (the root subscriber of blocks) renders.
  useDerivedState();

  const pendingCursor = useRef<Map<string, number>>(new Map());

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, blockId: string) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', blockId);
      setDraggingBlockId(blockId);
    },
    [setDraggingBlockId],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, blockId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (blockId !== draggingBlockId) {
        setDragOverBlockId(blockId);
      }
    },
    [draggingBlockId, setDragOverBlockId],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const rel = e.relatedTarget as Node | null;
      if (!e.currentTarget.contains(rel)) {
        setDragOverBlockId(null);
      }
    },
    [setDragOverBlockId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData('text/plain');
      if (sourceId && sourceId !== targetId) {
        moveBlock(sourceId, targetId);
      }
      setDragOverBlockId(null);
    },
    [moveBlock, setDragOverBlockId],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingBlockId(null);
    setDragOverBlockId(null);
  }, [setDraggingBlockId, setDragOverBlockId]);

  return (
    <div className="block-list" data-testid="block-list">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={`block-row${
            dragOverBlockId === block.id && draggingBlockId !== block.id
              ? ' block-row--drag-over'
              : ''
          }`}
          data-testid={`block-row-${block.id}`}
          draggable
          onDragStart={(e) => handleDragStart(e, block.id)}
          onDragOver={(e) => handleDragOver(e, block.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, block.id)}
          onDragEnd={handleDragEnd}
        >
          <div
            className="block-drag-handle"
            data-testid={`drag-handle-${block.id}`}
            aria-label="Drag to reorder"
            title="Drag to reorder"
          >
            ⠿
          </div>

          {/*
           * Change 6 – key includes block.type.
           * When the user transforms a block (text → heading1), React sees a
           * new key and unmounts the old component entirely before mounting the
           * new one.  This destroys the DOM node, any focus, and any local
           * state, making it impossible to hold a stale ElementHandle across a
           * type transformation.
           */}
          <Block
            key={`${block.id}-${block.type}`}
            block={block}
            index={index}
            onEnter={handleEnterKey}
            onBackspaceEmpty={handleBackspaceOnEmpty}
            onArrowUp={() => focusAdjacentBlock('up')}
            onArrowDown={() => focusAdjacentBlock('down')}
            onTransform={handleTransformBlock}
            pendingCursor={pendingCursor}
          />

          {/* Change 3 – badge subscribes to derivedStore independently */}
          <BlockWordBadge blockId={block.id} />
        </div>
      ))}
    </div>
  );
};
