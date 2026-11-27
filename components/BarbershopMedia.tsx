'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Scissors } from 'lucide-react';
import barbershopHeroImg from '@/src/assets/images/barbershop_hero_full_hd.jpeg';
import hasanImg from '@/src/assets/images/capster_hasan_1795773386903.jpeg';
import { OPERATIONAL_HOURS } from '@/lib/barbershop-config';

const CAPSTER_IMAGES = {
  hasan: hasanImg,
} as const;

export function CapsterAvatar({
  fotoKey,
  nama,
  widthClass = 'w-16',
}: {
  fotoKey: 'hasan';
  nama: string;
  widthClass?: string;
}) {
  const [failed, setFailed] = useState(false);
  const imgAsset = CAPSTER_IMAGES[fotoKey];

  if (failed) {
    return (
      <div
        className={`${widthClass} aspect-square rounded-xl bg-[var(--wib-surface-elevated)] border border-zinc-800 flex items-center justify-center shrink-0`}
        aria-label={nama}
      >
        <span className="font-display font-bold text-[var(--wib-accent)] text-base">
          {nama.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${widthClass} h-auto rounded-xl overflow-hidden bg-[var(--wib-surface)] border border-zinc-800 shrink-0`}
    >
      <Image
        src={imgAsset}
        alt={`Foto Capster ${nama} — Capster Senior Waktu Indonesia Bercukur`}
        width={imgAsset.width}
        height={imgAsset.height}
        unoptimized={true}
        className="w-full h-auto max-w-full object-contain block"
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
      <div className="w-full min-h-[56vw] sm:min-h-[360px] lg:aspect-video lg:max-h-[70vh] bg-[var(--wib-surface)] flex flex-col items-center justify-center p-8 text-center">
        <Scissors className="w-10 h-10 text-[var(--wib-accent)] mb-3" />
        <p className="font-display font-semibold text-lg text-[var(--wib-text)]">
          Waktu Indonesia Bercukur
        </p>
        <p className="text-xs text-[var(--wib-text-muted)] mt-1">
          Senin–Jumat {OPERATIONAL_HOURS.weekday.label} · Sabtu–Minggu{' '}
          {OPERATIONAL_HOURS.weekend.label}
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video min-h-[56vw] sm:min-h-[420px] max-h-[70vh] overflow-hidden bg-[var(--wib-bg)]">
      <Image
        src={barbershopHeroImg}
        alt="Interior barbershop Waktu Indonesia Bercukur dengan kursi barber dan cermin"
        fill
        priority
        quality={90}
        sizes="100vw"
        className="object-cover object-center"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
      {/* Overlay gelap tipis hanya di area bawah agar teks hero kontras & terbaca (WCAG AA) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/45 to-[#0B0B0D]/15 pointer-events-none"
      />
    </div>
  );
}
