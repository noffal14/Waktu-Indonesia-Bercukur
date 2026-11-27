'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useBarberStore } from '@/hooks/use-barber-store';
import { AppView } from '@/lib/types';
import { BookingView } from './BookingView';
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

const PUBLIC_CUSTOMER_VIEWS: AppView[] = [
  'beranda',
  'antrean',
  'status',
  'jadwal',
  'booking',
  'antrean-saya',
  'profil',
];

export function BarberAppShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useBarberStore();

  const viewParam = searchParams.get('view') as AppView | null;
  const initialView: AppView =
    viewParam && PUBLIC_CUSTOMER_VIEWS.includes(viewParam)
      ? viewParam
      : 'beranda';

  const [currentView, setCurrentView] = useState<AppView>(initialView);
  const [prevViewParam, setPrevViewParam] = useState<AppView | null>(viewParam);
  const [scheduleCapsterId, setScheduleCapsterId] = useState<string>('hasan');
  const [preselectedBooking, setPreselectedBooking] = useState<{
    capsterId?: string;
    tanggal?: string;
    jamSlot?: string;
  } | null>(null);
  const [preselectVersion, setPreselectVersion] = useState(0);

  if (viewParam !== prevViewParam) {
    setPrevViewParam(viewParam);
    if (viewParam && PUBLIC_CUSTOMER_VIEWS.includes(viewParam)) {
      setCurrentView(viewParam);
    }
  }

  useEffect(() => {
    if (!store.hydrated) return;
    if (
      PROTECTED_CUSTOMER_VIEWS.includes(currentView) &&
      !store.currentCustomer
    ) {
      router.replace(`/login?redirect=${currentView}`);
    }
  }, [store.hydrated, store.currentCustomer, currentView, router]);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const navigateTo = (view: AppView) => {
    if (view === 'auth') {
      router.push('/login');
      return;
    }

    if (PROTECTED_CUSTOMER_VIEWS.includes(view) && !store.currentCustomer) {
      router.push(`/login?redirect=${view}`);
      return;
    }

    setCurrentView(view);
    if (viewParam) {
      router.replace(view === 'beranda' ? '/' : `/?view=${view}`);
    }
    scrollToTop();
  };

  const handleLogoutCustomer = () => {
    store.logoutCustomer();
    if (PROTECTED_CUSTOMER_VIEWS.includes(currentView)) {
      setCurrentView('beranda');
      if (viewParam) {
        router.replace('/');
      }
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
        currentCustomer={store.currentCustomer}
        onLogoutCustomer={handleLogoutCustomer}
      />

      <main className="flex-1 w-full pb-24 lg:pb-12">
        {!store.hydrated ? (
          <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-8 space-y-6 animate-pulse">
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
              {currentView === 'beranda' ? (
                <HomeView
                  dbState={store.dbState}
                  capsterProfile={store.capsterProfile}
                  todayStr={store.todayStr}
                  liveClockText={store.liveClockText}
                  shopStatus={store.shopStatus}
                  todayQuota={store.todayQuota}
                  activePromos={store.activePromos}
                  queueEstimation={store.queueEstimation}
                  activeCustomerWalkin={store.activeCustomerWalkin}
                  activeCustomerBooking={store.activeCustomerBooking}
                  onNavigate={navigateTo}
                  onSelectCapsterForSchedule={handleSelectCapsterForSchedule}
                />
              ) : (
                <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
                  {currentView === 'antrean' && store.currentCustomer && (
                    <WalkinView
                      dbState={store.dbState}
                      todayStr={store.todayStr}
                      operationalDayKey={store.operationalDayKey}
                      shopStatus={store.shopStatus}
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
                      operationalDayKey={store.operationalDayKey}
                      queueEstimation={store.queueEstimation}
                      currentCustomer={store.currentCustomer}
                      activeCustomerWalkin={store.activeCustomerWalkin}
                      activeCustomerBooking={store.activeCustomerBooking}
                      isOffline={store.isOffline}
                      lastSyncedFormatted={store.lastSyncedFormatted}
                      onRefresh={store.refreshFromStore}
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
                      capsterProfile={store.capsterProfile}
                      todayStr={store.todayStr}
                      currentCustomer={store.currentCustomer}
                      activePromos={store.activePromos}
                      preselectedBooking={preselectedBooking}
                      activeCustomerBooking={store.activeCustomerBooking}
                      isOffline={store.isOffline}
                      onCreateBooking={store.createBooking}
                      onNavigate={navigateTo}
                    />
                  )}

                  {currentView === 'antrean-saya' && store.currentCustomer && (
                    <MyQueueView
                      dbState={store.dbState}
                      todayStr={store.todayStr}
                      operationalDayKey={store.operationalDayKey}
                      nowMs={store.nowMs}
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
                          if (viewParam) {
                            router.replace('/');
                          }
                          scrollToTop();
                        }
                        return res;
                      }}
                    />
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}
