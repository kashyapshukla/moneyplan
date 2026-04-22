"use client";

import { TrendingUp, TrendingDown, DollarSign, ArrowLeftRight } from "lucide-react";

const ICONS = {
  trending_up: TrendingUp,
  trending_down: TrendingDown,
  dollar: DollarSign,
  arrows: ArrowLeftRight,
} as const;

type IconName = keyof typeof ICONS;

export function StatCard({
  label,
  value,
  sub,
  icon,
  colorClass = "text-slate-900",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: IconName;
  colorClass?: string;
}) {
  const Icon = icon ? ICONS[icon] : null;

  return (
    <div className="rounded-xl border bg-white dark:border-slate-700 dark:bg-slate-900 p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-400 uppercase tracking-wide">{label}</p>
        {Icon && <span className="text-slate-300"><Icon className="h-4 w-4" /></span>}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${colorClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-400">{sub}</p>}
    </div>
  );
}
