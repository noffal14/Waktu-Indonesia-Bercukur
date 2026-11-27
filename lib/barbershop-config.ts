export const BARBERSHOP_TIMEZONE = 'Asia/Jakarta';
export const WALKIN_DAILY_QUOTA = 15;
export const DEFAULT_DURATION_MINUTES = 45;
export const LATE_TOLERANCE_MINUTES = 15;
export const RESCHEDULE_MIN_LEAD_MINUTES = 60;
export const NEAR_CLOSING_WARNING_MINUTES = 60;

export interface OperationalHoursSpec {
  buka: string;
  tutup: string;
  bukaHour: number;
  tutupHour: number;
  label: string;
}

export const OPERATIONAL_HOURS = {
  weekday: {
    buka: '12:00',
    tutup: '22:00',
    bukaHour: 12,
    tutupHour: 22,
    label: '12.00 – 22.00 WIB',
  },
  weekend: {
    buka: '10:00',
    tutup: '22:00',
    bukaHour: 10,
    tutupHour: 22,
    label: '10.00 – 22.00 WIB',
  },
} as const;

const HARI_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const HARI_SHORT_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const BULAN_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const BULAN_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const wibFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BARBERSHOP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export interface WibDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekdayIndex: number; // 0 = Minggu ... 6 = Sabtu
  dateStr: string; // YYYY-MM-DD
  hhmm: string; // HH:mm
  hhDotMm: string; // HH.mm
  hhDotMmSs: string; // HH.mm.ss
}

export function getWibParts(epochMs: number): WibDateParts {
  const parts = wibFormatter.formatToParts(new Date(epochMs));
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  }
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  const hour = Number(map.hour === '24' ? '0' : map.hour);
  const minute = Number(map.minute);
  const second = Number(map.second);

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(
    day
  ).padStart(2, '0')}`;
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const weekdayIndex = noonUtc.getUTCDay();

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekdayIndex,
    dateStr,
    hhmm: `${hh}:${mm}`,
    hhDotMm: `${hh}.${mm}`,
    hhDotMmSs: `${hh}.${mm}.${ss}`,
  };
}

export function formatWibIsoDateTime(epochMs: number = Date.now()): string {
  const parts = getWibParts(epochMs);
  const hh = String(parts.hour).padStart(2, '0');
  const mm = String(parts.minute).padStart(2, '0');
  const ss = String(parts.second).padStart(2, '0');
  return `${parts.dateStr}T${hh}:${mm}:${ss}+07:00`;
}

export function parseWibEpochMs(dateStr: string, hhmm: string): number {
  return Date.parse(`${dateStr}T${hhmm}:00+07:00`);
}

export function addDaysWib(baseDateStr: string, days: number): string {
  const baseMs = Date.parse(`${baseDateStr}T12:00:00+07:00`);
  const targetMs = baseMs + days * 86_400_000;
  return getWibParts(targetMs).dateStr;
}

export function formatDateIndoWib(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(`${dateStr}T12:00:00Z`);
  const dayIdx = dt.getUTCDay();
  return `${HARI_ID[dayIdx]}, ${d} ${BULAN_ID[m - 1]} ${y}`;
}

export function formatShortDateIndoWib(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(`${dateStr}T12:00:00Z`);
  const dayIdx = dt.getUTCDay();
  return `${HARI_SHORT_ID[dayIdx]}, ${d} ${BULAN_SHORT_ID[m - 1]}`;
}

export function formatLiveClockBannerWib(epochMs: number): string {
  const p = getWibParts(epochMs);
  return `${HARI_ID[p.weekdayIndex]}, ${p.day} ${BULAN_ID[p.month - 1]} ${
    p.year
  } | ${p.hhDotMm} WIB`;
}

export function getOperationalHoursForDate(
  dateStr: string
): OperationalHoursSpec {
  const dt = new Date(`${dateStr}T12:00:00Z`);
  const dayIdx = dt.getUTCDay();
  const isWeekend = dayIdx === 0 || dayIdx === 6;
  return isWeekend ? OPERATIONAL_HOURS.weekend : OPERATIONAL_HOURS.weekday;
}

export function generateHourSlots(buka: string, tutup: string): string[] {
  const startHour = Number(buka.split(':')[0]);
  const endHour = Number(tutup.split(':')[0]);
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  return slots;
}

export function getOperationalSessionKey(
  now: number | Date = Date.now()
): string {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const todayStr = getWibParts(nowMs).dateStr;
  const hours = getOperationalHoursForDate(todayStr);
  const openMs = parseWibEpochMs(todayStr, hours.buka);
  // Sesi operasional berganti tepat saat jam buka WIB terlewati (12:00 Sen-Jum, 10:00 Sab-Min)
  return nowMs >= openMs ? todayStr : addDaysWib(todayStr, -1);
}

export interface ShopOperationalStatus {
  todayStr: string;
  hours: OperationalHoursSpec;
  openMs: number;
  closeMs: number;
  isOpen: boolean;
  isBeforeOpen: boolean;
  isAfterClose: boolean;
  statusToko: 'buka' | 'belum_buka' | 'tutup';
  isNearClosing: boolean;
  minutesUntilClose: number;
  operationalDayKey: string;
  closedMessage: string | null;
}

export function getShopOperationalStatus(
  nowMs: number
): ShopOperationalStatus {
  const parts = getWibParts(nowMs);
  const todayStr = parts.dateStr;
  const hours = getOperationalHoursForDate(todayStr);
  const openMs = parseWibEpochMs(todayStr, hours.buka);
  const closeMs = parseWibEpochMs(todayStr, hours.tutup);

  const isBeforeOpen = nowMs < openMs;
  const isAfterClose = nowMs >= closeMs;
  const isOpen = !isBeforeOpen && !isAfterClose;
  const statusToko: ShopOperationalStatus['statusToko'] = isOpen
    ? 'buka'
    : isBeforeOpen
      ? 'belum_buka'
      : 'tutup';

  const minutesUntilClose = Math.max(0, Math.floor((closeMs - nowMs) / 60_000));
  const isNearClosing =
    isOpen && minutesUntilClose <= NEAR_CLOSING_WARNING_MINUTES;

  // Kunci sesi operasional aktif (reset kuota & nomor A001 tepat saat jam buka WIB)
  const operationalDayKey = getOperationalSessionKey(nowMs);

  let closedMessage: string | null = null;
  if (isBeforeOpen) {
    closedMessage = `Barbershop belum buka. Kuota ${WALKIN_DAILY_QUOTA} akan direset pukul ${hours.buka.replace(
      ':',
      '.'
    )} WIB`;
  } else if (isAfterClose) {
    const tomorrowStr = addDaysWib(todayStr, 1);
    const tomorrowHours = getOperationalHoursForDate(tomorrowStr);
    const tomorrowDt = new Date(`${tomorrowStr}T12:00:00Z`);
    const tomorrowDayName = HARI_ID[tomorrowDt.getUTCDay()];
    closedMessage = `Barbershop tutup. Buka kembali ${tomorrowDayName} pukul ${tomorrowHours.buka.replace(
      ':',
      '.'
    )} WIB`;
  }

  return {
    todayStr,
    hours,
    openMs,
    closeMs,
    isOpen,
    isBeforeOpen,
    isAfterClose,
    statusToko,
    isNearClosing,
    minutesUntilClose,
    operationalDayKey,
    closedMessage,
  };
}
