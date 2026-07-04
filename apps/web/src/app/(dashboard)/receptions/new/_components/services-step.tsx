'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Step } from './step';
import type { UseServiceCatalogPickerResult } from './use-service-catalog-picker';

const money = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export function ServicesStep({ form }: { form: UseServiceCatalogPickerResult }) {
  const {
    svcQuery,
    setSvcQuery,
    svcSuggestions,
    services,
    addService,
    removeService,
    updateServicePrice,
  } = form;

  return (
    <Step n={3} title="Servicios">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar servicio del catálogo…"
          value={svcQuery}
          onChange={(e) => setSvcQuery(e.target.value)}
        />
        {svcSuggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-card-hover">
            {svcSuggestions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => addService(s)}
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
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">Agrega uno o más servicios del catálogo.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {services.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="flex-1 text-foreground/90">{s.name}</span>
              <Input
                className="w-28"
                type="number"
                value={s.price}
                onChange={(e) => updateServicePrice(i, e.target.value)}
              />
              <button
                onClick={() => removeService(i)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Quitar"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Step>
  );
}
