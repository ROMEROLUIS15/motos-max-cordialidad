import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
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
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';
import { CreateWorkOrderUseCase } from '../../../application/use-cases/workshop/create-work-order.use-case';
import { TransitionWorkOrderStatusUseCase } from '../../../application/use-cases/workshop/transition-work-order-status.use-case';
import {
  GetWorkOrderDetailUseCase,
  ListWorkOrdersUseCase,
} from '../../../application/use-cases/workshop/query-work-orders.use-case';
import {
  UpdateWorkOrderUseCase,
  DeleteWorkOrderUseCase,
} from '../../../application/use-cases/workshop/mutate-work-order.use-case';
import {
  AddServiceLineUseCase,
  UpdateServiceLineUseCase,
  RemoveServiceLineUseCase,
} from '../../../application/use-cases/workshop/work-order-lines.use-case';
import {
  AddPartToWorkOrderUseCase,
  RemovePartFromWorkOrderUseCase,
} from '../../../application/use-cases/workshop/work-order-parts.use-case';
import {
  UploadPhotoEvidenceUseCase,
  DeletePhotoEvidenceUseCase,
  GetPhotoEvidenceUrlsUseCase,
} from '../../../application/use-cases/workshop/photo-evidence.use-case';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Controller('work-orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkOrdersController {
  constructor(
    private readonly createWorkOrder: CreateWorkOrderUseCase,
    private readonly transitionStatus: TransitionWorkOrderStatusUseCase,
    private readonly getDetail: GetWorkOrderDetailUseCase,
    private readonly listWorkOrders: ListWorkOrdersUseCase,
    private readonly updateWorkOrder: UpdateWorkOrderUseCase,
    private readonly deleteWorkOrder: DeleteWorkOrderUseCase,
    private readonly addLine: AddServiceLineUseCase,
    private readonly updateLine: UpdateServiceLineUseCase,
    private readonly removeLine: RemoveServiceLineUseCase,
    private readonly addPart: AddPartToWorkOrderUseCase,
    private readonly removePart: RemovePartFromWorkOrderUseCase,
    private readonly uploadEvidence: UploadPhotoEvidenceUseCase,
    private readonly deleteEvidence: DeletePhotoEvidenceUseCase,
    private readonly getEvidenceUrls: GetPhotoEvidenceUrlsUseCase,
  ) {}

  @Get()
  @RequirePermission('work_orders:READ')
  async list(
    @CurrentUser() user: JWTPayload,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('technicianId') technicianId?: string,
    @Query('mine') mine?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.listWorkOrders.execute({
      tenantId: user.tenantId,
      branchId: branchId ?? user.branchId ?? '',
      status: status ? (status as WorkOrderStatus) : undefined,
      technicianId,
      restrictToTechnicianId: mine === 'true' ? user.sub : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      search: search?.trim() || undefined,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post()
  @RequirePermission('work_orders:CREATE')
  async create(
    @CurrentUser() user: JWTPayload,
    @Body()
    body: {
      receptionId: string;
      technicianId: string;
      serviceType: string;
      problemDescription: string;
      promisedDeliveryAt: string;
      observations?: string;
    },
  ) {
    return this.createWorkOrder.execute({
      tenantId: user.tenantId,
      receptionId: body.receptionId,
      technicianId: body.technicianId,
      serviceType: body.serviceType,
      problemDescription: body.problemDescription,
      promisedDeliveryAt: new Date(body.promisedDeliveryAt),
      observations: body.observations,
    });
  }

  @Get(':id')
  @RequirePermission('work_orders:READ')
  async getOne(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.getDetail.execute(id, user.tenantId);
  }

  @Put(':id')
  @RequirePermission('work_orders:UPDATE')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body()
    body: {
      technicianId?: string;
      serviceType?: string;
      problemDescription?: string;
      observations?: string;
    },
  ) {
    await this.updateWorkOrder.execute({ tenantId: user.tenantId, workOrderId: id, ...body });
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('work_orders:DELETE')
  async remove(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    await this.deleteWorkOrder.execute(id, user.tenantId);
  }

  @Post(':id/status')
  @RequirePermission('work_orders:UPDATE')
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: { newStatus: string; note?: string; finalOdometer?: number },
  ) {
    return this.transitionStatus.execute({
      workOrderId: id,
      tenantId: user.tenantId,
      changedBy: user.sub,
      newStatus: body.newStatus as WorkOrderStatus,
      note: body.note,
      finalOdometer: body.finalOdometer,
    });
  }

  @Post(':id/lines')
  @RequirePermission('work_orders:UPDATE')
  async createLine(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body()
    body: {
      description: string;
      unitPrice: number;
      estimatedHours?: number;
      technicianId?: string;
      serviceCatalogId?: string;
    },
  ) {
    return this.addLine.execute({ tenantId: user.tenantId, workOrderId: id, ...body });
  }

  @Put(':id/lines/:lineId')
  @RequirePermission('work_orders:UPDATE')
  async editLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: JWTPayload,
    @Body()
    body: {
      description?: string;
      unitPrice?: number;
      estimatedHours?: number | null;
      technicianId?: string | null;
    },
  ) {
    return this.updateLine.execute({ tenantId: user.tenantId, workOrderId: id, lineId, ...body });
  }

  @Delete(':id/lines/:lineId')
  @HttpCode(204)
  @RequirePermission('work_orders:UPDATE')
  async deleteLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: JWTPayload,
  ) {
    await this.removeLine.execute(id, lineId, user.tenantId);
  }

  @Post(':id/parts')
  @RequirePermission('work_orders:UPDATE')
  async createPart(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @Body() body: { partId: string; quantity: number },
  ) {
    return this.addPart.execute({
      tenantId: user.tenantId,
      workOrderId: id,
      partId: body.partId,
      quantity: body.quantity,
    });
  }

  @Delete(':id/parts/:partId')
  @HttpCode(204)
  @RequirePermission('work_orders:UPDATE')
  async deletePart(
    @Param('id') id: string,
    @Param('partId') partId: string,
    @CurrentUser() user: JWTPayload,
  ) {
    await this.removePart.execute(id, partId, user.tenantId);
  }

  @Get(':id/evidences')
  @RequirePermission('work_orders:READ')
  async listEvidences(@Param('id') id: string) {
    return this.getEvidenceUrls.execute(id);
  }

  @Post(':id/evidences')
  @RequirePermission('work_orders:UPDATE')
  @UseInterceptors(FileInterceptor('file'))
  async addEvidence(
    @Param('id') id: string,
    @CurrentUser() user: JWTPayload,
    @UploadedFile() file: UploadedImage,
    @Body() body: { phase: string; description?: string },
  ) {
    if (!file) throw new UnprocessableEntityException('Archivo de imagen requerido (campo "file")');
    return this.uploadEvidence.execute({
      tenantId: user.tenantId,
      workOrderId: id,
      buffer: file.buffer,
      mimeType: file.mimetype,
      phase: body.phase,
      description: body.description,
      uploadedBy: user.sub,
    });
  }

  @Delete(':id/evidences/:evidenceId')
  @HttpCode(204)
  @RequirePermission('work_orders:UPDATE')
  async removeEvidence(
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: JWTPayload,
  ) {
    await this.deleteEvidence.execute(id, evidenceId, user.tenantId);
  }
}
