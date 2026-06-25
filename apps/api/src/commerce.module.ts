import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/persistence/prisma/prisma.module';
import { IdentityModule } from './identity.module';
import { WorkshopModule } from './workshop.module';
import { MessagingModule } from './messaging.module';
import { NotificationsModule } from './notifications.module';
import { StorageModule } from './storage.module';

// Repositories
import { QUOTE_REPOSITORY } from './domain/repositories/quote.repository';
import { PAYMENT_REPOSITORY } from './domain/repositories/payment.repository';
import { QuotePrismaRepository } from './infrastructure/persistence/prisma/repositories/quote.prisma-repository';
import { PaymentPrismaRepository } from './infrastructure/persistence/prisma/repositories/payment.prisma-repository';

// PDF port
import { PDF_GENERATOR_PORT } from './application/ports/pdf-generator.port';
import { ReactPdfAdapter } from './infrastructure/pdf/react-pdf.adapter';

// Use cases
import { QuoteAssembler } from './application/use-cases/commerce/quote-assembler.service';
import { CreateQuoteUseCase } from './application/use-cases/commerce/create-quote.use-case';
import { UpdateQuoteUseCase } from './application/use-cases/commerce/update-quote.use-case';
import {
  SendQuoteUseCase,
  ApproveQuoteUseCase,
  RejectQuoteUseCase,
  GetQuotePdfUrlUseCase,
  ListQuotesUseCase,
  ExpireQuotesUseCase,
} from './application/use-cases/commerce/quote-lifecycle.use-case';
import { ExpireQuotesJob } from './application/use-cases/commerce/expire-quotes.job';
import {
  RegisterPaymentUseCase,
  GetPaymentSummaryUseCase,
  SearchPaymentsUseCase,
} from './application/use-cases/commerce/payments.use-case';

// Controllers
import { QuotesController } from './presentation/http/controllers/quotes.controller';
import { PaymentsController } from './presentation/http/controllers/payments.controller';

@Module({
  imports: [PrismaModule, IdentityModule, WorkshopModule, MessagingModule, NotificationsModule, StorageModule],
  controllers: [QuotesController, PaymentsController],
  providers: [
    { provide: QUOTE_REPOSITORY, useClass: QuotePrismaRepository },
    { provide: PAYMENT_REPOSITORY, useClass: PaymentPrismaRepository },
    { provide: PDF_GENERATOR_PORT, useClass: ReactPdfAdapter },
    QuoteAssembler,
    CreateQuoteUseCase,
    UpdateQuoteUseCase,
    SendQuoteUseCase,
    ApproveQuoteUseCase,
    RejectQuoteUseCase,
    GetQuotePdfUrlUseCase,
    ListQuotesUseCase,
    ExpireQuotesUseCase,
    ExpireQuotesJob,
    RegisterPaymentUseCase,
    GetPaymentSummaryUseCase,
    SearchPaymentsUseCase,
  ],
  exports: [PAYMENT_REPOSITORY, CreateQuoteUseCase, GetQuotePdfUrlUseCase],
})
export class CommerceModule {}
