import { isDemoMode } from './supabase';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(typeof body === 'object' && body && 'error' in body ? String((body as { error: string }).error) : `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiPost<T = unknown>(
  path: string,
  body: Record<string, unknown>,
  accessToken?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new ApiError(res.status, json);
  return json as T;
}

export function preferLiveApi(): boolean {
  return !isDemoMode;
}
