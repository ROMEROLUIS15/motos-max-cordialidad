'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import type { ServiceCatalogItem } from '@/types/inventory';

export default function ServiceCatalogPage() {
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [serviceType, setServiceType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ServiceCatalogItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (serviceType) params.set('serviceType', serviceType);
      const data = await apiGet<PaginatedResponse<ServiceCatalogItem>>(`/api/service-catalog?${params}`);
      setItems(data.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [serviceType]);

  useEffect(() => {
    void load();
  }, [load]);

  const deactivate = async (id: string) => {
    try {
      await apiSend(`/api/service-catalog/${id}/deactivate`, 'POST');
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de servicios</h1>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Nuevo servicio
        </button>
      </div>

      <input
        placeholder="Filtrar por tipo de servicio..."
        value={serviceType}
        onChange={(e) => setServiceType(e.target.value)}
        className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Nombre', 'Tipo', 'Horas est.', 'Precio sugerido', 'Estado', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Sin servicios
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{it.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{it.serviceType}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{it.estimatedHours}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {it.suggestedPrice.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${it.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {it.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => {
                        setEditing(it);
                        setShowForm(true);
                      }}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    {it.isActive && (
                      <button onClick={() => void deactivate(it.id)} className="text-sm text-red-600 hover:underline">
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ServiceFormModal
          item={editing}
          onClose={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ServiceFormModal({
  item,
  onClose,
  onDone,
}: {
  item: ServiceCatalogItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    serviceType: item?.serviceType ?? '',
    estimatedHours: item ? String(item.estimatedHours) : '',
    suggestedPrice: item ? String(item.suggestedPrice) : '',
    description: item?.description ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        serviceType: form.serviceType,
        estimatedHours: Number(form.estimatedHours),
        suggestedPrice: Number(form.suggestedPrice),
        description: form.description || undefined,
      };
      if (item) await apiSend(`/api/service-catalog/${item.id}`, 'PUT', body);
      else await apiSend('/api/service-catalog', 'POST', body);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{item ? 'Editar servicio' : 'Nuevo servicio'}</h2>
        <div className="space-y-3">
          <input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Tipo de servicio"
            value={form.serviceType}
            onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Horas estimadas"
              type="number"
              value={form.estimatedHours}
              onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Precio sugerido"
              type="number"
              value={form.suggestedPrice}
              onChange={(e) => setForm((f) => ({ ...f, suggestedPrice: e.target.value }))}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <textarea
            placeholder="Descripción (opcional)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
            Cancelar
          </button>
          <button
            disabled={busy || !form.name || !form.serviceType || !form.estimatedHours || !form.suggestedPrice}
            onClick={() => void submit()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm disabled:opacity-40"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
