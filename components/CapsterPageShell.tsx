'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useBarberStore } from '@/hooks/use-barber-store';

export function CapsterPageShell() {
  const router = useRouter();
  const store = useBarberStore();

  useEffect(() => {
    if (!store.hydrated || !store.authReady) return;
    if (store.sessionRole === 'pelanggan') {
      const timer = window.setTimeout(() => {
        router.replace('/');
      }, 900);
      return () => window.clearTimeout(timer);
    }
    if (store.sessionRole === 'capster' && store.loggedInCapster) {
      const timer = window.setTimeout(() => {
        router.replace('/capster/dashboard');
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      router.replace('/login?role=capster');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [store.hydrated, store.authReady, store.sessionRole, store.loggedInCapster, router]);

  if (store.hydrated && store.authReady && store.sessionRole === 'pelanggan') {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4] flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 sm:p-8 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
          <div className="space-y-1.5">
            <h1 className="font-display text-xl font-bold text-rose-200">
              Halaman ini khusus capster
            </h1>
            <p className="text-sm text-zinc-300">
              Akun pelanggan tidak memiliki akses ke portal capster. Anda sedang
              diarahkan kembali ke Beranda...
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-sm font-medium text-stone-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Beranda</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md h-48 rounded-2xl bg-zinc-900/70 border border-zinc-800 animate-pulse" />
    </div>
  );
}
