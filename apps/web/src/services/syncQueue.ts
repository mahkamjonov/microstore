import { ApiError, getToken, isRetryableError } from '../api/client';
import { PendingSyncItem } from '../types';
import { saveRevenueToApi } from './revenue';

const QUEUE_KEY = 'microstore_sync_queue';

const readQueue = (): PendingSyncItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: PendingSyncItem[]) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {}
};

// Revenue entries made while offline are kept here and sent (with their original store) once the connection is back.
export function enqueueRevenue(storeId: string, payload: unknown) {
  writeQueue([
    ...readQueue(),
    { id: crypto.randomUUID(), type: 'REVENUE', storeId, payload, timestamp: Date.now() },
  ]);
}

let flushing = false;

export async function flushSyncQueue(): Promise<number> {
  if (flushing || !getToken()) return 0;
  flushing = true;
  let sent = 0;

  try {
    const queue = readQueue();
    const remaining: PendingSyncItem[] = [];
    let blocked = false;

    for (const item of queue) {
      if (blocked) {
        remaining.push(item);
        continue;
      }
      if (item.type !== 'REVENUE') continue;

      try {
        await saveRevenueToApi(item.payload, { storeId: item.storeId, txId: item.id });
        sent++;
      } catch (error) {
        const loggedOut = error instanceof ApiError && error.status === 401;
        if (isRetryableError(error) || loggedOut) {
          remaining.push(item);
          blocked = true;
        }
        // Permanent errors (validation, no access) are dropped: retrying cannot succeed.
      }
    }

    writeQueue(remaining);
  } finally {
    flushing = false;
  }

  return sent;
}

export function initSyncQueue(onSynced: () => void) {
  const run = () => {
    flushSyncQueue().then((sent) => {
      if (sent > 0) onSynced();
    });
  };

  window.addEventListener('online', run);
  run();
  return () => window.removeEventListener('online', run);
}
