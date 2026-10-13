"use client";

import { ArrowDown, ArrowLeft, ArrowUp, Check, CheckCircle2, CircleAlert, Clapperboard, Download, Film, Loader2, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getVideoSize, MOTIONS, TRANSITIONS, VIDEO_SIZES } from "@/lib/catalog";
import { api, errMsg } from "@/lib/client/api";
import { slugify } from "@/lib/export-paths";
import type { ImageMap } from "@/lib/render/canvas-utils";
import { downloadBlob, ensureFonts, loadImagesFor, uploadExport } from "@/lib/render/client";
import { buildOutro, renderVideoFrame, videoTimeline, type VideoInput } from "@/lib/render/engine";
import { exportVideo } from "@/lib/render/video-export";
import { randomId, type MotionKind, type ProjectDTO, type ScreenshotDTO, type TransitionKind, type VideoDTO, type VideoScene, type VideoSettings } from "@/lib/types";
import { ShotCanvas } from "../shot-canvas";
import { Badge, Button, cn, CodeBlock, Field, Input, Modal, Select, Slider, Toggle } from "../ui";
import { videoThumbSize } from "./project-view";

type RenderState =
  | { state: "idle" }
  | { state: "running"; progress: number }
  | { state: "done"; url: string; filename: string; blob: Blob; hasAudio: boolean; method: string; ext: string; saved: boolean | null }
  | { state: "error"; error: string };

