import { ArrowRight, Bot, Download, FileArchive, Film, FolderKanban, Image as ImageIcon, Images, Plus, Terminal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/project-card";
import { Badge, Card, CodeBlock, EmptyState } from "@/components/ui";
import { formatBytes, timeAgo } from "@/lib/export-paths";
import { requireUser } from "@/lib/server/auth";
import { getStats, listExports, listKeys, listProjects } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [stats, projects, exports, keys] = await Promise.all([getStats(user.id), listProjects(user.id), listExports(user.id, { limit: 6 }), listKeys(user.id)]);
  const activeKeys = keys.filter((k) => !k.revokedAt);
  const first = projects[0];
  const statCards = [
    { label: "Projects", value: stats.projects, icon: FolderKanban, href: "/projects", tone: "from-indigo-500/20" },
    { label: "Screenshots", value: stats.screenshots, icon: Images, href: "/projects", tone: "from-cyan-500/20" },
    { label: "Preview videos", value: stats.videos, icon: Film, href: "/projects", tone: "from-violet-500/20" },
    { label: "Exports", value: stats.exports, icon: Download, href: "/exports", tone: "from-emerald-500/20", sub: formatBytes(stats.exportBytes) },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-500">Dashboard</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Welcome back, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-zinc-400">Store screenshots and preview videos for every app you ship.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/agent" className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/[0.06] px-3.5 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/[0.1]">
            <Bot className="size-4" /> Agent API
          </Link>
          <Link href="/projects?new=1" className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-500 px-3.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400">
            <Plus className="size-4" /> New project
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <Link key={s.label} href={s.href} className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br ${s.tone} to-transparent p-4 transition hover:border-white/15`}>
            <s.icon className="size-4 text-zinc-400" />
            <div className="mt-3 text-2xl font-semibold text-white">{s.value}</div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{s.label}</span>
              {s.sub && <span className="text-zinc-500">{s.sub}</span>}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Recent projects</h2>
            <Link href="/projects" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white">
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          {projects.length === 0 ? (
            <EmptyState
              icon={<FolderKanban />}
              title="Create your first project"
              description="A project holds one app's screenshots, device frames and preview videos."
              action={
                <Link href="/projects?new=1" className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-500 px-3.5 text-sm font-medium text-white hover:bg-indigo-400">
                  <Plus className="size-4" /> New project
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {projects.slice(0, 4).map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Terminal className="size-4 text-indigo-300" /> Agent quickstart
              </h2>
              <Badge tone={activeKeys.length ? "green" : "amber"}>{activeKeys.length ? `${activeKeys.length} active keys` : "No keys"}</Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">Let Claude Code, Cursor or a CI job render store-ready assets from simulator captures.</p>
            <CodeBlock
              className="mt-3"
              code={`curl -X POST $SHIPSHOTS_URL/api/v1/projects/${first?.id ?? "<id>"}/render \\
  -H "Authorization: Bearer $SHIPSHOTS_KEY" \\
  -d '{"layout":"fastlane"}' -o store.zip`}
            />
            <Link href="/agent" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200">
              Manage keys & docs <ArrowRight className="size-3" />
            </Link>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Recent exports</h2>
              <Link href="/exports" className="text-xs font-medium text-zinc-400 hover:text-white">
                All
              </Link>
            </div>
            {exports.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">Exports from the editor and API show up here.</p>
            ) : (
              <ul className="space-y-1">
                {exports.map((e) => {
                  const Icon = e.kind === "video" ? Film : e.kind === "archive" ? FileArchive : ImageIcon;
                  return (
                    <li key={e.id}>
                      <a href={`/api/v1/exports/${e.id}/download`} className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-white/[0.04]">
                        <div className="grid size-8 place-items-center rounded-lg bg-white/[0.05] text-zinc-400">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-zinc-200">{e.name}</div>
                          <div className="text-[11px] text-zinc-500">
                            {formatBytes(e.sizeBytes)} · {e.source === "api" ? "via API" : "editor"} · {timeAgo(e.createdAt)}
                          </div>
                        </div>
                        <Download className="size-3.5 text-zinc-600 group-hover:text-zinc-300" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
