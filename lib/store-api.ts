import { firebaseAuth } from '@/lib/firebase-client';

export type StoreApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  message?: string;
  errorCode?: string;
  data?: T;
  conflictBookings?: unknown[];
};

export async function callStoreApi<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<StoreApiResult<T>> {
  const user = firebaseAuth?.currentUser;
  if (!user) {
    return { ok: false, errorCode: 'AUTH_REQUIRED', message: 'Silakan masuk ke akun terlebih dahulu.' };
  }

  try {
    const token = await user.getIdToken();
    const sessionId = typeof window !== 'undefined'
      ? window.sessionStorage.getItem('wib_capster_session_id')
      : null;
    const response = await fetch('/api/store', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(sessionId ? { 'x-capster-session-id': sessionId } : {}),
      },
      body: JSON.stringify({ action, ...payload }),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      return {
        ok: false,
        errorCode: result.errorCode || 'INVALID_STATE',
        message: result.message || 'Aksi gagal disimpan.',
        conflictBookings: Array.isArray(result.conflictBookings) ? result.conflictBookings : undefined,
      };
    }
    return { ok: true, data: result.data as T };
  } catch {
    return { ok: false, errorCode: 'INVALID_STATE', message: 'Koneksi gagal. Periksa jaringan lalu coba lagi.' };
  }
}

export async function callCustomerAuthApi<T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  payload?: Record<string, unknown>
): Promise<StoreApiResult<T>> {
  const user = firebaseAuth?.currentUser;
  if (!user) return { ok: false, errorCode: 'AUTH_REQUIRED', message: 'Sesi login tidak aktif.' };
  try {
    const response = await fetch('/api/auth/customer', {
      method,
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      return { ok: false, errorCode: result.errorCode || 'INVALID_STATE', message: result.message || 'Permintaan gagal.' };
    }
    return { ok: true, data: (result.customer || result.data) as T };
  } catch {
    return { ok: false, errorCode: 'INVALID_STATE', message: 'Koneksi gagal. Periksa jaringan lalu coba lagi.' };
  }
}
