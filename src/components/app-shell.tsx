"use client";

import { Bot, Download, FolderKanban, Images, LayoutDashboard, LayoutTemplate, LogOut, Menu as MenuIcon, Plus, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "./ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/assets", label: "Media library", icon: Images },
  { href: "/exports", label: "Exports", icon: Download },
  { href: "/agent", label: "Agent API", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-400 via-violet-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
        <div className="h-[18px] w-[11px] rounded-[3px] border-2 border-white/95" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-white">ShipShots</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-500">Store assets studio</div>
      </div>
    </div>
  );
}

export function AppShell({
  user,
  projects,
  children,
}: {
  user: { name: string; email: string };
  projects: { id: string; name: string; primaryColor: string; accentColor: string }[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const close = () => setOpen(false);

  const logout = async () => {
    setLoggingOut(true);
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/dashboard" onClick={close}>
          <Logo />
        </Link>
        <button className="rounded-md p-1 text-zinc-400 hover:text-white lg:hidden" onClick={close} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <div className="px-3">
        <Link
          href="/projects?new=1"
          onClick={close}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/[0.06] text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.1]"
        >
          <Plus className="size-4" /> New project
        </Link>
      </div>
      <nav className="mt-4 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={close}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              isActive(href) ? "bg-indigo-500/[0.14] text-white ring-1 ring-inset ring-indigo-400/20" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
            )}
          >
            <Icon className={cn("size-4", isActive(href) ? "text-indigo-300" : "text-zinc-500 group-hover:text-zinc-300")} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Your apps</div>
        {projects.length === 0 && <div className="px-3 text-xs text-zinc-600">No apps yet</div>}
        {projects.slice(0, 8).map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            onClick={close}
            className={cn("flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition", pathname.startsWith(`/projects/${p.id}`) ? "bg-white/[0.06] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200")}
          >
            <span className="grid size-5 place-items-center rounded-md text-[10px] font-bold text-white" style={{ background: `linear-gradient(135deg, ${p.primaryColor}, ${p.accentColor})` }}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
      </div>
      <div className="border-t border-white/[0.06] p-3">
        <div className="mb-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-zinc-500">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          Local render server online
        </div>
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800 text-xs font-semibold text-white ring-1 ring-white/10">
            {user.name
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-zinc-200">{user.name}</div>
            <div className="truncate text-xs text-zinc-500">{user.email}</div>
          </div>
          <button onClick={logout} disabled={loggingOut} className="rounded-md p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 border-r border-white/[0.06] bg-[#0c0d13] transition-transform duration-200 lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        {sidebar}
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden" onClick={close} />}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#0a0b10]/85 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-zinc-300 hover:bg-white/10" aria-label="Open menu">
            <MenuIcon className="size-5" />
          </button>
          <Logo />
          <div className="w-8" />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
