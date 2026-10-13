"use client";

import { ArrowLeft, Check, ChevronLeft, ChevronRight, CloudOff, Download, LayoutTemplate, Link2, Loader2, Plus, Redo2, Save, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { defaultPreviewSize, getOutputSize, OUTPUT_SIZES, TEMPLATE_CATEGORIES } from "@/lib/catalog";
import { api, errMsg, uploadFile } from "@/lib/client/api";
import { pickStyle, type AssetDTO, type ProjectDTO, type ScreenSource, type ScreenshotDTO, type ScreenshotSpec, type TemplateDTO } from "@/lib/types";
import { BackgroundPanel, DevicePanel, LayoutPicker, OverrideSelect, ScreenSourcePicker, Section, TypographyPanel } from "../editor/panels";
import { ExportDialog } from "../export-dialog";
import { ShotCanvas } from "../shot-canvas";
import { TemplatePickerModal } from "../template-picker";
import { Button, cn, Field, Input, Modal, Segmented, Select, Textarea } from "../ui";

type Target = "screen" | "screen2" | "ipad" | "android";

export function ScreenshotEditor({
  project,
  initialShots,
  initialId,
  templates: initialTemplates,
  initialAssets,
}: {
  project: ProjectDTO;
  initialShots: ScreenshotDTO[];
  initialId: string;
  templates: TemplateDTO[];
  initialAssets: AssetDTO[];
}) {
  const [shots, setShots] = useState(initialShots);
  const [activeId, setActiveId] = useState(initialId);
  const first = initialShots.find((s) => s.id === initialId) ?? initialShots[0];
  const [spec, setSpec] = useState<ScreenshotSpec>(first.spec);
  const [name, setName] = useState(first.name);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [sizeId, setSizeId] = useState(defaultPreviewSize(project.platforms));
  const [tab, setTab] = useState<"content" | "design">("content");
  const [assets, setAssets] = useState(initialAssets);
  const [templates, setTemplates] = useState(initialTemplates);
  const [uploading, setUploading] = useState<Target | null>(null);
  const [modal, setModal] = useState<"export" | "templates" | "save-template" | null>(null);
  const [dropping, setDropping] = useState(false);
  const [canUndoRedo, setCanUndoRedo] = useState({ undo: false, redo: false });

  const specRef = useRef(spec);
  const nameRef = useRef(name);
  const idRef = useRef(activeId);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const past = useRef<ScreenshotSpec[]>([]);
  const future = useRef<ScreenshotSpec[]>([]);
  const lastPush = useRef(0);

  const syncHist = useCallback(() => {
    setCanUndoRedo({ undo: past.current.length > 0, redo: future.current.length > 0 });
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    const id = idRef.current;
    setSaveState("saving");
    try {
      const saved = await api<ScreenshotDTO>(`screenshots/${id}`, { method: "PATCH", body: { spec: specRef.current, name: nameRef.current } });
      setShots((list) => list.map((s) => (s.id === id ? { ...s, name: saved.name, updatedAt: saved.updatedAt } : s)));
      if (!dirty.current) setSaveState("saved");
    } catch (e) {
      dirty.current = true;
      setSaveState("error");
      toast.error(`Autosave failed: ${errMsg(e)}`);
    }
  }, []);

  const queue = useCallback(() => {
    dirty.current = true;
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 650);
  }, [flush]);

  const apply = useCallback(
    (next: ScreenshotSpec) => {
      specRef.current = next;
      setSpec(next);
      setShots((list) => list.map((s) => (s.id === idRef.current ? { ...s, spec: next } : s)));
      queue();
    },
    [queue],
  );

  const update = useCallback(
    (patch: Partial<ScreenshotSpec>) => {
      const now = Date.now();
      if (now - lastPush.current > 600) {
        past.current.push(specRef.current);
        if (past.current.length > 80) past.current.shift();
        future.current = [];
        syncHist();
      }
      lastPush.current = now;
      apply({ ...specRef.current, ...patch });
    },
    [apply, syncHist],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(specRef.current);
    lastPush.current = 0;
    apply(prev);
    syncHist();
  }, [apply, syncHist]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(specRef.current);
    lastPush.current = 0;
    apply(next);
    syncHist();
  }, [apply, syncHist]);

  const rename = (v: string) => {
    nameRef.current = v;
    setName(v);
    queue();
  };

  const switchTo = async (id: string) => {
    if (id === idRef.current) return;
    await flush();
    const s = shots.find((x) => x.id === id);
    if (!s) return;
    idRef.current = id;
    specRef.current = s.spec;
    nameRef.current = s.name;
    past.current = [];
    future.current = [];
    syncHist();
    setActiveId(id);
    setSpec(s.spec);
    setName(s.name);
    setSaveState("saved");
    window.history.replaceState(null, "", `/projects/${project.id}/screenshots/${id}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      } else if (mod && e.key.toLowerCase() === "z" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    const onHide = () => {
      if (!dirty.current) return;
      dirty.current = false;
      void fetch(`/api/v1/screenshots/${idRef.current}`, {
        method: "PATCH",
        keepalive: true,
        headers: { "content-type": "application/json", "x-requested-with": "shipshots" },
        body: JSON.stringify({ spec: specRef.current, name: nameRef.current }),
      });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [flush, undo, redo]);

  const setScreen = (target: Target, src: ScreenSource | undefined) => {
    if (target === "screen" && src) update({ screen: src });
    else if (target === "screen2" && src) update({ screen2: src });
    else if (target === "ipad" || target === "android") {
      const ov = { ...specRef.current.overrides };
      if (src) ov[target] = src;
      else delete ov[target];
      update({ overrides: ov });
    }
  };

  const upload = async (file: File, target: Target) => {
    setUploading(target);
    try {
      const a = await uploadFile<AssetDTO>(file, { projectId: project.id });
      setAssets((x) => [a, ...x]);
      setScreen(target, { kind: "asset", assetId: a.id });
      toast.success("Capture uploaded", { description: `${a.width}×${a.height}` });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setUploading(null);
    }
  };

  const addShot = async () => {
    await flush();
    try {
      const created = await api<ScreenshotDTO>(`projects/${project.id}/screenshots`, { body: {} });
      setShots((s) => [...s, created]);
      idRef.current = created.id;
      specRef.current = created.spec;
      nameRef.current = created.name;
      past.current = [];
      future.current = [];
      syncHist();
      setActiveId(created.id);
      setSpec(created.spec);
      setName(created.name);
      window.history.replaceState(null, "", `/projects/${project.id}/screenshots/${created.id}`);
      toast.success("Screenshot added");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const idx = shots.findIndex((s) => s.id === activeId);
  const size = getOutputSize(sizeId);
  const portraitSize = sizeId === "play-feature" ? (project.platforms === "android" ? "android-phone" : "iphone-69") : sizeId;
  const projectAssets = assets.filter((a) => a.projectId === project.id || a.projectId === null);
  const visibleAssets = projectAssets.length ? projectAssets : assets;
  const pano = { index: Math.max(0, idx), count: shots.length };
  const renderUrl = typeof window !== "undefined" ? `${window.location.origin}/api/v1/screenshots/${activeId}/render?size=${sizeId}` : "";

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col lg:h-screen lg:min-h-0">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-[#0c0d13] px-3 py-2 sm:px-4">
        <Link href={`/projects/${project.id}`} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-400 hover:bg-white/[0.05] hover:text-white">
          <ArrowLeft className="size-4" /> <span className="hidden max-w-32 truncate sm:inline">{project.name}</span>
        </Link>
        <div className="h-5 w-px bg-white/10" />
        <input value={name} onChange={(e) => rename(e.target.value)} className="w-40 min-w-0 rounded-md bg-transparent px-2 py-1 text-sm font-medium text-white outline-none ring-indigo-400/50 hover:bg-white/[0.04] focus:ring-2 sm:w-56" maxLength={80} aria-label="Screenshot name" />
        <span className={cn("flex items-center gap-1 text-[11px]", saveState === "error" ? "text-red-400" : "text-zinc-500")}>
          {saveState === "saving" ? <Loader2 className="size-3 animate-spin" /> : saveState === "error" ? <CloudOff className="size-3" /> : saveState === "saved" ? <Check className="size-3 text-emerald-400" /> : <span className="size-1.5 rounded-full bg-amber-400" />}
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : saveState === "saved" ? "Saved" : "Unsaved"}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="icon" variant="ghost" onClick={undo} disabled={!canUndoRedo.undo} title="Undo (⌘Z)">
            <Undo2 />
          </Button>
          <Button size="icon" variant="ghost" onClick={redo} disabled={!canUndoRedo.redo} title="Redo (⇧⌘Z)">
            <Redo2 />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => void flush()} title="Save now (⌘S)">
            <Save />
          </Button>
          <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          <Button size="sm" variant="ghost" icon={<Link2 />} onClick={() => navigator.clipboard.writeText(renderUrl).then(() => toast.success("Render URL copied", { description: "GET it with your API key to fetch a PNG." }))} className="hidden md:inline-flex">
            API URL
          </Button>
          <Button size="sm" icon={<LayoutTemplate />} onClick={() => setModal("save-template")}>
            Save as template
          </Button>
          <Button size="sm" variant="primary" icon={<Download />} onClick={async () => { await flush(); setModal("export"); }}>
            Export
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        {/* Controls */}
        <aside className="w-full shrink-0 border-t border-white/[0.06] bg-[#0c0d13] lg:w-[340px] lg:overflow-y-auto lg:border-r lg:border-t-0">
          <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0c0d13] p-3">
            <Segmented
              className="w-full"
              value={tab}
              onChange={setTab}
              options={[
                { value: "content", label: "Content" },
                { value: "design", label: "Design" },
              ]}
            />
          </div>
          {tab === "content" ? (
            <>
              <Section title="Copy">
                <Field label="Headline" hint="Wrap words in *asterisks* to highlight · Enter for a line break">
                  <Textarea rows={3} value={spec.headline} onChange={(e) => update({ headline: e.target.value })} maxLength={200} />
                </Field>
                <Field label="Subheadline">
                  <Textarea rows={2} value={spec.subheadline} onChange={(e) => update({ subheadline: e.target.value })} maxLength={300} />
                </Field>
                <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                  <Field label="Eyebrow">
                    <Input value={spec.eyebrow} onChange={(e) => update({ eyebrow: e.target.value })} placeholder="e.g. NEW · 4.9 rating" maxLength={60} />
                  </Field>
                  <Segmented
                    size="sm"
                    value={spec.eyebrowStyle}
                    onChange={(v) => update({ eyebrowStyle: v })}
                    options={[
                      { value: "pill", label: "Pill" },
                      { value: "stars", label: "★" },
                      { value: "plain", label: "Text" },
                    ]}
                  />
                </div>
              </Section>
              <Section title="Screen">
                <ScreenSourcePicker key={`${activeId}-s1`} value={spec.screen} onChange={(s) => setScreen("screen", s)} assets={visibleAssets} onUpload={(f) => upload(f, "screen")} uploading={uploading === "screen"} />
              </Section>
              {spec.layout === "duo" && (
                <Section title="Second screen (duo)">
                  <ScreenSourcePicker key={`${activeId}-s2`} value={spec.screen2} onChange={(s) => setScreen("screen2", s)} assets={visibleAssets} onUpload={(f) => upload(f, "screen2")} uploading={uploading === "screen2"} />
                </Section>
              )}
              <Section title="Per-device screens" defaultOpen={false}>
                <p className="text-[11px] leading-relaxed text-zinc-500">Use a different capture when rendering iPad or Android sizes (e.g. a Pixel capture for Google Play).</p>
                {project.platforms !== "android" && <OverrideSelect label="iPad sizes" value={spec.overrides.ipad} onChange={(s) => setScreen("ipad", s)} assets={visibleAssets} />}
                {project.platforms !== "ios" && <OverrideSelect label="Android sizes" value={spec.overrides.android} onChange={(s) => setScreen("android", s)} assets={visibleAssets} />}
              </Section>
            </>
          ) : (
            <>
              <Section
                title="Layout"
                right={
                  <button type="button" onClick={() => setModal("templates")} className="text-[11px] font-medium text-indigo-300 hover:text-indigo-200">
                    Templates
                  </button>
                }
              >
                <LayoutPicker spec={spec} onChange={update} sizeId={portraitSize} appName={project.name} brandColor={project.primaryColor} />
              </Section>
              <Section title="Background">
                <BackgroundPanel spec={spec} onChange={update} />
              </Section>
              <Section title="Typography">
                <TypographyPanel spec={spec} onChange={update} />
              </Section>
              <Section title="Device">
                <DevicePanel spec={spec} onChange={update} />
              </Section>
            </>
          )}
        </aside>

        {/* Stage */}
        <section className="bg-stage flex min-h-[70vh] min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Select value={sizeId} onChange={(e) => setSizeId(e.target.value)} className="w-auto min-w-52">
              {(["app-store", "google-play"] as const).map((store) => (
                <optgroup key={store} label={store === "app-store" ? "App Store" : "Google Play"}>
                  {OUTPUT_SIZES.filter((s) => s.store === store).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} · {s.width}×{s.height}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <Button size="icon" variant="ghost" disabled={idx <= 0} onClick={() => switchTo(shots[idx - 1].id)} title="Previous screenshot">
                <ChevronLeft />
              </Button>
              <span className="font-mono">
                {idx + 1} / {shots.length}
              </span>
              <Button size="icon" variant="ghost" disabled={idx >= shots.length - 1} onClick={() => switchTo(shots[idx + 1].id)} title="Next screenshot">
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center p-4"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) {
                e.preventDefault();
                setDropping(true);
              }
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropping(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void upload(f, "screen");
            }}
          >
            <div className="relative" style={{ width: size.width > size.height ? "min(100%, 760px)" : `min(100%, calc((100vh - 230px) * ${size.width / size.height}), 420px)` }}>
              <ShotCanvas spec={spec} sizeId={sizeId} appName={project.name} brandColor={project.primaryColor} panorama={pano} className="shadow-2xl shadow-black/60 ring-1 ring-white/10" />
              {dropping && (
                <div className="absolute inset-0 grid place-items-center rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-500/20 text-sm font-medium text-white backdrop-blur-sm">Drop to use as screen</div>
              )}
              {uploading === "screen" && (
                <div className="absolute inset-0 grid place-items-center rounded-xl bg-black/50">
                  <Loader2 className="size-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur">
              {size.width}×{size.height} · {size.note}
            </div>
          </div>
          {/* Filmstrip */}
          <div className="flex gap-2 overflow-x-auto border-t border-white/[0.06] bg-black/20 px-4 py-3">
            {shots.map((s, i) => (
              <button key={s.id} type="button" onClick={() => switchTo(s.id)} className={cn("w-14 shrink-0 rounded-lg p-0.5 ring-2 transition", s.id === activeId ? "ring-indigo-400" : "ring-transparent opacity-70 hover:opacity-100")} title={s.name}>
                <ShotCanvas spec={s.spec} sizeId={portraitSize} appName={project.name} brandColor={project.primaryColor} panorama={{ index: i, count: shots.length }} className="rounded-md" />
              </button>
            ))}
            <button type="button" onClick={addShot} className="grid w-14 shrink-0 place-items-center rounded-lg border border-dashed border-white/15 text-zinc-500 transition hover:border-indigo-400/50 hover:text-zinc-200" title="Add screenshot">
              <Plus className="size-4" />
            </button>
          </div>
        </section>
      </div>

      {modal === "export" && <ExportDialog open onClose={() => setModal(null)} project={project} shots={shots} onlyIds={[activeId]} />}
      {modal === "templates" && (
        <TemplatePickerModal
          open
          onClose={() => setModal(null)}
          templates={templates}
          sample={spec}
          sizeId={portraitSize}
          appName={project.name}
          brandColor={project.primaryColor}
          description="Replaces layout, background, typography and frame. Your copy and screen stay."
          onPick={(t) => {
            update({ ...t.spec });
            toast.success(`Applied “${t.name}”`);
          }}
        />
      )}
      {modal === "save-template" && (
        <SaveTemplateModal
          spec={spec}
          onClose={() => setModal(null)}
          onSaved={(t) => {
            setTemplates((x) => [...x, t]);
          }}
        />
      )}
    </div>
  );
}

function SaveTemplateModal({ spec, onClose, onSaved }: { spec: ScreenshotSpec; onClose: () => void; onSaved: (t: TemplateDTO) => void }) {
  const [form, setForm] = useState({ name: "", description: "", category: "Custom" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const t = await api<TemplateDTO>("templates", { body: { ...form, spec: pickStyle(spec) } });
      onSaved(t);
      toast.success(`Saved template “${t.name}”`);
      onClose();
    } catch (err) {
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
      title="Save as template"
      description="Stores layout, background, typography and device settings."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="save-tpl" loading={busy}>
            Save template
          </Button>
        </>
      }
    >
      <form id="save-tpl" onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Launch week" maxLength={60} />
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Description">
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" maxLength={200} />
        </Field>
      </form>
    </Modal>
  );
}
