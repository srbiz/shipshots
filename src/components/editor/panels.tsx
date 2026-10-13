"use client";

import { ChevronDown, Loader2, Plus, Upload, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BACKGROUND_PRESETS, DEVICES, FONTS, FRAME_COLORS, LAYOUTS, MOCKS } from "@/lib/catalog";
import { assetUrl } from "@/lib/render/client";
import type { AssetDTO, Background, BackgroundType, DeviceKind, FontKey, ScreenSource, ScreenshotSpec } from "@/lib/types";
import { ShotCanvas } from "../shot-canvas";
import { cn, ColorField, Field, Segmented, Select, Slider, Toggle } from "../ui";

export type OnSpecChange = (patch: Partial<ScreenshotSpec>) => void;

export function Section({ title, children, defaultOpen = true, right }: { title: string; children: ReactNode; defaultOpen?: boolean; right?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/[0.06]">
      <div className="flex items-center justify-between px-4">
        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-1.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200">
          <ChevronDown className={cn("size-3.5 transition", !open && "-rotate-90")} />
          {title}
        </button>
        {right}
      </div>
      {open && <div className="space-y-4 px-4 pb-5">{children}</div>}
    </div>
  );
}

export function cssBackground(bg: Background): string {
  const [c0, c1 = c0, c2 = c1] = bg.colors;
  switch (bg.type) {
    case "linear":
      return `linear-gradient(${bg.angle}deg, ${bg.colors.join(", ")})`;
    case "radial":
      return `radial-gradient(circle at 50% 35%, ${c1}, ${c0} 75%)`;
    case "mesh":
      return `radial-gradient(at 15% 15%, ${c1} 0, transparent 55%), radial-gradient(at 85% 75%, ${c2} 0, transparent 55%), ${c0}`;
    case "grid":
    case "dots":
      return `radial-gradient(circle at 50% 0%, ${c1}66, transparent 70%), ${c0}`;
    default:
      return c0;
  }
}

export function LayoutPicker({ spec, onChange, sizeId, appName, brandColor }: { spec: ScreenshotSpec; onChange: OnSpecChange; sizeId: string; appName?: string; brandColor?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {LAYOUTS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onChange({ layout: l.id })}
          title={l.description}
          className={cn("rounded-lg p-1 text-left ring-2 transition", spec.layout === l.id ? "bg-indigo-500/10 ring-indigo-400" : "ring-transparent hover:bg-white/[0.04]")}
        >
          <ShotCanvas spec={{ ...spec, layout: l.id }} sizeId={sizeId} appName={appName} brandColor={brandColor} className="rounded-md" />
          <div className="mt-1 truncate px-0.5 text-[10px] font-medium text-zinc-400">{l.label}</div>
        </button>
      ))}
    </div>
  );
}

export function DevicePanel({ spec, onChange }: { spec: ScreenshotSpec; onChange: OnSpecChange }) {
  return (
    <>
      <Field label="Device frame">
        <Select value={spec.device} onChange={(e) => onChange({ device: e.target.value as DeviceKind })} disabled={spec.layout === "frameless" || spec.layout === "full-bleed"}>
          {DEVICES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} — {d.hint}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <div className="mb-1.5 text-xs font-medium text-zinc-400">Frame finish</div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {FRAME_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              onClick={() => onChange({ frameColor: c.hex })}
              className={cn("size-6 rounded-full ring-2 transition hover:scale-110", spec.frameColor.toUpperCase() === c.hex.toUpperCase() ? "ring-indigo-400" : "ring-white/10")}
              style={{ background: `linear-gradient(135deg, ${c.hex}, ${c.hex}99)` }}
            />
          ))}
        </div>
        <ColorField value={spec.frameColor} onChange={(v) => onChange({ frameColor: v })} />
      </div>
      <Slider label="Device size" value={spec.deviceScale} min={0.6} max={1.3} onChange={(v) => onChange({ deviceScale: v })} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Vertical offset" value={spec.deviceOffset} min={-0.3} max={0.3} onChange={(v) => onChange({ deviceOffset: v })} format={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`} />
      <Slider label="Tilt" value={spec.tilt} min={-25} max={25} step={1} onChange={(v) => onChange({ tilt: v })} format={(v) => `${v}°`} />
      <div className="flex flex-col gap-2.5">
        <Toggle checked={spec.shadow} onChange={(v) => onChange({ shadow: v })} label="Drop shadow" />
        <Toggle checked={spec.showStatusBar} onChange={(v) => onChange({ showStatusBar: v })} label="Status bar on mock screens" />
      </div>
    </>
  );
}

