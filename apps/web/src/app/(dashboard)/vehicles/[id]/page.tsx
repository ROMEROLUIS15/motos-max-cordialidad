'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ImageIcon } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { WorkOrderStatus } from '@/types/workshop';

interface VehicleHistory {
  vehicle: {
    id: string;
    plate: string;
    brand: string;
    model: string;
    year: number | null;
    color: string;
    engineNumber: string;
    currentOdometer: number | null;
    fuelType: string | null;
    observations: string | null;
  };
  workOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    promisedDeliveryAt: string;
    serviceType: string;
    parts: Array<{
      quantity: number;
      unitPriceAtSale: string;
      part: { name: string; sku: string };
    }>;
    photoEvidences: Array<{ id: string; phase: string; filename: string }>;
  }>;
  ownershipHistory: Array<{
    id: string;
    previousOwner: string;
    newOwner: string;
    transferredAt: string;
  }>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground/90">{children}</dd>
    </div>
  );
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<VehicleHistory>(`/api/vehicles/${id}/history`)
      .then(setHistory)
      .catch(() => router.push('/'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-60 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
      </div>
    );
  }
  if (!history) return null;

  const { vehicle, workOrders, ownershipHistory } = history;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{vehicle.plate}</h1>
          <span className="text-muted-foreground">
            {vehicle.brand} {vehicle.model}
            {vehicle.year ? ` · ${vehicle.year}` : ''}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos básicos</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border/60">
              <Detail label="Placa">{vehicle.plate}</Detail>
              <Detail label="Marca / Modelo">
                {vehicle.brand} {vehicle.model}
              </Detail>
              <Detail label="Año">{vehicle.year ?? '—'}</Detail>
              <Detail label="Color">{vehicle.color}</Detail>
              <Detail label="Motor">{vehicle.engineNumber}</Detail>
              {vehicle.currentOdometer != null && (
                <Detail label="Odómetro">
                  {vehicle.currentOdometer.toLocaleString('es-CO')} km
                </Detail>
              )}
              {vehicle.fuelType && <Detail label="Combustible">{vehicle.fuelType}</Detail>}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de propietarios</CardTitle>
          </CardHeader>
          <CardContent>
            {ownershipHistory.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Sin transferencias registradas</p>
            ) : (
              <ul className="divide-y divide-border/60 text-sm">
                {ownershipHistory.map((h) => (
                  <li key={h.id} className="py-2 text-muted-foreground">
                    {new Date(h.transferredAt).toLocaleDateString('es-CO')}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de servicios ({workOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {workOrders.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Sin órdenes de trabajo</p>
          ) : (
            <div className="space-y-3">
              {workOrders.map((wo) => (
                <div
                  key={wo.id}
                  className="rounded-lg border border-border bg-background/40 p-3.5 transition-colors hover:border-border/80"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/work-orders/${wo.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {wo.orderNumber}
                    </Link>
                    <StatusBadge status={wo.status as WorkOrderStatus} />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {new Date(wo.createdAt).toLocaleDateString('es-CO')} · {wo.serviceType}
                  </div>
                  {wo.parts.length > 0 && (
                    <div className="mt-2 text-sm text-foreground/80">
                      Repuestos: {wo.parts.map((p) => `${p.part.name} (x${p.quantity})`).join(', ')}
                    </div>
                  )}
                  {wo.photoEvidences.length > 0 && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" /> {wo.photoEvidences.length} foto(s)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
