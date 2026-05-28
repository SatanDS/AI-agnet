"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "登录失败。");
      }

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-950/80 p-6 text-zinc-100 shadow-2xl shadow-blue-950/20 backdrop-blur-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-950">
          <LockKeyhole size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">森岳 AI Agent</h1>
          <p className="mt-1 text-sm text-zinc-500">登录后继续使用</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-300">
            账号
          </span>
          <input
            className="h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-zinc-300">
            密码
          </span>
          <input
            className="h-11 w-full rounded-full border border-white/10 bg-white/5 px-4 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-white/25 focus:bg-white/8"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 font-medium text-zinc-950 transition hover:bg-zinc-200"
          type="submit"
          disabled={loading}
        >
          <LogIn size={18} aria-hidden="true" />
          {loading ? "正在登录" : "登录"}
        </button>
      </form>
    </section>
  );
}
