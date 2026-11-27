import {
  addDaysWib,
  DEFAULT_DURATION_MINUTES,
  formatDateIndoWib,
  formatShortDateIndoWib,
  generateHourSlots,
  getOperationalHoursForDate,
  getOperationalSessionKey,
  getShopOperationalStatus,
  getWibParts,
  LATE_TOLERANCE_MINUTES,
  parseWibEpochMs,
  RESCHEDULE_MIN_LEAD_MINUTES,
  WALKIN_DAILY_QUOTA,
} from './barbershop-config';
import {
  calculateServicesPricing,
  findServiceItemById,
  getInitialSystemPromos,
  isPromoActiveNow,
} from './services-catalog';
import {
  CapsterProfile,
  getInitialCapsterProfile,
  normalizeWaToLocal08,
  validateInstagramHandle,
} from './capster-profile';
import {
  BarberDatabaseState,
  Capster,
  ComputedSlotInfo,
  Customer,
  DataAntreanWalkin,
  DataBooking,
  DataJadwalSlotCapster,
  DataKuotaAntrean,
  InServiceDetail,
  ManualSlotEntry,
  Promo,
  QueueEstimationSummary,
  SelectedServiceInput,
  ServiceResult,
  SessionRole,
  SlotStatus,
} from './types';

export const STORAGE_VERSION = 6;
const STORAGE_KEY = 'wib_barbershop_state_v6';
const V5_STORAGE_KEY = 'wib_barbershop_state_v5';
const V4_STORAGE_KEY = 'wib_barbershop_state_v4';
const LEGACY_STORAGE_KEYS = [
  'wib_barbershop_state_v1',
  'wib_barbershop_state_v2',
  'wib_barbershop_state_v3',
  'wib_customer_walkin_id',
  'wib_customer_booking_code',
];

const SESSION_ROLE_KEY = 'wib_session_role';
const CUSTOMER_SESSION_ID_KEY = 'wib_customer_session_id';
const CAPSTER_SESSION_ID_KEY = 'wib_capster_session_id';

/**
 * CATATAN MIGRASI:
 * Autentikasi capster menggunakan Firebase Authentication.
 * Autentikasi pelanggan pada service legacy ini masih menyimpan hash password
 * dan data bisnis di localStorage. Jangan gunakan pola ini sebagai keamanan
 * produksi; migrasikan pelanggan ke Firebase Auth dan data operasional ke Firestore.
 */
