import { QuoteAssembler } from './quote-assembler.service';
import { WorkOrder } from '../../../domain/entities/work-order.entity';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';
import { WorkOrderWithDetails } from '../../../domain/repositories/work-order.repository';
import { Tenant } from '../../../domain/entities/tenant.entity';

function makeDetails(): WorkOrderWithDetails {
  const now = new Date();
  const workOrder = new WorkOrder(
    'wo-1',
    'tenant-1',
    'branch-1',
    'WO-2026-000001',
    'rec-1',
    'veh-1',
    'cust-1',
    'tech-1',
    'GENERAL',
    'desc',
    WorkOrderStatus.PENDING,
    new Date(now.getTime() + 86400000),
    null,
    now,
    now,
    null,
  );
  return {
    workOrder,
    customer: null,
    vehicle: null,
    lines: [
      {
        id: 'line-1',
        workOrderId: 'wo-1',
        description: 'Cambio de aceite',
        estimatedHours: 1,
        unitPrice: 40_000,
        technicianId: null,
        serviceCatalogId: null,
      },
    ],
    parts: [
      {
        id: 'part-line-1',
        workOrderId: 'wo-1',
        partId: 'part-1',
        partName: 'Aceite 20W50',
        partSku: 'SKU-1',
        quantity: 2,
        unitPriceAtSale: 15_000,
      },
    ],
    statusHistory: [],
    total: 70_000,
  };
}

function makeTenant(): Tenant {
  const now = new Date();
  return new Tenant(
    'tenant-1',
    'Taller Demo',
    '900123456-1',
    null,
    'Calle 1',
    '3000000000',
    null,
    19,
    1,
    null,
    null,
    null,
    'Terminos y condiciones',
    now,
    now,
  );
}

function make() {
  const workOrderRepo = { findByIdWithDetails: jest.fn().mockResolvedValue(makeDetails()) };
  const tenantRepo = { findById: jest.fn().mockResolvedValue(makeTenant()) };
  const customerRepo = {
    findById: jest.fn().mockResolvedValue({ fullName: 'Juan Perez', documentNumber: '123456' }),
  };
  const vehicleRepo = {
    findById: jest.fn().mockResolvedValue({ plate: 'ABC123', brand: 'Yamaha', model: 'FZ' }),
  };
  const assembler = new QuoteAssembler(
    workOrderRepo as never,
    tenantRepo as never,
    customerRepo as never,
    vehicleRepo as never,
  );
  return { assembler, workOrderRepo, tenantRepo, customerRepo, vehicleRepo };
}

describe('QuoteAssembler', () => {
  it('throws NotFoundException when the work order does not exist for the tenant', async () => {
    const { assembler, workOrderRepo } = make();
    workOrderRepo.findByIdWithDetails.mockResolvedValue(null);
    await expect(assembler.assemble('wo-1', 'tenant-1', new Date())).rejects.toMatchObject({
      status: 404,
    });
  });

  it('throws NotFoundException when the tenant does not exist', async () => {
    const { assembler, tenantRepo } = make();
    tenantRepo.findById.mockResolvedValue(null);
    await expect(assembler.assemble('wo-1', 'tenant-1', new Date())).rejects.toMatchObject({
      status: 404,
    });
  });

  it('computes vatAmount and total from the work order total and the tenant VAT percentage', async () => {
    const { assembler } = make();
    const result = await assembler.assemble('wo-1', 'tenant-1', new Date());
    expect(result.subtotal).toBe(70_000);
    expect(result.vatPercentage).toBe(19);
    expect(result.vatAmount).toBe(13_300);
    expect(result.total).toBe(83_300);
  });

  it('rounds the VAT to whole pesos — COP has no usable cents', async () => {
    // 1.005 * 19% = 190,95 → must round to 191, never produce $190,95.
    const { assembler, workOrderRepo } = make();
    workOrderRepo.findByIdWithDetails.mockResolvedValue({ ...makeDetails(), total: 1_005 });

    const result = await assembler.assemble('wo-1', 'tenant-1', new Date());

    expect(Number.isInteger(result.vatAmount)).toBe(true);
    expect(result.vatAmount).toBe(191);
    expect(result.total).toBe(1_196);
  });

  it('uses the part name already denormalized on the work order line and totals by quantity * unitPriceAtSale', async () => {
    const { assembler } = make();
    const result = await assembler.assemble('wo-1', 'tenant-1', new Date());
    expect(result.pdfData.parts).toEqual([
      { description: 'Aceite 20W50', quantity: 2, unitPrice: 15_000, total: 30_000 },
    ]);
  });

  it('falls back to placeholders when the customer or vehicle records are missing', async () => {
    const { assembler, customerRepo, vehicleRepo } = make();
    customerRepo.findById.mockResolvedValue(null);
    vehicleRepo.findById.mockResolvedValue(null);

    const result = await assembler.assemble('wo-1', 'tenant-1', new Date());

    expect(result.pdfData.customer).toEqual({ fullName: '—', documentNumber: '—' });
    expect(result.pdfData.vehicle).toEqual({ plate: '—', brand: '', model: '' });
  });
});
