import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Papa from "papaparse";
import { categorizeTransactions } from "@/lib/gemini";
import { checkDuplicate, createTransaction } from "@/lib/transactions";

function detectColumns(headers: string[]): {
  dateCol: string | null;
  amountCol: string | null;
  descCol: string | null;
} {
  const h = headers.map((x) => x.toLowerCase().trim());

  const dateCol = headers[h.findIndex((x) => x.includes("date"))] ?? null;
  const amountCol =
    headers[
      h.findIndex((x) => x.includes("amount") || x.includes("debit") || x.includes("credit"))
    ] ?? null;
  const descCol =
    headers[
      h.findIndex(
        (x) =>
          x.includes("description") ||
          x.includes("narration") ||
          x.includes("memo") ||
          x.includes("details") ||
          x.includes("particulars")
      )
    ] ?? null;

  return { dateCol, amountCol, descCol };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const text = await file.text();
  const { data, meta } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = meta.fields ?? [];
  const { dateCol, amountCol, descCol } = detectColumns(headers);

  if (!dateCol || !amountCol || !descCol) {
    return NextResponse.json(
      {
        error: "Could not detect columns",
        detectedHeaders: headers,
        hint: "CSV needs columns for date, amount, and description/memo/narration",
      },
      { status: 422 }
    );
  }

  const rows = data
    .map((row) => ({
      date: new Date(row[dateCol]),
      amount: parseFloat(row[amountCol].replace(/[^0-9.-]/g, "")),
      description: row[descCol]?.trim() ?? "",
    }))
    .filter((r) => !isNaN(r.date.getTime()) && !isNaN(r.amount) && r.description.length > 0);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found in CSV" }, { status: 422 });
  }

  const dupeChecks = await Promise.all(
    rows.map((r) =>
      checkDuplicate(session.user!.id!, r.description, String(r.amount), r.date)
    )
  );
  const newRows = rows.filter((_, i) => !dupeChecks[i]);
  const skipped = rows.length - newRows.length;

  if (newRows.length === 0) {
    return NextResponse.json({ imported: 0, skipped, message: "All rows already imported" });
  }

  const categories = await categorizeTransactions(
    newRows.map((r) => ({ description: r.description, amount: r.amount }))
  );

  const created = await Promise.all(
    newRows.map((row, i) =>
      createTransaction({
        userId: session.user!.id!,
        amount: String(row.amount),
        date: row.date,
        description: row.description,
        category: categories[i],
        source: "csv_upload",
      })
    )
  );

  return NextResponse.json({ imported: created.length, skipped });
}
