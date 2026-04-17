import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DangerZone } from "@/components/settings/danger-zone";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account and data</p>
      </div>

      {/* Account info */}
      <div className="rounded-xl border bg-white p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Account</h2>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm">
            {(session.user.name ?? session.user.email ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{session.user.name ?? "—"}</p>
            <p className="text-xs text-slate-500">{session.user.email}</p>
          </div>
        </div>
      </div>

      <DangerZone />
    </div>
  );
}
