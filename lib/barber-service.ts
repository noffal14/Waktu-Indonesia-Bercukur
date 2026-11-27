import {
  BarberDatabaseState,
  Capster,
  ComputedSlotInfo,
  Customer,
  DataAntreanWalkin,
  DataBooking,
  DataJadwalSlotCapster,
  DataKuotaAntrean,
  QueueEstimationSummary,
  ServiceResult,
  SlotStatus,
} from './types';

const STORAGE_KEY = 'wib_barbershop_state_v2';
const CUSTOMER_SESSION_ID_KEY = 'wib_customer_session_id';
const CUSTOMER_WALKIN_ID_KEY = 'wib_customer_walkin_id';
const CUSTOMER_BOOKING_CODE_KEY = 'wib_customer_booking_code';
const CAPSTER_SESSION_KEY = 'wib_capster_session_id';
const DEFAULT_DURATION_MINUTES = 45;
const LATE_TOLERANCE_MINUTES = 15;
const RESCHEDULE_MIN_LEAD_MINUTES = 60;
const DB_VERSION = 2;

export const INITIAL_CAPSTERS: Capster[] = [
  {
    id: 'hasan',
    nama: 'Hasan',
    gelar: 'Capster Senior',
    spesialisasi: 'Classic Taper, Pompadour & Rapikan Jenggot',
    pengalaman: '8 tahun pengalaman',
    username: 'hasan',
    pin: '1234',
    fotoKey: 'hasan',
  },
  {
    id: 'raka',
    nama: 'Raka',
    gelar: 'Capster',
    spesialisasi: 'Textured Crop, Burst Fade & French Crop',
    pengalaman: '4 tahun pengalaman',
    username: 'raka',
    pin: '1234',
    fotoKey: 'raka',
  },
  {
    id: 'dimas',
    nama: 'Dimas',
    gelar: 'Capster',
    spesialisasi: 'Clean Undercut, Buzz Cut & Hair Styling',
    pengalaman: '5 tahun pengalaman',
    username: 'dimas',
    pin: '1234',
    fotoKey: 'dimas',
  },
];

/**
 * CATATAN KEAMANAN:
 * Ini adalah autentikasi demo sisi klien (localStorage) tanpa backend.
 * Hash sederhana digunakan agar password tidak disimpan sebagai teks polos.
 * Untuk lingkungan produksi, WAJIB gunakan backend server atau Firebase Auth
 * dengan hashing kriptografis server-side (bcrypt/argon2) dan manajemen sesi aman.
 */
