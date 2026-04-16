"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, ArrowRight } from "lucide-react";

export function CsvStep({ onNext }: { onNext: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/transactions/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      setUploaded(true);
    } catch {
      setError("Upload failed. You can skip and add transactions manually later.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Import your transactions</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload a bank CSV so the AI can build a budget based on your real spending. You can skip this and do it later.
        </p>
      </div>

      <div
        className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-8 w-8 text-slate-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600">
          {uploaded ? "✅ Transactions imported!" : "Click to upload a CSV file"}
        </p>
        <p className="text-xs text-slate-400 mt-1">Supports exports from most banks</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onNext} className="flex-1">
          Skip for now
        </Button>
        <Button
          onClick={onNext}
          disabled={uploading}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700"
        >
          {uploading ? "Uploading..." : uploaded ? "Continue →" : <><ArrowRight className="h-4 w-4 mr-1" /> Continue</>}
        </Button>
      </div>
    </div>
  );
}
