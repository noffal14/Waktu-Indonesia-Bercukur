import { Suspense } from 'react';
import { BarberAppShell } from '@/components/BarberAppShell';

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4] p-4 md:p-6">
          <div className="max-w-6xl mx-auto h-72 rounded-2xl bg-zinc-900/70 border border-zinc-800 animate-pulse" />
        </div>
      }
    >
      <BarberAppShell />
    </Suspense>
  );
}