export function hashPasswordDemo(password: string): string {
  const salted = `wib_barber_salt_2026::${password}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + ((i + 1) * 31);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `wib_h1_${part1}${part2}`;
}

export function formatDateYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysYYYYMMDD(baseDateStr: string, days: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatDateYYYYMMDD(dt);
}

export function formatTimeHHMM(epochMs: number): string {
  const dt = new Date(epochMs);
  const h = String(dt.getHours()).padStart(2, '0');
  const m = String(dt.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDateIndo(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulan = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
  ];
  return `${hari[dt.getDay()]}, ${d} ${bulan[dt.getMonth()]} ${y}`;
}

export function formatShortDateIndo(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const hari = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const bulan = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  return `${hari[dt.getDay()]}, ${d} ${bulan[dt.getMonth()]}`;
}

export function getEffectiveNowMs(state: BarberDatabaseState): number {
  if (state.useRealClock) {
    return Date.now() + state.extraOffsetMinutes * 60_000;
  }
  const elapsedRealMs = Math.max(0, Date.now() - state.realAnchorMs);
  return (
    state.simAnchorMs + elapsedRealMs + state.extraOffsetMinutes * 60_000
  );
}

export function parseSlotEpochMs(tanggal: string, jamSlot: string): number {
  const [y, m, d] = tanggal.split('-').map(Number);
  const [hh, mm] = jamSlot.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

export function generateHourSlots(buka: string, tutup: string): string[] {
  const startHour = Number(buka.split(':')[0]);
  const endHour = Number(tutup.split(':')[0]);
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

export function normalizeWhatsAppTo628(phone: string): string {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+62')) {
    return '62' + cleaned.slice(3);
  }
  if (cleaned.startsWith('62')) {
    return cleaned;
  }
  if (cleaned.startsWith('0')) {
    return '62' + cleaned.slice(1);
  }
  return cleaned;
}

export function formatWhatsAppDisplay(wa628: string): string {
  if (wa628.startsWith('62')) {
    return '0' + wa628.slice(2);
  }
  return wa628;
}

export function validateIndonesianWhatsApp(phone: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (!cleaned) {
    return {
      valid: false,
      normalized: '',
      error: 'Nomor WhatsApp wajib diisi.',
    };
  }
  const normalized = normalizeWhatsAppTo628(cleaned);
  if (!/^628\d{8,12}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        'Gunakan nomor WhatsApp Indonesia yang valid (format 08xx atau 628xx, 10–14 digit).',
    };
  }
  return { valid: true, normalized };
}

export function validateEmailOptional(email?: string): {
  valid: boolean;
  cleaned?: string;
  error?: string;
} {
  const trimmed = email?.trim() || '';
  if (!trimmed) {
    return { valid: true, cleaned: undefined };
  }
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (!ok) {
    return {
      valid: false,
      error: 'Format email tidak valid (contoh: nama@email.com).',
    };
  }
  return { valid: true, cleaned: trimmed.toLowerCase() };
}

export function createSeedData(): BarberDatabaseState {
  const realNow = new Date();
  const todayStr = formatDateYYYYMMDD(realNow);
  const tomorrowStr = addDaysYYYYMMDD(todayStr, 1);
  const dayAfterStr = addDaysYYYYMMDD(todayStr, 2);

  // Anchor waktu demo ke hari ini pukul 13:05 WIB agar slot 10:00-21:00 realistis kapan pun diuji
  const [y, m, d] = todayStr.split('-').map(Number);
  const simAnchor = new Date(y, m - 1, d, 13, 5, 0, 0).getTime();
  const realAnchor = Date.now();
  const min = 60_000;
  const compactDate = todayStr.replace(/-/g, '');
  const compactTomorrow = tomorrowStr.replace(/-/g, '');

  const demoPasswordHash = hashPasswordDemo('demo123');

  const customers: Customer[] = [
    {
      id: 'cust-1',
      nama: 'Andi Pratama',
      nomorWhatsApp: '6281234567890',
      email: 'andi.pratama@contoh.id',
      passwordHash: demoPasswordHash,
      capsterFavoritId: 'hasan',
      dibuatPada: simAnchor - 10 * 24 * 60 * min,
    },
    {
      id: 'cust-2',
      nama: 'Bima Nugraha',
      nomorWhatsApp: '6281298765432',
      email: 'bima.nugraha@contoh.id',
      passwordHash: demoPasswordHash,
      capsterFavoritId: 'raka',
      dibuatPada: simAnchor - 5 * 24 * 60 * min,
    },
  ];

  const walkinQueue: DataAntreanWalkin[] = [
    {
      id: 'wk-1',
      nomorAntrean: 'A001',
      tanggal: todayStr,
      namaPelanggan: 'Budi Santoso',
      waktuAmbil: simAnchor - 150 * min, // 10:35
      status: 'Selesai',
      capsterId: 'hasan',
      waktuMulai: simAnchor - 140 * min, // 10:45
      waktuSelesai: simAnchor - 100 * min, // 11:25
      durasiAktual: 40,
    },
    {
      id: 'wk-2',
      nomorAntrean: 'A002',
      tanggal: todayStr,
      namaPelanggan: 'Fajar Pratama',
      waktuAmbil: simAnchor - 55 * min, // 12:10
      status: 'In-Service',
      capsterId: 'hasan',
      waktuMulai: simAnchor - 25 * min, // 12:40
    },
    {
      id: 'wk-3',
      nomorAntrean: 'A003',
      tanggal: todayStr,
      customerId: 'cust-1', // Terhubung ke pelanggan1 (081234567890)
      namaPelanggan: 'Andi Pratama',
      nomorWhatsApp: '6281234567890',
      waktuAmbil: simAnchor - 20 * min, // 12:45
      status: 'Waiting',
      capsterId: 'hasan',
    },
    {
      id: 'wk-4',
      nomorAntrean: 'A004',
      tanggal: todayStr,
      namaPelanggan: 'Reza Mahendra',
      waktuAmbil: simAnchor - 8 * min, // 12:57
      status: 'Waiting',
    },
  ];

  const bookings: DataBooking[] = [
    {
      id: 'bk-1',
      kodeTiket: `BK-${compactDate}-001`,
      nama: 'Rizky Ramadhan',
      nomorWhatsApp: '6281234567801',
      capsterId: 'hasan',
      tanggal: todayStr,
      jamSlot: '11:00',
      status: 'Selesai',
      alasanBatal: null,
      waktuDibuat: simAnchor - 240 * min,
      waktuMulai: parseSlotEpochMs(todayStr, '11:00'),
      waktuSelesai: parseSlotEpochMs(todayStr, '11:00') + 50 * min,
      durasiAktual: 50,
    },
    {
      id: 'bk-2',
      kodeTiket: `BK-${compactDate}-002`,
      nama: 'Bagas Saputra',
      nomorWhatsApp: '6281398765432',
      capsterId: 'raka',
      tanggal: todayStr,
      jamSlot: '13:00',
      status: 'In-Service',
      alasanBatal: null,
      waktuDibuat: simAnchor - 180 * min,
      waktuMulai: parseSlotEpochMs(todayStr, '13:00'),
    },
    {
      id: 'bk-3',
      kodeTiket: `BK-${compactDate}-003`,
      nama: 'Yoga Pratama',
      nomorWhatsApp: '6285611223344',
      capsterId: 'hasan',
      tanggal: todayStr,
      jamSlot: '13:00',
      status: 'Booked', // Saat ini 13:05 (baru 5 mnt, belum >15 mnt). Geser +15 mnt untuk demo auto-cancel!
      alasanBatal: null,
      waktuDibuat: simAnchor - 120 * min,
    },
    {
      id: 'bk-4',
      kodeTiket: `BK-${compactDate}-004`,
      customerId: 'cust-2', // Terhubung ke pelanggan2 (081298765432)
      nama: 'Bima Nugraha',
      nomorWhatsApp: '6281298765432',
      capsterId: 'raka',
      tanggal: todayStr,
      jamSlot: '15:00', // 115 menit mendatang dari 13:05 -> bisa reschedule!
      status: 'Booked',
      alasanBatal: null,
      waktuDibuat: simAnchor - 90 * min,
    },
    {
      id: 'bk-5',
      kodeTiket: `BK-${compactDate}-005`,
      customerId: 'cust-1', // Contoh riwayat Canceled otomatis milik pelanggan1
      nama: 'Andi Pratama',
      nomorWhatsApp: '6281234567890',
      capsterId: 'raka',
      tanggal: todayStr,
      jamSlot: '11:00',
      status: 'Canceled',
      alasanBatal: 'otomatis',
      waktuDibuat: simAnchor - 210 * min,
    },
    {
      id: 'bk-6',
      kodeTiket: `BK-${compactDate}-006`,
      nama: 'Arif Hidayat',
      nomorWhatsApp: '6281944556677',
      capsterId: 'dimas',
      tanggal: todayStr,
      jamSlot: '16:00',
      status: 'Booked',
      alasanBatal: null,
      waktuDibuat: simAnchor - 60 * min,
    },
    {
      id: 'bk-7',
      kodeTiket: `BK-${compactTomorrow}-001`,
      nama: 'Teguh Santoso',
      nomorWhatsApp: '6281223344556',
      capsterId: 'hasan',
      tanggal: tomorrowStr,
      jamSlot: '14:00',
      status: 'Booked',
      alasanBatal: null,
      waktuDibuat: simAnchor - 30 * min,
    },
  ];

  const quotas: Record<string, DataKuotaAntrean> = {
    [todayStr]: {
      tanggal: todayStr,
      kuotaMaksimal: 20,
      kuotaTerpakai: 4,
    },
    [tomorrowStr]: {
      tanggal: tomorrowStr,
      kuotaMaksimal: 20,
      kuotaTerpakai: 0,
    },
  };

  const defaultJamKerja = {
    hasan: { buka: '10:00', tutup: '21:00' },
    raka: { buka: '10:00', tutup: '21:00' },
    dimas: { buka: '10:00', tutup: '21:00' },
  };

  const schedules: Record<string, DataJadwalSlotCapster> = {
    [`hasan_${todayStr}`]: {
      capsterId: 'hasan',
      tanggal: todayStr,
      jamKerja: { buka: '10:00', tutup: '21:00' },
      isLibur: false,
      slotPenuhManual: ['12:00', '17:00'],
    },
    [`raka_${todayStr}`]: {
      capsterId: 'raka',
      tanggal: todayStr,
      jamKerja: { buka: '10:00', tutup: '21:00' },
      isLibur: false,
      slotPenuhManual: ['14:00'],
    },
    [`dimas_${todayStr}`]: {
      capsterId: 'dimas',
      tanggal: todayStr,
      jamKerja: { buka: '10:00', tutup: '21:00' },
      isLibur: false,
      slotPenuhManual: ['13:00', '14:00'],
    },
    [`dimas_${dayAfterStr}`]: {
      capsterId: 'dimas',
      tanggal: dayAfterStr,
      jamKerja: { buka: '10:00', tutup: '21:00' },
      isLibur: true,
      alasanLibur: 'Izin acara keluarga',
      slotPenuhManual: [],
    },
  };

  return {
    version: DB_VERSION,
    simAnchorMs: simAnchor,
    realAnchorMs: realAnchor,
    extraOffsetMinutes: 0,
    useRealClock: false,
    capsters: INITIAL_CAPSTERS,
    customers,
    walkinQueue,
    quotas,
    schedules,
    bookings,
    defaultJamKerja,
    lastUpdatedAt: simAnchor,
  };
}

class BarberLocalStorageService {
  private readRaw(): BarberDatabaseState {
    if (typeof window === 'undefined') {
      return createSeedData();
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seed = createSeedData();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      const parsed = JSON.parse(raw) as BarberDatabaseState;
      if (!parsed || parsed.version !== DB_VERSION) {
        const seed = createSeedData();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
        return seed;
      }
      // Pastikan kompatibilitas jika customers belum ada
      if (!Array.isArray(parsed.customers)) {
        const seed = createSeedData();
        parsed.customers = seed.customers;
      }
      return parsed;
    } catch {
      return createSeedData();
    }
  }

  private writeRaw(state: BarberDatabaseState): BarberDatabaseState {
    const nextState: BarberDatabaseState = {
      ...state,
      lastUpdatedAt: getEffectiveNowMs(state),
    };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    }
    return nextState;
  }

  /**
   * Memeriksa keterlambatan booking > 15 menit secara otomatis.
   * Jika lewat 15 menit dari jam slot tanpa diproses, status menjadi Canceled (otomatis)
   * sehingga slot kembali Available untuk walk-in / booking baru.
   */
  public syncAndGetState(): BarberDatabaseState {
    const state = this.readRaw();
    const nowMs = getEffectiveNowMs(state);
    let changed = false;

    const updatedBookings = state.bookings.map((b) => {
      if (b.status !== 'Booked') return b;
      const slotMs = parseSlotEpochMs(b.tanggal, b.jamSlot);
      const deadlineMs = slotMs + LATE_TOLERANCE_MINUTES * 60_000;
      if (nowMs > deadlineMs) {
        changed = true;
        return {
          ...b,
          status: 'Canceled' as const,
          alasanBatal: 'otomatis' as const,
        };
      }
      return b;
    });

    if (changed) {
      return this.writeRaw({
        ...state,
        bookings: updatedBookings,
      });
    }
    return state;
  }

  // =========================================================================
  // AUTH PELANGGAN (D5 DataAkunPelanggan)
  // Catatan: Autentikasi demo localStorage; produksi perlu backend/Firebase Auth
  // =========================================================================

  public registerCustomer(params: {
    nama: string;
    nomorWhatsApp: string;
    email?: string;
    password: string;
    capsterFavoritId?: string;
  }): ServiceResult<{ customer: Customer; state: BarberDatabaseState }> {
    const namaTrim = params.nama.trim();
    if (namaTrim.length < 3) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Nama lengkap wajib diisi minimal 3 karakter.',
      };
    }

    const waCheck = validateIndonesianWhatsApp(params.nomorWhatsApp);
    if (!waCheck.valid) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: waCheck.error,
      };
    }

    const emailCheck = validateEmailOptional(params.email);
    if (!emailCheck.valid) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: emailCheck.error,
      };
    }

    if (!params.password || params.password.length < 6) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Password wajib diisi minimal 6 karakter.',
      };
    }

    const state = this.syncAndGetState();
    const exists = state.customers.some(
      (c) => c.nomorWhatsApp === waCheck.normalized
    );
    if (exists) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Nomor sudah terdaftar, silakan masuk',
      };
    }

    const nowMs = getEffectiveNowMs(state);
    const newCustomer: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nama: namaTrim,
      nomorWhatsApp: waCheck.normalized,
      email: emailCheck.cleaned,
      passwordHash: hashPasswordDemo(params.password),
      capsterFavoritId: params.capsterFavoritId || undefined,
      dibuatPada: nowMs,
    };

    const nextState = this.writeRaw({
      ...state,
      customers: [...state.customers, newCustomer],
    });
    this.setCustomerSessionId(newCustomer.id);

    return {
      ok: true,
      data: { customer: newCustomer, state: nextState },
    };
  }

  public loginCustomer(
    nomorWhatsApp: string,
    password: string
  ): ServiceResult<{ customer: Customer; state: BarberDatabaseState }> {
    const waCheck = validateIndonesianWhatsApp(nomorWhatsApp);
    if (!waCheck.valid) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: waCheck.error,
      };
    }
    if (!password) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Password wajib diisi.',
      };
    }

    const state = this.syncAndGetState();
    const customer = state.customers.find(
      (c) => c.nomorWhatsApp === waCheck.normalized
    );
    if (!customer || customer.passwordHash !== hashPasswordDemo(password)) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Nomor WhatsApp atau password tidak sesuai.',
      };
    }

    this.setCustomerSessionId(customer.id);
    return {
      ok: true,
      data: { customer, state },
    };
  }

  public loginDemoCustomerById(
    customerId: string
  ): ServiceResult<{ customer: Customer; state: BarberDatabaseState }> {
    const state = this.syncAndGetState();
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Akun demo tidak ditemukan.',
      };
    }
    this.setCustomerSessionId(customer.id);
    return { ok: true, data: { customer, state } };
  }

  public logoutCustomer(): void {
    this.setCustomerSessionId(null);
  }

  public getCurrentCustomer(state?: BarberDatabaseState): Customer | null {
    const id = this.getCustomerSessionId();
    if (!id) return null;
    const current = state || this.readRaw();
    return current.customers.find((c) => c.id === id) || null;
  }

  public updateCustomerProfile(
    customerId: string,
    params: {
      nama: string;
      email?: string;
      capsterFavoritId?: string;
      currentPassword?: string;
      newPassword?: string;
    }
  ): ServiceResult<{ customer: Customer; state: BarberDatabaseState }> {
    const namaTrim = params.nama.trim();
    if (namaTrim.length < 3) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Nama lengkap minimal 3 karakter.',
      };
    }

    const emailCheck = validateEmailOptional(params.email);
    if (!emailCheck.valid) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: emailCheck.error,
      };
    }

    const state = this.syncAndGetState();
    const existing = state.customers.find((c) => c.id === customerId);
    if (!existing) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Akun pelanggan tidak ditemukan.',
      };
    }

    let nextPasswordHash = existing.passwordHash;
    if (params.newPassword) {
      if (params.newPassword.length < 6) {
        return {
          ok: false,
          errorCode: 'VALIDATION_ERROR',
          message: 'Password baru minimal 6 karakter.',
        };
      }
      if (
        !params.currentPassword ||
        hashPasswordDemo(params.currentPassword) !== existing.passwordHash
      ) {
        return {
          ok: false,
          errorCode: 'VALIDATION_ERROR',
          message: 'Password saat ini tidak sesuai.',
        };
      }
      nextPasswordHash = hashPasswordDemo(params.newPassword);
    }

    const updatedCustomer: Customer = {
      ...existing,
      nama: namaTrim,
      email: emailCheck.cleaned,
      capsterFavoritId: params.capsterFavoritId || undefined,
      passwordHash: nextPasswordHash,
    };

    const nextWalkins = state.walkinQueue.map((w) =>
      w.customerId === customerId &&
      (w.status === 'Waiting' || w.status === 'In-Service')
        ? { ...w, namaPelanggan: namaTrim }
        : w
    );

    const nextBookings = state.bookings.map((b) =>
      b.customerId === customerId &&
      (b.status === 'Booked' || b.status === 'In-Service')
        ? { ...b, nama: namaTrim }
        : b
    );

    const nextState = this.writeRaw({
      ...state,
      customers: state.customers.map((c) =>
        c.id === customerId ? updatedCustomer : c
      ),
      walkinQueue: nextWalkins,
      bookings: nextBookings,
    });

    return {
      ok: true,
      data: { customer: updatedCustomer, state: nextState },
    };
  }

  public deleteCustomerAccount(
    customerId: string
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const exists = state.customers.some((c) => c.id === customerId);
    if (!exists) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Akun tidak ditemukan.',
      };
    }

    // Batalkan antrean walk-in & booking aktif milik pelanggan terlebih dahulu
    const nextWalkins = state.walkinQueue.map((w) =>
      w.customerId === customerId && w.status === 'Waiting'
        ? { ...w, status: 'Canceled' as const }
        : w
    );
    const nextBookings = state.bookings.map((b) =>
      b.customerId === customerId && b.status === 'Booked'
        ? {
            ...b,
            status: 'Canceled' as const,
            alasanBatal: 'manual' as const,
          }
        : b
    );

    const nextState = this.writeRaw({
      ...state,
      customers: state.customers.filter((c) => c.id !== customerId),
      walkinQueue: nextWalkins,
      bookings: nextBookings,
    });

    this.logoutCustomer();
    return { ok: true, data: nextState };
  }

  // =========================================================================
  // KUOTA, JADWAL & ESTIMASI
  // =========================================================================

  public getQuotaForDate(
    state: BarberDatabaseState,
    tanggal: string
  ): DataKuotaAntrean {
    const existing = state.quotas[tanggal];
    if (existing) return existing;
    const countToday = state.walkinQueue.filter(
      (q) => q.tanggal === tanggal
    ).length;
    return {
      tanggal,
      kuotaMaksimal: 20,
      kuotaTerpakai: countToday,
    };
  }

  public getScheduleConfig(
    state: BarberDatabaseState,
    capsterId: string,
    tanggal: string
  ): DataJadwalSlotCapster {
    const key = `${capsterId}_${tanggal}`;
    const existing = state.schedules[key];
    if (existing) return existing;
    const defHours = state.defaultJamKerja[capsterId] || {
      buka: '10:00',
      tutup: '21:00',
    };
    return {
      capsterId,
      tanggal,
      jamKerja: { ...defHours },
      isLibur: false,
      slotPenuhManual: [],
    };
  }

  public getComputedSlots(
    state: BarberDatabaseState,
    capsterId: string,
    tanggal: string
  ): {
    config: DataJadwalSlotCapster;
    slots: ComputedSlotInfo[];
  } {
    const config = this.getScheduleConfig(state, capsterId, tanggal);
    if (config.isLibur) {
      return { config, slots: [] };
    }
    const hours = generateHourSlots(config.jamKerja.buka, config.jamKerja.tutup);
    const nowMs = getEffectiveNowMs(state);

    const slots: ComputedSlotInfo[] = hours.map((jam) => {
      const slotEpoch = parseSlotEpochMs(tanggal, jam);
      const activeBooking = state.bookings.find(
        (b) =>
          b.capsterId === capsterId &&
          b.tanggal === tanggal &&
          b.jamSlot === jam &&
          (b.status === 'Booked' || b.status === 'In-Service')
      );
      const isManualFull = config.slotPenuhManual.includes(jam);
      const sudahLewat = nowMs > slotEpoch + LATE_TOLERANCE_MINUTES * 60_000;

      let status: SlotStatus = 'Available';
      if (isManualFull) {
        status = 'Full';
      } else if (activeBooking) {
        status = activeBooking.status === 'In-Service' ? 'Full' : 'Booked';
      } else if (sudahLewat) {
        status = 'Full';
      }

      return {
        capsterId,
        tanggal,
        jam,
        status,
        bookingId: activeBooking?.id,
        bookingKode: activeBooking?.kodeTiket,
        bookingNama: activeBooking?.nama,
        bookingStatus: activeBooking?.status,
        sudahLewat,
      };
    });

    return { config, slots };
  }

  public getQueueEstimation(
    state: BarberDatabaseState,
    tanggal: string
  ): QueueEstimationSummary {
    const completedWalkins = state.walkinQueue.filter(
      (q) =>
        q.tanggal === tanggal &&
        q.status === 'Selesai' &&
        typeof q.durasiAktual === 'number' &&
        q.durasiAktual > 0
    );
    const completedBookings = state.bookings.filter(
      (b) =>
        b.tanggal === tanggal &&
        b.status === 'Selesai' &&
        typeof b.durasiAktual === 'number' &&
        b.durasiAktual > 0
    );

    const durations = [
      ...completedWalkins.map((w) => w.durasiAktual as number),
      ...completedBookings.map((b) => b.durasiAktual as number),
    ];

    const jumlahSelesaiHariIni = durations.length;
    const menggunakanDefault = jumlahSelesaiHariIni === 0;
    const rataRataDurasiMenit = menggunakanDefault
      ? DEFAULT_DURATION_MINUTES
      : Math.round(durations.reduce((acc, v) => acc + v, 0) / durations.length);

    const waitingList = state.walkinQueue
      .filter((q) => q.tanggal === tanggal && q.status === 'Waiting')
      .sort((a, b) => a.waktuAmbil - b.waktuAmbil);

    const sedangDilayaniWalkin = state.walkinQueue
      .filter((q) => q.tanggal === tanggal && q.status === 'In-Service')
      .sort(
        (a, b) =>
          (a.waktuMulai || a.waktuAmbil) - (b.waktuMulai || b.waktuAmbil)
      );

    const sedangDilayaniBooking = state.bookings
      .filter((b) => b.tanggal === tanggal && b.status === 'In-Service')
      .sort(
        (a, b) =>
          (a.waktuMulai || a.waktuDibuat) - (b.waktuMulai || b.waktuDibuat)
      );

    return {
      rataRataDurasiMenit,
      jumlahSelesaiHariIni,
      menggunakanDefault,
      sedangDilayaniWalkin,
      sedangDilayaniBooking,
      waitingList,
    };
  }

  // =========================================================================
  // UC-01: AMBIL NOMOR ANTREAN WALK-IN
  // =========================================================================
  public takeWalkinQueue(params: {
    customerId?: string;
    namaPelanggan?: string;
    nomorWhatsApp?: string;
    capsterId?: string;
  }): ServiceResult<{
    ticket: DataAntreanWalkin;
    antreanDiDepan: number;
    estimasiMenit: number;
    state: BarberDatabaseState;
  }> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const todayStr = formatDateYYYYMMDD(new Date(nowMs));

    const customer = params.customerId
      ? state.customers.find((c) => c.id === params.customerId)
      : undefined;

    if (params.customerId && !customer) {
      return {
        ok: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Silakan masuk ke akun pelanggan terlebih dahulu.',
      };
    }

    // Cek aturan: satu pelanggan hanya boleh punya SATU antrean walk-in aktif per hari
    if (customer) {
      const existingActive = state.walkinQueue.find(
        (w) =>
          w.tanggal === todayStr &&
          w.customerId === customer.id &&
          (w.status === 'Waiting' || w.status === 'In-Service')
      );
      if (existingActive) {
        return {
          ok: false,
          errorCode: 'DUPLICATE_WALKIN',
          message: `Anda sudah memiliki antrean walk-in aktif hari ini (${existingActive.nomorAntrean}). Satu pelanggan hanya boleh memegang satu antrean aktif per hari.`,
        };
      }

      // Cek bentrok dengan booking aktif di hari ini
      const est = this.getQueueEstimation(state, todayStr);
      const estimatedServiceStartMs =
        nowMs + est.waitingList.length * est.rataRataDurasiMenit * 60_000;

      const conflictingBooking = state.bookings.find((b) => {
        if (b.tanggal !== todayStr || b.customerId !== customer.id) return false;
        if (b.status === 'In-Service') return true;
        if (b.status !== 'Booked') return false;
        const slotMs = parseSlotEpochMs(b.tanggal, b.jamSlot);
        return Math.abs(estimatedServiceStartMs - slotMs) < 60 * 60_000;
      });

      if (conflictingBooking) {
        return {
          ok: false,
          errorCode: 'SCHEDULE_CONFLICT',
          message: `Waktu perkiraan walk-in bentrok dengan jadwal booking aktif Anda pukul ${conflictingBooking.jamSlot} WIB (${conflictingBooking.kodeTiket}).`,
        };
      }
    }

    const quota = this.getQuotaForDate(state, todayStr);
    if (quota.kuotaTerpakai >= quota.kuotaMaksimal) {
      return {
        ok: false,
        errorCode: 'QUOTA_FULL',
        message:
          'Kuota antrean walk-in hari ini sudah penuh. Silakan lakukan booking untuk hari berikutnya.',
      };
    }

    // Hitung nomor urut tertinggi hari ini agar tidak pernah duplikat atau tertukar
    const todayItems = state.walkinQueue.filter((q) => q.tanggal === todayStr);
    const maxSeq = todayItems.reduce((max, item) => {
      const num = parseInt(item.nomorAntrean.replace(/\D/g, ''), 10);
      return Number.isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const nextSeq = maxSeq + 1;
    const nomorAntrean = `A${String(nextSeq).padStart(3, '0')}`;

    const newTicket: DataAntreanWalkin = {
      id: `wk-${todayStr}-${nextSeq}-${Math.random().toString(36).slice(2, 6)}`,
      nomorAntrean,
      tanggal: todayStr,
      customerId: customer?.id,
      namaPelanggan: customer?.nama || params.namaPelanggan?.trim() || undefined,
      nomorWhatsApp: customer?.nomorWhatsApp || params.nomorWhatsApp,
      waktuAmbil: nowMs,
      status: 'Waiting',
      capsterId: params.capsterId || customer?.capsterFavoritId || undefined,
    };

    const nextQuota: DataKuotaAntrean = {
      tanggal: todayStr,
      kuotaMaksimal: quota.kuotaMaksimal,
      kuotaTerpakai: quota.kuotaTerpakai + 1,
    };

    const nextState = this.writeRaw({
      ...state,
      walkinQueue: [...state.walkinQueue, newTicket],
      quotas: {
        ...state.quotas,
        [todayStr]: nextQuota,
      },
    });

    this.setCustomerWalkinId(newTicket.id);

    const est = this.getQueueEstimation(nextState, todayStr);
    const antreanDiDepan = Math.max(
      0,
      est.waitingList.findIndex((w) => w.id === newTicket.id)
    );
    const estimasiMenit = antreanDiDepan * est.rataRataDurasiMenit;

    return {
      ok: true,
      data: {
        ticket: newTicket,
        antreanDiDepan,
        estimasiMenit,
        state: nextState,
      },
    };
  }

  public cancelCustomerWalkin(
    walkinId: string,
    customerId: string
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const target = state.walkinQueue.find((w) => w.id === walkinId);
    if (!target || target.customerId !== customerId) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Antrean tidak ditemukan pada akun Anda.',
      };
    }
    if (target.status !== 'Waiting') {
      return {
        ok: false,
        errorCode: 'INVALID_STATE',
        message: 'Hanya antrean berstatus Waiting yang dapat dibatalkan.',
      };
    }
    const nextState = this.writeRaw({
      ...state,
      walkinQueue: state.walkinQueue.map((w) =>
        w.id === walkinId ? { ...w, status: 'Canceled' as const } : w
      ),
    });
    return { ok: true, data: nextState };
  }

  // =========================================================================
  // UC-04: BUAT, RESCHEDULE & BATALKAN BOOKING PELANGGAN
  // =========================================================================
  public createBooking(params: {
    customerId?: string;
    capsterId: string;
    tanggal: string;
    jamSlot: string;
    nama: string;
    nomorWhatsApp: string;
  }): ServiceResult<{
    booking: DataBooking;
    state: BarberDatabaseState;
  }> {
    const state = this.syncAndGetState();
    const customer = params.customerId
      ? state.customers.find((c) => c.id === params.customerId)
      : undefined;

    const finalNama = (customer?.nama || params.nama).trim();
    const finalRawPhone = customer?.nomorWhatsApp || params.nomorWhatsApp;

    if (finalNama.length < 2) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Nama lengkap wajib diisi (minimal 2 karakter).',
      };
    }

    const waCheck = validateIndonesianWhatsApp(finalRawPhone);
    if (!waCheck.valid) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: waCheck.error,
      };
    }

    const nowMs = getEffectiveNowMs(state);
    const todayStr = formatDateYYYYMMDD(new Date(nowMs));

    // Cek bentrok jika pelanggan sudah punya walk-in aktif hari ini pada jam yang berdekatan
    if (customer && params.tanggal === todayStr) {
      const activeWalkin = state.walkinQueue.find(
        (w) =>
          w.tanggal === todayStr &&
          w.customerId === customer.id &&
          (w.status === 'Waiting' || w.status === 'In-Service')
      );
      if (activeWalkin) {
        const est = this.getQueueEstimation(state, todayStr);
        const posIdx = est.waitingList.findIndex(
          (w) => w.id === activeWalkin.id
        );
        const estServiceMs =
          activeWalkin.status === 'In-Service'
            ? nowMs
            : nowMs +
              Math.max(0, posIdx) * est.rataRataDurasiMenit * 60_000;
        const requestedSlotMs = parseSlotEpochMs(params.tanggal, params.jamSlot);
        if (Math.abs(requestedSlotMs - estServiceMs) < 60 * 60_000) {
          return {
            ok: false,
            errorCode: 'SCHEDULE_CONFLICT',
            message: `Slot pukul ${params.jamSlot} WIB berdekatan dengan perkiraan giliran walk-in aktif Anda (${activeWalkin.nomorAntrean}). Pilih jam lebih akhir atau batalkan walk-in terlebih dahulu.`,
          };
        }
      }
    }

    const { config, slots } = this.getComputedSlots(
      state,
      params.capsterId,
      params.tanggal
    );

    if (config.isLibur) {
      return {
        ok: false,
        errorCode: 'CAPSTER_OFF',
        message:
          'Capster tidak beroperasi pada tanggal ini. Silakan pilih capster atau tanggal lain.',
      };
    }

    const targetSlot = slots.find((s) => s.jam === params.jamSlot);
    if (!targetSlot || targetSlot.status !== 'Available') {
      return {
        ok: false,
        errorCode: 'SLOT_TAKEN',
        message:
          'Maaf, slot jam tersebut baru saja terisi atau sudah tidak tersedia. Silakan pilih slot lain yang masih hijau (Available).',
      };
    }

    const compactDate = params.tanggal.replace(/-/g, '');
    const sameDateCount = state.bookings.filter(
      (b) => b.tanggal === params.tanggal
    ).length;
    const kodeTiket = `BK-${compactDate}-${String(sameDateCount + 1).padStart(
      3,
      '0'
    )}`;

    const newBooking: DataBooking = {
      id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kodeTiket,
      customerId: customer?.id,
      nama: finalNama,
      nomorWhatsApp: waCheck.normalized,
      capsterId: params.capsterId,
      tanggal: params.tanggal,
      jamSlot: params.jamSlot,
      status: 'Booked',
      alasanBatal: null,
      waktuDibuat: nowMs,
    };

    const nextState = this.writeRaw({
      ...state,
      bookings: [...state.bookings, newBooking],
    });

    this.setCustomerBookingCode(newBooking.kodeTiket);

    return {
      ok: true,
      data: {
        booking: newBooking,
        state: nextState,
      },
    };
  }

  public rescheduleBooking(params: {
    bookingId: string;
    customerId: string;
    newCapsterId: string;
    newTanggal: string;
    newJamSlot: string;
  }): ServiceResult<{ booking: DataBooking; state: BarberDatabaseState }> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const existing = state.bookings.find((b) => b.id === params.bookingId);

    if (!existing || existing.customerId !== params.customerId) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Booking tidak ditemukan pada akun Anda.',
      };
    }

    if (existing.status !== 'Booked') {
      return {
        ok: false,
        errorCode: 'INVALID_STATE',
        message: 'Hanya booking berstatus Booked yang dapat diubah jadwalnya.',
      };
    }

    const oldSlotMs = parseSlotEpochMs(existing.tanggal, existing.jamSlot);
    if (nowMs > oldSlotMs - RESCHEDULE_MIN_LEAD_MINUTES * 60_000) {
      return {
        ok: false,
        errorCode: 'RESCHEDULE_TOO_LATE',
        message:
          'Ubah jadwal hanya diperbolehkan minimal 60 menit sebelum jam slot dimulai.',
      };
    }

    const { config, slots } = this.getComputedSlots(
      state,
      params.newCapsterId,
      params.newTanggal
    );
    if (config.isLibur) {
      return {
        ok: false,
        errorCode: 'CAPSTER_OFF',
        message: 'Capster tidak beroperasi pada tanggal yang dipilih.',
      };
    }

    const targetSlot = slots.find((s) => s.jam === params.newJamSlot);
    if (!targetSlot || targetSlot.status !== 'Available') {
      return {
        ok: false,
        errorCode: 'SLOT_TAKEN',
        message:
          'Slot tujuan baru saja terisi atau tidak tersedia. Silakan pilih slot hijau lainnya.',
      };
    }

    const updatedBooking: DataBooking = {
      ...existing,
      capsterId: params.newCapsterId,
      tanggal: params.newTanggal,
      jamSlot: params.newJamSlot,
    };

    const nextState = this.writeRaw({
      ...state,
      bookings: state.bookings.map((b) =>
        b.id === existing.id ? updatedBooking : b
      ),
    });

    return {
      ok: true,
      data: { booking: updatedBooking, state: nextState },
    };
  }

  public cancelCustomerBooking(
    bookingId: string,
    customerId: string
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const target = state.bookings.find((b) => b.id === bookingId);
    if (!target || target.customerId !== customerId) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Booking tidak ditemukan pada akun Anda.',
      };
    }
    if (target.status !== 'Booked') {
      return {
        ok: false,
        errorCode: 'INVALID_STATE',
        message: 'Hanya booking berstatus Booked yang dapat dibatalkan.',
      };
    }
    const nextState = this.writeRaw({
      ...state,
      bookings: state.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: 'Canceled' as const,
              alasanBatal: 'manual' as const,
            }
          : b
      ),
    });
    return { ok: true, data: nextState };
  }

  // =========================================================================
  // UC-05: AKSI CAPSTER
  // =========================================================================

  public callWalkin(
    walkinId: string,
    capsterId: string
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const target = state.walkinQueue.find((w) => w.id === walkinId);
    if (!target) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Antrean tidak ditemukan.',
      };
    }
    if (target.status !== 'Waiting') {
      return {
        ok: false,
        errorCode: 'INVALID_STATE',
        message: 'Hanya antrean berstatus Waiting yang dapat dipanggil.',
      };
    }

    const updated = state.walkinQueue.map((w) =>
      w.id === walkinId
        ? {
            ...w,
            status: 'In-Service' as const,
            capsterId: capsterId || w.capsterId,
            waktuMulai: nowMs,
          }
        : w
    );

    const nextState = this.writeRaw({
      ...state,
      walkinQueue: updated,
    });
    return { ok: true, data: nextState };
  }

  public completeWalkin(
    walkinId: string,
    overrideDurationMinutes?: number
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const target = state.walkinQueue.find((w) => w.id === walkinId);
    if (!target) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Antrean tidak ditemukan.',
      };
    }
    if (target.status !== 'In-Service') {
      return {
        ok: false,
        errorCode: 'INVALID_STATE',
        message: 'Layanan harus berstatus In-Service sebelum diselesaikan.',
      };
    }

    const elapsedMin = target.waktuMulai
      ? Math.max(1, Math.round((nowMs - target.waktuMulai) / 60_000))
      : DEFAULT_DURATION_MINUTES;
    const durasiAktual =
      typeof overrideDurationMinutes === 'number' && overrideDurationMinutes > 0
        ? Math.round(overrideDurationMinutes)
        : elapsedMin;

    const updated = state.walkinQueue.map((w) =>
      w.id === walkinId
        ? {
            ...w,
            status: 'Selesai' as const,
            waktuSelesai: nowMs,
            durasiAktual,
          }
        : w
    );

    const nextState = this.writeRaw({
      ...state,
      walkinQueue: updated,
    });
    return { ok: true, data: nextState };
  }

  public cancelWalkin(walkinId: string): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const updated = state.walkinQueue.map((w) =>
      w.id === walkinId && w.status === 'Waiting'
        ? { ...w, status: 'Canceled' as const }
        : w
    );
    const nextState = this.writeRaw({ ...state, walkinQueue: updated });
    return { ok: true, data: nextState };
  }

  public startBookingService(
    bookingId: string
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const target = state.bookings.find((b) => b.id === bookingId);
    if (!target) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Booking tidak ditemukan.',
      };
    }
    if (target.status !== 'Booked') {
      return {
        ok: false,
        errorCode: 'INVALID_STATE',
        message: 'Booking harus berstatus Booked untuk diproses.',
      };
    }

    const updated = state.bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            status: 'In-Service' as const,
            waktuMulai: nowMs,
          }
        : b
    );
    const nextState = this.writeRaw({ ...state, bookings: updated });
    return { ok: true, data: nextState };
  }

  public completeBooking(
    bookingId: string,
    overrideDurationMinutes?: number
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const target = state.bookings.find((b) => b.id === bookingId);
    if (!target) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Booking tidak ditemukan.',
      };
    }
    if (target.status !== 'In-Service') {
      return {
        ok: false,
        errorCode: 'INVALID_STATE',
        message: 'Booking harus berstatus In-Service sebelum diselesaikan.',
      };
    }

    const elapsedMin = target.waktuMulai
      ? Math.max(1, Math.round((nowMs - target.waktuMulai) / 60_000))
      : DEFAULT_DURATION_MINUTES;
    const durasiAktual =
      typeof overrideDurationMinutes === 'number' && overrideDurationMinutes > 0
        ? Math.round(overrideDurationMinutes)
        : elapsedMin;

    const updated = state.bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            status: 'Selesai' as const,
            waktuSelesai: nowMs,
            durasiAktual,
          }
        : b
    );
    const nextState = this.writeRaw({ ...state, bookings: updated });
    return { ok: true, data: nextState };
  }

  public cancelBookingManual(
    bookingId: string
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const target = state.bookings.find((b) => b.id === bookingId);
    if (!target) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Booking tidak ditemukan.',
      };
    }
    if (target.status !== 'Booked') {
      return {
        ok: false,
        errorCode: 'INVALID_STATE',
        message: 'Hanya booking aktif yang dapat dibatalkan.',
      };
    }
    const updated = state.bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            status: 'Canceled' as const,
            alasanBatal: 'manual' as const,
          }
        : b
    );
    const nextState = this.writeRaw({ ...state, bookings: updated });
    return { ok: true, data: nextState };
  }

  public updateDailyQuota(
    tanggal: string,
    kuotaMaksimal: number
  ): BarberDatabaseState {
    const state = this.syncAndGetState();
    const current = this.getQuotaForDate(state, tanggal);
    const safeMax = Math.max(0, Math.min(200, Math.round(kuotaMaksimal)));
    return this.writeRaw({
      ...state,
      quotas: {
        ...state.quotas,
        [tanggal]: {
          ...current,
          kuotaMaksimal: safeMax,
        },
      },
    });
  }

  public updateCapsterSchedule(params: {
    capsterId: string;
    tanggal: string;
    buka: string;
    tutup: string;
    isLibur: boolean;
    alasanLibur?: string;
    slotPenuhManual?: string[];
    applyHoursAsDefault?: boolean;
  }): BarberDatabaseState {
    const state = this.syncAndGetState();
    const key = `${params.capsterId}_${params.tanggal}`;
    const existing = this.getScheduleConfig(
      state,
      params.capsterId,
      params.tanggal
    );

    const updatedConfig: DataJadwalSlotCapster = {
      ...existing,
      jamKerja: { buka: params.buka, tutup: params.tutup },
      isLibur: params.isLibur,
      alasanLibur: params.isLibur
        ? params.alasanLibur || 'Libur / Izin'
        : undefined,
      slotPenuhManual: params.slotPenuhManual ?? existing.slotPenuhManual,
    };

    const nextDefaultJamKerja = params.applyHoursAsDefault
      ? {
          ...state.defaultJamKerja,
          [params.capsterId]: { buka: params.buka, tutup: params.tutup },
        }
      : state.defaultJamKerja;

    return this.writeRaw({
      ...state,
      schedules: {
        ...state.schedules,
        [key]: updatedConfig,
      },
      defaultJamKerja: nextDefaultJamKerja,
    });
  }

  public toggleManualFullSlot(
    capsterId: string,
    tanggal: string,
    jam: string
  ): BarberDatabaseState {
    const state = this.syncAndGetState();
    const existing = this.getScheduleConfig(state, capsterId, tanggal);
    const has = existing.slotPenuhManual.includes(jam);
    const nextManual = has
      ? existing.slotPenuhManual.filter((h) => h !== jam)
      : [...existing.slotPenuhManual, jam];
    return this.updateCapsterSchedule({
      capsterId,
      tanggal,
      buka: existing.jamKerja.buka,
      tutup: existing.jamKerja.tutup,
      isLibur: existing.isLibur,
      alasanLibur: existing.alasanLibur,
      slotPenuhManual: nextManual,
    });
  }

  // Kontrol Simulasi Waktu Demo
  public advanceSimulatedMinutes(minutes: number): BarberDatabaseState {
    const state = this.readRaw();
    const updated = this.writeRaw({
      ...state,
      extraOffsetMinutes: state.extraOffsetMinutes + minutes,
    });
    return this.syncAndGetState() || updated;
  }

  public toggleUseRealClock(useReal: boolean): BarberDatabaseState {
    const state = this.readRaw();
    const updated = this.writeRaw({
      ...state,
      useRealClock: useReal,
      extraOffsetMinutes: 0,
    });
    return this.syncAndGetState() || updated;
  }

  public resetDemoData(): BarberDatabaseState {
    const seed = createSeedData();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      window.localStorage.removeItem(CUSTOMER_SESSION_ID_KEY);
      window.localStorage.removeItem(CUSTOMER_WALKIN_ID_KEY);
      window.localStorage.removeItem(CUSTOMER_BOOKING_CODE_KEY);
    }
    return seed;
  }

  // Session & Active Ticket Helpers
  public getCustomerSessionId(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(CUSTOMER_SESSION_ID_KEY);
  }

  public setCustomerSessionId(id: string | null): void {
    if (typeof window === 'undefined') return;
    if (id) {
      window.localStorage.setItem(CUSTOMER_SESSION_ID_KEY, id);
    } else {
      window.localStorage.removeItem(CUSTOMER_SESSION_ID_KEY);
    }
  }

  public getCustomerWalkinId(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(CUSTOMER_WALKIN_ID_KEY);
  }

  public setCustomerWalkinId(id: string | null): void {
    if (typeof window === 'undefined') return;
    if (id) {
      window.localStorage.setItem(CUSTOMER_WALKIN_ID_KEY, id);
    } else {
      window.localStorage.removeItem(CUSTOMER_WALKIN_ID_KEY);
    }
  }

  public getCustomerBookingCode(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(CUSTOMER_BOOKING_CODE_KEY);
  }

  public setCustomerBookingCode(code: string | null): void {
    if (typeof window === 'undefined') return;
    if (code) {
      window.localStorage.setItem(CUSTOMER_BOOKING_CODE_KEY, code);
    } else {
      window.localStorage.removeItem(CUSTOMER_BOOKING_CODE_KEY);
    }
  }

  public getCapsterSession(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(CAPSTER_SESSION_KEY);
  }

  public setCapsterSession(capsterId: string | null): void {
    if (typeof window === 'undefined') return;
    if (capsterId) {
      window.localStorage.setItem(CAPSTER_SESSION_KEY, capsterId);
    } else {
      window.localStorage.removeItem(CAPSTER_SESSION_KEY);
    }
  }
}

export const barberService = new BarberLocalStorageService();
