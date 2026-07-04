'use client';

import { UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input, Textarea, fieldBase } from '@/components/ui/input';
import { FUEL_LEVELS, FUEL_LABELS, type FuelLevel } from '@/types/workshop';
import { Step, FieldLabel } from './step';
import type { TeamMember } from '@/hooks/use-team';

export interface TechnicianStepProps {
  technicians: TeamMember[];
  technicianId: string;
  setTechnicianId: (id: string) => void;
  promised: string;
  setPromised: (value: string) => void;
  problem: string;
  setProblem: (value: string) => void;
  showReception: boolean;
  setShowReception: (fn: (prev: boolean) => boolean) => void;
  odometer: string;
  setOdometer: (value: string) => void;
  fuel: FuelLevel;
  setFuel: (value: FuelLevel) => void;
  damage: string;
  setDamage: (value: string) => void;
  photos: File[];
  setPhotos: React.Dispatch<React.SetStateAction<File[]>>;
}

export function TechnicianStep({
  technicians,
  technicianId,
  setTechnicianId,
  promised,
  setPromised,
  problem,
  setProblem,
  showReception,
  setShowReception,
  odometer,
  setOdometer,
  fuel,
  setFuel,
  damage,
  setDamage,
  photos,
  setPhotos,
}: TechnicianStepProps) {
  return (
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
              <Input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
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
  );
}
