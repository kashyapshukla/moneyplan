"use client";

import { useState } from "react";
import type { CashFlowData } from "@/lib/reports";

// ── Category colours ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Food:          "#f97316",
  Housing:       "#3b82f6",
  Transport:     "#eab308",
  Health:        "#22c55e",
  Entertainment: "#a855f7",
  Shopping:      "#ec4899",
  Investment:    "#6366f1",
  Savings:       "#14b8a6",
  Other:         "#94a3b8",
};

const INCOME_COLOR  = "#10b981";
const SAVINGS_COLOR = "#10b981";

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? "#94a3b8";
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// ── Sankey geometry ───────────────────────────────────────────────────────────
// Layout: two columns separated by a gap.
// Left:  one "Income" node
// Right: expense categories (top→bottom by size) + "Net Savings" at the bottom

const COL_WIDTH  = 18;   // px width of each node bar
const COL_GAP    = 340;  // px between left and right column x positions
const NODE_GAP   = 8;    // px gap between right-column nodes
const SVG_H      = 480;  // total SVG height
const LABEL_PAD  = 6;    // gap between node bar and label text
const LEFT_X     = 40;   // x of income node
const RIGHT_X    = LEFT_X + COL_GAP; // x of right-column nodes

// Smooth cubic-bezier filled band between two node edges
function band(
  x1: number, y1: number, h1: number,   // source: x, top-y, height
  x2: number, y2: number, h2: number,   // target: x, top-y, height
  color: string,
  opacity: number,
  key: string
) {
  const cx1 = x1 + (x2 - x1) * 0.5;
  const cx2 = x1 + (x2 - x1) * 0.5;

  const top = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
  const right = `L ${x2} ${y2 + h2}`;
  const bot = `C ${cx2} ${y2 + h2}, ${cx1} ${y1 + h1}, ${x1} ${y1 + h1}`;
  const close = "Z";

  return (
    <path
      key={key}
      d={`${top} ${right} ${bot} ${close}`}
      fill={color}
      fillOpacity={opacity}
      stroke="none"
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = { data: CashFlowData; label: string };

export function CashFlowSankey({ data, label }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { totalIncome, totalExpenses, netSavings, savingsRate, byCategory } = data;

  if (totalIncome === 0 && totalExpenses === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-400">No transaction data for this period.</p>
      </div>
    );
  }

  const isDeficit = netSavings < 0;
  const DEFICIT_COLOR = "#ef4444";

  // Build right-column nodes: savings first (top), then expenses sorted desc
  const rightNodes: { label: string; amount: number; color: string; key: string }[] = [];

  if (netSavings > 0) {
    rightNodes.push({ label: "Net Savings", amount: netSavings, color: SAVINGS_COLOR, key: "savings" });
  }
  for (const cat of byCategory) {
    rightNodes.push({ label: cat.category, amount: cat.amount, color: catColor(cat.category), key: cat.category });
  }

  // Right side total = expenses (+ net savings if positive; deficit is shown separately)
  const rightTotal = rightNodes.reduce((s, n) => s + n.amount, 0) || 1;
  // Overall scale = whichever side is bigger
  const overallTotal = Math.max(totalIncome, rightTotal);

  // Right nodes always fill SVG_H so every category is visible
  const usableH = SVG_H - NODE_GAP * Math.max(0, rightNodes.length - 1);

  let runningY = 0;
  const rightLayout = rightNodes.map((n) => {
    const h = Math.max(4, (n.amount / rightTotal) * usableH);
    const y = runningY;
    runningY += h + NODE_GAP;
    return { ...n, y, h };
  });

  // Left node: proportionally shorter when income < expenses
  const leftNodeH = Math.max(4, (totalIncome / overallTotal) * SVG_H);
  const leftNodeY = 0;

  // Per-link offsets on source (left) node — stacked proportionally
  let srcOffset = 0;
  const links = rightLayout.map((n) => {
    // Each band takes its share of the left (income) node height
    const srcH = Math.max(2, (n.amount / rightTotal) * leftNodeH);
    const link = {
      key: n.key,
      srcY: leftNodeY + srcOffset,
      srcH,
      tgtY: n.y,
      tgtH: n.h,
      color: n.color,
    };
    srcOffset += srcH;
    return link;
  });

  const svgWidth = RIGHT_X + COL_WIDTH + 220; // room for right labels

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cash Flow</h2>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
          {/* Summary pills */}
          <div className="flex gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-slate-500">Income</span>
              <span className="font-bold text-slate-800 tabular-nums">{fmtCurrency(totalIncome)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              <span className="text-slate-500">Expenses</span>
              <span className="font-bold text-slate-800 tabular-nums">{fmtCurrency(totalExpenses)}</span>
            </div>
            {isDeficit ? (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-slate-500">Deficit</span>
                <span className="font-bold text-red-500 dark:text-red-400 tabular-nums">{fmtCurrency(Math.abs(netSavings))}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-100 rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                <span className="text-slate-500">Saved</span>
                <span className="font-bold text-slate-800 tabular-nums">{fmtPct(savingsRate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sankey SVG */}
      <div className="p-6 overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${SVG_H}`}
          width="100%"
          style={{ minWidth: 480, maxHeight: SVG_H }}
          aria-label="Cash flow Sankey diagram"
        >
          {/* ── Flowing bands ── */}
          {links.map((lk) =>
            band(
              LEFT_X + COL_WIDTH, lk.srcY, lk.srcH,
              RIGHT_X, lk.tgtY, lk.tgtH,
              lk.color,
              hovered === null ? 0.25 : hovered === lk.key ? 0.4 : 0.12,
              `band-${lk.key}`
            )
          )}

          {/* ── Left node: Income ── */}
          <rect
            x={LEFT_X} y={leftNodeY}
            width={COL_WIDTH} height={leftNodeH}
            rx={4} fill={INCOME_COLOR}
          />
          {/* Left label */}
          <text
            x={LEFT_X - LABEL_PAD} y={leftNodeH / 2}
            textAnchor="end" dominantBaseline="middle"
            fontSize={13} fontWeight={700} fill="#0f172a"
          >
            Income
          </text>
          <text
            x={LEFT_X - LABEL_PAD} y={leftNodeH / 2 + 16}
            textAnchor="end" dominantBaseline="middle"
            fontSize={11} fill="#64748b"
          >
            {fmtCurrency(totalIncome)}
          </text>

          {/* ── Right nodes + labels ── */}
          {rightLayout.map((n) => (
            <g
              key={n.key}
              onMouseEnter={() => setHovered(n.key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "default" }}
            >
              {/* Node bar */}
              <rect
                x={RIGHT_X} y={n.y}
                width={COL_WIDTH} height={n.h}
                rx={4} fill={n.color}
                opacity={hovered === null ? 1 : hovered === n.key ? 1 : 0.4}
              />
              {/* Label: name */}
              <text
                x={RIGHT_X + COL_WIDTH + LABEL_PAD}
                y={n.y + n.h / 2 - 7}
                dominantBaseline="middle"
                fontSize={12} fontWeight={700}
                fill={hovered === n.key ? n.color : "#0f172a"}
              >
                {n.label}
              </text>
              {/* Label: amount */}
              <text
                x={RIGHT_X + COL_WIDTH + LABEL_PAD}
                y={n.y + n.h / 2 + 9}
                dominantBaseline="middle"
                fontSize={11} fill="#64748b"
              >
                {fmtCurrency(n.amount)}
                {" "}
                <tspan fill="#94a3b8">
                  ({fmtPct((n.amount / rightTotal) * 100)})
                </tspan>
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Deficit banner */}
      {isDeficit && (
        <div className="mx-6 mb-4 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <span className="text-red-500 text-lg font-black">▼</span>
          <div>
            <p className="text-sm font-bold text-red-700">Deficit this period</p>
            <p className="text-xs text-red-500 mt-0.5">
              Expenses exceeded income by <span className="font-semibold">{fmtCurrency(Math.abs(netSavings))}</span>
            </p>
          </div>
          <span className="ml-auto text-xl font-black text-red-500 tabular-nums">{fmtCurrency(Math.abs(netSavings))}</span>
        </div>
      )}

      {/* Legend dots */}
      <div className="px-6 pb-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-50 pt-3">
        {rightLayout.map((n) => (
          <div
            key={n.key}
            className="flex items-center gap-1.5 text-xs text-slate-500 cursor-default"
            onMouseEnter={() => setHovered(n.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: n.color }} />
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}
