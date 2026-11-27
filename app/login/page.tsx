import { Suspense } from 'react';
import { LoginPageShell } from '@/components/LoginPageShell';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0B0B0D] text-[#F5F5F4] flex items-center justify-center p-4">
          <div className="w-full max-w-lg h-72 rounded-2xl bg-zinc-900/70 border border-zinc-800 animate-pulse" />
        </div>
      }
    >
      <LoginPageShell />
    </Suspense>
  );
}
