"use client";

import { useState } from "react";
import {
  Plus, ChevronDown, ChevronUp, Pencil, Trash2,
  Flame, Turtle, Minus, TrendingUp, AlertTriangle,
  CheckCircle2, CalendarDays, Zap, ArrowRight, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BudgetFormDialog } from "./budget-form-dialog";
import { CATEGORY_LABELS } from "@/lib/categories";
import { useRouter } from "next/navigation";
import type { EnrichedBudget } from "@/app/(app)/budgets/page";
import type { CategoryTransaction } from "@/lib/budgets";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  enrichedBudgets: EnrichedBudget[];
  topTxByCategory: Record<string, CategoryTransaction[]>;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  daysInMonth: number;
  daysLeft: number;
  daysElapsed: number;
};

// ─── Savings categories — exceeding the goal is a WIN, not a warning ─────────

const SAVINGS_CATEGORIES = new Set(["Investment", "Savings"]);
const isSavings = (cat: string) => SAVINGS_CATEGORIES.has(cat);

// ─── Status helpers ───────────────────────────────────────────────────────────
// For expense categories: over 100% = bad. For savings: over 100% = great.

function statusColor(cat: string, pct: number): "green" | "amber" | "red" | "super" {
  if (isSavings(cat)) {
    if (pct >= 100) return "super";   // exceeded savings goal 🎉
    if (pct >= 80)  return "green";   // nearly there
    return "green";                   // any savings progress is good
  }
  if (pct >= 100) return "red";
  if (pct >= 80)  return "amber";
  return "green";
}

const COLOR_MAP = {
  green: { border: "border-emerald-200", strip: "bg-emerald-500", ring: "#10b981" },
  amber: { border: "border-amber-300",   strip: "bg-amber-400",   ring: "#f59e0b" },
  red:   { border: "border-red-300",     strip: "bg-red-500",     ring: "#ef4444" },
  super: { border: "border-teal-300",    strip: "bg-gradient-to-r from-teal-400 to-indigo-500", ring: "#0ea5e9" },
};

// ─── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { icon: string }> = {
  Food:          { icon: "🍔" },
  Housing:       { icon: "🏠" },
  Transport:     { icon: "🚗" },
  Entertainment: { icon: "🎬" },
  Shopping:      { icon: "🛍"  },
  Investment:    { icon: "📈" },
  Savings:       { icon: "🏦" },
  Other:         { icon: "📦" },
};

function catIcon(cat: string) { return CATEGORY_META[cat]?.icon ?? "📦"; }

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtK = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtExact = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// ─── Velocity chip ────────────────────────────────────────────────────────────

function VelocityChip({ v, category }: { v: EnrichedBudget["velocity"]; category: string }) {
  if (v === "none") return null;

  // For savings: "fast" means you're contributing a lot — celebrate it
  if (isSavings(category)) {
    if (v === "fast")
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
          <Star className="h-2.5 w-2.5" /> Accelerating
        </span>
      );
    if (v === "slow")
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
          <Turtle className="h-2.5 w-2.5" /> Below target
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        <Minus className="h-2.5 w-2.5" /> On target
      </span>
    );
  }

  if (v === "fast")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <Flame className="h-2.5 w-2.5" /> Fast burn
      </span>
    );
  if (v === "slow")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        <Turtle className="h-2.5 w-2.5" /> Under pace
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
      <Minus className="h-2.5 w-2.5" /> On pace
    </span>
  );
}

