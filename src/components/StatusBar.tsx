import React from 'react';
import { useDerivedStore } from '../store/derivedStore';

/**
 * Change 3 – renders derived state so Playwright can observe the cascade.
 *
 * Each datum here lives in a separate Zustand slice that is updated by a
 * different useEffect in useDerivedState, so the values shown here can
 * temporarily be inconsistent with each other (e.g. wordCount is from the
 * previous render while lastEdited already reflects the latest blocks).
 */
export const StatusBar: React.FC = () => {
  const wordCount = useDerivedStore((s) => s.wordCount);
  const charCount = useDerivedStore((s) => s.charCount);
  const blockCount = useDerivedStore((s) => s.blockCount);
  const lastEdited = useDerivedStore((s) => s.lastEdited);

  const formattedTime = lastEdited
    ? new Date(lastEdited).toLocaleTimeString()
    : '—';

  return (
    <div className="status-bar" data-testid="status-bar">
      <span
        data-testid="status-word-count"
        data-value={wordCount}
      >
        {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </span>
      <span className="status-bar-sep" aria-hidden>·</span>
      <span
        data-testid="status-char-count"
        data-value={charCount}
      >
        {charCount} chars
      </span>
      <span className="status-bar-sep" aria-hidden>·</span>
      <span
        data-testid="status-block-count"
        data-value={blockCount}
      >
        {blockCount} {blockCount === 1 ? 'block' : 'blocks'}
      </span>
      <span className="status-bar-sep" aria-hidden>·</span>
      <span
        data-testid="status-last-edited"
        data-value={lastEdited ?? 0}
      >
        Edited {formattedTime}
      </span>
    </div>
  );
};
