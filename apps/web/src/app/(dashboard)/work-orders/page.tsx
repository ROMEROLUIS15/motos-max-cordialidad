'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  ClipboardList,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Search,
  X,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import {
  WORK_ORDER_STATUSES,
  STATUS_LABELS,
  type WorkOrderListItem,
  type WorkOrderStatus,
} from '@/types/workshop';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { fieldBase } from '@/components/ui/input';

const PAGE_SIZE = 20;

const STATUS_TABS: { value: WorkOrderStatus | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  ...WORK_ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

function isNearDeadline(promisedDeliveryAt: string, status: WorkOrderStatus): boolean {
  if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(status)) return false;
  return new Date(promisedDeliveryAt).getTime() <= Date.now() + 2 * 60 * 60 * 1000;
}

/** Fecha de entrega humanizada: "en 45 min", "Hoy 14:30", "Mañana 09:00", "12 jul 14:30". */
function humanDeadline(s: string): string {
  const d = new Date(s);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  if (Math.abs(diff) < 60 * 60 * 1000) {
    const mins = Math.round(diff / 60000);
    return mins >= 0 ? `en ${mins} min` : `hace ${-mins} min`;
  }
  const sameDay = d.toDateString() === now.toDateString();
  const tmr = new Date(now);
  tmr.setDate(now.getDate() + 1);
  if (sameDay) return `Hoy ${time}`;
  if (d.toDateString() === tmr.toDateString()) return `Mañana ${time}`;
  return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} ${time}`;
}

export default function WorkOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<WorkOrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<WorkOrderStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce de la búsqueda: espera a que el usuario deje de teclear.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (search) params.set('search', search);
      const data = await apiGet<PaginatedResponse<WorkOrderListItem>>(`/api/work-orders?${params}`);
      setOrders(data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, status, from, to, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasDateFilter = Boolean(from || to);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Órdenes de trabajo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0
              ? `${total} orden${total === 1 ? '' : 'es'} en total`
              : 'Gestión del flujo del taller'}
          </p>
        </div>
        <Link href="/receptions/new" className={cn(buttonVariants(), 'shrink-0')}>
          <Plus /> Nueva orden
        </Link>
      </div>

      {/* Tabs de estado (estilo GitHub) + filtro de fechas */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div className="flex w-full flex-wrap items-center justify-center gap-1.5 pb-2 sm:w-auto sm:justify-start">
          {STATUS_TABS.map((t) => {
            const active = status === t.value;
            return (
              <button
                key={t.value || 'all'}
                type="button"
                onClick={() => {
                  setStatus(t.value);
                  setPage(1);
                }}
                className={cn(
                  'whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-all hover:shadow-sm',
                  active
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:bg-secondary hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 pb-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              aria-label="Buscar por cliente, moto o N.º de orden"
              placeholder="Buscar cliente, moto o N.º…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={cn(fieldBase, 'h-8 w-full pl-8 pr-7 text-xs')}
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <input
            type="date"
            aria-label="Desde"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className={cn(fieldBase, 'h-8 w-full cursor-pointer text-xs sm:w-auto')}
          />
          <span className="hidden text-xs text-muted-foreground sm:inline">→</span>
          <input
            type="date"
            aria-label="Hasta"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className={cn(fieldBase, 'h-8 w-full cursor-pointer text-xs sm:w-auto')}
          />
          {hasDateFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom('');
                setTo('');
                setPage(1);
              }}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="rtable w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {[
                  'N.º Orden',
                  'Cliente',
                  'Moto',
                  'Servicio',
                  'Estado',
                  'Entrega prometida',
                  '',
                ].map((h, i) => (
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
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <Skeleton
                          className="h-4"
                          style={{ width: `${[40, 70, 60, 55, 50, 80, 30][j]}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-medium">No se pudieron cargar las órdenes</p>
                      <p className="font-mono text-xs text-muted-foreground/70">{error}</p>
                      <Button variant="outline" size="sm" onClick={() => void load()}>
                        <RotateCw className="h-4 w-4" /> Reintentar
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-14">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <ClipboardList className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-medium">
                        {status || hasDateFilter || search
                          ? 'Sin órdenes para este filtro'
                          : 'Aún no hay órdenes'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {search
                          ? `Ninguna orden coincide con “${search}”.`
                          : status || hasDateFilter
                            ? 'Prueba con otro estado o limpia las fechas.'
                            : 'Crea la primera desde una recepción.'}
                      </p>
                      {!status && !hasDateFilter && !search && (
                        <Link
                          href="/receptions/new"
                          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                        >
                          <Plus className="h-4 w-4" /> Nueva orden
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const near = isNearDeadline(o.promisedDeliveryAt, o.status);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => router.push(`/work-orders/${o.id}`)}
                      className="group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-secondary/50"
                    >
                      <td data-label="N.º Orden" className="px-4 py-3 font-medium text-primary">
                        {o.orderNumber}
                      </td>
                      <td data-label="Cliente" className="px-4 py-3 text-foreground/90">
                        {o.customerName || '—'}
                      </td>
                      <td data-label="Moto" className="px-4 py-3 text-muted-foreground">
                        {o.vehiclePlate || o.vehicleBrand ? (
                          <span className="inline-flex flex-col leading-tight">
                            <span className="font-medium text-foreground/90">
                              {o.vehiclePlate || '—'}
                            </span>
                            {(o.vehicleBrand || o.vehicleModel) && (
                              <span className="text-xs text-muted-foreground">
                                {`${o.vehicleBrand} ${o.vehicleModel}`.trim()}
                              </span>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Servicio" className="px-4 py-3 text-muted-foreground">
                        {o.serviceType}
                      </td>
                      <td data-label="Estado" className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td data-label="Entrega" className="px-4 py-3">
                        <span
                          className={cn(
                            'tnum inline-flex items-center gap-1.5',
                            near ? 'font-medium text-warning' : 'text-foreground/90',
                          )}
                        >
                          {near && <Clock className="h-3.5 w-3.5" />}
                          {humanDeadline(o.promisedDeliveryAt)}
                        </span>
                      </td>
                      <td data-label="" className="px-4 py-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pie / paginación */}
        {!loading && !error && orders.length > 0 && (
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
    </div>
  );
}
