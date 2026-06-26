'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Bike } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { WorkOrderStatus } from '@/types/workshop';

interface CustomerProfile {
  customer: {
    id: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    phone: string;
    whatsappPhone: string | null;
    email: string | null;
    address: string | null;
    city: string;
    visitCount: number;
    isActive: boolean;
  };
  vehicles: Array<{
    id: string;
    plate: string;
    brand: string;
    model: string;
    year: number;
    color: string;
  }>;
  recentWorkOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    vehicle: { plate: string };
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

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<CustomerProfile>(`/api/customers/${id}`)
      .then(setProfile)
      .catch(() => router.push('/customers'))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-5 md:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }
  if (!profile) return null;

  const { customer, vehicles, recentWorkOrders } = profile;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{customer.fullName}</h1>
          <Badge variant={customer.isActive ? 'success' : 'secondary'}>
            {customer.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border/60">
              <Detail label="Documento">
                {customer.documentType} {customer.documentNumber}
              </Detail>
              <Detail label="Teléfono">{customer.phone}</Detail>
              {customer.whatsappPhone && <Detail label="WhatsApp">{customer.whatsappPhone}</Detail>}
              {customer.email && <Detail label="Email">{customer.email}</Detail>}
              <Detail label="Ciudad">{customer.city}</Detail>
              <Detail label="Visitas">{customer.visitCount}</Detail>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Vehículos ({vehicles.length})</CardTitle>
            <Link
              href={`/receptions/new?customerId=${customer.id}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <Plus className="h-4 w-4" /> Recepción
            </Link>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Sin vehículos registrados</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {vehicles.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Bike className="h-4 w-4 text-muted-foreground" /> {v.plate}
                    </span>
                    <span className="text-muted-foreground">
                      {v.brand} {v.model} · {v.year}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Órdenes recientes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentWorkOrders.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">Sin órdenes de trabajo</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-y border-border text-left">
                    {['Número', 'Vehículo', 'Estado', 'Fecha'].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentWorkOrders.map((wo) => (
                    <tr
                      key={wo.id}
                      onClick={() => router.push(`/work-orders/${wo.id}`)}
                      className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-secondary/40"
                    >
                      <td className="px-5 py-3 font-medium text-primary">{wo.orderNumber}</td>
                      <td className="tnum px-5 py-3 text-muted-foreground">{wo.vehicle.plate}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={wo.status as WorkOrderStatus} />
                      </td>
                      <td className="tnum px-5 py-3 text-muted-foreground">
                        {new Date(wo.createdAt).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
