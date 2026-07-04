import { GetSaleOrderDetailUseCase } from './get-sale-order-detail.use-case';
import { SaleOrderDetailView } from '../../../../domain/repositories/sale-order.repository';

const view: SaleOrderDetailView = {
  id: 'order-1',
  orderNumber: 'SO-2026-000001',
  status: 'CONFIRMED',
  salePrice: 10_000_000,
  discount: 0,
  totalAmount: 10_000_000,
  paymentMethod: 'CASH',
  downPayment: 0,
  financingMonths: null,
  contractR2Key: null,
  notes: null,
  createdAt: new Date(),
  customerId: 'cust-1',
  customerName: 'Juan Perez',
  motorcycleUnitId: 'unit-1',
  motorcycleLabel: 'Yamaha FZ 2024',
};

describe('GetSaleOrderDetailUseCase', () => {
  it('returns the detail view when the order exists for the tenant', async () => {
    const orderRepo = { findDetailById: jest.fn().mockResolvedValue(view) };
    const useCase = new GetSaleOrderDetailUseCase(orderRepo as never);
    await expect(useCase.execute('order-1', 'tenant-1')).resolves.toBe(view);
    expect(orderRepo.findDetailById).toHaveBeenCalledWith('order-1', 'tenant-1');
  });

  it('throws NotFoundException when the order does not exist (or belongs to another tenant)', async () => {
    const orderRepo = { findDetailById: jest.fn().mockResolvedValue(null) };
    const useCase = new GetSaleOrderDetailUseCase(orderRepo as never);
    await expect(useCase.execute('order-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });
});
