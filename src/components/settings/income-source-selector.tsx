"use client";
import { useEffect, useState } from "react";

export function IncomeSourceSelector() {
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/income-sources/candidates").then((r) => r.json()),
      fetch("/api/income-sources").then((r) => r.json()),
    ]).then(([cands, current]: [string[], string[]]) => {
      setCandidates(cands);
      setSelected(new Set(current));
      setLoading(false);
    });
  }, []);

  const toggle = (d: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(d)) {
        next.delete(d);
      } else {
        next.add(d);
      }
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/income-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptions: Array.from(selected) }),
    });
    setSaving(false);
    setSaved(true);
  };

  const filtered = candidates.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="text-sm text-slate-400 p-4">Loading…</div>;
  if (candidates.length === 0)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        No positive transactions found yet. Sync your accounts or import a CSV first.
      </div>
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">Income Sources</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Select which transactions count as income. Only checked sources will be used in budgets, cash flow, and reports.
          {selected.size === 0 && (
            <span className="text-amber-500 ml-1">None selected — all positive transactions are counted.</span>
          )}
        </p>
      </div>

      <div className="px-6 py-3 border-b border-slate-100">
        <input
          type="text"
          placeholder="Search sources…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300"
        />
      </div>

      <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
        {filtered.map((d) => (
          <label
            key={d}
            className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(d)}
              onChange={() => toggle(d)}
              className="accent-indigo-600 w-4 h-4 flex-shrink-0"
            />
            <span className="text-sm text-slate-700 truncate">{d}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="px-6 py-4 text-sm text-slate-400">No matches for &quot;{search}&quot;</p>
        )}
      </div>

      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">{selected.size} source{selected.size !== 1 ? "s" : ""} selected</span>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  );
}
