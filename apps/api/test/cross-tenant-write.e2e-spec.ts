import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';
import { SystemRole, SYSTEM_ROLE_PERMISSIONS } from '../src/domain/entities/role.entity';

/**
 * End-to-end proof for the cross-tenant write fix. Exercises the full HTTP
 * stack (controller → guards → use-case → Prisma against the real DB), not a
 * mock. An authenticated user of tenant A tries to mutate tenant B's data by
 * smuggling B's tenantId in the request body — the fix must ignore the body
 * value and always scope to the token's tenant.
 *
 * Requires a reachable DATABASE_URL; skipped otherwise so the unit suite stays
 * green without infra. Run with: pnpm --filter @motoworkshop/api test:e2e
 */
const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

describeIfDb('Cross-tenant write protection (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'Test1234!';

  const tenants = [
    {
      id: randomUUID(),
      taxId: `XT-${randomUUID().slice(0, 8)}`,
      email: `a-${randomUUID().slice(0, 6)}@xt.test`,
    },
    {
      id: randomUUID(),
      taxId: `XT-${randomUUID().slice(0, 8)}`,
      email: `b-${randomUUID().slice(0, 6)}@xt.test`,
    },
  ];
  const customerIds: string[] = [];

  async function seedTenant(t: { id: string; taxId: string; email: string }): Promise<void> {
    await prisma.tenant.create({
      data: { id: t.id, name: 'XT Tenant', taxId: t.taxId, vatPercentage: 19 },
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
    await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId: t.id,
        branchId: branch.id,
        roleId: role.id,
        email: t.email,
        passwordHash: await bcrypt.hash(password, 12),
        fullName: 'XT Owner',
        isActive: true,
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    for (const t of tenants) await seedTenant(t);

    // Each tenant gets its own customer with a known name.
    for (let i = 0; i < tenants.length; i++) {
      const c = await prisma.customer.create({
        data: {
          id: randomUUID(),
          tenantId: tenants[i].id,
          fullName: i === 0 ? 'Original A' : 'Original B',
          documentType: 'CC',
          documentNumber: `XT-${randomUUID().slice(0, 10)}`,
          phone: '300',
          city: 'Bogotá',
          isActive: true,
        },
      });
      customerIds.push(c.id);
    }
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

  it("THE ATTACK: tenant A cannot overwrite tenant B's customer by injecting B's tenantId in the body", async () => {
    const tokenA = await login(tenants[0]);
    const [, customerB] = customerIds;

    // A authenticated tenant-A user targets tenant B's customer id AND sends
    // B's tenantId in the body — the exact exploit the fix neutralizes.
    const res = await request(app.getHttpServer())
      .put(`/api/customers/${customerB}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ fullName: 'HACKED', tenantId: tenants[1].id });

    // Scoped to the token's tenant (A), B's customer is invisible → Not Found.
    expect(res.status).toBe(404);

    // Ground truth: B's customer is untouched in the DB.
    const afterB = await prisma.customer.findUnique({ where: { id: customerB } });
    expect(afterB?.fullName).toBe('Original B');
  });

  it('the injected tenantId is ignored even on a legitimate same-tenant update', async () => {
    const tokenA = await login(tenants[0]);
    const [customerA] = customerIds;

    // A legitimately updates its OWN customer but tries to smuggle B's tenantId.
    await request(app.getHttpServer())
      .put(`/api/customers/${customerA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ fullName: 'Updated A', tenantId: tenants[1].id })
      .expect(200);

    // The update landed on A's customer...
    const afterA = await prisma.customer.findUnique({ where: { id: customerA } });
    expect(afterA?.fullName).toBe('Updated A');
    // ...and its tenant was NOT rewritten to B.
    expect(afterA?.tenantId).toBe(tenants[0].id);
  });
});
