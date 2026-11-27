import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { verifyCapsterRequest, CapsterAuthError, capsterErrorResponse } from '@/lib/server/capster-auth';
import { getOperationalSessionKey, getOperationalHoursForDate, generateHourSlots, parseWibEpochMs, getWibParts, formatWibIsoDateTime, LATE_TOLERANCE_MINUTES, RESCHEDULE_MIN_LEAD_MINUTES } from '@/lib/barbershop-config';
import { calculateServicesPricing, getInitialSystemPromos, isPromoActiveNow } from '@/lib/services-catalog';
import { drainSheetSyncQueue } from '@/lib/sheets-outbox';
import { getInitialCapsterProfile, normalizeWaToLocal08, normalizeWaTo628, validateInstagramHandle } from '@/lib/capster-profile';

export const dynamic = 'force-dynamic';

type StoreAction =
  | 'queue.take' | 'queue.cancel' | 'queue.call' | 'queue.complete' | 'queue.capsterCancel'
  | 'booking.create' | 'booking.cancel' | 'booking.reschedule' | 'booking.start' | 'booking.complete' | 'booking.capsterCancel'
  | 'quota.update' | 'schedule.dayOff' | 'schedule.slot'
  | 'promo.create' | 'promo.update' | 'promo.toggle' | 'promo.delete'
  | 'profile.update';

function fail(status: number, message: string, errorCode?: string, extra?: Record<string, unknown>) {
  return Response.json({ ok: false, message, errorCode, ...(extra || {}) }, { status });
}
function maskedName(name: string) {
  const clean = String(name || 'Tamu').trim();
  return clean.length < 3 ? clean.charAt(0) + '***' : clean.slice(0, 2) + '***';
}
function slotLockId(capsterId: string, date: string, slot: string) {
  return [capsterId, date, slot].join('_');
}
function categoriesFor(lines: Array<{ kategoriNama?: string }>) {
  const labels = new Set<string>();
  for (const line of lines) {
    const value = (line.kategoriNama || '').toLowerCase();
    if (value.includes('haircut')) labels.add('Haircut');
    else if (value.includes('bleach')) labels.add('Bleaching');
    else if (value.includes('perm')) labels.add('Perming');
    else if (value.includes('color')) labels.add('Hair Color');
  }
  return Array.from(labels).join(', ');
}
function persistSheetSyncJobInTransaction(
  tx: FirebaseFirestore.Transaction,
  id: string,
  operation: 'appendTransaction' | 'updateTransaction' | 'upsertCustomer',
  values: Record<string, string | number | null | undefined>,
  options: { bookingCode?: string; sourcePath?: string; sourceId?: string } = {}
) {
  const jobRef = getAdminDb().collection('sheetSyncQueue').doc(id);
  tx.set(jobRef, {
    id,
    operation,
    values,
    bookingCode: options.bookingCode || null,
    sourcePath: options.sourcePath || null,
    sourceId: options.sourceId || null,
    status: 'pending',
    attempts: 0,
    runAfter: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

function bookingSheetValues(booking: any, customer: any, status: string, finalTotal?: number) {
  const lines = Array.isArray(booking.layananDipilih) ? booking.layananDipilih : [];
  const normal = Number(booking.subtotalHarga || 0);
  const total = typeof finalTotal === 'number'
    ? Math.max(0, Math.min(normal, Math.round(finalTotal)))
    : Number(booking.totalEstimasiMin ?? normal);
  return {
    'Tanggal': booking.tanggal,
    'Jam': booking.jamSlot,
    'Kode Booking': booking.kodeTiket,
    'Nama Pelanggan': customer.nama || booking.nama || 'Pelanggan',
    'Nomor WhatsApp': customer.nomorWhatsApp || booking.nomorWhatsApp || '',
    'Capster': 'Hasan',
    'Layanan (daftar)': lines.map((line: any) => line.nama + (line.qty > 1 ? ' x' + line.qty : '')).join(', '),
    'Kategori': categoriesFor(lines),
    'Harga Normal': normal,
    'Potongan Promo': Math.max(0, normal - total),
    'Total Harga': total,
    'Status': status,
    'Sumber': 'Booking',
  };
}
function customerSheetValues(customer: any, visitCount?: number, lastVisit?: string) {
  return {
    'Nama': customer.nama,
    'Nomor WhatsApp': customer.nomorWhatsApp,
    'Email': customer.email || '',
    'Tanggal Daftar': formatWibIsoDateTime(Number(customer.dibuatPada || Date.now())),
    'Kunjungan Terakhir': lastVisit || '',
    'Total Kunjungan': visitCount ?? Number(customer.totalKunjungan || 0),
  };
}
async function syncBookingCreated(_id: string, _booking: any, _customer: any) {
  // The transactional outbox is the single writer for direct and scheduled sync.
  await drainSheetSyncQueue(50).catch((error) => {
    console.error('[sheet-outbox-drain]', error);
  });
}
async function syncBookingFinal(_id: string, _booking: any, _customer: any, _status: string, _finalTotal?: number) {
  await drainSheetSyncQueue(50).catch((error) => {
    console.error('[sheet-outbox-drain]', error);
  });
}
async function syncCustomer(_customer: any, _visitCount?: number, _lastVisit?: string, outboxJobId?: string) {
  if (!outboxJobId) return;
  await drainSheetSyncQueue(50).catch((error) => {
    console.error('[sheet-outbox-drain]', error);
  });
}

async function userContext(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new CapsterAuthError(401, 'Autentikasi diperlukan.');
  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token, true);
  } catch {
    throw new CapsterAuthError(401, 'Sesi login tidak valid atau sudah berakhir.');
  }
  const capster = decoded.role === 'capster';
  if (capster) {
    await verifyCapsterRequest(request);
  } else {
    const email = String(decoded.email || '').toLowerCase();
    const phoneFromEmail = email.match(/^(628\d{8,12})@pelanggan\.waktu-indonesia\.app$/)?.[1];
    if (!phoneFromEmail) throw new CapsterAuthError(403, 'Akun ini bukan akun pelanggan.');
    const profile = await getAdminDb().collection('customers').doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.nomorWhatsApp !== phoneFromEmail) {
      throw new CapsterAuthError(403, 'Profil pelanggan tidak valid.');
    }
  }
  return { uid: decoded.uid, capster, decoded };
}
function requiredText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

