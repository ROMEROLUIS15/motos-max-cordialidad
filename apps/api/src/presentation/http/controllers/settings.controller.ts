import {
  Controller,
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

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
}

@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettingsController {
  constructor(private readonly updateLogo: UpdateTenantLogoUseCase) {}

  @Post('logo')
  @RequirePermission('users:UPDATE') // OWNER/ADMIN tier
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(@CurrentUser() user: JWTPayload, @UploadedFile() file: UploadedImage) {
    if (!file) throw new UnprocessableEntityException('Archivo de logo requerido (campo "file")');
    return this.updateLogo.execute({
      tenantId: user.tenantId,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
  }
}
