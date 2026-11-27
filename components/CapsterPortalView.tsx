'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CalendarCog,
  CalendarOff,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Lock,
  LogOut,
  Phone,
  Play,
  Plus,
  Save,
  Scissors,
  ShieldAlert,
  SlidersHorizontal,
  Tag,
  Trash2,
  UserCheck,
  UserCog,
  XCircle,
} from 'lucide-react';
import {
  addDaysYYYYMMDD,
  barberService,
  formatDateIndo,
  formatShortDateIndo,
  formatTimeWibHHMM,
  formatWhatsAppDisplay,
  parseSlotEpochMs,
} from '@/lib/barber-service';
import {
  getWibParts,
  ShopOperationalStatus,
  WALKIN_DAILY_QUOTA,
} from '@/lib/barbershop-config';
import { CapsterProfile } from '@/lib/capster-profile';
import {
  findServiceItemById,
  formatPromoShortBadge,
  formatRupiahRange,
  isPromoActiveNow,
  SERVICE_CATALOG,
} from '@/lib/services-catalog';
import {
  BarberDatabaseState,
  Capster,
  DataBooking,
  DataKuotaAntrean,
  Promo,
  QueueEstimationSummary,
  ServiceResult,
  SessionRole,
} from '@/lib/types';
import { AboutCapster } from './AboutCapster';
import { CapsterAvatar } from './BarbershopMedia';
import { StatusIndicator } from './StatusIndicator';

interface CapsterPortalViewProps {
  dbState: BarberDatabaseState;
  capsterProfile: CapsterProfile;
  todayStr: string;
  operationalDayKey: string;
  nowMs: number;
  liveClockText: string;
  shopStatus: ShopOperationalStatus;
  todayQuota: DataKuotaAntrean;
  queueEstimation: QueueEstimationSummary;
  sessionRole: SessionRole;
  loggedInCapster: Capster | null;
  onRedirectHome: () => void;
  onLogout: () => void;
  onCallWalkin: (
    walkinId: string,
    capsterId?: string
  ) => ServiceResult<BarberDatabaseState>;
  onCompleteWalkin: (
    walkinId: string,
    overrideDurationMinutes?: number
  ) => ServiceResult<BarberDatabaseState>;
  onCancelWalkin: (walkinId: string) => ServiceResult<BarberDatabaseState>;
  onStartBooking: (bookingId: string) => ServiceResult<BarberDatabaseState>;
  onCompleteBooking: (
    bookingId: string,
    overrideDurationMinutes?: number
  ) => ServiceResult<BarberDatabaseState>;
  onCancelBookingManual: (
    bookingId: string
  ) => ServiceResult<BarberDatabaseState>;
  onUpdateQuota: (
    operationalDayKey: string,
    maxQuota: number
  ) => ServiceResult<BarberDatabaseState>;
  onSetDayOff: (params: {
    capsterId: string;
    tanggal: string;
    isLibur: boolean;
    alasanLibur?: string;
    forceCancelConflicts?: boolean;
  }) => ServiceResult<BarberDatabaseState>;
  onSetSlotManual: (params: {
    capsterId: string;
    tanggal: string;
    jam: string;
    mode: 'tersedia' | 'tidak_tersedia' | 'terisi_manual';
    catatan?: string;
    forceCancelConflict?: boolean;
  }) => ServiceResult<BarberDatabaseState>;
  onCreatePromo: (params: {
    judul: string;
    deskripsi: string;
    layananId: string[];
    diskonMin: number;
    diskonMax: number;
    aktif: boolean;
    berlakuDari?: string;
    berlakuSampai?: string;
  }) => ServiceResult<BarberDatabaseState>;
  onUpdatePromo: (
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
  ) => ServiceResult<BarberDatabaseState>;
  onTogglePromoActive: (promoId: string) => ServiceResult<BarberDatabaseState>;
  onDeletePromo: (promoId: string) => ServiceResult<BarberDatabaseState>;
  onUpdateCapsterProfile: (params: {
    pengalaman: string;
    nomorWhatsApp: string;
    instagramCapster: string;
    instagramBarbershop: string;
  }) => ServiceResult<BarberDatabaseState>;
  onChangeCapsterPassword: (params: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => ServiceResult<BarberDatabaseState>;
}

type DashboardTab = 'berlangsung' | 'riwayat' | 'jadwal' | 'promo' | 'profil';
type HistoryFilterMode = 'hari_ini' | '7_hari' | 'semua' | 'tanggal';

type PendingConflict =
  | {
      kind: 'dayoff';
      capsterId: string;
      tanggal: string;
      isLibur: boolean;
      alasanLibur?: string;
      conflicts: DataBooking[];
      message: string;
    }
  | {
      kind: 'slot';
      capsterId: string;
      tanggal: string;
      jam: string;
      mode: 'tidak_tersedia' | 'terisi_manual';
      catatan?: string;
      conflicts: DataBooking[];
      message: string;
    };

export function CapsterPortalView({
  dbState,
  capsterProfile,
  todayStr,
  operationalDayKey,
  nowMs,
  liveClockText,
  shopStatus,
  todayQuota,
  sessionRole,
  loggedInCapster,
  onRedirectHome,
  onLogout,
  onCallWalkin,
  onCompleteWalkin,
  onCancelWalkin,
  onStartBooking,
  onCompleteBooking,
  onCancelBookingManual,
  onUpdateQuota,
  onSetDayOff,
  onSetSlotManual,
  onCreatePromo,
  onUpdatePromo,
  onTogglePromoActive,
  onDeletePromo,
  onUpdateCapsterProfile,
  onChangeCapsterPassword,
}: CapsterPortalViewProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('berlangsung');
  const [completingItem, setCompletingItem] = useState<{
    type: 'walkin' | 'booking';
    id: string;
    minutes: number;
  } | null>(null);

  const [quotaInput, setQuotaInput] = useState<number>(
    todayQuota.kuotaMaksimal
  );
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Filter Riwayat
  const [historyFilter, setHistoryFilter] =
    useState<HistoryFilterMode>('hari_ini');
  const [historyDate, setHistoryDate] = useState<string>(todayStr);

  // "Atur Jadwal Saya" state
  const [schedDate, setSchedDate] = useState<string>(todayStr);
  const [dayOffReason, setDayOffReason] = useState<string>('');
  const [editingSlotJam, setEditingSlotJam] = useState<string | null>(null);
  const [slotModeDraft, setSlotModeDraft] = useState<
    'tersedia' | 'tidak_tersedia' | 'terisi_manual'
  >('tidak_tersedia');
  const [slotNoteDraft, setSlotNoteDraft] = useState<string>('');
  const [pendingConflict, setPendingConflict] =
    useState<PendingConflict | null>(null);

  // "Kelola Promo" state
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoJudul, setPromoJudul] = useState('');
  const [promoDeskripsi, setPromoDeskripsi] = useState('');
  const [promoLayananIds, setPromoLayananIds] = useState<string[]>([
    'premium-haircut',
  ]);
  const [promoDiskonMin, setPromoDiskonMin] = useState<number>(20);
  const [promoDiskonMax, setPromoDiskonMax] = useState<number>(30);
  const [promoBerlakuDari, setPromoBerlakuDari] = useState<string>('');
  const [promoBerlakuSampai, setPromoBerlakuSampai] = useState<string>('');
  const [promoAktif, setPromoAktif] = useState<boolean>(true);
  const [promoFormError, setPromoFormError] = useState<string | null>(null);
  const [confirmDeletePromoId, setConfirmDeletePromoId] = useState<
    string | null
  >(null);

  // "Profil & About Capster" state
  const [profPengalaman, setProfPengalaman] = useState(
    capsterProfile.pengalaman
  );
  const [profWa, setProfWa] = useState(capsterProfile.nomorWhatsApp);
  const [profIgCapster, setProfIgCapster] = useState(
    capsterProfile.instagramCapster
  );
  const [profIgShop, setProfIgShop] = useState(
    capsterProfile.instagramBarbershop
  );
  const [profileFormError, setProfileFormError] = useState<string | null>(null);

