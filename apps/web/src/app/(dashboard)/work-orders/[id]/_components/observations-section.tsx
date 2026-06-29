'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiSend } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { SectionCard } from './section-card';
import type { Run } from './types';

export function ObservationsSection({
  workOrderId,
  observations,
  busy,
  run,
}: {
  workOrderId: string;
  observations: string | null;
  busy: boolean;
  run: Run;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(observations ?? '');

  return (
    <SectionCard
      title="Observaciones del servicio"
      action={
        !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            {observations ? 'Editar' : 'Añadir'}
          </Button>
        )
      }
    >
      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Qué encontró/hizo el mecánico"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setText(observations ?? '');
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await apiSend(`/api/work-orders/${workOrderId}`, 'PUT', { observations: text });
                  setEditing(false);
                })
              }
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </Button>
          </div>
        </div>
      ) : observations ? (
        <p className="whitespace-pre-wrap text-sm text-foreground/90">{observations}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Sin observaciones registradas.</p>
      )}
    </SectionCard>
  );
}
