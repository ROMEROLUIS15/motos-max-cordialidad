import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { PasswordService } from './password.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';

describe('JwtService', () => {
  const jwt = new JwtService();

  it('signs and verifies a valid token', () => {
    const token = jwt.sign({ sub: 'u1', tenantId: 't1', branchId: 'b1', roleId: 'r1' });
    const payload = jwt.verify(token);
    expect(payload.sub).toBe('u1');
    expect(payload.tenantId).toBe('t1');
  });

  it('throws UnauthorizedException for an invalid token', () => {
    expect(() => jwt.verify('not-a-real-token')).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for an expired token', async () => {
    process.env['JWT_EXPIRES_IN'] = '1';
    const shortJwt = new JwtService();
    const token = shortJwt.sign({ sub: 'u1', tenantId: 't1', branchId: null, roleId: 'r1' });
    await new Promise((r) => setTimeout(r, 1100));
    expect(() => shortJwt.verify(token)).toThrow(UnauthorizedException);
    delete process.env['JWT_EXPIRES_IN'];
  });
});

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hash → verify cycle returns true for the right password', async () => {
    const hash = await svc.hash('s3cret!');
    expect(await svc.verify('s3cret!', hash)).toBe(true);
  });

  it('verify returns false for the wrong password', async () => {
    const hash = await svc.hash('s3cret!');
    expect(await svc.verify('wrong', hash)).toBe(false);
  });
});

describe('FieldEncryptionService', () => {
  it('encrypt → decrypt round-trips to the original text', () => {
    process.env['ENCRYPTION_KEY'] = 'a'.repeat(64);
    const svc = new FieldEncryptionService();
    const cipher = svc.encrypt('whatsapp-secret-token');
    expect(cipher).not.toContain('whatsapp-secret-token');
    expect(svc.decrypt(cipher)).toBe('whatsapp-secret-token');
    delete process.env['ENCRYPTION_KEY'];
  });
});
