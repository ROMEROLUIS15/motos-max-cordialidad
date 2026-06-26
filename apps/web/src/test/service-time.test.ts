import { describe, it, expect } from 'vitest';
import { formatDuration, computeServiceTime } from '@/lib/service-time';
import type { StatusHistoryEntry } from '@/types/workshop';

const T0 = new Date('2026-06-20T08:00:00Z').getTime();
const h = (n: number) => T0 + n * 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

function entry(
  previousStatus: StatusHistoryEntry['previousStatus'],
  newStatus: StatusHistoryEntry['newStatus'],
  at: number,
): StatusHistoryEntry {
  return {
    workOrderId: 'wo',
    previousStatus,
    newStatus,
    changedBy: 'u',
    note: null,
    changedAt: iso(at),
  };
}

describe('formatDuration', () => {
  it('rounds sub-minute to a friendly label', () => {
    expect(formatDuration(30_000)).toBe('menos de 1 min');
  });
  it('formats minutes', () => {
    expect(formatDuration(45 * 60_000)).toBe('45 min');
  });
  it('formats hours and minutes', () => {
    expect(formatDuration(2 * 3_600_000 + 30 * 60_000)).toBe('2 h 30 min');
  });
  it('drops minutes once days are present', () => {
    expect(formatDuration(86_400_000 + 3 * 3_600_000 + 20 * 60_000)).toBe('1 d 3 h');
  });
});

describe('computeServiceTime', () => {
  it('sums only IN_PROGRESS segments for active time, ignoring waits', () => {
    // PENDING -> IN_PROGRESS (h2) -> WAITING_PARTS (h5) -> IN_PROGRESS (h7) -> COMPLETED (h8) -> DELIVERED (h9)
    const history = [
      entry('PENDING', 'IN_PROGRESS', h(2)),
      entry('IN_PROGRESS', 'WAITING_PARTS', h(5)),
      entry('WAITING_PARTS', 'IN_PROGRESS', h(7)),
      entry('IN_PROGRESS', 'COMPLETED', h(8)),
      entry('COMPLETED', 'DELIVERED', h(9)),
    ];
    const r = computeServiceTime({ createdAt: iso(T0), status: 'DELIVERED' }, history, h(10));
    // active = (h5-h2) + (h8-h7) = 3h + 1h = 4h
    expect(r.activeMs).toBe(4 * 3_600_000);
    // total = first COMPLETED reached at h8 - created = 8h
    expect(r.totalMs).toBe(8 * 3_600_000);
    expect(r.ongoing).toBe(false);
  });

  it('treats an open order as ongoing and counts up to now', () => {
    const history = [entry('PENDING', 'IN_PROGRESS', h(1))];
    const r = computeServiceTime({ createdAt: iso(T0), status: 'IN_PROGRESS' }, history, h(4));
    expect(r.ongoing).toBe(true);
    expect(r.totalMs).toBe(4 * 3_600_000); // now - created
    expect(r.activeMs).toBe(3 * 3_600_000); // h1 -> now
  });

  it('handles an order with no IN_PROGRESS time', () => {
    const history = [entry(null, 'CANCELLED', h(1))];
    const r = computeServiceTime({ createdAt: iso(T0), status: 'CANCELLED' }, history, h(5));
    expect(r.activeMs).toBe(0);
    expect(r.ongoing).toBe(false);
  });
});
