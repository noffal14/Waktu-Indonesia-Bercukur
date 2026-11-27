import 'server-only';

import { DecodedIdToken } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const CAPSTER_ID = 'hasan';
export const CAPSTER_SESSION_TTL_MS = 90_000;

export class CapsterAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'CapsterAuthError';
  }
}

export async function verifyCapsterIdentity(request: Request): Promise<DecodedIdToken> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new CapsterAuthError(401, 'Autentikasi diperlukan.');

  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth.verifyIdToken(token, true);
  } catch {
    throw new CapsterAuthError(401, 'Sesi login tidak valid atau sudah berakhir.');
  }
  if (decoded.role !== 'capster') {
    throw new CapsterAuthError(403, 'Akses khusus capster.');
  }
  return decoded;
}

export async function verifyCapsterRequest(request: Request): Promise<DecodedIdToken> {
  const decoded = await verifyCapsterIdentity(request);
  const sessionId = request.headers.get('x-capster-session-id');
  if (!sessionId) throw new CapsterAuthError(401, 'Sesi capster tidak ditemukan.');

  const snapshot = await adminDb.collection('capsterSessions').doc(CAPSTER_ID).get();
  const session = snapshot.data();
  const lastSeen = session?.lastSeen;
  const lastSeenMs = lastSeen instanceof Timestamp ? lastSeen.toMillis() : Number(lastSeen || 0);

  if (!snapshot.exists || session?.sessionId !== sessionId || Date.now() - lastSeenMs > CAPSTER_SESSION_TTL_MS) {
    throw new CapsterAuthError(401, 'Sesi berakhir karena akun masuk di perangkat lain');
  }
  return decoded;
}

export function capsterErrorResponse(error: unknown) {
  if (error instanceof CapsterAuthError) {
    return Response.json({ ok: false, message: error.message }, { status: error.status });
  }
  console.error('[capster-api]', error);
  return Response.json({ ok: false, message: 'Terjadi kesalahan pada server.' }, { status: 500 });
}
