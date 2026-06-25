'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import {
  WORK_ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_BADGE,
  type WorkOrder,
  type WorkOrderStatus,
} from '@/types/workshop';

function isNearDeadline(promisedDeliveryAt: string, status: WorkOrderStatus): boolean {
  if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(status)) return false;
  const threshold = Date.now() + 2 * 60 * 60 * 1000;
  return new Date(promisedDeliveryAt).getTime() <= threshold;
}

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<WorkOrderStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (status) params.set('status', status);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const data = await apiGet<PaginatedResponse<WorkOrder>>(`/api/work-orders?${params}`);
      setOrders(data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, status, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes de trabajo</h1>
        <Link
          href="/receptions/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Nueva orden
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as WorkOrderStatus | '');
            setPage(1);
          }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {WORK_ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Desde
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Hasta
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['N.º Orden', 'Servicio', 'Estado', 'Entrega prometida', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron órdenes
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const near = isNearDeadline(o.promisedDeliveryAt, o.status);
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/work-orders/${o.id}`} className="text-blue-600 hover:underline font-medium">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{o.serviceType}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm ${near ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                      {new Date(o.promisedDeliveryAt).toLocaleString('es-CO')}
                      {near && <span className="ml-2 text-xs">⏰ por vencer</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/work-orders/${o.id}`} className="text-sm text-blue-600 hover:underline">
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200">
          <span className="text-sm text-gray-500">{total} orden(es) en total</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-sm">Página {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={orders.length < 20}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
