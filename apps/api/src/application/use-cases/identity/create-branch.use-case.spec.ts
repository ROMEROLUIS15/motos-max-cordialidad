import { CreateBranchUseCase } from './create-branch.use-case';

describe('CreateBranchUseCase', () => {
  it('throws NotFoundException when the tenant does not exist', async () => {
    const tenantRepo = { findById: jest.fn().mockResolvedValue(null) };
    const branchRepo = { create: jest.fn() };
    const useCase = new CreateBranchUseCase(tenantRepo as never, branchRepo as never);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', name: 'Sucursal Norte', address: 'Calle 1' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('creates an active branch and persists it', async () => {
    const tenantRepo = { findById: jest.fn().mockResolvedValue({ id: 'tenant-1' }) };
    const branchRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateBranchUseCase(tenantRepo as never, branchRepo as never);

    const branch = await useCase.execute({
      tenantId: 'tenant-1',
      name: 'Sucursal Norte',
      address: 'Calle 1',
    });

    expect(branch.isActive).toBe(true);
    expect(branch.phone).toBeNull();
    expect(branchRepo.create).toHaveBeenCalledWith(branch);
  });
});
