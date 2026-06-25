'use client';

import { useEffect, useRef, useState } from 'react';
import { apiGet, apiSend, apiUpload } from '@/lib/api';

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

  if (!config) {
    return <div className="p-6 text-gray-500">{error ?? 'Cargando configuración...'}</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configuración del taller</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Cambios guardados.</p>}

      <section className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Perfil</h2>
        <Field label="Nombre" value={config.name} disabled />
        <Field label="NIT" value={config.taxId} disabled />
        <Field label="Dirección" value={config.address ?? ''} onChange={(v) => set('address', v)} />
        <Field label="Teléfono" value={config.phone ?? ''} onChange={(v) => set('phone', v)} />
        <Field label="Email" value={config.email ?? ''} onChange={(v) => set('email', v)} />
      </section>

      <section className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Impuesto</h2>
        <Field
          label="IVA (%)"
          type="number"
          value={String(config.vatPercentage)}
          onChange={(v) => set('vatPercentage', v)}
        />
      </section>

      <section className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">WhatsApp</h2>
        <Field
          label="Número"
          value={config.whatsappPhone ?? ''}
          onChange={(v) => set('whatsappPhone', v)}
        />
        <p className="text-xs text-gray-400">El token se gestiona de forma cifrada y no se muestra.</p>
      </section>

      <section className="bg-white rounded-lg shadow p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Logo</h2>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
          <button
            disabled={busy}
            onClick={() => void uploadLogo()}
            className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-40"
          >
            Subir logo
          </button>
        </div>
      </section>

      <button
        disabled={busy}
        onClick={() => void save()}
        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium disabled:opacity-40"
      >
        Guardar cambios
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
      />
    </label>
  );
}
