import { GoogleGenerativeAI } from "@google/generative-ai";

const VALID_CATEGORIES = [
  "Food", "Housing", "Transport", "Health",
  "Entertainment", "Shopping", "Income", "Other",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const clean = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const parsed: { index: number; category: string }[] = JSON.parse(clean);

    return transactions.map((_, i) => {
      const match = parsed.find((p) => p.index === i);
      const cat = match?.category as Category;
      return VALID_CATEGORIES.includes(cat) ? cat : "Other";
    });
  } catch {
    return transactions.map(() => "Other");
  }
}
