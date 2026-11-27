import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { parseWibEpochMs, LATE_TOLERANCE_MINUTES } from '@/lib/barbershop-config';
import { syncBookingExpired } from '@/lib/server/sheets-sync';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const now = Date.now();
  const due = await db.collection('bookingPrivate')
    .where('status', '==', 'Booked')
    .limit(400)
    .get();

  let canceled = 0;
  for (const item of due.docs) {
    const booking = item.data();
    const slotStart = parseWibEpochMs(String(booking.tanggal), String(booking.jamSlot));
    if (now <= slotStart + LATE_TOLERANCE_MINUTES * 60_000) continue;

    const result = await db.runTransaction(async (tx) => {
      const current = await tx.get(item.ref);
      if (!current.exists || current.data()?.status !== 'Booked') return null;
      const currentBooking = current.data()!;
      const slots = Array.isArray(currentBooking.slotTercakup) ? currentBooking.slotTercakup : [currentBooking.jamSlot];
      const locks = slots.map((slot: string) => db.collection('bookingSlots').doc(
        [currentBooking.capsterId, currentBooking.tanggal, slot].join('_')
      ));
      const lockSnaps = await tx.getAll(...locks);
      tx.update(item.ref, {
        status: 'Canceled',
        alasanBatal: 'otomatis',
        catatanBatal: 'Booking otomatis dibatalkan karena melewati toleransi keterlambatan 15 menit.',
        canceledAt: now,
        sheetSyncStatus: 'pending',
      });
      tx.set(db.collection('bookingPublic').doc(item.id), { status: 'Canceled', canceledAt: now }, { merge: true });
      lockSnaps.forEach((lock) => {
        if (lock.exists && lock.data()?.bookingId === item.id) {
          tx.set(lock.ref, { status: 'Released', releasedAt: now }, { merge: true });
        }
      });
      return currentBooking;
    });

    if (result) {
      await syncBookingExpired(item.id, result);
      canceled += 1;
    }
  }

  return Response.json({ ok: true, inspected: due.size, canceled });
}
