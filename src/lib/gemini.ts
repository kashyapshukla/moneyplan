const VALID_CATEGORIES = [
  "Food", "Housing", "Transport", "Health",
  "Entertainment", "Shopping", "Income", "Other",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

const VERTEX_ENDPOINT =
  "https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash-lite:generateContent";

export async function categorizeTransactions(
  transactions: { description: string; amount: number }[]
): Promise<Category[]> {
  if (transactions.length === 0) return [];

  const prompt = `Categorize each transaction into exactly one of these categories:
Food, Housing, Transport, Health, Entertainment, Shopping, Income, Other.

Transactions:
${transactions.map((t, i) => `${i}. "${t.description}" amount: ${t.amount}`).join("\n")}

Reply ONLY with a JSON array like: [{"index": 0, "category": "Food"}, ...]
No explanation, no markdown, just the JSON array.`;

  try {
    const res = await fetch(`${VERTEX_ENDPOINT}?key=${process.env.GEMINI_API_KEY}`, {
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
