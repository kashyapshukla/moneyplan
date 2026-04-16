import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { getSpendingAverages } from "@/lib/budgets";
import { suggestBudgets, BudgetSseEvent } from "@/lib/gemini";

// Force dynamic rendering so Next.js never caches this SSE route
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  let body: { monthlyIncome?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 });
  }
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

  async function sendEvent(event: BudgetSseEvent) {
    await writer.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // Run agent in background, stream events
  suggestBudgets({
    monthlyIncome,
    spendingAverages: byCategory,
    confidence,
    onEvent: sendEvent,
  })
    .catch(() => {
      sendEvent({ type: "error", message: "Something went wrong. Please try again." });
    })
    .finally(() => {
      writer.close();
    });

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // Disable nginx/proxy buffering so chunks reach the client immediately
      "X-Accel-Buffering": "no",
    },
  });
}
