'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';

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

  return (
    <div className="relative">
      <button onClick={() => void toggle()} className="relative p-2 rounded hover:bg-gray-100" aria-label="Notificaciones">
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] rounded-full px-1.5 min-w-[18px] text-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <span className="text-sm font-semibold">Notificaciones</span>
            <button onClick={() => void markAllRead()} className="text-xs text-blue-600 hover:underline">
              Marcar todas leídas
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-sm text-gray-400 text-center">Sin notificaciones</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className={`px-4 py-2 border-b border-gray-100 ${n.isRead ? '' : 'bg-blue-50'}`}>
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="text-xs text-gray-500">{n.body}</p>
                  <span className="text-[10px] text-gray-400">{new Date(n.createdAt).toLocaleString('es-CO')}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
