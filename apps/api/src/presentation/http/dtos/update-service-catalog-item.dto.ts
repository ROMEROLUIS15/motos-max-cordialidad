export interface UpdateServiceCatalogItemDto {
  name?: string;
  description?: string | null;
  estimatedHours?: number;
  suggestedPrice?: number;
  serviceType?: string;
}
