import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';

export interface ServiceCatalogItem {
  id: string;
  name: string;
  suggestedPrice: number;
  serviceType: string;
}

export interface SelectedService {
  id: string;
  name: string;
  price: string;
}

export interface UseServiceCatalogPickerResult {
  svcQuery: string;
  setSvcQuery: (value: string) => void;
  svcSuggestions: ServiceCatalogItem[];
  services: SelectedService[];
  addService: (s: ServiceCatalogItem) => void;
  removeService: (index: number) => void;
  updateServicePrice: (index: number, price: string) => void;
}

export function useServiceCatalogPicker(): UseServiceCatalogPickerResult {
  const [svcQuery, setSvcQuery] = useState('');
  const [svcSuggestions, setSvcSuggestions] = useState<ServiceCatalogItem[]>([]);
  const [services, setServices] = useState<SelectedService[]>([]);

  useEffect(() => {
    if (!svcQuery) {
      setSvcSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      apiGet<PaginatedResponse<ServiceCatalogItem>>(
        `/api/service-catalog?search=${encodeURIComponent(svcQuery)}&isActive=true&pageSize=6`,
      )
        .then((d) => setSvcSuggestions(d.items))
        .catch(() => setSvcSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [svcQuery]);

  const addService = (s: ServiceCatalogItem) => {
    setServices((prev) =>
      prev.some((x) => x.id === s.id)
        ? prev
        : [...prev, { id: s.id, name: s.name, price: String(s.suggestedPrice) }],
    );
    setSvcQuery('');
    setSvcSuggestions([]);
  };

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, j) => j !== index));
  };

  const updateServicePrice = (index: number, price: string) => {
    setServices((prev) => prev.map((x, j) => (j === index ? { ...x, price } : x)));
  };

  return {
    svcQuery,
    setSvcQuery,
    svcSuggestions,
    services,
    addService,
    removeService,
    updateServicePrice,
  };
}
