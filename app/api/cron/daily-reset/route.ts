import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function wibParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function addDate(date: string, amount: number) {
  const base = new Date(date + 'T12:00:00+07:00');
  base.setDate(base.getDate() + amount);
  const p = wibParts(base);
  return `${p.year}-${p.month}-${p.day}`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const p = wibParts(now);
  const today = `${p.year}-${p.month}-${p.day}`;
  const openingHour = p.weekday === 'Sat' || p.weekday === 'Sun' ? 10 : 12;
  const beforeOpening = Number(p.hour) < openingHour;
  const sessionKey = beforeOpening ? addDate(today, -1) : today;
  const sessionRef = adminDb.collection('queueSessions').doc(sessionKey);

  await adminDb.runTransaction(async (tx) => {
    const current = await tx.get(sessionRef);
    if (current.exists && current.data()?.resetApplied === true) return;
    tx.set(sessionRef, {
      sessionKey, quotaMaximum: 15, quotaUsed: 0,
      resetApplied: true, resetAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  const stale = await adminDb.collection('queuePrivate')
    .where('status', '==', 'Waiting')
    .where('operationalDayKey', '<', sessionKey)
    .limit(400).get();

  if (!stale.empty) {
    const batch = adminDb.batch();
    stale.docs.forEach((doc) => batch.update(doc.ref, {
      status: 'Kedaluwarsa', expiredAt: Timestamp.now(), expirationReason: 'daily-reset',
    }));
    await batch.commit();
  }

  return Response.json({ ok: true, sessionKey, expiredWaiting: stale.size });
}
