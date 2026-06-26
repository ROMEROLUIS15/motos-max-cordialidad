'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Wrench, Loader2 } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import type { ServiceCatalogItem } from '@/types/inventory';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, TableRowsSkeleton } from '@/components/ui/states';

const money = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function ServiceCatalogPage() {
  const [items, setItems] = useState<ServiceCatalogItem[]>([]);
  const [serviceType, setServiceType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ServiceCatalogItem | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (serviceType) params.set('serviceType', serviceType);
      const data = await apiGet<PaginatedResponse<ServiceCatalogItem>>(
        `/api/service-catalog?${params}`,
      );
      setItems(data.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [serviceType]);

  useEffect(() => {
    void load();
  }, [load]);

  const deactivate = async (id: string) => {
    try {
      await apiSend(`/api/service-catalog/${id}/deactivate`, 'POST');
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Catálogo de servicios"
        description="Servicios y precios sugeridos del taller"
      >
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus /> Nuevo servicio
        </Button>
      </PageHeader>

      <Input
        className="max-w-md"
        placeholder="Filtrar por tipo de servicio…"
        value={serviceType}
        onChange={(e) => setServiceType(e.target.value)}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Nombre', 'Tipo', 'Horas est.', 'Precio sugerido', 'Estado', ''].map((h, i) => (
                  <th
                    key={h || i}
                    className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground ${i === 5 ? 'text-right' : ''}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowsSkeleton rows={6} cols={6} />
              ) : error ? (
                <tr>
                  <td colSpan={6}>
                    <ErrorState message={error} onRetry={() => void load()} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={Wrench}
                      title="Sin servicios"
                      description="Crea el primer servicio del catálogo."
                    />
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr
                    key={it.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{it.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{it.serviceType}</td>
                    <td className="tnum px-4 py-3 text-muted-foreground">{it.estimatedHours} h</td>
                    <td className="tnum px-4 py-3 text-foreground/90">
                      {money(it.suggestedPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={it.isActive ? 'success' : 'secondary'}>
                        {it.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(it);
                            setShowForm(true);
                          }}
                        >
                          Editar
                        </Button>
                        {it.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => void deactivate(it.id)}
                          >
                            Desactivar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && (
        <ServiceFormModal
          item={editing}
          onClose={() => setShowForm(false)}
          onDone={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ServiceFormModal({
  item,
  onClose,
  onDone,
}: {
  item: ServiceCatalogItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? '',
    serviceType: item?.serviceType ?? '',
    estimatedHours: item ? String(item.estimatedHours) : '',
    suggestedPrice: item ? String(item.suggestedPrice) : '',
    description: item?.description ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: form.name,
        serviceType: form.serviceType,
        estimatedHours: Number(form.estimatedHours),
        suggestedPrice: Number(form.suggestedPrice),
        description: form.description || undefined,
      };
      if (item) await apiSend(`/api/service-catalog/${item.id}`, 'PUT', body);
      else await apiSend('/api/service-catalog', 'POST', body);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Editar servicio' : 'Nuevo servicio'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={
              busy ||
              !form.name ||
              !form.serviceType ||
              !form.estimatedHours ||
              !form.suggestedPrice
            }
            onClick={() => void submit()}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          placeholder="Tipo de servicio"
          value={form.serviceType}
          onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Horas estimadas"
            type="number"
            value={form.estimatedHours}
            onChange={(e) => setForm((f) => ({ ...f, estimatedHours: e.target.value }))}
          />
          <Input
            placeholder="Precio sugerido"
            type="number"
            value={form.suggestedPrice}
            onChange={(e) => setForm((f) => ({ ...f, suggestedPrice: e.target.value }))}
          />
        </div>
        <Textarea
          placeholder="Descripción (opcional)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}
