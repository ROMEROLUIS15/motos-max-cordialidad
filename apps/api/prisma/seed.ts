import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { SystemRole, SYSTEM_ROLE_PERMISSIONS } from '../src/domain/entities/role.entity';

const prisma = new PrismaClient();

const DEMO_TAX_ID = '900123456-7';
const DEMO_PASSWORD = 'Demo1234!';

async function main() {
  console.log('🌱 Seeding demo data...');

  // ── Tenant + Branch ──────────────────────────────────────────────────────
  let tenant = await prisma.tenant.findUnique({ where: { taxId: DEMO_TAX_ID } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        id: randomUUID(),
        name: 'MotoTaller Demo',
        taxId: DEMO_TAX_ID,
        address: 'Calle 123 #45-67, Bogotá',
        phone: '+57 1 555 0100',
        email: 'contacto@mototaller.demo',
        vatPercentage: 19,
      },
    });
  }
  const tenantId = tenant.id;

  let branch = await prisma.branch.findFirst({ where: { tenantId } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { id: randomUUID(), tenantId, name: 'Sede Principal', address: 'Calle 123 #45-67', phone: '+57 1 555 0100', isActive: true },
    });
  }
  const branchId = branch.id;

  // ── Roles + permissions ──────────────────────────────────────────────────
  const roleIdByName: Record<string, string> = {};
  for (const roleName of Object.values(SystemRole)) {
    let role = await prisma.role.findFirst({ where: { tenantId, name: roleName } });
    if (!role) {
      role = await prisma.role.create({
        data: { id: randomUUID(), tenantId, name: roleName, isSystem: true },
      });
      await prisma.rolePermission.createMany({
        data: SYSTEM_ROLE_PERMISSIONS[roleName].map((p) => ({
          id: randomUUID(),
          roleId: role!.id,
          module: p.module,
          action: p.action,
        })),
      });
    }
    roleIdByName[roleName] = role.id;
  }

  // ── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const users = [
    { email: 'owner@demo.com', fullName: 'Olivia Owner', role: SystemRole.OWNER },
    { email: 'recepcion@demo.com', fullName: 'Rita Recepción', role: SystemRole.RECEPTIONIST },
    { email: 'tecnico@demo.com', fullName: 'Tomás Técnico', role: SystemRole.TECHNICIAN },
  ];
  const userIdByEmail: Record<string, string> = {};
  for (const u of users) {
    let user = await prisma.user.findFirst({ where: { tenantId, email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: randomUUID(),
          tenantId,
          branchId,
          roleId: roleIdByName[u.role],
          email: u.email,
          passwordHash,
          fullName: u.fullName,
          isActive: true,
        },
      });
    }
    userIdByEmail[u.email] = user.id;
  }

  // ── Customers + Vehicles ─────────────────────────────────────────────────
  const customers = [
    { fullName: 'Carlos Pérez', documentNumber: 'CC1001', phone: '+57 300 111 2233', city: 'Bogotá', plate: 'ABC12D', brand: 'Yamaha', model: 'FZ 2.0' },
    { fullName: 'María Gómez', documentNumber: 'CC1002', phone: '+57 300 444 5566', city: 'Medellín', plate: 'XYZ98E', brand: 'Honda', model: 'CB 190R' },
  ];
  for (const c of customers) {
    let customer = await prisma.customer.findFirst({ where: { tenantId, documentNumber: c.documentNumber } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          id: randomUUID(), tenantId, fullName: c.fullName, documentType: 'CC',
          documentNumber: c.documentNumber, phone: c.phone, whatsappPhone: c.phone, city: c.city, isActive: true,
        },
      });
      await prisma.vehicle.create({
        data: {
          id: randomUUID(), tenantId, plate: c.plate, brand: c.brand, model: c.model,
          year: 2022, color: 'Negro', engineNumber: `ENG-${c.plate}`, currentOwnerId: customer.id,
        },
      });
    }
  }

  // ── Parts + stock ────────────────────────────────────────────────────────
  const parts = [
    { sku: 'OIL-10W40', name: 'Aceite 10W40 1L', category: 'Lubricantes', cost: 18000, sale: 28000, min: 5, stock: 20 },
    { sku: 'BRK-PAD-01', name: 'Pastillas de freno', category: 'Frenos', cost: 25000, sale: 45000, min: 4, stock: 12 },
    { sku: 'FLT-AIR-01', name: 'Filtro de aire', category: 'Filtros', cost: 12000, sale: 22000, min: 6, stock: 3 },
  ];
  for (const p of parts) {
    let part = await prisma.part.findFirst({ where: { tenantId, sku: p.sku } });
    if (!part) {
      part = await prisma.part.create({
        data: {
          id: randomUUID(), tenantId, sku: p.sku, name: p.name, category: p.category, unit: 'unidad',
          costPrice: p.cost, salePrice: p.sale, minStockAlert: p.min, isActive: true,
        },
      });
      await prisma.partBranchStock.create({
        data: { id: randomUUID(), partId: part.id, branchId, stockFisico: p.stock, stockReservado: 0 },
      });
    }
  }

  // ── Service catalog ──────────────────────────────────────────────────────
  const services = [
    { name: 'Cambio de aceite', serviceType: 'MAINTENANCE', estimatedHours: 0.5, suggestedPrice: 35000 },
    { name: 'Sincronización', serviceType: 'MAINTENANCE', estimatedHours: 1.5, suggestedPrice: 80000 },
    { name: 'Revisión de frenos', serviceType: 'REPAIR', estimatedHours: 1, suggestedPrice: 60000 },
  ];
  for (const s of services) {
    const exists = await prisma.serviceCatalogItem.findFirst({ where: { tenantId, name: s.name } });
    if (!exists) {
      await prisma.serviceCatalogItem.create({
        data: {
          id: randomUUID(), tenantId, name: s.name, serviceType: s.serviceType,
          estimatedHours: s.estimatedHours, suggestedPrice: s.suggestedPrice, isActive: true,
        },
      });
    }
  }

  console.log('✅ Seed complete.');
  console.log(`   Tenant:   ${tenant.name} (${tenantId})`);
  console.log(`   Login:    owner@demo.com / ${DEMO_PASSWORD}  (tenantId above)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
