"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImagePlus,
  Compass,
  LogOut,
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
  attachments?: MessageAttachment[];
  createdAt?: string;
  pending?: boolean;
};

type MessageAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt?: string;
  previewUrl?: string;
};

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId),
    [activeId, conversations],
  );

  const selectedImagesRef = useRef<SelectedImage[]>([]);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
    };
  }, []);

  function addSelectedImages(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setSelectedImages((current) => {
      const openSlots = 3 - current.length;
      if (openSlots <= 0) {
        window.alert("一次最多上传 3 张图片。");
        return current;
      }

      const accepted = files.slice(0, openSlots);
      if (files.length > openSlots) {
        window.alert("一次最多上传 3 张图片，多余图片已忽略。");
      }

      return [
        ...current,
        ...accepted.map((file) => ({
          id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${Math.random()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];
    });
  }

  function removeSelectedImage(id: string) {
    setSelectedImages((current) => {
      const target = current.find((image) => image.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((image) => image.id !== id);
    });
  }

  function clearSelectedImages() {
    setSelectedImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  }

  const scrollToMessageEnd = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    if (!hasMessages) {
      return;
    }

    const behavior: ScrollBehavior = sending ? "auto" : "smooth";
    const frame = window.requestAnimationFrame(() => {
      scrollToMessageEnd(behavior);
    });
    const settleTimer = window.setTimeout(() => {
      scrollToMessageEnd("auto");
    }, 40);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [hasMessages, messages, scrollToMessageEnd, sending]);

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
    if ((!content && selectedImages.length === 0) || sending) {
      return;
    }

    setInput("");
    const imagesForRequest = selectedImages;
    setSelectedImages([]);
    setSending(true);
    setError("");

    const localUserMessage: Message = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: content || (imagesForRequest.length ? "请分析这张图片。" : ""),
      attachments: imagesForRequest.length
        ? imagesForRequest.map((image) => ({
            id: image.id,
            originalName: image.file.name || "image",
            mimeType: image.file.type,
            sizeBytes: image.file.size,
            previewUrl: image.previewUrl,
          }))
        : undefined,
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
      const body = new FormData();
      body.set("message", content);
      if (activeId) {
        body.set("conversationId", activeId);
      }
      for (const image of imagesForRequest) {
        body.append("images", image.file);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        body,
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
      <aside
        className={clsx(
          "sidebar-panel z-40 flex shrink-0 flex-col overflow-hidden bg-zinc-950/20 px-3 py-4",
          sidebarOpen
            ? "w-[288px] bg-zinc-900/90 shadow-2xl shadow-black/30"
            : "w-14 bg-transparent shadow-none",
        )}
      >
        <div className="flex h-10 items-center gap-3">
          <button
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
            onClick={() => setSidebarOpen((current) => !current)}
            title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
            type="button"
          >
            {sidebarOpen ? (
              <PanelLeftClose size={18} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={18} aria-hidden="true" />
            )}
          </button>
          <span
            className={clsx(
              "whitespace-nowrap text-sm font-semibold transition-all duration-500",
              sidebarOpen ? "opacity-100 translate-x-0" : "pointer-events-none -translate-x-2 opacity-0",
            )}
          >
            森岳 AI Agent
          </span>
        </div>

        <div className="mt-6 flex flex-1 flex-col gap-2">
          <SidebarAction
            icon={<MessageSquarePlus size={18} />}
            label="新对话"
            expanded={sidebarOpen}
            active={!activeId}
            onClick={createConversation}
          />
          <SidebarAction
            icon={<Search size={18} />}
            label="搜索对话"
            expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          />
          <SidebarAction
            icon={<Compass size={18} />}
            label="探索"
            expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          />

          {sidebarOpen ? (
            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              <p className="px-2 pb-2 text-xs text-zinc-500">对话</p>
              {loadingConversations ? (
                <p className="px-2 py-2 text-sm text-zinc-500">正在加载</p>
              ) : conversations.length === 0 ? (
                <p className="px-2 py-2 text-sm text-zinc-500">暂无对话</p>
              ) : (
                conversations.map((conversation) => (
                  <div key={conversation.id} className="group flex items-center gap-1">
                    <button
                      className={clsx(
                        "min-w-0 flex-1 rounded-full px-3 py-2 text-left text-sm text-zinc-300 transition hover:bg-white/8 hover:text-white",
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
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {role !== "user" ? (
            <a
              className="flex h-10 items-center gap-3 rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
              href="/admin"
              title="管理后台"
            >
              <span className="flex h-10 w-9 shrink-0 items-center justify-center">
                <Settings size={18} aria-hidden="true" />
              </span>
              <span
                className={clsx(
                  "whitespace-nowrap text-sm transition-all duration-500",
                  sidebarOpen ? "opacity-100 translate-x-0" : "pointer-events-none -translate-x-2 opacity-0",
                )}
              >
                管理后台
              </span>
            </a>
          ) : null}
          <button
            className="flex h-10 items-center gap-3 rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white"
            onClick={logout}
            type="button"
          >
            <span className="flex h-10 w-9 shrink-0 items-center justify-center">
              <LogOut size={18} aria-hidden="true" />
            </span>
            <span
              className={clsx(
                "whitespace-nowrap text-sm transition-all duration-500",
                sidebarOpen ? "opacity-100 translate-x-0" : "pointer-events-none -translate-x-2 opacity-0",
              )}
            >
              退出登录
            </span>
          </button>
          <div className="mt-2 flex h-10 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-sm font-semibold text-white">
              {username.slice(0, 1).toUpperCase()}
            </span>
            <span
              className={clsx(
                "min-w-0 truncate text-sm font-medium transition-all duration-500",
                sidebarOpen ? "opacity-100 translate-x-0" : "pointer-events-none -translate-x-2 opacity-0",
              )}
            >
              {username}
            </span>
          </div>
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="min-w-0">
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
          ref={scrollContainerRef}
          className={clsx(
            "min-h-0 flex-1 overscroll-contain overflow-y-auto px-4",
            hasMessages ? "py-5" : "flex items-center justify-center pb-28",
          )}
        >
          {loadingMessages ? (
            <p className="text-sm text-zinc-500">正在加载消息</p>
          ) : hasMessages ? (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div className="h-44 shrink-0 md:h-48" aria-hidden="true" />
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
                  selectedImages={selectedImages}
                  sending={sending}
                  onInput={setInput}
                  onImages={addSelectedImages}
                  onRemoveImage={removeSelectedImage}
                  onClearImages={clearSelectedImages}
                  onSubmit={handleSubmit}
                />
              </div>
            </div>
          )}
        </div>

        {hasMessages ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 px-4 md:bottom-10">
            <div className="composer-dock pointer-events-auto mx-auto w-full max-w-3xl">
              <ChatComposer
                input={input}
                selectedImages={selectedImages}
                sending={sending}
                onInput={setInput}
                onImages={addSelectedImages}
                onRemoveImage={removeSelectedImage}
                onClearImages={clearSelectedImages}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function ChatComposer({
  input,
  selectedImages,
  sending,
  onInput,
  onImages,
  onRemoveImage,
  onClearImages,
  onSubmit,
}: {
  input: string;
  selectedImages: SelectedImage[];
  sending: boolean;
  onInput: (value: string) => void;
  onImages: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  onClearImages: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-[720px]">
      {selectedImages.length ? (
        <div className="mb-2 rounded-2xl border border-white/10 bg-zinc-900/90 p-2 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-3 px-1 pb-2">
            <p className="text-xs text-zinc-500">
              已选择 {selectedImages.length}/3 张，7 天后自动清理
            </p>
            <button
              className="rounded-full px-2 py-1 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-white"
              onClick={onClearImages}
              type="button"
            >
              清空
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {selectedImages.map((image) => (
              <div
                className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/20"
                key={image.id}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={image.file.name || "上传图片"}
                  className="h-full w-full object-cover"
                  src={image.previewUrl}
                />
                <button
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white opacity-100 transition hover:bg-red-500"
                  onClick={() => onRemoveImage(image.id)}
                  title="移除图片"
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="ai-composer-shell ai-soft-border flex min-h-[58px] items-end gap-3 rounded-full border bg-zinc-900/95 px-4 py-2.5 shadow-2xl shadow-blue-950/20 backdrop-blur-xl transition duration-300 focus-within:scale-[1.01]">
        <label
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
          title="上传图片"
        >
          <ImagePlus size={18} aria-hidden="true" />
          <input
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={sending}
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length === 0) {
                return;
              }
              const oversized = files.find((file) => file.size > 8 * 1024 * 1024);
              if (oversized) {
                window.alert("图片不能超过 8MB。");
                return;
              }
              onImages(files);
            }}
            type="file"
          />
        </label>
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-zinc-300 transition hover:bg-white hover:text-zinc-950 disabled:bg-zinc-700/70 disabled:text-zinc-500"
          type="submit"
          title="发送"
          disabled={sending || (!input.trim() && selectedImages.length === 0)}
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 text-center text-xs text-zinc-400">
        我是由渡生设计创造的AI智能体,有时我也会出错.
      </p>
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
        {message.attachments?.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={attachment.originalName}
                className="max-h-64 rounded-xl border border-black/10 object-contain"
                key={attachment.id}
                src={attachment.previewUrl ?? `/api/attachments/${attachment.id}`}
              />
            ))}
          </div>
        ) : null}
        {message.content || (message.pending ? "正在思考..." : "")}
      </div>
    </article>
  );
}

function SidebarAction({
  icon,
  label,
  expanded,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        "flex h-10 items-center gap-3 rounded-full text-zinc-300 transition hover:bg-white/10 hover:text-white",
        active && expanded && "bg-white/10 text-white",
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span className="flex h-10 w-9 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span
        className={clsx(
          "whitespace-nowrap text-sm font-medium transition-all duration-500",
          expanded ? "opacity-100 translate-x-0" : "pointer-events-none -translate-x-2 opacity-0",
        )}
      >
        {label}
      </span>
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
