import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

/**
 * Liveness/readiness probe. Returns 'ok' when core dependencies respond, or
 * 'degraded' (still HTTP 200) when an optional component is unavailable.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const components: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      components['postgres'] = 'ok';
    } catch {
      components['postgres'] = 'down';
    }

    components['redis'] = process.env['REDIS_URL'] ? 'configured' : 'not_configured';
    components['r2'] = process.env['R2_BUCKET_NAME'] ? 'configured' : 'not_configured';
    components['whatsapp'] = process.env['WHATSAPP_ACCESS_TOKEN'] ? 'configured' : 'not_configured';

    const status = components['postgres'] === 'ok' ? 'ok' : 'degraded';
    return { status, components, timestamp: new Date().toISOString() };
  }
}
