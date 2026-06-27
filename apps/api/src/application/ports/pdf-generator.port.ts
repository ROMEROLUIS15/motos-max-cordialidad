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
  tenant: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
    taxId: string;
  };
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

export interface SaleContractPdfData {
  orderNumber: string;
  issuedAt: Date;
  tenant: { name: string; taxId: string; address: string | null; phone: string | null };
  customer: {
    fullName: string;
    documentType: string;
    documentNumber: string;
    phone: string;
    address: string | null;
    city: string;
  };
  motorcycle: {
    brand: string;
    model: string;
    year: number;
    vin: string;
    engineNumber: string | null;
    plate: string | null;
    color: string | null;
    condition: string;
    mileage: number;
  };
  salePrice: number;
  discount: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'FINANCED';
  downPayment: number;
  financingMonths: number | null;
}

export interface PdfGeneratorPort {
  generateQuotePdf(data: QuotePdfData): Promise<Buffer>;
  generateSaleContractPdf(data: SaleContractPdfData): Promise<Buffer>;
}

export const PDF_GENERATOR_PORT = Symbol('PdfGeneratorPort');