async function handleQueueTake(uid: string, body: any) {
  const db = getAdminDb();
  const customerRef = db.collection('customers').doc(uid);
  const customerSnap = await customerRef.get();
  if (!customerSnap.exists) return fail(404, 'Data pelanggan tidak ditemukan.', 'NOT_FOUND');
  const customer = customerSnap.data()!;
  const now = Date.now();
  const shop = (await import('@/lib/barbershop-config')).getShopOperationalStatus(now);
  if (!shop.isOpen) return fail(400, shop.closedMessage || 'Barbershop sedang tutup.', 'SHOP_CLOSED');

  const sessionKey = getOperationalSessionKey(now);
  const sessionRef = db.collection('queueSessions').doc(sessionKey);
  const id = randomUUID();
  const activeRef = db.collection('activeQueues').doc(sessionKey + '_' + uid);
  const privateRef = db.collection('queuePrivate').doc(id);
  const publicRef = db.collection('queuePublic').doc(id);

  const result = await db.runTransaction(async (tx) => {
    const [sessionSnap, activeSnap] = await Promise.all([tx.get(sessionRef), tx.get(activeRef)]);
    if (activeSnap.exists) {
      const oldId = String(activeSnap.data()?.queueId || '');
      const oldRef = db.collection('queuePrivate').doc(oldId);
      const oldSnap = oldId ? await tx.get(oldRef) : null;
      const oldData = oldSnap?.data();
      if (oldSnap?.exists && (oldData?.status === 'Waiting' || oldData?.status === 'In-Service')) {
        return { existing: oldData, existingId: oldId, quota: sessionSnap.data() };
      }
    }

    const session = sessionSnap.data() || {};
    const maximum = Number(session.kuotaMaksimal ?? 15);
    const used = Number(session.kuotaTerpakai ?? 0);
    if (used >= maximum) throw new Error('QUOTA_FULL');
    const nextNumber = Number(session.lastNumber || 0) + 1;
    const ticket = {
      id, nomorAntrean: 'A' + String(nextNumber).padStart(3, '0'),
      tanggal: shop.todayStr, kunciHariOperasional: sessionKey, operationalDayKey: sessionKey,
      customerId: uid, customerUid: uid,
      namaPelanggan: customer.nama, nomorWhatsApp: customer.nomorWhatsApp,
      waktuAmbil: now, status: 'Waiting', capsterId: 'hasan',
    };
    tx.set(sessionRef, {
      sessionKey, kuotaMaksimal: maximum, kuotaTerpakai: used + 1,
      lastNumber: nextNumber, resetApplied: true, updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(privateRef, ticket);
    tx.set(publicRef, {
      id, nomorAntrean: ticket.nomorAntrean, tanggal: ticket.tanggal,
      kunciHariOperasional: sessionKey, operationalDayKey: sessionKey, namaPelanggan: maskedName(customer.nama),
      waktuAmbil: now, status: 'Waiting', capsterId: ticket.capsterId,
    });
    tx.set(activeRef, { queueId: id, status: 'Waiting', operationalDayKey: sessionKey });
    return { existing: null, existingId: null, ticket, quota: { ...session, kuotaMaksimal: maximum, kuotaTerpakai: used + 1 } };
  });

  if (result.existing) return Response.json({ ok: true, data: { ticket: { ...result.existing, id: result.existingId }, antreanDiDepan: 0, estimasiMenit: 45 }, reused: true });
  const queueSnap = await db.collection('queuePublic').where('kunciHariOperasional', '==', sessionKey).where('status', '==', 'Waiting').get();
  const before = Math.max(0, queueSnap.size - 1);
  return Response.json({ ok: true, data: { ticket: result.ticket, antreanDiDepan: before, estimasiMenit: before * 45 } });
}

async function handleQueueCancel(uid: string, id: string, capster: boolean) {
  const db = getAdminDb();
  const ref = db.collection('queuePrivate').doc(id);
  const publicRef = db.collection('queuePublic').doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error('NOT_FOUND');
    const q = snap.data()!;
    if (!capster && q.customerUid !== uid) throw new Error('UNAUTHORIZED');
    if (q.status !== 'Waiting') throw new Error('INVALID_STATE');
    const sessionRef = db.collection('queueSessions').doc(q.operationalDayKey || q.kunciHariOperasional);
    const sessionSnap = await tx.get(sessionRef);
    tx.update(ref, { status: 'Canceled', canceledAt: Date.now(), cancelReason: capster ? 'capster' : 'customer' });
    tx.set(publicRef, { status: 'Canceled' }, { merge: true });
    if (sessionSnap.exists) tx.update(sessionRef, { kuotaTerpakai: Math.max(0, Number(sessionSnap.data()?.kuotaTerpakai || 0) - 1) });
    tx.delete(db.collection('activeQueues').doc((q.operationalDayKey || q.kunciHariOperasional) + '_' + q.customerUid));
  });
  return Response.json({ ok: true });
}

