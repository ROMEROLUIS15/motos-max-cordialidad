'use client';

import { useCallback, useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { useTeam } from '@/hooks/use-team';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, TableRowsSkeleton } from '@/components/ui/states';
import { fieldBase } from '@/components/ui/input';

interface HomeServiceRequest {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  serviceType: string;
  problemDesc: string;
  status: string;
  assignedTo: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'default' | 'destructive' | 'secondary'> = {
  PENDING: 'default',
  ASSIGNED: 'secondary',
  IN_PROGRESS: 'secondary',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};
const STATUSES = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const POLL_MS = 30_000;

export default function HomeServicesPage() {
  const [items, setItems] = useState<HomeServiceRequest[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { technicians, nameOf } = useTeam();

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (status) params.set('status', status);
      const data = await apiGet<PaginatedResponse<HomeServiceRequest>>(
        `/api/home-services?${params}`,
      );
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function assign(id: string, userId: string) {
    if (!userId) return;
    try {
      await apiSend(`/api/home-services/${id}/assign`, 'PATCH', { assignedTo: userId });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function changeStatus(id: string, newStatus: string) {
    try {
      await apiSend(`/api/home-services/${id}/status`, 'PATCH', { status: newStatus });
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Servicios a domicilio"
        description="Solicitudes capturadas por el agente o el equipo"
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={cn(fieldBase, 'w-auto min-w-[180px] cursor-pointer')}
        >
          <option value="">Todos los estados</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Cliente', 'Dirección', 'Tipo', 'Estado', 'Mecánico', 'Acciones'].map((h) => (
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
                      icon={Truck}
                      title="Sin solicitudes"
                      description="No hay servicios a domicilio para este filtro."
                    />
                  </td>
                </tr>
              ) : (
                items.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-border/60 last:border-0 align-top hover:bg-secondary/40"
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-foreground/90">{s.customerName}</div>
                      <div className="text-xs text-muted-foreground">{s.customerPhone}</div>
                    </td>
                    <td className="max-w-[220px] px-4 py-2.5 text-muted-foreground">{s.address}</td>
                    <td className="px-4 py-2.5 text-foreground/90">{s.serviceType}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[s.status] ?? 'secondary'}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{nameOf(s.assignedTo)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          defaultValue=""
                          onChange={(e) => void assign(s.id, e.target.value)}
                          className={cn(
                            fieldBase,
                            'h-8 w-auto min-w-[150px] cursor-pointer text-xs',
                          )}
                        >
                          <option value="" disabled>
                            Asignar mecánico…
                          </option>
                          {technicians.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.fullName}
                            </option>
                          ))}
                        </select>
                        <select
                          value={s.status}
                          onChange={(e) => void changeStatus(s.id, e.target.value)}
                          className={cn(fieldBase, 'h-8 w-auto cursor-pointer text-xs')}
                        >
                          {STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
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
