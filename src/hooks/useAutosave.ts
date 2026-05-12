import { useEffect, useRef, useCallback } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { saveDocument } from '../persistence/indexedDB';
import { Block } from '../types';

const DEBOUNCE_MS = 800;
const BROADCAST_CHANNEL = 'vibenotion-sync';

const TAB_ID = `tab-${Date.now()}-${Math.floor(performance.now())}`;

interface SyncMessage {
  type: 'DOCUMENT_UPDATED';
  title: string;
  blocks: Block[];
  sourceTabId: string;
  // sequence number so the receiver can detect out-of-order delivery
  seq: number;
}

/**
 * Change 1 – non-deterministic multi-tab ordering.
 *
 * Each incoming BroadcastChannel message is scheduled via two different
 * macrotask queues so that rapid bursts from Tab A can arrive and be applied
 * in a different order in Tab B:
 *
 *   Promise.resolve() → microtask (runs before next macrotask)
 *   setTimeout(0)     → macrotask  (runs after current call-stack + microtasks)
 *
 * When multiple messages are in-flight, which one "wins" depends on whether
 * its Promise resolved before or after the next setTimeout fires.  No random
 * delays are involved – the ordering is a natural artefact of the event loop.
 */
function scheduleApply(fn: () => void, seq: number): void {
  // Even-seq messages go through a microtask then a macrotask.
  // Odd-seq messages go directly through a macrotask.
  // This means two consecutive messages posted from Tab A can be applied
  // out-of-order if the even one started its microtask after the odd one
  // already queued its macrotask.
  if (seq % 2 === 0) {
    Promise.resolve().then(() => setTimeout(fn, 0));
  } else {
    setTimeout(fn, 0);
  }
}

export function useAutosave() {
  const blocks = useDocumentStore((s) => s.blocks);
  const title = useDocumentStore((s) => s.title);
  const setSaveStatus = useDocumentStore((s) => s.setSaveStatus);
  const setBlocks = useDocumentStore((s) => s.setBlocks);
  const setTitle = useDocumentStore((s) => s.setTitle);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isSyncingRef = useRef(false);
  // Tracks the last applied remote seq so stale messages can be ignored once
  // the store has moved on (but NOT dropped eagerly – only after apply).
  const lastAppliedSeqRef = useRef(-1);
  // Change 5 – tracks whether a save is already in-flight.
  const saveInFlightRef = useRef(false);
  const seqCounterRef = useRef(0);

  // ── BroadcastChannel listener ─────────────────────────────────────────────
  useEffect(() => {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      const msg = event.data;
      if (msg.type !== 'DOCUMENT_UPDATED') return;
      if (msg.sourceTabId === TAB_ID) return;

      // Change 1 – schedule the apply through the non-deterministic path.
      scheduleApply(() => {
        // After scheduling, a newer message might have already been applied.
        // We still apply this one – giving each message a chance to win –
        // which means the final visible state depends on arrival order.
        isSyncingRef.current = true;
        lastAppliedSeqRef.current = msg.seq;
        setTitle(msg.title);
        setBlocks(msg.blocks);

        // Release the sync lock via a separate macrotask so that the store
        // update triggered above (which batches synchronously in Zustand)
        // has already propagated through React's render pipeline before we
        // allow re-broadcast.
        Promise.resolve().then(() => {
          isSyncingRef.current = false;
        });
      }, msg.seq);
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [setBlocks, setTitle]);

  // ── Save function (Change 5 – overlapping saves allowed) ─────────────────
  const save = useCallback(
    async (currentTitle: string, currentBlocks: Block[]) => {
      // Change 5 – we do NOT skip if a save is in-flight; we let them overlap.
      // The indicator jumps back to "saving" for each new inflight write.
      setSaveStatus('saving');
      saveInFlightRef.current = true;

      try {
        await saveDocument(currentTitle, currentBlocks);
        // Only mark "saved" if no newer save is already running.  The
        // debounce timer may have fired another save while this one was in
        // the IndexedDB transaction, so the status might flip
        // saving → saved → saving → saved in quick succession.
        setSaveStatus('saved');

        if (!isSyncingRef.current && channelRef.current) {
          seqCounterRef.current += 1;
          const msg: SyncMessage = {
            type: 'DOCUMENT_UPDATED',
            title: currentTitle,
            blocks: currentBlocks,
            sourceTabId: TAB_ID,
            seq: seqCounterRef.current,
          };
          channelRef.current.postMessage(msg);
        }
      } catch {
        setSaveStatus('error');
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [setSaveStatus],
  );

  // ── Debounced autosave ────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Immediately reflect that a save is pending (state 1 of 3).
    setSaveStatus('saving');

    debounceRef.current = setTimeout(() => {
      // Change 5 – fire-and-forget; do not await.  Multiple saves can be
      // in-flight simultaneously if the user types faster than IndexedDB
      // commits.
      save(title, blocks);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [blocks, title, save, setSaveStatus]);
}
