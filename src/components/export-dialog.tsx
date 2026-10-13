"use client";

import JSZip from "jszip";
import { Apple, Check, Download, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { defaultSizesFor, OUTPUT_SIZES } from "@/lib/catalog";
import { errMsg } from "@/lib/client/api";
import { exportPath, slugify, pad2, type ZipLayout } from "@/lib/export-paths";
import { downloadBlob, ensureFonts, loadImagesFor, renderToBlob, uploadExport } from "@/lib/render/client";
import type { ProjectDTO, ScreenshotDTO } from "@/lib/types";
import { Button, cn, Modal, Segmented, Toggle } from "./ui";

export function ExportDialog({ open, onClose, project, shots, onlyIds }: { open: boolean; onClose: () => void; project: ProjectDTO; shots: ScreenshotDTO[]; onlyIds?: string[] }) {
  const [sizes, setSizes] = useState<string[]>(() => defaultSizesFor(project.platforms));
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [layout, setLayout] = useState<ZipLayout>("fastlane");
  const [save, setSave] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const targets = shots.map((s, i) => ({ s, i })).filter(({ s }) => !onlyIds || onlyIds.includes(s.id));
  const ext = format === "jpeg" ? "jpg" : "png";
  const jobs = sizes.flatMap((sid) => {
    const size = OUTPUT_SIZES.find((o) => o.id === sid)!;
    return targets.map(({ s, i }) => ({ size, s, i, path: exportPath(layout, size, i, s.spec.headline, ext) })).filter((j) => j.path);
  });

  const toggle = (id: string) => setSizes((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  const run = async () => {
    if (!jobs.length) return;
    setProgress(0);
    try {
      await ensureFonts();
      const images = await loadImagesFor(targets.map((t) => t.s.spec));
      const render = (j: (typeof jobs)[number]) =>
        renderToBlob({ spec: j.s.spec, sizeId: j.size.id, images, appName: project.name, brandColor: project.primaryColor, panorama: { index: j.i, count: shots.length }, format });
      if (jobs.length === 1) {
        const j = jobs[0];
        const blob = await render(j);
        const name = `${slugify(project.name)}-${pad2(j.i + 1)}-${j.size.id}.${ext}`;
        downloadBlob(blob, name);
        if (save) await uploadExport(blob, { name, kind: "image", projectId: project.id, width: j.size.width, height: j.size.height, meta: { size: j.size.id, screenshotId: j.s.id } });
      } else {
        const zip = new JSZip();
        for (let k = 0; k < jobs.length; k++) {
          zip.file(jobs[k].path!, await render(jobs[k]));
          setProgress(((k + 1) / jobs.length) * 0.9);
          await new Promise((r) => setTimeout(r, 0));
        }
        zip.file("manifest.json", JSON.stringify({ project: project.name, bundleId: project.bundleId, layout, format, sizes, files: jobs.map((j) => j.path), generatedAt: new Date().toISOString() }, null, 2));
        const blob = await zip.generateAsync({ type: "blob", compression: "STORE" }, (m) => setProgress(0.9 + m.percent / 1000));
        const name = `${slugify(project.name)}-${layout}-${new Date().toISOString().slice(0, 10)}.zip`;
        downloadBlob(blob, name);
        if (save) await uploadExport(blob, { name, kind: "archive", projectId: project.id, meta: { sizes, files: jobs.length, layout } });
      }
      setProgress(1);
      toast.success(jobs.length === 1 ? "Screenshot exported" : `Exported ${jobs.length} images`, { description: save ? "A copy was saved to your Exports library." : undefined });
      setTimeout(() => {
        setProgress(null);
        onClose();
      }, 500);
    } catch (e) {
      toast.error(errMsg(e));
      setProgress(null);
    }
  };

  const group = (store: "app-store" | "google-play") => OUTPUT_SIZES.filter((s) => s.store === store);
  const running = progress !== null;

  return (
    <Modal
      open={open}
      onClose={() => !running && onClose()}
      size="lg"
      title={onlyIds?.length === 1 ? "Export screenshot" : "Export screenshots"}
      description={`${targets.length} screenshot${targets.length === 1 ? "" : "s"} × ${sizes.length} size${sizes.length === 1 ? "" : "s"} → ${jobs.length} file${jobs.length === 1 ? "" : "s"}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={running}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Download />} onClick={run} loading={running} disabled={!jobs.length}>
            {running ? `Rendering ${Math.round((progress ?? 0) * 100)}%` : jobs.length > 1 ? "Export ZIP" : "Export"}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {(["app-store", "google-play"] as const).map((store) => (
          <div key={store}>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-300">
              {store === "app-store" ? <Apple className="size-3.5" /> : <Smartphone className="size-3.5" />}
              {store === "app-store" ? "App Store" : "Google Play"}
            </div>
            <div className="space-y-1">
              {group(store).map((s) => {
                const on = sizes.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ring-1 ring-inset transition", on ? "bg-indigo-500/10 ring-indigo-400/30" : "ring-white/[0.06] hover:bg-white/[0.03]")}
                  >
                    <span className={cn("grid size-4 shrink-0 place-items-center rounded", on ? "bg-indigo-500 text-white" : "ring-1 ring-white/20")}>{on && <Check className="size-3" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                        {s.label}
                        {s.required && <span className="rounded bg-amber-500/15 px-1 text-[9px] font-semibold uppercase text-amber-300">required</span>}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-500">{s.note}</span>
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500">
                      {s.width}×{s.height}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 rounded-xl bg-white/[0.02] p-4 ring-1 ring-inset ring-white/[0.06] sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-400">Format</div>
          <Segmented value={format} onChange={setFormat} options={[{ value: "png", label: "PNG" }, { value: "jpeg", label: "JPEG" }]} />
          <p className="mt-1.5 text-[11px] text-zinc-500">JPEG avoids alpha-channel rejections on Google Play.</p>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-400">Folder structure</div>
          <Segmented value={layout} onChange={setLayout} options={[{ value: "fastlane", label: "fastlane" }, { value: "flat", label: "By store / size" }]} />
          <p className="mt-1.5 text-[11px] text-zinc-500">{layout === "fastlane" ? "Ready for `fastlane deliver` and `supply`." : "store/size/01-headline.png"}</p>
        </div>
        <div className="sm:col-span-2">
          <Toggle checked={save} onChange={setSave} label="Save a copy to the Exports library" />
        </div>
      </div>
      {running && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
        </div>
      )}
    </Modal>
  );
}
