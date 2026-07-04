'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { apiSend, apiUpload } from '@/lib/api';
import { type FuelLevel } from '@/types/workshop';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useTeam } from '@/hooks/use-team';
import { useCustomerSearch } from './use-customer-search';
import { useVehiclePicker } from './use-vehicle-picker';
import { useServiceCatalogPicker } from './use-service-catalog-picker';
import { CustomerStep } from './customer-step';
import { VehicleStep } from './vehicle-step';
import { ServicesStep } from './services-step';
import { TechnicianStep } from './technician-step';

export function OrderForm() {
  const router = useRouter();
  const { technicians } = useTeam();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const customerForm = useCustomerSearch();
  const vehicleForm = useVehiclePicker(customerForm.customer?.id, setError);
  const serviceForm = useServiceCatalogPicker();

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

  const { customer, cForm, customerReady } = customerForm;
  const { vehicleId, newVehicle, vForm, activeOrder, vehicleReady } = vehicleForm;
  const { services } = serviceForm;

  const save = async () => {
    if (!customerReady) {
      setError('Selecciona un cliente existente o completa los datos del cliente nuevo.');
      return;
    }
    if (activeOrder && !newVehicle) {
      setError(
        `Esta moto ya tiene la orden ${activeOrder.orderNumber} activa. Complétala o cancélala antes de crear otra.`,
      );
      return;
    }
    if (!vehicleReady) {
      setError('Completa la moto: marca, modelo, placa, color y número de motor.');
      return;
    }
    if (!technicianId) {
      setError('Selecciona el mecánico que atiende.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
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

      let vehId = vehicleId;
      if (newVehicle || !vehId) {
        const v = await apiSend<{ id: string }>('/api/vehicles', 'POST', {
          currentOwnerId: customerId,
          plate: vForm.plate.trim().toUpperCase(),
          brand: vForm.brand.trim(),
          model: vForm.model.trim(),
          year: vForm.year ? Number(vForm.year) : undefined,
          color: vForm.color.trim(),
          engineNumber: vForm.engineNumber.trim() || undefined,
          displacement: vForm.displacement ? Number(vForm.displacement) : undefined,
        });
        vehId = v.id;
      }

      const rec = await apiSend<{ id: string }>('/api/receptions', 'POST', {
        vehicleId: vehId,
        odometerReading: odometer ? Number(odometer) : 0,
        fuelLevel: fuel,
        visibleDamageNotes: damage || undefined,
      });

      for (const file of photos) {
        try {
          await apiUpload(`/api/receptions/${rec.id}/photos`, file);
        } catch {
          /* ignore */
        }
      }

      const wo = await apiSend<{ id: string }>('/api/work-orders', 'POST', {
        receptionId: rec.id,
        technicianId,
        serviceType: services[0]?.name ?? 'Servicio general',
        problemDescription: problem.trim() || 'Servicio de taller',
        promisedDeliveryAt: new Date(promised || Date.now() + 3 * 86400000).toISOString(),
      });

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

      <CustomerStep form={customerForm} />

      {customerReady && <VehicleStep form={vehicleForm} hasExistingCustomer={!!customer} />}

      {customerReady && vehicleReady && <ServicesStep form={serviceForm} />}

      {customerReady && vehicleReady && (
        <TechnicianStep
          technicians={technicians}
          technicianId={technicianId}
          setTechnicianId={setTechnicianId}
          promised={promised}
          setPromised={setPromised}
          problem={problem}
          setProblem={setProblem}
          showReception={showReception}
          setShowReception={setShowReception}
          odometer={odometer}
          setOdometer={setOdometer}
          fuel={fuel}
          setFuel={setFuel}
          damage={damage}
          setDamage={setDamage}
          photos={photos}
          setPhotos={setPhotos}
        />
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
