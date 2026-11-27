'use client';

import Link from 'next/link';
import {
  CalendarCheck,
  CalendarDays,
  Home,
  ListChecks,
  LogIn,
  LogOut,
  Scissors,
  Ticket,
  User,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { AppView, Customer } from '@/lib/types';

interface TopNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  currentCustomer: Customer | null;
  onLogoutCustomer: () => void;
  syncStatus: 'connecting' | 'connected' | 'reconnecting' | 'offline';
  isOffline: boolean;
  lastSyncedFormatted: string;
}

const DESKTOP_NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'antrean', label: 'Antrean' },
  { id: 'status', label: 'Status' },
  { id: 'jadwal', label: 'Jadwal' },
  { id: 'booking', label: 'Booking' },
  { id: 'antrean-saya', label: 'Antrean Saya' },
];

const MOBILE_BOTTOM_ITEMS: { id: AppView; label: string }[] = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'antrean', label: 'Antrean' },
  { id: 'antrean-saya', label: 'Saya' },
  { id: 'jadwal', label: 'Jadwal' },
  { id: 'booking', label: 'Booking' },
];

export function TopNav({
  currentView,
  onNavigate,
  currentCustomer,
  onLogoutCustomer,
  syncStatus,
  isOffline,
  lastSyncedFormatted,
}: TopNavProps) {
  const renderMobileIcon = (id: AppView, active: boolean) => {
    const cls = `w-5 h-5 ${active ? 'text-amber-400' : 'text-zinc-400'}`;
    switch (id) {
      case 'beranda':
        return <Home className={cls} />;
      case 'antrean':
        return <Ticket className={cls} />;
      case 'antrean-saya':
        return <ListChecks className={cls} />;
      case 'jadwal':
        return <CalendarDays className={cls} />;
      case 'booking':
        return <CalendarCheck className={cls} />;
      default:
        return <Scissors className={cls} />;
    }
  };

  return (
    <>
      {/* Desktop & Mobile Top Header */}
      <header className="sticky top-0 z-30 h-12 md:h-16 bg-[#0B0B0D]/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto h-full px-3 sm:px-4 md:px-6 flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Brand Title */}
          <button
            type="button"
            onClick={() => onNavigate('beranda')}
            className="font-display text-sm sm:text-base md:text-lg font-bold tracking-tight text-stone-100 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 text-left truncate max-w-[185px] sm:max-w-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
          >
            Waktu Indonesia Bercukur
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav
            aria-label="Navigasi utama"
            className="hidden lg:flex items-center gap-5 text-sm font-medium"
          >
            {DESKTOP_NAV_ITEMS.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    active
                      ? 'text-amber-400 border-amber-400'
                      : 'text-zinc-300 border-transparent hover:text-stone-100 hover:border-zinc-700'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Connection state and customer auth */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              title={`Update terakhir ${lastSyncedFormatted} WIB`}
              aria-label={`Koneksi ${isOffline || syncStatus === 'offline' ? 'offline' : syncStatus === 'connected' ? 'realtime terhubung' : syncStatus === 'reconnecting' ? 'menghubungkan ulang' : 'menghubungkan'}; update terakhir ${lastSyncedFormatted} WIB`}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 sm:px-2 py-1 text-[10px] font-medium whitespace-nowrap ${
                isOffline || syncStatus === 'offline'
                  ? 'border-rose-500/30 bg-rose-950/30 text-rose-300'
                  : syncStatus === 'connected'
                    ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-950/20 text-amber-300'
              }`}
            >
              {isOffline || syncStatus === 'offline' ? (
                <WifiOff className="h-3 w-3" />
              ) : syncStatus === 'connected' ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <RefreshCw className="h-3 w-3 animate-spin" />
              )}
              <span className="hidden sm:inline">
                {isOffline || syncStatus === 'offline' ? 'Offline' : syncStatus === 'connected' ? 'Realtime' : syncStatus === 'reconnecting' ? 'Reconnect' : 'Connect'}
              </span>
            </div>
            {currentCustomer ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('profil')}
                  title="Profil Pelanggan"
                  className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] md:min-h-[38px] transition-colors ${
                    currentView === 'profil'
                      ? 'bg-amber-400 text-zinc-950 font-semibold'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-stone-100 border border-zinc-700'
                  }`}
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="max-w-[90px] sm:max-w-[140px] truncate">
                    {currentCustomer.nama.split(' ')[0]}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onLogoutCustomer}
                  title="Keluar dari akun pelanggan"
                  className="inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/50 border border-zinc-700 hover:border-rose-500/40 text-zinc-300 hover:text-rose-200 text-xs font-medium whitespace-nowrap shrink-0 min-h-[34px] md:min-h-[38px] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold whitespace-nowrap shrink-0 min-h-[34px] md:min-h-[38px] bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                <span>Masuk / Daftar</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Thumb-Zone Navigation Bar (<= 60px high) */}
      <nav
        aria-label="Menu bawah ponsel"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-[#0F0F13]/95 backdrop-blur-md border-t border-zinc-800/90"
      >
        <div className="grid grid-cols-5 h-full max-w-lg mx-auto">
          {MOBILE_BOTTOM_ITEMS.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center justify-center min-h-[44px] px-1 transition-colors focus-visible:outline-none focus-visible:bg-zinc-800/60"
              >
                {renderMobileIcon(item.id, active)}
                <span
                  className={`text-[10px] font-medium mt-1 whitespace-nowrap truncate max-w-full ${
                    active ? 'text-amber-400' : 'text-zinc-400'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
