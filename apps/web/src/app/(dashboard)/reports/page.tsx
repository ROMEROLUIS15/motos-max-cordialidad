'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileBarChart, Download } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, TableRowsSkeleton } from '@/components/ui/states';

interface Report {
  id: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  generatedAt: string | null;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, 'success' | 'default' | 'destructive' | 'secondary'> = {
  READY: 'success',
  PENDING: 'default',
  FAILED: 'destructive',
};

const POLL_MS = 30_000;

export default function ReportsPage() {
  const [items, setItems] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<PaginatedResponse<Report>>('/api/reports?pageSize=50');
      setItems(data.items);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function download(id: string) {
    setDownloading(id);
    try {
      const { url } = await apiGet<{ url: string }>(`/api/reports/${id}/download`);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      setDownloadError((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-5">
      {downloadError && <p className="text-sm text-destructive">{downloadError}</p>}
      <PageHeader
        title="Reportes"
        description="Reportes semanales y mensuales generados por el agente"
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="rtable w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Tipo', 'Período', 'Estado', 'Generado', ''].map((h) => (
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
                <TableRowsSkeleton rows={6} cols={5} />
              ) : error ? (
                <tr>
                  <td colSpan={5}>
                    <ErrorState message={error} onRetry={() => void load()} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      icon={FileBarChart}
                      title="Sin reportes"
                      description="Aún no se han generado reportes."
                    />
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
                  >
                    <td data-label="Tipo" className="px-4 py-2.5 text-foreground/90">
                      {r.type === 'MONTHLY' ? 'Mensual' : 'Semanal'}
                    </td>
                    <td
                      data-label="Período"
                      className="tnum whitespace-nowrap px-4 py-2.5 text-muted-foreground"
                    >
                      {r.periodStart} — {r.periodEnd}
                    </td>
                    <td data-label="Estado" className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[r.status] ?? 'secondary'}>{r.status}</Badge>
                    </td>
                    <td
                      data-label="Generado"
                      className="tnum whitespace-nowrap px-4 py-2.5 text-muted-foreground"
                    >
                      {r.generatedAt ? new Date(r.generatedAt).toLocaleString('es-CO') : '—'}
                    </td>
                    <td data-label="" className="px-4 py-2.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={r.status !== 'READY' || downloading === r.id}
                        onClick={() => void download(r.id)}
                      >
                        <Download className="h-4 w-4" /> PDF
                      </Button>
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
