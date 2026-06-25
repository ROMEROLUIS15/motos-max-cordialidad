import { ZodType } from 'zod';
import { LLMToolDefinition } from '../ports/llm-provider.port';

export interface ExecutionContext {
  tenantId: string;
  branchId: string | null;
  customerId: string | null;
  /** Mutated by the RouterAgent; the executor is stateless. */
  callCount: number;
}

export interface AgentTool<I = unknown, O = unknown> {
  name: string;
  description: string;
  /** Whether unregistered (anonymous) numbers may use this tool. */
  isPublic: boolean;
  schema: ZodType<I>;
  parameters: Record<string, unknown>; // JSON schema for the LLM
  execute(args: I, ctx: ExecutionContext): Promise<O>;
}

export function toLLMToolDefinition(tool: AgentTool): LLMToolDefinition {
  return { name: tool.name, description: tool.description, parameters: tool.parameters };
}
