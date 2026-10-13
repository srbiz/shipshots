"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CATEGORIES, FONTS } from "@/lib/catalog";
import { api, errMsg } from "@/lib/client/api";
import { darken, lighten, mix } from "@/lib/render/canvas-utils";
import { DEFAULT_SPEC, normalizeSpec, type FontKey, type Platform, type ProjectDTO, type TemplateDTO } from "@/lib/types";
import { ShotCanvas } from "./shot-canvas";
import { Button, ColorField, Field, Input, Modal, Segmented, Select, Textarea, Toggle } from "./ui";

const PALETTES: [string, string][] = [
  ["#6366F1", "#22D3EE"],
  ["#10B981", "#A3E635"],
  ["#F97316", "#EC4899"],
  ["#8B5CF6", "#F472B6"],
  ["#0EA5E9", "#6366F1"],
  ["#EF4444", "#F59E0B"],
];

export function ProjectFormModal({
  open,
  onClose,
  project,
  templates = [],
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project?: ProjectDTO | null;
  templates?: TemplateDTO[];
  onSaved: (p: ProjectDTO, isNew: boolean) => void;
}) {
  const isNew = !project;
  const [form, setForm] = useState(() => ({
    name: project?.name ?? "",
    tagline: project?.tagline ?? "",
    description: project?.description ?? "",
    platforms: (project?.platforms ?? "both") as Platform,
    bundleId: project?.bundleId ?? "",
    category: project?.category ?? "Developer Tools",
    primaryColor: project?.primaryColor ?? "#6366F1",
    accentColor: project?.accentColor ?? "#22D3EE",
    font: (project?.font ?? "inter") as FontKey,
    templateId: "",
    starter: true,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const preview = useMemo(() => {
    const tpl = templates.find((t) => t.id === form.templateId);
    const brand = {
      background: { type: "mesh" as const, colors: [darken(form.primaryColor, 0.82), form.primaryColor, form.accentColor, mix(form.primaryColor, form.accentColor, 0.5)], angle: 160 },
      accentColor: lighten(form.accentColor, 0.25),
      textColor: "#FFFFFF",
      font: form.font,
    };
    return normalizeSpec({ ...DEFAULT_SPEC, ...(tpl ? tpl.spec : brand), headline: form.tagline || `Meet *${form.name || "your app"}*`, subheadline: "Lead with your strongest value proposition.", eyebrow: "" });
  }, [form, templates]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { name: form.name, tagline: form.tagline, description: form.description, platforms: form.platforms, bundleId: form.bundleId, category: form.category, primaryColor: form.primaryColor, accentColor: form.accentColor, font: form.font };
      const saved = isNew
        ? await api<ProjectDTO>("projects", { body: { ...payload, templateId: form.templateId || undefined, starter: form.starter } })
        : await api<ProjectDTO>(`projects/${project!.id}`, { method: "PATCH", body: payload });
      toast.success(isNew ? `Created ${saved.name}` : "Project updated");
      onSaved(saved, isNew);
      onClose();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isNew ? "New project" : `Edit ${project?.name}`}
      description={isNew ? "A project is one app with its store screenshots and preview videos." : "Brand settings apply to new screenshots."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="project-form" loading={busy}>
            {isNew ? "Create project" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 sm:grid-cols-[1fr_170px]">
        <form id="project-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="App name">
              <Input required autoFocus value={form.name} maxLength={60} onChange={(e) => set("name", e.target.value)} placeholder="Shipyard" />
            </Field>
            <Field label="Bundle / package ID">
              <Input value={form.bundleId} onChange={(e) => set("bundleId", e.target.value)} placeholder="com.company.app" className="font-mono text-xs" />
            </Field>
          </div>
          <Field label="Tagline" hint="Used as the hero headline. Wrap words in *asterisks* to highlight them.">
            <Input value={form.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} placeholder="CI/CD in your *pocket*" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Platforms">
              <Segmented
                className="w-full"
                value={form.platforms}
                onChange={(v) => set("platforms", v)}
                options={[
                  { value: "ios", label: "iOS" },
                  { value: "android", label: "Android" },
                  { value: "both", label: "Both" },
                ]}
              />
            </Field>
            <Field label="Category">
              <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-zinc-400">Brand colors</div>
            <div className="mb-2 flex gap-2">
              {PALETTES.map(([a, b]) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, primaryColor: a, accentColor: b }))}
                  className="size-7 rounded-full ring-2 ring-transparent transition hover:scale-110 hover:ring-white/30"
                  style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                  aria-label={`Palette ${a}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField value={form.primaryColor} onChange={(v) => set("primaryColor", v)} />
              <ColorField value={form.accentColor} onChange={(v) => set("accentColor", v)} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Headline font">
              <Select value={form.font} onChange={(e) => set("font", e.target.value as FontKey)}>
                {Object.entries(FONTS).map(([k, f]) => (
                  <option key={k} value={k}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            {isNew && (
              <Field label="Starter template">
                <Select value={form.templateId} onChange={(e) => set("templateId", e.target.value)}>
                  <option value="">Brand colors (default)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          {!isNew && (
            <Field label="Description">
              <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What does the app do?" />
            </Field>
          )}
          {isNew && <Toggle checked={form.starter} onChange={(v) => set("starter", v)} label="Add 3 starter screenshots" />}
          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
        </form>
        <div className="hidden sm:block">
          <div className="mb-1.5 text-xs font-medium text-zinc-400">Live preview</div>
          <ShotCanvas spec={preview} sizeId={form.platforms === "android" ? "android-phone" : "iphone-69"} appName={form.name || "App"} brandColor={form.primaryColor} className="ring-1 ring-white/10" />
        </div>
      </div>
    </Modal>
  );
}
