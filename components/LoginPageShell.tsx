'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Scissors,
  ShieldAlert,
  User,
  UserCheck,
} from 'lucide-react';
import { useBarberStore } from '@/hooks/use-barber-store';
import { AppView } from '@/lib/types';
import { AuthView } from './AuthView';

const REDIRECT_REASON_LABELS: Partial<Record<AppView, string>> = {
  antrean:
    'Silakan masuk atau daftar terlebih dahulu untuk mengambil nomor antrean walk-in.',
  booking:
    'Silakan masuk atau daftar terlebih dahulu untuk membuat atau mengelola booking.',
  'antrean-saya':
    'Silakan masuk atau daftar untuk melihat Antrean & Jadwal Saya.',
  profil: 'Silakan masuk ke akun pelanggan untuk melihat profil Anda.',
};

const ALLOWED_REDIRECT_VIEWS: AppView[] = [
  'beranda',
  'antrean',
  'status',
  'jadwal',
  'booking',
  'antrean-saya',
  'profil',
];

function resolveCustomerDestination(redirectParam: string | null): string {
  if (!redirectParam) return '/';
  if (ALLOWED_REDIRECT_VIEWS.includes(redirectParam as AppView)) {
    return redirectParam === 'beranda' ? '/' : `/?view=${redirectParam}`;
  }
  if (redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
    return redirectParam;
  }
  return '/';
}

