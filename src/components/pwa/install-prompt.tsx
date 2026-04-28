"use client";
import { useEffect, useState, useCallback } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check persisted dismissed state after mount (avoids SSR issues)
    if (localStorage.getItem("pwa-install-dismissed") === "true") {
      setDismissed(true);
    }

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    // Capture the install prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // All hooks must be declared before any early return
  function dismiss() {
    localStorage.setItem("pwa-install-dismissed", "true");
    setDismissed(true);
  }

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
    dismiss();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt]);

  // Early return AFTER all hooks
  if (!prompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-4 py-3 max-w-sm w-[calc(100%-2rem)]">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          Install MoneyPlan
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Add to your home screen for quick access
        </p>
      </div>
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        aria-label="Install MoneyPlan app"
      >
        <Download className="h-3.5 w-3.5" />
        Install
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
