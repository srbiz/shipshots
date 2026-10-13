"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Copy, Download, Film, GripVertical, Images, LayoutTemplate, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { defaultPreviewSize, getVideoSize } from "@/lib/catalog";
import { api, errMsg } from "@/lib/client/api";
import { slugify, pad2, timeAgo } from "@/lib/export-paths";
import { downloadBlob, ensureFonts, loadImagesFor, renderToBlob, uploadExport } from "@/lib/render/client";
import type { ProjectDTO, ScreenshotDTO, TemplateDTO, VideoDTO } from "@/lib/types";
import { ExportDialog } from "../export-dialog";
import { AppIcon, PlatformBadges } from "../project-card";
import { ProjectFormModal } from "../project-form";
import { ShotCanvas } from "../shot-canvas";
import { TemplatePickerModal } from "../template-picker";
import { Badge, Button, Card, cn, ConfirmDialog, EmptyState, Menu, Segmented, Spinner } from "../ui";

export const videoDuration = (v: VideoDTO) => v.scenes.reduce((a, s) => a + s.duration, 0) + (v.settings.outro.enabled ? v.settings.outro.duration : 0);
export const videoThumbSize = (size: string) => ({ "ipad-13": "ipad-13", "android-promo": "android-phone", "iphone-55": "iphone-55" })[size] ?? "iphone-69";

