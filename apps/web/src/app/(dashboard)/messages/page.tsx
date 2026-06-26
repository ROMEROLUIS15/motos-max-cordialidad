'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Bot, Send, Loader2 } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { STATUS_ICON, type WhatsAppSession, type Message } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';

export default function MessagesPage() {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [active, setActive] = useState<WhatsAppSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiGet<PaginatedResponse<WhatsAppSession>>(
        '/api/messages/sessions?pageSize=50',
      );
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

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
    <div className="flex h-[calc(100vh-7.5rem)] flex-col space-y-4">
      <PageHeader title="Mensajes" description="Conversaciones de WhatsApp del taller" />
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Lista de sesiones */}
        <Card className="hidden w-80 shrink-0 overflow-y-auto p-0 sm:block">
          {sessions.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin conversaciones</p>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s)}
                className={cn(
                  'w-full border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/50',
                  active?.id === s.id && 'bg-secondary',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="tnum truncate text-sm font-medium text-foreground">
                    {s.phoneNumber}
                  </span>
                  {s.isAnonymous && <Badge variant="secondary">Anónimo</Badge>}
                </div>
                {s.lastMessageAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.lastMessageAt).toLocaleString('es-CO')}
                  </span>
                )}
              </button>
            ))
          )}
        </Card>

        {/* Conversación */}
        <Card className="flex min-w-0 flex-1 flex-col overflow-hidden p-0">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <MessageSquare className="h-7 w-7 opacity-40" />
              <p className="text-sm">Selecciona una conversación</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="tnum text-sm font-medium">{active.phoneNumber}</span>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin mensajes</p>
                )}
                {messages.map((m) => {
                  const out = m.direction === 'OUTBOUND';
                  return (
                    <div key={m.id} className={cn('flex', out ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                          out
                            ? 'rounded-br-sm bg-primary text-primary-foreground'
                            : 'rounded-bl-sm border border-border bg-secondary text-foreground',
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <div
                          className={cn(
                            'mt-1 flex items-center justify-end gap-1 text-[10px]',
                            out ? 'text-primary-foreground/70' : 'text-muted-foreground',
                          )}
                        >
                          {m.isAi && <Bot className="h-3 w-3" />}
                          <span className="tnum">
                            {new Date(m.createdAt).toLocaleTimeString('es-CO', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {out && <span>{STATUS_ICON[m.status]}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 border-t border-border p-3">
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void send()}
                  placeholder="Escribe una respuesta…"
                />
                <Button disabled={busy || !reply} onClick={() => void send()}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
