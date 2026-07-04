import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ apiGet: vi.fn() }));
import { apiGet } from '@/lib/api';
import { useVehiclePicker } from '@/app/(dashboard)/receptions/new/_components/use-vehicle-picker';

const mockApi = apiGet as unknown as ReturnType<typeof vi.fn>;

const vehicle = { id: 'v1', plate: 'ABC123', brand: 'Yamaha', model: 'FZ' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useVehiclePicker', () => {
  it('loads the customer vehicles when a customerId is provided', async () => {
    mockApi.mockResolvedValueOnce([vehicle]);
    const { result } = renderHook(() => useVehiclePicker('cust-1'));

    await waitFor(() => expect(result.current.vehicles).toEqual([vehicle]));
    expect(mockApi).toHaveBeenCalledWith('/api/customers/cust-1/vehicles');
  });

  it('resets to an empty vehicle list when there is no customer', () => {
    const { result } = renderHook(() => useVehiclePicker(undefined));
    expect(result.current.vehicles).toEqual([]);
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('reports the load error via onError without throwing', async () => {
    mockApi.mockRejectedValueOnce(new Error('network down'));
    const onError = vi.fn();
    renderHook(() => useVehiclePicker('cust-1', onError));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Error al cargar vehículos'));
  });

  it('searches the motorcycle catalog after the debounce and pickMoto fills brand/model', async () => {
    vi.useFakeTimers();
    const entry = { brand: 'Yamaha', model: 'XTZ150', yearFrom: 2016, yearTo: null };
    mockApi.mockImplementation((path: string) =>
      path.includes('motorcycle-catalog') ? Promise.resolve([entry]) : Promise.resolve([]),
    );
    const { result } = renderHook(() => useVehiclePicker(undefined));

    act(() => result.current.setMotoQuery('Yamaha'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(result.current.motoSuggestions).toEqual([entry]);

    act(() => result.current.pickMoto(entry));
    expect(result.current.vForm.brand).toBe('Yamaha');
    expect(result.current.vForm.model).toBe('XTZ150');
    expect(result.current.motoQuery).toBe('');
    vi.useRealTimers();
  });

  it('flags an existing vehicle as not-ready while it has an active order', async () => {
    mockApi.mockImplementation((path: string) =>
      path.includes('/history')
        ? Promise.resolve({
            workOrders: [{ id: 'wo-1', orderNumber: 'WO-1', status: 'IN_PROGRESS' }],
          })
        : Promise.resolve([vehicle]),
    );
    const { result } = renderHook(() => useVehiclePicker('cust-1'));
    await waitFor(() => expect(result.current.vehicles).toEqual([vehicle]));

    act(() => result.current.setVehicleId('v1'));
    await waitFor(() =>
      expect(result.current.activeOrder).toEqual({ id: 'wo-1', orderNumber: 'WO-1' }),
    );
    expect(result.current.vehicleReady).toBe(false);
  });

  it('is ready for a new vehicle once brand/model/plate/color/engineNumber are filled', () => {
    const { result } = renderHook(() => useVehiclePicker(undefined));
    act(() => result.current.setNewVehicle(true));
    expect(result.current.vehicleReady).toBe(false);

    act(() =>
      result.current.setVForm({
        brand: 'Yamaha',
        model: 'FZ',
        plate: 'ABC123',
        color: 'Rojo',
        year: '',
        engineNumber: 'ENG1',
        displacement: '',
      }),
    );
    expect(result.current.vehicleReady).toBe(true);
  });

  it('is not ready for a new vehicle when engineNumber is missing', () => {
    const { result } = renderHook(() => useVehiclePicker(undefined));
    act(() => result.current.setNewVehicle(true));
    act(() =>
      result.current.setVForm({
        brand: 'Yamaha',
        model: 'FZ',
        plate: 'ABC123',
        color: 'Rojo',
        year: '',
        engineNumber: '',
        displacement: '',
      }),
    );
    expect(result.current.vehicleReady).toBe(false);
  });
});
