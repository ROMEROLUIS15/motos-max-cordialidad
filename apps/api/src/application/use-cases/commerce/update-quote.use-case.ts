import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Quote } from '../../../domain/entities/quote.entity';
import { QuoteStatus } from '../../../domain/value-objects/quote-status.vo';
import { QuoteRepository, QUOTE_REPOSITORY } from '../../../domain/repositories/quote.repository';
import { PdfGeneratorPort, PDF_GENERATOR_PORT } from '../../ports/pdf-generator.port';
import { StoragePort, STORAGE_PORT } from '../../ports/storage.port';
import { QuoteAssembler } from './quote-assembler.service';

export interface UpdateQuoteInput {
  tenantId: string;
  quoteId: string;
}

@Injectable()
export class UpdateQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY) private readonly quoteRepo: QuoteRepository,
    @Inject(PDF_GENERATOR_PORT) private readonly pdfGenerator: PdfGeneratorPort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    private readonly assembler: QuoteAssembler,
  ) {}

  async execute(input: UpdateQuoteInput): Promise<Quote> {
    const quote = await this.quoteRepo.findById(input.quoteId, input.tenantId);
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    if (quote.status !== QuoteStatus.DRAFT && quote.status !== QuoteStatus.SENT) {
      throw new UnprocessableEntityException('Solo se pueden actualizar cotizaciones en DRAFT o SENT');
    }

    // Snapshot the current version before changing it.
    if (quote.pdfR2Key) {
      await this.quoteRepo.saveVersion({
        quoteId: quote.id,
        version: quote.version,
        pdfR2Key: quote.pdfR2Key,
        snapshot: {
          subtotal: quote.subtotal,
          vatPercentage: quote.vatPercentage,
          vatAmount: quote.vatAmount,
          total: quote.total,
          validUntil: quote.validUntil.toISOString(),
        },
      });
    }

    const assembled = await this.assembler.assemble(quote.workOrderId, input.tenantId, quote.validUntil);
    quote.recalculate(assembled.subtotal, assembled.vatPercentage);

    const newVersion = quote.version + 1;
    const pdf = await this.pdfGenerator.generateQuotePdf({ ...assembled.pdfData, quoteNumber: quote.quoteNumber });
    const r2Key = `${input.tenantId}/quotes/${quote.id}/${quote.quoteNumber}-v${newVersion}.pdf`;
    await this.storage.upload(r2Key, pdf, 'application/pdf');

    quote.bumpVersion(r2Key);
    await this.quoteRepo.save(quote);
    return quote;
  }
}
