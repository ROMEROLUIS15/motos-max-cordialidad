export class UpdateTenantConfigDto {
  name?: string;
  address?: string;
  phone?: string;
  businessHours?: Record<string, unknown>;
  whatsappPhone?: string;
}
