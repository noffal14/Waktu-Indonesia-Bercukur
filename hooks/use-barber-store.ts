'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  barberService,
  createSeedData,
  formatDateYYYYMMDD,
  formatTimeHHMM,
  getEffectiveNowMs,
} from '@/lib/barber-service';
import {
  BarberDatabaseState,
  Capster,
  DataAntreanWalkin,
  DataBooking,
  QueueEstimationSummary,
  ServiceResult,
} from '@/lib/types';

export function useBarberStore() {
  const [dbState, setDbState] = useState<BarberDatabaseState>(() =>
    createSeedData()
  );
  const [hydrated, setHydrated] = useState(false);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [activeWalkinId, setActiveWalkinId] = useState<string | null>(null);
  const [activeBookingCode, setActiveBookingCode] = useState<string | null>(
    null
  );
  const [loggedInCapsterId, setLoggedInCapsterId] = useState<string | null>(
    null
  );
  const [lastSyncedFormatted, setLastSyncedFormatted] = useState<string>('13:05');

  const isOffline = !browserOnline || simulateOffline;
  const isOfflineRef = useRef(isOffline);
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  const refreshFromStore = useCallback(() => {
    if (isOfflineRef.current) {
      // Saat koneksi terputus, pertahankan snapshot terakhir di layar
      return;
    }
    const next = barberService.syncAndGetState();
    setDbState(next);
    setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(next)));
    setActiveWalkinId(barberService.getCustomerWalkinId());
    setActiveBookingCode(barberService.getCustomerBookingCode());
    setLoggedInCapsterId(barberService.getCapsterSession());
  }, []);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      setBrowserOnline(
        typeof navigator !== 'undefined' ? navigator.onLine : true
      );
      const initial = barberService.syncAndGetState();
      setDbState(initial);
      setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(initial)));
      setActiveWalkinId(barberService.getCustomerWalkinId());
      setActiveBookingCode(barberService.getCustomerBookingCode());
      setLoggedInCapsterId(barberService.getCapsterSession());
      setHydrated(true);
    }, 0);

    const handleOnline = () => {
      setBrowserOnline(true);
      const synced = barberService.syncAndGetState();
      setDbState(synced);
      setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(synced)));
    };
    const handleOffline = () => {
      setBrowserOnline(false);
    };
    const handleStorage = () => {
      if (!isOfflineRef.current) {
        refreshFromStore();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorage);

    const interval = window.setInterval(() => {
      if (!isOfflineRef.current) {
        const synced = barberService.syncAndGetState();
        setDbState(synced);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(synced)));
      }
    }, 2000);

    return () => {
      window.clearTimeout(hydrateTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(interval);
    };
  }, [refreshFromStore]);

  const effectiveNowMs = useMemo(
    () => getEffectiveNowMs(dbState),
    [dbState]
  );

  const todayStr = useMemo(
    () => formatDateYYYYMMDD(new Date(effectiveNowMs)),
    [effectiveNowMs]
  );

  const currentClockHHMM = useMemo(
    () => formatTimeHHMM(effectiveNowMs),
    [effectiveNowMs]
  );

  const todayQuota = useMemo(
    () => barberService.getQuotaForDate(dbState, todayStr),
    [dbState, todayStr]
  );

  const queueEstimation: QueueEstimationSummary = useMemo(
    () => barberService.getQueueEstimation(dbState, todayStr),
    [dbState, todayStr]
  );

  const activeCustomerWalkin: DataAntreanWalkin | null = useMemo(() => {
    if (!activeWalkinId) return null;
    return (
      dbState.walkinQueue.find((w) => w.id === activeWalkinId) || null
    );
  }, [dbState.walkinQueue, activeWalkinId]);

  const activeCustomerBooking: DataBooking | null = useMemo(() => {
    if (!activeBookingCode) return null;
    return (
      dbState.bookings.find((b) => b.kodeTiket === activeBookingCode) || null
    );
  }, [dbState.bookings, activeBookingCode]);

  const loggedInCapster: Capster | null = useMemo(() => {
    if (!loggedInCapsterId) return null;
    return dbState.capsters.find((c) => c.id === loggedInCapsterId) || null;
  }, [dbState.capsters, loggedInCapsterId]);

  // Actions
  const takeWalkinQueue = useCallback(
    (params: { namaPelanggan?: string; capsterId?: string }) => {
      if (isOfflineRef.current) {
        return {
          ok: false,
          errorCode: 'INVALID_STATE' as const,
          message:
            'Koneksi terputus. Tidak dapat mengambil nomor antrean baru saat offline.',
        };
      }
      const res = barberService.takeWalkinQueue(params);
      if (res.ok && res.data) {
        setDbState(res.data.state);
        setActiveWalkinId(res.data.ticket.id);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data.state)));
      }
      return res;
    },
    []
  );

  const createBooking = useCallback(
    (params: {
      capsterId: string;
      tanggal: string;
      jamSlot: string;
      nama: string;
      nomorWhatsApp: string;
    }) => {
      if (isOfflineRef.current) {
        return {
          ok: false,
          errorCode: 'INVALID_STATE' as const,
          message:
            'Koneksi terputus. Sambungkan internet untuk mengunci slot booking.',
        };
      }
      const res = barberService.createBooking(params);
      if (res.ok && res.data) {
        setDbState(res.data.state);
        setActiveBookingCode(res.data.booking.kodeTiket);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data.state)));
      } else {
        refreshFromStore();
      }
      return res;
    },
    [refreshFromStore]
  );

  const callWalkin = useCallback(
    (walkinId: string, capsterId: string): ServiceResult<BarberDatabaseState> => {
      const res = barberService.callWalkin(walkinId, capsterId);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data)));
      }
      return res;
    },
    []
  );

  const completeWalkin = useCallback(
    (
      walkinId: string,
      overrideDurationMinutes?: number
    ): ServiceResult<BarberDatabaseState> => {
      const res = barberService.completeWalkin(walkinId, overrideDurationMinutes);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data)));
      }
      return res;
    },
    []
  );

  const cancelWalkin = useCallback((walkinId: string) => {
    const res = barberService.cancelWalkin(walkinId);
    if (res.ok && res.data) {
      setDbState(res.data);
      setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data)));
    }
    return res;
  }, []);

  const startBookingService = useCallback((bookingId: string) => {
    const res = barberService.startBookingService(bookingId);
    if (res.ok && res.data) {
      setDbState(res.data);
      setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data)));
    }
    return res;
  }, []);

  const completeBooking = useCallback(
    (bookingId: string, overrideDurationMinutes?: number) => {
      const res = barberService.completeBooking(bookingId, overrideDurationMinutes);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data)));
      }
      return res;
    },
    []
  );

  const cancelBookingManual = useCallback((bookingId: string) => {
    const res = barberService.cancelBookingManual(bookingId);
    if (res.ok && res.data) {
      setDbState(res.data);
      setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data)));
    }
    return res;
  }, []);

  const updateDailyQuota = useCallback((tanggal: string, maxQuota: number) => {
    const next = barberService.updateDailyQuota(tanggal, maxQuota);
    setDbState(next);
    setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(next)));
  }, []);

  const updateCapsterSchedule = useCallback(
    (params: {
      capsterId: string;
      tanggal: string;
      buka: string;
      tutup: string;
      isLibur: boolean;
      alasanLibur?: string;
      slotPenuhManual?: string[];
      applyHoursAsDefault?: boolean;
    }) => {
      const next = barberService.updateCapsterSchedule(params);
      setDbState(next);
      setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(next)));
    },
    []
  );

  const toggleManualFullSlot = useCallback(
    (capsterId: string, tanggal: string, jam: string) => {
      const next = barberService.toggleManualFullSlot(capsterId, tanggal, jam);
      setDbState(next);
      setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(next)));
    },
    []
  );

  const advanceSimulatedMinutes = useCallback((minutes: number) => {
    const next = barberService.advanceSimulatedMinutes(minutes);
    setDbState(next);
    setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(next)));
  }, []);

  const toggleUseRealClock = useCallback((useReal: boolean) => {
    const next = barberService.toggleUseRealClock(useReal);
    setDbState(next);
    setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(next)));
  }, []);

  const resetDemoData = useCallback(() => {
    const seed = barberService.resetDemoData();
    setDbState(seed);
    setActiveWalkinId(null);
    setActiveBookingCode(null);
    setSimulateOffline(false);
    setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(seed)));
  }, []);

  const loginCapster = useCallback(
    (username: string, pin: string): ServiceResult<Capster> => {
      const found = dbState.capsters.find(
        (c) =>
          c.username.toLowerCase() === username.trim().toLowerCase() &&
          c.pin === pin.trim()
      );
      if (!found) {
        return {
          ok: false,
          errorCode: 'VALIDATION_ERROR',
          message: 'Username atau PIN tidak cocok. Gunakan PIN demo: 1234.',
        };
      }
      barberService.setCapsterSession(found.id);
      setLoggedInCapsterId(found.id);
      return { ok: true, data: found };
    },
    [dbState.capsters]
  );

  const logoutCapster = useCallback(() => {
    barberService.setCapsterSession(null);
    setLoggedInCapsterId(null);
  }, []);

  const trackBookingCode = useCallback((code: string) => {
    const normalized = code.trim().toUpperCase();
    barberService.setCustomerBookingCode(normalized);
    setActiveBookingCode(normalized);
  }, []);

  const trackWalkinId = useCallback((id: string) => {
    barberService.setCustomerWalkinId(id);
    setActiveWalkinId(id);
  }, []);

  return {
    hydrated,
    dbState,
    effectiveNowMs,
    todayStr,
    currentClockHHMM,
    todayQuota,
    queueEstimation,
    activeCustomerWalkin,
    activeCustomerBooking,
    loggedInCapster,
    isOffline,
    simulateOffline,
    setSimulateOffline,
    lastSyncedFormatted,
    refreshFromStore,
    takeWalkinQueue,
    createBooking,
    callWalkin,
    completeWalkin,
    cancelWalkin,
    startBookingService,
    completeBooking,
    cancelBookingManual,
    updateDailyQuota,
    updateCapsterSchedule,
    toggleManualFullSlot,
    advanceSimulatedMinutes,
    toggleUseRealClock,
    resetDemoData,
    loginCapster,
    logoutCapster,
    trackBookingCode,
    trackWalkinId,
  };
}
