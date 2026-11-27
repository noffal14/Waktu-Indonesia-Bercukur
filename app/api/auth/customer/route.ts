import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { validateIndonesianWhatsApp } from '@/lib/barber-service';
import { formatWibIsoDateTime } from '@/lib/barbershop-config';
import { upsertCustomerByWhatsApp } from '@/lib/google-sheets';
import { enqueueSheetSync } from '@/lib/sheets-outbox';

export const dynamic = 'force-dynamic';

function emailForPhone(phone: string) {
  return `${phone}@pelanggan.waktu-indonesia.app`;
}
async function getUid(request: Request, allowMissingProfile = false) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error('AUTH_REQUIRED');
  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token, true);
  } catch {
    throw new Error('AUTH_REQUIRED');
  }
  if (decoded.role === 'capster') throw new Error('FORBIDDEN');
  const email = String(decoded.email || '').toLowerCase();
  const phoneFromEmail = email.match(/^(628\d{8,12})@pelanggan\.waktu-indonesia\.app$/)?.[1];
  if (!phoneFromEmail) throw new Error('FORBIDDEN');
  if (!allowMissingProfile) {
    const profile = await getAdminDb().collection('customers').doc(decoded.uid).get();
    if (!profile.exists || profile.data()?.nomorWhatsApp !== phoneFromEmail) throw new Error('FORBIDDEN');
  }
  return decoded;
}

