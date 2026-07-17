import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SystemRole, SYSTEM_ROLE_PERMISSIONS } from './role.entity';

/**
 * Ties the permissions the routes demand to the permissions the roles are given.
 *
 * `PermissionGuard` resolves `@RequirePermission('module:ACTION')` against the
 * rows a role has in `role_permissions`, seeded from `SYSTEM_ROLE_PERMISSIONS`.
 * The two halves live apart, and a mismatch does not fail loudly at boot: it
 * fails as a `403` for whoever tries the endpoint. A module that no role owns
 * makes the route unreachable *for everyone* — the guard denies a permission
 * nobody can hold. That is how the endpoint would look "protected" while being
 * simply broken.
 */
const CONTROLLERS = join(__dirname, '../../presentation/http/controllers');

function requiredPermissions(): Array<{ file: string; permission: string }> {
  const found: Array<{ file: string; permission: string }> = [];
  for (const entry of readdirSync(CONTROLLERS)) {
    if (!entry.endsWith('.controller.ts')) continue;
    const src = readFileSync(join(CONTROLLERS, entry), 'utf8');
    for (const m of src.matchAll(/@RequirePermission\('([^']+)'\)/g)) {
      found.push({ file: entry, permission: m[1] });
    }
  }
  return found;
}

const granted = new Set(
  Object.values(SYSTEM_ROLE_PERMISSIONS)
    .flat()
    .map((p) => `${p.module}:${p.action}`),
);

describe('RBAC: what routes demand vs. what roles are granted', () => {
  const required = requiredPermissions();

  it('finds the @RequirePermission call sites (guards against a silent regex miss)', () => {
    expect(required.length).toBeGreaterThan(10);
  });

  it.each(requiredPermissions())(
    '$file demands $permission, and some role holds it',
    ({ permission }) => {
      // If this fails: add the permission to SYSTEM_ROLE_PERMISSIONS for the
      // roles that should have it. The Prisma seed backfills existing tenants
      // on the next deploy (createMany + skipDuplicates), so production heals
      // itself — but only if the permission exists here first.
      expect(granted.has(permission)).toBe(true);
    },
  );

  describe('settings (configuración del taller)', () => {
    const holders = (permission: string): SystemRole[] =>
      (Object.keys(SYSTEM_ROLE_PERMISSIONS) as SystemRole[]).filter((role) =>
        SYSTEM_ROLE_PERMISSIONS[role].some((p) => `${p.module}:${p.action}` === permission),
      );

    it('is writable only by OWNER and ADMIN', () => {
      expect(holders('settings:UPDATE').sort()).toEqual(
        [SystemRole.ADMIN, SystemRole.OWNER].sort(),
      );
    });

    it('is readable only by OWNER and ADMIN — it carries the VAT and the WhatsApp channel', () => {
      expect(holders('settings:READ').sort()).toEqual([SystemRole.ADMIN, SystemRole.OWNER].sort());
    });
  });

  it('VIEWER holds read-only permissions', () => {
    const actions = new Set(SYSTEM_ROLE_PERMISSIONS[SystemRole.VIEWER].map((p) => p.action));
    expect([...actions]).toEqual(['READ']);
  });

  it('TECHNICIAN cannot touch the workshop configuration', () => {
    const modules = SYSTEM_ROLE_PERMISSIONS[SystemRole.TECHNICIAN].map((p) => p.module);
    expect(modules).not.toContain('settings');
  });
});
