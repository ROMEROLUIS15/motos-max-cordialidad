'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingCart, Check, X } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, TableRowsSkeleton } from '@/components/ui/states';

interface DraftItem {
  partId: string;
  quantity: number;
  reason?: string;
}
interface PurchaseOrderDraft {
  id: string;
  status: string;
  items: DraftItem[];
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'default' | 'destructive' | 'secondary'> = {
  DRAFT: 'default',
  APPROVED: 'success',
  REJECTED: 'destructive',
};
const POLL_MS = 30_000;

export default function PurchaseOrdersPage() {
  const [items, setItems] = useState<PurchaseOrderDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<PaginatedResponse<PurchaseOrderDraft>>(
        '/api/purchase-orders?pageSize=50',
      );
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function decide(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    try {
      await apiSend(`/api/purchase-orders/${id}/${action}`, 'PATCH');
      await load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Órdenes de compra"
        description="Borradores sugeridos por el agente de inventario"
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Fecha', 'Ítems', 'Notas', 'Estado', 'Acciones'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowsSkeleton rows={6} cols={5} />
              ) : error ? (
                <tr>
                  <td colSpan={5}>
                    <ErrorState message={error} onRetry={() => void load()} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={ShoppingCart}
                      title="Sin borradores"
                      description="El agente aún no ha sugerido órdenes de compra."
                    />
                  </td>
                </tr>
              ) : (
                items.map((d) => (
                  <tr
                    key={d.id}
                    className="border-b border-border/60 last:border-0 align-top hover:bg-secondary/40"
                  >
                    <td className="tnum whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {new Date(d.createdAt).toLocaleDateString('es-CO')}
                    </td>
                    <td className="px-4 py-2.5 text-foreground/90">
                      {d.items.length} repuesto{d.items.length === 1 ? '' : 's'}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({d.items.reduce((n, i) => n + i.quantity, 0)} uds)
                      </span>
                    </td>
                    <td className="max-w-[220px] px-4 py-2.5 text-muted-foreground">
                      {d.notes ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[d.status] ?? 'secondary'}>{d.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {d.status === 'DRAFT' ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={busy === d.id}
                            onClick={() => void decide(d.id, 'approve')}
                          >
                            <Check className="h-4 w-4" /> Aprobar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy === d.id}
                            onClick={() => void decide(d.id, 'reject')}
                          >
                            <X className="h-4 w-4" /> Rechazar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
