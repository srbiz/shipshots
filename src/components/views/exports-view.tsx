"use client";

import { Download, FileArchive, Film, Image as ImageIcon, Link2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/client/api";
import { formatBytes, timeAgo } from "@/lib/export-paths";
import type { ExportDTO } from "@/lib/types";
import { Badge, Button, cn, EmptyState, Modal, PageHeader, Segmented, Select } from "../ui";

type ProjectLite = { id: string; name: string };
const fileUrl = (id: string, inline = false) => `/api/v1/exports/${id}/download${inline ? "?inline=1" : ""}`;

export function ExportsView({ initial, projects }: { initial: ExportDTO[]; projects: ProjectLite[] }) {
  const [items, setItems] = useState(initial);
  const [kind, setKind] = useState<"all" | ExportDTO["kind"]>("all");
  const [projectId, setProjectId] = useState("all");
  const [preview, setPreview] = useState<ExportDTO | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = items.filter((e) => (kind === "all" || e.kind === kind) && (projectId === "all" || e.projectId === projectId));
  const total = items.reduce((s, e) => s + e.sizeBytes, 0);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setItems(await api<ExportDTO[]>("exports"));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setRefreshing(false);
    }
  };

  const remove = async (e: ExportDTO) => {
    const snapshot = items;
    setItems((x) => x.filter((y) => y.id !== e.id));
    if (preview?.id === e.id) setPreview(null);
    try {
      await api(`exports/${e.id}`, { method: "DELETE" });
      toast.success(`Deleted ${e.name}`);
    } catch (err) {
      setItems(snapshot);
      toast.error(errMsg(err));
    }
  };

  const copyCurl = (e: ExportDTO) => {
    const cmd = `curl -H "Authorization: Bearer $SHIPSHOTS_KEY" -o "${e.name}" ${window.location.origin}${fileUrl(e.id)}`;
    navigator.clipboard.writeText(cmd).then(() => toast.success("curl command copied"));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <PageHeader
        eyebrow="Library"
        title="Exports"
        description={`Every rendered PNG, ZIP and MP4 — from the editor and from agents · ${items.length} files · ${formatBytes(total)}`}
        actions={
          <Button icon={<RefreshCw className={cn(refreshing && "animate-spin")} />} onClick={refresh} disabled={refreshing}>
            Refresh
          </Button>
        }
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "All" },
            { value: "image", label: "Images" },
            { value: "video", label: "Videos" },
            { value: "archive", label: "ZIP archives" },
          ]}
        />
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="sm:w-56">
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Download />}
          title={items.length ? "Nothing matches these filters" : "No exports yet"}
          description={items.length ? "Try a different type or project." : "Export screenshots or render a preview video — files land here so you (and your agents) can download them again anytime."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((e) => {
            const Icon = e.kind === "video" ? Film : e.kind === "archive" ? FileArchive : ImageIcon;
            return (
              <div key={e.id} className="group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] transition hover:border-white/15">
                <button type="button" onClick={() => e.kind !== "archive" && setPreview(e)} className={cn("relative block h-44 w-full overflow-hidden bg-stage", e.kind === "archive" && "cursor-default")}>
                  {e.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(e.id, true)} alt={e.name} loading="lazy" className="mx-auto h-full object-contain py-3 drop-shadow-2xl transition group-hover:scale-[1.03]" />
                  ) : e.kind === "video" ? (
                    <video src={fileUrl(e.id, true)} muted playsInline preload="metadata" className="mx-auto h-full py-3" />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <div className="text-center">
                        <FileArchive className="mx-auto size-10 text-indigo-300" />
                        <div className="mt-2 text-xs text-zinc-400">{typeof e.meta.files === "number" ? `${e.meta.files} files` : "ZIP archive"}</div>
                        {e.meta.layout === "fastlane" && <Badge tone="cyan" className="mt-1.5">fastlane layout</Badge>}
                      </div>
                    </div>
                  )}
                  <div className="absolute left-2 top-2">
                    <Badge tone={e.source === "api" ? "violet" : "neutral"}>{e.source === "api" ? "via API" : "Editor"}</Badge>
                  </div>
                </button>
                <div className="flex items-start gap-3 p-3.5">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-zinc-400">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-zinc-200" title={e.name}>
                      {e.name}
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {[e.projectName, e.width && e.height ? `${e.width}×${e.height}` : null, e.durationSec ? `${e.durationSec.toFixed(1)}s` : null, formatBytes(e.sizeBytes)].filter(Boolean).join(" · ")}
                    </div>
                    <div className="text-[10px] text-zinc-600">{timeAgo(e.createdAt)}</div>
                  </div>
                  <div className="flex items-center">
                    <a href={fileUrl(e.id)} className="grid size-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white" title="Download" aria-label="Download">
                      <Download className="size-4" />
                    </a>
                    <button type="button" onClick={() => copyCurl(e)} className="grid size-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white" title="Copy curl command" aria-label="Copy curl command">
                      <Link2 className="size-4" />
                    </button>
                    <button type="button" onClick={() => remove(e)} className="grid size-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300" title="Delete" aria-label="Delete">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        size="lg"
        title={preview?.name ?? ""}
        description={preview ? [preview.projectName, preview.width && preview.height ? `${preview.width}×${preview.height}` : null, formatBytes(preview.sizeBytes)].filter(Boolean).join(" · ") : undefined}
        footer={
          preview && (
            <a href={fileUrl(preview.id)} className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-500 px-3.5 text-sm font-medium text-white hover:bg-indigo-400">
              <Download className="size-4" /> Download
            </a>
          )
        }
      >
        {preview?.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(preview.id, true)} alt={preview.name} className="mx-auto max-h-[65vh] rounded-lg" />
        )}
        {preview?.kind === "video" && <video src={fileUrl(preview.id, true)} controls autoPlay muted loop playsInline className="mx-auto max-h-[65vh] rounded-lg bg-black" />}
      </Modal>
    </div>
  );
}
