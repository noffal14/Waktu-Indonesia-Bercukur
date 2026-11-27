'use client';

import { useState } from 'react';
import { CalendarOff, CheckCircle2, Clock, Lock } from 'lucide-react';
import {
  addDaysYYYYMMDD,
  barberService,
  formatDateIndo,
  formatShortDateIndo,
} from '@/lib/barber-service';
import { BarberDatabaseState, ComputedSlotInfo } from '@/lib/types';
import { CapsterAvatar } from './BarbershopMedia';
import { StatusIndicator } from './StatusIndicator';

interface ScheduleViewProps {
  dbState: BarberDatabaseState;
  todayStr: string;
  initialCapsterId?: string;
  onSelectSlotToBook: (params: {
    capsterId: string;
    tanggal: string;
    jamSlot: string;
  }) => void;
}

export function ScheduleView({
  dbState,
  todayStr,
  initialCapsterId,
  onSelectSlotToBook,
}: ScheduleViewProps) {
  const [selectedCapsterId, setSelectedCapsterId] = useState<string>(
    initialCapsterId || dbState.capsters[0]?.id || 'hasan'
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const dateOptions = Array.from({ length: 7 }, (_, i) =>
    addDaysYYYYMMDD(todayStr, i)
  );

  const selectedCapster =
    dbState.capsters.find((c) => c.id === selectedCapsterId) ||
    dbState.capsters[0];

  const { config, slots } = barberService.getComputedSlots(
    dbState,
    selectedCapster.id,
    selectedDate
  );

  const availableCount = slots.filter((s) => s.status === 'Available').length;
  const bookedCount = slots.filter((s) => s.status === 'Booked').length;
  const fullCount = slots.filter((s) => s.status === 'Full').length;

  const getSlotStyle = (slot: ComputedSlotInfo) => {
    if (slot.status === 'Available') {
      return 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/40 text-emerald-300 cursor-pointer';
    }
    if (slot.status === 'Booked') {
      return 'bg-rose-500/10 border-rose-500/35 text-rose-300 cursor-not-allowed';
    }
    return 'bg-red-500/15 border-red-500/40 text-red-300 cursor-not-allowed';
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
          Cek Jadwal Capster
        </h1>
        <p className="text-sm text-zinc-400">
          Pilih capster dan tanggal untuk melihat slot jam kerja yang masih
          kosong. Klik slot hijau (Available) untuk langsung booking.
        </p>
      </div>

      {/* Pilihan Capster */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">1. Pilih Capster</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {dbState.capsters.map((c) => {
            const active = c.id === selectedCapster.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCapsterId(c.id)}
                className={`p-4 rounded-xl border text-left flex items-center gap-3.5 transition-colors min-h-[72px] ${
                  active
                    ? 'bg-amber-500/10 border-amber-400'
                    : 'bg-[#131317] border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <CapsterAvatar
                  fotoKey={c.fotoKey}
                  nama={c.nama}
                  sizeClass="w-12 h-12"
                />
                <div className="min-w-0">
                  <p className="font-display font-semibold text-base text-stone-100">
                    {c.nama}
                  </p>
                  <p className="text-xs text-amber-400 truncate">{c.gelar}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Pilihan Tanggal */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-300">2. Pilih Tanggal</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dateOptions.map((dt, idx) => {
            const active = dt === selectedDate;
            return (
              <button
                key={dt}
                type="button"
                onClick={() => setSelectedDate(dt)}
                className={`min-h-[48px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-amber-400 text-zinc-950 border-amber-400 font-semibold'
                    : 'bg-[#131317] text-zinc-300 border-zinc-800 hover:border-zinc-700'
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
      </section>

      {/* Grid Slot Jam Kerja */}
      <section className="p-5 sm:p-6 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-stone-100">
              Jadwal {selectedCapster.nama} · {formatDateIndo(selectedDate)}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono tabular-nums">
              Jam kerja: {config.jamKerja.buka} – {config.jamKerja.tutup} WIB
              (slot per 1 jam)
            </p>
          </div>

          {!config.isLibur && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <StatusIndicator status="Available" compact />
              <span className="text-zinc-400 font-mono tabular-nums">
                {availableCount}
              </span>
              <StatusIndicator status="Booked" compact />
              <span className="text-zinc-400 font-mono tabular-nums">
                {bookedCount}
              </span>
              <StatusIndicator status="Full" compact />
              <span className="text-zinc-400 font-mono tabular-nums">
                {fullCount}
              </span>
            </div>
          )}
        </div>

        {/* Alternative Flow: Capster Libur / Izin */}
        {config.isLibur ? (
          <div className="p-8 rounded-xl bg-zinc-900/70 border border-rose-500/30 text-center space-y-3">
            <CalendarOff className="w-10 h-10 text-rose-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="font-display text-lg font-semibold text-rose-200">
                Capster tidak beroperasi pada tanggal ini
              </h3>
              <p className="text-sm text-zinc-400">
                {selectedCapster.nama} sedang libur/izin (
                {config.alasanLibur || 'Jadwal tidak aktif'}). Silakan pilih
                capster lain atau tanggal berbeda.
              </p>
            </div>
          </div>
        ) : slots.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">
            Tidak ada slot jam kerja tersedia pada tanggal ini.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {slots.map((slot) => (
              <button
                key={slot.jam}
                type="button"
                disabled={slot.status !== 'Available'}
                onClick={() => {
                  if (slot.status === 'Available') {
                    onSelectSlotToBook({
                      capsterId: selectedCapster.id,
                      tanggal: selectedDate,
                      jamSlot: slot.jam,
                    });
                  }
                }}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-2.5 min-h-[96px] transition-all ${getSlotStyle(
                  slot
                )}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-mono tabular-nums text-lg font-bold">
                    {slot.jam}
                  </span>
                  {slot.status === 'Available' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <Lock className="w-4 h-4 shrink-0" />
                  )}
                </div>

                <div className="space-y-0.5">
                  <p className="text-xs font-semibold">{slot.status}</p>
                  <p className="text-[11px] opacity-80">
                    {slot.status === 'Available'
                      ? 'Klik untuk booking'
                      : slot.status === 'Booked'
                        ? 'Sudah dibooking'
                        : slot.sudahLewat
                          ? 'Slot sudah lewat'
                          : 'Slot penuh'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="pt-2 flex items-center gap-2 text-xs text-zinc-400">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Hijau = Available (bisa dipilih) · Merah = Booked / Full (tidak
            dapat dipilih).
          </span>
        </div>
      </section>
    </div>
  );
}
