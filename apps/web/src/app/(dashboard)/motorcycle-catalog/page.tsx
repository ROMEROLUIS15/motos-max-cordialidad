'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Bike } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState, ErrorState, TableRowsSkeleton } from '@/components/ui/states';
import { cn } from '@/lib/utils';

interface CustomModel {
  id: string;
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number | null;
}

export default function MotorcycleCatalogPage() {
  const [items, setItems] = useState<CustomModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ brand: '', model: '', yearFrom: '1995', yearTo: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await apiGet<CustomModel[]>('/api/motorcycle-catalog/custom'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/motorcycle-catalog/custom', 'POST', {
        brand: form.brand.trim(),
        model: form.model.trim(),
        yearFrom: form.yearFrom ? Number(form.yearFrom) : 1995,
        yearTo: form.yearTo ? Number(form.yearTo) : null,
      });
      setForm({ brand: '', model: '', yearFrom: '1995', yearTo: '' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await apiSend(`/api/motorcycle-catalog/custom/${id}`, 'DELETE');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Catálogo de motos"
        description="Hay un catálogo base curado siempre disponible en la búsqueda. Aquí agregas tus propios modelos."
      />
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Agregar modelo</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Input
              className="sm:col-span-2"
              placeholder="Marca"
              value={form.brand}
              onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Modelo"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Año desde"
              value={form.yearFrom}
              onChange={(e) => setForm((f) => ({ ...f, yearFrom: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="Año hasta (opcional)"
              value={form.yearTo}
              onChange={(e) => setForm((f) => ({ ...f, yearTo: e.target.value }))}
            />
            <Button
              className="sm:col-span-2"
              disabled={busy || !form.brand || !form.model}
              onClick={() => void add()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{' '}
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Marca', 'Modelo', 'Años', ''].map((h, i) => (
                  <th
                    key={h || i}
                    className={cn(
                      'px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground',
                      i === 3 && 'text-right',
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowsSkeleton rows={4} cols={4} />
              ) : error ? (
                <tr>
                  <td colSpan={4}>
                    <ErrorState message={error} onRetry={() => void load()} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={Bike}
                      title="Sin modelos personalizados"
                      description="El catálogo base ya cubre las marcas comunes. Agrega aquí los que falten."
                    />
                  </td>
                </tr>
              ) : (
                items.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">{m.brand}</td>
                    <td className="px-4 py-3 text-foreground/90">{m.model}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.yearFrom}–{m.yearTo ?? 'hoy'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={busy}
                        onClick={() => void remove(m.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
