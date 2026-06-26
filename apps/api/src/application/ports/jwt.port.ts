export interface JWTPayload {
  sub: string;
  tenantId: string;
  branchId: string | null;
  roleId: string;
  /**
   * Distinguishes a normal user token from an internal service-to-service
   * token (Fase 2). Absent/`"user"` keeps the Fase 1 behaviour; `"service"`
   * is issued by TokenFactoryService and only carries `sub`/`type`.
   */
  type?: 'user' | 'service';
  iat?: number;
  exp?: number;
}

export interface JwtPort {
  sign(payload: Omit<JWTPayload, 'iat' | 'exp'>): string;
  verify(token: string): JWTPayload;
}

export const JWT_PORT = Symbol('JwtPort');