export function hashPasswordDemo(password: string): string {
  const salted = `wib_barber_salt_2026::${password}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i + 1) * 31;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `wib_h1_${part1}${part2}`;
}

// Konfigurasi sistem awal: satu akun capster untuk Hasan (di-seed otomatis meski localStorage kosong).
// Password capster dikelola oleh Firebase Authentication.
// Catatan produksi: manajemen kredensial capster & sesi WAJIB memakai backend / Firebase Auth.
const SYSTEM_CAPSTERS: Capster[] = [
  {
    id: 'hasan',
    nama: 'Hasan',
    gelar: 'Capster Senior',
    spesialisasi: 'Classic Taper, Pompadour & Rapikan Jenggot',
    pengalaman: '2 tahun pengalaman menjadi capster di Waktu Indonesia Bercukur',
    username: 'hasan',
    passwordHash: hashPasswordDemo('LOCAL_CAPSTER_LOGIN_DISABLED_USE_FIREBASE_AUTH'),
    fotoKey: 'hasan',
  },
];

function mergeSystemCapsters(
  _persistedCapsters: Capster[] | undefined,
  profile: CapsterProfile
): Capster[] {
  return SYSTEM_CAPSTERS.map((sysCapster) => {
    const base: Capster = {
      ...sysCapster,
      username: sysCapster.username.trim().toLowerCase(),
    };

    if (base.id === profile.capsterId) {
      return {
        ...base,
        nama: profile.nama || base.nama,
        gelar: profile.gelar || base.gelar,
        pengalaman: profile.pengalaman || base.pengalaman,
      };
    }
    return base;
  });
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

export function maskCustomerName(name?: string): string {
  const clean = name?.trim();
  if (!clean) return 'Tamu';
  if (clean.length <= 2) return `${clean.charAt(0)}***`;
  return `${clean.slice(0, 2)}***`;
}

export function formatTimeWibHHMM(epochMs: number): string {
  return getWibParts(epochMs).hhmm;
}

export function formatDateIndo(dateStr: string): string {
  return formatDateIndoWib(dateStr);
}

export function formatShortDateIndo(dateStr: string): string {
  return formatShortDateIndoWib(dateStr);
}

export function addDaysYYYYMMDD(baseDateStr: string, days: number): string {
  return addDaysWib(baseDateStr, days);
}

export function parseSlotEpochMs(tanggal: string, jamSlot: string): number {
  return parseWibEpochMs(tanggal, jamSlot);
}

export function createInitialSystemState(): BarberDatabaseState {
  const initialProfile = getInitialCapsterProfile();
  return {
    version: STORAGE_VERSION,
    capsters: mergeSystemCapsters(undefined, initialProfile),
    capsterProfile: initialProfile,
    customers: [],
    walkinQueue: [],
    quotas: {},
    schedules: {},
    bookings: [],
    promos: getInitialSystemPromos(),
    lastUpdatedAt: Date.now(),
  };
}

function migratePromosToV5(existingPromos?: Promo[]): Promo[] {
  const systemDefaults = getInitialSystemPromos();
  const potSajaDefault = systemDefaults[0];
  if (!Array.isArray(existingPromos) || existingPromos.length === 0) {
    return systemDefaults;
  }
  const hasPotongSaja = existingPromos.some((p) => p.id === 'promo-potong-saja');
  const upgraded = existingPromos.map((p) =>
    p.id === 'promo-potong-saja'
      ? {
          ...p,
          diskonMin: potSajaDefault.diskonMin,
          diskonMax: potSajaDefault.diskonMax,
          deskripsi: potSajaDefault.deskripsi,
          layananId:
            Array.isArray(p.layananId) && p.layananId.length > 0
              ? p.layananId
              : potSajaDefault.layananId,
          diperbaruiPada: Date.now(),
        }
      : p
  );
  return hasPotongSaja ? upgraded : [potSajaDefault, ...upgraded];
}

class BarberLocalStorageService {
  private memoryState: BarberDatabaseState = createInitialSystemState();

  private readRaw(): BarberDatabaseState {
    return this.memoryState;
  }

  private writeRaw(state: BarberDatabaseState): BarberDatabaseState {
    const profile: CapsterProfile = {
      ...getInitialCapsterProfile(),
      ...(state.capsterProfile || {}),
    };
    const nextState: BarberDatabaseState = {
      ...state,
      version: STORAGE_VERSION,
      capsterProfile: profile,
      capsters: mergeSystemCapsters(state.capsters, profile),
      promos: Array.isArray(state.promos) ? state.promos : getInitialSystemPromos(),
      lastUpdatedAt: Date.now(),
    };
    this.memoryState = nextState;
    return nextState;
  }

  public getSessionRole(): SessionRole {
    return null;
  }

  public getCustomerSessionId(): string | null {
    return null;
  }

  public getCapsterSessionId(): string | null {
    return null;
  }

  private requireCapsterRole(): ServiceResult<Capster> {
    const role = this.getSessionRole();
    const capsterId = this.getCapsterSessionId();
    if (role !== 'capster' || !capsterId) {
      return {
        ok: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Halaman dan aksi ini khusus capster.',
      };
    }
    const state = this.readRaw();
    const capster = state.capsters.find((c) => c.id === capsterId);
    if (!capster) {
      return {
        ok: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Sesi capster tidak valid.',
      };
    }
    return { ok: true, data: capster };
  }

  /**
   * Evaluasi berkala waktu nyata WIB:
   * 1) Booking terlambat > 15 menit -> otomatis Canceled ('otomatis')
   * 2) Antrean walk-in Waiting dari hari operasional sebelumnya -> otomatis Kedaluwarsa
   */
  public syncAndGetState(): BarberDatabaseState {
    const state = this.readRaw();
    const nowMs = Date.now();
    const activeSessionKey = getOperationalSessionKey(nowMs);
    let changed = false;

    const updatedBookings = state.bookings.map((b) => {
      if (b.status !== 'Booked') return b;
      const slotMs = parseWibEpochMs(b.tanggal, b.jamSlot);
      const deadlineMs = slotMs + LATE_TOLERANCE_MINUTES * 60_000;
      if (nowMs > deadlineMs) {
        changed = true;
        return {
          ...b,
          status: 'Canceled' as const,
          alasanBatal: 'otomatis' as const,
          catatanBatal: 'Terlambat melewati batas toleransi 15 menit',
        };
      }
      return b;
    });

    const updatedWalkins = state.walkinQueue.map((w) => {
      if (w.status !== 'Waiting') return w;
      const itemKey = w.kunciHariOperasional || w.tanggal;
      // Kedaluwarsa jika bukan sesi operasional berjalan atau jam tutup hari tersebut sudah lewat
      const itemHours = getOperationalHoursForDate(itemKey);
      const itemCloseMs = parseWibEpochMs(itemKey, itemHours.tutup);
      if (itemKey < activeSessionKey || nowMs >= itemCloseMs) {
        changed = true;
        return {
          ...w,
          status: 'Kedaluwarsa' as const,
        };
      }
      return w;
    });

    if (changed) {
      return this.writeRaw({
        ...state,
        bookings: updatedBookings,
        walkinQueue: updatedWalkins,
      });
    }
    return state;
  }

  // =========================================================================
  // AUTH PELANGGAN & AUTH CAPSTER (TERPISAH KETAT)
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

    const validCapster = SYSTEM_CAPSTERS.find(
      (c) => c.id === params.capsterFavoritId
    )
      ? params.capsterFavoritId
      : SYSTEM_CAPSTERS[0]?.id;

    const newCustomer: Customer = {
      id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nama: namaTrim,
      nomorWhatsApp: waCheck.normalized,
      email: emailCheck.cleaned,
      passwordHash: hashPasswordDemo(params.password),
      capsterFavoritId: validCapster,
      dibuatPada: Date.now(),
    };

    const nextState = this.writeRaw({
      ...state,
      customers: [...state.customers, newCustomer],
    });
    this.setCustomerSession(newCustomer.id);

    return {
      ok: true,
      data: { customer: newCustomer, state: nextState },
    };
  }

  public loginCustomer(
    nomorWhatsApp: string,
    password: string
  ): ServiceResult<{ customer: Customer; state: BarberDatabaseState }> {
    if (this.getSessionRole() === 'capster') {
      return {
        ok: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Akun ini bukan akun pelanggan.',
      };
    }

    const state = this.syncAndGetState();
    const trimmedInput = nomorWhatsApp.trim().toLowerCase();
    if (
      state.capsters.some(
        (c) => c.username.trim().toLowerCase() === trimmedInput
      )
    ) {
      return {
        ok: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Akun ini bukan akun pelanggan.',
      };
    }

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

    this.setCustomerSession(customer.id);
    return {
      ok: true,
      data: { customer, state },
    };
  }

  public logoutCustomer(): void {
    // Session pelanggan sekarang dikelola Firebase Authentication.
  }

  private setCustomerSession(_customerId: string): void {
    // No-op: sesi pelanggan tidak disimpan di browser storage.
  }


  public getCurrentCustomer(state?: BarberDatabaseState): Customer | null {
    if (this.getSessionRole() !== 'pelanggan') return null;
    const id = this.getCustomerSessionId();
    if (!id) return null;
    const current = state || this.readRaw();
    return current.customers.find((c) => c.id === id) || null;
  }

  public loginCapster(
    _username: string,
    _password: string
  ): ServiceResult<Capster> {
    return {
      ok: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Login capster harus menggunakan Firebase Authentication.',
    };
  }

  public activateCapsterSession(capsterId: string): ServiceResult<Capster> {
    const found = this.readRaw().capsters.find((capster) => capster.id === capsterId);
    return found
      ? { ok: true, data: found }
      : { ok: false, errorCode: 'NOT_FOUND', message: 'Data capster tidak ditemukan.' };
  }

  public logoutCapster(): void {
    // Session capster sekarang dikelola Firebase Authentication dan sessionStorage.
  }

  public getCurrentCapster(): Capster | null {
    if (this.getSessionRole() !== 'capster') return null;
    const id = this.getCapsterSessionId();
    if (!id) return null;
    const state = this.readRaw();
    return state.capsters.find((c) => c.id === id) || null;
  }

  public changeCapsterPassword(params: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok || !auth.data) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    if (!params.currentPassword) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Password saat ini wajib diisi.',
      };
    }

    if (
      hashPasswordDemo(params.currentPassword) !== auth.data.passwordHash
    ) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Password saat ini salah.',
      };
    }

    if (!params.newPassword || params.newPassword.length < 6) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Password baru wajib minimal 6 karakter.',
      };
    }

    if (params.newPassword !== params.confirmPassword) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Konfirmasi password baru tidak sama.',
      };
    }

    const state = this.syncAndGetState();
    const updatedHash = hashPasswordDemo(params.newPassword);
    const nextCapsters = state.capsters.map((c) =>
      c.id === auth.data!.id ? { ...c, passwordHash: updatedHash } : c
    );

    const nextState = this.writeRaw({
      ...state,
      capsters: nextCapsters,
    });
    return { ok: true, data: nextState };
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
      capsterFavoritId: params.capsterFavoritId || SYSTEM_CAPSTERS[0]?.id,
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
  // KUOTA, JADWAL & ESTIMASI (REAL-TIME WIB)
  // =========================================================================

  public getQuotaForOperationalDay(
    state: BarberDatabaseState,
    operationalDayKey: string
  ): DataKuotaAntrean {
    const existing = state.quotas[operationalDayKey];
    const countUsed = state.walkinQueue.filter(
      (q) =>
        (q.kunciHariOperasional || q.tanggal) === operationalDayKey &&
        q.status !== 'Canceled'
    ).length;

    return {
      tanggal: operationalDayKey,
      kuotaMaksimal: existing ? existing.kuotaMaksimal : WALKIN_DAILY_QUOTA,
      kuotaTerpakai: countUsed,
    };
  }

  public getSlotSpanHours(
    startJam: string,
    slotsNeeded: number,
    validHours: string[]
  ): string[] | null {
    const safeNeeded = Math.max(1, Math.round(slotsNeeded));
    const idx = validHours.indexOf(startJam);
    if (idx === -1 || idx + safeNeeded > validHours.length) {
      return null;
    }
    return validHours.slice(idx, idx + safeNeeded);
  }

  public getBookingCoveredSlots(booking: DataBooking): string[] {
    if (
      Array.isArray(booking.slotTercakup) &&
      booking.slotTercakup.length > 0
    ) {
      return booking.slotTercakup;
    }
    const opHours = getOperationalHoursForDate(booking.tanggal);
    const validHours = generateHourSlots(opHours.buka, opHours.tutup);
    const needed = booking.durasiTotalMenit
      ? Math.max(1, Math.ceil(booking.durasiTotalMenit / 60))
      : 1;
    return (
      this.getSlotSpanHours(booking.jamSlot, needed, validHours) || [
        booking.jamSlot,
      ]
    );
  }

  public canStartSlotFitDuration(
    slots: ComputedSlotInfo[],
    startJam: string,
    slotsNeeded: number
  ): { ok: boolean; coveredSlots: string[]; reason?: string } {
    const safeNeeded = Math.max(1, Math.round(slotsNeeded));
    const idx = slots.findIndex((s) => s.jam === startJam);
    if (idx === -1) {
      return { ok: false, coveredSlots: [], reason: 'Slot tidak ditemukan.' };
    }
    if (idx + safeNeeded > slots.length) {
      return {
        ok: false,
        coveredSlots: [],
        reason: `Durasi ${safeNeeded} slot melewati jam tutup toko.`,
      };
    }
    const span = slots.slice(idx, idx + safeNeeded);
    const blocked = span.find((s) => s.status !== 'Available');
    if (blocked) {
      return {
        ok: false,
        coveredSlots: span.map((s) => s.jam),
        reason: `Slot lanjutan pukul ${blocked.jam} WIB berstatus ${blocked.status}.`,
      };
    }
    return { ok: true, coveredSlots: span.map((s) => s.jam) };
  }

  public getScheduleConfig(
    state: BarberDatabaseState,
    capsterId: string,
    tanggal: string
  ): DataJadwalSlotCapster {
    const key = `${capsterId}_${tanggal}`;
    const existing = state.schedules[key];
    const defaultHours = getOperationalHoursForDate(tanggal);
    if (existing) {
      return {
        ...existing,
        jamKerja: {
          buka: defaultHours.buka,
          tutup: defaultHours.tutup,
        },
        manualSlots: existing.manualSlots || {},
      };
    }
    return {
      capsterId,
      tanggal,
      jamKerja: { buka: defaultHours.buka, tutup: defaultHours.tutup },
      isLibur: false,
      manualSlots: {},
    };
  }

  public getComputedSlots(
    state: BarberDatabaseState,
    capsterId: string,
    tanggal: string,
    excludeBookingId?: string
  ): {
    config: DataJadwalSlotCapster;
    slots: ComputedSlotInfo[];
  } {
    const config = this.getScheduleConfig(state, capsterId, tanggal);
    if (config.isLibur) {
      return { config, slots: [] };
    }
    const hours = generateHourSlots(config.jamKerja.buka, config.jamKerja.tutup);
    const nowMs = Date.now();

    const slots: ComputedSlotInfo[] = hours.map((jam) => {
      const slotEpoch = parseWibEpochMs(tanggal, jam);
      const activeBooking = state.bookings.find(
        (b) =>
          b.id !== excludeBookingId &&
          b.capsterId === capsterId &&
          b.tanggal === tanggal &&
          (b.status === 'Booked' || b.status === 'In-Service') &&
          this.getBookingCoveredSlots(b).includes(jam)
      );
      const manualEntry = config.manualSlots[jam];
      // Slot yang waktunya sudah lewat otomatis tidak bisa dipilih
      const sudahLewat = nowMs >= slotEpoch;

      let status: SlotStatus = 'Available';
      let sumber: ComputedSlotInfo['sumber'] = 'default';

      if (manualEntry?.tipe === 'tidak_tersedia') {
        status = 'Tidak Tersedia';
        sumber = 'tidak_tersedia';
      } else if (manualEntry?.tipe === 'terisi_manual') {
        status = 'Booked';
        sumber = 'terisi_manual';
      } else if (activeBooking) {
        status = activeBooking.status === 'In-Service' ? 'Full' : 'Booked';
        sumber = 'booking';
      } else if (sudahLewat) {
        status = 'Full';
        sumber = 'lewat';
      }

      return {
        capsterId,
        tanggal,
        jam,
        status,
        sumber,
        catatanManual: manualEntry?.catatan,
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
    operationalDayKey: string
  ): QueueEstimationSummary {
    const nowMs = Date.now();

    const completedWalkins = state.walkinQueue.filter(
      (q) =>
        (q.kunciHariOperasional || q.tanggal) === operationalDayKey &&
        q.status === 'Selesai' &&
        typeof q.durasiAktual === 'number' &&
        q.durasiAktual > 0
    );
    const completedBookings = state.bookings.filter(
      (b) =>
        b.tanggal === operationalDayKey &&
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
      .filter(
        (q) =>
          (q.kunciHariOperasional || q.tanggal) === operationalDayKey &&
          q.status === 'Waiting'
      )
      .sort((a, b) => a.waktuAmbil - b.waktuAmbil);

    const sedangDilayaniWalkin = state.walkinQueue
      .filter(
        (q) =>
          (q.kunciHariOperasional || q.tanggal) === operationalDayKey &&
          q.status === 'In-Service'
      )
      .sort(
        (a, b) =>
          (a.waktuMulai || a.waktuAmbil) - (b.waktuMulai || b.waktuAmbil)
      );

    const sedangDilayaniBooking = state.bookings
      .filter(
        (b) => b.tanggal === operationalDayKey && b.status === 'In-Service'
      )
      .sort(
        (a, b) =>
          (a.waktuMulai || a.waktuDibuat) - (b.waktuMulai || b.waktuDibuat)
      );

    const inServiceDetails: InServiceDetail[] = [
      ...sedangDilayaniWalkin.map((w) => {
        const startMs = w.waktuMulai || w.waktuAmbil;
        const lamaBerjalanMenit = Math.max(
          0,
          Math.floor((nowMs - startMs) / 60_000)
        );
        const sisaRaw = rataRataDurasiMenit - lamaBerjalanMenit;
        return {
          id: w.id,
          tipe: 'walkin' as const,
          kodeAtauNomor: w.nomorAntrean,
          namaTersamarkan: maskCustomerName(w.namaPelanggan),
          capsterId: w.capsterId,
          waktuMulai: startMs,
          jamMulaiHHMM: formatTimeWibHHMM(startMs),
          lamaBerjalanMenit,
          estimasiSisaMenit: Math.max(0, sisaRaw),
          melebihiEstimasi: sisaRaw <= 0,
        };
      }),
      ...sedangDilayaniBooking.map((b) => {
        const startMs = b.waktuMulai || b.waktuDibuat;
        const lamaBerjalanMenit = Math.max(
          0,
          Math.floor((nowMs - startMs) / 60_000)
        );
        const sisaRaw = rataRataDurasiMenit - lamaBerjalanMenit;
        return {
          id: b.id,
          tipe: 'booking' as const,
          kodeAtauNomor: b.kodeTiket,
          namaTersamarkan: maskCustomerName(b.nama),
          capsterId: b.capsterId,
          waktuMulai: startMs,
          jamMulaiHHMM: formatTimeWibHHMM(startMs),
          lamaBerjalanMenit,
          estimasiSisaMenit: Math.max(0, sisaRaw),
          melebihiEstimasi: sisaRaw <= 0,
        };
      }),
    ].sort((a, b) => a.waktuMulai - b.waktuMulai);

    // Sisa waktu pelanggan yang sedang In-Service (0 jika tidak ada)
    const sisaWaktuInServiceMenit =
      inServiceDetails.length > 0
        ? Math.min(...inServiceDetails.map((d) => d.estimasiSisaMenit))
        : 0;

    return {
      rataRataDurasiMenit,
      jumlahSelesaiHariIni,
      menggunakanDefault,
      sedangDilayaniWalkin,
      sedangDilayaniBooking,
      inServiceDetails,
      sisaWaktuInServiceMenit,
      waitingList,
    };
  }

  // =========================================================================
  // UC-01: AMBIL NOMOR ANTREAN WALK-IN
  // =========================================================================
  public takeWalkinQueue(params: {
    customerId?: string;
    capsterId?: string;
  }): ServiceResult<{
    ticket: DataAntreanWalkin;
    antreanDiDepan: number;
    estimasiMenit: number;
    state: BarberDatabaseState;
  }> {
    const state = this.syncAndGetState();
    const nowMs = Date.now();
    const shopStatus = getShopOperationalStatus(nowMs);

    if (!shopStatus.isOpen) {
      return {
        ok: false,
        errorCode: 'SHOP_CLOSED',
        message:
          shopStatus.closedMessage ||
          'Barbershop sedang tutup di luar jam operasional.',
      };
    }

    const opKey = shopStatus.operationalDayKey;
    const customer = params.customerId
      ? state.customers.find((c) => c.id === params.customerId)
      : this.getCurrentCustomer(state);

    if (!customer) {
      return {
        ok: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Silakan masuk ke akun pelanggan terlebih dahulu.',
      };
    }

    // Cek aturan: satu pelanggan hanya boleh punya SATU antrean walk-in aktif per hari operasional
    const existingActive = state.walkinQueue.find(
      (w) =>
        (w.kunciHariOperasional || w.tanggal) === opKey &&
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

    const estBefore = this.getQueueEstimation(state, opKey);
    const estWaitMs =
      (estBefore.sisaWaktuInServiceMenit +
        estBefore.waitingList.length * estBefore.rataRataDurasiMenit) *
      60_000;
    const estimatedServiceStartMs = nowMs + estWaitMs;

    const conflictingBooking = state.bookings.find((b) => {
      if (b.tanggal !== opKey || b.customerId !== customer.id) return false;
      if (b.status === 'In-Service') return true;
      if (b.status !== 'Booked') return false;
      const slotMs = parseWibEpochMs(b.tanggal, b.jamSlot);
      return Math.abs(estimatedServiceStartMs - slotMs) < 60 * 60_000;
    });

    if (conflictingBooking) {
      return {
        ok: false,
        errorCode: 'SCHEDULE_CONFLICT',
        message: `Waktu perkiraan walk-in bentrok dengan jadwal booking aktif Anda pukul ${conflictingBooking.jamSlot} WIB (${conflictingBooking.kodeTiket}).`,
      };
    }

    const quota = this.getQuotaForOperationalDay(state, opKey);
    if (quota.kuotaTerpakai >= quota.kuotaMaksimal) {
      return {
        ok: false,
        errorCode: 'QUOTA_FULL',
        message:
          'Kuota antrean walk-in hari ini sudah penuh. Silakan lakukan booking untuk hari berikutnya.',
      };
    }

    // Hitung nomor urut tertinggi pada kunciHariOperasional aktif (reset A001 tiap hari di jam buka)
    const todayItems = state.walkinQueue.filter(
      (q) => (q.kunciHariOperasional || q.tanggal) === opKey
    );
    const maxSeq = todayItems.reduce((max, item) => {
      const num = parseInt(item.nomorAntrean.replace(/\D/g, ''), 10);
      return Number.isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const nextSeq = maxSeq + 1;
    const nomorAntrean = `A${String(nextSeq).padStart(3, '0')}`;

    const chosenCapster =
      SYSTEM_CAPSTERS.find((c) => c.id === params.capsterId)?.id ||
      customer.capsterFavoritId ||
      SYSTEM_CAPSTERS[0]?.id;

    const newTicket: DataAntreanWalkin = {
      id: `wk-${opKey}-${nextSeq}-${Math.random().toString(36).slice(2, 6)}`,
      nomorAntrean,
      tanggal: opKey,
      kunciHariOperasional: opKey,
      customerId: customer.id,
      namaPelanggan: customer.nama,
      nomorWhatsApp: customer.nomorWhatsApp,
      waktuAmbil: nowMs,
      status: 'Waiting',
      capsterId: chosenCapster,
    };

    const nextQuota: DataKuotaAntrean = {
      tanggal: opKey,
      kuotaMaksimal: quota.kuotaMaksimal,
      kuotaTerpakai: quota.kuotaTerpakai + 1,
    };

    const nextState = this.writeRaw({
      ...state,
      walkinQueue: [...state.walkinQueue, newTicket],
      quotas: {
        ...state.quotas,
        [opKey]: nextQuota,
      },
    });

    const est = this.getQueueEstimation(nextState, opKey);
    const antreanDiDepan = Math.max(
      0,
      est.waitingList.findIndex((w) => w.id === newTicket.id)
    );
    const estimasiMenit =
      est.sisaWaktuInServiceMenit + antreanDiDepan * est.rataRataDurasiMenit;

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

    const opKey = target.kunciHariOperasional || target.tanggal;
    const quota = this.getQuotaForOperationalDay(state, opKey);

    const nextState = this.writeRaw({
      ...state,
      walkinQueue: state.walkinQueue.map((w) =>
        w.id === walkinId ? { ...w, status: 'Canceled' as const } : w
      ),
      quotas: {
        ...state.quotas,
        [opKey]: {
          ...quota,
          kuotaTerpakai: Math.max(0, quota.kuotaTerpakai - 1),
        },
      },
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
    selectedServices?: SelectedServiceInput[];
  }): ServiceResult<{
    booking: DataBooking;
    state: BarberDatabaseState;
  }> {
    const state = this.syncAndGetState();
    const customer = params.customerId
      ? state.customers.find((c) => c.id === params.customerId)
      : this.getCurrentCustomer(state);

    if (!customer) {
      return {
        ok: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Silakan masuk ke akun pelanggan terlebih dahulu.',
      };
    }

    const nowMs = Date.now();
    const todayStr = getWibParts(nowMs).dateStr;

    if (params.tanggal < todayStr) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Tidak dapat memilih tanggal yang sudah lewat.',
      };
    }

    const servicesInput: SelectedServiceInput[] =
      params.selectedServices !== undefined
        ? params.selectedServices
        : [{ itemId: 'premium-haircut', qty: 1 }];

    if (servicesInput.length === 0) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Pilih minimal satu layanan sebelum membuat booking.',
      };
    }

    const activePromos = this.getActivePromos(state, nowMs);
    const pricing = calculateServicesPricing(servicesInput, activePromos);
    if (pricing.lines.length === 0) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Layanan yang dipilih tidak valid.',
      };
    }

    const opHours = getOperationalHoursForDate(params.tanggal);
    const validHours = generateHourSlots(opHours.buka, opHours.tutup);
    if (!validHours.includes(params.jamSlot)) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: `Jam slot harus dalam jam operasional (${opHours.label}).`,
      };
    }

    const coveredSlots = this.getSlotSpanHours(
      params.jamSlot,
      pricing.slotsNeeded,
      validHours
    );
    if (!coveredSlots) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: `Durasi layanan (${pricing.durasiTotalMenit} menit / ${
          pricing.slotsNeeded
        } slot) melewati jam tutup operasional (${opHours.tutup.replace(
          ':',
          '.'
        )} WIB). Silakan pilih jam mulai lebih awal.`,
      };
    }

    const slotStartMs = parseWibEpochMs(params.tanggal, params.jamSlot);
    if (nowMs >= slotStartMs) {
      return {
        ok: false,
        errorCode: 'SLOT_TAKEN',
        message: 'Slot jam tersebut sudah terlewat. Silakan pilih slot berikutnya.',
      };
    }

    // Cek bentrok dengan walk-in aktif hari ini
    if (params.tanggal === todayStr) {
      const shopStatus = getShopOperationalStatus(nowMs);
      const activeWalkin = state.walkinQueue.find(
        (w) =>
          (w.kunciHariOperasional || w.tanggal) ===
            shopStatus.operationalDayKey &&
          w.customerId === customer.id &&
          (w.status === 'Waiting' || w.status === 'In-Service')
      );
      if (activeWalkin) {
        const est = this.getQueueEstimation(state, shopStatus.operationalDayKey);
        const posIdx = est.waitingList.findIndex(
          (w) => w.id === activeWalkin.id
        );
        const estServiceMs =
          activeWalkin.status === 'In-Service'
            ? nowMs
            : nowMs +
              (est.sisaWaktuInServiceMenit +
                Math.max(0, posIdx) * est.rataRataDurasiMenit) *
                60_000;
        const slotEndMs = slotStartMs + pricing.slotsNeeded * 60 * 60_000;
        if (
          estServiceMs >= slotStartMs - 60 * 60_000 &&
          estServiceMs < slotEndMs
        ) {
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
          'Capster tidak beroperasi pada tanggal ini. Silakan pilih tanggal lain.',
      };
    }

    const spanCheck = this.canStartSlotFitDuration(
      slots,
      params.jamSlot,
      pricing.slotsNeeded
    );
    if (!spanCheck.ok) {
      return {
        ok: false,
        errorCode: 'SLOT_TAKEN',
        message:
          spanCheck.reason ||
          'Maaf, slot jam tersebut baru saja terisi atau tidak cukup untuk durasi layanan yang dipilih.',
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
      customerId: customer.id,
      nama: customer.nama,
      nomorWhatsApp: customer.nomorWhatsApp,
      capsterId: params.capsterId,
      tanggal: params.tanggal,
      jamSlot: params.jamSlot,
      status: 'Booked',
      alasanBatal: null,
      waktuDibuat: nowMs,
      layananDipilih: pricing.lines,
      durasiTotalMenit: pricing.durasiTotalMenit,
      slotTercakup: coveredSlots,
      subtotalHarga: pricing.subtotalHarga,
      potonganMin: pricing.potonganMin,
      potonganMax: pricing.potonganMax,
      totalEstimasiMin: pricing.totalEstimasiMin,
      totalEstimasiMax: pricing.totalEstimasiMax,
      promoJudul: pricing.promoJudul,
    };

    const nextState = this.writeRaw({
      ...state,
      bookings: [...state.bookings, newBooking],
    });

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
    const nowMs = Date.now();
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

    const oldSlotMs = parseWibEpochMs(existing.tanggal, existing.jamSlot);
    if (nowMs > oldSlotMs - RESCHEDULE_MIN_LEAD_MINUTES * 60_000) {
      return {
        ok: false,
        errorCode: 'RESCHEDULE_TOO_LATE',
        message:
          'Ubah jadwal hanya diperbolehkan minimal 60 menit sebelum jam slot dimulai.',
      };
    }

    const slotsNeeded = existing.durasiTotalMenit
      ? Math.max(1, Math.ceil(existing.durasiTotalMenit / 60))
      : existing.slotTercakup?.length || 1;

    const opHours = getOperationalHoursForDate(params.newTanggal);
    const validHours = generateHourSlots(opHours.buka, opHours.tutup);
    const coveredSlots = this.getSlotSpanHours(
      params.newJamSlot,
      slotsNeeded,
      validHours
    );
    if (!coveredSlots) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: `Durasi booking (${slotsNeeded} slot) melewati jam tutup toko (${opHours.tutup.replace(
          ':',
          '.'
        )} WIB).`,
      };
    }

    const { config, slots } = this.getComputedSlots(
      state,
      params.newCapsterId,
      params.newTanggal,
      existing.id
    );
    if (config.isLibur) {
      return {
        ok: false,
        errorCode: 'CAPSTER_OFF',
        message: 'Capster tidak beroperasi pada tanggal yang dipilih.',
      };
    }

    const spanCheck = this.canStartSlotFitDuration(
      slots,
      params.newJamSlot,
      slotsNeeded
    );
    if (!spanCheck.ok) {
      return {
        ok: false,
        errorCode: 'SLOT_TAKEN',
        message:
          spanCheck.reason ||
          'Slot tujuan baru saja terisi atau tidak tersedia. Silakan pilih slot hijau lainnya.',
      };
    }

    const updatedBooking: DataBooking = {
      ...existing,
      capsterId: params.newCapsterId,
      tanggal: params.newTanggal,
      jamSlot: params.newJamSlot,
      slotTercakup: coveredSlots,
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
              catatanBatal: 'Dibatalkan oleh pelanggan',
            }
          : b
      ),
    });
    return { ok: true, data: nextState };
  }

  // =========================================================================
  // UC-05: AKSI KHUSUS CAPSTER (DILINDUNGI ROLE GUARD)
  // =========================================================================

  public callWalkin(
    walkinId: string,
    capsterId?: string
  ): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok || !auth.data) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const nowMs = Date.now();
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
            capsterId: capsterId || auth.data!.id,
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
    const auth = this.requireCapsterRole();
    if (!auth.ok) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const nowMs = Date.now();
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
    const auth = this.requireCapsterRole();
    if (!auth.ok) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const target = state.walkinQueue.find((w) => w.id === walkinId);
    if (!target) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Antrean tidak ditemukan.',
      };
    }
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
    const auth = this.requireCapsterRole();
    if (!auth.ok) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const nowMs = Date.now();
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
    const auth = this.requireCapsterRole();
    if (!auth.ok) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const nowMs = Date.now();
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
    const auth = this.requireCapsterRole();
    if (!auth.ok) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

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
            catatanBatal: 'Dibatalkan oleh capster (terlambat > 15 menit)',
          }
        : b
    );
    const nextState = this.writeRaw({ ...state, bookings: updated });
    return { ok: true, data: nextState };
  }

  public updateDailyQuota(
    operationalDayKey: string,
    kuotaMaksimal: number
  ): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const current = this.getQuotaForOperationalDay(state, operationalDayKey);
    const safeMax = Math.max(0, Math.min(200, Math.round(kuotaMaksimal)));
    const nextState = this.writeRaw({
      ...state,
      quotas: {
        ...state.quotas,
        [operationalDayKey]: {
          ...current,
          kuotaMaksimal: safeMax,
        },
      },
    });
    return { ok: true, data: nextState };
  }

  /**
   * Capster mengatur libur/izin satu hari penuh.
   * Jika ada booking aktif di tanggal tersebut dan forceCancelConflicts !== true,
   * mengembalikan BOOKING_CONFLICT agar capster membatalkannya secara eksplisit.
   */
  public setCapsterDayOff(params: {
    capsterId: string;
    tanggal: string;
    isLibur: boolean;
    alasanLibur?: string;
    forceCancelConflicts?: boolean;
  }): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const todayStr = getWibParts(Date.now()).dateStr;
    if (params.tanggal < todayStr) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Tanggal yang sudah lewat tidak dapat diubah.',
      };
    }

    const conflicts = params.isLibur
      ? state.bookings.filter(
          (b) =>
            b.capsterId === params.capsterId &&
            b.tanggal === params.tanggal &&
            (b.status === 'Booked' || b.status === 'In-Service')
        )
      : [];

    if (conflicts.length > 0 && !params.forceCancelConflicts) {
      return {
        ok: false,
        errorCode: 'BOOKING_CONFLICT',
        conflictBookings: conflicts,
        message: `Terdapat ${conflicts.length} booking pelanggan aktif pada tanggal ini. Batalkan booking tersebut secara eksplisit sebelum menandai hari libur.`,
      };
    }

    const conflictIds = new Set(conflicts.map((c) => c.id));
    const nextBookings =
      conflicts.length > 0
        ? state.bookings.map((b) =>
            conflictIds.has(b.id)
              ? {
                  ...b,
                  status: 'Canceled' as const,
                  alasanBatal: 'capster_tidak_tersedia' as const,
                  catatanBatal:
                    params.alasanLibur ||
                    'Capster menandai libur/izin pada tanggal ini',
                }
              : b
          )
        : state.bookings;

    const existing = this.getScheduleConfig(
      state,
      params.capsterId,
      params.tanggal
    );
    const key = `${params.capsterId}_${params.tanggal}`;

    const nextSchedule: DataJadwalSlotCapster = {
      ...existing,
      isLibur: params.isLibur,
      alasanLibur: params.isLibur
        ? params.alasanLibur?.trim() || 'Libur / Izin Capster'
        : undefined,
    };

    const nextState = this.writeRaw({
      ...state,
      bookings: nextBookings,
      schedules: {
        ...state.schedules,
        [key]: nextSchedule,
      },
    });
    return { ok: true, data: nextState };
  }

  /**
   * Capster menandai slot jam secara manual:
   * 'tersedia' (hapus override) | 'tidak_tersedia' | 'terisi_manual'
   * Jika ada booking pelanggan di slot tersebut dan hendak ditandai tidak tersedia / terisi manual,
   * kembalikan BOOKING_CONFLICT kecuali forceCancelConflict = true.
   */
  public setCapsterSlotManual(params: {
    capsterId: string;
    tanggal: string;
    jam: string;
    mode: 'tersedia' | 'tidak_tersedia' | 'terisi_manual';
    catatan?: string;
    forceCancelConflict?: boolean;
  }): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const todayStr = getWibParts(Date.now()).dateStr;
    if (params.tanggal < todayStr) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Tanggal yang sudah lewat tidak dapat diubah.',
      };
    }

    const activeBooking = state.bookings.find(
      (b) =>
        b.capsterId === params.capsterId &&
        b.tanggal === params.tanggal &&
        (b.status === 'Booked' || b.status === 'In-Service') &&
        this.getBookingCoveredSlots(b).includes(params.jam)
    );

    if (
      activeBooking &&
      params.mode !== 'tersedia' &&
      !params.forceCancelConflict
    ) {
      return {
        ok: false,
        errorCode: 'BOOKING_CONFLICT',
        conflictBookings: [activeBooking],
        message: `Slot ${params.jam} WIB sudah dibooking oleh ${activeBooking.nama} (${activeBooking.kodeTiket}). Konfirmasi pembatalan booking ini sebelum mengubah status slot.`,
      };
    }

    const nextBookings =
      activeBooking && params.forceCancelConflict
        ? state.bookings.map((b) =>
            b.id === activeBooking.id
              ? {
                  ...b,
                  status: 'Canceled' as const,
                  alasanBatal: 'capster_tidak_tersedia' as const,
                  catatanBatal:
                    params.mode === 'tidak_tersedia'
                      ? params.catatan || 'Slot ditandai tidak tersedia oleh capster'
                      : 'Slot dialihkan oleh capster',
                }
              : b
          )
        : state.bookings;

    const existing = this.getScheduleConfig(
      state,
      params.capsterId,
      params.tanggal
    );
    const key = `${params.capsterId}_${params.tanggal}`;
    const nextManualSlots: Record<string, ManualSlotEntry> = {
      ...existing.manualSlots,
    };

    if (params.mode === 'tersedia') {
      delete nextManualSlots[params.jam];
    } else {
      nextManualSlots[params.jam] = {
        tipe: params.mode,
        catatan: params.catatan?.trim() || undefined,
      };
    }

    const nextState = this.writeRaw({
      ...state,
      bookings: nextBookings,
      schedules: {
        ...state.schedules,
        [key]: {
          ...existing,
          manualSlots: nextManualSlots,
        },
      },
    });
    return { ok: true, data: nextState };
  }

  // =========================================================================
  // MANAJEMEN PROMO (PELANGGAN READ-ONLY, MUTASI KHUSUS CAPSTER)
  // =========================================================================

  public getActivePromos(
    state?: BarberDatabaseState,
    nowMs: number = Date.now()
  ): Promo[] {
    const current = state || this.readRaw();
    return (current.promos || []).filter((p) => isPromoActiveNow(p, nowMs));
  }

  private validatePromoPayload(params: {
    judul: string;
    deskripsi: string;
    layananId: string[];
    diskonMin: number;
    diskonMax: number;
    berlakuDari?: string;
    berlakuSampai?: string;
  }): ServiceResult<{
    judul: string;
    deskripsi: string;
    layananId: string[];
    diskonMin: number;
    diskonMax: number;
    berlakuDari?: string;
    berlakuSampai?: string;
  }> {
    const judul = params.judul.trim();
    if (judul.length < 3) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Judul promo wajib diisi minimal 3 karakter.',
      };
    }

    const validIds = Array.from(
      new Set(params.layananId.filter((id) => Boolean(findServiceItemById(id))))
    );
    if (validIds.length === 0) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Pilih minimal satu layanan yang mendapat promo.',
      };
    }

    const minVal = Math.round(Number(params.diskonMin));
    const maxVal = Math.round(Number(params.diskonMax));
    if (
      Number.isNaN(minVal) ||
      Number.isNaN(maxVal) ||
      minVal < 0 ||
      maxVal > 100 ||
      minVal > maxVal
    ) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message:
          'Persentase diskon harus berada di antara 0–100% dan diskon minimal tidak boleh melebihi diskon maksimal.',
      };
    }

    const dari = params.berlakuDari?.trim() || undefined;
    const sampai = params.berlakuSampai?.trim() || undefined;
    if (dari && sampai && dari > sampai) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message:
          'Tanggal mulai promo tidak boleh lebih akhir dari tanggal berakhir.',
      };
    }

    return {
      ok: true,
      data: {
        judul,
        deskripsi: params.deskripsi.trim(),
        layananId: validIds,
        diskonMin: minVal,
        diskonMax: maxVal,
        berlakuDari: dari,
        berlakuSampai: sampai,
      },
    };
  }

  public createPromo(params: {
    judul: string;
    deskripsi: string;
    layananId: string[];
    diskonMin: number;
    diskonMax: number;
    aktif: boolean;
    berlakuDari?: string;
    berlakuSampai?: string;
  }): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok || !auth.data) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const valid = this.validatePromoPayload(params);
    if (!valid.ok || !valid.data) {
      return { ok: false, errorCode: valid.errorCode, message: valid.message };
    }

    const state = this.syncAndGetState();
    const newPromo: Promo = {
      id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...valid.data,
      aktif: Boolean(params.aktif),
      diperbaruiOleh: auth.data.nama,
      diperbaruiPada: Date.now(),
    };

    const nextState = this.writeRaw({
      ...state,
      promos: [newPromo, ...(state.promos || [])],
    });
    return { ok: true, data: nextState };
  }

  public updatePromo(
    promoId: string,
    params: {
      judul: string;
      deskripsi: string;
      layananId: string[];
      diskonMin: number;
      diskonMax: number;
      aktif: boolean;
      berlakuDari?: string;
      berlakuSampai?: string;
    }
  ): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok || !auth.data) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const valid = this.validatePromoPayload(params);
    if (!valid.ok || !valid.data) {
      return { ok: false, errorCode: valid.errorCode, message: valid.message };
    }

    const state = this.syncAndGetState();
    const exists = (state.promos || []).some((p) => p.id === promoId);
    if (!exists) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Promo tidak ditemukan.',
      };
    }

    const nextPromos = (state.promos || []).map((p) =>
      p.id === promoId
        ? {
            ...p,
            ...valid.data!,
            aktif: Boolean(params.aktif),
            diperbaruiOleh: auth.data!.nama,
            diperbaruiPada: Date.now(),
          }
        : p
    );

    const nextState = this.writeRaw({
      ...state,
      promos: nextPromos,
    });
    return { ok: true, data: nextState };
  }

  public togglePromoActive(
    promoId: string
  ): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok || !auth.data) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const exists = (state.promos || []).some((p) => p.id === promoId);
    if (!exists) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Promo tidak ditemukan.',
      };
    }

    const nextPromos = (state.promos || []).map((p) =>
      p.id === promoId
        ? {
            ...p,
            aktif: !p.aktif,
            diperbaruiOleh: auth.data!.nama,
            diperbaruiPada: Date.now(),
          }
        : p
    );

    const nextState = this.writeRaw({
      ...state,
      promos: nextPromos,
    });
    return { ok: true, data: nextState };
  }

  public deletePromo(promoId: string): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const state = this.syncAndGetState();
    const exists = (state.promos || []).some((p) => p.id === promoId);
    if (!exists) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Promo tidak ditemukan.',
      };
    }

    const nextState = this.writeRaw({
      ...state,
      promos: (state.promos || []).filter((p) => p.id !== promoId),
    });
    return { ok: true, data: nextState };
  }

  // =========================================================================
  // PROFIL & ABOUT CAPSTER (KHUSUS CAPSTER)
  // =========================================================================

  public updateCapsterProfile(params: {
    pengalaman: string;
    nomorWhatsApp: string;
    instagramCapster: string;
    instagramBarbershop: string;
  }): ServiceResult<BarberDatabaseState> {
    const auth = this.requireCapsterRole();
    if (!auth.ok || !auth.data) {
      return { ok: false, errorCode: auth.errorCode, message: auth.message };
    }

    const pengalamanTrim = params.pengalaman.trim();
    if (pengalamanTrim.length < 5) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Teks pengalaman capster wajib diisi minimal 5 karakter.',
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

    const igCapsterCheck = validateInstagramHandle(
      params.instagramCapster,
      'Instagram Capster'
    );
    if (!igCapsterCheck.valid) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: igCapsterCheck.error,
      };
    }

    const igShopCheck = validateInstagramHandle(
      params.instagramBarbershop,
      'Instagram Barbershop'
    );
    if (!igShopCheck.valid) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: igShopCheck.error,
      };
    }

    const state = this.syncAndGetState();
    const nextProfile: CapsterProfile = {
      ...getInitialCapsterProfile(),
      ...(state.capsterProfile || {}),
      pengalaman: pengalamanTrim,
      nomorWhatsApp: normalizeWaToLocal08(waCheck.normalized),
      instagramCapster: igCapsterCheck.cleaned,
      instagramBarbershop: igShopCheck.cleaned,
      diperbaruiPada: Date.now(),
    };

    const nextState = this.writeRaw({
      ...state,
      capsterProfile: nextProfile,
    });
    return { ok: true, data: nextState };
  }
}

export const barberService = new BarberLocalStorageService();
