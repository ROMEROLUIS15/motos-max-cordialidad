import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get('Cookie') || '';
    const ac = new AbortController();
    const apiTimer = setTimeout(() => ac.abort(), 5000);

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/logo`, {
      headers: { Cookie: cookie },
      signal: ac.signal,
    });
    clearTimeout(apiTimer);

    if (!res.ok) throw new Error('API error');

    const { url } = (await res.json()) as { url: string | null };
    if (!url) throw new Error('No logo configured');

    const imgAc = new AbortController();
    const imgTimer = setTimeout(() => imgAc.abort(), 8000);

    const imageRes = await fetch(url, { signal: imgAc.signal });
    clearTimeout(imgTimer);

    if (!imageRes.ok) throw new Error('Image fetch failed');

    const buffer = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get('Content-Type') || 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    const url = new URL('/brand/logo-motos-max.jpeg', request.url);
    return NextResponse.redirect(url);
  }
}
