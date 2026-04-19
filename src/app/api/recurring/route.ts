import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listRecurring, updateRecurring } from "@/lib/recurring";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listRecurring(session.user.id);
  return NextResponse.json(items);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, ...data } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await updateRecurring(id, session.user.id, data);
  return NextResponse.json({ ok: true });
}
