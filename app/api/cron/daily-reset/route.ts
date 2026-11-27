import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { getOperationalSessionKey } from '@/lib/barbershop-config';

export const dynamic = 'force-dynamic';


export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionKey = getOperationalSessionKey(Date.now());
  const db = getAdminDb();
  const sessionRef = db.collection('queueSessions').doc(sessionKey);

  await db.runTransaction(async (tx) => {
    const current = await tx.get(sessionRef);
    const previous = current.data() || {};
    if (previous.resetApplied === true) return;
    tx.set(sessionRef, {
      sessionKey,
      kuotaMaksimal: Number(previous.kuotaMaksimal ?? 15),
      kuotaTerpakai: 0,
      lastNumber: 0,
      resetApplied: true,
      resetAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  const stale = await db.collection('queuePrivate')
    .where('status', '==', 'Waiting')
    .where('operationalDayKey', '<', sessionKey)
    .limit(400).get();

  if (!stale.empty) {
    const batch = db.batch();
    stale.docs.forEach((doc) => {
      batch.update(doc.ref, { status: 'Kedaluwarsa', expiredAt: Timestamp.now(), expirationReason: 'daily-reset' });
      batch.set(db.collection('queuePublic').doc(doc.id), { status: 'Kedaluwarsa' }, { merge: true });
      const item = doc.data();
      if (item.customerUid && item.operationalDayKey) {
        batch.delete(db.collection('activeQueues').doc(item.operationalDayKey + '_' + item.customerUid));
      }
    });
    await batch.commit();
  }

  return Response.json({ ok: true, sessionKey, expiredWaiting: stale.size });
}