// ─── Animated ring ────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, pct) / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function Bar({ pct, category }: { pct: number; category: string }) {
  const clamp = (v: number) => Math.min(100, v);
  const saving = isSavings(category);
  const barColor = saving
    ? "bg-teal-500"
    : pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="relative h-3 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all duration-700`}
        style={{ width: `${clamp(pct)}%` }}
      />
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ category, pct }: { category: string; pct: number }) {
  const saving = isSavings(category);
  if (saving && pct >= 100)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
        ✨ Super month!
      </span>
    );
  if (saving)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> Saving
      </span>
    );
  if (pct >= 100)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <AlertTriangle className="h-3 w-3" /> Over budget
      </span>
    );
  if (pct >= 80)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        <AlertTriangle className="h-3 w-3" /> Almost full
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      <CheckCircle2 className="h-3 w-3" /> On track
    </span>
  );
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxRow({ tx, max }: { tx: CategoryTransaction; max: number }) {
  const abs = Math.abs(parseFloat(tx.amount));
  const pct = max > 0 ? (abs / max) * 100 : 0;
  return (
    <div className="py-2.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate flex-1">{tx.description}</p>
        <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{fmtDate(tx.date)}</span>
        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums flex-shrink-0">{fmtExact(abs)}</span>
      </div>
      <div className="mt-1.5 h-1 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div className="h-full rounded-full bg-slate-300" style={{ width: `${pct}%`, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({
  b, txList, isCurrentMonth, daysLeft, onEdit, onDelete,
}: {
  b: EnrichedBudget; txList: CategoryTransaction[];
  isCurrentMonth: boolean; daysLeft: number;
  onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const saving = isSavings(b.category);
  const label  = CATEGORY_LABELS[b.category as keyof typeof CATEGORY_LABELS] ?? b.category;
  const limit  = parseFloat(b.monthlyLimit);
  const sc = statusColor(b.category, b.percentUsed);
  const colors = COLOR_MAP[sc];
  const maxTxAmt = txList.length > 0
    ? Math.max(...txList.map((t) => Math.abs(parseFloat(t.amount)))) : 1;

  // For savings: "remaining" means "how much more to reach goal" (positive is good)
  const distanceLabel = saving
    ? b.remaining > 0
      ? `${fmtK(b.remaining)} to goal`
      : `${fmtK(Math.abs(b.remaining))} beyond goal 🎉`
    : b.percentUsed >= 100
      ? `${fmtK(b.spent - limit)} over limit`
      : `${fmtK(b.remaining)} left`;

  const distanceColor = saving
    ? b.remaining <= 0 ? "text-teal-600" : "text-indigo-600"
    : b.percentUsed >= 100 ? "text-red-600" : "text-emerald-600";

  return (
    <div className={`rounded-2xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-shadow hover:shadow-md ${colors.border}`}>
      {/* Top accent strip */}
      <div className={`h-1 w-full ${colors.strip}`} />

      <div className="p-5 space-y-4">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <Ring pct={b.percentUsed} color={colors.ring} size={52} />
              <span className="absolute inset-0 flex items-center justify-center text-xl">{catIcon(b.category)}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-bold text-slate-900 dark:text-white">{label}</p>
                <VelocityChip v={b.velocity} category={b.category} />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{fmtK(b.spent)}</span>
                {saving ? " contributed" : " spent"} of {fmtK(limit)} {saving ? "goal" : "limit"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <StatusBadge category={b.category} pct={b.percentUsed} />
            <Button variant="ghost" size="sm" onClick={onEdit} className="h-7 w-7 p-0 text-slate-300 hover:text-slate-600">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-7 w-7 p-0 text-slate-300 hover:text-red-500">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div className="space-y-1.5">
          <Bar pct={b.percentUsed} category={b.category} />
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 dark:text-slate-500">{b.percentUsed.toFixed(0)}% {saving ? "of goal" : "used"}</span>
            <span className={`font-semibold ${distanceColor}`}>{distanceLabel}</span>
          </div>
        </div>

        {/* ── Insight tiles ── */}
        <div className={`grid gap-2 ${isCurrentMonth ? "grid-cols-1" : "grid-cols-1"}`}>
          {/* Daily allowance / daily contribution */}
          {isCurrentMonth && daysLeft > 0 && (
            <div className={`rounded-xl px-3 py-2.5 border ${
              saving
                ? "bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700"
                : b.remaining <= 0
                  ? "bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/40"
                  : "bg-slate-50 border-slate-100 dark:bg-slate-800 dark:border-slate-700"
            }`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-0.5">
                {saving ? "Daily contribution" : "Daily budget left"}
              </p>
              {saving ? (
                <>
                  <p className="text-sm font-bold tabular-nums text-teal-700 dark:text-teal-400">
                    {fmtExact(b.dailyAllowance)}<span className="text-xs font-normal text-slate-400 dark:text-slate-500">/day</span>
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{daysLeft} days left to add more</p>
                </>
              ) : b.remaining <= 0 ? (
                <>
                  <p className="text-sm font-bold text-red-600">$0 / day</p>
                  <p className="text-[10px] text-red-400 dark:text-red-500 mt-0.5">Limit reached</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-300">
                    {fmtExact(b.dailyAllowance)}<span className="text-xs font-normal text-slate-400 dark:text-slate-500">/day</span>
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{daysLeft} days remaining</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Projected recurring spend ── */}
        {b.projectedRecurring > 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            <span className="text-indigo-500">↻</span> {fmtExact(b.projectedRecurring)}/mo committed (recurring)
          </p>
        )}

        {/* ── Top transaction callout ── */}
        {b.topMerchant && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Zap className="h-3 w-3 text-amber-400 flex-shrink-0" />
            <span>
              {saving ? "Largest contribution:" : "Biggest charge:"}
              {" "}<span className="font-semibold text-slate-700 dark:text-slate-300">{b.topMerchant}</span>
            </span>
            <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300 ml-auto">{fmtExact(b.topMerchantAmount)}</span>
          </div>
        )}

        {/* ── Expand transactions ── */}
        {txList.length > 0 && (
          <>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors pt-1"
            >
              <span>{expanded ? "Hide" : `See top ${txList.length} transaction${txList.length !== 1 ? "s" : ""} this month`}</span>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {expanded && (
              <div className="pt-1">
                {txList.map((tx) => <TxRow key={tx.id} tx={tx} max={maxTxAmt} />)}
              </div>
            )}
          </>
        )}
        {txList.length === 0 && b.spent === 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            {saving ? "No contributions recorded yet." : "No transactions recorded yet."}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Health banner ────────────────────────────────────────────────────────────

function HealthBanner({ budgets, isCurrentMonth, daysLeft, daysInMonth, daysElapsed }: {
  budgets: EnrichedBudget[]; isCurrentMonth: boolean;
  daysLeft: number; daysInMonth: number; daysElapsed: number;
}) {
  const expenseOnly = budgets.filter((b) => !isSavings(b.category));
  const savingsOnly = budgets.filter((b) => isSavings(b.category));

  const totalBudget = budgets.reduce((s, b) => s + parseFloat(b.monthlyLimit), 0);
  const totalSpent  = budgets.reduce((s, b) => s + b.spent, 0);
  const totalLeft   = totalBudget - totalSpent;

  const overallPct  = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const overCount   = expenseOnly.filter((b) => b.percentUsed >= 100).length;
  const warnCount   = expenseOnly.filter((b) => b.percentUsed >= 80 && b.percentUsed < 100).length;
  const savingsOver = savingsOnly.filter((b) => b.percentUsed >= 100).length;
  const monthPct    = daysInMonth > 0 ? (daysElapsed / daysInMonth) * 100 : 0;

  const headline =
    overCount > 0 ? "Over budget on expenses" :
    warnCount > 0 ? "Watch your spending" :
    savingsOver > 0 ? "🎉 Crushing savings goals!" :
    "Looking good!";

  const bannerBg =
    overCount > 0 ? "bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-900/10" :
    warnCount > 0 ? "bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10" :
    savingsOver > 0 ? "bg-gradient-to-r from-teal-50 to-indigo-50 dark:from-teal-900/20 dark:to-indigo-900/10" :
    "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10";

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <div className={`px-6 py-5 ${bannerBg}`}>
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <Ring pct={overallPct} color={overCount > 0 ? "#ef4444" : warnCount > 0 ? "#f59e0b" : "#10b981"} size={84} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100 leading-none">{overallPct.toFixed(0)}%</span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-semibold">used</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">{headline}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(totalSpent)}</span> of{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{fmtK(totalBudget)}</span> total budget
            </p>
            {isCurrentMonth && (
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                {overCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300 font-semibold bg-red-100 dark:bg-red-900/30 rounded-full px-2.5 py-1">
                    <AlertTriangle className="h-3 w-3" /> {overCount} expense{overCount > 1 ? "s" : ""} over limit
                  </span>
                )}
                {warnCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold bg-amber-100 dark:bg-amber-900/30 rounded-full px-2.5 py-1">
                    <AlertTriangle className="h-3 w-3" /> {warnCount} near limit
                  </span>
                )}
                {savingsOver > 0 && (
                  <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-300 font-semibold bg-teal-100 dark:bg-teal-900/30 rounded-full px-2.5 py-1">
                    ✨ {savingsOver} savings goal{savingsOver > 1 ? "s" : ""} exceeded!
                  </span>
                )}
                {overCount === 0 && warnCount === 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-100 dark:bg-emerald-900/30 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="h-3 w-3" /> All expenses on track
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Budget</p>
          <p className="text-lg font-black tabular-nums text-slate-900 dark:text-white mt-0.5">{fmtK(totalBudget)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Spent</p>
          <p className={`text-lg font-black tabular-nums mt-0.5 ${overCount > 0 ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
            {fmtK(totalSpent)}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {totalLeft >= 0 ? "Remaining" : "Over budget"}
          </p>
          <p className={`text-lg font-black tabular-nums mt-0.5 ${totalLeft < 0 ? "text-red-600" : "text-emerald-600"}`}>
            {fmtK(Math.abs(totalLeft))}
          </p>
        </div>
      </div>

      {/* Month progress bar */}
      {isCurrentMonth && (
        <div className="px-5 pb-4 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Month progress</span>
            <span>{daysElapsed} of {daysInMonth} days · {daysLeft} left</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-300" style={{ width: `${monthPct}%`, transition: "width 1s ease" }} />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            You&apos;re {monthPct.toFixed(0)}% through the month
            {overallPct > monthPct + 10
              ? " · spending faster than the month is moving"
              : overallPct < monthPct - 10
              ? " · spending slower than expected — great work!"
              : " · spending at a healthy pace"
            }
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Quick-scan strip ─────────────────────────────────────────────────────────

function QuickScan({ budgets }: { budgets: EnrichedBudget[] }) {
  const sorted = [...budgets].sort((a, b) => {
    // Savings categories: over 100% floats to a "wins" section, not warnings
    const aScore = isSavings(a.category) ? 0 : a.percentUsed;
    const bScore = isSavings(b.category) ? 0 : b.percentUsed;
    return bScore - aScore;
  });

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {sorted.map((b) => {
        const label = CATEGORY_LABELS[b.category as keyof typeof CATEGORY_LABELS] ?? b.category;
        const saving = isSavings(b.category);
        const status =
          saving && b.percentUsed >= 100 ? "bg-teal-100 border-teal-200 text-teal-700 dark:bg-teal-900/30 dark:border-teal-800 dark:text-teal-300" :
          saving                          ? "bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400" :
          b.percentUsed >= 100            ? "bg-red-100 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300" :
          b.percentUsed >= 80             ? "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-300" :
                                            "bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300";
        return (
          <div key={b.id} className={`flex-shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${status}`}>
            <span>{catIcon(b.category)}</span>
            <span>{label}</span>
            <span className="tabular-nums opacity-75">
              {saving && b.percentUsed >= 100 ? "✨" : ""}{b.percentUsed.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function BudgetsList({ enrichedBudgets, topTxByCategory, month, year, isCurrentMonth, daysInMonth, daysLeft, daysElapsed }: Props) {
  const [budgets, setBudgets] = useState(enrichedBudgets);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EnrichedBudget | null>(null);
  const router = useRouter();

  if (budgets.length === 0) return null;

  async function handleDelete(id: string) {
    if (!confirm("Remove this budget?")) return;
    await fetch("/api/budgets", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBudgets((p) => p.filter((b) => b.id !== id));
    router.refresh();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleSaved(saved: any) {
    setBudgets((prev) => {
      const exists = prev.find((b) => b.id === saved.id || b.category === saved.category);
      if (exists)
        return prev.map((b) =>
          b.id === saved.id || b.category === saved.category
            ? { ...b, monthlyLimit: saved.monthlyLimit, id: saved.id } : b
        );
      return [...prev, {
        ...saved, spent: 0, remaining: parseFloat(saved.monthlyLimit), percentUsed: 0,
        dailyAllowance: 0, velocity: "none" as const,
        topMerchant: null, topMerchantAmount: 0,
      }];
    });
    setEditing(null);
    router.refresh();
  }

  // Sort: expense over-budget first, then expense warnings, then normal expenses, then savings last (celebrated separately)
  const sorted = [...budgets].sort((a, b) => {
    const score = (x: EnrichedBudget) => {
      if (isSavings(x.category)) return -10; // savings always at bottom (special section)
      return x.percentUsed;
    };
    return score(b) - score(a);
  });

  const existingCategories = budgets.map((b) => b.category);
  const allCategoriesSet = existingCategories.length >= 8;

  // Insight tip (exclude savings from expense warnings)
  const expenseBudgets = budgets.filter((b) => !isSavings(b.category));
  const overBudget     = expenseBudgets.filter((b) => b.percentUsed >= 100);
  const fastBurn       = expenseBudgets.find((b) => b.velocity === "fast");
  const savingsWins    = budgets.filter((b) => isSavings(b.category) && b.percentUsed >= 100);

  let tip = "";
  if (overBudget.length > 0) {
    tip = `${overBudget.map((b) => CATEGORY_LABELS[b.category as keyof typeof CATEGORY_LABELS] ?? b.category).join(", ")} has exceeded its limit. Consider adjusting or reducing spend in that category.`;
  } else if (savingsWins.length > 0) {
    const names = savingsWins.map((b) => CATEGORY_LABELS[b.category as keyof typeof CATEGORY_LABELS] ?? b.category).join(" & ");
    tip = `🎉 Amazing — you've exceeded your ${names} goal this month! That's your future self saying thank you.`;
  } else if (fastBurn) {
    tip = `${CATEGORY_LABELS[fastBurn.category as keyof typeof CATEGORY_LABELS] ?? fastBurn.category} is being spent faster than expected relative to the month. You still have time to slow down.`;
  } else {
    tip = "All expense categories are on track this month. You're in great shape — keep it up!";
  }

  return (
    <div className="space-y-5">
      <HealthBanner budgets={budgets} isCurrentMonth={isCurrentMonth} daysLeft={daysLeft} daysInMonth={daysInMonth} daysElapsed={daysElapsed} />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Category Status</p>
          {!allCategoriesSet && (
            <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 h-7 text-xs">
              <Plus className="h-3 w-3" /> Add Category
            </Button>
          )}
        </div>
        <QuickScan budgets={budgets} />
      </div>

      {isCurrentMonth && tip && (
        <div className="flex items-start gap-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 px-4 py-3.5">
          <TrendingUp className="h-4 w-4 text-indigo-500 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-0.5">AI Insight</p>
            <p className="text-sm text-indigo-700 dark:text-indigo-400 leading-relaxed">{tip}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Breakdown by Category</h2>
        <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
        <p className="text-xs text-slate-400 dark:text-slate-500">click any card to see transactions</p>
      </div>

      <div className="space-y-4">
        {sorted.map((b) => (
          <CategoryCard
            key={b.id} b={b}
            txList={topTxByCategory[b.category] ?? []}
            isCurrentMonth={isCurrentMonth} daysLeft={daysLeft}
            onEdit={() => setEditing(b)}
            onDelete={() => handleDelete(b.id)}
          />
        ))}
      </div>

      <BudgetFormDialog
        open={addOpen || !!editing}
        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditing(null); } }}
        onSaved={handleSaved} initial={editing}
        month={month} year={year} existingCategories={existingCategories}
      />
    </div>
  );
}
