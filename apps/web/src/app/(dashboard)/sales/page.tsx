'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Bike, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea, fieldBase } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, TableRowsSkeleton } from '@/components/ui/states';

type MotorcycleStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD';
type MotorcycleCondition = 'NEW' | 'USED';

interface MotorcycleUnit {
  id: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  displacement: number | null;
  color: string | null;
  condition: MotorcycleCondition;
  mileage: number;
  plate: string | null;
  costPrice: number;
  salePrice: number;
  status: MotorcycleStatus;
}

const PAGE_SIZE = 20;

const STATUS_META: Record<
  MotorcycleStatus,
  { label: string; variant: 'success' | 'warning' | 'secondary' }
> = {
  AVAILABLE: { label: 'Disponible', variant: 'success' },
  RESERVED: { label: 'Reservada', variant: 'warning' },
  SOLD: { label: 'Vendida', variant: 'secondary' },
};

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function SalesPage() {
  const [units, setUnits] = useState<MotorcycleUnit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (debounced) params.set('search', debounced);
      if (statusFilter) params.set('status', statusFilter);
      if (conditionFilter) params.set('condition', conditionFilter);
      const data = await apiGet<PaginatedResponse<MotorcycleUnit>>(
        `/api/motorcycle-units?${params}`,
      );
      setUnits(data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, debounced, statusFilter, conditionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (unit: MotorcycleUnit, status: MotorcycleStatus) => {
    setBusyId(unit.id);
    try {
      await apiSend(`/api/motorcycle-units/${unit.id}/status`, 'PATCH', { status });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Venta de motocicletas"
        description={
          total > 0
            ? `${total} unidad${total === 1 ? '' : 'es'} en inventario`
            : 'Inventario de motos para venta'
        }
      >
        <Button onClick={() => setShowNew(true)}>
          <Plus /> Nueva moto
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por marca, modelo, VIN o placa…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className={cn(fieldBase, 'cursor-pointer sm:w-44')}
        >
          <option value="">Todos los estados</option>
          <option value="AVAILABLE">Disponible</option>
          <option value="RESERVED">Reservada</option>
          <option value="SOLD">Vendida</option>
        </select>
        <select
          value={conditionFilter}
          onChange={(e) => {
            setConditionFilter(e.target.value);
            setPage(1);
          }}
          className={cn(fieldBase, 'cursor-pointer sm:w-36')}
        >
          <option value="">Nueva/Usada</option>
          <option value="NEW">Nueva</option>
          <option value="USED">Usada</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Moto', 'VIN', 'Año', 'Condición', 'Precio', 'Estado', ''].map((h, i) => (
                  <th
                    key={h || i}
                    className={cn(
                      'px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground',
                      i === 6 && 'text-right',
                    )}
                  >
                    {h}
                  </th>
                ))}
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
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Bike}
                      title={
                        debounced || statusFilter || conditionFilter
                          ? 'Sin resultados'
                          : 'Aún no hay motos'
                      }
                      description={
                        debounced || statusFilter || conditionFilter
                          ? 'Ajusta los filtros de búsqueda.'
                          : 'Registra la primera moto del inventario.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                units.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {u.brand} {u.model}
                      {u.color ? <span className="text-muted-foreground"> · {u.color}</span> : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.vin}</td>
                    <td className="tnum px-4 py-3 text-muted-foreground">{u.year}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.condition === 'NEW' ? 'default' : 'outline'}>
                        {u.condition === 'NEW'
                          ? 'Nueva'
                          : `Usada · ${u.mileage.toLocaleString('es-CO')} km`}
                      </Badge>
                    </td>
                    <td className="tnum px-4 py-3 font-medium text-foreground">
                      {cop.format(u.salePrice)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_META[u.status].variant}>
                        {STATUS_META[u.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex justify-end gap-2">
                        {busyId === u.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : u.status === 'AVAILABLE' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void changeStatus(u, 'RESERVED')}
                          >
                            Reservar
                          </Button>
                        ) : u.status === 'RESERVED' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void changeStatus(u, 'AVAILABLE')}
                          >
                            Liberar
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && units.length > 0 && (
          <div className="flex flex-col items-center gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-between">
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

      {showNew && (
        <NewMotorcycleModal
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

function NewMotorcycleModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    vin: '',
    brand: '',
    model: '',
    year: String(new Date().getFullYear()),
    displacement: '',
    color: '',
    condition: 'NEW' as MotorcycleCondition,
    mileage: '',
    plate: '',
    costPrice: '',
    salePrice: '',
    description: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/motorcycle-units', 'POST', {
        vin: form.vin,
        brand: form.brand,
        model: form.model,
        year: Number(form.year),
        displacement: form.displacement ? Number(form.displacement) : undefined,
        color: form.color || undefined,
        condition: form.condition,
        mileage: form.condition === 'USED' && form.mileage ? Number(form.mileage) : 0,
        plate: form.plate || undefined,
        costPrice: Number(form.costPrice),
        salePrice: Number(form.salePrice),
        description: form.description || undefined,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const valid =
    form.vin && form.brand && form.model && form.year && form.costPrice && form.salePrice;

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva moto"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy || !valid} onClick={() => void submit()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Registrar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          className="sm:col-span-2"
          placeholder="VIN / Chasis"
          value={form.vin}
          onChange={set('vin')}
        />
        <Input placeholder="Marca" value={form.brand} onChange={set('brand')} />
        <Input placeholder="Modelo" value={form.model} onChange={set('model')} />
        <Input placeholder="Año" type="number" value={form.year} onChange={set('year')} />
        <Input
          placeholder="Cilindraje (cc)"
          type="number"
          value={form.displacement}
          onChange={set('displacement')}
        />
        <Input placeholder="Color" value={form.color} onChange={set('color')} />
        <select
          value={form.condition}
          onChange={set('condition')}
          className={cn(fieldBase, 'cursor-pointer')}
        >
          <option value="NEW">Nueva</option>
          <option value="USED">Usada</option>
        </select>
        {form.condition === 'USED' && (
          <>
            <Input
              placeholder="Kilometraje"
              type="number"
              value={form.mileage}
              onChange={set('mileage')}
            />
            <Input placeholder="Placa" value={form.plate} onChange={set('plate')} />
          </>
        )}
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
        <Textarea
          className="sm:col-span-2"
          placeholder="Descripción (opcional)"
          value={form.description}
          onChange={set('description')}
          rows={2}
        />
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </Modal>
  );
}
