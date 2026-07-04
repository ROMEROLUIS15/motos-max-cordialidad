import { WhatsAppCloudAdapter } from './whatsapp-cloud.adapter';
import { WhatsAppSessionRecord } from '../../domain/repositories/whatsapp.repository';

const session: WhatsAppSessionRecord = {
  id: 'sess-1',
  tenantId: 'tenant-1',
  customerId: 'cust-1',
  phoneNumber: '573001112233',
  isAnonymous: false,
  lastMessageAt: new Date(),
  createdAt: new Date(),
};

describe('WhatsAppCloudAdapter — 24h window decision', () => {
  const originalTemplate = process.env['WHATSAPP_UTILITY_TEMPLATE'];

  let repo: {
    findSessionByPhone: jest.Mock;
    createSession: jest.Mock;
    createMessage: jest.Mock;
    touchSession: jest.Mock;
    hasInboundSince: jest.Mock;
  };
  let outbound: { enqueue: jest.Mock };
  let adapter: WhatsAppCloudAdapter;

  beforeEach(() => {
    repo = {
      findSessionByPhone: jest.fn().mockResolvedValue(session),
      createSession: jest.fn(),
      createMessage: jest.fn(),
      touchSession: jest.fn(),
      hasInboundSince: jest.fn(),
    };
    outbound = { enqueue: jest.fn() };
    adapter = new WhatsAppCloudAdapter(repo as never, outbound as never, {} as never);
  });

  afterEach(() => {
    if (originalTemplate === undefined) delete process.env['WHATSAPP_UTILITY_TEMPLATE'];
    else process.env['WHATSAPP_UTILITY_TEMPLATE'] = originalTemplate;
  });

  it('enqueues free text when the customer wrote within the window', async () => {
    process.env['WHATSAPP_UTILITY_TEMPLATE'] = 'notificacion_taller';
    repo.hasInboundSince.mockResolvedValue(true);

    await adapter.sendToPhone(
      'tenant-1',
      session.phoneNumber,
      'cust-1',
      'Tu moto está lista',
      null,
    );

    const job = outbound.enqueue.mock.calls[0][0];
    expect(job.template).toBeUndefined();
    expect(job.tenantId).toBe('tenant-1');
    expect(job.content).toBe('Tu moto está lista');
  });

  it('falls back to the utility template when the window is closed', async () => {
    process.env['WHATSAPP_UTILITY_TEMPLATE'] = 'notificacion_taller';
    repo.hasInboundSince.mockResolvedValue(false);

    await adapter.sendToPhone(
      'tenant-1',
      session.phoneNumber,
      'cust-1',
      'Tu moto está lista',
      null,
    );

    const job = outbound.enqueue.mock.calls[0][0];
    expect(job.template).toEqual({ name: 'notificacion_taller', params: ['Tu moto está lista'] });
    // The persisted message keeps the human-readable content either way.
    expect(repo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Tu moto está lista', status: 'QUEUED' }),
    );
  });

  it('keeps current behavior (free text, no window check) when no template is configured', async () => {
    delete process.env['WHATSAPP_UTILITY_TEMPLATE'];

    await adapter.sendToPhone('tenant-1', session.phoneNumber, 'cust-1', 'Hola', null);

    expect(repo.hasInboundSince).not.toHaveBeenCalled();
    expect(outbound.enqueue.mock.calls[0][0].template).toBeUndefined();
  });

  it('uses the template for a brand-new session (first outreach, no inbound ever)', async () => {
    process.env['WHATSAPP_UTILITY_TEMPLATE'] = 'notificacion_taller';
    repo.findSessionByPhone.mockResolvedValue(null);
    repo.hasInboundSince.mockResolvedValue(false);

    await adapter.sendToPhone('tenant-1', '573009998877', null, 'Bienvenido', null);

    expect(repo.createSession).toHaveBeenCalled();
    expect(outbound.enqueue.mock.calls[0][0].template).toEqual({
      name: 'notificacion_taller',
      params: ['Bienvenido'],
    });
  });
});
