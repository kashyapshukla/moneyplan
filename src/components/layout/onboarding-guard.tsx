"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export function OnboardingGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Only check on first render, not on the onboarding page itself
    if (pathname === "/onboarding") return;

    const done = localStorage.getItem("onboarding_complete");
    if (!done) {
      router.replace("/onboarding");
    }
  }, [pathname, router]);

  return null;
}