async function handleBookingCreate(uid: string, body: any) {
  const db = getAdminDb();
  const customerRef = db.collection('customers').doc(uid);
  const customerSnap = await customerRef.get();
  if (!customerSnap.exists) return fail(404, 'Data pelanggan tidak ditemukan.', 'NOT_FOUND');
  const customer = customerSnap.data()!;
  const date = requiredText(body.tanggal);
  const capsterId = requiredText(body.capsterId) || 'hasan';
  if (capsterId !== 'hasan') return fail(400, 'Capster yang dipilih tidak tersedia.', 'VALIDATION_ERROR');
  const startSlot = requiredText(body.jamSlot);
  const selected = Array.isArray(body.selectedServices) ? body.selectedServices : [];
  if (!date || !startSlot || selected.length === 0) return fail(400, 'Tanggal, slot, dan layanan wajib dipilih.', 'VALIDATION_ERROR');

  const promoSnap = await db.collection('promos').get();
  const promos = promoSnap.empty ? getInitialSystemPromos() : promoSnap.docs.map((doc) => doc.data() as any);
  const activePromos = promos.filter((promo: any) => isPromoActiveNow(promo, Date.now()));
  const pricing = calculateServicesPricing(selected, activePromos);
  if (!pricing.lines.length) return fail(400, 'Layanan yang dipilih tidak valid.', 'VALIDATION_ERROR');

  const hours = getOperationalHoursForDate(date);
  const allSlots = generateHourSlots(hours.buka, hours.tutup);
  const startIndex = allSlots.indexOf(startSlot);
  if (startIndex < 0 || startIndex + pricing.slotsNeeded > allSlots.length) return fail(400, 'Durasi layanan melewati jam operasional.', 'VALIDATION_ERROR');
  const coveredSlots = allSlots.slice(startIndex, startIndex + pricing.slotsNeeded);
  const now = Date.now();
  if (parseWibEpochMs(date, startSlot) <= now) return fail(400, 'Slot booking sudah lewat. Pilih waktu lain.', 'VALIDATION_ERROR');

  const id = randomUUID();
  const privateRef = db.collection('bookingPrivate').doc(id);
  const publicRef = db.collection('bookingPublic').doc(id);
  const scheduleRef = db.collection('schedules').doc(capsterId + '_' + date);
  const counterRef = db.collection('bookingCounters').doc(date);
  const lockRefs = coveredSlots.map((slot) => db.collection('bookingSlots').doc(slotLockId(capsterId, date, slot)));

  const booking = await db.runTransaction(async (tx) => {
    const [profile, scheduleSnap, counterSnap, ...locks] = await Promise.all([
      tx.get(customerRef), tx.get(scheduleRef), tx.get(counterRef), ...lockRefs.map((ref) => tx.get(ref)),
    ]);
    if (!profile.exists) throw new Error('NOT_FOUND');
    const schedule = scheduleSnap.data();
    if (schedule?.isLibur) throw new Error('CAPSTER_OFF');
    for (let i = 0; i < locks.length; i++) {
      const lock = locks[i].data();
      if (lock?.status === 'Booked' || lock?.status === 'In-Service' || lock?.status === 'Manual') throw new Error('SLOT_TAKEN');
      const manual = schedule?.manualSlots?.[coveredSlots[i]];
      if (manual?.tipe) throw new Error('SLOT_TAKEN');
    }
    const seq = Number(counterSnap.data()?.lastNumber || 0) + 1;
    const code = 'BK-' + date.replace(/-/g, '') + '-' + String(seq).padStart(3, '0');
    const data = {
      id, kodeTiket: code, customerId: uid, customerUid: uid,
      nama: customer.nama, nomorWhatsApp: customer.nomorWhatsApp, capsterId,
      tanggal: date, jamSlot: startSlot, status: 'Booked', alasanBatal: null,
      waktuDibuat: now, layananDipilih: pricing.lines,
      durasiTotalMenit: pricing.durasiTotalMenit, slotTercakup: coveredSlots,
      subtotalHarga: pricing.subtotalHarga, potonganMin: pricing.potonganMin,
      potonganMax: pricing.potonganMax, totalEstimasiMin: pricing.totalEstimasiMin,
      totalEstimasiMax: pricing.totalEstimasiMax, promoJudul: pricing.promoJudul,
      sheetSyncStatus: 'pending',
    };
    tx.set(counterRef, { lastNumber: seq, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(privateRef, data);
    tx.set(publicRef, {
      id, kodeTiket: code, capsterId, tanggal: date, jamSlot: startSlot,
      slotTercakup: coveredSlots, status: 'Booked', waktuDibuat: now,
      nama: maskedName(customer.nama),
    });
    lockRefs.forEach((ref) => tx.set(ref, { status: 'Booked', bookingId: id, capsterId, tanggal: date, jam: coveredSlots[lockRefs.indexOf(ref)] }));
    persistSheetSyncJobInTransaction(
      tx,
      `booking-${id}-append`,
      'appendTransaction',
      bookingSheetValues(data, customer, 'Booked (harga final dikonfirmasi capster)'),
      { sourcePath: 'bookingPrivate', sourceId: id }
    );
    return data;
  });

  await syncBookingCreated(id, booking, customer);
  return Response.json({ ok: true, data: { booking } });
}

async function releaseBookingLocks(tx: FirebaseFirestore.Transaction, booking: any) {
  const db = getAdminDb();
  const slots = Array.isArray(booking.slotTercakup) ? booking.slotTercakup : [booking.jamSlot];
  const refs = slots.map((slot: string) => db.collection('bookingSlots').doc(slotLockId(booking.capsterId, booking.tanggal, slot)));
  const snaps = await tx.getAll(...refs);
  snaps.forEach((snap) => {
    if (snap.exists && (snap.data() as FirebaseFirestore.DocumentData | undefined)?.bookingId === booking.id) tx.set(snap.ref, { status: 'Released', releasedAt: Date.now() }, { merge: true });
  });
}

async function handleBookingCustomerCancel(uid: string, id: string, reschedule?: { capsterId: string; tanggal: string; jamSlot: string }) {
  const db = getAdminDb();
  const ref = db.collection('bookingPrivate').doc(id);
  const publicRef = db.collection('bookingPublic').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return fail(404, 'Booking tidak ditemukan.', 'NOT_FOUND');
  const existing = snap.data()!;
  if (existing.customerUid !== uid) return fail(403, 'Booking ini bukan milik Anda.', 'UNAUTHORIZED');

  if (!reschedule) {
    await db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists || current.data()?.status !== 'Booked') throw new Error('INVALID_STATE');
      const booking = current.data()!;
      await releaseBookingLocks(tx, booking);
      const canceledAt = Date.now();
      const canceledBooking = {
        ...booking,
        status: 'Canceled',
        alasanBatal: 'manual',
        catatanBatal: 'Dibatalkan oleh pelanggan',
        canceledAt,
      };
      tx.update(ref, {
        status: 'Canceled', alasanBatal: 'manual',
        catatanBatal: 'Dibatalkan oleh pelanggan', canceledAt,
      });
      tx.set(publicRef, { status: 'Canceled' }, { merge: true });
      persistSheetSyncJobInTransaction(
        tx,
        `booking-${id}-final-${canceledAt}`,
        'updateTransaction',
        bookingSheetValues(canceledBooking, { nama: booking.nama, nomorWhatsApp: booking.nomorWhatsApp }, 'Batal', 0),
        { bookingCode: String(booking.kodeTiket), sourcePath: 'bookingPrivate', sourceId: id }
      );
    });
    await syncBookingFinal(id, existing, { nama: existing.nama, nomorWhatsApp: existing.nomorWhatsApp }, 'Batal');
    return Response.json({ ok: true });
  }

  const date = requiredText(reschedule.tanggal);
  const capsterId = requiredText(reschedule.capsterId);
  if (capsterId !== 'hasan') return fail(400, 'Capster yang dipilih tidak tersedia.', 'VALIDATION_ERROR');
  const startSlot = requiredText(reschedule.jamSlot);
  if (parseWibEpochMs(date, startSlot) - Date.now() < RESCHEDULE_MIN_LEAD_MINUTES * 60_000) return fail(400, 'Perubahan jadwal minimal 60 menit sebelum slot dimulai.', 'RESCHEDULE_TOO_LATE');
  const hours = getOperationalHoursForDate(date);
  const all = generateHourSlots(hours.buka, hours.tutup);
  const pricingSlots = Math.max(1, Math.ceil(Number(existing.durasiTotalMenit || 45) / 60));
  const index = all.indexOf(startSlot);
  if (index < 0 || index + pricingSlots > all.length) return fail(400, 'Slot baru melewati jam operasional.', 'VALIDATION_ERROR');
  const newSlots = all.slice(index, index + pricingSlots);
  const newScheduleRef = db.collection('schedules').doc(capsterId + '_' + date);
  const newLockRefs = newSlots.map((slot: string) => db.collection('bookingSlots').doc(slotLockId(capsterId, date, slot)));

  const updatedBooking = await db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    const [scheduleSnap, ...lockSnaps] = await Promise.all([tx.get(newScheduleRef), ...newLockRefs.map((lock) => tx.get(lock))]);
    if (!current.exists || current.data()?.status !== 'Booked' || current.data()?.customerUid !== uid) throw new Error('INVALID_STATE');
    const targetSchedule = scheduleSnap.data();
    if (targetSchedule?.isLibur) throw new Error('CAPSTER_OFF');
    if (newSlots.some((slot) => Boolean(targetSchedule?.manualSlots?.[slot]?.tipe))) throw new Error('SLOT_TAKEN');
    if (lockSnaps.some((lock) => ['Booked', 'In-Service', 'Manual'].includes(String((lock.data() as FirebaseFirestore.DocumentData | undefined)?.status || '')) && (lock.data() as FirebaseFirestore.DocumentData | undefined)?.bookingId !== id)) throw new Error('SLOT_TAKEN');
    const booking = current.data()!;
    await releaseBookingLocks(tx, booking);
    const rescheduledAt = Date.now();
    const nextBooking = { ...booking, capsterId, tanggal: date, jamSlot: startSlot, slotTercakup: newSlots, waktuDiubah: rescheduledAt };
    tx.set(ref, nextBooking, { merge: true });
    tx.set(publicRef, { capsterId, tanggal: date, jamSlot: startSlot, slotTercakup: newSlots }, { merge: true });
    newLockRefs.forEach((lockRef, i) => tx.set(lockRef, { status: 'Booked', bookingId: id, capsterId, tanggal: date, jam: newSlots[i] }));
    persistSheetSyncJobInTransaction(
      tx,
      `booking-${id}-final-${rescheduledAt}`,
      'updateTransaction',
      bookingSheetValues(nextBooking, { nama: nextBooking.nama, nomorWhatsApp: nextBooking.nomorWhatsApp }, 'Booked (harga final dikonfirmasi capster)'),
      { bookingCode: String(nextBooking.kodeTiket), sourcePath: 'bookingPrivate', sourceId: id }
    );
    return nextBooking;
  });
  await syncBookingFinal(id, updatedBooking, { nama: existing.nama, nomorWhatsApp: existing.nomorWhatsApp }, 'Booked (harga final dikonfirmasi capster)');
  return Response.json({ ok: true });
}

