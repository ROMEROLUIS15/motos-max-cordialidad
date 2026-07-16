import { GroqAdapter } from './groq.adapter';

describe('GroqAdapter', () => {
  const originalFetch = global.fetch;
  const originalModel = process.env['GROQ_MODEL'];

  const okResponse = () =>
    ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hola' } }] }),
    }) as unknown as Response;

  const sentBody = (fetchMock: jest.Mock): { model: string } =>
    JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as { model: string };

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalModel === undefined) delete process.env['GROQ_MODEL'];
    else process.env['GROQ_MODEL'] = originalModel;
  });

  const complete = async (): Promise<jest.Mock> => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse());
    global.fetch = fetchMock as unknown as typeof fetch;
    await new GroqAdapter().complete({
      messages: [{ role: 'user', content: 'hola' }],
      tools: [],
    });
    return fetchMock;
  };

  it('uses the default model when GROQ_MODEL is not set', async () => {
    delete process.env['GROQ_MODEL'];
    expect(sentBody(await complete()).model).toBe('openai/gpt-oss-120b');
  });

  it('uses GROQ_MODEL when set, so a deprecation is a config change', async () => {
    process.env['GROQ_MODEL'] = 'qwen/qwen3.6-27b';
    expect(sentBody(await complete()).model).toBe('qwen/qwen3.6-27b');
  });

  it('falls back to the default when GROQ_MODEL is set to an empty string', async () => {
    process.env['GROQ_MODEL'] = '';
    expect(sentBody(await complete()).model).toBe('openai/gpt-oss-120b');
  });
});
