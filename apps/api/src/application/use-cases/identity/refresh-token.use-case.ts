import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';
import { RefreshTokenRepository, REFRESH_TOKEN_REPOSITORY } from '../../../domain/repositories/refresh-token.repository';
import { JwtService } from '../../../infrastructure/auth/jwt.service';

export interface RefreshTokenInput { refreshToken: string }
export interface RefreshTokenOutput { accessToken: string; refreshToken: string }

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    const tokenHash = createHash('sha256').update(input.refreshToken).digest('hex');
    const record = await this.refreshTokenRepo.findByHash(tokenHash);

    if (!record) throw new UnauthorizedException('Invalid refresh token');
    if (record.revokedAt) throw new UnauthorizedException('Refresh token has been revoked');
    if (record.expiresAt < new Date()) throw new UnauthorizedException('Refresh token has expired');

    await this.refreshTokenRepo.revoke(record.id);

    const user = await this.userRepo.findById(record.userId, '');
    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    const newAccessToken = this.jwtService.sign({
      sub: user.id, tenantId: user.tenantId, branchId: user.branchId, roleId: user.roleId,
    });

    const rawNewRefreshToken = randomBytes(40).toString('hex');
    const newTokenHash = createHash('sha256').update(rawNewRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.create({ userId: user.id, tokenHash: newTokenHash, expiresAt, revokedAt: null });

    return { accessToken: newAccessToken, refreshToken: rawNewRefreshToken };
  }
}
