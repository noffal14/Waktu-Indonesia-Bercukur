'use client';

import {
  CalendarCheck,
  CalendarDays,
  Clock,
  Home,
  Scissors,
  Ticket,
  UserCheck,
} from 'lucide-react';
import { AppView } from '@/lib/types';

interface TopNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  isCapsterLoggedIn: boolean;
}

const CUSTOMER_NAV_ITEMS: { id: AppView; label: string; mobileLabel: string }[] = [
  { id: 'beranda', label: 'Beranda', mobileLabel: 'Beranda' },
  { id: 'antrean', label: 'Ambil Antrean', mobileLabel: 'Antrean' },
  { id: 'status', label: 'Status Live', mobileLabel: 'Status' },
  { id: 'jadwal', label: 'Jadwal Capster', mobileLabel: 'Jadwal' },
  { id: 'booking', label: 'Booking', mobileLabel: 'Booking' },
];

export function TopNav({
  currentView,
  onNavigate,
  isCapsterLoggedIn,
}: TopNavProps) {
  const renderMobileIcon = (id: AppView, active: boolean) => {
    const cls = `w-5 h-5 ${active ? 'text-amber-400' : 'text-zinc-400'}`;
    switch (id) {
      case 'beranda':
        return <Home className={cls} />;
      case 'antrean':
        return <Ticket className={cls} />;
      case 'status':
        return <Clock className={cls} />;
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
      {/* Desktop & Mobile Top Header (3-zone contract on desktop, compact 48px on mobile) */}
      <header className="sticky top-0 z-30 h-12 md:h-16 bg-[#0B0B0D]/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-6xl mx-auto h-full px-4 md:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title (single text element) */}
          <button
            type="button"
            onClick={() => onNavigate('beranda')}
            className="font-display text-base md:text-lg font-bold tracking-tight text-stone-100 hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
          >
            Waktu Indonesia Bercukur
          </button>

          {/* Zone 2: 5 concise single-line nav links (Desktop) */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {CUSTOMER_NAV_ITEMS.map((item) => {
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

          {/* Zone 3: Single Primary Action (Capster Portal / Dashboard) */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('capster')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[36px] md:min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                currentView === 'capster'
                  ? 'bg-amber-400 text-zinc-950'
                  : 'bg-zinc-900 text-amber-300 border border-amber-500/35 hover:bg-amber-500/15'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>
                {isCapsterLoggedIn ? 'Dashboard Capster' : 'Portal Capster'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Thumb-Zone Navigation Bar (<= 60px high) */}
      <nav
        aria-label="Menu bawah ponsel"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-[#0F0F13]/95 backdrop-blur-md border-t border-zinc-800/90"
      >
        <div className="grid grid-cols-5 h-full max-w-lg mx-auto">
          {CUSTOMER_NAV_ITEMS.map((item) => {
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
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
