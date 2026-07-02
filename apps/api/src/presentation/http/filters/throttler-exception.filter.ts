import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response, Request } from 'express';
import { retryAfterMessage } from '../utils/retry-after-message';

/**
 * Returns a user-friendly 429 response with a dynamic wait-time estimate.
 * The TTL is extracted from the throttler's Retry-After header if present.
 */
@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  catch(exception: ThrottlerException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // NestJS throttler sets Retry-After (in seconds) on the exception
    const retryAfterHeader = response.getHeader?.('Retry-After');
    const seconds = retryAfterHeader ? Number(retryAfterHeader) : null;
    const minutes = seconds ? Math.ceil(seconds / 60) : null;

    const message = retryAfterMessage(minutes);

    response.status(429).json({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      message,
      path: request.url,
    });
  }
}
