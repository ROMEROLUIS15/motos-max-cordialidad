import { ProcessIncomingMessageUseCase } from './process-incoming-message.use-case';

/**
 * Idempotency guard for the WhatsApp webhook: Meta delivers at-least-once and a
 * signed request can be replayed, so a message id already stored must be a
 * no-op — no second agent run, no duplicate reply to the customer.
 */
describe('ProcessIncomingMessageUseCase — webhook idempotency', () => {
  const build = (alreadySeen: boolean) => {
    const whatsappRepo = {
      messageExistsByWaId: jest.fn().mockResolvedValue(alreadySeen),
      findSessionByPhone: jest.fn().mockResolvedValue(null),
      createSession: jest.fn(),
      createMessage: jest.fn(),
      touchSession: jest.fn(),
      lastInboundRespondedWithin: jest.fn().mockResolvedValue(true),
      findRecentMessages: jest.fn().mockResolvedValue([]),
    };
    const notification = { notifyAdmins: jest.fn() };
    const users = { findOwnerByWhatsappPhone: jest.fn().mockResolvedValue(null) };
    const routerAgent = { process: jest.fn() };
    const whatsapp = { sendToPhone: jest.fn() };
    const agents = { routeAdminMessage: jest.fn() };
    const customerRepo = { findIdByPhone: jest.fn().mockResolvedValue('cust-1') };
    const tenantRepo = { findById: jest.fn().mockResolvedValue(null) };
    const useCase = new ProcessIncomingMessageUseCase(
      whatsappRepo as never,
      notification as never,
      users as never,
      routerAgent as never,
      whatsapp as never,
      agents as never,
      customerRepo as never,
      tenantRepo as never,
    );
    return { useCase, whatsappRepo, routerAgent, customerRepo };
  };

  const input = {
    tenantId: 't1',
    from: '+573001112233',
    content: 'hola',
    waMessageId: 'wamid.ABC',
  };

  it('skips a message id already processed — no store, no agent', async () => {
    const { useCase, whatsappRepo, routerAgent, customerRepo } = build(true);
    await useCase.execute(input);
    expect(whatsappRepo.messageExistsByWaId).toHaveBeenCalledWith('wamid.ABC');
    expect(whatsappRepo.createMessage).not.toHaveBeenCalled();
    expect(customerRepo.findIdByPhone).not.toHaveBeenCalled();
    expect(routerAgent.process).not.toHaveBeenCalled();
  });

  it('processes a new message id normally', async () => {
    const { useCase, whatsappRepo } = build(false);
    await useCase.execute(input);
    expect(whatsappRepo.createMessage).toHaveBeenCalledTimes(1);
  });
});
