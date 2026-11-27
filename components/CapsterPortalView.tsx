'use client';

import { useState } from 'react';
import {
  CalendarOff,
  CheckCircle2,
  Clock,
  KeyRound,
  LogOut,
  Phone,
  Play,
  Scissors,
  Settings,
  SlidersHorizontal,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  addDaysYYYYMMDD,
  barberService,
  formatDateIndo,
  formatShortDateIndo,
  formatTimeHHMM,
  formatWhatsAppDisplay,
  parseSlotEpochMs,
} from '@/lib/barber-service';
import {
  BarberDatabaseState,
  Capster,
  DataKuotaAntrean,
  QueueEstimationSummary,
  ServiceResult,
} from '@/lib/types';
import { CapsterAvatar } from './BarbershopMedia';
import { StatusIndicator } from './StatusIndicator';

interface CapsterPortalViewProps {
  dbState: BarberDatabaseState;
  todayStr: string;
  effectiveNowMs: number;
  currentClockHHMM: string;
  todayQuota: DataKuotaAntrean;
  queueEstimation: QueueEstimationSummary;
  loggedInCapster: Capster | null;
  onLogin: (username: string, pin: string) => ServiceResult<Capster>;
  onLogout: () => void;
  onCallWalkin: (walkinId: string, capsterId: string) => void;
  onCompleteWalkin: (walkinId: string, overrideDurationMinutes?: number) => void;
  onCancelWalkin: (walkinId: string) => void;
  onStartBooking: (bookingId: string) => void;
  onCompleteBooking: (bookingId: string, overrideDurationMinutes?: number) => void;
  onCancelBookingManual: (bookingId: string) => void;
  onUpdateQuota: (tanggal: string, maxQuota: number) => void;
  onUpdateSchedule: (params: {
    capsterId: string;
    tanggal: string;
    buka: string;
    tutup: string;
    isLibur: boolean;
    alasanLibur?: string;
    applyHoursAsDefault?: boolean;
  }) => void;
  onToggleManualFullSlot: (
    capsterId: string,
    tanggal: string,
    jam: string
  ) => void;
}

