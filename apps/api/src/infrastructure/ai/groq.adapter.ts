import { Injectable } from '@nestjs/common';
import { OpenAICompatibleAdapter } from './openai-compatible.adapter';

@Injectable()
export class GroqAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env['GROQ_API_KEY'] ?? '',
      model: 'openai/gpt-oss-120b',
      timeoutMs: 10_000,
    });
  }
}
