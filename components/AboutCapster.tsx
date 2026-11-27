'use client';

import { Award, ExternalLink, Instagram, MessageCircle } from 'lucide-react';
import {
  CapsterProfile,
  formatInstagramDisplay,
  formatWhatsAppDashDisplay,
  getInstagramUrl,
  getWhatsAppChatUrl,
} from '@/lib/capster-profile';
import { CapsterAvatar } from './BarbershopMedia';

interface AboutCapsterProps {
  profile: CapsterProfile;
  spesialisasi?: string;
  variant?: 'full' | 'compact';
}

export function AboutCapster({
  profile,
  spesialisasi,
  variant = 'full',
}: AboutCapsterProps) {
  const waDisplay = formatWhatsAppDashDisplay(profile.nomorWhatsApp);
  const waHref = getWhatsAppChatUrl(profile.nomorWhatsApp, profile.nama);
  const igCapsterDisplay = formatInstagramDisplay(profile.instagramCapster);
  const igCapsterHref = getInstagramUrl(profile.instagramCapster);
  const igShopDisplay = formatInstagramDisplay(profile.instagramBarbershop);
  const igShopHref = getInstagramUrl(profile.instagramBarbershop);

  if (variant === 'compact') {
    return (
      <div className="p-4 rounded-xl bg-zinc-900/75 border border-zinc-800 space-y-3">
        <div className="flex items-start gap-3.5">
          <CapsterAvatar
            fotoKey="hasan"
            nama={profile.nama}
            widthClass="w-16 sm:w-20"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold text-base text-stone-100">
                {profile.nama}
              </h3>
              <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/35 text-[11px] font-semibold text-amber-300">
                {profile.gelar}
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {profile.pengalaman}
            </p>
            {spesialisasi && (
              <p className="text-[11px] text-zinc-400">{spesialisasi}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/80">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-500/12 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono tabular-nums">WA {waDisplay}</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>

          <a
            href={igCapsterHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-stone-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Instagram className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{igCapsterDisplay}</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          <a
            href={igShopHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-stone-200 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Instagram className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{igShopDisplay}</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="tentang-capster-heading" className="space-y-4">
      <div>
        <h2
          id="tentang-capster-heading"
          className="font-display text-xl sm:text-2xl font-bold text-stone-100"
        >
          Tentang Capster
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Kenali capster yang siap melayani Anda atau hubungi langsung melalui
          WhatsApp dan Instagram.
        </p>
      </div>

      <div className="p-5 sm:p-6 lg:p-7 rounded-2xl bg-[var(--wib-surface)] border border-zinc-800/90">
        <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-6">
          <CapsterAvatar
            fotoKey="hasan"
            nama={profile.nama}
            widthClass="w-36 sm:w-44"
          />

          <div className="flex-1 min-w-0 space-y-4 w-full">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="font-display text-2xl font-bold text-stone-100">
                  {profile.nama}
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-400/15 border border-amber-400/40 text-xs font-semibold text-amber-300">
                  <Award className="w-3.5 h-3.5 shrink-0" />
                  <span>{profile.gelar}</span>
                </span>
              </div>

              <p className="text-sm sm:text-base text-stone-200 leading-relaxed">
                {profile.pengalaman}
              </p>

              {spesialisasi && (
                <p className="text-xs sm:text-sm text-zinc-400">
                  Keahlian: {spesialisasi}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800/80 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Kontak &amp; Media Sosial
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-500/12 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-200 flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold">
                        WhatsApp
                      </p>
                      <p className="text-xs sm:text-sm font-mono tabular-nums font-semibold truncate">
                        {waDisplay}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </a>

                <a
                  href={igCapsterHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-stone-100 flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Instagram className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                        IG Capster
                      </p>
                      <p className="text-xs sm:text-sm font-medium truncate">
                        {igCapsterDisplay}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </a>

                <a
                  href={igShopHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-stone-100 flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Instagram className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">
                        IG Barbershop
                      </p>
                      <p className="text-xs sm:text-sm font-medium truncate">
                        {igShopDisplay}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
