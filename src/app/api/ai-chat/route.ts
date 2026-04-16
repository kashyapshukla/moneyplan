import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/dashboard";
import { listAccounts, calcNetWorth } from "@/lib/accounts";

const VERTEX_ENDPOINT =
  "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-lite:generateContent";

type Message = { role: "user" | "model"; content: string };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages } = (await req.json()) as { messages: Message[] };

  // Pull financial context for the system prompt
  const [dashData, accountList] = await Promise.all([
    getDashboardData(session.user.id),
    listAccounts(session.user.id),
  ]);

  const { totalAssets, totalLiabilities, netWorth } = calcNetWorth(accountList);

  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const systemContext = `You are a helpful personal finance AI assistant for MoneyPlan.
Today is ${now.toDateString()}.

Here is the user's current financial snapshot for ${monthName}:
- Net Worth: $${netWorth.toFixed(2)} (Assets: $${totalAssets.toFixed(2)}, Liabilities: $${totalLiabilities.toFixed(2)})
- Monthly Income: $${dashData.totalIncome.toFixed(2)}
- Monthly Expenses: $${dashData.totalExpenses.toFixed(2)}
- Savings Rate: ${dashData.totalIncome > 0 ? ((( dashData.totalIncome - dashData.totalExpenses) / dashData.totalIncome) * 100).toFixed(1) : 0}%
- Budget Health Score: ${dashData.healthScore}/100
- Accounts: ${accountList.map((a) => `${a.name} (${a.type}): $${a.balance}`).join(", ") || "None"}
- Budgets this month: ${
    dashData.budgetsWithSpending.length > 0
      ? dashData.budgetsWithSpending
          .map((b) => `${b.category}: spent $${b.spent.toFixed(2)} of $${parseFloat(b.monthlyLimit).toFixed(2)}`)
          .join(", ")
      : "No budgets set"
  }
- Top spending categories: ${
    Object.entries(dashData.spendingByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, amt]) => `${cat}: $${amt.toFixed(2)}`)
      .join(", ") || "No spending recorded"
  }

Be concise, friendly, and actionable. Give personalized advice based on their actual data.
If asked about something outside personal finance, politely redirect to financial topics.`;

  // Convert messages to Gemini format
  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  // Prepend system context as first user message if not already there
  const allContents = [
    { role: "user", parts: [{ text: systemContext }] },
    { role: "model", parts: [{ text: "I'm ready to help you with your finances! What would you like to know?" }] },
    ...contents,
  ];

  try {
    const res = await fetch(`${VERTEX_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: allContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini AI Chat error:", err);
      return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
    }

    const json = await res.json();
    const reply: string =
      json.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I couldn't generate a response.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("AI Chat error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
