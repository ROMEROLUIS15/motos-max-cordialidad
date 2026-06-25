export interface TenantConfig {
  vatPercentage?: number;
  accountingPeriodStart?: number;
  whatsappPhone?: string;
  whatsappToken?: string;
  businessHours?: Record<string, { open: string; close: string }>;
  termsAndConditions?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export class Tenant {
  constructor(
    public readonly id: string,
    public name: string,
    public readonly taxId: string,
    public logoUrl: string | null,
    public address: string | null,
    public phone: string | null,
    public email: string | null,
    public vatPercentage: number,
    public accountingPeriodStart: number,
    public whatsappPhone: string | null,
    public whatsappToken: string | null,
    public businessHours: Record<string, { open: string; close: string }> | null,
    public termsAndConditions: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  updateConfig(data: TenantConfig): void {
    if (data.vatPercentage !== undefined) this.vatPercentage = data.vatPercentage;
    if (data.accountingPeriodStart !== undefined) this.accountingPeriodStart = data.accountingPeriodStart;
    if (data.whatsappPhone !== undefined) this.whatsappPhone = data.whatsappPhone;
    if (data.whatsappToken !== undefined) this.whatsappToken = data.whatsappToken;
    if (data.businessHours !== undefined) this.businessHours = data.businessHours;
    if (data.termsAndConditions !== undefined) this.termsAndConditions = data.termsAndConditions;
    if (data.address !== undefined) this.address = data.address;
    if (data.phone !== undefined) this.phone = data.phone;
    if (data.email !== undefined) this.email = data.email;
    this.updatedAt = new Date();
  }

  updateLogo(url: string): void {
    this.logoUrl = url;
    this.updatedAt = new Date();
  }
}
