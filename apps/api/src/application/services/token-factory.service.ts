import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JWTPayload } from '../ports/jwt.port';

/**
 * Issues short-lived JWTs for service-to-service calls (the Python agents
 * microservice in Fase 2). The token carries only `sub` + `type:"service"` —
 * no real user, role or tenant. The `tenantId` travels explicitly per request.
 * Signed with the same `JWT_SECRET` as user tokens so `JwtService.verify()`
 * validates it without any extra configuration.
 */
@Injectable()
export class TokenFactoryService {
  private readonly secret: string;

  constructor() {
    this.secret = process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production';
  }

  createServiceToken(): string {
    const payload: Pick<JWTPayload, 'sub' | 'type'> = {
      sub: 'agents-service',
      type: 'service',
    };
    return jwt.sign(payload, this.secret, { expiresIn: '5m' } as jwt.SignOptions);
  }
}
