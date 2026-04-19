import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAccounts, listSnapshots } from "@/lib/accounts";
import { calcNetWorth } from "@/lib/account-types";
import { NetWorthSummary } from "@/components/net-worth/net-worth-summary";
import { NetWorthChart } from "@/components/net-worth/net-worth-chart";
import { AccountsList } from "@/components/net-worth/accounts-list";

export default async function NetWorthPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [accountList, snapshots] = await Promise.all([
    listAccounts(session.user.id),
    listSnapshots(session.user.id, 12),
  ]);

  const { totalAssets, totalLiabilities, netWorth } = calcNetWorth(accountList);
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
