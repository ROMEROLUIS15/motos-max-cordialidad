import { Logger } from '@nestjs/common';
import {
  LLMProviderPort,
  LLMRequest,
  LLMResult,
  LLMToolDefinition,
} from '../../application/ports/llm-provider.port';

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/**
 * Base adapter for OpenAI-compatible chat completion APIs (DeepSeek, Groq).
 * Supports tool/function calling. A 10s timeout aborts the request so the
 * factory can fall back to the next provider.
 */
export abstract class OpenAICompatibleAdapter implements LLMProviderPort {
  protected readonly logger = new Logger(this.constructor.name);

  protected constructor(private readonly config: OpenAICompatibleConfig) {}

  get name(): string {
    return this.config.name;
  }

  async complete(request: LLMRequest): Promise<LLMResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
          })),
          tools: request.tools.map((t) => this.toToolSchema(t)),
          tool_choice: 'auto',
        }),
      });

      if (!res.ok) {
        throw new Error(`${this.config.name} HTTP ${res.status}`);
      }

      const data = (await res.json()) as ChatCompletionResponse;
      const choice = data.choices?.[0]?.message;
      const toolCall = choice?.tool_calls?.[0];

      if (toolCall) {
        return {
          requiresTool: true,
          toolName: toolCall.function.name,
          toolCallId: toolCall.id,
          toolArgs: this.safeParse(toolCall.function.arguments),
        };
      }
      return { requiresTool: false, response: choice?.content ?? '' };
    } finally {
      clearTimeout(timer);
    }
  }

  private toToolSchema(t: LLMToolDefinition) {
    return {
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    };
  }

  private safeParse(args: string): Record<string, unknown> {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
    };
  }>;
}