  // "Ganti Password Capster" state
  const [capsterCurrPwd, setCapsterCurrPwd] = useState('');
  const [capsterNewPwd, setCapsterNewPwd] = useState('');
  const [capsterConfirmPwd, setCapsterConfirmPwd] = useState('');
  const [showCapCurrPwd, setShowCapCurrPwd] = useState(false);
  const [showCapNewPwd, setShowCapNewPwd] = useState(false);
  const [showCapConfirmPwd, setShowCapConfirmPwd] = useState(false);
  const [capsterPwdError, setCapsterPwdError] = useState<string | null>(null);
  const [capsterPwdSuccess, setCapsterPwdSuccess] = useState<string | null>(
    null
  );

  // Guard level komponen: jika role bukan 'capster', arahkan kembali ke Beranda
  const isAuthorized = sessionRole === 'capster' && Boolean(loggedInCapster);
  useEffect(() => {
    if (!isAuthorized) {
      const timer = window.setTimeout(() => {
        onRedirectHome();
      }, 900);
      return () => window.clearTimeout(timer);
    }
  }, [isAuthorized, onRedirectHome]);

  if (!isAuthorized || !loggedInCapster) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-center space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
        <h1 className="font-display text-xl font-bold text-rose-200">
          Halaman ini khusus capster
        </h1>
        <p className="text-sm text-zinc-300">
          Anda akan diarahkan ke Beranda...
        </p>
      </div>
    );
  }

  const wibTimeWithSec = getWibParts(nowMs).hhDotMmSs;
  const sisaKuota = Math.max(
    0,
    todayQuota.kuotaMaksimal - todayQuota.kuotaTerpakai
  );

  // Data Ringkasan Hari Ini
  const todayWalkinsAll = dbState.walkinQueue
    .filter((w) => (w.kunciHariOperasional || w.tanggal) === operationalDayKey)
    .sort((a, b) => a.waktuAmbil - b.waktuAmbil);

  const todayBookingsAll = dbState.bookings
    .filter(
      (b) => b.tanggal === todayStr && b.capsterId === loggedInCapster.id
    )
    .sort((a, b) => a.jamSlot.localeCompare(b.jamSlot));

  const walkinCounts = {
    waiting: todayWalkinsAll.filter((w) => w.status === 'Waiting').length,
    inService: todayWalkinsAll.filter((w) => w.status === 'In-Service').length,
    selesai: todayWalkinsAll.filter((w) => w.status === 'Selesai').length,
    canceled: todayWalkinsAll.filter(
      (w) => w.status === 'Canceled' || w.status === 'Kedaluwarsa'
    ).length,
  };

  const bookingCounts = {
    booked: todayBookingsAll.filter((b) => b.status === 'Booked').length,
    inService: todayBookingsAll.filter((b) => b.status === 'In-Service').length,
    selesai: todayBookingsAll.filter((b) => b.status === 'Selesai').length,
    canceled: todayBookingsAll.filter((b) => b.status === 'Canceled').length,
  };

  // Tab BERLANGSUNG: hanya Waiting & In-Service (walk-in) dan Booked & In-Service (booking)
  const ongoingWalkins = todayWalkinsAll.filter(
    (w) => w.status === 'Waiting' || w.status === 'In-Service'
  );
  const ongoingBookings = dbState.bookings
    .filter(
      (b) =>
        b.capsterId === loggedInCapster.id &&
        (b.status === 'Booked' || b.status === 'In-Service')
    )
    .sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal);
      return a.jamSlot.localeCompare(b.jamSlot);
    });

  // Tab RIWAYAT SELESAI / BATAL / KEDALUWARSA
  const sevenDaysAgoStr = addDaysYYYYMMDD(todayStr, -6);
  const matchesHistoryFilter = (dateStr: string) => {
    if (historyFilter === 'hari_ini') {
      return dateStr === todayStr || dateStr === operationalDayKey;
    }
    if (historyFilter === '7_hari') {
      return dateStr >= sevenDaysAgoStr && dateStr <= todayStr;
    }
    if (historyFilter === 'tanggal') {
      return dateStr === historyDate;
    }
    return true;
  };

  type HistoryEntry = {
    id: string;
    tipe: 'walkin' | 'booking';
    kodeAtauNomor: string;
    namaPelanggan: string;
    tanggal: string;
    status: 'Selesai' | 'Canceled' | 'Kedaluwarsa';
    layananText: string;
    jamMulai?: string;
    jamSelesai?: string;
    durasiAktual?: number;
    catatan?: string;
    sortTimestamp: number;
  };

  const getCustomerDisplayName = (
    customerId?: string,
    fallback?: string
  ) => {
    if (customerId) {
      const cust = dbState.customers.find((c) => c.id === customerId);
      if (cust) return cust.nama;
    }
    return fallback || 'Tamu Walk-in';
  };

  const historyEntries: HistoryEntry[] = [
    ...dbState.walkinQueue
      .filter(
        (w) =>
          (w.status === 'Selesai' ||
            w.status === 'Canceled' ||
            w.status === 'Kedaluwarsa') &&
          matchesHistoryFilter(w.tanggal)
      )
      .map((w) => ({
        id: w.id,
        tipe: 'walkin' as const,
        kodeAtauNomor: w.nomorAntrean,
        namaPelanggan: getCustomerDisplayName(w.customerId, w.namaPelanggan),
        tanggal: w.tanggal,
        status: w.status as 'Selesai' | 'Canceled' | 'Kedaluwarsa',
        layananText: 'Walk-in (Potong Rambut)',
        jamMulai: w.waktuMulai ? formatTimeWibHHMM(w.waktuMulai) : undefined,
        jamSelesai: w.waktuSelesai
          ? formatTimeWibHHMM(w.waktuSelesai)
          : undefined,
        durasiAktual: w.durasiAktual,
        sortTimestamp: w.waktuSelesai || w.waktuMulai || w.waktuAmbil,
      })),
    ...dbState.bookings
      .filter(
        (b) =>
          b.capsterId === loggedInCapster.id &&
          (b.status === 'Selesai' || b.status === 'Canceled') &&
          matchesHistoryFilter(b.tanggal)
      )
      .map((b) => ({
        id: b.id,
        tipe: 'booking' as const,
        kodeAtauNomor: b.kodeTiket,
        namaPelanggan: getCustomerDisplayName(b.customerId, b.nama),
        tanggal: b.tanggal,
        status: b.status as 'Selesai' | 'Canceled',
        layananText:
          b.layananDipilih && b.layananDipilih.length > 0
            ? b.layananDipilih
                .map((l) => (l.qty > 1 ? `${l.nama} (×${l.qty})` : l.nama))
                .join(', ')
            : `Booking Slot ${b.jamSlot} WIB`,
        jamMulai: b.waktuMulai
          ? formatTimeWibHHMM(b.waktuMulai)
          : b.jamSlot,
        jamSelesai: b.waktuSelesai
          ? formatTimeWibHHMM(b.waktuSelesai)
          : undefined,
        durasiAktual: b.durasiAktual,
        catatan: b.catatanBatal,
        sortTimestamp:
          b.waktuSelesai ||
          b.waktuMulai ||
          parseSlotEpochMs(b.tanggal, b.jamSlot),
      })),
  ].sort((a, b) => b.sortTimestamp - a.sortTimestamp);

  const totalCompletedInPeriod = historyEntries.filter(
    (h) => h.status === 'Selesai'
  ).length;
  const totalCanceledInPeriod = historyEntries.filter(
    (h) => h.status !== 'Selesai'
  ).length;

  const openCompletePanel = (
    type: 'walkin' | 'booking',
    id: string,
    waktuMulai?: number
  ) => {
    const computedElapsed = waktuMulai
      ? Math.max(15, Math.round((nowMs - waktuMulai) / 60_000))
      : 45;
    setCompletingItem({ type, id, minutes: computedElapsed });
  };

  const handleActionResult = (
    res: ServiceResult<BarberDatabaseState>,
    successMsg?: string
  ) => {
    if (!res.ok) {
      setActionNotice({
        type: 'error',
        text: res.message || 'Aksi gagal dijalankan.',
      });
      return;
    }
    if (successMsg) {
      setActionNotice({ type: 'success', text: successMsg });
    }
  };

  const dateOptions = Array.from({ length: 7 }, (_, i) =>
    addDaysYYYYMMDD(todayStr, i)
  );
  const effectiveSchedDate = schedDate >= todayStr ? schedDate : todayStr;
  const { config: editConfig, slots: editSlots } =
    barberService.getComputedSlots(
      dbState,
      loggedInCapster.id,
      effectiveSchedDate
    );

  const handleToggleDayOff = (forceCancelConflicts = false) => {
    const nextLibur = !editConfig.isLibur;
    const res = onSetDayOff({
      capsterId: loggedInCapster.id,
      tanggal: effectiveSchedDate,
      isLibur: nextLibur,
      alasanLibur: nextLibur
        ? dayOffReason.trim() || 'Libur / Izin Capster'
        : undefined,
      forceCancelConflicts,
    });

    if (!res.ok && res.errorCode === 'BOOKING_CONFLICT' && res.conflictBookings) {
      setPendingConflict({
        kind: 'dayoff',
        capsterId: loggedInCapster.id,
        tanggal: effectiveSchedDate,
        isLibur: nextLibur,
        alasanLibur: dayOffReason.trim() || 'Libur / Izin Capster',
        conflicts: res.conflictBookings,
        message:
          res.message ||
          'Terdapat booking aktif pada tanggal ini. Konfirmasi pembatalan terlebih dahulu.',
      });
      return;
    }

    setPendingConflict(null);
    handleActionResult(
      res,
      nextLibur
        ? `Tanggal ${formatShortDateIndo(effectiveSchedDate)} ditandai Libur / Tidak Beroperasi.`
        : `Status libur pada ${formatShortDateIndo(effectiveSchedDate)} dibatalkan. Jadwal aktif kembali.`
    );
  };

  const handleApplySlotManual = (
    jam: string,
    mode: 'tersedia' | 'tidak_tersedia' | 'terisi_manual',
    catatan?: string,
    forceCancelConflict = false
  ) => {
    const res = onSetSlotManual({
      capsterId: loggedInCapster.id,
      tanggal: effectiveSchedDate,
      jam,
      mode,
      catatan,
      forceCancelConflict,
    });

    if (!res.ok && res.errorCode === 'BOOKING_CONFLICT' && res.conflictBookings) {
      if (mode !== 'tersedia') {
        setPendingConflict({
          kind: 'slot',
          capsterId: loggedInCapster.id,
          tanggal: effectiveSchedDate,
          jam,
          mode,
          catatan,
          conflicts: res.conflictBookings,
          message:
            res.message ||
            `Slot ${jam} WIB sudah dibooking pelanggan. Batalkan booking terlebih dahulu.`,
        });
      }
      return;
    }

    setPendingConflict(null);
    setEditingSlotJam(null);
    setSlotNoteDraft('');
    handleActionResult(
      res,
      mode === 'tersedia'
        ? `Slot ${jam} WIB dikembalikan ke status Tersedia.`
        : mode === 'tidak_tersedia'
          ? `Slot ${jam} WIB ditandai Tidak Tersedia.`
          : `Slot ${jam} WIB ditandai Terisi Manual (Booked).`
    );
  };

  const handleConfirmConflictCancellation = () => {
    if (!pendingConflict) return;
    if (pendingConflict.kind === 'dayoff') {
      const res = onSetDayOff({
        capsterId: pendingConflict.capsterId,
        tanggal: pendingConflict.tanggal,
        isLibur: pendingConflict.isLibur,
        alasanLibur: pendingConflict.alasanLibur,
        forceCancelConflicts: true,
      });
      setPendingConflict(null);
      handleActionResult(
        res,
        `Booking terkait telah dibatalkan dan tanggal ${formatShortDateIndo(
          pendingConflict.tanggal
        )} ditandai libur.`
      );
      return;
    }

    const res = onSetSlotManual({
      capsterId: pendingConflict.capsterId,
      tanggal: pendingConflict.tanggal,
      jam: pendingConflict.jam,
      mode: pendingConflict.mode,
      catatan: pendingConflict.catatan,
      forceCancelConflict: true,
    });
    setPendingConflict(null);
    setEditingSlotJam(null);
    setSlotNoteDraft('');
    handleActionResult(
      res,
      `Booking pada slot ${pendingConflict.jam} WIB telah dibatalkan dan status slot diperbarui.`
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header Capster & Jam Real-Time WIB */}
      <header className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <CapsterAvatar
            fotoKey={loggedInCapster.fotoKey}
            nama={loggedInCapster.nama}
            widthClass="w-16"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-amber-400 font-semibold">
                {loggedInCapster.gelar}
              </span>
              <span aria-hidden="true" className="text-zinc-600">
                ·
              </span>
              <span className="font-mono tabular-nums text-stone-200 font-medium">
                {liveClockText.split('|')[0]?.trim()} · {wibTimeWithSec} WIB
              </span>
              <span
                className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                  shopStatus.isOpen
                    ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-300'
                    : 'bg-rose-500/12 border-rose-500/35 text-rose-300'
                }`}
              >
                {shopStatus.isOpen ? 'Buka' : 'Tutup'}
              </span>
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-stone-100 mt-1">
              Dashboard Capster · {loggedInCapster.nama}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-rose-950/50 border border-zinc-700 hover:border-rose-500/40 text-zinc-200 hover:text-rose-200 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 self-start lg:self-auto transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </header>

      {/* 1. Ringkasan Hari Ini */}
      <section aria-labelledby="ringkasan-hari-ini" className="space-y-3">
        <h2
          id="ringkasan-hari-ini"
          className="font-display text-base sm:text-lg font-semibold text-stone-100"
        >
          Ringkasan Hari Ini
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-[#131317] border border-zinc-800/90 space-y-1.5">
            <p className="text-xs text-zinc-400">Antrean Walk-in Hari Ini</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-amber-300">
              {todayWalkinsAll.length}
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Menunggu {walkinCounts.waiting} · Proses {walkinCounts.inService}{' '}
              · Selesai {walkinCounts.selesai} · Batal {walkinCounts.canceled}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#131317] border border-zinc-800/90 space-y-1.5">
            <p className="text-xs text-zinc-400">Booking Hari Ini</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-sky-300">
              {todayBookingsAll.length}
            </p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Mendatang {bookingCounts.booked} · Proses{' '}
              {bookingCounts.inService} · Selesai {bookingCounts.selesai} ·
              Batal {bookingCounts.canceled}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#131317] border border-zinc-800/90 space-y-1.5">
            <p className="text-xs text-zinc-400">Sisa Kuota Walk-in</p>
            <p
              className={`font-mono tabular-nums text-2xl font-bold ${
                sisaKuota === 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {sisaKuota} / {todayQuota.kuotaMaksimal}
            </p>
            <p className="text-[11px] text-zinc-400">
              Terpakai {todayQuota.kuotaTerpakai} (default reset{' '}
              {WALKIN_DAILY_QUOTA})
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#131317] border border-zinc-800/90 space-y-1.5">
            <p className="text-xs text-zinc-400">Jam Operasional Hari Ini</p>
            <p className="font-mono tabular-nums text-lg sm:text-xl font-bold text-stone-100">
              {shopStatus.hours.label}
            </p>
            <p className="text-[11px] text-zinc-400">
              {shopStatus.isOpen
                ? `Tutup dalam ${shopStatus.minutesUntilClose} mnt`
                : shopStatus.closedMessage || 'Di luar jam operasional'}
            </p>
          </div>
        </div>
      </section>

      {/* Navigasi Tab Dashboard (Mobile-First, tombol >= 44px) */}
      <nav
        aria-label="Menu dashboard capster"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {(
          [
            {
              id: 'berlangsung',
              label: `Berlangsung (${ongoingWalkins.length + ongoingBookings.length})`,
              icon: Scissors,
            },
            {
              id: 'riwayat',
              label: 'Riwayat Selesai',
              icon: History,
            },
            {
              id: 'jadwal',
              label: 'Atur Jadwal Saya',
              icon: CalendarCog,
            },
            {
              id: 'promo',
              label: 'Kelola Promo',
              icon: Tag,
            },
            {
              id: 'profil',
              label: 'Profil & About Capster',
              icon: UserCog,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[46px] px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-amber-400 text-zinc-950 border-amber-400 font-semibold'
                  : 'bg-[#131317] text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-stone-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {actionNotice && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-2.5 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
          }`}
        >
          {actionNotice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* TAB 1: ANTREAN & BOOKING BERLANGSUNG */}
      {activeTab === 'berlangsung' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kolom Kiri: Walk-in Berlangsung (Waiting & In-Service) */}
          <section className="rounded-2xl bg-[#131317] border border-zinc-800/90 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  Walk-in Berlangsung
                </h2>
                <p className="text-xs text-zinc-400">
                  Antrean berstatus Waiting &amp; In-Service hari ini (urutan
                  FIFO).
                </p>
              </div>
              <span className="font-mono tabular-nums text-xs text-amber-300 shrink-0">
                {ongoingWalkins.length} aktif
              </span>
            </div>

            {ongoingWalkins.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400">
                Tidak ada antrean walk-in yang sedang menunggu atau dicukur.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80">
                {ongoingWalkins.map((w) => {
                  const isCompleting =
                    completingItem?.type === 'walkin' &&
                    completingItem.id === w.id;
                  const runningMin = w.waktuMulai
                    ? Math.max(0, Math.floor((nowMs - w.waktuMulai) / 60_000))
                    : 0;

                  return (
                    <div key={w.id} className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="font-mono tabular-nums text-xl font-bold text-amber-400 w-14 shrink-0">
                            {w.nomorAntrean}
                          </span>
                          <div className="space-y-0.5">
                            <p className="font-medium text-sm text-stone-100">
                              {getCustomerDisplayName(
                                w.customerId,
                                w.namaPelanggan
                              )}
                            </p>
                            <p className="text-xs text-zinc-300">
                              Layanan: Walk-in (Potong Rambut)
                            </p>
                            <p className="text-xs text-zinc-400 font-mono tabular-nums">
                              Ambil {formatTimeWibHHMM(w.waktuAmbil)} WIB
                            </p>
                            {w.nomorWhatsApp && (
                              <p className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono tabular-nums">
                                <Phone className="w-3 h-3" />
                                <span>
                                  {formatWhatsAppDisplay(w.nomorWhatsApp)}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        <StatusIndicator status={w.status} compact />
                      </div>

                      {w.status === 'Waiting' && (
                        <div className="flex flex-wrap gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleActionResult(
                                onCallWalkin(w.id, loggedInCapster.id),
                                `Antrean ${w.nomorAntrean} dipanggil ke kursi cukur.`
                              )
                            }
                            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Play className="w-4 h-4" />
                            <span>Panggil</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleActionResult(
                                onCancelWalkin(w.id),
                                `Antrean ${w.nomorAntrean} dibatalkan.`
                              )
                            }
                            className="min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs sm:text-sm font-medium"
                          >
                            Batalkan
                          </button>
                        </div>
                      )}

                      {w.status === 'In-Service' && !isCompleting && (
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              openCompletePanel('walkin', w.id, w.waktuMulai)
                            }
                            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-zinc-950 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Selesai</span>
                          </button>
                          {w.waktuMulai && (
                            <span className="text-xs text-sky-300 font-mono tabular-nums">
                              Mulai {formatTimeWibHHMM(w.waktuMulai)} WIB ·{' '}
                              {runningMin} mnt berjalan
                            </span>
                          )}
                        </div>
                      )}

                      {isCompleting && completingItem && (
                        <div className="p-3.5 rounded-xl bg-zinc-900 border border-sky-500/40 space-y-3">
                          <p className="text-xs font-medium text-stone-200">
                            Catat durasi layanan aktual (menit):
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {[25, 35, 45, 60].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() =>
                                  setCompletingItem({
                                    ...completingItem,
                                    minutes: m,
                                  })
                                }
                                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-mono border ${
                                  completingItem.minutes === m
                                    ? 'bg-sky-400 text-zinc-950 border-sky-400 font-semibold'
                                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                }`}
                              >
                                {m}m
                              </button>
                            ))}
                            <input
                              type="number"
                              min={5}
                              max={180}
                              value={completingItem.minutes}
                              onChange={(e) =>
                                setCompletingItem({
                                  ...completingItem,
                                  minutes: Math.max(
                                    1,
                                    Number(e.target.value) || 30
                                  ),
                                })
                              }
                              className="w-20 min-h-[38px] px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs font-mono text-stone-100"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                handleActionResult(
                                  onCompleteWalkin(
                                    w.id,
                                    completingItem.minutes
                                  ),
                                  `Antrean ${w.nomorAntrean} selesai (${completingItem.minutes} menit).`
                                );
                                setCompletingItem(null);
                              }}
                              className="min-h-[42px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold"
                            >
                              Simpan &amp; Selesaikan
                            </button>
                            <button
                              type="button"
                              onClick={() => setCompletingItem(null)}
                              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Kolom Kanan: Booking Berlangsung (Booked & In-Service) */}
          <section className="rounded-2xl bg-[#131317] border border-zinc-800/90 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  Booking Berlangsung
                </h2>
                <p className="text-xs text-zinc-400">
                  Jadwal berstatus Booked &amp; In-Service (toleransi telat 15
                  menit).
                </p>
              </div>
              <span className="font-mono tabular-nums text-xs text-sky-300 shrink-0">
                {ongoingBookings.length} aktif
              </span>
            </div>

            {ongoingBookings.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-400">
                Tidak ada booking mendatang atau sedang berlangsung saat ini.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80">
                {ongoingBookings.map((b) => {
                  const slotEpoch = parseSlotEpochMs(b.tanggal, b.jamSlot);
                  const lateMinutes = Math.floor((nowMs - slotEpoch) / 60_000);
                  const isCompleting =
                    completingItem?.type === 'booking' &&
                    completingItem.id === b.id;
                  const runningMin = b.waktuMulai
                    ? Math.max(0, Math.floor((nowMs - b.waktuMulai) / 60_000))
                    : 0;
                  const isTodayBooking = b.tanggal === todayStr;

                  return (
                    <div key={b.id} className="p-4 sm:p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono tabular-nums">
                            <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-stone-200 font-sans">
                              {isTodayBooking
                                ? 'Hari Ini'
                                : formatShortDateIndo(b.tanggal)}
                            </span>
                            <span className="text-amber-400 font-semibold">
                              {b.slotTercakup && b.slotTercakup.length > 1
                                ? `${b.slotTercakup[0]}–${String(
                                    Number(
                                      b.slotTercakup[
                                        b.slotTercakup.length - 1
                                      ].split(':')[0]
                                    ) + 1
                                  ).padStart(2, '0')}:00 WIB`
                                : `${b.jamSlot} WIB`}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{b.kodeTiket}</span>
                          </div>

                          <p className="font-medium text-sm text-stone-100">
                            {getCustomerDisplayName(b.customerId, b.nama)}
                          </p>
                          <p className="text-xs text-zinc-400 flex items-center gap-1.5 font-mono tabular-nums">
                            <Phone className="w-3 h-3" />
                            <span>
                              {formatWhatsAppDisplay(b.nomorWhatsApp)}
                            </span>
                          </p>

                          {b.layananDipilih && b.layananDipilih.length > 0 && (
                            <div className="mt-1.5 p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-1 text-xs">
                              <p className="text-zinc-200 font-medium">
                                {b.layananDipilih
                                  .map((l) =>
                                    l.qty > 1
                                      ? `${l.nama} (×${l.qty})`
                                      : l.nama
                                  )
                                  .join(', ')}
                              </p>
                              <p className="font-mono tabular-nums text-[11px] text-amber-300">
                                {b.durasiTotalMenit
                                  ? `Est. ${b.durasiTotalMenit} mnt`
                                  : ''}
                                {typeof b.totalEstimasiMin === 'number'
                                  ? ` · ${formatRupiahRange(
                                      b.totalEstimasiMin,
                                      b.totalEstimasiMax ?? b.totalEstimasiMin
                                    )}`
                                  : ''}
                              </p>
                            </div>
                          )}

                          {b.status === 'Booked' && lateMinutes > 0 && (
                            <p className="text-xs text-amber-300 font-mono tabular-nums">
                              Lewat {lateMinutes} menit dari jam slot (batas 15
                              menit)
                            </p>
                          )}
                        </div>

                        <StatusIndicator status={b.status} compact />
                      </div>

                      {b.status === 'Booked' && (
                        <div className="flex flex-wrap gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleActionResult(
                                onStartBooking(b.id),
                                `Booking ${b.kodeTiket} mulai diproses.`
                              )
                            }
                            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <Scissors className="w-4 h-4" />
                            <span>Proses Cukur</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleActionResult(
                                onCancelBookingManual(b.id),
                                `Booking ${b.kodeTiket} dibatalkan dan slot dibuka kembali.`
                              )
                            }
                            className="min-h-[46px] px-4 py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs sm:text-sm font-medium flex items-center gap-1.5"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Batalkan (Telat &gt;15m)</span>
                          </button>
                        </div>
                      )}

                      {b.status === 'In-Service' && !isCompleting && (
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              openCompletePanel('booking', b.id, b.waktuMulai)
                            }
                            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-sky-400 hover:bg-sky-300 text-zinc-950 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Selesai &amp; Kosongkan Slot</span>
                          </button>
                          {b.waktuMulai && (
                            <span className="text-xs text-sky-300 font-mono tabular-nums">
                              Mulai {formatTimeWibHHMM(b.waktuMulai)} WIB ·{' '}
                              {runningMin} mnt berjalan
                            </span>
                          )}
                        </div>
                      )}

                      {isCompleting && completingItem && (
                        <div className="p-3.5 rounded-xl bg-zinc-900 border border-sky-500/40 space-y-3">
                          <p className="text-xs font-medium text-stone-200">
                            Catat durasi layanan aktual (menit):
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {[25, 35, 45, 60].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() =>
                                  setCompletingItem({
                                    ...completingItem,
                                    minutes: m,
                                  })
                                }
                                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-mono border ${
                                  completingItem.minutes === m
                                    ? 'bg-sky-400 text-zinc-950 border-sky-400 font-semibold'
                                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                }`}
                              >
                                {m}m
                              </button>
                            ))}
                            <input
                              type="number"
                              min={5}
                              max={180}
                              value={completingItem.minutes}
                              onChange={(e) =>
                                setCompletingItem({
                                  ...completingItem,
                                  minutes: Math.max(
                                    1,
                                    Number(e.target.value) || 30
                                  ),
                                })
                              }
                              className="w-20 min-h-[38px] px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs font-mono text-stone-100"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                handleActionResult(
                                  onCompleteBooking(
                                    b.id,
                                    completingItem.minutes
                                  ),
                                  `Booking ${b.kodeTiket} selesai (${completingItem.minutes} menit).`
                                );
                                setCompletingItem(null);
                              }}
                              className="min-h-[42px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold"
                            >
                              Simpan &amp; Selesaikan
                            </button>
                            <button
                              type="button"
                              onClick={() => setCompletingItem(null)}
                              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: ANTREAN & BOOKING SELESAI (RIWAYAT) */}
      {activeTab === 'riwayat' && (
        <section className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-stone-100">
                Riwayat Antrean &amp; Booking Selesai
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Menampilkan layanan berstatus Selesai, Dibatalkan, dan
                Kedaluwarsa beserta durasi aktualnya.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'hari_ini', label: 'Hari Ini' },
                  { id: '7_hari', label: '7 Hari' },
                  { id: 'semua', label: 'Semua' },
                  { id: 'tanggal', label: 'Pilih Tanggal' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHistoryFilter(f.id)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                    historyFilter === f.id
                      ? 'bg-amber-400 text-zinc-950 border-amber-400 font-semibold'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {historyFilter === 'tanggal' && (
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value || todayStr)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-stone-100 font-mono"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-900/75 border border-zinc-800">
              <p className="text-xs text-zinc-400">Total Layanan Selesai</p>
              <p className="font-mono tabular-nums text-xl font-bold text-emerald-400 mt-1">
                {totalCompletedInPeriod} layanan
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-900/75 border border-zinc-800">
              <p className="text-xs text-zinc-400">Batal / Kedaluwarsa</p>
              <p className="font-mono tabular-nums text-xl font-bold text-rose-300 mt-1">
                {totalCanceledInPeriod} item
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-zinc-900/75 border border-zinc-800">
              <p className="text-xs text-zinc-400">Total Catatan Periode</p>
              <p className="font-mono tabular-nums text-xl font-bold text-stone-100 mt-1">
                {historyEntries.length} catatan
              </p>
            </div>
          </div>

          {historyEntries.length === 0 ? (
            <div className="p-8 rounded-xl bg-zinc-900/50 border border-zinc-800 text-center text-sm text-zinc-400">
              Belum ada riwayat selesai atau dibatalkan untuk filter periode
              ini.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/80 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950/40">
              {historyEntries.map((item) => (
                <div
                  key={`${item.tipe}-${item.id}`}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          item.tipe === 'walkin'
                            ? 'bg-amber-400/15 text-amber-300 border border-amber-400/35'
                            : 'bg-sky-400/15 text-sky-300 border border-sky-400/35'
                        }`}
                      >
                        {item.tipe === 'walkin' ? 'Walk-in' : 'Booking'}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-stone-100">
                        {item.kodeAtauNomor}
                      </span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-400 font-mono">
                        {formatShortDateIndo(item.tanggal)}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-stone-100">
                      {item.namaPelanggan}
                    </p>
                    <p className="text-xs text-zinc-300">{item.layananText}</p>
                    {item.catatan && (
                      <p className="text-xs text-rose-300">{item.catatan}</p>
                    )}
                  </div>

                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <StatusIndicator status={item.status} compact />
                    <div className="text-right text-xs font-mono tabular-nums text-zinc-400">
                      {(item.jamMulai || item.jamSelesai) && (
                        <p>
                          {item.jamMulai || '-'} – {item.jamSelesai || '-'} WIB
                        </p>
                      )}
                      {item.status === 'Selesai' && item.durasiAktual && (
                        <p className="text-emerald-400 font-semibold">
                          Durasi {item.durasiAktual} menit
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: ATUR JADWAL SAYA & KUOTA WALK-IN */}
      {activeTab === 'jadwal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-8 p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <CalendarCog className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h2 className="font-display text-lg font-semibold text-stone-100">
                    Atur Jadwal Saya ({loggedInCapster.nama})
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Tandai slot istirahat/izin atau pesanan manual (chat/tamu
                    langsung). Perubahan langsung tampil ke pelanggan.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">
                Pilih Tanggal Jadwal (Hari Ini – 6 Hari ke Depan)
              </label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dateOptions.map((dt, idx) => {
                  const active = dt === effectiveSchedDate;
                  return (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => {
                        setSchedDate(dt);
                        setEditingSlotJam(null);
                        setPendingConflict(null);
                      }}
                      className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        active
                          ? 'bg-amber-400 text-zinc-950 border-amber-400 font-semibold'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {idx === 0
                        ? 'Hari Ini'
                        : idx === 1
                          ? 'Besok'
                          : formatShortDateIndo(dt)}
                    </button>
                  );
                })}
              </div>
            </div>

            {pendingConflict && (
              <div className="p-4 sm:p-5 rounded-xl bg-rose-950/50 border border-rose-500/50 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs sm:text-sm">
                    <p className="font-semibold text-rose-200">
                      Konfirmasi Pembatalan Booking Pelanggan
                    </p>
                    <p className="text-rose-100/90">{pendingConflict.message}</p>
                    <ul className="pt-1 space-y-1 text-xs font-mono text-rose-200">
                      {pendingConflict.conflicts.map((cb) => (
                        <li key={cb.id}>
                          • {cb.kodeTiket} — {cb.nama} (pukul {cb.jamSlot} WIB)
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={handleConfirmConflictCancellation}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold"
                  >
                    Batalkan Booking Pelanggan &amp; Terapkan
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingConflict(null)}
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-zinc-900/75 border border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <CalendarOff className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-stone-100">
                      Libur / Izin Satu Hari Penuh (
                      {formatDateIndo(effectiveSchedDate)})
                    </p>
                    <p className="text-xs text-zinc-400">
                      Jam operasional baku:{' '}
                      <span className="font-mono">
                        {editConfig.jamKerja.buka.replace(':', '.')} –{' '}
                        {editConfig.jamKerja.tutup.replace(':', '.')} WIB
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleDayOff(false)}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    editConfig.isLibur
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                      : 'bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-500/40'
                  }`}
                >
                  {editConfig.isLibur
                    ? 'Batalkan Libur (Aktifkan Hari Ini)'
                    : 'Tandai Libur Seharian'}
                </button>
              </div>

              {!editConfig.isLibur && (
                <input
                  type="text"
                  value={dayOffReason}
                  onChange={(e) => setDayOffReason(e.target.value)}
                  placeholder="Alasan libur/izin opsional (misal: Acara keluarga)"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-stone-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                />
              )}
            </div>

            {!editConfig.isLibur && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">
                  Klik salah satu slot jam untuk mengatur status{' '}
                  <strong className="text-emerald-300">Tersedia</strong>,{' '}
                  <strong className="text-zinc-200">Tidak Tersedia</strong>,
                  atau <strong className="text-rose-300">Terisi Manual</strong>:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {editSlots.map((slot) => {
                    const isEditing = editingSlotJam === slot.jam;
                    const manual = editConfig.manualSlots[slot.jam];
                    const hasBooking = Boolean(slot.bookingId);

                    let badgeText = 'Tersedia';
                    let cardStyle =
                      'bg-emerald-500/10 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/18';

                    if (manual?.tipe === 'tidak_tersedia') {
                      badgeText = 'Tidak Tersedia';
                      cardStyle =
                        'bg-zinc-900 border-zinc-600 text-zinc-300 hover:border-zinc-500';
                    } else if (manual?.tipe === 'terisi_manual') {
                      badgeText = 'Terisi Manual';
                      cardStyle =
                        'bg-rose-500/15 border-rose-500/45 text-rose-300 hover:bg-rose-500/20';
                    } else if (hasBooking) {
                      badgeText = 'Booking Pelanggan';
                      cardStyle =
                        'bg-sky-500/12 border-sky-500/40 text-sky-300 hover:bg-sky-500/20';
                    } else if (slot.sudahLewat) {
                      badgeText = 'Sudah Lewat';
                      cardStyle =
                        'bg-zinc-900/60 border-zinc-800 text-zinc-500';
                    }

                    return (
                      <button
                        key={slot.jam}
                        type="button"
                        onClick={() => {
                          setEditingSlotJam(slot.jam);
                          setSlotModeDraft(
                            manual?.tipe || 'tidak_tersedia'
                          );
                          setSlotNoteDraft(manual?.catatan || '');
                          setPendingConflict(null);
                        }}
                        className={`min-h-[68px] p-3 rounded-xl border text-left space-y-1 transition-all ${cardStyle} ${
                          isEditing ? 'ring-2 ring-amber-400' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-bold">
                            {slot.jam}
                          </span>
                          {manual?.tipe === 'tidak_tersedia' ? (
                            <Ban className="w-3.5 h-3.5" />
                          ) : manual?.tipe === 'terisi_manual' || hasBooking ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <p className="text-[11px] font-semibold truncate">
                          {badgeText}
                        </p>
                        {(manual?.catatan || slot.bookingNama) && (
                          <p className="text-[10px] opacity-80 truncate">
                            {manual?.catatan || slot.bookingNama}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>

                {editingSlotJam && (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-amber-400/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-stone-100">
                        Atur Slot Pukul{' '}
                        <span className="font-mono text-amber-400">
                          {editingSlotJam} WIB
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setEditingSlotJam(null)}
                        className="text-xs text-zinc-400 hover:text-stone-200 min-h-[36px] px-2"
                      >
                        Tutup
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(
                        [
                          {
                            id: 'tersedia',
                            label: 'Tersedia (Normal)',
                          },
                          {
                            id: 'tidak_tersedia',
                            label: 'Tidak Tersedia (Istirahat/Izin)',
                          },
                          {
                            id: 'terisi_manual',
                            label: 'Terisi Manual (Tamu Langsung/Chat)',
                          },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSlotModeDraft(opt.id)}
                          className={`min-h-[44px] p-2.5 rounded-lg border text-xs font-medium text-left transition-colors ${
                            slotModeDraft === opt.id
                              ? 'bg-amber-400/15 border-amber-400 text-amber-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {slotModeDraft !== 'tersedia' && (
                      <input
                        type="text"
                        value={slotNoteDraft}
                        onChange={(e) => setSlotNoteDraft(e.target.value)}
                        placeholder={
                          slotModeDraft === 'terisi_manual'
                            ? 'Nama tamu / catatan opsional (misal: Tamu via WA)'
                            : 'Alasan istirahat/izin opsional'
                        }
                        className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-stone-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
                      />
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleApplySlotManual(
                            editingSlotJam,
                            slotModeDraft,
                            slotNoteDraft,
                            false
                          )
                        }
                        className="min-h-[44px] px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold"
                      >
                        Simpan Status Slot
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSlotJam(null)}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="lg:col-span-4 p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5 self-start">
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="w-5 h-5 text-amber-400" />
              <h2 className="font-display text-lg font-semibold text-stone-100">
                Kuota Walk-in Harian
              </h2>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Batas maksimal antrean walk-in untuk sesi operasional{' '}
              <strong className="text-stone-200">
                {formatDateIndo(operationalDayKey)}
              </strong>
              . Kuota otomatis reset setiap hari pada jam buka.
            </p>

            <div className="p-3.5 rounded-xl bg-zinc-900/75 border border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Terpakai saat ini</span>
              <span className="font-mono tabular-nums font-bold text-stone-100">
                {todayQuota.kuotaTerpakai} / {todayQuota.kuotaMaksimal}
              </span>
            </div>

            <div className="space-y-3">
              <label
                htmlFor="quota-input"
                className="block text-xs font-medium text-zinc-300"
              >
                Kuota Maksimal (Default: {WALKIN_DAILY_QUOTA})
              </label>
              <div className="flex gap-2">
                <input
                  id="quota-input"
                  type="number"
                  min={0}
                  max={200}
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(Number(e.target.value))}
                  className="w-28 min-h-[46px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    handleActionResult(
                      onUpdateQuota(operationalDayKey, quotaInput),
                      `Kuota walk-in harian diperbarui menjadi ${quotaInput}.`
                    )
                  }
                  className="flex-1 min-h-[46px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold"
                >
                  Simpan Kuota
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setQuotaInput(WALKIN_DAILY_QUOTA);
                  handleActionResult(
                    onUpdateQuota(operationalDayKey, WALKIN_DAILY_QUOTA),
                    `Kuota walk-in dikembalikan ke standar (${WALKIN_DAILY_QUOTA}).`
                  );
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300"
              >
                Kembalikan ke Default ({WALKIN_DAILY_QUOTA})
              </button>
            </div>

            <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-400 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Jika kuota penuh, pelanggan diarahkan untuk booking di hari
                berikutnya.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Akses terlindungi khusus akun capster aktif.</span>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: KELOLA PROMO (KHUSUS CAPSTER) */}
      {activeTab === 'promo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 space-y-4">
            <div className="p-5 rounded-2xl bg-[#131317] border border-zinc-800/90 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  Daftar Promo Layanan
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Hanya capster yang dapat menambah, mengedit, menonaktifkan,
                  atau menghapus promo.
                </p>
              </div>
              <span className="font-mono tabular-nums text-xs text-amber-300 shrink-0">
                {(dbState.promos || []).length} promo
              </span>
            </div>

            {(dbState.promos || []).length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#131317] border border-zinc-800/80 text-center text-sm text-zinc-400">
                Belum ada promo tersimpan. Buat promo baru melalui formulir di
                samping.
              </div>
            ) : (
              <div className="space-y-3">
                {(dbState.promos || []).map((promo: Promo) => {
                  const activeNow = isPromoActiveNow(promo, nowMs);
                  const serviceNames = promo.layananId
                    .map((id) => {
                      const item = findServiceItemById(id);
                      if (!item) return id;
                      return item.kategoriNama === item.nama
                        ? item.nama
                        : `${item.kategoriNama} — ${item.nama}`;
                    })
                    .join(', ');

                  return (
                    <div
                      key={promo.id}
                      className="p-5 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display font-bold text-base text-stone-100">
                              {promo.judul}
                            </h3>
                            <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 text-[11px] font-bold font-mono tabular-nums">
                              {formatPromoShortBadge(promo)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${
                                activeNow
                                  ? 'bg-emerald-500/12 border-emerald-500/35 text-emerald-300'
                                  : promo.aktif
                                    ? 'bg-amber-500/12 border-amber-500/35 text-amber-300'
                                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                              }`}
                            >
                              {activeNow
                                ? 'Aktif di Pelanggan'
                                : promo.aktif
                                  ? 'Terjadwal / Luar Tanggal'
                                  : 'Nonaktif'}
                            </span>
                          </div>

                          {promo.deskripsi && (
                            <p className="text-xs text-zinc-300 leading-relaxed">
                              {promo.deskripsi}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-zinc-900/75 border border-zinc-800 text-xs space-y-1">
                        <p className="text-zinc-400">
                          Berlaku untuk layanan:{' '}
                          <span className="text-stone-100 font-medium">
                            {serviceNames}
                          </span>
                        </p>
                        {(promo.berlakuDari || promo.berlakuSampai) && (
                          <p className="text-zinc-400 font-mono">
                            Periode:{' '}
                            {promo.berlakuDari
                              ? formatShortDateIndo(promo.berlakuDari)
                              : 'Sekarang'}{' '}
                            –{' '}
                            {promo.berlakuSampai
                              ? formatShortDateIndo(promo.berlakuSampai)
                              : 'Seterusnya'}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-zinc-500">
                          Diperbarui oleh {promo.diperbaruiOleh}
                        </span>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleActionResult(
                                onTogglePromoActive(promo.id),
                                promo.aktif
                                  ? `Promo "${promo.judul}" dinonaktifkan.`
                                  : `Promo "${promo.judul}" diaktifkan.`
                              )
                            }
                            className={`min-h-[42px] px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                              promo.aktif
                                ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                                : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300'
                            }`}
                          >
                            {promo.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingPromoId(promo.id);
                              setPromoJudul(promo.judul);
                              setPromoDeskripsi(promo.deskripsi);
                              setPromoLayananIds(promo.layananId);
                              setPromoDiskonMin(promo.diskonMin);
                              setPromoDiskonMax(promo.diskonMax);
                              setPromoBerlakuDari(promo.berlakuDari || '');
                              setPromoBerlakuSampai(promo.berlakuSampai || '');
                              setPromoAktif(promo.aktif);
                              setPromoFormError(null);
                            }}
                            className="min-h-[42px] px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-amber-300 text-xs font-medium flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {confirmDeletePromoId === promo.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  handleActionResult(
                                    onDeletePromo(promo.id),
                                    `Promo "${promo.judul}" dihapus.`
                                  );
                                  setConfirmDeletePromoId(null);
                                  if (editingPromoId === promo.id) {
                                    setEditingPromoId(null);
                                  }
                                }}
                                className="min-h-[42px] px-3.5 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePromoId(null)}
                                className="min-h-[42px] px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePromoId(promo.id)}
                              className="min-h-[42px] px-3.5 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Hapus</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-4 self-start">
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  {editingPromoId ? 'Edit Promo' : 'Buat Promo Baru'}
                </h2>
              </div>
              {editingPromoId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPromoId(null);
                    setPromoJudul('');
                    setPromoDeskripsi('');
                    setPromoLayananIds(['premium-haircut']);
                    setPromoDiskonMin(20);
                    setPromoDiskonMax(30);
                    setPromoBerlakuDari('');
                    setPromoBerlakuSampai('');
                    setPromoAktif(true);
                    setPromoFormError(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-stone-200"
                >
                  Batal Edit
                </button>
              )}
            </div>

            {promoFormError && (
              <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/45 text-xs text-rose-200">
                {promoFormError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPromoFormError(null);

                const payload = {
                  judul: promoJudul,
                  deskripsi: promoDeskripsi,
                  layananId: promoLayananIds,
                  diskonMin: promoDiskonMin,
                  diskonMax: promoDiskonMax,
                  aktif: promoAktif,
                  berlakuDari: promoBerlakuDari || undefined,
                  berlakuSampai: promoBerlakuSampai || undefined,
                };

                const res = editingPromoId
                  ? onUpdatePromo(editingPromoId, payload)
                  : onCreatePromo(payload);

                if (!res.ok) {
                  setPromoFormError(
                    res.message || 'Gagal menyimpan promo. Periksa input Anda.'
                  );
                  return;
                }

                handleActionResult(
                  res,
                  editingPromoId
                    ? `Promo "${promoJudul.trim()}" berhasil diperbarui.`
                    : `Promo baru "${promoJudul.trim()}" berhasil dibuat.`
                );
                setEditingPromoId(null);
                setPromoJudul('');
                setPromoDeskripsi('');
                setPromoLayananIds(['premium-haircut']);
                setPromoDiskonMin(20);
                setPromoDiskonMax(30);
                setPromoBerlakuDari('');
                setPromoBerlakuSampai('');
                setPromoAktif(true);
              }}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="promo-judul"
                  className="block text-xs font-medium text-zinc-300 mb-1.5"
                >
                  Judul Promo
                </label>
                <input
                  id="promo-judul"
                  type="text"
                  required
                  value={promoJudul}
                  onChange={(e) => setPromoJudul(e.target.value)}
                  placeholder="Contoh: Potong Saja / Promo Akhir Pekan"
                  className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label
                  htmlFor="promo-deskripsi"
                  className="block text-xs font-medium text-zinc-300 mb-1.5"
                >
                  Deskripsi Singkat
                </label>
                <textarea
                  id="promo-deskripsi"
                  rows={2}
                  value={promoDeskripsi}
                  onChange={(e) => setPromoDeskripsi(e.target.value)}
                  placeholder="Keterangan promo untuk pelanggan"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="promo-min"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Diskon Minimal (%)
                  </label>
                  <input
                    id="promo-min"
                    type="number"
                    min={0}
                    max={100}
                    value={promoDiskonMin}
                    onChange={(e) => setPromoDiskonMin(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 font-mono text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="promo-max"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Diskon Maksimal (%)
                  </label>
                  <input
                    id="promo-max"
                    type="number"
                    min={0}
                    max={100}
                    value={promoDiskonMax}
                    onChange={(e) => setPromoDiskonMax(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 font-mono text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-300">
                  Pilih Layanan yang Mendapat Promo
                </p>
                <div className="max-h-52 overflow-y-auto p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2.5">
                  {SERVICE_CATALOG.map((cat) => (
                    <div key={cat.id} className="space-y-1">
                      <p className="text-[11px] font-semibold text-amber-400">
                        {cat.nama}
                      </p>
                      <div className="space-y-1">
                        {cat.items.map((item) => {
                          const checked = promoLayananIds.includes(item.id);
                          return (
                            <label
                              key={item.id}
                              className="flex items-center gap-2 text-xs text-stone-200 cursor-pointer py-1"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setPromoLayananIds((prev) =>
                                    prev.includes(item.id)
                                      ? prev.filter((x) => x !== item.id)
                                      : [...prev, item.id]
                                  )
                                }
                                className="rounded border-zinc-600 bg-zinc-950 text-amber-400 focus:ring-amber-400"
                              />
                              <span>{item.nama}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="promo-dari"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Berlaku Dari (Opsional)
                  </label>
                  <input
                    id="promo-dari"
                    type="date"
                    value={promoBerlakuDari}
                    onChange={(e) => setPromoBerlakuDari(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="promo-sampai"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Berlaku Sampai (Opsional)
                  </label>
                  <input
                    id="promo-sampai"
                    type="date"
                    value={promoBerlakuSampai}
                    onChange={(e) => setPromoBerlakuSampai(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-xs text-stone-200 cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={promoAktif}
                  onChange={(e) => setPromoAktif(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-950 text-amber-400 focus:ring-amber-400"
                />
                <span>Promo langsung aktif dan tampil ke pelanggan</span>
              </label>

              <button
                type="submit"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-semibold transition-colors"
              >
                {editingPromoId ? 'Simpan Perubahan Promo' : 'Simpan Promo Baru'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* TAB 5: PROFIL & ABOUT CAPSTER */}
      {activeTab === 'profil' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6 self-start">
            <section className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-4">
              <div className="border-b border-zinc-800 pb-3">
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  Edit Profil &amp; About Capster
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Perubahan langsung tampil pada bagian Tentang Capster di
                  Beranda dan halaman Booking pelanggan.
                </p>
              </div>

              {profileFormError && (
                <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/45 text-xs text-rose-200">
                  {profileFormError}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setProfileFormError(null);
                  const res = onUpdateCapsterProfile({
                    pengalaman: profPengalaman,
                    nomorWhatsApp: profWa,
                    instagramCapster: profIgCapster,
                    instagramBarbershop: profIgShop,
                  });
                  if (!res.ok) {
                    setProfileFormError(
                      res.message || 'Gagal memperbarui profil capster.'
                    );
                    return;
                  }
                  handleActionResult(
                    res,
                    'Profil & About Capster berhasil diperbarui.'
                  );
                }}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="capster-prof-exp"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Teks Pengalaman
                  </label>
                  <textarea
                    id="capster-prof-exp"
                    rows={3}
                    required
                    value={profPengalaman}
                    onChange={(e) => setProfPengalaman(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="capster-prof-wa"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Nomor WhatsApp Capster
                  </label>
                  <input
                    id="capster-prof-wa"
                    type="tel"
                    required
                    value={profWa}
                    onChange={(e) => setProfWa(e.target.value)}
                    placeholder="083869157107"
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 font-mono text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="capster-prof-ig"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Instagram Capster
                  </label>
                  <input
                    id="capster-prof-ig"
                    type="text"
                    required
                    value={profIgCapster}
                    onChange={(e) => setProfIgCapster(e.target.value)}
                    placeholder="sanrascals_027"
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="capster-prof-shop-ig"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Instagram Barbershop
                  </label>
                  <input
                    id="capster-prof-shop-ig"
                    type="text"
                    required
                    value={profIgShop}
                    onChange={(e) => setProfIgShop(e.target.value)}
                    placeholder="waktu_indonesia_bercukur"
                    className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Profil Capster</span>
                </button>
              </form>
            </section>

            {/* GANTI PASSWORD AKUN CAPSTER */}
            <section className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-4">
              <div className="border-b border-zinc-800 pb-3 flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h2 className="font-display text-lg font-semibold text-stone-100">
                    Ganti Password
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Perbarui password login capster ({loggedInCapster.username}
                    ) untuk keamanan akun Anda.
                  </p>
                </div>
              </div>

              {capsterPwdError && (
                <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/45 text-xs text-rose-200">
                  {capsterPwdError}
                </div>
              )}

              {capsterPwdSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/45 text-xs text-emerald-200">
                  {capsterPwdSuccess}
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCapsterPwdError(null);
                  setCapsterPwdSuccess(null);

                  if (!capsterCurrPwd) {
                    setCapsterPwdError('Password saat ini wajib diisi.');
                    return;
                  }
                  if (capsterNewPwd.length < 6) {
                    setCapsterPwdError(
                      'Password baru wajib minimal 6 karakter.'
                    );
                    return;
                  }
                  if (capsterNewPwd !== capsterConfirmPwd) {
                    setCapsterPwdError('Konfirmasi password baru tidak sama.');
                    return;
                  }

                  const res = onChangeCapsterPassword({
                    currentPassword: capsterCurrPwd,
                    newPassword: capsterNewPwd,
                    confirmPassword: capsterConfirmPwd,
                  });

                  if (!res.ok) {
                    setCapsterPwdError(
                      res.message || 'Gagal mengganti password capster.'
                    );
                    return;
                  }

                  setCapsterCurrPwd('');
                  setCapsterNewPwd('');
                  setCapsterConfirmPwd('');
                  setCapsterPwdSuccess(
                    'Password capster berhasil diperbarui.'
                  );
                  handleActionResult(
                    res,
                    'Password capster berhasil diperbarui.'
                  );
                }}
                className="space-y-3.5"
              >
                <div>
                  <label
                    htmlFor="capster-curr-pwd"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Password Saat Ini
                  </label>
                  <div className="relative">
                    <input
                      id="capster-curr-pwd"
                      type={showCapCurrPwd ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={capsterCurrPwd}
                      onChange={(e) => setCapsterCurrPwd(e.target.value)}
                      placeholder="Masukkan password saat ini"
                      className="w-full min-h-[46px] pl-3.5 pr-11 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCapCurrPwd((p) => !p)}
                      aria-label={
                        showCapCurrPwd
                          ? 'Sembunyikan password saat ini'
                          : 'Tampilkan password saat ini'
                      }
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-stone-100"
                    >
                      {showCapCurrPwd ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="capster-new-pwd"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Password Baru (Min. 6 Karakter)
                  </label>
                  <div className="relative">
                    <input
                      id="capster-new-pwd"
                      type={showCapNewPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={capsterNewPwd}
                      onChange={(e) => setCapsterNewPwd(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full min-h-[46px] pl-3.5 pr-11 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCapNewPwd((p) => !p)}
                      aria-label={
                        showCapNewPwd
                          ? 'Sembunyikan password baru'
                          : 'Tampilkan password baru'
                      }
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-stone-100"
                    >
                      {showCapNewPwd ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="capster-confirm-pwd"
                    className="block text-xs font-medium text-zinc-300 mb-1.5"
                  >
                    Konfirmasi Password Baru
                  </label>
                  <div className="relative">
                    <input
                      id="capster-confirm-pwd"
                      type={showCapConfirmPwd ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={capsterConfirmPwd}
                      onChange={(e) => setCapsterConfirmPwd(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="w-full min-h-[46px] pl-3.5 pr-11 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCapConfirmPwd((p) => !p)}
                      aria-label={
                        showCapConfirmPwd
                          ? 'Sembunyikan konfirmasi password'
                          : 'Tampilkan konfirmasi password'
                      }
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-stone-100"
                    >
                      {showCapConfirmPwd ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-stone-100 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Simpan Password Baru</span>
                </button>
              </form>
            </section>
          </div>

          <div className="lg:col-span-7">
            <AboutCapster
              profile={{
                ...capsterProfile,
                pengalaman: profPengalaman || capsterProfile.pengalaman,
                nomorWhatsApp: profWa || capsterProfile.nomorWhatsApp,
                instagramCapster:
                  profIgCapster || capsterProfile.instagramCapster,
                instagramBarbershop:
                  profIgShop || capsterProfile.instagramBarbershop,
              }}
              spesialisasi={loggedInCapster.spesialisasi}
              variant="full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
