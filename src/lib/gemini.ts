const VALID_CATEGORIES = [
  "Food", "Housing", "Transport", "Health",
  "Entertainment", "Shopping", "Income",
  "Investment", "Savings", "Transfer", "Other",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

// Google AI Studio endpoint — works with GEMINI_API_KEY from aistudio.google.com
// (Vertex AI endpoint requires OAuth2 service accounts, not API keys)
function geminiUrl(model = "gemini-2.5-flash-lite") {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
}

export async function categorizeTransactions(
  transactions: { description: string; amount: number }[]
): Promise<Category[]> {
  if (transactions.length === 0) return [];

  const prompt = `You are a smart personal finance assistant. Categorize each bank transaction into exactly one of these categories:
Food, Housing, Transport, Health, Entertainment, Shopping, Income, Investment, Savings, Transfer, Other.

Rules:
- Transfer (HIGHEST PRIORITY — check this FIRST):
    • Credit card payments: "PAYMENT THANK YOU", "AUTOPAY", "ONLINE PMT", "CREDIT CARD PAYMENT", "CARD PAYMENT", "MINIMUM PAYMENT", any description containing "payment" on a credit account
    • Bank-to-bank moves: "TRANSFER TO", "TRANSFER FROM", "ACCOUNT TRANSFER", "WIRE TRANSFER", "ACH TRANSFER", "ZELLE TO", "VENMO CASHOUT", "PAYPAL TRANSFER"
    • Internal moves: moving money between your own checking/savings/investment accounts
    • Rule: if it looks like money moving between accounts you own, it is Transfer — NOT an expense or income
- Positive amounts = money coming IN → "Income" or "Transfer" (if it's a payment received between own accounts)
- Negative amounts = money going OUT → pick the best expense category, or Transfer if paying a credit card
- Income: salary, payroll, DIRECT DEP, employer deposits, tax refunds, dividends, interest earned
- Investment: Robinhood, Fidelity, Vanguard, Schwab, TD Ameritrade, E*TRADE, Coinbase, stock/ETF purchases, crypto buys
- Savings: deposits to savings account, high-yield savings (Marcus, Ally, SoFi), emergency fund contributions
- Food: restaurants, groceries, Starbucks, McDonald's, Whole Foods, DoorDash, Uber Eats
- Housing: rent, utilities (electric, gas, water), internet, home insurance, HOA
- Transport: Uber, Lyft, gas stations, parking, tolls, car insurance, public transit
- Health: CVS, Walgreens, hospitals, doctor, dentist, gym, health insurance
- Entertainment: Netflix, Spotify, Disney+, Apple TV, concerts, movies, games
- Shopping: Amazon, Target, Walmart, clothing stores, online retail
- Other: anything that does not clearly fit the above

Transactions:
${transactions.map((t, i) => `${i}. "${t.description}" (${t.amount > 0 ? "+" : ""}${t.amount})`).join("\n")}

Reply ONLY with a JSON array like: [{"index": 0, "category": "Investment"}, ...]
No explanation, no markdown, just the JSON array.`;

  try {
    const res = await fetch(geminiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) {
      console.error("Gemini API error:", await res.text());
      return transactions.map(() => "Other");
    }

    const json = await res.json();
    const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const clean = text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed: { index: number; category: string }[] = JSON.parse(clean);

    return transactions.map((_, i) => {
      const match = parsed.find((p) => p.index === i);
      const cat = match?.category as Category;
      return VALID_CATEGORIES.includes(cat) ? cat : "Other";
    });
  } catch (err) {
    console.error("Gemini categorization failed:", err);
    return transactions.map(() => "Other");
  }
}

// ── Budget suggestion types ──────────────────────────────────────────────────

export type ProposedBudget = {
  category: string;
  suggestedLimit: number;
  reasoning: string;
  source: "actual" | "rule";
};

export type BudgetSseEvent =
  | { type: "thinking"; text: string }
  | { type: "proposal"; budgets: ProposedBudget[] }
  | { type: "done" }
  | { type: "error"; message: string };

// ── suggestBudgets ────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  "Food", "Housing", "Transport", "Entertainment", "Shopping", "Investment", "Savings", "Other",
] as const;