export function CapsterPortalView({
  dbState,
  todayStr,
  effectiveNowMs,
  currentClockHHMM,
  todayQuota,
  queueEstimation,
  loggedInCapster,
  onLogin,
  onLogout,
  onCallWalkin,
  onCompleteWalkin,
  onCancelWalkin,
  onStartBooking,
  onCompleteBooking,
  onCancelBookingManual,
  onUpdateQuota,
  onUpdateSchedule,
  onToggleManualFullSlot,
}: CapsterPortalViewProps) {
  // Login state
  const [username, setUsername] = useState('hasan');
  const [pin, setPin] = useState('1234');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard tabs & filters
  const [activeTab, setActiveTab] = useState<'kelola' | 'pengaturan'>('kelola');
  const [filterScope, setFilterScope] = useState<'semua' | 'saya'>('semua');

  // Inline duration editor for completing In-Service item
  const [completingItem, setCompletingItem] = useState<{
    type: 'walkin' | 'booking';
    id: string;
    minutes: number;
  } | null>(null);

  // Settings state
  const [quotaInput, setQuotaInput] = useState<number>(todayQuota.kuotaMaksimal);
  const [quotaSavedMsg, setQuotaSavedMsg] = useState<string | null>(null);
  const [schedCapsterId, setSchedCapsterId] = useState<string>(
    loggedInCapster?.id || 'hasan'
  );
  const [schedDate, setSchedDate] = useState<string>(todayStr);
  const [schedSavedMsg, setSchedSavedMsg] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const res = onLogin(username, pin);
    if (!res.ok) {
      setLoginError(res.message || 'Login gagal.');
    } else if (res.data) {
      setSchedCapsterId(res.data.id);
    }
  };

  // --- BELUM LOGIN: FORM LOGIN CAPSTER ---
  if (!loggedInCapster) {
    return (
      <div className="max-w-md mx-auto py-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-stone-100">
            Portal Login Capster
          </h1>
          <p className="text-sm text-zinc-400">
            Masuk untuk memanggil antrean walk-in, memproses booking, serta
            mengatur kuota dan jadwal kerja.
          </p>
        </div>

        <form
          onSubmit={handleLoginSubmit}
          className="p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5"
        >
          {/* Pilih Akun Demo Cepat */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">
              Pilih Akun Capster Demo
            </p>
            <div className="grid grid-cols-3 gap-2">
              {dbState.capsters.map((c) => {
                const selected =
                  username.toLowerCase() === c.username.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setUsername(c.username);
                      setPin(c.pin);
                      setLoginError(null);
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-colors ${
                      selected
                        ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-semibold">{c.nama}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">
                      @{c.username}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
              {loginError}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label
                htmlFor="capster-username"
                className="block text-xs font-medium text-zinc-300 mb-1.5"
              >
                Username Capster
              </label>
              <input
                id="capster-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label
                htmlFor="capster-pin"
                className="block text-xs font-medium text-zinc-300 mb-1.5"
              >
                PIN Capster <span className="text-zinc-500">(Demo: 1234)</span>
              </label>
              <input
                id="capster-pin"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                className="w-full min-h-[46px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <UserCheck className="w-4 h-4" />
            <span>Masuk ke Dashboard Capster</span>
          </button>
        </form>
      </div>
    );
  }

  // --- DATA FILTERED FOR DASHBOARD ---
  const todayWalkins = dbState.walkinQueue
    .filter((w) => w.tanggal === todayStr)
    .filter((w) =>
      filterScope === 'saya'
        ? !w.capsterId || w.capsterId === loggedInCapster.id
        : true
    )
    .sort((a, b) => a.waktuAmbil - b.waktuAmbil);

  const todayBookings = dbState.bookings
    .filter((b) => b.tanggal === todayStr)
    .filter((b) =>
      filterScope === 'saya' ? b.capsterId === loggedInCapster.id : true
    )
    .sort((a, b) => a.jamSlot.localeCompare(b.jamSlot));

  const getCapsterName = (id?: string) => {
    if (!id) return 'Belum ditentukan';
    return dbState.capsters.find((c) => c.id === id)?.nama || id;
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

  const openCompletePanel = (
    type: 'walkin' | 'booking',
    id: string,
    waktuMulai?: number
  ) => {
    const computedElapsed = waktuMulai
      ? Math.max(15, Math.round((effectiveNowMs - waktuMulai) / 60_000))
      : 45;
    setCompletingItem({ type, id, minutes: computedElapsed });
  };

  // Schedule editor data
  const dateOptions = Array.from({ length: 7 }, (_, i) =>
    addDaysYYYYMMDD(todayStr, i)
  );
  const { config: editConfig, slots: editSlots } =
    barberService.getComputedSlots(dbState, schedCapsterId, schedDate);

  return (
    <div className="space-y-8">
      {/* Header Capster Logged In */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <CapsterAvatar
            fotoKey={loggedInCapster.fotoKey}
            nama={loggedInCapster.nama}
            sizeClass="w-14 h-14"
          />
          <div>
            <p className="text-xs text-amber-400 font-medium">
              {loggedInCapster.gelar} · Aktif bertugas
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-stone-100">
              Halo, {loggedInCapster.nama}
            </h1>
            <p className="text-xs text-zinc-400 font-mono tabular-nums mt-0.5">
              {formatDateIndo(todayStr)} · Jam {currentClockHHMM} WIB
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex p-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab('kelola')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 min-h-[38px] transition-colors ${
                activeTab === 'kelola'
                  ? 'bg-amber-400 text-zinc-950 font-semibold'
                  : 'text-zinc-300 hover:text-stone-100'
              }`}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Antrean & Booking</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pengaturan')}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 min-h-[38px] transition-colors ${
                activeTab === 'pengaturan'
                  ? 'bg-amber-400 text-zinc-950 font-semibold'
                  : 'text-zinc-300 hover:text-stone-100'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Pengaturan</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        </div>
      </div>

      {/* TAB 1: KELOLA ANTREAN & BOOKING (UC-05) */}
      {activeTab === 'kelola' && (
        <div className="space-y-6">
          {/* Metric Strip & Scope Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
              <span className="text-zinc-400">
                Walk-in Waiting:{' '}
                <strong className="font-mono tabular-nums text-amber-300">
                  {queueEstimation.waitingList.length}
                </strong>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-400">
                Rata-rata Durasi:{' '}
                <strong className="font-mono tabular-nums text-stone-100">
                  {queueEstimation.rataRataDurasiMenit} mnt
                </strong>
              </span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-400">
                Kuota Walk-in:{' '}
                <strong className="font-mono tabular-nums text-emerald-400">
                  {todayQuota.kuotaTerpakai}/{todayQuota.kuotaMaksimal}
                </strong>
              </span>
            </div>

            <div className="inline-flex p-1 rounded-xl bg-[#131317] border border-zinc-800 self-start">
              <button
                type="button"
                onClick={() => setFilterScope('semua')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterScope === 'semua'
                    ? 'bg-zinc-800 text-stone-100'
                    : 'text-zinc-400 hover:text-stone-200'
                }`}
              >
                Semua Capster
              </button>
              <button
                type="button"
                onClick={() => setFilterScope('saya')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterScope === 'saya'
                    ? 'bg-zinc-800 text-stone-100'
                    : 'text-zinc-400 hover:text-stone-200'
                }`}
              >
                Khusus {loggedInCapster.nama}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kolom Kiri: Antrean Walk-in (FIFO) */}
            <section className="rounded-2xl bg-[#131317] border border-zinc-800/90 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-stone-100">
                    Antrean Walk-in Hari Ini
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Urutan FIFO — klik Panggil lalu Selesai saat cukur tuntas.
                  </p>
                </div>
                <span className="font-mono tabular-nums text-xs text-zinc-400">
                  {todayWalkins.length} item
                </span>
              </div>

              {todayWalkins.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">
                  Belum ada antrean walk-in hari ini.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/80">
                  {todayWalkins.map((w) => {
                    const isCompleting =
                      completingItem?.type === 'walkin' &&
                      completingItem.id === w.id;

                    return (
                      <div key={w.id} className="p-4 sm:p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="font-mono tabular-nums text-xl font-bold text-amber-400 w-14 shrink-0">
                              {w.nomorAntrean}
                            </span>
                            <div>
                              <p className="font-medium text-sm text-stone-100">
                                {getCustomerDisplayName(
                                  w.customerId,
                                  w.namaPelanggan
                                )}
                              </p>
                              <p className="text-xs text-zinc-400 font-mono tabular-nums mt-0.5">
                                Ambil {formatTimeHHMM(w.waktuAmbil)} WIB
                                {w.capsterId
                                  ? ` · Capster ${getCapsterName(w.capsterId)}`
                                  : ''}
                              </p>
                              {w.status === 'Selesai' && w.durasiAktual && (
                                <p className="text-xs text-emerald-400 font-mono tabular-nums mt-1">
                                  Durasi tercatat: {w.durasiAktual} menit
                                </p>
                              )}
                            </div>
                          </div>

                          <StatusIndicator status={w.status} compact />
                        </div>

                        {/* Tombol Aksi Walk-in */}
                        {w.status === 'Waiting' && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                onCallWalkin(w.id, loggedInCapster.id)
                              }
                              className="min-h-[40px] px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Panggil</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onCancelWalkin(w.id)}
                              className="min-h-[40px] px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium"
                            >
                              Batalkan
                            </button>
                          </div>
                        )}

                        {w.status === 'In-Service' && !isCompleting && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                openCompletePanel('walkin', w.id, w.waktuMulai)
                              }
                              className="min-h-[40px] px-4 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Selesai Cukur</span>
                            </button>
                            {w.waktuMulai && (
                              <span className="text-xs text-zinc-400 font-mono tabular-nums">
                                Mulai {formatTimeHHMM(w.waktuMulai)} WIB
                              </span>
                            )}
                          </div>
                        )}

                        {/* Konfirmasi Durasi Aktual saat Selesai */}
                        {isCompleting && completingItem && (
                          <div className="p-3.5 rounded-xl bg-zinc-900 border border-sky-500/40 space-y-3">
                            <p className="text-xs font-medium text-stone-200">
                              Catat durasi layanan aktual (menit) untuk
                              pembaruan estimasi:
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
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border ${
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
                                className="w-20 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs font-mono text-stone-100"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onCompleteWalkin(
                                    w.id,
                                    completingItem.minutes
                                  );
                                  setCompletingItem(null);
                                }}
                                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold"
                              >
                                Simpan & Selesaikan
                              </button>
                              <button
                                type="button"
                                onClick={() => setCompletingItem(null)}
                                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
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

            {/* Kolom Kanan: Daftar Booking Hari Ini */}
            <section className="rounded-2xl bg-[#131317] border border-zinc-800/90 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-stone-100">
                    Daftar Booking Hari Ini
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Toleransi telat 15 menit. Batal otomatis/manual membuka
                    slot untuk walk-in.
                  </p>
                </div>
                <span className="font-mono tabular-nums text-xs text-zinc-400">
                  {todayBookings.length} booking
                </span>
              </div>

              {todayBookings.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">
                  Belum ada jadwal booking hari ini.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/80">
                  {todayBookings.map((b) => {
                    const slotEpoch = parseSlotEpochMs(b.tanggal, b.jamSlot);
                    const lateMinutes = Math.floor(
                      (effectiveNowMs - slotEpoch) / 60_000
                    );
                    const isCompleting =
                      completingItem?.type === 'booking' &&
                      completingItem.id === b.id;

                    return (
                      <div key={b.id} className="p-4 sm:p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono tabular-nums">
                              <span className="text-amber-400 font-semibold">
                                {b.jamSlot} WIB
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{b.kodeTiket}</span>
                            </div>
                            <p className="font-medium text-sm text-stone-100 mt-1">
                              {getCustomerDisplayName(b.customerId, b.nama)}{' '}
                              <span className="text-xs text-zinc-400 font-normal">
                                (Capster {getCapsterName(b.capsterId)})
                              </span>
                            </p>
                            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5 font-mono tabular-nums">
                              <Phone className="w-3 h-3" />
                              <span>{formatWhatsAppDisplay(b.nomorWhatsApp)}</span>
                            </p>
                            {b.status === 'Booked' && lateMinutes > 0 && (
                              <p className="text-xs text-amber-300 mt-1 font-mono tabular-nums">
                                Lewat {lateMinutes} menit dari jam slot (batas
                                15 menit)
                              </p>
                            )}
                            {b.status === 'Canceled' && (
                              <p className="text-xs text-rose-300 mt-1">
                                {b.alasanBatal === 'otomatis'
                                  ? 'Dibatalkan otomatis (telat > 15 menit) — slot dibuka kembali'
                                  : 'Dibatalkan oleh capster — slot dibuka kembali'}
                              </p>
                            )}
                            {b.status === 'Selesai' && b.durasiAktual && (
                              <p className="text-xs text-emerald-400 font-mono tabular-nums mt-1">
                                Durasi tercatat: {b.durasiAktual} menit
                              </p>
                            )}
                          </div>

                          <StatusIndicator status={b.status} compact />
                        </div>

                        {b.status === 'Booked' && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => onStartBooking(b.id)}
                              className="min-h-[40px] px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                              <span>Proses Cukur</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onCancelBookingManual(b.id)}
                              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs font-medium flex items-center gap-1.5"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Batalkan (Telat &gt;15m)</span>
                            </button>
                          </div>
                        )}

                        {b.status === 'In-Service' && !isCompleting && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                openCompletePanel('booking', b.id, b.waktuMulai)
                              }
                              className="min-h-[40px] px-4 py-2 rounded-lg bg-sky-400 hover:bg-sky-300 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Selesai & Kosongkan Slot</span>
                            </button>
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
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border ${
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
                                className="w-20 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs font-mono text-stone-100"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  onCompleteBooking(
                                    b.id,
                                    completingItem.minutes
                                  );
                                  setCompletingItem(null);
                                }}
                                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold"
                              >
                                Simpan & Selesaikan
                              </button>
                              <button
                                type="button"
                                onClick={() => setCompletingItem(null)}
                                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
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
        </div>
      )}

      {/* TAB 2: PENGATURAN KUOTA, JAM KERJA & LIBUR */}
      {activeTab === 'pengaturan' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Pengaturan Kuota Walk-in Harian */}
          <section className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5 self-start">
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="w-5 h-5 text-amber-400" />
              <h2 className="font-display text-lg font-semibold text-stone-100">
                Kuota Walk-in Harian
              </h2>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Atur batas maksimal antrean walk-in untuk hari ini (
              {formatDateIndo(todayStr)}). Terpakai saat ini:{' '}
              <strong className="text-stone-100 font-mono tabular-nums">
                {todayQuota.kuotaTerpakai}
              </strong>
              .
            </p>

            <div className="space-y-3">
              <label
                htmlFor="quota-input"
                className="block text-xs font-medium text-zinc-300"
              >
                Kuota Maksimal (Default: 20)
              </label>
              <div className="flex gap-2">
                <input
                  id="quota-input"
                  type="number"
                  min={0}
                  max={200}
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(Number(e.target.value))}
                  className="w-28 min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    onUpdateQuota(todayStr, quotaInput);
                    setQuotaSavedMsg('Kuota harian diperbarui.');
                    setTimeout(() => setQuotaSavedMsg(null), 3000);
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold"
                >
                  Simpan Kuota
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setQuotaInput(todayQuota.kuotaTerpakai);
                    onUpdateQuota(todayStr, todayQuota.kuotaTerpakai);
                    setQuotaSavedMsg(
                      'Kuota disamakan dengan terpakai (untuk uji Antrean Penuh).'
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300"
                >
                  Simulasikan Kuota Penuh ({todayQuota.kuotaTerpakai})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuotaInput(20);
                    onUpdateQuota(todayStr, 20);
                    setQuotaSavedMsg('Kuota dikembalikan ke 20.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300"
                >
                  Reset ke 20
                </button>
              </div>

              {quotaSavedMsg && (
                <p className="text-xs text-emerald-400">{quotaSavedMsg}</p>
              )}
            </div>
          </section>

          {/* Pengaturan Jam Kerja, Libur/Izin & Slot Manual */}
          <section className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-400" />
              <h2 className="font-display text-lg font-semibold text-stone-100">
                Jam Kerja & Libur / Izin Capster
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Pilih Capster
                </label>
                <select
                  value={schedCapsterId}
                  onChange={(e) => setSchedCapsterId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm"
                >
                  {dbState.capsters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama} ({c.gelar})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Pilih Tanggal
                </label>
                <select
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm"
                >
                  {dateOptions.map((dt, idx) => (
                    <option key={dt} value={dt}>
                      {idx === 0
                        ? `Hari Ini (${dt})`
                        : idx === 1
                          ? `Besok (${dt})`
                          : formatShortDateIndo(dt)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Jam Buka
                </label>
                <select
                  value={editConfig.jamKerja.buka}
                  onChange={(e) => {
                    onUpdateSchedule({
                      capsterId: schedCapsterId,
                      tanggal: schedDate,
                      buka: e.target.value,
                      tutup: editConfig.jamKerja.tutup,
                      isLibur: editConfig.isLibur,
                      alasanLibur: editConfig.alasanLibur,
                    });
                    setSchedSavedMsg('Jam buka diperbarui.');
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 font-mono text-sm"
                >
                  {['09:00', '10:00', '11:00', '12:00', '13:00'].map((h) => (
                    <option key={h} value={h}>
                      {h} WIB
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">
                  Jam Tutup
                </label>
                <select
                  value={editConfig.jamKerja.tutup}
                  onChange={(e) => {
                    onUpdateSchedule({
                      capsterId: schedCapsterId,
                      tanggal: schedDate,
                      buka: editConfig.jamKerja.buka,
                      tutup: e.target.value,
                      isLibur: editConfig.isLibur,
                      alasanLibur: editConfig.alasanLibur,
                    });
                    setSchedSavedMsg('Jam tutup diperbarui.');
                  }}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 font-mono text-sm"
                >
                  {['18:00', '19:00', '20:00', '21:00', '22:00'].map((h) => (
                    <option key={h} value={h}>
                      {h} WIB
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggle Libur / Izin */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CalendarOff className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-stone-100">
                    Status Libur / Izin pada Tanggal Ini
                  </p>
                  <p className="text-xs text-zinc-400">
                    Jika aktif, pelanggan melihat penanda capster tidak
                    beroperasi.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onUpdateSchedule({
                    capsterId: schedCapsterId,
                    tanggal: schedDate,
                    buka: editConfig.jamKerja.buka,
                    tutup: editConfig.jamKerja.tutup,
                    isLibur: !editConfig.isLibur,
                    alasanLibur: !editConfig.isLibur
                      ? 'Libur / Izin Capster'
                      : undefined,
                  });
                  setSchedSavedMsg(
                    !editConfig.isLibur
                      ? 'Tanggal ditandai libur.'
                      : 'Capster aktif kembali.'
                  );
                }}
                className={`min-h-[42px] px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  editConfig.isLibur
                    ? 'bg-rose-500 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-stone-200 border border-zinc-700'
                }`}
              >
                {editConfig.isLibur ? 'Sedang Libur (Aktifkan)' : 'Tandai Libur'}
              </button>
            </div>

            {/* Toggle Slot Manual Full */}
            {!editConfig.isLibur && (
              <div className="space-y-2.5">
                <p className="text-xs text-zinc-400">
                  Klik slot untuk menandai atau membuka status{' '}
                  <strong className="text-red-300">Full</strong> manual:
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {editSlots.map((slot) => {
                    const isManual = editConfig.slotPenuhManual.includes(
                      slot.jam
                    );
                    const hasBooking = Boolean(slot.bookingId);
                    return (
                      <button
                        key={slot.jam}
                        type="button"
                        disabled={hasBooking}
                        onClick={() =>
                          onToggleManualFullSlot(
                            schedCapsterId,
                            schedDate,
                            slot.jam
                          )
                        }
                        className={`min-h-[48px] px-2 py-1.5 rounded-lg border text-center text-xs transition-colors ${
                          hasBooking
                            ? 'bg-rose-950/30 border-rose-500/30 text-rose-300 cursor-not-allowed'
                            : isManual
                              ? 'bg-red-500/20 border-red-500/50 text-red-300'
                              : 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/20'
                        }`}
                      >
                        <div className="font-mono font-bold">{slot.jam}</div>
                        <div className="text-[10px]">
                          {hasBooking
                            ? 'Booked'
                            : isManual
                              ? 'Full'
                              : 'Available'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {schedSavedMsg && (
              <p className="text-xs text-emerald-400">{schedSavedMsg}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
