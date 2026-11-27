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
  Customer,
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
  const [customerSessionId, setCustomerSessionId] = useState<string | null>(
    null
  );
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
      return;
    }
    const next = barberService.syncAndGetState();
    setDbState(next);
    setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(next)));
    setCustomerSessionId(barberService.getCustomerSessionId());
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
      setCustomerSessionId(barberService.getCustomerSessionId());
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

  const currentCustomer: Customer | null = useMemo(() => {
    if (!customerSessionId) return null;
    return dbState.customers.find((c) => c.id === customerSessionId) || null;
  }, [dbState.customers, customerSessionId]);

  const activeCustomerWalkin: DataAntreanWalkin | null = useMemo(() => {
    if (currentCustomer) {
      const custWalkins = dbState.walkinQueue
        .filter(
          (w) => w.customerId === currentCustomer.id && w.tanggal === todayStr
        )
        .sort((a, b) => b.waktuAmbil - a.waktuAmbil);
      const active = custWalkins.find(
        (w) => w.status === 'Waiting' || w.status === 'In-Service'
      );
      if (active) return active;
      if (custWalkins[0]) return custWalkins[0];
    }
    if (!activeWalkinId) return null;
    return (
      dbState.walkinQueue.find((w) => w.id === activeWalkinId) || null
    );
  }, [dbState.walkinQueue, activeWalkinId, currentCustomer, todayStr]);

  const activeCustomerBooking: DataBooking | null = useMemo(() => {
    if (currentCustomer) {
      const custBookings = dbState.bookings
        .filter((b) => b.customerId === currentCustomer.id)
        .sort((a, b) => b.waktuDibuat - a.waktuDibuat);
      const active = custBookings.find(
        (b) => b.status === 'Booked' || b.status === 'In-Service'
      );
      if (active) return active;
      if (custBookings[0]) return custBookings[0];
    }
    if (!activeBookingCode) return null;
    return (
      dbState.bookings.find((b) => b.kodeTiket === activeBookingCode) || null
    );
  }, [dbState.bookings, activeBookingCode, currentCustomer]);

  const loggedInCapster: Capster | null = useMemo(() => {
    if (!loggedInCapsterId) return null;
    return dbState.capsters.find((c) => c.id === loggedInCapsterId) || null;
  }, [dbState.capsters, loggedInCapsterId]);

  // Customer Auth Actions
  const registerCustomer = useCallback(
    (params: {
      nama: string;
      nomorWhatsApp: string;
      email?: string;
      password: string;
      capsterFavoritId?: string;
    }) => {
      const res = barberService.registerCustomer(params);
      if (res.ok && res.data) {
        setDbState(res.data.state);
        setCustomerSessionId(res.data.customer.id);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data.state)));
      }
      return res;
    },
    []
  );

  const loginCustomer = useCallback(
    (nomorWhatsApp: string, password: string) => {
      const res = barberService.loginCustomer(nomorWhatsApp, password);
      if (res.ok && res.data) {
        setDbState(res.data.state);
        setCustomerSessionId(res.data.customer.id);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data.state)));
      }
      return res;
    },
    []
  );

  const loginDemoCustomer = useCallback((customerId: string) => {
    const res = barberService.loginDemoCustomerById(customerId);
    if (res.ok && res.data) {
      setDbState(res.data.state);
      setCustomerSessionId(res.data.customer.id);
      setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data.state)));
    }
    return res;
  }, []);

  const logoutCustomer = useCallback(() => {
    barberService.logoutCustomer();
    setCustomerSessionId(null);
  }, []);

  const updateCustomerProfile = useCallback(
    (params: {
      nama: string;
      email?: string;
      capsterFavoritId?: string;
      currentPassword?: string;
      newPassword?: string;
    }) => {
      if (!customerSessionId) {
        return {
          ok: false,
          errorCode: 'AUTH_REQUIRED' as const,
          message: 'Sesi pelanggan tidak aktif.',
        };
      }
      const res = barberService.updateCustomerProfile(
        customerSessionId,
        params
      );
      if (res.ok && res.data) {
        setDbState(res.data.state);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data.state)));
      }
      return res;
    },
    [customerSessionId]
  );

  const deleteCustomerAccount = useCallback(() => {
    if (!customerSessionId) {
      return {
        ok: false,
        errorCode: 'AUTH_REQUIRED' as const,
        message: 'Sesi pelanggan tidak aktif.',
      };
    }
    const res = barberService.deleteCustomerAccount(customerSessionId);
    if (res.ok && res.data) {
      setDbState(res.data);
      setCustomerSessionId(null);
      setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data)));
    }
    return res;
  }, [customerSessionId]);

  // Queue & Booking Actions
  const takeWalkinQueue = useCallback(
    (params: {
      customerId?: string;
      namaPelanggan?: string;
      nomorWhatsApp?: string;
      capsterId?: string;
    }) => {
      if (isOfflineRef.current) {
        return {
          ok: false,
          errorCode: 'INVALID_STATE' as const,
          message:
            'Koneksi terputus. Tidak dapat mengambil nomor antrean baru saat offline.',
        };
      }
      const res = barberService.takeWalkinQueue({
        ...params,
        customerId: params.customerId || customerSessionId || undefined,
      });
      if (res.ok && res.data) {
        setDbState(res.data.state);
        setActiveWalkinId(res.data.ticket.id);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data.state)));
      }
      return res;
    },
    [customerSessionId]
  );

  const cancelCustomerWalkin = useCallback(
    (walkinId: string) => {
      if (!customerSessionId) {
        return {
          ok: false,
          errorCode: 'AUTH_REQUIRED' as const,
          message: 'Silakan masuk ke akun terlebih dahulu.',
        };
      }
      const res = barberService.cancelCustomerWalkin(
        walkinId,
        customerSessionId
      );
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data)));
      }
      return res;
    },
    [customerSessionId]
  );

  const createBooking = useCallback(
    (params: {
      customerId?: string;
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
      const res = barberService.createBooking({
        ...params,
        customerId: params.customerId || customerSessionId || undefined,
      });
      if (res.ok && res.data) {
        setDbState(res.data.state);
        setActiveBookingCode(res.data.booking.kodeTiket);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data.state)));
      } else {
        refreshFromStore();
      }
      return res;
    },
    [refreshFromStore, customerSessionId]
  );

  const rescheduleBooking = useCallback(
    (params: {
      bookingId: string;
      newCapsterId: string;
      newTanggal: string;
      newJamSlot: string;
    }) => {
      if (isOfflineRef.current) {
        return {
          ok: false,
          errorCode: 'INVALID_STATE' as const,
          message: 'Koneksi terputus. Sambungkan internet untuk mengubah jadwal.',
        };
      }
      if (!customerSessionId) {
        return {
          ok: false,
          errorCode: 'AUTH_REQUIRED' as const,
          message: 'Silakan masuk ke akun terlebih dahulu.',
        };
      }
      const res = barberService.rescheduleBooking({
        ...params,
        customerId: customerSessionId,
      });
      if (res.ok && res.data) {
        setDbState(res.data.state);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data.state)));
      } else {
        refreshFromStore();
      }
      return res;
    },
    [customerSessionId, refreshFromStore]
  );

  const cancelCustomerBooking = useCallback(
    (bookingId: string) => {
      if (!customerSessionId) {
        return {
          ok: false,
          errorCode: 'AUTH_REQUIRED' as const,
          message: 'Silakan masuk ke akun terlebih dahulu.',
        };
      }
      const res = barberService.cancelCustomerBooking(
        bookingId,
        customerSessionId
      );
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeHHMM(getEffectiveNowMs(res.data)));
      }
      return res;
    },
    [customerSessionId]
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
    setCustomerSessionId(null);
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
    currentCustomer,
    activeCustomerWalkin,
    activeCustomerBooking,
    loggedInCapster,
    isOffline,
    simulateOffline,
    setSimulateOffline,
    lastSyncedFormatted,
    refreshFromStore,
    registerCustomer,
    loginCustomer,
    loginDemoCustomer,
    logoutCustomer,
    updateCustomerProfile,
    deleteCustomerAccount,
    takeWalkinQueue,
    cancelCustomerWalkin,
    createBooking,
    rescheduleBooking,
    cancelCustomerBooking,
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
