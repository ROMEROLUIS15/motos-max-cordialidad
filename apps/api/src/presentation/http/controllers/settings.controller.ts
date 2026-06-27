import {
  Controller,
  Get,
  Header,
  Inject,
  Post,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { UpdateTenantLogoUseCase } from '../../../application/use-cases/identity/update-tenant-logo.use-case';
import {
  TenantRepository,
  TENANT_REPOSITORY,
} from '../../../domain/repositories/tenant.repository';
import { StoragePort, STORAGE_PORT } from '../../../application/ports/storage.port';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
}

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  private readonly LOGO_EXPIRY = 86_400; // 24h

  constructor(
    private readonly updateLogo: UpdateTenantLogoUseCase,
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: TenantRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Post('logo')
  @RequirePermission('users:UPDATE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(@CurrentUser() user: JWTPayload, @UploadedFile() file: UploadedImage) {
    if (!file) {
      throw new UnprocessableEntityException('Debes seleccionar un archivo de imagen');
    }
    return this.updateLogo.execute({
      tenantId: user.tenantId,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
  }

  @Get('logo')
  @Header('Cache-Control', 'private, max-age=21600') // 6h browser cache
  async getLogo(@CurrentUser() user: JWTPayload): Promise<{ url: string | null }> {
    const tenant = await this.tenantRepo.findById(user.tenantId);
    if (!tenant?.logoUrl) return { url: null };
    const signedUrl = await this.storage.getSignedUrl(tenant.logoUrl, this.LOGO_EXPIRY);
    return { url: signedUrl };
  }
}