async function handleCapsterAction(action: StoreAction, body: any) {
  const db = getAdminDb();
  const id = requiredText(body.id || body.walkinId || body.bookingId);
  if (action === 'quota.update') {
    const key = requiredText(body.operationalDayKey);
    const max = Math.max(0, Math.min(200, Math.round(Number(body.maxQuota))));
    if (!key || !Number.isFinite(max)) return fail(400, 'Kuota tidak valid.', 'VALIDATION_ERROR');
    const quotaRef = db.collection('queueSessions').doc(key);
    await db.runTransaction(async (tx) => {
      const quota = await tx.get(quotaRef);
      tx.set(quotaRef, {
        sessionKey: key,
        kuotaMaksimal: max,
        kuotaTerpakai: Number(quota.data()?.kuotaTerpakai || 0),
        lastNumber: Number(quota.data()?.lastNumber || 0),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    return Response.json({ ok: true });
  }
  if (action === 'schedule.dayOff' || action === 'schedule.slot') {
    const capsterId = 'hasan';
    const date = requiredText(body.tanggal);
    if (!date || date < getWibParts(Date.now()).dateStr) {
      return fail(400, 'Tanggal yang sudah lewat tidak dapat diubah.', 'VALIDATION_ERROR');
    }

    const scheduleRef = db.collection('schedules').doc(capsterId + '_' + date);
    const bookingsQuery = db.collection('bookingPrivate')
      .where('capsterId', '==', capsterId)
      .where('tanggal', '==', date)
      .where('status', 'in', ['Booked', 'In-Service']);

    const isDayOff = action === 'schedule.dayOff';
    const isLibur = Boolean(body.isLibur);
    const jam = requiredText(body.jam);
    const mode = requiredText(body.mode);
    if (!isDayOff && (!jam || !['tersedia', 'tidak_tersedia', 'terisi_manual'].includes(mode))) {
      return fail(400, 'Status slot tidak valid.', 'VALIDATION_ERROR');
    }

    const result = await db.runTransaction(async (tx) => {
      const [scheduleSnap, bookingSnap] = await Promise.all([
        tx.get(scheduleRef),
        tx.get(bookingsQuery),
      ]);
      const currentSchedule = scheduleSnap.data() || {
        capsterId,
        tanggal: date,
        jamKerja: getOperationalHoursForDate(date),
        isLibur: false,
        manualSlots: {},
      };
      const activeBookings = bookingSnap.docs;
      const canceledDocs = isDayOff
        ? (isLibur ? activeBookings : [])
        : (mode !== 'tersedia'
            ? activeBookings.filter((snap) => {
                const booking = snap.data();
                return (booking.slotTercakup || [booking.jamSlot]).includes(jam);
              })
            : []);

      if (isDayOff && canceledDocs.length && !body.forceCancelConflicts) {
        return {
          conflictBookings: canceledDocs.map((snap) => ({ id: snap.id, ...snap.data() })),
          canceledDocs: [],
        };
      }
      if (!isDayOff && canceledDocs.length && !body.forceCancelConflict) {
        return {
          conflictBookings: canceledDocs.map((snap) => ({ id: snap.id, ...snap.data() })),
          canceledDocs: [],
        };
      }

      const lockRefMap = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const snap of canceledDocs) {
        const booking = snap.data();
        const slots = Array.isArray(booking.slotTercakup) ? booking.slotTercakup : [booking.jamSlot];
        for (const slot of slots) {
          const lockRef = db.collection('bookingSlots').doc(slotLockId(capsterId, date, String(slot)));
          lockRefMap.set(lockRef.path, lockRef);
        }
      }
      const lockRefs = Array.from(lockRefMap.values());
      const lockSnaps = lockRefs.length ? await tx.getAll(...lockRefs) : [];

      if (isDayOff) {
        tx.set(scheduleRef, {
          ...currentSchedule,
          isLibur,
          alasanLibur: isLibur ? requiredText(body.alasanLibur) || 'Libur / Izin Capster' : null,
        }, { merge: true });
      } else {
        const manualSlots = { ...(currentSchedule.manualSlots || {}) } as Record<string, any>;
        if (mode === 'tersedia') {
          delete manualSlots[jam];
        } else {
          const note = requiredText(body.catatan);
          manualSlots[jam] = note ? { tipe: mode, catatan: note } : { tipe: mode };
        }
        tx.set(scheduleRef, { ...currentSchedule, manualSlots }, { merge: true });
      }

      const canceledIds = new Set(canceledDocs.map((snap) => snap.id));
      for (const snap of canceledDocs) {
        const booking = snap.data();
        const reason = isDayOff
          ? requiredText(body.alasanLibur) || 'Capster menandai libur/izin pada tanggal ini'
          : requiredText(body.catatan) || 'Slot ditandai tidak tersedia oleh capster';
        const canceledAt = Date.now();
        const canceledBooking = {
          ...booking,
          status: 'Canceled',
          alasanBatal: 'capster_tidak_tersedia',
          catatanBatal: reason,
          canceledAt,
        };
        tx.update(snap.ref, {
          status: 'Canceled',
          alasanBatal: 'capster_tidak_tersedia',
          catatanBatal: reason,
          canceledAt,
          sheetSyncStatus: 'pending',
        });
        tx.set(db.collection('bookingPublic').doc(snap.id), {
          status: 'Canceled',
          canceledAt,
        }, { merge: true });
        persistSheetSyncJobInTransaction(
          tx,
          `booking-${snap.id}-final-${canceledAt}`,
          'updateTransaction',
          bookingSheetValues(canceledBooking, { nama: booking.nama, nomorWhatsApp: booking.nomorWhatsApp }, 'Batal', 0),
          { bookingCode: String(booking.kodeTiket), sourcePath: 'bookingPrivate', sourceId: snap.id }
        );
      }

      lockSnaps.forEach((lockSnap) => {
        const lock = lockSnap.data() as FirebaseFirestore.DocumentData | undefined;
        if (lockSnap.exists && lock?.bookingId && canceledIds.has(String(lock.bookingId))) {
          tx.set(lockSnap.ref, { status: 'Released', releasedAt: Date.now() }, { merge: true });
        }
      });

      return {
        conflictBookings: [],
        canceledDocs,
      };
    });

    if (result.conflictBookings.length) {
      return fail(
        409,
        isDayOff
          ? 'Terdapat booking pelanggan aktif pada tanggal ini. Batalkan booking tersebut secara eksplisit sebelum menandai hari libur.'
          : 'Slot ' + jam + ' WIB sudah dibooking oleh pelanggan. Konfirmasi pembatalan booking sebelum mengubah status slot.',
        'BOOKING_CONFLICT',
        { conflictBookings: result.conflictBookings }
      );
    }

    for (const snap of result.canceledDocs) {
      const booking = snap.data();
      const customerSnap = booking.customerUid
        ? await db.collection('customers').doc(String(booking.customerUid)).get()
        : null;
      await syncBookingFinal(snap.id, booking, customerSnap?.data() || booking, 'Batal');
    }

    return Response.json({ ok: true });
  }

  if (action.startsWith('promo.')) {
    const promos = db.collection('promos');
    const promoId = requiredText(body.promoId);
    if (action === 'promo.delete') {
      await promos.doc(promoId).delete();
      return Response.json({ ok: true });
    }
    if (action === 'promo.toggle') {
      const ref = promos.doc(promoId);
      const snap = await ref.get();
      if (!snap.exists) return fail(404, 'Promo tidak ditemukan.', 'NOT_FOUND');
      await ref.update({ aktif: !snap.data()?.aktif, diperbaruiOleh: 'Hasan', diperbaruiPada: Date.now() });
      return Response.json({ ok: true });
    }
    const p = body.params || body;
    const judul = requiredText(p.judul);
    const layananId = Array.isArray(p.layananId) ? p.layananId.filter((x: unknown) => typeof x === 'string') : [];
    const diskonMin = Math.round(Number(p.diskonMin));
    const diskonMax = Math.round(Number(p.diskonMax));
    if (judul.length < 3 || !layananId.length || !Number.isFinite(diskonMin) || !Number.isFinite(diskonMax) || diskonMin < 0 || diskonMax > 100 || diskonMin > diskonMax) return fail(400, 'Data promo tidak valid.', 'VALIDATION_ERROR');
    const id = action === 'promo.update' ? promoId : 'promo-' + randomUUID();
    const data = {
      id, judul, deskripsi: requiredText(p.deskripsi), layananId,
      diskonMin, diskonMax, aktif: Boolean(p.aktif),
      berlakuDari: requiredText(p.berlakuDari) || null,
      berlakuSampai: requiredText(p.berlakuSampai) || null,
      diperbaruiOleh: 'Hasan', diperbaruiPada: Date.now(),
    };
    await promos.doc(id).set(data, { merge: true });
    return Response.json({ ok: true });
  }

  if (action === 'profile.update') {
    const p = body.params || body;
    const pengalaman = requiredText(p.pengalaman);
    const nomorWhatsApp = normalizeWaToLocal08(requiredText(p.nomorWhatsApp));
    const instagramCapster = validateInstagramHandle(requiredText(p.instagramCapster), 'Instagram Capster');
    const instagramBarbershop = validateInstagramHandle(requiredText(p.instagramBarbershop), 'Instagram Barbershop');
    if (pengalaman.length < 5 || !/^08\d{8,12}$/.test(nomorWhatsApp) || !instagramCapster.valid || !instagramBarbershop.valid) return fail(400, 'Data profil capster tidak valid.', 'VALIDATION_ERROR');
    await db.collection('capsterProfile').doc('hasan').set({
      ...getInitialCapsterProfile(), pengalaman, nomorWhatsApp,
      instagramCapster: instagramCapster.cleaned,
      instagramBarbershop: instagramBarbershop.cleaned,
      diperbaruiPada: Date.now(),
    }, { merge: true });
    return Response.json({ ok: true });
  }

  const queueActions = action.startsWith('queue.');
  const privateCollection = queueActions ? 'queuePrivate' : 'bookingPrivate';
  const publicCollection = queueActions ? 'queuePublic' : 'bookingPublic';
  const ref = db.collection(privateCollection).doc(id);
  const publicRef = db.collection(publicCollection).doc(id);

  if (action === 'queue.call' || action === 'queue.complete' || action === 'queue.capsterCancel') {
    const snap = await ref.get();
    if (!snap.exists) return fail(404, 'Antrean tidak ditemukan.', 'NOT_FOUND');
    const q = snap.data()!;
    const now = Date.now();
    if (action === 'queue.call') {
      await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists || current.data()?.status !== 'Waiting') throw new Error('INVALID_STATE');
        tx.update(ref, { status: 'In-Service', capsterId: 'hasan', waktuMulai: now });
        tx.set(publicRef, { status: 'In-Service', waktuMulai: now }, { merge: true });
      });
    } else if (action === 'queue.complete') {
      if (q.status !== 'In-Service') return fail(409, 'Antrean harus berstatus In-Service.', 'INVALID_STATE');
      const selected = Array.isArray(body.selectedServices) ? body.selectedServices : [];
      if (!selected.length) return fail(400, 'Pilih minimal satu layanan untuk walk-in.', 'VALIDATION_ERROR');
      const promoSnap = await db.collection('promos').get();
      const promos = promoSnap.empty ? getInitialSystemPromos() : promoSnap.docs.map((item) => item.data() as any);
      const activePromos = promos.filter((promo: any) => isPromoActiveNow(promo, now));
      const pricing = calculateServicesPricing(selected, activePromos);
      if (!pricing.lines.length) return fail(400, 'Layanan walk-in tidak valid.', 'VALIDATION_ERROR');
      const elapsed = q.waktuMulai ? Math.max(1, Math.round((now - q.waktuMulai) / 60000)) : 45;
      const actualDuration = Number(body.durationMinutes) > 0 ? Math.round(Number(body.durationMinutes)) : elapsed;
      const finalTotal = typeof body.finalTotal === 'number'
        ? Math.round(body.finalTotal)
        : pricing.totalEstimasiMin;
      if (finalTotal < 0 || finalTotal > pricing.subtotalHarga) {
        return fail(400, 'Harga akhir walk-in tidak valid.', 'VALIDATION_ERROR');
      }
      const code = 'WI-' + String(q.kunciHariOperasional || q.tanggal).replace(/-/g, '') + '-' + q.nomorAntrean;
      const sheetValues = {
        'Tanggal': q.tanggal,
        'Jam': new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(q.waktuAmbil),
        'Kode Booking': code,
        'Nama Pelanggan': q.namaPelanggan || 'Pelanggan',
        'Nomor WhatsApp': q.nomorWhatsApp || '',
        'Capster': 'Hasan',
        'Layanan (daftar)': pricing.lines.map((line) => line.nama + (line.qty > 1 ? ' x' + line.qty : '')).join(', '),
        'Kategori': categoriesFor(pricing.lines),
        'Harga Normal': pricing.subtotalHarga,
        'Potongan Promo': Math.max(0, pricing.subtotalHarga - finalTotal),
        'Total Harga': finalTotal,
        'Status': 'Selesai',
        'Sumber': 'Walk-in',
      };
      const customerRef = q.customerUid ? db.collection('customers').doc(q.customerUid) : null;
      const activeQueueRef = q.customerUid && q.operationalDayKey
        ? db.collection('activeQueues').doc(String(q.operationalDayKey) + '_' + String(q.customerUid))
        : null;
      const completed = await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists || current.data()?.status !== 'In-Service') throw new Error('INVALID_STATE');
        const [customerSnap, activeQueueSnap] = await Promise.all([
          customerRef ? tx.get(customerRef) : Promise.resolve(null),
          activeQueueRef ? tx.get(activeQueueRef) : Promise.resolve(null),
        ]);
        const completedQueue = {
          ...current.data(),
          status: 'Selesai', waktuSelesai: now, durasiAktual: actualDuration,
          layananDipilih: pricing.lines, subtotalHarga: pricing.subtotalHarga,
          potonganFinal: Math.max(0, pricing.subtotalHarga - finalTotal),
          hargaFinal: finalTotal, sheetSyncStatus: 'pending',
        };
        tx.update(ref, {
          status: 'Selesai', waktuSelesai: now, durasiAktual: actualDuration,
          layananDipilih: pricing.lines, subtotalHarga: pricing.subtotalHarga,
          potonganFinal: Math.max(0, pricing.subtotalHarga - finalTotal),
          hargaFinal: finalTotal, sheetSyncStatus: 'pending',
        });
        tx.set(publicRef, { status: 'Selesai', waktuSelesai: now }, { merge: true });
        if (activeQueueSnap?.exists && activeQueueSnap.data()?.queueId === id && activeQueueRef) {
          tx.delete(activeQueueRef);
        }
        let customer = customerSnap?.data() || null;
        let visits = 0;
        if (customerSnap?.exists && customerRef) {
          visits = Number(customerSnap.data()?.totalKunjungan || 0) + 1;
          tx.update(customerRef, { totalKunjungan: visits, kunjunganTerakhir: q.tanggal });
          customer = { ...customerSnap.data(), totalKunjungan: visits };
          persistSheetSyncJobInTransaction(
            tx,
            `walkin-${id}-customer`,
            'upsertCustomer',
            customerSheetValues(customer, visits, q.tanggal),
            { sourcePath: 'customers', sourceId: String(q.customerUid) }
          );
        }
        persistSheetSyncJobInTransaction(
          tx,
          `walkin-${id}-append`,
          'appendTransaction',
          sheetValues,
          { sourcePath: 'queuePrivate', sourceId: id }
        );
        return { completedQueue, customer, visits };
      });

      await drainSheetSyncQueue(50).catch((error) => {
        console.error('[sheet-outbox-drain]', error);
      });
      if (completed.customer) {
        await syncCustomer(completed.customer, completed.visits, q.tanggal, `walkin-${id}-customer`);
      }
    } else {
      if (q.status !== 'Waiting') return fail(409, 'Hanya antrean Waiting yang dapat dibatalkan.', 'INVALID_STATE');
      await handleQueueCancel('', id, true);
    }
    return Response.json({ ok: true });
  }

  if (action === 'booking.start' || action === 'booking.complete' || action === 'booking.capsterCancel') {
    const snap = await ref.get();
    if (!snap.exists) return fail(404, 'Booking tidak ditemukan.', 'NOT_FOUND');
    const booking = snap.data()!;
    if (action === 'booking.start') {
      const now = Date.now();
      await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists || current.data()?.status !== 'Booked') throw new Error('INVALID_STATE');
        tx.update(ref, { status: 'In-Service', waktuMulai: now });
        tx.set(publicRef, { status: 'In-Service', waktuMulai: now }, { merge: true });
      });
      return Response.json({ ok: true });
    }
    if (action === 'booking.complete') {
      if (booking.status !== 'In-Service') return fail(409, 'Booking harus berstatus In-Service.', 'INVALID_STATE');
      const now = Date.now();
      const elapsed = booking.waktuMulai ? Math.max(1, Math.round((now - booking.waktuMulai) / 60000)) : 45;
      const finalTotal = typeof body.finalTotal === 'number' ? Math.round(body.finalTotal) : Number(booking.totalEstimasiMin || booking.subtotalHarga || 0);
      if (finalTotal < 0 || finalTotal > Number(booking.subtotalHarga || 0)) return fail(400, 'Harga akhir tidak valid.', 'VALIDATION_ERROR');
      const slots = booking.slotTercakup || [booking.jamSlot];
      const lockRefs = slots.map((slot: string) => db.collection('bookingSlots').doc(slotLockId(booking.capsterId, booking.tanggal, slot)));
      const customerRef = booking.customerUid ? db.collection('customers').doc(booking.customerUid) : null;
      const completed = await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        const [lockSnaps, customerSnap] = await Promise.all([
          tx.getAll(...lockRefs),
          customerRef ? tx.get(customerRef) : Promise.resolve(null),
        ]);
        if (!current.exists || current.data()?.status !== 'In-Service') throw new Error('INVALID_STATE');
        const currentBooking = current.data()!;
        const updated = {
          ...currentBooking,
          status: 'Selesai',
          waktuSelesai: now,
          durasiAktual: Number(body.durationMinutes) > 0 ? Math.round(Number(body.durationMinutes)) : elapsed,
          hargaFinal: finalTotal,
          potonganFinal: Math.max(0, Number(currentBooking.subtotalHarga || 0) - finalTotal),
        };
        tx.update(ref, {
          status: 'Selesai', waktuSelesai: now,
          durasiAktual: updated.durasiAktual,
          hargaFinal: finalTotal,
          potonganFinal: updated.potonganFinal,
        });
        tx.set(publicRef, { status: 'Selesai', waktuSelesai: now }, { merge: true });
        lockSnaps.forEach((lock) => {
          if (lock.exists && (lock.data() as FirebaseFirestore.DocumentData | undefined)?.bookingId === id) tx.set(lock.ref, { status: 'Released', releasedAt: now }, { merge: true });
        });
        let customer = customerSnap?.data() || { nama: booking.nama, nomorWhatsApp: booking.nomorWhatsApp };
        let visits = 0;
        if (customerSnap?.exists && customerRef) {
          visits = Number(customerSnap.data()?.totalKunjungan || 0) + 1;
          tx.update(customerRef, { totalKunjungan: visits, kunjunganTerakhir: booking.tanggal });
          customer = { ...customer, totalKunjungan: visits };
          persistSheetSyncJobInTransaction(
            tx,
            `booking-${id}-customer`,
            'upsertCustomer',
            customerSheetValues(customer, visits, booking.tanggal),
            { sourcePath: 'customers', sourceId: String(booking.customerUid) }
          );
        }
        persistSheetSyncJobInTransaction(
          tx,
          `booking-${id}-final-${now}`,
          'updateTransaction',
          bookingSheetValues(updated, customer, 'Selesai', finalTotal),
          { bookingCode: String(booking.kodeTiket), sourcePath: 'bookingPrivate', sourceId: id }
        );
        return { updated, customer, visits };
      });
      await syncBookingFinal(id, completed.updated, completed.customer, 'Selesai', finalTotal);
      if (completed.visits) await syncCustomer(completed.customer, completed.visits, booking.tanggal, `booking-${id}-customer`);
      return Response.json({ ok: true });
    }
    const slots = booking.slotTercakup || [booking.jamSlot];
    const lockRefs = slots.map((slot: string) => db.collection('bookingSlots').doc(slotLockId(booking.capsterId, booking.tanggal, slot)));
    await db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      const lockSnaps = await tx.getAll(...lockRefs);
      if (!current.exists || current.data()?.status !== 'Booked') throw new Error('INVALID_STATE');
      const currentBooking = current.data()!;
      const canceledAt = Date.now();
      const canceledBooking = {
        ...currentBooking,
        status: 'Canceled',
        alasanBatal: 'manual',
        catatanBatal: 'Dibatalkan oleh capster',
        canceledAt,
      };
      tx.update(ref, {
        status: 'Canceled',
        alasanBatal: 'manual',
        catatanBatal: 'Dibatalkan oleh capster',
        canceledAt,
        sheetSyncStatus: 'pending',
      });
      tx.set(publicRef, { status: 'Canceled', canceledAt }, { merge: true });
      persistSheetSyncJobInTransaction(
        tx,
        `booking-${id}-final-${canceledAt}`,
        'updateTransaction',
        bookingSheetValues(canceledBooking, { nama: currentBooking.nama, nomorWhatsApp: currentBooking.nomorWhatsApp }, 'Batal', 0),
        { bookingCode: String(currentBooking.kodeTiket), sourcePath: 'bookingPrivate', sourceId: id }
      );
      lockSnaps.forEach((lock) => {
        if (lock.exists && (lock.data() as FirebaseFirestore.DocumentData | undefined)?.bookingId === id) tx.set(lock.ref, { status: 'Released', releasedAt: Date.now() }, { merge: true });
      });
    });
    const customerSnap = booking.customerUid ? await db.collection('customers').doc(booking.customerUid).get() : null;
    await syncBookingFinal(id, booking, customerSnap?.data() || booking, 'Batal');
    return Response.json({ ok: true });
  }

  return fail(400, 'Aksi tidak dikenali.', 'VALIDATION_ERROR');
}

