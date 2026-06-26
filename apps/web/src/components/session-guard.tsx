'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { clearSession, getToken } from '@/lib/api';

const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000; // 2 horas de inactividad
const CHECK_EVERY_MS = 30_000; // revisa cada 30s (robusto ante sleep y multi-pestaña)

/**
 * Guarda de sesión del área autenticada:
 * - Si no hay token → redirige al login.
 * - Si NO es "equipo de confianza" (rememberMe), cierra sesión tras 2h de inactividad.
 * El access token se renueva silenciosamente en lib/api.ts (no requiere re-login).
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  React.useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }

    if (localStorage.getItem('rememberMe') === 'true') return; // sin timeout en equipo de confianza

    const touch = () => localStorage.setItem('lastActivity', String(Date.now()));
    touch();

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'keydown',
      'click',
      'scroll',
      'touchstart',
    ];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const interval = window.setInterval(() => {
      const last = Number(localStorage.getItem('lastActivity') ?? Date.now());
      if (Date.now() - last > IDLE_LIMIT_MS) {
        clearSession();
        router.replace('/login?reason=idle');
      }
    }, CHECK_EVERY_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(interval);
    };
  }, [router]);

  return <>{children}</>;
}
