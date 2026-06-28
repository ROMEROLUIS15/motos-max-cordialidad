'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
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
  const [showPw, setShowPw] = useState(false);

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Panel izquierdo — marca y logo */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary/90 via-primary/60 to-primary/30 px-6 py-10 lg:basis-[55%] lg:gap-6 lg:p-8">
        <div className="flex flex-col items-center gap-3 lg:gap-4">
          <Image
            src="/brand/logo-motos-max.jpeg"
            alt="Motos Max Cordialidad"
            width={280}
            height={280}
            className="h-auto w-32 rounded-2xl object-contain drop-shadow-lg sm:w-40 md:w-48 lg:w-56 xl:w-64"
            priority
          />
          <h1 className="text-center text-xl font-bold tracking-tight text-primary-foreground sm:text-2xl lg:text-3xl">
            Motos Max Cordialidad
          </h1>
          <p className="max-w-xs text-center text-xs text-primary-foreground/70 sm:max-w-sm sm:text-sm">
            Sistema de gestion para tu taller de motocicletas
          </p>
        </div>
        {/* Elementos decorativos de fondo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary-foreground/5 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-primary-foreground/5 blur-3xl" />
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 lg:basis-[45%]">
        <div className="w-full max-w-sm animate-in-up">
          <div className="mb-7 text-center lg:text-left">
            <h2 className="text-lg font-semibold tracking-tight">Bienvenido de nuevo</h2>
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
        </div>
      </div>
    </div>
  );
}
