import { CreateSaleOrderUseCase } from './create-sale-order.use-case';
import { Customer } from '../../../../domain/entities/customer.entity';
import {
  MotorcycleUnit,
  MotorcycleStatus,
} from '../../../../domain/entities/motorcycle-unit.entity';
import { SaleOrder } from '../../../../domain/entities/sale-order.entity';

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

function makeUnit(status: MotorcycleStatus = 'AVAILABLE'): MotorcycleUnit {
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
    status,
    null,
    null,
    now,
    now,
  );
}

function make() {
  const orderRepo = {
    findActiveByUnit: jest.fn().mockResolvedValue(null),
    generateOrderNumber: jest.fn().mockResolvedValue('SO-2026-000001'),
    create: jest.fn().mockResolvedValue(undefined),
  };
  const unitRepo = {
    findById: jest.fn().mockResolvedValue(makeUnit()),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const customerRepo = {
    findById: jest.fn().mockResolvedValue(makeCustomer()),
  };
  const useCase = new CreateSaleOrderUseCase(
    orderRepo as never,
    unitRepo as never,
    customerRepo as never,
  );
  return { useCase, orderRepo, unitRepo, customerRepo };
}

const baseInput = {
  tenantId: 'tenant-1',
  branchId: 'branch-1',
  createdBy: 'user-1',
  customerId: 'cust-1',
  motorcycleUnitId: 'unit-1',
};

describe('CreateSaleOrderUseCase', () => {
  it('throws NotFoundException when the customer does not exist', async () => {
    const { useCase, customerRepo } = make();
    customerRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 404 });
  });

  it('throws NotFoundException when the motorcycle unit does not exist', async () => {
    const { useCase, unitRepo } = make();
    unitRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 404 });
  });

  it('throws ConflictException when the unit is already sold', async () => {
    const { useCase, unitRepo } = make();
    unitRepo.findById.mockResolvedValue(makeUnit('SOLD'));
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 409 });
  });

  it('throws ConflictException when the unit already has an active sale', async () => {
    const { useCase, orderRepo } = make();
    orderRepo.findActiveByUnit.mockResolvedValue({ orderNumber: 'SO-2026-000000' } as SaleOrder);
    await expect(useCase.execute(baseInput)).rejects.toMatchObject({ status: 409 });
  });

  it('computes the total, defaults paymentMethod to CASH, and reserves the unit', async () => {
    const { useCase, orderRepo, unitRepo } = make();
    const order = await useCase.execute({ ...baseInput, discount: 500_000 });

    expect(order.salePrice).toBe(10_000_000);
    expect(order.discount).toBe(500_000);
    expect(order.totalAmount).toBe(9_500_000);
    expect(order.paymentMethod).toBe('CASH');
    expect(order.status).toBe('DRAFT');
    expect(orderRepo.create).toHaveBeenCalledWith(order);
    expect(unitRepo.save).toHaveBeenCalled();
    const savedUnit = unitRepo.save.mock.calls[0][0] as MotorcycleUnit;
    expect(savedUnit.status).toBe('RESERVED');
  });

  it('keeps financingMonths null for a CASH sale even if provided', async () => {
    const { useCase } = make();
    const order = await useCase.execute({
      ...baseInput,
      paymentMethod: 'CASH',
      financingMonths: 12,
    });
    expect(order.financingMonths).toBeNull();
  });

  it('sets financingMonths for a FINANCED sale', async () => {
    const { useCase } = make();
    const order = await useCase.execute({
      ...baseInput,
      paymentMethod: 'FINANCED',
      financingMonths: 24,
    });
    expect(order.paymentMethod).toBe('FINANCED');
    expect(order.financingMonths).toBe(24);
  });
});
