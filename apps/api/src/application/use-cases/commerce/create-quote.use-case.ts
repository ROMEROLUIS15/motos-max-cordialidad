import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Quote } from '../../../domain/entities/quote.entity';
import { QuoteStatus } from '../../../domain/value-objects/quote-status.vo';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';
import { QuoteRepository, QUOTE_REPOSITORY } from '../../../domain/repositories/quote.repository';
import { PdfGeneratorPort, PDF_GENERATOR_PORT } from '../../ports/pdf-generator.port';
import { StoragePort, STORAGE_PORT } from '../../ports/storage.port';
import { QuoteAssembler } from './quote-assembler.service';

export interface CreateQuoteInput {
  tenantId: string;
  workOrderId: string;
  validDays?: number;
}

const QUOTABLE_STATUSES = [WorkOrderStatus.PENDING, WorkOrderStatus.IN_PROGRESS];

@Injectable()
export class CreateQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY) private readonly quoteRepo: QuoteRepository,
    @Inject(PDF_GENERATOR_PORT) private readonly pdfGenerator: PdfGeneratorPort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly assembler: QuoteAssembler,
  ) {}

  async execute(input: CreateQuoteInput): Promise<Quote> {
    const validUntil = new Date(Date.now() + (input.validDays ?? 15) * 86400000);
    const assembled = await this.assembler.assemble(input.workOrderId, input.tenantId, validUntil);

    if (!QUOTABLE_STATUSES.includes(assembled.details.workOrder.status)) {
      throw new UnprocessableEntityException(
        'Solo se pueden generar cotizaciones para órdenes en estado PENDING o IN_PROGRESS',
      );
    }

    const year = new Date().getFullYear();
    const quoteNumber = await this.quoteRepo.generateQuoteNumber(input.tenantId, year);
    const quoteId = randomUUID();

    const pdf = await this.pdfGenerator.generateQuotePdf({ ...assembled.pdfData, quoteNumber });
    const r2Key = `${input.tenantId}/quotes/${quoteId}/${quoteNumber}-v1.pdf`;
    await this.storage.upload(r2Key, pdf, 'application/pdf');

    const now = new Date();
    const quote = new Quote(
      quoteId,
      input.tenantId,
      input.workOrderId,
      quoteNumber,
      QuoteStatus.DRAFT,
      assembled.subtotal,
      assembled.vatPercentage,
      assembled.vatAmount,
      assembled.total,
      validUntil,
      r2Key,
      assembled.pdfData.termsConditions,
      1,
      now,
      now,
    );
    await this.quoteRepo.create(quote);
    return quote;
  }
}
