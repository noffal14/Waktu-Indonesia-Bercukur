'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarOff,
  CheckCircle2,
  Clock,
  Search,
  ShieldAlert,
  Ticket,
} from 'lucide-react';
import {
  addDaysYYYYMMDD,
  barberService,
  formatDateIndo,
  formatShortDateIndo,
  formatTimeHHMM,
  validateIndonesianWhatsApp,
} from '@/lib/barber-service';
import {
  AppView,
  BarberDatabaseState,
  DataBooking,
  ServiceResult,
} from '@/lib/types';
import { CapsterAvatar } from './BarbershopMedia';
import { StatusIndicator } from './StatusIndicator';

interface BookingViewProps {
  dbState: BarberDatabaseState;
  todayStr: string;
  preselectedBooking?: {
    capsterId?: string;
    tanggal?: string;
    jamSlot?: string;
  } | null;
  activeCustomerBooking: DataBooking | null;
  isOffline: boolean;
  onCreateBooking: (params: {
    capsterId: string;
    tanggal: string;
    jamSlot: string;
    nama: string;
    nomorWhatsApp: string;
  }) => ServiceResult<{
    booking: DataBooking;
    state: BarberDatabaseState;
  }>;
  onTrackBookingCode: (code: string) => void;
  onNavigate: (view: AppView) => void;
}

