// Genera los iconos PNG de la PWA desde el logo con fondo transparente
// (public/icons/logo-motos-max-background-transparente.png). Si no existe,
// cae a public/brand/logo.{svg,png} y, por último, a los placeholders
// public/icons/{icon,maskable}.svg.
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
  const transparent = join(icons, 'logo-motos-max-background-transparente.png');
  if (existsSync(transparent)) return readFileSync(transparent);
  for (const f of ['logo.svg', 'logo.png', 'logo-motos-max.jpeg']) {
    const p = join(brand, f);
    if (existsSync(p)) return readFileSync(p);
  }
  return readFileSync(join(icons, `${kind}.svg`));
}

// Fondos: el logo es transparente, así que componemos sobre el color del tema
// (#0d1117) para los iconos "any" y sobre el cian de marca para el maskable.
const BG = { r: 13, g: 17, b: 23, alpha: 1 }; // #0d1117 — tema de la app
const CYAN = { r: 23, g: 194, b: 218, alpha: 1 }; // #17c2da — acento de marca

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
  await out('icon-192.png', await render(source('icon'), 192, { pad: 0.12, bg: BG }));
  await out('icon-512.png', await render(source('icon'), 512, { pad: 0.12, bg: BG }));
  await out('maskable-512.png', await render(source('maskable'), 512, { pad: 0.12, bg: CYAN }));
  await out('apple-touch-icon.png', await render(source('icon'), 180, { pad: 0.12, bg: BG }));
  console.log('PWA icons generados en public/icons/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
