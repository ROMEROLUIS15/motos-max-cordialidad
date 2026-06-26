'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, UploadCloud } from 'lucide-react';
import { apiGet, apiSend, apiUpload } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { FUEL_LEVELS, FUEL_LABELS, type FuelLevel } from '@/types/workshop';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea, fieldBase } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { useTeam } from '@/hooks/use-team';

interface Customer {
  id: string;
  fullName: string;
  documentNumber: string;
  phone: string;
}
interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
}
interface Reception {
  id: string;
  branchId: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h2 className="flex items-center gap-2.5 text-sm font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {n}
          </span>
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground/90">{label}</span>
      {children}
    </label>
  );
}

export default function NewReceptionPage() {
  const router = useRouter();
  const { technicians } = useTeam();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');

  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState<FuelLevel>('HALF');
  const [observations, setObservations] = useState('');
  const [damage, setDamage] = useState('');

  const [reception, setReception] = useState<Reception | null>(null);
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);

  const [serviceType, setServiceType] = useState('');
  const [problem, setProblem] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [promised, setPromised] = useState('');
  const [serviceObservations, setServiceObservations] = useState('');

  useEffect(() => {
    if (!debounced) {
      setCustomers([]);
      return;
    }
    apiGet<PaginatedResponse<Customer>>(
      `/api/customers?search=${encodeURIComponent(debounced)}&pageSize=8`,
    )
      .then((d) => setCustomers(d.items))
      .catch((e) => setError((e as Error).message));
  }, [debounced]);

  const selectCustomer = async (c: Customer) => {
    setCustomer(c);
    setCustomers([]);
    setSearch(c.fullName);
    try {
      setVehicles(await apiGet<Vehicle[]>(`/api/customers/${c.id}/vehicles`));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createReception = async () => {
    if (!vehicleId || !odometer) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiSend<Reception>('/api/receptions', 'POST', {
        vehicleId,
        odometerReading: Number(odometer),
        fuelLevel: fuel,
        observations: observations || undefined,
        visibleDamageNotes: damage || undefined,
      });
      setReception(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadPhotos = async (files: FileList) => {
    if (!reception) return;
    const list = Array.from(files).slice(0, 10 - photos.length);
    setBusy(true);
    setError(null);
    try {
      for (const file of list) {
        await apiUpload(`/api/receptions/${reception.id}/photos`, file);
        setPhotos((p) => [...p, { name: file.name, url: URL.createObjectURL(file) }]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createWorkOrder = async () => {
    if (!reception || !serviceType || !problem || !technicianId || !promised) return;
    setBusy(true);
    setError(null);
    try {
      const wo = await apiSend<{ id: string }>('/api/work-orders', 'POST', {
        receptionId: reception.id,
        technicianId,
        serviceType,
        problemDescription: problem,
        promisedDeliveryAt: new Date(promised).toISOString(),
        observations: serviceObservations.trim() || undefined,
      });
      router.push(`/work-orders/${wo.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Nueva recepción"
        description="Registra el ingreso del vehículo y abre la orden"
      />
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <Step n={1} title="Cliente">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre, documento o teléfono…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCustomer(null);
            }}
          />
        </div>
        {customers.length > 0 && (
          <ul className="overflow-hidden rounded-lg border border-border">
            {customers.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => void selectCustomer(c)}
                  className="w-full border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-secondary/60"
                >
                  <span className="font-medium">{c.fullName}</span>{' '}
                  <span className="text-muted-foreground">
                    · {c.documentNumber} · {c.phone}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Step>

      {customer && (
        <Step n={2} title="Vehículo">
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              El cliente no tiene vehículos registrados.
            </p>
          ) : (
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className={cn(fieldBase, 'cursor-pointer')}
            >
              <option value="">Selecciona un vehículo</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.brand} {v.model}
                </option>
              ))}
            </select>
          )}
        </Step>
      )}

      {customer && vehicleId && !reception && (
        <Step n={3} title="Datos de recepción">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldLabel label="Odómetro (km)">
              <Input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
            </FieldLabel>
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground/90">Nivel de combustible</span>
              <div className="grid grid-cols-5 gap-1 rounded-lg border border-border bg-secondary/40 p-1">
                {FUEL_LEVELS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFuel(f)}
                    className={cn(
                      'rounded-md px-1 py-1.5 text-xs font-medium transition-colors',
                      fuel === f
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {FUEL_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <FieldLabel label="Observaciones">
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
            />
          </FieldLabel>
          <FieldLabel label="Daños visibles">
            <Textarea value={damage} onChange={(e) => setDamage(e.target.value)} rows={2} />
          </FieldLabel>
          <Button disabled={busy || !odometer} onClick={() => void createReception()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar recepción
          </Button>
        </Step>
      )}

      {reception && (
        <Step n={4} title={`Fotos de ingreso (${photos.length}/10)`}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) void uploadPhotos(e.dataTransfer.files);
            }}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/40 px-4 py-8 text-center"
          >
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Arrastra imágenes aquí o{' '}
              <label className="cursor-pointer font-medium text-primary hover:underline">
                selecciona archivos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  hidden
                  disabled={busy || photos.length >= 10}
                  onChange={(e) => e.target.files && void uploadPhotos(e.target.files)}
                />
              </label>
            </p>
          </div>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {photos.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={p.url}
                  alt={p.name}
                  className="h-20 w-20 rounded-lg border border-border object-cover"
                />
              ))}
            </div>
          )}
        </Step>
      )}

      {reception && (
        <Step n={5} title="Crear orden de trabajo">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldLabel label="Tipo de servicio">
              <Input value={serviceType} onChange={(e) => setServiceType(e.target.value)} />
            </FieldLabel>
            <FieldLabel label="Mecánico que atiende">
              <select
                value={technicianId}
                onChange={(e) => setTechnicianId(e.target.value)}
                className={cn(fieldBase, 'cursor-pointer')}
              >
                <option value="">Selecciona un mecánico</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <div className="sm:col-span-2">
              <FieldLabel label="Entrega prometida">
                <Input
                  type="datetime-local"
                  value={promised}
                  onChange={(e) => setPromised(e.target.value)}
                />
              </FieldLabel>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel label="Descripción del problema">
                <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} />
              </FieldLabel>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel label="Observaciones del servicio (opcional)">
                <Textarea
                  value={serviceObservations}
                  onChange={(e) => setServiceObservations(e.target.value)}
                  rows={2}
                  placeholder="Qué encontró/hizo el mecánico"
                />
              </FieldLabel>
            </div>
          </div>
          <Button
            disabled={busy || !serviceType || !problem || !technicianId || !promised}
            onClick={() => void createWorkOrder()}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Crear orden de trabajo
          </Button>
        </Step>
      )}
    </div>
  );
}
