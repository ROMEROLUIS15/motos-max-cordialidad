'use client';

import { useState } from 'react';
import { STATUS_LABELS, type WorkOrderStatus } from '@/types/workshop';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TransitionButton({
  next,
  busy,
  onClick,
}: {
  next: WorkOrderStatus;
  busy: boolean;
  onClick: (finalOdometer?: number) => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [odometer, setOdometer] = useState('');

  if (next === 'COMPLETED' && showInput) {
    return (
      <div className="flex items-center gap-2">
        <Input
          className="w-28"
          type="number"
          placeholder="Odómetro (km)"
          value={odometer}
          onChange={(e) => setOdometer(e.target.value)}
          autoFocus
        />
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            onClick(odometer ? Number(odometer) : undefined);
            setShowInput(false);
            setOdometer('');
          }}
        >
          Confirmar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setShowInput(false);
            setOdometer('');
          }}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => {
        if (next === 'COMPLETED') {
          setShowInput(true);
        } else {
          onClick();
        }
      }}
    >
      {STATUS_LABELS[next]}
    </Button>
  );
}
