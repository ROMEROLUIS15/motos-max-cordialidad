import { UpdateTenantConfigUseCase } from './update-tenant-config.use-case';
import { Tenant } from '../../../domain/entities/tenant.entity';

function makeTenant(): Tenant {
  const now = new Date();
  return new Tenant(
    'tenant-1',
    'Taller Demo',
    '900123456-1',
    null,
    null,
    null,
    null,
    19,
    1,
    null,
    null,
    null,
    null,
    now,
    now,
  );
}

function make() {
  const tenantRepo = {
    findById: jest.fn().mockResolvedValue(makeTenant()),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const encryptionService = {
    encrypt: jest.fn().mockReturnValue('encrypted-token'),
    decrypt: jest.fn(),
  };
  const useCase = new UpdateTenantConfigUseCase(tenantRepo as never, encryptionService as never);
  return { useCase, tenantRepo, encryptionService };
}

describe('UpdateTenantConfigUseCase', () => {
  it('throws NotFoundException when the tenant does not exist', async () => {
    const { useCase, tenantRepo } = make();
    tenantRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ tenantId: 'tenant-1', phone: '3000000000' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('updates plain config fields', async () => {
    const { useCase, tenantRepo } = make();
    await useCase.execute({ tenantId: 'tenant-1', phone: '3000000000', address: 'Calle 2' });
    const saved = tenantRepo.save.mock.calls[0][0] as Tenant;
    expect(saved.phone).toBe('3000000000');
    expect(saved.address).toBe('Calle 2');
  });

  it('encrypts the WhatsApp token before persisting it', async () => {
    const { useCase, tenantRepo, encryptionService } = make();
    await useCase.execute({ tenantId: 'tenant-1', whatsappToken: 'raw-secret-token' });

    expect(encryptionService.encrypt).toHaveBeenCalledWith('raw-secret-token');
    const saved = tenantRepo.save.mock.calls[0][0] as Tenant;
    expect(saved.whatsappToken).toBe('encrypted-token');
  });

  it('does not touch encryption when whatsappToken is not part of the update', async () => {
    const { useCase, encryptionService } = make();
    await useCase.execute({ tenantId: 'tenant-1', phone: '3000000000' });
    expect(encryptionService.encrypt).not.toHaveBeenCalled();
  });
});
