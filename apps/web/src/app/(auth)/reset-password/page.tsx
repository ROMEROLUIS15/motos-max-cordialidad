'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const resetSchema = z
  .object({
    token: z.string().min(1, 'Token requerido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirm: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetFormData>({ resolver: zodResolver(resetSchema) });

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) setValue('token', token);
  }, [searchParams, setValue]);

  const onSubmit = async (data: ResetFormData) => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: data.token, password: data.password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (res.status === 400) setServerError(body.message ?? 'Token inválido o expirado.');
        else setServerError(body.message ?? 'Error al restablecer la contraseña.');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
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
            <h2 className="text-lg font-semibold tracking-tight">Restablecer contraseña</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ingresa tu nueva contraseña</p>
          </div>

          {success ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5">
                <p className="text-sm text-emerald-300">
                  Contraseña restablecida con éxito. Serás redirigido al inicio de sesión…
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="token" className="text-sm font-medium text-foreground/90">
                  Token de recuperación
                </label>
                <Input
                  id="token"
                  type="text"
                  placeholder="Pega el token del email"
                  aria-invalid={!!errors.token}
                  {...register('token')}
                />
                {errors.token && <p className="text-xs text-destructive">{errors.token.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground/90">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
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

              <div className="space-y-1.5">
                <label htmlFor="confirm" className="text-sm font-medium text-foreground/90">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    className="pr-10"
                    aria-invalid={!!errors.confirm}
                    {...register('confirm')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirm && (
                  <p className="text-xs text-destructive">{errors.confirm.message}</p>
                )}
              </div>

              {serverError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
                  <p className="text-sm text-destructive">{serverError}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Restableciendo…' : 'Restablecer contraseña'}
              </Button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Volver al inicio de sesión
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
