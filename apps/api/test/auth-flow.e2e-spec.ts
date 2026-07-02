import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';
import { SystemRole, SYSTEM_ROLE_PERMISSIONS } from '../src/domain/entities/role.entity';

/**
 * Critical-flow integration tests. Require a reachable test database
 * (DATABASE_URL). Skipped automatically when it is not configured so the
 * unit suite stays green without infrastructure.
 *
 * Run with: pnpm --filter @motoworkshop/api test:e2e
 */
const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

describeIfDb('Auth + tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'Test1234!';

  // Two tenants to prove isolation.
  const tenants = [
    {
      id: randomUUID(),
      taxId: `E2E-${randomUUID().slice(0, 8)}`,
      email: `owner-${randomUUID().slice(0, 6)}@e2e.test`,
    },
    {
      id: randomUUID(),
      taxId: `E2E-${randomUUID().slice(0, 8)}`,
      email: `owner-${randomUUID().slice(0, 6)}@e2e.test`,
    },
  ];

  async function seedTenant(t: {
    id: string;
    taxId: string;
    email: string;
  }): Promise<{ ownerId: string }> {
    await prisma.tenant.create({
      data: { id: t.id, name: 'E2E Tenant', taxId: t.taxId, vatPercentage: 19 },
    });
    const branch = await prisma.branch.create({
      data: { id: randomUUID(), tenantId: t.id, name: 'Main', address: 'x', isActive: true },
    });
    const role = await prisma.role.create({
      data: { id: randomUUID(), tenantId: t.id, name: SystemRole.OWNER, isSystem: true },
    });
    await prisma.rolePermission.createMany({
      data: SYSTEM_ROLE_PERMISSIONS[SystemRole.OWNER].map((p) => ({
        id: randomUUID(),
        roleId: role.id,
        module: p.module,
        action: p.action,
      })),
    });
    const owner = await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId: t.id,
        branchId: branch.id,
        roleId: role.id,
        email: t.email,
        passwordHash: await bcrypt.hash(password, 12),
        fullName: 'E2E Owner',
        isActive: true,
      },
    });
    return { ownerId: owner.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    for (const t of tenants) await seedTenant(t);
  });

  afterAll(async () => {
    for (const t of tenants) {
      await prisma.customer.deleteMany({ where: { tenantId: t.id } });
      await prisma.user.deleteMany({ where: { tenantId: t.id } });
      await prisma.rolePermission.deleteMany({ where: { role: { tenantId: t.id } } });
      await prisma.role.deleteMany({ where: { tenantId: t.id } });
      await prisma.branch.deleteMany({ where: { tenantId: t.id } });
      await prisma.tenant.deleteMany({ where: { id: t.id } });
    }
    await app.close();
  });

  async function login(t: { email: string; id: string }): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: t.email, password, tenantId: t.id })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('logs in with valid credentials and returns a token', async () => {
    const token = await login(tenants[0]);
    expect(token).toBeDefined();
  });

  it('rejects an invalid password with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: tenants[0].email, password: 'wrong', tenantId: tenants[0].id })
      .expect(401);
  });

  it('does not leak customers across tenants', async () => {
    const tokenA = await login(tenants[0]);
    const tokenB = await login(tenants[1]);

    // Tenant A creates a customer.
    const created = await request(app.getHttpServer())
      .post('/api/customers')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        fullName: 'Cliente A',
        documentType: 'CC',
        documentNumber: `DOC-${randomUUID().slice(0, 8)}`,
        phone: '300',
        city: 'Bogotá',
      })
      .expect(201);
    expect(created.body.id).toBeDefined();

    // Tenant B must not see it.
    const listB = await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const ids = (listB.body.items as Array<{ id: string }>).map((c) => c.id);
    expect(ids).not.toContain(created.body.id);
  });

  it('returns 401 for protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/api/customers').expect(401);
  });

  // TODO (9.3.4): full workshop flow — reception → work order → transitions →
  // DELIVERED (verifies stock discount), and quote approve → WO IN_PROGRESS.
});
