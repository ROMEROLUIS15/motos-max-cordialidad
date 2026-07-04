'use client';

import { Search, X, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Step } from './step';
import type { UseCustomerSearchResult } from './use-customer-search';

export function CustomerStep({ form }: { form: UseCustomerSearchResult }) {
  const {
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
  } = form;

  return (
    <Step n={1} title="Cliente">
      {customer ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm">
          <span>
            <span className="font-medium">{customer.fullName}</span>{' '}
            <span className="text-muted-foreground">
              · {customer.documentNumber} · {customer.phone}
            </span>
          </span>
          <button onClick={clearCustomer} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : newCustomer ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              placeholder="Nombre completo"
              value={cForm.fullName}
              onChange={(e) => setCForm((f) => ({ ...f, fullName: e.target.value }))}
            />
            <Input
              placeholder="Documento"
              value={cForm.documentNumber}
              onChange={(e) => setCForm((f) => ({ ...f, documentNumber: e.target.value }))}
            />
            <Input
              placeholder="Teléfono"
              value={cForm.phone}
              onChange={(e) => setCForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <Input
              placeholder="Ciudad"
              value={cForm.city}
              onChange={(e) => setCForm((f) => ({ ...f, city: e.target.value }))}
            />
          </div>
          <button
            onClick={() => setNewCustomer(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Buscar un cliente existente
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, documento o teléfono…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {customers.length > 0 && (
            <ul className="overflow-hidden rounded-lg border border-border">
              {customers.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => selectCustomer(c)}
                    className="w-full border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-secondary/60"
                  >
                    <span className="font-medium">{c.fullName}</span>{' '}
                    <span className="text-muted-foreground">
                      · {c.documentNumber} · {c.phone}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" size="sm" onClick={() => setNewCustomer(true)}>
            <UserPlus className="h-4 w-4" /> Cliente nuevo
          </Button>
        </div>
      )}
    </Step>
  );
}