export function LoginPageShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useBarberStore();

  const roleParam = searchParams.get('role');
  const redirectParam = searchParams.get('redirect');
  const modeParam = searchParams.get('mode');

  const [selectedRole, setSelectedRole] = useState<'pelanggan' | 'capster'>(
    roleParam === 'capster' ? 'capster' : 'pelanggan'
  );
  const [prevRoleParam, setPrevRoleParam] = useState<string | null>(roleParam);

  if (roleParam !== prevRoleParam) {
    setPrevRoleParam(roleParam);
    if (roleParam === 'capster' || roleParam === 'pelanggan') {
      setSelectedRole(roleParam);
    }
  }

  // Form Capster state
  const [capsterUsername, setCapsterUsername] = useState('');
  const [capsterPassword, setCapsterPassword] = useState('');
  const [showCapsterPassword, setShowCapsterPassword] = useState(false);
  const [capsterError, setCapsterError] = useState<string | null>(null);
  const [capsterSubmitting, setCapsterSubmitting] = useState(false);

  const isCapsterLoggedIn =
    store.hydrated &&
    store.authReady &&
    store.sessionRole === 'capster' &&
    Boolean(store.loggedInCapster);
  const isCustomerLoggedIn =
    store.hydrated &&
    store.authReady &&
    store.sessionRole === 'pelanggan' &&
    Boolean(store.currentCustomer);

  const customerBlockedInCapsterTab =
    isCustomerLoggedIn && selectedRole === 'capster';

  useEffect(() => {
    if (!store.hydrated) return;

    if (isCapsterLoggedIn) {
      router.replace('/capster/dashboard');
      return;
    }

    if (isCustomerLoggedIn && selectedRole === 'pelanggan') {
      router.replace(resolveCustomerDestination(redirectParam));
      return;
    }

    if (customerBlockedInCapsterTab) {
      const timer = window.setTimeout(() => {
        router.replace('/');
      }, 1600);
      return () => window.clearTimeout(timer);
    }
  }, [
    store.hydrated,
    isCapsterLoggedIn,
    isCustomerLoggedIn,
    selectedRole,
    customerBlockedInCapsterTab,
    redirectParam,
    router,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedMessage = window.sessionStorage.getItem('wib_capster_session_message');
      if (savedMessage) {
        setCapsterError(savedMessage);
        window.sessionStorage.removeItem('wib_capster_session_message');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleCapsterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCapsterError(null);
    setCapsterSubmitting(true);
    try {
      const res = await store.loginCapster(capsterUsername, capsterPassword);
      if (!res.ok) {
        setCapsterError(res.message || 'Username atau password salah.');
        return;
      }
      router.push('/capster/dashboard');
    } finally {
      setCapsterSubmitting(false);
    }
  };

  const handleCustomerAuthSuccess = () => {
    router.replace(resolveCustomerDestination(redirectParam));
  };

  if (
    !store.hydrated ||
    !store.authReady ||
    isCapsterLoggedIn ||
    (isCustomerLoggedIn && selectedRole === 'pelanggan')
  ) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4] flex items-center justify-center p-4">
        <div className="w-full max-w-lg h-72 rounded-2xl bg-zinc-900/70 border border-zinc-800 animate-pulse" />
      </div>
    );
  }

  const redirectNotice =
    redirectParam && ALLOWED_REDIRECT_VIEWS.includes(redirectParam as AppView)
      ? REDIRECT_REASON_LABELS[redirectParam as AppView] || null
      : null;

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4] flex flex-col justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-lg mx-auto space-y-6">
        {/* Header Barbershop */}
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-amber-300 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Beranda</span>
          </Link>
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/35 flex items-center justify-center">
              <Scissors className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-stone-100">
              Waktu Indonesia Bercukur
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            Pilih jenis akun untuk masuk ke layanan pelanggan atau dashboard
            capster.
          </p>
        </div>

        {/* Kartu Login Terpadu dengan 2 Tab Role */}
        <div className="rounded-2xl bg-[#131317] border border-zinc-800/90 overflow-hidden shadow-2xl">
          {/* 2 Tab di bagian atas kartu */}
          <div
            role="tablist"
            aria-label="Pilih tipe login"
            className="grid grid-cols-2 p-1.5 bg-zinc-950/70 border-b border-zinc-800"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedRole === 'pelanggan'}
              onClick={() => {
                setSelectedRole('pelanggan');
                setCapsterError(null);
              }}
              className={`min-h-[48px] px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                selectedRole === 'pelanggan'
                  ? 'bg-amber-400 text-zinc-950 shadow-sm'
                  : 'text-zinc-300 hover:text-stone-100 hover:bg-zinc-900/60'
              }`}
            >
              <User className="w-4 h-4 shrink-0" />
              <span>Login Pelanggan</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={selectedRole === 'capster'}
              onClick={() => {
                setSelectedRole('capster');
                setCapsterError(null);
              }}
              className={`min-h-[48px] px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                selectedRole === 'capster'
                  ? 'bg-amber-400 text-zinc-950 shadow-sm'
                  : 'text-zinc-300 hover:text-stone-100 hover:bg-zinc-900/60'
              }`}
            >
              <Scissors className="w-4 h-4 shrink-0" />
              <span>Login Capster</span>
            </button>
          </div>

          <div className="p-5 sm:p-7">
            {/* TAB 1: LOGIN PELANGGAN */}
            {selectedRole === 'pelanggan' && (
              <AuthView
                capsters={store.dbState.capsters}
                redirectMessage={redirectNotice}
                initialMode={modeParam === 'daftar' ? 'daftar' : 'masuk'}
                embedded={true}
                onLogin={store.loginCustomer}
                onRegister={store.registerCustomer}
                onAuthSuccess={handleCustomerAuthSuccess}
              />
            )}

            {/* TAB 2: LOGIN CAPSTER */}
            {selectedRole === 'capster' && (
              <>
                {customerBlockedInCapsterTab ? (
                  <div className="p-5 rounded-xl bg-rose-950/45 border border-rose-500/45 text-center space-y-4">
                    <ShieldAlert className="w-9 h-9 text-rose-400 mx-auto" />
                    <div className="space-y-1">
                      <h2 className="font-display text-lg font-bold text-rose-200">
                        Akun ini bukan akun capster
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-300">
                        Anda sedang masuk menggunakan akun pelanggan. Anda
                        diarahkan kembali ke Beranda...
                      </p>
                    </div>
                    <Link
                      href="/"
                      className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs sm:text-sm font-medium text-stone-100"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Kembali ke Beranda</span>
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleCapsterSubmit} className="space-y-4">
                    <div className="space-y-1 pb-1">
                      <h2 className="font-display text-lg font-semibold text-stone-100">
                        Portal Masuk Capster
                      </h2>
                      <p className="text-xs text-zinc-400">
                        Khusus capster Waktu Indonesia Bercukur untuk mengelola
                        antrean, jadwal, promo, dan profil.
                      </p>
                    </div>

                    {(capsterError || store.capsterSessionMessage) && (
                      <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs sm:text-sm text-rose-200">
                        {capsterError || store.capsterSessionMessage}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="capster-login-username"
                        className="block text-sm font-medium text-stone-200 mb-1.5"
                      >
                        Username
                      </label>
                      <input
                        id="capster-login-username"
                        type="text"
                        autoComplete="username"
                        required
                        value={capsterUsername}
                        onChange={(e) => setCapsterUsername(e.target.value)}
                        placeholder="Masukkan username capster"
                        className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="capster-login-password"
                        className="block text-sm font-medium text-stone-200 mb-1.5"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="capster-login-password"
                          type={showCapsterPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          required
                          value={capsterPassword}
                          onChange={(e) => setCapsterPassword(e.target.value)}
                          placeholder="Masukkan password capster"
                          className="w-full min-h-[48px] pl-4 pr-12 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowCapsterPassword((prev) => !prev)
                          }
                          aria-label={
                            showCapsterPassword
                              ? 'Sembunyikan password'
                              : 'Tampilkan password'
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-stone-100 transition-colors"
                        >
                          {showCapsterPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={capsterSubmitting}
                      className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-zinc-950 font-semibold text-base flex items-center justify-center gap-2 transition-colors"
                    >
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <span>{capsterSubmitting ? 'Memverifikasi...' : 'Masuk sebagai Capster'}</span>
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
