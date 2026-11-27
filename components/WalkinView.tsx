'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Lock,
  Ticket,
  User,
  Users,
} from 'lucide-react';
import {
  addDaysYYYYMMDD,
  formatDateIndo,
  formatTimeWibHHMM,
  formatWhatsAppDisplay,
} from '@/lib/barber-service';
import { ShopOperationalStatus } from '@/lib/barbershop-config';
import {
  AppView,
  BarberDatabaseState,
  Customer,
  DataAntreanWalkin,
  DataKuotaAntrean,
  QueueEstimationSummary,
  ServiceResult,
} from '@/lib/types';
import { StatusIndicator } from './StatusIndicator';

interface WalkinViewProps {
  dbState: BarberDatabaseState;
  todayStr: string;
  operationalDayKey: string;
  shopStatus: ShopOperationalStatus;
  todayQuota: DataKuotaAntrean;
  queueEstimation: QueueEstimationSummary;
  currentCustomer: Customer;
  activeCustomerWalkin: DataAntreanWalkin | null;
  isOffline: boolean;
  onTakeWalkin: (params: {
    customerId?: string;
    capsterId?: string;
  }) => ServiceResult<{
    ticket: DataAntreanWalkin;
    antreanDiDepan: number;
    estimasiMenit: number;
    state: BarberDatabaseState;
  }> | Promise<ServiceResult<{
    ticket: DataAntreanWalkin;
    antreanDiDepan: number;
    estimasiMenit: number;
    state: BarberDatabaseState;
  }>>;
  onNavigate: (view: AppView) => void;
  onBookTomorrow: (tomorrowStr: string) => void;
}

