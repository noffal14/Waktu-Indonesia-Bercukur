'use client';

import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  KeyRound,
  LogIn,
  UserPlus,
} from 'lucide-react';
import {
  validateEmailOptional,
  validateIndonesianWhatsApp,
} from '@/lib/barber-service';
import { Capster, Customer, ServiceResult } from '@/lib/types';

interface AuthViewProps {
  capsters: Capster[];
  redirectMessage?: string | null;
  onLogin: (
    nomorWhatsApp: string,
    password: string
  ) => ServiceResult<{ customer: Customer }>;
  onRegister: (params: {
    nama: string;
    nomorWhatsApp: string;
    email?: string;
    password: string;
    capsterFavoritId?: string;
  }) => ServiceResult<{ customer: Customer }>;
  onDemoLogin: (customerId: string) => ServiceResult<{ customer: Customer }>;
  onAuthSuccess: () => void;
}

export function AuthView({
  capsters,
  redirectMessage,
  onLogin,
  onRegister,
  onDemoLogin,
  onAuthSuccess,
}: AuthViewProps) {
  const [tab, setTab] = useState<'masuk' | 'daftar'>('masuk');

  // Login form state
  const [loginWa, setLoginWa] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regNama, setRegNama] = useState('');
  const [regWa, setRegWa] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regCapsterId, setRegCapsterId] = useState('');
  const [regConsent, setRegConsent] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [regSubmitError, setRegSubmitError] = useState<string | null>(null);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const waCheck = validateIndonesianWhatsApp(loginWa);
    if (!waCheck.valid) {
      setLoginError(waCheck.error || 'Nomor WhatsApp tidak valid.');
      return;
    }
    if (!loginPassword) {
      setLoginError('Password wajib diisi.');
      return;
    }

    const res = onLogin(loginWa, loginPassword);
    if (!res.ok) {
      setLoginError(res.message || 'Gagal masuk. Periksa kembali data Anda.');
      return;
    }
    onAuthSuccess();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegSubmitError(null);
    const errors: Record<string, string> = {};

    if (regNama.trim().length < 3) {
      errors.nama = 'Nama lengkap wajib diisi minimal 3 karakter.';
    }

    const waCheck = validateIndonesianWhatsApp(regWa);
    if (!waCheck.valid) {
      errors.wa =
        waCheck.error ||
        'Gunakan nomor WhatsApp Indonesia yang valid (08xx / 628xx).';
    }

    const emailCheck = validateEmailOptional(regEmail);
    if (!emailCheck.valid) {
      errors.email = emailCheck.error || 'Format email tidak valid.';
    }

    if (regPassword.length < 6) {
      errors.password = 'Password wajib diisi minimal 6 karakter.';
    }

    if (regConfirmPassword !== regPassword) {
      errors.confirmPassword = 'Konfirmasi password tidak sama.';
    }

    if (!regConsent) {
      errors.consent =
        'Centang persetujuan penggunaan data terlebih dahulu.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    const res = onRegister({
      nama: regNama,
      nomorWhatsApp: regWa,
      email: regEmail || undefined,
      password: regPassword,
      capsterFavoritId: regCapsterId || undefined,
    });

    if (!res.ok) {
      setRegSubmitError(
        res.message || 'Pendaftaran gagal. Silakan periksa data Anda.'
      );
      return;
    }

    onAuthSuccess();
  };

  const handleQuickDemo = (customerId: string) => {
    const res = onDemoLogin(customerId);
    if (res.ok) {
      onAuthSuccess();
    }
  };

  return (
    <div className="max-w-lg mx-auto py-2 space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
          Akun Pelanggan
        </h1>
        <p className="text-sm text-zinc-400">
          Masuk atau daftar sekali untuk mengambil antrean dan booking tanpa
          mengetik ulang identitas.
        </p>
      </div>

      {redirectMessage && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs sm:text-sm text-amber-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{redirectMessage}</span>
        </div>
      )}

      {/* Segmented Tab Switch */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-[#131317] border border-zinc-800">
        <button
          type="button"
          onClick={() => {
            setTab('masuk');
            setLoginError(null);
          }}
          className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            tab === 'masuk'
              ? 'bg-amber-400 text-zinc-950'
              : 'text-zinc-300 hover:text-stone-100'
          }`}
        >
          <LogIn className="w-4 h-4" />
          <span>Masuk</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('daftar');
            setRegSubmitError(null);
          }}
          className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
            tab === 'daftar'
              ? 'bg-amber-400 text-zinc-950'
              : 'text-zinc-300 hover:text-stone-100'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Daftar</span>
        </button>
      </div>

      {/* TAB MASUK */}
      {tab === 'masuk' && (
        <div className="space-y-5">
          <form
            onSubmit={handleLoginSubmit}
            className="p-6 sm:p-7 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-4"
          >
            {loginError && (
              <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs sm:text-sm text-rose-200">
                {loginError}
              </div>
            )}

            <div>
              <label
                htmlFor="login-wa"
                className="block text-sm font-medium text-stone-200 mb-1.5"
              >
                Nomor WhatsApp
              </label>
              <input
                id="login-wa"
                type="tel"
                required
                value={loginWa}
                onChange={(e) => setLoginWa(e.target.value)}
                placeholder="Contoh: 081234567890 atau 62812..."
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm font-mono focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-stone-200 mb-1.5"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Masukkan password Anda"
                className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-base flex items-center justify-center gap-2 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Masuk ke Akun</span>
            </button>
          </form>

          {/* Akun Demo Pelanggan */}
          <div className="p-5 rounded-2xl bg-[#131317] border border-zinc-800/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-zinc-300">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Akses Cepat Akun Demo (Password: demo123)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleQuickDemo('cust-1')}
                className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-left transition-colors min-h-[56px]"
              >
                <p className="text-xs font-semibold text-stone-100">
                  Andi Pratama (Pelanggan 1)
                </p>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                  081234567890 · Ada 1 antrean aktif
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('cust-2')}
                className="p-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-left transition-colors min-h-[56px]"
              >
                <p className="text-xs font-semibold text-stone-100">
                  Bima Nugraha (Pelanggan 2)
                </p>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                  081298765432 · Ada 1 booking 15:00
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB DAFTAR */}
      {tab === 'daftar' && (
        <form
          onSubmit={handleRegisterSubmit}
          noValidate
          className="p-6 sm:p-7 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-4"
        >
          {regSubmitError && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs sm:text-sm text-rose-200 flex flex-col gap-2">
              <span>{regSubmitError}</span>
              {regSubmitError.toLowerCase().includes('sudah terdaftar') && (
                <button
                  type="button"
                  onClick={() => {
                    setLoginWa(regWa);
                    setTab('masuk');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 self-start"
                >
                  <span>Pindah ke halaman Masuk</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="reg-nama"
              className="block text-sm font-medium text-stone-200 mb-1.5"
            >
              Nama Lengkap <span className="text-rose-400">*</span>
            </label>
            <input
              id="reg-nama"
              type="text"
              value={regNama}
              onChange={(e) => {
                setRegNama(e.target.value);
                setFieldErrors((prev) => ({ ...prev, nama: '' }));
              }}
              placeholder="Minimal 3 karakter"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-amber-400"
            />
            {fieldErrors.nama && (
              <p className="text-xs text-rose-400 mt-1">{fieldErrors.nama}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="reg-wa"
              className="block text-sm font-medium text-stone-200 mb-1.5"
            >
              Nomor WhatsApp <span className="text-rose-400">*</span>
            </label>
            <input
              id="reg-wa"
              type="tel"
              value={regWa}
              onChange={(e) => {
                setRegWa(e.target.value);
                setFieldErrors((prev) => ({ ...prev, wa: '' }));
              }}
              placeholder="Contoh: 081234567890 atau 62812..."
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm font-mono focus:outline-none focus:border-amber-400"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              Otomatis dinormalisasi ke format 628xx dan menjadi identitas akun.
            </p>
            {fieldErrors.wa && (
              <p className="text-xs text-rose-400 mt-1">{fieldErrors.wa}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="block text-sm font-medium text-stone-200 mb-1.5"
            >
              Email <span className="text-zinc-400 font-normal">(opsional)</span>
            </label>
            <input
              id="reg-email"
              type="email"
              value={regEmail}
              onChange={(e) => {
                setRegEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholder="Contoh: nama@email.com"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-amber-400"
            />
            {fieldErrors.email && (
              <p className="text-xs text-rose-400 mt-1">{fieldErrors.email}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="reg-password"
                className="block text-sm font-medium text-stone-200 mb-1.5"
              >
                Password <span className="text-rose-400">*</span>
              </label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={(e) => {
                  setRegPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, password: '' }));
                }}
                placeholder="Min. 6 karakter"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-amber-400"
              />
              {fieldErrors.password && (
                <p className="text-xs text-rose-400 mt-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reg-confirm"
                className="block text-sm font-medium text-stone-200 mb-1.5"
              >
                Konfirmasi Password <span className="text-rose-400">*</span>
              </label>
              <input
                id="reg-confirm"
                type="password"
                value={regConfirmPassword}
                onChange={(e) => {
                  setRegConfirmPassword(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder="Ulangi password"
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-amber-400"
              />
              {fieldErrors.confirmPassword && (
                <p className="text-xs text-rose-400 mt-1">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-capster"
              className="block text-sm font-medium text-stone-200 mb-1.5"
            >
              Preferensi Capster Favorit{' '}
              <span className="text-zinc-400 font-normal">(opsional)</span>
            </label>
            <select
              id="reg-capster"
              value={regCapsterId}
              onChange={(e) => setRegCapsterId(e.target.value)}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
            >
              <option value="">Tidak ada preferensi khusus</option>
              {capsters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama} ({c.gelar})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={regConsent}
                onChange={(e) => {
                  setRegConsent(e.target.checked);
                  setFieldErrors((prev) => ({ ...prev, consent: '' }));
                }}
                className="mt-1 w-4 h-4 rounded accent-amber-400 shrink-0"
              />
              <span className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Data saya digunakan untuk keperluan antrean dan booking
              </span>
            </label>
            {fieldErrors.consent && (
              <p className="text-xs text-rose-400 mt-1">
                {fieldErrors.consent}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-base flex items-center justify-center gap-2 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Daftar & Masuk Sekarang</span>
          </button>
        </form>
      )}
    </div>
  );
}
