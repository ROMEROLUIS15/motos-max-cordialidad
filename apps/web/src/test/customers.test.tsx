import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewCustomerPage from '@/app/(dashboard)/customers/new/page';
import { LogoutButton } from '@/components/logout-button';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

describe('Registro de clientes', () => {
  it('renderiza los campos del formulario', () => {
    render(<NewCustomerPage />);
    expect(screen.getByText('Nombre completo')).toBeInTheDocument();
    expect(screen.getByText('Número de documento')).toBeInTheDocument();
    expect(screen.getByText('Ciudad')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrar cliente/i })).toBeInTheDocument();
  });

  it('valida los campos requeridos al enviar vacío', async () => {
    render(<NewCustomerPage />);
    await userEvent.click(screen.getByRole('button', { name: /Registrar cliente/i }));
    expect(await screen.findByText('El nombre es requerido')).toBeInTheDocument();
    expect(await screen.findByText('El teléfono es requerido')).toBeInTheDocument();
  });
});

describe('LogoutButton', () => {
  it('renderiza el botón de cerrar sesión', () => {
    render(<LogoutButton />);
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
});
