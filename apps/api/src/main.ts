import { initSentry } from './infrastructure/observability/sentry';
initSentry();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody is needed to verify the WhatsApp webhook HMAC signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  if (process.env['NODE_ENV'] !== 'production') {
    app.enableCors();
  } else {
    const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(',').map((s) => s.trim()) ?? [];
    app.enableCors({ origin: allowedOrigins });
  }
  await app.listen(process.env['PORT'] ?? 3001);
}

bootstrap();
