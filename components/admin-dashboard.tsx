"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  KeyRound,
  Loader2,
  Save,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import type { UserRole } from "@/lib/auth";

type AdminUser = {
  id: string;
  username: string;
  role: UserRole;
  chatPreset?: string | null;
  isAdmin?: boolean;
  createdAt: string;
  _count?: { conversations: number };
};

type ModelOption = {
  label: string;
  value: string;
};

type ModelSettings = {
  MODEL_PROVIDER: "openai" | "local_openai";
  OPENAI_API_KEY: string;
  OPENAI_API_KEY_MASKED?: string;
  OPENAI_MODEL: string;
  LOCAL_OPENAI_BASE_URL: string;
  LOCAL_OPENAI_API_KEY: string;
  LOCAL_OPENAI_API_KEY_MASKED?: string;
  LOCAL_OPENAI_MODEL: string;
};

type PresetSettings = {
  USER_CHAT_PRESET: string;
  ADMIN_CHAT_PRESET: string;
};

type BehaviorArchive = {
  key: string;
  userId: string | null;
  username: string;
  role: UserRole;
  latestContent: string;
  latestAt: string;
  questionCount: number;
};

type ArchiveMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

type ArchiveConversation = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ArchiveMessage[];
};

type ArchiveDetail = {
  user: {
    id: string;
    username: string;
    role: UserRole;
  };
  conversations: ArchiveConversation[];
};

const emptySettings: ModelSettings = {
  MODEL_PROVIDER: "openai",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "gpt-5.5",
  LOCAL_OPENAI_BASE_URL: "",
  LOCAL_OPENAI_API_KEY: "",
  LOCAL_OPENAI_MODEL: "local-model",
};

const emptyPresets: PresetSettings = {
  USER_CHAT_PRESET: "",
  ADMIN_CHAT_PRESET: "",
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "user", label: "普通用户" },
  { value: "admin", label: "管理员" },
  { value: "owner", label: "所有者" },
];

