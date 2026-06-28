'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  Wrench,
  MessageSquare,
  Settings,
  ScrollText,
  FileBarChart,
  Truck,
  ShoppingCart,
  Bike,
  Receipt,
  BarChart3,
  List,
  Menu,
  X,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/NotificationBell';
import { InstallButton } from '@/components/install-button';
import { LogoutButton } from '@/components/logout-button';
import { apiGet } from '@/lib/api';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: 'General', items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    label: 'Operación',
    items: [
      { href: '/work-orders', label: 'Órdenes', icon: ClipboardList },
      { href: '/customers', label: 'Clientes', icon: Users },
      { href: '/inventory', label: 'Inventario', icon: Package },
      { href: '/service-catalog', label: 'Servicios', icon: Wrench },
      { href: '/home-services', label: 'Domicilios', icon: Truck },
      { href: '/messages', label: 'Mensajes', icon: MessageSquare },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { href: '/sales', label: 'Motos', icon: Bike },
      { href: '/sales/orders', label: 'Órdenes', icon: Receipt },
      { href: '/sales/dashboard', label: 'Resumen', icon: BarChart3 },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { href: '/reports', label: 'Reportes', icon: FileBarChart },
      { href: '/purchase-orders', label: 'Órdenes de compra', icon: ShoppingCart },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/settings', label: 'Ajustes', icon: Settings },
      { href: '/motorcycle-catalog', label: 'Catálogo motos', icon: List },
      { href: '/audit', label: 'Auditoría', icon: ScrollText },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Brand({ compact }: { compact?: boolean }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    setLoading(true);
    setLogoError(false);
    apiGet<{ url: string | null }>('/api/settings/logo')
      .then(({ url }) => setLogoUrl(url))
      .catch(() => setLogoUrl(null))
      .finally(() => setLoading(false));
  }, [pathname]);

  const showFallback = !logoUrl || logoError;

  return (
    <Link href="/" className="flex items-center gap-2.5">
      {loading ? (
        <span className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-muted sm:h-8 sm:w-8" />
      ) : showFallback ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-sm ring-highlight sm:h-8 sm:w-8">
          <Bike className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </span>
      ) : (
        <img
          src={logoUrl}
          alt="Motos Max Cordialidad"
          className="max-h-7 w-auto max-w-[110px] rounded object-contain sm:max-h-8 sm:max-w-[160px]"
          onError={() => setLogoError(true)}
        />
      )}
      {!compact && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[14px] font-semibold tracking-tight">
            Motos Max Cordialidad
          </span>
          <span className="mt-0.5 text-[11px] text-muted-foreground">Panel del taller</span>
        </span>
      )}
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto py-2">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                )}
                <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-primary')} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarInner({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="px-2 pb-5 pt-1">
        <Brand />
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="px-1 pt-2">
        <InstallButton />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border px-1 pt-3">
        <div className="flex items-center gap-2 px-2">
          <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px] shadow-success/50" />
          <span className="text-xs text-muted-foreground">Operativo</span>
        </div>
        <div className="flex items-center">
          <LogoutButton />
        </div>
      </div>
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const current = ALL_ITEMS.find((i) => isActive(pathname, i.href));

  return (
    <div className="relative z-10 min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card/70 px-3 py-4 backdrop-blur-xl lg:flex">
        <SidebarInner />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[82%] flex-col border-r border-border bg-card px-3 py-4 shadow-2xl animate-in-up">
            <div className="absolute right-3 top-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar menú"
                onClick={() => setMobileOpen(false)}
              >
                <X />
              </Button>
            </div>
            <SidebarInner onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Content column */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/70 px-4 backdrop-blur-xl sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
          >
            <Menu />
          </Button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground lg:flex-none lg:font-medium">
            {current?.label ?? 'Dashboard'}
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              className="hidden items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary md:flex"
            >
              <Search className="h-3.5 w-3.5" />
              Buscar
              <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
