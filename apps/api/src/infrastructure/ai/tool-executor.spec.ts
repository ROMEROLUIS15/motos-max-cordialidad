import { z } from 'zod';
import { ToolExecutor } from './tool-executor';
import { AgentTool, ExecutionContext } from '../../application/ai/agent-tool';

const ctx: ExecutionContext = { tenantId: 't1', branchId: null, customerId: 'c1', callCount: 0 };

function makeTool(execute: AgentTool['execute']): AgentTool {
  return {
    name: 'sample',
    description: 'sample',
    isPublic: false,
    schema: z.object({ id: z.string() }),
    parameters: {},
    execute,
  };
}

describe('ToolExecutor', () => {
  const executor = new ToolExecutor();

  it('rejects invalid args via the Zod schema', async () => {
    const tool = makeTool(async () => ({ ok: true }));
    const result = await executor.execute(tool, { wrong: 1 }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('inválidos');
  });

  it('returns the output for valid args', async () => {
    const tool = makeTool(async (args) => ({ echoed: (args as { id: string }).id }));
    const result = await executor.execute(tool, { id: 'abc' }, ctx);
    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ echoed: 'abc' });
  });

  it('times out a slow tool (5s limit)', async () => {
    const tool = makeTool(
      () =>
        new Promise((resolve) => {
          const t = setTimeout(resolve, 6000);
          t.unref();
        }),
    );
    const result = await executor.execute(tool, { id: 'x' }, ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('timeout');
  }, 8000);
});
