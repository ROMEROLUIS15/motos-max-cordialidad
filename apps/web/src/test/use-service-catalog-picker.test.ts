import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ apiGet: vi.fn() }));
import { apiGet } from '@/lib/api';
import { useServiceCatalogPicker } from '@/app/(dashboard)/receptions/new/_components/use-service-catalog-picker';

const mockApi = apiGet as unknown as ReturnType<typeof vi.fn>;

const svc = {
  id: 's1',
  name: 'Cambio de aceite',
  suggestedPrice: 35000,
  serviceType: 'MAINTENANCE',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.mockResolvedValue({ items: [svc] });
});

describe('useServiceCatalogPicker', () => {
  it('searches the catalog after the debounce delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useServiceCatalogPicker());

    act(() => result.current.setSvcQuery('cambio'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(result.current.svcSuggestions).toEqual([svc]);
    vi.useRealTimers();
  });

  it('adds a service once, clearing the search, and ignores a duplicate add', () => {
    const { result } = renderHook(() => useServiceCatalogPicker());

    act(() => result.current.addService(svc));
    expect(result.current.services).toEqual([
      { id: 's1', name: 'Cambio de aceite', price: '35000' },
    ]);
    expect(result.current.svcQuery).toBe('');

    act(() => result.current.addService(svc));
    expect(result.current.services).toHaveLength(1);
  });

  it('updates a service price by index without touching the others', () => {
    const { result } = renderHook(() => useServiceCatalogPicker());
    act(() => result.current.addService(svc));
    act(() => result.current.addService({ ...svc, id: 's2', name: 'Frenos' }));

    act(() => result.current.updateServicePrice(1, '50000'));

    expect(result.current.services[0].price).toBe('35000');
    expect(result.current.services[1].price).toBe('50000');
  });

  it('removes a service by index', () => {
    const { result } = renderHook(() => useServiceCatalogPicker());
    act(() => result.current.addService(svc));
    act(() => result.current.removeService(0));
    expect(result.current.services).toEqual([]);
  });
});
