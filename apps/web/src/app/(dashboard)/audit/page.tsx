'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';

interface AuditEntry {
  id: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '30' });
      if (entityType) params.set('entityType', entityType);
      if (action) params.set('action', action);
      const data = await apiGet<PaginatedResponse<AuditEntry>>(`/api/audit?${params}`);
      setItems(data.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Auditoría</h1>
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Tipo de entidad"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todas las acciones</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600">
          {error.includes('permission') || error.includes('403') ? 'Solo el propietario (OWNER) puede ver la auditoría.' : error}
        </p>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Fecha', 'Acción', 'Entidad', 'ID', 'Usuario', 'IP'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
                  Sin registros
                </td>
              </tr>
            ) : (
              items.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 text-sm">
                  <td className="px-4 py-2 text-gray-600">{new Date(e.createdAt).toLocaleString('es-CO')}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{e.action}</td>
                  <td className="px-4 py-2 text-gray-600">{e.entityType}</td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">{e.entityId}</td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">{e.actorUserId}</td>
                  <td className="px-4 py-2 text-gray-400">{e.ipAddress}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 flex justify-end gap-2 border-t border-gray-200">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-40">
            Anterior
          </button>
          <span className="px-3 py-1 text-sm">Página {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={items.length < 30} className="px-3 py-1 text-sm border rounded disabled:opacity-40">
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
