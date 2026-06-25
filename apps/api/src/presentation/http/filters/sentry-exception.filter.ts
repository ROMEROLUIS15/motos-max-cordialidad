import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { captureException } from '../../../infrastructure/observability/sentry';

/**
 * Catch-all filter: reports unexpected (5xx / non-HTTP) errors to Sentry and
 * returns a standard error response. HttpExceptions below 500 pass through
 * untouched. DomainExceptions are handled earlier by DomainExceptionFilter.
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        this.logger.error(exception.message, (exception as Error).stack);
        captureException(exception);
      }
      response.status(status).json(exception.getResponse());
      return;
    }

    this.logger.error((exception as Error)?.message ?? String(exception), (exception as Error)?.stack);
    captureException(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    });
  }
}
