import { Injectable } from '@nestjs/common';
import { OpenAICompatibleAdapter } from './openai-compatible.adapter';

@Injectable()
export class DeepSeekAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      name: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: process.env['DEEPSEEK_API_KEY'] ?? '',
      model: 'deepseek-chat',
      timeoutMs: 10_000,
    });
  }
}
