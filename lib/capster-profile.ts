export interface CapsterProfile {
  capsterId: string;
  nama: string;
  gelar: string;
  pengalaman: string;
  nomorWhatsApp: string; // Disimpan dalam format lokal 08xx, misal: "083869157107"
  instagramCapster: string; // Tanpa awalan "@", misal: "sanrascals_027"
  instagramBarbershop: string; // Tanpa awalan "@", misal: "waktu_indonesia_bercukur"
  diperbaruiPada: number; // Epoch ms
}

export const DEFAULT_CAPSTER_WA_MESSAGE =
  'Halo Hasan, saya ingin bertanya tentang layanan di Waktu Indonesia Bercukur';

/**
 * Konfigurasi awal profil & About Capster (Hasan).
 * Perubahan oleh capster tersimpan di state dan langsung sinkron ke halaman pelanggan.
 */
export function getInitialCapsterProfile(): CapsterProfile {
  return {
    capsterId: 'hasan',
    nama: 'Hasan',
    gelar: 'Capster Senior',
    pengalaman: '2 tahun pengalaman menjadi capster di Waktu Indonesia Bercukur',
    nomorWhatsApp: '083869157107',
    instagramCapster: 'sanrascals_027',
    instagramBarbershop: 'waktu_indonesia_bercukur',
    diperbaruiPada: Date.parse('2026-01-01T00:00:00+07:00'),
  };
}

export function cleanInstagramHandle(handle: string): string {
  return handle.trim().replace(/^@+/, '');
}

export function formatInstagramDisplay(handle: string): string {
  const cleaned = cleanInstagramHandle(handle);
  return cleaned ? `@${cleaned}` : '-';
}

export function getInstagramUrl(handle: string): string {
  const cleaned = cleanInstagramHandle(handle);
  return `https://instagram.com/${encodeURIComponent(cleaned)}`;
}

export function validateInstagramHandle(
  handle: string,
  label = 'Username Instagram'
): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = cleanInstagramHandle(handle);
  if (!cleaned) {
    return {
      valid: false,
      cleaned: '',
      error: `${label} wajib diisi.`,
    };
  }
  if (/\s/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: `${label} tidak boleh mengandung spasi.`,
    };
  }
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      error: `${label} hanya boleh berisi huruf, angka, titik, dan garis bawah (maks. 30 karakter).`,
    };
  }
  return { valid: true, cleaned };
}

export function normalizeWaToLocal08(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) {
    return '0' + digits.slice(2);
  }
  if (digits.startsWith('0')) {
    return digits;
  }
  return digits ? `0${digits}` : '';
}

export function normalizeWaTo628(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  return digits;
}

/**
 * Format tampilan nomor WhatsApp dengan tanda hubung: "0838-6915-7107".
 */
export function formatWhatsAppDashDisplay(phone: string): string {
  const local = normalizeWaToLocal08(phone);
  if (!local) return '-';
  if (local.length <= 4) return local;
  if (local.length <= 8) return `${local.slice(0, 4)}-${local.slice(4)}`;
  return `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`;
}

export function getWhatsAppChatUrl(
  phone: string,
  namaCapster = 'Hasan',
  customText?: string
): string {
  const wa628 = normalizeWaTo628(phone);
  const text =
    customText ||
    `Halo ${namaCapster}, saya ingin bertanya tentang layanan di Waktu Indonesia Bercukur`;
  return `https://wa.me/${wa628}?text=${encodeURIComponent(text)}`;
}
