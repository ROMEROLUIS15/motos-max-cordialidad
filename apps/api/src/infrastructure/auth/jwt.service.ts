import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtPort, JWTPayload } from '../../application/ports/jwt.port';

@Injectable()
export class JwtService implements JwtPort {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    if (!process.env['JWT_SECRET']) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error('JWT_SECRET is required in production');
      }
      new Logger(JwtService.name).warn('JWT_SECRET not set, using dev fallback');
    }
    this.secret = process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production';
    this.expiresIn = process.env['JWT_EXPIRES_IN'] ?? '15m';
  }

  sign(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
  }

  verify(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.secret) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      throw new UnauthorizedException('Token verification failed');
    }
  }
}
