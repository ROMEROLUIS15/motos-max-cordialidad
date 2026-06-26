'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '@/lib/api';

interface UserDto {
  id: string;
  fullName: string;
  roleId: string;
  isActive: boolean;
}
interface RoleDto {
  id: string;
  name: string;
}

export interface TeamMember {
  id: string;
  fullName: string;
  roleName: string;
}

/**
 * Equipo del taller: usuarios + roles. Expone los técnicos (mecánicos) para
 * selectores y `nameOf` para mostrar el nombre de un técnico por su id.
 * Resiliente a permisos: si no puede leer roles, ofrece los usuarios activos.
 */
export function useTeam() {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);

  useEffect(() => {
    apiGet<UserDto[]>('/api/users')
      .then(setUsers)
      .catch(() => setUsers([]));
    apiGet<RoleDto[]>('/api/roles')
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  return useMemo(() => {
    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    const members: TeamMember[] = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      roleName: roleName.get(u.roleId) ?? '',
    }));
    const active = users.filter((u) => u.isActive);
    const technicians: TeamMember[] = roles.length
      ? active
          .filter((u) => roleName.get(u.roleId) === 'TECHNICIAN')
          .map((u) => ({ id: u.id, fullName: u.fullName, roleName: 'TECHNICIAN' }))
      : active.map((u) => ({ id: u.id, fullName: u.fullName, roleName: '' }));
    const nameOf = (id: string | null | undefined) =>
      (id && members.find((m) => m.id === id)?.fullName) || (id ?? '—');
    return { members, technicians, nameOf };
  }, [users, roles]);
}
