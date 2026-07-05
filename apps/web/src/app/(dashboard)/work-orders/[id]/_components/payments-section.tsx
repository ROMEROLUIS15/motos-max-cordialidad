'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentSummary,
  type PaymentMethod,
} from '@/types/commerce';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, fieldBase } from '@/components/ui/input';
import { SectionCard } from './section-card';
import { money } from './types';

export function PaymentsSection({
  workOrderId,
  orderTotal,
}: {
  workOrderId: string;
  /**
   * Current order total from the detail payload. Only used as a refresh
   * signal: when a service line or part changes the total, the summary
   * (Pagado/Saldo) is re-fetched so it never shows a stale balance.
   */
  orderTotal?: number;
}) {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<PaymentSummary>(`/api/payments/summary/${workOrderId}`)
      .then(setSummary)
      .catch((e) => setError((e as Error).message));
  }, [workOrderId]);
  useEffect(() => {
    void load();
  }, [load, orderTotal]);

  const register = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/payments', 'POST', {
        workOrderId,
        amount: Number(amount),
        paymentMethod: method,
        reference: reference || undefined,
      });
      setAmount('');
      setReference('');
      setShowForm(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pct =
    summary && summary.orderTotal > 0
      ? Math.min(100, (summary.totalPaid / summary.orderTotal) * 100)
      : 0;

  return (
    <SectionCard
      title="Pagos"
      action={
        <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4" /> Registrar pago
        </Button>
      }
    >
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}

      {summary && (
        <div className="mb-4">
          <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              Total:{' '}
              <span className="tnum font-medium text-foreground">{money(summary.orderTotal)}</span>
            </span>
            <span className="text-muted-foreground">
              Abonado:{' '}
              <span className="tnum font-medium text-foreground">{money(summary.totalPaid)}</span>
            </span>
            <span className="text-muted-foreground">
              Restante:{' '}
              <span className="tnum font-medium text-foreground">{money(summary.balance)}</span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Input
            className="w-full sm:w-32"
            type="number"
            placeholder="Monto"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className={cn(fieldBase, 'w-full cursor-pointer sm:w-auto')}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <Input
            className="w-full sm:min-w-[140px] sm:flex-1"
            placeholder="Referencia"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <Button disabled={busy || !amount} onClick={() => void register()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </Button>
        </div>
      )}

      <ul className="divide-y divide-border/60">
        {summary?.payments.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">Sin pagos</li>
        )}
        {summary?.payments.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="tnum text-muted-foreground">
              {new Date(p.paidAt).toLocaleDateString('es-CO')}
            </span>
            <span className="flex-1 px-3 text-muted-foreground">
              {PAYMENT_METHOD_LABELS[p.paymentMethod]}
            </span>
            <span className="text-muted-foreground/70">{p.reference}</span>
            <span className="tnum font-medium">{money(p.amount)}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
