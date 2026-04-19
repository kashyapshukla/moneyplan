"use client";

import { useState } from "react";
import { Plus, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTransactionDialog } from "./add-transaction-dialog";
import { CsvUploadDialog } from "./csv-upload-dialog";
import { useRouter } from "next/navigation";

export function TransactionsActions() {
  const [addOpen, setAddOpen] = useState(false);
  const [recatLoading, setRecatLoading] = useState(false);
  const [recatResult, setRecatResult] = useState<string | null>(null);
  const router = useRouter();

  function handleSaved() {
    setAddOpen(false);
    router.refresh();
  }

  async function handleRecategorize() {
    setRecatLoading(true);
    setRecatResult(null);
    try {
      const res = await fetch("/api/ai/recategorize-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecatResult(`✓ ${data.updated} unreviewed transactions categorized`);
      router.refresh();
    } catch {
      setRecatResult("Failed. Please try again.");
    } finally {
      setRecatLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <CsvUploadDialog onImported={() => router.refresh()} />

        <Button
          variant="outline"
          className="gap-2"
          onClick={handleRecategorize}
          disabled={recatLoading}
          title="AI categorizes only unreviewed transactions — verified ones are never touched"
        >
          {recatLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-violet-500" />
          )}
          {recatLoading ? "Categorizing…" : "AI Fix Categories"}
        </Button>

        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {recatResult && (
        <p className={`text-xs ${recatResult.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
          {recatResult}
        </p>
      )}

      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}
