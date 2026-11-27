'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Clock,
  RefreshCw,
  Scissors,
  Search,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  formatDateIndo,
  formatTimeWibHHMM,
  maskCustomerName,
} from '@/lib/barber-service';
import {
  AppView,
  BarberDatabaseState,
  Customer,
  DataAntreanWalkin,
  DataBooking,
  QueueEstimationSummary,
} from '@/lib/types';
import { StatusIndicator } from './StatusIndicator';

interface StatusViewProps {
  dbState: BarberDatabaseState;
  todayStr: string;
  operationalDayKey: string;
  queueEstimation: QueueEstimationSummary;
  currentCustomer: Customer | null;
  activeCustomerWalkin: DataAntreanWalkin | null;
  activeCustomerBooking: DataBooking | null;
  isOffline: boolean;
  syncStatus: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  lastSyncedFormatted: string;
  onRefresh: () => void;
  onNavigate: (view: AppView) => void;
}

export function StatusView({
  dbState,
  todayStr,
  operationalDayKey,
  queueEstimation,
  currentCustomer,
  activeCustomerWalkin,
  activeCustomerBooking,
  isOffline,
  syncStatus,
  lastSyncedFormatted,
  onRefresh,
  onNavigate,
}: StatusViewProps) {
  const [searchNomor, setSearchNomor] = useState('');
  const [trackedWalkinId, setTrackedWalkinId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const todayWalkins = dbState.walkinQueue
    .filter(
      (w) => (w.kunciHariOperasional || w.tanggal) === operationalDayKey
    )
    .sort((a, b) => a.waktuAmbil - b.waktuAmbil);

  const trackedWalkin =
    (trackedWalkinId
      ? todayWalkins.find((w) => w.id === trackedWalkinId) || null
      : null) ||
    (currentCustomer
      ? todayWalkins.find(
          (w) =>
            w.customerId === currentCustomer.id &&
            (w.status === 'Waiting' || w.status === 'In-Service')
        ) ||
        todayWalkins.find((w) => w.customerId === currentCustomer.id)
      : null) ||
    (activeCustomerWalkin &&
    (activeCustomerWalkin.kunciHariOperasional ||
      activeCustomerWalkin.tanggal) === operationalDayKey
      ? todayWalkins.find((w) => w.id === activeCustomerWalkin.id) ||
        activeCustomerWalkin
      : null);

  const getCapsterName = (capsterId?: string) => {
    if (!capsterId) return 'Hasan';
    return (
      dbState.capsters.find((c) => c.id === capsterId)?.nama || 'Capster'
    );
  };

  const handleFindNomor = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    const q = searchNomor.trim().toUpperCase();
    if (!q) {
      setSearchError('Masukkan nomor antrean, misalnya A001.');
      return;
    }
    const found = todayWalkins.find(
      (w) => w.nomorAntrean.toUpperCase() === q
    );
    if (!found) {
      setSearchError(
        `Nomor antrean "${q}" tidak ditemukan pada sesi operasional hari ini.`
      );
      return;
    }
    setTrackedWalkinId(found.id);
    setSearchNomor('');
  };

  const trackedPosIndex = trackedWalkin
    ? queueEstimation.waitingList.findIndex((w) => w.id === trackedWalkin.id)
    : -1;
  const antreanDiDepan = trackedPosIndex >= 0 ? trackedPosIndex : 0;
  const estimasiMenit =
    queueEstimation.sisaWaktuInServiceMenit +
    antreanDiDepan * queueEstimation.rataRataDurasiMenit;

  return (
    <div className="space-y-8">
      {/* Header & Connection Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
            Status &amp; Estimasi Antrean Live
          </h1>
          <p className="text-sm text-zinc-400">
            {formatDateIndo(todayStr)} · Diperbarui otomatis secara berkala
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-2 ${
              isOffline
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                : syncStatus === 'connected'
                  ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-200'
                  : 'bg-[#131317] border-zinc-800 text-zinc-300'
            }`}
          >
            {isOffline || syncStatus === 'offline' ? (
              <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
            ) : syncStatus === 'connected' ? (
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-amber-300 shrink-0 animate-spin" />
            )}
            <span className="whitespace-nowrap">
              {isOffline || syncStatus === 'offline' ? 'Offline' : syncStatus === 'connected' ? 'Realtime terhubung' : syncStatus === 'reconnecting' ? 'Menghubungkan ulang' : 'Menghubungkan...'}
              {' · '}
              <span className="font-mono tabular-nums">Update {lastSyncedFormatted} WIB</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isOffline}
            title="Segarkan data sekarang"
            className="min-h-[38px] min-w-[38px] p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700 text-zinc-200 flex items-center justify-center transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Offline Banner */}
      {isOffline && (
        <div
          role="status"
          className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3"
        >
          <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-100 space-y-0.5">
            <p className="font-semibold">
              Koneksi terputus — menampilkan data terakhir
            </p>
            <p className="text-xs text-amber-200/80">
              Terakhir diperbarui:{' '}
              <span className="font-mono tabular-nums font-semibold">
                {lastSyncedFormatted} WIB
              </span>
              .
            </p>
          </div>
        </div>
      )}

      {/* Notifikasi Pembatalan Booking Milik Pelanggan */}
      {activeCustomerBooking && activeCustomerBooking.status === 'Canceled' && (
        <div className="p-4 sm:p-5 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-rose-200">
                Booking {activeCustomerBooking.kodeTiket} Dibatalkan{' '}
                {activeCustomerBooking.alasanBatal === 'otomatis'
                  ? 'Otomatis oleh Sistem'
                  : activeCustomerBooking.alasanBatal ===
                      'capster_tidak_tersedia'
                    ? 'karena Capster Tidak Tersedia'
                    : 'oleh Capster / Pelanggan'}
              </p>
              <p className="text-xs text-rose-100/80">
                {activeCustomerBooking.catatanBatal ||
                  `Slot pukul ${activeCustomerBooking.jamSlot} WIB dibatalkan.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('booking')}
            className="px-4 py-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-100 text-xs font-semibold whitespace-nowrap shrink-0 min-h-[40px]"
          >
            Buat Booking Baru
          </button>
        </div>
      )}

      {/* Bagian 1: Sedang Dilayani (In-Service) + Estimasi Waktu Tersisa */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-stone-100">
              Sedang Dilayani
            </h2>
            <StatusIndicator status="In-Service" compact />
          </div>

          {queueEstimation.inServiceDetails.length === 0 ? (
            <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center text-sm text-zinc-400">
              Belum ada pelanggan yang sedang dilayani di kursi cukur saat ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {queueEstimation.inServiceDetails.map((detail) => (
                <div
                  key={detail.id}
                  className="p-4 rounded-xl bg-sky-950/25 border border-sky-500/35 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-sky-300 font-medium">
                        {detail.tipe === 'walkin'
                          ? 'Walk-in Sedang Dilayani'
                          : 'Booking Sedang Dilayani'}
                      </p>
                      <p className="font-mono tabular-nums text-2xl font-bold text-stone-100 mt-0.5">
                        {detail.kodeAtauNomor}
                      </p>
                    </div>
                    <Scissors className="w-5 h-5 text-sky-400 shrink-0" />
                  </div>

                  <div className="text-xs space-y-1 text-zinc-300">
                    <p>
                      Pelanggan:{' '}
                      <strong className="text-stone-100">
                        {detail.namaTersamarkan}
                      </strong>{' '}
                      · Capster {getCapsterName(detail.capsterId)}
                    </p>
                    <p className="font-mono tabular-nums text-zinc-400">
                      Mulai pukul {detail.jamMulaiHHMM} WIB (berjalan{' '}
                      {detail.lamaBerjalanMenit} mnt)
                    </p>
                    <p
                      className={`font-semibold ${
                        detail.melebihiEstimasi
                          ? 'text-amber-300'
                          : 'text-sky-300'
                      }`}
                    >
                      {detail.melebihiEstimasi
                        ? 'Hampir selesai / melebihi estimasi'
                        : `Estimasi selesai ± ${detail.estimasiSisaMenit} menit lagi`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Rata-rata durasi cukur hari ini:{' '}
                <strong className="text-stone-100 font-mono tabular-nums">
                  {queueEstimation.rataRataDurasiMenit} menit
                </strong>
              </span>
            </div>
            <span className="text-zinc-500">
              {queueEstimation.menggunakanDefault
                ? 'Default 45 mnt (belum ada layanan selesai hari ini)'
                : `Dihitung dari ${queueEstimation.jumlahSelesaiHariIni} layanan selesai hari ini`}
            </span>
          </div>
        </section>

        {/* Bagian 2: Posisi Antrean Anda */}
        <section className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-[#131317] border border-amber-500/30 space-y-4">
          <h2 className="font-display text-lg font-semibold text-stone-100">
            Posisi Antrean Anda
          </h2>

          {trackedWalkin ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-zinc-400">Nomor Antrean</p>
                  <p className="font-mono tabular-nums text-3xl font-bold text-amber-400">
                    {trackedWalkin.nomorAntrean}
                  </p>
                </div>
                <StatusIndicator status={trackedWalkin.status} />
              </div>

              {trackedWalkin.status === 'Waiting' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <p className="text-xs text-zinc-400">Antrean di Depan</p>
                    <p className="font-mono tabular-nums text-xl font-bold text-stone-100 mt-1">
                      {antreanDiDepan} antrean
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Posisi ke-{antreanDiDepan + 1} menunggu
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <p className="text-xs text-zinc-400">Estimasi Tunggu</p>
                    <p className="font-mono tabular-nums text-xl font-bold text-amber-300 mt-1">
                      {estimasiMenit === 0 ? '0 mnt' : `${estimasiMenit} mnt`}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 font-mono tabular-nums">
                      {queueEstimation.sisaWaktuInServiceMenit} + (
                      {antreanDiDepan} × {queueEstimation.rataRataDurasiMenit})
                    </p>
                  </div>
                </div>
              )}

              {trackedWalkin.status === 'In-Service' && (
                <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-500/35 text-sm text-sky-200">
                  Giliran Anda sedang diproses oleh Capster{' '}
                  <strong>{getCapsterName(trackedWalkin.capsterId)}</strong>.
                </div>
              )}

              {trackedWalkin.status === 'Selesai' && (
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-emerald-300">
                  Layanan selesai ({trackedWalkin.durasiAktual || 45} menit).
                  Terima kasih telah bercukur!
                </div>
              )}

              {trackedWalkin.status === 'Kedaluwarsa' && (
                <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-zinc-300">
                  Antrean sesi operasional sebelumnya telah kedaluwarsa.
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-400 space-y-2">
              <p>Belum ada antrean aktif yang sedang Anda lacak.</p>
              <button
                type="button"
                onClick={() => onNavigate('antrean')}
                className="text-amber-400 hover:text-amber-300 font-medium text-xs"
              >
                Ambil Antrean Walk-in sekarang →
              </button>
            </div>
          )}

          {/* Form Lacak Nomor Antrean */}
          <form onSubmit={handleFindNomor} className="pt-2 space-y-2">
            <label
              htmlFor="cek-nomor-antrean"
              className="block text-xs text-zinc-400"
            >
              Lacak nomor antrean hari ini
            </label>
            <div className="flex gap-2">
              <input
                id="cek-nomor-antrean"
                type="text"
                value={searchNomor}
                onChange={(e) => setSearchNomor(e.target.value)}
                placeholder="Contoh: A001"
                className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm font-mono uppercase focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-stone-100 text-sm font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>Lacak</span>
              </button>
            </div>
            {searchError && (
              <p className="text-xs text-rose-400">{searchError}</p>
            )}
          </form>
        </section>
      </div>

      {/* Bagian 3: Daftar Antrean Walk-in Hari Ini (Nama Tersamarkan untuk Privasi) */}
      <section className="rounded-2xl bg-[#131317] border border-zinc-800/90 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-100">
              Daftar Antrean Walk-in Hari Ini
            </h2>
            <p className="text-xs text-zinc-400">
              Urutan murni berdasarkan waktu ambil nomor (nama pelanggan lain
              disamarkan demi privasi).
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-zinc-400">
            Total {todayWalkins.length} antrean
          </span>
        </div>

        {todayWalkins.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            Belum ada antrean hari ini.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {todayWalkins.map((item) => {
              const waitIdx = queueEstimation.waitingList.findIndex(
                (w) => w.id === item.id
              );
              const estWait =
                waitIdx >= 0
                  ? queueEstimation.sisaWaktuInServiceMenit +
                    waitIdx * queueEstimation.rataRataDurasiMenit
                  : null;
              const isMine = Boolean(
                currentCustomer && item.customerId === currentCustomer.id
              );

              return (
                <div
                  key={item.id}
                  className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isMine ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono tabular-nums text-xl font-bold text-stone-100 w-16 shrink-0">
                      {item.nomorAntrean}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-100 truncate">
                        {isMine
                          ? item.namaPelanggan || currentCustomer?.nama
                          : maskCustomerName(item.namaPelanggan)}
                        {isMine && (
                          <span className="ml-2 text-xs text-amber-400 font-normal">
                            (Antrean Anda)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-400 font-mono tabular-nums">
                        Ambil {formatTimeWibHHMM(item.waktuAmbil)} WIB · Capster{' '}
                        {getCapsterName(item.capsterId)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    {item.status === 'Waiting' && estWait !== null && (
                      <span className="text-xs text-zinc-300 font-mono tabular-nums">
                        {estWait === 0
                          ? 'Antrean berikutnya'
                          : `Estimasi ± ${estWait} mnt`}
                      </span>
                    )}
                    {item.status === 'Selesai' && item.durasiAktual && (
                      <span className="text-xs text-zinc-400 font-mono tabular-nums">
                        Durasi aktual {item.durasiAktual} mnt
                      </span>
                    )}
                    <StatusIndicator status={item.status} compact />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
