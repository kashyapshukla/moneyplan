"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Message = {
  id: string;
  role: "user" | "model";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "How much did I spend this month?",
  "Which category am I overspending in?",
  "What's my savings rate?",
  "Give me tips to improve my budget health",
  "How is my net worth doing?",
];

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-slate-900" : "bg-emerald-500"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-slate-900 text-white rounded-tr-sm"
            : "bg-slate-100 text-slate-800 rounded-tl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "model",
      content:
        "Hi! I'm your MoneyPlan AI assistant. I have access to your financial data and can help you understand your spending, budgets, net worth, and more. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // Build API payload (exclude welcome message from context)
      const apiMessages = updatedMessages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data = await res.json();
      const reply = data.reply ?? data.error ?? "Something went wrong.";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-model",
          role: "model",
          content: reply,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "-err",
          role: "model",
          content: "Sorry, I couldn't reach the AI service. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] rounded-xl border bg-white overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {loading && (
          <div className="flex gap-3 flex-row">
            <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-emerald-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              <span className="text-sm text-slate-400">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested questions (show only at start) */}
      {messages.length === 1 && (
        <div className="px-5 pb-3 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs bg-slate-50 hover:bg-slate-100 border text-slate-600 rounded-full px-3 py-1.5 transition-colors text-left"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400 max-h-32 overflow-y-auto"
            style={{ minHeight: "44px" }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || loading}
            className="h-11 w-11 p-0 rounded-xl flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-slate-400 mt-2 text-center">
          AI responses use your real financial data · Press Enter to send
        </p>
      </div>
    </div>
  );
}
