// Genera los iconos PNG de la PWA desde public/brand/logo.{svg,png}
// o, si no existe, desde los placeholders public/icons/{icon,maskable}.svg.
// Uso: pnpm --filter @motoworkshop/web icons
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const brand = join(pub, 'brand');
const icons = join(pub, 'icons');

function source(kind /* 'icon' | 'maskable' */) {
  for (const f of ['logo.svg', 'logo.png', 'logo-motos-max.jpeg']) {
    const p = join(brand, f);
    if (existsSync(p)) return readFileSync(p);
  }
  return readFileSync(join(icons, `${kind}.svg`));
}

// Fondo propio del logo (#423e3e) — al usarlo como lienzo, el icono queda
// seamless (sin caja/costura visible) y full-bleed para el maskable.
const LOGO_BG = { r: 66, g: 62, b: 62, alpha: 1 };

async function render(input, size, { pad = 0, bg } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const img = sharp(input, { density: 384 }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const base = sharp({
    create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  const off = Math.round((size - inner) / 2);
  return base.composite([{ input: await img.png().toBuffer(), top: off, left: off }]).png().toBuffer();
}

async function main() {
  const out = async (name, buf) => {
    await sharp(buf).toFile(join(icons, name));
    console.log('✓', name);
  };
  await out('icon-192.png', await render(source('icon'), 192, { pad: 0.06, bg: LOGO_BG }));
  await out('icon-512.png', await render(source('icon'), 512, { pad: 0.06, bg: LOGO_BG }));
  await out('maskable-512.png', await render(source('maskable'), 512, { pad: 0.16, bg: LOGO_BG }));
  await out('apple-touch-icon.png', await render(source('icon'), 180, { pad: 0.06, bg: LOGO_BG }));
  console.log('PWA icons generados en public/icons/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
