import React, {
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  KeyboardEvent,
} from 'react';
import { Block as BlockType, BlockType as BType } from '../types';
import { useDocumentStore } from '../store/documentStore';
import { SlashMenu } from './SlashMenu';

interface Props {
  block: BlockType;
  index: number;
  onEnter: (id: string) => void;
  onBackspaceEmpty: (id: string) => { mergedId: string; cursorOffset: number } | null;
  onArrowUp: (id: string) => void;
  onArrowDown: (id: string) => void;
  onTransform: (id: string, type: BType) => void;
  pendingCursor: React.MutableRefObject<Map<string, number>>;
}

function getTagForType(type: BType): string {
  switch (type) {
    case 'heading1': return 'h1';
    case 'heading2': return 'h2';
    case 'heading3': return 'h3';
    case 'code': return 'pre';
    default: return 'div';
  }
}

function getPlaceholder(type: BType): string {
  switch (type) {
    case 'heading1': return 'Heading 1';
    case 'heading2': return 'Heading 2';
    case 'heading3': return 'Heading 3';
    case 'bullet': return 'List item';
    case 'numbered': return 'List item';
    case 'code': return 'Write code…';
    case 'quote': return 'Quote…';
    default: return "Type '/' for commands…";
  }
}

export const Block: React.FC<Props> = ({
  block,
  index,
  onEnter,
  onBackspaceEmpty,
  onArrowUp,
  onArrowDown,
  onTransform,
  pendingCursor,
}) => {
  const contentRef = useRef<HTMLElement>(null);
  const updateBlockContent = useDocumentStore((s) => s.updateBlockContent);
  const focusedBlockId = useDocumentStore((s) => s.focusedBlockId);
  const setFocusedBlockId = useDocumentStore((s) => s.setFocusedBlockId);
  const draggingBlockId = useDocumentStore((s) => s.draggingBlockId);

  // ── Change 2 – Layer 1: local draft state ─────────────────────────────────
  // The user's keystrokes land here first. This state is intentionally ahead
  // of both the Zustand store (Layer 2) and IndexedDB (Layer 3), making it
  // possible at any point in time for all three to hold different values.
  const [localDraft, setLocalDraft] = useState(block.content);
  // Marks whether localDraft is "dirty" – not yet pushed to the store.
  const draftDirtyRef = useRef(false);

  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const slashStartRef = useRef<number>(-1);
  const isFocused = focusedBlockId === block.id;

  // ── Change 4 – Phase 1: useLayoutEffect cursor restore ────────────────────
  // Runs synchronously after DOM paint.  Handles the "just merged" case where
  // we need the cursor at an exact offset before the user sees anything.
  useLayoutEffect(() => {
    if (!isFocused || !contentRef.current) return;
    const el = contentRef.current;

    if (document.activeElement !== el) {
      el.focus({ preventScroll: false });
    }

    const pending = pendingCursor.current.get(block.id);
    if (pending !== undefined) {
      // Remove from the map NOW so Phase 2 does not double-apply.
      pendingCursor.current.delete(block.id);
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        const textNode = el.childNodes[0];
        if (textNode?.nodeType === Node.TEXT_NODE) {
          const offset = Math.min(pending, (textNode as Text).length);
          range.setStart(textNode, offset);
          range.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      } catch {
        // Phase 2 will retry
      }
    }
  }, [isFocused, block.id, pendingCursor]);

  // ── Change 4 – Phase 2: useEffect cursor restore ─────────────────────────
  // Runs asynchronously after paint.  Handles cases where the DOM was not
  // fully ready in Phase 1 (e.g. the new tag was just mounted after a type
  // transform), or where Phase 1 silently failed.  The two phases running at
  // different points in the React lifecycle mean focus can shift between
  // renders, producing observable intermediate states.
  useEffect(() => {
    if (!isFocused || !contentRef.current) return;
    const el = contentRef.current;

    // If there is still a pending cursor entry that Phase 1 did NOT consume
    // (i.e. Phase 1 threw or the text node was absent), apply it now.
    const pending = pendingCursor.current.get(block.id);
    if (pending === undefined) return;

    pendingCursor.current.delete(block.id);
    try {
      const range = document.createRange();
      const sel = window.getSelection();
      const textNode = el.childNodes[0];
      if (textNode?.nodeType === Node.TEXT_NODE) {
        const offset = Math.min(pending, (textNode as Text).length);
        range.setStart(textNode, offset);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    } catch {
      // best effort
    }
  }, [isFocused, block.id, pendingCursor]);

  // ── Change 2 – sync Layer 1 → Layer 2 via microtask ─────────────────────
  // When localDraft is dirtied by the user, we schedule the store update as a
  // microtask (Promise.resolve) rather than doing it inline.  This creates a
  // window – however brief – where the DOM shows one value, the Zustand store
  // has not yet received it, and IndexedDB still has the previous save.
  useEffect(() => {
    if (!draftDirtyRef.current) return;
    draftDirtyRef.current = false;

    // queueMicrotask schedules at the end of the current microtask checkpoint,
    // after the current React render batch but before the next macrotask.
    queueMicrotask(() => {
      updateBlockContent(block.id, localDraft);
    });
  }, [localDraft, block.id, updateBlockContent]);

  // ── Sync Layer 2 → Layer 1 for external changes (undo/redo/multi-tab) ────
  // When the store pushes a new value from outside (not from local typing),
  // we overwrite both the local draft and the DOM.
  useEffect(() => {
    if (block.content === localDraft) return;
    // External update wins. Reset draft to match.
    setLocalDraft(block.content);
    const el = contentRef.current;
    if (el && el.innerText !== block.content) {
      el.innerText = block.content;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.content]);
  // NOTE: intentionally NOT including localDraft in deps – we only want this
  // to fire when block.content (the store) changes externally.

  // ── Input handler – writes to Layer 1 only ────────────────────────────────
  const handleInput = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const text = el.innerText ?? '';

    // Detect slash command
    if (text.endsWith('/') && slashStartRef.current === -1) {
      slashStartRef.current = text.length - 1;
      setSlashQuery('');
      // Layer 1 update (store will follow via microtask)
      draftDirtyRef.current = true;
      setLocalDraft(text);
      return;
    }

    if (slashStartRef.current !== -1) {
      const query = text.slice(slashStartRef.current + 1);
      if (text.includes('/') && !query.includes(' ')) {
        setSlashQuery(query);
        draftDirtyRef.current = true;
        setLocalDraft(text);
        return;
      } else {
        slashStartRef.current = -1;
        setSlashQuery(null);
      }
    }

    // Normal typing: update Layer 1 immediately, Layer 2 via microtask.
    draftDirtyRef.current = true;
    setLocalDraft(text);
  }, []);

  const closeSlashMenu = useCallback(() => {
    setSlashQuery(null);
    slashStartRef.current = -1;
  }, []);

  const handleSlashSelect = useCallback(
    (type: BType) => {
      if (!contentRef.current) return;
      const el = contentRef.current;
      const slashPos = slashStartRef.current;
      const cleaned = localDraft.slice(0, slashPos < 0 ? undefined : slashPos);
      el.innerText = cleaned;
      // Write through all layers synchronously on an explicit user action.
      setLocalDraft(cleaned);
      updateBlockContent(block.id, cleaned);
      onTransform(block.id, type);
      setSlashQuery(null);
      slashStartRef.current = -1;
    },
    [localDraft, block.id, onTransform, updateBlockContent],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (slashQuery !== null && ['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onEnter(block.id);
        return;
      }

      if (e.key === 'Backspace') {
        const el = contentRef.current;
        const text = el?.innerText ?? '';
        if (text === '' || text === '\n') {
          e.preventDefault();
          const result = onBackspaceEmpty(block.id);
          if (result) {
            pendingCursor.current.set(result.mergedId, result.cursorOffset);
          }
          return;
        }
        if (slashStartRef.current !== -1) {
          const sel = window.getSelection();
          if (sel && sel.focusOffset <= slashStartRef.current + 1) {
            closeSlashMenu();
          }
        }
      }

      if (e.key === 'ArrowUp') {
        const sel = window.getSelection();
        if (sel && sel.focusOffset === 0) {
          e.preventDefault();
          onArrowUp(block.id);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        const el = contentRef.current;
        const sel = window.getSelection();
        if (sel && el) {
          const text = el.innerText ?? '';
          if (sel.focusOffset >= text.length) {
            e.preventDefault();
            onArrowDown(block.id);
          }
        }
        return;
      }

      if (e.key === 'Escape' && slashQuery !== null) {
        closeSlashMenu();
      }
    },
    [block.id, slashQuery, onEnter, onBackspaceEmpty, onArrowUp, onArrowDown, closeSlashMenu, pendingCursor],
  );

  const Tag = getTagForType(block.type) as React.ElementType;
  const isDragging = draggingBlockId === block.id;

  return (
    <div
      className={`block-wrapper block-wrapper--${block.type}${isFocused ? ' block-wrapper--focused' : ''}${isDragging ? ' block-wrapper--dragging' : ''}`}
      data-testid={`block-${block.id}`}
      data-block-id={block.id}
      data-block-type={block.type}
      data-block-index={index}
      // Change 2 – expose draft vs store divergence for test observation
      data-draft-synced={localDraft === block.content ? 'true' : 'false'}
    >
      {block.type === 'bullet' && <span className="block-bullet" aria-hidden>•</span>}
      {block.type === 'numbered' && (
        <span className="block-number" aria-hidden>{index + 1}.</span>
      )}

      <Tag
        ref={contentRef as React.RefObject<HTMLDivElement>}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-testid={`block-content-${block.id}`}
        data-placeholder={getPlaceholder(block.type)}
        className={`block-content block-content--${block.type}${localDraft === '' ? ' block-content--empty' : ''}`}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocusedBlockId(block.id)}
      />

      {slashQuery !== null && (
        <SlashMenu
          query={slashQuery}
          onSelect={handleSlashSelect}
          onClose={closeSlashMenu}
        />
      )}
    </div>
  );
};
