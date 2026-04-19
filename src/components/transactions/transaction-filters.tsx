"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";

const CATEGORIES = [
  "All", "Food", "Housing", "Transport", "Health",
  "Entertainment", "Shopping", "Income",
  "Investment", "Savings", "Transfer", "Other",
];

export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "All") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search transactions..."
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400 w-64"
        />
      </div>

      <select
        value={searchParams.get("category") ?? "All"}
        onChange={(e) => updateFilter("category", e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
      >
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <input
        type="date"
        defaultValue={searchParams.get("dateFrom") ?? ""}
        onChange={(e) => updateFilter("dateFrom", e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
      />
      <span className="text-slate-400 text-sm">to</span>
      <input
        type="date"
        defaultValue={searchParams.get("dateTo") ?? ""}
        onChange={(e) => updateFilter("dateTo", e.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
      />
    </div>
  );
}
