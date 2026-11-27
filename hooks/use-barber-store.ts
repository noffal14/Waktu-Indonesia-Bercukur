'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase-client';
import {
  barberService,
  createInitialSystemState,
  formatTimeWibHHMM,
} from '@/lib/barber-service';
import {
  formatLiveClockBannerWib,
  getShopOperationalStatus,
  getWibParts,
} from '@/lib/barbershop-config';
import {
  CapsterProfile,
  getInitialCapsterProfile,
} from '@/lib/capster-profile';
import {
  BarberDatabaseState,
  Capster,
  Customer,
  DataAntreanWalkin,
  DataBooking,
  Promo,
  QueueEstimationSummary,
  SelectedServiceInput,
  ServiceResult,
  SessionRole,
} from '@/lib/types';

export function useBarberStore() {
  const [dbState, setDbState] = useState<BarberDatabaseState>(() =>
    createInitialSystemState()
  );
  const [hydrated, setHydrated] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [browserOnline, setBrowserOnline] = useState(true);
  const [sessionRole, setSessionRole] = useState<SessionRole>(null);
  const [customerSessionId, setCustomerSessionId] = useState<string | null>(
    null
  );
  const [loggedInCapsterId, setLoggedInCapsterId] = useState<string | null>(
    null
  );
  const [lastSyncedFormatted, setLastSyncedFormatted] = useState<string>(() =>
    formatTimeWibHHMM(Date.now())
  );
  const [capsterSessionMessage, setCapsterSessionMessage] = useState<string | null>(null);

  const isOffline = !browserOnline;
  const isOfflineRef = useRef(isOffline);
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  const syncStateFromStorage = useCallback(() => {
    if (isOfflineRef.current) return;
    const currentNow = Date.now();
    const next = barberService.syncAndGetState();
    setDbState(next);
    setNowMs(currentNow);
    setLastSyncedFormatted(formatTimeWibHHMM(currentNow));
    setSessionRole(barberService.getSessionRole());
    setCustomerSessionId(barberService.getCustomerSessionId());
    setLoggedInCapsterId(barberService.getCapsterSessionId());
  }, []);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      setBrowserOnline(
        typeof navigator !== 'undefined' ? navigator.onLine : true
      );
      syncStateFromStorage();
      setHydrated(true);
    }, 0);

    const handleOnline = () => {
      setBrowserOnline(true);
      const currentNow = Date.now();
      const synced = barberService.syncAndGetState();
      setDbState(synced);
      setNowMs(currentNow);
      setLastSyncedFormatted(formatTimeWibHHMM(currentNow));
    };
    const handleOffline = () => {
      setBrowserOnline(false);
    };
    const handleStorage = () => {
      syncStateFromStorage();
    };
    const handleVisibilityChange = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        !isOfflineRef.current
      ) {
        syncStateFromStorage();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Jam WIB real-time berdetak setiap 1 detik
    const clockInterval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    // Evaluasi antrean/booking & sinkronisasi antar-tab setiap 2 detik
    const syncInterval = window.setInterval(() => {
      if (!isOfflineRef.current) {
        syncStateFromStorage();
      }
    }, 2000);

    return () => {
      window.clearTimeout(hydrateTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(clockInterval);
      window.clearInterval(syncInterval);
    };
  }, [syncStateFromStorage]);

  useEffect(() => {
    if (!hydrated || sessionRole !== 'capster') return;
    let disposed = false;
    let expiring = false;

    const expireSession = async () => {
      if (disposed || expiring) return;
      expiring = true;
      window.sessionStorage.removeItem('wib_capster_session_id');
      if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
      barberService.logoutCapster();
      setLoggedInCapsterId(null);
      setSessionRole(null);
      setCapsterSessionMessage('Sesi berakhir karena akun masuk di perangkat lain');
    };

    const heartbeat = async () => {
      const user = firebaseAuth?.currentUser;
      const sessionId = window.sessionStorage.getItem('wib_capster_session_id');
      if (!user || !sessionId) {
        await expireSession();
        return;
      }
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/capster/heartbeat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'x-capster-session-id': sessionId },
          cache: 'no-store',
        });
        if (response.status === 401) await expireSession();
      } catch {
        // Gangguan jaringan sementara tidak langsung menghapus sesi lokal.
      }
    };

    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 30_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [hydrated, sessionRole]);

  const shopStatus = useMemo(() => getShopOperationalStatus(nowMs), [nowMs]);
  const todayStr = shopStatus.todayStr;
  const operationalDayKey = shopStatus.operationalDayKey;

  const liveClockText = useMemo(
    () => formatLiveClockBannerWib(nowMs),
    [nowMs]
  );

  const currentClockHHMM = useMemo(
    () => getWibParts(nowMs).hhmm,
    [nowMs]
  );

  const todayQuota = useMemo(
    () => barberService.getQuotaForOperationalDay(dbState, operationalDayKey),
    [dbState, operationalDayKey]
  );

  const activePromos: Promo[] = useMemo(
    () => barberService.getActivePromos(dbState, nowMs),
    [dbState, nowMs]
  );

  const queueEstimation: QueueEstimationSummary = useMemo(
    () => barberService.getQueueEstimation(dbState, operationalDayKey),
    [dbState, operationalDayKey]
  );

  const currentCustomer: Customer | null = useMemo(() => {
    if (sessionRole !== 'pelanggan' || !customerSessionId) return null;
    return dbState.customers.find((c) => c.id === customerSessionId) || null;
  }, [sessionRole, dbState.customers, customerSessionId]);

  const loggedInCapster: Capster | null = useMemo(() => {
    if (sessionRole !== 'capster' || !loggedInCapsterId) return null;
    return dbState.capsters.find((c) => c.id === loggedInCapsterId) || null;
  }, [sessionRole, dbState.capsters, loggedInCapsterId]);

  const capsterProfile: CapsterProfile = useMemo(
    () => dbState.capsterProfile || getInitialCapsterProfile(),
    [dbState.capsterProfile]
  );

  const activeCustomerWalkin: DataAntreanWalkin | null = useMemo(() => {
    if (!currentCustomer) return null;
    const custWalkins = dbState.walkinQueue
      .filter(
        (w) =>
          w.customerId === currentCustomer.id &&
          (w.kunciHariOperasional || w.tanggal) === operationalDayKey
      )
      .sort((a, b) => b.waktuAmbil - a.waktuAmbil);
    return (
      custWalkins.find(
        (w) => w.status === 'Waiting' || w.status === 'In-Service'
      ) ||
      custWalkins[0] ||
      null
    );
  }, [dbState.walkinQueue, currentCustomer, operationalDayKey]);

  const activeCustomerBooking: DataBooking | null = useMemo(() => {
    if (!currentCustomer) return null;
    const custBookings = dbState.bookings
      .filter((b) => b.customerId === currentCustomer.id)
      .sort((a, b) => b.waktuDibuat - a.waktuDibuat);
    return (
      custBookings.find(
        (b) => b.status === 'Booked' || b.status === 'In-Service'
      ) ||
      custBookings[0] ||
      null
    );
  }, [dbState.bookings, currentCustomer]);

  // =========================================================================
  // CUSTOMER AUTH ACTIONS
  // =========================================================================

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
        setSessionRole('pelanggan');
        setCustomerSessionId(res.data.customer.id);
        setLoggedInCapsterId(null);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
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
        setSessionRole('pelanggan');
        setCustomerSessionId(res.data.customer.id);
        setLoggedInCapsterId(null);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const logoutCustomer = useCallback(() => {
    barberService.logoutCustomer();
    setCustomerSessionId(null);
    setSessionRole((prev) => (prev === 'pelanggan' ? null : prev));
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
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
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
      setSessionRole(null);
      setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
    }
    return res;
  }, [customerSessionId]);

  // =========================================================================
  // CUSTOMER QUEUE & BOOKING ACTIONS
  // =========================================================================

  const takeWalkinQueue = useCallback(
    (params: { customerId?: string; capsterId?: string }) => {
      if (isOfflineRef.current) {
        return {
          ok: false,
          errorCode: 'INVALID_STATE' as const,
          message:
            'Koneksi terputus. Tidak dapat mengambil nomor antrean baru saat offline.',
        };
      }
      const res = barberService.takeWalkinQueue({
        customerId: params.customerId || customerSessionId || undefined,
        capsterId: params.capsterId,
      });
      if (res.ok && res.data) {
        setDbState(res.data.state);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      } else {
        syncStateFromStorage();
      }
      return res;
    },
    [customerSessionId, syncStateFromStorage]
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
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
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
      selectedServices?: SelectedServiceInput[];
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
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      } else {
        syncStateFromStorage();
      }
      return res;
    },
    [customerSessionId, syncStateFromStorage]
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
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      } else {
        syncStateFromStorage();
      }
      return res;
    },
    [customerSessionId, syncStateFromStorage]
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
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    [customerSessionId]
  );

  // =========================================================================
  // CAPSTER AUTH & DASHBOARD ACTIONS (ROLE-PROTECTED)
  // =========================================================================

  const loginCapster = useCallback(
    async (username: string, password: string): Promise<ServiceResult<Capster>> => {
      const cleanUsername = username.trim().toLowerCase();
      if (cleanUsername !== 'hasan' || !password) {
        return { ok: false, errorCode: 'UNAUTHORIZED', message: 'Username atau password salah.' };
      }
      if (!firebaseAuth) {
        return { ok: false, errorCode: 'INVALID_STATE', message: 'Firebase Authentication belum dikonfigurasi.' };
      }

      try {
        const credential = await signInWithEmailAndPassword(
          firebaseAuth,
          'hasan@waktu-indonesia.app',
          password
        );
        const token = await credential.user.getIdToken(true);
        const storedSessionId = window.sessionStorage.getItem('wib_capster_session_id');
        const response = await fetch('/api/capster/session', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            ...(storedSessionId ? { 'x-capster-session-id': storedSessionId } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ deviceInfo: `${navigator.platform} | ${navigator.userAgent.slice(0, 100)}` }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.sessionId) {
          await signOut(firebaseAuth);
          return {
            ok: false,
            errorCode: response.status === 409 ? 'UNAUTHORIZED' : 'INVALID_STATE',
            message: payload.message || 'Gagal membuat sesi capster.',
          };
        }

        window.sessionStorage.setItem('wib_capster_session_id', payload.sessionId);
        const localSession = barberService.activateCapsterSession('hasan');
        if (!localSession.ok || !localSession.data) {
          await fetch('/api/capster/session', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              'x-capster-session-id': payload.sessionId,
            },
          }).catch(() => undefined);
          await signOut(firebaseAuth);
          return localSession;
        }

        setCapsterSessionMessage(null);
        setSessionRole('capster');
        setLoggedInCapsterId(localSession.data.id);
        setCustomerSessionId(null);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
        return localSession;
      } catch (error) {
        const code = (error as { code?: string }).code;
        const message = code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
          ? 'Username atau password salah.'
          : 'Tidak dapat masuk. Periksa koneksi dan konfigurasi Firebase.';
        return { ok: false, errorCode: 'UNAUTHORIZED', message };
      }
    },
    []
  );

  const logoutCapster = useCallback(async () => {
    const sessionId = window.sessionStorage.getItem('wib_capster_session_id');
    const user = firebaseAuth?.currentUser;
    try {
      if (user && sessionId) {
        const token = await user.getIdToken();
        await fetch('/api/capster/session', {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'x-capster-session-id': sessionId },
        });
      }
    } finally {
      window.sessionStorage.removeItem('wib_capster_session_id');
      if (firebaseAuth) await signOut(firebaseAuth);
      barberService.logoutCapster();
      setLoggedInCapsterId(null);
      setSessionRole((prev) => (prev === 'capster' ? null : prev));
    }
  }, []);

  const callWalkin = useCallback(
    (walkinId: string, capsterId?: string): ServiceResult<BarberDatabaseState> => {
      const res = barberService.callWalkin(walkinId, capsterId);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
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
      const res = barberService.completeWalkin(
        walkinId,
        overrideDurationMinutes
      );
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const cancelWalkin = useCallback(
    (walkinId: string): ServiceResult<BarberDatabaseState> => {
      const res = barberService.cancelWalkin(walkinId);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const startBookingService = useCallback(
    (bookingId: string): ServiceResult<BarberDatabaseState> => {
      const res = barberService.startBookingService(bookingId);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const completeBooking = useCallback(
    (
      bookingId: string,
      overrideDurationMinutes?: number
    ): ServiceResult<BarberDatabaseState> => {
      const res = barberService.completeBooking(
        bookingId,
        overrideDurationMinutes
      );
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const cancelBookingManual = useCallback(
    (bookingId: string): ServiceResult<BarberDatabaseState> => {
      const res = barberService.cancelBookingManual(bookingId);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const updateDailyQuota = useCallback(
    (
      targetOperationalDayKey: string,
      maxQuota: number
    ): ServiceResult<BarberDatabaseState> => {
      const res = barberService.updateDailyQuota(
        targetOperationalDayKey,
        maxQuota
      );
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const setCapsterDayOff = useCallback(
    (params: {
      capsterId: string;
      tanggal: string;
      isLibur: boolean;
      alasanLibur?: string;
      forceCancelConflicts?: boolean;
    }): ServiceResult<BarberDatabaseState> => {
      const res = barberService.setCapsterDayOff(params);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const setCapsterSlotManual = useCallback(
    (params: {
      capsterId: string;
      tanggal: string;
      jam: string;
      mode: 'tersedia' | 'tidak_tersedia' | 'terisi_manual';
      catatan?: string;
      forceCancelConflict?: boolean;
    }): ServiceResult<BarberDatabaseState> => {
      const res = barberService.setCapsterSlotManual(params);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const createPromo = useCallback(
    (params: {
      judul: string;
      deskripsi: string;
      layananId: string[];
      diskonMin: number;
      diskonMax: number;
      aktif: boolean;
      berlakuDari?: string;
      berlakuSampai?: string;
    }): ServiceResult<BarberDatabaseState> => {
      const res = barberService.createPromo(params);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const updatePromo = useCallback(
    (
      promoId: string,
      params: {
        judul: string;
        deskripsi: string;
        layananId: string[];
        diskonMin: number;
        diskonMax: number;
        aktif: boolean;
        berlakuDari?: string;
        berlakuSampai?: string;
      }
    ): ServiceResult<BarberDatabaseState> => {
      const res = barberService.updatePromo(promoId, params);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const togglePromoActive = useCallback(
    (promoId: string): ServiceResult<BarberDatabaseState> => {
      const res = barberService.togglePromoActive(promoId);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const deletePromo = useCallback(
    (promoId: string): ServiceResult<BarberDatabaseState> => {
      const res = barberService.deletePromo(promoId);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const updateCapsterProfile = useCallback(
    (params: {
      pengalaman: string;
      nomorWhatsApp: string;
      instagramCapster: string;
      instagramBarbershop: string;
    }): ServiceResult<BarberDatabaseState> => {
      const res = barberService.updateCapsterProfile(params);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  const changeCapsterPassword = useCallback(
    (params: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }): ServiceResult<BarberDatabaseState> => {
      const res = barberService.changeCapsterPassword(params);
      if (res.ok && res.data) {
        setDbState(res.data);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      }
      return res;
    },
    []
  );

  return {
    hydrated,
    dbState,
    nowMs,
    todayStr,
    operationalDayKey,
    shopStatus,
    liveClockText,
    currentClockHHMM,
    todayQuota,
    activePromos,
    queueEstimation,
    sessionRole,
    currentCustomer,
    loggedInCapster,
    capsterProfile,
    activeCustomerWalkin,
    activeCustomerBooking,
    isOffline,
    lastSyncedFormatted,
    capsterSessionMessage,
    refreshFromStore: syncStateFromStorage,
    registerCustomer,
    loginCustomer,
    logoutCustomer,
    updateCustomerProfile,
    deleteCustomerAccount,
    takeWalkinQueue,
    cancelCustomerWalkin,
    createBooking,
    rescheduleBooking,
    cancelCustomerBooking,
    loginCapster,
    logoutCapster,
    callWalkin,
    completeWalkin,
    cancelWalkin,
    startBookingService,
    completeBooking,
    cancelBookingManual,
    updateDailyQuota,
    setCapsterDayOff,
    setCapsterSlotManual,
    createPromo,
    updatePromo,
    togglePromoActive,
    deletePromo,
    updateCapsterProfile,
    changeCapsterPassword,
  };
}
