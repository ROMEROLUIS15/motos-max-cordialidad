import { Injectable, Logger } from '@nestjs/common';
import {
  LLMProviderPort,
  LLMRequest,
  LLMResult,
  AllLLMProvidersFailedException,
} from '../../application/ports/llm-provider.port';
import { DeepSeekAdapter } from './deepseek.adapter';
import { GroqAdapter } from './groq.adapter';
import { captureException } from '../observability/sentry';

/**
 * Tries DeepSeek first, then Groq, then throws AllLLMProvidersFailedException.
 * Each provider failure is logged (and would be reported to Sentry in Epic 8).
 */
@Injectable()
export class LLMProviderFactory {
  private readonly logger = new Logger(LLMProviderFactory.name);
  private readonly chain: LLMProviderPort[];

  constructor(deepseek: DeepSeekAdapter, groq: GroqAdapter) {
    this.chain = [deepseek, groq];
  }

  async complete(request: LLMRequest): Promise<LLMResult> {
    for (const provider of this.chain) {
      try {
        return await provider.complete(request);
      } catch (error) {
        this.logger.warn(`LLM provider '${provider.name}' failed: ${(error as Error).message}`);
        captureException(error, { provider: provider.name });
      }
    }
    throw new AllLLMProvidersFailedException();
  }
}
