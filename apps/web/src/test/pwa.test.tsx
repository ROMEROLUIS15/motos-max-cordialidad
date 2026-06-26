import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflinePage from '@/app/offline/page';
import { InstallButton } from '@/components/install-button';
import { StatusBadge } from '@/components/ui/status-badge';

describe('PWA / componentes', () => {
  it('OfflinePage muestra el mensaje "Sin conexión"', () => {
    render(<OfflinePage />);
    expect(screen.getByRole('heading', { name: 'Sin conexión' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });

  it('InstallButton no renderiza nada sin prompt de instalación', () => {
    const { container } = render(<InstallButton />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('StatusBadge', () => {
  it('renderiza la etiqueta en español del estado', () => {
    render(<StatusBadge status="WAITING_PARTS" />);
    expect(screen.getByText('Esperando repuestos')).toBeInTheDocument();
  });
});
