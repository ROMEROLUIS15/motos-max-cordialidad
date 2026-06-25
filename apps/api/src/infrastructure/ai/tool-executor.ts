import { Injectable, Logger } from '@nestjs/common';
import { AgentTool, ExecutionContext } from '../../application/ai/agent-tool';

const TOOL_TIMEOUT_MS = 5_000;

export interface ToolExecutionResult {
  ok: boolean;
  output?: unknown;
  error?: string;
}

/**
 * Stateless tool executor: validates args with the tool's Zod schema, enforces
 * a 5s timeout, and logs each invocation (without sensitive payloads). callCount
 * lives in the ExecutionContext owned by the RouterAgent — never here.
 */
@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);

  async execute(tool: AgentTool, rawArgs: unknown, ctx: ExecutionContext): Promise<ToolExecutionResult> {
    const started = Date.now();
    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      this.logger.warn(`Tool '${tool.name}' invalid args: ${parsed.error.message}`);
      return { ok: false, error: 'Argumentos inválidos' };
    }

    try {
      const output = await this.withTimeout(tool.execute(parsed.data, ctx), TOOL_TIMEOUT_MS);
      this.logger.log(`tool=${tool.name} durationMs=${Date.now() - started} ok=true`);
      return { ok: true, output };
    } catch (error) {
      this.logger.warn(`tool=${tool.name} durationMs=${Date.now() - started} ok=false error=${(error as Error).message}`);
      return { ok: false, error: (error as Error).message };
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Tool timeout')), ms)),
    ]);
  }
}
