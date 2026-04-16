"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function MonthNav({ month, year }: { month: number; year: number }) {
  const router = useRouter();

  function go(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    router.push(`/budgets?month=${m}&year=${y}`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={() => go(-1)} className="h-8 w-8 p-0">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" size="sm" onClick={() => go(1)} className="h-8 w-8 p-0">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
