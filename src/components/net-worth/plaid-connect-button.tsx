"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Building2, Loader2 } from "lucide-react";

export function PlaidConnectButton({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState("");

  // Fetch link token on mount
  useEffect(() => {
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.linkToken) setLinkToken(data.linkToken);
        else setError("Could not initialise bank connection.");
      })
      .catch(() => setError("Could not initialise bank connection."));
  }, []);

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      setExchanging(true);
      setError("");
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken }),
        });
        if (!res.ok) throw new Error();
        router.refresh();
        onSuccess?.();
        // Show a hint — Plaid needs ~30s before transactions are ready to sync
        setError("✓ Bank connected! Wait 30 seconds then click Sync Now to import transactions.");
      } catch {
        setError("Could not connect bank. Please try again.");
      } finally {
        setExchanging(false);
      }
    },
    [onSuccess, router]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: (public_token) => onPlaidSuccess(public_token),
    onExit: () => {},
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={() => open()}
        disabled={!ready || exchanging}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {exchanging ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Building2 className="h-3.5 w-3.5" />
        )}
        {exchanging ? "Connecting..." : "Connect Bank"}
      </Button>
      {error && (
        <p className={`text-xs max-w-xs text-right ${error.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
          {error}
        </p>
      )}
    </div>
  );
}
