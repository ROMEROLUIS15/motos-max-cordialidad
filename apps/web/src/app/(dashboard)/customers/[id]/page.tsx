'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';

interface CustomerProfile {
  customer: {
    id: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    phone: string;
    whatsappPhone: string | null;
    email: string | null;
    address: string | null;
    city: string;
    visitCount: number;
    isActive: boolean;
  };
  vehicles: Array<{
    id: string;
    plate: string;
    brand: string;
    model: string;
    year: number;
    color: string;
  }>;
  recentWorkOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    vehicle: { plate: string };
  }>;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    fetchApi<CustomerProfile>(`/api/customers/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(setProfile)
      .catch(() => router.push('/customers'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) return <div className="p-6 text-gray-500">Cargando...</div>;
  if (!profile) return null;

  const { customer, vehicles, recentWorkOrders } = profile;

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    WAITING_PARTS: 'bg-orange-100 text-orange-800',
    COMPLETED: 'bg-green-100 text-green-800',
    DELIVERED: 'bg-gray-100 text-gray-700',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/customers" className="text-gray-500 hover:text-gray-700 text-sm">
          ← Clientes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{customer.fullName}</h1>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${customer.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
        >
          {customer.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Datos del cliente</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32">Documento:</dt>
              <dd>
                {customer.documentType} {customer.documentNumber}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32">Teléfono:</dt>
              <dd>{customer.phone}</dd>
            </div>
            {customer.whatsappPhone && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-32">WhatsApp:</dt>
                <dd>{customer.whatsappPhone}</dd>
              </div>
            )}
            {customer.email && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-32">Email:</dt>
                <dd>{customer.email}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32">Ciudad:</dt>
              <dd>{customer.city}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-32">Visitas:</dt>
              <dd>{customer.visitCount}</dd>
            </div>
          </dl>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Vehículos ({vehicles.length})</h2>
            <Link
              href={`/receptions/new?customerId=${customer.id}`}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >
              Nueva recepción
            </Link>
          </div>
          {vehicles.length === 0 ? (
            <p className="text-sm text-gray-500">Sin vehículos registrados</p>
          ) : (
            <ul className="space-y-2">
              {vehicles.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{v.plate}</span>
                  <span className="text-gray-500">
                    {v.brand} {v.model} {v.year}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="font-semibold text-gray-800 mb-3">Órdenes recientes</h2>
        {recentWorkOrders.length === 0 ? (
          <p className="text-sm text-gray-500">Sin órdenes de trabajo</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase">
                <th className="pb-2">Número</th>
                <th className="pb-2">Vehículo</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentWorkOrders.map((wo) => (
                <tr key={wo.id} className="hover:bg-gray-50">
                  <td className="py-2">
                    <Link href={`/work-orders/${wo.id}`} className="text-blue-600 hover:underline">
                      {wo.orderNumber}
                    </Link>
                  </td>
                  <td className="py-2 text-gray-600">{wo.vehicle.plate}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[wo.status] ?? 'bg-gray-100'}`}
                    >
                      {wo.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-500">
                    {new Date(wo.createdAt).toLocaleDateString('es-CO')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
