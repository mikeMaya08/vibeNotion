import { create } from 'zustand';
import { Block, BlockType, HistoryEntry, SaveStatus, DOC_ID } from '../types';

function generateId(): string {
  return `block-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function createDefaultBlock(): Block {
  return { id: generateId(), type: 'text', content: '', indent: 0 };
}

const MAX_HISTORY = 100;

interface DocumentState {
  docId: string;
  title: string;
  blocks: Block[];
  focusedBlockId: string | null;
  saveStatus: SaveStatus;
  isLoading: boolean;

  // Undo/redo
  past: HistoryEntry[];
  future: HistoryEntry[];

  // Drag state
  draggingBlockId: string | null;
  dragOverBlockId: string | null;

  // Actions
  setTitle: (title: string) => void;
  setBlocks: (blocks: Block[]) => void;
  setLoading: (loading: boolean) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setFocusedBlockId: (id: string | null) => void;

  addBlockAfter: (afterId: string | null, type?: BlockType) => string;
  updateBlockContent: (id: string, content: string) => void;
  updateBlockType: (id: string, type: BlockType) => void;
  deleteBlock: (id: string) => void;
  mergeBlockWithPrevious: (id: string) => { mergedId: string; cursorOffset: number } | null;
  moveBlock: (fromId: string, toId: string) => void;
  reorderBlocks: (orderedIds: string[]) => void;

  undo: () => void;
  redo: () => void;

  setDraggingBlockId: (id: string | null) => void;
  setDragOverBlockId: (id: string | null) => void;

  // Initialise from persisted data
  hydrate: (title: string, blocks: Block[]) => void;
}

function pushHistory(past: HistoryEntry[], current: HistoryEntry): HistoryEntry[] {
  const next = [...past, current];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  docId: DOC_ID,
  title: 'Untitled Document',
  blocks: [createDefaultBlock()],
  focusedBlockId: null,
  saveStatus: 'idle',
  isLoading: true,
  past: [],
  future: [],
  draggingBlockId: null,
  dragOverBlockId: null,

  setTitle: (title) => set({ title }),

  setBlocks: (blocks) => set({ blocks }),

  setLoading: (isLoading) => set({ isLoading }),

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  setFocusedBlockId: (focusedBlockId) => set({ focusedBlockId }),

  hydrate: (title, blocks) => {
    const hydrated = blocks.length > 0 ? blocks : [createDefaultBlock()];
    set({
      title,
      blocks: hydrated,
      isLoading: false,
      past: [],
      future: [],
      focusedBlockId: hydrated[0].id,
    });
  },

  addBlockAfter: (afterId, type = 'text') => {
    const { blocks, past, focusedBlockId } = get();
    const newBlock = createDefaultBlock();
    newBlock.type = type;

    let insertIndex = blocks.length;
    if (afterId !== null) {
      const idx = blocks.findIndex((b) => b.id === afterId);
      if (idx !== -1) insertIndex = idx + 1;
    }

    const newBlocks = [
      ...blocks.slice(0, insertIndex),
      newBlock,
      ...blocks.slice(insertIndex),
    ];

    set({
      blocks: newBlocks,
      focusedBlockId: newBlock.id,
      past: pushHistory(past, { blocks, focusedBlockId }),
      future: [],
    });

    return newBlock.id;
  },

  updateBlockContent: (id, content) => {
    const { blocks } = get();
    set({
      blocks: blocks.map((b) => (b.id === id ? { ...b, content } : b)),
    });
  },

  updateBlockType: (id, type) => {
    const { blocks, past, focusedBlockId } = get();
    set({
      blocks: blocks.map((b) => (b.id === id ? { ...b, type } : b)),
      past: pushHistory(past, { blocks, focusedBlockId }),
      future: [],
    });
  },

  deleteBlock: (id) => {
    const { blocks, past, focusedBlockId } = get();
    if (blocks.length <= 1) {
      set({ blocks: [{ ...blocks[0], content: '' }] });
      return;
    }
    const idx = blocks.findIndex((b) => b.id === id);
    const newFocus = idx > 0 ? blocks[idx - 1].id : blocks[idx + 1]?.id ?? null;
    set({
      blocks: blocks.filter((b) => b.id !== id),
      focusedBlockId: newFocus,
      past: pushHistory(past, { blocks, focusedBlockId }),
      future: [],
    });
  },

  mergeBlockWithPrevious: (id) => {
    const { blocks, past, focusedBlockId } = get();
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx <= 0) return null;

    const prev = blocks[idx - 1];
    const current = blocks[idx];
    const cursorOffset = prev.content.length;

    const merged: Block = { ...prev, content: prev.content + current.content };
    const newBlocks = blocks
      .slice(0, idx - 1)
      .concat(merged)
      .concat(blocks.slice(idx + 1));

    set({
      blocks: newBlocks,
      focusedBlockId: prev.id,
      past: pushHistory(past, { blocks, focusedBlockId }),
      future: [],
    });

    return { mergedId: prev.id, cursorOffset };
  },

  moveBlock: (fromId, toId) => {
    const { blocks, past, focusedBlockId } = get();
    const fromIdx = blocks.findIndex((b) => b.id === fromId);
    const toIdx = blocks.findIndex((b) => b.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

    const newBlocks = [...blocks];
    const [moved] = newBlocks.splice(fromIdx, 1);
    newBlocks.splice(toIdx, 0, moved);

    set({
      blocks: newBlocks,
      past: pushHistory(past, { blocks, focusedBlockId }),
      future: [],
      draggingBlockId: null,
      dragOverBlockId: null,
    });
  },

  reorderBlocks: (orderedIds) => {
    const { blocks, past, focusedBlockId } = get();
    const blockMap = new Map(blocks.map((b) => [b.id, b]));
    const newBlocks = orderedIds.map((id) => blockMap.get(id)!).filter(Boolean);
    set({
      blocks: newBlocks,
      past: pushHistory(past, { blocks, focusedBlockId }),
      future: [],
    });
  },

  undo: () => {
    const { past, blocks, focusedBlockId } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    set({
      blocks: previous.blocks,
      focusedBlockId: previous.focusedBlockId,
      past: past.slice(0, -1),
      future: [{ blocks, focusedBlockId }, ...get().future],
    });
  },

  redo: () => {
    const { future, blocks, focusedBlockId } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      blocks: next.blocks,
      focusedBlockId: next.focusedBlockId,
      future: future.slice(1),
      past: pushHistory(get().past, { blocks, focusedBlockId }),
    });
  },

  setDraggingBlockId: (draggingBlockId) => set({ draggingBlockId }),
  setDragOverBlockId: (dragOverBlockId) => set({ dragOverBlockId }),
}));
