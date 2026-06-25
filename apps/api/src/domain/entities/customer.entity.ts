export type DocumentType = 'CC' | 'NIT' | 'CE' | 'PASSPORT';

export class Customer {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public fullName: string,
    public documentType: DocumentType,
    public documentNumber: string,
    public phone: string,
    public whatsappPhone: string | null,
    public email: string | null,
    public address: string | null,
    public city: string,
    public birthDate: Date | null,
    public observations: string | null,
    public isActive: boolean,
    public firstVisitAt: Date | null,
    public lastVisitAt: Date | null,
    public visitCount: number,
    public deletedAt: Date | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    if (!documentNumber || documentNumber.trim().length === 0) {
      throw new Error('documentNumber cannot be empty');
    }
    if (!phone || phone.trim().length === 0) {
      throw new Error('phone cannot be empty');
    }
  }

  deactivate(): void {
    this.deletedAt = new Date();
    this.isActive = false;
    this.updatedAt = new Date();
  }

  incrementVisitCount(): void {
    this.visitCount += 1;
    this.updatedAt = new Date();
  }

  updateLastVisit(): void {
    const now = new Date();
    this.lastVisitAt = now;
    if (!this.firstVisitAt) this.firstVisitAt = now;
    this.updatedAt = now;
  }
}
