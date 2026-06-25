import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { RefreshTokenRepository, RefreshTokenRecord } from '../../../../domain/repositories/refresh-token.repository';

@Injectable()
export class RefreshTokenPrismaRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const r = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    return r ? { id: r.id, userId: r.userId, tokenHash: r.tokenHash, expiresAt: r.expiresAt, revokedAt: r.revokedAt, createdAt: r.createdAt } : null;
  }

  async create(record: Omit<RefreshTokenRecord, 'id' | 'createdAt'>): Promise<RefreshTokenRecord> {
    const r = await this.prisma.refreshToken.create({
      data: { id: randomUUID(), ...record },
    });
    return { id: r.id, userId: r.userId, tokenHash: r.tokenHash, expiresAt: r.expiresAt, revokedAt: r.revokedAt, createdAt: r.createdAt };
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
