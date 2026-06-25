'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
          <h2>Algo salió mal</h2>
          <p>Hemos registrado el error. Por favor, recarga la página.</p>
        </div>
      </body>
    </html>
  );
}
