"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  KeyRound,
  Loader2,
  Save,
  Shield,
  SlidersHorizontal,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { UserRole } from "@/lib/auth";

type AdminUser = {
  id: string;
  username: string;
  role: UserRole;
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

type BehaviorLog = {
  id: string;
  username: string;
  role: UserRole;
  action: string;
  content: string;
  createdAt: string;
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
  const [logs, setLogs] = useState<BehaviorLog[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPresets, setSavingPresets] = useState(false);
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
        setLogs(logsPayload.logs);
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
      setLogs(payload.logs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法刷新行为日志。");
    }
  }

  function updateSettings(partial: Partial<ModelSettings>) {
    setSettings((current) => ({ ...current, ...partial }));
  }

  function updatePresets(partial: Partial<PresetSettings>) {
    setPresets((current) => ({ ...current, ...partial }));
  }

  const isOpenAIProvider = settings.MODEL_PROVIDER === "openai";

  return (
    <main className="min-h-screen bg-mist text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">管理后台</h1>
            <p className="mt-1 text-sm text-slate-500">
              当前账号：{username} · {roleLabel(role)}
            </p>
          </div>
          <Link
            className="flex h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium hover:bg-slate-100"
            href="/"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            返回对话
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {status}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="animate-spin" size={18} aria-hidden="true" />
            正在加载后台数据
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <div className="mb-5 flex items-center gap-2">
                <Shield size={20} aria-hidden="true" />
                <h2 className="text-base font-semibold">用户管理</h2>
              </div>

              <form
                onSubmit={createUser}
                className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_160px_auto]"
              >
                <input
                  className="h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  placeholder="账号"
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                  required
                />
                <input
                  className="h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  placeholder="密码，至少 8 位"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <select
                  className="h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
                  className="flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-teal-800"
                  type="submit"
                >
                  <UserPlus size={17} aria-hidden="true" />
                  新增
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">账号</th>
                      <th className="py-2 pr-3 font-medium">身份</th>
                      <th className="py-2 pr-3 font-medium">对话数</th>
                      <th className="py-2 pr-3 font-medium">创建时间</th>
                      <th className="py-2 pr-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td className="py-6 text-center text-slate-500" colSpan={5}>
                          暂无可管理用户
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="border-b border-line last:border-0">
                          <td className="py-3 pr-3 font-medium">{user.username}</td>
                          <td className="py-3 pr-3">
                            {isOwner ? (
                              <select
                                className="h-9 rounded-md border border-line px-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
                          <td className="py-3 pr-3 text-slate-500">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="flex flex-wrap gap-2 py-3 pr-3">
                            <button
                              className="flex items-center gap-1 rounded-md border border-line px-2 py-1 hover:bg-slate-100"
                              onClick={() => resetPassword(user)}
                              type="button"
                            >
                              <KeyRound size={14} aria-hidden="true" />
                              改密码
                            </button>
                            <button
                              className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
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
              <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
                <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
                  <div className="mb-5 flex items-center gap-2">
                    <SlidersHorizontal size={20} aria-hidden="true" />
                    <h2 className="text-base font-semibold">模型设置</h2>
                  </div>

                  <form onSubmit={saveSettings} className="space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        模型来源
                      </span>
                      <select
                        className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
                          <span className="mb-1 block text-sm font-medium text-slate-700">
                            OpenAI 模型
                          </span>
                          <select
                            className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
                          <span className="mb-1 block text-sm font-medium text-slate-700">
                            OpenAI API Key
                          </span>
                          <input
                            className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
                          <span className="mb-1 block text-sm font-medium text-slate-700">
                            Base URL
                          </span>
                          <input
                            className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
                          <span className="mb-1 block text-sm font-medium text-slate-700">
                            模型名称
                          </span>
                          {localModels.length > 0 ? (
                            <select
                              className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
                              className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
                          <span className="mb-1 block text-sm font-medium text-slate-700">
                            API Key
                          </span>
                          <input
                            className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
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
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-teal-800"
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
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
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

                <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
                  <div className="mb-5 flex items-center gap-2">
                    <Save size={20} aria-hidden="true" />
                    <h2 className="text-base font-semibold">聊天预设</h2>
                  </div>

                  <form onSubmit={savePresets} className="space-y-4">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        普通用户预设
                      </span>
                      <textarea
                        className="min-h-36 w-full resize-y rounded-md border border-line px-3 py-2 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                        value={presets.USER_CHAT_PRESET}
                        onChange={(event) =>
                          updatePresets({ USER_CHAT_PRESET: event.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">
                        管理员预设
                      </span>
                      <textarea
                        className="min-h-36 w-full resize-y rounded-md border border-line px-3 py-2 text-sm leading-6 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                        value={presets.ADMIN_CHAT_PRESET}
                        onChange={(event) =>
                          updatePresets({ ADMIN_CHAT_PRESET: event.target.value })
                        }
                      />
                    </label>
                    <button
                      className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-teal-800"
                      disabled={savingPresets}
                      type="submit"
                    >
                      {savingPresets ? (
                        <Loader2 className="animate-spin" size={17} aria-hidden="true" />
                      ) : (
                        <Save size={17} aria-hidden="true" />
                      )}
                      保存聊天预设
                    </button>
                  </form>
                </section>
              </div>
            ) : null}

            {isOwner ? (
              <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={20} aria-hidden="true" />
                    <h2 className="text-base font-semibold">提问行为日志</h2>
                  </div>
                  <button
                    className="h-9 rounded-md border border-line px-3 text-sm font-medium hover:bg-slate-100"
                    onClick={refreshLogs}
                    type="button"
                  >
                    刷新
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-slate-500">
                        <th className="py-2 pr-3 font-medium">时间</th>
                        <th className="py-2 pr-3 font-medium">用户</th>
                        <th className="py-2 pr-3 font-medium">身份</th>
                        <th className="py-2 pr-3 font-medium">内容</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ? (
                        <tr>
                          <td className="py-6 text-center text-slate-500" colSpan={4}>
                            暂无提问记录
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log.id} className="border-b border-line last:border-0">
                            <td className="whitespace-nowrap py-3 pr-3 text-slate-500">
                              {formatDate(log.createdAt)}
                            </td>
                            <td className="py-3 pr-3 font-medium">{log.username}</td>
                            <td className="py-3 pr-3">{roleLabel(log.role)}</td>
                            <td className="max-w-[520px] py-3 pr-3">
                              <span className="line-clamp-3 whitespace-pre-wrap">
                                {log.content}
                              </span>
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
