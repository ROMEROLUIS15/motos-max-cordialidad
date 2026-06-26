import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '../../../infrastructure/auth/jwt.service';
import { ServiceAuthGuard } from './service-auth.guard';
import { TokenFactoryService } from '../../../application/services/token-factory.service';

function ctxWithAuth(header?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: header ? { authorization: header } : {} }),
    }),
  } as unknown as ExecutionContext;
}

describe('ServiceAuthGuard + TokenFactoryService', () => {
  const jwtService = new JwtService();
  const tokenFactory = new TokenFactoryService();
  const guard = new ServiceAuthGuard(jwtService);

  it('mints a service token carrying sub=agents-service and type=service', () => {
    const payload = jwtService.verify(tokenFactory.createServiceToken());
    expect(payload.sub).toBe('agents-service');
    expect(payload.type).toBe('service');
  });

  it('accepts a service token', () => {
    const token = tokenFactory.createServiceToken();
    expect(guard.canActivate(ctxWithAuth(`Bearer ${token}`))).toBe(true);
  });

  it('rejects a normal Fase 1 user token (no type:service)', () => {
    const userToken = jwtService.sign({ sub: 'u1', tenantId: 't1', branchId: null, roleId: 'r1' });
    expect(() => guard.canActivate(ctxWithAuth(`Bearer ${userToken}`))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing Authorization header', () => {
    expect(() => guard.canActivate(ctxWithAuth())).toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', () => {
    expect(() => guard.canActivate(ctxWithAuth('Bearer not-a-real-token'))).toThrow(
      UnauthorizedException,
    );
  });
});
