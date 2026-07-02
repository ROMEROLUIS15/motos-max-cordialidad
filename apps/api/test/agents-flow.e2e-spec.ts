import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';
import { TokenFactoryService } from '../src/application/services/token-factory.service';
import { SystemRole, SYSTEM_ROLE_PERMISSIONS } from '../src/domain/entities/role.entity';

/**
 * Fase 2A — service-to-service agents endpoints. Requires DATABASE_URL;
 * skipped otherwise so the unit suite stays green without infrastructure.
 */
const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

describeIfDb('Agents service endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let serviceToken: string;
  let userToken: string;

  const password = 'Test1234!';
  const tenantId = randomUUID();
  const taxId = `E2E-${randomUUID().slice(0, 8)}`;
  const email = `owner-${randomUUID().slice(0, 6)}@e2e.test`;
  const branchId = randomUUID();
  const partId = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    serviceToken = app.get(TokenFactoryService).createServiceToken();

    await prisma.tenant.create({
      data: { id: tenantId, name: 'Agents E2E', taxId, vatPercentage: 19 },
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
    await prisma.user.create({
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

    // A low-stock part with one SALIDA so inventory/status returns it.
    await prisma.part.create({
      data: {
        id: partId,
        tenantId,
        sku: `SKU-${randomUUID().slice(0, 6)}`,
        name: 'Filtro E2E',
        category: 'Filtros',
        unit: 'unidad',
        costPrice: 10,
        salePrice: 20,
        minStockAlert: 5,
      },
    });
    await prisma.partBranchStock.create({
      data: { id: randomUUID(), partId, branchId, stockFisico: 2, stockReservado: 0 },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password, tenantId })
      .expect(200);
    userToken = loginRes.body.accessToken as string;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.report.deleteMany({ where: { tenantId } });
    await prisma.purchaseOrderDraft.deleteMany({ where: { tenantId } });
    await prisma.stockEntry.deleteMany({ where: { tenantId } });
    await prisma.partBranchStock.deleteMany({ where: { partId } });
    await prisma.part.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.branch.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  it('rejects a request without a token (401)', async () => {
    await request(app.getHttpServer()).get('/api/agents/tenants').expect(401);
  });

  it('rejects a normal user token (401) — service token required', async () => {
    await request(app.getHttpServer())
      .get('/api/agents/tenants')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(401);
  });

  it('lists active tenants with a service token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/agents/tenants')
      .set('Authorization', `Bearer ${serviceToken}`)
      .expect(200);
    const ids = (res.body as Array<{ id: string }>).map((t) => t.id);
    expect(ids).toContain(tenantId);
  });

  it('returns a dashboard summary for the period', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/agents/dashboard/summary')
      .query({ tenantId, periodStart: '2026-01-01', periodEnd: '2026-12-31' })
      .set('Authorization', `Bearer ${serviceToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('totalIncome');
    expect(res.body).toHaveProperty('completedOrders');
    expect(res.body).toHaveProperty('avgTicket');
  });

  it('returns inventory status with the low-stock part', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/agents/inventory/status')
      .query({ tenantId })
      .set('Authorization', `Bearer ${serviceToken}`)
      .expect(200);
    const skus = (res.body.items as Array<{ partId: string }>).map((i) => i.partId);
    expect(skus).toContain(partId);
  });

  it('creates a purchase order draft', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/agents/purchase-orders/draft')
      .set('Authorization', `Bearer ${serviceToken}`)
      .send({ tenantId, items: [{ partId, quantity: 10, reason: 'low stock' }], notes: 'auto' })
      .expect(201);
    expect(res.body.status).toBe('DRAFT');
    const row = await prisma.purchaseOrderDraft.findUnique({ where: { id: res.body.id } });
    expect(row).not.toBeNull();
  });

  it('rejects a draft with empty items (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/agents/purchase-orders/draft')
      .set('Authorization', `Bearer ${serviceToken}`)
      .send({ tenantId, items: [] })
      .expect(400);
  });

  it('lists and approves a purchase order draft via the web API', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/agents/purchase-orders/draft')
      .set('Authorization', `Bearer ${serviceToken}`)
      .send({ tenantId, items: [{ partId, quantity: 5 }], notes: 'reorder' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/api/purchase-orders')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const ids = (list.body.items as Array<{ id: string }>).map((d) => d.id);
    expect(ids).toContain(created.body.id);

    const approved = await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.approvedBy).toBeTruthy();
  });

  it('creates an in-app stock alert for the owner', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/agents/notifications/stock-alert')
      .set('Authorization', `Bearer ${serviceToken}`)
      .send({ tenantId, partId, partName: 'Filtro E2E', currentStock: 2, minStock: 5 })
      .expect(201);
    expect(res.body.notified).toBeGreaterThanOrEqual(1);
    const count = await prisma.notification.count({ where: { tenantId, type: 'STOCK_ALERT' } });
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('queues a proactive WhatsApp to the owner (no phone → not sent)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/agents/notifications/whatsapp')
      .set('Authorization', `Bearer ${serviceToken}`)
      .send({ tenantId, content: 'Hola admin' })
      .expect(201);
    // Owner has no whatsappPhone and tenant none → sent=false (no crash).
    expect(res.body).toHaveProperty('sent');
  });

  it('generates a pending report, then lists it via the web API', async () => {
    const gen = await request(app.getHttpServer())
      .post('/api/agents/reports/generate')
      .set('Authorization', `Bearer ${serviceToken}`)
      .send({ tenantId, type: 'WEEKLY', periodStart: '2026-06-01', periodEnd: '2026-06-07' })
      .expect(201);
    expect(gen.body.status).toBe('PENDING');

    const list = await request(app.getHttpServer())
      .get('/api/reports')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    const ids = (list.body.items as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(gen.body.id);

    // Not ready yet → download returns 422.
    await request(app.getHttpServer())
      .get(`/api/reports/${gen.body.id}/download`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(422);
  });
});
