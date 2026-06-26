'use client';

import { useState } from 'react';
import { LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logout } from '@/lib/api';

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void logout();
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <LogOut />}
    </Button>
  );
}
