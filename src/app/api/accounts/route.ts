import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  calcNetWorth,
  saveNetWorthSnapshot,
  AccountType,
} from "@/lib/accounts";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const accts = await listAccounts(session.user.id);
  return NextResponse.json(accts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const account = await createAccount({
    userId: session.user.id,
    name: body.name,
    type: body.type as AccountType,
    balance: String(body.balance),
    currency: body.currency,
  });

  // Save snapshot after any balance change
  const all = await listAccounts(session.user.id);
  const { totalAssets, totalLiabilities } = calcNetWorth(all);
  await saveNetWorthSnapshot(session.user.id, totalAssets, totalLiabilities);

  return NextResponse.json(account, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...data } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const account = await updateAccount(id, session.user.id, {
    name: data.name,
    type: data.type,
    balance: data.balance !== undefined ? String(data.balance) : undefined,
  });

  // Save snapshot after balance update
  const all = await listAccounts(session.user.id);
  const { totalAssets, totalLiabilities } = calcNetWorth(all);
  await saveNetWorthSnapshot(session.user.id, totalAssets, totalLiabilities);

  return NextResponse.json(account);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await deleteAccount(id, session.user.id);

  const all = await listAccounts(session.user.id);
  const { totalAssets, totalLiabilities } = calcNetWorth(all);
  await saveNetWorthSnapshot(session.user.id, totalAssets, totalLiabilities);

  return NextResponse.json({ success: true });
}
