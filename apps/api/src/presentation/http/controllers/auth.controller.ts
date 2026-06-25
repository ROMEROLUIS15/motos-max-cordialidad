import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { AuthenticateUserUseCase, AuthenticateUserInput } from '../../../application/use-cases/identity/authenticate-user.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/identity/refresh-token.use-case';
import { RevokeTokenUseCase } from '../../../application/use-cases/identity/revoke-token.use-case';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly revokeTokenUseCase: RevokeTokenUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async login(@Body() body: AuthenticateUserInput, @Req() req: Request) {
    try {
      return await this.authenticateUserUseCase.execute(body);
    } catch (error) {
      // Log auth failure
      await this.prisma.authFailureLog.create({
        data: {
          tenantId: body.tenantId ?? null,
          email: body.email,
          ipAddress: req.ip ?? '0.0.0.0',
          reason: (error as Error).message,
        },
      }).catch(() => undefined);
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.refreshTokenUseCase.execute(body);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@Body() body: { refreshToken: string }, @CurrentUser() _user: JWTPayload) {
    if (body.refreshToken) {
      await this.revokeTokenUseCase.execute({ refreshToken: body.refreshToken });
    }
  }
}
