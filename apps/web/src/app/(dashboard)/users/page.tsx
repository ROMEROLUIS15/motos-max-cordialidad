'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, UserCog, AlertTriangle, RotateCw, Eye, EyeOff, Loader2 } from 'lucide-react';
import { apiGet, apiSend } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, fieldBase } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Role {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  isActive: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  RECEPTIONIST: 'Recepción',
  TECHNICIAN: 'Técnico (mecánico)',
  VIEWER: 'Solo lectura',
};

const roleLabel = (name: string) => ROLE_LABELS[name] ?? name;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form de alta
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const roleName = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, r] = await Promise.all([
        apiGet<User[]>('/api/users'),
        apiGet<Role[]>('/api/roles'),
      ]);
      setUsers(u);
      setRoles(r);
      // Por defecto, técnico (el caso más común al ampliar el equipo).
      setRoleId((prev) => prev || r.find((x) => x.name === 'TECHNICIAN')?.id || r[0]?.id || '');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canSubmit = fullName.trim() && email.trim() && password.length >= 6 && roleId && !saving;

  const submit = async () => {
    setFormError(null);
    setOkMsg(null);
    if (!fullName.trim() || !email.trim()) return setFormError('Nombre y correo son obligatorios.');
    if (password.length < 6) return setFormError('La contraseña debe tener al menos 6 caracteres.');
    if (!roleId) return setFormError('Selecciona un rol.');
    setSaving(true);
    try {
      await apiSend('/api/users', 'POST', {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        roleId,
      });
      setOkMsg(`${fullName.trim()} agregado al equipo.`);
      setFullName('');
      setEmail('');
      setPassword('');
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: User) => {
    try {
      if (u.isActive) {
        await apiSend(`/api/users/${u.id}`, 'DELETE');
      } else {
        await apiSend(`/api/users/${u.id}`, 'PUT', { isActive: true });
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios y equipo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Agrega mecánicos (rol Técnico) y otros usuarios de la plataforma. Los técnicos aparecen al
          asignar el mecánico de una orden.
        </p>
      </div>

      {/* Alta */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Plus className="h-4 w-4 text-primary" /> Nuevo usuario
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="relative">
            <Input
              type={showPass ? 'text' : 'password'}
              placeholder="Contraseña (mín. 6)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onClick={() => setShowPass((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <select
            aria-label="Rol"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className={cn(fieldBase, 'cursor-pointer')}
          >
            {roles.length === 0 && <option value="">Cargando roles…</option>}
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {roleLabel(r.name)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar al equipo
          </Button>
          {formError && <span className="text-sm text-destructive">{formError}</span>}
          {okMsg && <span className="text-sm text-success">{okMsg}</span>}
        </div>
      </Card>

      {/* Lista */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="rtable w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {['Nombre', 'Correo', 'Rol', 'Estado', ''].map((h, i) => (
                  <th
                    key={h || i}
                    className={cn(
                      'px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-muted-foreground',
                      i === 4 && 'text-right',
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/60">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <Skeleton
                          className="h-4"
                          style={{ width: `${[60, 70, 40, 30, 20][j]}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                      </span>
                      <p className="text-sm font-medium">No se pudieron cargar los usuarios</p>
                      <p className="font-mono text-xs text-muted-foreground/70">{error}</p>
                      <Button variant="outline" size="sm" onClick={() => void load()}>
                        <RotateCw className="h-4 w-4" /> Reintentar
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-sm text-muted-foreground">
                    Aún no hay usuarios. Agrega el primero arriba.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td data-label="Nombre" className="px-4 py-3 font-medium text-foreground/90">
                      {u.fullName}
                    </td>
                    <td data-label="Correo" className="px-4 py-3 text-muted-foreground">
                      {u.email}
                    </td>
                    <td data-label="Rol" className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-foreground/90">
                        <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
                        {roleLabel(roleName.get(u.roleId) ?? '')}
                      </span>
                    </td>
                    <td data-label="Estado" className="px-4 py-3">
                      <Badge variant={u.isActive ? 'success' : 'secondary'}>
                        {u.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td data-label="" className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => void toggleActive(u)}>
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
