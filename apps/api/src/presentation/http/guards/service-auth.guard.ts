import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { JwtService } from '../../../infrastructure/auth/jwt.service';
import { JWTPayload } from '../../../application/ports/jwt.port';

/**
 * Authenticates internal service-to-service requests (Fase 2 agents).
 * Reuses the existing JWT signature verification and accepts the token only
 * when `type === "service"`. It does NOT touch the database, the Role table
 * or the PermissionGuard — a service token has no user behind it.
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const payload = this.jwtService.verify(authHeader.substring(7));
    if (payload.type !== 'service') {
      throw new UnauthorizedException('Service token required');
    }

    (request as Request & { service: JWTPayload }).service = payload;
    return true;
  }
}
