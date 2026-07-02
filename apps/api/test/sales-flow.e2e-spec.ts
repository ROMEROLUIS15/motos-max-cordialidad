import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/persistence/prisma/prisma.service';
import { SystemRole, SYSTEM_ROLE_PERMISSIONS } from '../src/domain/entities/role.entity';

/**
 * End-to-end sales flow (Fase 3 — venta de motocicletas). Requires DATABASE_URL.
 * Covers MotorcycleUnit registration, listing, status machine and guards.
 */
const describeIfDb = process.env['DATABASE_URL'] ? describe : describe.skip;

describeIfDb('Sales flow — motorcycle units (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  const password = 'Test1234!';
  const tenantId = randomUUID();
  const email = `sf-${randomUUID().slice(0, 6)}@e2e.test`;
  const vin = `VIN-${randomUUID().slice(0, 10).toUpperCase()}`;
  let token: string;
  let branchId: string;
  let unitId: string;

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
        name: 'SF Tenant',
        taxId: `SF-${randomUUID().slice(0, 8)}`,
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
    await prisma.user.create({
      data: {
        id: randomUUID(),
        tenantId,
        branchId,
        roleId: role.id,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        fullName: 'SF Owner',
        isActive: true,
      },
    });

    const res = await http.post('/api/auth/login').send({ email, password, tenantId }).expect(200);
    token = res.body.accessToken;
  });

  afterAll(async () => {
    await prisma.motorcycleUnit.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId } } });
    await prisma.role.deleteMany({ where: { tenantId } });
    await prisma.branch.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('registra una motocicleta nueva (status AVAILABLE)', async () => {
    const res = await http
      .post('/api/motorcycle-units')
      .set(auth())
      .send({
        vin,
        brand: 'Yamaha',
        model: 'MT-03',
        year: 2024,
        displacement: 321,
        color: 'Azul',
        condition: 'NEW',
        costPrice: 18000000,
        salePrice: 21500000,
      })
      .expect(201);
    expect(res.body.status).toBe('AVAILABLE');
    expect(res.body.vin).toBe(vin);
    unitId = res.body.id;
  });

  it('rechaza VIN duplicado (409)', async () => {
    await http
      .post('/api/motorcycle-units')
      .set(auth())
      .send({
        vin,
        brand: 'Honda',
        model: 'CB125',
        year: 2023,
        condition: 'NEW',
        costPrice: 1,
        salePrice: 2,
      })
      .expect(409);
  });

  it('rechaza una NEW con kilometraje (422)', async () => {
    await http
      .post('/api/motorcycle-units')
      .set(auth())
      .send({
        vin: `VIN-${randomUUID().slice(0, 8)}`,
        brand: 'Honda',
        model: 'XR',
        year: 2024,
        condition: 'NEW',
        mileage: 500,
        costPrice: 1000,
        salePrice: 2000,
      })
      .expect(422);
  });

  it('lista las motocicletas del tenant', async () => {
    const res = await http.get('/api/motorcycle-units').set(auth()).expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.items.some((u: { id: string }) => u.id === unitId)).toBe(true);
  });

  it('transición AVAILABLE → RESERVED → SOLD', async () => {
    await http
      .patch(`/api/motorcycle-units/${unitId}/status`)
      .set(auth())
      .send({ status: 'RESERVED' })
      .expect(200);
    await http
      .patch(`/api/motorcycle-units/${unitId}/status`)
      .set(auth())
      .send({ status: 'SOLD' })
      .expect(200);
    const res = await http.get(`/api/motorcycle-units/${unitId}`).set(auth()).expect(200);
    expect(res.body.status).toBe('SOLD');
  });

  it('rechaza transición inválida desde SOLD (422)', async () => {
    await http
      .patch(`/api/motorcycle-units/${unitId}/status`)
      .set(auth())
      .send({ status: 'AVAILABLE' })
      .expect(422);
  });

  it('rechaza editar una unidad ya vendida (409)', async () => {
    await http
      .put(`/api/motorcycle-units/${unitId}`)
      .set(auth())
      .send({ color: 'Rojo' })
      .expect(409);
  });
});
