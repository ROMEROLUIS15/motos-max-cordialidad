'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import type { PartWithStock } from '@/types/inventory';
import type { WorkOrderDetail } from '@/types/workshop';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionCard } from './section-card';
import { money, type Run } from './types';

export function PartsSection({
  detail,
  workOrderId,
  busy,
  run,
}: {
  detail: WorkOrderDetail;
  workOrderId: string;
  busy: boolean;
  run: Run;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PartWithStock[]>([]);
  const [selected, setSelected] = useState<PartWithStock | null>(null);
  const [quantity, setQuantity] = useState('1');

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      apiGet<PaginatedResponse<PartWithStock>>(
        `/api/parts?search=${encodeURIComponent(query)}&pageSize=6`,
      )
        .then((d) => setResults(d.items))
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const pick = (p: PartWithStock) => {
    setSelected(p);
    setQuery('');
    setResults([]);
  };

  return (
    <SectionCard title="Repuestos usados">
      <ul className="divide-y divide-border/60">
        {detail.parts.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">Sin repuestos</li>
        )}
        {detail.parts.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-medium text-foreground">{p.partName}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{p.partSku}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-muted-foreground">x{p.quantity}</span>
              <span className="tnum font-medium">{money(p.quantity * p.unitPriceAtSale)}</span>
              <button
                disabled={busy}
                onClick={() =>
                  run(() => apiSend(`/api/work-orders/${workOrderId}/parts/${p.id}`, 'DELETE'))
                }
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-2">
        <div className="relative">
          <Input
            placeholder="Buscar repuesto por nombre o SKU…"
            value={selected ? `${selected.name} · ${selected.sku}` : query}
            onChange={(e) => {
              setSelected(null);
              setQuery(e.target.value);
            }}
          />
          {results.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-card-hover">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => pick(p)}
                    className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-secondary/60"
                  >
                    <span className="truncate">
                      {p.name}{' '}
                      <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-xs',
                        p.stockDisponible <= 0
                          ? 'text-destructive'
                          : p.lowStock
                            ? 'text-warning'
                            : 'text-muted-foreground',
                      )}
                    >
                      disp. {p.stockDisponible}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            className="w-full sm:w-24"
            placeholder="Cant."
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Button
            disabled={busy || !selected || !quantity}
            onClick={() =>
              run(async () => {
                if (!selected) return;
                await apiSend(`/api/work-orders/${workOrderId}/parts`, 'POST', {
                  partId: selected.id,
                  quantity: Number(quantity),
                });
                setSelected(null);
                setQuery('');
                setQuantity('1');
              })
            }
          >
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
