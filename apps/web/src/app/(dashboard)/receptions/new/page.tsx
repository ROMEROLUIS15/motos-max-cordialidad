'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiSend, apiUpload } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { FUEL_LEVELS, FUEL_LABELS, type FuelLevel } from '@/types/workshop';

interface Customer {
  id: string;
  fullName: string;
  documentNumber: string;
  phone: string;
}
interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
}
interface Reception {
  id: string;
  branchId: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function NewReceptionPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 1: customer
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Step 2: vehicle
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');

  // Step 3: reception fields
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState<FuelLevel>('HALF');
  const [observations, setObservations] = useState('');
  const [damage, setDamage] = useState('');

  // After reception created
  const [reception, setReception] = useState<Reception | null>(null);
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);

  // Step 4: work order
  const [serviceType, setServiceType] = useState('');
  const [problem, setProblem] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [promised, setPromised] = useState('');

  useEffect(() => {
    if (!debounced) {
      setCustomers([]);
      return;
    }
    apiGet<PaginatedResponse<Customer>>(`/api/customers?search=${encodeURIComponent(debounced)}&pageSize=8`)
      .then((d) => setCustomers(d.items))
      .catch((e) => setError((e as Error).message));
  }, [debounced]);

  const selectCustomer = async (c: Customer) => {
    setCustomer(c);
    setCustomers([]);
    setSearch(c.fullName);
    try {
      const vs = await apiGet<Vehicle[]>(`/api/customers/${c.id}/vehicles`);
      setVehicles(vs);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createReception = async () => {
    if (!vehicleId || !odometer) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiSend<Reception>('/api/receptions', 'POST', {
        vehicleId,
        odometerReading: Number(odometer),
        fuelLevel: fuel,
        observations: observations || undefined,
        visibleDamageNotes: damage || undefined,
      });
      setReception(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadPhotos = async (files: FileList) => {
    if (!reception) return;
    const list = Array.from(files).slice(0, 10 - photos.length);
    setBusy(true);
    setError(null);
    try {
      for (const file of list) {
        await apiUpload(`/api/receptions/${reception.id}/photos`, file);
        setPhotos((p) => [...p, { name: file.name, url: URL.createObjectURL(file) }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createWorkOrder = async () => {
    if (!reception || !serviceType || !problem || !technicianId || !promised) return;
    setBusy(true);
    setError(null);
    try {
      const wo = await apiSend<{ id: string }>('/api/work-orders', 'POST', {
        receptionId: reception.id,
        technicianId,
        serviceType,
        problemDescription: problem,
        promisedDeliveryAt: new Date(promised).toISOString(),
      });
      router.push(`/work-orders/${wo.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Nueva recepción</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Step 1: customer */}
      <section className="bg-white rounded-lg shadow p-5">
        <h2 className="font-semibold text-gray-900 mb-3">1. Cliente</h2>
        <input
          placeholder="Buscar por nombre, documento o teléfono..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCustomer(null);
          }}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        {customers.length > 0 && (
          <ul className="mt-2 border border-gray-200 rounded-md divide-y">
            {customers.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => void selectCustomer(c)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {c.fullName} — {c.documentNumber} — {c.phone}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Step 2: vehicle */}
      {customer && (
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-900 mb-3">2. Vehículo</h2>
          {vehicles.length === 0 ? (
            <p className="text-sm text-gray-500">El cliente no tiene vehículos registrados.</p>
          ) : (
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Selecciona un vehículo</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.brand} {v.model}
                </option>
              ))}
            </select>
          )}
        </section>
      )}

      {/* Step 3: reception data */}
      {customer && vehicleId && !reception && (
        <section className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">3. Datos de recepción</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="text-gray-600">Odómetro</span>
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            <div className="text-sm">
              <span className="text-gray-600">Nivel de combustible</span>
              <div className="mt-1 flex gap-1">
                {FUEL_LEVELS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFuel(f)}
                    className={`flex-1 px-2 py-2 rounded text-xs border ${fuel === f ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}
                  >
                    {FUEL_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="block text-sm">
            <span className="text-gray-600">Observaciones</span>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              rows={2}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Daños visibles</span>
            <textarea
              value={damage}
              onChange={(e) => setDamage(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              rows={2}
            />
          </label>
          <button
            disabled={busy || !odometer}
            onClick={() => void createReception()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm disabled:opacity-40"
          >
            Guardar recepción
          </button>
        </section>
      )}

      {/* Step 3b: photos */}
      {reception && (
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Fotos de ingreso ({photos.length}/10)</h2>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) void uploadPhotos(e.dataTransfer.files);
            }}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-sm text-gray-500"
          >
            Arrastra imágenes aquí o
            <label className="ml-1 text-blue-600 cursor-pointer hover:underline">
              selecciona archivos
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                disabled={busy || photos.length >= 10}
                onChange={(e) => e.target.files && void uploadPhotos(e.target.files)}
              />
            </label>
          </div>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={p.url} alt={p.name} className="h-20 w-20 object-cover rounded border" />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Step 4: create work order */}
      {reception && (
        <section className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">4. Crear orden de trabajo</h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="text-gray-600">Tipo de servicio</span>
              <input
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-gray-600">Técnico (ID)</span>
              <input
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm col-span-2">
              <span className="text-gray-600">Entrega prometida</span>
              <input
                type="datetime-local"
                value={promised}
                onChange={(e) => setPromised(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm col-span-2">
              <span className="text-gray-600">Descripción del problema</span>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                rows={2}
              />
            </label>
          </div>
          <button
            disabled={busy || !serviceType || !problem || !technicianId || !promised}
            onClick={() => void createWorkOrder()}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm disabled:opacity-40"
          >
            Crear orden de trabajo
          </button>
        </section>
      )}
    </div>
  );
}
