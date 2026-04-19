import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCashFlowData } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to)
    return NextResponse.json({ error: "Missing from/to" }, { status: 400 });

  const data = await getCashFlowData(session.user.id, new Date(from), new Date(to));
  return NextResponse.json(data);
}