export function BookingView({
  dbState,
  todayStr,
  preselectedBooking,
  activeCustomerBooking,
  isOffline,
  onCreateBooking,
  onTrackBookingCode,
  onNavigate,
}: BookingViewProps) {
  const [tab, setTab] = useState<'buat' | 'cek'>('buat');

  const [capsterId, setCapsterId] = useState<string>(
    preselectedBooking?.capsterId || dbState.capsters[0]?.id || 'hasan'
  );
  const [tanggal, setTanggal] = useState<string>(
    preselectedBooking?.tanggal || todayStr
  );
  const [jamSlot, setJamSlot] = useState<string>(
    preselectedBooking?.jamSlot || ''
  );
  const [nama, setNama] = useState<string>('');
  const [nomorWhatsApp, setNomorWhatsApp] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [issuedBooking, setIssuedBooking] = useState<DataBooking | null>(null);

  // Cek Tiket state
  const [searchCode, setSearchCode] = useState<string>('');
  const [checkedTicket, setCheckedTicket] = useState<DataBooking | null>(
    activeCustomerBooking
  );
  const [checkError, setCheckError] = useState<string | null>(null);

  const dateOptions = Array.from({ length: 7 }, (_, i) =>
    addDaysYYYYMMDD(todayStr, i)
  );

  const selectedCapster =
    dbState.capsters.find((c) => c.id === capsterId) || dbState.capsters[0];

  const { config, slots } = barberService.getComputedSlots(
    dbState,
    capsterId,
    tanggal
  );

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!jamSlot) {
      setFormError('Pilih salah satu slot jam yang tersedia (hijau) terlebih dahulu.');
      return;
    }
    if (nama.trim().length < 2) {
      setFormError('Nama lengkap wajib diisi (minimal 2 karakter).');
      return;
    }
    const waValidation = validateIndonesianWhatsApp(nomorWhatsApp);
    if (!waValidation.valid) {
      setFormError(waValidation.error || 'Nomor WhatsApp tidak valid.');
      return;
    }

    const res = onCreateBooking({
      capsterId,
      tanggal,
      jamSlot,
      nama,
      nomorWhatsApp,
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
    setNama('');
    setNomorWhatsApp('');
    setJamSlot('');
  };

  const handleLookupTicket = (codeInput: string) => {
    setCheckError(null);
    const clean = codeInput.trim().toUpperCase();
    if (!clean) {
      setCheckError('Masukkan kode tiket booking, misalnya BK-20261127-001.');
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
    onTrackBookingCode(found.kodeTiket);
  };

  const liveIssuedBooking = issuedBooking
    ? dbState.bookings.find((b) => b.id === issuedBooking.id) || issuedBooking
    : null;

  const liveCheckedTicket = checkedTicket
    ? dbState.bookings.find((b) => b.id === checkedTicket.id) || checkedTicket
    : null;

  const getCapsterName = (id: string) =>
    dbState.capsters.find((c) => c.id === id)?.nama || 'Capster';

  const sampleCanceledTicket = dbState.bookings.find(
    (b) => b.status === 'Canceled'
  );
  const sampleBookedTicket = dbState.bookings.find((b) => b.status === 'Booked');

  const renderTicketCard = (ticket: DataBooking) => (
    <div className="rounded-2xl bg-[#131317] border border-amber-500/40 p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <p className="text-xs text-zinc-400">Kode Tiket Booking</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-amber-400 mt-0.5">
            {ticket.kodeTiket}
          </p>
        </div>
        <StatusIndicator status={ticket.status} />
      </div>

      {/* Notifikasi Pembatalan Otomatis / Manual */}
      {ticket.status === 'Canceled' && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-rose-200">
              Booking Dibatalkan{' '}
              {ticket.alasanBatal === 'otomatis'
                ? 'Otomatis oleh Sistem'
                : 'oleh Capster'}
            </p>
            <p className="text-xs text-rose-100/80 leading-relaxed">
              {ticket.alasanBatal === 'otomatis'
                ? `Pelanggan tidak hadir melewati batas toleransi keterlambatan 15 menit dari jadwal pukul ${ticket.jamSlot} WIB. Slot telah dibuka kembali untuk antrean walk-in.`
                : 'Booking ini dibatalkan karena keterlambatan melebihi toleransi 15 menit. Silakan buat booking baru jika masih ingin bercukur.'}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
          <p className="text-xs text-zinc-400">Nama Pelanggan</p>
          <p className="font-semibold text-stone-100 mt-1">{ticket.nama}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
          <p className="text-xs text-zinc-400">Nomor WhatsApp</p>
          <p className="font-mono tabular-nums font-semibold text-stone-100 mt-1">
            {ticket.nomorWhatsApp}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
          <p className="text-xs text-zinc-400">Capster Pilihan</p>
          <p className="font-semibold text-stone-100 mt-1">
            {getCapsterName(ticket.capsterId)}
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800">
          <p className="text-xs text-zinc-400">Tanggal & Jam Slot</p>
          <p className="font-semibold text-amber-300 mt-1 font-mono tabular-nums">
            {formatShortDateIndo(ticket.tanggal)} · {ticket.jamSlot} WIB
          </p>
        </div>
      </div>

      {/* Aturan Toleransi Keterlambatan di Tiket */}
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
          . Batas akhir konfirmasi kehadiran adalah 15 menit setelah jam slot.
          Lewat dari itu, sistem otomatis membatalkan booking dan mengalihkan
          slot ke antrean walk-in.
        </div>
      </div>

      <p className="text-xs text-zinc-500 font-mono tabular-nums">
        Dibuat pukul {formatTimeHHMM(ticket.waktuDibuat)} WIB
      </p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
            Booking Layanan Capster
          </h1>
          <p className="text-sm text-zinc-400">
            Kunci slot cukur Anda tanpa perlu antre di lokasi, atau cek status
            tiket booking yang sudah dibuat.
          </p>
        </div>

        {/* Segmented Tab Switch */}
        <div className="inline-flex p-1 rounded-xl bg-[#131317] border border-zinc-800 self-start">
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

      {/* TAB 1: BUAT BOOKING */}
      {tab === 'buat' && (
        <>
          {liveIssuedBooking ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/35 flex items-center gap-3 text-sm text-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  Slot berhasil dikunci! Simpan atau catat kode tiket booking
                  Anda di bawah ini.
                </span>
              </div>

              {renderTicketCard(liveIssuedBooking)}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setIssuedBooking(null)}
                  className="min-h-[48px] px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-stone-100 border border-zinc-700 text-sm font-medium"
                >
                  Buat Booking Lainnya
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('jadwal')}
                  className="min-h-[48px] px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-stone-100 border border-zinc-700 text-sm font-medium"
                >
                  Lihat Kalender Jadwal Capster
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

              {/* Step 1: Pilih Capster & Tanggal */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5">
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  1. Pilih Capster, Tanggal & Slot Kosong
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {dbState.capsters.map((c) => {
                    const active = c.id === capsterId;
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
                          sizeClass="w-10 h-10"
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

                {/* Tanggal */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dateOptions.map((dt, idx) => {
                    const active = dt === tanggal;
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

                {/* Slot Grid */}
                {config.isLibur ? (
                  <div className="p-6 rounded-xl bg-zinc-900/80 border border-rose-500/35 text-center space-y-2">
                    <CalendarOff className="w-8 h-8 text-rose-400 mx-auto" />
                    <p className="font-semibold text-sm text-rose-200">
                      Capster tidak beroperasi pada tanggal ini
                    </p>
                    <p className="text-xs text-zinc-400">
                      {selectedCapster.nama} sedang libur/izin. Silakan pilih
                      capster atau tanggal lain.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs text-zinc-400">
                      Pilih slot berwarna hijau (Available) untuk{' '}
                      <strong className="text-stone-200">
                        {selectedCapster.nama}
                      </strong>{' '}
                      pada{' '}
                      <strong className="text-stone-200">
                        {formatDateIndo(tanggal)}
                      </strong>
                      :
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                      {slots.map((slot) => {
                        const isAvail = slot.status === 'Available';
                        const isSelected = jamSlot === slot.jam && isAvail;
                        return (
                          <button
                            key={slot.jam}
                            type="button"
                            disabled={!isAvail}
                            onClick={() => setJamSlot(slot.jam)}
                            className={`min-h-[54px] px-3 py-2 rounded-xl border text-center transition-all ${
                              isSelected
                                ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold ring-2 ring-amber-400/50'
                                : isAvail
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400/70 cursor-not-allowed'
                            }`}
                          >
                            <div className="font-mono tabular-nums text-sm font-bold">
                              {slot.jam}
                            </div>
                            <div className="text-[10px] mt-0.5">
                              {isSelected ? 'Dipilih' : slot.status}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Data Pelanggan & Konfirmasi */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5">
                <h2 className="font-display text-lg font-semibold text-stone-100">
                  2. Data Pelanggan & Konfirmasi
                </h2>

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
                      Nama Lengkap <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="booking-nama"
                      type="text"
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="Contoh: Ahmad Fauzan"
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="booking-wa"
                      className="block text-sm font-medium text-stone-200 mb-1.5"
                    >
                      Nomor WhatsApp <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="booking-wa"
                      type="tel"
                      required
                      value={nomorWhatsApp}
                      onChange={(e) => setNomorWhatsApp(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Aturan Toleransi Keterlambatan di Halaman Konfirmasi */}
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
                      slot dialihkan ke antrean walk-in.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isOffline || config.isLibur}
                  className="w-full min-h-[54px] px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold text-base flex items-center justify-center gap-2 transition-colors"
                >
                  <CalendarCheck className="w-5 h-5" />
                  <span>
                    Konfirmasi Booking{' '}
                    {jamSlot ? `(${selectedCapster.nama} · ${jamSlot})` : ''}
                  </span>
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* TAB 2: CEK TIKET BOOKING */}
      {tab === 'cek' && (
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-4">
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
                placeholder="Masukkan kode tiket (contoh: BK-20261127-003)"
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

            {/* Pintasan Kode Tiket Demo agar mudah diuji */}
            {(sampleBookedTicket || sampleCanceledTicket) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 pt-1">
                <span>Contoh kode demo:</span>
                {sampleBookedTicket && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchCode(sampleBookedTicket.kodeTiket);
                      handleLookupTicket(sampleBookedTicket.kodeTiket);
                    }}
                    className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 font-mono text-zinc-200"
                  >
                    {sampleBookedTicket.kodeTiket} (Booked)
                  </button>
                )}
                {sampleCanceledTicket && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchCode(sampleCanceledTicket.kodeTiket);
                      handleLookupTicket(sampleCanceledTicket.kodeTiket);
                    }}
                    className="px-2.5 py-1 rounded-md bg-rose-950/40 hover:bg-rose-950/60 border border-rose-500/35 font-mono text-rose-200"
                  >
                    {sampleCanceledTicket.kodeTiket} (Canceled &gt;15m)
                  </button>
                )}
              </div>
            )}

            {checkError && (
              <p className="text-sm text-rose-400">{checkError}</p>
            )}
          </div>

          {liveCheckedTicket ? (
            renderTicketCard(liveCheckedTicket)
          ) : (
            <div className="p-8 rounded-2xl bg-[#131317] border border-zinc-800/80 text-center space-y-2">
              <Ticket className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="text-sm text-zinc-400">
                Masukkan kode tiket booking Anda untuk melihat jadwal, status,
                atau notifikasi pembatalan.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
