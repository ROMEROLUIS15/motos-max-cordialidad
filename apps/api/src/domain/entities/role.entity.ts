export enum SystemRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
  TECHNICIAN = 'TECHNICIAN',
  VIEWER = 'VIEWER',
}

export interface RolePermission {
  id: string;
  roleId: string;
  module: string;
  action: string;
}

export class Role {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public name: string,
    public isSystem: boolean,
    public permissions: RolePermission[],
    public readonly createdAt: Date,
  ) {}

  addPermission(permission: Omit<RolePermission, 'id' | 'roleId'>): void {
    const exists = this.permissions.some(
      (p) => p.module === permission.module && p.action === permission.action,
    );
    if (!exists) {
      this.permissions.push({
        id: '',
        roleId: this.id,
        ...permission,
      });
    }
  }

  removePermission(module: string, action: string): void {
    this.permissions = this.permissions.filter(
      (p) => !(p.module === module && p.action === action),
    );
  }

  hasPermission(module: string, action: string): boolean {
    return this.permissions.some((p) => p.module === module && p.action === action);
  }
}

// Predefined permission sets per role
export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, Array<{ module: string; action: string }>> = {
  [SystemRole.OWNER]: [
    { module: 'customers', action: 'CREATE' }, { module: 'customers', action: 'READ' },
    { module: 'customers', action: 'UPDATE' }, { module: 'customers', action: 'DELETE' },
    { module: 'vehicles', action: 'CREATE' }, { module: 'vehicles', action: 'READ' },
    { module: 'vehicles', action: 'UPDATE' }, { module: 'vehicles', action: 'DELETE' },
    { module: 'work_orders', action: 'CREATE' }, { module: 'work_orders', action: 'READ' },
    { module: 'work_orders', action: 'UPDATE' }, { module: 'work_orders', action: 'DELETE' },
    { module: 'inventory', action: 'CREATE' }, { module: 'inventory', action: 'READ' },
    { module: 'inventory', action: 'UPDATE' }, { module: 'inventory', action: 'DELETE' },
    { module: 'quotes', action: 'CREATE' }, { module: 'quotes', action: 'READ' },
    { module: 'quotes', action: 'UPDATE' }, { module: 'quotes', action: 'DELETE' },
    { module: 'payments', action: 'CREATE' }, { module: 'payments', action: 'READ' },
    { module: 'payments', action: 'UPDATE' }, { module: 'payments', action: 'DELETE' },
    { module: 'reports', action: 'READ' },
    { module: 'audit', action: 'READ' },
    { module: 'users', action: 'CREATE' }, { module: 'users', action: 'READ' },
    { module: 'users', action: 'UPDATE' }, { module: 'users', action: 'DELETE' },
    { module: 'roles', action: 'CREATE' }, { module: 'roles', action: 'READ' },
    { module: 'roles', action: 'UPDATE' }, { module: 'roles', action: 'DELETE' },
  ],
  [SystemRole.ADMIN]: [
    { module: 'customers', action: 'CREATE' }, { module: 'customers', action: 'READ' },
    { module: 'customers', action: 'UPDATE' }, { module: 'customers', action: 'DELETE' },
    { module: 'vehicles', action: 'CREATE' }, { module: 'vehicles', action: 'READ' },
    { module: 'vehicles', action: 'UPDATE' }, { module: 'vehicles', action: 'DELETE' },
    { module: 'work_orders', action: 'CREATE' }, { module: 'work_orders', action: 'READ' },
    { module: 'work_orders', action: 'UPDATE' }, { module: 'work_orders', action: 'DELETE' },
    { module: 'inventory', action: 'CREATE' }, { module: 'inventory', action: 'READ' },
    { module: 'inventory', action: 'UPDATE' },
    { module: 'quotes', action: 'CREATE' }, { module: 'quotes', action: 'READ' },
    { module: 'quotes', action: 'UPDATE' },
    { module: 'payments', action: 'CREATE' }, { module: 'payments', action: 'READ' },
    { module: 'reports', action: 'READ' },
    { module: 'users', action: 'CREATE' }, { module: 'users', action: 'READ' },
    { module: 'users', action: 'UPDATE' },
    { module: 'roles', action: 'CREATE' }, { module: 'roles', action: 'READ' },
    { module: 'roles', action: 'UPDATE' },
  ],
  [SystemRole.RECEPTIONIST]: [
    { module: 'customers', action: 'CREATE' }, { module: 'customers', action: 'READ' },
    { module: 'customers', action: 'UPDATE' },
    { module: 'vehicles', action: 'CREATE' }, { module: 'vehicles', action: 'READ' },
    { module: 'vehicles', action: 'UPDATE' },
    { module: 'work_orders', action: 'CREATE' }, { module: 'work_orders', action: 'READ' },
    { module: 'work_orders', action: 'UPDATE' },
    { module: 'quotes', action: 'CREATE' }, { module: 'quotes', action: 'READ' },
    { module: 'payments', action: 'CREATE' }, { module: 'payments', action: 'READ' },
  ],
  [SystemRole.TECHNICIAN]: [
    { module: 'work_orders', action: 'READ' }, { module: 'work_orders', action: 'UPDATE' },
    { module: 'vehicles', action: 'READ' },
    { module: 'customers', action: 'READ' },
    { module: 'inventory', action: 'READ' },
  ],
  [SystemRole.VIEWER]: [
    { module: 'customers', action: 'READ' },
    { module: 'vehicles', action: 'READ' },
    { module: 'work_orders', action: 'READ' },
    { module: 'inventory', action: 'READ' },
    { module: 'reports', action: 'READ' },
  ],
};
