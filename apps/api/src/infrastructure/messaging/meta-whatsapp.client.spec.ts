import { MetaApiError, MetaWhatsAppClient } from './meta-whatsapp.client';

jest.mock('../observability/sentry', () => ({ captureException: jest.fn() }));

function mockFetchOnce(status: number, body: unknown): void {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('MetaWhatsAppClient', () => {
  let client: MetaWhatsAppClient;

  beforeEach(() => {
    global.fetch = jest.fn();
    client = new MetaWhatsAppClient();
    // No real 30s/60s backoff waits in tests.
    jest.spyOn(client as never as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue();
  });

  it('returns the Meta message id on success', async () => {
    mockFetchOnce(200, { messages: [{ id: 'wamid.abc' }] });
    await expect(client.sendText('573001112233', 'hola')).resolves.toEqual({
      waMessageId: 'wamid.abc',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries transient 5xx errors up to 3 attempts', async () => {
    mockFetchOnce(500, {});
    mockFetchOnce(503, {});
    mockFetchOnce(200, { messages: [{ id: 'wamid.retry' }] });
    await expect(client.sendText('573001112233', 'hola')).resolves.toEqual({
      waMessageId: 'wamid.retry',
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('fails fast on 4xx with the parsed Meta error code (no retries)', async () => {
    mockFetchOnce(400, {
      error: { code: 131047, message: 'Re-engagement message' },
    });
    const promise = client.sendText('573001112233', 'hola');
    await expect(promise).rejects.toBeInstanceOf(MetaApiError);
    await promise.catch((e: MetaApiError) => {
      expect(e.metaCode).toBe(131047);
      expect(e.isPermanent).toBe(true);
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 transient failures', async () => {
    mockFetchOnce(500, {});
    mockFetchOnce(500, {});
    mockFetchOnce(500, {});
    await expect(client.sendText('573001112233', 'hola')).rejects.toBeInstanceOf(MetaApiError);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('sends templates with body params in Spanish locale', async () => {
    mockFetchOnce(200, { messages: [{ id: 'wamid.tpl' }] });
    await client.sendTemplate('573001112233', 'notificacion_taller', ['Tu moto está lista']);
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(init.body as string);
    expect(payload.type).toBe('template');
    expect(payload.template.name).toBe('notificacion_taller');
    expect(payload.template.language.code).toBe('es');
    expect(payload.template.components[0].parameters).toEqual([
      { type: 'text', text: 'Tu moto está lista' },
    ]);
  });
});
