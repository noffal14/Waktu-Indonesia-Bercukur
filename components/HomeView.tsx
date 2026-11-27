'use client';

import { useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  ChevronDown,
  Clock,
  ShieldAlert,
  Sparkles,
  Tag,
  Ticket,
} from 'lucide-react';
import {
  barberService,
  formatShortDateIndo,
  formatTimeWibHHMM,
  maskCustomerName,
} from '@/lib/barber-service';
import {
  OPERATIONAL_HOURS,
  ShopOperationalStatus,
} from '@/lib/barbershop-config';
import {
  formatPromoDiscountLabel,
  formatPromoShortBadge,
  formatRupiah,
  getItemPromoPricing,
  SERVICE_CATALOG,
} from '@/lib/services-catalog';
import {
  AppView,
  BarberDatabaseState,
  CapsterProfile,
  DataAntreanWalkin,
  DataBooking,
  DataKuotaAntrean,
  Promo,
  QueueEstimationSummary,
} from '@/lib/types';
import { AboutCapster } from './AboutCapster';
import { BarbershopHeroMedia, CapsterAvatar } from './BarbershopMedia';
import { StatusIndicator } from './StatusIndicator';

interface HomeViewProps {
  dbState: BarberDatabaseState;
  capsterProfile: CapsterProfile;
  todayStr: string;
  nowMs: number;
  liveClockText: string;
  shopStatus: ShopOperationalStatus;
  todayQuota: DataKuotaAntrean;
  activePromos: Promo[];
  queueEstimation: QueueEstimationSummary;
  activeCustomerWalkin: DataAntreanWalkin | null;
  activeCustomerBooking: DataBooking | null;
  onNavigate: (view: AppView) => void;
  onSelectCapsterForSchedule: (capsterId: string) => void;
}

