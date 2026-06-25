export interface QuotePdfLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuotePdfData {
  quoteNumber: string;
  issuedAt: Date;
  validUntil: Date;
  tenant: { name: string; logoUrl: string | null; address: string | null; phone: string | null; taxId: string };
  customer: { fullName: string; documentNumber: string };
  vehicle: { plate: string; brand: string; model: string };
  services: QuotePdfLine[];
  parts: QuotePdfLine[];
  subtotal: number;
  vatPercentage: number;
  vatAmount: number;
  total: number;
  termsConditions: string | null;
}

export interface PdfGeneratorPort {
  generateQuotePdf(data: QuotePdfData): Promise<Buffer>;
}

export const PDF_GENERATOR_PORT = Symbol('PdfGeneratorPort');
