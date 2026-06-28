'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Receipt, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, fieldBase } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, TableRowsSkeleton } from '@/components/ui/states';

type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

interface SaleOrderItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  paymentMethod: 'CASH' | 'FINANCED';
  customerName: string;
  motorcycleLabel: string;
  createdAt: string;
}

interface AvailableUnit {
  id: string;
  brand: string;
  model: string;
  vin: string;
  salePrice: number;
}

interface Customer {
  id: string;
  fullName: string;
  documentNumber: string;
}

const PAGE_SIZE = 20;

const STATUS_META: Record<
  OrderStatus,
  { label: string; variant: 'warning' | 'success' | 'secondary' }
> = {
  DRAFT: { label: 'Borrador', variant: 'warning' },
  CONFIRMED: { label: 'Confirmada', variant: 'success' },
  CANCELLED: { label: 'Cancelada', variant: 'secondary' },
};

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function SaleOrdersPage() {
  const [orders, setOrders] = useState<SaleOrderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (statusFilter) params.set('status', statusFilter);
      const data = await apiGet<PaginatedResponse<SaleOrderItem>>(`/api/sale-orders?${params}`);
      setOrders(data.items);
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (order: SaleOrderItem, action: 'confirm' | 'cancel') => {
    setBusyId(order.id);
    try {
      await apiSend(`/api/sale-orders/${order.id}/${action}`, 'POST', {});
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const downloadContract = async (order: SaleOrderItem) => {
    setBusyId(order.id);
    setError(null);
    try {
      const { url } = await apiGet<{ url: string }>(`/api/sale-orders/${order.id}/contract`);
      window.open(url, '_blank', 'noopener');
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
        title="Órdenes de venta"
        description={
          total > 0
            ? `${total} venta${total === 1 ? '' : 's'} registradas`
            : 'Ventas de motocicletas'
        }
      >
        <Button onClick={() => setShowNew(true)}>
          <Plus /> Nueva venta
        </Button>
      </PageHeader>

      <div className="max-w-xs">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className={cn(fieldBase, 'cursor-pointer')}
        >
          <option value="">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['N°', 'Cliente', 'Moto', 'Total', 'Pago', 'Estado', ''].map((h, i) => (
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
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Receipt}
                      title={statusFilter ? 'Sin resultados' : 'Aún no hay ventas'}
                      description={
                        statusFilter
                          ? 'Ajusta el filtro.'
                          : 'Registra la primera venta de una moto.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/sales/orders/${o.id}`} className="text-primary hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{o.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.motorcycleLabel}</td>
                    <td className="tnum px-4 py-3 font-medium text-foreground">
                      {cop.format(o.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.paymentMethod === 'FINANCED' ? 'Financiado' : 'Contado'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_META[o.status].variant}>
                        {STATUS_META[o.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex justify-end gap-2">
                        {busyId === o.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : o.status === 'DRAFT' ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => void act(o, 'cancel')}>
                              Cancelar
                            </Button>
                            <Button size="sm" onClick={() => void act(o, 'confirm')}>
                              Confirmar
                            </Button>
                          </>
                        ) : o.status === 'CONFIRMED' ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void downloadContract(o)}
                            >
                              Contrato
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => void act(o, 'cancel')}>
                              Anular
                            </Button>
                          </>
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

      {showNew && (
        <NewSaleModal
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

function NewSaleModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [units, setUnits] = useState<AvailableUnit[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [unitId, setUnitId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('');
  const [method, setMethod] = useState<'CASH' | 'FINANCED'>('CASH');
  const [downPayment, setDownPayment] = useState('');
  const [months, setMonths] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<PaginatedResponse<AvailableUnit>>('/api/motorcycle-units?status=AVAILABLE&pageSize=100')
      .then((d) => setUnits(d.items))
      .catch(() => {});
    apiGet<PaginatedResponse<Customer>>('/api/customers?pageSize=100')
      .then((d) => setCustomers(d.items))
      .catch(() => {});
  }, []);

  const unit = units.find((u) => u.id === unitId);
  const total = unit ? unit.salePrice - (discount ? Number(discount) : 0) : 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/sale-orders', 'POST', {
        motorcycleUnitId: unitId,
        customerId,
        discount: discount ? Number(discount) : 0,
        paymentMethod: method,
        downPayment: method === 'FINANCED' && downPayment ? Number(downPayment) : 0,
        financingMonths: method === 'FINANCED' && months ? Number(months) : undefined,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const valid = unitId && customerId && (method === 'CASH' || Number(months) > 0);

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva venta"
      description="Crea una orden en borrador; luego confírmala para marcar la moto como vendida."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy || !valid} onClick={() => void submit()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Crear venta
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/90">Motocicleta (disponible)</label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className={cn(fieldBase, 'cursor-pointer')}
          >
            <option value="">Selecciona una moto…</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.brand} {u.model} · {u.vin} · {cop.format(u.salePrice)}
              </option>
            ))}
          </select>
          {units.length === 0 && (
            <p className="text-xs text-muted-foreground">No hay motos disponibles.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground/90">Cliente</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className={cn(fieldBase, 'cursor-pointer')}
          >
            <option value="">Selecciona un cliente…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} · {c.documentNumber}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/90">Descuento</label>
            <Input
              type="number"
              placeholder="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/90">Forma de pago</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'CASH' | 'FINANCED')}
              className={cn(fieldBase, 'cursor-pointer')}
            >
              <option value="CASH">Contado</option>
              <option value="FINANCED">Financiado</option>
            </select>
          </div>
        </div>

        {method === 'FINANCED' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/90">Cuota inicial</label>
              <Input
                type="number"
                placeholder="0"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/90">Meses</label>
              <Input
                type="number"
                placeholder="12"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </div>
          </div>
        )}

        {unit && (
          <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold text-foreground">{cop.format(total)}</span>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}
