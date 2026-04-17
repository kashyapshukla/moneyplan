// Pure constants and helpers — no DB imports, safe to use in client components

export type AccountType =
  | "checking" | "savings" | "credit" | "investment"
  | "crypto" | "real_estate" | "loan" | "retirement" | "vehicle";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit Card",
  investment: "Investment",
  crypto: "Crypto",
  real_estate: "Real Estate",
  loan: "Loan",
  retirement: "Retirement",
  vehicle: "Vehicle",
};

export const LIABILITY_TYPES: AccountType[] = ["credit", "loan"];
export const ASSET_TYPES: AccountType[] = [
  "checking", "savings", "investment", "crypto", "real_estate", "retirement", "vehicle",
];

export function calcNetWorth(accountList: { type: string; balance: string }[]) {
  let totalAssets = 0;
  let totalLiabilities = 0;
  for (const a of accountList) {
    const bal = parseFloat(a.balance);
    if (LIABILITY_TYPES.includes(a.type as AccountType)) {
      totalLiabilities += Math.abs(bal);
    } else {
      totalAssets += bal;
    }
  }
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
}
