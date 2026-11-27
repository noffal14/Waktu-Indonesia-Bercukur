import { getWibParts } from './barbershop-config';
import {
  BookedServiceLine,
  Promo,
  SelectedServiceInput,
  ServiceCategory,
  ServiceItem,
} from './types';

/**
 * Konfigurasi terpusat Daftar Harga & Layanan Waktu Indonesia Bercukur.
 * Seluruh komponen membaca harga, nama layanan, dan estimasi durasi dari file ini.
 */
export const SERVICE_CATALOG: ServiceCategory[] = [
  {
    id: 'cat-premium-haircut',
    nama: 'Premium Haircut',
    items: [
      {
        id: 'premium-haircut',
        nama: 'Premium Haircut',
        harga: 50_000,
        durasiMenit: 45,
      },
    ],
  },
  {
    id: 'cat-basic-color',
    nama: 'Basic Color',
    items: [
      {
        id: 'basic-color-black',
        nama: 'Black',
        harga: 50_000,
        durasiMenit: 90,
      },
      {
        id: 'basic-color-brown-blue-black',
        nama: 'Brown / Blue Black',
        harga: 70_000,
        durasiMenit: 90,
      },
    ],
  },
  {
    id: 'cat-bleaching',
    nama: 'Bleaching',
    items: [
      {
        id: 'bleaching-highlight',
        nama: 'Highlight',
        harga: 150_000,
        durasiMenit: 120,
      },
      {
        id: 'bleaching-full',
        nama: 'Full',
        harga: 250_000,
        durasiMenit: 120,
      },
    ],
  },
  {
    id: 'cat-color-bleaching',
    nama: 'Color & Bleaching',
    items: [
      {
        id: 'color-bleaching-1-highlight',
        nama: '1 Color Highlight',
        harga: 200_000,
        durasiMenit: 120,
      },
      {
        id: 'color-bleaching-full',
        nama: 'Full',
        harga: 350_000,
        durasiMenit: 120,
      },
    ],
  },
  {
    id: 'cat-additional-colors',
    nama: 'Additional Colors',
    items: [
      {
        id: 'additional-colors-per-color',
        nama: 'Per Color',
        harga: 50_000,
        durasiMenit: 30,
        perUnit: true,
      },
    ],
  },
  {
    id: 'cat-perming',
    nama: 'Perming (Curly Hair)',
    items: [
      {
        id: 'perming-curly-hair',
        nama: 'Perming (Curly Hair)',
        harga: 300_000,
        durasiMenit: 120,
      },
    ],
  },
];

export const ALL_SERVICE_ITEMS: Array<
  ServiceItem & { kategoriId: string; kategoriNama: string }
> = SERVICE_CATALOG.flatMap((cat) =>
  cat.items.map((item) => ({
    ...item,
    kategoriId: cat.id,
    kategoriNama: cat.nama,
  }))
);

export function findServiceItemById(
  itemId: string
): (ServiceItem & { kategoriId: string; kategoriNama: string }) | undefined {
  return ALL_SERVICE_ITEMS.find((item) => item.id === itemId);
}

/**
 * Format Rupiah tanpa spasi setelah "Rp" dengan pemisah ribuan titik: "Rp50.000".
 */
