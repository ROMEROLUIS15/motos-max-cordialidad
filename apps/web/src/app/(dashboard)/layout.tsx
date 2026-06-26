import { DashboardShell } from '@/components/dashboard-shell';
import { SessionGuard } from '@/components/session-guard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard>
      <DashboardShell>{children}</DashboardShell>
    </SessionGuard>
  );
}
