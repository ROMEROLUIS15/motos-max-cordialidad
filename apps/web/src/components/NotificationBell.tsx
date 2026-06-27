'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Notification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  const loadUnread = useCallback(async () => {
    try {
      const { count } = await apiGet<{ count: number }>('/api/notifications/unread-count');
      setUnread(count);
    } catch {
      // ignore (not authenticated yet, etc.)
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const data = await apiGet<PaginatedResponse<Notification>>('/api/notifications?pageSize=10');
      setItems(data.items);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadUnread();
    const t = setInterval(() => void loadUnread(), 30000);
    return () => clearInterval(t);
  }, [loadUnread]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await loadList();
  };

  const markAllRead = async () => {
    await apiSend('/api/notifications/read-all', 'PATCH');
    setUnread(0);
    await loadList();
  };

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void toggle()}
        aria-label="Notificaciones"
        className={cn('relative', unread > 0 && 'text-amber-400 [&_svg]:text-amber-400')}
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-[14px] text-destructive-foreground ring-2 ring-card">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-card-hover animate-in-up">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">Notificaciones</span>
            <button
              onClick={() => void markAllRead()}
              className="text-xs font-medium text-primary hover:underline"
            >
              Marcar todas leídas
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Sin notificaciones
              </li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    'border-b border-border px-4 py-2.5 last:border-0',
                    n.isRead ? '' : 'bg-primary/5',
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <span className="text-[10px] text-muted-foreground/70">
                    {new Date(n.createdAt).toLocaleString('es-CO')}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
