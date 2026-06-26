# Logo de marca → iconos PWA

Coloca aquí tu logo definitivo como **`logo.svg`** (preferido) o **`logo.png`** (mínimo 512×512, fondo transparente o sólido).

Luego genera todos los iconos de la PWA con:

```bash
pnpm --filter @motoworkshop/web icons
```

Eso produce en `apps/web/public/icons/`:

- `icon-192.png`, `icon-512.png` (Android / Chrome)
- `maskable-512.png` (icono adaptable Android)
- `apple-touch-icon.png` (iOS, 180×180)

El manifest (`apps/web/public/manifest.webmanifest`) ya referencia estos archivos.
Mientras no subas un logo, se usan los placeholders `icon.svg` / `maskable.svg` (cuadro cian con la moto), que ya hacen la app instalable en Chrome/Android/escritorio.
