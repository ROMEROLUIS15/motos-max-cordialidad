import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ apiGet: vi.fn() }));
import { apiGet } from '@/lib/api';
import { useCustomerSearch } from '@/app/(dashboard)/receptions/new/_components/use-customer-search';

const mockApi = apiGet as unknown as ReturnType<typeof vi.fn>;

const customer = { id: 'c1', fullName: 'Juan Perez', documentNumber: '123', phone: '3001112233' };

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.mockResolvedValue({ items: [customer] });
});

describe('useCustomerSearch', () => {
  it('searches customers after the debounce delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCustomerSearch());

    act(() => result.current.setSearch('Juan'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.customers).toEqual([customer]);
    expect(mockApi).toHaveBeenCalledWith(expect.stringContaining('search=Juan'));
    vi.useRealTimers();
  });

  it('selecting a customer clears the search results and fills the search box with their name', () => {
    const { result } = renderHook(() => useCustomerSearch());

    act(() => result.current.selectCustomer(customer));

    expect(result.current.customer).toEqual(customer);
    expect(result.current.search).toBe('Juan Perez');
    expect(result.current.customers).toEqual([]);
  });

  it('does not search while a customer is already selected', async () => {
    const { result } = renderHook(() => useCustomerSearch());
    act(() => result.current.selectCustomer(customer));
    mockApi.mockClear();

    await waitFor(() => expect(mockApi).not.toHaveBeenCalled());
  });

  it('clearCustomer resets the customer, search and new-customer flag', () => {
    const { result } = renderHook(() => useCustomerSearch());
    act(() => result.current.selectCustomer(customer));
    act(() => result.current.clearCustomer());

    expect(result.current.customer).toBeNull();
    expect(result.current.search).toBe('');
  });

  describe('customerReady', () => {
    it('is true once an existing customer is selected', () => {
      const { result } = renderHook(() => useCustomerSearch());
      act(() => result.current.selectCustomer(customer));
      expect(result.current.customerReady).toBe(true);
    });

    it('is false for a new customer until all 4 fields are filled', () => {
      const { result } = renderHook(() => useCustomerSearch());
      act(() => result.current.setNewCustomer(true));
      expect(result.current.customerReady).toBe(false);

      act(() =>
        result.current.setCForm({
          fullName: 'Ana',
          documentNumber: '999',
          phone: '300',
          city: 'Bogota',
        }),
      );
      expect(result.current.customerReady).toBe(true);
    });
  });
});
