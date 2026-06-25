import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { RefreshTokenRepository, REFRESH_TOKEN_REPOSITORY } from '../../../domain/repositories/refresh-token.repository';

export interface RevokeTokenInput { refreshToken: string }

@Injectable()
export class RevokeTokenUseCase {
  constructor(@Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: RefreshTokenRepository) {}

  async execute(input: RevokeTokenInput): Promise<void> {
    const tokenHash = createHash('sha256').update(input.refreshToken).digest('hex');
    const record = await this.refreshTokenRepo.findByHash(tokenHash);
    if (!record) throw new UnauthorizedException('Invalid refresh token');
    await this.refreshTokenRepo.revoke(record.id);
  }
}
