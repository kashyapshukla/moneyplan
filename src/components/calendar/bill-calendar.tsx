"use client";
import { useState } from "react";
import type { CalendarDay } from "@/lib/calendar";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BillCalendar({ days }: { days: CalendarDay[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm">
        No recurring items detected yet. Go to{" "}
        <a href="/recurring" className="text-indigo-600 underline">
          Recurring &amp; Subscriptions
        </a>{" "}
        and click &quot;Detect Recurring&quot;.
      </div>
    );
  }

  // Group by month
  const monthMap = new Map<string, CalendarDay[]>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(day);
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const selected = selectedDate ? days.find((d) => d.date === selectedDate) : null;

  return (
    <div className="space-y-6">
      {Array.from(monthMap.entries()).map(([monthKey, monthDays]) => {
        const [year, month] = monthKey.split("-").map(Number);
        const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
        const totalBills = monthDays.reduce(
          (s, d) => s + d.bills.reduce((b, i) => b + i.amount, 0),
          0
        );
        const totalIncome = monthDays.reduce(
          (s, d) => s + d.income.reduce((b, i) => b + i.amount, 0),
          0
        );

        return (
          <div key={monthKey} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {/* Month header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">{monthLabel}</h3>
              <div className="flex items-center gap-4 text-xs">
                {totalIncome > 0 && (
                  <span className="text-emerald-600 font-semibold">+{fmt(totalIncome)} income</span>
                )}
                {totalBills > 0 && (
                  <span className="text-red-500 font-semibold">−{fmt(totalBills)} bills</span>
                )}
              </div>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 px-4 pt-3 pb-1">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1 px-4 pb-4">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {monthDays.map((day) => {
                const dayNum = new Date(day.date + "T12:00:00").getDate();
                const hasBills = day.bills.length > 0;
                const hasIncome = day.income.length > 0;
                const isToday = day.date === todayStr;
                const isSelected = day.date === selectedDate;
                const billTotal = day.bills.reduce((s, b) => s + b.amount, 0);

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => setSelectedDate(isSelected ? null : day.date)}
                    className={`rounded-lg p-1.5 min-h-[52px] text-left transition-colors ${
                      isSelected
                        ? "bg-indigo-100 ring-2 ring-indigo-400"
                        : isToday
                        ? "bg-indigo-50 ring-1 ring-indigo-200"
                        : hasBills || hasIncome
                        ? "hover:bg-slate-50 cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <span
                      className={`text-xs font-medium block text-center mb-1 ${
                        isToday ? "text-indigo-700" : "text-slate-600"
                      }`}
                    >
                      {dayNum}
                    </span>
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {hasIncome && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      )}
                      {day.bills.slice(0, 3).map((_, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                      ))}
                    </div>
                    {hasBills && (
                      <p className="text-[9px] text-center text-slate-500 mt-0.5 tabular-nums">
                        −{fmt(billTotal)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected day detail */}
            {selected && selected.date.startsWith(monthKey) && (
              <div className="mx-4 mb-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-700 mb-2">
                  {new Date(selected.date + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {selected.income.map((i, idx) => (
                  <div key={idx} className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-700">↑ {i.name}</span>
                    <span className="font-semibold text-emerald-700">+{fmt(i.amount)}</span>
                  </div>
                ))}
                {selected.bills.map((b, idx) => (
                  <div key={idx} className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600">↓ {b.name}</span>
                    <span className="font-semibold text-red-600">−{fmt(b.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
