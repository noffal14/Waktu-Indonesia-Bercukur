import 'server-only';

import { updateTransactionByCode } from '@/lib/google-sheets';
import { enqueueSheetSync } from '@/lib/sheets-outbox';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export function bookingExpiredSheetValues(booking: any) {
  const lines = Array.isArray(booking.layananDipilih) ? booking.layananDipilih : [];
  const categories = new Set<string>();
  for (const line of lines) {
    const category = String(line.kategoriNama || '').toLowerCase();
    if (category.includes('haircut')) categories.add('Haircut');
    else if (category.includes('bleach')) categories.add('Bleaching');
    else if (category.includes('perm')) categories.add('Perming');
    else if (category.includes('color')) categories.add('Hair Color');
  }
  return {
    'Tanggal': booking.tanggal,
    'Jam': booking.jamSlot,
    'Kode Booking': booking.kodeTiket,
    'Nama Pelanggan': booking.nama || 'Pelanggan',
    'Nomor WhatsApp': booking.nomorWhatsApp || '',
    'Capster': 'Hasan',
    'Layanan (daftar)': lines.map((line: any) => line.nama + (line.qty > 1 ? ' x' + line.qty : '')).join(', '),
    'Kategori': Array.from(categories).join(', '),
    'Harga Normal': Number(booking.subtotalHarga || 0),
    'Potongan Promo': 0,
    'Total Harga': 0,
    'Status': 'Batal',
    'Sumber': 'Booking',
  };
}

export async function syncBookingExpired(id: string, booking: any) {
  const values = bookingExpiredSheetValues(booking);
  const ref = getAdminDb().collection('bookingPrivate').doc(id);
  try {
    await updateTransactionByCode(String(booking.kodeTiket), values);
    await ref.set({ sheetSyncStatus: 'synced', sheetSyncUpdatedAt: Date.now(), sheetSyncError: FieldValue.delete() }, { merge: true });
  } catch (error) {
    await ref.set({ sheetSyncStatus: 'failed', sheetSyncError: String(error).slice(0, 500), sheetSyncUpdatedAt: Date.now() }, { merge: true });
    await enqueueSheetSync(`booking-${id}-expired`, 'updateTransaction', values, {
      bookingCode: String(booking.kodeTiket),
      sourcePath: 'bookingPrivate',
      sourceId: id,
    });
  }
}
