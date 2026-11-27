'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { firebaseAuth, firestore } from '@/lib/firebase-client';
import { callCustomerAuthApi, callStoreApi } from '@/lib/store-api';
import {
  barberService,
  createInitialSystemState,
  formatTimeWibHHMM,
  normalizeWhatsAppTo628,
  validateIndonesianWhatsApp,
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
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'offline'>('connecting');

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
    let interval: number | undefined;

    const clearLocalSession = (message?: string) => {
      window.sessionStorage.removeItem('wib_capster_session_id');
      barberService.logoutCapster();
      setLoggedInCapsterId(null);
      setSessionRole(null);
      if (message) setCapsterSessionMessage(message);
    };

    const expireSession = async () => {
      if (disposed || expiring) return;
      expiring = true;
      clearLocalSession('Sesi berakhir karena akun masuk di perangkat lain');
      if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
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

    if (!firebaseAuth) {
      void expireSession();
      return () => { disposed = true; };
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (!user) {
        if (window.sessionStorage.getItem('wib_capster_session_id')) {
          void expireSession();
        } else {
          clearLocalSession();
        }
        return;
      }
      void heartbeat();
      if (interval === undefined) {
        interval = window.setInterval(() => void heartbeat(), 30_000);
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [hydrated, sessionRole]);

  useEffect(() => {
    if (!hydrated || !firebaseAuth) return;
    let active = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!active) return;
      if (!user) {
        if (window.sessionStorage.getItem('wib_capster_session_id')) {
          setCustomerSessionId(null);
        } else {
          setCustomerSessionId(null);
          setSessionRole(null);
          if (barberService.getSessionRole() === 'pelanggan') barberService.logoutCustomer();
        }
        return;
      }
      try {
        const token = await user.getIdTokenResult();
        if (!active) return;
        if (token.claims.role === 'capster') {
          const local = barberService.activateCapsterSession('hasan');
          if (local.ok) {
            setLoggedInCapsterId('hasan');
            setCustomerSessionId(null);
            setSessionRole('capster');
          }
          return;
        }
        if (user.email?.endsWith('@pelanggan.waktu-indonesia.app')) {
          const result = await callCustomerAuthApi<Customer>('GET');
          if (!active) return;
          if (result.ok && result.data) {
            const customer = { ...result.data, id: user.uid, passwordHash: '' };
            setDbState((previous) => ({
              ...previous,
              customers: [customer],
            }));
            setCustomerSessionId(user.uid);
            setLoggedInCapsterId(null);
            setSessionRole('pelanggan');
          } else {
            setCustomerSessionId(null);
            setSessionRole(null);
          }
        }
      } catch {
        if (active) setSyncStatus('reconnecting');
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !firestore || !firebaseAuth?.currentUser || !sessionRole) return;
    const user = firebaseAuth.currentUser;
    const uid = user.uid;
    let disposed = false;
    const unsubscribers: Array<() => void> = [];
    const cache: {
      queuePublic: Array<Record<string, unknown>>;
      queuePrivate: Array<Record<string, unknown>>;
      bookingPublic: Array<Record<string, unknown>>;
      bookingPrivate: Array<Record<string, unknown>>;
      schedules: Array<Record<string, unknown> & { _id: string }>;
      promos: Promo[];
      customer: Customer | null;
      profile: CapsterProfile | null;
      quota: Record<string, unknown> | null;
    } = {
      queuePublic: [], queuePrivate: [], bookingPublic: [], bookingPrivate: [],
      schedules: [], promos: [], customer: null, profile: null, quota: null,
    };

    const apply = () => {
      if (disposed) return;
      const mergeById = (publicRows: Array<Record<string, unknown>>, privateRows: Array<Record<string, unknown>>) => {
        const merged = new Map<string, Record<string, unknown>>();
        publicRows.forEach((row) => merged.set(String(row.id), row));
        privateRows.forEach((row) => merged.set(String(row.id), { ...(merged.get(String(row.id)) || {}), ...row }));
        return Array.from(merged.values());
      };
      const queues = mergeById(cache.queuePublic, cache.queuePrivate) as unknown as DataAntreanWalkin[];
      const bookings = mergeById(cache.bookingPublic, cache.bookingPrivate) as unknown as DataBooking[];
      const schedules = Object.fromEntries(cache.schedules.map((row) => [row._id, (() => {
        const { _id, ...data } = row;
        return data;
      })()]));
      const sessionKey = operationalDayKey;
      const quota = cache.quota;
      const quotaMap = quota ? {
        [sessionKey]: {
          tanggal: sessionKey,
          kuotaMaksimal: Number(quota.kuotaMaksimal ?? quota.quotaMaximum ?? 15),
          kuotaTerpakai: Number(quota.kuotaTerpakai ?? quota.quotaUsed ?? 0),
        },
      } : {};
      setDbState((previous) => ({
        ...previous,
        customers: cache.customer ? [cache.customer] : (sessionRole === 'pelanggan' ? [] : previous.customers),
        walkinQueue: queues,
        bookings,
        schedules,
        promos: cache.promos.length ? cache.promos : previous.promos,
        capsterProfile: cache.profile || previous.capsterProfile,
        quotas: { ...previous.quotas, ...quotaMap },
        lastUpdatedAt: Date.now(),
      }));
      setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
    };

    const onError = () => {
      if (!disposed) setSyncStatus('reconnecting');
    };
    setSyncStatus('connecting');
    const capster = sessionRole === 'capster';

    const addCollectionListener = <T,>(
      path: string,
      assign: (rows: T[]) => void,
      customerOnly = false
    ) => {
      const source = collection(firestore, path);
      const ref = customerOnly ? query(source, where('customerUid', '==', uid)) : source;
      unsubscribers.push(onSnapshot(ref, (snapshot) => {
        assign(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T));
        setSyncStatus('connected');
        apply();
      }, onError));
    };

    addCollectionListener<Record<string, unknown>>('queuePublic', (rows) => { cache.queuePublic = rows; });
    addCollectionListener<Record<string, unknown>>('bookingPublic', (rows) => { cache.bookingPublic = rows; });
    addCollectionListener<Record<string, unknown> & { _id: string }>('schedules', (rows) => {
      cache.schedules = rows.map((row) => ({ ...row, _id: String(row.id) }));
    });
    addCollectionListener<Promo>('promos', (rows) => { cache.promos = rows; });

    const privateQueue = collection(firestore, 'queuePrivate');
    const privateBooking = collection(firestore, 'bookingPrivate');
    const queueQuery = capster ? privateQueue : query(privateQueue, where('customerUid', '==', uid));
    const bookingQuery = capster ? privateBooking : query(privateBooking, where('customerUid', '==', uid));
    unsubscribers.push(onSnapshot(queueQuery, (snapshot) => {
      cache.queuePrivate = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setSyncStatus('connected');
      apply();
    }, onError));
    unsubscribers.push(onSnapshot(bookingQuery, (snapshot) => {
      cache.bookingPrivate = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setSyncStatus('connected');
      apply();
    }, onError));

    if (!capster) {
      unsubscribers.push(onSnapshot(doc(firestore, 'customers', uid), (snapshot) => {
        cache.customer = snapshot.exists()
          ? ({ id: uid, ...snapshot.data(), passwordHash: '' } as Customer)
          : null;
        apply();
      }, onError));
    }
    unsubscribers.push(onSnapshot(doc(firestore, 'capsterProfile', 'hasan'), (snapshot) => {
      cache.profile = snapshot.exists()
        ? (snapshot.data() as CapsterProfile)
        : getInitialCapsterProfile();
      apply();
    }, onError));
    unsubscribers.push(onSnapshot(doc(firestore, 'queueSessions', operationalDayKey), (snapshot) => {
      cache.quota = snapshot.exists() ? snapshot.data() : null;
      apply();
    }, onError));

    return () => {
      disposed = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [hydrated, sessionRole, customerSessionId, loggedInCapsterId, operationalDayKey]);

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
    } catch {
      // Sesi server akan kedaluwarsa otomatis setelah 90 detik jika jaringan gagal.
    } finally {
      window.sessionStorage.removeItem('wib_capster_session_id');
      if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
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
    async (params: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }): Promise<ServiceResult<BarberDatabaseState>> => {
      const user = firebaseAuth?.currentUser;
      if (!user?.email) {
        return { ok: false, errorCode: 'AUTH_REQUIRED', message: 'Sesi Firebase capster tidak aktif.' };
      }
      if (params.newPassword.length < 6 || params.newPassword !== params.confirmPassword) {
        return { ok: false, errorCode: 'VALIDATION_ERROR', message: 'Password baru minimal 6 karakter dan konfirmasi harus sama.' };
      }
      try {
        const credential = EmailAuthProvider.credential(user.email, params.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, params.newPassword);
        return { ok: true, data: dbState };
      } catch (error) {
        const code = (error as { code?: string }).code;
        const message = code === 'auth/wrong-password' || code === 'auth/invalid-credential'
          ? 'Password saat ini tidak sesuai.'
          : code === 'auth/weak-password'
            ? 'Password baru terlalu lemah.'
            : 'Gagal memperbarui password Firebase. Silakan coba lagi.';
        return { ok: false, errorCode: 'UNAUTHORIZED', message };
      }
    },
    [dbState]
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
