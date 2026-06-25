'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { type PartWithStock, MOVEMENT_TYPES, MOVEMENT_LABELS, type MovementType } from '@/types/inventory';

interface Branch {
  id: string;
  name: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function InventoryPage() {
  const [parts, setParts] = useState<PartWithStock[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movePart, setMovePart] = useState<PartWithStock | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (debounced) params.set('search', debounced);
      const data = await apiGet<PaginatedResponse<PartWithStock>>(`/api/parts?${params}`);
      setParts(data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    apiGet<Branch[]>('/api/branches').then(setBranches).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <button
          onClick={() => setShowNew(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Nuevo repuesto
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nombre o SKU..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm mb-4"
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['SKU', 'Nombre', 'Categoría', 'Disponible', 'Físico', 'Reservado', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            ) : parts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron repuestos
                </td>
              </tr>
            ) : (
              parts.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">{p.sku}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.category}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={p.lowStock ? 'text-red-600 font-semibold' : 'text-gray-800'}>
                      {p.stockDisponible}
                      {p.lowStock && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">
                          bajo
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.stockFisico}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{p.stockReservado}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setMovePart(p)} className="text-sm text-blue-600 hover:underline">
                      Movimiento
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200">
          <span className="text-sm text-gray-500">{total} repuesto(s)</span>
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
              disabled={parts.length < 20}
              className="px-3 py-1 text-sm border rounded disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {movePart && (
        <MovementModal
          part={movePart}
          branches={branches}
          onClose={() => setMovePart(null)}
          onDone={() => {
            setMovePart(null);
            void load();
          }}
        />
      )}
      {showNew && (
        <NewPartModal
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function MovementModal({
  part,
  branches,
  onClose,
  onDone,
}: {
  part: PartWithStock;
  branches: Branch[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<MovementType>('entry');
  const [quantity, setQuantity] = useState('');
  const [newCount, setNewCount] = useState('');
  const [notes, setNotes] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const difference = newCount !== '' ? Number(newCount) - part.stockFisico : 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (type === 'entry') await apiSend('/api/stock/entry', 'POST', { partId: part.id, quantity: Number(quantity), notes });
      else if (type === 'exit') await apiSend('/api/stock/exit', 'POST', { partId: part.id, quantity: Number(quantity), notes });
      else if (type === 'adjust')
        await apiSend('/api/stock/adjust', 'POST', { partId: part.id, newPhysicalCount: Number(newCount), notes });
      else
        await apiSend('/api/stock/transfer', 'POST', {
          partId: part.id,
          toBranchId,
          quantity: Number(quantity),
          notes,
        });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
        <h2 className="text-lg font-semibold text-gray-900">Movimiento — {part.name}</h2>
        <p className="text-sm text-gray-500 mb-4">Disponible actual: {part.stockDisponible}</p>

        <div className="flex gap-1 mb-4">
          {MOVEMENT_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 px-2 py-1.5 rounded text-sm border ${type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}
            >
              {MOVEMENT_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {(type === 'entry' || type === 'exit' || type === 'transfer') && (
            <input
              type="number"
              placeholder="Cantidad"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          )}
          {type === 'adjust' && (
            <>
              <input
                type="number"
                placeholder="Nuevo conteo físico"
                value={newCount}
                onChange={(e) => setNewCount(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              {newCount !== '' && (
                <p className={`text-sm ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Diferencia: {difference >= 0 ? '+' : ''}
                  {difference} ({difference >= 0 ? 'ganancia' : 'merma'})
                </p>
              )}
            </>
          )}
          {type === 'transfer' && (
            <select
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Sucursal destino</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <textarea
            placeholder={type === 'adjust' ? 'Justificación (obligatoria)' : 'Notas (opcional)'}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
            disabled={busy || (type === 'adjust' ? !notes || newCount === '' : type === 'transfer' ? !toBranchId || !quantity : !quantity)}
            onClick={() => void submit()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function NewPartModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ sku: '', name: '', category: '', unit: 'unidad', costPrice: '', salePrice: '', minStockAlert: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/parts', 'POST', {
        sku: form.sku,
        name: form.name,
        category: form.category,
        unit: form.unit,
        costPrice: Number(form.costPrice),
        salePrice: Number(form.salePrice),
        minStockAlert: form.minStockAlert ? Number(form.minStockAlert) : undefined,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nuevo repuesto</h2>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="SKU" value={form.sku} onChange={set('sku')} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Categoría" value={form.category} onChange={set('category')} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Nombre" value={form.name} onChange={set('name')} className="col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Unidad" value={form.unit} onChange={set('unit')} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Stock mínimo" type="number" value={form.minStockAlert} onChange={set('minStockAlert')} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Precio costo" type="number" value={form.costPrice} onChange={set('costPrice')} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Precio venta" type="number" value={form.salePrice} onChange={set('salePrice')} className="border border-gray-300 rounded-md px-3 py-2 text-sm" />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
            Cancelar
          </button>
          <button
            disabled={busy || !form.sku || !form.name || !form.costPrice || !form.salePrice}
            onClick={() => void submit()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm disabled:opacity-40"
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}
