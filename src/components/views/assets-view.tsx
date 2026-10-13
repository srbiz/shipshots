"use client";

import { Copy, Download, FolderInput, Images, Pencil, Search, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, errMsg, uploadFile } from "@/lib/client/api";
import { formatBytes, timeAgo } from "@/lib/export-paths";
import { assetUrl } from "@/lib/render/client";
import type { AssetDTO } from "@/lib/types";
import { Badge, Button, cn, ConfirmDialog, EmptyState, Field, Input, Menu, Modal, PageHeader, Select, Spinner } from "../ui";

type ProjectLite = { id: string; name: string };
type Pending = { id: string; name: string; preview: string };

const KNOWN: Record<string, string> = {
  "1320x2868": 'iPhone 16 Pro Max',
  "1290x2796": 'iPhone 15 Pro Max',
  "1206x2622": 'iPhone 16 Pro',
  "1179x2556": 'iPhone 15 / 16',
  "1170x2532": 'iPhone 13 / 14',
  "1284x2778": 'iPhone 12 Pro Max',
  "1242x2688": 'iPhone 11 Pro Max',
  "1242x2208": 'iPhone 8 Plus',
  "2064x2752": 'iPad Pro 13"',
  "2048x2732": 'iPad Pro 12.9"',
  "1668x2388": 'iPad Pro 11"',
  "1640x2360": "iPad Air",
};
export function captureLabel(w: number, h: number): string {
  const k = KNOWN[`${Math.min(w, h)}x${Math.max(w, h)}`];
  if (k) return k;
  const r = Math.max(w, h) / Math.min(w, h);
  return r > 1.9 ? "Android phone" : r > 1.5 ? "Phone" : "Tablet";
}

