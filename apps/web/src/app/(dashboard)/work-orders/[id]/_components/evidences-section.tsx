'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { apiSend, apiUpload } from '@/lib/api';
import { PHOTO_PHASES, type PhotoEvidence, type PhotoPhase } from '@/types/workshop';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { fieldBase } from '@/components/ui/input';
import { SectionCard } from './section-card';
import type { Run } from './types';

export function EvidencesSection({
  evidences,
  workOrderId,
  busy,
  run,
}: {
  evidences: PhotoEvidence[];
  workOrderId: string;
  busy: boolean;
  run: Run;
}) {
  const [phase, setPhase] = useState<PhotoPhase>('INGRESO');
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <SectionCard title="Evidencias fotográficas">
      <div className="space-y-4">
        {PHOTO_PHASES.map((ph) => {
          const items = evidences.filter((e) => e.phase === ph);
          return (
            <div key={ph}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {ph}
              </h3>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin fotos</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {items.map((e) => (
                    <div key={e.id} className="group relative">
                      <img
                        src={e.url}
                        alt={e.filename}
                        className="h-24 w-24 rounded-lg border border-border object-cover"
                      />
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            apiSend(`/api/work-orders/${workOrderId}/evidences/${e.id}`, 'DELETE'),
                          )
                        }
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Eliminar foto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value as PhotoPhase)}
          className={cn(fieldBase, 'w-full cursor-pointer sm:w-auto')}
        >
          {PHOTO_PHASES.map((ph) => (
            <option key={ph} value={ph}>
              {ph}
            </option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/70 sm:w-auto"
        />
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            const file = fileRef.current?.files?.[0];
            if (!file) return;
            void run(async () => {
              await apiUpload(`/api/work-orders/${workOrderId}/evidences`, file, { phase });
              if (fileRef.current) fileRef.current.value = '';
            });
          }}
        >
          <Upload className="h-4 w-4" /> Subir
        </Button>
      </div>
    </SectionCard>
  );
}
