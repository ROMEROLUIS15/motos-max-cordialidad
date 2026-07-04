import { SendOwnerWhatsAppUseCase } from './send-owner-whatsapp.use-case';

describe('SendOwnerWhatsAppUseCase', () => {
  it('delegates to the messaging port and forwards whether it was sent', async () => {
    const messaging = { sendOwnerMessage: jest.fn().mockResolvedValue(true) };
    const useCase = new SendOwnerWhatsAppUseCase(messaging as never);

    const result = await useCase.execute('tenant-1', 'Hola, tienes un mensaje nuevo');

    expect(messaging.sendOwnerMessage).toHaveBeenCalledWith(
      'tenant-1',
      'Hola, tienes un mensaje nuevo',
    );
    expect(result).toEqual({ sent: true });
  });

  it('reports sent: false when the messaging port could not deliver it', async () => {
    const messaging = { sendOwnerMessage: jest.fn().mockResolvedValue(false) };
    const useCase = new SendOwnerWhatsAppUseCase(messaging as never);
    await expect(useCase.execute('tenant-1', 'Hola')).resolves.toEqual({ sent: false });
  });
});
