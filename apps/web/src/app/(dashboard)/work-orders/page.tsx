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
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import {
  WORK_ORDER_STATUSES,
  STATUS_LABELS,
  type WorkOrder,
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
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<WorkOrderStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
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
        <div className="-mb-px flex items-center gap-1 overflow-x-auto">
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
                  'relative whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pb-2">
          <input
            type="date"
            aria-label="Desde"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className={cn(fieldBase, 'h-8 w-auto cursor-pointer text-xs')}
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            aria-label="Hasta"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className={cn(fieldBase, 'h-8 w-auto cursor-pointer text-xs')}
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
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['N.º Orden', 'Servicio', 'Estado', 'Entrega prometida', ''].map((h, i) => (
                  <th
                    key={h || i}
                    className={cn(
                      'px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground',
                      i === 4 && 'text-right',
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
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <Skeleton
                          className="h-4"
                          style={{ width: `${[40, 70, 50, 80, 30][j]}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14">
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
                  <td colSpan={5} className="px-4 py-14">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <ClipboardList className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-medium">
                        {status || hasDateFilter
                          ? 'Sin órdenes para este filtro'
                          : 'Aún no hay órdenes'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {status || hasDateFilter
                          ? 'Prueba con otro estado o limpia las fechas.'
                          : 'Crea la primera desde una recepción.'}
                      </p>
                      {!status && !hasDateFilter && (
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
                      <td className="px-4 py-3 font-medium text-primary">{o.orderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.serviceType}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-right">
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
    </div>
  );
}
