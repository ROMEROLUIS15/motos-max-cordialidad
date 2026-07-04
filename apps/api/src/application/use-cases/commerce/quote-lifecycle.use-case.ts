import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Quote } from '../../../domain/entities/quote.entity';
import { QuoteStatus } from '../../../domain/value-objects/quote-status.vo';
import { WorkOrderStatus } from '../../../domain/value-objects/work-order-status.vo';
import { QuoteRepository, QUOTE_REPOSITORY } from '../../../domain/repositories/quote.repository';
import {
  WorkOrderRepository,
  WORK_ORDER_REPOSITORY,
} from '../../../domain/repositories/work-order.repository';
import { StoragePort, STORAGE_PORT } from '../../ports/storage.port';
import { MessagingPort, MESSAGING_PORT } from '../../ports/messaging.port';
import { TransitionWorkOrderStatusUseCase } from '../workshop/transition-work-order-status.use-case';

const SIGNED_URL_TTL = 86400; // 24h

@Injectable()
export class SendQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY) private readonly quoteRepo: QuoteRepository,
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(MESSAGING_PORT) private readonly messaging: MessagingPort,
  ) {}

  async execute(quoteId: string, tenantId: string): Promise<Quote> {
    const quote = await this.quoteRepo.findById(quoteId, tenantId);
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    quote.markAsSent();
    await this.quoteRepo.save(quote);

    const workOrder = await this.workOrderRepo.findById(quote.workOrderId, tenantId);
    if (workOrder && quote.pdfR2Key) {
      const url = await this.storage.getSignedUrl(quote.pdfR2Key, SIGNED_URL_TTL);
      await this.messaging.sendManualMessage(
        workOrder.customerId,
        `Tu cotización ${quote.quoteNumber} está lista: ${url}`,
        tenantId,
      );
    }
    return quote;
  }
}

@Injectable()
export class ApproveQuoteUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY) private readonly quoteRepo: QuoteRepository,
    @Inject(WORK_ORDER_REPOSITORY) private readonly workOrderRepo: WorkOrderRepository,
    private readonly transitionWorkOrder: TransitionWorkOrderStatusUseCase,
  ) {}

  async execute(quoteId: string, tenantId: string, userId: string): Promise<Quote> {
    const quote = await this.quoteRepo.findById(quoteId, tenantId);
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    quote.approve();
    await this.quoteRepo.save(quote);

    // Move the work order to IN_PROGRESS automatically (only if still PENDING).
    const workOrder = await this.workOrderRepo.findById(quote.workOrderId, tenantId);
    if (workOrder && workOrder.status === WorkOrderStatus.PENDING) {
      await this.transitionWorkOrder.execute({
        workOrderId: workOrder.id,
        tenantId,
        changedBy: userId,
        newStatus: WorkOrderStatus.IN_PROGRESS,
        note: `Cotización ${quote.quoteNumber} aprobada`,
      });
    }
    return quote;
  }
}

@Injectable()
export class RejectQuoteUseCase {
  constructor(@Inject(QUOTE_REPOSITORY) private readonly quoteRepo: QuoteRepository) {}

  async execute(quoteId: string, tenantId: string): Promise<Quote> {
    const quote = await this.quoteRepo.findById(quoteId, tenantId);
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    quote.reject();
    await this.quoteRepo.save(quote);
    return quote;
  }
}

@Injectable()
export class GetQuotePdfUrlUseCase {
  constructor(
    @Inject(QUOTE_REPOSITORY) private readonly quoteRepo: QuoteRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  async execute(quoteId: string, tenantId: string): Promise<{ url: string }> {
    const quote = await this.quoteRepo.findById(quoteId, tenantId);
    if (!quote || !quote.pdfR2Key) throw new NotFoundException('PDF de cotización no encontrado');
    return { url: await this.storage.getSignedUrl(quote.pdfR2Key, SIGNED_URL_TTL) };
  }
}

@Injectable()
export class ListQuotesUseCase {
  constructor(@Inject(QUOTE_REPOSITORY) private readonly quoteRepo: QuoteRepository) {}

  async execute(workOrderId: string, tenantId: string): Promise<Quote[]> {
    return this.quoteRepo.findByWorkOrder(workOrderId, tenantId);
  }
}

@Injectable()
export class ExpireQuotesUseCase {
  constructor(@Inject(QUOTE_REPOSITORY) private readonly quoteRepo: QuoteRepository) {}

  async execute(now = new Date()): Promise<number> {
    const expired = await this.quoteRepo.findExpired(now);
    if (expired.length === 0) return 0;
    await this.quoteRepo.expireMany(
      expired.map((q) => q.id),
      now,
    );
    return expired.length;
  }
}

// Re-exported for clarity; QuoteStatus is used in the controller layer.
export { QuoteStatus };
