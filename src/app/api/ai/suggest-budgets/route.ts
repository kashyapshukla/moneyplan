import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { getSpendingAverages } from "@/lib/budgets";
import { suggestBudgets, BudgetSseEvent } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const body = await req.json();
  const monthlyIncome = Number(body.monthlyIncome);

  if (!monthlyIncome || monthlyIncome <= 0) {
    return new Response(JSON.stringify({ error: "monthlyIncome is required" }), { status: 400 });
  }

  // Get spending history
  const { byCategory, confidence } = await getSpendingAverages(session.user.id);

  // Set up SSE stream
  const encoder = new TextEncoder();
  const stream = new TransformStream<string, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(chunk));
    },
  });

  const writer = stream.writable.getWriter();

  function sendEvent(event: BudgetSseEvent) {
    writer.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // Run agent in background, stream events
  suggestBudgets({
    monthlyIncome,
    spendingAverages: byCategory,
    confidence,
    onEvent: sendEvent,
  }).finally(() => {
    writer.close();
  });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
