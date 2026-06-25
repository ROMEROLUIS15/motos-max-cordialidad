'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';

interface VehicleHistory {
  vehicle: {
    id: string; plate: string; brand: string; model: string; year: number;
    color: string; engineNumber: string; currentOdometer: number | null;
    fuelType: string | null; observations: string | null;
  };
  workOrders: Array<{
    id: string; orderNumber: string; status: string; createdAt: string;
    promisedDeliveryAt: string; serviceType: string;
    parts: Array<{ quantity: number; unitPriceAtSale: string; part: { name: string; sku: string } }>;
    photoEvidences: Array<{ id: string; phase: string; filename: string }>;
  }>;
  ownershipHistory: Array<{ id: string; previousOwner: string; newOwner: string; transferredAt: string }>;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  WAITING_PARTS: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-green-100 text-green-800',
  DELIVERED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    fetchApi<VehicleHistory>(`/api/vehicles/${id}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(setHistory)
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>;
  if (!history) return null;

  const { vehicle, workOrders, ownershipHistory } = history;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">← Volver</button>
        <h1 className="text-2xl font-bold text-gray-900">{vehicle.plate}</h1>
        <span className="text-gray-500 text-lg">{vehicle.brand} {vehicle.model} {vehicle.year}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Datos básicos</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2"><dt className="text-gray-500 w-32">Placa:</dt><dd className="font-medium">{vehicle.plate}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500 w-32">Marca/Modelo:</dt><dd>{vehicle.brand} {vehicle.model}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500 w-32">Año:</dt><dd>{vehicle.year}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500 w-32">Color:</dt><dd>{vehicle.color}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500 w-32">Motor:</dt><dd>{vehicle.engineNumber}</dd></div>
            {vehicle.currentOdometer && <div className="flex gap-2"><dt className="text-gray-500 w-32">Odómetro:</dt><dd>{vehicle.currentOdometer.toLocaleString()} km</dd></div>}
            {vehicle.fuelType && <div className="flex gap-2"><dt className="text-gray-500 w-32">Combustible:</dt><dd>{vehicle.fuelType}</dd></div>}
          </dl>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Historial de propietarios</h2>
          {ownershipHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Sin transferencias registradas</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {ownershipHistory.map((h) => (
                <li key={h.id} className="text-gray-600">
                  {new Date(h.transferredAt).toLocaleDateString('es-CO')}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-gray-800 mb-4">Historial de servicios ({workOrders.length})</h2>
        {workOrders.length === 0 ? (
          <p className="text-sm text-gray-500">Sin órdenes de trabajo</p>
        ) : (
          <div className="space-y-4">
            {workOrders.map((wo) => (
              <div key={wo.id} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/work-orders/${wo.id}`} className="font-medium text-blue-600 hover:underline">
                    {wo.orderNumber}
                  </Link>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[wo.status] ?? 'bg-gray-100'}`}>
                    {wo.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(wo.createdAt).toLocaleDateString('es-CO')} · {wo.serviceType}
                </div>
                {wo.parts.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    Repuestos: {wo.parts.map((p) => `${p.part.name} (x${p.quantity})`).join(', ')}
                  </div>
                )}
                {wo.photoEvidences.length > 0 && (
                  <div className="mt-1 text-xs text-gray-400">{wo.photoEvidences.length} foto(s) adjunta(s)</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
