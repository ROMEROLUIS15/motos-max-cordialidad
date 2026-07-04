import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ForgotPasswordThrottlerGuard } from '../guards/forgot-password-throttler.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import {
  AuthenticateUserUseCase,
  AuthenticateUserInput,
} from '../../../application/use-cases/identity/authenticate-user.use-case';
import { ForgotPasswordUseCase } from '../../../application/use-cases/identity/forgot-password.use-case';
import { RefreshTokenUseCase } from '../../../application/use-cases/identity/refresh-token.use-case';
import { ResetPasswordUseCase } from '../../../application/use-cases/identity/reset-password.use-case';
import { RevokeTokenUseCase } from '../../../application/use-cases/identity/revoke-token.use-case';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { LogoutDto } from '../dtos/logout.dto';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  tenantId: z.string().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
  tenantId: z.string().optional(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly revokeTokenUseCase: RevokeTokenUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly prisma: PrismaService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } })
  async login(@Body() body: unknown, @Req() req: Request) {
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.errors[0]?.message ?? 'Datos inválidos');
    }
    const parsed = result.data as AuthenticateUserInput;
    try {
      return await this.authenticateUserUseCase.execute(parsed);
    } catch (error) {
      await this.prisma.authFailureLog
        .create({
          data: {
            tenantId: parsed.tenantId ?? null,
            email: parsed.email,
            ipAddress: req.ip ?? '0.0.0.0',
            reason: (error as Error).message,
          },
        })
        .catch(() => undefined);
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async refresh(@Body() body: RefreshTokenDto) {
    return this.refreshTokenUseCase.execute(body);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@Body() body: LogoutDto, @CurrentUser() _user: JWTPayload) {
    if (body.refreshToken) {
      await this.revokeTokenUseCase.execute({ refreshToken: body.refreshToken });
    }
  }

  @Post('forgot-password')
  @HttpCode(200)
  @UseGuards(ForgotPasswordThrottlerGuard) // standalone: 3 req / 15 min per IP+email
  async forgotPassword(@Body() body: unknown) {
    const result = forgotPasswordSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.errors[0]?.message ?? 'Datos inválidos');
    }
    return this.forgotPasswordUseCase.execute(result.data.email, result.data.tenantId);
  }

  @Post('reset-password')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard) // IP guard
  @Throttle({ default: { limit: 5, ttl: 900_000 } }) // 5 req / 15 min per IP
  async resetPassword(@Body() body: unknown) {
    const result = resetPasswordSchema.safeParse(body);
    if (!result.success) {
      throw new BadRequestException(result.error.errors[0]?.message ?? 'Datos inválidos');
    }
    return this.resetPasswordUseCase.execute(result.data.token, result.data.password);
  }
}
