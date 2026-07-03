'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff, Check, X, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// ── Schema — mirrors backend validation ──────────────────────────────────────
// The reset token travels only in the URL and in the POST body — it is never
// rendered in the UI.
const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
      .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
      .regex(/[0-9]/, 'Debe contener al menos un número'),
    confirm: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

// ── Password strength rules ───────────────────────────────────────────────────
const RULES = [
  { label: 'Mínimo 8 caracteres', test: (v: string) => v.length >= 8 },
  { label: 'Una letra mayúscula', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Una letra minúscula', test: (v: string) => /[a-z]/.test(v) },
  { label: 'Un número', test: (v: string) => /[0-9]/.test(v) },
] as const;

function PasswordStrengthIndicator({ password }: { password: string }) {
  if (!password) return null;
  const passed = RULES.filter((r) => r.test(password)).length;
  const pct = (passed / RULES.length) * 100;
  const color =
    passed <= 1
      ? 'bg-destructive'
      : passed <= 2
        ? 'bg-amber-400'
        : passed <= 3
          ? 'bg-yellow-400'
          : 'bg-emerald-400';

  return (
    <div className="mt-2 space-y-2" role="status" aria-label="Indicador de fuerza de contraseña">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="space-y-0.5">
        {RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li
              key={rule.label}
              className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-400' : 'text-muted-foreground'}`}
            >
              {ok ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Inner form (uses useSearchParams — needs Suspense wrapper) ────────────────
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ResetFormData>({ resolver: zodResolver(resetSchema) });

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' });

  const token = searchParams.get('token');

  const isRateLimited = rateLimitedUntil !== null && Date.now() < rateLimitedUntil;

  const onSubmit = async (data: ResetFormData) => {
    if (isRateLimited || !token) return;
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: data.password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
        if (res.status === 429) {
          const match = body.message?.match(/(\d+)\s*minuto/);
          const minutes = match ? parseInt(match[1], 10) : 60;
          setRateLimitedUntil(Date.now() + minutes * 60 * 1000);
          setServerError(
            body.message ??
              `Demasiados intentos. Espera aproximadamente ${minutes} minuto${minutes !== 1 ? 's' : ''}.`,
          );
        } else if (res.status === 400) {
          setServerError(body.message ?? 'Token inválido o expirado.');
        } else {
          setServerError(body.message ?? 'Error al restablecer la contraseña.');
        }
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

  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5">
          <p className="text-sm text-emerald-300">
            Contraseña restablecida con éxito. Serás redirigido al inicio de sesión…
          </p>
        </div>
      </div>
    );
  }

  // No token in the URL — the page was reached without a valid reset link.
  if (!token) {
    return (
      <div className="space-y-4">
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5"
          data-testid="missing-token"
        >
          <p className="text-sm text-destructive">
            El enlace de recuperación es inválido o está incompleto. Solicita uno nuevo para
            continuar.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          Solicitar un nuevo enlace
        </Link>
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
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
            disabled={isRateLimited}
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
        <PasswordStrengthIndicator password={passwordValue ?? ''} />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
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
            disabled={isRateLimited}
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
        {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
      </div>

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
        id="reset-password-submit"
        disabled={loading || isRateLimited}
        className="w-full"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {isRateLimited
          ? 'Espera antes de intentar de nuevo'
          : loading
            ? 'Restableciendo…'
            : 'Restablecer contraseña'}
      </Button>

      <Link
        href="/login"
        className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        Volver al inicio de sesión
      </Link>
      <Link
        href="/reset-password/help"
        className="flex items-center justify-center text-xs text-muted-foreground/60 hover:text-muted-foreground"
        data-testid="help-link"
      >
        ¿Dudas sobre los requisitos? Ver ayuda
      </Link>
    </form>
  );
}

// ── Page wrapper with Suspense boundary ───────────────────────────────────────
export default function ResetPasswordPage() {
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
          <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
