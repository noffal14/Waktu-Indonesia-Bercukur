'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useBarberStore } from '@/hooks/use-barber-store';

const LazyCapsterPortalView = dynamic(
  () => import('./CapsterPortalView').then((mod) => mod.CapsterPortalView),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 rounded-2xl bg-zinc-900/70 border border-zinc-800" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-24 rounded-xl bg-zinc-900/70" />
          <div className="h-24 rounded-xl bg-zinc-900/70" />
          <div className="h-24 rounded-xl bg-zinc-900/70" />
          <div className="h-24 rounded-xl bg-zinc-900/70" />
        </div>
      </div>
    ),
  }
);

export function CapsterDashboardShell() {
  const router = useRouter();
  const store = useBarberStore();
  const [loggingOut, setLoggingOut] = useState(false);

  const isAuthorized =
    store.hydrated &&
    store.authReady &&
    store.sessionRole === 'capster' &&
    Boolean(store.loggedInCapster);

  const shouldRejectToHome = store.hydrated && store.authReady && !isAuthorized && !loggingOut;

  useEffect(() => {
    if (shouldRejectToHome) {
      const timer = window.setTimeout(() => {
        router.replace('/login?role=capster');
      }, 900);
      return () => window.clearTimeout(timer);
    }
  }, [shouldRejectToHome, router]);

  if (!store.hydrated || !store.authReady || loggingOut) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4] flex items-center justify-center p-4">
        <div className="w-full max-w-md h-48 rounded-2xl bg-zinc-900/70 border border-zinc-800 animate-pulse" />
      </div>
    );
  }

  if (!isAuthorized || !store.loggedInCapster) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
          <div className="space-y-1.5">
            <h1 className="font-display text-xl font-bold text-rose-200">
              Halaman ini khusus capster
            </h1>
            <p className="text-sm text-zinc-300">
              Anda tidak memiliki akses ke dashboard capster. Mengarahkan
              kembali ke Beranda...
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sm font-medium text-stone-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4]">
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="mb-5 flex justify-end">
          <Link href="/capster/spreadsheet" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 text-xs font-semibold text-amber-300 hover:bg-amber-400/20">
            Keuangan & Pelanggan
          </Link>
        </div>
        <LazyCapsterPortalView
          dbState={store.dbState}
          capsterProfile={store.capsterProfile}
          todayStr={store.todayStr}
          operationalDayKey={store.operationalDayKey}
          nowMs={store.nowMs}
          liveClockText={store.liveClockText}
          shopStatus={store.shopStatus}
          todayQuota={store.todayQuota}
          queueEstimation={store.queueEstimation}
          sessionRole={store.sessionRole}
          loggedInCapster={store.loggedInCapster}
          onRedirectHome={() => router.replace('/')}
          onLogout={async () => {
            setLoggingOut(true);
            await store.logoutCapster();
            router.replace('/login?role=capster');
          }}
          onCallWalkin={store.callWalkin}
          onCompleteWalkin={store.completeWalkin}
          onCancelWalkin={store.cancelWalkin}
          onStartBooking={store.startBookingService}
          onCompleteBooking={store.completeBooking}
          onCancelBookingManual={store.cancelBookingManual}
          onUpdateQuota={store.updateDailyQuota}
          onSetDayOff={store.setCapsterDayOff}
          onSetSlotManual={store.setCapsterSlotManual}
          onCreatePromo={store.createPromo}
          onUpdatePromo={store.updatePromo}
          onTogglePromoActive={store.togglePromoActive}
          onDeletePromo={store.deletePromo}
          onUpdateCapsterProfile={store.updateCapsterProfile}
          onChangeCapsterPassword={store.changeCapsterPassword}
        />
      </main>
    </div>
  );
}
