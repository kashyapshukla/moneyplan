import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listAccounts, listSnapshots, calcNetWorth } from "@/lib/accounts";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Net Worth</h1>
        <p className="text-sm text-slate-500 mt-1">Track all your assets and liabilities</p>
      </div>

      <NetWorthSummary
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        netWorth={netWorth}
      />

      <NetWorthChart snapshots={sortedSnapshots} />

      <AccountsList initialAccounts={accountList} />
    </div>
  );
}
