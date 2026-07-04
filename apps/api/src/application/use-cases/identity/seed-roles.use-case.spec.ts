import { SeedRolesUseCase } from './seed-roles.use-case';
import { SystemRole } from '../../../domain/entities/role.entity';

describe('SeedRolesUseCase', () => {
  it('creates all 5 system roles with their predefined permissions when none exist', async () => {
    const roleRepo = {
      findByName: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new SeedRolesUseCase(roleRepo as never);

    const roleIds = await useCase.execute('tenant-1');

    expect(Object.keys(roleIds)).toHaveLength(5);
    expect(roleRepo.create).toHaveBeenCalledTimes(5);
    const ownerCall = roleRepo.create.mock.calls.find((c) => c[0].name === SystemRole.OWNER)[0];
    expect(ownerCall.isSystem).toBe(true);
    expect(ownerCall.permissions.length).toBeGreaterThan(0);
  });

  it('reuses an existing role instead of recreating it', async () => {
    const roleRepo = {
      findByName: jest.fn((name: string) =>
        Promise.resolve(name === SystemRole.OWNER ? { id: 'existing-owner' } : null),
      ),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new SeedRolesUseCase(roleRepo as never);

    const roleIds = await useCase.execute('tenant-1');

    expect(roleIds[SystemRole.OWNER]).toBe('existing-owner');
    expect(roleRepo.create).toHaveBeenCalledTimes(4); // all but OWNER
  });
});
