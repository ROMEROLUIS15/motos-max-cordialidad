'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, FileText, Loader2, Plus } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, fieldBase } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';

type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  salePrice: number;
  discount: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'FINANCED';
  downPayment: number;
  financingMonths: number | null;
  contractR2Key: string | null;
  notes: string | null;
  customerName: string;
  motorcycleLabel: string;
}
interface Payment {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
}
interface PaymentsResponse {
  payments: Payment[];
  total: number;
  paid: number;
  balance: number;
}

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
const STATUS: Record<OrderStatus, { label: string; variant: 'warning' | 'success' | 'secondary' }> =
  {
    DRAFT: { label: 'Borrador', variant: 'warning' },
    CONFIRMED: { label: 'Confirmada', variant: 'success' },
    CANCELLED: { label: 'Cancelada', variant: 'secondary' },
  };
const METHODS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  FINANCING: 'Financiación',
  OTHER: 'Otro',
};

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium text-foreground">{v}</span>
    </div>
  );
}

export default function SaleOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [pay, setPay] = useState<PaymentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [o, p] = await Promise.all([
        apiGet<OrderDetail>(`/api/sale-orders/${id}`),
        apiGet<PaymentsResponse>(`/api/sale-orders/${id}/payments`),
      ]);
      setOrder(o);
      setPay(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadContract = async () => {
    setBusy(true);
    try {
      const { url } = await apiGet<{ url: string }>(`/api/sale-orders/${id}/contract`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const recordPayment = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/sale-orders/${id}/payments`, 'POST', {
        amount: Number(amount),
        method,
        reference: reference.trim() || undefined,
      });
      setAmount('');
      setReference('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !order) {
    return (
      <div className="space-y-4">
        <Link
          href="/sales/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Órdenes de venta
        </Link>
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    );
  }

  if (!order || !pay) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40 rounded" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const canPay = order.status !== 'CANCELLED' && pay.balance > 0;
  const progress = pay.total > 0 ? Math.min(100, (pay.paid / pay.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        href="/sales/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Órdenes de venta
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">{order.customerName}</p>
        </div>
        <Badge variant={STATUS[order.status].variant}>{STATUS[order.status].label}</Badge>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Detalle de la venta</CardTitle>
        </CardHeader>
        <CardContent>
          <Row k="Cliente" v={order.customerName} />
          <Row k="Moto" v={order.motorcycleLabel} />
          <Row k="Precio" v={cop.format(order.salePrice)} />
          {order.discount > 0 && <Row k="Descuento" v={`- ${cop.format(order.discount)}`} />}
          <Row k="Total" v={<span className="text-base">{cop.format(order.totalAmount)}</span>} />
          <Row
            k="Forma de pago"
            v={
              order.paymentMethod === 'FINANCED'
                ? `Financiado · inicial ${cop.format(order.downPayment)} · ${order.financingMonths ?? 0} meses`
                : 'Contado'
            }
          />
          {order.notes && <Row k="Notas" v={order.notes} />}
          {order.status === 'CONFIRMED' && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void downloadContract()}
              >
                <FileText className="h-4 w-4" /> Descargar contrato
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-success" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Pagado <span className="font-medium text-foreground">{cop.format(pay.paid)}</span>
              </span>
              <span className="text-muted-foreground">
                Saldo{' '}
                <span
                  className={cn('font-medium', pay.balance > 0 ? 'text-warning' : 'text-success')}
                >
                  {cop.format(pay.balance)}
                </span>
              </span>
            </div>
          </div>

          {pay.payments.length > 0 && (
            <ul className="divide-y divide-border/60">
              {pay.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium text-foreground">{cop.format(p.amount)}</span>{' '}
                    <span className="text-muted-foreground">
                      · {METHODS[p.method] ?? p.method}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.paidAt).toLocaleDateString('es-CO')}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {canPay ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="sm:w-32"
                type="number"
                placeholder="Monto"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={cn(fieldBase, 'cursor-pointer sm:w-40')}
              >
                {Object.entries(METHODS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <Input
                className="sm:flex-1"
                placeholder="Referencia (opcional)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <Button
                disabled={busy || !amount || Number(amount) <= 0}
                onClick={() => void recordPayment()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{' '}
                Registrar
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {order.status === 'CANCELLED'
                ? 'Venta cancelada.'
                : 'Venta pagada en su totalidad. ✓'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
