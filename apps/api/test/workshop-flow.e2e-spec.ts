import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';
import { SystemRole, SYSTEM_ROLE_PERMISSIONS } from '../src/domain/entities/role.entity';

/**
 * End-to-end critical workshop flow (task 9.3.4). Requires DATABASE_URL.
 * The quote sub-flow additionally requires R2 (PDF upload) and is skipped
 * otherwise. Run with: pnpm --filter @motoworkshop/api test:e2e
 */
const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;
const itIfR2 = process.env['R2_BUCKET_NAME'] ? it : it.skip;

describeIfDb('Workshop flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const password = 'Test1234!';
  const tenantId = randomUUID();
  const email = `wf-${randomUUID().slice(0, 6)}@e2e.test`;
  let token: string;
  let branchId: string;
  let ownerId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());

    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'WF Tenant',
        taxId: `WF-${randomUUID().slice(0, 8)}`,
        vatPercentage: 19,
      },
    });
    const branch = await prisma.branch.create({
      data: { id: randomUUID(), tenantId, name: 'Main', address: 'x', isActive: true },
    });
    branchId = branch.id;
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
        fullName: 'WF Owner',
        isActive: true,
      },
    });
    ownerId = owner.id;

    const res = await http.post('/api/auth/login').send({ email, password, tenantId }).expect(200);
    token = res.body.accessToken;
  });

  afterAll(async () => {
    // Clean up in FK-safe order (children before parents).
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.message.deleteMany({ where: { session: { tenantId } } });
    await prisma.whatsAppSession.deleteMany({ where: { tenantId } });
    await prisma.quoteVersion.deleteMany({ where: { quote: { tenantId } } });
    await prisma.quote.deleteMany({ where: { tenantId } });
    await prisma.payment.deleteMany({ where: { tenantId } });
    await prisma.photoEvidence.deleteMany({ where: { workOrder: { tenantId } } });
    await prisma.workOrderPart.deleteMany({ where: { workOrder: { tenantId } } });
    await prisma.workOrderLine.deleteMany({ where: { workOrder: { tenantId } } });
    await prisma.workOrderStatusHistory.deleteMany({ where: { workOrder: { tenantId } } });
    await prisma.workOrder.deleteMany({ where: { tenantId } });
    await prisma.receptionPhoto.deleteMany({ where: { reception: { tenantId } } });
    await prisma.vehicleReception.deleteMany({ where: { tenantId } });
    await prisma.stockEntry.deleteMany({ where: { tenantId } });
    await prisma.partBranchStock.deleteMany({ where: { part: { tenantId } } });
    await prisma.part.deleteMany({ where: { tenantId } });
    await prisma.vehicle.deleteMany({ where: { tenantId } });
    await prisma.customer.deleteMany({ where: { tenantId } });
    await prisma.refreshToken.deleteMany({ where: { user: { tenantId } } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.branch.deleteMany({ where: { tenantId } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await app.close();
  });

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  async function createWorkOrderWithReception(): Promise<{
    workOrderId: string;
    vehicleId: string;
  }> {
    const customer = await auth(http.post('/api/customers'))
      .send({
        fullName: 'Cliente WF',
        documentType: 'CC',
        documentNumber: `DOC-${randomUUID().slice(0, 8)}`,
        phone: '300',
        city: 'Bogotá',
      })
      .expect(201);
    const vehicle = await auth(http.post('/api/vehicles'))
      .send({
        plate: `WF${randomUUID().slice(0, 4)}`,
        brand: 'Yamaha',
        model: 'FZ',
        year: 2022,
        color: 'Negro',
        engineNumber: `ENG-${randomUUID().slice(0, 6)}`,
        currentOwnerId: customer.body.id,
      })
      .expect(201);
    const reception = await auth(http.post('/api/receptions'))
      .send({
        branchId,
        vehicleId: vehicle.body.id,
        odometerReading: 10000,
        fuelLevel: 'HALF',
      })
      .expect(201);
    const wo = await auth(http.post('/api/work-orders'))
      .send({
        receptionId: reception.body.id,
        technicianId: ownerId,
        serviceType: 'MAINTENANCE',
        problemDescription: 'Mantenimiento',
        promisedDeliveryAt: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(201);
    return { workOrderId: wo.body.id, vehicleId: vehicle.body.id };
  }

  it('reserves stock when a part is added and confirms the discount on DELIVERED', async () => {
    // Part with 10 units in stock.
    const part = await auth(http.post('/api/parts'))
      .send({
        sku: `SKU-${randomUUID().slice(0, 8)}`,
        name: 'Filtro',
        category: 'Filtros',
        unit: 'unidad',
        costPrice: 1000,
        salePrice: 2000,
      })
      .expect(201);
    await auth(http.post('/api/stock/entry'))
      .send({ partId: part.body.id, quantity: 10 })
      .expect(201);

    const { workOrderId } = await createWorkOrderWithReception();

    // Add 2 units → should reserve.
    await auth(http.post(`/api/work-orders/${workOrderId}/parts`))
      .send({ partId: part.body.id, quantity: 2 })
      .expect(201);

    const reserved = await auth(http.get(`/api/parts/${part.body.id}`).query({ branchId })).expect(
      200,
    );
    expect(reserved.body.stock.stockReservado).toBe(2);
    expect(reserved.body.stock.stockDisponible).toBe(8);
    expect(reserved.body.stock.stockFisico).toBe(10);

    // Drive the state machine to DELIVERED.
    for (const newStatus of ['IN_PROGRESS', 'COMPLETED', 'DELIVERED']) {
      await auth(http.post(`/api/work-orders/${workOrderId}/status`))
        .send({ newStatus, finalOdometer: newStatus === 'COMPLETED' ? 10500 : undefined })
        .expect(201);
    }

    const detail = await auth(http.get(`/api/work-orders/${workOrderId}`)).expect(200);
    expect(detail.body.workOrder.status).toBe('DELIVERED');

    // Physical stock decremented, reservation released.
    const after = await auth(http.get(`/api/parts/${part.body.id}`).query({ branchId })).expect(
      200,
    );
    expect(after.body.stock.stockFisico).toBe(8);
    expect(after.body.stock.stockReservado).toBe(0);
  });

  it('rejects an invalid state transition (PENDING → COMPLETED) with 422', async () => {
    const { workOrderId } = await createWorkOrderWithReception();
    const res = await auth(http.post(`/api/work-orders/${workOrderId}/status`))
      .send({ newStatus: 'COMPLETED' })
      .expect(422);
    expect(res.body.code).toBe('WORK_ORDER_INVALID_TRANSITION');
  });

  itIfR2('approves a quote and moves the work order to IN_PROGRESS', async () => {
    const { workOrderId } = await createWorkOrderWithReception();
    await auth(http.post(`/api/work-orders/${workOrderId}/lines`))
      .send({ description: 'Servicio', unitPrice: 50000 })
      .expect(201);

    const quote = await auth(http.post('/api/quotes')).send({ workOrderId }).expect(201);
    await auth(http.post(`/api/quotes/${quote.body.id}/send`)).expect(201);
    await auth(http.post(`/api/quotes/${quote.body.id}/approve`)).expect(201);

    const detail = await auth(http.get(`/api/work-orders/${workOrderId}`)).expect(200);
    expect(detail.body.workOrder.status).toBe('IN_PROGRESS');
  });
});
