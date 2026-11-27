'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  CheckCircle2,
  Clock,
  RefreshCw,
  Scissors,
  Ticket,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import {
  addDaysYYYYMMDD,
  barberService,
  formatDateIndo,
  formatShortDateIndo,
  formatTimeHHMM,
  parseSlotEpochMs,
} from '@/lib/barber-service';
import {
  AppView,
  BarberDatabaseState,
  Customer,
  DataBooking,
  QueueEstimationSummary,
  ServiceResult,
} from '@/lib/types';
import { CapsterAvatar } from './BarbershopMedia';
import { StatusIndicator } from './StatusIndicator';

interface MyQueueViewProps {
  dbState: BarberDatabaseState;
  todayStr: string;
  effectiveNowMs: number;
  queueEstimation: QueueEstimationSummary;
  currentCustomer: Customer;
  isOffline: boolean;
  lastSyncedFormatted: string;
  onRefresh: () => void;
  onCancelWalkin: (walkinId: string) => ServiceResult<BarberDatabaseState>;
  onRescheduleBooking: (params: {
    bookingId: string;
    newCapsterId: string;
    newTanggal: string;
    newJamSlot: string;
  }) => ServiceResult<{ booking: DataBooking; state: BarberDatabaseState }>;
  onCancelBooking: (bookingId: string) => ServiceResult<BarberDatabaseState>;
  onNavigate: (view: AppView) => void;
}