export function AdminDashboard({
  username,
  role,
}: {
  username: string;
  role: UserRole;
}) {
  const isOwner = role === "owner";
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<ModelSettings>(emptySettings);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [presets, setPresets] = useState<PresetSettings>(emptyPresets);
  const [archives, setArchives] = useState<BehaviorArchive[]>([]);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveDetail, setArchiveDetail] = useState<ArchiveDetail | null>(null);
  const [presetEditor, setPresetEditor] = useState<AdminUser | null>(null);
  const [presetDraft, setPresetDraft] = useState("");
  const [loadingArchiveDetail, setLoadingArchiveDetail] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPresets, setSavingPresets] = useState(false);
  const [savingUserPreset, setSavingUserPreset] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const requests = [fetch("/api/admin/users")];

      if (isOwner) {
        requests.push(
          fetch("/api/admin/settings/model"),
          fetch("/api/admin/settings/presets"),
          fetch("/api/admin/logs"),
        );
      }

      const [usersResponse, settingsResponse, presetsResponse, logsResponse] =
        await Promise.all(requests);

      if (usersResponse.status === 401 || settingsResponse?.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!usersResponse.ok) {
        throw new Error("无法加载用户列表。");
      }

      const usersPayload = await usersResponse.json();
      setUsers(usersPayload.users);

      if (isOwner) {
        if (!settingsResponse?.ok) {
          throw new Error("无法加载模型设置。");
        }

        if (!presetsResponse?.ok) {
          throw new Error("无法加载聊天预设。");
        }

        if (!logsResponse?.ok) {
          throw new Error("无法加载行为日志。");
        }

        const settingsPayload = await settingsResponse.json();
        const presetsPayload = await presetsResponse.json();
        const logsPayload = await logsResponse.json();

        setSettings(settingsPayload.settings);
        setModelOptions(settingsPayload.modelOptions);
        setPresets(presetsPayload.presets);
        setArchives(logsPayload.archives ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载后台数据。");
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: isOwner ? newRole : "user",
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "无法创建用户。");
      }

      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      setStatus("用户已创建。");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法创建用户。");
    }
  }

  async function loadUsers() {
    const response = await fetch("/api/admin/users");
    if (!response.ok) {
      throw new Error("无法刷新用户列表。");
    }
    const payload = await response.json();
    setUsers(payload.users);
  }

  async function updateUserRole(user: AdminUser, nextRole: UserRole) {
    setStatus("");
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "无法更新用户。");
      }

      setStatus("用户角色已更新。");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法更新用户。");
    }
  }

  async function resetPassword(user: AdminUser) {
    const password = window.prompt(`请输入 ${user.username} 的新密码，至少 8 位`);
    if (!password) {
      return;
    }

    setStatus("");
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "无法重置密码。");
      }

      const payload = await response.json();
      if (payload.selfPasswordChanged) {
        window.location.href = "/login";
        return;
      }

      setStatus("密码已重置。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法重置密码。");
    }
  }

  function openPresetEditor(user: AdminUser) {
    if (user.role === "owner") {
      setError("所有者账号不参与聊天预设。");
      return;
    }

    setError("");
    setStatus("");
    setPresetEditor(user);
    setPresetDraft(user.chatPreset ?? "");
  }

  async function saveUserPreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!presetEditor) {
      return;
    }

    setSavingUserPreset(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${presetEditor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatPreset: presetDraft }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "无法保存用户聊天预设。");
      }

      const payload = await response.json();
      setUsers((current) =>
        current.map((user) => (user.id === payload.user.id ? payload.user : user)),
      );
      setPresetEditor(null);
      setPresetDraft("");
      setStatus(
        presetDraft.trim()
          ? `${presetEditor.username} 的聊天预设已保存。`
          : `${presetEditor.username} 已恢复使用全局预设。`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法保存用户聊天预设。");
    } finally {
      setSavingUserPreset(false);
    }
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`确定删除 ${user.username} 吗？该用户的所有对话也会被删除。`)) {
      return;
    }

    setStatus("");
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "无法删除用户。");
      }

      setStatus("用户已删除。");
      await loadUsers();
      if (isOwner) {
        await refreshLogs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法删除用户。");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSettings(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch("/api/admin/settings/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "无法保存模型设置。");
      }

      const payload = await response.json();
      setSettings(payload.settings);
      setStatus("模型设置已保存。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法保存模型设置。");
    } finally {
      setSavingSettings(false);
    }
  }

  async function savePresets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPresets(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch("/api/admin/settings/presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(presets),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "无法保存聊天预设。");
      }

      const payload = await response.json();
      setPresets(payload.presets);
      setStatus("聊天预设已保存。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法保存聊天预设。");
    } finally {
      setSavingPresets(false);
    }
  }

  async function testModelSettings() {
    setTestingModel(true);
    setStatus("");
    setError("");

    try {
      const response = await fetch("/api/admin/settings/model/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error ?? "模型连接测试失败。");
      }

      setLocalModels(payload.models ?? []);
      setStatus(
        payload.models?.length
          ? `连接可用，已发现 ${payload.models.length} 个模型。`
          : "连接可用。",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "模型连接测试失败。");
    } finally {
      setTestingModel(false);
    }
  }

  async function refreshLogs() {
    setError("");

    try {
      const response = await fetch("/api/admin/logs");
      if (!response.ok) {
        throw new Error("无法刷新行为日志。");
      }
      const payload = await response.json();
      setArchives(payload.archives ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法刷新行为日志。");
    }
  }

  async function openArchiveDetail(archive: BehaviorArchive) {
    if (!archive.userId) {
      setError("该档案对应的用户已删除，只保留了历史提问摘要。");
      return;
    }

    setLoadingArchiveDetail(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/logs/${encodeURIComponent(archive.userId)}`,
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "无法加载用户档案详情。");
      }

      const payload = await response.json();
      setArchiveDetail(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载用户档案详情。");
    } finally {
      setLoadingArchiveDetail(false);
    }
  }

  function updateSettings(partial: Partial<ModelSettings>) {
    setSettings((current) => ({ ...current, ...partial }));
  }

  function updatePresets(partial: Partial<PresetSettings>) {
    setPresets((current) => ({ ...current, ...partial }));
  }

  const isOpenAIProvider = settings.MODEL_PROVIDER === "openai";
  const filteredArchives = archives.filter((archive) =>
    archive.username.toLowerCase().includes(archiveSearch.trim().toLowerCase()),
  );

  return (
    <main className="ai-ambient min-h-screen text-zinc-100">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">管理后台</h1>
            <p className="mt-1 text-sm text-zinc-500">
              当前账号：{username} · {roleLabel(role)}
            </p>
          </div>
          <Link
            className="flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white"
            href="/"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            返回对话
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {status}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="animate-spin" size={18} aria-hidden="true" />
            正在加载后台数据
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl">
              <div className="mb-5 flex items-center gap-2">
                <Shield size={20} aria-hidden="true" />
                <h2 className="text-base font-semibold">用户管理</h2>
              </div>

              <form
                onSubmit={createUser}
                className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]"
              >
                <input
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                  placeholder="账号"
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                  required
                />
                <input
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                  placeholder="密码，至少 8 位"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <select
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none focus:border-white/25 focus:bg-white/8"
                  value={isOwner ? newRole : "user"}
                  onChange={(event) => setNewRole(event.target.value as UserRole)}
                  disabled={!isOwner}
                >
                  {(isOwner ? roleOptions : roleOptions.filter((item) => item.value === "user")).map(
                    (option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
                  type="submit"
                >
                  <UserPlus size={17} aria-hidden="true" />
                  新增
                </button>
              </form>

              {isOwner ? (
                <form
                  onSubmit={savePresets}
                  className="mb-6 grid gap-4 border-b border-white/10 pb-5 lg:grid-cols-2"
                >
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-zinc-300">
                      全局普通用户预设
                    </span>
                    <textarea
                      className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                      value={presets.USER_CHAT_PRESET}
                      onChange={(event) =>
                        updatePresets({ USER_CHAT_PRESET: event.target.value })
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-zinc-300">
                      全局管理员预设
                    </span>
                    <textarea
                      className="min-h-28 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                      value={presets.ADMIN_CHAT_PRESET}
                      onChange={(event) =>
                        updatePresets({ ADMIN_CHAT_PRESET: event.target.value })
                      }
                    />
                  </label>
                  <button
                    className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-zinc-950 hover:bg-zinc-200 lg:col-span-2"
                    disabled={savingPresets}
                    type="submit"
                  >
                    {savingPresets ? (
                      <Loader2 className="animate-spin" size={17} aria-hidden="true" />
                    ) : (
                      <Save size={17} aria-hidden="true" />
                    )}
                    保存全局聊天预设
                  </button>
                </form>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-zinc-500">
                      <th className="py-2 pr-3 font-medium">账号</th>
                      <th className="py-2 pr-3 font-medium">身份</th>
                      <th className="py-2 pr-3 font-medium">对话数</th>
                      <th className="py-2 pr-3 font-medium">创建时间</th>
                      <th className="py-2 pr-3 font-medium">聊天预设</th>
                      <th className="py-2 pr-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td className="py-6 text-center text-zinc-500" colSpan={6}>
                          暂无可管理用户
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="border-b border-white/10 last:border-0">
                          <td className="py-3 pr-3 font-medium">{user.username}</td>
                          <td className="py-3 pr-3">
                            {isOwner ? (
                              <select
                                className="h-9 rounded-xl border border-white/10 bg-white/5 px-2 text-sm text-zinc-100 outline-none focus:border-white/25 focus:bg-white/8"
                                value={user.role}
                                onChange={(event) =>
                                  updateUserRole(user, event.target.value as UserRole)
                                }
                                disabled={user.username === username}
                              >
                                {roleOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              roleLabel(user.role)
                            )}
                          </td>
                          <td className="py-3 pr-3">{user._count?.conversations ?? 0}</td>
                          <td className="py-3 pr-3 text-zinc-500">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="py-3 pr-3">
                            {user.role === "owner" ? (
                              <span className="text-zinc-500">不参与</span>
                            ) : (
                              <button
                                className="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
                                onClick={() => openPresetEditor(user)}
                                type="button"
                              >
                                {user.chatPreset ? "个人预设" : "聊天预设"}
                              </button>
                            )}
                          </td>
                          <td className="flex flex-wrap gap-2 py-3 pr-3">
                            <button
                              className="flex items-center gap-1 rounded-xl border border-white/10 px-2 py-1 text-zinc-200 hover:bg-white/10"
                              onClick={() => resetPassword(user)}
                              type="button"
                            >
                              <KeyRound size={14} aria-hidden="true" />
                              改密码
                            </button>
                            <button
                              className="flex items-center gap-1 rounded-xl border border-red-400/20 px-2 py-1 text-red-200 hover:bg-red-500/10"
                              onClick={() => deleteUser(user)}
                              type="button"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              删除
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {isOwner ? (
              <div className="grid gap-6">
                <section className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                  <div className="mb-5 flex items-center gap-2">
                    <SlidersHorizontal size={20} aria-hidden="true" />
                    <h2 className="text-base font-semibold">模型设置</h2>
                  </div>

                  <form onSubmit={saveSettings} className="space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-zinc-300">
                        模型来源
                      </span>
                      <select
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                        value={settings.MODEL_PROVIDER}
                        onChange={(event) =>
                          updateSettings({
                            MODEL_PROVIDER: event.target.value as
                              | "openai"
                              | "local_openai",
                          })
                        }
                      >
                        <option value="openai">OpenAI 云端</option>
                        <option value="local_openai">OpenAI 兼容接口</option>
                      </select>
                    </label>

                    {isOpenAIProvider ? (
                      <>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-zinc-300">
                            OpenAI 模型
                          </span>
                          <select
                            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                            value={settings.OPENAI_MODEL}
                            onChange={(event) =>
                              updateSettings({ OPENAI_MODEL: event.target.value })
                            }
                          >
                            {modelOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-zinc-300">
                            OpenAI API Key
                          </span>
                          <input
                            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                            placeholder={
                              settings.OPENAI_API_KEY_MASKED
                                ? `当前：${settings.OPENAI_API_KEY_MASKED}`
                                : "sk-..."
                            }
                            value={settings.OPENAI_API_KEY}
                            onChange={(event) =>
                              updateSettings({ OPENAI_API_KEY: event.target.value })
                            }
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-zinc-300">
                            Base URL
                          </span>
                          <input
                            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                            placeholder="https://api.example.com/v1"
                            value={settings.LOCAL_OPENAI_BASE_URL}
                            onChange={(event) =>
                              updateSettings({
                                LOCAL_OPENAI_BASE_URL: event.target.value,
                              })
                            }
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-zinc-300">
                            模型名称
                          </span>
                          {localModels.length > 0 ? (
                            <select
                              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                              value={settings.LOCAL_OPENAI_MODEL}
                              onChange={(event) =>
                                updateSettings({
                                  LOCAL_OPENAI_MODEL: event.target.value,
                                })
                              }
                            >
                              {localModels.map((model) => (
                                <option key={model} value={model}>
                                  {model}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                              placeholder="填写服务商提供的模型名"
                              value={settings.LOCAL_OPENAI_MODEL}
                              onChange={(event) =>
                                updateSettings({
                                  LOCAL_OPENAI_MODEL: event.target.value,
                                })
                              }
                            />
                          )}
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-sm font-medium text-zinc-300">
                            API Key
                          </span>
                          <input
                            className="h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
                            placeholder={
                              settings.LOCAL_OPENAI_API_KEY_MASKED
                                ? `当前：${settings.LOCAL_OPENAI_API_KEY_MASKED}`
                                : "可留空或填写 sk-..."
                            }
                            value={settings.LOCAL_OPENAI_API_KEY}
                            onChange={(event) =>
                              updateSettings({
                                LOCAL_OPENAI_API_KEY: event.target.value,
                              })
                            }
                          />
                        </label>
                      </>
                    )}

                    <button
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
                      disabled={savingSettings}
                      type="submit"
                    >
                      {savingSettings ? (
                        <Loader2 className="animate-spin" size={17} aria-hidden="true" />
                      ) : (
                        <Save size={17} aria-hidden="true" />
                      )}
                      保存模型设置
                    </button>
                    {!isOpenAIProvider ? (
                      <button
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white"
                        disabled={testingModel}
                        onClick={testModelSettings}
                        type="button"
                      >
                        {testingModel ? (
                          <Loader2
                            className="animate-spin"
                            size={17}
                            aria-hidden="true"
                          />
                        ) : null}
                        测试连接并读取模型
                      </button>
                    ) : null}
                  </form>
                </section>
              </div>
            ) : null}

            {isOwner ? (
              <section className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={20} aria-hidden="true" />
                    <h2 className="text-base font-semibold">提问行为日志</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-zinc-300 focus-within:border-white/25">
                      <Search size={15} aria-hidden="true" />
                      <input
                        className="w-44 bg-transparent outline-none placeholder:text-zinc-600"
                        placeholder="搜索用户档案"
                        value={archiveSearch}
                        onChange={(event) => setArchiveSearch(event.target.value)}
                      />
                    </label>
                    <button
                      className="h-9 rounded-xl border border-white/10 px-3 text-sm font-medium hover:bg-white/10"
                      onClick={refreshLogs}
                      type="button"
                    >
                      刷新
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-zinc-500">
                        <th className="py-2 pr-3 font-medium">最新提问时间</th>
                        <th className="py-2 pr-3 font-medium">用户</th>
                        <th className="py-2 pr-3 font-medium">身份</th>
                        <th className="py-2 pr-3 font-medium">最近内容</th>
                        <th className="py-2 pr-3 font-medium">档案</th>
                        <th className="py-2 pr-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredArchives.length === 0 ? (
                        <tr>
                          <td className="py-6 text-center text-zinc-500" colSpan={6}>
                            暂无匹配档案
                          </td>
                        </tr>
                      ) : (
                        filteredArchives.map((archive) => (
                          <tr key={archive.key} className="border-b border-white/10 last:border-0">
                            <td className="whitespace-nowrap py-3 pr-3 text-zinc-500">
                              {formatDate(archive.latestAt)}
                            </td>
                            <td className="py-3 pr-3 font-medium">{archive.username}</td>
                            <td className="py-3 pr-3">{roleLabel(archive.role)}</td>
                            <td className="max-w-[520px] py-3 pr-3">
                              <span className="line-clamp-3 whitespace-pre-wrap">
                                {archive.latestContent}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs text-zinc-300">
                                <FileText size={13} aria-hidden="true" />
                                {archive.username}
                                <span className="text-zinc-500">({archive.questionCount})</span>
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <button
                                className="rounded-xl border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={!archive.userId || loadingArchiveDetail}
                                onClick={() => openArchiveDetail(archive)}
                                type="button"
                              >
                                详情
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>

      {archiveDetail ? (
        <ArchiveDetailModal
          detail={archiveDetail}
          onClose={() => setArchiveDetail(null)}
        />
      ) : null}
      {presetEditor ? (
        <UserPresetModal
          draft={presetDraft}
          saving={savingUserPreset}
          user={presetEditor}
          onClose={() => {
            setPresetEditor(null);
            setPresetDraft("");
          }}
          onDraftChange={setPresetDraft}
          onSubmit={saveUserPreset}
        />
      ) : null}
    </main>
  );
}

function roleLabel(role: UserRole) {
  if (role === "owner") {
    return "所有者";
  }

  if (role === "admin") {
    return "管理员";
  }

  return "普通用户";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ArchiveDetailModal({
  detail,
  onClose,
}: {
  detail: ArchiveDetail;
  onClose: () => void;
}) {
  const latestConversation = detail.conversations[0] ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <section
        className="flex h-[78vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">
              {detail.user.username} 的档案详情
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              {roleLabel(detail.user.role)} · 只读查看 · 默认显示最新对话
            </p>
          </div>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          {!latestConversation ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              该用户暂无可查看对话，可能已被清空。
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-5">
              <div className="mb-2 text-center">
                <p className="text-sm font-medium text-zinc-300">
                  {latestConversation.title}
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  更新于 {formatDate(latestConversation.updatedAt)}
                </p>
              </div>
              {latestConversation.messages.map((message) => (
                <ReadOnlyMessage key={message.id} message={message} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function UserPresetModal({
  user,
  draft,
  saving,
  onDraftChange,
  onSubmit,
  onClose,
}: {
  user: AdminUser;
  draft: string;
  saving: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <section
        className="flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">
              {user.username} 的聊天预设
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              {roleLabel(user.role)} · 留空则使用全局{roleLabel(user.role)}预设
            </p>
          </div>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
            onClick={onClose}
            title="关闭"
            type="button"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col p-5">
          <textarea
            className="min-h-[320px] flex-1 resize-y rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
            placeholder="填写该用户专属 AI 人设、回答范围和拒答规则。"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 hover:text-white"
              onClick={() => onDraftChange("")}
              type="button"
            >
              恢复全局预设
            </button>
            <button
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
              disabled={saving}
              type="submit"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={17} aria-hidden="true" />
              ) : (
                <Save size={17} aria-hidden="true" />
              )}
              保存个人预设
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ReadOnlyMessage({ message }: { message: ArchiveMessage }) {
  const isUser = message.role === "user";

  return (
    <article className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[82%] whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-zinc-950 shadow-lg shadow-black/20"
            : "max-w-[82%] whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm leading-6 text-zinc-100 shadow-lg shadow-black/10"
        }
      >
        {message.content}
      </div>
    </article>
  );
}


