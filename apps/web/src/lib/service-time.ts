import type { WorkOrder, WorkOrderStatus, StatusHistoryEntry } from '@/types/workshop';

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

/** Formatea una duración en ms a algo legible: "2 d 3 h", "4 h 20 min", "15 min". */
export function formatDuration(ms: number): string {
  if (ms < MS_MIN) return 'menos de 1 min';
  const days = Math.floor(ms / MS_DAY);
  const hours = Math.floor((ms % MS_DAY) / MS_HOUR);
  const mins = Math.floor((ms % MS_HOUR) / MS_MIN);
  const parts: string[] = [];
  if (days) parts.push(`${days} d`);
  if (hours) parts.push(`${hours} h`);
  if (mins && !days) parts.push(`${mins} min`);
  return parts.join(' ') || '0 min';
}

export interface ServiceTime {
  /** Tiempo total: desde la creación hasta el cierre (o ahora si sigue activa). */
  totalMs: number;
  /** Tiempo en estado "En proceso" (excluye esperas por repuestos, pendiente, etc.). */
  activeMs: number;
  /** true si la orden aún no está cerrada (en curso). */
  ongoing: boolean;
}

/**
 * Calcula el tiempo que tomó un servicio a partir del historial de estados.
 * No requiere entrada manual: se deriva de los timestamps registrados.
 */
export function computeServiceTime(
  wo: Pick<WorkOrder, 'createdAt' | 'status'>,
  history: Pick<StatusHistoryEntry, 'previousStatus' | 'newStatus' | 'changedAt'>[],
  now: number = Date.now(),
): ServiceTime {
  const created = new Date(wo.createdAt).getTime();
  const evts = [...history].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
  );

  let curStatus: WorkOrderStatus = evts[0]?.previousStatus ?? 'PENDING';
  let curStart = created;
  let activeMs = 0;
  let reachedEnd: number | null = null;

  const addSegment = (status: WorkOrderStatus, start: number, end: number) => {
    if (status === 'IN_PROGRESS') activeMs += Math.max(0, end - start);
  };

  for (const e of evts) {
    const at = new Date(e.changedAt).getTime();
    addSegment(curStatus, curStart, at);
    curStatus = e.newStatus;
    curStart = at;
    if (reachedEnd === null && (e.newStatus === 'COMPLETED' || e.newStatus === 'DELIVERED')) {
      reachedEnd = at;
    }
  }
  addSegment(curStatus, curStart, now);

  const closed =
    wo.status === 'DELIVERED' || wo.status === 'CANCELLED' || wo.status === 'COMPLETED';
  const totalEnd = closed ? (reachedEnd ?? now) : now;

  return { totalMs: Math.max(0, totalEnd - created), activeMs, ongoing: !closed };
}
