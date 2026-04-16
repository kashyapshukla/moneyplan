"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddTransactionDialog } from "./add-transaction-dialog";
import { CsvUploadDialog } from "./csv-upload-dialog";
import { useRouter } from "next/navigation";

export function TransactionsActions() {
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();

  function handleSaved() {
    setAddOpen(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <CsvUploadDialog onImported={() => router.refresh()} />
      <Button className="gap-2" onClick={() => setAddOpen(true)}>
        <Plus className="h-4 w-4" />
        Add
      </Button>
      <AddTransactionDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={handleSaved}
      />
    </div>
  );
}