export function BackgroundPanel({ spec, onChange }: { spec: ScreenshotSpec; onChange: OnSpecChange }) {
  const bg = spec.background;
  const setBg = (patch: Partial<Background>) => onChange({ background: { ...bg, ...patch } });
  const types: { value: BackgroundType; label: string }[] = [
    { value: "mesh", label: "Mesh" },
    { value: "linear", label: "Linear" },
    { value: "radial", label: "Radial" },
    { value: "solid", label: "Solid" },
    { value: "grid", label: "Grid" },
    { value: "dots", label: "Dots" },
  ];
  return (
    <>
      <div className="grid grid-cols-6 gap-1.5">
        {BACKGROUND_PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            title={p.name}
            onClick={() => onChange({ background: p.background, textColor: p.textColor, accentColor: p.accentColor })}
            className="aspect-square rounded-lg ring-1 ring-white/10 transition hover:scale-105 hover:ring-white/40"
            style={{ background: cssBackground(p.background) }}
          />
        ))}
      </div>
      <Field label="Style">
        <Select value={bg.type} onChange={(e) => setBg({ type: e.target.value as BackgroundType })}>
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="space-y-2">
        <div className="text-xs font-medium text-zinc-400">Colors</div>
        {bg.colors.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1">
              <ColorField value={c} onChange={(v) => setBg({ colors: bg.colors.map((x, j) => (j === i ? v : x)) })} />
            </div>
            {bg.colors.length > 1 && (
              <button type="button" onClick={() => setBg({ colors: bg.colors.filter((_, j) => j !== i) })} className="rounded-md p-1.5 text-zinc-500 hover:bg-white/10 hover:text-white" aria-label="Remove color">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {bg.colors.length < 4 && (
          <button type="button" onClick={() => setBg({ colors: [...bg.colors, bg.colors[bg.colors.length - 1] ?? "#6366F1"] })} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 hover:text-indigo-200">
            <Plus className="size-3.5" /> Add color
          </button>
        )}
      </div>
      {bg.type === "linear" && <Slider label="Angle" value={bg.angle} min={0} max={360} step={1} onChange={(v) => setBg({ angle: v })} format={(v) => `${v}°`} />}
    </>
  );
}

export function TypographyPanel({ spec, onChange }: { spec: ScreenshotSpec; onChange: OnSpecChange }) {
  return (
    <>
      <Field label="Font">
        <Select value={spec.font} onChange={(e) => onChange({ font: e.target.value as FontKey })}>
          {Object.entries(FONTS).map(([k, f]) => (
            <option key={k} value={k}>
              {f.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <ColorField label="Text" value={spec.textColor} onChange={(v) => onChange({ textColor: v })} />
        <ColorField label="Highlight" value={spec.accentColor} onChange={(v) => onChange({ accentColor: v })} />
      </div>
      <Field label="Alignment">
        <Segmented
          className="w-full"
          value={spec.textAlign}
          onChange={(v) => onChange({ textAlign: v })}
          options={[
            { value: "center", label: "Center" },
            { value: "left", label: "Left" },
          ]}
        />
      </Field>
      <Slider label="Headline size" value={spec.headlineScale} min={0.6} max={1.6} onChange={(v) => onChange({ headlineScale: v })} format={(v) => `${Math.round(v * 100)}%`} />
    </>
  );
}

export function ScreenSourcePicker({
  value,
  onChange,
  assets,
  onUpload,
  uploading,
}: {
  value: ScreenSource;
  onChange: (s: ScreenSource) => void;
  assets: AssetDTO[];
  onUpload: (f: File) => void;
  uploading: boolean;
}) {
  const [mode, setMode] = useState<"mock" | "upload">(value.kind === "asset" ? "upload" : "mock");
  const dark = value.kind === "mock" ? value.dark : true;
  return (
    <div className="space-y-3">
      <Segmented
        className="w-full"
        value={mode}
        onChange={setMode}
        options={[
          { value: "upload", label: "Your capture" },
          { value: "mock", label: "Mock UI" },
        ]}
      />
      {mode === "mock" ? (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {MOCKS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange({ kind: "mock", mock: m.id, dark })}
                className={cn("rounded-lg px-2.5 py-2 text-left text-xs font-medium ring-1 ring-inset transition", value.kind === "mock" && value.mock === m.id ? "bg-indigo-500/15 text-white ring-indigo-400/40" : "text-zinc-400 ring-white/[0.07] hover:bg-white/[0.04] hover:text-zinc-200")}
              >
                {m.label}
              </button>
            ))}
          </div>
          <Segmented
            className="w-full"
            size="sm"
            value={dark ? "dark" : "light"}
            onChange={(v) => onChange({ kind: "mock", mock: value.kind === "mock" ? value.mock : "dashboard", dark: v === "dark" })}
            options={[
              { value: "dark", label: "Dark UI" },
              { value: "light", label: "Light UI" },
            ]}
          />
        </>
      ) : (
        <>
          <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 px-3 py-5 text-center transition hover:border-indigo-400/50 hover:bg-indigo-500/[0.04]", uploading && "pointer-events-none opacity-60")}>
            {uploading ? <Loader2 className="size-5 animate-spin text-indigo-300" /> : <Upload className="size-5 text-zinc-400" />}
            <span className="text-xs font-medium text-zinc-300">{uploading ? "Uploading…" : "Upload simulator capture"}</span>
            <span className="text-[11px] text-zinc-500">PNG, JPEG or WebP · or drop onto the preview</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          {assets.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {assets.slice(0, 16).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  title={`${a.name} · ${a.width}×${a.height}`}
                  onClick={() => onChange({ kind: "asset", assetId: a.id })}
                  className={cn("overflow-hidden rounded-md ring-2 transition", value.kind === "asset" && value.assetId === a.id ? "ring-indigo-400" : "ring-white/[0.06] hover:ring-white/30")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetUrl(a.id)} alt={a.name} className="aspect-[9/16] w-full bg-zinc-900 object-cover object-top" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function OverrideSelect({ label, value, onChange, assets }: { label: string; value: ScreenSource | undefined; onChange: (s: ScreenSource | undefined) => void; assets: AssetDTO[] }) {
  const key = !value ? "" : value.kind === "asset" ? `asset:${value.assetId}` : `mock:${value.mock}:${value.dark ? 1 : 0}`;
  return (
    <Field label={label}>
      <Select
        value={key}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return onChange(undefined);
          const [kind, id, d] = v.split(":");
          onChange(kind === "asset" ? { kind: "asset", assetId: id } : { kind: "mock", mock: id as never, dark: d === "1" });
        }}
      >
        <option value="">Same as default screen</option>
        {assets.length > 0 && (
          <optgroup label="Your captures">
            {assets.map((a) => (
              <option key={a.id} value={`asset:${a.id}`}>
                {a.name} ({a.width}×{a.height})
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Mock UI">
          {MOCKS.map((m) => (
            <option key={m.id} value={`mock:${m.id}:1`}>
              {m.label} (dark)
            </option>
          ))}
        </optgroup>
      </Select>
    </Field>
  );
}
