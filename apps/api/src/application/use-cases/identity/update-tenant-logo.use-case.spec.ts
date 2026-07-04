import { UpdateTenantLogoUseCase } from './update-tenant-logo.use-case';
import { Tenant } from '../../../domain/entities/tenant.entity';

function makeTenant(logoUrl: string | null = null): Tenant {
  const now = new Date();
  const t = new Tenant(
    'tenant-1',
    'Taller Demo',
    '900123456-1',
    logoUrl,
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
  return t;
}

function make() {
  const tenantRepo = {
    findById: jest.fn().mockResolvedValue(makeTenant()),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const storage = {
    upload: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn(),
  };
  const imageProcessor = {
    process: jest
      .fn()
      .mockResolvedValue({
        buffer: Buffer.from('img'),
        extension: 'webp',
        contentType: 'image/webp',
      }),
  };
  const useCase = new UpdateTenantLogoUseCase(
    tenantRepo as never,
    storage as never,
    imageProcessor as never,
  );
  return { useCase, tenantRepo, storage, imageProcessor };
}

const input = { tenantId: 'tenant-1', buffer: Buffer.from('raw'), mimeType: 'image/png' };

describe('UpdateTenantLogoUseCase', () => {
  it('throws NotFoundException when the tenant does not exist', async () => {
    const { useCase, tenantRepo } = make();
    tenantRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toMatchObject({ status: 404 });
  });

  it('processes and uploads the new logo, then persists the key on the tenant', async () => {
    const { useCase, storage, tenantRepo } = make();
    const result = await useCase.execute(input);

    expect(result.logoUrl).toBe('tenant-1/logos/logo.webp');
    expect(storage.upload).toHaveBeenCalledWith(
      'tenant-1/logos/logo.webp',
      expect.any(Buffer),
      'image/webp',
    );
    const saved = tenantRepo.save.mock.calls[0][0] as Tenant;
    expect(saved.logoUrl).toBe('tenant-1/logos/logo.webp');
  });

  it('deletes the previous logo when one existed under a different key', async () => {
    const { useCase, storage, tenantRepo } = make();
    tenantRepo.findById.mockResolvedValue(makeTenant('tenant-1/logos/old-logo.png'));

    await useCase.execute(input);

    expect(storage.delete).toHaveBeenCalledWith('tenant-1/logos/old-logo.png');
  });

  it('does not attempt to delete anything when there was no previous logo', async () => {
    const { useCase, storage } = make();
    await useCase.execute(input);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('succeeds even if deleting the old logo fails', async () => {
    const { useCase, storage, tenantRepo } = make();
    tenantRepo.findById.mockResolvedValue(makeTenant('tenant-1/logos/old-logo.png'));
    storage.delete.mockRejectedValue(new Error('r2 down'));

    await expect(useCase.execute(input)).resolves.toEqual({ logoUrl: 'tenant-1/logos/logo.webp' });
  });
});
