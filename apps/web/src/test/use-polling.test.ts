import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePolling } from '@/hooks/use-polling';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePolling', () => {
  it('calls the callback immediately on mount', () => {
    const callback = vi.fn();
    renderHook(() => usePolling(callback, 1000));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls the callback again on every tick while the tab is visible', () => {
    const callback = vi.fn();
    renderHook(() => usePolling(callback, 1000));
    act(() => vi.advanceTimersByTime(3000));
    expect(callback).toHaveBeenCalledTimes(4); // mount + 3 ticks
  });

  it('skips ticks while the tab is hidden', () => {
    const callback = vi.fn();
    renderHook(() => usePolling(callback, 1000));
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(5000));
    expect(callback).toHaveBeenCalledTimes(1); // only the initial call
  });

  it('fires immediately when the tab becomes visible again', () => {
    const callback = vi.fn();
    renderHook(() => usePolling(callback, 1000));
    setVisibility('hidden');
    act(() => vi.advanceTimersByTime(2000));
    expect(callback).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('clears the interval and listener on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => usePolling(callback, 1000));
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(callback).toHaveBeenCalledTimes(1); // only the initial call, nothing after unmount
  });

  it('always uses the latest callback without resetting the interval', () => {
    let count = 0;
    const first = () => {
      count += 1;
    };
    const second = () => {
      count += 100;
    };
    const { rerender } = renderHook(({ cb }) => usePolling(cb, 1000), {
      initialProps: { cb: first },
    });
    rerender({ cb: second });
    act(() => vi.advanceTimersByTime(1000));
    expect(count).toBe(101); // first's mount call (1) + second's tick (100)
  });
});
