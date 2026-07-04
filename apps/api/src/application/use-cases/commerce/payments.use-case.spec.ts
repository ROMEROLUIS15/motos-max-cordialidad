import {
  RegisterPaymentUseCase,
  GetPaymentSummaryUseCase,
  SearchPaymentsUseCase,
} from './payments.use-case';
import { Payment } from '../../../domain/entities/payment.entity';

describe('RegisterPaymentUseCase', () => {
  function make() {
    const paymentRepo = { create: jest.fn().mockResolvedValue(undefined) };
    const notification = {
      notifyAdmins: jest.fn().mockResolvedValue(undefined),
      notifyUser: jest.fn(),
    };
    const useCase = new RegisterPaymentUseCase(paymentRepo as never, notification as never);
    return { useCase, paymentRepo, notification };
  }

  const baseInput = {
    tenantId: 'tenant-1',
    workOrderId: 'wo-1',
    amount: 50_000,
    paymentMethod: 'CASH',
    createdBy: 'user-1',
  };

  it('throws UnprocessableEntityException for an invalid payment method', async () => {
    const { useCase, paymentRepo } = make();
    await expect(useCase.execute({ ...baseInput, paymentMethod: 'BITCOIN' })).rejects.toMatchObject(
      {
        status: 422,
      },
    );
    expect(paymentRepo.create).not.toHaveBeenCalled();
  });

  it('propagates the domain invariant for a non-positive amount without persisting or notifying', async () => {
    const { useCase, paymentRepo, notification } = make();
    await expect(useCase.execute({ ...baseInput, amount: 0 })).rejects.toMatchObject({
      code: 'INVALID_PAYMENT_AMOUNT',
    });
    expect(paymentRepo.create).not.toHaveBeenCalled();
    expect(notification.notifyAdmins).not.toHaveBeenCalled();
  });

  it('creates the payment, persists it and notifies admins', async () => {
    const { useCase, paymentRepo, notification } = make();
    const payment = await useCase.execute(baseInput);

    expect(payment.amount).toBe(50_000);
    expect(paymentRepo.create).toHaveBeenCalledWith(payment);
    expect(notification.notifyAdmins).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ type: 'PAYMENT_REGISTERED', workOrderId: 'wo-1', amount: 50_000 }),
    );
  });
});

describe('GetPaymentSummaryUseCase', () => {
  function make() {
    const paymentRepo = {
      findByWorkOrder: jest.fn().mockResolvedValue([]),
      sumByWorkOrder: jest.fn().mockResolvedValue(30_000),
    };
    const workOrderRepo = {
      findByIdWithDetails: jest.fn().mockResolvedValue({ total: 100_000 }),
    };
    const useCase = new GetPaymentSummaryUseCase(paymentRepo as never, workOrderRepo as never);
    return { useCase, paymentRepo, workOrderRepo };
  }

  it('throws NotFoundException when the work order does not exist for the tenant', async () => {
    const { useCase, workOrderRepo } = make();
    workOrderRepo.findByIdWithDetails.mockResolvedValue(null);
    await expect(useCase.execute('wo-1', 'tenant-1')).rejects.toMatchObject({ status: 404 });
  });

  it('computes the outstanding balance as orderTotal minus totalPaid', async () => {
    const { useCase } = make();
    const result = await useCase.execute('wo-1', 'tenant-1');
    expect(result).toEqual({
      orderTotal: 100_000,
      totalPaid: 30_000,
      balance: 70_000,
      payments: [],
    });
  });
});

describe('SearchPaymentsUseCase', () => {
  it('defaults to page 1 / pageSize 20 and forwards the filters', async () => {
    const paymentRepo = {
      search: jest
        .fn()
        .mockResolvedValue({ items: [] as Payment[], total: 0, page: 1, pageSize: 20 }),
    };
    const useCase = new SearchPaymentsUseCase(paymentRepo as never);

    await useCase.execute({ tenantId: 'tenant-1', workOrderId: 'wo-1' });

    expect(paymentRepo.search).toHaveBeenCalledWith(
      { workOrderId: 'wo-1', branchId: undefined, from: undefined, to: undefined },
      'tenant-1',
      { page: 1, pageSize: 20 },
    );
  });
});
