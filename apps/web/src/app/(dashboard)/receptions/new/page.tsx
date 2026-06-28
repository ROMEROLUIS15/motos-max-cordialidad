'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, Plus, X, UserPlus, Bike, UploadCloud } from 'lucide-react';
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
interface ServiceCatalogItem {
  id: string;
  name: string;
  suggestedPrice: number;
  serviceType: string;
}
interface MotoCatalogEntry {
  brand: string;
  model: string;
  yearFrom: number;
  yearTo: number | null;
}
interface SelectedService {
  id: string;
  name: string;
  price: string;
}

const money = (n: number) =>
  n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

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

export default function NewOrderPage() {
  const router = useRouter();
  const { technicians } = useTeam();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // --- Customer ---
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const [cForm, setCForm] = useState({ fullName: '', documentNumber: '', phone: '', city: '' });

  // --- Vehicle ---
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [newVehicle, setNewVehicle] = useState(false);
  const [vForm, setVForm] = useState({
    brand: '',
    model: '',
    year: '',
    plate: '',
    color: '',
    engineNumber: '',
    displacement: '',
  });
  const [motoQuery, setMotoQuery] = useState('');
  const [motoSuggestions, setMotoSuggestions] = useState<MotoCatalogEntry[]>([]);

  // --- Services ---
  const [svcQuery, setSvcQuery] = useState('');
  const [svcSuggestions, setSvcSuggestions] = useState<ServiceCatalogItem[]>([]);
  const [services, setServices] = useState<SelectedService[]>([]);

  // --- Order ---
  const [technicianId, setTechnicianId] = useState('');
  const [problem, setProblem] = useState('');
  const [promised, setPromised] = useState('');

  // --- Reception (optional) ---
  const [showReception, setShowReception] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState<FuelLevel>('HALF');
  const [damage, setDamage] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    if (!debounced || customer) {
      setCustomers([]);
      return;
    }
    apiGet<PaginatedResponse<Customer>>(
      `/api/customers?search=${encodeURIComponent(debounced)}&pageSize=8`,
    )
      .then((d) => setCustomers(d.items))
      .catch((e) => setError((e as Error).message));
  }, [debounced, customer]);

  useEffect(() => {
    if (!motoQuery) {
      setMotoSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      apiGet<MotoCatalogEntry[]>(
        `/api/motorcycle-catalog?search=${encodeURIComponent(motoQuery)}&limit=10`,
      )
        .then(setMotoSuggestions)
        .catch(() => setMotoSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [motoQuery]);

  useEffect(() => {
    if (!svcQuery) {
      setSvcSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      apiGet<PaginatedResponse<ServiceCatalogItem>>(
        `/api/service-catalog?search=${encodeURIComponent(svcQuery)}&isActive=true&pageSize=6`,
      )
        .then((d) => setSvcSuggestions(d.items))
        .catch(() => setSvcSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [svcQuery]);

  const selectCustomer = async (c: Customer) => {
    setCustomer(c);
    setNewCustomer(false);
    setCustomers([]);
    setSearch(c.fullName);
    setVehicleId('');
    setNewVehicle(false);
    try {
      setVehicles(await apiGet<Vehicle[]>(`/api/customers/${c.id}/vehicles`));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const clearCustomer = () => {
    setCustomer(null);
    setSearch('');
    setVehicles([]);
    setVehicleId('');
    setNewVehicle(false);
  };

  const pickMoto = (e: MotoCatalogEntry) => {
    setVForm((f) => ({ ...f, brand: e.brand, model: e.model }));
    setMotoQuery('');
    setMotoSuggestions([]);
  };

  const addService = (s: ServiceCatalogItem) => {
    if (!services.some((x) => x.id === s.id)) {
      setServices((prev) => [...prev, { id: s.id, name: s.name, price: String(s.suggestedPrice) }]);
    }
    setSvcQuery('');
    setSvcSuggestions([]);
  };

  const customerReady =
    !!customer ||
    (newCustomer && cForm.fullName && cForm.documentNumber && cForm.phone && cForm.city);
  const vehicleReady =
    (!!vehicleId && !newVehicle) ||
    (newVehicle && vForm.brand && vForm.model && vForm.plate && vForm.color);

  const save = async () => {
    if (!customerReady) {
      setError('Selecciona un cliente existente o completa los datos del cliente nuevo.');
      return;
    }
    if (!vehicleReady) {
      setError(
        'Completa la moto: marca, modelo, placa y color (o elige una existente). El año es opcional.',
      );
      return;
    }
    if (!technicianId) {
      setError('Selecciona el mecánico que atiende.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // 1) Customer
      let customerId = customer?.id;
      if (!customerId) {
        const c = await apiSend<{ id: string }>('/api/customers', 'POST', {
          fullName: cForm.fullName.trim(),
          documentType: 'CC',
          documentNumber: cForm.documentNumber.trim(),
          phone: cForm.phone.trim(),
          city: cForm.city.trim(),
        });
        customerId = c.id;
      }

      // 2) Vehicle
      let vehId = vehicleId;
      if (newVehicle || !vehId) {
        const v = await apiSend<{ id: string }>('/api/vehicles', 'POST', {
          currentOwnerId: customerId,
          plate: vForm.plate.trim().toUpperCase(),
          brand: vForm.brand.trim(),
          model: vForm.model.trim(),
          year: vForm.year ? Number(vForm.year) : undefined,
          color: vForm.color.trim(),
          engineNumber: vForm.engineNumber.trim(),
          displacement: vForm.displacement ? Number(vForm.displacement) : undefined,
        });
        vehId = v.id;
      }

      // 3) Reception (always created — links the order; extras optional)
      const rec = await apiSend<{ id: string }>('/api/receptions', 'POST', {
        vehicleId: vehId,
        odometerReading: odometer ? Number(odometer) : 0,
        fuelLevel: fuel,
        visibleDamageNotes: damage || undefined,
      });

      // 3b) Reception photos (best-effort; don't block the order on a bad upload)
      for (const file of photos) {
        try {
          await apiUpload(`/api/receptions/${rec.id}/photos`, file);
        } catch {
          /* ignore individual photo failures */
        }
      }

      // 4) Work order
      const wo = await apiSend<{ id: string }>('/api/work-orders', 'POST', {
        receptionId: rec.id,
        technicianId,
        serviceType: services[0]?.name ?? 'Servicio general',
        problemDescription: problem.trim() || 'Servicio de taller',
        promisedDeliveryAt: new Date(promised || Date.now() + 3 * 86400000).toISOString(),
      });

      // 5) Service lines from the catalog
      for (const s of services) {
        await apiSend(`/api/work-orders/${wo.id}/lines`, 'POST', {
          description: s.name,
          unitPrice: Number(s.price) || 0,
          technicianId,
          serviceCatalogId: s.id,
        });
      }

      router.push(`/work-orders/${wo.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Nueva orden"
        description="Registra el ingreso de la moto: cliente, vehículo, servicios y mecánico"
      />
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 1. Cliente */}
      <Step n={1} title="Cliente">
        {customer ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm">
            <span>
              <span className="font-medium">{customer.fullName}</span>{' '}
              <span className="text-muted-foreground">
                · {customer.documentNumber} · {customer.phone}
              </span>
            </span>
            <button onClick={clearCustomer} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : newCustomer ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                placeholder="Nombre completo"
                value={cForm.fullName}
                onChange={(e) => setCForm((f) => ({ ...f, fullName: e.target.value }))}
              />
              <Input
                placeholder="Documento"
                value={cForm.documentNumber}
                onChange={(e) => setCForm((f) => ({ ...f, documentNumber: e.target.value }))}
              />
              <Input
                placeholder="Teléfono"
                value={cForm.phone}
                onChange={(e) => setCForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Input
                placeholder="Ciudad"
                value={cForm.city}
                onChange={(e) => setCForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            <button
              onClick={() => setNewCustomer(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Buscar un cliente existente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre, documento o teléfono…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
            <Button variant="outline" size="sm" onClick={() => setNewCustomer(true)}>
              <UserPlus className="h-4 w-4" /> Cliente nuevo
            </Button>
          </div>
        )}
      </Step>

      {/* 2. Moto */}
      {customerReady && (
        <Step n={2} title="Moto">
          {!newVehicle && customer && vehicles.length > 0 && (
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className={cn(fieldBase, 'cursor-pointer')}
            >
              <option value="">Selecciona una moto</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} — {v.brand} {v.model}
                </option>
              ))}
            </select>
          )}

          {!newVehicle ? (
            <Button variant="outline" size="sm" onClick={() => setNewVehicle(true)}>
              <Bike className="h-4 w-4" /> Agregar moto nueva
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar marca/modelo (ej. Yamaha FZ)…"
                  value={motoQuery}
                  onChange={(e) => setMotoQuery(e.target.value)}
                />
                {motoSuggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-card-hover">
                    {motoSuggestions.map((e, i) => (
                      <li key={`${e.brand}-${e.model}-${i}`}>
                        <button
                          onClick={() => pickMoto(e)}
                          className="w-full border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-secondary/60"
                        >
                          <span className="font-medium">
                            {e.brand} {e.model}
                          </span>{' '}
                          <span className="text-muted-foreground">
                            ({e.yearFrom}–{e.yearTo ?? 'hoy'})
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Marca"
                  value={vForm.brand}
                  onChange={(e) => setVForm((f) => ({ ...f, brand: e.target.value }))}
                />
                <Input
                  placeholder="Modelo"
                  value={vForm.model}
                  onChange={(e) => setVForm((f) => ({ ...f, model: e.target.value }))}
                />
                <select
                  aria-label="Año (opcional)"
                  value={vForm.year}
                  onChange={(e) => setVForm((f) => ({ ...f, year: e.target.value }))}
                  className={cn(fieldBase, 'cursor-pointer')}
                >
                  <option value="">Año (opcional)</option>
                  {Array.from(
                    { length: new Date().getFullYear() + 1 - 1960 + 1 },
                    (_, i) => new Date().getFullYear() + 1 - i,
                  ).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="Placa"
                  value={vForm.plate}
                  onChange={(e) => setVForm((f) => ({ ...f, plate: e.target.value }))}
                />
                <Input
                  placeholder="Color"
                  value={vForm.color}
                  onChange={(e) => setVForm((f) => ({ ...f, color: e.target.value }))}
                />
                <Input
                  placeholder="N° de motor (opcional)"
                  value={vForm.engineNumber}
                  onChange={(e) => setVForm((f) => ({ ...f, engineNumber: e.target.value }))}
                />
                <Input
                  placeholder="Cilindraje (opcional)"
                  type="number"
                  value={vForm.displacement}
                  onChange={(e) => setVForm((f) => ({ ...f, displacement: e.target.value }))}
                />
              </div>
              {customer && vehicles.length > 0 && (
                <button
                  onClick={() => setNewVehicle(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Elegir una moto existente
                </button>
              )}
            </div>
          )}
        </Step>
      )}

      {/* 3. Servicios */}
      {customerReady && vehicleReady && (
        <Step n={3} title="Servicios">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar servicio del catálogo…"
              value={svcQuery}
              onChange={(e) => setSvcQuery(e.target.value)}
            />
            {svcSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-card-hover">
                {svcSuggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => addService(s)}
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
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Agrega uno o más servicios del catálogo (puedes ajustar el precio).
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {services.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex-1 text-foreground/90">{s.name}</span>
                  <Input
                    className="w-28"
                    type="number"
                    value={s.price}
                    onChange={(e) =>
                      setServices((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)),
                      )
                    }
                  />
                  <button
                    onClick={() => setServices((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Quitar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Step>
      )}

      {/* 4. Mecánico y observaciones */}
      {customerReady && vehicleReady && (
        <Step n={4} title="Mecánico y observaciones">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <FieldLabel label="Entrega prometida (opcional)">
              <Input
                type="datetime-local"
                value={promised}
                onChange={(e) => setPromised(e.target.value)}
              />
            </FieldLabel>
          </div>
          <FieldLabel label="Observaciones / problema reportado">
            <Textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={2}
              placeholder="Qué reporta el cliente o qué se va a hacer"
            />
          </FieldLabel>

          <button
            onClick={() => setShowReception((s) => !s)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {showReception ? '− Ocultar' : '+ Agregar'} datos de recepción (opcional)
          </button>
          {showReception && (
            <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldLabel label="Odómetro (km)">
                  <Input
                    type="number"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                  />
                </FieldLabel>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground/90">Combustible</span>
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
              <FieldLabel label="Daños visibles">
                <Textarea value={damage} onChange={(e) => setDamage(e.target.value)} rows={2} />
              </FieldLabel>
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-foreground/90">
                  Fotos de ingreso ({photos.length}/10)
                </span>
                <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-border bg-background/40 px-4 py-5 text-center text-sm text-muted-foreground hover:border-primary/50">
                  <UploadCloud className="h-5 w-5" />
                  Selecciona o arrastra imágenes
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={(e) =>
                      e.target.files &&
                      setPhotos((p) => [...p, ...Array.from(e.target.files!)].slice(0, 10))
                    }
                  />
                </label>
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {photos.map((f, i) => (
                      <div key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(f)}
                          alt={f.name}
                          className="h-16 w-16 rounded-lg border border-border object-cover"
                        />
                        <button
                          onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                          aria-label="Quitar foto"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Step>
      )}

      <div className="flex justify-end">
        <Button disabled={busy} onClick={() => void save()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          <Plus className="h-4 w-4" /> Guardar orden
        </Button>
      </div>
    </div>
  );
}
