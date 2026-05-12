import React, { useEffect, useCallback, useRef } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { useAutosave } from '../hooks/useAutosave';
import { useEditorState } from '../hooks/useEditorState';
import { BlockList } from './BlockList';
import { StatusBar } from './StatusBar';
import { loadDocument } from '../persistence/indexedDB';

const SAVE_STATUS_LABELS: Record<string, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

export const Editor: React.FC = () => {
  const title = useDocumentStore((s) => s.title);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const saveStatus = useDocumentStore((s) => s.saveStatus);
  const isLoading = useDocumentStore((s) => s.isLoading);
  const hydrate = useDocumentStore((s) => s.hydrate);
  const blocks = useDocumentStore((s) => s.blocks);
  const addBlockAfter = useDocumentStore((s) => s.addBlockAfter);

  const { undo, redo } = useEditorState();
  const titleRef = useRef<HTMLDivElement>(null);

  // Load persisted document on mount
  useEffect(() => {
    loadDocument().then((doc) => {
      if (doc) {
        hydrate(doc.title, doc.blocks);
      } else {
        hydrate('Untitled Document', []);
      }
    });
  }, [hydrate]);

  // Sync title DOM ↔ store (for undo/redo cross-sync)
  useEffect(() => {
    if (titleRef.current && titleRef.current.innerText !== title) {
      titleRef.current.innerText = title;
    }
  }, [title]);

  // Autosave + BroadcastChannel wired up here
  useAutosave();

  // Global keyboard shortcuts (Ctrl/Cmd+Z / Shift+Z)
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    },
    [undo, redo],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  const handleTitleInput = useCallback(() => {
    const text = titleRef.current?.innerText ?? '';
    setTitle(text);
  }, [setTitle]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (blocks.length > 0) {
          useDocumentStore.getState().setFocusedBlockId(blocks[0].id);
        } else {
          addBlockAfter(null);
        }
      }
    },
    [blocks, addBlockAfter],
  );

  if (isLoading) {
    return (
      <div className="editor-loading" data-testid="editor-loading">
        <div className="editor-loading-spinner" data-testid="loading-spinner" />
        <p>Loading document…</p>
      </div>
    );
  }

  return (
    <div className="editor" data-testid="editor">
      {/* Toolbar */}
      <div className="editor-toolbar" data-testid="editor-toolbar">
        <div className="editor-toolbar-left">
          <button
            className="toolbar-btn"
            data-testid="btn-undo"
            onClick={undo}
            title="Undo (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button
            className="toolbar-btn"
            data-testid="btn-redo"
            onClick={redo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪ Redo
          </button>
        </div>

        <div className="editor-toolbar-right">
          <span
            className={`save-indicator save-indicator--${saveStatus}`}
            data-testid="save-indicator"
            data-save-status={saveStatus}
          >
            {SAVE_STATUS_LABELS[saveStatus]}
          </span>
        </div>
      </div>

      {/* Document title */}
      <div
        ref={titleRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-testid="document-title"
        data-placeholder="Untitled"
        className={`editor-title${title === '' ? ' editor-title--empty' : ''}`}
        onInput={handleTitleInput}
        onKeyDown={handleTitleKeyDown}
      />

      {/* Block list */}
      <BlockList />

      {/* Add block button */}
      <button
        className="add-block-btn"
        data-testid="btn-add-block"
        onClick={() => {
          const lastId = blocks.length > 0 ? blocks[blocks.length - 1].id : null;
          addBlockAfter(lastId);
        }}
      >
        + Add block
      </button>

      {/* Change 3 – status bar shows derived state updated via cascade */}
      <StatusBar />
    </div>
  );
};
