'use client';

import {
  Ban,
  CheckCircle2,
  Clock,
  Lock,
  Scissors,
  XCircle,
} from 'lucide-react';
import { QueueStatus, SlotStatus } from '@/lib/types';

type AnyStatus = QueueStatus | SlotStatus;

const STATUS_STYLES: Record<
  AnyStatus,
  { classes: string; label: string }
> = {
  Available: {
    classes: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30',
    label: 'Available',
  },
  Booked: {
    classes: 'bg-rose-500/12 text-rose-400 border-rose-500/30',
    label: 'Booked',
  },
  Full: {
    classes: 'bg-red-500/15 text-red-400 border-red-500/35',
    label: 'Full',
  },
  'Tidak Tersedia': {
    classes: 'bg-zinc-800/90 text-zinc-300 border-zinc-600/70',
    label: 'Tidak Tersedia',
  },
  Waiting: {
    classes: 'bg-amber-500/12 text-amber-300 border-amber-500/30',
    label: 'Waiting',
  },
  'In-Service': {
    classes: 'bg-sky-500/12 text-sky-300 border-sky-500/30',
    label: 'In-Service',
  },
  Selesai: {
    classes: 'bg-zinc-800/80 text-emerald-300 border-zinc-700',
    label: 'Selesai',
  },
  Canceled: {
    classes: 'bg-rose-950/60 text-rose-300 border-rose-500/30',
    label: 'Canceled',
  },
  Kedaluwarsa: {
    classes: 'bg-zinc-900 text-zinc-400 border-zinc-700',
    label: 'Kedaluwarsa',
  },
};

export function StatusIndicator({
  status,
  compact = false,
}: {
  status: AnyStatus;
  compact?: boolean;
}) {
  const cfg = STATUS_STYLES[status];

  const renderIcon = () => {
    switch (status) {
      case 'Available':
      case 'Selesai':
        return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
      case 'Booked':
      case 'Full':
        return <Lock className="w-3.5 h-3.5 shrink-0" />;
      case 'Tidak Tersedia':
        return <Ban className="w-3.5 h-3.5 shrink-0" />;
      case 'Waiting':
      case 'Kedaluwarsa':
        return <Clock className="w-3.5 h-3.5 shrink-0" />;
      case 'In-Service':
        return <Scissors className="w-3.5 h-3.5 shrink-0" />;
      case 'Canceled':
        return <XCircle className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border rounded-md font-medium whitespace-nowrap shrink-0 ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${cfg.classes}`}
    >
      {renderIcon()}
      <span>{cfg.label}</span>
    </span>
  );
}
