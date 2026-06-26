'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Package, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import {
  type PartWithStock,
  MOVEMENT_TYPES,
  MOVEMENT_LABELS,
  type MovementType,
} from '@/types/inventory';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea, fieldBase } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, TableRowsSkeleton } from '@/components/ui/states';

interface Branch {
  id: string;
  name: string;
}

const PAGE_SIZE = 20;

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function StockCell({ part }: { part: PartWithStock }) {
  const out = part.stockDisponible <= 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          'tnum font-medium',
          out ? 'text-destructive' : part.lowStock ? 'text-warning' : 'text-foreground',
        )}
      >
        {part.stockDisponible}
      </span>
      {out ? (
        <Badge variant="destructive">Agotado</Badge>
      ) : part.lowStock ? (
        <Badge variant="warning">Bajo</Badge>
      ) : null}
    </span>
  );
}

export default function InventoryPage() {
  const [parts, setParts] = useState<PartWithStock[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movePart, setMovePart] = useState<PartWithStock | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
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
    apiGet<Branch[]>('/api/branches')
      .then(setBranches)
      .catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventario"
        description={
          total > 0
            ? `${total} repuesto${total === 1 ? '' : 's'} en catálogo`
            : 'Repuestos y niveles de stock'
        }
      >
        <Button onClick={() => setShowNew(true)}>
          <Plus /> Nuevo repuesto
        </Button>
      </PageHeader>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por nombre o SKU…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['SKU', 'Nombre', 'Categoría', 'Disponible', 'Físico', 'Reservado', ''].map(
                  (h, i) => (
                    <th
                      key={h || i}
                      className={cn(
                        'px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground',
                        i === 6 && 'text-right',
                      )}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowsSkeleton rows={6} cols={7} />
              ) : error ? (
                <tr>
                  <td colSpan={7}>
                    <ErrorState message={error} onRetry={() => void load()} />
                  </td>
                </tr>
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Package}
                      title={debounced ? 'Sin resultados' : 'Aún no hay repuestos'}
                      description={
                        debounced
                          ? 'Prueba con otro término.'
                          : 'Agrega el primer repuesto al catálogo.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                parts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3">
                      <StockCell part={p} />
                    </td>
                    <td className="tnum px-4 py-3 text-muted-foreground">{p.stockFisico}</td>
                    <td className="tnum px-4 py-3 text-muted-foreground">{p.stockReservado}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setMovePart(p)}>
                        Movimiento
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && parts.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Página {page} de {totalPages} · {total} en total
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

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
  const disabled =
    busy ||
    (type === 'adjust'
      ? !notes || newCount === ''
      : type === 'transfer'
        ? !toBranchId || !quantity
        : !quantity);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (type === 'entry')
        await apiSend('/api/stock/entry', 'POST', {
          partId: part.id,
          quantity: Number(quantity),
          notes,
        });
      else if (type === 'exit')
        await apiSend('/api/stock/exit', 'POST', {
          partId: part.id,
          quantity: Number(quantity),
          notes,
        });
      else if (type === 'adjust')
        await apiSend('/api/stock/adjust', 'POST', {
          partId: part.id,
          newPhysicalCount: Number(newCount),
          notes,
        });
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
    <Modal
      open
      onClose={onClose}
      title={`Movimiento · ${part.name}`}
      description={`Disponible actual: ${part.stockDisponible}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={disabled} onClick={() => void submit()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-secondary/40 p-1">
          {MOVEMENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                type === t
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {MOVEMENT_LABELS[t]}
            </button>
          ))}
        </div>

        {(type === 'entry' || type === 'exit' || type === 'transfer') && (
          <Input
            type="number"
            placeholder="Cantidad"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        )}
        {type === 'adjust' && (
          <>
            <Input
              type="number"
              placeholder="Nuevo conteo físico"
              value={newCount}
              onChange={(e) => setNewCount(e.target.value)}
            />
            {newCount !== '' && (
              <p className={cn('text-sm', difference >= 0 ? 'text-success' : 'text-destructive')}>
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
            className={cn(fieldBase, 'cursor-pointer')}
          >
            <option value="">Sucursal destino</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <Textarea
          placeholder={type === 'adjust' ? 'Justificación (obligatoria)' : 'Notas (opcional)'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}

function NewPartModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: '',
    unit: 'unidad',
    costPrice: '',
    salePrice: '',
    minStockAlert: '',
  });
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
    <Modal
      open
      onClose={onClose}
      title="Nuevo repuesto"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={busy || !form.sku || !form.name || !form.costPrice || !form.salePrice}
            onClick={() => void submit()}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Crear
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="SKU" value={form.sku} onChange={set('sku')} />
        <Input placeholder="Categoría" value={form.category} onChange={set('category')} />
        <Input
          className="col-span-2"
          placeholder="Nombre"
          value={form.name}
          onChange={set('name')}
        />
        <Input placeholder="Unidad" value={form.unit} onChange={set('unit')} />
        <Input
          placeholder="Stock mínimo"
          type="number"
          value={form.minStockAlert}
          onChange={set('minStockAlert')}
        />
        <Input
          placeholder="Precio costo"
          type="number"
          value={form.costPrice}
          onChange={set('costPrice')}
        />
        <Input
          placeholder="Precio venta"
          type="number"
          value={form.salePrice}
          onChange={set('salePrice')}
        />
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </Modal>
  );
}