export function AssetsView({ initial, projects }: { initial: AssetDTO[]; projects: ProjectLite[] }) {
  const [assets, setAssets] = useState(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [projectFilter, setProjectFilter] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AssetDTO | null>(null);
  const [toDelete, setToDelete] = useState<AssetDTO | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name;

  const uploadAll = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return toast.error("Only PNG, JPEG or WebP images are supported");
    const targetProject = projectFilter !== "all" && projectFilter !== "none" ? projectFilter : "";
    await Promise.all(
      list.map(async (file, i) => {
        const p: Pending = { id: `up-${Date.now()}-${i}`, name: file.name, preview: URL.createObjectURL(file) };
        setPending((x) => [p, ...x]);
        try {
          const a = await uploadFile<AssetDTO>(file, targetProject ? { projectId: targetProject } : {});
          setAssets((x) => [a, ...x]);
        } catch (e) {
          toast.error(`${file.name}: ${errMsg(e)}`);
        } finally {
          setPending((x) => x.filter((y) => y.id !== p.id));
          URL.revokeObjectURL(p.preview);
        }
      }),
    );
    toast.success(`Uploaded ${list.length} capture${list.length === 1 ? "" : "s"}`);
  };

  const remove = async (a: AssetDTO) => {
    const snapshot = assets;
    setAssets((x) => x.filter((y) => y.id !== a.id));
    try {
      await api(`assets/${a.id}`, { method: "DELETE" });
      toast.success("Capture deleted");
    } catch (e) {
      setAssets(snapshot);
      toast.error(errMsg(e));
    }
  };

  const filtered = assets.filter((a) => (projectFilter === "all" || (projectFilter === "none" ? !a.projectId : a.projectId === projectFilter)) && (!q || a.name.toLowerCase().includes(q.toLowerCase())));
  const total = assets.reduce((s, a) => s + a.sizeBytes, 0);

  return (
    <div
      className="relative mx-auto min-h-[80vh] max-w-7xl px-4 py-8 sm:px-8"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) void uploadAll(e.dataTransfer.files);
      }}
    >
      <PageHeader
        eyebrow="Library"
        title="Media library"
        description={`Simulator and emulator captures used as screen content · ${assets.length} files · ${formatBytes(total)}`}
        actions={
          <>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => e.target.files && uploadAll(e.target.files).finally(() => (e.target.value = ""))} />
            <Button variant="primary" icon={<Upload />} onClick={() => inputRef.current?.click()}>
              Upload captures
            </Button>
          </>
        }
      />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search captures" className="pl-9" />
        </div>
        <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="sm:w-56">
          <option value="all">All projects</option>
          <option value="none">Unassigned</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {assets.length === 0 && pending.length === 0 ? (
        <EmptyState
          icon={<Images />}
          title="No captures yet"
          description="Drop PNGs from `xcrun simctl io booted screenshot` or `adb exec-out screencap -p` here — or let your coding agent upload them via the API."
          action={
            <Button variant="primary" icon={<Upload />} onClick={() => inputRef.current?.click()}>
              Upload captures
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {pending.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
              <div className="relative aspect-[9/16] bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt="" className="h-full w-full object-cover object-top opacity-40" />
                <div className="absolute inset-0 grid place-items-center">
                  <Spinner className="size-6 text-white" />
                </div>
              </div>
              <div className="truncate p-2.5 text-xs text-zinc-400">{p.name}</div>
            </div>
          ))}
          {filtered.map((a) => (
            <div key={a.id} className="group overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] transition hover:border-white/15">
              <a href={assetUrl(a.id)} target="_blank" rel="noreferrer" className="block aspect-[9/16] overflow-hidden bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(a.id)} alt={a.name} loading="lazy" className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]" />
              </a>
              <div className="flex items-start gap-1 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-zinc-200">{a.name}</div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {captureLabel(a.width, a.height)} · {a.width}×{a.height}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {projectName(a.projectId) ? <Badge tone="indigo">{projectName(a.projectId)}</Badge> : <Badge>Unassigned</Badge>}
                    <span className="text-[10px] text-zinc-600">{timeAgo(a.createdAt)}</span>
                  </div>
                </div>
                <Menu
                  items={[
                    { label: "Rename / move", icon: <Pencil />, onClick: () => setEditing(a) },
                    { label: "Copy asset ID", icon: <Copy />, onClick: () => navigator.clipboard.writeText(a.id).then(() => toast.success("Asset ID copied")) },
                    { label: "Download", icon: <Download />, onClick: () => window.open(assetUrl(a.id), "_blank") },
                    { label: "Delete", icon: <Trash2 />, danger: true, onClick: () => setToDelete(a) },
                  ]}
                />
              </div>
            </div>
          ))}
          {filtered.length === 0 && pending.length === 0 && <p className="col-span-full py-12 text-center text-sm text-zinc-500">No captures match these filters.</p>}
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-indigo-500/10 backdrop-blur-[2px]">
          <div className="rounded-2xl border-2 border-dashed border-indigo-400 bg-[#111319]/90 px-10 py-8 text-center">
            <FolderInput className="mx-auto size-8 text-indigo-300" />
            <div className="mt-2 text-sm font-medium text-white">Drop captures to upload</div>
          </div>
        </div>
      )}
      {editing && (
        <EditAssetModal
          asset={editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={(a) => setAssets((x) => x.map((y) => (y.id === a.id ? a : y)))}
        />
      )}
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Delete capture?" description="Screenshots using this capture will show a placeholder until you pick another screen." onConfirm={() => (toDelete ? remove(toDelete) : undefined)} />
    </div>
  );
}

function EditAssetModal({ asset, projects, onClose, onSaved }: { asset: AssetDTO; projects: ProjectLite[]; onClose: () => void; onSaved: (a: AssetDTO) => void }) {
  const [name, setName] = useState(asset.name);
  const [projectId, setProjectId] = useState(asset.projectId ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const optimistic = { ...asset, name, projectId: projectId || null };
    onSaved(optimistic);
    try {
      onSaved(await api<AssetDTO>(`assets/${asset.id}`, { method: "PATCH", body: { name, projectId: projectId || null } }));
      toast.success("Capture updated");
      onClose();
    } catch (err) {
      onSaved(asset);
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Edit capture"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="asset-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="asset-form" onSubmit={save} className="space-y-4">
        <Field label="File name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Project">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Unassigned</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <p className={cn("text-[11px] text-zinc-500")}>
          {asset.width}×{asset.height} · {formatBytes(asset.sizeBytes)} · {asset.mimeType}
        </p>
      </form>
    </Modal>
  );
}
