'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { apiSend } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea, fieldBase } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';

const DOC_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía (CC)' },
  { value: 'CE', label: 'Cédula de extranjería (CE)' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PASSPORT', label: 'Pasaporte' },
] as const;

const schema = z.object({
  fullName: z.string().min(1, 'El nombre es requerido'),
  documentType: z.enum(['CC', 'CE', 'NIT', 'PASSPORT']),
  documentNumber: z.string().min(1, 'El número de documento es requerido'),
  phone: z.string().min(1, 'El teléfono es requerido'),
  city: z.string().min(1, 'La ciudad es requerida'),
  whatsappPhone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  address: z.string().optional(),
  observations: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground/90">{label}</span>
      {children}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { documentType: 'CC' } });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      const customer = await apiSend<{ id: string }>('/api/customers', 'POST', {
        fullName: data.fullName.trim(),
        documentType: data.documentType,
        documentNumber: data.documentNumber.trim(),
        phone: data.phone.trim(),
        city: data.city.trim(),
        whatsappPhone: data.whatsappPhone?.trim() || undefined,
        email: data.email?.trim() || undefined,
        address: data.address?.trim() || undefined,
        observations: data.observations?.trim() || undefined,
      });
      router.push(`/customers/${customer.id}`);
    } catch (e) {
      const msg = (e as Error).message;
      if (/already exists|ya existe|409|conflict/i.test(msg)) {
        setError('documentNumber', { message: 'Ya existe un cliente con este documento.' });
      } else {
        setServerError(msg);
      }
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-3">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
        <PageHeader title="Nuevo cliente" description="Registra un cliente del taller" />
      </div>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <Field label="Nombre completo" error={errors.fullName?.message}>
              <Input
                placeholder="Ej: Carlos Pérez"
                {...register('fullName')}
                aria-invalid={!!errors.fullName}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tipo de documento" error={errors.documentType?.message}>
                <select {...register('documentType')} className={cn(fieldBase, 'cursor-pointer')}>
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Número de documento" error={errors.documentNumber?.message}>
                <Input
                  placeholder="Ej: 1001234567"
                  {...register('documentNumber')}
                  aria-invalid={!!errors.documentNumber}
                />
              </Field>
              <Field label="Teléfono" error={errors.phone?.message}>
                <Input
                  placeholder="+57 300 000 0000"
                  {...register('phone')}
                  aria-invalid={!!errors.phone}
                />
              </Field>
              <Field label="WhatsApp (opcional)" error={errors.whatsappPhone?.message}>
                <Input placeholder="+57 300 000 0000" {...register('whatsappPhone')} />
              </Field>
              <Field label="Ciudad" error={errors.city?.message}>
                <Input
                  placeholder="Ej: Barranquilla"
                  {...register('city')}
                  aria-invalid={!!errors.city}
                />
              </Field>
              <Field label="Email (opcional)" error={errors.email?.message}>
                <Input
                  type="email"
                  placeholder="cliente@email.com"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                />
              </Field>
            </div>

            <Field label="Dirección (opcional)" error={errors.address?.message}>
              <Input placeholder="Calle 1 #2-3" {...register('address')} />
            </Field>
            <Field label="Observaciones (opcional)" error={errors.observations?.message}>
              <Textarea
                rows={2}
                placeholder="Notas internas sobre el cliente"
                {...register('observations')}
              />
            </Field>

            {serverError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Link href="/customers" className={cn(buttonVariants({ variant: 'ghost' }))}>
                Cancelar
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Registrar cliente
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
