import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listSnapshots } from "@/lib/accounts";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshots = await listSnapshots(session.user.id, 12);
  return NextResponse.json(snapshots.reverse()); // oldest → newest for charting
}
