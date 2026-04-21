import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAccounts, listSnapshots, saveNetWorthSnapshot } from "@/lib/accounts";
import { calcNetWorth } from "@/lib/account-types";
import { NetWorthSummary } from "@/components/net-worth/net-worth-summary";
import { NetWorthChart } from "@/components/net-worth/net-worth-chart";
import { AccountsList } from "@/components/net-worth/accounts-list";

export default async function NetWorthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const accountList = await listAccounts(session.user.id);
  const { totalAssets, totalLiabilities, netWorth } = calcNetWorth(accountList);

  // Save today's snapshot on every page visit (idempotent — updates if already exists).
  // This ensures the chart starts building history immediately without requiring
  // the user to manually edit account balances.
  await saveNetWorthSnapshot(session.user.id, totalAssets, totalLiabilities);

  const snapshots = await listSnapshots(session.user.id, 12);
  const sortedSnapshots = [...snapshots].reverse(); // oldest → newest

  return (
    <div>
      {/* Full-width header + chart */}
      <NetWorthChart
        snapshots={sortedSnapshots}
        netWorth={netWorth}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
      />

      {/* Two-column: accounts left (~65%), summary right (~35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <AccountsList initialAccounts={accountList} />
        </div>
        <div>
          <NetWorthSummary accounts={accountList} />
        </div>
      </div>
    </div>
  );
}
