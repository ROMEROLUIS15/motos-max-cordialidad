'use client';

import Link from 'next/link';
import { Search, Bike, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, fieldBase } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Step } from './step';
import type { UseVehiclePickerResult } from './use-vehicle-picker';

export function VehicleStep({
  form,
  hasExistingCustomer,
}: {
  form: UseVehiclePickerResult;
  /** Whether the vehicle list/dropdown applies (an existing customer is selected, not a brand-new one). */
  hasExistingCustomer: boolean;
}) {
  const {
    vehicles,
    vehicleId,
    setVehicleId,
    newVehicle,
    setNewVehicle,
    motoQuery,
    setMotoQuery,
    motoSuggestions,
    activeOrder,
    vForm,
    setVForm,
    pickMoto,
  } = form;

  return (
    <Step n={2} title="Moto">
      {!newVehicle && hasExistingCustomer && vehicles.length > 0 && (
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
      {activeOrder && !newVehicle && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3.5 py-2.5 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Esta moto ya tiene una orden activa (
            <Link href={`/work-orders/${activeOrder.id}`} className="font-semibold underline">
              {activeOrder.orderNumber}
            </Link>
            ). Complétala o cancélala antes de crear otra.
          </span>
        </div>
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
              placeholder="Buscar marca/modelo…"
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
              aria-label="Año"
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
              placeholder="N° motor"
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
          {hasExistingCustomer && vehicles.length > 0 && (
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
  );
}