export function VideoEditor({ project, shots, initial }: { project: ProjectDTO; shots: ScreenshotDTO[]; initial: VideoDTO }) {
  const [video, setVideo] = useState(initial);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [images, setImages] = useState<ImageMap>({});
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [render, setRender] = useState<RenderState>({ state: "idle" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const videoRef = useRef(video);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const vsize = getVideoSize(video.size);
  const shotIndex = useMemo(() => new Map(shots.map((s, i) => [s.id, i])), [shots]);

  const input: VideoInput = useMemo(() => {
    const scenes = video.scenes
      .filter((sc) => shotIndex.has(sc.screenshotId))
      .map((sc) => {
        const i = shotIndex.get(sc.screenshotId)!;
        return { spec: shots[i].spec, duration: sc.duration, transition: sc.transition, motion: sc.motion, panorama: { index: i, count: shots.length } };
      });
    const firstSpec = scenes[0]?.spec;
    return { scenes, outro: buildOutro(project, video.settings, firstSpec?.background, firstSpec?.textColor), transitionDuration: video.settings.transitionDuration };
  }, [video, shots, shotIndex, project]);
  const timeline = useMemo(() => videoTimeline(input), [input]);
  const total = timeline.total;

  // ---------- persistence ----------
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    dirty.current = false;
    setSaveState("saving");
    const v = videoRef.current;
    try {
      await api(`videos/${v.id}`, { method: "PATCH", body: { name: v.name, size: v.size, scenes: v.scenes, settings: v.settings } });
      if (!dirty.current) setSaveState("saved");
    } catch (e) {
      dirty.current = true;
      setSaveState("error");
      toast.error(`Autosave failed: ${errMsg(e)}`);
    }
  }, []);

  const update = useCallback(
    (patch: Partial<VideoDTO>) => {
      const next = { ...videoRef.current, ...patch };
      videoRef.current = next;
      setVideo(next);
      dirty.current = true;
      setSaveState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 650);
    },
    [flush],
  );
  const setScenes = (scenes: VideoScene[]) => update({ scenes });
  const setSettings = (patch: Partial<VideoSettings>) => update({ settings: { ...videoRef.current.settings, ...patch } });
  const setOutro = (patch: Partial<VideoSettings["outro"]>) => setSettings({ outro: { ...videoRef.current.settings.outro, ...patch } });

  useEffect(() => {
    const onHide = () => {
      if (!dirty.current) return;
      dirty.current = false;
      const v = videoRef.current;
      void fetch(`/api/v1/videos/${v.id}`, { method: "PATCH", keepalive: true, headers: { "content-type": "application/json", "x-requested-with": "shipshots" }, body: JSON.stringify({ name: v.name, size: v.size, scenes: v.scenes, settings: v.settings }) });
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, []);

  // ---------- player ----------
  useEffect(() => {
    let alive = true;
    Promise.all([ensureFonts(), loadImagesFor(shots.map((s) => s.spec))]).then(([, imgs]) => {
      if (!alive) return;
      setImages(imgs);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [shots]);

  const draw = useCallback(
    (t: number) => {
      const c = canvasRef.current;
      if (!c || !ready) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(c.clientWidth * dpr));
      const h = Math.max(1, Math.round((w * vsize.height) / vsize.width));
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const s = w / vsize.width;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      renderVideoFrame(ctx, input, Math.min(t, Math.max(0, total - 0.001)), { width: vsize.width, height: vsize.height, family: vsize.family, images, appName: project.name, brandColor: project.primaryColor, pxScale: s, time: t });
    },
    [ready, input, images, vsize, total, project],
  );

  useEffect(() => {
    if (!playing) {
      draw(timeRef.current);
      return;
    }
    let raf = 0;
    let lastUi = 0;
    const start = performance.now() - timeRef.current * 1000;
    const tick = (now: number) => {
      let t = (now - start) / 1000;
      if (t >= total) {
        t = total;
        timeRef.current = 0;
        setTime(0);
        setPlaying(false);
        draw(0);
        return;
      }
      timeRef.current = t;
      draw(t);
      if (now - lastUi > 80) {
        lastUi = now;
        setTime(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, draw, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const seek = (t: number) => {
    timeRef.current = Math.max(0, Math.min(total, t));
    setTime(timeRef.current);
    if (!playing) draw(timeRef.current);
  };

  // ---------- render ----------
  const startRender = async () => {
    await flush();
    setPlaying(false);
    abortRef.current = new AbortController();
    setRender({ state: "running", progress: 0 });
    try {
      const res = await exportVideo({
        input,
        width: vsize.width,
        height: vsize.height,
        fps: 30,
        base: { family: vsize.family, images, appName: project.name, brandColor: project.primaryColor },
        onProgress: (p) => setRender((r) => (r.state === "running" ? { state: "running", progress: p } : r)),
        signal: abortRef.current.signal,
      });
      const filename = `${slugify(project.name)}-${slugify(video.name)}-${vsize.width}x${vsize.height}.${res.ext}`;
      const url = URL.createObjectURL(res.blob);
      setRender({ state: "done", url, filename, blob: res.blob, hasAudio: res.hasAudio, method: res.method, ext: res.ext, saved: null });
      try {
        await uploadExport(res.blob, { name: filename, kind: "video", projectId: project.id, width: vsize.width, height: vsize.height, durationSec: Number(total.toFixed(2)), meta: { videoId: video.id, size: vsize.id, codec: res.ext === "mp4" ? "h264" : "webm", audio: res.hasAudio, fps: 30 } });
        setRender((r) => (r.state === "done" ? { ...r, saved: true } : r));
      } catch (e) {
        setRender((r) => (r.state === "done" ? { ...r, saved: false } : r));
        toast.error(`Could not save to library: ${errMsg(e)}`);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        setRender({ state: "idle" });
        toast("Render cancelled");
      } else setRender({ state: "error", error: errMsg(e) });
    }
  };

  const closeRender = () => {
    if (render.state === "running") abortRef.current?.abort();
    if (render.state === "done") URL.revokeObjectURL(render.url);
    setRender({ state: "idle" });
  };

  const appStore = vsize.store === "app-store";
  const durationOk = !appStore || (total >= 15 && total <= 30);
  const missing = video.scenes.length - input.scenes.length;

  const moveScene = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= video.scenes.length) return;
    const next = [...video.scenes];
    [next[i], next[j]] = [next[j], next[i]];
    setScenes(next);
  };
  const patchScene = (id: string, patch: Partial<VideoScene>) => setScenes(video.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col lg:h-screen lg:min-h-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#0c0d13] px-3 py-2 sm:px-4">
        <Link href={`/projects/${project.id}?tab=videos`} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-400 hover:bg-white/[0.05] hover:text-white">
          <ArrowLeft className="size-4" /> <span className="hidden max-w-32 truncate sm:inline">{project.name}</span>
        </Link>
        <div className="h-5 w-px bg-white/10" />
        <input value={video.name} onChange={(e) => update({ name: e.target.value })} className="w-44 min-w-0 rounded-md bg-transparent px-2 py-1 text-sm font-medium text-white outline-none ring-indigo-400/50 hover:bg-white/[0.04] focus:ring-2 sm:w-64" maxLength={80} aria-label="Video name" />
        <span className={cn("flex items-center gap-1 text-[11px]", saveState === "error" ? "text-red-400" : "text-zinc-500")}>
          {saveState === "saving" ? <Loader2 className="size-3 animate-spin" /> : saveState === "saved" ? <Check className="size-3 text-emerald-400" /> : <span className="size-1.5 rounded-full bg-amber-400" />}
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Not saved" : "Unsaved"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Badge tone={durationOk ? "green" : "amber"}>
            {total.toFixed(1)}s {appStore ? (durationOk ? "· App Store ✓" : "· needs 15–30s") : ""}
          </Badge>
          <Button variant="primary" size="sm" icon={<Clapperboard />} onClick={startRender} disabled={!input.scenes.length || !ready}>
            Render {vsize.store === "app-store" ? "MP4" : "video"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Player */}
        <section className="bg-stage flex min-h-[70vh] min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
            <div className="relative" style={{ width: `min(100%, calc((100vh - 250px) * ${vsize.width / vsize.height}), 440px)` }}>
              <canvas ref={canvasRef} className="block w-full rounded-xl bg-black shadow-2xl shadow-black/60 ring-1 ring-white/10" style={{ aspectRatio: `${vsize.width} / ${vsize.height}` }} />
              {!ready && <div className="skeleton absolute inset-0 rounded-xl" />}
              {ready && !input.scenes.length && (
                <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/70 p-6 text-center text-sm text-zinc-400">Add scenes from your screenshot set to start building the preview.</div>
              )}
            </div>
          </div>
          <div className="border-t border-white/[0.06] bg-black/30 px-4 py-3">
            <div className="mb-2 flex h-7 overflow-hidden rounded-md ring-1 ring-white/[0.08]">
              {timeline.segments.map((seg, i) => {
                const active = time >= seg.start && time < seg.start + seg.duration;
                const sc = seg.kind === "scene" ? video.scenes.filter((x) => shotIndex.has(x.screenshotId))[seg.index] : null;
                const shot = sc ? shots[shotIndex.get(sc.screenshotId)!] : null;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => seek(seg.start + 0.01)}
                    className={cn("flex min-w-0 items-center justify-center border-r border-black/40 px-1 text-[10px] font-medium transition last:border-r-0", active ? "bg-indigo-500/40 text-white" : "bg-white/[0.05] text-zinc-400 hover:bg-white/[0.1]")}
                    style={{ width: `${(seg.duration / Math.max(0.01, total)) * 100}%` }}
                    title={shot ? shot.name : "End card"}
                  >
                    <span className="truncate">{shot ? shot.name : "End card"}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <Button size="icon" variant="primary" onClick={() => setPlaying((p) => !p)} disabled={!ready || !input.scenes.length} title="Play / pause (Space)">
                {playing ? <Pause /> : <Play />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => seek(0)} title="Restart">
                <RotateCcw />
              </Button>
              <input type="range" min={0} max={Math.max(0.01, total)} step={0.01} value={Math.min(time, total)} onChange={(e) => seek(parseFloat(e.target.value))} className="flex-1 cursor-pointer" aria-label="Scrub" />
              <span className="w-24 text-right font-mono text-xs text-zinc-400">
                {time.toFixed(1)} / {total.toFixed(1)}s
              </span>
            </div>
          </div>
        </section>

        {/* Inspector */}
        <aside className="w-full shrink-0 border-t border-white/[0.06] bg-[#0c0d13] lg:w-[380px] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="space-y-4 border-b border-white/[0.06] p-4">
            <Field label="Output">
              <Select value={video.size} onChange={(e) => update({ size: e.target.value })}>
                {VIDEO_SIZES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} · {s.width}×{s.height} — {s.note}
                  </option>
                ))}
              </Select>
            </Field>
            <Slider label="Transition length" value={video.settings.transitionDuration} min={0.2} max={1.2} step={0.05} onChange={(v) => setSettings({ transitionDuration: v })} format={(v) => `${v.toFixed(2)}s`} />
            <ul className="space-y-1.5 rounded-xl bg-white/[0.02] p-3 text-[11px] ring-1 ring-inset ring-white/[0.06]">
              {[
                { ok: durationOk, label: appStore ? `Duration ${total.toFixed(1)}s (App Store: 15–30s)` : `Duration ${total.toFixed(1)}s` },
                { ok: true, label: `${vsize.width}×${vsize.height} · 30 fps · H.264 MP4` },
                { ok: input.scenes.length >= 2, label: `${input.scenes.length} scenes${missing > 0 ? ` (${missing} missing screenshots skipped)` : ""}` },
              ].map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-zinc-400">
                  {c.ok ? <CheckCircle2 className="size-3.5 text-emerald-400" /> : <CircleAlert className="size-3.5 text-amber-400" />}
                  {c.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-b border-white/[0.06] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Scenes</h3>
              <Select
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  setScenes([...video.scenes, { id: randomId(), screenshotId: e.target.value, duration: 4, transition: "fade", motion: "rise" }]);
                }}
                className="h-8 w-auto text-xs"
              >
                <option value="">+ Add scene…</option>
                {shots.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {i + 1}. {s.name}
                  </option>
                ))}
              </Select>
            </div>
            {video.scenes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                <Film className="mx-auto size-5 text-zinc-500" />
                <p className="mt-2 text-xs text-zinc-400">No scenes yet</p>
                <Button
                  size="sm"
                  className="mt-3"
                  icon={<Plus />}
                  onClick={() => setScenes(shots.slice(0, 5).map((s) => ({ id: randomId(), screenshotId: s.id, duration: 4, transition: "fade" as TransitionKind, motion: "rise" as MotionKind })))}
                  disabled={!shots.length}
                >
                  Add all screenshots
                </Button>
              </div>
            ) : (
              <ol className="space-y-2">
                {video.scenes.map((sc, i) => {
                  const si = shotIndex.get(sc.screenshotId);
                  const shot = si !== undefined ? shots[si] : null;
                  return (
                    <li key={sc.id} className="flex gap-3 rounded-xl bg-white/[0.02] p-2.5 ring-1 ring-inset ring-white/[0.06]">
                      <div className="w-12 shrink-0">
                        {shot ? <ShotCanvas spec={shot.spec} sizeId={videoThumbSize(video.size)} appName={project.name} brandColor={project.primaryColor} className="rounded-md" /> : <div className="aspect-[9/19] rounded-md bg-red-500/10" />}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[10px] text-zinc-500">{i + 1}</span>
                          <span className="truncate text-xs font-medium text-zinc-200">{shot ? shot.name : "Missing screenshot"}</span>
                          <div className="ml-auto flex">
                            <button type="button" onClick={() => moveScene(i, -1)} disabled={i === 0} className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="Move up">
                              <ArrowUp className="size-3" />
                            </button>
                            <button type="button" onClick={() => moveScene(i, 1)} disabled={i === video.scenes.length - 1} className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-white disabled:opacity-30" aria-label="Move down">
                              <ArrowDown className="size-3" />
                            </button>
                            <button type="button" onClick={() => setScenes(video.scenes.filter((x) => x.id !== sc.id))} className="rounded p-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-300" aria-label="Remove scene">
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-[64px_1fr_1fr] gap-1.5">
                          <Input type="number" min={1} max={15} step={0.5} value={sc.duration} onChange={(e) => patchScene(sc.id, { duration: Math.max(1, Math.min(15, parseFloat(e.target.value) || 1)) })} className="h-8 px-2 text-xs" title="Duration (s)" />
                          <Select value={sc.transition} onChange={(e) => patchScene(sc.id, { transition: e.target.value as TransitionKind })} className="h-8 text-xs" title="Transition in">
                            {TRANSITIONS.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </Select>
                          <Select value={sc.motion} onChange={(e) => patchScene(sc.id, { motion: e.target.value as MotionKind })} className="h-8 text-xs" title="Motion">
                            {MOTIONS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">End card</h3>
              <Toggle checked={video.settings.outro.enabled} onChange={(v) => setOutro({ enabled: v })} />
            </div>
            {video.settings.outro.enabled && (
              <>
                <Field label="Title" hint={`Defaults to “${project.name}”`}>
                  <Input value={video.settings.outro.title} onChange={(e) => setOutro({ title: e.target.value })} placeholder={project.name} maxLength={60} />
                </Field>
                <Field label="Subtitle" hint="Defaults to the project tagline">
                  <Input value={video.settings.outro.subtitle} onChange={(e) => setOutro({ subtitle: e.target.value })} placeholder={project.tagline} maxLength={120} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Badge">
                    <Select value={video.settings.outro.badge} onChange={(e) => setOutro({ badge: e.target.value as VideoSettings["outro"]["badge"] })}>
                      <option value="app-store">App Store</option>
                      <option value="google-play">Google Play</option>
                      <option value="none">None</option>
                    </Select>
                  </Field>
                  <Field label="Duration">
                    <Select value={String(video.settings.outro.duration)} onChange={(e) => setOutro({ duration: parseFloat(e.target.value) })}>
                      {[2, 2.5, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>
                          {d}s
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={render.state !== "idle"}
        onClose={closeRender}
        size="md"
        title={render.state === "done" ? "Your preview is ready" : render.state === "error" ? "Render failed" : "Rendering preview video"}
        description={`${vsize.width}×${vsize.height} · 30 fps · ${total.toFixed(1)}s`}
        footer={
          render.state === "done" ? (
            <>
              <Button variant="ghost" onClick={closeRender}>
                Close
              </Button>
              <Button variant="primary" icon={<Download />} onClick={() => downloadBlob(render.blob, render.filename)}>
                Download {render.ext.toUpperCase()}
              </Button>
            </>
          ) : render.state === "error" ? (
            <Button onClick={closeRender}>Close</Button>
          ) : (
            <Button variant="ghost" onClick={closeRender}>
              Cancel
            </Button>
          )
        }
      >
        {render.state === "running" && (
          <div className="py-4">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
              <span>Encoding frame by frame in your browser…</span>
              <span className="font-mono">{Math.round(render.progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all" style={{ width: `${Math.round(render.progress * 100)}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-zinc-500">Uses WebCodecs H.264 when available (faster than real time), otherwise records in real time.</p>
          </div>
        )}
        {render.state === "error" && <p className="text-sm text-red-300">{render.error}</p>}
        {render.state === "done" && (
          <div className="space-y-4">
            <video src={render.url} controls autoPlay muted loop playsInline className="mx-auto max-h-[46vh] rounded-xl bg-black ring-1 ring-white/10" />
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge tone="green">{render.ext.toUpperCase()} · {(render.blob.size / 1024 / 1024).toFixed(1)} MB</Badge>
              <Badge tone={render.hasAudio ? "green" : "amber"}>{render.hasAudio ? "Silent AAC track ✓" : "No audio track"}</Badge>
              <Badge tone="neutral">{render.method === "webcodecs" ? "WebCodecs" : "MediaRecorder"}</Badge>
              <Badge tone={render.saved ? "green" : render.saved === false ? "red" : "neutral"}>{render.saved ? "Saved to Exports" : render.saved === false ? "Not saved" : "Saving…"}</Badge>
            </div>
            {(!render.hasAudio || render.ext !== "mp4") && (
              <div>
                <p className="mb-2 text-xs text-zinc-400">App Store Connect expects H.264 MP4 with an audio track. Normalize with ffmpeg:</p>
                <CodeBlock code={`ffmpeg -i ${render.filename} -f lavfi -i anullsrc=r=48000:cl=stereo \\\n  -c:v libx264 -pix_fmt yuv420p -r 30 -c:a aac -shortest preview-appstore.mp4`} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
