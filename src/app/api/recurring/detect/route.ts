import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { detectRecurring } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const count = await detectRecurring(session.user.id);
  return NextResponse.json({ detected: count });
}
