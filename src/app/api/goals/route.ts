import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listGoals, createGoal, deleteGoal } from "@/lib/goals";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await listGoals(session.user.id);
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  if (!data.name || !data.type) {
    return NextResponse.json({ error: "name and type required" }, { status: 400 });
  }
  const goal = await createGoal(session.user.id, data);
  return NextResponse.json(goal);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteGoal(id, session.user.id);
  return NextResponse.json({ ok: true });
}
