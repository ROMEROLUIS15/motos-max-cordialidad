import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MotoWorkshop',
  description: 'Sistema de gestión para talleres de motocicletas',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
