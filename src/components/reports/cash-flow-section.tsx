"use client";
import { useEffect, useState } from "react";
import { CashFlowSankey } from "./cash-flow-sankey";
import type { CashFlowData } from "@/lib/reports";

type Range = "this-month" | "last-month" | "last-3" | "last-6" | "this-year";

function getRangeDates(range: Range): { from: Date; to: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (range) {
    case "this-month":
      return {
        from: new Date(y, m, 1),
        to: new Date(y, m + 1, 0),
        label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      };
    case "last-month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      return {
        from: new Date(ly, lm, 1),
        to: new Date(ly, lm + 1, 0),
        label: new Date(ly, lm, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
      };
    }
    case "last-3":
      return {
        from: new Date(y, m - 2, 1),
        to: new Date(y, m + 1, 0),
        label: `${new Date(y, m - 2, 1).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })} – ${now.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
      };
    case "last-6":
      return {
        from: new Date(y, m - 5, 1),
        to: new Date(y, m + 1, 0),
        label: `${new Date(y, m - 5, 1).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })} – ${now.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
      };
    case "this-year":
      return {
        from: new Date(y, 0, 1),
        to: new Date(y, 11, 31),
        label: `Year ${y}`,
      };
  }
}

const RANGES: { value: Range; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "last-3", label: "Last 3 Months" },
  { value: "last-6", label: "Last 6 Months" },
  { value: "this-year", label: "This Year" },
];

export function CashFlowSection() {
  const [range, setRange] = useState<Range>("last-3");
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const { from, to } = getRangeDates(range);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];
    fetch(`/api/reports/cash-flow?from=${fromStr}&to=${toStr}`)
      .then((r) => r.json())
      .then((d: CashFlowData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [range]);

  const { label } = getRangeDates(range);

  return (
    <div className="space-y-3">
      {/* Range tabs */}
      <div className="flex gap-1 flex-wrap">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              range === r.value
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
            <span className="text-sm">Loading cash flow…</span>
          </div>
        </div>
      ) : data ? (
        <CashFlowSankey data={data} label={label} />
      ) : null}
    </div>
  );
}