export async function suggestBudgets({
  monthlyIncome,
  spendingAverages,
  confidence,
  onEvent,
}: {
  monthlyIncome: number;
  spendingAverages: Record<string, number>;
  confidence: "high" | "low";
  onEvent: (event: BudgetSseEvent) => void;
}): Promise<void> {
  const categoryLines = EXPENSE_CATEGORIES.map((cat) => {
    const avg = spendingAverages[cat];
    return avg
      ? `- ${cat}: $${avg}/month (actual average from last 3 months)`
      : `- ${cat}: no data`;
  }).join("\n");

  const prompt = `You are a personal finance AI helping set up a monthly budget.

User monthly income: $${monthlyIncome}
Spending history confidence: ${confidence} (${confidence === "high" ? ">=10 transactions" : "<10 transactions — lean on income-based rules"})

Last 3-month average spending by expense category:
${categoryLines}

Rules:
- Total budget limits must not exceed 80% of income ($${Math.round(monthlyIncome * 0.8)}) so the user saves at least 20%
- For categories WITH actual data and high confidence: stay within 10% of the actual average (round to nearest $10)
- For categories WITHOUT data or low confidence: use 50/30/20 framework — needs (Food, Housing, Transport) get 50% of income split proportionally, wants (Entertainment, Shopping) get 30% split proportionally
- Housing is a "need". Food and Transport are "needs". Entertainment, Shopping, Other are "wants". Investment and Savings are "savings goals" — recommend at least 10% of income combined.
- Always include exactly these 8 expense categories: Food, Housing, Transport, Entertainment, Shopping, Investment, Savings, Other
- Round every limit to nearest $10

IMPORTANT: Output the <proposal> JSON array FIRST, then explain your reasoning after it.

<proposal>
[
  {"category":"Food","suggestedLimit":530,"reasoning":"Based on your $480 average spend, with a small buffer","source":"actual"},
  {"category":"Housing","suggestedLimit":1200,"reasoning":"No data — allocated 30% of needs budget","source":"rule"},
  {"category":"Transport","suggestedLimit":200,"reasoning":"No data — allocated proportionally from needs","source":"rule"},
  {"category":"Entertainment","suggestedLimit":300,"reasoning":"No data — 50/30/20 wants allocation","source":"rule"},
  {"category":"Shopping","suggestedLimit":300,"reasoning":"No data — 50/30/20 wants allocation","source":"rule"},
  {"category":"Investment","suggestedLimit":400,"reasoning":"Recommended 10% of income for long-term growth","source":"rule"},
  {"category":"Savings","suggestedLimit":200,"reasoning":"Emergency fund and short-term savings goal","source":"rule"},
  {"category":"Other","suggestedLimit":150,"reasoning":"Remaining budget for miscellaneous expenses","source":"rule"}
]
</proposal>

Then briefly explain your reasoning for each category (1-2 sentences each).`;

  try {
    const res = await fetch(geminiUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini suggest-budgets error:", errText);
      onEvent({ type: "error", message: "AI service unavailable. Please try again." });
      return;
    }

    const json = await res.json();
    const fullText: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!fullText) {
      onEvent({ type: "error", message: "Empty response from AI. Please try again." });
      return;
    }

    // ── Extract JSON from the response ───────────────────────────────────────
    // Prompt asks Gemini to output <proposal> FIRST so it's always captured
    // even if the response gets truncated. Fallbacks handle other formats.

    let rawJson: string | null = null;
    let thinkingText = "";

    // Strategy 1: <proposal>...</proposal> tags (expected — proposal comes first now)
    const proposalTagMatch = fullText.match(/<proposal>([\s\S]*?)<\/proposal>/i);
    if (proposalTagMatch) {
      rawJson = proposalTagMatch[1].trim();
      // Reasoning text comes AFTER the proposal block
      const afterProposal = fullText.slice(
        fullText.toLowerCase().indexOf("</proposal>") + "</proposal>".length
      ).trim();
      thinkingText = afterProposal || fullText.slice(0, fullText.toLowerCase().indexOf("<proposal>")).trim();
    }

    // Strategy 2: ```json ... ``` or ``` ... ``` code block
    if (!rawJson) {
      const codeBlockMatch = fullText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/i);
      if (codeBlockMatch) {
        rawJson = codeBlockMatch[1].trim();
        thinkingText = fullText.replace(codeBlockMatch[0], "").trim();
      }
    }

    // Strategy 3: find the first [ ... ] JSON array anywhere in the text
    if (!rawJson) {
      const arrayMatch = fullText.match(/(\[[\s\S]*?\])/);
      if (arrayMatch) {
        rawJson = arrayMatch[1].trim();
        thinkingText = fullText.replace(arrayMatch[1], "").trim();
      }
    }

    if (!rawJson) {
      console.error("suggestBudgets: no JSON found in response:", fullText.slice(0, 500));
      onEvent({ type: "error", message: "AI did not return a budget proposal. Please try again." });
      return;
    }

    // Strip any residual markdown (Gemini sometimes nests ```json inside <proposal>)
    const cleanJson = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error("suggestBudgets: JSON.parse failed on:", cleanJson.slice(0, 200));
      onEvent({ type: "error", message: "AI returned malformed JSON. Please try again." });
      return;
    }

    if (!Array.isArray(parsed)) {
      onEvent({ type: "error", message: "AI returned an unexpected format. Please try again." });
      return;
    }

    const validCategories = new Set(EXPENSE_CATEGORIES as readonly string[]);

    // Normalise items — Gemini returns suggestedLimit as string or number,
    // source as non-standard values, and sometimes omits reasoning entirely
    const normalised: ProposedBudget[] = (parsed as Record<string, unknown>[])
      .filter((b) =>
        typeof b.category === "string" && validCategories.has(b.category) &&
        isFinite(Number(b.suggestedLimit)) && Number(b.suggestedLimit) >= 0
        // reasoning is optional — don't reject items that omit it
      )
      .map((b) => ({
        category: b.category as string,
        // Coerce to number in case Gemini returns a string like "530"
        suggestedLimit: Math.round(Number(b.suggestedLimit) / 10) * 10,
        reasoning: typeof b.reasoning === "string" ? b.reasoning : "",
        // Normalise source — "actual" / "histor" → "actual", everything else → "rule"
        source: String(b.source ?? "rule").toLowerCase().includes("actual") ||
                String(b.source ?? "rule").toLowerCase().includes("histor")
          ? "actual" : "rule",
      }));

    if (normalised.length === 0) {
      console.error("suggestBudgets: no valid categories in parsed array:", parsed);
      onEvent({ type: "error", message: "AI did not return valid budget categories. Please try again." });
      return;
    }

    // Stream the reasoning text AFTER we've confirmed the proposal is valid
    // (proposal comes first in response so JSON is never cut off by token limit)
    if (thinkingText) {
      const words = thinkingText.split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += 5) {
        onEvent({ type: "thinking", text: words.slice(i, i + 5).join(" ") + " " });
        await new Promise((r) => setTimeout(r, 20));
      }
    }

    onEvent({ type: "proposal", budgets: normalised });
    onEvent({ type: "done" });
  } catch (err) {
    console.error("suggestBudgets error:", err);
    onEvent({ type: "error", message: "Something went wrong generating your budget." });
  }
}
