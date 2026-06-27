'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wallet, Receipt, Tag, Bike } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState } from '@/components/ui/states';

interface SalesSummary {
  sales: {
    confirmedCount: number;
    confirmedRevenue: number;
    draftCount: number;
    cancelledCount: number;
    avgTicket: number;
  };
  inventory: { available: number; reserved: number; sold: number };
  topBrands: { brand: string; units: number; revenue: number }[];
  monthlyTrend: { month: string; count: number; revenue: number }[];
}

const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const monthLabel = (ym: string) => {
  const [, m] = ym.split('-');
  return MONTHS[Number(m) - 1] ?? ym;
};

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="tnum text-xl font-semibold text-foreground">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SalesDashboardPage() {
  const [data, setData] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    apiGet<SalesSummary>('/api/sale-orders/summary')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="space-y-5">
        <PageHeader title="Resumen de ventas" description="Indicadores de los últimos 6 meses" />
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Resumen de ventas" description="Indicadores de los últimos 6 meses" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const maxRevenue = Math.max(1, ...data.monthlyTrend.map((m) => m.revenue));

  return (
    <div className="space-y-5">
      <PageHeader title="Resumen de ventas" description="Indicadores de los últimos 6 meses" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Wallet}
          label="Ingresos"
          value={cop.format(data.sales.confirmedRevenue)}
          hint="Ventas confirmadas"
        />
        <Stat
          icon={Receipt}
          label="Ventas"
          value={String(data.sales.confirmedCount)}
          hint={`${data.sales.draftCount} en borrador`}
        />
        <Stat icon={Tag} label="Ticket promedio" value={cop.format(data.sales.avgTicket)} />
        <Stat
          icon={Bike}
          label="Motos vendidas"
          value={String(data.inventory.sold)}
          hint={`${data.inventory.available} disponibles`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ventas por mes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyTrend.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Sin ventas en el periodo"
                description="Las ventas confirmadas aparecerán aquí."
              />
            ) : (
              <div className="flex h-48 items-end gap-3">
                {data.monthlyTrend.map((m) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="tnum text-[10px] text-muted-foreground">{m.count}</span>
                    <div
                      className="w-full rounded-t bg-primary/70"
                      style={{ height: `${Math.max(4, (m.revenue / maxRevenue) * 100)}%` }}
                      title={cop.format(m.revenue)}
                    />
                    <span className="text-[10px] text-muted-foreground">{monthLabel(m.month)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Disponibles', value: data.inventory.available, color: 'text-success' },
              { label: 'Reservadas', value: data.inventory.reserved, color: 'text-warning' },
              { label: 'Vendidas', value: data.inventory.sold, color: 'text-muted-foreground' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className={cn('tnum text-lg font-semibold', r.color)}>{r.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marcas más vendidas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.topBrands.length === 0 ? (
            <EmptyState
              icon={Bike}
              title="Sin datos"
              description="Aún no hay ventas confirmadas."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  {['Marca', 'Unidades', 'Ingresos'].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        'px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground',
                        i > 0 && 'text-right',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.topBrands.map((b) => (
                  <tr key={b.brand} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{b.brand}</td>
                    <td className="tnum px-4 py-3 text-right text-muted-foreground">{b.units}</td>
                    <td className="tnum px-4 py-3 text-right font-medium text-foreground">
                      {cop.format(b.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