export async function POST(request: Request) {
  try {
    const context = await userContext(request);
    const body = await request.json();
    const action = requiredText(body.action) as StoreAction;

    if (action === 'queue.take') {
      if (context.capster) return fail(403, 'Hanya pelanggan yang dapat mengambil antrean.', 'UNAUTHORIZED');
      return await handleQueueTake(context.uid, body);
    }
    if (action === 'queue.cancel') {
      if (context.capster) return await handleQueueCancel(context.uid, requiredText(body.id), true);
      return await handleQueueCancel(context.uid, requiredText(body.id), false);
    }
    if (action === 'booking.create') {
      if (context.capster) return fail(403, 'Hanya pelanggan yang dapat membuat booking.', 'UNAUTHORIZED');
      return await handleBookingCreate(context.uid, body);
    }
    if (action === 'booking.cancel' || action === 'booking.reschedule') {
      if (context.capster) return fail(403, 'Aksi ini hanya untuk pelanggan.', 'UNAUTHORIZED');
      if (action === 'booking.cancel') return await handleBookingCustomerCancel(context.uid, requiredText(body.id));
      return await handleBookingCustomerCancel(context.uid, requiredText(body.id), body);
    }
    if (!context.capster) return fail(403, 'Aksi ini khusus capster.', 'UNAUTHORIZED');
    return await handleCapsterAction(action, body);
  } catch (error) {
    if (error instanceof CapsterAuthError) return fail(error.status, error.message, 'UNAUTHORIZED');
    const code = error instanceof Error ? error.message : String(error);
    if (code === 'QUOTA_FULL') return fail(409, 'Kuota antrean hari ini sudah penuh.', 'QUOTA_FULL');
    if (code === 'SLOT_TAKEN') return fail(409, 'Slot baru saja diambil, silakan pilih slot lain', 'SLOT_TAKEN');
    if (code === 'CAPSTER_OFF') return fail(409, 'Capster tidak tersedia pada jadwal tersebut.', 'CAPSTER_OFF');
    if (code === 'NOT_FOUND') return fail(404, 'Data tidak ditemukan.', 'NOT_FOUND');
    if (code === 'UNAUTHORIZED') return fail(403, 'Anda tidak memiliki akses ke data ini.', 'UNAUTHORIZED');
    if (code === 'INVALID_STATE') return fail(409, 'Status data sudah berubah. Muat ulang lalu coba lagi.', 'INVALID_STATE');
    console.error('[store-api]', error);
    return fail(500, 'Terjadi kesalahan saat menyimpan data.', 'INVALID_STATE');
  }
}
