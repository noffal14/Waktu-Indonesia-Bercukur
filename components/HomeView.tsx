'use client';

import {
  ArrowRight,
  CalendarCheck,
  Clock,
  ShieldAlert,
  Ticket,
} from 'lucide-react';
import {
  barberService,
  formatDateIndo,
  formatTimeHHMM,
} from '@/lib/barber-service';
import {
  AppView,
  BarberDatabaseState,
  DataAntreanWalkin,
  DataBooking,
  DataKuotaAntrean,
  QueueEstimationSummary,
} from '@/lib/types';
import { BarbershopHeroMedia, CapsterAvatar } from './BarbershopMedia';
import { StatusIndicator } from './StatusIndicator';

interface HomeViewProps {
  dbState: BarberDatabaseState;
  todayStr: string;
  currentClockHHMM: string;
  todayQuota: DataKuotaAntrean;
  queueEstimation: QueueEstimationSummary;
  activeCustomerWalkin: DataAntreanWalkin | null;
  activeCustomerBooking: DataBooking | null;
  onNavigate: (view: AppView) => void;
  onSelectCapsterForSchedule: (capsterId: string) => void;
}

export function HomeView({
  dbState,
  todayStr,
  currentClockHHMM,
  todayQuota,
  queueEstimation,
  activeCustomerWalkin,
  activeCustomerBooking,
  onNavigate,
  onSelectCapsterForSchedule,
}: HomeViewProps) {
  const sisaKuota = Math.max(
    0,
    todayQuota.kuotaMaksimal - todayQuota.kuotaTerpakai
  );

  const nomorDipanggil =
    queueEstimation.sedangDilayaniWalkin[0]?.nomorAntrean ||
    (queueEstimation.waitingList[0]
      ? `Berikutnya ${queueEstimation.waitingList[0].nomorAntrean}`
      : 'Belum ada');

  return (
    <div className="space-y-10 md:space-y-14">
      {/* Hero Section: 2-Column Split on Desktop, Mobile-First Stack */}
      <section className="rounded-2xl bg-[#131317] border border-zinc-800/90 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="text-amber-400 font-medium">
                  {formatDateIndo(todayStr)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Jam {currentClockHHMM} WIB
                </span>
                <span aria-hidden="true">·</span>
                <span>Buka 10:00 – 21:00</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight leading-[1.15] text-stone-100 text-balance max-w-2xl">
                Cukur Rapi Tanpa Antre Menumpuk di Depan Toko
              </h1>

              <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-xl">
                Ambil nomor antrean walk-in resmi atau kunci slot jadwal capster
                favorit Anda sebelum berangkat. Siapa yang lebih dulu datang atau
                booking, dia yang dilayani.
              </p>
            </div>

            {/* Dua Tombol Utama Besar (Mobile-First >= 52px hitbox) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('antrean')}
                className="min-h-[54px] px-5 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-zinc-950 font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <Ticket className="w-5 h-5 shrink-0" />
                <span>Ambil Antrean Walk-in</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('booking')}
                className="min-h-[54px] px-5 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] text-stone-100 border border-zinc-700 font-semibold text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <CalendarCheck className="w-5 h-5 text-amber-400 shrink-0" />
                <span>Booking Capster</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full border-t lg:border-t-0 lg:border-l border-zinc-800/80">
            <BarbershopHeroMedia />
          </div>
        </div>
      </section>

      {/* Strip Ringkasan Antrean Saat Ini (4 kolom penuh di bawah hero) */}
      <section aria-labelledby="ringkasan-antrean-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="ringkasan-antrean-heading"
            className="font-display text-lg sm:text-xl font-semibold text-stone-100"
          >
            Ringkasan Antrean Saat Ini
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('status')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
          >
            <span>Lihat Status Live</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 sm:p-5 rounded-xl bg-[#131317] border border-zinc-800/80">
            <p className="text-xs text-zinc-400">Sedang Dilayani</p>
            <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-sky-300 mt-1.5">
              {nomorDipanggil}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {queueEstimation.sedangDilayaniWalkin.length +
                queueEstimation.sedangDilayaniBooking.length}{' '}
              kursi aktif
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-[#131317] border border-zinc-800/80">
            <p className="text-xs text-zinc-400">Antrean Menunggu</p>
            <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-amber-300 mt-1.5">
              {queueEstimation.waitingList.length} orang
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Urutan datang lebih dulu
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-[#131317] border border-zinc-800/80">
            <p className="text-xs text-zinc-400">Rata-rata Durasi Cukur</p>
            <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-stone-100 mt-1.5">
              {queueEstimation.rataRataDurasiMenit} mnt
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {queueEstimation.menggunakanDefault
                ? 'Estimasi awal standar'
                : `Dari ${queueEstimation.jumlahSelesaiHariIni} layanan selesai`}
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-[#131317] border border-zinc-800/80">
            <p className="text-xs text-zinc-400">Sisa Kuota Walk-in</p>
            <p
              className={`font-mono tabular-nums text-2xl sm:text-3xl font-bold mt-1.5 ${
                sisaKuota === 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {sisaKuota} / {todayQuota.kuotaMaksimal}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {sisaKuota === 0 ? 'Kuota hari ini penuh' : 'Tersedia hari ini'}
            </p>
          </div>
        </div>
      </section>

      {/* Kartu Pintasan Tiket Aktif Pelanggan (jika ada di perangkat ini) */}
      {(activeCustomerWalkin || activeCustomerBooking) && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-stone-100">
            Tiket Aktif Anda
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeCustomerWalkin && (
              <div className="p-5 rounded-xl bg-[#16161B] border border-amber-500/30 flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>Antrean Walk-in</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Ambil {formatTimeHHMM(activeCustomerWalkin.waktuAmbil)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums text-2xl font-bold text-amber-300">
                      {activeCustomerWalkin.nomorAntrean}
                    </span>
                    <StatusIndicator status={activeCustomerWalkin.status} compact />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('status')}
                  className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-100 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  Pantau Status
                </button>
              </div>
            )}

            {activeCustomerBooking && (
              <div className="p-5 rounded-xl bg-[#16161B] border border-zinc-700 flex items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="font-mono tabular-nums">
                      {activeCustomerBooking.kodeTiket}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Jam {activeCustomerBooking.jamSlot}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-base text-stone-100 truncate">
                      {activeCustomerBooking.nama}
                    </span>
                    <StatusIndicator status={activeCustomerBooking.status} compact />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('booking')}
                  className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-100 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  Lihat Tiket
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Daftar Capster & Ketersediaan Hari Ini */}
      <section aria-labelledby="daftar-capster-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="daftar-capster-heading"
              className="font-display text-lg sm:text-xl font-semibold text-stone-100"
            >
              Tim Capster Hari Ini
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Pilih capster untuk melihat slot jam kerja yang masih tersedia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('jadwal')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-amber-400 hover:text-amber-300 whitespace-nowrap shrink-0 min-h-[36px]"
          >
            <span>Semua Jadwal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dbState.capsters.map((capster) => {
            const { config, slots } = barberService.getComputedSlots(
              dbState,
              capster.id,
              todayStr
            );
            const availableCount = slots.filter(
              (s) => s.status === 'Available'
            ).length;

            return (
              <div
                key={capster.id}
                className="p-5 rounded-xl bg-[#131317] border border-zinc-800/90 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <CapsterAvatar
                    fotoKey={capster.fotoKey}
                    nama={capster.nama}
                    sizeClass="w-14 h-14"
                  />
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-base text-stone-100">
                      {capster.nama}
                    </h3>
                    <p className="text-xs text-amber-400 font-medium">
                      {capster.gelar} · {capster.pengalaman}
                    </p>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                      {capster.spesialisasi}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-3">
                  {config.isLibur ? (
                    <span className="text-xs font-medium text-rose-400">
                      Libur hari ini
                    </span>
                  ) : (
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        availableCount > 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {availableCount > 0
                        ? `${availableCount} slot tersedia`
                        : 'Slot hari ini penuh'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectCapsterForSchedule(capster.id)}
                    className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-100 text-xs font-medium whitespace-nowrap shrink-0 min-h-[38px] transition-colors"
                  >
                    Cek Jadwal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Aturan Keadilan & Toleransi Keterlambatan */}
      <section className="p-5 sm:p-6 rounded-xl bg-[#131317] border border-zinc-800/80 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-sm sm:text-base text-stone-100">
              Prinsip Antrean Adil (First Come, First Served)
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Nomor walk-in dikunci berdasarkan waktu pengambilan. Urutan tidak
              dapat ditukar atau didahului oleh pelanggan yang datang lebih
              belakangan.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-sm sm:text-base text-stone-100">
              Toleransi Keterlambatan Booking: 15 Menit
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Pelanggan booking wajib hadir maksimal 15 menit dari jam slot.
              Lewat dari 15 menit tanpa konfirmasi, booking otomatis dibatalkan
              dan slot dialihkan ke antrean walk-in.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
