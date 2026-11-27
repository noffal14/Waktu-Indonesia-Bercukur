export type QueueStatus = 'Waiting' | 'In-Service' | 'Selesai' | 'Canceled';

export type SlotStatus = 'Available' | 'Booked' | 'Full';

export type CancelReason = 'manual' | 'otomatis' | null;

export type AppView =
  | 'beranda'
  | 'antrean'
  | 'status'
  | 'jadwal'
  | 'booking'
  | 'capster'
  | 'auth'
  | 'antrean-saya'
  | 'profil';

export interface Capster {
  id: string;
  nama: string;
  gelar: string;
  spesialisasi: string;
  pengalaman: string;
  username: string;
  pin: string;
  fotoKey: 'hasan' | 'raka' | 'dimas';
}

// D5 DataAkunPelanggan
export interface Customer {
  id: string;
  nama: string;
  nomorWhatsApp: string; // Dinormalisasi ke format 628xx
  email?: string;
  passwordHash: string;
  capsterFavoritId?: string;
  dibuatPada: number; // Epoch ms
}

export type DataAkunPelanggan = Customer;

// D1 DataAntreanWalkin
export interface DataAntreanWalkin {
  id: string;
  nomorAntrean: string; // Format: A001, A002, dst (reset tiap hari)
  tanggal: string; // YYYY-MM-DD
  customerId?: string; // Relasi opsional ke Customer (kompatibel dengan data lama)
  namaPelanggan?: string;
  nomorWhatsApp?: string;
  waktuAmbil: number; // Epoch ms (urutan FIFO murni)
  status: QueueStatus;
  capsterId?: string;
  waktuMulai?: number; // Epoch ms
  waktuSelesai?: number; // Epoch ms
  durasiAktual?: number; // Menit
}

// D2 DataKuotaAntrean
export interface DataKuotaAntrean {
  tanggal: string; // YYYY-MM-DD
  kuotaMaksimal: number; // Default 20
  kuotaTerpakai: number;
}

// D3 DataJadwalSlotCapster
export interface DataJadwalSlotCapster {
  capsterId: string;
  tanggal: string; // YYYY-MM-DD
  jamKerja: {
    buka: string; // e.g. "10:00"
    tutup: string; // e.g. "21:00"
  };
  isLibur: boolean;
  alasanLibur?: string;
  slotPenuhManual: string[]; // Daftar jam (e.g. "13:00") yang ditandai Full oleh capster
}

export interface ComputedSlotInfo {
  capsterId: string;
  tanggal: string;
  jam: string; // e.g. "10:00"
  status: SlotStatus;
  bookingId?: string;
  bookingKode?: string;
  bookingNama?: string;
  bookingStatus?: DataBooking['status'];
  sudahLewat?: boolean;
}

// D4 DataBooking
export interface DataBooking {
  id: string;
  kodeTiket: string; // Format: BK-YYYYMMDD-001
  customerId?: string; // Relasi opsional ke Customer (kompatibel dengan data lama)
  nama: string;
  nomorWhatsApp: string;
  capsterId: string;
  tanggal: string; // YYYY-MM-DD
  jamSlot: string; // e.g. "14:00"
  status: 'Booked' | 'In-Service' | 'Selesai' | 'Canceled';
  alasanBatal: CancelReason;
  waktuDibuat: number; // Epoch ms
  waktuMulai?: number;
  waktuSelesai?: number;
  durasiAktual?: number; // Menit
}

export interface BarberDatabaseState {
  version: number;
  simAnchorMs: number; // Jam simulasi awal (today 13:05 WIB)
  realAnchorMs: number; // Epoch real saat seed/reset dibuat
  extraOffsetMinutes: number; // Tambahan simulasi waktu berjalan (+15m, +30m, dst)
  useRealClock: boolean;
  capsters: Capster[];
  customers: DataAkunPelanggan[]; // D5 DataAkunPelanggan
  walkinQueue: DataAntreanWalkin[];
  quotas: Record<string, DataKuotaAntrean>; // key: YYYY-MM-DD
  schedules: Record<string, DataJadwalSlotCapster>; // key: `${capsterId}_${tanggal}`
  bookings: DataBooking[];
  defaultJamKerja: Record<string, { buka: string; tutup: string }>; // per capsterId
  lastUpdatedAt: number; // Epoch ms effective
}

export interface ServiceResult<T = void> {
  ok: boolean;
  data?: T;
  errorCode?:
    | 'QUOTA_FULL'
    | 'SLOT_TAKEN'
    | 'CAPSTER_OFF'
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'INVALID_STATE'
    | 'DUPLICATE_WALKIN'
    | 'SCHEDULE_CONFLICT'
    | 'RESCHEDULE_TOO_LATE'
    | 'AUTH_REQUIRED';
  message?: string;
}

export interface QueueEstimationSummary {
  rataRataDurasiMenit: number;
  jumlahSelesaiHariIni: number;
  menggunakanDefault: boolean;
  sedangDilayaniWalkin: DataAntreanWalkin[];
  sedangDilayaniBooking: DataBooking[];
  waitingList: DataAntreanWalkin[];
}
