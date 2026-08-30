import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PendingSyncItem } from '../types';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    const checkQueue = () => {
      const queue = JSON.parse(localStorage.getItem('microstore_sync_queue') || '[]');
      setPendingCount(queue.length);
    };

    checkQueue();

    const handleOnline = () => {
      setIsOnline(true);
      flushSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueItem = (type: 'REVENUE' | 'SUPPLIER_TX', payload: any) => {
    const newItem: PendingSyncItem = {
      id: uuidv4(),
      type,
      payload,
      timestamp: Date.now(),
    };

    const existing: PendingSyncItem[] = JSON.parse(
      localStorage.getItem('microstore_sync_queue') || '[]'
    );
    const updated = [...existing, newItem];
    localStorage.setItem('microstore_sync_queue', JSON.stringify(updated));
    setPendingCount(updated.length);

    if (navigator.onLine) {
      flushSyncQueue();
    }
  };

  const flushSyncQueue = async () => {
    const queue: PendingSyncItem[] = JSON.parse(
      localStorage.getItem('microstore_sync_queue') || '[]'
    );
    if (queue.length === 0) return;

    const remaining: PendingSyncItem[] = [];

    for (const item of queue) {
      try {
        if (item.type === 'REVENUE') {
          await fetch('/api/v1/revenues', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Client-Tx-ID': item.id,
            },
            body: JSON.stringify(item.payload),
          });
        } else if (item.type === 'SUPPLIER_TX') {
          await fetch(`/api/v1/suppliers/${item.payload.supplierId}/transaction`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Client-Tx-ID': item.id,
            },
            body: JSON.stringify(item.payload),
          });
        }
      } catch (err) {
        console.error('Failed to sync item:', item.id, err);
        remaining.push(item);
      }
    }

    localStorage.setItem('microstore_sync_queue', JSON.stringify(remaining));
    setPendingCount(remaining.length);
  };

  return { isOnline, pendingCount, queueItem, flushSyncQueue };
}
