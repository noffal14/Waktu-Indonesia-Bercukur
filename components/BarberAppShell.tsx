'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useBarberStore } from '@/hooks/use-barber-store';
import { AppView } from '@/lib/types';
import { AuthView } from './AuthView';
import { BookingView } from './BookingView';
import { CapsterPortalView } from './CapsterPortalView';
import { DemoControlBar } from './DemoControlBar';
import { HomeView } from './HomeView';
import { MyQueueView } from './MyQueueView';
import { ProfileView } from './ProfileView';
import { ScheduleView } from './ScheduleView';
import { StatusView } from './StatusView';
import { TopNav } from './TopNav';
import { WalkinView } from './WalkinView';

const PROTECTED_CUSTOMER_VIEWS: AppView[] = [
  'antrean',
  'booking',
  'antrean-saya',
  'profil',
];

const REDIRECT_REASON_LABELS: Partial<Record<AppView, string>> = {
  antrean:
    'Silakan masuk atau daftar terlebih dahulu untuk mengambil nomor antrean walk-in.',
  booking:
    'Silakan masuk atau daftar terlebih dahulu untuk membuat atau mengelola booking.',
  'antrean-saya':
    'Silakan masuk atau daftar untuk melihat Antrean & Jadwal Saya.',
  profil: 'Silakan masuk ke akun pelanggan untuk melihat profil Anda.',
};

export function BarberAppShell() {
  const store = useBarberStore();
  const [currentView, setCurrentView] = useState<AppView>('beranda');
  const [pendingRedirectView, setPendingRedirectView] =
    useState<AppView | null>(null);
  const [authRedirectMessage, setAuthRedirectMessage] = useState<string | null>(
    null
  );
  const [scheduleCapsterId, setScheduleCapsterId] = useState<string>('hasan');
  const [preselectedBooking, setPreselectedBooking] = useState<{
    capsterId?: string;
    tanggal?: string;
    jamSlot?: string;
  } | null>(null);
  const [preselectVersion, setPreselectVersion] = useState(0);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigateTo = (view: AppView) => {
    if (PROTECTED_CUSTOMER_VIEWS.includes(view) && !store.currentCustomer) {
      setPendingRedirectView(view);
      setAuthRedirectMessage(
        REDIRECT_REASON_LABELS[view] ||
          'Silakan masuk atau daftar terlebih dahulu.'
      );
      setCurrentView('auth');
      scrollToTop();
      return;
    }

    if (view !== 'auth') {
      setAuthRedirectMessage(null);
    }
    setCurrentView(view);
    scrollToTop();
  };

  const handleAuthSuccess = () => {
    const target = pendingRedirectView || 'antrean-saya';
    setPendingRedirectView(null);
    setAuthRedirectMessage(null);
    setCurrentView(target);
    scrollToTop();
  };

  const handleLogoutCustomer = () => {
    store.logoutCustomer();
    if (PROTECTED_CUSTOMER_VIEWS.includes(currentView)) {
      setCurrentView('beranda');
      scrollToTop();
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
        currentCustomer={store.currentCustomer}
        onLogoutCustomer={handleLogoutCustomer}
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

              {currentView === 'auth' && (
                <AuthView
                  capsters={store.dbState.capsters}
                  redirectMessage={authRedirectMessage}
                  onLogin={store.loginCustomer}
                  onRegister={store.registerCustomer}
                  onDemoLogin={store.loginDemoCustomer}
                  onAuthSuccess={handleAuthSuccess}
                />
              )}

              {currentView === 'antrean' && store.currentCustomer && (
                <WalkinView
                  dbState={store.dbState}
                  todayStr={store.todayStr}
                  todayQuota={store.todayQuota}
                  queueEstimation={store.queueEstimation}
                  currentCustomer={store.currentCustomer}
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
                  currentCustomer={store.currentCustomer}
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

              {currentView === 'booking' && store.currentCustomer && (
                <BookingView
                  key={`${preselectVersion}-${store.currentCustomer.id}`}
                  dbState={store.dbState}
                  todayStr={store.todayStr}
                  currentCustomer={store.currentCustomer}
                  preselectedBooking={preselectedBooking}
                  activeCustomerBooking={store.activeCustomerBooking}
                  isOffline={store.isOffline}
                  onCreateBooking={store.createBooking}
                  onTrackBookingCode={store.trackBookingCode}
                  onNavigate={navigateTo}
                />
              )}

              {currentView === 'antrean-saya' && store.currentCustomer && (
                <MyQueueView
                  dbState={store.dbState}
                  todayStr={store.todayStr}
                  effectiveNowMs={store.effectiveNowMs}
                  queueEstimation={store.queueEstimation}
                  currentCustomer={store.currentCustomer}
                  isOffline={store.isOffline}
                  lastSyncedFormatted={store.lastSyncedFormatted}
                  onRefresh={store.refreshFromStore}
                  onCancelWalkin={store.cancelCustomerWalkin}
                  onRescheduleBooking={store.rescheduleBooking}
                  onCancelBooking={store.cancelCustomerBooking}
                  onNavigate={navigateTo}
                />
              )}

              {currentView === 'profil' && store.currentCustomer && (
                <ProfileView
                  key={store.currentCustomer.id}
                  currentCustomer={store.currentCustomer}
                  capsters={store.dbState.capsters}
                  onUpdateProfile={store.updateCustomerProfile}
                  onDeleteAccount={() => {
                    const res = store.deleteCustomerAccount();
                    if (res.ok) {
                      setCurrentView('beranda');
                      scrollToTop();
                    }
                    return res;
                  }}
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
        currentCustomer={store.currentCustomer}
        onAdvanceMinutes={store.advanceSimulatedMinutes}
        onToggleSimulateOffline={store.setSimulateOffline}
        onLoginDemoCustomer={(custId) => {
          store.loginDemoCustomer(custId);
          setPendingRedirectView(null);
          setAuthRedirectMessage(null);
          setCurrentView('antrean-saya');
          scrollToTop();
        }}
        onResetDemo={store.resetDemoData}
      />
    </div>
  );
}
