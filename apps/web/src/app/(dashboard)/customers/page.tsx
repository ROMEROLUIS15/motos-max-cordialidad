'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';

interface Customer {
  id: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  phone: string;
  city: string;
  visitCount: number;
  isActive: boolean;
  deletedAt: string | null;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      const data = await fetchApi<PaginatedResponse<Customer>>(`/api/customers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(data.items);
      setTotal(data.total);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <Link
          href="/customers/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Nuevo cliente
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre, documento o teléfono..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Nombre', 'Documento', 'Teléfono', 'Ciudad', 'Visitas', 'Estado'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No se encontraron clientes</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/customers/${c.id}`} className="text-blue-600 hover:underline font-medium">
                    {c.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.documentType} {c.documentNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.phone}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.city}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.visitCount}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {c.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200">
          <span className="text-sm text-gray-500">{total} cliente(s) en total</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Anterior</button>
            <span className="px-3 py-1 text-sm">Página {page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={customers.length < 20} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  );
}
