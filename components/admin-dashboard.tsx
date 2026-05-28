"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Save,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";

type AdminUser = {
  id: string;
  username: string;
  isAdmin: boolean;
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

const emptySettings: ModelSettings = {
  MODEL_PROVIDER: "openai",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "gpt-5.5",
  LOCAL_OPENAI_BASE_URL: "",
  LOCAL_OPENAI_API_KEY: "",
  LOCAL_OPENAI_MODEL: "local-model",
};

export function AdminDashboard({ username }: { username: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<ModelSettings>(emptySettings);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    void loadAdminData();
  }, []);

  async function loadAdminData() {
    setLoading(true);
    setError("");

    try {
      const [usersResponse, settingsResponse] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/settings/model"),
      ]);

      if (usersResponse.status === 401 || settingsResponse.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!usersResponse.ok || !settingsResponse.ok) {
        throw new Error("Could not load admin data.");
      }

      const usersPayload = await usersResponse.json();
      const settingsPayload = await settingsResponse.json();

      setUsers(usersPayload.users);
      setSettings(settingsPayload.settings);
      setModelOptions(settingsPayload.modelOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }

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
          isAdmin: newIsAdmin,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Could not create user.");
      }

      setNewUsername("");
      setNewPassword("");
      setNewIsAdmin(false);
      setStatus("User created.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user.");
    }
  }

  async function loadUsers() {
    const response = await fetch("/api/admin/users");
    if (!response.ok) {
      throw new Error("Could not refresh users.");
    }
    const payload = await response.json();
    setUsers(payload.users);
  }

  async function toggleAdmin(user: AdminUser) {
    setStatus("");
    setError("");

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: !user.isAdmin }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Could not update user.");
      }

      setStatus("User updated.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user.");
    }
  }

  async function resetPassword(user: AdminUser) {
    const password = window.prompt(`New password for ${user.username}`);
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
        throw new Error(payload?.error ?? "Could not reset password.");
      }

      const payload = await response.json();
      if (payload.selfPasswordChanged) {
        window.location.href = "/login";
        return;
      }

      setStatus("Password reset.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    }
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Delete ${user.username}? This also deletes their chats.`)) {
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
        throw new Error(payload?.error ?? "Could not delete user.");
      }

      setStatus("User deleted.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete user.");
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
        throw new Error(payload?.error ?? "Could not save model settings.");
      }

      const payload = await response.json();
      setSettings(payload.settings);
      setStatus("Model settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save model settings.");
    } finally {
      setSavingSettings(false);
    }
  }

  function updateSettings(partial: Partial<ModelSettings>) {
    setSettings((current) => ({ ...current, ...partial }));
  }

  return (
    <main className="min-h-screen bg-mist text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">Admin Console</h1>
            <p className="mt-1 text-sm text-slate-500">Signed in as {username}</p>
          </div>
          <Link
            className="flex h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium hover:bg-slate-100"
            href="/"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Back to chat
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
            Loading admin data
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <div className="mb-5 flex items-center gap-2">
                <Shield size={20} aria-hidden="true" />
                <h2 className="text-base font-semibold">Users</h2>
              </div>

              <form onSubmit={createUser} className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
                <input
                  className="h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  placeholder="Username"
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                  required
                />
                <input
                  className="h-10 rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                  placeholder="Password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />
                <label className="flex h-10 items-center gap-2 rounded-md border border-line px-3 text-sm">
                  <input
                    checked={newIsAdmin}
                    onChange={(event) => setNewIsAdmin(event.target.checked)}
                    type="checkbox"
                  />
                  Admin
                </label>
                <button
                  className="flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-medium text-white hover:bg-teal-800"
                  type="submit"
                >
                  <UserPlus size={17} aria-hidden="true" />
                  Add
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">Username</th>
                      <th className="py-2 pr-3 font-medium">Role</th>
                      <th className="py-2 pr-3 font-medium">Chats</th>
                      <th className="py-2 pr-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-line last:border-0">
                        <td className="py-3 pr-3 font-medium">{user.username}</td>
                        <td className="py-3 pr-3">{user.isAdmin ? "Admin" : "User"}</td>
                        <td className="py-3 pr-3">{user._count?.conversations ?? 0}</td>
                        <td className="flex flex-wrap gap-2 py-3 pr-3">
                          <button
                            className="rounded-md border border-line px-2 py-1 hover:bg-slate-100"
                            onClick={() => toggleAdmin(user)}
                            type="button"
                          >
                            {user.isAdmin ? "Remove admin" : "Make admin"}
                          </button>
                          <button
                            className="flex items-center gap-1 rounded-md border border-line px-2 py-1 hover:bg-slate-100"
                            onClick={() => resetPassword(user)}
                            type="button"
                          >
                            <KeyRound size={14} aria-hidden="true" />
                            Password
                          </button>
                          <button
                            className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                            onClick={() => deleteUser(user)}
                            type="button"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <div className="mb-5 flex items-center gap-2">
                <Save size={20} aria-hidden="true" />
                <h2 className="text-base font-semibold">Model Settings</h2>
              </div>

              <form onSubmit={saveSettings} className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Provider
                  </span>
                  <select
                    className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                    value={settings.MODEL_PROVIDER}
                    onChange={(event) =>
                      updateSettings({
                        MODEL_PROVIDER: event.target.value as "openai" | "local_openai",
                      })
                    }
                  >
                    <option value="openai">OpenAI cloud</option>
                    <option value="local_openai">Local OpenAI-compatible</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    OpenAI model
                  </span>
                  <select
                    className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                    value={settings.OPENAI_MODEL}
                    onChange={(event) => updateSettings({ OPENAI_MODEL: event.target.value })}
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
                    OpenAI API key
                  </span>
                  <input
                    className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                    placeholder={
                      settings.OPENAI_API_KEY_MASKED
                        ? `Current: ${settings.OPENAI_API_KEY_MASKED}`
                        : "sk-..."
                    }
                    value={settings.OPENAI_API_KEY}
                    onChange={(event) =>
                      updateSettings({ OPENAI_API_KEY: event.target.value })
                    }
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Local base URL
                  </span>
                  <input
                    className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                    placeholder="http://192.168.1.50:8000/v1"
                    value={settings.LOCAL_OPENAI_BASE_URL}
                    onChange={(event) =>
                      updateSettings({ LOCAL_OPENAI_BASE_URL: event.target.value })
                    }
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Local model
                  </span>
                  <input
                    className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                    value={settings.LOCAL_OPENAI_MODEL}
                    onChange={(event) =>
                      updateSettings({ LOCAL_OPENAI_MODEL: event.target.value })
                    }
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">
                    Local API key
                  </span>
                  <input
                    className="h-10 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                    placeholder={
                      settings.LOCAL_OPENAI_API_KEY_MASKED
                        ? `Current: ${settings.LOCAL_OPENAI_API_KEY_MASKED}`
                        : "Optional"
                    }
                    value={settings.LOCAL_OPENAI_API_KEY}
                    onChange={(event) =>
                      updateSettings({ LOCAL_OPENAI_API_KEY: event.target.value })
                    }
                  />
                </label>

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
                  Save settings
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
