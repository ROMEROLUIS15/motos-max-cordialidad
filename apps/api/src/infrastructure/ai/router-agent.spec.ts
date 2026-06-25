import { RouterAgent } from './router-agent';
import { LLMProviderFactory } from './llm-provider.factory';
import { ToolRegistry } from './tools/tool-registry';
import { ToolExecutor } from './tool-executor';
import { AllLLMProvidersFailedException } from '../../application/ports/llm-provider.port';
import { AgentTool } from '../../application/ai/agent-tool';

function makeAgent(overrides: {
  complete?: jest.Mock;
  tools?: AgentTool[];
  execute?: jest.Mock;
}) {
  const llm = { complete: overrides.complete ?? jest.fn() } as unknown as LLMProviderFactory;
  const tools = overrides.tools ?? [];
  const registry = {
    getAllTools: () => tools,
    getPublicTools: () => tools.filter((t) => t.isPublic),
    getByName: (n: string) => tools.find((t) => t.name === n),
  } as unknown as ToolRegistry;
  const executor = {
    execute: overrides.execute ?? jest.fn().mockResolvedValue({ ok: true, output: {} }),
  } as unknown as ToolExecutor;
  return new RouterAgent(llm, registry, executor);
}

const baseInput = {
  tenantId: 't1',
  branchId: null,
  customerId: 'c1',
  isRegistered: true,
  message: 'hola',
  history: [],
};

describe('RouterAgent', () => {
  it('escalates immediately when the user asks for a human', async () => {
    const agent = makeAgent({ complete: jest.fn() });
    const res = await agent.process({ ...baseInput, message: 'quiero hablar con una persona' });
    expect(res.escalated).toBe(true);
  });

  it('returns the LLM response when no tool is required', async () => {
    const complete = jest.fn().mockResolvedValue({ requiresTool: false, response: 'Hola, ¿en qué ayudo?' });
    const agent = makeAgent({ complete });
    const res = await agent.process(baseInput);
    expect(res.response).toBe('Hola, ¿en qué ayudo?');
    expect(res.escalated).toBe(false);
  });

  it('escalates and falls back when all LLM providers fail', async () => {
    const complete = jest.fn().mockRejectedValue(new AllLLMProvidersFailedException());
    const agent = makeAgent({ complete });
    const res = await agent.process(baseInput);
    expect(res.escalated).toBe(true);
  });

  it('blocks anonymous users from private tools and escalates', async () => {
    const privateTool = { name: 'getWorkOrderStatus', isPublic: false } as AgentTool;
    const complete = jest.fn().mockResolvedValue({ requiresTool: true, toolName: 'getWorkOrderStatus', toolArgs: {} });
    const agent = makeAgent({ complete, tools: [privateTool] });
    const res = await agent.process({ ...baseInput, isRegistered: false });
    expect(res.escalated).toBe(true);
  });

  it('escalates after exceeding the tool-call limit', async () => {
    const tool = { name: 'checkInventory', isPublic: false } as AgentTool;
    // Always asks for a tool → never resolves → hits the 5-call limit.
    const complete = jest.fn().mockResolvedValue({ requiresTool: true, toolName: 'checkInventory', toolArgs: {} });
    const execute = jest.fn().mockResolvedValue({ ok: true, output: {} });
    const agent = makeAgent({ complete, tools: [tool], execute });
    const res = await agent.process(baseInput);
    expect(res.escalated).toBe(true);
    expect(execute).toHaveBeenCalledTimes(5);
  });
});
