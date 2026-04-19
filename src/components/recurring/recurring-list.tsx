"use client";
import { useState } from "react";
import { Tag, X } from "lucide-react";

type RecurringItem = {
  id: string;
  displayName: string;
  amount: number;
  category: string;
  frequency: "weekly" | "biweekly" | "monthly" | "annual";
  dayOfMonth: number | null;
  nextExpected: string | null;
  isSubscription: boolean;
};

const FREQ_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  annual: "Annual",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function toMonthly(amount: number, freq: string): number {
  if (freq === "weekly") return (amount * 52) / 12;
  if (freq === "biweekly") return (amount * 26) / 12;
  if (freq === "annual") return amount / 12;
  return amount;
}

function ItemRow({
  item,
  onToggle,
}: {
  item: RecurringItem;
  onToggle: (id: string, field: "isSubscription" | "isActive", value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.displayName}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {FREQ_LABEL[item.frequency]}
          {item.dayOfMonth && item.frequency === "monthly" ? ` · ~day ${item.dayOfMonth}` : ""}
          {item.nextExpected
            ? ` · next ${new Date(item.nextExpected).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : ""}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold tabular-nums text-slate-900">{fmt(item.amount)}</p>
        <p className="text-xs text-slate-400">{fmt(toMonthly(item.amount, item.frequency))}/mo</p>
      </div>
      <div className="flex items-center gap-1">
        {!item.isSubscription && (
          <button
            onClick={() => onToggle(item.id, "isSubscription", true)}
            className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors font-medium"
            title="Mark as subscription"
          >
            <Tag className="h-3 w-3" />
          </button>
        )}
        <button
          onClick={() => onToggle(item.id, "isActive", false)}
          className="text-xs px-1.5 py-1 rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function RecurringList({ initialItems }: { initialItems: RecurringItem[] }) {
  const [items, setItems] = useState(initialItems);

  async function toggle(id: string, field: "isSubscription" | "isActive", value: boolean) {
    // Save previous state for revert
    const previous = items;
    // Optimistic update
    setItems((prev) =>
      field === "isActive"
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
    try {
      const res = await fetch("/api/recurring", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      // Revert on failure
      setItems(previous);
    }
  }

  const subscriptions = items.filter((i) => i.isSubscription);
  const bills = items.filter((i) => !i.isSubscription);

  const monthlySubscriptionTotal = subscriptions.reduce(
    (s, i) => s + toMonthly(i.amount, i.frequency),
    0
  );
  const monthlyBillTotal = bills.reduce(
    (s, i) => s + toMonthly(i.amount, i.frequency),
    0
  );

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
        <p className="text-slate-400 text-sm">No recurring transactions detected yet.</p>
        <p className="text-slate-400 text-xs mt-1">
          Click &quot;Detect Recurring&quot; to scan your transactions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {subscriptions.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Subscriptions</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {subscriptions.length} active · {fmt(monthlySubscriptionTotal)}/mo ·{" "}
                {fmt(monthlySubscriptionTotal * 12)}/yr
              </p>
            </div>
          </div>
          {subscriptions.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={toggle} />
          ))}
        </div>
      )}

      {bills.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Recurring Bills</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {bills.length} detected · {fmt(monthlyBillTotal)}/mo committed
              </p>
            </div>
          </div>
          {bills.map((item) => (
            <ItemRow key={item.id} item={item} onToggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}
