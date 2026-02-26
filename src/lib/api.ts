/**
 * API CLIENT
 *
 * Typed wrapper for communicating with the ai-calling backend.
 * Automatically attaches the current Supabase session token.
 */

import { supabase } from '@/integrations/supabase/client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${path}`;
  const headers = await getAuthHeaders();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: json?.error || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return {
      data: json as T,
      error: null,
      status: response.status,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      data: null,
      error: message,
      status: 0,
    };
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: Record<string, unknown>) => request<T>('POST', path, body),
  put: <T>(path: string, body: Record<string, unknown>) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: Record<string, unknown>) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
