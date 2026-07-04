import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
}

export interface MotoCatalogEntry {
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number | null;
}

export interface VehicleFormValues {
  brand: string;
  model: string;
  plate: string;
  color: string;
  year: string;
  engineNumber: string;
  displacement: string;
}

export interface ActiveOrder {
  id: string;
  orderNumber: string;
}

export interface UseVehiclePickerResult {
  vehicles: Vehicle[];
  vehicleId: string;
  setVehicleId: (id: string) => void;
  newVehicle: boolean;
  setNewVehicle: (value: boolean) => void;
  motoQuery: string;
  setMotoQuery: (value: string) => void;
  motoSuggestions: MotoCatalogEntry[];
  activeOrder: ActiveOrder | null;
  vForm: VehicleFormValues;
  setVForm: React.Dispatch<React.SetStateAction<VehicleFormValues>>;
  pickMoto: (e: MotoCatalogEntry) => void;
  vehicleReady: boolean;
}

const emptyVForm: VehicleFormValues = {
  brand: '',
  model: '',
  plate: '',
  color: '',
  year: '',
  engineNumber: '',
  displacement: '',
};

/** Owns everything about picking/registering the vehicle for a given (possibly absent) customer. */
export function useVehiclePicker(
  customerId: string | undefined,
  onError?: (message: string) => void,
): UseVehiclePickerResult {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [newVehicle, setNewVehicle] = useState(false);
  const [motoQuery, setMotoQuery] = useState('');
  const [motoSuggestions, setMotoSuggestions] = useState<MotoCatalogEntry[]>([]);
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [vForm, setVForm] = useState<VehicleFormValues>(emptyVForm);

  // Reset/reload the vehicle list whenever the selected customer changes.
  useEffect(() => {
    setVehicleId('');
    setNewVehicle(false);
    if (!customerId) {
      setVehicles([]);
      return;
    }
    let cancelled = false;
    apiGet<Vehicle[]>(`/api/customers/${customerId}/vehicles`)
      .then((v) => {
        if (!cancelled) setVehicles(v);
      })
      .catch(() => {
        if (!cancelled) onError?.('Error al cargar vehículos');
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, onError]);

  useEffect(() => {
    if (!motoQuery) {
      setMotoSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      apiGet<MotoCatalogEntry[]>(
        `/api/motorcycle-catalog?search=${encodeURIComponent(motoQuery)}&limit=10`,
      )
        .then(setMotoSuggestions)
        .catch(() => setMotoSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [motoQuery]);

  useEffect(() => {
    if (newVehicle || !vehicleId) {
      setActiveOrder(null);
      return;
    }
    let cancelled = false;
    apiGet<{ workOrders: Array<{ id: string; orderNumber: string; status: string }> }>(
      `/api/vehicles/${vehicleId}/history`,
    )
      .then((h) => {
        if (cancelled) return;
        const active = h.workOrders.find(
          (w) => !['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(w.status),
        );
        setActiveOrder(active ? { id: active.id, orderNumber: active.orderNumber } : null);
      })
      .catch(() => {
        if (!cancelled) setActiveOrder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, newVehicle]);

  const pickMoto = (e: MotoCatalogEntry) => {
    setVForm((f) => ({ ...f, brand: e.brand, model: e.model }));
    setMotoQuery('');
    setMotoSuggestions([]);
  };

  const vehicleReady =
    (!!vehicleId && !newVehicle && !activeOrder) ||
    (newVehicle &&
      !!vForm.brand &&
      !!vForm.model &&
      !!vForm.plate &&
      !!vForm.color &&
      !!vForm.engineNumber);

  return {
    vehicles,
    vehicleId,
    setVehicleId,
    newVehicle,
    setNewVehicle,
    motoQuery,
    setMotoQuery,
    motoSuggestions,
    activeOrder,
    vForm,
    setVForm,
    pickMoto,
    vehicleReady,
  };
}
