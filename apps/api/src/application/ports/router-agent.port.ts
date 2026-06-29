import { LLMMessage } from '../ports/llm-provider.port';

export const ROUTER_AGENT_PORT = Symbol('RouterAgentPort');

export interface RouterAgentInput {
  tenantId: string;
  branchId: string | null;
  customerId: string | null;
  isRegistered: boolean;
  message: string;
  history: LLMMessage[];
}

export interface RouterAgentResult {
  response: string;
  escalated: boolean;
  toolCalls: number;
}

export interface RouterAgentPort {
  process(input: RouterAgentInput): Promise<RouterAgentResult>;
}
