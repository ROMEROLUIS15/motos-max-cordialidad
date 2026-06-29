'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import type { ServiceCatalogItem } from '@/types/inventory';
import type { WorkOrderDetail } from '@/types/workshop';
import type { TeamMember } from '@/hooks/use-team';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, fieldBase } from '@/components/ui/input';
import { SectionCard } from './section-card';
import { money, type Run } from './types';

export function ServiceLinesSection({
  detail,
  workOrderId,
  busy,
  run,
  technicians,
  nameOf,
}: {
  detail: WorkOrderDetail;
  workOrderId: string;
  busy: boolean;
  run: Run;
  technicians: TeamMember[];
  nameOf: (id: string | null | undefined) => string;
}) {
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [serviceCatalogId, setServiceCatalogId] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ServiceCatalogItem[]>([]);

  useEffect(() => {
    if (!catalogQuery) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      apiGet<PaginatedResponse<ServiceCatalogItem>>(
        `/api/service-catalog?search=${encodeURIComponent(catalogQuery)}&isActive=true&pageSize=6`,
      )
        .then((d) => setSuggestions(d.items))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(t);
  }, [catalogQuery]);

  const pick = (item: ServiceCatalogItem) => {
    setDescription(item.name);
    setUnitPrice(String(item.suggestedPrice));
    setServiceCatalogId(item.id);
    setCatalogQuery('');
    setSuggestions([]);
  };

  return (
    <SectionCard title="Servicios">
      <div className="relative mb-3">
        <Input
          placeholder="Buscar en el catálogo de servicios…"
          value={catalogQuery}
          onChange={(e) => setCatalogQuery(e.target.value)}
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-card-hover">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => pick(s)}
                  className="w-full border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-secondary/60"
                >
                  {s.name} · {money(s.suggestedPrice)}{' '}
                  <span className="text-muted-foreground">({s.serviceType})</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="divide-y divide-border/60">
        {detail.lines.length === 0 && (
          <li className="py-2 text-sm text-muted-foreground">Sin servicios</li>
        )}
        {detail.lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex min-w-0 flex-col">
              <span className="text-foreground/90">{l.description}</span>
              {l.technicianId && (
                <span className="text-xs text-muted-foreground">
                  Mecánico: {nameOf(l.technicianId)}
                </span>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span className="tnum font-medium">{money(l.unitPrice)}</span>
              <button
                disabled={busy}
                onClick={() =>
                  run(() => apiSend(`/api/work-orders/${workOrderId}/lines/${l.id}`, 'DELETE'))
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

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          className="w-full sm:min-w-[180px] sm:flex-1"
          placeholder="Descripción del servicio"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          className="w-full sm:w-28"
          placeholder="Precio"
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
        />
        <select
          value={technicianId}
          onChange={(e) => setTechnicianId(e.target.value)}
          className={cn(fieldBase, 'w-full cursor-pointer sm:w-44')}
          aria-label="Mecánico que atendió"
        >
          <option value="">Mecánico…</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
        <Button
          disabled={busy || !description || !unitPrice}
          onClick={() =>
            run(async () => {
              await apiSend(`/api/work-orders/${workOrderId}/lines`, 'POST', {
                description,
                unitPrice: Number(unitPrice),
                technicianId: technicianId || undefined,
                serviceCatalogId: serviceCatalogId ?? undefined,
              });
              setDescription('');
              setUnitPrice('');
              setTechnicianId('');
              setServiceCatalogId(null);
            })
          }
        >
          <Plus className="h-4 w-4" /> Agregar
        </Button>
      </div>
    </SectionCard>
  );
}
