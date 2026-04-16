import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <div className="w-full max-w-sm space-y-6 rounded-xl border bg-white p-8 shadow-sm">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold text-slate-900">MoneyPlan</h1>
        <p className="text-sm text-slate-500">Sign in to your account</p>
      </div>

      {/* Google Sign In */}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <Button type="submit" variant="outline" className="w-full">
          Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Email + Password */}
      <form
        action={async (formData: FormData) => {
          "use server";
          await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirectTo: "/dashboard",
          });
        }}
        className="space-y-3"
      >
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}
