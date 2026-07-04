import { CreateTenantUseCase } from './create-tenant.use-case';

describe('CreateTenantUseCase', () => {
  it('throws ConflictException when a tenant with the same taxId already exists', async () => {
    const tenantRepo = {
      findByTaxId: jest.fn().mockResolvedValue({ id: 'existing' }),
      create: jest.fn(),
    };
    const branchRepo = { create: jest.fn() };
    const useCase = new CreateTenantUseCase(tenantRepo as never, branchRepo as never);

    await expect(
      useCase.execute({ name: 'Taller Demo', taxId: '900123456-1' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(branchRepo.create).not.toHaveBeenCalled();
  });

  it('creates the tenant and a "Principal" branch, returning both ids', async () => {
    const tenantRepo = {
      findByTaxId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const branchRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateTenantUseCase(tenantRepo as never, branchRepo as never);

    const result = await useCase.execute({
      name: 'Taller Demo',
      taxId: '900123456-1',
      address: 'Calle 1',
    });

    expect(result.tenantId).toBeDefined();
    expect(result.branchId).toBeDefined();
    expect(tenantRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.tenantId, name: 'Taller Demo' }),
    );
    expect(branchRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.branchId,
        tenantId: result.tenantId,
        name: 'Principal',
        address: 'Calle 1',
      }),
    );
  });

  it('defaults the Principal branch address to "Por configurar" when none is given', async () => {
    const tenantRepo = {
      findByTaxId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const branchRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateTenantUseCase(tenantRepo as never, branchRepo as never);

    await useCase.execute({ name: 'Taller Demo', taxId: '900123456-1' });

    expect(branchRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'Por configurar' }),
    );
  });
});
