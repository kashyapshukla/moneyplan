"use client";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function DetectButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/recurring/detect", { method: "POST" });
      const { detected } = await res.json();
      setResult(`Found ${detected} recurring pattern${detected !== 1 ? "s" : ""}`);
      router.refresh();
    } catch {
      setResult("Detection failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={loading} variant="outline" size="sm" className="gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? "Detecting…" : "Detect Recurring"}
      </Button>
      {result && <span className="text-xs text-slate-500">{result}</span>}
    </div>
  );
}
