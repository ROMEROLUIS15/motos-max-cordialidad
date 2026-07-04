import {
  CreateCustomRoleUseCase,
  UpdateRolePermissionsUseCase,
} from './create-custom-role.use-case';
import { Role } from '../../../domain/entities/role.entity';

describe('CreateCustomRoleUseCase', () => {
  function make() {
    const roleRepo = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const permissionGuard = { invalidateRoleCache: jest.fn() };
    const useCase = new CreateCustomRoleUseCase(roleRepo as never, permissionGuard as never);
    return { useCase, roleRepo, permissionGuard };
  }

  it('throws ConflictException when a role with the same name already exists for the tenant', async () => {
    const { useCase, roleRepo } = make();
    roleRepo.findByName.mockResolvedValue({ id: 'existing' });
    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        requestingUserId: 'user-1',
        name: 'Supervisor',
        permissions: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('creates a non-system role with the given permissions', async () => {
    const { useCase, roleRepo } = make();
    const role = await useCase.execute({
      tenantId: 'tenant-1',
      requestingUserId: 'user-1',
      name: 'Supervisor',
      permissions: [{ module: 'work_orders', action: 'READ' }],
    });

    expect(role.isSystem).toBe(false);
    expect(role.permissions).toEqual([
      expect.objectContaining({ module: 'work_orders', action: 'READ', roleId: role.id }),
    ]);
    expect(roleRepo.create).toHaveBeenCalledWith(role);
  });
});

describe('UpdateRolePermissionsUseCase', () => {
  function make() {
    const roleRepo = {
      findById: jest
        .fn()
        .mockResolvedValue(new Role('role-1', 'tenant-1', 'Supervisor', false, [], new Date())),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const permissionGuard = { invalidateRoleCache: jest.fn() };
    const useCase = new UpdateRolePermissionsUseCase(roleRepo as never, permissionGuard as never);
    return { useCase, roleRepo, permissionGuard };
  }

  it('throws when the role does not exist for the tenant', async () => {
    const { useCase, roleRepo } = make();
    roleRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ roleId: 'role-1', tenantId: 'tenant-1', permissions: [] }),
    ).rejects.toThrow('Role not found');
  });

  it('replaces the permissions and invalidates the guard cache for the role', async () => {
    const { useCase, roleRepo, permissionGuard } = make();

    await useCase.execute({
      roleId: 'role-1',
      tenantId: 'tenant-1',
      permissions: [{ module: 'quotes', action: 'CREATE' }],
    });

    const saved = roleRepo.save.mock.calls[0][0] as Role;
    expect(saved.permissions).toEqual([
      expect.objectContaining({ module: 'quotes', action: 'CREATE', roleId: 'role-1' }),
    ]);
    expect(permissionGuard.invalidateRoleCache).toHaveBeenCalledWith('role-1');
  });
});