export function HomeView({
  dbState,
  capsterProfile,
  todayStr,
  nowMs,
  liveClockText,
  shopStatus,
  todayQuota,
  activePromos,
  queueEstimation,
  activeCustomerWalkin,
  activeCustomerBooking,
  onNavigate,
  onSelectCapsterForSchedule,
}: HomeViewProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<
    Record<string, boolean>
  >({});

  const sisaKuota = Math.max(
    0,
    todayQuota.kuotaMaksimal - todayQuota.kuotaTerpakai
  );

  const primaryInService = queueEstimation.inServiceDetails[0];
  const nomorDipanggil = primaryInService
    ? primaryInService.kodeAtauNomor
    : queueEstimation.waitingList[0]
      ? `Berikutnya ${queueEstimation.waitingList[0].nomorAntrean}`
      : 'Belum ada';

  const toggleCategory = (catId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }));
  };

  return (
    <div className="space-y-8 md:space-y-12">
      {/* Hero Section Full-Width 16:9 Landscape */}
      <section className="relative w-full border-b border-zinc-800/80 bg-[#0B0B0D]">
        <div className="relative w-full">
          <BarbershopHeroMedia />

          {/* Overlay Teks & CTA di Desktop/Tablet (md+) di atas gradient bawah */}
          <div className="hidden md:flex absolute inset-x-0 bottom-0 z-10 pointer-events-none">
            <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pb-8 lg:pb-10 pointer-events-auto">
              <div className="max-w-3xl space-y-4">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B0B0D]/85 backdrop-blur-sm border border-zinc-700/90 text-[var(--wib-accent)] font-mono tabular-nums font-medium">
                    <Clock className="w-3.5 h-3.5 text-[var(--wib-accent)] shrink-0" />
                    <span>{liveClockText}</span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg backdrop-blur-sm border text-xs font-semibold ${
                      shopStatus.isOpen
                        ? 'bg-emerald-950/80 border-emerald-500/45 text-emerald-300'
                        : 'bg-rose-950/80 border-rose-500/45 text-rose-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        shopStatus.isOpen ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                    <span>
                      {shopStatus.isOpen
                        ? 'Sedang Buka'
                        : shopStatus.isBeforeOpen
                          ? 'Belum Buka'
                          : 'Sedang Tutup'}
                    </span>
                  </span>
                </div>

                <h1 className="font-display text-3xl lg:text-[42px] font-bold tracking-tight leading-[1.14] text-stone-50 drop-shadow-sm text-balance">
                  Cukur Rapi Tanpa Antre Menumpuk di Depan Toko
                </h1>

                <p className="text-sm lg:text-base text-stone-200 leading-relaxed max-w-2xl">
                  Ambil nomor antrean walk-in resmi atau kunci slot jadwal
                  capster sebelum berangkat. Siapa yang lebih dulu datang atau
                  booking, dia yang dilayani.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigate('antrean')}
                    className="min-h-[52px] px-6 py-3 rounded-xl bg-[var(--wib-accent)] hover:bg-amber-300 active:scale-[0.99] text-zinc-950 font-semibold text-sm lg:text-base flex items-center justify-center gap-2.5 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    <Ticket className="w-5 h-5 shrink-0" />
                    <span>Ambil Antrean Walk-in</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('booking')}
                    className="min-h-[52px] px-6 py-3 rounded-xl bg-[#131317]/90 hover:bg-zinc-800 active:scale-[0.99] text-stone-100 border border-zinc-600/90 font-semibold text-sm lg:text-base flex items-center justify-center gap-2.5 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <CalendarCheck className="w-5 h-5 text-[var(--wib-accent)] shrink-0" />
                    <span>Booking Capster</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Badge Status Singkat di Bawah Foto pada Mobile (< md) */}
          <div className="md:hidden absolute inset-x-0 bottom-2.5 px-4 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0B0B0D]/85 border border-zinc-700 text-[var(--wib-accent)] font-mono tabular-nums font-medium">
              <Clock className="w-3 h-3 text-[var(--wib-accent)] shrink-0" />
              <span>{liveClockText}</span>
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-semibold ${
                shopStatus.isOpen
                  ? 'bg-emerald-950/85 border-emerald-500/45 text-emerald-300'
                  : 'bg-rose-950/85 border-rose-500/45 text-rose-300'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  shopStatus.isOpen ? 'bg-emerald-400' : 'bg-rose-400'
                }`}
              />
              <span>
                {shopStatus.isOpen
                  ? 'Sedang Buka'
                  : shopStatus.isBeforeOpen
                    ? 'Belum Buka'
                    : 'Sedang Tutup'}
              </span>
            </span>
          </div>
        </div>

        {/* Konten Hero Mobile (< md) + Strip Jam Operasional (Semua Layar) */}
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-4 space-y-4">
          <div className="md:hidden space-y-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight leading-[1.18] text-[var(--wib-text)]">
              Cukur Rapi Tanpa Antre Menumpuk di Depan Toko
            </h1>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Ambil nomor antrean walk-in resmi atau kunci slot jadwal capster
              sebelum berangkat. Siapa yang lebih dulu datang atau booking, dia
              yang dilayani.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('antrean')}
                className="min-h-[52px] px-5 py-3 rounded-xl bg-[var(--wib-accent)] hover:bg-amber-300 active:scale-[0.99] text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap"
              >
                <Ticket className="w-5 h-5 shrink-0" />
                <span>Ambil Antrean Walk-in</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('booking')}
                className="min-h-[52px] px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] text-stone-100 border border-zinc-700 font-semibold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap"
              >
                <CalendarCheck className="w-5 h-5 text-[var(--wib-accent)] shrink-0" />
                <span>Booking Capster</span>
              </button>
            </div>
          </div>

          {/* Info Jam Operasional */}
          <div className="p-3.5 sm:px-5 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Senin – Jumat:</span>
                <span className="font-mono tabular-nums font-semibold text-stone-100">
                  {OPERATIONAL_HOURS.weekday.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">Sabtu – Minggu:</span>
                <span className="font-mono tabular-nums font-semibold text-amber-300">
                  {OPERATIONAL_HOURS.weekend.label}
                </span>
              </div>
            </div>
            {!shopStatus.isOpen && shopStatus.closedMessage && (
              <p className="text-amber-300/95 font-medium">
                {shopStatus.closedMessage}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-6 space-y-10 md:space-y-12">

      {/* Strip Ringkasan Antrean Saat Ini */}
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
          <div className="p-4 sm:p-5 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/80">
            <p className="text-xs text-zinc-400">Sedang Dilayani</p>
            <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-sky-300 mt-1.5 truncate">
              {nomorDipanggil}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {primaryInService
                ? `${primaryInService.namaTersamarkan} · ${
                    primaryInService.melebihiEstimasi
                      ? 'Hampir selesai'
                      : `sisa ±${primaryInService.estimasiSisaMenit} mnt`
                  }`
                : 'Belum ada di kursi cukur'}
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/80">
            <p className="text-xs text-zinc-400">Antrean Menunggu</p>
            <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-amber-300 mt-1.5">
              {queueEstimation.waitingList.length} orang
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              Urutan datang lebih dulu
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/80">
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

          <div className="p-4 sm:p-5 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/80">
            <p className="text-xs text-zinc-400">Sisa Kuota Walk-in</p>
            <p
              className={`font-mono tabular-nums text-xl sm:text-2xl font-bold mt-1.5 ${
                sisaKuota === 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {sisaKuota} dari {todayQuota.kuotaMaksimal}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {shopStatus.isBeforeOpen
                ? `Reset pukul ${shopStatus.hours.buka.replace(':', '.')} WIB`
                : sisaKuota === 0
                  ? 'Kuota hari ini penuh'
                  : `Sisa kuota walk-in: ${sisaKuota} dari ${todayQuota.kuotaMaksimal}`}
            </p>
          </div>
        </div>
      </section>

      {/* Kartu Pintasan Tiket Aktif Pelanggan */}
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
                      Ambil {formatTimeWibHHMM(activeCustomerWalkin.waktuAmbil)}{' '}
                      WIB
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
                  onClick={() => onNavigate('antrean-saya')}
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
                    <span>Jam {activeCustomerBooking.jamSlot} WIB</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-base text-stone-100 truncate">
                      {maskCustomerName(activeCustomerBooking.nama)}
                    </span>
                    <StatusIndicator status={activeCustomerBooking.status} compact />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('antrean-saya')}
                  className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-100 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 min-h-[44px]"
                >
                  Lihat Tiket
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Daftar Harga & Layanan + Promo Aktif */}
      <section aria-labelledby="daftar-harga-heading" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2
              id="daftar-harga-heading"
              className="font-display text-xl sm:text-2xl font-bold text-stone-100"
            >
              Daftar Harga &amp; Layanan
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Pilih satu atau lebih layanan saat booking. Harga final
              dikonfirmasi oleh capster sesuai kondisi rambut.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('booking')}
            className="min-h-[46px] px-5 py-2.5 rounded-xl bg-[var(--wib-accent)] hover:bg-amber-300 text-zinc-950 text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <CalendarCheck className="w-4 h-4 shrink-0" />
            <span>Booking Sekarang</span>
          </button>
        </div>

        {/* Banner Promo Aktif */}
        {activePromos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activePromos.map((promo) => (
              <div
                key={promo.id}
                className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/8 to-[var(--wib-surface)] border border-amber-400/40 flex items-start gap-3.5"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-amber-300">
                      Promo Aktif
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-zinc-950 text-[11px] font-bold font-mono tabular-nums">
                      {formatPromoShortBadge(promo)}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-base text-stone-100">
                    {promo.judul}
                  </h3>
                  {promo.deskripsi && (
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      {promo.deskripsi}
                    </p>
                  )}
                  {(promo.berlakuDari || promo.berlakuSampai) && (
                    <p className="text-[11px] text-amber-200/80 font-mono">
                      Berlaku:{' '}
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
              </div>
            ))}
          </div>
        )}

        {/* Kartu / Akordeon per Kategori Layanan */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICE_CATALOG.map((category) => {
            const isCollapsed = Boolean(collapsedCategories[category.id]);
            const categoryHasPromo = category.items.some((item) =>
              activePromos.some((p) => p.layananId.includes(item.id))
            );

            return (
              <div
                key={category.id}
                className="rounded-2xl bg-[var(--wib-surface)] border border-zinc-800/90 overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={!isCollapsed}
                  className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left border-b border-zinc-800/80 hover:bg-zinc-900/50 transition-colors min-h-[60px]"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <h3 className="font-display font-semibold text-base text-stone-100 truncate">
                      {category.nama}
                    </h3>
                    {categoryHasPromo && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-[10px] font-semibold text-amber-300 shrink-0">
                        <Tag className="w-3 h-3" />
                        <span>Promo</span>
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${
                      isCollapsed ? '-rotate-90' : 'rotate-0'
                    }`}
                  />
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-zinc-800/70 flex-1">
                    {category.items.map((item) => {
                      const promoInfo = getItemPromoPricing(item, activePromos);
                      return (
                        <div
                          key={item.id}
                          className="p-4 sm:px-5 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-stone-100">
                                {item.nama}
                                {item.perUnit ? ' (pilih jumlah warna)' : ''}
                              </p>
                              <p className="text-[11px] text-zinc-400 font-mono tabular-nums mt-0.5">
                                Estimasi {item.durasiMenit} menit
                                {item.perUnit ? ' / warna' : ''}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              {promoInfo.hasPromo ? (
                                <div className="space-y-0.5">
                                  <p className="text-xs font-mono tabular-nums text-zinc-500 line-through">
                                    {formatRupiah(item.harga)}
                                  </p>
                                  <p className="text-sm font-mono tabular-nums font-bold text-amber-300 whitespace-nowrap">
                                    {promoInfo.hargaDiskonText}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm font-mono tabular-nums font-bold text-stone-100 whitespace-nowrap">
                                  {formatRupiah(item.harga)}
                                </p>
                              )}
                            </div>
                          </div>

                          {promoInfo.hasPromo && promoInfo.discountNote && (
                            <p className="text-[11px] text-amber-300/95 bg-amber-500/10 border border-amber-500/25 rounded-md px-2.5 py-1 inline-block">
                              {promoInfo.discountNote}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Capster & Ketersediaan Hari Ini */}
      <section aria-labelledby="daftar-capster-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2
              id="daftar-capster-heading"
              className="font-display text-lg sm:text-xl font-semibold text-stone-100"
            >
              Capster Bertugas Hari Ini
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Cek slot jam kerja yang masih tersedia sebelum datang ke toko.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('jadwal')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-amber-400 hover:text-amber-300 whitespace-nowrap shrink-0 min-h-[36px]"
          >
            <span>Lihat Jadwal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div
          className={`grid gap-4 ${
            dbState.capsters.length === 1
              ? 'grid-cols-1 max-w-xl'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {dbState.capsters.map((capster) => {
            const { config, slots } = barberService.getComputedSlots(
              dbState,
              capster.id,
              todayStr,
              undefined,
              nowMs
            );
            const availableCount = slots.filter(
              (s) => s.status === 'Available'
            ).length;

            return (
              <div
                key={capster.id}
                className="p-5 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/90 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <CapsterAvatar
                    fotoKey={capster.fotoKey}
                    nama={capster.nama}
                    widthClass="w-16"
                  />
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-lg text-stone-100">
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
                      Tidak beroperasi hari ini
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
                        ? `${availableCount} slot tersedia hari ini`
                        : 'Slot hari ini penuh'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectCapsterForSchedule(capster.id)}
                    className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-100 text-xs font-medium whitespace-nowrap shrink-0 min-h-[38px] transition-colors"
                  >
                    Cek Jadwal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tentang Capster (About Hasan + Kontak WhatsApp & Instagram) */}
      <AboutCapster
        profile={capsterProfile}
        spesialisasi={dbState.capsters[0]?.spesialisasi}
        variant="full"
      />

      {/* Aturan Keadilan & Toleransi Keterlambatan */}
      <section className="p-5 sm:p-6 rounded-xl bg-[var(--wib-surface)] border border-zinc-800/80 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-sm sm:text-base text-stone-100">
              Prinsip Antrean Adil (First Come, First Served)
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Nomor walk-in dikunci berdasarkan waktu pengambilan dan otomatis
              reset menjadi A001 setiap hari pada jam buka. Urutan tidak dapat
              ditukar atau didahului.
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
    </div>
  );
}
