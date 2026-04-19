import { auth } from "@/lib/auth";
import { getSpendingAverages, getMonthlyIncomeFromTransactions } from "@/lib/budgets";
import { suggestBudgets, BudgetSseEvent } from "@/lib/gemini";

// Force dynamic rendering so Next.js never caches this SSE route
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // Auto-detect monthly income from transaction history
  const incomeResult = await getMonthlyIncomeFromTransactions(session.user.id);
  if (!incomeResult || incomeResult.monthlyIncome <= 0) {
    return new Response(
      JSON.stringify({
        error:
          "No income transactions found. Add some income transactions first so the AI can calculate your budget.",
      }),
      { status: 422 }
    );
  }

  const { monthlyIncome, monthsUsed } = incomeResult;

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

  // Emit detected income as the first thinking line
  sendEvent({
    type: "thinking",
    text: `Detected monthly income: $${monthlyIncome.toLocaleString()} (avg over ${monthsUsed} month${monthsUsed !== 1 ? "s" : ""})\n`,
  });

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
