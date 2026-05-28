"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Compass,
  LogOut,
  Menu,
  MessageSquare,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import clsx from "clsx";
import type { UserRole } from "@/lib/auth";

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
  role,
}: {
  username: string;
  role: UserRole;
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
  const hasMessages = messages.length > 0;

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId),
    [activeId, conversations],
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const loadConversations = useCallback(async (selectFirst = true) => {
    setLoadingConversations(true);
    setError("");

    try {
      const response = await fetch("/api/conversations");
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error("无法加载对话列表。");
      }

      const payload = await response.json();
      setConversations(payload.conversations);

      if (selectFirst && payload.conversations.length > 0 && !activeId) {
        await openConversation(payload.conversations[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载对话列表。");
    } finally {
      setLoadingConversations(false);
    }
  }, [activeId]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  async function openConversation(id: string) {
    setActiveId(id);
    setLoadingMessages(true);
    setError("");

    try {
      const response = await fetch(`/api/conversations/${id}/messages`);
      if (!response.ok) {
        throw new Error("无法加载消息。");
      }

      const payload = await response.json();
      setMessages(payload.conversation.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载消息。");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function createConversation() {
    setError("");

    try {
      const response = await fetch("/api/conversations", { method: "POST" });
      if (!response.ok) {
        throw new Error("无法创建对话。");
      }

      const payload = await response.json();
      setConversations((current) => [payload.conversation, ...current]);
      setActiveId(payload.conversation.id);
      setMessages([]);
      setSidebarOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法创建对话。");
    }
  }

  async function deleteConversation(id: string) {
    setError("");

    try {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("无法删除对话。");
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
      setError(err instanceof Error ? err.message : "无法删除对话。");
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
          ...(activeId ? { conversationId: activeId } : {}),
          message: content,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "发送失败。");
      }

      const conversationId = response.headers.get("X-Conversation-Id");
      if (conversationId && !activeId) {
        setActiveId(conversationId);
      }

      await readChatStream(response.body);
      await loadConversations(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败。");
      setMessages((current) =>
        current.map((message) =>
          message.id === localAssistantMessage.id
            ? {
                ...message,
                content: "请求失败，请检查服务器日志或模型设置。",
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
    <main className="ai-ambient flex h-screen overflow-hidden text-zinc-100">
      <nav className="ai-subtle-border z-40 flex w-14 shrink-0 flex-col items-center border-r bg-black/20 px-2 py-3 backdrop-blur-xl">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-zinc-200 transition hover:bg-white/15"
          onClick={() => setSidebarOpen((current) => !current)}
          title={sidebarOpen ? "关闭侧栏" : "打开侧栏"}
          type="button"
        >
          {sidebarOpen ? (
            <PanelLeftClose size={18} aria-hidden="true" />
          ) : (
            <PanelLeftOpen size={18} aria-hidden="true" />
          )}
        </button>

        <div className="mt-5 flex flex-1 flex-col items-center gap-2">
          <IconButton icon={<MessageSquarePlus size={18} />} label="新对话" onClick={createConversation} />
          <IconButton icon={<Search size={18} />} label="搜索" onClick={() => setSidebarOpen(true)} />
          <IconButton icon={<Compass size={18} />} label="探索" onClick={() => setSidebarOpen(true)} />
        </div>

        <div className="flex flex-col items-center gap-2">
          {role !== "user" ? (
            <a
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
              href="/admin"
              title="管理后台"
            >
              <Settings size={18} aria-hidden="true" />
            </a>
          ) : null}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-sm font-semibold text-white transition hover:bg-sky-400"
            title={username}
            type="button"
          >
            {username.slice(0, 1).toUpperCase()}
          </button>
        </div>
      </nav>

      <aside
        className={clsx(
          "sidebar-panel ai-soft-border absolute inset-y-0 left-14 z-30 flex w-[300px] flex-col border-r bg-zinc-950/80 shadow-2xl shadow-black/40 backdrop-blur-2xl md:relative md:left-0",
          sidebarOpen
            ? "translate-x-0 opacity-100 blur-0 scale-100"
            : "-translate-x-[300px] opacity-0 blur-sm scale-[0.985] md:-ml-[300px]",
        )}
      >
        <div className="ai-subtle-border flex h-16 items-center justify-between border-b px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">森岳 AI Agent</p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{username}</p>
          </div>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
            onClick={() => setSidebarOpen(false)}
            title="收起侧边栏"
            type="button"
          >
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="ai-subtle-border border-b p-3">
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-zinc-950 transition hover:bg-zinc-200"
            onClick={createConversation}
            type="button"
          >
            <MessageSquarePlus size={17} aria-hidden="true" />
            新对话
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {loadingConversations ? (
            <p className="px-3 py-2 text-sm text-zinc-500">正在加载对话</p>
          ) : conversations.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-500">暂无对话</p>
          ) : (
            conversations.map((conversation) => (
              <div key={conversation.id} className="group flex items-center gap-1">
                <button
                  className={clsx(
                    "min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-white/8 hover:text-white",
                    activeId === conversation.id && "bg-white/10 text-white",
                  )}
                  onClick={() => openConversation(conversation.id)}
                  type="button"
                >
                  <span className="block truncate">{conversation.title}</span>
                </button>
                <button
                  className="rounded-full p-2 text-zinc-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                  onClick={() => deleteConversation(conversation.id)}
                  title="删除对话"
                  type="button"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="ai-subtle-border border-t p-3">
          <button
            className="ai-soft-border flex h-10 w-full items-center justify-center gap-2 rounded-full border text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
            onClick={logout}
            type="button"
          >
            <LogOut size={17} aria-hidden="true" />
            退出登录
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between px-4 md:px-6">
          <button
            className="flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-zinc-950 shadow-lg shadow-black/20 transition hover:bg-zinc-200 md:hidden"
            onClick={() => setSidebarOpen(true)}
            type="button"
          >
            <Menu size={17} aria-hidden="true" />
            打开侧栏
          </button>
          <div className="hidden min-w-0 md:block">
            <p className="truncate text-sm text-zinc-500">
              {activeConversation?.title ?? "新对话"}
            </p>
          </div>
          <Sparkles className="text-zinc-500" size={20} aria-hidden="true" />
        </header>

        {error ? (
          <div className="mx-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div
          className={clsx(
            "min-h-0 flex-1 overflow-y-auto px-4",
            hasMessages ? "py-5" : "flex items-center justify-center pb-24",
          )}
        >
          {loadingMessages ? (
            <p className="text-sm text-zinc-500">正在加载消息</p>
          ) : hasMessages ? (
            <div className="mx-auto flex max-w-3xl flex-col gap-5 pb-28">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={scrollRef} />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl text-center">
              <h1 className="text-3xl font-semibold tracking-normal text-zinc-100 md:text-4xl">
                {username}，请说
              </h1>
              <p className="mt-4 text-sm text-zinc-500">
                简洁、安全、私有的 AI 对话空间
              </p>
              <div className="composer-center mt-10">
                <ChatComposer
                  input={input}
                  sending={sending}
                  onInput={setInput}
                  onSubmit={handleSubmit}
                />
              </div>
            </div>
          )}
        </div>

        {hasMessages ? (
          <div className="ai-subtle-border composer-dock border-t bg-black/20 px-4 py-4 backdrop-blur-xl">
            <ChatComposer
              input={input}
              sending={sending}
              onInput={setInput}
              onSubmit={handleSubmit}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}

function ChatComposer({
  input,
  sending,
  onInput,
  onSubmit,
}: {
  input: string;
  sending: boolean;
  onInput: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl">
      <div className="ai-composer-shell ai-soft-border flex min-h-16 items-end gap-3 rounded-full border bg-zinc-900/95 px-4 py-3 shadow-2xl shadow-blue-950/20 backdrop-blur-xl transition duration-300 focus-within:scale-[1.01]">
        <MessageSquarePlus className="mb-1 shrink-0 text-zinc-400" size={22} aria-hidden="true" />
        <textarea
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-1 text-base leading-7 text-zinc-100 outline-none placeholder:text-zinc-500"
          value={input}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="询问森岳 AI"
          rows={1}
          disabled={sending}
        />
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 transition hover:bg-zinc-200 disabled:bg-white/30 disabled:text-zinc-500"
          type="submit"
          title="发送"
          disabled={sending || !input.trim()}
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <article className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-lg",
          isUser
            ? "bg-white text-zinc-950 shadow-black/20"
            : "ai-soft-border border bg-white/8 text-zinc-100 shadow-black/10 backdrop-blur-xl",
        )}
      >
        {message.content || (message.pending ? "正在思考..." : "")}
      </div>
    </article>
  );
}

function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
    </button>
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
