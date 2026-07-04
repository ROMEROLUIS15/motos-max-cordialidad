import { Module } from '@nestjs/common';
import { MailModule } from './infrastructure/mail/mail.module';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';

// Infrastructure
import { JwtService } from './infrastructure/auth/jwt.service';
import { PasswordService } from './infrastructure/auth/password.service';
import { FieldEncryptionService } from './infrastructure/crypto/field-encryption.service';
import { TenantPrismaRepository } from './infrastructure/persistence/prisma/repositories/tenant.prisma-repository';
import { BranchPrismaRepository } from './infrastructure/persistence/prisma/repositories/branch.prisma-repository';
import { UserPrismaRepository } from './infrastructure/persistence/prisma/repositories/user.prisma-repository';
import { RolePrismaRepository } from './infrastructure/persistence/prisma/repositories/role.prisma-repository';
import { RefreshTokenPrismaRepository } from './infrastructure/persistence/prisma/repositories/refresh-token.prisma-repository';
import { PasswordResetTokenPrismaRepository } from './infrastructure/persistence/prisma/repositories/password-reset-token.prisma-repository';

// Repository tokens
import { TENANT_REPOSITORY } from './domain/repositories/tenant.repository';
import { BRANCH_REPOSITORY } from './domain/repositories/branch.repository';
import { USER_REPOSITORY } from './domain/repositories/user.repository';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository';
import { REFRESH_TOKEN_REPOSITORY } from './domain/repositories/refresh-token.repository';
import { PASSWORD_RESET_TOKEN_REPOSITORY } from './domain/repositories/password-reset-token.repository';

// Guards
import { JwtAuthGuard } from './presentation/http/guards/jwt-auth.guard';
import { PermissionGuard } from './presentation/http/guards/permission.guard';

// Use cases
import { CreateTenantUseCase } from './application/use-cases/identity/create-tenant.use-case';
import { CreateBranchUseCase } from './application/use-cases/identity/create-branch.use-case';
import { UpdateTenantConfigUseCase } from './application/use-cases/identity/update-tenant-config.use-case';
import { CreateUserUseCase } from './application/use-cases/identity/create-user.use-case';
import { UpdateUserUseCase } from './application/use-cases/identity/update-user.use-case';
import { AssignRoleUseCase } from './application/use-cases/identity/assign-role.use-case';
import { SeedRolesUseCase } from './application/use-cases/identity/seed-roles.use-case';
import {
  CreateCustomRoleUseCase,
  UpdateRolePermissionsUseCase,
} from './application/use-cases/identity/create-custom-role.use-case';
import { DeleteRoleUseCase } from './application/use-cases/identity/delete-role.use-case';
import { AuthenticateUserUseCase } from './application/use-cases/identity/authenticate-user.use-case';
import { ForgotPasswordUseCase } from './application/use-cases/identity/forgot-password.use-case';
import { RefreshTokenUseCase } from './application/use-cases/identity/refresh-token.use-case';
import { ResetPasswordUseCase } from './application/use-cases/identity/reset-password.use-case';
import { RevokeTokenUseCase } from './application/use-cases/identity/revoke-token.use-case';
import { CleanupExpiredTokensJob } from './application/use-cases/identity/cleanup-expired-tokens.job';
import { ForgotPasswordThrottlerGuard } from './presentation/http/guards/forgot-password-throttler.guard';

// Controllers
import { AuthController } from './presentation/http/controllers/auth.controller';
import { TenantsController } from './presentation/http/controllers/tenants.controller';
import { BranchesController } from './presentation/http/controllers/branches.controller';
import { UsersController } from './presentation/http/controllers/users.controller';
import { RolesController } from './presentation/http/controllers/roles.controller';

const repositories = [
  { provide: TENANT_REPOSITORY, useClass: TenantPrismaRepository },
  { provide: BRANCH_REPOSITORY, useClass: BranchPrismaRepository },
  { provide: USER_REPOSITORY, useClass: UserPrismaRepository },
  { provide: ROLE_REPOSITORY, useClass: RolePrismaRepository },
  { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenPrismaRepository },
  { provide: PASSWORD_RESET_TOKEN_REPOSITORY, useClass: PasswordResetTokenPrismaRepository },
];

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [
    AuthController,
    TenantsController,
    BranchesController,
    UsersController,
    RolesController,
  ],
  providers: [
    ...repositories,
    JwtService,
    PasswordService,
    FieldEncryptionService,
    JwtAuthGuard,
    PermissionGuard,
    CreateTenantUseCase,
    CreateBranchUseCase,
    UpdateTenantConfigUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    AssignRoleUseCase,
    SeedRolesUseCase,
    CreateCustomRoleUseCase,
    UpdateRolePermissionsUseCase,
    DeleteRoleUseCase,
    AuthenticateUserUseCase,
    ForgotPasswordUseCase,
    RefreshTokenUseCase,
    ResetPasswordUseCase,
    RevokeTokenUseCase,
    CleanupExpiredTokensJob,
    ForgotPasswordThrottlerGuard,
  ],
  exports: [
    JwtService,
    PasswordService,
    FieldEncryptionService,
    JwtAuthGuard,
    PermissionGuard,
    TENANT_REPOSITORY,
    USER_REPOSITORY,
  ],
})
export class IdentityModule {}
