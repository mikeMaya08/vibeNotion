import { Block, Document, DOC_ID } from '../types';

const DB_NAME = 'vibenotion-db';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
      dbPromise = null;
    };
  });

  return dbPromise;
}

export async function saveDocument(title: string, blocks: Block[]): Promise<void> {
  const db = await openDB();
  const doc: Document = {
    id: DOC_ID,
    title,
    blocks,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(doc);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function loadDocument(): Promise<{ title: string; blocks: Block[] } | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(DOC_ID);

    req.onsuccess = () => {
      const doc = req.result as Document | undefined;
      if (!doc) {
        resolve(null);
        return;
      }
      resolve({ title: doc.title, blocks: doc.blocks });
    };

    req.onerror = () => reject(req.error);
  });
}

export async function clearDocument(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(DOC_ID);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
