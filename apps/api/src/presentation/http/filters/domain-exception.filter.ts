import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import {
  DomainException,
  VehicleHasActiveOrderException,
  InsufficientStockException,
} from '../../../domain/exceptions/domain.exception';

/**
 * Maps domain exceptions to HTTP responses with a stable `code` field.
 * Conflict-style invariants (active order, insufficient stock) → 409;
 * everything else domain-level → 422 Unprocessable Entity.
 */
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof VehicleHasActiveOrderException ||
      exception instanceof InsufficientStockException
        ? HttpStatus.CONFLICT
        : HttpStatus.UNPROCESSABLE_ENTITY;

    response.status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }
}
