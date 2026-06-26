'use client';

export const runtime = 'edge';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Upload, FileText, X, Loader2 } from 'lucide-react';
import { apiGet, apiSend, apiUpload } from '@/lib/api';
import {
  STATUS_LABELS,
  VALID_TRANSITIONS,
  PHOTO_PHASES,
  type WorkOrderDetail,
  type PhotoEvidence,
  type PhotoPhase,
  type WorkOrderStatus,
} from '@/types/workshop';
import type { PaginatedResponse } from '@/types/api';
import type { ServiceCatalogItem, PartWithStock } from '@/types/inventory';
import {
  QUOTE_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type Quote,
  type QuoteStatus,
  type PaymentSummary,
  type PaymentMethod,
} from '@/types/commerce';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, fieldBase } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/input';
import { useTeam } from '@/hooks/use-team';

const money = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const QUOTE_VARIANT: Record<
  QuoteStatus,
  'secondary' | 'default' | 'success' | 'destructive' | 'warning'
> = {
  DRAFT: 'secondary',
  SENT: 'default',
  APPROVED: 'success',
  REJECTED: 'destructive',
  EXPIRED: 'warning',
};

type Run = (fn: () => Promise<unknown>) => Promise<void>;

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { nameOf } = useTeam();
  const [detail, setDetail] = useState<WorkOrderDetail | null>(null);
  const [evidences, setEvidences] = useState<PhotoEvidence[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, ev] = await Promise.all([
        apiGet<WorkOrderDetail>(`/api/work-orders/${id}`),
        apiGet<PhotoEvidence[]>(`/api/work-orders/${id}/evidences`),
      ]);
      setDetail(d);
      setEvidences(ev);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run: Run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!detail) {
    return error ? (
      <p className="text-sm text-destructive">{error}</p>
    ) : (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  const wo = detail.workOrder;
  const transitions = VALID_TRANSITIONS[wo.status];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Órdenes
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{wo.orderNumber}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{wo.serviceType}</p>
            </div>
            <StatusBadge status={wo.status} className="px-3 py-1 text-sm" />
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <Meta
              label="Entrega prometida"
              value={new Date(wo.promisedDeliveryAt).toLocaleString('es-CO')}
            />
            <Meta
              label="Odómetro final"
              value={
                wo.finalOdometer != null ? `${wo.finalOdometer.toLocaleString('es-CO')} km` : '—'
              }
            />
            <Meta
              label="Mecánico"
              value={<span className="text-foreground/90">{nameOf(wo.technicianId)}</span>}
            />
          </dl>

          <p className="mt-4 text-sm">
            <span className="text-muted-foreground">Problema: </span>
            <span className="text-foreground/90">{wo.problemDescription}</span>
          </p>

          {transitions.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              {transitions.map((next) => (
                <TransitionButton
                  key={next}
                  next={next}
                  busy={busy}
                  onClick={(finalOdometer) =>
                    run(() =>
                      apiSend(`/api/work-orders/${id}/status`, 'POST', {
                        newStatus: next,
                        finalOdometer,
                      }),
                    )
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ObservationsSection workOrderId={id} observations={wo.observations} busy={busy} run={run} />
      <ServiceLinesSection detail={detail} workOrderId={id} busy={busy} run={run} />
      <PartsSection detail={detail} workOrderId={id} busy={busy} run={run} />
      <EvidencesSection evidences={evidences} workOrderId={id} busy={busy} run={run} />
      <QuotesSection workOrderId={id} woStatus={wo.status} />
      <PaymentsSection workOrderId={id} />

      {/* Total + history */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Total</h2>
            <span className="tnum text-xl font-semibold">{money(detail.total)}</span>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-medium text-muted-foreground">
            Historial de estado
          </h3>
          <ol className="space-y-1.5 text-sm">
            {detail.statusHistory.length === 0 && (
              <li className="text-muted-foreground">Sin cambios registrados</li>
            )}
            {detail.statusHistory.map((h, i) => (
              <li key={i} className="flex items-center gap-2 text-muted-foreground">
                <span className="tnum text-xs">
                  {new Date(h.changedAt).toLocaleString('es-CO')}
                </span>
                <span className="text-foreground/80">
                  {h.previousStatus ? `${STATUS_LABELS[h.previousStatus]} → ` : ''}
                  {STATUS_LABELS[h.newStatus]}
                </span>
                {h.note ? <span className="text-muted-foreground/70">· {h.note}</span> : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground/90">{value}</dd>
    </div>
  );
}

function TransitionButton({
  next,
  busy,
  onClick,
}: {
  next: WorkOrderStatus;
  busy: boolean;
  onClick: (finalOdometer?: number) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => {
        const finalOdometer =
          next === 'COMPLETED'
            ? Number(window.prompt('Odómetro final (opcional):') ?? '') || undefined
            : undefined;
        onClick(finalOdometer);
      }}
    >
      {STATUS_LABELS[next]}
    </Button>
  );
}

function ObservationsSection({
  workOrderId,
  observations,
  busy,
  run,
}: {
  workOrderId: string;
  observations: string | null;
  busy: boolean;
  run: Run;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(observations ?? '');

  return (
    <SectionCard
      title="Observaciones del servicio"
      action={
        !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {observations ? 'Editar' : 'Añadir'}
          </Button>
        )
      }
    >
      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Qué encontró/hizo el mecánico"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setText(observations ?? '');
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await apiSend(`/api/work-orders/${workOrderId}`, 'PUT', { observations: text });
                  setEditing(false);
                })
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </div>
        </div>
      ) : observations ? (
        <p className="whitespace-pre-wrap text-sm text-foreground/90">{observations}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Sin observaciones registradas.</p>
      )}
    </SectionCard>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ServiceLinesSection({
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
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
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
            <span className="text-foreground/90">{l.description}</span>
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

      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          className="min-w-[180px] flex-1"
          placeholder="Descripción del servicio"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Input
          className="w-28"
          placeholder="Precio"
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
        />
        <Button
          disabled={busy || !description || !unitPrice}
          onClick={() =>
            run(async () => {
              await apiSend(`/api/work-orders/${workOrderId}/lines`, 'POST', {
                description,
                unitPrice: Number(unitPrice),
                serviceCatalogId: serviceCatalogId ?? undefined,
              });
              setDescription('');
              setUnitPrice('');
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

function PartsSection({
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
        <div className="flex gap-2">
          <Input
            className="w-24"
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

function EvidencesSection({
  evidences,
  workOrderId,
  busy,
  run,
}: {
  evidences: PhotoEvidence[];
  workOrderId: string;
  busy: boolean;
  run: Run;
}) {
  const [phase, setPhase] = useState<PhotoPhase>('INGRESO');
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <SectionCard title="Evidencias fotográficas">
      <div className="space-y-4">
        {PHOTO_PHASES.map((ph) => {
          const items = evidences.filter((e) => e.phase === ph);
          return (
            <div key={ph}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {ph}
              </h3>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin fotos</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {items.map((e) => (
                    <div key={e.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={e.url}
                        alt={e.filename}
                        className="h-24 w-24 rounded-lg border border-border object-cover"
                      />
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            apiSend(`/api/work-orders/${workOrderId}/evidences/${e.id}`, 'DELETE'),
                          )
                        }
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Eliminar foto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as PhotoPhase)}
          className={cn(fieldBase, 'w-auto cursor-pointer')}
        >
          {PHOTO_PHASES.map((ph) => (
            <option key={ph} value={ph}>
              {ph}
            </option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/70"
        />
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            const file = fileRef.current?.files?.[0];
            if (!file) return;
            void run(async () => {
              await apiUpload(`/api/work-orders/${workOrderId}/evidences`, file, { phase });
              if (fileRef.current) fileRef.current.value = '';
            });
          }}
        >
          <Upload className="h-4 w-4" /> Subir
        </Button>
      </div>
    </SectionCard>
  );
}

function QuotesSection({
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
  useEffect(() => load(), [load]);

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
            className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm"
          >
            <span className="flex items-center gap-3">
              <span className="font-medium">{q.quoteNumber}</span>
              <Badge variant={QUOTE_VARIANT[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Badge>
            </span>
            <span className="flex items-center gap-3">
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

function PaymentsSection({ workOrderId }: { workOrderId: string }) {
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
  useEffect(() => load(), [load]);

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
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="text-muted-foreground">
              Pagado:{' '}
              <span className="tnum font-medium text-foreground">{money(summary.totalPaid)}</span>
            </span>
            <span className="text-muted-foreground">
              Saldo:{' '}
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
        <div className="mb-4 flex flex-wrap gap-2">
          <Input
            className="w-32"
            type="number"
            placeholder="Monto"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className={cn(fieldBase, 'w-auto cursor-pointer')}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <Input
            className="min-w-[140px] flex-1"
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
