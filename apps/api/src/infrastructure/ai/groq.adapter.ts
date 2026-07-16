import { Injectable } from '@nestjs/common';
import { OpenAICompatibleAdapter } from './openai-compatible.adapter';

@Injectable()
export class GroqAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env['GROQ_API_KEY'] ?? '',
      // Overridable so a Groq model deprecation is a config change, not a deploy.
      model: process.env['GROQ_MODEL'] || 'openai/gpt-oss-120b',
      timeoutMs: 10_000,
    });
  }
}
