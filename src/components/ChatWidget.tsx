import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { LifeBuoy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const suggestions = {
  student: ["When is my next deadline?", "How do I register for a course?", "What is CS201 about?"],
  lecturer: ["How do I publish exam results?", "Which of my tasks are due soon?", "How do I upload slides?"],
};

export function ChatWidget({ isLecturer }: { isLecturer: boolean }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
    onError: (e) => {
      const msg = e.message || "";
      if (msg.includes("429")) toast.error("The assistant is busy. Please try again in a minute.");
      else if (msg.includes("402")) toast.error("AI credits have run out.");
      else toast.error("The assistant could not answer. Please try again.");
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open && !busy) textareaRef.current?.focus();
  }, [open, busy]);

  function send(text: string) {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-12 gap-2 rounded-full px-5 shadow-lg"
      >
        <LifeBuoy className="size-5" /> Ask Nora for help
      </Button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[min(600px,calc(100vh-2.5rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="hero-surface flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="gold-surface flex size-8 items-center justify-center rounded-full font-display text-sm font-bold">
            Nw
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">Nora · Help assistant</p>
            <p className="text-xs opacity-75">Deadlines, courses and how to use the portal</p>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Close assistant"
          onClick={() => setOpen(false)}
          className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Hello! How can I help?"
              description="Ask in your own words. For example:"
            >
              <div className="mt-2 flex flex-col items-center gap-3 text-center">
                <p className="font-medium text-sm">Hello! How can I help?</p>
                <p className="text-xs text-muted-foreground">Ask in your own words, or tap a question:</p>
                {suggestions[isLecturer ? "lecturer" : "student"].map((s) => (
                  <Button key={s} size="sm" variant="secondary" onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((p, i) =>
                    p.type === "text" ? (
                      m.role === "assistant" ? (
                        <MessageResponse key={i}>{p.text}</MessageResponse>
                      ) : (
                        <span key={i} className="whitespace-pre-wrap">
                          {p.text}
                        </span>
                      )
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" ? <Shimmer className="text-sm">Looking that up…</Shimmer> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-3">
        <PromptInput onSubmit={(msg) => send(msg.text ?? "")}>
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            placeholder="Type your question…"
            onChange={(e) => setInput(e.target.value)}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !input.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
