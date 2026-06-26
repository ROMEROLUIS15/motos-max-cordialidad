const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Sesión ──────────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}

/** Guarda la sesión tras el login. `remember` = equipo de confianza (sin timeout de inactividad). */
export function setSession(accessToken: string, refreshToken: string, remember: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('rememberMe', String(remember));
  localStorage.setItem('lastActivity', String(Date.now()));
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  for (const k of ['accessToken', 'refreshToken', 'rememberMe', 'lastActivity']) {
    localStorage.removeItem(k);
  }
}

/** Cierra sesión: revoca el refresh token en el servidor (best-effort), limpia y va al login. */
export async function logout(): Promise<void> {
  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  try {
    if (refreshToken) await apiSend('/api/auth/logout', 'POST', { refreshToken });
  } catch {
    // best-effort: aunque falle la revocación, cerramos sesión localmente
  }
  clearSession();
  if (typeof window !== 'undefined') window.location.href = '/login';
}

function authHeaders(token?: string): Record<string, string> {
  const t = token ?? getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Sesión perdida de forma irrecuperable: limpia y manda al login. */
function handleUnauthorized(): void {
  if (typeof window === 'undefined') return;
  clearSession();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

// ── Renovación silenciosa del access token (single-flight) ───────────────────

let refreshInFlight: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ── Núcleo de peticiones: auth + reintento con refresh en 401 ────────────────

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token?: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), ...authHeaders(token) },
    });

  let res = await send();
  if (res.status === 401 && typeof window !== 'undefined' && localStorage.getItem('refreshToken')) {
    const newToken = await refreshAccessToken();
    if (newToken) res = await send(newToken);
  }
  if (res.status === 401) handleUnauthorized();
  return res;
}

/** Parsea un body de error de la forma { message, code? } cuando está disponible. */
async function toError(res: Response): Promise<Error> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { message?: string | string[]; code?: string };
    if (body?.message)
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
  } catch {
    // ignore parse errors
  }
  return new Error(message);
}

// ── API pública ──────────────────────────────────────────────────────────────

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await request(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path);
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const res = await request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Sube un archivo bajo el campo `file`, con campos extra opcionales. */
export async function apiUpload<T>(
  path: string,
  file: File,
  fields?: Record<string, string>,
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  if (fields) for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const res = await request(path, { method: 'POST', body: form });
  if (!res.ok) throw await toError(res);
  return res.json() as Promise<T>;
}
