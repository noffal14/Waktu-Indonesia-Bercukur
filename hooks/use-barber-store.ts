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
  const [authReady, setAuthReady] = useState(false);
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
  const serverOffsetRef = useRef(0);
  const authActionInProgressRef = useRef(false);

  const isOffline = !browserOnline || syncStatus === 'offline';
  const isOfflineRef = useRef(isOffline);
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline]);

  const syncStateFromStorage = useCallback(() => {
    if (isOfflineRef.current) return;
    const currentNow = Date.now() + serverOffsetRef.current;
    setNowMs(currentNow);
    setLastSyncedFormatted(formatTimeWibHHMM(currentNow));
  }, []);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setBrowserOnline(online);
      setSyncStatus(online ? 'connecting' : 'offline');
      setHydrated(true);
    }, 0);

    const handleOnline = () => {
      setBrowserOnline(true);
      setSyncStatus('reconnecting');
    };
    const handleOffline = () => {
      setBrowserOnline(false);
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const clockInterval = window.setInterval(() => {
      const currentNow = Date.now() + serverOffsetRef.current;
      setNowMs(currentNow);
    }, 1000);

    return () => {
      window.clearTimeout(hydrateTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(clockInterval);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !browserOnline) return;
    let active = true;
    const refreshServerTime = async () => {
      try {
        const response = await fetch('/api/time', { cache: 'no-store' });
        if (!response.ok) throw new Error('server-time-unavailable');
        const payload = await response.json();
        if (!active || typeof payload.serverTime !== 'number') return;
        serverOffsetRef.current = payload.serverTime - Date.now();
        const correctedNow = Date.now() + serverOffsetRef.current;
        setNowMs(correctedNow);
        setLastSyncedFormatted(formatTimeWibHHMM(correctedNow));
      } catch {
        if (active) setSyncStatus('reconnecting');
      }
    };
    void refreshServerTime();
    const interval = window.setInterval(() => void refreshServerTime(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [hydrated, browserOnline]);


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
    if (!hydrated) return;
    if (!firebaseAuth) {
      setAuthReady(true);
      return;
    }
    let active = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!active) return;
      if (!user) {
        setCustomerSessionId(null);
        setLoggedInCapsterId(null);
        setSessionRole(null);
        barberService.logoutCapster();
        barberService.logoutCustomer();
        setAuthReady(true);
        return;
      }
      if (authActionInProgressRef.current) {
        setAuthReady(true);
        return;
      }
      try {
        const token = await user.getIdTokenResult();
        if (!active) return;
        if (token.claims.role === 'capster') {
          const sessionId = window.sessionStorage.getItem('wib_capster_session_id');
          if (!sessionId) return; // First login creates its server session after Firebase sign-in.
          const heartbeat = await fetch('/api/capster/heartbeat', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${await user.getIdToken()}`,
              'x-capster-session-id': sessionId,
            },
            cache: 'no-store',
          });
          if (!active) return;
          if (!heartbeat.ok) {
            window.sessionStorage.removeItem('wib_capster_session_id');
            const expiryMessage = 'Sesi berakhir karena akun masuk di perangkat lain';
      window.sessionStorage.setItem('wib_capster_session_message', expiryMessage);
      setCapsterSessionMessage(expiryMessage);
            if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
            return;
          }
          setLoggedInCapsterId('hasan');
          setCustomerSessionId(null);
          setSessionRole('capster');
          return;
        }
        if (user.email?.endsWith('@pelanggan.waktu-indonesia.app')) {
          const result = await callCustomerAuthApi<Customer>('GET');
          if (!active) return;
          if (result.ok && result.data) {
            const customer = { ...result.data, id: user.uid, passwordHash: '' };
            setDbState((previous) => ({ ...previous, customers: [customer] }));
            setCustomerSessionId(user.uid);
            setLoggedInCapsterId(null);
            setSessionRole('pelanggan');
          } else {
            setCustomerSessionId(null);
            setSessionRole(null);
            if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
          }
        }
      } catch {
        if (active) setSyncStatus('reconnecting');
      } finally {
        if (active) setAuthReady(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !firestore) return;
    const user = firebaseAuth?.currentUser;
    const uid = user?.uid || '';
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
      if (!disposed) setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine ? 'reconnecting' : 'offline');
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
        setSyncStatus(typeof navigator !== 'undefined' && navigator.onLine ? 'connected' : 'offline');
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
    if (sessionRole) unsubscribers.push(onSnapshot(queueQuery, (snapshot) => {
      cache.queuePrivate = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setSyncStatus('connected');
      apply();
    }, onError));
    if (sessionRole) unsubscribers.push(onSnapshot(bookingQuery, (snapshot) => {
      cache.bookingPrivate = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      setSyncStatus('connected');
      apply();
    }, onError));

    if (sessionRole === 'pelanggan' && uid) {
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
    () => barberService.getQueueEstimation(dbState, operationalDayKey, nowMs),
    [dbState, operationalDayKey, nowMs]
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

  const commitStoreAction = useCallback(async <T,>(
    action: string,
    payload: Record<string, unknown> = {}
  ): Promise<ServiceResult<T>> => {
    const result = await callStoreApi<T>(action, payload);
    if (!result.ok) {
      return {
        ok: false,
        errorCode: (result.errorCode || 'INVALID_STATE') as ServiceResult<T>['errorCode'],
        message: result.message,
        conflictBookings: result.conflictBookings as DataBooking[] | undefined,
      };
    }
    setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
    return { ok: true, data: result.data };
  }, []);

  const registerCustomer = useCallback(
    async (params: {
      nama: string;
      nomorWhatsApp: string;
      email?: string;
      password: string;
      capsterFavoritId?: string;
    }): Promise<ServiceResult<{ customer: Customer; state: BarberDatabaseState }>> => {
      const nama = params.nama.trim();
      const phone = validateIndonesianWhatsApp(params.nomorWhatsApp);
      if (nama.length < 3 || !phone.valid) {
        return { ok: false, errorCode: 'VALIDATION_ERROR', message: phone.error || 'Nama minimal 3 karakter.' };
      }
      if (params.password.length < 6) {
        return { ok: false, errorCode: 'VALIDATION_ERROR', message: 'Password wajib diisi minimal 6 karakter.' };
      }
      if (!firebaseAuth) {
        return { ok: false, errorCode: 'INVALID_STATE', message: 'Firebase Authentication belum dikonfigurasi.' };
      }

      const syntheticEmail = `${phone.normalized}@pelanggan.waktu-indonesia.app`;
      authActionInProgressRef.current = true;
      try {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, syntheticEmail, params.password);
        const result = await callCustomerAuthApi<Customer>('POST', {
          nama,
          nomorWhatsApp: phone.normalized,
          email: params.email,
          capsterFavoritId: params.capsterFavoritId || 'hasan',
        });
        if (!result.ok || !result.data) {
          await credential.user.delete().catch(() => undefined);
          if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
          return {
            ok: false,
            errorCode: (result.errorCode || 'INVALID_STATE') as ServiceResult<Customer>['errorCode'],
            message: result.message || 'Gagal menyimpan profil pelanggan.',
          };
        }

        const customer = { ...result.data, id: credential.user.uid, passwordHash: '' };
        setDbState((previous) => ({
          ...previous,
          customers: [customer],
        }));
        setSessionRole('pelanggan');
        setCustomerSessionId(credential.user.uid);
        setLoggedInCapsterId(null);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
        return { ok: true, data: { customer, state: dbState } };
      } catch (error) {
        const code = (error as { code?: string }).code;
        const message = code === 'auth/email-already-in-use'
          ? 'Nomor sudah terdaftar, silakan masuk.'
          : code === 'auth/weak-password'
            ? 'Password terlalu lemah. Gunakan minimal 6 karakter.'
            : 'Pendaftaran gagal. Periksa koneksi dan coba lagi.';
        return { ok: false, errorCode: 'VALIDATION_ERROR', message };
      } finally {
        authActionInProgressRef.current = false;
      }
    },
    [dbState]
  );

  const loginCustomer = useCallback(
    async (nomorWhatsApp: string, password: string): Promise<ServiceResult<{ customer: Customer; state: BarberDatabaseState }>> => {
      const phone = validateIndonesianWhatsApp(nomorWhatsApp);
      if (!phone.valid) return { ok: false, errorCode: 'VALIDATION_ERROR', message: phone.error };
      if (!password) return { ok: false, errorCode: 'VALIDATION_ERROR', message: 'Password wajib diisi.' };
      if (!firebaseAuth) return { ok: false, errorCode: 'INVALID_STATE', message: 'Firebase Authentication belum dikonfigurasi.' };
      authActionInProgressRef.current = true;
      try {
        const credential = await signInWithEmailAndPassword(
          firebaseAuth,
          `${phone.normalized}@pelanggan.waktu-indonesia.app`,
          password
        );
        const result = await callCustomerAuthApi<Customer>('GET');
        if (!result.ok || !result.data) {
          if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
          return { ok: false, errorCode: 'UNAUTHORIZED', message: result.message || 'Profil pelanggan tidak ditemukan.' };
        }
        const customer = { ...result.data, id: credential.user.uid, passwordHash: '' };
        setDbState((previous) => ({ ...previous, customers: [customer] }));
        setSessionRole('pelanggan');
        setCustomerSessionId(credential.user.uid);
        setLoggedInCapsterId(null);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
        return { ok: true, data: { customer, state: dbState } };
      } catch {
        return { ok: false, errorCode: 'UNAUTHORIZED', message: 'Nomor WhatsApp atau password salah.' };
      } finally {
        authActionInProgressRef.current = false;
      }
    },
    [dbState]
  );

  const logoutCustomer = useCallback(async () => {
    if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
    barberService.logoutCustomer();
    setCustomerSessionId(null);
    setSessionRole((previous) => (previous === 'pelanggan' ? null : previous));
  }, []);

  const updateCustomerProfile = useCallback(
    async (params: {
      nama: string;
      email?: string;
      capsterFavoritId?: string;
      currentPassword?: string;
      newPassword?: string;
    }): Promise<ServiceResult<{ customer: Customer }>> => {
      if (!customerSessionId || !firebaseAuth?.currentUser) {
        return { ok: false, errorCode: 'AUTH_REQUIRED', message: 'Sesi pelanggan tidak aktif.' };
      }
      if (params.newPassword) {
        if (!params.currentPassword || params.newPassword.length < 6) {
          return { ok: false, errorCode: 'VALIDATION_ERROR', message: 'Masukkan password saat ini dan password baru minimal 6 karakter.' };
        }
        try {
          const user = firebaseAuth.currentUser;
          const credential = EmailAuthProvider.credential(user.email || '', params.currentPassword);
          await reauthenticateWithCredential(user, credential);
          await updatePassword(user, params.newPassword);
        } catch {
          return { ok: false, errorCode: 'UNAUTHORIZED', message: 'Password saat ini tidak sesuai atau password baru ditolak Firebase.' };
        }
      }
      const result = await callCustomerAuthApi<Customer>('PATCH', {
        nama: params.nama,
        email: params.email,
        capsterFavoritId: params.capsterFavoritId,
      });
      if (!result.ok || !result.data) {
        return { ok: false, errorCode: (result.errorCode || 'INVALID_STATE') as ServiceResult<{ customer: Customer }>['errorCode'], message: result.message };
      }
      const customer = { ...result.data, id: customerSessionId, passwordHash: '' };
      setDbState((previous) => ({ ...previous, customers: [customer] }));
      setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
      return { ok: true, data: { customer } };
    },
    [customerSessionId]
  );

  const deleteCustomerAccount = useCallback(async (): Promise<ServiceResult<unknown>> => {
    if (!customerSessionId || !firebaseAuth?.currentUser) {
      return { ok: false, errorCode: 'AUTH_REQUIRED', message: 'Sesi pelanggan tidak aktif.' };
    }
    const result = await callCustomerAuthApi('DELETE');
    if (!result.ok) {
      return { ok: false, errorCode: (result.errorCode || 'INVALID_STATE') as ServiceResult<unknown>['errorCode'], message: result.message };
    }
    if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
    setDbState((previous) => ({ ...previous, customers: [] }));
    setCustomerSessionId(null);
    setSessionRole(null);
    setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
    return { ok: true };
  }, [customerSessionId]);

  // =========================================================================
  // CUSTOMER QUEUE & BOOKING ACTIONS
  // =========================================================================

  const takeWalkinQueue = useCallback(
    async (params: { customerId?: string; capsterId?: string }): Promise<ServiceResult<{
      ticket: DataAntreanWalkin;
      antreanDiDepan: number;
      estimasiMenit: number;
      state: BarberDatabaseState;
    }>> => {
      if (isOfflineRef.current) {
        return { ok: false, errorCode: 'INVALID_STATE', message: 'Koneksi terputus. Tidak dapat mengambil antrean baru.' };
      }
      const result = await commitStoreAction<{
        ticket: DataAntreanWalkin;
        antreanDiDepan: number;
        estimasiMenit: number;
      }>('queue.take', { capsterId: params.capsterId });
      if (!result.ok || !result.data) {
        return { ok: false, errorCode: result.errorCode, message: result.message };
      }
      return { ok: true, data: { ...result.data, state: dbState } };
    },
    [commitStoreAction, dbState]
  );

  const cancelCustomerWalkin = useCallback(
    async (walkinId: string): Promise<ServiceResult<BarberDatabaseState>> => {
      if (!customerSessionId) return { ok: false, errorCode: 'AUTH_REQUIRED', message: 'Silakan masuk ke akun terlebih dahulu.' };
      if (isOfflineRef.current) return { ok: false, errorCode: 'INVALID_STATE', message: 'Koneksi terputus.' };
      const result = await commitStoreAction('queue.cancel', { id: walkinId });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [customerSessionId, commitStoreAction, dbState]
  );

  const createBooking = useCallback(
    async (params: {
      customerId?: string;
      capsterId: string;
      tanggal: string;
      jamSlot: string;
      selectedServices?: SelectedServiceInput[];
    }): Promise<ServiceResult<{ booking: DataBooking; state: BarberDatabaseState }>> => {
      if (isOfflineRef.current) return { ok: false, errorCode: 'INVALID_STATE', message: 'Koneksi terputus. Sambungkan internet untuk mengunci slot booking.' };
      if (!customerSessionId) return { ok: false, errorCode: 'AUTH_REQUIRED', message: 'Silakan masuk ke akun terlebih dahulu.' };
      const result = await commitStoreAction<{ booking: DataBooking }>('booking.create', {
        capsterId: params.capsterId,
        tanggal: params.tanggal,
        jamSlot: params.jamSlot,
        selectedServices: params.selectedServices || [],
      });
      if (!result.ok || !result.data?.booking) {
        return { ok: false, errorCode: result.errorCode, message: result.message };
      }
      return { ok: true, data: { booking: result.data.booking, state: dbState } };
    },
    [customerSessionId, commitStoreAction, dbState]
  );

  const rescheduleBooking = useCallback(
    async (params: {
      bookingId: string;
      newCapsterId: string;
      newTanggal: string;
      newJamSlot: string;
    }): Promise<ServiceResult<BarberDatabaseState>> => {
      if (isOfflineRef.current) return { ok: false, errorCode: 'INVALID_STATE', message: 'Koneksi terputus. Sambungkan internet untuk mengubah jadwal.' };
      if (!customerSessionId) return { ok: false, errorCode: 'AUTH_REQUIRED', message: 'Silakan masuk ke akun terlebih dahulu.' };
      const result = await commitStoreAction('booking.reschedule', {
        id: params.bookingId,
        capsterId: params.newCapsterId,
        tanggal: params.newTanggal,
        jamSlot: params.newJamSlot,
      });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [customerSessionId, commitStoreAction, dbState]
  );

  const cancelCustomerBooking = useCallback(
    async (bookingId: string): Promise<ServiceResult<BarberDatabaseState>> => {
      if (!customerSessionId) return { ok: false, errorCode: 'AUTH_REQUIRED', message: 'Silakan masuk ke akun terlebih dahulu.' };
      const result = await commitStoreAction('booking.cancel', { id: bookingId });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [customerSessionId, commitStoreAction, dbState]
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

      authActionInProgressRef.current = true;
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
          if (firebaseAuth) await signOut(firebaseAuth);
          return {
            ok: false,
            errorCode: response.status === 409 ? 'UNAUTHORIZED' : 'INVALID_STATE',
            message: payload.message || 'Gagal membuat sesi capster.',
          };
        }

        window.sessionStorage.setItem('wib_capster_session_id', payload.sessionId);
        const localSession = dbState.capsters.find((capster) => capster.id === 'hasan');
        if (!localSession) {
          await fetch('/api/capster/session', {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              'x-capster-session-id': payload.sessionId,
            },
          }).catch(() => undefined);
          if (firebaseAuth) await signOut(firebaseAuth);
          return { ok: false, errorCode: 'NOT_FOUND', message: 'Data capster tidak ditemukan.' };
        }

        setCapsterSessionMessage(null);
        setSessionRole('capster');
        setLoggedInCapsterId(localSession.id);
        setCustomerSessionId(null);
        setLastSyncedFormatted(formatTimeWibHHMM(Date.now()));
        return { ok: true, data: localSession };
      } catch (error) {
        const code = (error as { code?: string }).code;
        const message = code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
          ? 'Username atau password salah.'
          : 'Tidak dapat masuk. Periksa koneksi dan konfigurasi Firebase.';
        return { ok: false, errorCode: 'UNAUTHORIZED', message };
      } finally {
        authActionInProgressRef.current = false;
      }
    },
    [dbState.capsters]
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
    async (walkinId: string, _capsterId?: string): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('queue.call', { id: walkinId });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const completeWalkin = useCallback(
    async (walkinId: string, overrideDurationMinutes?: number, selectedServices?: SelectedServiceInput[], finalTotal?: number): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('queue.complete', {
        id: walkinId,
        durationMinutes: overrideDurationMinutes,
        selectedServices: selectedServices || [],
        finalTotal,
      });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const cancelWalkin = useCallback(
    async (walkinId: string): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('queue.capsterCancel', { id: walkinId });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const startBookingService = useCallback(
    async (bookingId: string): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('booking.start', { id: bookingId });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const completeBooking = useCallback(
    async (bookingId: string, overrideDurationMinutes?: number, finalTotal?: number): Promise<ServiceResult<BarberDatabaseState>> => {
      const booking = dbState.bookings.find((item) => item.id === bookingId);
      const result = await commitStoreAction('booking.complete', {
        id: bookingId,
        durationMinutes: overrideDurationMinutes,
        finalTotal: finalTotal ?? booking?.totalEstimasiMin ?? booking?.subtotalHarga ?? 0,
      });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const cancelBookingManual = useCallback(
    async (bookingId: string): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('booking.capsterCancel', { id: bookingId });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const updateDailyQuota = useCallback(
    async (targetOperationalDayKey: string, maxQuota: number): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('quota.update', {
        operationalDayKey: targetOperationalDayKey,
        maxQuota,
      });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const setCapsterDayOff = useCallback(
    async (params: {
      capsterId: string;
      tanggal: string;
      isLibur: boolean;
      alasanLibur?: string;
      forceCancelConflicts?: boolean;
    }): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('schedule.dayOff', params as unknown as Record<string, unknown>);
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const setCapsterSlotManual = useCallback(
    async (params: {
      capsterId: string;
      tanggal: string;
      jam: string;
      mode: 'tersedia' | 'tidak_tersedia' | 'terisi_manual';
      catatan?: string;
      forceCancelConflict?: boolean;
    }): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('schedule.slot', params as unknown as Record<string, unknown>);
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const createPromo = useCallback(
    async (params: {
      judul: string;
      deskripsi: string;
      layananId: string[];
      diskonMin: number;
      diskonMax: number;
      aktif: boolean;
      berlakuDari?: string;
      berlakuSampai?: string;
    }): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('promo.create', { params });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const updatePromo = useCallback(
    async (promoId: string, params: {
      judul: string;
      deskripsi: string;
      layananId: string[];
      diskonMin: number;
      diskonMax: number;
      aktif: boolean;
      berlakuDari?: string;
      berlakuSampai?: string;
    }): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('promo.update', { promoId, params });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const togglePromoActive = useCallback(
    async (promoId: string): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('promo.toggle', { promoId });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const deletePromo = useCallback(
    async (promoId: string): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('promo.delete', { promoId });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
  );

  const updateCapsterProfile = useCallback(
    async (params: {
      pengalaman: string;
      nomorWhatsApp: string;
      instagramCapster: string;
      instagramBarbershop: string;
    }): Promise<ServiceResult<BarberDatabaseState>> => {
      const result = await commitStoreAction('profile.update', { params });
      return result.ok ? { ok: true, data: dbState } : result;
    },
    [commitStoreAction, dbState]
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
    authReady,
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
    syncStatus,
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
