import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  CAPSTER_ID, CAPSTER_SESSION_TTL_MS, CapsterAuthError,
  capsterErrorResponse, verifyCapsterIdentity,
} from '@/lib/server/capster-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await verifyCapsterIdentity(request);
    const suppliedSessionId = request.headers.get('x-capster-session-id');
    const body = await request.json().catch(() => ({}));
    const deviceInfo = typeof body.deviceInfo === 'string' ? body.deviceInfo.slice(0, 180) : 'Unknown device';
    const db = getAdminDb();
    const ref = db.collection('capsterSessions').doc(CAPSTER_ID);
    const now = Date.now();
    const candidateId = suppliedSessionId || randomUUID();

    const result = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const current = snapshot.data();
      const lastSeen = current?.lastSeen;
      const lastSeenMs = lastSeen instanceof Timestamp ? lastSeen.toMillis() : Number(lastSeen || 0);
      const active = snapshot.exists && now - lastSeenMs <= CAPSTER_SESSION_TTL_MS;

      if (active && current?.sessionId !== candidateId) {
        throw new CapsterAuthError(409, 'Akun capster sedang aktif di perangkat lain. Keluar dari perangkat tersebut terlebih dahulu.');
      }

      const sessionId = active ? candidateId : candidateId;
      tx.set(ref, {
        sessionId, deviceInfo, loginAt: active ? current?.loginAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        lastSeen: FieldValue.serverTimestamp(),
      });
      return sessionId;
    });

    return Response.json({ ok: true, sessionId: result });
  } catch (error) {
    return capsterErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await verifyCapsterIdentity(request);
    const sessionId = request.headers.get('x-capster-session-id');
    if (!sessionId) throw new CapsterAuthError(401, 'Sesi capster tidak ditemukan.');
    const db = getAdminDb();
    const ref = db.collection('capsterSessions').doc(CAPSTER_ID);
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists && snapshot.data()?.sessionId === sessionId) tx.delete(ref);
    });
    return Response.json({ ok: true });
  } catch (error) {
    return capsterErrorResponse(error);
  }
}
