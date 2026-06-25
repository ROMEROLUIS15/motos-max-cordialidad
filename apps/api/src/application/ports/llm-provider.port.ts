export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
}

export interface LLMRequest {
  messages: LLMMessage[];
  tools: LLMToolDefinition[];
}

export interface LLMResult {
  requiresTool: boolean;
  toolName?: string;
  toolCallId?: string;
  toolArgs?: Record<string, unknown>;
  response?: string;
}

export interface LLMProviderPort {
  readonly name: string;
  complete(request: LLMRequest): Promise<LLMResult>;
}

export const LLM_PROVIDER_FACTORY = Symbol('LLMProviderFactory');

export class AllLLMProvidersFailedException extends Error {
  constructor() {
    super('Todos los proveedores LLM fallaron');
    this.name = 'AllLLMProvidersFailedException';
  }
}
