import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listRecurring } from "@/lib/recurring";
import { RecurringList } from "@/components/recurring/recurring-list";
import { DetectButton } from "@/components/recurring/detect-button";

export default async function RecurringPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const items = await listRecurring(session.user.id);

  const monthlyCommitted = items.reduce((s, i) => {
    const monthly =
      i.frequency === "weekly"
        ? (i.amount * 52) / 12
        : i.frequency === "annual"
        ? i.amount / 12
        : i.amount;
    return s + monthly;
  }, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recurring &amp; Subscriptions</h1>
          <p className="text-sm text-slate-500 mt-1">
            {items.length} detected ·{" "}
            <span className="font-semibold text-slate-700">{fmt(monthlyCommitted)}/mo</span> committed
            spend ·{" "}
            <span className="font-semibold text-slate-700">{fmt(monthlyCommitted * 12)}/yr</span>
          </p>
        </div>
        <DetectButton />
      </div>

      <RecurringList
        initialItems={items.map((i) => ({
          id: i.id,
          displayName: i.displayName,
          amount: i.amount,
          category: i.category,
          frequency: i.frequency,
          dayOfMonth: i.dayOfMonth,
          nextExpected: i.nextExpected?.toISOString() ?? null,
          isSubscription: i.isSubscription,
        }))}
      />
    </div>
  );
}
