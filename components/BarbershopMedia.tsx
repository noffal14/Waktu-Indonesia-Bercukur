'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Scissors } from 'lucide-react';
import barbershopHeroImg from '@/src/assets/images/barbershop_hero_1795773386654.jpg';
import hasanImg from '@/src/assets/images/capster_hasan_1795773386903.jpg';
import rakaImg from '@/src/assets/images/capster_raka_1795773387493.jpg';
import dimasImg from '@/src/assets/images/capster_dimas_1795773387892.jpg';

const CAPSTER_IMAGES = {
  hasan: hasanImg,
  raka: rakaImg,
  dimas: dimasImg,
} as const;

export function CapsterAvatar({
  fotoKey,
  nama,
  sizeClass = 'w-12 h-12',
}: {
  fotoKey: 'hasan' | 'raka' | 'dimas';
  nama: string;
  sizeClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${sizeClass} rounded-xl bg-gradient-to-br from-amber-500/20 to-zinc-800 border border-amber-500/30 flex items-center justify-center shrink-0`}
        aria-label={nama}
      >
        <span className="font-display font-bold text-amber-300 text-base">
          {nama.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0`}
    >
      <Image
        src={CAPSTER_IMAGES[fotoKey]}
        alt={`Foto Capster ${nama}`}
        fill
        sizes="96px"
        className="object-cover"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function BarbershopHeroMedia() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full h-full min-h-[260px] bg-gradient-to-br from-zinc-900 via-[#151310] to-zinc-950 flex flex-col items-center justify-center p-8 text-center">
        <Scissors className="w-10 h-10 text-amber-400 mb-3" />
        <p className="font-display font-semibold text-lg text-zinc-200">
          Waktu Indonesia Bercukur
        </p>
        <p className="text-sm text-zinc-400 mt-1">
          Operasional setiap hari · 10:00 – 21:00 WIB
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[260px] lg:min-h-[400px] overflow-hidden bg-zinc-900">
      <Image
        src={barbershopHeroImg}
        alt="Suasana interior barbershop Waktu Indonesia Bercukur dengan kursi cukur klasik dan pencahayaan hangat"
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/35 to-transparent"
      />
    </div>
  );
}
