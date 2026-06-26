'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Check, Upload } from 'lucide-react';
import { apiGet, apiSend, apiUpload } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';

interface TenantConfig {
  name: string;
  taxId: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  vatPercentage: number;
  whatsappPhone: string | null;
  logoUrl: string | null;
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground/90">{label}</label>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiGet<TenantConfig>('/api/tenants/me')
      .then(setConfig)
      .catch((e) => setError((e as Error).message));
  }, []);

  const set = (k: keyof TenantConfig, v: string | number) =>
    setConfig((c) => (c ? { ...c, [k]: v } : c));

  const save = async () => {
    if (!config) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiSend('/api/tenants/me', 'PUT', {
        address: config.address,
        phone: config.phone,
        email: config.email,
        vatPercentage: Number(config.vatPercentage),
        whatsappPhone: config.whatsappPhone,
      });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const uploadLogo = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await apiUpload('/api/settings/logo', file);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Configuración del taller"
        description="Datos del negocio, impuesto y canales"
      />

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">
          <Check className="h-4 w-4" /> Cambios guardados.
        </div>
      )}

      {!config ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Perfil</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nombre" value={config.name} disabled />
              <Field label="NIT" value={config.taxId} disabled />
              <Field
                label="Dirección"
                value={config.address ?? ''}
                onChange={(v) => set('address', v)}
              />
              <Field
                label="Teléfono"
                value={config.phone ?? ''}
                onChange={(v) => set('phone', v)}
              />
              <Field label="Email" value={config.email ?? ''} onChange={(v) => set('email', v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Impuesto y WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="IVA (%)"
                type="number"
                value={String(config.vatPercentage)}
                onChange={(v) => set('vatPercentage', v)}
              />
              <Field
                label="WhatsApp"
                value={config.whatsappPhone ?? ''}
                onChange={(v) => set('whatsappPhone', v)}
                hint="El token se gestiona cifrado y no se muestra."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/70"
              />
              <Button variant="outline" disabled={busy} onClick={() => void uploadLogo()}>
                <Upload className="h-4 w-4" /> Subir logo
              </Button>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button disabled={busy} onClick={() => void save()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
