"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  LogOut,
  Menu,
  MessageSquarePlus,
  PanelLeftClose,
  Send,
  Settings,
  Trash2,
} from "lucide-react";
import clsx from "clsx";

type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  pending?: boolean;
};

type StreamPayload = {
  text?: string;
  meta?: Record<string, string>;
  done?: boolean;
};

export function ChatApp({
  username,
  isAdmin,
}: {
  username: string;
  isAdmin: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId),
    [activeId, conversations],
  );

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function loadConversations(selectFirst = true) {
    setLoadingConversations(true);
    setError("");

    try {
      const response = await fetch("/api/conversations");
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load conversations.");
      }

      const payload = await response.json();
      setConversations(payload.conversations);

      if (selectFirst && payload.conversations.length > 0 && !activeId) {
        await openConversation(payload.conversations[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversations.");
    } finally {
      setLoadingConversations(false);
    }
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setLoadingMessages(true);
    setError("");

    try {
      const response = await fetch(`/api/conversations/${id}/messages`);
      if (!response.ok) {
        throw new Error("Could not load messages.");
      }

      const payload = await response.json();
      setMessages(payload.conversation.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load messages.");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function createConversation() {
    setError("");

    try {
      const response = await fetch("/api/conversations", { method: "POST" });
      if (!response.ok) {
        throw new Error("Could not create conversation.");
      }

      const payload = await response.json();
      setConversations((current) => [payload.conversation, ...current]);
      setActiveId(payload.conversation.id);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create conversation.");
    }
  }

  async function deleteConversation(id: string) {
    setError("");

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Could not delete conversation.");
      }

      const next = conversations.filter((conversation) => conversation.id !== id);
      setConversations(next);

      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
        if (next[0]) {
          await openConversation(next[0].id);
        } else {
          setMessages([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete conversation.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();
    if (!content || sending) {
      return;
    }

    setInput("");
    setSending(true);
    setError("");

    const localUserMessage: Message = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content,
      pending: true,
    };
    const localAssistantMessage: Message = {
      id: `local-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      pending: true,
    };

    setMessages((current) => [...current, localUserMessage, localAssistantMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeId,
          message: content,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Send failed.");
      }

      const conversationId = response.headers.get("X-Conversation-Id");
      if (conversationId && !activeId) {
        setActiveId(conversationId);
      }

      await readChatStream(response.body);
      await loadConversations(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
      setMessages((current) =>
        current.map((message) =>
          message.id === localAssistantMessage.id
            ? {
                ...message,
                content: "Request failed. Check server logs or model settings.",
                pending: false,
              }
            : message,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  async function readChatStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const line = chunk.split("\n").find((part) => part.startsWith("data:"));
        if (!line) {
          continue;
        }

        const payload = JSON.parse(line.replace(/^data:\s*/, "")) as StreamPayload;
        if (payload.meta?.conversationId) {
          setActiveId(payload.meta.conversationId);
        }

        if (payload.text) {
          setMessages((current) => {
            const next = [...current];
            const lastAssistantIndex = findLastAssistantIndex(next);
            if (lastAssistantIndex >= 0) {
              next[lastAssistantIndex] = {
                ...next[lastAssistantIndex],
                content: next[lastAssistantIndex].content + payload.text,
                pending: !payload.done,
              };
            }
            return next;
          });
        }

        if (payload.done) {
          setMessages((current) =>
            current.map((message) => ({ ...message, pending: false })),
          );
        }
      }
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-mist text-ink">
      <aside
        className={clsx(
          "absolute inset-y-0 left-0 z-30 flex w-[292px] flex-col border-r border-line bg-white transition-transform md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <div>
            <p className="text-sm font-semibold">AI Chat</p>
            <p className="text-xs text-slate-500">{username}</p>
          </div>
          <button
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar"
            type="button"
          >
            <PanelLeftClose size={19} aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-line p-3">
          <button
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-teal-800"
            onClick={createConversation}
            type="button"
          >
            <MessageSquarePlus size={17} aria-hidden="true" />
            New chat
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {loadingConversations ? (
            <p className="px-3 py-2 text-sm text-slate-500">Loading chats</p>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">No chats yet</p>
          ) : (
            conversations.map((conversation) => (
              <div key={conversation.id} className="group flex items-center gap-1">
                <button
                  className={clsx(
                    "min-w-0 flex-1 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100",
                    activeId === conversation.id && "bg-teal-50 text-brand",
                  )}
                  onClick={() => openConversation(conversation.id)}
                  type="button"
                >
                  <span className="block truncate">{conversation.title}</span>
                </button>
                <button
                  className="rounded-md p-2 text-slate-400 opacity-0 hover:bg-red-50 hover:text-red-700 group-hover:opacity-100"
                  onClick={() => deleteConversation(conversation.id)}
                  title="Delete chat"
                  type="button"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-line p-3">
          {isAdmin ? (
            <a
              className="mb-2 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line text-sm font-medium text-slate-700 hover:bg-slate-100"
              href="/admin"
            >
              <Settings size={17} aria-hidden="true" />
              Admin
            </a>
          ) : null}
          <button
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={logout}
            type="button"
          >
            <LogOut size={17} aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-white px-4">
          <button
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
            type="button"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">
              {activeConversation?.title ?? "New chat"}
            </h1>
            <p className="text-xs text-slate-500">Streaming output enabled</p>
          </div>
        </header>

        {error ? (
          <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {loadingMessages ? (
              <p className="text-sm text-slate-500">Loading messages</p>
            ) : messages.length === 0 ? (
              <div className="rounded-lg border border-line bg-white p-6 shadow-soft">
                <h2 className="text-lg font-semibold">Start a conversation</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Ask a question and the backend will use the provider configured in
                  environment variables.
                </p>
              </div>
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-line bg-white px-4 py-4"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-3">
            <textarea
              className="max-h-40 min-h-12 flex-1 resize-none rounded-md border border-line px-3 py-3 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Type a message"
              rows={1}
              disabled={sending}
            />
            <button
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand text-white hover:bg-teal-800"
              type="submit"
              title="Send"
              disabled={sending || !input.trim()}
            >
              <Send size={19} aria-hidden="true" />
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <article className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[88%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
          isUser ? "bg-brand text-white" : "border border-line bg-white text-ink",
        )}
      >
        {message.content || (message.pending ? "Thinking..." : "")}
      </div>
    </article>
  );
}

function findLastAssistantIndex(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") {
      return index;
    }
  }

  return -1;
}
