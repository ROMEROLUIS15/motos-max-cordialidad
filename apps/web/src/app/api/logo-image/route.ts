import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/logo`, {
      headers: { Cookie: cookieStore.toString() },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error('API error');

    const { url } = await res.json();
    if (!url) throw new Error('No logo configured');

    const imageRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
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
    return NextResponse.redirect(new URL('/brand/logo-motos-max.jpeg', request.url));
  }
}
