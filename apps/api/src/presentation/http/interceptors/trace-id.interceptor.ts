import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { traceStorage } from '../../../infrastructure/observability/trace-context';

@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request & { traceId: string; user?: JWTPayload }>();
    const response = context.switchToHttp().getResponse<Response>();

    const traceId = randomUUID();
    request.traceId = traceId;
    response.setHeader('X-Trace-Id', traceId);

    return new Observable((subscriber) => {
      traceStorage.run(
        { traceId, tenantId: request.user?.tenantId, userId: request.user?.sub },
        () => {
          next.handle().subscribe(subscriber);
        },
      );
    });
  }
}
