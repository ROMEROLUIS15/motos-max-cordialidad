'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowLeft, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  /** When rate-limited, block the form until this timestamp */
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({ resolver: zodResolver(forgotSchema) });

  const isRateLimited = rateLimitedUntil !== null && Date.now() < rateLimitedUntil;

  const onSubmit = async (data: ForgotFormData) => {
    if (isRateLimited) return;
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          code?: string;
        };

        if (res.status === 429) {
          // Extract retry-after minutes from the backend message if available
          const match = body.message?.match(/(\d+)\s*minuto/);
          const minutes = match ? parseInt(match[1], 10) : 60;
          setRateLimitedUntil(Date.now() + minutes * 60 * 1000);
          setServerError(
            body.message ??
              `Demasiados intentos. Intenta de nuevo en ${minutes} minuto${minutes !== 1 ? 's' : ''}.`,
          );
        } else {
          setServerError(body.message ?? 'Error al procesar la solicitud.');
        }
        return;
      }

      setSent(true);
    } catch {
      setServerError('Error de conexión. Verifica tu internet e intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
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
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary-foreground/5 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-primary-foreground/5 blur-3xl" />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 lg:basis-[45%]">
        <div className="w-full max-w-sm animate-in-up">
          <div className="mb-7 text-center lg:text-left">
            <h2 className="text-lg font-semibold tracking-tight">Recuperar contraseña</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresa tu email y te enviaremos un enlace para restablecerla
            </p>
          </div>

          {sent ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5">
                <p className="text-sm text-emerald-300">
                  Si existe una cuenta con ese email, recibirás un enlace de recuperación en los
                  próximos minutos. Revisa tu bandeja de entrada y la carpeta de spam.
                </p>
              </div>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
                  disabled={isRateLimited}
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              {/* 5.5–5.8: Rate limit UX */}
              {isRateLimited && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <p className="text-sm text-amber-300">{serverError}</p>
                </div>
              )}

              {serverError && !isRateLimited && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                  <p className="text-sm text-destructive">{serverError}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || isRateLimited}
                className="w-full"
                id="forgot-password-submit"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isRateLimited
                  ? 'Espera antes de intentar de nuevo'
                  : loading
                    ? 'Enviando…'
                    : 'Enviar enlace de recuperación'}
              </Button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al inicio de sesión
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
