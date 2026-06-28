'use client';

import { useCallback, useEffect, useState } from 'react';
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, TableRowsSkeleton } from '@/components/ui/states';
import { fieldBase } from '@/components/ui/input';

interface AuditEntry {
  id: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  ipAddress: string | null;
  createdAt: string;
}

const PAGE_SIZE = 30;

const ACTION_VARIANT: Record<string, 'success' | 'default' | 'destructive' | 'secondary'> = {
  CREATE: 'success',
  UPDATE: 'default',
  DELETE: 'destructive',
};

export default function AuditPage() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (entityType) params.set('entityType', entityType);
      if (action) params.set('action', action);
      const data = await apiGet<PaginatedResponse<AuditEntry>>(`/api/audit?${params}`);
      setItems(data.items);
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        msg.includes('permission') || msg.includes('403')
          ? 'Solo el propietario (OWNER) puede ver la auditoría.'
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <PageHeader title="Auditoría" description="Registro inmutable de operaciones del sistema" />

      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          className="w-auto min-w-[200px]"
          placeholder="Filtrar por tipo de entidad…"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        />
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className={cn(fieldBase, 'w-auto min-w-[170px] cursor-pointer')}
        >
          <option value="">Todas las acciones</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="rtable w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Fecha', 'Acción', 'Entidad', 'ID', 'Usuario', 'IP'].map((h) => (
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
                <TableRowsSkeleton rows={8} cols={6} />
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
                      icon={ScrollText}
                      title="Sin registros"
                      description="No hay eventos para estos filtros."
                    />
                  </td>
                </tr>
              ) : (
                items.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
                  >
                    <td
                      data-label="Fecha"
                      className="tnum whitespace-nowrap px-4 py-2.5 text-muted-foreground"
                    >
                      {new Date(e.createdAt).toLocaleString('es-CO')}
                    </td>
                    <td data-label="Acción" className="px-4 py-2.5">
                      <Badge variant={ACTION_VARIANT[e.action] ?? 'secondary'}>{e.action}</Badge>
                    </td>
                    <td data-label="Entidad" className="px-4 py-2.5 text-foreground/90">
                      {e.entityType}
                    </td>
                    <td
                      data-label="ID"
                      className="px-4 py-2.5 font-mono text-xs text-muted-foreground/70"
                    >
                      {e.entityId}
                    </td>
                    <td
                      data-label="Usuario"
                      className="px-4 py-2.5 font-mono text-xs text-muted-foreground/70"
                    >
                      {e.actorUserId ?? '—'}
                    </td>
                    <td data-label="IP" className="tnum px-4 py-2.5 text-muted-foreground">
                      {e.ipAddress ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && items.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
            <span className="mr-auto text-xs text-muted-foreground">Página {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={items.length < PAGE_SIZE}
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