export function MyQueueView({
  dbState,
  todayStr,
  effectiveNowMs,
  queueEstimation,
  currentCustomer,
  isOffline,
  lastSyncedFormatted,
  onRefresh,
  onCancelWalkin,
  onRescheduleBooking,
  onCancelBooking,
  onNavigate,
}: MyQueueViewProps) {
  const [confirmCancelWalkinId, setConfirmCancelWalkinId] = useState<
    string | null
  >(null);
  const [confirmCancelBookingId, setConfirmCancelBookingId] = useState<
    string | null
  >(null);
  const [reschedulingBooking, setReschedulingBooking] =
    useState<DataBooking | null>(null);
  const [reschedCapsterId, setReschedCapsterId] = useState<string>('hasan');
  const [reschedDate, setReschedDate] = useState<string>(todayStr);
  const [reschedSlot, setReschedSlot] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const getCapsterName = (id?: string) => {
    if (!id) return 'Capster tersedia';
    return dbState.capsters.find((c) => c.id === id)?.nama || id;
  };

  // Walk-in aktif milik pelanggan hari ini
  const myActiveWalkin = dbState.walkinQueue.find(
    (w) =>
      w.customerId === currentCustomer.id &&
      w.tanggal === todayStr &&
      (w.status === 'Waiting' || w.status === 'In-Service')
  );

  // Booking aktif & mendatang milik pelanggan
  const myActiveBookings = dbState.bookings
    .filter(
      (b) =>
        b.customerId === currentCustomer.id &&
        (b.status === 'Booked' || b.status === 'In-Service')
    )
    .sort((a, b) =>
      `${a.tanggal}_${a.jamSlot}`.localeCompare(`${b.tanggal}_${b.jamSlot}`)
    );

  // Notifikasi booking yang dibatalkan otomatis karena telat > 15 menit
  const myAutoCanceledBookings = dbState.bookings
    .filter(
      (b) =>
        b.customerId === currentCustomer.id &&
        b.status === 'Canceled' &&
        b.alasanBatal === 'otomatis'
    )
    .sort((a, b) => b.waktuDibuat - a.waktuDibuat);

  // Riwayat (Selesai / Canceled)
  const myWalkinHistory = dbState.walkinQueue
    .filter(
      (w) =>
        w.customerId === currentCustomer.id &&
        (w.status === 'Selesai' || w.status === 'Canceled')
    )
    .sort((a, b) => b.waktuAmbil - a.waktuAmbil);

  const myBookingHistory = dbState.bookings
    .filter(
      (b) =>
        b.customerId === currentCustomer.id &&
        (b.status === 'Selesai' || b.status === 'Canceled')
    )
    .sort((a, b) => b.waktuDibuat - a.waktuDibuat);

  // Posisi walk-in
  const waitingPosIndex = myActiveWalkin
    ? queueEstimation.waitingList.findIndex((w) => w.id === myActiveWalkin.id)
    : -1;
  const antreanDiDepan = waitingPosIndex >= 0 ? waitingPosIndex : 0;
  const posisiSaatIni = waitingPosIndex >= 0 ? waitingPosIndex + 1 : 0;
  const estimasiMenit = antreanDiDepan * queueEstimation.rataRataDurasiMenit;

  const sedangDipanggil =
    queueEstimation.sedangDilayaniWalkin[0]?.nomorAntrean || 'Belum ada';

  // Hitung mundur menuju jam slot
  const formatCountdown = (tanggal: string, jamSlot: string) => {
    const slotMs = parseSlotEpochMs(tanggal, jamSlot);
    const diffMin = Math.round((slotMs - effectiveNowMs) / 60_000);
    if (diffMin > 60) {
      const jam = Math.floor(diffMin / 60);
      const sisa = diffMin % 60;
      return `${jam} jam ${sisa} menit lagi`;
    }
    if (diffMin > 0) {
      return `${diffMin} menit lagi`;
    }
    const telatMin = Math.abs(diffMin);
    if (telatMin <= 15) {
      return `Lewat ${telatMin} menit (toleransi sisa ${15 - telatMin} mnt)`;
    }
    return `Terlambat ${telatMin} menit`;
  };

  const canReschedule = (b: DataBooking) => {
    if (b.status !== 'Booked') return false;
    const slotMs = parseSlotEpochMs(b.tanggal, b.jamSlot);
    return effectiveNowMs <= slotMs - 60 * 60_000;
  };

  const openReschedulePicker = (b: DataBooking) => {
    setReschedulingBooking(b);
    setReschedCapsterId(b.capsterId);
    setReschedDate(b.tanggal >= todayStr ? b.tanggal : todayStr);
    setReschedSlot('');
    setActionMsg(null);
  };

  const handleConfirmReschedule = () => {
    if (!reschedulingBooking || !reschedSlot) return;
    const res = onRescheduleBooking({
      bookingId: reschedulingBooking.id,
      newCapsterId: reschedCapsterId,
      newTanggal: reschedDate,
      newJamSlot: reschedSlot,
    });
    if (!res.ok) {
      setActionMsg({
        type: 'error',
        text: res.message || 'Gagal mengubah jadwal.',
      });
      return;
    }
    setActionMsg({
      type: 'success',
      text: `Jadwal booking ${reschedulingBooking.kodeTiket} berhasil dipindah ke ${getCapsterName(
        reschedCapsterId
      )} (${formatShortDateIndo(reschedDate)} · ${reschedSlot} WIB).`,
    });
    setReschedulingBooking(null);
  };

  const dateOptions = Array.from({ length: 7 }, (_, i) =>
    addDaysYYYYMMDD(todayStr, i)
  );
  const reschedSchedule = barberService.getComputedSlots(
    dbState,
    reschedCapsterId,
    reschedDate
  );

  return (
    <div className="space-y-8">
      {/* Header & Refresh Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
            Antrean &amp; Jadwal Saya
          </h1>
          <p className="text-sm text-zinc-400">
            Halo, <strong className="text-stone-200">{currentCustomer.nama}</strong>{' '}
            · Pantau posisi antrean dan kelola jadwal booking Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 ${
              isOffline
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                : 'bg-[#131317] border-zinc-800 text-zinc-300'
            }`}
          >
            {isOffline ? (
              <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-mono tabular-nums whitespace-nowrap">
              Terakhir diperbarui: {lastSyncedFormatted} WIB
            </span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isOffline}
            className="min-h-[38px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700 text-stone-100 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Perbarui Sekarang</span>
          </button>
        </div>
      </div>

      {/* Offline Banner */}
      {isOffline && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3">
          <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100 space-y-0.5">
            <p className="font-semibold">
              Koneksi terputus — menampilkan data terakhir
            </p>
            <p className="text-xs text-amber-200/80">
              Terakhir diperbarui: {lastSyncedFormatted} WIB. Sambungkan kembali
              untuk memperbarui atau mengubah jadwal.
            </p>
          </div>
        </div>
      )}

      {/* Action feedback */}
      {actionMsg && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-2.5 ${
            actionMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
          }`}
        >
          {actionMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {/* Notifikasi Pembatalan Otomatis (>15 menit) */}
      {myAutoCanceledBookings.length > 0 && (
        <div className="p-4 sm:p-5 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-rose-200">
                Pemberitahuan Pembatalan Otomatis ({myAutoCanceledBookings[0].kodeTiket})
              </p>
              <p className="text-xs text-rose-100/85 leading-relaxed">
                Booking Anda pada{' '}
                {formatShortDateIndo(myAutoCanceledBookings[0].tanggal)} pukul{' '}
                {myAutoCanceledBookings[0].jamSlot} WIB dibatalkan otomatis
                karena melewati toleransi keterlambatan 15 menit. Slot telah
                dibuka kembali.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* A. KARTU ANTREAN WALK-IN AKTIF */}
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-stone-100">
          Antrean Walk-in Aktif
        </h2>

        {myActiveWalkin ? (
          <div className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-amber-500/40 space-y-5">
            {/* Notifikasi khusus hampir tiba (<= 2 antrean di depan) / dipanggil */}
            {myActiveWalkin.status === 'In-Service' && (
              <div className="p-4 rounded-xl bg-sky-500/15 border border-sky-400/50 flex items-center gap-3 text-sky-200">
                <Scissors className="w-5 h-5 text-sky-300 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">
                    Giliran Anda Sedang Dipanggil!
                  </p>
                  <p className="text-xs text-sky-200/85">
                    Silakan menuju kursi Capster{' '}
                    {getCapsterName(myActiveWalkin.capsterId)}.
                  </p>
                </div>
              </div>
            )}

            {myActiveWalkin.status === 'Waiting' && antreanDiDepan <= 2 && (
              <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-400/50 flex items-center gap-3 text-amber-100">
                <BellRing className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-amber-300">
                    Bersiaplah, giliran Anda hampir tiba
                  </p>
                  <p className="text-xs text-amber-100/85">
                    {antreanDiDepan === 0
                      ? 'Anda berada di antrean paling depan berikutnya.'
                      : `Tinggal ${antreanDiDepan} antrean lagi di depan Anda.`}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-xs text-zinc-400">Nomor Anda</p>
                <p className="font-mono tabular-nums text-3xl font-bold text-amber-400 mt-1">
                  {myActiveWalkin.nomorAntrean}
                </p>
                <div className="mt-2">
                  <StatusIndicator status={myActiveWalkin.status} compact />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-xs text-zinc-400">Sedang Dipanggil</p>
                <p className="font-mono tabular-nums text-2xl font-bold text-sky-300 mt-1">
                  {sedangDipanggil}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Di kursi cukur
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-xs text-zinc-400">Antrean di Depan</p>
                <p className="font-mono tabular-nums text-2xl font-bold text-stone-100 mt-1">
                  {myActiveWalkin.status === 'Waiting'
                    ? `${antreanDiDepan} org`
                    : '0 org'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {myActiveWalkin.status === 'Waiting'
                    ? `Posisi ke-${posisiSaatIni}`
                    : 'Sedang dilayani'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                <p className="text-xs text-zinc-400">Estimasi Tunggu</p>
                <p className="font-mono tabular-nums text-2xl font-bold text-amber-300 mt-1">
                  {myActiveWalkin.status === 'Waiting'
                    ? `${estimasiMenit} mnt`
                    : '0 mnt'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1 font-mono tabular-nums">
                  {myActiveWalkin.status === 'Waiting'
                    ? `${antreanDiDepan} × ${queueEstimation.rataRataDurasiMenit} mnt`
                    : 'Giliran Anda'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-400 font-mono tabular-nums">
                Diambil pukul {formatTimeHHMM(myActiveWalkin.waktuAmbil)} WIB ·{' '}
                {queueEstimation.menggunakanDefault
                  ? 'Menggunakan rata-rata standar 45 mnt'
                  : `Rata-rata ${queueEstimation.rataRataDurasiMenit} mnt dari ${queueEstimation.jumlahSelesaiHariIni} layanan selesai`}
              </p>

              {myActiveWalkin.status === 'Waiting' && (
                <div className="flex items-center gap-2">
                  {confirmCancelWalkinId === myActiveWalkin.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-300">
                        Yakin batalkan antrean?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const res = onCancelWalkin(myActiveWalkin.id);
                          setConfirmCancelWalkinId(null);
                          setActionMsg({
                            type: res.ok ? 'success' : 'error',
                            text: res.ok
                              ? `Antrean ${myActiveWalkin.nomorAntrean} telah dibatalkan.`
                              : res.message || 'Gagal membatalkan antrean.',
                          });
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold"
                      >
                        Ya, Batalkan
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmCancelWalkinId(null)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                      >
                        Tidak
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmCancelWalkinId(myActiveWalkin.id)
                      }
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Batalkan Antrean</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#131317] border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-semibold text-base text-stone-100">
                Anda belum punya antrean aktif
              </p>
              <p className="text-xs sm:text-sm text-zinc-400">
                Ambil nomor antrean walk-in hari ini atau pesan jadwal capster
                lebih dulu.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('antrean')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs sm:text-sm font-semibold flex items-center gap-1.5"
              >
                <Ticket className="w-4 h-4" />
                <span>Ambil Antrean</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('booking')}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-stone-100 text-xs sm:text-sm font-medium flex items-center gap-1.5"
              >
                <CalendarCheck className="w-4 h-4 text-amber-400" />
                <span>Booking Capster</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* B. KARTU BOOKING AKTIF & MENDATANG */}
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-stone-100">
          Booking Aktif &amp; Mendatang
        </h2>

        {myActiveBookings.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="font-semibold text-sm sm:text-base text-stone-100">
                Belum ada booking aktif atau mendatang
              </p>
              <p className="text-xs text-zinc-400">
                Pilih slot kosong capster favorit Anda agar tidak perlu antre
                di tempat.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('booking')}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-stone-100 text-xs sm:text-sm font-medium flex items-center gap-1.5 self-start sm:self-auto"
            >
              <CalendarCheck className="w-4 h-4 text-amber-400" />
              <span>Buat Booking</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {myActiveBookings.map((b) => {
              const allowedReschedule = canReschedule(b);
              const isConfirmingCancel = confirmCancelBookingId === b.id;

              return (
                <div
                  key={b.id}
                  className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                    <div>
                      <p className="font-mono tabular-nums text-xs text-amber-400 font-semibold">
                        {b.kodeTiket}
                      </p>
                      <h3 className="font-display text-lg font-bold text-stone-100 mt-0.5">
                        Capster {getCapsterName(b.capsterId)} ·{' '}
                        <span className="font-mono tabular-nums">
                          {b.jamSlot} WIB
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {formatDateIndo(b.tanggal)}
                      </p>
                    </div>
                    <StatusIndicator status={b.status} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-zinc-400">Hitung Mundur</p>
                        <p className="font-mono tabular-nums font-semibold text-stone-100 mt-0.5">
                          {b.status === 'In-Service'
                            ? 'Sedang dilayani sekarang'
                            : formatCountdown(b.tanggal, b.jamSlot)}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <p className="text-amber-300 font-semibold">
                          Toleransi Keterlambatan: 15 Menit
                        </p>
                        <p className="text-zinc-300 mt-0.5">
                          Lewat 15 menit tanpa hadir, booking batal otomatis.
                        </p>
                      </div>
                    </div>
                  </div>

                  {b.status === 'Booked' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          disabled={!allowedReschedule || isOffline}
                          onClick={() => openReschedulePicker(b)}
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-45 disabled:cursor-not-allowed border border-zinc-700 text-stone-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <CalendarClock className="w-4 h-4 text-amber-400" />
                          <span>Ubah Jadwal</span>
                        </button>

                        {!allowedReschedule && (
                          <span className="text-[11px] text-zinc-400">
                            Ubah jadwal minimal 60 menit sebelum jam slot.
                          </span>
                        )}
                      </div>

                      {isConfirmingCancel ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-rose-300">
                            Batalkan booking ini?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const res = onCancelBooking(b.id);
                              setConfirmCancelBookingId(null);
                              setActionMsg({
                                type: res.ok ? 'success' : 'error',
                                text: res.ok
                                  ? `Booking ${b.kodeTiket} dibatalkan dan slot kembali Available.`
                                  : res.message || 'Gagal membatalkan booking.',
                              });
                            }}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold"
                          >
                            Ya, Batalkan
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCancelBookingId(null)}
                            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isOffline}
                          onClick={() => setConfirmCancelBookingId(b.id)}
                          className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 disabled:opacity-50 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Batalkan Booking</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* PANEL UBAH JADWAL (RESCHEDULE PICKER) */}
      {reschedulingBooking && (
        <section className="p-5 sm:p-6 rounded-2xl bg-[#16161C] border border-amber-400/50 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <p className="text-xs text-amber-400 font-semibold">
                Ubah Jadwal Booking · {reschedulingBooking.kodeTiket}
              </p>
              <h3 className="font-display text-lg font-bold text-stone-100 mt-0.5">
                Pilih Capster, Tanggal &amp; Slot Baru
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Jadwal lama ({getCapsterName(reschedulingBooking.capsterId)} ·{' '}
                {formatShortDateIndo(reschedulingBooking.tanggal)}{' '}
                {reschedulingBooking.jamSlot}) akan otomatis dibebaskan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReschedulingBooking(null)}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
            >
              Tutup
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {dbState.capsters.map((c) => {
              const active = c.id === reschedCapsterId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setReschedCapsterId(c.id);
                    setReschedSlot('');
                  }}
                  className={`p-3 rounded-xl border text-left flex items-center gap-3 ${
                    active
                      ? 'bg-amber-500/15 border-amber-400'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <CapsterAvatar
                    fotoKey={c.fotoKey}
                    nama={c.nama}
                    sizeClass="w-9 h-9"
                  />
                  <div>
                    <p className="text-xs font-semibold text-stone-100">
                      {c.nama}
                    </p>
                    <p className="text-[11px] text-amber-400">{c.gelar}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {dateOptions.map((dt, idx) => {
              const active = dt === reschedDate;
              return (
                <button
                  key={dt}
                  type="button"
                  onClick={() => {
                    setReschedDate(dt);
                    setReschedSlot('');
                  }}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-amber-400 text-zinc-950 border-amber-400 font-semibold'
                      : 'bg-zinc-900 text-zinc-300 border-zinc-800'
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

          {reschedSchedule.config.isLibur ? (
            <div className="p-5 rounded-xl bg-zinc-900 border border-rose-500/35 text-center space-y-1.5">
              <CalendarOff className="w-7 h-7 text-rose-400 mx-auto" />
              <p className="text-sm font-semibold text-rose-200">
                Capster tidak beroperasi pada tanggal ini
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {reschedSchedule.slots.map((slot) => {
                const isAvail = slot.status === 'Available';
                const isSelected = reschedSlot === slot.jam && isAvail;
                return (
                  <button
                    key={slot.jam}
                    type="button"
                    disabled={!isAvail}
                    onClick={() => setReschedSlot(slot.jam)}
                    className={`min-h-[48px] px-2.5 py-2 rounded-xl border text-center transition-colors ${
                      isSelected
                        ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold'
                        : isAvail
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-400/70 cursor-not-allowed'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold">{slot.jam}</div>
                    <div className="text-[10px]">
                      {isSelected ? 'Dipilih' : slot.status}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              disabled={!reschedSlot}
              onClick={handleConfirmReschedule}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 text-xs sm:text-sm font-semibold"
            >
              Simpan Jadwal Baru {reschedSlot ? `(${reschedSlot} WIB)` : ''}
            </button>
            <button
              type="button"
              onClick={() => setReschedulingBooking(null)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-zinc-800 text-zinc-200 text-xs sm:text-sm"
            >
              Batal
            </button>
          </div>
        </section>
      )}

      {/* C. RIWAYAT ANTREAN & BOOKING */}
      <section className="space-y-3">
        <h2 className="font-display text-lg sm:text-xl font-semibold text-stone-100">
          Riwayat Antrean &amp; Booking
        </h2>

        {myWalkinHistory.length === 0 && myBookingHistory.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#131317] border border-zinc-800/80 text-center text-sm text-zinc-400">
            Belum ada riwayat layanan yang selesai atau dibatalkan.
          </div>
        ) : (
          <div className="rounded-2xl bg-[#131317] border border-zinc-800/90 divide-y divide-zinc-800/80">
            {myBookingHistory.map((b) => (
              <div
                key={b.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-mono text-zinc-400">
                    Booking · {b.kodeTiket}
                  </p>
                  <p className="text-sm font-semibold text-stone-100 mt-0.5">
                    Capster {getCapsterName(b.capsterId)} ·{' '}
                    {formatShortDateIndo(b.tanggal)} ({b.jamSlot} WIB)
                  </p>
                  {b.status === 'Canceled' && (
                    <p className="text-xs text-rose-300 mt-0.5">
                      {b.alasanBatal === 'otomatis'
                        ? 'Dibatalkan otomatis (terlambat > 15 menit)'
                        : 'Dibatalkan'}
                    </p>
                  )}
                </div>
                <StatusIndicator status={b.status} compact />
              </div>
            ))}

            {myWalkinHistory.map((w) => (
              <div
                key={w.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-mono text-zinc-400">
                    Walk-in · {w.nomorAntrean}
                  </p>
                  <p className="text-sm font-semibold text-stone-100 mt-0.5">
                    {formatShortDateIndo(w.tanggal)} · Ambil{' '}
                    {formatTimeHHMM(w.waktuAmbil)} WIB
                  </p>
                  {w.durasiAktual && (
                    <p className="text-xs text-emerald-400 font-mono mt-0.5">
                      Durasi aktual: {w.durasiAktual} menit
                    </p>
                  )}
                </div>
                <StatusIndicator status={w.status} compact />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
