'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { STATUS_ICON, type WhatsAppSession, type Message } from '@/types/messaging';

export default function MessagesPage() {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [active, setActive] = useState<WhatsAppSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiGet<PaginatedResponse<WhatsAppSession>>('/api/messages/sessions?pageSize=50');
      setSessions(data.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const data = await apiGet<PaginatedResponse<Message>>(
        `/api/messages/sessions/${sessionId}/messages?pageSize=100`,
      );
      // API returns newest first; show oldest at top.
      setMessages([...data.items].reverse());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (active) void loadMessages(active.id);
  }, [active, loadMessages]);

  const send = async () => {
    if (!active || !reply) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/messages/send', 'POST', { sessionId: active.id, content: reply });
      setReply('');
      await loadMessages(active.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mensajes</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="flex gap-4 h-[70vh]">
        {/* Sessions list */}
        <div className="w-72 bg-white rounded-lg shadow overflow-y-auto">
          {sessions.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">Sin conversaciones</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${active?.id === s.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{s.phoneNumber}</span>
                  {s.isAnonymous && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Anónimo</span>
                  )}
                </div>
                {s.lastMessageAt && (
                  <span className="text-xs text-gray-400">{new Date(s.lastMessageAt).toLocaleString('es-CO')}</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Conversation */}
        <div className="flex-1 bg-white rounded-lg shadow flex flex-col">
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Selecciona una conversación
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${
                        m.direction === 'OUTBOUND' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p>{m.content}</p>
                      <div className="text-[10px] opacity-70 mt-1 flex items-center gap-1 justify-end">
                        {m.isAi && <span>🤖</span>}
                        <span>{new Date(m.createdAt).toLocaleTimeString('es-CO')}</span>
                        {m.direction === 'OUTBOUND' && <span>{STATUS_ICON[m.status]}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {messages.length === 0 && <p className="text-sm text-gray-400">Sin mensajes</p>}
              </div>
              <div className="border-t border-gray-200 p-3 flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void send()}
                  placeholder="Escribe una respuesta..."
                  className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
                <button
                  disabled={busy || !reply}
                  onClick={() => void send()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
