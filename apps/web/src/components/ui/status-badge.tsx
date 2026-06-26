import { cn } from '@/lib/utils';
import { STATUS_LABELS, type WorkOrderStatus } from '@/types/workshop';

/**
 * Sistema de estados de Orden de Trabajo. Cada estado comunica con
 * color + punto + texto (nunca solo color). Distintos del acento cian de marca.
 */
const STATUS_STYLE: Record<WorkOrderStatus, { wrap: string; dot: string }> = {
  PENDING: { wrap: 'bg-slate-400/12 text-slate-300', dot: 'bg-slate-400' },
  IN_PROGRESS: { wrap: 'bg-blue-400/12 text-blue-300', dot: 'bg-blue-400' },
  WAITING_PARTS: { wrap: 'bg-amber-400/14 text-amber-300', dot: 'bg-amber-400' },
  COMPLETED: { wrap: 'bg-violet-400/14 text-violet-300', dot: 'bg-violet-300' },
  DELIVERED: { wrap: 'bg-emerald-400/14 text-emerald-300', dot: 'bg-emerald-400' },
  CANCELLED: { wrap: 'bg-red-400/12 text-red-300', dot: 'bg-red-400' },
};

export function StatusBadge({
  status,
  className,
}: {
  status: WorkOrderStatus;
  className?: string;
}) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        s.wrap,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}
