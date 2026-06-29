'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import { type WorkOrderStatus } from '@/types/workshop';
import { QUOTE_STATUS_LABELS, type Quote } from '@/types/commerce';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from './section-card';
import { money, QUOTE_VARIANT } from './types';

export function QuotesSection({
  workOrderId,
  woStatus,
}: {
  workOrderId: string;
  woStatus: WorkOrderStatus;
}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<Quote[]>(`/api/quotes?workOrderId=${workOrderId}`)
      .then(setQuotes)
      .catch((e) => setError((e as Error).message));
  }, [workOrderId]);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openPdf = async (id: string) => {
    try {
      const { url } = await apiGet<{ url: string }>(`/api/quotes/${id}/pdf`);
      window.open(url, '_blank');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const canGenerate = woStatus === 'PENDING' || woStatus === 'IN_PROGRESS';

  return (
    <SectionCard
      title="Cotizaciones"
      action={
        canGenerate && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => act(() => apiSend('/api/quotes', 'POST', { workOrderId }))}
          >
            <Plus className="h-4 w-4" /> Generar
          </Button>
        )
      }
    >
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <ul className="divide-y divide-border/60">
        {quotes.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">Sin cotizaciones</li>
        )}
        {quotes.map((q) => (
          <li
            key={q.id}
            className="flex flex-col gap-2 py-2.5 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          >
            <span className="flex items-center gap-3">
              <span className="font-medium">{q.quoteNumber}</span>
              <Badge variant={QUOTE_VARIANT[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
            </span>
            <span className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="tnum font-medium">{money(q.total)}</span>
              <Button variant="ghost" size="sm" onClick={() => void openPdf(q.id)}>
                <FileText className="h-3.5 w-3.5" /> PDF
              </Button>
              {q.status === 'DRAFT' && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => act(() => apiSend(`/api/quotes/${q.id}/send`, 'POST'))}
                >
                  Enviar
                </Button>
              )}
              {q.status === 'SENT' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-success hover:text-success"
                    disabled={busy}
                    onClick={() => act(() => apiSend(`/api/quotes/${q.id}/approve`, 'POST'))}
                  >
                    Aprobar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => act(() => apiSend(`/api/quotes/${q.id}/reject`, 'POST'))}
                  >
                    Rechazar
                  </Button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
