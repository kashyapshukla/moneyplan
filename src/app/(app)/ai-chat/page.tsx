import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ChatInterface } from "@/components/ai-chat/chat-interface";

export default async function AIChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Chat</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ask anything about your finances — powered by Gemini AI
        </p>
      </div>
      <ChatInterface />
    </div>
  );
}
