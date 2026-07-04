import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { PaginatedResponse } from '@/types/api';
import { useDebounce } from '@/hooks/use-debounce';

export interface Customer {
  id: string;
  fullName: string;
  documentNumber: string;
  phone: string;
}

export interface CustomerFormValues {
  fullName: string;
  documentNumber: string;
  phone: string;
  city: string;
}

export interface UseCustomerSearchResult {
  search: string;
  setSearch: (value: string) => void;
  customers: Customer[];
  customer: Customer | null;
  newCustomer: boolean;
  setNewCustomer: (value: boolean) => void;
  cForm: CustomerFormValues;
  setCForm: React.Dispatch<React.SetStateAction<CustomerFormValues>>;
  selectCustomer: (c: Customer) => void;
  clearCustomer: () => void;
  customerReady: boolean;
}

export function useCustomerSearch(): UseCustomerSearchResult {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState(false);
  const [cForm, setCForm] = useState<CustomerFormValues>({
    fullName: '',
    documentNumber: '',
    phone: '',
    city: '',
  });

  useEffect(() => {
    if (!debounced || customer) {
      setCustomers([]);
      return;
    }
    apiGet<PaginatedResponse<Customer>>(
      `/api/customers?search=${encodeURIComponent(debounced)}&pageSize=8`,
    )
      .then((d) => setCustomers(d.items))
      .catch(() => setCustomers([]));
  }, [debounced, customer]);

  const selectCustomer = (c: Customer) => {
    setCustomer(c);
    setNewCustomer(false);
    setCustomers([]);
    setSearch(c.fullName);
  };

  const clearCustomer = () => {
    setCustomer(null);
    setSearch('');
    setNewCustomer(false);
  };

  const customerReady =
    !!customer ||
    (newCustomer && !!cForm.fullName && !!cForm.documentNumber && !!cForm.phone && !!cForm.city);

  return {
    search,
    setSearch,
    customers,
    customer,
    newCustomer,
    setNewCustomer,
    cForm,
    setCForm,
    selectCustomer,
    clearCustomer,
    customerReady,
  };
}
