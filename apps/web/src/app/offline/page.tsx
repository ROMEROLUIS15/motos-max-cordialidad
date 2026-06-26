'use client';

import { WifiOff, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <WifiOff className="h-6 w-6" />
          </span>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold tracking-tight">Sin conexión</h1>
            <p className="text-sm text-muted-foreground">
              No hay internet ahora mismo. Revisa tu conexión e inténtalo de nuevo.
            </p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RotateCw className="h-4 w-4" /> Reintentar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
