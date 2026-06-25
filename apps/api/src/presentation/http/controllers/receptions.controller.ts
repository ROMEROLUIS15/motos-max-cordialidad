import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
import { CreateVehicleReceptionUseCase } from '../../../application/use-cases/workshop/create-vehicle-reception.use-case';
import { AddReceptionPhotoUseCase } from '../../../application/use-cases/workshop/add-reception-photo.use-case';
import {
  GetReceptionUseCase,
  DeleteReceptionPhotoUseCase,
} from '../../../application/use-cases/workshop/get-reception.use-case';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

interface CreateReceptionBody {
  branchId: string;
  vehicleId: string;
  odometerReading: number;
  fuelLevel: string;
  observations?: string;
  visibleDamageNotes?: string;
}

@Controller('receptions')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReceptionsController {
  constructor(
    private readonly createReception: CreateVehicleReceptionUseCase,
    private readonly addPhoto: AddReceptionPhotoUseCase,
    private readonly getReception: GetReceptionUseCase,
    private readonly deletePhoto: DeleteReceptionPhotoUseCase,
  ) {}

  @Post()
  @RequirePermission('work_orders:CREATE')
  async create(@CurrentUser() user: JWTPayload, @Body() body: CreateReceptionBody) {
    return this.createReception.execute({
      tenantId: user.tenantId,
      branchId: body.branchId ?? user.branchId,
      vehicleId: body.vehicleId,
      receivedBy: user.sub,
      odometerReading: body.odometerReading,
      fuelLevel: body.fuelLevel,
      observations: body.observations,
      visibleDamageNotes: body.visibleDamageNotes,
    });
  }

  @Get(':id')
  @RequirePermission('work_orders:READ')
  async getOne(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.getReception.execute(id, user.tenantId);
  }

  @Post(':id/photos')
  @RequirePermission('work_orders:UPDATE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @UploadedFile() file: UploadedImage,
  ) {
    if (!file) throw new UnprocessableEntityException('Archivo de imagen requerido (campo "file")');
    return this.addPhoto.execute({
      tenantId: user.tenantId,
      receptionId: id,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(204)
  @RequirePermission('work_orders:UPDATE')
  async removePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
    @CurrentUser() user: JWTPayload,
  ) {
    await this.deletePhoto.execute(id, photoId, user.tenantId);
  }
}
