'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Save,
  Trash2,
  User,
} from 'lucide-react';
import { formatWhatsAppDisplay } from '@/lib/barber-service';
import { Capster, Customer, ServiceResult } from '@/lib/types';

interface ProfileViewProps {
  currentCustomer: Customer;
  capsters: Capster[];
  onUpdateProfile: (params: {
    nama: string;
    email?: string;
    capsterFavoritId?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => ServiceResult<{ customer: Customer }>;
  onDeleteAccount: () => ServiceResult<unknown>;
}

export function ProfileView({
  currentCustomer,
  capsters,
  onUpdateProfile,
  onDeleteAccount,
}: ProfileViewProps) {
  const [nama, setNama] = useState(currentCustomer.nama);
  const [email, setEmail] = useState(currentCustomer.email || '');
  const [capsterFavoritId, setCapsterFavoritId] = useState(
    currentCustomer.capsterFavoritId || capsters[0]?.id || 'hasan'
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (newPassword || confirmNewPassword) {
      if (newPassword.length < 6) {
        setFeedback({
          type: 'error',
          text: 'Password baru minimal 6 karakter.',
        });
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setFeedback({
          type: 'error',
          text: 'Konfirmasi password baru tidak sama.',
        });
        return;
      }
    }

    const res = onUpdateProfile({
      nama,
      email: email || undefined,
      capsterFavoritId: capsterFavoritId || undefined,
      currentPassword: newPassword ? currentPassword : undefined,
      newPassword: newPassword || undefined,
    });

    if (!res.ok) {
      setFeedback({
        type: 'error',
        text: res.message || 'Gagal menyimpan perubahan profil.',
      });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setFeedback({
      type: 'success',
      text: 'Profil akun Anda berhasil diperbarui.',
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-stone-100">
          Profil Pelanggan
        </h1>
        <p className="text-sm text-zinc-400">
          Perbarui nama, email, preferensi capster favorit, atau password akun
          Anda.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-start gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-200'
              : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="p-6 sm:p-7 rounded-2xl bg-[#131317] border border-zinc-800/90 space-y-5"
      >
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-base text-stone-100">
              Informasi Identitas
            </p>
            <p className="text-xs text-zinc-400">
              Nomor WhatsApp adalah identitas utama dan tidak dapat diubah.
            </p>
          </div>
        </div>

        <div>
          <label
            htmlFor="prof-wa"
            className="block text-sm font-medium text-stone-200 mb-1.5"
          >
            Nomor WhatsApp (Read-Only)
          </label>
          <input
            id="prof-wa"
            type="text"
            readOnly
            value={`${formatWhatsAppDisplay(
              currentCustomer.nomorWhatsApp
            )} (${currentCustomer.nomorWhatsApp})`}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800 text-zinc-400 text-sm font-mono cursor-not-allowed"
          />
        </div>

        <div>
          <label
            htmlFor="prof-nama"
            className="block text-sm font-medium text-stone-200 mb-1.5"
          >
            Nama Lengkap <span className="text-rose-400">*</span>
          </label>
          <input
            id="prof-nama"
            type="text"
            required
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="prof-email"
              className="block text-sm font-medium text-stone-200 mb-1.5"
            >
              Email <span className="text-zinc-400 font-normal">(opsional)</span>
            </label>
            <input
              id="prof-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 placeholder:text-zinc-500 text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label
              htmlFor="prof-capster"
              className="block text-sm font-medium text-stone-200 mb-1.5"
            >
              Capster Favorit
            </label>
            <select
              id="prof-capster"
              value={capsterFavoritId}
              onChange={(e) => setCapsterFavoritId(e.target.value)}
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
            >
              <option value="">Tidak ada preferensi</option>
              {capsters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama} ({c.gelar})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ganti Password Opsional */}
        <div className="pt-4 border-t border-zinc-800 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-200">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Ganti Password (Opsional)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="prof-old-pw"
                className="block text-xs text-zinc-400 mb-1.5"
              >
                Password Saat Ini
              </label>
              <input
                id="prof-old-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Isi jika ubah"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label
                htmlFor="prof-new-pw"
                className="block text-xs text-zinc-400 mb-1.5"
              >
                Password Baru
              </label>
              <input
                id="prof-new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 karakter"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label
                htmlFor="prof-conf-pw"
                className="block text-xs text-zinc-400 mb-1.5"
              >
                Konfirmasi Baru
              </label>
              <input
                id="prof-conf-pw"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Ulangi password"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-stone-100 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full min-h-[50px] px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Simpan Perubahan Profil</span>
        </button>
      </form>

      {/* Hapus Akun */}
      <section className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold text-rose-200">
            Hapus Akun Pelanggan
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Menghapus akun akan membatalkan seluruh antrean walk-in dan booking
            yang masih aktif agar slot kembali tersedia untuk pelanggan lain.
          </p>
        </div>

        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-rose-200">
              Konfirmasi penghapusan akun permanen?
            </span>
            <button
              type="button"
              onClick={() => onDeleteAccount()}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              Ya, Hapus Akun Sekarang
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs"
            >
              Batal
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Akun</span>
          </button>
        )}
      </section>
    </div>
  );
}
