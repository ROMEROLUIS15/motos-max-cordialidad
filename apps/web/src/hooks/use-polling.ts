'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs `callback` immediately and then every `intervalMs`, skipping ticks
 * while the tab is hidden and firing once immediately when it becomes
 * visible again — avoids polling a backgrounded tab and the stale-data
 * window right after switching back to it.
 */
export function usePolling(callback: () => void, intervalMs: number): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    callbackRef.current();

    const id = setInterval(() => {
      if (document.visibilityState === 'visible') callbackRef.current();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') callbackRef.current();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [intervalMs]);
}
