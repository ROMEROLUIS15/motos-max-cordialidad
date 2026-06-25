import { Quote } from '../entities/quote.entity';

export interface QuoteVersionSnapshot {
  quoteId: string;
  version: number;
  pdfR2Key: string;
  snapshot: Record<string, unknown>;
}

export interface QuoteRepository {
  findById(id: string, tenantId: string): Promise<Quote | null>;
  findByWorkOrder(workOrderId: string, tenantId: string): Promise<Quote[]>;
  findExpired(now: Date): Promise<Quote[]>;
  create(quote: Quote): Promise<void>;
  save(quote: Quote): Promise<void>;
  saveVersion(version: QuoteVersionSnapshot): Promise<void>;
  findVersions(quoteId: string): Promise<Array<{ version: number; pdfR2Key: string; createdAt: Date }>>;
  generateQuoteNumber(tenantId: string, year: number): Promise<string>;
}

export const QUOTE_REPOSITORY = Symbol('QuoteRepository');
