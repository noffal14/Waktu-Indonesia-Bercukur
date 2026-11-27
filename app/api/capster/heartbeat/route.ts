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
    const sessionId = request.headers.get('x-capster-session-id');
    if (!sessionId) throw new CapsterAuthError(401, 'Sesi capster tidak ditemukan.');
    const db = getAdminDb();
    const ref = db.collection('capsterSessions').doc(CAPSTER_ID);

    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const session = snapshot.data();
      const lastSeen = session?.lastSeen;
      const lastSeenMs = lastSeen instanceof Timestamp ? lastSeen.toMillis() : Number(lastSeen || 0);
      if (!snapshot.exists || session?.sessionId !== sessionId || Date.now() - lastSeenMs > CAPSTER_SESSION_TTL_MS) {
        throw new CapsterAuthError(401, 'Sesi berakhir karena akun masuk di perangkat lain');
      }
      tx.update(ref, { lastSeen: FieldValue.serverTimestamp() });
    });
    return Response.json({ ok: true, serverTime: Date.now() });
  } catch (error) {
    return capsterErrorResponse(error);
  }
}
