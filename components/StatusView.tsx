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
import { formatDateIndo, formatTimeHHMM } from '@/lib/barber-service';
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
  queueEstimation: QueueEstimationSummary;
  currentCustomer: Customer | null;
  activeCustomerWalkin: DataAntreanWalkin | null;
  activeCustomerBooking: DataBooking | null;
  isOffline: boolean;
  lastSyncedFormatted: string;
  onRefresh: () => void;
  onTrackWalkinId: (id: string) => void;
  onNavigate: (view: AppView) => void;
}

export function StatusView({
  dbState,
  todayStr,
  queueEstimation,
  currentCustomer,
  activeCustomerWalkin,
  activeCustomerBooking,
  isOffline,
  lastSyncedFormatted,
  onRefresh,
  onTrackWalkinId,
  onNavigate,
}: StatusViewProps) {
  const [searchNomor, setSearchNomor] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  const todayWalkins = dbState.walkinQueue
    .filter((w) => w.tanggal === todayStr)
    .sort((a, b) => a.waktuAmbil - b.waktuAmbil);

  const trackedWalkin =
    (currentCustomer
      ? todayWalkins.find(
          (w) =>
            w.customerId === currentCustomer.id &&
            (w.status === 'Waiting' || w.status === 'In-Service')
        ) ||
        todayWalkins.find((w) => w.customerId === currentCustomer.id)
      : null) ||
    (activeCustomerWalkin && activeCustomerWalkin.tanggal === todayStr
      ? todayWalkins.find((w) => w.id === activeCustomerWalkin.id) ||
        activeCustomerWalkin
      : null);

  const getCapsterName = (capsterId?: string) => {
    if (!capsterId) return 'Capster tersedia';
    return (
      dbState.capsters.find((c) => c.id === capsterId)?.nama || 'Capster'
    );
  };

  const handleFindNomor = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    const q = searchNomor.trim().toUpperCase();
    if (!q) {
      setSearchError('Masukkan nomor antrean, misalnya A003.');
      return;
    }
    const found = todayWalkins.find(
      (w) => w.nomorAntrean.toUpperCase() === q
    );
    if (!found) {
      setSearchError(`Nomor antrean "${q}" tidak ditemukan untuk hari ini.`);
      return;
    }
    onTrackWalkinId(found.id);
    setSearchNomor('');
  };

  const trackedPosIndex = trackedWalkin
    ? queueEstimation.waitingList.findIndex((w) => w.id === trackedWalkin.id)
    : -1;
  const antreanDiDepan = trackedPosIndex >= 0 ? trackedPosIndex : 0;
  const estimasiMenit =
    antreanDiDepan * queueEstimation.rataRataDurasiMenit;

  return (
    <div className="space-y-8">
      {/* Header & Connection / Last Updated Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
            Status & Estimasi Antrean Live
          </h1>
          <p className="text-sm text-zinc-400">
            {formatDateIndo(todayStr)} · Pembaruan otomatis setiap beberapa
            detik
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
            title="Segarkan data sekarang"
            className="min-h-[38px] min-w-[38px] p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-700 text-zinc-200 flex items-center justify-center transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Offline Banner (Alternative Flow UC-02) */}
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
              Data tetap dapat dilihat saat offline. Terakhir diperbarui:{' '}
              <span className="font-mono tabular-nums font-semibold">
                {lastSyncedFormatted} WIB
              </span>
              .
            </p>
          </div>
        </div>
      )}

      {/* Notifikasi Pembatalan Booking Otomatis (>15 menit) jika ada di perangkat ini */}
      {activeCustomerBooking && activeCustomerBooking.status === 'Canceled' && (
        <div className="p-4 sm:p-5 rounded-xl bg-rose-950/40 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-rose-200">
                Booking {activeCustomerBooking.kodeTiket} Dibatalkan{' '}
                {activeCustomerBooking.alasanBatal === 'otomatis'
                  ? 'Otomatis oleh Sistem'
                  : 'oleh Capster'}
              </p>
              <p className="text-xs text-rose-100/80">
                Slot pukul {activeCustomerBooking.jamSlot} WIB melewati batas
                toleransi keterlambatan 15 menit tanpa konfirmasi, sehingga
                slot dibuka kembali untuk pelanggan lain.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('booking')}
            className="px-4 py-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-100 text-xs font-semibold whitespace-nowrap shrink-0 min-h-[40px]"
          >
            Buat Booking Ulang
          </button>
        </div>
      )}

      {/* Bagian 1: Nomor yang Sedang Dipanggil / In-Service + Info Estimasi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-stone-100">
              Sedang Dipanggil & Dilayani
            </h2>
            <StatusIndicator status="In-Service" compact />
          </div>

          {queueEstimation.sedangDilayaniWalkin.length === 0 &&
          queueEstimation.sedangDilayaniBooking.length === 0 ? (
            <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center text-sm text-zinc-400">
              Belum ada pelanggan di kursi cukur saat ini.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {queueEstimation.sedangDilayaniWalkin.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-sky-950/25 border border-sky-500/35 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs text-sky-300">Walk-in Dipanggil</p>
                    <p className="font-mono tabular-nums text-3xl font-bold text-stone-100 mt-0.5">
                      {item.nomorAntrean}
                    </p>
                    <p className="text-xs text-zinc-300 mt-1">
                      {item.namaPelanggan || 'Tamu'} · Capster{' '}
                      {getCapsterName(item.capsterId)}
                    </p>
                  </div>
                  <Scissors className="w-6 h-6 text-sky-400 shrink-0" />
                </div>
              ))}

              {queueEstimation.sedangDilayaniBooking.map((bk) => (
                <div
                  key={bk.id}
                  className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-sky-300">
                      Booking Slot {bk.jamSlot}
                    </p>
                    <p className="font-display text-lg font-bold text-stone-100 truncate mt-0.5">
                      {bk.nama}
                    </p>
                    <p className="text-xs text-zinc-300 mt-1 font-mono tabular-nums">
                      {bk.kodeTiket} · {getCapsterName(bk.capsterId)}
                    </p>
                  </div>
                  <Scissors className="w-6 h-6 text-sky-400 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {/* Penjelasan Perhitungan Estimasi */}
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

        {/* Bagian 2: Posisi Antrean Pelanggan */}
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
                      Posisi ke-{antreanDiDepan + 1} dalam antrean tunggu
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
                    <p className="text-xs text-zinc-400">Estimasi Tunggu</p>
                    <p className="font-mono tabular-nums text-xl font-bold text-amber-300 mt-1">
                      {estimasiMenit === 0 ? '0 mnt' : `${estimasiMenit} mnt`}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 font-mono tabular-nums">
                      {antreanDiDepan} × {queueEstimation.rataRataDurasiMenit}{' '}
                      mnt
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
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-sm text-zinc-400 space-y-2">
              <p>Belum ada nomor antrean yang dilacak di perangkat ini.</p>
              <button
                type="button"
                onClick={() => onNavigate('antrean')}
                className="text-amber-400 hover:text-amber-300 font-medium text-xs"
              >
                Ambil Antrean Walk-in sekarang →
              </button>
            </div>
          )}

          {/* Form Lacak Nomor Antrean Lain */}
          <form onSubmit={handleFindNomor} className="pt-2 space-y-2">
            <label
              htmlFor="cek-nomor-antrean"
              className="block text-xs text-zinc-400"
            >
              Lacak nomor antrean lain
            </label>
            <div className="flex gap-2">
              <input
                id="cek-nomor-antrean"
                type="text"
                value={searchNomor}
                onChange={(e) => setSearchNomor(e.target.value)}
                placeholder="Contoh: A003"
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

      {/* Bagian 3: Daftar Antrean Walk-in Hari Ini (FIFO) */}
      <section className="rounded-2xl bg-[#131317] border border-zinc-800/90 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-100">
              Daftar Antrean Walk-in Hari Ini
            </h2>
            <p className="text-xs text-zinc-400">
              Diurutkan murni berdasarkan waktu ambil nomor (First Come, First
              Served).
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-zinc-400">
            Total {todayWalkins.length} antrean
          </span>
        </div>

        {todayWalkins.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            Belum ada antrean walk-in hari ini.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {todayWalkins.map((item) => {
              const waitIdx = queueEstimation.waitingList.findIndex(
                (w) => w.id === item.id
              );
              const estWait =
                waitIdx >= 0
                  ? waitIdx * queueEstimation.rataRataDurasiMenit
                  : null;
              const isMine =
                Boolean(
                  currentCustomer && item.customerId === currentCustomer.id
                ) || trackedWalkin?.id === item.id;

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
                        {item.namaPelanggan || 'Tamu Walk-in'}
                        {isMine && (
                          <span className="ml-2 text-xs text-amber-400 font-normal">
                            (Antrean Anda)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-400 font-mono tabular-nums">
                        Ambil {formatTimeHHMM(item.waktuAmbil)} WIB
                        {item.capsterId
                          ? ` · Capster ${getCapsterName(item.capsterId)}`
                          : ''}
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
