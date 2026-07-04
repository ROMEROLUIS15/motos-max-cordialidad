'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { usePolling } from '@/hooks/use-polling';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Wallet,
  TrendingUp,
  ClipboardList,
  Clock,
  AlertTriangle,
  PackageX,
  Trophy,
  Boxes,
  ArrowUpRight,
  RotateCw,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface DashboardSummary {
  activeByStatus: Record<string, number>;
  collectedToday: number;
  collectedMonth: number;
  avgCycleHours: number;
  lowStock: Array<{ partId: string; name: string; stockDisponible: number }>;
  lowStockCount: number;
  nearingDeadline: Array<{
    id: string;
    orderNumber: string;
    promisedDeliveryAt: string;
    overdue: boolean;
  }>;
  technicianRanking: Array<{ technicianId: string; technicianName: string; completed: number }>;
  incomeTrend: Array<{ date: string; total: number }>;
  topParts: Array<{ partId: string; name: string; totalQuantity: number }>;
  waitingPartsAlert: boolean;
  waitingPartsCount: number;
}

const money = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function Kpi({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <Card className="group relative overflow-hidden transition-colors hover:border-primary/40">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="tnum mt-4 text-[28px] font-semibold leading-none tracking-tight">{value}</p>
        {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {badge}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function Row({
  left,
  right,
  href,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-secondary/60">
      <span className="min-w-0 truncate text-foreground/90">{left}</span>
      <span className="tnum shrink-0 font-medium">{right}</span>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function Empty({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
      <Icon className="h-5 w-5 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Skeleton className="h-[332px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[332px] rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return apiGet<DashboardSummary>('/api/dashboard/summary')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  usePolling(() => void load(), 60000);

  const activeTotal = data ? Object.values(data.activeByStatus).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Resumen operativo del taller.</p>
        </div>
        {data && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            En vivo · actualiza cada 60s
          </span>
        )}
      </div>

      {error && !data ? (
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div className="space-y-1">
              <p className="font-medium">No se pudo cargar el dashboard</p>
              <p className="text-sm text-muted-foreground">
                Revisa que la API esté disponible e inténtalo de nuevo.
              </p>
              <p className="pt-1 font-mono text-xs text-muted-foreground/70">{error}</p>
            </div>
            <Button variant="outline" onClick={() => void load()}>
              <RotateCw className="h-4 w-4" /> Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6 animate-in-up">
          {data.waitingPartsAlert && (
            <div className="flex items-center gap-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm font-medium text-warning ring-highlight">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {data.waitingPartsCount} órdenes en espera de repuestos (umbral superado)
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Cobrado hoy" value={money(data.collectedToday)} icon={Wallet} />
            <Kpi label="Cobrado mes" value={money(data.collectedMonth)} icon={TrendingUp} />
            <Kpi
              label="Órdenes activas"
              value={String(activeTotal)}
              icon={ClipboardList}
              sub="en proceso ahora"
            />
            <Kpi
              label="Ciclo promedio"
              value={`${data.avgCycleHours} h`}
              icon={Clock}
              sub="recepción → entrega"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Tendencia de ingresos</CardTitle>
                <p className="text-xs text-muted-foreground">Cobrado · últimos 30 días</p>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.incomeTrend}
                      margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) => `${Number(v) / 1000}k`}
                      />
                      <Tooltip
                        formatter={(v) => [money(Number(v)), 'Cobrado']}
                        contentStyle={{
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '0.6rem',
                          color: 'hsl(var(--popover-foreground))',
                          fontSize: 12,
                          boxShadow: '0 12px 32px -12px rgb(0 0 0 / 0.6)',
                        }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}
                        cursor={{
                          stroke: 'hsl(var(--primary))',
                          strokeOpacity: 0.4,
                          strokeDasharray: '4 4',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="hsl(var(--chart-1))"
                        strokeWidth={2.5}
                        fill="url(#incomeFill)"
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <SectionCard title="Próximas a vencer">
              <div className="space-y-0.5">
                {data.nearingDeadline.length === 0 && <Empty icon={Clock}>Ninguna pendiente</Empty>}
                {data.nearingDeadline.map((o) => (
                  <Row
                    key={o.id}
                    href={`/work-orders/${o.id}`}
                    left={
                      <span className="inline-flex items-center gap-1 font-medium text-primary">
                        {o.orderNumber} <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    }
                    right={
                      o.overdue ? (
                        <Badge variant="destructive">
                          {new Date(o.promisedDeliveryAt).toLocaleDateString('es-CO')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {new Date(o.promisedDeliveryAt).toLocaleDateString('es-CO')}
                        </span>
                      )
                    }
                  />
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <SectionCard
              title="Stock bajo"
              badge={
                <Badge variant={data.lowStockCount > 0 ? 'destructive' : 'success'}>
                  <PackageX className="h-3 w-3" /> {data.lowStockCount}
                </Badge>
              }
            >
              <div className="space-y-0.5">
                {data.lowStock.length === 0 && <Empty icon={PackageX}>Sin alertas de stock</Empty>}
                {data.lowStock.slice(0, 8).map((p) => (
                  <Row
                    key={p.partId}
                    left={p.name}
                    right={<span className="text-destructive">{p.stockDisponible}</span>}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Top técnicos" badge={<Trophy className="h-4 w-4 text-warning" />}>
              <div className="space-y-0.5">
                {data.technicianRanking.length === 0 && (
                  <Empty icon={Trophy}>Sin datos del período</Empty>
                )}
                {data.technicianRanking.map((t, i) => (
                  <Row
                    key={t.technicianId}
                    left={
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                            i === 0
                              ? 'bg-warning/15 text-warning'
                              : 'bg-secondary text-muted-foreground',
                          )}
                        >
                          {i + 1}
                        </span>
                        {t.technicianName}
                      </span>
                    }
                    right={t.completed}
                  />
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Top repuestos"
              badge={<Boxes className="h-4 w-4 text-muted-foreground" />}
            >
              <div className="space-y-0.5">
                {data.topParts.length === 0 && <Empty icon={Boxes}>Sin datos del período</Empty>}
                {data.topParts.map((p) => (
                  <Row key={p.partId} left={p.name} right={p.totalQuantity} />
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
