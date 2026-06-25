import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JWTPayload } from '../../../application/ports/jwt.port';
import { QuoteRepository, QUOTE_REPOSITORY } from '../../../domain/repositories/quote.repository';
import { CreateQuoteUseCase } from '../../../application/use-cases/commerce/create-quote.use-case';
import { UpdateQuoteUseCase } from '../../../application/use-cases/commerce/update-quote.use-case';
import {
  SendQuoteUseCase,
  ApproveQuoteUseCase,
  RejectQuoteUseCase,
  GetQuotePdfUrlUseCase,
  ListQuotesUseCase,
} from '../../../application/use-cases/commerce/quote-lifecycle.use-case';

@Controller('quotes')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class QuotesController {
  constructor(
    @Inject(QUOTE_REPOSITORY) private readonly quoteRepo: QuoteRepository,
    private readonly createQuote: CreateQuoteUseCase,
    private readonly updateQuote: UpdateQuoteUseCase,
    private readonly sendQuote: SendQuoteUseCase,
    private readonly approveQuote: ApproveQuoteUseCase,
    private readonly rejectQuote: RejectQuoteUseCase,
    private readonly getPdfUrl: GetQuotePdfUrlUseCase,
    private readonly listQuotes: ListQuotesUseCase,
  ) {}

  @Get()
  @RequirePermission('quotes:READ')
  async list(@CurrentUser() user: JWTPayload, @Query('workOrderId') workOrderId?: string) {
    if (!workOrderId) return [];
    return this.listQuotes.execute(workOrderId, user.tenantId);
  }

  @Post()
  @RequirePermission('quotes:CREATE')
  async create(@CurrentUser() user: JWTPayload, @Body() body: { workOrderId: string; validDays?: number }) {
    return this.createQuote.execute({
      tenantId: user.tenantId,
      workOrderId: body.workOrderId,
      validDays: body.validDays,
    });
  }

  @Get(':id')
  @RequirePermission('quotes:READ')
  async getOne(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.quoteRepo.findById(id, user.tenantId);
  }

  @Put(':id')
  @RequirePermission('quotes:UPDATE')
  async update(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.updateQuote.execute({ tenantId: user.tenantId, quoteId: id });
  }

  @Post(':id/send')
  @RequirePermission('quotes:UPDATE')
  async send(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.sendQuote.execute(id, user.tenantId);
  }

  @Post(':id/approve')
  @RequirePermission('quotes:UPDATE')
  async approve(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.approveQuote.execute(id, user.tenantId, user.sub);
  }

  @Post(':id/reject')
  @RequirePermission('quotes:UPDATE')
  async reject(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.rejectQuote.execute(id, user.tenantId);
  }

  @Get(':id/pdf')
  @RequirePermission('quotes:READ')
  async pdf(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    return this.getPdfUrl.execute(id, user.tenantId);
  }

  @Get(':id/versions')
  @RequirePermission('quotes:READ')
  async versions(@Param('id') id: string, @CurrentUser() user: JWTPayload) {
    const quote = await this.quoteRepo.findById(id, user.tenantId);
    if (!quote) return [];
    return this.quoteRepo.findVersions(id);
  }
}