export function formatRupiah(amount: number): string {
  const safe = Math.max(0, Math.round(amount));
  const formatted = safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp${formatted}`;
}

export function formatRupiahRange(minAmount: number, maxAmount: number): string {
  const low = Math.min(minAmount, maxAmount);
  const high = Math.max(minAmount, maxAmount);
  if (Math.round(low) === Math.round(high)) {
    return formatRupiah(low);
  }
  return `${formatRupiah(low)} – ${formatRupiah(high)}`;
}

/**
 * Konfigurasi promo sistem awal (bukan data demo):
 * Promo "Potong Saja" untuk Premium Haircut dengan diskon 20–30%.
 */
export function getInitialSystemPromos(): Promo[] {
  return [
    {
      id: 'promo-potong-saja',
      judul: 'Potong Saja',
      deskripsi:
        'Promo khusus layanan Premium Haircut (diskon 20–30%, nilai pasti dikonfirmasi capster).',
      layananId: ['premium-haircut'],
      diskonMin: 20,
      diskonMax: 30,
      aktif: true,
      diperbaruiOleh: 'Hasan',
      diperbaruiPada: Date.parse('2026-01-01T00:00:00+07:00'),
    },
  ];
}

export function isPromoActiveNow(
  promo: Promo,
  nowMs: number = Date.now()
): boolean {
  if (!promo.aktif) return false;
  const todayStr = getWibParts(nowMs).dateStr;
  if (promo.berlakuDari && todayStr < promo.berlakuDari) {
    return false;
  }
  if (promo.berlakuSampai && todayStr > promo.berlakuSampai) {
    return false;
  }
  return true;
}

export function getBestPromoForItem(
  itemId: string,
  activePromos: Promo[]
): Promo | null {
  const matching = activePromos.filter((p) => p.layananId.includes(itemId));
  if (matching.length === 0) return null;
  return matching.reduce((best, curr) => {
    if (curr.diskonMax > best.diskonMax) return curr;
    if (curr.diskonMax === best.diskonMax && curr.diskonMin > best.diskonMin) {
      return curr;
    }
    return best;
  });
}

export function formatPromoDiscountLabel(promo: Promo): string {
  if (promo.diskonMin === promo.diskonMax) {
    return `Diskon ${promo.diskonMin}%`;
  }
  return `Diskon ${promo.diskonMin}–${promo.diskonMax}%, nilai pasti dikonfirmasi capster`;
}

export function formatPromoShortBadge(promo: Promo): string {
  if (promo.diskonMin === promo.diskonMax) {
    return `Diskon ${promo.diskonMin}%`;
  }
  return `Diskon ${promo.diskonMin}–${promo.diskonMax}%`;
}

export interface ItemPromoPricing {
  hasPromo: boolean;
  promo: Promo | null;
  hargaNormal: number;
  hargaDiskonMin: number; // harga terendah (diskon tertinggi)
  hargaDiskonMax: number; // harga tertinggi (diskon terendah)
  hargaDiskonText: string;
  discountBadge: string | null;
  discountNote: string | null;
}

export function getItemPromoPricing(
  item: ServiceItem,
  activePromos: Promo[],
  qty: number = 1
): ItemPromoPricing {
  const safeQty = item.perUnit ? Math.max(1, Math.round(qty)) : 1;
  const hargaNormal = item.harga * safeQty;
  const promo = getBestPromoForItem(item.id, activePromos);
  if (!promo || (promo.diskonMin <= 0 && promo.diskonMax <= 0)) {
    return {
      hasPromo: false,
      promo: null,
      hargaNormal,
      hargaDiskonMin: hargaNormal,
      hargaDiskonMax: hargaNormal,
      hargaDiskonText: formatRupiah(hargaNormal),
      discountBadge: null,
      discountNote: null,
    };
  }

  const hargaDiskonMin = Math.round(hargaNormal * (1 - promo.diskonMax / 100));
  const hargaDiskonMax = Math.round(hargaNormal * (1 - promo.diskonMin / 100));

  return {
    hasPromo: true,
    promo,
    hargaNormal,
    hargaDiskonMin,
    hargaDiskonMax,
    hargaDiskonText: formatRupiahRange(hargaDiskonMin, hargaDiskonMax),
    discountBadge: formatPromoShortBadge(promo),
    discountNote: formatPromoDiscountLabel(promo),
  };
}

export interface ServicesPricingSummary {
  lines: BookedServiceLine[];
  subtotalHarga: number;
  potonganMin: number;
  potonganMax: number;
  totalEstimasiMin: number;
  totalEstimasiMax: number;
  durasiTotalMenit: number;
  slotsNeeded: number;
  promoJudul: string[];
  hasDiscountRange: boolean;
}

export function calculateServicesPricing(
  selections: SelectedServiceInput[],
  activePromos: Promo[]
): ServicesPricingSummary {
  const lines: BookedServiceLine[] = [];
  let subtotalHarga = 0;
  let potonganMin = 0;
  let potonganMax = 0;
  let durasiTotalMenit = 0;
  const promoTitlesSet = new Set<string>();

  for (const sel of selections) {
    const item = findServiceItemById(sel.itemId);
    if (!item) continue;
    const qty = item.perUnit ? Math.max(1, Math.min(10, Math.round(sel.qty))) : 1;
    const lineNormal = item.harga * qty;
    const lineDuration = item.durasiMenit * qty;
    const promo = getBestPromoForItem(item.id, activePromos);

    const diskonMinPersen = promo ? promo.diskonMin : 0;
    const diskonMaxPersen = promo ? promo.diskonMax : 0;

    if (promo && (diskonMinPersen > 0 || diskonMaxPersen > 0)) {
      promoTitlesSet.add(promo.judul);
    }

    const linePotonganMin = Math.round((lineNormal * diskonMinPersen) / 100);
    const linePotonganMax = Math.round((lineNormal * diskonMaxPersen) / 100);

    subtotalHarga += lineNormal;
    potonganMin += linePotonganMin;
    potonganMax += linePotonganMax;
    durasiTotalMenit += lineDuration;

    lines.push({
      itemId: item.id,
      nama:
        item.kategoriNama === item.nama
          ? item.nama
          : `${item.kategoriNama} — ${item.nama}`,
      kategoriNama: item.kategoriNama,
      hargaSatuan: item.harga,
      qty,
      durasiMenit: item.durasiMenit,
      diskonMinPersen,
      diskonMaxPersen,
    });
  }

  const totalEstimasiMin = Math.max(0, subtotalHarga - potonganMax);
  const totalEstimasiMax = Math.max(0, subtotalHarga - potonganMin);
  const slotsNeeded =
    durasiTotalMenit > 0 ? Math.max(1, Math.ceil(durasiTotalMenit / 60)) : 1;

  return {
    lines,
    subtotalHarga,
    potonganMin,
    potonganMax,
    totalEstimasiMin,
    totalEstimasiMax,
    durasiTotalMenit,
    slotsNeeded,
    promoJudul: Array.from(promoTitlesSet),
    hasDiscountRange: potonganMin !== potonganMax,
  };
}
