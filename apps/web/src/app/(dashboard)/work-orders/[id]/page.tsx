'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiGet, apiSend, apiUpload } from '@/lib/api';
import {
  STATUS_LABELS,
  STATUS_BADGE,
  VALID_TRANSITIONS,
  PHOTO_PHASES,
  type WorkOrderDetail,
  type PhotoEvidence,
  type PhotoPhase,
  type WorkOrderStatus,
} from '@/types/workshop';
import type { PaginatedResponse } from '@/types/api';
import type { ServiceCatalogItem } from '@/types/inventory';
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_BADGE,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type Quote,
  type PaymentSummary,
  type PaymentMethod,
} from '@/types/commerce';

const money = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
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
    return (
      <div className="p-6">
        {error ? <p className="text-red-600">{error}</p> : <p className="text-gray-500">Cargando...</p>}
      </div>
    );
  }

  const wo = detail.workOrder;
  const transitions = VALID_TRANSITIONS[wo.status];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{wo.orderNumber}</h1>
            <p className="text-sm text-gray-500 mt-1">{wo.serviceType}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[wo.status]}`}>
            {STATUS_LABELS[wo.status]}
          </span>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-sm">
          <div>
            <dt className="text-gray-500">Vehículo</dt>
            <dd className="text-gray-900">{wo.vehicleId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Cliente</dt>
            <dd className="text-gray-900">{wo.customerId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Técnico</dt>
            <dd className="text-gray-900">{wo.technicianId}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Entrega prometida</dt>
            <dd className="text-gray-900">{new Date(wo.promisedDeliveryAt).toLocaleString('es-CO')}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Odómetro final</dt>
            <dd className="text-gray-900">{wo.finalOdometer ?? '—'}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-gray-700">
          <span className="text-gray-500">Problema: </span>
          {wo.problemDescription}
        </p>

        {/* Status transitions */}
        {transitions.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {transitions.map((next) => (
              <TransitionButton key={next} next={next} busy={busy} onClick={(note, finalOdometer) =>
                run(() =>
                  apiSend(`/api/work-orders/${id}/status`, 'POST', { newStatus: next, note, finalOdometer }),
                )
              } />
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Service lines */}
      <ServiceLinesSection detail={detail} workOrderId={id} busy={busy} run={run} />

      {/* Parts */}
      <PartsSection detail={detail} workOrderId={id} busy={busy} run={run} />

      {/* Evidences */}
      <EvidencesSection evidences={evidences} workOrderId={id} busy={busy} run={run} />

      {/* Quotes */}
      <QuotesSection workOrderId={id} woStatus={wo.status} />

      {/* Payments */}
      <PaymentsSection workOrderId={id} />

      {/* Total + history */}
      <div className="bg-white rounded-lg shadow p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Total</h2>
          <span className="text-xl font-bold text-gray-900">{money(detail.total)}</span>
        </div>
        <h3 className="text-sm font-semibold text-gray-700 mt-5 mb-2">Historial de estado</h3>
        <ol className="space-y-1 text-sm">
          {detail.statusHistory.length === 0 && <li className="text-gray-400">Sin cambios registrados</li>}
          {detail.statusHistory.map((h, i) => (
            <li key={i} className="text-gray-600">
              {new Date(h.changedAt).toLocaleString('es-CO')} — {h.previousStatus ? `${STATUS_LABELS[h.previousStatus]} → ` : ''}
              {STATUS_LABELS[h.newStatus]}
              {h.note ? ` (${h.note})` : ''}
            </li>
          ))}
        </ol>
      </div>
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
  onClick: (note?: string, finalOdometer?: number) => void;
}) {
  return (
    <button
      disabled={busy}
      onClick={() => {
        const finalOdometer =
          next === 'COMPLETED' ? Number(window.prompt('Odómetro final (opcional):') ?? '') || undefined : undefined;
        onClick(undefined, finalOdometer);
      }}
      className="px-3 py-1.5 text-sm rounded-md border border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-40"
    >
      → {STATUS_LABELS[next]}
    </button>
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
  run: (fn: () => Promise<unknown>) => Promise<void>;
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

  const pickCatalog = (item: ServiceCatalogItem) => {
    setDescription(item.name);
    setUnitPrice(String(item.suggestedPrice));
    setServiceCatalogId(item.id);
    setCatalogQuery('');
    setSuggestions([]);
  };

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Servicios</h2>
      <div className="relative mb-2">
        <input
          placeholder="Buscar en el catálogo de servicios..."
          value={catalogQuery}
          onChange={(e) => setCatalogQuery(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow divide-y">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => pickCatalog(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {s.name} — {s.suggestedPrice.toLocaleString('es-CO')} ({s.serviceType})
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <table className="min-w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {detail.lines.length === 0 && (
            <tr>
              <td className="py-2 text-gray-400">Sin servicios</td>
            </tr>
          )}
          {detail.lines.map((l) => (
            <tr key={l.id}>
              <td className="py-2 text-gray-800">{l.description}</td>
              <td className="py-2 text-right text-gray-800">{money(l.unitPrice)}</td>
              <td className="py-2 text-right">
                <button
                  disabled={busy}
                  onClick={() => run(() => apiSend(`/api/work-orders/${workOrderId}/lines/${l.id}`, 'DELETE'))}
                  className="text-red-600 hover:underline text-xs"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 mt-3">
        <input
          placeholder="Descripción del servicio"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <input
          placeholder="Precio"
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className="w-28 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <button
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
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
    </div>
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
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [partId, setPartId] = useState('');
  const [quantity, setQuantity] = useState('1');

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Repuestos</h2>
      <table className="min-w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {detail.parts.length === 0 && (
            <tr>
              <td className="py-2 text-gray-400">Sin repuestos</td>
            </tr>
          )}
          {detail.parts.map((p) => (
            <tr key={p.id}>
              <td className="py-2 text-gray-800">{p.partId}</td>
              <td className="py-2 text-right text-gray-600">x{p.quantity}</td>
              <td className="py-2 text-right text-gray-800">{money(p.quantity * p.unitPriceAtSale)}</td>
              <td className="py-2 text-right">
                <button
                  disabled={busy}
                  onClick={() => run(() => apiSend(`/api/work-orders/${workOrderId}/parts/${p.id}`, 'DELETE'))}
                  className="text-red-600 hover:underline text-xs"
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 mt-3">
        <input
          placeholder="ID del repuesto"
          value={partId}
          onChange={(e) => setPartId(e.target.value)}
          className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <input
          placeholder="Cant."
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-24 border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        />
        <button
          disabled={busy || !partId || !quantity}
          onClick={() =>
            run(async () => {
              await apiSend(`/api/work-orders/${workOrderId}/parts`, 'POST', {
                partId,
                quantity: Number(quantity),
              });
              setPartId('');
              setQuantity('1');
            })
          }
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-40"
        >
          Agregar
        </button>
      </div>
    </div>
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
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const [phase, setPhase] = useState<PhotoPhase>('INGRESO');
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Evidencias fotográficas</h2>
      {PHOTO_PHASES.map((ph) => {
        const items = evidences.filter((e) => e.phase === ph);
        return (
          <div key={ph} className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">{ph}</h3>
            {items.length === 0 ? (
              <p className="text-sm text-gray-400">Sin fotos</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {items.map((e) => (
                  <div key={e.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.url} alt={e.filename} className="h-24 w-24 object-cover rounded border" />
                    <button
                      disabled={busy}
                      onClick={() => run(() => apiSend(`/api/work-orders/${workOrderId}/evidences/${e.id}`, 'DELETE'))}
                      className="absolute top-1 right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex items-center gap-2 mt-2">
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as PhotoPhase)}
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm"
        >
          {PHOTO_PHASES.map((ph) => (
            <option key={ph} value={ph}>
              {ph}
            </option>
          ))}
        </select>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
        <button
          disabled={busy}
          onClick={() => {
            const file = fileRef.current?.files?.[0];
            if (!file) return;
            void run(async () => {
              await apiUpload(`/api/work-orders/${workOrderId}/evidences`, file, { phase });
              if (fileRef.current) fileRef.current.value = '';
            });
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-40"
        >
          Subir
        </button>
      </div>
    </div>
  );
}

function QuotesSection({ workOrderId, woStatus }: { workOrderId: string; woStatus: WorkOrderStatus }) {
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
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Cotizaciones</h2>
        {canGenerate && (
          <button
            disabled={busy}
            onClick={() => act(() => apiSend('/api/quotes', 'POST', { workOrderId }))}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-40"
          >
            Generar cotización
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      {quotes.length === 0 ? (
        <p className="text-sm text-gray-400">Sin cotizaciones</p>
      ) : (
        <table className="min-w-full text-sm">
          <tbody className="divide-y divide-gray-100">
            {quotes.map((q) => (
              <tr key={q.id}>
                <td className="py-2 font-medium text-gray-800">{q.quoteNumber}</td>
                <td className="py-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${QUOTE_STATUS_BADGE[q.status]}`}>
                    {QUOTE_STATUS_LABELS[q.status]}
                  </span>
                </td>
                <td className="py-2 text-right text-gray-800">
                  {q.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                </td>
                <td className="py-2 text-right space-x-2">
                  <button onClick={() => void openPdf(q.id)} className="text-blue-600 hover:underline text-xs">
                    PDF
                  </button>
                  {q.status === 'DRAFT' && (
                    <button disabled={busy} onClick={() => act(() => apiSend(`/api/quotes/${q.id}/send`, 'POST'))} className="text-blue-600 hover:underline text-xs">
                      Enviar
                    </button>
                  )}
                  {q.status === 'SENT' && (
                    <>
                      <button disabled={busy} onClick={() => act(() => apiSend(`/api/quotes/${q.id}/approve`, 'POST'))} className="text-green-600 hover:underline text-xs">
                        Aprobar
                      </button>
                      <button disabled={busy} onClick={() => act(() => apiSend(`/api/quotes/${q.id}/reject`, 'POST'))} className="text-red-600 hover:underline text-xs">
                        Rechazar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
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

  const pct = summary && summary.orderTotal > 0 ? Math.min(100, (summary.totalPaid / summary.orderTotal) * 100) : 0;
  const fmt = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Pagos</h2>
        <button onClick={() => setShowForm((s) => !s)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm">
          Registrar pago
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {summary && (
        <>
          <div className="mb-1 flex justify-between text-sm text-gray-600">
            <span>Pagado: {fmt(summary.totalPaid)}</span>
            <span>Saldo: {fmt(summary.balance)}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}

      {showForm && (
        <div className="flex flex-wrap gap-2 mb-4">
          <input type="number" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-32 border border-gray-300 rounded-md px-3 py-1.5 text-sm" />
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <input placeholder="Referencia" value={reference} onChange={(e) => setReference(e.target.value)} className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm" />
          <button disabled={busy || !amount} onClick={() => void register()} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-40">
            Guardar
          </button>
        </div>
      )}

      <table className="min-w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {summary?.payments.length === 0 && (
            <tr>
              <td className="py-2 text-gray-400">Sin pagos</td>
            </tr>
          )}
          {summary?.payments.map((p) => (
            <tr key={p.id}>
              <td className="py-2 text-gray-600">{new Date(p.paidAt).toLocaleDateString('es-CO')}</td>
              <td className="py-2 text-gray-600">{PAYMENT_METHOD_LABELS[p.paymentMethod]}</td>
              <td className="py-2 text-gray-500">{p.reference}</td>
              <td className="py-2 text-right font-medium text-gray-800">{fmt(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
