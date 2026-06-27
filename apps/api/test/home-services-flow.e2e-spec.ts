import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';
import { SystemRole, SYSTEM_ROLE_PERMISSIONS } from '../src/domain/entities/role.entity';

/**
 * Fase 2A — home-service requests (web management + assignment). Requires
 * DATABASE_URL; skipped otherwise.
 */
const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

describeIfDb('Home services (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;

  const password = 'Test1234!';
  const tenantId = randomUUID();
  const taxId = `E2E-${randomUUID().slice(0, 8)}`;
  const email = `owner-${randomUUID().slice(0, 6)}@e2e.test`;
  const branchId = randomUUID();
  let ownerId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.tenant.create({
      data: { id: tenantId, name: 'HS E2E', taxId, vatPercentage: 19 },
    });
    await prisma.branch.create({
      data: { id: branchId, tenantId, name: 'Main', address: 'x', isActive: true },
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
    const owner = await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId,
        branchId,
        roleId: role.id,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        fullName: 'E2E Owner',
        isActive: true,
      },
    });
    ownerId = owner.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password, tenantId })
      .expect(200);
    userToken = loginRes.body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.homeServiceRequest.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.message.deleteMany({ where: { session: { tenantId } } });
    await prisma.whatsAppSession.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.branch.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  let requestId: string;

  it('creates a home-service request', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/home-services')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        customerName: 'Pedro Varado',
        customerPhone: '3001234567',
        address: 'Calle 1 #2-3',
        problemDesc: 'Moto no enciende',
        serviceType: 'mecánica',
      })
      .expect(201);
    expect(res.body.status).toBe('PENDING');
    requestId = res.body.id;
  });

  it('lists the request and filters by status', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/home-services')
      .query({ status: 'PENDING' })
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const ids = (res.body.items as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(requestId);
  });

  it('assigns a technician and moves to ASSIGNED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/home-services/${requestId}/assign`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ assignedTo: ownerId })
      .expect(200);
    expect(res.body.status).toBe('ASSIGNED');
    expect(res.body.assignedTo).toBe(ownerId);
  });

  it('rejects an invalid status (422)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/home-services/${requestId}/status`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'NOPE' })
      .expect(422);
  });

  it('updates to a valid status', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/home-services/${requestId}/status`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('returns 404 assigning a non-existent request', async () => {
    await request(app.getHttpServer())
      .patch(`/api/home-services/${randomUUID()}/assign`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ assignedTo: ownerId })
      .expect(404);
  });
});
