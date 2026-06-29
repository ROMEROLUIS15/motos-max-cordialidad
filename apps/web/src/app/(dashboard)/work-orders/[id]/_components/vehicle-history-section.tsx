'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, ChevronRight, ImageIcon } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { VehicleServiceHistory } from './types';

export function VehicleHistorySection({
  vehicleId,
  currentOrderId,
}: {
  vehicleId: string;
  currentOrderId: string;
}) {
  const [history, setHistory] = useState<VehicleServiceHistory | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!vehicleId) return;
    apiGet<VehicleServiceHistory>(`/api/vehicles/${vehicleId}/history`)
      .then(setHistory)
      .catch(() => setFailed(true));
  }, [vehicleId]);

  if (failed) return null;

  const orders = history?.workOrders ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <History className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">
          Historial de la moto{history ? ` (${orders.length})` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!history ? (
          <div className="space-y-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        ) : orders.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Esta moto no tiene otras órdenes registradas.
          </p>
        ) : (
          <div className="space-y-2.5">
            {orders.map((wo) => {
              const isCurrent = wo.id === currentOrderId;
              const inner = (
                <div
                  className={cn(
                    'rounded-lg border p-3 transition-colors',
                    isCurrent
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-background/40 hover:border-border/80',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className={isCurrent ? 'text-foreground' : 'text-primary'}>
                        {wo.orderNumber}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                          Esta orden
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={wo.status} />
                      {!isCurrent && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {new Date(wo.createdAt).toLocaleDateString('es-CO')} · {wo.serviceType}
                  </div>
                  {wo.parts.length > 0 && (
                    <div className="mt-1.5 text-xs text-foreground/70">
                      Repuestos: {wo.parts.map((p) => `${p.part.name} (x${p.quantity})`).join(', ')}
                    </div>
                  )}
                  {wo.photoEvidences.length > 0 && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ImageIcon className="h-3.5 w-3.5" /> {wo.photoEvidences.length} foto(s)
                    </div>
                  )}
                </div>
              );
              return isCurrent ? (
                <div key={wo.id}>{inner}</div>
              ) : (
                <Link key={wo.id} href={`/work-orders/${wo.id}`} className="block">
                  {inner}
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
