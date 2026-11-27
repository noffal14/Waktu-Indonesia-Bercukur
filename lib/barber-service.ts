import {
  BarberDatabaseState,
  Capster,
  ComputedSlotInfo,
  DataAntreanWalkin,
  DataBooking,
  DataJadwalSlotCapster,
  DataKuotaAntrean,
  QueueEstimationSummary,
  ServiceResult,
  SlotStatus,
} from './types';

const STORAGE_KEY = 'wib_barbershop_state_v1';
const CUSTOMER_WALKIN_ID_KEY = 'wib_customer_walkin_id';
const CUSTOMER_BOOKING_CODE_KEY = 'wib_customer_booking_code';
const CAPSTER_SESSION_KEY = 'wib_capster_session_id';
const DEFAULT_DURATION_MINUTES = 45;
const LATE_TOLERANCE_MINUTES = 15;
const DB_VERSION = 1;

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
  let normalized = cleaned;
  if (normalized.startsWith('+62')) {
    normalized = '0' + normalized.slice(3);
  } else if (normalized.startsWith('62')) {
    normalized = '0' + normalized.slice(2);
  }
  if (!/^08\d{8,12}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error:
        'Gunakan nomor WhatsApp Indonesia yang valid (contoh: 081234567890 atau +62812...).',
    };
  }
  return { valid: true, normalized };
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
      namaPelanggan: 'Deni Kurniawan',
      waktuAmbil: simAnchor - 20 * min, // 12:45
      status: 'Waiting',
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
      nomorWhatsApp: '081234567801',
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
      nomorWhatsApp: '081398765432',
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
      nomorWhatsApp: '085611223344',
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
      nama: 'Ilham Nugroho',
      nomorWhatsApp: '081277889900',
      capsterId: 'hasan',
      tanggal: todayStr,
      jamSlot: '15:00',
      status: 'Booked',
      alasanBatal: null,
      waktuDibuat: simAnchor - 90 * min,
    },
    {
      id: 'bk-5',
      kodeTiket: `BK-${compactDate}-005`,
      nama: 'Kevin Wijaya',
      nomorWhatsApp: '081800998877',
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
      nomorWhatsApp: '081944556677',
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
      nomorWhatsApp: '081223344556',
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
        status =
          activeBooking.status === 'In-Service' ? 'Full' : 'Booked';
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
      .sort((a, b) => (a.waktuMulai || a.waktuAmbil) - (b.waktuMulai || b.waktuAmbil));

    const sedangDilayaniBooking = state.bookings
      .filter((b) => b.tanggal === tanggal && b.status === 'In-Service')
      .sort((a, b) => (a.waktuMulai || a.waktuDibuat) - (b.waktuMulai || b.waktuDibuat));

    return {
      rataRataDurasiMenit,
      jumlahSelesaiHariIni,
      menggunakanDefault,
      sedangDilayaniWalkin,
      sedangDilayaniBooking,
      waitingList,
    };
  }

  // UC-01: Ambil Nomor Antrean Walk-in (Atomic check on localStorage)
  public takeWalkinQueue(params: {
    namaPelanggan?: string;
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
      namaPelanggan: params.namaPelanggan?.trim() || undefined,
      waktuAmbil: nowMs,
      status: 'Waiting',
      capsterId: params.capsterId || undefined,
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

  // UC-04: Buat Booking Layanan (dengan pengecekan race condition tepat sebelum simpan)
  public createBooking(params: {
    capsterId: string;
    tanggal: string;
    jamSlot: string;
    nama: string;
    nomorWhatsApp: string;
  }): ServiceResult<{
    booking: DataBooking;
    state: BarberDatabaseState;
  }> {
    const namaTrim = params.nama.trim();
    if (namaTrim.length < 2) {
      return {
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Nama lengkap wajib diisi (minimal 2 karakter).',
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

    // Re-read fresh state untuk mencegah race condition
    const state = this.syncAndGetState();
    const { config, slots } = this.getComputedSlots(
      state,
      params.capsterId,
      params.tanggal
    );

    if (config.isLibur) {
      return {
        ok: false,
        errorCode: 'CAPSTER_OFF',
        message: 'Capster tidak beroperasi pada tanggal ini. Silakan pilih capster atau tanggal lain.',
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

    const nowMs = getEffectiveNowMs(state);
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
      nama: namaTrim,
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

  // UC-05: Panggil antrean walk-in -> In-Service
  public callWalkin(
    walkinId: string,
    capsterId: string
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const target = state.walkinQueue.find((w) => w.id === walkinId);
    if (!target) {
      return { ok: false, errorCode: 'NOT_FOUND', message: 'Antrean tidak ditemukan.' };
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

  // UC-05: Selesai layanan walk-in -> Selesai & catat durasiAktual
  public completeWalkin(
    walkinId: string,
    overrideDurationMinutes?: number
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const target = state.walkinQueue.find((w) => w.id === walkinId);
    if (!target) {
      return { ok: false, errorCode: 'NOT_FOUND', message: 'Antrean tidak ditemukan.' };
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

  // UC-05: Proses Cukur booking -> In-Service
  public startBookingService(bookingId: string): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const target = state.bookings.find((b) => b.id === bookingId);
    if (!target) {
      return { ok: false, errorCode: 'NOT_FOUND', message: 'Booking tidak ditemukan.' };
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

  // UC-05: Selesai booking -> Selesai, kosongkan slot, catat durasiAktual
  public completeBooking(
    bookingId: string,
    overrideDurationMinutes?: number
  ): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const nowMs = getEffectiveNowMs(state);
    const target = state.bookings.find((b) => b.id === bookingId);
    if (!target) {
      return { ok: false, errorCode: 'NOT_FOUND', message: 'Booking tidak ditemukan.' };
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

  // UC-05: Batalkan booking manual (mis. terlambat > 15 menit) -> Canceled & slot bebas
  public cancelBookingManual(bookingId: string): ServiceResult<BarberDatabaseState> {
    const state = this.syncAndGetState();
    const target = state.bookings.find((b) => b.id === bookingId);
    if (!target) {
      return { ok: false, errorCode: 'NOT_FOUND', message: 'Booking tidak ditemukan.' };
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

  // Pengaturan Kuota Harian (D2)
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

  // Pengaturan Jam Kerja & Libur/Izin Capster (D3)
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
    const existing = this.getScheduleConfig(state, params.capsterId, params.tanggal);

    const updatedConfig: DataJadwalSlotCapster = {
      ...existing,
      jamKerja: { buka: params.buka, tutup: params.tutup },
      isLibur: params.isLibur,
      alasanLibur: params.isLibur ? params.alasanLibur || 'Libur / Izin' : undefined,
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
      window.localStorage.removeItem(CUSTOMER_WALKIN_ID_KEY);
      window.localStorage.removeItem(CUSTOMER_BOOKING_CODE_KEY);
    }
    return seed;
  }

  // Session & Active Ticket Helpers
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
