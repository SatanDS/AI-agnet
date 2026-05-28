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
        throw new Error(payload?.error ?? "Login failed.");
      }

      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="w-full max-w-sm rounded-lg border border-line bg-white p-6 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-brand text-white">
          <LockKeyhole size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink">AI Chat</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Username
          </span>
          <input
            className="h-11 w-full rounded-md border border-line px-3 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </span>
          <input
            className="h-11 w-full rounded-md border border-line px-3 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-medium text-white transition hover:bg-teal-800"
          type="submit"
          disabled={loading}
        >
          <LogIn size={18} aria-hidden="true" />
          {loading ? "Signing in" : "Sign in"}
        </button>
      </form>
    </section>
  );
}
