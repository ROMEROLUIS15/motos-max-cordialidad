import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { User } from '../../../domain/entities/user.entity';
import { UserRepository, USER_REPOSITORY } from '../../../domain/repositories/user.repository';
import {
  RefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from '../../../domain/repositories/refresh-token.repository';
import { PasswordService } from '../../../infrastructure/auth/password.service';
import { JwtService } from '../../../infrastructure/auth/jwt.service';

export interface AuthenticateUserInput {
  email: string;
  password: string;
  /**
   * Optional tenant scope. When omitted, the user is resolved by email across
   * tenants — but only if exactly one account matches (see execute()).
   */
  tenantId?: string;
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
    const user = input.tenantId
      ? await this.userRepo.findByEmail(input.email, input.tenantId)
      : await this.resolveWithoutTenant(input.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.passwordService.verify(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    // Checked only after a correct password so a probing attacker can't use
    // the distinct message to confirm which emails are registered.
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

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
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId,
        tenantId: user.tenantId,
      },
    };
  }

  /**
   * Resolve a login that carried no tenantId. Email is unique only per tenant,
   * so we accept the login only when exactly one account matches. Zero or more
   * than one match returns null — never silently pick an arbitrary tenant, and
   * fail with the same generic "Invalid credentials" so ambiguity can't be used
   * to probe which emails are registered.
   */
  private async resolveWithoutTenant(email: string): Promise<User | null> {
    const matches = await this.userRepo.findManyByEmail(email);
    return matches.length === 1 ? matches[0] : null;
  }
}
