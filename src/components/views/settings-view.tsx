"use client";

import { Database, HardDrive, LogOut, ShieldCheck, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/client/api";
import { formatBytes } from "@/lib/export-paths";
import type { UserDTO } from "@/lib/types";
import { Button, Card, Field, Input, PageHeader } from "../ui";

export function SettingsView({ user, stats }: { user: UserDTO; stats: { projects: number; screenshots: number; videos: number; exports: number; exportBytes: number; assets: number } }) {
  const router = useRouter();
  const [profile, setProfile] = useState({ name: user.name, email: user.email });
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api("me", { method: "PATCH", body: profile });
      toast.success("Profile updated");
      router.refresh();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return toast.error("New passwords don’t match");
    setSavingPw(true);
    try {
      await api("me/password", { body: { current: pw.current, next: pw.next } });
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password changed");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <PageHeader eyebrow="Account" title="Settings" description="Profile, security and local workspace details." />
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <User className="size-4 text-indigo-300" /> Profile
          </h2>
          <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input required value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} maxLength={60} />
            </Field>
            <Field label="Email">
              <Input required type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between sm:col-span-2">
              <span className="text-xs text-zinc-500">Member since {new Date(user.createdAt).toLocaleDateString()}</span>
              <Button type="submit" variant="primary" loading={savingProfile}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="size-4 text-emerald-300" /> Password
          </h2>
          <form onSubmit={savePw} className="grid gap-4 sm:grid-cols-3">
            <Field label="Current password">
              <Input required type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
            </Field>
            <Field label="New password">
              <Input required type="password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password">
              <Input required type="password" minLength={8} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
            </Field>
            <div className="flex justify-end sm:col-span-3">
              <Button type="submit" loading={savingPw}>
                Change password
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Database className="size-4 text-cyan-300" /> Local workspace
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Projects", stats.projects],
              ["Screenshots", stats.screenshots],
              ["Preview videos", stats.videos],
              ["Captures", stats.assets],
              ["Exports", stats.exports],
              ["Export storage", formatBytes(stats.exportBytes)],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-inset ring-white/[0.06]">
                <div className="text-lg font-semibold text-white">{value}</div>
                <div className="text-[11px] text-zinc-500">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
            <HardDrive className="mt-0.5 size-3.5 shrink-0" />
            Everything — projects, captures and rendered media — is stored in the PostgreSQL database configured by <code className="text-zinc-300">DATABASE_URL</code>. Nothing leaves your machine.
          </p>
        </Card>

        <div className="flex justify-end">
          <Button
            variant="outline"
            icon={<LogOut />}
            onClick={async () => {
              await fetch("/api/v1/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
