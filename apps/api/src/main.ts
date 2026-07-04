import { initSentry } from './infrastructure/observability/sentry';
initSentry();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody is needed to verify the WhatsApp webhook HMAC signature.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  if (process.env['NODE_ENV'] !== 'production') {
    app.enableCors();
  } else {
    const allowedOrigins = process.env['ALLOWED_ORIGINS']?.split(',').map((s) => s.trim()) ?? [];
    app.enableCors({ origin: allowedOrigins });
  }
  await app.listen(process.env['PORT'] ?? 3001);
}

bootstrap();
