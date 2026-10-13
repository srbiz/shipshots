"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, Field, Input } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [busy, setBusy] = useState<"form" | "demo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: mode === "login" ? "demo@shipshots.dev" : "", password: mode === "login" ? "demo1234" : "" });

  const post = async (path: string, body?: unknown) => {
    const res = await fetch(`/api/v1/auth/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? "Something went wrong");
    }
    window.location.href = "/dashboard";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("form");
    try {
      await post(mode, mode === "login" ? { email: form.email, password: form.password } : form);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  const demo = async () => {
    setError(null);
    setBusy("demo");
    try {
      await post("demo");
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{mode === "login" ? "Welcome back" : "Create your workspace"}</h1>
      <p className="mt-1.5 text-sm text-zinc-400">
        {mode === "login" ? "Sign in to your local ShipShots studio." : "Generate store screenshots and preview videos in minutes."}
      </p>

      <button
        type="button"
        onClick={demo}
        disabled={!!busy}
        className="group mt-7 flex w-full items-center gap-3 rounded-xl border border-indigo-400/25 bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-cyan-400/10 p-3 text-left transition hover:border-indigo-400/50 disabled:opacity-60"
      >
        <div className="grid size-9 place-items-center rounded-lg bg-indigo-500/20 text-indigo-200">
          <Sparkles className="size-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{busy === "demo" ? "Preparing demo workspace…" : "Explore the demo workspace"}</div>
          <div className="text-xs text-zinc-400">3 apps · 15 screenshots · 3 preview videos</div>
        </div>
        <ArrowRight className="size-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
      </button>

      <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-600">
        <div className="h-px flex-1 bg-white/[0.07]" /> or with email <div className="h-px flex-1 bg-white/[0.07]" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "signup" && (
          <Field label="Name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ada Lovelace" autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@company.dev" autoComplete="email" />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
          <Input required type="password" minLength={mode === "signup" ? 8 : 1} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </Field>
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy === "form"} disabled={!!busy}>
          {mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-indigo-300 hover:text-indigo-200">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-300 hover:text-indigo-200">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
