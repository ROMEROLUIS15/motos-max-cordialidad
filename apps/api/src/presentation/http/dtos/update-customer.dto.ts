export interface UpdateCustomerDto {
  fullName?: string;
  phone?: string;
  whatsappPhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string;
  observations?: string | null;
}
