'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarOff,
  Check,
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  Scissors,
  Search,
  ShieldAlert,
  Tag,
  Ticket,
} from 'lucide-react';
import {
  addDaysYYYYMMDD,
  barberService,
  formatDateIndo,
  formatShortDateIndo,
  formatTimeWibHHMM,
  formatWhatsAppDisplay,
  maskCustomerName,
} from '@/lib/barber-service';
import {
  calculateServicesPricing,
  formatRupiah,
  formatRupiahRange,
  getItemPromoPricing,
  SERVICE_CATALOG,
} from '@/lib/services-catalog';
import {
  AppView,
  BarberDatabaseState,
  CapsterProfile,
  Customer,
  DataBooking,
  Promo,
  SelectedServiceInput,
  ServiceResult,
} from '@/lib/types';
import { AboutCapster } from './AboutCapster';
import { CapsterAvatar } from './BarbershopMedia';
import { StatusIndicator } from './StatusIndicator';

interface BookingViewProps {
  dbState: BarberDatabaseState;
  capsterProfile: CapsterProfile;
  todayStr: string;
  currentCustomer: Customer;
  activePromos: Promo[];
  preselectedBooking?: {
    capsterId?: string;
    tanggal?: string;
    jamSlot?: string;
  } | null;
  activeCustomerBooking: DataBooking | null;
  isOffline: boolean;
  onCreateBooking: (params: {
    customerId?: string;
    capsterId: string;
    tanggal: string;
    jamSlot: string;
    selectedServices?: SelectedServiceInput[];
  }) => ServiceResult<{
    booking: DataBooking;
    state: BarberDatabaseState;
  }>;
  onNavigate: (view: AppView) => void;
}

