'use client';
export const runtime = 'edge';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Bike } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import { computeServiceTime, formatDuration } from '@/lib/service-time';
import {
  STATUS_LABELS,
  VALID_TRANSITIONS,
  type WorkOrderDetail,
  type PhotoEvidence,
} from '@/types/workshop';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeam } from '@/hooks/use-team';
import { money } from './_components/types';
import { Meta } from './_components/meta';
import { TransitionButton } from './_components/transition-button';
import { VehicleHistorySection } from './_components/vehicle-history-section';
import { ObservationsSection } from './_components/observations-section';
import { ServiceLinesSection } from './_components/service-lines-section';
import { PartsSection } from './_components/parts-section';
import { EvidencesSection } from './_components/evidences-section';
import { QuotesSection } from './_components/quotes-section';
import { PaymentsSection } from './_components/payments-section';

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { technicians, nameOf } = useTeam();
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

  const run = async (fn: () => Promise<unknown>) => {
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
  const serviceTime = computeServiceTime(wo, detail.statusHistory);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Órdenes
      </Link>

      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{wo.orderNumber}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{wo.serviceType}</p>
            </div>
            <StatusBadge status={wo.status} className="px-3 py-1 text-sm" />
          </div>

          {(detail.customer || detail.vehicle) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {detail.customer && (
                <Link
                  href={`/customers/${detail.customer.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-secondary"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground/90">{detail.customer.fullName}</span>
                  <span className="text-xs text-muted-foreground">{detail.customer.phone}</span>
                </Link>
              )}
              {detail.vehicle && (
                <Link
                  href={`/vehicles/${detail.vehicle.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-secondary"
                >
                  <Bike className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-foreground/90">{detail.vehicle.plate}</span>
                  <span className="text-xs text-muted-foreground">
                    {`${detail.vehicle.brand} ${detail.vehicle.model}`.trim()}
                    {detail.vehicle.year ? ` · ${detail.vehicle.year}` : ''}
                  </span>
                </Link>
              )}
            </div>
          )}

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
            <Meta
              label="Tiempo del servicio"
              value={
                <span className="text-foreground/90">
                  {formatDuration(serviceTime.totalMs)}
                  {serviceTime.ongoing && (
                    <span className="ml-1 text-xs text-muted-foreground">(en curso)</span>
                  )}
                </span>
              }
            />
            <Meta
              label="Trabajo activo"
              value={
                <span className="text-foreground/90">{formatDuration(serviceTime.activeMs)}</span>
              }
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
      <ServiceLinesSection
        detail={detail}
        workOrderId={id}
        busy={busy}
        run={run}
        technicians={technicians}
        nameOf={nameOf}
      />
      <PartsSection detail={detail} workOrderId={id} busy={busy} run={run} />
      <EvidencesSection evidences={evidences} workOrderId={id} busy={busy} run={run} />
      <QuotesSection workOrderId={id} woStatus={wo.status} />
      <PaymentsSection workOrderId={id} orderTotal={detail.total} />

      <Card>
        <CardContent className="p-5">
          {/* Desglose completo: el total debe ser verificable a simple vista. */}
          <dl className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Servicios</dt>
              <dd className="tnum">{money(detail.lines.reduce((s, l) => s + l.unitPrice, 0))}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Repuestos</dt>
              <dd className="tnum">
                {money(detail.parts.reduce((s, p) => s + p.quantity * p.unitPriceAtSale, 0))}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <dt className="text-base font-semibold">Total</dt>
              <dd className="tnum text-xl font-semibold">{money(detail.total)}</dd>
            </div>
          </dl>
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

      <VehicleHistorySection vehicleId={wo.vehicleId} currentOrderId={wo.id} />
    </div>
  );
}