export function ProjectView({ initial, templates, initialTab }: { initial: { project: ProjectDTO; screenshots: ScreenshotDTO[]; videos: VideoDTO[] }; templates: TemplateDTO[]; initialTab: "screenshots" | "videos" }) {
  const router = useRouter();
  const [project, setProject] = useState(initial.project);
  const [shots, setShots] = useState(initial.screenshots);
  const [videos, setVideos] = useState(initial.videos);
  const [tab, setTab] = useState(initialTab);
  const [sizeId, setSizeId] = useState(defaultPreviewSize(initial.project.platforms));
  const [pending, setPending] = useState<string[]>([]);
  const [modal, setModal] = useState<"edit" | "export" | "template" | "delete" | null>(null);
  const [exportIds, setExportIds] = useState<string[] | undefined>();
  const [delShot, setDelShot] = useState<ScreenshotDTO | null>(null);
  const [delVideo, setDelVideo] = useState<VideoDTO | null>(null);
  const [creatingVideo, setCreatingVideo] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const dragStart = useRef<string[]>([]);

  const mark = (id: string, on: boolean) => setPending((x) => (on ? [...x, id] : x.filter((y) => y !== id)));

  const addShot = async () => {
    const tempId = `temp-${Date.now()}`;
    const last = shots[shots.length - 1];
    const temp: ScreenshotDTO | null = last ? { ...last, id: tempId, name: `Screenshot ${shots.length + 1}`, position: shots.length, spec: { ...last.spec, headline: "New *headline*", subheadline: "Describe the benefit in one short line.", eyebrow: "" } } : null;
    if (temp) {
      setShots((s) => [...s, temp]);
      mark(tempId, true);
    }
    try {
      const created = await api<ScreenshotDTO>(`projects/${project.id}/screenshots`, { body: {} });
      setShots((s) => (temp ? s.map((x) => (x.id === tempId ? created : x)) : [...s, created]));
      toast.success("Screenshot added", { action: { label: "Edit", onClick: () => router.push(`/projects/${project.id}/screenshots/${created.id}`) } });
    } catch (e) {
      setShots((s) => s.filter((x) => x.id !== tempId));
      toast.error(errMsg(e));
    } finally {
      mark(tempId, false);
    }
  };

  const duplicateShot = async (shot: ScreenshotDTO) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    const idx = shots.findIndex((s) => s.id === shot.id);
    setShots((s) => [...s.slice(0, idx + 1), { ...shot, id: tempId, name: `${shot.name} copy` }, ...s.slice(idx + 1)]);
    mark(tempId, true);
    try {
      const created = await api<ScreenshotDTO>(`screenshots/${shot.id}/duplicate`, { method: "POST" });
      setShots((s) => s.map((x) => (x.id === tempId ? created : x)));
    } catch (e) {
      setShots((s) => s.filter((x) => x.id !== tempId));
      toast.error(errMsg(e));
    } finally {
      mark(tempId, false);
    }
  };

  const removeShot = async (shot: ScreenshotDTO) => {
    const snapshot = shots;
    setShots((s) => s.filter((x) => x.id !== shot.id));
    try {
      await api(`screenshots/${shot.id}`, { method: "DELETE" });
      setVideos((vs) => vs.map((v) => ({ ...v, scenes: v.scenes.filter((sc) => sc.screenshotId !== shot.id) })));
      toast.success("Screenshot deleted");
    } catch (e) {
      setShots(snapshot);
      toast.error(errMsg(e));
    }
  };

  const persistOrder = async (next: ScreenshotDTO[], prev: ScreenshotDTO[]) => {
    try {
      await api(`projects/${project.id}/screenshots/order`, { method: "PUT", body: { ids: next.map((s) => s.id) } });
    } catch (e) {
      setShots(prev);
      toast.error(errMsg(e));
    }
  };

  const move = (shot: ScreenshotDTO, dir: -1 | 1) => {
    const idx = shots.findIndex((s) => s.id === shot.id);
    const j = idx + dir;
    if (j < 0 || j >= shots.length) return;
    const next = [...shots];
    [next[idx], next[j]] = [next[j], next[idx]];
    const prev = shots;
    setShots(next);
    void persistOrder(next, prev);
  };

  const onDragOver = (overId: string) => {
    if (!dragId || dragId === overId) return;
    setShots((s) => {
      const from = s.findIndex((x) => x.id === dragId);
      const to = s.findIndex((x) => x.id === overId);
      if (from < 0 || to < 0) return s;
      const next = [...s];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };
  const onDragEnd = () => {
    const before = dragStart.current;
    setDragId(null);
    if (before.join() !== shots.map((s) => s.id).join()) {
      const prevList = before.map((id) => shots.find((s) => s.id === id)!).filter(Boolean);
      void persistOrder(shots, prevList);
    }
  };

  const quickDownload = async (shot: ScreenshotDTO) => {
    const idx = shots.findIndex((s) => s.id === shot.id);
    const t = toast.loading("Rendering…");
    try {
      await ensureFonts();
      const images = await loadImagesFor([shot.spec]);
      const format = sizeId.startsWith("android") || sizeId === "play-feature" ? "jpeg" : "png";
      const blob = await renderToBlob({ spec: shot.spec, sizeId, images, appName: project.name, brandColor: project.primaryColor, panorama: { index: idx, count: shots.length }, format });
      const name = `${slugify(project.name)}-${pad2(idx + 1)}-${sizeId}.${format === "jpeg" ? "jpg" : "png"}`;
      downloadBlob(blob, name);
      void uploadExport(blob, { name, kind: "image", projectId: project.id, meta: { size: sizeId, screenshotId: shot.id } }).catch(() => undefined);
      toast.success("Downloaded", { id: t, description: name });
    } catch (e) {
      toast.error(errMsg(e), { id: t });
    }
  };

  const applyTemplate = async (t: TemplateDTO) => {
    const snapshot = shots;
    setShots((s) => s.map((x) => ({ ...x, spec: { ...x.spec, ...t.spec } })));
    try {
      const updated = await api<ScreenshotDTO[]>(`projects/${project.id}/apply-template`, { body: { templateId: t.id } });
      setShots(updated);
      toast.success(`Applied “${t.name}” to ${updated.length} screenshots`);
    } catch (e) {
      setShots(snapshot);
      toast.error(errMsg(e));
    }
  };

  const createVideo = async () => {
    setCreatingVideo(true);
    try {
      const v = await api<VideoDTO>(`projects/${project.id}/videos`, { body: { name: `Preview ${videos.length + 1}` } });
      setVideos((vs) => [v, ...vs]);
      router.push(`/projects/${project.id}/videos/${v.id}`);
    } catch (e) {
      toast.error(errMsg(e));
      setCreatingVideo(false);
    }
  };

  const duplicateVideo = async (v: VideoDTO) => {
    const tempId = `temp-${crypto.randomUUID()}`;
    setVideos((vs) => [{ ...v, id: tempId, name: `${v.name} copy` }, ...vs]);
    mark(tempId, true);
    try {
      const created = await api<VideoDTO>(`videos/${v.id}/duplicate`, { method: "POST" });
      setVideos((vs) => vs.map((x) => (x.id === tempId ? created : x)));
    } catch (e) {
      setVideos((vs) => vs.filter((x) => x.id !== tempId));
      toast.error(errMsg(e));
    } finally {
      mark(tempId, false);
    }
  };

  const removeVideo = async (v: VideoDTO) => {
    const snapshot = videos;
    setVideos((vs) => vs.filter((x) => x.id !== v.id));
    try {
      await api(`videos/${v.id}`, { method: "DELETE" });
      toast.success("Preview video deleted");
    } catch (e) {
      setVideos(snapshot);
      toast.error(errMsg(e));
    }
  };

  const ios = project.platforms !== "android";
  const android = project.platforms !== "ios";
  const appVideos = videos.filter((v) => getVideoSize(v.size).store === "app-store");
  const checks = [
    ...(ios
      ? [
          { ok: shots.length >= 1 && shots.length <= 10, label: "App Store: 1–10 screenshots", detail: `${shots.length} in set` },
          { ok: shots.length >= 1, label: 'iPhone 6.9" + iPad 13" renders', detail: "Generated from the same set" },
          { ok: appVideos.some((v) => videoDuration(v) >= 15 && videoDuration(v) <= 30), label: "App preview 15–30 s", detail: appVideos.length ? `${appVideos.length} preview video(s)` : "Optional · recommended" },
        ]
      : []),
    ...(android
      ? [
          { ok: shots.length >= 2 && shots.length <= 8, label: "Google Play: 2–8 phone screenshots", detail: `${shots.length} in set` },
          { ok: shots.length >= 1, label: "Feature graphic 1024×500", detail: "Rendered from screenshot #1" },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="size-3.5" /> Projects
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <AppIcon name={project.name} c1={project.primaryColor} c2={project.accentColor} size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-white">{project.name}</h1>
            <p className="truncate text-sm text-zinc-400">{project.tagline || project.description || project.category}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PlatformBadges platforms={project.platforms} />
              {project.bundleId && <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-zinc-400">{project.bundleId}</code>}
              <span className="text-[11px] text-zinc-500">Edited {timeAgo(project.updatedAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<Pencil />} onClick={() => setModal("edit")}>
            Edit
          </Button>
          <Button
            variant="primary"
            icon={<Download />}
            disabled={!shots.length}
            onClick={() => {
              setExportIds(undefined);
              setModal("export");
            }}
          >
            Export all
          </Button>
          <Menu
            items={[
              {
                label: "Duplicate project",
                icon: <Copy />,
                onClick: async () => {
                  try {
                    const p = await api<ProjectDTO>(`projects/${project.id}/duplicate`, { method: "POST" });
                    toast.success("Project duplicated");
                    router.push(`/projects/${p.id}`);
                    router.refresh();
                  } catch (e) {
                    toast.error(errMsg(e));
                  }
                },
              },
              { label: "Delete project", icon: <Trash2 />, danger: true, onClick: () => setModal("delete") },
            ]}
          />
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 border-b border-white/[0.06] sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-1">
          {(
            [
              ["screenshots", "Screenshots", Images, shots.length],
              ["videos", "Preview videos", Film, videos.length],
            ] as const
          ).map(([id, label, Icon, n]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn("-mb-px flex items-center gap-2 border-b-2 px-3 pb-3 text-sm font-medium transition", tab === id ? "border-indigo-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300")}
            >
              <Icon className="size-4" /> {label}
              <span className="rounded-full bg-white/[0.06] px-1.5 text-[11px] text-zinc-400">{n}</span>
            </button>
          ))}
        </div>
        {tab === "screenshots" ? (
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <Segmented
              size="sm"
              value={sizeId}
              onChange={setSizeId}
              options={[
                ...(ios ? [{ value: "iphone-69", label: 'iPhone 6.9"' }, { value: "ipad-13", label: 'iPad 13"' }] : []),
                ...(android ? [{ value: "android-phone", label: "Android" }, { value: "play-feature", label: "Feature" }] : []),
              ]}
            />
            <Button size="sm" icon={<LayoutTemplate />} onClick={() => setModal("template")} disabled={!shots.length}>
              Apply template
            </Button>
            <Button size="sm" variant="primary" icon={<Plus />} onClick={addShot}>
              Add screenshot
            </Button>
          </div>
        ) : (
          <div className="pb-3">
            <Button size="sm" variant="primary" icon={<Plus />} onClick={createVideo} loading={creatingVideo} disabled={!shots.length}>
              New preview video
            </Button>
          </div>
        )}
      </div>

      {tab === "screenshots" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
          {shots.length === 0 ? (
            <EmptyState
              icon={<Images />}
              title="No screenshots in this set"
              description="Add a screenshot, then upload a simulator capture or pick one of the built-in mock screens."
              action={
                <Button variant="primary" icon={<Plus />} onClick={addShot}>
                  Add screenshot
                </Button>
              }
            />
          ) : (
            <div className={cn("grid gap-4", sizeId === "play-feature" ? "grid-cols-1 sm:grid-cols-2" : sizeId === "ipad-13" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5")}>
              {shots.map((s, i) => {
                const isPending = pending.includes(s.id);
                return (
                  <div
                    key={s.id}
                    draggable={!isPending}
                    onDragStart={(e) => {
                      dragStart.current = shots.map((x) => x.id);
                      setDragId(s.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      onDragOver(s.id);
                    }}
                    onDragEnd={onDragEnd}
                    className={cn("group relative transition", dragId === s.id && "scale-[0.97] opacity-40", isPending && "pointer-events-none")}
                  >
                    <Link href={`/projects/${project.id}/screenshots/${s.id}`} className="block" draggable={false}>
                      <div className="relative">
                        <ShotCanvas spec={s.spec} sizeId={sizeId} appName={project.name} brandColor={project.primaryColor} panorama={{ index: i, count: shots.length }} className="ring-1 ring-white/[0.08] transition group-hover:ring-indigo-400/50" />
                        {isPending && (
                          <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/40">
                            <Spinner className="size-6" />
                          </div>
                        )}
                        <div className="absolute left-2 top-2 grid size-6 place-items-center rounded-md bg-black/60 font-mono text-[11px] font-semibold text-white backdrop-blur">{i + 1}</div>
                        <div className="absolute right-2 top-2 cursor-grab rounded-md bg-black/60 p-1 text-zinc-300 opacity-0 backdrop-blur transition group-hover:opacity-100" title="Drag to reorder">
                          <GripVertical className="size-3.5" />
                        </div>
                      </div>
                    </Link>
                    <div className="mt-2 flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-zinc-200">{s.name}</div>
                        <div className="truncate text-[11px] text-zinc-500">{s.spec.headline.replace(/\*/g, "").replace(/\n/g, " ")}</div>
                      </div>
                      <Menu
                        items={[
                          { label: "Edit", icon: <Pencil />, onClick: () => router.push(`/projects/${project.id}/screenshots/${s.id}`) },
                          { label: "Duplicate", icon: <Copy />, onClick: () => duplicateShot(s) },
                          { label: "Quick download", icon: <Download />, onClick: () => quickDownload(s) },
                          {
                            label: "Export sizes…",
                            icon: <Download />,
                            onClick: () => {
                              setExportIds([s.id]);
                              setModal("export");
                            },
                          },
                          ...(i > 0 ? [{ label: "Move earlier", icon: <ArrowLeft />, onClick: () => move(s, -1) }] : []),
                          ...(i < shots.length - 1 ? [{ label: "Move later", icon: <ArrowRight />, onClick: () => move(s, 1) }] : []),
                          { label: "Delete", icon: <Trash2 />, danger: true, onClick: () => setDelShot(s) },
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
              <button onClick={addShot} className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 text-sm text-zinc-500 transition hover:border-indigo-400/40 hover:bg-indigo-500/[0.04] hover:text-zinc-300">
                <Plus className="size-5" /> Add screenshot
              </button>
            </div>
          )}
          <Card className="h-fit p-5">
            <h3 className="text-sm font-semibold text-white">Store readiness</h3>
            <p className="mt-1 text-xs text-zinc-500">Checks against current App Store Connect and Play Console rules.</p>
            <ul className="mt-4 space-y-3">
              {checks.map((c) => (
                <li key={c.label} className="flex gap-2.5">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />}
                  <div>
                    <div className="text-xs font-medium text-zinc-200">{c.label}</div>
                    <div className="text-[11px] text-zinc-500">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-zinc-500">Tip: drag cards to reorder. Panorama layouts flow continuously across neighbors.</p>
          </Card>
        </div>
      ) : videos.length === 0 ? (
        <EmptyState
          icon={<Film />}
          title="No preview videos yet"
          description={shots.length ? "Turn this screenshot set into an animated App Store preview with transitions, motion and an end card." : "Add screenshots first — videos are built from your screenshot set."}
          action={
            <Button variant="primary" icon={<Plus />} onClick={createVideo} loading={creatingVideo} disabled={!shots.length}>
              Create preview video
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {videos.map((v) => {
            const first = shots.find((s) => s.id === v.scenes[0]?.screenshotId);
            const dur = videoDuration(v);
            const vs = getVideoSize(v.size);
            const valid = vs.store !== "app-store" || (dur >= 15 && dur <= 30);
            const isPending = pending.includes(v.id);
            return (
              <div key={v.id} className={cn("group overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] transition hover:border-white/15", isPending && "pointer-events-none opacity-60")}>
                <Link href={`/projects/${project.id}/videos/${v.id}`} className="relative block h-56 overflow-hidden bg-stage">
                  <div className="absolute left-1/2 top-4 w-28 -translate-x-1/2 transition group-hover:-translate-y-1">
                    {first ? <ShotCanvas spec={first.spec} sizeId={videoThumbSize(v.size)} appName={project.name} brandColor={project.primaryColor} className="shadow-xl shadow-black/60 ring-1 ring-white/10" /> : <div className="aspect-[9/19] rounded-xl bg-white/5" />}
                  </div>
                  <div className="absolute bottom-3 right-3 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur">{dur.toFixed(1)}s</div>
                  <div className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                    <div className="grid size-12 place-items-center rounded-full bg-white/90 text-black shadow-xl">
                      <Film className="size-5" />
                    </div>
                  </div>
                </Link>
                <div className="flex items-start gap-2 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{v.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
                      <span>{vs.label}</span>·<span>{v.scenes.length} scenes</span>
                      <Badge tone={valid ? "green" : "amber"}>{valid ? (vs.store === "app-store" ? "15–30s ✓" : "Ready") : "Needs 15–30s"}</Badge>
                    </div>
                  </div>
                  <Menu
                    items={[
                      { label: "Open editor", icon: <Pencil />, onClick: () => router.push(`/projects/${project.id}/videos/${v.id}`) },
                      { label: "Duplicate", icon: <Copy />, onClick: () => duplicateVideo(v) },
                      { label: "Delete", icon: <Trash2 />, danger: true, onClick: () => setDelVideo(v) },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal === "edit" && (
        <ProjectFormModal
          open
          onClose={() => setModal(null)}
          project={project}
          onSaved={(p) => {
            setProject(p);
            router.refresh();
          }}
        />
      )}
      {modal === "export" && <ExportDialog open onClose={() => setModal(null)} project={project} shots={shots} onlyIds={exportIds} />}
      {modal === "template" && (
        <TemplatePickerModal
          open
          onClose={() => setModal(null)}
          templates={templates}
          sample={shots[0]?.spec}
          sizeId={sizeId === "play-feature" ? "iphone-69" : sizeId}
          appName={project.name}
          brandColor={project.primaryColor}
          title="Apply a template to every screenshot"
          description="Layout, background, typography and frame are replaced. Your copy and screens are kept."
          onPick={applyTemplate}
        />
      )}
      <ConfirmDialog
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title={`Delete ${project.name}?`}
        description="This permanently deletes the project, its screenshots and preview videos."
        onConfirm={async () => {
          try {
            await api(`projects/${project.id}`, { method: "DELETE" });
            toast.success("Project deleted");
            router.push("/projects");
            router.refresh();
          } catch (e) {
            toast.error(errMsg(e));
          }
        }}
      />
      <ConfirmDialog open={!!delShot} onClose={() => setDelShot(null)} title="Delete screenshot?" description={`“${delShot?.name}” will be removed from the set and from any preview videos.`} onConfirm={() => (delShot ? removeShot(delShot) : undefined)} />
      <ConfirmDialog open={!!delVideo} onClose={() => setDelVideo(null)} title="Delete preview video?" description={`“${delVideo?.name}” will be permanently deleted. Rendered MP4s stay in Exports.`} onConfirm={() => (delVideo ? removeVideo(delVideo) : undefined)} />
    </div>
  );
}