export function BookingView({
  dbState,
  capsterProfile,
  todayStr,
  currentCustomer,
  activePromos,
  preselectedBooking,
  activeCustomerBooking,
  isOffline,
  onCreateBooking,
  onNavigate,
}: BookingViewProps) {
  const [tab, setTab] = useState<'buat' | 'cek'>('buat');

  // Step 1: Pilih Layanan (default: Premium Haircut terpilih agar langsung siap atau bisa diubah)
  const [selectedServices, setSelectedServices] = useState<
    Record<string, number>
  >({
    'premium-haircut': 1,
  });

  const defaultCapsterId =
    preselectedBooking?.capsterId ||
    dbState.capsters.find((c) => c.id === currentCustomer.capsterFavoritId)
      ?.id ||
    dbState.capsters[0]?.id ||
    'hasan';

  const initialTanggal =
    preselectedBooking?.tanggal && preselectedBooking.tanggal >= todayStr
      ? preselectedBooking.tanggal
      : todayStr;

  const [capsterId, setCapsterId] = useState<string>(defaultCapsterId);
  const [tanggal, setTanggal] = useState<string>(initialTanggal);
  const [jamSlot, setJamSlot] = useState<string>(
    preselectedBooking?.jamSlot || ''
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [issuedBooking, setIssuedBooking] = useState<DataBooking | null>(null);

  // Cek Tiket state
  const [searchCode, setSearchCode] = useState<string>('');
  const [checkedTicket, setCheckedTicket] = useState<DataBooking | null>(
    activeCustomerBooking
  );
  const [checkError, setCheckError] = useState<string | null>(null);

  const selectionList: SelectedServiceInput[] = Object.entries(selectedServices)
    .filter(([, qty]) => qty > 0)
    .map(([itemId, qty]) => ({ itemId, qty }));

  const pricing = calculateServicesPricing(selectionList, activePromos);

  const dateOptions = Array.from({ length: 7 }, (_, i) =>
    addDaysYYYYMMDD(todayStr, i)
  );
  const effectiveTanggal = tanggal >= todayStr ? tanggal : todayStr;

  const selectedCapster =
    dbState.capsters.find((c) => c.id === capsterId) || dbState.capsters[0];

  const { config, slots } = barberService.getComputedSlots(
    dbState,
    selectedCapster.id,
    effectiveTanggal
  );

  // Validasi apakah slot yang saat ini dipilih masih cukup untuk durasi layanan terbaru
  const selectedSpanCheck = jamSlot
    ? barberService.canStartSlotFitDuration(slots, jamSlot, pricing.slotsNeeded)
    : null;
  const effectiveJamSlot =
    jamSlot && selectedSpanCheck?.ok ? jamSlot : '';
  const coveredSelectedHours = new Set(
    effectiveJamSlot && selectedSpanCheck?.ok
      ? selectedSpanCheck.coveredSlots
      : []
  );

  const toggleServiceItem = (itemId: string) => {
    setFormError(null);
    setSelectedServices((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = 1;
      }
      return next;
    });
  };

  const changeItemQty = (itemId: string, delta: number) => {
    setFormError(null);
    setSelectedServices((prev) => {
      const curr = prev[itemId] || 0;
      const nextQty = curr + delta;
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[itemId];
      } else {
        next[itemId] = Math.min(10, nextQty);
      }
      return next;
    });
  };

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (selectionList.length === 0) {
      setFormError('Pilih minimal satu layanan sebelum mengonfirmasi booking.');
      return;
    }

    if (!effectiveJamSlot) {
      setFormError(
        `Pilih slot mulai berwarna hijau (Available) yang mencukupi ${pricing.slotsNeeded} slot (${pricing.durasiTotalMenit} menit).`
      );
      return;
    }

    const res = onCreateBooking({
      customerId: currentCustomer.id,
      capsterId: selectedCapster.id,
      tanggal: effectiveTanggal,
      jamSlot: effectiveJamSlot,
      selectedServices: selectionList,
    });

    if (!res.ok || !res.data) {
      setFormError(
        res.message || 'Gagal membuat booking. Silakan pilih slot lain.'
      );
      if (res.errorCode === 'SLOT_TAKEN') {
        setJamSlot('');
      }
      return;
    }

    setIssuedBooking(res.data.booking);
    setCheckedTicket(res.data.booking);
    setJamSlot('');
  };

  const handleLookupTicket = (codeInput: string) => {
    setCheckError(null);
    const clean = codeInput.trim().toUpperCase();
    if (!clean) {
      setCheckError('Masukkan kode tiket booking Anda, misalnya BK-20261127-001.');
      return;
    }
    const found = dbState.bookings.find(
      (b) => b.kodeTiket.toUpperCase() === clean
    );
    if (!found) {
      setCheckedTicket(null);
      setCheckError(
        `Tiket dengan kode "${clean}" tidak ditemukan. Periksa kembali penulisan kode Anda.`
      );
      return;
    }
    setCheckedTicket(found);
  };

  const liveIssuedBooking = issuedBooking
    ? dbState.bookings.find((b) => b.id === issuedBooking.id) || issuedBooking
    : null;

  const liveCheckedTicket = checkedTicket
    ? dbState.bookings.find((b) => b.id === checkedTicket.id) || checkedTicket
    : null;

  const getCapsterName = (id: string) =>
    dbState.capsters.find((c) => c.id === id)?.nama || 'Capster';

  const renderTicketCard = (ticket: DataBooking) => {
    const isOwner = ticket.customerId === currentCustomer.id;
    const hasServices =
      Array.isArray(ticket.layananDipilih) && ticket.layananDipilih.length > 0;
    const coveredSlotsText =
      ticket.slotTercakup && ticket.slotTercakup.length > 1
        ? `${ticket.slotTercakup[0]} – ${String(
            Number(
              ticket.slotTercakup[ticket.slotTercakup.length - 1].split(':')[0]
            ) + 1
          ).padStart(2, '0')}:00 WIB (${ticket.slotTercakup.length} slot)`
        : `${ticket.jamSlot} WIB`;

    return (
      <div className="rounded-2xl bg-[var(--wib-surface)] border border-amber-500/40 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <p className="text-xs text-zinc-400">Kode Tiket Booking</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-amber-400 mt-0.5">
              {ticket.kodeTiket}
            </p>
          </div>
          <StatusIndicator status={ticket.status} />
        </div>

        {ticket.status === 'Canceled' && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-rose-200">
                Booking Dibatalkan{' '}
                {ticket.alasanBatal === 'otomatis'
                  ? 'Otomatis oleh Sistem'
                  : ticket.alasanBatal === 'capster_tidak_tersedia'
                    ? 'karena Capster Tidak Tersedia'
                    : 'oleh Capster / Pelanggan'}
              </p>
              <p className="text-xs text-rose-100/80 leading-relaxed">
                {ticket.catatanBatal ||
                  (ticket.alasanBatal === 'otomatis'
                    ? `Pelanggan tidak hadir melewati batas toleransi keterlambatan 15 menit dari jadwal pukul ${ticket.jamSlot} WIB.`
                    : 'Booking ini dibatalkan. Silakan buat booking baru jika masih ingin bercukur.')}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <p className="text-xs text-zinc-400">Nama Pelanggan</p>
            <p className="font-semibold text-stone-100 mt-1">
              {isOwner ? ticket.nama : maskCustomerName(ticket.nama)}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <p className="text-xs text-zinc-400">Nomor WhatsApp</p>
            <p className="font-mono tabular-nums font-semibold text-stone-100 mt-1">
              {isOwner
                ? formatWhatsAppDisplay(ticket.nomorWhatsApp)
                : 'Terlindungi (Privasi)'}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <p className="text-xs text-zinc-400">Capster Pilihan</p>
            <p className="font-semibold text-stone-100 mt-1">
              {getCapsterName(ticket.capsterId)}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <p className="text-xs text-zinc-400">Tanggal &amp; Jam Slot</p>
            <p className="font-semibold text-amber-300 mt-1 font-mono tabular-nums">
              {formatShortDateIndo(ticket.tanggal)} · {coveredSlotsText}
            </p>
          </div>
        </div>

        {/* Rincian Layanan & Estimasi Harga */}
        {hasServices && ticket.layananDipilih && (
          <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Layanan &amp; Estimasi Biaya
              </p>
              {ticket.durasiTotalMenit && (
                <span className="text-xs font-mono tabular-nums text-amber-300">
                  Total durasi ±{ticket.durasiTotalMenit} menit
                </span>
              )}
            </div>

            <div className="divide-y divide-zinc-800/80 text-xs sm:text-sm">
              {ticket.layananDipilih.map((line, idx) => (
                <div
                  key={`${line.itemId}-${idx}`}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-stone-100 font-medium">
                      {line.nama}
                    </span>
                    {line.qty > 1 && (
                      <span className="text-amber-300 font-mono ml-1.5">
                        ×{line.qty}
                      </span>
                    )}
                    {line.diskonMaxPersen > 0 && (
                      <span className="ml-2 text-[11px] text-amber-300">
                        (Promo{' '}
                        {line.diskonMinPersen === line.diskonMaxPersen
                          ? `${line.diskonMaxPersen}%`
                          : `${line.diskonMinPersen}–${line.diskonMaxPersen}%`}
                        )
                      </span>
                    )}
                  </div>
                  <span className="font-mono tabular-nums text-zinc-300">
                    {formatRupiah(line.hargaSatuan * line.qty)}
                  </span>
                </div>
              ))}
            </div>

            {typeof ticket.subtotalHarga === 'number' && (
              <div className="pt-2 border-t border-zinc-800 space-y-1 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatRupiah(ticket.subtotalHarga)}
                  </span>
                </div>
                {(ticket.potonganMax || 0) > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>
                      Diskon Promo
                      {ticket.promoJudul && ticket.promoJudul.length > 0
                        ? ` (${ticket.promoJudul.join(', ')})`
                        : ''}
                    </span>
                    <span className="font-mono tabular-nums">
                      -
                      {formatRupiahRange(
                        ticket.potonganMin || 0,
                        ticket.potonganMax || 0
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-amber-300 pt-1">
                  <span>Total Estimasi</span>
                  <span className="font-mono tabular-nums">
                    {formatRupiahRange(
                      ticket.totalEstimasiMin ?? ticket.subtotalHarga,
                      ticket.totalEstimasiMax ?? ticket.subtotalHarga
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 pt-1">
                  Harga final dikonfirmasi capster.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-100/90 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">
              Aturan Toleransi Keterlambatan (15 Menit):
            </strong>{' '}
            Harap tiba sebelum pukul{' '}
            <span className="font-mono tabular-nums font-semibold">
              {ticket.jamSlot} WIB
            </span>
            . Batas akhir konfirmasi kehadiran adalah 15 menit setelah jam
            slot. Lewat dari itu, sistem otomatis membatalkan booking dan
            mengalihkan slot ke antrean walk-in.
          </div>
        </div>

        <p className="text-xs text-zinc-500 font-mono tabular-nums">
          Dibuat pukul {formatTimeWibHHMM(ticket.waktuDibuat)} WIB
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
            Booking Layanan Capster
          </h1>
          <p className="text-sm text-zinc-400">
            Pilih layanan, tentukan capster &amp; slot jam yang tersedia, lalu
            konfirmasi tiket booking Anda.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[var(--wib-surface)] border border-zinc-800 self-start">
          <button
            type="button"
            onClick={() => setTab('buat')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors min-h-[40px] ${
              tab === 'buat'
                ? 'bg-amber-400 text-zinc-950 font-semibold'
                : 'text-zinc-300 hover:text-stone-100'
            }`}
          >
            Buat Booking
          </button>
          <button
            type="button"
            onClick={() => setTab('cek')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors min-h-[40px] ${
              tab === 'cek'
                ? 'bg-amber-400 text-zinc-950 font-semibold'
                : 'text-zinc-300 hover:text-stone-100'
            }`}
          >
            Cek Tiket Booking
          </button>
        </div>
      </div>

      {tab === 'buat' && (
        <>
          {liveIssuedBooking ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/35 flex items-center gap-3 text-sm text-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  Slot berhasil dikunci! Anda juga dapat mengelola atau mengubah
                  jadwal dari halaman Antrean &amp; Jadwal Saya.
                </span>
              </div>

              {renderTicketCard(liveIssuedBooking)}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('antrean-saya')}
                  className="min-h-[48px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-sm font-semibold"
                >
                  Lihat di Antrean &amp; Jadwal Saya
                </button>
                <button
                  type="button"
                  onClick={() => setIssuedBooking(null)}
                  className="min-h-[48px] px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-stone-100 border border-zinc-700 text-sm font-medium"
                >
                  Buat Booking Lainnya
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirmBooking} className="space-y-6">
              {isOffline && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 text-sm text-amber-200">
                  Koneksi terputus. Booking baru hanya dapat dikirim saat
                  terhubung ke jaringan.
                </div>
              )}

              {/* Step 1: Pilih Layanan */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--wib-surface)] border border-zinc-800/90 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-stone-100 flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>1. Pilih Layanan</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Boleh memilih lebih dari satu layanan. Durasi total
                      menentukan jumlah slot jam yang dibutuhkan.
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-amber-300">
                    {pricing.lines.length} layanan dipilih
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {SERVICE_CATALOG.map((category) => (
                    <div
                      key={category.id}
                      className="rounded-xl bg-zinc-900/65 border border-zinc-800 p-4 space-y-3"
                    >
                      <h3 className="font-display text-sm font-semibold text-amber-300">
                        {category.nama}
                      </h3>

                      <div className="space-y-2.5">
                        {category.items.map((item) => {
                          const qty = selectedServices[item.id] || 0;
                          const isChecked = qty > 0;
                          const promoInfo = getItemPromoPricing(
                            item,
                            activePromos,
                            Math.max(1, qty)
                          );

                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-xl border transition-colors ${
                                isChecked
                                  ? 'bg-amber-500/10 border-amber-400/70'
                                  : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => toggleServiceItem(item.id)}
                                  className="flex items-start gap-2.5 text-left flex-1 min-w-0 min-h-[36px]"
                                >
                                  <span
                                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                      isChecked
                                        ? 'bg-amber-400 border-amber-400 text-zinc-950'
                                        : 'bg-zinc-900 border-zinc-600'
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3.5 h-3.5" />}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-stone-100">
                                      {item.nama}
                                    </p>
                                    <p className="text-[11px] text-zinc-400 font-mono tabular-nums">
                                      ±{item.durasiMenit} mnt
                                      {item.perUnit ? ' / warna' : ''}
                                    </p>
                                  </div>
                                </button>

                                <div className="text-right shrink-0">
                                  {promoInfo.hasPromo ? (
                                    <div>
                                      <p className="text-[11px] font-mono tabular-nums text-zinc-500 line-through">
                                        {formatRupiah(promoInfo.hargaNormal)}
                                      </p>
                                      <p className="text-xs sm:text-sm font-mono tabular-nums font-bold text-amber-300">
                                        {promoInfo.hargaDiskonText}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="text-xs sm:text-sm font-mono tabular-nums font-semibold text-stone-100">
                                      {formatRupiah(item.harga)}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {promoInfo.hasPromo && promoInfo.discountBadge && (
                                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/35 text-[10px] font-medium text-amber-300">
                                  <Tag className="w-3 h-3" />
                                  <span>{promoInfo.discountBadge}</span>
                                </div>
                              )}

                              {item.perUnit && (
                                <div className="mt-2.5 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                                  <span className="text-xs text-zinc-400">
                                    Jumlah warna
                                  </span>
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => changeItemQty(item.id, -1)}
                                      disabled={qty === 0}
                                      aria-label="Kurangi jumlah warna"
                                      className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-stone-100 flex items-center justify-center"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="w-7 text-center font-mono tabular-nums text-xs font-bold text-stone-100">
                                      {qty}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => changeItemQty(item.id, 1)}
                                      aria-label="Tambah jumlah warna"
                                      className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-stone-100 flex items-center justify-center"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Ringkasan Layanan, Promo & Estimasi Durasi */}
                <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/90 border border-amber-500/30 space-y-2.5">
                  {pricing.lines.length === 0 ? (
                    <p className="text-xs sm:text-sm text-rose-300">
                      Belum ada layanan dipilih. Silakan centang minimal satu
                      layanan di atas.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-300">
                        <span>
                          Layanan terpilih:{' '}
                          <strong className="text-stone-100">
                            {pricing.lines
                              .map((l) =>
                                l.qty > 1 ? `${l.nama} (×${l.qty})` : l.nama
                              )
                              .join(', ')}
                          </strong>
                        </span>
                        <span className="font-mono tabular-nums text-amber-300 font-semibold">
                          Estimasi durasi: {pricing.durasiTotalMenit} menit (
                          {pricing.slotsNeeded} slot jam)
                        </span>
                      </div>

                      <div className="pt-2 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-400">Subtotal: </span>
                          <span className="font-mono tabular-nums font-semibold text-stone-200">
                            {formatRupiah(pricing.subtotalHarga)}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-400">Diskon Promo: </span>
                          <span className="font-mono tabular-nums font-semibold text-emerald-400">
                            {pricing.potonganMax > 0
                              ? `-${formatRupiahRange(
                                  pricing.potonganMin,
                                  pricing.potonganMax
                                )}`
                              : 'Rp0'}
                          </span>
                        </div>
                        <div className="sm:text-right">
                          <span className="text-zinc-400">Total Estimasi: </span>
                          <span className="font-mono tabular-nums font-bold text-amber-300 text-sm">
                            {formatRupiahRange(
                              pricing.totalEstimasiMin,
                              pricing.totalEstimasiMax
                            )}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-400">
                        Harga final dikonfirmasi capster.
                        {pricing.hasDiscountRange &&
                          ' Rentang harga mengikuti persentase diskon promo yang berlaku.'}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Step 2: Pilih Capster, Tanggal & Slot Kosong */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--wib-surface)] border border-zinc-800/90 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-stone-100">
                    2. Pilih Capster, Tanggal &amp; Slot Kosong
                  </h2>
                  {pricing.slotsNeeded > 1 && (
                    <span className="text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                      Butuh {pricing.slotsNeeded} slot berurutan (
                      {pricing.durasiTotalMenit} mnt)
                    </span>
                  )}
                </div>

                <div
                  className={`grid gap-3 ${
                    dbState.capsters.length === 1
                      ? 'grid-cols-1 max-w-md'
                      : 'grid-cols-1 sm:grid-cols-3'
                  }`}
                >
                  {dbState.capsters.map((c) => {
                    const active = c.id === selectedCapster.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCapsterId(c.id);
                          setJamSlot('');
                        }}
                        className={`p-3.5 rounded-xl border text-left flex items-center gap-3 min-h-[64px] transition-colors ${
                          active
                            ? 'bg-amber-500/10 border-amber-400'
                            : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <CapsterAvatar
                          fotoKey={c.fotoKey}
                          nama={c.nama}
                          widthClass="w-11"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-stone-100">
                            {c.nama}
                          </p>
                          <p className="text-[11px] text-amber-400 truncate">
                            {c.gelar}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedCapster.id === capsterProfile.capsterId && (
                  <AboutCapster
                    profile={capsterProfile}
                    spesialisasi={selectedCapster.spesialisasi}
                    variant="compact"
                  />
                )}

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dateOptions.map((dt, idx) => {
                    const active = dt === effectiveTanggal;
                    return (
                      <button
                        key={dt}
                        type="button"
                        onClick={() => {
                          setTanggal(dt);
                          setJamSlot('');
                        }}
                        className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
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

                {config.isLibur ? (
                  <div className="p-6 rounded-xl bg-zinc-900/80 border border-rose-500/35 text-center space-y-2">
                    <CalendarOff className="w-8 h-8 text-rose-400 mx-auto" />
                    <p className="font-semibold text-sm text-rose-200">
                      Capster tidak beroperasi pada tanggal ini
                    </p>
                    <p className="text-xs text-zinc-400">
                      {selectedCapster.nama} sedang tidak beroperasi (
                      {config.alasanLibur || 'Libur / Izin'}). Silakan pilih
                      tanggal lain.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs text-zinc-400">
                      Pilih jam mulai berwarna hijau (Available) untuk{' '}
                      <strong className="text-stone-200">
                        {selectedCapster.nama}
                      </strong>{' '}
                      pada{' '}
                      <strong className="text-stone-200">
                        {formatDateIndo(effectiveTanggal)}
                      </strong>{' '}
                      (jam operasional {config.jamKerja.buka.replace(':', '.')}–
                      {config.jamKerja.tutup.replace(':', '.')} WIB):
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      {slots.map((slot) => {
                        const spanCheck = barberService.canStartSlotFitDuration(
                          slots,
                          slot.jam,
                          pricing.slotsNeeded
                        );
                        const canSelectStart =
                          slot.status === 'Available' && spanCheck.ok;
                        const isStartSelected =
                          effectiveJamSlot === slot.jam && canSelectStart;
                        const isCoveredBySelection =
                          !isStartSelected && coveredSelectedHours.has(slot.jam);
                        const isUnavail = slot.status === 'Tidak Tersedia';

                        return (
                          <button
                            key={slot.jam}
                            type="button"
                            disabled={!canSelectStart}
                            onClick={() => setJamSlot(slot.jam)}
                            title={
                              !canSelectStart && spanCheck.reason
                                ? spanCheck.reason
                                : undefined
                            }
                            className={`min-h-[58px] px-2.5 py-2 rounded-xl border text-center transition-all ${
                              isStartSelected
                                ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold ring-2 ring-amber-400/50'
                                : isCoveredBySelection
                                  ? 'bg-amber-400/25 text-amber-200 border-amber-400 font-semibold'
                                  : canSelectStart
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                    : isUnavail
                                      ? 'bg-zinc-900 border-zinc-700/80 text-zinc-500 cursor-not-allowed'
                                      : slot.status === 'Available'
                                        ? 'bg-zinc-900/70 border-zinc-800 text-zinc-500 cursor-not-allowed'
                                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400/75 cursor-not-allowed'
                            }`}
                          >
                            <div className="font-mono tabular-nums text-sm font-bold">
                              {slot.jam}
                            </div>
                            <div className="text-[10px] mt-0.5 truncate">
                              {isStartSelected
                                ? 'Mulai'
                                : isCoveredBySelection
                                  ? 'Terpakai'
                                  : slot.status === 'Available' && !spanCheck.ok
                                    ? 'Tdk cukup'
                                    : slot.status}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3 & 4: Data Diri & Konfirmasi Booking */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[var(--wib-surface)] border border-zinc-800/90 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold text-stone-100">
                    3. Data Diri &amp; 4. Konfirmasi Booking
                  </h2>
                  <button
                    type="button"
                    onClick={() => onNavigate('profil')}
                    className="text-xs font-medium text-amber-400 hover:text-amber-300"
                  >
                    Ubah di profil
                  </button>
                </div>

                {formError && (
                  <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/45 text-sm text-rose-200 flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="booking-nama"
                      className="block text-sm font-medium text-stone-200 mb-1.5"
                    >
                      Nama Lengkap
                    </label>
                    <input
                      id="booking-nama"
                      type="text"
                      readOnly
                      value={currentCustomer.nama}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-200 text-sm cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="booking-wa"
                      className="block text-sm font-medium text-stone-200 mb-1.5"
                    >
                      Nomor WhatsApp
                    </label>
                    <input
                      id="booking-wa"
                      type="tel"
                      readOnly
                      value={formatWhatsAppDisplay(
                        currentCustomer.nomorWhatsApp
                      )}
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-200 text-sm font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/35 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm text-amber-100/90 space-y-1">
                    <p className="font-semibold text-amber-300">
                      Perhatian: Toleransi Keterlambatan Maksimal 15 Menit
                    </p>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      Dengan mengonfirmasi booking, Anda menyetujui bahwa jika
                      terlambat lebih dari 15 menit dari jam slot tanpa
                      konfirmasi, booking otomatis dibatalkan oleh sistem dan
                      slot dialihkan ke antrean walk-in. Harga final
                      dikonfirmasi capster.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    isOffline || config.isLibur || pricing.lines.length === 0
                  }
                  className="w-full min-h-[54px] px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold text-base flex items-center justify-center gap-2 transition-colors"
                >
                  <CalendarCheck className="w-5 h-5" />
                  <span>
                    Konfirmasi Booking{' '}
                    {effectiveJamSlot
                      ? `(${selectedCapster.nama} · ${effectiveJamSlot} · ${formatRupiahRange(
                          pricing.totalEstimasiMin,
                          pricing.totalEstimasiMax
                        )})`
                      : ''}
                  </span>
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {tab === 'cek' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-[var(--wib-surface)] border border-zinc-800/90 space-y-4">
            <h2 className="font-display text-lg font-semibold text-stone-100">
              Cek Status Tiket Booking
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLookupTicket(searchCode);
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                placeholder="Masukkan kode tiket (contoh: BK-20261127-001)"
                className="flex-1 min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm font-mono uppercase focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="min-h-[48px] px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>Cek Tiket</span>
              </button>
            </form>

            {checkError && (
              <p className="text-sm text-rose-400">{checkError}</p>
            )}
          </div>

          {liveCheckedTicket ? (
            renderTicketCard(liveCheckedTicket)
          ) : (
            <div className="p-8 rounded-2xl bg-[var(--wib-surface)] border border-zinc-800/80 text-center space-y-2">
              <Ticket className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="text-sm text-zinc-400">
                Masukkan kode tiket booking Anda untuk melihat jadwal, status,
                atau pemberitahuan pembatalan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
