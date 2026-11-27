'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useBarberStore } from '@/hooks/use-barber-store';
import { AppView } from '@/lib/types';
import { BookingView } from './BookingView';
import { CapsterPortalView } from './CapsterPortalView';
import { DemoControlBar } from './DemoControlBar';
import { HomeView } from './HomeView';
import { ScheduleView } from './ScheduleView';
import { StatusView } from './StatusView';
import { TopNav } from './TopNav';
import { WalkinView } from './WalkinView';

export function BarberAppShell() {
  const store = useBarberStore();
  const [currentView, setCurrentView] = useState<AppView>('beranda');
  const [scheduleCapsterId, setScheduleCapsterId] = useState<string>('hasan');
  const [preselectedBooking, setPreselectedBooking] = useState<{
    capsterId?: string;
    tanggal?: string;
    jamSlot?: string;
  } | null>(null);
  const [preselectVersion, setPreselectVersion] = useState(0);

  const navigateTo = (view: AppView) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectCapsterForSchedule = (capsterId: string) => {
    setScheduleCapsterId(capsterId);
    navigateTo('jadwal');
  };

  const handleSelectSlotToBook = (params: {
    capsterId: string;
    tanggal: string;
    jamSlot: string;
  }) => {
    setPreselectedBooking(params);
    setPreselectVersion((v) => v + 1);
    navigateTo('booking');
  };

  const handleBookTomorrow = (tomorrowStr: string) => {
    setPreselectedBooking({
      capsterId: store.dbState.capsters[0]?.id || 'hasan',
      tanggal: tomorrowStr,
      jamSlot: '',
    });
    setPreselectVersion((v) => v + 1);
    navigateTo('booking');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0B0D] text-[#F5F5F4]">
      <TopNav
        currentView={currentView}
        onNavigate={navigateTo}
        isCapsterLoggedIn={Boolean(store.loggedInCapster)}
      />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
        {!store.hydrated ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-64 rounded-2xl bg-zinc-900/70 border border-zinc-800" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 rounded-xl bg-zinc-900/70" />
              <div className="h-24 rounded-xl bg-zinc-900/70" />
              <div className="h-24 rounded-xl bg-zinc-900/70" />
              <div className="h-24 rounded-xl bg-zinc-900/70" />
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {currentView === 'beranda' && (
                <HomeView
                  dbState={store.dbState}
                  todayStr={store.todayStr}
                  currentClockHHMM={store.currentClockHHMM}
                  todayQuota={store.todayQuota}
                  queueEstimation={store.queueEstimation}
                  activeCustomerWalkin={store.activeCustomerWalkin}
                  activeCustomerBooking={store.activeCustomerBooking}
                  onNavigate={navigateTo}
                  onSelectCapsterForSchedule={handleSelectCapsterForSchedule}
                />
              )}

              {currentView === 'antrean' && (
                <WalkinView
                  dbState={store.dbState}
                  todayStr={store.todayStr}
                  todayQuota={store.todayQuota}
                  queueEstimation={store.queueEstimation}
                  activeCustomerWalkin={store.activeCustomerWalkin}
                  isOffline={store.isOffline}
                  onTakeWalkin={store.takeWalkinQueue}
                  onNavigate={navigateTo}
                  onBookTomorrow={handleBookTomorrow}
                />
              )}

              {currentView === 'status' && (
                <StatusView
                  dbState={store.dbState}
                  todayStr={store.todayStr}
                  queueEstimation={store.queueEstimation}
                  activeCustomerWalkin={store.activeCustomerWalkin}
                  activeCustomerBooking={store.activeCustomerBooking}
                  isOffline={store.isOffline}
                  lastSyncedFormatted={store.lastSyncedFormatted}
                  onRefresh={store.refreshFromStore}
                  onTrackWalkinId={store.trackWalkinId}
                  onNavigate={navigateTo}
                />
              )}

              {currentView === 'jadwal' && (
                <ScheduleView
                  dbState={store.dbState}
                  todayStr={store.todayStr}
                  initialCapsterId={scheduleCapsterId}
                  onSelectSlotToBook={handleSelectSlotToBook}
                />
              )}

              {currentView === 'booking' && (
                <BookingView
                  key={preselectVersion}
                  dbState={store.dbState}
                  todayStr={store.todayStr}
                  preselectedBooking={preselectedBooking}
                  activeCustomerBooking={store.activeCustomerBooking}
                  isOffline={store.isOffline}
                  onCreateBooking={store.createBooking}
                  onTrackBookingCode={store.trackBookingCode}
                  onNavigate={navigateTo}
                />
              )}

              {currentView === 'capster' && (
                <CapsterPortalView
                  dbState={store.dbState}
                  todayStr={store.todayStr}
                  effectiveNowMs={store.effectiveNowMs}
                  currentClockHHMM={store.currentClockHHMM}
                  todayQuota={store.todayQuota}
                  queueEstimation={store.queueEstimation}
                  loggedInCapster={store.loggedInCapster}
                  onLogin={store.loginCapster}
                  onLogout={store.logoutCapster}
                  onCallWalkin={store.callWalkin}
                  onCompleteWalkin={store.completeWalkin}
                  onCancelWalkin={store.cancelWalkin}
                  onStartBooking={store.startBookingService}
                  onCompleteBooking={store.completeBooking}
                  onCancelBookingManual={store.cancelBookingManual}
                  onUpdateQuota={store.updateDailyQuota}
                  onUpdateSchedule={store.updateCapsterSchedule}
                  onToggleManualFullSlot={store.toggleManualFullSlot}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <DemoControlBar
        currentClockHHMM={store.currentClockHHMM}
        extraOffsetMinutes={store.dbState.extraOffsetMinutes}
        isOffline={store.isOffline}
        simulateOffline={store.simulateOffline}
        onAdvanceMinutes={store.advanceSimulatedMinutes}
        onToggleSimulateOffline={store.setSimulateOffline}
        onResetDemo={store.resetDemoData}
      />
    </div>
  );
}
