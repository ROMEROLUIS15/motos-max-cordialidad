import { DeleteRoleUseCase } from './delete-role.use-case';

function make() {
  const roleRepo = {
    findById: jest.fn().mockResolvedValue({ id: 'role-1', isSystem: false }),
    countUsersWithRole: jest.fn().mockResolvedValue(0),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const useCase = new DeleteRoleUseCase(roleRepo as never);
  return { useCase, roleRepo };
}

describe('DeleteRoleUseCase', () => {
  it('throws NotFoundException when the role does not exist for the tenant', async () => {
    const { useCase, roleRepo } = make();
    roleRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ roleId: 'role-1', tenantId: 'tenant-1' })).rejects.toMatchObject(
      { status: 404 },
    );
  });

  it('throws ConflictException when trying to delete a system role', async () => {
    const { useCase, roleRepo } = make();
    roleRepo.findById.mockResolvedValue({ id: 'role-1', isSystem: true });
    await expect(useCase.execute({ roleId: 'role-1', tenantId: 'tenant-1' })).rejects.toMatchObject(
      { status: 409 },
    );
  });

  it('throws ConflictException when users are still assigned to the role', async () => {
    const { useCase, roleRepo } = make();
    roleRepo.countUsersWithRole.mockResolvedValue(3);
    await expect(useCase.execute({ roleId: 'role-1', tenantId: 'tenant-1' })).rejects.toMatchObject(
      { status: 409 },
    );
    expect(roleRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes the role when it is non-system and unassigned', async () => {
    const { useCase, roleRepo } = make();
    await useCase.execute({ roleId: 'role-1', tenantId: 'tenant-1' });
    expect(roleRepo.delete).toHaveBeenCalledWith('role-1');
  });
});
