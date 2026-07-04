import { GetSaleContractUrlUseCase } from './get-sale-contract-url.use-case';
import { SaleOrder, SaleOrderStatus } from '../../../../domain/entities/sale-order.entity';
import { MotorcycleUnit } from '../../../../domain/entities/motorcycle-unit.entity';
import { Customer } from '../../../../domain/entities/customer.entity';
import { Tenant } from '../../../../domain/entities/tenant.entity';

function makeOrder(
  status: SaleOrderStatus = 'CONFIRMED',
  contractR2Key: string | null = null,
): SaleOrder {
  const now = new Date();
  return new SaleOrder(
    'order-1',
    'tenant-1',
    'branch-1',
    'cust-1',
    'unit-1',
    'SO-2026-000001',
    10_000_000,
    0,
    10_000_000,
    'CASH',
    0,
    null,
    status,
    null,
    contractR2Key,
    'user-1',
    now,
    now,
  );
}

function makeUnit(): MotorcycleUnit {
  const now = new Date();
  return new MotorcycleUnit(
    'unit-1',
    'tenant-1',
    'branch-1',
    'VIN123',
    'Yamaha',
    'FZ',
    2024,
    150,
    'Rojo',
    'NEW',
    0,
    'ENG1',
    'ABC123',
    8_000_000,
    10_000_000,
    'SOLD',
    null,
    null,
    now,
    now,
  );
}

function makeCustomer(): Customer {
  const now = new Date();
  return new Customer(
    'cust-1',
    'tenant-1',
    'Juan Perez',
    'CC',
    '123456',
    '3001234567',
    null,
    null,
    null,
    'Bogota',
    null,
    null,
    true,
    null,
    null,
    0,
    null,
    now,
    now,
  );
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
    null,
    now,
    now,
  );
}

function make() {
  const orderRepo = {
    findById: jest.fn().mockResolvedValue(makeOrder()),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitRepo = { findById: jest.fn().mockResolvedValue(makeUnit()) };
  const customerRepo = { findById: jest.fn().mockResolvedValue(makeCustomer()) };
  const tenantRepo = { findById: jest.fn().mockResolvedValue(makeTenant()) };
  const pdf = { generateSaleContractPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
  const storage = {
    upload: jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/contract.pdf'),
  };
  const useCase = new GetSaleContractUrlUseCase(
    orderRepo as never,
    unitRepo as never,
    customerRepo as never,
    tenantRepo as never,
    pdf as never,
    storage as never,
  );
  return { useCase, orderRepo, unitRepo, customerRepo, tenantRepo, pdf, storage };
}

describe('GetSaleContractUrlUseCase', () => {
  it('throws NotFoundException when the order does not exist', async () => {
    const { useCase, orderRepo } = make();
    orderRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('order-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('throws UnprocessableEntityException when the order is not CONFIRMED', async () => {
    const { useCase, orderRepo } = make();
    orderRepo.findById.mockResolvedValue(makeOrder('DRAFT'));
    await expect(useCase.execute('order-1', 'tenant-1')).rejects.toMatchObject({ status: 422 });
  });

  it('generates and uploads the PDF, attaches it to the order, and returns a signed url on first request', async () => {
    const { useCase, pdf, storage, orderRepo } = make();
    const result = await useCase.execute('order-1', 'tenant-1');

    expect(pdf.generateSaleContractPdf).toHaveBeenCalledTimes(1);
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringContaining('tenant-1/sale-contracts/order-1/'),
      expect.any(Buffer),
      'application/pdf',
    );
    const savedOrder = orderRepo.save.mock.calls[0][0] as SaleOrder;
    expect(savedOrder.contractR2Key).toContain('SO-2026-000001.pdf');
    expect(result).toEqual({ url: 'https://signed.example/contract.pdf', expiresInSeconds: 3600 });
  });

  it('reuses the already-attached contract and skips PDF generation', async () => {
    const { useCase, orderRepo, pdf, storage } = make();
    orderRepo.findById.mockResolvedValue(
      makeOrder('CONFIRMED', 'tenant-1/sale-contracts/order-1/SO-2026-000001.pdf'),
    );

    const result = await useCase.execute('order-1', 'tenant-1');

    expect(pdf.generateSaleContractPdf).not.toHaveBeenCalled();
    expect(orderRepo.save).not.toHaveBeenCalled();
    expect(storage.getSignedUrl).toHaveBeenCalledWith(
      'tenant-1/sale-contracts/order-1/SO-2026-000001.pdf',
      3600,
    );
    expect(result.url).toBe('https://signed.example/contract.pdf');
  });

  it('throws NotFoundException when tenant/customer/unit data is missing while assembling the contract', async () => {
    const { useCase, tenantRepo } = make();
    tenantRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('order-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });
});
