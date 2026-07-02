import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';
import { SystemRole, SYSTEM_ROLE_PERMISSIONS } from '../src/domain/entities/role.entity';

/**
 * Password recovery integration tests.
 * Require DATABASE_URL to be configured. Skipped automatically otherwise.
 *
 * Run with: pnpm --filter @motoworkshop/api test:e2e --testPathPattern=password-recovery
 */
const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

describeIfDb('Password Recovery (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const password = 'OldPass1!';
  const tenantId = randomUUID();
  const userEmail = `recovery-${randomUUID().slice(0, 8)}@e2e.test`;
  let userId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'E2E Recovery',
        taxId: `REC-${randomUUID().slice(0, 8)}`,
        vatPercentage: 19,
      },
    });
    const branch = await prisma.branch.create({
      data: { id: randomUUID(), tenantId, name: 'Main', address: 'x', isActive: true },
    });
    const role = await prisma.role.create({
      data: { id: randomUUID(), tenantId, name: SystemRole.OWNER, isSystem: true },
    });
    await prisma.rolePermission.createMany({
      data: SYSTEM_ROLE_PERMISSIONS[SystemRole.OWNER].map((p) => ({
        id: randomUUID(),
        roleId: role.id,
        module: p.module,
        action: p.action,
      })),
    });
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId,
        branchId: branch.id,
        roleId: role.id,
        email: userEmail,
        passwordHash: await bcrypt.hash(password, 12),
        fullName: 'E2E Recovery User',
        isActive: true,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.branch.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function forgotPassword(email: string) {
    return request(app.getHttpServer()).post('/api/auth/forgot-password').send({ email, tenantId });
  }

  async function getRawToken(): Promise<string> {
    await forgotPassword(userEmail);
    const record = await prisma.passwordResetToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new Error('Token not created in DB');
    const raw = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const hash = createHash('sha256').update(raw).digest('hex');
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { tokenHash: hash },
    });
    return raw;
  }

  async function resetPassword(token: string, pwd: string) {
    return request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({ token, password: pwd });
  }

  async function login(pwd: string) {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userEmail, password: pwd, tenantId });
  }

  // ── Privacy / Anti-enumeration ────────────────────────────────────────────

  it('returns same 200 response for unknown email (anti-enumeration)', async () => {
    const res = await forgotPassword('nonexistent@nobody.test');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      'Si el email está registrado, recibirás un link de recuperación.',
    );
  });

  it('returns same 200 response for known email', async () => {
    const res = await forgotPassword(userEmail);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      'Si el email está registrado, recibirás un link de recuperación.',
    );
  });

  // ── 4.35-4.36 Timing consistency ─────────────────────────────────────────

  it('response time for unknown email is comparable to known email', async () => {
    const SAMPLE = 3;
    const TOLERANCE_MS = 800;
    const measure = async (email: string) => {
      const t0 = Date.now();
      await forgotPassword(email);
      return Date.now() - t0;
    };
    const knownTimes = await Promise.all(Array.from({ length: SAMPLE }, () => measure(userEmail)));
    const unknownTimes = await Promise.all(
      Array.from({ length: SAMPLE }, () => measure('ghost@nobody.invalid')),
    );
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(Math.abs(avg(knownTimes) - avg(unknownTimes))).toBeLessThan(TOLERANCE_MS);
  });

  // ── Token creation ────────────────────────────────────────────────────────

  it('creates a token in DB when email exists', async () => {
    await forgotPassword(userEmail);
    const token = await prisma.passwordResetToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(token).toBeDefined();
    expect(token!.usedAt).toBeNull();
    expect(token!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('replaces old token when a new request is made (single valid token)', async () => {
    await forgotPassword(userEmail);
    const firstToken = await prisma.passwordResetToken.findFirst({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    await forgotPassword(userEmail);
    const allTokens = await prisma.passwordResetToken.findMany({ where: { userId, usedAt: null } });
    expect(allTokens).toHaveLength(1);
    expect(allTokens[0].id).not.toBe(firstToken?.id);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('happy path: forgot → reset → login with new password', async () => {
    const raw = await getRawToken();
    const newPassword = 'NewPass99!';
    const resetRes = await resetPassword(raw, newPassword);
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toBe('Contraseña actualizada exitosamente.');

    const loginRes = await login(newPassword);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
  });

  // ── 4.10 Old password rejected after reset ────────────────────────────────

  it('old password no longer works after successful reset', async () => {
    const raw = await getRawToken();
    await resetPassword(raw, 'BrandNew99!');

    const loginWithOld = await login(password);
    expect(loginWithOld.status).toBe(401);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
  });

  // ── Token validation errors ───────────────────────────────────────────────

  it('rejects invalid token with unified message', async () => {
    const res = await resetPassword('invalidtoken0000000000000000000000000', 'NewPass99!');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Token inválido o expirado.');
  });

  it('rejects an already-used token with unified message', async () => {
    const raw = await getRawToken();
    await resetPassword(raw, 'NewPass99!');
    const res = await resetPassword(raw, 'NewPass99!');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Token inválido o expirado.');
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
  });

  it('rejects an expired token with unified message', async () => {
    const raw = await getRawToken();
    const record = await prisma.passwordResetToken.findFirst({
      where: { userId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    await prisma.passwordResetToken.update({
      where: { id: record!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await resetPassword(raw, 'NewPass99!');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Token inválido o expirado.');
  });

  // ── Password complexity ───────────────────────────────────────────────────

  it('rejects password without uppercase', async () => {
    const raw = await getRawToken();
    const res = await resetPassword(raw, 'nouppercase1');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/may[uú]scula/i);
  });

  it('rejects password without lowercase', async () => {
    const raw = await getRawToken();
    const res = await resetPassword(raw, 'NOLOWERCASE1');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/min[uú]scula/i);
  });

  it('rejects password without number', async () => {
    const raw = await getRawToken();
    const res = await resetPassword(raw, 'NoNumbers!');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/n[uú]mero/i);
  });

  it('rejects password shorter than 8 chars', async () => {
    const raw = await getRawToken();
    const res = await resetPassword(raw, 'Ab1');
    expect(res.status).toBe(400);
  });

  it('accepts a strong password (uppercase + lowercase + number)', async () => {
    const raw = await getRawToken();
    const res = await resetPassword(raw, 'StrongPass123');
    expect(res.status).toBe(200);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
  });

  // ── 4.15-4.21 Rate limiting ───────────────────────────────────────────────

  it('6th forgot-password from same IP+email returns 429', async () => {
    const limitEmail = `limit-${randomUUID().slice(0, 8)}@e2e.test`;
    for (let i = 0; i < 5; i++) {
      const res = await forgotPassword(limitEmail);
      expect(res.status).toBe(200);
    }
    const blocked = await forgotPassword(limitEmail);
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('TOO_MANY_REQUESTS');
    expect(blocked.body.message).toMatch(/[Dd]emasiados/);
  });

  it('different email from same IP uses a separate rate limit counter', async () => {
    const emailA = `rla-${randomUUID().slice(0, 8)}@e2e.test`;
    const emailB = `rlb-${randomUUID().slice(0, 8)}@e2e.test`;
    for (let i = 0; i < 5; i++) await forgotPassword(emailA);
    const blockedA = await forgotPassword(emailA);
    expect(blockedA.status).toBe(429);

    const resB = await forgotPassword(emailB);
    expect(resB.status).toBe(200);
  });

  it('reset-password returns 429 after exceeding IP rate limit', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        resetPassword('bogus-' + randomUUID().replace(/-/g, ''), 'StrongPass99!'),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses).toContain(429);
  });

  // ── 4.39-4.40 Token cleanup audit trail & job ─────────────────────────────

  it('used tokens remain in database after reset (audit trail preserved)', async () => {
    const raw = await getRawToken();
    await resetPassword(raw, 'AuditPass9!');

    const usedToken = await prisma.passwordResetToken.findFirst({
      where: { userId, usedAt: { not: null } },
      orderBy: { usedAt: 'desc' },
    });
    expect(usedToken).toBeDefined();
    expect(usedToken!.usedAt).not.toBeNull();

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    });
  });

  it('cleanup job logic removes expired unused tokens (DB simulation)', async () => {
    const expiredToken = await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const { count } = await prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() }, usedAt: null },
    });

    expect(count).toBeGreaterThanOrEqual(1);
    const still = await prisma.passwordResetToken.findUnique({ where: { id: expiredToken.id } });
    expect(still).toBeNull();
  });

  // ── Email tests (require Resend mock — pending) ───────────────────────────

  it.todo('4.7  email is sent with reset link after forgot-password (needs Resend mock)');
  it.todo('4.27 password change confirmation email is sent after reset (needs Resend mock)');
  it.todo('4.31 confirmation email sent after successful reset (needs Resend mock)');
  it.todo('4.32 email contains reset link with token (needs Resend mock)');
});
