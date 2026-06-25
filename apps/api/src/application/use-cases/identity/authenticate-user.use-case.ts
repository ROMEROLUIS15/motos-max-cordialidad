import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';
import { RefreshTokenRepository, REFRESH_TOKEN_REPOSITORY } from '../../../domain/repositories/refresh-token.repository';
import { PasswordService } from '../../../infrastructure/auth/password.service';
import { JwtService } from '../../../infrastructure/auth/jwt.service';

export interface AuthenticateUserInput {
  email: string;
  password: string;
  tenantId: string;
}

export interface AuthenticateUserOutput {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; roleId: string; tenantId: string };
}

@Injectable()
export class AuthenticateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    const user = await this.userRepo.findByEmail(input.email, input.tenantId);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    const valid = await this.passwordService.verify(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const accessToken = this.jwtService.sign({
      sub: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      roleId: user.roleId,
    });

    const rawRefreshToken = randomBytes(40).toString('hex');
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.create({ userId: user.id, tokenHash, expiresAt, revokedAt: null });

    user.updateLastLogin();
    await this.userRepo.save(user);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: { id: user.id, email: user.email, fullName: user.fullName, roleId: user.roleId, tenantId: user.tenantId },
    };
  }
}
