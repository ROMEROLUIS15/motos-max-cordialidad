export interface JWTPayload {
  sub: string;
  tenantId: string;
  branchId: string | null;
  roleId: string;
  iat?: number;
  exp?: number;
}

export interface JwtPort {
  sign(payload: Omit<JWTPayload, 'iat' | 'exp'>): string;
  verify(token: string): JWTPayload;
}

export const JWT_PORT = Symbol('JwtPort');