export function WalkinView({
  dbState,
  todayStr,
  operationalDayKey,
  shopStatus,
  todayQuota,
  queueEstimation,
  currentCustomer,
  activeCustomerWalkin,
  isOffline,
  onTakeWalkin,
  onNavigate,
  onBookTomorrow,
}: WalkinViewProps) {
  const defaultCapsterId =
    dbState.capsters.find((c) => c.id === currentCustomer.capsterFavoritId)
      ?.id ||
    dbState.capsters[0]?.id ||
    'hasan';

  const [capsterId, setCapsterId] = useState(defaultCapsterId);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justIssued, setJustIssued] = useState<DataAntreanWalkin | null>(null);

  const sisaKuota = Math.max(
    0,
    todayQuota.kuotaMaksimal - todayQuota.kuotaTerpakai
  );
  const isQuotaFull = sisaKuota <= 0;
  const tomorrowStr = addDaysYYYYMMDD(todayStr, 1);

  const existingActiveWalkin =
    dbState.walkinQueue.find(
      (w) =>
        (w.kunciHariOperasional || w.tanggal) === operationalDayKey &&
        w.customerId === currentCustomer.id &&
        (w.status === 'Waiting' || w.status === 'In-Service')
    ) || null;

  const displayedTicket =
    justIssued ||
    existingActiveWalkin ||
    (activeCustomerWalkin &&
    (activeCustomerWalkin.kunciHariOperasional ||
      activeCustomerWalkin.tanggal) === operationalDayKey &&
    activeCustomerWalkin.customerId === currentCustomer.id &&
    (activeCustomerWalkin.status === 'Waiting' ||
      activeCustomerWalkin.status === 'In-Service')
      ? activeCustomerWalkin
      : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = await onTakeWalkin({
      customerId: currentCustomer.id,
      capsterId: capsterId || defaultCapsterId,
    });
    if (!res.ok || !res.data) {
      setErrorMsg(
        res.message || 'Gagal mengambil nomor antrean. Silakan coba lagi.'
      );
      return;
    }
    setJustIssued(res.data.ticket);
  };

  const liveTicket = displayedTicket
    ? dbState.walkinQueue.find((w) => w.id === displayedTicket.id) ||
      displayedTicket
    : null;

  const antreanDiDepan =
    liveTicket && liveTicket.status === 'Waiting'
      ? Math.max(
          0,
          queueEstimation.waitingList.findIndex((w) => w.id === liveTicket.id)
        )
      : 0;
  const estimasiMenit =
    queueEstimation.sisaWaktuInServiceMenit +
    antreanDiDepan * queueEstimation.rataRataDurasiMenit;

  const previewWaitMinutes =
    queueEstimation.sisaWaktuInServiceMenit +
    queueEstimation.waitingList.length * queueEstimation.rataRataDurasiMenit;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
          Ambil Nomor Antrean Walk-in
        </h1>
        <p className="text-sm text-zinc-400">
          {formatDateIndo(todayStr)} · Jam operasional hari ini:{' '}
          <span className="font-mono text-zinc-200">
            {shopStatus.hours.label}
          </span>
          . Maksimal 1 antrean aktif per hari.
        </p>
      </div>

      {/* Ringkasan Kuota & Estimasi Hari Ini */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/90">
          <p className="text-xs text-zinc-400">Sisa kuota walk-in</p>
          <p
            className={`font-mono tabular-nums text-lg sm:text-xl font-bold mt-1 ${
              isQuotaFull ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {sisaKuota} dari {todayQuota.kuotaMaksimal}
          </p>
          <p className="text-[11px] text-zinc-400 mt-1">
            Sisa kuota walk-in: {sisaKuota} dari {todayQuota.kuotaMaksimal}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/90">
          <p className="text-xs text-zinc-400">Antrean Menunggu</p>
          <p className="font-mono tabular-nums text-xl sm:text-2xl font-bold text-amber-300 mt-1">
            {queueEstimation.waitingList.length} org
          </p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/90">
          <p className="text-xs text-zinc-400">Rata-rata Cukur</p>
          <p className="font-mono tabular-nums text-xl sm:text-2xl font-bold text-stone-100 mt-1">
            {queueEstimation.rataRataDurasiMenit} mnt
          </p>
        </div>
      </div>

      {/* Di Luar Jam Operasional */}
      {!shopStatus.isOpen && !liveTicket && (
        <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/80 border border-zinc-700 space-y-5">
          <div className="flex items-start gap-3.5">
            <Lock className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h2 className="font-display text-xl font-bold text-stone-100">
                {shopStatus.closedMessage}
              </h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                {shopStatus.isBeforeOpen
                  ? `Pengambilan nomor antrean walk-in dibuka mulai pukul ${shopStatus.hours.buka.replace(
                      ':',
                      '.'
                    )} WIB sekaligus mereset kuota harian menjadi ${
                      todayQuota.kuotaMaksimal
                    }. Sambil menunggu, Anda dapat memesan jadwal capster lewat menu Booking.`
                  : 'Pengambilan nomor antrean walk-in hanya tersedia selama jam operasional berlangsung. Anda tetap dapat melakukan booking jadwal untuk hari berikutnya.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => onBookTomorrow(tomorrowStr)}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Booking untuk Hari Berikutnya</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('jadwal')}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-stone-100 border border-zinc-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>Cek Jadwal Capster</span>
            </button>
          </div>
        </div>
      )}

      {/* Kondisi Kuota Penuh */}
      {shopStatus.isOpen && isQuotaFull && !liveTicket && (
        <div className="p-6 sm:p-8 rounded-2xl bg-rose-950/30 border border-rose-500/40 space-y-5">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <h2 className="font-display text-xl font-bold text-rose-200">
                Antrean Penuh
              </h2>
              <p className="text-sm text-rose-100/80 leading-relaxed">
                Kuota antrean walk-in hari ini ({todayQuota.kuotaMaksimal}{' '}
                pelanggan) sudah terpenuhi agar area tunggu tetap nyaman. Anda
                dapat memesan jadwal untuk hari berikutnya agar langsung
                dilayani tanpa menunggu.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => onBookTomorrow(tomorrowStr)}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Booking untuk Hari Berikutnya ({tomorrowStr})</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('status')}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-stone-100 border border-zinc-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>Lihat Status Antrean</span>
            </button>
          </div>
        </div>
      )}

      {/* Tiket Antrean Walk-in Aktif */}
      {liveTicket && (
        <div className="rounded-2xl bg-[#131317] border border-amber-500/40 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-stone-100">
                  Tiket Antrean Walk-in Aktif Anda
                </span>
              </div>
              <StatusIndicator status={liveTicket.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="p-5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-center">
                <p className="text-xs text-zinc-400">Nomor Antrean Anda</p>
                <p className="font-mono tabular-nums text-5xl sm:text-6xl font-bold text-amber-400 tracking-tight my-2">
                  {liveTicket.nomorAntrean}
                </p>
                <p className="text-xs text-zinc-400">
                  Diambil pukul{' '}
                  <span className="font-mono tabular-nums text-zinc-200">
                    {formatTimeWibHHMM(liveTicket.waktuAmbil)} WIB
                  </span>
                </p>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/80">
                  <span className="text-zinc-400">Nama Pelanggan</span>
                  <span className="font-medium text-stone-100">
                    {liveTicket.namaPelanggan || currentCustomer.nama}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-zinc-800/80">
                  <span className="text-zinc-400">Antrean di Depan</span>
                  <span className="font-mono tabular-nums font-semibold text-amber-300">
                    {liveTicket.status === 'Waiting'
                      ? `${antreanDiDepan} antrean`
                      : liveTicket.status === 'In-Service'
                        ? 'Sedang giliran Anda'
                        : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-zinc-400">Estimasi Waktu Tunggu</span>
                  <span className="font-mono tabular-nums font-semibold text-stone-100">
                    {liveTicket.status === 'Waiting'
                      ? estimasiMenit === 0
                        ? 'Segera dipanggil'
                        : `± ${estimasiMenit} menit`
                      : liveTicket.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Estimasi tunggu dihitung dari sisa waktu pelanggan yang sedang
                dilayani ({queueEstimation.sisaWaktuInServiceMenit} mnt) + (
                {antreanDiDepan} antrean di depan ×{' '}
                {queueEstimation.rataRataDurasiMenit} mnt).
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => onNavigate('antrean-saya')}
                className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <span>Buka Antrean &amp; Jadwal Saya</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('status')}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-stone-200 border border-zinc-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <span>Papan Status Live</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Pengambilan Antrean Walk-in */}
      {shopStatus.isOpen && !isQuotaFull && !liveTicket && (
        <form
          onSubmit={handleSubmit}
          className="p-6 sm:p-8 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5"
        >
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold text-stone-100">
              Konfirmasi Antrean Walk-in
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Identitas Anda diambil otomatis dari akun pelanggan yang sedang
              masuk.
            </p>
          </div>

          {shopStatus.isNearClosing && (
            <div className="p-3.5 rounded-xl bg-amber-500/12 border border-amber-500/40 text-xs sm:text-sm text-amber-200 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Perhatian: Barbershop mendekati jam tutup (tersisa{' '}
                <strong>{shopStatus.minutesUntilClose} menit</strong> sebelum
                pukul {shopStatus.hours.tutup.replace(':', '.')} WIB).
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-sm text-rose-200 space-y-2">
              <p>{errorMsg}</p>
              <button
                type="button"
                onClick={() => onNavigate('antrean-saya')}
                className="text-xs font-semibold text-amber-300 hover:text-amber-200"
              >
                Lihat Antrean &amp; Jadwal Saya →
              </button>
            </div>
          )}

          {isOffline && (
            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-sm text-amber-200">
              Koneksi internet terputus. Sambungkan kembali untuk menerbitkan
              nomor antrean baru.
            </div>
          )}

          {/* Ringkasan Identitas Akun */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-100">
                  {currentCustomer.nama}
                </p>
                <p className="text-xs font-mono tabular-nums text-zinc-400">
                  WhatsApp: {formatWhatsAppDisplay(currentCustomer.nomorWhatsApp)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('profil')}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 self-start sm:self-auto"
            >
              Ubah di profil
            </button>
          </div>

          <div>
            <label
              htmlFor="walkin-capster"
              className="block text-sm font-medium text-stone-200 mb-1.5"
            >
              Capster Bertugas
            </label>
            <select
              id="walkin-capster"
              value={capsterId}
              onChange={(e) => setCapsterId(e.target.value)}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
            >
              {dbState.capsters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama} ({c.gelar})
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 text-zinc-300">
              <Users className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Estimasi tunggu jika ambil sekarang:</span>
            </div>
            <span className="font-mono tabular-nums font-bold text-amber-300 whitespace-nowrap">
              {previewWaitMinutes === 0
                ? 'Langsung dilayani'
                : `± ${previewWaitMinutes} menit`}
            </span>
          </div>

          <button
            type="submit"
            disabled={isOffline}
            className="w-full min-h-[54px] px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold text-base flex items-center justify-center gap-2 transition-colors"
          >
            <Ticket className="w-5 h-5" />
            <span>Ambil Nomor Antrean Sekarang</span>
          </button>
        </form>
      )}
    </div>
  );
}
