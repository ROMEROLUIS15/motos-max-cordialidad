import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdateTenantConfigDto } from './update-tenant-config.dto';

// Mirrors the global pipe configured in main.ts. `forbidNonWhitelisted` is what
// turns a field missing from the DTO into a 400 for the whole request, so the
// pipe has to be part of the test — validating the class alone would not catch it.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const run = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: UpdateTenantConfigDto });

/** Exactly what apps/web settings page PUTs to /api/tenants/me. */
const settingsFormPayload = {
  address: 'Calle 123 #45-67, Bogotá',
  phone: '+57 1 555 0100',
  email: 'contacto@mototaller.demo',
  vatPercentage: 0,
  whatsappPhone: '',
};

describe('UpdateTenantConfigDto', () => {
  it('accepts the payload the settings page actually sends', async () => {
    await expect(run(settingsFormPayload)).resolves.toEqual(settingsFormPayload);
  });

  it('accepts vatPercentage 0 — the workshop does not charge VAT', async () => {
    await expect(run({ vatPercentage: 0 })).resolves.toEqual({ vatPercentage: 0 });
  });

  it('accepts a normal VAT rate', async () => {
    await expect(run({ vatPercentage: 19 })).resolves.toEqual({ vatPercentage: 19 });
  });

  it('accepts an empty email as "no email"', async () => {
    await expect(run({ email: '' })).resolves.toEqual({ email: '' });
  });

  it.each([-1, 101, 12.5, '19'])('rejects an invalid vatPercentage: %p', async (value) => {
    await expect(run({ vatPercentage: value })).rejects.toThrow(BadRequestException);
  });

  it('rejects a malformed email', async () => {
    await expect(run({ email: 'no-es-un-email' })).rejects.toThrow(BadRequestException);
  });

  it('still rejects unknown properties', async () => {
    await expect(run({ hackerField: 'x' })).rejects.toThrow(BadRequestException);
  });
});
