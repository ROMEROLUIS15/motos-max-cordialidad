import Link from 'next/link';
import { NotificationBell } from '@/components/NotificationBell';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/customers', label: 'Clientes' },
  { href: '/work-orders', label: 'Órdenes' },
  { href: '/inventory', label: 'Inventario' },
  { href: '/service-catalog', label: 'Servicios' },
  { href: '/messages', label: 'Mensajes' },
  { href: '/settings', label: 'Ajustes' },
  { href: '/audit', label: 'Auditoría' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-6">
            <span className="font-bold text-gray-900">MotoWorkshop</span>
            <nav className="hidden md:flex gap-4">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-sm text-gray-600 hover:text-gray-900">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <NotificationBell />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
