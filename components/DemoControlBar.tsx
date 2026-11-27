'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  FastForward,
  RotateCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface DemoControlBarProps {
  currentClockHHMM: string;
  extraOffsetMinutes: number;
  isOffline: boolean;
  simulateOffline: boolean;
  onAdvanceMinutes: (minutes: number) => void;
  onToggleSimulateOffline: (val: boolean) => void;
  onResetDemo: () => void;
}

export function DemoControlBar({
  currentClockHHMM,
  extraOffsetMinutes,
  simulateOffline,
  onAdvanceMinutes,
  onToggleSimulateOffline,
  onResetDemo,
}: DemoControlBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <footer className="mt-12 border-t border-zinc-800/80 pt-6 pb-24 md:pb-10">
      <div className="max-w-6xl mx-auto px-4 md:px-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
          <p>
            © {new Date().getFullYear()} Waktu Indonesia Bercukur · Sistem
            Antrean & Booking Barbershop
          </p>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium self-start sm:self-auto min-h-[38px]"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Kontrol Simulasi Demo ({currentClockHHMM} WIB)
            </span>
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {expanded && (
          <div className="p-4 sm:p-5 rounded-xl bg-[#131317] border border-zinc-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-stone-100">
                  Simulasi Waktu Berjalan & Kondisi Jaringan
                </p>
                <p className="text-xs text-zinc-400">
                  Jam sistem demo saat ini:{' '}
                  <strong className="font-mono tabular-nums text-amber-300">
                    {currentClockHHMM} WIB
                  </strong>{' '}
                  {extraOffsetMinutes > 0
                    ? `(+${extraOffsetMinutes} menit dari awal demo)`
                    : '(awal demo 13:05 WIB)'}
                  . Majukan waktu +15 menit untuk menguji pembatalan otomatis
                  booking slot 13:00.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAdvanceMinutes(15)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-medium flex items-center gap-1.5"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>+15 Menit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAdvanceMinutes(30)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-xs font-medium flex items-center gap-1.5"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>+30 Menit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAdvanceMinutes(60)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5"
                >
                  <span>+1 Jam</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSimulateOffline(!simulateOffline)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 ${
                    simulateOffline
                      ? 'bg-rose-950/60 border-rose-500/45 text-rose-200'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-zinc-200'
                  }`}
                >
                  {simulateOffline ? (
                    <>
                      <Wifi className="w-3.5 h-3.5" />
                      <span>Pulihkan Koneksi</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>Simulasi Offline</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onResetDemo}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Data Demo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