export async function POST(request: Request) {
  try {
    const decoded = await getUid(request, true);
    const body = await request.json();
    const nama = String(body.nama || '').trim();
    const phoneCheck = validateIndonesianWhatsApp(String(body.nomorWhatsApp || ''));
    if (nama.length < 3 || !phoneCheck.valid) {
      return Response.json({ ok: false, message: phoneCheck.error || 'Nama minimal 3 karakter.', errorCode: 'VALIDATION_ERROR' }, { status: 400 });
    }
    if (decoded.email !== emailForPhone(phoneCheck.normalized)) {
      return Response.json({ ok: false, message: 'Nomor WhatsApp tidak sesuai dengan akun login.', errorCode: 'UNAUTHORIZED' }, { status: 403 });
    }

    const db = getAdminDb();
    const customerRef = db.collection('customers').doc(decoded.uid);
    const phoneRef = db.collection('waAccounts').doc(phoneCheck.normalized);
    await db.runTransaction(async (tx) => {
      const [phoneSnap, customerSnap] = await Promise.all([tx.get(phoneRef), tx.get(customerRef)]);
      if (phoneSnap.exists && phoneSnap.data()?.uid !== decoded.uid) throw new Error('PHONE_EXISTS');
      if (customerSnap.exists) throw new Error('ACCOUNT_EXISTS');
      const customer = {
        uid: decoded.uid, nama, nomorWhatsApp: phoneCheck.normalized,
        email: String(body.email || '').trim().toLowerCase() || null,
        capsterFavoritId: String(body.capsterFavoritId || 'hasan'),
        dibuatPada: Date.now(), totalKunjungan: 0,
      };
      tx.create(phoneRef, { uid: decoded.uid, createdAt: FieldValue.serverTimestamp() });
      tx.create(customerRef, customer);
    });

    const profile = (await customerRef.get()).data();
    const sheetValues = {
      'Nama': nama,
      'Nomor WhatsApp': phoneCheck.normalized,
      'Email': String(body.email || '').trim().toLowerCase(),
      'Tanggal Daftar': formatWibIsoDateTime(Number(profile?.dibuatPada || Date.now())),
      'Kunjungan Terakhir': '',
      'Total Kunjungan': 0,
    };
    try {
      await upsertCustomerByWhatsApp(sheetValues);
    } catch {
      await enqueueSheetSync(`customer-${phoneCheck.normalized}`, 'upsertCustomer', sheetValues);
    }
    return Response.json({ ok: true, customer: { ...profile, id: decoded.uid, passwordHash: '' } }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'AUTH_REQUIRED') return Response.json({ ok: false, message: 'Silakan masuk kembali.', errorCode: 'AUTH_REQUIRED' }, { status: 401 });
    if (code === 'FORBIDDEN') return Response.json({ ok: false, message: 'Akun ini bukan akun pelanggan yang terdaftar.', errorCode: 'UNAUTHORIZED' }, { status: 403 });
    if (code === 'PHONE_EXISTS') return Response.json({ ok: false, message: 'Nomor WhatsApp sudah terdaftar.', errorCode: 'VALIDATION_ERROR' }, { status: 409 });
    if (code === 'ACCOUNT_EXISTS') return Response.json({ ok: false, message: 'Akun pelanggan sudah memiliki profil.', errorCode: 'INVALID_STATE' }, { status: 409 });
    console.error('[customer-auth-register]', error);
    return Response.json({ ok: false, message: 'Pendaftaran akun gagal.', errorCode: 'INVALID_STATE' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const decoded = await getUid(request);
    const snapshot = await getAdminDb().collection('customers').doc(decoded.uid).get();
    if (!snapshot.exists) return Response.json({ ok: false, message: 'Profil pelanggan belum dibuat.', errorCode: 'NOT_FOUND' }, { status: 404 });
    return Response.json({ ok: true, customer: { ...snapshot.data(), id: decoded.uid, passwordHash: '' } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'AUTH_REQUIRED') return Response.json({ ok: false, message: 'Silakan masuk kembali.', errorCode: 'AUTH_REQUIRED' }, { status: 401 });
    if (code === 'FORBIDDEN') return Response.json({ ok: false, message: 'Akun ini bukan akun pelanggan.', errorCode: 'UNAUTHORIZED' }, { status: 403 });
    console.error('[customer-auth-profile]', error);
    return Response.json({ ok: false, message: 'Gagal memuat profil.', errorCode: 'INVALID_STATE' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const decoded = await getUid(request);
    const body = await request.json();
    const ref = getAdminDb().collection('customers').doc(decoded.uid);
    const current = await ref.get();
    if (!current.exists) return Response.json({ ok: false, message: 'Profil pelanggan tidak ditemukan.', errorCode: 'NOT_FOUND' }, { status: 404 });
    const nama = body.nama === undefined ? undefined : String(body.nama).trim();
    if (nama !== undefined && nama.length < 3) return Response.json({ ok: false, message: 'Nama minimal 3 karakter.', errorCode: 'VALIDATION_ERROR' }, { status: 400 });
    await ref.update({
      ...(nama !== undefined ? { nama } : {}),
      ...(body.email !== undefined ? { email: String(body.email || '').trim().toLowerCase() || null } : {}),
      ...(body.capsterFavoritId !== undefined ? { capsterFavoritId: body.capsterFavoritId === 'hasan' ? 'hasan' : null } : {}),
      diperbaruiPada: Date.now(),
    });
    const updated = (await ref.get()).data();
    const sheetValues = {
      'Nama': updated?.nama || '',
      'Nomor WhatsApp': updated?.nomorWhatsApp || '',
      'Email': updated?.email || '',
      'Tanggal Daftar': formatWibIsoDateTime(Number(updated?.dibuatPada || Date.now())),
      'Kunjungan Terakhir': updated?.kunjunganTerakhir || '',
      'Total Kunjungan': Number(updated?.totalKunjungan || 0),
    };
    try {
      await upsertCustomerByWhatsApp(sheetValues);
    } catch {
      await enqueueSheetSync(`customer-${String(updated?.nomorWhatsApp || decoded.uid)}`, 'upsertCustomer', sheetValues);
    }
    return Response.json({ ok: true, customer: { ...updated, id: decoded.uid, passwordHash: '' } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'AUTH_REQUIRED') return Response.json({ ok: false, message: 'Silakan masuk kembali.', errorCode: 'AUTH_REQUIRED' }, { status: 401 });
    console.error('[customer-auth-update]', error);
    return Response.json({ ok: false, message: 'Gagal memperbarui profil.', errorCode: 'INVALID_STATE' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const decoded = await getUid(request);
    const db = getAdminDb();
    const customerRef = db.collection('customers').doc(decoded.uid);
    const customer = (await customerRef.get()).data();
    if (customer?.nomorWhatsApp) {
      const phoneRef = db.collection('waAccounts').doc(String(customer.nomorWhatsApp));
      await db.runTransaction(async (tx) => {
        const phone = await tx.get(phoneRef);
        if (phone.exists && phone.data()?.uid === decoded.uid) tx.delete(phoneRef);
        tx.delete(customerRef);
      });
    } else {
      await customerRef.delete();
    }
    await getAdminAuth().deleteUser(decoded.uid);
    return Response.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'AUTH_REQUIRED') return Response.json({ ok: false, message: 'Silakan masuk kembali.', errorCode: 'AUTH_REQUIRED' }, { status: 401 });
    console.error('[customer-auth-delete]', error);
    return Response.json({ ok: false, message: 'Gagal menghapus akun.', errorCode: 'INVALID_STATE' }, { status: 500 });
  }
}
