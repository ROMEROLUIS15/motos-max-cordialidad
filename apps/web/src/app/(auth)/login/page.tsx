'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bike, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { setSession } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('reason') === 'idle'
    ) {
      setNotice('Tu sesión se cerró por inactividad. Vuelve a ingresar.');
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (res.status === 401)
          setServerError('Credenciales inválidas. Verifica tu email y contraseña.');
        else if (res.status === 429)
          setServerError('Demasiados intentos. Intenta de nuevo en 5 minutos.');
        else setServerError(body.message ?? 'Error al iniciar sesión. Intenta nuevamente.');
        return;
      }

      const { accessToken, refreshToken } = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      setSession(accessToken, refreshToken, rememberMe);
      router.replace('/');
    } catch {
      setServerError('Error de conexión. Verifica tu internet e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm p-8 animate-in-up">
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-sm ring-highlight">
            <Bike className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">Motos Max Cordialidad</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingresa a tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {notice && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5">
              <p className="text-sm text-amber-300">{notice}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground/90">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground/90">
              Contraseña
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-input bg-card accent-primary"
            />
            Recordarme en este equipo de confianza
          </label>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
