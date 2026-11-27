import { CapsterProfile } from './capster-profile';
export type { CapsterProfile };

export type QueueStatus =
  | 'Waiting'
  | 'In-Service'
  | 'Selesai'
  | 'Canceled'
  | 'Kedaluwarsa';

export type SlotStatus =
  | 'Available'
  | 'Booked'
  | 'Full'
  | 'Tidak Tersedia';

export type CancelReason =
  | 'manual'
  | 'otomatis'
  | 'capster_tidak_tersedia'
  | null;

export type SessionRole = 'pelanggan' | 'capster' | null;

export type AppView =
  | 'beranda'
  | 'antrean'
  | 'status'
  | 'jadwal'
  | 'booking'
  | 'auth'
  | 'antrean-saya'
  | 'profil';

export interface ServiceItem {
  id: string;
  nama: string;
  harga: number;
  durasiMenit: number;
  perUnit?: boolean;
}

export interface ServiceCategory {
  id: string;
  nama: string;
  items: ServiceItem[];
}

export interface Promo {
  id: string;
  judul: string;
  deskripsi: string;
  layananId: string[];
  diskonMin: number;
  diskonMax: number;
  aktif: boolean;
  berlakuDari?: string; // YYYY-MM-DD (WIB)
  berlakuSampai?: string; // YYYY-MM-DD (WIB)
  diperbaruiOleh: string;
  diperbaruiPada: number; // Epoch ms
}

export interface SelectedServiceInput {
  itemId: string;
  qty: number;
}

export interface BookedServiceLine {
  itemId: string;
  nama: string;
  kategoriNama: string;
  hargaSatuan: number;
  qty: number;
  durasiMenit: number;
  diskonMinPersen: number;
  diskonMaxPersen: number;
}

export interface Capster {
  id: string;
  nama: string;
  gelar: string;
  spesialisasi: string;
  pengalaman: string;
  username: string;
  passwordHash: string;
  fotoKey: 'hasan';
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
  nomorAntrean: string; // Format: A001, A002, dst (reset setiap hari pada jam buka)
  tanggal: string; // YYYY-MM-DD (WIB)
  kunciHariOperasional: string; // Tanggal operasional WIB (reset di jam buka)
  customerId?: string;
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
  tanggal: string; // Kunci hari operasional YYYY-MM-DD
  kuotaMaksimal: number; // Default 15
  kuotaTerpakai: number;
}

export interface ManualSlotEntry {
  tipe: 'tidak_tersedia' | 'terisi_manual';
  catatan?: string; // Nama tamu/alasan opsional
}

// D3 DataJadwalSlotCapster
export interface DataJadwalSlotCapster {
  capsterId: string;
  tanggal: string; // YYYY-MM-DD
  jamKerja: {
    buka: string;
    tutup: string;
  };
  isLibur: boolean;
  alasanLibur?: string;
  manualSlots: Record<string, ManualSlotEntry>; // key: "12:00", "13:00", dst
}

export interface ComputedSlotInfo {
  capsterId: string;
  tanggal: string;
  jam: string; // e.g. "12:00"
  status: SlotStatus;
  sumber?: 'default' | 'booking' | 'tidak_tersedia' | 'terisi_manual' | 'lewat';
  catatanManual?: string;
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
  customerId?: string;
  nama: string;
  nomorWhatsApp: string;
  capsterId: string;
  tanggal: string; // YYYY-MM-DD
  jamSlot: string; // e.g. "14:00"
  status: 'Booked' | 'In-Service' | 'Selesai' | 'Canceled';
  alasanBatal: CancelReason;
  catatanBatal?: string;
  waktuDibuat: number; // Epoch ms
  waktuMulai?: number;
  waktuSelesai?: number;
  durasiAktual?: number; // Menit
  // Informasi layanan, durasi multi-slot & estimasi harga (opsional untuk kompatibilitas mundur)
  layananDipilih?: BookedServiceLine[];
  durasiTotalMenit?: number;
  slotTercakup?: string[];
  subtotalHarga?: number;
  potonganMin?: number;
  potonganMax?: number;
  totalEstimasiMin?: number;
  totalEstimasiMax?: number;
  promoJudul?: string[];
}

export interface BarberDatabaseState {
  version: number;
  capsters: Capster[];
  capsterProfile: CapsterProfile;
  customers: DataAkunPelanggan[];
  walkinQueue: DataAntreanWalkin[];
  quotas: Record<string, DataKuotaAntrean>;
  schedules: Record<string, DataJadwalSlotCapster>;
  bookings: DataBooking[];
  promos: Promo[];
  lastUpdatedAt: number;
}

export interface ServiceResult<T = void> {
  ok: boolean;
  data?: T;
  errorCode?:
    | 'QUOTA_FULL'
    | 'SLOT_TAKEN'
    | 'CAPSTER_OFF'
    | 'SHOP_CLOSED'
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'INVALID_STATE'
    | 'DUPLICATE_WALKIN'
    | 'SCHEDULE_CONFLICT'
    | 'BOOKING_CONFLICT'
    | 'RESCHEDULE_TOO_LATE'
    | 'AUTH_REQUIRED'
    | 'UNAUTHORIZED';
  message?: string;
  conflictBookings?: DataBooking[];
}

export interface InServiceDetail {
  id: string;
  tipe: 'walkin' | 'booking';
  kodeAtauNomor: string;
  namaTersamarkan: string;
  capsterId?: string;
  waktuMulai: number;
  jamMulaiHHMM: string;
  lamaBerjalanMenit: number;
  estimasiSisaMenit: number; // <= 0 artinya melebihi estimasi
  melebihiEstimasi: boolean;
}

export interface QueueEstimationSummary {
  rataRataDurasiMenit: number;
  jumlahSelesaiHariIni: number;
  menggunakanDefault: boolean;
  sedangDilayaniWalkin: DataAntreanWalkin[];
  sedangDilayaniBooking: DataBooking[];
  inServiceDetails: InServiceDetail[];
  sisaWaktuInServiceMenit: number;
  waitingList: DataAntreanWalkin[];
}
