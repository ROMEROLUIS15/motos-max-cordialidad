import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { Inject } from '@nestjs/common';
import {
  WhatsAppRepository,
  WHATSAPP_REPOSITORY,
} from '../../../domain/repositories/whatsapp.repository';
import {
  SendManualMessageUseCase,
  ListSessionsUseCase,
  GetConversationHistoryUseCase,
} from '../../../application/use-cases/messaging/messaging.use-cases';
import { SendMessageDto } from '../dtos/send-message.dto';

@Controller('messages')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MessagesController {
  constructor(
    @Inject(WHATSAPP_REPOSITORY) private readonly whatsappRepo: WhatsAppRepository,
    private readonly listSessions: ListSessionsUseCase,
    private readonly getHistory: GetConversationHistoryUseCase,
    private readonly sendManual: SendManualMessageUseCase,
  ) {}

  @Get('sessions')
  @RequirePermission('messages:READ')
  async sessions(
    @CurrentUser() user: JWTPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.listSessions.execute(
      user.tenantId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get('sessions/:sessionId')
  @RequirePermission('messages:READ')
  async session(@Param('sessionId') sessionId: string, @CurrentUser() user: JWTPayload) {
    const session = await this.whatsappRepo.findSessionById(sessionId, user.tenantId);
    if (!session) throw new NotFoundException('Sesión no encontrada');
    return session;
  }

  @Get('sessions/:sessionId/messages')
  @RequirePermission('messages:READ')
  async messages(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JWTPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.getHistory.execute(
      sessionId,
      user.tenantId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
    );
  }

  @Post('send')
  @RequirePermission('messages:CREATE')
  async send(@CurrentUser() user: JWTPayload, @Body() body: SendMessageDto) {
    return this.sendManual.execute({
      tenantId: user.tenantId,
      sessionId: body.sessionId,
      content: body.content,
      sentBy: user.sub,
    });
  }
}
