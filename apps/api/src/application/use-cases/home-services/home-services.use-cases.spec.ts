import {
  CreateHomeServiceRequestUseCase,
  ListHomeServiceRequestsUseCase,
  AssignHomeServiceRequestUseCase,
  UpdateHomeServiceStatusUseCase,
} from './home-services.use-cases';

const baseCreateInput = {
  tenantId: 'tenant-1',
  customerName: 'Juan Perez',
  customerPhone: '3001234567',
  address: 'Calle 1',
  problemDesc: 'No enciende',
  serviceType: 'GENERAL',
};

describe('CreateHomeServiceRequestUseCase', () => {
  function make() {
    const repo = { create: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      notifyAdmins: jest.fn().mockResolvedValue(undefined),
      notifyUser: jest.fn(),
    };
    const messaging = { sendOwnerMessage: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateHomeServiceRequestUseCase(
      repo as never,
      notifications as never,
      messaging as never,
    );
    return { useCase, repo, notifications, messaging };
  }

  it('creates a PENDING request, persists it and notifies admins + the owner via WhatsApp', async () => {
    const { useCase, repo, notifications, messaging } = make();
    const result = await useCase.execute(baseCreateInput);

    expect(result.status).toBe('PENDING');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: result.id, status: 'PENDING', customerName: 'Juan Perez' }),
    );
    expect(notifications.notifyAdmins).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ type: 'HOME_SERVICE_REQUEST', resourceId: result.id }),
    );
    expect(messaging.sendOwnerMessage).toHaveBeenCalledWith(
      'tenant-1',
      expect.stringContaining('Juan Perez'),
    );
  });

  it('still returns the created request when the best-effort notifications fail', async () => {
    const { useCase, notifications, repo } = make();
    notifications.notifyAdmins.mockRejectedValue(new Error('down'));

    const result = await useCase.execute(baseCreateInput);

    expect(result.status).toBe('PENDING');
    expect(repo.create).toHaveBeenCalled();
  });
});

describe('ListHomeServiceRequestsUseCase', () => {
  it('forwards the status filter and pagination to the repository', async () => {
    const repo = {
      list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }),
    };
    const useCase = new ListHomeServiceRequestsUseCase(repo as never);

    await useCase.execute('tenant-1', 'PENDING', { page: 1, pageSize: 20 });

    expect(repo.list).toHaveBeenCalledWith(
      'tenant-1',
      { status: 'PENDING' },
      { page: 1, pageSize: 20 },
    );
  });
});

describe('AssignHomeServiceRequestUseCase', () => {
  function make() {
    const repo = {
      update: jest
        .fn()
        .mockResolvedValue({ id: 'hs-1', customerName: 'Juan Perez', customerPhone: '3001234567' }),
    };
    const users = {
      findById: jest.fn().mockResolvedValue({ id: 'tech-1', fullName: 'Carlos Tecnico' }),
    };
    const messaging = { sendDirectMessage: jest.fn().mockResolvedValue(undefined) };
    const useCase = new AssignHomeServiceRequestUseCase(
      repo as never,
      users as never,
      messaging as never,
    );
    return { useCase, repo, users, messaging };
  }

  it('throws when the technician does not exist for the tenant', async () => {
    const { useCase, users } = make();
    users.findById.mockResolvedValue(null);
    await expect(useCase.execute('hs-1', 'tenant-1', 'tech-1')).rejects.toMatchObject({
      code: 'HOME_SERVICE_TECHNICIAN_NOT_FOUND',
    });
  });

  it('returns null when the request does not exist (repo.update returns null)', async () => {
    const { useCase, repo } = make();
    repo.update.mockResolvedValue(null);
    await expect(useCase.execute('hs-1', 'tenant-1', 'tech-1')).resolves.toBeNull();
  });

  it('assigns the technician and messages the customer with their name', async () => {
    const { useCase, repo, messaging } = make();
    const result = await useCase.execute('hs-1', 'tenant-1', 'tech-1');

    expect(repo.update).toHaveBeenCalledWith('hs-1', 'tenant-1', {
      assignedTo: 'tech-1',
      status: 'ASSIGNED',
    });
    expect(messaging.sendDirectMessage).toHaveBeenCalledWith(
      'tenant-1',
      '3001234567',
      expect.stringContaining('Carlos Tecnico'),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'hs-1' }));
  });

  it('still returns the updated request when the notification fails', async () => {
    const { useCase, messaging } = make();
    messaging.sendDirectMessage.mockRejectedValue(new Error('down'));
    await expect(useCase.execute('hs-1', 'tenant-1', 'tech-1')).resolves.toEqual(
      expect.objectContaining({ id: 'hs-1' }),
    );
  });
});

describe('UpdateHomeServiceStatusUseCase', () => {
  it('throws a DomainException for an invalid status', async () => {
    const repo = { update: jest.fn() };
    const useCase = new UpdateHomeServiceStatusUseCase(repo as never);
    await expect(useCase.execute('hs-1', 'tenant-1', 'BOGUS')).rejects.toMatchObject({
      code: 'HOME_SERVICE_INVALID_STATUS',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('delegates to the repository for a valid status', async () => {
    const repo = { update: jest.fn().mockResolvedValue({ id: 'hs-1', status: 'COMPLETED' }) };
    const useCase = new UpdateHomeServiceStatusUseCase(repo as never);
    await useCase.execute('hs-1', 'tenant-1', 'COMPLETED');
    expect(repo.update).toHaveBeenCalledWith('hs-1', 'tenant-1', { status: 'COMPLETED' });
  });
});
